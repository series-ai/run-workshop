"""Foot planting, bone directions and body placement for dog poses (run inside Blender).

A pose (see anims.py) can carry these keys on top of its joint angles:

  '_plant': legs whose paw stays where it is when the dog stands, e.g.
            ['front', 'hind.L'] ('front' = both front legs). The upper two bones
            are solved with 2-bone IK and the lower two keep their standing angle,
            so a planted paw never slides.
  '_fold':  {leg: (dx, z)} 2-bone IK putting the hock / wrist dx leg lengths
            ahead of the hip / shoulder and z leg lengths above the floor
            (folded back legs in a sit, whatever the leg length).
  '_dirs':  {bone: (dx, dz)} world direction for a bone in the side plane,
            e.g. {'hock.*': (1, 0)} = hock lying flat on the floor, pointing
            forward. Applied parents-first, after the IK.
  '_body':  place the body: {'params': [...], 'res': [...]}. Params are
            a bone name (its pitch, deg), 'root_up' / 'root_fwd' (in front
            leg lengths), 'hind_fwd' (back toes of 'flat' feet tuck forward). Residuals: ('shoulder_z', f) shoulder height = f front
            leg lengths, ('seat', 0) lowest point of the rump on the floor,
            ('chest_z', f) belly under the chest f leg lengths up,
            ('feet', 0) every foot target reached, ('knee_max', f) back knees
            at most f leg lengths up,
            ('mouth_z', f) muzzle tip f leg lengths above the floor,
            ('shoulder_x', f) shoulder f leg lengths ahead of where it stands,
            ('back', lo, hi) the rump -> shoulder line rises lo..hi degrees.
            Solved by Gauss-Newton, re-running the IK at every step.
  '_level': [bones] these bones keep their standing world angle, with their
            pitch in the pose read as an offset from it (e.g. the head stays
            level while the body tilts up to sit; 'head': (12, 0, 0) still
            lifts the nose 12 degrees).
  '_upright': [bones] twisted about their length so their top faces up
            (a head resting on the floor lies chin-down, not on its cheek).
  '_root':  (fwd, up) fixed root offset, in front leg lengths.
  '_post':  {bone: (pitch, side, twist)} added on top after everything else
            (e.g. toe stretchies on a planted paw).

Everything is measured in leg lengths, so one pose fits a corgi and a Great Dane.
"""
import math

import bpy
import numpy as np
from mathutils import Vector

LEGS = {
    'front': ('upperarm', 'forearm', ('wrist', 'paw')),
    'hind': ('thigh', 'shin', ('hock', 'hind_paw')),
}
SEAT = ['pelvis']

REST = {}       # bone -> (head, tail) at rest, world space, root at origin
INFO = {}       # front_len, root basis


def legs_of(spec):
    out = []
    for item in spec or []:
        if item == 'all':
            out += ['front.L', 'front.R', 'hind.L', 'hind.R']
        elif '.' in item:
            out.append(item)
        else:
            out += [f'{item}.L', f'{item}.R']
    return out


def expand_dirs(d):
    out = {}
    for bone, v in (d or {}).items():
        if bone.endswith('.*'):
            out[bone[:-2] + '.L'] = v
            out[bone[:-2] + '.R'] = v
        else:
            out[bone] = v
    return out


def _upd():
    bpy.context.view_layer.update()


def wpt(arm, bone, end='head'):
    pb = arm.pose.bones[bone]
    return arm.matrix_world @ (pb.head if end == 'head' else pb.tail)


def angle(arm, bone):
    h, t = wpt(arm, bone, 'head'), wpt(arm, bone, 'tail')
    return math.atan2(t.z - h.z, t.x - h.x)


def init(arm, apply_pose):
    """Record the standing (rest) layout and how root location maps to the world."""
    apply_pose(arm, {})
    _upd()
    REST.clear()
    BODY_CACHE.clear()
    for pb in arm.pose.bones:
        REST[pb.name] = (wpt(arm, pb.name, 'head').copy(), wpt(arm, pb.name, 'tail').copy())
    INFO['front_len'] = (REST['upperarm.L'][0] - REST['wrist.L'][0]).length
    root = arm.pose.bones['root']
    probe = REST['spine'][0]
    basis = []
    for axis in range(3):
        loc = Vector((0, 0, 0))
        loc[axis] = 1.0
        root.location = loc
        _upd()
        basis.append(wpt(arm, 'spine') - probe)
        root.location = Vector((0, 0, 0))
    _upd()
    INFO['basis'] = basis   # world displacement per unit of root.location[x/y/z]


def set_root(arm, fwd, up):
    """Root offset in world terms (dog-space units): forward (+X) and up (+Z)."""
    b = INFO['basis']
    m = np.array([[b[i].x, b[i].z] for i in range(3)])   # 3 local axes -> (x, z)
    loc, *_ = np.linalg.lstsq(m.T, np.array([fwd, up]), rcond=None)
    arm.pose.bones['root'].location = Vector(loc.tolist())


def get_root(arm):
    loc = arm.pose.bones['root'].location
    b = INFO['basis']
    d = sum((b[i] * loc[i] for i in range(3)), Vector((0, 0, 0)))
    return d.x, d.z


# ---- bone tools ---------------------------------------------------------------
def align(arm, bone, target_angle, iters=4):
    """Turn a bone so its side-view angle is target_angle, keeping how much it
    leans sideways. Exact (one rotation), so it can't jitter frame to frame."""
    h, t = wpt(arm, bone, 'head'), wpt(arm, bone, 'tail')
    cur = (t - h).normalized()
    r = math.sqrt(max(0.0, 1 - cur.y * cur.y))
    point_bone(arm, bone, Vector((math.cos(target_angle) * r, cur.y, math.sin(target_angle) * r)))


def ik2(arm, upper, lower, target, iters=12):   # (2D; kept for reference, ik3 is used)
    """Pitch `upper` and `lower` so the tail of `lower` reaches target (x, z)."""
    a, b = arm.pose.bones[upper], arm.pose.bones[lower]

    def end():
        p = wpt(arm, lower, 'tail')
        return np.array([p.x - target[0], p.z - target[1]])

    for _ in range(iters):
        f = end()
        if np.linalg.norm(f) < 1e-4:
            return
        J = np.zeros((2, 2))
        for j, pb in enumerate((a, b)):
            pb.rotation_euler.x += 0.01
            _upd()
            J[:, j] = (end() - f) / 0.01
            pb.rotation_euler.x -= 0.01
        _upd()
        dx = -np.linalg.lstsq(J.T @ J + 1e-4 * np.eye(2), J.T @ f, rcond=None)[0]
        dx = np.clip(dx, -0.4, 0.4)
        a.rotation_euler.x += dx[0]
        b.rotation_euler.x += dx[1]
        _upd()


def ik3(arm, upper, lower, target, iters=30):
    """Pitch `upper` and `lower` and swing `upper` sideways so the tail of
    `lower` reaches a 3D target (planted paws stay put under wiggles and rolls).
    Levenberg-Marquardt: a step is only kept if it gets closer."""
    a, b = arm.pose.bones[upper], arm.pose.bones[lower]
    tgt = Vector(target)
    params = ((a, 0), (a, 2), (b, 0))
    side_cost = np.array([1.0, 6.0, 1.0])     # swinging sideways costs more than bending

    def end():
        return np.array(wpt(arm, lower, 'tail') - tgt)

    f = end()
    lam = 1e-3
    for _ in range(iters):
        err = np.linalg.norm(f)
        if err < 1e-4:
            return
        J = np.zeros((3, 3))
        for j, (pb, ax) in enumerate(params):
            pb.rotation_euler[ax] += 0.01
            _upd()
            J[:, j] = (end() - f) / 0.01
            pb.rotation_euler[ax] -= 0.01
        A = J.T @ J
        dx = -np.linalg.solve(A + lam * np.diag(np.diag(A) * side_cost + 1e-6), J.T @ f)
        dx = np.clip(dx, -0.5, 0.5)
        for (pb, ax), d in zip(params, dx):
            pb.rotation_euler[ax] += d
        _upd()
        f2 = end()
        if np.linalg.norm(f2) < err:
            f, lam = f2, max(lam / 3, 1e-6)
        else:
            for (pb, ax), d in zip(params, dx):
                pb.rotation_euler[ax] -= d
            _upd()
            lam *= 5
            if lam > 1e4:
                return


def bone_len(b):
    h, t = REST[b]
    return (t - h).length


def foot_specs(pose):
    """'_plant' (rest), '_fold' (hip-relative) and '_feet' merged into {leg: spec}."""
    out = {leg: 'rest' for leg in legs_of(pose.get('_plant'))}
    for leg, (dx, z) in pose.get('_fold', {}).items():
        for lg in legs_of([leg]):
            out[lg] = ('hip', dx, z)
    for leg, spec in pose.get('_feet', {}).items():
        for lg in legs_of([leg]):
            out[lg] = spec
    return out


def foot_target(arm, leg, spec):
    """World target for the joint under the upper two bones (hock / wrist), and
    world angles for the two bones below it (None = leave as posed).
      'rest'       planted where the dog stands
      'flat'       toes stay, the lower leg lies flat on the floor pointing forward
      'flat_back'  toes stay, lower leg flat pointing back (tops of the paws down)
      ('hip', dx, z)  dx leg lengths ahead of the hip / shoulder, z above the floor
      ('under', dx)   standing paw stepped to dx ahead of the shoulder / hip
      ('straight', k) standing paw where the leg reaches it at k of its length
      ('tuck', dx, z) lying: folded under (like 'hip') if it fits, else forward flat
      ('by_head', dx, dy) lying: paw flat beside the head (paws either side of it)
      ('at', dx, dz)  offset (leg lengths) from where it stands"""
    kind, side = leg.split('.')
    up, lo, lows = LEGS[kind]
    lows = [f'{b}.{side}' for b in lows]
    joint = REST[f'{lo}.{side}'][1]
    toe = REST[lows[-1]][1]
    L = INFO['front_len']
    low_len = sum(bone_len(b) for b in lows)
    rest_angles = [math.atan2(REST[b][1].z - REST[b][0].z, REST[b][1].x - REST[b][0].x) for b in lows]
    if spec == 'rest':
        return joint.copy(), rest_angles
    if spec == 'flat':
        x = toe.x + (INFO.get('hind_fwd', 0.0) * L if kind == 'hind' else 0.0)
        return Vector((x - low_len, joint.y, toe.z)), [0.0, 0.0]
    if spec == 'flat_back':
        return Vector((toe.x + low_len, joint.y, toe.z)), [math.pi, math.pi]
    if spec[0] == 'hip':
        _, dx, z = spec
        return Vector((wpt(arm, f'{up}.{side}').x + dx * L, joint.y, INFO.get('floor', 0.0) + z * L)), None
    if spec[0] == 'by_head':
        # Lying with the head down: the paw flat on the floor beside the head
        # (dx leg lengths ahead of the head's middle, dy out to its side).
        _, dx, dy = spec
        pb = arm.pose.bones['head']
        mid = arm.matrix_world @ ((pb.head + pb.tail) / 2)
        sgn = 1 if side == 'L' else -1
        tgt = Vector((mid.x + dx * L, mid.y + sgn * dy * L, INFO.get('floor', 0.0) + 0.04 * L))
        return tgt - Vector((low_len, 0, 0)), [0.0, 0.0]
    if spec[0] == 'tuck':
        # Lying: fold the leg under the shoulder / hip if there's room, else
        # (short legs under a deep chest) reach it forward flat, sphinx-style.
        _, dx, z = spec
        sh = wpt(arm, f'{up}.{side}')
        reach = bone_len(f'{up}.{side}') + bone_len(f'{lo}.{side}')
        zf = INFO.get('floor', 0.0) + z * L
        h = sh.z - zf
        if h < 0.7 * reach:
            return Vector((sh.x + dx * L, joint.y, zf)), None
        return Vector((sh.x + math.sqrt(max(0.0, (0.97 * reach) ** 2 - h * h)), joint.y, zf)), [0.0, 0.0]
    if spec[0] == 'straight':
        # Paw placed where the leg reaches it nearly straight from the shoulder:
        # upright under a high shoulder, slanting forward under a low one.
        _, k = spec
        sh = wpt(arm, f'{up}.{side}')
        reach = k * (bone_len(f'{up}.{side}') + bone_len(f'{lo}.{side}'))
        h = sh.z - joint.z
        return Vector((sh.x + math.sqrt(max(0.0, reach * reach - h * h)), joint.y, joint.z)), rest_angles
    if spec[0] == 'under':
        # Paw stepped to dx leg lengths ahead of the shoulder / hip, standing
        # (upright leg out of the chest, whatever the body did).
        _, dx = spec
        return Vector((wpt(arm, f'{up}.{side}').x + dx * L, joint.y, joint.z)), rest_angles
    if spec[0] == 'at':
        _, dx, dz = spec
        return joint + Vector((dx * L, 0, dz * L)), rest_angles
    raise ValueError(spec)


def depth(arm, bone):
    return len(arm.pose.bones[bone].parent_recursive)


def constrain(arm, pose, feet_only=False):
    """Apply feet (IK) and bone directions in parent-first order. Returns the
    legs that have a foot target."""
    ops = []
    for leg, spec in foot_specs(pose).items():
        kind, side = leg.split('.')
        up, lo, _ = LEGS[kind]
        ops.append((depth(arm, f'{up}.{side}'), 'foot', leg, spec))
    if not feet_only:
        for bone, (dx, dz) in expand_dirs(pose.get('_dirs')).items():
            ops.append((depth(arm, bone), 'dir', bone, math.atan2(dz, dx)))
        for bone in pose.get('_level', ()):
            h, t = REST[bone]
            off = pose.get(bone, (0, 0, 0))[0]
            ops.append((depth(arm, bone), 'dir', bone, math.atan2(t.z - h.z, t.x - h.x) + math.radians(off)))
        for bone in pose.get('_upright', ()):
            ops.append((depth(arm, bone) + 0.5, 'upright', bone))
    feet = {}
    for _, op, *args in sorted(ops, key=lambda o: o[0]):
        if op == 'foot':
            leg, spec = args
            target, angles = foot_target(arm, leg, spec)
            place_foot(arm, leg, target, angles)
            feet[leg] = spec
        elif op == 'upright':
            upright(arm, *args)
        else:
            align(arm, *args)
    return feet


def record_feet(arm, legs):
    """{leg: (joint world position, lower bone world angles)} as currently posed."""
    out = {}
    for leg in legs:
        kind, side = leg.split('.')
        up, lo, lows = LEGS[kind]
        out[leg] = (wpt(arm, f'{lo}.{side}', 'tail').copy(), [angle(arm, f'{b}.{side}') for b in lows])
    return out


def upright(arm, name):
    """Twist a bone about its own length so its top faces up (no rolling onto a
    cheek), keeping where it points."""
    pb = arm.pose.bones[name]
    m = pb.matrix.copy()
    inv = arm.matrix_world.inverted().to_3x3()
    y = (m.to_3x3() @ Vector((0, 1, 0))).normalized()
    up = (inv @ Vector((0, 0, 1))).normalized()
    z = up - y * up.dot(y)
    if z.length < 1e-4:
        return
    z.normalize()
    x = y.cross(z).normalized()
    from mathutils import Matrix
    rot = Matrix((x, y, z)).transposed()
    new = rot.to_4x4()
    new.translation = m.translation
    pb.matrix = new
    pb.scale = (1, 1, 1)
    _upd()


def point_bone(arm, name, direction):
    """Turn a pose bone (minimal rotation) so it points along a world direction."""
    pb = arm.pose.bones[name]
    m = pb.matrix.copy()
    cur = (m.to_3x3() @ Vector((0, 1, 0))).normalized()
    d = (arm.matrix_world.inverted().to_3x3() @ direction).normalized()
    rot = cur.rotation_difference(d).to_matrix() @ m.to_3x3().normalized()
    new = rot.normalized().to_4x4()
    new.translation = m.translation
    pb.matrix = new
    pb.scale = (1, 1, 1)          # matrix round trips must never creep scale in
    _upd()


def ik_leg(arm, upper, lower, target, hint):
    """Analytic two-bone IK: the joint between `upper` and `lower` (knee /
    elbow) bends toward `hint` (back knees forward, front elbows back), so a
    leg never folds the wrong way or through the floor."""
    H = wpt(arm, upper)
    a = (REST[lower][0] - REST[upper][0]).length          # hip -> knee
    b = bone_len(lower)                                    # knee -> hock joint
    T = Vector(target)
    # A leg can't fold tighter than |thigh - shin|: slide a too-close target
    # back along the floor until the leg can reach it folded.
    need = 1.15 * abs(a - b)
    if (T - H).length < need:
        dz = H.z - T.z
        dx = math.sqrt(max(0.0, need * need - dz * dz - (T.y - H.y) ** 2))
        T.x = H.x + (dx if T.x > H.x and 'hind' not in lower else -dx)
    dvec = T - H
    d = min(dvec.length, (a + b) * 0.9999)
    d = max(d, abs(a - b) + 1e-6)
    u = dvec.normalized()
    x = (a * a - b * b + d * d) / (2 * d)
    h = math.sqrt(max(0.0, a * a - x * x))
    v = hint - u * hint.dot(u)
    v = v.normalized() if v.length > 1e-6 else Vector((1, 0, 0))
    K = H + u * x + v * h
    point_bone(arm, upper, K - H)
    # The upper bone may not end exactly at the knee; aim the lower from where it starts.
    point_bone(arm, lower, H + u * d - wpt(arm, lower))


KNEES_IN = [False]   # set while solving / baking a pose with '_knees_in'
# Knees bend forward, up and a little out; elbows back.
HINT = {'hind': Vector((1, 0.3, 0.45)), 'front': Vector((-1, 0.1, 0))}


def place_foot(arm, leg, target, angles):
    kind, side = leg.split('.')
    up, lo, lows = LEGS[kind]
    hint = HINT[kind].copy()
    if KNEES_IN[0] and kind == 'hind':
        hint = Vector((1, 0.05, 0.2))       # knees straight forward, not splayed (sitting up)
    if side == 'R':
        hint.y = -hint.y
    ik_leg(arm, f'{up}.{side}', f'{lo}.{side}', target, hint)
    if angles is not None:
        for b, a in zip(lows, angles):
            align(arm, f'{b}.{side}', a)


def seat_low(body):
    names = {body.vertex_groups[n].index for n in SEAT if n in body.vertex_groups}
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    m = ev.to_mesh()
    mw = body.matrix_world
    z = min((mw @ v.co).z for v in m.vertices
            if any(g.group in names and g.weight > 0.5 for g in body.data.vertices[v.index].groups))
    ev.to_mesh_clear()
    return z


def group_low(body, names):
    idx = {body.vertex_groups[n].index for n in names if n in body.vertex_groups}
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    m = ev.to_mesh()
    mw = body.matrix_world
    z = min((mw @ v.co).z for v in m.vertices
            if any(g.group in idx and g.weight > 0.5 for g in body.data.vertices[v.index].groups))
    ev.to_mesh_clear()
    return z


BODY_CACHE = {}
# Bones that never change where the body sits (head, tail...): poses that only
# differ in these reuse the solved body instead of running the solver again.
FREE_BONES = ('neck', 'head', 'jaw', 'tail', 'grip')


def body_key(pose):
    return repr(sorted((k, v) for k, v in pose.items() if k not in FREE_BONES and k != '_grip'))


def place_body(arm, body, pose, apply_pose, base_root):
    spec = pose['_body']
    L = INFO['front_len']
    names = spec['params']
    init_v = spec.get('init', {})
    bounds = spec.get('bounds', {})
    p = np.array([float(init_v.get(n, 0.0)) for n in names])
    base_rot = {n: arm.pose.bones[n].rotation_euler.x for n in names if n not in ('root_up', 'root_fwd', 'hind_fwd')}
    base_couple = {cb: arm.pose.bones[cb].rotation_euler.x for d in spec.get('couple', {}).values() for cb in d}

    def evaluate(v):
        apply_pose(arm, pose)
        fwd, up = base_root
        for n, x in zip(names, v):
            if n == 'hind_fwd':
                # Back toes tuck forward under the body this far (leg lengths).
                INFO['hind_fwd'] = x
            elif n == 'root_fwd':
                fwd += x * L
            elif n == 'root_up':
                up += x * L
            else:
                arm.pose.bones[n].rotation_euler.x = base_rot[n] + math.radians(x)
                # Coupled bones counter-rotate, e.g. pelvis = -spine keeps the hips
                # in place so the chest drops around them (play bow).
                for cb, k in spec.get('couple', {}).get(n, {}).items():
                    arm.pose.bones[cb].rotation_euler.x = base_couple[cb] + k * math.radians(x)
        set_root(arm, fwd, up)
        _upd()
        constrain(arm, pose)
        r = []
        for kind, val, *more in spec['res']:
            if kind == 'shoulder_z':
                r.append((wpt(arm, 'upperarm.L').z - val * L) / L)
            elif kind == 'seat':
                r.append(3 * (seat_low(body) - INFO.get('floor', 0.0) - val * L) / L)    # the rump must reach the floor
            elif kind == 'feet':
                # Every foot target reached (the body has to move so folded
                # legs can get their paws where they belong).
                for leg, fspec in foot_specs(pose).items():
                    kd, sd = leg.split('.')
                    tgt, _ = foot_target(arm, leg, fspec)
                    r.append(2 * (wpt(arm, f'{LEGS[kd][1]}.{sd}', 'tail') - tgt).length / L)
            elif kind == 'chest_z':
                # Lowest point of the chest val leg lengths above the floor.
                r.append((group_low(body, ['chest', 'spine']) - INFO.get('floor', 0.0) - val * L) / L)
            elif kind == 'knee_max':
                # Back knees no higher than val leg lengths (long thighs fold
                # forward along the floor instead of up against the chest).
                for sd in 'LR':
                    r.append(max(0.0, wpt(arm, f'shin.{sd}').z - val * L) / L)
            elif kind == 'mouth_z':
                # Muzzle tip (jaw bone tail) val front-leg lengths above the floor.
                r.append((wpt(arm, 'jaw', 'tail').z - INFO.get('floor', 0.0) - val * L) / L)
            elif kind == 'shoulder_x':
                # Shoulder over its standing spot (+ val leg lengths forward), so a
                # planted front leg stands upright.
                r.append(0.5 * (wpt(arm, 'upperarm.L').x - REST['upperarm.L'][0].x - val * L) / L)
            elif kind == 'back':
                # The rump -> shoulder line rises between val and more[0] degrees
                # (long backs curl the pelvis under to sit up, tall dogs lean).
                a, b = wpt(arm, 'pelvis', 'tail'), wpt(arm, 'upperarm.L')
                ang = math.degrees(math.atan2(b.z - a.z, b.x - a.x))
                r.append((max(0.0, val - ang) + max(0.0, ang - more[0])) / 25)
        return np.array(r)

    key = body_key(pose)
    if key in BODY_CACHE:
        evaluate(BODY_CACHE[key])
        return
    scale = np.array([0.05 if n in ('root_up', 'root_fwd', 'hind_fwd') else 5.0 for n in names])
    for _ in range(14):
        r = evaluate(p)
        if np.linalg.norm(r) < 2e-3:
            break
        J = np.zeros((len(r), len(p)))
        for j in range(len(p)):
            q = p.copy()
            q[j] += scale[j] * 0.2
            J[:, j] = (evaluate(q) - r) / (scale[j] * 0.2)
        # Damped least squares (also handles more params than residuals).
        dp = -np.linalg.solve(J.T @ J + 1e-3 * np.diag(1 / scale ** 2), J.T @ r)
        p = p + np.clip(dp, -scale * 3, scale * 3)
        for j, n in enumerate(names):
            lo, hi = bounds.get(n, (-1e9, 1e9))
            p[j] = min(hi, max(lo, p[j]))
    BODY_CACHE[key] = p
    evaluate(p)


def resolve(arm, body, pose, apply_pose):
    """Pose -> full rig state. Returns (eulers, root(fwd, up), grip)."""
    KNEES_IN[0] = bool(pose.get('_knees_in'))
    apply_pose(arm, pose)
    L = INFO['front_len']
    fwd, up = (x * L for x in pose.get('_root', (0, 0)))
    set_root(arm, fwd, up)
    _upd()
    if '_body' in pose:
        place_body(arm, body, pose, apply_pose, (fwd, up))
    legs = constrain(arm, pose)
    for bone, (p, s, t) in expand_dirs(pose.get('_post')).items():
        e = arm.pose.bones[bone].rotation_euler
        e.x += math.radians(p)
        e.z += math.radians(s)
        e.y += math.radians(t)
    _upd()
    eul = {pb.name: tuple(pb.rotation_euler) for pb in arm.pose.bones}
    INFO['hind_fwd'] = 0.0
    return eul, get_root(arm), pose.get('_grip', 1.0), record_feet(arm, legs)


def probe(arm, body, label):
    """Debug print of a solved pose, in leg lengths / degrees."""
    L = INFO['front_len']
    a, b = wpt(arm, 'pelvis', 'tail'), wpt(arm, 'upperarm.L')
    floor = min(seat_low(body), *(wpt(arm, f'{p}.L', 'tail').z for p in ('paw', 'hind_paw')))
    back = math.degrees(math.atan2(b.z - a.z, b.x - a.x))
    rot = {n: round(math.degrees(arm.pose.bones[n].rotation_euler.x)) for n in ('spine', 'pelvis', 'chest', 'neck')}
    rot['mouth_z'] = round((wpt(arm, 'jaw', 'tail').z - floor) / L, 2)
    print(f'PROBE {label}: shoulder_z {(b.z - floor) / L:.2f} shoulder_dx {(b.x - REST["upperarm.L"][0].x) / L:+.2f} '
          f'seat {(seat_low(body) - floor) / L:.2f} knee {(wpt(arm, "shin.L").z - floor) / L:.2f} '
          f'hind_toe_dx {(wpt(arm, "hind_paw.L", "tail").x - REST["hind_paw.L"][1].x) / L:+.2f} back {back:.0f} root {tuple(round(x / L, 2) for x in get_root(arm))} {rot}')
