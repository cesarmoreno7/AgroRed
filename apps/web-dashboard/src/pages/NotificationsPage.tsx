import { useEffect, useState, useMemo } from "react";
import { fetchNotifications, registerNotification, updateNotification } from "../services/notifications";
import { useAuth } from "../hooks/useAuth";

const CHANNELS = [{ value: "email", label: "Email", icon: "📧" }, { value: "sms", label: "SMS", icon: "💬" }, { value: "whatsapp", label: "WhatsApp", icon: "📱" }, { value: "in_app", label: "In-App", icon: "🔔" }];
const CHANNEL_COLOR: Record<string, string> = { email: "#60a5fa", sms: "#4ade80", whatsapp: "#22d3ee", in_app: "#f472b6" };
const STATUS_COLOR: Record<string, [string, string]> = { pending: ["#f59e0b","Pendiente"], sent: ["#4ade80","Enviada"], failed: ["#f87171","Fallida"], read: ["#94a3b8","Leída"] };

const inp: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" };
const empty = { notificationChannel: "in_app", recipientLabel: "", title: "", message: "", scheduledFor: "", incidentId: "", logisticsOrderId: "", offerId: "" };

const EditBtn = ({ active, onClick }: { active: boolean; onClick: () => void }) => (
  <button onClick={onClick} style={{ background: active ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)", color: active ? "#f59e0b" : "rgba(255,255,255,0.5)", border: `1px solid ${active ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✏️ Editar</button>
);

export function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ notificationChannel: "in_app", recipientLabel: "", title: "", message: "", scheduledFor: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => { fetchNotifications().then(r => { if (r.ok) setNotifications(r.data); }); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return notifications.filter(n => n.title?.toLowerCase().includes(q) || n.recipientLabel?.toLowerCase().includes(q) || n.message?.toLowerCase().includes(q) || n.notificationChannel?.toLowerCase().includes(q));
  }, [notifications, search]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setE = (k: string, v: string) => setEditForm(f => ({ ...f, [k]: v }));

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    setEditForm({ notificationChannel: record.notificationChannel || "in_app", recipientLabel: record.recipientLabel || "", title: record.title || "", message: record.message || "", scheduledFor: record.scheduledFor?.slice(0,10) || "" });
    setEditError(null); setShowForm(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingId) return;
    setEditLoading(true); setEditError(null);
    const res = await updateNotification(editingId, editForm);
    setEditLoading(false);
    if (res.ok) { setNotifications(u => u.map(x => x.id === editingId ? res.data : x)); setEditingId(null); }
    else setEditError((res as any).message);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.incidentId && !form.logisticsOrderId && !form.offerId) { setError("Debe asociar al menos una incidencia, oferta u orden."); return; }
    setLoading(true); setError(null);
    const res = await registerNotification({ ...form, tenantId: user?.tenantId ?? "", incidentId: form.incidentId || undefined, logisticsOrderId: form.logisticsOrderId || undefined, offerId: form.offerId || undefined });
    setLoading(false);
    if (res.ok) { setNotifications(u => [res.data, ...u]); setForm({ ...empty }); setShowForm(false); }
    else setError((res as any).message);
  };

  return (
    <div style={{ color: "#fff", maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#f472b6,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Centro de Notificaciones</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{notifications.length} notificaciones · {notifications.filter(n => n.status === "pending").length} pendientes</p>
        </div>
        <button onClick={() => { setShowForm(v => !v); setEditingId(null); }} style={{ background: showForm ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#f472b6,#a78bfa)", color: showForm ? "rgba(255,255,255,0.6)" : "#fff", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
          {showForm ? "✕ Cancelar" : "+ Nueva notificación"}
        </button>
      </div>

      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: 0.4 }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título, destinatario, mensaje o canal…" style={{ ...inp, paddingLeft: 42, fontSize: 14, borderRadius: 12 }} />
      </div>

      {showForm && (
        <div style={{ background: "rgba(244,114,182,0.04)", border: "1px solid rgba(244,114,182,0.15)", borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "#f472b6" }}>Nueva notificación</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label style={lbl}>Canal *</label><select style={inp} value={form.notificationChannel} onChange={e => set("notificationChannel", e.target.value)}>{CHANNELS.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}</select></div>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Destinatario *</label><input style={inp} value={form.recipientLabel} onChange={e => set("recipientLabel", e.target.value)} required /></div>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Título *</label><input style={inp} value={form.title} onChange={e => set("title", e.target.value)} required /></div>
              <div><label style={lbl}>Fecha programada *</label><input style={inp} type="date" value={form.scheduledFor} onChange={e => set("scheduledFor", e.target.value)} required /></div>
              <div style={{ gridColumn: "span 3" }}><label style={lbl}>Mensaje *</label><input style={inp} value={form.message} onChange={e => set("message", e.target.value)} required /></div>
              <div><label style={lbl}>ID Incidencia</label><input style={inp} value={form.incidentId} onChange={e => set("incidentId", e.target.value)} /></div>
              <div><label style={lbl}>ID Logística</label><input style={inp} value={form.logisticsOrderId} onChange={e => set("logisticsOrderId", e.target.value)} /></div>
              <div><label style={lbl}>ID Oferta</label><input style={inp} value={form.offerId} onChange={e => set("offerId", e.target.value)} /></div>
            </div>
            {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ background: "linear-gradient(135deg,#f472b6,#a78bfa)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>{loading ? "Guardando…" : "Enviar notificación"}</button>
          </form>
        </div>
      )}

      {editingId && (
        <div style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f59e0b" }}>✏️ Editando notificación</h3>
            <button onClick={() => setEditingId(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          <form onSubmit={handleUpdate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label style={lbl}>Canal</label><select style={inp} value={editForm.notificationChannel} onChange={e => setE("notificationChannel", e.target.value)}>{CHANNELS.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}</select></div>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Destinatario</label><input style={inp} value={editForm.recipientLabel} onChange={e => setE("recipientLabel", e.target.value)} /></div>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Título</label><input style={inp} value={editForm.title} onChange={e => setE("title", e.target.value)} /></div>
              <div><label style={lbl}>Fecha programada</label><input style={inp} type="date" value={editForm.scheduledFor} onChange={e => setE("scheduledFor", e.target.value)} /></div>
              <div style={{ gridColumn: "span 3" }}><label style={lbl}>Mensaje</label><input style={inp} value={editForm.message} onChange={e => setE("message", e.target.value)} /></div>
            </div>
            {editError && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{editError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={editLoading} style={{ background: "linear-gradient(135deg,#f472b6,#a78bfa)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>{editLoading ? "Guardando…" : "Guardar cambios"}</button>
              <button type="button" onClick={() => setEditingId(null)} style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 20px", cursor: "pointer", fontSize: 14 }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {["Notificación", "Destinatario", "Canal", "Fecha", "Estado", "Acciones"].map(h => (
                <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((n, i) => {
              const [sc, sl] = STATUS_COLOR[n.status] ?? ["#94a3b8", n.status];
              const ch = CHANNELS.find(c => c.value === n.notificationChannel);
              const cc = CHANNEL_COLOR[n.notificationChannel] ?? "#94a3b8";
              return (
                <tr key={n.id || i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: editingId === n.id ? "rgba(245,158,11,0.04)" : "transparent", transition: "background 0.15s" }}
                  onMouseEnter={e => { if (editingId !== n.id) e.currentTarget.style.background = "rgba(244,114,182,0.04)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = editingId === n.id ? "rgba(245,158,11,0.04)" : "transparent"; }}>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#fff" }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.message}</div>
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{n.recipientLabel}</td>
                  <td style={{ padding: "13px 16px" }}><span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: `${cc}18`, color: cc, display: "flex", alignItems: "center", gap: 4, width: "fit-content" }}>{ch?.icon} {ch?.label ?? n.notificationChannel}</span></td>
                  <td style={{ padding: "13px 16px", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{n.scheduledFor?.slice?.(0,10)}</td>
                  <td style={{ padding: "13px 16px" }}><span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${sc}18`, color: sc, border: `1px solid ${sc}33` }}>{sl}</span></td>
                  <td style={{ padding: "13px 16px" }}><EditBtn active={editingId === n.id} onClick={() => handleEdit(n)} /></td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>{search ? `Sin resultados para "${search}"` : "No hay notificaciones."}</td></tr>}
          </tbody>
        </table>
      </div>

      {/* ── Guía de integración con plataformas externas ── */}
      <div style={{ background: "rgba(244,114,182,0.04)", border: "1px solid rgba(244,114,182,0.12)", borderRadius: 16, padding: 24 }}>
        <h2 style={{ margin: "0 0 18px", fontSize: 17, fontWeight: 700, color: "#f472b6", display: "flex", alignItems: "center", gap: 8 }}>
          🔗 Integración con plataformas externas
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
          AgroRed puede enviar notificaciones a sistemas externos mediante el endpoint de notificaciones. Configura el canal deseado y conecta tu herramienta favorita.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            { icon: "📧", title: "Email / SMTP", color: "#60a5fa", channel: "email",
              desc: "Envío directo por SMTP. Configura SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS en las variables de entorno del notification-service.",
              example: `POST /api/v1/notifications/register\n{\n  "notificationChannel": "email",\n  "recipientLabel": "admin@municipio.gov.co",\n  "title": "Alerta de inventario",\n  "message": "Stock crítico en Bodega Norte",\n  "scheduledFor": "2026-06-01T08:00:00Z",\n  "offerId": "<uuid>"\n}` },
            { icon: "💬", title: "SMS / Twilio", color: "#4ade80", channel: "sms",
              desc: "Integra Twilio o cualquier proveedor SMS en el notification-service. Agrega TWILIO_SID y TWILIO_TOKEN al entorno.",
              example: `POST /api/v1/notifications/register\n{\n  "notificationChannel": "sms",\n  "recipientLabel": "+573001234567",\n  "title": "Alerta AgroRed",\n  "message": "Rescate programado para mañana 8am",\n  "scheduledFor": "2026-06-01T07:00:00Z",\n  "incidentId": "<uuid>"\n}` },
            { icon: "📱", title: "WhatsApp / Meta", color: "#22d3ee", channel: "whatsapp",
              desc: "Usa la API de WhatsApp Business (Meta) o Twilio WhatsApp. Configura WHATSAPP_TOKEN y WHATSAPP_PHONE_ID en el entorno.",
              example: `POST /api/v1/notifications/register\n{\n  "notificationChannel": "whatsapp",\n  "recipientLabel": "3001234567",\n  "title": "Subasta activa",\n  "message": "Papa criolla - cierra en 2h - oferta desde $1.800/kg",\n  "scheduledFor": "2026-06-01T10:00:00Z",\n  "offerId": "<uuid>"\n}` },
            { icon: "🔔", title: "In-App / WebSocket", color: "#f472b6", channel: "in_app",
              desc: "Notificaciones en tiempo real dentro del dashboard. El sistema publica eventos en Redis que el frontend consume vía WebSocket o polling.",
              example: `POST /api/v1/notifications/register\n{\n  "notificationChannel": "in_app",\n  "recipientLabel": "admin@agrored.co",\n  "title": "Nuevo productor registrado",\n  "message": "Finca El Paraíso se unió a Bogotá D.C.",\n  "scheduledFor": "2026-06-01T09:00:00Z",\n  "logisticsOrderId": "<uuid>"\n}` },
          ].map(card => (
            <div key={card.channel} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${card.color}22`, borderRadius: 12, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 22 }}>{card.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{card.title}</div>
                  <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${card.color}18`, color: card.color }}>{card.channel}</span>
                </div>
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 12 }}>{card.desc}</p>
              <pre style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "10px 12px", fontSize: 10, color: "#a5b4fc", overflowX: "auto", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {card.example}
              </pre>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, padding: "14px 18px", background: "rgba(255,255,255,0.03)", borderRadius: 10, fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>
          <strong style={{ color: "rgba(255,255,255,0.7)" }}>Reglas del sistema:</strong>{" "}
          Toda notificación debe referenciar al menos un recurso: <code style={{ color: "#f472b6" }}>incidentId</code>, <code style={{ color: "#f472b6" }}>logisticsOrderId</code> u <code style={{ color: "#f472b6" }}>offerId</code>.
          El campo <code style={{ color: "#f472b6" }}>scheduledFor</code> define cuándo el notification-service intenta el envío.
          El campo <code style={{ color: "#f472b6" }}>recipientLabel</code> puede ser email, número de teléfono o nombre de usuario según el canal.
        </div>
      </div>
    </div>
  );
}
