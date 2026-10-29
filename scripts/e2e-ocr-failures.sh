#!/usr/bin/env bash
# Texto de las capturas de fallo de Maestro (OCR) como anotaciones: sin acceso a los artefactos, así se ve qué había
# en pantalla cuando un recorrido falló.
set -uo pipefail
dirs=("$PWD/.e2e/debug" "$HOME/.maestro/tests")
pngs=$(find "${dirs[@]}" -type f -name '*.png' 2>/dev/null | grep -Ei 'screenshot.*(❌|fail)' | head -8)
count=$(printf '%s' "$pngs" | grep -c . || true)
echo "::notice title=Pantallas de fallo::${count} captura(s) de fallo encontradas"
[ "$count" -gt 0 ] || exit 0
if ! command -v tesseract >/dev/null 2>&1; then
  sudo apt-get update -qq >/dev/null 2>&1
  sudo apt-get install -y -qq tesseract-ocr tesseract-ocr-spa >/dev/null 2>&1 || { echo "::notice title=Pantallas de fallo::no se pudo instalar tesseract"; exit 0; }
fi
printf '%s\n' "$pngs" | while read -r png; do
  [ -n "$png" ] || continue
  flow="$(basename "$png" .png)"
  text="$(tesseract "$png" - -l spa+eng 2>/dev/null | tr '\n' ' ' | tr -s ' ' | cut -c1-900)"
  echo "::warning title=Pantalla al fallar ${flow:0:60}::${text}"
done
