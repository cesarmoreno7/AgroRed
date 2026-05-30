import type { NotificationPort, OfferMatchNotificationParams } from "../../domain/ports/NotificationPort.js";
import { logInfo, logError } from "../../shared/logger.js";

const CIRCUIT_TIMEOUT_MS = 3_000;
const CIRCUIT_MAX_FAILURES = 3;
const CIRCUIT_RESET_MS = 30_000;

// Simple in-process circuit breaker state
let failures = 0;
let openUntil = 0;

export class HttpNotificationAdapter implements NotificationPort {
  constructor(
    private readonly notificationServiceUrl: string,
    private readonly internalApiKey: string = process.env.INTERNAL_API_KEY ?? ""
  ) {}

  async registerOfferMatchNotification(params: OfferMatchNotificationParams): Promise<void> {
    // Circuit breaker: skip call when open
    if (Date.now() < openUntil) {
      logInfo("notification.circuit_open_skip", { offerId: params.offerId });
      return;
    }

    const url = `${this.notificationServiceUrl}/api/v1/notifications/register`;
    const body = JSON.stringify({
      tenantId: params.tenantId,
      offerId: params.offerId,
      notificationChannel: "in_app",
      recipientLabel: params.recipientLabel,
      title: params.title,
      message: params.message,
      scheduledFor: new Date().toISOString()
    });

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), CIRCUIT_TIMEOUT_MS);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-user-id": "system",
      };
      if (this.internalApiKey) headers["x-internal-api-key"] = this.internalApiKey;

      const response = await fetch(url, { method: "POST", headers, body, signal: controller.signal });
      clearTimeout(tid);

      if (!response.ok) {
        const text = await response.text();
        logError("notification.register_failed", { status: response.status, offerId: params.offerId, response: text });
        failures++;
        if (failures >= CIRCUIT_MAX_FAILURES) openUntil = Date.now() + CIRCUIT_RESET_MS;
        return; // Don't throw — notification failure is non-blocking for offer publishing
      }

      failures = 0;
      openUntil = 0;
      logInfo("notification.registered", { offerId: params.offerId, recipientLabel: params.recipientLabel });
    } catch (err) {
      clearTimeout(tid);
      failures++;
      if (failures >= CIRCUIT_MAX_FAILURES) openUntil = Date.now() + CIRCUIT_RESET_MS;
      logError("notification.adapter_error", { offerId: params.offerId, message: err instanceof Error ? err.message : String(err) });
      // Non-blocking: notification errors don't prevent offer creation
    }
  }
}
