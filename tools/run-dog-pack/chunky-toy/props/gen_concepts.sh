#!/bin/zsh
# Concept image for every prop in props.csv missing from concepts/ (3 at a time).
# Style comes from the chunky-toy dog concepts and style sheet.
cd "${0:A:h}/../.."
python3 -c "import csv;[print(r['slug']+'\t'+r['look']) for r in csv.DictReader(open('chunky-toy/props/props.csv'))]" |
while IFS=$'\t' read -r slug look; do
  [[ -f chunky-toy/props/concepts/$slug.png ]] && continue
  ( out=$(asset-bot generate image --json --category chunky-toy-props --aspect-ratio 1:1 --image-size 1K --count 1 \
      --refs chunky-toy/concepts/pug.png chunky-toy/concepts/pembroke-welsh-corgi.png concepts/styles/2-chunky-toy-a.png \
      --prompt "A single object: $look. Built the same way as the figures in the reference images: rounded chunky simplified shapes, same smooth matte surface, same soft lighting. The object alone in a three-quarter view from slightly above, centered with wide empty margin on all sides. Plain light grey background, no animals, no people, no text." 2>/dev/null)
    p=$(echo "$out" | grep -o '"/[^"]*candidate_001.png"' | head -1 | tr -d '"')
    [[ -n $p ]] && cp "$p" chunky-toy/props/concepts/$slug.png && echo "done $slug" || echo "FAILED $slug" ) &
  while (( ${#jobstates} >= 3 )); do sleep 2; done
done
wait
