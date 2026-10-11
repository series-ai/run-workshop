"""Art-director repair models (group: anim).

This module builds nine new monster models after the art-director review:
the animated props jack-in-the-box, music-box, blood-fountain, bat-roost,
lab-generator, ouija-table, rising-grave and swinging-lantern, and the prop
garlic-wreath-post.

The review found one shared defect in all nine: a square grey stone curb
with a flat olive inset (the old `_base`). No model here uses that curb.
Each model stands on its own feet or on its own ground piece:
- jack-in-the-box and music-box: gold bun feet under the toy box.
- blood-fountain: the octagon basin is the ground piece.
- lab-generator: riveted iron foot plates and an iron coil plinth.
- ouija-table: the table legs on carved foot blocks.
- rising-grave: stone kerbs and a dirt grave mound.
- swinging-lantern: four cast-iron braces on a small irregular moss patch.
- bat-roost: four wood braces on a larger irregular moss patch.
- garlic-wreath-post: a dirt mound with stones.

The review rated bat-roost, lab-generator, ouija-table, rising-grave,
swinging-lantern and garlic-wreath-post as "pass". For these models, the
code is a copy of the old code in _double.py. Only the ground changes, and
the parts move down where the old curb is gone.

jack-in-the-box, music-box and blood-fountain are new builds (findings A1,
A2 and A3). They keep their part names, clip names, sockets and PFX
bindings.
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _double import _metal, _stone, _wood
from _kit import C, Clip, Grid, Socket, keys, pfx, world
from _life import eyes, octo
from _pn import assemble, coords, last
from _props import grave, mound, tufts, union
from pnkit import box, edges
from pnpaint import blotch

DOWN = -math.pi / 2


# ---------------------------------------------------------------- helpers
def _rot_yz(pts, cy: float, cz: float, deg: float):
    """Turn (y, z) points about (cy, cz) by `deg` about +x (+y turns to +z)."""
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return [(cy + (y - cy) * c - (z - cz) * s, cz + (y - cy) * s + (z - cz) * c) for y, z in pts]


def _patch(g: Grid, cx: float, cz: float, rx: float, rz: float, seed: int = 0, n: int = 11) -> np.ndarray:
    """A small irregular moss patch, one voxel high. The outline is an
    n-gon with a different radius at each corner, so no two patches are the
    same. The paint is soft moss tones, dark clumps and dirt at the rim."""
    pts = []
    for k in range(n):
        a = 2 * math.pi * k / n + seed * 0.37
        f = 0.78 + 0.22 * (((k * 7 + seed * 3) % 5) / 4.0)
        pts.append((cx + rx * f * math.cos(a), cz + rz * f * math.sin(a)))
    g.prism("y", pts, 0, 1, C("moss", 4))
    m = last(g)
    P.mottle(g, m, "moss", 4, cell=2, seed=seed)
    blotch(g, m, "moss", 2, cell=2, chance=0.12, seed=seed + 1)
    blotch(g, m, "moss", 6, cell=2, chance=0.06, seed=seed + 2)
    P.flat(g, edges(m) & ((coords(g)[0].astype(int) + coords(g)[2].astype(int) + seed) % 3 == 0), "wood", 3)
    return m


def _brace_x(g: Grid, x_post: float, x_foot: float, y0: float, y_top: float, z0: float, z1: float, ramp: str, shade: int) -> np.ndarray:
    """A tapered sloped strut in the x-y plane, from a post face at x_post
    (top y_top) down to a flat foot on y0 at x_foot (a true slope, rule F2)."""
    sgn = 1 if x_foot > x_post else -1
    pts = [(x_post, y_top), (x_post, y_top - 3.5), (x_foot - sgn * 2.5, y0), (x_foot, y0)]
    g.prism("z", pts, z0, z1, C(ramp, shade))
    return last(g)


def _brace_z(g: Grid, z_post: float, z_foot: float, y0: float, y_top: float, x0: float, x1: float, ramp: str, shade: int) -> np.ndarray:
    """The same strut in the z-y plane."""
    sgn = 1 if z_foot > z_post else -1
    pts = [(y_top, z_post), (y_top - 3.5, z_post), (y0, z_foot - sgn * 2.5), (y0, z_foot)]
    g.prism("x", pts, x0, x1, C(ramp, shade))
    return last(g)


def _lid_frame(Y, Z, hinge, deg: float):
    """For the voxels of a lid drawn open by `deg` about the hinge (y, z):
    `across` is the height above the closed lid's underside (the inner
    face is near 0) and `dist` is the distance from the hinge along the lid."""
    a = math.radians(deg)
    dy, dz = Y + 0.5 - hinge[0], Z + 0.5 - hinge[1]
    across = dy * math.cos(a) + dz * math.sin(a)
    dist = dy * math.sin(a) - dz * math.cos(a)
    return across, dist


def _harlequin(g: Grid, m: np.ndarray, a=("purple", 4), b=("magenta", 4), cell: int = 4) -> None:
    """Toy-box diamonds on the side faces: two tones in a diamond check with
    a dark 1-voxel seam between the diamonds."""
    X, Y, Z = coords(g)
    u = (X + Z).astype(int)
    v = Y.astype(int)
    d = ((u + v) // cell + (u - v) // cell) % 2 == 0
    P.flat(g, m & d, *a)
    P.flat(g, m & ~d, *b)
    seam = ((u + v) % cell == 0) | ((u - v) % cell == 0)
    P.flat(g, m & seam & d, a[0], max(1, a[1] - 2))


def _spin(seconds: float, axis: int, sign: float = 1.0, steps: int = 4):
    """Keys for one full turn about one axis, in quarter turns."""
    out = []
    for k in range(steps + 1):
        r = [0.0, 0.0, 0.0]
        r[axis] = sign * 360.0 * k / steps
        out.append((seconds * k / steps, tuple(r)))
    return out


# ---------------------------------------------------------------- jack-in-the-box (A1, A4)
def _jack_in_the_box():
    """A small toy box of painted diamonds on four gold bun feet, about 13
    high. The lid stands open on its back hinge. A clown with a white face,
    a red nose, a ruff collar and a two-point jester hat sits on a steel
    spring. A gold crank turns on the right side.

    Parts: base (box), lid, crank, spring (scales on y), action (the clown).
    Rest pose: lid open and clown up. `close` pushes the clown down into the
    box and shuts the lid; `open` turns the crank, opens the lid and pops the
    clown. The spring scales so it stays inside the box."""
    sx, sy, sz = 26, 30, 30
    cx, cz = 12.0, 11.0
    top = 13.0  # top of the box walls
    hinge = (top, 18.0)  # (y, z) of the back top edge
    lid_open = 120.0  # degrees from closed
    pop = 12.5  # how far the clown goes down into the box
    neck = 16.0  # bottom of the ruff when the clown is up
    base, lid, crank, spring, action = (Grid(sx, sy, sz) for _ in range(5))
    X, Y, Z = coords(base)

    # four gold bun feet
    for fx in (6.5, 17.5):
        for fz in (5.5, 16.5):
            f = S.disc(base, "y", fx, fz, 1.5, 0, 2, "gold", 4)
            P.flat(base, f & (Y == 1), "gold", 5)
            P.flat(base, f & (Y == 0), "gold", 2)
    # the box: a floor and four walls, 2 thick, hollow inside for the clown
    body = box(base, 5, 2, 4, 19, 3, 18, "purple", 4)
    for b in ((5, 3, 4, 19, top, 6), (5, 3, 16, 19, top, 18), (5, 3, 6, 7, top, 16), (17, 3, 6, 19, top, 16)):
        body |= box(base, *b, "purple", 4)
    _harlequin(base, body)
    P.flat(base, body & (np.abs(X + 0.5 - cx) < 6) & (np.abs(Z + 0.5 - cz) < 6) & (Y >= 2), "purple", 1)  # the dark inside
    # gold trim: corner posts, a top rim and a bottom band (rule S4)
    corner = body & (np.abs(X + 0.5 - cx) > 5) & (np.abs(Z + 0.5 - cz) > 5)
    P.flat(base, corner, "gold", 4)
    P.flat(base, body & (Y == top - 1) & ~((np.abs(X + 0.5 - cx) < 5) & (np.abs(Z + 0.5 - cz) < 5)), "gold", 5)
    P.flat(base, body & (Y == 2), "gold", 3)
    P.flat(base, corner & ((X == 5) | (X == 18)) & ((Z == 4) | (Z == 17)), "gold", 6)
    # a painted bone star on the front panel
    pnglyph.icon(base, "-z", 4.0, int(cx) - 4, 3, "star", "bone", 6)

    # the lid: drawn open, standing on the back hinge and leaning back
    closed = [(top, 4.0), (top + 2.0, 4.0), (top + 2.0, 18.0), (top, 18.0)]
    lid.prism("x", _rot_yz(closed, *hinge, lid_open), 4.5, 19.5, C("purple", 4))
    lm = last(lid)
    LX, LY, LZ = coords(lid)
    a = math.radians(lid_open)
    across, dist = _lid_frame(LY, LZ, hinge, lid_open)
    outer = lm & (across > 1.0)
    _harlequin(lid, outer)
    P.flat(lid, lm & (across <= 1.0), "magenta", 3)  # the inner face: worn velvet
    P.flat(lid, lm & (across <= 1.0) & (np.abs(LX + 0.5 - cx) < 3) & (np.abs(dist - 7) < 3), "gold", 6)  # a gold medallion
    P.flat(lid, lm & (across <= 1.0) & (np.abs(LX + 0.5 - cx) < 1.5) & (np.abs(dist - 7) < 1.5), "toxic", 6)
    rim = lm & ((np.abs(LX + 0.5 - cx) > 6.5) | (dist > 12.6) | (dist < 1.2))
    P.flat(lid, rim, "gold", 4)

    # the crank on the right side: a shaft, an arm and a red knob
    cy, ccz = 7.5, cz
    S.disc(crank, "x", cy, ccz, 1.1, 19, 21, "gold", 4)
    arm = S.bar(crank, "x", (cy, ccz), (cy - 3.6, ccz), 1.4, 21, 22.5, "gold", 5)
    P.flat(crank, arm & (coords(crank)[1] < cy - 2), "gold", 4)
    knob = S.disc(crank, "x", cy - 3.6, ccz, 1.2, 22.5, 25, "red", 4)
    P.flat(crank, knob & (coords(crank)[0] >= 24), "red", 5)

    # the spring: a zigzag of steel bars from the box floor to the ruff
    sp_lo, sp_hi = 3.0, neck
    n = 6
    for i in range(n):
        y0 = sp_lo + (sp_hi - sp_lo) * i / n
        y1 = sp_lo + (sp_hi - sp_lo) * (i + 1) / n
        x0, x1 = (cx - 2.5, cx + 2.5) if i % 2 == 0 else (cx + 2.5, cx - 2.5)
        S.bar(spring, "z", (x0, y0), (x1, y1), 1.1, cz - 1, cz + 1, "steel", 5)
    spm = spring.a > 0
    P.flat(spring, spm & (coords(spring)[2] < cz - 0.5), "steel", 6)

    # the clown (part "action"): ruff, white face, hair tufts, jester hat
    HX, HY, HZ = coords(action)
    action.prism("y", S.gear_poly(cx, cz, 3.6, teeth=8, depth=1.0), neck, neck + 1.5, C("bone", 6))
    ruff = last(action)
    ang = np.arctan2(HZ + 0.5 - cz, HX + 0.5 - cx)
    P.flat(action, ruff & (np.cos(ang * 4) > 0.3), "magenta", 5)
    h0, h1 = neck + 1.5, neck + 7.0
    action.prism("y", octo(cx, cz, 3.6, 3.0, 1.0), h0, h1, C("bone", 7))
    head = last(action)
    P.mottle(action, head, "bone", 7, cell=3, seed=4)
    front = head & (HZ < cz - 2)
    for ex in (cx - 2, cx + 1):  # black diamond eyes with a toxic glint
        P.flat(action, front & (HX >= ex) & (HX < ex + 1) & (HY >= h0 + 3) & (HY < h0 + 5), "purple", 1)
    P.flat(action, front & (HX == int(cx) - 2) & (HY == int(h0) + 4), "toxic", 6)
    P.flat(action, front & (HX == int(cx) + 1) & (HY == int(h0) + 4), "toxic", 6)
    grin = front & (((HY == int(h0)) & (np.abs(HX + 0.5 - cx) < 2.6)) | ((HY == int(h0) + 1) & (np.abs(HX + 0.5 - cx) > 1.6) & (np.abs(HX + 0.5 - cx) < 3.6)))
    P.flat(action, grin, "red", 4)
    P.flat(action, front & (HY == int(h0) + 2) & (np.abs(HX + 0.5 - cx) > 2.2), "magenta", 5)  # cheeks
    nose = box(action, cx - 1, h0 + 2, cz - 4, cx + 1, h0 + 4, cz - 3, "red", 5)
    P.flat(action, nose & (HY == int(h0) + 3) & (HX == int(cx) - 1), "red", 7)
    for hx0 in (7, 16):  # orange hair tufts on the sides
        tuft = box(action, hx0, h0 + 2, cz - 2, hx0 + 1, h0 + 5, cz + 2, "orange", 5)
        P.flat(action, tuft & (HY == int(h0) + 2), "orange", 3)
    # the jester hat: two points that lean out, purple and toxic, gold bells
    for sgn, ramp in ((-1, "purple"), (1, "toxic")):
        pts = [(cx, h1), (cx + sgn * 3.5, h1), (cx + sgn * 4.3, h1 + 2.4), (cx + sgn * 1.2, h1 + 1.6)]
        action.prism("z", pts, cz - 2.5, cz + 2.5, C(ramp, 5 if ramp == "purple" else 4))
        hat = last(action)
        P.flat(action, hat & (HY == int(h1)), ramp, 3)
        bx = 7 if sgn < 0 else 16
        box(action, bx, h1 + 1, cz - 0.5, bx + 1, h1 + 2, cz + 0.5, "gold", 6)

    joints = [("base", None, (cx, 0.0, cz)), ("lid", "base", (cx, hinge[0], hinge[1])),
              ("crank", "base", (19.0, cy, ccz)), ("spring", "base", (cx, sp_lo, cz)),
              ("action", "base", (cx, neck, cz))]
    root = assemble({"base": base, "lid": lid, "crank": crank, "spring": spring, "action": action}, joints)
    span = sp_hi - sp_lo
    down = (1.0, (sp_hi - pop - sp_lo) / span, 1.0)
    clips = [
        Clip("open", {
            "crank": {"rot": [(0.0, (0, 0, 0)), (0.04, (-90, 0, 0)), (0.08, (-180, 0, 0)), (0.12, (-270, 0, 0)), (0.16, (-360, 0, 0))]},
            "lid": {"rot": keys((0.0, (-lid_open, 0, 0)), (0.16, (-lid_open, 0, 0)), (0.32, (-30, 0, 0)), (0.42, (6, 0, 0)), (0.5, (0, 0, 0)))},
            "action": {"loc": keys((0.0, (0, -pop, 0)), (0.2, (0, -pop, 0)), (0.36, (0, 1.5, 0)), (0.46, (0, -0.8, 0)), (0.56, (0, 0, 0)))},
            "spring": {"scale": keys((0.0, down), (0.2, down), (0.36, (1, (span + 1.5) / span, 1)), (0.46, (1, (span - 0.8) / span, 1)), (0.56, (1, 1, 1)))},
        }, loop=False),
        Clip("close", {
            "action": {"loc": keys((0.0, (0, 0, 0)), (0.35, (0, -pop, 0)))},
            "spring": {"scale": keys((0.0, (1, 1, 1)), (0.35, down))},
            "lid": {"rot": keys((0.0, (0, 0, 0)), (0.35, (0, 0, 0)), (0.7, (-lid_open, 0, 0)))},
        }, loop=False),
        Clip("idle", {
            "action": {"loc": keys((0.0, (0, 0, 0)), (0.6, (0, 0.6, 0)), (1.2, (0, 0, 0)), (1.8, (0, 0.6, 0)), (2.4, (0, 0, 0))),
                       "rot": keys((0.0, (0, 0, 0)), (0.6, (0, 0, 5)), (1.2, (0, 0, 0)), (1.8, (0, 0, -5)), (2.4, (0, 0, 0)))},
            "spring": {"scale": keys((0.0, (1, 1, 1)), (0.6, (1, (span + 0.6) / span, 1)), (1.2, (1, 1, 1)), (1.8, (1, (span + 0.6) / span, 1)), (2.4, (1, 1, 1)))},
        }),
    ]
    sockets = [Socket("socket-pop", at=(0.0, neck + 5.0, -4.0), parent="action")]
    effects = [pfx("rvx-monster-curse-cloud", "socket-pop", "clip:open", size=18, at=0.36)]
    return world("jack-in-the-box", "animated-props", "Jack in the Box", root, clips=clips, sockets=sockets, pfx=effects)


# ---------------------------------------------------------------- music-box (A2, A4)
def _music_box():
    """A small dark-wood music box on four gold ball feet, about 8 high to
    the rim. The lid stands open on its back hinge and shows a painted
    mirror in a gold frame. A bone skeleton ballerina with a magenta tutu
    stands on a gold spindle in a velvet tray. A gold wind-up key is fixed
    to the right side.

    Parts: base (box), action (the lid, as before), dancer, key. Rest pose:
    lid open. `open` lifts the lid and the dancer springs up (scale on y);
    `close` folds the dancer down and shuts the lid; `active` spins the
    dancer and turns the key."""
    sx, sy, sz = 26, 24, 24
    cx, cz = 12.0, 11.0
    rim_top = 8.0
    hinge = (rim_top, 16.0)
    lid_open = 102.0
    dcx, dcz = 12.5, 11.5  # the dancer axis
    tray = 6.5
    base, action, dancer, key = (Grid(sx, sy, sz) for _ in range(4))
    X, Y, Z = coords(base)

    for fx in (6.2, 17.8):  # gold ball feet
        for fz in (7.2, 14.8):
            S.disc(base, "y", fx, fz, 1.3, 0, 1.5, "gold", 4)
    # the box body, solid to the tray, with a 1-voxel rim wall round the tray
    base.prism("y", [(5, 6), (19, 6), (19, 16), (5, 16)], 1.5, tray, C("wood", 5))
    body = last(base)
    S.paint_facets(base, base.solids[-1:], lambda gg, mm, fr: P.planks(gg, mm, "wood", 5, width=3, across="y", nails=False, frame=fr, seed=11))
    P.flat(base, body & (Y == 1), "gold", 3)  # the bottom moulding
    P.flat(base, body & ((X == 5) | (X == 18)) & ((Z == 6) | (Z == 15)), "gold", 4)  # gold corner strips
    walls = np.zeros(base.shape, dtype=bool)
    for b in ((5, tray, 6, 19, rim_top, 7), (5, tray, 15, 19, rim_top, 16), (5, tray, 7, 6, rim_top, 15), (18, tray, 7, 19, rim_top, 15)):
        base.prism("y", [(b[0], b[2]), (b[3], b[2]), (b[3], b[5]), (b[0], b[5])], b[1], b[4], C("gold", 5))
        walls |= last(base)
    P.flat(base, walls & (Y == 7), "gold", 6)
    P.flat(base, body & (Y == int(tray) - 1) & (X > 5) & (X < 18) & (Z > 6) & (Z < 15), "magenta", 3)  # the velvet tray
    P.flat(base, body & (Y == int(tray) - 1) & (X > 5) & (X < 18) & (Z > 6) & (Z < 15) & (((X + Z) % 4) == 0), "magenta", 2)
    # a gold keyhole plate and two gold diamond inlays on the front (rule S1)
    plate = ["###", "#.#", "#.#", "###"]
    pnglyph.stamp(base, "-z", 6.0, 11, 2, plate, {"#": C("gold", 6), ".": C("purple", 1)})
    diamond = [".#.", "###", ".#."]
    for u0 in (6, 15):
        pnglyph.stamp(base, "-z", 6.0, u0, 2, diamond, {"#": C("gold", 5)})

    # the lid, drawn open: dark purple planks outside, a mirror inside
    closed = [(rim_top, 5.5), (rim_top + 2.5, 5.5), (rim_top + 2.5, 16.0), (rim_top, 16.0)]
    action.prism("x", _rot_yz(closed, *hinge, lid_open), 4.5, 19.5, C("purple", 4))
    lm = last(action)
    LX, LY, LZ = coords(action)
    across, along = _lid_frame(LY, LZ, hinge, lid_open)
    outer = lm & (across > 1.2)
    P.planks(action, outer, "purple", 5, width=3, across="x", nails=False, seed=12)
    inner = lm & (across <= 1.2)
    P.flat(action, inner, "gold", 4)  # the gold frame
    glass = inner & (np.abs(LX + 0.5 - cx) < 5.5) & (along > 1.6) & (along < 9.2)
    P.flat(action, glass, "steel", 6)
    P.flat(action, glass & (np.abs((LX + 0.5 - cx) + (along - 5.5)) < 0.8), "steel", 7)  # a glint
    P.flat(action, glass & (np.abs((LX + 0.5 - cx) + (along - 5.5) - 2.5) < 0.5), "steel", 7)
    P.flat(action, glass & ((np.abs(LX + 0.5 - cx) > 4.5) | (along < 2.4) | (along > 8.4)), "sky", 4)  # a cold rim light
    P.flat(action, outer & ((np.abs(LX + 0.5 - cx) > 6.5) | (along > 9.8)), "gold", 5)

    # the skeleton ballerina on her spindle
    DX, DY, DZ = coords(dancer)
    S.disc(dancer, "y", dcx, dcz, 1.3, tray, 8.0, "gold", 5)
    box(dancer, dcx - 0.5, 8, dcz - 0.5, dcx + 0.5, 10, dcz + 0.5, "bone", 6)  # the pointe leg
    S.bar(dancer, "z", (dcx, 9.8), (dcx + 2.6, 11.0), 1.0, dcz - 0.5, dcz + 0.5, "bone", 6)  # the raised leg
    dancer.prism("y", S.gear_poly(dcx, dcz, 2.4, teeth=8, depth=0.9), 10, 11.5, C("magenta", 6), top=S.gear_poly(dcx, dcz, 2.0, teeth=8, depth=0.7))
    tutu = last(dancer)
    P.flat(dancer, tutu & ((np.arctan2(DZ + 0.5 - dcz, DX + 0.5 - dcx) * 8 / math.pi).astype(int) % 2 == 0), "pink", 6)
    torso = box(dancer, dcx - 1.5, 11, dcz - 1.5, dcx + 1.5, 14, dcz + 1.5, "bone", 6)
    P.flat(dancer, torso & (DY == 12) & (DZ == int(dcz - 1.5)), "purple", 1)  # a rib gap
    P.flat(dancer, torso & (DX == int(dcx)) & (DZ == int(dcz - 1.5)), "bone", 7)  # the spine
    skull = box(dancer, dcx - 2.5, 14, dcz - 1.5, dcx + 2.5, 17, dcz + 1.5, "bone", 7)
    sf = skull & (DZ == int(dcz - 1.5))
    P.flat(dancer, sf & ((DX == int(dcx) - 1) | (DX == int(dcx) + 1)) & (DY == 15), "purple", 1)
    P.flat(dancer, sf & (DX == int(dcx)) & (DY == 14), "purple", 2)
    P.flat(dancer, skull & (DY == 16) & (DZ > int(dcz - 1.5)), "magenta", 5)  # a bow in the hair
    for sgn in (-1, 1):  # arms raised in a round arch over the head
        sh = (dcx + sgn * 1.5, 13.2)
        el = (dcx + sgn * 3.0, 16.2)
        hand = (dcx + sgn * 0.8, 18.0)
        S.bar(dancer, "z", sh, el, 1.0, dcz - 0.5, dcz + 0.5, "bone", 6)
        S.bar(dancer, "z", el, hand, 1.0, dcz - 0.5, dcz + 0.5, "bone", 6)

    # the wind-up key on the right side: a shaft and a two-lobed bow
    ky, kz = 4.5, cz
    S.disc(key, "x", ky, kz, 1.0, 19, 20.5, "gold", 4)
    key.prism("x", [(ky + 0.6, kz - 0.8), (ky + 3.2, kz - 2.2), (ky + 3.9, kz - 0.9), (ky + 3.9, kz + 0.9), (ky + 3.2, kz + 2.2), (ky + 0.6, kz + 0.8)], 20.5, 21.7, C("gold", 5))
    key.prism("x", [(ky - 0.6, kz - 0.8), (ky - 3.2, kz - 2.2), (ky - 3.9, kz - 0.9), (ky - 3.9, kz + 0.9), (ky - 3.2, kz + 2.2), (ky - 0.6, kz + 0.8)], 20.5, 21.7, C("gold", 5))
    km = key.a > 0
    P.flat(key, km & (np.abs(coords(key)[1] + 0.5 - ky) > 2.5), "gold", 6)

    joints = [("base", None, (cx, 0.0, cz)), ("action", "base", (cx, hinge[0], hinge[1])),
              ("dancer", "base", (dcx, tray, dcz)), ("key", "base", (19.0, ky, kz))]
    root = assemble({"base": base, "action": action, "dancer": dancer, "key": key}, joints)
    folded = (1.0, 0.05, 1.0)
    clips = [
        Clip("open", {
            "action": {"rot": keys((0.0, (-lid_open, 0, 0)), (0.45, (4, 0, 0)), (0.55, (0, 0, 0)))},
            "dancer": {"scale": keys((0.0, folded), (0.25, folded), (0.55, (1, 1.06, 1)), (0.65, (1, 1, 1)))},
        }, loop=False),
        Clip("close", {
            "dancer": {"scale": keys((0.0, (1, 1, 1)), (0.3, folded))},
            "action": {"rot": keys((0.0, (0, 0, 0)), (0.3, (0, 0, 0)), (0.8, (-lid_open, 0, 0)))},
        }, loop=False),
        Clip("active", {
            "dancer": {"rot": _spin(2.0, 1, -1.0)},
            "key": {"rot": _spin(2.0, 0, 1.0)},
            "action": {"rot": keys((0.0, (0, 0, 0)), (1.0, (-2, 0, 0)), (2.0, (0, 0, 0)))},
        }),
    ]
    sockets = [Socket("socket-tune", at=(dcx - cx, 13.0, dcz - cz - 2.0), parent="base")]
    effects = [pfx("rvx-monster-ghost-wisps", "socket-tune", "clip:active", size=12, at=0.2)]
    return world("music-box", "animated-props", "Music Box", root, clips=clips, sockets=sockets, pfx=effects)


# ---------------------------------------------------------------- blood-fountain (A3, A4)
def _blood_fountain():
    """An octagon stone basin full of blood, a pedestal with a tiered bowl,
    and a bone skull on a capital. Blood runs from the skull mouth into the
    bowl and spills over the bowl rim on four sides into the basin. Every stone face
    has S2 blocks with mortar lines.

    Parts: base (stone and the still blood), action (the stream from the
    mouth; it pulses in `active`)."""
    sx, sy, sz = 34, 38, 34
    cx = cz = 17.0
    base, action = Grid(sx, sy, sz), Grid(sx, sy, sz)
    X, Y, Z = coords(base)
    rad = np.hypot(X + 0.5 - cx, Z + 0.5 - cz)
    ang = np.arctan2(Z + 0.5 - cz, X + 0.5 - cx)
    ring = lambda r: S.flat_ngon(cx, cz, r, 8, DOWN)  # noqa: E731

    def stone(solids, shade, seed, block=(5, 3)):
        S.paint_facets(base, solids, lambda gg, mm, fr: P.stone(gg, mm, "gray", shade, block=block, frame=fr, seed=seed))

    # the basin rim: eight faceted segments with a sloped outer face
    s0 = len(base.solids)
    out0, out1, inn = ring(15.0), ring(14.2), ring(12.2)
    for k in range(8):
        k1 = (k + 1) % 8
        base.prism("y", [out0[k], out0[k1], inn[k1], inn[k]], 0, 6, C("gray", 4), top=[out1[k], out1[k1], inn[k1], inn[k]])
    rim_solids = base.solids[s0:]
    rimm = union(base, s0)
    stone(rim_solids, 4, 21)
    P.flat(base, rimm & (Y == 5), "gray", 6)  # the lit coping
    P.flat(base, rimm & (Y == 5) & (np.cos(ang * 8) > 0.97), "gray", 3)  # coping joints
    blotch(base, rimm & (Y < 2), "moss", 4, cell=2, chance=0.14, seed=22)
    for a0 in (-2.2, -0.9, 0.6, 2.4):  # old blood runs down the outside
        P.flat(base, rimm & (np.abs(ang - a0) < 0.07) & (rad > 13.5) & (Y >= 2), "blood", 2)
    # the basin floor and the pool of blood
    base.prism("y", inn, 0, 1, C("gray", 3))
    base.prism("y", inn, 1, 4, C("blood", 3))
    pool = last(base)
    P.flat(base, pool & (Y == 3) & ((rad.astype(int) % 4) == 1), "blood", 4)
    P.flat(base, pool & (Y == 3) & ((rad.astype(int) % 4) == 3) & (np.cos(ang * 5) > 0.2), "blood", 5)
    P.flat(base, pool & (Y == 3) & (rad > 11.2), "blood", 2)
    # the pedestal: a flared foot and an octagon column
    s1 = len(base.solids)
    base.prism("y", ring(5.0), 4, 6, C("gray", 4), top=ring(3.2))
    base.prism("y", ring(3.2), 6, 13, C("gray", 4))
    stone(base.solids[s1:], 4, 23, block=(4, 3))
    ped = union(base, s1)
    P.flat(base, ped & (Y == 12), "gray", 6)
    # the tiered bowl: a frustum with true slopes and a lit rim
    s2 = len(base.solids)
    base.prism("y", ring(3.2), 13, 16.5, C("gray", 5), top=ring(8.5))
    stone(base.solids[s2:], 5, 24, block=(4, 3))
    bowl = union(base, s2)
    P.flat(base, bowl & (Y == 13), "gray", 3)
    s3 = len(base.solids)
    b_out, b_in = ring(8.5), ring(7.0)
    for k in range(8):
        k1 = (k + 1) % 8
        base.prism("y", [b_out[k], b_out[k1], b_in[k1], b_in[k]], 16.5, 18.5, C("gray", 5))
    bowl_rim = union(base, s3)
    P.flat(base, bowl_rim & (Y == 17), "gray", 6)
    P.flat(base, bowl_rim & (Y == 16), "gray", 4)
    P.flat(base, bowl_rim & (Y == 16) & (np.cos(ang * 8) > 0.9), "gray", 2)
    base.prism("y", b_in, 16.5, 17.5, C("blood", 4))
    bblood = last(base)
    P.flat(base, bblood & ((rad.astype(int) % 3) == 1), "blood", 5)
    # four curved spills from the bowl rim down into the pool (true slopes)
    out = [(7.2, 18.5), (8.9, 18.5), (9.3, 17.0), (10.0, 12.5), (10.4, 4.0), (11.8, 4.0), (11.3, 13.0), (10.4, 17.6), (8.9, 19.3), (7.2, 19.3)]
    s5 = len(base.solids)
    for sgn in (-1, 1):
        base.prism("z", [(cx + sgn * r, yy) for r, yy in out], cz - 0.75, cz + 0.75, C("blood", 4))
        base.prism("x", [(yy, cz + sgn * r) for r, yy in out], cx - 0.75, cx + 0.75, C("blood", 4))
    spills = union(base, s5)
    P.flat(base, spills & ((Y % 4) == 0), "blood", 5)
    P.flat(base, spills & (Y >= 18), "blood", 5)
    # the upper column and capital under the skull
    s4 = len(base.solids)
    base.prism("y", ring(2.2), 17.5, 21, C("gray", 4))
    base.prism("y", ring(2.2), 21, 22.5, C("gray", 5), top=ring(3.6))
    base.prism("y", ring(3.6), 22.5, 23.5, C("gray", 6))
    stone(base.solids[s4:s4 + 1], 4, 25, block=(3, 3))
    cap = union(base, s4)
    P.flat(base, cap & (Y >= 21), "gray", 5)
    P.flat(base, cap & (Y == 22), "gray", 6)
    # the bone skull on top, eyes glowing toxic
    S.skull(base, cx, 23.5, cz, s=10, eyes=("toxic", 6), socket=("purple", 1), seed=26)

    # the stream (part "action"): from the open jaw, out and down into the bowl
    mouth_z = cz - 10 * 0.45  # the front of the jaw
    stream = [(25.4, mouth_z + 0.6), (25.5, mouth_z - 1.0), (24.6, mouth_z - 2.0), (22.6, mouth_z - 2.4), (17.0, mouth_z - 2.2),
              (17.0, mouth_z - 0.5), (21.6, mouth_z - 0.7), (23.4, mouth_z - 0.3), (24.0, mouth_z + 0.6)]
    action.prism("x", stream, cx - 1.5, cx + 1.5, C("blood", 5))
    st = last(action)
    AX, AY, AZ = coords(action)
    P.flat(action, st & ((AY.astype(int) % 3) == 0), "blood", 4)
    P.flat(action, st & (AX == int(cx)) & ((AY.astype(int) % 3) == 1), "blood", 6)

    joints = [("base", None, (cx, 0.0, cz)), ("action", "base", (cx, 25.0, mouth_z))]
    root = assemble({"base": base, "action": action}, joints)
    clips = [Clip("active", {"action": {"scale": keys(
        (0.0, (1, 1, 1)), (0.25, (1.25, 1.06, 1.0)), (0.5, (1, 1, 1)), (0.75, (1.15, 1.03, 1.0)), (1.0, (1, 1, 1)))}})]
    sockets = [Socket("socket-spray", at=(0.0, 18.0, mouth_z - 2.0 - cz), parent="base")]
    effects = [pfx("rvx-monster-blood-splat", "socket-spray", "clip:active", size=16, at=0.35)]
    return world("blood-fountain", "animated-props", "Blood Fountain", root, clips=clips, sockets=sockets, pfx=effects)


# ---------------------------------------------------------------- lab-generator (A4)
def _lab_generator():
    """The old lab generator without the stone curb. The four posts stand
    on riveted iron foot plates; the coil stands on a low octagon iron
    plinth; the gold cables run down to iron junction boxes on the floor.
    Everything moves down by 5."""
    sx, sy, sz = 32, 42, 32
    cx, cz = sx / 2, sz / 2
    d = 5
    base, action = Grid(sx, sy, sz), Grid(sx, sy, sz)
    X, Y, Z = coords(base)
    # the new ground: foot plates and the coil plinth
    for px in (6, 22):
        for pz in (6, 22):
            fp = box(base, px - 1, 0, pz - 1, px + 5, 1, pz + 5, "gray", 4)
            P.flat(base, fp & edges(fp), "gray", 3)
            P.flat(base, fp & (((X - px) % 5) == 0) & (((Z - pz) % 5) == 0), "gray", 6)  # bolt heads
    base.prism("y", S.flat_ngon(cx, cz, 7.5, 8, DOWN), 0, 2, C("gray", 4))
    plin = last(base)
    P.plates(base, plin, "gray", 4, size=(5, 2), seed=31)
    P.flat(base, plin & (Y == 1) & (np.cos(np.arctan2(Z + 0.5 - cz, X + 0.5 - cx) * 8) > 0.9), "gray", 6)
    # the old generator, 5 lower
    _metal(base, (6, 6 - d, 6, 10, 31 - d, 10), 4, 1)
    _metal(base, (22, 6 - d, 6, 26, 31 - d, 10), 4, 2)
    _metal(base, (6, 6 - d, 22, 10, 31 - d, 26), 4, 3)
    _metal(base, (22, 6 - d, 22, 26, 31 - d, 26), 4, 4)
    S.disc(base, "y", 16, 16, 6, 7 - d, 28 - d, "teal", 4, n=10)
    for yy in (10, 15, 20, 25):
        S.disc(base, "y", 16, 16, 7, yy - d, yy + 2 - d, "gold", 5, n=10)
    box(base, 10, 8 - d, 4, 22, 17 - d, 7, "purple", 4)
    S.disc(base, "z", 14, 13 - d, 2.4, 3, 4, "bone", 6, n=8)
    box(base, 14, 12 - d, 2, 15, 15 - d, 3, "iron", 2)
    for xx in (18, 21):
        box(base, xx, 10 - d, 3, xx + 1, 12 - d, 4, "toxic", 6)
    for xx in (5, 27):
        base.line((xx, 1.5, 17), (xx, 23 - d, 17), 1.5, C("gold", 4))
        base.line((xx, 23 - d, 17), (16, 23 - d, 17), 1.5, C("gold", 4))
        jb = box(base, xx - 2, 0, 15, xx + 2, 2, 19, "gray", 4)
        P.flat(base, jb & edges(jb), "gray", 3)
        P.flat(base, jb & (Y == 1) & (Z == 17), "toxic", 6)
    _metal(base, (8, 28 - d, 8, 24, 32 - d, 24), 5, 5)
    S.disc(action, "y", cx, cz, 10, 30 - d, 33 - d, "gold", 4, n=8)
    box(action, 11, 32 - d, 11, 21, 39 - d, 21, "toxic", 5)
    box(action, 13, 38 - d, 13, 19, 40 - d, 19, "purple", 4)
    joints = [("base", None, (cx, 0, cz)), ("action", "base", (cx, 30 - d, cz))]
    root = assemble({"base": base, "action": action}, joints)
    spin = Clip("spin", {"action": {"rot": [(0.0, (0, 0, 0)), (1.2, (0, 360, 0))]}})
    active = Clip("active", {"action": {"loc": keys((0, (0, 0, 0)), (0.25, (0, 1, 0)), (0.5, (0, 0, 0)), (0.75, (0, -1, 0)), (1.0, (0, 0, 0)))}})
    return world("lab-generator", "animated-props", "Lab Generator", root, clips=[spin, active],
                 sockets=[Socket("socket-core", at=(0, 28 - d, 0), parent="base")],
                 pfx=[pfx("rvx-monster-witch-brew", "socket-core", "idle", size=20)])


# ---------------------------------------------------------------- ouija-table (A4)
def _ouija_table():
    """The old ouija table without the stone curb. The legs stand on carved
    dark foot blocks on the floor. Everything moves down by 4, so the board
    is at about 17 (a table top)."""
    sx, sy, sz = 38, 30, 32
    cx, cz = sx / 2, sz / 2
    d = 4
    base, action = Grid(sx, sy, sz), Grid(sx, sy, sz)
    X, Y, Z = coords(base)
    for xx in (7, 27):
        for zz in (7, 23):
            # a splayed foot block: a frustum with true slopes and a gold band
            base.prism("y", [(xx - 1, zz - 1), (xx + 5, zz - 1), (xx + 5, zz + 5), (xx - 1, zz + 5)], 0, 2, C("wood", 5),
                       top=[(xx - 0.2, zz - 0.2), (xx + 4.2, zz - 0.2), (xx + 4.2, zz + 4.2), (xx - 0.2, zz + 4.2)])
            foot = last(base)
            P.mottle(base, foot, "wood", 5, cell=2, seed=xx + zz)
            P.flat(base, foot & (Y == 1), "gold", 4)
            _wood(base, (xx, 2, zz, xx + 4, 18 - d, zz + 4), 5, xx, width=4, ramp="wood")
    _wood(base, (5, 18 - d, 5, 33, 21 - d, 27), 6, 5, width=4, ramp="wood")
    box(base, 8, 20 - d, 7, 30, 21 - d, 25, "purple", 3)
    P.flat(base, (base.a > 0) & (Y == 20 - d) & (Z < 26) & (X > 7) & (X < 31), "purple", 4)
    pnglyph.text(base, "top", 21 - d, 11, 8, "ABC", "bone", 6, gap=1)
    pnglyph.text(base, "top", 21 - d, 11, 16, "DEF", "bone", 6, gap=1)
    outer = [(14, 21), (17, 14), (21, 14), (24, 21)]
    inner = [(17, 20), (18, 17), (20, 17), (21, 20)]
    for i, a in enumerate(outer):
        action.prism("y", [a, outer[(i + 1) % 4], inner[(i + 1) % 4], inner[i]], 22 - d, 24 - d, C("gold", 5))
    for xx, zz in ((15, 20), (19, 14), (23, 20)):
        box(action, xx, 21 - d, zz, xx + 1, 22 - d, zz + 1, "gold", 4)
    joints = [("base", None, (cx, 0, cz)), ("action", "base", (19, 21 - d, 16))]
    root = assemble({"base": base, "action": action}, joints)
    clips = [Clip("active", {"action": {"loc": keys((0, (0, 0, 0)), (0.25, (5, 0, -3)), (0.5, (5, 0, 3)), (0.75, (-5, 0, 2)), (1, (0, 0, 0)))}}),
             Clip("idle", {"action": {"rot": keys((0, (0, 0, 0)), (1.2, (0, 5, 0)), (2.4, (0, 0, 0)))}})]
    return world("ouija-table", "animated-props", "Ouija Table", root, clips=clips,
                 sockets=[Socket("socket-planchette", at=(0, 23 - d, 0), parent="action")],
                 pfx=[pfx("rvx-monster-ghost-wisps", "socket-planchette", "clip:active", size=16, at=0.35)])


# ---------------------------------------------------------------- rising-grave (A4)
def _rising_grave():
    """The old rising grave without the stone curb. The stone kerbs stand
    on the floor round a dirt grave mound. The headstone stands on the floor
    at the head of the grave and rises out of it in `active`."""
    from _double_nature import rock

    sx, sy, sz = 32, 42, 28
    cx, cz = sx / 2, sz / 2
    base, action = Grid(sx, sy, sz), Grid(sx, sy, sz)
    for xx in (6, 23):
        _stone(base, (xx, 0, 11, xx + 3, 5, 25), 4, 1)
    _stone(base, (6, 0, 22, 26, 4, 25), 4, 2)
    grave(base, 9, 11, 23, 22, h=3, inset=1.5, ramp="wood", base=3, moss=0.14, seed=41)
    tufts(base, [(11, 13), (20, 19)], "moss", 5, y0=3)
    for k, (xx, zz) in enumerate(((3.5, 17), (28.5, 20), (28, 9))):
        rock(base, xx, zz, 2.5, 2, 0, 4, k + 3, "gray")
    AX, AY, AZ = coords(action)
    S.tombstone(action, 16, 9, w=18, h=22, t=4, y0=0, ramp="stone", base=5, glyph="cross")
    P.flat(action, (action.a > 0) & (AZ == 7) & (AY > 9) & (AY < 17) & (np.abs(AX - cx) < 1.2), "bone", 6)
    box(action, 14, 13, 7, 18, 15, 8, "purple", 5)
    joints = [("base", None, (cx, 0, cz)), ("action", "base", (cx, 0, 9))]
    root = assemble({"base": base, "action": action}, joints)
    clips = [Clip("active", {"action": {"loc": keys((0, (0, 0, 0)), (0.35, (0, 10, 0)), (0.6, (0, 13, 0)), (0.9, (0, 10, 0)), (1.2, (0, 0, 0)))}}),
             Clip("idle", {"action": {"loc": keys((0, (0, 0, 0)), (1.2, (0, 0.7, 0)), (2.4, (0, 0, 0)))}})]
    return world("rising-grave", "animated-props", "Rising Grave", root, clips=clips,
                 sockets=[Socket("socket-grave", at=(0, 3, 2), parent="base")],
                 pfx=[pfx("rvx-monster-grave-mist", "socket-grave", "clip:active", size=26, at=0.38)])


# ---------------------------------------------------------------- swinging-lantern (A4)
def _swinging_lantern():
    """The old swinging lantern without the stone curb. The iron post
    stands on four sloped cast-iron braces on a small irregular moss patch.
    Everything moves down by 3 (the patch is 1 high)."""
    sx, sy, sz = 36, 58, 30
    cx, cz = 16.0, 15.0
    d = 3
    base, action = Grid(sx, sy, sz), Grid(sx, sy, sz)
    _patch(base, 27, 13, 9, 8, seed=5)
    _metal(base, (25, 4 - d, 11, 29, 51 - d, 15), 4, 1)
    _metal(base, (14, 49 - d, 11, 29, 52 - d, 15), 4, 2)
    S.bar(base, "z", (27, 40 - d), (17, 50 - d), 1.5, 11, 14, "iron", 4)
    s0 = len(base.solids)
    _brace_x(base, 25, 20.5, 1, 8, 12, 14, "gray", 4)
    _brace_x(base, 29, 33.5, 1, 8, 12, 14, "gray", 4)
    _brace_z(base, 11, 6.5, 1, 8, 26, 28, "gray", 4)
    _brace_z(base, 15, 19.5, 1, 8, 26, 28, "gray", 4)
    br = union(base, s0)
    Y = coords(base)[1]
    P.flat(base, br & (Y < 2), "gray", 3)
    P.flat(base, br & (Y >= 6), "gray", 5)
    _metal(action, (10, 29 - d, 11, 22, 39 - d, 19), 4, 4)
    box(action, 15, 45 - d, 14, 17, 50 - d, 16, "gold", 5)
    box(action, 12, 30 - d, 12, 20, 38 - d, 18, "toxic", 7)
    AX, AY, AZ = coords(action)
    P.flat(action, (action.a > 0) & (AX >= 12) & (AX <= 20) & (AY >= 30 - d) & (AY <= 38 - d) & ((AZ == 11) | (AZ == 19)), "toxic", 7)
    box(action, 9, 39 - d, 10, 23, 42 - d, 20, "purple", 4)
    S.spire(action, cx, cz + 1, 42 - d, 7, 5, "purple", 4)
    joints = [("base", None, (cx, 0, cz)), ("action", "base", (cx, 48 - d, cz + 1))]
    root = assemble({"base": base, "action": action}, joints)
    clips = [Clip("active", {"action": {"rot": keys((0, (0, 0, 0)), (0.45, (18, 0, 0)), (0.9, (0, 0, 0)), (1.35, (-18, 0, 0)), (1.8, (0, 0, 0)))}}),
             Clip("idle", {"action": {"rot": keys((0, (-4, 0, 0)), (1.0, (0, 0, 0)), (2.0, (4, 0, 0)), (3.0, (0, 0, 0)), (4.0, (-4, 0, 0)))}})]
    return world("swinging-lantern", "animated-props", "Swinging Lantern", root, clips=clips,
                 sockets=[Socket("socket-flame", at=(0, 36 - d, 0), parent="action")],
                 pfx=[pfx("rvx-monster-ghost-lantern", "socket-flame", "idle", size=22)])


# ---------------------------------------------------------------- bat-roost (A4)
def _bat_roost():
    """The old bat roost without the stone curb. The post goes down to an
    irregular moss patch and four sloped wood braces hold it. The height
    does not change (tall-prop needs 44 or more)."""
    sx, sy, sz = 34, 58, 28
    cx, cz = sx / 2, sz / 2
    base, action = Grid(sx, sy, sz), Grid(sx, sy, sz)
    g = action
    _patch(base, cx, cz, 11, 10, seed=9)
    _wood(base, (14, 1, 12, 20, 48, 16), 5, 2, width=5, ramp="darkwood")
    _wood(base, (7, 46, 10, 27, 50, 18), 5, 3, width=5, ramp="wood")
    s0 = len(base.solids)
    _brace_x(base, 14, 9, 1, 12, 13, 15, "wood", 4)
    _brace_x(base, 20, 25, 1, 12, 13, 15, "wood", 4)
    _brace_z(base, 12, 6.5, 1, 12, 16, 18, "wood", 4)
    _brace_z(base, 16, 21.5, 1, 12, 16, 18, "wood", 4)
    S.paint_facets(base, base.solids[s0:], lambda gg, mm, fr: P.planks(gg, mm, "wood", 4, width=3, across="x", nails=True, frame=fr, seed=51))
    wing = [(17, 35), (13, 38), (10, 41), (6, 43), (2, 37), (3, 30), (6, 34), (9, 29), (11, 34), (14, 31)]
    for side in (-1, 1):
        polygon = wing if side < 0 else [(34 - x, y) for x, y in reversed(wing)]
        g.prism("z", polygon, 5, 8, C("purple", 5))
        P.flat(g, last(g), "purple", 5)
        for tip in ((6, 42), (3, 32), (9, 31)):
            end = tip if side < 0 else (34 - tip[0], tip[1])
            S.bar(g, "z", (17, 35), end, 1.0, 4, 5.5, "gray", 5)
    g.prism("z", [(14, 35), (13, 31), (15, 28), (19, 28), (21, 31), (20, 35)], 3, 8, C("gray", 5))
    g.prism("z", [(14, 35), (13, 37), (15, 40), (19, 40), (21, 37), (20, 35)], 2, 8, C("gray", 6))
    for x0 in (14, 18):
        g.prism("z", [(x0, 39), (x0 + 1, 44), (x0 + 3, 39)], 2, 5, C("purple", 5))
    eyes(g, "-z", 2, 15, 37, 1, size=1, glow=("toxic", 7), rim=("purple", 2), depth=3)
    box(g, 16, 40, 6, 18, 47, 8, "gray", 5)
    box(g, 16, 46, 7, 18, 48, 12, "gray", 5)
    joints = [("base", None, (cx, 0, cz)), ("action", "base", (cx, 46, 14))]
    root = assemble({"base": base, "action": action}, joints)
    clips = [Clip("active", {"action": {"rot": keys((0, (0, 0, 0)), (0.25, (-12, 0, 0)), (0.5, (0, 0, 0)), (0.75, (12, 0, 0)), (1, (0, 0, 0)))}}),
             Clip("idle", {"action": {"rot": keys((0, (0, 0, 0)), (1.0, (0, 0, 3)), (2.0, (0, 0, 0)))}})]
    return world("bat-roost", "animated-props", "Bat Roost", root, clips=clips,
                 sockets=[Socket("socket-roost", at=(0, 42, 0), parent="base")],
                 pfx=[pfx("rvx-monster-bat-swarm", "socket-roost", "idle", size=18)])


# ---------------------------------------------------------------- garlic-wreath-post (A4)
def _garlic_wreath_post():
    """The old garlic wreath post without the stone curb. The post stands
    in a low dirt mound with three stones round it. Everything moves down
    by 2."""
    from _double_nature import rock

    g = Grid(30, 36, 24)
    X, Y, Z = coords(g)
    d = 2
    mound(g, 15, 13, 7.5, 2, top=0.7, ramp="wood", base=3, moss=0.2, seed=61)
    for k, (xx, zz) in enumerate(((5, 9), (25, 17), (22, 4))):
        rock(g, xx, zz, 2.2, 1.8, 0, 3, k + 7, "gray")
    tufts(g, [(6, 15), (24, 10)], "moss", 5, y0=0)
    _wood(g, (12, 4 - d, 10, 18, 29 - d, 16), 5, 2, width=4, ramp="darkwood")
    box(g, 7, 25 - d, 9, 23, 32 - d, 11, "purple", 4)
    P.outline(g, (g.a > 0) & (Y >= 25 - d) & (Y < 32 - d) & (Z >= 9) & (Z < 11), "purple", 2, normal="z")
    bulbs = [(9, 27), (11, 31), (15, 33), (19, 31), (21, 27), (19, 23), (11, 23)]
    for i, (bx, by) in enumerate(bulbs):
        by -= d
        g.sphere(bx, by, 8, 2.4, C("bone", 6))
        P.flat(g, (g.a > 0) & (np.abs(X - bx) < 1.2) & (np.abs(Y - by) < 1.2) & (Z <= 7), "bone", 4)
        box(g, bx - 0.5, by + 1, 7, bx + 0.5, by + 3, 9, "moss", 5)
        if i in (1, 4):
            box(g, bx - 2, by - 1, 7, bx - 1, by + 1, 9, "moss", 5)
    box(g, 10, 16 - d, 8, 20, 19 - d, 11, "gold", 4)
    box(g, 12, 17 - d, 11, 18, 18 - d, 12, "toxic", 5)
    from _kit import single
    return single("garlic-wreath-post", "props", "Garlic Wreath Post", g,
                  sockets=[Socket("socket-ward", at=(0, 25 - d, -4))],
                  pfx=[pfx("rvx-monster-spore-glow", "socket-ward", "idle", size=18)])


BUILDERS = {
    ("animated-props", "jack-in-the-box"): _jack_in_the_box,
    ("animated-props", "music-box"): _music_box,
    ("animated-props", "blood-fountain"): _blood_fountain,
    ("animated-props", "lab-generator"): _lab_generator,
    ("animated-props", "ouija-table"): _ouija_table,
    ("animated-props", "rising-grave"): _rising_grave,
    ("animated-props", "swinging-lantern"): _swinging_lantern,
    ("animated-props", "bat-roost"): _bat_roost,
    ("props", "garlic-wreath-post"): _garlic_wreath_post,
}


def build(category, slug):
    try:
        builder = BUILDERS[(category, slug)]
    except KeyError as exc:
        raise KeyError(f"_rep_anim has no model {category}/{slug}") from exc
    return builder()
