import { InAppNotificationSender } from "./InAppNotificationSender.js";
import { Notification } from "../../domain/entities/Notification.js";

describe("InAppNotificationSender (Bug #10)", () => {
  it("always reports success — delivery is the persisted, queryable notification row itself", async () => {
    const sender = new InAppNotificationSender();
    const notification = new Notification({
      id: "n-inapp-1",
      tenantId: "t-1",
      incidentId: "inc-1",
      logisticsOrderId: null,
      offerId: null,
      notificationChannel: "in_app",
      recipientLabel: "admin_municipal:rionegro",
      title: "Alerta de incidencia",
      message: "Incidencia crítica detectada en Rionegro.",
      scheduledFor: new Date("2026-07-01T08:00:00Z"),
      status: "pending"
    });

    const result = await sender.send(notification);

    expect(result).toEqual({ success: true });
  });
});
