"""Cow abduction: a two-person cow costume caught by a flying saucer. The
front kid wears a big white cow head with black patches, a pink snout, little
horns and floppy ears, the kid's whole face showing in the hood opening; the mitts poke out under
the cow's belly, one with the full bucket. The cow's long patched body starts over the
front kid's legs and runs back to hide a
second kid: only their sneakers, a swishing tail and a pink udder show. A
little silver saucer (a green alien pilot sitting up out of it, waving; no
dome, no glass) bobs over the back half on a springy wire bolted to the
cow's back, as if lifting the cow away. No beam: nothing see-through."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from mathutils import Vector
from props import bucket

COW, PATCH, SNOUT, SNOUT_D = (0.98, 0.98, 0.96), (0.12, 0.11, 0.12), (1.0, 0.62, 0.7), (0.8, 0.38, 0.48)
HORN, SNEAK, HAIR = (0.98, 0.9, 0.62), (0.2, 0.62, 0.98), (0.3, 0.17, 0.09)
UFO, UFO_D, DOME, LIGHT = (0.78, 0.8, 0.86), (0.52, 0.55, 0.62), (0.62, 0.9, 1.0), (1.0, 0.9, 0.25)
ALIEN, BEAM = (0.45, 0.88, 0.32), (1.0, 0.95, 0.55)
JEANS = (0.16, 0.17, 0.22)
X90 = (math.radians(90), 0, 0)


def sweep(pts, radii, rgb, m=6):
    """One round tube through `pts` (a ring of m corners at each point, mitred so
    the bends keep their thickness), capped at both ends: the whole spring in one
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


def shoe_pair(y, x0=0.0):
    for s in (-1, 1):
        fx = x0 + s * TW * 0.24
        box(fx, y - FOOT * 0.25, FOOT * 0.22, FOOT * 0.75, FOOT * 1.15, FOOT * 0.44, SNEAK, bevel=FOOT * 0.14)
        limb((fx, y, FOOT * 0.4), (fx, y, 0.9), 0.11, COW)


def build():
    body(pants=COW, leg_colour=COW, shoe=SNEAK, torso=False, arms=False)
    with part("body"):
        # a little kid torso under the cow: the front kid's black jeans shorts, from the leg tops up
        # into the cow's body, so the legs never end in empty space when they swing
        box(0, 0, (HIP - 0.16 + 1.15) / 2, TW + 0.08, TD + 0.06, 1.15 - (HIP - 0.16), JEANS, bevel=0.1)
    with part("body"):
        # the cow's long body, starting over the front kid's legs and feet and running back to hide the second kid
        DY = -0.75
        by0, by1, bz0, bz1 = 0.2 + DY, 3.7 + DY, 0.8, 2.45
        byc, bzc = (by0 + by1) / 2, (bz0 + bz1) / 2
        box(0, byc, bzc, 2.3, by1 - by0, bz1 - bz0, COW, bevel=0.5, segs=2)
        for s in (-1, 1):  # patches on the flanks
            box(s * 1.16, 1.3 + DY + (0.25 if s > 0 else 0), 1.9, 0.06, 0.9, 0.6, PATCH)
            box(s * 1.16, 3.0 + DY - (0.3 if s > 0 else 0), 1.25, 0.06, 0.7, 0.5, PATCH)
        box(0.35, 1.0 + DY, bz1 + 0.01, 0.8, 0.7, 0.06, PATCH)
        box(-0.4, 3.2 + DY, bz1 + 0.01, 0.7, 0.5, 0.06, PATCH)
    # the second kid's sneakers under the back half
    with part("root"):  # the back kid's feet stay planted
        shoe_pair(2.95 + DY)
    with part("body"):
        # a pink udder with four teats
        uy = 2.0 + DY
        ball(0, uy, bz0 - 0.02, 0.8, 0.7, 0.5, SNOUT, seg=8, ring=5)
        for dx in (-0.18, 0.18):
            for dy in (-0.15, 0.15):
                can(dx, uy + dy, bz0 - 0.3, 0.06, 0.2, SNOUT_D, n=4)
        # the tail, flicking out, with a black tuft
        limb((0, by1 - 0.05, bz1 - 0.25), (0.35, by1 + 0.45, 1.3), 0.06, COW)
        ball(0.38, by1 + 0.5, 1.15, 0.3, 0.3, 0.42, PATCH, seg=6, ring=4)
    # the front kid's arms come out of the cow's flanks (the sleeves are the cow's), the mitts out
    # at their ends, clear of the cow's body; the right one holds the bucket
    for s_ in (-1, 1):
        side = "l" if s_ > 0 else "r"
        hand = (s_ * 1.68, -0.15, 0.95)
        with part("body"):
            limb((s_ * 1.0, -0.1, 1.15), (hand[0] - s_ * 0.16, hand[1], hand[2] + 0.06), 0.13, COW)
        with part("hand." + side):
            hand_mitt(*hand, s_, MITT, SKIN)
    bucket((1.68, -0.15, 0.95), full=True, size=0.62)
    # the cow's head is one block with its body (the kid's face looks out of it): it rides the hips
    with part("body"):
        # the cow hood: a big white rounded block enclosing the kid's head, patches,
        # the kid's full face in the opening, the cow's face (eyes, pink muzzle) above it
        hz, hh = HEAD_Z + 0.25, HEAD * 1.06 + 0.5
        hy, hd = 0.1, HEAD * 1.06
        box(0, hy, hz, HEAD * 1.14, hd, hh, COW, bevel=0.5, segs=2)
        hf = hy - hd / 2                     # hood front
        htop = hz + hh / 2
        box(-HEAD * 0.57, 0.35, hz - 0.2, 0.08, 1.0, 0.8, PATCH)
        box(HEAD * 0.57, 0.6, hz + 0.5, 0.08, 0.9, 0.7, PATCH)
        box(0.55, 0.5, htop, 1.0, 1.1, 0.08, PATCH)
        box(-HEAD * 0.42, hf - 0.01, hz + 1.1, 0.7, 0.06, 0.6, PATCH)
        fz = HEAD_Z - HEAD * 0.05
        box(0, -0.3, fz, HEAD * 0.98, HEAD * 0.8, HEAD * 0.84, PATCH, bevel=0.22, segs=2)
        box(0, -0.37, fz - 0.03, HEAD * 0.86, HEAD * 0.76, HEAD * 0.74, SKIN, bevel=0.14, segs=2)
        ffy = -0.37 - HEAD * 0.38
        box(0, ffy + 0.04, fz + HEAD * 0.29, HEAD * 0.86, 0.2, HEAD * 0.16, HAIR, bevel=0.06)  # fringe
        face(0, fz, ffy, HEAD * 0.86)
        # the cow's own face over the opening: a big pink muzzle brim with nostrils, eyes above
        sz = fz + HEAD * 0.42 + 0.22
        box(0, hf - 0.2, sz, HEAD * 0.92, 0.7, 0.62, SNOUT, bevel=0.22)
        for s in (-1, 1):
            ball(s * 0.45, hf - 0.56, sz + 0.02, 0.36, 0.08, 0.24, SNOUT_D, seg=6, ring=4)
            ex, ez = s * 0.72, sz + 0.62
            ball(ex, hf - 0.02, ez, 0.48, 0.16, 0.48, DARK, seg=8, ring=5)
            ball(ex - 0.08, hf - 0.09, ez + 0.09, 0.14, 0.06, 0.14, WHITE, seg=6, ring=4)
        # big horns and wide floppy ears
        for s in (-1, 1):
            can(s * 0.95, hy - 0.1, htop + 0.4, 0.26, 0.9, HORN, n=8, r2=0.06, rot=(0, s * math.radians(28), 0))
            ear = (0, s * math.radians(-28), 0)
            box(s * (HEAD * 0.57 + 0.5), -0.1, hz + 0.6, 0.95, 0.26, 0.5, COW, bevel=0.12, rot=ear)
            box(s * (HEAD * 0.57 + 0.55), -0.24, hz + 0.58, 0.62, 0.06, 0.28, SNOUT, rot=ear)
    with part("body"):
        # the flying saucer over the back half, part of the costume: it rides a
        # springy wire (a coiled spring) bolted to a plate on the cow's back
        ux, uy, uz = 0.0, 2.3 + DY, 5.2
        can(ux, uy, bz1 + 0.04, 0.38, 0.1, UFO_D, n=12)                          # the mounting plate
        n, r = 24, 0.17
        pts = [(ux + r * math.cos(k * 1.2), uy + r * math.sin(k * 1.2), bz1 + 0.08 + (uz - 0.3 - bz1 - 0.08) * k / n) for k in range(n + 1)]
        sweep([Vector(p) for p in pts], [0.055] * len(pts), UFO_D, m=4)  # the coil in one thin tube
        can(ux, uy, uz - 0.18, 0.75, 0.22, UFO_D, n=12, r2=1.35)
        can(ux, uy, uz + 0.04, 1.35, 0.22, UFO, n=12, r2=1.0)
        can(ux, uy, uz + 0.2, 0.62, 0.12, UFO_D, n=12)                          # the cockpit rim the alien sits in
        for i in range(10):
            a = 2 * math.pi * i / 10
            ball(ux + 1.3 * math.cos(a), uy + 1.3 * math.sin(a), uz - 0.04, 0.2, 0.2, 0.16, LIGHT, seg=6, ring=3)
        # a tiny alien pilot sitting up out of the cockpit, waving
        ball(ux, uy, uz + 0.45, 0.6, 0.55, 0.62, ALIEN, seg=8, ring=6)
        for s in (-1, 1):
            ball(ux + s * 0.13, uy - 0.25, uz + 0.48, 0.17, 0.08, 0.22, DARK, seg=6, ring=4)
            limb((ux + s * 0.12, uy, uz + 0.7), (ux + s * 0.2, uy, uz + 0.9), 0.025, ALIEN)
            box(ux + s * 0.2, uy, uz + 0.92, 0.09, 0.09, 0.09, LIGHT)


if __name__ == "__main__" or True:
    render_costume("cow-abduction", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
