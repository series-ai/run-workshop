"""Package the built Cubix levels and their source grids."""

import json
import sys
from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parent))

import voxchar as vk
from verify_level_voxels import verify_archive


def main():
    args = vk.script_args('Package the Cubix level kits.', 'stage', 'meta')
    entries = json.loads((args.meta / 'level-props.json').read_bytes())
    output = args.meta.parent / 'cubix-level-kits.zip'

    with NamedTemporaryFile(dir=output.parent, suffix='.zip', delete=False) as temp:
        pending = Path(temp.name)
    try:
        with ZipFile(pending, 'w', ZIP_DEFLATED) as archive:
            for pack, props in entries.items():
                folder = vk.leaf_dir(args.stage, pack, props[0]['leaf'])
                for file in ('demo.glb', 'demo.voxels.json'):
                    archive.write(folder / 'level-kit' / file, f'{pack}/{file}')
                archive.write(folder / 'License.txt', f'{pack}/License.txt')
                catalog = []
                for prop in props:
                    path = folder / prop['relativePath']
                    relative = f'props/{path.name}'
                    archive.write(path, f'{pack}/{relative}')
                    catalog.append({**prop, 'relativePath': relative})
                    if 'motion' in prop:
                        motion = folder / prop['motion']['relativePath']
                        archive.write(motion, f'{pack}/vehicles/{motion.name}')
                archive.writestr(f'{pack}/props.json', json.dumps(
                    {'version': 1, 'pack': pack, 'props': catalog}, separators=(',', ':')))
            archive.write(args.meta / 'level-scenes.json', 'level-scenes.json')
            archive.write(Path(__file__).resolve().parents[1] / 'docs/level-voxel-format.md', 'README.md')
        verify_archive(pending)
        pending.replace(output)
    finally:
        pending.unlink(missing_ok=True)
    print(f'Wrote {output}.')


if __name__ == '__main__':
    main()
