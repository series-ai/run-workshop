"""Small goods for the village market and the keep."""

import math

from mathutils import Matrix
from polykit import V, X, Y, Z, ring


def _hoop(p, x, y, z, radius, width, height, sides, region):
    """Make a flat ring with a clear opening."""
    outer = radius
    inner = radius - width
    for a, b in zip(range(sides), range(1, sides + 1)):
        corners = [(x + r * math.cos(i * math.tau / sides),
                    z + r * math.sin(i * math.tau / sides))
                   for i, r in ((a, inner), (a, outer), (b, outer), (b, inner))]
        p.loft([[V(px, level, pz) for px, pz in corners] for level in (y, y + height)],
               region, cap_start=True, cap_end=True, omitted_cells={(0, 0), (0, 2)})


def prop_pickup_medieval_gate_key(p):
    _hoop(p, -.073, 0, 0, .043, .013, .018, 8, 'metal')
    p.box((.042, .010, 0), (.160, .020, .017), 'metal')
    p.box((-.018, .012, 0), (.016, .024, .033), 'secondary')
    for x, reach in ((.083, .030), (.112, .042)):
        p.box((x, .010, reach / 2), (.016, .018, reach), 'metal')


def prop_pickup_medieval_sealed_writ(p):
    p.box((0, .010, 0), (.232, .020, .153), 'skin', corner=.008)
    p.slab([V(-.114, .020, -.072), V(.114, .020, -.072), V(.009, .020, .040)],
           .005, 'skin', normal=Y, shrink=.99, ao=.10)
    for x in (-.015, .014):
        p.slab([V(x - .008, .021, .020), V(x + .009, .021, .020),
                V(2*x + .008, .021, .078), V(2*x - .009, .021, .067)],
               .003, 'accent', normal=Y)
    p.lathe([(.030, .024), (.032, .030), (.024, .037)], 9, 'accent',
            center=(0, 0, .023), cap_end=True)
    p.lathe([(.016, .037), (.012, .041)], 4, 'accent', center=(0, 0, .023),
            cap_end=True, ao=.23)


def prop_pickup_medieval_rye_loaf(p):
    # Each cut opens the upper crust and shows the crumb below it.
    profile = [(-.060, 0), (-.085, .029), (-.066, .073), (-.029, .101),
               (.029, .101), (.066, .073), (.085, .029), (.060, 0)]
    stations = [(-.145, .40, False), (-.118, .83, False)]
    for cut in (-.062, 0, .062):
        stations.extend([(cut - .008, 1, False), (cut, .93, True), (cut + .008, 1, False)])
    stations.extend([(.118, .83, False), (.145, .40, False)])
    sections = [[V(x + z * scale * .24, y * scale, z * scale) for z, y in profile]
                for x, scale, _ in stations]
    for i, (left, right) in enumerate(zip(sections, sections[1:])):
        for j in range(len(profile)):
            k = (j + 1) % len(profile)
            crumb = 2 <= j <= 4 and (stations[i][2] or stations[i + 1][2])
            p.face([p.vert(v) for v in (left[j], left[k], right[k], right[j])],
                   'skin' if crumb else 'primary')
    for section, outward in ((sections[0], -X), (sections[-1], X)):
        p.face([p.vert(v) for v in section], 'primary', toward=outward)


def prop_pickup_medieval_orchard_pear(p):
    p.lathe([(.033, 0), (.054, .024), (.061, .060), (.047, .096),
             (.023, .128), (.015, .145)], 8, 'hair', cap_start=True, cap_end=True)
    p.prism(V(0, .138, 0), V(.012, .171, -.004), .006, .004, 5, 'secondary')
    p.slab([V(.007, .155, 0), V(.024, .157, -.011), V(.056, .151, -.008),
            V(.034, .154, .008)], .003, 'hair', normal=Y, back=True, ao=.17)


def prop_pickup_medieval_ferry_tokens(p):
    for x, z, y in ((-.035, -.018, 0), (-.034, -.018, .014), (.046, .033, 0)):
        _hoop(p, x, y, z, .046, .031, .014, 8, 'metal')
        if x < 0 and y == 0:
            continue
        for dx in (-.029, .029):
            p.box((x + dx, y + .015, z), (.006, .002, .018), 'accent')


def prop_pickup_medieval_mason_square(p):
    p.box((-.076, .013, 0), (.038, .026, .192), 'primary', corner=.003)
    p.box((.062, .009, -.078), (.240, .014, .032), 'metal')
    for x in (.032, .068, .104, .140):
        p.box((x, .017, -.071), (.004, .002, .014), 'eye')
    p.lathe([(.008, .026), (.007, .029)], 6, 'metal', center=(-.076, 0, -.077), cap_end=True)


def prop_pickup_medieval_scribe_ink(p):
    p.lathe([(.043, 0), (.051, .013), (.050, .067), (.025, .086),
             (.028, .092), (.028, .107)], 6, 'eye', phase=0, cap_start=True, cap_end=True,
            band_regions=['eye', 'eye', 'eye', 'metal', 'metal'])
    p.lathe([(.019, .107), (.021, .126)], 7, 'primary', cap_start=True, cap_end=True)
    p.plate(V(0, .043, .0438), Z, Y, .037, .031, .003, 'skin', shrink=.9)


def prop_pickup_medieval_star_brooch(p):
    _hoop(p, 0, 0, 0, .066, .013, .012, 10, 'metal')
    for i in range(5):
        with p.placed(Matrix.Rotation(i * math.tau / 5, 4, 'Y')):
            p.slab([V(-.018, .010, .008), V(.018, .010, .008), V(0, .010, .074)],
                   .009, 'metal', normal=Y, back=True)
    p.lathe([(.026, .009), (.031, .019), (.016, .037)], 5, 'accent',
            cap_start=True, cap_end=True)


def prop_pickup_medieval_oil_flask(p):
    p.lathe([(.051, 0), (.081, .036), (.085, .099), (.067, .144), (.025, .168),
             (.025, .200), (.031, .204), (.031, .217)], 9, 'primary', cap_start=True,
            cap_end=True, band_regions=['secondary','primary','primary','primary','primary','skin','skin'])
    p.lathe([(.020, .217), (.021, .231)], 6, 'secondary', cap_end=True)
    points = [V(.021, .189, 0), V(.069, .191, 0), V(.089, .165, 0), V(.062, .130, 0)]
    p.tube(points, [.009, .011, .011, .011], 5, 'primary', up=Z)


def held_medieval_crown_mace(p):
    p.lathe([(.026, -.113), (.031, -.094), (.021, -.079), (.019, .075),
             (.025, .082), (.021, .095), (.018, .304), (.039, .324),
             (.040, .398), (.021, .423)], 6, 'metal', cap_start=True, cap_end=True,
            band_regions=['metal','metal','secondary','accent','accent','secondary','metal','metal','accent'])
    # Six broad crown points surround the cap.
    for i in range(6):
        with p.placed(Matrix.Rotation(i * math.tau / 6, 4, 'Y')):
            outline = [V(-.009, .291, .015), V(-.009, .343, .074),
                       V(-.009, .426, .063), V(-.009, .393, .018)]
            p.slab(outline, .018, 'metal', normal=X, shrink=.86, back=True)


def held_medieval_thorn_dagger(p):
    # The fist closes around the cross grip. The thorn points forward.
    p.lathe([(.023, -.080), (.018, -.066), (.018, .066), (.023, .080)], 6,
            'secondary', band_regions=['metal','secondary','metal'], cap_start=True, cap_end=True)
    for sign in (-1, 1):
        p.prism(V(0, sign * .071, 0), V(0, sign * .048, .092), .016, .012, 5, 'metal', up=X)
    p.box((0, 0, .092), (.030, .148, .022), 'accent', corner=.004)
    p.loft([ring(V(0, 0, z), X, Y, thick, wide, 4)
            for z, thick, wide in ((.099, .012, .042), (.142, .015, .059), (.210, .010, .029))],
           'metal', cap_start=True, tip_end=V(0, -.012, .339))


def held_medieval_watch_bell(p):
    p.lathe([(.024, .091), (.030, .074), (.017, .060), (.015, -.062),
             (.039, -.083), (.045, -.111), (.060, -.145),
             (.081, -.164), (.081, -.174), (.072, -.174), (.037, -.114)],
            6, 'metal', cap_start=True, cap_end=True,
            band_regions=['accent','accent','secondary','accent','metal',
                          'metal','metal','accent','metal','secondary'])
    p.lathe([(.012, -.171), (.020, -.162), (.007, -.112)],
            5, 'eye', cap_start=True)


def _rest_on_side(p, builder, angle):
    with p.placed(Matrix.Rotation(math.radians(angle), 4, 'Z')):
        builder(p)
    bottom = min(v.y for v in p.pos)
    for v in p.pos:
        v.y -= bottom


def prop_pickup_medieval_crown_mace(p):
    _rest_on_side(p, held_medieval_crown_mace, 85)


def prop_pickup_medieval_thorn_dagger(p):
    _rest_on_side(p, held_medieval_thorn_dagger, 90)


def prop_pickup_medieval_watch_bell(p):
    with p.placed(Matrix.Translation((0, .174, 0))):
        held_medieval_watch_bell(p)


COLLECTIBLE_PROPS = [
    (prop_pickup_medieval_gate_key, 'Portcullis Key'),
    (prop_pickup_medieval_sealed_writ, 'Wax-Sealed Writ'),
    (prop_pickup_medieval_rye_loaf, 'Split Rye Loaf'),
    (prop_pickup_medieval_orchard_pear, 'Orchard Pear'),
    (prop_pickup_medieval_ferry_tokens, 'Ferry Toll Tokens'),
    (prop_pickup_medieval_mason_square, "Mason’s Square"),
    (prop_pickup_medieval_scribe_ink, "Scribe’s Ink"),
    (prop_pickup_medieval_star_brooch, 'Five-Point Brooch'),
    (prop_pickup_medieval_oil_flask, 'Oil Flask'),
    (prop_pickup_medieval_crown_mace, 'Crown Mace'),
    (prop_pickup_medieval_thorn_dagger, 'Thorn Punch Dagger'),
    (prop_pickup_medieval_watch_bell, 'Watch Bell'),
]

COLLECTIBLE_HELD = [
    (held_medieval_crown_mace, 'Crown Mace', 'hand_r'),
    (held_medieval_thorn_dagger, 'Thorn Punch Dagger', 'hand_r'),
    (held_medieval_watch_bell, 'Watch Bell', 'hand_l'),
]
