"""Owlbear in the Pirate Nation creature style.

A hulking brown bear with the head of a great horned owl. The body is a
heavy quadruped built from few big volumes (rule F1): a high shoulder hump,
a deep belly and a low rump on four thick legs with broad paws and big
hooked bone claws on the front paws. The head is a big octagon block with
a cream heart-shaped facial disc, two huge orange eyes under an angry
brow, a hooked beak and two dark ear tufts. A feathered crown and a
layered feather nape run from the back of the head down over the
shoulders, so the rear of the head is feathers, not a plain face. The
detail is paint (S1): pointed feather rows on the head, the nape and the
chest bib, fur tufts in big rows on the body, dark arrises (S4).

Clips: idle (breathe, turn the head like an owl, shift the weight),
attack (rear up on the planted hind legs with the claws spread, then lunge
forward slamming down one front paw and then the other: the dust slam PFX
at the paw socket), hit (shoved back off
its feet, the head snaps back, it lands heavily and recovers), death (knocked back, it goes over onto its left side and slams down). Faces -Z.
"""
import math

import numpy as np

from _quad_falls import Planter, bake, per_frame, rmat, sample

import paint as P
import pnglyph
from _fcreature_beasts import frame_seams, paint_solids, scallops
from _life import C, Clip, Grid, Socket, asset, chamfer_rect, coords, front, keys, last, pfx, plan, rig, side
from pnshapes import quad, seams
from _move_gaits import Gait, cyc, thump, turn_loop

S = (76, 80, 84)
CX = 38.0
FUR, FEATHER, DISC = "wood", "wood", "sand"
BODY_HINGE = (CX, 0.0, 67.0)
HEAD_HINGE = (CX, 40.0, 25.0)
LEGS = {"leg-fl": (-1, 29.0), "leg-fr": (1, 29.0), "leg-bl": (-1, 61.0), "leg-br": (1, 61.0)}
FACE_Z = 7.0  # the front plane of the facial disc


def _sec(c, r, ch):
    return chamfer_rect(c[0] - r[0], c[1] - r[1], c[0] + r[0], c[1] + r[1], min(r) * ch)


def zseg(g: Grid, c0, c1, r0, r1, z0, z1, ramp: str, shade: int, ch: float = 0.42) -> np.ndarray:
    """A chamfered frustum along z between (x, y) centres (sheared)."""
    g.prism("z", _sec(c0, r0, ch), z0, z1, C(ramp, shade), top=_sec(c1, r1, ch))
    return last(g)


def yseg(g: Grid, c0, c1, r0, r1, y0, y1, ramp: str, shade: int, ch: float = 0.42) -> np.ndarray:
    """A chamfered frustum along y between (x, z) centres (sheared)."""
    g.prism("y", _sec(c0, r0, ch), y0, y1, C(ramp, shade), top=_sec(c1, r1, ch))
    return last(g)


def fur(g: Grid, start: int, base: int = 4, seed: int = 0, ramp: str = FUR) -> np.ndarray:
    """Fur tufts in big pointed rows on the prisms since `start` (no
    speckle), a shaded underside and dark arrises."""
    m = paint_solids(g, start, lambda gg, mm, fr: scallops(gg, mm, ramp, base, frame=fr, width=6, row=5, seed=seed, pointed=True, streak=False, vary=False))
    frame_seams(g, start, m, steps=1)
    return m


def feathers(g: Grid, start: int, ramp: str = FEATHER, base: int = 4, seed: int = 0, width: int = 5, row: int = 4) -> np.ndarray:
    """Pointed feather rows with a light quill on the prisms since `start`."""
    m = paint_solids(g, start, lambda gg, mm, fr: scallops(gg, mm, ramp, base, frame=fr, width=width, row=row, seed=seed, pointed=True, streak=True, vary=True))
    frame_seams(g, start, m, steps=1)
    return m


def claw(g: Grid, x: float, zf: float, y0: float = 0.0, h: float = 5.5, big: bool = True) -> np.ndarray:
    """A hooked bone claw over the front of a paw (a side-view wedge)."""
    _X, Y, _Z = coords(g)
    w = 1.2 if big else 0.9
    k = 1.0 if big else 0.6
    m = side(g, [(y0 + h, zf + 2.0), (y0 + h, zf - 0.5 * k), (y0 + h * 0.45, zf - 3.6 * k), (y0, zf - 4.2 * k), (y0 + h * 0.3, zf - 1.2 * k), (y0 + h * 0.5, zf + 2.0)], x - w, x + w, "bone", 6)
    P.flat(g, m & (Y > y0 + h - 1.2), "bone", 4)
    P.flat(g, m & (Y < y0 + 1.2), "bone", 7)
    return m


def owlbear_fall(grids: dict, hinges: dict) -> tuple[dict, int]:
    """Per-frame keys for the death: the blow knocks it back (the front end
    reared up, the forepaws flung, the hind paws stumbling back a step),
    then it goes over sideways onto its left side in one accelerating roll
    and slams down with a hard stop (a 1-frame squash, a tiny 2-frame
    rebound), head and limbs slapping down a frame later, then still.

    The body and legs move as one rigid block about whichever edge of it is
    on the floor, so it rolls over without sliding or sinking; the knock
    back rides on top. Returns (clip_keys, impact_frame)."""
    LAND, END = 17, 26
    F = 1 / 30
    corners = np.array([(i, j, k) for i in (0, 1) for j in (0, 1) for k in (0, 1)])
    H = np.array(hinges["body"], float)

    def pts(g, piv):
        v = np.argwhere(g.a > 0)
        return np.unique((v[:, None, :] + corners[None]).reshape(-1, 3), axis=0).astype(float) - np.array(piv, float)
    body_q = pts(grids["body"], H)
    legs = [n for n in LEGS]
    leg_q = {n: pts(grids[n], hinges[n]) for n in legs}
    leg_o = {n: np.array(hinges[n], float) - H for n in legs}

    def curve(rows, fr):
        """rows (frame, value, kind): "snap" = fast out, "fall" = gravity (slow off the balance point, fastest at contact)."""
        for (f0, v0, _), (f1, v1, kind) in zip(rows, rows[1:]):
            if f0 <= fr <= f1:
                u = (fr - f0) / max(1, f1 - f0)
                w = u ** 2.2 if kind == "fall" else 1 - (1 - u) ** 2 if kind == "snap" else u
                return np.array(v0, float) + (np.array(v1, float) - np.array(v0, float)) * w
        return np.array(rows[-1][1], float)

    # body pose: (pitch, yaw, roll); the roll is about z (+ = over onto the left side)
    pose = [(0, (0, 0, 0), None), (2, (8, 0, -2), "snap"), (5, (15, 3, 2), "snap"), (8, (11, 4, 12), "snap"), (10, (10, 4, 14), None),
            (LAND, (3, 2, 101), "fall"), (LAND + 1, (3, 2, 97), "snap"), (LAND + 3, (3, 2, 100), "snap"), (END, (3, 2, 100), None)]
    knock = [(0, 0, None), (2, 2.5, "snap"), (5, 6.0, "snap"), (8, 8.0, "snap"), (LAND, 9.5, None), (END, 9.5, None)]  # pushed back (+z)
    # legs (x: + swings the foot forward, z: + swings it toward +x)
    lk = {}
    for n in legs:
        sx = -1 if n.endswith("l") else 1
        fore = n[-2] == "f"
        if fore:  # flung forward by the blow, pawing, stiff as it goes, then slapped down
            land = (34, 0, 18) if sx < 0 else (26, 0, -14)
            lk[n] = [(0, (0, 0, 0), None), (2, (34, 0, sx * -6), "snap"), (5, (44, 0, sx * -10), "snap"), (8, (30, 0, sx * -4), "snap"),
                     (LAND, (land[0] * 0.8, 0, land[2] * 0.4), "fall"), (LAND + 2, (land[0] * 1.15, 0, land[2] * 1.3), "snap"), (LAND + 4, land, "snap"),
                     (END, land, None)]
        else:  # the hind paws stumble back a step, then the legs go stiff and splay
            land = (-22, 0, 18) if sx < 0 else (-18, 0, -14)
            st = 1 if sx > 0 else 0  # out of step
            lk[n] = [(0, (0, 0, 0), None), (2 + st, (-6, 0, 0), "snap"), (5 + st, (-16, 0, sx * 3), "snap"), (8, (-6, 0, 0), "snap"),
                     (LAND, (land[0] * 0.8, 0, land[2] * 0.4), "fall"), (LAND + 2, (land[0] * 1.15, 0, land[2] * 1.3), "snap"), (LAND + 4, land, "snap"),
                     (END, land, None)]
    out = {n: {"rot": []} for n in ["body", "head"] + legs}
    out["body"]["loc"] = []

    def tuck(n, fr):  # the legs it lands on tuck their hips in a little, so the body lies on the floor, not propped on them
        return np.array((2.8 * min(1.0, max(0.0, (fr - LAND + 4) / 4.0)) if n.endswith("l") else 0.0, 0.0, 0.0))

    def world(rot, t, leg_rots, fr):
        R = rmat(rot)
        ps = [body_q @ R.T]
        for n in legs:
            ps.append((leg_o[n] + tuck(n, fr) + leg_q[n] @ rmat(leg_rots[n]).T) @ R.T)
        return np.concatenate(ps) + H + t
    rest_rots = {n: (0.0, 0.0, 0.0) for n in legs}
    floor0 = world((0, 0, 0), np.zeros(3), rest_rots, 0)[:, 1].min()
    t = np.zeros(3)
    prev_rot, prev_legs, prev_k = np.zeros(3), rest_rots, 0.0
    for fr in range(END + 1):
        rot = curve(pose, fr)
        leg_rots = {n: tuple(curve(lk[n], fr)) for n in legs}
        k = float(curve(knock, fr))
        # pivot about the floor contact on the side it's going over to
        w = world(prev_rot, t, prev_legs, max(0, fr - 1))
        low = w[w[:, 1] < w[:, 1].min() + 0.3]
        d = rot - prev_rot
        score = -low[:, 0] * max(d[2], 0.0) + low[:, 0] * max(-d[2], 0.0) + low[:, 2] * max(d[0], 0.0) - low[:, 2] * max(-d[0], 0.0)
        c = low[int(np.argmax(score))]
        # the contact point in the body frame (prev pose), held fixed in the world
        q = np.linalg.solve(rmat(prev_rot), c - H - t)
        t = c - H - rmat(rot) @ q
        t[2] += k - prev_k
        t[1] -= world(rot, t, leg_rots, fr)[:, 1].min() - floor0
        prev_rot, prev_legs, prev_k = rot, leg_rots, k
        T = fr * F
        out["body"]["rot"].append((T, tuple(float(v) for v in rot)))
        out["body"]["loc"].append((T, tuple(float(v) for v in t)))
        for n in legs:
            out[n]["rot"].append((T, tuple(float(v) for v in leg_rots[n])))
            if n.endswith("l"):
                out[n].setdefault("loc", []).append((T, tuple(float(v) for v in tuck(n, fr))))
    # the head: snapped back by the blow, it trails the roll, then slaps
    # down limp onto the floor a frame after the body and lolls
    head = [(0, (0, 0, 0), None), (2, (30, -8, 4), "snap"), (5, (24, 6, -4), "snap"), (8, (14, 6, -10), "snap"), (LAND, (4, 0, -26), "fall"),
            (LAND + 1, (-4, 0, -7), "fall"), (LAND + 3, (-8, -4, -9), "snap"), (LAND + 5, (-7, -4, -7), "snap"), (END, (-7, -4, -7), None)]
    out["head"]["rot"] = [(fr * F, tuple(float(v) for v in curve(head, fr))) for fr in range(END + 1)]
    # the thud: a 1-frame squash of the whole body on the impact
    out["owlbear"] = {"scale": [(0, (1, 1, 1)), ((LAND - 1) * F, (1, 1, 1)), (LAND * F, (1.05, 0.92, 1.04)), ((LAND + 2) * F, (1, 1, 1)), (END * F, (1, 1, 1))]}
    return out, LAND


# ------------------------------------------------------------------ parts
def body() -> Grid:
    """A high shoulder hump, a deep belly and a low rump, with a feathered
    chest bib and a dark stripe down the back."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    start = len(g.solids)
    zseg(g, (CX, 31.0), (CX, 33.0), (11.0, 10.0), (14.0, 12.0), 20, 36, FUR, 4, ch=0.5)
    zseg(g, (CX, 33.0), (CX, 30.0), (14.0, 12.0), (13.0, 10.5), 36, 56, FUR, 4, ch=0.5)
    zseg(g, (CX, 30.0), (CX, 29.0), (13.0, 10.5), (9.0, 7.5), 56, 70, FUR, 4, ch=0.5)
    m = fur(g, start, 4, seed=1)
    P.darken(g, m & (Y < 23.0), 1)  # the shaded belly
    P.flat(g, m & (np.abs(X - CX) < 2.0) & (Y > 41.0), FUR, 3)  # the dark stripe down the back
    # the feathered chest bib: sand feathers on the front of the chest
    bib = m & (Z < 30.0) & (np.abs(X - CX) < 8.5 - (40.0 - Y) * 0.25) & (Y > 22.0) & (Y < 40.0)
    facet_bib = lambda gg, mm, fr: scallops(gg, mm & bib, DISC, 4, frame=fr, width=5, row=4, seed=2, pointed=True)  # noqa: E731
    paint_solids(g, start, facet_bib)
    P.flat(g, bib & (np.abs(np.abs(X - CX) - (8.5 - (40.0 - Y) * 0.25)) < 0.8), FUR, 2)  # a dark edge round the bib
    # the feather mantle on the shoulder hump: the owl half meets the bear
    # half on a ragged line (feather rows, not fur)
    edge = 37.0 + 3.0 * ((np.floor(X / 3.0).astype(int) % 2) == 0) + (Y - 30.0) * 0.12
    mantle = m & (Z < edge) & (Y > 27.0) & ~bib
    paint_solids(g, start, lambda gg, mm, fr: scallops(gg, mm & mantle, FEATHER, 3, frame=fr, width=5, row=4, seed=9, pointed=True, vary=True))
    P.flat(g, mantle & (np.abs(Z - edge) < 0.9), "darkwood", 3)  # the dark tips of the last feather row
    P.flat(g, mantle & (Y > 30.0) & ((np.floor(Y).astype(int) % 6) == 0), "darkwood", 3)  # barred feathers
    # a short fan of tail feathers on the rump, barred, with pale tips
    t0 = len(g.solids)
    for dx, lean in ((-4.0, -2.0), (0.0, 0.0), (4.0, 2.0)):
        side(g, [(30.0, 66.0), (35.5, 66.5), (38.0, 75.5), (35.5, 77.5), (32.0, 74.0)], CX + dx - 2.2 + lean * 0.3, CX + dx + 2.2 + lean * 0.3, FEATHER, 3)
    fan = paint_solids(g, t0, lambda gg, mm, fr: scallops(gg, mm, FEATHER, 3, frame=fr, width=4, row=3, seed=10, pointed=True))
    P.flat(g, fan & ((np.floor(Z).astype(int) % 4) == 0), "darkwood", 3)
    P.flat(g, fan & (Z > 75.0), DISC, 4)
    frame_seams(g, t0, fan, steps=1)
    return g


def leg(name: str) -> Grid:
    """A thick bear leg on a broad paw: big hooked claws on the front paws,
    short ones on the hind paws."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    s, zc = LEGS[name]
    fore = zc < 45
    xl = CX + s * (9.5 if fore else 10.0)
    start = len(g.solids)
    if fore:
        yseg(g, (xl, zc - 1.0), (xl, zc + 1.0), (5.2, 5.4), (6.4, 7.4), 12, 34, FUR, 4)
        yseg(g, (xl, zc - 1.5), (xl, zc - 1.0), (4.8, 5.0), (5.2, 5.4), 4, 13, FUR, 4)
        pz = zc - 1.5
    else:
        yseg(g, (xl, zc + 1.5), (xl, zc - 1.0), (5.4, 6.4), (6.8, 9.0), 14, 33, FUR, 4)
        yseg(g, (xl, zc + 1.5), (xl, zc + 1.5), (4.6, 5.0), (5.2, 5.6), 4, 15, FUR, 4)
        pz = zc + 1.5
    m = fur(g, start, 4, seed=3 + int(zc))
    P.darken(g, m & (Y < 9.0), 1)  # dark socks
    p0 = len(g.solids)
    plan(g, chamfer_rect(xl - 6.0, pz - 7.0, xl + 6.0, pz + 5.0, 2.0), 0, 5.0, FUR, 3,
         top=chamfer_rect(xl - 5.2, pz - 5.2, xl + 5.2, pz + 4.5, 1.6))
    paw = fur(g, p0, 3, seed=4)
    P.flat(g, paw & (Y < 1.0), "darkwood", 2)
    for k in (-1, 1):  # toe splits
        P.flat(g, paw & (np.abs(X - (xl + k * 1.8)) < 0.55) & (Z < pz - 3.0), "darkwood", 3)
    for k in (-1, 0, 1):
        claw(g, xl + k * 3.4, pz - 6.4, 0.0, 6.0 if fore else 3.5, big=fore)
    return g


def head() -> Grid:
    """The owl head: a big octagon block, a heart-shaped facial disc, huge
    orange eyes under an angry brow, a hooked beak, two ear tufts, a
    feathered crown and a feather nape that runs down to the shoulders."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    start = len(g.solids)
    zseg(g, (CX, 48.0), (CX, 48.5), (10.5, 10.0), (11.0, 10.5), FACE_Z + 1.0, 24.0, FEATHER, 4, ch=0.45)
    feathers(g, start, FEATHER, 4, seed=5)
    # the feathered crown: a cap of longer feathers whose back edge is cut
    # into points, and the nape: layered feathers down onto the shoulders
    c0 = len(g.solids)
    zseg(g, (CX, 56.5), (CX, 57.0), (8.5, 2.6), (9.6, 2.8), FACE_Z + 2.0, 25.5, FEATHER, 3, ch=0.5)
    nape = [(57.0, 18.0), (57.5, 26.5), (53.0, 28.5), (51.5, 31.0), (46.0, 33.0), (44.0, 36.0), (38.5, 38.5), (37.0, 33.0), (42.0, 26.0), (46.0, 20.0)]
    side(g, nape, CX - 9.5, CX + 9.5, FEATHER, 3)
    side(g, [(52.0, 24.0), (52.5, 30.5), (46.5, 33.5), (43.0, 37.0), (40.0, 34.0), (45.0, 27.0)], CX - 11.5, CX + 11.5, FEATHER, 4)
    crown = feathers(g, c0, FEATHER, 3, seed=6, width=5, row=4)
    # dark bars across the nape (the owl's barred feathers)
    bar = crown & (Y < 55.0) & ((np.floor(Y).astype(int) % 6) == 0)
    P.flat(g, bar, "darkwood", 3)
    # the heart-shaped facial disc: cream feathers in rings round each eye
    d0 = len(g.solids)
    disc = front(g, [(CX - 10.5, 52.5), (CX - 7.0, 56.5), (CX - 2.0, 55.0), (CX, 52.5), (CX + 2.0, 55.0), (CX + 7.0, 56.5), (CX + 10.5, 52.5),
                     (CX + 10.0, 44.0), (CX + 4.0, 38.5), (CX, 37.0), (CX - 4.0, 38.5), (CX - 10.0, 44.0)], FACE_Z, FACE_Z + 2.0, DISC, 5)
    for s in (-1, 1):
        ring = np.hypot(X - (CX + s * 5.0), Y - 48.5)
        own = disc & ((X - CX) * s > 0)
        P.flat(g, own & ((np.floor(ring).astype(int) % 3) == 0), DISC, 4)
        P.flat(g, own & (ring > 7.5), DISC, 6)
    P.flat(g, disc & (np.abs(X - CX) < 0.6), DISC, 3)
    inner = disc.copy()
    for ax in (0, 1):
        for step in (1, -1):
            inner &= np.roll(disc, step, axis=ax)
    P.flat(g, disc & ~inner, "darkwood", 3)  # the dark ruff round the disc
    # two huge orange eyes, bulging out of the disc
    eye = {"d": C("darkwood", 1), "o": C("orange", 5), "O": C("gold", 7), "y": C("gold", 6), "p": C("darkwood", 0), "w": C("bone", 7)}
    rows = [".dddd.",
            "dyOOyd",
            "dOppod",
            "dOppod",
            "dyooyd",
            ".dddd."]
    for s in (-1, 1):
        xc = CX + s * 5.0
        front(g, [(xc - 2.0, 45.0), (xc + 2.0, 45.0), (xc + 3.0, 46.0), (xc + 3.0, 50.0), (xc + 2.0, 51.0), (xc - 2.0, 51.0), (xc - 3.0, 50.0), (xc - 3.0, 46.0)],
              FACE_Z - 2.0, FACE_Z + 1.0, "darkwood", 2)
        pnglyph.stamp(g, "-z", FACE_Z - 2.0, int(xc - 3.0), 45, rows, eye, reach=0)
        # an angry brow: a dark feather ridge slanting down to the beak
        b0 = len(g.solids)
        front(g, quad((CX + s * 1.0, 52.0), (CX + s * 9.5, 56.0), 1.2, 1.5), FACE_Z - 1.6, FACE_Z + 3.0, "darkwood", 3)
        feathers(g, b0, "darkwood", 3, seed=7, width=4, row=3)
    # the hooked beak
    k0 = len(g.solids)
    side(g, [(48.0, FACE_Z + 1.0), (48.0, FACE_Z - 2.5), (45.5, FACE_Z - 4.5), (41.0, FACE_Z - 4.2), (39.0, FACE_Z - 2.8), (42.0, FACE_Z - 2.2), (42.5, FACE_Z + 1.0)], CX - 2.4, CX + 2.4, "stone", 4)
    beak = np.logical_or.reduce([sol.mask(g.shape) for sol in g.solids[k0:]])
    P.flat(g, beak & (Y > 46.0), "stone", 5)
    P.flat(g, beak & (np.abs(X - CX) < 0.6) & (Y > 44.0), "stone", 6)  # the lit ridge
    P.flat(g, beak & (Y < 42.5), "darkwood", 3)  # the dark hook tip
    frame_seams(g, k0, beak, steps=1)
    # two dark ear tufts, swept up and out
    for s in (-1, 1):
        t0 = len(g.solids)
        front(g, [(CX + s * 3.5, 55.0), (CX + s * 10.5, 55.0), (CX + s * 12.5, 64.5), (CX + s * 8.5, 59.0)], 12.0, 17.0, "darkwood", 2)
        tuft = feathers(g, t0, "darkwood", 2, seed=8, width=3, row=3)
        P.flat(g, tuft & (Y > 62.5), FEATHER, 5)  # pale tips
    return g


# ------------------------------------------------------------------ clips
def keyed(root, clip: dict) -> dict:
    """Give every part with a grid a rest key in the clip, so a viewer that
    plays one clip per part never keeps a pose from another clip."""
    for part in root.walk():
        if part.grid is not None and part.name not in clip:
            clip[part.name] = {"rot": keys((0, 0, 0, 0))}
    return clip


def lumber_move(root) -> dict:
    """move: a heavy bear walk, 40 frames: a four-beat lateral walk (left
    hind f4, left fore f14, right hind f24, right fore f34), three paws
    down at a time, each planted paw sliding back at one ground speed.
    The bulk heaves up between footfalls and falls into each forepaw
    plant with gravity, sinking 2 frames past it and stopping dead, the
    front pitching down onto the paw (the hind plants land softer); the
    owl head rides it a beat late, swinging against the shoulders. (Frames as
    authored; turn_loop then starts the loop mid-stroke.)"""
    T = 40
    ph = {"leg-bl": 4, "leg-fl": 14, "leg-br": 24, "leg-fr": 34}
    gait = Gait(root, "body", list(ph))
    fore = thump(T, [14, 34], depth=1.8, fall=5, past=2)
    hind = thump(T, [4, 24], depth=0.9, fall=4, past=2)
    pitch = thump(T, [14, 34], depth=1.0, fall=3, past=2, rise=6)

    def z(*v):
        return np.array(v, float)
    s = gait.walk(T, {n: fr / T for n, fr in ph.items()}, duty=0.72, stride=12.0, lift=4.0,
                  body_rot=lambda f: z(-1.6 * pitch(f), 0, 0), height=lambda f: 0.4 - max(fore(f), hind(f)), carry=0.75, land=0.3)
    sq = thump(T, [14, 34], depth=1.0, fall=1, past=2, rise=5)
    s["head"] = {"rot": [r + z(-5 * sq((f - 2) % T), 0, 0) for f, r in enumerate(
        cyc([(0, z(1, 3, -2)), (16, z(0, -5, 3), "snap"), (24, z(1, -3, 2)), (36, z(0, 5, -3), "snap")], T))]}
    s, _ = turn_loop(s, T)
    return per_frame(s)


def build():
    parts = [("owlbear", None, None, None),
             ("body", body(), BODY_HINGE, None),
             ("head", head(), HEAD_HINGE, "body")]
    for name, (s, zc) in LEGS.items():
        fore = zc < 45
        parts.append((name, leg(name), (CX + s * (9.5 if fore else 10.0), 31.0 if fore else 30.0, zc), "body"))
    root, to_root = rig(parts)
    z = (0, 0, 0, 0)
    lift = (0, 0, 0.6, 0)
    idle = {"body": {"scale": keys((0, 1, 1, 1), (1.2, 1.02, 1.04, 1.0), (2.4, 1, 1, 1))},
            "head": {"rot": keys(z, (0.5, 0, 0, 0), (0.7, 0, 38, 4), (1.3, 0, 38, 4), (1.5, 0, 0, 0), (1.9, -6, -16, 0), (2.4, 0, 0, 0))},
            "leg-fl": {"rot": keys(z, (1.6, 0, 0, 0), (1.8, 14, 0, 0), (2.0, 0, 0, 0), (2.4, 0, 0, 0)),
                       "loc": keys(z, (1.55, *lift[1:]), (2.05, *lift[1:]), (2.1, 0, 0, 0))}}
    f = 1 / 30

    def fk(*rows):
        """Keys from (frame, x, y, z) rows."""
        return [(fr * f, (x, y, w)) for fr, x, y, w in rows]

    def plant(dz, hip=30.0):  # a planted leg turns by this as the body slides by dz
        return math.degrees(math.asin(max(-1.0, min(1.0, dz / hip))))

    # The mauling lunge. Rear (f0-10, the anticipation): it draws back and
    # rears up on the hind paws, the front claws raised and spread, the head
    # back. Then it lunges forward in two heavy strides: the left paw slams
    # down ahead (f14), the chest still driving down, then the right paw
    # slams down further ahead (impact f20, the dust slam) with the beak
    # snapping down. A beat with its weight on its forepaws, then it steps
    # the front paws back one at a time (lift, move, plant) as the body
    # settles back. The hind paws stay planted and still throughout: the
    # body rears and drives down about the hind hips (no slide over them),
    # so the hind legs never move in the world.
    SLAM1, SLAM2 = 14, 20
    pitch = [(0, 0), (6, 18), (10, 24), (SLAM1, 2), (17, 4), (SLAM2, -1.5), (23, -2), (28, -1.5), (32, 0), (45, 0)]
    attack = {"body": {"rot": fk(*[(fr, a, 0, 0) for fr, a in pitch])},  # its loc keeps the hind hips still (set per frame below)
              "head": {"rot": fk((0, 0, 0, 0), (6, 12, 0, 0), (10, 16, 4, 0), (SLAM1, -12, 6, 0), (17, 4, -6, 0), (SLAM2, -20, -4, 0), (23, -24, 0, 0),
                                 (27, -16, 8, 3), (31, -18, -6, -2), (37, -6, 0, 0), (45, 0, 0, 0))}}
    attack["leg-fl"] = {"rot": fk((0, 0, 0, 0), (6, 40, 0, -14), (10, 46, 0, -16), (SLAM1, -2, 0, 0), (17, plant(-2.0, 31) - 4, 0, 0),
                                  (SLAM2, plant(-4.0, 31) + 1.5, 0, 0), (23, plant(-4.6, 31) + 2, 0, 0), (28, 24, 0, -4), (32, 0, 0, 0), (45, 0, 0, 0)),
                        "loc": fk((0, 0, 0, 0), (24, 0, 0, 0), (28, 0, 3.0, 0), (32, 0, 0, 0), (45, 0, 0, 0))}
    attack["leg-fr"] = {"rot": fk((0, 0, 0, 0), (6, 40, 0, 14), (10, 46, 0, 16), (SLAM1, 36, 0, 10), (17, 44, 0, 6), (SLAM2, 4, 0, 0), (23, 5, 0, 0),
                                  (28, 4, 0, 0), (32, 26, 0, 4), (36, 0, 0, 0), (45, 0, 0, 0)),
                        "loc": fk((0, 0, 0, 0), (28, 0, 0, 0), (32, 0, 3.0, 0), (36, 0, 0, 0), (45, 0, 0, 0))}
    # each forepaw is set down on the floor where it lands (touch), held
    # planted while the weight comes onto it, lifted to step back, and
    # planted on its own spot again; the hind paws never move
    feet = Planter(root, "body", list(LEGS), top="owlbear")
    front_feet = Planter(root, "body", ["leg-fl", "leg-fr"], top="owlbear")
    planted = {"leg-fl": [(0, 1.0), (2, 0.0), (SLAM1 - 1, 0.0), (SLAM1, 1.0), (24, 1.0), (25, 0.0), (31, 0.0), (32, 1.0)],
               "leg-fr": [(0, 1.0), (2, 0.0), (SLAM2 - 1, 0.0), (SLAM2, 1.0), (28, 1.0), (29, 0.0), (35, 0.0), (36, 1.0)]}
    anchors = {"leg-fl": [(0, 0.0), (SLAM1, "touch"), (31, 0.0)], "leg-fr": [(0, 0.0), (SLAM2, "touch"), (35, 0.0)]}
    spec = {part: {ch: [(round(t / f), v) for t, v in ks] for ch, ks in chans.items()} for part, chans in attack.items()}
    end = max(fr for chans in spec.values() for ks in chans.values() for fr, _ in ks)
    smp = sample(spec, end, SLAM2, 0.3)
    hip = np.array((0.0, 30.0, LEGS["leg-bl"][1] - BODY_HINGE[2]))  # the hind hips, from the body pivot
    keyed_front = {n: [r.copy() for r in smp[n]["rot"]] for n in ("leg-fl", "leg-fr")}

    def pose():
        """Body loc about the still hind hips, hind legs countering the
        pitch, forepaws solved on their spots."""
        rot = smp["body"]["rot"]
        smp["body"]["loc"] = [hip - rmat(r) @ hip for r in rot]
        for leg_name in ("leg-bl", "leg-br"):  # the hind legs hold still in the world
            smp[leg_name] = {"rot": [-r for r in rot]}
        for n in keyed_front:
            smp[n]["rot"] = [r.copy() for r in keyed_front[n]]
        front_feet.solve(smp, end, planted, anchors, lift=[(0, 0.0)])

    def low(n, fr):
        return front_feet._world(n, smp["body"]["loc"][fr], smp["body"]["rot"][fr], np.ones(3), smp[n]["rot"][fr], front_feet._top(smp, fr))[0]

    def down(n, fr):  # fully planted on this frame
        return fr > 2 and all(not (f0 <= fr < f1 and w0 < 1) for (f0, w0), (f1, _) in zip(planted[n], planted[n][1:]))
    for _ in range(4):
        # the body can't sink onto the still hind hips, so the pitch takes up
        # the floor: lifted where a forepaw would dig in, lowered where a
        # planted one would hang
        pose()
        for fr in range(end + 1):
            lo = min(low(n, fr) for n in keyed_front)
            if lo >= -0.05:
                lows = [low(n, fr) for n in keyed_front if down(n, fr)]
                lo = min(lows) if lows else 0.0
            if abs(lo) > 0.05:
                smp["body"]["rot"][fr] = smp["body"]["rot"][fr] + np.array((math.degrees(math.asin(max(-1.0, min(1.0, -lo / 32.0)))), 0.0, 0.0))
    pose()
    # between two plants (both forepaws up), carry the pitch across smoothly
    # instead of snapping back to the keyed one
    rot = smp["body"]["rot"]
    free = [fr for fr in range(SLAM1 + 1, end) if not any(down(n, fr) for n in keyed_front)]
    for fr in free:
        a = max(x for x in range(fr) if x not in free)
        b = min(x for x in range(fr + 1, end + 1) if x not in free)
        rot[fr] = rot[a] + (rot[b] - rot[a]) * (fr - a) / (b - a)
    pose()
    attack = keyed(root, per_frame(smp))
    # hit: the blow shoves it back off its feet in a short arc (up by f4,
    # down by f8, the feet trailing), the head thrown back and away; it lands
    # with a squash, drifts a beat, then recovers with weight (a dip and a
    # small overshoot).
    hit = {"owlbear": {"scale": fk((0, 1, 1, 1), (4, 0.98, 1.04, 1.0), (8, 1.05, 0.9, 1.02), (12, 1.01, 0.98, 1.0), (16, 1, 1, 1), (22, 1.02, 0.95, 1.01),
                                  (27, 1, 1, 1), (32, 1, 1, 1))},
           "body": {"loc": fk((0, 0, 0, 0), (2, 0, 2.6, 1.8), (4, 0, 3.6, 3.0), (6, 0, 2.2, 3.6), (8, 0, 0, 3.6), (12, 0, 0, 5.2), (16, 0, 0, 6.6),
                               (23, 0, 0, 0.6), (28, 0, 0, -0.4), (32, 0, 0, 0)),
                    "rot": fk((0, 0, 0, 0), (4, 5, 0, -6), (8, 0, 0, -2), (13, 0, 0, -1.5), (17, 0, 0, -1), (23, -0.5, 0, 0.6), (28, 0, 0, 0), (32, 0, 0, 0))},
           "head": {"rot": fk((0, 0, 0, 0), (3, 32, -20, 12), (7, 26, -16, 9), (12, 22, -14, 8), (17, 12, -4, 3), (23, -10, 4, -3), (28, 3, 0, 0), (32, 0, 0, 0))},
           }
    for leg_name in LEGS:  # the paws keep their spot (the legs trail), land there, and the body comes back over them
        hit[leg_name] = {"rot": fk((0, 0, 0, 0), (32, 0, 0, 0))}
    hit = keyed(root, bake(hit, None, feet, {n: [(0, 1.0)] for n in LEGS}, lift=[(0, 1.0), (1, 0.0), (7, 0.0), (8, 1.0)]))
    # death: knocked back and over onto its side with a heavy slam (see owlbear_fall)
    grids = {name: g for name, g, _, _ in parts if g is not None}
    hinges = {name: h for name, _, h, _ in parts if h is not None}
    death, LAND = owlbear_fall(grids, hinges)
    paw = to_root((CX + 9.5, 1.0, LEGS["leg-fr"][1] - 6.0))
    return asset("creatures", "owlbear", "Owlbear", root,
                 clips=[Clip("idle", keyed(root, idle)), Clip("attack", attack, loop=False, impact=SLAM2 * f, ease=0.0), Clip("hit", hit, loop=False, ease=0.0), Clip("death", keyed(root, death), loop=False, impact=LAND / 30, ease=0.0),
                        Clip("move", keyed(root, lumber_move(root)), ease=0.0, floor=False)],
                 sockets=[Socket("socket-function", at=paw, parent="leg-fr")],
                 fx=[pfx("rvx-fantasy-dust-slam", "socket-function", "clip:attack", size=24, at=SLAM2 * f)])
