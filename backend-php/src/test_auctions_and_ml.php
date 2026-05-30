<?php
declare(strict_types=1);

namespace Agrored\Tests;

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/Support/RedisClient.php';
require_once __DIR__ . '/Modules/Auctions/AuctionModule.php';
require_once __DIR__ . '/Modules/Ml/MlModule.php';
require_once __DIR__ . '/Security/Auth.php';

use Agrored\Modules\Auctions\AuctionModule;
use Agrored\Modules\Ml\MlModule;
use Agrored\Security\Auth;
use Agrored\Support\RedisClient;
use ReflectionClass;
use DateTimeImmutable;

final class AuctionAndMlTest
{
    public static function run(): void
    {
        echo "=== INICIANDO PRUEBAS UNITARIAS MATEMÁTICAS EN PHP ===\n\n";

        self::testHaversine();
        self::testAgroMatchAEA();
        self::testDutchDecay();
        self::testVisibilityExpansion();
        self::testAntiSniping();
        self::testProxyBidding();
        self::testSmartMatchTieBreaker();
        self::testMlReadinessScores();
        self::testMlRecommendations();
        self::testRedisClientGracefulDegradation();

        echo "\n🎉 TODAS LAS PRUEBAS MATEMÁTICAS SE EJECUTARON EXITOSAMENTE Y LOGRARON 100% PARIDAD 🎉\n";
    }

    private static function getPrivateMethod(string $class, string $method)
    {
        $reflector = new ReflectionClass($class);
        $method = $reflector->getMethod($method);
        $method->setAccessible(true);
        return $method;
    }

    private static function testHaversine(): void
    {
        echo "⏳ Probando Haversine (Distancia Geométrica)... ";
        $method = self::getPrivateMethod(AuctionModule::class, 'haversineKm');
        
        // Medellín to Bogotá coordinates
        $dist = $method->invoke(null, 6.2442, -75.5812, 4.7110, -74.0721);
        
        // Distance should be ~235-250 km
        if ($dist < 235 || $dist > 250) {
            throw new \Exception("Haversine falló. Esperado ~244km, obtenido: " . $dist);
        }
        echo "✅ OK [Distancia: " . round($dist, 2) . " km]\n";
    }

    private static function testAgroMatchAEA(): void
    {
        echo "⏳ Probando AgroMatch AEA Ranking Score... ";
        $method = self::getPrivateMethod(AuctionModule::class, 'calculateAEA');

        $now = new DateTimeImmutable();
        $startsAt = $now->format(DATE_ATOM);
        $harvestDate = $now->modify('-12 hours')->format(DATE_ATOM);

        $auction = [
            'id' => 'auction-uuid',
            'starts_at' => $startsAt,
            'harvest_date' => $harvestDate,
            'shelf_life_hours' => 48,
            'latitude' => 6.2442,
            'longitude' => -75.5812,
            'visibility_phase' => 'phase_1',
        ];

        // Buyer very close: 6.25, -75.59 (distance ~ 1.2km)
        $aea = $method->invoke(null, $auction, 6.25, -75.59, 85.0, 90.0);

        if ($aea['score'] < 70) {
            throw new \Exception("AgroMatch falló. Puntuación esperada alta (>70), obtenido: " . $aea['score']);
        }

        echo "✅ OK [Score: " . $aea['score'] . " | Proximidad: " . $aea['proximityScore'] . " | Frescura: " . $aea['freshnessScore'] . "]\n";
    }

    private static function testDutchDecay(): void
    {
        echo "⏳ Probando Decaimiento de Precio Holandés... ";
        $method = self::getPrivateMethod(AuctionModule::class, 'calculateDutchPrice');

        $now = time();
        // Starts 25 minutes ago, step minutes is 10. Number of steps should be 2.
        $startsAt = (new DateTimeImmutable())->modify('-25 minutes')->format(DATE_ATOM);

        $auction = [
            'starts_at' => $startsAt,
            'base_price' => 100000,
            'reserve_price' => 50000,
            'dutch_step_percent' => 10.0,
            'dutch_step_minutes' => 10.0,
            'current_price' => 100000,
        ];

        $dp = $method->invoke(null, $auction);

        // basePrice * (1 - 0.10)^2 = 100000 * 0.81 = 81000
        if ($dp['currentPrice'] != 81000) {
            throw new \Exception("Precio holandés falló. Esperado 81000, obtenido: " . $dp['currentPrice']);
        }
        if ($dp['stepNumber'] != 2) {
            throw new \Exception("Paso holandés incorrecto. Esperado 2, obtenido: " . $dp['stepNumber']);
        }
        if ($dp['reachedReserve']) {
            throw new \Exception("No debería haber alcanzado la reserva.");
        }

        echo "✅ OK [Precio Decaído: " . $dp['currentPrice'] . " | Pasos: " . $dp['stepNumber'] . "]\n";
    }

    private static function testVisibilityExpansion(): void
    {
        echo "⏳ Probando Expansión de Visibilidad Territorial... ";
        $method = self::getPrivateMethod(AuctionModule::class, 'calculateVisibility');

        // Test 1: Dutch auction starts at urgent phase (9999 km) immediately
        $dutchAuction = [
            'auction_type' => 'dutch',
            'starts_at' => (new DateTimeImmutable())->format(DATE_ATOM),
            'visibility_phase' => 'phase_1',
        ];
        $vis1 = $method->invoke(null, $dutchAuction);
        if ($vis1['phase'] !== 'urgent' || $vis1['radiusKm'] != 9999) {
            throw new \Exception("Visibilidad holandesa falló.");
        }

        // Test 2: English auction active for 6 hours should be in phase 2 (150 km)
        $startsAt = (new DateTimeImmutable())->modify('-6 hours')->format(DATE_ATOM);
        $englishAuction = [
            'auction_type' => 'ascending',
            'starts_at' => $startsAt,
            'visibility_phase' => 'phase_1',
        ];
        $vis2 = $method->invoke(null, $englishAuction);
        if ($vis2['phase'] !== 'phase_2' || $vis2['radiusKm'] != 150) {
            throw new \Exception("Fase 2 de visibilidad falló. Obtenido: " . $vis2['phase']);
        }

        echo "✅ OK [Holandesa: " . $vis1['phase'] . " | Inglesa (6h): " . $vis2['phase'] . " (" . $vis2['radiusKm'] . " km)]\n";
    }

    private static function testAntiSniping(): void
    {
        echo "⏳ Probando Anti-Sniping (Soft Close)... ";
        $method = self::getPrivateMethod(AuctionModule::class, 'evaluateAntiSniping');

        // Test 1: Bid placed 30 seconds before endsAt -> must extend by 3 minutes
        $now = new DateTimeImmutable();
        $endsAt = $now->modify('+30 seconds')->format(DATE_ATOM);
        $auction = [
            'ends_at' => $endsAt,
            'extension_count' => 1,
        ];

        $res = $method->invoke(null, $auction);
        if (!$res['extended'] || $res['extensionCount'] != 2) {
            throw new \Exception("Anti-sniping no se activó.");
        }

        $expectedEndsAt = (new DateTimeImmutable($endsAt))->modify('+3 minutes');
        if ($res['newEndsAt']->getTimestamp() !== $expectedEndsAt->getTimestamp()) {
            throw new \Exception("Extensión de tiempo incorrecta.");
        }

        echo "✅ OK [Extendido: Si | Nuevo Cierre: " . $res['newEndsAt']->format('H:i:s') . " | Extensiones: " . $res['extensionCount'] . "]\n";
    }

    private static function testProxyBidding(): void
    {
        echo "⏳ Probando Puja Automática (Proxy Bidding)... ";
        $method = self::getPrivateMethod(AuctionModule::class, 'processProxyBids');

        $proxyBids = [
            [
                'bidder_id' => 'proxy-buyer-1',
                'amount' => 120000,
                'max_proxy_amount' => 150000,
                'social_score' => 80,
            ],
            [
                'bidder_id' => 'proxy-buyer-2',
                'amount' => 110000,
                'max_proxy_amount' => 130000,
                'social_score' => 90,
            ],
        ];

        // A new manual bid comes in at 125,000 COP from 'buyer-3'
        $results = $method->invoke(null, $proxyBids, 125000.0, 'buyer-3');

        // 'proxy-buyer-1' has limit 150,000 COP. Min increment is max(125000 * 0.01, 1000) = 1250 COP.
        // So 'proxy-buyer-1' should bid 126,250 COP.
        if (count($results) < 1 || !$results[0]['shouldBid'] || $results[0]['newAmount'] != 126250) {
            throw new \Exception("Proxy Bidding falló. Esperado 126250, obtenido: " . ($results[0]['newAmount'] ?? 'ninguno'));
        }

        echo "✅ OK [Pujador Automático Ganador: " . $results[0]['bidderId'] . " | Monto: " . $results[0]['newAmount'] . "]\n";
    }

    private static function testSmartMatchTieBreaker(): void
    {
        echo "⏳ Probando Smart Match (Resolución de Empates)... ";
        $method = self::getPrivateMethod(AuctionModule::class, 'determineWinner');

        $bids = [
            [
                'id' => 'bid-1',
                'bidder_id' => 'bidder-1',
                'amount' => 200000,
                'latitude' => 6.2442,
                'longitude' => -75.5812, // Same city: distance 0km, proximity score 100
                'social_score' => 0,
            ],
            [
                'id' => 'bid-2',
                'bidder_id' => 'bidder-2',
                'amount' => 200000,
                'latitude' => 4.7110,
                'longitude' => -74.0721, // Bogotá: distance 244km, proximity score ~18.6
                'social_score' => 100, // PAE high social score
            ],
        ];

        // Producer coordinates: Medellín
        $winner = $method->invoke(null, $bids, 6.2442, -75.5812);

        // bidder-1: proximity score 100 * 0.3 = 30 points. Offer score 100 * 0.6 = 60 points. Total = 90 points.
        // bidder-2: proximity score 18.6 * 0.3 = 5.58. Offer score 100 * 0.6 = 60. Social score 100 * 0.1 = 10. Total = 75.58 points.
        // Winner must be bidder-1
        if ($winner['bidderId'] !== 'bidder-1') {
            throw new \Exception("Smart Match falló. Esperado bidder-1, obtenido: " . $winner['bidderId']);
        }

        echo "✅ OK [Ganador Empate: " . $winner['bidderId'] . " | Score Total: " . $winner['totalScore'] . "]\n";
    }

    private static function testMlReadinessScores(): void
    {
        echo "⏳ Probando Algoritmo de ML Territorial (Readiness Score)... ";
        $method = self::getPrivateMethod(MlModule::class, 'computeScores');

        $inputs = [
            'openDemandUnits' => 100,
            'availableInventoryUnits' => 120, // coverage: 120/100 = 1.2
            'reservedInventoryUnits' => 10,
            'openIncidents' => 1,
            'pendingNotifications' => 2,
            'scheduledLogistics' => 2,
            'scheduledRescues' => 1,
        ];

        $scores = $method->invoke(null, $inputs);

        // supplyCoverageScore = clamp(round((1.2 / 1.5) * 100)) = 80
        if ($scores['supplyCoverageScore'] != 80) {
            throw new \Exception("ML Supply Coverage falló. Esperado 80, obtenido: " . $scores['supplyCoverageScore']);
        }

        if ($scores['readinessScore'] < 50) {
            throw new \Exception("ML Readiness Score incorrecto. Obtenido: " . $scores['readinessScore']);
        }

        echo "✅ OK [Readiness: " . $scores['readinessScore'] . " | Incidents Pressure: " . $scores['incidentPressureScore'] . "]\n";
    }

    private static function testMlRecommendations(): void
    {
        echo "⏳ Probando Generación de Recomendaciones Operativas en ML... ";
        $method = self::getPrivateMethod(MlModule::class, 'buildRecommendations');

        $report = [
            'classification' => 'critical',
            'inputs' => [
                'activeOffers' => 5,
                'openDemandUnits' => 500,
                'availableInventoryUnits' => 100, // coverage is low
                'reservedInventoryUnits' => 200,
                'scheduledRescues' => 0,
                'scheduledLogistics' => 0, // no logistics scheduled
                'openIncidents' => 2,
                'pendingNotifications' => 1,
            ],
            'scores' => [
                'supplyCoverageScore' => 20, // lower than 50
                'logisticsStabilityScore' => 10,
                'incidentPressureScore' => 60,
                'readinessScore' => 30,
            ],
        ];

        $recs = $method->invoke(null, $report);

        $actionCodes = array_column($recs, 'actionCode');
        if (!in_array('activate_supply', $actionCodes, true) || !in_array('schedule_logistics', $actionCodes, true)) {
            throw new \Exception("ML Recommendations falló. Debió sugerir 'activate_supply' y 'schedule_logistics'.");
        }

        echo "✅ OK [Total Recomendaciones: " . count($recs) . " | Primer Alerta: " . $recs[0]['title'] . "]\n";
    }

    private static function testRedisClientGracefulDegradation(): void
    {
        echo "⏳ Probando Degradación Segura en RedisClient... ";

        // Target a non-existent port to force connection failure
        $redis = new RedisClient('redis://localhost:9999');

        // RedisClient should capture connection errors and return null / false gracefully, preventing HTTP crashes!
        $val = $redis->get('test_key');
        if ($val !== null) {
            throw new \Exception("Degradación de Redis falló; debió retornar null.");
        }

        $success = $redis->set('test_key', 'hello', 10);
        if ($success !== false) {
            throw new \Exception("Degradación de Redis falló; debió retornar false.");
        }

        echo "✅ OK [Degradado y Seguro]\n";
    }
}

AuctionAndMlTest::run();
