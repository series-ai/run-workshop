# Cut monstera-style holes straight into a Tiny Treats leaf, keeping its mesh, padding, UVs and stem.
#   args: -- <kit_leaf.gltf> <out.glb> <name> <style>
#   style 'fen'  : row of small oval holes beside the midrib, between the kit's notches (mature fenestrated)
#   style 'skel' : big rounded window in every lobe + the midrib row (window-leaf / obliqua look)
import bpy, bmesh, sys, math
sys.path.append("/tmp/pm-blpkgs")
import numpy as np
from mathutils import Vector, Matrix
a = sys.argv[sys.argv.index('--') + 1:]; src_f, out_f, name, style = a[:4]
size_k = float(a[4]) if len(a) > 4 else 1.0
FOLD = float(a[5]) if len(a) > 5 else 1.0
PLAN_ONLY = len(a) > 6 and a[6] == 'plan'
NSPLIT = int(a[7]) if len(a) > 7 else 0
import json as _json
G = _json.loads(a[8]) if len(a) > 8 else {}          # growth-stage recipe (overrides the style defaults)
CUSTOM = 'nsplit' in G
if CUSTOM: NSPLIT = G['nsplit']
bpy.ops.wm.read_factory_settings(use_empty=True)
before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=src_f)
ob = [o for o in set(bpy.data.objects) - before if o.type == 'MESH'][0]
ob.data.transform(ob.matrix_world); ob.parent = None; ob.matrix_world = Matrix.Identity(4)
for m in ob.data.materials: m.use_backface_culling = False
bm = bmesh.new(); bm.from_mesh(ob.data)
# islands: stem = touches z~0, blade = biggest
seen = set(); islands = []
for f in bm.faces:
    if f in seen: continue
    st, isl = [f], []
    while st:
        g = st.pop()
        if g in seen: continue
        seen.add(g); isl.append(g)
        for e in g.edges:
            for h in e.link_faces:
                if h not in seen: st.append(h)
    islands.append(isl)
stem_isl = [isl for isl in islands if min(v.co.z for f in isl for v in f.verts) < 0.02 and len(isl) < 0.5 * len(bm.faces)]
blade = [f for isl in islands if not any(isl is si for si in stem_isl) for f in isl]
blade_idx = set(f.index for f in blade)
stem = stem_isl
stem_top = max((v.co for isl in stem for f in isl for v in f.verts), key=lambda q: q.z) if stem else None
P = np.array([v.co[:] for v in set(v for f in blade for v in f.verts)])
c = P.mean(0); w, V = np.linalg.eigh(np.cov((P - c).T)); nrm, across, along = V[:, 0], V[:, 1], V[:, 2]
base3 = np.array(stem_top[:]) if stem_top is not None else c - along
if np.dot(base3 - c, along) > 0: along = -along
# 2D outline of the blade (boundary edges, projected)
nv_ = Vector(nrm.tolist())
front_sign = 1 if sum(f.normal.dot(nv_) * f.calc_area() for f in blade) >= 0 else -1
front_faces = [f for f in blade if f.normal.dot(nv_) * front_sign > 0]
front_idx = set(f.index for f in front_faces)
from shapely.geometry import Polygon, Point, LineString, MultiPoint
from shapely.ops import polygonize, unary_union
from shapely import affinity
bset = set(blade)
bedges = [e for e in bm.edges if sum(1 for f in e.link_faces if f in bset) == 1]
def p2(co): q = np.array(co[:]) - c; return (float(q @ across), float(q @ along))
tris2d = []
for f in front_faces:
    pts = [p2(v.co) for v in f.verts]
    pg = Polygon(pts)
    if pg.is_valid and pg.area > 0: tris2d.append(pg)
    else: tris2d.append(pg.buffer(0))
outline = unary_union([t.buffer(1e-5) for t in tris2d]).buffer(0.004).buffer(-0.002)
if outline.geom_type != 'Polygon': outline = max(outline.geoms, key=lambda g: g.area)
outline = Polygon(outline.exterior)   # silhouette (ignore any interior gaps)
ox0, oy0, ox1, oy1 = outline.bounds; Lb = oy1 - oy0; Wb = ox1 - ox0
# midrib: from the blade base point to the tip, along the 'along' axis through the stem attach
att = p2(base3); att = (att[0], max(att[1], oy0))
# notches: concave pockets = hull minus outline
pockets = [g for g in getattr(outline.convex_hull.difference(outline), 'geoms', [outline.convex_hull.difference(outline)]) if g.area > 0.004 * outline.area]
def ang_of(pt): return math.atan2(pt[0] - att[0], pt[1] - att[1])     # 0 = toward tip
notch_angles = sorted(ang_of((g.centroid.x, g.centroid.y)) for g in pockets if abs(ang_of((g.centroid.x, g.centroid.y))) < math.radians(150))
print('notches', len(pockets), [round(math.degrees(x)) for x in notch_angles])
def ray_len(phi, o):
    d = (math.sin(phi), math.cos(phi)); seg = LineString([o, (o[0] + d[0] * 5, o[1] + d[1] * 5)])
    g = outline.exterior.intersection(seg); pts = [g] if g.geom_type == 'Point' else list(getattr(g, 'geoms', []))
    return min((math.hypot(p.x - o[0], p.y - o[1]) for p in pts), default=0.3 * Lb)
def oval(cx, cy, phi, ra, rb, n=12):
    d = (math.sin(phi), math.cos(phi)); nn = (d[1], -d[0])
    return Polygon([(cx + d[0] * ra * math.cos(t) + nn[0] * rb * math.sin(t), cy + d[1] * ra * math.cos(t) + nn[1] * rb * math.sin(t))
                    for t in [2 * math.pi * k / n for k in range(n)]])
# straighten: midrib direction = principal axis of the notches' inner ends, pointing away from the stem
_hull0 = outline.convex_hull
_deep = []
for g in pockets:
    cs_ = list(g.exterior.coords)
    _deep.append(max(cs_, key=lambda q: _hull0.exterior.distance(Point(q))))
THETA = 0.0
if len(_deep) >= 3:
    D_ = np.array(_deep); m_ = D_.mean(0); ev_, evec_ = np.linalg.eigh(np.cov((D_ - m_).T)); ax_ = evec_[:, 1]
    if np.dot(np.array(att) - m_, ax_) > 0: ax_ = -ax_
    THETA = math.degrees(math.atan2(ax_[0], ax_[1]))        # rotate by +THETA to make the axis point up (+y)
ROT0 = (0.0, 0.0)
outline_orig = outline
outline = affinity.rotate(outline, THETA, origin=ROT0)
pockets = [affinity.rotate(g, THETA, origin=ROT0) for g in pockets]
att = tuple(affinity.rotate(Point(att), THETA, origin=ROT0).coords[0])
ox0, oy0, ox1, oy1 = outline.bounds; Lb = oy1 - oy0; Wb = ox1 - ox0
print('straighten by', round(THETA, 1), 'deg')
holes = []
hull = outline.convex_hull
mx = att[0]                                     # provisional midrib x; refined from the notches below
notches = []
for g in pockets:
    cs = list(g.exterior.coords)
    deep = max(cs, key=lambda q: hull.exterior.distance(Point(q)))      # inner end of the notch
    if abs(deep[0] - outline.centroid.x) < 0.04 * Wb and deep[1] < oy0 + 0.35 * Lb: continue   # basal sinus, not a lobe notch
    cen = (g.centroid.x, g.centroid.y)
    dx, dy = cen[0] - deep[0], cen[1] - deep[1]; m = math.hypot(dx, dy) or 1
    ln = hull.exterior.distance(Point(deep))
    notches.append({'deep': deep, 'dir': (dx / m, dy / m), 'len': ln, 'side': 1 if deep[0] > mx else -1})
L_ = [q['deep'][0] for q in notches if q['deep'][0] < outline.centroid.x]; R_ = [q['deep'][0] for q in notches if q['deep'][0] >= outline.centroid.x]
mx = (max(L_) + min(R_)) / 2 if L_ and R_ else outline.centroid.x
for q in notches: q['side'] = 1 if q['deep'][0] > mx else -1
print('lobe notches', len(notches), 'midrib x', round(mx, 3), 'att x', round(att[0], 3))
def oval2(cx, cy, d, ra, rb, n=16, k=0.3):
    # teardrop: d points outward (away from the midrib); width shrinks toward the outer end
    nn = (d[1], -d[0])
    pts = []
    for t in [2 * math.pi * j / n for j in range(n)]:
        w = rb * math.sin(t) * (1 - k * math.cos(t))
        pts.append((cx + d[0] * ra * math.cos(t) + nn[0] * w, cy + d[1] * ra * math.cos(t) + nn[1] * w))
    return Polygon(pts)
# ---- symmetric plan: build holes for the right side only, mirror across the midrib later ----
# styles: fen2 (1 pair beside the midrib), fen4 (2 pairs), fenfull (midrib pairs + a window per lobe),
#         skel (bigger lobe windows + an outer row + midrib pairs: mostly ribs remain)
R = sorted([q for q in notches if q['side'] == 1], key=lambda q: q['deep'][1])
Lft = sorted([q for q in notches if q['side'] == -1], key=lambda q: q['deep'][1])
# use whichever side has more notches as the template, expressed as a right-side notch list
if len(Lft) > len(R):
    R = [dict(q, deep=(2 * mx - q['deep'][0], q['deep'][1]), dir=(-q['dir'][0], q['dir'][1]), side=1) for q in Lft]
def axis(q, t):
    if 'curve' in q:
        pt_ = q['curve'].interpolate(t * q['len']); return (pt_.x, pt_.y)
    return (q['deep'][0] + q['dir'][0] * q['len'] * t, q['deep'][1] + q['dir'][1] * q['len'] * t)

if NSPLIT or CUSTOM:
    # custom silhouette: the kit leaf with its notches closed, then NSPLIT mirrored splits per side cut in,
    # lobe tips rounded. Holes are then planned from these splits.
    _fl = {0: [], 1: [0.46], 2: [0.36, 0.6], 3: [0.26, 0.46, 0.66], 4: [0.2, 0.36, 0.52, 0.68]}[NSPLIT]
    env = outline.buffer(0.12 * Wb, join_style='round').buffer(-0.12 * Wb, join_style='round')
    if env.geom_type != 'Polygon': env = max(env.geoms, key=lambda g: g.area)
    env = env.intersection(affinity.scale(env, -1, 1, origin=(mx, 0)))      # mirror-symmetric envelope
    if env.geom_type != 'Polygon': env = max(env.geoms, key=lambda g: g.area)
    env = env.buffer(0.02 * Wb).buffer(-0.02 * Wb)
    if G.get('smooth'):        # clean heart: round off the shoulder bumps left by the closed kit notches
        sm_ = G['smooth'] * Wb
        env = env.buffer(sm_, join_style='round').buffer(-2 * sm_, join_style='round').buffer(sm_, join_style='round')
        if env.geom_type != 'Polygon': env = max(env.geoms, key=lambda g: g.area)
    def _va(f):
        a_ = math.radians(64 - 38 * max(0.0, min(1.0, (f - 0.1) / 0.7)) ** 1.7); return (math.sin(a_), math.cos(a_))
    cuts_, R = [], []
    def _curve(inner_pt, f_, L=0.8, n=40):
        # S-shaped path traced from real leaves: leaves the midrib steeply toward the tip, swings outward through
        # the middle (close to sideways), then turns back up toward the tip near the margin.
        a_s = math.radians(34 + 22 * (1 - f_))          # start, steep (lower splits a little flatter)
        a_p = min(math.radians(92), a_s + math.radians(26))   # middle, swung out a little
        a_e = a_p - math.radians(22)                      # end, turned back up
        def sm(u): u = max(0.0, min(1.0, u)); return u * u * (3 - 2 * u)
        pts, x, y = [inner_pt], inner_pt[0], inner_pt[1]
        for i in range(1, n + 1):
            t = i / n
            a = a_s + (a_p - a_s) * sm(t / 0.3) if t < 0.3 else a_p + (a_e - a_p) * sm((t - 0.3) / 0.45)
            x += math.sin(a) * L * Wb / n; y += math.cos(a) * L * Wb / n; pts.append((x, y))
        return pts
    for f_ in _fl:
        y_ = oy0 + f_ * Lb
        _depth = G.get('depth', {'fen4': 0.165, 'fenfull': 0.145}.get(style, 0.09))          # where the split starts: shallower for fenestrated / heavy
        inner_pt = (mx + (_depth + (0.03 if _depth > 0.1 else 0.06) * f_) * Wb, y_ - 0.04 * Lb)
        cl = _curve(inner_pt, f_)
        # once past the oval body, steer the path toward the leaf edge's own direction (heading to the tip),
        # so the slit slides out along the heart outline instead of cutting straight across it
        _ln = LineString(cl); _ex = _ln.intersection(env.exterior)
        _exs = [_ex] if _ex.geom_type == 'Point' else list(getattr(_ex, 'geoms', []))
        if _exs:
            _xp = min(_exs, key=lambda q: _ln.project(q)); _Lx = _ln.project(_xp)
            _d = env.exterior.project(_xp); _a = env.exterior.interpolate(_d - 0.01 * Wb); _b = env.exterior.interpolate(_d + 0.01 * Wb)
            tg = (_b.x - _a.x, _b.y - _a.y); m_ = math.hypot(*tg) or 1; tg = (tg[0] / m_, tg[1] / m_)
            if tg[1] < 0: tg = (-tg[0], -tg[1])                      # along the edge, toward the tip
            _cum = [0.0]
            for (xa, ya), (xb, yb) in zip(cl, cl[1:]): _cum.append(_cum[-1] + math.hypot(xb - xa, yb - ya))
            k0 = max(1, next((i for i, c_ in enumerate(_cum) if c_ >= 0.62 * _Lx), len(cl) - 1))
            new_cl = cl[:k0 + 1]; x_, y_ = new_cl[-1]
            d0 = (cl[k0][0] - cl[k0 - 1][0], cl[k0][1] - cl[k0 - 1][1]); m0 = math.hypot(*d0) or 1; d0 = (d0[0] / m0, d0[1] / m0)
            step = 0.012 * Wb
            for j in range(1, 40):
                t_ = min(1.0, j / 14)
                dx_, dy_ = d0[0] * (1 - t_) + tg[0] * t_ * 0.75 + d0[0] * 0.25 * t_, d0[1] * (1 - t_) + tg[1] * t_ * 0.75 + d0[1] * 0.25 * t_
                mm = math.hypot(dx_, dy_) or 1; x_ += dx_ / mm * step; y_ += dy_ / mm * step; new_cl.append((x_, y_))
                if not env.buffer(0.03 * Wb).contains(Point(x_, y_)): break
            cl = new_cl
        # width profile: a split is a long oval fenestration that burst through the margin ->
        # rounded inner end, swelling to an oval, pinching to a thin slit where it meets the edge
        cum = [0.0]
        for (x0_, y0_), (x1_, y1_) in zip(cl, cl[1:]): cum.append(cum[-1] + math.hypot(x1_ - x0_, y1_ - y0_))
        exit_ = LineString(cl).intersection(env.exterior)
        ex_pts = [exit_] if exit_.geom_type == 'Point' else list(getattr(exit_, 'geoms', []))
        L_in = min((LineString(cl).project(q) for q in ex_pts), default=cum[-1] * 0.7)
        w_max, w_slit = 0.036 * Wb * G.get('split_w', 1.0), 0.013 * Wb * min(1.0, 0.5 + G.get('split_w', 1.0) * 0.5)
        w_in = w_slit
        left, right = [], []
        for i, (px, py) in enumerate(cl):
            u = cum[i] / max(L_in, 1e-6)
            # ellipse over the inner part (rounded inner end), then a thin slit out to the margin
            e = 1 - ((u - 0.36) / 0.36) ** 2
            w = max(w_slit, w_max * math.sqrt(e)) if e > 0 else w_slit
            q0 = cl[max(0, i - 1)]; q1 = cl[min(len(cl) - 1, i + 1)]
            tx, ty = q1[0] - q0[0], q1[1] - q0[1]; m = math.hypot(tx, ty) or 1; nx_, ny_ = -ty / m, tx / m
            left.append((px + nx_ * w, py + ny_ * w)); right.append((px - nx_ * w, py - ny_ * w))
        cuts_.append(unary_union([Polygon(left + right[::-1]).buffer(0), Point(*inner_pt).buffer(w_slit * 0.5, 6)]).buffer(0.004 * Wb).buffer(-0.002 * Wb))
        line_ = LineString(cl); inside_ = line_.intersection(env)
        Lin = inside_.length if not inside_.is_empty else 0.3 * Wb
        d0 = (cl[1][0] - cl[0][0], cl[1][1] - cl[0][1]); m0 = math.hypot(*d0)
        R.append({'deep': inner_pt, 'dir': (d0[0] / m0, d0[1] / m0), 'len': Lin, 'side': 1, 'curve': line_})
    cuts_ = cuts_ + [affinity.scale(g, -1, 1, origin=(mx, 0)) for g in cuts_]
    new_out = env.difference(unary_union(cuts_))
    new_out = new_out.buffer(-0.018 * Wb, join_style='round').buffer(0.018 * Wb, join_style='round')     # softly round the lobe corners
    if new_out.geom_type != 'Polygon': new_out = max(new_out.geoms, key=lambda g: g.area)
    outline = Polygon(new_out.exterior)
    pockets = [g for g in getattr(env.difference(outline), 'geoms', [env.difference(outline)]) if g.area > 0.002 * env.area]
    outline_orig = affinity.rotate(outline, -THETA, origin=ROT0)
plan = []
def add(cx, cy, d, ra, rb): plan.append(oval2(cx, cy, d, ra, rb, 14))
def vdir(f):
    # angle from the midrib (toward the tip): ~64 deg at the base, closing in faster and faster toward the tip
    a_ = math.radians(64 - 38 * max(0.0, min(1.0, (f - 0.1) / 0.7)) ** 1.7)
    if NSPLIT or CUSTOM: a_ = math.radians(26 + 24 * (1 - f) + 12)      # match the steep start of the curved veins
    return (math.sin(a_), math.cos(a_))
def size_f(f):
    # natural size variation: largest through the middle of the blade, smaller toward the tip and the base
    return max(0.5, min(1.25, 1.25 - 1.9 * max(0.0, f - 0.38) - 1.0 * max(0.0, 0.28 - f)))
SLITS = []
def slit_poly(inner, outer, w_in, w_out):
    dx, dy = outer[0] - inner[0], outer[1] - inner[1]; m = math.hypot(dx, dy) or 1; nx, ny = -dy / m, dx / m
    q = Polygon([(inner[0] + nx * w_in, inner[1] + ny * w_in), (outer[0] + nx * w_out, outer[1] + ny * w_out),
                 (outer[0] - nx * w_out, outer[1] - ny * w_out), (inner[0] - nx * w_in, inner[1] - ny * w_in)])
    return unary_union([q, Point(*inner).buffer(w_in, 8)])
if style == 'skelbig' and not (NSPLIT or CUSTOM):
    lowest = R[0]['deep'][1] if R else oy0 + 0.55 * Lb
    yb = oy0 + 0.13 * Lb; new_n = []
    while yb < lowest - 0.07 * Lb:                # new splits in the lower blade, toward the base
        f_ = (yb - oy0) / Lb; d = vdir(f_)
        inner_pt = (mx + 0.16 * Wb, yb)
        outer_pt = (inner_pt[0] + d[0] * Wb, inner_pt[1] + d[1] * Wb)
        SLITS.append(slit_poly(inner_pt, outer_pt, 0.02 * Wb, 0.055 * Wb))
        seg = LineString([inner_pt, outer_pt]).intersection(outline)
        ln = seg.length if not seg.is_empty else 0.3 * Wb
        new_n.append({'deep': inner_pt, 'dir': d, 'len': ln, 'side': 1})
        yb += 0.16 * Lb
    R = sorted(R + new_n, key=lambda q: q['deep'][1])
    SLITS = SLITS + [affinity.scale(g, -1, 1, origin=(mx, 0)) for g in SLITS]
    pockets = pockets + SLITS
dv = vdir(0.5)
def ypos(f): return oy0 + f * Lb
# midrib row, running up into the tip: measure the free room beside the midrib at each height,
# then size/place each hole to that room (bigger where there is space, never microscopic in the tip)
_g0 = 0.042 * Wb
room_block = unary_union([unary_union(pockets).buffer(_g0), outline.exterior.buffer(_g0)])
def room(y):
    x_start = mx + 0.045 * Wb
    seg = LineString([(x_start, y), (mx + 0.7 * Wb, y)]).difference(room_block)
    parts = [seg] if seg.geom_type == 'LineString' else list(getattr(seg, 'geoms', []))
    parts = [g for g in parts if not g.is_empty and abs(g.coords[0][0] - x_start) < 1e-6]
    return parts[0].length if parts and outline.contains(Point(x_start, y)) else 0.0
cands = []
fy = 0.2
while fy < 0.8:
    y = ypos(fy); r = room(y)
    if r > 0.06 * Wb: cands.append((fy, y, r))
    fy += 0.03
def pick(n, min_gap):
    if n <= 0: return []
    order = sorted(cands, key=lambda c: (abs(c[0] - 0.52) - 0.6 * c[2] / Wb))
    out = []
    for c in order:
        if all(abs(c[0] - o[0]) >= min_gap for o in out): out.append(c)
        if len(out) == n: break
    return sorted(out)
chosen = {'fen2': pick(1, 0.2), 'fen4': pick(2, 0.17), 'fenfull': pick(6, 0.12), 'fenbig': pick(3, 0.18), 'skelbig': pick(4, 0.13)}.get(style, [])
if 'mid' in G: chosen = pick(G['mid'], G.get('midgap', 0.16))
print('cands', [(round(c[0],2), round(c[2]/Wb,3)) for c in cands])
if False:   # (tip pair disabled: real leaves rarely have holes right at the tip)
    tip = [c for c in cands if c[0] > 0.72 and all(abs(c[0] - o[0]) >= 0.1 for o in chosen)]
    if tip: chosen = sorted(chosen + [max(tip, key=lambda c: c[2])])
for fy, y, r in chosen:
    ra = min(0.11 * Wb, max(0.05 * Wb, 0.46 * r * size_f(fy) / 0.95)); rb = ra * 0.5

    cx = mx + 0.045 * Wb + min(r * 0.36, 0.1 * Wb) * (1 - 0.55 * max(0.0, (fy - 0.4) / 0.4))   # hug the midrib, more so toward the tip
    big_ = G.get('big', 1.35 if style == 'fenbig' else 1.0)
    add(cx, y, vdir(fy), ra * size_k * big_, rb * size_k * big_)
if G.get('tip', style == 'fenfull'):              # a small pair up in the tip section, close to the midrib
    ft = 0.77; ra_t = 0.04 * Wb
    add(mx + 0.06 * Wb + vdir(ft)[0] * ra_t * 0.7, ypos(ft), vdir(ft), ra_t * size_k, ra_t * 0.5 * size_k)
if G.get('small', style in ('fen4', 'fenfull')):
    spots = [0.22, 0.68]
    for fs in spots:
        if all(abs(fs - c[0]) > 0.08 for c in chosen):
            ra_s = 0.045 * Wb * (1.0 if fs < 0.5 else 0.85)
            d_ = vdir(fs)
            add(mx + 0.075 * Wb + d_[0] * ra_s * 0.8, ypos(fs) + d_[1] * ra_s * 0.8, d_, ra_s * size_k, ra_s * 0.5 * size_k)
if ('lobe' in G and G['lobe']) or ('lobe' not in G and style in ('fenfull', 'fenbig', 'skelbig')):      # a window in each lobe
    lw = tuple(G['lobe']) if G.get('lobe') else {'fenfull': (0.3, 0.2), 'fenbig': (0.38, 0.26), 'skelbig': (0.42, 0.17)}[style]
    pairs_ = list(zip(R, R[1:]))
    if style == 'fenbig': pairs_ = pairs_[len(pairs_) // 2 - 1: len(pairs_) // 2 + 1] if len(pairs_) > 2 else pairs_
    for q1, q2 in pairs_:
        if not G.get('lobe_top', style == 'skelbig') and (q1['deep'][1] + q2['deep'][1]) / 2 > oy0 + 0.62 * Lb: continue
        p1, p2_ = axis(q1, 0.42), axis(q2, 0.42)
        cx, cy = (p1[0] + p2_[0]) / 2, (p1[1] + p2_[1]) / 2
        sep = math.hypot(p1[0] - p2_[0], p1[1] - p2_[1])
        d_ = vdir((cy - oy0) / Lb)
        if 'curve' in q1 and 'curve' in q2:
            ta, tb = axis(q1, 0.47), axis(q2, 0.47); ua, ub = axis(q1, 0.37), axis(q2, 0.37)
            dx_, dy_ = (ta[0] + tb[0] - ua[0] - ub[0]) / 2, (ta[1] + tb[1] - ua[1] - ub[1]) / 2; m_ = math.hypot(dx_, dy_) or 1
            d_ = (dx_ / m_, dy_ / m_)
        add(cx, cy, d_, (q1['len'] + q2['len']) / 2 * lw[0] * size_k, sep * lw[1] * size_k)
if G.get('lattice', style in ('skel', 'skelbig')):
    # window-leaf lattice: columns of slanted windows from the midrib out toward the edge, rows up into the tip
    if style == 'skel': cols, step, ra, rb = (0.12, 0.27, 0.42), 0.12, 0.085, 0.04
    else:               cols, step, ra, rb = (0.15, 0.33), 0.16, 0.13, 0.062
    f = 0.14
    while f < 0.8:
        for k, off in enumerate(cols):
            add(mx + off * Wb, ypos(f) + off * Wb * vdir(f)[1] / max(vdir(f)[0], 0.3) * 0.35, vdir(f), ra * Wb * size_k * size_f(f), rb * Wb * size_k * size_f(f))
        f += step
holes = plan
# keep every hole inside the blade with a margin, and off the midrib
inner = outline.buffer(-0.05 * Wb)
mid = LineString([(mx, oy0 - 1), (mx, oy1 + 1)]).buffer(0.05 * Wb)
_gap = 0.026 if G.get('lattice', style in ('skel', 'skelbig')) else 0.042
blockers = unary_union([mid, unary_union(pockets).buffer(_gap * Wb), outline.exterior.buffer((_gap - 0.005) * Wb)])
def mirror(g): return affinity.scale(g, -1, 1, origin=(mx, 0))
cut = []; kept = []
blockers_tip = unary_union([mid.buffer(-0.012 * Wb), unary_union(pockets).buffer(0.024 * Wb), outline.exterior.buffer(0.022 * Wb)])
def fits(g):
    bl = blockers_tip if g.centroid.y > oy0 + 0.72 * Lb else blockers
    for x in (g.intersection(bl), mirror(g).intersection(bl)):
        if not x.is_empty and x.area > 0.015 * g.area: return False
    return not any(k.buffer((0.022 if style in ('skel', 'skelbig') else 0.03) * Wb).intersects(g) for k in kept)
for h in holes:
    g = h; ok = None
    # first: slide along the midrib at full size (keeps holes big, e.g. in the narrow tip)
    for k in (0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5):
        t_ = affinity.translate(h, 0, k * 0.02 * Lb)
        if fits(t_): ok = t_; break
    for _ in range(0 if ok is not None else 22):
        hits = [x for x in (g.intersection(blockers), mirror(g).intersection(blockers)) if not x.is_empty and x.area > 0.015 * g.area]
        overlaps = [k for k in kept if k.buffer((0.022 if style in ('skel', 'skelbig') else 0.03) * Wb).intersects(g)]
        if not hits and not overlaps: ok = g; break
        # nudge away from the worst contact (mirrored contacts are mapped back to the right side), shrink a bit
        if hits:
            hc = hits[0].centroid if hits[0] is g.intersection(blockers) or len(hits) == 1 else hits[0].centroid
            hx = hc.x if hc.x > mx else 2 * mx - hc.x
            dx, dy = g.centroid.x - hx, g.centroid.y - hc.y
        else:
            oc = overlaps[0].centroid; dx, dy = g.centroid.x - oc.x, g.centroid.y - oc.y
        m = math.hypot(dx, dy) or 1
        g = affinity.translate(affinity.scale(g, 0.965, 0.965, origin=g.centroid), dx / m * 0.018 * Wb, dy / m * 0.018 * Wb)
    print('  hole y=%.2f planned area %.4f -> %s' % ((h.centroid.y - oy0) / Lb, h.area, 'none' if ok is None else '%.4f' % ok.area))
    if ok is not None and ok.area > 0.0008 * outline.area and ok.within(outline) and mirror(ok).within(outline):
        kept.append(ok); cut += [ok, mirror(ok)]
cut = [max(g.geoms, key=lambda q: q.area) if g.geom_type != 'Polygon' else g for g in cut]
if cut:   # drop specks: anything far smaller than the typical hole (pairs share an area, so symmetry holds)
    _areas = sorted(g.area for g in cut); _med = _areas[len(_areas) // 2]
    cut = [g for g in cut if g.area >= 0.18 * _med and g.area >= 0.0016 * outline.area]
cut = [g.buffer(0.01 * Wb).buffer(-0.01 * Wb).simplify(0.004 * Wb) for g in cut]     # soften corners
cut = [affinity.rotate(g, -THETA, origin=ROT0) for g in cut]
SLITS_back = [affinity.rotate(g, -THETA, origin=ROT0) for g in SLITS]
holes = [affinity.rotate(g, -THETA, origin=ROT0) for g in holes]
outline = outline_orig
ox0, oy0, ox1, oy1 = outline.bounds; Lb = oy1 - oy0; Wb = ox1 - ox0
print('holes', len(cut))
import json as _j
_os = affinity.rotate(outline.difference(unary_union(SLITS_back)) if SLITS_back else outline, THETA, origin=ROT0)
if _os.geom_type != 'Polygon': _os = max(_os.geoms, key=lambda q: q.area)
_cs = [affinity.rotate(g, THETA, origin=ROT0) for g in cut]
_j.dump({'outline_s': list(_os.exterior.coords), 'cut_s': [list(g.exterior.coords) for g in _cs], 'mx': mx,
         'outline': list(outline.exterior.coords), 'pockets': [list(g.exterior.coords) for g in pockets], 'att': att,
         'planned': [list(h.exterior.coords) for h in holes], 'cut': [list(g.exterior.coords) for g in cut]}, open('/tmp/pm-lp3/holes_dbg.json', 'w'))
if PLAN_ONLY: raise SystemExit(0)
bm.free()
# rebuild the blade: kit silhouette minus holes, clean triangles, projected back onto the kit surface,
# then UVs + smooth normals copied from the original kit blade so it shades exactly like the kit.
from mathutils.bvhtree import BVHTree
vC = Vector(c.tolist()); vA = Vector(across.tolist()); vB = Vector(along.tolist()); vN = Vector(nrm.tolist())
shape = outline.simplify(0.011 * Wb)
for g in cut: shape = shape.difference(g.simplify(0.004 * Wb))
for g in SLITS_back: shape = shape.difference(g.simplify(0.004 * Wb))
if shape.geom_type != 'Polygon': shape = max(shape.geoms, key=lambda q: q.area)
if shape.geom_type != 'Polygon': shape = max(shape.geoms, key=lambda q: q.area)
# the kit's own shading normals (per corner), averaged per vertex over the front sheet
cnorm = [Vector(cn.vector) for cn in ob.data.corner_normals]
vsum = {}
for poly in ob.data.polygons:
    if poly.index not in front_idx: continue
    for li in poly.loop_indices:
        vi = ob.data.loops[li].vertex_index; vsum[vi] = vsum.get(vi, Vector((0, 0, 0))) + cnorm[li]
kb = bmesh.new(); kb.from_mesh(ob.data)
kb.verts.ensure_lookup_table()
kitn = {kb.verts[i]: v.normalized() for i, v in vsum.items()}
kb_faces = [f for f in kb.faces if f.index in front_idx]
bmesh.ops.delete(kb, geom=[f for f in kb.faces if f not in set(kb_faces)], context='FACES')
tree = BVHTree.FromBMesh(kb)
kme = bpy.data.meshes.new('kitblade'); kb.to_mesh(kme); kitblade = bpy.data.objects.new('kitblade', kme); bpy.context.collection.objects.link(kitblade)
for p in kme.polygons: p.use_smooth = True
# even triangles: boundary points every ~h/1.4, interior hex grid with spacing h, Delaunay, keep inside
from shapely.ops import triangulate
from shapely.geometry import MultiPoint
h = 0.105 * max(Lb, Wb)
pts = []
for ring in [shape.exterior] + list(shape.interiors):
    seg = LineString(ring.coords).segmentize(h / 1.15 if ring is shape.exterior else h / 2.1)   # holes keep their teardrop shape
    pts += list(seg.coords)[:-1]
core = shape.buffer(-0.45 * h)
x0_, y0_, x1_, y1_ = shape.bounds; row = 0; yy = y0_
while yy <= y1_:
    xx = x0_ + (h / 2 if row % 2 else 0)
    while xx <= x1_:
        if core.contains(Point(xx, yy)): pts.append((xx, yy))
        xx += h
    yy += h * 0.866; row += 1
tris = [t for t in triangulate(MultiPoint(pts)) if shape.buffer(1e-6).contains(t.centroid) and t.area > 1e-9]
nb = bmesh.new(); vmap = {}
def V_(q):
    k = (round(q[0], 6), round(q[1], 6))
    if k not in vmap: vmap[k] = nb.verts.new((q[0], q[1], 0))
    return vmap[k]
for t in tris:
    cs = list(t.exterior.coords)[:3]
    try: nb.faces.new([V_(q) for q in cs])
    except ValueError: pass
bmesh.ops.recalc_face_normals(nb, faces=nb.faces[:])
# smooth height field over the blade plane, least-squares fit to the kit front sheet (degree-4 polynomial)
FV = np.array([v.co[:] for v in kb.verts if v.link_faces])
fa = (FV - c) @ across; fb = (FV - c) @ along; fh = (FV - c) @ nrm
sa, sb_ = max(abs(fa).max(), 1e-6), max(abs(fb).max(), 1e-6)
def basis(a_, b_):
    a_, b_ = np.asarray(a_) / sa, np.asarray(b_) / sb_
    return np.stack([a_ ** i * b_ ** j for i in range(5) for j in range(5 - i)], -1)
coef_h, *_ = np.linalg.lstsq(basis(fa, fb), fh, rcond=None)
for v in nb.verts:
    hh = float((basis([v.co.x], [v.co.y]) @ coef_h)[0])
    _t = math.radians(THETA); xr = v.co.x * math.cos(_t) - v.co.y * math.sin(_t)   # x in the straightened frame
    hh += FOLD * 0.06 * Wb * min(1.0, abs(xr - mx) / (0.5 * Wb))
    v.co = vC + vA * v.co.x + vB * v.co.y + vN * hh
uvname = ob.data.uv_layers.active.name
bmesh.ops.triangulate(kb, faces=kb.faces[:]); kb.faces.ensure_lookup_table()
kuv = kb.loops.layers.uv[uvname]
tree = BVHTree.FromBMesh(kb)
def sample(co):
    loc, n, idx, d = tree.find_nearest(co)
    f = kb.faces[idx]; a_, b_, c_ = [l.vert.co for l in f.loops]
    v0, v1, v2 = b_ - a_, c_ - a_, loc - a_
    d00, d01, d11, d20, d21 = v0.dot(v0), v0.dot(v1), v1.dot(v1), v2.dot(v0), v2.dot(v1)
    den = (d00 * d11 - d01 * d01) or 1e-12
    wv = (d11 * d20 - d01 * d21) / den; ww = (d00 * d21 - d01 * d20) / den; wu = 1 - wv - ww
    uvs = [l[kuv].uv for l in f.loops]; nrs = [kitn.get(l.vert, l.vert.normal) for l in f.loops]
    return uvs[0] * wu + uvs[1] * wv + uvs[2] * ww, (nrs[0] * wu + nrs[1] * wv + nrs[2] * ww).normalized()
nuv = nb.loops.layers.uv.new(uvname)
bmesh.ops.recalc_face_normals(nb, faces=nb.faces[:]); nb.normal_update()
nb.verts.index_update(); vnorm = {}
for v in nb.verts:
    uv, nn = sample(v.co)
    if nn.dot(v.normal) < 0: nn = -nn          # kit leaf has back-to-back sheets; keep normals on our side
    vnorm[v.index] = nn
    for l in v.link_loops: l[nuv].uv = uv
T = 0.018 * max(Lb, Wb)                 # cushion thickness, matches the kit (~1.8% of leaf size)
bmesh.ops.recalc_face_normals(nb, faces=nb.faces[:]); nb.normal_update()
front_v = list(nb.verts); fn = {v: v.normal.copy() for v in front_v}     # offset along our own smooth surface
fuv = {v: v.link_loops[0][nuv].uv.copy() for v in front_v if v.link_loops}
back_of = {v: nb.verts.new(v.co - fn[v] * T) for v in front_v}
src_of = {bv: v for v, bv in back_of.items()}
bfaces = []
for f in list(nb.faces):
    bf = nb.faces.new([back_of[v] for v in reversed(f.verts)]); bfaces.append(bf)
bnd = [e for e in nb.edges if e.is_boundary and e.verts[0] in fn and e.verts[1] in fn]
# split boundary into loops; the longest is the leaf outline, the rest are holes (holes get a plain thin edge strip)
_left = set(bnd); _loops = []
while _left:
    e0 = _left.pop(); loop = {e0}; stack = [e0]
    while stack:
        e = stack.pop()
        for v in e.verts:
            for e2 in v.link_edges:
                if e2 in _left: _left.discard(e2); loop.add(e2); stack.append(e2)
    _loops.append(loop)
_outer = max(_loops, key=lambda L: sum(e.calc_length() for e in L)) if _loops else set()
hole_edges = set(e for L in _loops if L is not _outer for e in L)
rimfaces = []
for e in bnd:
    a_, b_ = e.verts
    lf = e.link_faces[0]
    # keep winding consistent with the front face that owns this edge
    loops = [l for l in lf.loops if l.edge == e][0]
    if loops.vert is a_: a_, b_ = b_, a_
    if e in hole_edges: rimfaces.append((a_, b_, None, None)); continue
    mid_a = nb.verts.new(a_.co - fn[a_] * T * 0.5); mid_b = nb.verts.new(b_.co - fn[b_] * T * 0.5)
    src_of[mid_a] = a_; src_of[mid_b] = b_
    rimfaces.append((a_, b_, mid_b, mid_a))
rim_bm = []
for (a_, b_, mb, ma), e_ in zip(rimfaces, bnd):
    if e_ in hole_edges:
        rim_bm.append(nb.faces.new((a_, b_, back_of[b_], back_of[a_]))); continue
    # push the rim midline outward a little so the edge reads rounded/padded
    out = (b_.co - a_.co).cross(fn[a_]).normalized() * (T * 0.5)
    ma.co += out; mb.co += out
    rim_bm.append(nb.faces.new((a_, b_, mb, ma)))
    rim_bm.append(nb.faces.new((ma, mb, back_of[b_], back_of[a_])))
# crisp edge: the fold between the face sheets and the rim is a hard edge, like the kit's outline
rim_set = set(rim_bm)
for e in nb.edges:
    lf = e.link_faces
    if len(lf) == 2 and ((lf[0] in rim_set) != (lf[1] in rim_set)): e.smooth = False
nb.verts.index_update(); nb.faces.index_update()
for f in bfaces + rim_bm:
    for l in f.loops:
        sv = l.vert if l.vert in fuv else src_of.get(l.vert)
        if sv is not None and sv in fuv: l[nuv].uv = fuv[sv]
loop_normals = []
nme = bpy.data.meshes.new('newblade'); nb.to_mesh(nme); newblade = bpy.data.objects.new('newblade', nme); bpy.context.collection.objects.link(newblade)
back_set = set(back_of[v].index for v in front_v)
front_n = {v.index: fn[v] for v in front_v}
back_n = {back_of[v].index: -fn[v] for v in front_v}
for p in nme.polygons: p.use_smooth = True
nme.materials.append(ob.data.materials[0])
cn = []
for poly in nme.polygons:
    for li in poly.loop_indices:
        vi = nme.loops[li].vertex_index
        if vi in front_n and poly.normal.dot(front_n[vi]) > 0: cn.append(front_n[vi])
        elif vi in back_n and poly.normal.dot(back_n[vi]) > 0: cn.append(back_n[vi])
        else: cn.append(poly.normal.copy())
pass  # plain smooth shading from our own surface (copied kit normals tilt near its rolled rim)
# stem: everything in the kit mesh that is not the blade island
sb = bmesh.new(); sb.from_mesh(ob.data)
bidx = blade_idx
bmesh.ops.delete(sb, geom=[f for f in sb.faces if f.index in bidx], context='FACES')
sb.to_mesh(ob.data); sb.free()
bpy.data.objects.remove(kitblade)
bpy.ops.object.select_all(action='DESELECT'); newblade.select_set(True); ob.select_set(True); bpy.context.view_layer.objects.active = ob
bpy.ops.object.join()
for p in ob.data.polygons: p.use_smooth = True
ob.name = name
bm2 = bmesh.new(); bm2.from_mesh(ob.data); bmesh.ops.triangulate(bm2, faces=bm2.faces[:]); bm2.to_mesh(ob.data); bm2.free()
print('TRIS', name, len(ob.data.polygons))
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=out_f, use_selection=True, export_apply=True)
