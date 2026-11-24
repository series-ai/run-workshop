#!/bin/zsh
# Style test: a few cats in two proportion variants, before generating all 30 concepts.
#   a = built exactly like the Chonky Hounds dogs
#   b = chonkier: rounder, fatter body
cd "${0:A:h}/.."
typeset -A V
V[a]="same proportions as the dogs with an oversized head and short stubby legs"
V[b]="an oversized round head and a plump round chubby body on short thick stubby legs, chonkier than the dogs"
for slug in ginger-tabby tuxedo siamese maine-coon persian scottish-fold; do
  IFS=$'\t' read -r breed look < <(python3 -c "import csv;r=[r for r in csv.DictReader(open('chonky-cats/breeds.csv')) if r['slug']=='$slug'][0];print(r['breed']+'\t'+r['look'])")
  for v in a b; do
    f=chonky-cats/concepts/style-test/$slug-$v.png
    [[ -f $f ]] && continue
    ( out=$(asset-bot generate image --json --category chonky-cats --aspect-ratio 1:1 --image-size 1K --count 1 \
        --refs chunky-toy/concepts/pug.png chunky-toy/concepts/pembroke-welsh-corgi.png concepts/styles/2-chunky-toy-a.png \
        --prompt "A $breed cat figure built the same way as the dogs in the reference images: ${V[$v]}, same rounded blocky shapes, same smooth matte surface, same simple black dot eyes. It is clearly a cat, not a dog: short cat muzzle, small triangle nose, cat ears, whisker pads. The cat has a $look. The cat stands alone on all four legs in a neutral pose with the tail held up, three-quarter front view from slightly above eye level, small in frame, full body centered with wide empty margin on all sides. Plain light grey background, no other objects, no text." 2>/dev/null)
      p=$(echo "$out" | grep -o '"/[^"]*candidate_001.png"' | head -1 | tr -d '"')
      [[ -n $p ]] && cp "$p" $f && echo "ok $slug-$v" || echo "FAILED $slug-$v" ) &
    while (( $(jobs -r | wc -l) >= 3 )); do sleep 2; done
  done
done
wait
