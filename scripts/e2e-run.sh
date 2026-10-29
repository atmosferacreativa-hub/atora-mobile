#!/usr/bin/env bash
# Instala la APK de pruebas y corre los recorridos Maestro.
# Uso: scripts/e2e-run.sh "todos" | "login,leccion"
set -euo pipefail

flows="${1:-todos}"

mkdir -p .e2e
rm -f .e2e/maestro-started

ensure_device_ready() {
  # Infra hardening: ADB en GitHub Actions puede quedar en mal estado.
  for attempt in 1 2 3; do
    adb kill-server >/dev/null 2>&1 || true
    adb start-server >/dev/null 2>&1 || true
    if ! adb wait-for-device >/dev/null 2>&1; then
      echo "WARN: adb wait-for-device falló (intento $attempt)" >&2
      sleep $((attempt * 5))
      continue
    fi
    # Esperar a boot completo.
    for _ in $(seq 1 180); do
      booted=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
      if [ "$booted" = "1" ]; then
        return 0
      fi
      sleep 1
    done
    echo "WARN: sys.boot_completed != 1 (intento $attempt)" >&2
    sleep $((attempt * 5))
  done
  echo "ERROR: el emulador no quedó listo (adb/boot_completed)." >&2
  return 1
}

ensure_device_ready
adb install -r atora-e2e.apk

restore_network() {
  # Recuperación defensiva: si un recorrido falló con modo avión activo, los demás
  # no deben heredar ese estado.
  adb shell cmd connectivity airplane-mode disable >/dev/null 2>&1 || true
  adb shell settings put global airplane_mode_on 0 >/dev/null 2>&1 || true
  adb shell am broadcast -a android.intent.action.AIRPLANE_MODE --ez state false >/dev/null 2>&1 || true
}

# Asegurar restauración incluso cuando Maestro termina con fallas.
trap restore_network EXIT

restore_network

enable_wifi() {
  adb shell svc wifi enable >/dev/null 2>&1 || true
  adb shell cmd wifi set-wifi-enabled enabled >/dev/null 2>&1 || true
  adb shell cmd wifi connect-network AndroidWifi open >/dev/null 2>&1 || true
}

wait_for_wifi() {
  # `expo-network` reporta WIFI solo si el emulador expone `TRANSPORT_WIFI`.
  # En API 34 el emulador trae la red virtual `AndroidWifi`.
  for _ in $(seq 1 30); do
    if adb shell dumpsys connectivity 2>/dev/null | tr -d '\r' | grep -q 'TRANSPORT_WIFI'; then
      return 0
    fi
    sleep 1
  done
  return 1
}

enable_wifi
if ! wait_for_wifi; then
  echo "WARN: el emulador no reporta TRANSPORT_WIFI (expo-network puede ver otra red)." >&2
fi

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
  # Con archivos sueltos Maestro no aplica el flowsOrder de config.yaml (los corría en orden alfabético y, como los
  # recorridos del docente comparten entregas sembradas, docente-borrador-recuperado y docente-sugerencia-ia corrían
  # antes o después de lo que necesitan). Se arma una carpeta con solo los recorridos pedidos y el orden filtrado.
  IFS=',' read -ra names <<< "$flows"
  sel="$PWD/.e2e/sel"
  rm -rf "$sel" && mkdir -p "$sel"
  cp -R .maestro/common .maestro/scripts "$sel/" 2>/dev/null || true
  [ -d .maestro/perf ] && cp -R .maestro/perf "$sel/"
  for name in "${names[@]}"; do
    cp ".maestro/${name}.yaml" "$sel/"
  done
  python3 scripts/e2e-select-config.py .maestro/config.yaml "$sel/config.yaml" "${names[@]}"
  args+=("$sel")
fi

# API_HOST: los scripts de los recorridos (p. ej. el segundo docente del 409) llaman a la API desde el runner.
touch .e2e/maestro-started
# --debug-output: capturas de cada fallo en un lugar fijo (el paso de OCR del CI las lee).
mkdir -p .e2e/debug
maestro test -e API_HOST="${API_HOST:-http://localhost:8080/wp-json/atora-mobile/v1}" --debug-output "$PWD/.e2e/debug" --format junit --output maestro-report.xml "${args[@]}"
