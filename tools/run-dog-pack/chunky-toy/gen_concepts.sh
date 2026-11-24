#!/bin/zsh
# Generate one chunky-toy concept image per breed missing from concepts/.
# Style comes from the reference images (the original four chunky-toy dogs).
cd "${0:A:h}/.."
python3 -c "import csv;[print(r['slug']+'\t'+r['breed']+'\t'+r['look']) for r in csv.DictReader(open('chunky-toy/breeds.csv'))]" |
while IFS=$'\t' read -r slug breed look; do
  [[ -f chunky-toy/concepts/$slug.png ]] && continue
  echo "$slug"
  ( out=$(asset-bot generate image --json --category chunky-toy --aspect-ratio 1:1 --image-size 1K --count 1 \
      --refs chunky-toy/concepts/pug.png chunky-toy/concepts/pembroke-welsh-corgi.png concepts/styles/2-chunky-toy-a.png \
      --prompt "A $breed figure built the same way as the dogs in the reference images: same proportions with an oversized head and short stubby legs, same rounded blocky shapes, same smooth matte surface, same simple black dot eyes. The dog has a $look. The dog stands alone on all four legs in a neutral pose, three-quarter front view from slightly above eye level, small in frame, full body centered with wide empty margin on all sides. Plain light grey background, no other objects, no text." 2>/dev/null)
    p=$(echo "$out" | grep -o '"/[^"]*candidate_001.png"' | head -1 | tr -d '"')
    [[ -n $p ]] && cp "$p" chunky-toy/concepts/$slug.png || echo "FAILED $slug" ) &
  while (( $(jobs -r | wc -l) >= 3 )); do sleep 2; done
done
wait
