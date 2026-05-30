<?php
declare(strict_types=1);

namespace Agrored\Modules\Rescues;

use Agrored\Database\Database;
use Agrored\Http\Request;
use Agrored\Http\Response;
use Agrored\Http\Router;
use Agrored\Support\Uuid;
use RuntimeException;
use Throwable;

final class RescueModule
{
    private const RESCUE_CHANNELS = ['food_bank', 'community_kitchen', 'social_program', 'market_recovery'];

    public static function register(Router $router, Database $database): void
    {
        $router->post('/api/v1/rescues/register', static function (Request $request) use ($database): void {
            $payload = $request->body();

            $tenantKey = self::requiredString($payload, 'tenantId', 1, 'INVALID_RESCUE_PAYLOAD', 'Payload invalido para registro de rescate.');
            $producerId = self::requiredUuid($payload, 'producerId', 'INVALID_RESCUE_PAYLOAD', 'Payload invalido para registro de rescate.');
            $offerId = self::optionalUuid($payload, 'offerId', 'INVALID_RESCUE_PAYLOAD', 'Payload invalido para registro de rescate.');
            $rescueChannel = strtolower(self::requiredString($payload, 'rescueChannel', 1, 'INVALID_RESCUE_PAYLOAD', 'Payload invalido para registro de rescate.'));
            $destinationOrganizationName = self::requiredString($payload, 'destinationOrganizationName', 3, 'INVALID_RESCUE_PAYLOAD', 'Payload invalido para registro de rescate.');
            $productName = self::requiredString($payload, 'productName', 2, 'INVALID_RESCUE_PAYLOAD', 'Payload invalido para registro de rescate.');
            $category = self::requiredString($payload, 'category', 2, 'INVALID_RESCUE_PAYLOAD', 'Payload invalido para registro de rescate.');
            $unit = self::requiredString($payload, 'unit', 1, 'INVALID_RESCUE_PAYLOAD', 'Payload invalido para registro de rescate.');
            $quantityRescued = self::requiredPositiveFloat($payload, 'quantityRescued', 'INVALID_RESCUE_PAYLOAD', 'Payload invalido para registro de rescate.');
            $scheduledAt = self::requiredDate($payload, 'scheduledAt', 'INVALID_RESCUE_PAYLOAD', 'Payload invalido para registro de rescate.');
            $beneficiaryCount = self::requiredPositiveInt($payload, 'beneficiaryCount', 'INVALID_RESCUE_PAYLOAD', 'Payload invalido para registro de rescate.');
            $municipalityName = self::requiredString($payload, 'municipalityName', 3, 'INVALID_RESCUE_PAYLOAD', 'Payload invalido para registro de rescate.');
            $notes = self::optionalString($payload, 'notes', 500, 'INVALID_RESCUE_PAYLOAD', 'Payload invalido para registro de rescate.');
            [$latitude, $longitude] = self::optionalCoordinates($payload, 'INVALID_RESCUE_PAYLOAD', 'Payload invalido para registro de rescate.');

            if (!in_array($rescueChannel, self::RESCUE_CHANNELS, true)) {
                Response::error(400, 'INVALID_RESCUE_PAYLOAD', 'Payload invalido para registro de rescate.');
            }

            try {
                $tenantId = self::resolveTenantId($database, $tenantKey);
                $resolvedProducerId = self::resolveProducerId($database, $producerId, $tenantId);
                $resolvedOfferId = $offerId !== null ? self::resolveOfferId($database, $offerId, $tenantId, $resolvedProducerId) : null;
                self::ensureSpatialColumnsIfNeeded($database, $latitude, $longitude);

                $row = self::insertRescue(
                    $database,
                    [
                        'id' => Uuid::v4(),
                        'tenant_id' => $tenantId,
                        'producer_id' => $resolvedProducerId,
                        'offer_id' => $resolvedOfferId,
                        'rescue_channel' => $rescueChannel,
                        'destination_organization_name' => $destinationOrganizationName,
                        'product_name' => $productName,
                        'category' => $category,
                        'unit' => $unit,
                        'quantity_rescued' => $quantityRescued,
                        'scheduled_at' => $scheduledAt->format(DATE_ATOM),
                        'beneficiary_count' => $beneficiaryCount,
                        'municipality_name' => $municipalityName,
                        'notes' => $notes,
                        'status' => 'scheduled',
                        'latitude' => $latitude,
                        'longitude' => $longitude,
                    ]
                );

                Response::success(self::toRescueResponse($row), 201);
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                if ($error->getMessage() === 'PRODUCER_NOT_FOUND_FOR_TENANT') {
                    Response::error(404, 'PRODUCER_NOT_FOUND_FOR_TENANT', 'El productor no existe para el municipio indicado.');
                }
                if ($error->getMessage() === 'OFFER_NOT_FOUND_FOR_PRODUCER') {
                    Response::error(404, 'OFFER_NOT_FOUND_FOR_PRODUCER', 'La oferta indicada no existe para el productor seleccionado.');
                }
                if ($error->getMessage() === 'SPATIAL_COLUMNS_MISSING') {
                    Response::error(503, 'SPATIAL_COLUMNS_MISSING', 'La tabla rescues no tiene latitude/longitude. Ejecute infra/postgres/init/002b_add_coordinates.sql.');
                }
                throw $error;
            }
        });

        $router->get('/api/v1/rescues', static function (Request $request) use ($database): void {
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

            $total = (int) $database->scalar('SELECT COUNT(*) FROM public.rescues WHERE ' . $where, $params);
            $coordinateSelect = self::coordinateSelect($database, 'r');
            $rows = $database->all(
                'SELECT
                    r.id,
                    r.tenant_id,
                    r.producer_id,
                    r.offer_id,
                    r.rescue_channel,
                    r.destination_organization_name,
                    r.product_name,
                    r.category,
                    r.unit,
                    r.quantity_rescued,
                    r.scheduled_at,
                    r.beneficiary_count,
                    r.municipality_name,
                    r.notes,
                    r.status,
                    ' . $coordinateSelect . ',
                    r.created_at
                 FROM public.rescues r
                 ' . self::coordinateJoin($database, 'rescues', 'r') . '
                 WHERE ' . $where . '
                 ORDER BY r.created_at DESC
                 LIMIT :limit OFFSET :offset',
                array_merge($params, [
                    'limit' => $limit,
                    'offset' => ($page - 1) * $limit,
                ])
            );

            Response::paginated(
                array_map([self::class, 'toRescueResponse'], $rows),
                ['total' => $total, 'page' => $page, 'limit' => $limit]
            );
        });

        $router->get('/api/v1/rescues/{id}', static function (Request $request) use ($database): void {
            $coordinateSelect = self::coordinateSelect($database, 'r');
            $row = $database->one(
                'SELECT
                    r.id,
                    r.tenant_id,
                    r.producer_id,
                    r.offer_id,
                    r.rescue_channel,
                    r.destination_organization_name,
                    r.product_name,
                    r.category,
                    r.unit,
                    r.quantity_rescued,
                    r.scheduled_at,
                    r.beneficiary_count,
                    r.municipality_name,
                    r.notes,
                    r.status,
                    ' . $coordinateSelect . ',
                    r.created_at
                 FROM public.rescues r
                 ' . self::coordinateJoin($database, 'rescues', 'r') . '
                 WHERE r.id = :id
                   AND r.deleted_at IS NULL
                 LIMIT 1',
                ['id' => (string) $request->route('id')]
            );

            if ($row === null) {
                Response::error(404, 'RESCUE_NOT_FOUND', 'Rescate no encontrado.');
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
                    Response::error(404, 'RESCUE_NOT_FOUND', 'Rescate no encontrado.');
                }
            }

            Response::success(self::toRescueResponse($row));
        });
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

    private static function resolveOfferId(Database $database, string $offerId, string $tenantId, string $producerId): string
    {
        $row = $database->one(
            'SELECT id
             FROM public.offers
             WHERE id = :offer_id
               AND tenant_id = :tenant_id
               AND producer_id = :producer_id
               AND deleted_at IS NULL
             LIMIT 1',
            ['offer_id' => $offerId, 'tenant_id' => $tenantId, 'producer_id' => $producerId]
        );

        if ($row === null || !isset($row['id'])) {
            throw new RuntimeException('OFFER_NOT_FOUND_FOR_PRODUCER');
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

    private static function optionalUuid(array $payload, string $key, string $code, string $message): ?string
    {
        if (!array_key_exists($key, $payload) || $payload[$key] === null || $payload[$key] === '') {
            return null;
        }

        $value = trim((string) $payload[$key]);
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

    private static function requiredPositiveInt(array $payload, string $key, string $code, string $message): int
    {
        $value = filter_var($payload[$key] ?? null, FILTER_VALIDATE_INT);
        if ($value === false || $value <= 0) {
            Response::error(400, $code, $message);
        }

        return (int) $value;
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

    private static function toRescueResponse(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'tenantId' => (string) $row['tenant_id'],
            'producerId' => (string) $row['producer_id'],
            'offerId' => $row['offer_id'],
            'rescueChannel' => (string) $row['rescue_channel'],
            'destinationOrganizationName' => (string) $row['destination_organization_name'],
            'productName' => (string) $row['product_name'],
            'category' => (string) $row['category'],
            'unit' => (string) $row['unit'],
            'quantityRescued' => (float) $row['quantity_rescued'],
            'scheduledAt' => self::toIso($row['scheduled_at'] ?? null),
            'beneficiaryCount' => (int) $row['beneficiary_count'],
            'municipalityName' => (string) $row['municipality_name'],
            'notes' => $row['notes'],
            'status' => (string) $row['status'],
            'latitude' => $row['latitude'] !== null ? (float) $row['latitude'] : null,
            'longitude' => $row['longitude'] !== null ? (float) $row['longitude'] : null,
            'createdAt' => self::toIso($row['created_at'] ?? null),
        ];
    }

    private static function insertRescue(Database $database, array $data): array
    {
        $hasCoordinates = self::hasCoordinates($database);
        $columns = [
            'id',
            'tenant_id',
            'producer_id',
            'offer_id',
            'rescue_channel',
            'destination_organization_name',
            'product_name',
            'category',
            'unit',
            'quantity_rescued',
            'scheduled_at',
            'beneficiary_count',
            'municipality_name',
            'notes',
            'status',
        ];
        $values = [
            ':id',
            ':tenant_id',
            ':producer_id',
            ':offer_id',
            ':rescue_channel',
            ':destination_organization_name',
            ':product_name',
            ':category',
            ':unit',
            ':quantity_rescued',
            ':scheduled_at',
            ':beneficiary_count',
            ':municipality_name',
            ':notes',
            ':status',
        ];
        $returning = [
            'id',
            'tenant_id',
            'producer_id',
            'offer_id',
            'rescue_channel',
            'destination_organization_name',
            'product_name',
            'category',
            'unit',
            'quantity_rescued',
            'scheduled_at',
            'beneficiary_count',
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
            'INSERT INTO public.rescues (' . implode(', ', $columns) . ')
             VALUES (' . implode(', ', $values) . ')
             RETURNING ' . implode(', ', $returning),
            $data
        );
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
        return $database->hasColumn('public.rescues', 'latitude') && $database->hasColumn('public.rescues', 'longitude');
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

        if ($database->relationExists('public.v_mapa_rescates')) {
            return 'vm.longitude::text AS longitude, vm.latitude::text AS latitude';
        }

        return 'NULL::text AS latitude, NULL::text AS longitude';
    }

    private static function coordinateJoin(Database $database, string $tableKey, string $alias): string
    {
        if (self::hasCoordinates($database)) {
            return '';
        }

        if ($tableKey === 'rescues' && $database->relationExists('public.v_mapa_rescates')) {
            return 'LEFT JOIN public.v_mapa_rescates vm ON vm.id = ' . $alias . '.id';
        }

        return '';
    }
}
