"""Check placement edits and rail crossing clearance."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_level_props as level
from level_geometry import CELL, make_grid
from level_upgrade_infrastructure import rail_crossing, rails


class PlacementTests(unittest.TestCase):
    def setUp(self):
        self.kit = level.Kit('core', 'Test yard', 'Follow the lane.', level.MASONRY, level.CAP)

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


class RailCrossingTests(unittest.TestCase):
    def test_timber_leaves_clearance_at_the_rail_heads(self):
        def top_spans(shape):
            grid = make_grid(shape)
            x_start = grid.origin_world[0] - grid.pivot_vox[0] * CELL
            return [(x_start + x * CELL, x_start + (x + 1) * CELL)
                    for x, filled in enumerate(grid.data[:, -1, :].any(axis=1)) if filled]

        heads = top_spans(rails(level))
        planks = top_spans(rail_crossing(level))
        self.assertTrue(heads and planks)
        for start, end in heads:
            for left, right in planks:
                self.assertLessEqual(min(end, right), max(start, left) + 1e-6)


if __name__ == '__main__':
    unittest.main(argv=[__file__])
