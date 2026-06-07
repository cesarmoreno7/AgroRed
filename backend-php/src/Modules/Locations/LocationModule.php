<?php
declare(strict_types=1);

namespace Agrored\Modules\Locations;

use Agrored\Database\Database;
use Agrored\Http\Request;
use Agrored\Http\Response;
use Agrored\Http\Router;
use Agrored\Support\Uuid;
use RuntimeException;

final class LocationModule
{
    public static function register(Router $router, Database $database): void
    {
        // ===================== DEPARTAMENTOS =====================
        
        // Listar departamentos
        $router->get('/api/departamentos', static function (Request $request) use ($database): void {
            $page = max(1, (int) ($request->query('page', 1) ?? 1));
            $limit = min(100, max(1, (int) ($request->query('limit', 50) ?? 50)));
            $search = trim((string) ($request->query('search', '') ?? ''));
            
            $where = '1=1';
            $params = [];
            if ($search !== '') {
                $where .= ' AND (nombre ILIKE :search OR codigo_dane ILIKE :search)';
                $params['search'] = '%' . $search . '%';
            }
            
            $total = (int) $database->scalar(
                'SELECT COUNT(*) FROM departamentos WHERE ' . $where,
                $params
            );
            
            $rows = $database->all(
                'SELECT id, codigo_dane, nombre, created_at
                 FROM departamentos
                 WHERE ' . $where . '
                 ORDER BY nombre ASC
                 LIMIT :limit OFFSET :offset',
                array_merge($params, [
                    'limit' => $limit,
                    'offset' => ($page - 1) * $limit,
                ])
            );
            
            Response::paginated(
                array_map([self::class, 'toDepartamentoResponse'], $rows),
                ['total' => $total, 'page' => $page, 'limit' => $limit]
            );
        });
        
        // Obtener un departamento por ID
        $router->get('/api/departamentos/{id}', static function (Request $request) use ($database): void {
            $row = self::findDepartamentoById($database, (string) $request->route('id'));
            if ($row === null) {
                Response::error(404, 'DEPARTAMENTO_NOT_FOUND', 'Departamento no encontrado.');
            }
            Response::success(self::toDepartamentoResponse($row));
        });
        
        // Crear departamento
        $router->post('/api/departamentos', static function (Request $request) use ($database): void {
            $payload = $request->body();
            
            $codigoDane = trim((string) ($payload['codigoDane'] ?? ''));
            $nombre = trim((string) ($payload['nombre'] ?? ''));
            
            if ($codigoDane === '' || strlen($nombre) < 2) {
                Response::error(400, 'INVALID_DEPARTAMENTO_PAYLOAD', 'Código DANE y nombre son obligatorios.');
            }
            
            // Verificar duplicado
            $existing = $database->one(
                'SELECT id FROM departamentos WHERE codigo_dane = :codigo_dane OR UPPER(nombre) = UPPER(:nombre)',
                ['codigo_dane' => $codigoDane, 'nombre' => $nombre]
            );
            if ($existing !== null) {
                Response::error(409, 'DEPARTAMENTO_ALREADY_EXISTS', 'Ya existe un departamento con ese código o nombre.');
            }
            
            $id = Uuid::v4();
            $database->execute(
                'INSERT INTO departamentos (id, codigo_dane, nombre, created_at)
                 VALUES (:id, :codigo_dane, :nombre, NOW())',
                [
                    'id' => $id,
                    'codigo_dane' => $codigoDane,
                    'nombre' => $nombre,
                ]
            );
            
            $row = self::findDepartamentoById($database, $id);
            Response::success(self::toDepartamentoResponse($row), 201);
        });
        
        // Actualizar departamento
        $router->put('/api/departamentos/{id}', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');
            $row = self::findDepartamentoById($database, $id);
            if ($row === null) {
                Response::error(404, 'DEPARTAMENTO_NOT_FOUND', 'Departamento no encontrado.');
            }
            
            $payload = $request->body();
            $codigoDane = trim((string) ($payload['codigoDane'] ?? $row['codigo_dane']));
            $nombre = trim((string) ($payload['nombre'] ?? $row['nombre']));
            
            if ($codigoDane === '' || strlen($nombre) < 2) {
                Response::error(400, 'INVALID_DEPARTAMENTO_PAYLOAD', 'Código DANE y nombre son obligatorios.');
            }
            
            // Verificar duplicado (excluyendo el actual)
            $existing = $database->one(
                'SELECT id FROM departamentos 
                 WHERE (codigo_dane = :codigo_dane OR UPPER(nombre) = UPPER(:nombre))
                 AND id != :id',
                ['codigo_dane' => $codigoDane, 'nombre' => $nombre, 'id' => $id]
            );
            if ($existing !== null) {
                Response::error(409, 'DEPARTAMENTO_ALREADY_EXISTS', 'Ya existe un departamento con ese código o nombre.');
            }
            
            $database->execute(
                'UPDATE departamentos 
                 SET codigo_dane = :codigo_dane, nombre = :nombre, updated_at = NOW()
                 WHERE id = :id',
                [
                    'codigo_dane' => $codigoDane,
                    'nombre' => $nombre,
                    'id' => $id,
                ]
            );
            
            $row = self::findDepartamentoById($database, $id);
            Response::success(self::toDepartamentoResponse($row));
        });
        
        // Eliminar departamento
        $router->delete('/api/departamentos/{id}', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');
            $row = self::findDepartamentoById($database, $id);
            if ($row === null) {
                Response::error(404, 'DEPARTAMENTO_NOT_FOUND', 'Departamento no encontrado.');
            }
            
            // Verificar si tiene municipios asociados
            $muniCount = (int) $database->scalar(
                'SELECT COUNT(*) FROM municipios WHERE departamento_id = :id',
                ['id' => $id]
            );
            if ($muniCount > 0) {
                Response::error(409, 'DEPARTAMENTO_HAS_MUNICIPIOS', 'No se puede eliminar: tiene municipios asociados.');
            }
            
            $database->execute('DELETE FROM departamentos WHERE id = :id', ['id' => $id]);
            Response::success(['message' => 'Departamento eliminado exitosamente.']);
        });
        
        // ===================== MUNICIPIOS =====================
        
        // Listar municipios
        $router->get('/api/municipios', static function (Request $request) use ($database): void {
            $page = max(1, (int) ($request->query('page', 1) ?? 1));
            $limit = min(100, max(1, (int) ($request->query('limit', 50) ?? 50)));
            $search = trim((string) ($request->query('search', '') ?? ''));
            $departamentoId = trim((string) ($request->query('departamentoId', '') ?? ''));
            
            $where = '1=1';
            $params = [];
            if ($search !== '') {
                $where .= ' AND (m.nombre ILIKE :search OR m.codigo_dane ILIKE :search)';
                $params['search'] = '%' . $search . '%';
            }
            if ($departamentoId !== '') {
                $where .= ' AND m.departamento_id = :departamento_id';
                $params['departamento_id'] = $departamentoId;
            }
            
            $total = (int) $database->scalar(
                'SELECT COUNT(*) FROM municipios m WHERE ' . $where,
                $params
            );
            
            $rows = $database->all(
                'SELECT m.id, m.codigo_dane, m.nombre, m.departamento_id, d.nombre as departamento_nombre, m.created_at
                 FROM municipios m
                 INNER JOIN departamentos d ON m.departamento_id = d.id
                 WHERE ' . $where . '
                 ORDER BY m.nombre ASC
                 LIMIT :limit OFFSET :offset',
                array_merge($params, [
                    'limit' => $limit,
                    'offset' => ($page - 1) * $limit,
                ])
            );
            
            Response::paginated(
                array_map([self::class, 'toMunicipioResponse'], $rows),
                ['total' => $total, 'page' => $page, 'limit' => $limit]
            );
        });
        
        // Obtener un municipio por ID
        $router->get('/api/municipios/{id}', static function (Request $request) use ($database): void {
            $row = self::findMunicipioById($database, (string) $request->route('id'));
            if ($row === null) {
                Response::error(404, 'MUNICIPIO_NOT_FOUND', 'Municipio no encontrado.');
            }
            Response::success(self::toMunicipioResponse($row));
        });
        
        // Crear municipio
        $router->post('/api/municipios', static function (Request $request) use ($database): void {
            $payload = $request->body();
            
            $codigoDane = trim((string) ($payload['codigoDane'] ?? ''));
            $nombre = trim((string) ($payload['nombre'] ?? ''));
            $departamentoId = trim((string) ($payload['departamentoId'] ?? ''));
            
            if ($codigoDane === '' || strlen($nombre) < 2 || $departamentoId === '') {
                Response::error(400, 'INVALID_MUNICIPIO_PAYLOAD', 'Código DANE, nombre y departamento son obligatorios.');
            }
            
            // Verificar que el departamento existe
            $dept = self::findDepartamentoById($database, $departamentoId);
            if ($dept === null) {
                Response::error(404, 'DEPARTAMENTO_NOT_FOUND', 'El departamento seleccionado no existe.');
            }
            
            // Verificar duplicado
            $existing = $database->one(
                'SELECT id FROM municipios 
                 WHERE codigo_dane = :codigo_dane 
                 OR (UPPER(nombre) = UPPER(:nombre) AND departamento_id = :departamento_id)',
                ['codigo_dane' => $codigoDane, 'nombre' => $nombre, 'departamento_id' => $departamentoId]
            );
            if ($existing !== null) {
                Response::error(409, 'MUNICIPIO_ALREADY_EXISTS', 'Ya existe un municipio con ese código o nombre en el departamento.');
            }
            
            $id = Uuid::v4();
            $database->execute(
                'INSERT INTO municipios (id, codigo_dane, nombre, departamento_id, created_at)
                 VALUES (:id, :codigo_dane, :nombre, :departamento_id, NOW())',
                [
                    'id' => $id,
                    'codigo_dane' => $codigoDane,
                    'nombre' => $nombre,
                    'departamento_id' => $departamentoId,
                ]
            );
            
            $row = self::findMunicipioById($database, $id);
            Response::success(self::toMunicipioResponse($row), 201);
        });
        
        // Actualizar municipio
        $router->put('/api/municipios/{id}', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');
            $row = self::findMunicipioById($database, $id);
            if ($row === null) {
                Response::error(404, 'MUNICIPIO_NOT_FOUND', 'Municipio no encontrado.');
            }
            
            $payload = $request->body();
            $codigoDane = trim((string) ($payload['codigoDane'] ?? $row['codigo_dane']));
            $nombre = trim((string) ($payload['nombre'] ?? $row['nombre']));
            $departamentoId = trim((string) ($payload['departamentoId'] ?? $row['departamento_id']));
            
            if ($codigoDane === '' || strlen($nombre) < 2 || $departamentoId === '') {
                Response::error(400, 'INVALID_MUNICIPIO_PAYLOAD', 'Código DANE, nombre y departamento son obligatorios.');
            }
            
            // Verificar que el departamento existe
            $dept = self::findDepartamentoById($database, $departamentoId);
            if ($dept === null) {
                Response::error(404, 'DEPARTAMENTO_NOT_FOUND', 'El departamento seleccionado no existe.');
            }
            
            // Verificar duplicado (excluyendo el actual)
            $existing = $database->one(
                'SELECT id FROM municipios 
                 WHERE (codigo_dane = :codigo_dane 
                 OR (UPPER(nombre) = UPPER(:nombre) AND departamento_id = :departamento_id))
                 AND id != :id',
                ['codigo_dane' => $codigoDane, 'nombre' => $nombre, 'departamento_id' => $departamentoId, 'id' => $id]
            );
            if ($existing !== null) {
                Response::error(409, 'MUNICIPIO_ALREADY_EXISTS', 'Ya existe un municipio con ese código o nombre en el departamento.');
            }
            
            $database->execute(
                'UPDATE municipios 
                 SET codigo_dane = :codigo_dane, nombre = :nombre, departamento_id = :departamento_id, updated_at = NOW()
                 WHERE id = :id',
                [
                    'codigo_dane' => $codigoDane,
                    'nombre' => $nombre,
                    'departamento_id' => $departamentoId,
                    'id' => $id,
                ]
            );
            
            $row = self::findMunicipioById($database, $id);
            Response::success(self::toMunicipioResponse($row));
        });
        
        // Eliminar municipio
        $router->delete('/api/municipios/{id}', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');
            $row = self::findMunicipioById($database, $id);
            if ($row === null) {
                Response::error(404, 'MUNICIPIO_NOT_FOUND', 'Municipio no encontrado.');
            }
            
            $database->execute('DELETE FROM municipios WHERE id = :id', ['id' => $id]);
            Response::success(['message' => 'Municipio eliminado exitosamente.']);
        });
        
        // ===================== CORREGIMIENTOS =====================
        
        // Listar corregimientos
        $router->get('/api/corregimientos', static function (Request $request) use ($database): void {
            $page = max(1, (int) ($request->query('page', 1) ?? 1));
            $limit = min(100, max(1, (int) ($request->query('limit', 50) ?? 50)));
            $search = trim((string) ($request->query('search', '') ?? ''));
            $municipioId = trim((string) ($request->query('municipioId', '') ?? ''));
            
            $where = '1=1';
            $params = [];
            if ($search !== '') {
                $where .= ' AND (c.nombre ILIKE :search OR c.codigo_dane ILIKE :search)';
                $params['search'] = '%' . $search . '%';
            }
            if ($municipioId !== '') {
                $where .= ' AND c.municipio_id = :municipio_id';
                $params['municipio_id'] = $municipioId;
            }
            
            $total = (int) $database->scalar(
                'SELECT COUNT(*) FROM corregimientos c WHERE ' . $where,
                $params
            );
            
            $rows = $database->all(
                'SELECT c.id, c.codigo_dane, c.nombre, c.municipio_id, m.nombre as municipio_nombre, c.created_at
                 FROM corregimientos c
                 INNER JOIN municipios m ON c.municipio_id = m.id
                 WHERE ' . $where . '
                 ORDER BY c.nombre ASC
                 LIMIT :limit OFFSET :offset',
                array_merge($params, [
                    'limit' => $limit,
                    'offset' => ($page - 1) * $limit,
                ])
            );
            
            Response::paginated(
                array_map([self::class, 'toCorregimientoResponse'], $rows),
                ['total' => $total, 'page' => $page, 'limit' => $limit]
            );
        });
        
        // Obtener un corregimiento por ID
        $router->get('/api/corregimientos/{id}', static function (Request $request) use ($database): void {
            $row = self::findCorregimientoById($database, (string) $request->route('id'));
            if ($row === null) {
                Response::error(404, 'CORREGIMIENTO_NOT_FOUND', 'Corregimiento no encontrado.');
            }
            Response::success(self::toCorregimientoResponse($row));
        });
        
        // Crear corregimiento
        $router->post('/api/corregimientos', static function (Request $request) use ($database): void {
            $payload = $request->body();
            
            $codigoDane = trim((string) ($payload['codigoDane'] ?? ''));
            $nombre = trim((string) ($payload['nombre'] ?? ''));
            $municipioId = trim((string) ($payload['municipioId'] ?? ''));
            
            if ($codigoDane === '' || strlen($nombre) < 2 || $municipioId === '') {
                Response::error(400, 'INVALID_CORREGIMIENTO_PAYLOAD', 'Código DANE, nombre y municipio son obligatorios.');
            }
            
            // Verificar que el municipio existe
            $muni = self::findMunicipioById($database, $municipioId);
            if ($muni === null) {
                Response::error(404, 'MUNICIPIO_NOT_FOUND', 'El municipio seleccionado no existe.');
            }
            
            // Verificar duplicado
            $existing = $database->one(
                'SELECT id FROM corregimientos 
                 WHERE codigo_dane = :codigo_dane 
                 OR (UPPER(nombre) = UPPER(:nombre) AND municipio_id = :municipio_id)',
                ['codigo_dane' => $codigoDane, 'nombre' => $nombre, 'municipio_id' => $municipioId]
            );
            if ($existing !== null) {
                Response::error(409, 'CORREGIMIENTO_ALREADY_EXISTS', 'Ya existe un corregimiento con ese código o nombre en el municipio.');
            }
            
            $id = Uuid::v4();
            $database->execute(
                'INSERT INTO corregimientos (id, codigo_dane, nombre, municipio_id, created_at)
                 VALUES (:id, :codigo_dane, :nombre, :municipio_id, NOW())',
                [
                    'id' => $id,
                    'codigo_dane' => $codigoDane,
                    'nombre' => $nombre,
                    'municipio_id' => $municipioId,
                ]
            );
            
            $row = self::findCorregimientoById($database, $id);
            Response::success(self::toCorregimientoResponse($row), 201);
        });
        
        // Actualizar corregimiento
        $router->put('/api/corregimientos/{id}', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');
            $row = self::findCorregimientoById($database, $id);
            if ($row === null) {
                Response::error(404, 'CORREGIMIENTO_NOT_FOUND', 'Corregimiento no encontrado.');
            }
            
            $payload = $request->body();
            $codigoDane = trim((string) ($payload['codigoDane'] ?? $row['codigo_dane']));
            $nombre = trim((string) ($payload['nombre'] ?? $row['nombre']));
            $municipioId = trim((string) ($payload['municipioId'] ?? $row['municipio_id']));
            
            if ($codigoDane === '' || strlen($nombre) < 2 || $municipioId === '') {
                Response::error(400, 'INVALID_CORREGIMIENTO_PAYLOAD', 'Código DANE, nombre y municipio son obligatorios.');
            }
            
            // Verificar que el municipio existe
            $muni = self::findMunicipioById($database, $municipioId);
            if ($muni === null) {
                Response::error(404, 'MUNICIPIO_NOT_FOUND', 'El municipio seleccionado no existe.');
            }
            
            // Verificar duplicado (excluyendo el actual)
            $existing = $database->one(
                'SELECT id FROM corregimientos 
                 WHERE (codigo_dane = :codigo_dane 
                 OR (UPPER(nombre) = UPPER(:nombre) AND municipio_id = :municipio_id))
                 AND id != :id',
                ['codigo_dane' => $codigoDane, 'nombre' => $nombre, 'municipio_id' => $municipioId, 'id' => $id]
            );
            if ($existing !== null) {
                Response::error(409, 'CORREGIMIENTO_ALREADY_EXISTS', 'Ya existe un corregimiento con ese código o nombre en el municipio.');
            }
            
            $database->execute(
                'UPDATE corregimientos 
                 SET codigo_dane = :codigo_dane, nombre = :nombre, municipio_id = :municipio_id, updated_at = NOW()
                 WHERE id = :id',
                [
                    'codigo_dane' => $codigoDane,
                    'nombre' => $nombre,
                    'municipio_id' => $municipioId,
                    'id' => $id,
                ]
            );
            
            $row = self::findCorregimientoById($database, $id);
            Response::success(self::toCorregimientoResponse($row));
        });
        
        // Eliminar corregimiento
        $router->delete('/api/corregimientos/{id}', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');
            $row = self::findCorregimientoById($database, $id);
            if ($row === null) {
                Response::error(404, 'CORREGIMIENTO_NOT_FOUND', 'Corregimiento no encontrado.');
            }
            
            $database->execute('DELETE FROM corregimientos WHERE id = :id', ['id' => $id]);
            Response::success(['message' => 'Corregimiento eliminado exitosamente.']);
        });
        
        // ===================== VEREDAS =====================
        
        // Listar veredas
        $router->get('/api/veredas', static function (Request $request) use ($database): void {
            $page = max(1, (int) ($request->query('page', 1) ?? 1));
            $limit = min(100, max(1, (int) ($request->query('limit', 50) ?? 50)));
            $search = trim((string) ($request->query('search', '') ?? ''));
            $municipioId = trim((string) ($request->query('municipioId', '') ?? ''));
            
            $where = '1=1';
            $params = [];
            if ($search !== '') {
                $where .= ' AND (v.nombre ILIKE :search OR v.codigo_dane ILIKE :search)';
                $params['search'] = '%' . $search . '%';
            }
            if ($municipioId !== '') {
                $where .= ' AND v.municipio_id = :municipio_id';
                $params['municipio_id'] = $municipioId;
            }
            
            $total = (int) $database->scalar(
                'SELECT COUNT(*) FROM veredas v WHERE ' . $where,
                $params
            );
            
            $rows = $database->all(
                'SELECT v.id, v.codigo_dane, v.nombre, v.municipio_id, m.nombre as municipio_nombre, v.created_at
                 FROM veredas v
                 INNER JOIN municipios m ON v.municipio_id = m.id
                 WHERE ' . $where . '
                 ORDER BY v.nombre ASC
                 LIMIT :limit OFFSET :offset',
                array_merge($params, [
                    'limit' => $limit,
                    'offset' => ($page - 1) * $limit,
                ])
            );
            
            Response::paginated(
                array_map([self::class, 'toVeredaResponse'], $rows),
                ['total' => $total, 'page' => $page, 'limit' => $limit]
            );
        });
        
        // Obtener una vereda por ID
        $router->get('/api/veredas/{id}', static function (Request $request) use ($database): void {
            $row = self::findVeredaById($database, (string) $request->route('id'));
            if ($row === null) {
                Response::error(404, 'VEREDA_NOT_FOUND', 'Vereda no encontrada.');
            }
            Response::success(self::toVeredaResponse($row));
        });
        
        // Crear vereda
        $router->post('/api/veredas', static function (Request $request) use ($database): void {
            $payload = $request->body();
            
            $codigoDane = trim((string) ($payload['codigoDane'] ?? ''));
            $nombre = trim((string) ($payload['nombre'] ?? ''));
            $municipioId = trim((string) ($payload['municipioId'] ?? ''));
            
            if ($codigoDane === '' || strlen($nombre) < 2 || $municipioId === '') {
                Response::error(400, 'INVALID_VEREDA_PAYLOAD', 'Código DANE, nombre y municipio son obligatorios.');
            }
            
            // Verificar que el municipio existe
            $muni = self::findMunicipioById($database, $municipioId);
            if ($muni === null) {
                Response::error(404, 'MUNICIPIO_NOT_FOUND', 'El municipio seleccionado no existe.');
            }
            
            // Verificar duplicado
            $existing = $database->one(
                'SELECT id FROM veredas 
                 WHERE codigo_dane = :codigo_dane 
                 OR (UPPER(nombre) = UPPER(:nombre) AND municipio_id = :municipio_id)',
                ['codigo_dane' => $codigoDane, 'nombre' => $nombre, 'municipio_id' => $municipioId]
            );
            if ($existing !== null) {
                Response::error(409, 'VEREDA_ALREADY_EXISTS', 'Ya existe una vereda con ese código o nombre en el municipio.');
            }
            
            $id = Uuid::v4();
            $database->execute(
                'INSERT INTO veredas (id, codigo_dane, nombre, municipio_id, created_at)
                 VALUES (:id, :codigo_dane, :nombre, :municipio_id, NOW())',
                [
                    'id' => $id,
                    'codigo_dane' => $codigoDane,
                    'nombre' => $nombre,
                    'municipio_id' => $municipioId,
                ]
            );
            
            $row = self::findVeredaById($database, $id);
            Response::success(self::toVeredaResponse($row), 201);
        });
        
        // Actualizar vereda
        $router->put('/api/veredas/{id}', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');
            $row = self::findVeredaById($database, $id);
            if ($row === null) {
                Response::error(404, 'VEREDA_NOT_FOUND', 'Vereda no encontrada.');
            }
            
            $payload = $request->body();
            $codigoDane = trim((string) ($payload['codigoDane'] ?? $row['codigo_dane']));
            $nombre = trim((string) ($payload['nombre'] ?? $row['nombre']));
            $municipioId = trim((string) ($payload['municipioId'] ?? $row['municipio_id']));
            
            if ($codigoDane === '' || strlen($nombre) < 2 || $municipioId === '') {
                Response::error(400, 'INVALID_VEREDA_PAYLOAD', 'Código DANE, nombre y municipio son obligatorios.');
            }
            
            // Verificar que el municipio existe
            $muni = self::findMunicipioById($database, $municipioId);
            if ($muni === null) {
                Response::error(404, 'MUNICIPIO_NOT_FOUND', 'El municipio seleccionado no existe.');
            }
            
            // Verificar duplicado (excluyendo el actual)
            $existing = $database->one(
                'SELECT id FROM veredas 
                 WHERE (codigo_dane = :codigo_dane 
                 OR (UPPER(nombre) = UPPER(:nombre) AND municipio_id = :municipio_id))
                 AND id != :id',
                ['codigo_dane' => $codigoDane, 'nombre' => $nombre, 'municipio_id' => $municipioId, 'id' => $id]
            );
            if ($existing !== null) {
                Response::error(409, 'VEREDA_ALREADY_EXISTS', 'Ya existe una vereda con ese código o nombre en el municipio.');
            }
            
            $database->execute(
                'UPDATE veredas 
                 SET codigo_dane = :codigo_dane, nombre = :nombre, municipio_id = :municipio_id, updated_at = NOW()
                 WHERE id = :id',
                [
                    'codigo_dane' => $codigoDane,
                    'nombre' => $nombre,
                    'municipio_id' => $municipioId,
                    'id' => $id,
                ]
            );
            
            $row = self::findVeredaById($database, $id);
            Response::success(self::toVeredaResponse($row));
        });
        
        // Eliminar vereda
        $router->delete('/api/veredas/{id}', static function (Request $request) use ($database): void {
            $id = (string) $request->route('id');
            $row = self::findVeredaById($database, $id);
            if ($row === null) {
                Response::error(404, 'VEREDA_NOT_FOUND', 'Vereda no encontrada.');
            }
            
            $database->execute('DELETE FROM veredas WHERE id = :id', ['id' => $id]);
            Response::success(['message' => 'Vereda eliminada exitosamente.']);
        });
    }
    
    private static function findDepartamentoById(Database $database, string $id): ?array
    {
        return $database->one(
            'SELECT id, codigo_dane, nombre, created_at, updated_at
             FROM departamentos
             WHERE id = :id',
            ['id' => $id]
        );
    }
    
    private static function findMunicipioById(Database $database, string $id): ?array
    {
        return $database->one(
            'SELECT m.id, m.codigo_dane, m.nombre, m.departamento_id, d.nombre as departamento_nombre, m.created_at, m.updated_at
             FROM municipios m
             INNER JOIN departamentos d ON m.departamento_id = d.id
             WHERE m.id = :id',
            ['id' => $id]
        );
    }
    
    private static function toDepartamentoResponse(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'codigoDane' => (string) $row['codigo_dane'],
            'nombre' => (string) $row['nombre'],
            'createdAt' => $row['created_at'] ?? null,
            'updatedAt' => $row['updated_at'] ?? null,
        ];
    }
    
    private static function toMunicipioResponse(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'codigoDane' => (string) $row['codigo_dane'],
            'nombre' => (string) $row['nombre'],
            'departamentoId' => (string) $row['departamento_id'],
            'departamentoNombre' => (string) ($row['departamento_nombre'] ?? ''),
            'createdAt' => $row['created_at'] ?? null,
            'updatedAt' => $row['updated_at'] ?? null,
        ];
    }
    
    private static function findCorregimientoById(Database $database, string $id): ?array
    {
        return $database->one(
            'SELECT c.id, c.codigo_dane, c.nombre, c.municipio_id, m.nombre as municipio_nombre, c.created_at, c.updated_at
             FROM corregimientos c
             INNER JOIN municipios m ON c.municipio_id = m.id
             WHERE c.id = :id',
            ['id' => $id]
        );
    }
    
    private static function findVeredaById(Database $database, string $id): ?array
    {
        return $database->one(
            'SELECT v.id, v.codigo_dane, v.nombre, v.municipio_id, m.nombre as municipio_nombre, v.created_at, v.updated_at
             FROM veredas v
             INNER JOIN municipios m ON v.municipio_id = m.id
             WHERE v.id = :id',
            ['id' => $id]
        );
    }
    
    private static function toCorregimientoResponse(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'codigoDane' => (string) $row['codigo_dane'],
            'nombre' => (string) $row['nombre'],
            'municipioId' => (string) $row['municipio_id'],
            'municipioNombre' => (string) ($row['municipio_nombre'] ?? ''),
            'createdAt' => $row['created_at'] ?? null,
            'updatedAt' => $row['updated_at'] ?? null,
        ];
    }
    
    private static function toVeredaResponse(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'codigoDane' => (string) $row['codigo_dane'],
            'nombre' => (string) $row['nombre'],
            'municipioId' => (string) $row['municipio_id'],
            'municipioNombre' => (string) ($row['municipio_nombre'] ?? ''),
            'createdAt' => $row['created_at'] ?? null,
            'updatedAt' => $row['updated_at'] ?? null,
        ];
    }
}
