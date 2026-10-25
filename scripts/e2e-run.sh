#!/usr/bin/env bash
# Instala la APK de pruebas y corre los recorridos Maestro.
# Uso: scripts/e2e-run.sh "todos" | "login,leccion"
set -euo pipefail

flows="${1:-todos}"
adb install -r atora-e2e.apk

# CI: `adb reverse` hace que 127.0.0.1:8080 dentro del emulador apunte al
# WordPress del runner. Esto evita depender de 10.0.2.2 (a veces inaccesible
# en GitHub Actions / KVM).
adb reverse --remove-all || true
adb reverse tcp:8080 tcp:8080
mkdir -p capturas

args=()
if [ "$flows" = "todos" ]; then
  args+=(.maestro)
else
  IFS=',' read -ra names <<< "$flows"
  for name in "${names[@]}"; do
    args+=(".maestro/${name}.yaml")
  done
fi

# API_HOST: los scripts de los recorridos (p. ej. el segundo docente del 409) llaman a la API desde el runner.
maestro test -e API_HOST="${API_HOST:-http://localhost:8080/wp-json/atora-mobile/v1}" --format junit --output maestro-report.xml "${args[@]}"
