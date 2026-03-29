import { useState, type FormEvent, type CSSProperties } from "react";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const err = await login(email, password);
    setLoading(false);
    if (err) setError(err);
  };

  const wrapper: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "radial-gradient(ellipse at 50% 0%, rgba(74,222,128,0.08) 0%, #0a0a12 70%)",
  };

  const card: CSSProperties = {
    width: 380,
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 20,
    padding: "40px 36px",
    backdropFilter: "blur(20px)",
  };

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    color: "#fff",
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  };

  const btnStyle: CSSProperties = {
    width: "100%",
    padding: "13px 0",
    background: "linear-gradient(135deg, #4ade80, #22d3ee)",
    border: "none",
    borderRadius: 10,
    color: "#0a0a12",
    fontSize: 14,
    fontWeight: 700,
    cursor: loading ? "wait" : "pointer",
    opacity: loading ? 0.7 : 1,
    transition: "opacity 0.2s, transform 0.15s",
    letterSpacing: "0.02em",
  };

  return (
    <div style={wrapper}>
      <form onSubmit={onSubmit} style={card}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, margin: "0 auto 16px",
            background: "linear-gradient(135deg, #4ade80, #22d3ee)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, fontWeight: 700, color: "#0a0a12",
          }}>A</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>AgroRed</h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: 0 }}>Panel de control operativo</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Correo electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@agrored.co"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 8, color: "#f87171", fontSize: 12 }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} style={{ ...btnStyle, marginTop: 22 }}>
          {loading ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
