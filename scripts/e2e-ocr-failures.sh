#!/usr/bin/env bash
# Texto de las capturas de fallo de Maestro (OCR) como anotaciones: sin acceso a los artefactos, así se ve qué había
# en pantalla cuando un recorrido falló.
set -uo pipefail
command -v tesseract >/dev/null 2>&1 || { sudo apt-get install -y -qq tesseract-ocr tesseract-ocr-spa >/dev/null 2>&1 || exit 0; }
find "$HOME/.maestro/tests" -type f -name '*.png' 2>/dev/null | grep -E 'screenshot-.*(❌|fail|FAIL)' | head -8 | while read -r png; do
  flow="$(basename "$png" .png)"
  text="$(tesseract "$png" - -l spa+eng 2>/dev/null | tr '\n' ' ' | tr -s ' ' | cut -c1-900)"
  echo "::warning title=Pantalla al fallar ${flow:0:60}::${text}"
done
find "$HOME/.maestro/tests" -maxdepth 2 -type f 2>/dev/null | head -5 | sed 's/^/archivo: /'
