"""District bays on a two-metre grid. Each storey has a 2.80 m pitch."""

from props_cyber_district import box, exchange_stamp, grille, inset, rod, window_strip
from polykit import Z


def prop_exchange_portal(p):
    # The display case and the narrow jamb leave a 2.16 m entrance.
    box(p, (-1.10, 0.46, 0), (1.40, 0.92, 0.28), 'primary')
    for x in (-1.73, -0.47, 1.72):
        box(p, (x, 1.29, 0), (0.16, 2.58, 0.28), 'secondary')
    box(p, (-1.10, 0.95, 0.04), (1.40, 0.06, 0.36), 'metal')
    box(p, (0, 2.42, 0), (3.60, 0.36, 0.28), 'primary')
    inset(p, -1.06, 2.42, 0.14, 1.30, 0.29, 'hair', seal=0.022)
    exchange_stamp(p, -1.06, 2.42, 0.164, 0.23)
    for x in (0.03, 0.31, 0.59):
        box(p, (x, 2.39, 0.145), (0.18, 0.035, 0.02), 'accent')


def prop_rollup_portal(p):
    for x in (-1.69, 1.69):
        box(p, (x, 1.30, 0), (0.22, 2.60, 0.34), 'secondary')
        box(p, (x, 0.51, 0.17), (0.13, 0.30, 0.025), 'accent')
    box(p, (0, 2.45, 0), (3.56, 0.30, 0.28), 'primary')
    p.prism((-1.62, 2.38, 0), (1.62, 2.38, 0), 0.19, 0.19, 10, 'metal')
    for y in (2.17, 2.225, 2.28):
        box(p, (0, y, 0.12), (3.16, 0.055, 0.05), 'primary')


def prop_foundry_corner(p):
    # Fit two returns inside a 2 x 2 m footprint.
    box(p, (0, 0.60, -0.90), (2, 1.20, 0.20), 'primary')
    box(p, (0, 2.40, -0.90), (2, 0.40, 0.20), 'secondary')
    for x in (-0.90, 0.90):
        box(p, (x, 1.70, -0.90), (0.20, 1, 0.20), 'primary')
    box(p, (0, 1.70, -0.90), (1.60, 1, 0.07), 'hair')
    for normal in (-Z, Z):
        window_strip(p, 0, -0.90 + normal.z * 0.035, 1.70, 1.58, 0.94, normal, 3)
    box(p, (-0.90, 1.30, 0.10), (0.20, 2.60, 1.80), 'secondary')
    for y in (0.44, 0.65):
        rod(p, (-0.75, y, 0.98), (-0.75, y, -0.74), 0.036, 'metal')
        rod(p, (-0.75, y, -0.74), (0.98, y, -0.74), 0.036, 'metal')
    for z in (-0.53, 0.67):
        box(p, (-0.77, 0.54, z), (0.06, 0.36, 0.08), 'primary')


def prop_clerestory_wall(p):
    box(p, (0, 0.75, 0), (2, 1.50, 0.20), 'primary')
    for x in (-0.94, 0, 0.94):
        box(p, (x, 1.96, 0), (0.12, 0.92, 0.20), 'secondary')
    box(p, (0, 2.51, 0), (2, 0.18, 0.20), 'secondary')
    for x in (-0.47, 0.47):
        box(p, (x, 1.98, 0), (0.82, 0.06, 0.12), 'metal')


def prop_service_roof(p):
    # The flat top carries traffic. The ribs stay below the walking surface.
    for x in (-1.89, 0, 1.89):
        box(p, (x, 0.065, 0), (0.16, 0.13, 2), 'secondary')
    box(p, (0, 0.13, 0), (4, 0.12, 2), 'primary')
    for x in (-1.5, -0.5, 0.5, 1.5):
        box(p, (x, 0.195, 0), (0.99, 0.01, 1.97), 'metal')


def prop_gantry_flight(p):
    # Eight 175 mm rises with a 300 mm going.
    for step in range(8):
        top = (step + 1) * 0.175
        z = 1.05 - step * 0.30
        box(p, (0, top - 0.065, z), (1.80, 0.13, 0.30), 'primary')
        box(p, (0, top - 0.018, z + 0.134), (1.61, 0.036, 0.032), 'metal')
    for x in (-0.85, 0.85):
        box(p, (x, 0.03, 1.07), (0.10, 0.06, 0.22), 'secondary')
        for step in (0, 4, 7):
            z = 1.05 - step * 0.30
            box(p, (x, (step + 1) * 0.175 + 0.46, z), (0.07, 0.92, 0.07), 'metal')
        for h, r in ((0.11, 0.066), (0.61, 0.022), (1.10, 0.044)):
            rod(p, (x, h, 1.05), (x, h + 1.225, -1.05), r, 'secondary' if h < 1 else 'metal')


def landing_frame(p, height):
    underside = height - 0.16
    for x in (-0.87, 0.87):
        for z in (-0.87, 0.87):
            box(p, (x, underside / 2, z), (0.16, underside, 0.16), 'secondary')
            box(p, (x, 0.05, z), (0.26, 0.10, 0.26), 'metal')
        rod(p, (x, underside - 0.79, -0.87), (x, underside, -0.08), 0.044, 'metal')
        rod(p, (x, underside - 0.79, 0.87), (x, underside, 0.08), 0.044, 'metal')
    box(p, (0, height - 0.08, 0), (2, 0.16, 2), 'primary')


def prop_gantry_landing(p):
    landing_frame(p, 1.4)


def prop_gantry_overpass(p):
    landing_frame(p, 2.8)


def prop_service_guard(p):
    for x in (-0.92, 0.92):
        box(p, (x, 0.51, 0), (0.075, 1.02, 0.08), 'secondary')
        box(p, (x, 0.04, 0), (0.15, 0.08, 0.16), 'metal')
    for y, h in ((0.16, 0.15), (0.56, 0.055), (1.02, 0.08)):
        box(p, (0, y, 0), (2, h, 0.07), 'primary' if y < 1 else 'metal')


def prop_service_meter(p):
    box(p, (0, 0.055, 0), (0.46, 0.11, 0.38), 'secondary')
    for x in (-0.13, 0.13):
        rod(p, (x, 0.10, 0), (x, 0.64, 0), 0.044, 'metal')
    box(p, (0, 0.80, 0), (0.52, 0.52, 0.33), 'primary', corner=0.035)
    inset(p, -0.08, 0.89, 0.165, 0.25, 0.16, 'hair', seal=0.025)
    grille(p, 0, 0.69, 0.17, 0.30, 0.14, 2)
    box(p, (0.15, 0.90, 0.18), (0.055, 0.085, 0.03), 'eye')


KIT_PROPS = [
    (prop_exchange_portal, 'Exchange Display Entrance'),
    (prop_rollup_portal, 'Raised Workshop Shutter'),
    (prop_foundry_corner, 'Foundry Return with Pipe Elbows'),
    (prop_clerestory_wall, 'Open Clerestory Bay'),
    (prop_service_roof, 'Removable Service Deck Panel'),
    (prop_gantry_flight, 'Eight-Tread Gantry Flight'),
    (prop_gantry_landing, 'Braced Stair Landing'),
    (prop_gantry_overpass, 'Raised Access Landing'),
    (prop_service_guard, 'Service Deck Guardrail'),
    (prop_service_meter, 'Twin Conduit Meter'),
]
