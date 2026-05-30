$php = 'd:\xampp\php\php.exe'

if (-not (Test-Path $php)) {
  Write-Error "No se encontro PHP en $php"
  exit 1
}

& $php -S 127.0.0.1:8080 .\backend-php\dev-router.php
