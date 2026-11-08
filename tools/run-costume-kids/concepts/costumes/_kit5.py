"""Shared helpers for the round-5 costumes (shark, bumblebee, dragon, jellyfish,
spider, devil, angel, scarecrow): free-form solids (bar, wedge, fin, lathe),
a see-through material, the standard hood with the full-size face opening,
and the arms (one hanging, one holding the bucket)."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket  # noqa: F401

SX = TW * 0.5 + 0.08                    # shoulder x
HOLD = (-1.15, -0.3, TOP - 0.2)         # the raised left mitt that carries the bucket
HANG = (SX + 0.18, -0.08, TOP - 0.66)   # the hanging right mitt


def bar(p0, p1, r0, r1, rgb, n=6):
    """A tapered bar from p0 (radius r0) to p1 (radius r1)."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o = can(0, 0, 0, r0, d.length, rgb, n=n, r2=r1)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.location = (p0 + p1) / 2
    return o


def chain(pts, r0, r1, rgb, n=6, joints=True, cols=None):
    """Bars through a list of points, tapering r0 -> r1, balls at the joints."""
    m = len(pts) - 1
    for i, (a, b) in enumerate(zip(pts, pts[1:])):
        ra, rb = r0 + (r1 - r0) * i / m, r0 + (r1 - r0) * (i + 1) / m
        c = cols[i % len(cols)] if cols else rgb
        bar(a, b, ra, rb, c, n=n)
        if joints and i < m - 1:
            ball(*b, rb * 2, rb * 2, rb * 2, c, seg=n, ring=4)


def wedge(pts_f, pts_b, rgb, bevel=0.0, segs=2):
    """A solid from a front polygon and a back polygon (same vertex count)."""
    import bmesh
    me = bpy.data.meshes.new("w")
    bm = bmesh.new()
    vf = [bm.verts.new(p) for p in pts_f]
    vb = [bm.verts.new(p) for p in pts_b]
    n = len(vf)
    bm.faces.new(vf)
    bm.faces.new(list(reversed(vb)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((vf[j], vf[i], vb[i], vb[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("w", me)
    bpy.context.scene.collection.objects.link(o)
    finish(o, rgb, bevel, segs)
    if bevel:
        o.modifiers["b"].limit_method = "ANGLE"
    return o


def plate(poly, axis, c, t, rgb, taper=None, bevel=0.0):
    """A flat slab from a 2D outline. axis 'x': the outline is in (y, z) and
    the slab is t thick around x = c; axis 'y': outline in (x, z) around
    y = c; axis 'z': outline in (x, y) around z = c. `taper` (per vertex,
    0-1) thins the slab towards tips."""
    taper = taper or [1.0] * len(poly)
    f, b = [], []
    for (u, v), k in zip(poly, taper):
        h = t * 0.5 * k
        if axis == "x":
            f.append((c - h, u, v)); b.append((c + h, u, v))
        elif axis == "y":
            f.append((u, c - h, v)); b.append((u, c + h, v))
        else:
            f.append((u, v, c - h)); b.append((u, v, c + h))
    return wedge(f, b, rgb, bevel)


def lathe(prof, rgb, n=12, at=(0, 0, 0), sy=1.0, wob=None, rot0=0.0, cap=True):
    """A solid of revolution round z through `at` from (r, z) profile points
    (bottom to top). `wob(a, r, z) -> dz` bends the rings (droopy brims)."""
    import bmesh
    me = bpy.data.meshes.new("l")
    bm = bmesh.new()
    rings = []
    for r, z in prof:
        if r <= 1e-6:
            rings.append([bm.verts.new((at[0], at[1], at[2] + z))])
            continue
        ring = []
        for k in range(n):
            a = 2 * math.pi * k / n + rot0
            dz = wob(a, r, z) if wob else 0.0
            ring.append(bm.verts.new((at[0] + r * math.cos(a), at[1] + r * math.sin(a) * sy, at[2] + z + dz)))
        rings.append(ring)
    for ra, rb in zip(rings, rings[1:]):
        for k in range(n):
            j = (k + 1) % n
            if len(ra) == 1:
                bm.faces.new((ra[0], rb[j], rb[k]))
            elif len(rb) == 1:
                bm.faces.new((ra[k], ra[j], rb[0]))
            else:
                bm.faces.new((ra[k], ra[j], rb[j], rb[k]))
    if cap:
        for ring in (rings[0], rings[-1]):
            if len(ring) > 2:
                bm.faces.new(ring)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("l", me)
    bpy.context.scene.collection.objects.link(o)
    return finish(o, rgb)


def glassy(o, alpha=0.5, glow=0.0):
    """Swap an object's material for a see-through copy of its colour."""
    src = o.data.materials[0]
    m = src.copy()
    m.diffuse_color = (*src.diffuse_color[:3], alpha)
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Alpha"].default_value = alpha
    bsdf.inputs["Roughness"].default_value = 0.35
    if glow:
        bsdf.inputs["Emission Color"].default_value = bsdf.inputs["Base Color"].default_value
        bsdf.inputs["Emission Strength"].default_value = glow
    for attr, val in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
        try:
            setattr(m, attr, val)
        except Exception:
            pass
    try:
        m.use_backface_culling = False
    except Exception:
        pass
    o.data.materials[0] = m
    return o


def hood(col, rim, w=HEAD * 1.14, d=HEAD * 1.02, h=HEAD * 1.08, y=0.12, zc=HEAD_Z + 0.06, bevel=0.5,
         ow=HEAD * 0.88, oh=HEAD * 0.72, rt=0.13, oz=None, hair=None, smile=True):
    """A hood enclosing the standard head and the kid's full-size face in its
    opening (a rim round a skin panel). Returns the hood's front y, top z,
    opening centre z and the face's front y."""
    with part("head"):
        return _hood(col, rim, w, d, h, y, zc, bevel, ow, oh, rt, oz, hair, smile)


def _hood(col, rim, w, d, h, y, zc, bevel, ow, oh, rt, oz, hair, smile):
    box(0, y, zc, w, d, h, col, bevel=bevel, segs=2)
    hf = y - d * 0.5
    oz = HEAD_Z - 0.14 if oz is None else oz
    box(0, hf + 0.46, oz, ow + 2 * rt, 1.0, oh + 2 * rt, rim, bevel=0.4, segs=2)
    box(0, hf + 0.42, oz, ow, 1.0, oh, SKIN, bevel=0.36, segs=2)
    ffy = hf - 0.08
    if hair:
        box(0, ffy + 0.06, oz + oh * 0.5 - 0.12, ow * 0.7, 0.2, 0.22, hair, bevel=0.06)
    face(0, HEAD_Z - HEAD * 0.05, ffy, HEAD, smile=smile)
    return {"front": hf, "top": zc + h * 0.5, "oz": oz, "ffy": ffy, "ow": ow, "oh": oh, "rt": rt}


def arms(sleeve, mitt=SKIN, full=True, size=0.6, hang=True, cuff=None, bucket_on=True):
    """Both arms: the right hangs (if `hang`), the left is raised a little and
    carries the pumpkin bucket. Returns the two mitt points."""
    if hang:
        with part("arm.l"):
            limb((SX, 0, TOP - 0.15), (SX + 0.16, -0.05, TOP - ARM_DROP), 0.11, sleeve)
            if cuff:
                can(SX + 0.15, -0.05, TOP - ARM_DROP + 0.04, 0.14, 0.1, cuff, n=8)
        with part("hand.l"):
            hand_mitt(*HANG, 1, MITT, mitt)
    hx, hy, hz = HOLD
    with part("arm.r"):
        limb((-SX, 0, TOP - 0.15), (hx + 0.12, hy, hz + 0.05), 0.11, sleeve)
        if cuff:
            bar((hx + 0.3, hy + 0.07, hz + 0.08), (hx + 0.18, hy + 0.03, hz + 0.06), 0.14, 0.14, cuff, n=8)
    with part("hand.r"):
        hand_mitt(hx, hy, hz, -1, MITT, mitt)
    if bucket_on:
        bucket((hx, hy, hz), full=full, size=size)
    return HOLD, HANG


def out_dir():
    return sys.argv[sys.argv.index("--") + 1]
