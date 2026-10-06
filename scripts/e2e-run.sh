#!/usr/bin/env bash
# Instala la APK de pruebas y corre los recorridos Maestro.
# Uso: scripts/e2e-run.sh "todos" | "login,leccion"
set -euo pipefail

flows="${1:-todos}"
adb install -r atora-e2e.apk
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

maestro test --format junit --output maestro-report.xml "${args[@]}"
