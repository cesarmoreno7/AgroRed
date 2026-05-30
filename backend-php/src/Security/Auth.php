<?php
declare(strict_types=1);

namespace Agrored\Security;

use Agrored\Http\Request;
use Agrored\Http\Response;
use Agrored\Support\RedisClient;
use Throwable;

final class Auth
{
    private static ?RedisClient $redis = null;

    public static function setRedis(?RedisClient $redis): void
    {
        self::$redis = $redis;
    }

    public static function getRedis(): ?RedisClient
    {
        return self::$redis;
    }

    public static function requireUser(Request $request, JwtService $jwt): array
    {
        $token = $request->bearerToken();
        if ($token === null || $token === '') {
            Response::error(401, 'AUTH_REQUIRED', 'Se requiere token Bearer.');
        }

        // Check if blacklisted in Redis
        if (self::isTokenBlacklisted($token)) {
            Response::error(401, 'INVALID_TOKEN', 'Token invalido o expirado (cerrado).');
        }

        $claims = $jwt->verify($token);
        if ($claims === null) {
            Response::error(401, 'INVALID_TOKEN', 'Token invalido o expirado.');
        }

        return $claims;
    }

    public static function requireRoles(Request $request, JwtService $jwt, array $allowedRoles): array
    {
        $claims = self::requireUser($request, $jwt);
        $role = (string) ($claims['role'] ?? '');

        if (!in_array($role, $allowedRoles, true)) {
            Response::error(403, 'FORBIDDEN', 'No tiene permisos para ejecutar esta accion.');
        }

        return $claims;
    }

    public static function checkRateLimit(string $key, int $maxRequests, int $windowSeconds): void
    {
        if (self::$redis === null) {
            return; // Gracefully degrade if Redis is not configured
        }

        try {
            $redisKey = "rate_limit:{$key}";
            $current = self::$redis->get($redisKey);

            if ($current !== null && (int) $current >= $maxRequests) {
                Response::error(429, 'TOO_MANY_REQUESTS', 'Limite de peticiones excedido. Intente mas tarde.');
            }

            if ($current === null) {
                self::$redis->set($redisKey, '1', $windowSeconds);
            } else {
                self::$redis->incr($redisKey);
            }
        } catch (Throwable) {
            // Graceful degradation on Redis socket failures
        }
    }

    public static function isTokenBlacklisted(string $token): bool
    {
        if (self::$redis === null) {
            return false;
        }

        try {
            $tokenHash = md5($token);
            return self::$redis->get("blacklist:{$tokenHash}") !== null;
        } catch (Throwable) {
            return false;
        }
    }
}
