"""Bolt-On Racers core: palette, geometry helpers, wheels and chassis.

Conventions (shared with shared/kit.py): z up, ground at z = 0, vehicles face -y.
Driver's left is +x (the side the board camera sees), so wheel_FL sits at +x, -y.

A chassis is data + a builder. chassis_snaps(name) returns its named attach
points (chassis space, before any wheel lift). Wheels are built from the hub
flange (x = 0) outward, so any wheel width fits any chassis without clipping.
"""
import math
import os
import sys
from contextlib import contextmanager

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "shared"))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import kit  # noqa: E402
from kit import C, V, at, box, cyl, cone, ell, lathe, torus, loft, tube, slab, blade  # noqa: E402,F401

# ---------------------------------------------------------------- palette
RED, YEL, TEAL = C(234, 62, 56), C(255, 198, 40), C(28, 182, 168)
BLUE, WHITE, ORANGE = C(48, 108, 222), C(246, 244, 238), C(255, 130, 32)
CHAR, TYRE, BLACK = C(58, 58, 68), C(40, 40, 48), C(28, 28, 34)
CHROME, STEEL, PLATE = C(212, 216, 224), C(150, 156, 170), C(190, 194, 204)
GLASS, VISOR = C(120, 178, 222), C(40, 62, 100)
LAMP, TAILL = C(255, 244, 190), C(216, 34, 44)
TAN, PINK, SAUSAGE, CREAM = C(228, 168, 92), C(255, 146, 184), C(206, 86, 66), C(255, 236, 200)
SHARK = C(108, 142, 182)
MET = dict(metal=0.3, rough=0.32)
GLOSS = dict(rough=0.42)

# Snap marker colours (anatomy board)
MARK = {
    "wheel": YEL, "body": RED, "seat": C(120, 220, 80), "roof": BLUE, "front": ORANGE,
    "rear": C(170, 90, 230), "tail": C(255, 120, 200), "exhaust": BLACK, "side": TEAL,
    "hood": C(255, 255, 255), "mast": C(140, 90, 40),
}


def shade(c, k):
    return tuple(max(0.0, min(1.0, x * k)) for x in c)


def mix(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


# ---------------------------------------------------------------- geometry helpers

@contextmanager
def at_m(M):
    """Push an arbitrary 4x4 matrix onto kit's transform stack."""
    kit._xf.append(kit._xf[-1] @ M)
    try:
        yield
    finally:
        kit._xf.pop()


def poly(verts, faces, rgb, bevel=0.0, seg=1, **m):
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in verts]
    for f in faces:
        bm.faces.new([vs[i] for i in f])
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=seg, affect="EDGES",
                        clamp_overlap=True, profile=0.5)
    return kit._bm_obj(bm, "p", rgb, **m)


def tbox(z0, z1, bot, top, rgb, bevel=0.0, seg=1, **m):
    """Tapered box. bot / top = (half_x, y_front, y_rear) at z0 / z1."""
    (bx, b0, b1), (tx, t0, t1) = bot, top
    v = [(-bx, b0, z0), (bx, b0, z0), (bx, b1, z0), (-bx, b1, z0),
         (-tx, t0, z1), (tx, t0, z1), (tx, t1, z1), (-tx, t1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return poly(v, f, rgb, bevel, seg, **m)


def xslab(pts, w, rgb, x=0.0, bevel=0.0, seg=1, **m):
    """Side-profile prism: outline [(y, z)] extruded across x (width w, centred on x)."""
    n = len(pts)
    v = [(x - w / 2, y, z) for y, z in pts] + [(x + w / 2, y, z) for y, z in pts]
    f = [tuple(range(n))[::-1], tuple(range(n, 2 * n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return poly(v, f, rgb, bevel, seg, **m)


def rod(p0, p1, r, rgb, n=6, **m):
    return loft([(V(p0), r, r), (V(p1), r, r)], rgb, n=n, **m)


def spring(p0, p1, r, rgb, turns=4, t=0.013):
    p0, p1 = V(p0), V(p1)
    d = p1 - p0
    u, v = kit.frame(d)
    k = turns * 6
    pts = [p0 + d * (i / k) + (u * math.cos(i / 6 * 2 * math.pi) + v * math.sin(i / 6 * 2 * math.pi)) * r
           for i in range(k + 1)]
    tube(pts, lambda _t: t, rgb, rings=k * 2, n=5, **MET)


def star(r=0.06, k=0.45, pts=5):
    """2D star outline [(x, y)]."""
    out = []
    for i in range(pts * 2):
        a = math.pi / 2 + math.pi * i / pts
        rr = r if i % 2 == 0 else r * k
        out.append((rr * math.cos(a), rr * math.sin(a)))
    return out


def cast(o, d, maxd=4.0):
    """Ray cast in the current local frame (kit transform stack). Returns (loc, normal) or None."""
    M = kit._xf[-1]
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ok, loc, nrm, *_ = bpy.context.scene.ray_cast(dg, M @ V(o), (M.to_3x3() @ V(d)).normalized(), distance=maxd)
    if not ok:
        return None
    Mi = M.inverted()
    return Mi @ loc, (Mi.to_3x3() @ nrm).normalized()


def guard(c, R, start, arc, col, t=0.03):
    """A wheel mudguard arc in the yz plane around c. Angle 180 is the top, 270 the front."""
    with at(c, ry=90):
        torus(R, t, (0, 0, 0), col, n=12, k=4, arc=arc, rz=start, **GLOSS)


def marker(p, kind, s=1.0):
    """A small snap-point marker: a faceted bead on a tiny pin."""
    ell(p, 0.034 * s, MARK[kind], seg=8, ring=6, emit=0.25, rough=0.3)


# ---------------------------------------------------------------- wheels
# Every wheel kind is built for the +x (left) side, from the hub flange at x = 0
# outward. Right-side wheels are mirrored. r is the effective radius.

def tyre(r, w, ri=0.56, n=12, col=TYRE):
    """Closed tyre ring around the x axis, centred at x = 0."""
    lathe([(r * ri, -w / 2), (r * 0.84, -w / 2), (r, -w * 0.3), (r, w * 0.3), (r * 0.84, w / 2),
           (r * ri, w / 2), (r * ri, -w / 2)], (0, 0, 0), col, n=n, ry=90, cap=False, rough=0.9)


def core(r, w, x1=None, col=CHAR):
    x0 = -w / 2 + 0.006
    x1 = w / 2 - 0.02 if x1 is None else x1
    cyl(r, x1 - x0, (x0, 0, 0), col, n=12, ry=90)


def _around(n, R, phase=0.0):
    for i in range(n):
        a = phase + 2 * math.pi * i / n
        yield i, a, (0, R * math.sin(a), R * math.cos(a))


def _slick(r, w, acc):
    tyre(r, w, ri=0.6)
    core(r * 0.6, w)
    cyl(r * 0.58, 0.026, (w / 2 - 0.02, 0, 0), acc, n=12, ry=90, **GLOSS)
    for i, a, p in _around(5, r * 0.36):
        cyl(r * 0.07, 0.022, (w / 2 - 0.001, p[1], p[2]), CHROME, n=6, ry=90, **MET)
    cyl(r * 0.18, 0.03, (w / 2, 0, 0), CHROME, n=8, ry=90, r2=r * 0.12, **MET)


def _knobbly(r, w, acc):
    rt = r * 0.88
    tyre(rt, w, ri=0.6)
    core(rt * 0.6, w)
    cyl(rt * 0.58, 0.026, (w / 2 - 0.02, 0, 0), acc, n=10, ry=90, **GLOSS)
    cyl(rt * 0.2, 0.03, (w / 2, 0, 0), CHROME, n=8, ry=90, **MET)
    for i, a, p in _around(12, r * 0.9):
        off = w * 0.2 * (1 if i % 2 else -1)
        with at((off, p[1], p[2]), rx=-math.degrees(a)):
            box((w * 0.55, r * 0.26, r * 0.2), (0, 0, 0), TYRE, bevel=0.006, rough=0.9)


def _monster(r, w, acc):
    rt = r * 0.86
    tyre(rt, w, ri=0.55)
    core(rt * 0.55, w)
    lathe([(rt * 0.56, 0), (rt * 0.5, 0.03), (rt * 0.3, 0.035)], (w / 2 - 0.03, 0, 0), CHROME, n=12, ry=90, **MET)
    cyl(rt * 0.28, 0.04, (w / 2 - 0.005, 0, 0), acc, n=8, ry=90, **GLOSS)
    for i, a, p in _around(6, rt * 0.4):
        cyl(r * 0.04, 0.03, (w / 2 + 0.0, p[1], p[2]), CHROME, n=6, ry=90, **MET)
    for i, a, p in _around(12, r * 0.92):
        for s in (-1, 1):
            with at((s * w * 0.24, p[1], p[2]), rx=-math.degrees(a)):
                box((w * 0.46, r * 0.17, r * 0.16), (0, 0, 0), TYRE, rz=s * 28, bevel=0.008, rough=0.9)


def _spoke(r, w, acc):
    tyre(r, w, ri=0.76, n=14)
    core(r * 0.76, w, x1=-w * 0.15, col=BLACK)
    torus(r * 0.74, r * 0.045, (w * 0.1, 0, 0), CHROME, n=14, k=5, ry=90, **MET)
    for i, a, p in _around(12, r * 0.72):
        rod((-w * 0.12, 0, 0), (w * 0.1, p[1], p[2]), 0.0065, CHROME, n=4, **MET)
    cyl(r * 0.2, 0.03, (-w * 0.12, 0, 0), acc, n=8, ry=90)
    lathe([(r * 0.17, 0), (r * 0.13, 0.04), (0, 0.075)], (-w * 0.1, 0, 0), CHROME, n=8, ry=90, **MET)


def _whitewall(r, w, acc):
    tyre(r, w, ri=0.5)
    core(r * 0.5, w)
    lathe([(r * 0.58, 0), (r * 0.84, 0)], (w / 2 + 0.0015, 0, 0), WHITE, n=12, ry=90, cap=False)
    lathe([(r * 0.52, 0), (r * 0.46, 0.025), (r * 0.2, 0.045), (0, 0.05)], (w / 2 - 0.02, 0, 0), CHROME, n=12, ry=90, **MET)
    cyl(r * 0.1, 0.012, (w / 2 + 0.028, 0, 0), acc, n=8, ry=90)


def _stubby(r, w, acc):
    tyre(r, w, ri=0.55, n=10)
    core(r * 0.55, w)
    cyl(r * 0.56, 0.03, (w / 2 - 0.022, 0, 0), acc, n=10, ry=90, **GLOSS)
    for i, a, p in _around(4, r * 0.28, math.pi / 4):
        cyl(r * 0.07, 0.022, (w / 2, p[1], p[2]), CHROME, n=6, ry=90, **MET)


def _hover(r, w, acc):
    rod((0, 0, 0), (0, 0, -r * 0.5), r * 0.09, STEEL, **MET)
    lathe([(r * 0.8, -0.035), (r * 0.95, 0.0), (r * 0.72, 0.05), (r * 0.25, 0.07), (0, 0.07)], (0, 0, -r * 0.62), acc, n=10, **GLOSS)
    cyl(r * 0.62, 0.02, (0, 0, -r * 0.62 - 0.05), C(120, 250, 240), n=10, emit=1.2)
    torus(r * 0.62, 0.011, (0, 0, -r * 0.84), C(150, 245, 238), n=12, k=4, emit=0.9)
    torus(r * 0.48, 0.009, (0, 0, -r * 0.98), C(170, 250, 245), n=12, k=4, emit=0.7)


def _skis(r, w, acc):
    L = r * 2.8
    rod((0, 0, 0), (0, 0, -r + 0.03), r * 0.08, STEEL, **MET)
    box((r * 0.35, r * 0.5, 0.03), (0, 0, -r + 0.04), CHAR, bevel=0.008)
    box((w * 0.6, L * 0.78, 0.028), (0, L * 0.1, -r + 0.014), acc, bevel=0.01, **GLOSS)
    box((w * 0.6, L * 0.24, 0.028), (0, -L * 0.37, -r + 0.045), acc, rx=-28, bevel=0.01, **GLOSS)


def _thruster(r, w, acc):
    ell((0, 0, 0), (r * 0.42, r * 0.62, r * 0.42), acc, seg=10, ring=6, **GLOSS)
    lathe([(r * 0.2, -r * 0.3), (r * 0.36, -r * 0.62), (r * 0.3, -r * 0.62), (r * 0.15, -r * 0.34)], (0, 0, 0), CHROME, n=10, cap=False, **MET)
    lathe([(r * 0.3, -r * 0.6), (r * 0.16, -r * 0.8), (0, -r * 1.0)], (0, 0, 0), ORANGE, n=8, emit=1.4)
    lathe([(r * 0.17, -r * 0.6), (r * 0.07, -r * 0.74), (0, -r * 0.84)], (0, 0, 0), C(255, 236, 120), n=8, emit=1.8)


def _tread(r, w, acc, y0=-0.3, y1=0.3):
    """One whole track for a side; origin at the side's hub-flange line, z = axle height."""
    pts = []
    for i in range(7):
        t = math.pi / 2 + math.pi * i / 6
        pts.append((y0 + r * math.cos(t), r * math.sin(t)))
    for i in range(7):
        t = 3 * math.pi / 2 + math.pi * i / 6
        pts.append((y1 + r * math.cos(t), r * math.sin(t)))
    xslab(pts, w * 0.9, TYRE, x=w / 2, bevel=0.012, rough=0.9)
    # cleats around the loop
    per = []
    span = y1 - y0
    nk = max(1, int(span / 0.075))
    for k in range(nk + 1):
        y = y0 + span * k / nk
        per += [((y, r), (0, 1)), ((y, -r), (0, -1))]
    for c, t0 in ((y0, math.pi / 2), (y1, -math.pi / 2)):
        for i in range(1, 5):
            t = t0 + math.pi * i / 5
            per.append(((c + r * math.cos(t), r * math.sin(t)), (math.cos(t), math.sin(t))))
    for (y, z), (ny, nz) in per:
        with at((w / 2, y + ny * 0.006, z + nz * 0.006), rx=math.degrees(math.atan2(-ny, nz))):
            box((w * 1.0, 0.035, 0.03), (0, 0, 0), BLACK, rough=0.9)
    for k in range(4):
        y = y0 + span * (k + 0.5) / 4
        cyl(r * 0.44, 0.03, (w * 0.95, y, -r * 0.4), STEEL, n=10, ry=90, **MET)
        cyl(r * 0.16, 0.02, (w * 0.95 + 0.025, y, -r * 0.4), acc, n=8, ry=90)
    for y in (y0, y1):
        cyl(r * 0.62, 0.03, (w * 0.95, y, 0), STEEL, n=10, ry=90, **MET)
        cyl(r * 0.22, 0.02, (w * 0.95 + 0.025, y, 0), acc, n=8, ry=90)
    # mudguard over the top
    box((w * 1.05, span + r * 1.3, 0.03), (w / 2, (y0 + y1) / 2, r + 0.03), acc, bevel=0.01, **GLOSS)


# kind: (builder, radius factor, width factor, label)
WHEELS = {
    "slick": (_slick, 1.0, 1.15, "Slicks"),
    "knobbly": (_knobbly, 1.06, 1.1, "Off-road knobblies"),
    "monster": (_monster, 1.65, 1.7, "Monster"),
    "spoke": (_spoke, 1.0, 0.8, "Chrome spokes"),
    "whitewall": (_whitewall, 1.0, 0.95, "Whitewalls"),
    "stubby": (_stubby, 0.8, 1.3, "Stubby kart"),
    "hover": (_hover, 1.0, 1.0, "Hover pads"),
    "treads": (_tread, 1.0, 1.3, "Tank treads"),
    "skis": (_skis, 1.0, 0.8, "Skis"),
    "thruster": (_thruster, 1.0, 1.0, "Rocket thrusters"),
}


def wheel(kind, r, w, acc=RED, side=1, centred=False):
    """One wheel at the current origin (a wheel snap). side -1 mirrors it for the right."""
    fn = WHEELS[kind][0]
    with at((0, 0, 0), s=(side, 1, 1)):
        with at((0 if centred else w / 2, 0, 0)):
            fn(r, w, acc)


# ---------------------------------------------------------------- chassis
# Size classes. Body shells are authored at M size and scaled to the class deck;
# bolt-ons scale uniformly by s.
CLS = {
    "S": dict(L=0.98, W=0.58, s=0.86, h=0.88),
    "M": dict(L=1.2, W=0.66, s=1.0, h=1.0),
    "L": dict(L=1.44, W=0.78, s=1.15, h=1.12),
}

CHASSIS = {
    "kart": dict(cls="S", wb=0.6, r=0.2, deck=0.1, wheels="stubby", layout="4", label="Kart"),
    "buggy": dict(cls="M", wb=0.74, r=0.26, deck=0.24, wheels="knobbly", layout="4", label="Buggy"),
    "coupe": dict(cls="M", wb=0.74, r=0.25, deck=0.13, wheels="slick", layout="4", label="Coupe"),
    "hatchback": dict(cls="S", wb=0.58, r=0.22, deck=0.14, wheels="slick", layout="4", label="Hatchback"),
    "pickup": dict(cls="L", wb=0.9, r=0.29, deck=0.19, wheels="knobbly", layout="4", label="Pickup"),
    "van": dict(cls="L", wb=0.86, r=0.26, deck=0.15, wheels="whitewall", layout="4", label="Van"),
    "monster": dict(cls="M", wb=0.8, r=0.23, deck=0.34, wheels="monster", layout="4", label="Monster truck"),
    "bike": dict(cls="S", wb=0.7, r=0.23, deck=0.27, wheels="slick", layout="2", label="Bike"),
    "trike": dict(cls="S", wb=0.64, r=0.21, deck=0.16, wheels="spoke", layout="3", label="Trike"),
    "hover": dict(cls="S", wb=0.6, r=0.18, deck=0.15, wheels="hover", layout="4", label="Hover sled"),
    "tank": dict(cls="L", wb=0.8, r=0.23, deck=0.3, wheels="treads", layout="4", label="Tank tread base"),
}
ORDER = ["kart", "buggy", "coupe", "hatchback", "pickup", "van", "monster", "bike", "trike", "hover", "tank"]


def wheel_dims(ch, kind):
    c = CHASSIS[ch]
    k = CLS[c["cls"]]
    _, rf, wf, _ = WHEELS[kind]
    w = 0.2 * k["s"] * wf
    if c["layout"] == "2":
        w *= 0.7
    return c["r"] * rf, w


def chassis_snaps(ch):
    """Named attach points in chassis space. Wheel snaps sit on the hub flange."""
    c = CHASSIS[ch]
    k = CLS[c["cls"]]
    W, L, r, wb, dk = k["W"], k["L"], c["r"], c["wb"], c["deck"]
    xw = W / 2 + 0.02
    yf, yr = -wb / 2, wb / 2
    S = {}
    if c["layout"] == "2":
        S["wheel_F"], S["wheel_R"] = (0, yf, r), (0, yr, r)
    elif c["layout"] == "3":
        S["wheel_F"], S["wheel_RL"], S["wheel_RR"] = (0, yf, r), (xw, yr, r), (-xw, yr, r)
    else:
        S.update(wheel_FL=(xw, yf, r), wheel_FR=(-xw, yf, r), wheel_RL=(xw, yr, r), wheel_RR=(-xw, yr, r))
    S["body"] = (0, 0, dk)
    seat_y = {"kart": 0.06, "bike": 0.1, "trike": 0.16, "hover": 0.06}.get(ch, 0.04)
    S["seat"] = (0, seat_y, dk + (0.12 if ch == "bike" else 0.075))
    if ch == "bike":
        S.update(front=(0, yf - r - 0.02, r + 0.08), rear=(0, yr + 0.06, dk + 0.12), tail=(0, yr + 0.1, dk + 0.04),
                 exhaust_L=(0.08, yr - 0.02, r - 0.02), exhaust_R=(-0.08, yr - 0.02, r - 0.02),
                 side_L=(0.12, 0.05, dk - 0.02), side_R=(-0.12, 0.05, dk - 0.02),
                 hood=(0, -0.12, dk + 0.12), roof=(0, yr + 0.06, dk + 0.2), mast=(0.05, yr + 0.08, dk + 0.12))
    else:
        S.update(front=(0, -L / 2, dk + 0.03), rear=(0, L / 2 - 0.06, dk + 0.03), tail=(0, L / 2, dk + 0.08),
                 exhaust_L=(W * 0.25, L / 2, dk + 0.02), exhaust_R=(-W * 0.25, L / 2, dk + 0.02),
                 side_L=(W / 2, -0.12, dk + 0.04), side_R=(-W / 2, -0.12, dk + 0.04),
                 hood=(0, -L * 0.36, dk + 0.03), roof=(0, 0.3, dk + 0.48), mast=(W * 0.36, L * 0.42, dk + 0.03))
    return S


def bucket_seat(p, col):
    x, y, z = p
    box((0.2, 0.18, 0.05), (x, y, z - 0.025), col, bevel=0.015, **GLOSS)
    box((0.2, 0.05, 0.2), (x, y + 0.11, z + 0.08), col, rx=-12, bevel=0.015, **GLOSS)


def steering(p):
    """Steering wheel in front of a seat point p, plus its column."""
    x, y, z = p
    c = V(x, y - 0.17, z + 0.16)
    rod((x, y - 0.42, z - 0.04), c, 0.014, STEEL, **MET)
    torus(0.06, 0.013, tuple(c), CHAR, n=10, k=4, rx=62)


def chassis_build(ch, bare=True, acc=RED, wheels=None):
    """The chassis frame (always) plus its bare-only fittings (deck plate, seat, wheel)."""
    c = CHASSIS[ch]
    k = CLS[c["cls"]]
    W, L, r, wb, dk = k["W"], k["L"], c["r"], c["wb"], c["deck"]
    S = chassis_snaps(ch)
    xw = W / 2 + 0.02
    kind = wheels or c["wheels"]
    hover = kind in ("hover", "thruster", "skis", "treads")

    if ch == "bike":
        _bike(S, r, wb, dk, acc)
        return
    if ch == "trike":
        _trike(S, r, wb, dk, acc, bare)
        return

    # tray under the deck
    tl = min(wb + r * 1.1, L * 0.92)
    box((W * 0.7, tl, 0.06), (0, 0, dk - 0.03), CHAR, bevel=0.015)
    # axles + suspension
    if not hover:
        for y in (-wb / 2, wb / 2):
            rod((-xw, y, r), (xw, y, r), 0.022, STEEL, **MET)
            if dk - r > 0.06:
                for s in (-1, 1):
                    spring((s * (W / 2 - 0.08), y, r), (s * (W / 2 - 0.1), y, dk - 0.02), 0.035, YEL if ch == "monster" else CHROME, turns=4)
            if ch in ("monster", "buggy", "pickup"):
                ell((0, y, r), (0.07, 0.07, 0.07), CHAR, seg=8, ring=6)  # diff pumpkin
    else:
        for y in (-wb / 2, wb / 2):
            rod((-xw, y, r), (xw, y, r), 0.03, CHAR)
    if ch in ("monster", "pickup", "buggy"):
        for s in (-1, 1):
            rod((s * W * 0.28, -tl / 2, dk - 0.06), (s * W * 0.28, tl / 2, dk - 0.06), 0.03, C(70, 70, 80))
    if ch == "monster":
        for y in (-wb / 2, wb / 2):
            for s in (-1, 1):
                rod((s * (W / 2 - 0.02), y + 0.06, r + 0.02), (s * (W / 2 - 0.04), y + 0.03, dk + 0.02), 0.03, RED, **GLOSS)
    if ch == "tank":
        box((W * 0.92, wb + r * 1.6, 0.1), (0, 0, dk - 0.05), C(84, 92, 78), bevel=0.02)

    if not bare:
        return
    # ---- bare-only fittings: the parts a body shell covers
    seat = S["seat"]
    if ch == "kart":
        # kart: tube frame, nose fairing, side bumpers, engine
        for s in (-1, 1):
            rod((s * 0.2, -0.42, 0.07), (s * 0.24, 0.38, 0.07), 0.02, STEEL, **MET)
            rod((s * 0.26, -0.2, 0.09), (s * 0.26, 0.2, 0.09), 0.026, acc, **GLOSS)
        box((W * 0.6, 0.7, 0.02), (0, 0, 0.065), CHAR)
        tbox(0.05, 0.17, (0.22, -0.56, -0.3), (0.12, -0.46, -0.26), acc, bevel=0.03, **GLOSS)
        box((0.16, 0.14, 0.14), (-0.14, 0.32, 0.14), CHAR, bevel=0.02)
        rod((-0.14, 0.38, 0.17), (-0.18, 0.5, 0.2), 0.022, CHROME, **MET)
        bucket_seat(seat, acc)
        steering(seat)
        return
    if ch == "hover":
        xslab([(-0.5, 0.06), (-0.56, 0.14), (-0.5, 0.2), (0.48, 0.2), (0.5, 0.06)], W * 0.82, acc, bevel=0.03, x=0, **GLOSS)
        for s in (-1, 1):
            box((0.04, L * 0.9, 0.04), (s * W * 0.42, 0, 0.17), WHITE, bevel=0.01)
        bucket_seat((seat[0], seat[1], seat[2] + 0.07), CHAR)
        steering((seat[0], seat[1], seat[2] + 0.07))
        return
    box((W * 0.86, L * 0.84, 0.025), (0, 0, dk + 0.0125), PLATE, bevel=0.008)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl(0.022, 0.02, (sx * W * 0.36, sy * L * 0.36, dk + 0.02), YEL, n=6)
    if ch == "buggy":
        for s in (-1, 1):
            rod((s * 0.24, -0.3, dk), (s * 0.2, 0.0, dk + 0.42), 0.018, acc, **GLOSS)
            rod((s * 0.2, 0.0, dk + 0.42), (s * 0.24, 0.32, dk), 0.018, acc, **GLOSS)
        rod((-0.2, 0.0, dk + 0.42), (0.2, 0.0, dk + 0.42), 0.018, acc, **GLOSS)
    if ch == "pickup":
        box((W * 0.8, 0.5, 0.04), (0, 0.4, dk + 0.04), C(140, 110, 80))  # load bed boards
    if ch in ("van", "pickup", "tank", "monster"):
        box((W * 0.5, 0.3, 0.16), (0, -L * 0.33, dk + 0.08), CHAR, bevel=0.03)  # engine block
    bucket_seat(seat, acc)
    steering(seat)


def _bike(S, r, wb, dk, acc):
    yf, yr = -wb / 2, wb / 2
    head = V(0, yf + 0.12, r + 0.3)
    for s in (-1, 1):
        rod((s * 0.05, yf, r), head + V(s * 0.04, 0, -0.04), 0.017, CHROME, **MET)  # fork
        rod((s * 0.05, yr, r), (s * 0.05, 0.12, dk + 0.02), 0.018, CHAR)  # swing arm
    rod(head, (0, 0.12, dk + 0.04), 0.03, acc, **GLOSS)  # frame spine
    rod((0, yf + 0.18, dk + 0.08), (0, 0.02, dk - 0.1), 0.025, acc, **GLOSS)
    ell((0, -0.06, dk + 0.14), (0.1, 0.17, 0.08), acc, seg=10, ring=6, **GLOSS)  # tank
    box((0.16, 0.24, 0.16), (0, 0.04, dk - 0.07), CHAR, bevel=0.03)  # engine
    box((0.15, 0.26, 0.05), (0, S["seat"][1] + 0.02, S["seat"][2] - 0.025), BLACK, bevel=0.02)  # seat
    rod(head, head + V(0, 0.02, 0.06), 0.02, CHAR)
    rod(head + V(-0.17, 0.06, 0.08), head + V(0.17, 0.06, 0.08), 0.014, CHROME, **MET)  # bars
    ell(head + V(0, -0.06, -0.02), (0.07, 0.04, 0.07), LAMP, seg=8, ring=6, emit=0.3)
    # mudguards
    guard((0, yf, r), r + 0.03, 140, 110, acc)
    guard((0, yr, r), r + 0.03, 110, 110, acc)


def _trike(S, r, wb, dk, acc, bare):
    yf, yr = -wb / 2, wb / 2
    W = CLS["S"]["W"]
    head = V(0, yf + 0.1, r + 0.3)
    for s in (-1, 1):
        rod((s * 0.05, yf, r), head + V(s * 0.04, 0, -0.04), 0.017, CHROME, **MET)
    rod((-W / 2 - 0.02, yr, r), (W / 2 + 0.02, yr, r), 0.022, STEEL, **MET)
    rod(head, (0, 0.0, dk + 0.02), 0.03, acc, **GLOSS)
    box((W * 0.7, 0.42, 0.06), (0, yr - 0.12, dk - 0.03), CHAR, bevel=0.015)
    rod((0, 0.0, dk), (0, yr - 0.3, dk), 0.03, CHAR)
    rod(head, head + V(0, 0.02, 0.06), 0.02, CHAR)
    rod(head + V(-0.17, 0.06, 0.08), head + V(0.17, 0.06, 0.08), 0.014, CHROME, **MET)
    ell(head + V(0, -0.06, -0.02), (0.07, 0.04, 0.07), LAMP, seg=8, ring=6, emit=0.3)
    guard((0, yf, r), r + 0.03, 140, 110, acc)
    if bare:
        box((W * 0.86, 0.5, 0.025), (0, yr - 0.14, dk + 0.0125), PLATE, bevel=0.008)
        bucket_seat(S["seat"], acc)
