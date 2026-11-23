"""The picture house and the burned repair shop on the stadium esplanade."""

from creature_kit import Sculpt
from level_geometry import box, span
from .common import BODY, DARK, GLASS, GLOW, GREEN, JOINT, MARK, METAL, RUBBER, STONE, WOOD


def picture_house():
    shape = Sculpt()
    for x in (-40, 40):
        box(3, 49, 67, BODY, x=x, sculpt=shape)
        box(4, 5, 68, DARK, x=x, sculpt=shape)
        for z in (-23, -6, 12, 27):
            box(4, 39, 3, STONE, x=x, z=z, sculpt=shape)
        for y in (35, 39, 46):
            box(4, 1, 67, STONE, x=x, y=y, sculpt=shape)
    box(79, 48, 3, BODY, z=32, sculpt=shape)
    box(79, 2, 65, DARK, y=46, sculpt=shape)
    for z in (-24, 5, 25):
        box(68, 2, 4, METAL, y=48, z=z, sculpt=shape)
    # Light from the lobby reaches the service corridor behind the pay windows.
    box(59, 20, 2, GREEN, z=8, sculpt=shape)
    box(30, 13, 1, STONE, y=12, z=7, sculpt=shape)
    return shape


def cinema_entrance():
    shape = Sculpt()
    # The ticket lobby sits behind shallow glazed side bays.
    for x in (-32, 32):
        box(18, 40, 5, STONE, x=x, sculpt=shape)
        box(15, 6, 6, GREEN, x=x, sculpt=shape)
        box(12, 14, 1, DARK, x=x, y=7, z=-3, sculpt=shape)
        box(10, 10, 1, GLASS, x=x, y=9, z=-4, sculpt=shape)
        for y in (5, 22, 25, 38):
            box(19, 1, 7, METAL, x=x, y=y, sculpt=shape)
    # Both poster cases still contain part of a print.
    for center, sky, ink in ((-32, MARK, DARK), (32, GREEN, STONE)):
        box(10, 12, 1, sky, x=center, y=9, z=-5, sculpt=shape)
        box(3, 3, 1, STONE, x=center+2, y=16, z=-6, sculpt=shape)
        for i in range(4):
            box(9-i*2, 1, 1, ink, x=center, y=10+i, z=-6, sculpt=shape)
        box(8, 1, 1, DARK, x=center, y=9, z=-6, sculpt=shape)
    for x in (-16, 16):
        box(12, 24, 2, GREEN, x=x, z=5, sculpt=shape)
        box(9, 12, 1, GLASS, x=x, y=9, z=4, sculpt=shape)
        box(3, 1, 2, METAL, x=x+2, y=9, z=3, sculpt=shape)
    for x in (-24, 0, 24):
        box(3, 27, 6, DARK, x=x, z=3, sculpt=shape)
        box(2, 8, 4, STONE, x=x, y=18, z=-2, sculpt=shape)
        box(1, 5, 1, GLOW, x=x, y=20, z=-4, sculpt=shape)
    for width, y, h in ((79, 27, 10), (69, 37, 6), (51, 43, 5), (35, 48, 4)):
        box(width, h, 5, STONE, y=y, sculpt=shape)
        box(width, 1, 7, GREEN, y=y+h-1, sculpt=shape)
    return shape


def marquee():
    shape = Sculpt()
    for i, width in enumerate((49, 57, 63, 65, 65)):
        z = -6 + i * 3
        box(width, 9, 3, MARK, z=z, sculpt=shape)
        for y in (0, 8):
            box(width+2, 1, 3, GREEN, y=y, z=z, sculpt=shape)
    letters = ('###. #.#. ###. #... ###. ###. ##.',
               '#... #.#. #... #... .#.. #... #.#',
               '###. ###. ##.. #... .#.. ##.. ##.',
               '..#. #.#. #... #... .#.. #... #.#',
               '###. #.#. ###. ###. .#.. ###. #.#')
    for row, line in enumerate(letters):
        for col, pixel in enumerate(line.replace(' ', '')):
            if pixel == '#':
                box(1, 1, 1, DARK, x=13-col, y=7-row, z=-8, sculpt=shape)
    # The old chase lights survive at different points along the lip.
    for x in range(-22, 24, 4):
        box(1, 1, 1, GLOW if x not in (-10, 14) else DARK, x=x, y=1, z=-8, sculpt=shape)
    for x in (-19, 19):
        box(2, 2, 13, DARK, x=x, y=6, sculpt=shape)
    return shape


def cinema_pylon():
    shape = Sculpt()
    box(14, 43, 10, GREEN, sculpt=shape)
    box(12, 48, 7, STONE, sculpt=shape)
    box(9, 45, 9, GREEN, sculpt=shape)
    for x in (-7, 7):
        box(2, 39, 8, METAL, x=x, y=2, sculpt=shape)
    for z in (-4, 4):
        box(7, 40, 2, DARK, y=2, z=z, sculpt=shape)
    # Paint the letters from the street side.
    letters = (('###.', '#..#', '###.', '#.#.', '#..#'),
               ('###', '.#.', '.#.', '.#.', '###'),
               ('.##.', '#..#', '#..#', '#..#', '.##.'))
    for letter, top in zip(letters, (37, 24, 11)):
        for row, line in enumerate(letter):
            for col, pixel in enumerate(line):
                if pixel == '#':
                    box(2, 2, 1, GLOW, x=3-2*col, y=top-row*2, z=-6, sculpt=shape)
    return shape


def burned_workshop():
    shape = Sculpt()
    for x, heights in ((-35, (15, 20, 26, 20, 36, 42)), (35, (31, 38, 44, 46, 46, 44))):
        for i, h in enumerate(heights):
            z = -25 + i * 10
            box(4, h, 10, BODY, x=x, z=z, sculpt=shape)
            box(5, 3, 10, DARK, x=x, y=h-3, z=z, sculpt=shape)
    box(68, 43, 4, BODY, z=28, sculpt=shape)
    for x in (-23, 0, 22):
        shape.cut(span(13,x), (15,30), (25,31))
        box(17, 2, 6, JOINT, x=x, y=14, z=28, sculpt=shape)
    for x, h in ((-27, 20), (27, 35)):
        box(16, h, 4, BODY, x=x, z=-29, sculpt=shape)
        box(3, h+2, 6, JOINT, x=x, z=-29, sculpt=shape)
    for y in range(25, 35, 2):
        box(40, 2, 3, METAL if y % 4 else DARK, y=y, z=-29, sculpt=shape)
    for x, length in ((-29, 23), (-15, 15), (-1, 34), (13, 44), (28, 58)):
        box(3, 4, length, DARK, x=x, y=39, z=29-length//2, sculpt=shape)
    for i, length in enumerate((9, 13, 18, 25, 22, 33, 41)):
        box(7, 2, length, RUBBER if i < 4 else GREEN, x=-10+i*7, y=43, z=29-length//2, sculpt=shape)
    for x in (21, 26, 31):
        box(2, 13, 2, RUBBER, x=x, y=21, z=-30, sculpt=shape)
    return shape


def sawtooth_roof():
    shape = Sculpt()
    for bay in range(3):
        left = -41 + bay * 28
        for step in range(7):
            box(4, 2, 68, GREEN, x=left+step*4+2, y=step*2, sculpt=shape)
        box(2, 12, 66, GLASS, x=left+27, sculpt=shape)
        for z in range(-31, 34, 13):
            box(3, 13, 2, DARK, x=left+27, z=z, sculpt=shape)
    return shape


def mansard():
    shape = Sculpt()
    for i in range(9):
        box(74-i*2, 2, 67-i*2, DARK if i%3 else METAL, y=i*2, sculpt=shape)
    for x in (-20, 16):
        box(13, 12, 9, STONE, x=x, y=5, z=-26, sculpt=shape)
        box(9, 8, 1, GLASS, x=x, y=7, z=-31, sculpt=shape)
        box(2, 8, 1, WOOD, x=x, y=7, z=-32, sculpt=shape)
        for i in range(4):
            box(17-i*4, 2, 13, METAL, x=x, y=17+i, z=-26, sculpt=shape)
    box(6, 15, 7, BODY, x=21, y=17, z=12, sculpt=shape)
    box(8, 2, 9, JOINT, x=21, y=31, z=12, sculpt=shape)
    return shape


def broken_roof():
    shape = Sculpt()
    for i, length in enumerate((60, 48, 27, 17, 22, 32, 51, 63)):
        box(4, 4, 63, WOOD, x=-35+i*10, sculpt=shape)
        box(10, 2, length, METAL if i % 3 else DARK, x=-35+i*10, y=4, z=length//2-32, sculpt=shape)
    return shape


def bus_shelter():
    shape = Sculpt()
    for x in (-17, 16):
        for z in (-5, 5):
            box(2, 25, 2, METAL, x=x, z=z, sculpt=shape)
    box(34, 2, 14, GREEN, y=25, sculpt=shape)
    box(31, 2, 3, MARK, y=24, z=-6, sculpt=shape)
    box(14, 17, 1, GLASS, x=-9, y=5, z=5, sculpt=shape)
    for i in range(4):
        box(3, 3+i*2, 1, GLASS, x=1+i*3, y=17-i*2, z=5, sculpt=shape)
    box(10, 11, 1, STONE, x=-9, y=9, z=4, sculpt=shape)
    for y in (11, 14, 16):
        box(6, 1, 1, GREEN, x=-9, y=y, z=3, sculpt=shape)
    box(23, 2, 4, WOOD, x=-3, y=5, z=1, sculpt=shape)
    for x in (-12, 6):
        box(2, 5, 3, DARK, x=x, z=1, sculpt=shape)
    return shape


def collapsed_goal():
    shape = Sculpt()
    for x, h in ((-20, 19), (20, 12)):
        box(2, h, 2, STONE, x=x, z=-5, sculpt=shape)
        box(2, 2, 13, DARK, x=x, z=1, sculpt=shape)
    for i in range(7):
        box(6, 2, 2, STONE, x=-17+i*6, y=18-i, z=-5, sculpt=shape)
    for i in range(5):
        h = 12-i
        for j in range(4):
            box(1, 3, 2, METAL, x=-16+i*8, y=max(0,h-j*3), z=-4+j*3, sculpt=shape)
    return shape


def relay_clinic():
    shape = box(54, 2, 27, DARK)
    box(54, 23, 3, STONE, y=2, z=12, sculpt=shape)
    for x in (-26, 26):
        box(3, 23, 27, STONE, x=x, y=2, sculpt=shape)
    for x, w in ((-23, 6), (3, 36)):
        box(w, 23, 2, STONE, x=x, y=2, z=-12, sculpt=shape)
        box(w, 3, 2, GREEN, x=x, y=8, z=-12, sculpt=shape)
    shape.cut(span(22, 4), (12, 20), (-14,-10))
    box(22, 9, 1, GLASS, x=4, y=12, z=-11, sculpt=shape)
    box(1, 9, 2, DARK, x=4, y=12, z=-12, sculpt=shape)
    box(56, 2, 30, GREEN, y=25, sculpt=shape)
    box(17, 3, 11, METAL, x=11, y=27, sculpt=shape)
    for x in range(5, 18, 3):
        box(1, 1, 7, DARK, x=x, y=30, sculpt=shape)
    for y, w in ((14, 2), (16, 6), (18, 2)):
        box(w, 2, 1, BODY, x=22, y=y, z=-14, sculpt=shape)
    return shape


def broken_pylon():
    shape = box(13, 3, 13, STONE)
    for x in (-4, 4):
        for z in (-4, 4):
            box(2, 27, 2, METAL, x=x, y=3, z=z, sculpt=shape)
            for i in range(5):
                box(3, 2, 2, DARK, x=x+i, y=30+i, z=z, sculpt=shape)
    for y in (8, 20, 27):
        box(10, 1, 10, DARK, y=y, sculpt=shape)
    return shape


def fire_escape():
    shape = Sculpt()
    for x in range(-24, 2, 3):
        box(2, 2, 12, METAL, x=x, y=19, sculpt=shape)
    for z in (-5, 5):
        box(28, 2, 2, DARK, x=-12, y=18, z=z, sculpt=shape)
        box(28, 1, 1, METAL, x=-12, y=30, z=z, sculpt=shape)
        for x in (-25, -12, 1):
            box(1, 11, 1, METAL, x=x, y=20, z=z, sculpt=shape)
    for i in range(10):
        x, y = 3+i*2, 18-i*2
        box(3, 1, 11, METAL, x=x, y=y, sculpt=shape)
        for z in (-5, 5):
            box(3, 2, 1, DARK, x=x, y=y, z=z, sculpt=shape)
            box(3, 2, 1, METAL, x=x, y=y+10, z=z, sculpt=shape)
            if i % 3 == 0:
                box(1, 10, 1, METAL, x=x, y=y, z=z, sculpt=shape)
    for x in (-24, -11):
        box(3, 2, 14, WOOD, x=x, y=17, sculpt=shape)
    return shape


def brick_chimney():
    shape = box(27, 6, 27, JOINT)
    for i, diameter in enumerate((23, 22, 21, 20, 19, 18, 17, 16, 15, 15)):
        y = 6+i*10
        color = BODY if i < 7 else STONE if i < 9 else DARK
        for w, d in ((diameter, diameter-6), (diameter-3, diameter-3), (diameter-6, diameter)):
            box(w, 10, d, color, y=y, sculpt=shape)
        if i in (1, 4, 7, 9):
            box(diameter+1, 1, diameter-5, DARK, y=y+5, sculpt=shape)
            box(diameter-5, 1, diameter+1, DARK, y=y+5, sculpt=shape)
    box(19, 3, 15, RUBBER, y=106, sculpt=shape)
    box(15, 3, 19, RUBBER, y=106, sculpt=shape)
    shape.cut(span(9), (101,110), span(9))
    return shape


def dead_elm():
    shape = box(8, 3, 6, WOOD)
    for i in range(8):
        box(max(2,6-i//2), 5, 4, WOOD, x=i//3, y=i*4, sculpt=shape)
    for x, z, y, dx, dz, segments in ((0,0,12,-2,1,7),(1,1,18,2,-1,6),(-8,4,21,-1,-1,5),
                                       (5,-2,25,1,2,5),(0,0,27,-1,-1,5),(-6,4,21,0,1,4)):
        for i in range(segments):
            width = 3 if i < segments//2 else 2
            box(width, 3, width, WOOD if i < segments-1 else BODY,
                x=x+i*dx, y=y+i*2, z=z+i*dz, sculpt=shape)
    return shape
