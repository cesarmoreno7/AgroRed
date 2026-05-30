# dev-all.ps1 — Start all AgroRed microservices in parallel (dev mode)
# Usage: .\scripts\dev-all.ps1

$envFile = Join-Path (Get-Location).Path ".env"
$envVars = @{}

if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()

    if (-not $line -or $line.StartsWith("#")) {
      return
    }

    $separatorIndex = $line.IndexOf("=")
    if ($separatorIndex -lt 1) {
      return
    }

    $key = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1).Trim()

    if ($value.StartsWith('"') -and $value.EndsWith('"')) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $envVars[$key] = $value
  }
}

$services = @(
  @{ Name = "user";         Port = 3001 },
  @{ Name = "producer";     Port = 3002 },
  @{ Name = "offer";        Port = 3003 },
  @{ Name = "rescue";       Port = 3004 },
  @{ Name = "demand";       Port = 3005 },
  @{ Name = "inventory";    Port = 3006 },
  @{ Name = "logistics";    Port = 3007 },
  @{ Name = "incident";     Port = 3008 },
  @{ Name = "notification"; Port = 3009 },
  @{ Name = "analytics";    Port = 3010 },
  @{ Name = "ml";           Port = 3011 },
  @{ Name = "automation";   Port = 3012 },
  @{ Name = "auction";      Port = 3013 },
  @{ Name = "gateway";      Port = 8080 }
)

$jobs = @()

foreach ($svc in $services) {
  $name = $svc.Name
  $port = $svc.Port

  if ($name -eq "gateway" -and $envVars.ContainsKey("API_GATEWAY_PORT")) {
    $port = [int]$envVars["API_GATEWAY_PORT"]
  }

  Write-Host "[STARTING] $name on port $port ..." -ForegroundColor Cyan

  $job = Start-Job -Name "dev:$name" -ScriptBlock {
    param($root, $name, $envVars)
    Set-Location $root

    foreach ($entry in $envVars.GetEnumerator()) {
      [System.Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, "Process")
    }

    & npm.cmd run ("dev:{0}" -f $name) 2>&1
  } -ArgumentList (Get-Location).Path, $name, $envVars

  $jobs += $job
}

Write-Host ""
Write-Host "=== All $($services.Count) services launched ===" -ForegroundColor Green
$gatewayPort = if ($envVars.ContainsKey("API_GATEWAY_PORT")) { $envVars["API_GATEWAY_PORT"] } else { 8080 }
Write-Host "Gateway: http://localhost:$gatewayPort" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop all services." -ForegroundColor DarkGray

try {
  while ($true) {
    foreach ($j in $jobs) {
      $output = Receive-Job -Job $j -ErrorAction SilentlyContinue
      if ($output) {
        foreach ($line in $output) {
          Write-Host "[$($j.Name)] $line"
        }
      }
    }
    Start-Sleep -Milliseconds 500
  }
} finally {
  Write-Host "`nStopping all services..." -ForegroundColor Red
  $jobs | Stop-Job -PassThru | Remove-Job
}
