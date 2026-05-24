#!/bin/bash
# Конвертирует фото в assets/photos/ в WebP с пережатием.
# Использование:
#   ./convert-photos.sh hero.jpg        — конвертирует один файл
#   ./convert-photos.sh *.jpg            — все jpg
#   ./convert-photos.sh                  — все jpg/jpeg/png в assets/photos/
#
# Требует cwebp. Установить: brew install webp

set -e

PHOTOS_DIR="$(cd "$(dirname "$0")" && pwd)/assets/photos"
QUALITY=78
MAX_WIDTH=1400  # для мобильного приглашения этого достаточно

if ! command -v cwebp >/dev/null 2>&1; then
  echo "❌ cwebp не найден. Установи: brew install webp"
  exit 1
fi

# Если аргументы не переданы — берём все jpg/jpeg/png в папке
if [ $# -eq 0 ]; then
  shopt -s nullglob 2>/dev/null || true
  files=("$PHOTOS_DIR"/*.{jpg,jpeg,JPG,JPEG,png,PNG})
else
  files=("$@")
fi

[ ${#files[@]} -eq 0 ] && { echo "Нечего конвертить в $PHOTOS_DIR"; exit 0; }

for src in "${files[@]}"; do
  [ -f "$src" ] || { echo "пропуск: $src"; continue; }

  # имя без расширения
  base="${src%.*}"
  dst="${base}.webp"

  # размеры до
  src_size=$(stat -f%z "$src")

  cwebp -q $QUALITY -m 6 -resize $MAX_WIDTH 0 "$src" -o "$dst" 2>/dev/null

  dst_size=$(stat -f%z "$dst")
  saved=$(echo "scale=1; (1 - $dst_size/$src_size) * 100" | bc)

  printf "✓ %-30s  %5.1f MB → %4d KB  (-%s%%)\n" \
    "$(basename "$src")" \
    "$(echo "scale=2; $src_size/1024/1024" | bc)" \
    "$(echo "$dst_size/1024" | bc)" \
    "$saved"

  # удаляем оригинал — фото в репо хранится только в WebP
  rm "$src"
done

echo ""
echo "Готово. WebP-файлы в $PHOTOS_DIR"
