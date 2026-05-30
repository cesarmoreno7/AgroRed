<?php
declare(strict_types=1);

namespace Agrored\Modules\Logistics;

use Agrored\Database\Database;
use Agrored\Http\Request;
use Agrored\Http\Response;
use Agrored\Http\Router;
use Agrored\Support\Uuid;
use RuntimeException;

final class LogisticsModule
{
    private const GEOFENCE_TYPES = ['delivery', 'restricted', 'warehouse', 'critical'];

    public static function register(Router $router, Database $database): void
    {
        // ── ACTIVE TRACKING POSITIONS ──
        $router->get('/api/v1/logistics/tracking/active', static function (Request $request) use ($database): void {
            $tenantKey = trim((string) ($request->query('tenantId', '') ?? ''));
            try {
                Response::success(self::activePositions($database, $tenantKey !== '' ? $tenantKey : null));
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }
        });

        // ── GEOFENCE CREATION ──
        $router->post('/api/v1/logistics/geofences', static function (Request $request) use ($database): void {
            $payload = $request->body();
            $tenantKey = trim((string) ($payload['tenantId'] ?? ''));
            $zoneName = trim((string) ($payload['zoneName'] ?? ''));
            $zoneType = strtolower(trim((string) ($payload['zoneType'] ?? 'delivery')));
            $centerLat = filter_var($payload['centerLat'] ?? null, FILTER_VALIDATE_FLOAT);
            $centerLng = filter_var($payload['centerLng'] ?? null, FILTER_VALIDATE_FLOAT);
            $radiusM = filter_var($payload['radiusM'] ?? null, FILTER_VALIDATE_FLOAT);
            $metadata = is_array($payload['metadata'] ?? null) ? $payload['metadata'] : [];

            if (
                $tenantKey === '' ||
                $zoneName === '' ||
                !in_array($zoneType, self::GEOFENCE_TYPES, true) ||
                $centerLat === false || $centerLat < -90 || $centerLat > 90 ||
                $centerLng === false || $centerLng < -180 || $centerLng > 180 ||
                $radiusM === false || $radiusM < 10 || $radiusM > 50000
            ) {
                Response::error(400, 'INVALID_GEOFENCE_PAYLOAD', 'Payload invalido para crear geocerca.');
            }

            try {
                self::ensureGeofenceSchema($database);
                $zone = self::createGeofence(
                    $database,
                    $tenantKey,
                    $zoneName,
                    $zoneType,
                    (float) $centerLat,
                    (float) $centerLng,
                    (float) $radiusM,
                    $metadata
                );
                Response::success($zone, 201);
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                if ($error->getMessage() === 'GEOFENCE_SCHEMA_MISSING') {
                    Response::error(503, 'GEOFENCE_SCHEMA_MISSING', 'La tabla geofence_zones no existe. Ejecute infra/postgres/010_remaining_gaps.sql.');
                }
                throw $error;
            }
        });

        // ── LIST GEOFENCES ──
        $router->get('/api/v1/logistics/geofences', static function (Request $request) use ($database): void {
            $tenantKey = trim((string) ($request->query('tenantId', '') ?? ''));
            if ($tenantKey === '') {
                Response::error(400, 'MISSING_TENANT', 'Se requiere tenantId.');
            }

            try {
                self::ensureGeofenceSchema($database);
                Response::success(self::listGeofences($database, $tenantKey));
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                if ($error->getMessage() === 'GEOFENCE_SCHEMA_MISSING') {
                    Response::error(503, 'GEOFENCE_SCHEMA_MISSING', 'La tabla geofence_zones no existe. Ejecute infra/postgres/010_remaining_gaps.sql.');
                }
                throw $error;
            }
        });

        // ── CHECK GEOFENCES FOR POINT ──
        $router->post('/api/v1/logistics/geofences/check', static function (Request $request) use ($database): void {
            $payload = $request->body();
            $tenantKey = trim((string) ($payload['tenantId'] ?? ''));
            $latitude = filter_var($payload['latitude'] ?? null, FILTER_VALIDATE_FLOAT);
            $longitude = filter_var($payload['longitude'] ?? null, FILTER_VALIDATE_FLOAT);

            if (
                $tenantKey === '' ||
                $latitude === false || $latitude < -90 || $latitude > 90 ||
                $longitude === false || $longitude < -180 || $longitude > 180
            ) {
                Response::error(400, 'INVALID_CHECK_PAYLOAD', 'Payload invalido. Se requiere tenantId, latitude, longitude.');
            }

            try {
                self::ensureGeofenceSchema($database);
                $zones = self::checkGeofences($database, $tenantKey, (float) $latitude, (float) $longitude);
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                if ($error->getMessage() === 'GEOFENCE_SCHEMA_MISSING') {
                    Response::error(503, 'GEOFENCE_SCHEMA_MISSING', 'La tabla geofence_zones no existe. Ejecute infra/postgres/010_remaining_gaps.sql.');
                }
                throw $error;
            }

            $inside = array_values(array_filter($zones, static fn (array $zone): bool => $zone['isInside'] === true));
            Response::success([
                'totalZones' => count($zones),
                'insideZones' => count($inside),
                'zones' => $zones,
            ]);
        });

        // ── REGISTER LOGISTICS ORDER ──
        $router->post('/api/v1/logistics/register', static function (Request $request) use ($database): void {
            $payload = $request->body();

            $tenantKey = self::requiredString($payload, 'tenantId', 1, 'INVALID_LOGISTICS_PAYLOAD', 'Payload invalido para registro de logistica.');
            $inventoryItemId = self::requiredUuid($payload, 'inventoryItemId', 'INVALID_LOGISTICS_PAYLOAD', 'Payload invalido para registro de logistica.');
            $demandId = self::optionalUuid($payload, 'demandId', 'INVALID_LOGISTICS_PAYLOAD', 'Payload invalido para registro de logistica.');
            $routeMode = self::requiredString($payload, 'routeMode', 1, 'INVALID_LOGISTICS_PAYLOAD', 'Payload invalido para registro de logistica.');
            $originLocationName = self::requiredString($payload, 'originLocationName', 1, 'INVALID_LOGISTICS_PAYLOAD', 'Payload invalido para registro de logistica.');
            $destinationOrganizationName = self::requiredString($payload, 'destinationOrganizationName', 1, 'INVALID_LOGISTICS_PAYLOAD', 'Payload invalido para registro de logistica.');
            $destinationAddress = self::requiredString($payload, 'destinationAddress', 1, 'INVALID_LOGISTICS_PAYLOAD', 'Payload invalido para registro de logistica.');
            $municipalityName = self::requiredString($payload, 'municipalityName', 1, 'INVALID_LOGISTICS_PAYLOAD', 'Payload invalido para registro de logistica.');
            $quantityAssigned = self::requiredPositiveFloat($payload, 'quantityAssigned', 'INVALID_LOGISTICS_PAYLOAD', 'Payload invalido para registro de logistica.');
            $notes = self::optionalString($payload, 'notes', 1000, 'INVALID_LOGISTICS_PAYLOAD', 'Payload invalido para registro de logistica.');
            
            $originLatitude = self::optionalFloat($payload, 'originLatitude');
            $originLongitude = self::optionalFloat($payload, 'originLongitude');
            $destinationLatitude = self::optionalFloat($payload, 'destinationLatitude');
            $destinationLongitude = self::optionalFloat($payload, 'destinationLongitude');

            $scheduledPickupAt = self::requiredDate($payload, 'scheduledPickupAt', 'INVALID_LOGISTICS_PAYLOAD', 'Payload invalido para registro de logistica.');
            $scheduledDeliveryAt = self::requiredDate($payload, 'scheduledDeliveryAt', 'INVALID_LOGISTICS_PAYLOAD', 'Payload invalido para registro de logistica.');

            if ($scheduledDeliveryAt < $scheduledPickupAt) {
                Response::error(400, 'INVALID_LOGISTICS_SCHEDULE', 'La fecha de entrega debe ser posterior a la fecha de recogida.');
            }

            try {
                $tenantId = self::resolveTenantId($database, $tenantKey);
                
                // Verify inventory item
                $inv = $database->one(
                    'SELECT id, quantity_on_hand, quantity_reserved
                     FROM public.inventory_items
                     WHERE id = :id AND tenant_id = :tenant_id AND deleted_at IS NULL
                     LIMIT 1',
                    ['id' => $inventoryItemId, 'tenant_id' => $tenantId]
                );

                if ($inv === null) {
                    Response::error(404, 'INVENTORY_ITEM_NOT_FOUND_FOR_TENANT', 'El item de inventario no existe para el municipio indicado.');
                }

                $available = (float) $inv['quantity_on_hand'] - (float) $inv['quantity_reserved'];
                if ($available < $quantityAssigned) {
                    Response::error(400, 'INSUFFICIENT_INVENTORY_AVAILABLE', 'No hay stock disponible suficiente.');
                }

                // Verify demand if present
                if ($demandId !== null) {
                    $dem = $database->one(
                        'SELECT id FROM public.demands WHERE id = :id AND tenant_id = :tenant_id AND deleted_at IS NULL LIMIT 1',
                        ['id' => $demandId, 'tenant_id' => $tenantId]
                    );
                    if ($dem === null) {
                        Response::error(404, 'DEMAND_NOT_FOUND_FOR_TENANT', 'La demanda indicada no existe.');
                    }
                }

                $orderId = Uuid::v4();

                $database->pdo()->beginTransaction();
                
                // Insert logistics order
                $database->execute(
                    'INSERT INTO public.logistics_orders (
                        id, tenant_id, inventory_item_id, demand_id, route_mode,
                        origin_location_name, destination_organization_name, destination_address,
                        scheduled_pickup_at, scheduled_delivery_at, quantity_assigned,
                        municipality_name, notes, status, origin_latitude, origin_longitude,
                        destination_latitude, destination_longitude, created_at, updated_at
                     ) VALUES (
                        :id, :tenant_id, :inventory_item_id, :demand_id, :route_mode,
                        :origin_location_name, :destination_organization_name, :destination_address,
                        :scheduled_pickup_at, :scheduled_delivery_at, :quantity_assigned,
                        :municipality_name, :notes, \'scheduled\', :origin_latitude, :origin_longitude,
                        :destination_latitude, :destination_longitude, NOW(), NOW()
                     )',
                    [
                        'id' => $orderId,
                        'tenant_id' => $tenantId,
                        'inventory_item_id' => $inventoryItemId,
                        'demand_id' => $demandId,
                        'route_mode' => $routeMode,
                        'origin_location_name' => $originLocationName,
                        'destination_organization_name' => $destinationOrganizationName,
                        'destination_address' => $destinationAddress,
                        'scheduled_pickup_at' => $scheduledPickupAt->format(DATE_ATOM),
                        'scheduled_delivery_at' => $scheduledDeliveryAt->format(DATE_ATOM),
                        'quantity_assigned' => $quantityAssigned,
                        'municipality_name' => $municipalityName,
                        'notes' => $notes,
                        'origin_latitude' => $originLatitude,
                        'origin_longitude' => $originLongitude,
                        'destination_latitude' => $destinationLatitude,
                        'destination_longitude' => $destinationLongitude,
                    ]
                );

                $row = $database->one(
                    'SELECT * FROM public.logistics_orders WHERE id = :id LIMIT 1',
                    ['id' => $orderId]
                );

                $database->pdo()->commit();

                Response::success(self::toLogisticsResponse($row), 201);

            } catch (\Exception $error) {
                if ($database->pdo()->inTransaction()) {
                    $database->pdo()->rollBack();
                }
                throw $error;
            }
        });

        // ── LIST LOGISTICS ORDERS ──
        $router->get('/api/v1/logistics', static function (Request $request) use ($database): void {
            $page = max(1, (int) ($request->query('page', 1) ?? 1));
            $limit = min(100, max(1, (int) ($request->query('limit', 20) ?? 20)));
            $tenantKey = trim((string) ($request->header('x-tenant-id', '') ?? $request->query('tenantId', '')));
            
            try {
                $tenantId = $tenantKey !== '' ? self::resolveTenantId($database, $tenantKey) : null;
                
                $where = 'deleted_at IS NULL';
                $params = [];
                if ($tenantId !== null) {
                    $where .= ' AND tenant_id = :tenant_id';
                    $params['tenant_id'] = $tenantId;
                }

                $total = (int) $database->scalar(
                    'SELECT COUNT(*) FROM public.logistics_orders WHERE ' . $where,
                    $params
                );

                $rows = $database->all(
                    'SELECT * FROM public.logistics_orders
                     WHERE ' . $where . '
                     ORDER BY created_at DESC
                     LIMIT :limit OFFSET :offset',
                    array_merge($params, [
                        'limit' => $limit,
                        'offset' => ($page - 1) * $limit
                    ])
                );

                Response::paginated(
                    array_map([self::class, 'toLogisticsResponse'], $rows),
                    ['total' => $total, 'page' => $page, 'limit' => $limit]
                );
            } catch (\Exception $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }
        });

        // ── RETRIEVE LOGISTICS ORDER ──
        $router->get('/api/v1/logistics/{id}', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');
            $row = $database->one(
                'SELECT * FROM public.logistics_orders WHERE id = :id AND deleted_at IS NULL LIMIT 1',
                ['id' => $id]
            );

            if ($row === null) {
                Response::error(404, 'LOGISTICS_ORDER_NOT_FOUND', 'Orden de logistica no encontrada.');
            }

            $tenantHeader = trim((string) ($request->header('x-tenant-id', '') ?? ''));
            if ($tenantHeader !== '') {
                try {
                    $tenantId = self::resolveTenantId($database, $tenantHeader);
                } catch (\Exception $error) {
                    if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                        Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                    }
                    throw $error;
                }

                if (($row['tenant_id'] ?? null) !== $tenantId) {
                    Response::error(404, 'LOGISTICS_ORDER_NOT_FOUND', 'Orden de logistica no encontrada.');
                }
            }

            Response::success(self::toLogisticsResponse($row));
        });

        // ── CREATE ROUTE PLAN ──
        $router->post('/api/v1/logistics/route-plans', static function (Request $request) use ($database): void {
            $payload = $request->body();

            $tenantKey = self::requiredString($payload, 'tenantId', 1, 'INVALID_PLAN_PAYLOAD', 'Payload invalido para crear plan de ruta.');
            $planName = self::requiredString($payload, 'planName', 3, 'INVALID_PLAN_PAYLOAD', 'Payload invalido para crear plan de ruta.');
            $planType = self::requiredString($payload, 'planType', 1, 'INVALID_PLAN_PAYLOAD', 'Payload invalido para crear plan de ruta.');
            $recursoId = self::optionalUuid($payload, 'recursoId', 'INVALID_PLAN_PAYLOAD', 'Payload invalido para crear plan de ruta.');
            $maxCapacityKg = self::optionalFloat($payload, 'maxCapacityKg') ?? 0.0;
            $windowStart = self::optionalString($payload, 'windowStart', 100, 'INVALID_PLAN_PAYLOAD', 'Payload invalido para crear plan de ruta.');
            $windowEnd = self::optionalString($payload, 'windowEnd', 100, 'INVALID_PLAN_PAYLOAD', 'Payload invalido para crear plan de ruta.');
            $notes = self::optionalString($payload, 'notes', 1000, 'INVALID_PLAN_PAYLOAD', 'Payload invalido para crear plan de ruta.');
            $metadata = is_array($payload['metadata'] ?? null) ? $payload['metadata'] : [];

            if (!in_array($planType, ['recoleccion', 'entrega', 'mixta'], true)) {
                Response::error(400, 'INVALID_PLAN_PAYLOAD', 'Tipo de plan invalido.');
            }

            try {
                $tenantId = self::resolveTenantId($database, $tenantKey);

                if ($recursoId !== null) {
                    $rec = $database->one(
                        'SELECT id FROM public.recursos WHERE id = :id AND deleted_at IS NULL LIMIT 1',
                        ['id' => $recursoId]
                    );
                    if ($rec === null) {
                        Response::error(404, 'RESOURCE_NOT_FOUND', 'Recurso asignado no encontrado.');
                    }
                }

                $planId = Uuid::v4();

                $database->execute(
                    'INSERT INTO public.route_plans (
                        id, tenant_id, plan_name, plan_type, recurso_id,
                        total_stops, total_distance_km, estimated_duration_min,
                        total_load_kg, max_capacity_kg, window_start, window_end,
                        status, optimization_score, notes, metadata, created_at, updated_at
                     ) VALUES (
                        :id, :tenant_id, :plan_name, :plan_type, :recurso_id,
                        0, 0, 0, 0, :max_capacity_kg, :window_start, :window_end,
                        \'draft\', NULL, :notes, CAST(:metadata AS jsonb), NOW(), NOW()
                     )',
                    [
                        'id' => $planId,
                        'tenant_id' => $tenantId,
                        'plan_name' => $planName,
                        'plan_type' => $planType,
                        'recurso_id' => $recursoId,
                        'max_capacity_kg' => $maxCapacityKg,
                        'window_start' => $windowStart !== null ? (new \DateTimeImmutable($windowStart))->format(DATE_ATOM) : null,
                        'window_end' => $windowEnd !== null ? (new \DateTimeImmutable($windowEnd))->format(DATE_ATOM) : null,
                        'notes' => $notes,
                        'metadata' => json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}',
                    ]
                );

                $row = $database->one('SELECT * FROM public.route_plans WHERE id = :id LIMIT 1', ['id' => $planId]);
                Response::success(self::toPlanResponse($row), 201);

            } catch (\Exception $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }
        });

        // ── LIST ROUTE PLANS ──
        $router->get('/api/v1/logistics/route-plans', static function (Request $request) use ($database): void {
            $tenantKey = trim((string) ($request->query('tenantId', '')));
            if ($tenantKey === '') {
                Response::error(400, 'MISSING_TENANT', 'Se requiere tenantId.');
            }

            $page = max(1, (int) ($request->query('page', 1) ?? 1));
            $limit = min(100, max(1, (int) ($request->query('limit', 20) ?? 20)));

            try {
                $tenantId = self::resolveTenantId($database, $tenantKey);

                $total = (int) $database->scalar(
                    'SELECT COUNT(*) FROM public.route_plans WHERE tenant_id = :tenant_id',
                    ['tenant_id' => $tenantId]
                );

                $rows = $database->all(
                    'SELECT * FROM public.route_plans
                     WHERE tenant_id = :tenant_id
                     ORDER BY created_at DESC
                     LIMIT :limit OFFSET :offset',
                    [
                        'tenant_id' => $tenantId,
                        'limit' => $limit,
                        'offset' => ($page - 1) * $limit,
                    ]
                );

                Response::paginated(
                    array_map([self::class, 'toPlanResponse'], $rows),
                    ['total' => $total, 'page' => $page, 'limit' => $limit]
                );
            } catch (\Exception $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }
        });

        // ── RETRIEVE ROUTE PLAN WITH STOPS ──
        $router->get('/api/v1/logistics/route-plans/{id}', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');

            $plan = $database->one('SELECT * FROM public.route_plans WHERE id = :id LIMIT 1', ['id' => $id]);
            if ($plan === null) {
                Response::error(404, 'PLAN_NOT_FOUND', 'Plan de ruta no encontrado.');
            }

            $stops = $database->all(
                'SELECT * FROM public.route_stops WHERE route_plan_id = :plan_id ORDER BY stop_order ASC',
                ['plan_id' => $id]
            );

            $response = self::toPlanResponse($plan);
            $response['stops'] = array_map([self::class, 'toStopResponse'], $stops);

            Response::success($response);
        });

        // ── UPDATE PLAN STATUS ──
        $router->patch('/api/v1/logistics/route-plans/{id}/status', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');
            $payload = $request->body();
            $status = trim((string) ($payload['status'] ?? ''));

            if (!in_array($status, ['draft', 'optimized', 'in_progress', 'completed', 'cancelled'], true)) {
                Response::error(400, 'INVALID_PLAN_STATUS', 'Estado de plan invalido.');
            }

            $plan = $database->one('SELECT id FROM public.route_plans WHERE id = :id LIMIT 1', ['id' => $id]);
            if ($plan === null) {
                Response::error(404, 'PLAN_NOT_FOUND', 'Plan de ruta no encontrado.');
            }

            $database->execute(
                'UPDATE public.route_plans SET status = :status, updated_at = NOW() WHERE id = :id',
                ['status' => $status, 'id' => $id]
            );

            Response::success(['updated' => true]);
        });

        // ── ADD ROUTE STOP ──
        $router->post('/api/v1/logistics/route-plans/{planId}/stops', static function (Request $request) use ($database): void {
            $planId = (string) $request->route('planId');
            $payload = $request->body();

            $stopType = self::requiredString($payload, 'stopType', 1, 'INVALID_STOP_PAYLOAD', 'Payload invalido para agregar parada.');
            $locationName = self::requiredString($payload, 'locationName', 2, 'INVALID_STOP_PAYLOAD', 'Payload invalido para agregar parada.');
            $address = self::optionalString($payload, 'address', 500, 'INVALID_STOP_PAYLOAD', 'Payload invalido para agregar parada.');
            $latitude = self::optionalFloat($payload, 'latitude');
            $longitude = self::optionalFloat($payload, 'longitude');
            $logisticsOrderId = self::optionalUuid($payload, 'logisticsOrderId', 'INVALID_STOP_PAYLOAD', 'Payload invalido para agregar parada.');
            $estimatedArrival = self::optionalString($payload, 'estimatedArrival', 100, 'INVALID_STOP_PAYLOAD', 'Payload invalido para agregar parada.');
            $estimatedDeparture = self::optionalString($payload, 'estimatedDeparture', 100, 'INVALID_STOP_PAYLOAD', 'Payload invalido para agregar parada.');
            $loadKg = self::optionalFloat($payload, 'loadKg') ?? 0.0;
            $notes = self::optionalString($payload, 'notes', 500, 'INVALID_STOP_PAYLOAD', 'Payload invalido para agregar parada.');
            $metadata = is_array($payload['metadata'] ?? null) ? $payload['metadata'] : [];

            if (!in_array($stopType, ['pickup', 'delivery', 'checkpoint'], true)) {
                Response::error(400, 'INVALID_STOP_PAYLOAD', 'Tipo de parada invalido.');
            }

            try {
                $plan = $database->one('SELECT * FROM public.route_plans WHERE id = :id LIMIT 1', ['id' => $planId]);
                if ($plan === null) {
                    Response::error(404, 'PLAN_NOT_FOUND', 'Plan de ruta no encontrado.');
                }

                if ($plan['status'] !== 'draft' && $plan['status'] !== 'optimized') {
                    Response::error(409, 'PLAN_NOT_EDITABLE', 'El plan ya no acepta nuevas paradas.');
                }

                $stops = $database->all(
                    'SELECT id, load_kg FROM public.route_stops WHERE route_plan_id = :plan_id',
                    ['plan_id' => $planId]
                );

                $currentLoad = 0.0;
                foreach ($stops as $s) {
                    $currentLoad += (float) $s['load_kg'];
                }

                $maxCapacity = (float) $plan['max_capacity_kg'];
                if ($maxCapacity > 0 && ($currentLoad + $loadKg > $maxCapacity)) {
                    Response::error(422, 'CAPACITY_EXCEEDED', 'La carga excede la capacidad maxima del vehiculo.');
                }

                $stopId = Uuid::v4();
                $stopOrder = count($stops) + 1;

                $database->pdo()->beginTransaction();

                $database->execute(
                    'INSERT INTO public.route_stops (
                        id, route_plan_id, stop_order, stop_type, location_name, address,
                        latitude, longitude, logistics_order_id,
                        estimated_arrival, actual_arrival, estimated_departure, actual_departure,
                        load_kg, status, notes, metadata, created_at
                     ) VALUES (
                        :id, :route_plan_id, :stop_order, :stop_type, :location_name, :address,
                        :latitude, :longitude, :logistics_order_id,
                        :estimated_arrival, NULL, :estimated_departure, NULL,
                        :load_kg, \'pending\', :notes, CAST(:metadata AS jsonb), NOW()
                     )',
                    [
                        'id' => $stopId,
                        'route_plan_id' => $planId,
                        'stop_order' => $stopOrder,
                        'stop_type' => $stopType,
                        'location_name' => $locationName,
                        'address' => $address,
                        'latitude' => $latitude,
                        'longitude' => $longitude,
                        'logistics_order_id' => $logisticsOrderId,
                        'estimated_arrival' => $estimatedArrival !== null ? (new \DateTimeImmutable($estimatedArrival))->format(DATE_ATOM) : null,
                        'estimated_departure' => $estimatedDeparture !== null ? (new \DateTimeImmutable($estimatedDeparture))->format(DATE_ATOM) : null,
                        'load_kg' => $loadKg,
                        'notes' => $notes,
                        'metadata' => json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}',
                    ]
                );

                // Update route plan totals
                $newTotalLoad = $currentLoad + $loadKg;
                $newTotalStops = count($stops) + 1;
                $database->execute(
                    'UPDATE public.route_plans
                     SET total_stops = :total_stops, total_load_kg = :total_load, updated_at = NOW()
                     WHERE id = :id',
                    [
                        'total_stops' => $newTotalStops,
                        'total_load' => $newTotalLoad,
                        'id' => $planId,
                    ]
                );

                $row = $database->one('SELECT * FROM public.route_stops WHERE id = :id LIMIT 1', ['id' => $stopId]);
                
                $database->pdo()->commit();

                Response::success(self::toStopResponse($row), 201);

            } catch (\Exception $error) {
                if ($database->pdo()->inTransaction()) {
                    $database->pdo()->rollBack();
                }
                throw $error;
            }
        });

        // ── LIST STOPS BY PLAN ──
        $router->get('/api/v1/logistics/route-plans/{planId}/stops', static function (Request $request) use ($database): void {
            $planId = (string) $request->route('planId');
            $stops = $database->all(
                'SELECT * FROM public.route_stops WHERE route_plan_id = :plan_id ORDER BY stop_order ASC',
                ['plan_id' => $planId]
            );
            Response::success(array_map([self::class, 'toStopResponse'], $stops));
        });

        // ── UPDATE STOP STATUS ──
        $router->patch('/api/v1/logistics/route-stops/{stopId}/status', static function (Request $request) use ($database): void {
            $stopId = (string) $request->route('stopId');
            $payload = $request->body();
            $status = trim((string) ($payload['status'] ?? ''));

            if (!in_array($status, ['pending', 'arrived', 'completed', 'skipped'], true)) {
                Response::error(400, 'INVALID_STOP_STATUS', 'Estado de parada invalido.');
            }

            $stop = $database->one('SELECT * FROM public.route_stops WHERE id = :id LIMIT 1', ['id' => $stopId]);
            if ($stop === null) {
                Response::error(404, 'STOP_NOT_FOUND', 'Parada no encontrada.');
            }

            $actualArrival = $status === 'arrived' ? (new \DateTimeImmutable())->format(DATE_ATOM) : null;
            $actualDeparture = $status === 'completed' ? (new \DateTimeImmutable())->format(DATE_ATOM) : null;

            $sets = ['status = :status'];
            $params = ['status' => $status, 'id' => $stopId];

            if ($actualArrival !== null) {
                $sets[] = 'actual_arrival = :actual_arrival';
                $params['actual_arrival'] = $actualArrival;
            }
            if ($actualDeparture !== null) {
                $sets[] = 'actual_departure = :actual_departure';
                $params['actual_departure'] = $actualDeparture;
            }

            $database->execute(
                'UPDATE public.route_stops SET ' . implode(', ', $sets) . ' WHERE id = :id',
                $params
            );

            Response::success(['updated' => true]);
        });

        // ── DELETE ROUTE STOP ──
        $router->delete('/api/v1/logistics/route-stops/{stopId}', static function (Request $request) use ($database): void {
            $stopId = (string) $request->route('stopId');

            $stop = $database->one('SELECT * FROM public.route_stops WHERE id = :id LIMIT 1', ['id' => $stopId]);
            if ($stop === null) {
                Response::error(404, 'STOP_NOT_FOUND', 'Parada no encontrada.');
            }

            $plan = $database->one('SELECT status, total_stops, total_load_kg FROM public.route_plans WHERE id = :id LIMIT 1', ['id' => $stop['route_plan_id']]);
            if ($plan && $plan['status'] !== 'draft' && $plan['status'] !== 'optimized') {
                Response::error(409, 'PLAN_NOT_EDITABLE', 'No se puede eliminar paradas de un plan en ejecucion.');
            }

            $database->pdo()->beginTransaction();

            $database->execute('DELETE FROM public.route_stops WHERE id = :id', ['id' => $stopId]);

            // Reorder remaining stops
            $remaining = $database->all(
                'SELECT id FROM public.route_stops WHERE route_plan_id = :plan_id ORDER BY stop_order ASC',
                ['plan_id' => $stop['route_plan_id']]
            );

            $newLoad = 0.0;
            foreach ($remaining as $idx => $r) {
                $database->execute(
                    'UPDATE public.route_stops SET stop_order = :stop_order WHERE id = :id',
                    ['stop_order' => $idx + 1, 'id' => $r['id']]
                );
            }

            $remainingStopsDetail = $database->all(
                'SELECT load_kg FROM public.route_stops WHERE route_plan_id = :plan_id',
                ['plan_id' => $stop['route_plan_id']]
            );
            foreach ($remainingStopsDetail as $rsd) {
                $newLoad += (float) $rsd['load_kg'];
            }

            $database->execute(
                'UPDATE public.route_plans
                 SET total_stops = :total_stops, total_load_kg = :total_load, updated_at = NOW()
                 WHERE id = :id',
                [
                    'total_stops' => count($remaining),
                    'total_load' => $newLoad,
                    'id' => $stop['route_plan_id'],
                ]
            );

            $database->pdo()->commit();

            Response::success(['deleted' => true]);
        });

        // ── REORDER STOPS ──
        $router->put('/api/v1/logistics/route-plans/{planId}/stops/reorder', static function (Request $request) use ($database): void {
            $planId = (string) $request->route('planId');
            $payload = $request->body();
            $stopIds = $payload['stopIds'] ?? null;

            if (!is_array($stopIds) || count($stopIds) === 0) {
                Response::error(400, 'INVALID_REORDER_PAYLOAD', 'Se requiere un array de stopIds.');
            }

            $plan = $database->one('SELECT status FROM public.route_plans WHERE id = :id LIMIT 1', ['id' => $planId]);
            if ($plan === null) {
                Response::error(404, 'PLAN_NOT_FOUND', 'Plan de ruta no encontrado.');
            }
            if ($plan['status'] !== 'draft' && $plan['status'] !== 'optimized') {
                Response::error(409, 'PLAN_NOT_EDITABLE', 'No se puede reordenar un plan en ejecucion.');
            }

            $database->pdo()->beginTransaction();

            foreach ($stopIds as $idx => $id) {
                $database->execute(
                    'UPDATE public.route_stops SET stop_order = :stop_order
                     WHERE id = :id AND route_plan_id = :plan_id',
                    [
                        'stop_order' => $idx + 1,
                        'id' => $id,
                        'plan_id' => $planId,
                    ]
                );
            }

            $database->pdo()->commit();

            $stops = $database->all(
                'SELECT * FROM public.route_stops WHERE route_plan_id = :plan_id ORDER BY stop_order ASC',
                ['plan_id' => $planId]
            );

            Response::success(array_map([self::class, 'toStopResponse'], $stops));
        });

        // ── ROUTING HEALTH ──
        $router->get('/api/v1/logistics/routing/health', static function (Request $request) use ($database): void {
            $baseUrl = self::getOsrmUrl();
            $url = $baseUrl . '/nearest/v1/driving/-74.0721,4.7110?number=1';
            $res = self::osrmRequest($url);
            $ok = ($res !== null && ($res['code'] ?? '') === 'Ok');
            Response::success(['available' => $ok, 'engine' => 'osrm']);
        });

        // ── ROAD DIRECTIONS (OSRM OVERVIEW) ──
        $router->get('/api/v1/logistics/route-plans/{id}/directions', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');

            $plan = $database->one('SELECT * FROM public.route_plans WHERE id = :id LIMIT 1', ['id' => $id]);
            if ($plan === null) {
                Response::error(404, 'PLAN_NOT_FOUND', 'Plan de ruta no encontrado.');
            }

            $stops = $database->all(
                'SELECT * FROM public.route_stops
                 WHERE route_plan_id = :plan_id AND latitude IS NOT NULL AND longitude IS NOT NULL
                 ORDER BY stop_order ASC',
                ['plan_id' => $id]
            );

            if (count($stops) < 2) {
                Response::error(422, 'INSUFFICIENT_COORDS', 'Se necesitan al menos 2 paradas con coordenadas.');
            }

            $coords = [];
            foreach ($stops as $s) {
                $coords[] = $s['longitude'] . ',' . $s['latitude'];
            }
            $coordStr = implode(';', $coords);

            $baseUrl = self::getOsrmUrl();
            $url = $baseUrl . '/route/v1/driving/' . $coordStr . '?overview=full&geometries=polyline&steps=false';
            
            $data = self::osrmRequest($url);
            if ($data === null || ($data['code'] ?? '') !== 'Ok' || empty($data['routes'])) {
                Response::error(503, 'ROUTING_UNAVAILABLE', 'El servicio de ruteo vial OSRM no respondio correctamente.');
            }

            $route = $data['routes'][0];
            $legs = [];
            foreach (($route['legs'] ?? []) as $i => $leg) {
                $legs[] = [
                    'from' => $stops[$i]['location_name'] ?? null,
                    'to' => $stops[$i + 1]['location_name'] ?? null,
                    'distanceKm' => round(($leg['distance'] / 1000) * 100) / 100,
                    'durationMin' => round(($leg['duration'] / 60) * 100) / 100,
                    'summary' => $leg['summary'] ?? '',
                ];
            }

            Response::success([
                'planId' => $id,
                'totalDistanceKm' => round(($route['distance'] / 1000) * 100) / 100,
                'totalDurationMin' => round(($route['duration'] / 60) * 100) / 100,
                'legs' => $legs,
                'geometry' => $route['geometry'] ?? null,
            ]);
        });

        // ── DISTANCE MATRIX (NxN) ──
        $router->post('/api/v1/logistics/route-plans/{id}/distance-matrix', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');

            $plan = $database->one('SELECT * FROM public.route_plans WHERE id = :id LIMIT 1', ['id' => $id]);
            if ($plan === null) {
                Response::error(404, 'PLAN_NOT_FOUND', 'Plan de ruta no encontrado.');
            }

            $stops = $database->all(
                'SELECT * FROM public.route_stops
                 WHERE route_plan_id = :plan_id AND latitude IS NOT NULL AND longitude IS NOT NULL
                 ORDER BY stop_order ASC',
                ['plan_id' => $id]
            );

            if (count($stops) < 2) {
                Response::error(422, 'INSUFFICIENT_COORDS', 'Se necesitan al menos 2 paradas con coordenadas.');
            }

            $coords = [];
            foreach ($stops as $s) {
                $coords[] = $s['longitude'] . ',' . $s['latitude'];
            }
            $coordStr = implode(';', $coords);

            $baseUrl = self::getOsrmUrl();
            $url = $baseUrl . '/table/v1/driving/' . $coordStr . '?annotations=distance,duration';

            $data = self::osrmRequest($url);
            if ($data === null || ($data['code'] ?? '') !== 'Ok') {
                Response::error(503, 'ROUTING_UNAVAILABLE', 'El servicio de ruteo vial OSRM no respondio correctamente.');
            }

            $distances = [];
            foreach (($data['distances'] ?? []) as $row) {
                $newRow = [];
                foreach ($row as $d) {
                    $newRow[] = round(($d / 1000) * 100) / 100;
                }
                $distances[] = $newRow;
            }

            $durations = [];
            foreach (($data['durations'] ?? []) as $row) {
                $newRow = [];
                foreach ($row as $d) {
                    $newRow[] = round(($d / 60) * 100) / 100;
                }
                $durations[] = $newRow;
            }

            Response::success([
                'planId' => $id,
                'stopNames' => array_map(static fn ($s) => $s['location_name'], $stops),
                'distances' => $distances,
                'durations' => $durations,
            ]);
        });

        // ── STOPS CONSOLIDATION ──
        $router->get('/api/v1/logistics/route-plans/{id}/consolidation', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');
            $radiusKm = max(0.1, min(50.0, (float) ($request->query('radiusKm', 2.0) ?? 2.0)));

            $plan = $database->one('SELECT * FROM public.route_plans WHERE id = :id LIMIT 1', ['id' => $id]);
            if ($plan === null) {
                Response::error(404, 'PLAN_NOT_FOUND', 'Plan de ruta no encontrado.');
            }

            $stops = $database->all(
                'SELECT * FROM public.route_stops WHERE route_plan_id = :plan_id ORDER BY stop_order ASC',
                ['plan_id' => $id]
            );

            $groups = [];
            $visited = array_fill(0, count($stops), false);

            for ($i = 0; $i < count($stops); $i++) {
                if ($visited[$i]) continue;
                if ($stops[$i]['latitude'] === null || $stops[$i]['longitude'] === null) {
                    continue;
                }

                $visited[$i] = true;
                $lat1 = (float) $stops[$i]['latitude'];
                $lng1 = (float) $stops[$i]['longitude'];

                $currentGroup = [
                    'centerStop' => self::toStopResponse($stops[$i]),
                    'stops' => [self::toStopResponse($stops[$i])],
                    'totalLoadKg' => (float) $stops[$i]['load_kg'],
                ];

                for ($j = 0; $j < count($stops); $j++) {
                    if ($visited[$j]) continue;
                    if ($stops[$j]['latitude'] === null || $stops[$j]['longitude'] === null) {
                        continue;
                    }

                    $lat2 = (float) $stops[$j]['latitude'];
                    $lng2 = (float) $stops[$j]['longitude'];

                    $dist = self::haversineKm($lat1, $lng1, $lat2, $lng2);
                    if ($dist <= $radiusKm) {
                        $visited[$j] = true;
                        $currentGroup['stops'][] = self::toStopResponse($stops[$j]);
                        $currentGroup['totalLoadKg'] += (float) $stops[$j]['load_kg'];
                    }
                }

                $groups[] = $currentGroup;
            }

            Response::success([
                'planId' => $id,
                'radiusKm' => $radiusKm,
                'groupsCount' => count($groups),
                'groups' => $groups,
            ]);
        });

        // ── OPTIMIZE PLAN VISIT SEQUENCING ──
        $router->post('/api/v1/logistics/route-plans/{id}/optimize', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');

            $plan = $database->one('SELECT * FROM public.route_plans WHERE id = :id LIMIT 1', ['id' => $id]);
            if ($plan === null) {
                Response::error(404, 'PLAN_NOT_FOUND', 'Plan de ruta no encontrado.');
            }

            if ($plan['status'] !== 'draft' && $plan['status'] !== 'optimized') {
                Response::error(409, 'PLAN_NOT_EDITABLE', 'El plan esta en progreso o completado y no se puede optimizar.');
            }

            $stops = $database->all(
                'SELECT * FROM public.route_stops WHERE route_plan_id = :plan_id ORDER BY stop_order ASC',
                ['plan_id' => $id]
            );

            $warnings = [];
            $totalLoadKg = 0.0;
            foreach ($stops as $s) {
                $totalLoadKg += (float) ($s['load_kg'] ?? 0);
            }

            if (count($stops) < 2) {
                $maxCapacity = (float) ($plan['max_capacity_kg'] ?? 0);
                if ($maxCapacity > 0 && $totalLoadKg > $maxCapacity) {
                    $warnings[] = "Carga total ($totalLoadKg kg) excede capacidad maxima ($maxCapacity kg).";
                }

                $database->execute(
                    'UPDATE public.route_plans
                     SET status = \'optimized\', total_stops = :total_stops, total_distance_km = 0,
                         estimated_duration_min = 0, total_load_kg = :total_load, optimization_score = 100,
                         updated_at = NOW()
                     WHERE id = :id',
                    [
                        'total_stops' => count($stops),
                        'total_load' => $totalLoadKg,
                        'id' => $id,
                    ]
                );

                $updatedPlan = $database->one('SELECT * FROM public.route_plans WHERE id = :id LIMIT 1', ['id' => $id]);
                $updatedStops = $database->all('SELECT * FROM public.route_stops WHERE route_plan_id = :plan_id ORDER BY stop_order ASC', ['plan_id' => $id]);

                $res = self::toPlanResponse($updatedPlan);
                $res['stops'] = array_map([self::class, 'toStopResponse'], $updatedStops);
                $res['warnings'] = $warnings;
                $res['routingEngine'] = 'haversine';
                $res['geometry'] = null;

                Response::success($res);
                return;
            }

            $geoStops = [];
            $nonGeoStops = [];
            foreach ($stops as $s) {
                if ($s['latitude'] !== null && $s['longitude'] !== null) {
                    $geoStops[] = $s;
                } else {
                    $nonGeoStops[] = $s;
                }
            }

            $orderedIds = [];
            $totalDistanceKm = 0.0;
            $estimatedDurationMin = 0;
            $routingEngine = 'haversine';
            $geometry = null;

            if (count($geoStops) >= 2) {
                $osrmResult = self::tryOsrmTrip($geoStops, $warnings);
                if ($osrmResult !== null) {
                    $orderedIds = $osrmResult['orderedIds'];
                    foreach ($nonGeoStops as $s) {
                        $orderedIds[] = $s['id'];
                    }
                    $totalDistanceKm = (float) $osrmResult['distanceKm'];
                    $estimatedDurationMin = (int) $osrmResult['durationMin'];
                    $routingEngine = 'osrm';
                    $geometry = $osrmResult['geometry'];
                } else {
                    $fallback = self::nearestNeighbor($geoStops, $nonGeoStops);
                    $orderedIds = $fallback['orderedIds'];
                    $totalDistanceKm = (float) $fallback['distanceKm'];
                    $estimatedDurationMin = (int) ceil(($totalDistanceKm / 30) * 60);
                    $routingEngine = 'haversine';
                    $warnings[] = 'OSRM no disponible; usando distancia en linea recta como respaldo.';
                }
            } elseif (count($geoStops) >= 2) {
                $fallback = self::nearestNeighbor($geoStops, $nonGeoStops);
                $orderedIds = $fallback['orderedIds'];
                $totalDistanceKm = (float) $fallback['distanceKm'];
                $estimatedDurationMin = (int) ceil(($totalDistanceKm / 30) * 60);
                $routingEngine = 'haversine';
            } else {
                foreach ($stops as $s) {
                    $orderedIds[] = $s['id'];
                }
                $totalDistanceKm = 0.0;
                $estimatedDurationMin = 0;
                $routingEngine = 'haversine';
            }

            $database->pdo()->beginTransaction();

            // Reorder stops in DB
            foreach ($orderedIds as $idx => $stopId) {
                $database->execute(
                    'UPDATE public.route_stops SET stop_order = :stop_order WHERE id = :id AND route_plan_id = :plan_id',
                    ['stop_order' => $idx + 1, 'id' => $stopId, 'plan_id' => $id]
                );
            }

            // Calculate optimization score
            $score = 50.0;
            $maxCapacity = (float) ($plan['max_capacity_kg'] ?? 0);
            if ($maxCapacity > 0) {
                $score += min($totalLoadKg / $maxCapacity, 1) * 25;
            }
            if (count($stops) > 1 && $totalDistanceKm > 0) {
                $distPerStop = $totalDistanceKm / (count($stops) - 1);
                $score += max(0.0, 1.0 - $distPerStop / 10) * 25;
            }
            if ($routingEngine === 'osrm') {
                $score = min($score + 5, 99.99);
            }
            $score = min(99.99, max(0.0, $score));

            if ($maxCapacity > 0 && $totalLoadKg > $maxCapacity) {
                $warnings[] = "Carga total ($totalLoadKg kg) excede capacidad maxima ($maxCapacity kg).";
                $score = max(0.0, $score - 15);
            }

            if ($plan['window_start'] && $plan['window_end']) {
                $windowStartMs = (new \DateTimeImmutable($plan['window_start']))->getTimestamp() * 1000;
                $windowEndMs = (new \DateTimeImmutable($plan['window_end']))->getTimestamp() * 1000;
                $availableMin = ($windowEndMs - $windowStartMs) / 60000;
                if ($estimatedDurationMin > $availableMin) {
                    $warnings[] = "Duracion estimada ($estimatedDurationMin min) excede la ventana de tiempo disponible (" . round($availableMin) . " min).";
                    $score = max(0.0, $score - 10);
                }
            }

            $database->execute(
                'UPDATE public.route_plans
                 SET total_stops = :total_stops, total_distance_km = :total_dist,
                     estimated_duration_min = :duration, total_load_kg = :total_load,
                     optimization_score = :score, status = \'optimized\', updated_at = NOW()
                 WHERE id = :id',
                [
                    'total_stops' => count($stops),
                    'total_dist' => round($totalDistanceKm * 100) / 100,
                    'duration' => $estimatedDurationMin,
                    'total_load' => $totalLoadKg,
                    'score' => round($score * 100) / 100,
                    'id' => $id,
                ]
            );

            $database->pdo()->commit();

            $updatedPlan = $database->one('SELECT * FROM public.route_plans WHERE id = :id LIMIT 1', ['id' => $id]);
            $updatedStops = $database->all('SELECT * FROM public.route_stops WHERE route_plan_id = :plan_id ORDER BY stop_order ASC', ['plan_id' => $id]);

            $res = self::toPlanResponse($updatedPlan);
            $res['stops'] = array_map([self::class, 'toStopResponse'], $updatedStops);
            $res['warnings'] = $warnings;
            $res['routingEngine'] = $routingEngine;
            $res['geometry'] = $geometry;

            Response::success($res);
        });

        // ── VRP SOLVER ──
        $router->post('/api/v1/logistics/vrp/solve', static function (Request $request) use ($database): void {
            $payload = $request->body();
            Response::success(self::solveVrpInternal($payload));
        });

        // ── VRP FROM PLAN ──
        $router->post('/api/v1/logistics/route-plans/{id}/vrp', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');
            $payload = $request->body();

            $planWithStops = $database->one('SELECT * FROM public.route_plans WHERE id = :id LIMIT 1', ['id' => $id]);
            if ($planWithStops === null) {
                Response::error(404, 'PLAN_NOT_FOUND', 'Plan de ruta no encontrado.');
            }

            $stops = $database->all(
                'SELECT * FROM public.route_stops
                 WHERE route_plan_id = :plan_id AND latitude IS NOT NULL AND longitude IS NOT NULL
                 ORDER BY stop_order ASC',
                ['plan_id' => $id]
            );

            if (empty($stops)) {
                Response::error(422, 'NO_GEO_STOPS', 'El plan no tiene paradas con coordenadas.');
            }

            $formattedStops = [];
            foreach ($stops as $s) {
                $formattedStops[] = [
                    'id' => $s['id'],
                    'latitude' => (float) $s['latitude'],
                    'longitude' => (float) $s['longitude'],
                    'loadKg' => (float) ($s['load_kg'] ?? 0.0),
                    'locationName' => $s['location_name'],
                ];
            }

            $vehicles = $payload['vehicles'] ?? [];
            $depotLat = $payload['depotLat'] ?? null;
            $depotLng = $payload['depotLng'] ?? null;
            $strategy = $payload['strategy'] ?? 'clarke_wright';

            if (empty($vehicles) || $depotLat === null || $depotLng === null) {
                Response::error(400, 'INVALID_VRP_PAYLOAD', 'Se requiere vehicles[], depotLat, depotLng.');
            }

            $solution = self::solveVrpInternal([
                'tenantId' => $planWithStops['tenant_id'],
                'scenarioName' => 'VRP para plan ' . $planWithStops['plan_name'],
                'depotLat' => $depotLat,
                'depotLng' => $depotLng,
                'vehicles' => $vehicles,
                'stops' => $formattedStops,
                'strategy' => $strategy,
            ]);

            Response::success($solution);
        });

        // ── ACTIVE ROUTES ANALYTICS ──
        $router->get('/api/v1/logistics/analytics/active-routes', static function (Request $request) use ($database): void {
            $tenantKey = trim((string) ($request->query('tenantId', '')));
            if ($tenantKey === '') {
                Response::error(400, 'MISSING_TENANT', 'Se requiere tenantId.');
            }

            try {
                $tenantId = self::resolveTenantId($database, $tenantKey);

                $rows = $database->all(
                    'SELECT
                        rp.id AS plan_id, rp.plan_name, rp.plan_type, rp.status,
                        rp.total_stops, rp.total_distance_km::text AS total_distance_km,
                        rp.total_load_kg::text AS total_load_kg,
                        rp.max_capacity_kg::text AS max_capacity_kg,
                        rp.estimated_duration_min,
                        rp.optimization_score::text AS optimization_score,
                        rp.recurso_id,
                        COALESCE(SUM(CASE WHEN rs.status = \'completed\' THEN 1 ELSE 0 END), 0)::int AS completed_stops,
                        COALESCE(SUM(CASE WHEN rs.status IN (\'pending\',\'arrived\') THEN 1 ELSE 0 END), 0)::int AS pending_stops,
                        CASE WHEN rp.max_capacity_kg > 0
                             THEN ROUND((rp.total_load_kg / rp.max_capacity_kg * 100)::numeric, 1)::text
                             ELSE \'0\' END AS load_percentage
                     FROM public.route_plans rp
                     LEFT JOIN public.route_stops rs ON rs.route_plan_id = rp.id
                     WHERE rp.tenant_id = :tenant_id AND rp.status IN (\'in_progress\',\'optimized\')
                     GROUP BY rp.id
                     ORDER BY rp.created_at DESC
                     LIMIT 50',
                    ['tenant_id' => $tenantId]
                );

                $result = [];
                foreach ($rows as $r) {
                    $result[] = [
                        'planId' => (string) $r['plan_id'],
                        'planName' => (string) $r['plan_name'],
                        'planType' => (string) $r['plan_type'],
                        'status' => (string) $r['status'],
                        'totalStops' => (int) $r['total_stops'],
                        'completedStops' => (int) $r['completed_stops'],
                        'pendingStops' => (int) $r['pending_stops'],
                        'totalDistanceKm' => (float) $r['total_distance_km'],
                        'totalLoadKg' => (float) $r['total_load_kg'],
                        'maxCapacityKg' => (float) $r['max_capacity_kg'],
                        'loadPercentage' => (float) $r['load_percentage'],
                        'estimatedDurationMin' => (int) $r['estimated_duration_min'],
                        'optimizationScore' => $r['optimization_score'] !== null ? (float) $r['optimization_score'] : null,
                        'recursoId' => $r['recurso_id'],
                    ];
                }

                Response::success($result);
            } catch (\Exception $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }
        });

        // ── PERFORMANCE ANALYTICS ──
        $router->get('/api/v1/logistics/analytics/performance', static function (Request $request) use ($database): void {
            $tenantKey = trim((string) ($request->query('tenantId', '')));
            if ($tenantKey === '') {
                Response::error(400, 'MISSING_TENANT', 'Se requiere tenantId.');
            }

            try {
                $tenantId = self::resolveTenantId($database, $tenantKey);

                $r = $database->one(
                    'SELECT
                        COUNT(*)::int AS total_plans,
                        COALESCE(SUM(CASE WHEN status = \'completed\' THEN 1 ELSE 0 END), 0)::int AS completed_plans,
                        COALESCE(SUM(CASE WHEN status = \'in_progress\' THEN 1 ELSE 0 END), 0)::int AS in_progress_plans,
                        ROUND(COALESCE(AVG(optimization_score) FILTER (WHERE optimization_score IS NOT NULL), 0)::numeric, 2)::text AS avg_optimization_score,
                        ROUND(COALESCE(AVG(total_distance_km) FILTER (WHERE total_distance_km > 0), 0)::numeric, 2)::text AS avg_distance_km,
                        ROUND(COALESCE(AVG(
                          CASE WHEN max_capacity_kg > 0 THEN total_load_kg / max_capacity_kg * 100 ELSE 0 END
                        ), 0)::numeric, 2)::text AS avg_load_utilization,
                        COALESCE(SUM(total_load_kg) FILTER (WHERE status = \'completed\'), 0)::text AS total_delivered_kg,
                        ROUND(COALESCE(AVG(total_stops) FILTER (WHERE total_stops > 0), 0)::numeric, 1)::text AS avg_stops_per_route
                     FROM public.route_plans
                     WHERE tenant_id = :tenant_id',
                    ['tenant_id' => $tenantId]
                );

                Response::success([
                    'totalPlans' => (int) $r['total_plans'],
                    'completedPlans' => (int) $r['completed_plans'],
                    'inProgressPlans' => (int) $r['in_progress_plans'],
                    'avgOptimizationScore' => (float) $r['avg_optimization_score'],
                    'avgDistanceKm' => (float) $r['avg_distance_km'],
                    'avgLoadUtilization' => (float) $r['avg_load_utilization'],
                    'totalDeliveredKg' => (float) $r['total_delivered_kg'],
                    'avgStopsPerRoute' => (float) $r['avg_stops_per_route'],
                ]);
            } catch (\Exception $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }
        });
    }

    private static function activePositions(Database $database, ?string $tenantKey): array
    {
        $tenantId = $tenantKey !== null ? self::resolveTenantId($database, $tenantKey) : null;
        $where = "r.deleted_at IS NULL AND r.estado = 'en_ruta'";
        $params = [];
        if ($tenantId !== null) {
            $where .= ' AND r.tenant_id = :tenant_id';
            $params['tenant_id'] = $tenantId;
        }

        $rows = $database->all(
            "SELECT
                ta.recurso_id,
                r.nombre,
                r.tipo,
                r.estado,
                ta.latitude::text AS latitude,
                ta.longitude::text AS longitude,
                ta.velocidad::text AS velocidad,
                ta.bearing::text AS bearing,
                ta.evento,
                ta.orden_id,
                ta.actualizado_at
             FROM public.tracking_actual ta
             JOIN public.recursos r ON r.id = ta.recurso_id
             WHERE {$where}
             ORDER BY ta.actualizado_at DESC",
            $params
        );

        return array_map(static function (array $row): array {
            return [
                'recursoId' => (string) $row['recurso_id'],
                'nombre' => (string) $row['nombre'],
                'tipo' => (string) $row['tipo'],
                'estado' => (string) $row['estado'],
                'latitude' => (float) $row['latitude'],
                'longitude' => (float) $row['longitude'],
                'velocidad' => $row['velocidad'] !== null ? (float) $row['velocidad'] : null,
                'bearing' => $row['bearing'] !== null ? (float) $row['bearing'] : null,
                'evento' => (string) $row['evento'],
                'ordenId' => $row['orden_id'],
                'actualizadoAt' => self::toIso($row['actualizado_at'] ?? null),
            ];
        }, $rows);
    }

    private static function createGeofence(
        Database $database,
        string $tenantKey,
        string $zoneName,
        string $zoneType,
        float $centerLat,
        float $centerLng,
        float $radiusM,
        array $metadata
    ): array {
        $tenantId = self::resolveTenantId($database, $tenantKey);
        $zoneId = Uuid::v4();

        if ($database->hasPostgis()) {
            $row = $database->one(
                "INSERT INTO public.geofence_zones (
                    id, tenant_id, zone_name, zone_type, geom, center_lat, center_lng, radius_m, metadata
                 )
                 VALUES (
                    :id,
                    :tenant_id,
                    :zone_name,
                    :zone_type,
                    ST_Buffer(
                      ST_SetSRID(ST_MakePoint(:center_lng, :center_lat), 4326)::geography,
                      :radius_m
                    )::geometry,
                    :center_lat,
                    :center_lng,
                    :radius_m,
                    CAST(:metadata AS jsonb)
                 )
                 RETURNING
                    id,
                    tenant_id,
                    zone_name,
                    zone_type,
                    center_lat::text AS center_lat,
                    center_lng::text AS center_lng,
                    radius_m::text AS radius_m,
                    is_active,
                    metadata::text AS metadata,
                    created_at,
                    ST_AsGeoJSON(geom)::text AS geometry",
                [
                    'id' => $zoneId,
                    'tenant_id' => $tenantId,
                    'zone_name' => $zoneName,
                    'zone_type' => $zoneType,
                    'center_lat' => $centerLat,
                    'center_lng' => $centerLng,
                    'radius_m' => $radiusM,
                    'metadata' => json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}',
                ]
            );
        } else {
            $row = $database->one(
                "INSERT INTO public.geofence_zones (
                    id, tenant_id, zone_name, zone_type, center_lat, center_lng, radius_m, metadata
                 )
                 VALUES (
                    :id,
                    :tenant_id,
                    :zone_name,
                    :zone_type,
                    :center_lat,
                    :center_lng,
                    :radius_m,
                    CAST(:metadata AS jsonb)
                 )
                 RETURNING
                    id,
                    tenant_id,
                    zone_name,
                    zone_type,
                    center_lat::text AS center_lat,
                    center_lng::text AS center_lng,
                    radius_m::text AS radius_m,
                    is_active,
                    metadata::text AS metadata,
                    created_at",
                [
                    'id' => $zoneId,
                    'tenant_id' => $tenantId,
                    'zone_name' => $zoneName,
                    'zone_type' => $zoneType,
                    'center_lat' => $centerLat,
                    'center_lng' => $centerLng,
                    'radius_m' => $radiusM,
                    'metadata' => json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}',
                ]
            );
        }

        return self::mapZone($row, $database->hasPostgis());
    }

    private static function listGeofences(Database $database, string $tenantKey): array
    {
        $tenantId = self::resolveTenantId($database, $tenantKey);
        $postgis = $database->hasPostgis();

        if ($postgis) {
            $rows = $database->all(
                "SELECT
                    id,
                    tenant_id,
                    zone_name,
                    zone_type,
                    center_lat::text AS center_lat,
                    center_lng::text AS center_lng,
                    radius_m::text AS radius_m,
                    is_active,
                    metadata::text AS metadata,
                    created_at,
                    CASE WHEN geom IS NOT NULL THEN ST_AsGeoJSON(geom)::text ELSE NULL END AS geometry
                 FROM public.geofence_zones
                 WHERE tenant_id = :tenant_id
                   AND is_active = TRUE
                 ORDER BY created_at DESC",
                ['tenant_id' => $tenantId]
            );
        } else {
            $rows = $database->all(
                "SELECT
                    id,
                    tenant_id,
                    zone_name,
                    zone_type,
                    center_lat::text AS center_lat,
                    center_lng::text AS center_lng,
                    radius_m::text AS radius_m,
                    is_active,
                    metadata::text AS metadata,
                    created_at
                 FROM public.geofence_zones
                 WHERE tenant_id = :tenant_id
                   AND is_active = TRUE
                 ORDER BY created_at DESC",
                ['tenant_id' => $tenantId]
            );
        }

        return array_map(
            static fn (array $row): array => self::mapZone($row, $postgis),
            $rows
        );
    }

    private static function checkGeofences(Database $database, string $tenantKey, float $latitude, float $longitude): array
    {
        $tenantId = self::resolveTenantId($database, $tenantKey);

        if ($database->hasPostgis()) {
            $rows = $database->all(
                "WITH probe AS (
                    SELECT ST_SetSRID(ST_MakePoint(:probe_lng, :probe_lat), 4326) AS geom
                 )
                 SELECT
                    gz.id,
                    gz.zone_name,
                    gz.zone_type,
                    CASE
                      WHEN gz.geom IS NOT NULL THEN ST_Contains(gz.geom, probe.geom)
                      ELSE ST_DWithin(
                        ST_SetSRID(ST_MakePoint(gz.center_lng::double precision, gz.center_lat::double precision), 4326)::geography,
                        probe.geom::geography,
                        gz.radius_m::double precision
                      )
                    END AS is_inside
                 FROM public.geofence_zones gz
                 CROSS JOIN probe
                 WHERE gz.tenant_id = :tenant_id
                   AND gz.is_active = TRUE",
                [
                    'probe_lng' => $longitude,
                    'probe_lat' => $latitude,
                    'tenant_id' => $tenantId,
                ]
            );
        } elseif ($database->hasFunction('haversine_km')) {
            $rows = $database->all(
                "SELECT
                    gz.id,
                    gz.zone_name,
                    gz.zone_type,
                    (haversine_km(gz.center_lat, gz.center_lng, :probe_lat, :probe_lng) * 1000 <= gz.radius_m) AS is_inside
                 FROM public.geofence_zones gz
                 WHERE gz.tenant_id = :tenant_id
                   AND gz.is_active = TRUE",
                [
                    'probe_lng' => $longitude,
                    'probe_lat' => $latitude,
                    'tenant_id' => $tenantId,
                ]
            );
        } else {
            $rows = $database->all(
                "SELECT
                    gz.id,
                    gz.zone_name,
                    gz.zone_type,
                    gz.center_lat::text AS center_lat,
                    gz.center_lng::text AS center_lng,
                    gz.radius_m::text AS radius_m
                 FROM public.geofence_zones gz
                 WHERE gz.tenant_id = :tenant_id
                   AND gz.is_active = TRUE",
                ['tenant_id' => $tenantId]
            );
        }

        return array_map(static function (array $row) use ($latitude, $longitude): array {
            $isInside = isset($row['is_inside'])
                ? self::toBool($row['is_inside'])
                : self::haversineMeters(
                    $latitude,
                    $longitude,
                    (float) $row['center_lat'],
                    (float) $row['center_lng']
                ) <= (float) $row['radius_m'];

            return [
                'zoneId' => (string) $row['id'],
                'zoneName' => (string) $row['zone_name'],
                'zoneType' => (string) $row['zone_type'],
                'isInside' => $isInside,
            ];
        }, $rows);
    }

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

    private static function ensureGeofenceSchema(Database $database): void
    {
        if (!$database->relationExists('public.geofence_zones')) {
            throw new RuntimeException('GEOFENCE_SCHEMA_MISSING');
        }
    }

    private static function mapZone(array $row, bool $postgis): array
    {
        return [
            'id' => (string) $row['id'],
            'tenantId' => (string) $row['tenant_id'],
            'zoneName' => (string) $row['zone_name'],
            'zoneType' => (string) $row['zone_type'],
            'centerLat' => $row['center_lat'] !== null ? (float) $row['center_lat'] : null,
            'centerLng' => $row['center_lng'] !== null ? (float) $row['center_lng'] : null,
            'radiusM' => (float) $row['radius_m'],
            'isActive' => self::toBool($row['is_active'] ?? true),
            'metadata' => self::decodeJson($row['metadata'] ?? '{}'),
            'createdAt' => self::toIso($row['created_at'] ?? null),
            'geometry' => $postgis && array_key_exists('geometry', $row) && $row['geometry'] !== null
                ? json_decode((string) $row['geometry'], true)
                : null,
        ];
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

        return (new \DateTimeImmutable((string) $value))->format(DATE_ATOM);
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

    private static function haversineMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadiusM = 6371000;
        $latDelta = deg2rad($lat2 - $lat1);
        $lngDelta = deg2rad($lng2 - $lng1);

        $a = sin($latDelta / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($lngDelta / 2) ** 2;

        return 2 * $earthRadiusM * asin(min(1.0, sqrt($a)));
    }

    // ── NATIVE ROUTING SERVICES AND SOLVERS ──

    private static function getOsrmUrl(): string
    {
        return rtrim($_ENV['OSRM_URL'] ?? 'https://router.project-osrm.org', '/');
    }

    private static function osrmRequest(string $url): ?array
    {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json']);
        $output = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || !$output) {
            return null;
        }

        return json_decode($output, true);
    }

    private static function toLogisticsResponse(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'tenantId' => (string) $row['tenant_id'],
            'inventoryItemId' => (string) $row['inventory_item_id'],
            'demandId' => $row['demand_id'],
            'routeMode' => (string) $row['route_mode'],
            'originLocationName' => (string) $row['origin_location_name'],
            'destinationOrganizationName' => (string) $row['destination_organization_name'],
            'destinationAddress' => (string) $row['destination_address'],
            'scheduledPickupAt' => self::toIso($row['scheduled_pickup_at'] ?? null),
            'scheduledDeliveryAt' => self::toIso($row['scheduled_delivery_at'] ?? null),
            'quantityAssigned' => (float) $row['quantity_assigned'],
            'municipalityName' => (string) $row['municipality_name'],
            'notes' => $row['notes'],
            'status' => (string) $row['status'],
            'originLatitude' => $row['origin_latitude'] !== null ? (float) $row['origin_latitude'] : null,
            'originLongitude' => $row['origin_longitude'] !== null ? (float) $row['origin_longitude'] : null,
            'destinationLatitude' => $row['destination_latitude'] !== null ? (float) $row['destination_latitude'] : null,
            'destinationLongitude' => $row['destination_longitude'] !== null ? (float) $row['destination_longitude'] : null,
            'createdAt' => self::toIso($row['created_at'] ?? null),
            'updatedAt' => self::toIso($row['updated_at'] ?? null),
        ];
    }

    private static function toPlanResponse(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'tenantId' => (string) $row['tenant_id'],
            'planName' => (string) $row['plan_name'],
            'planType' => (string) $row['plan_type'],
            'recursoId' => $row['recurso_id'],
            'totalStops' => (int) ($row['total_stops'] ?? 0),
            'totalDistanceKm' => (float) ($row['total_distance_km'] ?? 0),
            'estimatedDurationMin' => (int) ($row['estimated_duration_min'] ?? 0),
            'totalLoadKg' => (float) ($row['total_load_kg'] ?? 0),
            'maxCapacityKg' => (float) ($row['max_capacity_kg'] ?? 0),
            'windowStart' => self::toIso($row['window_start'] ?? null),
            'windowEnd' => self::toIso($row['window_end'] ?? null),
            'status' => (string) $row['status'],
            'optimizationScore' => $row['optimization_score'] !== null ? (float) $row['optimization_score'] : null,
            'notes' => $row['notes'],
            'metadata' => self::decodeJson($row['metadata'] ?? '{}'),
            'createdAt' => self::toIso($row['created_at'] ?? null),
            'updatedAt' => self::toIso($row['updated_at'] ?? null),
        ];
    }

    private static function toStopResponse(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'routePlanId' => (string) $row['route_plan_id'],
            'stopOrder' => (int) $row['stop_order'],
            'stopType' => (string) $row['stop_type'],
            'locationName' => (string) $row['location_name'],
            'address' => $row['address'],
            'latitude' => $row['latitude'] !== null ? (float) $row['latitude'] : null,
            'longitude' => $row['longitude'] !== null ? (float) $row['longitude'] : null,
            'logisticsOrderId' => $row['logistics_order_id'],
            'estimatedArrival' => self::toIso($row['estimated_arrival'] ?? null),
            'actualArrival' => self::toIso($row['actual_arrival'] ?? null),
            'estimatedDeparture' => self::toIso($row['estimated_departure'] ?? null),
            'actualDeparture' => self::toIso($row['actual_departure'] ?? null),
            'loadKg' => (float) ($row['load_kg'] ?? 0),
            'status' => (string) $row['status'],
            'notes' => $row['notes'],
            'metadata' => self::decodeJson($row['metadata'] ?? '{}'),
            'createdAt' => self::toIso($row['created_at'] ?? null),
        ];
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

    private static function optionalFloat(array $payload, string $key): ?float
    {
        if (!array_key_exists($key, $payload) || $payload[$key] === null || $payload[$key] === '') {
            return null;
        }
        $value = filter_var($payload[$key], FILTER_VALIDATE_FLOAT);
        return $value !== false ? (float) $value : null;
    }

    private static function requiredDate(array $payload, string $key, string $code, string $message): \DateTimeImmutable
    {
        if (!array_key_exists($key, $payload) || $payload[$key] === null || $payload[$key] === '') {
            Response::error(400, $code, $message);
        }
        try {
            return new \DateTimeImmutable((string) $payload[$key]);
        } catch (\Throwable) {
            Response::error(400, $code, $message);
        }
    }

    private static function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        return self::haversineMeters($lat1, $lng1, $lat2, $lng2) / 1000.0;
    }

    private static function nearestNeighbor(array $geoStops, array $nonGeoStops): array
    {
        $remaining = $geoStops;
        $ordered = [array_shift($remaining)];
        $totalDistanceKm = 0.0;

        while (count($remaining) > 0) {
            $last = $ordered[count($ordered) - 1];
            $bestIdx = 0;
            $bestDist = INF;
            for ($i = 0; $i < count($remaining); $i++) {
                $d = self::haversineKm(
                    (float) $last['latitude'],
                    (float) $last['longitude'],
                    (float) $remaining[$i]['latitude'],
                    (float) $remaining[$i]['longitude']
                );
                if ($d < $bestDist) {
                    $bestDist = $d;
                    $bestIdx = $i;
                }
            }
            $totalDistanceKm += $bestDist;
            $ordered[] = array_splice($remaining, $bestIdx, 1)[0];
        }

        $orderedIds = [];
        foreach ($ordered as $s) {
            $orderedIds[] = $s['id'];
        }
        foreach ($nonGeoStops as $s) {
            $orderedIds[] = $s['id'];
        }

        return [
            'orderedIds' => $orderedIds,
            'distanceKm' => $totalDistanceKm,
        ];
    }

    private static function tryOsrmTrip(array $geoStops, array &$warnings): ?array
    {
        try {
            $coords = [];
            foreach ($geoStops as $s) {
                $coords[] = $s['longitude'] . ',' . $s['latitude'];
            }
            $baseUrl = self::getOsrmUrl();
            $url = $baseUrl . '/trip/v1/driving/' . implode(';', $coords) . '?overview=full&geometries=polyline&steps=false&roundtrip=false&source=first&destination=last';
            
            $data = self::osrmRequest($url);
            if ($data === null || ($data['code'] ?? '') !== 'Ok' || empty($data['trips'])) {
                return null;
            }

            $trip = $data['trips'][0];
            $waypointOrder = [];
            foreach (($data['waypoints'] ?? []) as $wp) {
                $waypointOrder[] = (int) $wp['waypoint_index'];
            }

            if (empty($waypointOrder)) {
                return null;
            }

            $orderedIds = [];
            foreach ($waypointOrder as $idx) {
                if (isset($geoStops[$idx])) {
                    $orderedIds[] = $geoStops[$idx]['id'];
                }
            }

            return [
                'orderedIds' => $orderedIds,
                'distanceKm' => round(($trip['distance'] / 1000) * 100) / 100,
                'durationMin' => (int) ceil($trip['duration'] / 60),
                'geometry' => $trip['geometry'] ?? null,
            ];
        } catch (\Exception $err) {
            $warnings[] = 'OSRM trip error: ' . $err->getMessage();
            return null;
        }
    }

    private static function solveVrpInternal(array $params): array
    {
        $tenantId = $params['tenantId'];
        $scenarioName = $params['scenarioName'];
        $depotLat = (float) $params['depotLat'];
        $depotLng = (float) $params['depotLng'];
        $vehicles = $params['vehicles'];
        $stops = $params['stops'];
        $strategy = $params['strategy'] ?? 'clarke_wright';
        $createdBy = $params['createdBy'] ?? null;

        if (empty($vehicles)) {
            Response::error(400, 'NO_VEHICLES', 'Se requiere al menos un vehiculo.');
        }
        if (empty($stops)) {
            Response::error(400, 'NO_STOPS', 'Se requiere al menos una parada.');
        }

        // Sort vehicles by capacity descending
        usort($vehicles, static function ($a, $b) {
            return $b['capacityKg'] <=> $a['capacityKg'];
        });

        $warnings = [];
        $routingEngine = 'haversine';
        
        $allPoints = [['lat' => $depotLat, 'lng' => $depotLng]];
        foreach ($stops as $s) {
            $allPoints[] = ['lat' => (float) $s['latitude'], 'lng' => (float) $s['longitude']];
        }

        $matrix = null;
        $baseUrl = self::getOsrmUrl();

        // Try OSRM table
        $coords = [];
        foreach ($allPoints as $p) {
            $coords[] = $p['lng'] . ',' . $p['lat'];
        }
        $coordStr = implode(';', $coords);
        $url = $baseUrl . '/table/v1/driving/' . $coordStr . '?annotations=distance,duration';
        
        $data = self::osrmRequest($url);
        if ($data !== null && ($data['code'] ?? '') === 'Ok') {
            $routingEngine = 'osrm';
            
            $distances = [];
            foreach (($data['distances'] ?? []) as $row) {
                $newRow = [];
                foreach ($row as $d) {
                    $newRow[] = round(($d / 1000) * 100) / 100;
                }
                $distances[] = $newRow;
            }

            $durations = [];
            foreach (($data['durations'] ?? []) as $row) {
                $newRow = [];
                foreach ($row as $d) {
                    $newRow[] = round(($d / 60) * 100) / 100;
                }
                $durations[] = $newRow;
            }

            $matrix = ['distances' => $distances, 'durations' => $durations];
        } else {
            $warnings[] = 'Error contactando OSRM; usando distancia en linea recta.';
            $matrix = self::haversineMatrix($allPoints);
        }

        $dist = $matrix['distances'];
        $dur = $matrix['durations'];

        $n = count($stops);
        $savings = [];

        for ($i = 0; $i < $n; $i++) {
            for ($j = $i + 1; $j < $n; $j++) {
                $sij = $dist[0][$i + 1] + $dist[0][$j + 1] - $dist[$i + 1][$j + 1];
                if ($sij > 0) {
                    $savings[] = ['i' => $i, 'j' => $j, 'value' => $sij];
                }
            }
        }

        usort($savings, static function ($a, $b) {
            return $b['value'] <=> $a['value'];
        });

        // Initial routes
        $routeOf = [];
        $tempRoutes = [];
        for ($i = 0; $i < $n; $i++) {
            $routeOf[$i] = $i;
            $tempRoutes[$i] = [
                'stopIndices' => [$i],
                'totalLoadKg' => (float) $stops[$i]['loadKg'],
            ];
        }

        $maxCapacity = 0.0;
        foreach ($vehicles as $v) {
            if ((float) $v['capacityKg'] > $maxCapacity) {
                $maxCapacity = (float) $v['capacityKg'];
            }
        }

        // Merge routes
        foreach ($savings as $saving) {
            $i = $saving['i'];
            $j = $saving['j'];

            $ri = $routeOf[$i];
            $rj = $routeOf[$j];

            if ($ri === $rj) continue;

            $routeI = $tempRoutes[$ri] ?? null;
            $routeJ = $tempRoutes[$rj] ?? null;

            if ($routeI === null || $routeJ === null) continue;

            $iAtEnd = $routeI['stopIndices'][count($routeI['stopIndices']) - 1] === $i;
            $iAtStart = $routeI['stopIndices'][0] === $i;
            $jAtEnd = $routeJ['stopIndices'][count($routeJ['stopIndices']) - 1] === $j;
            $jAtStart = $routeJ['stopIndices'][0] === $j;

            if (!(($iAtEnd && $jAtStart) || ($iAtStart && $jAtEnd) || ($iAtEnd && $jAtEnd) || ($iAtStart && $jAtStart))) {
                continue;
            }

            $combinedLoad = $routeI['totalLoadKg'] + $routeJ['totalLoadKg'];
            if ($combinedLoad > $maxCapacity) continue;

            // Merge routeJ into routeI
            if ($iAtEnd && $jAtStart) {
                $merged = array_merge($routeI['stopIndices'], $routeJ['stopIndices']);
            } elseif ($jAtEnd && $iAtStart) {
                $merged = array_merge($routeJ['stopIndices'], $routeI['stopIndices']);
            } elseif ($iAtEnd && $jAtEnd) {
                $merged = array_merge($routeI['stopIndices'], array_reverse($routeJ['stopIndices']));
            } else {
                $merged = array_merge(array_reverse($routeI['stopIndices']), $routeJ['stopIndices']);
            }

            $tempRoutes[$ri]['stopIndices'] = $merged;
            $tempRoutes[$ri]['totalLoadKg'] = $combinedLoad;
            unset($tempRoutes[$rj]);

            foreach ($routeJ['stopIndices'] as $idx) {
                $routeOf[$idx] = $ri;
            }
        }

        $activeRoutes = array_values($tempRoutes);
        usort($activeRoutes, static function ($a, $b) {
            return $b['totalLoadKg'] <=> $a['totalLoadKg'];
        });

        $vehicleRoutes = [];
        $usedVehicles = [];
        $totalDistance = 0.0;
        $totalDuration = 0.0;
        $totalLoad = 0.0;
        $unserved = 0;

        foreach ($activeRoutes as $route) {
            $assigned = false;
            for ($vi = 0; $vi < count($vehicles); $vi++) {
                if (in_array($vi, $usedVehicles, true)) continue;
                if ((float) $vehicles[$vi]['capacityKg'] >= $route['totalLoadKg']) {
                    $usedVehicles[] = $vi;

                    $routeDistKm = 0.0;
                    $routeDurMin = 0.0;
                    $indices = $route['stopIndices'];

                    // depot -> first stop
                    $routeDistKm += $dist[0][$indices[0] + 1];
                    $routeDurMin += $dur[0][$indices[0] + 1];

                    // inter-stop legs
                    for ($k = 0; $k < count($indices) - 1; $k++) {
                        $routeDistKm += $dist[$indices[$k] + 1][$indices[$k + 1] + 1];
                        $routeDurMin += $dur[$indices[$k] + 1][$indices[$k + 1] + 1];
                    }

                    // last stop -> depot
                    $routeDistKm += $dist[$indices[count($indices) - 1] + 1][0];
                    $routeDurMin += $dur[$indices[count($indices) - 1] + 1][0];

                    $vehicle = $vehicles[$vi];
                    $routeStops = [];
                    foreach ($indices as $idx) {
                        $routeStops[] = $stops[$idx];
                    }

                    $vehicleRoutes[] = [
                        'vehicleIndex' => $vi,
                        'vehicleId' => $vehicle['id'],
                        'vehicleLabel' => $vehicle['label'],
                        'capacityKg' => (float) $vehicle['capacityKg'],
                        'assignedLoadKg' => round($route['totalLoadKg'] * 100) / 100,
                        'distanceKm' => round($routeDistKm * 100) / 100,
                        'durationMin' => round($routeDurMin * 100) / 100,
                        'stops' => $routeStops,
                        'geometry' => null,
                    ];

                    $totalDistance += $routeDistKm;
                    $totalDuration += $routeDurMin;
                    $totalLoad += $route['totalLoadKg'];
                    $assigned = true;
                    break;
                }
            }

            if (!$assigned) {
                $unserved += count($route['stopIndices']);
                $warnings[] = "No hay vehiculo con capacidad suficiente para ruta de " . $route['totalLoadKg'] . " kg (" . count($route['stopIndices']) . " paradas). Paradas no atendidas.";
            }
        }

        // Fetch OSRM real road route & geometry per vehicle
        if ($routingEngine === 'osrm') {
            for ($ri = 0; $ri < count($vehicleRoutes); $ri++) {
                $vr = &$vehicleRoutes[$ri];
                try {
                    $waypoints = [['lat' => $depotLat, 'lng' => $depotLng]];
                    foreach ($vr['stops'] as $s) {
                        $waypoints[] = ['lat' => (float) $s['latitude'], 'lng' => (float) $s['longitude']];
                    }
                    $waypoints[] = ['lat' => $depotLat, 'lng' => $depotLng];

                    $coords = [];
                    foreach ($waypoints as $wp) {
                        $coords[] = $wp['lng'] . ',' . $wp['lat'];
                    }
                    $coordStr = implode(';', $coords);
                    $url = $baseUrl . '/route/v1/driving/' . $coordStr . '?overview=full&geometries=polyline&steps=false';

                    $res = self::osrmRequest($url);
                    if ($res !== null && ($res['code'] ?? '') === 'Ok' && !empty($res['routes'])) {
                        $routeResult = $res['routes'][0];
                        $vr['geometry'] = $routeResult['geometry'] ?? null;
                        $vr['distanceKm'] = round(($routeResult['distance'] / 1000) * 100) / 100;
                        $vr['durationMin'] = (int) ceil($routeResult['duration'] / 60);
                    }
                } catch (\Exception $e) {
                    // keep matrix-based fallback
                }
            }

            // Recalculate totals
            $totalDistance = 0.0;
            $totalDuration = 0.0;
            foreach ($vehicleRoutes as $vr) {
                $totalDistance += $vr['distanceKm'];
                $totalDuration += $vr['durationMin'];
            }
        }

        return [
            'id' => Uuid::v4(),
            'tenantId' => $tenantId,
            'scenarioName' => $scenarioName,
            'depotLat' => $depotLat,
            'depotLng' => $depotLng,
            'strategy' => $strategy,
            'status' => 'solved',
            'totalVehiclesUsed' => count($vehicleRoutes),
            'totalDistanceKm' => round($totalDistance * 100) / 100,
            'totalDurationMin' => round($totalDuration * 100) / 100,
            'totalLoadKg' => round($totalLoad * 100) / 100,
            'unservedStops' => $unserved,
            'routingEngine' => $routingEngine,
            'vehicleRoutes' => $vehicleRoutes,
            'warnings' => $warnings,
            'metadata' => (object) [],
            'createdBy' => $createdBy,
            'createdAt' => (new \DateTimeImmutable())->format(DATE_ATOM),
        ];
    }

    private static function haversineMatrix(array $points): array
    {
        $n = count($points);
        $distances = array_fill(0, $n, array_fill(0, $n, 0.0));
        $durations = array_fill(0, $n, array_fill(0, $n, 0.0));
        $roadFactor = 1.3;
        $avgSpeedKmh = 30.0;

        for ($i = 0; $i < $n; $i++) {
            for ($j = $i + 1; $j < $n; $j++) {
                $km = self::haversineKm((float) $points[$i]['lat'], (float) $points[$i]['lng'], (float) $points[$j]['lat'], (float) $points[$j]['lng']) * $roadFactor;
                $min = ($km / $avgSpeedKmh) * 60;
                $distances[$i][$j] = round($km * 100) / 100;
                $distances[$j][$i] = $distances[$i][$j];
                $durations[$i][$j] = round($min * 100) / 100;
                $durations[$j][$i] = $durations[$i][$j];
            }
        }

        return ['distances' => $distances, 'durations' => $durations];
    }
}
