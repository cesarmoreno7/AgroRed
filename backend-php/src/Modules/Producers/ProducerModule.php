<?php
declare(strict_types=1);

namespace Agrored\Modules\Producers;

use Agrored\Database\Database;
use Agrored\Http\Request;
use Agrored\Http\Response;
use Agrored\Http\Router;
use Agrored\Support\Uuid;
use RuntimeException;
use Throwable;

final class ProducerModule
{
    private const PRODUCER_TYPES = ['individual', 'association', 'cooperative'];
    private const PRODUCER_ZONES = ['rural', 'urban_periphery'];

    public static function register(Router $router, Database $database): void
    {
        $router->post('/api/v1/producers/register', static function (Request $request) use ($database): void {
            $payload = $request->body();

            $tenantKey = self::requiredString($payload, 'tenantId', 1, 'INVALID_PRODUCER_PAYLOAD', 'Payload invalido para registro de productor.');
            $userId = self::optionalUuid($payload, 'userId', 'INVALID_PRODUCER_PAYLOAD', 'Payload invalido para registro de productor.');
            $producerType = strtolower(self::requiredString($payload, 'producerType', 1, 'INVALID_PRODUCER_PAYLOAD', 'Payload invalido para registro de productor.'));
            $organizationName = self::requiredString($payload, 'organizationName', 3, 'INVALID_PRODUCER_PAYLOAD', 'Payload invalido para registro de productor.');
            $contactName = self::requiredString($payload, 'contactName', 3, 'INVALID_PRODUCER_PAYLOAD', 'Payload invalido para registro de productor.');
            $contactPhone = self::requiredString($payload, 'contactPhone', 7, 'INVALID_PRODUCER_PAYLOAD', 'Payload invalido para registro de productor.');
            $municipalityName = self::requiredString($payload, 'municipalityName', 3, 'INVALID_PRODUCER_PAYLOAD', 'Payload invalido para registro de productor.');
            $zoneType = strtolower(self::requiredString($payload, 'zoneType', 1, 'INVALID_PRODUCER_PAYLOAD', 'Payload invalido para registro de productor.'));
            $productCategories = self::requiredCategories($payload, 'INVALID_PRODUCER_PAYLOAD', 'Payload invalido para registro de productor.');
            [$latitude, $longitude] = self::optionalCoordinates($payload, 'INVALID_PRODUCER_PAYLOAD', 'Payload invalido para registro de productor.');

            if (!in_array($producerType, self::PRODUCER_TYPES, true) || !in_array($zoneType, self::PRODUCER_ZONES, true)) {
                Response::error(400, 'INVALID_PRODUCER_PAYLOAD', 'Payload invalido para registro de productor.');
            }

            try {
                $tenantId = self::resolveTenantId($database, $tenantKey);
                if (self::findByOrganizationName($database, $tenantId, $organizationName) !== null) {
                    Response::error(409, 'PRODUCER_ALREADY_EXISTS', 'La organizacion productora ya existe para este municipio.');
                }
                self::ensureSpatialColumnsIfNeeded($database, $latitude, $longitude);

                $row = self::insertProducer(
                    $database,
                    [
                        'id' => Uuid::v4(),
                        'tenant_id' => $tenantId,
                        'user_id' => $userId !== null ? self::resolveUserId($database, $userId, $tenantId) : null,
                        'producer_type' => $producerType,
                        'organization_name' => $organizationName,
                        'contact_name' => $contactName,
                        'contact_phone' => $contactPhone,
                        'municipality_name' => $municipalityName,
                        'zone_type' => $zoneType,
                        'product_categories' => $productCategories,
                        'status' => 'pending_verification',
                        'latitude' => $latitude,
                        'longitude' => $longitude,
                    ]
                );

                Response::success(self::toProducerResponse($row), 201);
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                if ($error->getMessage() === 'USER_NOT_FOUND_FOR_TENANT') {
                    Response::error(404, 'USER_NOT_FOUND_FOR_TENANT', 'El usuario responsable no existe para el municipio indicado.');
                }
                if ($error->getMessage() === 'SPATIAL_COLUMNS_MISSING') {
                    Response::error(503, 'SPATIAL_COLUMNS_MISSING', 'La tabla producers no tiene latitude/longitude. Ejecute infra/postgres/init/002b_add_coordinates.sql.');
                }
                throw $error;
            }
        });

        $router->get('/api/v1/producers', static function (Request $request) use ($database): void {
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

            $total = (int) $database->scalar('SELECT COUNT(*) FROM public.producers WHERE ' . $where, $params);
            $coordinateSelect = self::coordinateSelect($database, 'p');
            $rows = $database->all(
                'SELECT
                    p.id,
                    p.tenant_id,
                    p.user_id,
                    p.producer_type,
                    p.organization_name,
                    p.contact_name,
                    p.contact_phone,
                    p.municipality_name,
                    p.zone_type,
                    p.product_categories::text AS product_categories,
                    p.status,
                    ' . $coordinateSelect . ',
                    p.created_at
                 FROM public.producers p
                 ' . self::coordinateJoin($database, 'producers', 'p') . '
                 WHERE ' . $where . '
                 ORDER BY p.created_at DESC
                 LIMIT :limit OFFSET :offset',
                array_merge($params, [
                    'limit' => $limit,
                    'offset' => ($page - 1) * $limit,
                ])
            );

            Response::paginated(
                array_map([self::class, 'toProducerResponse'], $rows),
                ['total' => $total, 'page' => $page, 'limit' => $limit]
            );
        });

        $router->post('/api/v1/producers/import/csv', static function (Request $request) use ($database): void {
            $payload = $request->body();
            $tenantKey = self::requiredString($payload, 'tenantId', 1, 'INVALID_CSV_PAYLOAD', 'Payload invalido para importacion CSV de productores.');
            $defaultMunicipality = self::requiredString($payload, 'municipalityName', 3, 'INVALID_CSV_PAYLOAD', 'Payload invalido para importacion CSV de productores.');
            $csvText = self::requiredString($payload, 'csvText', 10, 'INVALID_CSV_PAYLOAD', 'Payload invalido para importacion CSV de productores.');

            try {
                $tenantId = self::resolveTenantId($database, $tenantKey);
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }

            [$rows, $headerError] = self::parseCsvText($csvText);
            if ($headerError !== null) {
                Response::success(
                    [
                        'importId' => Uuid::v4(),
                        'totalRows' => 0,
                        'successCount' => 0,
                        'errorCount' => 1,
                        'errors' => [
                            ['row' => 0, 'field' => 'headers', 'message' => $headerError],
                        ],
                        'producers' => [],
                    ],
                    422
                );
            }

            $errors = [];
            $created = [];

            $database->pdo()->beginTransaction();
            try {
                foreach ($rows as $index => $row) {
                    $rowNumber = $index + 2;
                    $validationErrors = self::validateCsvRow($row, $rowNumber);
                    if ($validationErrors !== []) {
                        $errors = array_merge($errors, $validationErrors);
                        continue;
                    }

                    $categories = array_values(array_filter(array_map(
                        static fn (string $item): string => trim($item),
                        explode(';', (string) $row['productCategories'])
                    ), static fn (string $item): bool => mb_strlen($item) >= 2));

                    $created[] = self::toProducerResponse(self::insertProducer(
                        $database,
                        [
                            'id' => Uuid::v4(),
                            'tenant_id' => $tenantId,
                            'user_id' => null,
                            'producer_type' => strtolower((string) $row['producerType']),
                            'organization_name' => (string) $row['organizationName'],
                            'contact_name' => (string) $row['contactName'],
                            'contact_phone' => (string) $row['contactPhone'],
                            'municipality_name' => trim((string) ($row['municipalityName'] ?? '')) !== '' ? (string) $row['municipalityName'] : $defaultMunicipality,
                            'zone_type' => strtolower((string) $row['zoneType']),
                            'product_categories' => $categories,
                            'status' => 'pending_verification',
                            'latitude' => trim((string) ($row['latitude'] ?? '')) !== '' ? (float) $row['latitude'] : null,
                            'longitude' => trim((string) ($row['longitude'] ?? '')) !== '' ? (float) $row['longitude'] : null,
                        ]
                    ));
                }

                $database->pdo()->commit();
            } catch (Throwable $error) {
                if ($database->pdo()->inTransaction()) {
                    $database->pdo()->rollBack();
                }
                throw $error;
            }

            $status = count($errors) > 0 && count($created) === 0 ? 422 : 200;
            Response::success(
                [
                    'importId' => Uuid::v4(),
                    'totalRows' => count($rows),
                    'successCount' => count($created),
                    'errorCount' => count($errors),
                    'errors' => $errors,
                    'producers' => $created,
                ],
                $status
            );
        });

        $router->get('/api/v1/producers/{id}', static function (Request $request) use ($database): void {
            $coordinateSelect = self::coordinateSelect($database, 'p');
            $row = $database->one(
                'SELECT
                    p.id,
                    p.tenant_id,
                    p.user_id,
                    p.producer_type,
                    p.organization_name,
                    p.contact_name,
                    p.contact_phone,
                    p.municipality_name,
                    p.zone_type,
                    p.product_categories::text AS product_categories,
                    p.status,
                    ' . $coordinateSelect . ',
                    p.created_at
                 FROM public.producers p
                 ' . self::coordinateJoin($database, 'producers', 'p') . '
                 WHERE p.id = :id
                   AND p.deleted_at IS NULL
                 LIMIT 1',
                ['id' => (string) $request->route('id')]
            );

            if ($row === null) {
                Response::error(404, 'PRODUCER_NOT_FOUND', 'Productor no encontrado.');
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
                    Response::error(404, 'PRODUCER_NOT_FOUND', 'Productor no encontrado.');
                }
            }

            Response::success(self::toProducerResponse($row));
        });
    }

    private static function insertProducer(Database $database, array $data): array
    {
        $hasCoordinates = self::hasCoordinates($database);

        $columns = [
            'id',
            'tenant_id',
            'user_id',
            'producer_type',
            'organization_name',
            'contact_name',
            'contact_phone',
            'municipality_name',
            'zone_type',
            'product_categories',
            'status',
        ];
        $values = [
            ':id',
            ':tenant_id',
            ':user_id',
            ':producer_type',
            ':organization_name',
            ':contact_name',
            ':contact_phone',
            ':municipality_name',
            ':zone_type',
            'CAST(:product_categories AS text[])',
            ':status',
        ];
        $returning = [
            'id',
            'tenant_id',
            'user_id',
            'producer_type',
            'organization_name',
            'contact_name',
            'contact_phone',
            'municipality_name',
            'zone_type',
            'product_categories::text AS product_categories',
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
            'INSERT INTO public.producers (' . implode(', ', $columns) . ')
             VALUES (' . implode(', ', $values) . ')
             RETURNING ' . implode(', ', $returning),
            [
                'id' => $data['id'],
                'tenant_id' => $data['tenant_id'],
                'user_id' => $data['user_id'],
                'producer_type' => $data['producer_type'],
                'organization_name' => $data['organization_name'],
                'contact_name' => $data['contact_name'],
                'contact_phone' => $data['contact_phone'],
                'municipality_name' => $data['municipality_name'],
                'zone_type' => $data['zone_type'],
                'product_categories' => self::toPgTextArray($data['product_categories']),
                'status' => $data['status'],
                'latitude' => $data['latitude'],
                'longitude' => $data['longitude'],
            ]
        );
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

    private static function findByOrganizationName(Database $database, string $tenantId, string $organizationName): ?array
    {
        return $database->one(
            'SELECT id
             FROM public.producers
             WHERE tenant_id = :tenant_id
               AND LOWER(organization_name) = LOWER(:organization_name)
               AND deleted_at IS NULL
             LIMIT 1',
            [
                'tenant_id' => $tenantId,
                'organization_name' => trim($organizationName),
            ]
        );
    }

    private static function requiredString(array $payload, string $key, int $minLength, string $code, string $message): string
    {
        $value = trim((string) ($payload[$key] ?? ''));
        if (mb_strlen($value) < $minLength) {
            Response::error(400, $code, $message);
        }

        return $value;
    }

    private static function requiredCategories(array $payload, string $code, string $message): array
    {
        $categories = $payload['productCategories'] ?? null;
        if (!is_array($categories) || $categories === []) {
            Response::error(400, $code, $message);
        }

        $normalized = [];
        foreach ($categories as $category) {
            $value = trim((string) $category);
            if (mb_strlen($value) < 2) {
                Response::error(400, $code, $message);
            }
            $normalized[] = $value;
        }

        if ($normalized === []) {
            Response::error(400, $code, $message);
        }

        return array_values($normalized);
    }

    private static function optionalCoordinates(array $payload, string $code, string $message): array
    {
        $hasLat = array_key_exists('latitude', $payload) && $payload['latitude'] !== null && $payload['latitude'] !== '';
        $hasLng = array_key_exists('longitude', $payload) && $payload['longitude'] !== null && $payload['longitude'] !== '';

        if ($hasLat !== $hasLng) {
            Response::error(400, $code, $message);
        }

        if (!$hasLat && !$hasLng) {
            return [null, null];
        }

        $latitude = filter_var($payload['latitude'], FILTER_VALIDATE_FLOAT);
        $longitude = filter_var($payload['longitude'], FILTER_VALIDATE_FLOAT);

        if ($latitude === false || $latitude < -90 || $latitude > 90 || $longitude === false || $longitude < -180 || $longitude > 180) {
            Response::error(400, $code, $message);
        }

        return [(float) $latitude, (float) $longitude];
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

    private static function toPgTextArray(array $values): string
    {
        $escaped = array_map(static function (string $value): string {
            $value = str_replace(['\\', '"'], ['\\\\', '\\"'], $value);
            return '"' . $value . '"';
        }, $values);

        return '{' . implode(',', $escaped) . '}';
    }

    private static function parsePgTextArray(mixed $value): array
    {
        if (is_array($value)) {
            return array_values(array_map(static fn (mixed $item): string => (string) $item, $value));
        }

        if (!is_string($value) || $value === '' || $value === '{}') {
            return [];
        }

        $trimmed = trim($value, '{}');
        if ($trimmed === '') {
            return [];
        }

        return array_values(array_filter(array_map(
            static fn (string $item): string => trim($item, '"'),
            str_getcsv($trimmed)
        )));
    }

    private static function toProducerResponse(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'tenantId' => (string) $row['tenant_id'],
            'userId' => $row['user_id'],
            'producerType' => (string) $row['producer_type'],
            'organizationName' => (string) $row['organization_name'],
            'contactName' => (string) $row['contact_name'],
            'contactPhone' => (string) $row['contact_phone'],
            'municipalityName' => (string) $row['municipality_name'],
            'zoneType' => (string) $row['zone_type'],
            'productCategories' => self::parsePgTextArray($row['product_categories'] ?? []),
            'status' => (string) $row['status'],
            'latitude' => $row['latitude'] !== null ? (float) $row['latitude'] : null,
            'longitude' => $row['longitude'] !== null ? (float) $row['longitude'] : null,
            'createdAt' => self::toIso($row['created_at'] ?? null),
        ];
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
        return $database->hasColumn('public.producers', 'latitude') && $database->hasColumn('public.producers', 'longitude');
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

        if ($database->relationExists('public.v_mapa_productores')) {
            return 'vm.longitud::text AS longitude, vm.latitud::text AS latitude';
        }

        return 'NULL::text AS latitude, NULL::text AS longitude';
    }

    private static function coordinateJoin(Database $database, string $tableKey, string $alias): string
    {
        if (self::hasCoordinates($database)) {
            return '';
        }

        if ($tableKey === 'producers' && $database->relationExists('public.v_mapa_productores')) {
            return 'LEFT JOIN public.v_mapa_productores vm ON vm.id = ' . $alias . '.id';
        }

        return '';
    }

    private static function parseCsvText(string $csvText): array
    {
        $lines = preg_split('/\r\n|\r|\n/', $csvText) ?: [];
        $lines = array_values(array_filter($lines, static fn (string $line): bool => trim($line) !== ''));

        if (count($lines) < 2) {
            return [[], 'El archivo debe tener al menos una fila de encabezados y una de datos.'];
        }

        $headers = array_map(static fn (string $header): string => trim($header), str_getcsv((string) $lines[0]));
        foreach (['organizationName', 'contactName', 'contactPhone', 'producerType', 'zoneType', 'productCategories'] as $required) {
            if (!in_array($required, $headers, true)) {
                return [[], 'Falta columna obligatoria: ' . $required];
            }
        }

        $rows = [];
        for ($i = 1; $i < count($lines); $i++) {
            $values = str_getcsv((string) $lines[$i]);
            $record = [];
            foreach ($headers as $index => $header) {
                $record[$header] = trim((string) ($values[$index] ?? ''));
            }
            $rows[] = $record;
        }

        return [$rows, null];
    }

    private static function validateCsvRow(array $row, int $rowIndex): array
    {
        $errors = [];

        if (mb_strlen(trim((string) ($row['organizationName'] ?? ''))) < 3) {
            $errors[] = ['row' => $rowIndex, 'field' => 'organizationName', 'message' => 'Minimo 3 caracteres.'];
        }
        if (mb_strlen(trim((string) ($row['contactName'] ?? ''))) < 3) {
            $errors[] = ['row' => $rowIndex, 'field' => 'contactName', 'message' => 'Minimo 3 caracteres.'];
        }
        if (mb_strlen(trim((string) ($row['contactPhone'] ?? ''))) < 7) {
            $errors[] = ['row' => $rowIndex, 'field' => 'contactPhone', 'message' => 'Minimo 7 caracteres.'];
        }

        if (!in_array(strtolower((string) ($row['producerType'] ?? '')), self::PRODUCER_TYPES, true)) {
            $errors[] = ['row' => $rowIndex, 'field' => 'producerType', 'message' => 'Valores: ' . implode(', ', self::PRODUCER_TYPES)];
        }
        if (!in_array(strtolower((string) ($row['zoneType'] ?? '')), self::PRODUCER_ZONES, true)) {
            $errors[] = ['row' => $rowIndex, 'field' => 'zoneType', 'message' => 'Valores: ' . implode(', ', self::PRODUCER_ZONES)];
        }

        $categories = array_values(array_filter(array_map(
            static fn (string $item): string => trim($item),
            explode(';', (string) ($row['productCategories'] ?? ''))
        ), static fn (string $item): bool => mb_strlen($item) >= 2));
        if ($categories === []) {
            $errors[] = ['row' => $rowIndex, 'field' => 'productCategories', 'message' => 'Al menos una categoria separada por ;.'];
        }

        $hasLat = trim((string) ($row['latitude'] ?? '')) !== '';
        $hasLng = trim((string) ($row['longitude'] ?? '')) !== '';
        if ($hasLat !== $hasLng) {
            $errors[] = ['row' => $rowIndex, 'field' => 'coordinates', 'message' => 'Latitude y longitude deben enviarse juntas.'];
        }

        if ($hasLat && $hasLng) {
            $lat = filter_var($row['latitude'], FILTER_VALIDATE_FLOAT);
            $lng = filter_var($row['longitude'], FILTER_VALIDATE_FLOAT);
            if ($lat === false || $lat < -90 || $lat > 90) {
                $errors[] = ['row' => $rowIndex, 'field' => 'latitude', 'message' => 'Debe estar entre -90 y 90.'];
            }
            if ($lng === false || $lng < -180 || $lng > 180) {
                $errors[] = ['row' => $rowIndex, 'field' => 'longitude', 'message' => 'Debe estar entre -180 y 180.'];
            }
        }

        return $errors;
    }
}
