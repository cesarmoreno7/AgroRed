import { useState, useEffect } from "react";
import { api } from "../services/api";
import type { Resource } from "../types";

interface Props {
  tenantId?: string;
  onClose: () => void;
}

export function FleetManagerModal({ tenantId, onClose }: Props) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState<"list" | "create" | "edit">("list");
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  // Form states
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("vehiculo");
  const [placa, setPlaca] = useState("");
  const [telefono, setTelefono] = useState("");
  const [estado, setEstado] = useState("disponible");

  const loadResources = async () => {
    setLoading(true);
    const url = `/api/v1/logistics/resources?limit=100${tenantId ? `&tenantId=${tenantId}` : ""}`;
    const res = await api<{ data: Resource[] }>(url);
    if (res.ok) {
      setResources(res.data?.data || (Array.isArray(res.data) ? res.data : []));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadResources();
  }, [tenantId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formMode === "create") {
      await api("/api/v1/logistics/resources/register", {
        method: "POST",
        body: JSON.stringify({ tenantId, nombre, tipo, placa, telefono, estado }),
      });
    } else if (formMode === "edit" && selectedResource) {
      await api(`/api/v1/logistics/resources/${selectedResource.id}`, {
        method: "PATCH",
        body: JSON.stringify({ nombre, tipo, placa, telefono, estado }),
      });
    }
    setFormMode("list");
    loadResources();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar este recurso?")) return;
    await api(`/api/v1/logistics/resources/${id}`, { method: "DELETE" });
    loadResources();
  };

  const openCreate = () => {
    setNombre(""); setTipo("vehiculo"); setPlaca(""); setTelefono(""); setEstado("disponible");
    setFormMode("create");
  };

  const openEdit = (r: Resource) => {
    setSelectedResource(r);
    setNombre(r.nombre); setTipo(r.tipo); setPlaca(r.placa || ""); setTelefono(r.telefono || ""); setEstado(r.estado);
    setFormMode("edit");
  };

  return (
    <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, width: "100%", display: "flex", flexDirection: "column", marginTop: 24 }}>
      
      {/* Header */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#fff" }}>
          {formMode === "list" ? "⚙️ Administrar Flota (CRUD)" : formMode === "create" ? "Nuevo Recurso" : "Editar Recurso"}
        </h2>
        {formMode !== "list" && (
          <button onClick={() => setFormMode("list")} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
            ← Volver a la lista
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: 24 }}>
        {formMode === "list" && (
          <>
            <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between" }}>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Listado completo de vehículos registrados en la base de datos.</p>
              <button onClick={openCreate} style={{ background: "#a78bfa", color: "#000", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                + Nuevo Recurso
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.4)" }}>Cargando recursos...</div>
            ) : resources.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.02)", borderRadius: 12 }}>No hay recursos registrados.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                {resources.map(r => (
                  <div key={r.id} style={{ display: "flex", flexDirection: "column", padding: "16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12 }}>
                    <div style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>{r.nombre}</div>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 4 }}>
                      {r.tipo.toUpperCase()} · Placa: {r.placa || "N/A"}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 2 }}>
                      Estado: <strong style={{ color: r.estado === "en_ruta" ? "#4ade80" : r.estado === "disponible" ? "#60a5fa" : "#f59e0b" }}>{r.estado.replace("_", " ")}</strong>
                    </div>
                    
                    <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                      <button onClick={() => openEdit(r)} style={{ flex: 1, background: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)", padding: "6px 0", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Editar</button>
                      <button onClick={() => handleDelete(r.id)} style={{ flex: 1, background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)", padding: "6px 0", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {(formMode === "create" || formMode === "edit") && (
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 600 }}>
            <div>
              <label style={{ display: "block", marginBottom: 6, color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600 }}>Nombre del Recurso</label>
              <input required value={nombre} onChange={e => setNombre(e.target.value)} style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }} placeholder="Ej: Camión Furgón 1" />
            </div>

            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", marginBottom: 6, color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600 }}>Tipo</label>
                <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }}>
                  <option value="vehiculo">Vehículo Terrestre</option>
                  <option value="domiciliario">Domiciliario</option>
                  <option value="bicicleta">Bicicleta</option>
                  <option value="moto">Moto</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", marginBottom: 6, color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600 }}>Estado</label>
                <select value={estado} onChange={e => setEstado(e.target.value)} style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }}>
                  <option value="disponible">Disponible</option>
                  <option value="en_ruta">En Ruta</option>
                  <option value="mantenimiento">Mantenimiento</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", marginBottom: 6, color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600 }}>Placa / Identificador</label>
                <input value={placa} onChange={e => setPlaca(e.target.value)} style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }} placeholder="Ej: XYZ-123" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", marginBottom: 6, color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600 }}>Teléfono Contacto</label>
                <input value={telefono} onChange={e => setTelefono(e.target.value)} style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }} placeholder="Ej: 3001234567" />
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <button type="submit" style={{ background: "#4ade80", color: "#000", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>{formMode === "create" ? "Guardar Recurso" : "Actualizar Recurso"}</button>
              <button type="button" onClick={() => setFormMode("list")} style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
