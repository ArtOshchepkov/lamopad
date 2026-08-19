#!/usr/bin/env bash
# Собирает всё, что нужно для «Поделиться»:
#   qr.svg        - QR со ссылкой на страницу
#   icon-180.png  - фавиконка / иконка на домашний экран (лицо с первой фотки ПОСЛЕ)
#   og.jpg        - превью, которое показывают вотсап/телега при отправке ссылки
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/img/pelmen-after.jpg"
URL="https://lamopad.ru/export/lelich_50/"
TITLE="С ДНЁМ РОЖДЕНИЯ, ЛЁЛИЧ!"
FONT="${FONT:-$HERE/.font/Caveat-Bold.ttf}"
CAVEAT_URL="https://fonts.gstatic.com/s/caveat/v23/WnznHAc5bAfYB2QRah7pcpNvOx-pjRV6SII.ttf"

if [ ! -f "$FONT" ]; then
  echo "качаю Caveat Bold..."
  mkdir -p "$(dirname "$FONT")"
  curl -fsSL -o "$FONT" "$CAVEAT_URL"
fi

# --- QR ---
python3 - "$URL" "$HERE/qr.svg" <<'PY'
import sys, qrcode, qrcode.image.svg
url, out = sys.argv[1], sys.argv[2]
qr = qrcode.QRCode(
    error_correction=qrcode.constants.ERROR_CORRECT_Q,  # с запасом: печатают и снимают с экрана
    box_size=10, border=2,
)
qr.add_data(url)
qr.make(fit=True)
qr.make_image(image_factory=qrcode.image.svg.SvgPathImage).save(out)
print("qr.svg:", qr.version, "версия,", qr.modules_count, "модулей")
PY

# --- иконка: квадрат с лицом ---
convert "$SRC" -crop 700x700+330+40 +repage -resize 180x180 -strip -quality 90 "$HERE/icon-180.png"
convert "$HERE/icon-180.png" -resize 32x32 -strip "$HERE/icon-32.png"

# --- превью для мессенджеров 1200x630 ---
# в системе GraphicsMagick: нет ^-ресайза и -composite, поэтому режем и накладываем вручную
SCRIM="$(mktemp -t lelich-scrim-XXXXXX.png)"
BASE="$(mktemp -t lelich-base-XXXXXX.png)"
FLAT="$(mktemp -t lelich-flat-XXXXXX.png)"
trap 'rm -f "$SCRIM" "$BASE" "$FLAT"' EXIT

convert -size 1200x300 gradient:none-'rgba(20,12,4,0.9)' PNG32:"$SCRIM"
convert "$SRC" -resize 1200x -crop 1200x630+0+40 +repage PNG32:"$BASE"
composite -gravity south -compose over "$SCRIM" "$BASE" "$FLAT"   # gm composite не умеет писать в свой же вход

convert "$FLAT" -font "$FONT" -pointsize 84 \
  -stroke 'rgba(50,20,0,0.65)' -strokewidth 8 -fill '#ffdf9a' -draw "gravity south text 0,26 '$TITLE'" \
  -stroke none -fill '#ffdf9a' -draw "gravity south text 0,26 '$TITLE'" \
  -strip -interlace Plane -quality 88 "$HERE/og.jpg"

ls -lh "$HERE/qr.svg" "$HERE/icon-32.png" "$HERE/icon-180.png" "$HERE/og.jpg" | awk '{print $9, $5}'
