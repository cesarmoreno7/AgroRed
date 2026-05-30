# AgroRed - Levantar todos los microservicios
$root = "d:\xampp\htdocs\AgroRed"
$logsDir = "$root\logs"

if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir | Out-Null }

$services = @(
    @{ name = "user-service";         script = "dev:user";         port = 3001 },
    @{ name = "producer-service";     script = "dev:producer";     port = 3002 },
    @{ name = "offer-service";        script = "dev:offer";        port = 3003 },
    @{ name = "rescue-service";       script = "dev:rescue";       port = 3004 },
    @{ name = "demand-service";       script = "dev:demand";       port = 3005 },
    @{ name = "inventory-service";    script = "dev:inventory";    port = 3006 },
    @{ name = "logistics-service";    script = "dev:logistics";    port = 3007 },
    @{ name = "incident-service";     script = "dev:incident";     port = 3008 },
    @{ name = "analytics-service";    script = "dev:analytics";    port = 3009 },
    @{ name = "notification-service"; script = "dev:notification"; port = 3010 },
    @{ name = "ml-service";           script = "dev:ml";           port = 3011 },
    @{ name = "automation-service";   script = "dev:automation";   port = 3012 },
    @{ name = "auction-service";      script = "dev:auction";      port = 3013 },
    @{ name = "api-gateway";          script = "dev:gateway";      port = 8082 },
    @{ name = "web-dashboard";        script = "dev:dashboard";    port = 5173 }
)

$pids = @{}

foreach ($svc in $services) {
    $logFile = "$logsDir\$($svc.name).log"
    $proc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c npm run $($svc.script) > `"$logFile`" 2>&1" `
        -WorkingDirectory $root `
        -WindowStyle Hidden `
        -PassThru
    $pids[$svc.name] = $proc.Id
    Write-Host "  [OK] $($svc.name) :$($svc.port)  (PID $($proc.Id))"
    Start-Sleep -Milliseconds 300
}

# Guardar PIDs para poder detenerlos luego
$pids | ConvertTo-Json | Out-File "$root\service-pids.json" -Encoding utf8
Write-Host ""
Write-Host "Todos los servicios iniciados. PIDs guardados en service-pids.json"
Write-Host "Logs en: $logsDir"
