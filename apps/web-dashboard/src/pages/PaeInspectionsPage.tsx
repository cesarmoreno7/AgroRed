import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { getPaeScope, listInspections, listOperators, createInspection } from "../services/pae";
import { PageShell, card, inp, lbl, btn, btnPrimary, Badge, th, td } from "./pae/paeUi";

const emptyForm = {
  targetTenantId: "",
  operatorId: "",
  inspectionKind: "interventoria_diaria",
  portionWeightG: "",
  portionWeightExpectedG: "",
  temperatureC: "",
  earliestExpiryDate: "",
  hygieneScore: "",
  notes: ""
};

export function PaeInspectionsPage() {
  const { user } = useAuth();
  const isSupervisor = user?.role === "supervisor_departamental";
  const [rows, setRows] = useState<any[]>([]);
  const [scope, setScope] = useState<string[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [selTenant, setSelTenant] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => {
    listInspections(selTenant ? { tenantId: selTenant } : {}).then((r) => r.ok && setRows(r.data));
    listOperators(selTenant || undefined).then((r) => r.ok && setOperators(r.data));
  };

  useEffect(() => {
    if (isSupervisor) getPaeScope().then((r) => r.ok && setScope(r.data.tenantIds));
  }, [isSupervisor]);
  useEffect(() => { load(); }, [selTenant]);

  const submit = async () => {
    setMsg(null);
    const body: any = {
      targetTenantId: form.targetTenantId || selTenant || user?.tenantId,
      inspectionKind: form.inspectionKind,
      notes: form.notes || undefined,
      operatorId: form.operatorId || undefined
    };
    for (const k of ["portionWeightG", "portionWeightExpectedG", "temperatureC", "hygieneScore"] as const) {
      if (form[k] !== "") body[k] = Number(form[k]);
    }
    if (form.earliestExpiryDate) body.earliestExpiryDate = form.earliestExpiryDate;
    const r = await createInspection(body);
    if (!r.ok) return setMsg(r.message);
    setMsg(`Inspección registrada: ${r.data.result}${r.data.requerimiento ? " — requerimiento generado a la alcaldía" : ""}`);
    setShowForm(false);
    setForm({ ...emptyForm });
    load();
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <PageShell
      title="Inspecciones de campo"
      subtitle="Interventoría diaria y auditorías aleatorias — se auto-clasifican contra el checklist"
      actions={
        <>
          {isSupervisor && (
            <select style={{ ...inp, width: 200 }} value={selTenant} onChange={(e) => setSelTenant(e.target.value)}>
              <option value="">Todos los municipios</option>
              {scope.map((t) => <option key={t} value={t}>{t.slice(0, 8)}</option>)}
            </select>
          )}
          <button style={btnPrimary} onClick={() => setShowForm((s) => !s)}>+ Nueva inspección</button>
        </>
      }
    >
      {msg && <div style={{ ...card, marginBottom: 12, color: "#4ade80" }}>{msg}</div>}
      {showForm && (
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {isSupervisor && (
              <div>
                <label style={lbl}>Municipio</label>
                <select style={inp} value={form.targetTenantId} onChange={(e) => set("targetTenantId", e.target.value)}>
                  <option value="">{selTenant ? selTenant.slice(0, 8) : "Selecciona"}</option>
                  {scope.map((t) => <option key={t} value={t}>{t.slice(0, 8)}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={lbl}>Operador</label>
              <select style={inp} value={form.operatorId} onChange={(e) => set("operatorId", e.target.value)}>
                <option value="">—</option>
                {operators.map((o) => <option key={o.id} value={o.id}>{o.legalName}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Tipo</label>
              <select style={inp} value={form.inspectionKind} onChange={(e) => set("inspectionKind", e.target.value)}>
                <option value="interventoria_diaria">Interventoría diaria</option>
                <option value="auditoria_aleatoria">Auditoría aleatoria</option>
              </select>
            </div>
            <div><label style={lbl}>Gramaje servido (g)</label><input style={inp} value={form.portionWeightG} onChange={(e) => set("portionWeightG", e.target.value)} /></div>
            <div><label style={lbl}>Gramaje esperado (g)</label><input style={inp} value={form.portionWeightExpectedG} onChange={(e) => set("portionWeightExpectedG", e.target.value)} /></div>
            <div><label style={lbl}>Temperatura frío (°C)</label><input style={inp} value={form.temperatureC} onChange={(e) => set("temperatureC", e.target.value)} /></div>
            <div><label style={lbl}>Vencimiento más próximo</label><input style={inp} type="date" value={form.earliestExpiryDate} onChange={(e) => set("earliestExpiryDate", e.target.value)} /></div>
            <div><label style={lbl}>Puntaje higiene (0-100)</label><input style={inp} value={form.hygieneScore} onChange={(e) => set("hygieneScore", e.target.value)} /></div>
            <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Observaciones</label><input style={inp} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button style={btnPrimary} onClick={submit}>Registrar</button>
            <button style={btn} onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}
      <div style={card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Fecha</th>
              <th style={th}>Tipo</th>
              <th style={th}>Resultado</th>
              <th style={th}>Hallazgos</th>
              <th style={th}>Municipio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <td style={td}>{String(i.inspectedAt).slice(0, 16).replace("T", " ")}</td>
                <td style={td}>{i.inspectionKind}</td>
                <td style={td}><Badge value={i.result} /></td>
                <td style={td}>{(i.failedItems ?? []).map((f: any) => f.category).join(", ") || "—"}</td>
                <td style={td}>{i.tenantId?.slice(0, 8)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td style={td} colSpan={5}>Sin inspecciones.</td></tr>}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
