<?php
declare(strict_types=1);

namespace Agrored\Support;

final class ServiceCatalog
{
    public static function all(): array
    {
        return [
            [
                'key' => 'users',
                'name' => 'user-service',
                'description' => 'Autenticacion, autorizacion y perfiles de actores del ecosistema.',
                'pathPrefix' => '/api/v1/users',
                'migrationStatus' => 'implemented',
            ],
            [
                'key' => 'producers',
                'name' => 'producer-service',
                'description' => 'Registro y perfil productivo de productores rurales.',
                'pathPrefix' => '/api/v1/producers',
                'migrationStatus' => 'implemented',
            ],
            [
                'key' => 'offers',
                'name' => 'offer-service',
                'description' => 'Oferta alimentaria disponible por territorio y productor.',
                'pathPrefix' => '/api/v1/offers',
                'migrationStatus' => 'implemented',
            ],
            [
                'key' => 'rescues',
                'name' => 'rescue-service',
                'description' => 'Gestion de excedentes y rescate alimentario.',
                'pathPrefix' => '/api/v1/rescues',
                'migrationStatus' => 'implemented',
            ],
            [
                'key' => 'demands',
                'name' => 'demand-service',
                'description' => 'Demanda institucional de comedores y programas alimentarios.',
                'pathPrefix' => '/api/v1/demands',
                'migrationStatus' => 'implemented',
            ],
            [
                'key' => 'inventory',
                'name' => 'inventory-service',
                'description' => 'Inventario y trazabilidad operativa.',
                'pathPrefix' => '/api/v1/inventory',
                'migrationStatus' => 'implemented',
            ],
            [
                'key' => 'logistics',
                'name' => 'logistics-service',
                'description' => 'Rutas, entregas y seguimiento logistico.',
                'pathPrefix' => '/api/v1/logistics',
                'migrationStatus' => 'implemented',
            ],
            [
                'key' => 'incidents',
                'name' => 'incident-service',
                'description' => 'Incidencias urbanas y rurales georreferenciadas.',
                'pathPrefix' => '/api/v1/incidents',
                'migrationStatus' => 'implemented',
            ],
            [
                'key' => 'analytics',
                'name' => 'analytics-service',
                'description' => 'Indicadores, observatorio y base para IRAT.',
                'pathPrefix' => '/api/v1/analytics',
                'migrationStatus' => 'implemented',
            ],
            [
                'key' => 'notifications',
                'name' => 'notification-service',
                'description' => 'Notificaciones transaccionales y alertas del ecosistema.',
                'pathPrefix' => '/api/v1/notifications',
                'migrationStatus' => 'implemented',
            ],
            [
                'key' => 'ml',
                'name' => 'ml-service',
                'description' => 'Apoyo heuristico a decision territorial y operacional.',
                'pathPrefix' => '/api/v1/ml',
                'migrationStatus' => 'planned',
            ],
            [
                'key' => 'automation',
                'name' => 'automation-service',
                'description' => 'Orquestacion operativa y corridas automatizadas persistidas.',
                'pathPrefix' => '/api/v1/automation',
                'migrationStatus' => 'planned',
            ],
            [
                'key' => 'auctions',
                'name' => 'auction-service',
                'description' => 'Subastas de excedentes alimentarios con cierre suave y modelo holandes.',
                'pathPrefix' => '/api/v1/auctions',
                'migrationStatus' => 'planned',
            ],
        ];
    }
}
