#!/bin/zsh
# The shared Chonky Hounds rig (../chunky-toy/rig.py) on every cat body: rigged/<body>.glb, wear and a preview.
# Face picks come from faces.json here (RIG_DATA), clips from clips_cat.py (CLIPS_MODULE), authored
# on the Moggy into rigged/clips.glb. One Blender at a time on a single thread.
cd "${0:A:h}"
B=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
for low in lowpoly/*.glb; do
  s=${low:t:r}
  [[ -f rigged/$s.glb ]] && continue
  clips=; [[ $s == moggy ]] && clips=rigged/clips.glb
  RIG_DATA=$PWD CLIPS_MODULE=clips_cat WEAR_KINDS=collar,bandana,bell_collar,neckerchief nice -n 19 $B -b -t 1 --factory-startup -P ../chunky-toy/rig.py -- \
    $low rigged/$s.glb previews-rigged/$s.png $clips 2>&1 | grep -E '^RIG|^CLIPS|Error|Traceback' -A3
done
