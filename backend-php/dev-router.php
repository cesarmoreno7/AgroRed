<?php
declare(strict_types=1);

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$publicPath = __DIR__ . '/public';
$requestedFile = realpath($publicPath . $uri);

if ($requestedFile !== false && str_starts_with($requestedFile, realpath($publicPath) ?: $publicPath) && is_file($requestedFile)) {
    return false;
}

require $publicPath . '/index.php';
