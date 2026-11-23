"""Pocket goods from Lantern Court and service tools from East Coil. Units are metres."""

from math import cos, pi, sin

from mathutils import Matrix

from polykit import V, X, Y


def turned(p, profile, bands, cap, sides=8, **options):
    rings = p.lathe(profile, sides, cap, band_regions=bands, cap_start=True, **options)
    p.face(reversed(rings[-1]), cap)


def prop_pickup_cyberpunk_koi_pin(p):
    # A folded tail and a single bright eye identify the vendor's enamel fish.
    turned(p, [(.045, 0), (.052, .009), (.044, .019)],
           ['metal', 'primary'], 'skin', scale_z=.50)
    p.slab([V(-.030, .005, 0), V(-.074, .005, -.028), V(-.069, .005, .027)],
           .009, 'accent', normal=Y, back=True)
    p.box((.002, .018, 0), (.013, .006, .039), 'secondary', corner=.003)
    for x, z, r, role in [(.025, .007, .010, 'hair'), (.026, .007, .006, 'eye')]:
        y = .019 if role == 'hair' else .022
        p.prism((x, y, z), (x, y + .003, z), r, r, 8, role, up=X)


def prop_pickup_cyberpunk_steam_bun(p):
    # The folded liner extends past the pleated bun.
    p.box((0, .008, 0), (.124, .016, .108), 'primary', taper=.88, corner=.017)
    p.box((0, .019, 0), (.117, .008, .102), 'metal', corner=.019)
    turned(p, [(.033, .023), (.051, .030), (.048, .052), (.027, .071), (.009, .075)],
           ['secondary', 'skin', 'skin', 'accent'], 'skin', 9)
    for angle in (0, 2.1, 4.2):
        radial = V(cos(angle), 0, sin(angle))
        fold = [radial * r + Y * y for r, y in ((.043, .058), (.026, .071), (.012, .074))]
        p.tube(fold, [.0018, .005, .002], 4, 'skin', cap_start=True, cap_end=True)
    p.box((.055, .022, .027), (.040, .006, .024), 'hair')
    p.box((.065, .026, .027), (.007, .002, .020), 'eye')


def prop_pickup_cyberpunk_broth_cell(p):
    turned(p, [(.046, 0), (.052, .009), (.052, .028), (.047, .033),
               (.047, .106), (.052, .113), (.052, .123), (.032, .134)],
           ['metal', 'secondary', 'hair', 'primary', 'accent', 'metal', 'skin'], 'secondary')
    p.box((.006, .137, 0), (.054, .006, .022), 'eye', corner=.005)


def prop_pickup_cyberpunk_transfer_credit(p):
    # Two offset punched fare slips sit in a spring clip.
    p.box((0, .003, 0), (.126, .006, .064), 'skin', corner=.006)
    p.box((.011, .008, .008), (.119, .004, .058), 'primary', corner=.006)
    p.box((-.040, .012, .005), (.029, .008, .067), 'metal', corner=.005)
    p.box((-.040, .017, .005), (.014, .004, .039), 'hair', corner=.004)
    for z, role in [(-.012, 'secondary'), (0, 'accent'), (.012, 'eye')]:
        p.box((.033, .011, z), (.047, .002, .005), role)


def prop_pickup_cyberpunk_gate_fob(p):
    turned(p, [(.034, 0), (.043, .007), (.042, .020), (.035, .025)],
           ['metal', 'primary', 'hair'], 'secondary', 6)
    # The rectangular lanyard eye has a clear opening.
    for z in (-.015, .015):
        p.box((-.049, .013, z), (.047, .010, .009), 'skin')
    p.box((-.069, .013, 0), (.009, .010, .035), 'skin')
    p.box((0, .027, 0), (.035, .005, .024), 'accent', corner=.005)
    p.box((.005, .031, 0), (.008, .003, .017), 'eye')


def prop_pickup_cyberpunk_memory_wafer(p):
    # A chamfered ceramic carrier exposes the die and four contact fingers.
    p.box((0, .004, 0), (.085, .008, .073), 'secondary', corner=.012)
    p.box((-.004, .009, 0), (.068, .004, .062), 'primary', corner=.010)
    p.box((-.008, .013, 0), (.041, .006, .039), 'metal', corner=.006)
    p.box((-.008, .017, 0), (.030, .004, .028), 'hair')
    p.box((-.008, .020, 0), (.021, .002, .015), 'eye')
    for z, role in [(-.021, 'accent'), (-.007, 'skin'), (.007, 'skin'), (.021, 'skin')]:
        p.box((.037, .005, z), (.030, .007, .009), role)


def prop_pickup_cyberpunk_service_spool(p):
    turned(p, [(.041, 0), (.048, .006), (.048, .014), (.034, .017),
               (.034, .054), (.045, .058), (.045, .067), (.026, .070)],
           ['metal', 'primary', 'secondary', 'accent', 'secondary', 'primary', 'metal'], 'hair')
    for y in (.023, .034, .045):
        turned(p, [(.034, y), (.037, y + .003), (.034, y + .006)],
               ['skin', 'accent'], 'accent')
    p.box((.040, .011, .025), (.038, .012, .015), 'eye', corner=.003)


# Each held grip follows +Y through the origin. The working face points along +Z.
# Only the 32 mm grip crosses the palm between Y = -55 mm and Y = +55 mm.
def grip(p):
    turned(p, [(.020, -.072), (.020, -.060), (.016, -.056),
               (.016, .056), (.021, .061), (.021, .070)],
           ['metal', 'accent', 'secondary', 'skin', 'metal'], 'secondary', 6)


def held_cyberpunk_pocket_beacon(p):
    grip(p)
    turned(p, [(.023, .070), (.049, .088), (.042, .098), (.039, .151),
               (.047, .156), (.038, .167)], ['primary', 'hair', 'skin', 'accent', 'metal'],
           'primary', 6)
    p.box((0, .124, .036), (.030, .035, .013), 'eye')


def held_cyberpunk_flux_fork(p):
    grip(p)
    p.box((0, .080, .018), (.100, .025, .078), 'primary', corner=.009)
    for x in (-.038, .038):
        p.box((x, .082, .100), (.022, .020, .110), 'metal')
        p.box((x, .082, .151), (.025, .024, .026), 'hair')
        p.box((x, .082, .168), (.017, .016, .012), 'eye')


def held_cyberpunk_receipt_roller(p):
    grip(p)
    p.box((0, .080, .005), (.101, .020, .035), 'primary')
    for x in (-.046, .046):
        p.box((x, .080, .044), (.010, .016, .085), 'hair')
    p.prism((-.045, .080, .080), (.045, .080, .080), .028, .028, 8, 'primary')
    p.prism((-.025, .080, .080), (-.009, .080, .080), .030, .030, 8, 'eye')


def prop_pickup_cyberpunk_flux_fork(p):
    # The rear edge of the head and the grip collar support the fork.
    with p.placed(Matrix.Translation((0, .021, 0)) @ Matrix.Rotation(-pi / 2, 4, 'X')):
        held_cyberpunk_flux_fork(p)


def prop_pickup_cyberpunk_pocket_beacon(p):
    with p.placed(Matrix.Translation((0, .072, 0))):
        held_cyberpunk_pocket_beacon(p)


def prop_pickup_cyberpunk_receipt_roller(p):
    # The outer yoke rests on its side.
    with p.placed(Matrix.Translation((0, .051, 0)) @ Matrix.Rotation(pi / 2, 4, 'Z')):
        held_cyberpunk_receipt_roller(p)


COLLECTIBLE_PROPS = [
    (prop_pickup_cyberpunk_koi_pin, 'Koi Enamel Pin'),
    (prop_pickup_cyberpunk_steam_bun, 'Cultured Steam Bun'),
    (prop_pickup_cyberpunk_broth_cell, 'Broth Cell'),
    (prop_pickup_cyberpunk_transfer_credit, 'Court Transfer Credit'),
    (prop_pickup_cyberpunk_gate_fob, 'East Gate Fob'),
    (prop_pickup_cyberpunk_memory_wafer, 'Memory Wafer'),
    (prop_pickup_cyberpunk_service_spool, 'Service Wire Spool'),
    (prop_pickup_cyberpunk_pocket_beacon, 'Pocket Beacon'),
    (prop_pickup_cyberpunk_flux_fork, 'Flux Test Fork'),
    (prop_pickup_cyberpunk_receipt_roller, 'Receipt Roller'),
]

COLLECTIBLE_HELD = [
    (held_cyberpunk_pocket_beacon, 'Pocket Beacon', 'hand_l'),
    (held_cyberpunk_flux_fork, 'Flux Test Fork', 'hand_r'),
    (held_cyberpunk_receipt_roller, 'Receipt Roller', 'hand_r'),
]
