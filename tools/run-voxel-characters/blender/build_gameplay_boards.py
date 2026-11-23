"""Build original gameplay boards for the Cubix asset library."""

import argparse
import json
import sys
from importlib import import_module
from itertools import product
from math import isfinite, tan
from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile

from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_level_props as level
import voxchar as vk
from gameplay_boards import apocalypse, caverns, medieval, ww2
from gameplay_boards.common import BOARD_PROP_BUDGET, Board
from gameplay_boards.actors import CELL as ACTOR_CELL, actor_clips, actor_palette, actor_part_cell
from gameplay_boards.actors import actors_for, add_actor, sculpt_actor, work_tracks
from gameplay_boards.equipment import CELL as ITEM_CELL, items_for
from gameplay_boards.pickups import with_board_pickups
from level_finish_glb import FINISHES, add_level_mesh, lamp_color, level_builder
from level_geometry import CELL, grounded_center, make_grid, mesh_from_grid, overview_bounds, vertex_colors
from level_scene_glb import INSTANCED_DEMO, LEVEL_YFOV
from level_voxels import encode_prefab, write_voxel_scene
from vehicle_surfaces import apply_vehicle_wear

FACTORIES = {'caverns': caverns.make_board, 'apocalypse': apocalypse.make_board, 'ww2': ww2.make_board,
             'medieval': medieval.make_board}
THEMES = {'caverns': 'dungeon', 'apocalypse': 'post-apocalypse', 'ww2': 'misc', 'medieval': 'fantasy'}
ORIGINAL_THEMES = {key: spec['worldTheme'] for key, spec in vk.PACKS.items() if spec['hasWorldLeaf']}
README = Path(__file__).resolve().parents[1] / 'docs/gameplay-boards.md'
LICENSE = Path(__file__).resolve().parents[3] / 'LICENSE.md'
SOURCE = 'https://github.com/series-ai/run-workshop/tree/main/tools/run-voxel-characters'


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, separators=(',', ':'), allow_nan=False) + '\n', encoding='utf-8')


def export_items(folder, board, definitions):
    assets = {}
    for key, item in definitions.items():
        palette = {**board.palette, **(item.palette or {})}
        grid = make_grid(item.sculpt, item.grip, cell=ITEM_CELL)
        mesh = mesh_from_grid(key, grid)
        colors = vertex_colors(mesh, palette)
        model, raw = f'equipment/{key}.glb', f'equipment/{key}.voxels.json'
        builder = level_builder()
        index = add_level_mesh(builder, mesh, colors, None, lamp_color(mesh, palette))
        builder.doc['nodes'][index].setdefault('extras', {}).update({
            'grip': [0, 0, 0] if item.grip else None, 'up': '+Y', 'forward': '+Z',
        })
        builder.write(folder / model)
        write_json(folder / raw, {'version': 1, 'format': 'cubix-item-voxels', 'voxelSize': ITEM_CELL,
                                  'regions': vk.REGIONS, 'palette': palette,
                                  'grip': [0, 0, 0] if item.grip else None, **encode_prefab(grid)})
        assets[key] = {'label': item.label, 'type': 'equipment', 'role': item.kind,
                       'files': {'mesh': model, 'voxels': raw}}
    return assets


def part_metadata(name, parent, pivot, previous, shape, cell, *, pivot_cell):
    data = {'name': name, 'parent': parent, 'voxelSize': cell,
            'translation': [round((a - b) * pivot_cell, 6) for a, b in zip(pivot, previous, strict=True)]}
    if shape is not None and shape.ops:
        local = [v * pivot_cell / cell for v in pivot]
        data['grid'] = encode_prefab(make_grid(shape, local, cell=cell))
    return data


def export_actors(folder, board, definitions=None):
    assets = {}
    for key, actor in (actors_for(board.key) if definitions is None else definitions).items():
        path = f'actors/{key}.glb'
        raw = f'actors/{key}.voxels.json'
        clips = actor_clips(actor)
        for label, pose in board.work_poses.get(key, {}).items():
            if label in clips:
                raise ValueError(f'{key}: work pose {label} conflicts with an actor clip')
            clips[label] = work_tracks(actor, pose)
        add_actor(folder / path, actor, board.palette, clips=clips)
        pivots = {'actor_root': (0, 0, 0)}
        parts = []
        for name, parent, pivot, shape in sculpt_actor(actor):
            parts.append(part_metadata(name, parent, pivot, pivots[parent], shape, actor_part_cell(name),
                                       pivot_cell=ACTOR_CELL))
            pivots[name] = pivot
        write_json(folder / raw, {'version': 1, 'format': 'cubix-rigid-voxels', 'root': 'actor_root',
                                  'regions': vk.REGIONS, 'palette': actor_palette(actor, board.palette),
                                  'parts': parts, 'clips': clip_data(clips)})
        assets[key] = {'label': actor.label, 'type': 'actor', 'role': actor.role,
                       'files': {'motion': path, 'voxels': raw}, 'clips': list(clips)}
    return assets


def clip_data(clips):
    return {label: [vars(track) for track in tracks] for label, tracks in clips.items()}


def export_vehicle_cells(folder, board, entry, key):
    vehicle = board.vehicles[key]
    root = grounded_center(vehicle.rest())
    travel = level.vehicles.ROLL_PIVOT
    has_travel = level.vehicles.ROLL_CLIP in vehicle.clips
    parts = []
    pivots = {'vehicle_root': root}

    def append_part(name, parent, pivot, shape, cell):
        if shape is not None and shape.ops:
            surface_name = 'vehicle_root' if name == travel else name
            shape = apply_vehicle_wear(key, surface_name, shape, tuple(v * CELL / cell for v in pivot))
        parts.append(part_metadata(name, parent, pivot, pivots[parent or 'vehicle_root'], shape, cell,
                                   pivot_cell=CELL))
        pivots[name] = pivot

    chassis = vehicle.detailed_chassis()
    append_part('vehicle_root', None, root, None if has_travel else chassis, CELL)
    if has_travel:
        append_part(travel, 'vehicle_root', root, chassis, CELL)
    for part in vehicle.parts:
        parent = travel if has_travel and part.parent == 'vehicle_root' else part.parent
        append_part(part.name, parent, part.pivot, part.shape, part.cell)
    raw = f'vehicles/{key}.voxels.json'
    write_json(folder / raw, {
        'version': 1, 'format': 'cubix-rigid-voxels', 'root': 'vehicle_root', 'regions': vk.REGIONS,
        'palette': {**board.palette, **entry.get('palette', {}), 'visor': '#566c78'}, 'parts': parts,
        'wheelRadiusMeters': vehicle.radius,
        'clips': clip_data(vehicle.clips),
        'lamps': entry['motion']['lights'],
    })
    return raw


def validate_gameplay(board, assets):
    points = {point['id']: point for point in board.points}
    if len(points) != len(board.points) or not {board.entry, board.exit} <= points.keys():
        raise ValueError(f'{board.key}: duplicate or missing point IDs')
    known_rewards = set()
    for point in board.points:
        for interaction in point['actions']:
            missing = set(interaction['assets']) - assets.keys()
            if missing:
                raise ValueError(f'{board.key}/{point["id"]}: unknown assets {sorted(missing)}')
            if 'reward' in interaction:
                reward = interaction['reward']
                if reward in known_rewards:
                    raise ValueError(f'{board.key}: duplicate reward {reward}')
                known_rewards.add(reward)
    for route in board.routes:
        if len(set(route['points'])) != 2 or not set(route['points']) <= points.keys():
            raise ValueError(f'{board.key}: route links unknown points {route}')
    dependencies = [interaction['requires'] for point in board.points for interaction in point['actions']]
    dependencies.extend(route['requires'] for route in board.routes)
    unknown = {flag for required in dependencies for flag in required} - known_rewards
    if unknown:
        raise ValueError(f'{board.key}: unknown prerequisite flags: {sorted(unknown)}')
    reached = {board.entry}
    rewards = set()
    while True:
        next_rewards = rewards | {interaction['reward'] for key in reached for interaction in points[key]['actions']
                                  if 'reward' in interaction and set(interaction['requires']) <= rewards}
        next_reached = set(reached)
        for route in board.routes:
            if set(route['requires']) <= next_rewards:
                start, end = route['points']
                if start in reached or (end in reached and route['traversal'] != 'drop'):
                    next_reached.update((start, end))
        if next_reached == reached and next_rewards == rewards:
            break
        reached, rewards = next_reached, next_rewards
    if reached != points.keys() or rewards != known_rewards:
        raise ValueError(f'{board.key}: inaccessible points or rewards {points.keys() - reached}, {known_rewards - rewards}')
    if not any(interaction['kind'] == 'extract' and set(interaction['requires']) <= rewards
               for interaction in points[board.exit]['actions']):
        raise ValueError(f'{board.key}: extraction is inaccessible')


def frame_overview(board, prefabs):
    bounds = overview_bounds(board.placements, prefabs)
    overview, *stops = board.shots
    target = Vector(overview['target'])
    toward_eye = Vector(overview['eye']) - target
    back = toward_eye.normalized()
    right = Vector((0, 1, 0)).cross(back).normalized()
    up = back.cross(right)
    slope = tan(LEVEL_YFOV / 2)
    aspect = 3 / 2

    heights = []
    for placement in board.placements:
        prefab = prefabs[placement['propId']]
        ground = placement['position'][1] + prefab['origin'][1]
        heights.extend((ground, ground + prefab['size'][1] * CELL))
    x, z = bounds['center']
    width, depth = bounds['size']
    corners = product((x - width / 2, x + width / 2),
                      (min(heights), max(heights)),
                      (z - depth / 2, z + depth / 2))
    distance = toward_eye.length
    nearest_offset = float('inf')
    for corner in corners:
        relative = Vector(corner) - target
        depth_offset = relative.dot(back)
        nearest_offset = min(nearest_offset, depth_offset)
        frame = max(abs(relative.dot(right)) / aspect, abs(relative.dot(up)))
        distance = max(distance, depth_offset + frame / (slope * 0.95))
    return {**bounds, 'eye': list(target + back * distance), 'target': list(target),
            'far': max(240, distance - nearest_offset + 6), 'stops': stops}


def write_board_level(folder, board, *, actor_definitions=None, item_definitions=None):
    definitions = items_for(board.key) if item_definitions is None else item_definitions
    board, definitions = with_board_pickups(board, definitions)
    kit = folder / 'level-kit'
    kit.mkdir(parents=True, exist_ok=True)
    props, models, prefabs = level.write_level_models(folder, board, board.palette, budget=BOARD_PROP_BUDGET)
    assets = {}
    for entry in props:
        key = entry['id']
        kind = 'vehicle' if 'motion' in entry else 'prop'
        files = {'mesh': entry['relativePath']}
        asset = {'label': entry['label'], 'type': kind, 'files': files}
        if kind == 'vehicle':
            files['motion'] = entry['motion']['relativePath']
            files['voxels'] = export_vehicle_cells(folder, board, entry, key)
            asset.update({'role': board.vehicle_roles.get(key, 'utility'), 'clips': entry['motion']['clips'],
                          'lamps': entry['motion']['lights']})
        assets[key] = asset
    equipment = export_items(folder, board, definitions)
    actors = export_actors(folder, board, actor_definitions)
    assets.update(equipment)
    assets.update(actors)
    for placement in board.ambient_actors:
        actor = actors.get(placement['asset'])
        if actor is None:
            raise ValueError(f"{board.key}: unknown ambient actor {placement['asset']}")
        if pose := placement.get('pose'):
            if pose['clip'] not in actor['clips'] or not isfinite(pose['seconds']) or pose['seconds'] < 0:
                raise ValueError(f"{board.key}: invalid pose for {placement['asset']}: {pose}")
    validate_gameplay(board, assets)
    gameplay = {
        'format': 'cubix-gameplay-board', 'version': 1, 'key': board.key, 'title': board.title, 'pitch': board.use,
        'units': 'meters', 'axes': {'up': '+Y', 'forward': '+Z'},
        'entry': board.entry, 'exit': board.exit, 'points': board.points, 'routes': board.routes, 'assets': assets,
        'equipment': list(equipment), 'actors': list(actors), 'vehicles': list(board.vehicles),
        'ambientActors': board.ambient_actors,
    }
    layout = {
        'title': board.title, 'route': board.use, 'placements': board.placements, 'gameplay': gameplay,
        'view': frame_overview(board, prefabs),
        'fixtures': board.fixtures, 'environment': board.environment,
    }
    write_json(kit / 'gameplay.json', gameplay)
    level.write_demo(kit / 'demo.glb', board, models, layout, instanced_path=folder / INSTANCED_DEMO)
    write_voxel_scene(kit / 'demo.voxels.json', board.key, CELL, board.palette, prefabs, layout, finishes=FINISHES)
    print(f'{board.title}: {len(props)} props, {len(board.placements)} placements, {len(board.points)} points, '
          f'{len(equipment)} items, {len(actors)} actors, {len(board.vehicles)} vehicles.', flush=True)
    return props, layout


def prepare_original_board(source, key):
    content = import_module(f'gameplay_boards.original_{key}')
    kit = getattr(source, f'{key}_kit')()
    tour, fixtures = source.build_district(kit, source)
    board = Board(**vars(kit), palette=source.PALETTES[key], environment=dict(source.ENVIRONMENTS[key]),
                  fixtures=fixtures)
    target = tour[0]['target']
    board.shot('Board overview', [target[0] + 37, target[1] + 43, target[2] + 48], target)
    board.shots.extend(tour)
    content.extend(board)
    board.environment.setdefault('reviewSkyGradientTop', 0.36)
    return board, content


def build_board(stage, board):
    leaf = f'run-cubix-{board.key}/3D/{THEMES[board.key]}'
    folder = stage / leaf
    write_board_level(folder, board)
    write_board_license(folder, board, 'LicenseRef-RUN-Repository-Supplemental-1.0')
    return leaf


def build_original_board(stage, key):
    board, content = prepare_original_board(level, key)
    folder = vk.leaf_dir(stage, key, 'world')
    write_board_level(folder, board, actor_definitions=content.ACTORS, item_definitions=content.ITEMS)
    write_board_license(folder, board, vk.PACKS[key]['license'])
    return folder.relative_to(stage).as_posix()


def write_board_license(folder, board, license_id):
    if (folder / 'License.txt').is_file():
        return
    if license_id == 'CC0-1.0':
        terms = ('Creative Commons Zero v1.0 Universal (CC0 1.0 Public Domain Dedication)\n'
                 'https://creativecommons.org/publicdomain/zero/1.0/\n')
    else:
        terms = LICENSE.read_text(encoding='utf-8').strip()
    (folder / 'License.txt').write_text(
        f'SPDX-License-Identifier: {license_id}\n'
        f'Source: {SOURCE}\nVerified-by: run-workshop maintainers\n\n'
        f'RUN Cubix | {board.title}\nCopyright (c) 2026 Series Entertainment, Inc.\n\n'
        f'{terms}\n', encoding='utf-8')


def write_archive(stage, leaves, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(dir=target.parent, suffix='.zip', delete=False) as handle:
        pending = Path(handle.name)
    try:
        with ZipFile(pending, 'w', ZIP_DEFLATED) as archive:
            archive.write(README, 'README.md')
            archive.write(README.with_name('level-voxel-format.md'), 'level-voxel-format.md')
            for leaf in leaves:
                folder = stage / leaf
                gameplay_path = 'level-kit/gameplay.json'
                gameplay = json.loads((folder / gameplay_path).read_bytes())
                files = {path for asset in gameplay['assets'].values() for path in asset['files'].values()}
                files.update((gameplay_path, 'License.txt', 'level-kit/demo.glb', 'level-kit/demo.voxels.json', INSTANCED_DEMO))
                for relative in sorted(files):
                    archive.write(folder / relative, f'{leaf}/{relative}')
        pending.replace(target)
    finally:
        pending.unlink(missing_ok=True)
    print(f'Wrote {target}.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage', type=Path, default=Path(__file__).resolve().parents[1] / 'out/board-stage')
    parser.add_argument('--board', choices=(*FACTORIES, *ORIGINAL_THEMES), action='append')
    parser.add_argument('--archive', type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    leaves = [
        build_board(args.stage, FACTORIES[key]()) if key in FACTORIES else build_original_board(args.stage, key)
        for key in args.board or FACTORIES
    ]
    if args.archive:
        write_archive(args.stage, leaves, args.archive)


if __name__ == '__main__':
    main()
