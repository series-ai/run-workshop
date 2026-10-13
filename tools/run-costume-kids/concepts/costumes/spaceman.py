"""Spaceman: the classic kid astronaut. A chunky opaque white
rounded-cube helmet (no glass) wraps the back and top of the kid's standard
head, open at the front so the whole face shows in a padded bezel, with radio
pods, a tall antenna light and a crown beacon, on a chunky silver collar; a puffy white suit with ring-quilted sleeves and legs, a chest
control box, chunky grey gloves and moon boots; a backpack life-support box
with two hoses curling round to the collar; a little flag (a planet on a
pennant) in one glove and the full bucket in the other."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

SUIT, SUIT_D, GREY, SILVER = (0.97, 0.97, 0.95), (0.80, 0.82, 0.86), (0.62, 0.64, 0.70), (0.78, 0.80, 0.86)
ORANGE, BLUE, RED, YEL, GREEN = (1.0, 0.5, 0.1), (0.2, 0.5, 0.95), (0.95, 0.25, 0.25), (1.0, 0.85, 0.15), (0.3, 0.8, 0.4)
HAIR = (0.3, 0.17, 0.09)
X90 = (math.radians(90), 0, 0)


def sweep(pts, radii, rgb, m=6):
    """One round tube through `pts` (a ring of m corners at each point, mitred so
    the bends keep their thickness), capped at both ends: a whole hose in one
    cheap piece instead of a bar and a ball per segment."""
    verts, faces = [], []
    for i, p in enumerate(pts):
        a, b = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
        t, k = (b - a).normalized(), 1.0
        if 0 < i < len(pts) - 1:
            t0, t1 = (p - a).normalized(), (b - p).normalized()
            t = (t0 + t1).normalized()
            k = 1.0 / max(0.5, t0.dot(t))  # mitre: keep the tube's thickness through the bend
        u = t.cross(Vector((0, -1, 0)))
        if u.length < 1e-4:
            u = t.cross(Vector((0, 0, 1)))
        u.normalize()
        v = u.cross(t).normalized()
        for j in range(m):
            ang = 2 * math.pi * (j + 0.5) / m
            verts.append(p + (u * math.cos(ang) * k + v * math.sin(ang)) * radii[i])
    for i in range(len(pts) - 1):
        for j in range(m):
            faces.append((i * m + j, i * m + (j + 1) % m, (i + 1) * m + (j + 1) % m, (i + 1) * m + j))
    faces.append(tuple(range(m - 1, -1, -1)))
    faces.append(tuple((len(pts) - 1) * m + j for j in range(m)))
    me = bpy.data.meshes.new("tube")
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    ob = bpy.data.objects.new("tube", me)
    bpy.context.scene.collection.objects.link(ob)
    return finish(ob, rgb)


def puff_limb(p0, p1, r, rgb, rings=2, ring_rgb=None):
    """A puffy padded sleeve: a bar with fat quilted rings along it."""
    limb(p0, p1, r, rgb, n=8)
    for k in range(rings):
        t = (k + 0.5) / rings
        p = tuple(a + (b - a) * t for a, b in zip(p0, p1))
        ball(*p, r * 2.7, r * 2.7, r * 2.2, ring_rgb or rgb, seg=7, ring=4)


def glove(x, y, z, s):
    hand_mitt(x, y, z, s, MITT * 1.1, GREY)
    can(x, y, z + 0.3, 0.22, 0.16, SUIT_D, n=8)  # the cuff ring


def helmet(cz=None, r=None, collar_rgb=SILVER, trim=ORANGE, beacon=True):
    """The helmet: the kid's standard head inside a chunky opaque white
    rounded-cube shell, open at the front so the whole face shows, framed by
    a padded bezel; radio pods on the sides, a tall antenna with a light and
    a beacon on the crown, sitting on the collar ring. No glass. Returns the
    shell's (half width, top z, front y) for add-ons. cz/r are kept for old
    callers and ignored."""
    with part("head"):  # the head, the shell, its bezel, pods, antenna and beacon
        head_cube(0, HEAD_Z, HEAD, SKIN, HAIR)
        hw, hd, hh = HEAD * 0.68, HEAD * 1.12, HEAD * 1.16      # shell half width, depth, height
        sz = HEAD_Z + 0.2 + HEAD * 0.05                         # shell centre z (its hem level with the base head's, so waving arms clear it)
        fy = -HEAD * 0.4                                        # the shell's front face (the face pokes through)
        sy = fy + hd / 2
        top = sz + hh / 2
        box(0, sy, sz, hw * 2, hd, hh, SUIT, bevel=0.7, segs=3)
        # the padded bezel round the open front (inner opening ~0.86 HEAD wide)
        ow, oz0, oz1 = HEAD * 0.45, HEAD_Z - 0.92, HEAD_Z + 0.92
        by, bt = fy - 0.1, 0.3
        bw = hw - ow + 0.05
        for s in (-1, 1):
            box(s * (ow + bw / 2 - 0.02), by, (oz0 + oz1) / 2, bw, bt, oz1 - oz0 + 0.5, SUIT_D, bevel=0.14)
        box(0, by, oz1 + 0.17, ow * 2 + 0.3, bt, 0.36, SUIT_D, bevel=0.12)
        box(0, by, oz0 - 0.15, ow * 2 + 0.3, bt, 0.34, SUIT_D, bevel=0.14)
        box(0, by - 0.16, oz1 + 0.19, 0.9, 0.06, 0.14, trim, bevel=0.03)        # a trim badge on the brow
        # radio pods on the sides
        for s in (-1, 1):
            can(s * (hw + 0.08), sy - 0.1, sz - 0.05, 0.62, 0.3, SUIT_D, n=10, rot=(0, math.radians(90), 0))
            can(s * (hw + 0.26), sy - 0.1, sz - 0.05, 0.4, 0.12, trim, n=10, rot=(0, math.radians(90), 0))
        # a tall antenna off the right pod with a glowing tip, and a beacon on the crown
        ax = hw + 0.28
        limb((ax, sy - 0.1, sz + 0.3), (ax + 0.35, sy - 0.1, top + 0.55), 0.05, SILVER)
        o = ball(ax + 0.35, sy - 0.1, top + 0.62, 0.3, 0.3, 0.3, RED, seg=8, ring=5)
        lamp(o, RED, 1.5)
        if beacon:
            can(0, sy, top - 0.05, 0.42, 0.2, SILVER, n=10)
            o = ball(0, sy, top + 0.12, 0.6, 0.6, 0.5, YEL, seg=10, ring=6)
            lamp(o, YEL, 1.2)
    # the collar ring the helmet sits on: part of the suit
    with part("chest"):
        can(0, 0, HEAD_Z - 1.4, 0.62, 0.34, collar_rgb, n=12)  # a neck ring, inside the swing of the arms
        can(0, 0, HEAD_Z - 1.23, 0.55, 0.08, SUIT_D, n=12)
    return hw, top, fy, sy


def lamp(o, rgb, strength=1.5):
    """An opaque glowing material (emission, not transparency) on o."""
    m = bpy.data.materials.new("lamp")
    m.use_nodes = True
    m.diffuse_color = (*rgb, 1.0)
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    lin = (*[c ** 2.2 for c in rgb], 1.0)
    bsdf.inputs["Base Color"].default_value = lin
    bsdf.inputs["Emission Color"].default_value = lin
    bsdf.inputs["Emission Strength"].default_value = strength
    o.data.materials.clear()
    o.data.materials.append(m)
    return o


def suit(trim=ORANGE):
    """The puffy white suit, backpack and hoses (shared look with the space cat)."""
    body(shirt=SUIT, pants=SUIT, leg_colour=SUIT, shoe=SUIT_D, torso=False, arms=False)
    for s in (-1, 1):  # chunky moon-boot cuffs over the shoes
        with part("foot.l" if s > 0 else "foot.r"):
            box(s * TW * 0.24, -0.05, FOOT * 0.62, 0.48, 0.5, 0.26, SUIT_D, bevel=0.1)
            box(s * TW * 0.24, -FOOT * 0.25, 0.06, FOOT * 0.8, FOOT * 1.2, 0.12, GREY, bevel=0.04)  # sole
    with part("chest"):  # the puffy torso, belt, chest box, trims, backpack and hoses
        # puffy torso: wider than the base torso, with a belt and a chest box
        box(0, 0, HIP + TH * 0.5 + 0.075, TW + 0.25, TD + 0.25, TH - 0.03, SUIT, bevel=0.22, segs=2)  # its hem clear of the lifting boots
        box(0, 0, HIP + 0.12, TW + 0.3, TD + 0.3, 0.16, GREY, bevel=0.06)
        fy = -(TD + 0.25) / 2
        box(0, fy - 0.04, HIP + 0.55, 0.62, 0.14, 0.38, SUIT_D, bevel=0.06)
        for k, c in enumerate((RED, YEL, GREEN)):
            can(-0.18 + k * 0.18, fy - 0.12, HIP + 0.6, 0.06, 0.06, c, n=8, rot=X90)
        box(0, fy - 0.12, HIP + 0.45, 0.4, 0.04, 0.08, BLUE)
        for s in (-1, 1):  # trim stripes on the shoulders
            box(s * 0.42, fy + 0.02, TOP - 0.1, 0.18, 0.08, 0.16, trim, bevel=0.03)
        # the backpack life-support box with two hoses up to the collar
        by = (TD + 0.25) / 2 + 0.28
        box(0, by, HIP + 0.5, 0.95, 0.6, 0.75, SUIT_D, bevel=0.14)  # low and narrow: clear of the helmet and the swinging bucket
        box(0, by + 0.3, HIP + 0.6, 0.7, 0.06, 0.4, SILVER, bevel=0.04)
        for s in (-1, 1):
            can(s * 0.36, by + 0.32, HIP + 0.3, 0.09, 0.06, trim, n=8, rot=X90)
            pts = [(s * 0.4, by - 0.1, HIP + 0.75), (s * 0.68, by - 0.2, HIP + 1.0), (s * 0.68, 0.05, TOP + 0.15), (s * 0.48, -0.2, TOP + 0.12)]  # into the neck ring, under the helmet
            sweep([Vector(p) for p in pts], [0.085] * len(pts), GREY, m=6)  # one bent hose


def planet(x, y, z, rgb=BLUE):
    can(x, y - 0.04, z, 0.15, 0.04, rgb, n=10, rot=X90)
    box(x, y - 0.06, z, 0.42, 0.04, 0.05, YEL, rot=(0, math.radians(20), 0))


def tilt(objs, at, deg):
    """Turn objs about the y axis through `at` (positive leans their tops towards +x)."""
    from mathutils import Matrix
    M = Matrix.Translation(at) @ Matrix.Rotation(math.radians(deg), 4, "Y") @ Matrix.Translation([-v for v in at])
    for o in objs:
        o.matrix_world = M @ o.matrix_world


def arms_flag_bucket(flag=ORANGE, emblem=planet):
    """Puffy arms: the left glove raises a little flag, the right carries the full bucket."""
    sx = TW * 0.5 + 0.18
    lh = (-1.5, -0.35, TOP - 0.2)
    with part("arm.r"):
        puff_limb((-sx, 0, TOP - 0.15), (lh[0] + 0.1, lh[1], lh[2] - 0.05), 0.13, SUIT, rings=2)
    with part("hand.r"):
        glove(*lh, -1)
    # the flag: a pole through the glove, a pennant with a planet on it, all one held prop
    before = set(bpy.data.objects)
    with part("prop.r"):
        px, py = lh[0] - 0.02, lh[1] - 0.2
        limb((px, py, lh[2] - 0.4), (px, py, lh[2] + 1.55), 0.035, SILVER)
        ball(px, py, lh[2] + 1.6, 0.12, 0.12, 0.12, YEL, seg=6, ring=4)
        box(px - 0.4, py, lh[2] + 1.27, 0.78, 0.04, 0.5, flag, bevel=0.02)
        emblem(px - 0.4, py, lh[2] + 1.27)
    tilt(set(bpy.data.objects) - before, lh, -55)  # the flag leans out, clear of the helmet
    rh = (sx + 0.27, -0.1, TOP - 0.68)  # the bucket hangs clear of the puffy suit
    with part("arm.l"):
        puff_limb((sx, 0, TOP - 0.15), (rh[0], rh[1], rh[2] + 0.3), 0.13, SUIT, rings=2)
    with part("hand.l"):
        glove(*rh, 1)
    bucket(rh, full=True, size=0.6)


def build():
    suit()
    arms_flag_bucket()
    helmet()


if __name__ == "__main__" or True:
    run({"spaceman": build})
