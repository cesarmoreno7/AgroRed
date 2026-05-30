<?php
declare(strict_types=1);

namespace Agrored\Modules\Offers;

use Agrored\Database\Database;
use Agrored\Http\Request;
use Agrored\Http\Response;
use Agrored\Http\Router;
use Agrored\Support\Uuid;
use RuntimeException;
use Throwable;

final class OfferModule
{
    public static function register(Router $router, Database $database): void
    {
        $router->post('/api/v1/offers/publish', static function (Request $request) use ($database): void {
            $payload = $request->body();

            $tenantKey = self::requiredString($payload, 'tenantId', 1, 'INVALID_OFFER_PAYLOAD', 'Payload invalido para publicacion de oferta.');
            $producerId = self::requiredUuid($payload, 'producerId', 'INVALID_OFFER_PAYLOAD', 'Payload invalido para publicacion de oferta.');
            $title = self::requiredString($payload, 'title', 3, 'INVALID_OFFER_PAYLOAD', 'Payload invalido para publicacion de oferta.');
            $productName = self::requiredString($payload, 'productName', 2, 'INVALID_OFFER_PAYLOAD', 'Payload invalido para publicacion de oferta.');
            $category = self::requiredString($payload, 'category', 2, 'INVALID_OFFER_PAYLOAD', 'Payload invalido para publicacion de oferta.');
            $unit = self::requiredString($payload, 'unit', 1, 'INVALID_OFFER_PAYLOAD', 'Payload invalido para publicacion de oferta.');
            $quantityAvailable = self::requiredPositiveFloat($payload, 'quantityAvailable', 'INVALID_OFFER_PAYLOAD', 'Payload invalido para publicacion de oferta.');
            $priceAmount = self::requiredNonNegativeFloat($payload, 'priceAmount', 'INVALID_OFFER_PAYLOAD', 'Payload invalido para publicacion de oferta.');
            $currency = strtoupper(self::requiredString($payload, 'currency', 3, 'INVALID_OFFER_PAYLOAD', 'Payload invalido para publicacion de oferta.'));
            if (mb_strlen($currency) !== 3) {
                Response::error(400, 'INVALID_OFFER_PAYLOAD', 'Payload invalido para publicacion de oferta.');
            }
            $availableFrom = self::requiredDate($payload, 'availableFrom', 'INVALID_OFFER_PAYLOAD', 'Payload invalido para publicacion de oferta.');
            $availableUntil = self::optionalDate($payload, 'availableUntil', 'INVALID_OFFER_PAYLOAD', 'Payload invalido para publicacion de oferta.');
            $municipalityName = self::requiredString($payload, 'municipalityName', 3, 'INVALID_OFFER_PAYLOAD', 'Payload invalido para publicacion de oferta.');
            $notes = self::optionalString($payload, 'notes', 500, 'INVALID_OFFER_PAYLOAD', 'Payload invalido para publicacion de oferta.');
            [$latitude, $longitude] = self::optionalCoordinates($payload, 'INVALID_OFFER_PAYLOAD', 'Payload invalido para publicacion de oferta.');

            if ($availableUntil !== null && $availableUntil < $availableFrom) {
                Response::error(400, 'INVALID_OFFER_AVAILABILITY_WINDOW', 'La ventana de disponibilidad de la oferta no es valida.');
            }

            try {
                $tenantId = self::resolveTenantId($database, $tenantKey);
                $resolvedProducerId = self::resolveProducerId($database, $producerId, $tenantId);
                self::ensureSpatialColumnsIfNeeded($database, $latitude, $longitude);

                $row = self::insertOffer(
                    $database,
                    [
                        'id' => Uuid::v4(),
                        'tenant_id' => $tenantId,
                        'producer_id' => $resolvedProducerId,
                        'title' => $title,
                        'product_name' => $productName,
                        'category' => $category,
                        'unit' => $unit,
                        'quantity_available' => $quantityAvailable,
                        'price_amount' => $priceAmount,
                        'currency' => $currency,
                        'available_from' => $availableFrom->format(DATE_ATOM),
                        'available_until' => $availableUntil?->format(DATE_ATOM),
                        'municipality_name' => $municipalityName,
                        'notes' => $notes,
                        'status' => 'published',
                        'latitude' => $latitude,
                        'longitude' => $longitude,
                    ]
                );

                $response = self::toOfferResponse($row);
                $response['matching'] = self::matchOfferToDemands($database, $response);

                Response::success($response, 201);
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                if ($error->getMessage() === 'PRODUCER_NOT_FOUND_FOR_TENANT') {
                    Response::error(404, 'PRODUCER_NOT_FOUND_FOR_TENANT', 'El productor no existe para el municipio indicado.');
                }
                if ($error->getMessage() === 'SPATIAL_COLUMNS_MISSING') {
                    Response::error(503, 'SPATIAL_COLUMNS_MISSING', 'La tabla offers no tiene latitude/longitude. Ejecute infra/postgres/init/002b_add_coordinates.sql.');
                }
                throw $error;
            }
        });

        $router->get('/api/v1/offers', static function (Request $request) use ($database): void {
            $page = self::page($request);
            $limit = self::limit($request);
            $tenantHeader = trim((string) ($request->header('x-tenant-id', '') ?? ''));

            try {
                $tenantId = $tenantHeader !== '' ? self::resolveTenantId($database, $tenantHeader) : null;
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }

            $where = 'deleted_at IS NULL';
            $params = [];
            if ($tenantId !== null) {
                $where .= ' AND tenant_id = :tenant_id';
                $params['tenant_id'] = $tenantId;
            }

            $total = (int) $database->scalar('SELECT COUNT(*) FROM public.offers WHERE ' . $where, $params);
            $coordinateSelect = self::coordinateSelect($database, 'o');
            $rows = $database->all(
                'SELECT
                    o.id,
                    o.tenant_id,
                    o.producer_id,
                    o.title,
                    o.product_name,
                    o.category,
                    o.unit,
                    o.quantity_available,
                    o.price_amount,
                    o.currency,
                    o.available_from,
                    o.available_until,
                    o.municipality_name,
                    o.notes,
                    o.status,
                    ' . $coordinateSelect . ',
                    o.created_at
                 FROM public.offers o
                 ' . self::coordinateJoin($database, 'offers', 'o') . '
                 WHERE ' . $where . '
                 ORDER BY o.created_at DESC
                 LIMIT :limit OFFSET :offset',
                array_merge($params, [
                    'limit' => $limit,
                    'offset' => ($page - 1) * $limit,
                ])
            );

            Response::paginated(
                array_map([self::class, 'toOfferResponse'], $rows),
                ['total' => $total, 'page' => $page, 'limit' => $limit]
            );
        });

        $router->get('/api/v1/offers/{id}', static function (Request $request) use ($database): void {
            $coordinateSelect = self::coordinateSelect($database, 'o');
            $row = $database->one(
                'SELECT
                    o.id,
                    o.tenant_id,
                    o.producer_id,
                    o.title,
                    o.product_name,
                    o.category,
                    o.unit,
                    o.quantity_available,
                    o.price_amount,
                    o.currency,
                    o.available_from,
                    o.available_until,
                    o.municipality_name,
                    o.notes,
                    o.status,
                    ' . $coordinateSelect . ',
                    o.created_at
                 FROM public.offers o
                 ' . self::coordinateJoin($database, 'offers', 'o') . '
                 WHERE o.id = :id
                   AND o.deleted_at IS NULL
                 LIMIT 1',
                ['id' => (string) $request->route('id')]
            );

            if ($row === null) {
                Response::error(404, 'OFFER_NOT_FOUND', 'Oferta no encontrada.');
            }

            $tenantHeader = trim((string) ($request->header('x-tenant-id', '') ?? ''));
            if ($tenantHeader !== '') {
                try {
                    $tenantId = self::resolveTenantId($database, $tenantHeader);
                } catch (RuntimeException $error) {
                    if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                        Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                    }
                    throw $error;
                }

                if (($row['tenant_id'] ?? null) !== $tenantId) {
                    Response::error(404, 'OFFER_NOT_FOUND', 'Oferta no encontrada.');
                }
            }

            Response::success(self::toOfferResponse($row));
        });
    }

    private static function insertOffer(Database $database, array $data): array
    {
        $hasCoordinates = self::hasCoordinates($database);
        $columns = [
            'id',
            'tenant_id',
            'producer_id',
            'title',
            'product_name',
            'category',
            'unit',
            'quantity_available',
            'price_amount',
            'currency',
            'available_from',
            'available_until',
            'municipality_name',
            'notes',
            'status',
        ];
        $values = [
            ':id',
            ':tenant_id',
            ':producer_id',
            ':title',
            ':product_name',
            ':category',
            ':unit',
            ':quantity_available',
            ':price_amount',
            ':currency',
            ':available_from',
            ':available_until',
            ':municipality_name',
            ':notes',
            ':status',
        ];
        $returning = [
            'id',
            'tenant_id',
            'producer_id',
            'title',
            'product_name',
            'category',
            'unit',
            'quantity_available',
            'price_amount',
            'currency',
            'available_from',
            'available_until',
            'municipality_name',
            'notes',
            'status',
            'created_at',
        ];

        if ($hasCoordinates) {
            $columns[] = 'latitude';
            $columns[] = 'longitude';
            $values[] = ':latitude';
            $values[] = ':longitude';
            $returning[] = 'latitude::text AS latitude';
            $returning[] = 'longitude::text AS longitude';
        } else {
            $returning[] = 'NULL::text AS latitude';
            $returning[] = 'NULL::text AS longitude';
        }

        return (array) $database->one(
            'INSERT INTO public.offers (' . implode(', ', $columns) . ')
             VALUES (' . implode(', ', $values) . ')
             RETURNING ' . implode(', ', $returning),
            $data
        );
    }

    private static function matchOfferToDemands(Database $database, array $offer): ?array
    {
        $demands = self::findOpenDemandsByCategory($database, (string) $offer['tenantId'], (string) $offer['category'], (string) $offer['municipalityName']);
        $matches = self::scoreMatches($offer, $demands);
        $searchScope = 'local';

        if ($matches === []) {
            $demands = self::findOpenDemandsByCategory($database, (string) $offer['tenantId'], (string) $offer['category']);
            $matches = self::scoreMatches($offer, $demands);
            $searchScope = 'regional';
        }

        $notificationsSent = 0;
        foreach ($matches as $match) {
            try {
                if (self::createOfferMatchNotification($database, $offer, $match)) {
                    $notificationsSent++;
                }
            } catch (Throwable) {
            }
        }

        return [
            'offerId' => $offer['id'],
            'matchesFound' => count($matches),
            'notificationsSent' => $notificationsSent,
            'searchScope' => $searchScope,
            'matches' => array_map(static function (array $match): array {
                return [
                    'demandId' => $match['demand']['id'],
                    'organizationName' => $match['demand']['organizationName'],
                    'demandChannel' => $match['demand']['demandChannel'],
                    'municipalityName' => $match['demand']['municipalityName'],
                    'score' => $match['score'],
                    'reasons' => $match['reasons'],
                ];
            }, $matches),
        ];
    }

    private static function findOpenDemandsByCategory(
        Database $database,
        string $tenantId,
        string $category,
        ?string $municipalityName = null
    ): array {
        $sql = 'SELECT
                    id,
                    tenant_id,
                    demand_channel,
                    organization_name,
                    product_name,
                    category,
                    unit,
                    quantity_required,
                    needed_by,
                    beneficiary_count,
                    municipality_name,
                    latitude::text AS latitude,
                    longitude::text AS longitude
                FROM public.demands
                WHERE tenant_id = :tenant_id
                  AND status = \'open\'
                  AND deleted_at IS NULL
                  AND needed_by >= NOW()
                  AND (LOWER(category) = LOWER(:category) OR LOWER(product_name) LIKE \'%\' || LOWER(:category) || \'%\')';

        $params = [
            'tenant_id' => $tenantId,
            'category' => $category,
        ];

        if ($municipalityName !== null) {
            $sql .= ' AND LOWER(municipality_name) = LOWER(:municipality_name)';
            $params['municipality_name'] = $municipalityName;
        }

        $sql .= ' ORDER BY needed_by ASC LIMIT 50';

        return $database->all($sql, $params);
    }

    private static function scoreMatches(array $offer, array $demands): array
    {
        $matches = [];
        foreach ($demands as $demand) {
            [$score, $reasons] = self::scoreDemandMatch($offer, $demand);
            if ($score >= 40) {
                $matches[] = [
                    'demand' => [
                        'id' => (string) $demand['id'],
                        'organizationName' => (string) $demand['organization_name'],
                        'demandChannel' => (string) $demand['demand_channel'],
                        'municipalityName' => (string) $demand['municipality_name'],
                    ],
                    'score' => $score,
                    'reasons' => $reasons,
                ];
            }
        }

        usort($matches, static fn (array $a, array $b): int => $b['score'] <=> $a['score']);
        return $matches;
    }

    private static function scoreDemandMatch(array $offer, array $demand): array
    {
        $score = 0;
        $reasons = [];

        $offerCategory = mb_strtolower((string) $offer['category']);
        $demandCategory = mb_strtolower((string) $demand['category']);
        $offerProduct = mb_strtolower((string) $offer['productName']);
        $demandProduct = mb_strtolower((string) $demand['product_name']);

        if ($offerCategory === $demandCategory) {
            $score += 30;
            $reasons[] = 'Categoria coincide: "' . $offer['category'] . '"';
        } elseif (str_contains($offerProduct, $demandProduct) || str_contains($demandProduct, $offerProduct)) {
            $score += 15;
            $reasons[] = 'Producto compatible: "' . $offer['productName'] . '" ↔ "' . $demand['product_name'] . '"';
        }

        if (mb_strtolower((string) $offer['unit']) === mb_strtolower((string) $demand['unit'])) {
            $score += 15;
            $reasons[] = 'Unidad coincide: "' . $offer['unit'] . '"';
        }

        $offerQuantity = (float) $offer['quantityAvailable'];
        $demandQuantity = (float) $demand['quantity_required'];
        if ($offerQuantity >= $demandQuantity) {
            $score += 25;
            $reasons[] = 'Cantidad suficiente: ' . $offerQuantity . ' ' . $offer['unit'] . ' disponible vs ' . $demandQuantity . ' requerido';
        } elseif ($offerQuantity >= $demandQuantity * 0.5) {
            $score += 12;
            $coverage = (int) round(($offerQuantity / $demandQuantity) * 100);
            $reasons[] = 'Cobertura parcial: ' . $offerQuantity . ' ' . $offer['unit'] . ' cubre ' . $coverage . '%';
        }

        $neededBy = new \DateTimeImmutable((string) $demand['needed_by']);
        $daysUntilNeeded = (int) ceil(($neededBy->getTimestamp() - time()) / 86400);
        if ($daysUntilNeeded <= 7) {
            $score += 20;
            $reasons[] = 'Urgente: necesario en ' . $daysUntilNeeded . ' dias';
        } elseif ($daysUntilNeeded <= 14) {
            $score += 10;
            $reasons[] = 'Proximo: necesario en ' . $daysUntilNeeded . ' dias';
        } elseif ($daysUntilNeeded <= 30) {
            $score += 5;
            $reasons[] = 'Planificado: necesario en ' . $daysUntilNeeded . ' dias';
        }

        if (
            $offer['latitude'] !== null &&
            $offer['longitude'] !== null &&
            $demand['latitude'] !== null &&
            $demand['longitude'] !== null
        ) {
            $distanceKm = self::haversineKm(
                (float) $offer['latitude'],
                (float) $offer['longitude'],
                (float) $demand['latitude'],
                (float) $demand['longitude']
            );

            if ($distanceKm <= 50) {
                $score += 10;
                $reasons[] = 'Proxima: ' . number_format($distanceKm, 1) . ' km de distancia';
            } elseif ($distanceKm <= 100) {
                $score += 5;
                $reasons[] = 'Alcanzable: ' . number_format($distanceKm, 1) . ' km de distancia';
            }
        }

        return [$score, $reasons];
    }

    private static function createOfferMatchNotification(Database $database, array $offer, array $match): bool
    {
        if (
            !$database->relationExists('public.notifications') ||
            !$database->hasColumn('public.notifications', 'offer_id')
        ) {
            return false;
        }

        $channelLabel = self::translateDemandChannel((string) $match['demand']['demandChannel']);
        $title = 'Oferta disponible: ' . $offer['productName'] . ' - ' . $offer['quantityAvailable'] . ' ' . $offer['unit'];
        $message = implode("\n", array_filter([
            'Se ha publicado una oferta que coincide con la demanda de "' . $match['demand']['organizationName'] . '" (' . $channelLabel . ').',
            'Producto ofertado: ' . $offer['productName'] . ' (' . $offer['category'] . ')',
            'Cantidad disponible: ' . $offer['quantityAvailable'] . ' ' . $offer['unit'],
            'Precio: $' . number_format((float) $offer['priceAmount'], 0, ',', '.') . ' ' . $offer['currency'],
            'Municipio de origen: ' . $offer['municipalityName'],
            'Puntuacion de coincidencia: ' . $match['score'] . '/100',
            'Razones: ' . implode('; ', $match['reasons']),
        ]));

        try {
            $database->execute(
                'INSERT INTO public.notifications (
                    id,
                    tenant_id,
                    offer_id,
                    notification_channel,
                    recipient_label,
                    title,
                    message,
                    scheduled_for,
                    status
                 )
                 VALUES (
                    :id,
                    :tenant_id,
                    :offer_id,
                    :notification_channel,
                    :recipient_label,
                    :title,
                    :message,
                    :scheduled_for,
                    :status
                 )',
                [
                    'id' => Uuid::v4(),
                    'tenant_id' => $offer['tenantId'],
                    'offer_id' => $offer['id'],
                    'notification_channel' => 'in_app',
                    'recipient_label' => $match['demand']['organizationName'] . ' (' . $channelLabel . ')',
                    'title' => $title,
                    'message' => $message,
                    'scheduled_for' => gmdate(DATE_ATOM),
                    'status' => 'pending',
                ]
            );
            return true;
        } catch (Throwable) {
            return false;
        }
    }

    private static function translateDemandChannel(string $channel): string
    {
        return [
            'community_kitchen' => 'Comedor Comunitario',
            'school_program' => 'Programa PAE',
            'social_program' => 'Programa Social',
            'emergency_response' => 'Respuesta de Emergencia',
        ][$channel] ?? $channel;
    }

    private static function resolveTenantId(Database $database, string $tenantKey): string
    {
        $row = $database->one(
            'SELECT id
             FROM public.tenants
             WHERE id::text = :tenant_key OR UPPER(code) = UPPER(:tenant_key)
             LIMIT 1',
            ['tenant_key' => $tenantKey]
        );

        if ($row === null || !isset($row['id'])) {
            throw new RuntimeException('TENANT_NOT_FOUND');
        }

        return (string) $row['id'];
    }

    private static function resolveProducerId(Database $database, string $producerId, string $tenantId): string
    {
        $row = $database->one(
            'SELECT id
             FROM public.producers
             WHERE id = :producer_id
               AND tenant_id = :tenant_id
               AND deleted_at IS NULL
             LIMIT 1',
            ['producer_id' => $producerId, 'tenant_id' => $tenantId]
        );

        if ($row === null || !isset($row['id'])) {
            throw new RuntimeException('PRODUCER_NOT_FOUND_FOR_TENANT');
        }

        return (string) $row['id'];
    }

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

    private static function requiredDate(array $payload, string $key, string $code, string $message): \DateTimeImmutable
    {
        $value = trim((string) ($payload[$key] ?? ''));
        if ($value === '') {
            Response::error(400, $code, $message);
        }

        try {
            return new \DateTimeImmutable($value);
        } catch (Throwable) {
            Response::error(400, $code, $message);
        }
    }

    private static function optionalDate(array $payload, string $key, string $code, string $message): ?\DateTimeImmutable
    {
        if (!array_key_exists($key, $payload) || $payload[$key] === null || $payload[$key] === '') {
            return null;
        }

        try {
            return new \DateTimeImmutable((string) $payload[$key]);
        } catch (Throwable) {
            Response::error(400, $code, $message);
        }
    }

    private static function optionalCoordinates(array $payload, string $code, string $message): array
    {
        $hasLat = array_key_exists('latitude', $payload) && $payload['latitude'] !== null && $payload['latitude'] !== '';
        $hasLng = array_key_exists('longitude', $payload) && $payload['longitude'] !== null && $payload['longitude'] !== '';

        if ($hasLat !== $hasLng) {
            Response::error(400, $code, $message);
        }

        if (!$hasLat) {
            return [null, null];
        }

        $latitude = filter_var($payload['latitude'], FILTER_VALIDATE_FLOAT);
        $longitude = filter_var($payload['longitude'], FILTER_VALIDATE_FLOAT);
        if ($latitude === false || $latitude < -90 || $latitude > 90 || $longitude === false || $longitude < -180 || $longitude > 180) {
            Response::error(400, $code, $message);
        }

        return [(float) $latitude, (float) $longitude];
    }

    private static function toOfferResponse(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'tenantId' => (string) $row['tenant_id'],
            'producerId' => (string) $row['producer_id'],
            'title' => (string) $row['title'],
            'productName' => (string) $row['product_name'],
            'category' => (string) $row['category'],
            'unit' => (string) $row['unit'],
            'quantityAvailable' => (float) $row['quantity_available'],
            'priceAmount' => (float) $row['price_amount'],
            'currency' => (string) $row['currency'],
            'availableFrom' => self::toIso($row['available_from'] ?? null),
            'availableUntil' => self::toIso($row['available_until'] ?? null),
            'municipalityName' => (string) $row['municipality_name'],
            'notes' => $row['notes'],
            'status' => (string) $row['status'],
            'latitude' => $row['latitude'] !== null ? (float) $row['latitude'] : null,
            'longitude' => $row['longitude'] !== null ? (float) $row['longitude'] : null,
            'createdAt' => self::toIso($row['created_at'] ?? null),
        ];
    }

    private static function page(Request $request): int
    {
        return max(1, (int) ($request->query('page', 1) ?? 1));
    }

    private static function limit(Request $request): int
    {
        return min(100, max(1, (int) ($request->query('limit', 20) ?? 20)));
    }

    private static function isUuid(string $value): bool
    {
        return preg_match('/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/', $value) === 1;
    }

    private static function toIso(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (new \DateTimeImmutable((string) $value))->format(DATE_ATOM);
    }

    private static function hasCoordinates(Database $database): bool
    {
        return $database->hasColumn('public.offers', 'latitude') && $database->hasColumn('public.offers', 'longitude');
    }

    private static function ensureSpatialColumnsIfNeeded(Database $database, ?float $latitude, ?float $longitude): void
    {
        if (($latitude !== null || $longitude !== null) && !self::hasCoordinates($database)) {
            throw new RuntimeException('SPATIAL_COLUMNS_MISSING');
        }
    }

    private static function coordinateSelect(Database $database, string $alias): string
    {
        if (self::hasCoordinates($database)) {
            return $alias . '.latitude::text AS latitude, ' . $alias . '.longitude::text AS longitude';
        }

        if ($database->relationExists('public.v_mapa_ofertas')) {
            return 'vm.longitud::text AS longitude, vm.latitud::text AS latitude';
        }

        return 'NULL::text AS latitude, NULL::text AS longitude';
    }

    private static function coordinateJoin(Database $database, string $tableKey, string $alias): string
    {
        if (self::hasCoordinates($database)) {
            return '';
        }

        if ($tableKey === 'offers' && $database->relationExists('public.v_mapa_ofertas')) {
            return 'LEFT JOIN public.v_mapa_ofertas vm ON vm.id = ' . $alias . '.id';
        }

        return '';
    }

    private static function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371;
        $latDelta = deg2rad($lat2 - $lat1);
        $lngDelta = deg2rad($lng2 - $lng1);
        $a = sin($latDelta / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($lngDelta / 2) ** 2;

        return $earthRadius * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
