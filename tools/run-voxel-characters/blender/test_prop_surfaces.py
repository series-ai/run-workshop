"""Check all level prop finishes in Blender."""

import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_level_props as props
import voxchar as vk
from level_geometry import box, make_mesh


def check_glass():
    pane = box(8, 8, 1, vk.vox('visor'))
    before = pane.cells()
    props.apply_finish('security', 'Glass pane', pane)
    assert pane.cells() == before, 'Glass pane: protected cells changed'


def check_kit(factory):
    # Use the same kit factory to get the sculpts with their original finish.
    with patch.object(props, 'apply_finish', lambda kit, label, sculpt: None):
        base = factory()
    built = factory()
    assert built.placements == base.placements, built.key
    repeated = factory()
    limit = vk.BUDGETS['classes']['prop']['maxTriangles']
    for (asset, label, shape), (baseline_id, _, baseline), (next_id, _, next_shape) in zip(
        built.props, base.props, repeated.props, strict=True,
    ):
        assert asset == baseline_id == next_id, asset
        assert shape.ops == next_shape.ops, f'{asset}: finish changed between builds'
        if asset in built.vehicles:
            assert shape.ops == baseline.ops, f'{asset}: parked vehicle changed'
            continue
        # Use the captured base to check the output of the full kit build.
        before = baseline.cells()
        after = shape.cells()
        assert before.keys() == after.keys(), f'{asset}: occupied cells changed'
        assert before != after, f'{asset}: finish changed no cells'
        for pos, code in before.items():
            index, value, _ = vk._decode_vox(code)
            region = vk.REGIONS[index]
            glass = region == 'visor' and label != 'Shallow water'
            if glass or value == vk.V_EMISSIVE or region == 'accent':
                assert after[pos] == code, f'{label}: protected cell changed at {pos}'
        assert make_mesh(asset, shape).triangles <= limit, f'{asset}: triangle limit exceeded'
    print(f'{built.key}: checked {len(built.props) - len(built.vehicles)} props')


if __name__ == '__main__':
    check_glass()
    for create_kit in (props.core_kit, props.heist_kit, props.industrial_kit,
                       props.security_kit, props.creatures_kit, props.fantasy_kit):
        check_kit(create_kit)
