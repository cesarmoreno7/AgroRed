import type { CSSProperties, ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { NavLink } from "react-router-dom";

interface Props {
  children: ReactNode;
}

export function Layout({ children }: Props) {
  const { user, logout } = useAuth();

  const aside: CSSProperties = {
    width: 240,
    minHeight: "100vh",
    background: "linear-gradient(180deg, rgba(10,10,18,1) 0%, rgba(15,15,28,1) 100%)",
    borderRight: "1px solid rgba(255,255,255,0.04)",
    padding: "28px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    flexShrink: 0,
  };

  const linkBase: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
    color: "rgba(255,255,255,0.5)",
    textDecoration: "none",
    transition: "all 0.2s",
  };

  const navItems: { to: string; icon: string; label: string }[] = [
    { to: "/", icon: "📊", label: "Dashboard" },
    { to: "/territorial", icon: "🗺️", label: "Territorial" },
    { to: "/fleet", icon: "🚚", label: "Flota" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a12" }}>
      <aside style={aside}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, paddingLeft: 6 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #4ade80, #22d3ee)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 700, color: "#0a0a12",
          }}>A</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>AgroRed</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Dashboard</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {navItems.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              style={({ isActive }) => ({
                ...linkBase,
                ...(isActive
                  ? {
                      color: "#fff",
                      background: "rgba(255,255,255,0.06)",
                      fontWeight: 600,
                    }
                  : {}),
              })}
            >
              <span style={{ fontSize: 16 }}>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div style={{ marginTop: "auto", padding: "14px 10px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{user?.fullName}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{user?.email}</div>
          <button
            onClick={logout}
            style={{
              marginTop: 12,
              width: "100%",
              padding: "8px 0",
              background: "rgba(248,113,113,0.1)",
              color: "#f87171",
              border: "1px solid rgba(248,113,113,0.15)",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.2s",
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: "28px 32px", overflowY: "auto", maxHeight: "100vh" }}>
        {children}
      </main>
    </div>
  );
}
