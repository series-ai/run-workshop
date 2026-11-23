"""Civilian supplies and inspection equipment for the rail depot."""

from math import pi

from mathutils import Matrix
from polykit import V, X, Y, Z, ring


def held_ww2_thermos(p):
    profile = [
        (.038, -.116), (.044, -.110), (.041, -.095),
        (.041, .044), (.041, .055), (.041, .068), (.029, .082),
        (.037, .083), (.039, .126), (.034, .131),
    ]
    p.lathe(profile, 8, 'primary', center=(.079, 0, 0), cap_start=True, cap_end=True,
            band_regions=['metal', 'secondary', 'primary', 'skin',
                          'primary', 'primary', 'metal', 'secondary', 'skin'])
    p.box((0, 0, 0), (.043, .100, .023), 'secondary')
    for y in (-.047, .047):
        p.box((.023, y, 0), (.057, .012, .017), 'metal')


def prop_pickup_ww2_thermos(p):
    with p.placed(Matrix.Translation(Y * .116)):
        held_ww2_thermos(p)


def held_ww2_entry_stamp(p):
    p.box((0, -.052, 0), (.088, .010, .048), 'eye')
    p.box((0, -.040, 0), (.094, .016, .054), 'secondary', corner=.006)
    p.lathe([(.018, -.034), (.018, -.025), (.020, -.019), (.020, .007),
             (.027, .021), (.028, .035), (.020, .043)], 8, 'secondary',
            band_regions=['metal', 'metal', 'secondary', 'secondary', 'secondary', 'skin'],
            cap_end=True)


def prop_pickup_ww2_entry_stamp(p):
    with p.placed(Matrix.Translation(Y * .057)):
        held_ww2_entry_stamp(p)


def held_ww2_signal_paddle(p):
    p.lathe([(.024, -.09), (.024, 0), (.014, .073), (.006, .156)],
            6, 'secondary', cap_start=True, band_regions=['secondary', 'secondary', 'skin'])
    center = Y * .205
    profile = [(.079, -.009), (.086, -.006), (.086, .006),
               (.079, .009), (.054, .009), (.053, .010)]
    rings = [ring(center + Z * z, X, Y, radius, radius, 9) for radius, z in profile]
    p.loft(rings, 'accent', band_regions=['metal', 'metal', 'skin', 'skin', 'accent'],
           cap_start=True, cap_end=True)


def prop_pickup_ww2_signal_paddle(p):
    with p.placed(Matrix.Translation(Y * .024) @ Matrix.Rotation(-pi / 2, 4, 'X')):
        held_ww2_signal_paddle(p)


def prop_pickup_ww2_ration_tin(p):
    p.box((0, .033, 0), (.183, .066, .11), 'metal', corner=.018, bevel=.003)
    p.box((0, .037, 0), (.185, .044, .112), 'skin', corner=.018)
    p.box((0, .069, 0), (.19, .009, .117), 'primary', corner=.017)
    # A wire key lies across the lid of the tin.
    wire_loop(p, V(-.049, .077, .012), .012, .018, .003, 'accent')
    p.box((-.015, .077, .012), (.047, .005, .006), 'metal')


def wire_loop(p, center, rx, rz, thickness, region):
    path = ring(center, X, Z, rx, rz, 10)
    sections = []
    for index, point in enumerate(path):
        tangent = (path[(index + 1) % len(path)] - path[index - 1]).normalized()
        sections.append(ring(point, Y, tangent.cross(Y), thickness, thickness, 4))
    # Each section needs its own centre for outward normals at the inner rim.
    for index, section in enumerate(sections):
        p.loft([section, sections[(index + 1) % len(sections)]], region)


def prop_pickup_ww2_rail_keys(p):
    wire_loop(p, V(0, .011, -.049), .029, .025, .003, 'metal')
    for angle, length, metal in ((-.32, .102, 'accent'), (.44, .080, 'metal')):
        with p.placed(Matrix.Translation(V(0, .004, -.048)) @ Matrix.Rotation(angle, 4, 'Y')):
            wire_loop(p, Z * .027, .014, .014, .004, metal)
            p.box((0, 0, .039 + length / 2), (.007, .008, length), metal)
            for z, width in ((length + .034, .021), (length + .020, .015)):
                p.box((width / 2, 0, z), (width, .008, .009), metal)


def prop_pickup_ww2_luggage_tags(p):
    for height, angle, paper in ((0, -.30, 'secondary'), (.004, .12, 'skin')):
        with p.placed(Matrix.Translation(Y * height) @ Matrix.Rotation(angle, 4, 'Y')):
            border = [(-.036, .068), (.036, .068), (.036, -.034),
                      (.016, -.060), (-.016, -.060), (-.036, -.034)]
            p.slab([V(x, 0, z) for x, z in border], .004, paper, normal=Y, shrink=1, back=True)
            p.lathe([(.009, .004), (.009, .005)], 8, 'accent', center=(0, 0, -.041), cap_end=True)
            wire_loop(p, V(0, .007, -.063), .009, .023, .002, 'metal')
            for z, width in ((.02, .045), (.032, .028)):
                p.box((-.003, .0045, z), (width, .001, .004), 'eye')


def prop_pickup_ww2_travel_pass(p):
    p.box((0, .004, 0), (.199, .008, .137), 'primary', corner=.006)
    for x in (-.048, .048):
        p.box((x, .009, 0), (.092, .005, .128), 'skin', corner=.003)
    p.box((-.048, .012, -.013), (.052, .002, .072), 'secondary')
    p.lathe([(.012, .013), (.012, .015)], 8, 'skin', center=(-.048, 0, -.025), cap_end=True)
    p.box((-.048, .014, .004), (.031, .002, .019), 'primary', corner=.006)
    for z, length in ((-.043, .062), (-.024, .050), (-.011, .043)):
        p.box((.019 + length / 2, .012, z), (length, .0015, .004), 'metal')
    p.lathe([(.017, .0115), (.017, .013)], 8, 'accent', center=(.059, 0, .029), cap_end=True)


def prop_pickup_ww2_dressing_pouch(p):
    p.box((0, .060, 0), (.178, .12, .073), 'hair', corner=.012, bevel=.009)
    p.box((0, .094, .005), (.186, .057, .081), 'skin', corner=.012, bevel=.005)
    p.plate(V(0, .089, .046), Z, Y, .052, .046, .002, 'primary')
    for w, h, depth in ((.029, .009, .049), (.009, .030, .0502)):
        p.box((0, .089, depth), (w, h, .0016), 'skin')
    for x in (-.062, .062):
        p.box((x, .066, .040), (.016, .056, .015), 'secondary')
        p.box((x, .052, .049), (.021, .011, .007), 'accent')


def prop_pickup_ww2_binoculars(p):
    for x in (-.044, .044):
        center = V(x, .036, 0)
        profile = [(.018, -.084), (.021, -.084), (.021, -.062), (.016, -.061),
                   (.017, -.045), (.030, -.039), (.029, .012), (.036, .060),
                   (.036, .074), (.030, .074), (.029, .069), (.027, .0695)]
        rings = [ring(center + Z * z, X, Y, r, r, 8) for r, z in profile]
        p.loft(rings, 'eye', cap_start=True, cap_end=True,
               band_regions=['metal', 'eye', 'metal', 'metal', 'primary',
                             'primary', 'primary', 'metal', 'metal', 'metal', 'eye'])
    for z in (-.028, .018):
        p.box((0, .037, z), (.08, .013, .014), 'metal')
    p.prism(V(0, .043, -.038), V(0, .043, .024), .012, .012, 8, 'secondary')


def prop_pickup_ww2_flap_holster(p):
    # The closed leather cover encloses the full sidearm silhouette.
    outline = [(-.072, -.113), (.074, -.107), (.075, -.059), (.029, .101),
               (.010, .134), (-.029, .136), (-.049, .111), (-.068, -.035)]
    p.slab([V(x, 0, z) for x, z in outline], .046, 'secondary', normal=Y, shrink=.89, back=True)
    flap = [(-.076, -.118), (.077, -.110), (.073, -.041),
            (.015, -.004), (-.052, -.017), (-.075, -.052)]
    p.slab([V(x, .041, z) for x, z in flap], .013, 'secondary', normal=Y, shrink=.94, back=True, ao=.20)
    p.box((.009, .052, -.008), (.023, .008, .062), 'primary', corner=.005)
    p.lathe([(.007, .056), (.006, .059)], 8, 'accent', center=(.009, 0, .010), cap_end=True)


def prop_pickup_ww2_blanket_roll(p):
    center = V(0, .084, 0)
    for x, r, outer in ((-.145, .071, -.140), (.145, .071, .140)):
        p.prism(center + X * x, center + X * outer, r * .7, r, 8, 'secondary')
    profile = [(-.14, .073), (-.125, .084), (-.076, .082), (-.073, .076),
               (-.049, .076), (-.045, .082), (.047, .084), (.051, .076),
               (.075, .076), (.079, .082), (.124, .084), (.14, .073)]
    rings = [ring(center + X * x, Y, Z, r, r, 8) for x, r in profile]
    p.loft(rings, 'primary', cap_start=True, cap_end=True,
           band_regions=['primary', 'primary', 'secondary', 'secondary', 'secondary',
                         'primary', 'secondary', 'secondary', 'secondary', 'primary', 'primary'])
    seam = [(.015, .002), (.008, .015), (-.013, .018), (-.028, .001),
            (-.023, -.024), (.005, -.036), (.034, -.022)]
    for x in (-.145, .145):
        path = [V(x, .084 + y, z) for y, z in seam]
        p.tube(path, [.0035] * len(path), 4, 'primary', up=X, cap_start=True, cap_end=True)
    for x in (-.061, .063):
        p.box((x, .162, 0), (.025, .008, .024), 'accent')


COLLECTIBLE_PROPS = [
    (prop_pickup_ww2_thermos, 'Platform Thermos'),
    (prop_pickup_ww2_entry_stamp, 'Entry Stamp'),
    (prop_pickup_ww2_signal_paddle, 'Signal Paddle'),
    (prop_pickup_ww2_ration_tin, 'Civilian Ration Tin'),
    (prop_pickup_ww2_rail_keys, 'Rail Keys'),
    (prop_pickup_ww2_luggage_tags, 'Luggage Tags'),
    (prop_pickup_ww2_travel_pass, 'Checkpoint Travel Pass'),
    (prop_pickup_ww2_dressing_pouch, 'Field Dressing Pouch'),
    (prop_pickup_ww2_binoculars, 'Platform Binoculars'),
    (prop_pickup_ww2_flap_holster, 'Closed Sidearm Holster'),
    (prop_pickup_ww2_blanket_roll, 'Shelter Blanket Roll'),
]

COLLECTIBLE_HELD = [
    (held_ww2_thermos, 'Platform Thermos', 'hand_r'),
    (held_ww2_entry_stamp, 'Entry Stamp', 'hand_r'),
    (held_ww2_signal_paddle, 'Signal Paddle', 'hand_l'),
]
