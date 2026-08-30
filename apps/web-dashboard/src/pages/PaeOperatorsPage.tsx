import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { listOperators, createOperator, listSanctions, proposeSanction, applySanction } from "../services/pae";
import { PageShell, card, inp, lbl, btn, btnPrimary, Badge, th, td } from "./pae/paeUi";

export function PaeOperatorsPage() {
  const { user } = useAuth();
  const isSupervisor = user?.role === "supervisor_departamental";
  const isAdmin = user?.role === "admin_municipal";
  const [operators, setOperators] = useState<any[]>([]);
  const [sanctions, setSanctions] = useState<any[]>([]);
  const [form, setForm] = useState({ legalName: "", nit: "", contractNumber: "" });
  const [sanForm, setSanForm] = useState({ operatorId: "", sanctionType: "multa", amount: "", justification: "" });
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => {
    listOperators().then((r) => r.ok && setOperators(r.data));
    listSanctions().then((r) => r.ok && setSanctions(r.data));
  };
  useEffect(() => { load(); }, []);

  const addOperator = async () => {
    if (!form.legalName) return setMsg("Razón social requerida.");
    const r = await createOperator(form);
    setMsg(r.ok ? "Operador registrado." : r.message);
    setForm({ legalName: "", nit: "", contractNumber: "" });
    load();
  };

  const addSanction = async () => {
    if (!sanForm.operatorId || sanForm.justification.length < 10) return setMsg("Operador y justificación (≥10) requeridos.");
    const r = await proposeSanction({
      operatorId: sanForm.operatorId,
      sanctionType: sanForm.sanctionType,
      amount: sanForm.amount ? Number(sanForm.amount) : undefined,
      justification: sanForm.justification
    });
    setMsg(r.ok ? `Sanción ${r.data.status}.` : r.message);
    setSanForm({ operatorId: "", sanctionType: "multa", amount: "", justification: "" });
    load();
  };

  return (
    <PageShell title="Operadores del PAE y sanciones" subtitle="La Gobernación exige; la alcaldía contratante aplica">
      {msg && <div style={{ ...card, marginBottom: 12, color: "#4ade80" }}>{msg}</div>}

      <div style={{ ...card, marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#fff" }}>Registrar operador</h3>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <div><label style={lbl}>Razón social</label><input style={inp} value={form.legalName} onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))} /></div>
          <div><label style={lbl}>NIT</label><input style={inp} value={form.nit} onChange={(e) => setForm((f) => ({ ...f, nit: e.target.value }))} /></div>
          <div><label style={lbl}>N.º contrato</label><input style={inp} value={form.contractNumber} onChange={(e) => setForm((f) => ({ ...f, contractNumber: e.target.value }))} /></div>
          <button style={btnPrimary} onClick={addOperator}>Agregar</button>
        </div>
      </div>

      <div style={{ ...card, marginBottom: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Razón social</th><th style={th}>NIT</th><th style={th}>Contrato</th><th style={th}>Estado</th></tr></thead>
          <tbody>
            {operators.map((o) => (
              <tr key={o.id}><td style={td}>{o.legalName}</td><td style={td}>{o.nit ?? "—"}</td><td style={td}>{o.contractNumber ?? "—"}</td><td style={td}><Badge value={o.status} /></td></tr>
            ))}
            {operators.length === 0 && <tr><td style={td} colSpan={4}>Sin operadores.</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ ...card, marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#fff" }}>
          {isSupervisor ? "Exigir sanción (la aplica la alcaldía)" : "Proponer sanción"}
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <div>
            <label style={lbl}>Operador</label>
            <select style={inp} value={sanForm.operatorId} onChange={(e) => setSanForm((f) => ({ ...f, operatorId: e.target.value }))}>
              <option value="">—</option>
              {operators.map((o) => <option key={o.id} value={o.id}>{o.legalName}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Tipo</label>
            <select style={inp} value={sanForm.sanctionType} onChange={(e) => setSanForm((f) => ({ ...f, sanctionType: e.target.value }))}>
              <option value="amonestacion">Amonestación</option>
              <option value="multa">Multa</option>
              <option value="caducidad">Caducidad</option>
            </select>
          </div>
          <div><label style={lbl}>Monto (COP)</label><input style={inp} value={sanForm.amount} onChange={(e) => setSanForm((f) => ({ ...f, amount: e.target.value }))} /></div>
          <button style={btnPrimary} onClick={addSanction}>Registrar</button>
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={lbl}>Justificación</label>
          <input style={inp} value={sanForm.justification} onChange={(e) => setSanForm((f) => ({ ...f, justification: e.target.value }))} />
        </div>
      </div>

      <div style={card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Operador</th><th style={th}>Tipo</th><th style={th}>Monto</th><th style={th}>Estado</th><th style={th}></th></tr></thead>
          <tbody>
            {sanctions.map((s) => (
              <tr key={s.id}>
                <td style={td}>{operators.find((o) => o.id === s.operatorId)?.legalName ?? s.operatorId?.slice(0, 8)}</td>
                <td style={td}>{s.sanctionType}</td>
                <td style={td}>{s.amount ? `$${Number(s.amount).toLocaleString("es-CO")}` : "—"}</td>
                <td style={td}><Badge value={s.status} /></td>
                <td style={td}>
                  {isAdmin && ["propuesta", "requerida"].includes(s.status) && (
                    <button style={{ ...btn, fontSize: 11 }} onClick={async () => { await applySanction(s.id); load(); }}>Aplicar</button>
                  )}
                </td>
              </tr>
            ))}
            {sanctions.length === 0 && <tr><td style={td} colSpan={5}>Sin sanciones.</td></tr>}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
