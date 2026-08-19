#!/usr/bin/env bash
# Пережимает исходники из ~/Documents/Лёлич50/cool в лёгкие прогрессивные JPEG.
# Оригиналы из ГПТ - это PNG по 2.5-3 МБ, для мобилок это неподъёмно.
set -euo pipefail

SRC="${1:-$HOME/Documents/Лёлич50/cool}"
OUT="$(cd "$(dirname "$0")" && pwd)/img"
MAXW=1100          # больше на экране всё равно не показываем
Q_AFTER=78         # нейро-картинки: много градиентов, артефакты не видно
Q_BEFORE=82        # старые фотки и так мягкие, жмём аккуратнее

mkdir -p "$OUT"

# слаг:качество:исходник
PAIRS=(
  "pelmen-before:$Q_BEFORE:1-лёлич-пельмень-до.jpg"
  "pelmen-after:$Q_AFTER:1-лёлич-пельмень-после.png"
  "uchitel-before:$Q_BEFORE:учитель.jpg"
  "uchitel-after:$Q_AFTER:учитель-после.png"
  "mudrost-before:$Q_BEFORE:мудрость-до.jpg"
  "mudrost-after:$Q_AFTER:мудрость-после.png"
  "lider-before:$Q_BEFORE:лидер.jpg"
  "lider-after:$Q_AFTER:лидер.png"
  "dobytchik-before:$Q_BEFORE:добытчик.jpg"
  "dobytchik-after:$Q_AFTER:добытчик-после.png"
  "semyanin-before:$Q_BEFORE:семьянин-до.jpg"
  "semyanin-after:$Q_AFTER:семьянин-после.png"
  "veselyi-before:$Q_BEFORE:весёлый-до.jpg"
  "veselyi-after:$Q_AFTER:весёлый-после.png"
)

for entry in "${PAIRS[@]}"; do
  slug="${entry%%:*}"; rest="${entry#*:}"
  q="${rest%%:*}"; file="${rest#*:}"
  convert "$SRC/$file" \
    -auto-orient \
    -resize "${MAXW}x${MAXW}>" \
    -strip \
    -interlace Plane \
    -sampling-factor 4:2:0 \
    -quality "$q" \
    "$OUT/$slug.jpg"
  printf '%-18s %8s  %s\n' "$slug.jpg" \
    "$(du -h "$OUT/$slug.jpg" | cut -f1)" \
    "$(identify -format '%wx%h' "$OUT/$slug.jpg")"
done

echo "---"
echo "итого: $(du -sh "$OUT" | cut -f1)"
