import { DispatchNotification } from "./DispatchNotification.js";
import { Notification } from "../../domain/entities/Notification.js";
import type { NotificationRepository, PaginationParams, PaginatedResult } from "../../domain/ports/NotificationRepository.js";
import type { NotificationSender, SendResult } from "../../domain/ports/NotificationSender.js";
import type { NotificationStatus } from "../../domain/value-objects/NotificationStatus.js";

class InMemoryNotificationRepository implements NotificationRepository {
  private readonly store = new Map<string, Notification>();

  async save(notification: Notification): Promise<void> {
    this.store.set(notification.id, notification);
  }

  async findById(id: string): Promise<Notification | null> {
    return this.store.get(id) ?? null;
  }

  async list(params: PaginationParams): Promise<PaginatedResult<Notification>> {
    const all = Array.from(this.store.values());
    const start = (params.page - 1) * params.limit;
    return { data: all.slice(start, start + params.limit), total: all.length, page: params.page, limit: params.limit };
  }

  async updateStatus(id: string, status: NotificationStatus): Promise<void> {
    const existing = this.store.get(id);
    if (!existing) return;

    const updated = new Notification({
      id: existing.id,
      tenantId: existing.tenantId,
      incidentId: existing.incidentId,
      logisticsOrderId: existing.logisticsOrderId,
      notificationChannel: existing.notificationChannel,
      recipientLabel: existing.recipientLabel,
      title: existing.title,
      message: existing.message,
      scheduledFor: existing.scheduledFor,
      status,
      createdAt: existing.createdAt
    });
    this.store.set(id, updated);
  }

  async findPending(limit: number): Promise<Notification[]> {
    return Array.from(this.store.values())
      .filter((n) => n.status === "pending")
      .slice(0, limit);
  }
}

class FakeEmailSender implements NotificationSender {
  public sent: Notification[] = [];
  public shouldFail = false;

  async send(notification: Notification): Promise<SendResult> {
    if (this.shouldFail) {
      return { success: false, errorMessage: "SMTP connection refused" };
    }
    this.sent.push(notification);
    return { success: true };
  }
}

function createPendingEmailNotification(overrides: Partial<{ id: string }> = {}): Notification {
  return new Notification({
    id: overrides.id ?? "n-1",
    tenantId: "t-1",
    incidentId: "inc-1",
    logisticsOrderId: null,
    notificationChannel: "email",
    recipientLabel: "admin@agrored.co",
    title: "Alerta de incidencia",
    message: "Se detectó una incidencia en la ruta de distribución hacia Buenaventura.",
    scheduledFor: new Date("2025-07-01T08:00:00Z"),
    status: "pending"
  });
}

describe("DispatchNotification use-case", () => {
  let repository: InMemoryNotificationRepository;
  let sender: FakeEmailSender;
  let useCase: DispatchNotification;

  beforeEach(() => {
    repository = new InMemoryNotificationRepository();
    sender = new FakeEmailSender();
    useCase = new DispatchNotification(repository, sender);
  });

  it("sends a pending email notification and marks it as sent", async () => {
    const notification = createPendingEmailNotification();
    await repository.save(notification);

    const result = await useCase.execute("n-1");

    expect(result.status).toBe("sent");
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].id).toBe("n-1");

    const updated = await repository.findById("n-1");
    expect(updated!.status).toBe("sent");
  });

  it("marks notification as failed when sender fails", async () => {
    const notification = createPendingEmailNotification();
    await repository.save(notification);
    sender.shouldFail = true;

    const result = await useCase.execute("n-1");

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe("SMTP connection refused");

    const updated = await repository.findById("n-1");
    expect(updated!.status).toBe("failed");
  });

  it("throws NOTIFICATION_NOT_FOUND for missing notification", async () => {
    await expect(useCase.execute("missing-id")).rejects.toThrow("NOTIFICATION_NOT_FOUND");
  });

  it("throws NOTIFICATION_NOT_PENDING for already sent notification", async () => {
    const notification = new Notification({
      id: "n-2",
      tenantId: "t-1",
      incidentId: "inc-1",
      logisticsOrderId: null,
      notificationChannel: "email",
      recipientLabel: "admin@agrored.co",
      title: "Ya enviada",
      message: "Esta notificación ya fue procesada previamente.",
      scheduledFor: new Date("2025-07-01T08:00:00Z"),
      status: "sent"
    });
    await repository.save(notification);

    await expect(useCase.execute("n-2")).rejects.toThrow("NOTIFICATION_NOT_PENDING");
  });

  it("throws UNSUPPORTED_NOTIFICATION_CHANNEL for non-email channel", async () => {
    const notification = new Notification({
      id: "n-3",
      tenantId: "t-1",
      incidentId: "inc-1",
      logisticsOrderId: null,
      notificationChannel: "sms",
      recipientLabel: "+573001234567",
      title: "Alerta SMS",
      message: "Incidencia detectada en la cadena logística del municipio.",
      scheduledFor: new Date("2025-07-01T08:00:00Z"),
      status: "pending"
    });
    await repository.save(notification);

    await expect(useCase.execute("n-3")).rejects.toThrow("UNSUPPORTED_NOTIFICATION_CHANNEL");
  });
});
