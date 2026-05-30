<?php
declare(strict_types=1);

namespace Agrored\Modules\AiChat;

use Agrored\Database\Database;
use RuntimeException;
use Throwable;

final class AiChatService
{
    private string $provider;
    private string $apiKey;
    private string $model;
    private string $ollamaUrl;
    private Database $database;

    public function __construct(array $env, Database $database)
    {
        $this->provider = strtolower(trim((string) ($env['AI_PROVIDER'] ?? 'gemini')));
        $this->apiKey = trim((string) ($env['AI_API_KEY'] ?? ''));
        $this->model = trim((string) ($env['AI_MODEL'] ?? ''));
        $this->ollamaUrl = trim((string) ($env['AI_OLLAMA_URL'] ?? 'http://localhost:11434'));
        $this->database = $database;

        // Sensible defaults if model is left empty
        if ($this->model === '') {
            $this->model = match ($this->provider) {
                'openai' => 'gpt-4o-mini',
                'claude' => 'claude-3-5-sonnet-20241022',
                'ollama' => 'llama3',
                default => 'gemini-1.5-flash',
            };
        }
    }

    public function chat(string $message, array $history = []): array
    {
        // First step: Call LLM with user message and database metadata schema
        $systemPrompt = $this->buildSystemPrompt();
        $prompt = $this->buildPrompt($systemPrompt, $message, $history);

        $response = $this->callLlm($prompt);

        // Check if there is an SQL query to run
        if (preg_match('/\[SQL\](.*?)\[\/SQL\]/s', $response, $matches) === 1) {
            $sqlQuery = trim($matches[1]);

            // Validate SQL safety (Strict SELECT read-only checks)
            if ($this->isSqlSafe($sqlQuery)) {
                try {
                    $results = $this->database->all($sqlQuery);
                    $resultStr = json_encode($results, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

                    // Call LLM a second time feeding the database output
                    $history[] = ['role' => 'user', 'content' => $message];
                    $history[] = ['role' => 'assistant', 'content' => $response];

                    $systemFeedback = "System: El resultado de la consulta SQL ejecutada es: " . $resultStr . ". Formula la respuesta final basándote en este resultado.";

                    $prompt2 = $this->buildPrompt($systemPrompt, $systemFeedback, $history);
                    $response2 = $this->callLlm($prompt2);

                    return [
                        'response' => $response2,
                        'sqlExecuted' => $sqlQuery,
                        'sqlResult' => $results,
                    ];
                } catch (Throwable $e) {
                    // Feed database error back to LLM to let it fix or explain the error
                    $history[] = ['role' => 'user', 'content' => $message];
                    $history[] = ['role' => 'assistant', 'content' => $response];

                    $systemFeedback = "System: La consulta SQL falló con el error: " . $e->getMessage() . ". Por favor, corrige la consulta o explica la limitación al usuario.";

                    $prompt2 = $this->buildPrompt($systemPrompt, $systemFeedback, $history);
                    $response2 = $this->callLlm($prompt2);

                    return [
                        'response' => $response2,
                        'sqlExecuted' => $sqlQuery,
                        'sqlError' => $e->getMessage(),
                    ];
                }
            } else {
                // SQL rejected
                $history[] = ['role' => 'user', 'content' => $message];
                $history[] = ['role' => 'assistant', 'content' => $response];

                $systemFeedback = "System: Consulta SQL rechazada por seguridad. Solo se permiten comandos SELECT de solo lectura.";

                $prompt2 = $this->buildPrompt($systemPrompt, $systemFeedback, $history);
                $response2 = $this->callLlm($prompt2);

                return [
                    'response' => $response2,
                    'sqlExecuted' => $sqlQuery,
                    'sqlError' => 'Consulta insegura rechazada por el backend.',
                ];
            }
        }

        return [
            'response' => $response,
            'sqlExecuted' => null,
            'sqlResult' => null,
        ];
    }

    private function isSqlSafe(string $sql): bool
    {
        // Must start with SELECT
        if (!preg_match('/^\s*SELECT\b/i', $sql)) {
            return false;
        }

        // Blacklist destructive or mutative commands
        $blacklist = [
            'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE',
            'REPLACE', 'CREATE', 'GRANT', 'REVOKE', 'INTO', 'OUTFILE', 'DUMPFILE'
        ];

        foreach ($blacklist as $keyword) {
            if (preg_match('/\b' . $keyword . '\b/i', $sql)) {
                return false;
            }
        }

        return true;
    }

    private function buildSystemPrompt(): string
    {
        return "Eres AgroRed Copilot, un asistente analítico inteligente para el Administrador del Prestador del ecosistema digital AgroRed en Colombia.\n" .
               "Tu objetivo es ayudar al administrador a extraer estadísticas y métricas del sistema directamente de la base de datos en tiempo real.\n\n" .
               "Instrucciones de Consulta de Base de Datos:\n" .
               "- Si necesitas consultar datos para responder, genera una única consulta SQL dentro de un bloque [SQL]consulta[/SQL]. El backend de PHP la ejecutará automáticamente y te devolverá el resultado en una segunda iteración.\n" .
               "- Genera únicamente consultas SELECT de solo lectura compatibles con PostgreSQL.\n" .
               "- Utiliza nombres calificados de tablas en el esquema 'public'.\n\n" .
               "Esquema de Tablas Clave de AgroRed:\n" .
               "1. public.tenants (id UUID, code VARCHAR, name VARCHAR, department VARCHAR)\n" .
               "2. public.users (id UUID, tenant_id UUID, email VARCHAR, full_name VARCHAR, role VARCHAR, created_at TIMESTAMP)\n" .
               "   - Roles: 'PRODUCER', 'OPERATOR', 'MUNICIPALITY', 'TERRITORIAL_MANAGER', 'ADMIN'\n" .
               "3. public.producers (id UUID, tenant_id UUID, full_name VARCHAR, association_name VARCHAR, latitude DOUBLE, longitude DOUBLE)\n" .
               "4. public.offers (id UUID, tenant_id UUID, producer_id UUID, product_name VARCHAR, quantity NUMERIC, price NUMERIC, unit VARCHAR, status VARCHAR, created_at TIMESTAMP)\n" .
               "   - status: 'published', 'draft', 'expired'\n" .
               "5. public.demands (id UUID, tenant_id UUID, requester_name VARCHAR, product_name VARCHAR, quantity_required NUMERIC, status VARCHAR, created_at TIMESTAMP)\n" .
               "   - status: 'open', 'matched', 'cancelled'\n" .
               "6. public.inventory_items (id UUID, tenant_id UUID, product_name VARCHAR, quantity_on_hand NUMERIC, quantity_reserved NUMERIC, expires_at TIMESTAMP)\n" .
               "7. public.rescues (id UUID, tenant_id UUID, offer_id UUID, status VARCHAR)\n" .
               "   - status: 'scheduled', 'completed', 'cancelled'\n" .
               "8. public.logistics_orders (id UUID, tenant_id UUID, status VARCHAR, total_weight_kg NUMERIC, distance_km NUMERIC, duration_min NUMERIC)\n" .
               "9. public.incidents (id UUID, tenant_id UUID, title VARCHAR, status VARCHAR, priority VARCHAR, priority_score NUMERIC)\n" .
               "10. public.auctions (id UUID, title VARCHAR, base_price NUMERIC, reserve_price NUMERIC, status VARCHAR, starts_at TIMESTAMP, ends_at TIMESTAMP)\n\n" .
               "Reglas de Respuesta:\n" .
               "- Si la pregunta se puede responder mediante base de datos, genera tu [SQL]...[/SQL] y espera a que el backend retorne la respuesta.\n" .
               "- Responde con lenguaje profesional, empático y en español.\n" .
               "- Estiliza tus respuestas con Markdown avanzado: negritas, listas y tablas elegantes para resumir la información.";
    }

    private function buildPrompt(string $systemPrompt, string $message, array $history): string
    {
        $prompt = "System:\n" . $systemPrompt . "\n\n";
        $prompt .= "Historial de Chat:\n";
        foreach ($history as $chat) {
            $role = $chat['role'] === 'user' ? 'Usuario' : 'Asistente';
            $content = $chat['content'] ?? '';
            $prompt .= "{$role}: {$content}\n";
        }
        $prompt .= "Usuario: {$message}\n";
        $prompt .= "Asistente:";
        return $prompt;
    }

    private function callLlm(string $prompt): string
    {
        return match ($this->provider) {
            'openai' => $this->callOpenAi($prompt),
            'claude' => $this->callClaude($prompt),
            'ollama' => $this->callOllama($prompt),
            default => $this->callGemini($prompt),
        };
    }

    private function callGemini(string $prompt): string
    {
        if ($this->apiKey === '') {
            throw new RuntimeException("API Key de Gemini no configurada en .env.");
        }

        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$this->model}:generateContent?key={$this->apiKey}";

        $payload = [
            'contents' => [
                [
                    'parts' => [
                        ['text' => $prompt]
                    ]
                ]
            ]
        ];

        $res = $this->postJson($url, $payload);
        return (string) ($res['candidates'][0]['content']['parts'][0]['text'] ?? 'Disculpas, no pude obtener respuesta de Gemini.');
    }

    private function callOpenAi(string $prompt): string
    {
        if ($this->apiKey === '') {
            throw new RuntimeException("API Key de OpenAI no configurada en .env.");
        }

        $url = "https://api.openai.com/v1/chat/completions";
        $headers = [
            "Authorization: Bearer {$this->apiKey}"
        ];

        $payload = [
            'model' => $this->model,
            'messages' => [
                ['role' => 'user', 'content' => $prompt]
            ],
            'temperature' => 0.1
        ];

        $res = $this->postJson($url, $payload, $headers);
        return (string) ($res['choices'][0]['message']['content'] ?? 'Disculpas, no pude obtener respuesta de OpenAI.');
    }

    private function callClaude(string $prompt): string
    {
        if ($this->apiKey === '') {
            throw new RuntimeException("API Key de Claude no configurada en .env.");
        }

        $url = "https://api.anthropic.com/v1/messages";
        $headers = [
            "x-api-key: {$this->apiKey}",
            "anthropic-version: 2023-06-01"
        ];

        $payload = [
            'model' => $this->model,
            'max_tokens' => 1500,
            'messages' => [
                ['role' => 'user', 'content' => $prompt]
            ]
        ];

        $res = $this->postJson($url, $payload, $headers);
        return (string) ($res['content'][0]['text'] ?? 'Disculpas, no pude obtener respuesta de Claude.');
    }

    private function callOllama(string $prompt): string
    {
        $url = rtrim($this->ollamaUrl, '/') . '/api/chat';

        $payload = [
            'model' => $this->model,
            'messages' => [
                ['role' => 'user', 'content' => $prompt]
            ],
            'stream' => false
        ];

        $res = $this->postJson($url, $payload);
        return (string) ($res['message']['content'] ?? 'Disculpas, no pude obtener respuesta de Ollama.');
    }

    private function postJson(string $url, array $payload, array $headers = []): array
    {
        $ch = curl_init($url);
        if ($ch === false) {
            throw new RuntimeException("Error inicializando cURL.");
        }

        $jsonData = json_encode($payload);
        $headers[] = 'Content-Type: application/json';

        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonData);
        curl_setopt_array($ch, [
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 45,
            CURLOPT_SSL_VERIFYPEER => false // En local, evitamos problemas de certificados SSL
        ]);

        $output = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if (curl_errno($ch)) {
            $error = curl_error($ch);
            curl_close($ch);
            throw new RuntimeException("Error de conexión cURL: {$error}");
        }

        curl_close($ch);

        if ($httpCode >= 400) {
            throw new RuntimeException("Error de API remota (HTTP {$httpCode}): {$output}");
        }

        $decoded = json_decode((string) $output, true);
        if (!is_array($decoded)) {
            throw new RuntimeException("Error procesando respuesta JSON de la API: {$output}");
        }

        return $decoded;
    }
}
