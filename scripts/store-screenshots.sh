#!/usr/bin/env bash
# Adapta las capturas del modo "tienda" del CI (1080 × 2400) a los tamaños de cada tienda.
# Uso (macOS, usa sips): scripts/store-screenshots.sh <carpeta con las capturas PNG> [destino=store]
set -euo pipefail
SRC="${1:?carpeta de capturas}"
DEST="${2:-store}"
BG="F3F6FF" # fondo de la app
mkdir -p "$DEST/play" "$DEST/ios-6.9" "$DEST/ios-6.5"
n=0
while IFS= read -r file; do
  n=$((n + 1))
  name=$(printf '%02d-%s' "$n" "$(basename "$file")")
  cp "$file" "$DEST/play/$name"
  for spec in "ios-6.9:1320:2868" "ios-6.5:1284:2778"; do
    IFS=: read -r dir w h <<< "$spec"
    cp "$file" "$DEST/$dir/$name"
    sips --resampleHeight "$h" "$DEST/$dir/$name" >/dev/null
    sips --padToHeightWidth "$h" "$w" --padColor "$BG" "$DEST/$dir/$name" >/dev/null
  done
done < <(find "$SRC" -name '*.png' | sort)
echo "$n capturas en $DEST/{play,ios-6.9,ios-6.5}"
