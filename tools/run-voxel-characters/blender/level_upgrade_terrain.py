"""Creek vegetation, field equipment, and the guild dye terrace."""

from level_geometry import box


def sculpt(parts):
    shape = None
    for x, y, z, width, height, depth, material in parts:
        shape = box(width, height, depth, material, x=x, y=y, z=z, sculpt=shape)
    return shape


def river_alder(g):
    parts = [
        (0, 0, 0, 9, 5, 8, g.SOIL), (0, 5, 0, 6, 18, 6, g.WOOD),
        (-3, 19, 1, 6, 13, 5, g.WOOD), (-6, 30, 1, 5, 13, 5, g.SOIL),
        (3, 16, -1, 5, 8, 5, g.SOIL), (6, 22, -2, 6, 9, 4, g.WOOD),
        (10, 30, -2, 6, 9, 4, g.SOIL), (-3, 33, 5, 5, 13, 5, g.WOOD),
        (1, 42, 8, 6, 8, 4, g.WOOD),
    ]
    return sculpt(parts)


def alder_crown(g):
    parts = []
    green = g.vk.vox('primary', 0.25, mottle=False)
    for x, y, z, width, depth in (
        (-6, 0, 0, 15, 13), (3, 6, -6, 15, 13), (6, 3, 8, 12, 11),
    ):
        parts.extend([
            (x, y, z, width - 5, 4, depth - 3, g.DARK),
            (x + 1, y + 3, z, width, 6, depth, g.BODY),
            (x - 1, y + 8, z - 1, width - 5, 4, depth - 4, green),
        ])
    return sculpt(parts)


def hemlock(g):
    parts = [(0, 0, 0, 6, 58, 5, g.WOOD), (-2, 0, 1, 8, 5, 8, g.SOIL)]
    for x, y, z, width, depth in (
        (-5, 24, 0, 21, 14), (4, 31, -4, 18, 16),
        (-4, 36, 3, 19, 16), (2, 44, -1, 18, 15),
        (1, 52, -1, 12, 11), (0, 58, 0, 6, 7),
    ):
        parts.extend([(x, y, z, width-3, 3, depth-4, g.DARK),
                      (x, y+3, z, width-5, 3, depth-4, g.BODY)])
    return sculpt(parts)


def gravel_bar(g):
    parts = []
    for x, z, width, depth, height in (
        (-12, -1, 15, 8, 3), (-5, 1, 17, 13, 4), (5, 4, 13, 12, 3),
        (14, 5, 11, 8, 2), (9, -4, 5, 3, 2), (-15, 6, 6, 4, 2),
    ):
        parts.extend([(x, 0, z, width, height, depth, g.PATINA),
                      (x - 1, height, z, width - 2, 1, depth - 2, g.MASONRY)])
    parts.extend([(-6, 5, 2, 9, 2, 7, g.DARK), (-8, 7, 2, 5, 1, 4, g.BODY)])
    return sculpt(parts)


def sedge(g):
    parts = []
    for x, z, rise in ((-6, 0, 7), (-2, 3, 10), (4, 0, 6), (6, -3, 9)):
        parts.extend([(x, 0, z, 3, rise, 2, g.DARK),
                      (x - 2, rise - 3, z, 2, 5, 2, g.BODY),
                      (x + 2, 3, z + 1, 2, rise - 2, 2, g.BODY),
                      (x + 3, rise, z + 1, 2, 3, 2, g.SOIL)])
    return sculpt(parts)


def field_press(g):
    parts = [(-9, 0, 0, 3, 23, 5, g.WOOD), (9, 0, 0, 3, 23, 5, g.WOOD),
             (0, 21, 0, 21, 3, 5, g.SOIL), (0, 8, 0, 20, 3, 10, g.WOOD),
             (0, 11, 0, 13, 2, 8, g.CAP), (0, 13, 0, 14, 2, 9, g.WOOD),
             (0, 15, 0, 3, 11, 3, g.METAL), (0, 25, 0, 12, 2, 2, g.SOIL)]
    return sculpt(parts)


def arcade(g):
    parts = []
    for x in (-18, 18):
        parts.extend([(x, 0, 0, 8, 4, 11, g.PATINA), (x, 4, 0, 6, 18, 8, g.MASONRY),
                      (x, 22, 0, 9, 3, 10, g.CAP)])
    for x in (-1, 1):
        for step, (distance, width) in enumerate(((14, 6), (11, 7), (7, 8))):
            parts.append((x * distance, 25 + step * 2, 0, width, 6, 8, g.MASONRY))
    for x in (-18,18):
        parts.extend([(x,9,4,5,1,1,g.PATINA),(x-1,15,4,3,1,1,g.PATINA)])
    parts.extend([(0, 31, 0, 8, 4, 9, g.CAP), (0, 34, 0, 43, 3, 10, g.SOIL)])
    return sculpt(parts)


def terrace(g):
    parts = [(0, 0, 0, 42, 10, 36, g.PATINA), (0, 10, 0, 44, 2, 38, g.CAP)]
    for x, y, width in ((-16, 1, 9), (-5, 1, 11), (9, 1, 14), (-10, 6, 17), (8, 6, 16)):
        parts.append((x, y, 18, width, 3, 2, g.MASONRY))
    return sculpt(parts)


def dye_vat(g):
    shape = g.drum(16, 12, g.WOOD, g.DARK)
    shape.cut((-5, 5), (9, 13), (-5, 5))
    box(10, 1, 10, g.BODY, y=9, sculpt=shape)
    box(5, 1, 7, g.LIGHT, x=2, y=12, z=5, sculpt=shape)
    box(5, 6, 1, g.LIGHT, x=2, y=7, z=8, sculpt=shape)
    box(2, 8, 2, g.WOOD, x=-2, y=9, z=-3, sculpt=shape)
    return shape


def cloth_rack(g):
    parts = [(-14, 0, 0, 3, 25, 4, g.SOIL), (14, 0, 0, 3, 25, 4, g.SOIL),
             (0, 23, 0, 32, 2, 3, g.WOOD)]
    for x, drop, color in ((-9, 12, g.LIGHT), (-2, 15, g.BODY), (7, 13, g.DETAIL)):
        parts.extend([(x, 24-drop, 1, 6, drop, 2, color),
                      (x, 22-drop, 2, 4, 2, 1, color),
                      (x-2, 25-drop, 2, 1, drop-2, 1, color),
                      (x, 25-drop, 2, 4, 1, 1, g.CAP),
                      (x-1, 24, 0, 2, 1, 4, g.SOIL)])
    return sculpt(parts)


def herbarium(g):
    parts = [(0, 0, 0, 22, 17, 8, g.SOIL), (0, 17, 0, 24, 2, 10, g.WOOD)]
    for x in (-5, 5):
        for y in (2, 6, 10, 14):
            parts.extend([(x, y, 4, 9, 3, 2, g.WOOD), (x, y + 1, 5, 3, 1, 2, g.CAP)])
    return sculpt(parts)


def specimen_frame(g):
    parts = [(0, 0, 0, 17, 18, 2, g.SOIL), (0, 1, 1, 15, 16, 1, g.CAP),
             (0, 3, 2, 1, 11, 1, g.DARK), (-2, 7, 2, 4, 2, 1, g.BODY),
             (-3, 9, 2, 2, 2, 1, g.BODY), (2, 10, 2, 4, 2, 1, g.BODY),
             (2, 12, 2, 2, 1, 1, g.BODY), (4, 2, 2, 4, 1, 1, g.MASONRY)]
    return sculpt(parts)


def moss_patch(g):
    parts = []
    colors = [g.DARK, g.GRIT, g.BODY]
    for i, (x, z, w, d) in enumerate((
        (-12, -4, 9, 5), (-8, 0, 12, 8), (-2, 5, 12, 6),
        (5, 4, 9, 4), (9, 1, 6, 4), (14, 3, 4, 2),
        (-5, -7, 3, 2), (2, -4, 4, 2), (4, 10, 5, 2),
    )):
        parts.append((x, 0, z, w, 1 + (i % 3 == 0), d, colors[i % 3]))
    return sculpt(parts)


def proofing_bench(g):
    parts = [(0, 8, 0, 21, 2, 10, g.WOOD), (0, 3, 0, 18, 2, 8, g.SOIL)]
    for x in (-8, 8):
        for z in (-3, 3):
            parts.append((x, 0, z, 2, 8, 2, g.SOIL))
    parts.extend([(0, 10, 0, 16, 1, 8, g.CAP), (-4, 11, -1, 6, 2, 3, g.WOOD),
                  (4, 11, 1, 5, 2, 3, g.WOOD), (3, 13, 1, 2, 1, 3, g.CAP),
                  (-3, 13, -1, 2, 1, 3, g.CAP), (9, 0, -5, 2, 24, 2, g.WOOD),
                  (9, 23, -5, 6, 7, 2, g.CAP), (9, 30, -5, 4, 1, 2, g.CAP)])
    return sculpt(parts)


def hanging_lantern(g):
    return sculpt([(0, 0, 0, 6, 2, 6, g.METAL), (0, 2, 0, 4, 5, 4, g.LAMP),
                   (0, 7, 0, 7, 2, 7, g.DARK), (0, 9, 0, 4, 2, 4, g.METAL),
                   (0, 11, 0, 1, 3, 1, g.DARK)])


def boat_rack(g):
    parts = []
    for x in (-10, 10):
        parts.extend([(x, 0, -3, 2, 4, 2, g.SOIL), (x, 0, 3, 2, 4, 2, g.SOIL),
                      (x, 4, 0, 3, 2, 10, g.WOOD)])
    for x, w, d, y in ((0, 18, 11, 6), (-12, 6, 9, 7), (12, 6, 9, 7),
                        (-17, 4, 5, 8), (17, 4, 5, 8)):
        parts.append((x, y, 0, w, 2, d, g.WOOD))
        if abs(x) == 17:
            parts.append((x, y + 2, 0, w, 2, d, g.CAP))
        else:
            for side in (-1, 1):
                parts.append((x, y + 2, side * (d // 2), w, 2, 1, g.CAP))
    for x in (-20, 20):
        parts.extend([(x,10,0,3,2,2,g.CAP), (x+(-1 if x<0 else 1),12,0,2,2,1,g.DETAIL)])
    for x in (-6, 6):
        parts.append((x, 9, 0, 2, 1, 9, g.DETAIL))
    return sculpt(parts)


def porch(g):
    parts = [(0, 24, 10, 47, 3, 4, g.SOIL), (0, 31, -11, 47, 3, 4, g.WOOD)]
    for x in (-21, 21):
        parts.extend([(x, 0, 10, 4, 24, 4, g.WOOD), (x, 0, 10, 6, 4, 6, g.PATINA)])
        side = 1 if x < 0 else -1
        for j in range(3):
            parts.append((x + side * (2 + 2*j), 18 + 2*j, 10, 4, 3, 3, g.SOIL))
    for step in range(5):
        parts.append((0, 27 + step, 12 - step * 5, 48, 2, 6, g.DARK))
    return sculpt(parts)


def creek_stones(g):
    parts = []
    for x, z, w, d, h in ((-12, -2, 13, 12, 5), (-5, -4, 10, 11, 8),
                            (4, 0, 14, 13, 9), (12, 3, 10, 8, 4)):
        parts.extend([(x, 0, z, w, h - 2, d, g.PATINA), (x - 1, h - 2, z, w - 2, 3, d - 3, g.MASONRY)])
    parts.extend([(1, 10, -1, 6, 1, 5, g.DARK), (-7, 9, -4, 5, 1, 3, g.GRIT)])
    return sculpt(parts)


def fern(g):
    parts = []
    for dx,dz,offset in ((1,0,0),(-1,1,1),(0,-1,0)):
        for j,y in enumerate((0,2,4,5)):
            x,z = j*dx*2 + offset, j*dz*2
            parts.append((x,y,z,3,2,3,g.DARK))
            if j in (1,2):
                for side in (-1,1):
                    parts.append((x+side*dz*2,y+1,z-side*dx*2,3,1,3,g.BODY))
    return sculpt(parts)


def woodpile(g):
    parts = [(-10, 0, 0, 3, 3, 11, g.SOIL), (10, 0, 0, 3, 3, 11, g.SOIL)]
    for y, row in ((3, (-12, -6, 0, 6, 12)), (8, (-9, -3, 3, 9)), (13, (-6, 0, 6))):
        for x in row:
            parts.append((x, y, 0, 5, 4, 10, g.WOOD))
            parts.append((x, y, 5, 3, 3, 1, g.CAP))
    return sculpt(parts)


def bakehouse_flue(g):
    parts = [(0, 0, 0, 15, 13, 14, g.PATINA), (0, 12, 0, 13, 12, 12, g.MASONRY),
             (0, 24, 0, 15, 2, 14, g.CAP), (0, 26, 0, 11, 7, 10, g.DETAIL)]
    for x in (-3, 3):
        parts.extend([(x, 33, 0, 4, 7, 5, g.DETAIL), (x, 39, 0, 6, 2, 7, g.SOIL),
                      (x, 41, 0, 3, 1, 4, g.RUBBER)])
    for y, x in ((4, -4), (8, 3), (15, 2), (19, -2)):
        parts.append((x, y, 6, 5, 2, 2, g.CAP))
    return sculpt(parts)


def timber_solar(g):
    parts = [(0, 0, 0, 39, 3, 6, g.SOIL), (0, 3, 0, 38, 19, 4, g.CAP),
             (0, 21, 0, 41, 3, 7, g.SOIL)]
    for x in (-17, 0, 17):
        parts.append((x, 2, 2, 3, 20, 3, g.WOOD))
    for x in (-9, 8):
        parts.extend([(x, 8, 3, 10, 10, 2, g.DARK), (x, 6, 4, 13, 2, 4, g.WOOD),
                      (x, 9, 4, 1, 9, 1, g.CAP)])
    return sculpt(parts)


def arcade_door(g):
    parts = [(0, 0, 0, 36, 29, 5, g.MASONRY), (0, 28, 0, 39, 3, 6, g.CAP)]
    shape = sculpt(parts)
    shape.cut((-7, 7), (0, 18), (-3, 3))
    shape.cut((-5, 5), (19, 21), (-3, 3))
    for x in (-9, 9):
        box(3, 20, 7, g.CAP, x=x, sculpt=shape)
        box(6, 3, 8, g.PATINA, x=x, y=18, sculpt=shape)
    box(13, 3, 7, g.CAP, y=22, sculpt=shape)
    return shape


def herb_border(g):
    parts = [
        (-6, 0, 0, 19, 4, 9, g.PATINA), (8, 0, -1, 10, 6, 8, g.MASONRY),
        (-8, 4, -1, 14, 2, 6, g.SOIL), (7, 6, -2, 10, 2, 6, g.SOIL),
    ]
    for x, y, z, w, d in ((-9, 5, 1, 8, 5), (-4, 6, -2, 7, 7),
                           (4, 8, -2, 8, 5), (10, 8, 0, 6, 6)):
        parts.extend([(x, y, z, w, 4, d, g.DARK), (x - 1, y + 3, z, w - 2, 3, d - 2, g.BODY)])
    for x, y, z in ((-7, 10, 1), (-3, 12, -2), (5, 14, -2), (9, 14, 0)):
        parts.extend([(x, y, z, 1, 4, 1, g.BODY), (x, y + 3, z, 2, 2, 1, g.MARK)])
    return sculpt(parts)


def scoured_bank(g):
    shape = box(40, 1, 40, g.SOIL)
    for x, width, shore in ((-16, 8, 4), (-8, 8, 8), (0, 8, 11), (8, 8, 7), (16, 8, 3)):
        for y, edge, color in ((1, shore + 5, g.PATINA), (2, shore + 2, g.SOIL), (3, shore, g.GRIT)):
            depth = 20 + edge
            box(width, 1, depth, color, x=x, y=y, z=-20 + depth // 2, sculpt=shape)
    for x, z, w, d in ((-12, -1, 11, 5), (1, 5, 8, 4), (13, 0, 7, 5), (6, -7, 12, 7)):
        box(w, 1, d, g.BODY, x=x, y=4, z=z, sculpt=shape)
    return shape


def driftwood(g):
    parts = [(-5, 2, 0, 17, 4, 4, g.SOIL), (6, 3, 1, 8, 3, 3, g.WOOD),
             (12, 4, 1, 6, 2, 2, g.CAP), (-12, 1, 0, 5, 6, 6, g.WOOD),
             (-16, 0, 3, 5, 2, 3, g.SOIL), (-14, 6, -2, 3, 3, 3, g.WOOD),
             (-16, 8, -3, 3, 3, 2, g.CAP), (-8, 4, 2, 3, 3, 3, g.WOOD),
             (-6, 6, 3, 2, 2, 3, g.CAP)]
    return sculpt(parts)


def river_gauge(g):
    parts = [(0, 0, 0, 3, 18, 3, g.SOIL), (0, 3, 2, 3, 14, 1, g.CAP),
             (0, 18, 0, 4, 1, 4, g.METAL)]
    for y in range(4, 17, 3):
        parts.append((-1, y, 2, 2, 1, 1, g.DETAIL))
    return sculpt(parts)


def sampling_reel(g):
    parts = [(0, 0, 0, 12, 2, 8, g.SOIL)]
    for x in (-4, 4):
        parts.extend([(x, 2, 0, 2, 8, 3, g.METAL), (x, 6, 0, 1, 6, 7, g.METAL)])
    parts.extend([(0, 6, 0, 7, 4, 5, g.CAP), (6, 8, 0, 4, 2, 2, g.DARK),
                  (8, 6, 0, 2, 3, 2, g.WOOD)])
    return sculpt(parts)


def orchard_wall(g):
    parts = [(0,0,0,31,2,7,g.PATINA),(0,2,0,30,4,5,g.PATINA),
             (-5,6,0,21,3,4,g.PATINA),(10,6,0,8,2,4,g.MASONRY)]
    for x,y,w,color in ((-10,2,8,g.MASONRY),(0,2,9,g.GRIT),(11,3,6,g.MASONRY),
                        (-12,6,6,g.GRIT),(-4,6,7,g.MASONRY),(3,6,5,g.GRIT)):
        parts.append((x,y,2,w,2,2,color))
    for x,y,w in ((-11,9,8),(-2,9,9),(6,8,6),(12,8,5)):
        parts.append((x,y,0,w,2,6,g.CAP))
    return sculpt(parts)


def orchard_pear(g):
    parts = [(0,0,0,6,2,6,g.SOIL),(0,2,0,4,11,4,g.WOOD),
             (0,11,0,3,12,3,g.WOOD),(1,22,0,2,5,2,g.WOOD),
             (-4,11,0,8,3,3,g.SOIL),(-8,11,0,2,6,2,g.WOOD),
             (-10,16,0,6,2,2,g.WOOD),(-13,16,0,2,4,2,g.SOIL),
             (4,14,0,7,2,3,g.WOOD),(8,15,0,3,5,2,g.SOIL),
             (11,18,0,6,2,2,g.WOOD),(13,19,0,2,4,2,g.WOOD),
             (-3,21,0,7,2,2,g.WOOD),(-6,22,0,2,3,2,g.SOIL)]
    return sculpt(parts)


def pear_leaf_spur(g):
    parts = [(0,0,0,3,3,3,g.WOOD),(-2,2,0,6,2,3,g.SOIL),
             (-3,3,0,5,3,5,g.DARK),(-5,5,0,4,3,3,g.BODY),
             (-3,6,1,3,3,3,g.BODY),(0,4,0,5,3,5,g.DARK),
             (2,6,0,4,3,4,g.BODY),(4,8,-1,4,2,3,g.BODY),
             (0,7,-2,3,3,3,g.DARK),(0,9,-2,2,2,3,g.BODY),
             (-3,2,2,1,2,1,g.MARK),(1,3,2,2,2,1,g.MARK),
             (-6,6,1,3,1,2,g.BODY),(-7,7,1,2,1,1,g.DARK),
             (4,7,1,3,1,2,g.DARK),(5,8,1,2,1,1,g.BODY),(3,9,-2,2,2,1,g.BODY)]
    return sculpt(parts)


def garden_groundcover(g):
    parts=[(-3,0,0,17,2,6,g.SOIL),(6,0,1,8,2,5,g.GRIT),
           (-6,2,0,8,2,4,g.DARK),(1,2,-1,9,2,4,g.DARK),
           (6,2,1,5,2,3,g.DARK),(-9,3,1,4,2,3,g.BODY),
           (-6,4,-1,3,2,4,g.BODY),(-3,3,0,3,2,3,g.BODY),
           (1,4,-2,3,3,2,g.BODY),(4,3,0,4,2,3,g.BODY),
           (7,4,1,4,2,2,g.BODY),(-6,6,-2,1,2,1,g.GRIT),
           (1,7,-2,2,1,1,g.GRIT),(-10,4,2,3,1,2,g.DARK),
           (-11,5,2,2,1,1,g.BODY),(7,5,2,2,1,3,g.DARK),(7,6,3,1,1,2,g.BODY)]
    return sculpt(parts)


def kitchen_orchard(kit, g):
    instances(kit,'Orchard boundary wall',orchard_wall(g),[
        (8.25,-11.55),(11.3,-11.55),(12.75,-9.95,1),
        (13.9,-4.6,3),(13.9,-1.6,3)])
    trees = [(9.6,-12.3,0),(12.15,-10.65,1),(8.8,-6.75,1),(14.8,-5.25,3)]
    instances(kit,'Pruned pear espalier',orchard_pear(g),trees)
    shoots = []
    for x,z,turn in trees:
        for dx,dy,angle in ((-1.2,1.7,0),(-0.8,1.55,1),(0.75,1.8,3),(1.2,2.0,2),
                            (-0.6,2.25,1),(0.1,2.48,3)):
            u,v=dx,0
            for _ in range(turn):
                u,v=v,-u
            shoots.append((round(x+u,2),round(z+v,2),(turn+angle)%4,dy))
    instances(kit,'Pear leaf spurs',pear_leaf_spur(g),shoots)
    instances(kit,'Garden bank groundcover',garden_groundcover(g),[
        (4.65,-9.36),(5.8,-9.58,2),(7.4,-11.05),(9.15,-10.98,2),
        (11.15,-11.07),(12.2,-10.05,1),(12.15,-9.5,3),(13.35,-5.18,3),
        (8.85,-6.82,1),(9.05,-5.98,3),(8.42,-6.42,2),
        (14.0,-9.38,0,4.1),(14.15,-8.85,0,3.3)])
    kit.set_palette('Orchard boundary wall',skin='#958d78',trim='#aaa28b',primary='#8d846a')
    kit.set_palette('Pruned pear espalier',leather='#80654d')
    kit.set_palette('Pear leaf spurs',primary='#839a50',secondary='#506a3b',accent='#bcad63')
    kit.set_palette('Garden bank groundcover',primary='#81965a',secondary='#536b41',leather='#806f51')


def serving_hatch(g):
    parts = []
    for x in (-12, 12):
        parts.extend([(x,0,0,4,3,5,g.PATINA),(x,3,-1,2,20,3,g.WOOD),
                      (x,6,1,3,3,4,g.SOIL),(x,8,3,3,2,5,g.WOOD),
                      (x,20,0,2,2,4,g.METAL),(x,21,2,2,2,3,g.WOOD)])
    parts.extend([(0,9,2,29,2,8,g.WOOD),(0,10,6,30,1,1,g.SOIL),
                  (0,24,-2,30,2,4,g.SOIL),(0,23,1,30,2,4,g.WOOD),
                  (0,22,4,31,2,3,g.WOOD),(0,22,6,32,1,1,g.METAL)])
    return sculpt(parts)


def bread_tray(g):
    parts = [(0,0,0,18,1,6,g.WOOD),(0,1,2,18,1,1,g.SOIL),
             (-8,1,0,1,1,5,g.SOIL),(8,1,0,1,1,5,g.SOIL)]
    for x,z,w in ((-5,-1,5),(1,0,5),(6,0,3)):
        parts.extend([(x,1,z,w,2,4,g.DETAIL),(x,3,z,w-1,1,3,g.MARK),
                      (x-1,3,z,1,1,2,g.CAP)])
    return sculpt(parts)


def bakers_yard_drain(g):
    parts = []
    for x,z,w,d in ((-11,2,7,5),(-3,1,6,5),(4,3,6,6),(10,2,5,5),
                    (-8,-4,8,4),(1,-3,7,4),(9,-3,6,4)):
        parts.append((x,0,z,w,2,d,g.PATINA if z<0 else g.MASONRY))
    parts.extend([(-4,0,7,17,2,2,g.GRIT),(8,0,7,6,2,2,g.GRIT),
                  (0,0,9,27,1,3,g.SOIL)])
    for x in (-9,-5,-1,3,7):
        parts.append((x,1,9,1,1,3,g.METAL))
    return sculpt(parts)


def cobbled_turn(g):
    parts = []
    for x, z, w, d in ((-11, -3, 7, 4), (-4, -1, 5, 5), (4, -3, 7, 3),
                        (10, 0, 4, 5), (-7, 4, 6, 3), (1, 4, 7, 4)):
        parts.append((x, 0, z, w, 2, d, g.PATINA if z < 0 else g.MASONRY))
    return sculpt(parts)


def alder_sprig(g):
    parts = [(-4, 2, 0, 12, 2, 3, g.SOIL), (4, 3, -2, 7, 2, 4, g.SOIL)]
    for x, y, z, w, d in ((-8, 2, 2, 7, 8), (-3, 4, 5, 6, 5),
                            (0, 5, 0, 9, 8), (7, 4, -3, 8, 6), (10, 2, -7, 4, 6)):
        parts.extend([(x, y, z, w, 3, d, g.DARK),
                      (x - 1, y + 3, z - 1, w - 2, 2, d - 2, g.BODY)])
    return sculpt(parts)


def fir_stem(g):
    return sculpt([(0, 0, 0, 7, 7, 7, g.SOIL), (0, 7, 0, 5, 24, 5, g.WOOD),
                   (0, 31, 0, 4, 18, 4, g.SOIL), (1, 49, 0, 3, 13, 3, g.WOOD),
                   (2, 60, -1, 3, 6, 3, g.DARK), (-4, 0, 1, 4, 3, 4, g.SOIL),
                   (2, 0, -4, 4, 2, 5, g.WOOD), (-3, 24, 0, 4, 3, 3, g.WOOD),
                   (-5, 26, 0, 3, 2, 2, g.SOIL)])


def fir_frond(g):
    parts = [(0, 3, 0, 13, 2, 2, g.WOOD), (7, 2, 0, 6, 2, 2, g.SOIL)]
    for x, y, z, w, d in ((-6, 4, 0, 8, 5), (-1, 3, 2, 9, 7),
                           (4, 2, -2, 8, 7), (8, 1, 2, 6, 5), (12, 0, 0, 5, 3)):
        parts.extend([(x, y, z, w, 2, d, g.DARK),
                      (x - 1, y + 2, z, w - 2, 2, d - 1, g.BODY)])
    return sculpt(parts)


def chart(g):
    shape = box(19, 11, 1, g.CAP)
    for x, y, w, h in ((-6, 2, 4, 4), (-4, 4, 6, 3), (-2, 5, 5, 4),
                       (6, 1, 5, 3), (5, 3, 4, 2)):
        box(w, h, 1, g.BODY, x=x, y=y, sculpt=shape)
    for x, y, w in ((-6, 9, 5), (-3, 8, 4), (0, 7, 4), (2, 6, 3),
                    (3, 5, 2), (2, 4, 3), (0, 3, 3), (-1, 2, 2), (-2, 1, 2)):
        box(w, 1, 1, g.LIGHT, x=x, y=y, sculpt=shape)
    for x, y in ((-6, 3), (1, 7), (6, 2)):
        box(1, 1, 2, g.MARK, x=x, y=y, sculpt=shape)
    box(19, 1, 2, g.WOOD, y=10, sculpt=shape)
    return shape


def sample_case(g):
    parts = [(0, 0, 0, 13, 1, 8, g.SOIL), (0, 1, -3, 13, 8, 2, g.WOOD),
             (0, 2, -2, 10, 5, 1, g.CAP), (0, 1, 3, 13, 2, 1, g.WOOD)]
    for x, mineral in ((-4, g.MASONRY), (0, g.GRIT), (4, g.DETAIL)):
        parts.extend([(x, 1, 0, 3, 3, 4, mineral), (x, 4, -1, 2, 1, 2, mineral)])
    return sculpt(parts)


def quadrat_rack(g):
    parts = [(-10, 0, 0, 3, 20, 5, g.WOOD), (10, 0, 0, 3, 20, 5, g.WOOD),
             (0, 18, 0, 23, 2, 3, g.SOIL), (0, 4, 0, 20, 2, 7, g.SOIL)]
    for x, drop in ((-6, 6), (0, 10), (6, 7)):
        parts.extend([(x, 9, 0, 1, 10, 1, g.CAP), (x, 16-drop, 0, 5, 4, 3, g.DARK),
                      (x-1, 18-drop, 0, 3, 4, 3, g.BODY)])
    return sculpt(parts)


def hearth(g):
    shape = box(19, 6, 15, g.PATINA)
    box(21, 2, 17, g.MASONRY, y=6, sculpt=shape)
    box(18, 13, 11, g.DETAIL, y=8, z=-2, sculpt=shape)
    shape.cut((-5, 5), (8, 16), (-4, 6))
    shape.cut((-3, 3), (17, 18), (-3, 6))
    box(10, 8, 1, g.RUBBER, y=8, z=-4, sculpt=shape)
    for x in (-6, 6):
        box(3, 3, 3, g.PATINA, x=x, y=15, z=3, sculpt=shape)
        box(3, 3, 2, g.SOIL, x=x, y=9, z=3, sculpt=shape)
    for x,w,y in ((-4,3,17),(-1,3,18),(2,3,18),(5,2,17)):
        box(w,2,3,g.PATINA,x=x,y=y,z=3,sculpt=shape)
    box(5,1,2,g.RUBBER,x=-1,y=17,z=3,sculpt=shape)
    box(14, 3, 9, g.PATINA, y=21, z=-2, sculpt=shape)
    box(9, 4, 7, g.DETAIL, y=24, z=-2, sculpt=shape)
    box(5, 13, 5, g.PATINA, y=28, z=-2, sculpt=shape)
    box(7, 2, 7, g.MASONRY, y=41, z=-2, sculpt=shape)
    return shape


def coppersmith_block(g):
    parts = [(0, 0, 0, 9, 6, 8, g.SOIL), (0, 6, 0, 10, 2, 9, g.DARK),
             (0, 8, 0, 7, 3, 6, g.METAL), (2, 11, 0, 14, 3, 6, g.METAL),
             (10, 12, 0, 4, 2, 4, g.METAL), (13, 13, 0, 3, 1, 2, g.METAL),
             (-3, 5, 4, 2, 6, 2, g.WOOD), (-3, 10, 4, 4, 2, 2, g.DARK)]
    return sculpt(parts)


def copper_basins(g):
    parts = []
    for x, z, w, d, c in ((-5, 1, 8, 7, g.METAL), (3, -2, 7, 6, g.MARK), (6, 3, 4, 4, g.METAL)):
        parts.extend([(x, 0, z, w-2, 1, d-2, c), (x, 1, z, w, 2, d, c),
                      (x, 3, z, w-2, 1, d-2, g.SOIL)])
        for side in (-1, 1):
            parts.append((x + side*(w//2), 3, z, 1, 1, d-1, c))
    return sculpt(parts)


def market_fruit(g):
    parts = [(0, 0, 0, 18, 2, 8, g.WOOD), (0, 2, 4, 18, 2, 1, g.SOIL)]
    for x in (-8, 0, 8):
        parts.append((x, 2, 0, 1, 3, 8, g.SOIL))
    for x, z, color in ((-6, -2, g.MARK), (-3, -1, g.MARK), (-5, 1, g.MARK),
                        (2, -2, g.BODY), (5, -2, g.BODY), (4, 1, g.BODY), (6, 1, g.BODY)):
        parts.extend([(x, 2, z, 3, 3, 3, color), (x, 5, z, 2, 1, 2, color)])
    return sculpt(parts)


def cloth_span(g):
    parts = []
    for x in (-25, 25):
        parts.extend([(x, 0, 0, 4, 4, 4, g.PATINA), (x, 4, 0, 2, 28, 2, g.WOOD)])
    for x, w, y in ((-19, 12, 31), (-8, 10, 30), (0, 7, 29), (8, 9, 30), (19, 12, 31)):
        parts.append((x, y, 0, w, 1, 1, g.SOIL))
    for x, y, c in ((-17, 31, g.DETAIL), (-7, 30, g.CAP), (1, 29, g.BODY), (12, 30, g.DETAIL)):
        parts.extend([(x, y-4, 0, 5, 4, 1, c), (x, y-6, 0, 3, 2, 1, c)])
    return sculpt(parts)


def fir_leader(g):
    parts = [(0, 0, 0, 3, 17, 3, g.SOIL)]
    for x, y, z, width, depth in ((-3, 0, 0, 10, 6), (2, 3, -1, 9, 7),
                                  (-2, 6, 1, 7, 6), (1, 9, 0, 5, 4), (0, 13, 0, 3, 3)):
        parts.extend([(x, y, z, width, 3, depth, g.DARK),
                      (x, y+2, z, width-1, 2, depth-1, g.BODY)])
    return sculpt(parts)


def wooded_slope(kit, g, alders):
    firs = [(-7.6, -0.92), (-8.4, 4.2), (4.55, -3.8), (-8.6, 8.9), (7, 12), (-11, -18)]
    for x, z in firs[:-1]:
        kit.remove_at('Tall pine', x, z, height=0)
    kit.remove_at('Ridge fir', *firs[-1], height=0)
    instances(kit, 'Split bark fir stem', fir_stem(g), firs)
    fronds = []
    for index, (x, z) in enumerate(firs):
        for layer, height in enumerate((2.45, 3.2, 4.1, 4.95)):
            for arm in range(3):
                turn = (index + layer + arm) % 4
                dx, dz = ((1, 0), (0, -1), (-1, 0), (0, 1))[turn]
                reach = 0.7 - 0.1 * layer
                fronds.append((round(x+dx*reach, 2), round(z+dz*reach, 2), turn, round(height+arm*0.16, 2)))
    instances(kit, 'Fir needle spray', fir_frond(g), fronds)
    instances(kit, 'Fir crown leader', fir_leader(g), [(x, z, i % 4, 5.45) for i, (x,z) in enumerate(firs)])
    tips = []
    for x, z, turn in alders:
        for dx, dz, spin, height in ((-1.7, -0.6, 1, 4.2), (0.9, -1.2, 2, 3.9),
                                      (0.4, 1.4, 3, 4.9), (-1.4, 0.6, 0, 4.4)):
            for _ in range(turn):
                dx, dz = dz, -dx
            tips.append((round(x+dx, 1), round(z+dz, 1), (turn+spin)%4, height))
    instances(kit, 'Alder outer sprigs', alder_sprig(g), tips)
    kit.set_palette('Fir needle spray', primary='#62816a', secondary='#304f43', leather='#735f4b')
    kit.set_palette('Fir crown leader', primary='#779577', secondary='#3a594d')
    kit.set_palette('Alder outer sprigs', primary='#81994f', secondary='#49623e')


def glacial_ridge(g):
    parts = [(-7, 0, -1, 27, 4, 16, g.PATINA), (10, 0, 2, 16, 5, 13, g.SOIL),
             (-7, 4, -2, 23, 4, 13, g.SOIL), (-10, 8, -3, 17, 4, 10, g.MASONRY),
             (-10, 12, -4, 14, 2, 8, g.BODY), (4, 5, 0, 14, 4, 10, g.MASONRY),
             (5, 9, -1, 11, 2, 8, g.GRIT), (14, 5, 2, 9, 2, 9, g.BODY),
             (-14, 4, 6, 12, 2, 6, g.MASONRY), (-15, 6, 6, 8, 1, 4, g.DARK)]
    return sculpt(parts)


def water_bar(g):
    return sculpt([(-5, 0, 0, 14, 2, 3, g.WOOD), (7, 0, -1, 11, 2, 3, g.SOIL),
                   (-10, 0, 2, 3, 3, 2, g.SOIL), (10, 0, 1, 2, 3, 2, g.WOOD),
                   (-3, 0, -3, 8, 1, 2, g.GRIT), (5, 0, -4, 5, 1, 3, g.MASONRY)])


def specimen_desk(g):
    parts = []
    for x in (-8, 8):
        for z in (-4, 4):
            parts.append((x, 0, z, 2, 9, 2, g.SOIL))
    parts.extend([(0, 5, -4, 17, 2, 2, g.SOIL), (0, 8, 0, 20, 2, 12, g.WOOD),
                  (0, 10, 1, 17, 1, 8, g.CAP), (-3, 11, 0, 8, 1, 5, g.GRIT),
                  (-4, 12, -1, 5, 1, 3, g.BODY), (4, 11, 0, 4, 1, 4, g.BODY),
                  (0, 11, 3, 5, 1, 1, g.LIGHT), (1, 11, 1, 2, 1, 3, g.LIGHT),
                  (3, 11, -1, 4, 1, 1, g.LIGHT), (-7, 11, 3, 1, 2, 1, g.MARK)])
    return sculpt(parts)


def bell_turret(g):
    parts = [(0, 0, 0, 18, 2, 14, g.SOIL)]
    for x in (-7, 7):
        for z in (-5, 5):
            parts.append((x, 2, z, 2, 14, 2, g.WOOD))
    parts.extend([(0, 14, 0, 17, 3, 13, g.SOIL), (0, 10, 0, 3, 4, 3, g.DARK),
                  (0, 7, 0, 6, 4, 5, g.METAL), (0, 5, 0, 8, 2, 7, g.METAL),
                  (0, 3, 0, 2, 3, 2, g.DARK)])
    for step in range(5):
        parts.append((0, 17 + step*2, 0, 21-step*4, 2, 17-step*3, g.DARK if step==0 else g.BODY))
    return sculpt(parts)


def forge_canopy(g):
    parts = [(-15, 0, 0, 5, 13, 19, g.PATINA), (-15, 13, -1, 3, 13, 17, g.MASONRY),
             (0, 25, -8, 33, 3, 3, g.SOIL), (0, 22, 9, 33, 3, 3, g.SOIL),
             (-11, 18, 9, 7, 4, 3, g.WOOD), (-7, 21, 9, 6, 3, 3, g.WOOD),
             (15, 0, -8, 3, 25, 3, g.WOOD)]
    for step in range(4):
        parts.append((0, 25+step, 9-step*5, 36, 2, 6, g.DARK))
    return sculpt(parts)


def bellows(g):
    parts = [(-3, 0, 0, 11, 5, 8, g.WOOD), (-3, 5, 0, 14, 2, 10, g.SOIL),
             (-4, 7, 0, 12, 3, 8, g.DARK), (-5, 10, 0, 10, 2, 7, g.WOOD),
             (-10, 11, 0, 7, 2, 3, g.WOOD), (5, 6, 0, 6, 2, 5, g.SOIL),
             (9, 6, 0, 4, 2, 2, g.METAL)]
    return sculpt(parts)


def pan_rail(g):
    parts = [(0, 11, 0, 17, 2, 3, g.WOOD)]
    for x, drop, width, copper in ((-5, 3, 6, g.METAL), (2, 5, 5, g.MARK), (7, 2, 3, g.METAL)):
        parts.extend([(x, drop + 4, 1, 1, 8-drop, 1, g.DARK),
                      (x, drop, 1, width, 4, 2, copper), (x, drop-1, 1, width-2, 1, 2, copper)])
    return sculpt(parts)


def creek_extension(g, width, depth):
    shape = box(width, 2, depth, g.vk.vox('visor', -0.25, mottle=False))
    box(width-4, 1, 1, g.vk.vox('visor', -0.5, mottle=False), y=1, z=-depth//2, sculpt=shape)
    for x,z,w in ((-width//4,0,4),(width//5,depth//3,6)):
        box(w, 1, 1, g.vk.vox('visor', 0, mottle=False), x=x, y=1, z=z, sculpt=shape)
    return shape


def forest_footing(g):
    shape = box(40, 4, 30, g.SOIL)
    box(40, 3, 23, g.GRIT, y=4, z=3, sculpt=shape)
    box(40, 1, 20, g.BODY, y=7, z=5, sculpt=shape)
    for x, z, w, d in ((-14, -8, 10, 5), (-3, -7, 9, 6), (10, -8, 12, 4)):
        box(w, 2, d, g.PATINA, x=x, y=4, z=z, sculpt=shape)
    return shape


def aspen_stems(g):
    return sculpt([(-3, 0, 0, 4, 18, 4, g.CAP), (-4, 17, 0, 3, 14, 3, g.CAP),
                   (-5, 30, -1, 3, 11, 3, g.CAP), (-7, 39, -2, 3, 9, 3, g.CAP),
                   (3, 0, 2, 4, 12, 4, g.CAP), (5, 11, 2, 3, 14, 3, g.CAP),
                   (6, 24, 3, 3, 14, 3, g.CAP), (7, 36, 4, 2, 10, 2, g.CAP),
                   (0, 22, 0, 5, 3, 2, g.WOOD), (2, 24, -1, 2, 8, 2, g.CAP),
                   (-3, 7, 2, 3, 1, 1, g.SOIL), (-4, 15, -1, 3, 1, 1, g.SOIL),
                   (5, 19, 3, 3, 1, 1, g.SOIL), (-5, 32, 0, 2, 1, 1, g.SOIL)])


def aspen_crown(g):
    parts = []
    for x,y,z,w,d in ((-7, 0, 0, 9, 8), (-4, 5, -2, 13, 9), (-8, 10, -3, 9, 8),
                      (-4, 14, -3, 8, 7), (5, 3, 3, 9, 8), (8, 7, 4, 10, 8),
                      (6, 12, 4, 7, 7), (7, 16, 3, 5, 5)):
        parts.extend([(x,y,z,w,5,d,g.DARK), (x-1,y+4,z,w-2,3,d-2,g.BODY)])
    return sculpt(parts)


def root_bank(g):
    shape = sculpt([(0, 0, -2, 31, 3, 12, g.PATINA), (0, 3, -3, 29, 3, 9, g.SOIL),
                    (2, 6, -2, 24, 2, 11, g.GRIT), (1, 8, -2, 20, 1, 9, g.BODY)])
    shape.cut((-5, 6), (2, 5), (0, 3))
    for x, y, z, w, h in ((-8, 5, 3, 6, 2), (-6, 3, 4, 3, 3),
                           (-3, 2, 5, 5, 2), (1, 4, 3, 6, 2), (4, 2, 4, 2, 3),
                           (7, 1, 5, 5, 2)):
        box(w, h, 2, g.WOOD, x=x, y=y, z=z, sculpt=shape)
    return shape


def bird_blind(g):
    parts = [(-12, 0, 0, 2, 21, 3, g.WOOD), (12, 0, -8, 3, 22, 3, g.WOOD),
             (-12, 0, 8, 2, 19, 3, g.WOOD), (12, 0, 8, 3, 19, 3, g.WOOD),
             (0, 19, 8, 27, 2, 3, g.SOIL), (0, 22, -8, 27, 2, 3, g.SOIL),
             (-12, 20, -3, 2, 2, 12, g.WOOD), (12, 21, 0, 2, 2, 18, g.WOOD),
             (-9, 21, -8, 7, 1, 3, g.WOOD)]
    for x, width in ((-9, 7), (0, 11), (10, 8)):
        parts.append((x, 0, -8, width, 5, 2, g.WOOD))
    parts.extend([(0, 5, -8, 26, 1, 3, g.SOIL), (9, 6, -8, 7, 3, 2, g.WOOD)])
    for i in range(4):
        parts.append((0, 21+i, 8-i*5, 30, 2, 6, g.DARK))
    for x in (-10, 9):
        parts.append((x, 22, 5, 2, 1, 9, g.SOIL))
    return sculpt(parts)


def silt_fan(g):
    parts = []
    for x,z,w,d,h in ((-11,-2,5,4,2),(-7,-1,5,7,3),(-2,0,6,11,3),
                      (4,1,6,8,2),(8,2,4,6,2),(11,3,3,3,1)):
        parts.append((x,0,z,w,h,d,g.SOIL))
        parts.append((x,h,z-1,w-1,1,max(1,d-3),g.GRIT))
    for x,y,z,w in ((-8,3,-2,3),(-3,3,-4,3),(-2,3,2,2),(4,2,0,3),(8,2,2,2)):
        parts.append((x,y,z,w,1,1,g.MASONRY))
    parts.extend([(-2,4,0,3,1,2,g.PATINA),(-2,5,0,2,1,1,g.MASONRY),
                  (-9,3,1,1,1,1,g.PATINA),(5,3,-1,2,1,2,g.PATINA)])
    return sculpt(parts)


def sample_tray(g):
    parts = [(-6,0,0,2,7,5,g.SOIL),(6,0,0,2,7,5,g.SOIL),
             (0,2,0,13,1,2,g.WOOD),(0,7,0,15,2,7,g.WOOD)]
    for x in (-4,0,4):
        parts.extend([(x,9,0,3,1,4,g.METAL),(x,10,0,3,2,2,g.LIGHT),
                      (x,12,0,2,1,2,g.DARK)])
    return sculpt(parts)


def spotting_scope(g):
    parts = [(0, 5, 0, 3, 7, 3, g.METAL), (0, 11, 0, 4, 2, 4, g.DARK),
             (0, 14, -1, 5, 2, 10, g.DARK), (0, 13, -1, 3, 4, 10, g.DARK),
             (0, 13, -6, 6, 4, 3, g.BODY), (0, 12, -6, 4, 6, 3, g.BODY),
             (0, 14, -8, 4, 2, 1, g.LIGHT), (0, 13, -8, 2, 4, 1, g.LIGHT),
             (3, 14, 1, 2, 2, 3, g.METAL), (0, 14, 5, 2, 2, 4, g.RUBBER)]
    for x,z in ((-4,2),(4,2),(0,-4)):
        parts.extend([(x, 0, z, 2, 3, 2, g.WOOD), (x//2, 3, z//2, 3, 3, 3, g.WOOD)])
    return sculpt(parts)


def bird_sign(g):
    shape = box(12, 9, 2, g.CAP)
    for x,y,w in ((-3,2,5),(-1,3,6),(0,4,5),(2,5,3),(3,6,2),(4,5,3)):
        box(w,1,1,g.DARK,x=x,y=y,z=1,sculpt=shape)
    box(2,2,1,g.MARK,x=4,y=5,z=1,sculpt=shape)
    return shape


def canoe_ribs(g):
    parts = []
    for x in (-7, 0, 7):
        parts.extend([(x, 0, 0, 1, 1, 7, g.SOIL), (x, 1, -3, 1, 2, 1, g.SOIL),
                      (x, 1, 3, 1, 2, 1, g.SOIL)])
    return sculpt(parts)


def porch_lamp(g):
    return sculpt([(0, 0, 0, 4, 1, 4, g.METAL), (0, 1, 0, 3, 4, 3, g.LAMP),
                   (0, 5, 0, 5, 1, 5, g.DARK), (0, 6, 0, 2, 2, 2, g.METAL)])


def wool_cellar(g):
    shape = box(34, 11, 34, g.PATINA)
    box(36, 2, 36, g.CAP, y=10, sculpt=shape)
    for x, y, w in ((-10, 2, 11), (2, 2, 10), (12, 5, 6), (-7, 6, 15)):
        box(w,3,2,g.MASONRY,x=x,y=y,z=16,sculpt=shape)
    shape.cut((4,10),(3,8),(13,17))
    for x in (5,8,10):
        box(1,6,1,g.DARK,x=x,y=3,z=16,sculpt=shape)
    return shape


def wool_gate(g):
    shape = box(34, 34, 4, g.MASONRY)
    shape.cut((-9,8),(0,21),(-2,1))
    for x in (-11,10):
        box(3,24,6,g.CAP,x=x,sculpt=shape)
    for x, width in ((-10,7),(-2,9),(7,8),(13,3)):
        box(width,3,6,g.CAP if x != -2 else g.PATINA,x=x,y=23,sculpt=shape)
    box(6,1,7,g.METAL,x=-5,y=25,sculpt=shape)
    for x in (-7,-3):
        box(1,2,1,g.METAL,x=x,y=24,z=3,sculpt=shape)
    box(4,20,3,g.WOOD,x=6,y=0,z=-1,sculpt=shape)
    for y in (3,15):
        box(4,2,2,g.DARK,x=6,y=y,z=1,sculpt=shape)
    box(2,3,2,g.METAL,x=5,y=9,z=1,sculpt=shape)
    for x in (-12,11):
        box(7,5,2,g.PATINA,x=x,y=27,z=2,sculpt=shape)
    return shape


def wool_shutters(g):
    parts = [(0, 0, 0, 35, 3, 5, g.SOIL),(0,3,0,33,17,4,g.CAP),
             (0,20,0,36,3,6,g.WOOD)]
    for x in (-14,0,14):
        parts.append((x,2,2,2,19,3,g.WOOD))
    for x in (-7,7):
        parts.extend([(x,7,2,9,11,2,g.DARK),(x-2,7,4,3,11,2,g.DETAIL),
                      (x,6,3,11,2,4,g.SOIL)])
    return sculpt(parts)


def wool_bales(g):
    parts = []
    for x,y,z,w,d,cloth in ((-5,0,0,10,8,g.CAP),(5,0,1,9,8,g.BODY),(0,6,0,10,7,g.DETAIL)):
        parts.extend([(x,y,z,w,5,d,cloth),(x,y+5,z,w-2,1,d-2,cloth)])
        for shift in (-2,2):
            parts.append((x+shift,y+5,z,1,1,d,g.SOIL))
            parts.append((x+shift,y,z+d//2,1,5,1,g.SOIL))
    return sculpt(parts)


def well_winch(g):
    parts = [(-9,0,0,3,20,4,g.WOOD),(9,0,0,3,20,4,g.WOOD),
             (0,13,0,22,2,2,g.SOIL),(0,12,0,6,4,4,g.WOOD),
             (0,6,0,1,7,1,g.CAP),(0,4,0,4,3,4,g.METAL),
             (12,10,0,2,5,2,g.DARK),(14,10,0,4,2,2,g.WOOD)]
    for i in range(5):
        parts.append((0,20+2*i,0,24-4*i,2,17,g.DARK if i==0 else g.DETAIL))
    return sculpt(parts)


def trail_paddles(g):
    parts = [(0,0,0,9,2,5,g.SOIL),(-3,2,0,2,3,2,g.WOOD),(3,2,0,2,3,2,g.WOOD),
             (-3,4,0,3,6,2,g.CAP),(-3,10,0,1,8,2,g.WOOD),(-3,18,0,3,1,2,g.CAP),
             (3,4,0,3,5,2,g.WOOD),(3,9,0,1,7,2,g.CAP),(3,16,0,3,1,2,g.WOOD)]
    return sculpt(parts)


def field_journal(g):
    parts = [(-4,0,0,2,8,2,g.SOIL),(4,0,0,2,8,2,g.SOIL),(0,8,0,12,2,7,g.WOOD),
             (-2,10,0,5,1,4,g.CAP),(2,10,0,3,1,4,g.MASONRY),(4,10,2,3,1,1,g.MARK),
             (-2,11,0,2,1,1,g.DARK),(3,11,-1,1,1,1,g.DARK)]
    return sculpt(parts)


def stair_cheek(g):
    parts = []
    for i in range(6):
        height = 4+2*i
        z = 10-4*i
        parts.extend([(0,0,z,4,height,4,g.PATINA),
                      (0,height,z,5,2,4,g.CAP)])
        if i%2 == 1:
            parts.append((0,height-3,z,5,2,3,g.MASONRY))
    return sculpt(parts)


def wool_dock(g):
    parts = [(-15,0,0,5,10,7,g.PATINA),(0,0,0,5,10,7,g.MASONRY),
             (15,0,0,5,10,7,g.PATINA),(0,9,0,35,1,8,g.SOIL),
             (0,10,0,35,2,10,g.WOOD)]
    for x in (-13,-6,1,8,15):
        parts.append((x,11,0,1,1,10,g.CAP))
    return sculpt(parts)


def arch_stones(g):
    parts = [(0,5,0,6,5,3,g.CAP),(-1,3,0,4,3,3,g.CAP)]
    for side in (-1,1):
        parts.extend([(side*6,3,0,4,4,2,g.MASONRY),(side*10,1,0,4,4,2,g.CAP),
                      (side*14,0,0,4,3,2,g.MASONRY)])
    return sculpt(parts)


def loft_roof(g):
    shape = box(39,2,36,g.SOIL)
    for step in range(1,8):
        width = 39-step*5
        box(width,2,36,g.DARK,y=step*2,sculpt=shape)
        for z in (-17,17):
            box(width,2,2,g.WOOD,y=step*2,z=z,sculpt=shape)
    box(5,2,37,g.MASONRY,y=16,sculpt=shape)
    return shape


def coppice(g):
    parts=[(-5,0,0,4,11,4,g.SOIL),(0,6,0,8,3,3,g.WOOD),(4,9,0,3,10,3,g.WOOD),
           (-7,8,-1,3,12,3,g.WOOD)]
    for x,y,z,w,d in ((-10,15,-1,13,10),(-5,21,-3,12,9),(3,16,1,14,9),(9,13,3,8,8)):
        parts.extend([(x,y,z,w,4,d,g.DARK),(x-1,y+3,z-1,w-3,3,d-2,g.BODY)])
    return sculpt(parts)


def nest_box(g):
    shape = sculpt([(0,0,0,3,16,3,g.WOOD),(0,13,1,8,10,7,g.CAP),
                    (0,23,1,10,2,9,g.DARK),(0,18,5,3,3,1,g.RUBBER),
                    (0,16,5,2,1,3,g.WOOD)])
    return shape


def store_window(g):
    shape=box(34,34,4,g.MASONRY)
    shape.cut((-11,11),(17,24),(-2,1))
    box(27,2,6,g.WOOD,y=25,sculpt=shape)
    box(26,2,6,g.CAP,y=15,sculpt=shape)
    for x in (-6,0,6):
        box(2,8,3,g.WOOD,x=x,y=17,sculpt=shape)
    for x,y,w in ((-9,3,11),(6,6,9),(-5,10,12),(8,29,10)):
        box(w,2,2,g.PATINA,x=x,y=y,z=2,sculpt=shape)
    return shape


def loft_floor(g):
    shape=box(34,2,34,g.WOOD,y=1)
    for x in (-14,-5,5,14):
        box(3,1,34,g.SOIL,x=x,sculpt=shape)
    return shape


def loft_hoist(g):
    parts=[(0,14,-5,4,12,4,g.SOIL),(0,23,0,4,3,15,g.WOOD),
           (0,18,-2,3,3,5,g.WOOD),(0,20,1,3,3,5,g.WOOD),
           (0,20,6,4,4,4,g.METAL),(0,3,6,1,17,1,g.CAP),
           (0,0,6,2,4,2,g.METAL),(1,0,6,3,1,2,g.METAL),
           (-1,20,4,1,4,3,g.CAP),(-1,18,2,1,3,3,g.CAP),
           (-1,17,-1,1,2,4,g.CAP),(-1,14,-4,1,4,3,g.CAP),
           (-1,14,-5,5,1,4,g.CAP)]
    return sculpt(parts)


def skein_reel(g):
    parts = [(0,0,0,7,1,4,g.WOOD),(0,1,-1,2,6,2,g.SOIL),
             (0,6,0,3,2,4,g.METAL),(0,2,1,1,9,1,g.WOOD),
             (0,6,1,10,1,1,g.WOOD),(-4,4,1,2,5,1,g.CAP),
             (4,4,1,2,5,1,g.CAP),(0,10,1,5,1,1,g.CAP),
             (0,2,1,5,1,1,g.CAP)]
    for x in (-3,3):
        for y in (3,9):
            parts.append((x,y,1,2,1,1,g.CAP))
    return sculpt(parts)


def sorting_bench(g):
    parts = [(-8,0,0,2,8,6,g.SOIL),(8,0,0,2,8,6,g.SOIL),
             (0,2,0,17,2,2,g.WOOD),(0,8,0,20,2,9,g.WOOD),
             (2,10,-1,7,2,5,g.MASONRY),(2,12,-1,5,2,4,g.CAP),
             (0,11,1,3,2,2,g.CAP),(0,10,3,4,1,2,g.CAP),
             (4,10,0,2,2,2,g.SOIL),(6,11,0,3,1,2,g.WOOD),
             (7,10,-1,3,1,4,g.METAL)]
    for x in (5,7,9):
        parts.append((x,11,-2,1,2,1,g.METAL))
    return sculpt(parts)


def dye_trays(g):
    parts = []
    for x,z,fill in ((-4,0,g.DETAIL),(4,1,g.BODY)):
        parts.extend([(x,0,z,7,1,9,g.SOIL),(x-3,1,z,1,3,9,g.WOOD),
                      (x+3,1,z,1,3,9,g.WOOD),(x,1,z-4,5,2,1,g.WOOD),
                      (x,1,z+4,5,2,1,g.WOOD),(x,1,z,5,2,6,fill),
                      (x+1,3,z-1,2,1,3,fill)])
    return sculpt(parts)


def woven_shelf(g):
    parts=[(-10,0,0,2,17,6,g.WOOD),(10,0,0,2,17,6,g.WOOD),
           (0,3,0,21,2,7,g.SOIL),(0,12,0,21,2,7,g.WOOD)]
    for x,y,cloth in ((-5,5,g.BODY),(4,5,g.DETAIL),(-5,14,g.CAP),(4,14,g.BODY)):
        parts.extend([(x,y,0,8,2,6,cloth),(x+1,y+2,0,6,1,5,cloth)])
    return sculpt(parts)


def trail_outcrop(g):
    parts = [(-10,0,0,31,7,19,g.PATINA),(13,0,1,18,6,16,g.SOIL),
             (-12,7,-1,25,5,18,g.MASONRY),(5,5,-1,23,5,15,g.PATINA),
             (-13,12,-2,22,7,15,g.PATINA),(-12,19,-3,19,3,12,g.GRIT),
             (-12,22,-3,15,2,10,g.BODY),(1,10,-2,10,4,13,g.MASONRY),
             (2,14,-3,9,2,10,g.GRIT),(16,6,2,11,3,10,g.MASONRY),
             (16,9,2,9,2,8,g.GRIT),(-16,5,9,13,3,6,g.MASONRY)]
    return sculpt(parts)


def switchback_tread(g):
    parts = []
    for x,z,w in ((7,-18,14),(7,-14,16),(5,-10,16),(4,-6,16),(2,-2,16),
                  (0,2,16),(-2,6,15),(-4,10,16),(-6,14,16),(-8,18,15)):
        parts.append((x,0,z,w,2,4,g.SOIL))
    for x,z in ((1,-17),(11,-11),(-4,-5),(6,-1),(-8,7),(2,11),(-13,15)):
        parts.append((x,1,z,3,1,3,g.GRIT))
    for x,z,w in ((3,-11,4),(8,-15,5),(0,1,6),(-4,8,4),(-9,17,4)):
        parts.append((x,1,z,w,1,2,g.MASONRY))
    return sculpt(parts)


def forest_scrub(g):
    parts = [(-6,0,0,3,8,3,g.SOIL),(3,0,2,3,12,3,g.WOOD),
             (0,5,1,8,2,3,g.WOOD),(5,7,2,7,3,3,g.SOIL)]
    for x,y,z,w,d in ((-8,5,-1,9,7),(-3,8,1,8,7),(3,11,0,9,8),
                        (9,9,3,8,6),(12,6,4,6,5)):
        parts.extend([(x,y,z,w,4,d,g.DARK),(x-1,y+3,z,w-2,2,d-1,g.BODY)])
    return sculpt(parts)


def coal_bed(g):
    parts = [(-2,0,0,8,1,5,g.RUBBER),(4,0,1,4,1,4,g.PATINA)]
    for x,z,w,h,c in ((-4,1,3,2,g.DARK),(-3,-1,3,2,g.DETAIL),(0,0,2,1,g.MARK),
                      (3,-1,3,2,g.DARK),(4,2,2,2,g.RUBBER),(0,2,3,2,g.DETAIL),
                      (1,-2,2,1,g.LAMP),(-1,0,1,2,g.LAMP),(-5,-2,2,1,g.PATINA)):
        parts.append((x,1,z,w,h,2,c))
    return sculpt(parts)


def beaten_bowl(g):
    parts=[(0,0,1,4,1,4,g.METAL),(0,1,0,6,1,3,g.DETAIL),
           (0,2,-2,6,1,2,g.METAL),(0,3,-3,4,2,1,g.MARK),
           (0,1,3,4,1,1,g.MARK)]
    for side in (-1,1):
        parts.extend([(side*3,1,1,1,2,3,g.METAL),(side*3,2,-1,1,2,2,g.MARK),
                      (side*2,3,-2,1,1,2,g.METAL)])
    return sculpt(parts)


def gate_foot(g):
    parts = [(0,0,-1,9,3,6,g.PATINA),(-1,3,-2,8,4,4,g.MASONRY),
             (1,7,-2,7,3,3,g.CAP),(0,10,-2,8,2,4,g.MASONRY),
             (-4,0,2,6,1,4,g.SOIL),(-4,1,2,3,3,2,g.DARK),
             (-6,3,2,2,2,2,g.BODY)]
    return sculpt(parts)


def instances(kit, label, shape, placements):
    kit.add(label, shape, *placements[0])
    for placement in placements[1:]:
        kit.place(label, *placement)


def ranger_site(kit, g, stops, fixtures):
    alders = [
        (-5.8, 7.6, 0), (6.3, 5.8, 2), (-10.5, -4.1, 1), (7.6, -10.8, 3),
        (-8.3, -17.6, 2), (-10.4, -24.6, 0), (9.3, -21.5, 1)]
    instances(kit, 'Forked river alder', river_alder(g), alders)
    crowns = []
    for x, z, turn in alders:
        for dx, dz, height, spin in ((-1.3, -0.3, 3.9, 1), (0.6, -0.3, 3.6, 2), (-0.3, 0.8, 4.6, 0)):
            for _ in range(turn):
                dx, dz = dz, -dx
            crowns.append((round(x + dx, 1), round(z + dz, 1), (turn + spin) % 4, height))
    instances(kit, 'Alder leaf crown', alder_crown(g), crowns)
    instances(kit, 'Western hemlock', hemlock(g), [
        (-8.2, 9, 2), (8.5, 7.4, 1), (-9.7, -7.5), (9.4, -15.1, 2),
        (-14.6, -11.4, 3), (6.1, -24.5), (-7.5, -22.9, 2)])
    instances(kit, 'Mossy gravel bar', gravel_bar(g), [
        (-4.8, 4.1, 0, -0.2), (-8.1, 7.1, 2, -0.2), (3.8, 7.5, 2, -0.2),
        (5.6, 5.1, 1, -0.2), (-6.4, 2, 1), (7.2, -8.6, 3)])
    instances(kit, 'Sedge and rushes', sedge(g), [
        (-2.7, 4.4), (-4.5, 4.6, 2), (-5.2, 6.8, 1), (2.8, 6.7),
        (4.1, 6.3, 3), (4.6, 5, 2), (-8.5, 5.9), (6.3, -10.4, 1)])
    kit.add('Botanical drying press', field_press(g), -3.4, -17.6, 1)
    kit.add('Herbarium drawers', herbarium(g), -2.1, -21.3)
    kit.add('Pressed fern specimen', specimen_frame(g), -2.1, -21.6, 0, 1.9)
    instances(kit, 'Broken moss and grass margin', moss_patch(g), [
        (-4.7, 7.6), (-7.1, 7.6, 2), (-8.4, 4.9, 1), (4.1, 7.7, 1), (3.7, 4.7, 3),
        (-6.3, -2.8), (-5.2, -4.7, 3), (6.5, -6.8, 2), (7.2, -8.6), (6.6, -12, 1)])
    kit.placement_at('Ranger lodge letter board', 4.1, -9.8, height=3).update(position=[2, 3.0, -22.2], turn=2)
    kit.placement_at('Low willow', -4.7, 6.45, height=0).update(position=[-5.5, 0, 7.1], turn=0)
    kit.placement_at('Stream boulder', 2.5, 6.45, height=0).update(position=[2.5, 0, 7.2], turn=0)
    for label in ('Uneven rock shelf', 'Stone cover', 'Ranger truck'):
        prop_id = kit.prop_id(label)
        count = sum(placement['propId'] == prop_id for placement in kit.placements)
        if count != 2:
            raise ValueError(f'{label}: expected two placements, found {count}.')
    kit.placement_at('Uneven rock shelf', -7, 4.43)['position'] = [-7.3, 0, 3.6]
    kit.placement_at('Uneven rock shelf', 4.8, 6.9)['position'] = [5.2, 0, 7.6]
    kit.placement_at('Stone cover', -2.9, 5.55).update(position=[-7.5, 0, 0.6], turn=1)
    kit.placement_at('Stone cover', 2.85, 4.5).update(position=[5.2, 0, -0.4], turn=1)
    kit.placement_at('Split rail', -5.6, 5.4).update(position=[-6.1, 0, 2.2], turn=0)
    kit.placement_at('Field station', 2.8, -17.6)['turn'] = 3
    kit.placement_at('Survey supply rack', 5.5, -8.4).update(position=[4.1, 0, -9.1], turn=1)
    kit.add('Lodge boat porch', porch(g), 2, -8.9)
    kit.add('Bark canoe and trestles', boat_rack(g), 5.3, -7.7)
    kit.add('Canoe bent ash ribs', canoe_ribs(g), 5.3, -7.7, 0, 0.8)
    kit.add('Ranger porch lantern', porch_lamp(g), 2.4, -8.0, 0, 1.8)
    fixtures.append(dict(position=[2.4,2.1,-7.8], color='#ffcd92', intensity=8, distance=5))
    kit.placement_at('Ranger truck', 6.5, -10.2).update(position=[6.7, 0, -14.3], turn=0)
    kit.placement_at('Ranger truck', 2.45, 11.7).update(position=[10.2, 0, -20.9], turn=0)
    instances(kit, 'Creek sluice stones', creek_stones(g), [
        (-6.7, 3.7, 2, -0.3), (1.9, 7.8, 1, -0.3), (-8.1, 4.6, 2, -0.3),
        (6.8, -4.5, 0), (7.5, -11.9, 2), (-4.1, -6.8, 1)])
    instances(kit, 'Sword fern bed', fern(g), [
        (5.4, -3.9), (6.1, -4.3, 2), (6.8, -4.6, 3), (7.3, -5.2, 1),
        (4.7, -5.3), (-0.9, -6.8, 3), (-1.3, -7.2, 2), (-0.8, -7.8),
        (-2.4, 4.6, 3), (-5.5, 7.5, 1), (3.9, 7.2, 2)])
    for x, z, turn in ((6, -4.5, 1), (6.5, -5.7, 3), (5.7, -4, 2), (-0.9, -7.8, 1)):
        kit.place('Broken moss and grass margin', x, z, turn)
    # A side pool interrupts the straight edge upstream of the bridge.
    for x in (-8, -4, 4):
        kit.remove_at('Upper creek bank', x, 4, height=-0.4)
    for x in (-4, 4):
        kit.remove_at('Lower creek bank', x, 8, height=-0.2)
    instances(kit, 'Scoured creek bank', scoured_bank(g), [
        (-4, 4, 0, -0.4), (-8, 4, 0, -0.3), (-4, 8, 2, -0.4), (4, 8, 2, -0.4), (4, 4, 0, -0.4)])
    for label, width, depth, points in (
        ('Creek cove', 40, 12, [(-4, 4.3), (-4, 7.3)]),
        ('Creek bank shallows', 40, 8, [(4, 4.5), (4, 7.1)]),
        ('Creek inlet lip', 20, 6, [(-7, 4.6), (-1, 4.6)]),
    ):
        instances(kit, label, creek_extension(g, width, depth), [(x,z,0,-0.23) for x,z in points])
        kit.set_palette(label, visor='#637e73')
    instances(kit, 'Stranded alder roots', driftwood(g), [
        (-6.2, 4.9, 0, -0.1), (3.9, 6.4, 2, -0.2)])
    kit.add('Stream depth gauge', river_gauge(g), -2.6, 5.4, 0, -0.2)
    kit.add('Survey line reel', sampling_reel(g), -3.1, 4)
    kit.set_palette('Shallow water', visor='#637e73')
    kit.set_palette('Scoured creek bank', primary='#627c42', leather='#86613f', skin='#918671')
    kit.set_palette('Stranded alder roots', leather='#85705c', trim='#bbad89')
    kit.set_palette('Stream depth gauge', trim='#e3ddbf', detail='#a64e35')
    kit.set_palette('Forked river alder', leather='#77634d')
    kit.set_palette('Alder leaf crown', primary='#729144', secondary='#455c35')
    kit.set_palette('Western hemlock', primary='#54744f', secondary='#334e43')
    kit.set_palette('Sword fern bed', primary='#779e46', secondary='#41683c')
    kit.set_palette('Bark canoe and trestles', detail='#7f402e', leather='#bd8556', trim='#dbc99a')
    wooded_slope(kit, g, alders)
    instances(kit, 'Woodland ridge footing', forest_footing(g),
              [(x,15.3,0,-0.4) for x in (-14,-10,-6,-2,2,6,10,14)])
    aspens = [(-13.5,15.2,2),(-10.4,15.9,1),(-6.3,15.6,3),(-4.2,15.8,2),
              (-0.6,15.5,1),(2.3,15.9,3),(5.4,15.4,0),(8.5,15.7,2),(13.1,15.9,0)]
    instances(kit, 'White aspen stems', aspen_stems(g), [(x,z,r,0.38) for x,z,r in aspens])
    instances(kit, 'Open aspen leaf crown', aspen_crown(g), [(x,z,r,3.98) for x,z,r in aspens])
    for x,z,r in ((-11.9,15.7,0),(-7.8,15.8,2),(-2.7,15.6,1),(3.8,15.7,3),(10.8,15.8,0)):
        kit.place('Western hemlock',x,z,r,0.38)
    kit.set_palette('White aspen stems', trim='#c3c2ab', leather='#82705d')
    kit.set_palette('Open aspen leaf crown', primary='#94a15b', secondary='#566d48')
    instances(kit,'Exposed bank roots',root_bank(g),[(-3.7,4.2,0,-0.3),(3.9,7.2,2,-0.3)])
    kit.set_palette('Exposed bank roots', skin='#918776', leather='#8f6242', primary='#73834f')
    instances(kit,'Willow edge thicket',coppice(g),[
        (-12,14.4,1),(-8.8,14.7,3),(-5.2,14.6,2),(-2.4,14.5,0),
        (0.7,14.4,1),(4.9,14.7,2),(7.9,14.6,3),(12.1,14.5,1)])
    kit.set_palette('Willow edge thicket',primary='#83965e',secondary='#4e674c')
    instances(kit,'Trail bend outcrop',trail_outcrop(g),[
        (-14.4,15.8,2,0.2),(-10.3,16.2,0,0.2),(-6.0,15.7,2,0.2),
        (-1.8,15.9,0,0.2),(2.2,15.6,2,0.2),(6.2,16.1,0,0.2),
        (10.2,15.8,2,0.2),(14.3,16.1,0,0.2),
        (-4.8,16.2,0,0.85),(-0.4,16.1,2,1.05),(4.1,16.2,0,0.75)])
    instances(kit,'Worn forest switchback',switchback_tread(g),[
        (-1.7,10.5,0,-0.1),(-4.25,12.5,3,-0.1)])
    instances(kit,'Staggered forest scrub',forest_scrub(g),[
        (-13.3,14.3,1),(-9.8,14.0,3),(-6.8,13.9,2),(-4.9,14.4),
        (-2.6,13.8,3),(0.3,14.1,2),(2.6,13.4,0),(6.3,14.1,1),
        (9.4,13.4,2),(12.9,14.0,3)])
    kit.set_palette('Trail bend outcrop',skin='#8b887a',primary='#698151',leather='#766347')
    kit.set_palette('Worn forest switchback',leather='#8a735a',skin='#9d9582',primary='#708055')
    kit.set_palette('Staggered forest scrub',primary='#829253',secondary='#435b41')
    kit.placement_at('Trail marker', 1.35, 8.55, height=0).update(position=[1.35, 0, 7.95], turn=2)
    kit.add('Marsh nest box',nest_box(g),2.7,3.0,0)
    kit.set_palette('Marsh nest box',trim='#a99775',leather='#8a745e',secondary='#52604c')
    kit.add('Ash canoe paddles',trail_paddles(g),3.95,-8.60)
    kit.placement_at('Brush clump', -3.31, 8.92).update(position=[-6.8,0,8.65],turn=2)
    kit.placement_at('Brush clump', -5.25, 7.85).update(position=[-6.6,0,7.95],turn=0)
    kit.placement_at('Survey supply rack', -4.8, 9.5).update(position=[-5.75,0,10.05],turn=1)
    kit.add('Blind field journal',field_journal(g),-2.12,9.38,1)
    kit.add('Creek observation blind',bird_blind(g),-2.85,9.15)
    kit.add('Marsh spotting scope',spotting_scope(g),-2.14,8.84,1)
    kit.add('Kingfisher field sign',bird_sign(g),-1.84,8.2,2,0.22)
    kit.add('Wetland sample bottles',sample_tray(g),-1.64,9.92,1)
    kit.set_palette('Wetland sample bottles',visor='#8eaea1',metal='#818e82',leather='#947756')
    instances(kit,'Deposited silt fan',silt_fan(g),[(-3.65,6.96,2,-0.19),(-5.35,4.94,0,-0.19)])
    kit.set_palette('Deposited silt fan',leather='#736047',skin='#999483',trim='#b8b59a')
    kit.set_palette('Creek observation blind', leather='#94754d', secondary='#625d42')
    kit.set_palette('Marsh spotting scope', primary='#546a56', visor='#89b2ac')
    kit.set_palette('Kingfisher field sign', trim='#c1ad80', secondary='#496b67', accent='#b67f48')
    instances(kit, 'Glacial trail ridge', glacial_ridge(g), [
        (-6.6, 10.7, 2, -0.15), (-7.9, 13, 0, -0.15), (0.5, 13.6, 2, -0.15),
        (4.3, 12.2, 3, -0.15), (7.4, 10.4, 1, -0.15), (-10.5, 1.6, 0, -0.15)])
    instances(kit, 'Trail drainage timber', water_bar(g), [
        (-0.7, 8.3, 2, -0.1), (-1.3, 9.8, 0, -0.1), (-2.4, 11.1, 2, -0.1)])
    kit.add('Watershed relief desk', specimen_desk(g), 2.6, -15.0, 2)
    kit.set_palette('Watershed relief desk', primary='#82965f', visor='#658f96', trim='#d6c89b')
    kit.placement_at('Trail marker', 3.1, -15.3).update(position=[-2.9, 0, -10.8], turn=1)
    kit.placement_at('Supply shelf', 0.3, -15.2).update(position=[0.5, 0, -18.6], turn=1)
    kit.placement_at('Feed bucket', 0.9, -14.8, height=1).update(position=[0.5, 1.0, -18.0], turn=1)
    kit.add('Survey contour chart', chart(g), 2.8, -13.4, 2, 1.3)
    kit.add('Open geology case', sample_case(g), 3.35, -13.55, 2, 1.1)
    kit.add('Drying herb specimens', quadrat_rack(g), 0.65, -16.4, 2)
    kit.placement_at('Field samples and notebook', 2.8, -13.54, height=1.1).update(position=[1.95, 1.1, -13.55], turn=2)
    kit.set_palette('Survey contour chart', primary='#98a661', visor='#4e8185', trim='#d7cda9', accent='#a8462b')
    kit.set_palette('Open geology case', trim='#cfc8ad', skin='#80959a', leather='#8a6748', detail='#b77a4b')
    stops[0].update(eye=[8.9, 1.8, -4.7], target=[1.8, 1.7, -10.9])
    stops[1].update(eye=[3.6, 1.7, -16.7], target=[2.5, 1.45, -13.5])
    kit.placement_at('Lookout timber stairs', -5, -0.32, height=0).update(position=[-1.1, 0, 2.8], turn=0)
    stops.append(dict(label='Creek watchtower', eye=[-1.7, 3.75, 0.1], target=[-1, 1.4, 8.9]))
    stops.append(dict(label='Silt gauge pool',eye=[-4.6,1.56,8.35],target=[-3.15,0.03,5.35]))
    stops.append(dict(label='Kingfisher blind',eye=[-3.6,1.7,10.25],target=[-2.25,1.22,8.25]))
    stops[2].update(eye=[0.18, 1.72, 9.10], target=[-0.9, 1.35, 3.7])


def market_site(kit, g, stops, fixtures):
    # Move the wooded edge east to leave room for the lower stair.
    for z in (8, 12):
        kit.placement_at('Yard embankment', 12, z, height=-0.25)['position'][0] = 16
    kit.placement_at('High wooded bank', 11, 9)['position'] = [15.2, 0, 10.2]
    kit.placement_at('Ridge fir', 13, 7)['position'] = [15.6, 0, 7.3]
    kit.placement_at('Wagon frame', 9, 9.6).update(position=[5.8, 0, 10.8], turn=1)
    for z in (8, 12):
        kit.place('Flagstone tile', 12, z, height=-0.2)
    # The south stall holds finished copper. The hearth remains in the open work bay.
    kit.remove_at('Produce stall frame', -9.6, 4.1, height=0)
    kit.remove_at('Terracotta market awning', -9.6, 4.1, height=2.3)
    kit.remove_at('Market table', -9.6, 4.5, height=0)
    for z in (4.5, 7.8):
        kit.remove_at('Cloth goods box', -9.6, z, height=1)
    kit.placement_at('Market produce crates', -4.9, 6.8).update(position=[-2.3, 0, 7.8], turn=0)
    kit.placement_at('Lower gate passage', -4.6, 7.2, height=0).update(position=[-5.9, 0, 6.3], turn=0)
    instances(kit,'Weathered gate footing',gate_foot(g),[
        (-4.78,7.01),(-7.03,6.99,2),(-4.75,3.65,1)])
    kit.set_palette('Weathered gate footing',skin='#a09780',trim='#c0af90',
                    primary='#768551',secondary='#5c6c47')
    kit.placement_at('Courtyard well', -3.2, 4.5, height=0).update(position=[-4.2, 0, 3.6], turn=0)
    kit.add('Market well winch', well_winch(g), -4.2, 3.6)
    kit.set_palette('Market well winch', detail='#83574c', metal='#858b86')
    kit.set_palette('Lower gate passage', primary='#847c70')
    kit.set_palette('Market produce crates', accent='#a97947', detail='#995a46')
    kit.placement_at('Market bench', -3.6, 9.9, height=0).update(position=[-4.4, 0, 9.0], turn=1)
    kit.placement_at('Barrel stand', -4.55, 6.55, height=0).update(position=[-8.6, 0, 3.25], turn=0)
    kit.placement_at('Spice box', -2.65, 6.1, height=0.98).update(position=[5.15, 0.98, 6.38], turn=3)
    kit.add('Gate market bell turret', bell_turret(g), -1.05, -0.55, 0, 5.9)
    kit.add('Coppersmith roof and return', forge_canopy(g), -10, 5.4)
    kit.add('Leather forge bellows', bellows(g), -10.6, 4.2)
    kit.set_palette('Gate market bell turret', metal='#b48d57', primary='#657b78', secondary='#454946')
    kit.set_palette('Coppersmith roof and return', secondary='#714e42', skin='#a4927a')
    kit.add('Hanging copper pans', pan_rail(g), -11.25, 5.35, 1, 1.3)
    kit.set_palette('Hanging copper pans', metal='#b4774e', accent='#80988a', secondary='#43474a')
    kit.add('Coppersmith hearth', hearth(g), -9.6, 4.1)
    kit.add('Forge coal bed',coal_bed(g),-9.6,4.24,0,0.8)
    kit.set_palette('Forge coal bed',trim='#c96a2c',accent='#b4532c',detail='#773a28',
                    secondary='#45433d',skin='#746956',hair='#2a2825')
    kit.add('Coppersmith stake anvil', coppersmith_block(g), -8.35, 4.95, 1)
    kit.add('Beaten copper bowl',beaten_bowl(g),-8.35,5.30,0,1.4)
    kit.set_palette('Beaten copper bowl',metal='#b27a55',accent='#bf9369',detail='#82543d')
    kit.add('Planished copper basins', copper_basins(g), -9.6, 7.8, 0, 1.0)
    kit.add('Orchard fruit trays', market_fruit(g), -2.7, 6.0, 0, 1.0)
    kit.add('Dyed market pennants', cloth_span(g), 0.1, 5.9)
    fixtures.append(dict(position=[-9.6, 1.2, 4.7], color='#ffa66b', intensity=3, distance=3.7))
    kit.set_palette('Coppersmith hearth', detail='#9b6450', trim='#ffc88a')
    kit.set_palette('Coppersmith stake anvil', metal='#838e91', secondary='#414a48', leather='#7b6047')
    kit.set_palette('Planished copper basins', metal='#bc7754', accent='#739183', leather='#784c36')
    kit.set_palette('Orchard fruit trays', primary='#9bab51', accent='#c9803c')
    kit.set_palette('Dyed market pennants', primary='#556b86', detail='#b86c51', trim='#cfb889')
    terrace_z = (4.4, 0.8, -2.8)
    instances(kit, 'Dyers stone terrace', terrace(g), [(12, z) for z in terrace_z])
    instances(kit, 'Dyers arcade', arcade(g), [(12, z, 0, 1.2) for z in (4.8, 1.2, -2.4)])
    instances(kit, 'Dyers tiled roof', g.pitched_roof(48, 40, g.DETAIL, g.WOOD),
              [(12, z, 0, 4.9) for z in terrace_z])
    instances(kit,'Wool store cellar',wool_cellar(g),[(15.9,3.8),(15.9,0.4)])
    kit.add('Wool loading dock',wool_dock(g),15.85,6.05)
    kit.add('Wool store gate',wool_gate(g),15.9,5.4,0,1.2)
    kit.place('Wool store gate',14.25,3.8,3,1.2)
    instances(kit,'Wool store clerestory',store_window(g),[
        (15.9,-1.2,2,1.2),(14.25,0.4,3,1.2),(17.55,3.8,1,1.2),(17.55,0.4,1,1.2)])
    instances(kit,'Wool loft joists',loft_floor(g),[(15.9,3.8,0,4.3),(15.9,0.4,0,4.3)])
    kit.add('Wool loft hoist',loft_hoist(g),16.5,5.75,0,3.17)
    kit.add('Wool sorting bench',sorting_bench(g),15.6,0.6,0,1.2)
    kit.set_palette('Wool sorting bench',trim='#d3c4a6',skin='#b9aa91',leather='#785c43',metal='#697777')
    kit.add('Dyestuff delivery trays',dye_trays(g),14.15,5.76,1,1.2)
    kit.set_palette('Dyestuff delivery trays',primary='#87995a',detail='#aa6850',leather='#a5815c')
    kit.add('Weavers skein reel',skein_reel(g),15.22,0.54,0,2.2)
    kit.set_palette('Weavers skein reel',leather='#755136',trim='#b98c68',metal='#626f68')
    kit.add('Folded weavers lengths',woven_shelf(g),17.06,0.4,3,1.2)
    kit.set_palette('Folded weavers lengths', primary='#566f88',detail='#a35f55',trim='#c6b99e')
    kit.set_palette('Wool store clerestory', skin='#9d9282',trim='#c4b395')
    kit.add('Wool loft shutters',wool_shutters(g),15.9,5.4,0,4.6)
    kit.place('Wool loft shutters',15.9,-1.2,2,4.6)
    for x,turn in ((14.25,3),(17.55,1)):
        kit.place('Wool loft shutters',x,3.8,turn,4.6)
        kit.place('Wool loft shutters',x,0.4,turn,4.6)
    instances(kit,'Wool store slate roof',loft_roof(g),
              [(15.9,3.8,0,6.9),(15.9,0.4,0,6.9)])
    kit.add('Tied wool bales',wool_bales(g),16.75,4.45,0,1.2)
    kit.place('Tied wool bales',16.9,2.65,1,1.2)
    kit.set_palette('Wool store slate roof', secondary='#5e727a',leather='#68554a')
    kit.set_palette('Wool loft shutters', detail='#9a5a48',trim='#c2b499')
    kit.set_palette('Tied wool bales', primary='#677990', detail='#9b6963', trim='#c8c2a5')
    instances(kit,'Dyers carved arch stones',arch_stones(g),[(12,z,0,3.70) for z in (5.2,1.6,-2.0)])
    instances(kit,'Dyers stair cheek',stair_cheek(g),[(10.52,7.4),(13.48,7.4)])
    kit.add('Dyers entry steps', g.step_run(25, 2, 12, g.MASONRY, g.CAP), 12, 7.4)
    instances(kit, 'Indigo vat', dye_vat(g), [(11.4, 3.3, 0, 1.2), (12.8, 0.2, 2, 1.2)])
    instances(kit, 'Dyed wool rack', cloth_rack(g), [
        (12.1, 1.95, 0, 1.2), (12.1, -1.8, 0, 1.2)])
    kit.place('Market crate', 16.8, -0.1, 0, 1.2)
    kit.place('Barrel stand', 11, -2.5, 0, 1.2)
    kit.add('Peel and proofing bench', proofing_bench(g), 0.7, -16.3, 1)
    instances(kit, 'Guild oil lantern', hanging_lantern(g), [
        (12.1, 4.8, 0, 3.2), (12.1, -2.4, 0, 3.2)])
    kit.place('Guild oil lantern',16.45,1.25,0,3.15)
    fixtures.append(dict(position=[16.45,3.45,1.25],color='#ffcc8d',intensity=6,distance=4.5))
    for z in (4.8, -2.4):
        fixtures.append(dict(position=[12.1, 3.3, z], color='#ffd092', intensity=7, distance=5))
    kitchen_orchard(kit, g)
    front_wall = kit.placement_at('Guild bakehouse solid', 2, -10, height=0)
    front_wall['propId'] = kit.prop_id('Guild bakehouse window')
    kit.add('Bakers serving hatch', serving_hatch(g), 2.0, -9.52)
    kit.add('Loaves on a wicker tray', bread_tray(g), 2.0, -9.38, 0, 1.1)
    kit.add('Bakers yard drain', bakers_yard_drain(g), 1.95, -8.35, 0, -0.13)
    kit.place('Bakers yard drain', -0.9, -8.35, 0, -0.13)
    kit.set_palette('Bakers serving hatch', leather='#866543',secondary='#544439',metal='#677170')
    kit.set_palette('Loaves on a wicker tray', detail='#ad7350',accent='#d6975b',trim='#d9b88a')
    kit.set_palette('Bakers yard drain', skin='#a0917b',primary='#88765c',metal='#606966',leather='#6c5947')
    kit.add('Bakehouse split firewood', woodpile(g), -4.8, -10.9, 1)
    kit.place('Bakehouse split firewood', -10.9, 4.6, 1)
    kit.add('Twin bread oven flue', bakehouse_flue(g), -3.3, -13.2, 0, 3.6)
    kit.add('Guild timber solar', timber_solar(g), -2, -10.6, 0, 4.2)
    kit.add('Solar boarded return', sculpt([
        (0, 0, 0, 4, 26, 20, g.WOOD), (0, 0, 0, 6, 4, 20, g.SOIL),
        (0, 22, 0, 6, 4, 20, g.SOIL)]), -3.8, -11.4, 0, 4)
    kit.place('Solar boarded return', -0.2, -11.4, 0, 4)
    kit.place('Guild timber solar', -2, -12.3, 2, 4.2)
    kit.add('Guild solar roof', g.pitched_roof(44, 22, g.DETAIL, g.WOOD), -2, -11.4, 0, 6.6)
    kit.add('Dyers side passage', arcade_door(g), 9.7, -1.3, 1, 1.2)
    kit.place('Dyers entry steps', 8.8, -1.3, 3)
    stops[0].update(eye=[-7.95, 1.7, -4.8], target=[-1.17, 2.65, -10.6])
    stops[2].update(eye=[-3.2, 1.65, 11.4], target=[-0.2, 1.9, 4.3])
    stops.append(dict(label='Dyers terrace', eye=[11.3, 1.7, 10.8], target=[11.2, 2.65, 1]))
    stops.append(dict(label='Wool sorting room',eye=[15.12,2.85,3.68],target=[15.88,2.36,0.35]))
    stops.append(dict(label='Coppersmith court', eye=[-8.75, 1.9, 7.05], target=[-9.3, 1.35, 4.4]))
    instances(kit, 'Raised woad border', herb_border(g), [
        (10.1, 5.2, 1, 1.2), (13.9, 0.6, 3, 1.2), (8.1, 0.2),
        (7.8, -2.7, 2), (-5.2, -11.8, 1), (-4.5, -8.5)])
    instances(kit, 'Worn courtyard setts', cobbled_turn(g), [
        (3.8, 0.7, 0, -0.1), (5.8, -0.1, 2, -0.1), (7.2, -1.2, 0, -0.1), (9.2, 7.1, 1, -0.1),
        (-4.5, -7.9, 1, -0.1), (-4.7, -9.6, 3, -0.1)])
    kit.set_palette('Raised woad border', primary='#789449', secondary='#446241', accent='#d6ad4a')
    kit.set_palette('Dyers tiled roof', detail='#9b5141', leather='#714e35')
    kit.set_palette('Dyed wool rack', visor='#9976aa', primary='#3d577f', detail='#ac423e')


def upgrade(kit, g, stops, fixtures):
    if kit.key == 'creatures':
        ranger_site(kit, g, stops, fixtures)
    elif kit.key == 'fantasy':
        market_site(kit, g, stops, fixtures)
