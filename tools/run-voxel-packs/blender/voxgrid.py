"""Voxel authoring API for RUN voxel pack sources.

Pure Python + numpy (both ship inside Blender), so asset sources and the
mesher can also run in a plain interpreter for tests.

Axes are glTF axes: +X right, +Y up, +Z toward the viewer. World assets face
-Z (like Pirate Nation props, ships and buildings); rig-space assets face +X
(like the PN avatar). A grid cell holds a palette index; 0 means empty.
"""
from __future__ import annotations

import json
import math
import os
import random
from dataclasses import dataclass, field

import numpy as np

_HERE = os.path.dirname(os.path.abspath(__file__))
_DATA = os.path.join(_HERE, "..", "contracts", "data")

with open(os.path.join(_DATA, "palette.json")) as fh:
    PALETTE = json.load(fh)
with open(os.path.join(_DATA, "categories.json")) as fh:
    CATEGORIES = json.load(fh)
with open(os.path.join(_DATA, "clips.json")) as fh:
    CLIPS = json.load(fh)
with open(os.path.join(_DATA, "packs.json")) as fh:
    PACKS = json.load(fh)
with open(os.path.join(_DATA, "rig.generated.json")) as fh:
    RIG = json.load(fh)
with open(os.path.join(_DATA, "scale.json")) as fh:
    SCALE = json.load(fh)
with open(os.path.join(_DATA, "themes.json")) as fh:
    THEMES = json.load(fh)

AVATAR_SLOTS = ("species", "face", "eyebrow", "hair", "facialhair", "ears", "eyewear", "headwear", "tops", "bottoms", "shoes", "back")

RAMP_SHADES = 8


def C(ramp: str, shade: int) -> int:
    """Palette index for a named ramp and shade (0 = darkest, 7 = lightest)."""
    if ramp not in PALETTE["ramps"]:
        raise ValueError(f"unknown palette ramp {ramp!r}")
    if not 0 <= shade < RAMP_SHADES:
        raise ValueError(f"shade {shade} is outside 0..7")
    index = PALETTE["ramps"][ramp] * RAMP_SHADES + shade
    if index == 0:
        raise ValueError("palette index 0 is reserved for empty voxels")
    return index


def _srgb_to_oklab(hex_color: str) -> tuple[float, float, float]:
    rgb = [int(hex_color[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    l = 0.4122214708 * lin[0] + 0.5363325363 * lin[1] + 0.0514459929 * lin[2]
    m = 0.2119034982 * lin[0] + 0.6806995451 * lin[1] + 0.1073969566 * lin[2]
    s = 0.0883024619 * lin[0] + 0.2817188376 * lin[1] + 0.6299787005 * lin[2]
    l, m, s = (math.copysign(abs(v) ** (1 / 3), v) for v in (l, m, s))
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)


def _oklab_to_srgb(lab) -> str:
    L, A, B = lab
    l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
    m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
    s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3
    lin = (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
    out = []
    for c in lin:
        c = min(1.0, max(0.0, c))
        c = 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
        out.append(round(c * 255))
    return "#" + "".join(f"{v:02x}" for v in out)


def theme_ramp(anchor: dict) -> list[str]:
    """8 shades from anchors: `mid` (shade 4), optional `dark` (shade 0) and
    `light` (shade 7). Missing ends darken toward a cooler tone and lighten
    toward a warmer one, like hand-painted ramps. Interpolates in OKLab."""
    mid = _srgb_to_oklab(anchor["mid"])
    dark = _srgb_to_oklab(anchor["dark"]) if "dark" in anchor else (mid[0] * 0.45, mid[1] * 0.8, mid[2] * 0.8 - 0.012)
    light = _srgb_to_oklab(anchor["light"]) if "light" in anchor else (min(0.97, mid[0] + (1 - mid[0]) * 0.62), mid[1] * 0.6, mid[2] * 0.6 + 0.012)
    shades = []
    for k in range(RAMP_SHADES):
        a, b, t = (dark, mid, k / 4) if k <= 4 else (mid, light, (k - 4) / 3)
        shades.append(_oklab_to_srgb(tuple(a[i] + (b[i] - a[i]) * t for i in range(3))))
    return shades


def palette_colors(pack: str | None) -> list[str]:
    """The 256 palette colours for a pack's world theme, or the shared
    palette when `pack` is None (avatar-space assets)."""
    colors = list(PALETTE["colors"])
    if pack is None:
        return colors
    theme = THEMES["packs"].get(pack)
    if theme is None:
        raise ValueError(f"themes.json has no theme for pack {pack!r}")
    for ramp, anchor in theme["ramps"].items():
        if ramp not in PALETTE["ramps"]:
            raise ValueError(f"theme {pack}: unknown ramp {ramp!r}")
        shades = theme_ramp(anchor)
        base = PALETTE["ramps"][ramp] * RAMP_SHADES
        colors[base : base + RAMP_SHADES] = shades
    return colors


def ramp_of(index: int) -> tuple[str, int]:
    """Inverse of C(): (ramp, shade) for a palette index."""
    ramp_id, shade = divmod(index, RAMP_SHADES)
    for name, rid in PALETTE["ramps"].items():
        if rid == ramp_id:
            return name, shade
    raise ValueError(f"palette index {index} has no ramp")


# For a prism along an axis, the two polygon axes (in x, y, z order).
PRISM_PLANE = {"x": (1, 2), "y": (0, 2), "z": (0, 1)}
_AXIS_INDEX = {"x": 0, "y": 1, "z": 2}


def _inside_polygon(px, py, poly) -> np.ndarray:
    """Even-odd test of points (arrays px, py) against a simple polygon."""
    inside = np.zeros(np.broadcast(px, py).shape, dtype=bool)
    n = len(poly)
    for k in range(n):
        x0, y0 = poly[k]
        x1, y1 = poly[(k + 1) % n]
        if y0 == y1:
            continue
        cross = ((y0 > py) != (y1 > py)) & (px < (x1 - x0) * (py - y0) / (y1 - y0) + x0)
        inside ^= cross
    return inside


@dataclass
class Prism:
    """Exact solid between two corresponding polygons in the plane of the
    other two axes (PRISM_PLANE order, voxel coordinates): `poly` at `lo`
    and `top` at `hi` along `axis`. With no `top` it is a straight prism;
    a smaller `top` makes a frustum (tapered chimney, cone), a single
    repeated point a pyramid, two repeated points a hip-roof ridge. Meshed as
    true geometry, so its faces can slope. Its voxels (centres inside) carry
    the colours that paint its faces."""

    axis: str
    poly: list[tuple[float, float]]
    lo: float
    hi: float
    top: list[tuple[float, float]] | None = None

    def __post_init__(self) -> None:
        if self.axis not in PRISM_PLANE:
            raise ValueError(f"prism axis must be x, y or z, got {self.axis!r}")
        if len(self.poly) < 3 or self.hi <= self.lo:
            raise ValueError("a prism needs 3+ polygon points and hi > lo")
        top = self.poly if self.top is None else self.top
        if len(top) != len(self.poly):
            raise ValueError("a prism's top needs as many points as its base")

        def area(poly):
            return sum(poly[k][0] * poly[(k + 1) % len(poly)][1] - poly[(k + 1) % len(poly)][0] * poly[k][1] for k in range(len(poly)))

        a = area(self.poly) if abs(area(self.poly)) > 1e-9 else area(top)
        if abs(a) < 1e-9:
            raise ValueError("a prism needs a base or a top with area")
        if a < 0:  # store counter-clockwise in the (u, v) plane
            self.poly, top = list(reversed(self.poly)), list(reversed(top))
        self.poly = [(float(u), float(v)) for u, v in self.poly]
        self.top = None if self.top is None else [(float(u), float(v)) for u, v in top]

    @property
    def upper(self) -> list[tuple[float, float]]:
        return self.poly if self.top is None else self.top

    def poly_at(self, t: float) -> list[tuple[float, float]]:
        """The cross-section polygon at `t` along the axis."""
        if self.top is None:
            return self.poly
        f = min(1.0, max(0.0, (t - self.lo) / (self.hi - self.lo)))
        return [(b[0] + (q[0] - b[0]) * f, b[1] + (q[1] - b[1]) * f) for b, q in zip(self.poly, self.top)]

    def shifted(self, offset) -> "Prism":
        u, v = PRISM_PLANE[self.axis]
        t = _AXIS_INDEX[self.axis]
        move = lambda poly: [(pu + offset[u], pv + offset[v]) for pu, pv in poly]  # noqa: E731
        return Prism(self.axis, move(self.poly), self.lo + offset[t], self.hi + offset[t], None if self.top is None else move(self.top))

    def mask(self, shape) -> np.ndarray:
        """Voxels whose centre lies inside the prism."""
        u, v = PRISM_PLANE[self.axis]
        t = _AXIS_INDEX[self.axis]
        idx = [np.arange(n) + 0.5 for n in shape]
        cu, cv = np.meshgrid(idx[u], idx[v], indexing="ij")
        m = np.zeros(shape, dtype=bool)
        view = np.transpose(m, (t, u, v))
        if self.top is None:
            along = (idx[t] >= self.lo) & (idx[t] < self.hi)
            view[along] = _inside_polygon(cu, cv, self.poly)
            return m
        for k, tc in enumerate(idx[t]):
            if self.lo <= tc < self.hi:
                view[k] = _inside_polygon(cu, cv, self.poly_at(tc))
        return m


class _Holder:
    """Carries a list of solids through Grid._mapped."""

    def __init__(self, solids):
        self.solids = solids


class Grid:
    """Dense voxel grid, indexed [x, y, z] in glTF axes. `solids` are exact
    prisms meshed as true geometry (world assets only)."""

    def __init__(self, sx: int, sy: int, sz: int):
        if min(sx, sy, sz) <= 0:
            raise ValueError(f"grid size must be positive, got {(sx, sy, sz)}")
        self.a = np.zeros((sx, sy, sz), dtype=np.uint8)
        self.solids: list[Prism] = []

    def prism(self, axis: str, poly, lo, hi, c: int, top=None) -> "Grid":
        """Add an exact prism (see Prism; `top` makes a frustum, pyramid or
        hip roof) and fill its voxels with `c`. Paint its voxels afterwards
        to paint its faces. Do not carve it: its faces are solid geometry."""
        solid = Prism(axis, list(poly), float(lo), float(hi), None if top is None else list(top))
        u, v = PRISM_PLANE[axis]
        t = _AXIS_INDEX[axis]
        pu, pv = [p[0] for p in solid.poly + solid.upper], [p[1] for p in solid.poly + solid.upper]
        if min(pu) < 0 or min(pv) < 0 or solid.lo < 0 or max(pu) > self.shape[u] or max(pv) > self.shape[v] or solid.hi > self.shape[t]:
            raise ValueError(f"prism {axis} {solid.poly} [{solid.lo}, {solid.hi}) leaves the {self.shape} grid")
        mask = solid.mask(self.shape)
        if not mask.any():
            raise ValueError(f"prism {axis} {solid.poly} [{solid.lo}, {solid.hi}) covers no voxel centre; make it thicker")
        self.solids.append(solid)
        return self.where(mask, c)

    # -- transforms that keep prisms. Never copy `a` into a new Grid by hand:
    # the prisms would be lost without an error. --
    def _mapped(self, a: np.ndarray, point) -> "Grid":
        """New grid holding `a`, with every prism mapped by `point`, a
        function from old voxel-corner coordinates to new ones."""
        out = Grid(*a.shape)
        out.a = np.ascontiguousarray(a)
        for solid in self.solids:
            t = _AXIS_INDEX[solid.axis]
            u, v = PRISM_PLANE[solid.axis]

            def at(pu, pv, tv):
                p = [0.0, 0.0, 0.0]
                p[u], p[v], p[t] = pu, pv, tv
                return np.array(point(p), dtype=float)

            e = at(0, 0, 1) - at(0, 0, 0)
            nt = int(np.argmax(np.abs(e)))
            axis = "xyz"[nt]
            nu, nv = PRISM_PLANE[axis]
            lo_pts = [at(pu, pv, solid.lo) for pu, pv in solid.poly]
            hi_pts = [at(pu, pv, solid.hi) for pu, pv in solid.upper]
            lo_t, hi_t = lo_pts[0][nt], hi_pts[0][nt]
            flat = lambda pts: [(float(q[nu]), float(q[nv])) for q in pts]  # noqa: E731
            if lo_t <= hi_t:
                base, top, a, b = flat(lo_pts), flat(hi_pts), lo_t, hi_t
            else:  # the transform flipped the axis: the top becomes the base
                base, top, a, b = flat(hi_pts), flat(lo_pts), hi_t, lo_t
            out.solids.append(Prism(axis, base, a, b, None if solid.top is None else top))
        return out

    def crop(self, x0, y0, z0, x1, y1, z1) -> "Grid":
        """Sub-grid [x0, x1) × [y0, y1) × [z0, z1); prisms shift with it."""
        x0, y0, z0, x1, y1, z1 = (int(c) for c in (x0, y0, z0, x1, y1, z1))
        return self._mapped(self.a[x0:x1, y0:y1, z0:z1].copy(), lambda p: (p[0] - x0, p[1] - y0, p[2] - z0))

    def flip(self, axis: str) -> "Grid":
        """Mirror along 'x' or 'z' (or 'y'); prisms mirror with it."""
        k = _AXIS_INDEX[axis]
        n = self.shape[k]
        a = np.flip(self.a, axis=k).copy()
        return self._mapped(a, lambda p: tuple(n - c if i == k else c for i, c in enumerate(p)))

    def rot_y(self, k: int) -> "Grid":
        """Rotate by k quarter turns about y, as np.rot90(a, k, axes=(2, 0)); prisms turn with it."""
        k %= 4
        sx, _, sz = self.shape
        a = np.rot90(self.a, k, axes=(2, 0)).copy()
        maps = {
            0: lambda p: (p[0], p[1], p[2]),
            1: lambda p: (p[2], p[1], sx - p[0]),
            2: lambda p: (sx - p[0], p[1], sz - p[2]),
            3: lambda p: (sz - p[2], p[1], p[0]),
        }
        return self._mapped(a, maps[k])

    def solid_mask(self) -> np.ndarray:
        """Voxels owned by any prism."""
        m = np.zeros(self.shape, dtype=bool)
        for solid in self.solids:
            m |= solid.mask(self.shape)
        return m

    @property
    def shape(self) -> tuple[int, int, int]:
        return self.a.shape  # type: ignore[return-value]

    def count(self) -> int:
        return int(np.count_nonzero(self.a))

    # -- primitive fills. Boxes are inclusive min / exclusive max, clipped. --
    def box(self, x0, y0, z0, x1, y1, z1, c: int) -> "Grid":
        sx, sy, sz = self.shape
        x0, x1 = max(0, int(x0)), min(sx, int(x1))
        y0, y1 = max(0, int(y0)), min(sy, int(y1))
        z0, z1 = max(0, int(z0)), min(sz, int(z1))
        if x0 < x1 and y0 < y1 and z0 < z1:
            self.a[x0:x1, y0:y1, z0:z1] = c
        return self

    def set(self, x, y, z, c: int) -> "Grid":
        x, y, z = int(x), int(y), int(z)
        sx, sy, sz = self.shape
        if 0 <= x < sx and 0 <= y < sy and 0 <= z < sz:
            self.a[x, y, z] = c
        return self

    def _coords(self):
        sx, sy, sz = self.shape
        return np.meshgrid(np.arange(sx) + 0.5, np.arange(sy) + 0.5, np.arange(sz) + 0.5, indexing="ij")

    def where(self, mask, c: int) -> "Grid":
        """Paint `c` where `mask` is true; `mask` may be any shape that broadcasts to the grid."""
        self.a[np.broadcast_to(mask, self.a.shape)] = c
        return self

    def ellipsoid(self, cx, cy, cz, rx, ry, rz, c: int) -> "Grid":
        x, y, z = self._coords()
        return self.where(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1.0, c)

    def sphere(self, cx, cy, cz, r, c: int) -> "Grid":
        return self.ellipsoid(cx, cy, cz, r, r, r, c)

    def cylinder(self, axis: str, c0, c1, r, lo, hi, c: int, r2=None) -> "Grid":
        """Cylinder along `axis` ('x'|'y'|'z'); (c0, c1) is the centre in the
        other two axes (in x,y,z order), [lo, hi) the extent, r→r2 a taper."""
        x, y, z = self._coords()
        r2 = r if r2 is None else r2
        if axis == "y":
            t, u, v = y, x, z
        elif axis == "x":
            t, u, v = x, y, z
        elif axis == "z":
            t, u, v = z, x, y
        else:
            raise ValueError(f"axis must be x, y or z, got {axis!r}")
        span = max(hi - lo, 1e-6)
        rad = r + (r2 - r) * np.clip((t - lo) / span, 0, 1)
        mask = ((u - c0) ** 2 + (v - c1) ** 2 <= rad**2) & (t >= lo) & (t < hi)
        return self.where(mask, c)

    def line(self, p0, p1, radius: float, c: int) -> "Grid":
        """Capsule from p0 to p1 (voxel coordinates)."""
        x, y, z = self._coords()
        p0, p1 = np.array(p0, float), np.array(p1, float)
        d = p1 - p0
        L2 = float(d @ d) or 1e-9
        t = np.clip(((x - p0[0]) * d[0] + (y - p0[1]) * d[1] + (z - p0[2]) * d[2]) / L2, 0, 1)
        dist2 = (x - (p0[0] + t * d[0])) ** 2 + (y - (p0[1] + t * d[1])) ** 2 + (z - (p0[2] + t * d[2])) ** 2
        return self.where(dist2 <= radius**2, c)

    def layers(self, rows_by_y: list[list[str]], legend: dict[str, int], y0=0, x0=0, z0=0) -> "Grid":
        """Paint ASCII slices. rows_by_y[k] is the slice at y0+k; each row string
        is one z line (first row = lowest z), each char one x cell. '.' and ' ' skip."""
        for k, rows in enumerate(rows_by_y):
            for zi, row in enumerate(rows):
                for xi, ch in enumerate(row):
                    if ch in ". ":
                        continue
                    if ch not in legend:
                        raise ValueError(f"layer char {ch!r} has no legend entry")
                    self.set(x0 + xi, y0 + k, z0 + zi, legend[ch])
        return self

    # -- whole-grid operations --
    def carve(self, other_mask) -> "Grid":
        self.a[np.broadcast_to(other_mask, self.a.shape)] = 0
        return self

    def mirror_x(self) -> "Grid":
        """Copy the left half (x < sx/2) onto the right half."""
        sx = self.shape[0]
        half = sx // 2
        self.a[sx - half :, :, :] = self.a[:half, :, :][::-1, :, :]
        left = [solid for solid in self.solids if not (solid.axis == "x" and solid.hi > sx / 2)]
        self.solids.extend(Grid._mapped(_Holder(left), self.a, lambda p: (sx - p[0], p[1], p[2])).solids)
        return self

    def paste(self, other: "Grid", ox: int, oy: int, oz: int) -> "Grid":
        """Overlay the filled cells of `other` at offset (ox, oy, oz)."""
        sx, sy, sz = other.shape
        for x, y, z in zip(*np.nonzero(other.a)):
            self.set(ox + x, oy + y, oz + z, int(other.a[x, y, z]))
        self.solids.extend(solid.shifted((ox, oy, oz)) for solid in other.solids)
        return self

    def recolor(self, mapping: dict[int, int]) -> "Grid":
        out = self.a.copy()
        for src, dst in mapping.items():
            out[self.a == src] = dst
        self.a[...] = out
        return self

    def speckle(self, seed: int, amount: float = 0.25, spread: int = 1) -> "Grid":
        """Shift a random fraction of voxels ±`spread` shades inside their ramp.
        Gives the hand-painted per-voxel variation of VoxEdit art. Deterministic."""
        rng = random.Random(seed)
        xs, ys, zs = np.nonzero(self.a)
        for x, y, z in zip(xs, ys, zs):
            if rng.random() >= amount:
                continue
            ramp, shade = ramp_of(int(self.a[x, y, z]))
            new = min(RAMP_SHADES - 1, max(0, shade + rng.choice([-spread, spread])))
            if (PALETTE["ramps"][ramp] * RAMP_SHADES + new) != 0:
                self.a[x, y, z] = C(ramp, new)
        return self

    def shade_by_height(self, lo_shade_delta=-1, hi_shade_delta=1) -> "Grid":
        """Darken the bottom and lighten the top of every ramp (cheap AO read)."""
        xs, ys, zs = np.nonzero(self.a)
        if len(ys) == 0:
            return self
        y0, y1 = ys.min(), ys.max()
        span = max(1, y1 - y0)
        for x, y, z in zip(xs, ys, zs):
            t = (y - y0) / span
            delta = round(lo_shade_delta + (hi_shade_delta - lo_shade_delta) * t)
            if delta == 0:
                continue
            ramp, shade = ramp_of(int(self.a[x, y, z]))
            new = min(RAMP_SHADES - 1, max(0, shade + delta))
            if (PALETTE["ramps"][ramp] * RAMP_SHADES + new) != 0:
                self.a[x, y, z] = C(ramp, new)
        return self


@dataclass
class Part:
    """A rigid node. `pivot` is the node origin in this part's grid voxel
    coordinates; `at` places the pivot in the parent's pivot space (voxels)."""

    name: str
    grid: Grid | None = None
    pivot: tuple[float, float, float] = (0.0, 0.0, 0.0)
    at: tuple[float, float, float] = (0.0, 0.0, 0.0)
    # Rest rotation, XYZ euler degrees about glTF axes (leaning chimneys, tilted signs).
    rot: tuple[float, float, float] = (0.0, 0.0, 0.0)
    children: list["Part"] = field(default_factory=list)
    # Avatar parts only: {"name": display name, "rules": {...AvatarPartRules}}.
    meta: dict = field(default_factory=dict)

    def add(self, child: "Part") -> "Part":
        self.children.append(child)
        return child

    def walk(self):
        yield self
        for child in self.children:
            yield from child.walk()


@dataclass
class Socket:
    """Named empty for PFX/attachments, in root pivot space (voxels); `parent`
    names the part it follows. `rot` is XYZ euler degrees."""

    name: str
    at: tuple[float, float, float]
    parent: str | None = None
    rot: tuple[float, float, float] = (0.0, 0.0, 0.0)


def pfx_binding(effect: str, socket: str | None, trigger: str = "idle", *, size: float, aim=None, at: float | None = None, offset=None) -> dict:
    """A PFX binding (contracts/catalog.ts pfxBindingSchema). `size`: nominal
    effect size in model units (RVX effects are drawn at size 1). `aim`: the
    effect's +Y in the socket frame (default up). `at` (clip triggers only):
    seconds into the clip at which a one-shot fires, or from which a loop
    runs to the end of the clip cycle (a blade trail that skips the wind-up). `offset`: the effect's
    origin in the socket frame, model units (default the socket itself)."""
    if size <= 0:
        raise ValueError(f"{effect}: PFX size must be positive")
    if at is not None and not trigger.startswith("clip:"):
        raise ValueError(f"{effect}: `at` is for clip triggers only")
    b = {"effectId": effect, "trigger": trigger, "size": size}
    if socket is not None:
        b["socket"] = socket
    if aim is not None:
        b["aim"] = [float(v) for v in aim]
    if at is not None:
        b["at"] = at
    if offset is not None:
        b["offset"] = [float(v) for v in offset]
    return b


@dataclass
class Clip:
    """Node-hierarchy clip. keys[part][channel] = [(seconds, value), ...];
    channel is 'rot' (XYZ euler degrees), 'loc' (voxels, pivot-relative
    offset) or 'scale'."""

    name: str
    keys: dict[str, dict[str, list[tuple[float, tuple[float, float, float]]]]]
    loop: bool = True


@dataclass
class Asset:
    id: str
    pack: str
    category: str
    name: str
    root: Part
    clips: list[Clip] = field(default_factory=list)
    sockets: list[Socket] = field(default_factory=list)
    pfx: list[dict] = field(default_factory=list)
    route: str = "code"
    # World scale class from contracts/data/scale.json (required for world categories).
    scale: str = ""
    extra_meta: dict = field(default_factory=dict)

    @property
    def is_rig(self) -> bool:
        return self.category in ("avatar", "characters-skins")

    def validate(self) -> None:
        if self.category not in CATEGORIES["categories"]:
            raise ValueError(f"{self.id}: unknown category {self.category!r}")
        if self.pack not in PACKS["packs"]:
            raise ValueError(f"{self.id}: unknown pack {self.pack!r}")
        prefix = f"{self.pack}-{self.category}-"
        if not self.id.startswith(prefix):
            raise ValueError(f"{self.id}: id must start with {prefix!r}")
        names = [p.name for p in self.root.walk()]
        if len(names) != len(set(names)):
            raise ValueError(f"{self.id}: duplicate part names {names}")
        joints = [j["name"] for j in RIG["joints"]]
        lo, hi = PACKS["packs"][self.pack]["clipRange"]
        for clip in self.clips:
            if self.is_rig:
                head = clip.name.split("_", 1)[0]
                if not (head.isdigit() and len(head) == 2 and lo <= int(head) <= hi):
                    raise ValueError(f"{self.id}: avatar clip {clip.name!r} must be NN_Name with NN in {lo}..{hi}")
                targets = joints
            else:
                if clip.name not in CLIPS["propClips"]:
                    raise ValueError(f"{self.id}: clip {clip.name!r} is not in the prop clip vocabulary")
                targets = names
            for key in clip.keys:
                if key not in targets:
                    raise ValueError(f"{self.id}: clip {clip.name!r} keys unknown {'bone' if self.is_rig else 'part'} {key!r}")
        if self.category == "avatar":
            for part in self.root.children:
                slot, _, rest = part.name.partition(" ")
                if slot not in AVATAR_SLOTS or not rest.startswith(f"{self.pack}-") or not rest[len(self.pack) + 1 :].isdigit():
                    raise ValueError(f"{self.id}: avatar part {part.name!r} must be named '<slot> {self.pack}-<n>'")
                if part.grid is None or "name" not in part.meta:
                    raise ValueError(f"{self.id}: avatar part {part.name!r} needs a grid and meta['name']")
        for s in self.sockets:
            if not s.name.startswith("socket-"):
                raise ValueError(f"{self.id}: socket {s.name!r} must start with 'socket-'")


def units_per_voxel(category: str) -> float:
    space = CATEGORIES["categories"][category]["space"]
    return CATEGORIES["unitsPerVoxel"][space]


def turn(seconds: float, axis: str, degrees_per_second: float, fps: int | None = None):
    """Keys for a constant spin over `seconds`. It loops cleanly only when
    degrees_per_second × seconds is a whole number of turns; the validator's
    clips.loop rule reports a looping clip that does not."""
    fps = fps or CLIPS["fps"]
    idx = "xyz".index(axis)
    keys = []
    # One key per ≤90° keeps quaternion interpolation on the intended path.
    steps = max(8, math.ceil(abs(degrees_per_second * seconds) / 90))
    for i in range(steps + 1):
        t = seconds * i / steps
        v = [0.0, 0.0, 0.0]
        v[idx] = degrees_per_second * t
        keys.append((t, tuple(v)))
    return keys


def sway(seconds: float, amp=(0.0, 0.0, 0.0), phase=(0.0, 0.0, 0.0), cycles=(1, 1, 1), base=(0.0, 0.0, 0.0), steps: int = 16):
    """Looping sine keys on three channels (rot degrees or loc voxels):
    value = base + amp · sin(2π · cycles · t / seconds + phase). Each
    `cycles` entry must be a whole number, so the loop closes."""
    for c in cycles:
        if c != int(c) or c < 1:
            raise ValueError(f"sway cycles must be whole numbers ≥ 1, got {cycles}")
    steps = max(steps, 8 * int(max(cycles)))
    keys = []
    for i in range(steps + 1):
        f = i / steps
        keys.append((seconds * f, tuple(base[k] + amp[k] * math.sin(2 * math.pi * cycles[k] * f + phase[k]) for k in range(3))))
    keys[-1] = (seconds, keys[0][1])
    return keys


def bob(seconds: float, axis: str, amplitude: float, phase: float = 0.0, steps: int = 8):
    """Sine keys for a looping bob/sway on one axis."""
    idx = "xyz".index(axis)
    keys = []
    for i in range(steps + 1):
        t = seconds * i / steps
        v = [0.0, 0.0, 0.0]
        v[idx] = amplitude * math.sin(2 * math.pi * (i / steps) + phase)
        keys.append((t, tuple(v)))
    return keys


def bounds_pivot(grid: Grid) -> tuple[float, float, float]:
    """Bottom-centre of the filled voxels (whole voxels), so the model sits
    on y=0 and is centred on x/z even when the grid has margins."""
    xs, ys, zs = np.nonzero(grid.a)
    if len(xs) == 0:
        raise ValueError("bounds_pivot of an empty grid")
    return (float(round((xs.min() + xs.max() + 1) / 2)), float(ys.min()), float(round((zs.min() + zs.max() + 1) / 2)))


def base_pivot(grid: Grid) -> tuple[float, float, float]:
    """Bottom-centre pivot: world assets sit on y=0, centred on x/z."""
    sx, _sy, sz = grid.shape
    return (sx / 2, 0.0, sz / 2)


def brickify(grid: Grid, ramp: str, course: int = 3, length: int = 4, mortar_delta: int = -2, seed: int = 0) -> Grid:
    """Paint running-bond masonry on every voxel of `ramp`: mortar lines one
    shade band darker, bricks jittered ±1 shade. Deterministic."""
    rng = random.Random(seed)
    rid = PALETTE["ramps"][ramp]
    xs, ys, zs = np.nonzero(grid.a)
    jitter: dict[tuple[int, int], int] = {}
    for x, y, z in zip(xs, ys, zs):
        idx = int(grid.a[x, y, z])
        if idx // RAMP_SHADES != rid:
            continue
        shade = idx % RAMP_SHADES
        row = y // course
        offset = (row % 2) * (length // 2)
        along = x + z + offset
        if y % course == 0 or along % length == 0:
            new = shade + mortar_delta
        else:
            key = (row, along // length)
            if key not in jitter:
                jitter[key] = rng.choice([-1, 0, 0, 1])
            new = shade + jitter[key]
        new = min(RAMP_SHADES - 1, max(1 if rid == 0 else 0, new))
        grid.a[x, y, z] = rid * RAMP_SHADES + new
    return grid
