import { useEffect, useState } from "react";
import { getPaeOverview } from "../services/pae";
import { PageShell, card, Badge, th, td } from "./pae/paeUi";

export function PaeOverviewPage() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getPaeOverview().then((r) => (r.ok ? setData(r.data) : setErr(r.message)));
  }, []);

  return (
    <PageShell
      title="Supervisión PAE — Panel"
      subtitle="Interventoría de campo, requerimientos a las alcaldías y control social (CAE)"
    >
      {err && <div style={{ ...card, color: "#f87171" }}>{err}</div>}
      {data && (
        <>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ ...card, minWidth: 200 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>Municipios supervisados</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: "#fff" }}>{data.scope?.length ?? 0}</div>
            </div>
            <div style={{ ...card, minWidth: 200 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>Inspecciones registradas</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: "#fff" }}>{data.inspections?.total ?? 0}</div>
            </div>
          </div>
          <div style={card}>
            <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#fff" }}>Últimas inspecciones</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Fecha</th>
                  <th style={th}>Tipo</th>
                  <th style={th}>Resultado</th>
                  <th style={th}>Municipio</th>
                </tr>
              </thead>
              <tbody>
                {(data.inspections?.recent ?? []).map((i: any) => (
                  <tr key={i.id}>
                    <td style={td}>{String(i.inspectedAt).slice(0, 16).replace("T", " ")}</td>
                    <td style={td}>{i.inspectionKind}</td>
                    <td style={td}><Badge value={i.result} /></td>
                    <td style={td}>{i.tenantId?.slice(0, 8)}</td>
                  </tr>
                ))}
                {(data.inspections?.recent ?? []).length === 0 && (
                  <tr><td style={td} colSpan={4}>Sin inspecciones todavía.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PageShell>
  );
}
