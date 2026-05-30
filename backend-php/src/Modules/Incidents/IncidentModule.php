<?php
declare(strict_types=1);

namespace Agrored\Modules\Incidents;

use Agrored\Database\Database;
use Agrored\Http\Request;
use Agrored\Http\Response;
use Agrored\Http\Router;
use Agrored\Support\Uuid;
use DateTimeImmutable;
use DateTimeZone;
use RuntimeException;
use Throwable;

final class IncidentModule
{
    private const INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'];
    private const INCIDENT_TYPES = [
        'route_delay',
        'vehicle_failure',
        'quality_issue',
        'access_blockage',
        'weather_alert',
        'inseguridad_alimentaria',
        'desnutricion',
        'falta_acceso_alimentos',
        'falla_programa',
        'desperdicio_alimentario',
        'problema_logistico',
        'emergencia_social',
        'desplazamiento',
        'crisis_humanitaria',
    ];
    private const INCIDENT_STATUSES = [
        'open',
        'investigating',
        'resolved',
        'dismissed',
        'reportada',
        'en_analisis',
        'priorizada',
        'en_gestion',
        'intervenida',
        'cerrada',
        'escalada',
    ];
    private const VALID_STATUS_TRANSITIONS = [
        'open' => ['investigating', 'reportada', 'en_analisis', 'dismissed'],
        'reportada' => ['en_analisis', 'priorizada', 'dismissed'],
        'en_analisis' => ['priorizada', 'escalada', 'dismissed'],
        'priorizada' => ['en_gestion', 'escalada'],
        'en_gestion' => ['intervenida', 'escalada'],
        'intervenida' => ['cerrada', 'escalada'],
        'investigating' => ['resolved', 'dismissed', 'en_gestion'],
        'escalada' => ['en_gestion', 'priorizada', 'cerrada'],
        'resolved' => [],
        'cerrada' => [],
        'dismissed' => [],
    ];
    private const VALID_ACTION_TYPES = [
        'assign',
        'escalate',
        'intervene',
        'close',
        'note',
        'activate_program',
        'activate_logistics',
        'follow_up',
    ];
    private const SEVERITY_WEIGHTS = [
        'low' => 1,
        'medium' => 3,
        'high' => 7,
        'critical' => 10,
    ];
    private const DEFAULT_ALERT_THRESHOLDS = [
        'incident.zone_min_count' => 3,
        'incident.zone_high_count' => 5,
        'incident.zone_window_hours' => 48,
        'incident.unattended_hours' => 24,
        'incident.unattended_high_count' => 5,
    ];
    private const TYPE_RULES = [
        ['type' => 'inseguridad_alimentaria', 'keywords' => ['inseguridad alimentaria', 'hambre', 'falta de alimentos', 'sin comida', 'no tienen que comer', 'escasez de alimentos', 'deficit alimentario'], 'severity' => 'high', 'weight' => 10],
        ['type' => 'desnutricion', 'keywords' => ['desnutricion', 'bajo peso', 'malnutricion', 'anemia', 'deficiencia nutricional', 'talla baja'], 'severity' => 'critical', 'weight' => 10],
        ['type' => 'falta_acceso_alimentos', 'keywords' => ['acceso a alimentos', 'no llegan alimentos', 'sin acceso', 'zona aislada', 'vias bloqueadas', 'bloqueo vial', 'dificil acceso', 'comunidad aislada'], 'severity' => 'high', 'weight' => 9],
        ['type' => 'crisis_humanitaria', 'keywords' => ['crisis humanitaria', 'emergencia humanitaria', 'desastre', 'inundacion', 'terremoto', 'deslizamiento', 'avalancha', 'catastrofe'], 'severity' => 'critical', 'weight' => 12],
        ['type' => 'desplazamiento', 'keywords' => ['desplazamiento', 'desplazados', 'migrantes', 'refugiados', 'desplazamiento forzado', 'exodo', 'migracion forzada'], 'severity' => 'critical', 'weight' => 11],
        ['type' => 'emergencia_social', 'keywords' => ['emergencia social', 'violencia', 'conflicto armado', 'amenaza', 'inseguridad', 'protesta', 'paro', 'disturbios'], 'severity' => 'high', 'weight' => 9],
        ['type' => 'desperdicio_alimentario', 'keywords' => ['desperdicio', 'merma', 'perdida de alimentos', 'alimentos danados', 'alimentos vencidos', 'descomposicion', 'pudricion', 'hongos'], 'severity' => 'medium', 'weight' => 7],
        ['type' => 'falla_programa', 'keywords' => ['falla del programa', 'programa suspendido', 'programa cancelado', 'incumplimiento', 'no se entrego', 'entrega fallida', 'beneficiarios sin atender'], 'severity' => 'high', 'weight' => 8],
        ['type' => 'problema_logistico', 'keywords' => ['problema logistico', 'retraso en entrega', 'entrega tardia', 'falta de transporte', 'ruta interrumpida', 'carga danada'], 'severity' => 'medium', 'weight' => 6],
        ['type' => 'route_delay', 'keywords' => ['retraso', 'demora', 'atraso en ruta', 'llegada tarde', 'delay', 'detenido'], 'severity' => 'low', 'weight' => 5],
        ['type' => 'vehicle_failure', 'keywords' => ['falla vehicular', 'averia', 'vehiculo varado', 'pinchazo', 'motor', 'mecanica', 'accidente vial'], 'severity' => 'medium', 'weight' => 6],
        ['type' => 'quality_issue', 'keywords' => ['calidad', 'contaminacion', 'mal estado', 'olor', 'color', 'textura', 'caducado'], 'severity' => 'high', 'weight' => 8],
        ['type' => 'access_blockage', 'keywords' => ['bloqueo', 'derrumbe', 'via bloqueada', 'acceso restringido', 'puente caido'], 'severity' => 'medium', 'weight' => 7],
        ['type' => 'weather_alert', 'keywords' => ['clima', 'lluvia', 'tormenta', 'granizo', 'helada', 'sequia', 'ola de calor', 'alerta climatica'], 'severity' => 'medium', 'weight' => 5],
    ];
    private const SEVERITY_BOOSTS = [
        ['keywords' => ['urgente', 'inmediato', 'emergencia', 'critico', 'muerte', 'fallecimiento', 'mortalidad'], 'severity' => 'critical', 'weight' => 5],
        ['keywords' => ['grave', 'severo', 'alto riesgo', 'masivo', 'multiples', 'generalizado'], 'severity' => 'high', 'weight' => 3],
        ['keywords' => ['moderado', 'parcial', 'algunos', 'localizado'], 'severity' => 'medium', 'weight' => 1],
        ['keywords' => ['leve', 'menor', 'aislado', 'puntual'], 'severity' => 'low', 'weight' => 0],
    ];

    public static function register(Router $router, Database $database): void
    {
        $router->post('/api/v1/incidents/register', static function (Request $request) use ($database): void {
            try {
                Response::success(self::registerIncident($database, $request->body()), 201);
            } catch (RuntimeException $error) {
                self::handleIncidentRegistrationError($error);
                throw $error;
            }
        });

        $router->get('/api/v1/incidents', static function (Request $request) use ($database): void {
            $page = self::page($request);
            $limit = self::limit($request);
            $tenantKey = trim((string) (($request->header('x-tenant-id', '') ?? '') ?: ($request->query('tenantId', '') ?? '')));
            $filters = [
                'status' => trim((string) ($request->query('status', '') ?? '')),
                'severity' => trim((string) ($request->query('severity', '') ?? '')),
                'incidentType' => trim((string) ($request->query('incidentType', '') ?? '')),
                'municipalityName' => trim((string) ($request->query('municipalityName', '') ?? '')),
            ];

            try {
                $tenantId = $tenantKey !== '' ? self::resolveTenantId($database, $tenantKey) : null;
                $result = self::listIncidents($database, $page, $limit, $tenantId, $filters);
                Response::paginated(
                    array_map([self::class, 'toIncidentResponse'], $result['data']),
                    ['total' => $result['total'], 'page' => $page, 'limit' => $limit]
                );
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }
        });

        $router->get('/api/v1/incidents/{id}/actions', static function (Request $request) use ($database): void {
            if (!self::hasActionsSchema($database)) {
                Response::error(503, 'INCIDENT_ACTIONS_SCHEMA_MISSING', 'La tabla incident_actions no existe. Ejecute infra/postgres/008_modulos_revision.sql.');
            }

            $incident = self::findIncidentById($database, (string) $request->route('id'));
            if ($incident === null) {
                Response::error(404, 'INCIDENT_NOT_FOUND', 'Incidencia no encontrada.');
            }

            Response::success(self::listIncidentActions($database, (string) $request->route('id')));
        });

        $router->post('/api/v1/incidents/{id}/actions', static function (Request $request) use ($database): void {
            if (!self::hasActionsSchema($database)) {
                Response::error(503, 'INCIDENT_ACTIONS_SCHEMA_MISSING', 'La tabla incident_actions no existe. Ejecute infra/postgres/008_modulos_revision.sql.');
            }

            $payload = $request->body();
            $actionType = strtolower(self::requiredString($payload, 'actionType', 1, 'INVALID_ACTION_PAYLOAD', 'Payload de accion invalido.'));
            $performedBy = self::requiredString($payload, 'performedBy', 1, 'INVALID_ACTION_PAYLOAD', 'Payload de accion invalido.');
            $description = self::requiredString($payload, 'description', 3, 'INVALID_ACTION_PAYLOAD', 'Payload de accion invalido.');
            $metadata = is_array($payload['metadata'] ?? null) ? $payload['metadata'] : [];

            if (!in_array($actionType, self::VALID_ACTION_TYPES, true)) {
                Response::error(400, 'INVALID_ACTION_TYPE', 'Tipo de accion no valido.');
            }

            $incident = self::findIncidentById($database, (string) $request->route('id'));
            if ($incident === null) {
                Response::error(404, 'INCIDENT_NOT_FOUND', 'Incidencia no encontrada.');
            }

            $action = self::saveIncidentAction($database, [
                'id' => Uuid::v4(),
                'incident_id' => (string) $request->route('id'),
                'action_type' => $actionType,
                'performed_by' => $performedBy,
                'description' => $description,
                'metadata' => $metadata,
            ]);

            Response::success($action, 201);
        });

        $router->get('/api/v1/incidents/alerts/{tenantId}', static function (Request $request) use ($database): void {
            if (!self::hasAlertsSchema($database)) {
                Response::error(503, 'INCIDENT_ALERTS_SCHEMA_MISSING', 'La tabla incident_alerts no existe. Ejecute infra/postgres/008_modulos_revision.sql.');
            }

            $page = self::page($request);
            $limit = self::limit($request);

            try {
                $tenantId = self::resolveTenantId($database, (string) $request->route('tenantId'));
                $result = self::listIncidentAlerts($database, $tenantId, $page, $limit);
                Response::paginated($result['data'], ['total' => $result['total'], 'page' => $page, 'limit' => $limit]);
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }
        });

        $router->post('/api/v1/incidents/alerts/{tenantId}/generate', static function (Request $request) use ($database): void {
            if (!self::hasAlertsSchema($database)) {
                Response::error(503, 'INCIDENT_ALERTS_SCHEMA_MISSING', 'La tabla incident_alerts no existe. Ejecute infra/postgres/008_modulos_revision.sql.');
            }

            try {
                $tenantId = self::resolveTenantId($database, (string) $request->route('tenantId'));
                $alerts = self::generateIncidentAlerts($database, $tenantId);
                Response::success(['generated' => count($alerts), 'alerts' => $alerts], 201);
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }
        });

        $router->patch('/api/v1/incidents/alerts/{alertId}/acknowledge', static function (Request $request) use ($database): void {
            if (!self::hasAlertsSchema($database)) {
                Response::error(503, 'INCIDENT_ALERTS_SCHEMA_MISSING', 'La tabla incident_alerts no existe. Ejecute infra/postgres/008_modulos_revision.sql.');
            }

            $payload = $request->body();
            $acknowledgedBy = self::requiredString($payload, 'acknowledgedBy', 1, 'INVALID_ACKNOWLEDGE_PAYLOAD', 'Se requiere acknowledgedBy.');

            $database->execute(
                'UPDATE public.incident_alerts
                 SET is_acknowledged = TRUE,
                     acknowledged_by = :acknowledged_by,
                     acknowledged_at = NOW()
                 WHERE id = :id',
                ['id' => (string) $request->route('alertId'), 'acknowledged_by' => $acknowledgedBy]
            );

            Response::success(['acknowledged' => true]);
        });

        $router->get('/api/v1/incidents/analytics/{tenantId}/clusters', static function (Request $request) use ($database): void {
            $radiusM = max(50, min(5000, (int) ($request->query('radiusM', 500) ?? 500)));
            $minPoints = max(2, min(20, (int) ($request->query('minPoints', 2) ?? 2)));

            try {
                $tenantId = self::resolveTenantId($database, (string) $request->route('tenantId'));
                $clusters = self::getIncidentClusters($database, $tenantId, $radiusM, $minPoints);
                Response::success([
                    'totalClusters' => count($clusters),
                    'parameters' => ['radiusM' => $radiusM, 'minPoints' => $minPoints],
                    'clusters' => $clusters,
                ]);
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }
        });

        $router->get('/api/v1/incidents/analytics/{tenantId}/trends', static function (Request $request) use ($database): void {
            if (!self::hasTrendViews($database)) {
                Response::error(503, 'INCIDENT_TRENDS_VIEW_MISSING', 'Las vistas v_incident_trends y v_incident_trends_daily no existen. Ejecute infra/postgres/010_remaining_gaps.sql.');
            }

            $granularity = strtolower(trim((string) ($request->query('granularity', 'weekly') ?? 'weekly'))) === 'daily' ? 'daily' : 'weekly';
            $limit = max(1, min(365, (int) ($request->query('limit', 52) ?? 52)));

            try {
                $tenantId = self::resolveTenantId($database, (string) $request->route('tenantId'));
                $trends = self::getIncidentTrends($database, $tenantId, $granularity, $limit);
                Response::success([
                    'granularity' => $granularity,
                    'totalPeriods' => count($trends),
                    'trends' => $trends,
                ]);
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }
        });

        $router->get('/api/v1/incidents/analytics/{tenantId}', static function (Request $request) use ($database): void {
            try {
                $tenantId = self::resolveTenantId($database, (string) $request->route('tenantId'));
                Response::success([
                    'zoneSummary' => self::getZoneSummary($database, $tenantId),
                    'heatmap' => self::countByZoneAndSeverity($database, $tenantId),
                ]);
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }
        });

        $router->get('/api/v1/incidents/thresholds/{tenantId}', static function (Request $request) use ($database): void {
            if (!self::hasThresholdSchema($database)) {
                Response::error(503, 'INCIDENT_THRESHOLDS_SCHEMA_MISSING', 'La tabla alert_thresholds no existe. Ejecute infra/postgres/011_alert_thresholds.sql.');
            }

            try {
                $tenantId = self::resolveTenantId($database, (string) $request->route('tenantId'));
                Response::success(self::loadAlertThresholds($database, $tenantId));
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }
        });

        $router->put('/api/v1/incidents/thresholds/{tenantId}', static function (Request $request) use ($database): void {
            if (!self::hasThresholdSchema($database)) {
                Response::error(503, 'INCIDENT_THRESHOLDS_SCHEMA_MISSING', 'La tabla alert_thresholds no existe. Ejecute infra/postgres/011_alert_thresholds.sql.');
            }

            $payload = $request->body();
            $ruleKey = self::requiredString($payload, 'ruleKey', 3, 'INVALID_THRESHOLD', 'Payload invalido para umbral de alerta.');
            $value = filter_var($payload['value'] ?? null, FILTER_VALIDATE_FLOAT);
            $updatedBy = self::optionalString($payload, 'updatedBy', 200, 'INVALID_THRESHOLD', 'Payload invalido para umbral de alerta.');

            if ($value === false || $value < 0 || preg_match('/^incident\.\w+$/', $ruleKey) !== 1) {
                Response::error(400, 'INVALID_THRESHOLD', 'Payload invalido para umbral de alerta.');
            }

            try {
                $tenantId = self::resolveTenantId($database, (string) $request->route('tenantId'));
                Response::success(self::upsertAlertThreshold($database, $tenantId, $ruleKey, (float) $value, $updatedBy));
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }
        });

        $router->post('/api/v1/incidents/classify', static function (Request $request): void {
            $payload = $request->body();
            $title = self::requiredString($payload, 'title', 3, 'INVALID_CLASSIFY_PAYLOAD', 'Se requiere title y description.');
            $description = self::requiredString($payload, 'description', 10, 'INVALID_CLASSIFY_PAYLOAD', 'Se requiere title y description.');
            Response::success(self::classifyIncident($title, $description));
        });

        $router->post('/api/v1/incidents/register-auto', static function (Request $request) use ($database): void {
            $payload = $request->body();
            $title = self::requiredString($payload, 'title', 3, 'MISSING_TEXT', 'Se requiere title y description para auto-clasificar.');
            $description = self::requiredString($payload, 'description', 10, 'MISSING_TEXT', 'Se requiere title y description para auto-clasificar.');

            $classification = self::classifyIncident($title, $description);
            $enriched = $payload;
            $enriched['incidentType'] = $payload['incidentType'] ?? $classification['suggestedType'];
            $enriched['severity'] = $payload['severity'] ?? $classification['suggestedSeverity'];

            try {
                $incident = self::registerIncident($database, $enriched);
                Response::success([
                    'incident' => $incident,
                    'classification' => $classification,
                ], 201);
            } catch (RuntimeException $error) {
                self::handleIncidentRegistrationError($error);
                throw $error;
            }
        });

        $router->get('/api/v1/incidents/{id}', static function (Request $request) use ($database): void {
            $row = self::findIncidentById($database, (string) $request->route('id'));
            if ($row === null) {
                Response::error(404, 'INCIDENT_NOT_FOUND', 'Incidencia no encontrada.');
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
                    Response::error(404, 'INCIDENT_NOT_FOUND', 'Incidencia no encontrada.');
                }
            }

            Response::success(self::toIncidentResponse($row));
        });

        $router->patch('/api/v1/incidents/{id}/status', static function (Request $request) use ($database): void {
            $payload = $request->body();
            $status = strtolower(self::requiredString($payload, 'status', 1, 'INVALID_STATUS_PAYLOAD', 'Payload de cambio de estado invalido.'));
            $assignedTo = self::optionalString($payload, 'assignedTo', 255, 'INVALID_STATUS_PAYLOAD', 'Payload de cambio de estado invalido.');
            $resolutionNotes = self::optionalString($payload, 'resolutionNotes', 2000, 'INVALID_STATUS_PAYLOAD', 'Payload de cambio de estado invalido.');
            $performedBy = self::requiredString($payload, 'performedBy', 1, 'INVALID_STATUS_PAYLOAD', 'Payload de cambio de estado invalido.');

            if (!in_array($status, self::INCIDENT_STATUSES, true)) {
                Response::error(400, 'INVALID_STATUS_PAYLOAD', 'Payload de cambio de estado invalido.');
            }

            $row = self::findIncidentById($database, (string) $request->route('id'));
            if ($row === null) {
                Response::error(404, 'INCIDENT_NOT_FOUND', 'Incidencia no encontrada.');
            }

            $incident = self::toIncidentResponse($row);
            $allowed = self::VALID_STATUS_TRANSITIONS[$incident['status']] ?? [];
            if (!in_array($status, $allowed, true)) {
                Response::error(422, 'INVALID_STATUS_TRANSITION', 'La transicion de estado no es valida.');
            }

            $updated = self::updateIncidentStatus($database, $row, $status, $assignedTo, $resolutionNotes, $performedBy);
            Response::success(self::toIncidentResponse($updated));
        });

        $router->post('/api/v1/incidents/{id}/prioritize', static function (Request $request) use ($database): void {
            $row = self::findIncidentById($database, (string) $request->route('id'));
            if ($row === null) {
                Response::error(404, 'INCIDENT_NOT_FOUND', 'Incidencia no encontrada.');
            }

            $score = self::prioritizeIncident($database, $row);
            Response::success(['incidentId' => (string) $request->route('id'), 'priorityScore' => $score]);
        });

        $router->post('/api/v1/incidents/{id}/trigger-logistics', static function (Request $request) use ($database): void {
            $row = self::findIncidentById($database, (string) $request->route('id'));
            if ($row === null) {
                Response::error(404, 'INCIDENT_NOT_FOUND', 'Incidencia no encontrada.');
            }

            Response::error(503, 'LOGISTICS_TRIGGER_NOT_AVAILABLE', 'El alta operativa de ordenes logisticas en PHP aun no esta portada. Migre el flujo /api/v1/logistics/register para habilitar este endpoint.');
        });
    }

    private static function registerIncident(Database $database, array $payload): array
    {
        $tenantKey = self::requiredString($payload, 'tenantId', 1, 'INVALID_INCIDENT_PAYLOAD', 'Payload invalido para registro de incidencia.');
        $logisticsOrderId = self::optionalUuid($payload, 'logisticsOrderId', 'INVALID_INCIDENT_PAYLOAD', 'Payload invalido para registro de incidencia.');
        $incidentType = strtolower(self::requiredString($payload, 'incidentType', 1, 'INVALID_INCIDENT_PAYLOAD', 'Payload invalido para registro de incidencia.'));
        $severity = strtolower(self::requiredString($payload, 'severity', 1, 'INVALID_INCIDENT_PAYLOAD', 'Payload invalido para registro de incidencia.'));
        $title = self::requiredString($payload, 'title', 3, 'INVALID_INCIDENT_PAYLOAD', 'Payload invalido para registro de incidencia.');
        $description = self::requiredString($payload, 'description', 10, 'INVALID_INCIDENT_PAYLOAD', 'Payload invalido para registro de incidencia.');
        $locationDescription = self::requiredString($payload, 'locationDescription', 3, 'INVALID_INCIDENT_PAYLOAD', 'Payload invalido para registro de incidencia.');
        $municipalityName = self::requiredString($payload, 'municipalityName', 3, 'INVALID_INCIDENT_PAYLOAD', 'Payload invalido para registro de incidencia.');
        $notes = self::optionalString($payload, 'notes', 500, 'INVALID_INCIDENT_PAYLOAD', 'Payload invalido para registro de incidencia.');
        $reportedBy = self::optionalString($payload, 'reportedBy', 255, 'INVALID_INCIDENT_PAYLOAD', 'Payload invalido para registro de incidencia.');
        $reporterRole = self::optionalString($payload, 'reporterRole', 100, 'INVALID_INCIDENT_PAYLOAD', 'Payload invalido para registro de incidencia.');
        $affectedPopulation = self::optionalNonNegativeInt($payload, 'affectedPopulation', 'INVALID_INCIDENT_PAYLOAD', 'Payload invalido para registro de incidencia.') ?? 0;
        $affectedCommunity = self::optionalString($payload, 'affectedCommunity', 255, 'INVALID_INCIDENT_PAYLOAD', 'Payload invalido para registro de incidencia.');
        $parentIncidentId = self::optionalUuid($payload, 'parentIncidentId', 'INVALID_INCIDENT_PAYLOAD', 'Payload invalido para registro de incidencia.');
        [$latitude, $longitude] = self::optionalCoordinates($payload, 'INVALID_INCIDENT_COORDINATES', 'Las coordenadas de la incidencia son invalidas o incompletas.');
        $evidenceUrls = self::optionalUrlArray($payload, 'evidenceUrls', 'INVALID_INCIDENT_PAYLOAD', 'Payload invalido para registro de incidencia.');

        if (!in_array($incidentType, self::INCIDENT_TYPES, true) || !in_array($severity, self::INCIDENT_SEVERITIES, true)) {
            Response::error(400, 'INVALID_INCIDENT_PAYLOAD', 'Payload invalido para registro de incidencia.');
        }

        try {
            $occurredAt = new DateTimeImmutable((string) ($payload['occurredAt'] ?? ''));
        } catch (Throwable) {
            throw new RuntimeException('INVALID_INCIDENT_OCCURRED_AT');
        }

        $tenantId = self::resolveTenantId($database, $tenantKey);
        $resolvedLogisticsOrderId = $logisticsOrderId !== null ? self::resolveLogisticsOrderId($database, $logisticsOrderId, $tenantId) : null;

        $metadata = self::buildIncidentMetadata($database, [
            'reportedBy' => $reportedBy,
            'reporterRole' => $reporterRole,
            'affectedPopulation' => $affectedPopulation,
            'affectedCommunity' => $affectedCommunity,
            'evidenceUrls' => $evidenceUrls,
            'assignedTo' => null,
            'priorityScore' => 0,
            'resolutionNotes' => null,
            'resolvedAt' => null,
            'escalatedAt' => null,
            'interventionStartedAt' => null,
            'recurrenceCount' => 0,
            'parentIncidentId' => $parentIncidentId,
            'slaTargetMinutes' => self::defaultSlaMinutes($severity),
            'firstResponseAt' => null,
            'responseTimeMinutes' => null,
        ]);

        $columns = [
            'id',
            'tenant_id',
            'logistics_order_id',
            'incident_type',
            'severity',
            'title',
            'description',
            'location_description',
            'latitude',
            'longitude',
            'occurred_at',
            'municipality_name',
            'notes',
            'status',
            'metadata',
        ];
        $values = [
            ':id',
            ':tenant_id',
            ':logistics_order_id',
            ':incident_type',
            ':severity',
            ':title',
            ':description',
            ':location_description',
            ':latitude',
            ':longitude',
            ':occurred_at',
            ':municipality_name',
            ':notes',
            ':status',
            'CAST(:metadata AS jsonb)',
        ];

        self::appendIncidentOptionalInsert($database, $columns, $values, 'reported_by', ':reported_by');
        self::appendIncidentOptionalInsert($database, $columns, $values, 'reporter_role', ':reporter_role');
        self::appendIncidentOptionalInsert($database, $columns, $values, 'affected_population', ':affected_population');
        self::appendIncidentOptionalInsert($database, $columns, $values, 'affected_community', ':affected_community');
        if (self::hasIncidentColumn($database, 'evidence_urls')) {
            $columns[] = 'evidence_urls';
            $values[] = 'CAST(:evidence_urls AS text[])';
        }
        self::appendIncidentOptionalInsert($database, $columns, $values, 'parent_incident_id', ':parent_incident_id');
        self::appendIncidentOptionalInsert($database, $columns, $values, 'priority_score', ':priority_score');
        self::appendIncidentOptionalInsert($database, $columns, $values, 'recurrence_count', ':recurrence_count');
        self::appendIncidentOptionalInsert($database, $columns, $values, 'sla_target_minutes', ':sla_target_minutes');

        $params = [
            'id' => Uuid::v4(),
            'tenant_id' => $tenantId,
            'logistics_order_id' => $resolvedLogisticsOrderId,
            'incident_type' => $incidentType,
            'severity' => $severity,
            'title' => $title,
            'description' => $description,
            'location_description' => $locationDescription,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'occurred_at' => $occurredAt->format(DATE_ATOM),
            'municipality_name' => $municipalityName,
            'notes' => $notes,
            'status' => 'reportada',
            'metadata' => json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}',
        ];

        if (self::hasIncidentColumn($database, 'reported_by')) {
            $params['reported_by'] = $reportedBy;
        }
        if (self::hasIncidentColumn($database, 'reporter_role')) {
            $params['reporter_role'] = $reporterRole;
        }
        if (self::hasIncidentColumn($database, 'affected_population')) {
            $params['affected_population'] = $affectedPopulation;
        }
        if (self::hasIncidentColumn($database, 'affected_community')) {
            $params['affected_community'] = $affectedCommunity;
        }
        if (self::hasIncidentColumn($database, 'evidence_urls')) {
            $params['evidence_urls'] = self::toPgTextArray($evidenceUrls);
        }
        if (self::hasIncidentColumn($database, 'parent_incident_id')) {
            $params['parent_incident_id'] = $parentIncidentId;
        }
        if (self::hasIncidentColumn($database, 'priority_score')) {
            $params['priority_score'] = 0;
        }
        if (self::hasIncidentColumn($database, 'recurrence_count')) {
            $params['recurrence_count'] = 0;
        }
        if (self::hasIncidentColumn($database, 'sla_target_minutes')) {
            $params['sla_target_minutes'] = self::defaultSlaMinutes($severity);
        }

        $database->execute(
            'INSERT INTO public.incidents (' . implode(', ', $columns) . ')
             VALUES (' . implode(', ', $values) . ')',
            $params
        );

        $row = self::findLatestIncidentByNaturalKey($database, $tenantId, $title, $occurredAt);
        return self::toIncidentResponse($row ?? self::findIncidentByTitleFallback($database, $tenantId, $title));
    }

    private static function listIncidents(Database $database, int $page, int $limit, ?string $tenantId, array $filters): array
    {
        $where = ['i.deleted_at IS NULL'];
        $params = [];

        if ($tenantId !== null) {
            $where[] = 'i.tenant_id = :tenant_id';
            $params['tenant_id'] = $tenantId;
        }
        if ($filters['status'] !== '') {
            $where[] = 'i.status = :status';
            $params['status'] = $filters['status'];
        }
        if ($filters['severity'] !== '') {
            $where[] = 'i.severity = :severity';
            $params['severity'] = $filters['severity'];
        }
        if ($filters['incidentType'] !== '') {
            $where[] = 'i.incident_type = :incident_type';
            $params['incident_type'] = $filters['incidentType'];
        }
        if ($filters['municipalityName'] !== '') {
            $where[] = 'i.municipality_name ILIKE :municipality_name';
            $params['municipality_name'] = '%' . $filters['municipalityName'] . '%';
        }

        $condition = implode(' AND ', $where);
        $total = (int) $database->scalar('SELECT COUNT(*) FROM public.incidents i WHERE ' . $condition, $params);
        $rows = $database->all(
            'SELECT ' . self::incidentSelectList($database, 'i') . '
             FROM public.incidents i
             WHERE ' . $condition . '
             ORDER BY i.created_at DESC
             LIMIT :limit OFFSET :offset',
            array_merge($params, ['limit' => $limit, 'offset' => ($page - 1) * $limit])
        );

        return ['data' => $rows, 'total' => $total];
    }

    private static function findIncidentById(Database $database, string $id): ?array
    {
        return $database->one(
            'SELECT ' . self::incidentSelectList($database, 'i') . '
             FROM public.incidents i
             WHERE i.id = :id
               AND i.deleted_at IS NULL
             LIMIT 1',
            ['id' => $id]
        );
    }

    private static function findLatestIncidentByNaturalKey(Database $database, string $tenantId, string $title, DateTimeImmutable $occurredAt): ?array
    {
        return $database->one(
            'SELECT ' . self::incidentSelectList($database, 'i') . '
             FROM public.incidents i
             WHERE i.tenant_id = :tenant_id
               AND i.title = :title
               AND i.occurred_at = :occurred_at
               AND i.deleted_at IS NULL
             ORDER BY i.created_at DESC
             LIMIT 1',
            [
                'tenant_id' => $tenantId,
                'title' => $title,
                'occurred_at' => $occurredAt->format(DATE_ATOM),
            ]
        );
    }

    private static function findIncidentByTitleFallback(Database $database, string $tenantId, string $title): array
    {
        $row = $database->one(
            'SELECT ' . self::incidentSelectList($database, 'i') . '
             FROM public.incidents i
             WHERE i.tenant_id = :tenant_id
               AND i.title = :title
               AND i.deleted_at IS NULL
             ORDER BY i.created_at DESC
             LIMIT 1',
            ['tenant_id' => $tenantId, 'title' => $title]
        );

        if ($row === null) {
            throw new RuntimeException('INCIDENT_REGISTRATION_FAILED');
        }

        return $row;
    }

    private static function updateIncidentStatus(
        Database $database,
        array $row,
        string $status,
        ?string $assignedTo,
        ?string $resolutionNotes,
        string $performedBy
    ): array {
        $metadata = self::decodeJson($row['metadata'] ?? '{}');
        $current = self::toIncidentResponse($row);
        $sets = ['status = :status', 'metadata = CAST(:metadata AS jsonb)', 'updated_at = NOW()'];
        $params = ['id' => $row['id'], 'status' => $status];

        if ($assignedTo !== null) {
            if (self::hasIncidentColumn($database, 'assigned_to')) {
                $sets[] = 'assigned_to = :assigned_to';
                $params['assigned_to'] = $assignedTo;
            } else {
                $metadata['assignedTo'] = $assignedTo;
            }
        }

        if ($resolutionNotes !== null) {
            if (self::hasIncidentColumn($database, 'resolution_notes')) {
                $sets[] = 'resolution_notes = :resolution_notes';
                $params['resolution_notes'] = $resolutionNotes;
            } else {
                $metadata['resolutionNotes'] = $resolutionNotes;
            }
        }

        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        if (in_array($status, ['resolved', 'cerrada'], true)) {
            self::applyIncidentTimestampField($database, $sets, $params, $metadata, 'resolved_at', 'resolvedAt', $now);
        }
        if ($status === 'escalada') {
            self::applyIncidentTimestampField($database, $sets, $params, $metadata, 'escalated_at', 'escalatedAt', $now);
        }
        if (in_array($status, ['en_gestion', 'intervenida'], true)) {
            self::applyIncidentTimestampField($database, $sets, $params, $metadata, 'intervention_started_at', 'interventionStartedAt', $now);
        }

        if (!in_array($status, ['reportada', 'open'], true) && $current['firstResponseAt'] === null) {
            $responseMinutes = max(0, (int) floor(($now->getTimestamp() - (new DateTimeImmutable((string) $current['createdAt']))->getTimestamp()) / 60));

            if (self::hasIncidentColumn($database, 'first_response_at')) {
                $sets[] = 'first_response_at = COALESCE(first_response_at, :first_response_at)';
                $params['first_response_at'] = $now->format(DATE_ATOM);
            } else {
                $metadata['firstResponseAt'] = $now->format(DATE_ATOM);
            }

            if (self::hasIncidentColumn($database, 'response_time_minutes')) {
                $sets[] = 'response_time_minutes = COALESCE(response_time_minutes, :response_time_minutes)';
                $params['response_time_minutes'] = $responseMinutes;
            } else {
                $metadata['responseTimeMinutes'] = $responseMinutes;
            }
        }

        $params['metadata'] = json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';

        $database->execute(
            'UPDATE public.incidents
             SET ' . implode(', ', $sets) . '
             WHERE id = :id
               AND deleted_at IS NULL',
            $params
        );

        if (self::hasActionsSchema($database)) {
            self::saveIncidentAction($database, [
                'id' => Uuid::v4(),
                'incident_id' => (string) $row['id'],
                'action_type' => 'status_change_to_' . $status,
                'performed_by' => $performedBy,
                'description' => 'Estado cambiado de \'' . $current['status'] . '\' a \'' . $status . '\'' . ($resolutionNotes !== null ? '. Notas: ' . $resolutionNotes : ''),
                'metadata' => ['previousStatus' => $current['status'], 'newStatus' => $status],
            ]);
        }

        $updated = self::findIncidentById($database, (string) $row['id']);
        if ($updated === null) {
            throw new RuntimeException('INCIDENT_NOT_FOUND');
        }

        return $updated;
    }

    private static function prioritizeIncident(Database $database, array $row): float
    {
        $incident = self::toIncidentResponse($row);
        $severityWeight = self::SEVERITY_WEIGHTS[$incident['severity']] ?? 1;
        $populationFactor = min(10.0, log(max(1.0, (float) $incident['affectedPopulation']), 2));
        $recurrenceFactor = min(5.0, ((float) $incident['recurrenceCount']) * 1.5);
        $score = round(($severityWeight * 4 + $populationFactor * 3 + $recurrenceFactor * 3) * 10) / 10;
        $score = min(99.99, max(0.0, $score));

        $metadata = self::decodeJson($row['metadata'] ?? '{}');
        $sets = ['metadata = CAST(:metadata AS jsonb)', 'updated_at = NOW()'];
        $params = ['id' => $row['id']];

        if (self::hasIncidentColumn($database, 'priority_score')) {
            $sets[] = 'priority_score = :priority_score';
            $params['priority_score'] = $score;
        } else {
            $metadata['priorityScore'] = $score;
        }

        $params['metadata'] = json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';

        $database->execute(
            'UPDATE public.incidents
             SET ' . implode(', ', $sets) . '
             WHERE id = :id
               AND deleted_at IS NULL',
            $params
        );

        return $score;
    }

    private static function listIncidentActions(Database $database, string $incidentId): array
    {
        $rows = $database->all(
            'SELECT id, incident_id, action_type, performed_by, description, metadata::text AS metadata, created_at
             FROM public.incident_actions
             WHERE incident_id = :incident_id
             ORDER BY created_at ASC',
            ['incident_id' => $incidentId]
        );

        return array_map(static function (array $row): array {
            return [
                'id' => (string) $row['id'],
                'incidentId' => (string) $row['incident_id'],
                'actionType' => (string) $row['action_type'],
                'performedBy' => (string) $row['performed_by'],
                'description' => (string) $row['description'],
                'metadata' => self::decodeJson($row['metadata'] ?? '{}'),
                'createdAt' => self::toIso($row['created_at'] ?? null),
            ];
        }, $rows);
    }

    private static function saveIncidentAction(Database $database, array $data): array
    {
        $row = $database->one(
            'INSERT INTO public.incident_actions (
                id,
                incident_id,
                action_type,
                performed_by,
                description,
                metadata
             )
             VALUES (
                :id,
                :incident_id,
                :action_type,
                :performed_by,
                :description,
                CAST(:metadata AS jsonb)
             )
             RETURNING id, incident_id, action_type, performed_by, description, metadata::text AS metadata, created_at',
            [
                'id' => $data['id'],
                'incident_id' => $data['incident_id'],
                'action_type' => $data['action_type'],
                'performed_by' => $data['performed_by'],
                'description' => $data['description'],
                'metadata' => json_encode($data['metadata'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}',
            ]
        );

        return [
            'id' => (string) $row['id'],
            'incidentId' => (string) $row['incident_id'],
            'actionType' => (string) $row['action_type'],
            'performedBy' => (string) $row['performed_by'],
            'description' => (string) $row['description'],
            'metadata' => self::decodeJson($row['metadata'] ?? '{}'),
            'createdAt' => self::toIso($row['created_at'] ?? null),
        ];
    }

    private static function listIncidentAlerts(Database $database, string $tenantId, int $page, int $limit): array
    {
        $total = (int) $database->scalar(
            'SELECT COUNT(*) FROM public.incident_alerts WHERE tenant_id = :tenant_id',
            ['tenant_id' => $tenantId]
        );
        $rows = $database->all(
            'SELECT id, tenant_id, alert_type, severity, title, description, zone_name, incident_count,
                    is_acknowledged, acknowledged_by, acknowledged_at, metadata::text AS metadata, created_at
             FROM public.incident_alerts
             WHERE tenant_id = :tenant_id
             ORDER BY created_at DESC
             LIMIT :limit OFFSET :offset',
            ['tenant_id' => $tenantId, 'limit' => $limit, 'offset' => ($page - 1) * $limit]
        );

        return [
            'data' => array_map([self::class, 'toIncidentAlertResponse'], $rows),
            'total' => $total,
        ];
    }

    private static function generateIncidentAlerts(Database $database, string $tenantId): array
    {
        $thresholds = self::loadAlertThresholds($database, $tenantId);
        $index = [];
        foreach ($thresholds as $threshold) {
            $index[$threshold['ruleKey']] = $threshold['value'];
        }

        $zoneMinCount = (float) ($index['incident.zone_min_count'] ?? self::DEFAULT_ALERT_THRESHOLDS['incident.zone_min_count']);
        $zoneHighCount = (float) ($index['incident.zone_high_count'] ?? self::DEFAULT_ALERT_THRESHOLDS['incident.zone_high_count']);
        $zoneWindowHours = (int) ($index['incident.zone_window_hours'] ?? self::DEFAULT_ALERT_THRESHOLDS['incident.zone_window_hours']);
        $unattendedHours = (int) ($index['incident.unattended_hours'] ?? self::DEFAULT_ALERT_THRESHOLDS['incident.unattended_hours']);
        $unattendedHighCount = (int) ($index['incident.unattended_high_count'] ?? self::DEFAULT_ALERT_THRESHOLDS['incident.unattended_high_count']);

        $generated = [];
        foreach (self::countRecentByZone($database, $tenantId, $zoneWindowHours) as $zone) {
            if ($zone['count'] >= $zoneMinCount) {
                $generated[] = self::saveIncidentAlert($database, [
                    'id' => Uuid::v4(),
                    'tenant_id' => $tenantId,
                    'alert_type' => 'multiple_incidents_zone',
                    'severity' => $zone['count'] >= $zoneHighCount ? 'high' : 'medium',
                    'title' => 'Multiples incidencias en ' . $zone['zone'],
                    'description' => 'Se han registrado ' . $zone['count'] . ' incidencias en las ultimas ' . $zoneWindowHours . 'h en la zona ' . $zone['zone'] . '.',
                    'zone_name' => $zone['zone'],
                    'incident_count' => $zone['count'],
                    'metadata' => [],
                ]);
            }

            if ($zone['criticalCount'] > 0) {
                $generated[] = self::saveIncidentAlert($database, [
                    'id' => Uuid::v4(),
                    'tenant_id' => $tenantId,
                    'alert_type' => 'critical_risk',
                    'severity' => 'high',
                    'title' => 'Riesgo critico en ' . $zone['zone'],
                    'description' => 'Existen ' . $zone['criticalCount'] . ' incidencias de severidad critica en ' . $zone['zone'] . '.',
                    'zone_name' => $zone['zone'],
                    'incident_count' => $zone['criticalCount'],
                    'metadata' => [],
                ]);
            }
        }

        $unattendedCount = self::countUnattended($database, $tenantId, $unattendedHours);
        if ($unattendedCount > 0) {
            $generated[] = self::saveIncidentAlert($database, [
                'id' => Uuid::v4(),
                'tenant_id' => $tenantId,
                'alert_type' => 'unattended_timeout',
                'severity' => $unattendedCount >= $unattendedHighCount ? 'high' : 'medium',
                'title' => 'Incidencias sin atender',
                'description' => $unattendedCount . ' incidencias llevan mas de ' . $unattendedHours . ' horas sin ser atendidas.',
                'zone_name' => null,
                'incident_count' => $unattendedCount,
                'metadata' => [],
            ]);
        }

        return $generated;
    }

    private static function saveIncidentAlert(Database $database, array $data): array
    {
        $row = $database->one(
            'INSERT INTO public.incident_alerts (
                id,
                tenant_id,
                alert_type,
                severity,
                title,
                description,
                zone_name,
                incident_count,
                metadata
             )
             VALUES (
                :id,
                :tenant_id,
                :alert_type,
                :severity,
                :title,
                :description,
                :zone_name,
                :incident_count,
                CAST(:metadata AS jsonb)
             )
             RETURNING id, tenant_id, alert_type, severity, title, description, zone_name, incident_count,
                       is_acknowledged, acknowledged_by, acknowledged_at, metadata::text AS metadata, created_at',
            [
                'id' => $data['id'],
                'tenant_id' => $data['tenant_id'],
                'alert_type' => $data['alert_type'],
                'severity' => $data['severity'],
                'title' => $data['title'],
                'description' => $data['description'],
                'zone_name' => $data['zone_name'],
                'incident_count' => $data['incident_count'],
                'metadata' => json_encode($data['metadata'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}',
            ]
        );

        return self::toIncidentAlertResponse($row);
    }

    private static function toIncidentAlertResponse(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'tenantId' => (string) $row['tenant_id'],
            'alertType' => (string) $row['alert_type'],
            'severity' => (string) $row['severity'],
            'title' => (string) $row['title'],
            'description' => (string) $row['description'],
            'zoneName' => $row['zone_name'],
            'incidentCount' => (int) $row['incident_count'],
            'isAcknowledged' => self::toBool($row['is_acknowledged'] ?? false),
            'acknowledgedBy' => $row['acknowledged_by'],
            'acknowledgedAt' => self::toIso($row['acknowledged_at'] ?? null),
            'metadata' => self::decodeJson($row['metadata'] ?? '{}'),
            'createdAt' => self::toIso($row['created_at'] ?? null),
        ];
    }

    private static function getZoneSummary(Database $database, string $tenantId): array
    {
        $priorityExpression = self::hasIncidentColumn($database, 'priority_score')
            ? 'COALESCE(i.priority_score, 0)'
            : 'COALESCE(NULLIF(i.metadata->>\'priorityScore\', \'\')::numeric, 0)';

        $rows = $database->all(
            'SELECT
                i.municipality_name,
                i.incident_type,
                i.severity,
                COUNT(*)::text AS total,
                COUNT(*) FILTER (WHERE i.status IN (\'open\', \'reportada\'))::text AS open_count,
                COUNT(*) FILTER (WHERE i.status IN (\'en_gestion\', \'intervenida\', \'investigating\'))::text AS in_progress_count,
                COALESCE(AVG(' . $priorityExpression . '), 0)::text AS avg_priority_score,
                MAX(i.created_at) AS last_reported_at
             FROM public.incidents i
             WHERE i.tenant_id = :tenant_id
               AND i.deleted_at IS NULL
             GROUP BY i.municipality_name, i.incident_type, i.severity
             ORDER BY i.municipality_name, i.severity DESC',
            ['tenant_id' => $tenantId]
        );

        return array_map(static function (array $row): array {
            return [
                'municipalityName' => (string) $row['municipality_name'],
                'incidentType' => (string) $row['incident_type'],
                'severity' => (string) $row['severity'],
                'total' => (int) $row['total'],
                'openCount' => (int) $row['open_count'],
                'inProgressCount' => (int) $row['in_progress_count'],
                'avgPriorityScore' => (float) $row['avg_priority_score'],
                'lastReportedAt' => self::toIso($row['last_reported_at'] ?? null),
            ];
        }, $rows);
    }

    private static function countByZoneAndSeverity(Database $database, string $tenantId): array
    {
        $rows = $database->all(
            'SELECT i.municipality_name AS zone, i.severity, COUNT(*)::text AS count
             FROM public.incidents i
             WHERE i.tenant_id = :tenant_id
               AND i.deleted_at IS NULL
             GROUP BY i.municipality_name, i.severity
             ORDER BY COUNT(*) DESC',
            ['tenant_id' => $tenantId]
        );

        return array_map(static function (array $row): array {
            return [
                'zone' => (string) $row['zone'],
                'severity' => (string) $row['severity'],
                'count' => (int) $row['count'],
            ];
        }, $rows);
    }

    private static function countRecentByZone(Database $database, string $tenantId, int $hoursBack): array
    {
        $rows = $database->all(
            'SELECT
                i.municipality_name AS zone,
                COUNT(*)::text AS count,
                COUNT(*) FILTER (WHERE i.severity = \'critical\')::text AS critical_count
             FROM public.incidents i
             WHERE i.tenant_id = :tenant_id
               AND i.deleted_at IS NULL
               AND i.created_at >= NOW() - CAST(:hours_back AS interval)
             GROUP BY i.municipality_name
             ORDER BY COUNT(*) DESC',
            ['tenant_id' => $tenantId, 'hours_back' => $hoursBack . ' hours']
        );

        return array_map(static function (array $row): array {
            return [
                'zone' => (string) $row['zone'],
                'count' => (int) $row['count'],
                'criticalCount' => (int) $row['critical_count'],
            ];
        }, $rows);
    }

    private static function countUnattended(Database $database, string $tenantId, int $hoursThreshold): int
    {
        return (int) $database->scalar(
            'SELECT COUNT(*)::text AS count
             FROM public.incidents i
             WHERE i.tenant_id = :tenant_id
               AND i.deleted_at IS NULL
               AND i.status IN (\'reportada\', \'open\')
               AND i.created_at <= NOW() - CAST(:hours_threshold AS interval)',
            ['tenant_id' => $tenantId, 'hours_threshold' => $hoursThreshold . ' hours']
        );
    }

    private static function getIncidentClusters(Database $database, string $tenantId, int $radiusM, int $minPoints): array
    {
        if ($database->hasPostgis()) {
            try {
                $rows = $database->all(
                    'WITH points AS (
                        SELECT
                            i.id,
                            i.incident_type,
                            i.severity,
                            COALESCE(NULLIF(i.metadata->>\'affectedPopulation\', \'\')::int, 0) AS affected_population,
                            ST_SetSRID(ST_MakePoint(i.longitude::double precision, i.latitude::double precision), 4326) AS geom_4326,
                            ST_Transform(ST_SetSRID(ST_MakePoint(i.longitude::double precision, i.latitude::double precision), 4326), 3857) AS geom_3857
                        FROM public.incidents i
                        WHERE i.tenant_id = :tenant_id
                          AND i.deleted_at IS NULL
                          AND i.latitude IS NOT NULL
                          AND i.longitude IS NOT NULL
                    ),
                    clustered AS (
                        SELECT
                            p.*,
                            ST_ClusterDBSCAN(p.geom_3857, :radius_m, :min_points) OVER () AS cluster_id
                        FROM points p
                    )
                    SELECT
                        cluster_id::text AS cluster_id,
                        ST_Y(ST_Centroid(ST_Collect(geom_4326)))::text AS centroid_lat,
                        ST_X(ST_Centroid(ST_Collect(geom_4326)))::text AS centroid_lng,
                        COUNT(*)::text AS incident_count,
                        ROUND(AVG(
                            CASE severity
                                WHEN \'critical\' THEN 4
                                WHEN \'high\' THEN 3
                                WHEN \'medium\' THEN 2
                                ELSE 1
                            END
                        )::numeric, 1)::text AS avg_severity_score,
                        MODE() WITHIN GROUP (ORDER BY incident_type) AS dominant_type,
                        COALESCE(SUM(affected_population), 0)::text AS affected_population,
                        array_agg(id::text ORDER BY id)::text AS incident_ids
                    FROM clustered
                    WHERE cluster_id IS NOT NULL
                    GROUP BY cluster_id
                    ORDER BY COUNT(*) DESC, cluster_id',
                    ['tenant_id' => $tenantId, 'radius_m' => $radiusM, 'min_points' => $minPoints]
                );

                return array_map(static function (array $row): array {
                    return [
                        'clusterId' => (int) $row['cluster_id'],
                        'centroidLat' => (float) $row['centroid_lat'],
                        'centroidLng' => (float) $row['centroid_lng'],
                        'incidentCount' => (int) $row['incident_count'],
                        'avgSeverityScore' => (float) $row['avg_severity_score'],
                        'dominantType' => (string) $row['dominant_type'],
                        'affectedPopulation' => (int) $row['affected_population'],
                        'incidentIds' => self::parsePgTextArray($row['incident_ids'] ?? '{}'),
                    ];
                }, $rows);
            } catch (Throwable) {
            }
        }

        return self::clusterIncidentsInPhp($database, $tenantId, $radiusM, $minPoints);
    }

    private static function clusterIncidentsInPhp(Database $database, string $tenantId, int $radiusM, int $minPoints): array
    {
        $rows = $database->all(
            'SELECT id, incident_type, severity, latitude::text AS latitude, longitude::text AS longitude, metadata::text AS metadata
             FROM public.incidents
             WHERE tenant_id = :tenant_id
               AND deleted_at IS NULL
               AND latitude IS NOT NULL
               AND longitude IS NOT NULL',
            ['tenant_id' => $tenantId]
        );

        $points = [];
        foreach ($rows as $row) {
            $metadata = self::decodeJson($row['metadata'] ?? '{}');
            $points[] = [
                'id' => (string) $row['id'],
                'incidentType' => (string) $row['incident_type'],
                'severity' => (string) $row['severity'],
                'latitude' => (float) $row['latitude'],
                'longitude' => (float) $row['longitude'],
                'affectedPopulation' => (int) ($metadata['affectedPopulation'] ?? 0),
            ];
        }

        $visited = [];
        $clustered = [];
        $clusters = [];

        foreach ($points as $index => $point) {
            if (isset($visited[$index])) {
                continue;
            }
            $visited[$index] = true;
            $neighbors = self::incidentNeighbors($points, $index, $radiusM);
            if (count($neighbors) < $minPoints) {
                continue;
            }

            $clusterId = count($clusters);
            $queue = $neighbors;
            $memberIndexes = [];
            while ($queue !== []) {
                $neighborIndex = array_shift($queue);
                if (!isset($visited[$neighborIndex])) {
                    $visited[$neighborIndex] = true;
                    $nextNeighbors = self::incidentNeighbors($points, $neighborIndex, $radiusM);
                    if (count($nextNeighbors) >= $minPoints) {
                        foreach ($nextNeighbors as $nextIndex) {
                            if (!in_array($nextIndex, $queue, true)) {
                                $queue[] = $nextIndex;
                            }
                        }
                    }
                }

                if (isset($clustered[$neighborIndex])) {
                    continue;
                }
                $clustered[$neighborIndex] = $clusterId;
                $memberIndexes[] = $neighborIndex;
            }

            if ($memberIndexes === []) {
                continue;
            }

            $members = array_map(static fn (int $memberIndex): array => $points[$memberIndex], $memberIndexes);
            $clusters[] = self::summarizeIncidentCluster($clusterId, $members);
        }

        return $clusters;
    }

    private static function incidentNeighbors(array $points, int $originIndex, int $radiusM): array
    {
        $neighbors = [];
        foreach ($points as $index => $candidate) {
            if (self::haversineMeters(
                $points[$originIndex]['latitude'],
                $points[$originIndex]['longitude'],
                $candidate['latitude'],
                $candidate['longitude']
            ) <= $radiusM) {
                $neighbors[] = $index;
            }
        }

        return $neighbors;
    }

    private static function summarizeIncidentCluster(int $clusterId, array $members): array
    {
        $severityValues = array_map(static function (array $member): int {
            return match ($member['severity']) {
                'critical' => 4,
                'high' => 3,
                'medium' => 2,
                default => 1,
            };
        }, $members);
        $types = array_column($members, 'incidentType');
        $typeCounts = array_count_values($types);
        arsort($typeCounts);

        return [
            'clusterId' => $clusterId,
            'centroidLat' => array_sum(array_column($members, 'latitude')) / count($members),
            'centroidLng' => array_sum(array_column($members, 'longitude')) / count($members),
            'incidentCount' => count($members),
            'avgSeverityScore' => round(array_sum($severityValues) / count($severityValues), 1),
            'dominantType' => (string) array_key_first($typeCounts),
            'affectedPopulation' => array_sum(array_column($members, 'affectedPopulation')),
            'incidentIds' => array_values(array_column($members, 'id')),
        ];
    }

    private static function getIncidentTrends(Database $database, string $tenantId, string $granularity, int $limit): array
    {
        $view = $granularity === 'daily' ? 'public.v_incident_trends_daily' : 'public.v_incident_trends';
        $periodColumn = $granularity === 'daily' ? 'day' : 'week_start';
        $rows = $database->all(
            'SELECT
                ' . $periodColumn . '::text AS period,
                incident_type,
                severity,
                incident_count::text AS incident_count,
                total_affected::text AS total_affected,
                resolved_count::text AS resolved_count,
                avg_response_min::text AS avg_response_min
             FROM ' . $view . '
             WHERE tenant_id = :tenant_id
             ORDER BY ' . $periodColumn . ' DESC
             LIMIT :limit',
            ['tenant_id' => $tenantId, 'limit' => $limit]
        );

        return array_map(static function (array $row): array {
            return [
                'period' => (string) $row['period'],
                'incidentType' => (string) $row['incident_type'],
                'severity' => (string) $row['severity'],
                'incidentCount' => (int) $row['incident_count'],
                'totalAffected' => (int) $row['total_affected'],
                'resolvedCount' => (int) $row['resolved_count'],
                'avgResponseMin' => $row['avg_response_min'] !== null ? (float) $row['avg_response_min'] : null,
            ];
        }, $rows);
    }

    private static function loadAlertThresholds(Database $database, string $tenantId): array
    {
        if (!self::hasThresholdSchema($database)) {
            return [];
        }

        $rows = $database->all(
            'SELECT id, tenant_id, rule_key, value::text AS value, description, updated_by, updated_at
             FROM public.alert_thresholds
             WHERE tenant_id = :tenant_id
             ORDER BY rule_key',
            ['tenant_id' => $tenantId]
        );

        return array_map(static function (array $row): array {
            return [
                'id' => (string) $row['id'],
                'tenantId' => (string) $row['tenant_id'],
                'ruleKey' => (string) $row['rule_key'],
                'value' => (float) $row['value'],
                'description' => $row['description'],
                'updatedBy' => $row['updated_by'],
                'updatedAt' => self::toIso($row['updated_at'] ?? null),
            ];
        }, $rows);
    }

    private static function upsertAlertThreshold(
        Database $database,
        string $tenantId,
        string $ruleKey,
        float $value,
        ?string $updatedBy
    ): array {
        $row = $database->one(
            'INSERT INTO public.alert_thresholds (tenant_id, rule_key, value, updated_by, updated_at)
             VALUES (:tenant_id, :rule_key, :value, :updated_by, NOW())
             ON CONFLICT (tenant_id, rule_key)
             DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
             RETURNING id, tenant_id, rule_key, value::text AS value, description, updated_by, updated_at',
            ['tenant_id' => $tenantId, 'rule_key' => $ruleKey, 'value' => $value, 'updated_by' => $updatedBy]
        );

        return [
            'id' => (string) $row['id'],
            'tenantId' => (string) $row['tenant_id'],
            'ruleKey' => (string) $row['rule_key'],
            'value' => (float) $row['value'],
            'description' => $row['description'],
            'updatedBy' => $row['updated_by'],
            'updatedAt' => self::toIso($row['updated_at'] ?? null),
        ];
    }

    private static function classifyIncident(string $title, string $description): array
    {
        $text = self::normalizeText($title . ' ' . $description);
        $scores = [];

        foreach (self::TYPE_RULES as $rule) {
            $score = 0;
            $matched = [];
            foreach ($rule['keywords'] as $keyword) {
                if (str_contains($text, self::normalizeText($keyword))) {
                    $score += $rule['weight'];
                    $matched[] = $keyword;
                }
            }
            if ($score > 0) {
                $scores[] = [
                    'type' => $rule['type'],
                    'score' => $score,
                    'matched' => $matched,
                    'severity' => $rule['severity'],
                    'weight' => $rule['weight'],
                ];
            }
        }

        usort($scores, static fn (array $left, array $right): int => $right['score'] <=> $left['score']);
        if ($scores === []) {
            return [
                'suggestedType' => 'emergencia_social',
                'suggestedSeverity' => 'medium',
                'confidence' => 0.1,
                'matchedKeywords' => [],
                'method' => 'keyword_nlp',
            ];
        }

        $best = $scores[0];
        $maxPossible = count($best['matched']) * (int) $best['weight'];
        $confidence = min(1.0, $best['score'] / max($maxPossible, 20));
        $severity = (string) $best['severity'];
        $maxBoostWeight = 0;

        foreach (self::SEVERITY_BOOSTS as $boost) {
            foreach ($boost['keywords'] as $keyword) {
                if (!str_contains($text, self::normalizeText($keyword))) {
                    continue;
                }
                if ($boost['weight'] > $maxBoostWeight) {
                    $maxBoostWeight = $boost['weight'];
                    $severity = (string) $boost['severity'];
                }
                $confidence = min(1.0, $confidence + 0.05);
            }
        }

        if (isset($scores[1])) {
            $ratio = $scores[1]['score'] / max(1, $best['score']);
            if ($ratio > 0.8) {
                $confidence *= 0.7;
            } elseif ($ratio > 0.5) {
                $confidence *= 0.85;
            }
        }

        return [
            'suggestedType' => (string) $best['type'],
            'suggestedSeverity' => $severity,
            'confidence' => round($confidence, 2),
            'matchedKeywords' => array_values($best['matched']),
            'method' => 'keyword_nlp',
        ];
    }

    private static function normalizeText(string $text): string
    {
        $normalized = mb_strtolower($text, 'UTF-8');
        $normalized = strtr($normalized, [
            'á' => 'a',
            'é' => 'e',
            'í' => 'i',
            'ó' => 'o',
            'ú' => 'u',
            'ü' => 'u',
            'ñ' => 'n',
        ]);
        $normalized = preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $normalized) ?? $normalized;
        $normalized = preg_replace('/\s+/u', ' ', $normalized) ?? $normalized;
        return trim($normalized);
    }

    private static function toIncidentResponse(array $row): array
    {
        $metadata = self::decodeJson($row['metadata'] ?? '{}');

        return [
            'id' => (string) $row['id'],
            'tenantId' => (string) $row['tenant_id'],
            'logisticsOrderId' => $row['logistics_order_id'],
            'incidentType' => (string) $row['incident_type'],
            'severity' => (string) $row['severity'],
            'title' => (string) $row['title'],
            'description' => (string) $row['description'],
            'locationDescription' => (string) $row['location_description'],
            'latitude' => $row['latitude'] !== null ? (float) $row['latitude'] : null,
            'longitude' => $row['longitude'] !== null ? (float) $row['longitude'] : null,
            'occurredAt' => self::toIso($row['occurred_at'] ?? null),
            'municipalityName' => (string) $row['municipality_name'],
            'notes' => $row['notes'],
            'status' => (string) $row['status'],
            'reportedBy' => self::pickString($row['reported_by'] ?? null, $metadata['reportedBy'] ?? null),
            'reporterRole' => self::pickString($row['reporter_role'] ?? null, $metadata['reporterRole'] ?? null),
            'affectedPopulation' => self::toIntValue($row['affected_population'] ?? ($metadata['affectedPopulation'] ?? 0), 0),
            'affectedCommunity' => self::pickString($row['affected_community'] ?? null, $metadata['affectedCommunity'] ?? null),
            'evidenceUrls' => self::evidenceUrls($row['evidence_urls'] ?? null, $metadata['evidenceUrls'] ?? []),
            'assignedTo' => self::pickString($row['assigned_to'] ?? null, $metadata['assignedTo'] ?? null),
            'priorityScore' => self::toFloatValue($row['priority_score'] ?? ($metadata['priorityScore'] ?? 0), 0.0),
            'resolutionNotes' => self::pickString($row['resolution_notes'] ?? null, $metadata['resolutionNotes'] ?? null),
            'resolvedAt' => self::toIso($row['resolved_at'] ?? ($metadata['resolvedAt'] ?? null)),
            'escalatedAt' => self::toIso($row['escalated_at'] ?? ($metadata['escalatedAt'] ?? null)),
            'interventionStartedAt' => self::toIso($row['intervention_started_at'] ?? ($metadata['interventionStartedAt'] ?? null)),
            'recurrenceCount' => self::toIntValue($row['recurrence_count'] ?? ($metadata['recurrenceCount'] ?? 0), 0),
            'parentIncidentId' => self::pickString($row['parent_incident_id'] ?? null, $metadata['parentIncidentId'] ?? null),
            'slaTargetMinutes' => self::toNullableIntValue($row['sla_target_minutes'] ?? ($metadata['slaTargetMinutes'] ?? null)),
            'firstResponseAt' => self::toIso($row['first_response_at'] ?? ($metadata['firstResponseAt'] ?? null)),
            'responseTimeMinutes' => self::toNullableIntValue($row['response_time_minutes'] ?? ($metadata['responseTimeMinutes'] ?? null)),
            'createdAt' => self::toIso($row['created_at'] ?? null),
        ];
    }

    private static function handleIncidentRegistrationError(RuntimeException $error): void
    {
        if ($error->getMessage() === 'TENANT_NOT_FOUND') {
            Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
        }
        if ($error->getMessage() === 'LOGISTICS_ORDER_NOT_FOUND_FOR_TENANT') {
            Response::error(404, 'LOGISTICS_ORDER_NOT_FOUND_FOR_TENANT', 'La operacion logistica asociada no existe para el municipio indicado.');
        }
        if ($error->getMessage() === 'INVALID_INCIDENT_OCCURRED_AT') {
            Response::error(400, 'INVALID_INCIDENT_OCCURRED_AT', 'La fecha y hora de ocurrencia no es valida.');
        }
        if ($error->getMessage() === 'INVALID_INCIDENT_COORDINATES') {
            Response::error(400, 'INVALID_INCIDENT_COORDINATES', 'Las coordenadas de la incidencia son invalidas o incompletas.');
        }
        if ($error->getMessage() === 'INCIDENT_REGISTRATION_FAILED') {
            Response::error(500, 'INCIDENT_REGISTRATION_FAILED', 'No fue posible registrar la incidencia territorial.');
        }
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

    private static function resolveLogisticsOrderId(Database $database, string $logisticsOrderId, string $tenantId): string
    {
        $row = $database->one(
            'SELECT id
             FROM public.logistics_orders
             WHERE id = :logistics_order_id
               AND tenant_id = :tenant_id
               AND deleted_at IS NULL
             LIMIT 1',
            ['logistics_order_id' => $logisticsOrderId, 'tenant_id' => $tenantId]
        );

        if ($row === null || !isset($row['id'])) {
            throw new RuntimeException('LOGISTICS_ORDER_NOT_FOUND_FOR_TENANT');
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

    private static function optionalNonNegativeInt(array $payload, string $key, string $code, string $message): ?int
    {
        if (!array_key_exists($key, $payload) || $payload[$key] === null || $payload[$key] === '') {
            return null;
        }
        $value = filter_var($payload[$key], FILTER_VALIDATE_INT);
        if ($value === false || $value < 0) {
            Response::error(400, $code, $message);
        }
        return (int) $value;
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

    private static function optionalCoordinates(array $payload, string $code, string $message): array
    {
        $hasLat = array_key_exists('latitude', $payload) && $payload['latitude'] !== null && $payload['latitude'] !== '';
        $hasLng = array_key_exists('longitude', $payload) && $payload['longitude'] !== null && $payload['longitude'] !== '';
        if ($hasLat !== $hasLng) {
            throw new RuntimeException('INVALID_INCIDENT_COORDINATES');
        }
        if (!$hasLat) {
            return [null, null];
        }
        $latitude = filter_var($payload['latitude'], FILTER_VALIDATE_FLOAT);
        $longitude = filter_var($payload['longitude'], FILTER_VALIDATE_FLOAT);
        if ($latitude === false || $latitude < -90 || $latitude > 90 || $longitude === false || $longitude < -180 || $longitude > 180) {
            throw new RuntimeException('INVALID_INCIDENT_COORDINATES');
        }
        return [(float) $latitude, (float) $longitude];
    }

    private static function optionalUrlArray(array $payload, string $key, string $code, string $message): array
    {
        if (!array_key_exists($key, $payload) || $payload[$key] === null) {
            return [];
        }
        if (!is_array($payload[$key]) || count($payload[$key]) > 10) {
            Response::error(400, $code, $message);
        }

        $urls = [];
        foreach ($payload[$key] as $value) {
            $url = trim((string) $value);
            if ($url === '' || filter_var($url, FILTER_VALIDATE_URL) === false) {
                Response::error(400, $code, $message);
            }
            $urls[] = $url;
        }

        return $urls;
    }

    private static function page(Request $request): int
    {
        return max(1, (int) ($request->query('page', 1) ?? 1));
    }

    private static function limit(Request $request): int
    {
        return min(100, max(1, (int) ($request->query('limit', 20) ?? 20)));
    }

    private static function hasIncidentColumn(Database $database, string $column): bool
    {
        return true;
    }

    private static function hasActionsSchema(Database $database): bool
    {
        return $database->relationExists('public.incident_actions');
    }

    private static function hasAlertsSchema(Database $database): bool
    {
        return $database->relationExists('public.incident_alerts');
    }

    private static function hasThresholdSchema(Database $database): bool
    {
        return $database->relationExists('public.alert_thresholds');
    }

    private static function hasTrendViews(Database $database): bool
    {
        return $database->relationExists('public.v_incident_trends')
            && $database->relationExists('public.v_incident_trends_daily');
    }

    private static function incidentSelectList(Database $database, string $alias): string
    {
        return implode(",\n                ", [
            $alias . '.id',
            $alias . '.tenant_id',
            $alias . '.logistics_order_id',
            $alias . '.incident_type',
            $alias . '.severity',
            $alias . '.title',
            $alias . '.description',
            $alias . '.location_description',
            $alias . '.latitude::text AS latitude',
            $alias . '.longitude::text AS longitude',
            $alias . '.occurred_at',
            $alias . '.municipality_name',
            $alias . '.notes',
            $alias . '.status',
            $alias . '.metadata::text AS metadata',
            self::optionalIncidentSelect($database, $alias, 'reported_by'),
            self::optionalIncidentSelect($database, $alias, 'reporter_role'),
            self::optionalIncidentSelect($database, $alias, 'affected_population'),
            self::optionalIncidentSelect($database, $alias, 'affected_community'),
            self::optionalIncidentSelect($database, $alias, 'evidence_urls'),
            self::optionalIncidentSelect($database, $alias, 'assigned_to'),
            self::optionalIncidentSelect($database, $alias, 'priority_score'),
            self::optionalIncidentSelect($database, $alias, 'resolution_notes'),
            self::optionalIncidentSelect($database, $alias, 'resolved_at'),
            self::optionalIncidentSelect($database, $alias, 'escalated_at'),
            self::optionalIncidentSelect($database, $alias, 'intervention_started_at'),
            self::optionalIncidentSelect($database, $alias, 'recurrence_count'),
            self::optionalIncidentSelect($database, $alias, 'parent_incident_id'),
            self::optionalIncidentSelect($database, $alias, 'sla_target_minutes'),
            self::optionalIncidentSelect($database, $alias, 'first_response_at'),
            self::optionalIncidentSelect($database, $alias, 'response_time_minutes'),
            $alias . '.created_at',
        ]);
    }

    private static function optionalIncidentSelect(Database $database, string $alias, string $column): string
    {
        if (self::hasIncidentColumn($database, $column)) {
            return $alias . '.' . $column . '::text AS ' . $column;
        }

        return 'NULL::text AS ' . $column;
    }

    private static function buildIncidentMetadata(Database $database, array $values): array
    {
        $metadata = [];
        $map = [
            'reportedBy' => 'reported_by',
            'reporterRole' => 'reporter_role',
            'affectedPopulation' => 'affected_population',
            'affectedCommunity' => 'affected_community',
            'evidenceUrls' => 'evidence_urls',
            'assignedTo' => 'assigned_to',
            'priorityScore' => 'priority_score',
            'resolutionNotes' => 'resolution_notes',
            'resolvedAt' => 'resolved_at',
            'escalatedAt' => 'escalated_at',
            'interventionStartedAt' => 'intervention_started_at',
            'recurrenceCount' => 'recurrence_count',
            'parentIncidentId' => 'parent_incident_id',
            'slaTargetMinutes' => 'sla_target_minutes',
            'firstResponseAt' => 'first_response_at',
            'responseTimeMinutes' => 'response_time_minutes',
        ];

        foreach ($map as $key => $column) {
            if (self::hasIncidentColumn($database, $column)) {
                continue;
            }
            $value = $values[$key] ?? null;
            if ($value !== null && $value !== []) {
                $metadata[$key] = $value;
            }
        }

        return $metadata;
    }

    private static function appendIncidentOptionalInsert(Database $database, array &$columns, array &$values, string $column, string $placeholder): void
    {
        if (self::hasIncidentColumn($database, $column)) {
            $columns[] = $column;
            $values[] = $placeholder;
        }
    }

    private static function applyIncidentTimestampField(
        Database $database,
        array &$sets,
        array &$params,
        array &$metadata,
        string $column,
        string $metadataKey,
        DateTimeImmutable $value
    ): void {
        if (self::hasIncidentColumn($database, $column)) {
            $sets[] = $column . ' = :' . $column;
            $params[$column] = $value->format(DATE_ATOM);
        } else {
            $metadata[$metadataKey] = $value->format(DATE_ATOM);
        }
    }

    private static function defaultSlaMinutes(string $severity): int
    {
        return match ($severity) {
            'critical' => 60,
            'high' => 240,
            'medium' => 1440,
            'low' => 4320,
            default => 1440,
        };
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

    private static function evidenceUrls(mixed $columnValue, mixed $fallback): array
    {
        $urls = self::parsePgTextArray($columnValue);
        if ($urls !== []) {
            return $urls;
        }
        if (is_array($fallback)) {
            return array_values(array_map(static fn (mixed $item): string => (string) $item, $fallback));
        }
        return [];
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

    private static function toPgTextArray(array $values): string
    {
        $escaped = array_map(static function (string $value): string {
            $value = str_replace(['\\', '"'], ['\\\\', '\\"'], $value);
            return '"' . $value . '"';
        }, $values);
        return '{' . implode(',', $escaped) . '}';
    }

    private static function pickString(mixed $primary, mixed $fallback): ?string
    {
        $value = $primary !== null && $primary !== '' ? $primary : $fallback;
        if ($value === null || $value === '') {
            return null;
        }
        return (string) $value;
    }

    private static function toIntValue(mixed $value, int $default): int
    {
        if ($value === null || $value === '') {
            return $default;
        }
        return (int) $value;
    }

    private static function toNullableIntValue(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        return (int) $value;
    }

    private static function toFloatValue(mixed $value, float $default): float
    {
        if ($value === null || $value === '') {
            return $default;
        }
        return (float) $value;
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

    private static function isUuid(string $value): bool
    {
        return preg_match('/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/', $value) === 1;
    }

    private static function haversineMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371000;
        $latDelta = deg2rad($lat2 - $lat1);
        $lngDelta = deg2rad($lng2 - $lng1);
        $a = sin($latDelta / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($lngDelta / 2) ** 2;

        return 2 * $earthRadius * asin(min(1.0, sqrt($a)));
    }
}
