<?php
declare(strict_types=1);

namespace Agrored\Modules\Catalog;

use Agrored\Http\Response;
use Agrored\Http\Router;
use Agrored\Support\ServiceCatalog;

final class CatalogModule
{
    public static function register(Router $router): void
    {
        $router->get('/api/v1/catalog/services', static function (): void {
            Response::success(ServiceCatalog::all());
        });
    }
}
