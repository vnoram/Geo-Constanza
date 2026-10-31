# Levanta Geo Constanza en local con Docker (Windows PowerShell).
# Uso, desde la raiz del repo:  powershell -ExecutionPolicy Bypass -File scripts\local-up.ps1
# Opcional: agrega -Con2FA para probar el 2FA en local.
param([switch]$Con2FA)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

function Nuevo-Secreto {
  $bytes = New-Object 'System.Byte[]' 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  -join ($bytes | ForEach-Object { $_.ToString('x2') })
}

docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker no esta corriendo. Abre Docker Desktop y espera a que diga "Engine running".' }

# 1) Secretos locales (.env no se sube a git; solo se crea si no existe)
if (-not (Test-Path .env)) {
  $lineas = @(
    "JWT_ACCESS_SECRET=$(Nuevo-Secreto)",
    "JWT_REFRESH_SECRET=$(Nuevo-Secreto)",
    "TWO_FACTOR_ENCRYPTION_KEY=$(Nuevo-Secreto)",
    "REQUIRE_2FA=false"
  )
  Set-Content -Path .env -Value $lineas -Encoding ascii
  Write-Host 'Creado .env con secretos aleatorios locales.'
}
if ($Con2FA) {
  (Get-Content .env) -replace '^REQUIRE_2FA=.*', 'REQUIRE_2FA=true' | Set-Content .env -Encoding ascii
  Write-Host '2FA activado para esta prueba (REQUIRE_2FA=true).'
}

# 2) Levantar servicios
docker compose up --build -d
if ($LASTEXITCODE -ne 0) { throw 'Fallo docker compose up.' }

# 3) Esperar a la API (aplica migraciones al arrancar)
Write-Host 'Esperando a la API...'
$ok = $false
for ($i = 0; $i -lt 60; $i++) {
  try { if ((Invoke-WebRequest -UseBasicParsing http://localhost:3005/api/v1/health -TimeoutSec 3).StatusCode -eq 200) { $ok = $true; break } } catch {}
  Start-Sleep -Seconds 3
}
if (-not $ok) { docker compose logs --tail 40 api; throw 'La API no respondio a tiempo.' }

# 4) Datos de demostracion (solo base local)
docker compose exec -T api node prisma/seed.js

Write-Host ''
Write-Host 'Listo.'
Write-Host '  App:      http://localhost:5173  (el frontend tarda un poco la primera vez)'
Write-Host '  Correos:  http://localhost:8025'
Write-Host '  Apagar:   docker compose down   (agrega -v para borrar la base local)'
