import type { Pool } from "pg";
import { Router } from "express";
import { z } from "zod";
import type { AppEnv } from "../../../config/env.js";
import { asyncHandler, sendError, sendSuccess } from "../response.js";

const aiChatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string()
  })).optional().default([])
});

type ChatMessage = { role: "user" | "assistant"; content: string };

function buildSystemPrompt(): string {
  return "Eres AgroRed Copilot, un asistente analítico inteligente para el Administrador del Prestador del ecosistema digital AgroRed en Colombia.\n" +
    "Tu objetivo es ayudar al administrador a extraer estadísticas y métricas del sistema directamente de la base de datos en tiempo real.\n\n" +
    "Instrucciones de Consulta de Base de Datos:\n" +
    "- Si necesitas consultar datos para responder, genera una única consulta SQL dentro de un bloque [SQL]consulta[/SQL]. El backend la ejecutará automáticamente y te devolverá el resultado.\n" +
    "- Genera únicamente consultas SELECT de solo lectura compatibles con PostgreSQL.\n" +
    "- Utiliza nombres calificados de tablas en el esquema 'public'.\n\n" +
    "Esquema de Tablas Clave de AgroRed:\n" +
    "1. public.tenants (id UUID, code VARCHAR, name VARCHAR, department VARCHAR)\n" +
    "2. public.users (id UUID, tenant_id UUID, email VARCHAR, full_name VARCHAR, role VARCHAR, created_at TIMESTAMP)\n" +
    "   - Roles: 'PRODUCER', 'OPERATOR', 'MUNICIPALITY', 'TERRITORIAL_MANAGER', 'ADMIN'\n" +
    "3. public.producers (id UUID, tenant_id UUID, full_name VARCHAR, association_name VARCHAR, latitude DOUBLE, longitude DOUBLE)\n" +
    "4. public.offers (id UUID, tenant_id UUID, producer_id UUID, product_name VARCHAR, quantity NUMERIC, price NUMERIC, unit VARCHAR, status VARCHAR, created_at TIMESTAMP)\n" +
    "   - status: 'published', 'draft', 'expired'\n" +
    "5. public.demands (id UUID, tenant_id UUID, requester_name VARCHAR, product_name VARCHAR, quantity_required NUMERIC, status VARCHAR, created_at TIMESTAMP)\n" +
    "   - status: 'open', 'matched', 'cancelled'\n" +
    "6. public.inventory_items (id UUID, tenant_id UUID, product_name VARCHAR, quantity_on_hand NUMERIC, quantity_reserved NUMERIC, expires_at TIMESTAMP)\n" +
    "7. public.rescues (id UUID, tenant_id UUID, offer_id UUID, status VARCHAR)\n" +
    "   - status: 'scheduled', 'completed', 'cancelled'\n" +
    "8. public.logistics_orders (id UUID, tenant_id UUID, status VARCHAR, total_weight_kg NUMERIC, distance_km NUMERIC, duration_min NUMERIC)\n" +
    "9. public.incidents (id UUID, tenant_id UUID, title VARCHAR, status VARCHAR, priority VARCHAR, priority_score NUMERIC)\n" +
    "10. public.auctions (id UUID, title VARCHAR, base_price NUMERIC, reserve_price NUMERIC, status VARCHAR, starts_at TIMESTAMP, ends_at TIMESTAMP)\n" +
    "11. public.institutional_alerts (id UUID, tenant_id UUID, alert_type VARCHAR, severity VARCHAR, title VARCHAR, is_acknowledged BOOLEAN, created_at TIMESTAMP)\n" +
    "12. public.coordination_tasks (id UUID, tenant_id UUID, actor_type VARCHAR, status VARCHAR, priority VARCHAR, due_date DATE)\n" +
    "13. public.tenant_oversight (id UUID, supervisor_tenant_id UUID, child_tenant_id UUID, oversight_type VARCHAR, is_active BOOLEAN) -- Gobernación → municipios que supervisa\n" +
    "14. public.pae_operators (id UUID, tenant_id UUID, legal_name VARCHAR, nit VARCHAR, contract_number VARCHAR, status VARCHAR)\n" +
    "15. public.pae_inspections (id UUID, tenant_id UUID, operator_id UUID, institution_id UUID, inspection_kind VARCHAR, result VARCHAR, portion_weight_g NUMERIC, temperature_c NUMERIC, hygiene_score INT, inspected_at TIMESTAMP)\n" +
    "    - result: 'conforme', 'conforme_con_observaciones', 'no_conforme', 'pendiente'\n" +
    "16. public.pae_requerimientos (id UUID, tenant_id UUID, source_type VARCHAR, operator_id UUID, severity VARCHAR, status VARCHAR, escalation_level INT, due_date TIMESTAMP, responded_at TIMESTAMP, closed_at TIMESTAMP)\n" +
    "    - status: 'abierto','notificado','en_respuesta','subsanado','incumplido','escalado_sancion','archivado'\n" +
    "17. public.pae_cae_reports (id UUID, committee_id UUID, tenant_id UUID, category VARCHAR, status VARCHAR, requerimiento_id UUID, created_at TIMESTAMP) -- reportes ciudadanos (Comité de Alimentación Escolar)\n" +
    "18. public.pae_sanctions (id UUID, operator_id UUID, tenant_id UUID, sanction_type VARCHAR, amount NUMERIC, status VARCHAR, applied_at TIMESTAMP)\n" +
    "    - sanction_type: 'amonestacion','multa','caducidad'; status: 'propuesta','requerida','aplicada','en_firme','archivada'\n\n" +
    "Reglas de Respuesta:\n" +
    "- Si la pregunta se puede responder mediante base de datos, genera tu [SQL]...[/SQL] y espera a que el backend retorne la respuesta.\n" +
    "- Responde con lenguaje profesional, empático y en español.\n" +
    "- Estiliza tus respuestas con Markdown avanzado: negritas, listas y tablas elegantes para resumir la información.";
}

function buildPrompt(systemPrompt: string, message: string, history: ChatMessage[]): string {
  let prompt = `System:\n${systemPrompt}\n\nHistorial de Chat:\n`;
  for (const chat of history) {
    prompt += `${chat.role === "user" ? "Usuario" : "Asistente"}: ${chat.content}\n`;
  }
  prompt += `Usuario: ${message}\nAsistente:`;
  return prompt;
}

function isSqlSafe(sql: string): boolean {
  if (!/^\s*SELECT\b/i.test(sql)) return false;
  const blacklist = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "REPLACE", "CREATE", "GRANT", "REVOKE", "INTO", "OUTFILE", "DUMPFILE"];
  return !blacklist.some((kw) => new RegExp(`\\b${kw}\\b`, "i").test(sql));
}

async function callGemini(apiKey: string, model: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    signal: AbortSignal.timeout(30_000)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (HTTP ${response.status}): ${errText}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const candidates = data?.candidates as Array<Record<string, unknown>> | undefined;
  const text = (candidates?.[0]?.content as Record<string, unknown> | undefined)
    ?.parts as Array<Record<string, unknown>> | undefined;
  return String(text?.[0]?.text ?? "Disculpas, no pude obtener respuesta de Gemini.");
}

export function createAiChatRouter(env: AppEnv, pool?: Pool): Router {
  const router = Router();

  router.post("/api/v1/ai-chat", asyncHandler(async (req, res) => {
    if (!env.AI_API_KEY) {
      return sendError(res, 503, "AI_CHAT_NOT_CONFIGURED", "La API key de Gemini no está configurada en el servidor.", req.correlationId);
    }

    const parsed = aiChatSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_AI_CHAT_REQUEST", "El campo 'message' es requerido.", req.correlationId);
    }

    const { message, history } = parsed.data;
    const apiKey = env.AI_API_KEY;
    const model = env.AI_MODEL || "gemini-1.5-flash";
    const systemPrompt = buildSystemPrompt();

    try {
      const firstPrompt = buildPrompt(systemPrompt, message, history);
      const firstResponse = await callGemini(apiKey, model, firstPrompt);

      const sqlMatch = /\[SQL\]([\s\S]*?)\[\/SQL\]/i.exec(firstResponse);
      if (sqlMatch && pool) {
        const sqlQuery = sqlMatch[1].trim();

        if (!isSqlSafe(sqlQuery)) {
          const newHistory: ChatMessage[] = [
            ...history,
            { role: "user", content: message },
            { role: "assistant", content: firstResponse }
          ];
          const prompt2 = buildPrompt(systemPrompt, "System: Consulta SQL rechazada por seguridad. Solo se permiten comandos SELECT de solo lectura.", newHistory);
          const response2 = await callGemini(apiKey, model, prompt2);
          return sendSuccess(res, { response: response2, sqlExecuted: sqlQuery, sqlError: "Consulta insegura rechazada." });
        }

        try {
          const result = await pool.query(sqlQuery);
          const newHistory: ChatMessage[] = [
            ...history,
            { role: "user", content: message },
            { role: "assistant", content: firstResponse }
          ];
          const feedback = `System: El resultado de la consulta SQL ejecutada es: ${JSON.stringify(result.rows)}. Formula la respuesta final basándote en este resultado.`;
          const prompt2 = buildPrompt(systemPrompt, feedback, newHistory);
          const response2 = await callGemini(apiKey, model, prompt2);
          return sendSuccess(res, { response: response2, sqlExecuted: sqlQuery, sqlResult: result.rows });
        } catch (sqlErr) {
          const errorMsg = sqlErr instanceof Error ? sqlErr.message : String(sqlErr);
          const newHistory: ChatMessage[] = [
            ...history,
            { role: "user", content: message },
            { role: "assistant", content: firstResponse }
          ];
          const feedback = `System: La consulta SQL falló con el error: ${errorMsg}. Por favor, corrige la consulta o explica la limitación al usuario.`;
          const prompt2 = buildPrompt(systemPrompt, feedback, newHistory);
          const response2 = await callGemini(apiKey, model, prompt2);
          return sendSuccess(res, { response: response2, sqlExecuted: sqlQuery, sqlError: errorMsg });
        }
      }

      return sendSuccess(res, { response: firstResponse, sqlExecuted: null, sqlResult: null });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error al procesar la solicitud de AI.";
      return sendError(res, 502, "AI_CHAT_FAILED", msg, req.correlationId);
    }
  }));

  return router;
}
