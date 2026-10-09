"""Space props helpers in the Pirate Nation mecha style (import as `_props`).

Props are icons (rule K3): one chunky shape, few parts, big features.
The space look is PN mecha: steel plates with rivets, copper pipes and
gears, teal/cyan glowing windows, hazard orange, plus warm white hull
panels. These helpers fill a grid and paint it; detail is paint (S1).

    cham          chamfered rectangle polygon (true 45° corners)
    cham_prism    a chamfered block (or frustum) along any axis
    hull          riveted hull plates with a darker frame on the edges
    panel         a flat panel standing proud of a face, outlined dark
    glow          a glowing window panel (copper rim, bar, glint)
    screen        a glowing screen with painted scan lines
    lamp          a chunky octagonal warning lamp with a cap
    feet          stubby square feet under a body
    stripe        a painted band across a mask
    dots          round painted dots (buttons, lights, rivets)
    service_panel a framed inset panel that breaks up a broad face
    slats         a painted vent of alternating dark and lit slats
    bolt_row      a row of painted bolts along a face
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnpaint
from pnkit import box, edges, on_face
from pnshapes import coords, flat_ngon, last
from voxgrid import C, Grid

_PLANE = {"x": (1, 2), "y": (0, 2), "z": (0, 1)}


def cham(u0: float, v0: float, u1: float, v1: float, ch: float) -> list[tuple[float, float]]:
    """A rectangle with 45° chamfers `ch` on its four corners (8 points)."""
    return [(u0 + ch, v0), (u1 - ch, v0), (u1, v0 + ch), (u1, v1 - ch), (u1 - ch, v1), (u0 + ch, v1), (u0, v1 - ch), (u0, v0 + ch)]


def cham_prism(g: Grid, axis: str, u0, v0, u1, v1, ch, lo, hi, ramp: str, base: int = 4, inset: float = 0.0, top_ch: float | None = None) -> np.ndarray:
    """A chamfered block along `axis` ((u, v) in PRISM_PLANE order: (y, z)
    for 'x', (x, z) for 'y', (x, y) for 'z'). `inset` > 0 makes a frustum
    whose top (at hi) is smaller by `inset` on every side."""
    poly = cham(u0, v0, u1, v1, ch)
    top = None
    if inset or top_ch is not None:
        tc = ch if top_ch is None else top_ch
        top = cham(u0 + inset, v0 + inset, u1 - inset, v1 - inset, tc)
    g.prism(axis, poly, lo, hi, C(ramp, base), top=top)
    return last(g)


def ngon_prism(g: Grid, axis: str, cu, cv, r, lo, hi, ramp: str, base: int = 4, n: int = 8, r_top: float | None = None) -> np.ndarray:
    """An n-gon (flat radius r) along `axis`, a flat side down (to the
    front for 'y'); r_top makes a frustum."""
    facing = {"x": math.pi, "z": -math.pi / 2, "y": -math.pi / 2}[axis]
    poly = flat_ngon(cu, cv, r, n, facing)
    top = None if r_top is None else flat_ngon(cu, cv, r_top, n, facing)
    g.prism(axis, poly, lo, hi, C(ramp, base), top=top)
    return last(g)


def hull(g: Grid, mask: np.ndarray, ramp: str = "bone", base: int = 5, size=(8, 6), edge: int = 2, rivets: bool = True, frame=None, seed: int = 0) -> np.ndarray:
    """Riveted hull plates (rule S2 metal) with an outline `edge` shades
    darker on the mask edges (S4)."""
    P.plates(g, mask, ramp, base, size=size, rivets=rivets, frame=frame, seed=seed)
    if edge:
        P.flat(g, edges(mask), ramp, max(1, base - edge))
    return mask


def panel(g: Grid, face: str, plane, u0, u1, v0, v1, ramp: str = "steel", base: int = 4, d: int = 1, outline: int = 2) -> np.ndarray:
    """A flat panel standing `d` proud of a face, with a darker outline."""
    m = box(g, *on_face(face, plane, u0, u1, v0, v1, 0, d), ramp, base)
    if outline:
        P.outline(g, m, ramp, max(1, base - outline), normal="y" if face == "top" else face[1])
    return m


def glow(g: Grid, face: str, plane, u0, u1, v0, v1, glass=("cyan", 6), rim=("rust", 3), d: int = 1, bar: bool = True, glint: bool = True) -> np.ndarray:
    """A glowing window panel `d` proud of a face (PN mecha windows)."""
    m = box(g, *on_face(face, plane, u0, u1, v0, v1, 0, d), glass[0], glass[1])
    face_m = _outer_layer(g, m, face)
    pnpaint.glow_window(g, face_m, rim=rim, glass=glass, bar=bar, glint=glint, frame=_frame(face))
    P.flat(g, m & ~face_m, *rim)
    return m


def screen(g: Grid, face: str, plane, u0, u1, v0, v1, glass=("cyan", 5), line=("cyan", 7), rim=("steel", 3), d: int = 1, wave: bool = True) -> np.ndarray:
    """A glowing screen: a dark rim, a lit field, a painted waveform or
    scan lines and a bright corner glint."""
    m = box(g, *on_face(face, plane, u0, u1, v0, v1, 0, d), glass[0], glass[1])
    U, V = _uv(g, face)
    P.flat(g, m, *glass)
    inner = m & (U > u0) & (U < u1 - 1) & (V > v0) & (V < v1 - 1)
    if wave:
        mid = (v0 + v1 - 1) / 2
        amp = max(1.0, (v1 - v0) / 2 - 2)
        curve = mid + amp * np.sin((U - u0) * 2 * math.pi / max(4, (u1 - u0) / 1.5))
        P.flat(g, inner & (np.abs(V - curve) < 0.7), *line)
    else:
        P.flat(g, inner & ((V - v0) % 2 == 1), glass[0], max(1, glass[1] - 1))
    P.flat(g, m & ~inner, *rim)
    return m


def lamp(g: Grid, cx, y0, cz, r: float = 2.5, h: int = 4, glass=("orange", 6), cap=("steel", 3), n: int = 8) -> np.ndarray:
    """A chunky octagonal warning lamp: a dark collar, a glowing lens with a
    bright top band and a small cap (true facets)."""
    m = ngon_prism(g, "y", cx, cz, r + 0.8, y0, y0 + 1, *cap, n=n)
    lens = ngon_prism(g, "y", cx, cz, r, y0 + 1, y0 + 1 + h, *glass, n=n)
    _X, Y, _Z = coords(g)
    P.flat(g, lens & (Y > y0 + h - 0.5), glass[0], min(7, glass[1] + 1))
    m |= lens
    m |= ngon_prism(g, "y", cx, cz, r * 0.6, y0 + 1 + h, y0 + 2 + h, *cap, n=n, r_top=r * 0.35)
    return m


def feet(g: Grid, pts, s: int = 3, h: int = 2, ramp: str = "iron", base: int = 5) -> np.ndarray:
    """Stubby square feet of side `s` at (x, z) corners, from y=0 to h."""
    m = np.zeros(g.shape, dtype=bool)
    for x, z in pts:
        m |= box(g, x, 0, z, x + s, h, z + s, ramp, base)
    P.flat(g, m & (coords(g)[1] > h - 1), ramp, min(7, base + 1))
    return m


def stripe(g: Grid, mask: np.ndarray, axis: str, lo: float, hi: float, ramp: str, shade: int) -> np.ndarray:
    """Paint the part of `mask` with lo <= axis coordinate < hi."""
    c = coords(g)["xyz".index(axis)]
    m = mask & (c > lo) & (c < hi)
    P.flat(g, m, ramp, shade)
    return m


def dots(g: Grid, mask: np.ndarray, face: str, pts, r: float, ramp: str, shade: int, hi=None) -> np.ndarray:
    """Round painted dots of radius r at face points (u, v); `hi` paints a
    lighter top-left pixel (a glint)."""
    U, V = _uv(g, face, centre=True)
    out = np.zeros(g.shape, dtype=bool)
    for u, v in pts:
        d = mask & (np.hypot(U - u, V - v) < r)
        P.flat(g, d, ramp, shade)
        out |= d
        if hi:
            P.flat(g, d & (V - v > 0.2) & (np.abs(U - u) < 0.8), *hi)
    return out


def _uv(g: Grid, face: str, centre: bool = False):
    X, Y, Z = coords(g) if centre else np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")
    return {"-z": (X, Y), "+z": (X, Y), "-x": (Z, Y), "+x": (Z, Y), "top": (X, Z)}[face]


def _frame(face: str):
    return "top" if face == "top" else ("z" if face[1] == "z" else "x")


def _outer_layer(g: Grid, m: np.ndarray, face: str) -> np.ndarray:
    """The layer of a proud panel that faces outward."""
    ax = {"-z": 2, "+z": 2, "-x": 0, "+x": 0, "top": 1}[face]
    idx = np.nonzero(m.any(axis=tuple(a for a in range(3) if a != ax)))[0]
    k = idx.min() if face[0] == "-" else idx.max()
    sel = [slice(None)] * 3
    sel[ax] = k
    out = np.zeros_like(m)
    out[tuple(sel)] = m[tuple(sel)]
    return out


# ------------------------------------------------- big-face articulation --
# Broad hull faces need deliberate structure, not noise: a framed service
# panel, slatted vents and a chunky latch read at thumbnail size (S4, F6).

_NORMAL = {"-z": "z", "+z": "z", "-x": "x", "+x": "x", "top": "y"}


def service_panel(g: Grid, mask: np.ndarray, face: str, u0, v0, u1, v1, ramp: str = "bone", base: int = 6,
                  rim=("steel", 2), bolt: bool = True, seam: str | None = "v") -> np.ndarray:
    """One framed inset panel painted on a big face: a dark 1-voxel frame, a
    mid seam and light rivet dots inside the corners, like the PN plate tiles
    (S2, S4). The frame is the only dark tone, so the panel keeps a clean
    rectangular read at thumbnail size."""
    U, V = _uv(g, face, centre=True)
    pan = mask & (U > u0) & (U < u1) & (V > v0) & (V < v1)
    P.flat(g, pan, ramp, base)
    if seam == "v":
        P.flat(g, pan & (np.abs(V - (v0 + v1) / 2) < 0.5), ramp, max(1, base - 2))
    elif seam == "u":
        P.flat(g, pan & (np.abs(U - (u0 + u1) / 2) < 0.5), ramp, max(1, base - 2))
    if bolt:
        for cu in (u0 + 2.0, u1 - 2.0):
            for cv in (v0 + 2.0, v1 - 2.0):
                P.flat(g, pan & (np.abs(U - cu) < 0.6) & (np.abs(V - cv) < 0.6), ramp, min(7, base + 2))
    P.outline(g, pan, rim[0], rim[1], normal=_NORMAL[face])
    return pan


def slats(g: Grid, mask: np.ndarray, face: str, u0, v0, u1, v1, ramp: str = "steel", dark: int = 2, lit: int = 5,
          rim=("steel", 3)) -> np.ndarray:
    """A painted vent: alternating dark gaps and lit slats inside a frame."""
    U, V = _uv(g, face, centre=True)
    m = mask & (U > u0) & (U < u1) & (V > v0) & (V < v1)
    P.flat(g, m, ramp, dark)
    P.flat(g, m & (np.floor(V - v0) % 2 == 1), ramp, lit)
    P.flat(g, m & ((U < u0 + 1) | (U > u1 - 1)), rim[0], rim[1])
    P.outline(g, m, rim[0], max(1, rim[1] - 1), normal=_NORMAL[face])
    return m


def bolt_row(g: Grid, mask: np.ndarray, face: str, vs, u0, u1, step: float = 4.0, ramp: str = "steel", shade: int = 3) -> np.ndarray:
    """A row of painted bolts along a face, at each v in `vs`."""
    U, V = _uv(g, face, centre=True)
    out = np.zeros(g.shape, dtype=bool)
    u = u0 + 1.0
    while u < u1:
        for v in vs:
            d = mask & (np.abs(U - u) < 0.7) & (np.abs(V - v) < 0.7)
            P.flat(g, d, ramp, shade)
            out |= d
        u += step
    return out
