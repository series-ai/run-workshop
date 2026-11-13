"""Write the pack contents from the current exported catalogs."""
from collections import Counter
from pathlib import Path
import json

app = Path(__file__).resolve().parent.parent
manifest = json.loads((app / 'public/assets/manifest.json').read_text())
effects = json.loads((app / 'public/assets/effects.json').read_text())['effects']
characters = [model for model in manifest['models'] if model['kind'] == 'character']
props = [model for model in manifest['models'] if model['kind'] == 'prop']
clips = manifest['animations']
lines = [
    '# Pack contents', '',
    f"{len(characters)} character GLBs share an 18-bone rig. Each contains the same {len(clips)} named clips.", '',
]
for title, items, label in [('Prop category', props, 'Models'), ('Animation category', clips, 'Clips')]:
    lines += [f'| {title} | {label} |', '| --- | ---: |']
    lines += [f'| {category} | {count} |' for category, count in Counter(item['category'] for item in items).items()]
    lines.append('')
lines += [
    f"The pack also contains {len(effects)} procedural effects and {len(effects)} transparent sprite sheets. Each sheet has eight 384×384 frames in a 4×2 layout.", '',
    'Three assembled scenes are supplied as GLB, placement JSON, and editable Blender files. Industrial District provides the playable demo routes. Service Yard and Roof Works are visual assemblies for inspection and reuse.', '',
]
for title, items in [('Characters', characters), ('Props', props), ('Animation clips', clips), ('Effects', effects)]:
    lines += [f'## {title}', '']
    if title in {'Props', 'Animation clips'}:
        for category in dict.fromkeys(item['category'] for item in items):
            lines += [f'### {category}', '', ', '.join(f"`{item['id']}`" for item in items if item['category'] == category) + '.', '']
    else:
        lines += [', '.join(f"`{item['id']}`" for item in items) + '.', '']
lines += ['Regenerate this list with `python3 scripts/write-content-doc.py` after the asset catalogs change.', '']
(app / 'docs/pack-content.md').write_text('\n'.join(lines))
print(f'Wrote {len(characters)} characters, {len(props)} props, {len(clips)} clips, and {len(effects)} effects.')
