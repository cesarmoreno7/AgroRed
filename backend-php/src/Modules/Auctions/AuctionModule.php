<?php
declare(strict_types=1);

namespace Agrored\Modules\Auctions;

use Agrored\Database\Database;
use Agrored\Http\Request;
use Agrored\Http\Response;
use Agrored\Http\Router;
use Agrored\Support\Uuid;
use DateTimeImmutable;
use RuntimeException;
use Throwable;

final class AuctionModule
{
    private const AUCTION_TYPES = ['ascending', 'dutch'];
    private const VISIBILITY_RADIUS_KM = [
        'phase_1' => 50,
        'phase_2' => 150,
        'phase_3' => 9999,
        'urgent'  => 9999,
    ];

    private const PRODUCT_SHELF_LIFE = [
        'tomate'     => 48,
        'platano'    => 72,
        'papa'       => 120,
        'yuca'       => 96,
        'cebolla'    => 168,
        'zanahoria'  => 144,
        'lechuga'    => 24,
        'fresa'      => 36,
        'mango'      => 60,
        'aguacate'   => 72,
        'limon'      => 168,
        'naranja'    => 168,
        'maiz'       => 96,
        'arveja'     => 48,
        'habichuela' => 48,
        'cilantro'   => 24,
        'default'    => 48,
    ];

    public static function register(Router $router, Database $database): void
    {
        // ── PUBLISH AUCTION ──
        $router->post('/api/v1/auctions/publish', static function (Request $request) use ($database): void {
            $payload = $request->body();

            $tenantKey = self::requiredString($payload, 'tenantId', 1, 'INVALID_AUCTION_PAYLOAD', 'Payload invalido para publicacion de subasta.');
            $producerId = self::requiredUuid($payload, 'producerId', 'INVALID_AUCTION_PAYLOAD', 'Payload invalido para publicacion de subasta.');
            $productName = self::requiredString($payload, 'productName', 2, 'INVALID_AUCTION_PAYLOAD', 'Payload invalido para publicacion de subasta.');
            $category = self::requiredString($payload, 'category', 2, 'INVALID_AUCTION_PAYLOAD', 'Payload invalido para publicacion de subasta.');
            $unit = self::requiredString($payload, 'unit', 1, 'INVALID_AUCTION_PAYLOAD', 'Payload invalido para publicacion de subasta.');
            $quantityKg = self::requiredPositiveFloat($payload, 'quantityKg', 'INVALID_AUCTION_PAYLOAD', 'Payload invalido para publicacion de subasta.');
            $photoUrl = self::optionalString($payload, 'photoUrl', 500, 'INVALID_AUCTION_PAYLOAD', 'Payload invalido para publicacion de subasta.');
            $harvestDate = self::requiredDate($payload, 'harvestDate', 'INVALID_AUCTION_PAYLOAD', 'Payload invalido para publicacion de subasta.');
            $auctionType = self::requiredString($payload, 'auctionType', 1, 'INVALID_AUCTION_PAYLOAD', 'Payload invalido para publicacion de subasta.');
            $basePrice = self::requiredPositiveFloat($payload, 'basePrice', 'INVALID_AUCTION_PAYLOAD', 'Payload invalido para publicacion de subasta.');
            $reservePrice = self::requiredNonNegativeFloat($payload, 'reservePrice', 'INVALID_AUCTION_PAYLOAD', 'Payload invalido para publicacion de subasta.');
            $currency = strtoupper(self::optionalString($payload, 'currency', 3, 'INVALID_AUCTION_PAYLOAD', 'Payload invalido para publicacion de subasta.') ?? 'COP');
            $durationMinutes = (int) (self::optionalFloat($payload, 'durationMinutes') ?? 120.0);
            $latitude = self::requiredLatitude($payload, 'latitude', 'INVALID_AUCTION_PAYLOAD', 'Payload invalido para publicacion de subasta.');
            $longitude = self::requiredLongitude($payload, 'longitude', 'INVALID_AUCTION_PAYLOAD', 'Payload invalido para publicacion de subasta.');
            $municipalityName = self::requiredString($payload, 'municipalityName', 3, 'INVALID_AUCTION_PAYLOAD', 'Payload invalido para publicacion de subasta.');
            $dutchStepPercent = self::optionalFloat($payload, 'dutchStepPercent');
            $dutchStepMinutes = self::optionalFloat($payload, 'dutchStepMinutes');

            if (!in_array($auctionType, self::AUCTION_TYPES, true)) {
                Response::error(400, 'INVALID_AUCTION_PAYLOAD', 'Tipo de subasta invalido.');
            }

            if ($durationMinutes < 120 || $durationMinutes > 1440) {
                Response::error(400, 'INVALID_DURATION', 'Duracion debe estar entre 2 y 24 horas.');
            }

            if ($reservePrice > $basePrice) {
                Response::error(400, 'INVALID_RESERVE_PRICE', 'Precio de reserva invalido.');
            }

            try {
                $tenantId = self::resolveTenantId($database, $tenantKey);

                $shelfLifeHours = self::getShelfLifeHours($productName);
                $startsAt = new DateTimeImmutable();
                $endsAt = $startsAt->modify("+{$durationMinutes} minutes");

                $isUrgent = $auctionType === 'dutch';
                $initialPhase = $isUrgent ? 'urgent' : 'phase_1';
                $initialRadius = self::VISIBILITY_RADIUS_KM[$initialPhase];

                $auctionId = Uuid::v4();

                $database->execute(
                    'INSERT INTO public.auctions (
                        id, tenant_id, producer_id, product_name, category, unit, quantity_kg,
                        photo_url, harvest_date, shelf_life_hours, auction_type, base_price,
                        reserve_price, currency, duration_minutes, starts_at, ends_at,
                        current_price, visibility_phase, visibility_radius_km,
                        latitude, longitude, municipality_name,
                        extension_count, max_extensions, dutch_step_percent, dutch_step_minutes,
                        winner_id, winner_price, status, created_at
                    ) VALUES (
                        :id, :tenant_id, :producer_id, :product_name, :category, :unit, :quantity_kg,
                        :photo_url, :harvest_date, :shelf_life_hours, :auction_type, :base_price,
                        :reserve_price, :currency, :duration_minutes, :starts_at, :ends_at,
                        :current_price, :visibility_phase, :visibility_radius_km,
                        :latitude, :longitude, :municipality_name,
                        0, 5, :dutch_step_percent, :dutch_step_minutes,
                        NULL, NULL, \'active\', NOW()
                    )',
                    [
                        'id' => $auctionId,
                        'tenant_id' => $tenantId,
                        'producer_id' => $producerId,
                        'product_name' => $productName,
                        'category' => $category,
                        'unit' => $unit,
                        'quantity_kg' => $quantityKg,
                        'photo_url' => $photoUrl,
                        'harvest_date' => $harvestDate->format(DATE_ATOM),
                        'shelf_life_hours' => $shelfLifeHours,
                        'auction_type' => $auctionType,
                        'base_price' => $basePrice,
                        'reserve_price' => $reservePrice,
                        'currency' => $currency,
                        'duration_minutes' => $durationMinutes,
                        'starts_at' => $startsAt->format(DATE_ATOM),
                        'ends_at' => $endsAt->format(DATE_ATOM),
                        'current_price' => $basePrice,
                        'visibility_phase' => $initialPhase,
                        'visibility_radius_km' => $initialRadius,
                        'latitude' => $latitude,
                        'longitude' => $longitude,
                        'municipality_name' => $municipalityName,
                        'dutch_step_percent' => $dutchStepPercent,
                        'dutch_step_minutes' => $dutchStepMinutes !== null ? (int) $dutchStepMinutes : null,
                    ]
                );

                $row = $database->one('SELECT * FROM public.auctions WHERE id = :id LIMIT 1', ['id' => $auctionId]);
                Response::success(self::toAuctionResponse($row), 201);

            } catch (Throwable $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }
        });

        // ── LIST AUCTIONS ──
        $router->get('/api/v1/auctions', static function (Request $request) use ($database): void {
            $page = max(1, (int) ($request->query('page', 1) ?? 1));
            $limit = min(100, max(1, (int) ($request->query('limit', 20) ?? 20)));
            $tenantHeader = trim((string) ($request->header('x-tenant-id', '') ?? $request->query('tenantId', '')));

            $conditions = ['deleted_at IS NULL'];
            $params = [];

            if ($tenantHeader !== '') {
                try {
                    $tenantId = self::resolveTenantId($database, $tenantHeader);
                    $conditions[] = 'tenant_id = :tenant_id';
                    $params['tenant_id'] = $tenantId;
                } catch (\Exception) {
                    // Invalid tenant ID / code fallback
                }
            }

            $status = $request->query('status');
            if ($status !== null && $status !== '') {
                $conditions[] = 'status = :status';
                $params['status'] = trim((string) $status);
            }

            $auctionType = $request->query('auctionType');
            if ($auctionType !== null && $auctionType !== '') {
                $conditions[] = 'auction_type = :auction_type';
                $params['auction_type'] = trim((string) $auctionType);
            }

            $producerId = $request->query('producerId');
            if ($producerId !== null && $producerId !== '') {
                $conditions[] = 'producer_id = :producer_id';
                $params['producer_id'] = trim((string) $producerId);
            }

            $municipalityName = $request->query('municipalityName');
            if ($municipalityName !== null && $municipalityName !== '') {
                $conditions[] = 'UPPER(municipality_name) = UPPER(:municipality_name)';
                $params['municipality_name'] = trim((string) $municipalityName);
            }

            $where = implode(' AND ', $conditions);

            $total = (int) $database->scalar(
                'SELECT COUNT(*) FROM public.auctions WHERE ' . $where,
                $params
            );

            $rows = $database->all(
                'SELECT * FROM public.auctions
                 WHERE ' . $where . '
                 ORDER BY created_at DESC
                 LIMIT :limit OFFSET :offset',
                array_merge($params, [
                    'limit' => $limit,
                    'offset' => ($page - 1) * $limit,
                ])
            );

            $mapped = array_map(static function (array $row): array {
                $res = self::toAuctionResponse($row);
                
                // Dutch price decay
                if ($row['auction_type'] === 'dutch' && in_array($row['status'], ['active', 'extended'], true)) {
                    $dp = self::calculateDutchPrice($row);
                    $res['dutchCurrentPrice'] = $dp['currentPrice'];
                    $res['dutchStepNumber'] = $dp['stepNumber'];
                    $res['dutchReachedReserve'] = $dp['reachedReserve'];
                }

                // Visibility expansion
                $vis = self::calculateVisibility($row);
                $res['currentVisibilityPhase'] = $vis['phase'];
                $res['currentVisibilityRadiusKm'] = $vis['radiusKm'];

                return $res;
            }, $rows);

            Response::paginated($mapped, ['total' => $total, 'page' => $page, 'limit' => $limit]);
        });

        // ── AGRO-MATCH RANKING ──
        $router->get('/api/v1/auctions/ranking', static function (Request $request) use ($database): void {
            $buyerLatitude = filter_var($request->query('buyerLatitude'), FILTER_VALIDATE_FLOAT);
            $buyerLongitude = filter_var($request->query('buyerLongitude'), FILTER_VALIDATE_FLOAT);
            $buyerScore = (float) ($request->query('buyerScore', 50.0) ?? 50.0);
            $logisticsAvailability = (float) ($request->query('logisticsAvailability', 50.0) ?? 50.0);

            if ($buyerLatitude === false || $buyerLongitude === false) {
                Response::error(400, 'INVALID_RANKING_QUERY', 'Parametros de ranking invalidos.');
            }

            $activeAuctions = $database->all(
                "SELECT * FROM public.auctions WHERE status = 'active' AND deleted_at IS NULL LIMIT 100"
            );

            $ranked = [];
            foreach ($activeAuctions as $row) {
                $res = self::toAuctionResponse($row);
                
                // Dutch price decay
                if ($row['auction_type'] === 'dutch') {
                    $dp = self::calculateDutchPrice($row);
                    $res['dutchCurrentPrice'] = $dp['currentPrice'];
                    $res['dutchStepNumber'] = $dp['stepNumber'];
                    $res['dutchReachedReserve'] = $dp['reachedReserve'];
                }

                // Visibility phase
                $vis = self::calculateVisibility($row);
                $res['currentVisibilityPhase'] = $vis['phase'];
                $res['currentVisibilityRadiusKm'] = $vis['radiusKm'];

                // AgroMatch AEA Score
                $aea = self::calculateAEA(
                    $row,
                    (float) $buyerLatitude,
                    (float) $buyerLongitude,
                    $buyerScore,
                    $logisticsAvailability
                );
                $res['aeaScore'] = $aea;
                
                $ranked[] = $res;
            }

            usort($ranked, static function ($a, $b) {
                return $b['aeaScore']['score'] <=> $a['aeaScore']['score'];
            });

            Response::success($ranked);
        });

        // ── DETAIL AUCTION WITH DYNAMIC PRICING ──
        $router->get('/api/v1/auctions/{id}', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');

            $row = $database->one('SELECT * FROM public.auctions WHERE id = :id AND deleted_at IS NULL LIMIT 1', ['id' => $id]);
            if ($row === null) {
                Response::error(404, 'AUCTION_NOT_FOUND', 'Subasta no encontrada.');
            }

            $tenantHeader = trim((string) ($request->header('x-tenant-id', '') ?? ''));
            if ($tenantHeader !== '') {
                try {
                    $tenantId = self::resolveTenantId($database, $tenantHeader);
                    if ($row['tenant_id'] !== $tenantId) {
                        Response::error(404, 'AUCTION_NOT_FOUND', 'Subasta no encontrada.');
                    }
                } catch (\Exception) {
                    // Invalid tenant ID / code fallback
                }
            }

            $response = self::toAuctionResponse($row);

            if ($row['auction_type'] === 'dutch' && in_array($row['status'], ['active', 'extended'], true)) {
                $dp = self::calculateDutchPrice($row);
                $response['dutchCurrentPrice'] = $dp['currentPrice'];
                $response['dutchStepNumber'] = $dp['stepNumber'];
                $response['dutchReachedReserve'] = $dp['reachedReserve'];
            }

            $vis = self::calculateVisibility($row);
            $response['currentVisibilityPhase'] = $vis['phase'];
            $response['currentVisibilityRadiusKm'] = $vis['radiusKm'];

            Response::success($response);
        });

        // ── PLACE BID (ASCENDING ENGLISH AUCTION) ──
        $router->post('/api/v1/auctions/{id}/bid', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');
            $payload = $request->body();

            $bidderId = self::requiredUuid($payload, 'bidderId', 'INVALID_BID_PAYLOAD', 'Payload invalido para la puja.');
            $bidderType = self::requiredString($payload, 'bidderType', 2, 'INVALID_BID_PAYLOAD', 'Payload invalido para la puja.');
            $amount = self::requiredPositiveFloat($payload, 'amount', 'INVALID_BID_PAYLOAD', 'Payload invalido para la puja.');
            $maxProxyAmount = self::optionalFloat($payload, 'maxProxyAmount');
            $socialScoreParam = self::optionalFloat($payload, 'socialScore');
            $latitude = self::optionalFloat($payload, 'latitude');
            $longitude = self::optionalFloat($payload, 'longitude');

            $database->pdo()->beginTransaction();

            try {
                $auction = $database->one(
                    'SELECT * FROM public.auctions WHERE id = :id AND deleted_at IS NULL LIMIT 1 FOR UPDATE',
                    ['id' => $id]
                );

                if ($auction === null) {
                    Response::error(404, 'AUCTION_NOT_FOUND', 'Subasta no encontrada.');
                }

                if ($auction['status'] !== 'active' && $auction['status'] !== 'extended') {
                    Response::error(409, 'AUCTION_NOT_ACTIVE', 'La subasta no esta activa.');
                }

                $endsAt = new DateTimeImmutable($auction['ends_at']);
                if (new DateTimeImmutable() > $endsAt) {
                    Response::error(410, 'AUCTION_EXPIRED', 'La subasta ha expirado.');
                }

                if ($bidderId === $auction['producer_id']) {
                    Response::error(403, 'PRODUCER_CANNOT_BID', 'El productor no puede pujar en su propia subasta.');
                }

                $highestBid = $database->one(
                    "SELECT * FROM public.auction_bids
                     WHERE auction_id = :auction_id AND status = 'active'
                     ORDER BY amount DESC LIMIT 1 FOR UPDATE",
                    ['auction_id' => $id]
                );

                $minAllowed = $highestBid !== null ? (float) $highestBid['amount'] : (float) $auction['base_price'] - 1;
                if ($amount <= $minAllowed) {
                    Response::error(400, 'BID_TOO_LOW', 'La puja debe ser mayor que la puja actual mas alta.');
                }

                $socialScore = $socialScoreParam !== null ? (int) $socialScoreParam : self::calculateSocialScore($bidderType);
                $bidId = Uuid::v4();

                // 1. Mark previous highest bid as outbid
                if ($highestBid !== null) {
                    $database->execute(
                        "UPDATE public.auction_bids SET status = 'outbid' WHERE id = :id",
                        ['id' => $highestBid['id']]
                    );
                }

                // 2. Save new bid
                $database->execute(
                    'INSERT INTO public.auction_bids (
                        id, auction_id, bidder_id, bidder_type, amount, max_proxy_amount,
                        is_proxy, social_score, distance_km, latitude, longitude, status, created_at
                    ) VALUES (
                        :id, :auction_id, :bidder_id, :bidder_type, :amount, :max_proxy_amount,
                        FALSE, :social_score, NULL, :latitude, :longitude, \'active\', NOW()
                    )',
                    [
                        'id' => $bidId,
                        'auction_id' => $id,
                        'bidder_id' => $bidderId,
                        'bidder_type' => $bidderType,
                        'amount' => $amount,
                        'max_proxy_amount' => $maxProxyAmount,
                        'social_score' => $socialScore,
                        'latitude' => $latitude,
                        'longitude' => $longitude,
                    ]
                );

                // 3. Update current price in auction
                $database->execute(
                    'UPDATE public.auctions SET current_price = :price WHERE id = :id',
                    ['price' => $amount, 'id' => $id]
                );

                // 4. Evaluate Anti-Sniping (Soft Close)
                $antiSniping = self::evaluateAntiSniping($auction);
                if ($antiSniping['extended']) {
                    $database->execute(
                        'UPDATE public.auctions SET ends_at = :ends_at, extension_count = :ext_count, status = \'extended\' WHERE id = :id',
                        [
                            'ends_at' => $antiSniping['newEndsAt']->format(DATE_ATOM),
                            'ext_count' => $antiSniping['extensionCount'],
                            'id' => $id,
                        ]
                    );
                }

                // 5. Evaluate automatic Proxy Bids
                $proxyBidsTriggered = 0;
                $proxyBids = $database->all(
                    "SELECT * FROM public.auction_bids
                     WHERE auction_id = :auction_id AND max_proxy_amount IS NOT NULL AND status IN ('active', 'outbid')
                     ORDER BY max_proxy_amount DESC",
                    ['auction_id' => $id]
                );

                if (count($proxyBids) > 0) {
                    $proxyResults = self::processProxyBids($proxyBids, $amount, $bidderId);
                    foreach ($proxyResults as $pr) {
                        if ($pr['shouldBid']) {
                            $proxyBidId = Uuid::v4();
                            $originalProxy = array_values(array_filter($proxyBids, static fn ($p) => $p['bidder_id'] === $pr['bidderId']))[0];

                            // Mark current manual bid as outbid
                            $database->execute(
                                "UPDATE public.auction_bids SET status = 'outbid' WHERE id = :id",
                                ['id' => $bidId]
                            );

                            // Insert proxy bid
                            $database->execute(
                                'INSERT INTO public.auction_bids (
                                    id, auction_id, bidder_id, bidder_type, amount, max_proxy_amount,
                                    is_proxy, social_score, distance_km, latitude, longitude, status, created_at
                                ) VALUES (
                                    :id, :auction_id, :bidder_id, \'proxy\', :amount, NULL,
                                    TRUE, :social_score, NULL, NULL, NULL, \'active\', NOW()
                                )',
                                [
                                    'id' => $proxyBidId,
                                    'auction_id' => $id,
                                    'bidder_id' => $pr['bidderId'],
                                    'amount' => $pr['newAmount'],
                                    'social_score' => (int) $originalProxy['social_score'],
                                ]
                            );

                            // Update price in auction
                            $database->execute(
                                'UPDATE public.auctions SET current_price = :price WHERE id = :id',
                                ['price' => $pr['newAmount'], 'id' => $id]
                            );

                            $bidId = $proxyBidId; // the new highest active is the proxy bid
                            $amount = $pr['newAmount'];
                            $proxyBidsTriggered++;
                        }
                    }
                }

                $database->pdo()->commit();

                $newBid = $database->one('SELECT * FROM public.auction_bids WHERE id = :id LIMIT 1', ['id' => $bidId]);
                Response::success([
                    'bid' => self::toBidResponse($newBid),
                    'antiSnipingTriggered' => $antiSniping['extended'],
                    'newEndsAt' => $antiSniping['extended'] ? $antiSniping['newEndsAt']->format(DATE_ATOM) : null,
                    'proxyBidsTriggered' => $proxyBidsTriggered,
                ], 201);

            } catch (Throwable $e) {
                if ($database->pdo()->inTransaction()) {
                    $database->pdo()->rollBack();
                }
                throw $e;
            }
        });

        // ── ACCEPT DUTCH PRICE ──
        $router->post('/api/v1/auctions/{id}/accept-dutch', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');
            $payload = $request->body();

            $bidderId = self::requiredUuid($payload, 'bidderId', 'INVALID_ACCEPT_PAYLOAD', 'Payload invalido para aceptar precio holandesa.');
            $bidderType = self::requiredString($payload, 'bidderType', 2, 'INVALID_ACCEPT_PAYLOAD', 'Payload invalido para aceptar precio holandesa.');
            $acceptedPrice = self::requiredPositiveFloat($payload, 'acceptedPrice', 'INVALID_ACCEPT_PAYLOAD', 'Payload invalido para aceptar precio holandesa.');
            $latitude = self::optionalFloat($payload, 'latitude');
            $longitude = self::optionalFloat($payload, 'longitude');

            $database->pdo()->beginTransaction();

            try {
                $auction = $database->one(
                    'SELECT * FROM public.auctions WHERE id = :id AND deleted_at IS NULL LIMIT 1 FOR UPDATE',
                    ['id' => $id]
                );

                if ($auction === null) {
                    Response::error(404, 'AUCTION_NOT_FOUND', 'Subasta no encontrada.');
                }

                if ($auction['auction_type'] !== 'dutch') {
                    Response::error(400, 'NOT_DUTCH_AUCTION', 'Esta subasta no es de tipo holandesa.');
                }

                if ($auction['status'] !== 'active') {
                    Response::error(409, 'AUCTION_NOT_ACTIVE', 'La subasta no esta activa.');
                }

                $endsAt = new DateTimeImmutable($auction['ends_at']);
                if (new DateTimeImmutable() > $endsAt) {
                    Response::error(410, 'AUCTION_EXPIRED', 'La subasta ha expirado.');
                }

                if ($bidderId === $auction['producer_id']) {
                    Response::error(403, 'PRODUCER_CANNOT_BID', 'El productor no puede aceptar su propia subasta.');
                }

                if ($acceptedPrice < (float) $auction['reserve_price']) {
                    Response::error(400, 'PRICE_BELOW_RESERVE', 'El precio esta por debajo del minimo de reserva.');
                }

                // Register winning bid
                $bidId = Uuid::v4();
                $database->execute(
                    'INSERT INTO public.auction_bids (
                        id, auction_id, bidder_id, bidder_type, amount, max_proxy_amount,
                        is_proxy, social_score, distance_km, latitude, longitude, status, created_at
                    ) VALUES (
                        :id, :auction_id, :bidder_id, :bidder_type, :amount, NULL,
                        FALSE, :social_score, NULL, :latitude, :longitude, \'winner\', NOW()
                    )',
                    [
                        'id' => $bidId,
                        'auction_id' => $id,
                        'bidder_id' => $bidderId,
                        'bidder_type' => $bidderType,
                        'amount' => $acceptedPrice,
                        'social_score' => self::calculateSocialScore($bidderType),
                        'latitude' => $latitude,
                        'longitude' => $longitude,
                    ]
                );

                // Set Winner & Close
                $database->execute(
                    "UPDATE public.auctions
                     SET winner_id = :winner_id, winner_price = :winner_price, status = 'closed_with_winner'
                     WHERE id = :id",
                    [
                        'winner_id' => $bidderId,
                        'winner_price' => $acceptedPrice,
                        'id' => $id,
                    ]
                );

                $database->pdo()->commit();

                Response::success(['message' => 'Precio aceptado. Subasta cerrada con ganador.']);

            } catch (Throwable $e) {
                if ($database->pdo()->inTransaction()) {
                    $database->pdo()->rollBack();
                }
                throw $e;
            }
        });

        // ── LIST BIDS FOR AN AUCTION ──
        $router->get('/api/v1/auctions/{id}/bids', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');

            $bids = $database->all(
                'SELECT * FROM public.auction_bids WHERE auction_id = :id ORDER BY amount DESC, created_at ASC',
                ['id' => $id]
            );

            Response::success(array_map([self::class, 'toBidResponse'], $bids));
        });

        // ── CLOSE AUCTION (TRIGGERED BY TIMEOUT / SCHEDULER) ──
        $router->post('/api/v1/auctions/{id}/close', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');

            $database->pdo()->beginTransaction();

            try {
                $auction = $database->one(
                    'SELECT * FROM public.auctions WHERE id = :id AND deleted_at IS NULL LIMIT 1 FOR UPDATE',
                    ['id' => $id]
                );

                if ($auction === null) {
                    Response::error(404, 'AUCTION_NOT_FOUND', 'Subasta no encontrada.');
                }

                if (in_array($auction['status'], ['closed_with_winner', 'closed_no_winner'], true)) {
                    Response::error(409, 'AUCTION_ALREADY_CLOSED', 'La subasta ya esta cerrada.');
                }

                $bids = $database->all(
                    "SELECT * FROM public.auction_bids
                     WHERE auction_id = :auction_id AND status IN ('active', 'outbid')
                     ORDER BY amount DESC",
                    ['auction_id' => $id]
                );

                if (count($bids) === 0) {
                    $database->execute(
                        "UPDATE public.auctions SET status = 'closed_no_winner' WHERE id = :id",
                        ['id' => $id]
                    );

                    $database->pdo()->commit();

                    Response::success([
                        'auctionId' => $id,
                        'winnerId' => null,
                        'winnerPrice' => null,
                        'totalBids' => 0,
                        'status' => 'closed_no_winner',
                    ]);
                    return;
                }

                // Determine winner
                $highestAmount = 0.0;
                foreach ($bids as $b) {
                    if ((float) $b['amount'] > $highestAmount) {
                        $highestAmount = (float) $b['amount'];
                    }
                }

                $topBids = array_values(array_filter($bids, static fn ($b) => (float) $b['amount'] === $highestAmount));

                $winnerId = null;
                $winnerPrice = null;

                if (count($topBids) === 1) {
                    $winnerId = $topBids[0]['bidder_id'];
                    $winnerPrice = $highestAmount;
                    $winningBidId = $topBids[0]['id'];
                } else {
                    $matchResult = self::determineWinner(
                        $topBids,
                        (float) $auction['latitude'],
                        (float) $auction['longitude']
                    );
                    if ($matchResult !== null) {
                        $winnerId = $matchResult['bidderId'];
                        $winnerPrice = $highestAmount;
                        $winningBidId = $matchResult['bidId'];
                    }
                }

                if ($winnerId === null || $winnerPrice < (float) $auction['reserve_price']) {
                    $database->execute(
                        "UPDATE public.auctions SET status = 'closed_no_winner' WHERE id = :id",
                        ['id' => $id]
                    );

                    $database->pdo()->commit();

                    Response::success([
                        'auctionId' => $id,
                        'winnerId' => null,
                        'winnerPrice' => null,
                        'totalBids' => count($bids),
                        'status' => 'closed_no_winner',
                    ]);
                    return;
                }

                // Commit the winner
                $database->execute(
                    "UPDATE public.auctions SET winner_id = :winner_id, winner_price = :winner_price, status = 'closed_with_winner' WHERE id = :id",
                    [
                        'winner_id' => $winnerId,
                        'winner_price' => $winnerPrice,
                        'id' => $id,
                    ]
                );

                $database->execute(
                    "UPDATE public.auction_bids SET status = 'winner' WHERE id = :id",
                    ['id' => $winningBidId]
                );

                $database->pdo()->commit();

                Response::success([
                    'auctionId' => $id,
                    'winnerId' => $winnerId,
                    'winnerPrice' => $winnerPrice,
                    'totalBids' => count($bids),
                    'status' => 'closed_with_winner',
                ]);

            } catch (Throwable $e) {
                if ($database->pdo()->inTransaction()) {
                    $database->pdo()->rollBack();
                }
                throw $e;
            }
        });

        // ── DELETE/ARCHIVE AUCTION ──
        $router->delete('/api/v1/auctions/{id}', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');

            $auction = $database->one('SELECT * FROM public.auctions WHERE id = :id AND deleted_at IS NULL LIMIT 1', ['id' => $id]);
            if ($auction === null) {
                Response::error(404, 'AUCTION_NOT_FOUND', 'Subasta no encontrada.');
            }

            if (in_array($auction['status'], ['active', 'extended'], true)) {
                Response::error(409, 'AUCTION_ACTIVE', 'No se puede archivar una subasta activa. Cierrela primero.');
            }

            $database->execute(
                'UPDATE public.auctions SET deleted_at = NOW() WHERE id = :id',
                ['id' => $id]
            );

            Response::success(['message' => 'Subasta archivada exitosamente.']);
        });
    }

    // ── DATABASE HELPERS ──

    private static function resolveTenantId(Database $database, string $tenantKey): string
    {
        $tenant = $database->one(
            "SELECT id
             FROM public.tenants
             WHERE id::text = :tenant_key OR UPPER(code) = UPPER(:tenant_key)
             LIMIT 1",
            ['tenant_key' => $tenantKey]
        );

        if ($tenant === null || !isset($tenant['id'])) {
            throw new RuntimeException('TENANT_NOT_FOUND');
        }

        return (string) $tenant['id'];
    }

    private static function getShelfLifeHours(string $productName): int
    {
        $key = strtolower(trim($productName));
        return self::PRODUCT_SHELF_LIFE[$key] ?? self::PRODUCT_SHELF_LIFE['default'];
    }

    private static function toAuctionResponse(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'tenantId' => (string) $row['tenant_id'],
            'producerId' => (string) $row['producer_id'],
            'productName' => (string) $row['product_name'],
            'category' => (string) $row['category'],
            'unit' => (string) $row['unit'],
            'quantityKg' => (float) $row['quantity_kg'],
            'photoUrl' => $row['photo_url'],
            'harvestDate' => self::toIso($row['harvest_date']),
            'shelfLifeHours' => (int) $row['shelf_life_hours'],
            'auctionType' => (string) $row['auction_type'],
            'basePrice' => (float) $row['base_price'],
            'reservePrice' => (float) $row['reserve_price'],
            'currency' => (string) $row['currency'],
            'durationMinutes' => (int) $row['duration_minutes'],
            'startsAt' => self::toIso($row['starts_at']),
            'endsAt' => self::toIso($row['ends_at']),
            'currentPrice' => (float) $row['current_price'],
            'visibilityPhase' => (string) $row['visibility_phase'],
            'visibilityRadiusKm' => (float) $row['visibility_radius_km'],
            'latitude' => (float) $row['latitude'],
            'longitude' => (float) $row['longitude'],
            'municipalityName' => (string) $row['municipality_name'],
            'extensionCount' => (int) $row['extension_count'],
            'maxExtensions' => (int) $row['max_extensions'],
            'dutchStepPercent' => $row['dutch_step_percent'] !== null ? (float) $row['dutch_step_percent'] : null,
            'dutchStepMinutes' => $row['dutch_step_minutes'] !== null ? (int) $row['dutch_step_minutes'] : null,
            'winnerId' => $row['winner_id'],
            'winnerPrice' => $row['winner_price'] !== null ? (float) $row['winner_price'] : null,
            'status' => (string) $row['status'],
            'createdAt' => self::toIso($row['created_at']),
        ];
    }

    private static function toBidResponse(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'auctionId' => (string) $row['auction_id'],
            'bidderId' => (string) $row['bidder_id'],
            'bidderType' => (string) $row['bidder_type'],
            'amount' => (float) $row['amount'],
            'maxProxyAmount' => $row['max_proxy_amount'] !== null ? (float) $row['max_proxy_amount'] : null,
            'isProxy' => self::toBool($row['is_proxy'] ?? false),
            'socialScore' => (int) $row['social_score'],
            'distanceKm' => $row['distance_km'] !== null ? (float) $row['distance_km'] : null,
            'latitude' => $row['latitude'] !== null ? (float) $row['latitude'] : null,
            'longitude' => $row['longitude'] !== null ? (float) $row['longitude'] : null,
            'status' => (string) $row['status'],
            'createdAt' => self::toIso($row['created_at']),
        ];
    }

    // ── MATHEMATICAL ALGORITHMS ──

    private static function calculateSocialScore(string $bidderType): int
    {
        $socialTypes = [
            'pae'                    => 100,
            'comedor_comunitario'    => 90,
            'fundacion'              => 80,
            'programa_alimentacion'  => 85,
            'municipio'              => 70,
            'operador_institucional' => 60,
            'operador'               => 30,
            'comercio'               => 10,
            'individual'             => 0,
        ];
        return $socialTypes[strtolower($bidderType)] ?? 0;
    }

    private static function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadiusKm = 6371.0;
        $latDelta = deg2rad($lat2 - $lat1);
        $lngDelta = deg2rad($lng2 - $lng1);

        $a = sin($latDelta / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($lngDelta / 2) ** 2;

        return 2 * $earthRadiusKm * asin(min(1.0, sqrt($a)));
    }

    private static function calculateAEA(
        array $auction,
        float $buyerLat,
        float $buyerLng,
        float $buyerScore,
        float $logisticsAvailability
    ): array {
        // 1. Freshness (30%)
        $startsAt = (new DateTimeImmutable((string) $auction['starts_at']))->getTimestamp();
        $harvestAt = (new DateTimeImmutable((string) $auction['harvest_date']))->getTimestamp();
        $hoursElapsed = max(0, ($startsAt - $harvestAt) / 3600.0);
        $shelfLife = (float) $auction['shelf_life_hours'];
        $freshnessRatio = $shelfLife > 0 ? min($hoursElapsed / $shelfLife, 1.0) : 1.0;
        $freshnessScore = $freshnessRatio * 100.0;

        // 2. Proximity (30%)
        $dist = self::haversineKm((float) $auction['latitude'], (float) $auction['longitude'], $buyerLat, $buyerLng);
        $proximityScore = max(0.0, 100.0 - ($dist / 3.0));

        // 3. Logistics (20%)
        $logisticsScore = max(0.0, min(100.0, $logisticsAvailability));

        // 4. History (20%)
        $historyScore = max(0.0, min(100.0, $buyerScore));

        $score = $freshnessScore * 0.30
            + $proximityScore * 0.30
            + $logisticsScore * 0.20
            + $historyScore * 0.20;

        return [
            'auctionId' => $auction['id'],
            'score' => round($score * 100) / 100,
            'freshnessScore' => round($freshnessScore * 100) / 100,
            'proximityScore' => round($proximityScore * 100) / 100,
            'logisticsScore' => round($logisticsScore * 100) / 100,
            'historyScore' => round($historyScore * 100) / 100,
        ];
    }

    private static function calculateDutchPrice(array $auction): array
    {
        $stepPercent = $auction['dutch_step_percent'] !== null ? (float) $auction['dutch_step_percent'] : 5.0;
        $stepMinutes = $auction['dutch_step_minutes'] !== null ? (float) $auction['dutch_step_minutes'] : 10.0;

        $startsAt = (new DateTimeImmutable((string) $auction['starts_at']))->getTimestamp();
        $minutesElapsed = max(0.0, (time() - $startsAt) / 60.0);
        $stepNumber = (int) floor($minutesElapsed / $stepMinutes);

        $reductionFactor = (1.0 - $stepPercent / 100.0) ** $stepNumber;
        $newPrice = round((float) $auction['base_price'] * $reductionFactor);

        $reachedReserve = $newPrice <= (float) $auction['reserve_price'];
        if ($reachedReserve) {
            $newPrice = (float) $auction['reserve_price'];
        }

        return [
            'currentPrice' => $newPrice,
            'stepNumber' => $stepNumber,
            'reachedReserve' => $reachedReserve,
            'priceChanged' => $newPrice !== (float) $auction['current_price'],
        ];
    }

    private static function calculateVisibility(array $auction): array
    {
        if ($auction['auction_type'] === 'dutch') {
            return [
                'phase' => 'urgent',
                'radiusKm' => self::VISIBILITY_RADIUS_KM['urgent'],
                'changed' => $auction['visibility_phase'] !== 'urgent',
            ];
        }

        $startsAt = (new DateTimeImmutable((string) $auction['starts_at']))->getTimestamp();
        $hoursActive = max(0.0, (time() - $startsAt) / 3600.0);

        $newPhase = 'phase_1';
        if ($hoursActive >= 12.0) {
            $newPhase = 'phase_3';
        } elseif ($hoursActive >= 4.0) {
            $newPhase = 'phase_2';
        }

        return [
            'phase' => $newPhase,
            'radiusKm' => self::VISIBILITY_RADIUS_KM[$newPhase],
            'changed' => $auction['visibility_phase'] !== $newPhase,
        ];
    }

    private static function evaluateAntiSniping(array $auction): array
    {
        $endsAtTimestamp = (new DateTimeImmutable((string) $auction['ends_at']))->getTimestamp();
        $timeRemainingMs = ($endsAtTimestamp - time()) * 1000;
        $currentExtensions = (int) $auction['extension_count'];

        // Trigger if bid is in the last 60 seconds (60000ms) and extension limit not reached
        if ($timeRemainingMs > 60000 || $currentExtensions >= 5) {
            return [
                'extended' => false,
                'newEndsAt' => new DateTimeImmutable((string) $auction['ends_at']),
                'extensionCount' => $currentExtensions,
            ];
        }

        $newEndsAt = (new DateTimeImmutable((string) $auction['ends_at']))->modify('+3 minutes');
        $newExtensionCount = $currentExtensions + 1;

        return [
            'extended' => true,
            'newEndsAt' => $newEndsAt,
            'extensionCount' => $newExtensionCount,
        ];
    }

    private static function processProxyBids(array $proxyBids, float $currentHighest, string $currentHighestBidderId): array
    {
        $results = [];
        // Filter proxy bids belonging to OTHER bidders with active budgets
        $eligible = array_values(array_filter($proxyBids, static fn ($b) => $b['bidder_id'] !== $currentHighestBidderId && $b['max_proxy_amount'] !== null));

        // Sort descending by maximum budget
        usort($eligible, static function ($a, $b) {
            return (float) $b['max_proxy_amount'] <=> (float) $a['max_proxy_amount'];
        });

        $runningHighest = $currentHighest;

        foreach ($eligible as $proxy) {
            // Min increment is 1% of current price or $1,000 COP (whichever is larger)
            $increment = max($runningHighest * 0.01, 1000.0);
            $needed = $runningHighest + $increment;

            if ($needed > (float) $proxy['max_proxy_amount']) {
                $results[] = [
                    'shouldBid' => false,
                    'newAmount' => (float) $proxy['amount'],
                    'proxyExhausted' => true,
                    'bidderId' => $proxy['bidder_id'],
                ];
            } else {
                $results[] = [
                    'shouldBid' => true,
                    'newAmount' => (float) round($needed),
                    'proxyExhausted' => false,
                    'bidderId' => $proxy['bidder_id'],
                ];
                $runningHighest = $needed;
            }
        }

        return $results;
    }

    private static function determineWinner(array $topBids, float $prodLat, float $prodLng): ?array
    {
        if (count($topBids) === 0) return null;

        $maxBidAmount = 0.0;
        foreach ($topBids as $tb) {
            if ((float) $tb['amount'] > $maxBidAmount) {
                $maxBidAmount = (float) $tb['amount'];
            }
        }

        $scores = [];
        foreach ($topBids as $bid) {
            $offerScore = $maxBidAmount > 0 ? ((float) $bid['amount'] / $maxBidAmount) * 100.0 : 0.0;

            $proximityScore = 0.0;
            if ($bid['latitude'] !== null && $bid['longitude'] !== null) {
                $dist = self::haversineKm($prodLat, $prodLng, (float) $bid['latitude'], (float) $bid['longitude']);
                $proximityScore = max(0.0, ((300.0 - $dist) / 300.0) * 100.0);
            }

            $socialScore = min(100, (int) $bid['social_score']);

            // Puntuación = (Oferta × 0.60) + (Cercanía × 0.30) + (PuntajeSocial × 0.10)
            $totalScore = $offerScore * 0.60 + $proximityScore * 0.30 + $socialScore * 0.10;

            $scores[] = [
                'bidId' => $bid['id'],
                'bidderId' => $bid['bidder_id'],
                'totalScore' => round($totalScore * 100) / 100,
            ];
        }

        usort($scores, static function ($a, $b) {
            return $b['totalScore'] <=> $a['totalScore'];
        });

        return $scores[0];
    }

    // ── PARAMETER VALIDATION HELPERS ──

    private static function requiredString(array $payload, string $key, int $minLength, string $code, string $message): string
    {
        $value = trim((string) ($payload[$key] ?? ''));
        if (mb_strlen($value) < $minLength) {
            Response::error(400, $code, $message);
        }
        return $value;
    }

    private static function optionalString(array $payload, string $key, int $maxLength, string $code, string $message): ?string
    {
        if (!array_key_exists($key, $payload) || $payload[$key] === null || $payload[$key] === '') {
            return null;
        }
        $value = trim((string) $payload[$key]);
        if (mb_strlen($value) > $maxLength) {
            Response::error(400, $code, $message);
        }
        return $value;
    }

    private static function requiredUuid(array $payload, string $key, string $code, string $message): string
    {
        $value = trim((string) ($payload[$key] ?? ''));
        if (!self::isUuid($value)) {
            Response::error(400, $code, $message);
        }
        return $value;
    }

    private static function isUuid(string $value): bool
    {
        return preg_match('/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/', $value) === 1;
    }

    private static function requiredPositiveFloat(array $payload, string $key, string $code, string $message): float
    {
        $value = filter_var($payload[$key] ?? null, FILTER_VALIDATE_FLOAT);
        if ($value === false || $value <= 0) {
            Response::error(400, $code, $message);
        }
        return (float) $value;
    }

    private static function requiredNonNegativeFloat(array $payload, string $key, string $code, string $message): float
    {
        $value = filter_var($payload[$key] ?? null, FILTER_VALIDATE_FLOAT);
        if ($value === false || $value < 0) {
            Response::error(400, $code, $message);
        }
        return (float) $value;
    }

    private static function requiredLatitude(array $payload, string $key, string $code, string $message): float
    {
        $value = filter_var($payload[$key] ?? null, FILTER_VALIDATE_FLOAT);
        if ($value === false || $value < -90 || $value > 90) {
            Response::error(400, $code, $message);
        }
        return (float) $value;
    }

    private static function requiredLongitude(array $payload, string $key, string $code, string $message): float
    {
        $value = filter_var($payload[$key] ?? null, FILTER_VALIDATE_FLOAT);
        if ($value === false || $value < -180 || $value > 180) {
            Response::error(400, $code, $message);
        }
        return (float) $value;
    }

    private static function optionalFloat(array $payload, string $key): ?float
    {
        if (!array_key_exists($key, $payload) || $payload[$key] === null || $payload[$key] === '') {
            return null;
        }
        $value = filter_var($payload[$key], FILTER_VALIDATE_FLOAT);
        return $value !== false ? (float) $value : null;
    }

    private static function requiredDate(array $payload, string $key, string $code, string $message): DateTimeImmutable
    {
        if (!array_key_exists($key, $payload) || $payload[$key] === null || $payload[$key] === '') {
            Response::error(400, $code, $message);
        }
        try {
            return new DateTimeImmutable((string) $payload[$key]);
        } catch (\Throwable) {
            Response::error(400, $code, $message);
        }
    }

    private static function toIso(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        return (new DateTimeImmutable((string) $value))->format(DATE_ATOM);
    }

    private static function toBool(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }
        if (is_int($value)) {
            return $value === 1;
        }
        return in_array(strtolower((string) $value), ['1', 't', 'true', 'y', 'yes'], true);
    }
}
