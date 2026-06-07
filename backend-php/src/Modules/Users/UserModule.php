<?php
declare(strict_types=1);

namespace Agrored\Modules\Users;

use Agrored\Database\Database;
use Agrored\Http\Request;
use Agrored\Http\Response;
use Agrored\Http\Router;
use Agrored\Security\Auth;
use Agrored\Security\JwtService;
use Agrored\Support\RedisClient;
use Agrored\Support\Uuid;
use RuntimeException;

final class UserModule
{
    private const USER_ROLES = [
        'PRODUCER',
        'OPERATOR',
        'MUNICIPALITY',
        'TERRITORIAL_MANAGER',
        'ADMIN',
        'SUPERADMIN',
    ];

    private const MODULE_ACCESS = [
        'analytics-service' => ['ADMIN', 'TERRITORIAL_MANAGER', 'SUPERADMIN'],
        'api-gateway' => ['ADMIN', 'SUPERADMIN'],
        'automation-service' => ['ADMIN', 'OPERATOR', 'SUPERADMIN'],
        'demand-service' => ['OPERATOR', 'MUNICIPALITY', 'SUPERADMIN'],
        'incident-service' => ['MUNICIPALITY', 'TERRITORIAL_MANAGER', 'SUPERADMIN'],
        'inventory-service' => ['OPERATOR', 'MUNICIPALITY', 'SUPERADMIN'],
        'logistics-service' => ['OPERATOR', 'MUNICIPALITY', 'TERRITORIAL_MANAGER', 'SUPERADMIN'],
        'ml-service' => ['ADMIN', 'SUPERADMIN'],
        'notification-service' => ['ADMIN', 'OPERATOR', 'SUPERADMIN'],
        'offer-service' => ['OPERATOR', 'MUNICIPALITY', 'SUPERADMIN'],
        'producer-service' => ['PRODUCER', 'ADMIN', 'SUPERADMIN'],
        'rescue-service' => ['PRODUCER', 'MUNICIPALITY', 'SUPERADMIN'],
        'auction-service' => ['PRODUCER', 'OPERATOR', 'MUNICIPALITY', 'TERRITORIAL_MANAGER', 'ADMIN', 'SUPERADMIN'],
        'user-service' => ['ADMIN', 'SUPERADMIN'],
        'web-dashboard' => ['ADMIN', 'OPERATOR', 'MUNICIPALITY', 'TERRITORIAL_MANAGER', 'PRODUCER', 'SUPERADMIN'],
        'ai-copilot' => ['ADMIN', 'SUPERADMIN'], // Copiloto IA sin restricciones para SUPERADMIN
    ];

    public static function register(Router $router, Database $database, JwtService $jwt, ?RedisClient $redis = null): void
    {
        $router->post('/api/v1/users/register', static function (Request $request) use ($database): void {
            // Apply IP Rate Limiting (10 requests per minute)
            $ip = $request->header('x-forwarded-for') ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            $ipKey = md5($ip . ':/api/v1/users/register');
            Auth::checkRateLimit("auth:register:{$ipKey}", 10, 60);

            $payload = $request->body();
            $tenantKey = trim((string) ($payload['tenantId'] ?? ''));
            $email = strtolower(trim((string) ($payload['email'] ?? '')));
            $fullName = trim((string) ($payload['fullName'] ?? ''));
            $role = strtoupper(trim((string) ($payload['role'] ?? '')));
            $password = (string) ($payload['password'] ?? '');

            if (
                $tenantKey === '' ||
                filter_var($email, FILTER_VALIDATE_EMAIL) === false ||
                strlen($fullName) < 3 ||
                !in_array($role, self::USER_ROLES, true) ||
                strlen($password) < 8
            ) {
                Response::error(400, 'INVALID_USER_PAYLOAD', 'Payload invalido para registro de usuario.');
            }

            if (self::findByEmail($database, $email) !== null) {
                Response::error(409, 'USER_EMAIL_ALREADY_EXISTS', 'El correo ya existe en el sistema.');
            }

            try {
                $tenantId = self::resolveTenantId($database, $tenantKey);
            } catch (RuntimeException $error) {
                if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                    Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                }
                throw $error;
            }

            $userId = Uuid::v4();
            $database->execute(
                'INSERT INTO public.users (id, tenant_id, email, full_name, role, password_hash)
                 VALUES (:id, :tenant_id, :email, :full_name, :role, :password_hash)',
                [
                    'id' => $userId,
                    'tenant_id' => $tenantId,
                    'email' => $email,
                    'full_name' => $fullName,
                    'role' => $role,
                    'password_hash' => password_hash($password, PASSWORD_BCRYPT),
                ]
            );

            $user = self::findById($database, $userId);
            if ($user === null) {
                Response::error(500, 'USER_REGISTRATION_FAILED', 'No fue posible registrar el usuario.');
            }

            Response::success(self::toPublicUser($user), 201);
        });

        $router->post('/api/v1/users/login', static function (Request $request) use ($database, $jwt): void {
            // Apply IP Rate Limiting (10 requests per minute)
            $ip = $request->header('x-forwarded-for') ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            $ipKey = md5($ip . ':/api/v1/users/login');
            Auth::checkRateLimit("auth:login:{$ipKey}", 10, 60);

            $payload = $request->body();
            $email = strtolower(trim((string) ($payload['email'] ?? '')));
            $password = (string) ($payload['password'] ?? '');

            if (filter_var($email, FILTER_VALIDATE_EMAIL) === false || $password === '') {
                Response::error(400, 'INVALID_LOGIN_PAYLOAD', 'Payload invalido para inicio de sesion.');
            }

            $user = self::findByEmail($database, $email);
            if ($user === null || !password_verify($password, (string) ($user['password_hash'] ?? ''))) {
                Response::error(401, 'INVALID_CREDENTIALS', 'Credenciales invalidas.');
            }

            $publicUser = self::toPublicUser($user);
            $token = $jwt->issue([
                'sub' => $publicUser['id'],
                'tenantId' => $publicUser['tenantId'],
                'email' => $publicUser['email'],
                'fullName' => $publicUser['fullName'],
                'role' => $publicUser['role'],
            ]);

            $modules = [];
            foreach (self::MODULE_ACCESS as $module => $roles) {
                if (in_array($publicUser['role'], $roles, true)) {
                    $modules[] = $module;
                }
            }

            Response::success([
                'token' => $token,
                'user' => $publicUser,
                'modules' => $modules,
            ]);
        });

        $router->post('/api/v1/users/logout', static function (Request $request) use ($jwt, $redis): void {
            $token = $request->bearerToken();
            if ($token !== null && $token !== '') {
                $claims = $jwt->verify($token);
                if ($claims !== null && $redis !== null) {
                    $tokenHash = md5($token);
                    $exp = isset($claims['exp']) ? (int) $claims['exp'] : time() + 8 * 3600;
                    $ttl = max(1, $exp - time());
                    $redis->set("blacklist:{$tokenHash}", '1', $ttl);
                }
            }
            Response::success(['message' => 'Sesion cerrada exitosamente.']);
        });

        $router->get('/api/v1/users', static function (Request $request) use ($database, $jwt): void {
            Auth::requireRoles($request, $jwt, ['ADMIN']);

            $page = max(1, (int) ($request->query('page', 1) ?? 1));
            $limit = min(100, max(1, (int) ($request->query('limit', 20) ?? 20)));
            $tenantHeader = trim((string) ($request->header('x-tenant-id', '') ?? ''));

            $tenantId = null;
            if ($tenantHeader !== '') {
                try {
                    $tenantId = self::resolveTenantId($database, $tenantHeader);
                } catch (RuntimeException $error) {
                    if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                        Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                    }
                    throw $error;
                }
            }

            $where = 'deleted_at IS NULL';
            $params = [];
            if ($tenantId !== null) {
                $where .= ' AND tenant_id = :tenant_id';
                $params['tenant_id'] = $tenantId;
            }

            $total = (int) $database->scalar('SELECT COUNT(*) FROM public.users WHERE ' . $where, $params);
            $rows = $database->all(
                'SELECT id, tenant_id, email, full_name, role, created_at
                 FROM public.users
                 WHERE ' . $where . '
                 ORDER BY created_at DESC
                 LIMIT :limit OFFSET :offset',
                array_merge($params, [
                    'limit' => $limit,
                    'offset' => ($page - 1) * $limit,
                ])
            );

            Response::paginated(
                array_map([self::class, 'toPublicUser'], $rows),
                ['total' => $total, 'page' => $page, 'limit' => $limit]
            );
        });

        $router->get('/api/v1/users/{id}', static function (Request $request) use ($database, $jwt): void {
            Auth::requireRoles($request, $jwt, ['ADMIN']);

            $user = self::findById($database, (string) $request->route('id'));
            if ($user === null) {
                Response::error(404, 'USER_NOT_FOUND', 'Usuario no encontrado.');
            }

            $tenantHeader = trim((string) ($request->header('x-tenant-id', '') ?? ''));
            if ($tenantHeader !== '') {
                try {
                    $tenantId = self::resolveTenantId($database, $tenantHeader);
                } catch (RuntimeException $error) {
                    if ($error->getMessage() === 'TENANT_NOT_FOUND') {
                        Response::error(404, 'TENANT_NOT_FOUND', 'Municipio o tenant no encontrado.');
                    }
                    throw $error;
                }

                if (($user['tenant_id'] ?? null) !== $tenantId) {
                    Response::error(404, 'USER_NOT_FOUND', 'Usuario no encontrado.');
                }
            }

            Response::success(self::toPublicUser($user));
        });
    }

    private static function findByEmail(Database $database, string $email): ?array
    {
        return $database->one(
            'SELECT id, tenant_id, email, full_name, role, password_hash, created_at
             FROM public.users
             WHERE LOWER(email) = LOWER(:email)
               AND deleted_at IS NULL
             LIMIT 1',
            ['email' => $email]
        );
    }

    private static function findById(Database $database, string $id): ?array
    {
        return $database->one(
            'SELECT id, tenant_id, email, full_name, role, password_hash, created_at
             FROM public.users
             WHERE id = :id
               AND deleted_at IS NULL
             LIMIT 1',
            ['id' => $id]
        );
    }

    private static function resolveTenantId(Database $database, string $tenantKey): string
    {
        $row = $database->one(
            'SELECT id
             FROM public.tenants
             WHERE id::text = :tenant_key OR UPPER(code) = UPPER(:tenant_key)
             LIMIT 1',
            ['tenant_key' => $tenantKey]
        );

        if ($row === null || !isset($row['id'])) {
            throw new RuntimeException('TENANT_NOT_FOUND');
        }

        return (string) $row['id'];
    }

    private static function toPublicUser(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'tenantId' => (string) $row['tenant_id'],
            'email' => (string) $row['email'],
            'fullName' => (string) $row['full_name'],
            'role' => (string) $row['role'],
            'createdAt' => self::toIso($row['created_at'] ?? null),
        ];
    }

    private static function toIso(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (new \DateTimeImmutable((string) $value))->format(DATE_ATOM);
    }
}
