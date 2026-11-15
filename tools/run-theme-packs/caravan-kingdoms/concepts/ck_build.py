"""Caravan Kingdoms: tile improvements and wonders (with build stages)."""
import bpy

from ck_city import *  # noqa: F401,F403
UNIT_S = 1.7
from ck_base import _bm_obj  # noqa: F401

P, CA, CN, LV = STYLES

# ---------------------------------------------------------------- build-stage machinery


def _mesh_objs():
    return {o.name for o in bpy.data.objects if o.type == "MESH"}


def _bbox(names):
    xs, ys, zs = [], [], []
    for n in names:
        for v in bpy.data.objects[n].data.vertices:
            xs.append(v.co.x)
            ys.append(v.co.y)
            zs.append(v.co.z)
    return min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)


def cut_above(names, z):
    """Slice the given objects flat at height z (they are world-baked meshes)."""
    for n in list(names):
        o = bpy.data.objects[n]
        bm = bmesh.new()
        bm.from_mesh(o.data)
        zs = [v.co.z for v in bm.verts]
        if max(zs) <= z + 1e-5:
            bm.free()
            continue
        if min(zs) >= z - 1e-5:
            bm.free()
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        r = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, z), plane_no=(0, 0, 1), clear_outer=True)
        edges = [e for e in r["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
        try:
            bmesh.ops.holes_fill(bm, edges=edges, sides=0)
        except Exception:
            pass
        bm.to_mesh(o.data)
        bm.free()
        for p in o.data.polygons:
            p.use_smooth = False


def scaffold(x0, x1, y0, y1, z0, z1, step=0.22, level=0.15):
    """Timber scaffold round a box: poles on the perimeter, plank decks, X braces."""
    pad = 0.035
    x0, x1, y0, y1 = x0 - pad, x1 + pad, y0 - pad, y1 + pad
    nx = max(1, round((x1 - x0) / step))
    ny = max(1, round((y1 - y0) / step))
    pts = [(x0 + (x1 - x0) * i / nx, y) for i in range(nx + 1) for y in (y0, y1)]
    pts += [(x, y0 + (y1 - y0) * j / ny) for j in range(1, ny) for x in (x0, x1)]
    for x, y in pts:
        cyl(0.009, z1 - z0 + 0.03, (x, y, z0), WOOD, n=4)
    z = z0 + level
    while z < z1 + 0.01:
        for y in (y0, y1):
            box((x1 - x0 + 0.02, 0.04, 0.012), (((x0 + x1) / 2), y, z), C(196, 150, 96))
        for x in (x0, x1):
            box((0.04, y1 - y0 + 0.02, 0.012), (x, (y0 + y1) / 2, z), C(196, 150, 96))
        z += level
    # one diagonal brace on the two visible faces
    h = z1 - z0
    L = math.hypot(x1 - x0, h)
    box((L, 0.01, 0.012), ((x0 + x1) / 2, y0 - 0.004, z0 + h / 2), WOOD_D, ry=-math.degrees(math.atan2(h, x1 - x0)))
    L = math.hypot(y1 - y0, h)
    box((0.01, L, 0.012), (x1 + 0.004, (y0 + y1) / 2, z0 + h / 2), WOOD_D, rx=math.degrees(math.atan2(h, y1 - y0)))


def crane(p, h=0.36, rz=0.0):
    """Wooden treadwheel crane."""
    with at(p, rz=rz):
        for sx in (-1, 1):
            tube([(sx * 0.05, 0, 0), (0, 0, h)], lambda t: 0.007, WOOD, rings=2, n=4)
        box((0.012, 0.32, 0.012), (0, -0.1, h), WOOD, rx=-18)
        cyl(0.002, 0.18, (0, -0.24, h - 0.2), C(220, 200, 160), n=3)
        box((0.04, 0.04, 0.03), (0, -0.24, h - 0.22), C(200, 190, 176))
        torus(0.06, 0.008, (0, 0.03, 0.065), WOOD_D, n=10, k=4, rx=90, rz=90)


def materials_pile(p, rgb=C(222, 206, 176)):
    with at(p):
        for i, (x, y, z) in enumerate(((0, 0, 0), (0.06, 0, 0), (0.03, 0.0, 0.04), (0.0, 0.06, 0))):
            box((0.055, 0.05, 0.04), (x, y, z + 0.02), rgb, rz=i * 4)
        for k in range(3):
            cyl(0.01, 0.16, (-0.08, -0.02 + k * 0.022, 0.012), WOOD, n=5, ry=90, rz=8)


def staged(build, stage, cut=0.5, extra=None):
    """stage 0: footings + full scaffold + materials; 1: lower part + scaffold; 2: done."""
    before = _mesh_objs()
    build()
    names = _mesh_objs() - before
    if stage == 2 or not names:
        return
    x0, x1, y0, y1, z0, z1 = _bbox(names)
    zc = z0 + (0.03 if stage == 0 else (z1 - z0) * cut)
    cut_above(names, zc)
    from mathutils import Matrix
    kit._xf.append(Matrix.Identity(4))  # bbox is in world space
    _staged_dress(stage, x0, x1, y0, y1, z0, z1, zc, extra)
    kit._xf.pop()


def _staged_dress(stage, x0, x1, y0, y1, z0, z1, zc, extra):
    scaffold(x0, x1, y0, y1, z0, zc + (z1 - z0) * (0.25 if stage == 0 else 0.18))
    if extra:
        extra(stage, (x0, x1, y0, y1, z0, z1))
    else:
        materials_pile((x1 + 0.08, y0 - 0.02, z0))
        crane((x0 - 0.08, y0 + 0.05, z0), h=min(0.5, (z1 - z0) * 0.8 + 0.12), rz=-30)


# ---------------------------------------------------------------- improvements


def field(p, w, d, stage, rz=0.0, crop=None):
    with at(p, rz=rz):
        box((w, d, 0.02), (0, 0, 0.004), C(150, 104, 66))
        k = int(d / 0.05)
        for i in range(k):
            y = -d / 2 + (i + 0.5) * d / k
            if stage == 0:
                box((w * 0.94, 0.018, 0.012), (0, y, 0.018), C(126, 84, 54))
            elif stage == 1:
                for j in range(int(w / 0.05)):
                    cone(0.014, 0.035, (-w / 2 + 0.025 + j * 0.05, y, 0.012), C(120, 186, 70), n=4)
            else:
                box((w * 0.94, 0.03, 0.05), (0, y, 0.036), crop or C(236, 196, 80), bevel=0.008)


def farmhouse(p, rz=0.0):
    with at(p, rz=rz):
        box((0.14, 0.1, 0.08), (0, 0, 0.04), C(220, 190, 146), bevel=0.006)
        slab([(-0.085, 0), (0.085, 0), (0, 0.06)], 0.12, (0, 0, 0.08), C(196, 160, 90))
        box((0.03, 0.01, 0.05), (0.02, -0.052, 0.025), WOOD_D)


def haystack(p, s=1.0):
    with at(p, s=s):
        lathe([(0.045, 0), (0.05, 0.03), (0.035, 0.07), (0, 0.09)], (0, 0, 0), C(232, 196, 96), n=7)


def i_farm(stage):
    def f():
        H = plain("low", GRASS)
        with at((0, 0, H)):
            field((-0.25, 0.2, 0), 0.42, 0.36, stage, rz=10)
            field((0.28, 0.12, 0), 0.34, 0.42, stage, rz=-60 + 90)
            field((-0.05, -0.38, 0), 0.5, 0.26, stage, rz=-5, crop=C(226, 170, 70))
            with at((0.45, -0.38, 0), s=1.8):
                farmhouse((0, 0, 0), -20)
            for k in range(5):
                cyl(0.008, 0.06, (-0.55 + k * 0.1, -0.12 + k * 0.01, 0), WOOD, n=4)
            if stage == 2:
                haystack((0.12, -0.62, 0), 1.6)
                haystack((0.3, -0.6, 0), 1.3)
    return f


def silkhouse(p, rz=0.0):
    with at(p, rz=rz):
        box((0.3, 0.14, 0.09), (0, 0, 0.045), C(232, 214, 180), bevel=0.006)
        hip_roof((0, 0, 0.09), 0.3, 0.14, 0.07, C(160, 110, 70), lift=0.012, over=0.02)
        for x in (-0.09, 0.0, 0.09):
            box((0.05, 0.01, 0.035), (x, -0.072, 0.05), DARK)
        # trays of cocoons outside
        for i, x in enumerate((-0.1, 0.02)):
            cyl(0.045, 0.014, (x, -0.13, 0.0), C(196, 160, 100), n=8)
            for j in range(4):
                ell((x - 0.02 + j * 0.013, -0.13 + 0.01 * (j % 2), 0.02), (0.008, 0.011, 0.008), C(252, 250, 240), seg=6, ring=4)


def i_silk(stage):
    def f():
        H = plain("low", GRASS)
        with at((0, 0, H)):
            pts = [(-0.45 + i * 0.22, -0.35 + j * 0.22) for j in range(3) for i in range(5)]
            for k, (x, y) in enumerate(pts):
                if stage == 2 and y > -0.1 and -0.25 < x < 0.3:
                    continue
                if stage == 0:
                    cyl(0.016, 0.06, (x, y, 0), WOOD, n=6)
                    ell((x, y, 0.08), 0.05, C(110, 170, 80), seg=8, ring=6)
                else:
                    mulberry((x, y, 0), 0.6)
            if stage == 2:
                with at((0.03, 0.12, 0), s=1.6):
                    silkhouse((0, 0, 0), 0)
    return f


def rock_tile(H=None, top=C(176, 162, 136)):
    H = ELEV["low"] if H is None else H
    hex_tile(H, top, band=ROCKBAND)
    return H


def i_mine(stage):
    def f():
        H = rock_tile()
        with at((0, 0, H)):
            peak((0.0, 0.35, 0), 0.55, 0.55, ROCK, 0.0, rz=10)
            peak((-0.45, 0.15, 0), 0.3, 0.3, ROCK_D, 0.0, rz=40)
        with at((0.05, 0.1, H), s=1.4):
            if stage == 0:
                for (x, y) in ((0.1, -0.25), (0.25, -0.15)):
                    rock((x, y, 0), 0.06, C(200, 120, 70), rz=x * 100)
                cyl(0.006, 0.1, (0.18, -0.3, 0), WOOD, n=4)
                slab([(0, 0), (0.05, 0.01), (0, 0.025)], 0.006, (0.183, -0.3, 0.075), RED)
                with at((-0.25, -0.35, 0), s=1.2):
                    P.tent()
            else:
                with at((0.02, -0.08, 0)):
                    box((0.2, 0.06, 0.18), (0, 0, 0.09), ROCK)
                    box((0.12, 0.02, 0.13), (0, -0.032, 0.065), DARK)
                    for sx in (-1, 1):
                        box((0.022, 0.022, 0.15), (sx * 0.07, -0.045, 0.075), WOOD)
                    box((0.18, 0.026, 0.024), (0, -0.045, 0.155), WOOD)
                # rails + cart
                for sx in (-1, 1):
                    box((0.008, 0.4, 0.008), (0.02 + sx * 0.03, -0.32, 0.004), GREY)
                with at((0.02, -0.33, 0)):
                    box((0.1, 0.07, 0.05), (0, 0, 0.04), WOOD_D, bevel=0.006)
                    for sx in (-1, 1):
                        for sy in (-1, 1):
                            cyl(0.015, 0.012, (sx * 0.04, sy * 0.025, 0.015), INK, n=6, ry=90)
                    for i in range(3):
                        rock((-0.02 + i * 0.02, 0, 0.06), 0.025, C(200, 120, 70), rz=i * 50)
                for i in range(4):
                    rock((0.28 + 0.04 * (i % 2), -0.2 - 0.04 * i, 0), 0.05, C(200, 120, 70), rz=i * 30)
                cone(0.03, 0.06, (-0.2, -0.3, 0), C(250, 150, 50), n=5, emit=1.0)
    return f


def i_quarry(stage):
    def f():
        H = rock_tile(top=C(222, 196, 156))
        with at((0, 0, H), s=1.4):
            if stage == 0:
                for (x, y, s) in ((-0.1, 0.15, 0.3), (0.25, 0.25, 0.2)):
                    rock((x, y, 0), s, C(236, 186, 140), rz=x * 90)
                cyl(0.006, 0.1, (0.1, -0.15, 0), WOOD, n=4)
                slab([(0, 0), (0.05, 0.01), (0, 0.025)], 0.006, (0.103, -0.15, 0.075), RED)
            else:
                # stepped cut faces
                for i, (w, d, h) in enumerate(((0.7, 0.5, 0.1), (0.55, 0.36, 0.2), (0.4, 0.2, 0.3))):
                    box((w, d, h), (-0.05, 0.25 - d / 2 + 0.15, h / 2), C(236, 186, 140) if i % 2 == 0 else C(220, 164, 120))
                for i in range(5):
                    box((0.07, 0.05, 0.045), (0.18 + 0.075 * (i % 3), -0.32 + 0.06 * (i // 3), 0.0225 + 0.045 * (i == 4)), C(244, 206, 160), bevel=0.006)
                crane((0.42, 0.0, 0), 0.32, rz=-60)
                for sx in (-1, 1):
                    cyl(0.005, 0.07, (-0.35 + sx * 0.025, -0.3, 0), WOOD, n=4)
    return f


def sheep(p, rz=0.0, rgb=C(248, 244, 232)):
    with at(p, rz=rz, s=2.0):
        ell((0, 0, 0.045), (0.035, 0.05, 0.035), rgb, seg=7, ring=5)
        ell((0, -0.05, 0.06), (0.018, 0.022, 0.018), DARK, seg=6, ring=4)
        for sx in (-1, 1):
            for sy in (-1, 1):
                cyl(0.006, 0.025, (sx * 0.018, sy * 0.025, 0), DARK, n=4)


def fence_ring(pts, rgb=WOOD):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
        L = math.hypot(x1 - x0, y1 - y0)
        a = math.degrees(math.atan2(y1 - y0, x1 - x0))
        for z in (0.03, 0.055):
            box((L, 0.008, 0.008), ((x0 + x1) / 2, (y0 + y1) / 2, z), rgb, rz=a)
        cyl(0.008, 0.07, (x0, y0, 0), WOOD_D, n=4)


def i_pasture():
    H = plain("low", STEPPE)
    with at((0, 0, H), s=1.0):
        fence_ring([(0.6 * math.cos(math.radians(a)), 0.6 * math.sin(math.radians(a))) for a in range(0, 360, 45)])
        for i, (x, y) in enumerate(((-0.2, 0.0), (0.1, -0.2), (0.2, 0.15), (-0.1, -0.35), (-0.3, 0.3), (0.35, -0.1))):
            sheep((x, y, 0), i * 50, C(248, 244, 232) if i % 3 else C(90, 70, 60))
        with at((0.15, 0.4, 0)):
            for sx in (-1, 1):
                cyl(0.008, 0.1, (sx * 0.08, -0.05, 0), WOOD, n=4)
            box((0.2, 0.14, 0.012), (0, 0, 0.1), C(196, 160, 90), rx=-10)
        for (x, y) in ((-0.4, -0.15), (0.0, 0.3)):
            tuft((x, y, 0), 1.0, STEPPE_D)


def caravanserai():
    """Square courtyard inn: blank outer walls, corner towers, a big iwan gate."""
    w = 0.66
    t = 0.07
    h = 0.13
    box((w, w, 0.012), (0, 0, 0.006), C(222, 200, 160))
    for sx in (-1, 1):
        box((t, w, h), (sx * (w / 2 - t / 2), 0, h / 2), P.WALL)
    box((w, t, h), (0, w / 2 - t / 2, h / 2), P.WALL)
    for sx in (-1, 1):
        box((w * 0.34, t, h), (sx * w * 0.33, -w / 2 + t / 2, h / 2), P.WALL)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl(0.055, h + 0.03, (sx * w / 2, sy * w / 2, 0), P.WALL, n=8, r2=0.048)
    # inner arcade rooms along the back
    with at((0, w / 2 - t - 0.002, 0)):
        for i in range(5):
            arch((-0.22 + i * 0.11, -0.0, 0.0), 0.06, 0.08, DARK, pointed=True)
    with at((0, -w / 2 + 0.04, 0)):
        P.iwan(0.24, 0.24, 0.1)
    well((0.0, 0.05, 0), 0.8)
    for (x, y, c) in ((-0.15, -0.05, OCHRE), (-0.12, 0.08, RED), (0.16, 0.06, C(110, 160, 80))):
        ell((x, y, 0.03), (0.03, 0.03, 0.035), c, seg=6, ring=4)


def awning_stall(p, rgb, rz=0.0, goods=OCHRE):
    with at(p, rz=rz):
        box((0.14, 0.08, 0.05), (0, 0, 0.025), WOOD)
        for sx in (-1, 1):
            cyl(0.005, 0.12, (sx * 0.065, -0.04, 0), WOOD_D, n=4)
            cyl(0.005, 0.14, (sx * 0.065, 0.04, 0), WOOD_D, n=4)
        quad_pts = [(-0.08, -0.07, 0.11), (0.08, -0.07, 0.11), (0.08, 0.05, 0.14), (-0.08, 0.05, 0.14)]
        quad(quad_pts, rgb)
        for i in range(3):
            lathe([(0.02, 0), (0.022, 0.012), (0.0, 0.03)], (-0.04 + i * 0.04, -0.01, 0.05), (goods, RED, C(110, 160, 80))[i], n=6)


def i_bazaar(stage):
    def f():
        H = plain("low", SAND)
        with at((0, 0, H), s=1.5):
            box((1.0, 0.14, 0.008), (0, -0.05, 0.004), C(214, 192, 150), rz=-10)
            stalls = [((-0.35, 0.1), RED), ((-0.12, 0.18), TURQ), ((0.12, 0.12), OCHRE), ((0.36, 0.05), LAPIS),
                      ((-0.3, -0.25), C(110, 160, 80)), ((0.0, -0.3), RED), ((0.28, -0.3), TURQ)]
            if stage == 0:
                for (x, y), c in stalls[:4]:
                    awning_stall((x, y, 0), c, rz=-10)
            else:
                # covered bazaar: a long arcade with a row of small domes
                with at((0.0, 0.25, 0), rz=-10):
                    box((0.72, 0.2, 0.13), (0, 0, 0.065), P.HOUSE, bevel=0.006)
                    for i in range(6):
                        x = -0.3 + i * 0.12
                        arch((x, -0.104, 0.0), 0.07, 0.1, DARK, pointed=True)
                        dome((x, 0, 0.13), 0.05, P.HOUSE if i % 2 else TURQ, "round", finial=None, n=8)
                for (x, y), c in stalls[4:]:
                    awning_stall((x, y, 0), c, rz=-10)
    return f


def i_watchtower():
    H = plain("low", STEPPE)
    with at((0, 0, H), s=1.45):
        cyl(0.12, 0.42, (0, 0, 0), CA.WALL, n=8, r2=0.085)
        cyl(0.1, 0.04, (0, 0, 0.42), CA.WALL, n=8)
        for x, y, z, a in ring_of(6, 0.085, 0.46):
            lathe([(0.02, 0), (0.02, 0.02), (0, 0.04)], (x, y, z), CA.WALL, n=5)
        box((0.06, 0.01, 0.08), (0, -0.11, 0.04), WOOD_D)
        arch((0, -0.095, 0.3), 0.03, 0.05, DARK)
        cyl(0.03, 0.03, (0, 0, 0.46), ROCK_D, n=6)
        cone(0.035, 0.07, (0, 0, 0.49), C(250, 150, 50), n=5, emit=1.2)
        flag((0.07, 0.03, 0.46), None, h=0.16, w=0.08, fh=0.05)
        for (x, y) in ((0.3, -0.3), (-0.3, 0.2)):
            tuft((x, y, 0), 1.0, STEPPE_D)


def i_fort():
    H = plain("low", STEPPE)
    with at((0, 0, H), s=1.4):
        w = 0.6
        box((w, w, 0.012), (0, 0, 0.006), C(214, 196, 150))
        for k, (x, y, rz) in enumerate(((0, -w / 2, 0), (0, w / 2, 0), (-w / 2, 0, 90), (w / 2, 0, 90))):
            with at((x, y, 0), rz=rz):
                if k == 0:
                    LV.gate(w, 0.12)
                else:
                    LV.wall(w, 0.12)
        for sx in (-1, 1):
            for sy in (-1, 1):
                with at((sx * w / 2, sy * w / 2, 0)):
                    LV.tower(0.2)
        with at((0.05, 0.08, 0)):
            LV.keep(0.16, 0.26)
        flag((0.05, 0.08, 0.29), None, h=0.16, w=0.08, fh=0.05)


def dock(p, L=0.4, rz=0.0):
    with at(p, rz=rz):
        box((0.12, L, 0.02), (0, -L / 2, 0.0), WOOD)
        for k in range(int(L / 0.1) + 1):
            for sx in (-1, 1):
                cyl(0.01, 0.14, (sx * 0.055, -k * 0.1, -0.12), WOOD_D, n=5)


def i_port(stage):
    def f():
        nx, ny = coast_split(ELEV["low"], sea_ang=300, c=0.05)
        H = ELEV["low"]
        with at((0, 0, 0)):
            if stage == 0:
                dock((0.15, -0.05, WATER_Z + 0.06), 0.45, rz=30)
                with at((0.36, -0.45, WATER_Z), rz=0, s=UNIT_S):
                    from ck_units import barge
                    barge()
                with at((-0.3, 0.3, H), s=1.8):
                    farmhouse((0, 0, 0), 0)
                for i in range(3):
                    ell((-0.05 + i * 0.05, 0.05, H + 0.03), (0.025, 0.025, 0.03), (OCHRE, RED, C(140, 90, 60))[i], seg=6, ring=4)
            else:
                # stone quay, crane, warehouse
                with at((0, 0, 0)):
                    prism(ccw([(0.0, -0.05), (0.22, -0.36), (0.42, -0.22), (0.2, 0.1)]), 0.0, WATER_Z + 0.08, C(200, 190, 176))
                dock((0.38, -0.3, WATER_Z + 0.06), 0.3, rz=30)
                crane((0.22, -0.18, WATER_Z + 0.08), 0.4, rz=120)
                with at((-0.25, 0.3, H), rz=0, s=1.5):
                    box((0.3, 0.18, 0.12), (0, 0, 0.06), P.HOUSE, bevel=0.006)
                    for x in (-0.08, 0.0, 0.08):
                        arch((x, -0.094, 0.0), 0.05, 0.08, DARK)
                    box((0.32, 0.2, 0.015), (0, 0, 0.125), C(196, 160, 110))
                with at((0.5, -0.55, WATER_Z), rz=0, s=UNIT_S):
                    from ck_units import dhow
                    dhow()
                for i in range(3):
                    box((0.05, 0.05, 0.04), (0.1 + i * 0.055, -0.08, WATER_Z + 0.1), WOOD, rz=30)
    return f


def i_granary():
    H = plain("low", SAND)
    with at((0, 0, H), s=1.6):
        for i, (x, y, s) in enumerate(((-0.18, 0.12, 1.0), (0.12, 0.2, 0.9), (0.05, -0.12, 0.8))):
            with at((x, y, 0), s=s):
                lathe([(0.13, 0), (0.135, 0.1), (0.11, 0.2), (0.06, 0.28), (0, 0.31)], (0, 0, 0), MUD, n=10)
                box((0.04, 0.01, 0.06), (0, -0.13, 0.13), WOOD_D)
                cyl(0.025, 0.02, (0, 0, 0.3), MUD_D, n=6)
        for i in range(4):
            ell((0.3 + 0.05 * (i % 2), -0.25 + 0.05 * (i // 2), 0.03 + 0.03 * (i == 3)), (0.03, 0.025, 0.03), C(214, 190, 140), seg=6, ring=4)


def i_windmill():
    H = plain("low", SAND)
    with at((0, 0, H), s=1.15, rz=-30):
        # Persian vertical-axis windmill row: tall mud walls with sail rotors between
        for i, x in enumerate((-0.24, 0.0, 0.24)):
            box((0.06, 0.24, 0.5), (x - 0.12, 0.0, 0.25), MUD, bevel=0.01)
            if i == 2:
                box((0.06, 0.24, 0.5), (x + 0.12, 0.0, 0.25), MUD, bevel=0.01)
            cyl(0.006, 0.42, (x, -0.02, 0.06), WOOD_D, n=4)
            for k in range(6):
                a = k * 60 + 15 * i
                ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
                box((0.08, 0.014, 0.32), (x + ca * 0.045, -0.02 + sa * 0.045, 0.27), C(244, 220, 150), rz=a)
            box((0.24, 0.24, 0.025), (x, 0.0, 0.47), MUD_D)
        box((0.84, 0.3, 0.06), (0, 0.0, 0.03), MUD_D)
        box((0.84, 0.03, 0.3), (0.0, 0.135, 0.2), MUD)  # windward wall


def i_waystation():
    H = plain("low", STEPPE)
    with at((0, 0, H), s=1.6):
        with at((0.0, 0.15, 0)):
            CA.house(1)
        # hitching rail, water trough, lantern post, tree
        for sx in (-1, 1):
            cyl(0.008, 0.07, (-0.3 + sx * 0.1, -0.15, 0), WOOD, n=4)
        box((0.22, 0.01, 0.01), (-0.3, -0.15, 0.065), WOOD)
        box((0.16, 0.06, 0.04), (0.2, -0.2, 0.02), WOOD_D)
        box((0.14, 0.04, 0.005), (0.2, -0.2, 0.04), WATER)
        cyl(0.007, 0.22, (0.32, 0.0, 0), WOOD_D, n=4)
        box((0.06, 0.008, 0.008), (0.345, 0.0, 0.21), WOOD_D)
        cyl(0.018, 0.035, (0.37, 0.0, 0.16), C(250, 190, 80), n=6, emit=1.2)
        poplar((-0.35, 0.3, 0), 0.9)
        signpost((-0.05, -0.4, 0), 1.2)


def i_caravanserai(stage):
    def f():
        H = plain("low", SAND)
        with at((0, 0, H), s=1.35):
            staged(caravanserai, 0 if stage == 0 else 2)
    return f


def wonder_banners(H):
    for x in (-0.62, 0.62):
        banner((x, 0.3, H), h=0.4, w=0.09, fh=0.16)


def with_flag(fn):
    """Improvements fly one team flag at the back-left corner."""
    def f():
        fn()
        flag((-0.56, 0.32, ELEV["low"]), None, h=0.3, w=0.11, fh=0.065)
    return f


IMPROVEMENTS_RAW = [
    ("Farming", [("farm: tilled", i_farm(0)), ("farm: growing", i_farm(1)), ("farm: harvest", i_farm(2)),
                 ("silk: saplings", i_silk(0)), ("silk: grove", i_silk(1)), ("silk: worm house", i_silk(2)), ("pasture", i_pasture)]),
    ("Extraction + storage", [("mine: prospect", i_mine(0)), ("mine", i_mine(1)), ("quarry: marked", i_quarry(0)), ("quarry", i_quarry(1)),
                              ("granary", i_granary), ("windmill", i_windmill)]),
    ("Trade + defence", [("caravanserai: building", i_caravanserai(0)), ("caravanserai", i_caravanserai(2)), ("bazaar: stalls", i_bazaar(0)),
                         ("bazaar: covered", i_bazaar(1)), ("waystation", i_waystation), ("watchtower", i_watchtower), ("fort", i_fort)]),
    ("Port", [("port: jetty", i_port(0)), ("port: harbour", i_port(1))]),
]

IMPROVEMENTS = [(lab, [(n, with_flag(f)) for n, f in cells]) for lab, cells in IMPROVEMENTS_RAW]

# ---------------------------------------------------------------- wonders


def w_gate():
    for sx in (-1, 1):
        with at((sx * 0.62, 0, 0)):
            P.wall(0.42, 0.18)
    for sx in (-1, 1):
        cyl(0.13, 0.62, (sx * 0.22, 0, 0), P.WALL, n=10, r2=0.11)
        cyl(0.125, 0.03, (sx * 0.22, 0, 0.62), TURQ, n=10)
        cyl(0.115, 0.05, (sx * 0.22, 0, 0.65), P.WALL, n=10)
        cyl(0.122, 0.03, (sx * 0.22, 0, 0.36), LAPIS, n=10)
        for x, y, z, a in ring_of(7, 0.095, 0.7):
            lathe([(0.022, 0), (0.022, 0.02), (0, 0.04)], (sx * 0.22 + x, y, z), P.WALL, n=5)
    with at((0, 0, 0)):
        box((0.34, 0.16, 0.5), (0, 0, 0.25), P.WALL)
        slab([(-0.15, 0), (0.15, 0), (0.15, 0.46), (-0.15, 0.46)], 0.01, (0, -0.084, 0), LAPIS)
        arch((0, -0.09, 0), 0.24, 0.42, TURQ, pointed=True)
        arch((0, -0.094, 0), 0.16, 0.3, DARK, pointed=True)
        box((0.36, 0.18, 0.03), (0, 0, 0.5), P.WALL)
        merlons(0.36, 0.53, P.WALL, k=6, s=0.035, t=0.17, round_=True)
    for sx in (-1, 1):
        flag((sx * 0.22, 0, 0.7), None, h=0.2, w=0.1, fh=0.07, swallow=True)


def w_bazaar():
    with at((0, 0.05, 0)):
        box((0.9, 0.32, 0.16), (0, 0, 0.08), P.HOUSE, bevel=0.008)
        for i in range(7):
            x = -0.36 + i * 0.12
            if i != 3:
                dome((x, 0, 0.16), 0.055, P.HOUSE if i % 2 else TURQ, "round", finial=None, n=8)
            arch((x, -0.164, 0.0), 0.07, 0.11, DARK, pointed=True)
        cyl(0.11, 0.06, (0, 0, 0.16), P.HOUSE, n=12)
        dome((0, 0, 0.22), 0.11, TURQ, "pointed", n=12)
        with at((0, -0.17, 0)):
            P.iwan(0.22, 0.3, 0.05)
    for (x, y), c in (((-0.35, -0.35), RED), ((-0.12, -0.42), OCHRE), ((0.3, -0.38), TURQ)):
        awning_stall((x, y, 0), c)


def w_observatory():
    # three-tier round drum + giant meridian arc + armillary sphere
    for i, (r, h) in enumerate(((0.36, 0.12), (0.3, 0.12), (0.24, 0.1))):
        z = sum(hh for _, hh in ((0.36, 0.12), (0.3, 0.12), (0.24, 0.1))[:i])
        cyl(r, h, (0, 0.05, z), P.HOUSE if i != 1 else C(226, 204, 166), n=16)
        cyl(r + 0.002, 0.018, (0, 0.05, z + h - 0.03), LAPIS if i % 2 == 0 else TURQ, n=16)
        for k in range(10):
            a = math.radians(-90 + (k - 4.5) * 14)
            arch((r * math.cos(a) * 1.002, 0.05 + r * math.sin(a) * 1.002, z + 0.02), 0.04, h - 0.05, DARK, rz=math.degrees(a) + 90)
    # meridian arc (sextant) rising out of the top
    # meridian sextant: a fat quarter-disc standing on the roof, with a lapis scale band
    pie = [(0.0, 0.0)] + [(-0.26 * math.cos(math.radians(a)), 0.26 * math.sin(math.radians(a))) for a in range(0, 91, 15)]
    slab(pie, 0.1, (0.1, 0.12, 0.34), C(214, 190, 150))
    band = [(-0.27 * math.cos(math.radians(a)), 0.27 * math.sin(math.radians(a))) for a in range(0, 91, 15)]
    band += [(-0.21 * math.cos(math.radians(a)), 0.21 * math.sin(math.radians(a))) for a in range(90, -1, -15)]
    slab(band, 0.104, (0.1, 0.12, 0.34), LAPIS)
    # armillary sphere
    with at((0.33, -0.3, 0)):
        cyl(0.04, 0.12, (0, 0, 0), ROCK, n=6)
        for rx, rz in ((0, 0), (90, 0), (90, 90), (60, 30)):
            torus(0.09, 0.008, (0, 0, 0.21), GOLD, n=14, k=4, rx=rx, rz=rz, metal=0.4, rough=0.4)
        ell((0, 0, 0.21), 0.02, LAPIS, seg=6, ring=4)


def w_pagoda():
    for i, (w, d) in enumerate(((0.6, 0.6), (0.5, 0.5))):
        box((w, d, 0.04), (0, 0, 0.02 + i * 0.04), C(232, 226, 214))
    z = 0.08
    r = 0.17
    for i in range(7):
        h = 0.11 - i * 0.007
        cyl(r, h, (0, 0, z), RED if i % 2 == 0 else C(240, 230, 214), n=8, rz=22.5)
        lathe([(r * 1.55, 0), (r * 1.42, h * 0.12), (r * 1.1, h * 0.38), (r * 0.9, h * 0.5)], (0, 0, z + h - 0.005), TILE_G, n=8, rz=22.5)
        z += h + h * 0.4
        r *= 0.88
    cyl(0.012, 0.16, (0, 0, z - 0.03), GOLD, n=6)
    for k in range(3):
        torus(0.024 - k * 0.004, 0.006, (0, 0, z + 0.02 + k * 0.035), GOLD, n=8, k=4)
    ell((0, 0, z + 0.14), 0.02, GOLD, seg=6, ring=4)


def w_lighthouse():
    box((0.36, 0.36, 0.3), (0, 0, 0.15), C(232, 220, 196), bevel=0.01)
    box((0.38, 0.38, 0.025), (0, 0, 0.3), C(214, 196, 160))
    cyl(0.14, 0.32, (0, 0, 0.32), C(236, 228, 210), n=8, r2=0.12, rz=22.5)
    cyl(0.13, 0.02, (0, 0, 0.64), C(214, 196, 160), n=8, rz=22.5)
    cyl(0.085, 0.16, (0, 0, 0.66), C(240, 234, 220), n=10, r2=0.075)
    for k in range(6):
        a = k * 60
        cyl(0.008, 0.08, (0.07 * math.cos(math.radians(a)), 0.07 * math.sin(math.radians(a)), 0.82), WOOD_D, n=4)
    cone(0.06, 0.09, (0, 0, 0.82), C(255, 170, 50), n=6, emit=1.5)
    cone(0.1, 0.06, (0, 0, 0.9), TERRA, n=8)
    for z in (0.08, 0.2):
        for x in (-0.08, 0.08):
            box((0.03, 0.01, 0.05), (x, -0.184, z), DARK)
    arch((0, -0.184, 0.32), 0.04, 0.07, DARK)


def w_library():
    # a columned talar veranda in front of a long hall, scroll racks, reflecting pool
    box((0.84, 0.66, 0.04), (0, 0.0, 0.02), C(226, 210, 176))
    box((0.16, 0.34, 0.012), (0, -0.16, 0.04), TURQ)
    with at((0, 0.14, 0.04)):
        box((0.7, 0.24, 0.24), (0, 0.04, 0.12), P.HOUSE, bevel=0.008)
        for i in range(5):
            arch((-0.24 + i * 0.12, -0.084, 0.03), 0.07, 0.14, LAPIS, pointed=True)
            arch((-0.24 + i * 0.12, -0.088, 0.04), 0.045, 0.1, DARK)
        # talar: slim wooden columns + flat painted roof
        for i in range(6):
            x = -0.3 + i * 0.12
            cyl(0.01, 0.26, (x, -0.2, 0), WOOD, n=6)
            cyl(0.018, 0.014, (x, -0.2, 0.25), GOLD, n=6)
        box((0.7, 0.16, 0.022), (0, -0.13, 0.27), WOOD_D)
        box((0.72, 0.17, 0.01), (0, -0.13, 0.284), TURQ)
        for i in range(3):
            with at((-0.18 + i * 0.18, -0.06, 0)):
                box((0.12, 0.04, 0.16), (0, 0, 0.08), WOOD_D)
                for r in range(3):
                    for c in range(4):
                        cyl(0.011, 0.035, (-0.04 + c * 0.027, -0.022, 0.03 + r * 0.045), (CREAM, OCHRE, RED, TURQ)[(r + c + i) % 4], n=6, rx=90)
        cyl(0.11, 0.06, (0, 0.06, 0.24), P.HOUSE, n=12)
        dome((0, 0.06, 0.3), 0.11, LAPIS, "round", n=12)
    for x in (-0.36, 0.36):
        poplar((x, -0.26, 0.04), 0.7, C(60, 120, 70))


def w_cistern():
    # ab anbar: a stepped conical dome over a sunken tank, ringed by four windcatchers
    lathe([(0.3, 0), (0.3, 0.06), (0.26, 0.14), (0.2, 0.22), (0.13, 0.29), (0.06, 0.33), (0, 0.34)], (0, 0.05, 0), MUD, n=14)
    for i, z in enumerate((0.06, 0.14, 0.22)):
        r = (0.3, 0.26, 0.2)[i]
        cyl(r + 0.004, 0.014, (0, 0.05, z - 0.005), MUD_D, n=14)
    for (x, y) in ((-0.38, 0.0), (0.38, 0.0), (-0.18, 0.4), (0.24, 0.38)):
        with at((x, y, 0)):
            P.windcatcher((0, 0, 0), 0.12, s=2.1)
    with at((0, -0.3, 0)):
        box((0.22, 0.14, 0.22), (0, 0, 0.11), P.HOUSE)
        slab([(-0.09, 0), (0.09, 0), (0.09, 0.19), (-0.09, 0.19)], 0.01, (0, -0.074, 0), TURQ)
        arch((0, -0.078, 0), 0.12, 0.17, LAPIS, pointed=True)
        arch((0, -0.082, 0), 0.07, 0.11, DARK, pointed=True)
        for k in range(3):
            box((0.1, 0.03, 0.01), (0, -0.09 - k * 0.03, 0.005 - k * 0.0), C(200, 184, 150))


def w_bridge():
    # two-level arcaded stone bridge with a central pavilion, spanning a river (x axis)
    L, h = 1.8, 0.3
    poly = [(-L / 2, -0.08), (L / 2, -0.08), (L / 2, h)]
    poly.append((-L / 2, h))
    slab([(-L / 2, 0), (L / 2, 0), (L / 2, h), (-L / 2, h)], 0.2, (0, 0, -0.08), C(214, 186, 140))
    k = 5
    for i in range(k):
        x = -0.48 + i * 0.24
        arch((x, -0.104, -0.08), 0.16, 0.26, DARK)
        arch((x, -0.104, 0.21), 0.06, 0.06, DARK)
    box((L, 0.22, 0.02), (0, 0, h - 0.07), C(196, 166, 120))
    for sy in (-1, 1):
        box((L, 0.02, 0.04), (0, sy * 0.1, h - 0.04), C(214, 186, 140))
    with at((0, 0, h - 0.06)):
        box((0.22, 0.24, 0.16), (0, 0, 0.08), P.HOUSE)
        arch((0, -0.124, 0.0), 0.1, 0.13, DARK, pointed=True)
        slab([(-0.08, 0), (0.08, 0), (0.08, 0.15), (-0.08, 0.15)], 0.01, (0, -0.122, 0.0), TURQ)
        dome((0, 0, 0.16), 0.07, TURQ, "pointed")
    for sx in (-1, 1):
        cyl(0.04, 0.24, (sx * 0.84, -0.1, -0.08), C(214, 186, 140), n=8)


def _wonder_tile(name, fn, terrain="desert", seed=2, s=1.0, cut=0.5):
    def f(stage):
        def g():
            if terrain == "river":
                H = tile("river straight", "low", seed)
                with at((0, 0, H), s=s):
                    staged(fn, stage, cut=cut)
                wonder_banners(H)
                return
            if terrain == "coast":
                coast_split(ELEV["low"], sea_ang=300, c=0.15)
                H = ELEV["low"]
                with at((-0.12, 0.12, H), s=s):
                    staged(fn, stage, cut=cut)
                wonder_banners(H)
                return
            H = plain("low", {"desert": SAND, "grass": GRASS, "steppe": STEPPE}[terrain])
            with at((0, 0, H), s=s):
                staged(fn, stage, cut=cut)
            wonder_banners(H)
        return g
    return name, f


WONDERS = [
    _wonder_tile("Great Gate", w_gate, s=1.05), _wonder_tile("Grand Bazaar", w_bazaar, s=1.2), _wonder_tile("Star Observatory", w_observatory, "steppe", s=1.45, cut=0.32),
    _wonder_tile("Bell Tower", w_pagoda, "grass", s=1.35), _wonder_tile("Lighthouse", w_lighthouse, "coast", s=1.35), _wonder_tile("Great Library", w_library, "grass", s=1.15),
    _wonder_tile("Cistern", w_cistern, s=1.4), _wonder_tile("High Bridge", w_bridge, "river"),
]
