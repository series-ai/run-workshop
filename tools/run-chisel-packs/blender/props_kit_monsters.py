"""Two-metre mine railway and basalt chamber modules. Dimensions are in metres."""

import math

from polykit import V, Y, Z
from props_monsters_quarry import block, lamp, rail, spike, strut


def prop_mine_turnout(p):
    # The ballast fixes the three sockets in the exporter's centred frame.
    block(p, 0, .015, 0, 2, .03, 2, 'skin', corner=.08)
    rail(p, -1, 1)
    for z, reach in ((-.54, .65), (-.19, .79), (.16, .96), (.50, 1)):
        block(p, (.523 + reach)/2, .055, z, reach-.523, .11, .15, 'primary')
    for x in (.60, .86):
        block(p, x, .064, -.02, .14, .092, 1.06, 'primary')
    # The curved blades meet the stock rails at the toe. The frog is cast
    # slightly proud of the straight running face.
    for radius in (.62, 1.38):
        sections = []
        for i in range(11):
            a = i*math.pi/20
            width = .033*min(1, .16 + i*.45)
            sections.append([V(1-r*math.cos(a), y, -1+r*math.sin(a))
                             for r, y in ((radius-width, .089), (radius+width, .089),
                                          (radius+width, .194), (radius-width, .194))])
        p.loft(sections, 'metal', cap_start=True, cap_end=True)
    block(p, -.70, .09, .23, .27, .12, .36, 'secondary', corner=.03)
    strut(p, (-.70, .13, .23), (-.70, .51, .39), .034, 'metal')
    block(p, -.70, .47, .38, .08, .14, .09, 'accent', corner=.018)


def prop_mine_grade_crossing(p):
    rail(p, -1, 1)
    # Four transverse plank courses form an approach on either side of the flangeways.
    for i in range(4):
        z = (i-1.5)*.30
        block(p, 0, .095, z, .64, .19, .294, 'primary', ao=.025*(i%2))
        for side in (-1, 1):
            sections = [[V(side*x, y, z+dz) for y, dz in
                         ((0, -.147), (top, -.147), (top, .147), (0, .147))]
                        for x, top in ((.425, .19), (.62, .19), (1, .018))]
            p.loft(sections, 'primary', cap_start=True, cap_end=True, ao=.025*(i%2))


def prop_mine_sill_stop(p):
    rail(p, -1, .76)
    for x in (-.65, .65):
        block(p, x, .09, .46, .25, .18, 1.08, 'secondary', corner=.035)
        strut(p, (x, .14, .92), (x, .74, .20), .115)
        block(p, x, .48, .20, .18, .67, .18, 'primary')
    block(p, 0, .76, .20, 1.58, .27, .24, 'primary', corner=.035)
    for x in (-.38, .38):
        block(p, x, .76, .055, .26, .20, .065, 'metal', corner=.024)


def prop_basalt_ring_door(p):
    # The wedge joints follow radii from the spring line.
    for side in (-1, 1):
        for i in range(3):
            block(p, side*.84, (i+.5)*.55, 0, .32, .55, .41, 'skin',
                  bevel=.012, ao=-.035*(i%2))
    for i in range(7):
        key = i == 3
        sections = []
        for a in (i*math.pi/7, (i+1)*math.pi/7):
            sections.append([V(r*math.cos(a), 1.65+h*math.sin(a), z)
                             for r, h, z in ((.68, .54, -.21), (1, .86, -.21),
                                             (1, .91 if key else .86, .25 if key else .21),
                                             (.68, .54, .25 if key else .21))])
        p.loft(sections, 'skin', cap_start=True, cap_end=True, ao=.09 if key else -.03*(i%2))


def prop_basalt_corner_bay(p):
    # The two walls occupy the back and left edges of one floor tile.
    for i in range(5):
        h = .43
        split = .26 if i%2 else -.32
        for start, end in ((-1, split), (split, 1)):
            block(p, (start+end)/2, (i+.5)*h, -.86, end-start, h, .28,
                  'skin', bevel=.013, ao=-.04*(i%2))
        for start, end in ((-.72, -split), (-split, 1)):
            block(p, -.86, (i+.5)*h, (start+end)/2, .28, h, end-start,
                  'skin', bevel=.013, ao=-.04*(i%2))


def prop_basalt_buttressed_bay(p):
    # The buttress feet spread along the passage and stay inside the tile.
    for side in (-1, 1):
        for i in range(4):
            block(p, side*.82, (i+.5)*.55, 0, .36, .55, .48, 'skin',
                  bevel=.012, ao=-.035*(i%2))
        for end in (-1, 1):
            profile = [(.24, 0), (.89, 0), (.89, .54), (.62, .87),
                       (.62, 1.32), (.24, 2.08)]
            p.loft([[V(side*x, y, end*z) for z, y in profile] for x in (.69, .97)],
                   'skin', cap_start=True, cap_end=True, ao=-.06)
        # Separate wedge stones carry the pointed arch up to the crown.
        ribs = [(.64, 2.20, 1, 2.20), (.55, 2.55, .92, 2.69),
                (.37, 2.83, .72, 3.02), (.13, 3.09, .18, 3.57)]
        for a, b in zip(ribs, ribs[1:]):
            p.loft([[V(side*x, y, z) for x, y, z in
                     ((xi, yi, -.25), (xo, yo, -.25), (xo, yo, .25), (xi, yi, .25))]
                    for xi, yi, xo, yo in (a, b)], 'skin', cap_start=True, cap_end=True)
    half = [(0, 3.22), (.13, 3.09), (.18, 3.57), (0, 3.76)]
    # Split the concave crown at its centre so each end cap stays convex.
    for side in (-1, 1):
        p.loft([[V(side*x, y, z) for x, y in half] for z in (-.30, .30)],
               'skin', cap_start=True, cap_end=True, ao=.08)


def prop_basalt_vault_bay(p):
    # The inner roof has a faceted soffit. Both ends open onto the tile edge.
    for side in (-1, 1):
        for i in range(3):
            block(p, side*.885, (i+.5)*.54, 0, .23, .54, 2, 'skin', bevel=.012)
    profile = [(-1, 1.62), (-.77, 1.62), (-.61, 1.97), (-.31, 2.17),
               (0, 2.24), (.31, 2.17), (.61, 1.97), (.77, 1.62), (1, 1.62)]
    for i, ((x0, y0), (x1, y1)) in enumerate(zip(profile, profile[1:])):
        sections = [[V(x, y, z) for x, y in ((x0, y0), (x1, y1),
                     (x1, 2.54-.12*abs(x1)), (x0, 2.54-.12*abs(x0)))] for z in (-1, 1)]
        p.loft(sections, 'skin', cap_start=True, cap_end=True, ao=-.035*(i%2))


def prop_basalt_processional_stair(p):
    # The first tread sits one rise above the adjacent 140 mm floor tile.
    for i in range(5):
        h = .14+(i+1)*.16
        z = .8-i*.4
        block(p, 0, h/2, z, 2, h, .4, 'skin', ao=.018*(i%2))
        for side in (-1, 1):
            block(p, side*.92, h+.055, z, .16, .11, .4, 'secondary', bevel=.012)


def prop_basalt_high_landing(p):
    block(p, 0, .38, 0, 2, .76, 2, 'skin', ao=-.09)
    block(p, 0, .79, 0, 1.97, .06, 1.97, 'secondary')
    block(p, 0, .88, 0, 2, .12, 2, 'skin')


def prop_pit_lamp_bench(p):
    for x in (-.56, .56):
        for z in (-.22, .22):
            block(p, x, .40, z, .11, .80, .11, 'primary')
        block(p, x, .22, 0, .12, .09, .54, 'secondary')
    for z in (-.19, 0, .19):
        block(p, 0, .825, z, 1.48, .085, .184, 'primary', ao=.04)
    lamp(p, -.46, .8675, 0)
    block(p, .28, .94, 0, .50, .145, .31, 'metal', corner=.035)
    strut(p, (.29, 1.01, 0), (.51, 1.27, 0), .032, 'primary')


def prop_brood_husk(p):
    # A split shell exposes the dark inner face and the torn lip.
    heights = [.85, .66, .72, .42, .55, .36, .73, .64, .80]
    rings = []
    for radius, base, rise in ((.23, 0, 0), (.47, .31, 0), (.39, 0, 1),
                               (.35, -.014, 1), (.41, .31, 0), (.20, .12, 0)):
        rings.append([V(radius*math.cos(i*math.tau/9), base+rise*h,
                        .84*radius*math.sin(i*math.tau/9)) for i, h in enumerate(heights)])
    p.loft(rings, 'skin', band_regions=['hair', 'skin', 'accent', 'secondary', 'secondary'],
           cap_start=True, cap_end=True)


def prop_shrine_tusk_lamp(p):
    p.lathe([(.38, 0), (.42, .11), (.28, .23), (.20, .57), (.32, .68)],
            8, 'skin', cap_start=True, cap_end=True)
    p.lathe([(.22, .66), (.36, .78), (.32, .85), (.24, .81)],
            8, 'metal', cap_end=True)
    for i in range(3):
        a = i*math.tau/3
        x, z = math.cos(a), math.sin(a)
        spike(p, .25*x, .74, .25*z, .072, .41, .07*x, .07*z, 'accent')
    spike(p, 0, .78, 0, .16, .54, .075, -.03, 'eye')


KIT_PROPS = [
    (prop_mine_turnout, 'Three-Way Mine Turnout'),
    (prop_mine_grade_crossing, 'Planked Mine Crossing'),
    (prop_mine_sill_stop, 'Braced Sill Stop'),
    (prop_basalt_ring_door, 'Basalt Ring Doorway'),
    (prop_basalt_buttressed_bay, 'Buttressed Basalt Bay'),
    (prop_basalt_corner_bay, 'Coursed Basalt Corner'),
    (prop_basalt_vault_bay, 'Basalt Vault Passage'),
    (prop_basalt_processional_stair, 'Processional Stair'),
    (prop_basalt_high_landing, 'Raised Basalt Landing'),
    (prop_pit_lamp_bench, 'Pit Lamp Repair Bench'),
    (prop_brood_husk, 'Split Brood Husk'),
    (prop_shrine_tusk_lamp, 'Tusk Shrine Lamp'),
]
