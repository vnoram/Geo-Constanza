#!/bin/sh
# Puente entre el Android virtual y los servicios del compose.
# Comparte la red del contenedor "android" (network_mode: service:android), así que:
#  - "web" y "api" se resuelven por el DNS del proyecto;
#  - el servidor adb que usa es el del propio emulador (127.0.0.1:5037).
# 1) socat: puertos 5173 y 3005 del contenedor android -> web y api.
# 2) adb reverse: "localhost:5173" y "localhost:3005" DENTRO del teléfono llegan a esos puertos.
#    Así en Chrome del emulador se abre http://localhost:5173 (mismo origen que en tu PC, CORS sin cambios).
set -u

socat TCP-LISTEN:5173,fork,reuseaddr TCP:web:5173 &
socat TCP-LISTEN:3005,fork,reuseaddr TCP:api:3005 &

echo "[bridge] esperando que Android termine de arrancar..."
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
  sleep 5
done
echo "[bridge] Android listo"

# Se reaplica cada 15 s por si el emulador reinicia adb.
while true; do
  adb reverse --list 2>/dev/null | grep -q 'tcp:5173' || adb reverse tcp:5173 tcp:5173 >/dev/null 2>&1 && true
  adb reverse --list 2>/dev/null | grep -q 'tcp:3005' || adb reverse tcp:3005 tcp:3005 >/dev/null 2>&1 && true
  sleep 15
done
