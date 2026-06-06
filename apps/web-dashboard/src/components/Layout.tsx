import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { NavLink, useLocation } from "react-router-dom";
import { MODULE_ACCESS } from "../config/moduleAccess";

interface MenuItem {
  to: string;
  icon: string;
  label: string;
  module?: string;
}

interface MenuGroup {
  id: string;
  label: string;
  icon: string;
  items: MenuItem[];
}

const MENU_GROUPS: MenuGroup[] = [
  {
    id: "principal",
    label: "Principal",
    icon: "📈",
    items: [
      { to: "/", icon: "📈", label: "Tablero Institucional" },
    ],
  },
  {
    id: "territorio",
    label: "Territorio",
    icon: "🗺️",
    items: [
      { to: "/territorial",  icon: "🗺️", label: "Mapa Territorial",    module: "logistics-service" },
      { to: "/institutions", icon: "🏛️", label: "Instituciones",        module: "institution-service" },
      { to: "/origins",      icon: "🏪", label: "Orígenes Aliados",     module: "origins-service" },
    ],
  },
  {
    id: "operaciones",
    label: "Operaciones",
    icon: "⚙️",
    items: [
      { to: "/producers",  icon: "🌾", label: "Productores",            module: "producer-service" },
      { to: "/offers",     icon: "📦", label: "Ofertas",                module: "offer-service" },
      { to: "/rescues",    icon: "♻️", label: "Rescates",               module: "rescue-service" },
      { to: "/demands",    icon: "🍽️", label: "Demandas",               module: "demand-service" },
      { to: "/inventory",  icon: "📊", label: "Inventario",             module: "inventory-service" },
      { to: "/fleet",      icon: "🚚", label: "Flota en tiempo real",   module: "logistics-service" },
      { to: "/logistics",  icon: "🗂️", label: "Geocercas logísticas",   module: "logistics-service" },
    ],
  },
  {
    id: "admin",
    label: "Administración",
    icon: "🛠️",
    items: [
      { to: "/users",         icon: "👤", label: "Usuarios",            module: "user-service" },
      { to: "/channels",      icon: "📡", label: "Canales",             module: "catalog-service" },
      { to: "/organizations", icon: "🏢", label: "Organizaciones",      module: "catalog-service" },
      { to: "/products",      icon: "🥦", label: "Productos",           module: "catalog-service" },
      { to: "/categories",    icon: "🏷️", label: "Categorías",          module: "catalog-service" },
    ],
  },
  {
    id: "inteligencia",
    label: "Inteligencia",
    icon: "🧠",
    items: [
      { to: "/incidents",     icon: "⚠️", label: "Incidencias Sociales", module: "incident-service" },
      { to: "/notifications", icon: "🔔", label: "Notificaciones",       module: "notification-service" },
      { to: "/auctions",      icon: "🏷️", label: "Subastas",             module: "auction-service" },
      { to: "/alerts",        icon: "🚨", label: "Alertas IRAT",          module: "analytics-service" },
      { to: "/ml",            icon: "🤖", label: "Apoyo a Decisión",      module: "ml-service" },
      { to: "/ai-copilot",    icon: "✨", label: "Copiloto IA",           module: "user-service" },
    ],
  },
];

interface Props {
  children: ReactNode;
}

export function Layout({ children }: Props) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 820px)").matches : false
  );
  const [menuOpen, setMenuOpen] = useState(() =>
    typeof window !== "undefined" ? !window.matchMedia("(max-width: 820px)").matches : true
  );
  // Track which accordion groups are open on mobile
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(["principal"]));

  const aside: CSSProperties = {
    width: isMobile ? "100%" : 240,
    minHeight: isMobile ? "auto" : "100vh",
    background: "linear-gradient(180deg, rgba(10,10,18,1) 0%, rgba(15,15,28,1) 100%)",
    borderRight: isMobile ? "none" : "1px solid rgba(255,255,255,0.04)",
    borderBottom: isMobile ? "1px solid rgba(255,255,255,0.06)" : "none",
    padding: isMobile ? "12px 14px" : "28px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    flexShrink: 0,
    position: isMobile ? "sticky" : "static",
    top: 0,
    zIndex: 20,
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

  useEffect(() => {
    const media = window.matchMedia("(max-width: 820px)");
    const syncLayout = () => {
      setIsMobile(media.matches);
      setMenuOpen(!media.matches);
    };
    syncLayout();
    media.addEventListener("change", syncLayout);
    return () => media.removeEventListener("change", syncLayout);
  }, []);

  // Close menu on route change (mobile)
  useEffect(() => {
    if (isMobile) setMenuOpen(false);
  }, [isMobile, location.pathname]);

  // Auto-open the group containing the active route
  useEffect(() => {
    const active = MENU_GROUPS.find(g =>
      g.items.some(item =>
        item.to === location.pathname ||
        (item.to !== "/" && location.pathname.startsWith(item.to))
      )
    );
    if (active) {
      setOpenGroups(prev => {
        if (prev.has(active.id)) return prev;
        return new Set([...prev, active.id]);
      });
    }
  }, [location.pathname]);

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Filter items by role
  const visibleGroups = MENU_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item =>
      !item.module || (user?.role ? MODULE_ACCESS[user.role]?.includes(item.module) : false)
    ),
  })).filter(group => group.items.length > 0);

  const renderNavLink = (item: MenuItem, closeOnClick = false) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === "/"}
      onClick={() => { if (closeOnClick && isMobile) setMenuOpen(false); }}
      style={({ isActive }) => ({
        ...linkBase,
        ...(isActive
          ? { color: "#fff", background: "rgba(255,255,255,0.06)", fontWeight: 600 }
          : {}),
      })}
    >
      <span style={{ fontSize: 16 }}>{item.icon}</span>
      {item.label}
    </NavLink>
  );

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: "100vh", background: "#0a0a12" }}>
      <aside style={aside}>
        {/* Brand + hamburger */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: isMobile && !menuOpen ? 0 : 20, paddingLeft: isMobile ? 0 : 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
          {isMobile && (
            <button
              type="button"
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(open => !open)}
              style={{
                width: 40, height: 40, borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
                color: "#fff", fontSize: 22, lineHeight: 1, cursor: "pointer",
              }}
            >
              {menuOpen ? "×" : "☰"}
            </button>
          )}
        </div>

        {/* ── Desktop: nav plana con separadores de grupo ── */}
        {!isMobile && (
          <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {visibleGroups.map((group, gi) => (
              <div key={group.id}>
                {gi > 0 && (
                  <div style={{
                    margin: "10px 0 4px 14px",
                    fontSize: 10, fontWeight: 800, letterSpacing: "0.09em",
                    textTransform: "uppercase", color: "rgba(255,255,255,0.2)",
                  }}>
                    {group.label}
                  </div>
                )}
                {group.items.map(item => renderNavLink(item))}
              </div>
            ))}
          </nav>
        )}

        {/* ── Móvil: acordeón con grupos colapsables ── */}
        {isMobile && menuOpen && (
          <nav style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: "64vh", overflowY: "auto", paddingRight: 2 }}>
            {visibleGroups.map(group => {
              const isOpen = openGroups.has(group.id);
              const hasActive = group.items.some(
                item => item.to === location.pathname || (item.to !== "/" && location.pathname.startsWith(item.to))
              );
              return (
                <div key={group.id}>
                  {/* Accordion header */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      width: "100%",
                      gap: 10,
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "none",
                      background: hasActive
                        ? "rgba(74,222,128,0.07)"
                        : isOpen ? "rgba(255,255,255,0.04)" : "transparent",
                      color: hasActive ? "#4ade80" : "rgba(255,255,255,0.65)",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.2s",
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{group.icon}</span>
                    <span style={{ flex: 1 }}>{group.label}</span>
                    <span style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.3)",
                      transition: "transform 0.25s",
                      display: "inline-block",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}>▾</span>
                  </button>

                  {/* Accordion content with slide animation */}
                  <div style={{
                    overflow: "hidden",
                    maxHeight: isOpen ? `${group.items.length * 48}px` : "0px",
                    transition: "max-height 0.3s ease",
                  }}>
                    <div style={{ paddingLeft: 14, paddingBottom: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                      {group.items.map(item => renderNavLink(item, true))}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        )}

        {/* User footer */}
        {(!isMobile || menuOpen) && (
          <div style={{ marginTop: isMobile ? 14 : "auto", padding: "14px 10px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{user?.fullName}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{user?.email}</div>
            <button
              onClick={logout}
              style={{
                marginTop: 12, width: "100%", padding: "8px 0",
                background: "rgba(248,113,113,0.1)", color: "#f87171",
                border: "1px solid rgba(248,113,113,0.15)",
                borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "background 0.2s",
              }}
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </aside>

      <main style={{ flex: 1, padding: isMobile ? "18px 14px 28px" : "28px 32px", overflowY: isMobile ? "visible" : "auto", maxHeight: isMobile ? "none" : "100vh", minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
