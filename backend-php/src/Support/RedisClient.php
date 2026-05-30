<?php
declare(strict_types=1);

namespace Agrored\Support;

use RuntimeException;
use Throwable;

final class RedisClient
{
    private $socket = null;
    private string $host;
    private int $port;
    private ?string $password;

    public function __construct(string $url)
    {
        // Parse redis url: redis://[:password@]host:port
        $host = '127.0.0.1';
        $port = 6379;
        $password = null;

        $parsed = parse_url($url);
        if ($parsed !== false) {
            if (isset($parsed['host'])) {
                $host = (string) $parsed['host'];
            }
            if (isset($parsed['port'])) {
                $port = (int) $parsed['port'];
            }
            if (isset($parsed['pass'])) {
                $password = (string) $parsed['pass'];
            }
        }

        $this->host = $host;
        $this->port = $port;
        $this->password = $password;
    }

    private function connect(): void
    {
        if ($this->socket !== null) {
            return;
        }

        $this->socket = @fsockopen($this->host, $this->port, $errno, $errstr, 2.0);
        if (!$this->socket) {
            throw new RuntimeException("Could not connect to Redis: {$errstr} ({$errno})");
        }

        if ($this->password !== null && $this->password !== '') {
            $this->execute(['AUTH', $this->password]);
        }
    }

    public function execute(array $args)
    {
        $this->connect();

        $cmd = '*' . count($args) . "\r\n";
        foreach ($args as $arg) {
            $cmd .= '$' . strlen((string)$arg) . "\r\n" . $arg . "\r\n";
        }

        fwrite($this->socket, $cmd);
        return $this->readResponse();
    }

    private function readResponse()
    {
        $line = fgets($this->socket);
        if ($line === false) {
            throw new RuntimeException("Redis connection lost.");
        }

        $line = rtrim($line, "\r\n");
        if ($line === '') {
            throw new RuntimeException("Redis returned empty response.");
        }

        $type = $line[0];
        $value = substr($line, 1);

        switch ($type) {
            case '+': // Simple string
                return $value;
            case '-': // Error
                throw new RuntimeException("Redis error: " . $value);
            case ':': // Integer
                return (int) $value;
            case '$': // Bulk string
                $length = (int) $value;
                if ($length === -1) {
                    return null;
                }
                $data = '';
                $remaining = $length;
                while ($remaining > 0) {
                    $buf = fread($this->socket, min($remaining, 8192));
                    if ($buf === false || $buf === '') {
                        throw new RuntimeException("Redis error reading bulk data.");
                    }
                    $data .= $buf;
                    $remaining -= strlen($buf);
                }
                fgets($this->socket); // Discard CRLF (\r\n)
                return $data;
            case '*': // Multi-bulk array
                $count = (int) $value;
                if ($count === -1) {
                    return null;
                }
                $list = [];
                for ($i = 0; $i < $count; $i++) {
                    $list[] = $this->readResponse();
                }
                return $list;
            default:
                throw new RuntimeException("Unknown RESP type: " . $type);
        }
    }

    public function get(string $key): ?string
    {
        try {
            return $this->execute(['GET', $key]);
        } catch (Throwable) {
            return null; // Graceful degradation
        }
    }

    public function set(string $key, string $value, ?int $expireSeconds = null): bool
    {
        try {
            if ($expireSeconds !== null) {
                $res = $this->execute(['SET', $key, $value, 'EX', $expireSeconds]);
            } else {
                $res = $this->execute(['SET', $key, $value]);
            }
            return $res === 'OK';
        } catch (Throwable) {
            return false; // Graceful degradation
        }
    }

    public function del(string $key): int
    {
        try {
            return (int) $this->execute(['DEL', $key]);
        } catch (Throwable) {
            return 0; // Graceful degradation
        }
    }

    public function incr(string $key): int
    {
        try {
            return (int) $this->execute(['INCR', $key]);
        } catch (Throwable) {
            return 1; // Graceful degradation
        }
    }

    public function expire(string $key, int $seconds): bool
    {
        try {
            return $this->execute(['EXPIRE', $key, $seconds]) === 1;
        } catch (Throwable) {
            return false; // Graceful degradation
        }
    }

    public function close(): void
    {
        if ($this->socket) {
            fclose($this->socket);
            $this->socket = null;
        }
    }

    public function __destruct()
    {
        $this->close();
    }
}
