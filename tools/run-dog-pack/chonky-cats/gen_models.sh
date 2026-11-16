#!/bin/zsh
# One raw Hunyuan3D mesh per body (raw/<body>.glb) from its concept (bodies.csv), skipping ones that exist.
cd "${0:A:h}/.."
tail -n +2 chonky-cats/bodies.csv | cut -d, -f1,2 | while IFS=, read -r body concept; do
  [[ -f chonky-cats/raw/$body.glb ]] && continue
  ( out=$(asset-bot generate 3d --json --category chonky-cats --pipeline single-image --api hunyuan3d \
      --source-image chonky-cats/concepts/$concept.png --prompt "$body chunky toy cat figure" </dev/null 2>&1)
    echo "$out" | grep -q '"status": "completed"' && echo "done $body" || { echo "FAILED $body"; echo "$out" | tail -5; } ) &
  while (( ${#jobstates} >= 4 )); do sleep 5; done
done
wait
python3 chonky-cats/collect_raw.py
