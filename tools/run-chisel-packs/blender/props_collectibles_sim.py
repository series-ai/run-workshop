"""Small rewards and tools for the market street and park."""

from math import cos, pi, sin, tau

from mathutils import Matrix
from polykit import V, X, Y, Z


def _loyalty_stamp(p):
    p.box((0, -0.058, 0), (0.091, 0.016, 0.060), 'secondary', corner=0.005)
    p.box((0, -0.044, 0), (0.094, 0.014, 0.063), 'primary', corner=0.006)
    p.lathe([(0.024, -0.037), (0.015, -0.021), (0.016, 0.012),
             (0.031, 0.029), (0.031, 0.044), (0.017, 0.050)],
            8, 'primary', cap_end=True, band_regions=['metal', 'primary', 'primary', 'accent', 'accent'])


def held_sim_loyalty_stamp(p):
    with p.placed(Matrix.Translation(V(-0.014, 0, 0.015)) @ Matrix.Rotation(pi / 2, 4, 'Y')):
        _loyalty_stamp(p)


def prop_pickup_sim_loyalty_stamp(p):
    with p.placed(Matrix.Translation(Y * 0.066)):
        _loyalty_stamp(p)


def _watering_can(p):
    # The rear grip leads to the tank. The rose points along +Z.
    p.tube([V(-0.050, -0.057, 0.107), V(0, -0.053, 0.015), V(0, -0.030, 0),
            V(0, 0.031, 0), V(0, 0.057, 0.014), V(-0.050, 0.056, 0.108)],
           [0.012] * 6, 5, 'metal', up=X)
    p.lathe([(0.068, -0.090), (0.082, -0.080), (0.081, 0.050),
             (0.065, 0.071), (0.039, 0.071), (0.035, 0.053)],
            8, 'eye', center=(-0.084, 0, 0.140), cap_start=True, cap_end=True,
            band_regions=['secondary', 'eye', 'hair', 'metal', 'secondary'])
    p.prism((-0.084, -0.048, 0.194), (-0.084, 0.085, 0.327), 0.034, 0.014, 6, 'eye', up=X)
    p.prism((-0.084, 0.077, 0.319), (-0.084, 0.098, 0.340), 0.014, 0.033, 8, 'metal', up=X)


def held_sim_watering_can(p):
    with p.placed(Matrix.Translation(V(-0.013, 0, 0))):
        _watering_can(p)


def prop_pickup_sim_watering_can(p):
    with p.placed(Matrix.Translation(Y * 0.090) @ Matrix.Rotation(-pi / 2, 4, 'Y')):
        _watering_can(p)


def _pocket_camera(p):
    # The left hand closes on the vertical end grip. The lens faces +Z.
    p.box((0, 0, -0.022), (0.032, 0.076, 0.089), 'secondary', corner=0.005)
    p.box((0.067, 0, 0), (0.113, 0.072, 0.043), 'primary', corner=0.005)
    p.box((0.067, 0.029, 0), (0.114, 0.015, 0.045), 'metal')
    p.prism((0.066, -0.004, 0.020), (0.066, -0.004, 0.043), 0.032, 0.027, 8, 'secondary')
    p.prism((0.066, -0.004, 0.042), (0.066, -0.004, 0.046), 0.020, 0.017, 8, 'eye')
    p.box((0.093, 0.043, -0.004), (0.031, 0.014, 0.026), 'secondary')
    p.box((0.093, 0.043, 0.010), (0.018, 0.009, 0.004), 'skin')


def held_sim_pocket_camera(p):
    with p.placed(Matrix.Translation(V(0.012, 0, 0.060))):
        _pocket_camera(p)


def prop_pickup_sim_pocket_camera(p):
    with p.placed(Matrix.Translation(Y * 0.038)):
        _pocket_camera(p)


def prop_pickup_sim_bread_sleeve(p):
    p.box((0, 0.081, 0), (0.138, 0.162, 0.085), 'skin', taper=(1.13, 1.12), corner=0.010)
    for x, h in ((-0.031, 0.260), (0.031, 0.307)):
        p.lathe([(0.027, 0.145), (0.031, h - 0.047), (0.026, h - 0.014), (0.013, h)],
                8, 'primary', center=(x, 0, 0), cap_end=True)
        for y in (h - 0.059, h - 0.092):
            p.plate((x, y, 0.028), Z, V(0.42, 1, 0), 0.030, 0.006, 0.002, 'skin')
    p.plate((0, 0.101, 0.0465), Z, Y, 0.060, 0.034, 0.003, 'accent', corner=0.006)


def prop_pickup_sim_pear_punnet(p):
    p.box((0, 0.038, 0), (0.184, 0.076, 0.136), 'primary', taper=1.19, corner=0.012)
    p.box((0, 0.073, 0), (0.223, 0.018, 0.164), 'skin', corner=0.012)
    for x, z, h in ((-0.050, 0.025, 0.167), (0.049, 0.012, 0.161), (-0.012, -0.032, 0.180)):
        p.lathe([(0.031, 0.078), (0.044, 0.104), (0.041, 0.125),
                 (0.023, h - 0.018), (0.013, h)], 7, 'hair', center=(x, 0, z), cap_end=True)
        p.prism((x, h - 0.003, z), (x + 0.005, h + 0.016, z), 0.005, 0.003, 5, 'secondary', up=Z)


def prop_pickup_sim_transit_fare(p):
    for x, z, y in ((-0.006, -0.006, 0), (0.014, 0.006, 0.005)):
        p.lathe([(0.027, y), (0.027, y + 0.004), (0.024, y + 0.005)], 12,
                'metal', center=(x, 0, z), cap_start=True, cap_end=True)
    # A raised bus with two wheels marks the top token.
    p.box((0.014, 0.0108, 0.006), (0.036, 0.002, 0.021), 'accent', corner=0.003)
    for x in (0.004, 0.024):
        p.lathe([(0.004, 0.010), (0.004, 0.012)], 8, 'secondary', center=(x, 0, 0.016), cap_end=True)
    for x in (0.003, 0.014, 0.025):
        p.box((x, 0.0121, 0.003), (0.008, 0.001, 0.006), 'skin')


def prop_pickup_sim_market_voucher(p):
    p.box((0, 0.004, 0), (0.158, 0.008, 0.074), 'skin', corner=0.005)
    p.box((-0.061, 0.006, 0), (0.033, 0.012, 0.076), 'eye')
    p.plate((0.005, 0.008, 0), Y, Z, 0.086, 0.052, 0.001, 'primary', corner=0.009)
    # The printed shop has a striped canopy over a dark counter.
    p.box((0.005, 0.010, 0.003), (0.042, 0.002, 0.021), 'secondary')
    for i in range(5):
        p.box((-0.017 + i * 0.011, 0.011, -0.009), (0.011, 0.002, 0.015),
              'skin' if i % 2 else 'accent')
    for z in (-0.023, -0.009, 0.006, 0.021):
        p.box((0.058, 0.0085, z), (0.002, 0.001, 0.007), 'secondary')


def prop_pickup_sim_shop_key(p):
    # The bow is a closed loop with a clear opening.
    rings = []
    for i in range(9):
        radial = V(cos(i * tau / 8), 0, sin(i * tau / 8))
        center = V(-0.033, 0.006, 0) + radial * 0.025
        rings.append([center + v * 0.006 for v in (radial, Y, -radial, -Y)])
    p.loft(rings, 'primary')
    p.box((0.018, 0.005, 0), (0.062, 0.010, 0.012), 'metal')
    for x, length in ((0.028, 0.015), (0.044, 0.022)):
        p.box((x, 0.005, length / 2), (0.010, 0.010, length), 'metal')


def prop_pickup_sim_park_cup(p):
    p.box((0, 0.016, 0), (0.113, 0.032, 0.091), 'secondary', taper=0.89, corner=0.009)
    p.plate((0, 0.017, 0.044), Z, Y, 0.053, 0.015, 0.002, 'skin')
    p.lathe([(0.042, 0.032), (0.015, 0.054), (0.014, 0.088), (0.047, 0.111),
             (0.063, 0.177), (0.056, 0.177), (0.040, 0.126)], 10, 'metal',
            band_regions=['primary', 'metal', 'metal', 'metal', 'skin', 'secondary'], cap_end=True)
    for sign in (-1, 1):
        path = [V(sign * x, y, 0) for x, y in ((0.053, 0.161), (0.085, 0.164),
                                                (0.081, 0.134), (0.044, 0.107))]
        p.tube(path, [0.0065] * 4, 5, 'primary', up=Z)


def prop_pickup_sim_shuttlecock(p):
    p.lathe([(0.009, 0), (0.014, 0.006), (0.014, 0.021), (0.013, 0.025)],
            10, 'primary', cap_start=True, cap_end=True, band_regions=['primary', 'primary', 'accent'])
    for i in range(10):
        radial = V(cos(i * tau / 10), 0, sin(i * tau / 10))
        tangent = radial.cross(Y)
        outline = [radial * radius + tangent * width + Y * y for radius, width, y in
                   ((0.010, 0, 0.023), (0.025, -0.006, 0.050), (0.033, -0.008, 0.071),
                    (0.035, 0, 0.077), (0.033, 0.008, 0.071), (0.024, 0.005, 0.047))]
        p.slab(outline, 0.0015, 'skin', normal=radial, back=True)


COLLECTIBLE_PROPS = [
    (prop_pickup_sim_bread_sleeve, 'Bakery Bread Sleeve'),
    (prop_pickup_sim_loyalty_stamp, 'Café Loyalty Stamp'),
    (prop_pickup_sim_pear_punnet, 'Market Pear Punnet'),
    (prop_pickup_sim_market_voucher, 'Market Voucher Book'),
    (prop_pickup_sim_shop_key, 'Shop Door Key'),
    (prop_pickup_sim_transit_fare, 'Bus Fare Tokens'),
    (prop_pickup_sim_park_cup, 'Park Doubles Cup'),
    (prop_pickup_sim_shuttlecock, 'Park Shuttlecock'),
    (prop_pickup_sim_watering_can, 'Window Box Watering Can'),
    (prop_pickup_sim_pocket_camera, 'Pocket Camera'),
]

COLLECTIBLE_HELD = [
    (held_sim_loyalty_stamp, 'Café Loyalty Stamp', 'hand_r'),
    (held_sim_watering_can, 'Window Box Watering Can', 'hand_r'),
    (held_sim_pocket_camera, 'Pocket Camera', 'hand_l'),
]
