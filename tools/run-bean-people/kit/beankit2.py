"""Bean kit, round 2: wider exploration of bodies, faces, limbs and feet.

Builds on beankit.py (body lathe, screen, materials, stage) and adds
    face kinds   screen, dots, googly, lids, cyclops, stalks, goggles, grin, kawaii, leds, button
    arm kinds    stub, noodle, float, trex, flipper, long, beads, none
    feet kinds   stub, shoes, bird, float, blob, wheel, clown, peg
    more bodies  a gumdrop family (tall gumdrop, kiss, bell, teardrop, lean) and oddballs

    Blender -b --factory-startup --python beankit2.py -- <out dir> <sheet>:<index> ...

Sheets: weird (16), faces (11), limbs (8), gumdrops (8). Each index renders
one card; combine them with ImageMagick.
"""
import math
import os
import sys

_here = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(_here, "beankit.py")).read()
exec(compile(_src[: _src.rindex("\nmain()")], "beankit.py", "exec"))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

GD = dict(d=0.88, n=2.0, split=0.35, arm=(0.5, 0.3, 0.075, 0.11), leg=(0.2, 0.1, 0.24), foot=(0.15, 0.2, 0.09))
BODIES.update({
    "gumdrop-tall": dict(GD, h=1.75, w=[0.62, 0.58, 0.47, 0.36, 0.27], cb=0.14, ct=0.3, screen=(0.64, 0.24)),
    "kiss": dict(GD, h=1.5, w=[0.62, 0.56, 0.42, 0.24, 0.07], d=0.92, cb=0.12, ct=0.1, split=0.3, screen=(0.48, 0.23)),
    "bell": dict(GD, h=1.5, w=[0.68, 0.5, 0.41, 0.38, 0.37], d=0.9, cb=0.06, ct=0.36, split=0.3, screen=(0.66, 0.24)),
    "teardrop": dict(GD, h=1.6, w=[0.36, 0.55, 0.52, 0.36, 0.13], cb=0.3, ct=0.1, split=0.4, screen=(0.5, 0.25)),
    "sausage": dict(GD, h=2.0, w=[0.3, 0.31, 0.31, 0.3], cb=0.3, ct=0.3, split=0.45, screen=(0.8, 0.19)),
    "pancake": dict(GD, h=0.72, w=[0.76, 0.79, 0.74], d=0.8, cb=0.22, ct=0.32, split=0.4, screen=(0.55, 0.28)),
    "egg-up": dict(GD, h=1.5, w=[0.36, 0.5, 0.6, 0.6, 0.52], cb=0.3, ct=0.5, split=0.4, screen=(0.68, 0.28)),
    "lean-drop": dict(GD, h=1.75, w=[0.6, 0.57, 0.46, 0.35, 0.26], cb=0.14, ct=0.3, bend=0.3, screen=(0.64, 0.23)),
    "pawn": dict(GD, h=1.6, w=[0.54, 0.44, 0.26, 0.23, 0.36, 0.38, 0.3], cb=0.1, ct=0.36, split=0.3,
                 screen=(0.8, 0.22)),
    "squash": dict(GD, h=1.3, w=[0.48, 0.62, 0.55, 0.32, 0.1], noise=0.035, seed=5, bend=0.12, cb=0.3, ct=0.15,
                   split=0.4, screen=(0.55, 0.25)),
})

FEET_Z0 = {"stub": None, "shoes": 0.17, "bird": 0.62, "float": 0.32, "blob": -0.01, "wheel": 0.42, "clown": 0.24,
           "peg": 0.36}
EYE_WHITE = (0.98, 0.98, 0.97)
PUPIL = (0.08, 0.07, 0.1)
CHEEK = (1.0, 0.55, 0.62)


# --------------------------------------------------------------------------
# geometry helpers (all write into per-material bmeshes)
# --------------------------------------------------------------------------
class Parts:
    def __init__(self):
        self.bms = {}

    def __getitem__(self, k):
        if k not in self.bms:
            self.bms[k] = bmesh.new()
        return self.bms[k]


def _smooth(faces):
    for f in faces:
        f.smooth = True


def ell(bm, c, sc, normal=None, segs=28, rings=16, cut=None):
    """Ellipsoid at c, local -y turned to face `normal`. `cut` = (point, normal)
    keeps the side the normal points to (in world space)."""
    res = bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    vs = res["verts"]
    bmesh.ops.scale(bm, vec=sc, verts=vs)
    if normal is not None:
        q = Vector((0, -1, 0)).rotation_difference(Vector(normal).normalized())
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=q.to_matrix(), verts=vs)
    bmesh.ops.translate(bm, vec=Vector(c), verts=vs)
    faces = list({f for v in vs for f in v.link_faces})
    _smooth(faces)
    if cut:
        geom = list(set(vs) | {e for v in vs for e in v.link_edges} | set(faces))
        bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5, plane_co=cut[0], plane_no=Vector(cut[1]).normalized(),
                               clear_inner=True)


def bez(pts, n=16):
    """Sample a Bezier through control points (any degree)."""
    pts = [Vector(p) for p in pts]
    out = []
    for i in range(n + 1):
        t = i / n
        q = list(pts)
        while len(q) > 1:
            q = [a.lerp(b, t) for a, b in zip(q, q[1:])]
        out.append(q[0])
    return out


def sweep(bm, pts, radii, segs=16, closed=False, caps=True):
    pts = [Vector(p) for p in pts]
    if not isinstance(radii, (list, tuple)):
        radii = [radii] * len(pts)
    n = len(pts)
    tans = []
    for i in range(n):
        if closed:
            t = pts[(i + 1) % n] - pts[(i - 1) % n]
        else:
            t = pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]
        tans.append(t.normalized())
    up = Vector((0, 0, 1)) if abs(tans[0].z) < 0.9 else Vector((1, 0, 0))
    nrm = tans[0].cross(up).normalized()
    rings = []
    for i, p in enumerate(pts):
        t = tans[i]
        nrm = (nrm - t * nrm.dot(t)).normalized()
        b = t.cross(nrm)
        rings.append([bm.verts.new(p + (nrm * math.cos(2 * pi * j / segs) + b * math.sin(2 * pi * j / segs)) * radii[i])
                      for j in range(segs)])
    pairs = list(zip(rings, rings[1:])) + ([(rings[-1], rings[0])] if closed else [])
    faces = []
    for A, B in pairs:
        for j in range(segs):
            k = (j + 1) % segs
            faces.append(bm.faces.new((A[j], A[k], B[k], B[j])))
    _smooth(faces)
    if caps and not closed:
        ell(bm, pts[0], (radii[0],) * 3, segs=segs, rings=segs // 2)
        ell(bm, pts[-1], (radii[-1],) * 3, segs=segs, rings=segs // 2)


def ring_pts(c, r, axis, n=40):
    axis = Vector(axis).normalized()
    a = axis.orthogonal().normalized()
    b = axis.cross(a)
    return [Vector(c) + (a * math.cos(2 * pi * i / n) + b * math.sin(2 * pi * i / n)) * r for i in range(n)]


def on(body, x, z, off=0.0):
    loc, nor = body.front(x, z)
    if loc is None:
        return Vector((x, -0.3, z)), Vector((0, -1, 0))
    return loc + nor * off, nor


def top_point(body, x, y=0.0):
    hit = body.bvh.ray_cast(Vector((x, y, 20)), Vector((0, 0, -1)))
    return hit[0], hit[1]


def girdle(body, z, off=0.02, n=48):
    pts = []
    for i in range(n):
        a = 2 * pi * i / n
        d = Vector((math.cos(a), math.sin(a), 0))
        hit = body.bvh.ray_cast(Vector((0, 0, z)) + d * 5, -d)
        if hit[0] is not None:
            pts.append(hit[0] + hit[1] * off)
    return pts


# --------------------------------------------------------------------------
# faces
# --------------------------------------------------------------------------
def eye_pos(body):
    s = body.s
    ez = body.z0 + s["screen"][0] * s["h"]
    ex = s["screen"][1] * 0.52
    return ex, ez


def face_build(body, kind, P, mats, colours):
    ex, ez = eye_pos(body)
    if kind == "screen":
        build_screen(body, mats, None)  # parented later
        return
    if kind in ("dots", "button"):
        for s in (-1, 1):
            p, nr = on(body, s * ex, ez)
            if kind == "dots":
                ell(P["ink"], p, (0.06, 0.035, 0.09), nr)
                h, _ = on(body, s * ex - 0.02, ez + 0.035, 0.03)
                ell(P["shine"], h, (0.02, 0.012, 0.024), nr, segs=12, rings=8)
            else:
                ell(P["accent"], p + nr * 0.01, (0.085, 0.025, 0.085), nr)
                for dx, dz in ((-0.025, 0.025), (0.025, 0.025), (-0.025, -0.025), (0.025, -0.025)):
                    q, _ = on(body, s * ex + dx, ez + dz, 0.035)
                    ell(P["ink"], q, (0.014, 0.01, 0.014), nr, segs=10, rings=6)
        mz = ez - 0.2
        w = 0.1
        pts = [on(body, w * t, mz + 0.04 * t * t, 0.008)[0] for t in [i / 6 - 1 for i in range(13)]]
        sweep(P["ink"], pts, 0.016, segs=10)
        if kind == "button":
            for t in (-0.6, 0.0, 0.6):
                a, _ = on(body, w * t - 0.015, mz + 0.04 * t * t + 0.03, 0.01)
                b, _ = on(body, w * t + 0.015, mz + 0.04 * t * t - 0.03, 0.01)
                sweep(P["ink"], [a, b], 0.009, segs=8)
        for s in (-1, 1):
            p, nr = on(body, s * (ex + 0.1), ez - 0.11, -0.006)
            ell(P["cheek"], p, (0.06, 0.02, 0.04), nr)
    elif kind in ("googly", "lids", "cyclops"):
        eyes = [(0, 0.17)] if kind == "cyclops" else [(-ex, 0.12), (ex, 0.12)]
        for x, r in eyes:
            p, nr = on(body, x, ez + (0.03 if kind == "cyclops" else 0))
            c = p + nr * r * (0.55 if kind == "googly" else 0.35)
            ell(P["eyewhite"], c, (r, r, r), segs=32, rings=18)
            look = Vector((0.02 * (1 if x <= 0 else -1) * 0, -1, -0.05)).normalized()
            pc = c + (nr * 0.6 + look * 0.4).normalized() * r * 0.82
            ell(P["pupil"], pc, (r * 0.5, r * 0.25, r * 0.5), nr)
            ell(P["shine"], pc + nr * r * 0.12 + Vector((-r * 0.18, 0, r * 0.2)), (r * 0.14,) * 3, segs=12, rings=8)
            if kind in ("lids", "cyclops"):
                ell(P["body_top"], c, (r * 1.1,) * 3, segs=32, rings=18,
                    cut=(c + Vector((0, 0, r * 0.12)), Vector((0, -0.25, 1))))
        mz = ez - (0.24 if kind == "cyclops" else 0.2)
        pts = [on(body, 0.07 * t, mz + 0.025 * t * t, 0.008)[0] for t in [i / 4 - 1 for i in range(9)]]
        sweep(P["ink"], pts, 0.015, segs=10)
    elif kind == "stalks":
        for s in (-1, 1):
            base, _ = top_point(body, s * 0.08)
            if base is None:
                continue
            tip = base + Vector((s * 0.22, -0.05, 0.38))
            sweep(P["body_top"], bez([base - Vector((0, 0, 0.05)), base + Vector((0, 0, 0.25)), tip], 12),
                  [0.05 - 0.015 * i / 12 for i in range(13)], segs=14)
            c = tip + Vector((0, -0.04, 0.08))
            ell(P["eyewhite"], c, (0.11,) * 3, segs=28, rings=16)
            pc = c + Vector((0, -0.09, -0.01))
            ell(P["pupil"], pc, (0.055, 0.03, 0.055), Vector((0, -1, 0)))
            ell(P["shine"], pc + Vector((-0.02, -0.025, 0.02)), (0.015,) * 3, segs=10, rings=6)
        p, nr = on(body, 0, ez)
        ell(P["mouth"], p, (0.12, 0.05, 0.08), nr, cut=(p, (0, 0, -1)))
    elif kind == "goggles":
        strap = girdle(body, ez, 0.02)
        if len(strap) > 8:
            sweep(P["strap"], strap, 0.035, segs=10, closed=True)
        for s in (-1, 1):
            p, nr = on(body, s * ex, ez, 0.04)
            sweep(P["accent"], ring_pts(p, 0.13, nr, 40), 0.035, segs=12, closed=True)
            ell(P["eyewhite"], p - nr * 0.02, (0.115, 0.03, 0.115), nr)
            ell(P["pupil"], p + nr * 0.012, (0.05, 0.02, 0.05), nr)
            ell(P["glass"], p + nr * 0.03, (0.12, 0.02, 0.12), nr)
        mz = ez - 0.24
        pts = [on(body, 0.06 * t, mz + 0.02 * t * t, 0.008)[0] for t in [i / 4 - 1 for i in range(9)]]
        sweep(P["ink"], pts, 0.014, segs=10)
    elif kind == "grin":
        for s in (-1, 1):
            p, nr = on(body, s * ex * 0.9, ez + 0.06)
            ell(P["ink"], p, (0.045, 0.03, 0.06), nr)
        mz = ez - 0.1
        p, nr = on(body, 0, mz)
        w = min(body.radius((mz - body.z0) / body.s["h"]) * 0.75, 0.3)
        ell(P["mouth"], p, (w, 0.08, 0.16), nr, cut=(p + Vector((0, 0, 0.0)), (0, 0, -1)))
        for i in range(6):
            x = (i - 2.5) / 2.5 * w * 0.75
            q, nr2 = on(body, x, mz - 0.025, 0.0)
            ell(P["eyewhite"], q, (w * 0.12, 0.03, 0.04), nr2, segs=12, rings=8)
        q, nr2 = on(body, 0.0, mz - 0.11, -0.01)
        ell(P["tongue"], q, (w * 0.35, 0.04, 0.04), nr2)
    elif kind == "kawaii":
        for s in (-1, 1):
            pts = [on(body, s * ex + 0.065 * math.cos(a), ez - 0.02 + 0.05 * math.sin(a), 0.01)[0]
                   for a in [pi * i / 8 for i in range(9)]]
            sweep(P["ink"], pts, 0.018, segs=10)
            p, nr = on(body, s * (ex + 0.08), ez - 0.11, -0.006)
            ell(P["cheek"], p, (0.07, 0.02, 0.045), nr)
        mz = ez - 0.13
        pts = [on(body, 0.035 * t, mz - 0.02 * abs(math.sin(t * pi)), 0.008)[0] for t in [i / 4 - 1 for i in range(9)]]
        sweep(P["ink"], pts, 0.013, segs=10)
    elif kind == "leds":
        for s in (-1, 1):
            a, nr = on(body, s * ex, ez - 0.05, 0.035)
            b, _ = on(body, s * ex, ez + 0.05, 0.035)
            sweep(P["led"], [a, b], 0.035, segs=14)
        p, nr = on(body, 0, ez, 0.0)
        ell(P["visor"], p, (ex + 0.12, 0.03, 0.11), nr)


# --------------------------------------------------------------------------
# arms
# --------------------------------------------------------------------------
def hand(P, c, r, kind="mitt", d=Vector((0, 0, -1)), sgn=1):
    if kind == "ball":
        ell(P["hands"], c, (r, r, r))
        return
    ell(P["hands"], c, (r * 0.95, r * 0.8, r * 1.05))
    ell(P["hands"], c + Vector((-sgn * r * 0.55, -r * 0.45, r * 0.25)), (r * 0.42, r * 0.4, r * 0.5))


def arms_build(body, kind, P):
    s = body.s
    for sgn in (-1, 1):
        if kind == "none":
            return
        zf = {"trex": 0.6, "flipper": 0.5, "long": 0.62, "beads": 0.55}.get(kind, s["arm"][0])
        z = body.z0 + zf * s["h"]
        p, nr = body.side(sgn, z)
        if p is None:
            continue
        X = lambda v: Vector((sgn * v[0], v[1], v[2]))
        if kind == "stub":
            e = p + X((0.28, -0.05, -0.2))
            sweep(P["arms"], [p - X((0.06, 0, 0)), e], 0.08)
            hand(P, e + X((0.03, 0, -0.05)), 0.11, "ball")
        elif kind == "noodle":
            pts = bez([p - X((0.05, 0, 0)), p + X((0.25, 0, 0.1)), p + X((0.2, -0.1, -0.35)), p + X((0.42, -0.12, -0.5))], 20)
            sweep(P["arms"], pts, 0.045, segs=12)
            hand(P, pts[-1] + X((0.04, -0.02, -0.08)), 0.13, sgn=sgn)
        elif kind == "float":
            hand(P, p + X((0.22, -0.08, -0.22)), 0.12, sgn=sgn)
        elif kind == "trex":
            e = p + X((0.06, -0.16, -0.06))
            sweep(P["arms"], [p - X((0.04, 0, 0)), e], 0.05)
            hand(P, e + X((0.0, -0.05, -0.02)), 0.065, "ball")
        elif kind == "flipper":
            c = p + X((0.04, 0, -0.12))
            ell(P["arms"], c, (0.07, 0.16, 0.26), Vector((sgn * 0.95, -0.1, -0.3)))
        elif kind == "long":
            pts = bez([p - X((0.05, 0, 0)), p + X((0.22, 0, 0)), p + X((0.3, -0.05, -(z - 0.35)))], 18)
            sweep(P["arms"], pts, [0.06 - 0.02 * i / 18 for i in range(19)], segs=12)
            hand(P, pts[-1] + X((0.0, -0.02, -0.1)), 0.15, sgn=sgn)
        elif kind == "beads":
            q = p
            for i, r in enumerate((0.075, 0.068, 0.062, 0.056)):
                q = q + X((0.1, -0.02, -0.08))
                ell(P["arms"], q, (r, r, r))
            hand(P, q + X((0.08, -0.02, -0.08)), 0.1, "ball")


# --------------------------------------------------------------------------
# feet
# --------------------------------------------------------------------------
def feet_build(body, kind, P):
    s = body.s
    z0 = body.z0
    lx = s["leg"][2]
    for sgn in (-1, 1):
        x = sgn * lx
        if kind == "stub":
            llen, lr, _ = s["leg"]
            fr, fl, fh = s["foot"]
            sweep(P["legs"], [Vector((x, 0, z0 + 0.12)), Vector((x, -0.01, fh * 0.7))], lr)
            ell(P["feet"], (x * 1.05, -fl * 0.35, fh * 0.5), (fr, fl, fh * 0.5))
        elif kind == "shoes":
            fy = -max(body.radius(0.04) * s["d"] * 0.95 - 0.12, 0.08)
            c = Vector((x * 1.05, fy, 0.1))
            ell(P["feet"], c, (0.17, 0.27, 0.12), cut=(Vector((0, 0, 0.045)), (0, 0, 1)))
            ell(P["sole"], (c.x, c.y, 0.045), (0.18, 0.28, 0.045))
        elif kind == "bird":
            sweep(P["legs"], [Vector((x * 0.7, 0, z0 + 0.1)), Vector((x * 0.75, -0.02, 0.1))], 0.032, segs=10)
            ell(P["feet"], (x * 0.8, -0.1, 0.065), (0.12, 0.2, 0.065))
        elif kind == "float":
            ell(P["feet"], (x * 1.1, -0.06, 0.075), (0.14, 0.2, 0.075))
        elif kind == "blob":
            ell(P["feet"], (x * 0.9, -body.radius(0.05) * 0.85, 0.04), (0.09, 0.08, 0.05))
        elif kind == "clown":
            sweep(P["legs"], [Vector((x, 0, z0 + 0.1)), Vector((x, -0.02, 0.1))], 0.08)
            ell(P["feet"], (x * 1.2, -0.22, 0.08), (0.15, 0.36, 0.09))
        elif kind == "peg":
            sweep(P["legs"], [Vector((x, 0, z0 + 0.1)), Vector((x * 0.85, -0.02, 0.08))], [0.11, 0.05], segs=16)
            ell(P["feet"], (x * 0.85, -0.03, 0.06), (0.07, 0.07, 0.06))
    if kind == "wheel":
        c = Vector((0, -0.05, 0.27))
        sweep(P["feet"], ring_pts(c, 0.19, (1, 0, 0), 48), 0.08, segs=14, closed=True)
        ell(P["legs"], c, (0.1, 0.12, 0.12))
        for x in (-0.11, 0.11):
            sweep(P["legs"], [Vector((x, -0.05, 0.27)), Vector((x, 0, z0 + 0.12))], 0.035, segs=8)


# --------------------------------------------------------------------------
# character
# --------------------------------------------------------------------------
def glow_mat(name, rgb, strength=3.0):
    m = plastic(name, rgb, rough=0.2)
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Emission Color"].default_value = (*[lin(c) for c in rgb], 1)
    b.inputs["Emission Strength"].default_value = strength
    return m


def glass_mat():
    m = plastic("glass", (0.75, 0.9, 1.0), rough=0.03, coat=1.0)
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Alpha"].default_value = 0.22
    for attr, v in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
        try:
            setattr(m, attr, v)
        except Exception:
            pass
    return m


def character(kind, colours, face="dots", arms="noodle", feet="shoes", expr="happy", loc=(0, 0, 0), rz=0.0,
              accent=(1.0, 0.75, 0.2)):
    spec = BODIES[kind]
    body = Body(spec)
    if FEET_Z0.get(feet) is not None:
        body.z0 = FEET_Z0[feet]
    root = bpy.data.objects.new(f"bean-{kind}", None)
    bpy.context.scene.collection.objects.link(root)
    mats = {k: plastic(k, colours[k]) for k in ("body_top", "body_bottom", "arms", "hands", "legs", "feet")}
    mats.update({
        "bezel": plastic("bezel", colours["bezel"], rough=0.3, coat=0.6),
        "screen": screen_mat(expr, colours["led"]),
        "ink": plastic("ink", PUPIL, rough=0.15, coat=0.8),
        "pupil": plastic("pupil", PUPIL, rough=0.1, coat=1.0),
        "eyewhite": plastic("eyewhite", EYE_WHITE, rough=0.2, coat=0.8),
        "shine": glow_mat("shine", (1, 1, 1), 1.5),
        "cheek": plastic("cheek", CHEEK, rough=0.6, coat=0.0),
        "accent": plastic("accent", accent, rough=0.25, coat=0.6),
        "strap": plastic("strap", (0.2, 0.18, 0.2), rough=0.6, coat=0.0),
        "glass": glass_mat(),
        "mouth": plastic("mouth", (0.3, 0.06, 0.1), rough=0.5, coat=0.0),
        "tongue": plastic("tongue", (1.0, 0.45, 0.5), rough=0.4),
        "led": glow_mat("led", colours["led"], 4.0),
        "visor": plastic("visor", (0.05, 0.06, 0.08), rough=0.08, coat=1.0),
        "sole": plastic("sole", WHITE, rough=0.5, coat=0.0),
    })
    _mesh("body", body.build(), [mats["body_top"], mats["body_bottom"]], root)
    P = Parts()
    face_build(body, face, P, mats, colours)
    arms_build(body, arms, P)
    feet_build(body, feet, P)
    for k, bm in P.bms.items():
        _mesh(k, bm, [mats[k]], root)
    for ob in bpy.context.scene.collection.objects:
        if ob.parent is None and ob.name.startswith(("bezel", "screen")):
            ob.parent = root
    root.location, root.rotation_euler = loc, (0, 0, rz)
    return root


# --------------------------------------------------------------------------
# sheets
# --------------------------------------------------------------------------
C = lambda *a, **k: scheme(*a, **k)
PINK, TEAL, LILAC, ORANGE, YELLOW = (1.0, 0.55, 0.7), (0.3, 0.78, 0.72), (0.72, 0.6, 0.95), (1.0, 0.58, 0.28), (1.0, 0.84, 0.3)
GREEN, BLUE, CORAL, CREAM, NAVY = (0.5, 0.82, 0.42), (0.35, 0.6, 1.0), (1.0, 0.45, 0.42), (0.97, 0.9, 0.78), (0.2, 0.25, 0.42)
TAN, RED, PURPLE, MINT, GREY = (0.82, 0.62, 0.42), (0.92, 0.25, 0.25), (0.55, 0.38, 0.85), (0.5, 0.88, 0.75), (0.6, 0.64, 0.7)

WEIRD = [
    ("gumdrop-tall", C(PINK, feet=WHITE), "dots", "noodle", "shoes"),
    ("kiss", C(TEAL), "googly", "float", "float"),
    ("bell", C(LILAC, feet=(0.5, 0.35, 0.8)), "lids", "flipper", "blob"),
    ("teardrop", C(ORANGE, legs=INK, feet=INK), "cyclops", "trex", "bird"),
    ("sausage", C(YELLOW, (0.3, 0.45, 0.9)), "stalks", "noodle", "peg"),
    ("pancake", C(GREEN, feet=CORAL), "grin", "long", "shoes"),
    ("egg-up", C(BLUE, (0.95, 0.85, 0.4), feet=CORAL), "goggles", "beads", "clown"),
    ("lean-drop", C(CORAL, legs=INK, feet=INK), "kawaii", "stub", "wheel"),
    ("pawn", C(CREAM, feet=(0.5, 0.35, 0.25)), "button", "flipper", "peg"),
    ("squash", C(NAVY, led=(1.0, 0.7, 0.3)), "leds", "float", "float"),
    ("gumdrop-tall", C(MINT, feet=WHITE), "screen", "noodle", "shoes"),
    ("potato", C(TAN), "googly", "trex", "clown"),
    ("mochi", C(WHITE, feet=PINK), "kawaii", "flipper", "blob"),
    ("brick", C(GREY, hands=RED, feet=RED), "goggles", "long", "shoes"),
    ("slim", C(PURPLE, legs=INK, feet=YELLOW), "lids", "beads", "bird"),
    ("gumdrop", C(RED, hands=WHITE), "grin", "float", "wheel"),
]
FACE_KINDS = ["dots", "googly", "lids", "cyclops", "stalks", "goggles", "grin", "kawaii", "leds", "button", "screen"]
LIMBS = [("stub", "stub"), ("noodle", "shoes"), ("float", "float"), ("trex", "bird"), ("flipper", "blob"),
         ("long", "peg"), ("beads", "clown"), ("none", "wheel")]
GUMDROPS = ["gumdrop", "gumdrop-tall", "lean-drop", "kiss", "bell", "teardrop", "squash", "pawn"]


def card(sheet, i):
    sc = stage()
    acc = (1.0, 0.75, 0.2)
    if sheet == "weird":
        kind, col, face, arms, feet = WEIRD[i]
        character(kind, col, face, arms, feet, expr="happy", rz=0.3, accent=acc)
    elif sheet == "faces":
        character("gumdrop-tall", C(PINK, feet=WHITE), FACE_KINDS[i], "float", "shoes", rz=0.25, accent=acc)
    elif sheet == "limbs":
        a, f = LIMBS[i]
        character("gumdrop-tall", C(TEAL, legs=NAVY, feet=CORAL, hands=CORAL), "dots", a, f, rz=0.3)
    elif sheet == "gumdrops":
        character(GUMDROPS[i], C(ORANGE, feet=WHITE), "dots", "float", "shoes", rz=0.3)
    if sheet == "faces":
        camera(sc, (0.6, -3.9, 1.7), (0, 0, 1.4), lens=60)
        render(sc, f"{sheet}-{i + 1:02d}.png", 560, 620)
    else:
        camera(sc, (1.05, -5.6, 1.45), (0, 0, 1.15), lens=50)
        render(sc, f"{sheet}-{i + 1:02d}.png", 560, 800)


def main2():
    global OUT
    argv = sys.argv[sys.argv.index("--") + 1:]
    OUT = os.path.abspath(argv[0])
    globals()["OUT"] = OUT
    os.makedirs(OUT, exist_ok=True)
    for w in argv[1:]:
        sheet, i = w.split(":")
        card(sheet, int(i))


main2()
