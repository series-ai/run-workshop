"""Space pack helpers for animated props, creatures and terrain (import as `_life`).

PN mecha style (rules in docs/art-direction.md): steel plates with
rivets, copper pipes and gears, teal glowing glass, hazard orange, warm
white hull panels. Aliens use vivid accents (toxic, magenta, purple, lime).
Everything is built from big prisms (true slopes, rule F2) and painted
(rule S1); these helpers only wrap the shared kit (pnshapes, pnpaint,
paint) with the space defaults.

Parts: author every part grid at full size in one shared frame, then call
`assemble` with the joint points; it crops each grid (prisms survive) and
sets pivots and placements. Sockets use `sock`, which turns a shared-frame
point into root pivot space.
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnpaint
from pnkit import box, edges
from pnshapes import coords, facets, flat_ngon, last, quad, seams  # noqa: F401
from voxgrid import C, Asset, Clip, Grid, Part, Socket, pfx_binding, turn  # noqa: F401

PACK = "space"


# ------------------------------------------------------------------ assets
def asset(category: str, slug: str, name: str, root: Part, clips=(), sockets=(), pfx=()) -> Asset:
    return Asset(id=f"{PACK}-{category}-{slug}", pack=PACK, category=category, name=name, root=root, clips=list(clips), sockets=list(sockets), pfx=list(pfx))


def keys(*pairs):
    """keys((t, (x, y, z)), ...) as a list of (seconds, tuple)."""
    return [(float(t), tuple(float(c) for c in v)) for t, v in pairs]


def pfx(effect: str, socket: str, trigger: str, **kw) -> dict:
    return pfx_binding(effect, socket, trigger, **kw)


def spin(seconds: float, axis: str = "y", degrees: float = 360.0):
    """Keys for a whole number of turns in `seconds` (loops cleanly)."""
    return turn(seconds, axis, degrees / seconds)


def wave(seconds: float, axis: str, amp: float, phase: float = 0.0, steps: int = 8, base=(0.0, 0.0, 0.0)):
    """Sine keys on one axis (rot degrees or loc voxels), looping."""
    i = "xyz".index(axis)
    out = []
    for k in range(steps + 1):
        v = list(base)
        v[i] += amp * math.sin(2 * math.pi * k / steps + phase)
        out.append((seconds * k / steps, tuple(float(c) for c in v)))
    return out


# ------------------------------------------------------------------ parts
def crop(g: Grid) -> tuple[Grid, tuple[int, int, int]]:
    """Crop a grid to its filled bounds (prisms move with it)."""
    nz = np.nonzero(g.a)
    if len(nz[0]) == 0:
        raise ValueError("crop of an empty grid")
    lo = [int(i.min()) for i in nz]
    hi = [int(i.max()) + 1 for i in nz]
    return g.crop(*lo, *hi), (lo[0], lo[1], lo[2])


class Rig:
    """Parts painted in one shared frame. `add(name, grid, joint, parent,
    rot)`: `joint` is the pivot point in the shared frame; parents first.
    `rot` is a rest rotation about the joint. `sock(name, point, parent)`
    makes a socket at a shared-frame point."""

    def __init__(self) -> None:
        self.root: Part | None = None
        self.joints: dict[str, tuple[Part, tuple[float, float, float]]] = {}

    def add(self, name: str, g: Grid, joint, parent: str | None = None, rot=(0.0, 0.0, 0.0)) -> Part:
        cg, off = crop(g)
        pivot = (joint[0] - off[0], joint[1] - off[1], joint[2] - off[2])
        if parent is None:
            if self.root is not None:
                raise ValueError("the rig has a root already")
            part = Part(name, cg, pivot=pivot, rot=tuple(rot))
            self.root = part
        else:
            pp, pj = self.joints[parent]
            part = pp.add(Part(name, cg, pivot=pivot, at=(joint[0] - pj[0], joint[1] - pj[1], joint[2] - pj[2]), rot=tuple(rot)))
        self.joints[name] = (part, tuple(float(c) for c in joint))
        return part

    def group(self, name: str, joint, parent: str | None = None) -> Part:
        """A part with no grid (a pivot to animate several children); with
        no parent it becomes the root."""
        if parent is None:
            if self.root is not None:
                raise ValueError("the rig has a root already")
            part = Part(name, None, pivot=(0.0, 0.0, 0.0))
            self.root = part
            self.joints[name] = (part, tuple(float(c) for c in joint))
            return part
        pp, pj = self.joints[parent]
        part = pp.add(Part(name, None, pivot=(0.0, 0.0, 0.0), at=(joint[0] - pj[0], joint[1] - pj[1], joint[2] - pj[2])))
        self.joints[name] = (part, tuple(float(c) for c in joint))
        return part

    def sock(self, name: str, point, parent: str | None = None) -> Socket:
        if self.root is None:
            raise ValueError("add the root first")
        rj = self.joints[self.root.name][1]
        return Socket(name, at=(point[0] - rj[0], point[1] - rj[1], point[2] - rj[2]), parent=parent)


# ------------------------------------------------------------------ prisms
def side(g: Grid, pts_yz, x0, x1, ramp: str, shade: int = 4) -> np.ndarray:
    """A prism across x from a side-view (y, z) polygon."""
    g.prism("x", pts_yz, x0, x1, C(ramp, shade))
    return last(g)


def front(g: Grid, pts_xy, z0, z1, ramp: str, shade: int = 4) -> np.ndarray:
    """A prism along z from a front-view (x, y) polygon."""
    g.prism("z", pts_xy, z0, z1, C(ramp, shade))
    return last(g)


def plan(g: Grid, pts_xz, y0, y1, ramp: str, shade: int = 4, top=None) -> np.ndarray:
    """A prism along y from a plan (x, z) polygon (`top` makes a frustum)."""
    g.prism("y", pts_xz, y0, y1, C(ramp, shade), top=top)
    return last(g)


def octo(cx, cz, hx, hz, ch):
    """A chamfered rectangle (x, z) centred on (cx, cz): half sizes hx, hz, chamfer ch."""
    return [(cx - hx + ch, cz - hz), (cx + hx - ch, cz - hz), (cx + hx, cz - hz + ch), (cx + hx, cz + hz - ch),
            (cx + hx - ch, cz + hz), (cx - hx + ch, cz + hz), (cx - hx, cz + hz - ch), (cx - hx, cz - hz + ch)]


def ngon_y(g: Grid, cx, cz, r, y0, y1, ramp: str, shade: int = 4, n: int = 8, r_top: float | None = None) -> np.ndarray:
    """Upright n-gon prism or frustum (flat radius r at y0, r_top at y1)."""
    poly = flat_ngon(cx, cz, r, n)
    top = None if r_top is None else (flat_ngon(cx, cz, r_top, n) if r_top > 0 else [(cx, cz)] * n)
    g.prism("y", poly, y0, y1, C(ramp, shade), top=top)
    return last(g)


def gem(g: Grid, cx, cz, y0, r, h, ramp: str, shade: int = 4, n: int = 8, waist: float = 0.5, cap: float = 0.45) -> list:
    """A faceted ball (planets, bulbs, heads): four stacked n-gon frustums,
    flat radius `cap`·r at the poles and r at the waist (`waist` of the
    height up). Returns the four solids (paint them with `facet_paint`)."""
    yw = y0 + h * waist
    y1, y3 = y0 + h * waist * 0.38, yw + (h - h * waist) * 0.62
    rings = [(cap * r, y0), (0.9 * r, y1), (r, yw), (0.9 * r, y3), (cap * r, y0 + h)]
    start = len(g.solids)
    for (ra, ya), (rb, yb) in zip(rings, rings[1:]):
        if int(round(yb)) <= int(round(ya)):
            continue
        g.prism("y", flat_ngon(cx, cz, ra, n), round(ya), round(yb), C(ramp, shade), top=flat_ngon(cx, cz, rb, n))
    return g.solids[start:]


GLOBE = [(-1.0, 0.4), (-0.72, 0.74), (-0.28, 0.98), (0.28, 0.98), (0.72, 0.74), (1.0, 0.4)]


def globe(g: Grid, cx, cy, cz, r, ramp: str, shade: int = 5, n: int = 10) -> list:
    """A faceted ball (planets): five stacked n-gon frustums through the
    GLOBE profile (flat poles, true slopes everywhere else), centre (cx,
    cy, cz), flat radius r. Returns the solids."""
    start = len(g.solids)
    for (fa, ra), (fb, rb) in zip(GLOBE, GLOBE[1:]):
        ya, yb = round(cy + fa * r), round(cy + fb * r)
        if yb <= ya:
            continue
        g.prism("y", flat_ngon(cx, cz, ra * r, n), ya, yb, C(ramp, shade), top=flat_ngon(cx, cz, rb * r, n))
    return g.solids[start:]


def section8(cx, cy, w, h, k: float = 0.38):
    """A chamfered-rectangle section (x, y): half width w, half height h,
    corners cut by k of each half size (k=0.29 is near a regular octagon)."""
    a, b = w * (1 - k), h * (1 - k)
    return [(cx - a, cy - h), (cx + a, cy - h), (cx + w, cy - b), (cx + w, cy + b), (cx + a, cy + h), (cx - a, cy + h), (cx - w, cy + b), (cx - w, cy - b)]


def loft(g: Grid, cx, rings, ramp: str, shade: int = 4, k: float = 0.38) -> list:
    """Faceted body along z: `rings` are (z, half width, half height, centre
    y) in order of z; each pair becomes one frustum (true slopes both ways).
    Bodies, heads, egg sacs, planets seen from the side. Returns the solids."""
    start = len(g.solids)
    for (z0, w0, h0, y0), (z1, w1, h1, y1) in zip(rings, rings[1:]):
        g.prism("z", section8(cx, y0, w0, h0, k), z0, z1, C(ramp, shade), top=section8(cx, y1, w1, h1, k))
    return g.solids[start:]


def rock(g: Grid, cx, cz, y0, r, h, ramp: str = "gray", shade: int = 5, n: int = 7, seed: int = 0, lean=(0.0, 0.0), squash: float = 1.0) -> list:
    """An irregular faceted boulder: three stacked frustums whose n corners
    have jittered radii (true slopes, no voxel stairs). `lean` shifts the
    top ring in (x, z); `squash` scales the depth (z). Returns the solids."""
    rng = np.random.default_rng(seed)
    a0 = rng.uniform(0, 2 * math.pi)
    jit = rng.uniform(0.78, 1.12, size=n)

    def ring(rad, dx=0.0, dz=0.0, rot=0.0):
        return [(cx + dx + rad * jit[k] * math.cos(a0 + rot + 2 * math.pi * k / n), cz + dz + squash * rad * jit[k] * math.sin(a0 + rot + 2 * math.pi * k / n)) for k in range(n)]

    lx, lz = lean
    levels = [(0.0, 0.8, 0, 0), (0.35, 1.0, 0.3, 0.15), (0.75, 0.72, 0.7, 0.3), (1.0, 0.3, 1.0, 0.5)]
    start = len(g.solids)
    for (t0, s0, l0, q0), (t1, s1, l1, q1) in zip(levels, levels[1:]):
        ya, yb = round(y0 + h * t0), round(y0 + h * t1)
        if yb <= ya:
            continue
        g.prism("y", ring(r * s0, lx * l0, lz * l0, q0), ya, yb, C(ramp, shade), top=ring(r * s1, lx * l1, lz * l1, q1))
    return g.solids[start:]


def mask_of(g: Grid, solids) -> np.ndarray:
    return np.logical_or.reduce([s.mask(g.shape) for s in solids])


def facet_paint(g: Grid, solids, painter) -> np.ndarray:
    """painter(g, mask, frame) on every face of `solids`; returns their mask."""
    for m, fr in facets(g, solids):
        painter(g, m, fr)
    return mask_of(g, solids)


# ------------------------------------------------------------------ paint
def plated(g: Grid, mask, ramp: str = "steel", base: int = 5, size=(8, 6), frame=None, edge: bool = True, seed: int = 0) -> np.ndarray:
    """PN mecha plates with rivets and (on box-like masks) a darker rim."""
    pnpaint.plated(g, mask, ramp, base, size=size, edge=edge, frame=frame, seed=seed)
    return mask


def plate_facets(g: Grid, solids, ramp: str = "steel", base: int = 5, size=(8, 6), seed: int = 0) -> np.ndarray:
    return facet_paint(g, solids, lambda gg, mm, fr: P.plates(gg, mm, ramp, base, size=size, frame=fr, seed=seed))


def hazard(g: Grid, mask, period: int = 6, a=("orange", 5), b=("steel", 3), frame=None) -> None:
    pnpaint.hazard(g, mask, period=period, a=a, b=b, frame=frame)


def band(g: Grid, mask, axis: int, lo: float, hi: float, ramp: str, shade: int) -> np.ndarray:
    """Paint the part of `mask` with lo <= coordinate < hi on `axis` (voxel centres)."""
    c = coords(g)[axis]
    m = mask & (c >= lo) & (c < hi)
    P.flat(g, m, ramp, shade)
    return m


def light_top(g: Grid, mask, ramp: str, shade: int) -> np.ndarray:
    """Paint the voxels of `mask` that see the sky (a lit top rim)."""
    up = np.zeros(g.shape, dtype=bool)
    up[:, :-1, :] = g.a[:, 1:, :] == 0
    up[:, -1, :] = True
    m = mask & up
    P.flat(g, m, ramp, shade)
    return m


def spots(g: Grid, mask, ramp: str, shade: int, cell: int = 5, r: float = 1.2, chance: int = 3, seed: int = 0) -> np.ndarray:
    """Round painted spots on a jittered 3D lattice (hide spots, lights, craters)."""
    X, Y, Z = coords(g)
    cx, cy, cz = np.floor(X / cell), np.floor(Y / cell), np.floor(Z / cell)
    h = P._hash(cx.astype(np.int64), cy.astype(np.int64), cz.astype(np.int64), seed=seed)
    ox = (h % np.uint64(97)).astype(float) / 97 * (cell - 2 * r) + r
    oy = ((h // np.uint64(97)) % np.uint64(89)).astype(float) / 89 * (cell - 2 * r) + r
    oz = ((h // np.uint64(8633)) % np.uint64(83)).astype(float) / 83 * (cell - 2 * r) + r
    d = np.sqrt((X - cx * cell - ox) ** 2 + (Y - cy * cell - oy) ** 2 + (Z - cz * cell - oz) ** 2)
    pick = (h % np.uint64(chance)) == 0
    m = mask & pick & (d <= r)
    P.flat(g, m, ramp, shade)
    return m


def eye(g: Grid, mask, cx, cy, r: float, iris=("toxic", 6), pupil=("purple", 1), white=("bone", 7), axis: int = 0, glint: bool = True) -> np.ndarray:
    """A big painted cartoon eye on the voxels of `mask` (seen along z):
    a white ring, a coloured iris, a dark pupil and a glint. `axis` 0 paints
    on faces looking along z ((x, y) disc)."""
    X, Y, _Z = coords(g)
    d = np.hypot(X - cx, Y - cy)
    P.flat(g, mask & (d <= r), *white)
    P.flat(g, mask & (d <= r * 0.72), *iris)
    P.flat(g, mask & (d <= r * 0.38), *pupil)
    if glint:
        P.flat(g, mask & (np.hypot(X - (cx - r * 0.35), Y - (cy + r * 0.35)) <= max(0.7, r * 0.22)), "bone", 7)
    return mask & (d <= r)


EYES = {
    4: [".oo.", "owpo", "oppo", ".oo."],
    5: [".ooo.", "owwpo", "owppo", "owwwo", ".ooo."],
    6: [".oooo.", "owwwwo", "owwppo", "owwppo", "o+wwwo", ".oooo."],
    8: ["..oooo..", ".owwwwo.", "owwwwwwo", "owwwpppo", "owwppppo", "o+wpppwo", ".owwwwo.", "..oooo.."],
}


def cartoon_eye(g: Grid, face: str, plane: float, u0: int, v0: int, size: int, outline=("navy", 3), white=("bone", 7), pupil=("navy", 1), glint=("bone", 6), mirror: bool = False) -> np.ndarray:
    """A pixel cartoon eye (4, 5, 6 or 8 px) stamped on a face: an outline
    ring, a white, a big pupil to one side and a glint. `mirror` puts the
    pupil on the other side (a pair looks at the same point)."""
    import pnglyph

    rows = EYES[size]
    if mirror:
        rows = [r[::-1] for r in rows]
    legend = {"o": C(*outline), "w": C(*white), "p": C(*pupil), "+": C(*glint)}
    return pnglyph.stamp(g, face, plane, u0, v0, rows, legend)


def glow(g: Grid, mask, ramp: str = "cyan", core: int = 7, rim: int = 5) -> None:
    """Glowing glass: a bright core with a slightly darker rim."""
    P.flat(g, mask, ramp, core)
    P.outline(g, mask, ramp, rim)


__all__ = [
    "C", "Clip", "Grid", "Part", "Socket", "P", "box", "edges", "coords", "facets", "flat_ngon", "last", "quad", "seams",
    "asset", "keys", "pfx", "spin", "wave", "crop", "Rig", "side", "front", "plan", "octo", "ngon_y", "gem", "globe", "section8", "loft", "rock", "mask_of",
    "facet_paint", "plated", "plate_facets", "hazard", "band", "light_top", "spots", "eye", "cartoon_eye", "glow",
]
