<?php
declare(strict_types=1);

namespace Agrored\Modules\Notifications;

use Agrored\Database\Database;
use Agrored\Http\Request;
use Agrored\Http\Response;
use Agrored\Http\Router;
use Agrored\Support\Uuid;
use DateTimeImmutable;
use RuntimeException;
use Throwable;

final class NotificationModule
{
    private const CHANNELS = ['email', 'sms', 'whatsapp', 'in_app'];

    public static function register(Router $router, Database $database): void
    {
        $router->post('/api/v1/notifications/register', static function (Request $request) use ($database): void {
            $payload = $request->body();

            $tenantKey = self::requiredString($payload, 'tenantId', 1, 'INVALID_NOTIFICATION_PAYLOAD', 'Payload invalido para registro de notificacion.');
            $incidentId = self::optionalUuid($payload, 'incidentId', 'INVALID_NOTIFICATION_PAYLOAD', 'Payload invalido para registro de notificacion.');
            $logisticsOrderId = self::optionalUuid($payload, 'logisticsOrderId', 'INVALID_NOTIFICATION_PAYLOAD', 'Payload invalido para registro de notificacion.');
            $offerId = self::optionalUuid($payload, 'offerId', 'INVALID_NOTIFICATION_PAYLOAD', 'Payload invalido para registro de notificacion.');
            $notificationChannel = strtolower(self::requiredString($payload, 'notificationChannel', 1, 'INVALID_NOTIFICATION_PAYLOAD', 'Payload invalido para registro de notificacion.'));
            $recipientLabel = self::requiredString($payload, 'recipientLabel', 3, 'INVALID_NOTIFICATION_PAYLOAD', 'Payload invalido para registro de notificacion.');
            $title = self::requiredString($payload, 'title', 3, 'INVALID_NOTIFICATION_PAYLOAD', 'Payload invalido para registro de notificacion.');
            $message = self::requiredString($payload, 'message', 10, 'INVALID_NOTIFICATION_PAYLOAD', 'Payload invalido para registro de notificacion.');
            $scheduledFor = self::requiredDate($payload, 'scheduledFor', 'INVALID_NOTIFICATION_PAYLOAD', 'Payload invalido para registro de notificacion.');

            if (!in_array($notificationChannel, self::CHANNELS, true)) {
                Response::error(400, 'INVALID_NOTIFICATION_PAYLOAD', 'Payload invalido para registro de notificacion.');
            }

            if ($incidentId === null && $logisticsOrderId === null && $offerId === null) {
                Response::error(400, 'INVALID_NOTIFICATION_REFERENCE', 'La notificacion debe referenciar al menos una incidencia, oferta u operacion logistica.');
            }

            try {
                $tenantId = self::resolveTenantId($database, $tenantKey);
                $resolvedIncidentId = $incidentId !== null ? self::resolveIncidentId($database, $incidentId, $tenantId) : null;
                $resolvedLogisticsOrderId = $logisticsOrderId !== null ? self::resolveLogisticsOrderId($database, $logisticsOrderId, $tenantId) : null;
                $resolvedOfferId = $offerId !== null ? self::resolveOfferId($database, $offerId, $tenantId) : null;

                $row = self::insertNotification(
                    $database,
                    [
                        'id' => Uuid::v4(),
                        'tenant_id' => $tenantId,
                        'incident_id' => $resolvedIncidentId,
                        'logistics_order_id' => $resolvedLogisticsOrderId,
                        'offer_id' => $resolvedOfferId,
                        'notification_channel' => $notificationChannel,
                        'recipient_label' => $recipientLabel,
                        'title' => $title,
                        'message' => $message,
                        'scheduled_for' => $scheduledFor,
                        'status' => 'pending',
                        'metadata' => [],
                    ]
                );

                Response::success(self::toNotificationResponse($row), 201);
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
                if ($error->getMessage() === 'OFFER_NOT_FOUND_FOR_TENANT') {
                    Response::error(404, 'OFFER_NOT_FOUND_FOR_TENANT', 'La oferta asociada no existe para el municipio indicado.');
                }
                throw $error;
            }
        });

        $router->get('/api/v1/notifications', static function (Request $request) use ($database): void {
            $page = self::page($request);
            $limit = self::limit($request);
            $tenantHeader = trim((string) ($request->header('x-tenant-id', '') ?? ''));

            try {
                $tenantId = $tenantHeader !== '' ? self::resolveTenantId($database, $tenantHeader) : null;
                $result = self::listNotifications($database, $page, $limit, $tenantId);

                Response::paginated(
                    array_map([self::class, 'toNotificationResponse'], $result['data']),
                    ['total' => $result['total'], 'page' => $page, 'limit' => $limit]
                );
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }
        });

        $router->get('/api/v1/notifications/{id}', static function (Request $request) use ($database): void {
            $row = self::findNotificationById($database, (string) $request->route('id'));
            if ($row === null) {
                Response::error(404, 'NOTIFICATION_NOT_FOUND', 'Notificacion no encontrada.');
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
                    Response::error(404, 'NOTIFICATION_NOT_FOUND', 'Notificacion no encontrada.');
                }
            }

            Response::success(self::toNotificationResponse($row));
        });

        $router->post('/api/v1/notifications/{id}/dispatch', static function (Request $request) use ($database): void {
            try {
                Response::success(self::dispatchNotification($database, (string) $request->route('id')));
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'NOTIFICATION_NOT_FOUND') {
                    Response::error(404, 'NOTIFICATION_NOT_FOUND', 'Notificacion no encontrada.');
                }
                if ($error->getMessage() === 'NOTIFICATION_NOT_PENDING') {
                    Response::error(409, 'NOTIFICATION_NOT_PENDING', 'La notificacion ya fue enviada o no esta pendiente.');
                }
                if ($error->getMessage() === 'UNSUPPORTED_NOTIFICATION_CHANNEL') {
                    Response::error(400, 'UNSUPPORTED_NOTIFICATION_CHANNEL', 'El canal de notificacion no esta soportado para envio.');
                }
                throw $error;
            }
        });

        $router->post('/api/v1/notifications/dispatch-pending', static function () use ($database): void {
            $pending = self::findPendingNotifications($database, 50);
            $results = [];

            foreach ($pending as $notification) {
                $response = self::toNotificationResponse($notification);
                if ($response['notificationChannel'] !== 'email') {
                    continue;
                }

                try {
                    $results[] = array_merge(['id' => $response['id']], self::dispatchNotification($database, $response['id']));
                } catch (RuntimeException) {
                    $results[] = ['id' => $response['id'], 'status' => 'failed', 'errorMessage' => 'Dispatch error'];
                }
            }

            Response::success(['processed' => count($results), 'results' => $results]);
        });
    }

    private static function insertNotification(Database $database, array $data): array
    {
        $hasOfferColumn = $database->hasColumn('public.notifications', 'offer_id');
        $metadata = $data['metadata'];

        if (!$hasOfferColumn && $data['offer_id'] !== null) {
            $metadata['offerId'] = $data['offer_id'];
        }

        $columns = [
            'id',
            'tenant_id',
            'incident_id',
            'logistics_order_id',
            'notification_channel',
            'recipient_label',
            'title',
            'message',
            'scheduled_for',
            'status',
            'metadata',
        ];
        $values = [
            ':id',
            ':tenant_id',
            ':incident_id',
            ':logistics_order_id',
            ':notification_channel',
            ':recipient_label',
            ':title',
            ':message',
            ':scheduled_for',
            ':status',
            'CAST(:metadata AS jsonb)',
        ];
        $returning = [
            'id',
            'tenant_id',
            'incident_id',
            'logistics_order_id',
            'notification_channel',
            'recipient_label',
            'title',
            'message',
            'scheduled_for',
            'status',
            'metadata::text AS metadata',
            'created_at',
        ];

        if ($hasOfferColumn) {
            $columns[] = 'offer_id';
            $values[] = ':offer_id';
            $returning[] = 'offer_id';
        } else {
            $returning[] = 'NULL::text AS offer_id';
        }

        $params = [
            'id' => $data['id'],
            'tenant_id' => $data['tenant_id'],
            'incident_id' => $data['incident_id'],
            'logistics_order_id' => $data['logistics_order_id'],
            'notification_channel' => $data['notification_channel'],
            'recipient_label' => $data['recipient_label'],
            'title' => $data['title'],
            'message' => $data['message'],
            'scheduled_for' => $data['scheduled_for'] instanceof DateTimeImmutable ? $data['scheduled_for']->format(DATE_ATOM) : null,
            'status' => $data['status'],
            'metadata' => json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}',
        ];

        if ($hasOfferColumn) {
            $params['offer_id'] = $data['offer_id'];
        }

        return (array) $database->one(
            'INSERT INTO public.notifications (' . implode(', ', $columns) . ')
             VALUES (' . implode(', ', $values) . ')
             RETURNING ' . implode(', ', $returning),
            $params
        );
    }

    private static function listNotifications(Database $database, int $page, int $limit, ?string $tenantId): array
    {
        $where = 'n.deleted_at IS NULL';
        $params = [];

        if ($tenantId !== null) {
            $where .= ' AND n.tenant_id = :tenant_id';
            $params['tenant_id'] = $tenantId;
        }

        $total = (int) $database->scalar(
            'SELECT COUNT(*) FROM public.notifications n WHERE ' . $where,
            $params
        );

        $rows = $database->all(
            'SELECT
                n.id,
                n.tenant_id,
                n.incident_id,
                n.logistics_order_id,
                ' . self::offerSelect($database, 'n') . ',
                n.notification_channel,
                n.recipient_label,
                n.title,
                n.message,
                n.scheduled_for,
                n.status,
                n.metadata::text AS metadata,
                n.created_at
             FROM public.notifications n
             WHERE ' . $where . '
             ORDER BY n.created_at DESC
             LIMIT :limit OFFSET :offset',
            array_merge($params, [
                'limit' => $limit,
                'offset' => ($page - 1) * $limit,
            ])
        );

        return ['data' => $rows, 'total' => $total];
    }

    private static function findNotificationById(Database $database, string $id): ?array
    {
        return $database->one(
            'SELECT
                n.id,
                n.tenant_id,
                n.incident_id,
                n.logistics_order_id,
                ' . self::offerSelect($database, 'n') . ',
                n.notification_channel,
                n.recipient_label,
                n.title,
                n.message,
                n.scheduled_for,
                n.status,
                n.metadata::text AS metadata,
                n.created_at
             FROM public.notifications n
             WHERE n.id = :id
               AND n.deleted_at IS NULL
             LIMIT 1',
            ['id' => $id]
        );
    }

    private static function findPendingNotifications(Database $database, int $limit): array
    {
        return $database->all(
            'SELECT
                n.id,
                n.tenant_id,
                n.incident_id,
                n.logistics_order_id,
                ' . self::offerSelect($database, 'n') . ',
                n.notification_channel,
                n.recipient_label,
                n.title,
                n.message,
                n.scheduled_for,
                n.status,
                n.metadata::text AS metadata,
                n.created_at
             FROM public.notifications n
             WHERE n.deleted_at IS NULL
               AND n.status = :status
               AND n.scheduled_for <= NOW()
             ORDER BY n.scheduled_for ASC
             LIMIT :limit',
            ['status' => 'pending', 'limit' => $limit]
        );
    }

    private static function dispatchNotification(Database $database, string $id): array
    {
        $row = self::findNotificationById($database, $id);
        if ($row === null) {
            throw new RuntimeException('NOTIFICATION_NOT_FOUND');
        }

        $response = self::toNotificationResponse($row);
        if ($response['status'] !== 'pending') {
            throw new RuntimeException('NOTIFICATION_NOT_PENDING');
        }

        if ($response['notificationChannel'] !== 'email') {
            throw new RuntimeException('UNSUPPORTED_NOTIFICATION_CHANNEL');
        }

        $metadata = self::decodeJson($row['metadata'] ?? '{}');
        $metadata['dispatchMode'] = 'simulated';
        $metadata['dispatchedAt'] = gmdate(DATE_ATOM);

        $database->execute(
            'UPDATE public.notifications
             SET status = :status,
                 metadata = CAST(:metadata AS jsonb),
                 updated_at = NOW()
             WHERE id = :id
               AND deleted_at IS NULL',
            [
                'id' => $id,
                'status' => 'sent',
                'metadata' => json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}',
            ]
        );

        return [
            'status' => 'sent',
            'deliveryMode' => 'simulated',
        ];
    }

    private static function toNotificationResponse(array $row): array
    {
        $metadata = self::decodeJson($row['metadata'] ?? '{}');

        return [
            'id' => (string) $row['id'],
            'tenantId' => (string) $row['tenant_id'],
            'incidentId' => $row['incident_id'],
            'logisticsOrderId' => $row['logistics_order_id'],
            'offerId' => $row['offer_id'] ?? ($metadata['offerId'] ?? null),
            'notificationChannel' => (string) $row['notification_channel'],
            'recipientLabel' => (string) $row['recipient_label'],
            'title' => (string) $row['title'],
            'message' => (string) $row['message'],
            'scheduledFor' => self::toIso($row['scheduled_for'] ?? null),
            'status' => (string) $row['status'],
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

    private static function resolveIncidentId(Database $database, string $incidentId, string $tenantId): string
    {
        $row = $database->one(
            'SELECT id
             FROM public.incidents
             WHERE id = :incident_id
               AND tenant_id = :tenant_id
               AND deleted_at IS NULL
             LIMIT 1',
            ['incident_id' => $incidentId, 'tenant_id' => $tenantId]
        );

        if ($row === null || !isset($row['id'])) {
            throw new RuntimeException('INCIDENT_NOT_FOUND_FOR_TENANT');
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

    private static function resolveOfferId(Database $database, string $offerId, string $tenantId): string
    {
        $row = $database->one(
            'SELECT id
             FROM public.offers
             WHERE id = :offer_id
               AND tenant_id = :tenant_id
               AND deleted_at IS NULL
             LIMIT 1',
            ['offer_id' => $offerId, 'tenant_id' => $tenantId]
        );

        if ($row === null || !isset($row['id'])) {
            throw new RuntimeException('OFFER_NOT_FOUND_FOR_TENANT');
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

    private static function requiredDate(array $payload, string $key, string $code, string $message): DateTimeImmutable
    {
        try {
            return new DateTimeImmutable((string) ($payload[$key] ?? ''));
        } catch (Throwable) {
            Response::error(400, $code, $message);
        }
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

    private static function offerSelect(Database $database, string $alias): string
    {
        if ($database->hasColumn('public.notifications', 'offer_id')) {
            return $alias . '.offer_id';
        }

        return 'NULLIF(' . $alias . '.metadata->>\'offerId\', \'\') AS offer_id';
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
}
