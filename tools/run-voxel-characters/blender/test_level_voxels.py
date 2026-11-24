"""Check that voxel verification rejects a mismatched prop mesh."""

import sys
from io import BytesIO
from pathlib import Path
from unittest import TestCase, defaultTestLoader, TextTestRunner
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parent))

import voxchar as vk
from verify_level_voxels import verify_archive


class LevelArchiveTest(TestCase):
    archive_path: Path

    def test_rejects_wrong_mesh_before_last_prop(self):
        floor = 'core/props/prop_core_concrete_floor.glb'
        wall = 'core/props/prop_core_training_wall.glb'
        corrupt = BytesIO()
        with ZipFile(self.archive_path) as source, ZipFile(corrupt, 'w') as target:
            for name in source.namelist():
                target.writestr(name, source.read(wall if name == floor else name))
        with self.assertRaisesRegex(ValueError, 'prop_core_concrete_floor: GLB model name differs'):
            verify_archive(corrupt)


if __name__ == '__main__':
    LevelArchiveTest.archive_path = vk.script_args('Test the voxel archive verifier.', 'archive').archive
    suite = defaultTestLoader.loadTestsFromTestCase(LevelArchiveTest)
    if not TextTestRunner().run(suite).wasSuccessful():
        raise RuntimeError('Voxel archive verification test failed')
