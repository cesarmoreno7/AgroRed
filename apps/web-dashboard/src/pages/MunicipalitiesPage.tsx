import { useState, useMemo } from "react";
import { DEPARTMENTS, MUNICIPALITIES, getMunicipalitiesByDepartment } from "../services/locations";

const inp: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" };

export function MunicipalitiesPage() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = deptFilter === "all" ? MUNICIPALITIES : getMunicipalitiesByDepartment(deptFilter);
    if (q) list = list.filter(m => m.name.toLowerCase().includes(q) || m.code.includes(q));
    return list;
  }, [search, deptFilter]);

  const deptName = DEPARTMENTS.find(d => d.code === deptFilter)?.name;

  return (
    <div style={{ color: "#fff", display: "flex", flexDirection: "column", gap: 20 }}>

      <div>
        <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#4ade80,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Municipios de Colombia
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
          {filtered.length} municipios{deptFilter !== "all" ? ` en ${deptName}` : ` de ${MUNICIPALITIES.length} totales`} · Fuente: DANE
        </p>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar municipio por nombre o código…"
          style={{ ...inp, flex: 1, minWidth: 220, borderRadius: 12, fontSize: 14 }}
        />
        <select
          value={deptFilter}
          onChange={e => { setDeptFilter(e.target.value); setSearch(""); }}
          style={{ ...inp, width: "auto", minWidth: 220, borderRadius: 12 }}
        >
          <option value="all">Todos los departamentos</option>
          {DEPARTMENTS.map(d => (
            <option key={d.code} value={d.code}>{d.name}</option>
          ))}
        </select>
      </div>

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["Cód. Municipio", "Municipio", "Departamento", "Cód. Depto."].map(h => (
                  <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((m, i) => {
                const dept = DEPARTMENTS.find(d => d.code === m.departmentCode);
                return (
                  <tr key={m.code + i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 ? "rgba(255,255,255,0.01)" : "transparent" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(74,222,128,0.04)")}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 ? "rgba(255,255,255,0.01)" : "transparent")}>
                    <td style={{ padding: "11px 16px", fontSize: 11, color: "#4ade80", fontFamily: "monospace", fontWeight: 600 }}>{m.code}</td>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: "#fff", fontWeight: 500 }}>{m.name}</td>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{dept?.name ?? m.departmentCode}</td>
                    <td style={{ padding: "11px 16px", fontSize: 11, color: "#60a5fa", fontFamily: "monospace", fontWeight: 600 }}>{m.departmentCode}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>Sin resultados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 200 && (
          <div style={{ padding: "10px 16px", fontSize: 12, color: "rgba(255,255,255,0.3)", borderTop: "1px solid rgba(255,255,255,0.05)", textAlign: "right" }}>
            Mostrando 200 de {filtered.length}. Refina la búsqueda para ver más.
          </div>
        )}
      </div>

      <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
        💡 Este catálogo alimenta los campos de Departamento/Municipio en todos los formularios del sistema. Los municipios están indexados con códigos DANE de 5 dígitos.
      </div>
    </div>
  );
}
