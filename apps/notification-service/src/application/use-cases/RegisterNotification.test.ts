import { RegisterNotification } from "./RegisterNotification.js";
import type { Notification } from "../../domain/entities/Notification.js";
import type { NotificationRepository, PaginationParams, PaginatedResult } from "../../domain/ports/NotificationRepository.js";
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

  async updateStatus(_id: string, _status: NotificationStatus): Promise<void> {}
  async findPending(_limit: number): Promise<Notification[]> { return []; }
}

describe("RegisterNotification use-case", () => {
  let repository: InMemoryNotificationRepository;
  let useCase: RegisterNotification;

  beforeEach(() => {
    repository = new InMemoryNotificationRepository();
    useCase = new RegisterNotification(repository);
  });

  const validCommand = {
    tenantId: "t-1",
    incidentId: "inc-1",
    notificationChannel: "email" as const,
    recipientLabel: "admin@agrored.co",
    title: "Alerta de incidencia",
    message: "Se detectó un retraso en la ruta de distribución Tuluá-Cali.",
    scheduledFor: new Date("2025-07-01T15:00:00Z")
  };

  it("registers a notification successfully", async () => {
    const notification = await useCase.execute(validCommand);

    expect(notification.id).toBeDefined();
    expect(notification.status).toBe("pending");
    expect(notification.notificationChannel).toBe("email");
    expect(notification.title).toBe("Alerta de incidencia");
  });

  it("saves the notification to the repository", async () => {
    const notification = await useCase.execute(validCommand);
    const found = await repository.findById(notification.id);
    expect(found).not.toBeNull();
    expect(found!.recipientLabel).toBe("admin@agrored.co");
  });

  it("works with logisticsOrderId instead of incidentId", async () => {
    const notification = await useCase.execute({
      ...validCommand,
      incidentId: null,
      logisticsOrderId: "lo-1"
    });
    expect(notification.logisticsOrderId).toBe("lo-1");
    expect(notification.incidentId).toBeNull();
  });

  it("throws INVALID_NOTIFICATION_SCHEDULE for invalid date", async () => {
    await expect(
      useCase.execute({ ...validCommand, scheduledFor: new Date("invalid") })
    ).rejects.toThrow("INVALID_NOTIFICATION_SCHEDULE");
  });

  it("throws INVALID_NOTIFICATION_REFERENCE when no incidentId nor logisticsOrderId", async () => {
    await expect(
      useCase.execute({ ...validCommand, incidentId: null, logisticsOrderId: null })
    ).rejects.toThrow("INVALID_NOTIFICATION_REFERENCE");
  });
});
