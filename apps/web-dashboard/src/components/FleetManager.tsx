// Fleet Manager — CRUD completo: Crear, Editar, Eliminar recursos de flota
import { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";
import type { Resource } from "../types";

interface Props {
  tenantId?: string;
}

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  color: "rgba(255,255,255,0.7)",
  fontSize: 13,
  fontWeight: 600,
};

const STATUS_COLOR: Record<string, string> = {
  en_ruta: "#4ade80",
  disponible: "#60a5fa",
  mantenimiento: "#f59e0b",
  inactivo: "#6b7280",
};

export function FleetManager({ tenantId }: Props) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formMode, setFormMode] = useState<"list" | "create" | "edit">("list");
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Form fields ──
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("vehiculo");
  const [placa, setPlaca] = useState("");
  const [telefono, setTelefono] = useState("");
  const [estado, setEstado] = useState("disponible");

  const loadResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    const url = `/api/v1/logistics/resources?limit=100${tenantId ? `&tenantId=${tenantId}` : ""}`;
    const res = await api<{ data: Resource[] }>(url);
    if (res.ok) {
      const list = res.data?.data ?? (Array.isArray(res.data) ? (res.data as unknown as Resource[]) : []);
      setResources(list);
    } else {
      setError("No se pudieron cargar los recursos. Verifica tu conexión.");
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  // ── Handlers ──
  const openCreate = () => {
    setNombre(""); setTipo("vehiculo"); setPlaca(""); setTelefono(""); setEstado("disponible");
    setSelectedResource(null);
    setFormMode("create");
  };

  const openEdit = (r: Resource) => {
    setSelectedResource(r);
    setNombre(r.nombre);
    setTipo(r.tipo);
    setPlaca(r.placa ?? "");
    setTelefono(r.telefono ?? "");
    setEstado(r.estado);
    setFormMode("edit");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    let ok = false;
    if (formMode === "create") {
      const res = await api("/api/v1/logistics/resources/register", {
        method: "POST",
        body: { tenantId, nombre, tipo, placa: placa || null, telefono: telefono || null, estado },
      });
      if (!res.ok) setError("No se pudo crear el recurso.");
      else ok = true;
    } else if (formMode === "edit" && selectedResource) {
      const res = await api(`/api/v1/logistics/resources/${selectedResource.id}`, {
        method: "PATCH",
        body: { nombre, tipo, placa: placa || null, telefono: telefono || null, estado },
      });
      if (!res.ok) setError("No se pudo actualizar el recurso.");
      else ok = true;
    }
    setSaving(false);
    if (ok) {
      setFormMode("list");
      loadResources();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`¿Eliminar el recurso "${name}"? Esta acción no se puede deshacer.`)) return;
    const res = await api(`/api/v1/logistics/resources/${id}`, { method: "DELETE" });
    if (!res.ok) { alert("No se pudo eliminar el recurso."); return; }
    loadResources();
  };

  // ─────────────────── RENDER ───────────────────
  return (
    <div style={{
      background: "linear-gradient(135deg,rgba(17,24,39,0.95),rgba(10,15,28,0.98))",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 20,
      width: "100%",
      display: "flex",
      flexDirection: "column",
      marginTop: 24,
      boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: "20px 28px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>⚙️</span>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff" }}>
              {formMode === "list" ? "Administrar Flota" : formMode === "create" ? "Agregar Recurso" : `Editando: ${selectedResource?.nombre}`}
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
              {formMode === "list" ? `${resources.length} recurso(s) registrado(s) en la base de datos` : "Completa los campos y guarda"}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {formMode !== "list" && (
            <button
              onClick={() => setFormMode("list")}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 14px", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
            >
              ← Volver
            </button>
          )}
          {formMode === "list" && (
            <button
              onClick={openCreate}
              style={{ background: "linear-gradient(135deg,#a78bfa,#7c3aed)", border: "none", borderRadius: 10, padding: "9px 18px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, boxShadow: "0 4px 14px rgba(124,58,237,0.4)" }}
            >
              <span style={{ fontSize: 16 }}>+</span> Nuevo Recurso
            </button>
          )}
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div style={{ margin: "16px 28px 0", padding: "12px 16px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 10, color: "#f87171", fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Content ── */}
      <div style={{ padding: 28 }}>

        {/* LIST VIEW */}
        {formMode === "list" && (
          <>
            {loading ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.3)" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                Cargando recursos de la base de datos...
              </div>
            ) : resources.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.3)" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🚗</div>
                No hay recursos registrados aún.
                <br />
                <button onClick={openCreate} style={{ marginTop: 16, background: "#a78bfa", color: "#000", border: "none", padding: "10px 20px", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>Agregar el primero</button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {resources.map(r => (
                  <div key={r.id} style={{
                    display: "flex",
                    flexDirection: "column",
                    padding: 18,
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 14,
                    transition: "border-color 0.2s",
                  }}>
                    {/* Card header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#fff", flex: 1 }}>{r.nombre}</div>
                      <span style={{
                        fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
                        padding: "3px 9px", borderRadius: 20,
                        background: `${STATUS_COLOR[r.estado] ?? "#6b7280"}22`,
                        color: STATUS_COLOR[r.estado] ?? "#6b7280",
                        border: `1px solid ${STATUS_COLOR[r.estado] ?? "#6b7280"}44`,
                        textTransform: "uppercase", whiteSpace: "nowrap", marginLeft: 8,
                      }}>
                        {r.estado.replace("_", " ")}
                      </span>
                    </div>

                    {/* Card details */}
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
                      <span>🚛 {r.tipo.charAt(0).toUpperCase() + r.tipo.slice(1)}</span>
                      {r.placa && <span>🪪 Placa: <strong style={{ color: "rgba(255,255,255,0.65)" }}>{r.placa}</strong></span>}
                      {r.telefono && <span>📱 {r.telefono}</span>}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                      <button
                        onClick={() => openEdit(r)}
                        style={{
                          flex: 1,
                          padding: "8px 0",
                          background: "rgba(96,165,250,0.1)",
                          border: "1px solid rgba(96,165,250,0.25)",
                          borderRadius: 8,
                          color: "#60a5fa",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 5,
                        }}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => handleDelete(r.id, r.nombre)}
                        style={{
                          flex: 1,
                          padding: "8px 0",
                          background: "rgba(248,113,113,0.08)",
                          border: "1px solid rgba(248,113,113,0.2)",
                          borderRadius: 8,
                          color: "#f87171",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 5,
                        }}
                      >
                        🗑️ Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* CREATE / EDIT FORM */}
        {(formMode === "create" || formMode === "edit") && (
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 640 }}>

            <div>
              <label style={LABEL_STYLE}>Nombre del Recurso *</label>
              <input
                required
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                style={INPUT_STYLE}
                placeholder="Ej: Camión Furgón Toyota"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={LABEL_STYLE}>Tipo de Recurso</label>
                <select
                  value={tipo}
                  onChange={e => setTipo(e.target.value)}
                  style={INPUT_STYLE}
                >
                  <option value="vehiculo">🚛 Vehículo Terrestre</option>
                  <option value="domiciliario">🚶 Domiciliario</option>
                  <option value="bicicleta">🚲 Bicicleta</option>
                  <option value="moto">🏍️ Moto</option>
                  <option value="otro">📦 Otro</option>
                </select>
              </div>
              <div>
                <label style={LABEL_STYLE}>Estado</label>
                <select
                  value={estado}
                  onChange={e => setEstado(e.target.value)}
                  style={INPUT_STYLE}
                >
                  <option value="disponible">✅ Disponible</option>
                  <option value="en_ruta">🟢 En Ruta</option>
                  <option value="mantenimiento">🟡 Mantenimiento</option>
                  <option value="inactivo">⚫ Inactivo</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={LABEL_STYLE}>Placa / Identificador</label>
                <input
                  value={placa}
                  onChange={e => setPlaca(e.target.value)}
                  style={INPUT_STYLE}
                  placeholder="Ej: XYZ-123"
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>Teléfono del Conductor</label>
                <input
                  value={telefono}
                  onChange={e => setTelefono(e.target.value)}
                  style={INPUT_STYLE}
                  placeholder="Ej: 3001234567"
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  background: saving ? "rgba(74,222,128,0.4)" : "linear-gradient(135deg,#4ade80,#16a34a)",
                  color: "#000",
                  border: "none",
                  padding: "12px 24px",
                  borderRadius: 10,
                  cursor: saving ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  fontSize: 14,
                  boxShadow: saving ? "none" : "0 4px 14px rgba(74,222,128,0.3)",
                }}
              >
                {saving ? "Guardando…" : formMode === "create" ? "✅ Guardar Recurso" : "✅ Actualizar Recurso"}
              </button>
              <button
                type="button"
                onClick={() => setFormMode("list")}
                style={{ background: "transparent", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.15)", padding: "12px 24px", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 14 }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
