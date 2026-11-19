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
Clips: idle (breathe, look, jaw), move (a heavy march on diagonal leg
pairs, the body dropping on every plant), attack (rear, double slash, jaw wide,
goo from the mouth socket), hit (recoil), death (collapse). Faces -Z.
"""
import numpy as np

from voxgrid import C
from _motion import DEATH_FLOOR, curve
from _trim import squeeze
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
    # Keep the large shell facets clean. The nearest-face edge mask makes
    # broken pixel trails on this shallow loft, so armor divisions are painted
    # as deliberate bands on the visible surfaces below.
    return shade_facets(g, solids, SHELL, base, seam=None)


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
    # Broad armor plates use clean dark seams and small caution marks.
    for z0 in (120, 140, 160, 180, 198):
        seam = top & (np.abs(Z - z0) < 0.8)
        P.flat(g, seam, SHELL, 2)
        panel = top & (Z >= z0 + 1) & (Z < z0 + 17)
        P.flat(g, panel & (np.abs(X - CX) > 10) & (np.abs(X - CX) < 28), "steel", 5)
        P.flat(g, panel & (np.abs(X - CX) > 26), "steel", 3)
        for s in (-1, 1):
            caution = panel & (np.abs(X - (CX + s * 18)) < 1.5) & (np.abs(Z - (z0 + 8)) < 2.5)
            P.flat(g, caution, "orange", 5)
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
    # Put the lab ID plate on the visible chest, below the jaw.
    badge = chest & (Z > HZ + 49) & (Z < HZ + 60) & (Y > 58) & (Y < 72) & (np.abs(X - CX) < 9)
    P.flat(g, badge, "steel", 3)
    P.flat(g, badge & (Y > 60) & (Y < 70) & (np.abs(X - CX) < 6), "orange", 5)
    P.flat(g, badge & (Y > 63) & (Y < 67) & (np.abs(X - CX) < 2), GLOW, 7)
    # a carapace marking along the ridge: a lit stripe framed in dark
    back = m & (Y > 80) & (np.abs(X - CX) < 9)
    P.flat(g, back, SHELL, 2)
    P.flat(g, back & (np.abs(X - CX) < 7.5), SHELL, 5)
    # Paired steel shoulder panels tie the organic shell to the space theme.
    for s in (-1, 1):
        plate = m & (Y > 82) & (Y < 97) & (Z > HZ + 51) & (Z < HZ + 69) & (np.abs(X - (CX + s * 18)) < 5)
        P.flat(g, plate, "steel", 5)
        P.flat(g, plate & (np.abs(Z - (HZ + 60)) < 1), "orange", 5)
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
    # A warning badge and status light face forward below the jaw.
    badge = ring & (Z < COLLAR[1][0] + 2) & (Y > 51) & (Y < 61) & (np.abs(X - CX) < 9)
    P.flat(g, badge, "steel", 3)
    P.flat(g, badge & (Y > 52) & (Y < 60) & (np.abs(X - CX) < 6), "orange", 5)
    P.flat(g, badge & (Y > 54) & (Y < 58) & (np.abs(X - CX) < 2), GLOW, 7)
    # the tag box on top, with its lamp
    tb = plan(g, [(CX - 6, zc - 3), (CX + 6, zc - 3), (CX + 6, zc + 4), (CX - 6, zc + 4)], 100, 108, "steel", 4)
    shade_facets(g, [g.solids[-1]], "steel", 3, seam=1)
    P.flat(g, tb & (Z < zc - 2.5) & (np.abs(Y - 104.0) < 2.0) & (np.abs(X - CX) < 4.5), "orange", 5)
    lamp = plan(g, [(CX - 2.5, zc - 1), (CX + 2.5, zc - 1), (CX + 2.5, zc + 2), (CX - 2.5, zc + 2)], 108, 111, GLOW, 6)
    P.flat(g, lamp, GLOW, 6)
    P.flat(g, lamp & (Y > 109), GLOW, 7)
    # A side tag makes the containment collar read as lab hardware.
    tag = ring & (X > CX + 21) & (X < CX + 33) & (Y > 66) & (Y < 82) & (Z > COLLAR[0][0] - 1) & (Z < COLLAR[1][0] + 1)
    P.flat(g, tag, "steel", 3)
    P.flat(g, tag & (Y > 69) & (Y < 79) & (Z > zc - 2) & (Z < zc + 2), "orange", 5)
    P.flat(g, tag & (Y > 72) & (Y < 76) & (Z > zc - 1) & (Z < zc + 1), GLOW, 7)


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
    # The mouth stays open and readable. Two large fangs frame the cavity.
    throat = front(g, [(CX - 19, 55), (CX + 19, 55), (CX + 17, 70), (CX - 17, 70)], z0 + 3, z0 + 26, GLOW, 4)
    P.flat(g, throat, GLOW, 4)
    P.flat(g, throat & (Z < z0 + 9) & (np.abs(X - CX) < 12), GLOW, 6)
    # Two corner fangs only. The clear gap keeps the eyes and mouth separate.
    fangs = np.zeros(g.shape, dtype=bool)
    for x in (CX - 15, CX + 15):
        fangs |= front(g, [(x - 2.5, y0 - h0 + 1), (x + 2.5, y0 - h0 + 1), (x, y0 - h0 - 8)], z0 + 1, z0 + 4, BONE, 7)
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
        cheek = front(g, quad((CX + s * 24, y0 - 15), (CX + s * 29, y0 + 2), 3.4, 2.2), z0 + 2, z0 + 16, "steel", 5)
        light_top(g, cheek, "steel", 6)
        P.flat(g, cheek & (Z < z0 + 4), "orange", 5)
    # two bone horns sweeping back from the top corners of the skull
    for s in (-1, 1):
        hx = CX + s * 17
        horn = side(g, quad((y0 + 12, z0 + 14), (y0 + 25, z0 + 36), 5.0, 1.8, cap=0.6), hx - 3.5, hx + 3.5, SHELL, 5)
        P.flat(g, horn, SHELL, 5)
        light_top(g, horn, SHELL, 6)
        P.flat(g, horn & (Y < y0 + 17), "steel", 5)
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
    for k, x in enumerate(np.linspace(CX - 12, CX + 12, 3)):
        big = k in (0, 2)
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
    # Keep the three crown tips pale. A broad bone rim merged with the head.
    P.flat(g, m & (rr > 25), SHELL, 5)
    P.flat(g, m & (Y > cy + 27) & (np.abs(X - CX) < 5), BONE, 6)
    P.flat(g, m & (Y > cy + 19) & (np.abs(X - CX) > 21) & (np.abs(X - CX) < 28), BONE, 6)
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
    side(g, [(ey - 8, ez - 6), (ey - 8, ez + 7), (ey + 6, ez + 9), (ey + 9, ez), (ey + 4, ez - 8)], x - 6, x + 6, "steel", 5)
    shade_facets(g, [g.solids[-1]], "steel", 5, seam=1)
    # the blade: a thick sickle curving down in front of the queen
    outer = [(ey + 5, ez - 4), (ey + 3, ez - 15), (ey - 5, ez - 26), (ey - 17, ez - 33), (ey - 30, ez - 35)]
    inner = [(ey - 22, ez - 26), (ey - 14, ez - 20), (ey - 9, ez - 13), (ey - 7, ez - 5)]
    side(g, outer + inner, x - 4, x + 4, "steel", 5)
    blade = shade_facets(g, [g.solids[-1]], "steel", 5, seam=1)
    # A small white edge keeps the steel blade clear from the face.
    P.flat(g, blade & (np.abs((Y - (ey - 22)) - (Z - (ez - 26)) * 0.8) < 1.5), BONE, 6)
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
    thigh = shade_facets(g, [g.solids[-1]], SHELL, 4, seam=None)
    front(g, quad(knee, foot, 6.6, 4.6, cap=0.2), lz - 5.5, lz + 5.5, SHELL, 4)
    shin = shade_facets(g, [g.solids[-1]], SHELL, 4, seam=None)
    # Wide steel rails, copper joints and cyan marks detail each leg.
    t = np.clip((Y - ky) / (foot[1] - ky), 0.0, 1.0)
    leg_center = knee[0] + (foot[0] - knee[0]) * t
    rail = shin & (np.abs(X - leg_center) < 3.5) & (Y > 12) & (Y < 60)
    P.flat(g, rail, "steel", 5)
    P.flat(g, rail & (np.abs(X - leg_center) < 1.4), "steel", 6)
    P.flat(g, shin & (np.abs(Y - (ky + 2)) < 1.5) & (np.abs(X - leg_center) > 3), "orange", 5)
    P.flat(g, thigh & (np.abs(Y - (hy - 4)) < 1.5), "steel", 5)
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
        pnpaint.hazard(g, cm & (np.abs(Y - ym) < 3.2), period=6, a=("orange", 5), b=("steel", 2))
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


def march(T: int = 48, stride: float = 14.0, lift: float = 9.0) -> dict:
    """The move clip: a heavy boss march on diagonal leg pairs, keyed every frame.

    The front-left and back-right legs plant together on frame 0, the other
    pair on frame 24. Each rigid leg is solved (yaw about the hip, then a
    tilt about its own long axis) so its claw tip stays on the floor and
    slides back at a constant ground speed through the stance; the swing pair
    rips up in 2 frames, carries forward high and slams down in 3 frames,
    accelerating. Every plant thunders: the whole body drops hard (2 frames)
    and rises slowly, the thorax, jaw, head and scythes follow a frame or
    two late. The body sways sideways over the planted pair (that sway also
    keeps the planted claws from skating sideways, since a rigid leg swept
    about its hip draws an arc). Loops seamlessly."""
    import math

    def ry(a, v):
        c, sn = math.cos(a), math.sin(a)
        return (v[0] * c + v[2] * sn, v[1], -v[0] * sn + v[2] * c)

    def rz(a, v):
        c, sn = math.cos(a), math.sin(a)
        return (v[0] * c - v[1] * sn, v[0] * sn + v[1] * c, v[2])

    def claw(s, k, b, a):
        hx, lz, hy, kx, ky, fx, splay = LEGS[k]
        return ry(math.radians(s * splay), rz(a, ry(b, (s * (fx + 4 - hx), 1.0 - hy, 0.0))))

    def solve(s, k, ty, tz):
        b = a = 0.0
        for _ in range(60):
            x, y, zz = claw(s, k, b, a)
            ey, ez = y - ty, zz - tz
            if abs(ey) + abs(ez) < 1e-9:
                break
            h = 1e-6
            _, yb, zb = claw(s, k, b + h, a)
            _, ya, za = claw(s, k, b, a + h)
            j00, j01, j10, j11 = (yb - y) / h, (ya - y) / h, (zb - zz) / h, (za - zz) / h
            det = j00 * j11 - j01 * j10
            b -= (j11 * ey - j01 * ez) / det
            a -= (-j10 * ey + j00 * ez) / det
        return b, a, claw(s, k, b, a)[0]

    drop_keys = [(0, 0.0), (1, -1.4), (2, -2.2), (4, -1.8), (11, -0.5), (17, 0.4), (21, 0.3), (24, 0.0)]

    def drop(q):
        for (q0, v0), (q1, v1) in zip(drop_keys, drop_keys[1:]):
            if q0 <= q <= q1:
                u = (q - q0) / (q1 - q0)
                if q0 >= 2:
                    u = u * u * (3 - 2 * u)
                return v0 + (v1 - v0) * u
        return 0.0

    rise = 0.23  # the built claws sit this much below the claw-tip estimate (measured with clip_probe)
    half = T // 2
    v = stride / half
    pairs = {0: [(1, 0), (-1, 1)], 1: [(-1, 0), (1, 1)]}
    rows = []
    for f in range(T):
        ph, q = (0 if f < half else 1), f % half
        d = drop(q)
        legs, slip = {}, []
        for s, k in pairs[ph]:
            hy = LEGS[k][2]
            z0 = claw(s, k, 0.0, 0.0)[2]
            b, a, x = solve(s, k, 1.0 - hy - d + rise, z0 - stride / 2 + v * q)
            slip.append(x - solve(s, k, 1.0 - hy + rise, z0)[2])
            legs[(s, k)] = (b, a)
        for s, k in pairs[1 - ph]:
            hy = LEGS[k][2]
            z0 = claw(s, k, 0.0, 0.0)[2]
            if q <= 2:
                zz, up = z0 + stride / 2 + v * q * 0.5, (lift * (q / 2) ** 0.7 if q else 0.0)
            elif q <= half - 3:
                zz, up = z0 + stride / 2 + v - (stride + v) * (q - 2) / (half - 5), lift
            else:
                u = (q - (half - 3)) / 3
                zz, up = z0 - stride / 2, lift * (1 - u * u)
            b, a, _ = solve(s, k, 1.0 - hy - d + rise + up, zz)
            legs[(s, k)] = (b, a)
        rows.append((d, -sum(slip) / 2, legs))
    out = {n: {"rot": []} for n in ("head", "jaw", "crest", "scythe-l", "scythe-r")}
    out["xeno-queen"] = {"loc": []}
    out["body"] = {"loc": [], "rot": []}
    for s in (-1, 1):
        for k in range(len(LEGS)):
            out[f"leg-{'rl'[s > 0]}{k}"] = {"rot": []}
    for f in range(T + 1):
        t = f / 30
        g = f + 19  # the loop point falls mid-stance, between plants
        d, sway, legs = rows[g % T]
        d1, d2, d3 = rows[(g - 1) % T][0], rows[(g - 2) % T][0], rows[(g - 3) % T][0]
        out["xeno-queen"]["loc"].append((t, (sway, d, 0.0)))
        for (s, k), (b, a) in legs.items():
            out[f"leg-{'rl'[s > 0]}{k}"]["rot"].append((t, (0.0, math.degrees(b), math.degrees(a))))
        out["body"]["loc"].append((t, (0.0, 0.6 * (d1 - d), 0.0)))
        out["body"]["rot"].append((t, (0.8 * d1, 0.35 * sway, -0.5 * sway)))
        out["head"]["rot"].append((t, (1.6 * d2, -0.5 * sway, 0.0)))
        out["jaw"]["rot"].append((t, (1.5 * d1, 0.0, 0.0)))
        out["crest"]["rot"].append((t, (1.5 * d3, 0.0, 0.0)))
        out["scythe-l"]["rot"].append((t, (2.2 * d2 + 0.8 * sway, 0.0, 0.0)))
        out["scythe-r"]["rot"].append((t, (2.2 * d2 - 0.8 * sway, 0.0, 0.0)))
    return out


# ------------------------------------------------------------------ rig
def build():
    rig = Rig()
    rig.add("xeno-queen", abdomen(), BODY_J)
    for s in (-1, 1):
        for k, (hx, lz, hy, kx, ky, fx, splay) in enumerate(LEGS):
            rig.add(f"leg-{'rl'[s > 0]}{k}", leg(s, hx, lz, hy, kx, ky, fx, cuff=(k == 0)), (CX + s * hx, float(hy), lz), "xeno-queen", rot=(0.0, s * splay, 0.0))
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
    # Scythe slash and spit: the queen rears her thorax up and back,
    # twisting, both scythes raised high and the jaw cocked, hangs, then
    # lunges the thorax down and forward, slashing both scythes down (the
    # left a beat behind) and spitting acid from the gaping jaw (impact
    # 0.533 s); she drives on past it, holds the lunge with the scythes
    # still working, then rears back past rest and settles. The abdomen and
    # the legs stay planted.
    F = 1 / 30
    hit_t = 16 * F
    attack = {"body": {"rot": curve((0, z), (6, (8, 0, 0)), (12, (18, 0, -4)), (14, (19, 0, -4)), (16, (-12, 0, 4)), (18, (-16, 0, 5)), (21, (-9, 0, 7)),
                                    (24, (-14, 0, -1)), (27, (-6, 0, 1)), (31, (5, 0, -1)), (35, (-1, 0, 0)), (38, z)),
                       "loc": curve((0, z), (12, (0, 1, 3)), (14, (0, 1.2, 3.2)), (16, (0, -1, -6)), (18, (0, -1.5, -7)), (21, (0, -1.2, -6.2)), (24, (0, -1.4, -6.6)),
                                    (30, (0, 0, 1)), (38, z))},
              "head": {"rot": curve((0, z), (12, (-14, 0, 0)), (14, (-15, 0, 0)), (16, (16, 0, 0)), (18, (20, 0, 0)), (21, (10, 12, 0)), (24, (20, -10, 0)),
                                    (27, (8, 4, 0)), (31, (-8, 0, 0)), (35, (2, 0, 0)), (38, z))},
              "jaw": {"rot": curve((0, z), (12, (-8, 0, 0)), (15, (-40, 0, 0)), (18, (-42, 0, 0)), (24, (-30, 0, 0)), (30, (-10, 0, 0)), (38, z))},
              "crest": {"rot": curve((0, z), (12, (-16, 0, 0)), (16, (12, 0, 0)), (19, (16, 0, 0)), (24, (8, 0, 0)), (30, (-6, 0, 0)), (38, z))},
              "scythe-r": {"rot": curve((0, z), (6, (30, 0, -8)), (12, (62, 0, -12)), (14, (64, 0, -12)), (16, (-46, 0, 10)), (18, (-58, 0, 12)), (21, (-38, 0, 4)),
                                        (24, (-54, 0, 12)), (27, (-30, 0, 6)), (31, (12, 0, -3)), (35, (-2, 0, 0)), (38, z))},
              "scythe-l": {"rot": curve((0, z), (8, (30, 0, 8)), (14, (62, 0, 12)), (17, (64, 0, 12)), (19, (-46, 0, -10)), (21, (-58, 0, -12)), (24, (-38, 0, -4)),
                                        (27, (-54, 0, -12)), (30, (-28, 0, -6)), (34, (12, 0, 3)), (38, z))}}
    # Knockback: the blow shoves the queen back with a small hop, the
    # thorax and head snap back, the jaw gapes and the scythes fly up; she
    # lands with her weight dropping forward, holds a beat and settles.
    hit = {"xeno-queen": {"loc": keys((0, z), (2 * F, (0, 2.0, 2.6)), (4 * F, (0, 2.8, 4.2)), (6 * F, (0, 2.0, 4.7)), (8 * F, (0, 0, 4.4)), (12 * F, (0, -0.4, 4.0)),
                                      (18 * F, (0, 0, 3.4)), (26 * F, (0, 0, 0.4)), (32 * F, z))},
           "body": {"rot": keys((0, z), (2 * F, (10, 6, 0)), (6 * F, (14, 8, 0)), (11 * F, (-6, 0, 0)), (17 * F, (3, 0, 0)), (24 * F, (-2, 0, 0)), (32 * F, z))},
           "head": {"rot": keys((0, z), (4 * F, (14, -12, 6)), (8 * F, (20, -14, 6)), (13 * F, (-10, 0, 0)), (19 * F, (4, 0, 0)), (32 * F, z))},
           "jaw": {"rot": keys((0, z), (3 * F, (-24, 0, 0)), (8 * F, (-30, 0, 0)), (14 * F, (-6, 0, 0)), (20 * F, (-12, 0, 0)), (32 * F, z))},
           "crest": {"rot": keys((0, z), (4 * F, (-16, 0, 0)), (10 * F, (10, 0, 0)), (16 * F, (-4, 0, 0)), (24 * F, z), (32 * F, z))},
           "scythe-l": {"rot": keys((0, z), (3 * F, (24, 0, 14)), (7 * F, (30, 0, 18)), (12 * F, (-10, 0, -4)), (18 * F, (5, 0, 0)), (32 * F, z))},
           "scythe-r": {"rot": keys((0, z), (4 * F, (24, 0, -14)), (8 * F, (30, 0, -18)), (13 * F, (-10, 0, 4)), (19 * F, (5, 0, 0)), (32 * F, z))}}
    for s in (-1, 1):
        for k in range(len(LEGS)):
            hit[f"leg-{'rl'[s > 0]}{k}"] = {"rot": keys((0, z), (4 * F, (0, 0, s * 0.8)), (8 * F, z), (11 * F, (0, 0, -s * 0.3)), (18 * F, z), (32 * F, z))}
    # Death: the queen screeches with her head snapped back, rocks with the
    # scythes raised, then her legs splay out flat, the feet sliding
    # outward along the floor while the body drops onto its belly (impact
    # 1.067 s); one small bounce, then the thorax and head crash forward
    # onto the ground a beat later, the scythes slap down and the jaw and
    # crest settle last. The leg angles are solved so the claws stay on
    # the floor while the body drops.
    die_t = 32 * F
    BOW, JAW, FRONT, SINK, SCY = -10.0, 4.0, 16.0, 11.0, -38.0
    SCY_R = -80.0  # the raised right scythe flops down late  # the thorax, jaw and splayed front legs at rest
    drop = [(0, 0.0), (4, 0.4), (14, 1.5), (20, 2.0), (23, 1.2), (26, -2.5), (29, -9.5), (32, -20.5), (35, -19.3), (38, -20.5), (64, -20.5)]
    leg_angles = {0: [(0, 0.0), (4, -0.32), (14, -1.2), (20, -1.61), (23, -0.96), (26, 1.97), (29, 7.27), (32, 15.16), (35, 14.32), (37, 16.0), (40, FRONT + 0.6), (44, FRONT + 1.4), (48, FRONT + 0.3), (64, FRONT)], 1: [(0, 0.0), (4, -0.35), (14, -1.31), (20, -1.76), (23, -1.05), (26, 2.14), (29, 7.89), (32, 16.4), (35, 15.49), (38, 16.4), (64, 16.4)]}
    death = {"xeno-queen": {"loc": curve(*[(f, (0, y, 0)) for f, y in drop])},
             "body": {"rot": curve((0, z), (4, (8, 4, 0)), (11, (-10, 0, 4)), (15, (-4, 0, -4)), (19, (-13, 0, 3)), (23, (-6, 0, 0)), (31, (6, 0, 4)), (36, (-2, 0, 6)), (40, (BOW + 6, 0, 5)), (43, (BOW + 1, 0, 6)),
                                   (47, (BOW + 0.5, 0, 6)), (64, (BOW, 0, 6))),
                      "loc": curve((0, z), (35, z), (40, (0, -SINK, -2)), (43, (0, -SINK + 1.0, -2)), (46, (0, -SINK, -2)), (64, (0, -SINK, -2)))},
             "head": {"rot": curve((0, z), (4, (24, -10, 0)), (11, (-14, 8, 0)), (15, (-4, -10, 0)), (19, (-18, 6, 0)), (23, (-8, 0, 0)), (31, (-10, 6, 0)), (39, (-2, 18, 0)), (44, (8, 16, 0)),
                                   (50, (4, 18, 0)), (64, (4, 18, 0)))},
             "jaw": {"rot": curve((0, z), (4, (-34, 0, 0)), (14, (-36, 0, 0)), (20, (-38, 0, 0)), (31, (-20, 0, 0)), (36, (6, 0, 0)), (41, (JAW - 6, 0, 0)),
                                  (47, (JAW, 0, 0)), (64, (JAW, 0, 0)))},
             "crest": {"rot": curve((0, z), (4, (10, 0, 0)), (14, (-14, 0, 0)), (31, (6, 0, 0)), (39, (-28, 0, 0)), (44, (-12, 0, 0)), (50, (-20, 0, 0)),
                                    (64, (-20, 0, 0)))},
             "scythe-l": {"rot": curve((0, z), (4, (14, 0, 6)), (11, (50, 0, 10)), (15, (38, 0, 4)), (19, (56, 0, 12)), (23, (40, 0, 6)), (31, (-20, 0, -14)), (37, (SCY - 4, 0, -20)), (41, (SCY + 8, 0, -18)),
                                       (47, (SCY, 0, -20)), (64, (SCY, 0, -20)))},
             "scythe-r": {"rot": curve((0, z), (4, (14, 0, -6)), (12, (50, 0, -10)), (16, (36, 0, -4)), (20, (56, 0, -12)), (24, (40, 0, -6)), (31, (-22, 0, 14)), (38, (SCY - 4, 0, 20)), (42, (SCY + 8, 0, 18)),
                                       (48, (SCY, 0, 20)), (51, (SCY_R - 4, 0, 26)), (54, (SCY_R + 3, 0, 25)), (58, (SCY_R, 0, 26)), (64, (SCY_R, 0, 26)))}}
    for s in (-1, 1):
        for k in range(len(LEGS)):
            death[f"leg-{'rl'[s > 0]}{k}"] = {"rot": curve(*[(f, (0, 0, s * a)) for f, a in leg_angles[k]])}
    # Sterf's rules: a hit is over in 0.6 s, a death is still a few frames
    # after its last flop. The blow, the belly drop and the thorax crash keep
    # their timing; the recovery and the late settles are tightened.
    hit = squeeze(hit, keep=8, old_end=32, new_end=18)
    death = squeeze(death, keep=41, old_end=64, new_end=52)
    return asset("creatures", "xeno-queen", "Xeno Queen", rig.root,
                 clips=[Clip("idle", idle), Clip("move", march(), ease=0, floor=False), Clip("attack", attack, loop=False, impact=hit_t), Clip("hit", hit, loop=False, floor=True), Clip("death", death, loop=False, impact=die_t, floor=DEATH_FLOOR)],
                 sockets=[mouth], pfx=[{"effectId": "rvx-space-acid-spray", "socket": "socket-mouth", "trigger": "clip:attack", "size": 70, "aim": [-0.288, -0.242, -0.927], "at": round(hit_t, 3)}])
