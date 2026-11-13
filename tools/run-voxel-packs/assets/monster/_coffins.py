"""Helpers for person-size monster props (coffins, bodies, chains).

Coffins here are sized for the 36-voxel person: about 16 wide and 44-46
long, with 1-voxel plank seams, a plinth moulding, a top rim, cloth
lining, a pillow, brass handles and a raised lid panel. The older
`_kit.coffin_parts` stays unchanged for the assets that still use it.
"""
from __future__ import annotations

import numpy as np

from _kit import C, Grid, xyz


# ---------------------------------------------------------------- 2D masks
def erode(m: np.ndarray, n: int = 1) -> np.ndarray:
    """4-neighbour erosion of a 2D mask, `n` times (edges count as empty)."""
    for _ in range(n):
        e = m.copy()
        e[1:, :] &= m[:-1, :]
        e[:-1, :] &= m[1:, :]
        e[:, 1:] &= m[:, :-1]
        e[:, :-1] &= m[:, 1:]
        e[0, :] = e[-1, :] = False
        e[:, 0] = e[:, -1] = False
        m = e
    return m


def hexmask(w: int, L: int, sh: int | None = None, tf: float = 3.0, th: float = 2.5) -> np.ndarray:
    """Coffin outline [w, L]: narrow foot at index 0, widest at the shoulder
    `sh` (default 72% of L), head end at L-1."""
    sh = int(round(L * 0.72)) if sh is None else sh
    u = np.arange(w)[:, None] + 0.5 - w / 2
    v = np.arange(L)[None, :] + 0.5
    half = np.where(v < sh, w / 2 - tf * (1 - v / sh), w / 2 - th * (v - sh) / (L - sh))
    return np.abs(u) <= half + 1e-6


def _layer(g: Grid, y: int, mask: np.ndarray, c: int) -> None:
    g.a[:, y, :][mask] = c


# ---------------------------------------------------------------- coffin
def coffin_c(w: int = 16, L: int = 46, depth: int = 11, lid_h: int = 3, wood: str = "darkwood",
             lining: str = "blood", trim: str = "gold", handles: int = 3, cross: bool = True, tf: float = 3.0):
    """(box, lid, outline) for a coffin lying along +Z (head at +Z), open top.

    box: [w, depth, L] with a 2-voxel plinth, plank walls (1 thick), a
    1-voxel cloth lining with tufted buttons, a pillow and a top rim.
    lid: [w, lid_h, L]: dark lip, body, raised plank panel with a cross.
    Both share the outline; the plinth, rim and lid overhang the walls by 1.
    """
    sh = int(round(L * 0.72))
    outer = hexmask(w, L, sh, tf)
    body = erode(outer, 1)
    inner = erode(body, 1)
    cav = erode(body, 2)
    X, Z = np.meshgrid(np.arange(w), np.arange(L), indexing="ij")
    box = Grid(w, depth, L)
    _layer(box, 0, outer, C(wood, 1))
    _layer(box, 1, outer, C(wood, 2))
    for yy in range(2, depth - 1):
        _layer(box, yy, body, C(wood, 2 if (yy - 2) % 3 == 2 else 3))  # plank courses
    # board joints where the outline bends (foot, shoulder, head)
    for zj in (0, sh - 1, sh, L - 1):
        for yy in range(2, depth - 1):
            box.a[:, yy, zj][body[:, zj]] = C(wood, 2)
    _layer(box, depth - 1, outer, C(wood, 4))
    # cavity: lining floor with tufted buttons, lining walls, pillow
    _layer(box, 2, inner, C(lining, 3))
    tuft = inner & ((X + Z) % 4 == 0) & ((X - Z) % 4 == 0)
    _layer(box, 2, tuft, C(lining, 1))
    for yy in range(3, depth):
        box.a[:, yy, :][cav] = 0
    for yy in range(3, depth - 1):
        _layer(box, yy, inner & ~cav, C(lining, 2))
    _layer(box, depth - 2, inner & ~cav, C(lining, 4))  # piped edge of the lining
    pil = cav & (Z >= L - 8) & (Z <= L - 3)
    _layer(box, 3, pil, C(lining, 5))
    _layer(box, 4, pil & erode(pil, 1), C(lining, 6))
    _layer(box, 4, pil & erode(pil, 1) & (np.abs(X + 0.5 - w / 2) < 1.5), C(lining, 5))  # head dent
    # brass bar handles on both long sides
    hy = 2 + (depth - 3) // 2
    zs = np.linspace(L * 0.22, L * 0.8, handles).round().astype(int)
    for hz in zs:
        for side in (0, 1):
            col = np.nonzero(body[:, hz])[0]
            if len(col) == 0:
                continue
            x_out = col.min() - 1 if side == 0 else col.max() + 1
            box.set(x_out, hy, hz - 2, C(trim, 3)).set(x_out, hy, hz + 2, C(trim, 3))
            box.box(x_out, hy - 1, hz - 2, x_out + 1, hy, hz + 3, C(trim, 5))
            box.set(x_out, hy - 1, hz - 2, C(trim, 4)).set(x_out, hy - 1, hz + 2, C(trim, 4))
    # rim corner caps at foot, shoulder and head corners
    rim = outer & ~erode(outer, 1)
    for zc in (0, sh, L - 1):
        _layer(box, depth - 1, rim & (Z == zc) & ((X == np.nonzero(outer[:, zc])[0].min()) | (X == np.nonzero(outer[:, zc])[0].max())), C(trim, 5))

    lid = Grid(w, lid_h, L)
    _layer(lid, 0, outer, C(wood, 2))
    _layer(lid, 0, cav, C(lining, 3))  # satin lining under the lid
    _layer(lid, 0, cav & ((X + Z) % 4 == 2) & ((X - Z) % 4 == 2), C(lining, 1))
    _layer(lid, 0, cav & ~erode(cav, 1), C(lining, 4))
    for yy in range(1, lid_h):
        m = erode(outer, min(yy, 2))
        _layer(lid, yy, m, C(wood, 3))
    top = lid_h - 1
    panel = erode(outer, 2) if lid_h >= 3 else erode(outer, 1)
    _layer(lid, top, panel, C(wood, 4))
    _layer(lid, top, panel & ((X - w // 2) % 4 == 0), C(wood, 3))  # board seams along the lid
    _layer(lid, top, panel & ~erode(panel, 1), C(wood, 5))  # bevel highlight
    if lid_h >= 3:
        _layer(lid, 1, outer & ~erode(outer, 1) & ((Z % 6) == 3), C(wood, 1))  # lip notches
    for zc in (1, sh, L - 2):  # corner studs on the lip
        cols = np.nonzero(outer[:, zc])[0]
        lid.set(cols.min(), 0, zc, C(trim, 4)).set(cols.max(), 0, zc, C(trim, 4))
    if cross:
        cx = w // 2
        lid.box(cx - 1, top, int(L * 0.3), cx + 1, top + 1, L - 5, C(trim, 5))
        lid.box(cx - 4, top, sh - 1, cx + 4, top + 1, sh + 1, C(trim, 5))
        lid.set(cx - 1, top, L - 6, C(trim, 6)).set(cx, top, sh, C(trim, 6))
    return box, lid, outer


def stand_up(g: Grid) -> Grid:
    """Turn a lying grid [x, y=up, z=head] into a standing one
    [x, y=head up, z]: the old top faces -Z (z = 0), the old bottom +Z."""
    a = np.transpose(g.a, (0, 2, 1))[:, :, ::-1]
    out = Grid(*a.shape)
    out.a = np.ascontiguousarray(a)
    return out


# ---------------------------------------------------------------- chains
def chain_path(g: Grid, pts, normal: tuple[int, int, int], ring: int | None = None, link: int | None = None, phase: int = 0) -> Grid:
    """Heavy chain through axis-aligned corner points. Links alternate: a
    3×3 ring flat on the surface (hole in the middle), then an edge-on link
    raised one voxel along `normal`. `normal` is the outward axis vector."""
    ring = ring or C("steel", 5)
    link = link or C("steel", 3)
    nrm = np.array(normal, int)
    i = phase
    for p0, p1 in zip(pts[:-1], pts[1:]):
        p0, p1 = np.array(p0, int), np.array(p1, int)
        d = p1 - p0
        n = int(np.abs(d).max())
        step = np.sign(d)
        tan = np.cross(step, nrm)
        for k in range(n):
            p = p0 + step * k
            m = i % 4
            if m in (0, 2):
                g.set(*p, ring)
                g.set(*(p + tan), ring)
                g.set(*(p - tan), ring)
            elif m == 1:
                g.set(*(p + tan), C("steel", 4))
                g.set(*(p - tan), C("steel", 4))
            else:
                g.set(*p, link)
                g.set(*(p + nrm), link)
            i += 1
    return g


def padlock(g: Grid, x: int, y: int, z: int, body: str = "gold") -> Grid:
    """5-wide, 8-tall padlock facing -Z: body corner at (x, y, z), 2 deep."""
    g.box(x, y, z, x + 5, y + 4, z + 2, C(body, 3))
    g.box(x, y + 3, z, x + 5, y + 4, z + 1, C(body, 5))
    g.box(x, y, z, x + 5, y + 1, z + 1, C(body, 2))
    g.set(x + 2, y + 1, z, C("iron", 0)).set(x + 2, y + 2, z, C("iron", 1))  # keyhole
    g.box(x + 1, y + 4, z, x + 2, y + 7, z + 1, C("steel", 5)).box(x + 3, y + 4, z, x + 4, y + 7, z + 1, C("steel", 5))
    g.box(x + 1, y + 7, z, x + 4, y + 8, z + 1, C("steel", 6))  # shackle
    return g


# ---------------------------------------------------------------- bodies
def skeleton(g: Grid, cx: int, y0: int, z0: int, pose: str = "side", wrap: float = 0.0, seed: int = 0, bone: str = "bone") -> Grid:
    """A person-proportioned skeleton (34 tall), standing, facing -Z.
    `cx` is the centre line (between columns cx-1 and cx), feet at y0,
    front at z0 (the body is 4 deep). pose: "side" (arms down), "crossed"
    (forearms crossed on the chest), "bars" (hands raised to shoulder
    height to grip bars). `wrap` > 0 adds mummy bandages over that share."""
    B, B2, B3 = C(bone, 6), C(bone, 5), C(bone, 4)
    D = C("gray", 1)
    zb = z0 + 2  # spine depth
    # skull 6 wide, 6 tall, 5 deep
    g.box(cx - 3, y0 + 28, z0, cx + 3, y0 + 34, z0 + 5, B)
    g.box(cx - 2, y0 + 34, z0 + 1, cx + 2, y0 + 35, z0 + 4, B)
    g.box(cx - 3, y0 + 28, z0, cx + 3, y0 + 29, z0 + 1, B2)
    g.box(cx - 3, y0 + 30, z0, cx - 1, y0 + 32, z0 + 1, D)  # eye sockets
    g.box(cx + 1, y0 + 30, z0, cx + 3, y0 + 32, z0 + 1, D)
    g.set(cx - 1, y0 + 29, z0, D).set(cx, y0 + 29, z0, C("gray", 2))  # nose
    g.box(cx - 2, y0 + 26, z0, cx + 2, y0 + 28, z0 + 4, B2)  # jaw
    for tx in range(cx - 2, cx + 2):
        g.set(tx, y0 + 27, z0, B if tx % 2 else D)  # teeth
    # neck and spine
    g.box(cx - 1, y0 + 12, zb, cx + 1, y0 + 26, zb + 2, B3)
    for yy in range(y0 + 13, y0 + 26, 2):
        g.box(cx - 1, yy, zb, cx + 1, yy + 1, zb + 2, B2)
    # collar bones and shoulders
    g.box(cx - 5, y0 + 24, z0 + 1, cx + 5, y0 + 25, z0 + 3, B)
    g.box(cx - 6, y0 + 23, z0 + 1, cx - 4, y0 + 25, z0 + 3, B2).box(cx + 4, y0 + 23, z0 + 1, cx + 6, y0 + 25, z0 + 3, B2)
    # ribcage: ribs every 2 rows, curving back; sternum
    for k, yy in enumerate(range(y0 + 16, y0 + 24, 2)):
        hw = 4 if k > 0 else 3
        g.box(cx - hw, yy, z0 + 1, cx + hw, yy + 1, z0 + 2, B)
        g.box(cx - hw, yy, z0 + 2, cx - hw + 1, yy + 1, zb + 1, B2).box(cx + hw - 1, yy, z0 + 2, cx + hw, yy + 1, zb + 1, B2)
    g.box(cx - 1, y0 + 17, z0, cx + 1, y0 + 24, z0 + 1, B2)
    # pelvis
    g.box(cx - 4, y0 + 11, z0 + 1, cx + 4, y0 + 14, zb + 1, B)
    g.box(cx - 2, y0 + 11, z0 + 1, cx + 2, y0 + 13, z0 + 2, D)
    g.box(cx - 1, y0 + 11, z0 + 1, cx + 1, y0 + 12, zb + 1, 0)
    # legs: femur, knee, shin, foot
    for s in (-1, 1):
        lx = cx + (2 if s > 0 else -3)
        g.box(lx, y0 + 6, z0 + 1, lx + 1, y0 + 11, z0 + 3, B)
        g.box(lx - (0 if s > 0 else 0), y0 + 5, z0, lx + 1, y0 + 7, z0 + 3, B2)  # knee
        g.box(lx, y0 + 1, z0 + 1, lx + 1, y0 + 5, z0 + 3, B)
        g.box(lx - 1, y0, z0 - 1, lx + 2, y0 + 1, z0 + 3, B2)  # foot
        g.set(lx, y0, z0 - 1, B)
    # arms
    for s in (-1, 1):
        ax = cx + 5 if s > 0 else cx - 6
        if pose == "side":
            g.box(ax, y0 + 16, z0 + 1, ax + 1, y0 + 23, z0 + 3, B)  # humerus
            g.box(ax, y0 + 15, z0 + 1, ax + 1, y0 + 17, z0 + 3, B2)  # elbow
            g.box(ax, y0 + 10, z0 + 1, ax + 1, y0 + 15, z0 + 3, B)  # forearm
            g.box(ax, y0 + 7, z0 + 1, ax + 1, y0 + 10, z0 + 2, B2)  # hand
            g.set(ax, y0 + 7, z0 + 2, B)
        elif pose == "crossed":
            g.box(ax, y0 + 17, z0 + 1, ax + 1, y0 + 23, z0 + 3, B)
            g.box(ax, y0 + 16, z0, ax + 1, y0 + 18, z0 + 2, B2)
            ex = ax
            tx = cx + 2 if s < 0 else cx - 3  # hand on the opposite shoulder
            ty = y0 + 20 if s < 0 else y0 + 19
            g.line((ex + 0.5, y0 + 16.5, z0 + 0.5), (tx + 0.5, ty + 0.5, z0 - 0.5), 0.55, B)
            g.box(tx - 1, ty, z0 - 1, tx + 2, ty + 2, z0, B2)
        elif pose == "bars":
            g.box(ax, y0 + 17, z0 + 1, ax + 1, y0 + 23, z0 + 3, B)
            g.box(ax + s, y0 + 16, z0, ax + s + 1, y0 + 18, z0 + 2, B2)
            g.box(ax + s, y0 + 18, z0 - 1, ax + s + 1, y0 + 25, z0, B)  # forearm up
            g.box(ax + s, y0 + 25, z0 - 2, ax + s + 1, y0 + 28, z0 - 1, B2)  # hand
    if wrap > 0:
        rng = np.random.default_rng(seed)
        x, y, z = xyz(g)
        near = np.zeros(g.a.shape, bool)
        near[max(cx - 7, 0):cx + 7, y0:y0 + 35, max(z0 - 2, 0):z0 + 5] = True
        bones = near & np.isin(g.a, [B, B2, B3])
        band = ((y + x // 2) % 3 == 0)
        pick = rng.random(g.a.shape) < wrap
        g.a[bones & pick & band] = C("sand", 5)
        g.a[bones & pick & ~band] = C("sand", 4)
    return g


def mummy(g: Grid, cx: int, y0: int, z0: int, seed: int = 0) -> Grid:
    """A wrapped mummy (35 tall), arms crossed, facing -Z: a full body of
    diagonal bandage courses with loose strips, dark eye slits and a few
    bones showing through. Same frame as `skeleton`."""
    S5, S4, S3, S6 = C("sand", 5), C("sand", 4), C("sand", 3), C("sand", 6)
    x, y, z = xyz(g)
    m = np.zeros(g.a.shape, bool)

    def blk(x0, y_0, z_0, x1, y_1, z_1):
        m[max(x0, 0):x1, max(y_0, 0):y_1, max(z_0, 0):z_1] = True

    blk(cx - 3, y0 + 27, z0, cx + 3, y0 + 34, z0 + 5)  # head
    blk(cx - 2, y0 + 34, z0 + 1, cx + 2, y0 + 35, z0 + 4)
    blk(cx - 1, y0 + 25, z0 + 1, cx + 1, y0 + 27, z0 + 4)  # neck
    blk(cx - 5, y0 + 13, z0 + 1, cx + 5, y0 + 25, z0 + 5)  # torso
    blk(cx - 4, y0 + 11, z0 + 1, cx + 4, y0 + 13, z0 + 5)  # hips
    for s in (-1, 1):
        lx = cx + (1 if s > 0 else -4)
        blk(lx, y0 + 1, z0 + 1, lx + 3, y0 + 11, z0 + 4)  # legs
        blk(lx, y0, z0 - 1, lx + 3, y0 + 1, z0 + 4)  # feet
    blk(cx - 5, y0 + 17, z0, cx + 5, y0 + 20, z0 + 1)  # crossed forearms
    g.a[m] = S5
    g.a[m & ((y + x + z) % 4 == 0)] = S4  # diagonal bandage courses
    g.a[m & ((y - x) % 7 == 0)] = S3
    g.a[m & ((y + x) % 5 == 2) & (z == z0)] = S6
    g.box(cx - 3, y0 + 30, z0, cx - 1, y0 + 31, z0 + 1, C("gray", 1))  # eye slits
    g.box(cx + 1, y0 + 30, z0, cx + 3, y0 + 31, z0 + 1, C("gray", 1))
    g.set(cx - 2, y0 + 30, z0, C("ember", 6)).set(cx + 1, y0 + 30, z0, C("ember", 6))  # glowing pupils
    g.box(cx - 5, y0 + 17, z0, cx + 5, y0 + 18, z0 + 1, S3)  # arm seam
    g.box(cx - 5, y0 + 16, z0, cx - 3, y0 + 18, z0 + 1, C("bone", 6))  # finger bones through the wraps
    g.box(cx - 2, y0 + 22, z0 + 1, cx + 2, y0 + 23, z0 + 2, C("gold", 5))  # amulet cord
    g.box(cx - 1, y0 + 20, z0, cx + 1, y0 + 22, z0 + 1, C("gold", 6))
    rng = np.random.default_rng(seed)
    for _ in range(5):  # loose strips hanging from the arms and hips
        sx = int(rng.integers(cx - 5, cx + 5))
        sy = int(rng.integers(y0 + 8, y0 + 18))
        g.box(sx, sy - int(rng.integers(2, 5)), z0 - 1, sx + 1, sy, z0, S4)
    return g


def moss_on(g: Grid, seed: int, amount: float, mask: np.ndarray, ramp: str = "moss", shades=(2, 3, 4)) -> Grid:
    """Moss on upward-facing voxels inside `mask` only (plus short drips)."""
    from _kit import exposed

    rng = np.random.default_rng(seed)
    mask = np.broadcast_to(mask, g.a.shape)
    top = exposed(g, 1, 1) & mask & (rng.random(g.a.shape) < amount)
    drip = np.zeros_like(top)
    drip[:, :-1, :] = top[:, 1:, :] & (rng.random(g.a.shape)[:, :-1, :] < 0.45)
    m = (top | drip) & (g.a != 0)
    cols = np.array([C(ramp, s) for s in shades], dtype=np.uint8)
    g.a[m] = cols[rng.integers(0, len(cols), size=int(m.sum()))]
    return g
