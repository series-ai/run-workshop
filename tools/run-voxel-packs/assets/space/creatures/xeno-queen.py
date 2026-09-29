"""Xeno queen (boss), in the style of the Pirate Nation world bosses.

A chunky caricature like the PN giant turtle, kraken and Kevin, in three
colours: violet chitin, bone and glowing toxic green. She rears up like a
mantis: a huge egg sac drags behind, the thorax slopes up to a big wedge
head that turns toward the viewer. The head has two huge angry glowing
eyes under a heavy brow, a wide open jaw full of bone fangs with a toxic
glow inside, and hooked mandibles; a tall crowned frill fans out behind
it. Two giant bone scythe arms rise over the shoulders and hang their
blades in front. Four long jointed legs splay out: thighs up to high
spiked knees, shins down on the diagonal to bone claws. Every mass is a
loft of octagonal frustums or a prism (true slopes); the detail is
painted. Clips: idle (breathe, look, jaw), attack (rear, double slash,
jaw wide, goo from the mouth socket), hit (recoil), death (collapse).
Faces -Z.
"""
import numpy as np

from voxgrid import C
from _life import P, Clip, Grid, Rig, asset, coords, facet_paint, front, keys, light_top, loft, plan, quad, side, spots, wave

S = (192, 150, 212)
CX = 96
SHELL, BONE, GLOW = "purple", "bone", "toxic"
HZ = 14  # the front plane of the skull (the face)
HEAD = [(HZ, 25, 18, 86), (HZ + 12, 30, 21, 89), (HZ + 32, 27, 19, 91), (HZ + 48, 16, 12, 86)]
JAW = [(HZ - 5, 19, 6, 62), (HZ + 10, 22, 7, 63), (HZ + 36, 16, 6, 68)]
JAW_HINGE = (CX, 68.0, HZ + 34.0)
THORAX = [(HZ + 40, 20, 16, 84), (HZ + 52, 26, 21, 78), (HZ + 72, 27, 22, 66), (HZ + 90, 23, 20, 54)]
ABDOMEN = [(102, 23, 20, 50), (120, 33, 27, 50), (144, 36, 30, 50), (168, 32, 27, 48), (188, 21, 19, 44), (206, 8, 8, 40)]
NECK = (CX, 84.0, HZ + 44.0)
BODY_J = (CX, 60.0, 100.0)
SHOULDER = (80.0, HZ + 56.0)  # (y, z)
SCY_X = 42
CREST_J = (CX, 100.0, HZ + 36.0)
# legs: (hip x offset, z, knee out, knee y, foot out, splay degrees)
LEGS = [(22, 102, 30, 106, 66, 34.0), (28, 128, 28, 102, 62, -30.0)]


def chitin(g: Grid, solids, base: int = 5, size=(14, 9), seed: int = 0) -> np.ndarray:
    """Big violet chitin plates on every facet (no rivets), soft seams, lit tops."""
    m = facet_paint(g, solids, lambda gg, mm, fr: P.plates(gg, mm, SHELL, base, size=size, rivets=False, frame=fr, seed=seed))
    P.flat(g, m & (g.a == C(SHELL, base - 2)), SHELL, base - 1)  # softer seams
    light_top(g, m, SHELL, base + 1)
    return m


def spine_row(g: Grid, zs, top_of, h: float = 9, w: float = 2.5) -> np.ndarray:
    """Bone spines along the top ridge; top_of(z) gives the ridge height."""
    m = np.zeros(g.shape, dtype=bool)
    for z in zs:
        y = top_of(z)
        m |= side(g, [(y - 3, z - 5), (y - 3, z + 5), (y + h, z + 6)], CX - w, CX + w, BONE, 6)
    P.flat(g, m, BONE, 6)
    light_top(g, m, BONE, 7)
    return m


def ridge(rings):
    """The top height of a loft at z (linear between rings)."""
    zs = [r[0] for r in rings]
    tops = [r[3] + r[2] for r in rings]
    return lambda z: float(np.interp(z, zs, tops))


# ------------------------------------------------------------------ body
def abdomen() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m = chitin(g, loft(g, CX, ABDOMEN, SHELL, 5), 5, size=(26, 14), seed=1)
    top = m & (Y >= 58)
    P.flat(g, top & (np.floor((Z - 100) / 12) % 2 == 1), SHELL, 4)  # wasp bands
    light_top(g, top, SHELL, 6)
    # glowing toxic vents between the bands
    for z0 in (122, 146, 170):
        vent = top & (Z >= z0) & (Z < z0 + 2) & (np.abs(X - CX) < 22)
        P.flat(g, vent, GLOW, 5)
        P.flat(g, vent & (np.abs(X - CX) < 12), GLOW, 7)
    # the egg membrane on the flanks: pale violet, packed with glowing eggs
    low = m & (Y < 58) & (np.abs(X - CX) > 8)
    P.flat(g, low, "magenta", 4)
    P.flat(g, low & (Y < 34), "magenta", 3)
    spots(g, low, GLOW, 5, cell=11, r=4.2, chance=1, seed=3)
    spots(g, low, GLOW, 7, cell=11, r=2.4, chance=1, seed=3)
    spine_row(g, (112, 134, 158, 182), ridge(ABDOMEN), h=12, w=3)
    return g


def thorax() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m = chitin(g, loft(g, CX, THORAX, SHELL, 5), 5, size=(18, 10), seed=4)
    # a pale bone breastplate on the chest (the underside of the slope)
    chest = m & (Y < 78) & (np.abs(X - CX) < 16) & (Z < HZ + 84)
    P.plates(g, chest, BONE, 5, size=(10, 6), rivets=False)
    spine_row(g, (HZ + 54, HZ + 72), ridge(THORAX), h=12, w=3)
    # shoulder knobs that carry the scythes
    for s in (-1, 1):
        x0, x1 = sorted((CX + s * 20, CX + s * (SCY_X - 2)))
        sy, sz = SHOULDER
        k = side(g, [(sy - 8, sz - 6), (sy - 8, sz + 8), (sy + 6, sz + 9), (sy + 10, sz + 1), (sy + 5, sz - 8)], x0, x1, SHELL, 5)
        P.flat(g, k, SHELL, 5)
        light_top(g, k, SHELL, 6)
        spike = side(g, [(sy + 4, sz - 2), (sy + 4, sz + 6), (sy + 16, sz + 10)], x0 + 3, x1 - 3, BONE, 6)
        light_top(g, spike, BONE, 7)
    return g


# ------------------------------------------------------------------ head
def head() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m = chitin(g, loft(g, CX, HEAD, SHELL, 5, k=0.34), 5, size=(20, 11), seed=5)
    z0, w0, h0, y0 = HEAD[0]
    face = m & (Z < z0 + 1.2)
    P.flat(g, face, SHELL, 7)
    P.outline(g, face, SHELL, 5, normal="z")
    # a glowing toxic gem on the brow of the skull (the queen's mark)
    topf = m & (Y > y0 + h0 - 1.5) & (Z < z0 + 20)
    P.flat(g, topf & (np.abs(X - CX) + np.abs(Z - (z0 + 9)) * 0.8 < 6.5), SHELL, 3)
    P.flat(g, topf & (np.abs(X - CX) + np.abs(Z - (z0 + 9)) * 0.8 < 5), GLOW, 6)
    P.flat(g, topf & (np.abs(X - CX) + np.abs(Z - (z0 + 9)) * 0.8 < 2.5), GLOW, 7)
    for s in (-1, 1):  # dark V stripes back over the skull
        P.flat(g, topf & (np.abs((Z - z0) - 14 - 0.6 * np.abs(X - CX)) < 1.2) & (np.abs(X - CX) > 5), SHELL, 3)
    # the glowing mouth cavity behind the fangs
    throat = front(g, [(CX - 19, 55), (CX + 19, 55), (CX + 17, 70), (CX - 17, 70)], z0 + 3, z0 + 26, GLOW, 4)
    P.flat(g, throat, GLOW, 4)
    P.flat(g, throat & (Z < z0 + 9) & (np.abs(X - CX) < 12), GLOW, 6)
    # upper fangs hanging from the skull (two big ones at the corners)
    fangs = np.zeros(g.shape, dtype=bool)
    for k, x in enumerate(np.linspace(CX - 16, CX + 16, 6)):
        big = k in (0, 5)
        fangs |= front(g, [(x - 3, y0 - h0 + 1), (x + 3, y0 - h0 + 1), (x, y0 - h0 - (11 if big else 7))], z0 + 1, z0 + 5, BONE, 7)
    P.flat(g, fangs, BONE, 7)
    # two huge angry eyes: almond, slanted down to the middle, with a slit
    for s in (-1, 1):
        ex, ey = CX + s * 12, y0 + 4
        d = np.hypot((X - ex) / 9.0, (Y - ey) / 7.0)
        cut = (Y - ey) > 3.0 - 0.55 * (s * (ex - X))  # the brow bites the inner top corner
        eye = face & (d < 1.0) & ~cut
        rim = face & (d < 1.25) & ~(face & (d < 1.0) & ~cut)
        P.flat(g, rim & (d < 1.25), SHELL, 2)
        P.flat(g, eye, GLOW, 6)
        P.flat(g, eye & (d < 0.6), GLOW, 7)
        P.flat(g, eye & (np.abs(X - ex + s * 0.5) < 1.3) & (np.abs(Y - ey) < 4.5), SHELL, 1)
        P.flat(g, eye & (np.hypot(X - (ex + s * 4.0), Y - (ey + 2.0)) < 1.6), BONE, 7)
    # a heavy brow ridge in a V over the eyes
    brow = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        brow |= front(g, quad((CX + s * 26, y0 + 13), (CX + s * 1.5, y0 + 7), 3.0, 2.6), z0 - 3, z0 + 2, SHELL, 6)
    P.flat(g, brow, SHELL, 6)
    light_top(g, brow, SHELL, 7)
    P.flat(g, brow & (Y < y0 + 7), SHELL, 3)
    # glowing nostril slits and cheek plates
    for s in (-1, 1):
        P.flat(g, face & (np.abs(X - (CX + s * 4)) < 1) & (np.abs(Y - (y0 - 7)) < 1.5), SHELL, 2)
        cheek = front(g, quad((CX + s * 24, y0 - 15), (CX + s * 29, y0 + 2), 3.4, 2.2), z0 + 2, z0 + 16, BONE, 6)
        light_top(g, cheek, BONE, 7)
    # two bone horns sweeping back from the top corners of the skull
    for s in (-1, 1):
        hx = CX + s * 17
        horn = side(g, quad((y0 + 14, z0 + 16), (y0 + 30, z0 + 44), 5.0, 1.0, cap=0.6), hx - 3, hx + 3, BONE, 6)
        P.flat(g, horn, BONE, 6)
        light_top(g, horn, BONE, 7)
        P.flat(g, horn & (Y < y0 + 19), BONE, 4)
    return g


def jaw() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m = chitin(g, loft(g, CX, JAW, SHELL, 5, k=0.34), 5, size=(16, 8), seed=6)
    z0 = JAW[0][0]
    top = JAW[0][3] + JAW[0][2]
    P.flat(g, m & (Y > top - 1.5), GLOW, 4)  # the glowing tongue bed
    P.flat(g, m & (Z < z0 + 1.2) & (Y < top - 1.5), SHELL, 6)
    teeth = np.zeros(g.shape, dtype=bool)
    for k, x in enumerate(np.linspace(CX - 14, CX + 14, 5)):
        big = k in (0, 4)
        teeth |= front(g, [(x - 2.8, top - 1), (x + 2.8, top - 1), (x, top + (9 if big else 6))], z0 + 1, z0 + 5, BONE, 7)
    P.flat(g, teeth, BONE, 7)
    # hooked bone mandibles at the corners of the jaw, curling in
    mand = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        pts = [(CX + s * 18, z0 + 14), (CX + s * 28, z0 + 9), (CX + s * 28, z0 - 2), (CX + s * 16, z0 - 9), (CX + s * 12, z0 - 6), (CX + s * 21, z0 - 1), (CX + s * 20, z0 + 7)]
        mand |= plan(g, pts, 56, 63, BONE, 6)
    P.flat(g, mand, BONE, 6)
    light_top(g, mand, BONE, 7)
    P.flat(g, mand & (Z < z0 - 6), BONE, 5)
    # goo drips from the jaw
    for s in (-1, 1):
        drip = front(g, [(CX + s * 8 - 1.8, 58), (CX + s * 8 + 1.8, 58), (CX + s * 8, 48)], z0 + 1, z0 + 4, GLOW, 6)
        P.flat(g, drip, GLOW, 6)
    return g


def crest() -> Grid:
    """The queen's crowned frill: a wide fan of five bone-tipped points."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    cy = CREST_J[1]
    zc = CREST_J[2]
    fan = [(CX - 18, cy - 6), (CX + 18, cy - 6), (CX + 38, cy + 14), (CX + 30, cy + 18), (CX + 34, cy + 34), (CX + 19, cy + 26),
           (CX + 14, cy + 42), (CX + 5, cy + 30), (CX, cy + 46), (CX - 5, cy + 30), (CX - 14, cy + 42), (CX - 19, cy + 26),
           (CX - 34, cy + 34), (CX - 30, cy + 18), (CX - 38, cy + 14)]
    m = front(g, fan, zc - 3, zc + 3, SHELL, 5)
    P.flat(g, m, SHELL, 5)
    rr = np.hypot(X - CX, (Y - (cy - 6)) * 1.1)
    P.flat(g, m & (rr > 16), "magenta", 5)  # the inner membrane
    P.flat(g, m & (rr > 16) & (np.abs(np.sin(np.arctan2(Y - cy + 6, X - CX) * 5)) < 0.18), SHELL, 3)  # ribs
    P.flat(g, m & (rr > 34), BONE, 6)  # bone points
    P.flat(g, m & (rr > 40), BONE, 7)
    P.outline(g, m, SHELL, 3, normal="z")
    P.flat(g, m & (rr > 34) & (Y > cy + 20), BONE, 7)
    for gx, gy in ((CX - 20, cy + 12), (CX + 20, cy + 12), (CX, cy + 20)):
        P.flat(g, m & (np.hypot(X - gx, Y - gy) < 3.2), GLOW, 6)
        P.flat(g, m & (np.hypot(X - gx, Y - gy) < 1.6), GLOW, 7)
    return g


# ------------------------------------------------------------------ limbs
def scythe(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    x = CX + s * SCY_X
    sy, sz = SHOULDER
    elbow = (sy + 32, sz - 12)
    arm = side(g, quad((sy, sz), elbow, 6.0, 5.0, cap=0.3), x - 4, x + 4, SHELL, 5)
    P.flat(g, arm, SHELL, 5)
    light_top(g, arm, SHELL, 6)
    P.flat(g, arm & (np.abs(Y - (sy + 19)) < 1.2), SHELL, 3)
    ey, ez = elbow
    knob = side(g, [(ey - 7, ez - 5), (ey - 7, ez + 6), (ey + 5, ez + 8), (ey + 8, ez), (ey + 3, ez - 7)], x - 4.5, x + 4.5, SHELL, 5)
    light_top(g, knob, SHELL, 6)
    spur = side(g, [(ey + 4, ez + 2), (ey + 4, ez + 8), (ey + 12, ez + 16)], x - 2, x + 2, BONE, 6)
    light_top(g, spur, BONE, 7)
    # the blade: a big sickle curving down in front of the queen
    outer = [(ey + 6, ez - 4), (ey + 4, ez - 20), (ey - 8, ez - 36), (ey - 26, ez - 46), (ey - 44, ez - 50)]
    inner = [(ey - 32, ez - 38), (ey - 20, ez - 28), (ey - 12, ez - 18), (ey - 7, ez - 6)]
    blade_pts = outer + inner
    blade = side(g, blade_pts, x - 2.5, x + 2.5, BONE, 6)
    P.flat(g, blade, BONE, 6)
    # serrated teeth along the inner edge
    teeth = np.zeros(g.shape, dtype=bool)
    for (ya, za), (yb, zb) in zip(inner, inner[1:]):
        for t in (0.25, 0.75):
            ty, tz = ya + (yb - ya) * t, za + (zb - za) * t
            teeth |= side(g, [(ty - 2.5, tz - 1.5), (ty + 2.5, tz + 1.5), (ty - 6, tz + 5)], x - 1.5, x + 1.5, BONE, 5)
    P.flat(g, teeth, BONE, 5)
    # a toxic groove along the blade and a lit spine
    P.flat(g, blade & (np.abs((Y - (ey - 18)) - (Z - (ez - 30)) * 1.1) < 1.3) & (Y < ey - 4) & (Y > ey - 36), GLOW, 6)
    light_top(g, blade, BONE, 7)
    return g


def leg(s: int, hx: float, lz: float, kout: float, ky: float, fout: float) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    hip = (CX + s * hx, 56.0)
    knee = (CX + s * (hx + kout), ky)
    foot = (CX + s * (hx + fout), 6.0)
    n0 = len(g.solids)
    thigh = front(g, quad(hip, knee, 7.0, 5.4, cap=0.3), lz - 5.5, lz + 5.5, SHELL, 5)
    shin = front(g, quad(knee, foot, 5.4, 3.4, cap=0.2), lz - 4.5, lz + 4.5, SHELL, 5)
    chitin(g, g.solids[n0:], 5, size=(10, 8), seed=int(lz))
    P.flat(g, shin & (Y < 26), BONE, 5)  # pale lower shins
    P.flat(g, shin & (Y < 26) & (np.floor(Y) % 7 == 0), BONE, 4)
    claw = front(g, quad(foot, (foot[0] + s * 3, 0.5), 3.4, 1.0), lz - 3, lz + 3, BONE, 6)
    P.flat(g, claw, BONE, 6)
    knob = front(g, [(knee[0] - 7, knee[1] - 3), (knee[0] + 7, knee[1] - 3), (knee[0] + 5, knee[1] + 4), (knee[0] - 5, knee[1] + 4)], lz - 6.5, lz + 6.5, BONE, 5)
    P.flat(g, knob, BONE, 5)
    light_top(g, knob, BONE, 6)
    spike = front(g, [(knee[0] - 4, knee[1] + 3), (knee[0] + 4, knee[1] + 3), (knee[0] + s * 7, knee[1] + 15)], lz - 2.5, lz + 2.5, BONE, 6)
    light_top(g, spike, BONE, 7)
    _ = thigh
    return g


# ------------------------------------------------------------------ rig
def build():
    rig = Rig()
    rig.add("xeno-queen", abdomen(), BODY_J)
    for s in (-1, 1):
        for k, (hx, lz, kout, ky, fout, splay) in enumerate(LEGS):
            rig.add(f"leg-{'rl'[s > 0]}{k}", leg(s, hx, lz, kout, ky, fout), (CX + s * hx, 56.0, lz), "xeno-queen", rot=(0.0, s * splay, 0.0))
    rig.add("body", thorax(), BODY_J, "xeno-queen")
    rig.add("head", head(), NECK, "body", rot=(0.0, -16.0, 5.0))
    rig.add("jaw", jaw(), JAW_HINGE, "head", rot=(-10.0, 0.0, 0.0))
    rig.add("crest", crest(), CREST_J, "head", rot=(38.0, 0.0, 0.0))
    rig.add("scythe-r", scythe(1), (CX + SCY_X, SHOULDER[0], SHOULDER[1]), "body", rot=(6.0, 0.0, -8.0))
    rig.add("scythe-l", scythe(-1), (CX - SCY_X, SHOULDER[0], SHOULDER[1]), "body", rot=(-4.0, 0.0, 12.0))
    mouth = rig.sock("socket-mouth", (CX, 66.0, float(HZ) - 2.0), "head")
    z = (0.0, 0.0, 0.0)
    idle = {"body": {"rot": wave(3.0, "x", 2.5)},
            "head": {"rot": keys((0, z), (0.75, (0, 9, 3)), (1.5, z), (2.25, (0, -9, -3)), (3.0, z))},
            "jaw": {"rot": keys((0, z), (0.6, (-8, 0, 0)), (1.2, z), (2.1, (-5, 0, 0)), (3.0, z))},
            "crest": {"rot": wave(3.0, "x", 4, phase=1.0)},
            "scythe-l": {"rot": wave(3.0, "x", 5, phase=0.6)}, "scythe-r": {"rot": wave(3.0, "x", 5, phase=2.1)}}
    attack = {"body": {"rot": keys((0, z), (0.4, (14, 0, 0)), (0.65, (-8, 0, 0)), (0.9, (-6, 0, 0)), (1.3, z))},
              "head": {"rot": keys((0, z), (0.4, (-10, 0, 0)), (0.65, (12, 0, 0)), (1.3, z))},
              "jaw": {"rot": keys((0, z), (0.4, (-6, 0, 0)), (0.6, (-30, 0, 0)), (0.9, (-28, 0, 0)), (1.3, z))},
              "crest": {"rot": keys((0, z), (0.4, (-12, 0, 0)), (0.65, (8, 0, 0)), (1.3, z))},
              "scythe-r": {"rot": keys((0, z), (0.4, (45, 0, -10)), (0.62, (-40, 0, 8)), (0.9, (-36, 0, 6)), (1.3, z))},
              "scythe-l": {"rot": keys((0, z), (0.45, (45, 0, 10)), (0.7, (-40, 0, -8)), (0.95, (-36, 0, -6)), (1.3, z))}}
    hit = {"body": {"rot": keys((0, z), (0.12, (-8, 6, 0)), (0.25, (-9, 6, 0)), (0.5, z))},
           "head": {"rot": keys((0, z), (0.12, (14, -12, 6)), (0.25, (14, -12, 6)), (0.5, z))},
           "jaw": {"rot": keys((0, z), (0.12, (-22, 0, 0)), (0.5, z))},
           "scythe-l": {"rot": keys((0, z), (0.12, (20, 0, 14)), (0.5, z))}, "scythe-r": {"rot": keys((0, z), (0.12, (20, 0, -14)), (0.5, z))}}
    death = {"body": {"rot": keys((0, z), (0.5, (10, 0, 4)), (1.2, (-18, 0, 8)), (1.6, (-17, 0, 8)))},
             "head": {"rot": keys((0, z), (1.2, (-22, 18, 0)))},
             "jaw": {"rot": keys((0, z), (1.2, (-24, 0, 0)))},
             "crest": {"rot": keys((0, z), (1.2, (-20, 0, 0)))},
             "scythe-l": {"rot": keys((0, z), (1.2, (-55, 0, -20)))}, "scythe-r": {"rot": keys((0, z), (1.2, (-55, 0, 20)))},
             "xeno-queen": {"loc": keys((0, z), (0.5, z), (1.2, (0, -14, 0)), (1.6, (0, -13, 0)))}}
    for s in (-1, 1):
        for k in range(len(LEGS)):
            death[f"leg-{'rl'[s > 0]}{k}"] = {"rot": keys((0, z), (0.5, z), (1.2, (0, 0, s * 14)), (1.6, (0, 0, s * 13)))}
    return asset("creatures", "xeno-queen", "Xeno Queen", rig.root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                 sockets=[mouth], pfx=[{"effectId": "rvx-space-acid-spray", "socket": "socket-mouth", "trigger": "clip:attack", "size": 70, "aim": [-0.288, -0.242, -0.927], "at": 0.52}])
