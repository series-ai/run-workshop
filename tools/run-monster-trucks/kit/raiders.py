"""Raider characters, built from the base-body concepts
(concepts/raiders/base/: the turnaround and the four-builds sheet): stocky
caricatures with a big head (about a quarter of the height), round friendly
shoulders, long thick arms, simple hands (a separate index finger, the other
three fingers together, a thumb), short legs, and boots or bare feet.

Drawn at double resolution (about 80 voxels tall, so the face gets a finer
pixel grid) and shown at half size by a `rig` node scaled 0.5, like the bikes.
Jointed for riding: root (between the feet, facing -Z) -> rig -> legs (hips)
and torso (pelvis) -> head (neck), arms (shoulders) -> hands (wrists).
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from kit import LEATHER, TEE, C, Grid, P, Part, coords, ngon
from pnshapes import last
from voxgrid import PALETTE, RAMP_SHADES

GW, GH, GD = 72, 90, 48
XC, ZC = GW // 2, GD // 2
SCALE = 0.5


@dataclass
class Build:
    """Body proportions (design voxels)."""
    hip: float = 30          # pelvis height
    shoulder: float = 56     # shoulder joint height
    neck: float = 60
    sx: float = 18.5         # shoulder joint half-width
    belly: float = 13.0      # belly depth in front of the centre
    back: float = 11.5       # back depth behind the centre
    waist: float = 19.5      # half-width at the belly
    hips: float = 16.5       # half-width at the hips
    chest: float = 0.0       # extra chest depth (the woman)
    arm: float = 5.6         # arm radius
    skin: tuple = ("skin", 4)
    hair: tuple = ("darkwood", 1)
    style: str = "short"     # short | bun


MAN = Build()
WOMAN = Build(hip=29, shoulder=53, neck=57, sx=16.5, belly=11.0, back=11.0, waist=17.0, hips=17.5, chest=2.0, arm=5.0,
              skin=("skindark", 4), style="bun")


def _g() -> Grid:
    return Grid(GW, GH, GD)


def _sect(cx, cz, w, df, db, p=2.6, n=16):
    """Rounded (x, z) cross-section: w half-wide, df deep in front (-z) and
    db deep behind (+z), so bellies and backs can differ."""
    pts = []
    for k in range(n):
        a = 2 * math.pi * k / n + math.pi / n
        c, s = math.cos(a), math.sin(a)
        d = db if s > 0 else df
        pts.append((cx + w * math.copysign(abs(c) ** (2 / p), c), cz + d * math.copysign(abs(s) ** (2 / p), s)))
    return pts


def loft_y(g: Grid, stations, ramp, shade, cx=XC, cz=ZC, p=2.6, n=16) -> np.ndarray:
    """A rounded solid swept up y through stations [(y, w, d_front, d_back), ...]."""
    return sweep_y(g, [(y, _sect(cx, cz, w, df, db, p, n)) for y, w, df, db in stations], C(ramp, shade))


def sweep_y(g: Grid, sections, colour) -> np.ndarray:
    """Prisms up y between [(y, poly), ...] sections (equal point counts).
    A slice too thin (or too small) to hold a voxel centre is merged into
    the next one, so small rounded tips still work."""
    m = np.zeros(g.shape, bool)
    k = 0
    while k < len(sections) - 1:
        (ya, pa) = sections[k]
        for j in range(k + 1, len(sections)):
            yb, pb = sections[j]
            try:
                g.prism("y", pa, ya, yb, colour, top=pb)
            except ValueError:
                if j == len(sections) - 1:
                    raise
                continue
            m |= last(g)
            break
        k = j
    return m


def _front(g: Grid, m: np.ndarray) -> np.ndarray:
    """Voxels of `m` seen from the front (-z): their -z neighbour is empty."""
    empty = g.a == 0
    nb = np.ones_like(empty)
    nb[:, :, 1:] = empty[:, :, :-1]
    return m & nb


# ---------------------------------------------------------------- feet and legs


def _boot(g: Grid, cx) -> np.ndarray:
    """Chunky boot: a rounded toe box, a shaft with a folded cuff, a sole."""
    g.prism("x", [(0, ZC - 11), (5, ZC - 11), (8.5, ZC - 7), (9, ZC + 7), (0, ZC + 7)], cx - 7.2, cx + 7.2, C(LEATHER, 3))
    m = last(g)
    m |= loft_y(g, [(6, 6.6, 7.0, 7.0), (12.5, 6.6, 7.0, 7.0), (13.5, 7.4, 7.6, 7.6), (16, 7.4, 7.6, 7.6)], LEATHER, 3, cx=cx, p=3.2)
    X, Y, Z = coords(g)
    P.flat(g, m & (Y < 1.5), LEATHER, 1)  # sole
    P.flat(g, m & (Y >= 13.5), LEATHER, 4)  # cuff
    P.flat(g, m & (Y >= 8) & (Y < 9.5), LEATHER, 2)  # strap
    return m


def _foot(g: Grid, cx, sx, skin) -> np.ndarray:
    """A bare foot: a rounded wedge from heel to toes, a separate big toe on
    the inside and the small toes as one rounded block."""
    inner = cx - sx * 3.6  # big-toe side (towards the body's centre)
    g.prism("x", [(0, ZC + 4.5), (0, ZC - 6), (2, ZC - 7), (4.5, ZC - 5), (6.5, ZC + 1), (5.5, ZC + 5), (2.5, ZC + 6)], cx - 4.4, cx + 4.4, C(*skin))
    m = last(g)
    lo, hi = sorted((cx - sx * 4.4, cx - sx * 1.6))  # big toe
    g.prism("x", [(0, ZC - 6), (0, ZC - 10), (1.5, ZC - 10.8), (3.4, ZC - 10), (3.6, ZC - 6)], lo, hi, C(*skin))
    m |= last(g)
    lo, hi = sorted((cx - sx * 1.0, cx + sx * 4.2))  # the other toes together
    g.prism("x", [(0, ZC - 6), (0, ZC - 9), (1.2, ZC - 9.6), (2.8, ZC - 9), (3.0, ZC - 6)], lo, hi, C(*skin))
    m |= last(g)
    X, Y, Z = coords(g)
    P.flat(g, m & (Y < 1), skin[0], skin[1] - 1)  # sole shadow
    return m


def _leg(name, side, b: Build, clothed: bool) -> Part:
    g = _g()
    cx = XC + side * 9.5
    skin = b.skin
    if clothed:
        _boot(g, cx)
        loft_y(g, [(15, 5.2, 5.4, 5.6), (21, 5.8, 6.0, 6.2)], *skin, cx=cx)  # bare knee
        leg = loft_y(g, [(20, 8.8, 9.4, 9.8), (b.hip + 1, 8.4, 9.6, 10.6)], "gray", 3, cx=cx)
        P.flat(g, leg & (coords(g)[1] < 21.5), "gray", 2)  # hem
    else:
        _foot(g, cx, side, skin)
        loft_y(g, [(4, 3.8, 4.0, 4.2), (7, 4.4, 4.4, 4.8), (13, 5.4, 5.4, 6.2), (18, 5.6, 5.6, 6.0),
                   (24, 7.0, 7.6, 8.2), (b.hip - 3, 6.6, 8.4, 9.6), (b.hip + 1, 5.0, 7.0, 8.0)], *skin, cx=cx)  # ankle, calf, knee, thigh
    return Part(name, g, pivot=(cx, b.hip, ZC), at=(cx - XC, b.hip, 0))


# ---------------------------------------------------------------- arms and hands


def _hand(side, b: Build, wrist_y) -> Grid:
    """A big relaxed fist that flows on from the wrist (palm to the body):
    the curled middle, ring and little fingers as one smooth mitten, a
    separate curled index finger at the front, and a thumb on the inside."""
    g = _g()
    x = XC + side * b.sx
    r, w = b.arm, wrist_y
    skin = b.skin
    loft_y(g, [(w - 9.4, 0.3 * r, 0.25 * r, 0.35 * r), (w - 8.6, 0.65 * r, 0.5 * r, 0.7 * r), (w - 7, 0.9 * r, 0.66 * r, 0.92 * r),
               (w - 4, 0.95 * r, 0.7 * r, 0.98 * r), (w - 1, 0.86 * r, 0.72 * r, 0.9 * r), (w + 1, 0.78 * r, 0.75 * r, 0.85 * r)],
           *skin, cx=x, cz=ZC + 0.5, p=2.2, n=16)  # palm and three curled fingers
    loft_y(g, [(w - 9.0, 0.2 * r, 0.2 * r, 0.2 * r), (w - 8.2, 0.42 * r, 0.36 * r, 0.36 * r), (w - 6.5, 0.5 * r, 0.42 * r, 0.42 * r),
               (w - 4.5, 0.5 * r, 0.42 * r, 0.42 * r), (w - 2.8, 0.4 * r, 0.3 * r, 0.3 * r)],
           *skin, cx=x + side * 0.12 * r, cz=ZC - 0.55 * r, p=2.2, n=12)  # curled index finger
    lean = lambda y: 0.15 * (y - w + 0.5)  # thumb leans in to the front of the fist
    sweep_y(g, [(y, _sect(x - side * (0.55 * r - lean(y) * 0.3), ZC - 0.45 * r + lean(y) * 0.4, t * r, t * r, t * r, 2.0, 12))
                for y, t in ((w - 6.6, 0.15), (w - 5.9, 0.3), (w - 4.4, 0.33), (w - 2.2, 0.36), (w - 0.4, 0.25))], C(*skin))
    return g


def _arm(side, b: Build, sleeve) -> tuple[Grid, float, float]:
    """A thick arm hanging from a round shoulder, thickest at the forearm,
    with a plain short sleeve (clothed) hugging the upper arm."""
    g = _g()
    x = XC + side * b.sx
    r = b.arm
    top = b.shoulder + 3
    wrist = b.hip - 3
    # gentle curves: a slim wrist, a full forearm, a softer elbow, a round upper arm
    loft_y(g, [(wrist, r * 0.78, r * 0.75, r * 0.85), (wrist + 4, r * 0.92, r * 0.9, r * 0.95), (wrist + 9, r * 1.08, r * 1.05, r * 1.08),
               (wrist + 14, r * 0.98, r * 0.95, r), (wrist + 18, r * 0.94, r * 0.92, r * 0.96), (top - 8, r * 1.02, r, r * 1.02),
               (top - 9, r * 1.02, r, r * 1.02), (top - 7, r * 0.88, r * 0.9, r * 0.9),
               (top - 5, r * 0.62, r * 0.66, r * 0.66), (top - 3.3, r * 0.3, r * 0.3, r * 0.3)], *b.skin, cx=x, n=16)  # round shoulder ball
    if sleeve:
        sl = loft_y(g, [(top - 13, r + 1.1, r + 1.1, r + 1.1), (top - 9, r + 1.2, r + 1.1, r + 1.2), (top - 7, r * 0.95 + 0.6, r * 0.95 + 0.3, r * 0.95 + 0.5),
                         (top - 5, r * 0.72, r * 0.72, r * 0.72), (top - 3, r * 0.38, r * 0.38, r * 0.38)], *sleeve, cx=x)
        P.flat(g, sl & (coords(g)[1] < top - 12), sleeve[0], sleeve[1] - 1)  # hem
    return g, x, wrist


# ---------------------------------------------------------------- head


def _zf(x, d=10.3):
    """Depth of the face surface in front of the head centre at x."""
    return d * max(0.0, 1 - (abs(x) / 11.0) ** 2.4) ** (1 / 2.4)


def _head(b: Build) -> Grid:
    """Skin and hair. The face features are a separate part (_features), so
    their dark voxels can't bleed into the skin texels around them."""
    hg = _g()
    n0 = b.neck
    skin, hair = b.skin, b.hair
    loft_y(hg, [(n0 - 2, 8.6, 8.0, 6.8), (n0 + 1.5, 10.8, 9.9, 8.6), (n0 + 7, 11.0, 10.4, 9.6), (n0 + 13, 11.0, 10.2, 10.0),
                (n0 + 17, 10.4, 9.6, 9.8), (n0 + 20, 8.8, 8.2, 8.6), (n0 + 22, 5.6, 5.4, 5.6)], *skin, p=2.4)
    # soft lump ears, tipping outward toward the top
    for sx in (-1, 1):
        st = [(n0 + 4.5, 10.0, 0.9, 1.2), (n0 + 6, 10.7, 1.9, 2.3), (n0 + 8.5, 11.3, 2.3, 2.7), (n0 + 11, 11.8, 2.1, 2.4),
              (n0 + 12.5, 12.0, 1.4, 1.7), (n0 + 13.3, 11.9, 0.5, 0.7)]
        sweep_y(hg, [(y, _sect(XC + sx * xc, ZC + 0.6, w, d, d, 2.0, 12)) for y, xc, w, d in st], C(skin[0], max(0, skin[1] - 1)))
    # hair: a full rounded top, a high hairline, short sideburns
    loft_y(hg, [(n0 + 15.5, 11.5, 10.4, 10.8), (n0 + 17, 11.4, 10.2, 10.9), (n0 + 19.5, 10.6, 9.4, 10.4), (n0 + 22, 8.8, 7.8, 8.8),
                (n0 + 24, 6.0, 5.2, 6.0), (n0 + 25.2, 2.6, 2.2, 2.8)], *hair, p=2.4)
    loft_y(hg, [(n0 + 3, 8.6, 0.5, 8.0), (n0 + 6, 10.6, 0.5, 9.8), (n0 + 10, 11.3, 0.5, 10.5), (n0 + 15.5, 11.5, 0.5, 10.8)],
           *hair, cz=ZC + 1, p=2.4)  # round the back, tapering into the nape
    for sx in (-1, 1):
        x0, x1 = sorted((XC + sx * 9.0, XC + sx * 11.3))
        hg.prism("x", [(n0 + 11.5, ZC - 1.0), (n0 + 11.5, ZC - 3.2), (n0 + 16, ZC - 5.5), (n0 + 16, ZC - 1.0)], x0, x1, C(*hair))
    cy = n0 + 7.5  # eye line, as in _features
    # a round bulb nose, wider at the bottom: two short tapered pieces pointing
    # forward (a many-sliced loft this small shows streaks at its seams)
    def nose(z, k, dy):
        return [(XC + 2.3 * k * math.cos(t) * (1 - 0.45 * max(0.0, math.sin(t))), cy - 1.6 + dy + 2.6 * k * math.sin(t))
                for t in (2 * math.pi * i / 16 for i in range(16))]
    hg.prism("z", nose(0, 0.95, -0.3), ZC - 11.2, ZC - 9.0, C(*skin), top=nose(0, 1.0, 0))
    hg.prism("z", nose(0, 0.45, -0.6), ZC - 12.3, ZC - 11.2, C(*skin), top=nose(0, 0.95, -0.3))
    if b.style == "bun":  # a bun on top
        loft_y(hg, [(n0 + 21, 4.0, 4.0, 4.0), (n0 + 24, 5.4, 5.2, 5.4), (n0 + 27.5, 4.4, 4.4, 4.4), (n0 + 29, 2.0, 2.0, 2.0)], *hair, cz=ZC + 3, p=2.2)
    return hg


def _features(b: Build) -> Grid:
    """Long dot eyes, short thick brows and a small smile (the nose is skin, on the head)."""
    g = _g()
    n0, skin, hair = b.neck, b.skin, b.hair
    cy = n0 + 7.5
    for ex in (-4.5, 4.5):
        g.prism("z", [(XC + ex + 1.0 * math.cos(t), cy + 2 + 2.0 * math.sin(t)) for t in (2 * math.pi * k / 12 for k in range(12))],
                ZC - _zf(ex) - 0.4, ZC - _zf(ex) + 1.2, C("navy", 0))
    for sx in (-1, 1):  # brows: two pieces each, following the curve of the head
        for x0, x1 in ((2.8, 4.9), (4.7, 6.8)):
            y0, y1 = cy + 5.3 + 0.15 * (x0 - 2.8), cy + 5.3 + 0.15 * (x1 - 2.8)
            xs = sorted((sx * x0, sx * x1))
            ya, yb = (y0, y1) if sx > 0 else (y1, y0)
            zm = _zf((x0 + x1) / 2)
            g.prism("z", [(XC + xs[0], ya), (XC + xs[1], yb), (XC + xs[1], yb + 1.4), (XC + xs[0], ya + 1.4)],
                    ZC - zm - 0.7, ZC - zm + 1.2, C(*hair))
    arc = [(XC + 2.2 * math.cos(t), cy - 6.2 + 1.4 * math.sin(t)) for t in np.linspace(math.radians(205), math.radians(335), 7)]
    arc += [(XC + 1.7 * math.cos(t), cy - 5.3 + 1.4 * math.sin(t)) for t in np.linspace(math.radians(325), math.radians(215), 5)]
    g.prism("z", arc, ZC - _zf(0, 10.2) - 0.3, ZC - _zf(0, 10.2) + 1.0, C(skin[0], max(0, skin[1] - 3)))  # small smile
    return g


# ---------------------------------------------------------------- whole figures


def _wear(g: Grid, seed: int, face: np.ndarray | None = None) -> None:
    """Pixel grunge: clumps of darker and lighter texels on cloth and leather,
    a little on hair, a whisper on skin (never on the face)."""
    rng = np.random.default_rng(seed)
    a = g.a
    ramp, shade = a // RAMP_SHADES, a % RAMP_SHADES
    blot = np.kron(rng.random(tuple(-(-s // 2) for s in a.shape)), np.ones((2, 2, 2)))[: a.shape[0], : a.shape[1], : a.shape[2]]
    fine = rng.random(a.shape)
    rate = np.zeros(a.shape)
    for rm, k in ((TEE, 1.0), ("gray", 1.0), (LEATHER, 1.0), ("darkwood", 0.5), ("skin", 0.12), ("skindark", 0.12)):
        rate[(a > 0) & (ramp == PALETTE["ramps"][rm])] = k
    if face is not None:
        rate[face] = 0
    dark = (rate > 0) & (((blot < 0.10 * rate) & (fine < 0.7)) | (fine < 0.05 * rate)) & (shade > 0)
    light = (rate > 0) & ~dark & (fine > 1 - 0.04 * rate) & (shade < RAMP_SHADES - 1)
    a[dark] -= 1
    a[light] += 1


def raider(name: str, b: Build, clothed: bool = True) -> Part:
    root = Part(name, None, pivot=(XC, 0, ZC))
    rig = root.add(Part("rig", None, pivot=(XC, 0, ZC), at=(0, 0, 0), meta={"scale": SCALE}))
    for side, s in ((1, "l"), (-1, "r")):  # +x is the raider's left
        rig.add(_leg(f"leg-{s}", side, b, clothed))
    tg = _g()
    hip, sh, nk = b.hip, b.shoulder, b.neck
    top = (TEE, 4) if clothed else b.skin
    # pelvis / seat (shorts or skin), with a round seat behind
    hipst = ([] if clothed else [(hip - 8, b.hips - 8, 5.0, 6.0)]) + [(hip - 4, b.hips - (1 if clothed else 2), 10.0 if clothed else 9.4, 11.0), (hip + 3, b.hips, 10.6, 12.6)]
    if clothed:
        seat = loft_y(tg, hipst + [(hip + 6, b.hips - 0.5, 11.0, 11.6)], "gray", 3)
    # torso: belly in front, a round back behind, round friendly shoulders.
    # Clothed, a tee hem overhangs the shorts; bare, one loft runs on from the seat.
    body = loft_y(tg, ([(hip + 3, b.hips + 0.8, 11.8, 11.8)] if clothed else hipst) + [(hip + 9, b.waist, b.belly, b.back), (hip + 15, b.waist + 0.3, b.belly - 0.4 + b.chest, b.back + 0.4),
                       (sh - 7, b.waist, 10.8 + b.chest, b.back + 0.8), (sh - 4.5, b.sx + 2.8, 10.2 + b.chest * 0.6, b.back + 0.6),
                       (sh - 2, b.sx + 3.0, 9.6, b.back), (sh, b.sx + 1.5, 9.2, 10.0), (sh + 2, b.sx - 1.5, 8.6, 9.4), (sh + 3.5, b.sx - 5.0, 8.0, 8.6),
                       (nk + 1, 8.6, 7.0, 7.4)], *top, p=2.05, n=20)
    X, Y, Z = coords(tg)
    if clothed:
        P.flat(tg, body & (Y < hip + 4.5), TEE, 3)  # tee hem
        P.flat(tg, body & (Y >= nk - 0.5) & (np.abs(X - XC + 0.5) < 7.5), b.skin[0], b.skin[1] - 1)  # neck line
        P.flat(tg, seat & (Y >= hip + 4) & (np.abs(X - XC + 0.5) < 1) & (Z < ZC), "gray", 2)  # fly seam
    torso = rig.add(Part("torso", tg, pivot=(XC, hip, ZC), at=(0, hip, 0)))
    for side, s in ((1, "l"), (-1, "r")):
        ag, x, wrist = _arm(side, b, (TEE, 4) if clothed else None)
        arm = torso.add(Part(f"arm-{s}", ag, pivot=(x, sh, ZC), at=(x - XC, sh - hip, 0), rot=(0.0, 0.0, side * 6.0)))
        arm.add(Part(f"hand-{s}", _hand(side, b, wrist), pivot=(x, wrist, ZC), at=(0, wrist - sh, 0)))
    head = torso.add(Part("head", _head(b), pivot=(XC, nk, ZC), at=(0, nk - hip, 0)))
    head.add(Part("face", _features(b), pivot=(XC, nk, ZC), at=(0, 0, 0)))
    for i, p in enumerate(root.walk()):
        if p.grid is not None and p.name != "face":
            _wear(p.grid, 7 + i * 13, (p.grid.a // RAMP_SHADES == PALETTE["ramps"][b.skin[0]]) if p.name == "head" else None)  # clean face
    return root


RAIDERS = {
    "man": lambda: raider("raider-man", MAN),
    "woman": lambda: raider("raider-woman", WOMAN),
    "man-bare": lambda: raider("raider-man-bare", MAN, clothed=False),
    "woman-bare": lambda: raider("raider-woman-bare", WOMAN, clothed=False),
}
