"""The shared avatar rig grid.

Rig space is PN avatar space in glTF axes: the character faces +X, +Y is up,
the right arm points along +Z. One voxel is 0.01 units. Grids that author
avatar parts, skins and body references share one shape and pivot, so a
voxel index means the same place on every rig asset.
"""
from __future__ import annotations

RIG_UNIT = 0.01
RIG_SHAPE = (40, 92, 76)  # x: -0.20..0.20, y: 0..0.92, z: -0.38..0.38
RIG_PIVOT = (20, 0, 38)  # voxel index of the rig origin (feet centre)


def cell_center_gl(i: int, j: int, k: int) -> tuple[float, float, float]:
    return (
        (i - RIG_PIVOT[0] + 0.5) * RIG_UNIT,
        (j - RIG_PIVOT[1] + 0.5) * RIG_UNIT,
        (k - RIG_PIVOT[2] + 0.5) * RIG_UNIT,
    )


def gl_to_bl(v):
    from mathutils import Vector

    return Vector((v[0], -v[2], v[1]))


def bl_to_gl(v):
    return (v[0], v[2], -v[1])


# Joint rest positions in rig space (glTF axes, units) from rig.generated.json.
def _joint_positions() -> dict[str, tuple[float, float, float]]:
    import json
    import os

    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "contracts", "data", "rig.generated.json")
    with open(path) as fh:
        rig = json.load(fh)
    return {j["name"]: tuple(j["worldMatrix"][12:15]) for j in rig["joints"]}


JOINT_POS = _joint_positions()
TORSO_HALF_WIDTH = 0.09  # measured: PN body torso spans |z| < 0.09
ARM_BAND = (0.28, 0.38)  # arms sit at y 0.30–0.36 in the T-pose


def rule_bone(p) -> str:
    """Rigid bone for a rig-space point, split at the PN joint positions."""
    x, y, z = p
    side = "R" if z > 0 else "L"
    az = abs(z)
    if y >= JOINT_POS["Head"][1]:
        return "Head"
    if az >= TORSO_HALF_WIDTH and ARM_BAND[0] <= y < ARM_BAND[1]:
        if az < abs(JOINT_POS["ForeArm.R"][2]):
            return f"Arm.{side}"
        if az < abs(JOINT_POS["Hand.R"][2]):
            return f"ForeArm.{side}"
        return f"Hand.{side}"
    if y >= JOINT_POS["Chest"][1]:
        return "Chest"
    if y >= JOINT_POS["Body"][1]:
        return "Body"
    if y >= JOINT_POS["LowerLeg.R"][1]:
        return f"Leg.{side}"
    if y >= JOINT_POS["Foot.R"][1]:
        return f"LowerLeg.{side}"
    return f"Foot.{side}"


def restricted_bone(p, allowed: list[str]) -> str:
    """rule_bone limited to `allowed`; outside it, the nearest allowed joint."""
    bone = rule_bone(p)
    if bone in allowed:
        return bone
    return min(allowed, key=lambda b: sum((p[i] - JOINT_POS[b][i]) ** 2 for i in range(3)))
