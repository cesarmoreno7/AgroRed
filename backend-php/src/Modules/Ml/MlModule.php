<?php
declare(strict_types=1);

namespace Agrored\Modules\Ml;

use Agrored\Database\Database;
use Agrored\Http\Request;
use Agrored\Http\Response;
use Agrored\Http\Router;
use DateTimeImmutable;
use RuntimeException;
use Throwable;

final class MlModule
{
    private const MODEL_VERSION = 'heuristic-v1';

    public static function register(Router $router, Database $database): void
    {
        // ── DECISION SUPPORT ──
        $router->get('/api/v1/ml/decision-support', static function (Request $request) use ($database): void {
            $tenantKey = $request->query('tenantId');

            try {
                $report = self::getDecisionSupport($database, $tenantKey !== null && $tenantKey !== '' ? (string) $tenantKey : null);
                Response::success($report);
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }
        });

        // ── RECOMMENDATIONS ──
        $router->get('/api/v1/ml/recommendations', static function (Request $request) use ($database): void {
            $tenantKey = $request->query('tenantId');

            try {
                $support = self::getDecisionSupport($database, $tenantKey !== null && $tenantKey !== '' ? (string) $tenantKey : null);

                $report = [
                    'tenantId' => $support['tenantId'],
                    'tenantCode' => $support['tenantCode'],
                    'tenantName' => $support['tenantName'],
                    'modelVersion' => $support['modelVersion'],
                    'classification' => $support['classification'],
                    'recommendations' => self::buildRecommendations($support),
                    'generatedAt' => (new DateTimeImmutable())->format(DATE_ATOM),
                ];

                Response::success($report);
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }
        });
    }

    private static function getDecisionSupport(Database $database, ?string $tenantKey): array
    {
        $tenantId = null;
        $tenantCode = null;
        $tenantName = null;

        if ($tenantKey !== null) {
            $tenant = $database->one(
                'SELECT id, code, name FROM public.tenants
                 WHERE id::text = :tenant_key OR UPPER(code) = UPPER(:tenant_key)
                 LIMIT 1',
                ['tenant_key' => $tenantKey]
            );

            if ($tenant === null) {
                throw new RuntimeException('TENANT_NOT_FOUND');
            }

            $tenantId = (string) $tenant['id'];
            $tenantCode = (string) $tenant['code'];
            $tenantName = (string) $tenant['name'];
        }

        $row = $database->one(
            "SELECT
              (SELECT COUNT(*) FROM public.offers WHERE deleted_at IS NULL AND status = 'published' AND (:tenant_id::uuid IS NULL OR tenant_id = :tenant_id)) AS active_offers,
              (SELECT COALESCE(SUM(quantity_required), 0) FROM public.demands WHERE deleted_at IS NULL AND status = 'open' AND (:tenant_id::uuid IS NULL OR tenant_id = :tenant_id)) AS open_demand_units,
              (SELECT COALESCE(SUM(GREATEST(quantity_on_hand - quantity_reserved, 0)), 0) FROM public.inventory_items WHERE deleted_at IS NULL AND (:tenant_id::uuid IS NULL OR tenant_id = :tenant_id)) AS available_inventory_units,
              (SELECT COALESCE(SUM(quantity_reserved), 0) FROM public.inventory_items WHERE deleted_at IS NULL AND (:tenant_id::uuid IS NULL OR tenant_id = :tenant_id)) AS reserved_inventory_units,
              (SELECT COUNT(*) FROM public.rescues WHERE deleted_at IS NULL AND status = 'scheduled' AND (:tenant_id::uuid IS NULL OR tenant_id = :tenant_id)) AS scheduled_rescues,
              (SELECT COUNT(*) FROM public.logistics_orders WHERE deleted_at IS NULL AND status = 'scheduled' AND (:tenant_id::uuid IS NULL OR tenant_id = :tenant_id)) AS scheduled_logistics,
              (SELECT COUNT(*) FROM public.incidents WHERE deleted_at IS NULL AND status = 'open' AND (:tenant_id::uuid IS NULL OR tenant_id = :tenant_id)) AS open_incidents,
              (SELECT COUNT(*) FROM public.notifications WHERE deleted_at IS NULL AND status = 'pending' AND (:tenant_id::uuid IS NULL OR tenant_id = :tenant_id)) AS pending_notifications",
            ['tenant_id' => $tenantId]
        );

        $inputs = [
            'activeOffers' => (int) ($row['active_offers'] ?? 0),
            'openDemandUnits' => (float) ($row['open_demand_units'] ?? 0.0),
            'availableInventoryUnits' => (float) ($row['available_inventory_units'] ?? 0.0),
            'reservedInventoryUnits' => (float) ($row['reserved_inventory_units'] ?? 0.0),
            'scheduledRescues' => (int) ($row['scheduled_rescues'] ?? 0),
            'scheduledLogistics' => (int) ($row['scheduled_logistics'] ?? 0),
            'openIncidents' => (int) ($row['open_incidents'] ?? 0),
            'pendingNotifications' => (int) ($row['pending_notifications'] ?? 0),
        ];

        $scores = self::computeScores($inputs);

        return [
            'tenantId' => $tenantId,
            'tenantCode' => $tenantCode,
            'tenantName' => $tenantName,
            'modelVersion' => self::MODEL_VERSION,
            'classification' => self::resolveClassification($scores['readinessScore']),
            'inputs' => $inputs,
            'scores' => $scores,
            'generatedAt' => (new DateTimeImmutable())->format(DATE_ATOM),
        ];
    }

    private static function computeScores(array $inputs): array
    {
        $openDemands = (float) $inputs['openDemandUnits'];
        $availInventory = (float) $inputs['availableInventoryUnits'];
        $resInventory = (float) $inputs['reservedInventoryUnits'];
        $openIncidents = (int) $inputs['openIncidents'];
        $pendNotifications = (int) $inputs['pendingNotifications'];
        $schedLogistics = (int) $inputs['scheduledLogistics'];
        $schedRescues = (int) $inputs['scheduledRescues'];

        $supplyCoverageRatio = $openDemands > 0 ? $availInventory / $openDemands : 1.0;
        $supplyCoverageScore = self::clamp((int) round((min($supplyCoverageRatio, 1.5) / 1.5) * 100.0));

        $incidentPressureScore = self::clamp($openIncidents * 25 + $pendNotifications * 10);

        $logisticsStabilityScore = self::clamp(
            35
            + $schedLogistics * 25
            + $schedRescues * 10
            + ($resInventory > 0 ? 5 : 0)
            - $openIncidents * 15
            - $pendNotifications * 5
        );

        $readinessScore = self::clamp(
            (int) round($supplyCoverageScore * 0.45 + $logisticsStabilityScore * 0.35 + (100 - $incidentPressureScore) * 0.2)
        );

        return [
            'supplyCoverageScore' => $supplyCoverageScore,
            'logisticsStabilityScore' => $logisticsStabilityScore,
            'incidentPressureScore' => $incidentPressureScore,
            'readinessScore' => $readinessScore,
        ];
    }

    private static function resolveClassification(int $readinessScore): string
    {
        if ($readinessScore >= 70) {
            return 'stable';
        }
        if ($readinessScore >= 45) {
            return 'watch';
        }
        return 'critical';
    }

    private static function buildRecommendations(array $report): array
    {
        $recommendations = [];
        $inputs = $report['inputs'];
        $scores = $report['scores'];

        if ($scores['supplyCoverageScore'] < 50) {
            $recommendations[] = [
                'priority' => 'high',
                'actionCode' => 'activate_supply',
                'title' => 'Activar oferta complementaria',
                'rationale' => 'La cobertura actual de inventario no alcanza la demanda abierta del territorio.',
            ];
        }

        if ($inputs['scheduledLogistics'] === 0 && $inputs['openDemandUnits'] > 0) {
            $recommendations[] = [
                'priority' => 'high',
                'actionCode' => 'schedule_logistics',
                'title' => 'Programar operacion logistica',
                'rationale' => 'Hay demanda abierta sin operaciones logisticas programadas para atenderla.',
            ];
        }

        if ($inputs['openIncidents'] > 0) {
            $recommendations[] = [
                'priority' => $report['classification'] === 'critical' ? 'high' : 'medium',
                'actionCode' => 'stabilize_operations',
                'title' => 'Estabilizar operacion territorial',
                'rationale' => 'Existen incidencias abiertas que afectan la continuidad del abastecimiento y la entrega.',
            ];
        }

        if ($inputs['pendingNotifications'] > 0) {
            $recommendations[] = [
                'priority' => 'medium',
                'actionCode' => 'dispatch_notifications',
                'title' => 'Despachar notificaciones pendientes',
                'rationale' => 'Hay alertas pendientes de entrega a actores clave del flujo operativo.',
            ];
        }

        if ($inputs['reservedInventoryUnits'] > $inputs['availableInventoryUnits']) {
            $recommendations[] = [
                'priority' => 'medium',
                'actionCode' => 'rebalance_inventory',
                'title' => 'Rebalancear inventario',
                'rationale' => 'El inventario reservado supera el disponible y puede tensionar el cumplimiento de la demanda.',
            ];
        }

        if (count($recommendations) === 0) {
            $recommendations[] = [
                'priority' => 'low',
                'actionCode' => 'maintain_monitoring',
                'title' => 'Mantener monitoreo operativo',
                'rationale' => 'Los indicadores actuales no muestran tension critica; conviene sostener seguimiento preventivo.',
            ];
        }

        return $recommendations;
    }

    private static function clamp(int $value): int
    {
        return max(0, min(100, $value));
    }
}
