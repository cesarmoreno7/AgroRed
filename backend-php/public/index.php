<?php
declare(strict_types=1);

use Agrored\Database\Database;
use Agrored\Http\Request;
use Agrored\Http\Response;
use Agrored\Http\Router;
use Agrored\Modules\Analytics\AnalyticsModule;
use Agrored\Modules\Catalog\CatalogModule;
use Agrored\Modules\Demands\DemandModule;
use Agrored\Modules\Health\HealthModule;
use Agrored\Modules\Incidents\IncidentModule;
use Agrored\Modules\Inventory\InventoryModule;
use Agrored\Modules\Logistics\LogisticsModule;
use Agrored\Modules\Notifications\NotificationModule;
use Agrored\Modules\Offers\OfferModule;
use Agrored\Modules\Producers\ProducerModule;
use Agrored\Modules\Rescues\RescueModule;
use Agrored\Modules\Auctions\AuctionModule;
use Agrored\Modules\AiChat\AiChatModule;
use Agrored\Modules\Automation\AutomationModule;
use Agrored\Modules\Locations\LocationModule;
use Agrored\Modules\Ml\MlModule;
use Agrored\Modules\Users\UserModule;
use Agrored\Security\Auth;
use Agrored\Security\JwtService;
use Agrored\Support\Env;
use Agrored\Support\RedisClient;

require dirname(__DIR__) . '/src/bootstrap.php';

$rootPath = dirname(__DIR__, 2);
$env = Env::load($rootPath . '/.env');

$allowedOrigins = array_values(array_filter(array_map(
    static fn (string $origin): string => trim($origin),
    explode(',', (string) ($env['API_GATEWAY_CORS_ORIGIN'] ?? '*'))
)));
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? null;

if ($requestOrigin !== null && ($allowedOrigins === ['*'] || in_array($requestOrigin, $allowedOrigins, true))) {
    header('Access-Control-Allow-Origin: ' . $requestOrigin);
    header('Vary: Origin');
} elseif ($allowedOrigins === ['*']) {
    header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Tenant-Id');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$database = new Database($env);
$jwt = new JwtService(
    (string) ($env['JWT_SECRET'] ?? 'change_me_in_production_min_32_chars!!'),
    (string) ($env['JWT_EXPIRES_IN'] ?? '8h')
);
$redis = new RedisClient((string) ($env['REDIS_URL'] ?? 'redis://localhost:6379'));
Auth::setRedis($redis);

$router = new Router();


// Ruta de bienvenida para la raíz
$welcomeHandler = static function () {
    echo json_encode([
        'status' => 'ok',
        'message' => 'Backend PHP AgroRed activo',
        'timestamp' => date(DATE_ATOM),
        'debug' => [
            'REQUEST_URI' => $_SERVER['REQUEST_URI'] ?? null,
            'SCRIPT_NAME' => $_SERVER['SCRIPT_NAME'] ?? null,
            'PATH_INFO' => $_SERVER['PATH_INFO'] ?? null,
            'REQUEST_METHOD' => $_SERVER['REQUEST_METHOD'] ?? null
        ]
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
};
$router->get('/', $welcomeHandler);
$router->get('/index.php', $welcomeHandler);
$router->get('', $welcomeHandler);
$router->get('/agrored', $welcomeHandler);

HealthModule::register($router, $database);
CatalogModule::register($router);
LocationModule::register($router, $database);
UserModule::register($router, $database, $jwt, $redis);
ProducerModule::register($router, $database);
OfferModule::register($router, $database);
RescueModule::register($router, $database);
DemandModule::register($router, $database);
InventoryModule::register($router, $database);
AnalyticsModule::register($router, $database);
LogisticsModule::register($router, $database);
IncidentModule::register($router, $database);
NotificationModule::register($router, $database);
AuctionModule::register($router, $database);
MlModule::register($router, $database);
AutomationModule::register($router, $database);
AiChatModule::register($router, $database, $jwt, $env);

$request = Request::fromGlobals();

try {
    if (!$router->dispatch($request)) {
        Response::error(404, 'RESOURCE_NOT_FOUND', 'Ruta no configurada en backend PHP.');
    }
} catch (Throwable $error) {
    Response::error(
        500,
        'INTERNAL_SERVER_ERROR',
        'Error interno del backend PHP.',
        ['message' => $error->getMessage()]
    );
}
