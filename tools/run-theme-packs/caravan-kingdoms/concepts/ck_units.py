"""Caravan Kingdoms: units (wargame-mini people, pack animals, carts, boats), swappable
cargo loads and trade-good resource icons. Units stand at z = 0 facing -y.

Shape language (v2): boxes and prisms over spheres, broad shoulders, tall hats,
long spears, big cargo blocks. No smiles or blush; at most a dark eye slit.
Every unit carries a team-colour pennant or stripe (material slot "team")."""
from ck_city import *  # noqa: F401,F403
from ck_base import _bm_obj  # noqa: F401

UNIT_S = 1.7  # units placed on map tiles (single units); trains use 1.1
TURN = 25  # people turn toward +x so they read from the 3/4 camera
SIDE = 62  # animals, carts and boats turn further, so their profile reads


def frustum(w0, d0, w1, d1, z0, z1, rgb, loc=(0, 0, 0), **m):
    """A box that tapers from w0 x d0 at z0 to w1 x d1 at z1 (centred on loc)."""
    x, y, z = loc
    lo = [(x - w0 / 2, y - d0 / 2), (x + w0 / 2, y - d0 / 2), (x + w0 / 2, y + d0 / 2), (x - w0 / 2, y + d0 / 2)]
    hi = [(x - w1 / 2, y - d1 / 2), (x + w1 / 2, y - d1 / 2), (x + w1 / 2, y + d1 / 2), (x - w1 / 2, y + d1 / 2)]
    return prism(lo, z + z0, z + z1, rgb, top=hi, **m)


def slit(x, y, z, w=0.034):
    """The only face detail: a dark brow/eye slit."""
    box((w, 0.006, 0.008), (x, y - 0.003, z), INK)

# ---------------------------------------------------------------- people


ROBES = {"merchant": C(206, 96, 48), "scout": C(70, 120, 76), "guard": C(150, 44, 44),
         "envoy": C(40, 64, 150), "rider": C(150, 44, 44), "poler": C(130, 98, 70)}


def person(role="merchant", robe=None, s=1.0, seated=False):
    """Boxy mini: block legs, a robe that flares into broad shoulders, a cube head
    with an eye slit, and a tall role hat. About 0.3 tall with the hat."""
    robe = robe or ROBES[role]
    dk = tuple(c * 0.68 for c in robe)
    with at((0, 0, 0), s=s):
        z0 = 0.0
        if not seated:
            for sx in (-1, 1):
                box((0.03, 0.04, 0.045), (sx * 0.022, 0, 0.0225), DARK)
            z0 = 0.04
        if role == "envoy" and not seated:  # long robe to the ground
            frustum(0.1, 0.08, 0.1, 0.07, -0.04, 0.0, robe, (0, 0, z0))
        frustum(0.085, 0.07, 0.12, 0.075, 0.0, 0.085, robe, (0, 0, z0))  # robe -> broad shoulders
        box((0.13, 0.08, 0.025), (0, 0, z0 + 0.085), dk, bevel=0.006)  # shoulder yoke
        box((0.088, 0.072, 0.014), (0, 0, z0 + 0.03), dk)  # belt
        for sx in (-1, 1):
            box((0.026, 0.034, 0.06), (sx * 0.074, -0.004, z0 + 0.05), robe, bevel=0.004)
            box((0.022, 0.026, 0.02), (sx * 0.074, -0.01, z0 + 0.012), SKIN)
        hz = z0 + 0.13
        box((0.06, 0.058, 0.062), (0, 0, hz), SKIN, bevel=0.008)
        slit(0, -0.029, hz + 0.004)
        top = hz + 0.031
        if role == "merchant":
            cyl(0.046, 0.075, (0, 0, top - 0.012), C(240, 224, 184), n=6)  # tall turban
            cyl(0.048, 0.016, (0, 0, top + 0.01), OCHRE, n=6)
            box((0.014, 0.008, 0.02), (0, -0.046, top + 0.03), RED)
            box((0.09, 0.06, 0.1), (0, 0.065, z0 + 0.07), C(170, 116, 66), bevel=0.008)  # big pack block
            box((0.094, 0.064, 0.014), (0, 0.065, z0 + 0.09), C(120, 80, 50))
            cyl(0.008, 0.34, (0.09, -0.03, 0.0), WOOD, n=5)
            pennant((0.09, -0.03, 0.34), 0.08, 0.05)
        elif role == "scout":
            frustum(0.07, 0.068, 0.0, 0.0, 0.0, 0.13, C(70, 120, 76), (0, 0.01, top - 0.012))  # tall hood
            box((0.12, 0.03, 0.12), (0, 0.045, z0 + 0.06), C(56, 96, 60))  # cloak slab
            box((0.04, 0.03, 0.1), (0.035, 0.06, z0 + 0.09), WOOD_D, ry=-15)  # quiver
            pennant((0.05, 0.06, z0 + 0.17), 0.06, 0.04)
            with at((-0.02, 0.07, z0 + 0.08), rx=90):  # bow slung on the back
                torus(0.075, 0.009, (0, 0, 0), WOOD_D, n=10, k=4, arc=150, rz=15)
        elif role == "guard":
            cyl(0.04, 0.05, (0, 0, top - 0.016), GREY_L, n=6, r2=0.032, metal=0.3, rough=0.5)  # tall helmet
            cone(0.012, 0.07, (0, 0, top + 0.034), GREY_L, n=4)
            box((0.17, 0.09, 0.03), (0, 0, z0 + 0.09), GREY_L, bevel=0.006, metal=0.3, rough=0.5)  # pauldrons
            cyl(0.009, 0.5, (0.09, -0.02, 0.0), WOOD, n=5)  # long spear
            cone(0.02, 0.07, (0.09, -0.02, 0.5), GREY_L, n=4)
            pennant((0.09, -0.02, 0.48), 0.1, 0.06)
            with at((-0.085, -0.03, z0 + 0.06), rz=20):  # tower shield
                box((0.02, 0.085, 0.13), (0, 0, 0), C(120, 84, 56), bevel=0.006)
                tbox((0.024, 0.03, 0.13), (0, 0, 0))
        elif role == "envoy":
            box((0.05, 0.05, 0.13), (0, 0.006, top + 0.05), INK)  # very tall hat
            box((0.15, 0.014, 0.014), (0, 0.016, top + 0.09), INK)  # wings
            box((0.03, 0.06, 0.03), (0.07, -0.05, z0 + 0.06), CREAM)  # scroll case
            with at((-0.09, 0.02, 0)):  # team standard
                cyl(0.009, 0.46, (0, 0, 0), WOOD_D, n=5)
                box((0.11, 0.012, 0.012), (0, 0, 0.44), WOOD_D)
                tm(slab([(-0.05, 0), (0, 0.025), (0.05, 0), (0.05, 0.16), (-0.05, 0.16)], 0.012, (0, -0.012, 0.27), team()))
        elif role == "rider":
            cyl(0.04, 0.075, (0, 0, top - 0.014), C(150, 100, 60), n=6, r2=0.044)  # tall fur hat
            cyl(0.046, 0.022, (0, 0, top - 0.014), C(96, 66, 44), n=6)
        elif role == "poler":
            cone(0.1, 0.05, (0, 0, top - 0.006), C(220, 196, 128), n=6)


def unit_person(role):
    def f():
        with at((0, 0, 0), rz=TURN):
            person(role)
    return f

# ---------------------------------------------------------------- cargo loads (snap: saddle point)


def load(kind, s=1.0):
    """Cargo at the saddle snap point: two big side blocks plus a top block."""
    with at((0, 0, 0), s=s):
        if kind == "silk":
            cols = (RED, PLUM, GOLD, TURQ)
            for i, sx in enumerate((-1, 1)):
                for j in range(2):
                    box((0.06, 0.15, 0.05), (sx * 0.085, 0, -0.05 + j * 0.054), cols[(i + j) % 4], bevel=0.012)
                    box((0.062, 0.03, 0.052), (sx * 0.085, 0, -0.05 + j * 0.054), CREAM)
            box((0.16, 0.08, 0.05), (0, 0, 0.04), cols[2], bevel=0.012)
            box((0.03, 0.082, 0.052), (0, 0, 0.04), CREAM)
        elif kind == "spice":
            cols = (C(200, 60, 40), C(232, 180, 50), C(196, 120, 50), C(140, 90, 50))
            for i, sx in enumerate((-1, 1)):
                for j, y in enumerate((-0.04, 0.04)):
                    frustum(0.06, 0.07, 0.05, 0.06, -0.08, 0.0, C(214, 190, 140), (sx * 0.085, y, 0))
                    frustum(0.05, 0.06, 0.0, 0.0, 0.0, 0.035, cols[(i * 2 + j) % 4], (sx * 0.085, y, 0))
            frustum(0.1, 0.1, 0.08, 0.08, 0.0, 0.06, C(196, 170, 120), (0, 0, 0))
            frustum(0.08, 0.08, 0.0, 0.0, 0.06, 0.1, cols[0], (0, 0, 0))
        elif kind == "tea":
            for sx in (-1, 1):
                for j in range(3):
                    box((0.06, 0.12, 0.036), (sx * 0.085, 0, -0.06 + j * 0.039), C(110, 70, 46) if j % 2 else C(86, 54, 38), bevel=0.004)
                box((0.064, 0.014, 0.12), (sx * 0.085, 0, -0.02), C(230, 210, 160))
            box((0.15, 0.1, 0.045), (0, 0, 0.04), C(110, 70, 46), bevel=0.004)
            box((0.154, 0.014, 0.049), (0, 0, 0.04), C(230, 210, 160))
        elif kind == "ceramics":
            for sx in (-1, 1):
                box((0.07, 0.13, 0.08), (sx * 0.085, 0, -0.04), WOOD, bevel=0.006)
                box((0.072, 0.132, 0.012), (sx * 0.085, 0, -0.005), C(230, 200, 120))
                for y in (-0.035, 0.035):
                    cyl(0.02, 0.035, (sx * 0.085, y, -0.005), CREAM, n=6, r2=0.014)
                    cyl(0.021, 0.01, (sx * 0.085, y, 0.01), LAPIS, n=6)
            cyl(0.045, 0.1, (0, 0, 0.0), CREAM, n=6, r2=0.03)
            cyl(0.046, 0.022, (0, 0, 0.035), LAPIS, n=6)
            cyl(0.022, 0.025, (0, 0, 0.1), CREAM, n=6)


LOADS = ["silk", "spice", "tea", "ceramics"]

# ---------------------------------------------------------------- animals (boxy)


def legs4(xs, ys, h, w, rgb):
    for x in xs:
        for y in ys:
            box((w, w, h), (x, y, h / 2), rgb, bevel=w * 0.15)
            box((w * 1.15, w * 1.2, 0.02), (x, y, 0.01), tuple(c * 0.55 for c in rgb))


def camel(bactrian=True, cargo=None, flagged=True):
    col = CAMEL_B if bactrian else CAMEL
    dark = tuple(c * 0.75 for c in col)
    legs4((-0.04, 0.04), (-0.085, 0.085), 0.14, 0.032, col)
    box((0.11, 0.26, 0.1), (0, 0, 0.18), col, bevel=0.02)  # body block
    # neck: a low forward block then a raised one, head block
    box((0.06, 0.1, 0.05), (0, -0.16, 0.19), col, bevel=0.012, rx=20)
    box((0.055, 0.05, 0.12), (0, -0.21, 0.26), col, bevel=0.012, rx=-12)
    box((0.06, 0.11, 0.055), (0, -0.245, 0.33), col, bevel=0.012)
    box((0.064, 0.03, 0.03), (0, -0.29, 0.315), dark)
    slit(0, -0.3, 0.345, 0.05)
    for sx in (-1, 1):
        box((0.014, 0.02, 0.03), (sx * 0.03, -0.215, 0.37), dark)
    box((0.02, 0.025, 0.08), (0, 0.135, 0.17), dark, rx=15)  # tail
    if bactrian:
        for y in (-0.065, 0.07):
            frustum(0.1, 0.09, 0.045, 0.04, 0.0, 0.13, col, (0, y, 0.22))  # giant humps
            box((0.05, 0.045, 0.03), (0, y, 0.36), dark)  # shaggy tops
        box((0.07, 0.07, 0.07), (0, -0.16, 0.22), dark)  # neck fur
        snap = (0, 0.0, 0.3)
        box((0.15, 0.06, 0.012), (0, 0.0, 0.235), RED)
    else:
        frustum(0.11, 0.13, 0.05, 0.06, 0.0, 0.15, col, (0, 0.0, 0.22))
        snap = (0, 0.0, 0.385)
        box((0.16, 0.09, 0.012), (0, 0.0, 0.355), RED)
    if cargo:
        with at(snap, s=1.3):
            load(cargo)
    if flagged:
        cyl(0.007, 0.26, (0.0, 0.11, snap[2] - 0.05), WOOD_D, n=5)
        pennant((0.0, 0.11, snap[2] + 0.21), 0.09, 0.055, rz=-90)


def unit_camel(bactrian=True, cargo=None):
    def f():
        with at((0, 0, 0), rz=SIDE):
            camel(bactrian, cargo)
    return f


def rope(a, b):
    tube([a, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, min(a[2], b[2]) - 0.04), b], lambda t: 0.007, C(200, 170, 110), rings=5, n=4)


def camel_train(n, cargo_cycle=LOADS):
    """A lead merchant on foot, then n camels nose-to-tail; only the lead camel flies the pennant."""
    with at((0, 0, 0), rz=SIDE):
        with at((0, -0.4, 0)):
            person("merchant")
        prev = (0.09, -0.42, 0.1)
        for i in range(n):
            y = i * 0.42
            x = 0.07 * math.sin(i * 0.9)
            with at((x, y, 0)):
                camel(i % 2 == 0, cargo_cycle[i % len(cargo_cycle)], flagged=(i == 0))
            rope(prev, (x, y - 0.3, 0.31))
            prev = (x, y + 0.14, 0.2)


def horse(col=C(150, 96, 60), mane=DARK, s=1.0):
    with at((0, 0, 0), s=s):
        legs4((-0.032, 0.032), (-0.075, 0.075), 0.13, 0.028, col)
        box((0.09, 0.2, 0.085), (0, 0, 0.17), col, bevel=0.018)
        box((0.055, 0.06, 0.13), (0, -0.11, 0.25), col, bevel=0.012, rx=-28)
        box((0.05, 0.11, 0.05), (0, -0.16, 0.31), col, bevel=0.012, rx=12)
        slit(0, -0.205, 0.32, 0.044)
        for sx in (-1, 1):
            box((0.012, 0.016, 0.035), (sx * 0.018, -0.13, 0.35), col)
        box((0.02, 0.09, 0.03), (0, -0.1, 0.32), mane, rx=-30)
        box((0.025, 0.03, 0.11), (0, 0.11, 0.15), mane, rx=20)


def horse_rider():
    with at((0, 0, 0), rz=SIDE):
        horse()
        box((0.13, 0.1, 0.014), (0, 0.01, 0.217), RED)
        tbox((0.135, 0.04, 0.016), (0, 0.01, 0.2))
        with at((0, 0.02, 0.2)):
            person("rider", seated=True)
        cyl(0.008, 0.5, (0.085, -0.02, 0.12), WOOD, n=5, rx=10)  # lance
        cone(0.016, 0.05, (0.085, -0.107, 0.612), GREY_L, n=4, rx=10)
        pennant((0.085, -0.1, 0.58), 0.1, 0.06)


def yak():
    with at((0, 0, 0), rz=SIDE):
        col, dk = C(76, 58, 50), C(52, 40, 36)
        legs4((-0.05, 0.05), (-0.08, 0.08), 0.08, 0.036, dk)
        box((0.15, 0.26, 0.13), (0, 0, 0.18), col, bevel=0.02)
        frustum(0.12, 0.1, 0.08, 0.07, 0.0, 0.06, col, (0, -0.07, 0.245))  # shoulder hump
        frustum(0.17, 0.27, 0.15, 0.25, 0.04, 0.14, dk, (0, 0, 0))  # hair skirt
        box((0.09, 0.08, 0.08), (0, -0.165, 0.18), col, bevel=0.014)
        box((0.08, 0.02, 0.04), (0, -0.21, 0.165), C(220, 210, 200))
        slit(0, -0.206, 0.2, 0.05)
        for sx in (-1, 1):
            tube([(sx * 0.04, -0.17, 0.215), (sx * 0.095, -0.17, 0.225), (sx * 0.1, -0.18, 0.28)], lambda t: 0.017 * (1 - 0.5 * t), CREAM, rings=3, n=4)
        box((0.03, 0.035, 0.09), (0, 0.14, 0.17), C(236, 232, 226), rx=15)
        with at((0, 0.03, 0.3)):
            load("tea", s=1.1)
        cyl(0.007, 0.22, (0.0, 0.12, 0.27), WOOD_D, n=5)
        pennant((0.0, 0.12, 0.49), 0.09, 0.055, rz=-90)


def ox(col=C(200, 172, 140)):
    legs4((-0.042, 0.042), (-0.07, 0.07), 0.09, 0.034, col)
    box((0.12, 0.22, 0.1), (0, 0, 0.15), col, bevel=0.02)
    frustum(0.11, 0.09, 0.07, 0.06, 0.0, 0.05, col, (0, -0.05, 0.2))
    box((0.07, 0.07, 0.07), (0, -0.14, 0.17), col, bevel=0.012)
    box((0.06, 0.02, 0.04), (0, -0.178, 0.155), C(230, 196, 176))
    slit(0, -0.175, 0.19, 0.046)
    for sx in (-1, 1):
        tube([(sx * 0.035, -0.14, 0.2), (sx * 0.085, -0.14, 0.21), (sx * 0.09, -0.15, 0.26)], lambda t: 0.014 * (1 - 0.5 * t), CREAM, rings=3, n=4)
    box((0.016, 0.02, 0.08), (0, 0.115, 0.13), col, rx=12)


def ox_cart(cargo="silk"):
    with at((0, 0, 0), rz=SIDE):
        with at((0, -0.22, 0)):
            ox()
        box((0.14, 0.02, 0.02), (0, -0.15, 0.21), WOOD_D)
        for sx in (-1, 1):
            box((0.014, 0.28, 0.016), (sx * 0.055, -0.02, 0.16), WOOD, rx=8)
        with at((0, 0.13, 0)):
            box((0.18, 0.22, 0.03), (0, 0, 0.13), WOOD, bevel=0.005)
            for sx in (-1, 1):
                box((0.012, 0.22, 0.05), (sx * 0.09, 0, 0.165), WOOD_D)
                with at((sx * 0.105, 0, 0.09), ry=90):
                    cyl(0.085, 0.022, (0, 0, -0.011), WOOD_D, n=8)
                    cyl(0.03, 0.03, (0, 0, -0.015), WOOD, n=6)
            with at((0, 0, 0.22)):
                load(cargo, s=1.1)
            cyl(0.008, 0.3, (0.08, 0.1, 0.13), WOOD_D, n=5)
            pennant((0.08, 0.1, 0.43), 0.09, 0.055, rz=-90)

# ---------------------------------------------------------------- boats


def hull(L, w, h, rgb, bow=0.06, stern=0.04, stern_w=0.6, k=9, depth=0.03):
    rings = []
    for i in range(k):
        t = i / (k - 1)  # 0 = bow (-y), 1 = stern
        y = -L / 2 + t * L
        hw = w / 2 * max(0.04, min(1.0, math.sin(math.pi * min(t * 1.3, 1.0) * 0.5) if t < 0.75 else (1 - (t - 0.75) / 0.25 * (1 - stern_w))))
        deck = h + bow * (1 - t) ** 3 + stern * t ** 3
        rings.append([(-hw, y, deck), (-hw, y, h * 0.3), (-hw * 0.5, y, -depth), (hw * 0.5, y, -depth), (hw, y, h * 0.3), (hw, y, deck)])
    rings_mesh(rings, rgb)


def dhow():
    with at((0, 0, 0), rz=SIDE):
        hull(0.48, 0.22, 0.06, C(150, 100, 60), bow=0.1, stern=0.05)
        box((0.16, 0.26, 0.01), (0, 0.03, 0.064), C(196, 150, 96))
        tbox((0.21, 0.22, 0.02), (0, 0.04, 0.045))
        cyl(0.013, 0.38, (0, -0.06, 0.05), WOOD_D, n=6, rx=12)
        slab([(-0.0, 0.0), (0.27, 0.02), (0.02, 0.37)], 0.008, (0.0, -0.02, 0.1), C(246, 236, 210), rz=90)
        box((0.016, 0.5, 0.016), (0.0, -0.05, 0.3), WOOD_D, rx=-38)
        pennant((0.0, -0.13, 0.44), 0.09, 0.05, rz=-90)
        with at((0, 0.14, 0.06), s=0.8):
            person("merchant")
        for i, c in enumerate((RED, OCHRE)):
            box((0.05, 0.05, 0.05), (0.03 - i * 0.055, 0.05, 0.09), c, bevel=0.008)


def junk():
    with at((0, 0, 0), rz=SIDE):
        hull(0.46, 0.22, 0.07, C(130, 76, 50), bow=0.05, stern=0.1, stern_w=0.9)
        box((0.17, 0.12, 0.09), (0, 0.17, 0.085), C(160, 60, 44))
        box((0.18, 0.13, 0.014), (0, 0.17, 0.13), C(120, 76, 50))
        for i, (y, hh, ww) in enumerate(((-0.11, 0.24, 0.16), (0.03, 0.32, 0.2))):
            cyl(0.012, hh + 0.06, (0, y, 0.05), WOOD_D, n=6)
            with at((0.0, y + 0.012, 0.1)):
                slab([(-ww / 2, 0), (ww / 2, 0), (ww / 2 + 0.01, hh * 0.85), (-ww / 2 + 0.03, hh)], 0.008, (0, 0, 0), C(214, 120, 64), rz=90)
                for k in range(1, 5):
                    box((0.014, ww + 0.02, 0.008), (0, 0, hh * k / 5), WOOD_D)
            pennant((0, y, hh + 0.11), 0.08, 0.045, rz=-90)


def barge():
    with at((0, 0, 0), rz=SIDE):
        hull(0.4, 0.2, 0.04, WOOD, bow=0.02, stern=0.02, stern_w=0.85)
        with at((0, 0.03, 0.04)):
            box((0.13, 0.15, 0.012), (0, 0, 0.0), WOOD_D)
            slab([(-0.065, 0), (0.065, 0), (0.065, 0.05), (0.035, 0.075), (-0.035, 0.075), (-0.065, 0.05)], 0.14, (0, 0, 0.0), C(214, 186, 120), rz=90)
            tbox((0.134, 0.144, 0.016), (0, 0, 0.06), rz=0)
        with at((0, -0.14, 0.04), s=0.85):
            person("poler")
        cyl(0.009, 0.4, (0.08, -0.16, -0.05), WOOD_D, n=5, ry=-14)
        for i, c in enumerate((OCHRE, C(140, 90, 50))):
            box((0.05, 0.05, 0.05), (0.03 - i * 0.055, 0.16, 0.065), c, bevel=0.008)

# ---------------------------------------------------------------- trade goods (resource icons on a plinth)


def plinth(rgb=C(206, 186, 150), ring=GOLD):
    cyl(0.17, 0.03, (0, 0, 0), rgb, n=10)
    cyl(0.172, 0.012, (0, 0, 0.012), ring, n=10)
    return 0.03


def g_silk():
    z = plinth()
    for i, (x, zz, c) in enumerate(((-0.06, 0, RED), (0.06, 0, PLUM), (0.0, 0.07, GOLD))):
        cyl(0.04, 0.2, (x, -0.1, z + 0.04 + zz), c, n=8, rx=-90)
        cyl(0.015, 0.205, (x, -0.1025, z + 0.04 + zz), CREAM, n=6, rx=-90)
    quad([(-0.1, -0.1, z + 0.002), (0.02, -0.1, z + 0.002), (0.05, -0.16, z + 0.002), (-0.08, -0.16, z + 0.002)], RED)


def g_spice():
    z = plinth()
    for i, (x, y, c) in enumerate(((-0.07, 0.04, C(200, 60, 40)), (0.07, 0.04, C(232, 180, 50)), (0.0, -0.07, C(196, 120, 50)))):
        lathe([(0.045, 0), (0.055, 0.04), (0.05, 0.08), (0.056, 0.095)], (x, y, z), C(214, 190, 140), n=8)
        lathe([(0.05, 0), (0.0, 0.045)], (x, y, z + 0.085), c, n=7)


def g_tea():
    z = plinth()
    for j in range(3):
        box((0.16, 0.11, 0.035), (0, 0, z + 0.0175 + j * 0.037), C(98, 62, 42) if j % 2 else C(120, 78, 50), bevel=0.006, rz=j * 8)
    cyl(0.03, 0.006, (0, 0, z + 0.111), C(170, 120, 70), n=8, rz=16)
    with at((0.09, -0.1, z)):
        lathe([(0.02, 0), (0.03, 0.025), (0.032, 0.035)], (0, 0, 0), CREAM, n=8)
        cyl(0.028, 0.006, (0, 0, 0.03), C(130, 90, 40), n=8)


def g_porcelain():
    z = plinth()
    lathe([(0.035, 0), (0.06, 0.05), (0.055, 0.1), (0.028, 0.14), (0.022, 0.16), (0.03, 0.18)], (-0.02, 0.02, z), CREAM, n=12, rough=0.3)
    cyl(0.061, 0.025, (-0.02, 0.02, z + 0.05), LAPIS, n=12)
    cyl(0.03, 0.012, (-0.02, 0.02, z + 0.15), LAPIS, n=12)
    lathe([(0.02, 0), (0.05, 0.03), (0.052, 0.035), (0.04, 0.035)], (0.08, -0.08, z), CREAM, n=10, rough=0.3)
    cyl(0.051, 0.008, (0.08, -0.08, z + 0.02), LAPIS, n=10)


def g_jade():
    z = plinth()
    torus(0.06, 0.025, (-0.02, 0.03, z + 0.09), JADE, n=12, k=6, rx=90, rough=0.3)
    cyl(0.03, 0.03, (-0.02, 0.04, z), C(170, 130, 90), n=6)
    rock((0.08, -0.07, z), 0.07, C(110, 190, 140), rz=20, n=6)


def g_gems():
    z = plinth()
    for (x, y, h, c, t) in ((0, 0, 0.16, C(220, 50, 80), 0), (0.06, -0.04, 0.11, C(60, 120, 230), 20), (-0.06, -0.03, 0.1, C(80, 200, 120), -20), (0.0, -0.08, 0.07, C(160, 80, 220), 10)):
        with at((x, y, z), ry=t):
            cyl(0.03, h * 0.7, (0, 0, 0), c, n=6, rough=0.15)
            cone(0.03, h * 0.3, (0, 0, h * 0.7), c, n=6, rough=0.15)
    rock((0.07, 0.06, z), 0.05, ROCK, rz=10)


def g_glass():
    z = plinth()
    lathe([(0.04, 0), (0.05, 0.05), (0.035, 0.09), (0.012, 0.12), (0.012, 0.17), (0.02, 0.18)], (-0.03, 0.03, z), C(60, 190, 190), n=10, rough=0.1)
    lathe([(0.03, 0), (0.035, 0.05), (0.01, 0.08), (0.01, 0.11)], (0.06, 0.03, z), C(90, 160, 230), n=10, rough=0.1)
    lathe([(0.025, 0), (0.06, 0.04), (0.065, 0.045), (0.055, 0.045)], (0.03, -0.08, z), C(110, 210, 160), n=10, rough=0.1)


def g_paper():
    z = plinth()
    for j in range(5):
        box((0.16, 0.12, 0.012), (-0.01, 0.0, z + 0.006 + j * 0.013), CREAM if j % 2 else C(248, 242, 226), rz=j * 5 - 8)
    cyl(0.022, 0.18, (0.02, -0.1, z + 0.022), C(240, 226, 196), n=8, ry=90, rz=15)
    for sx in (-1, 1):
        cyl(0.026, 0.012, (0.02 + sx * 0.09 * math.cos(math.radians(15)), -0.1 + sx * 0.09 * math.sin(math.radians(15)), z + 0.022), RED, n=8, ry=90, rz=15)


def g_salt():
    z = plinth(C(196, 186, 176), C(150, 160, 190))
    for j in range(3):
        box((0.16, 0.08, 0.035), (-0.02, 0.04, z + 0.0175 + j * 0.036), SALT if j % 2 else C(236, 228, 220), bevel=0.006)
    cone(0.07, 0.08, (0.06, -0.08, z), C(252, 252, 250), n=7)


def g_incense():
    z = plinth()
    lathe([(0.03, 0), (0.05, 0.03), (0.055, 0.04), (0.045, 0.04)], (-0.05, -0.04, z), C(170, 120, 70), n=10)
    for k in range(5):
        ell((-0.05 + 0.02 * math.cos(k * 1.3), -0.04 + 0.02 * math.sin(k * 1.3), z + 0.04), 0.015, C(232, 170, 60), seg=6, ring=4, rough=0.3)
    with at((0.06, 0.05, z)):
        cyl(0.02, 0.03, (0, 0, 0), C(200, 150, 70), n=8, metal=0.4, rough=0.4)
        lathe([(0.04, 0.03), (0.04, 0.06), (0.025, 0.08), (0, 0.1)], (0, 0, 0), C(210, 160, 70), n=8, metal=0.4, rough=0.4)
        for i, (dx, dz, r) in enumerate(((0.0, 0.13, 0.025), (0.02, 0.17, 0.02), (0.0, 0.205, 0.015))):
            ell((dx, 0, dz), r, C(236, 232, 240), seg=6, ring=4)


def g_horses():
    z = plinth()
    with at((0, 0, z), rz=SIDE, s=0.95):
        horse(C(214, 160, 100), CREAM)


def g_coins():
    z = plinth()
    for (x, y, k) in ((-0.05, 0.03, 5), (0.04, 0.05, 3), (0.06, -0.05, 2)):
        for j in range(k):
            cyl(0.04, 0.012, (x, y, z + j * 0.013), GOLD, n=10, metal=0.6, rough=0.35)
    for (x, y) in ((-0.08, -0.08), (-0.02, -0.11)):
        torus(0.022, 0.009, (x, y, z + 0.008), C(190, 120, 70), n=8, k=4, metal=0.4, rough=0.4)


def g_gold():
    z = plinth()
    bar = [(-0.04, -0.022), (0.04, -0.022), (0.04, 0.022), (-0.04, 0.022)]
    top = [(-0.03, -0.014), (0.03, -0.014), (0.03, 0.014), (-0.03, 0.014)]
    for (x, y, zz, r) in ((-0.045, 0.0, 0, 0), (0.045, 0.0, 0, 0), (0.0, 0.0, 0.03, 90), (-0.04, -0.07, 0, 20), (0.05, -0.08, 0, -15)):
        with at((x, y, z + zz), rz=r):
            prism(bar, 0, 0.03, GOLD, top=top, metal=0.6, rough=0.3)


GOODS = [("silk", g_silk), ("spice", g_spice), ("tea", g_tea), ("porcelain", g_porcelain), ("jade", g_jade), ("gems", g_gems),
         ("glass", g_glass), ("paper", g_paper), ("salt", g_salt), ("incense", g_incense), ("horses", g_horses), ("coins", g_coins), ("gold", g_gold)]
GOOD = dict(GOODS)
