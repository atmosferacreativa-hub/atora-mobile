#!/usr/bin/env bash
# Conserva capturas reales de la plataforma indicada; nunca simula otra plataforma.
# Uso: bash scripts/store-screenshots.sh android|ios ORIGEN [DESTINO=store]
set -euo pipefail
PLATFORM="${1:?indica android o ios}"
SRC="${2:?indica la carpeta de capturas originales}"
DEST="${3:-store}"
case "$PLATFORM" in
 android) TARGET="$DEST/play" ;;
 ios) TARGET="$DEST/ios" ;;
 *) echo 'Plataforma inválida: usa android o ios, con capturas de esa plataforma.' >&2; exit 2 ;;
esac
[[ -d "$SRC" ]] || { echo 'No existe la carpeta de origen.' >&2; exit 2; }
mkdir -p "$TARGET"
SRC_ABS="$(cd "$SRC" && pwd -P)"
TARGET_ABS="$(cd "$TARGET" && pwd -P)"
case "$TARGET_ABS/" in "$SRC_ABS/"*) echo 'El destino no puede estar dentro del origen.' >&2; exit 2;; esac
n=0
while IFS= read -r -d '' file; do
 n=$((n+1))
 name=$(printf '%02d-%s' "$n" "$(basename "$file")")
 [[ ! -e "$TARGET/$name" ]] || { echo "Ya existe $name; usa otro destino para no sobrescribir." >&2; exit 2; }
 cp "$file" "$TARGET/$name"
done < <(find "$SRC" -type f -name '*.png' -print0)
(( n > 0 )) || { echo 'No hay capturas PNG; no se generó material de tienda.' >&2; exit 1; }
echo "$n capturas originales de $PLATFORM en $TARGET. Verifica tamaños y contenido en la consola."
