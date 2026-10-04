"""Xeno queen (boss), in the style of the Pirate Nation world bosses.

A chunky caricature like the PN giant turtle, kraken and Kevin: an escaped
lab specimen. Violet chitin with clean colour fields (lit tops, shaded
undersides, a dark frame on every facet edge), bone armour, a magenta egg
sac and glowing cyan bio-light (the space theme's glow). She rears up like
a mantis: the egg sac drags behind, the thorax slopes up to a big wedge
head that turns toward the viewer. The head has two huge angry glowing
eyes under a heavy brow, a wide open jaw full of bone fangs with a cyan
glow inside, and hooked mandibles; a solid three-pointed crest stands
behind it. A broken steel containment collar with a hazard band and a
blinking tag lamp is still clamped round her neck. Two giant bone scythe
arms rise over the shoulders and hang their blades in front. Four thick
jointed legs come out of her flanks: thighs up and out to bone knees,
shins down on the diagonal to bone claws. Every mass is a loft of
octagonal frustums or a prism (true slopes); the detail is painted.
Clips: idle (breathe, look, jaw), attack (rear, double slash, jaw wide,
goo from the mouth socket), hit (recoil), death (collapse). Faces -Z.
"""
import numpy as np

from voxgrid import C
from _life import P, Clip, Grid, Rig, asset, coords, front, keys, light_top, loft, plan, quad, seams, side, wave
from pnshapes import _owners
import pnpaint

S = (192, 150, 212)
CX = 96
SHELL, BONE, GLOW = "purple", "bone", "plasma"
HZ = 14  # the front plane of the skull (the face)
HEAD = [(HZ, 25, 18, 86), (HZ + 12, 30, 21, 89), (HZ + 32, 27, 19, 91), (HZ + 48, 16, 12, 86)]
JAW = [(HZ - 5, 19, 6, 62), (HZ + 10, 22, 7, 63), (HZ + 36, 16, 6, 68)]
JAW_HINGE = (CX, 68.0, HZ + 34.0)
THORAX = [(HZ + 40, 20, 16, 84), (HZ + 52, 26, 21, 78), (HZ + 72, 27, 22, 66), (HZ + 90, 23, 20, 54)]
COLLAR = [(HZ + 42, 25.0, 21.0, 83), (HZ + 53, 31.0, 26.0, 78)]
ABDOMEN = [(102, 23, 20, 50), (120, 33, 27, 50), (144, 36, 30, 50), (168, 32, 27, 48), (188, 21, 19, 44), (206, 8, 8, 40)]
NECK = (CX, 84.0, HZ + 44.0)
BODY_J = (CX, 60.0, 100.0)
SHOULDER = (80.0, HZ + 56.0)  # (y, z)
SCY_X = 42
CREST_J = (CX, 100.0, HZ + 36.0)
# legs: (hip x offset, z, hip y, knee x offset, knee y, foot x offset, splay degrees)
LEGS = [(18, 108, 48, 60, 66, 86, 30.0), (26, 136, 46, 64, 62, 88, -28.0)]


def shade_facets(g: Grid, solids, ramp: str, base: int, seam: int | None = 2, width: float = 0.85) -> np.ndarray:
    """Clean colour fields: one shade per facet by the way it faces (lit
    tops, mid walls, shaded undersides) and a dark frame on facet edges
    (rule S4). No per-voxel noise."""
    idx, owner, _best, second, normals = _owners(g, solids)
    m = np.zeros(g.shape, dtype=bool)
    m[idx] = True
    shades = np.array([base + (1 if n[1] > 0.55 else (-1 if n[1] < -0.35 else 0)) for n in normals])
    cols = C(ramp, 0) + np.clip(shades[owner], 1, 7)
    g.a[idx] = np.where(g.a[idx] > 0, cols, g.a[idx]).astype(np.uint8)
    if seam is not None:
        edge = np.zeros(g.shape, dtype=bool)
        sel = second > -width
        edge[tuple(i[sel] for i in idx)] = True
        P.flat(g, edge, ramp, max(1, base - seam))
    return m


def chitin(g: Grid, solids, base: int = 4) -> np.ndarray:
    return shade_facets(g, solids, SHELL, base)


def spine_row(g: Grid, zs, top_of, h: float = 9, w: float = 3.5) -> np.ndarray:
    """Chunky bone spines along the top ridge; top_of(z) gives the ridge height."""
    m = np.zeros(g.shape, dtype=bool)
    for z in zs:
        y = top_of(z)
        m |= side(g, [(y - 4, z - 6), (y - 4, z + 6), (y + h, z + 7)], CX - w, CX + w, BONE, 6)
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
    m = chitin(g, loft(g, CX, ABDOMEN, SHELL, 4), 4)
    P.flat(g, m & (Z < 107), SHELL, 2)       # the dark waist where the sac meets the thorax
    P.flat(g, m & (Z >= 107) & (Z < 109), SHELL, 5)
    top = m & (Y >= 58) & (Z >= 109)
    # wasp bands: broad darker plates with a lit leading edge
    band = top & (np.floor((Z - 102) / 12) % 2 == 1)
    P.flat(g, band, SHELL, 3)
    P.flat(g, top & ((Z - 102) % 12 < 1.0) & (Z > 110), SHELL, 2)
    # glowing cyan vents between the bands
    for z0 in (126, 150, 174):
        vent = top & (Z >= z0) & (Z < z0 + 2) & (np.abs(X - CX) < 20)
        P.flat(g, vent, GLOW, 4)
        P.flat(g, vent & (np.abs(X - CX) < 11), GLOW, 7)
    # the egg sac on the flanks: a magenta membrane with rows of glowing eggs
    low = m & (Y < 58) & (np.abs(X - CX) > 8)
    P.flat(g, low, "magenta", 4)
    P.flat(g, low & (Y < 36), "magenta", 3)
    P.flat(g, m & (np.abs(Y - 58) < 0.8) & (np.abs(X - CX) > 8), SHELL, 2)   # the dark seam over the sac
    for row, (yy, z0) in enumerate(((49.0, 118.0), (39.0, 128.0))):
        for zc in np.arange(z0, 196, 20):
            d = np.hypot(Y - yy, Z - zc)
            P.flat(g, low & (d < 5.2), "magenta", 2)
            P.flat(g, low & (d < 4.2), GLOW, 4)
            P.flat(g, low & (d < 2.6), GLOW, 6)
            P.flat(g, low & (np.hypot(Y - yy - 1.5, Z - zc + 1.5) < 1.1), GLOW, 7)
    spine_row(g, (120, 150, 180), ridge(ABDOMEN), h=11, w=3.5)
    return g


def thorax() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m = chitin(g, loft(g, CX, THORAX, SHELL, 4), 4)
    # a pale bone breastplate on the chest (the underside of the slope)
    chest = m & (Y < 76) & (np.abs(X - CX) < 15) & (Z < HZ + 86)
    P.flat(g, chest, BONE, 5)
    P.flat(g, chest & (np.abs(X - CX) < 0.8), BONE, 3)
    P.flat(g, chest & (np.abs(X - CX) > 13.5), BONE, 3)
    # a carapace marking along the ridge: a lit stripe framed in dark
    back = m & (Y > 80) & (np.abs(X - CX) < 9)
    P.flat(g, back, SHELL, 2)
    P.flat(g, back & (np.abs(X - CX) < 7.5), SHELL, 5)
    spine_row(g, (HZ + 66, HZ + 82), ridge(THORAX), h=11, w=3.5)
    # shoulder knobs that carry the scythes
    for s in (-1, 1):
        x0, x1 = sorted((CX + s * 20, CX + s * (SCY_X - 2)))
        sy, sz = SHOULDER
        k = side(g, [(sy - 8, sz - 6), (sy - 8, sz + 8), (sy + 6, sz + 9), (sy + 10, sz + 1), (sy + 5, sz - 8)], x0, x1, SHELL, 4)
        shade_facets(g, [g.solids[-1]], SHELL, 5)
        spike = side(g, [(sy + 4, sz - 2), (sy + 4, sz + 6), (sy + 14, sz + 9)], x0 + 4, x1 - 4, BONE, 6)
        light_top(g, spike, BONE, 7)
    collar(g)
    return g


def collar(g: Grid) -> None:
    """The broken containment collar: a riveted steel band with a hazard
    stripe, a tag box with a blinking cyan lamp and a snapped chain link."""
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    loft(g, CX, COLLAR, "steel", 5)
    ring = shade_facets(g, g.solids[n0:], "steel", 5, seam=2)
    zc = (COLLAR[0][0] + COLLAR[1][0]) / 2
    pnpaint.hazard(g, ring & (np.abs(Z - zc) < 2.6), period=6, a=("orange", 4), b=("steel", 2))
    P.flat(g, ring & (np.floor(X / 5) % 2 == 0) & (np.abs(np.abs(Z - zc) - 4.0) < 0.5), "steel", 3)  # rivets
    # the tag box on top, with its lamp
    tb = plan(g, [(CX - 5, zc - 3), (CX + 5, zc - 3), (CX + 5, zc + 4), (CX - 5, zc + 4)], 102, 107, "steel", 3)
    shade_facets(g, [g.solids[-1]], "steel", 3, seam=1)
    P.flat(g, tb & (Z < zc - 2.5) & (np.abs(Y - 104.5) < 1.0) & (np.abs(X - CX) < 3.5), "orange", 5)
    lamp = plan(g, [(CX - 2, zc - 1), (CX + 2, zc - 1), (CX + 2, zc + 2), (CX - 2, zc + 2)], 107, 110, GLOW, 6)
    P.flat(g, lamp, GLOW, 6)
    P.flat(g, lamp & (Y > 109), GLOW, 7)
    # a snapped chain link hanging from the side lug
    for s, dy in ((1, 0),):
        lx = CX + s * 28.5
        lug = side(g, [(64, zc - 3), (64, zc + 3), (70, zc + 3), (70, zc - 3)], lx - 2.5, lx + 2.5, "steel", 3)
        P.flat(g, lug, "steel", 3)
        link = front(g, [(lx - 1.5, 65), (lx + 1.5, 65), (lx + 3.0, 54), (lx, 54)], zc - 1.5, zc + 1.5, "steel", 5)
        P.flat(g, link, "steel", 5)
        P.flat(g, link & (Y < 56), "steel", 3)


# ------------------------------------------------------------------ head
def head() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m = chitin(g, loft(g, CX, HEAD, SHELL, 5, k=0.34), 5)
    z0, w0, h0, y0 = HEAD[0]
    face = m & (Z < z0 + 1.2)
    P.flat(g, face, SHELL, 6)
    P.outline(g, face, SHELL, 3, normal="z")
    # a glowing cyan gem on the brow of the skull (the queen's mark)
    topf = m & (Y > y0 + h0 - 1.5) & (Z < z0 + 20)
    P.flat(g, topf & (np.abs(X - CX) + np.abs(Z - (z0 + 9)) * 0.8 < 6.5), SHELL, 3)
    P.flat(g, topf & (np.abs(X - CX) + np.abs(Z - (z0 + 9)) * 0.8 < 5), GLOW, 6)
    P.flat(g, topf & (np.abs(X - CX) + np.abs(Z - (z0 + 9)) * 0.8 < 2.5), GLOW, 7)
    P.flat(g, topf & (np.abs((Z - z0) - 16 - 0.6 * np.abs(X - CX)) < 1.5) & (np.abs(X - CX) > 6), SHELL, 3)  # one dark V over the skull
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
        P.flat(g, eye & (np.abs(X - ex + s * 0.5) < 1.3) & (np.abs(Y - ey) < 4.5), "navy", 1)
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
        horn = side(g, quad((y0 + 12, z0 + 14), (y0 + 26, z0 + 38), 6.0, 2.0, cap=0.6), hx - 4.5, hx + 4.5, BONE, 6)
        P.flat(g, horn, BONE, 6)
        light_top(g, horn, BONE, 7)
        P.flat(g, horn & (Y < y0 + 17), BONE, 4)
    return g


def jaw() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m = chitin(g, loft(g, CX, JAW, SHELL, 4, k=0.34), 4)
    z0 = JAW[0][0]
    top = JAW[0][3] + JAW[0][2]
    P.flat(g, m & (Y > top - 1.5), GLOW, 4)  # the glowing tongue bed
    P.flat(g, m & (Z < z0 + 1.2) & (Y < top - 1.5), SHELL, 5)
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
    """The queen's crown: a solid fan of three thick bone-tipped points."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    cy = CREST_J[1]
    zc = CREST_J[2]
    fan = [(CX - 16, cy - 6), (CX + 16, cy - 6), (CX + 28, cy + 16), (CX + 26, cy + 26), (CX + 15, cy + 18),
           (CX + 6, cy + 24), (CX, cy + 36), (CX - 6, cy + 24), (CX - 15, cy + 18), (CX - 26, cy + 26), (CX - 28, cy + 16)]
    m = front(g, fan, zc - 5, zc + 5, SHELL, 4)
    shade_facets(g, [g.solids[-1]], SHELL, 4)
    face = m & ((Z < zc - 4) | (Z > zc + 4))
    rr = np.hypot(X - CX, (Y - (cy - 6)) * 1.1)
    P.flat(g, face & (rr > 12), "magenta", 4)  # the inner membrane
    P.flat(g, face & (rr > 12) & (np.abs(np.sin(np.arctan2(Y - cy + 6, X - CX) * 3)) < 0.12), "magenta", 2)  # two ribs
    P.flat(g, m & (rr > 25), BONE, 6)  # bone points
    P.flat(g, m & (rr > 30), BONE, 7)
    gem = face & (np.hypot(X - CX, Y - (cy + 12)) < 3.6)
    P.flat(g, gem, GLOW, 5)
    P.flat(g, gem & (np.hypot(X - CX, Y - (cy + 12)) < 1.8), GLOW, 7)
    return g


# ------------------------------------------------------------------ limbs
def scythe(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    x = CX + s * SCY_X
    sy, sz = SHOULDER
    elbow = (sy + 30, sz - 12)
    side(g, quad((sy, sz), elbow, 7.0, 6.0, cap=0.3), x - 5, x + 5, SHELL, 4)
    arm = shade_facets(g, [g.solids[-1]], SHELL, 4)
    P.flat(g, arm & (np.abs(Y - (sy + 18)) < 1.2), SHELL, 2)
    ey, ez = elbow
    side(g, [(ey - 8, ez - 6), (ey - 8, ez + 7), (ey + 6, ez + 9), (ey + 9, ez), (ey + 4, ez - 8)], x - 6, x + 6, BONE, 5)
    shade_facets(g, [g.solids[-1]], BONE, 5, seam=2)
    # the blade: a thick sickle curving down in front of the queen
    outer = [(ey + 5, ez - 4), (ey + 3, ez - 15), (ey - 5, ez - 26), (ey - 17, ez - 33), (ey - 30, ez - 35)]
    inner = [(ey - 22, ez - 26), (ey - 14, ez - 20), (ey - 9, ez - 13), (ey - 7, ez - 5)]
    side(g, outer + inner, x - 4, x + 4, BONE, 6)
    blade = shade_facets(g, [g.solids[-1]], BONE, 6, seam=2)
    # three chunky teeth along the inner edge
    teeth = np.zeros(g.shape, dtype=bool)
    for (ya, za), (yb, zb) in list(zip(inner, inner[1:])):
        ty, tz = (ya + yb) / 2, (za + zb) / 2
        teeth |= side(g, [(ty - 3, tz - 2), (ty + 3, tz + 2), (ty - 7, tz + 6)], x - 2.5, x + 2.5, BONE, 5)
    P.flat(g, teeth, BONE, 5)
    # a glowing groove along the blade
    P.flat(g, blade & (np.abs((Y - (ey - 12)) - (Z - (ez - 21)) * 1.1) < 1.3) & (Y < ey - 3) & (Y > ey - 26), GLOW, 5)
    return g


def leg(s: int, hx: float, lz: float, hy: float, kx: float, ky: float, fx: float, cuff: bool = False) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    hip = (CX + s * hx, hy)
    knee = (CX + s * kx, ky)
    foot = (CX + s * fx, 7.0)
    front(g, quad(hip, knee, 8.5, 7.0, cap=0.2), lz - 6.5, lz + 6.5, SHELL, 4)
    thigh = shade_facets(g, [g.solids[-1]], SHELL, 4)
    front(g, quad(knee, foot, 6.6, 4.6, cap=0.2), lz - 5.5, lz + 5.5, SHELL, 4)
    shin = shade_facets(g, [g.solids[-1]], SHELL, 4)
    # pale bone lower shin with one dark joint ring
    lower = shin & (Y < 30)
    P.flat(g, lower, BONE, 5)
    light_top(g, lower, BONE, 6)
    P.flat(g, shin & (np.abs(Y - 30) < 1.2), SHELL, 2)
    if cuff:
        # a broken steel restraint cuff with a hazard band (she escaped a lab)
        a = (knee[0] + (foot[0] - knee[0]) * 0.42, knee[1] + (foot[1] - knee[1]) * 0.42)
        b = (knee[0] + (foot[0] - knee[0]) * 0.62, knee[1] + (foot[1] - knee[1]) * 0.62)
        front(g, quad(a, b, 7.4, 7.0), lz - 6.6, lz + 6.6, "steel", 5)
        cm = shade_facets(g, [g.solids[-1]], "steel", 5, seam=2)
        ym = (a[1] + b[1]) / 2
        pnpaint.hazard(g, cm & (np.abs(Y - ym) < 2.2), period=6, a=("orange", 4), b=("steel", 2))
        lamp = front(g, [(b[0] + s * 6.5, ym - 1.5), (b[0] + s * 9.0, ym - 1.5), (b[0] + s * 9.0, ym + 1.5), (b[0] + s * 6.5, ym + 1.5)], lz - 7.5, lz - 5.5, GLOW, 6)
        P.flat(g, lamp, GLOW, 6)
    claw = front(g, quad(foot, (foot[0] + s * 4, 1.6), 4.2, 1.4), lz - 4, lz + 4, BONE, 6)
    P.flat(g, claw, BONE, 6)
    P.flat(g, claw & (Y < 2.5), BONE, 4)
    # a bone knee cap and a short spur pointing out
    front(g, [(knee[0] - 7.5, knee[1] - 4), (knee[0] + 7.5, knee[1] - 4), (knee[0] + 6, knee[1] + 5), (knee[0] - 6, knee[1] + 5)], lz - 7, lz + 7, BONE, 5)
    shade_facets(g, [g.solids[-1]], BONE, 5, seam=2)
    spur = front(g, [(knee[0] + s * 2, knee[1] + 3), (knee[0] + s * 7, knee[1] - 2), (knee[0] + s * 13, knee[1] + 8)], lz - 3, lz + 3, BONE, 6)
    light_top(g, spur, BONE, 7)
    _ = thigh
    return g


# ------------------------------------------------------------------ rig
def build():
    rig = Rig()
    rig.add("xeno-queen", abdomen(), BODY_J)
    for s in (-1, 1):
        for k, (hx, lz, hy, kx, ky, fx, splay) in enumerate(LEGS):
            rig.add(f"leg-{'rl'[s > 0]}{k}", leg(s, hx, lz, hy, kx, ky, fx, cuff=(s > 0 and k == 0)), (CX + s * hx, float(hy), lz), "xeno-queen", rot=(0.0, s * splay, 0.0))
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
