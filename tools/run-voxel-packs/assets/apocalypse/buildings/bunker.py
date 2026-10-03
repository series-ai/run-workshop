"""Fallout bunker, in the Pirate Nation style.

A caricature shelter: a big faceted concrete dome (true slopes) sunk in a
grassy octagonal berm, poured in painted formwork lifts with moss creeping
up. The function prop is oversized (rules F4, K1): a giant round blast door
with a hazard-striped ring and a red locking wheel fills a sloped concrete
portal, under a big radiation sign. Sandbag walls flank the approach, two
mushroom air vents and a red-and-white radio mast stand on the dome, and a
periscope turns to look around on `idle`. Detail is paint (S1). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnpaint
import pnshapes as S
from _bld import bloom, crate, part, sandbags, sign
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Part, bounds_pivot

W, H, D = 136, 100, 132
CX, CZ = 68, 72  # dome centre
BERM_R, BERM_TOP, BERM_H = 60, 52, 12
DOME_R, DOME_H = 40, 36
PORTAL_Z0 = 14  # the front of the portal


def trefoil(n: int = 15) -> list[str]:
    """Pixel rows of a radiation sign: three blades and a hub (never mirrored)."""
    c = (n - 1) / 2
    rows = []
    for r in range(n):
        row = ""
        for k in range(n):
            x, y = k - c, c - r
            rad = math.hypot(x, y)
            ang = math.degrees(math.atan2(y, x)) % 360
            blade = any(abs((ang - a + 180) % 360 - 180) < 30 for a in (30, 150, 270))
            row += "#" if (rad < 1.6 or (2.6 < rad < c + 0.4 and blade)) else "."
        rows.append(row)
    return rows


def bunker() -> tuple[Grid, tuple, tuple]:
    g = Grid(W, H, D)
    X, Y, Z = S._idx(g)
    # ---- a grassy octagonal berm (true slopes)
    g.prism("y", S.flat_ngon(CX, CZ - 2, BERM_R, 8), 0, BERM_H, C("khaki", 5), top=S.flat_ngon(CX, CZ - 2, BERM_TOP, 8))
    berm = S.last(g)
    for m, fr in S.facets(g):
        if fr == "top":
            P.flat(g, m, "khaki", 5)
            pnpaint.blotch(g, m, "khaki", 6, cell=3, chance=0.05, seed=1)
        else:
            P.stone(g, m, "sand", 5, block=(9, 4), mortar=-1, cracks=0.0, frame=fr, seed=2)
    P.flat(g, berm & (Y == BERM_H - 1) & ~(g.a == 0), "khaki", 5)
    P.flat(g, berm & (Y == BERM_H - 2), "khaki", 4)
    bloom(g, berm & (Y >= BERM_H - 1), 5, ((CX - 50, BERM_H - 1, CZ - 50), (CX + 50, BERM_H, CZ + 50)), r=(3.0, 6.0), ramp="sand", shades=(6, 6), seed=3)

    # ---- the dome: warm poured concrete in formwork lifts, moss at the foot
    def formwork(gg, mm, fr):  # poured lifts: flat panels with a darker line every 7 rows
        _x, yy, _z = S._idx(gg)
        U, _V = P.uv(gg, fr)
        P._paint(gg, mm, "sand", 6 + P._jitter(P._hash(U // 14, yy // 7, seed=4)) * ((P._hash(U // 14, yy // 7, seed=5) % np.uint64(3)) == 0))
        P.flat(gg, mm & (yy % 7 == 0), "sand", 5)

    dome = S.dome(g, CX, CZ, BERM_H, DOME_R, h=DOME_H, n=10, rings=4, ramp="sand", base=6, cap_r=6, painter=formwork, ribs=("sand", 4))
    bloom(g, dome & (Y < BERM_H + 8), 7, ((CX - 44, BERM_H, CZ - 44), (CX + 44, BERM_H + 6, CZ + 44)), r=(4.0, 7.0), ramp="khaki", shades=(5, 4), seed=5)
    P.flat(g, dome & (Y < BERM_H + 2), "khaki", 4)
    cap = box(g, CX - 5, BERM_H + DOME_H, CZ - 5, CX + 5, BERM_H + DOME_H + 2, CZ + 5, "steel", 5)

    # ---- the portal: a concrete block with a sloped top running into the dome
    px0, px1 = CX - 26, CX + 26
    g.prism("x", [(0, PORTAL_Z0), (44, PORTAL_Z0), (54, PORTAL_Z0 + 22), (0, CZ - 22)], px0, px1, C("sand", 5))
    portal = S.last(g)
    for m, fr in S.facets(g):
        P.plates(g, m, "sand", 5, size=(13, 7), rivets=False, frame=fr, seed=6)
    # a big radiation sign painted on the sloped portal roof (reads from above)
    Xc, Yc, Zc = S.coords(g)
    zc = PORTAL_Z0 + 12
    up = np.zeros(g.shape, dtype=bool)
    up[:, :-1, :] = g.a[:, 1:, :] == 0
    roof = portal & up & (Yc > 44)
    du, dv = Xc - CX, -(Zc - zc) * 1.0
    rad = np.hypot(du, dv)
    ang = np.degrees(np.arctan2(dv, du)) % 360
    blade = np.zeros(g.shape, dtype=bool)
    for a in (30, 150, 270):
        blade |= np.abs((ang - a + 180) % 360 - 180) < 30
    P.flat(g, roof & (rad < 15), "gold", 5)
    P.flat(g, roof & (rad < 15) & (rad > 13.8), "darkwood", 4)
    P.flat(g, roof & ((rad < 2.6) | ((rad > 4) & (rad < 12.5) & blade)), "darkwood", 4)
    P.flat(g, edges(box(g, px0 - 1, 0, PORTAL_Z0 - 1, px1 + 1, 3, PORTAL_Z0 + 2, "sand", 4)), "sand", 3)
    # hazard frame posts at the portal corners
    for x0 in (px0 - 2, px1 - 4):
        post = box(g, x0, 0, PORTAL_Z0 - 2, x0 + 6, 44, PORTAL_Z0 + 4, "gold", 5)
        pnpaint.hazard(g, post, period=8, a=("gold", 5), b=("darkwood", 4))
    lintel = box(g, px0 - 2, 44, PORTAL_Z0 - 2, px1 + 2, 49, PORTAL_Z0 + 4, "gold", 5)
    pnpaint.hazard(g, lintel, period=8, a=("gold", 5), b=("darkwood", 4))

    # ---- the function prop: a giant round blast door with a locking wheel
    dc, dy, dr = CX, 21.5, 18
    ring = S.disc(g, "z", dc, dy, dr + 3, PORTAL_Z0 - 2, PORTAL_Z0, "gold", 5, n=12)
    pnpaint.hazard(g, ring, period=6, a=("gold", 5), b=("darkwood", 4))
    door = S.disc(g, "z", dc, dy, dr, PORTAL_Z0 - 5, PORTAL_Z0 - 1, "steel", 6, n=12)
    P.plates(g, door, "steel", 6, size=(8, 8), rivets=True, seed=7)
    rr = S.radial(g, "z", dc, dy)
    P.flat(g, door & (rr > dr - 1.6), "steel", 4)
    P.flat(g, door & (rr > dr - 4.5) & (rr < dr - 3.5), "steel", 4)
    hub = S.disc(g, "z", dc, dy, 4, PORTAL_Z0 - 8, PORTAL_Z0 - 5, "red", 5)
    wheel = np.zeros(g.shape, dtype=bool)
    for k in range(3):
        a = math.radians(90 + 60 * k)
        p0 = (dc - 10 * math.cos(a), dy - 10 * math.sin(a))
        p1 = (dc + 10 * math.cos(a), dy + 10 * math.sin(a))
        wheel |= S.bar(g, "z", p0, p1, 2.6, PORTAL_Z0 - 8, PORTAL_Z0 - 6, "red", 5)
    rim = S.disc(g, "z", dc, dy, 11, PORTAL_Z0 - 8, PORTAL_Z0 - 6, "red", 4, n=10)
    # the rim is a ring: repaint its middle back to the door behind by covering with the door colour
    P.flat(g, rim & (S.radial(g, "z", dc, dy) < 8.8) & ~wheel, "red", 6)
    P.flat(g, hub & (S.radial(g, "z", dc, dy) < 1.8), "gold", 6)
    # hinge blocks on the -x side
    for hy in (10, 28):
        hb = box(g, dc - dr - 6, hy, PORTAL_Z0 - 6, dc - dr + 2, hy + 6, PORTAL_Z0 - 1, "steel", 4)
        P.flat(g, edges(hb), "steel", 3)


    # ---- sandbag walls flanking the approach
    for x0 in (px0 - 16, px1 + 8):
        sandbags(g, "z", 0, PORTAL_Z0 + 12, x0, 0, rows=3, h=5, d=8, ramp="sand", base=4, seed=x0)
    sandbags(g, "x", 6, px0 - 16, 2, 0, rows=2, h=5, d=8, ramp="sand", base=4, seed=8)

    # ---- mushroom air vents (frustum caps, true slopes)
    for vx, vz, vh in ((CX + 26, CZ + 14, 16), (CX - 24, CZ + 20, 14)):
        base_y = BERM_H + 20
        S.disc(g, "y", vx, vz, 3, base_y, base_y + vh, "steel", 5, n=8)
        S.cone(g, "y", vx, vz, 7, base_y + vh, base_y + vh + 5, "teal", 5, n=8, r_top=2)
        P.flat(g, S.last(g) & (Y < base_y + vh + 1), "teal", 3)

    # ---- a red-and-white radio mast on the back of the dome (a tapered lattice)
    mx, mz = CX + 14, CZ + 18
    g.prism("y", S.flat_ngon(mx, mz, 3, 4), BERM_H + 24, 96, C("bone", 6), top=S.flat_ngon(mx, mz, 1.2, 4))
    mast = S.last(g)
    P.flat(g, mast & ((Y // 8) % 2 == 0), "red", 5)
    box(g, mx - 1, 94, mz - 1, mx + 1, 97, mz + 1, "gold", 7)
    S.bar(g, "z", (mx - 12, BERM_H + 22), (mx, 80), 1.2, mz, mz + 1, "steel", 4)  # a guy wire
    S.bar(g, "z", (mx + 12, BERM_H + 22), (mx, 80), 1.2, mz, mz + 1, "steel", 4)

    # ---- props: supply crates, a drum, a jerry can by the door
    crate(g, 12, 0, 20, 12, ramp="khaki", base=5, icon="cross", ink=("red", 5), seed=9)
    crate(g, 14, 12, 22, 8, seed=10)
    S.drum(g, 118, 24, 0, 20, 10, ramp="gold", base=5, band=("bone", 6), icon="skull", ink=("darkwood", 4), seed=11)

    # periscope: a pipe up through the dome crown with a hooded head, facing -z
    peri = Grid(W, H, D)
    top = BERM_H + DOME_H + 2
    S.disc(peri, "y", CX, CZ, 2.5, top - 2, top + 16, "steel", 5, n=8)
    head = box(peri, CX - 4, top + 14, CZ - 6, CX + 4, top + 22, CZ + 5, "teal", 5)
    P.flat(peri, edges(head), "teal", 3)
    lens = box(peri, CX - 3, top + 16, CZ - 7, CX + 3, top + 20, CZ - 6, "cyan", 7)
    P.outline(peri, lens, "steel", 4, normal="z")
    return g, peri, (CX, top, CZ)


def build() -> Asset:
    g, peri, hinge = bunker()
    pivot = bounds_pivot(g)
    root = Part("bunker", g, pivot=pivot)
    part(root, "periscope", peri, hinge)
    look = [(0.0, (0, 0, 0)), (1.5, (0, 90, 0)), (2.5, (0, 90, 0)), (4.0, (0, -60, 0)), (5.0, (0, -60, 0)), (6.0, (0, 0, 0))]
    return Asset(id="apocalypse-buildings-bunker", pack="apocalypse", category="buildings", name="Fallout Bunker", root=root,
                 clips=[Clip("idle", {"periscope": {"rot": look}})])
