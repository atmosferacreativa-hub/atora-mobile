#!/usr/bin/env bash
# Prepara un snapshot del AVD para acelerar y estabilizar e2e.
set -euo pipefail

adb kill-server >/dev/null 2>&1 || true
adb start-server >/dev/null 2>&1 || true
adb wait-for-device

for _ in $(seq 1 240); do
  booted=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
  if [ "$booted" = "1" ]; then
    echo "AVD listo para snapshot"
    exit 0
  fi
  sleep 1
done

echo "ERROR: no se logró boot completo para snapshot" >&2
exit 1

