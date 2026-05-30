<?php
declare(strict_types=1);

namespace Agrored\Modules\Inventory;

use Agrored\Database\Database;
use Agrored\Http\Request;
use Agrored\Http\Response;
use Agrored\Http\Router;
use Agrored\Support\Uuid;
use DateTimeImmutable;
use RuntimeException;
use Throwable;

final class InventoryModule
{
    private const SOURCE_TYPES = ['offer_stock', 'rescued_stock', 'buffer_stock'];

    public static function register(Router $router, Database $database): void
    {
        $router->post('/api/v1/inventory/register', static function (Request $request) use ($database): void {
            $payload = $request->body();

            $tenantKey = self::requiredString($payload, 'tenantId', 1, 'INVALID_INVENTORY_PAYLOAD', 'Payload invalido para registro de inventario.');
            $producerId = self::requiredUuid($payload, 'producerId', 'INVALID_INVENTORY_PAYLOAD', 'Payload invalido para registro de inventario.');
            $offerId = self::optionalUuid($payload, 'offerId', 'INVALID_INVENTORY_PAYLOAD', 'Payload invalido para registro de inventario.');
            $rescueId = self::optionalUuid($payload, 'rescueId', 'INVALID_INVENTORY_PAYLOAD', 'Payload invalido para registro de inventario.');
            $sourceType = strtolower(self::requiredString($payload, 'sourceType', 1, 'INVALID_INVENTORY_PAYLOAD', 'Payload invalido para registro de inventario.'));
            $storageLocationName = self::requiredString($payload, 'storageLocationName', 3, 'INVALID_INVENTORY_PAYLOAD', 'Payload invalido para registro de inventario.');
            $productName = self::requiredString($payload, 'productName', 2, 'INVALID_INVENTORY_PAYLOAD', 'Payload invalido para registro de inventario.');
            $category = self::requiredString($payload, 'category', 2, 'INVALID_INVENTORY_PAYLOAD', 'Payload invalido para registro de inventario.');
            $unit = self::requiredString($payload, 'unit', 1, 'INVALID_INVENTORY_PAYLOAD', 'Payload invalido para registro de inventario.');
            $quantityOnHand = self::requiredPositiveFloat($payload, 'quantityOnHand', 'INVALID_INVENTORY_PAYLOAD', 'Payload invalido para registro de inventario.');
            $quantityReserved = self::optionalNonNegativeFloat($payload, 'quantityReserved', 'INVALID_INVENTORY_PAYLOAD', 'Payload invalido para registro de inventario.') ?? 0.0;
            $municipalityName = self::requiredString($payload, 'municipalityName', 3, 'INVALID_INVENTORY_PAYLOAD', 'Payload invalido para registro de inventario.');
            $notes = self::optionalString($payload, 'notes', 500, 'INVALID_INVENTORY_PAYLOAD', 'Payload invalido para registro de inventario.');
            $expiresAt = self::optionalDate($payload, 'expiresAt', 'INVALID_INVENTORY_PAYLOAD', 'Payload invalido para registro de inventario.');
            [$latitude, $longitude] = self::optionalCoordinates($payload, 'INVALID_INVENTORY_PAYLOAD', 'Payload invalido para registro de inventario.');

            if (!in_array($sourceType, self::SOURCE_TYPES, true)) {
                Response::error(400, 'INVALID_INVENTORY_PAYLOAD', 'Payload invalido para registro de inventario.');
            }

            if ($sourceType === 'offer_stock' && $offerId === null) {
                Response::error(400, 'INVALID_INVENTORY_SOURCE_LINK', 'El tipo de origen exige una referencia valida a oferta o rescate.');
            }

            if ($sourceType === 'rescued_stock' && $rescueId === null) {
                Response::error(400, 'INVALID_INVENTORY_SOURCE_LINK', 'El tipo de origen exige una referencia valida a oferta o rescate.');
            }

            if ($quantityReserved > $quantityOnHand) {
                Response::error(400, 'INVALID_INVENTORY_QUANTITY_BALANCE', 'La reserva no puede ser negativa ni superar el stock disponible.');
            }

            try {
                $tenantId = self::resolveTenantId($database, $tenantKey);
                $resolvedProducerId = self::resolveProducerId($database, $producerId, $tenantId);
                $resolvedOfferId = $offerId !== null ? self::resolveOfferId($database, $offerId, $tenantId, $resolvedProducerId) : null;
                $resolvedRescueId = $rescueId !== null ? self::resolveRescueId($database, $rescueId, $tenantId, $resolvedProducerId, $resolvedOfferId) : null;

                $row = self::insertInventoryItem(
                    $database,
                    [
                        'id' => Uuid::v4(),
                        'tenant_id' => $tenantId,
                        'producer_id' => $resolvedProducerId,
                        'offer_id' => $resolvedOfferId,
                        'rescue_id' => $resolvedRescueId,
                        'source_type' => $sourceType,
                        'storage_location_name' => $storageLocationName,
                        'product_name' => $productName,
                        'category' => $category,
                        'unit' => $unit,
                        'quantity_on_hand' => $quantityOnHand,
                        'quantity_reserved' => $quantityReserved,
                        'municipality_name' => $municipalityName,
                        'notes' => $notes,
                        'expires_at' => $expiresAt,
                        'latitude' => $latitude,
                        'longitude' => $longitude,
                        'status' => abs($quantityReserved - $quantityOnHand) < 0.00001 ? 'reserved' : 'available',
                    ]
                );

                Response::success(self::toInventoryResponse($row), 201);
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                if ($error->getMessage() === 'PRODUCER_NOT_FOUND_FOR_TENANT') {
                    Response::error(404, 'PRODUCER_NOT_FOUND_FOR_TENANT', 'El productor no existe para el municipio indicado.');
                }
                if ($error->getMessage() === 'OFFER_NOT_FOUND_FOR_PRODUCER') {
                    Response::error(404, 'OFFER_NOT_FOUND_FOR_PRODUCER', 'La oferta asociada no existe para el productor y municipio indicados.');
                }
                if ($error->getMessage() === 'RESCUE_NOT_FOUND_FOR_SOURCE') {
                    Response::error(404, 'RESCUE_NOT_FOUND_FOR_SOURCE', 'El rescate asociado no existe para el productor y municipio indicados.');
                }
                throw $error;
            }
        });

        $router->get('/api/v1/inventory/near-expiry/{tenantId}', static function (Request $request) use ($database): void {
            $page = self::page($request);
            $limit = self::limit($request);
            $daysAhead = min(365, max(1, (int) ($request->query('days', 7) ?? 7)));

            try {
                $tenantId = self::resolveTenantId($database, (string) $request->route('tenantId'));
                $result = self::listNearExpiry($database, $tenantId, $daysAhead, $page, $limit);

                Response::paginated(
                    array_map([self::class, 'toInventoryResponse'], $result['data']),
                    ['total' => $result['total'], 'page' => $page, 'limit' => $limit]
                );
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }
        });

        $router->get('/api/v1/inventory', static function (Request $request) use ($database): void {
            $page = self::page($request);
            $limit = self::limit($request);
            $tenantHeader = trim((string) ($request->header('x-tenant-id', '') ?? ''));

            try {
                $tenantId = $tenantHeader !== '' ? self::resolveTenantId($database, $tenantHeader) : null;
                $result = self::listInventory($database, $page, $limit, $tenantId);

                Response::paginated(
                    array_map([self::class, 'toInventoryResponse'], $result['data']),
                    ['total' => $result['total'], 'page' => $page, 'limit' => $limit]
                );
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }
        });

        $router->post('/api/v1/inventory/import/csv', static function (Request $request) use ($database): void {
            $payload = $request->body();
            $tenantKey = self::requiredString($payload, 'tenantId', 1, 'INVALID_CSV_PAYLOAD', 'Payload invalido para importacion CSV.');
            $producerId = self::requiredUuid($payload, 'producerId', 'INVALID_CSV_PAYLOAD', 'Payload invalido para importacion CSV.');
            $municipalityName = self::requiredString($payload, 'municipalityName', 3, 'INVALID_CSV_PAYLOAD', 'Payload invalido para importacion CSV.');
            $csvText = self::requiredString($payload, 'csvText', 10, 'INVALID_CSV_PAYLOAD', 'Payload invalido para importacion CSV.');

            try {
                $tenantId = self::resolveTenantId($database, $tenantKey);
                $resolvedProducerId = self::resolveProducerId($database, $producerId, $tenantId);
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                if ($error->getMessage() === 'PRODUCER_NOT_FOUND_FOR_TENANT') {
                    Response::error(404, 'PRODUCER_NOT_FOUND_FOR_TENANT', 'El productor no existe para el municipio indicado.');
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
                        'items' => [],
                    ],
                    422
                );
            }

            $created = [];
            $errors = [];

            $database->pdo()->beginTransaction();
            try {
                foreach ($rows as $index => $row) {
                    $rowNumber = $index + 2;
                    $validationErrors = self::validateCsvRow($row, $rowNumber);
                    if ($validationErrors !== []) {
                        $errors = array_merge($errors, $validationErrors);
                        continue;
                    }

                    $sourceType = trim((string) ($row['sourceType'] ?? '')) !== '' ? strtolower((string) $row['sourceType']) : 'buffer_stock';
                    $expiresAt = new DateTimeImmutable((string) $row['expiresAt']);

                    $created[] = self::toInventoryResponse(self::insertInventoryItem(
                        $database,
                        [
                            'id' => Uuid::v4(),
                            'tenant_id' => $tenantId,
                            'producer_id' => $resolvedProducerId,
                            'offer_id' => null,
                            'rescue_id' => null,
                            'source_type' => $sourceType,
                            'storage_location_name' => (string) $row['storageLocationName'],
                            'product_name' => (string) $row['productName'],
                            'category' => (string) $row['category'],
                            'unit' => (string) $row['unit'],
                            'quantity_on_hand' => (float) $row['quantityOnHand'],
                            'quantity_reserved' => 0.0,
                            'municipality_name' => $municipalityName,
                            'notes' => trim((string) ($row['notes'] ?? '')) !== '' ? (string) $row['notes'] : null,
                            'expires_at' => $expiresAt,
                            'latitude' => trim((string) ($row['latitude'] ?? '')) !== '' ? (float) $row['latitude'] : null,
                            'longitude' => trim((string) ($row['longitude'] ?? '')) !== '' ? (float) $row['longitude'] : null,
                            'status' => 'available',
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
                    'items' => $created,
                ],
                $status
            );
        });

        $router->get('/api/v1/inventory/{id}', static function (Request $request) use ($database): void {
            $row = self::findInventoryById($database, (string) $request->route('id'));
            if ($row === null) {
                Response::error(404, 'INVENTORY_ITEM_NOT_FOUND', 'Registro de inventario no encontrado.');
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
                    Response::error(404, 'INVENTORY_ITEM_NOT_FOUND', 'Registro de inventario no encontrado.');
                }
            }

            Response::success(self::toInventoryResponse($row));
        });
    }

    private static function insertInventoryItem(Database $database, array $data): array
    {
        $hasCoordinates = self::hasCoordinates($database);
        $hasExpiresAt = self::hasExpiresAt($database);
        $metadata = self::buildMetadata($data, $hasCoordinates, $hasExpiresAt);

        $columns = [
            'id',
            'tenant_id',
            'producer_id',
            'offer_id',
            'rescue_id',
            'source_type',
            'storage_location_name',
            'product_name',
            'category',
            'unit',
            'quantity_on_hand',
            'quantity_reserved',
            'municipality_name',
            'notes',
            'status',
            'metadata',
        ];
        $values = [
            ':id',
            ':tenant_id',
            ':producer_id',
            ':offer_id',
            ':rescue_id',
            ':source_type',
            ':storage_location_name',
            ':product_name',
            ':category',
            ':unit',
            ':quantity_on_hand',
            ':quantity_reserved',
            ':municipality_name',
            ':notes',
            ':status',
            'CAST(:metadata AS jsonb)',
        ];
        $returning = [
            'id',
            'tenant_id',
            'producer_id',
            'offer_id',
            'rescue_id',
            'source_type',
            'storage_location_name',
            'product_name',
            'category',
            'unit',
            'quantity_on_hand',
            'quantity_reserved',
            'municipality_name',
            'notes',
            'status',
            'metadata::text AS metadata',
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

        if ($hasExpiresAt) {
            $columns[] = 'expires_at';
            $values[] = ':expires_at';
            $returning[] = 'expires_at';
        } else {
            $returning[] = 'NULL::text AS expires_at';
        }

        $params = [
            'id' => $data['id'],
            'tenant_id' => $data['tenant_id'],
            'producer_id' => $data['producer_id'],
            'offer_id' => $data['offer_id'],
            'rescue_id' => $data['rescue_id'],
            'source_type' => $data['source_type'],
            'storage_location_name' => $data['storage_location_name'],
            'product_name' => $data['product_name'],
            'category' => $data['category'],
            'unit' => $data['unit'],
            'quantity_on_hand' => $data['quantity_on_hand'],
            'quantity_reserved' => $data['quantity_reserved'],
            'municipality_name' => $data['municipality_name'],
            'notes' => $data['notes'],
            'status' => $data['status'],
            'metadata' => json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}',
        ];

        if ($hasCoordinates) {
            $params['latitude'] = $data['latitude'];
            $params['longitude'] = $data['longitude'];
        }

        if ($hasExpiresAt) {
            $params['expires_at'] = $data['expires_at'] instanceof DateTimeImmutable ? $data['expires_at']->format(DATE_ATOM) : null;
        }

        return (array) $database->one(
            'INSERT INTO public.inventory_items (' . implode(', ', $columns) . ')
             VALUES (' . implode(', ', $values) . ')
             RETURNING ' . implode(', ', $returning),
            $params
        );
    }

    private static function listInventory(Database $database, int $page, int $limit, ?string $tenantId): array
    {
        $where = 'i.deleted_at IS NULL';
        $params = [];

        if ($tenantId !== null) {
            $where .= ' AND i.tenant_id = :tenant_id';
            $params['tenant_id'] = $tenantId;
        }

        $total = (int) $database->scalar(
            'SELECT COUNT(*) FROM public.inventory_items i WHERE ' . $where,
            $params
        );

        $rows = $database->all(
            'SELECT
                i.id,
                i.tenant_id,
                i.producer_id,
                i.offer_id,
                i.rescue_id,
                i.source_type,
                i.storage_location_name,
                i.product_name,
                i.category,
                i.unit,
                i.quantity_on_hand,
                i.quantity_reserved,
                i.municipality_name,
                i.notes,
                i.status,
                i.metadata::text AS metadata,
                ' . self::latitudeSelect($database, 'i') . ',
                ' . self::longitudeSelect($database, 'i') . ',
                ' . self::expiresAtSelect($database, 'i') . ',
                i.created_at
             FROM public.inventory_items i
             WHERE ' . $where . '
             ORDER BY i.created_at DESC
             LIMIT :limit OFFSET :offset',
            array_merge($params, [
                'limit' => $limit,
                'offset' => ($page - 1) * $limit,
            ])
        );

        return ['data' => $rows, 'total' => $total];
    }

    private static function listNearExpiry(Database $database, string $tenantId, int $daysAhead, int $page, int $limit): array
    {
        $expiryExpression = self::expiryFilterExpression($database, 'i');
        $params = [
            'tenant_id' => $tenantId,
            'days_interval' => $daysAhead . ' days',
        ];

        $where = 'i.deleted_at IS NULL
            AND i.tenant_id = :tenant_id
            AND i.status IN (\'available\', \'reserved\')
            AND ' . $expiryExpression . ' IS NOT NULL
            AND ' . $expiryExpression . ' BETWEEN NOW() AND NOW() + CAST(:days_interval AS interval)';

        $total = (int) $database->scalar(
            'SELECT COUNT(*) FROM public.inventory_items i WHERE ' . $where,
            $params
        );

        $rows = $database->all(
            'SELECT
                i.id,
                i.tenant_id,
                i.producer_id,
                i.offer_id,
                i.rescue_id,
                i.source_type,
                i.storage_location_name,
                i.product_name,
                i.category,
                i.unit,
                i.quantity_on_hand,
                i.quantity_reserved,
                i.municipality_name,
                i.notes,
                i.status,
                i.metadata::text AS metadata,
                ' . self::latitudeSelect($database, 'i') . ',
                ' . self::longitudeSelect($database, 'i') . ',
                ' . self::expiresAtSelect($database, 'i') . ',
                i.created_at
             FROM public.inventory_items i
             WHERE ' . $where . '
             ORDER BY ' . $expiryExpression . ' ASC
             LIMIT :limit OFFSET :offset',
            array_merge($params, [
                'limit' => $limit,
                'offset' => ($page - 1) * $limit,
            ])
        );

        return ['data' => $rows, 'total' => $total];
    }

    private static function findInventoryById(Database $database, string $id): ?array
    {
        return $database->one(
            'SELECT
                i.id,
                i.tenant_id,
                i.producer_id,
                i.offer_id,
                i.rescue_id,
                i.source_type,
                i.storage_location_name,
                i.product_name,
                i.category,
                i.unit,
                i.quantity_on_hand,
                i.quantity_reserved,
                i.municipality_name,
                i.notes,
                i.status,
                i.metadata::text AS metadata,
                ' . self::latitudeSelect($database, 'i') . ',
                ' . self::longitudeSelect($database, 'i') . ',
                ' . self::expiresAtSelect($database, 'i') . ',
                i.created_at
             FROM public.inventory_items i
             WHERE i.id = :id
               AND i.deleted_at IS NULL
             LIMIT 1',
            ['id' => $id]
        );
    }

    private static function buildMetadata(array $data, bool $hasCoordinates, bool $hasExpiresAt): array
    {
        $metadata = [];

        if (!$hasCoordinates) {
            if ($data['latitude'] !== null) {
                $metadata['latitude'] = (float) $data['latitude'];
            }
            if ($data['longitude'] !== null) {
                $metadata['longitude'] = (float) $data['longitude'];
            }
        }

        if (!$hasExpiresAt && $data['expires_at'] instanceof DateTimeImmutable) {
            $metadata['expiresAt'] = $data['expires_at']->format(DATE_ATOM);
        }

        return $metadata;
    }

    private static function toInventoryResponse(array $row): array
    {
        $metadata = self::decodeJson($row['metadata'] ?? '{}');
        $latitude = $row['latitude'] ?? ($metadata['latitude'] ?? null);
        $longitude = $row['longitude'] ?? ($metadata['longitude'] ?? null);
        $expiresAt = $row['expires_at'] ?? ($metadata['expiresAt'] ?? null);

        return [
            'id' => (string) $row['id'],
            'tenantId' => (string) $row['tenant_id'],
            'producerId' => (string) $row['producer_id'],
            'offerId' => $row['offer_id'],
            'rescueId' => $row['rescue_id'],
            'sourceType' => (string) $row['source_type'],
            'storageLocationName' => (string) $row['storage_location_name'],
            'productName' => (string) $row['product_name'],
            'category' => (string) $row['category'],
            'unit' => (string) $row['unit'],
            'quantityOnHand' => (float) $row['quantity_on_hand'],
            'quantityReserved' => (float) $row['quantity_reserved'],
            'municipalityName' => (string) $row['municipality_name'],
            'notes' => $row['notes'],
            'expiresAt' => self::toIso($expiresAt),
            'status' => (string) $row['status'],
            'latitude' => $latitude !== null ? (float) $latitude : null,
            'longitude' => $longitude !== null ? (float) $longitude : null,
            'createdAt' => self::toIso($row['created_at'] ?? null),
        ];
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

    private static function resolveRescueId(
        Database $database,
        string $rescueId,
        string $tenantId,
        string $producerId,
        ?string $offerId
    ): string {
        $row = $database->one(
            'SELECT id
             FROM public.rescues
             WHERE id = :rescue_id
               AND tenant_id = :tenant_id
               AND producer_id = :producer_id
               AND (:offer_id IS NULL OR offer_id = :offer_id)
               AND deleted_at IS NULL
             LIMIT 1',
            [
                'rescue_id' => $rescueId,
                'tenant_id' => $tenantId,
                'producer_id' => $producerId,
                'offer_id' => $offerId,
            ]
        );

        if ($row === null || !isset($row['id'])) {
            throw new RuntimeException('RESCUE_NOT_FOUND_FOR_SOURCE');
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

    private static function optionalNonNegativeFloat(array $payload, string $key, string $code, string $message): ?float
    {
        if (!array_key_exists($key, $payload) || $payload[$key] === null || $payload[$key] === '') {
            return null;
        }

        $value = filter_var($payload[$key], FILTER_VALIDATE_FLOAT);
        if ($value === false || $value < 0) {
            Response::error(400, $code, $message);
        }

        return (float) $value;
    }

    private static function optionalDate(array $payload, string $key, string $code, string $message): ?DateTimeImmutable
    {
        if (!array_key_exists($key, $payload) || $payload[$key] === null || $payload[$key] === '') {
            return null;
        }

        try {
            return new DateTimeImmutable((string) $payload[$key]);
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

    private static function page(Request $request): int
    {
        return max(1, (int) ($request->query('page', 1) ?? 1));
    }

    private static function limit(Request $request): int
    {
        return min(100, max(1, (int) ($request->query('limit', 20) ?? 20)));
    }

    private static function hasCoordinates(Database $database): bool
    {
        return true;
    }

    private static function hasExpiresAt(Database $database): bool
    {
        return true;
    }

    private static function latitudeSelect(Database $database, string $alias): string
    {
        if (self::hasCoordinates($database)) {
            return $alias . '.latitude::text AS latitude';
        }

        return 'NULLIF(' . $alias . '.metadata->>\'latitude\', \'\') AS latitude';
    }

    private static function longitudeSelect(Database $database, string $alias): string
    {
        if (self::hasCoordinates($database)) {
            return $alias . '.longitude::text AS longitude';
        }

        return 'NULLIF(' . $alias . '.metadata->>\'longitude\', \'\') AS longitude';
    }

    private static function expiresAtSelect(Database $database, string $alias): string
    {
        if (self::hasExpiresAt($database)) {
            return $alias . '.expires_at';
        }

        return 'NULLIF(' . $alias . '.metadata->>\'expiresAt\', \'\') AS expires_at';
    }

    private static function expiryFilterExpression(Database $database, string $alias): string
    {
        if (self::hasExpiresAt($database)) {
            return $alias . '.expires_at';
        }

        return 'NULLIF(' . $alias . '.metadata->>\'expiresAt\', \'\')::timestamptz';
    }

    private static function decodeJson(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }

        if (!is_string($value) || $value === '') {
            return [];
        }

        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : [];
    }

    private static function toIso(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (new DateTimeImmutable((string) $value))->format(DATE_ATOM);
    }

    private static function isUuid(string $value): bool
    {
        return preg_match('/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/', $value) === 1;
    }

    private static function parseCsvText(string $csvText): array
    {
        $lines = preg_split('/\r\n|\r|\n/', $csvText) ?: [];
        $lines = array_values(array_filter($lines, static fn (string $line): bool => trim($line) !== ''));

        if (count($lines) < 2) {
            return [[], 'El archivo debe tener al menos una fila de encabezados y una de datos.'];
        }

        $headers = array_map(static fn (string $header): string => trim($header), str_getcsv((string) $lines[0]));
        foreach (['productName', 'category', 'unit', 'quantityOnHand', 'storageLocationName', 'expiresAt'] as $required) {
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

        if (mb_strlen(trim((string) ($row['productName'] ?? ''))) < 2) {
            $errors[] = ['row' => $rowIndex, 'field' => 'productName', 'message' => 'Minimo 2 caracteres.'];
        }
        if (mb_strlen(trim((string) ($row['category'] ?? ''))) < 2) {
            $errors[] = ['row' => $rowIndex, 'field' => 'category', 'message' => 'Minimo 2 caracteres.'];
        }
        if (trim((string) ($row['unit'] ?? '')) === '') {
            $errors[] = ['row' => $rowIndex, 'field' => 'unit', 'message' => 'Requerido.'];
        }

        $quantity = filter_var($row['quantityOnHand'] ?? null, FILTER_VALIDATE_FLOAT);
        if ($quantity === false || $quantity <= 0) {
            $errors[] = ['row' => $rowIndex, 'field' => 'quantityOnHand', 'message' => 'Debe ser un numero positivo.'];
        }

        if (mb_strlen(trim((string) ($row['storageLocationName'] ?? ''))) < 3) {
            $errors[] = ['row' => $rowIndex, 'field' => 'storageLocationName', 'message' => 'Minimo 3 caracteres.'];
        }

        try {
            new DateTimeImmutable((string) ($row['expiresAt'] ?? ''));
        } catch (Throwable) {
            $errors[] = ['row' => $rowIndex, 'field' => 'expiresAt', 'message' => 'Fecha invalida. Use formato ISO 8601.'];
        }

        $sourceType = trim((string) ($row['sourceType'] ?? ''));
        if ($sourceType !== '' && !in_array(strtolower($sourceType), self::SOURCE_TYPES, true)) {
            $errors[] = ['row' => $rowIndex, 'field' => 'sourceType', 'message' => 'Valores permitidos: ' . implode(', ', self::SOURCE_TYPES)];
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
