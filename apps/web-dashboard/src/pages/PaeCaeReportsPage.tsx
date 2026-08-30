import { useEffect, useState } from "react";
import { listCaeReports, triageCaeReport, createCaeCommittee } from "../services/pae";
import { PageShell, card, inp, lbl, btn, btnPrimary, Badge, th, td } from "./pae/paeUi";

export function PaeCaeReportsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [instId, setInstId] = useState("");
  const [link, setLink] = useState<string | null>(null);

  const load = () => listCaeReports().then((r) => r.ok && setRows(r.data));
  useEffect(() => { load(); }, []);

  const issue = async () => {
    if (!instId) return setMsg("ID de la institución requerido.");
    const r = await createCaeCommittee({ institutionId: instId });
    if (!r.ok) return setMsg(r.message);
    setLink(r.data.publicUrl || `/cae/${r.data.token}`);
    setMsg("Enlace generado. Compártelo con el comité del colegio.");
    setInstId("");
  };

  const triage = async (id: string, status: string) => {
    const r = await triageCaeReport(id, { status });
    setMsg(r.ok ? "Reporte actualizado." : r.message);
    load();
  };

  return (
    <PageShell
      title="Reportes del Comité de Alimentación Escolar (CAE)"
      subtitle="Control social — reportes ciudadanos que entran a la misma cadena de escalamiento"
    >
      {msg && <div style={{ ...card, marginBottom: 12, color: "#93c5fd" }}>{msg}</div>}

      <div style={{ ...card, marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#fff" }}>Emitir enlace de reporte para un colegio</h3>
        <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>ID de la institución educativa</label>
            <input style={inp} value={instId} onChange={(e) => setInstId(e.target.value)} placeholder="UUID de institutions" />
          </div>
          <button style={btnPrimary} onClick={issue}>Generar enlace</button>
        </div>
        {link && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#4ade80", wordBreak: "break-all" }}>
            {link}
          </div>
        )}
      </div>

      <div style={card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Fecha</th>
              <th style={th}>Categoría</th>
              <th style={th}>Descripción</th>
              <th style={th}>Estado</th>
              <th style={th}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={td}>{String(r.createdAt).slice(0, 16).replace("T", " ")}</td>
                <td style={td}><Badge value={r.category} /></td>
                <td style={{ ...td, maxWidth: 340 }}>{r.description}</td>
                <td style={td}><Badge value={r.status} /></td>
                <td style={td}>
                  {r.status !== "descartado" && r.status !== "derivado" && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={{ ...btn, fontSize: 11 }} onClick={() => triage(r.id, "triage")}>Verificar</button>
                      <button style={{ ...btn, fontSize: 11 }} onClick={() => triage(r.id, "descartado")}>Descartar</button>
                    </div>
                  )}
                  {r.requerimientoId && <span style={{ fontSize: 11, color: "#c084fc" }}>→ requerimiento</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td style={td} colSpan={5}>Sin reportes.</td></tr>}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
