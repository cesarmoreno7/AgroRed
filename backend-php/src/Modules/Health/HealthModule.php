<?php
declare(strict_types=1);

namespace Agrored\Modules\Health;

use Agrored\Database\Database;
use Agrored\Http\Response;
use Agrored\Http\Router;
use Agrored\Support\ServiceCatalog;
use Throwable;

final class HealthModule
{
    public static function register(Router $router, Database $database): void
    {
        $router->get('/health', static function () use ($database): void {
            $databaseStatus = 'ok';
            $postgis = false;
            $haversine = false;
            $spatialRelations = [];

            try {
                $database->scalar('SELECT 1');
                $postgis = $database->hasPostgis();
                $haversine = $database->hasFunction('haversine_km');
                $spatialRelations = [
                    'v_mapa_productores' => $database->relationExists('public.v_mapa_productores') ? 'ok' : 'missing',
                    'v_mapa_ofertas' => $database->relationExists('public.v_mapa_ofertas') ? 'ok' : 'missing',
                    'v_mapa_comedores' => $database->relationExists('public.v_mapa_comedores') ? 'ok' : 'missing',
                    'v_mapa_recursos' => $database->relationExists('public.v_mapa_recursos') ? 'ok' : 'missing',
                    'geofence_zones' => $database->relationExists('public.geofence_zones') ? 'ok' : 'missing',
                ];
            } catch (Throwable) {
                $databaseStatus = 'unavailable';
            }

            $implementedModules = array_values(array_filter(
                ServiceCatalog::all(),
                static fn (array $service): bool => ($service['migrationStatus'] ?? 'planned') === 'implemented'
            ));

            $status = $databaseStatus === 'ok' ? 'ok' : 'degraded';

            Response::success(
                [
                    'service' => 'agrored-php-backend',
                    'runtime' => 'php',
                    'status' => $status,
                    'timestamp' => gmdate(DATE_ATOM),
                    'phpVersion' => PHP_VERSION,
                    'implementedModules' => count($implementedModules),
                    'dependencies' => [
                        'postgres' => $databaseStatus,
                        'postgis' => $postgis ? 'ok' : 'not_installed',
                        'haversine_km' => $haversine ? 'ok' : 'missing',
                    ],
                    'spatial' => [
                        'engine' => $postgis ? 'postgis' : ($haversine ? 'postgres_haversine' : 'unavailable'),
                        'relations' => $spatialRelations,
                    ],
                ],
                $status === 'ok' ? 200 : 503
            );
        });
    }
}
