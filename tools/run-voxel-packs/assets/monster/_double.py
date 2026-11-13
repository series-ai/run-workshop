"""Recovered monster models for the double-world expansion.

The builders use the shared voxel kit, native unit voxels, painted surface
detail, and a small set of reused haunted effects.
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnshapes as S
from _kit import C, Clip, Grid, Part, Socket, keys, pfx, single, world
from _life import chunk, claw, eyes, front, limb, octo, plan
from _pn import assemble, coords, last
from _vehicles import wheel as vehicle_wheel
from pnkit import box, window, lancet, door


def _box(g: Grid, x0, y0, z0, x1, y1, z1, ramp: str, shade: int):
    return box(g, x0, y0, z0, x1, y1, z1, ramp, shade)


def _stone(g: Grid, bounds, shade=4, seed=0, block=(7, 4), ramp="gray"):
    m = _box(g, *bounds, ramp, shade)
    P.stone(g, m, ramp, shade, block=block, cracks=0.06, seed=seed)
    return m


def _wood(g: Grid, bounds, shade=5, seed=0, width=4, ramp="wood"):
    m = _box(g, *bounds, ramp, shade)
    P.planks(g, m, ramp, shade, width=width, across="y", nails=True, seed=seed)
    P.flat(g, m & (((coords(g)[1].astype(int)) % 5) == 0), ramp, max(1, shade - 2))
    return m


def _metal(g: Grid, bounds, shade=4, seed=0):
    m = _box(g, *bounds, "gray", shade)
    P.plates(g, m, "gray", shade, size=(6, 5), seed=seed)
    return m


def _base(g: Grid, cx: float, cz: float, hx: float, hz: float, h=5, ramp="stone"):
    m = _stone(g, (cx - hx, 0, cz - hz, cx + hx, h, cz + hz), 5, 1, (8, 4), ramp)
    _box(g, cx - hx + 2, h, cz - hz + 2, cx + hx - 2, h + 2, cz + hz - 2, "moss", 4)
    return m


def _asset(slug, category, name, g, clips=(), sockets=(), effects=()):
    return single(slug, category, name, g, clips=list(clips), sockets=list(sockets), pfx=list(effects))


def _assembled(slug, category, name, grids, joints, clips=(), sockets=(), effects=()):
    root = assemble(grids, joints)
    return world(slug, category, name, root, clips=list(clips), sockets=list(sockets), pfx=list(effects))


def _garlic_wreath_post():
    slug = "garlic-wreath-post"
    g = Grid(30, 36, 24)
    X, Y, Z = coords(g)
    _base(g, 15, 12, 13, 10, 4, "stone")
    _wood(g, (12, 4, 10, 18, 29, 16), 5, 2, width=4, ramp="darkwood")
    _box(g, 7, 25, 9, 23, 32, 11, "purple", 4)
    P.outline(g, (g.a > 0) & (Y >= 25) & (Y < 32) & (Z >= 9) & (Z < 11), "purple", 2, normal="z")
    # Seven large bulbs make a clean wreath silhouette around the post.
    bulbs = [(9, 27), (11, 31), (15, 33), (19, 31), (21, 27), (19, 23), (11, 23)]
    for i, (cx, cy) in enumerate(bulbs):
        g.sphere(cx, cy, 8, 2.4, C("bone", 6))
        P.flat(g, (g.a > 0) & (np.abs(X - cx) < 1.2) & (np.abs(Y - cy) < 1.2) & (Z <= 7), "bone", 4)
        _box(g, cx - 0.5, cy + 1, 7, cx + 0.5, cy + 3, 9, "moss", 5)
        if i in (1, 4):
            _box(g, cx - 2, cy - 1, 7, cx - 1, cy + 1, 9, "moss", 5)
    _box(g, 10, 16, 8, 20, 19, 11, "gold", 4)
    _box(g, 12, 17, 11, 18, 18, 12, "toxic", 5)
    return _asset(slug, "props", "Garlic Wreath Post", g,
                  sockets=[Socket("socket-ward", at=(0, 25, -4))],
                  effects=[pfx("rvx-monster-spore-glow", "socket-ward", "idle", size=18)])


def _new_animated(slug):
    specs = {
        "lab-generator": ((32, 42, 32), "Lab Generator"),
        "music-box": ((24, 30, 24), "Music Box"),
        "rising-grave": ((32, 42, 28), "Rising Grave"),
        "pendulum-blade": ((38, 78, 30), "Pendulum Blade"),
        "ouija-table": ((38, 30, 32), "Ouija Table"),
        "swinging-lantern": ((32, 58, 30), "Swinging Lantern"),
        "bat-roost": ((34, 58, 28), "Bat Roost"),
        "haunted-portrait": ((42, 48, 22), "Haunted Portrait"),
        "jack-in-the-box": ((32, 38, 30), "Jack in the Box"),
        "blood-fountain": ((38, 42, 36), "Blood Fountain"),
    }
    if slug not in specs:
        raise KeyError(slug)
    (sx, sy, sz), name = specs[slug]
    cx, cz = sx / 2, sz / 2
    base, action = Grid(sx, sy, sz), Grid(sx, sy, sz)
    X, Y, Z = coords(base)
    pivot = (cx, 0, cz)
    grids = {"base": base, "action": action}
    joints = [("base", None, pivot)]
    clips = []
    sockets = []
    effects = []

    if slug == "lab-generator":
        _base(base, cx, cz, 14, 13, 6)
        _metal(base, (6, 6, 6, 10, 31, 10), 4, 1)
        _metal(base, (22, 6, 6, 26, 31, 10), 4, 2)
        _metal(base, (6, 6, 22, 10, 31, 26), 4, 3)
        _metal(base, (22, 6, 22, 26, 31, 26), 4, 4)
        S.disc(base, "y", 16, 16, 6, 7, 28, "teal", 4, n=10)
        for yy in (10, 15, 20, 25):
            S.disc(base, "y", 16, 16, 7, yy, yy + 2, "gold", 5, n=10)
        _box(base, 10, 8, 4, 22, 17, 7, "purple", 4)
        S.disc(base, "z", 14, 13, 2.4, 3, 4, "bone", 6, n=8)
        _box(base, 14, 12, 2, 15, 15, 3, "iron", 2)
        for xx in (18, 21):
            _box(base, xx, 10, 3, xx + 1, 12, 4, "toxic", 6)
        for xx in (5, 27):
            base.line((xx, 8, 17), (xx, 23, 17), 1.5, C("gold", 4))
            base.line((xx, 23, 17), (16, 23, 17), 1.5, C("gold", 4))
        _metal(base, (8, 28, 8, 24, 32, 24), 5, 5)
        S.disc(action, "y", cx, cz, 10, 30, 33, "gold", 4, n=8)
        _box(action, 11, 32, 11, 21, 39, 21, "toxic", 5)
        _box(action, 13, 38, 13, 19, 40, 19, "purple", 4)
        joints.append(("action", "base", (cx, 30, cz)))
        spin = Clip("spin", {"action": {"rot": [(0.0, (0, 0, 0)), (1.2, (0, 360, 0))]}})
        active = Clip("active", {"action": {"loc": keys((0, (0, 0, 0)), (0.25, (0, 1, 0)), (0.5, (0, 0, 0)), (0.75, (0, -1, 0)), (1.0, (0, 0, 0)))}})
        clips = [spin, active]
        sockets = [Socket("socket-core", at=(0, 28, 0), parent="base")]
        effects = [pfx("rvx-monster-witch-brew", "socket-core", "idle", size=20)]

    elif slug == "music-box":
        _base(base, cx, cz, 10, 10, 4, "stone")
        _wood(base, (4, 4, 5, 20, 15, 19), 5, 1, width=3, ramp="darkwood")
        _box(base, 5, 13, 5, 19, 16, 19, "gold", 5)
        _box(base, 7, 15, 7, 17, 16, 17, "purple", 2)
        for xx in (5, 17):
            _box(base, xx, 14, 17, xx + 2, 19, 20, "gold", 5)
        _box(action, 5, 18, 4, 19, 21, 20, "purple", 5)
        P.planks(action, action.a > 0, "purple", 5, width=4, across="x", nails=False, seed=2)
        _box(action, 9, 19, 7, 15, 22, 17, "gold", 5)
        # A raised music note and a winding key make the object read as a music box.
        action.sphere(12, 23, 12, 2, C("gold", 6))
        _box(action, 13, 24, 11, 14, 29, 13, "gold", 6)
        action.prism("z", [(13, 27), (17, 29), (16, 26), (13, 25)], 11, 13, C("gold", 6))
        _box(base, 20, 8, 11, 22, 10, 13, "gold", 5)
        _box(base, 21, 7, 9, 23, 8, 15, "gold", 5)
        joints.append(("action", "base", (12, 18, 19)))
        clips = [Clip("open", {"action": {"rot": keys((0, (0, 0, 0)), (0.5, (68, 0, 0)), (0.8, (68, 0, 0)))}}, loop=False),
                 Clip("close", {"action": {"rot": keys((0, (68, 0, 0)), (0.5, (28, 0, 0)), (0.9, (0, 0, 0)))}}, loop=False),
                 Clip("active", {"action": {"rot": keys((0, (68, 0, 0)), (0.25, (72, 0, 0)), (0.5, (68, 0, 0)), (0.75, (64, 0, 0)), (1, (68, 0, 0)))}})]
        sockets = [Socket("socket-tune", at=(0, 20, -1), parent="base")]
        effects = [pfx("rvx-monster-ghost-wisps", "socket-tune", "clip:active", size=14, at=0.2)]

    elif slug == "rising-grave":
        _base(base, cx, cz, 14, 12, 5, "stone")
        from _double_nature import rock
        _box(base, 9, 5, 9, 23, 6, 23, "purple", 1)
        for xx in (6, 23):
            _stone(base, (xx, 5, 7, xx + 3, 10, 25), 4, 1)
        _stone(base, (6, 5, 22, 26, 9, 25), 4, 2)
        for xx, zz in ((7, 9), (25, 16), (9, 24)):
            rock(base, xx, zz, 3, 2, 5, 5, xx, "moss")
        S.tombstone(action, 16, 9, w=18, h=22, t=4, y0=11, ramp="stone", base=5, glyph="cross")
        P.flat(action, (action.a > 0) & (Z == 7) & (Y > 20) & (Y < 28) & (np.abs(X - cx) < 1.2), "bone", 6)
        _box(action, 14, 24, 7, 18, 26, 8, "purple", 5)
        joints.append(("action", "base", (cx, 12, 15)))
        clips = [Clip("active", {"action": {"loc": keys((0, (0, 0, 0)), (0.35, (0, 10, 0)), (0.6, (0, 13, 0)), (0.9, (0, 10, 0)), (1.2, (0, 0, 0)))}}),
                 Clip("idle", {"action": {"loc": keys((0, (0, 0, 0)), (1.2, (0, 0.7, 0)), (2.4, (0, 0, 0)))}})]
        sockets = [Socket("socket-grave", at=(0, 8, -8), parent="base")]
        effects = [pfx("rvx-monster-grave-mist", "socket-grave", "clip:active", size=26, at=0.38)]

    elif slug == "pendulum-blade":
        _stone(base, (4, 0, 6, 34, 6, 24), 4, 1)
        for x in (5, 29):
            _wood(base, (x, 5, 9, x + 4, 72, 15), 6, x, width=5, ramp="wood")
        _wood(base, (4, 68, 8, 34, 74, 16), 6, 3, width=4, ramp="wood")
        _metal(action, (17, 20, 11, 21, 70, 15), 5, 8)
        S.disc(base, "z", 19, 69, 5, 8, 17, "gold", 5, n=8)
        g = action
        g.prism("z", [(9, 24), (14, 21), (19, 20), (24, 21), (29, 24), (26, 15), (22, 10), (19, 8), (16, 10), (12, 15)], 9, 17, C("gray", 6))
        P.flat(g, last(g), "bone", 6)
        joints.append(("action", "base", (19, 67, 13)))
        swing = Clip("active", {"action": {"rot": keys((0, (0, 0, 0)), (0.5, (42, 0, 0)), (1.0, (-42, 0, 0)), (1.5, (0, 0, 0)))}})
        hit = Clip("attack", {"action": {"rot": keys((0, (0, 0, 0)), (0.25, (0, 0, 26)), (0.5, (0, 0, -26)), (0.75, (0, 0, 0)))}}, loop=False)
        clips = [swing, hit]
        sockets = [Socket("socket-blade", at=(0, 20, -1), parent="action")]
        effects = [pfx("rvx-monster-blood-splat", "socket-blade", "clip:attack", size=24, at=0.45)]

    elif slug == "ouija-table":
        _base(base, cx, cz, 17, 13, 4, "stone")
        for xx in (7, 27):
            for zz in (7, 23):
                _wood(base, (xx, 4, zz, xx + 4, 18, zz + 4), 5, xx, width=4, ramp="darkwood")
        _wood(base, (5, 18, 5, 33, 21, 27), 6, 5, width=4, ramp="wood")
        _box(base, 8, 20, 7, 30, 21, 25, "purple", 3)
        P.flat(base, (base.a > 0) & (Y == 20) & (Z < 26) & (X > 7) & (X < 31), "purple", 4)
        from pnglyph import text
        text(base,"top",21,11,8,"ABC","bone",6,gap=1)
        text(base,"top",21,11,16,"DEF","bone",6,gap=1)
        # The four strips form an open pointer. Three feet touch the board.
        outer=[(14,21),(17,14),(21,14),(24,21)]
        inner=[(17,20),(18,17),(20,17),(21,20)]
        for i,a in enumerate(outer):
            action.prism("y",[a,outer[(i+1)%4],inner[(i+1)%4],inner[i]],22,24,C("gold",5))
        for xx,zz in ((15,20),(19,14),(23,20)):
            _box(action,xx,21,zz,xx+1,22,zz+1,"gold",4)
        joints.append(("action", "base", (19, 21, 16)))
        clips = [Clip("active", {"action": {"loc": keys((0, (0, 0, 0)), (0.25, (5, 0, -3)), (0.5, (5, 0, 3)), (0.75, (-5, 0, 2)), (1, (0, 0, 0)))}}),
                 Clip("idle", {"action": {"rot": keys((0, (0, 0, 0)), (1.2, (0, 5, 0)), (2.4, (0, 0, 0)))}})]
        sockets = [Socket("socket-planchette", at=(0, 23, 0), parent="action")]
        effects = [pfx("rvx-monster-ghost-wisps", "socket-planchette", "clip:active", size=16, at=0.35)]

    elif slug == "swinging-lantern":
        _base(base, cx, cz, 11, 11, 4)
        _metal(base, (25, 4, 11, 29, 51, 15), 4, 1)
        _metal(base, (14, 49, 11, 29, 52, 15), 4, 2)
        S.bar(base, "z", (27, 40), (17, 50), 1.5, 11, 14, "iron", 4)
        _box(action, 15, 45, 14, 17, 50, 16, "gold", 5)
        _metal(action, (10, 29, 11, 22, 39, 19), 4, 4)
        _box(action, 12, 30, 12, 20, 38, 18, "toxic", 7)
        P.flat(action, (action.a > 0) & (X >= 12) & (X <= 20) & (Y >= 30) & (Y <= 38) & ((Z == 11) | (Z == 19)), "toxic", 7)
        _box(action, 9, 39, 10, 23, 42, 20, "purple", 4)
        S.spire(action, cx, cz + 1, 42, 7, 5, "purple", 4)
        joints.append(("action", "base", (cx, 48, cz + 1)))
        clips = [Clip("active", {"action": {"rot": keys((0, (0, 0, 0)), (0.45, (18, 0, 0)), (0.9, (0, 0, 0)), (1.35, (-18, 0, 0)), (1.8, (0, 0, 0)))}}),
                 Clip("idle", {"action": {"rot": keys((0, (-4, 0, 0)), (1.0, (0, 0, 0)), (2.0, (4, 0, 0)), (3.0, (0, 0, 0)), (4.0, (-4, 0, 0)))}})]
        sockets = [Socket("socket-flame", at=(0, 36, 0), parent="action")]
        effects = [pfx("rvx-monster-ghost-lantern", "socket-flame", "idle", size=22)]

    elif slug == "bat-roost":
        g = action
        _base(base, cx, cz, 13, 11, 5, "stone")
        _wood(base, (14, 5, 12, 20, 48, 16), 5, 2, width=5, ramp="darkwood")
        _wood(base, (7, 46, 10, 27, 50, 18), 5, 3, width=5, ramp="wood")
        # A short bat hangs below the beam. Its wing ribs meet its body.
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
        _box(g, 16, 40, 6, 18, 47, 8, "gray", 5)
        _box(g, 16, 46, 7, 18, 48, 12, "gray", 5)
        joints.append(("action", "base", (cx, 46, 14)))
        clips = [Clip("active", {"action": {"rot": keys((0, (0, 0, 0)), (0.25, (-12, 0, 0)), (0.5, (0, 0, 0)), (0.75, (12, 0, 0)), (1, (0, 0, 0)))}}),
                 Clip("idle", {"action": {"rot": keys((0, (0, 0, 0)), (1.0, (0, 0, 3)), (2.0, (0, 0, 0)))}})]
        sockets = [Socket("socket-roost", at=(0, 42, 0), parent="base")]
        effects = [pfx("rvx-monster-bat-swarm", "socket-roost", "idle", size=18)]

    elif slug == "haunted-portrait":
        _stone(base, (5, 0, 6, 37, 7, 18), 4, 1)
        _wood(base, (8, 7, 7, 34, 42, 10), 5, 3, width=5, ramp="darkwood")
        for bounds in ((8, 7, 3, 12, 43, 8), (30, 7, 3, 34, 43, 8), (12, 7, 3, 30, 11, 8), (12, 39, 3, 30, 43, 8)):
            _box(base, *bounds, "gold", 5)
        _box(base, 12, 11, 6, 30, 39, 7, "purple", 3)
        for xx in (9, 31):
            for yy in (8, 40):
                S.disc(base, "z", xx+1, yy+1, 2.4, 2, 4, "purple", 5, n=8)
        action.prism("z", [(14, 12), (28, 12), (27, 23), (24, 27), (18, 27), (15, 23)], 5, 6, C("purple", 5))
        action.prism("z", [(17, 28), (18, 34), (21, 36), (24, 34), (25, 28), (23, 24), (19, 24)], 5, 6, C("bone", 5))
        _box(action, 18, 30, 4, 20, 31, 5, "toxic", 6)
        _box(action, 23, 30, 4, 25, 31, 5, "toxic", 6)
        _box(action, 20, 26, 4, 23, 27, 5, "blood", 4)
        S.bar(action, "z", (17, 23), (21, 18), .8, 4, 5, "gold", 5)
        S.bar(action, "z", (25, 23), (21, 18), .8, 4, 5, "gold", 5)
        joints.append(("action", "base", (cx, 26, 6)))
        clips = [Clip("active", {"action": {"loc": keys((0, (0, 0, 0)), (0.2, (0, 0, 1)), (0.4, (0, 0, 0)), (0.6, (0, 0, -1)), (0.8, (0, 0, 0)))}}),
                 Clip("idle", {"action": {"rot": keys((0, (0, 0, 0)), (1.0, (0, 2, 0)), (2.0, (0, 0, 0)))}})]
        sockets = [Socket("socket-glass", at=(0, 24, -1), parent="base")]
        effects = [pfx("rvx-monster-ghost-wisps", "socket-glass", "idle", size=22)]

    elif slug == "jack-in-the-box":
        g = action
        _base(base, cx, cz, 13, 12, 5)
        _wood(base, (5, 5, 5, 27, 8, 25), 6, 1, width=4, ramp="wood")
        for bounds in ((5, 8, 5, 8, 20, 25), (24, 8, 5, 27, 20, 25), (8, 8, 5, 24, 20, 8), (8, 8, 22, 24, 20, 25)):
            _wood(base, bounds, 5, 2, width=4, ramp="wood")
        _box(base, 8, 8, 8, 24, 9, 22, "purple", 2)
        P.flat(base, (base.a > 0) & (Y >= 18) & (Y <= 19) & (X >= 6) & (X <= 26), "purple", 4)
        _box(base, 7, 19, 4, 25, 22, 6, "gold", 5)
        # The pop-up doll has its own part and starts inside the box.
        for i in range(5):
            a=(12 if i%2==0 else 20, 17+i*2.4)
            b=(20 if i%2==0 else 12, 19.4+i*2.4)
            S.bar(action, "z", a, b, .9, 13, 15, "iron", 5)
        _box(action, 10, 28, 8, 22, 36, 20, "purple", 4)
        eyes(action, "-z", 8, 12, 30, 2, size=2, glow=("toxic", 6), rim=("purple", 1), depth=3)
        for s in (-1, 1):
            g.prism("z", [(cx + s * 4, 34), (cx + s * 1.5, 34), (cx + s * 3.5, 38)], 10, 13, C("purple", 5))
        joints.append(("action", "base", (cx, 20, cz)))
        clips = [Clip("open", {"action": {"loc": keys((0, (0, -13, 0)), (0.4, (0, 3, 0)), (0.65, (0, 4, 0)))}} , loop=False),
                 Clip("close", {"action": {"loc": keys((0, (0, 4, 0)), (0.4, (0, -7, 0)), (0.8, (0, -13, 0)))}}, loop=False),
                 Clip("idle", {"action": {"rot": keys((0, (0, 0, 0)), (0.6, (0, 3, 0)), (1.2, (0, 0, 0)))}})]
        sockets = [Socket("socket-pop", at=(0, 32, -3), parent="action")]
        effects = [pfx("rvx-monster-curse-cloud", "socket-pop", "clip:open", size=22, at=0.5)]

    elif slug == "blood-fountain":
        g = action
        _base(base, cx, cz, 17, 15, 6, "stone")
        # A visible red basin, stone spout, and falling stream establish the fountain shape.
        _box(base, 5, 6, 5, 27, 10, 29, "gray", 4)
        _box(base, 8, 9, 8, 24, 11, 26, "blood", 5)
        P.flat(base, (base.a > 0) & (Y == 10) & (X >= 8) & (X <= 24) & (Z >= 8) & (Z <= 26), "blood", 6)
        _stone(base, (15, 11, 14, 21, 22, 20), 4, 2, (5, 4))
        _box(base, 13, 22, 10, 23, 25, 22, "gray", 5)
        S.skull(base, cx, 25, 16, s=8, eyes=("toxic", 6), socket=("purple", 1), seed=2)
        _box(base, 17, 25, 10, 21, 28, 14, "gray", 5)
        _box(action, 18, 12, 8, 20, 27, 11, "blood", 6)
        _box(action, 14, 19, 10, 22, 21, 22, "blood", 5)
        P.flat(action, (action.a > 0) & (Y == 20) & (X >= 14) & (X <= 22), "blood", 7)
        g.prism("z", [(15, 20), (21, 20), (20, 11), (16, 11)], 15, 19, C("blood", 5))
        joints.append(("action", "base", (cx, 19, 17)))
        clips = [Clip("active", {"action": {"loc": keys((0, (0, 0, 0)), (0.25, (0, 2, 0)), (0.5, (0, 0, 0)), (0.75, (0, -1, 0)), (1, (0, 0, 0)))}})]
        sockets = [Socket("socket-spray", at=(0, 22, -2), parent="base")]
        effects = [pfx("rvx-monster-blood-splat", "socket-spray", "clip:active", size=22, at=0.35)]

    joints.extend([])
    return _assembled(slug, "animated-props", name, grids, joints, clips, sockets, effects)


def _house_roof(g: Grid, x0, x1, y0, z0, z1, ridge_y, ramp="purple", shade=4, seed=0):
    mid = (z0 + z1) / 2
    g.prism("x", [(y0, z0), (y0, z1), (ridge_y, mid)], x0, x1, C(ramp, shade))
    roof = last(g)
    S.paint_facets(g, g.solids[-1:], lambda gg, mm, fr: P.tiles(gg, mm, ramp, shade, row=4, width=5, frame=fr, seed=seed))
    P.flat(g, roof & ((coords(g)[1] - y0) % 5 == 0), ramp, max(1, shade - 2))
    return roof


def _tower_building(slug, g, cx, cz, h):
    X, Y, Z = coords(g)
    if slug == "haunted-lighthouse":
        _stone(g, (cx - 19, 0, cz - 19, cx + 19, 8, cz + 19), 5, 1, (7, 5))
        body = plan(g, octo(cx, cz, 16, 16, 5), 8, h - 22, "gray", 5,
                    top=octo(cx - 2, cz + 1, 11, 11, 4))
        P.stone(g, body, "gray", 5, block=(7, 5), cracks=0.04, seed=2)
        for y in (28, 54, 80):
            _box(g, cx - 12, y, cz - 12, cx + 12, y + 3, cz + 12, "purple", 3)
        _box(g, cx - 13, h - 30, cz - 13, cx + 13, h - 26, cz + 13, "gray", 6)
        _box(g, cx - 11, h - 26, cz - 11, cx + 11, h - 15, cz + 11, "toxic", 4)
        for x in (cx - 9, cx + 6):
            _box(g, x, h - 26, cz - 13, x + 3, h - 16, cz - 11, "gray", 4)
        _box(g, cx - 15, h - 15, cz - 15, cx + 15, h - 12, cz + 15, "purple", 5)
        S.spire(g, cx - 1, cz + 1, h - 12, 15, 12, "purple", 4)
        _box(g, cx - 3, 20, cz - 17, cx + 4, 28, cz - 14, "purple", 4)
        P.flat(g, (g.a > 0) & (Z == cz - 17) & (X >= cx - 2) & (X <= cx + 2) & (Y >= 22) & (Y <= 26), "toxic", 6)
        return
    if slug == "mad-lab-tower":
        _stone(g, (cx - 22, 0, cz - 22, cx + 22, 8, cz + 22), 5, 3, (8, 5))
        plan(g, octo(cx, cz, 20, 20, 5), 8, h - 25, "gray", 4,
             top=octo(cx + 1, cz - 1, 14, 14, 4))
        body = np.logical_or.reduce([s.mask(g.shape) for s in g.solids[-1:]])
        P.stone(g, body, "gray", 4, block=(6, 5), seed=4)
        for y in (26, 48, 70):
            _box(g, cx - 15, y, cz - 15, cx + 15, y + 3, cz + 15, "iron", 4)
            for x in (cx - 10, cx + 6):
                _box(g, x, y + 5, cz - 16, x + 4, y + 13, cz - 14, "toxic", 5)
        _box(g, cx - 16, h - 31, cz - 16, cx + 16, h - 26, cz + 16, "purple", 4)
        S.spire(g, cx, cz, h - 26, 17, 23, "purple", 4)
        for sx in (-1, 1):
            for sz in (-1, 1):
                S.spire(g, cx + sx * 13, cz + sz * 13, h - 22, 3, 14, "gold", 5, tiles=False)
        # The lightning fork is thick enough to read at thumbnail scale.
        S.cross(g, cx, h - 18, cz - 1, h=12, arm=7, t=3, ramp="gold", base=5, horns=False)
        _box(g, cx - 4, 14, cz - 23, cx + 4, 24, cz - 20, "purple", 4)
        return
    # Vampire Castle Tower: a crowned, stepped keep with a large face window.
    _stone(g, (cx - 24, 0, cz - 24, cx + 24, 9, cz + 24), 5, 5, (8, 5))
    plan(g, octo(cx, cz, 20, 20, 4), 9, h - 26, "gray", 5,
         top=octo(cx - 1, cz, 16, 16, 5))
    body = np.logical_or.reduce([s.mask(g.shape) for s in g.solids[-1:]])
    P.stone(g, body, "gray", 5, block=(7, 5), seed=6)
    for x in (cx - 15, cx + 9):
        _box(g, x, 12, cz - 22, x + 6, h - 24, cz - 16, "gray", 6)
        S.spire(g, x + 3, cz - 19, h - 24, 7, 20, "purple", 4)
    lancet(g,"-z",cz-20,cx-7,cx+7,30,58,glass="toxic",shade=4,frame="purple",fshade=5)
    _house_roof(g, cx - 20, cx + 20, h - 24, cz - 20, cz + 20, h, "purple", 5, 8)
    g.prism("z", [(cx - 6, h - 24), (cx, h - 18), (cx + 6, h - 24)], cz - 24, cz - 21, C("purple", 5))
    _box(g, cx - 3, h - 24, cz - 25, cx + 3, h - 21, cz - 24, "toxic", 5)
    for sx in (-1, 1):
        for sz in (-1, 1):
            S.spire(g, cx + sx * 10, cz + sz * 10, h - 14, 2.5, 10, "purple", 5, tiles=False)


def _tower_detail(slug, g, cx, cz, h):
    # Frames project from the tapered walls at each floor.
    for yy in ((18,42,66,94) if slug == "vampire-castle-tower" else (18,42,66)):
        radius = 15 - (yy - 8) * 5 / max(1, h - 30) if slug == "haunted-lighthouse" else 20 - (yy - 8) * 6 / max(1, h - 33)
        radius = round(radius)
        for face, plane, center in (("-z", cz-radius, cx), ("+z", cz+radius, cx), ("-x", cx-radius, cz), ("+x", cx+radius, cz)):
            lancet(g, face, plane, center-4, center+4, yy, yy+14, glass="toxic", shade=4, frame="purple", fshade=4)
    door(g, "-z", cz-18, cx-6, cx+6, 8, 27, leaf="darkwood", frame="purple", base=5)
    if slug == "haunted-lighthouse":
        yy=h-29
        for xx in (cx-14,cx+14):
            for zz in range(int(cz-14),int(cz+15),7):
                _box(g,xx-1,yy,zz-1,xx+1,yy+9,zz+1,"iron",4)
        for zz in (cz-14,cz+14):
            for xx in range(int(cx-14),int(cx+15),7):
                _box(g,xx-1,yy,zz-1,xx+1,yy+9,zz+1,"iron",4)
        for bounds in ((cx-15,yy+8,cz-15,cx+15,yy+10,cz-13),(cx-15,yy+8,cz+13,cx+15,yy+10,cz+15),(cx-15,yy+8,cz-13,cx-13,yy+10,cz+13),(cx+13,yy+8,cz-13,cx+15,yy+10,cz+13)):
            _box(g,*bounds,"iron",4)
    elif slug == "mad-lab-tower":
        for xx in (cx-20,cx+20):
            _box(g,xx-2,8,cz-2,xx+2,80,cz+2,"gold",4)
            for yy in (24,31,38,45,52,59,66):
                S.disc(g,"y",xx,cz,4,yy,yy+2,"teal",5,n=8)
            g.line((xx,79,cz),(cx,79,cz),2,C("gold",5))
    else:
        for yy in (28,62,90):
            _box(g,cx-18,yy,cz-18,cx+18,yy+3,cz+18,"purple",4)


def _greenhouse(w,h,d):
    from _double_nature import leaf, branch
    g=Grid(w,h,d);cx,cz=w/2,d/2
    _stone(g,(3,0,4,w-3,7,d-4),5,2)
    _box(g,10,7,12,w-10,9,d-12,"darkwood",4)
    for xx in range(10,w-9,14):
        for zz in (12,d-12):
            _box(g,xx,8,zz,xx+2,43,zz+2,"iron",4)
        # Each narrow roof frame spans both slopes and joins the ridge.
        S.bar(g,"x",(42,12),(65,cz),1.1,xx,xx+2,"iron",5)
        S.bar(g,"x",(65,cz),(42,d-10),1.1,xx,xx+2,"iron",5)
    for zz in range(12,d-10,14):
        for xx in (10,w-10):_box(g,xx,8,zz,xx+2,43,zz+2,"iron",4)
    for yy in (10,25,41):
        _box(g,10,yy,12,w-8,yy+2,14,"iron",4)
        _box(g,10,yy,d-12,w-8,yy+2,d-10,"iron",4)
        _box(g,10,yy,12,12,yy+2,d-10,"iron",4)
        _box(g,w-10,yy,12,w-8,yy+2,d-10,"iron",4)
    _box(g,10,64,cz-1,w-8,67,cz+1,"purple",4)
    for xx in range(14,w-15,14):
        g.prism("x",[(43,15),(64,cz),(62,cz),(42,17)],xx,xx+4,C("teal",5))
        g.prism("x",[(64,cz),(43,d-13),(42,d-15),(62,cz)],xx,xx+4,C("teal",5))
    # Thin cyan panes fill the lower wall. Upper openings reveal the plants.
    for xx in range(13,w-14,14):
        _box(g,xx,12,12,xx+10,24,13,"teal",4)
        _box(g,xx,12,d-11,xx+10,24,d-10,"teal",4)
        _box(g,xx,13,11,xx+1,23,12,"teal",6)
    for zz in range(15,d-16,14):
        for xx in (11,w-9):_box(g,xx,12,zz,xx+1,24,zz+10,"teal",4)
    for xx,zz in ((23,27),(47,28),(68,29),(27,53),(54,52),(72,51)):
        S.cone(g,"y",xx,zz,5,9,16,"purple",4,n=8,r_top=6)
        branch(g,[(xx,16,zz),(xx+2,27,zz),(xx,35,zz)],1.4,"moss",5)
        for side in (-1,1):leaf(g,(xx,22,zz),(xx+side*8,30,zz+2),3,"toxic",4)
        g.sphere(xx,35,zz,3,C("magenta",5))
    door(g,"-z",12,cx-6,cx+6,8,38,leaf="teal",frame="purple",base=5)
    return _asset("sinister-greenhouse","buildings","Sinister Greenhouse",g)


def _new_building(slug):
    specs = {
        "haunted-lighthouse": ((52, 126, 52), "tower"),
        "mad-lab-tower": ((58, 128, 58), "tower"),
        "haunted-schoolhouse": ((92, 82, 82), "house"),
        "graveyard-gate": ((96, 72, 22), "gate"),
        "hunters-lodge": ((94, 82, 88), "house"),
        "cursed-library": ((104, 88, 96), "house"),
        "haunted-carnival-tent": ((100, 82, 94), "tent"),
        "sinister-greenhouse": ((92, 74, 82), "glasshouse"),
        "vampire-castle-tower": ((60, 146, 60), "tower"),
    }
    (w, h, d), style = specs[slug]
    if style == "glasshouse":
        return _greenhouse(w,h,d)
    g = Grid(w, h + 24 if slug == "haunted-schoolhouse" else h, d)
    cx, cz = w // 2, d // 2
    X, Y, Z = coords(g)
    if style == "tower":
        _tower_building(slug, g, cx, cz, h)
        _tower_detail(slug, g, cx, cz, h)
        return _asset(slug, "buildings", slug.replace("-", " ").title(), g)
    if style == "gate":
        _stone(g, (3, 0, 5, w - 3, 9, d - 5), 5, 1, (8, 4))
        for x0, x1 in ((6, 22), (w - 22, w - 6)):
            _stone(g, (x0, 9, 4, x1, h - 4, d - 4), 5, x0, (7, 5))
            _box(g, x0 - 2, h - 14, 2, x1 + 2, h - 7, d - 2, "purple", 4)
            for x in range(x0 + 2, x1 - 2, 8):
                S.spire(g, x + 2, cz, h - 7, 3.5, 7, "gray", 5)
        _stone(g, (18, h - 18, 5, w - 18, h - 7, d - 5), 5, 3, (6, 4))
        # A broad pointed arch makes the gate opening clear from every view.
        _box(g, cx - 2, 7, 4, cx + 2, h - 15, d - 4, "purple", 2)
        _box(g, cx - 24, 8, 4, cx - 21, h - 16, d - 4, "gray", 6)
        _box(g, cx + 21, 8, 4, cx + 24, h - 16, d - 4, "gray", 6)
        for x in (cx - 18, cx - 10, cx - 2, cx + 6, cx + 14):
            _metal(g, (x - 1.5, 9, d - 10, x + 1.5, 50, d - 7), 5, int(x))
            S.spire(g, x, d - 8, 50, 2, 6, "iron", 5, tiles=False)
        for yy in (12, 29, 47):
            _metal(g, (cx - 23, yy, d - 10, cx + 22, yy + 3, d - 7), 5, yy)
        _box(g, cx - 12, 56, 3, cx + 12, 67, 6, "purple", 4)
        _box(g, cx - 5, 58, 5, cx + 5, 65, 7, "toxic", 5)
        return _asset(slug, "buildings", "Graveyard Gate", g)

    if style == "tent":
        _stone(g, (8, 0, 8, w - 8, 8, d - 8), 5, 3, (8, 4))
        # One continuous hip roof covers the canvas walls.
        canvas = [(14, 12), (w - 14, 12), (w - 14, d - 12), (14, d - 12)]
        walls = plan(g, canvas, 8, 24, "purple", 5)
        P.flat(g, walls & ((X.astype(int) // 12) % 2 == 0), "magenta", 5)
        roof = plan(g, canvas, 24, 68, "purple", 5, top=[(cx - 1, cz - 1), (cx + 1, cz - 1), (cx + 1, cz + 1), (cx - 1, cz + 1)])
        P.flat(g, roof & ((X.astype(int) // 12) % 2 == 0), "magenta", 5)
        _box(g, cx - 2, 8, cz - 2, cx + 2, 69, cz + 2, "darkwood", 4)
        g.prism("z", [(cx - 13, 8), (cx + 13, 8), (cx, 34)], 9, 13, C("purple", 3))
        P.flat(g, last(g) & ((Y.astype(int) // 5) % 2 == 0), "magenta", 4)
        # A timber portal frames the front flap and keeps the entrance clear.
        for x0 in (cx - 17, cx + 14):
            _wood(g, (x0, 8, 8, x0 + 3, 36, 12), 5, seed=x0, width=6, ramp="darkwood")
        _wood(g, (cx - 17, 35, 8, cx + 17, 39, 12), 5, seed=12, width=6, ramp="darkwood")
        _box(g, cx - 12, 8, 7, cx + 12, 10, 12, "gold", 5)
        from _double_nature import branch
        for xx in (14,w-14):
            for zz in (12,d-12):
                pegx=9 if xx<cx else w-9
                pegz=8 if zz<cz else d-8
                _wood(g,(xx-1,8,zz-1,xx+1,25,zz+1),5,xx,width=4,ramp="wood")
                branch(g,[(xx,24,zz),(pegx,10,pegz)],1.1,"bone",5)
                _box(g,pegx-1,8,pegz-1,pegx+1,13,pegz+1,"iron",4)
        stripe=(X.astype(int)//12)%2==0
        P.mottle(g,roof & stripe,"magenta",5,cell=5,seed=9)
        P.mottle(g,roof & ~stripe,"purple",5,cell=5,seed=10)
        P.flat(g,(roof|walls)&((X.astype(int)%12)==0),"purple",3)
        P.flat(g,(roof|walls)&((X.astype(int)%12)==1)&((Y.astype(int)%3)==0),"bone",5)
        P.flat(g,roof&((Y.astype(int)%10)==0)&(((X+Z).astype(int)%4)<2),"purple",4)
        _box(g, cx - 2, 68, cz - 2, cx + 2, 77, cz + 2, "gold", 5)
        g.prism("z", [(cx, 77), (cx + 15, 73), (cx, 69)], cz - 3, cz + 3, C("gold", 6))
        S.skull(g, cx - 5, 28, 8, s=10, eyes=("toxic", 6), socket=("purple", 1), seed=5)
        return _asset(slug, "buildings", "Haunted Carnival Tent", g)

    # Shops and halls use a framed plinth, painted stone courses, true roof
    # slopes, one large function sign, and a few props at the base.
    _stone(g, (3, 0, 4, w - 3, 8, d - 4), 5, 2, (8, 4))
    x0, x1 = 10, w - 10
    z0, z1 = 12, d - 12
    eave = int(h * 0.57)
    body = _box(g, x0, 8, z0, x1, eave, z1, "gray", 5)
    P.stone(g, body, "gray", 5, block=(8, 5), cracks=0.03, seed=3)
    # Dark corner piers frame every face.
    for x in (x0, x1 - 4):
        _stone(g, (x, 8, z0 - 1, x + 4, eave, z0 + 3), 6, x, (5, 5))
        _stone(g, (x, 8, z1 - 3, x + 4, eave, z1 + 1), 6, x + 1, (5, 5))
    door_w = 12 if w < 100 else 16
    _box(g, cx - door_w // 2 - 2, 8, z0 - 2, cx + door_w // 2 + 2, int(eave * 0.74), z0 + 2, "darkwood", 3)
    _box(g, cx - door_w // 2, 9, z0 - 3, cx + door_w // 2, int(eave * 0.72), z0, "wood", 5)
    _box(g, cx + door_w // 2 - 3, 20, z0 - 4, cx + door_w // 2 - 1, 22, z0 - 2, "gold", 6)
    window_y = 20
    for x in (x0 + 14, x1 - 22):
        _box(g, x - 2, window_y - 2, z0 - 2, x + 8, window_y + 16, z0 + 2, "purple", 2)
        _box(g, x, window_y, z0 - 3, x + 6, window_y + 12, z0, "toxic", 5)
        _box(g, x + 2, window_y - 2, z0 - 4, x + 4, window_y + 14, z0 - 2, "gray", 6)
    for face, plane, start, finish in (("-x",x0,z0,z1),("+x",x1,z0,z1),("+z",z1,x0,x1)):
        for uu in range(start+10,finish-12,22):
            window(g,face,plane,uu,uu+12,19,eave-7,frame="darkwood",glass="toxic",glow=5)
    for yy in (12,eave-4):
        _wood(g,(x0-1,yy,z0-1,x1+1,yy+3,z1+1),4,yy,width=8,ramp="darkwood")
    for xx in (x0-1,x1-2):
        for zz in (z0-1,z1-2):_wood(g,(xx,8,zz,xx+3,eave,zz+3),5,xx,width=6,ramp="wood")
    _house_roof(g, x0 - 5, x1 + 5, eave, z0 - 5, z1 + 5, h, "purple", 5, 4)
    # A crooked chimney and skull sign carry the haunted theme.
    _stone(g, (x1 - 8, eave + 12, z1 - 6, x1 + 1, h - 2, z1 + 2), 5, 6, (5, 4))
    _box(g, cx - 15, eave - 9, z0 - 8, cx + 15, eave + 7, z0 - 5, "purple", 4)
    _box(g, cx - 8, eave - 5, z0 - 9, cx + 8, eave + 4, z0 - 7, "bone", 5)
    P.flat(g, (g.a > 0) & (Z == z0 - 9) & (Y >= eave - 2) & (Y <= eave + 2) & (np.abs(X - cx) < 5), "toxic", 6)
    _box(g, x0 + 2, 8, z0 - 5, x0 + 13, 15, z0, "wood", 5)
    _box(g, x1 - 12, 8, z0 - 5, x1 - 2, 17, z0, "purple", 4)
    if slug == "haunted-schoolhouse":
        for xx in (cx-9,cx+7):
            for zz in (cz-7,cz+5):_wood(g,(xx,h-4,zz,xx+2,h+13,zz+2),5,xx,width=4,ramp="darkwood")
        _house_roof(g,cx-12,cx+12,h+12,cz-10,cz+10,h+22,"purple",5,9)
        S.cone(g,"y",cx,cz,5,h+1,h+8,"gold",5,n=8,r_top=2)
        _box(g,cx-1,h+8,cz-1,cx+1,h+13,cz+1,"iron",4)
        _box(g,cx-7,31,z0-7,cx+7,42,z0-4,"purple",3)
        _box(g,cx-4,33,z0-8,cx+4,40,z0-7,"bone",5)
    elif slug == "hunters-lodge":
        _box(g, cx - 17, eave - 5, z0 - 8, cx + 17, eave + 10, z0 - 5, "darkwood", 4)
        S.skull(g,cx,eave-3,z0-6,s=10,eyes=("purple",1),socket=("purple",1))
        for side in (-1,1):
            S.bar(g,"z",(cx+side*4,eave+4),(cx+side*12,eave+13),1.1,z0-9,z0-7,"bone",6)
            S.bar(g,"z",(cx+side*9,eave+9),(cx+side*15,eave+8),1.0,z0-9,z0-7,"bone",6)
            S.bar(g,"z",(cx+side*10,eave+11),(cx+side*9,eave+17),1.0,z0-9,z0-7,"bone",6)
    elif slug == "cursed-library":
        _box(g, cx - 18, eave - 6, z0 - 8, cx + 18, eave + 11, z0 - 5, "purple", 4)
        for side in (-1,1):
            g.prism("z",[(cx,eave-3),(cx+side*12,eave),(cx+side*12,eave+10),(cx,eave+7)],z0-10,z0-7,C("bone",6))
        _box(g,cx-1,eave-3,z0-11,cx+1,eave+8,z0-9,"gold",5)
        for yy in (eave+2,eave+5,eave+8):
            _box(g,cx-9,yy,z0-11,cx-3,yy+1,z0-10,"purple",4)
            _box(g,cx+3,yy,z0-11,cx+9,yy+1,z0-10,"purple",4)
    return _asset(slug, "buildings", slug.replace("-", " ").title(), g)


def _humanoid_creature(slug, dims, name):
    w, h, d = dims
    cx, cz = w / 2, d / 2
    body, head, arm_l, arm_r, leg_l, leg_r, cape = [Grid(w, h + 4, d) for _ in range(7)]
    X, Y, Z = coords(body)
    colors = {
        "patchwork-giant": ("wood", "bone", "blood"),
        "swamp-creature": ("moss", "bone", "toxic"),
        "imp": ("purple", "bone", "toxic"),
        "lich": ("purple", "bone", "teal"),
        "scarecrow-fiend": ("wood", "orange", "toxic"),
        "phantom-knight": ("gray", "bone", "purple"),
    }
    coat, face_ramp, accent = colors[slug]
    waist = int(h * 0.28)
    shoulder = int(h * 0.57)
    crown = int(h * 0.76)
    face_z = 5
    # A broad torso, a narrowed waist, and flared lower panels form the silhouette.
    body_prism = front(body, [(cx - 8, waist), (cx + 8, waist), (cx + 14, shoulder),
                              (cx + 11, shoulder + 4), (cx - 11, shoulder + 4), (cx - 14, shoulder)],
                       9, d - 8, coat, 4)
    P.flat(body, body_prism & (Y < waist + 7), coat, 2)
    P.flat(body, body_prism & (Y > shoulder - 3), coat, 6)
    P.flat(body, body_prism & (Z == 9) & (np.abs(X - cx) < 1.4), "gray", 2)
    if slug == "phantom-knight":
        _box(body, cx - 11, shoulder - 2, 8, cx + 11, shoulder + 2, d - 7, "iron", 4)
        for sign in (-1, 1):
            body.prism("z", [(cx+sign*8,shoulder-3),(cx+sign*15,shoulder-2),(cx+sign*14,shoulder+4),(cx+sign*9,shoulder+6)],8,16,C("gray",5))
    _box(body,cx-3,shoulder+1,11,cx+3,crown+2,17,coat,5)
    if slug == "patchwork-giant":
        for y in (waist + 4, waist + 12, shoulder - 2):
            P.flat(body, body_prism & (Y == y) & (Z == 9), "blood", 4)
        P.flat(body, body_prism & (Z == 9) & (Y > waist + 8) & (Y < shoulder - 5) & (((X.astype(int) + Y.astype(int)) % 6) == 0), "bone", 6)
    elif slug == "swamp-creature":
        P.flat(body, body_prism & (Z == 9) & (Y > waist) & (Y < shoulder) & (np.abs(X - cx) < 7) & (((Y.astype(int)) % 7) < 2), "moss", 5)
        for yy in range(waist+3,shoulder-1,4):
            _box(body,cx-6,yy,8,cx+6,yy+2,10,"moss",6)
    elif slug == "imp":
        _box(body, cx - 7, shoulder - 1, 8, cx + 7, shoulder + 3, 15, "purple", 6)
        for s in (-1, 1):
            g = body
            g.prism("z", [(cx + s * 8, shoulder - 1), (cx + s * 13, shoulder + 2), (cx + s * 10, shoulder + 7)], 8, 12, C("purple", 5))
    elif slug == "lich":
        _box(body, cx - 1, waist + 5, 7, cx + 1, shoulder, 9, "bone", 5)
        P.flat(body, body_prism & (Y < waist + 12), "purple", 2)
    elif slug == "scarecrow-fiend":
        for x in (cx - 14, cx + 11):
            _box(body, x, shoulder - 4, 9, x + 3, shoulder + 4, 13, "wood", 6)
        P.flat(body, body_prism & (Z == 9) & (Y > waist + 7) & (Y < shoulder - 3) & (((X.astype(int) + Y.astype(int)) % 8) < 3), "bone", 6)
    else:
        _box(body, cx - 11, waist + 3, 7, cx + 11, waist + 7, 10, "gold", 5)
        for s in (-1, 1):
            _box(body, cx + s * 13 - 2, shoulder - 5, 9, cx + s * 13 + 2, shoulder + 2, 13, "gold", 5)

    # A head part keeps its face readable when it turns during the clips.
    head_top = h - 3
    head_lo = crown - 1
    if slug == "patchwork-giant":
        _box(head, cx - 10, head_lo, 6, cx + 10, head_top, 22, "bone", 5)
        _box(head, cx - 11, head_lo + 2, 5, cx + 11, head_lo + 6, 20, "wood", 5)
        P.flat(head, (head.a > 0) & (Z == 6) & (Y > head_lo + 4) & (np.abs(X - cx) < 8), "blood", 5)
        P.flat(head, (head.a > 0) & (Z == 6) & (Y == head_top - 4) & ((X < cx - 3) | (X > cx + 3)), "toxic", 6)
    elif slug == "swamp-creature":
        head.ellipsoid(cx,(head_lo+head_top)/2,14,10,(head_top-head_lo)/2+1,9,C("moss",5))
        for side in (-1,1):
            head.ellipsoid(cx+side*7,head_top-4,7,4,3,3,C("moss",6))
            _box(head,cx+side*7-1,head_top-4,4,cx+side*7+1,head_top-2,5,"toxic",7)
            for yy in (head_lo+2,head_lo+5,head_lo+8):
                head.prism("z",[(cx+side*7,yy),(cx+side*13,yy+3),(cx+side*8,yy+4)],12,17,C("teal",4))
        _box(head,cx-4,head_lo+3,5,cx+4,head_lo+4,7,"purple",2)
    elif slug == "imp":
        _box(head, cx - 7, head_lo, 7, cx + 7, head_top - 1, 20, "purple", 5)
        eyes(head, "-z", 7, int(cx - 6), head_lo + 5, 1, size=2, glow=("toxic", 6), rim=("purple", 1), depth=3)
        for s in (-1, 1):
            head.prism("z", [(cx + s * 7, head_top - 5), (cx + s * 3, head_top - 5), (cx + s * 6, head_top + 2)], 10, 14, C("bone", 6))
    elif slug == "lich":
        S.skull(head,cx,head_lo,13,s=9,eyes=("teal",7),socket=("purple",1))
        for xx in (cx-5,cx,cx+5):
            head.prism("z",[(xx-1,head_top-1),(xx+1,head_top-1),(xx,head_top+2)],11,14,C("gold",5))
    elif slug == "scarecrow-fiend":
        head.sphere(cx, (head_lo + head_top) / 2, 12, 7.0, C("orange", 4))
        P.flat(head, (head.a > 0) & (Z == 5) & (Y > head_lo + 3), "orange", 5)
        eyes(head, "-z", 5, int(cx - 7), head_lo + 6, 2, size=2, glow=("toxic", 6), rim=("gray", 1), depth=4)
        P.flat(head, (head.a > 0) & (Z == 5) & (Y == head_lo + 4) & (np.abs(X - cx) < 3), "purple", 1)
    else:
        _box(head, cx - 8, head_lo, 6, cx + 8, head_top, 22, "gray", 5)
        _box(head, cx - 10, head_top - 5, 5, cx + 10, head_top - 2, 23, "gray", 6)
        eyes(head, "-z", 6, int(cx - 6), head_lo + 5, 1, size=2, glow=("toxic", 5), rim=("gray", 1), depth=3)

    # The arms use tapered true-slope prisms and thick hands.
    reach = 10 if w >= 50 else (5 if w >= 38 else 2)
    arm_z0, arm_z1 = 9, d - 8
    arm_r0, arm_r1 = (4.2, 3.0) if w >= 50 else ((2.8, 2.0) if w >= 38 else (1.8, 1.5))
    lower_r0, lower_r1 = (3.0, 2.4) if w >= 50 else ((2.0, 1.6) if w >= 38 else (1.5, 1.2))
    left_mid, left_end = cx - 11 - reach / 3, cx - 11 - reach
    right_mid, right_end = cx + 11 + reach / 3, cx + 11 + reach
    limb(arm_l, "z", (cx - 11, shoulder), (left_mid, shoulder - 9), arm_r0, arm_r1, arm_z0, arm_z1, coat, 5)
    limb(arm_l, "z", (left_mid, shoulder - 9), (left_end, waist + 3), lower_r0, lower_r1, arm_z0, arm_z1, coat, 4)
    limb(arm_r, "z", (cx + 11, shoulder), (right_mid, shoulder - 8), arm_r0, arm_r1, arm_z0, arm_z1, coat, 5)
    limb(arm_r, "z", (right_mid, shoulder - 8), (right_end, waist + 4), lower_r0, lower_r1, arm_z0, arm_z1, coat, 4)
    hand_w = 8 if w >= 50 else 6
    left_hand_x0 = max(0, int(cx - 14 - reach))
    right_hand_x1 = min(w, int(cx + 14 + reach))
    _box(arm_l, left_hand_x0, waist + 2, 7, left_hand_x0 + hand_w, waist + 7, 17, face_ramp, 5)
    _box(arm_r, right_hand_x1 - hand_w, waist + 3, 7, right_hand_x1, waist + 8, 17, face_ramp, 5)
    if slug in ("patchwork-giant", "swamp-creature", "scarecrow-fiend"):
        for a in (arm_l, arm_r):
            P.flat(a, (a.a > 0) & (Y < waist + 7) & (Z == 9), accent, 5)

    # Two separated legs keep the stance broad and clear.
    for grid, x0 in ((leg_l, cx - 9), (leg_r, cx + 3)):
        limb(grid, "z", (x0 + 3, waist + 2), (x0 + 2, 5), 4 if w > 40 else 2.8, 3 if w > 40 else 2.0, 10, d - 9, coat, 4)
        _box(grid, x0, 1, 8, x0 + 8, 6, d - 7, "bone" if slug in ("lich", "phantom-knight") else coat, 5)
    if slug in ("lich","phantom-knight"):
        g=cape
        g.prism("x",[(shoulder+3,d-9),(shoulder+1,d-3),(waist-5,d-1),(waist-9,d-5)],cx-11,cx+11,C("purple",4))
        P.flat(g,last(g)&((X.astype(int)//4)%2==0),"purple",5)
        for xx in (cx-10,cx+8):_box(g,xx,waist-6,d-6,xx+2,shoulder,d-3,"gold",4)
    elif slug == "imp":
        for sign in (-1,1):
            pts=[(cx+sign*2,shoulder-2),(cx+sign*6,shoulder+5),(cx+sign*13,shoulder+9),
                 (cx+sign*14,shoulder-1),(cx+sign*11,shoulder+1),(cx+sign*9,shoulder-5),(cx+sign*6,shoulder-2)]
            cape.prism("z",pts,d-7,d-4,C("magenta",4))
            for xx,yy in ((cx+sign*13,shoulder+8),(cx+sign*9,shoulder-4)):
                S.bar(cape,"z",(cx+sign*2,shoulder-2),(xx,yy),.8,d-4,d-2,"purple",6)
    elif slug == "swamp-creature":
        from _double_nature import leaf
        for yy in range(waist+2,shoulder+4,5):
            cape.prism("x",[(yy,d-9),(yy+2,d-1),(yy+5,d-9)],cx-2,cx+2,C("teal",4))
        for xx in (cx-8,cx+7):
            leaf(body,(xx,shoulder-2,12),(xx+2,shoulder+6,15),2,"moss",6)
        for gg in (arm_l,arm_r):
            P.flat(gg,gg.a>0,"moss",5)
            for xx in range(2,w-2,3):
                if gg.a[xx,waist+5,10]:
                    gg.prism("z",[(xx-1,waist+5),(xx+2,waist+5),(xx+1,waist-1)],6,10,C("teal",5))
    elif slug == "scarecrow-fiend":
        _wood(cape,(cx-2,4,d-10,cx+2,shoulder+4,d-7),5,3,width=3,ramp="darkwood")
        _wood(cape,(cx-16,shoulder-1,d-10,cx+16,shoulder+2,d-7),5,2,width=4,ramp="wood")
        for gg in (arm_l,arm_r,leg_l,leg_r):
            P.flat(gg,gg.a>0,"wood",5)
            for xx in range(2,w-2,3):
                ys=np.where(gg.a[xx,:,12]>0)[0]
                if len(ys):
                    yy=int(ys.min())
                    gg.prism("z",[(xx-1,yy+5),(xx+1,yy+5),(xx+2,max(0,yy-2))],10,14,C("gold",5))
        for xx in (cx-8,cx-2,cx+4):
            body.prism("z",[(xx-2,waist+7),(xx+3,waist+7),(xx+1,waist-3)],8,10,C("wood",5))
        S.disc(head,"y",cx,12,9,head_top-1,head_top+1,"darkwood",4,n=8)
        S.cone(head,"y",cx,12,6,head_top,head_top+3,"darkwood",5,n=8,r_top=2)
    else:
        # A stitched back panel joins the giant's shoulders.
        _box(cape,cx-7,waist+4,d-8,cx+7,shoulder,d-6,"wood",4)
        P.flat(cape,(cape.a>0)&((Y.astype(int)%5)==0),"blood",4)

    if slug == "patchwork-giant":
        for index,gg in enumerate((body,head,arm_l,arm_r,leg_l,leg_r)):
            XX,YY,ZZ=coords(gg);m=gg.a>0
            seam=((XX.astype(int)+YY.astype(int)//4+index)%11)==0
            P.flat(gg,m&((XX>cx) if index%2 else (YY%13<6)),"moss",4)
            P.flat(gg,m&seam,"blood",3)
            P.flat(gg,m&((XX.astype(int)+YY.astype(int)//4+index)%11<3)&(YY.astype(int)%4==0),"bone",6)
        _box(arm_l,1,waist+3,8,8,waist+9,18,"wood",5)
        for xx in (cx-6,cx+4):
            _box(head,xx,head_lo+6,4,xx+3,head_lo+9,6,"purple",1)
            _box(head,xx+1,head_lo+7,3,xx+2,head_lo+8,5,"toxic",7)
        _box(head,cx-5,head_lo+2,4,cx+5,head_lo+3,6,"purple",2)
    elif slug == "lich":
        for xx in (cx-8,cx+6):_box(body,xx,waist,8,xx+2,shoulder,10,"gold",5)
        _box(arm_r,w-4,waist+5,5,w-2,shoulder+6,7,"gold",5)
        arm_r.sphere(w-3,shoulder+7,6,2.5,C("teal",6))
        for yy in range(waist+5,shoulder,4):_box(body,cx-4,yy,7,cx+4,yy+1,9,"bone",5)
    elif slug == "phantom-knight":
        # The visor slit, nose guard, and pointed shield define the armour.
        _box(head,cx-7,head_lo+5,4,cx+7,head_lo+7,6,"purple",1)
        _box(head,cx-1,head_lo+1,3,cx+1,head_top,6,"gold",5)
        for xx in (cx-5,cx-2,cx+2,cx+5):_box(head,xx,head_lo+1,4,xx+1,head_lo+4,6,"iron",2)
        arm_l.prism("z",[(1,waist+11),(10,waist+11),(11,waist+2),(6,waist-3),(1,waist+2)],3,6,C("purple",4))
        _box(arm_l,5,waist+1,2,7,waist+10,3,"gold",5)
        _box(arm_r,w-5,waist+5,5,w-3,shoulder+12,7,"gray",6)
        _box(arm_r,w-8,waist+8,4,w-1,waist+10,8,"gold",5)

    joints = [("body", None, (cx, 0, cz)), ("head", "body", (cx, head_lo, 8)),
              ("arm-l", "body", (cx - 11, shoulder, 12)), ("arm-r", "body", (cx + 11, shoulder, 12)),
              ("leg-l", "body", (cx - 6, waist + 2, 12)), ("leg-r", "body", (cx + 6, waist + 2, 12)),
              ("cape", "body", (cx, shoulder + 2, d - 9))]
    root = assemble({"body": body, "head": head, "arm-l": arm_l, "arm-r": arm_r,
                     "leg-l": leg_l, "leg-r": leg_r, "cape": cape}, joints)
    idle = {"body": {"loc": keys((0, (0, 0, 0)), (0.8, (0, 0.8, 0)), (1.6, (0, 0, 0)))},
            "head": {"rot": keys((0, (0, 0, 0)), (0.8, (0, 2, 0)), (1.6, (0, 0, 0)))}}
    attack = {"body": {"rot": keys((0, (0, 0, 0)), (0.3, (-12, 0, 0)), (0.55, (8, 0, 0)), (0.9, (0, 0, 0)))},
              "arm-l": {"rot": keys((0, (0, 0, 0)), (0.3, (0, 0, 38)), (0.55, (0, 0, -18)), (0.9, (0, 0, 0)))},
              "arm-r": {"rot": keys((0, (0, 0, 0)), (0.3, (0, 0, -34)), (0.55, (0, 0, 14)), (0.9, (0, 0, 0)))}}
    hit = {"body": {"loc": keys((0, (0, 0, 0)), (0.1, (0, 1.5, 1)), (0.45, (0, 0, 0))),
                    "rot": keys((0, (0, 0, 0)), (0.1, (0, 0, 10)), (0.45, (0, 0, 0)))}}
    death = {"body": {"rot": keys((0, (0, 0, 0)), (0.45, (0, 0, 55)), (0.9, (0, 0, 90))),
                      "loc": keys((0, (0, 0, 0)), (0.9, (0, -5, 0)))},
             "head": {"rot": keys((0, (0, 0, 0)), (0.9, (18, 0, 0)))}}
    effect = {
        "patchwork-giant": [pfx("rvx-monster-blood-splat", "socket-chest", "clip:hit", size=48)],
        "swamp-creature": [pfx("rvx-monster-venom-spit", "socket-mouth", "clip:attack", size=44, at=0.45)],
        "imp": [pfx("rvx-monster-curse-cloud", "socket-hands", "clip:attack", size=24, at=0.45)],
        "lich": [pfx("rvx-monster-soul-burst", "socket-chest", "clip:death", size=54, at=0.85)],
        "scarecrow-fiend": [pfx("rvx-monster-rot-poof", "socket-chest", "clip:death", size=40, at=0.85)],
        "phantom-knight": [pfx("rvx-monster-silver-slash", "socket-hands", "clip:attack", size=40, at=0.4)],
    }
    sockets = [Socket("socket-chest", at=(0, shoulder - 2, -2), parent="body"),
               Socket("socket-mouth", at=(0, head_lo + 5, -5), parent="head"),
               Socket("socket-hands", at=(0, shoulder - 8, -10), parent="body")]
    return world(slug, "creatures", name, root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                 sockets=sockets, pfx=effect[slug])


def _bone_hound():
    slug = "bone-hound"
    w, h, d = 48, 30, 64
    cx, cz = w / 2, d / 2
    torso, head, legs, tail = [Grid(w, h, d) for _ in range(4)]
    X, Y, Z = coords(torso)
    _box(torso,cx-2,18,14,cx+2,21,52,"bone",6)
    for zz in (18,24,30,36,42,48):
        for sign in (-1,1):
            torso.line((cx,19,zz),(cx+sign*10,18,zz),1.2,C("bone",5))
            torso.line((cx+sign*10,18,zz),(cx+sign*11,11,zz),1.2,C("bone",5))
            torso.line((cx+sign*11,11,zz),(cx+sign*3,9,zz),1.2,C("bone",5))
    _box(torso,cx-2,8,17,cx+2,10,47,"bone",4)
    for zz in (17,47):_box(torso,cx-12,14,zz,cx+12,17,zz+4,"bone",5)
    _box(head, cx - 7, 13, 5, cx + 7, 25, 18, "bone", 6)
    _box(head, cx - 8, 10, 7, cx + 8, 14, 19, "bone", 5)
    P.flat(head, (head.a > 0) & (Z == 5) & (Y > 17) & (Y < 22) & ((X < cx - 3) | (X > cx + 3)), "purple", 1)
    P.flat(head, (head.a > 0) & (Z == 5) & (Y > 14) & (Y < 16) & (np.abs(X - cx) < 4), "gray", 1)
    for s in (-1, 1):
        head.prism("z", [(cx + s * 6, 22), (cx + s * 3, 22), (cx + s * 5, 28)], 9, 13, C("bone", 6))
    # Four thick, jointed legs use raised dog elbows and wide paws.
    leg_ranges = ((cx - 13, 17), (cx + 7, 17), (cx - 13, 47), (cx + 7, 47))
    for x0, z0 in leg_ranges:
        limb(legs, "z", (x0 + 3, 16), (x0 + 1, 7), 2.8, 2.0, z0, z0 + 5, "bone", 5)
        _box(legs, x0, 3, z0 - 1, x0 + 7, 7, z0 + 7, "gray", 5)
        for x in (x0 + 1, x0 + 4):
            legs.prism("z", [(x, 4), (x + 2, 4), (x + 1, 1)], z0 - 2, z0 + 1, C("bone", 6))
    S.bar(tail, "x", (17, 47), (7, 60), 2.0, cx - 2, cx + 2, "bone", 5)
    joints = [("body", None, (cx, 0, cz)), ("head", "body", (cx, 14, 12)),
              ("legs", "body", (cx, 9, 31)), ("tail", "body", (cx, 16, 48))]
    root = assemble({"body": torso, "head": head, "legs": legs, "tail": tail}, joints)
    idle = {"body": {"loc": keys((0, (0, 0, 0)), (0.65, (0, 0.6, 0)), (1.3, (0, 0, 0)))},
            "tail": {"rot": keys((0, (0, 0, 0)), (0.65, (0, 0, 7)), (1.3, (0, 0, 0)))}}
    attack = {"head": {"loc": keys((0, (0, 0, 0)), (0.25, (0, 0, -6)), (0.5, (0, 0, 1)), (0.8, (0, 0, 0)))},
              "legs": {"rot": keys((0, (0, 0, 0)), (0.25, (0, 8, 0)), (0.55, (0, -5, 0)), (0.8, (0, 0, 0)))}}
    hit = {"body": {"loc": keys((0, (0, 0, 0)), (0.1, (0, 1, 2)), (0.5, (0, 0, 0)))}}
    death = {"body": {"rot": keys((0, (0, 0, 0)), (0.4, (0, 0, 40)), (0.85, (0, 0, 80))),
                      "loc": keys((0, (0, 0, 0)), (0.85, (0, -5, 0)))}}
    return world(slug, "creatures", "Bone Hound", root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                 sockets=[Socket("socket-fangs", at=(0, 18, -9), parent="head")],
                 pfx=[pfx("rvx-monster-claw-slash", "socket-fangs", "clip:attack", size=30, at=0.35)])


def _new_creature(slug):
    specs = {
        "patchwork-giant": ((56, 64, 40), "Patchwork Giant"),
        "swamp-creature": ((52, 58, 42), "Swamp Creature"),
        "imp": ((30, 34, 28), "Imp"),
        "lich": ((34, 44, 32), "Lich"),
        "scarecrow-fiend": ((40, 44, 30), "Scarecrow Fiend"),
        "phantom-knight": ((38, 44, 32), "Phantom Knight"),
    }
    if slug == "bone-hound":
        return _bone_hound()
    dims, name = specs[slug]
    return _humanoid_creature(slug, dims, name)


def _train_engine():
    slug = "ghost-train-engine"
    w, h, d = 56, 78, 128
    cx = w / 2
    body = Grid(w, h, d)
    X, Y, Z = coords(body)
    wheel_parts = {}
    joints = [("body", None, (cx, 0, d / 2))]
    for side, x0 in (("left", 5), ("right", 48)):
        for label, zc, radius in (("front", 41, 12), ("rear", 82, 12)):
            name = f"wheel-{side}-{label}"
            g = Grid(w, h, d)
            for i in range(12):
                a=i*math.tau/12;b=(i+1)*math.tau/12
                pts=[(17+math.cos(a)*radius,zc+math.sin(a)*radius),
                     (17+math.cos(b)*radius,zc+math.sin(b)*radius),
                     (17+math.cos(b)*(radius-2),zc+math.sin(b)*(radius-2)),
                     (17+math.cos(a)*(radius-2),zc+math.sin(a)*(radius-2))]
                g.prism("x",pts,x0,x0+3,C("iron",5))
            for i in range(6):
                a=i*math.tau/6
                S.bar(g,"x",(17,zc),(17+math.cos(a)*(radius-1),zc+math.sin(a)*(radius-1)),2,x0,x0+3,"bone",5)
            S.disc(g,"x",17,zc,3,x0-1,x0+4,"purple",4,n=8)
            S.disc(g,"x",17,zc,1.6,x0-2,x0+5,"gold",5,n=6)
            wheel_parts[name] = g
            joints.append((name, "body", ((x0 + 1.5), 17, zc)))

    body.prism("z", [(8, 23), (48, 23), (40, 31), (16, 31)], 19, 111, C("iron", 6))
    chassis = last(body)
    P.plates(body, chassis, "iron", 6, size=(8, 6), seed=2)
    body.prism("z", [(12, 31), (44, 31), (40, 37), (16, 37)], 23, 107, C("wood", 5))
    # The boiler is a long horizontal cylinder. Brass rings break the tube.
    body.cylinder("z", cx, 46, 13, 31, 94, C("gray", 5))
    body.cylinder("z", cx, 46, 11, 30, 95, C("gray", 4))
    for z in (35, 45, 83, 92):
        body.cylinder("z", cx, 46, 14, z, z + 2, C("gold", 4))
    _box(body, 18, 32, 93, 38, 38, 119, "purple", 4)
    for xx in (18,35):
        for zz in (93,116):_box(body,xx,38,zz,xx+3,65,zz+3,"darkwood",5)
    _box(body,18,38,94,21,47,117,"purple",4)
    _box(body,35,38,94,38,47,117,"purple",4)
    _box(body,21,38,116,35,43,119,"purple",4)
    for xx in (18,35):_box(body,xx,59,94,xx+3,62,117,"gold",4)
    _box(body,23,38,105,33,42,114,"wood",5)
    _box(body,22,38,95,34,50,98,"iron",4)
    S.disc(body,"z",28,46,3,98,100,"bone",5,n=8)
    _box(body,27,45,100,29,48,101,"iron",2)
    body.prism("z",[(16,62),(40,62),(36,70),(20,70)],90,121,C("purple",5))
    for x in (21, 31):
        _box(body, x, 45, 90, x + 3, 57, 92, "toxic", 6)
        _box(body, x, 43, 89, x + 3, 45, 92, "gold", 4)
    _box(body, 21, 36, 26, 35, 49, 31, "purple", 3)
    P.flat(body, (body.a > 0) & (Z == 26) & (Y >= 39) & (Y <= 46) & (X >= 23) & (X <= 33), "toxic", 6)
    body.cylinder("z", cx, 65, 4, 30, 39, C("iron", 5))
    _box(body, 22, 65, 29, 34, 70, 39, "gray", 5)
    S.spire(body, cx, 34, 69, 6, 8, "gray", 5)
    # A pointed snowplough and a broad front buffer make the engine face clear.
    body.prism("z", [(9, 26), (47, 26), (44, 32), (12, 32)], 16, 21, C("iron", 5))
    body.prism("z", [(4, 16), (52, 16), (42, 36), (14, 36)], 8, 22, C("gray", 5))
    P.flat(body, (body.a > 0) & (Z < 17) & (Y > 22) & (X >= 12) & (X <= 44), "purple", 4)
    for side in (8, 45):
        _box(body, side, 21, 16, side + 3, 25, 20, "gold", 5)
    # Coupling rods join the paired drive wheels on each side.
    for x0 in (3, 51):
        _box(body, x0, 16, 41, x0 + 3, 18, 83, "iron", 4)
        _box(body, x0 - 1, 15, 39, x0 + 4, 19, 43, "gold", 4)
        _box(body, x0 - 1, 15, 81, x0 + 4, 19, 85, "gold", 4)
    joints.extend([])
    grids = {"body": body, **wheel_parts}
    move = {name: {"rot": keys((0, (0, 0, 0)), (2, (360, 0, 0)))}
            for name in wheel_parts}
    move["body"] = {"loc": keys((0, (0, 0, 0)), (0.8, (0, 0.5, 0)), (1.6, (0, 0, 0)), (2.4, (0, -0.5, 0)), (3.2, (0, 0, 0)))}
    idle = {"body": {"loc": keys((0, (0, 0, 0)), (1.2, (0, 0.35, 0)), (2.4, (0, 0, 0)))}}
    root = assemble(grids, joints)
    return world(slug, "vehicles", "Ghost Train Engine", root,
                 clips=[Clip("move", move), Clip("idle", idle)],
                 sockets=[Socket("socket-stack", at=(0, 72, -30), parent="body"),
                          Socket("socket-wake", at=(0, 18, 45), parent="body")],
                 pfx=[pfx("rvx-monster-ghost-smoke", "socket-stack", "clip:move", size=32, at=0.42),
                      pfx("rvx-monster-ghost-wake", "socket-wake", "clip:move", size=46, at=0.18)])


def _skeleton_rowboat():
    slug = "skeleton-rowboat"
    w, h, d = 52, 42, 84
    cx = w / 2
    body, left, right = Grid(w, h, d), Grid(w, h, d), Grid(w, h, d)
    # The pointed, open hull has a raised gunwale and a dark interior.
    hull = [(cx - 2, 4), (cx + 2, 4), (cx + 18, 15), (cx + 22, 38),
            (cx + 16, 69), (cx + 6, 80), (cx - 6, 80), (cx - 16, 69),
            (cx - 22, 38), (cx - 18, 15)]
    body.prism("y",hull,4,7,C("wood",5))
    inner=[(cx+(x-cx)*.81,42+(z-42)*.89) for x,z in hull]
    for i,a in enumerate(hull):
        b=hull[(i+1)%len(hull)];c=inner[(i+1)%len(hull)];e=inner[i]
        body.prism("y",[a,b,c,e],7,18,C("wood",5))
        P.planks(body,last(body),"wood",5,width=3,across="z",nails=True,seed=i)
    for zz in (28,52):
        _wood(body,(cx-17,15,zz,cx+17,18,zz+5),5,zz,width=4,ramp="wood")
    _box(body,cx-2,7,13,cx+2,10,73,"bone",5)
    # Bone ribs rise from the keel to the gunwales. The skull prow is oversized.
    for z in (17, 28, 40, 52, 64):
        for s in (-1, 1):
            S.bar(body, "z", (cx + s * 2, 7), (cx + s * 15, 16), 1.5, z, z + 2, "bone", 5)
    _box(body, cx - 3, 17, 9, cx + 3, 22, 16, "bone", 6)
    S.skull(body, cx, 15, 10, s=12, eyes=("toxic", 6), socket=("purple", 1), seed=2)
    for x in (cx - 17, cx + 13):
        _box(body, x, 17, 36, x + 4, 20, 40, "gray", 5)
    # Each oar has a thick shaft, a broad blade and a bone rowlock.
    for g, sign in ((left, -1), (right, 1)):
        px = cx + sign * 12
        S.bar(g, "z", (px, 24), (px + sign * 10, 27), 1.7, 36, 39, "wood", 5)
        g.prism("z", [(px + sign * 7, 27), (px + sign * 10, 29),
                       (px + sign * 13, 25), (px + sign * 11, 22)], 35, 40, C("bone", 5))
        P.flat(g, last(g), "bone", 6)
        _box(body, px - 2, 16, 34, px + 3, 25, 36, "bone", 6)
        _box(body, px - 2, 16, 39, px + 3, 25, 41, "bone", 6)
    joints = [("body", None, (cx, 0, d / 2)),
              ("oar-left", "body", (cx - 12, 24, 37)),
              ("oar-right", "body", (cx + 12, 24, 37))]
    root = assemble({"body": body, "oar-left": left, "oar-right": right}, joints)
    row = {
        "oar-left": {"rot": keys((0, (0, 0, 0)), (0.6, (0, -18, 0)), (1.2, (0, 0, 0)), (1.8, (0, 18, 0)), (2.4, (0, 0, 0)))},
        "oar-right": {"rot": keys((0, (0, 0, 0)), (0.6, (0, 18, 0)), (1.2, (0, 0, 0)), (1.8, (0, -18, 0)), (2.4, (0, 0, 0)))},
        "body": {"loc": keys((0, (0, 0, 0)), (0.6, (0, 0.6, 0)), (1.2, (0, 0, 0)), (1.8, (0, -0.3, 0)), (2.4, (0, 0, 0)))},
    }
    idle = {"body": {"loc": keys((0, (0, 0, 0)), (1.5, (0, 0.7, 0)), (3, (0, 0, 0)))}}
    return world(slug, "vehicles", "Skeleton Rowboat", root,
                 clips=[Clip("move", row), Clip("idle", idle)],
                 sockets=[Socket("socket-wake", at=(0, 4, 32), parent="body")],
                 pfx=[pfx("rvx-monster-ghost-wake", "socket-wake", "clip:move", size=30, at=0.15)])


def _bat_glider():
    slug = "bat-glider"
    w, h, d = 92, 58, 68
    cx, cz = w / 2, d / 2
    body, wing_l, wing_r = Grid(w, h, d), Grid(w, h, d), Grid(w, h, d)
    _wood(body,(cx-9,18,cz-17,cx+9,21,cz+23),5,5,width=4,ramp="wood")
    for xx in (cx-10,cx+8):
        _wood(body,(xx,21,cz-14,xx+2,26,cz+21),5,3,width=5,ramp="darkwood")
        S.bar(body,"x",(21,cz+14),(40,24),1.5,xx,xx+2,"iron",4)
    _box(body,cx-7,21,cz+8,cx+7,25,cz+18,"purple",5)
    _box(body,cx-7,25,cz+16,cx+7,37,cz+19,"purple",4)
    S.bar(body,"x",(21,cz-9),(32,cz-13),1.5,cx-2,cx+2,"iron",4)
    _box(body,cx-7,31,cz-15,cx+7,33,cz-12,"wood",5)
    _box(body,cx-4,21,cz-22,cx+4,37,cz-17,"darkwood",5)
    _box(body, cx - 10, 36, cz - 28, cx + 10, 46, cz - 14, "purple", 5)
    eyes(body, "-z", cz - 28, int(cx - 5), 37, 2, size=2, glow=("toxic", 6), rim=("gray", 1), depth=3)
    body.prism("z", [(cx - 4, 38), (cx + 4, 38), (cx, 32)], cz - 30, cz - 23, C("bone", 6))
    for sign in (-1, 1):
        g = wing_l if sign < 0 else wing_r
        # Wide membrane panels have a scalloped outer edge and thick struts.
        if sign < 0:
            pts = [(cx, 40), (cx - 7, 48), (cx - 20, 45), (cx - 32, 48),
                   (cx - 43, 39), (cx - 35, 37), (cx - 27, 41), (cx - 19, 37), (cx - 10, 41)]
        else:
            pts = [(cx, 40), (cx + 7, 48), (cx + 20, 45), (cx + 32, 48),
                   (cx + 43, 39), (cx + 35, 37), (cx + 27, 41), (cx + 19, 37), (cx + 10, 41)]
        g.prism("z", pts, 22, 26, C("purple", 4))
        membrane = last(g)
        P.flat(g, membrane & (((coords(g)[0].astype(int) // 6) % 2) == 0), "purple", 5)
        for endx, endy in ((cx + sign * 41, 39), (cx + sign * 29, 43), (cx + sign * 17, 42)):
            S.bar(g, "z", (cx, 40), (endx, endy), 1.5, 23, 25, "bone", 5)
        S.bar(g, "z", (cx, 40), (cx + sign * 7, 48), 2.0, 21, 27, "gray", 5)
    root = assemble({"body": body, "wing-left": wing_l, "wing-right": wing_r},
                    [("body", None, (cx, 0, cz)),
                     ("wing-left", "body", (cx, 40, 24)),
                     ("wing-right", "body", (cx, 40, 24))])
    flap = {"wing-left": {"rot": keys((0, (0, 0, 0)), (0.45, (0, 0, 18)), (0.9, (0, 0, 0)), (1.35, (0, 0, -18)), (1.8, (0, 0, 0)))},
            "wing-right": {"rot": keys((0, (0, 0, 0)), (0.45, (0, 0, -18)), (0.9, (0, 0, 0)), (1.35, (0, 0, 18)), (1.8, (0, 0, 0)))},
            "body": {"loc": keys((0, (0, 0, 0)), (0.9, (0, 1, 0)), (1.8, (0, 0, 0)))}}
    idle = {"body": {"loc": keys((0, (0, 0, 0)), (1, (0, 0.6, 0)), (2, (0, 0, 0)))}}
    return world(slug, "vehicles", "Bat Glider", root,
                 clips=[Clip("move", flap), Clip("idle", idle)],
                 sockets=[Socket("socket-wings", at=(0, 40, 0), parent="body")],
                 pfx=[pfx("rvx-monster-ghost-wisps", "socket-wings", "clip:move", size=40, at=0.5)])


def _steam_crawler():
    slug = "steam-crawler"
    w, h, d = 76, 62, 100
    cx = w / 2
    body = Grid(w, h, d)
    X, Y, Z = coords(body)
    running = {}
    joints = [("body", None, (cx, 0, d / 2))]
    for side, x0 in (("left", 5), ("right", 68)):
        for label, zc in (("front", 25), ("middle", 50), ("rear", 75)):
            name = f"roller-{side}-{label}"
            g = Grid(w, h, d)
            radius = 13 if label != "middle" else 9
            cy = 17
            pts = [(cy - radius * 0.4, zc - radius), (cy + radius * 0.4, zc - radius),
                   (cy + radius, zc - radius * 0.4), (cy + radius, zc + radius * 0.4),
                   (cy + radius * 0.4, zc + radius), (cy - radius * 0.4, zc + radius),
                   (cy - radius, zc + radius * 0.4), (cy - radius, zc - radius * 0.4)]
            g.prism("x", pts, x0, x0 + 3, C("iron", 5))
            wheel = last(g)
            Xw, Yw, Zw = coords(g)
            face_mask = wheel & ((Xw == x0) | (Xw == x0 + 2))
            hub = face_mask & (np.abs(Yw - cy) <= radius * 0.28) & (np.abs(Zw - zc) <= radius * 0.28)
            spokes = face_mask & (np.abs(Yw - cy) <= 1.1) & (np.abs(Zw - zc) <= radius * 0.8)
            spokes |= face_mask & (np.abs(Zw - zc) <= 1.1) & (np.abs(Yw - cy) <= radius * 0.8)
            P.flat(g, face_mask, "iron", 6)
            P.flat(g, spokes, "gold", 5)
            P.flat(g, hub, "purple", 5)
            running[name] = g
            joints.append((name, "body", (x0 + 1.5, 17, zc)))
    # A continuous armored track frame sits over the six exposed rollers.
    for x0 in (4, 67):
        _box(body, x0+2, 10, 13, x0+4, 26, 17, "iron", 4)
        _box(body, x0+2, 10, 84, x0+4, 26, 88, "iron", 4)
        _box(body, x0 - 1, 7, 14, x0 + 6, 11, 87, "iron", 6)
        _box(body, x0 - 1, 25, 14, x0 + 6, 29, 87, "iron", 6)
        for z in range(19, 84, 8):
            _box(body, x0 - 1, 10, z, x0 + 6, 13, z + 3, "gray", 5)
    body.prism("z", [(11, 23), (65, 23), (59, 32), (17, 32)], 19, 83, C("darkwood", 5))
    chassis = last(body)
    P.plates(body, chassis, "iron", 6, size=(7, 6), seed=8)
    panel=_box(body,17,30,30,59,49,72,"purple",4)
    P.plates(body,panel,"purple",4,size=(10,8),seed=4)
    for xx in (16,59):
        for zz in (34,59):
            _box(body,xx,35,zz,xx+1,45,zz+9,"iron",2)
            for z0 in range(zz+1,zz+9,3):_box(body,xx,36,z0,xx+1,44,z0+1,"gold",5)
    for xx in (21,55):
        body.line((xx,31,28),(xx,51,28),1.8,C("gold",4))
        body.line((xx,51,28),(38,51,40),1.8,C("gold",4))
    _box(body, 20, 33, 26, 56, 42, 76, "purple", 4)
    P.flat(body, (body.a > 0) & (Z == 26) & (Y >= 35) & (Y <= 40) & (X >= 22) & (X <= 54), "toxic", 5)
    body.cylinder("z", cx, 43, 12, 37, 78, C("gray", 5))
    for z in (39, 72, 79):
        body.cylinder("z", cx, 43, 13, z, z + 2, C("gold", 4))
    _box(body, 29, 42, 40, 47, 53, 52, "toxic", 5)
    body.cylinder("z", cx, 52, 4, 32, 38, C("iron", 5))
    _box(body, cx - 6, 52, 30, cx + 6, 57, 39, "gray", 4)
    S.spire(body, cx, 36, 55, 6, 6, "iron", 4)
    _box(body, cx - 23, 32, 16, cx - 17, 35, 25, "gold", 5)
    _box(body, cx + 17, 32, 16, cx + 23, 35, 25, "gold", 5)
    grids = {"body": body, **running}
    root = assemble(grids, joints)
    move = {name: {"rot": keys((0, (0, 0, 0)), (2, (360, 0, 0)))} for name in running}
    move["body"] = {"loc": keys((0, (0, 0, 0)), (0.6, (0, 0.5, 0)), (1.2, (0, 0, 0)), (1.8, (0, -0.3, 0)), (2.4, (0, 0, 0)))}
    idle = {"body": {"loc": keys((0, (0, 0, 0)), (1.2, (0, 0.4, 0)), (2.4, (0, 0, 0)))}}
    return world(slug, "vehicles", "Steam Crawler", root,
                 clips=[Clip("move", move), Clip("idle", idle)],
                 sockets=[Socket("socket-stack", at=(0, 58, -27), parent="body")],
                 pfx=[pfx("rvx-monster-ghost-smoke", "socket-stack", "clip:move", size=28, at=0.35)])


def _wolf_sled():
    slug = "wolf-sled"
    w, h, d = 58, 50, 82
    cx = w / 2
    sled, left, right = Grid(w, h, d), Grid(w, h, d), Grid(w, h, d)
    for x0 in (7, 47):
        # Curved runners lift to a hooked nose at the front (-Z).
        sled.prism("x", [(2, 8), (4, 18), (2, 34), (0, 58), (8, 58), (9, 48), (8, 20)], x0, x0 + 4, C("wood", 6))
        P.planks(sled, last(sled), "wood", 6, width=3, across="y", nails=True, seed=x0)
        _box(sled, x0 - 1, 9, 31, x0 + 5, 12, 70, "iron", 4)
    deck = _box(sled, 10, 16, 30, 48, 22, 68, "wood", 6)
    P.planks(sled, deck, "wood", 6, width=4, across="z", nails=True, seed=4)
    _box(sled, 15, 22, 38, 43, 25, 59, "purple", 4)
    _wood(sled,(14,25,58,44,38,62),5,7,width=5,ramp="wood")
    for xx in (12,44):
        _wood(sled,(xx,22,38,xx+3,32,60),5,3,width=4,ramp="darkwood")
        S.bar(sled,"x",(22,64),(42,71),1.5,xx,xx+3,"wood",5)
        sled.line((xx,19,34),(xx,20,23),1.5,C("darkwood",5))
    _box(sled,12,40,69,47,43,73,"wood",5)
    _box(sled,8,12,32,50,17,36,"darkwood",5)
    _box(sled,8,12,61,50,17,65,"darkwood",5)
    for xx in (16,42):
        sled.line((xx,20,26),(xx,21,37),1,C("gold",4))
    # Twin harnessed wolves have broad shoulders, upright ears and clear muzzles.
    for g, wx in ((left, 16), (right, 42)):
        _box(g, wx - 6, 10, 9, wx + 6, 20, 32, "gray", 5)
        _box(g, wx - 8, 15, 8, wx + 8, 23, 21, "gray", 6)
        P.flat(g, (g.a > 0) & (np.abs(coords(g)[0] - wx) < 3) & (coords(g)[1] > 17) & (coords(g)[1] < 22), "bone", 5)
        _box(g, wx - 5, 19, 5, wx + 5, 27, 15, "gray", 5)
        _box(g, wx - 4, 20, 3, wx + 4, 24, 7, "bone", 6)
        _box(g, wx - 7, 25, 10, wx - 5, 30, 12, "gray", 5)
        _box(g, wx + 5, 25, 10, wx + 7, 30, 12, "gray", 5)
        for sx in (-1, 1):
            _box(g, wx + sx * 4 - 1, 8, 23, wx + sx * 4 + 1, 14, 27, "gray", 4)
            _box(g, wx + sx * 4 - 1, 8, 13, wx + sx * 4 + 1, 14, 17, "gray", 4)
            _box(g, wx + sx * 4 - 1, 6, 22, wx + sx * 4 + 1, 9, 28, "bone", 6)
            _box(g, wx + sx * 4 - 1, 6, 12, wx + sx * 4 + 1, 9, 18, "bone", 6)
        _box(g, wx - 8, 17, 20, wx + 8, 20, 26, "darkwood", 4)
        _box(g, wx - 8, 18, 20, wx + 8, 22, 23, "purple", 4)
    joints = [("sled", None, (cx, 0, d / 2)),
              ("wolf-left", "sled", (16, 10, 20)),
              ("wolf-right", "sled", (42, 10, 20))]
    root = assemble({"sled": sled, "wolf-left": left, "wolf-right": right}, joints)
    move = {"wolf-left": {"loc": keys((0, (0, 0, 0)), (0.35, (0, 0.8, 0)), (0.7, (0, 0, 0)), (1.05, (0, -0.5, 0)), (1.4, (0, 0, 0)))},
            "wolf-right": {"loc": keys((0, (0, 0, 0)), (0.35, (0, -0.5, 0)), (0.7, (0, 0, 0)), (1.05, (0, 0.8, 0)), (1.4, (0, 0, 0)))},
            "sled": {"loc": keys((0, (0, 0, 0)), (0.7, (0, 0.7, 0)), (1.4, (0, 0, 0)))}}
    idle = {"sled": {"loc": keys((0, (0, 0, 0)), (1.3, (0, 0.4, 0)), (2.6, (0, 0, 0)))}}
    return world(slug, "vehicles", "Wolf Sled", root,
                 clips=[Clip("move", move), Clip("idle", idle)],
                 sockets=[Socket("socket-harness", at=(0, 14, -10), parent="sled")],
                 pfx=[pfx("rvx-monster-ghost-wisps", "socket-harness", "clip:move", size=22, at=0.55)])


def _new_vehicle(slug):
    builders = {
        "ghost-train-engine": _train_engine,
        "skeleton-rowboat": _skeleton_rowboat,
        "bat-glider": _bat_glider,
        "steam-crawler": _steam_crawler,
        "wolf-sled": _wolf_sled,
    }
    try:
        return builders[slug]()
    except KeyError as exc:
        raise KeyError(f"unknown monster vehicle: {slug}") from exc


# The art-director repair rebuilds these models. Each group has its own
# module, so the repair of one group does not touch the code of another.
REPAIRED = {
    ("buildings", "haunted-lighthouse"): "_rep_buildings",
    ("buildings", "mad-lab-tower"): "_rep_buildings",
    ("buildings", "vampire-castle-tower"): "_rep_buildings",
    ("buildings", "cursed-library"): "_rep_buildings",
    ("buildings", "haunted-schoolhouse"): "_rep_buildings",
    ("buildings", "hunters-lodge"): "_rep_buildings",
    ("creatures", "imp"): "_rep_creatures",
    ("creatures", "lich"): "_rep_creatures",
    ("creatures", "phantom-knight"): "_rep_creatures",
    ("creatures", "scarecrow-fiend"): "_rep_creatures",
    ("creatures", "swamp-creature"): "_rep_creatures",
    ("creatures", "patchwork-giant"): "_rep_creatures",
    ("creatures", "bone-hound"): "_rep_creatures",
    ("vehicles", "wolf-sled"): "_rep_vehicles",
    ("vehicles", "bat-glider"): "_rep_vehicles",
    ("vehicles", "skeleton-rowboat"): "_rep_vehicles",
    ("terrain-nature", "tar-pit"): "_rep_nature",
    ("terrain-nature", "ectoplasm-pool"): "_rep_nature",
    ("terrain-nature", "crooked-path"): "_rep_nature",
    ("terrain-nature", "web-thicket"): "_rep_nature",
    ("terrain-nature", "cliff-crags"): "_rep_nature",
    ("terrain-nature", "gnarled-roots"): "_rep_nature",
    # Originals in the monster terrain-rework list (rvx-gate/terrain-rework.json).
    ("terrain-nature", "dungeon-floor"): "_rep_nature",
    ("terrain-nature", "iron-fence"): "_rep_nature",
    ("props", "brain-jar"): "_rep_props",
    ("props", "eyeball-jar"): "_rep_props",
    ("props", "werewolf-trap"): "_rep_props",
    ("props", "mortuary-slab"): "_rep_props",
    ("props", "spell-scroll-pile"): "_rep_props",
    ("props", "spider-egg-sac"): "_rep_props",
    ("props", "cracked-statue"): "_rep_props",
    ("props", "broken-wagon-wheel"): "_rep_props",
    ("props", "garlic-wreath-post"): "_rep_anim",
    ("animated-props", "jack-in-the-box"): "_rep_anim",
    ("animated-props", "music-box"): "_rep_anim",
    ("animated-props", "blood-fountain"): "_rep_anim",
    ("animated-props", "bat-roost"): "_rep_anim",
    ("animated-props", "lab-generator"): "_rep_anim",
    ("animated-props", "ouija-table"): "_rep_anim",
    ("animated-props", "rising-grave"): "_rep_anim",
    ("animated-props", "swinging-lantern"): "_rep_anim",
}


def build_world(category, slug):
    module = REPAIRED.get((category, slug))
    if module is not None:
        import importlib
        return importlib.import_module(module).build(category, slug)
    return legacy_world(category, slug)


def legacy_world(category, slug):
    """Build a model with the code from before the art-director repair."""
    if category == "props":
        if slug == "garlic-wreath-post":
            return _garlic_wreath_post()
        from _double_props import build
        return build(slug)
    if category == "animated-props":
        return _new_animated(slug)
    if category == "buildings":
        return _new_building(slug)
    if category == "terrain-nature":
        from _double_nature import build
        return build(slug)
    if category == "creatures":
        return _new_creature(slug)
    if category == "vehicles":
        return _new_vehicle(slug)
    raise KeyError(f"unknown monster category: {category}")
