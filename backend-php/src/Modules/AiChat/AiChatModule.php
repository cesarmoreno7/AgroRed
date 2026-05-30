<?php
declare(strict_types=1);

namespace Agrored\Modules\AiChat;

use Agrored\Database\Database;
use Agrored\Http\Request;
use Agrored\Http\Response;
use Agrored\Http\Router;
use Agrored\Security\Auth;
use Agrored\Security\JwtService;

final class AiChatModule
{
    public static function register(Router $router, Database $database, JwtService $jwt, array $env): void
    {
        $router->post('/api/v1/ai-chat', static function (Request $request) use ($database, $jwt, $env): void {
            // Secure endpoint: only ADMIN or TERRITORIAL_MANAGER can access
            Auth::requireRoles($request, $jwt, ['ADMIN', 'TERRITORIAL_MANAGER']);

            $payload = $request->body();
            $message = trim((string) ($payload['message'] ?? ''));
            $history = $payload['history'] ?? [];

            if ($message === '') {
                Response::error(400, 'INVALID_AIChat_PAYLOAD', 'El mensaje no puede estar vacío.');
            }

            try {
                $service = new AiChatService($env, $database);
                $result = $service->chat($message, $history);
                Response::success($result);
            } catch (\Throwable $e) {
                Response::error(500, 'AIChat_ERROR', $e->getMessage());
            }
        });
    }
}
