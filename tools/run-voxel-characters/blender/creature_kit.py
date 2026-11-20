"""Creature sculpt kit: one lattice, one authoring space, one bind formula, and the quadruped checks.

Use this module for each voxel creature. `build_creatures.py` (the Guard Hound) is the reference.
`docs/art-direction.md` section 10 gives the reason for each rule.

Creature space
    +Y is up, +Z is forward, +X is the left side. Author each creature in this space.
    A rig that faces +X is turned into this space (`FORWARD_AXES`): do not swap the axes in a sculpt.

World lattice
    All segments of a creature use one lattice. Cell c on X is [(c - 0.5), (c + 0.5)] * voxel: the body
    is symmetric about x = 0 and an odd width (5, 7, 9) is centred. Cell j on Y or Z is [j, j + 1] * voxel:
    the paws stop on y = 0. A sculpt gives world lattice cells. It never gives cells relative to a joint.

Bind
    A segment is sculpted in the rest pose of the rig. `CreatureSculptor` stores each vertex as
    inverse(W_j @ IBM_j) @ vertex, where W_j is the rest world matrix of the joint node and IBM_j is its
    inverse bind matrix. The skinned rest pose is then the sculpt, for each scale and each rotation of the rig.

Checks
    `QuadrupedAudit` stops a build that breaks a rule of `contracts/data/proportions.json` -> `quadruped`.
"""

from __future__ import annotations

import copy
import math
import re
from pathlib import Path

import numpy as np

import voxchar as vk

# One pad level, as a part of one voxel. `CreatureSculptor.seg(pad=n)` lifts the faces of a segment by n levels.
PAD_LEVEL = 0.025
# A joint within this part of one voxel of x = 0 is a centre joint.
CENTRE_TOLERANCE = 0.5

# Rotation from rig space to creature space: creature = R @ rig.
FORWARD_AXES = {
    '+Z': np.eye(3),
    # The rig faces +X and its left side is -Z.
    '+X': np.array([[0.0, 0.0, -1.0], [0.0, 1.0, 0.0], [1.0, 0.0, 0.0]]),
}

QUADRUPED_RULES = vk.PROPORTION_CONTRACT['quadruped']['silhouette']
MOTION_RULES = vk.PROPORTION_CONTRACT['creature']['motion']
TRUNK, HEAD = 'trunk', 'head'
LIMBS = ('front', 'back')
REQUIRED_ROLES = (TRUNK, HEAD, 'front_lower', 'front_paw', 'back_lower', 'back_paw')
ROLES = REQUIRED_ROLES + ('front_upper', 'back_upper')


# --------------------------------------------------------------------------
# Sculpt: one rigid segment as cell boxes
# --------------------------------------------------------------------------

def _span(value):
    low, high = (value, value) if isinstance(value, int) else value
    if low > high:
        raise ValueError(f'Cell span ({low}, {high}) is reversed.')
    return int(low), int(high)


class Sculpt:
    """One rigid voxel segment as a list of inclusive cell boxes. A later box overwrites an earlier box.

    Each axis is one cell (int) or a (low, high) span. The grid bounds come from the boxes, so no box is clipped.
    """

    def __init__(self):
        self.ops = []
        self.eye_cells = []   # ((x, y, z), facing) for each eye cell. `QuadrupedAudit` reads it.

    def box(self, x, y, z, code):
        self.ops.append((_span(x), _span(y), _span(z), int(code), False))
        return self

    def both(self, x, y, z, code):
        """A box and its mirror across x = 0. Use it on a centre segment."""
        low, high = _span(x)
        return self.box((low, high), y, z, code).box((-high, -low), y, z, code)

    def cut(self, x, y, z):
        return self.box(x, y, z, 0)

    def paint(self, x, y, z, code):
        """Change the colour of the filled cells in a box. Empty cells stay empty."""
        self.ops.append((_span(x), _span(y), _span(z), int(code), True))
        return self

    def paint_both(self, x, y, z, code):
        low, high = _span(x)
        return self.paint((low, high), y, z, code).paint((-high, -low), y, z, code)

    def eyes(self, x, y, z, code, *, facing='front'):
        """A pair of eyes: a box and its mirror across x = 0, on the head segment.

        Put the box in the surface cells of the skull: an eye is flush. `facing` is 'front' (the eye shows
        on the +Z face: a dog, a cat) or 'side' (the eye shows on the outer X face: a horse).
        """
        if facing not in ('front', 'side'):
            raise ValueError(f'Eye facing "{facing}" is not "front" or "side".')
        (x0, x1), (y0, y1), (z0, z1) = _span(x), _span(y), _span(z)
        if x0 <= 0:
            raise ValueError('Give the left eye (x > 0). The right eye is its mirror.')
        self.both(x, y, z, code)
        for cx in range(x0, x1 + 1):
            for cy in range(y0, y1 + 1):
                for cz in range(z0, z1 + 1):
                    self.eye_cells.append(((cx, cy, cz), facing))
                    self.eye_cells.append(((-cx, cy, cz), facing))
        return self

    def bounds(self, cell=(0, 0, 0)):
        solid = [op for op in self.ops if op[3] and not op[4]]
        if not solid:
            raise ValueError('The sculpt has no filled box.')
        return [(min(op[axis][0] for op in solid) - cell[axis], max(op[axis][1] for op in solid) - cell[axis])
                for axis in range(3)]

    def write(self, grid, cell=(0, 0, 0)):
        cx, cy, cz = cell
        for (x0, x1), (y0, y1), (z0, z1), code, only_filled in self.ops:
            box = (x0 - cx, y0 - cy, z0 - cz, x1 - cx, y1 - cy, z1 - cz)
            if not only_filled:
                grid.fill(*box, code)
                continue
            before = grid.data.copy()
            grid.paint_if_filled(*box, code)
            if np.array_equal(before, grid.data):
                raise ValueError(f'Paint box {(x0, x1), (y0, y1), (z0, z1)} changes no cell.')

    def cells(self):
        """Filled cells of the sculpt: {(x, y, z): voxel code}."""
        (x0, x1), (y0, y1), (z0, z1) = self.bounds()
        grid = vk.VoxelGrid(x0, x1, y0, y1, z0, z1)
        self.write(grid)
        return {(int(i) + x0, int(j) + y0, int(k) + z0): int(grid.data[i, j, k])
                for i, j, k in zip(*np.nonzero(grid.data))}


def lattice_anchor(position, voxel):
    """Lattice cell, world origin and centre flag of a joint, in creature space.

    The origin is the joint position moved to the nearest lattice point (at most half a voxel). On X the
    lattice points of an off-centre joint are at (column + 0.5) * voxel: a limb is then on the lattice of the
    trunk. Do not use the raw joint position as the origin of a segment: each limb then has its own lattice.
    """
    x, y, z = (float(position[axis]) for axis in range(3))
    cy = math.floor(y / voxel + 0.5)
    cz = math.floor(z / voxel + 0.5)
    if abs(x) < 1e-4 * (voxel / vk.VOX):
        return (0, cy, cz), (0.0, cy * voxel, cz * voxel), True
    if abs(x) < CENTRE_TOLERANCE * voxel:
        raise ValueError(f'A joint is {x / voxel:+.2f} voxels from x = 0. Use CreatureSculptor: it moves the joint to x = 0.')
    if x < 0:
        raise ValueError('Author the left side (+X). The right side is a mirror.')
    column = math.floor(x / voxel)
    return (column + 1, cy, cz), ((column + 0.5) * voxel, cy * voxel, cz * voxel), False


# --------------------------------------------------------------------------
# Palette: dark-albedo floor
# --------------------------------------------------------------------------

def _min_garment_luminance():
    text = (vk.CONTRACTS / 'palette.ts').read_text()
    match = re.search(r'MIN_GARMENT_LUMINANCE\s*=\s*([0-9.]+)', text)
    if not match:
        raise ValueError('contracts/palette.ts has no MIN_GARMENT_LUMINANCE.')
    return float(match.group(1))


MIN_GARMENT_LUMINANCE = _min_garment_luminance()


def relative_luminance(colour):
    """WCAG relative luminance (0 black .. 1 white) of a `#rrggbb` colour. Same as contracts/palette.ts."""
    if not re.fullmatch(r'#[0-9a-fA-F]{6}', colour):
        raise ValueError(f'"{colour}" is not a #rrggbb colour.')

    def channel(offset):
        value = int(colour[offset:offset + 2], 16) / 255
        return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4

    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)


def mottled_regions(codes):
    """Palette regions that the voxel codes use with mottle on: the surfaces that must show voxel facets."""
    regions = set()
    for code in codes:
        raw = int(code) - 1
        if raw & 1:
            regions.add(vk.REGIONS[raw >> 8])
    return regions


def dark_floor_problems(palette, codes):
    """Regions of a creature that are a mottled surface and are below the dark-albedo floor."""
    problems = []
    for region in sorted(mottled_regions(codes)):
        if region not in palette:
            problems.append(f'The palette has no "{region}" colour, but the sculpt uses the region.')
            continue
        luminance = relative_luminance(palette[region])
        if luminance < MIN_GARMENT_LUMINANCE:
            problems.append(
                f'Palette region "{region}" ({palette[region]}) has a relative luminance of {luminance:.3f}. '
                f'A mottled surface needs {MIN_GARMENT_LUMINANCE} or more to show its facets. Use a lighter colour, '
                f'or set mottle=False if the region is only a sharp feature (a nose, a pupil).')
    return problems


# --------------------------------------------------------------------------
# Quadruped checks
# --------------------------------------------------------------------------

_FACES = ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))


def _extent(cells, axis):
    values = [cell[axis] for cell in cells]
    return min(values), max(values)


def _width(cells, axis):
    low, high = _extent(cells, axis)
    return high - low + 1


class QuadrupedAudit:
    """Build-time checks of a voxel quadruped. Each check is a rule of docs/art-direction.md section 10.

    Add each authored segment (the centre segments and the left limbs) with its role. `check()` raises one
    error that lists each broken rule. The numbers are in contracts/data/proportions.json -> quadruped.
    """

    def __init__(self, name, voxel, parents, *, animated=None, rules=None):
        """`parents` gives the parent joint of each joint (None for a root). `animated` is the set of joints that
        a clip moves. The default is all joints."""
        self.name = name
        self.voxel = float(voxel)
        self.parents = dict(parents)
        self.animated = set(self.parents) if animated is None else set(animated)
        self.rules = dict(rules or QUADRUPED_RULES)
        self.records = []
        self.joints = {}

    def add(self, bone, sculpt, joint, *, pad=0.0, role=None):
        """`joint` is the rest position of the joint in creature space, in the units of the rig."""
        if bone not in self.parents:
            raise ValueError(f'{self.name}: "{bone}" is not a joint of the rig.')
        if role is not None and role not in ROLES:
            raise ValueError(f'{self.name}: role "{role}" of "{bone}" is not one of {ROLES}.')
        self.joints[bone] = tuple(float(joint[axis]) / self.voxel for axis in range(3))
        self.records.append({'bone': bone, 'role': role, 'pad': float(pad), 'cells': sculpt.cells(),
                             'eyes': list(sculpt.eye_cells)})

    def codes(self):
        return {code for record in self.records for code in record['cells'].values()}

    def _role_cells(self, role):
        cells = set()
        for record in self.records:
            if record['role'] == role:
                cells.update(record['cells'])
        return cells

    def _bone_cells(self):
        """Cells of each joint. A joint can have more than one sculpt: they move as one rigid segment."""
        cells = {}
        for record in self.records:
            cells.setdefault(record['bone'], set()).update(record['cells'])
        return cells

    def _outside(self, joint, cells):
        """Distance (voxels) of a joint position from the bounds of a cell set, for Y and Z."""
        found = []
        for axis, name in ((1, 'Y'), (2, 'Z')):
            low, high = _extent(cells, axis)
            distance = max(low - joint[axis], joint[axis] - (high + 1), 0.0)
            if distance > self.rules['maxPivotOutsideVoxels'] + 1e-6:
                found.append(f'{distance:.1f} voxels on {name}')
        return ' and '.join(found)

    # ---- generic checks: they apply to each rigid-segment creature ----------------------------------------------

    def _coincident_faces(self):
        """Two segments that show the same face of the same cell flicker (z-fighting)."""
        problems = []
        for index, first in enumerate(self.records):
            for second in self.records[index + 1:]:
                if abs(first['pad'] - second['pad']) > 1e-9:
                    continue
                shared = first['cells'].keys() & second['cells'].keys()
                for cell in sorted(shared):
                    for dx, dy, dz in _FACES:
                        neighbour = (cell[0] + dx, cell[1] + dy, cell[2] + dz)
                        if neighbour not in first['cells'] and neighbour not in second['cells']:
                            problems.append(
                                f'Segments "{first["bone"]}" and "{second["bone"]}" both show a face of cell {cell} '
                                f'and have the same pad. The faces flicker. Give one segment a larger pad, or remove '
                                f'the shared surface cells from one segment.')
                            break
                    else:
                        continue
                    break
        return problems

    def _pivots(self):
        """A segment turns about its joint. A joint that is far from the segment makes the segment fly off."""
        limit = self.rules['maxPivotOutsideVoxels']
        problems = []
        bone_cells = self._bone_cells()
        for bone, cells in bone_cells.items():
            joint = ', '.join(f'{value:.1f}' for value in self.joints[bone])
            outside = self._outside(self.joints[bone], cells)
            if outside:
                problems.append(
                    f'Segment "{bone}": its joint (cell position {joint}) is {outside} outside the segment '
                    f'(limit {limit}). The segment tears off in a clip. Put the cells around the joint, or bind '
                    f'them to the bone whose joint is inside them.')
            # The nearest parent that has a segment holds this segment. Each animated joint between them moves
            # this segment in relation to that parent.
            skipped, parent = [], self.parents[bone]
            while parent is not None and parent not in bone_cells:
                if parent in self.animated:
                    skipped.append(parent)
                parent = self.parents[parent]
            if parent is None:
                continue
            if skipped:
                problems.append(
                    f'Segment "{bone}" hangs on "{parent}", but the clips move {", ".join(f"{name!r}" for name in skipped)} '
                    f'between them and that joint has no segment. "{bone}" then floats away from "{parent}". '
                    f'Give each animated joint of the chain a segment that goes from its joint to the joint of its child.')
                continue
            outside = self._outside(self.joints[bone], bone_cells[parent])
            if outside:
                problems.append(
                    f'Segment "{parent}" does not reach the joint of its child "{bone}" (cell position {joint}): '
                    f'the joint is {outside} outside it (limit {limit}). A gap opens between the two segments in a '
                    f'clip. Extend "{parent}" to the joint.')
            held = bone_cells[parent]
            if not any(cell in held or any((cell[0] + dx, cell[1] + dy, cell[2] + dz) in held for dx, dy, dz in _FACES)
                       for cell in cells):
                problems.append(
                    f'Segment "{bone}" does not touch the segment of its parent "{parent}". A segment shares cells '
                    f'or a face with the segment that holds it. A hidden link has the columns of its limb.')
        return problems

    # ---- quadruped silhouette ---------------------------------------------------------------------------------------

    def _roles(self):
        missing = [role for role in REQUIRED_ROLES if not self._role_cells(role)]
        if missing:
            return [f'No segment has the role {", ".join(missing)}. Give each trunk, head, lower-leg and paw segment '
                    f'its role in seg(..., role=...).']
        return []

    def _trunk(self, trunk):
        profile = {}
        for x, _, z in trunk:
            low, high = profile.get(z, (x, x))
            profile[z] = (min(low, x), max(high, x))
        widths = [high - low + 1 for low, high in profile.values()]
        chest, waist = max(widths), min(widths)
        limit = self.rules['maxWaistToChestWidth']
        if waist > limit * chest + 1e-9:
            return chest, [
                f'The trunk is {waist} to {chest} cells wide: it is a box. Step it: chest {chest}, waist '
                f'{math.floor(limit * chest)} or less (waist / chest <= {limit}).']
        return chest, []

    def _limb(self, limb, trunk):
        problems = []
        section = self.rules['lowerLegSectionVoxels']
        step_low, step_high = self.rules['pawToeStepVoxels']
        lower, paw = self._role_cells(f'{limb}_lower'), self._role_cells(f'{limb}_paw')
        upper = self._role_cells(f'{limb}_upper')
        if any(cell[0] <= 0 for cell in lower | paw | upper):
            problems.append(f'The {limb} leg has cells on x <= 0. Author the left leg (x > 0) and mirror it.')
        for y in sorted({cell[1] for cell in lower}):
            row = [cell for cell in lower if cell[1] == y]
            size = (_width(row, 0), _width(row, 2))
            if size != (section, section):
                problems.append(
                    f'The {limb} lower leg is {size[0]} x {size[1]} cells on row {y}. A lower leg is '
                    f'{section} x {section}: a wider leg reads as a post, a thinner leg reads as a stick.')
                break
        rows = _extent(paw, 1)
        if rows != (0, 1):
            problems.append(f'The {limb} paw is on rows {rows[0]}..{rows[1]}. A paw is on rows 0..1: the pad row '
                            f'stands on y = 0 and the toe box is one row above it.')
        toe = _extent(paw, 2)[1] - _extent(lower, 2)[1]
        if not step_low <= toe <= step_high:
            problems.append(
                f'The {limb} paw ends {toe} cells in front of the lower leg. The toe step is {step_low} to '
                f'{step_high} cells: the leg and the paw make an L.')
        if _extent(paw, 2)[0] < _extent(lower, 2)[0]:
            problems.append(f'The {limb} paw goes behind the lower leg. The heel is flush with the leg.')
        if _extent(paw, 0) != _extent(lower, 0):
            problems.append(f'The {limb} paw columns {_extent(paw, 0)} are not the lower-leg columns '
                            f'{_extent(lower, 0)}.')
        offset_limit = self.rules['maxLimbOffCentreVoxels']
        low, high = _extent(lower, 0)
        for record in self.records:
            if record['role'] in (f'{limb}_lower', f'{limb}_paw'):
                offset = abs(self.joints[record['bone']][0] - (low + high) / 2)
                if offset > offset_limit + 1e-6:
                    problems.append(
                        f'The {limb} leg columns {low}..{high} are {offset:.1f} cells to the side of the joint '
                        f'"{record["bone"]}" (limit {offset_limit}). Put the 2 x 2 leg below its bone: an off-centre '
                        f'leg swings wide when the bone turns. If the trunk is too narrow for that, use a larger voxel.')
                    break
        proud = _extent(lower | paw | upper, 0)[1] - _extent(trunk, 0)[1]
        limit = self.rules['maxLimbProudVoxels']
        if proud > limit:
            problems.append(
                f'The {limb} leg goes {proud} cells out of the trunk side. The limit is {limit}: a shoulder or a '
                f'haunch step is one cell. A larger step reads as a brick on the side.')
        return problems

    def _face(self, chest):
        problems = []
        low, high = self.rules['faceToChestWidth']
        overhang = self.rules['maxBrowOverhangVoxels']
        heads = [record for record in self.records if record['role'] == HEAD]
        eyes = [(record, cell, facing) for record in heads for cell, facing in record['eyes']]
        if not eyes:
            return ['The head has no eyes. Make them with Sculpt.eyes(): the checks then find the eye row.']
        head = self._role_cells(HEAD)
        for row in sorted({cell[1] for _, cell, _ in eyes}):
            face = _width([cell for cell in head if cell[1] == row], 0)
            ratio = face / chest
            if not low - 1e-9 <= ratio <= high + 1e-9:
                problems.append(
                    f'The head is {face} cells wide on the eye row {row} and the chest is {chest} cells wide '
                    f'(ratio {ratio:.2f}). The range is {low} to {high}: a wider head reads as a bobblehead.')
        for record, (x, y, z), facing in eyes:
            cells = record['cells']
            out = (0, 0, 1) if facing == 'front' else (1 if x > 0 else -1, 0, 0)
            side = (1, 0, 0) if facing == 'front' else (0, 0, 1)
            front = (x + out[0], y, z + out[2])
            if front in cells:
                problems.append(f'Eye cell {(x, y, z)} is behind cell {front}. An eye is in the surface of the skull.')
                continue
            if any((front[0] + s * side[0], y, front[2] + s * side[2]) in cells for s in (-1, 1)):
                problems.append(f'Eye cell {(x, y, z)} is in a pit: a cell next to it is one cell proud. '
                                f'The brow shadow then fills the pit. Make the eye flush.')
            flush = [(x + s * side[0], y + t, z + s * side[2]) for s, t in ((-1, 0), (1, 0), (0, -1), (0, 1))]
            if not any(cell in cells and (cell[0] + out[0], cell[1], cell[2] + out[2]) not in cells
                       and cell not in {eye for _, eye, _ in eyes} for cell in flush):
                problems.append(f'Eye cell {(x, y, z)} is proud of the skull. Put the eye in the skull surface cells.')
            for rise in (1, 2, 3):
                brim = (x + (overhang + 1) * out[0], y + rise, z + (overhang + 1) * out[2])
                if brim in cells:
                    problems.append(
                        f'Cell {brim} is {overhang + 1} cells in front of the eye {(x, y, z)} and above it. A brow is one '
                        f'bar that goes {overhang} cell out. A deeper slab reads as a cap brim and hides the eye.')
                    break
        return problems

    def problems(self, palette=None, *, quadruped=True):
        """Broken rules. With `quadruped=False` only the checks of each rigid-segment creature run."""
        problems = self._coincident_faces() + self._pivots()
        roles = self._roles() if quadruped else None
        if quadruped:
            problems += roles
        if quadruped and not roles:
            trunk = self._role_cells(TRUNK)
            chest, trunk_problems = self._trunk(trunk)
            problems += trunk_problems
            for limb in LIMBS:
                problems += self._limb(limb, trunk)
            problems += self._face(chest)
        if palette is not None:
            problems += dark_floor_problems(palette, self.codes())
        return problems

    def check(self, palette=None, *, quadruped=True):
        problems = self.problems(palette, quadruped=quadruped)
        if problems:
            lines = '\n'.join(f'  {index + 1}. {text}' for index, text in enumerate(problems))
            raise ValueError(f'{self.name}: {len(problems)} creature rule(s) are broken '
                             f'(docs/art-direction.md section 10).\n{lines}')


# --------------------------------------------------------------------------
# Sculptor for an external glTF rig
# --------------------------------------------------------------------------

def _node_matrix(node, rig_scale=1.0):
    if 'matrix' in node:
        matrix = np.array(node['matrix'], dtype=np.float64).reshape(4, 4).T
        if rig_scale != 1.0:
            matrix[:3, 3] *= rig_scale
        return matrix
    x, y, z, w = node.get('rotation', (0.0, 0.0, 0.0, 1.0))
    rotation = np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ], dtype=np.float64)
    matrix = np.eye(4)
    matrix[:3, :3] = rotation * np.array(node.get('scale', (1.0, 1.0, 1.0)), dtype=np.float64)
    matrix[:3, 3] = np.array(node.get('translation', (0.0, 0.0, 0.0)), dtype=np.float64) * rig_scale
    return matrix


def _accessor_float_array(rig, index):
    item = rig.doc['accessors'][index]
    array = vk.accessor_array(rig.doc, rig.bin, index).astype(np.float64)
    if item.get('normalized'):
        array = np.maximum(array / np.iinfo(vk._COMPONENT[item['componentType']]).max, -1.0)
    return array


def animated_joints(rig, voxel, *, rig_scale=1.0):
    """Joints that a clip of the rig turns by `minAnimatedDegrees` or more, or moves by a quarter of a voxel."""
    nodes = rig.doc['nodes']
    name_of = {node: name for node, name in zip(rig.joint_nodes, rig.names)}
    limit = math.cos(math.radians(MOTION_RULES['minAnimatedDegrees']) / 2)
    rest_world = rest_world_matrices(rig, rig_scale=rig_scale)
    found = set()

    for clip in rig.doc.get('animations', ()):
        for channel in clip['channels']:
            node, path = channel['target'].get('node'), channel['target']['path']
            if node not in name_of or name_of[node] in found or path not in ('rotation', 'translation'):
                continue
            sampler = clip['samplers'][channel['sampler']]
            keys = _accessor_float_array(rig, sampler['output'])
            if sampler.get('interpolation') == 'CUBICSPLINE':
                keys = keys[1::3]
            if path == 'rotation':
                rest = np.array(nodes[node].get('rotation', (0.0, 0.0, 0.0, 1.0)), dtype=np.float64)
                if np.abs(keys @ rest).min() < limit:
                    found.add(name_of[node])
            else:
                rest = np.array(nodes[node].get('translation', (0.0, 0.0, 0.0)), dtype=np.float64)
                world_scale = np.linalg.norm(rest_world[rig.joint_nodes.index(node)][:3, 0])
                local_scale = np.linalg.norm(_node_matrix(nodes[node], rig_scale=rig_scale)[:3, 0])
                if np.abs(keys - rest).max() * rig_scale * world_scale / max(local_scale, 1e-12) > 0.25 * voxel:
                    found.add(name_of[node])
    return found


def rest_world_matrices(rig, *, rig_scale=1.0):
    """Rest world matrix W_j of each joint node of a `vk.RigData`. The parents that are not joints are included."""
    nodes = rig.doc['nodes']
    parent = {child: index for index, node in enumerate(nodes) for child in node.get('children', ())}

    def world(index):
        chain = []
        while index is not None:
            chain.append(index)
            index = parent.get(index)
        matrix = np.eye(4)
        for node in reversed(chain):
            matrix = matrix @ _node_matrix(nodes[node], rig_scale=rig_scale)
        return matrix

    return [world(node) for node in rig.joint_nodes]


class CreatureSculptor:
    """Sculpt a voxel creature on the rest pose of a glTF rig and write it with the rig and its clips.

    `voxel` is the voxel size in metres (after `rig_scale`). `rig_scale` uniformly scales the rig's world-space
    translations, bind matrices, and animation translations into real-world metres before sculpting.
    `forward` is the axis that the rig faces. `seg` takes world lattice cells in creature space. `pad` is a count
    of `PAD_LEVEL` steps. `palette` is the palette of the creature: `export_glb` checks its dark-albedo floor and
    stores it in the file. A quadruped gives a role to each trunk, head, lower-leg and paw segment: `export_glb`
    then runs the `QuadrupedAudit` and stops on a broken rule.

    `export_glb` does not copy the scale channels of the clips. A scaled bone makes voxels that are not cubes.
    """

    def __init__(self, rig_path, name, voxel, palette, *, forward='+Z', rig_scale=1.0, quadruped=True, floating=False):
        if forward not in FORWARD_AXES:
            raise ValueError(f'Forward axis "{forward}" is not one of {sorted(FORWARD_AXES)}.')
        self.rig_scale = float(rig_scale)
        if self.rig_scale <= 0:
            raise ValueError(f'rig_scale ({rig_scale}) must be positive.')
        self.rig = vk.RigData(rig_path)
        self.part = vk.VoxelPart(name)
        self.voxel = float(voxel)
        self.forward = forward
        self.palette = palette
        self.quadruped = quadruped
        self.floating = bool(floating)
        self.to_creature = FORWARD_AXES[forward]
        self.rest = rest_world_matrices(self.rig, rig_scale=self.rig_scale)
        self.rig_world = self.rig.world.copy()
        if self.rig_scale != 1.0:
            self.rig_world[:, :3, 3] *= self.rig_scale
        self.position = {name_: self.to_creature @ self.rest[index][:3, 3]
                         for index, name_ in enumerate(self.rig.names)}
        parents = {name_: None if self.rig.parent[index] is None else self.rig.names[self.rig.parent[index]]
                   for index, name_ in enumerate(self.rig.names)}
        self.audit = QuadrupedAudit(name, self.voxel, parents,
                                    animated=animated_joints(self.rig, self.voxel, rig_scale=self.rig_scale))
        self.max_pad = 0
        self._ibm_dirty = False

    def retarget_rest_rotation(self, bone, rotation_xyzw):
        """Set a leaf bone's rest rotation and sync its inverse bind matrix so closed-pose sculpts stay axis-aligned."""
        if bone not in self.rig.index:
            raise ValueError(f'{self.part.name}: the rig has no joint "{bone}".')
        idx = self.rig.index[bone]
        if self.rig.children[idx]:
            raise ValueError(f'{self.part.name}: retarget_rest_rotation only supports leaf bones (not "{bone}").')
        q = np.array(rotation_xyzw, dtype=np.float64)
        q = q / np.linalg.norm(q)
        node = self.rig.doc['nodes'][self.rig.joint_nodes[idx]]
        node.pop('matrix', None)
        node['rotation'] = [float(v) for v in q]
        self.rest = rest_world_matrices(self.rig, rig_scale=self.rig_scale)
        self.rig_world[idx] = self.rest[idx].copy()
        self.position[bone] = self.to_creature @ self.rest[idx][:3, 3]
        self._ibm_dirty = True

    def _centred(self, position):
        """Joint position with a joint near x = 0 moved onto x = 0."""
        position = np.array(position, dtype=np.float64)
        if abs(position[0]) < CENTRE_TOLERANCE * self.voxel:
            position[0] = 0.0
        return position

    def seg(self, bone, sculpt, *, mirror_bone=None, pad=0, bake_ao=True, role=None):
        """Bind one sculpt to one joint. `mirror_bone` adds the mirror across x = 0 on the joint of the other side."""
        if bone not in self.position:
            raise ValueError(f'{self.part.name}: the rig has no joint "{bone}". Joints: {self.rig.names}')
        if int(pad) != pad or pad < 0:
            raise ValueError(f'{self.part.name}: pad {pad} of "{bone}" is not a count of pad levels (0, 1, 2 ...).')
        joint = self._centred(self.position[bone])
        cell, origin, centred = lattice_anchor(joint, self.voxel)
        (x0, x1), (y0, y1), (z0, z1) = sculpt.bounds(cell)
        grid = self.part.custom_segment(bone, origin, x0, x1, y0, y1, z0, z1, voxel_size=self.voxel,
                                        layer_pad=pad * PAD_LEVEL * self.voxel, bake_ao=bake_ao,
                                        center_x=centred, center_z=False)
        sculpt.write(grid, cell)
        self.audit.add(bone, sculpt, self.position[bone], pad=pad, role=role)
        self.max_pad = max(self.max_pad, pad)
        if mirror_bone is None:
            return
        if mirror_bone not in self.position:
            raise ValueError(f'{self.part.name}: the rig has no joint "{mirror_bone}".')
        mirrored = self.position[mirror_bone] * np.array([-1.0, 1.0, 1.0])
        if np.abs(mirrored - self.position[bone]).max() > 0.05 * self.voxel:
            raise ValueError(f'{self.part.name}: "{mirror_bone}" is not the mirror of "{bone}". The rig is not symmetric.')
        self.part.segments.append(grid.clone_mirrored_x(mirror_bone))

    def _bind_geometry(self):
        """Vertex arrays of all segments in the bind space of the skin: inverse(W_j @ IBM_j) @ sculpt."""
        to_rig = self.to_creature.T
        arrays = {key: [] for key in ('positions', 'normals', 'uvs', 'uv1s', 'indices', 'joints')}
        offset = 0
        for segment in self.part.segments:
            index = self.rig.index[segment.bone]
            # rig_world is inverse(IBM_j) at rig_scale, so this is W_j @ IBM_j: the rest skinning matrix of the joint.
            skin_matrix = self.rest[index] @ np.linalg.inv(self.rig_world[index])
            if np.linalg.det(skin_matrix[:3, :3]) <= 0:
                raise ValueError(f'{self.part.name}: joint "{segment.bone}" has a mirrored rest matrix.')
            positions, normals, uvs, uv1s, indices = segment.build_geometry()
            if len(positions) == 0:
                raise ValueError(f'{self.part.name}: the segment of "{segment.bone}" has no face.')
            world = positions.astype(np.float64) @ to_rig.T
            homogeneous = np.hstack([world, np.ones((len(world), 1))])
            arrays['positions'].append((homogeneous @ np.linalg.inv(skin_matrix).T)[:, :3])
            # A normal transforms with the inverse transpose. This is the inverse of that transform.
            local = (normals.astype(np.float64) @ to_rig.T) @ skin_matrix[:3, :3]
            arrays['normals'].append(local / np.linalg.norm(local, axis=1, keepdims=True))
            arrays['uvs'].append(uvs)
            arrays['uv1s'].append(uv1s)
            arrays['indices'].append(indices.astype(np.uint32) + offset)
            arrays['joints'].append(np.full(len(positions), index, dtype=np.int64))
            offset += len(positions)
        return {key: np.concatenate(value) for key, value in arrays.items()}

    def export_glb(self, path):
        """Run the checks, then write the rig, its clips and the voxel mesh. Return the mesh statistics."""
        self.audit.check(self.palette, quadruped=self.quadruped)
        mesh = self._bind_geometry()
        triangles = len(mesh['indices']) // 3
        budget = vk.BUDGETS['classes']['body']['maxTriangles']
        if triangles > budget:
            raise ValueError(f'{self.part.name}: {triangles} triangles exceed the body budget ({budget}).')
        if len(self.rig.names) > 255:
            raise ValueError(f'{self.part.name}: the rig has more than 255 joints.')

        source = self.rig.doc
        builder = vk.GlbBuilder()
        nodes = []
        for node in source['nodes']:
            copied_node = {key: copy.deepcopy(value) for key, value in node.items()
                           if key not in ('mesh', 'skin', 'weights')}
            if 'mesh' in node and copied_node.get('name') == self.part.name:
                copied_node['name'] = f"{self.part.name}_source"
            if self.rig_scale != 1.0:
                if 'translation' in copied_node:
                    copied_node['translation'] = [float(v) * self.rig_scale for v in copied_node['translation']]
                if 'matrix' in copied_node:
                    mat = list(copied_node['matrix'])
                    mat[12] = float(mat[12]) * self.rig_scale
                    mat[13] = float(mat[13]) * self.rig_scale
                    mat[14] = float(mat[14]) * self.rig_scale
                    copied_node['matrix'] = mat
            nodes.append(copied_node)
        builder.doc['nodes'] = nodes
        scene = source.get('scene', 0)
        builder.doc['scene'] = scene
        builder.doc['scenes'] = copy.deepcopy(source['scenes'])
        if self.rig_scale == 1.0 and not self._ibm_dirty:
            ibm_accessor = builder._copy_accessor(self.rig, self.rig.skin['inverseBindMatrices'])
        elif self._ibm_dirty:
            raw_ibm = np.linalg.inv(self.rig_world).transpose(0, 2, 1).reshape(-1, 16).astype(np.float32)
            ibm_accessor = builder._accessor(raw_ibm, 'MAT4')
        else:
            raw_ibm = vk.accessor_array(self.rig.doc, self.rig.bin, self.rig.skin['inverseBindMatrices']).astype(np.float32).copy()
            raw_ibm[:, 12:15] *= self.rig_scale
            ibm_accessor = builder._accessor(raw_ibm, 'MAT4')
        skin = {'joints': list(self.rig.skin['joints']),
                'inverseBindMatrices': ibm_accessor}
        for key in ('skeleton', 'name'):
            if key in self.rig.skin:
                skin[key] = self.rig.skin[key]
        builder.doc['skins'] = [skin]

        copied = {}
        scaled_translations = {}

        def accessor(index):
            if index not in copied:
                copied[index] = builder._copy_accessor(self.rig, index)
            return copied[index]

        def translation_accessor(index):
            if self.rig_scale == 1.0:
                return accessor(index)
            if index not in scaled_translations:
                arr = (_accessor_float_array(self.rig, index) * self.rig_scale).astype(np.float32)
                scaled_translations[index] = builder._accessor(arr, 'VEC3')
            return scaled_translations[index]

        clips = []
        for number, clip in enumerate(source.get('animations', ())):
            samplers, channels = [], []
            for channel in clip['channels']:
                channel_path = channel['target']['path']
                if channel_path == 'scale' or 'node' not in channel['target']:
                    continue
                sampler = clip['samplers'][channel['sampler']]
                output_acc = translation_accessor(sampler['output']) if channel_path == 'translation' else accessor(sampler['output'])
                samplers.append({'input': accessor(sampler['input']), 'output': output_acc,
                                 'interpolation': sampler.get('interpolation', 'LINEAR')})
                channels.append({'sampler': len(samplers) - 1,
                                 'target': {'node': channel['target']['node'], 'path': channel_path}})
            clips.append({'name': clip.get('name', f'Clip_{number}'), 'samplers': samplers, 'channels': channels})
        if clips:
            builder.doc['animations'] = clips

        count = len(mesh['positions'])
        joints = np.zeros((count, 4), dtype=np.uint8)
        joints[:, 0] = mesh['joints']
        weights = np.zeros((count, 4), dtype=np.float32)
        weights[:, 0] = 1.0
        index_type = np.uint16 if count < 65535 else np.uint32
        builder.doc['meshes'] = [{'name': self.part.name, 'primitives': [{
            'attributes': {
                'POSITION': builder._accessor(mesh['positions'].astype(np.float32), 'VEC3', vk.ARRAY_BUFFER, bounds=True),
                'NORMAL': builder._accessor(mesh['normals'].astype(np.float32), 'VEC3', vk.ARRAY_BUFFER),
                'TEXCOORD_0': builder._accessor(mesh['uvs'].astype(np.float32), 'VEC2', vk.ARRAY_BUFFER),
                'TEXCOORD_1': builder._accessor(mesh['uv1s'].astype(np.float32), 'VEC2', vk.ARRAY_BUFFER),
                'JOINTS_0': builder._accessor(joints, 'VEC4', vk.ARRAY_BUFFER),
                'WEIGHTS_0': builder._accessor(weights, 'VEC4', vk.ARRAY_BUFFER),
            },
            'material': 0,
            'indices': builder._accessor(mesh['indices'].astype(index_type), 'SCALAR', vk.ELEMENT_ARRAY_BUFFER),
        }]}]
        # `scripts/validate-creature.ts` skins the rest pose and checks each vertex against this lattice.
        poly_creature = {'forward': self.forward, 'quadruped': self.quadruped, 'palette': dict(self.palette)}
        if self.rig_scale != 1.0:
            poly_creature['rigScale'] = self.rig_scale
        if self.floating:
            poly_creature['floating'] = True
        extras = {'polyLattice': {'voxelSize': self.voxel, 'maxPad': round(self.max_pad * PAD_LEVEL * self.voxel, 9)},
                  'polyCreature': poly_creature}
        builder.doc['nodes'].append({'name': self.part.name, 'mesh': 0, 'skin': 0, 'extras': extras})
        builder.doc['scenes'][scene]['nodes'].append(len(builder.doc['nodes']) - 1)
        size = builder.write(Path(path))
        return {'name': self.part.name, 'verts': count, 'tris': triangles, 'joints': len(self.rig.names),
                'clips': len(clips), 'bytes': size, 'segments': len(self.part.segments)}
