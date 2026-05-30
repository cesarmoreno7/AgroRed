<?php
declare(strict_types=1);

namespace Agrored\Database;

use PDO;
use PDOStatement;

final class Database
{
    private ?PDO $pdo = null;
    private array $env;

    public function __construct(array $env)
    {
        $this->env = $env;
    }

    public function pdo(): PDO
    {
        if ($this->pdo instanceof PDO) {
            return $this->pdo;
        }

        $dsn = sprintf(
            'pgsql:host=%s;port=%s;dbname=%s',
            $this->env['POSTGRES_HOST'] ?? 'localhost',
            $this->env['POSTGRES_PORT'] ?? '5432',
            $this->env['POSTGRES_DB'] ?? 'agrored'
        );

        $this->pdo = new PDO(
            $dsn,
            (string) ($this->env['POSTGRES_USER'] ?? '777'),
            (string) ($this->env['POSTGRES_PASSWORD'] ?? '777'),
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );

        return $this->pdo;
    }

    public function all(string $sql, array $params = []): array
    {
        $statement = $this->pdo()->prepare($sql);
        $this->bindParams($statement, $params);
        $statement->execute();
        $rows = $statement->fetchAll();

        return is_array($rows) ? $rows : [];
    }

    public function one(string $sql, array $params = []): ?array
    {
        $rows = $this->all($sql, $params);
        return $rows[0] ?? null;
    }

    public function scalar(string $sql, array $params = []): mixed
    {
        $row = $this->one($sql, $params);
        if ($row === null) {
            return null;
        }

        return reset($row);
    }

    public function execute(string $sql, array $params = []): int
    {
        $statement = $this->pdo()->prepare($sql);
        $this->bindParams($statement, $params);
        $statement->execute();
        return $statement->rowCount();
    }

    public function hasPostgis(): bool
    {
        return (bool) $this->scalar(
            "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis')"
        );
    }

    public function hasFunction(string $functionName): bool
    {
        return (bool) $this->scalar(
            "SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = :function_name)",
            ['function_name' => $functionName]
        );
    }

    public function relationExists(string $qualifiedName): bool
    {
        return (bool) $this->scalar(
            'SELECT to_regclass(:qualified_name) IS NOT NULL',
            ['qualified_name' => $qualifiedName]
        );
    }

    public function hasColumn(string $qualifiedTableName, string $columnName): bool
    {
        $parts = explode('.', $qualifiedTableName, 2);
        $schema = count($parts) === 2 ? $parts[0] : 'public';
        $table = count($parts) === 2 ? $parts[1] : $parts[0];

        return (bool) $this->scalar(
            'SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = :schema_name
                  AND table_name = :table_name
                  AND column_name = :column_name
            )',
            [
                'schema_name' => $schema,
                'table_name' => $table,
                'column_name' => $columnName,
            ]
        );
    }

    private function bindParams(PDOStatement $statement, array $params): void
    {
        foreach ($params as $key => $value) {
            $paramName = is_string($key) ? ':' . ltrim($key, ':') : $key + 1;

            if (is_int($value)) {
                $statement->bindValue($paramName, $value, PDO::PARAM_INT);
            } elseif (is_bool($value)) {
                $statement->bindValue($paramName, $value, PDO::PARAM_BOOL);
            } elseif ($value === null) {
                $statement->bindValue($paramName, null, PDO::PARAM_NULL);
            } else {
                $statement->bindValue($paramName, $value, PDO::PARAM_STR);
            }
        }
    }
}
