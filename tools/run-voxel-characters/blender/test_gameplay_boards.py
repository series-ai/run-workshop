"""Check the gameplay boards and the files they publish."""

import json
import math
import os
import sys
import unittest
from collections import defaultdict
from itertools import product
from pathlib import Path

import numpy as np
from mathutils import Quaternion, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

from verify_level_voxels import read_glb, read_accessor
from voxchar import PACKS, accessor_array

APPROVED_BOARDS = {'caverns': 'dungeon', 'apocalypse': 'post-apocalypse', 'ww2': 'misc', 'medieval': 'fantasy'}
ORIGINAL_BOARDS = {key: spec['worldTheme'] for key, spec in PACKS.items() if spec['hasWorldLeaf']}


def board_leaves(stage):
    themes = {**APPROVED_BOARDS, **ORIGINAL_BOARDS}
    if selected := os.environ.get('CUBIX_BOARD_KEYS'):
        keys = selected.split(',')
    else:
        keys = [*APPROVED_BOARDS, *(key for key, theme in ORIGINAL_BOARDS.items()
                                  if (stage / f'run-cubix-{key}/3D/{theme}/level-kit/demo.glb').is_file())]
    return [(key, stage / f'run-cubix-{key}/3D/{themes[key]}') for key in keys]


def occupied_at(voxels):
    rows = {}
    cell = voxels['voxelSize']
    for key, prefab in voxels['prefabs'].items():
        lookup = defaultdict(list)
        for x, y, z, count, _ in prefab['runs']:
            lookup[y, z].append((x, x + count))
        rows[key] = lookup
    placements = [(p['position'], p['turn'], voxels['prefabs'][p['propId']], rows[p['propId']])
                  for p in voxels['scene']['placements']]

    def occupied(position):
        for (px, py, pz), turn, prefab, lookup in placements:
            x, y, z = position[0] - px, position[1] - py, position[2] - pz
            x, z = ((x, z), (-z, x), (-x, -z), (z, -x))[turn]
            ox, oy, oz = prefab['origin']
            iy = math.floor((y - oy) / cell + 1e-7)
            iz = math.floor((z - oz) / cell + 1e-7)
            ix = math.floor((x - ox) / cell + 1e-7)
            if any(left <= ix < right for left, right in lookup.get((iy, iz), ())):
                return True
        return False

    return occupied


class BoardExportTests(unittest.TestCase):
    def test_actors_use_one_rigid_skinned_draw(self):
        stage = Path(os.environ['CUBIX_BOARD_STAGE'])
        for path in sorted(stage.glob('run-cubix-*/3D/*/level-kit/gameplay.json')):
            gameplay = json.loads(path.read_bytes())
            for actor_id in gameplay['actors']:
                with self.subTest(board=gameplay['key'], actor=actor_id):
                    asset = gameplay['assets'][actor_id]
                    doc, binary = read_glb((path.parent.parent / asset['files']['motion']).read_bytes())
                    mesh_nodes = [node for node in doc['nodes'] if 'mesh' in node]
                    self.assertEqual(len(mesh_nodes), 1)
                    mesh, = mesh_nodes
                    primitive, = doc['meshes'][mesh['mesh']]['primitives']
                    skin = doc['skins'][mesh['skin']]
                    joints = {doc['nodes'][index]['name'] for index in skin['joints']}
                    self.assertTrue({'actor_root', 'left_hand_mount', 'right_hand_mount'} <= joints)
                    self.assertLessEqual(doc['accessors'][primitive['indices']]['count'] // 3, 2200)
                    attributes = primitive['attributes']
                    weights = accessor_array(doc, binary, attributes['WEIGHTS_0'])
                    normals = accessor_array(doc, binary, attributes['NORMAL'])
                    self.assertTrue(np.array_equal(weights[0], [1, 0, 0, 0]) and np.all(weights == weights[0]))
                    self.assertTrue(np.all(np.count_nonzero(normals, axis=1) == 1))
                    self.assertTrue(np.all(np.max(np.abs(normals), axis=1) == 1))
                    parts_path = path.parent.parent / asset['files']['voxels']
                    raw = json.loads(parts_path.read_bytes())
                    parts = {part['name']: part for part in raw['parts']}
                    positions = accessor_array(doc, binary, attributes['POSITION'])
                    vertex_joints = accessor_array(doc, binary, attributes['JOINTS_0'])[:, 0]
                    joint_by_name = {doc['nodes'][node]['name']: index for index, node in enumerate(skin['joints'])}
                    pivots = {raw['root']: np.zeros(3)}
                    for part in raw['parts']:
                        name = part['name']
                        pivots[name] = pivots[part['parent']] + part['translation']
                        if 'grid' not in part:
                            continue
                        cell = 0.025 if name == 'head' else 0.05
                        self.assertEqual(part['voxelSize'], cell, name)
                        grid = part['grid']
                        local = positions[vertex_joints == joint_by_name[name]]
                        self.assertGreater(len(local), 0, name)
                        on_grid = local / cell
                        np.testing.assert_allclose(on_grid, np.round(on_grid), atol=1e-4)
                        rows = np.asarray(grid['runs'])
                        origin = pivots[name] + grid['origin']
                        lower = origin + rows[:, :3].min(axis=0) * cell
                        upper = origin + np.max(rows[:, :3] + np.stack(
                            (rows[:, 3], np.ones(len(rows)), np.ones(len(rows))), axis=-1), axis=0) * cell
                        np.testing.assert_allclose(local.min(axis=0), lower, atol=1e-6)
                        np.testing.assert_allclose(local.max(axis=0), upper, atol=1e-6)
                    def occupied_cells(name):
                        grid = parts[name]['grid']
                        origin = np.rint((pivots[name] + grid['origin']) / 0.05).astype(int)
                        return {(origin[0] + ix, origin[1] + y, origin[2] + z)
                                for x, y, z, count, _ in grid['runs']
                                for ix in range(x, x + count)}

                    for side in ('left', 'right'):
                        self.assertFalse(occupied_cells('torso') &
                                         occupied_cells(f'{side}_shoulder'), f'{side} shoulder')
                        self.assertFalse(occupied_cells(f'{side}_shoulder') &
                                         occupied_cells(f'{side}_elbow'), f'{side} elbow')
                        self.assertFalse(occupied_cells('torso') &
                                         occupied_cells(f'{side}_hip'), f'{side} hip')
                    self.assertAlmostEqual(float(positions[:, 1].min()), 0)
                    if gameplay['key'] != 'caverns':
                        self.assertGreaterEqual(float(positions[:, 1].max()), 1.9 - 1e-6)
                        self.assertLessEqual(float(positions[:, 1].max()), 1.95 + 1e-6)
                    for side in ('left', 'right'):
                        hand = parts[f'{side}_hand_mount']
                        grid = parts[hand['parent']]['grid']
                        x, y, z = np.floor((np.array(hand['translation']) - grid['origin']) / 0.05).astype(int)
                        self.assertFalse(any(row_y == y and row_z in (z - 1, z)
                                             and here <= x < here + count
                                             for here, row_y, row_z, count, _ in grid['runs']), side)


    def test_expanded_levels_have_double_the_contiguous_terrain(self):
        stage = Path(os.environ['CUBIX_BOARD_STAGE'])
        dimensions = {
            'caverns': ('dungeon', 8, 6, (-32, 32, -24, 24)),
            'apocalypse': ('post-apocalypse', 10, 8, (-40, 40, -32, 32)),
            'ww2': ('misc', 11, 9, (-40, 48, -40, 32)),
        }
        for key, (theme, width, depth, previous) in dimensions.items():
            with self.subTest(board=key):
                source = stage / f'run-cubix-{key}/3D/{theme}/level-kit/demo.voxels.json'
                if not source.is_file():
                    continue
                voxels = json.loads(source.read_bytes())
                self.assertEqual(voxels['voxelSize'], 0.1)
                full_tiles = set()
                for asset, prefab in voxels['prefabs'].items():
                    nx, ny, nz = prefab['size']
                    if (nx, nz) != (80, 80) or ny > 12:
                        continue
                    layers = [0] * ny
                    for _, layer, _, length, _ in prefab['runs']:
                        layers[layer] += length
                    if 80 * 80 in layers:
                        full_tiles.add(asset)
                terrain = [(x, z) for placement in voxels['scene']['placements']
                           if placement['propId'] in full_tiles
                           for x, y, z in [placement['position']] if y < 0]
                self.assertEqual(len(terrain), len(set(terrain)), 'Repeated terrain cell')
                self.assertEqual(len(terrain), 2 * width * depth, 'Expected twice the original 8 m tile count')
                xs, zs = (sorted(set(axis)) for axis in zip(*terrain, strict=True))
                self.assertIn((len(xs), len(zs)), ((2 * width, depth), (width, 2 * depth)))
                self.assertTrue(all(right - left == 8 for axis in (xs, zs) for left, right in zip(axis, axis[1:])))
                west, east, south, north = previous
                added = [point for point in voxels['scene']['gameplay']['points']
                         for x, _, z in [point['position']] if not (west <= x <= east and south <= z <= north)]
                self.assertGreaterEqual(len(added), 4, 'Expected four gameplay points beyond the previous footprint')
                self.assertTrue(all(point['actions'] for point in added), 'New points need gameplay actions')

    def test_review_cameras_start_clear_of_the_art(self):
        stage = Path(os.environ['CUBIX_BOARD_STAGE'])
        for leaf in sorted(stage.glob('run-cubix-*/3D/*')):
            scene_path = leaf / 'level-kit/demo.voxels.json'
            if not scene_path.is_file():
                continue
            voxels = json.loads(scene_path.read_bytes())
            occupied = occupied_at(voxels)
            view = voxels['scene']['view']
            shots = [{'label': 'Board overview', **view}, *view['stops']]
            for shot in shots:
                with self.subTest(board=voxels['scene']['title'], camera=shot['label']):
                    eye = Vector(shot['eye'])
                    direction = (Vector(shot['target']) - eye).normalized()
                    self.assertFalse(occupied(eye), 'Camera starts inside a voxel')
                    for distance in (0.15, 0.30):
                        self.assertFalse(
                            occupied(eye + direction * distance),
                            f'Geometry blocks the center of the view at {distance} m',
                        )

    def test_ambient_actors_have_supported_spawn_anchors(self):
        stage = Path(os.environ['CUBIX_BOARD_STAGE'])
        for path in sorted(stage.glob('run-cubix-*/3D/*/level-kit/demo.voxels.json')):
            raw = json.loads(path.read_bytes())
            gameplay = raw['scene']['gameplay']
            anchors = gameplay.get('ambientActors', [])
            with self.subTest(board=gameplay['key']):
                self.assertGreaterEqual(len(anchors), 3)
                used = set()
                occupied = occupied_at(raw)
                for anchor in anchors:
                    self.assertIn(anchor['asset'], gameplay['actors'])
                    self.assertTrue(math.isfinite(anchor['yaw']))
                    x, y, z = anchor['position']
                    self.assertNotIn((x, y, z), used)
                    used.add((x, y, z))
                    context = f"{anchor['asset']} at {(x, y, z)}"
                    self.assertTrue(any(occupied((x, y - h, z)) for h in (0.06, 0.14, 0.23)), context)
                    for h in (0.25, 0.8, 1.55):
                        self.assertFalse(occupied((x, y + h, z)), context)

    def test_instanced_export_preserves_render_content_and_reduces_submissions(self):
        stage = Path(os.environ['CUBIX_BOARD_STAGE'])
        extension = 'EXT_mesh_gpu_instancing'
        for filename in sorted(stage.glob('run-cubix-*/3D/*/level-kit/demo.glb')):
            with self.subTest(board=filename.parts[-5]):
                optimized = filename.with_name('demo.instanced.glb')
                self.assertTrue(optimized.is_file(), 'Missing instanced scene')
                plain, plain_bin = read_glb(filename.read_bytes())
                compact, data = read_glb(optimized.read_bytes())
                self.assertEqual(compact['meshes'], plain['meshes'])
                self.assertEqual(compact['materials'], plain['materials'])
                self.assertEqual(compact['cameras'], plain['cameras'])
                self.assertEqual(compact['extensions'], plain['extensions'])
                self.assertEqual(compact['scenes'][0]['extras'], plain['scenes'][0]['extras'])
                self.assertEqual(data[:plain['buffers'][0]['byteLength']],
                                 plain_bin[:plain['buffers'][0]['byteLength']])
                self.assertIn(extension, compact['extensionsRequired'])

                def content(document, binary):
                    instances, submissions, other = [], 0, []
                    for node_index in document['scenes'][0]['nodes']:
                        node = document['nodes'][node_index]
                        if 'mesh' not in node:
                            other.append(node)
                            continue
                        mesh = node['mesh']
                        submissions += len(document['meshes'][mesh]['primitives'])
                        attributes = node.get('extensions', {}).get(extension, {}).get('attributes')
                        translates = [node['translation']] if not attributes else read_accessor(
                            document, binary, attributes['TRANSLATION'], 3)
                        rotations = [node['rotation']] if not attributes else read_accessor(
                            document, binary, attributes['ROTATION'], 4)
                        for pos, turn in zip(translates, rotations, strict=True):
                            instances.append((mesh, tuple(round(float(v), 4) for v in pos), tuple(round(float(v), 5) for v in turn)))
                    return instances, submissions, other

                original, draws_before, other_before = content(plain, plain_bin)
                batched, draws_after, other_after = content(compact, data)
                self.assertCountEqual(batched, original)
                self.assertEqual(other_after, other_before)
                self.assertLessEqual(draws_after, 0.70 * draws_before)

    def test_overview_camera_contains_the_exported_board(self):
        stage = Path(os.environ['CUBIX_BOARD_STAGE'])
        for glb in sorted(stage.glob('run-cubix-*/3D/*/level-kit/demo.glb')):
            doc, _ = read_glb(glb.read_bytes())
            approach = next(node for node in doc['nodes'] if node.get('name') == 'Approach')
            eye = Vector(approach['translation'])
            x, y, z, w = approach['rotation']
            view = Quaternion((w, x, y, z)).inverted()
            lens = doc['cameras'][approach['camera']]['perspective']
            slope = math.tan(lens['yfov'] / 2)
            with self.subTest(board=glb.parts[-5]):
                for node in doc['nodes']:
                    if 'mesh' not in node:
                        continue
                    mesh = doc['meshes'][node['mesh']]
                    index = mesh['primitives'][0]['attributes']['POSITION']
                    bounds = doc['accessors'][index]
                    position = Vector(node['translation'])
                    x, y, z, w = node['rotation']
                    rotation = Quaternion((w, x, y, z))
                    for corner in product(*zip(bounds['min'], bounds['max'], strict=True)):
                        right, up, back = view @ (position + rotation @ Vector(corner) - eye)
                        depth = -back
                        self.assertGreater(depth, lens['znear'], node['name'])
                        self.assertLess(depth, lens['zfar'], node['name'])
                        self.assertLessEqual(abs(right), depth * slope * 1.5, node['name'])
                        self.assertLessEqual(abs(up), depth * slope, node['name'])

    def test_original_world_leaves_include_gameplay(self):
        stage = Path(os.environ['CUBIX_BOARD_STAGE'])
        for key, leaf in board_leaves(stage):
            if key not in ORIGINAL_BOARDS:
                continue
            kit = leaf / 'level-kit'
            with self.subTest(pack=key):
                self.assertTrue((kit / 'gameplay.json').is_file(), 'Missing gameplay export')
                data = json.loads((kit / 'gameplay.json').read_bytes())
                self.assertGreaterEqual(len(data['points']), 12)
                self.assertGreaterEqual(len(data['equipment']), 9)
                self.assertGreaterEqual(len(data['routes']), len(data['points']))
                self.assertGreaterEqual(len(data['ambientActors']), 3)
                self.assertTrue(any(route['requires'] for route in data['routes']))
                self.assertTrue((kit / 'demo.instanced.glb').is_file())

    def test_optional_pickups_have_reusable_assets(self):
        stage = Path(os.environ['CUBIX_BOARD_STAGE'])
        for key, leaf in board_leaves(stage):
            board = json.loads((leaf / 'level-kit/gameplay.json').read_bytes())
            with self.subTest(board=key):
                pickups = [(point, action) for point in board['points'] for action in point['actions']
                           if action['kind'] == 'pickup' and action.get('reward', '').startswith('found_')]
                self.assertEqual(len(pickups), 5)
                self.assertEqual(len({point['id'] for point, _ in pickups}), 5)
                dependencies = {flag for point in board['points'] for action in point['actions']
                                for flag in action['requires']}
                dependencies.update(flag for route in board['routes'] for flag in route['requires'])
                self.assertTrue(dependencies.isdisjoint(action['reward'] for _, action in pickups))
                items = []
                for _, action in pickups:
                    item, = action['assets']
                    self.assertIn(item, board['equipment'])
                    items.append(board['assets'][item])
                self.assertEqual(sum(item['role'] == 'collectible' for item in items), 2)
                for item in items:
                    raw = json.loads((leaf / item['files']['voxels']).read_bytes())
                    doc, binary = read_glb((leaf / item['files']['mesh']).read_bytes())
                    mesh, = (node for node in doc['nodes'] if 'mesh' in node)
                    self.assertEqual(mesh['extras']['grip'], raw['grip'])
                    primitive, = doc['meshes'][mesh['mesh']]['primitives']
                    vertices = accessor_array(doc, binary, primitive['attributes']['POSITION'])
                    starts = np.asarray(raw['runs'])[:, :3]
                    spans = np.asarray(raw['runs'])[:, 3]
                    ends = starts + np.column_stack((spans, np.ones((len(starts), 2))))
                    np.testing.assert_allclose(vertices.min(axis=0),
                                               raw['origin'] + starts.min(axis=0) * raw['voxelSize'], atol=1e-6)
                    np.testing.assert_allclose(vertices.max(axis=0),
                                               raw['origin'] + ends.max(axis=0) * raw['voxelSize'], atol=1e-6)
                    if item['role'] in ('weapon', 'melee'):
                        self.assertEqual(raw['grip'], [0, 0, 0])

    def test_all_boards_are_loadable_and_connected(self):
        stage = Path(os.environ['CUBIX_BOARD_STAGE'])
        for key, leaf in board_leaves(stage):
            with self.subTest(board=key):
                manifest_path = leaf / 'level-kit/gameplay.json'
                self.assertTrue(manifest_path.is_file(), f'Missing {key} board export')
                board = json.loads(manifest_path.read_bytes())
                voxels = json.loads((leaf / 'level-kit/demo.voxels.json').read_bytes())
                doc, _ = read_glb((leaf / 'level-kit/demo.glb').read_bytes())
                points = {point['id']: point for point in board['points']}
                self.assertGreaterEqual(len(points), 7)
                self.assertEqual(len(points), len(board['points']))
                self.assertGreaterEqual(len(voxels['prefabs']), 30)
                self.assertGreaterEqual(len(voxels['scene']['placements']), 110)
                mesh_nodes = [node for node in doc['nodes'] if 'mesh' in node]
                self.assertEqual(len(mesh_nodes), len(voxels['scene']['placements']))
                for node, placement in zip(mesh_nodes, voxels['scene']['placements'], strict=True):
                    self.assertEqual(node['translation'], placement['position'])
                    self.assertEqual(doc['meshes'][node['mesh']]['name'], placement['propId'])
                self.assertEqual(doc['scenes'][0]['extras']['cubixGameplay'], board)
                self.assertEqual(voxels['scene']['gameplay'], board)

                def play(blocked=()):
                    reached = {board['entry']}
                    unlocked = set()
                    for _ in range(len(points) * 3):
                        previous = len(reached), len(unlocked)
                        for point_id in reached:
                            for action in points[point_id]['actions']:
                                reward = action.get('reward')
                                if reward and reward not in blocked and set(action['requires']) <= unlocked:
                                    unlocked.add(reward)
                        for link in board['routes']:
                            if set(link['requires']) <= unlocked:
                                a, b = link['points']
                                if a in reached or b in reached and link['traversal'] != 'drop':
                                    reached.update((a, b))
                        if previous == (len(reached), len(unlocked)):
                            break
                    escaped = board['exit'] in reached and any(
                        action['kind'] == 'extract' and set(action['requires']) <= unlocked
                        for action in points[board['exit']]['actions'])
                    return reached, escaped

                reached, escaped = play()
                self.assertEqual(reached, set(points))
                self.assertTrue(escaped)
                alternatives = {
                    'apocalypse': ('gate_open', 'service_bypass'),
                    'ww2': ('bridge_ready', 'pontoon_orders'),
                    'medieval': ('gate_repaired', 'postern_open'),
                    'core': ('lift_inspected', 'air_released'),
                    'heist': ('parcel_packed', 'stand_packed'),
                    'industrial': ('line_ready', 'cooling_routed'),
                    'security': ('main_lane_released', 'service_lane_released'),
                    'creatures': ('main_trail_open', 'woodland_trail_open'),
                    'fantasy': ('tile_gate_open', 'ribbon_gate_open'),
                }
                if key == 'medieval':
                    self.assertTrue({'castle', 'smithy', 'apothecary', 'market', 'garden', 'mill'} <= points.keys())
                    self.assertFalse(play(('court_seal',))[1])
                if key in alternatives:
                    first, second = alternatives[key]
                    self.assertTrue(play((first,))[1], f'{key}: the alternate route is blocked')
                    self.assertTrue(play((second,))[1], f'{key}: the main route is blocked')
                    self.assertFalse(play((first, second))[1], f'{key}: extraction bypasses both gates')
                else:
                    self.assertFalse(play(('royal_seal_recovered',))[1])
                self.assertGreaterEqual(len(board['routes']), len(points))
                self.assertGreaterEqual(len(board['equipment']), 9)

                for point in points.values():
                    for action in point['actions']:
                        for asset in action.get('assets', []):
                            self.assertIn(asset, board['assets'])
                for asset in board['assets'].values():
                    for path in asset['files'].values():
                        self.assertTrue((leaf / path).is_file(), path)
                for item in board['equipment']:
                    asset = board['assets'][item]
                    raw = json.loads((leaf / asset['files']['voxels']).read_bytes())
                    self.assertEqual(raw['voxelSize'], 0.025)
                for asset_id in board['vehicles'] + board['actors']:
                    asset = board['assets'][asset_id]
                    motion, binary = read_glb((leaf / asset['files']['motion']).read_bytes())
                    raw = json.loads((leaf / asset['files']['voxels']).read_bytes())
                    self.assertEqual(list(raw['clips']), asset['clips'])
                    self.assertEqual([clip['name'] for clip in motion['animations']], asset['clips'])
                    self.assertIn(raw['root'], [node['name'] for node in motion['nodes']])
                    for clip in motion['animations']:
                        for channel, raw_track in zip(clip['channels'], raw['clips'][clip['name']], strict=True):
                            target = channel['target']
                            node = motion['nodes'][target['node']]
                            self.assertEqual(node['name'], raw_track['part'])
                            self.assertEqual(target['path'], raw_track['path'])
                            sampler = clip['samplers'][channel['sampler']]
                            components = 4 if target['path'] == 'rotation' else 3
                            samples = read_accessor(motion, binary, sampler['output'], components)
                            rest = node.get('translation', [0, 0, 0]) if target['path'] == 'translation' else [0] * components
                            for sample, raw_value in zip(samples, raw_track['values'], strict=True):
                                expected = [a + b for a, b in zip(raw_value, rest, strict=True)]
                                self.assertLess(math.dist(sample, expected), 1e-5)
                            self.assertTrue(any(math.dist(samples[0], frame) > 1e-3 for frame in samples[1:]))

                occupied = occupied_at(voxels)
                spacing = voxels['voxelSize']

                def check_walk(position):
                    x, y, z = position
                    label = f"{key} walk clearance at {tuple(round(v, 2) for v in position)}"
                    self.assertTrue(any(occupied((x, y - offset, z)) for offset in (0.06, 0.14, 0.23)), label)
                    for height in (0.35, 0.85, 1.55):
                        self.assertFalse(occupied((x, y + height, z)), label)

                for point in points.values():
                    check_walk(point['position'])
                for route in board['routes']:
                    if route['traversal'] != 'walk':
                        continue
                    start, finish = route['points']
                    path = [points[start]['position'], *route['waypoints'], points[finish]['position']]
                    for a, b in zip(path, path[1:]):
                        samples = max(1, math.ceil(math.dist(a, b) / spacing))
                        for step in range(1, samples):
                            check_walk([x + (y - x) * step / samples for x, y in zip(a, b, strict=True)])
                if key == 'ww2':
                    self.assertGreaterEqual(len(board['vehicles']), 18)
                    crane = board['assets']['prop_ww2_dockside_lifting_crane']
                    self.assertIn('prop_ww2_dockside_lifting_crane', board['vehicles'])
                    self.assertEqual(crane['clips'], ['Slew crane', 'Raise hook'])
                else:
                    self.assertGreaterEqual(len(board['actors']), 3)


if __name__ == '__main__':
    unittest.main(argv=[__file__])
