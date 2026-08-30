import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  listRequerimientos,
  respondRequerimiento,
  closeRequerimiento,
  escalateRequerimientoToSanction
} from "../services/pae";
import { PageShell, card, inp, btn, btnPrimary, Badge, th, td } from "./pae/paeUi";

export function PaeRequerimientosPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin_municipal";
  const isSupervisor = user?.role === "supervisor_departamental";
  const [rows, setRows] = useState<any[]>([]);
  const [note, setNote] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => listRequerimientos().then((r) => r.ok && setRows(r.data));
  useEffect(() => { load(); }, []);

  const doRespond = async (id: string, status: string) => {
    const responseNotes = note[id]?.trim();
    if (!responseNotes) return setMsg("Escribe la respuesta de la alcaldía.");
    const r = await respondRequerimiento(id, { responseNotes, status });
    setMsg(r.ok ? "Respuesta registrada." : r.message);
    load();
  };

  return (
    <PageShell
      title="Requerimientos a las alcaldías"
      subtitle="Generados por inspecciones no conformes, reportes CAE o el sweep de vencidos"
    >
      {msg && <div style={{ ...card, marginBottom: 12, color: "#93c5fd" }}>{msg}</div>}
      <div style={card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Título</th>
              <th style={th}>Origen</th>
              <th style={th}>Sev.</th>
              <th style={th}>Estado</th>
              <th style={th}>Nivel</th>
              <th style={th}>Vence</th>
              <th style={th}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ ...td, maxWidth: 280 }}>{r.title}</td>
                <td style={td}>{r.sourceType}</td>
                <td style={td}><Badge value={r.severity} /></td>
                <td style={td}><Badge value={r.status} /></td>
                <td style={td}>{r.escalationLevel}</td>
                <td style={td}>{String(r.dueDate).slice(0, 10)}</td>
                <td style={td}>
                  {isAdmin && !["subsanado", "archivado"].includes(r.status) && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
                      <input
                        style={{ ...inp, fontSize: 12 }}
                        placeholder="Respuesta de la alcaldía…"
                        value={note[r.id] ?? ""}
                        onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))}
                      />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={{ ...btn, fontSize: 11 }} onClick={() => doRespond(r.id, "en_respuesta")}>Responder</button>
                        <button style={{ ...btnPrimary, fontSize: 11 }} onClick={() => doRespond(r.id, "subsanado")}>Subsanar</button>
                      </div>
                    </div>
                  )}
                  {isSupervisor && r.status === "incumplido" && (
                    <button
                      style={{ ...btn, fontSize: 11 }}
                      onClick={async () => { await escalateRequerimientoToSanction(r.id); load(); }}
                    >
                      Exigir sanción
                    </button>
                  )}
                  {isSupervisor && ["subsanado", "en_respuesta"].includes(r.status) && (
                    <button style={{ ...btn, fontSize: 11 }} onClick={async () => { await closeRequerimiento(r.id); load(); }}>
                      Archivar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td style={td} colSpan={7}>Sin requerimientos.</td></tr>}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
