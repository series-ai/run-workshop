"""Caravan Kingdoms: regional building styles, swappable city parts and growth stages.

Every style provides the same part set (the swap contract):
    house(0|1|2)   small / medium / large dwelling, footprint <= 0.22
    block()        a district block (~0.3 x 0.3) built from the style's houses
    landmark(0|1|2) town hall / city centrepiece / capital palace
    wall(L, h)     straight wall run along x, centred, thickness ~0.07
    tower(h)       wall corner tower
    gate(L, h)     replaces one wall run, opening faces -y (outward)
    tent()         camp shelter
Stage layouts (camp .. capital) only name slots, so any style drops into any layout.
"""
from ck_terrain import *  # noqa: F401,F403
from ck_base import _bm_obj  # noqa: F401

RW = 0.84  # wall ring radius (hex, same orientation as the tile)


def rings_mesh(rings, rgb, **m):
    """Skin a stack of equal-length vertex rings [[(x, y, z), ...], ...]; capped."""
    bm = bmesh.new()
    vs = [[bm.verts.new(p) for p in r] for r in rings]
    n = len(rings[0])
    bm.faces.new(vs[0][::-1])
    bm.faces.new(vs[-1])
    for a, b in zip(vs, vs[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    return _bm_obj(bm, "rings", rgb, **m)


def hip_roof(p, w, d, h, rgb, lift=0.03, over=0.03, ridge=None, rz=0.0):
    """Chinese-style hip roof with swooping, upturned corners. Base at p."""
    with at(p, rz=rz):
        rings = []
        for f, z, cl in ((1.0, 0.0, lift), (0.92, h * 0.12, lift * 0.6), (0.7, h * 0.42, 0.0), (0.45, h * 0.78, 0.0)):
            W, D = (w / 2 + over) * f, (d / 2 + over) * f
            rings.append([(W, -D, z + cl), (0, -D, z), (-W, -D, z + cl), (-W, 0, z), (-W, D, z + cl), (0, D, z), (W, D, z + cl), (W, 0, z)])
        W, D = (w / 2) * 0.55, (d / 2) * 0.06
        rings.append([(W, -D, h), (0, -D, h), (-W, -D, h), (-W, 0, h), (-W, D, h), (0, D, h), (W, D, h), (W, 0, h)])
        rings_mesh(rings, rgb)
        rc = ridge or tuple(c * 0.72 for c in rgb)
        box((w * 0.6, 0.026, 0.022), (0, 0, h + 0.008), rc)
        for sx in (-1, 1):
            box((0.018, 0.03, 0.03), (sx * w * 0.3, 0, h + 0.022), rc, ry=-sx * 25)


def parapet(w, d, z, rgb, t=0.018, hh=0.025):
    for sx in (-1, 1):
        box((t, d, hh), (sx * (w / 2 - t / 2), 0, z + hh / 2), rgb)
    for sy in (-1, 1):
        box((w, t, hh), (0, sy * (d / 2 - t / 2), z + hh / 2), rgb)


def dome(p, r, rgb, kind="round", finial=GOLD, n=10):
    r *= 1.18  # puffy
    with at(p):
        if kind == "pointed":
            lathe([(r * 0.9, 0), (r * 1.12, r * 0.38), (r * 1.06, r * 0.8), (r * 0.62, r * 1.14), (r * 0.18, r * 1.32), (0, r * 1.38)], (0, 0, 0), rgb, n=max(n, 12))
            top = r * 1.38
        elif kind == "ribbed":
            lathe([(r * 0.92, 0), (r * 1.14, r * 0.4), (r * 1.04, r * 0.82), (r * 0.6, r * 1.1), (0, r * 1.22)], (0, 0, 0), rgb, n=16, lobes=12, lobe_depth=0.12)
            top = r * 1.2
        elif kind == "low":
            lathe([(r, 0), (r * 0.9, r * 0.35), (r * 0.55, r * 0.62), (0, r * 0.72)], (0, 0, 0), rgb, n=n)
            top = r * 0.72
        else:
            lathe([(r, 0), (r * 0.98, r * 0.42), (r * 0.72, r * 0.82), (r * 0.3, r * 1.0), (0, r * 1.03)], (0, 0, 0), rgb, n=max(n, 10))
            top = r * 0.98
        if finial:
            ell((0, 0, top + 0.012), 0.014, finial, seg=6, ring=4)
            cone(0.007, 0.035, (0, 0, top + 0.02), finial, n=4)


def door(x, y, z, w, h, rgb=DARK, pointed=False, round_=True, rz=0.0):
    if round_:
        arch((x, y - 0.004, z), w, h, rgb, pointed=pointed, rz=rz)
    else:
        box((w, 0.01, h), (x, y - 0.004, z + h / 2), rgb)


def merlons(L, z, rgb, k=None, s=0.03, t=0.07, round_=False):
    k = k or max(2, int(L / (s * 2)))
    for i in range(k):
        x = -L / 2 + (i + 0.5) * L / k
        if round_:
            lathe([(s * 0.55, 0), (s * 0.55, s * 0.5), (s * 0.3, s * 0.95), (0, s * 1.05)], (x, 0, z), rgb, n=6, sy=t / s / 1.1)
        else:
            box((s, t, s * 0.9), (x, 0, z + s * 0.45), rgb)


# =============================================================== styles

class Style:
    name = "base"
    ground = SAND
    plaza = C(220, 200, 160)
    terrain = "desert"

    def block(self):
        with at((0, 0, 0)):
            box((0.32, 0.3, 0.02), (0, 0, 0.01), self.plaza)
            with at((-0.06, 0.06, 0.02)):
                self.house(1)
            with at((0.1, 0.07, 0.02), rz=0):
                self.house(0)
            with at((0.04, -0.09, 0.02), rz=0):
                self.house(0, alt=True)


# --------------------------------------------------------------- Persian
class Persian(Style):
    name = "Persian"
    ground = C(240, 200, 130)
    plaza = C(226, 206, 168)
    terrain = "desert"
    WALL = C(234, 222, 198)  # white-cream plaster: Persian = white + turquoise + lapis + gold
    HOUSE = C(248, 242, 228)

    def windcatcher(self, p, h=0.12, s=1.0):
        h *= 1.5  # exaggerated tall wind-catchers
        with at(p, s=s):
            box((0.05, 0.05, h), (0, 0, h / 2), self.HOUSE)
            for a in (0, 90):
                for o in (-0.012, 0.012):
                    box((0.008, 0.056, 0.05), (o, 0, h - 0.035), DARK, rz=a)
            box((0.06, 0.06, 0.012), (0, 0, h + 0.006), self.WALL)

    def house(self, size, alt=False):
        if size == 0:
            w, d, h = 0.13, 0.12, 0.1 + 0.02 * alt
            box((w, d, h), (0, 0, h / 2), self.HOUSE, bevel=0.018)
            parapet(w, d, h, self.HOUSE)
            door(0.0, -d / 2, 0, 0.04, 0.065, TURQ if alt else DARK)
            if not alt:
                dome((0.0, 0.0, h), 0.04, self.HOUSE, "low", finial=None)
        elif size == 1:
            w, d, h = 0.19, 0.15, 0.14
            box((w, d, h), (0, 0, h / 2), self.HOUSE, bevel=0.018)
            parapet(w, d, h, self.HOUSE)
            door(-0.04, -d / 2, 0, 0.05, 0.085, DARK, pointed=True)
            box((0.08, 0.01, 0.018), (0.045, -d / 2 - 0.004, h - 0.03), TURQ)
            self.windcatcher((0.06, 0.03, h), 0.1)
        else:
            w, d, h = 0.22, 0.18, 0.17
            box((w, d, h), (0, 0, h / 2), self.HOUSE, bevel=0.018)
            parapet(w, d, h, self.HOUSE)
            box((0.1, 0.02, 0.15), (0, -d / 2 - 0.006, 0.075), self.WALL)
            door(0, -d / 2 - 0.012, 0.0, 0.06, 0.12, LAPIS, pointed=True)
            dome((0.03, 0.03, h), 0.06, TURQ, "pointed")
            self.windcatcher((-0.07, 0.05, h), 0.12)

    def iwan(self, w, h, d=0.06, frame=TURQ, inner=LAPIS):
        """A big portal block with a tall pointed arch recess (front at y = -d/2)."""
        box((w, d, h), (0, 0, h / 2), self.HOUSE)
        slab([(-w * 0.42, 0), (w * 0.42, 0), (w * 0.42, h * 0.92), (-w * 0.42, h * 0.92)], 0.01, (0, -d / 2 - 0.004, 0.0), frame)
        arch((0, -d / 2 - 0.009, 0.0), w * 0.62, h * 0.78, inner, pointed=True)
        arch((0, -d / 2 - 0.013, 0.0), w * 0.36, h * 0.4, DARK, pointed=True)
        box((w + 0.01, d + 0.01, 0.015), (0, 0, h + 0.007), self.WALL)

    def landmark(self, lv):
        if lv == 0:
            box((0.28, 0.24, 0.16), (0, 0, 0.08), self.HOUSE, bevel=0.01)
            parapet(0.28, 0.24, 0.16, self.HOUSE)
            with at((0, -0.12, 0)):
                self.iwan(0.16, 0.22, 0.05)
            cyl(0.075, 0.04, (0.0, 0.03, 0.16), self.HOUSE, n=10)
            dome((0.0, 0.03, 0.2), 0.075, TURQ, "pointed")
        elif lv == 1:
            box((0.4, 0.32, 0.18), (0, 0.02, 0.09), self.HOUSE, bevel=0.01)
            parapet(0.4, 0.32, 0.18, self.HOUSE)
            with at((0, -0.15, 0)):
                self.iwan(0.22, 0.32, 0.06)
            cyl(0.11, 0.07, (0, 0.06, 0.18), self.HOUSE, n=12)
            cyl(0.112, 0.02, (0, 0.06, 0.22), LAPIS, n=12)
            dome((0, 0.06, 0.25), 0.11, TURQ, "pointed", n=12)
            for x in (-0.15, 0.15):
                self.windcatcher((x, 0.1, 0.18), 0.12)
        else:
            # capital palace: raised terrace, garden pool, great iwan and dome
            box((0.62, 0.56, 0.05), (0, 0.02, 0.025), self.WALL, bevel=0.01)
            box((0.12, 0.34, 0.012), (0, -0.08, 0.05), TURQ)  # garden channel
            for y in (-0.2, -0.04):
                for x in (-0.12, 0.12):
                    poplar((x, y, 0.05), 0.6, C(70, 130, 70))
            with at((0, 0.12, 0.05)):
                box((0.56, 0.24, 0.2), (0, 0.04, 0.1), self.HOUSE, bevel=0.01)
                parapet(0.56, 0.24, 0.2, self.HOUSE)
                with at((0, -0.1, 0)):
                    self.iwan(0.24, 0.36, 0.07)
                cyl(0.12, 0.08, (0, 0.08, 0.2), self.HOUSE, n=12)
                cyl(0.122, 0.022, (0, 0.08, 0.25), LAPIS, n=12)
                dome((0, 0.08, 0.28), 0.12, TURQ, "pointed", n=12)
                for x in (-0.22, 0.22):
                    dome((x, 0.05, 0.2), 0.05, TURQ, "pointed")
                    self.windcatcher((x * 0.62, 0.12, 0.2), 0.12)

    def wall(self, L, h=0.13):
        box((L, 0.07, h), (0, 0, h / 2), self.WALL)
        box((L, 0.01, 0.015), (0, -0.036, h - 0.025), TURQ)
        merlons(L, h, self.WALL, round_=True, s=0.032)

    def tower(self, h=0.2):
        cyl(0.07, h, (0, 0, 0), self.WALL, n=8, r2=0.06)
        cyl(0.07, 0.03, (0, 0, h), self.WALL, n=8)
        cyl(0.071, 0.012, (0, 0, h - 0.04), TURQ, n=8)
        for x, y, z, a in ring_of(6, 0.055, h + 0.03):
            lathe([(0.016, 0), (0.016, 0.016), (0, 0.03)], (x, y, z), self.WALL, n=5)

    def gate(self, L, h=0.13):
        side = (L - 0.2) / 2
        for sx in (-1, 1):
            with at((sx * (0.1 + side / 2), 0, 0)):
                self.wall(side, h)
        with at((0, -0.01, 0)):
            self.iwan(0.2, h + 0.1, 0.1, frame=TURQ, inner=LAPIS)
        for sx in (-1, 1):
            with at((sx * 0.1, -0.01, 0)):
                self.tower(h + 0.08)

    def tent(self):
        # striped campaign pavilion (round, peaked)
        cyl(0.11, 0.08, (0, 0, 0), CREAM, n=10)
        for i in range(0, 10, 2):
            a = 36 * i + 18
            box((0.035, 0.008, 0.08), (0.112 * math.cos(math.radians(a)), 0.112 * math.sin(math.radians(a)), 0.04), RED, rz=a + 90)
        cone(0.13, 0.12, (0, 0, 0.08), CREAM, n=10)
        lathe([(0.131, 0.08), (0.131, 0.1), (0.11, 0.1)], (0, 0, 0), RED, n=10)
        cyl(0.005, 0.06, (0, 0, 0.19), WOOD_D, n=4)
        pennant((0, 0, 0.25), 0.06, 0.03)
        box((0.05, 0.01, 0.06), (0, -0.108, 0.03), DARK)


# --------------------------------------------------------------- Central Asian
class CentralAsian(Style):
    name = "Central Asian"
    ground = STEPPE
    plaza = C(232, 214, 176)
    terrain = "steppe"
    WALL = C(178, 98, 62)  # fired brick: Central Asian = warm brick + deep blue + turquoise + dark timber
    HOUSE = C(206, 132, 86)
    ROOF = C(120, 70, 48)

    def beams(self, w, y, z, k=4):
        for i in range(k):
            x = -w / 2 + (i + 0.5) * w / k
            cyl(0.008, 0.025, (x, y - 0.012, z), WOOD_D, n=5, rx=90)

    def aivan(self, w, d, h):
        """A shaded wooden porch: carved posts and a flat timber roof, front at -d."""
        for i in range(3):
            x = -w / 2 + 0.015 + i * (w - 0.03) / 2
            cyl(0.008, h, (x, -d, 0), WOOD, n=6)
            cyl(0.014, 0.012, (x, -d, h - 0.012), WOOD_D, n=6)
        box((w + 0.02, d + 0.02, 0.016), (0, -d / 2, h + 0.008), WOOD_D)

    def house(self, size, alt=False):
        if size == 0:
            w, d, h = 0.13, 0.12, 0.09
            box((w, d, h), (0, 0, h / 2), self.HOUSE, bevel=0.024)
            box((w + 0.008, d + 0.008, 0.014), (0, 0, h), self.ROOF, bevel=0.004)
            box((w + 0.002, 0.008, 0.014), (0, -d / 2 - 0.002, h - 0.032), LAPIS)
            self.beams(w, -d / 2, h - 0.02, 3)
            door(0.02 if alt else -0.02, -d / 2, 0, 0.035, 0.055, WOOD_D, round_=False)
        elif size == 1:
            w, d, h = 0.19, 0.15, 0.12
            box((w, d, h), (0, 0.02, h / 2), self.HOUSE, bevel=0.024)
            box((w + 0.008, d + 0.008, 0.014), (0, 0.02, h), self.ROOF, bevel=0.004)
            box((w + 0.002, 0.008, 0.014), (0, -d / 2 + 0.018, h - 0.032), TURQ)
            self.beams(w, -d / 2 + 0.02, h - 0.02, 4)
            with at((0, -0.055 + 0.02, 0)):
                self.aivan(w * 0.8, 0.05, 0.085)
            door(0.0, -d / 2 + 0.02, 0, 0.04, 0.06, TURQ, round_=False)
        else:
            w, d, h = 0.22, 0.18, 0.14
            box((w, d, h), (0, 0, h / 2), self.HOUSE, bevel=0.024)
            self.beams(w, -d / 2, h - 0.02, 5)
            box((0.09, 0.02, h + 0.04), (0.04, -d / 2 - 0.008, (h + 0.04) / 2), self.WALL)
            slab([(-0.03, 0), (0.03, 0), (0.03, 0.12), (-0.03, 0.12)], 0.01, (0.04, -d / 2 - 0.02, 0.02), LAPIS)
            arch((0.04, -d / 2 - 0.026, 0.0), 0.04, 0.1, DARK, pointed=True)
            cyl(0.055, 0.03, (-0.04, 0.03, h), self.HOUSE, n=12)
            dome((-0.04, 0.03, h + 0.03), 0.055, TURQ, "ribbed")

    def portal(self, w, h, d=0.06):
        """Pishtaq: tall rectangular portal with a lapis tile frame."""
        box((w, d, h), (0, 0, h / 2), self.WALL)
        slab([(-w * 0.4, 0), (w * 0.4, 0), (w * 0.4, h * 0.9), (-w * 0.4, h * 0.9)], 0.01, (0, -d / 2 - 0.004, 0), LAPIS)
        arch((0, -d / 2 - 0.009, 0), w * 0.58, h * 0.74, TURQ, pointed=True)
        arch((0, -d / 2 - 0.013, 0), w * 0.34, h * 0.42, DARK, pointed=True)
        box((w, 0.012, 0.02), (0, -d / 2 - 0.005, h - 0.03), TURQ)
        for sx in (-1, 1):
            cyl(0.022, h + 0.03, (sx * (w / 2 - 0.005), -d / 2 + 0.01, 0), self.WALL, n=8, r2=0.018)
            cyl(0.024, 0.02, (sx * (w / 2 - 0.005), -d / 2 + 0.01, h + 0.03), TURQ, n=8)

    def landmark(self, lv):
        if lv == 0:
            box((0.26, 0.22, 0.13), (0, 0.02, 0.065), self.HOUSE, bevel=0.024)
            self.beams(0.26, -0.09, 0.11, 5)
            with at((0, -0.08, 0)):
                self.aivan(0.24, 0.06, 0.1)
            cyl(0.07, 0.04, (0.0, 0.05, 0.13), self.HOUSE, n=12)
            dome((0.0, 0.05, 0.17), 0.07, TURQ, "ribbed")
        elif lv == 1:
            box((0.4, 0.3, 0.16), (0, 0.03, 0.08), self.HOUSE, bevel=0.024)
            with at((0, -0.12, 0)):
                self.portal(0.22, 0.3, 0.06)
            cyl(0.1, 0.07, (0, 0.08, 0.16), self.HOUSE, n=14)
            cyl(0.102, 0.022, (0, 0.08, 0.2), LAPIS, n=14)
            dome((0, 0.08, 0.23), 0.1, TURQ, "ribbed")
            for x in (-0.17, 0.17):
                cyl(0.035, 0.2, (x, -0.1, 0), self.WALL, n=8, r2=0.028)
                cyl(0.032, 0.02, (x, -0.1, 0.2), TURQ, n=8)
        else:
            # capital: an Ark-style citadel on a sloped mud mound, palace domes on top
            prism(ccw([(-0.32, -0.26), (0.32, -0.26), (0.32, 0.3), (-0.32, 0.3)]), 0.0, 0.16, self.WALL,
                  top=ccw([(-0.27, -0.21), (0.27, -0.21), (0.27, 0.25), (-0.27, 0.25)]))
            for x in (-0.32, -0.16, 0.0, 0.16, 0.32):
                if x == 0.0:
                    continue
                cyl(0.04, 0.2, (x, -0.26, 0), self.WALL, n=8, r2=0.03)
            box((0.08, 0.2, 0.012), (0, -0.33, 0.06), WOOD_D, rx=-28)  # timber ramp
            box((0.56, 0.012, 0.024), (0, -0.212, 0.148), LAPIS)
            box((0.56, 0.012, 0.012), (0, -0.214, 0.13), TURQ)
            with at((0, -0.2, 0.0)):
                self.portal(0.2, 0.36, 0.06)
            with at((0, 0.06, 0.16)):
                box((0.44, 0.3, 0.12), (0, 0.02, 0.06), C(240, 222, 186), bevel=0.012)
                self.beams(0.44, -0.13, 0.1, 7)
                box((0.442, 0.01, 0.022), (0, -0.131, 0.04), LAPIS)
                with at((0.14, -0.13, 0)):
                    self.aivan(0.14, 0.05, 0.09)
                cyl(0.11, 0.07, (0, 0.04, 0.12), self.HOUSE, n=14)
                cyl(0.112, 0.024, (0, 0.04, 0.16), LAPIS, n=14)
                dome((0, 0.04, 0.19), 0.11, TURQ, "ribbed")
                for x in (-0.16, 0.16):
                    dome((x, 0.02, 0.12), 0.05, TURQ, "ribbed")

    def wall(self, L, h=0.13):
        prism(ccw([(-L / 2, -0.045), (L / 2, -0.045), (L / 2, 0.045), (-L / 2, 0.045)]), 0, h, self.WALL,
              top=ccw([(-L / 2, -0.03), (L / 2, -0.03), (L / 2, 0.03), (-L / 2, 0.03)]))
        box((L, 0.01, 0.02), (0, -0.037, h - 0.03), LAPIS)  # glazed tile bands
        box((L, 0.01, 0.01), (0, -0.039, h - 0.012), TURQ)
        merlons(L, h, self.WALL, round_=True, s=0.034, t=0.06)

    def tower(self, h=0.2):
        cyl(0.08, h, (0, 0, 0), self.WALL, n=10, r2=0.058)
        for x, y, z, a in ring_of(6, 0.05, h):
            lathe([(0.018, 0), (0.018, 0.018), (0, 0.034)], (x, y, z), self.WALL, n=5)
        cyl(0.062, 0.022, (0, 0, h - 0.05), LAPIS, n=10)
        cyl(0.06, 0.01, (0, 0, h - 0.026), TURQ, n=10)
        dome((0, 0, h), 0.035, TURQ, "ribbed", finial=None)

    def gate(self, L, h=0.13):
        side = (L - 0.2) / 2
        for sx in (-1, 1):
            with at((sx * (0.1 + side / 2), 0, 0)):
                self.wall(side, h)
        with at((0, -0.01, 0)):
            self.portal(0.16, h + 0.1, 0.09)
        for sx in (-1, 1):
            with at((sx * 0.11, -0.02, 0)):
                self.tower(h + 0.06)

    def tent(self):
        yurt((0, 0, 0), 0.9, rz=0)


# --------------------------------------------------------------- Chinese
class Chinese(Style):
    name = "Chinese"
    ground = GRASS
    plaza = C(196, 192, 184)
    terrain = "grassland"
    WALL = C(150, 146, 148)
    HOUSE = C(240, 234, 222)
    ROOF = TILE_G

    def hall(self, w, d, h, roof=None, plinth=True, pillars=True, double=False, ridge=None, over=0.03):
        z = 0.0
        if plinth:
            box((w + 0.03, d + 0.03, 0.025), (0, 0, 0.0125), C(186, 180, 172))
            z = 0.025
        box((w, d, h), (0, 0, z + h / 2), self.HOUSE)
        if pillars:
            k = max(2, int(w / 0.05))
            for i in range(k + 1):
                x = -w / 2 + i * w / k
                box((0.014, 0.014, h), (x, -d / 2 - 0.006, z + h / 2), RED)
            box((w * 0.3, 0.008, h * 0.75), (0, -d / 2 - 0.004, z + h * 0.375), RED_D)
        roof = roof or self.ROOF
        if double:
            hip_roof((0, 0, z + h), w, d, h * 0.45, roof, lift=0.025, over=over, ridge=ridge)
            box((w * 0.7, d * 0.6, h * 0.45), (0, 0, z + h + h * 0.32), RED)
            hip_roof((0, 0, z + h + h * 0.55), w * 0.75, d * 0.65, h * 0.55, roof, lift=0.03, over=0.03, ridge=ridge)
        else:
            hip_roof((0, 0, z + h), w, d, h * 0.6, roof, lift=0.025, over=over, ridge=ridge)

    def house(self, size, alt=False):
        if size == 0:
            self.hall(0.13, 0.1, 0.085, pillars=False, plinth=False, over=0.015)
            box((0.035, 0.008, 0.055), (0.0, -0.054, 0.0275), RED)
        elif size == 1:
            self.hall(0.19, 0.12, 0.085)
        else:
            self.hall(0.21, 0.14, 0.1, double=True)

    def block(self):
        # siheyuan courtyard: grey wall, three halls round a court, a gate
        w = 0.32
        box((w, w, 0.012), (0, 0, 0.006), self.plaza)
        for sx in (-1, 1):
            box((0.018, w, 0.06), (sx * (w / 2 - 0.009), 0, 0.03), self.WALL)
        box((w, 0.018, 0.06), (0, w / 2 - 0.009, 0.03), self.WALL)
        for sx in (-1, 1):
            box((w * 0.36, 0.018, 0.06), (sx * w * 0.32, -w / 2 + 0.009, 0.03), self.WALL)
        with at((0, -w / 2 + 0.01, 0)):
            box((0.07, 0.03, 0.07), (0, 0, 0.035), RED)
            hip_roof((0, 0, 0.07), 0.08, 0.04, 0.03, self.ROOF, lift=0.01, over=0.012)
        with at((0, 0.08, 0.012)):
            self.hall(0.2, 0.1, 0.08)
        for sx in (-1, 1):
            with at((sx * 0.1, -0.03, 0.012), rz=90 * sx):
                self.hall(0.12, 0.07, 0.06, plinth=False, over=0.015)
        broadleaf((0.0, -0.05, 0.012), 0.45, C(110, 170, 80))

    def landmark(self, lv):
        if lv == 0:
            # drum tower: brick base with an arch and a double-eave pavilion
            box((0.2, 0.16, 0.1), (0, 0, 0.05), self.WALL)
            arch((0, -0.084, 0), 0.06, 0.08, DARK)
            with at((0, 0, 0.1)):
                self.hall(0.17, 0.12, 0.08, double=True, plinth=False)
        elif lv == 1:
            box((0.42, 0.3, 0.05), (0, 0.04, 0.025), C(214, 208, 198))
            box((0.1, 0.06, 0.025), (0, -0.13, 0.0125), C(214, 208, 198))
            with at((0, 0.06, 0.05)):
                self.hall(0.34, 0.2, 0.12, double=True, ridge=GOLD)
        else:
            # imperial hall: three-step white terrace, red walls, golden double roof
            for i, (w, d) in enumerate(((0.6, 0.5), (0.52, 0.42), (0.44, 0.34))):
                box((w, d, 0.035), (0, 0.04, 0.0175 + i * 0.035), C(240, 236, 228))
            box((0.1, 0.12, 0.05), (0, -0.25, 0.025), C(240, 236, 228), rx=0)
            with at((0, 0.05, 0.105)):
                self.HOUSE, h0 = RED, self.HOUSE
                self.hall(0.38, 0.24, 0.14, roof=GOLD, double=True, plinth=False, ridge=C(200, 60, 40))
                self.HOUSE = h0
            for sx in (-1, 1):
                ell((sx * 0.24, -0.2, 0.06), 0.02, C(180, 140, 70), seg=6, ring=4)
                cyl(0.02, 0.06, (sx * 0.24, -0.2, 0.0), C(160, 150, 140), n=6)

    def wall(self, L, h=0.13):
        box((L, 0.08, h), (0, 0, h / 2), self.WALL)
        box((L, 0.082, 0.012), (0, 0, h - 0.006), C(126, 122, 126))
        merlons_y = -0.034
        for i in range(max(2, int(L / 0.06))):
            x = -L / 2 + (i + 0.5) * L / max(2, int(L / 0.06))
            box((0.03, 0.014, 0.025), (x, merlons_y, h + 0.0125), self.WALL)

    def tower(self, h=0.2):
        box((0.13, 0.13, h), (0, 0, h / 2), self.WALL)
        box((0.1, 0.1, 0.06), (0, 0, h + 0.03), RED)
        hip_roof((0, 0, h + 0.06), 0.1, 0.1, 0.05, self.ROOF, lift=0.015, over=0.02)

    def gate(self, L, h=0.13):
        side = (L - 0.24) / 2
        for sx in (-1, 1):
            with at((sx * (0.12 + side / 2), 0, 0)):
                self.wall(side, h)
        box((0.24, 0.12, h + 0.02), (0, 0, (h + 0.02) / 2), self.WALL)
        arch((0, -0.064, 0), 0.07, 0.1, DARK)
        with at((0, 0, h + 0.02)):
            self.hall(0.2, 0.09, 0.07, double=True, plinth=False)

    def tent(self):
        # square canvas camp tent with a ridge and a red pennant
        slab([(-0.1, 0), (0.1, 0), (0.0, 0.13)], 0.18, (0, 0, 0), C(236, 226, 200))
        box((0.04, 0.01, 0.07), (0, -0.092, 0.035), DARK)
        box((0.012, 0.19, 0.012), (0, 0, 0.13), WOOD_D)
        flag((0.13, 0.08, 0.0), None, h=0.22, w=0.06, fh=0.04)


# --------------------------------------------------------------- Levantine
class Levantine(Style):
    name = "Levantine"
    ground = C(176, 186, 116)  # olive country
    plaza = C(222, 220, 212)
    terrain = "grassland"
    WALL = C(204, 202, 194)  # cool grey stone: Levantine = white/grey + terracotta + sage + rose ablaq
    HOUSE = C(244, 242, 236)
    SHUT = C(64, 140, 112)
    TERR = C(196, 92, 58)
    SAGE = C(126, 160, 140)

    def tile_cap(self, w, d, z, h=0.07):
        """Terracotta pyramid tile roof."""
        prism(ccw([(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)]), z, z + h, self.TERR,
              top=ccw([(-0.004, -0.004), (0.004, -0.004), (0.004, 0.004), (-0.004, 0.004)]))

    ABLAQ = C(214, 140, 104)  # warm rose-and-cream striped masonry

    def ablaq(self, w, y, z0, z1, k=None):
        """Striped two-tone masonry bands on a facade (front face at y)."""
        k = k or max(2, int((z1 - z0) / 0.03))
        hh = (z1 - z0) / k
        for i in range(0, k, 2):
            box((w, 0.008, hh), (0, y - 0.003, z0 + (i + 0.5) * hh), self.ABLAQ)

    def arcade(self, w, h, k, depth=0.012, y=0.0, z=0.0):
        aw = w / k
        for i in range(k):
            x = -w / 2 + (i + 0.5) * aw
            arch((x, y - 0.004, z), aw * 0.7, h, DARK)

    def house(self, size, alt=False):
        if size == 0:
            w, d, h = 0.12, 0.12, 0.11 + 0.02 * alt
            box((w, d, h), (0, 0, h / 2), self.HOUSE, bevel=0.016)
            parapet(w, d, h, self.HOUSE, hh=0.02)
            door(-0.02, -d / 2, 0, 0.035, 0.06, self.SHUT)
            box((0.025, 0.008, 0.025), (0.03, -d / 2 - 0.004, 0.08), self.SHUT)
            if not alt:
                self.tile_cap(w + 0.02, d + 0.02, h, 0.06)
            if alt:
                cyl(0.014, 0.025, (0.03, -0.03, h), TERRA, n=6, r2=0.01)
                ell((0.03, -0.03, h + 0.03), 0.02, C(90, 150, 70), seg=6, ring=4)
        elif size == 1:
            w, d, h = 0.17, 0.14, 0.17
            box((w, d, h), (0, 0, h / 2), self.HOUSE, bevel=0.016)
            parapet(w, d, h, self.HOUSE, hh=0.02)
            door(-0.035, -d / 2, 0, 0.04, 0.07, self.SHUT)
            for x in (-0.035, 0.035):
                arch((x, -d / 2 - 0.004, 0.1), 0.03, 0.05, self.SHUT)
            dome((0.04, 0.02, h), 0.04, self.SAGE, "low", finial=None)
        else:
            w, d, h = 0.22, 0.16, 0.16
            box((w, d, h), (0, 0.02, h / 2), self.HOUSE, bevel=0.016)
            parapet(w, d, h, self.HOUSE, hh=0.02)
            self.arcade(w, 0.09, 3, y=-d / 2 + 0.02)
            # rooftop pergola with vine
            for x in (-0.08, -0.02):
                for y in (-0.02, 0.06):
                    cyl(0.005, 0.06, (x, y, h), WOOD, n=4)
            box((0.08, 0.1, 0.008), (-0.05, 0.02, h + 0.06), WOOD)
            ell((-0.05, 0.02, h + 0.068), (0.045, 0.05, 0.012), C(100, 160, 70), seg=6, ring=4)
            dome((0.06, 0.03, h), 0.045, self.SAGE, "low", finial=None)

    def keep(self, w, h):
        box((w, w, h), (0, 0, h / 2), self.WALL, bevel=0.006)
        box((w + 0.02, w + 0.02, 0.02), (0, 0, h + 0.01), self.WALL)
        self.tile_cap(w + 0.03, w + 0.03, h + 0.02, w * 0.8)
        box((0.012, 0.01, 0.04), (0, -w / 2 - 0.004, h * 0.6), DARK)
        self.ablaq(w, -w / 2, h * 0.78, h, 3)

    def landmark(self, lv):
        if lv == 0:
            # khan hall: arcaded front, low dome
            box((0.28, 0.22, 0.14), (0, 0.02, 0.07), self.HOUSE, bevel=0.006)
            parapet(0.28, 0.22, 0.14, self.HOUSE)
            self.ablaq(0.28, -0.09, 0.0, 0.14, 6)
            self.arcade(0.26, 0.1, 4, y=-0.094)
            dome((0.0, 0.04, 0.14), 0.08, self.SAGE, "round")
        elif lv == 1:
            box((0.4, 0.3, 0.18), (0, 0.03, 0.09), self.HOUSE, bevel=0.006)
            parapet(0.4, 0.3, 0.18, self.HOUSE)
            with at((0, -0.12, 0)):
                self.ablaq(0.4, 0.0, 0.0, 0.18, 8)
            self.arcade(0.38, 0.12, 5, y=-0.124)
            self.arcade(0.3, 0.04, 6, y=-0.124, z=0.135)
            cyl(0.1, 0.05, (0, 0.06, 0.18), self.HOUSE, n=12)
            dome((0, 0.06, 0.23), 0.1, self.SAGE, "round")
            with at((0.16, 0.1, 0.0)):
                self.keep(0.08, 0.3)
        else:
            # hilltop citadel: sloped stone glacis, keep towers, arcaded palace
            prism(ccw([(-0.32, -0.26), (0.32, -0.26), (0.32, 0.32), (-0.32, 0.32)]), 0.0, 0.12, self.WALL,
                  top=ccw([(-0.27, -0.2), (0.27, -0.2), (0.27, 0.27), (-0.27, 0.27)]))
            box((0.07, 0.24, 0.014), (0, -0.3, 0.06), WOOD_D, rx=-24)  # bridge ramp
            with at((0, -0.2, 0.0)):
                box((0.12, 0.08, 0.24), (0, 0, 0.12), self.WALL, bevel=0.006)
                self.ablaq(0.12, -0.04, 0.0, 0.24, 8)
                arch((0, -0.044, 0.12), 0.05, 0.08, DARK, pointed=True)
                merlons(0.12, 0.24, self.WALL, k=3, s=0.03, t=0.08)
            with at((0, 0.06, 0.12)):
                box((0.42, 0.26, 0.15), (0, 0.02, 0.075), self.HOUSE, bevel=0.006)
                parapet(0.42, 0.26, 0.15, self.HOUSE)
                self.ablaq(0.42, -0.11, 0.0, 0.15, 6)
                self.arcade(0.4, 0.1, 5, y=-0.114)
                cyl(0.09, 0.04, (0, 0.04, 0.15), self.HOUSE, n=12)
                dome((0, 0.04, 0.19), 0.09, self.SAGE, "round")
                for x in (-0.24, 0.24):
                    with at((x, 0.1, 0)):
                        self.keep(0.09, 0.28)
                poplar((-0.14, -0.16, 0.0), 0.55, C(60, 110, 70))
                poplar((0.14, -0.16, 0.0), 0.55, C(60, 110, 70))

    def wall(self, L, h=0.13):
        box((L, 0.07, h), (0, 0, h / 2), self.WALL, bevel=0.004)
        merlons(L, h, self.WALL, s=0.032)
        k = max(1, int(L / 0.2))
        for i in range(k):
            x = -L / 2 + (i + 0.5) * L / k
            prism(ccw([(x - 0.02, -0.035), (x + 0.02, -0.035), (x + 0.02, -0.06), (x - 0.02, -0.06)]), 0, h * 0.6, self.WALL,
                  top=ccw([(x - 0.02, -0.035), (x + 0.02, -0.035), (x + 0.02, -0.04), (x - 0.02, -0.04)]))

    def tower(self, h=0.2):
        box((0.12, 0.12, h), (0, 0, h / 2), self.WALL, bevel=0.005)
        box((0.14, 0.14, 0.03), (0, 0, h + 0.015), self.WALL)
        self.tile_cap(0.15, 0.15, h + 0.03, 0.1)
        box((0.012, 0.01, 0.035), (0, -0.064, h * 0.6), DARK)

    def gate(self, L, h=0.13):
        side = (L - 0.22) / 2
        for sx in (-1, 1):
            with at((sx * (0.11 + side / 2), 0, 0)):
                self.wall(side, h)
        box((0.22, 0.1, h + 0.06), (0, 0, (h + 0.06) / 2), self.WALL, bevel=0.005)
        self.ablaq(0.2, -0.05, 0.02, h + 0.04, 6)
        arch((0, -0.058, 0), 0.09, 0.14, LIME, pointed=True)
        arch((0, -0.062, 0), 0.07, 0.12, DARK, pointed=True)
        slab([(-0.06, 0), (0.06, 0), (0.06, 0.02), (-0.06, 0.02)], 0.01, (0, -0.054, 0.15), TERRA)
        merlons(0.22, h + 0.06, self.WALL, k=5, s=0.03, t=0.1)

    def tent(self):
        # black goat-hair tent: long, low, three peaks, front curtain raised
        slab([(-0.15, 0), (0.15, 0), (0.15, 0.045), (0.075, 0.1), (0.0, 0.08), (-0.075, 0.1), (-0.15, 0.045)], 0.16, (0, 0, 0), C(66, 54, 54))
        box((0.22, 0.01, 0.045), (0.0, -0.081, 0.022), C(40, 30, 30))
        box((0.3, 0.012, 0.016), (0, -0.082, 0.05), C(196, 60, 50))
        box((0.3, 0.012, 0.008), (0, -0.083, 0.062), CREAM)
        for x in (-0.075, 0.075):
            cyl(0.005, 0.11, (x, -0.085, 0), WOOD_D, n=4)


def quad(pts, rgb, t=0.006):
    """A thin flat panel through 4 points (tent cloth)."""
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in pts]
    up = [bm.verts.new((x, y, z + t)) for x, y, z in pts]
    bm.faces.new(vs[::-1])
    bm.faces.new(up)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((vs[i], vs[j], up[j], up[i]))
    return _bm_obj(bm, "quad", rgb)


STYLES = [Persian(), CentralAsian(), Chinese(), Levantine()]
STAGES = ["camp", "village", "town", "city", "capital"]

# =============================================================== stage layouts


def city_ground(st, H, paved=0.0):
    hex_tile(H, st.ground)
    if paved:
        with at((0, 0, H)):
            prism(hexpts(paved), -0.004, 0.006, st.plaza, top=inset(hexpts(paved), 0.006))


def ring_walls(st, h, gate_edges=(4,), tower_h=None, r=RW):
    tower_h = tower_h or h + 0.08
    L = r  # hex edge length == circumradius
    for k in range(6):
        a = edge_ang(k)
        mx, my = r * math.cos(math.radians(30)) * math.cos(math.radians(a)), r * math.cos(math.radians(30)) * math.sin(math.radians(a))
        with at((mx, my, 0), rz=a + 90):
            if k in gate_edges:
                st.gate(L, h)
            else:
                st.wall(L - 0.06, h)
    for k in range(6):
        a = math.radians(60 * k)
        with at((r * math.cos(a), r * math.sin(a), 0), rz=60 * k):
            st.tower(tower_h)


def road_to_gate(st, w=0.16, L=0.8):
    box((w, L, 0.012), (0, -L / 2, 0.004), C(200, 180, 140))


def city(st, stage, H=None):
    H = ELEV["low"] if H is None else H
    i = STAGES.index(stage)
    if i == 0:
        city_ground(st, H)
        with at((0, 0, H)):
            for (x, y, rz, s) in ((-0.22, 0.2, 10, 1.0), (0.24, 0.12, -20, 0.9), (0.0, -0.22, 5, 0.85)):
                with at((x, y, 0), rz=rz, s=s * 1.6):
                    st.tent()
            for j in range(6):
                rock((0.3 + 0.05 * math.cos(j * 1.05), -0.3 + 0.05 * math.sin(j * 1.05), 0), 0.02, ROCK_D, n=5)
            cone(0.035, 0.08, (0.3, -0.3, 0), C(250, 150, 50), n=5, emit=1.0)
            for (x, y, c) in ((-0.38, -0.2, OCHRE), (-0.32, -0.3, RED), (-0.42, -0.32, C(140, 90, 60))):
                ell((x, y, 0.03), (0.035, 0.035, 0.04), c, seg=6, ring=4)
            flag((-0.05, 0.42, 0), None, h=0.4, w=0.15, fh=0.09)
    elif i == 1:
        city_ground(st, H)
        with at((0, 0, H)):
            box((0.12, 1.1, 0.01), (0.0, -0.1, 0.004), C(214, 192, 150), rz=-20)  # track
            for (x, y, sz, alt, rz) in ((-0.3, 0.25, 1, False, 0), (0.28, 0.3, 0, False, 0), (-0.38, -0.12, 0, True, 0),
                                        (0.3, -0.05, 0, False, 0), (0.06, 0.48, 0, True, 0)):
                with at((x, y, 0), rz=rz, s=1.25):
                    st.house(sz, alt)
            well((0.0, 0.04, 0), 1.0)
            # small field
            with at((0.25, -0.42, 0), rz=-20):
                box((0.3, 0.2, 0.02), (0, 0, 0.0), C(150, 110, 70))
                for k in range(4):
                    box((0.28, 0.025, 0.015), (0, -0.075 + k * 0.05, 0.012), C(130, 180, 70))
            for (x, y) in ((-0.55, 0.05), (-0.1, -0.5), (0.55, 0.2)):
                (poplar if st.name != "Chinese" else broadleaf)((x, y, 0), 0.8)
            flag((-0.12, 0.3, 0), None, h=0.4, w=0.15, fh=0.09)
    elif i == 2:
        city_ground(st, H, paved=0.62)
        with at((0, 0, H)):
            road_to_gate(st, L=0.9)
            # walls rising on the back three edges
            for k in (1, 2):
                a = edge_ang(k)
                d = RW * math.cos(math.radians(30))
                with at((d * math.cos(math.radians(a)), d * math.sin(math.radians(a)), 0), rz=a + 90):
                    st.wall(RW - 0.06, 0.11)
            for k in (1, 2, 3):
                with at((RW * math.cos(math.radians(60 * k)), RW * math.sin(math.radians(60 * k)), 0), rz=60 * k):
                    st.tower(0.17)
            with at((0.0, 0.18, 0), s=1.15):
                st.landmark(0)
            for k in (1, 3):
                a = math.radians(60 * k)
                flag((RW * math.cos(a), RW * math.sin(a), 0.2), None, h=0.24, w=0.14, fh=0.085)
            for (x, y, sz, alt) in ((-0.35, 0.05, 1, False), (0.36, 0.12, 1, True), (-0.26, -0.3, 0, True), (0.27, -0.28, 0, False),
                                    (-0.47, -0.2, 0, False), (0.5, -0.12, 0, True), (0.22, 0.48, 0, True)):
                with at((x, y, 0), s=1.15):
                    st.house(sz, alt)
    elif i == 3:
        city_ground(st, H, paved=0.8)
        with at((0, 0, H)):
            road_to_gate(st, L=0.75)
            ring_walls(st, 0.11, tower_h=0.19)
            with at((0.0, 0.16, 0), s=1.0):
                st.landmark(1)
            for k in (0, 2, 3, 5):
                a = math.radians(60 * k)
                flag((RW * math.cos(a), RW * math.sin(a), 0.22), None, h=0.24, w=0.14, fh=0.085)
            for (x, y) in ((-0.42, 0.06), (0.42, 0.06), (-0.27, -0.33), (0.27, -0.33)):
                with at((x, y, 0), s=0.85):
                    st.block()
    else:
        city_ground(st, H, paved=0.8)
        with at((0, 0, H)):
            road_to_gate(st, L=0.6)
            ring_walls(st, 0.13, tower_h=0.28)
            with at((0.0, 0.14, 0), s=1.12):
                st.landmark(2)
            for (x, y) in ((-0.5, -0.08), (0.5, -0.08), (-0.27, -0.42), (0.27, -0.42)):
                with at((x, y, 0), s=0.78):
                    st.block()
            for k in range(6):
                a = math.radians(60 * k)
                flag((RW * math.cos(a), RW * math.sin(a), 0.31), None, h=0.26, w=0.15, fh=0.095, swallow=True)
            for sx in (-1, 1):
                banner((sx * 0.16, -0.68, 0.0), h=0.4, w=0.1, fh=0.18)
