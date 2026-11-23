"""Alderwood canopies and the rock shelves along the north ward."""

from math import hypot, pi, sin
from random import Random

import voxchar as vk
from creature_kit import Sculpt
from level_geometry import box, grounded_center

from .common import GREEN, JOINT, MARK, STONE, WOOD


def woodland_tree(height, width, seed):
    rng = Random(seed)
    shape = box(5, height - 4, 5, WOOD)
    for x in (-3, 3):
        box(3, 4, 3, WOOD, x=x, sculpt=shape)
    crowns = ((0, 0, 0.94, 0.58, 0.54), (-0.18, -0.16, 0.71, 0.53, 0.41),
              (0.2, -0.08, 0.79, 0.47, 0.51), (0.08, 0.16, 0.68, 0.57, 0.47),
              (-0.19, 0.15, 0.82, 0.45, 0.39))
    tones = [vk.vox('detail', shade) for shade in (-0.34, -0.11, 0.12, 0.29, 0.39)]
    for dx, dz, elevation, extent_x, extent_z in crowns:
        x, z = round(dx * width), round(dz * width)
        top = round(elevation * height)
        steps = max(4, round(width * 0.12))
        bottom = top - steps * 3
        for n in range(1, abs(x) + 1):
            box(3, 3, 4, WOOD, x=n if x > 0 else -n,
                z=round(z * n / abs(x)), y=bottom - max(0, 7 - n), sculpt=shape)
        for i in range(steps):
            grown = 1 - abs((i + 0.5) / steps * 2 - 1) * 0.48
            w = max(4, round(extent_x * width * grown))
            d = max(4, round(extent_z * width * grown))
            c = tones[min(4, int(i / steps * 4) + rng.randrange(2))]
            y = bottom + 3 * i
            box(w, 3, d - 2, c, x=x, z=z, y=y, sculpt=shape)
            box(w - 2, 3, d, c, x=x, z=z, y=y, sculpt=shape)
    return shape


def escarpment(seed):
    rng = Random(seed)
    shape = Sculpt()
    tiers = ((112, 96, 15, 0, 0), (103, 86, 20, 1, 3), (84, 75, 22, 4, 8),
             (70, 60, 21, 5, 12), (52, 43, 19, 8, 15), (36, 29, 18, 11, 16))
    shell = vk.vox('skin', 0.27)
    joint = vk.vox('skin', -0.23)
    shade = vk.vox('detail', -0.16)
    y = 0
    for number, (width, depth, rise, x, z) in enumerate(tiers):
        box(width - 4, rise, depth, STONE, x=x, z=z, y=y, sculpt=shape)
        box(width, rise - 2, depth - 6, STONE, x=x, z=z, y=y, sculpt=shape)
        front = z - depth // 2
        for offset in range(-width // 2 + 5, width // 2 - 4, 9):
            w = rng.randrange(6, 10)
            p = min(5, max(1, width // 13))
            fault = rng.randrange(0, rise // 2)
            box(w, rise - fault - 1, p, shell if offset % 4 else JOINT, x=x + offset,
                y=y + fault, z=front + p // 2, sculpt=shape)
            box(w - 2, 2, p + 1, joint, x=x + offset, y=y + rise - 3,
                z=front + p // 2, sculpt=shape)
        for x_offset, z_offset, w, d in ((-3, -3, width - 7, depth - 13),
                                        (3, 1, width - 8, depth - 5),
                                        (1, 3, width - 12, depth - 6)):
            box(w, 1, d, GREEN if number % 3 else shade,
                x=x + x_offset, z=z + z_offset, y=y + rise - 1, sculpt=shape)
        y += rise
    return shape


def river_sedge():
    rng = Random(42)
    shape = Sculpt()
    for x, z in ((-8, -1), (-5, 2), (0, 0), (3, -3), (6, 3), (9, -2)):
        height = rng.randrange(4, 13)
        box(2, height, 1, GREEN, x=x, z=z, sculpt=shape)
        box(3, 2, 2, MARK, x=x, z=z, y=height - 2, sculpt=shape)
    return shape


def ridge_profile(width, depth, max_height, seed, *, chalk=False):
    rng = Random(seed)
    shape = Sculpt()
    cells = {}
    step = 16
    depth_step = 10
    side = rng.choice((-1, 1))
    slope = 1.15 if chalk else 1.65
    summits = ((-.25 * side, .18, .98, .82, .84),
               (.25 * side, .04, .65, .68, .76),
               (-.08 * side, -.35, .36, .92, .47))
    moss = [vk.vox('detail', shade, mottle=False) for shade in (-.31, -.1, .13)]
    rock = [vk.vox('skin', shade, mottle=False) for shade in (-.26, -.1, .16, .36)]
    for z0 in range(-(depth // 2), depth // 2, depth_step):
        for x0 in range(-(width // 2), width // 2, step):
            w = min(step, width // 2 - x0)
            d = min(depth_step, depth // 2 - z0)
            x, z = x0 + w // 2, z0 + d // 2
            nx, nz = x * 2 / width, z * 2 / depth
            profile = max(amp * (1 - hypot((nx - ox) / rx, (nz - oz) / rz)**slope)
                          for ox, oz, amp, rx, rz in summits)
            drift = 0.035 * sin(pi * (2.7 * nx + 1.3 * nz))
            height = round((profile + drift) * max_height / 4) * 4
            if height < 4:
                continue
            low = round(height * (.56 + .14 * sin(x / 38 + z / 26)))
            stained = 0 if nz > .62 else 1 if nx < -.05 else 2
            box(w, low, d, rock[stained], x=x, z=z, sculpt=shape)
            box(w, height - low, d, rock[min(3, stained + int(chalk))], x=x, z=z, y=low, sculpt=shape)
            if not chalk or height < max_height * (.68 + .15 * sin(x/42 - z/33)):
                cap = moss[2 if nx < -.2 else (int(abs(z / 16)) % 2)]
                box(w, min(3, height), d, cap, x=x, z=z, y=max(0, height - 3), sculpt=shape)
            cells[x,z] = height
    return shape, cells


def meadow_skirt():
    shape = box(160, 3, 160, JOINT)
    for z in range(-80, 80, 16):
        for x in range(-80, 80, 16):
            shade = (sin(x / 37 + z / 23) + .2) * .22
            green = vk.vox('detail', shade, mottle=False)
            box(16, 1, 16, green, x=x + 8, z=z + 8, y=2, sculpt=shape)
    return shape


def fir(height, width):
    shape = box(3, height - 1, 3, WOOD)
    start = round(height * .245)
    period = (height - start) / 6
    for tier in range(6):
        y = start + round(period * tier)
        depth = round(start + period * (tier + 1)) - y + 1
        crown = round(width * (1 - .15 * tier))
        shade = vk.vox('detail', -.25 + tier * .08, mottle=False)
        x = (tier % 3 - 1) * (2 if tier < 4 else 1)
        for step in range(3):
            width_at_step = max(3, crown - step * 4)
            bottom = round(depth * step / 3)
            thick = round(depth * (step + 1) / 3) - bottom
            box(width_at_step, thick, max(3, width_at_step - 6), shade, x=x, y=y+bottom, sculpt=shape)
            box(max(3, width_at_step - 6), thick, width_at_step, shade, x=x, y=y+bottom, sculpt=shape)
    return shape


def far_banks(board):
    a, place, palette = board.add, board.place, board.set_palette
    flats = tuple((x, z) for z in (56, 72, 88) for x in range(-32, 81, 16))
    a('Northern meadow floor', meadow_skirt(), *flats[0], height=-0.3)
    for x, z in (*flats[1:], (-56, 56), (-56, 72), (-56, 88), (-72, 56), (-72, 72),
                 (-72, 88), (-56, 40), (-56, 24), (-56, 8), (-56, -8), (-56, -24),
                 (-72, 40), (-72, 24), (-72, 8), (-72, -8)):
        place('Northern meadow floor', x, z, height=-0.3)
    palette('Northern meadow floor', detail='#7b8750', skin='#817765')
    for z in (52, 60, 68, 76, 84, 92):
        place('River current', -44, z, height=-0.64)

    a('Northern slope fir', fir(87, 33), -55, 49.8)
    palette('Northern slope fir', detail='#49634a', leather='#57462e')
    a('Young hillside maple', woodland_tree(54, 48, 903), 32.8, 50.8)
    palette('Young hillside maple', detail='#c3a054', leather='#6b5338')
    ranges = (
        ('Wooded limestone shoulder', 174, 68, 111, 217, False,
         ((-62, 49, 2), (-56, 28, 0), (-52, -3, 3), (-31, 57, 2), (-17, 63, 0), (-2, 60, 0),
          (13, 61, 3), (29, 59, 0), (46, 53, 1), (62, 55, 2), (77, 57, 3)),
         {'skin':'#899078', 'detail':'#80924a'}, 5),
        ('Granite crown beyond the ward', 197, 46, 292, 871, True,
         ((-67, 69.8, 0), (-52, 71.8, 2), (-33, 70.8, 3), (-19, 74.8, 0), (0, 70.8, 2),
          (15, 79.8, 0), (33, 73.8, 2), (49, 69.8, 0), (64, 70.8, 3), (77, 64.8, 2)),
         {'skin':'#829087', 'detail':'#738b52'}, 3),
    )
    for label, width, depth, height, seed, chalk, sites, colors, tree_count in ranges:
        shape, heights = ridge_profile(width, depth, height, seed, chalk=chalk)
        cx, _, cz = grounded_center(shape)
        first, *rest = sites
        head, *remaining = (-3.6, -9.1, -1.25, -5.4, -10.5, -0.2, -3.9, -8.2, -1.7, -6.4) if chalk else (
            -0.2,) * len(sites)
        a(label, shape, *first, head)
        for (x, z, turn), floor in zip(rest, remaining):
            place(label, x, z, turn, floor)
        palette(label, **colors)
        candidates = [(dx, dz, y) for (dx, dz), y in heights.items()
                      if height * .16 <= y <= height * (.63 if chalk else .82)]
        rng = Random(seed + 4)
        for site, ((x, z, turn), floor) in enumerate(zip(sites, (head, *remaining))):
            supported = [p for p in candidates if p[2] * .1 + floor >= .06]
            for index, (dx, dz, y) in enumerate(rng.sample(supported, tree_count)):
                lx = (dx - cx + 0.5) * .1
                lz = (dz - cz + 0.5) * .1
                off_x, off_z = ((lx, lz), (lz, -lx), (-lx, -lz), (-lz, lx))[turn]
                label = 'Young hillside maple' if not chalk and (site + index) % 3 == 1 else 'Northern slope fir'
                place(label, round(x + off_x, 2), round(z + off_z, 2), index % 4, round(y * .1 + floor, 2))
    for x, z in ((-38, 52.5), (-31.4, 50.4), (-25.5, 51.1), (-17.7, 50.9),
                 (-7.2, 53.4), (-2.8, 49.9), (11.7, 51.8), (24.3, 51.2),
                 (33.6, 51.4), (43.8, 49.7), (-58.7, 42.7), (-56.8, 35.6)):
        place('Berry hedge', x, z)
