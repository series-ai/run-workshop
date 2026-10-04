"""Moon rocks, in the Pirate Nation terrain style.

Chunky lunar stone sits on a framed survey pad. A rigid hazard marker,
sample geode and cyan ground beacons identify this as a mapped landing
site. No clips. Faces -Z.
"""
import numpy as np

import pnglyph
import pnpaint
from _life import P, Grid, Rig, asset, box, coords, front, light_top, mask_of, plan, rock
from pnshapes import cone

S = (48, 30, 40)
CX, CZ = 24, 20
PAD_TOP = 2


def boulder(g: Grid, bx, bz, radius, height, shade=5, fracture=False) -> np.ndarray:
    """Paint an angular lunar boulder with a few broad, clear face tones."""
    # Keep each polygon corner aligned through the rings. This makes broad
    # trapezoid faces and stepped breaks instead of twisted triangle patches.
    n = 6
    angles = np.pi / 6 + 2 * np.pi * np.arange(n) / n
    corner_shape = np.array((0.78, 1.08, 0.88, 1.12, 0.82, 1.0))

    def ring(rad):
        return [(bx + radius * rad * corner_shape[k] * np.cos(angles[k]),
                 bz + radius * rad * 0.94 * corner_shape[k] * np.sin(angles[k])) for k in range(n)]

    rings = ((0.0, 0.72), (0.24, 1.0), (0.58, 0.76),
             (0.74, 0.78), (0.94, 0.44), (1.0, 0.2))
    m = np.zeros(g.shape, dtype=bool)
    for (ta, ra), (tb, rb) in zip(rings, rings[1:]):
        y0, y1 = PAD_TOP + round(height * ta), PAD_TOP + round(height * tb)
        if y1 > y0:
            m |= plan(g, ring(ra), y0, y1, "bone", shade, top=ring(rb))
    X, Y, Z = coords(g)
    P.flat(g, m, "bone", max(5, shade))
    light_top(g, m, "bone", 7)

    # Broad cool-shadow planes give each large slope a readable break.
    angle = (np.arctan2(Z - bz, X - bx) - np.pi / 6) % (2 * np.pi)
    facet = (np.floor(angle / (np.pi / 3)) % 6).astype(int)
    P.flat(g, m & np.isin(facet, (2, 3)), "bone", 4)
    P.flat(g, m & np.isin(facet, (0, 5)), "bone", 6)

    # A single clean fracture gives the large stone one readable mark.
    if fracture:
        front = m & (Z < bz - radius * 0.55)
        line_y = PAD_TOP + height * 0.42
        crack = front & (Y > line_y - 2) & (Y < line_y + 3) & (np.abs(X - (bx - 1 + 0.3 * (Y - line_y))) < 0.7)
        branch = front & (Y > line_y) & (Y < line_y + 2) & (np.abs(X - (bx + 0.2 - 0.35 * (Y - line_y))) < 0.7)
        P.flat(g, crack | branch, "steel", 4)
    return m


def landing_pad(g: Grid) -> np.ndarray:
    """Low chamfered regolith deck with a painted steel and copper rim."""
    pts = [(2, 12), (7, 4), (21, 1), (39, 3), (46, 12), (44, 30), (34, 37), (13, 35), (3, 27)]
    inset = [(4, 12), (8, 6), (21, 3), (38, 5), (44, 13), (42, 29), (33, 35), (14, 33), (5, 26)]
    m = plan(g, pts, 0, PAD_TOP, "sand", 4, top=inset)
    X, Y, Z = coords(g)
    P.flat(g, m, "sand", 5)
    P.flat(g, m & (Y < 1), "steel", 3)
    top = m & (Y >= 1)
    P.flat(g, top, "sand", 5)

    # Hull edging frames the top deck; copper pads break the long rim.
    P.outline(g, top, "steel", 3, normal="y")
    edge_marks = top & (
        ((Z < 6) & (X > 11) & (X < 37) & (np.floor(X) % 7 < 2))
        | ((X < 6) & (Z > 13) & (Z < 27) & (np.floor(Z) % 7 < 2))
        | ((X > 41) & (Z > 14) & (Z < 27) & (np.floor(Z) % 7 < 2))
    )
    P.flat(g, edge_marks, "rust", 5)

    # Clean survey lanes and a broken cyan perimeter guide replace loose dots.
    lane = top & (((np.abs(Z - 13) < 0.7) & (X > 8) & (X < 19)) | ((np.abs(X - 39) < 0.7) & (Z > 17) & (Z < 28)))
    P.flat(g, lane, "rust", 4)
    arc = top & (np.abs(np.hypot(X - 13, Z - 12) - 6.5) < 0.65) & (X < 21) & (Z < 21)
    P.flat(g, arc, "cyan", 5)
    for bx, bz in ((8, 12), (18, 12), (13, 7), (13, 17), (39, 19), (39, 25)):
        beacon = top & (np.abs(X - bx) < 1.1) & (np.abs(Z - bz) < 1.1)
        P.flat(g, beacon, "cyan", 7)
    return m


def rocks() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    landing_pad(g)

    # Three distinct slabs of lunar stone. The main mass has broad faces.
    boulder(g, CX + 5, CZ + 2, 8.8, 14, shade=5, fracture=True)
    boulder(g, CX + 16, CZ - 6, 4.8, 8, shade=5)
    boulder(g, CX - 8, CZ + 8, 3.8, 6, shade=5)

    # Survey flag: a capped steel mast, copper clamps and a rigid hazard panel.
    px, pz = 7, 8
    mast = box(g, px, PAD_TOP, pz, px + 2, 27, pz + 2, "steel", 4)
    P.plates(g, mast, "steel", 5, size=(6, 6), rivets=True)
    P.flat(g, mast & (np.floor(Y) % 6 == 0), "steel", 3)
    foot = box(g, px - 2, PAD_TOP, pz - 2, px + 4, PAD_TOP + 2, pz + 4, "steel", 3)
    P.flat(g, foot, "steel", 4)
    P.outline(g, foot, "steel", 2, normal="y")
    P.flat(g, foot & (np.abs(X - (px + 1)) < 1.1) & (Y == PAD_TOP + 1), "cyan", 6)
    # Copper collars and a bright lamp cap sit flush on the mast.
    collar = box(g, px - 1, 7, pz - 1, px + 3, 9, pz + 3, "rust", 4)
    P.flat(g, collar & (Y == 8), "rust", 6)
    cap = box(g, px, 26, pz, px + 2, 28, pz + 2, "steel", 6)
    P.flat(g, cap & (Y == 27), "cyan", 7)
    panel = front(g, [(px + 2, 26), (px + 14, 26), (px + 14, 15), (px + 2, 15)], pz, pz + 2, "orange", 5)
    pnpaint.hazard(g, panel, period=6, a=("orange", 6), b=("steel", 3), frame="z")
    P.outline(g, panel, "rust", 2, normal="z")
    # Rigid mounting brackets tie the panel to both sides of the mast.
    for yy in (16, 24):
        box(g, px + 1, yy, pz - 1, px + 4, yy + 1, pz + 3, "steel", 5)
        box(g, px + 3, yy, pz - 1, px + 5, yy + 1, pz + 3, "rust", 5)
    pnglyph.icon(g, "-z", pz, px + 4, 16, "star", "cyan", 7)
    pnglyph.icon(g, "+z", pz + 2, px + 4, 16, "star", "cyan", 7)

    # Split sample geode is kept at the opposite end of the deck from the mast.
    gx, gz = CX + 13, CZ + 10
    geode = rock(g, gx, gz, PAD_TOP, 4.2, 5, "steel", 4, n=6, seed=7)
    gm = mask_of(g, geode)
    P.flat(g, gm, "steel", 4)
    light_top(g, gm, "steel", 5)
    # Copper cradle and cyan core make the crystals read as a sample station.
    cradle = box(g, gx - 4, PAD_TOP, gz - 4, gx + 4, PAD_TOP + 1, gz + 4, "rust", 4)
    P.flat(g, cradle, "rust", 5)
    P.outline(g, cradle, "rust", 3, normal="y")
    for dx, dz, h in ((0, 0, 6), (-1.5, 1, 4), (1.5, -1, 4)):
        c = cone(g, "y", gx + dx, gz + dz, 1.3, PAD_TOP + 3, PAD_TOP + 3 + h, "cyan", 6, n=6)
        P.flat(g, c, "cyan", 6)
        light_top(g, c, "cyan", 7)
        P.flat(g, c & (np.abs(X - (gx + dx)) < 0.8), "plasma", 7)

    # Small flush scan plates add a clear function cue without crowding the rocks.
    for bx, bz in ((22, 7), (34, 31)):
        plate = box(g, bx, PAD_TOP, bz, bx + 5, PAD_TOP + 1, bz + 4, "steel", 4)
        P.flat(g, plate, "steel", 4)
        P.outline(g, plate, "steel", 2, normal="y")
        P.flat(g, plate & (np.abs(Z - (bz + 2)) < 0.8) & (X >= bx + 1) & (X <= bx + 4), "cyan", 6)
    return g


def build():
    rig = Rig()
    rig.add("moon-rocks", rocks(), (CX, 0, CZ))
    return asset("terrain-nature", "moon-rocks", "Moon Rocks", rig.root)
