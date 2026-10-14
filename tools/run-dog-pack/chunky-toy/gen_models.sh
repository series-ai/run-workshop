#!/bin/zsh
# Turn each concept image into a raw Hunyuan3D mesh (raw/<slug>.glb), skipping ones that exist.
cd "${0:A:h}/.."
for png in chunky-toy/concepts/*.png; do
  slug=${png:t:r}
  [[ -f chunky-toy/raw/$slug.glb ]] && continue
  ( out=$(asset-bot generate 3d --json --category chunky-toy --pipeline single-image --api hunyuan3d \
      --source-image $png --prompt "$slug chunky toy dog figure" </dev/null 2>&1)
    echo "$out" | grep -q '"status": "completed"' && echo "done $slug" || { echo "FAILED $slug"; echo "$out" | tail -5; } ) &
  while (( ${#jobstates} >= 4 )); do sleep 5; done
done
wait
python3 chunky-toy/collect_raw.py
