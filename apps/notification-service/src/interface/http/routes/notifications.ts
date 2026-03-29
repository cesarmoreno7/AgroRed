import { Router } from "express";
import { z } from "zod";
import { RegisterNotification } from "../../../application/use-cases/RegisterNotification.js";
import { DispatchNotification } from "../../../application/use-cases/DispatchNotification.js";
import type { Notification } from "../../../domain/entities/Notification.js";
import type { NotificationRepository } from "../../../domain/ports/NotificationRepository.js";
import type { NotificationSender } from "../../../domain/ports/NotificationSender.js";
import { NOTIFICATION_CHANNELS } from "../../../domain/value-objects/NotificationChannel.js";
import { asyncHandler, sendError, sendPaginatedSuccess, sendSuccess } from "../response.js";

const registerNotificationSchema = z.object({
  tenantId: z.string().min(1),
  incidentId: z.string().uuid().optional().nullable(),
  logisticsOrderId: z.string().uuid().optional().nullable(),
  offerId: z.string().uuid().optional().nullable(),
  notificationChannel: z.enum(NOTIFICATION_CHANNELS),
  recipientLabel: z.string().min(3),
  title: z.string().min(3),
  message: z.string().min(10),
  scheduledFor: z.coerce.date()
});

function toNotificationResponse(notification: Notification) {
  return {
    id: notification.id,
    tenantId: notification.tenantId,
    incidentId: notification.incidentId,
    logisticsOrderId: notification.logisticsOrderId,
    offerId: notification.offerId,
    notificationChannel: notification.notificationChannel,
    recipientLabel: notification.recipientLabel,
    title: notification.title,
    message: notification.message,
    scheduledFor: notification.scheduledFor.toISOString(),
    status: notification.status,
    createdAt: notification.createdAt.toISOString()
  };
}

export function createNotificationsRouter(
  repository: NotificationRepository,
  sender: NotificationSender
): Router {
  const router = Router();
  const registerNotification = new RegisterNotification(repository);
  const dispatchNotification = new DispatchNotification(repository, sender);

  router.post("/api/v1/notifications/register", asyncHandler(async (req, res) => {
    const parsed = registerNotificationSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendError(res, 400, "INVALID_NOTIFICATION_PAYLOAD", "Payload invalido para registro de notificacion.");
    }

    try {
      const notification = await registerNotification.execute(parsed.data);
      return sendSuccess(res, toNotificationResponse(notification), 201);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }

      if (error instanceof Error && error.message === "INCIDENT_NOT_FOUND_FOR_TENANT") {
        return sendError(res, 404, "INCIDENT_NOT_FOUND_FOR_TENANT", "La incidencia asociada no existe para el municipio indicado.");
      }

      if (error instanceof Error && error.message === "LOGISTICS_ORDER_NOT_FOUND_FOR_TENANT") {
        return sendError(res, 404, "LOGISTICS_ORDER_NOT_FOUND_FOR_TENANT", "La operacion logistica asociada no existe para el municipio indicado.");
      }

      if (error instanceof Error && error.message === "INVALID_NOTIFICATION_REFERENCE") {
        return sendError(res, 400, "INVALID_NOTIFICATION_REFERENCE", "La notificacion debe referenciar al menos una incidencia o una operacion logistica.");
      }

      if (error instanceof Error && error.message === "INVALID_NOTIFICATION_SCHEDULE") {
        return sendError(res, 400, "INVALID_NOTIFICATION_SCHEDULE", "La fecha programada de notificacion no es valida.");
      }

      return sendError(res, 500, "NOTIFICATION_REGISTRATION_FAILED", "No fue posible registrar la notificacion operativa.");
    }
  }));

  router.get("/api/v1/notifications", asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    const result = await repository.list({ page, limit }, tenantId ?? null);
    return sendPaginatedSuccess(res, result.data.map(toNotificationResponse), { total: result.total, page: result.page, limit: result.limit });
  }));

  router.get("/api/v1/notifications/:id", asyncHandler(async (req, res) => {
    const notification = await repository.findById(String(req.params.id));

    if (!notification) {
      return sendError(res, 404, "NOTIFICATION_NOT_FOUND", "Notificacion no encontrada.");
    }

    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    if (tenantId && notification.tenantId !== tenantId) {
      return sendError(res, 404, "NOTIFICATION_NOT_FOUND", "Notificacion no encontrada.");
    }

    return sendSuccess(res, toNotificationResponse(notification));
  }));

  router.post("/api/v1/notifications/:id/dispatch", asyncHandler(async (req, res) => {
    try {
      const result = await dispatchNotification.execute(String(req.params.id));
      return sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error && error.message === "NOTIFICATION_NOT_FOUND") {
        return sendError(res, 404, "NOTIFICATION_NOT_FOUND", "Notificacion no encontrada.");
      }
      if (error instanceof Error && error.message === "NOTIFICATION_NOT_PENDING") {
        return sendError(res, 409, "NOTIFICATION_NOT_PENDING", "La notificacion ya fue enviada o no esta pendiente.");
      }
      if (error instanceof Error && error.message === "UNSUPPORTED_NOTIFICATION_CHANNEL") {
        return sendError(res, 400, "UNSUPPORTED_NOTIFICATION_CHANNEL", "El canal de notificacion no esta soportado para envio.");
      }
      return sendError(res, 500, "DISPATCH_FAILED", "No fue posible enviar la notificacion.");
    }
  }));

  router.post("/api/v1/notifications/dispatch-pending", asyncHandler(async (_req, res) => {
    const pending = await repository.findPending(50);
    const results = [];

    for (const notification of pending) {
      if (notification.notificationChannel !== "email") continue;

      try {
        const result = await dispatchNotification.execute(notification.id);
        results.push({ id: notification.id, ...result });
      } catch {
        results.push({ id: notification.id, status: "failed", errorMessage: "Dispatch error" });
      }
    }

    return sendSuccess(res, { processed: results.length, results });
  }));

  return router;
}