"""Bean kit, round 4: the art-toy lane.

Builds on beankit3.py and adds
    art faces   x, dots, slits, holes, stitch, cyclops-dot, bones, tired, drip, glyph, blank
    editions    black, bone, gold, clear, glow, camo, marble, terrazzo, split, gradient
                (one finish over the whole figure, like vinyl colourways)
    limbs       chunky arms / legs with joint seams (Bearbrick-ish), float hands
    display     round plinths, a spotlit "series" shelf

    Blender -b --factory-startup --python beankit4.py -- <out dir> <sheet>:<index> | shelf
Sheets: faces (11), editions (10), bodies (8).
"""
import math
import os
import sys

_here = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(_here, "beankit3.py")).read()
exec(compile(_src[: _src.rindex("\nmain3()")], "beankit3.py", "exec"))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

FEET_Z0["chunky"] = 0.3
PLINTH_H = 0.12


# --------------------------------------------------------------------------
# editions: one shader over the whole figure
# --------------------------------------------------------------------------
def _ramp(nt, src, stops, interp="CONSTANT"):
    r = nt.nodes.new("ShaderNodeValToRGB")
    r.color_ramp.interpolation = interp
    els = r.color_ramp.elements
    while len(els) < len(stops):
        els.new(0.5)
    for e, (pos, rgb) in zip(els, stops):
        e.position = pos
        e.color = (*[lin(c) for c in rgb], 1)
    nt.links.new(src, r.inputs["Fac"])
    return r


def edition_mat(name, ed):
    base = {"black": ((0.12, 0.12, 0.13), "matte"), "bone": ((0.9, 0.87, 0.8), "matte"),
            "gold": ((1.0, 0.78, 0.38), "chrome"), "clear": ((0.75, 0.85, 0.95), "gloss"),
            "glow": ((0.78, 0.95, 0.72), "matte"), "camo": ((0.42, 0.45, 0.32), "matte"),
            "marble": ((0.93, 0.92, 0.9), "satin"), "terrazzo": ((0.92, 0.89, 0.84), "matte"),
            "split": ((0.9, 0.87, 0.8), "matte"), "gradient": ((1.0, 0.5, 0.4), "satin")}[ed]
    m = finish_mat(name, base[0], base[1])
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    if ed == "clear":
        b.inputs["Alpha"].default_value = 0.35
        b.inputs["Roughness"].default_value = 0.05
        for attr, v in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND"), ("use_backface_culling", False)):
            try:
                setattr(m, attr, v)
            except Exception:
                pass
    elif ed == "glow":
        b.inputs["Emission Color"].default_value = (*[lin(c) for c in (0.55, 1.0, 0.5)], 1)
        b.inputs["Emission Strength"].default_value = 0.6
    elif ed == "camo":
        n = nt.nodes.new("ShaderNodeTexNoise")
        n.inputs["Scale"].default_value = 2.2
        n.inputs["Detail"].default_value = 1.5
        nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
        r = _ramp(nt, n.outputs["Fac"], [(0.0, (0.3, 0.33, 0.22)), (0.45, (0.47, 0.5, 0.34)), (0.55, (0.62, 0.58, 0.42)),
                                          (0.62, (0.18, 0.17, 0.14))])
        nt.links.new(r.outputs["Color"], b.inputs["Base Color"])
    elif ed == "marble":
        w = nt.nodes.new("ShaderNodeTexWave")
        w.inputs["Scale"].default_value = 1.6
        w.inputs["Distortion"].default_value = 9.0
        w.inputs["Detail"].default_value = 4.0
        nt.links.new(tc.outputs["Object"], w.inputs["Vector"])
        r = _ramp(nt, w.outputs["Fac"], [(0.0, (0.93, 0.92, 0.9)), (0.9, (0.93, 0.92, 0.9)), (0.975, (0.35, 0.36, 0.4))],
                  "LINEAR")
        nt.links.new(r.outputs["Color"], b.inputs["Base Color"])
    elif ed == "terrazzo":
        v = nt.nodes.new("ShaderNodeTexVoronoi")
        v.inputs["Scale"].default_value = 9.0
        v.feature = "F1"
        nt.links.new(tc.outputs["Object"], v.inputs["Vector"])
        d = _ramp(nt, v.outputs["Distance"], [(0.0, (0.0, 0.0, 0.0)), (0.22, (1.0, 1.0, 1.0))])
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        nt.links.new(d.outputs["Color"], mix.inputs["Factor"])
        nt.links.new(v.outputs["Color"], mix.inputs[6])
        mix.inputs[7].default_value = (*[lin(c) for c in (0.92, 0.89, 0.84)], 1)
        hue = nt.nodes.new("ShaderNodeHueSaturation")
        hue.inputs["Saturation"].default_value = 0.55
        hue.inputs["Value"].default_value = 1.1
        nt.links.new(mix.outputs[2], hue.inputs["Color"])
        nt.links.new(hue.outputs["Color"], b.inputs["Base Color"])
    elif ed == "split":
        sx = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["Object"], sx.inputs["Vector"])
        r = _ramp(nt, sx.outputs["X"], [(0.0, (0.12, 0.12, 0.13)), (0.5, (0.9, 0.87, 0.8))])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["From Min"].default_value, mr.inputs["From Max"].default_value = -1.0, 1.0
        nt.links.new(sx.outputs["X"], mr.inputs["Value"])
        nt.links.new(mr.outputs["Result"], r.inputs["Fac"])
        nt.links.new(r.outputs["Color"], b.inputs["Base Color"])
    elif ed == "gradient":
        sx = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["Object"], sx.inputs["Vector"])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["From Min"].default_value, mr.inputs["From Max"].default_value = 0.1, 2.0
        nt.links.new(sx.outputs["Z"], mr.inputs["Value"])
        r = _ramp(nt, mr.outputs["Result"], [(0.0, (0.25, 0.2, 0.55)), (0.5, (1.0, 0.35, 0.45)), (1.0, (1.0, 0.75, 0.35))],
                  "LINEAR")
        nt.links.new(r.outputs["Color"], b.inputs["Base Color"])
    return m


MARK_FOR = {"black": (0.9, 0.87, 0.8), "camo": (0.12, 0.12, 0.1), "gold": (0.12, 0.1, 0.08), "clear": (0.1, 0.1, 0.12),
            "glow": (0.15, 0.2, 0.15), "gradient": (0.1, 0.08, 0.12), "split": None}


# --------------------------------------------------------------------------
# art faces (flush graphic marks)
# --------------------------------------------------------------------------
def line(P, body, a, b, r=0.02, key="mark", off=0.01, n=5):
    pts = [on(body, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, off)[0] for t in [i / (n - 1) for i in range(n)]]
    sweep(P[key], pts, r, segs=8)


def dot(P, body, x, z, rx, rz, key="mark", off=0.0, depth=0.02):
    p, nr = on(body, x, z, off)
    ell(P[key], p, (rx, depth, rz), nr)


def face4(body, kind, P):
    ex, ez = eye_pos(body)
    mz = ez - 0.2
    if kind == "x":
        for s in (-1, 1):
            line(P, body, (s * ex - 0.06, ez - 0.06), (s * ex + 0.06, ez + 0.06), 0.024)
            line(P, body, (s * ex - 0.06, ez + 0.06), (s * ex + 0.06, ez - 0.06), 0.024)
    elif kind == "dots":
        for s in (-1, 1):
            dot(P, body, s * (ex + 0.04), ez, 0.035, 0.035)
    elif kind == "slits":
        for s in (-1, 1):
            line(P, body, (s * ex - 0.055, ez), (s * ex + 0.055, ez), 0.018)
    elif kind == "holes":
        for s in (-1, 1):
            dot(P, body, s * ex, ez, 0.065, 0.075, key="hole", off=-0.012, depth=0.03)
    elif kind == "stitch":
        line(P, body, (-ex - 0.06, ez - 0.06), (-ex + 0.06, ez + 0.06), 0.022)
        line(P, body, (-ex - 0.06, ez + 0.06), (-ex + 0.06, ez - 0.06), 0.022)
        dot(P, body, ex, ez, 0.04, 0.04)
        line(P, body, (-0.1, mz), (0.1, mz), 0.012)
        for i in range(5):
            x = -0.08 + 0.04 * i
            line(P, body, (x, mz - 0.03), (x, mz + 0.03), 0.01, n=3)
    elif kind == "cyclops-dot":
        dot(P, body, 0, ez, 0.045, 0.045)
    elif kind == "bones":
        for s in (-1, 1):
            dot(P, body, s * ex, ez, 0.075, 0.07, key="hole", off=-0.012, depth=0.03)
        p, nr = on(body, 0, ez - 0.1, -0.005)
        ell(P["hole"], p, (0.025, 0.02, 0.035), nr)
        line(P, body, (-0.1, mz - 0.03), (0.1, mz - 0.03), 0.01)
        for i in range(6):
            x = -0.1 + 0.04 * i
            line(P, body, (x, mz - 0.07), (x, mz + 0.01), 0.008, n=3)
    elif kind == "tired":
        for s in (-1, 1):
            pts = [(s * ex + 0.06 * math.cos(a), ez + 0.02 - 0.04 * math.sin(a)) for a in [math.pi * i / 6 for i in range(7)]]
            sweep(P["mark"], [on(body, x, z, 0.01)[0] for x, z in pts], 0.016, segs=8)
            line(P, body, (s * ex - 0.04, ez - 0.07), (s * ex + 0.04, ez - 0.075), 0.008, n=3)
        line(P, body, (-0.035, mz), (0.035, mz), 0.012, n=3)
    elif kind == "drip":
        for s, ln in ((-1, 0.22), (1, 0.12)):
            dot(P, body, s * ex, ez, 0.045, 0.045)
            line(P, body, (s * ex, ez - 0.03), (s * ex, ez - ln), 0.016, n=4)
            dot(P, body, s * ex, ez - ln - 0.01, 0.024, 0.03)
    elif kind == "glyph":
        for s in (-1, 1):
            line(P, body, (s * ex - 0.055, ez), (s * ex + 0.055, ez), 0.02, n=3)
            line(P, body, (s * ex, ez - 0.055), (s * ex, ez + 0.055), 0.02, n=3)


# --------------------------------------------------------------------------
# chunky limbs with joint seams
# --------------------------------------------------------------------------
def seam(P, c, r, axis):
    sweep(P["seam"], ring_pts(c, r, axis, 32), 0.007, segs=6, closed=True)


def limbs4(body, arms, legs, P):
    s = body.s
    for sg in (-1, 1):
        z = body.z0 + 0.5 * s["h"]
        p, nr = body.side(sg, z)
        X = lambda v: Vector((sg * v[0], v[1], v[2]))
        if p is not None:
            if arms == "chunky":
                a = p - X((0.05, 0, 0))
                d = X((0.78, -0.06, -0.62)).normalized()
                e = a + d * 0.34
                sweep(P["arms"], [a + (e - a) * i / 12 for i in range(13)], 0.095, segs=18)  # enough rings to bend at the elbow
                ell(P["arms"], p - X((0.02, 0, 0)), (0.097, 0.097, 0.097))                 # a round arm end, flush with the arm
                hand(P, e + d * 0.08, 0.125, sgn=sg)
            elif arms == "float":
                hand(P, p + X((0.22, -0.05, -0.3)), 0.12, sgn=sg)
        x = sg * s["leg"][2]
        if legs == "chunky":
            # one clean tapered post from inside the body to inside the shoe: no seam rings, no end poking
            # out of the sole (its rounded end stops 7 cm above the floor, inside the foot)
            sweep(P["legs"], [Vector((x, 0, body.z0 + 0.12)), Vector((x, -0.01, 0.15))], [0.112, 0.1], segs=44,
                  caps=False)                                   # both ends are hidden (body, shoe): no mismatched end caps
            ell(P["feet"], (x * 1.04, -0.06, 0.085), (0.15, 0.21, 0.09), segs=56, rings=28)
            # a shoe collar round the ankle: hides where the post enters the shoe (no jagged "trunk" ring)
            ell(P["feet"], (x * 1.02, -0.012, 0.165), (0.118, 0.118, 0.042), segs=48, rings=16)
        elif legs == "peg":
            sweep(P["legs"], [Vector((x, 0, body.z0 + 0.1)), Vector((x * 0.85, -0.02, 0.08))], [0.11, 0.06], segs=16)
            ell(P["feet"], (x * 0.85, -0.04, 0.065), (0.09, 0.1, 0.065))


def figure(body_kind, edition, face, arms="chunky", legs="chunky", loc=(0, 0, 0), rz=0.0, plinth=None):
    spec = BODIES[body_kind]
    body = Body(spec)
    body.z0 = FEET_Z0.get(legs) or body.z0
    root = bpy.data.objects.new(f"fig-{body_kind}", None)
    bpy.context.scene.collection.objects.link(root)
    em = edition_mat(f"ed-{edition}", edition)
    mark = MARK_FOR.get(edition, (0.1, 0.09, 0.11))
    mats = {k: em for k in ("body_top", "body_bottom", "arms", "hands", "legs", "feet")}
    mats["mark"] = plastic("mark", mark or (0.1, 0.09, 0.11), rough=0.4, coat=0.2)
    mats["hole"] = plastic("hole", (0.02, 0.02, 0.025), rough=0.9, coat=0.0)
    sm = plastic("seam", (0.0, 0.0, 0.0), rough=0.8, coat=0.0)
    sm.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value = 0.3
    for attr, v in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
        try:
            setattr(sm, attr, v)
        except Exception:
            pass
    mats["seam"] = sm
    _mesh("body", body.build(), [em, em], root)
    P = Parts()
    face4(body, face, P)
    limbs4(body, arms, legs, P)
    for k, bm in P.bms.items():
        _mesh(k, bm, [mats[k]], root)
    if edition == "split":
        # marks flip colour across the split
        for ob in root.children:
            if ob.name.startswith("mark"):
                m = plastic("mark-split", (0.5, 0.5, 0.5), rough=0.4, coat=0.2)
                nt = m.node_tree
                tc = nt.nodes.new("ShaderNodeTexCoord")
                sx = nt.nodes.new("ShaderNodeSeparateXYZ")
                nt.links.new(tc.outputs["Object"], sx.inputs["Vector"])
                mr = nt.nodes.new("ShaderNodeMapRange")
                mr.inputs["From Min"].default_value, mr.inputs["From Max"].default_value = -1.0, 1.0
                nt.links.new(sx.outputs["X"], mr.inputs["Value"])
                r = _ramp(nt, mr.outputs["Result"], [(0.0, (0.9, 0.87, 0.8)), (0.5, (0.12, 0.12, 0.13))])
                nt.links.new(r.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
                ob.data.materials[0] = m
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


# --------------------------------------------------------------------------
# sheets
# --------------------------------------------------------------------------
ART_FACES = ["x", "dots", "slits", "holes", "stitch", "cyclops-dot", "bones", "tired", "drip", "glyph", "blank"]
EDITIONS = ["black", "bone", "gold", "clear", "glow", "camo", "marble", "terrazzo", "split", "gradient"]
ART_BODIES = ["boxy-tall", "gumdrop-tall", "sausage", "kiss", "egg-up", "brick", "pawn", "lean-drop"]
SERIES = [
    ("boxy-tall", "black", "x"), ("gumdrop-tall", "marble", "slits"), ("sausage", "camo", "tired"),
    ("kiss", "gold", "dots"), ("brick", "split", "stitch"), ("egg-up", "terrazzo", "holes"),
    ("pawn", "bone", "bones"), ("lean-drop", "gradient", "drip"), ("gumdrop", "clear", "glyph"),
    ("bell", "glow", "cyclops-dot"),
]
CONCRETE = (0.6, 0.6, 0.58)


def art_stage(bg=CONCRETE):
    sc = stage(bg=bg)
    sc.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.7
    return sc


def card4(sheet, i):
    sc = art_stage()
    if sheet == "faces":
        figure("gumdrop-tall", "bone", ART_FACES[i], rz=0.25)
        camera(sc, (0.55, -3.9, 1.7), (0, 0, 1.35), lens=60)
        render(sc, f"art-faces-{i + 1:02d}.png", 560, 620)
        return
    if sheet == "editions":
        figure("boxy-tall", EDITIONS[i], "x", rz=0.3)
    elif sheet == "bodies":
        figure(ART_BODIES[i], "black", "dots", rz=0.3)
    camera(sc, (1.05, -5.6, 1.45), (0, 0, 1.12), lens=50)
    render(sc, f"art-{sheet}-{i + 1:02d}.png", 560, 800)


def shelf():
    sc = art_stage(bg=(0.16, 0.16, 0.17))
    for ob in list(sc.collection.objects):
        if ob.type == "LIGHT":
            ob.data.energy *= 0.35
    n = len(SERIES)
    for i, (b, ed, f) in enumerate(SERIES):
        x = (i - (n - 1) / 2) * 1.45
        figure(b, ed, f, loc=(x, 0, 0), rz=0.12, plinth=(0.22, 0.22, 0.24))
        sp = bpy.data.objects.new(f"spot{i}", bpy.data.lights.new(f"spot{i}", "SPOT"))
        sp.data.energy, sp.data.spot_size, sp.data.spot_blend, sp.data.shadow_soft_size = 260, math.radians(32), 0.5, 0.4
        sp.data.color = (1.0, 0.96, 0.9)
        sp.location = (x + 0.4, -1.6, 4.6)
        sp.rotation_euler = (Vector((x, 0, 1.0)) - sp.location).to_track_quat("-Z", "Y").to_euler()
        sc.collection.objects.link(sp)
    camera(sc, (1.2, -17.0, 2.4), (0, 0, 1.0), lens=36)
    render(sc, "art-series-shelf.png", 2400, 900)


def main4():
    argv = sys.argv[sys.argv.index("--") + 1:]
    globals()["OUT"] = os.path.abspath(argv[0])
    os.makedirs(globals()["OUT"], exist_ok=True)
    for w in argv[1:]:
        if w == "shelf":
            shelf()
        else:
            sheet, i = w.split(":")
            card4(sheet, int(i))


main4()
