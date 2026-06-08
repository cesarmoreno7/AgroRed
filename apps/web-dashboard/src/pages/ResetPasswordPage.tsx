import { useState, type FormEvent, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";

const PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("El enlace de recuperación no es válido o ha expirado.");
      return;
    }
    if (!PASSWORD_RE.test(newPassword)) {
      setError("La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un carácter especial.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const res = await api("/api/v1/users/reset-password", {
      method: "POST",
      body: { token, newPassword },
    });
    setLoading(false);

    if (res.ok) {
      setDone(true);
      setTimeout(() => navigate("/login"), 3000);
    } else {
      setError(
        res.status === 400
          ? "El enlace es inválido o ha expirado. Solicite uno nuevo."
          : "No se pudo restablecer la contraseña. Intente de nuevo."
      );
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

  const hint: CSSProperties = {
    fontSize: 11,
    color: "rgba(255,255,255,0.25)",
    marginTop: 5,
  };

  if (!token) {
    return (
      <div style={wrapper}>
        <div style={card}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔗</div>
            <h2 style={{ color: "#f87171", fontSize: 16, margin: "0 0 10px" }}>
              Enlace inválido
            </h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 24 }}>
              Este enlace de recuperación no es válido o ya fue utilizado.
            </p>
            <Link
              to="/forgot-password"
              style={{ color: "#4ade80", fontSize: 13, textDecoration: "none" }}
            >
              Solicitar nuevo enlace
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
            Nueva contraseña
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: 0 }}>
            Elija una contraseña segura para su cuenta
          </p>
        </div>

        {done ? (
          <div style={{ textAlign: "center" }}>
            <div style={{
              padding: "20px 16px",
              background: "rgba(74,222,128,0.06)",
              border: "1px solid rgba(74,222,128,0.15)",
              borderRadius: 12,
              marginBottom: 24,
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>✅</div>
              <p style={{ color: "#4ade80", fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>
                Contraseña actualizada
              </p>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, margin: 0 }}>
                Será redirigido al inicio de sesión en unos segundos…
              </p>
            </div>
            <Link
              to="/login"
              style={{ color: "#4ade80", fontSize: 13, textDecoration: "none" }}
            >
              Ir al inicio de sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{
                  display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)",
                  marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  Nueva contraseña
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  style={inputStyle}
                />
                <p style={hint}>Mínimo 8 caracteres, una mayúscula, un número y un carácter especial</p>
              </div>
              <div>
                <label style={{
                  display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)",
                  marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  Confirmar contraseña
                </label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  style={inputStyle}
                />
              </div>
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
              {loading ? "Guardando…" : "Establecer nueva contraseña"}
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
