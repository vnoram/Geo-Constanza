@echo off
REM Prende Geo Constanza en local (Docker Desktop debe estar abierto) y abre la app.
cd /d "%~dp0.."
docker info >nul 2>&1
if errorlevel 1 (
  echo Docker no esta corriendo. Abre Docker Desktop, espera a que diga Engine running y vuelve a abrir este archivo.
  pause
  exit /b 1
)
docker compose up -d
if errorlevel 1 (
  echo Fallo al levantar. Revisa el mensaje de arriba.
  pause
  exit /b 1
)
echo.
echo Listo. El frontend puede tardar un minuto la primera vez.
timeout /t 5 >nul
start "" http://localhost:5173
