"""Bake wear into exposed cells on the detailed vehicle meshes."""

import math
from dataclasses import dataclass

import voxchar as vk
from creature_kit import Sculpt

POS_X, NEG_X = (1, 0, 0), (-1, 0, 0)
TOP, FRONT, REAR = (0, 1, 0), (0, 0, 1), (0, 0, -1)
DUST = vk.vox('skin', -0.2, mottle=False)
ROAD_FILM = vk.vox('skin', -0.52, mottle=False)
SCRAPE = vk.vox('metal', 0.38, mottle=False)
OXIDE = vk.vox('detail', -0.54, mottle=False)
GREASE = vk.vox('secondary', -0.6, mottle=False)
DRY_WOOD = vk.vox('leather', 0.43, mottle=False)
DARK_WOOD = vk.vox('leather', -0.42, mottle=False)
FADED_CANVAS = vk.vox('trim', 0.37, mottle=False)
FADED_STRIPE = vk.vox('accent', 0.43, mottle=False)
FADED_VAN_PAINT = vk.vox('trim', 0.04, mottle=False)
WORN_TREAD = vk.vox('hair', 0.53, mottle=False)
DIRTY_TREAD = vk.vox('hair', -0.56, mottle=False)


@dataclass(frozen=True)
class Patch:
    normal: tuple[int, int, int]
    x: tuple[int, int]
    y: tuple[int, int]
    z: tuple[int, int]
    regions: tuple[str, ...]
    color: int


PAINT = ('primary', 'secondary', 'accent', 'trim')
METAL = ('metal',)
WOOD = ('leather',)

# Cell coordinates describe contact areas on each vehicle in its rest pose.
VEHICLE_WEAR = {
    'prop_core_utility_pickup': {
        'vehicle_root': (
            Patch(POS_X, (7, 10), (6, 7), (-10, 8), PAINT, ROAD_FILM),
            Patch(POS_X, (7, 10), (7, 8), (5, 12), PAINT, DUST),
            Patch(NEG_X, (-10, -7), (6, 7), (-8, 7), PAINT, ROAD_FILM),
            Patch(TOP, (-6, -4), (10, 10), (-15, -7), PAINT, DUST),
            Patch(TOP, (4, 6), (10, 10), (-15, -10), PAINT, SCRAPE),
            Patch(FRONT, (-7, -4), (7, 8), (17, 18), PAINT, SCRAPE),
        ),
        'tailgate': (Patch(REAR, (4, 6), (11, 11), (-17, -17), PAINT, SCRAPE),),
    },
    'prop_heist_street_hatchback': {
        'vehicle_root': (
            Patch(POS_X, (6, 8), (6, 6), (-7, 8), PAINT, ROAD_FILM),
            Patch(POS_X, (7, 8), (7, 7), (6, 11), PAINT, DUST),
            Patch(POS_X, (8, 8), (8, 8), (-10, -7), PAINT, SCRAPE),
            Patch(NEG_X, (-8, -8), (6, 6), (-9, 8), PAINT, ROAD_FILM),
            Patch(FRONT, (2, 5), (6, 6), (16, 16), PAINT, SCRAPE),
        ),
    },
    'prop_heist_panel_van': {
        'vehicle_root': (
            Patch(POS_X, (8, 9), (8, 8), (-15, 6), PAINT, ROAD_FILM),
            Patch(POS_X, (8, 9), (9, 9), (-16, 1), PAINT, ROAD_FILM),
            Patch(POS_X, (8, 9), (10, 10), (-17, -11), PAINT, DUST),
            Patch(POS_X, (9, 9), (12, 12), (-16, -12), PAINT, DUST),
            Patch(POS_X, (9, 9), (13, 13), (-16, -14), PAINT, DUST),
            Patch(POS_X, (9, 9), (12, 12), (-6, -3), PAINT, SCRAPE),
            Patch(NEG_X, (-9, -8), (9, 10), (-16, 4), PAINT, ROAD_FILM),
            Patch(REAR, (-6, 5), (12, 13), (-18, -18), PAINT, DUST),
            Patch(REAR, (1, 3), (12, 12), (-18, -18), PAINT, SCRAPE),
            Patch(POS_X, (9, 9), (21, 22), (-16, -10), ('trim',), FADED_VAN_PAINT),
            Patch(POS_X, (9, 9), (22, 22), (-9, -3), ('trim',), FADED_VAN_PAINT),
        ),
    },
    'prop_industrial_yard_crane': {
        'vehicle_root': (
            Patch(POS_X, (8, 10), (9, 9), (-14, 3), PAINT, ROAD_FILM),
            Patch(POS_X, (9, 10), (10, 10), (1, 8), PAINT, DUST),
            Patch(TOP, (-9, -9), (11, 11), (7, 13), PAINT, DUST),
            Patch(TOP, (-8, -8), (11, 11), (6, 11), PAINT, DUST),
            Patch(TOP, (-7, -7), (11, 11), (7, 9), PAINT, ROAD_FILM),
        ),
        'crane_slew': (
            Patch(POS_X, (5, 6), (34, 34), (6, 10), PAINT, OXIDE),
            Patch(POS_X, (5, 6), (37, 37), (20, 24), PAINT, DUST),
            Patch(REAR, (-6, 5), (17, 18), (-12, -12), PAINT, ROAD_FILM),
        ),
        'crane_hook': (Patch(POS_X, (5, 5), (21, 22), (9, 9), METAL, SCRAPE),),
    },
    'prop_industrial_warehouse_forklift': {
        'vehicle_root': (
            Patch(POS_X, (6, 8), (6, 6), (-13, 7), PAINT, ROAD_FILM),
            Patch(POS_X, (6, 8), (9, 9), (-13, -9), PAINT, SCRAPE),
            Patch(FRONT, (-6, 6), (8, 14), (8, 8), METAL, GREASE),
            Patch(FRONT, (-6, 6), (18, 21), (8, 8), METAL, SCRAPE),
        ),
        'fork_carriage': (
            Patch(TOP, (-5, 5), (4, 4), (19, 21), METAL, SCRAPE),
            Patch(TOP, (-5, 5), (4, 4), (13, 16), METAL, GREASE),
            Patch(FRONT, (-5, 5), (3, 4), (21, 21), METAL, SCRAPE),
        ),
    },
    'prop_security_patrol_rover': {
        'vehicle_root': (
            Patch(POS_X, (7, 10), (6, 7), (-11, 9), PAINT, ROAD_FILM),
            Patch(POS_X, (7, 10), (7, 7), (5, 10), PAINT, DUST),
            Patch(FRONT, (-8, -7), (7, 8), (16, 17), PAINT, SCRAPE),
            Patch(FRONT, (2, 3), (8, 8), (17, 17), METAL, SCRAPE),
        ),
    },
    'prop_creatures_ranger_truck': {
        'vehicle_root': (
            Patch(POS_X, (8, 10), (6, 7), (-12, 12), PAINT, ROAD_FILM),
            Patch(POS_X, (8, 10), (8, 8), (-12, -8), PAINT, ROAD_FILM),
            Patch(POS_X, (8, 10), (9, 9), (-10, -8), PAINT, DUST),
            Patch(POS_X, (8, 10), (8, 8), (6, 10), PAINT, DUST),
            Patch(POS_X, (8, 10), (9, 9), (7, 8), PAINT, ROAD_FILM),
            Patch(NEG_X, (-10, -8), (6, 7), (-9, 11), PAINT, ROAD_FILM),
            Patch(TOP, (-5, -3), (10, 10), (-17, -10), PAINT, DUST),
            Patch(TOP, (5, 6), (20, 20), (-12, -6), METAL, SCRAPE),
        ),
        'tailgate': (Patch(REAR, (2, 6), (11, 11), (-17, -17), PAINT, DUST),),
    },
    'prop_fantasy_wagon_frame': {
        'vehicle_root': (
            Patch(POS_X, (6, 7), (9, 9), (-13, 3), WOOD, DARK_WOOD),
            Patch(POS_X, (6, 7), (13, 13), (-11, -7), WOOD, DRY_WOOD),
            Patch(POS_X, (6, 7), (14, 14), (0, 4), WOOD, DRY_WOOD),
            Patch(TOP, (-7, 6), (8, 8), (-12, -10), WOOD, DRY_WOOD),
            Patch(TOP, (0, 6), (22, 23), (-9, -7), ('trim',), FADED_CANVAS),
            Patch(TOP, (-4, 4), (23, 23), (-6, -5), ('accent',), FADED_STRIPE),
        ),
        'drawbar': (Patch(TOP, (-5, 5), (5, 5), (17, 21), WOOD, DRY_WOOD),),
    },
}


def exposed(cells, point, normal):
    return tuple(coordinate + step for coordinate, step in zip(point, normal)) not in cells


def wheel_tread(cells, pivot, wagon):
    _, center_y, center_z = pivot
    radius = max(y + 1 - center_y for _, y, _ in cells)
    inside, outside = min(x for x, _, _ in cells), max(x for x, _, _ in cells)
    for (x, y, z), material in cells.items():
        dy, dz = y + 0.5 - center_y, z + 0.5 - center_z
        if math.hypot(dy, dz) < radius - 0.8:
            continue
        if vk.REGIONS[vk._decode_vox(material)[0]] != 'hair':
            continue
        face_y = 1 if dy >= 0 else -1
        face_z = 1 if dz >= 0 else -1
        if not (exposed(cells, (x, y, z), (0, face_y, 0)) or exposed(cells, (x, y, z), (0, 0, face_z))):
            continue
        sector = int((math.atan2(dy, dz) + math.pi) * (6 / math.pi))
        if wagon:
            if sector in (0, 4, 7):
                yield (x, y, z), WORN_TREAD
            continue
        shoulder_band = min(x - inside, outside - x) // 2
        if (sector + shoulder_band) % 3 == 0:
            yield (x, y, z), WORN_TREAD
        elif sector in (1, 8):
            yield (x, y, z), DIRTY_TREAD


def apply_vehicle_wear(asset_id, part, shape, pivot):
    patches = VEHICLE_WEAR.get(asset_id, {}).get(part, ())
    wheel = part.endswith('_spin')
    if not patches and not wheel:
        return shape
    cells = shape.cells()
    paint = {}
    for patch in patches:
        for (x, y, z), color in cells.items():
            if not (patch.x[0] <= x <= patch.x[1] and patch.y[0] <= y <= patch.y[1]
                    and patch.z[0] <= z <= patch.z[1]):
                continue
            if vk.REGIONS[vk._decode_vox(color)[0]] in patch.regions and exposed(cells, (x, y, z), patch.normal):
                paint[x, y, z] = patch.color
    if wheel:
        paint.update(wheel_tread(cells, pivot, asset_id == 'prop_fantasy_wagon_frame'))
    finished = Sculpt()
    finished.ops.extend(shape.ops)
    for (x, y, z), color in paint.items():
        if cells[x, y, z] != color:
            finished.box(x, y, z, color)
    return finished
