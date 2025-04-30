#!/usr/bin/env bash

# rename_tiles.sh
# Renames all *.png (alphabetically) to tile_1.png, tile_2.png, …

shopt -s nullglob
files=( *.png )

if (( ${#files[@]} == 0 )); then
  echo "No PNG files found."
  exit 0
fi

for i in "${!files[@]}"; do
  old="${files[$i]}"
  new="tile_$((i+1)).png"
  mv -- "$old" "$new"
  echo "Renamed '$old' → '$new'"
done

echo "Done. ${#files[@]} files renamed."
