<?php
declare(strict_types=1);

namespace Agrored\Modules\Demands;

use Agrored\Database\Database;
use Agrored\Http\Request;
use Agrored\Http\Response;
use Agrored\Http\Router;
use Agrored\Support\Uuid;
use RuntimeException;
use Throwable;

final class DemandModule
{
    private const DEMAND_CHANNELS = ['community_kitchen', 'school_program', 'social_program', 'emergency_response'];

    public static function register(Router $router, Database $database): void
    {
        $router->post('/api/v1/demands/register', static function (Request $request) use ($database): void {
            $payload = $request->body();

            $tenantKey = self::requiredString($payload, 'tenantId', 1, 'INVALID_DEMAND_PAYLOAD', 'Payload invalido para registro de demanda.');
            $responsibleUserId = self::optionalUuid($payload, 'responsibleUserId', 'INVALID_DEMAND_PAYLOAD', 'Payload invalido para registro de demanda.');
            $demandChannel = strtolower(self::requiredString($payload, 'demandChannel', 1, 'INVALID_DEMAND_PAYLOAD', 'Payload invalido para registro de demanda.'));
            $organizationName = self::requiredString($payload, 'organizationName', 3, 'INVALID_DEMAND_PAYLOAD', 'Payload invalido para registro de demanda.');
            $productName = self::requiredString($payload, 'productName', 2, 'INVALID_DEMAND_PAYLOAD', 'Payload invalido para registro de demanda.');
            $category = self::requiredString($payload, 'category', 2, 'INVALID_DEMAND_PAYLOAD', 'Payload invalido para registro de demanda.');
            $unit = self::requiredString($payload, 'unit', 1, 'INVALID_DEMAND_PAYLOAD', 'Payload invalido para registro de demanda.');
            $quantityRequired = self::requiredPositiveFloat($payload, 'quantityRequired', 'INVALID_DEMAND_PAYLOAD', 'Payload invalido para registro de demanda.');
            $neededBy = self::requiredDate($payload, 'neededBy', 'INVALID_DEMAND_PAYLOAD', 'Payload invalido para registro de demanda.');
            $beneficiaryCount = self::requiredPositiveInt($payload, 'beneficiaryCount', 'INVALID_DEMAND_PAYLOAD', 'Payload invalido para registro de demanda.');
            $municipalityName = self::requiredString($payload, 'municipalityName', 3, 'INVALID_DEMAND_PAYLOAD', 'Payload invalido para registro de demanda.');
            $notes = self::optionalString($payload, 'notes', 500, 'INVALID_DEMAND_PAYLOAD', 'Payload invalido para registro de demanda.');
            [$latitude, $longitude] = self::optionalCoordinates($payload, 'INVALID_DEMAND_PAYLOAD', 'Payload invalido para registro de demanda.');

            if (!in_array($demandChannel, self::DEMAND_CHANNELS, true)) {
                Response::error(400, 'INVALID_DEMAND_PAYLOAD', 'Payload invalido para registro de demanda.');
            }

            try {
                $tenantId = self::resolveTenantId($database, $tenantKey);
                $resolvedUserId = $responsibleUserId !== null ? self::resolveUserId($database, $responsibleUserId, $tenantId) : null;

                $row = (array) $database->one(
                    'INSERT INTO public.demands (
                        id,
                        tenant_id,
                        responsible_user_id,
                        demand_channel,
                        organization_name,
                        product_name,
                        category,
                        unit,
                        quantity_required,
                        needed_by,
                        beneficiary_count,
                        municipality_name,
                        notes,
                        status,
                        latitude,
                        longitude
                     )
                     VALUES (
                        :id,
                        :tenant_id,
                        :responsible_user_id,
                        :demand_channel,
                        :organization_name,
                        :product_name,
                        :category,
                        :unit,
                        :quantity_required,
                        :needed_by,
                        :beneficiary_count,
                        :municipality_name,
                        :notes,
                        :status,
                        :latitude,
                        :longitude
                     )
                     RETURNING
                        id,
                        tenant_id,
                        responsible_user_id,
                        demand_channel,
                        organization_name,
                        product_name,
                        category,
                        unit,
                        quantity_required,
                        needed_by,
                        beneficiary_count,
                        municipality_name,
                        notes,
                        status,
                        latitude::text AS latitude,
                        longitude::text AS longitude,
                        created_at',
                    [
                        'id' => Uuid::v4(),
                        'tenant_id' => $tenantId,
                        'responsible_user_id' => $resolvedUserId,
                        'demand_channel' => $demandChannel,
                        'organization_name' => $organizationName,
                        'product_name' => $productName,
                        'category' => $category,
                        'unit' => $unit,
                        'quantity_required' => $quantityRequired,
                        'needed_by' => $neededBy->format(DATE_ATOM),
                        'beneficiary_count' => $beneficiaryCount,
                        'municipality_name' => $municipalityName,
                        'notes' => $notes,
                        'status' => 'open',
                        'latitude' => $latitude,
                        'longitude' => $longitude,
                    ]
                );

                Response::success(self::toDemandResponse($row), 201);
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                if ($error->getMessage() === 'USER_NOT_FOUND_FOR_TENANT') {
                    Response::error(404, 'USER_NOT_FOUND_FOR_TENANT', 'El usuario responsable no existe para el municipio indicado.');
                }
                throw $error;
            }
        });

        $router->get('/api/v1/demands', static function (Request $request) use ($database): void {
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

            $total = (int) $database->scalar('SELECT COUNT(*) FROM public.demands WHERE ' . $where, $params);
            $rows = $database->all(
                'SELECT
                    id,
                    tenant_id,
                    responsible_user_id,
                    demand_channel,
                    organization_name,
                    product_name,
                    category,
                    unit,
                    quantity_required,
                    needed_by,
                    beneficiary_count,
                    municipality_name,
                    notes,
                    status,
                    latitude::text AS latitude,
                    longitude::text AS longitude,
                    created_at
                 FROM public.demands
                 WHERE ' . $where . '
                 ORDER BY created_at DESC
                 LIMIT :limit OFFSET :offset',
                array_merge($params, [
                    'limit' => $limit,
                    'offset' => ($page - 1) * $limit,
                ])
            );

            Response::paginated(
                array_map([self::class, 'toDemandResponse'], $rows),
                ['total' => $total, 'page' => $page, 'limit' => $limit]
            );
        });

        $router->get('/api/v1/demands/{id}', static function (Request $request) use ($database): void {
            $row = $database->one(
                'SELECT
                    id,
                    tenant_id,
                    responsible_user_id,
                    demand_channel,
                    organization_name,
                    product_name,
                    category,
                    unit,
                    quantity_required,
                    needed_by,
                    beneficiary_count,
                    municipality_name,
                    notes,
                    status,
                    latitude::text AS latitude,
                    longitude::text AS longitude,
                    created_at
                 FROM public.demands
                 WHERE id = :id
                   AND deleted_at IS NULL
                 LIMIT 1',
                ['id' => (string) $request->route('id')]
            );

            if ($row === null) {
                Response::error(404, 'DEMAND_NOT_FOUND', 'Demanda no encontrada.');
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
                    Response::error(404, 'DEMAND_NOT_FOUND', 'Demanda no encontrada.');
                }
            }

            Response::success(self::toDemandResponse($row));
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

    private static function resolveUserId(Database $database, string $userId, string $tenantId): string
    {
        $row = $database->one(
            'SELECT id
             FROM public.users
             WHERE id = :user_id
               AND tenant_id = :tenant_id
               AND deleted_at IS NULL
             LIMIT 1',
            ['user_id' => $userId, 'tenant_id' => $tenantId]
        );

        if ($row === null || !isset($row['id'])) {
            throw new RuntimeException('USER_NOT_FOUND_FOR_TENANT');
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

    private static function toDemandResponse(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'tenantId' => (string) $row['tenant_id'],
            'responsibleUserId' => $row['responsible_user_id'],
            'demandChannel' => (string) $row['demand_channel'],
            'organizationName' => (string) $row['organization_name'],
            'productName' => (string) $row['product_name'],
            'category' => (string) $row['category'],
            'unit' => (string) $row['unit'],
            'quantityRequired' => (float) $row['quantity_required'],
            'neededBy' => self::toIso($row['needed_by'] ?? null),
            'beneficiaryCount' => (int) $row['beneficiary_count'],
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
}
