<?php
declare(strict_types=1);

namespace Agrored\Tests;

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/Modules/AiChat/AiChatService.php';

use Agrored\Modules\AiChat\AiChatService;
use Agrored\Database\Database;
use ReflectionClass;

final class AiChatTest
{
    public static function run(): void
    {
        echo "=== INICIANDO PRUEBAS DE SEGURIDAD Y PARIDAD DE COPILOTO IA ===\n\n";

        self::testSqlSafetyValidator();
        self::testSystemPromptConstruction();
        self::testMissingApiKeyGracefulHandling();

        echo "\n🎉 TODAS LAS PRUEBAS DE SEGURIDAD DEL COPILOTO IA PASARON CON 100% DE ÉXITO 🎉\n";
    }

    private static function getPrivateMethod(string $class, string $method)
    {
        $reflector = new ReflectionClass($class);
        $method = $reflector->getMethod($method);
        $method->setAccessible(true);
        return $method;
    }

    private static function testSqlSafetyValidator(): void
    {
        echo "⏳ Probando Validador de Seguridad SQL (Anti-SQL-Injection)... ";
        
        $dbReflector = new ReflectionClass(Database::class);
        $dbMock = $dbReflector->newInstanceWithoutConstructor();
        
        $env = ['AI_PROVIDER' => 'gemini', 'AI_API_KEY' => 'test-key'];
        $service = new AiChatService($env, $dbMock);
        
        $method = self::getPrivateMethod(AiChatService::class, 'isSqlSafe');

        // Safe Queries
        $safe1 = "SELECT COUNT(*) FROM public.offers WHERE status = 'published'";
        $safe2 = "  SELECT id, product_name, price FROM public.offers LIMIT 5";
        $safe3 = "SELECT u.email, t.name FROM public.users u JOIN public.tenants t ON u.tenant_id = t.id";

        if (!$method->invoke($service, $safe1) || !$method->invoke($service, $safe2) || !$method->invoke($service, $safe3)) {
            throw new \Exception("El validador rechazó erróneamente consultas SELECT seguras.");
        }

        // Unsafe / Mutative Queries
        $unsafe1 = "DROP TABLE public.users";
        $unsafe2 = "INSERT INTO public.offers (id, price) VALUES ('123', 5000)";
        $unsafe3 = "UPDATE public.users SET role = 'ADMIN' WHERE id = '321'";
        $unsafe4 = "SELECT * FROM public.users; DELETE FROM public.offers";
        $unsafe5 = "SELECT * INTO OUTFILE '/tmp/dump' FROM public.offers";

        if ($method->invoke($service, $unsafe1) || $method->invoke($service, $unsafe2) || 
            $method->invoke($service, $unsafe3) || $method->invoke($service, $unsafe4) ||
            $method->invoke($service, $unsafe5)) {
            throw new \Exception("El validador permitió una consulta destructiva/mutativa insegura.");
        }

        echo "✅ OK [Consultas Seguras Permitidas | Intentos Maliciosos Bloqueados]\n";
    }

    private static function testSystemPromptConstruction(): void
    {
        echo "⏳ Probando Construcción de System Prompt Analítico... ";
        
        $dbReflector = new ReflectionClass(Database::class);
        $dbMock = $dbReflector->newInstanceWithoutConstructor();
        
        $env = ['AI_PROVIDER' => 'gemini'];
        $service = new AiChatService($env, $dbMock);
        
        $methodSystem = self::getPrivateMethod(AiChatService::class, 'buildSystemPrompt');
        $systemPrompt = $methodSystem->invoke($service);

        // Verify key tables are in system instructions
        if (strpos($systemPrompt, 'public.offers') === false || strpos($systemPrompt, 'public.users') === false) {
            throw new \Exception("Faltan esquemas de tablas clave en el prompt de sistema.");
        }

        if (strpos($systemPrompt, '[SQL]') === false) {
            throw new \Exception("Faltan instrucciones del bloque [SQL] en el prompt de sistema.");
        }

        echo "✅ OK [System Prompt Completo y Detallado]\n";
    }

    private static function testMissingApiKeyGracefulHandling(): void
    {
        echo "⏳ Probando Manejo Elegante de API Key Faltante... ";
        
        $dbReflector = new ReflectionClass(Database::class);
        $dbMock = $dbReflector->newInstanceWithoutConstructor();
        
        // No key configured
        $env = ['AI_PROVIDER' => 'gemini', 'AI_API_KEY' => ''];
        $service = new AiChatService($env, $dbMock);

        try {
            $service->chat("¿Cuántas ofertas de papa hay?");
            throw new \Exception("Debió fallar con RuntimeException debido a API Key faltante.");
        } catch (\RuntimeException $e) {
            if (strpos($e->getMessage(), 'API Key de Gemini no configurada') === false) {
                throw new \Exception("Mensaje de error inesperado: " . $e->getMessage());
            }
        }

        echo "✅ OK [Captura y Manejo Correcto]\n";
    }
}

AiChatTest::run();
