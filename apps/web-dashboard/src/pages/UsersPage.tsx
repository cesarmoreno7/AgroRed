import { useEffect, useState, useMemo } from "react";
import { fetchUsers, registerUser, updateUser } from "../services/users";
import { useAuth } from "../hooks/useAuth";

const ROLES = [
  { value: "admin_municipal",     label: "Admin Municipal" },
  { value: "producer",            label: "Productor" },
  { value: "logistics_operator",  label: "Operador Logístico" },
  { value: "territorial_analyst", label: "Analista Territorial" },
  { value: "community_kitchen",   label: "Cocina Comunitaria" },
];
const ROLE_COLOR: Record<string, string> = {
  admin_municipal: "#60a5fa", producer: "#4ade80",
  logistics_operator: "#fb923c", territorial_analyst: "#a78bfa", community_kitchen: "#f472b6",
};
const ROLE_ICON: Record<string, string> = {
  admin_municipal: "🏛️", producer: "🌾",
  logistics_operator: "🚛", territorial_analyst: "🗺️", community_kitchen: "🍲",
};

const inp: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" };

type GroupBy = "role" | "municipality";

export function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", fullName: "", role: "producer", password: "" });
  const [groupBy, setGroupBy] = useState<GroupBy>("role");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ fullName: "", role: "producer" });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Collapsed groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => { fetchUsers().then(r => { if (r.ok) setUsers(r.data); }); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(u =>
      u.email?.toLowerCase().includes(q) ||
      u.fullName?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q) ||
      u.municipalityName?.toLowerCase().includes(q)
    );
  }, [users, search]);

  // Group logic
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const u of filtered) {
      const key = groupBy === "role"
        ? (u.role ?? "sin_rol")
        : (u.municipalityName ?? u.tenantId?.slice(0, 8) ?? "Sin municipio");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(u);
    }
    // Sort groups: role order or alphabetical
    const entries = Array.from(map.entries());
    if (groupBy === "role") {
      const roleOrder = ROLES.map(r => r.value);
      entries.sort((a, b) => {
        const ia = roleOrder.indexOf(a[0]);
        const ib = roleOrder.indexOf(b[0]);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
    } else {
      entries.sort((a, b) => a[0].localeCompare(b[0]));
    }
    return entries;
  }, [filtered, groupBy]);

  const toggleGroup = (key: string) =>
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    setEditForm({ fullName: record.fullName || "", role: record.role || "producer" });
    setEditError(null); setShowForm(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingId) return;
    setEditLoading(true); setEditError(null);
    const res = await updateUser(editingId, editForm);
    setEditLoading(false);
    if (res.ok) { setUsers(u => u.map(x => x.id === editingId ? { ...x, ...editForm } : x)); setEditingId(null); }
    else setEditError((res as any).message);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null);
    const res = await registerUser({ ...form, tenantId: user?.tenantId ?? "" });
    setLoading(false);
    if (res.ok) { setUsers(u => [...u, res.data]); setForm({ email: "", fullName: "", role: "producer", password: "" }); setShowForm(false); }
    else setError((res as any).message);
  };

  // Role summary badges
  const roleSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of users) { counts[u.role] = (counts[u.role] ?? 0) + 1; }
    return counts;
  }, [users]);

  return (
    <div style={{ color: "#fff", maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#60a5fa,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Gestión de Usuarios</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{users.length} usuarios registrados</p>
        </div>
        <button onClick={() => { setShowForm(v => !v); setEditingId(null); }} style={{ background: showForm ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#60a5fa,#a78bfa)", color: showForm ? "rgba(255,255,255,0.6)" : "#0a0a12", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
          {showForm ? "✕ Cancelar" : "+ Nuevo usuario"}
        </button>
      </div>

      {/* Role summary cards */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {ROLES.map(r => (
          <div key={r.value} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${ROLE_COLOR[r.value]}22`, borderRadius: 12, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>{ROLE_ICON[r.value]}</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: ROLE_COLOR[r.value] }}>{roleSummary[r.value] ?? 0}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>{r.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + group toggle */}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: 0.4 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, correo, rol o municipio…" style={{ ...inp, paddingLeft: 42, fontSize: 14, borderRadius: 12 }} />
        </div>
        <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, overflow: "hidden" }}>
          {(["role", "municipality"] as GroupBy[]).map(g => (
            <button key={g} onClick={() => setGroupBy(g)} style={{ padding: "10px 16px", background: groupBy === g ? "rgba(96,165,250,0.15)" : "transparent", color: groupBy === g ? "#60a5fa" : "rgba(255,255,255,0.4)", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.15s" }}>
              {g === "role" ? "Por Rol" : "Por Municipio"}
            </button>
          ))}
        </div>
      </div>

      {/* New form */}
      {showForm && (
        <div style={{ background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "#60a5fa" }}>Nuevo usuario</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div><label style={lbl}>Correo electrónico</label><input style={inp} value={form.email} onChange={e => set("email", e.target.value)} placeholder="correo@dominio.co" type="email" required /></div>
              <div><label style={lbl}>Nombre completo</label><input style={inp} value={form.fullName} onChange={e => set("fullName", e.target.value)} placeholder="Nombre completo" required /></div>
              <div><label style={lbl}>Rol</label><select style={inp} value={form.role} onChange={e => set("role", e.target.value)}>{ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
              <div><label style={lbl}>Contraseña</label><input style={inp} value={form.password} onChange={e => set("password", e.target.value)} placeholder="Mín. 8 caracteres" type="password" required /></div>
            </div>
            {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ background: "linear-gradient(135deg,#60a5fa,#a78bfa)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>{loading ? "Guardando…" : "Registrar usuario"}</button>
          </form>
        </div>
      )}

      {/* Edit form */}
      {editingId && (
        <div style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f59e0b" }}>✏️ Editando usuario</h3>
            <button onClick={() => setEditingId(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          <form onSubmit={handleUpdate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div><label style={lbl}>Nombre completo</label><input style={inp} value={editForm.fullName} onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))} required /></div>
              <div><label style={lbl}>Rol</label><select style={inp} value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>{ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
            </div>
            {editError && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{editError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={editLoading} style={{ background: "linear-gradient(135deg,#f59e0b,#fb923c)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>{editLoading ? "Guardando…" : "Guardar cambios"}</button>
              <button type="button" onClick={() => setEditingId(null)} style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 20px", cursor: "pointer", fontSize: 14 }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Grouped table */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {grouped.map(([groupKey, groupUsers]) => {
          const isRole = groupBy === "role";
          const roleObj = ROLES.find(r => r.value === groupKey);
          const color = isRole ? (ROLE_COLOR[groupKey] ?? "#94a3b8") : "#60a5fa";
          const icon = isRole ? (ROLE_ICON[groupKey] ?? "👤") : "📍";
          const label = isRole ? (roleObj?.label ?? groupKey) : groupKey;
          const isCollapsed = collapsedGroups.has(groupKey);

          return (
            <div key={groupKey} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(groupKey)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", background: `${color}0a`, border: "none", borderBottom: isCollapsed ? "none" : "1px solid rgba(255,255,255,0.07)", cursor: "pointer", color: "#fff", textAlign: "left" }}
              >
                <span style={{ fontSize: 18 }}>{icon}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color }}>{label}</span>
                <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${color}20`, color }}>
                  {groupUsers.length} usuario{groupUsers.length !== 1 ? "s" : ""}
                </span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                  {isCollapsed ? "▶" : "▼"}
                </span>
              </button>

              {!isCollapsed && (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      {["Usuario", "Correo", isRole ? "Municipio" : "Rol", "Tenant", "Acciones"].map(h => (
                        <th key={h} style={{ padding: "10px 18px", textAlign: "left", fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupUsers.map((u, i) => (
                      <tr key={u.id || i}
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: editingId === u.id ? "rgba(245,158,11,0.04)" : "transparent", transition: "background 0.15s" }}
                        onMouseEnter={e => { if (editingId !== u.id) e.currentTarget.style.background = `${color}08`; }}
                        onMouseLeave={e => { e.currentTarget.style.background = editingId === u.id ? "rgba(245,158,11,0.04)" : "transparent"; }}>
                        <td style={{ padding: "12px 18px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${ROLE_COLOR[u.role] ?? "#94a3b8"}22`, border: `1px solid ${ROLE_COLOR[u.role] ?? "#94a3b8"}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: ROLE_COLOR[u.role] ?? "#94a3b8", flexShrink: 0 }}>
                              {(u.fullName || "?")[0]?.toUpperCase()}
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{u.fullName}</span>
                          </div>
                        </td>
                        <td style={{ padding: "12px 18px", fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{u.email}</td>
                        <td style={{ padding: "12px 18px" }}>
                          {isRole ? (
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{u.municipalityName ?? "—"}</span>
                          ) : (
                            <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${ROLE_COLOR[u.role] ?? "#94a3b8"}18`, color: ROLE_COLOR[u.role] ?? "#94a3b8", border: `1px solid ${ROLE_COLOR[u.role] ?? "#94a3b8"}33` }}>
                              {ROLES.find(r => r.value === u.role)?.label ?? u.role}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "12px 18px", fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>{u.tenantId?.slice(0, 8)}…</td>
                        <td style={{ padding: "12px 18px" }}>
                          <button onClick={() => handleEdit(u)} style={{ background: editingId === u.id ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)", color: editingId === u.id ? "#f59e0b" : "rgba(255,255,255,0.5)", border: `1px solid ${editingId === u.id ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                            ✏️ Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
        {grouped.length === 0 && (
          <div style={{ padding: 48, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16 }}>
            {search ? `Sin resultados para "${search}"` : "No hay usuarios."}
          </div>
        )}
      </div>
    </div>
  );
}
