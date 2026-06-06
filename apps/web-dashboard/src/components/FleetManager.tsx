import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { api } from "../services/api";
import type { Resource } from "../types";

interface Props {
  tenantId?: string;
}

type FormMode = "list" | "create" | "edit";

const STATUS_COLOR: Record<string, string> = {
  disponible: "#60a5fa",
  en_ruta: "#4ade80",
  mantenimiento: "#f59e0b",
  inactivo: "#6b7280",
};

const STATUS_LABEL: Record<string, string> = {
  disponible: "Disponible",
  en_ruta: "En ruta",
  mantenimiento: "Mantenimiento",
  inactivo: "Inactivo",
};

const TYPE_LABEL: Record<string, string> = {
  vehiculo: "Vehículo terrestre",
  domiciliario: "Domiciliario",
  bicicleta: "Bicicleta",
  moto: "Moto",
  otro: "Otro",
};

const INPUT_STYLE: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 14,
  outline: "none",
};

const LABEL_STYLE: CSSProperties = {
  display: "block",
  marginBottom: 6,
  color: "rgba(255,255,255,0.68)",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const BUTTON_BASE: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  padding: "8px 12px",
  color: "#fff",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
  transition: "transform 0.15s, background 0.15s, border-color 0.15s",
};

function formatDate(value?: string | null): string {
  if (!value) return "Sin registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin registro";
  return date.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ value }: { value: string }) {
  const color = STATUS_COLOR[value] ?? "#6b7280";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "5px 9px",
        borderRadius: 999,
        background: `${color}18`,
        color,
        border: `1px solid ${color}3f`,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
      {STATUS_LABEL[value] ?? value}
    </span>
  );
}

export function FleetManager({ tenantId }: Props) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("list");
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("vehiculo");
  const [placa, setPlaca] = useState("");
  const [telefono, setTelefono] = useState("");
  const [estado, setEstado] = useState("disponible");

  const stats = useMemo(() => ({
    total: resources.length,
    enRuta: resources.filter((r) => r.estado === "en_ruta").length,
    disponibles: resources.filter((r) => r.estado === "disponible").length,
  }), [resources]);

  const filtered = useMemo(() => {
    let list = resources;
    if (statusFilter !== "all") list = list.filter(r => r.estado === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.nombre.toLowerCase().includes(q) ||
        (r.placa ?? "").toLowerCase().includes(q) ||
        (r.telefono ?? "").includes(q)
      );
    }
    return list;
  }, [resources, search, statusFilter]);

  const loadResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api<Resource[]>("/api/v1/logistics/resources", {
      params: tenantId ? { limit: 100, tenantId } : { limit: 100 },
    });

    if (res.ok) {
      setResources(Array.isArray(res.data) ? res.data : []);
    } else {
      setError(`[${res.status ?? 0}] ${res.message || "No se pudieron cargar los recursos."}`);
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { loadResources(); }, [loadResources]);

  const resetForm = () => {
    setNombre(""); setTipo("vehiculo"); setPlaca(""); setTelefono(""); setEstado("disponible");
    setSelectedResource(null);
  };

  const openCreate = () => { resetForm(); setFormMode("create"); };

  const openEdit = (resource: Resource) => {
    setSelectedResource(resource);
    setNombre(resource.nombre);
    setTipo(resource.tipo);
    setPlaca(resource.placa ?? "");
    setTelefono(resource.telefono ?? "");
    setEstado(resource.estado);
    setFormMode("edit");
  };

  const closeForm = () => { resetForm(); setFormMode("list"); };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      nombre: nombre.trim(),
      tipo,
      placa: placa.trim() || null,
      telefono: telefono.trim() || null,
      estado,
    };

    const res = formMode === "create"
      ? await api<Resource>("/api/v1/logistics/resources/register", {
          method: "POST",
          body: { tenantId, ...payload },
        })
      : selectedResource
        ? await api<Resource>(`/api/v1/logistics/resources/${selectedResource.id}`, {
            method: "PATCH",
            body: payload,
          })
        : { ok: false as const, status: 0, code: "NO_RESOURCE", message: "No hay recurso seleccionado." };

    setSaving(false);

    if (!res.ok) {
      setError(`[${res.status ?? 0}] ${res.message || "No se pudo guardar el recurso."}`);
      return;
    }

    closeForm();
    await loadResources();
  };

  const handleDelete = async (resource: Resource) => {
    if (!window.confirm(`¿Eliminar el recurso "${resource.nombre}"? Esta acción no se puede deshacer.`)) return;
    const res = await api(`/api/v1/logistics/resources/${resource.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError(`[${res.status ?? 0}] ${res.message || "No se pudo eliminar el recurso."}`);
      return;
    }
    await loadResources();
  };

  return (
    <section
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        width: "100%",
        marginTop: 4,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "18px 22px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: "#fff" }}>
            {formMode === "list"
              ? "Recursos registrados"
              : formMode === "create"
                ? "Nuevo recurso"
                : `Editar — ${selectedResource?.nombre ?? "recurso"}`}
          </h2>
          <p style={{ margin: "5px 0 0", fontSize: 12, color: "rgba(255,255,255,0.43)" }}>
            {formMode === "list"
              ? `${stats.total} en base de datos · ${stats.enRuta} en ruta · ${stats.disponibles} disponibles`
              : "Los cambios se guardan directamente en la base de datos."}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {formMode === "list" ? (
            <>
              <button
                type="button"
                onClick={loadResources}
                style={{ ...BUTTON_BASE, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.74)" }}
              >
                ↺ Actualizar
              </button>
              <button
                type="button"
                onClick={openCreate}
                style={{ ...BUTTON_BASE, background: "linear-gradient(135deg,#4ade80,#16a34a)", borderColor: "transparent", color: "#07110b" }}
              >
                + Nuevo recurso
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={closeForm}
              style={{ ...BUTTON_BASE, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.74)" }}
            >
              ← Volver a la tabla
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            margin: "16px 22px 0",
            padding: "11px 14px",
            background: "rgba(248,113,113,0.11)",
            border: "1px solid rgba(248,113,113,0.24)",
            borderRadius: 10,
            color: "#fca5a5",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={loadResources}
            style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 6, color: "#fca5a5", fontSize: 12, fontWeight: 700, padding: "4px 10px", cursor: "pointer" }}
          >
            Reintentar
          </button>
        </div>
      )}

      <div style={{ padding: 22 }}>
        {formMode !== "list" ? (
          /* ── Formulario de creación / edición ── */
          <form className="fleet-manager-form" onSubmit={handleSave} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, maxWidth: 760 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={LABEL_STYLE}>Nombre del recurso</label>
              <input required minLength={2} value={nombre} onChange={e => setNombre(e.target.value)} style={INPUT_STYLE} placeholder="Ej: Camión refrigerado norte" />
            </div>
            <div>
              <label style={LABEL_STYLE}>Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} style={INPUT_STYLE}>
                {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL_STYLE}>Estado</label>
              <select value={estado} onChange={e => setEstado(e.target.value)} style={INPUT_STYLE}>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL_STYLE}>Placa / identificador</label>
              <input value={placa} onChange={e => setPlaca(e.target.value)} style={INPUT_STYLE} placeholder="Ej: ABC-123" />
            </div>
            <div>
              <label style={LABEL_STYLE}>Teléfono conductor</label>
              <input value={telefono} onChange={e => setTelefono(e.target.value)} style={INPUT_STYLE} placeholder="Ej: 3001234567" />
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  ...BUTTON_BASE,
                  background: saving ? "rgba(74,222,128,0.35)" : "linear-gradient(135deg,#4ade80,#16a34a)",
                  borderColor: "transparent",
                  color: "#07110b",
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Guardando…" : formMode === "create" ? "Guardar recurso" : "Actualizar recurso"}
              </button>
              <button type="button" onClick={closeForm} style={{ ...BUTTON_BASE, background: "transparent", color: "rgba(255,255,255,0.68)" }}>
                Cancelar
              </button>
            </div>
          </form>
        ) : loading ? (
          /* ── Estado de carga ── */
          <div style={{ padding: "44px 12px", textAlign: "center", color: "rgba(255,255,255,0.38)", fontSize: 14 }}>
            <div style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,0.06)", borderTop: "3px solid #4ade80", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 14px" }} />
            Cargando recursos desde la base de datos…
          </div>
        ) : (
          <>
            {/* ── Filtros de búsqueda ── */}
            {resources.length > 0 && (
              <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por nombre o placa…"
                  style={{
                    ...INPUT_STYLE,
                    width: "auto",
                    flex: "1 1 220px",
                    padding: "8px 12px",
                    fontSize: 13,
                  }}
                />
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  style={{ ...INPUT_STYLE, width: "auto", flex: "0 0 160px", padding: "8px 12px", fontSize: 13 }}
                >
                  <option value="all">Todos los estados</option>
                  {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            )}

            {/* ── Tabla o estado vacío ── */}
            {resources.length === 0 ? (
              <div style={{ padding: "44px 12px", textAlign: "center", color: "rgba(255,255,255,0.42)", fontSize: 14 }}>
                No hay recursos registrados en la base de datos.
                {tenantId && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.26)" }}>
                    Filtro activo: tenant <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 4 }}>{tenantId}</code>
                  </div>
                )}
                <div style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={openCreate}
                    style={{ ...BUTTON_BASE, background: "rgba(74,222,128,0.13)", color: "#4ade80", borderColor: "rgba(74,222,128,0.32)" }}
                  >
                    Crear el primer recurso
                  </button>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "32px 12px", textAlign: "center", color: "rgba(255,255,255,0.38)", fontSize: 14 }}>
                Sin resultados para la búsqueda actual.
                <button type="button" onClick={() => { setSearch(""); setStatusFilter("all"); }} style={{ display: "block", margin: "10px auto 0", background: "none", border: "none", color: "#60a5fa", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <div style={{ overflowX: "auto", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
                <table style={{ width: "100%", minWidth: 860, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.035)" }}>
                      {["Recurso", "Tipo", "Estado", "Contacto", "Coordenadas", "Actualizado", "Acciones"].map(h => (
                        <th key={h} style={{ padding: "12px 14px", textAlign: h === "Acciones" ? "right" : "left", color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(resource => (
                      <tr key={resource.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
                        <td style={{ padding: "13px 14px", verticalAlign: "middle" }}>
                          <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{resource.nombre}</div>
                          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 3 }}>{resource.placa || "Sin placa"}</div>
                        </td>
                        <td style={{ padding: "13px 14px", color: "rgba(255,255,255,0.68)", fontSize: 13 }}>{TYPE_LABEL[resource.tipo] ?? resource.tipo}</td>
                        <td style={{ padding: "13px 14px" }}><StatusBadge value={resource.estado} /></td>
                        <td style={{ padding: "13px 14px", color: "rgba(255,255,255,0.58)", fontSize: 13 }}>{resource.telefono || "Sin teléfono"}</td>
                        <td style={{ padding: "13px 14px", color: "rgba(255,255,255,0.48)", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                          {resource.latitude != null && resource.longitude != null
                            ? `${resource.latitude.toFixed(5)}, ${resource.longitude.toFixed(5)}`
                            : "Sin GPS"}
                        </td>
                        <td style={{ padding: "13px 14px", color: "rgba(255,255,255,0.48)", fontSize: 12 }}>{formatDate(resource.updatedAt)}</td>
                        <td style={{ padding: "13px 14px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 8 }}>
                            <button type="button" onClick={() => openEdit(resource)} style={{ ...BUTTON_BASE, padding: "7px 10px", background: "rgba(96,165,250,0.1)", borderColor: "rgba(96,165,250,0.28)", color: "#93c5fd" }}>Editar</button>
                            <button type="button" onClick={() => handleDelete(resource)} style={{ ...BUTTON_BASE, padding: "7px 10px", background: "rgba(248,113,113,0.09)", borderColor: "rgba(248,113,113,0.24)", color: "#fca5a5" }}>Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length < resources.length && (
                  <div style={{ padding: "8px 14px", fontSize: 11, color: "rgba(255,255,255,0.3)", borderTop: "1px solid rgba(255,255,255,0.05)", textAlign: "right" }}>
                    Mostrando {filtered.length} de {resources.length} recursos
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <style>{`
        @media (max-width: 720px) { .fleet-manager-form { grid-template-columns: 1fr !important; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </section>
  );
}
