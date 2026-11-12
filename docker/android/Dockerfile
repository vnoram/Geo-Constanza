# Solo para el puente del emulador Android (ver docs/DOCKER_LOCAL.md). Agrega socat a la imagen del emulador
# para reutilizar su adb (misma versión que el servidor adb del emulador).
FROM budtmo/docker-android:emulator_14.0
USER root
RUN apt-get update && apt-get install -y --no-install-recommends socat \
    && rm -rf /var/lib/apt/lists/*
