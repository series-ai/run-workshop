"""Wizard: the kid under an enormous royal-blue pointed hat dotted with
yellow stars and moons: a wide floppy wavy brim, a gold band, and a tall
crooked cone that bends over at the tip with a little gold bell. Bushy
white brows, a curly white moustache either side of the smile and a huge
white beard that hides most of the body down to the shoes. A blue robe
with wide bell sleeves, a gnarled wooden staff with a glowing crystal in
the right mitten, the full bucket in the left."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

R = math.radians
FY = -HEAD * 0.46
SX = TW * 0.5 + 0.08
HAT, HAT_D, STAR, GOLD = (0.24, 0.36, 0.90), (0.16, 0.24, 0.70), (1.0, 0.88, 0.25), (1.0, 0.72, 0.15)
BEARD, BEARD_D, ROBE, ROBE_D = (1.0, 1.0, 1.0), (0.86, 0.88, 0.94), (0.30, 0.44, 0.95), (0.20, 0.30, 0.78)
WOOD, WOOD_D, CRYSTAL, CRYSTAL_L = (0.60, 0.38, 0.20), (0.45, 0.27, 0.13), (0.35, 0.90, 1.0), (0.80, 1.0, 1.0)


def bar(p0, p1, r0, r1, rgb, n=6):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o = can(0, 0, 0, r0, d.length, rgb, n=n, r2=r1)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.location = (p0 + p1) / 2
    return o


def mesh_obj(verts, faces, rgb, t=0.0):
    me = bpy.data.meshes.new("m")
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new("m", me)
    bpy.context.scene.collection.objects.link(o)
    if t:
        sol = o.modifiers.new("s", "SOLIDIFY")
        sol.thickness = t
        sol.offset = 0
    return finish(o, rgb)


def star(cx, y, cz, r, rgb, t=0.06, spin=0.0, yaw=0.0):
    """A flat five-pointed star, facing -y turned by yaw about z."""
    v = [(0, 0, 0)]
    for i in range(10):
        a = math.pi / 2 + spin + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.45
        v.append((rr * math.cos(a), 0, rr * math.sin(a)))
    o = mesh_obj(v, [(0, 1 + i, 1 + (i + 1) % 10) for i in range(10)], rgb, t)
    o.rotation_euler = (0, 0, yaw)
    o.location = (cx, y, cz)
    return o


def moon(cx, y, cz, r, rgb, yaw=0.0):
    """A flat crescent moon facing -y."""
    pts = []
    for i in range(9):
        a = R(-120 + 240 * i / 8)
        pts.append((r * math.cos(a), r * math.sin(a)))
    for i in range(9):
        a = R(100 - 200 * i / 8)
        pts.append((r * 0.35 + r * 0.7 * math.cos(a), r * 0.75 * math.sin(a)))
    faces = [(i, i + 1, 9 + 7 - i, 9 + 8 - i) for i in range(8)]
    o = mesh_obj([(x, 0, z) for x, z in pts], faces, rgb, 0.06)
    o.rotation_euler = (0, 0, yaw)
    o.location = (cx, y, cz)
    return o


def brim(cz, r0, r1, droop, rgb, n=28, t=0.14):
    """A wide floppy brim: a ring that droops and waves at the edge."""
    v, f = [], []
    for i in range(n):
        a = 2 * math.pi * i / n
        wave = 0.16 * math.sin(3 * a + 0.6)
        v.append((r0 * math.cos(a), r0 * math.sin(a), cz))
        v.append((r1 * math.cos(a), r1 * math.sin(a), cz - droop + wave))
    for i in range(n):
        j = (i + 1) % n
        f.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
    o = mesh_obj(v, f, rgb, t)
    return o


def build():
    body(shirt=ROBE, pants=ROBE, leg_colour=ROBE, shoe=HAT_D, arms=False, torso=False)
    with part("body"):
        # the robe: a long blue column to the floor, a gold hem
        can(0, 0, 0.9, 0.46, 0.6, ROBE, n=10)  # a straight column past the mitts
        can(0, 0, 0.52, 0.5, 0.2, ROBE, n=10, r2=0.86, rot=(R(180), 0, 0))  # the flared hem, clear of the shoes
        can(0, 0, 0.46, 0.88, 0.1, GOLD, n=10)
    with part("chest"):
        box(0, 0, HIP + TH * 0.6, TW * 0.98, TD * 0.95, TH * 0.85, ROBE, bevel=0.1)
    # arms hanging in wide bell sleeves. Left (+x): the staff; right: the bucket
    hp = hand_points()
    for s in (-1, 1):
        side = "l" if s > 0 else "r"
        hx, hy, hz = hp[s]
        with part(f"arm.{side}"):
            limb((s * SX, 0, TOP - 0.12), (s * SX + s * 0.16, -0.05, TOP - ARM_DROP), 0.13, ROBE)
            bar((s * (SX + 0.06), -0.03, TOP - 0.25), (hx - s * 0.02, hy + 0.02, hz + 0.2), 0.16, 0.34, ROBE_D, n=8)
        with part(f"hand.{side}"):
            hand_mitt(hx, hy, hz, s, MITT, SKIN)
    bucket(hp[-1], full=True, size=0.55)
    with part("prop.l"):  # the whole staff, crystal and all, is one prop in the mitt
        # the gnarled staff, leaning out: a knobbly stick, a curl holding a crystal
        rh = hp[1]
        sy = rh[1]
        k_ = 0.8
        def at(z):
            return (rh[0] + 0.02 + k_ * (z - rh[2]), sy, z)
        zs = [rh[2] - 0.12, 1.6, 2.6, 3.6, 4.4]
        for i, (z0, z1) in enumerate(zip(zs, zs[1:])):
            bar(at(z0), at(z1), 0.1, 0.1, WOOD, n=6)
            ball(*at(z1), 0.24, 0.24, 0.24, WOOD_D, seg=6, ring=4)
        cx_, _, cz_ = at(4.8)
        for k in range(7):  # the curl round the crystal
            a = R(-120 + k * 45)
            ball(cx_ + 0.45 * math.cos(a), sy, cz_ + 0.45 * math.sin(a), 0.26, 0.26, 0.26, WOOD, seg=6, ring=4)
        ball(cx_, sy, cz_, 0.66, 0.66, 0.66, CRYSTAL, seg=10, ring=6)
        ball(cx_ - 0.12, sy - 0.26, cz_ + 0.12, 0.18, 0.1, 0.18, CRYSTAL_L, seg=6, ring=4)
    with part("head"):  # the head, the beard, the hat and its stars and moon
        wizard_head()


def wizard_head():
    # the head
    box(0, 0, HEAD_Z, HEAD, HEAD * 0.92, HEAD * 0.9, SKIN, bevel=HEAD * 0.14, segs=2)
    face(0, HEAD_Z - HEAD * 0.05, FY, HEAD)
    box(0, 0.3, HEAD_Z + 0.05, HEAD * 1.04, 0.8, HEAD * 0.75, BEARD_D, bevel=0.3, segs=2)  # white hair at the back
    # bushy white brows
    for s in (-1, 1):
        for k in range(3):
            ball(s * (0.32 + k * 0.17), FY - 0.08, HEAD_Z + 0.36 + k * 0.03, 0.3, 0.2, 0.22, BEARD, seg=6, ring=4)
    # the moustache: a big white puff over the mouth, curling up at the ends
    my = HEAD_Z - HEAD * 0.17
    ball(0, FY - 0.2, my, 0.75, 0.4, 0.42, BEARD, seg=10, ring=6)
    for s in (-1, 1):
        ball(s * 0.48, FY - 0.17, my - 0.02, 0.6, 0.36, 0.38, BEARD, seg=8, ring=5)
        ball(s * 0.82, FY - 0.14, my + 0.12, 0.38, 0.3, 0.3, BEARD, seg=8, ring=5)
        ball(s * 0.98, FY - 0.12, my + 0.3, 0.24, 0.24, 0.24, BEARD, seg=6, ring=4)
    ball(0, FY - 0.38, my + 0.18, 0.28, 0.16, 0.24, (1.0, 0.68, 0.62), seg=8, ring=5)  # a little round nose
    # the huge beard: one big white mass from the jaw tapering to a point by the shoes
    bz = HEAD_Z - 1.0
    ball(0, FY + 0.15, bz, 2.7, 0.9, 1.3, BEARD, seg=12, ring=7)
    o = can(0, FY + 0.15, bz - 0.95, 1.15, 1.6, BEARD, n=10, r2=0.1, rot=(R(180), 0, 0))
    o.scale = (1.0, 0.42, 1.0)
    for k in range(3):  # wavy curl ridges down the front
        z = bz - 0.45 - k * 0.42
        w = 1.0 - k * 0.28
        can(0, FY - 0.08 + k * 0.05, z, w, 0.1, BEARD_D, n=10).scale = (1.0, 0.25, 1.0)
    ball(0.12, FY + 0.05, bz - 1.75, 0.34, 0.3, 0.3, BEARD, seg=8, ring=5)  # the curled tip
    for s in (-1, 1):  # beard sides up to the ears
        ball(s * 1.15, -0.6, HEAD_Z - 0.5, 0.6, 0.9, 0.95, BEARD, seg=8, ring=5)
    # the hat: a wide floppy brim, a gold band, a tall cone bending over at the tip
    hz = HEAD_Z + HEAD * 0.42
    can(0, 0.05, hz + 0.1, 1.62, 0.7, HAT, n=16, r2=1.45)
    can(0, 0.05, hz + 0.22, 1.56, 0.3, GOLD, n=16, r2=1.5)
    brim(hz - 0.12, 1.4, 2.45, 0.38, HAT)
    path = [(0, 0.05, hz + 0.45), (0.0, 0.1, hz + 1.5), (0.1, 0.15, hz + 2.5), (0.35, 0.2, hz + 3.3), (0.8, 0.2, hz + 3.85), (1.35, 0.15, hz + 3.95), (1.7, 0.1, hz + 3.65)]
    radii = [1.42, 1.1, 0.8, 0.55, 0.38, 0.26, 0.16]
    for i, (a, b) in enumerate(zip(path, path[1:])):
        bar(a, b, radii[i], radii[i + 1], HAT, n=12)
        ball(*b, radii[i + 1] * 2, radii[i + 1] * 2, radii[i + 1] * 2, HAT, seg=12, ring=6)
    ball(1.78, 0.1, hz + 3.42, 0.34, 0.34, 0.34, GOLD, seg=8, ring=5)  # a little bell
    # stars and moons on the cone and the brim
    for x, z, r, yaw in ((-0.45, hz + 1.0, 0.36, 0.0), (0.42, hz + 1.55, 0.3, 0.0), (-0.1, hz + 2.35, 0.26, 0.0), (0.42, hz + 3.15, 0.2, 0.3)):
        rr = 1.42 - (z - hz - 0.45) * 0.31
        y = 0.1 - math.sqrt(max(rr * rr - x * x, 0.01)) - 0.02
        star(x, y, z, r, STAR, spin=0.2 * x)
    moon(0.5, -0.95, hz + 0.75, 0.3, STAR)
    for a in (-150, -110, -70, -30, 20, 60, 100, 160, 200):
        t = R(a)
        r = 2.05
        o = star(r * math.cos(t), r * math.sin(t), hz - 0.12 - 0.38 * (r - 1.4) / 1.05 + 0.16 * math.sin(3 * t + 0.6) + 0.1, 0.22, STAR)
        o.rotation_euler = (R(-90), 0, t + math.pi / 2)


if __name__ == "__main__" or True:
    render_costume("wizard", build, sys.argv[sys.argv.index("--") + 1], ortho=10.5, target_z=4.3)
