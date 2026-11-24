"""Check the ear covers on the caster headwear."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_core import HAT_BRIM_X, HAT_EYE_Y, HAT_NOSE_Y, HEAD_EAR_Z
from build_mages_goblins import headwear_eclipse_mask, headwear_furnace_helm, headwear_mage_hood, headwear_rime_crown
from build_mystics import headwear_necro_cowl


class HeadwearTests(unittest.TestCase):
    def test_closed_caster_headwear_covers_both_ears(self):
        for build in (headwear_mage_hood, headwear_rime_crown, headwear_eclipse_mask,
                      headwear_necro_cowl, headwear_furnace_helm):
            part = build()
            grid, = part.segments
            with self.subTest(part=part.name):
                for x in HAT_BRIM_X:
                    for y in range(HAT_NOSE_Y, HAT_EYE_Y + 2):
                        for z in range(2 * HEAD_EAR_Z, 2 * HEAD_EAR_Z + 2):
                            self.assertTrue(grid.get(x, y, z), (x, y, z))


if __name__ == '__main__':
    unittest.main(argv=[__file__])
