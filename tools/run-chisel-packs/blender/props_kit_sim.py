"""Two-metre shop bays and fittings for the Sim district."""

from polykit import V, X, Y, Z


def prop_curb_apron(p):
    # The road curb meets the low end. The door steps sit on the flat end.
    profile = [(-1, 0), (1, 0), (1, .09), (.38, .128), (-1, .128)]
    p.loft([[V(x, h, z) for z, h in profile] for x in (-1, 1)],
           'skin', cap_start=True, cap_end=True)
    for x in (-.68, .68):
        for z in (.48, .66, .84):
            p.box((x, .128 - (z - .38) * .061, z), (.42, .009, .043),
                  'metal', up=V(0, 1, .061))


def prop_paving_service(p):
    p.box((0, .059, 0), (2, .118, 2), 'skin')
    for x in (-.5, .5):
        for z in (-.5, .5):
            p.box((x, .123, z), (.986, .01, .986), 'skin')
    p.box((.5, .133, -.5), (.65, .01, .66), 'metal', corner=.05)
    for x in (.32, .5, .68):
        p.box((x, .14, -.5), (.045, .004, .37), 'secondary')


def prop_shop_steps(p):
    for i in range(2):
        h = (i + 1) * .15
        z = .15 - .30 * i
        p.box((0, h / 2, z), (1.54, h, .30), 'skin')
        p.box((0, h - .022, z + .151), (1.49, .028, .004), 'metal')


def prop_shop_landing(p):
    p.box((0, .14, 0), (1.6, .28, .76), 'primary')
    p.box((0, .29, 0), (1.6, .02, .76), 'skin')


def prop_shop_post(p):
    p.box((0, 1.40, 0), (.20, 2.80, .20), 'secondary')
    for y, h in ((.14, .28), (2.67, .26)):
        p.box((0, y, 0), (.205, h, .205), 'primary')


def prop_plaster_bay(p):
    p.box((0, 1.40, 0), (1.8, 2.8, .16), 'skin')
    for z in (-.09, .09):
        p.box((0, .13, z), (1.8, .26, .02), 'primary')
        p.box((0, 2.62, z), (1.8, .12, .02), 'secondary')


def prop_sash_bay(p):
    # The upper sash has an open transom. The sill has two finished faces.
    for x in (-.82, .82):
        p.box((x, 1.40, 0), (.16, 2.80, .18), 'skin')
    for y, h, role in ((.36, .72, 'primary'), (.76, .08, 'secondary'),
                       (2.21, .08, 'secondary'), (2.63, .34, 'skin')):
        p.box((0, y, 0), (1.48, h, .18), role)
    p.box((0, 1.485, 0), (1.48, 1.37, .04), 'eye')
    p.box((0, 1.63, 0), (.055, 1.66, .09), 'primary')


def _portal(p, color):
    for x in (-.78, .78):
        p.box((x, 1.11, 0), (.24, 2.22, .19), 'secondary')
        p.box((x, .16, 0), (.24, .32, .21), 'primary')
    p.box((0, 2.51, 0), (1.80, .58, .20), color)


def prop_service_portal(p):
    _portal(p, 'skin')


def prop_cafe_portal(p):
    _portal(p, 'eye')
    # A cup, loop handle and saucer mark the entrance.
    p.box((-.06, 2.53, .12), (.52, .24, .06), 'skin', taper=(1.24, 1))
    p.tube([V(.22, 2.60, .12), V(.37, 2.59, .12), V(.36, 2.48, .12),
            V(.19, 2.46, .12)], [.035] * 4, 5, 'skin', up=Z)
    p.box((-.015, 2.36, .12), (.78, .04, .06), 'skin')


def prop_market_portal(p):
    _portal(p, 'primary')
    for x in (-.44, 0, .44):
        p.box((x, 2.48, .13), (.29, .20, .08), 'eye', corner=.055,
              taper=(1.25, .8))
        p.box((x + .06, 2.64, .13), (.07, .15, .05), 'hair', up=V(.5, 1, 0))


def prop_stripe_canopy(p):
    seams = [(-.90 + .36 * i) for i in range(6)]
    profile = [(-.35, .23), (.35, 0), (.35, .11), (-.35, .34)]
    for i, (a, b) in enumerate(zip(seams, seams[1:])):
        p.loft([[V(x, h, z) for z, h in profile] for x in (a, b)],
               'eye' if i % 2 == 0 else 'skin', cap_start=i == 0, cap_end=i == 4)


def prop_oak_floor(p):
    p.box((0, .207, 0), (2, .414, 2), 'secondary')
    for i in range(6):
        x = (i - 2.5) / 3
        joint = .30 if i % 2 else -.42
        for a, b in ((-1, joint), (joint, 1)):
            p.box((x, .421, (a + b) / 2), (.329, .014, b - a - .005),
                  'primary', ao=-.04 * (i % 3))


def prop_quarry_floor(p):
    p.box((0, .207, 0), (2, .414, 2), 'secondary')
    for i in range(4):
        for j in range(4):
            p.box(((i - 1.5) / 2, .421, (j - 1.5) / 2), (.494, .014, .494),
                  'skin', ao=-.06 * ((i + j) % 2))


def _roof(p, width):
    depth = 6.32
    p.box((0, .08, 0), (width, .16, depth), 'secondary')
    for x in (-1, 1):
        p.box((x * (width / 2 - .06), .25, 0), (.12, .18, depth), 'metal')
    for z in (-3.10, 3.10):
        p.box((0, .25, z), (width - .24, .18, .12), 'metal')


def prop_cafe_roof(p):
    _roof(p, 6.32)
    # Raised clerestory with a folded cap.
    p.box((-.9, .42, -.6), (1.30, .52, 2.50), 'eye')
    for z in (-1.71, -.60, .51):
        p.box((-.9, .42, z), (1.32, .52, .07), 'metal')
    p.box((-.9, .73, -.6), (1.49, .10, 2.65), 'skin')


def prop_market_roof(p):
    _roof(p, 8.32)
    for z in (-1.8, -.54):
        p.box((2.4, .48, z), (1.15, .64, .92), 'metal', corner=.06)
        p.lathe([(.39, .8), (.34, .84)], 12, 'secondary', center=(2.4, 0, z), cap_end=True)
        for dx in (-.16, 0, .16):
            p.box((2.4 + dx, .85, z), (.04, .02, .48), 'metal')


def prop_espresso_bar(p):
    p.box((0, .45, 0), (1.78, .90, .70), 'eye')
    for x in (-.62, -.31, 0, .31, .62):
        p.box((x, .44, .356), (.04, .74, .02), 'primary')
    p.box((0, .93, 0), (1.9, .06, .78), 'skin', corner=.04)
    p.box((-.23, 1.01, 0), (.86, .10, .44), 'metal')
    p.box((-.23, 1.20, -.15), (.82, .30, .12), 'secondary')
    p.box((-.23, 1.38, 0), (.9, .16, .42), 'eye', corner=.04)
    for x in (-.46, 0):
        p.lathe([(.046, 1.06), (.065, 1.15)], 8, 'skin', center=(x, 0, .09), cap_end=True)
        p.box((x, 1.266, .08), (.075, .068, .08), 'metal')
    p.lathe([(.12, .96), (.12, 1.18), (.08, 1.20), (.16, 1.43), (.16, 1.46)],
            8, 'secondary', center=(.58, 0, 0), cap_end=True)


def prop_bread_hutch(p):
    for x in (-.72, .72):
        p.box((x, .83, 0), (.09, 1.66, .52), 'primary')
    for y in (.18, .81, 1.43):
        p.box((0, y, 0), (1.36, .06, .50), 'secondary')
        for x in (-.42, 0, .42):
            p.box((x, y + .13, .015), (.36, .20, .31), 'primary',
                  corner=.08, taper=(.76, .70))
            p.box((x - .03, y + .231, .015), (.03, .005, .15), 'skin')
    p.box((0, 1.68, 0), (1.56, .10, .58), 'eye')


def prop_stock_rack(p):
    for x in (-.80, .80):
        for z in (-.27, .27):
            p.box((x, .95, z), (.07, 1.9, .07), 'metal')
    for row, y in enumerate((.18, .80, 1.42)):
        p.box((0, y, 0), (1.68, .06, .62), 'secondary')
        for col in range(3 if row != 1 else 2):
            x = (col - 1) * .48
            h = .31 + .09 * ((col + row) % 2)
            p.box((x, y + .03 + h / 2, 0), (.42, h, .45), 'primary')
            p.box((x, y + .034 + h, 0), (.07, .008, .45), 'skin')
            p.box((x + .08, y + .15, .227), (.14, .09, .005), 'skin')


def prop_checkout(p):
    p.box((0, .43, 0), (1.42, .86, .72), 'primary')
    p.box((0, .90, 0), (1.52, .08, .78), 'skin', corner=.04)
    p.box((.40, .99, 0), (.50, .10, .40), 'secondary')
    p.box((.40, 1.13, -.10), (.12, .20, .12), 'metal')
    p.box((.40, 1.26, -.10), (.42, .25, .07), 'eye', up=V(0, 1, -.2))
    p.box((-.31, .95, 0), (.46, .02, .32), 'metal')


def prop_wash_station(p):
    for x in (-.70, .70):
        for z in (-.26, .26):
            p.box((x, .45, z), (.07, .9, .07), 'metal')
    p.box((0, .29, 0), (1.45, .05, .54), 'primary')
    p.box((0, .84, 0), (1.56, .12, .70), 'metal')
    p.box((-.28, .903, 0), (.64, .006, .45), 'secondary', corner=.05)
    for x in (.16, .27, .38, .49, .60):
        p.box((x, .909, 0), (.028, .018, .40), 'skin')
    p.tube([V(-.30, .90, -.26), V(-.30, 1.18, -.26), V(-.30, 1.20, -.04),
            V(-.30, 1.13, .01)], [.033] * 4, 6, 'metal', up=X, cap_end=True)



def prop_market_hood(p):
    # Two steel brackets carry a folded sheet hood.
    for x in (-.69, .69):
        p.prism(V(x, .04, -.25), V(x, .22, .20), .033, .033, 4, 'secondary')
    profile = [(-.28, .35), (.28, .26), (.28, .16), (-.28, .30)]
    p.loft([[V(x, y, z) for z, y in profile] for x in (-.90, .90)],
           'metal', cap_start=True, cap_end=True)
    p.box((0, .16, .26), (1.80, .11, .055), 'eye')


def prop_preserve_island(p):
    # Shorter shelves at the top leave the jar labels in view.
    p.box((0, .18, 0), (1.32, .36, .74), 'primary')
    for tier, y in enumerate((.39, .82)):
        depth = .84 - tier * .20
        p.box((0, y, 0), (1.44, .06, depth), 'eye')
        if tier == 0:
            for side in (-1, 1):
                p.box((side * .63, .605, 0), (.07, .37, .53), 'primary')
        for x in (-.44, -.15, .15, .44):
            p.lathe([(.10, .03), (.10, .20), (.076, .23), (.085, .25), (.085, .28)],
                    6, 'primary' if x < 0 else 'hair', center=(x, y, .04),
                    band_regions=['primary' if x < 0 else 'hair', 'skin', 'skin', 'metal'],
                    cap_end=True)



def prop_price_board(p):
    p.box((0, .40, 0), (1.38, .80, .08), 'primary', corner=.03)
    p.box((0, .40, .044), (1.28, .70, .018), 'eye')
    p.box((0, .65, .055), (.69, .045, .008), 'skin')
    for row, width in enumerate((.49, .57, .39)):
        y = .48 - .13 * row
        p.box((-.48 + width / 2, y, .055), (width, .027, .008), 'skin')
        p.box((.40, y, .055), (.15, .032, .008), 'skin')
    p.box((0, .06, .055), (1.30, .05, .13), 'primary')


def prop_bakery_oven(p):
    p.box((0, .085, 0), (.96, .17, .66), 'secondary')
    p.box((0, .57, 0), (1.04, .80, .72), 'metal')
    for y in (.36, .71):
        p.box((-.10, y, .372), (.72, .30, .034), 'secondary')
        p.box((-.10, y - .02, .393), (.57, .15, .012), 'eye')
        p.box((-.10, y + .095, .42), (.61, .036, .065), 'metal')
        p.prism(V(.38, y, .36), V(.38, y, .404), .053, .048, 8, 'secondary')
    p.box((0, .99, 0), (1.08, .04, .74), 'skin')


def prop_sack_trolley(p):
    for x in (-.26, .26):
        p.prism(V(x - .045, .14, -.12), V(x + .045, .14, -.12),
                .14, .14, 12, 'secondary', cap_start=True, cap_end=True)
        p.prism(V(x, .15, -.12), V(x, 1.16, -.29), .034, .034, 6, 'metal')
    p.prism(V(-.26, 1.16, -.29), V(.26, 1.16, -.29), .04, .04, 8, 'eye')
    p.box((0, .10, .09), (.58, .05, .49), 'metal')
    for y in (.125, .40):
        p.lathe([(.22, y), (.28, y + .07), (.27, y + .21), (.21, y + .275)],
                8, 'skin', center=(0, 0, .056), scale_z=.77, cap_end=True)
        p.box((0, y + .14, .25), (.17, .085, .018), 'primary')


SIM_KIT_STATIC = [
    (prop_price_board, 'Framed Price Board'),
    (prop_bakery_oven, 'Double Deck Bakery Oven'),
    (prop_sack_trolley, 'Loaded Sack Trolley'),
    (prop_market_hood, 'Folded Zinc Market Hood'),
    (prop_preserve_island, 'Two Tier Preserve Display'),
    (prop_curb_apron, 'Flush Crossing Apron'),
    (prop_paving_service, 'Service Cover Pavement'),
    (prop_shop_steps, 'Two Stone Entry Steps'),
    (prop_shop_landing, 'Stone Entry Landing'),
    (prop_shop_post, 'Shop Bay Pier'),
    (prop_plaster_bay, 'Plaster and Timber Bay'),
    (prop_sash_bay, 'Display Sash with Open Transom'),
    (prop_service_portal, 'Open Service Doorway'),
    (prop_cafe_portal, 'Cup and Saucer Entry'),
    (prop_market_portal, 'Greengrocer Entry'),
    (prop_stripe_canopy, 'Striped Canvas Canopy'),
    (prop_oak_floor, 'Staggered Oak Floor'),
    (prop_quarry_floor, 'Quarry Tile Floor'),
    (prop_cafe_roof, 'Cafe Clerestory Roof'),
    (prop_market_roof, 'Market Plant Roof'),
    (prop_espresso_bar, 'Twin Group Espresso Bar'),
    (prop_bread_hutch, 'Bakery Loaf Hutch'),
    (prop_stock_rack, 'Carton Storage Rack'),
    (prop_checkout, 'Market Checkout'),
    (prop_wash_station, 'Sink and Draining Board'),
]
