#!/bin/zsh
# Game-ready cat props (models/) at their real size next to the cats, one Blender at a time.
# Sized by props.csv height; flat or long props also list the length they were fitted to (height is
# derived from it, so a flat pad isn't sized by its thickness). Triangle budgets as the Hounds props; the tall cat tree and the ball track keep more for thin posts and rings.
cd "${0:A:h}"
B=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
python3 -c "import csv;[print(r['slug'],r['group'],r['height']) for r in csv.DictReader(open('props.csv'))]" |
while read slug group height; do
  [[ -f models/$slug.glb || ! -f raw/$slug.glb ]] && continue
  tris=800; [[ $group == toy ]] && tris=600; [[ $group == bed ]] && tris=1200
  [[ $slug == cat-tree ]] && tris=2400
  [[ $slug == scratch-post ]] && tris=1200   # the base's corners creased at 800
  [[ $slug == cat-teepee ]] && tris=2500   # flat panels creased at 1200 (the side panel and doorway pinched)
  [[ $slug == cardboard-box || $slug == covered-litter || $slug == laundry-basket ]] && tris=2000   # flat panels / slots creased at 1200
  [[ $slug == ball-track || $slug == cat-condo || $slug == carrier || $slug == mushroom-tree ]] && tris=1500
  [[ $slug == pineapple-house || $slug == strawberry-cave || $slug == mushroom-house || $slug == shark-bed ]] && tris=2000   # doorways / teeth
  nice -n 19 $B -b -t 1 --factory-startup -P ../../chunky-toy/optimize.py -- raw/$slug.glb models/$slug.glb previews/$slug.png $tris 512 $height 2>&1 | grep -E '^CHUNKY|Error'
  [[ $slug == cat-tree ]] && nice -n 19 $B -b -t 1 --factory-startup -P fix_tree.py -- models/$slug.glb 2>&1 | grep -E '^FIXTREE|Error'   # clean house
done
