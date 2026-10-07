#!/usr/bin/env bash
# Medición en gama baja (1.0.0): emulador con 2 GB de RAM y red lenta.
# - Arranque en frío (3 veces): desde que se lanza la app hasta que muestra datos
#   (marca "[atora-perf] home" en el registro), y el TotalTime de Android.
# - Apertura de la lección con 3 videos (marca "[atora-perf] lesson <ms>").
# - Lista de 100 lecciones: fotogramas lentos según `dumpsys gfxinfo`.
# Resultado en capturas/rendimiento.txt. Falla si el arranque pasa de 4 s.
set -uo pipefail
PKG=com.atmosferacreativa.atora
OUT=capturas/rendimiento.txt
mkdir -p capturas
adb install -r atora-e2e.apk
API="${API_HOST:-http://localhost:8080/wp-json/atora-mobile/v1}"
maestro test -e API_HOST="$API" .maestro/perf/login.yaml

epoch_of() { # primera línea del registro que contiene $1 → segundos con decimales
  adb logcat -d -v epoch | grep -m1 -F "$1" | awk '{print $1}'
}

echo "Rendimiento en gama baja (2 GB de RAM, red lenta) — $(date -u +%FT%TZ)" > "$OUT"
starts=()
for i in 1 2 3; do
  adb shell am force-stop "$PKG"
  sleep 2
  adb logcat -c
  adb shell log -t atora-perf "launch $i"
  total=$(adb shell am start -W -n "$PKG/.MainActivity" | awk -F': ' '/TotalTime/ {print $2}' | tr -d '\r')
  home=""
  for _ in $(seq 1 60); do
    home=$(epoch_of "[atora-perf] home"); [ -n "$home" ] && break; sleep 1
  done
  launch=$(epoch_of "launch $i")
  if [ -n "$home" ] && [ -n "$launch" ]; then
    ms=$(awk -v a="$launch" -v b="$home" 'BEGIN { printf "%d", (b - a) * 1000 }')
  else
    ms=999999
  fi
  starts+=("$ms")
  echo "Arranque en frío $i: ${ms} ms hasta mostrar datos (primer cuadro nativo: ${total:-?} ms)" | tee -a "$OUT"
done

adb logcat -c
maestro test -e API_HOST="$API" .maestro/perf/leccion.yaml
lesson=$(adb logcat -d | grep -m1 -F "[atora-perf] lesson" | sed -E 's/.*\[atora-perf\] lesson ([0-9]+).*/\1/')
echo "Apertura de la lección con 3 videos: ${lesson:-?} ms" | tee -a "$OUT"

adb shell dumpsys gfxinfo "$PKG" reset >/dev/null
maestro test -e API_HOST="$API" .maestro/perf/lista-100.yaml
adb shell dumpsys gfxinfo "$PKG" | grep -E "Total frames rendered|Janky frames|50th percentile|90th percentile|99th percentile" | sed 's/^ */Lista de 100 lecciones · /' | tee -a "$OUT"

sorted=$(printf '%s\n' "${starts[@]}" | sort -n)
median=$(echo "$sorted" | sed -n 2p)
echo "Mediana del arranque en frío: ${median} ms (umbral 4000 ms)" | tee -a "$OUT"
[ "$median" -le 4000 ]
