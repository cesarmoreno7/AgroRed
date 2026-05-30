<?php
declare(strict_types=1);

namespace Agrored\Modules\Automation;

use Agrored\Database\Database;
use Agrored\Http\Request;
use Agrored\Http\Response;
use Agrored\Http\Router;
use Agrored\Support\Uuid;
use DateTimeImmutable;
use RuntimeException;
use Throwable;

final class AutomationModule
{
    private const MODEL_VERSION = 'heuristic-v1';
    private const TRIGGER_SOURCES = ['manual', 'scheduled', 'incident_response', 'logistics_followup'];

    public static function register(Router $router, Database $database): void
    {
        // ── EXECUTE AUTOMATION RUN ──
        $router->post('/api/v1/automation/execute', static function (Request $request) use ($database): void {
            $payload = $request->body();

            $tenantKey = self::requiredString($payload, 'tenantId', 1, 'INVALID_AUTOMATION_PAYLOAD', 'Payload invalido para ejecucion de automatizacion.');
            $triggerSource = self::requiredString($payload, 'triggerSource', 1, 'INVALID_AUTOMATION_PAYLOAD', 'Payload invalido para ejecucion de automatizacion.');
            $incidentId = self::optionalUuid($payload, 'incidentId', 'INVALID_AUTOMATION_PAYLOAD', 'Payload invalido para ejecucion de automatizacion.');
            $logisticsOrderId = self::optionalUuid($payload, 'logisticsOrderId', 'INVALID_AUTOMATION_PAYLOAD', 'Payload invalido para ejecucion de automatizacion.');
            $notes = self::optionalString($payload, 'notes', 500, 'INVALID_AUTOMATION_PAYLOAD', 'Payload invalido para ejecucion de automatizacion.');

            if (!in_array($triggerSource, self::TRIGGER_SOURCES, true)) {
                Response::error(400, 'INVALID_AUTOMATION_PAYLOAD', 'Trigger source invalido.');
            }

            if ($triggerSource === 'incident_response' && $incidentId === null) {
                Response::error(400, 'INCIDENT_REQUIRED_FOR_TRIGGER', 'La automatizacion por incidencia requiere una incidencia asociada.');
            }

            if ($triggerSource === 'logistics_followup' && $logisticsOrderId === null) {
                Response::error(400, 'LOGISTICS_ORDER_REQUIRED_FOR_TRIGGER', 'La automatizacion de seguimiento logistico requiere una operacion asociada.');
            }

            try {
                $tenantId = self::resolveTenantId($database, $tenantKey);

                if ($incidentId !== null) {
                    self::resolveIncidentId($database, $incidentId, $tenantId);
                }

                if ($logisticsOrderId !== null) {
                    self::resolveLogisticsOrderId($database, $logisticsOrderId, $tenantId);
                }

                // Build metrics snapshot
                $metricsSnapshot = self::buildMetricsSnapshot($database, $tenantId);

                // Build actions list
                $actions = self::buildActions($metricsSnapshot, $incidentId, $logisticsOrderId);

                $runId = Uuid::v4();
                $classification = self::resolveClassification($metricsSnapshot['scores']['readinessScore']);

                $database->execute(
                    'INSERT INTO public.automation_runs (
                        id, tenant_id, incident_id, logistics_order_id, trigger_source,
                        model_version, classification, status, actions, metrics_snapshot,
                        notes, created_at
                    ) VALUES (
                        :id, :tenant_id, :incident_id, :logistics_order_id, :trigger_source,
                        :model_version, :classification, \'generated\', :actions::jsonb, :metrics_snapshot::jsonb,
                        :notes, NOW()
                    )',
                    [
                        'id' => $runId,
                        'tenant_id' => $tenantId,
                        'incident_id' => $incidentId,
                        'logistics_order_id' => $logisticsOrderId,
                        'trigger_source' => $triggerSource,
                        'model_version' => self::MODEL_VERSION,
                        'classification' => $classification,
                        'actions' => json_encode($actions, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                        'metrics_snapshot' => json_encode($metricsSnapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                        'notes' => $notes,
                    ]
                );

                $row = $database->one('SELECT * FROM public.automation_runs WHERE id = :id LIMIT 1', ['id' => $runId]);
                Response::success(self::toAutomationResponse($row), 201);

            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                if ($error->getMessage() === 'INCIDENT_NOT_FOUND_FOR_TENANT') {
                    Response::error(404, 'INCIDENT_NOT_FOUND_FOR_TENANT', 'La incidencia asociada no existe para el municipio indicado.');
                }
                if ($error->getMessage() === 'LOGISTICS_ORDER_NOT_FOUND_FOR_TENANT') {
                    Response::error(404, 'LOGISTICS_ORDER_NOT_FOUND_FOR_TENANT', 'La operacion logistica asociada no existe para el municipio indicado.');
                }
                throw $error;
            }
        });

        // ── LIST AUTOMATION RUNS ──
        $router->get('/api/v1/automation', static function (Request $request) use ($database): void {
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

            $where = implode(' AND ', $conditions);

            $total = (int) $database->scalar(
                'SELECT COUNT(*) FROM public.automation_runs WHERE ' . $where,
                $params
            );

            $rows = $database->all(
                'SELECT * FROM public.automation_runs
                 WHERE ' . $where . '
                 ORDER BY created_at DESC
                 LIMIT :limit OFFSET :offset',
                array_merge($params, [
                    'limit' => $limit,
                    'offset' => ($page - 1) * $limit,
                ])
            );

            Response::paginated(
                array_map([self::class, 'toAutomationResponse'], $rows),
                ['total' => $total, 'page' => $page, 'limit' => $limit]
            );
        });

        // ── GET AUTOMATION RUN BY ID ──
        $router->get('/api/v1/automation/{id}', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');

            $row = $database->one('SELECT * FROM public.automation_runs WHERE id = :id AND deleted_at IS NULL LIMIT 1', ['id' => $id]);
            if ($row === null) {
                Response::error(404, 'AUTOMATION_RUN_NOT_FOUND', 'Corrida de automatizacion no encontrada.');
            }

            $tenantHeader = trim((string) ($request->header('x-tenant-id', '') ?? ''));
            if ($tenantHeader !== '') {
                try {
                    $tenantId = self::resolveTenantId($database, $tenantHeader);
                    if ($row['tenant_id'] !== $tenantId) {
                        Response::error(404, 'AUTOMATION_RUN_NOT_FOUND', 'Corrida de automatizacion no encontrada.');
                    }
                } catch (\Exception) {
                    // Invalid tenant ID / code fallback
                }
            }

            Response::success(self::toAutomationResponse($row));
        });
    }

    // ── DATABASE & ALGORITHM HELPERS ──

    private static function resolveTenantId(Database $database, string $tenantKey): string
    {
        $tenant = $database->one(
            'SELECT id FROM public.tenants
             WHERE id::text = :tenant_key OR UPPER(code) = UPPER(:tenant_key)
             LIMIT 1',
            ['tenant_key' => $tenantKey]
        );

        if ($tenant === null) {
            throw new RuntimeException('TENANT_NOT_FOUND');
        }

        return (string) $tenant['id'];
    }

    private static function resolveIncidentId(Database $database, string $incidentId, string $tenantId): string
    {
        $row = $database->one(
            'SELECT id FROM public.incidents
             WHERE id = :id AND tenant_id = :tenant_id AND deleted_at IS NULL LIMIT 1',
            ['id' => $incidentId, 'tenant_id' => $tenantId]
        );

        if ($row === null) {
            throw new RuntimeException('INCIDENT_NOT_FOUND_FOR_TENANT');
        }

        return (string) $row['id'];
    }

    private static function resolveLogisticsOrderId(Database $database, string $logisticsOrderId, string $tenantId): string
    {
        $row = $database->one(
            'SELECT id FROM public.logistics_orders
             WHERE id = :id AND tenant_id = :tenant_id AND deleted_at IS NULL LIMIT 1',
            ['id' => $logisticsOrderId, 'tenant_id' => $tenantId]
        );

        if ($row === null) {
            throw new RuntimeException('LOGISTICS_ORDER_NOT_FOUND_FOR_TENANT');
        }

        return (string) $row['id'];
    }

    private static function buildMetricsSnapshot(Database $database, string $tenantId): array
    {
        $row = $database->one(
            "SELECT
              (SELECT COUNT(*) FROM public.offers WHERE deleted_at IS NULL AND status = 'published' AND tenant_id = :tenant_id) AS active_offers,
              (SELECT COALESCE(SUM(quantity_required), 0) FROM public.demands WHERE deleted_at IS NULL AND status = 'open' AND tenant_id = :tenant_id) AS open_demand_units,
              (SELECT COALESCE(SUM(GREATEST(quantity_on_hand - quantity_reserved, 0)), 0) FROM public.inventory_items WHERE deleted_at IS NULL AND tenant_id = :tenant_id) AS available_inventory_units,
              (SELECT COALESCE(SUM(quantity_reserved), 0) FROM public.inventory_items WHERE deleted_at IS NULL AND tenant_id = :tenant_id) AS reserved_inventory_units,
              (SELECT COUNT(*) FROM public.rescues WHERE deleted_at IS NULL AND status = 'scheduled' AND tenant_id = :tenant_id) AS scheduled_rescues,
              (SELECT COUNT(*) FROM public.logistics_orders WHERE deleted_at IS NULL AND status = 'scheduled' AND tenant_id = :tenant_id) AS scheduled_logistics,
              (SELECT COUNT(*) FROM public.incidents WHERE deleted_at IS NULL AND status = 'open' AND tenant_id = :tenant_id) AS open_incidents,
              (SELECT COUNT(*) FROM public.notifications WHERE deleted_at IS NULL AND status = 'pending' AND tenant_id = :tenant_id) AS pending_notifications",
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

        return [
            'inputs' => $inputs,
            'scores' => self::computeScores($inputs),
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

    private static function buildActions(array $snapshot, ?string $incidentId, ?string $logisticsOrderId): array
    {
        $actions = [];
        $inputs = $snapshot['inputs'];
        $scores = $snapshot['scores'];

        if ($scores['supplyCoverageScore'] < 50) {
            $actions[] = [
                'priority' => 'high',
                'actionCode' => 'activate_supply',
                'title' => 'Activar oferta complementaria',
                'rationale' => 'La cobertura actual de inventario no alcanza la demanda abierta del territorio.',
            ];
        }

        if ($inputs['scheduledLogistics'] === 0 && $inputs['openDemandUnits'] > 0) {
            $actions[] = [
                'priority' => 'high',
                'actionCode' => 'schedule_logistics',
                'title' => 'Programar operacion logistica',
                'rationale' => 'Hay demanda abierta sin operaciones logisticas programadas para atenderla.',
            ];
        }

        if ($inputs['openIncidents'] > 0 || $incidentId !== null) {
            $actions[] = [
                'priority' => $scores['readinessScore'] < 45 ? 'high' : 'medium',
                'actionCode' => 'stabilize_operations',
                'title' => 'Estabilizar operacion territorial',
                'rationale' => 'Existen incidencias o alertas de continuidad que requieren coordinacion inmediata.',
            ];
        }

        if ($inputs['pendingNotifications'] > 0) {
            $actions[] = [
                'priority' => 'medium',
                'actionCode' => 'dispatch_notifications',
                'title' => 'Despachar notificaciones pendientes',
                'rationale' => 'Persisten alertas pendientes hacia actores claves del flujo operativo.',
            ];
        }

        if ($inputs['reservedInventoryUnits'] > $inputs['availableInventoryUnits']) {
            $actions[] = [
                'priority' => 'medium',
                'actionCode' => 'rebalance_inventory',
                'title' => 'Rebalancear inventario',
                'rationale' => 'El inventario reservado supera el disponible y puede afectar el cumplimiento de entregas.',
            ];
        }

        // Check if logisticsOrderId is present and we haven't already scheduled
        $hasScheduledLogistics = false;
        foreach ($actions as $act) {
            if ($act['actionCode'] === 'schedule_logistics') {
                $hasScheduledLogistics = true;
                break;
            }
        }

        if ($logisticsOrderId !== null && !$hasScheduledLogistics) {
            $actions[] = [
                'priority' => 'medium',
                'actionCode' => 'follow_logistics_execution',
                'title' => 'Dar seguimiento a la operacion logistica',
                'rationale' => 'La corrida fue disparada sobre una operacion logistica y requiere monitoreo hasta cierre.',
            ];
        }

        if (count($actions) === 0) {
            $actions[] = [
                'priority' => 'low',
                'actionCode' => 'maintain_monitoring',
                'title' => 'Mantener monitoreo operativo',
                'rationale' => 'Los indicadores actuales no muestran tension critica; conviene sostener seguimiento preventivo.',
            ];
        }

        return $actions;
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

    private static function toAutomationResponse(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'tenantId' => (string) $row['tenant_id'],
            'incidentId' => $row['incident_id'],
            'logisticsOrderId' => $row['logistics_order_id'],
            'triggerSource' => (string) $row['trigger_source'],
            'modelVersion' => (string) $row['model_version'],
            'classification' => (string) $row['classification'],
            'status' => (string) $row['status'],
            'actions' => self::decodeJson($row['actions']),
            'metricsSnapshot' => self::decodeJson($row['metrics_snapshot']),
            'notes' => $row['notes'],
            'createdAt' => self::toIso($row['created_at']),
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
        return (new DateTimeImmutable((string) $value))->format(DATE_ATOM);
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

    private static function optionalFloat(array $payload, string $key): ?float
    {
        if (!array_key_exists($key, $payload) || $payload[$key] === null || $payload[$key] === '') {
            return null;
        }
        $value = filter_var($payload[$key], FILTER_VALIDATE_FLOAT);
        return $value !== false ? (float) $value : null;
    }

    private static function clamp(int $value): int
    {
        return max(0, min(100, $value));
    }
}
