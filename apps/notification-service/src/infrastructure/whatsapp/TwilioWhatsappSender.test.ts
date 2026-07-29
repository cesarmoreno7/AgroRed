import { TwilioWhatsappSender } from "./TwilioWhatsappSender.js";
import { Notification } from "../../domain/entities/Notification.js";

function buildNotification(): Notification {
  return new Notification({
    id: "n-wa-1",
    tenantId: "t-1",
    incidentId: "inc-1",
    logisticsOrderId: null,
    offerId: null,
    notificationChannel: "whatsapp",
    recipientLabel: "+573001234567",
    title: "Alerta de incidencia",
    message: "Incidencia crítica detectada en Rionegro.",
    scheduledFor: new Date("2026-07-01T08:00:00Z"),
    status: "pending"
  });
}

describe("TwilioWhatsappSender (Bug #10)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("reports a clear failure instead of throwing when Twilio credentials are not configured", async () => {
    const sender = new TwilioWhatsappSender({ accountSid: "", authToken: "", whatsappFrom: "" });

    const result = await sender.send(buildNotification());

    expect(result.success).toBe(false);
    expect(result.errorMessage).toMatch(/not configured/i);
  });

  it("addresses the message with the whatsapp: prefix on both from and to", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 201 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const sender = new TwilioWhatsappSender({
      accountSid: "AC123",
      authToken: "secret",
      whatsappFrom: "+14155238886"
    });

    const result = await sender.send(buildNotification());

    expect(result.success).toBe(true);
    const [, options] = fetchMock.mock.calls[0];
    expect(options.body.get("From")).toBe("whatsapp:+14155238886");
    expect(options.body.get("To")).toBe("whatsapp:+573001234567");
  });

  it("reports failure when Twilio responds with a non-2xx status", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Authentication error"
    }) as unknown as typeof fetch;

    const sender = new TwilioWhatsappSender({
      accountSid: "AC123",
      authToken: "bad-token",
      whatsappFrom: "+14155238886"
    });

    const result = await sender.send(buildNotification());

    expect(result.success).toBe(false);
    expect(result.errorMessage).toMatch(/401/);
  });
});
