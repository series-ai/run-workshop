"""Scrub test: pose every character through every exported frame of every clip and report problems.

For each piece, its rest neighbours are the pieces it touches in the rest pose. A piece
DETACHES when, at some sampled moment of some clip, it is farther than TOL from every one
of its rest neighbours (world bounding boxes). A piece SINKS when it goes below the floor. A piece POKES when, during a clip, it pushes deeper
than POKE into a big piece of another rig part than it sits at rest (a mitt popping out of a suit,
hair swinging into the body, a bar poking through a costume).

    Blender -b --factory-startup --python scrub.py -- [<slug> ...]   (no slugs: all)
"""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), ".."))  # tools/run-costume-kids
import sys

CHARS = sys.argv[sys.argv.index("--") + 1:]
sys.argv = [sys.argv[0], "--", _PKG + "/rig/dbg", "x"]
src = open(_PKG + "/rig/toyanim.py").read().split("\nfor slug in SLUGS:")[0]
exec(compile(src, "toyanim.py", "exec"))
FPS = 30  # as the exporter
_e = open(_PKG + "/rig/export_glb.py").read()
exec(compile(_e[_e.index("def pose_loop"):_e.index("\ndef export(")], "pose_loop", "exec"))  # the exported clips' exact pose

TOUCH, TOL, FLOOR, SAMPLES = 0.04, 0.12, -0.12, 16
POKE, POKE_SAMPLES, BIG = 0.12, 8, 1.2
from mathutils.bvhtree import BVHTree  # noqa: E402


def shells(objs):
    """BVH trees (in each big piece's own space) of the big pieces: the bodies things could poke into."""
    dg = bpy.context.evaluated_depsgraph_get()
    out = {}
    for o in objs:
        dims = o.dimensions
        if max(dims) > BIG and min(dims) > 0.25:
            ev = o.evaluated_get(dg)
            me = ev.to_mesh()
            out[o] = BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons])
            ev.to_mesh_clear()
    return out


RAYS = (Vector((0.577, 0.577, 0.577)), Vector((-0.6, 0.48, -0.64)))


def _crossings(tree, q, d):
    n, o = 0, q.copy()
    for _ in range(32):
        hit = tree.ray_cast(o, d)
        if hit[0] is None:
            return n
        n += 1
        o = hit[0] + d * 1e-4
    return n


def depth_inside(tree, mw_inv, pts):
    """How far the deepest of `pts` (world) is inside the piece: inside means an odd number
    of surface crossings along two different rays (robust to open or flipped faces)."""
    d, inside = 0.0, 0
    for p in pts:
        q = mw_inv @ p
        if all(_crossings(tree, q, r) % 2 == 1 for r in RAYS):
            inside += 1
            hit = tree.find_nearest(q)
            if hit[0] is not None:
                d = max(d, hit[3])
    return 0.0 if inside == len(pts) else d  # wholly inside (a leg under a skirt) is hidden, not a poke


def boxes(objs):
    out = {}
    for o in objs:
        pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
        out[o] = (Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)]))
    return out


def gap(a, b):
    return max(max(b[0][i] - a[1][i], a[0][i] - b[1][i]) for i in range(3))


for slug in CHARS or [s.strip() for s in open(_PKG + "/rig/slugs.txt") if s.strip()]:
    try:
        parts, rest = build_rig(slug)
    except Exception as ex:
        print("FAIL", slug, repr(ex), flush=True)
        continue
    owner = {o: n for n, e in parts.items() for o in e.children if o.type == "MESH"}
    objs = list(owner)
    trees = shells(objs)
    movers = [o for o in objs if not owner[o].startswith(("hips", "root", "expr.")) and not o.name.startswith("neck_stub")]
    samples = {o: [Vector(v.co) for v in o.data.vertices][:: max(1, len(o.data.vertices) // 40)] for o in movers}

    def pokes():
        out = {}
        for b, tree in trees.items():
            inv = b.matrix_world.inverted()
            for o in movers:
                if owner[o] == owner[b] or o is b:
                    continue
                pts = [o.matrix_world @ v for v in samples[o]]
                d = depth_inside(tree, inv, pts)
                if d > 0:
                    out[(o, b)] = d
        return out
    bpy.context.view_layer.update()
    poke0 = pokes()
    poke = {}
    b0 = boxes(objs)
    nbrs = {o: [q for q in objs if q is not o and gap(b0[o], b0[q]) < TOUCH] for o in objs}
    worst = {}  # piece -> (separation, clip, t)
    sink = {}
    for label, clip, period, _ in CLIPS:
        n = max(2, round(period * FPS))
        plan = guard_plan(parts, rest, clip, period, n)
        for f in range(n + 1 if clip.__name__ in ONESHOT else n):  # every exported frame
            k = f
            t = period * f / n
            pose_guarded(parts, rest, clip, period, f, n, plan)  # exactly the exported frame
            bpy.context.view_layer.update()
            b = boxes(objs)
            for o in objs:
                if nbrs[o]:
                    sep = min(gap(b[o], b[q]) for q in nbrs[o])
                    if sep > TOL and sep > worst.get(o, (0,))[0]:
                        worst[o] = (sep, label, round(t, 2))
                lowz = b[o][0].z
                if lowz < FLOOR and lowz < sink.get(o, (0,))[0]:
                    sink[o] = (lowz, label, round(t, 2))
            if True:
                for key, d in pokes().items():
                    extra = d - poke0.get(key, 0.0)
                    if extra > POKE and extra > poke.get(key, (0,))[0]:
                        poke[key] = (extra, label, round(t, 2))
    for o, (sep, label, t) in sorted(worst.items(), key=lambda kv: -kv[1][0]):
        c = (b0[o][0] + b0[o][1]) / 2
        z = b0[o][1] - b0[o][0]
        na = sorted({owner[q] for q in nbrs[o]})
        print("DETACH", slug, owner[o], _colour(o), tuple(round(v, 2) for v in c), tuple(round(v, 2) for v in z),
              f"sep={sep:.2f}", label, t, "nbrs=" + ",".join(na), o.name, flush=True)
    for o, (lowz, label, t) in sink.items():
        c = (b0[o][0] + b0[o][1]) / 2
        print("SINK", slug, owner[o], _colour(o), tuple(round(v, 2) for v in c), f"z={lowz:.2f}", label, t, o.name, flush=True)
    for (o, bq), (extra, label, t) in sorted(poke.items(), key=lambda kv: -kv[1][0]):
        c = (b0[o][0] + b0[o][1]) / 2
        print("POKE", slug, owner[o], _colour(o), tuple(round(v, 2) for v in c), "into", owner[bq], _colour(bq),
              f"depth=+{extra:.2f}", label, t, o.name, bq.name, flush=True)
    print("DONE", slug, len(worst), len(sink), len(poke), flush=True)
