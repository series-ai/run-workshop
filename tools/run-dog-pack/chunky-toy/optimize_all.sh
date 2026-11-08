#!/bin/zsh
# Optimise every raw mesh missing from models/, one at a time on a single thread
# (laptop battery; other sessions may be using Blender too).
cd "${0:A:h}"
B=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
for raw in raw/*.glb; do
  slug=${raw:t:r}
  [[ -f models/$slug.glb ]] && continue
  nice -n 19 $B -b -t 1 --factory-startup -P optimize.py -- $raw models/$slug.glb previews/$slug.png 2>&1 | grep -E '^CHUNKY|Error'
done
