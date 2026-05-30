<?php
declare(strict_types=1);

namespace Agrored\Http;

final class Response
{
    public static function success(mixed $data, int $status = 200): never
    {
        self::emit($status, ['success' => true, 'data' => $data]);
    }

    public static function paginated(array $data, array $meta, int $status = 200): never
    {
        self::emit($status, ['success' => true, 'data' => $data, 'meta' => $meta]);
    }

    public static function error(int $status, string $code, string $message, ?array $details = null): never
    {
        $payload = [
            'success' => false,
            'error' => [
                'code' => $code,
                'message' => $message,
            ],
        ];

        if ($details !== null) {
            $payload['error']['details'] = $details;
        }

        self::emit($status, $payload);
    }

    private static function emit(int $status, array $payload): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
}
