#!/bin/zsh
# 1k-tri version of every dog (lowpoly/), then the shared rig on it (rigged/).
# The shared clips (rigged/clips.glb) are authored on the Labrador, a median-proportioned dog.
# One Blender at a time on a single thread. Delete an output to redo that dog.
cd "${0:A:h}"
B=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
for raw in raw/*.glb; do
  slug=${raw:t:r}
  [[ -f lowpoly/$slug.glb ]] || nice -n 19 $B -b -t 1 --factory-startup -P optimize.py -- \
    $raw lowpoly/$slug.glb /tmp/lowpoly-$slug.png 1000 2>&1 | grep -E '^CHUNKY|Error'
  [[ -f rigged/$slug.glb ]] && continue
  clips=; [[ $slug == labrador-retriever ]] && clips=rigged/clips.glb
  nice -n 19 $B -b -t 1 --factory-startup -P rig.py -- \
    lowpoly/$slug.glb rigged/$slug.glb previews-rigged/$slug.png $clips 2>&1 | grep -E '^RIG|^CLIPS|Error'
done
# Colorways are palettes over per-breed mask textures: rebuild the masks after any re-rig.
python3 colorways.py | tail -1   # coat masks + palettes (rigged/coats/, coats.json)
