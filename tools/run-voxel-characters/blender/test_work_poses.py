"""Check that the actor's hand mounts reach the authored contacts."""

import math
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import bpy
from mathutils import Quaternion, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_gameplay_boards import export_actors
from gameplay_boards.actors import Actor, CELL, sculpt_actor, work_tracks
from gameplay_boards.common import Board
from level_geometry import PALETTES
from render_gameplay_board import place_actor


class WorkPoseTests(unittest.TestCase):
    def test_contacts_stay_fixed_when_actor_is_turned(self):
        actor = Actor('Technician', 'worker', 'human', 'cap', {})
        board = Board('core', 'Core', 'Inspect a part', 0, 0)
        anchor = Vector((6, 0.2, -3))
        turn = Quaternion((0, 1, 0), math.radians(70))
        contact = {side: tuple(anchor + turn @ Vector(target)) for side, target in (
            ('left', (0.19, 1.2, 0.42)), ('right', (-0.17, 1.22, 0.39)),
        )}
        board.stage_work('technician', 'Inspect', anchor.x, anchor.z, y=anchor.y, yaw=70, **contact)
        clip = board.work_poses['technician']['Inspect']
        tracks = {track.part: track for track in work_tracks(actor, clip)}

        def rotation(part):
            x, y, z, w = tracks[part].values[1]
            return Quaternion((w, x, y, z))

        pivots = {part: Vector(pivot) * CELL for part, _, pivot, _ in sculpt_actor(actor)}
        for side, target in contact.items():
            shoulder, elbow, hand = (f'{side}_{part}' for part in ('shoulder', 'elbow', 'hand_mount'))
            posed = pivots[shoulder] + rotation(shoulder) @ (
                pivots[elbow] - pivots[shoulder] + rotation(elbow) @ (pivots[hand] - pivots[elbow]))
            self.assertLess((anchor + turn @ posed - Vector(target)).length, 1e-5)
        self.assertEqual(board.ambient_actors[0]['pose']['clip'], 'Inspect')

    def test_rejects_unreachable_contact(self):
        actor = Actor('Technician', 'worker', 'human', 'cap', {})
        board = Board('core', 'Core', 'Inspect a part', 0, 0)
        board.stage_work('technician', 'Inspect', 0, 0, right=(0, 3, 5))
        with self.assertRaisesRegex(ValueError, 'out of reach'):
            work_tracks(actor, board.work_poses['technician']['Inspect'])

    def test_exported_actor_reaches_contact_in_review_renderer(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        actor = Actor('Technician', 'worker', 'human', 'cap', {})
        board = Board('core', 'Core', 'Inspect a part', 0, 0, palette=PALETTES['core'])
        target = (0.14, 1.24, 0.45)
        board.stage_work('technician', 'Inspect', 0, 0, left=target, yaw=-20, pitch=12)
        anchor = board.ambient_actors[0]
        with TemporaryDirectory() as directory:
            folder = Path(directory)
            assets = export_actors(folder, board, {'technician': actor})
            asset = assets['technician']
            self.assertIn('Inspect', asset['clips'])
            place_actor(folder, asset, anchor['position'], anchor['yaw'], pose=anchor['pose'])
            bpy.context.view_layer.update()
            armature, = (obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE')
            hand = armature.pose.bones['left_hand_mount']
            x, y, z = target
            self.assertLess((armature.matrix_world @ hand.matrix.translation - Vector((x, -z, y))).length, 1e-5)


if __name__ == '__main__':
    unittest.main(argv=[__file__])
