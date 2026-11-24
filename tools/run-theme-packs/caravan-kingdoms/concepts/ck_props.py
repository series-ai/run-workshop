"""Caravan Kingdoms: parametric proportions for people and animals (exploration).

person_p(role, pr) and camel_p / horse_p / yak_p / ox_p(pr) rebuild the round-2
boxy minis from a proportion dict, so a variant is just different numbers. All
keys are multipliers on the round-2 baseline (1.0 everywhere = the current look).
The existing builders in ck_units.py are untouched until a direction is picked."""
from ck_units import *  # noqa: F401,F403

PEOPLE_KEYS = dict(head=1.0, torso_l=1.0, torso_w=1.0, shoulder=1.0, base=1.0, leg=1.0, leg_w=1.0,
                   arm=1.0, hand=1.0, foot=1.0, hat=1.0)
ANIMAL_KEYS = dict(head=1.0, neck=1.0, leg=1.0, leg_w=1.0, body_l=1.0, body_d=1.0, body_w=1.0, hump=1.0, hoof=1.0)


def _p(pr, keys):
    d = dict(keys)
    d.update(pr or {})
    return d


def label(pr):
    """Row label: the numbers that differ from baseline."""
    if not pr:
        return "all 1.0×"
    names = {"torso_l": "torso", "torso_w": "width", "leg_w": "leg thick", "body_l": "body len", "body_d": "body depth", "body_w": "body width"}
    return " · ".join(f"{names.get(k, k)} {v:g}×" for k, v in pr.items())

# ---------------------------------------------------------------- people


def person_p(role="merchant", pr=None, robe=None, seated=False):
    k = _p(pr, PEOPLE_KEYS)
    robe = robe or ROBES[role]
    dk = tuple(c * 0.68 for c in robe)
    TW = k["torso_w"]
    L = 0.045 * k["leg"]
    Wb = 0.085 * TW * k["base"]
    Ws = 0.12 * TW * k["shoulder"]
    D = 0.07 * TW
    T = 0.085 * k["torso_l"]
    lx = 0.022 * TW * min(k["base"], 1.3)
    z0 = 0.0
    if not seated:
        for sx in (-1, 1):
            fw, fd = 0.032 * k["foot"], 0.046 * k["foot"]
            box((fw, fd, 0.016), (sx * max(lx, fw * 0.55), -0.006 * k["foot"], 0.008), DARK, bevel=0.003)
            box((0.028 * k["leg_w"], 0.032 * k["leg_w"], L), (sx * lx, 0, L / 2), DARK)
        z0 = L
    if role == "envoy" and not seated:  # long robe hides the legs
        frustum(Wb * 1.15, D * 1.1, Wb, D, 0.0, z0, robe)
    frustum(Wb, D, Ws, D * 1.05, 0.0, T, robe, (0, 0, z0))
    box((Ws + 0.012, D + 0.012, 0.025), (0, 0, z0 + T), dk, bevel=0.006)
    box((Wb * 1.04 + (Ws - Wb) * 0.35, D * 1.03, 0.014), (0, 0, z0 + T * 0.35), dk)
    A = 0.062 * k["arm"]
    ax = Ws / 2 + 0.016
    for sx in (-1, 1):
        box((0.026, 0.034, A), (sx * ax, -0.004, z0 + T + 0.006 - A / 2), robe, bevel=0.004)
        hs = k["hand"]
        box((0.024 * hs, 0.028 * hs, 0.022 * hs), (sx * ax, -0.01, z0 + T + 0.006 - A - 0.009 * hs), SKIN, bevel=0.003)
    Hs = 0.06 * k["head"]
    hz = z0 + T + 0.014 + Hs / 2
    box((Hs, Hs * 0.97, Hs * 1.03), (0, 0, hz), SKIN, bevel=0.008 * k["head"])
    slit(0, -Hs * 0.485, hz + 0.004 * k["head"], 0.034 * k["head"])
    top = hz + Hs * 0.515
    stand = top  # figure height before the hat
    with at((0, 0, top), s=k["head"] * k["hat"]):
        if role == "merchant":
            cyl(0.046, 0.075, (0, 0, -0.012), C(240, 224, 184), n=6)
            cyl(0.048, 0.016, (0, 0, 0.01), OCHRE, n=6)
            box((0.014, 0.008, 0.02), (0, -0.046, 0.03), RED)
        elif role == "scout":
            frustum(0.07, 0.068, 0.0, 0.0, -0.012, 0.118, C(70, 120, 76), (0, 0.01, 0))
        elif role == "guard":
            cyl(0.04, 0.05, (0, 0, -0.016), GREY_L, n=6, r2=0.032, metal=0.3, rough=0.5)
            cone(0.012, 0.07, (0, 0, 0.034), GREY_L, n=4)
        elif role == "envoy":
            box((0.05, 0.05, 0.13), (0, 0.006, 0.05), INK)
            box((0.15, 0.014, 0.014), (0, 0.016, 0.09), INK)
        elif role == "rider":
            cyl(0.04, 0.075, (0, 0, -0.014), C(150, 100, 60), n=6, r2=0.044)
            cyl(0.046, 0.022, (0, 0, -0.014), C(96, 66, 44), n=6)
    hand_z = z0 + T + 0.006 - A - 0.009 * k["hand"]
    pole = min(0.44, max(0.3, stand * 1.7))
    if role == "merchant":
        box((Ws * 0.75, D * 0.85, T * 1.15), (0, D / 2 + 0.03, z0 + T * 0.6), C(170, 116, 66), bevel=0.008)
        box((Ws * 0.78, D * 0.9, 0.014), (0, D / 2 + 0.03, z0 + T * 0.8), C(120, 80, 50))
        cyl(0.008, pole, (ax + 0.012, -0.03, 0.0), WOOD, n=5)
        pennant((ax + 0.012, -0.03, pole), 0.08, 0.05)
    elif role == "scout":
        box((Ws, 0.03, T * 1.4), (0, D / 2 + 0.01, z0 + T * 0.6), C(56, 96, 60))
        box((0.04, 0.03, 0.1), (0.035, D / 2 + 0.025, z0 + T), WOOD_D, ry=-15)
        pennant((0.05, D / 2 + 0.025, z0 + T + 0.08), 0.06, 0.04)
        with at((-0.02, D / 2 + 0.035, z0 + T * 0.9), rx=90):
            torus(0.075 * max(1.0, k["torso_l"]), 0.009, (0, 0, 0), WOOD_D, n=10, k=4, arc=150, rz=15)
    elif role == "guard":
        box((Ws + 0.05, D + 0.02, 0.03), (0, 0, z0 + T + 0.005), GREY_L, bevel=0.006, metal=0.3, rough=0.5)
        spear = min(0.46, max(0.38, stand * 2.0))
        cyl(0.009, spear, (ax + 0.016, -0.02, 0.0), WOOD, n=5)
        cone(0.02, 0.07, (ax + 0.016, -0.02, spear), GREY_L, n=4)
        pennant((ax + 0.016, -0.02, spear - 0.02), 0.1, 0.06)
        sh = max(T * 1.5, 0.11)
        with at((-(ax + 0.012), -0.03, max(sh / 2, hand_z + sh * 0.3)), rz=20):
            box((0.02, 0.085 * TW, sh), (0, 0, 0), C(120, 84, 56), bevel=0.006)
            tbox((0.024, 0.03, sh), (0, 0, 0))
    elif role == "envoy":
        box((0.03, 0.06, 0.03), (ax, -0.05, hand_z + 0.02), CREAM)
        st = min(0.48, max(0.38, stand * 1.9))
        with at((-(ax + 0.02), 0.02, 0)):
            cyl(0.009, st, (0, 0, 0), WOOD_D, n=5)
            box((0.11, 0.012, 0.012), (0, 0, st - 0.02), WOOD_D)
            tm(slab([(-0.05, 0), (0, 0.025), (0.05, 0), (0.05, 0.16), (-0.05, 0.16)], 0.012, (0, -0.012, st - 0.19), team()))

# ---------------------------------------------------------------- animals


def _hooves_legs(xs, ys, h, w, hoof, rgb):
    for x in xs:
        for y in ys:
            box((w, w, h), (x, y, h / 2), rgb, bevel=w * 0.15)
            box((w * 1.15 * hoof, w * 1.2 * hoof, 0.02 * hoof), (x, y, 0.01 * hoof), tuple(c * 0.55 for c in rgb))


def camel_p(bactrian=True, pr=None, cargo=None, flagged=True):
    k = _p(pr, ANIMAL_KEYS)
    col = CAMEL_B if bactrian else CAMEL
    dark = tuple(c * 0.75 for c in col)
    LEG = 0.14 * k["leg"]
    BL, BD, BW = 0.26 * k["body_l"], 0.1 * k["body_d"], 0.11 * k["body_w"]
    lw = 0.032 * k["leg_w"]
    _hooves_legs((-BW * 0.36, BW * 0.36), (-(BL / 2 - 0.045), BL / 2 - 0.045), LEG, lw, k["hoof"], col)
    zb = LEG + BD / 2 - 0.01
    box((BW, BL, BD), (0, 0, zb), col, bevel=0.02)
    yf = -BL / 2
    NL = 0.12 * k["neck"]
    box((0.06, 0.1, 0.05), (0, yf - 0.03, zb + 0.01), col, bevel=0.012, rx=20)
    box((0.055, 0.05, NL + 0.04), (0, yf - 0.08, zb + 0.03 + NL / 2), col, bevel=0.012)
    hh = k["head"]
    hc = (0, yf - 0.08 - 0.035 * hh, zb + 0.03 + NL + 0.01 * hh)
    box((0.06 * hh, 0.11 * hh, 0.055 * hh), hc, col, bevel=0.012 * hh)
    box((0.064 * hh, 0.03 * hh, 0.03 * hh), (0, hc[1] - 0.045 * hh, hc[2] - 0.015 * hh), dark)
    slit(0, hc[1] - 0.055 * hh, hc[2] + 0.015 * hh, 0.05 * hh)
    for sx in (-1, 1):
        box((0.014 * hh, 0.02 * hh, 0.03 * hh), (sx * 0.03 * hh, hc[1] + 0.03 * hh, hc[2] + 0.04 * hh), dark)
    box((0.02, 0.025, 0.08), (0, BL / 2 + 0.005, zb - 0.01), dark, rx=15)
    hp = k["hump"]
    top = zb + BD / 2 - 0.01
    if bactrian:
        for y in (-0.065 * k["body_l"], 0.07 * k["body_l"]):
            frustum(0.1 * hp * min(1.2, k["body_w"]), 0.09 * hp, 0.045 * hp, 0.04 * hp, 0.0, 0.13 * hp, col, (0, y, top))
            box((0.05 * hp, 0.045 * hp, 0.03 * hp), (0, y, top + 0.14 * hp), dark)
        box((0.07, 0.07, 0.07), (0, yf - 0.03, zb + 0.04), dark)
        snap = (0, 0.0, top + 0.08 * hp)
        box((BW + 0.04, 0.06, 0.012), (0, 0.0, top + 0.005), RED)
    else:
        frustum(0.11 * hp, 0.13 * hp, 0.05 * hp, 0.06 * hp, 0.0, 0.15 * hp, col, (0, 0.0, top))
        snap = (0, 0.0, top + 0.165 * hp)
        box((0.16 * hp, 0.09 * hp, 0.012), (0, 0.0, top + 0.135 * hp), RED)
    if cargo:
        with at(snap, s=1.3):
            load(cargo)
    if flagged:
        cyl(0.007, 0.26, (0.0, BL / 2 - 0.02, snap[2] - 0.05), WOOD_D, n=5)
        pennant((0.0, BL / 2 - 0.02, snap[2] + 0.21), 0.09, 0.055, rz=-90)


def horse_p(pr=None, col=C(150, 96, 60), mane=DARK, rider=None, rider_pr=None):
    k = _p(pr, ANIMAL_KEYS)
    LEG = 0.13 * k["leg"]
    BL, BD, BW = 0.2 * k["body_l"], 0.085 * k["body_d"], 0.09 * k["body_w"]
    _hooves_legs((-BW * 0.36, BW * 0.36), (-(BL / 2 - 0.025), BL / 2 - 0.025), LEG, 0.028 * k["leg_w"], k["hoof"], col)
    zb = LEG + BD / 2 - 0.005
    box((BW, BL, BD), (0, 0, zb), col, bevel=0.018)
    NL = 0.13 * k["neck"]
    a = math.radians(28)
    base = (0, -BL / 2 + 0.03, zb + 0.02)
    tip = (0, base[1] - NL * math.sin(a), base[2] + NL * math.cos(a))
    box((0.055, 0.06, NL), (0, (base[1] + tip[1]) / 2, (base[2] + tip[2]) / 2), col, bevel=0.012, rx=-28)
    box((0.02, 0.06, NL * 0.8), (0, (base[1] + tip[1]) / 2 + 0.025, (base[2] + tip[2]) / 2 + 0.01), mane, rx=-28)
    hh = k["head"]
    hc = (0, tip[1] - 0.035 * hh, tip[2] + 0.01 * hh)
    box((0.05 * hh, 0.11 * hh, 0.05 * hh), hc, col, bevel=0.012 * hh, rx=12)
    slit(0, hc[1] - 0.05 * hh, hc[2] + 0.012 * hh, 0.044 * hh)
    for sx in (-1, 1):
        box((0.012 * hh, 0.016 * hh, 0.035 * hh), (sx * 0.018 * hh, hc[1] + 0.03 * hh, hc[2] + 0.04 * hh), col)
    box((0.025, 0.03, 0.11), (0, BL / 2 + 0.01, zb - 0.02), mane, rx=20)
    if rider:
        top = zb + BD / 2
        box((BW + 0.04, 0.1, 0.014), (0, 0.01, top + 0.002), RED)
        tbox((BW + 0.045, 0.04, 0.016), (0, 0.01, top - 0.015))
        with at((0, 0.02, top - 0.015)):
            person_p("rider", rider_pr, seated=True)
        L = max(0.5, top * 2.0)
        cyl(0.008, L, (0.085, -0.02, top - 0.08), WOOD, n=5, rx=10)
        tipz = top - 0.08 + L * math.cos(math.radians(10))
        tipy = -0.02 - L * math.sin(math.radians(10))
        cone(0.016, 0.05, (0.085, tipy, tipz), GREY_L, n=4, rx=10)
        pennant((0.085, tipy + 0.008, tipz - 0.03), 0.1, 0.06)


def yak_p(pr=None):
    k = _p(pr, ANIMAL_KEYS)
    col, dk = C(76, 58, 50), C(52, 40, 36)
    LEG = 0.08 * k["leg"]
    BL, BD, BW = 0.26 * k["body_l"], 0.13 * k["body_d"], 0.15 * k["body_w"]
    _hooves_legs((-BW / 3, BW / 3), (-(BL / 2 - 0.05), BL / 2 - 0.05), LEG, 0.036 * k["leg_w"], k["hoof"], dk)
    zb = LEG + BD / 2 + 0.035
    box((BW, BL, BD), (0, 0, zb), col, bevel=0.02)
    hp = k["hump"]
    frustum(0.12 * hp, 0.1 * hp, 0.08 * hp, 0.07 * hp, 0.0, 0.06 * hp, col, (0, -BL * 0.27, zb + BD / 2 - 0.005))
    frustum(BW + 0.02, BL + 0.01, BW, BL - 0.01, 0.0, zb - LEG * 0.5 - 0.0, dk, (0, 0, LEG * 0.5))  # hair skirt
    NL = 0.02 * k["neck"]
    hh = k["head"]
    hc = (0, -BL / 2 - 0.035 - NL - 0.01 * hh, zb - 0.0)
    if NL > 0.025:
        box((0.07, NL + 0.02, 0.07), (0, -BL / 2 - NL / 2, zb + 0.005), col, bevel=0.01)
    box((0.09 * hh, 0.08 * hh, 0.08 * hh), hc, col, bevel=0.014 * hh)
    box((0.08 * hh, 0.02 * hh, 0.04 * hh), (0, hc[1] - 0.045 * hh, hc[2] - 0.015 * hh), C(220, 210, 200))
    slit(0, hc[1] - 0.041 * hh, hc[2] + 0.02 * hh, 0.05 * hh)
    for sx in (-1, 1):
        tube([(sx * 0.04 * hh, hc[1], hc[2] + 0.035 * hh), (sx * 0.095 * hh, hc[1], hc[2] + 0.045 * hh), (sx * 0.1 * hh, hc[1] - 0.01, hc[2] + 0.1 * hh)],
             lambda t: 0.017 * hh * (1 - 0.5 * t), CREAM, rings=3, n=4)
    box((0.03, 0.035, 0.09), (0, BL / 2 + 0.01, zb - 0.01), C(236, 232, 226), rx=15)
    with at((0, 0.03, zb + BD / 2 + 0.055)):
        load("tea", s=1.1)
    cyl(0.007, 0.22, (0.0, BL / 2 - 0.01, zb + BD / 2 + 0.02), WOOD_D, n=5)
    pennant((0.0, BL / 2 - 0.01, zb + BD / 2 + 0.24), 0.09, 0.055, rz=-90)


def ox_p(pr=None, col=C(200, 172, 140)):
    k = _p(pr, ANIMAL_KEYS)
    LEG = 0.09 * k["leg"]
    BL, BD, BW = 0.22 * k["body_l"], 0.1 * k["body_d"], 0.12 * k["body_w"]
    _hooves_legs((-BW * 0.35, BW * 0.35), (-(BL / 2 - 0.04), BL / 2 - 0.04), LEG, 0.034 * k["leg_w"], k["hoof"], col)
    zb = LEG + BD / 2 + 0.01
    box((BW, BL, BD), (0, 0, zb), col, bevel=0.02)
    hp = k["hump"]
    frustum(0.11 * hp, 0.09 * hp, 0.07 * hp, 0.06 * hp, 0.0, 0.05 * hp, col, (0, -BL * 0.23, zb + BD / 2 - 0.005))
    NL = 0.03 * k["neck"]
    hh = k["head"]
    hc = (0, -BL / 2 - 0.02 - NL * 0.6 - 0.01 * hh, zb + 0.02 + NL * 0.5)
    box((0.06, NL + 0.03, 0.06), (0, -BL / 2 - NL / 2, zb + 0.015 + NL * 0.25), col, bevel=0.01)
    box((0.07 * hh, 0.07 * hh, 0.07 * hh), hc, col, bevel=0.012 * hh)
    box((0.06 * hh, 0.02 * hh, 0.04 * hh), (0, hc[1] - 0.038 * hh, hc[2] - 0.015 * hh), C(230, 196, 176))
    slit(0, hc[1] - 0.035 * hh, hc[2] + 0.02 * hh, 0.046 * hh)
    for sx in (-1, 1):
        tube([(sx * 0.035 * hh, hc[1], hc[2] + 0.03 * hh), (sx * 0.085 * hh, hc[1], hc[2] + 0.04 * hh), (sx * 0.09 * hh, hc[1] - 0.01, hc[2] + 0.09 * hh)],
             lambda t: 0.014 * hh * (1 - 0.5 * t), CREAM, rings=3, n=4)
    box((0.016, 0.02, 0.08), (0, BL / 2 + 0.005, zb - 0.02), col, rx=12)
    cyl(0.007, 0.22, (0.0, BL / 2 - 0.02, zb + BD / 2), WOOD_D, n=5)
    pennant((0.0, BL / 2 - 0.02, zb + BD / 2 + 0.22), 0.09, 0.055, rz=-90)

# ---------------------------------------------------------------- variants

PEOPLE_VARIANTS = [
    ("Baseline (round 2)", {}),
    ("Super-deformed", dict(head=1.6, leg=0.5, torso_l=0.8, hat=1.1)),
    ("Heroic", dict(head=0.7, leg=2.2, torso_l=1.3, shoulder=1.15)),
    ("Strongman", dict(hand=2.2, arm=1.2, shoulder=1.25)),
    ("Tiny hands", dict(hand=0.45)),
    ("Long arms", dict(arm=2.4, leg=1.2)),
    ("Stocky", dict(torso_w=1.35, torso_l=0.85, leg=0.6, foot=1.5, head=1.1)),
    ("Lanky", dict(torso_w=0.7, torso_l=1.3, leg=1.9, leg_w=0.7, arm=1.4, head=0.85)),
    ("Giant feet", dict(foot=2.2)),
    ("Top-heavy", dict(shoulder=1.5, torso_w=1.2, base=0.7, leg=1.4, leg_w=0.6, arm=1.2)),
    ("Pear", dict(shoulder=0.75, base=1.6, torso_l=1.1, head=0.9)),
    ("Chess piece", dict(base=1.5, leg=0.35, foot=0.6, head=1.25, arm=0.8, hand=0.8)),
    ("Hat-first", dict(hat=1.8, head=1.15, leg=0.8)),
]

ANIMAL_VARIANTS = [  # (name, animal dict, matching rider proportions)
    ("Baseline (round 2)", {}, {}),
    ("Long legs", dict(leg=1.6), dict(PEOPLE_VARIANTS[2][1])),
    ("Stubby legs", dict(leg=0.5, hoof=1.2), dict(PEOPLE_VARIANTS[6][1])),
    ("Big head", dict(head=1.7), dict(PEOPLE_VARIANTS[1][1])),
    ("Tiny head", dict(head=0.6), dict(PEOPLE_VARIANTS[2][1])),
    ("Long neck", dict(neck=1.9), {}),
    ("Huge humps", dict(hump=1.8), {}),
    ("Barrel body", dict(body_d=1.5, body_w=1.4, leg=0.75, hoof=1.3, leg_w=1.3), dict(PEOPLE_VARIANTS[6][1])),
    ("Giraffe", dict(leg=1.7, neck=2.6, head=0.85, body_l=0.85), dict(PEOPLE_VARIANTS[7][1])),
    ("Toy block", dict(body_l=0.8, body_d=1.3, head=1.4, leg=0.7, hump=1.3, leg_w=1.3), dict(PEOPLE_VARIANTS[1][1])),
]
