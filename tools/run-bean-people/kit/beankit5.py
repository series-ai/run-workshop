"""Bean kit, round 5: boxy-tall art toys with clothes and screen faces.

Builds on beankit4.py. Adds
    outfits   hoodie, puffer, tee, overalls, trench, bucket+scarf, tracksuit, raincoat, backpack, vest
    screens   the gadget screen at several sizes, with LED faces drawn in the art-toy
              vocabulary (x, dots, slits, glyph, tired, bones, drip, smirk)
    garments  body-hugging shells with smoothed openings (hood around a face or a screen)

    Blender -b --factory-startup --python beankit5.py -- <out dir> <sheet>:<index> | shelf
Sheets: outfits (10), screens (8).
"""
import math
import os
import sys

_here = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(_here, "beankit4.py")).read()
exec(compile(_src[: _src.rindex("\nmain4()")], "beankit4.py", "exec"))

import bmesh  # noqa: E402
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

# --------------------------------------------------------------------------
# art-toy LED faces
# --------------------------------------------------------------------------
_face_grid_base = face_grid


def face_grid(name):  # noqa: F811  (extends beankit.face_grid; face_image looks it up by name)
    g = np.zeros((GH, GW), bool)

    def px(*pts):
        for x, y in pts:
            if 0 <= x < GW and 0 <= y < GH:
                g[y, x] = True

    def mirror(*pts):
        px(*pts)
        px(*[(GW - 1 - x, y) for x, y in pts])

    if name == "led-x":
        mirror(*[(3 + i, 6 + i) for i in range(5)], *[(3 + i, 10 - i) for i in range(5)])
    elif name == "led-dots":
        mirror((5, 7), (6, 7), (5, 8), (6, 8))
    elif name == "led-slits":
        mirror(*[(x, 8) for x in range(3, 8)])
    elif name == "led-glyph":
        mirror(*[(5, y) for y in range(6, 11)], *[(x, 8) for x in range(3, 8)])
    elif name == "led-tired":
        mirror(*[(x, 8) for x in range(3, 8)], (4, 7), (5, 7), (6, 7), (5, 6))
    elif name == "led-bones":
        mirror((4, 7), (5, 7), (6, 7), (4, 8), (5, 8), (6, 8), (4, 9), (5, 9), (6, 9), (9, 5))
        px(*[(x, 3) for x in range(6, 14)], *[(x, 2) for x in range(6, 14, 2)])
    elif name == "led-drip":
        mirror((5, 8), (6, 8), (5, 9), (6, 9))
        px((5, 6), (5, 5), (5, 4), (5, 3), (14, 6), (14, 5))
    elif name == "led-smirk":
        mirror(*[(x, 8) for x in range(3, 8)])
        px((7, 3), (8, 3), (9, 3), (10, 3), (11, 4), (12, 5))
    else:
        return _face_grid_base(name)
    return g


# --------------------------------------------------------------------------
# garments
# --------------------------------------------------------------------------
HAT_LIFT = 0.31   # hats start this far above the eye line: clear of the screen bezel too


def brim_ring(bm, z, r_in, r_out, thick, droop=0.0, segs=64):
    """A solid hat brim: a closed lathed profile (flat top, rounded outer lip, drooping toward the edge)."""
    prof = [(r_in, z + thick * 0.5), (r_out - thick * 0.5, z + thick * 0.5 - droop), (r_out, z - droop),
            (r_out - thick * 0.5, z - thick * 0.5 - droop), (r_in, z - thick * 0.5)]
    rings = [[bm.verts.new((r * math.cos(2 * math.pi * k / segs), r * math.sin(2 * math.pi * k / segs), zz))
              for k in range(segs)] for r, zz in prof]
    for A, B in zip(rings, rings[1:] + rings[:1]):
        for k in range(segs):
            f = bm.faces.new((A[k], A[(k + 1) % segs], B[(k + 1) % segs], B[k]))
            f.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=list({f for r in rings for v in r for f in v.link_faces}))


HAT_LIFT = 0.18   # set by kit_fig: 0.18 sits a hat just above art-face eyes, 0.31 clears the screen bezel


def sq_lathe(bm, body, z_ref, prof, loop=False, cap=False, segs=48, ribs=0, rib_amp=0.0):
    """Lathe a profile [(grow metres beyond the body's cross-section, z), ...] round the body's own squircle
    section (taken at z_ref, or lower if z_ref is in the rounded top). loop closes the profile (a solid ring);
    cap closes the top with a centre vertex. ribs > 0 runs that many vertical ribs (rib_amp deep) round every
    row that sits proud of the body (knit ribbing)."""
    s = body.s
    t = min((z_ref - body.z0) / s["h"], 1 - s["ct"] / s["h"] - 0.01)
    sect = [body.point(2 * math.pi * k / segs, t) for k in range(segs)]
    cx = sum(p.x for p in sect) / segs
    rings = []
    for grow, z in prof:
        ring = []
        for j, p in enumerate(sect):
            v = Vector((p.x - cx, p.y, 0))
            r = max(v.length, 1e-6)
            g = grow + (rib_amp * (0.5 + 0.5 * math.cos(2 * math.pi * ribs * j / segs)) if ribs and grow > 0.05 else 0.0)
            k = max(r + g, 0.02) / r
            ring.append(bm.verts.new((cx + v.x * k, v.y * k, z)))
        rings.append(ring)
    pairs = list(zip(rings, rings[1:])) + ([(rings[-1], rings[0])] if loop else [])
    for A, B in pairs:
        for k in range(segs):
            f = bm.faces.new((A[k], A[(k + 1) % segs], B[(k + 1) % segs], B[k]))
            f.smooth = True
    if cap:
        c = bm.verts.new((cx, 0, prof[-1][1] + 0.005))
        for k in range(segs):
            f = bm.faces.new((rings[-1][k], rings[-1][(k + 1) % segs], c))
            f.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=list({f for r in rings for v in r for f in v.link_faces}))


TOPPERS = ("sprout", "crown", "antenna", "horns", "flower", "halo")   # head ornaments (no hat)


SINK = 0.03   # how far a garment's edge sinks into the body (it reads as one solid piece)


def garment(body, out, keep, mat, parent, thick=0.04, smooth=8):
    s = dict(body.s)
    wm = sum(s["w"]) / len(s["w"])
    s["d"] = (wm * s["d"] + out) / (wm + out)  # grow front / back by `out` too, not out * d
    s["w"] = [w + out for w in s["w"]]
    s["h"] = s["h"] + 2 * out
    s["cb"], s["ct"] = s["cb"] + out, s["ct"] + out
    b2 = Body(s)
    b2.waves = body.waves
    b2.z0 = body.z0 - out
    bm = b2.build(segs=96, rings=110)
    dead = [f for f in bm.faces if not keep(f.calc_center_median())]
    bmesh.ops.delete(bm, geom=dead, context="FACES")
    bnd = [v for v in bm.verts if v.is_boundary]
    for _ in range(smooth):
        bmesh.ops.smooth_vert(bm, verts=bnd, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    for f in bm.faces:
        f.material_index = 0
    ob = _mesh("garment", bm, [mat], parent)
    # a SOLID garment: the outer surface plus a rim that runs from every edge down INTO the body, so there is
    # no hollow to see into from any angle (the inner wall would be hidden inside the bean anyway)
    sd = ob.modifiers.new("s", "SOLIDIFY")
    sd.thickness, sd.offset, sd.use_rim_only = out + SINK, -1.0, True
    bv = ob.modifiers.new("b", "BEVEL")
    bv.width, bv.segments, bv.limit_method = min(thick, out) * 0.4, 2, "ANGLE"
    return ob


# Layering (distance of each layer's outer surface from the body surface):
#   tops stay inside TOP_MAX; extras (scarf, backpack, straps) start at EXTRA_IN,
#   so any extra clears any top. Tested by clipcheck.py.
TOP_MAX = 0.135
EXTRA_IN = 0.15
ARM_DIR = (0.78, -0.06, -0.62)


def arm_root(body, sg):
    s = body.s
    z = body.z0 + 0.5 * s["h"]
    p, _ = body.side(sg, z)
    d = Vector((sg * ARM_DIR[0], ARM_DIR[1], ARM_DIR[2])).normalized()
    return p - Vector((sg * 0.05, 0, 0)), d


def outfit(body, kind, P, M, root, hole):
    """hole(c) -> True where the face / screen opening is."""
    s = body.s
    h, z0 = s["h"], body.z0
    ex, ez = eye_pos(body)
    Z = lambda f: z0 + f * h
    front = lambda c: c.y < 0

    def sleeves(mat_key, length=0.13, r=0.13):
        for sg in (-1, 1):
            a, d = arm_root(body, sg)
            end = a + d * length
            sweep(P[mat_key], [(a - d * 0.05).lerp(end, i / 10) for i in range(11)], r, segs=24, caps=False)
            # a solid cuff that closes the gap between sleeve and arm, so you can't look up the sleeve
            arm_r = 0.095
            sweep(P[mat_key], ring_pts(end, (r + arm_r) / 2, d, 32), (r - arm_r) / 2 + 0.014, segs=10, closed=True)

    def ring(z, off, r, key="top"):
        sweep(P[key], girdle(body, z, off), r, segs=12, closed=True)

    if kind == "hoodie":
        garment(body, 0.07, lambda c: c.z > Z(0.22) and not hole(c), M["top"], root, 0.045)
        sleeves("top", 0.2, 0.14)
        for sx in (-0.085, 0.085):
            # the drawstrings come OUT of the hood edge: find the bottom of the face opening at this x
            ze = ez
            while ze > Z(0.3) and hole(Vector((sx, -1.0, ze - 0.01))):
                ze -= 0.01
            top_ = ze - 0.035                                       # just under the hood rim, on the hoodie
            eye_, n_ = on(body, sx, top_, 0.072)
            ell(P["string"], eye_, (0.022, 0.012, 0.022), n_, segs=12, rings=6)       # the eyelet
            pts = [on(body, sx + 0.004 * k, top_ - 0.03 * k, 0.078 + 0.003 * k)[0] for k in range(5)]
            sweep(P["string"], pts, 0.012, segs=8)
            ell(P["string"], pts[-1] + Vector((0, -0.002, -0.012)), (0.017, 0.017, 0.026), segs=10, rings=6)  # aglet
        # a wide, solid knit band at the hem: proud of the hoodie, with vertical ribbing
        sq_lathe(P["top"], body, Z(0.26), [(0.03, Z(0.19)), (0.098, Z(0.194)), (0.105, Z(0.215)), (0.105, Z(0.285)),
                                           (0.094, Z(0.3)), (0.05, Z(0.305))], loop=True, segs=96, ribs=24, rib_amp=0.007)
    elif kind in ("puffer", "vest"):
        lo, hi = Z(0.22), Z(0.66)
        garment(body, 0.085, lambda c: lo < c.z < hi, M["top"], root, 0.05)
        for k in range(1, 4):
            ring(lo + (hi - lo) * k / 4, 0.1, 0.03)
        ring(hi + 0.02, 0.085, 0.05)
        if kind == "puffer":
            sleeves("top", 0.3, 0.155)
        za, zb_ = on(body, 0, lo + 0.04, 0.0)[0], on(body, 0, hi - 0.03, 0.0)[0]
        y = min(za.y, zb_.y) - 0.115                                # straight down the front: no dip at the seam
        sweep(P["zip"], [Vector((0, y, za.z)), Vector((0, y, zb_.z))], 0.012, segs=8)
    elif kind == "tee":
        garment(body, 0.05, lambda c: Z(0.3) < c.z < Z(0.64), M["top"], root, 0.035)
        sleeves("top", 0.13, 0.13)
        ring(Z(0.645), 0.065, 0.025)
        p, nr = on(body, 0, Z(0.47), 0.085)
        ell(P["print"], p, (0.13, 0.015, 0.13), nr)
        for d in (1, -1):
            line(P, body, (-0.07, Z(0.47) - 0.07 * d), (0.07, Z(0.47) + 0.07 * d), 0.018, key="top", off=0.1)
    elif kind == "overalls":
        garment(body, 0.05, lambda c: c.z < Z(0.38), M["top"], root, 0.04)
        garment(body, 0.06, lambda c: front(c) and abs(c.x) < 0.27 and c.z < Z(0.62), M["top"], root, 0.04)
        for sg in (-1, 1):
            a, _ = on(body, sg * 0.22, Z(0.6), 0.095)
            back = body.bvh.ray_cast(Vector((sg * 0.22, 5, Z(0.4))), Vector((0, -1, 0)))[0]
            pts = [a] + [body_arc_z(body, Z(0.62), t, sg, 0.095) for t in (0.15, 0.35, 0.5, 0.65, 0.85)] + \
                  [back + Vector((0, 0.095, 0))]
            sweep(P["top"], [q for q in pts if q is not None], 0.03, segs=8)
            ell(P["gold"], a + Vector((0, -0.025, 0)), (0.035, 0.02, 0.035), Vector((0, -1, 0)))
    elif kind == "trench":
        garment(body, 0.075, lambda c: c.z < Z(0.66) and not (front(c) and abs(c.x) < 0.045), M["top"], root, 0.045)
        sleeves("top", 0.3, 0.155)
        ring(Z(0.36), 0.1, 0.03, key="belt")
        for sg in (-1, 1):
            a, nr = on(body, sg * 0.05, Z(0.64), 0.11)
            b, _ = on(body, sg * 0.24, Z(0.62), 0.11)
            c, _ = on(body, sg * 0.06, Z(0.48), 0.11)
            bm = P["top"]
            vs = [bm.verts.new(v) for v in (a, b, c)]
            f = bm.faces.new(vs)
            f.smooth = True
            for z in (Z(0.5), Z(0.42)):
                q, nr2 = on(body, sg * 0.13, z, 0.11)
                ell(P["gold"], q, (0.03, 0.02, 0.03), nr2)
    elif kind == "bucket":
        bz = ez + HAT_LIFT
        top = max(bz + 0.24, z0 + h + 0.05)
        sq_lathe(P["hat"], body, bz, [(-0.06, bz - 0.04), (0.045, bz - 0.02), (0.04, bz + 0.1), (0.02, top - 0.03),
                                      (-0.04, top), (-0.2, top + 0.01)], cap=True)                     # crown
        sq_lathe(P["hat"], body, bz, [(-0.05, bz + 0.02), (0.22, bz - 0.03), (0.25, bz - 0.055), (0.22, bz - 0.075),
                                      (-0.05, bz - 0.03)], loop=True)                                    # brim
    elif kind == "scarf":
        thick = 0.075
        garment(body, EXTRA_IN + thick / 2 - 0.005, lambda c: Z(0.6) < c.z < Z(0.73), M["scarf"], root, thick, smooth=4)
        p, _ = on(body, -0.2, Z(0.62), EXTRA_IN + thick)
        tail = [p, p + Vector((-0.02, -0.03, -0.2)), p + Vector((-0.04, -0.02, -0.42))]
        sweep(P["scarf"], tail, [0.07, 0.065, 0.06], segs=12)
    elif kind == "tracksuit":
        garment(body, 0.06, lambda c: Z(0.24) < c.z < Z(0.68), M["top"], root, 0.04)
        sleeves("top", 0.3, 0.14)
        ring(Z(0.685), 0.085, 0.04)
        line(P, body, (0, Z(0.26)), (0, Z(0.66)), 0.012, key="zip", off=0.09, n=6)
        for sg in (-1, 1):
            pts = []
            for f in [0.26 + 0.4 * i / 8 for i in range(9)]:
                p, nr = body.side(sg, Z(f))
                if p is not None:
                    pts.append(p + nr * 0.09)
            if len(pts) > 2:
                sweep(P["stripe"], pts, 0.022, segs=8)
    elif kind == "raincoat":
        garment(body, 0.075, lambda c: not hole(c) and c.z > z0 - 0.05, M["top"], root, 0.045)
        sleeves("top", 0.3, 0.155)
        for z in (Z(0.55), Z(0.42), Z(0.29)):
            q, nr = on(body, 0, z, 0.11)
            ell(P["gold"], q, (0.035, 0.02, 0.035), nr)
        ring(ez - 0.25, 0.1, 0.035)
    elif kind == "coveralls":
        # a jumpsuit: solid body up to the chest (below every face and the screen), short sleeves, pant legs over the
        # leg posts with rolled cuffs, a collar, a zip down the front, a chest pocket
        neck = Z(0.5)
        garment(body, 0.05, lambda c: c.z < neck, M["top"], root, 0.04)
        sleeves("top", 0.16, 0.135)
        sweep(P["top"], girdle(body, neck - 0.005, 0.07), 0.035, segs=12, closed=True)            # the collar
        for sg in (-1, 1):                                                                       # collar points
            a_, n_ = on(body, sg * 0.1, neck - 0.04, 0.07)
            bm_ = P["top"]
            vs = [bm_.verts.new(v) for v in (a_ + Vector((0, 0, 0.04)), a_ + Vector((sg * 0.13, 0, 0.03)),
                                               a_ + Vector((sg * 0.04, -0.01, -0.09)))]
            f_ = bm_.faces.new(vs if sg > 0 else vs[::-1])
            f_.smooth = True
        za, zb_ = on(body, 0, neck - 0.02, 0.0)[0], on(body, 0, Z(0.13), 0.0)[0]
        zpts = [on(body, 0, za.z + (zb_.z - za.z) * k / 10, 0.065)[0] for k in range(11)]
        sweep(P["zip"], zpts, 0.011, segs=8)
        ell(P["zip"], zpts[1] + Vector((0, -0.012, 0)), (0.022, 0.012, 0.035), segs=12, rings=6)     # the pull
        pp, pn = on(body, 0.22, Z(0.43), 0.06)
        ell(P["top"], pp, (0.1, 0.022, 0.08), pn, segs=24, rings=10)                              # chest pocket
        ell(P["zip"], pp + Vector((0, -0.02, 0.06)), (0.012, 0.01, 0.012), segs=8, rings=4)        # its button
        lx = s["leg"][2]
        for sg in (-1, 1):
            x = sg * lx
            sweep(P["pantleg"], [Vector((x, 0, z0 + 0.12)), Vector((x, -0.008, 0.21))], [0.14, 0.13], segs=40, caps=False)
            sweep(P["pantleg"], ring_pts(Vector((x, -0.008, 0.215)), 0.13, (0, 0, 1), 32), 0.03, segs=10, closed=True)
    elif kind in TOPPERS:
        b, _ = top_point(body, 0.0)
        b = b - Vector((0, 0, 0.02))
        up = Vector((0, 0, 1))
        if kind == "sprout":
            stem = [b + Vector((0, 0, -0.04)), b + Vector((0.01, 0, 0.1)), b + Vector((0.04, 0, 0.19))]
            sweep(P["topper"], stem, [0.024, 0.02, 0.017], segs=12)
            tip = stem[-1]
            for sg in (-1, 1):
                ell(P["topper"], tip + Vector((sg * 0.085, 0, 0.035)), (0.095, 0.022, 0.048), Vector((sg * 0.45, 0, 1)),
                    segs=24, rings=10)
        elif kind == "crown":
            c0 = b + Vector((0, 0, 0.0))
            res = bmesh.ops.create_cone(P["topper"], cap_ends=True, cap_tris=False, segments=32, radius1=0.15,
                                        radius2=0.17, depth=0.1)
            bmesh.ops.translate(P["topper"], vec=c0 + Vector((0, 0, 0.04)), verts=res["verts"])
            for f in {f for v in res["verts"] for f in v.link_faces}:
                f.smooth = False
            for k in range(5):
                a = 2 * math.pi * k / 5 + math.pi / 2
                base = c0 + Vector((0.16 * math.cos(a), 0.16 * math.sin(a), 0.09))
                r_ = bmesh.ops.create_cone(P["topper"], cap_ends=True, cap_tris=True, segments=10, radius1=0.042,
                                           radius2=0.0, depth=0.1)
                bmesh.ops.translate(P["topper"], vec=base + Vector((0, 0, 0.05)), verts=r_["verts"])
                ell(P["topper"], base + Vector((0, 0, 0.11)), (0.024, 0.024, 0.024), segs=12, rings=6)
            ell(P["gold"], c0 + Vector((0, -0.17, 0.045)), (0.03, 0.02, 0.03), segs=12, rings=6)      # a front jewel
        elif kind == "antenna":
            sweep(P["zip"], [b + Vector((0, 0, -0.04)), b + Vector((0.0, 0, 0.12)), b + Vector((0.03, 0, 0.27))], 0.014, segs=8)
            ell(P["topper"], b + Vector((0.035, 0, 0.3)), (0.055, 0.055, 0.055), segs=20, rings=10)
        elif kind == "horns":
            for sg in (-1, 1):
                r0 = b + Vector((sg * 0.22, 0, -0.05))
                pts = bez([r0, r0 + Vector((sg * 0.1, 0, 0.12)), r0 + Vector((sg * 0.06, 0, 0.26))], 10)
                sweep(P["topper"], pts, [0.06 - 0.05 * k / 10 for k in range(11)], segs=14)
        elif kind == "flower":
            sweep(P["topper"], [b + Vector((0, 0, -0.04)), b + Vector((0.01, 0, 0.12))], 0.017, segs=10)
            c_ = b + Vector((0.01, -0.02, 0.17))
            for k in range(6):
                a = 2 * math.pi * k / 6
                ell(P["topper"], c_ + Vector((0.07 * math.cos(a), 0, 0.07 * math.sin(a))), (0.055, 0.016, 0.034),
                    Vector((0, -1, 0)), segs=16, rings=8)
                P["topper"].verts.ensure_lookup_table()
            ell(P["gold"], c_ + Vector((0, -0.012, 0)), (0.04, 0.025, 0.04), segs=16, rings=8)
        elif kind == "halo":
            sweep(P["topper"], ring_pts(b + Vector((0, 0, 0.16)), 0.17, up, 40), 0.024, segs=10, closed=True)
        k_ = 1.15 if kind == "horns" else 1.35                    # chunky-toy scale: ornaments read from the game camera
        for key in ("topper", "gold", "zip"):
            if key in P.bms:
                for v in P.bms[key].verts:
                    v.co = b + (v.co - b) * k_
    elif kind == "beanie":
        bz = ez + HAT_LIFT - 0.04
        top = max(bz + 0.3, z0 + h + 0.07)
        sq_lathe(P["hat"], body, bz, [(-0.06, bz - 0.03), (0.035, bz), (0.035, top - 0.14), (0.0, top - 0.05),
                                      (-0.1, top - 0.01), (-0.25, top)], cap=True)                     # the knit dome
        sq_lathe(P["hat"], body, bz, [(0.02, bz - 0.01), (0.07, bz), (0.075, bz + 0.05), (0.07, bz + 0.1),
                                      (0.02, bz + 0.11)], loop=True)                                    # the fold
    elif kind == "backpack":
        back = body.bvh.ray_cast(Vector((0, 5, Z(0.45))), Vector((0, -1, 0)))[0]
        if back is not None:
            depth = 0.3
            bpy.ops.mesh.primitive_cube_add(size=1, location=back + Vector((0, EXTRA_IN + depth / 2, 0)))
            bp = bpy.context.object
            bp.scale = (0.62, depth, 0.7)
            bv = bp.modifiers.new("b", "BEVEL")
            bv.width, bv.segments = 0.12, 4
            bp.data.materials.append(M["pack"])
            bp.parent = root
            bpy.ops.object.shade_smooth()
        off = EXTRA_IN + 0.03
        for sg in (-1, 1):
            # a real strap loop round the "shoulder": chest -> over the side top -> pack top -> down the back ->
            # under the arm -> chest. Smooth (Catmull-Rom through surface points) so it stays round at low poly.
            def at(x, z, back_side):
                d = Vector((x, 1.0 if back_side else -1.0, 0)).normalized()
                hit = body.bvh.ray_cast(Vector((0, 0, z)) + d * 5, -d)
                return hit[0] + hit[1] * off
            def side(z):
                p_, n_ = body.side(sg, z)
                return p_ + n_ * off
            ctrl = [at(sg * 0.2, Z(0.42), False), at(sg * 0.24, Z(0.58), False), side(Z(0.66)),
                    at(sg * 0.24, Z(0.6), True), at(sg * 0.24, Z(0.36), True), side(Z(0.32)), at(sg * 0.24, Z(0.3), False)]
            n = len(ctrl)
            loop = []
            for k in range(n):
                p0, p1, p2, p3 = ctrl[(k - 1) % n], ctrl[k], ctrl[(k + 1) % n], ctrl[(k + 2) % n]
                for q in range(3):
                    u = q / 3
                    loop.append(0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u
                                       + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3))
            sweep(P["strap"], loop, 0.028, segs=8, closed=True)


def body_arc(body, x, z, t, off):
    """A point over the top of the body in the y-z plane at x: t=0 front, 0.5 top, 1 back."""
    a = math.pi * t
    d = Vector((0, -math.cos(a), math.sin(a)))
    c = Vector((x, 0, z))
    hit = body.bvh.ray_cast(c + d * 5, -d)
    return hit[0] + hit[1] * off if hit[0] is not None else None


def body_arc_z(body, z, t, sg, off):
    """A point round the side of the body at height z: t=0 front, 0.5 side, 1 back."""
    a = math.pi * t
    d = Vector((sg * math.sin(a), -math.cos(a), 0))
    hit = body.bvh.ray_cast(Vector((0, 0, z)) + d * 5, -d)
    return hit[0] + hit[1] * off if hit[0] is not None else None


# --------------------------------------------------------------------------
# figure
# --------------------------------------------------------------------------
def fig5(edition="black", face="x", outfit_kind=None, screen=None, top=(0.12, 0.12, 0.13), hat=None, pack=None,
         legs_col=None, feet_col=None, accent=(1.0, 0.45, 0.15), loc=(0, 0, 0), rz=0.0, plinth=None, body_kind="boxy-tall"):
    spec = dict(BODIES[body_kind])
    if screen:
        spec["screen"] = (screen.get("zf", spec["screen"][0]), screen.get("a", spec["screen"][1]))
    body = Body(spec)
    body.z0 = FEET_Z0["chunky"]
    root = bpy.data.objects.new("fig", None)
    bpy.context.scene.collection.objects.link(root)
    em = edition_mat(f"ed-{edition}", edition)
    mats = {k: em for k in ("body_top", "body_bottom", "arms", "hands")}
    mats["legs"] = finish_mat("legs", legs_col, "matte") if legs_col else em
    mats["feet"] = finish_mat("feet", feet_col, "satin") if feet_col else em
    mats["mark"] = plastic("mark", MARK_FOR.get(edition) or (0.1, 0.09, 0.11), rough=0.4, coat=0.2)
    mats["hole"] = plastic("hole", (0.02, 0.02, 0.025), rough=0.9, coat=0.0)
    sm = plastic("seam", (0, 0, 0), rough=0.8, coat=0.0)
    mats["seam"] = sm
    G = {"top": finish_mat("top", top, "matte"), "hat": finish_mat("hat", hat or accent, "matte"),
         "pack": finish_mat("pack", pack or accent, "matte")}
    mats.update(top=G["top"], hat=G["hat"], pack=G["pack"], string=plastic("string", (0.92, 0.9, 0.85), rough=0.6, coat=0.0),
                print=plastic("print", accent, rough=0.6, coat=0.0), zip=finish_mat("zip", (0.8, 0.8, 0.82), "chrome"),
                gold=finish_mat("gold", (1.0, 0.78, 0.35), "chrome"), belt=finish_mat("belt", top, "satin"),
                scarf=finish_mat("scarf", accent, "matte"), stripe=plastic("stripe", (0.95, 0.94, 0.9), rough=0.5),
                strap=finish_mat("strap", (0.15, 0.15, 0.16), "matte"))
    _mesh("body", body.build(), [em, em], root)
    P = Parts()
    if screen:
        mats["bezel"] = finish_mat("bezel", screen.get("bezel", (0.1, 0.1, 0.11)), "satin")
        mats["screen"] = screen_mat(screen.get("face", "led-x"), screen.get("led", (0.35, 1.0, 1.0)))
        build_screen(body, mats, root)
        cz = body.z0 + spec["screen"][0] * spec["h"]
        ax, az = spec["screen"][1] + 0.14, spec["screen"][1] * 0.72 + 0.14
        hole = lambda c: c.y < 0 and (c.x / ax) ** 4 + ((c.z - cz) / az) ** 4 < 1
    else:
        face4(body, face, P)
        ex, ez = eye_pos(body)
        hole = lambda c: c.y < 0 and (c.x / (ex + 0.2)) ** 2 + ((c.z - (ez - 0.06)) / 0.3) ** 2 < 1
    for kind in ([outfit_kind] if isinstance(outfit_kind, str) else outfit_kind or []):
        outfit(body, kind, P, mats, root, hole)
    limbs4(body, "chunky", "chunky", P)
    for k, bm in P.bms.items():
        _mesh(k, bm, [mats[k]], root)
    if plinth:
        bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.62, depth=PLINTH_H, location=(0, 0, PLINTH_H / 2))
        pl = bpy.context.object
        bv = pl.modifiers.new("b", "BEVEL")
        bv.width, bv.segments, bv.limit_method = 0.02, 3, "ANGLE"
        pl.data.materials.append(finish_mat("plinth", plinth, "satin"))
        pl.data.polygons.foreach_set("use_smooth", [True] * len(pl.data.polygons))
        pl.parent = root
        for ob in root.children:
            if ob is not pl:
                ob.location.z += PLINTH_H
    root.location, root.rotation_euler = loc, (0, 0, rz)
    return root


BLACK, BONE, OLIVE2, ORANGE3, NAVY2, GREY2 = (0.12, 0.12, 0.13), (0.9, 0.87, 0.8), (0.4, 0.43, 0.3), (1.0, 0.45, 0.15), \
    (0.16, 0.2, 0.32), (0.55, 0.56, 0.58)
YELLOW2, RED2, DENIM = (1.0, 0.8, 0.15), (0.85, 0.18, 0.18), (0.3, 0.42, 0.62)

OUTFITS = [
    dict(edition="bone", face="x", outfit_kind="hoodie", top=BLACK, legs_col=GREY2, feet_col=BONE),
    dict(edition="black", face="slits", outfit_kind="puffer", top=ORANGE3, legs_col=BLACK, feet_col=BONE),
    dict(edition="black", face="dots", outfit_kind="tee", top=BONE, accent=RED2, legs_col=OLIVE2, feet_col=BLACK),
    dict(edition="bone", face="stitch", outfit_kind="overalls", top=DENIM, feet_col=BLACK),
    dict(edition="black", face="tired", outfit_kind="trench", top=(0.72, 0.6, 0.42), legs_col=BLACK, feet_col=BLACK),
    dict(edition="bone", face="holes", outfit_kind=["bucket", "scarf"], top=BONE, hat=OLIVE2, accent=ORANGE3, legs_col=OLIVE2,
         feet_col=BLACK),
    dict(edition="black", face="glyph", outfit_kind="tracksuit", top=RED2, legs_col=RED2, feet_col=BONE),
    dict(edition="bone", face="dots", outfit_kind="raincoat", top=YELLOW2, legs_col=BLACK, feet_col=YELLOW2),
    dict(edition="camo", face="x", outfit_kind=["beanie", "backpack"], hat=BLACK, pack=ORANGE3, feet_col=BLACK),
    dict(edition="bone", face="bones", outfit_kind="vest", top=NAVY2, legs_col=BLACK, feet_col=BONE),
]
SCREENS = [
    dict(edition="black", screen=dict(face="led-x")),
    dict(edition="bone", screen=dict(face="led-dots", a=0.22, zf=0.8)),
    dict(edition="black", screen=dict(face="led-slits", a=0.36, zf=0.7, led=(1.0, 0.65, 0.2))),
    dict(edition="bone", screen=dict(face="led-glyph", bezel=BONE, led=(1.0, 0.3, 0.3))),
    dict(edition="gold", screen=dict(face="led-smirk", bezel=(0.12, 0.1, 0.08))),
    dict(edition="black", screen=dict(face="led-bones", led=(0.6, 1.0, 0.45)), outfit_kind="hoodie", top=GREY2,
         legs_col=BLACK, feet_col=BONE),
    dict(edition="bone", screen=dict(face="led-tired", led=(1.0, 0.4, 0.8)), outfit_kind="puffer", top=BLACK,
         legs_col=BLACK, feet_col=BONE),
    dict(edition="split", screen=dict(face="led-drip", bezel=(0.5, 0.5, 0.52))),
]


def card5(sheet, i):
    sc = art_stage()
    cfg = (OUTFITS if sheet == "outfits" else SCREENS)[i]
    fig5(rz=0.3, **cfg)
    camera(sc, (1.05, -5.6, 1.45), (0, 0, 1.12), lens=50)
    render(sc, f"boxy-{sheet}-{i + 1:02d}.png", 560, 800)


def shelf5():
    sc = art_stage(bg=(0.16, 0.16, 0.17))
    for ob in list(sc.collection.objects):
        if ob.type == "LIGHT":
            ob.data.energy *= 0.35
    picks = [OUTFITS[0], SCREENS[0], OUTFITS[1], SCREENS[5], OUTFITS[4], SCREENS[3], OUTFITS[7], SCREENS[6]]
    n = len(picks)
    for i, cfg in enumerate(picks):
        x = (i - (n - 1) / 2) * 1.5
        fig5(loc=(x, 0, 0), rz=0.12, plinth=(0.22, 0.22, 0.24), **cfg)
        sp = bpy.data.objects.new(f"spot{i}", bpy.data.lights.new(f"spot{i}", "SPOT"))
        sp.data.energy, sp.data.spot_size, sp.data.spot_blend, sp.data.shadow_soft_size = 260, math.radians(32), 0.5, 0.4
        sp.data.color = (1.0, 0.96, 0.9)
        sp.location = (x + 0.4, -1.6, 4.6)
        sp.rotation_euler = (Vector((x, 0, 1.0)) - sp.location).to_track_quat("-Z", "Y").to_euler()
        sc.collection.objects.link(sp)
    camera(sc, (1.2, -15.5, 2.4), (0, 0, 1.05), lens=38)
    render(sc, "boxy-shelf.png", 2400, 900)


def main5():
    argv = sys.argv[sys.argv.index("--") + 1:]
    globals()["OUT"] = os.path.abspath(argv[0])
    os.makedirs(globals()["OUT"], exist_ok=True)
    for w in argv[1:]:
        if w == "shelf":
            shelf5()
        else:
            sheet, i = w.split(":")
            card5(sheet, int(i))


main5()
