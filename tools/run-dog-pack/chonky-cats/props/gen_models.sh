#!/bin/zsh
# Raw Hunyuan3D mesh for every cat prop concept missing from raw/ (4 at a time), then collect.
cd "${0:A:h}/../.."
for png in chonky-cats/props/concepts/*.png; do
  slug=${png:t:r}
  [[ $slug == board* ]] && continue
  [[ -f chonky-cats/props/raw/$slug.glb ]] && continue
  ( out=$(asset-bot generate 3d --json --category chonky-cats-props --pipeline single-image --api hunyuan3d \
      --source-image $png --prompt "prop $slug" </dev/null 2>&1)
    echo "$out" | grep -q '"status": "completed"' && echo "done $slug" || echo "FAILED $slug" ) &
  while (( ${#jobstates} >= 4 )); do sleep 5; done
done
wait
python3 - <<'PY'
import glob, json, os, shutil
here = 'chonky-cats/props'
for f in sorted(glob.glob('.asset-bot/runs/*/run-record.json')):
    d = json.load(open(f))
    if d.get('category') != 'chonky-cats-props' or d.get('operationId') != 'generate-3d' or d.get('status') != 'completed':
        continue
    slug = d['prompt'].split(' ', 1)[1]
    g = glob.glob(os.path.join(os.path.dirname(f), 'candidates/*/candidate_001.glb'))
    if g:
        shutil.copy(g[0], f'{here}/raw/{slug}.glb')
print(len(os.listdir(f'{here}/raw')), 'raw props')
PY
