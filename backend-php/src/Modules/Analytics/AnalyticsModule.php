<?php
declare(strict_types=1);

namespace Agrored\Modules\Analytics;

use Agrored\Database\Database;
use Agrored\Http\Request;
use Agrored\Http\Response;
use Agrored\Http\Router;
use RuntimeException;

final class AnalyticsModule
{
    private const MAP_LAYERS = [
        'producers',
        'offers',
        'canteens',
        'rescues',
        'incidents',
        'demands',
        'resources',
    ];

    public static function register(Router $router, Database $database): void
    {
        $router->get('/api/v1/analytics/summary', static function (Request $request) use ($database): void {
            $tenantKey = self::tenantKeyFromRequest($request);

            try {
                Response::success(self::summary($database, $tenantKey));
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }
        });

        $router->get('/api/v1/analytics/territorial-overview', static function () use ($database): void {
            Response::success(self::territorialOverview($database));
        });

        $router->get('/api/v1/analytics/map/nearby/producers', static function (Request $request) use ($database): void {
            $lng = self::requiredFloatQuery($request, 'lng', -180, 180, 'INVALID_NEARBY_QUERY', 'Query invalido. Requeridos: ?lng=&lat=  Opcional: &radiusKm=');
            $lat = self::requiredFloatQuery($request, 'lat', -90, 90, 'INVALID_NEARBY_QUERY', 'Query invalido. Requeridos: ?lng=&lat=  Opcional: &radiusKm=');
            $radiusKm = self::optionalFloatQuery($request, 'radiusKm', 10, 0.1, 100, 'INVALID_NEARBY_QUERY', 'Query invalido. Requeridos: ?lng=&lat=  Opcional: &radiusKm=');

            Response::success(self::nearbyProducers($database, $lng, $lat, $radiusKm));
        });

        $router->get('/api/v1/analytics/map/hierarchy/departamentos', static function () use ($database): void {
            Response::success(self::departamentos($database));
        });

        $router->get('/api/v1/analytics/map/hierarchy/municipios', static function (Request $request) use ($database): void {
            $departamentoId = null;
            if ($request->query('departamentoId') !== null) {
                $departamentoId = filter_var($request->query('departamentoId'), FILTER_VALIDATE_INT);
                if ($departamentoId === false || $departamentoId <= 0) {
                    Response::error(400, 'INVALID_FILTER', 'Filtro invalido para municipios.');
                }
            }

            Response::success(self::municipios($database, $departamentoId));
        });

        $router->get('/api/v1/analytics/spatial/details', static function (Request $request) use ($database): void {
            $type = (string) $request->query('type');
            $id = (string) $request->query('id');

            if ($type !== 'producer' && $type !== 'client') {
                Response::error(400, 'INVALID_TYPE', 'El parametro type debe ser producer o client.');
            }

            if ($id === '') {
                Response::error(400, 'INVALID_ID', 'El parametro id es requerido.');
            }

            try {
                if ($type === 'producer') {
                    $producer = $database->one("SELECT organization_name FROM public.producers WHERE id = :id", ['id' => $id]);
                    $name = $producer ? $producer['organization_name'] : 'Productor';

                    $offers = $database->all(
                        "SELECT title, product_name, category, unit, quantity_available, price_amount, status 
                         FROM public.offers 
                         WHERE producer_id = :id AND deleted_at IS NULL AND status = 'published'
                         ORDER BY product_name ASC",
                        ['id' => $id]
                    );

                    Response::success([
                        'type' => 'producer',
                        'name' => $name,
                        'offers' => array_map(static function (array $row): array {
                            return [
                                'title' => $row['title'],
                                'productName' => $row['product_name'],
                                'category' => $row['category'],
                                'unit' => $row['unit'],
                                'quantityAvailable' => (float) $row['quantity_available'],
                                'priceAmount' => (float) $row['price_amount'],
                                'status' => $row['status']
                            ];
                        }, $offers)
                    ]);
                } else {
                    $demand = $database->one("SELECT organization_name FROM public.demands WHERE id = :id", ['id' => $id]);
                    $name = $demand ? $demand['organization_name'] : 'Institución';

                    $demands = $database->all(
                        "SELECT product_name, category, unit, quantity_required, status, needed_by
                         FROM public.demands
                         WHERE organization_name = :name AND deleted_at IS NULL AND status = 'open'
                         ORDER BY product_name ASC",
                        ['name' => $name]
                    );

                    $inventory = $database->all(
                        "SELECT product_name, category, unit, quantity_on_hand
                         FROM public.inventory_items
                         WHERE storage_location_name = :name AND deleted_at IS NULL
                         ORDER BY product_name ASC",
                        ['name' => $name]
                    );

                    Response::success([
                        'type' => 'client',
                        'name' => $name,
                        'demands' => array_map(static function (array $row): array {
                            return [
                                'productName' => $row['product_name'],
                                'category' => $row['category'],
                                'unit' => $row['unit'],
                                'quantityRequired' => (float) $row['quantity_required'],
                                'status' => $row['status'],
                                'neededBy' => $row['needed_by']
                            ];
                        }, $demands),
                        'inventory' => array_map(static function (array $row): array {
                            return [
                                'productName' => $row['product_name'],
                                'category' => $row['category'],
                                'unit' => $row['unit'],
                                'quantityOnHand' => (float) $row['quantity_on_hand']
                            ];
                        }, $inventory)
                    ]);
                }
            } catch (\Throwable $e) {
                Response::error(500, 'SPATIAL_ERROR', $e->getMessage());
            }
        });

        $router->get('/api/v1/analytics/map/{layer}', static function (Request $request) use ($database): void {
            $layer = (string) $request->route('layer');
            if (!in_array($layer, self::MAP_LAYERS, true)) {
                Response::error(
                    400,
                    'INVALID_MAP_LAYER',
                    'Capa invalida. Capas disponibles: ' . implode(', ', self::MAP_LAYERS)
                );
            }

            $bbox = self::bboxFromRequest($request);
            Response::success(self::mapLayer($database, $layer, $bbox));
        });
    }

    private static function summary(Database $database, ?string $tenantKey): array
    {
        $tenant = $tenantKey !== null ? self::resolveTenant($database, $tenantKey) : null;
        $tenantId = $tenant['id'] ?? null;
        $params = [];

        $tenantFilter = '';
        $operationsTenantFilter = '';
        if ($tenantId !== null) {
            $tenantFilter = ' AND tenant_id = :tenant_id';
            $operationsTenantFilter = ' AND tenant_id = :tenant_id';
            $params['tenant_id'] = $tenantId;
        }

        $row = $database->one(
            "SELECT
                (SELECT COUNT(*) FROM public.users WHERE deleted_at IS NULL{$tenantFilter}) AS users,
                (SELECT COUNT(*) FROM public.producers WHERE deleted_at IS NULL{$tenantFilter}) AS producers,
                (SELECT COUNT(*) FROM public.offers WHERE deleted_at IS NULL{$tenantFilter}) AS offers,
                (SELECT COUNT(*) FROM public.rescues WHERE deleted_at IS NULL{$tenantFilter}) AS rescues,
                (SELECT COUNT(*) FROM public.demands WHERE deleted_at IS NULL{$tenantFilter}) AS demands,
                (SELECT COUNT(*) FROM public.inventory_items WHERE deleted_at IS NULL{$tenantFilter}) AS inventory_items,
                (SELECT COUNT(*) FROM public.logistics_orders WHERE deleted_at IS NULL{$tenantFilter}) AS logistics_orders,
                (SELECT COUNT(*) FROM public.incidents WHERE deleted_at IS NULL{$tenantFilter}) AS incidents,
                (SELECT COUNT(*) FROM public.notifications WHERE deleted_at IS NULL{$tenantFilter}) AS notifications,
                (SELECT COUNT(*) FROM public.demands WHERE deleted_at IS NULL AND status = 'open'{$operationsTenantFilter}) AS open_demands,
                (SELECT COUNT(*) FROM public.rescues WHERE deleted_at IS NULL AND status = 'scheduled'{$operationsTenantFilter}) AS scheduled_rescues,
                (SELECT COALESCE(SUM(quantity_on_hand - quantity_reserved), 0) FROM public.inventory_items WHERE deleted_at IS NULL{$tenantFilter}) AS available_inventory_units,
                (SELECT COALESCE(SUM(quantity_reserved), 0) FROM public.inventory_items WHERE deleted_at IS NULL{$tenantFilter}) AS reserved_inventory_units,
                (SELECT COUNT(*) FROM public.logistics_orders WHERE deleted_at IS NULL AND status = 'scheduled'{$operationsTenantFilter}) AS scheduled_logistics,
                (SELECT COUNT(*) FROM public.incidents WHERE deleted_at IS NULL AND status = 'open'{$operationsTenantFilter}) AS open_incidents,
                (SELECT COUNT(*) FROM public.notifications WHERE deleted_at IS NULL AND status = 'pending'{$operationsTenantFilter}) AS pending_notifications",
            $params
        );

        if ($row === null) {
            return [
                'tenantId' => $tenantId,
                'tenantCode' => $tenant['code'] ?? null,
                'tenantName' => $tenant['name'] ?? null,
                'totals' => [],
                'operations' => [],
                'generatedAt' => gmdate(DATE_ATOM),
            ];
        }

        return [
            'tenantId' => $tenantId,
            'tenantCode' => $tenant['code'] ?? null,
            'tenantName' => $tenant['name'] ?? null,
            'totals' => [
                'users' => (int) $row['users'],
                'producers' => (int) $row['producers'],
                'offers' => (int) $row['offers'],
                'rescues' => (int) $row['rescues'],
                'demands' => (int) $row['demands'],
                'inventoryItems' => (int) $row['inventory_items'],
                'logisticsOrders' => (int) $row['logistics_orders'],
                'incidents' => (int) $row['incidents'],
                'notifications' => (int) $row['notifications'],
            ],
            'operations' => [
                'openDemands' => (int) $row['open_demands'],
                'scheduledRescues' => (int) $row['scheduled_rescues'],
                'availableInventoryUnits' => (float) $row['available_inventory_units'],
                'reservedInventoryUnits' => (float) $row['reserved_inventory_units'],
                'scheduledLogistics' => (int) $row['scheduled_logistics'],
                'openIncidents' => (int) $row['open_incidents'],
                'pendingNotifications' => (int) $row['pending_notifications'],
            ],
            'generatedAt' => gmdate(DATE_ATOM),
        ];
    }

    private static function territorialOverview(Database $database): array
    {
        $rows = $database->all(
            "WITH producer_counts AS (
                SELECT tenant_id, COUNT(*) AS producers
                FROM public.producers
                WHERE deleted_at IS NULL
                GROUP BY tenant_id
             ),
             offer_counts AS (
                SELECT tenant_id, COUNT(*) AS offers
                FROM public.offers
                WHERE deleted_at IS NULL
                GROUP BY tenant_id
             ),
             demand_counts AS (
                SELECT tenant_id, COUNT(*) AS open_demands
                FROM public.demands
                WHERE deleted_at IS NULL AND status = 'open'
                GROUP BY tenant_id
             ),
             inventory_counts AS (
                SELECT tenant_id, COALESCE(SUM(quantity_on_hand - quantity_reserved), 0) AS inventory_units
                FROM public.inventory_items
                WHERE deleted_at IS NULL
                GROUP BY tenant_id
             ),
             logistics_counts AS (
                SELECT tenant_id, COUNT(*) AS scheduled_logistics
                FROM public.logistics_orders
                WHERE deleted_at IS NULL AND status = 'scheduled'
                GROUP BY tenant_id
             ),
             incident_counts AS (
                SELECT tenant_id, COUNT(*) AS open_incidents
                FROM public.incidents
                WHERE deleted_at IS NULL AND status = 'open'
                GROUP BY tenant_id
             ),
             notification_counts AS (
                SELECT tenant_id, COUNT(*) AS pending_notifications
                FROM public.notifications
                WHERE deleted_at IS NULL AND status = 'pending'
                GROUP BY tenant_id
             )
             SELECT
                t.id AS tenant_id,
                t.code AS tenant_code,
                t.name AS tenant_name,
                COALESCE(pc.producers, 0) AS producers,
                COALESCE(oc.offers, 0) AS offers,
                COALESCE(dc.open_demands, 0) AS open_demands,
                COALESCE(ic.inventory_units, 0) AS inventory_units,
                COALESCE(lc.scheduled_logistics, 0) AS scheduled_logistics,
                COALESCE(nc.open_incidents, 0) AS open_incidents,
                COALESCE(fc.pending_notifications, 0) AS pending_notifications
             FROM public.tenants t
             LEFT JOIN producer_counts pc ON pc.tenant_id = t.id
             LEFT JOIN offer_counts oc ON oc.tenant_id = t.id
             LEFT JOIN demand_counts dc ON dc.tenant_id = t.id
             LEFT JOIN inventory_counts ic ON ic.tenant_id = t.id
             LEFT JOIN logistics_counts lc ON lc.tenant_id = t.id
             LEFT JOIN incident_counts nc ON nc.tenant_id = t.id
             LEFT JOIN notification_counts fc ON fc.tenant_id = t.id
             ORDER BY t.name ASC"
        );

        return array_map(static function (array $row): array {
            return [
                'tenantId' => (string) $row['tenant_id'],
                'tenantCode' => (string) $row['tenant_code'],
                'tenantName' => (string) $row['tenant_name'],
                'producers' => (int) $row['producers'],
                'offers' => (int) $row['offers'],
                'openDemands' => (int) $row['open_demands'],
                'inventoryUnits' => (float) $row['inventory_units'],
                'scheduledLogistics' => (int) $row['scheduled_logistics'],
                'openIncidents' => (int) $row['open_incidents'],
                'pendingNotifications' => (int) $row['pending_notifications'],
            ];
        }, $rows);
    }

    private static function mapLayer(Database $database, string $layer, ?array $bbox): array
    {
        return match ($layer) {
            'producers' => self::producers($database, $bbox),
            'offers' => self::offers($database, $bbox),
            'canteens' => self::canteens($database, $bbox),
            'rescues' => self::rescues($database, $bbox),
            'incidents' => self::incidents($database, $bbox),
            'demands' => self::demands($database, $bbox),
            'resources' => self::resources($database, $bbox),
            default => self::featureCollection([]),
        };
    }

    private static function producers(Database $database, ?array $bbox): array
    {
        if ($database->relationExists('public.v_mapa_productores')) {
            [$viewBboxSql, $viewBboxParams] = self::bboxClause($bbox, 'longitud', 'latitud', 'view_');
            $rows = $database->all(
                "SELECT id, nombre, tipo, contact_name, contact_phone, product_categories, status, zona, comuna, municipio, departamento, longitud, latitud
                 FROM public.v_mapa_productores
                 WHERE 1 = 1{$viewBboxSql}",
                $viewBboxParams
            );
        } else {
            [$rawBboxSql, $rawBboxParams] = self::bboxClause($bbox, 'p.longitude', 'p.latitude', 'raw_');
            $rows = $database->all(
                "SELECT
                    p.id,
                    p.organization_name AS nombre,
                    p.producer_type AS tipo,
                    p.contact_name,
                    p.contact_phone,
                    p.product_categories,
                    p.status,
                    NULL AS zona,
                    NULL AS comuna,
                    p.municipality_name AS municipio,
                    NULL AS departamento,
                    p.longitude::text AS longitud,
                    p.latitude::text AS latitud
                 FROM public.producers p
                 WHERE p.deleted_at IS NULL
                   AND p.latitude IS NOT NULL
                   AND p.longitude IS NOT NULL{$rawBboxSql}",
                $rawBboxParams
            );
        }

        $features = array_map(static function (array $row): array {
            return self::pointFeature(
                (float) $row['longitud'],
                (float) $row['latitud'],
                [
                    'id' => (string) $row['id'],
                    'nombre' => (string) $row['nombre'],
                    'tipo' => (string) $row['tipo'],
                    'contactName' => (string) ($row['contact_name'] ?? ''),
                    'contactPhone' => (string) ($row['contact_phone'] ?? ''),
                    'productCategories' => self::pgArrayToArray($row['product_categories'] ?? []),
                    'status' => (string) ($row['status'] ?? ''),
                    'zona' => $row['zona'],
                    'comuna' => $row['comuna'],
                    'municipio' => $row['municipio'],
                    'departamento' => $row['departamento'],
                ]
            );
        }, $rows);

        return self::featureCollection($features);
    }

    private static function offers(Database $database, ?array $bbox): array
    {
        if ($database->relationExists('public.v_mapa_ofertas')) {
            [$viewBboxSql, $viewBboxParams] = self::bboxClause($bbox, 'longitud', 'latitud', 'view_');
            $rows = $database->all(
                "SELECT id, title, product_name, category, quantity_available, unit, price_amount, currency, available_from, available_until, punto_entrega, status, productor, contact_phone, longitud, latitud
                 FROM public.v_mapa_ofertas
                 WHERE 1 = 1{$viewBboxSql}",
                $viewBboxParams
            );
        } else {
            [$rawBboxSql, $rawBboxParams] = self::bboxClause($bbox, 'o.longitude', 'o.latitude', 'raw_');
            $rows = $database->all(
                "SELECT
                    o.id,
                    o.title,
                    o.product_name,
                    o.category,
                    o.quantity_available,
                    o.unit,
                    o.price_amount,
                    o.currency,
                    o.available_from,
                    o.available_until,
                    NULL AS punto_entrega,
                    o.status,
                    p.organization_name AS productor,
                    p.contact_phone,
                    o.longitude::text AS longitud,
                    o.latitude::text AS latitud
                 FROM public.offers o
                 JOIN public.producers p ON p.id = o.producer_id
                 WHERE o.deleted_at IS NULL
                   AND o.status = 'published'
                   AND o.latitude IS NOT NULL
                   AND o.longitude IS NOT NULL{$rawBboxSql}",
                $rawBboxParams
            );
        }

        $features = array_map(static function (array $row): array {
            return self::pointFeature(
                (float) $row['longitud'],
                (float) $row['latitud'],
                [
                    'id' => (string) $row['id'],
                    'title' => (string) $row['title'],
                    'productName' => (string) $row['product_name'],
                    'category' => (string) $row['category'],
                    'quantityAvailable' => (float) $row['quantity_available'],
                    'unit' => (string) $row['unit'],
                    'priceAmount' => $row['price_amount'] !== null ? (float) $row['price_amount'] : null,
                    'currency' => $row['currency'],
                    'availableFrom' => self::toIso($row['available_from'] ?? null),
                    'availableUntil' => self::toIso($row['available_until'] ?? null),
                    'puntoEntrega' => $row['punto_entrega'],
                    'status' => (string) $row['status'],
                    'productor' => (string) $row['productor'],
                    'contactPhone' => (string) ($row['contact_phone'] ?? ''),
                ]
            );
        }, $rows);

        return self::featureCollection($features);
    }

    private static function canteens(Database $database, ?array $bbox): array
    {
        if (!$database->relationExists('public.v_mapa_comedores')) {
            return self::featureCollection([]);
        }

        [$bboxSql, $params] = self::bboxClause($bbox, 'longitud', 'latitud', 'bbox_');
        $rows = $database->all(
            "SELECT id, nombre, tipo, direccion, capacidad_diaria, beneficiarios_actuales, horario_atencion, responsable, telefono, estado, zona, comuna, municipio, departamento, longitud, latitud
             FROM public.v_mapa_comedores
             WHERE 1 = 1{$bboxSql}",
            $params
        );

        $features = array_map(static function (array $row): array {
            return self::pointFeature(
                (float) $row['longitud'],
                (float) $row['latitud'],
                [
                    'id' => (int) $row['id'],
                    'nombre' => (string) $row['nombre'],
                    'tipo' => (string) $row['tipo'],
                    'direccion' => (string) ($row['direccion'] ?? ''),
                    'capacidadDiaria' => $row['capacidad_diaria'] !== null ? (int) $row['capacidad_diaria'] : null,
                    'beneficiariosActuales' => (int) $row['beneficiarios_actuales'],
                    'horarioAtencion' => $row['horario_atencion'],
                    'responsable' => $row['responsable'],
                    'telefono' => $row['telefono'],
                    'estado' => (string) ($row['estado'] ?? ''),
                    'zona' => $row['zona'],
                    'comuna' => $row['comuna'],
                    'municipio' => $row['municipio'],
                    'departamento' => $row['departamento'],
                ]
            );
        }, $rows);

        return self::featureCollection($features);
    }

    private static function rescues(Database $database, ?array $bbox): array
    {
        [$bboxSql, $params] = self::bboxClause($bbox, 'longitude', 'latitude', 'bbox_');
        $rows = $database->all(
            "SELECT id, product_name, quantity, unit, status, scheduled_date, latitude::text AS latitude, longitude::text AS longitude
             FROM public.rescues
             WHERE deleted_at IS NULL
               AND latitude IS NOT NULL
               AND longitude IS NOT NULL{$bboxSql}",
            $params
        );

        $features = array_map(static function (array $row): array {
            return self::pointFeature(
                (float) $row['longitude'],
                (float) $row['latitude'],
                [
                    'id' => (string) $row['id'],
                    'productName' => (string) $row['product_name'],
                    'quantity' => (float) $row['quantity'],
                    'unit' => (string) $row['unit'],
                    'status' => (string) $row['status'],
                    'scheduledDate' => self::toIso($row['scheduled_date'] ?? null),
                ]
            );
        }, $rows);

        return self::featureCollection($features);
    }

    private static function incidents(Database $database, ?array $bbox): array
    {
        [$bboxSql, $params] = self::bboxClause($bbox, 'longitude', 'latitude', 'bbox_');
        $rows = $database->all(
            "SELECT id, title, category, severity, status, created_at, latitude::text AS latitude, longitude::text AS longitude
             FROM public.incidents
             WHERE deleted_at IS NULL
               AND latitude IS NOT NULL
               AND longitude IS NOT NULL{$bboxSql}",
            $params
        );

        $features = array_map(static function (array $row): array {
            return self::pointFeature(
                (float) $row['longitude'],
                (float) $row['latitude'],
                [
                    'id' => (string) $row['id'],
                    'title' => (string) $row['title'],
                    'category' => (string) $row['category'],
                    'severity' => (string) $row['severity'],
                    'status' => (string) $row['status'],
                    'reportedAt' => self::toIso($row['created_at'] ?? null),
                ]
            );
        }, $rows);

        return self::featureCollection($features);
    }

    private static function demands(Database $database, ?array $bbox): array
    {
        [$bboxSql, $params] = self::bboxClause($bbox, 'longitude', 'latitude', 'bbox_');
        $rows = $database->all(
            "SELECT id, organization_name, product_name, quantity_required, unit, status, required_by, latitude::text AS latitude, longitude::text AS longitude
             FROM public.demands
             WHERE deleted_at IS NULL
               AND latitude IS NOT NULL
               AND longitude IS NOT NULL{$bboxSql}",
            $params
        );

        $features = array_map(static function (array $row): array {
            return self::pointFeature(
                (float) $row['longitude'],
                (float) $row['latitude'],
                [
                    'id' => (string) $row['id'],
                    'organizationName' => (string) ($row['organization_name'] ?? 'Institución'),
                    'productName' => (string) $row['product_name'],
                    'quantityRequired' => (float) $row['quantity_required'],
                    'unit' => (string) $row['unit'],
                    'status' => (string) $row['status'],
                    'requiredBy' => self::toIso($row['required_by'] ?? null),
                ]
            );
        }, $rows);

        return self::featureCollection($features);
    }

    private static function resources(Database $database, ?array $bbox): array
    {
        [$bboxSql, $params] = self::bboxClause($bbox, 'ta.longitude', 'ta.latitude', 'bbox_');
        $rows = $database->all(
            "SELECT
                r.id,
                r.nombre,
                r.tipo,
                r.placa,
                r.telefono,
                r.estado,
                ta.velocidad::text AS velocidad,
                ta.orden_id AS orden_actual_id,
                ta.actualizado_at,
                ta.longitude::text AS longitude,
                ta.latitude::text AS latitude
             FROM public.recursos r
             JOIN public.tracking_actual ta ON ta.recurso_id = r.id
             WHERE r.estado IN ('disponible', 'en_ruta')
               AND ta.latitude IS NOT NULL
               AND ta.longitude IS NOT NULL{$bboxSql}",
            $params
        );

        $features = array_map(static function (array $row): array {
            return self::pointFeature(
                (float) $row['longitude'],
                (float) $row['latitude'],
                [
                    'id' => (string) $row['id'],
                    'nombre' => (string) $row['nombre'],
                    'tipo' => (string) $row['tipo'],
                    'placa' => $row['placa'],
                    'telefono' => $row['telefono'],
                    'estado' => (string) $row['estado'],
                    'velocidad' => $row['velocidad'] !== null ? (float) $row['velocidad'] : null,
                    'ordenActualId' => $row['orden_actual_id'],
                    'ultimaActualizacion' => self::toIso($row['actualizado_at'] ?? null),
                ]
            );
        }, $rows);

        return self::featureCollection($features);
    }

    private static function nearbyProducers(Database $database, float $lng, float $lat, float $radiusKm): array
    {
        if ($database->relationExists('public.v_mapa_productores') && $database->hasPostgis()) {
            $rows = $database->all(
                "WITH origin AS (
                    SELECT ST_SetSRID(ST_MakePoint(:origin_lng, :origin_lat), 4326)::geography AS geom
                 )
                 SELECT
                    id,
                    nombre,
                    tipo,
                    contact_name,
                    contact_phone,
                    product_categories,
                    status,
                    zona,
                    comuna,
                    municipio,
                    departamento,
                    longitud,
                    latitud,
                    ROUND(
                      ST_Distance(
                        ST_SetSRID(ST_MakePoint(longitud::double precision, latitud::double precision), 4326)::geography,
                        origin.geom
                      )
                    )::integer AS distancia_metros
                 FROM public.v_mapa_productores
                 CROSS JOIN origin
                 WHERE ST_DWithin(
                    ST_SetSRID(ST_MakePoint(longitud::double precision, latitud::double precision), 4326)::geography,
                    origin.geom,
                    :radius_m
                 )
                 ORDER BY distancia_metros ASC",
                [
                    'origin_lng' => $lng,
                    'origin_lat' => $lat,
                    'radius_m' => (int) round($radiusKm * 1000),
                ]
            );
        } elseif ($database->relationExists('public.v_mapa_productores') && $database->hasFunction('haversine_km')) {
            $rows = $database->all(
                "SELECT
                    id,
                    nombre,
                    tipo,
                    contact_name,
                    contact_phone,
                    product_categories,
                    status,
                    zona,
                    comuna,
                    municipio,
                    departamento,
                    longitud,
                    latitud,
                    ROUND(haversine_km(latitud::numeric, longitud::numeric, :origin_lat, :origin_lng) * 1000)::integer AS distancia_metros
                 FROM public.v_mapa_productores
                 WHERE haversine_km(latitud::numeric, longitud::numeric, :origin_lat, :origin_lng) <= :radius_km
                 ORDER BY distancia_metros ASC",
                [
                    'origin_lng' => $lng,
                    'origin_lat' => $lat,
                    'radius_km' => $radiusKm,
                ]
            );
        } elseif ($database->hasPostgis()) {
            $rows = $database->all(
                "WITH origin AS (
                    SELECT ST_SetSRID(ST_MakePoint(:origin_lng, :origin_lat), 4326)::geography AS geom
                 )
                 SELECT
                    p.id,
                    p.organization_name AS nombre,
                    p.producer_type AS tipo,
                    p.contact_name,
                    p.contact_phone,
                    p.product_categories,
                    p.status,
                    z.nombre AS zona,
                    c.nombre AS comuna,
                    m.nombre AS municipio,
                    d.nombre AS departamento,
                    p.longitude::text AS longitud,
                    p.latitude::text AS latitud,
                    ROUND(
                      ST_Distance(
                        ST_SetSRID(ST_MakePoint(p.longitude::double precision, p.latitude::double precision), 4326)::geography,
                        origin.geom
                      )
                    )::integer AS distancia_metros
                 FROM public.producers p
                 CROSS JOIN origin
                 LEFT JOIN public.zona z ON z.id = p.zona_id
                 LEFT JOIN public.comuna c ON c.id = p.comuna_id
                 LEFT JOIN public.municipio m ON m.id = p.municipio_id
                 LEFT JOIN public.departamento d ON d.id = m.departamento_id
                 WHERE p.deleted_at IS NULL
                   AND p.latitude IS NOT NULL
                   AND p.longitude IS NOT NULL
                   AND ST_DWithin(
                     ST_SetSRID(ST_MakePoint(p.longitude::double precision, p.latitude::double precision), 4326)::geography,
                     origin.geom,
                     :radius_m
                   )
                 ORDER BY distancia_metros ASC",
                [
                    'origin_lng' => $lng,
                    'origin_lat' => $lat,
                    'radius_m' => (int) round($radiusKm * 1000),
                ]
            );
        } else {
            $rows = $database->all(
                "SELECT
                    p.id,
                    p.organization_name AS nombre,
                    p.producer_type AS tipo,
                    p.contact_name,
                    p.contact_phone,
                    p.product_categories,
                    p.status,
                    z.nombre AS zona,
                    c.nombre AS comuna,
                    m.nombre AS municipio,
                    d.nombre AS departamento,
                    p.longitude::text AS longitud,
                    p.latitude::text AS latitud,
                    ROUND(haversine_km(p.latitude, p.longitude, :origin_lat, :origin_lng) * 1000)::integer AS distancia_metros
                 FROM public.producers p
                 LEFT JOIN public.zona z ON z.id = p.zona_id
                 LEFT JOIN public.comuna c ON c.id = p.comuna_id
                 LEFT JOIN public.municipio m ON m.id = p.municipio_id
                 LEFT JOIN public.departamento d ON d.id = m.departamento_id
                 WHERE p.deleted_at IS NULL
                   AND p.latitude IS NOT NULL
                   AND p.longitude IS NOT NULL
                   AND haversine_km(p.latitude, p.longitude, :origin_lat, :origin_lng) <= :radius_km
                 ORDER BY distancia_metros ASC",
                [
                    'origin_lng' => $lng,
                    'origin_lat' => $lat,
                    'radius_km' => $radiusKm,
                ]
            );
        }

        $features = array_map(static function (array $row): array {
            return self::pointFeature(
                (float) $row['longitud'],
                (float) $row['latitud'],
                [
                    'id' => (string) $row['id'],
                    'nombre' => (string) $row['nombre'],
                    'tipo' => (string) $row['tipo'],
                    'contactName' => (string) ($row['contact_name'] ?? ''),
                    'contactPhone' => (string) ($row['contact_phone'] ?? ''),
                    'productCategories' => self::pgArrayToArray($row['product_categories'] ?? []),
                    'status' => (string) ($row['status'] ?? ''),
                    'zona' => $row['zona'],
                    'comuna' => $row['comuna'],
                    'municipio' => $row['municipio'],
                    'departamento' => $row['departamento'],
                    'distanciaMetros' => (int) $row['distancia_metros'],
                ]
            );
        }, $rows);

        return self::featureCollection($features);
    }

    private static function departamentos(Database $database): array
    {
        if (!$database->hasPostgis()) {
            return self::featureCollection([]);
        }

        $rows = $database->all(
            "SELECT
                d.id,
                d.nombre,
                d.pais_id AS parent_id,
                p.nombre AS parent_nombre,
                ST_AsGeoJSON(d.geom)::text AS geojson
             FROM public.departamento d
             LEFT JOIN public.pais p ON p.id = d.pais_id
             WHERE d.geom IS NOT NULL
             ORDER BY d.nombre"
        );

        $features = array_map(static function (array $row): array {
            return [
                'type' => 'Feature',
                'geometry' => json_decode((string) $row['geojson'], true),
                'properties' => [
                    'id' => (int) $row['id'],
                    'nombre' => (string) $row['nombre'],
                    'parentId' => $row['parent_id'] !== null ? (int) $row['parent_id'] : null,
                    'parentNombre' => $row['parent_nombre'],
                ],
            ];
        }, $rows);

        return self::featureCollection($features);
    }

    private static function municipios(Database $database, ?int $departamentoId): array
    {
        if (!$database->hasPostgis()) {
            return self::featureCollection([]);
        }

        $where = '';
        $params = [];
        if ($departamentoId !== null) {
            $where = ' AND m.departamento_id = :departamento_id';
            $params['departamento_id'] = $departamentoId;
        }

        $rows = $database->all(
            "SELECT
                m.id,
                m.nombre,
                m.departamento_id AS parent_id,
                d.nombre AS parent_nombre,
                ST_AsGeoJSON(m.geom)::text AS geojson
             FROM public.municipio m
             LEFT JOIN public.departamento d ON d.id = m.departamento_id
             WHERE m.geom IS NOT NULL{$where}
             ORDER BY m.nombre",
            $params
        );

        $features = array_map(static function (array $row): array {
            return [
                'type' => 'Feature',
                'geometry' => json_decode((string) $row['geojson'], true),
                'properties' => [
                    'id' => (int) $row['id'],
                    'nombre' => (string) $row['nombre'],
                    'parentId' => $row['parent_id'] !== null ? (int) $row['parent_id'] : null,
                    'parentNombre' => $row['parent_nombre'],
                ],
            ];
        }, $rows);

        return self::featureCollection($features);
    }

    private static function tenantKeyFromRequest(Request $request): ?string
    {
        $headerTenant = trim((string) ($request->header('x-tenant-id', '') ?? ''));
        if ($headerTenant !== '') {
            return $headerTenant;
        }

        $queryTenant = trim((string) ($request->query('tenantId', '') ?? ''));
        return $queryTenant !== '' ? $queryTenant : null;
    }

    private static function resolveTenant(Database $database, string $tenantKey): array
    {
        $tenant = $database->one(
            "SELECT id, code, name
             FROM public.tenants
             WHERE id::text = :tenant_key OR UPPER(code) = UPPER(:tenant_key)
             LIMIT 1",
            ['tenant_key' => $tenantKey]
        );

        if ($tenant === null) {
            throw new RuntimeException('TENANT_NOT_FOUND');
        }

        return $tenant;
    }

    private static function bboxFromRequest(Request $request): ?array
    {
        if ($request->query('minLng') === null) {
            return null;
        }

        $minLng = filter_var($request->query('minLng'), FILTER_VALIDATE_FLOAT);
        $minLat = filter_var($request->query('minLat'), FILTER_VALIDATE_FLOAT);
        $maxLng = filter_var($request->query('maxLng'), FILTER_VALIDATE_FLOAT);
        $maxLat = filter_var($request->query('maxLat'), FILTER_VALIDATE_FLOAT);

        if (
            $minLng === false || $minLat === false || $maxLng === false || $maxLat === false ||
            $minLng < -180 || $maxLng > 180 || $minLat < -90 || $maxLat > 90 ||
            $minLng > $maxLng || $minLat > $maxLat
        ) {
            Response::error(400, 'INVALID_BBOX', 'Bounding box invalido. Use: ?minLng=&minLat=&maxLng=&maxLat=');
        }

        return [
            'minLng' => (float) $minLng,
            'minLat' => (float) $minLat,
            'maxLng' => (float) $maxLng,
            'maxLat' => (float) $maxLat,
        ];
    }

    private static function bboxClause(?array $bbox, string $lngColumn, string $latColumn, string $prefix): array
    {
        if ($bbox === null) {
            return ['', []];
        }

        return [
            " AND {$lngColumn} >= :{$prefix}min_lng
              AND {$lngColumn} <= :{$prefix}max_lng
              AND {$latColumn} >= :{$prefix}min_lat
              AND {$latColumn} <= :{$prefix}max_lat",
            [
                "{$prefix}min_lng" => $bbox['minLng'],
                "{$prefix}max_lng" => $bbox['maxLng'],
                "{$prefix}min_lat" => $bbox['minLat'],
                "{$prefix}max_lat" => $bbox['maxLat'],
            ],
        ];
    }

    private static function pointFeature(float $lng, float $lat, array $properties): array
    {
        return [
            'type' => 'Feature',
            'geometry' => [
                'type' => 'Point',
                'coordinates' => [$lng, $lat],
            ],
            'properties' => $properties,
        ];
    }

    private static function featureCollection(array $features): array
    {
        return ['type' => 'FeatureCollection', 'features' => array_values($features)];
    }

    private static function requiredFloatQuery(
        Request $request,
        string $key,
        float $min,
        float $max,
        string $code,
        string $message
    ): float {
        $value = filter_var($request->query($key), FILTER_VALIDATE_FLOAT);
        if ($value === false || $value < $min || $value > $max) {
            Response::error(400, $code, $message);
        }

        return (float) $value;
    }

    private static function optionalFloatQuery(
        Request $request,
        string $key,
        float $default,
        float $min,
        float $max,
        string $code,
        string $message
    ): float {
        if ($request->query($key) === null) {
            return $default;
        }

        $value = filter_var($request->query($key), FILTER_VALIDATE_FLOAT);
        if ($value === false || $value < $min || $value > $max) {
            Response::error(400, $code, $message);
        }

        return (float) $value;
    }

    private static function pgArrayToArray(mixed $value): array
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

    private static function toIso(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (new \DateTimeImmutable((string) $value))->format(DATE_ATOM);
    }
}
