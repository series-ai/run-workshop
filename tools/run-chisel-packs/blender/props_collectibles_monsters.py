"""Hand tools and small finds from the quarry, brood nest, and fossil shrine."""

import math

from mathutils import Matrix
from polykit import V, X, Y, Z


def turned(p, profile, bands, sides=8, **options):
    p.lathe(profile, sides, bands[0], band_regions=bands,
            cap_start=True, cap_end=True, **options)


def bent(p, points, radii, region, *, sides=5, up=Y, **options):
    p.tube([V(*point) for point in points], radii, sides, region, up=up,
           cap_start=True, cap_end=True, **options)


def on_side(p, build):
    start = len(p.pos)
    with p.placed(Matrix.Rotation(-math.pi / 2, 4, 'Z')):
        build(p)
    floor = min(point.y for point in p.pos[start:])
    for point in p.pos[start:]:
        point.y -= floor


def held_monsters_seam_pick(p):
    turned(p, [(.027, -.144), (.032, -.128), (.025, -.098), (.024, .108),
               (.026, .122), (.023, .344), (.037, .361), (.030, .398)],
           ['skin', 'hair', 'secondary', 'accent', 'primary', 'eye', 'metal'], 6)
    # The short square poll balances the curved point.
    bent(p, [(0, .368, -.115), (0, .377, -.092), (0, .377, .028),
             (0, .357, .143), (0, .289, .252)],
         [(.039, .046), (.036, .040), (.034, .041), (.023, .026), (.003, .004)],
         'metal', sides=4, band_regions=['skin', 'metal', 'metal', 'accent'])


def held_monsters_echo_fork(p):
    turned(p, [(.026, -.115), (.030, -.102), (.021, -.087), (.021, .091),
               (.029, .107), (.026, .187), (.042, .207)],
           ['skin', 'hair', 'secondary', 'accent', 'primary', 'metal'], 6)
    # The open tines surround the stone that marks the pitch.
    for sign in (-1, 1):
        bent(p, [(0, .19, 0), (0, .244, sign*.079), (0, .392, sign*.078),
                 (0, .414, sign*.071)],
             [.032, .024, .019, .012], 'metal', sides=4, up=X,
             band_regions=['metal', 'metal', 'accent'])
    turned(p, [(.018, .202), (.032, .239), (.010, .278)], ['eye', 'eye'], 5)


def held_monsters_wick_lamp(p):
    # A side handle leaves an open gap between the fist and the oil cup.
    turned(p, [(.019, -.080), (.020, .08)], ['secondary'], 5)
    for height in (-.08, .08):
        bent(p, [(0, height, 0), (0, height, .063), (0, height*.7, .104)],
             [.018, .016, .017], 'metal', sides=4, up=X)
    turned(p, [(.052, -.105), (.080, -.075), (.077, -.018), (.057, .006),
               (.041, .014), (.027, .066), (.043, .075), (.024, .092)],
           ['metal', 'primary', 'hair', 'skin', 'eye', 'metal', 'accent'],
           6, center=(0, 0, .138))


def prop_pickup_monsters_seam_pick(p):
    on_side(p, held_monsters_seam_pick)


def prop_pickup_monsters_echo_fork(p):
    on_side(p, held_monsters_echo_fork)


def prop_pickup_monsters_wick_lamp(p):
    with p.placed(Matrix.Translation(V(0, .105, 0))):
        held_monsters_wick_lamp(p)


def prop_pickup_monsters_cinder_ore(p):
    outline = [(-.12, -.052), (-.044, -.099), (.088, -.080), (.149, -.006),
               (.108, .067), (-.024, .093), (-.139, .038)]
    rings = [[V(x*s+dx, y+tilt*x, z*s) for x, z in outline]
             for s, dx, y, tilt in [(.83, 0, 0, 0), (1, 0, .037, -.06),
                                    (.92, .007, .066, .12), (.94, .005, .076, .13),
                                    (.65, -.017, .108, .17)]]
    p.loft(rings, 'skin', band_regions=['secondary', 'primary', 'eye', 'skin'],
           cap_start=True, cap_end=True)
    for x, z, radius, height in [(-.05, 0, .038, .108), (.013, -.02, .026, .071),
                                  (.033, .022, .018, .055)]:
        bent(p, [(x, .094, z), (x+.014, .104, z), (x+.03, .094+height*.8, z),
                 (x+.032, .094+height, z)], [radius, radius, radius*.8, radius*.27],
             'metal', up=Z, band_regions=['hair', 'metal', 'accent'])


def prop_pickup_monsters_malachite_slice(p):
    outline = [(-.15, -.042), (-.081, -.097), (.065, -.082), (.132, -.032),
               (.116, .064), (.024, .099), (-.11, .057)]
    # Offset nested bands expose the cut through a mineral nodule.
    layers = [(1, 0, 0), (1.04, .034, 0), (.91, .058, -.003),
              (.83, .060, -.005), (.67, .062, -.012), (.50, .064, -.02),
              (.43, .066, -.024), (.27, .068, -.028), (.13, .070, -.03)]
    rings = [[V(x*s+dx, y, z*s) for x, z in outline] for s, y, dx in layers]
    p.loft(rings, 'skin', band_regions=['secondary', 'skin', 'primary', 'hair',
           'metal', 'accent', 'hair', 'eye'], cap_start=True, cap_end=True)


def prop_pickup_monsters_lamp_fuel(p):
    turned(p, [(.068, 0), (.091, .016), (.097, .101), (.088, .148),
               (.042, .17), (.039, .195), (.046, .20), (.042, .224)],
           ['skin', 'primary', 'hair', 'primary', 'secondary', 'metal', 'accent'],
           scale_z=.74)
    # The pour lip closes with a wax seal.
    p.plate(V(0, .093, .066), Z, Y, .065, .076, .008, 'eye', corner=.014)
    bent(p, [(.030, .163, 0), (.094, .180, 0), (.119, .145, 0), (.087, .095, 0)],
         [.015]*4, 'metal', up=Z)


def prop_pickup_monsters_molt(p):
    # Two empty wing cases expose their pale inside edges at the split.
    for side in (-1, 1):
        rings = []
        for z, width, height, gap in [(-.145, .027, .027, .038),
                                       (-.072, .062, .067, .020),
                                       (.045, .068, .085, .008),
                                       (.12, .042, .043, .005)]:
            rings.append([V(side*(gap+width*x), height*y, z)
                          for x, y in [(0, .40), (.32, 1), (.69, .84), (1, .30),
                                       (.88, 0), (.57, .62), (.32, .78), (.08, .31)]])
        p.loft(rings, 'hair', band_regions=['skin', 'hair', 'primary'],
               cap_start=True, cap_end=True)
        bent(p, [(side*.06, .031, -.124), (side*.044, .069, -.07),
                 (side*.032, .085, .042), (side*.02, .048, .114)],
             [.005, .009, .010, .006], 'accent',
             band_regions=['metal', 'accent', 'eye'])
        p.prism((side*.077, .027, .109), (side*.105, .009, .16),
                .016, .003, 4, 'secondary')


def prop_pickup_monsters_brood_cup(p):
    # Uneven broken teeth surround a continuous dark inner wall.
    heights = [.133, .096, .159, .127, .113, .171, .143, .083, .121, .104]
    def rim(radius, level, relief=0):
        return [V(radius*math.cos(i*math.tau/10), level+relief*h,
                  .81*radius*math.sin(i*math.tau/10)) for i, h in enumerate(heights)]
    rings = [rim(.051, 0), rim(.093, .027), rim(.108, .066), rim(.103, .077),
             rim(.093, 0, 1), rim(.084, -.001, 1), rim(.094, .063), rim(.052, .024)]
    p.loft(rings, 'hair', band_regions=['secondary', 'primary', 'metal', 'hair',
           'accent', 'skin', 'eye'], cap_start=True)
    # The floor faces into the hollow.
    p.slab(rim(.054, .024), .003, 'secondary', normal=Y)


def prop_pickup_monsters_coil_fossil(p):
    turned(p, [(.102, 0), (.130, .012), (.134, .020), (.131, .024),
               (.133, .026), (.129, .031), (.118, .049)],
           ['secondary', 'primary', 'hair', 'eye', 'metal', 'skin'],
           sides=9, scale_z=.84)
    points, radii = [], []
    for i in range(23):
        t = i / 22
        angle = -math.pi*.33 + t*math.tau*1.45
        radius = .01 + .093*t*t
        points.append((radius*math.cos(angle), .049+.008*t, radius*.88*math.sin(angle)))
        radii.append(.005+.020*t)
    bent(p, points, radii, 'accent', sides=6,
         band_ao=[-.16 if i % 4 == 0 else .02 for i in range(len(points)-1)])


def prop_pickup_monsters_shrine_token(p):
    # The hole through the coin carries the shrine cord.
    profile = [(.036, 0), (.101, 0), (.109, .009), (.104, .022),
               (.089, .03), (.052, .03), (.036, .021), (.036, 0)]
    p.lathe(profile, 8, 'metal', band_regions=['secondary', 'primary', 'skin',
            'metal', 'hair', 'accent', 'secondary'])
    for i in range(4):
        angle = i*math.pi/2
        with p.placed(Matrix.Rotation(angle, 4, 'Y')):
            p.slab([V(x, .030, z) for x, z in
                    [(0, .05), (.013, .068), (0, .085), (-.013, .068)]],
                   .006, 'eye', normal=Y)


def prop_pickup_monsters_votive_eye(p):
    turned(p, [(.072, 0), (.086, .01), (.077, .034), (.041, .051),
               (.038, .071), (.05, .08)], ['secondary', 'skin', 'primary', 'hair', 'metal'],
           scale_z=.73)
    # A cut stone hangs between the two ivory horns.
    for side in (-1, 1):
        bent(p, [(side*.030, .054, 0), (side*.080, .092, 0),
                 (side*.084, .151, 0), (side*.055, .19, 0)],
             [.028, .024, .017, .003], 'accent', up=Z,
             band_regions=['metal', 'accent', 'accent'])
    turned(p, [(.012, .078), (.047, .117), (.011, .155)], ['eye', 'eye'],
           sides=5, scale_z=.66)


COLLECTIBLE_PROPS = [
    (prop_pickup_monsters_cinder_ore, 'Cinder Ore'),
    (prop_pickup_monsters_malachite_slice, 'Malachite Slice'),
    (prop_pickup_monsters_lamp_fuel, 'Sealed Lamp Fuel'),
    (prop_pickup_monsters_seam_pick, 'Seam Pick'),
    (prop_pickup_monsters_echo_fork, 'Echo Fork'),
    (prop_pickup_monsters_wick_lamp, 'Wick Lamp'),
    (prop_pickup_monsters_molt, 'Split Wing Cases'),
    (prop_pickup_monsters_brood_cup, 'Empty Brood Shell'),
    (prop_pickup_monsters_coil_fossil, 'Coil Fossil'),
    (prop_pickup_monsters_shrine_token, 'Pierced Shrine Token'),
    (prop_pickup_monsters_votive_eye, 'Votive Eye'),
]

COLLECTIBLE_HELD = [
    (held_monsters_seam_pick, 'Seam Pick', 'hand_r'),
    (held_monsters_echo_fork, 'Echo Fork', 'hand_r'),
    (held_monsters_wick_lamp, 'Wick Lamp', 'hand_l'),
]
