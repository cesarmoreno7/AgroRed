import { useState, type FormEvent, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await api("/api/v1/users/recover-password", {
      method: "POST",
      body: { email },
    });
    setLoading(false);
    if (res.ok) {
      setSent(true);
    } else {
      setError("No se pudo procesar la solicitud. Intente de nuevo más tarde.");
    }
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
    marginTop: 22,
    letterSpacing: "0.02em",
  };

  return (
    <div style={wrapper}>
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, margin: "0 auto 16px",
            background: "linear-gradient(135deg, #4ade80, #22d3ee)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, fontWeight: 700, color: "#0a0a12",
          }}>A</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: "0 0 6px" }}>
            Recuperar contraseña
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: 0 }}>
            Recibirá un enlace de restablecimiento en su correo
          </p>
        </div>

        {sent ? (
          <div style={{ textAlign: "center" }}>
            <div style={{
              padding: "20px 16px",
              background: "rgba(74,222,128,0.06)",
              border: "1px solid rgba(74,222,128,0.15)",
              borderRadius: 12,
              marginBottom: 24,
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>📧</div>
              <p style={{ color: "#4ade80", fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>
                Correo enviado
              </p>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, margin: 0 }}>
                Si el correo <strong style={{ color: "rgba(255,255,255,0.7)" }}>{email}</strong> está
                registrado, recibirá las instrucciones en los próximos minutos.
                Revise también la carpeta de spam.
              </p>
            </div>
            <Link
              to="/login"
              style={{ color: "#4ade80", fontSize: 13, textDecoration: "none" }}
            >
              ← Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <div style={{ marginBottom: 4 }}>
              <label style={{
                display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)",
                marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em",
              }}>
                Correo electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@agrored.co"
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{
                marginTop: 14, padding: "10px 14px",
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.15)",
                borderRadius: 8, color: "#f87171", fontSize: 12,
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? "Enviando…" : "Enviar enlace de recuperación"}
            </button>

            <div style={{ textAlign: "center", marginTop: 20 }}>
              <Link
                to="/login"
                style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, textDecoration: "none" }}
              >
                ← Volver al inicio de sesión
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
