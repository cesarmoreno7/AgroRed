import { useState, useMemo } from "react";
import { DEPARTMENTS, getMunicipalitiesByDepartment } from "../services/locations";

const inp: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" };

export function DepartmentsPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return DEPARTMENTS.filter(d => d.name.toLowerCase().includes(q) || d.code.includes(q));
  }, [search]);

  const municipalities = useMemo(() =>
    selected ? getMunicipalitiesByDepartment(selected) : [],
    [selected]
  );

  const selectedDept = DEPARTMENTS.find(d => d.code === selected);

  return (
    <div style={{ color: "#fff", display: "flex", flexDirection: "column", gap: 20 }}>

      <div>
        <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#60a5fa,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Departamentos de Colombia
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
          {DEPARTMENTS.length} departamentos · Fuente: DANE · Haz clic en un departamento para ver sus municipios
        </p>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar departamento por nombre o código DANE…" style={{ ...inp, borderRadius: 12, fontSize: 14 }} />

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: 16, alignItems: "start" }}>

        {/* Tabla de departamentos */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["Cód. DANE", "Departamento", "Municipios"].map(h => (
                  <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(dept => {
                const muniCount = getMunicipalitiesByDepartment(dept.code).length;
                const isSelected = selected === dept.code;
                return (
                  <tr
                    key={dept.code}
                    onClick={() => setSelected(isSelected ? null : dept.code)}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", background: isSelected ? "rgba(96,165,250,0.08)" : "transparent", transition: "background 0.15s" }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "rgba(96,165,250,0.08)" : "transparent"; }}
                  >
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#60a5fa", fontFamily: "monospace", fontWeight: 700 }}>{dept.code}</td>
                    <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: isSelected ? 700 : 400, color: isSelected ? "#60a5fa" : "#fff" }}>{dept.name}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 12, background: "rgba(96,165,250,0.1)", color: "#60a5fa", fontWeight: 600 }}>{muniCount}</span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={3} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>Sin resultados para "{search}"</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Panel de municipios */}
        {selected && (
          <div style={{ background: "rgba(167,139,250,0.03)", border: "1px solid rgba(167,139,250,0.15)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(167,139,250,0.12)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#a78bfa" }}>{selectedDept?.name}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Cód. {selectedDept?.code} · {municipalities.length} municipios</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <div style={{ maxHeight: 480, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    {["Cód. DANE", "Municipio"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {municipalities.map(m => (
                    <tr key={m.code} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(167,139,250,0.04)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <td style={{ padding: "10px 16px", fontSize: 11, color: "#a78bfa", fontFamily: "monospace", fontWeight: 600 }}>{m.code}</td>
                      <td style={{ padding: "10px 16px", fontSize: 13, color: "#fff" }}>{m.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
        💡 Los departamentos y municipios cargados en este módulo se usan como referencia en los formularios de Rescates, Inventario, Productores y demás módulos del sistema.
      </div>
    </div>
  );
}
