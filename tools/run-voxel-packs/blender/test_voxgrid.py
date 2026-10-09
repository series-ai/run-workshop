"""Clip key helper checks. Run: python3 blender/test_voxgrid.py (needs numpy)."""
from voxgrid import sway, turn


def test_sway_closes_the_loop():
    keys = sway(3.0, amp=(2.0, 0.0, 5.0), phase=(1.2, 0.0, 0.3), cycles=(1, 1, 3))
    assert keys[0][0] == 0.0 and keys[-1][0] == 3.0
    assert keys[-1][1] == keys[0][1]
    assert len(keys) >= 8 * 3 + 1  # enough keys for the fastest channel


def test_sway_base_offsets_the_wave():
    keys = sway(2.0, amp=(0.0, 0.0, 4.0), phase=(0.0, 0.0, 1.5707963267948966), base=(0.0, 0.0, -4.0))
    zs = [v[2] for _, v in keys]
    assert abs(zs[0]) < 1e-9 and min(zs) < -7.9 and max(zs) < 1e-9


def test_sway_rejects_part_cycles():
    try:
        sway(2.0, amp=(1.0, 0.0, 0.0), cycles=(1.5, 1, 1))
    except ValueError:
        return
    raise AssertionError("sway accepted 1.5 cycles, which cannot loop")


def test_turn_makes_whole_turns():
    keys = turn(3.0, "y", 240.0)
    assert keys[-1][1][1] == 720.0


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
