#!/bin/zsh
# One Chonky Cats concept per breed missing from concepts/.
# Picked style (2026-11-05): A (built like the hounds) for most cats,
# B (rounder, chubbier body) for cobby/round breeds. The picked concepts are the style refs.
cd "${0:A:h}/.."
ROUND=(persian scottish-fold british-shorthair exotic-shorthair himalayan manx)
python3 -c "import csv;[print(r['slug']+'\t'+r['breed']+'\t'+r['look']) for r in csv.DictReader(open('chonky-cats/breeds.csv'))]" |
while IFS=$'\t' read -r slug breed look; do
  [[ -f chonky-cats/concepts/$slug.png ]] && continue
  if (( ${ROUND[(Ie)$slug]} )); then
    body="an oversized round head and a plump round chubby body on short thick stubby legs"
    refs=(chonky-cats/concepts/persian.png chonky-cats/concepts/scottish-fold.png chunky-toy/concepts/pug.png)
  else
    body="an oversized head and short stubby legs"
    refs=(chonky-cats/concepts/ginger-tabby.png chonky-cats/concepts/tuxedo.png chunky-toy/concepts/pug.png)
  fi
  echo "$slug"
  ( out=$(asset-bot generate image --json --category chonky-cats --aspect-ratio 1:1 --image-size 1K --count 1 \
      --refs $refs \
      --prompt "A $breed cat figure built the same way as the cats in the reference images: $body, same rounded blocky shapes, same smooth matte surface, same simple black dot eyes, short cat muzzle, small triangle nose, cat ears. The cat has a $look. The cat stands alone on all four legs in a neutral pose with the tail held up and attached to the rump, three-quarter front view from slightly above eye level, small in frame, full body centered with wide empty margin on all sides. Plain light grey background, no other objects, no text." 2>/dev/null)
    p=$(echo "$out" | grep -o '"/[^"]*candidate_001.png"' | head -1 | tr -d '"')
    [[ -n $p ]] && cp "$p" chonky-cats/concepts/$slug.png || echo "FAILED $slug" ) &
  while (( $(jobs -r | wc -l) >= 3 )); do sleep 2; done
done
wait
