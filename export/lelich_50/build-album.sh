#!/usr/bin/env bash
# Готовит альбом ностальгических фоток:
#   album/s/albom-NN.jpg  - превью для сетки (лёгкие, грузятся лениво)
#   album/albom-NN.jpg    - полный размер, подтягивается только при клике
# Порядок: first.jpg первая, last.jpg последняя, остальные по имени файла.
set -euo pipefail

SRC="${1:-$HOME/Documents/Лёлич50}"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/album"

rm -rf "$OUT"
mkdir -p "$OUT/s"

mapfile -t MIDDLE < <(
  find "$SRC" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) -printf '%f\n' \
    | grep -vx 'first.jpg' | grep -vx 'last.jpg' | sort
)
FILES=(first.jpg "${MIDDLE[@]}" last.jpg)

i=0
for f in "${FILES[@]}"; do
  i=$((i + 1))
  n=$(printf '%02d' "$i")
  convert "$SRC/$f" -auto-orient -resize '1200x1200>' -strip -interlace Plane \
    -sampling-factor 4:2:0 -quality 78 "$OUT/albom-$n.jpg"
  # на телефоне альбом идёт в одну колонку во всю ширину, поэтому превью не мелкие
  convert "$SRC/$f" -auto-orient -resize '700x700>' -strip -interlace Plane \
    -sampling-factor 4:2:0 -quality 72 "$OUT/s/albom-$n.jpg"
done

echo "кадров: $i"
echo "превью: $(du -sh "$OUT/s" | cut -f1)   полные: $(du -sh --exclude=s "$OUT" | cut -f1)"
