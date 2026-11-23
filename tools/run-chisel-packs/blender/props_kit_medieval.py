"""Medieval rooms use a 2 m floor grid. Each 4 m bay opens at both ends."""

import math

from mathutils import Matrix
from polykit import V, Z
from props_level_common import gable_roof


def prop_curtain_corner(p):
    # Two half-thickness returns meet full wall runs at the tile edges.
    for width, height, depth, bottom, region in (
        (.44, .32, .44, 0, 'skin'), (.34, 1.44, .34, .32, 'skin'),
        (.40, .14, .40, 1.76, 'primary'),
    ):
        x = z = -.78
        p.box((0, bottom + height / 2, z), (2, height, depth), region)
        start = z + depth / 2
        p.box((x, bottom + height / 2, (start + 1) / 2),
              (width, height, 1 - start), region)
    for x, z in ((-.78, -.78), (.50, -.78), (-.78, .50)):
        p.box((x, 2.055, z), (.44, .31, .44), 'skin', bevel=.018)


def prop_open_stone_arch(p):
    # Radial blocks form a clear opening above the spring line.
    for side in (-1, 1):
        p.box((side * .80, .96, 0), (.40, 1.92, .44), 'skin', bevel=.014)
        p.box((side * .80, 1.87, 0), (.40, .10, .48), 'skin', ao=.12)
    for i in range(7):
        angles = [math.pi * k / 7 for k in (i, i + 1)]
        def block(z):
            return [V(r * math.cos(a), 1.92 + r * math.sin(a), z)
                    for r, a in ((.60, angles[0]), (.90, angles[0]),
                                 (.90, angles[1]), (.60, angles[1]))]
        depth = .27 if i == 3 else .23
        p.loft([block(-depth), block(depth)], 'skin', cap_start=True, cap_end=True,
               ao=.14 if i == 3 else -.05 + .07 * (i % 2))


def prop_hall_steps(p):
    for i in range(6):
        height = (i + 1) / 6
        z = 1 - (i + .5) / 3
        p.box((0, height / 2, z), (2, height, 1 / 3), 'skin',
              bevel=.008, ao=.035 * (i % 2))
        for side in (-1, 1):
            p.box((side * .91, height + .07, z), (.18, .14, 1 / 3), 'skin')


def prop_raised_flagstones(p):
    p.box((0, .44, 0), (2, .88, 2), 'skin', ao=-.11)
    for x in (-.50, .50):
        for z in (-.50, .50):
            p.box((x, .94, z), (1, .12, 1), 'skin', bevel=.012, ao=.06 * x)


def prop_gallery_edge(p):
    for x in (-.90, 0, .90):
        p.box((x, .48, 0), (.14, .96, .14), 'secondary')
    for y in (.36, .92):
        p.box((0, y, 0), (2, .09, .12), 'primary')


def prop_timber_hall_bay(p):
    # The gable has a 1.30 m door. Both side walls have open lights.
    for side in (-1, 1):
        x = side * 1.88
        for y, h in ((.56, 1.12), (2.21, .38)):
            p.box((x, y, 0), (.17, h, 4), 'skin')
        for z in (-1.48, 1.48):
            p.box((x, 1.57, z), (.17, .90, 1.04), 'skin')
        for z in (-1.90, 0, 1.90):
            p.box((x, 1.2, z), (.24, 2.4, .16), 'secondary')
        for y in (.12, 1.12, 2.32):
            p.box((x, y, 0), (.23, .14, 3.99), 'primary')
        p.box((side * 1.22, 1.2, 1.90), (1.14, 2.4, .15), 'skin')
        p.box((side * .72, 1.20, 1.90), (.14, 2.4, .20), 'secondary')
        p.prism((side * .79, .48, 1.91), (side * 1.79, 1.74, 1.91),
                .09, .09, 4, 'primary', up=Z)
    p.box((0, 2.27, 1.90), (3.76, .26, .20), 'primary')


def prop_watch_hall_bay(p):
    for side in (-1, 1):
        x = side * 1.86
        p.box((x, .63, 0), (.28, 1.26, 4), 'skin', ao=-.08)
        p.box((x, 2.22, 0), (.28, .36, 4), 'skin')
        for z, length in ((-1.55, .90), (0, 1.64), (1.55, .90)):
            p.box((x, 1.65, z), (.28, .78, length), 'skin')
        p.box((x, 1.24, 0), (.32, .10, 4), 'skin', ao=.13)
        for z in (-1.76, 1.76):
            p.box((x, .85, z), (.48, 1.70, .38), 'skin', taper=(.70, .88))
            for y in (.42, .89, 1.38):
                p.box((x, y, z), (.48 - y * .063, .16, .39), 'skin', ao=.09)
        p.box((side * 1.20, 1.20, 1.86), (1.04, 2.40, .28), 'skin')
        p.box((side * .76, 1.02, 1.86), (.16, 2.04, .34), 'skin', ao=.12)
        p.box((side * 1.32, 1.76, 2.012), (.42, .73, .035), 'accent')
        p.box((side * 1.32, 2.12, 2.012), (.54, .055, .07), 'primary')
    p.box((0, 2.24, 1.86), (2.04, .32, .34), 'skin', bevel=.018)


def prop_shingle_roof(p):
    # The ridges on each slope overlap the course below.
    gable_roof(p, 0, 0, 0, 4.38, 4, 1.32, 'primary', overhang=0, along='z')
    for side in (-1, 1):
        for i in range(4):
            x = side * (.28 + .55 * i)
            y = 1.32 * (1 - abs(x) / 2.19)
            with p.placed(Matrix.Translation(V(x, y + .035, 0)) @
                          Matrix.Rotation(-side * math.atan(1.32 / 2.19), 4, 'Z')):
                seams = [-2, -1, 0, 1, 2] if i % 2 else [-2, -1.5, -.5, .5, 1.5, 2]
                for j, (start, end) in enumerate(zip(seams, seams[1:])):
                    shade = .06 * ((i + j) % 3) - .05
                    p.box((0, 0, (start + end) / 2), (.59, .06, end - start - .012),
                          'primary', ao=shade)
    p.box((0, 1.33, 0), (.16, .14, 4), 'secondary')


def prop_watch_roof(p):
    p.box((0, .09, 0), (4.22, .18, 4), 'skin', bevel=.022)
    for side in (-1, 1):
        p.box((side * 1.96, .32, 0), (.26, .28, 4), 'skin')
        for z in (-1.62, -.54, .54, 1.62):
            p.box((side * 1.96, .63, z), (.26, .34, .62), 'skin', bevel=.018)
    p.box((0, .31, 1.88), (3.66, .26, .24), 'skin')
    for x in (-1.22, 0, 1.22):
        p.box((x, .62, 1.88), (.60, .36, .24), 'skin', bevel=.015)


def prop_ale_counter(p):
    for x in (-.75, .75):
        p.box((x, .46, 0), (.14, .92, .58), 'secondary')
    for i in range(6):
        p.box(((i - 2.5) * .28, .49, .25), (.274, .80, .08), 'primary',
              ao=.05 * (i % 2))
    p.box((0, .96, 0), (1.84, .08, .72), 'primary', bevel=.014)
    p.box((0, .20, .31), (1.76, .10, .07), 'secondary')


def prop_truckle_bed(p):
    for x in (-.40, .40):
        for z in (-.88, .88):
            p.box((x, .27, z), (.10, .54, .10), 'secondary')
    p.box((0, .32, 0), (.88, .14, 1.84), 'primary')
    p.box((0, .44, 0), (.82, .14, 1.78), 'skin', bevel=.035)
    p.box((0, .51, .28), (.84, .07, 1.18), 'accent', bevel=.02)
    p.box((0, .55, -.62), (.58, .11, .35), 'skin', bevel=.04)


def prop_ale_jug(p):
    p.lathe([(.09, 0), (.15, .10), (.14, .22), (.075, .29), (.08, .34),
             (.055, .34), (.054, .29)], 8, 'primary', cap_start=True, cap_end=True)
    for a, b in [((.08, .28, 0), (.22, .26, 0)),
                 ((.22, .26, 0), (.22, .17, 0)), ((.22, .17, 0), (.12, .12, 0))]:
        p.prism(a, b, .022, .022, 5, 'primary', up=Z)


def prop_charter_desk(p):
    for x in (-.62, .62):
        p.box((x, .36, 0), (.12, .72, .55), 'secondary')
    p.box((0, .76, 0), (1.46, .08, .70), 'primary', bevel=.012)
    p.box((-.13, .806, 0), (.61, .012, .43), 'skin')
    for x in (-.44, .18):
        p.prism((x, .842, -.22), (x, .842, .22), .045, .045, 8, 'skin')
    p.lathe([(.08, 0), (.07, .12), (.045, .14)], 6, 'eye',
            center=(.48, .8, -.12), cap_start=True, cap_end=True)


KIT_PROPS = [
    (prop_curtain_corner, 'Curtain Wall Return'),
    (prop_open_stone_arch, 'Open Voussoir Arch'),
    (prop_hall_steps, 'Six-Tread Hall Steps'),
    (prop_raised_flagstones, 'Raised Flagstone Bay'),
    (prop_gallery_edge, 'Oak Gallery Rail'),
    (prop_timber_hall_bay, 'Half-Timbered Hall Bay'),
    (prop_watch_hall_bay, 'Arrow-Slit Keep Bay'),
    (prop_shingle_roof, 'Lapped Shingle Roof'),
    (prop_watch_roof, 'Crenellated Watch Roof'),
    (prop_ale_counter, 'Oak Serving Counter'),
    (prop_truckle_bed, 'Truckle Bed with Wool Cover'),
    (prop_ale_jug, 'Loop-Handled Ale Jug'),
    (prop_charter_desk, 'Charter Desk with Inkwell'),
]
