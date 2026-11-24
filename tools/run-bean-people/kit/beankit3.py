"""Bean kit, round 3: teen / young-adult treatments.

Builds on beankit2.py and adds older-reading pieces:
    faces        deadpan, side-eye, smirk, x-eyes (art toy), visor (LED slits), fangs
    wear         hoodie (with hood framing the face), beanie, backwards cap, headphones, chain
    legs / feet  baggy pants + chunky sneakers, hanging arms
    finishes     matte, satin, gloss, chrome
    staging      moody coloured backdrops with coloured rim lights

    Blender -b --factory-startup --python beankit3.py -- <out dir> <treatment index> ...
"""
import math
import os
import sys

_here = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(_here, "beankit2.py")).read()
exec(compile(_src[: _src.rindex("\nmain2()")], "beankit2.py", "exec"))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

FEET_Z0["pants"] = 0.5
FINISH = {"matte": dict(rough=0.62, coat=0.0), "satin": dict(rough=0.42, coat=0.12), "gloss": dict(rough=0.25, coat=0.5),
          "chrome": dict(rough=0.1, coat=0.3, metal=1.0), "metal": dict(rough=0.3, coat=0.2, metal=0.7)}


def finish_mat(name, rgb, finish="satin"):
    f = FINISH[finish]
    m = plastic(name, rgb, rough=f["rough"], coat=f["coat"])
    if f.get("metal"):
        m.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = f["metal"]
    return m


# --------------------------------------------------------------------------
# body-hugging shells (garments)
# --------------------------------------------------------------------------
def shell(body, out, keep, mat, parent, thick=0.035):
    """A garment that hugs the body: the body grown by `out`, keeping faces
    whose centre passes keep(c)."""
    s = dict(body.s)
    s["w"] = [w + out for w in s["w"]]
    s["h"] = s["h"] + 2 * out
    s["cb"], s["ct"] = s["cb"] + out, s["ct"] + out
    b2 = Body(s)
    b2.waves = body.waves
    b2.z0 = body.z0 - out
    bm = b2.build()
    dead = [f for f in bm.faces if not keep(f.calc_center_median())]
    bmesh.ops.delete(bm, geom=dead, context="FACES")
    for f in bm.faces:
        f.material_index = 0
    ob = _mesh("shell", bm, [mat], parent)
    sd = ob.modifiers.new("s", "SOLIDIFY")
    sd.thickness, sd.offset = thick, 0
    bv = ob.modifiers.new("b", "BEVEL")
    bv.width, bv.segments, bv.limit_method = thick * 0.45, 2, "ANGLE"
    return ob


# --------------------------------------------------------------------------
# faces
# --------------------------------------------------------------------------
def brow(P, body, x, z, tilt, key="mark", w=0.075):
    a, _ = on(body, x - w, z + tilt, 0.012)
    b, _ = on(body, x + w, z - tilt, 0.012)
    sweep(P[key], [a, (a + b) / 2 + Vector((0, -0.01, 0.006)), b], 0.02, segs=8)


def face3(body, kind, P):
    ex, ez = eye_pos(body)
    mz = ez - 0.2
    if kind in ("deadpan", "side-eye"):
        for s in (-1, 1):
            p, nr = on(body, s * ex, ez)
            r = 0.09
            c = p + nr * r * 0.3
            ell(P["eyewhite"], c, (r, r, r), segs=32, rings=18)
            side = Vector((0.035, 0, 0)) if kind == "side-eye" else Vector((0, 0, -0.01))
            ell(P["pupil"], c + nr * r * 0.82 + side, (r * 0.42, r * 0.22, r * 0.42), nr)
            lid_drop = 0.25 if kind == "deadpan" else (0.1 if s > 0 else 0.35)
            ell(P["body_top"], c, (r * 1.12,) * 3, segs=32, rings=18,
                cut=(c - Vector((0, 0, r * lid_drop)), Vector((0, -0.08 * s, 1))))
            ell(P["body_top"], c, (r * 1.1,) * 3, segs=32, rings=18,
                cut=(c - Vector((0, 0, r * 0.62)), Vector((0, 0, -1))))
        if kind == "side-eye":
            brow(P, body, ex, ez + 0.14, -0.02)
        a, _ = on(body, -0.06, mz, 0.008)
        b, _ = on(body, 0.06, mz + (0.0 if kind == "deadpan" else 0.012), 0.008)
        sweep(P["mark"], [a, b], 0.014, segs=8)
    elif kind == "smirk":
        for s in (-1, 1):
            p, nr = on(body, s * ex, ez)
            ell(P["mark"], p, (0.075, 0.03, 0.032), nr)
            brow(P, body, s * ex, ez + 0.1, -0.012 * s if s > 0 else 0.0)
        pts = [on(body, x, mz + 0.035 * max(x, 0) / 0.08 + 0.01 * (x / 0.08) ** 2, 0.008)[0]
               for x in [-0.06 + 0.14 * i / 8 for i in range(9)]]
        sweep(P["mark"], pts, 0.014, segs=8)
    elif kind == "x-eyes":
        for s in (-1, 1):
            for d in (1, -1):
                a, _ = on(body, s * ex - 0.065, ez - 0.065 * d, 0.01)
                b, _ = on(body, s * ex + 0.065, ez + 0.065 * d, 0.01)
                sweep(P["mark"], [a, (a + b) / 2, b], 0.024, segs=8)
    elif kind == "visor":
        vz = ez + 0.02
        shell(body, 0.025, lambda c: abs(c.z - vz) < 0.11 and c.y < -0.12, P.visor_mat, P.root, thick=0.03)
        for s in (-1, 1):
            a, nr = on(body, s * (ex - 0.06), vz - 0.012 * s * 0 + 0.0, 0.06)
            b, _ = on(body, s * (ex + 0.06), vz + 0.02, 0.06)
            sweep(P["led"], [a, b], 0.02, segs=10)
    elif kind == "fangs":
        for s in (-1, 1):
            p, nr = on(body, s * ex, ez)
            ell(P["mark"], p, (0.07, 0.03, 0.04), nr)
            brow(P, body, s * ex, ez + 0.1, 0.03 * s)
        w = 0.13
        pts = [on(body, w * t, mz + 0.05 * t * t, 0.01)[0] for t in [i / 6 - 1 for i in range(13)]]
        sweep(P["mark"], pts, 0.016, segs=8)
        for t in (-0.55, -0.2, 0.2, 0.55):
            q, nr2 = on(body, w * t, mz + 0.05 * t * t - 0.012, 0.012)
            bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.022, depth=0.05, location=q - Vector((0, 0, 0.02)),
                                            rotation=(math.pi, 0, 0))
            ob = bpy.context.object
            ob.data.materials.append(P.mats["eyewhite"])
            ob.parent = P.root


# --------------------------------------------------------------------------
# wear
# --------------------------------------------------------------------------
def wear(body, item, P, colours):
    ex, ez = eye_pos(body)
    s = body.s
    split_z = body.z0 + s["split"] * s["h"]
    if item == "hoodie":
        ax, az = ex + 0.22, 0.31

        def keep(c):
            if c.z < split_z - 0.1:
                return False
            hole = c.y < 0 and (c.x / ax) ** 2 + ((c.z - (ez - 0.02)) / az) ** 2 < 1
            return not hole
        shell(body, 0.05, keep, P.mats["hoodie"], P.root, thick=0.04)
        for sx in (-0.07, 0.07):
            a, _ = on(body, sx, ez - az - 0.02, 0.08)
            sweep(P["string"], [a, a + Vector((0.0, -0.02, -0.2))], 0.012, segs=8)
        pz = split_z + 0.03
        shell(body, 0.085, lambda c: c.y < -0.1 and abs(c.x) < 0.24 and abs(c.z - pz) < 0.11, P.mats["hoodie"],
              P.root, thick=0.02)
    elif item == "beanie":
        bz = ez + 0.15
        shell(body, 0.035, lambda c: c.z > bz, P.mats["beanie"], P.root, thick=0.04)
        sweep(P["beanie"], girdle(body, bz + 0.05, 0.06), 0.055, segs=12, closed=True)
    elif item == "cap":
        cz = ez + 0.18
        shell(body, 0.03, lambda c: c.z > cz, P.mats["cap"], P.root, thick=0.035)
        tip, _ = body.bvh.ray_cast(Vector((0, 5, cz + 0.02)), Vector((0, -1, 0)))[:2]
        if tip is not None:
            ell(P["cap"], tip + Vector((0, 0.2, -0.03)), (0.22, 0.26, 0.03), Vector((0, -1, 0)))
    elif item == "headphones":
        c0 = Vector((0, 0, ez + 0.05))
        pts = []
        for i in range(25):
            a = -math.pi / 2 + math.pi * i / 24
            d = Vector((math.sin(a), 0.05, math.cos(a)))
            hit = body.bvh.ray_cast(c0 + d * 5, -d)
            if hit[0] is not None:
                pts.append(hit[0] + hit[1] * 0.07)
        if len(pts) > 4:
            sweep(P["phones"], pts, 0.03, segs=10)
        for sg in (-1, 1):
            p, nr = body.side(sg, ez + 0.0)
            if p is not None:
                ell(P["phones"], p + nr * 0.05, (0.15, 0.06, 0.15), nr)
                ell(P["cushion"], p + nr * 0.015, (0.13, 0.05, 0.13), nr)
    elif item == "chain":
        nz = ez - 0.36
        pts = girdle(body, nz, 0.03)
        if pts:
            sweep(P["gold"], pts, 0.016, segs=8, closed=True)
            p, nr = on(body, 0, nz - 0.1, 0.04)
            ell(P["gold"], p, (0.05, 0.02, 0.06), nr)


def kicks(P, x, fy, accent):
    c = Vector((x, fy, 0.12))
    ell(P["feet"], c, (0.165, 0.28, 0.12), cut=(Vector((0, 0, 0.075)), (0, 0, 1)))
    ell(P["sole"], (c.x, c.y, 0.06), (0.18, 0.3, 0.06))
    ell(P["kick_accent"], c + Vector((0, 0.2, 0.03)), (0.09, 0.08, 0.07))
    ell(P["kick_accent"], c + Vector((x * 0.25 / max(abs(x), 1e-3) * 0.62, 0.0, 0.0)), (0.03, 0.14, 0.04))


def legs3(body, kind, P):
    lx = body.s["leg"][2] * 0.95
    z0 = body.z0
    for sg in (-1, 1):
        x = sg * lx
        if kind == "pants":
            sweep(P["legs"], [Vector((x, 0, z0 + 0.12)), Vector((x * 1.05, -0.02, 0.16))], [0.13, 0.115], segs=18)
            sweep(P["legs"], ring_pts(Vector((x * 1.05, -0.02, 0.17)), 0.115, (0, 0, 1), 32), 0.028, segs=10,
                  closed=True)
            kicks(P, x * 1.05, -0.07, None)
        elif kind == "peg":
            sweep(P["legs"], [Vector((x, 0, z0 + 0.1)), Vector((x * 0.85, -0.02, 0.08))], [0.11, 0.06], segs=16)
            ell(P["feet"], (x * 0.85, -0.04, 0.065), (0.09, 0.1, 0.065))
        elif kind == "float":
            ell(P["feet"], (x * 1.1, -0.06, 0.08), (0.14, 0.2, 0.08))


def arms3(body, kind, P):
    s = body.s
    for sg in (-1, 1):
        z = body.z0 + 0.5 * s["h"]
        p, nr = body.side(sg, z)
        if p is None:
            continue
        X = lambda v: Vector((sg * v[0], v[1], v[2]))
        if kind == "hang":
            pts = bez([p - X((0.05, 0, 0)), p + X((0.13, 0.0, -0.05)), p + X((0.13, -0.03, -0.38))], 14)
            sweep(P["arms"], pts, [0.06 - 0.01 * i / 14 for i in range(15)], segs=12)
            hand(P, pts[-1] + X((0.01, -0.01, -0.07)), 0.1, sgn=sg)
        elif kind == "float":
            hand(P, p + X((0.2, -0.05, -0.3)), 0.11, sgn=sg)


def character3(c, loc=(0, 0, 0), rz=0.0):
    spec = BODIES[c["body"]]
    body = Body(spec)
    body.z0 = FEET_Z0.get(c["feet"]) or body.z0
    root = bpy.data.objects.new(f"bean-{c['body']}", None)
    bpy.context.scene.collection.objects.link(root)
    fin = c.get("finish", "satin")
    col = c["colours"]
    mats = {k: finish_mat(k, col[k], fin if k in ("body_top", "body_bottom", "arms", "hands") else "satin")
            for k in ("body_top", "body_bottom", "arms", "hands", "legs", "feet")}
    acc = c.get("accent", (1.0, 0.45, 0.15))
    mats.update({
        "mark": plastic("mark", c.get("mark", PUPIL), rough=0.3, coat=0.4),
        "pupil": plastic("pupil", PUPIL, rough=0.1, coat=1.0),
        "eyewhite": plastic("eyewhite", (0.95, 0.94, 0.9), rough=0.3, coat=0.5),
        "led": glow_mat("led", c.get("led", (0.3, 1.0, 1.0)), 6.0),
        "sole": plastic("sole", c.get("sole", (0.95, 0.94, 0.9)), rough=0.5, coat=0.0),
        "kick_accent": plastic("kick_accent", acc, rough=0.4, coat=0.1),
        "hoodie": finish_mat("hoodie", c.get("hoodie", (0.12, 0.12, 0.13)), "matte"),
        "beanie": finish_mat("beanie", c.get("beanie", acc), "matte"),
        "cap": finish_mat("cap", c.get("cap", (0.1, 0.1, 0.11)), "satin"),
        "string": plastic("string", (0.92, 0.9, 0.85), rough=0.6, coat=0.0),
        "phones": finish_mat("phones", c.get("phones", (0.1, 0.1, 0.11)), c.get("phones_finish", "satin")),
        "cushion": finish_mat("cushion", c.get("cushion", acc), "matte"),
        "gold": finish_mat("gold", c.get("gold", (1.0, 0.78, 0.35)), "chrome"),
        "visor": plastic("visor", (0.03, 0.035, 0.05), rough=0.06, coat=1.0),
    })
    _mesh("body", body.build(), [mats["body_top"], mats["body_bottom"]], root)
    P = Parts()
    P.mats, P.root, P.visor_mat = mats, root, mats["visor"]
    face3(body, c["face"], P)
    for item in c.get("wear", []):
        wear(body, item, P, col)
    arms3(body, c.get("arms", "hang"), P)
    legs3(body, c["feet"], P)
    for k, bm in P.bms.items():
        _mesh(k, bm, [mats[k]], root)
    root.location, root.rotation_euler = loc, (0, 0, rz)
    return root


# --------------------------------------------------------------------------
# treatments
# --------------------------------------------------------------------------
CHAR, BONE, OLIVE, SAND, SLATE, KHAKI = (0.16, 0.16, 0.18), (0.9, 0.87, 0.8), (0.42, 0.45, 0.32), (0.86, 0.72, 0.56), \
    (0.36, 0.43, 0.56), (0.56, 0.5, 0.38)
SAGE, DLILAC, GUN, OXBLOOD, INKY, ORANGE2 = (0.6, 0.7, 0.58), (0.68, 0.6, 0.76), (0.27, 0.29, 0.32), (0.55, 0.1, 0.12), \
    (0.1, 0.09, 0.11), (1.0, 0.45, 0.15)
S = scheme

TREATMENTS = [
    ("art toy", (0.6, 0.6, 0.58), [(1.0, 1.0, 1.0, 1.0)], [
        dict(body="boxy-tall", colours=S(CHAR, feet=BONE), face="x-eyes", mark=BONE, arms="float", feet="peg",
             finish="matte"),
        dict(body="gumdrop-tall", colours=S(BONE, feet=CHAR), face="x-eyes", mark=CHAR, arms="float", feet="peg",
             finish="matte"),
    ]),
    ("streetwear", (0.5, 0.46, 0.43), [(1.0, 0.55, 0.25, 3.0)], [
        dict(body="gumdrop-tall", colours=S(SAND, legs=(0.25, 0.25, 0.27), feet=(0.95, 0.94, 0.9)), face="deadpan",
             wear=["hoodie"], hoodie=(0.13, 0.13, 0.14), arms="hang", feet="pants",
             accent=ORANGE2, finish="satin"),
        dict(body="slim", colours=S(SLATE, legs=KHAKI, feet=(0.12, 0.12, 0.13)), face="smirk", wear=["cap", "chain"],
             arms="hang", feet="pants", accent=(0.95, 0.94, 0.9), finish="satin"),
    ]),
    ("deadpan internet", (0.44, 0.48, 0.54), [(0.85, 0.75, 1.0, 2.0)], [
        dict(body="sausage", colours=S(SAGE, legs=(0.3, 0.32, 0.35), feet=DLILAC), face="side-eye", wear=["headphones"],
             cushion=DLILAC, arms="hang", feet="pants", accent=DLILAC, finish="matte"),
        dict(body="lean-drop", colours=S(DLILAC, legs=(0.3, 0.32, 0.35), feet=SAGE), face="deadpan", wear=["beanie"],
             beanie=SAGE, arms="hang", feet="pants", accent=SAGE, finish="matte"),
    ]),
    ("cyber", (0.05, 0.06, 0.09), [(0.2, 0.9, 1.0, 5.0), (1.0, 0.2, 0.8, 4.0)], [
        dict(body="boxy-tall", colours=S(GUN, legs=(0.08, 0.08, 0.1), feet=(0.08, 0.08, 0.1)), face="visor",
             led=(0.25, 1.0, 1.0), wear=["headphones"], phones=(0.8, 0.82, 0.85), phones_finish="chrome",
             cushion=(0.1, 0.1, 0.12), arms="hang", feet="pants", accent=(0.25, 1.0, 1.0), sole=(0.1, 0.1, 0.12),
             finish="metal"),
        dict(body="teardrop", colours=S(INKY, feet=(0.85, 0.87, 0.9)), face="visor", led=(1.0, 0.25, 0.85),
             wear=["chain"], gold=(0.85, 0.87, 0.9), arms="float", feet="float", finish="gloss"),
    ]),
    ("mischief", (0.2, 0.1, 0.15), [(1.0, 0.25, 0.25, 4.0)], [
        dict(body="potato", colours=S(OXBLOOD, legs=INKY, feet=INKY), face="fangs", mark=INKY, arms="hang",
             feet="pants", accent=(1.0, 0.25, 0.25), sole=(0.9, 0.87, 0.8), finish="satin"),
        dict(body="kiss", colours=S(INKY, legs=OXBLOOD, feet=INKY), face="fangs", mark=(1.0, 0.85, 0.3), wear=["chain"],
             arms="hang", feet="pants", accent=(1.0, 0.85, 0.3), finish="gloss"),
    ]),
    ("chrome y2k", (0.8, 0.82, 0.88), [(0.4, 0.55, 1.0, 4.0)], [
        dict(body="gumdrop-tall", colours=S((0.85, 0.87, 0.9), legs=(0.95, 0.94, 0.92), feet=(0.95, 0.94, 0.92)),
             face="smirk", arms="hang", feet="pants", accent=(0.14, 0.28, 0.85), finish="chrome"),
        dict(body="egg-up", colours=S((1.0, 0.72, 0.68), feet=(0.95, 0.94, 0.92)), face="deadpan", wear=["headphones"],
             phones=(0.95, 0.94, 0.92), cushion=(0.95, 0.94, 0.92), arms="float", feet="float", finish="chrome"),
    ]),
]


def treatment(i):
    name, bg, rims, chars = TREATMENTS[i]
    sc = stage(bg=bg)
    sc.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
    for j, (r, g, b, e) in enumerate(rims):
        l = bpy.data.objects.new(f"rim{j}", bpy.data.lights.new(f"rim{j}", "SUN"))
        l.data.energy, l.data.color, l.data.angle = e, (r, g, b), math.radians(10)
        l.rotation_euler = (math.radians(-65), math.radians(0), math.radians(150 if j % 2 == 0 else -150))
        sc.collection.objects.link(l)
    for j, c in enumerate(chars):
        character3(c, loc=((j - 0.5) * 1.55, 0, 0), rz=0.25 if j == 0 else -0.1)
    camera(sc, (1.0, -6.6, 1.55), (0, 0, 1.12), lens=48)
    render(sc, f"ya-{i + 1:02d}-{name.replace(' ', '-')}.png", 1000, 860)


def main3():
    global OUT
    argv = sys.argv[sys.argv.index("--") + 1:]
    globals()["OUT"] = os.path.abspath(argv[0])
    os.makedirs(globals()["OUT"], exist_ok=True)
    for w in argv[1:]:
        treatment(int(w))


main3()
