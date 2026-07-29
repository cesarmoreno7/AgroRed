import { TwilioSmsSender } from "./TwilioSmsSender.js";
import { Notification } from "../../domain/entities/Notification.js";

function buildNotification(): Notification {
  return new Notification({
    id: "n-sms-1",
    tenantId: "t-1",
    incidentId: "inc-1",
    logisticsOrderId: null,
    offerId: null,
    notificationChannel: "sms",
    recipientLabel: "+573001234567",
    title: "Alerta de incidencia",
    message: "Incidencia crítica detectada en Rionegro.",
    scheduledFor: new Date("2026-07-01T08:00:00Z"),
    status: "pending"
  });
}

describe("TwilioSmsSender (Bug #10)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("reports a clear failure instead of throwing when Twilio credentials are not configured", async () => {
    const sender = new TwilioSmsSender({ accountSid: "", authToken: "", smsFrom: "" });

    const result = await sender.send(buildNotification());

    expect(result.success).toBe(false);
    expect(result.errorMessage).toMatch(/not configured/i);
  });

  it("calls the Twilio Messages API and reports success on 2xx", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 201 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const sender = new TwilioSmsSender({
      accountSid: "AC123",
      authToken: "secret",
      smsFrom: "+15005550006"
    });

    const result = await sender.send(buildNotification());

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/Accounts/AC123/Messages.json");
    expect(options.method).toBe("POST");
    expect(options.body.get("To")).toBe("+573001234567");
    expect(options.body.get("From")).toBe("+15005550006");
  });

  it("reports failure when Twilio responds with a non-2xx status", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Invalid phone number"
    }) as unknown as typeof fetch;

    const sender = new TwilioSmsSender({
      accountSid: "AC123",
      authToken: "secret",
      smsFrom: "+15005550006"
    });

    const result = await sender.send(buildNotification());

    expect(result.success).toBe(false);
    expect(result.errorMessage).toMatch(/400/);
  });
});
