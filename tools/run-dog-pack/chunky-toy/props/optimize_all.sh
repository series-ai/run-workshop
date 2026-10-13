#!/bin/zsh
# Game-ready props (models/) at their real size next to the dogs, one Blender at a time.
cd "${0:A:h}"
B=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
python3 -c "import csv;[print(r['slug'],r['group'],r['height']) for r in csv.DictReader(open('props.csv'))]" |
while read slug group height; do
  [[ -f models/$slug.glb || ! -f raw/$slug.glb ]] && continue
  tris=800; [[ $group == toy ]] && tris=600; [[ $group == bed ]] && tris=1200
  [[ $slug == dog-house || $slug == crate ]] && tris=1500
  nice -n 19 $B -b -t 1 --factory-startup -P ../optimize.py -- raw/$slug.glb models/$slug.glb previews/$slug.png $tris 512 $height 2>&1 | grep -E '^CHUNKY|Error'
done
