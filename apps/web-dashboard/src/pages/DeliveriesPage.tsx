import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  fetchEntregas, fetchEntrega, createEntrega, updateEntrega, deleteEntrega,
} from "../services/deliveries";
import type { EntregaRecord, DetalleEntrega, EstadoEntrega } from "../services/deliveries";
import { fetchProducers } from "../services/producers";
import type { ProducerRecord } from "../services/producers";
import { fetchInstitutions } from "../services/institutions";
import { api } from "../services/api";

// ── Constantes ────────────────────────────────────────────────
const ESTADOS: { value: EstadoEntrega; label: string; color: string }[] = [
  { value: "pendiente",  label: "Pendiente",  color: "#f59e0b" },
  { value: "recibido",   label: "Recibido",   color: "#4ade80" },
  { value: "parcial",    label: "Parcial",    color: "#60a5fa" },
  { value: "rechazado",  label: "Rechazado",  color: "#f87171" },
];

const ESTADO_MAP: Record<string, { label: string; color: string }> = Object.fromEntries(
  ESTADOS.map(e => [e.value, { label: e.label, color: e.color }])
);

const UNIDADES = ["kg", "g", "ton", "lb", "litro", "ml", "und", "caja", "bulto", "arroba"];

// ── Estilos compartidos ───────────────────────────────────────
const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 14, padding: "20px 24px",
};
const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8, color: "#fff", fontSize: 13,
  outline: "none", boxSizing: "border-box",
};
const lbl: React.CSSProperties = {
  display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)",
  marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em",
};
const btn = (bg: string, color = "#fff"): React.CSSProperties => ({
  padding: "8px 18px", borderRadius: 8, border: "none",
  background: bg, color, fontSize: 13, fontWeight: 600,
  cursor: "pointer", transition: "opacity 0.15s",
});

type View = "list" | "form" | "detail";

interface ProductCatalogItem {
  id: string;
  name: string;
  category: string;
  unit: string;
}

const EMPTY_DETAIL: DetalleEntrega = {
  productoId: "", cantidadEntregada: 0, unidadMedida: "kg",
  precioUnitario: null, lote: null, fechaVencimiento: null, observacion: null,
};

function emptyForm() {
  return {
    productorId: "", institucionId: "", fechaEntrega: new Date().toISOString().slice(0, 10),
    horaEntrega: "", lugarEntrega: "", recibirPor: "",
    documentoSoporte: "", observaciones: "", estado: "pendiente" as EstadoEntrega,
    detalle: [{ ...EMPTY_DETAIL }],
  };
}

export function DeliveriesPage() {
  const { user } = useAuth();

  // ── Datos maestros ────────────────────────────────────────
  const [producers, setProducers]     = useState<ProducerRecord[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [products, setProducts]       = useState<ProductCatalogItem[]>([]);

  // ── Estado listado ─────────────────────────────────────────
  const [entregas, setEntregas]   = useState<EntregaRecord[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError]   = useState<string | null>(null);

  // Filtros
  const [fProductor, setFProductor]     = useState("");
  const [fInstitucion, setFInstitucion] = useState("");
  const [fEstado, setFEstado]           = useState("");
  const [fDesde, setFDesde]             = useState("");
  const [fHasta, setFHasta]             = useState("");

  // ── Vista activa ──────────────────────────────────────────
  const [view, setView]         = useState<View>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailRecord, setDetailRecord] = useState<EntregaRecord | null>(null);

  // ── Formulario ────────────────────────────────────────────
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Eliminar ──────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Carga de datos maestros ───────────────────────────────
  useEffect(() => {
    fetchProducers(500).then(r => { if (r.ok) setProducers(r.data as ProducerRecord[]); });
    fetchInstitutions().then(r => { if (r.ok) setInstitutions(r.data as any[]); });
    api<ProductCatalogItem[]>("/api/v1/products", { params: { limit: 200 } }).then(r => {
      if (r.ok) setProducts(r.data);
    });
  }, []);

  // ── Carga de listado ──────────────────────────────────────
  const loadList = useCallback(async (page = 1) => {
    setLoadingList(true);
    setListError(null);
    const r = await fetchEntregas({
      productor_id:   fProductor   || undefined,
      institucion_id: fInstitucion || undefined,
      estado:         fEstado      || undefined,
      fecha_desde:    fDesde       || undefined,
      fecha_hasta:    fHasta       || undefined,
      page,
      limit: 20,
    });
    setLoadingList(false);
    if (r.ok) {
      setEntregas(r.data.data);
      setCurrentPage(r.data.meta.page);
      setTotalPages(r.data.meta.totalPages);
      setTotalItems(r.data.meta.total);
    } else {
      setListError(r.message);
    }
  }, [fProductor, fInstitucion, fEstado, fDesde, fHasta]);

  useEffect(() => { if (view === "list") loadList(1); }, [view, loadList]);

  // ── Abrir formulario nuevo ────────────────────────────────
  const handleNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setView("form");
  };

  // ── Abrir formulario editar ───────────────────────────────
  const handleEdit = async (id: string) => {
    const r = await fetchEntrega(id);
    if (!r.ok) return;
    const e = r.data;
    setEditingId(id);
    setForm({
      productorId:     e.productor_id,
      institucionId:   e.institucion_id,
      fechaEntrega:    e.fecha_entrega.slice(0, 10),
      horaEntrega:     e.hora_entrega ?? "",
      lugarEntrega:    e.lugar_entrega ?? "",
      recibirPor:      e.recibido_por ?? "",
      documentoSoporte: e.documento_soporte ?? "",
      observaciones:   e.observaciones ?? "",
      estado:          e.estado,
      detalle: (e.detalle ?? []).map(d => ({
        productoId:        d.productoId ?? (d as any).producto_id ?? "",
        cantidadEntregada: Number(d.cantidadEntregada ?? (d as any).cantidad_entregada ?? 0),
        unidadMedida:      d.unidadMedida ?? (d as any).unidad_medida ?? "kg",
        precioUnitario:    d.precioUnitario ?? (d as any).precio_unitario ?? null,
        lote:              d.lote ?? null,
        fechaVencimiento:  d.fechaVencimiento ?? (d as any).fecha_vencimiento ?? null,
        observacion:       d.observacion ?? null,
      })),
    });
    setFormError(null);
    setView("form");
  };

  // ── Ver detalle ───────────────────────────────────────────
  const handleView = async (id: string) => {
    const r = await fetchEntrega(id);
    if (r.ok) { setDetailRecord(r.data); setView("detail"); }
  };

  // ── Guardar ───────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.productorId)  { setFormError("Selecciona un productor."); return; }
    if (!form.institucionId){ setFormError("Selecciona una institución."); return; }
    if (!form.fechaEntrega) { setFormError("La fecha de entrega es requerida."); return; }
    if (form.detalle.length === 0 || form.detalle.some(d => !d.productoId || d.cantidadEntregada <= 0)) {
      setFormError("Cada línea debe tener producto y cantidad mayor a 0."); return;
    }

    setSaving(true);
    const payload = {
      productorId:      form.productorId,
      institucionId:    form.institucionId,
      fechaEntrega:     form.fechaEntrega,
      horaEntrega:      form.horaEntrega      || null,
      lugarEntrega:     form.lugarEntrega     || null,
      recibirPor:       form.recibirPor       || null,
      documentoSoporte: form.documentoSoporte || null,
      observaciones:    form.observaciones    || null,
      estado:           form.estado,
      creadoPor:        user?.id ?? null,
      detalle:          form.detalle.map(d => ({
        ...d,
        precioUnitario:  d.precioUnitario   ? Number(d.precioUnitario) : null,
        lote:            d.lote             || null,
        fechaVencimiento:d.fechaVencimiento || null,
        observacion:     d.observacion      || null,
      })),
    };

    const r = editingId
      ? await updateEntrega(editingId, payload)
      : await createEntrega(payload);
    setSaving(false);
    if (r.ok) {
      setView("list");
    } else {
      setFormError(r.message);
    }
  };

  // ── Eliminar ──────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar esta entrega?")) return;
    setDeletingId(id);
    const r = await deleteEntrega(id);
    setDeletingId(null);
    if (r.ok || r.status === 204) loadList(currentPage);
  };

  // ── Detalle dinámico ──────────────────────────────────────
  const setDetail = (idx: number, field: keyof DetalleEntrega, value: unknown) => {
    setForm(f => {
      const det = f.detalle.map((d, i) => {
        if (i !== idx) return d;
        const updated = { ...d, [field]: value };
        if (field === "productoId") {
          const prod = products.find(p => p.id === String(value));
          if (prod) updated.unidadMedida = prod.unit;
        }
        return updated;
      });
      return { ...f, detalle: det };
    });
  };
  const addLine  = () => setForm(f => ({ ...f, detalle: [...f.detalle, { ...EMPTY_DETAIL }] }));
  const removeLine = (idx: number) => setForm(f => ({ ...f, detalle: f.detalle.filter((_, i) => i !== idx) }));

  // ── Total estimado ────────────────────────────────────────
  const totalEstimado = useMemo(() =>
    form.detalle.reduce((acc, d) =>
      acc + (d.cantidadEntregada || 0) * (Number(d.precioUnitario) || 0), 0),
    [form.detalle]);

  // ── Render ────────────────────────────────────────────────
  if (view === "detail" && detailRecord) {
    return <DetailView
      entrega={detailRecord}
      onBack={() => setView("list")}
      onEdit={() => handleEdit(detailRecord.id)}
    />;
  }

  if (view === "form") {
    return (
      <FormView
        form={form} setForm={setForm} setDetail={setDetail}
        addLine={addLine} removeLine={removeLine}
        producers={producers} institutions={institutions} products={products}
        saving={saving} formError={formError} editingId={editingId}
        totalEstimado={totalEstimado}
        onSubmit={handleSave}
        onCancel={() => setView("list")}
      />
    );
  }

  // ── VISTA LISTADO ─────────────────────────────────────────
  return (
    <div style={{ color: "#fff" }}>
      {/* Breadcrumb + acción */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>
            Inicio / Entregas de Productos
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Entregas de Productos</h1>
        </div>
        <button style={btn("linear-gradient(135deg,#4ade80,#22d3ee)", "#0a0a12")} onClick={handleNew}>
          + Nueva Entrega
        </button>
      </div>

      {/* Filtros */}
      <div style={{ ...card, marginBottom: 20, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))" }}>
        <div>
          <label style={lbl}>Productor</label>
          <select style={inp} value={fProductor} onChange={e => setFProductor(e.target.value)}>
            <option value="">Todos</option>
            {producers.map(p => (
              <option key={p.id} value={p.id}>{p.organizationName}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>Institución</label>
          <select style={inp} value={fInstitucion} onChange={e => setFInstitucion(e.target.value)}>
            <option value="">Todas</option>
            {institutions.map((i: any) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>Estado</label>
          <select style={inp} value={fEstado} onChange={e => setFEstado(e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Desde</label>
          <input type="date" style={inp} value={fDesde} onChange={e => setFDesde(e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Hasta</label>
          <input type="date" style={inp} value={fHasta} onChange={e => setFHasta(e.target.value)} />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button style={{ ...btn("#4ade80", "#0a0a12"), width: "100%" }} onClick={() => loadList(1)}>
            Filtrar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["N° Entrega","Fecha","Productor","Institución","Items","Valor Total","Estado","Acciones"].map(h => (
                  <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600,
                    color: "rgba(255,255,255,0.5)", fontSize: 11, textTransform: "uppercase",
                    letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingList && (
                <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>
                  Cargando...
                </td></tr>
              )}
              {!loadingList && listError && (
                <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#f87171" }}>
                  {listError}
                </td></tr>
              )}
              {!loadingList && !listError && entregas.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>
                  No hay entregas registradas con los filtros actuales.
                </td></tr>
              )}
              {entregas.map(e => {
                const est = ESTADO_MAP[e.estado] ?? { label: e.estado, color: "#6b7280" };
                return (
                  <tr key={e.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "#4ade80" }}>
                      {e.numero_entrega}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {new Date(e.fecha_entrega).toLocaleDateString("es-CO")}
                    </td>
                    <td style={{ padding: "12px 16px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.productor_nombre ?? "—"}
                    </td>
                    <td style={{ padding: "12px 16px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.institucion_nombre ?? "—"}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      {e.total_items ?? 0}
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace" }}>
                      {Number(e.valor_total ?? 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: est.color + "22", color: est.color, border: `1px solid ${est.color}44`,
                      }}>{est.label}</span>
                    </td>
                    <td style={{ padding: "12px 16px", display: "flex", gap: 8 }}>
                      <ActionBtn title="Ver" color="#60a5fa" onClick={() => handleView(e.id)}>👁</ActionBtn>
                      <ActionBtn title="Editar" color="#f59e0b" onClick={() => handleEdit(e.id)}>✏️</ActionBtn>
                      <ActionBtn title="Eliminar" color="#f87171"
                        onClick={() => handleDelete(e.id)}
                        disabled={deletingId === e.id}>🗑</ActionBtn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
              {totalItems} entrega{totalItems !== 1 ? "s" : ""}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                style={{ ...btn(currentPage <= 1 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)"), padding: "6px 14px", fontSize: 12 }}
                disabled={currentPage <= 1}
                onClick={() => loadList(currentPage - 1)}
              >← Ant</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((p, idx, arr) => (
                  <span key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <span style={{ padding: "6px 4px", color: "rgba(255,255,255,0.3)" }}>…</span>
                    )}
                    <button
                      style={{ ...btn(p === currentPage ? "#4ade80" : "rgba(255,255,255,0.08)", p === currentPage ? "#0a0a12" : "#fff"), padding: "6px 12px", fontSize: 12 }}
                      onClick={() => loadList(p)}
                    >{p}</button>
                  </span>
                ))}
              <button
                style={{ ...btn(currentPage >= totalPages ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)"), padding: "6px 14px", fontSize: 12 }}
                disabled={currentPage >= totalPages}
                onClick={() => loadList(currentPage + 1)}
              >Sig →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Componente: botón de acción pequeño ───────────────────────
function ActionBtn({ title, color, onClick, disabled, children }: {
  title: string; color: string; onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: color + "18", border: `1px solid ${color}33`,
        color, borderRadius: 6, padding: "4px 9px", fontSize: 13,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
      }}
    >{children}</button>
  );
}

// ── Componente: formulario maestro-detalle ────────────────────
function FormView({
  form, setForm, setDetail, addLine, removeLine,
  producers, institutions, products,
  saving, formError, editingId, totalEstimado,
  onSubmit, onCancel,
}: {
  form: ReturnType<typeof emptyForm>;
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyForm>>>;
  setDetail: (idx: number, field: keyof DetalleEntrega, value: unknown) => void;
  addLine: () => void;
  removeLine: (idx: number) => void;
  producers: ProducerRecord[];
  institutions: any[];
  products: { id: string; name: string; unit: string }[];
  saving: boolean;
  formError: string | null;
  editingId: string | null;
  totalEstimado: number;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  const set = (k: keyof typeof form, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ color: "#fff" }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>
        Inicio / <span style={{ color: "#4ade80", cursor: "pointer" }} onClick={onCancel}>Entregas</span>
        {" / "}{editingId ? "Editar" : "Nueva Entrega"}
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>
        {editingId ? "Editar Entrega" : "Registrar Nueva Entrega"}
      </h1>

      <form onSubmit={onSubmit}>
        {/* ── Cabecera ────────────────────────────────────────── */}
        <div style={{ ...card, marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 13, color: "rgba(255,255,255,0.5)",
            textTransform: "uppercase", letterSpacing: "0.08em" }}>Cabecera</h3>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))" }}>
            <div>
              <label style={lbl}>Productor *</label>
              <select style={inp} value={form.productorId} onChange={e => set("productorId", e.target.value)} required>
                <option value="">Selecciona...</option>
                {producers.map(p => (
                  <option key={p.id} value={p.id}>{p.organizationName}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Institución *</label>
              <select style={inp} value={form.institucionId} onChange={e => set("institucionId", e.target.value)} required>
                <option value="">Selecciona...</option>
                {institutions.map((i: any) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Fecha de Entrega *</label>
              <input type="date" style={inp} value={form.fechaEntrega} onChange={e => set("fechaEntrega", e.target.value)} required />
            </div>
            <div>
              <label style={lbl}>Hora</label>
              <input type="time" style={inp} value={form.horaEntrega} onChange={e => set("horaEntrega", e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Lugar de Entrega</label>
              <input type="text" style={inp} maxLength={200} placeholder="Bodega, dirección..." value={form.lugarEntrega} onChange={e => set("lugarEntrega", e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Recibido por</label>
              <input type="text" style={inp} maxLength={150} placeholder="Nombre del funcionario" value={form.recibirPor} onChange={e => set("recibirPor", e.target.value)} />
            </div>
            <div>
              <label style={lbl}>N° Documento Soporte</label>
              <input type="text" style={inp} maxLength={200} placeholder="Remisión, guía..." value={form.documentoSoporte} onChange={e => set("documentoSoporte", e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Estado *</label>
              <select style={inp} value={form.estado} onChange={e => set("estado", e.target.value as EstadoEntrega)}>
                {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={lbl}>Observaciones</label>
              <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }}
                value={form.observaciones}
                onChange={e => set("observaciones", e.target.value)} />
            </div>
          </div>
        </div>

        {/* ── Detalle ──────────────────────────────────────────── */}
        <div style={{ ...card, marginBottom: 16, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <h3 style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.5)",
              textTransform: "uppercase", letterSpacing: "0.08em" }}>Detalle de Productos</h3>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {["Producto *","Cantidad *","Unidad *","Precio Unit.","Lote","Vence","Observación",""].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600,
                      color: "rgba(255,255,255,0.4)", fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.detalle.map((d, idx) => (
                  <tr key={idx} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "8px 10px", minWidth: 180 }}>
                      <select style={{ ...inp, padding: "7px 10px" }}
                        value={d.productoId}
                        onChange={e => setDetail(idx, "productoId", e.target.value)}
                        required>
                        <option value="">Selecciona...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: "8px 10px", minWidth: 100 }}>
                      <input type="number" min={0.001} step={0.001} style={{ ...inp, padding: "7px 10px" }}
                        value={d.cantidadEntregada || ""}
                        onChange={e => setDetail(idx, "cantidadEntregada", parseFloat(e.target.value) || 0)}
                        required />
                    </td>
                    <td style={{ padding: "8px 10px", minWidth: 90 }}>
                      <select style={{ ...inp, padding: "7px 10px" }}
                        value={d.unidadMedida}
                        onChange={e => setDetail(idx, "unidadMedida", e.target.value)}>
                        {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "8px 10px", minWidth: 110 }}>
                      <input type="number" min={0} step={0.01} style={{ ...inp, padding: "7px 10px" }}
                        value={d.precioUnitario ?? ""}
                        onChange={e => setDetail(idx, "precioUnitario", e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="0.00" />
                    </td>
                    <td style={{ padding: "8px 10px", minWidth: 100 }}>
                      <input type="text" maxLength={50} style={{ ...inp, padding: "7px 10px" }}
                        value={d.lote ?? ""}
                        onChange={e => setDetail(idx, "lote", e.target.value || null)}
                        placeholder="Lote" />
                    </td>
                    <td style={{ padding: "8px 10px", minWidth: 120 }}>
                      <input type="date" style={{ ...inp, padding: "7px 10px" }}
                        value={d.fechaVencimiento ?? ""}
                        onChange={e => setDetail(idx, "fechaVencimiento", e.target.value || null)} />
                    </td>
                    <td style={{ padding: "8px 10px", minWidth: 130 }}>
                      <input type="text" style={{ ...inp, padding: "7px 10px" }}
                        value={d.observacion ?? ""}
                        onChange={e => setDetail(idx, "observacion", e.target.value || null)}
                        placeholder="Nota..." />
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      {form.detalle.length > 1 && (
                        <button type="button" onClick={() => removeLine(idx)}
                          style={{ background: "#f8717118", border: "1px solid #f8717133",
                            color: "#f87171", borderRadius: 6, padding: "4px 9px",
                            cursor: "pointer", fontSize: 13 }}>🗑</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button type="button" onClick={addLine}
              style={{ ...btn("rgba(74,222,128,0.1)", "#4ade80"), border: "1px solid rgba(74,222,128,0.3)" }}>
              + Agregar línea
            </button>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              Total estimado: <span style={{ color: "#4ade80" }}>
                {totalEstimado.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}
              </span>
            </span>
          </div>
        </div>

        {/* Error */}
        {formError && (
          <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)",
            color: "#f87171", padding: "10px 16px", borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
            {formError}
          </div>
        )}

        {/* Botones footer */}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button type="button" style={btn("rgba(255,255,255,0.07)")} onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            style={{ ...btn("linear-gradient(135deg,#4ade80,#22d3ee)", "#0a0a12"), opacity: saving ? 0.7 : 1 }}>
            {saving ? "Guardando..." : "💾 Guardar Entrega"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Componente: vista de detalle ──────────────────────────────
function DetailView({ entrega, onBack, onEdit }: {
  entrega: EntregaRecord; onBack: () => void; onEdit: () => void;
}) {
  const est = ESTADO_MAP[entrega.estado] ?? { label: entrega.estado, color: "#6b7280" };

  const valorTotal = (entrega.detalle ?? []).reduce((acc, d) =>
    acc + (Number((d as any).cantidad_entregada ?? d.cantidadEntregada ?? 0)
         * Number((d as any).precio_unitario ?? d.precioUnitario ?? 0)), 0);

  return (
    <div style={{ color: "#fff" }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>
        Inicio / <span style={{ color: "#4ade80", cursor: "pointer" }} onClick={onBack}>Entregas</span>
        {" / "}{entrega.numero_entrega}
      </div>

      {/* Cabecera de tarjeta */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, fontFamily: "monospace", color: "#4ade80" }}>
            {entrega.numero_entrega}
          </h1>
          <div style={{ marginTop: 6 }}>
            <span style={{
              padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: est.color + "22", color: est.color, border: `1px solid ${est.color}44`,
            }}>{est.label}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={btn("rgba(255,255,255,0.1)")} onClick={onEdit}>✏️ Editar</button>
          <button style={btn("rgba(255,255,255,0.07)")} onClick={() => window.print()}>🖨️ Imprimir</button>
          <button style={btn("rgba(255,255,255,0.07)")} onClick={onBack}>← Volver</button>
        </div>
      </div>

      {/* Info cabecera */}
      <div style={{ ...card, marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 12, textTransform: "uppercase",
          letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)" }}>Información de la Entrega</h3>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))" }}>
          {[
            ["Productor",         entrega.productor_nombre ?? "—"],
            ["Institución",       entrega.institucion_nombre ?? "—"],
            ["Fecha Entrega",     new Date(entrega.fecha_entrega).toLocaleDateString("es-CO")],
            ["Hora",              entrega.hora_entrega ?? "—"],
            ["Lugar",             entrega.lugar_entrega ?? "—"],
            ["Recibido por",      entrega.recibido_por ?? "—"],
            ["Doc. Soporte",      entrega.documento_soporte ?? "—"],
            ["Registrado",        new Date(entrega.created_at).toLocaleString("es-CO")],
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)",
                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{value}</div>
            </div>
          ))}
          {entrega.observaciones && (
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)",
                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Observaciones</div>
              <div style={{ fontSize: 14 }}>{entrega.observaciones}</div>
            </div>
          )}
        </div>
      </div>

      {/* Tabla de detalle */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 style={{ margin: 0, fontSize: 12, textTransform: "uppercase",
            letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)" }}>Productos Entregados</h3>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                {["Producto","Cantidad","Unidad","Precio Unit.","Lote","Vence","Subtotal","Observación"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600,
                    color: "rgba(255,255,255,0.4)", fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(entrega.detalle ?? []).map((d: any, i) => {
                const cant  = Number(d.cantidad_entregada ?? d.cantidadEntregada ?? 0);
                const price = Number(d.precio_unitario ?? d.precioUnitario ?? 0);
                return (
                  <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "11px 14px" }}>{d.producto_nombre ?? "—"}</td>
                    <td style={{ padding: "11px 14px", fontFamily: "monospace" }}>{cant.toLocaleString("es-CO")}</td>
                    <td style={{ padding: "11px 14px" }}>{d.unidad_medida ?? d.unidadMedida ?? "—"}</td>
                    <td style={{ padding: "11px 14px", fontFamily: "monospace" }}>
                      {price ? price.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }) : "—"}
                    </td>
                    <td style={{ padding: "11px 14px" }}>{d.lote ?? "—"}</td>
                    <td style={{ padding: "11px 14px" }}>
                      {d.fecha_vencimiento ? new Date(d.fecha_vencimiento).toLocaleDateString("es-CO") : "—"}
                    </td>
                    <td style={{ padding: "11px 14px", fontFamily: "monospace", color: "#4ade80" }}>
                      {price ? (cant * price).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }) : "—"}
                    </td>
                    <td style={{ padding: "11px 14px", color: "rgba(255,255,255,0.5)" }}>{d.observacion ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid rgba(255,255,255,0.1)" }}>
                <td colSpan={6} style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700,
                  color: "rgba(255,255,255,0.5)", fontSize: 12 }}>VALOR TOTAL</td>
                <td style={{ padding: "12px 14px", fontFamily: "monospace", fontWeight: 700, color: "#4ade80", fontSize: 15 }}>
                  {valorTotal.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
