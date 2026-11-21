"""Check how level builders find and remove an authored placement."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_level_props import CAP, MASONRY, Kit


class PlacementTests(unittest.TestCase):
    def setUp(self):
        self.kit = Kit('core', 'Test yard', 'Follow the lane.', MASONRY, CAP)

    def test_lookup_allows_arithmetic_rounding(self):
        self.kit.place('Cabinet', 0.3 - 0.2, 4.6)
        self.assertIs(self.kit.placement_at('Cabinet', 0.1, 4.6), self.kit.placements[0])

    def test_missing_and_ambiguous_rewrites_fail(self):
        with self.assertRaisesRegex(ValueError, 'Cabinet.*found 0'):
            self.kit.placement_at('Cabinet', 4, 3)
        self.kit.place('Cabinet', 4, 3)
        self.kit.place('Cabinet', 4, 3, height=1)
        with self.assertRaisesRegex(ValueError, 'Cabinet.*found 2'):
            self.kit.remove_at('Cabinet', 4, 3)
        self.kit.remove_at('Cabinet', 4, 3, height=0)
        self.assertEqual(self.kit.placement_at('Cabinet', 4, 3)['position'], [4, 1, 3])


if __name__ == '__main__':
    unittest.main(argv=[__file__])
