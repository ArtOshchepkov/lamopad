#!/usr/bin/env bash

THRESHOLD=-15

find . -mindepth 2 -maxdepth 2 -type f -iname "*.mp3" | while read -r file; do
    mean_volume=$(ffmpeg -i "$file" -af volumedetect -f null - 2>&1 \
        | awk '/mean_volume:/ {print $(NF-1)}')

    if [[ -n "$mean_volume" ]] && (( $(echo "$mean_volume < $THRESHOLD" | bc -l) )); then
        printf "%6s dB  %s\n" "$mean_volume" "$file"
    fi
done
