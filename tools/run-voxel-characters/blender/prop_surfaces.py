"""Paint contact and weather marks on exposed level prop cells."""

from zlib import crc32

import voxchar as vk
from level_geometry import WATER_LABELS, make_mesh

# Each row runs across a physical face. The first row starts at its lower edge.
# Digits select two tones. Spaces keep the original finish.
CHIP = ('  112', '111  ')
DAMP = ('111222211 ', ' 11122211 ', '  111   1')
RUB = ('   1122', '1111   ')
GRAIN = ('1111222 ', '    1121', '  111   ')
END = (' 111 ', '12221', '12121', ' 1221')
BARK = ('12 ', '12 ', ' 21', ' 21', '  1', '  1')
RUST = (' 1  ', ' 11 ', ' 21 ', '1222', ' 122')
GREASE = (' 1111 ', '1222111', ' 11222 ')
THREAD = ('111    ', ' 111222', '   112 ')
LEAF = (' 11  ', '11221', ' 222 ')
RIPPLE = ('   11122', '1122    ')
SOIL = (' 11122 ', '1122221', '  1111 ')


def tone(region, shade):
    return vk.vox(region, shade, mottle=False)


def finish(kit, label, region):
    if label in WATER_LABELS:
        return 'water'
    if region in ('visor', 'accent'):
        return None
    if region == 'metal':
        return 'metal'
    if label in ('Market awning', 'Shelter canopy') and region == 'detail':
        return 'cloth'
    if (label == 'Cloth goods box' and region == 'detail'
            or label == 'Banner support' and region == 'primary'):
        return 'cloth'
    if label == 'Terracotta market awning' and region == 'detail':
        return 'clay'
    if region == 'detail' and label not in ('Fuel drum', 'Spice box'):
        return None
    if kit == 'creatures':
        if region == 'leather':
            if label in ('Upper creek bank', 'Lower creek bank', 'Nest mound', 'Trail terrace', 'Stream reeds'):
                return 'soil'
            if label in ('Tall pine', 'Alder tree', 'Shore alder', 'Low willow', 'Dead snag'):
                return 'bark'
            return 'wood'
        if label == 'Packed earth':
            return 'soil'
        if region in ('primary', 'secondary') and label in (
            'Tall pine', 'Alder tree', 'Shore alder', 'Low willow', 'Brush clump', 'Stream reeds',
            'Upper creek bank', 'Lower creek bank', 'Uneven rock shelf', 'Shallow stepping stones',
            'Shale escarpment', 'Shale return'):
            return 'leaf'
    if region == 'leather' or label == 'Timber rail':
        return 'wood'
    if label in ('Asphalt tile', 'Worn road section', 'Road repair patch', 'Loading apron strip'):
        return 'road'
    if kit == 'heist' and region == 'primary' and label in (
        'Brick facade', 'Service opening', 'Damaged parapet', 'Upper brick windows',
        'Recessed shop bay', 'Alley wall return', 'Breached upper bay', 'Corner shopfront',
        'Alley lintel variant'):
        return 'clay'
    if region == 'skin' or (kit == 'fantasy' and region == 'trim'):
        return 'stone'
    if region == 'hair':
        return 'rubber'
    return 'paint'


def mark(material, region, upper, top, kit):
    light = tone(region, 0.92)
    mid = tone(region, 0.35)
    dark = tone(region, -0.8)
    if material == 'water':
        return RIPPLE, mid, light
    if material == 'leaf':
        return LEAF, tone('secondary', 0.0), tone('primary', 0.9)
    if material == 'soil':
        return SOIL, tone('leather', -0.6), tone('leather', 0.5)
    if material == 'bark':
        return (END if top else BARK), dark, mid
    if material == 'wood':
        return (END if not top and upper else GRAIN), dark, light
    if material == 'cloth':
        return THREAD, mid, light
    if material in ('stone', 'clay'):
        if upper or top:
            return CHIP, tone(region, 0.22), tone(region, 0.62)
        return DAMP, tone(region, -0.45), dark
    if material == 'road':
        return RUB, tone('secondary', -0.45), tone('hair', 0.3)
    if material == 'rubber':
        return RUB, mid, light
    if upper or top:
        if material == 'metal':
            return RUB, mid, tone('metal', 0.75)
        return RUB, tone(region, 0.18), tone(region, 0.58)
    if kit == 'security':
        return GREASE, dark, tone('secondary', -0.9)
    if material == 'metal':
        return RUST, tone('leather', -0.25), tone('leather', 0.5)
    return GREASE, tone(region, -0.33), tone(region, -0.7)


# These contacts use local voxel coordinates. The strokes stop at material boundaries.
# Each line gives its start, step, length, original region, and new finish.
CONTACT_LINES = {
    'Foundry press': (
        ((-2, 15, 3), (1, 0, 0), 5, 'metal', tone('secondary', -0.65)),
        ((-1, 14, 3), (1, 0, 0), 3, 'metal', tone('hair', 0.35)),
    ),
    'Courtyard well': (
        ((-3, 8, 5), (1, 0, 0), 5, 'trim', tone('trim', -0.65)),
        ((0, 8, 6), (1, 0, 0), 4, 'trim', tone('trim', -0.32)),
        ((-1, 7, 5), (1, 0, 0), 3, 'skin', tone('skin', -0.72)),
    ),
    'Glazed inspection booth': (
        ((-8, 9, 9), (1, 0, 0), 7, 'metal', tone('metal', 0.88)),
        ((-6, 9, 8), (1, 0, 0), 3, 'metal', tone('metal', 0.45)),
    ),
    'Heavy work table': (
        ((-8, 9, 3), (1, 0, 0), 8, 'leather', tone('leather', 0.9)),
        ((-6, 9, 4), (1, 0, 0), 6, 'leather', tone('leather', 0.6)),
        ((4, 9, 0), (1, 0, 0), 4, 'leather', tone('leather', -0.78)),
    ),
}


def apply_finish(kit, label, sculpt, *, triangle_limit=None):
    cells = sculpt.cells()
    bounds = sculpt.bounds()
    seed = crc32(label.encode())
    # Group actual exposed cells by material and face. Interior faces stay clean.
    faces = {}
    for pos, code in cells.items():
        region_index, value, _ = vk._decode_vox(code)
        if value == vk.V_EMISSIVE:
            continue
        region = vk.REGIONS[region_index]
        material = finish(kit, label, region)
        if material is None:
            continue
        for normal, across, up, sign in ((1, 0, 2, 1), (2, 0, 1, 1), (2, 0, 1, -1),
                                         (0, 2, 1, 1), (0, 2, 1, -1)):
            adjacent = list(pos)
            adjacent[normal] += sign
            if tuple(adjacent) not in cells:
                faces.setdefault((material, normal, across, up, sign), {})[pos] = region

    if not faces:
        return

    patches = []
    broad = max(hi - lo for lo, hi in bounds) >= 28
    for (material, normal, across, up, sign), face in faces.items():
        if material == 'water' and normal != 1:
            continue
        # Place a few distinct marks across broad faces. Narrow rails get one.
        count = min(3, 1 + len(face) // 560) if broad else min(4, 1 + len(face) // 220)
        for i in range(count):
            along = 0.12 + ((seed % 43) / 100 + i * 0.38197) % 0.76
            high = (0.22, 0.79, 0.48)[(i + (seed % 3)) % 3]
            if normal == 1:
                high = 0.12 + ((seed % 29) / 100 + i * 0.61803) % 0.76
            a0, a1 = bounds[across]
            b0, b1 = bounds[up]
            ax = a0 + along * (a1 - a0)
            bx = b0 + high * (b1 - b0)
            center = min(face, key=lambda p: (p[across] - ax) ** 2 + (p[up] - bx) ** 2
                         - sign * p[normal] * 0.05)
            region = face[center]
            rows, first, second = mark(material, region, high >= 0.48, normal == 1, kit)
            patch = []
            for j, row in enumerate(rows):
                for k, digit in enumerate(row):
                    if digit == ' ':
                        continue
                    pos = list(center)
                    pos[across] += k - len(rows[0]) // 2
                    pos[up] += j - len(rows) // 2
                    if face.get(tuple(pos)) == region:
                        patch.append((*pos, first if digit == '1' else second))
            if patch:
                # Keep marks on the broad visible faces first when detail space is limited.
                priority = (i, sign < 0, -len(face), normal)
                patches.append((priority, patch))

    contact = []
    for start, step, length, region, color in CONTACT_LINES.get(label, ()):
        for n in range(length):
            pos = tuple(a + n * b for a, b in zip(start, step))
            if any(face.get(pos) == region for face in faces.values()):
                contact.append((*pos, color))

    patches.sort(key=lambda entry: entry[0])
    original = len(sculpt.ops)
    limit = triangle_limit if triangle_limit is not None else vk.BUDGETS['classes']['prop']['maxTriangles']
    while patches:
        for _, patch in patches:
            for x, y, z, color in patch:
                sculpt.box(x, y, z, color)
        for x, y, z, color in contact:
            sculpt.box(x, y, z, color)
        if make_mesh(label, sculpt).triangles <= limit:
            return
        del sculpt.ops[original:]
        patches = patches[::2] if len(patches) > 1 else []

    # On a dense prop, shade an existing part along its original boundaries.
    for index in range(original - 1, -1, -1):
        x, y, z, code, paint = sculpt.ops[index]
        if code == 0 or paint:
            continue
        region_index, value, _ = vk._decode_vox(code)
        region = vk.REGIONS[region_index]
        if value == vk.V_EMISSIVE or finish(kit, label, region) is None:
            continue
        replacement = tone(region, -0.65)
        if replacement != code:
            sculpt.ops[index] = (x, y, z, replacement, paint)
            changed = sculpt.cells()
            visible = any(changed[pos] != cells[pos] for face in faces.values() for pos in face)
            if visible and make_mesh(label, sculpt).triangles <= limit:
                return
            sculpt.ops[index] = (x, y, z, code, paint)
    raise ValueError(f'{label} has no surface finish within the prop triangle limit.')
