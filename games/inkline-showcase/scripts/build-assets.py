"""Build the complete original pack with Blender and write runtime catalogs."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--blender', default=os.environ.get('BLENDER_PATH') or shutil.which('blender') or '/Applications/Blender.app/Contents/MacOS/Blender')
parser.add_argument('--only', choices=['characters', 'props', 'all'], default='all')
args = parser.parse_args()
for part in ['characters', 'props'] if args.only == 'all' else [args.only]:
    subprocess.run([args.blender, '--background', '--factory-startup', '--python-exit-code', '1', '--python', str(root / 'scripts' / 'blender' / f'{part}.py'), '--', '--out', str(root / 'public/assets')], cwd=root, check=True)
subprocess.run(['node', '--import', 'tsx', 'scripts/build-catalog.ts'], cwd=root, check=True)

if args.only in ['all', 'props']:
    subprocess.run([args.blender, '--background', '--factory-startup', '--python-exit-code', '1', '--python', str(root / 'scripts/blender/level.py'), '--', '--out', str(root / 'public/assets')], cwd=root, check=True)

    for scene in ['service-yard', 'roof-works']:
        subprocess.run([args.blender, '--background', '--factory-startup', '--python-exit-code', '1', '--python', str(root / 'scripts/blender/level.py'), '--', '--out', str(root / 'public/assets'), '--district', str(root / f'public/assets/{scene}.json'), '--target-blend', str(root / f'public/assets/source/{scene}.blend'), '--target-glb', str(root / f'public/assets/scenes/{scene}.glb')], cwd=root, check=True)
