import { useState, useRef, useEffect } from "react";
import { api } from "../services/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  sqlExecuted?: string;
  sqlResult?: any[];
  sqlError?: string;
}

export function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "¡Hola! Soy **AgroRed Copilot**, tu asistente analítico de inteligencia territorial. Puedo consultar directamente la base de datos en tiempo real para proporcionarte estadísticas de ofertas, demandas, incidencias, productores y más. ¿En qué puedo ayudarte hoy?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    "¿Cuántas ofertas activas hay en total?",
    "Resumen de demandas abiertas por producto",
    "¿Cuáles son los productores registrados en el sistema?",
    "¿Existen incidencias críticas activas hoy?"
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // Build chat history excluding the system instructions or deep metadata
      const chatHistory = messages.map((m) => ({
        role: m.role,
        content: m.content
      }));

      const res = await api<{ response: string; sqlExecuted?: string; sqlResult?: any[]; sqlError?: string }>(
        "/api/v1/ai-chat",
        {
          method: "POST",
          body: {
            message: textToSend,
            history: chatHistory
          }
        }
      );

      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: res.data.response,
            sqlExecuted: res.data.sqlExecuted,
            sqlResult: res.data.sqlResult,
            sqlError: res.data.sqlError
          }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `❌ **Error de comunicación**: ${res.message || "No se pudo obtener respuesta del modelo de IA."}`
          }
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ **Error inesperado**: ${err.message || "Hubo un fallo al realizar la solicitud."}`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Basic Markdown Formatter for bold and linebreaks to render elegantly without full markdown library
  const formatText = (text: string) => {
    return text.split("\n").map((line, idx) => {
      // Replace bold syntax **text** with <strong>text</strong>
      const parts = line.split(/\*\*(.*?)\*\*/g);
      const elements = parts.map((part, i) => {
        if (i % 2 === 1) {
          return <strong key={i} style={{ color: "#34d399", fontWeight: 700 }}>{part}</strong>;
        }
        return part;
      });

      return (
        <div key={idx} style={{ marginBottom: 6, lineHeight: 1.6 }}>
          {elements}
        </div>
      );
    });
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", height: "calc(100vh - 80px)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, background: "linear-gradient(135deg, #4ade80, #22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>
            Copiloto de IA AgroRed
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 4 }}>
            Consulta estadísticas de la base de datos mediante lenguaje natural.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ fontSize: 11, background: "rgba(34,211,238,0.1)", color: "#22d3ee", padding: "4px 10px", borderRadius: 12, border: "1px solid rgba(34,211,238,0.2)", fontWeight: 600 }}>
            Text-to-SQL Activo
          </span>
          <span style={{ fontSize: 11, background: "rgba(74,222,128,0.1)", color: "#4ade80", padding: "4px 10px", borderRadius: 12, border: "1px solid rgba(74,222,128,0.2)", fontWeight: 600 }}>
            PostgreSQL Seguro
          </span>
        </div>
      </div>

      {/* Main Chat Box */}
      <div style={{
        flex: 1,
        background: "rgba(18, 18, 35, 0.6)",
        border: "1px solid rgba(255, 255, 255, 0.05)",
        borderRadius: 16,
        backdropFilter: "blur(12px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.3)"
      }}>
        {/* Messages List */}
        <div style={{ flex: 1, padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
          {messages.map((msg, index) => (
            <div key={index} style={{
              display: "flex",
              flexDirection: "column",
              alignItems: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start"
            }}>
              {/* Message Bubble */}
              <div style={{
                padding: "14px 20px",
                borderRadius: msg.role === "user" ? "16px 16px 2px 16px" : "16px 16px 16px 2px",
                background: msg.role === "user" ? "linear-gradient(135deg, #10b981, #059669)" : "rgba(255, 255, 255, 0.03)",
                border: msg.role === "user" ? "none" : "1px solid rgba(255, 255, 255, 0.06)",
                color: "#fff",
                fontSize: 14,
                boxShadow: msg.role === "user" ? "0 4px 12px rgba(16,185,129,0.15)" : "none"
              }}>
                {formatText(msg.content)}
              </div>

              {/* SQL Execution Trace */}
              {msg.sqlExecuted && (
                <div style={{
                  marginTop: 10,
                  width: "100%",
                  minWidth: 400,
                  background: "#08080f",
                  border: "1px solid rgba(34, 211, 238, 0.2)",
                  borderRadius: 10,
                  overflow: "hidden",
                  fontFamily: "monospace",
                  fontSize: 12
                }}>
                  <div style={{ background: "rgba(34, 211, 238, 0.05)", padding: "6px 12px", display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(34, 211, 238, 0.15)" }}>
                    <span style={{ color: "#22d3ee", fontWeight: 600 }}>⚡ Consulta SQL Ejecutada</span>
                    <span style={{ color: "rgba(255,255,255,0.3)" }}>PostgreSQL</span>
                  </div>
                  <pre style={{ margin: 0, padding: 12, overflowX: "auto", color: "#a5f3fc" }}>
                    {msg.sqlExecuted}
                  </pre>

                  {/* SQL Results Grid */}
                  {msg.sqlResult && msg.sqlResult.length > 0 ? (
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, textAlign: "left" }}>
                        <thead>
                          <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                            {Object.keys(msg.sqlResult[0]).map((key) => (
                              <th key={key} style={{ padding: "8px 12px", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {msg.sqlResult.slice(0, 10).map((row, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              {Object.values(row).map((val: any, cIdx) => (
                                <td key={cIdx} style={{ padding: "8px 12px", color: "rgba(255,255,255,0.8)" }}>
                                  {val === null ? "NULL" : typeof val === "object" ? JSON.stringify(val) : String(val)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {msg.sqlResult.length > 10 && (
                        <div style={{ padding: "6px 12px", color: "rgba(255,255,255,0.4)", fontSize: 10, textAlign: "center" }}>
                          (Mostrando solo las primeras 10 filas de {msg.sqlResult.length})
                        </div>
                      )}
                    </div>
                  ) : msg.sqlResult ? (
                    <div style={{ padding: 10, color: "rgba(255,255,255,0.4)", fontSize: 11, fontStyle: "italic", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      La consulta no retornó registros.
                    </div>
                  ) : null}

                  {msg.sqlError && (
                    <div style={{ padding: 12, background: "rgba(248,113,113,0.05)", borderTop: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}>
                      <strong>Error de Base de Datos:</strong> {msg.sqlError}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Loading Animation */}
          {isLoading && (
            <div style={{ alignSelf: "flex-start", display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{
                padding: "14px 20px",
                borderRadius: "16px 16px 16px 2px",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                display: "flex",
                alignItems: "center",
                gap: 12
              }}>
                <div style={{ display: "flex", gap: 4 }}>
                  <div className="dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", animation: "bounce 1.4s infinite ease-in-out" }}></div>
                  <div className="dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#22d3ee", animation: "bounce 1.4s infinite ease-in-out 0.2s" }}></div>
                  <div className="dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", animation: "bounce 1.4s infinite ease-in-out 0.4s" }}></div>
                </div>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Consultando base de datos y analizando...</span>
              </div>
              <style>{`
                @keyframes bounce {
                  0%, 80%, 100% { transform: scale(0); }
                  40% { transform: scale(1.0); }
                }
              `}</style>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        {messages.length === 1 && !isLoading && (
          <div style={{ padding: "0 24px 16px 24px", display: "flex", flexWrap: "wrap", gap: 8 }}>
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(s)}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 20,
                  padding: "8px 16px",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.7)",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                  e.currentTarget.style.borderColor = "rgba(34,211,238,0.3)";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.7)";
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div style={{ padding: 24, borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(10, 10, 18, 0.4)" }}>
          <form onSubmit={(e) => { e.preventDefault(); handleSend(input); }} style={{ display: "flex", gap: 12 }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Hazme una pregunta sobre estadísticas del sistema..."
              disabled={isLoading}
              style={{
                flex: 1,
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 12,
                padding: "14px 20px",
                color: "#fff",
                fontSize: 14,
                outline: "none",
                transition: "all 0.2s"
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#22d3ee";
                e.currentTarget.style.boxShadow = "0 0 10px rgba(34,211,238,0.15)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              style={{
                background: "linear-gradient(135deg, #4ade80, #22d3ee)",
                border: "none",
                borderRadius: 12,
                padding: "0 24px",
                color: "#0a0a12",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: isLoading || !input.trim() ? 0.6 : 1
              }}
            >
              Consultar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
