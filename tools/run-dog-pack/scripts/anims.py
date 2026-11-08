"""Dog animation clips, authored once and baked onto every build (run inside Blender).

A pose is {bone: (pitch, side, twist)} in degrees, applied in each bone's local
space (see rig.py: local X = dog's right, so pitch is the same motion on every
bone). Positive pitch raises a bone's tip toward +Z/forward for a bone pointing
forward (neck, head) — see SIGNS below for legs. ".L/.R" can be written as ".*"
to apply to both sides; side and twist flip sign on the right side.

A clip is a list of (time_seconds, pose) keys. Clips marked ground=True get the
root lowered/raised at every key so the lowest point of the body touches the
floor; that is what lets one "sit" work on a corgi and a Great Dane.
"""
import math

import bpy
from mathutils import Euler, Vector

FPS = 30


def expand(pose):
    out = {}
    for bone, rot in pose.items():
        if bone.startswith('_'):
            continue
        if bone.endswith('.*'):
            base = bone[:-2]
            p, s, t = rot
            out[f'{base}.L'] = (p, s, t)
            out[f'{base}.R'] = (p, -s, -t)
        else:
            out[bone] = rot
    return out


def apply_pose(arm, pose, root_offset=(0, 0, 0)):
    raw = pose
    pose = expand(pose)
    pose['_grip'] = raw.get('_grip', 1.0)
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
        p, s, t = pose.get(pb.name, (0, 0, 0))
        pb.rotation_euler = Euler((math.radians(p), math.radians(t), math.radians(s)), 'XYZ')
        if pb.name != 'grip':
            pb.scale = (1, 1, 1)
    arm.pose.bones['root'].location = Vector(root_offset)
    if 'grip' in arm.pose.bones:
        g = pose.get('_grip', 1.0) if isinstance(pose, dict) else 1.0
        arm.pose.bones['grip'].scale = Vector((g, g, g))


def lowest_point(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    lo = 1e9
    for o in objs:
        ev = o.evaluated_get(dg)
        m = ev.to_mesh()
        mw = o.matrix_world
        lo = min(lo, min((mw @ v.co).z for v in m.vertices))
        ev.to_mesh_clear()
    return lo


# --------------------------------------------------------------------------
# Contact solving. A pose may carry '_solve': it names a driver bone, a range
# for its pitch, coupled bones (pitch += k * driver change) and two contact
# groups that must end at the same height. Bisection on the driver pitch makes
# e.g. a sit put both the front paws and the seat on the floor on every build.
CONTACTS = {
    'front_paws': ['paw.L', 'paw.R'],
    'hind_paws': ['hind_paw.L', 'hind_paw.R'],
    'seat': ['pelvis', 'thigh.L', 'thigh.R'],
    'elbows': ['forearm.L', 'forearm.R'],
}


def _group_verts(body, names):
    idx = {body.vertex_groups[n].index for n in names if n in body.vertex_groups}
    return [v.index for v in body.data.vertices if any(g.group in idx and g.weight > 0.5 for g in v.groups)]


def _lowest(body, verts):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    m = ev.to_mesh()
    mw = body.matrix_world
    z = min((mw @ m.vertices[i].co).z for i in verts)
    ev.to_mesh_clear()
    return z


def solve_pose(arm, body, pose):
    spec = pose.get('_solve')
    if not spec:
        return pose
    driver, lo, hi = spec['bone'], *spec['range']
    a_verts = _group_verts(body, CONTACTS[spec['contacts'][0]])
    b_verts = _group_verts(body, CONTACTS[spec['contacts'][1]])
    base = expand(pose)
    p0 = base.get(driver, (0, 0, 0))[0]

    def posed(p):
        out = dict(base)
        out[driver] = (p,) + tuple(base.get(driver, (0, 0, 0))[1:])
        for bone, k in spec.get('couple', {}).items():
            for b in expand({bone: (0, 0, 0)}):
                r = base.get(b, (0, 0, 0))
                out[b] = (r[0] + k * (p - p0),) + tuple(r[1:])
        return out

    def gap(p):   # > 0 while contact A sits lower than contact B
        apply_pose(arm, posed(p))
        bpy.context.view_layer.update()
        return _lowest(body, b_verts) - _lowest(body, a_verts)

    g_lo, g_hi = gap(lo), gap(hi)
    if (g_lo > 0) == (g_hi > 0):        # can't meet exactly: take the closer end
        return posed(lo if abs(g_lo) < abs(g_hi) else hi)
    for _ in range(18):
        mid = (lo + hi) / 2
        g = gap(mid)
        if (g > 0) == (g_lo > 0):
            lo, g_lo = mid, g
        else:
            hi = mid
    return posed((lo + hi) / 2)


HEAD_H = 0.1   # build's head height in dog space; set by build_dog.py before baking


def solve_reach(arm, pose):
    """'_reach': bend `bone` (pitch) until the top of the neck sits `height`
    head-heights above the floor, i.e. the mouth reaches down to the ground."""
    spec = pose['_reach']
    base = expand(pose)
    lo, hi = spec['range']
    p0 = base.get(spec['bone'], (0, 0, 0))[0]

    drivers = list(expand({spec['bone']: (0, 0, 0)}))   # a '.*' driver moves both sides
    p0 = base.get(drivers[0], (0, 0, 0))[0]

    def posed(p):
        out = dict(base)
        for d in drivers:
            out[d] = (p,) + tuple(base.get(d, (0, 0, 0))[1:])
        for bone, k in spec.get('couple', {}).items():
            for b in expand({bone: (0, 0, 0)}):
                r = base.get(b, (0, 0, 0))
                out[b] = (r[0] + k * (p - p0),) + tuple(r[1:])
        out['_grip'] = pose.get('_grip', 1.0)
        return out

    def err(p):   # muzzle tip (jaw bone tail) height above the floor minus the target
        apply_pose(arm, posed(p))
        bpy.context.view_layer.update()
        floor = lowest_point([o for o in arm.children if o.name == 'dog'])
        tip = (arm.matrix_world @ arm.pose.bones['jaw'].tail).z - floor
        return tip - spec['height'] * HEAD_H

    e_lo, e_hi = err(lo), err(hi)
    if (e_lo > 0) == (e_hi > 0):        # can't reach exactly with the driver
        if 'neck_range' in spec and min(e_lo, e_hi) < 0 and max(e_lo, e_hi) < 0:
            # Short legs: the mouth is too low even without bending, so raise
            # the neck instead (driver at its rest end).
            rest = lo if abs(lo) < abs(hi) else hi
            sub = {**pose, spec['bone']: posed(rest)[drivers[0]],
                   '_reach': {'bone': 'neck', 'range': spec['neck_range'], 'height': spec['height']}}
            return solve_reach(arm, sub)
        if 'neck_range' in spec and min(e_lo, e_hi) > 0:
            # Long legs: even fully bent the mouth is too high, so the neck
            # reaches further down with the legs at full bend.
            full = lo if abs(lo) > abs(hi) else hi
            base_neck = base.get('neck', (0, 0, 0))[0]
            sub = {**posed(full), '_grip': pose.get('_grip', 1.0),
                   '_reach': {'bone': 'neck', 'range': (base_neck - 50, base_neck), 'height': spec['height']}}
            return solve_reach(arm, sub)
        return posed(lo if abs(e_lo) < abs(e_hi) else hi)
    for _ in range(18):
        mid = (lo + hi) / 2
        e = err(mid)
        if (e > 0) == (e_lo > 0):
            lo, e_lo = mid, e
        else:
            hi = mid
    return posed((lo + hi) / 2)


def resolve(arm, body, pose):
    if '_solve' in pose:
        pose = {**solve_pose(arm, body, pose), '_grip': pose.get('_grip', 1.0)}
    if '_reach' in pose:
        pose = solve_reach(arm, pose)
    return pose


def all_fcurves(action):
    if hasattr(action, 'fcurves') and len(action.fcurves):
        return list(action.fcurves)
    out = []
    for layer in getattr(action, 'layers', []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                out += list(bag.fcurves)
    return out


NEW_KEYS = ('_plant', '_dirs', '_body', '_root', '_post', '_level', '_fold', '_feet', '_upright')


def resolve_state(arm, body, pose):
    """Any pose -> (eulers, root (fwd, up), grip)."""
    import solver
    if any(k in pose for k in NEW_KEYS):
        return solver.resolve(arm, body, pose, apply_pose)
    apply_pose(arm, resolve(arm, body, pose))
    bpy.context.view_layer.update()
    eul = {pb.name: tuple(pb.rotation_euler) for pb in arm.pose.bones}
    return eul, (0.0, 0.0), pose.get('_grip', 1.0), {}


REST_LOW = [0.0]    # lowest point of the standing dog (where its floor is)


def lift_tail(arm):
    """Tail parts droop below their bone; lift the tail until its tip clears
    the floor (z = 0 after grounding)."""
    pb = arm.pose.bones['tail']
    sock = bpy.data.objects.get('socket_tail')
    length = sock.matrix_world.to_scale().x if sock else 0.2   # the tail part's length
    for _ in range(12):
        h, t = arm.matrix_world @ pb.head, arm.matrix_world @ pb.tail
        tip = (h + (t - h).normalized() * length).z - 0.9 * length    # allow for the part's droop
        if tip >= 0.01:
            return
        pb.rotation_euler.x -= 0.12             # -pitch raises the tail
        bpy.context.view_layer.update()


def head_low(arm):
    """Bottom of the head and ear parts (separate meshes, not in the body): a
    ball in the skull plus the ear tips, so rolling or lying dogs don't push
    their head or ears through the floor."""
    pb = arm.pose.bones['head']
    m = arm.matrix_world @ pb.matrix          # bone axes: X = dog's right, Y = forward, Z = up
    hh = HEAD_H / 2
    c = m @ Vector((0, 0.6 * hh, 0))
    # Ear tips (worst case: upright ears, which point down when the dog rolls).
    ears = [m @ Vector((sx * hh, 0.3 * hh, 2.0 * hh)) for sx in (-1, 1)]
    return min(c.z - 0.8 * hh, *(e.z for e in ears))


EASES = {
    'smooth': lambda u: u * u * (3 - 2 * u),
    'linear': lambda u: u,
    'in': lambda u: u * u,                       # accelerate (into an impact)
    'out': lambda u: 1 - (1 - u) ** 2,           # decelerate (out of a push)
    'snap': lambda u: 1 - (1 - u) ** 3,          # fast start, soft landing
}


def ease(u, kind='smooth'):
    return EASES[kind](u)


# Follow-through: these bones trail the body by a few frames (overlapping action).
LAG = {'neck': 0.03, 'head': 0.06, 'tail': 0.1}


def bake_clip(arm, body, name, keys, loop=False, ground=False):
    """Bake a clip frame by frame: key poses are solved once and blended (each
    key can pick its easing with '_ease'); paws with a foot target in both
    neighbouring keys are re-solved every frame with 3D IK (they stay planted,
    or slide along a straight path from one target to the next); neck, head and
    tail trail the body a little; then the dog is set on the floor. Pushed to
    an NLA track so the glTF exporter writes every clip as its own animation."""
    import solver
    action = bpy.data.actions.new(name)
    arm.animation_data_create()
    # Mute the clips already baked: a live NLA re-applies the previous clip's
    # last frame on the next depsgraph update and clobbers the poses solved here.
    arm.animation_data.use_nla = False
    arm.animation_data.action = action
    bpy.context.scene.frame_set(1)
    apply_pose(arm, {})
    bpy.context.view_layer.update()
    root = arm.pose.bones['root']
    states = [resolve_state(arm, body, pose) for _, pose in keys]
    airs = [pose.get('_air', 0.0) for _, pose in keys]
    eases = [pose.get('_ease', 'smooth') for _, pose in keys]
    times = [t for t, _ in keys]
    T = times[-1]

    def seg(t):
        if loop:
            t %= T
        t = min(T, max(0.0, t))
        i = max(0, min(len(times) - 2, next((k for k in range(len(times) - 1) if t <= times[k + 1]), len(times) - 2)))
        u = min(1.0, max(0.0, (t - times[i]) / max(times[i + 1] - times[i], 1e-6)))
        return i, ease(u, eases[i + 1]), t

    last = 1 + round(T * FPS)
    for frame in range(1, last + 1):
        t = (frame - 1) / FPS
        i, u, _ = seg(t)
        e0, r0, g0, f0 = states[i]
        e1, r1, g1, f1 = states[i + 1]
        bpy.context.scene.frame_set(frame)
        for pb in arm.pose.bones:
            if pb.name in LAG and frame > 1:
                j, v, _ = seg(t - LAG[pb.name])
                a, b, w = states[j][0][pb.name], states[j + 1][0][pb.name], v
            else:
                a, b, w = e0[pb.name], e1[pb.name], u
            if pb.name == 'root':
                # Whole-dog turns and rolls can go past 180 degrees: blend the angles.
                pb.rotation_euler = tuple(x + (y - x) * w for x, y in zip(a, b))
            else:
                # Everything else takes the short way round (no limbs flipping
                # through themselves between keys).
                q0, q1 = Euler(a, 'XYZ').to_quaternion(), Euler(b, 'XYZ').to_quaternion()
                if q0.dot(q1) < 0:
                    q1.negate()
                pb.rotation_euler = q0.slerp(q1, w).to_euler('XYZ', pb.rotation_euler)
        g = g1 if t >= times[i + 1] - 1e-6 else g0
        if 'grip' in arm.pose.bones:
            arm.pose.bones['grip'].scale = Vector((g, g, g))
        solver.set_root(arm, r0[0] + (r1[0] - r0[0]) * u, r0[1] + (r1[1] - r0[1]) * u)
        bpy.context.view_layer.update()
        solver.KNEES_IN[0] = bool(keys[i][1].get('_knees_in') and keys[i + 1][1].get('_knees_in'))
        legs = sorted(set(f0) & set(f1), key=lambda leg: leg)
        planted = bool(legs)
        for leg in legs:
            (p0, a0), (p1, a1) = f0[leg], f1[leg]
            angles = [x + math.atan2(math.sin(y - x), math.cos(y - x)) * u for x, y in zip(a0, a1)]
            p = p0.lerp(p1, u)
            step = (p1 - p0).length
            turn = max((abs(math.atan2(math.sin(y - x), math.cos(y - x))) for x, y in zip(a0, a1)), default=0)
            if step > 0.05 * solver.INFO['front_len'] and turn < 0.3:
                # A paw that moves to a new spot steps there (lifts on the way).
                p.z += 4 * u * (1 - u) * min(0.5 * step, 0.25 * solver.INFO['front_len'])
            solver.place_foot(arm, leg, p, angles)
        if ground:
            fwd, up = solver.get_root(arm)
            air = airs[i] + (airs[i + 1] - airs[i]) * u
            if planted:
                # Paws on targets already stand on the floor: don't let a
                # scooping paw or a dipping head shove the whole dog up and
                # down - only push it up if something would go through.
                low = min(lowest_point([body]), head_low(arm), REST_LOW[0])
                solver.set_root(arm, fwd, up - low + air)
            else:
                solver.set_root(arm, fwd, up - min(lowest_point([body]), head_low(arm)) + air)
        if ground and abs(arm.pose.bones['root'].rotation_euler.y) < 0.4:
            lift_tail(arm)        # (not when rolled over: the tail lies along the floor)
        for pb in arm.pose.bones:
            pb.keyframe_insert('rotation_euler', frame=frame)
        root.keyframe_insert('location', frame=frame)
        if 'grip' in arm.pose.bones:
            arm.pose.bones['grip'].keyframe_insert('scale', frame=frame)
    for fc in all_fcurves(action):
        if 'grip' in fc.data_path and 'scale' in fc.data_path:
            for kp in fc.keyframe_points:
                kp.interpolation = 'CONSTANT'
    track = arm.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, action)
    arm.animation_data.action = None
    arm.animation_data.use_nla = True
    apply_pose(arm, {})
    return action


def render_pose(arm, objs, pose, path, ground=True):
    """Debug: pose the rig and render a side view to `path` (only `objs` are visible)."""
    for o in bpy.context.scene.objects:
        if o.type == 'MESH':
            o.hide_render = o not in objs
    apply_pose(arm, pose)
    bpy.context.view_layer.update()
    if ground:
        arm.pose.bones['root'].location = Vector((0, -lowest_point(objs), 0))
        bpy.context.view_layer.update()
    scene = bpy.context.scene
    engines = {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items}
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 640, 480
    scene.render.filepath = path
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.9, 0.9, 0.92, 1)
    scene.world = world
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 1.5
    scene.collection.objects.link(cam)
    cam.location = (0.1, -3, 0.45)
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.camera = cam
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    scene.collection.objects.link(sun)
    floor = bpy.data.objects.new('floor', bpy.data.meshes.new('floor'))
    floor.data.from_pydata([(-2, -1, 0), (2, -1, 0), (2, 1, 0), (-2, 1, 0)], [], [(0, 1, 2, 3)])
    scene.collection.objects.link(floor)
    bpy.ops.render.render(write_still=True)
    for o in (cam, sun, floor):
        bpy.data.objects.remove(o)


# --------------------------------------------------------------------------
# Poses. Sign rule (all bones): +pitch rotates the bone counterclockwise as seen
# from the dog's right side — legs swing forward, a forward bone noses up, the
# neck lifts back, the tail drops. Parents carry children, so leg angles below
# compensate for spine/pelvis rotation.
POSES = {
    'stand': {},
    # Front paws stay planted where the dog stood; the body sinks until the rump
    # is on the floor with the shoulders up; hocks lie flat on the floor and the
    # tail goes out behind so it isn't sat on.
    # Tail swept out to one side so it isn't sat on.
    'sit': {'pelvis': (20, 0, 0), 'neck': (8, 0, 0), 'head': (-4, 0, 0), 'tail': (0, 40, 0),
            '_level': ['neck', 'head'],
            # Back toes stay (tucking forward a little); the hocks fold down flat
            # and the rump sits just behind the heels. Front paws step back under
            # the shoulders so the front legs stand straight out of the chest.
            'thigh.*': (70, 0, 0), 'shin.*': (-130, 0, 0), '_feet': {'hind': 'flat', 'front': ('straight', 0.97)},
            '_dirs': {'tail': (-1, 0.95)},
            # Front legs near straight; long backs (dachshund, corgi) also curl the
            # pelvis under so the chest still comes up.
            '_body': {'params': ['root_up', 'root_fwd', 'spine', 'pelvis', 'hind_fwd'],
                      # Shoulders a little behind the paws so the front legs slant
                      # forward out of the chest.
                      'res': [('shoulder_z', 0.95), ('seat', 0.0), ('back', 32, 60),
                              ('feet', 0), ('knee_max', 0.42)],
                      'init': {'spine': 25, 'root_up': -0.3}, 'bounds': {'spine': (5, 75), 'pelvis': (-30, 50), 'hind_fwd': (0, 0.25)}}},
    # Lying with the front feet tucked back under the chest (toes back, flat),
    # back legs folded beside the body, hocks flat, tail along the floor.
    'lie': {'neck': (-8, 0, 0), 'tail': (0, 40, 0),
            # Front legs tucked: elbows pulled in under the shoulders (so the
            # shoulders ride high), short forearms forward, paws folded under.
            '_dirs': {'wrist.*': (-1, 0.05), 'paw.*': (-1, 0),
                      'thigh.*': (1, -0.3), 'shin.*': (-1, -0.15), 'hock.*': (1, 0), 'hind_paw.*': (1, 0),
                      'tail': (-1, 0.12)},
            # Back legs folded beside the body; the body is lowered until the rump
            # rests on the floor, held up at the front by the tucked elbows.
            '_feet': {'front': ('hip', 0.2, 0.06)},
            '_body': {'params': ['root_up', 'spine'], 'res': [('seat', 0.0), ('feet', 0), ('shoulder_z', 0.5)],
                      'init': {'root_up': -0.6}, 'bounds': {'spine': (-12, 12)}}},
    # All four paws stay planted; the body shifts back and the chest drops
    # between the front legs so the forearms lie on the floor; rump high.
    # Head stays up and looking forward (level), whatever the body does.
    'play_bow': {'neck': (-8, 0, 0), 'head': (2, 0, 0), 'tail': (-50, 0, 0),
                 'upperarm.*': (0, 0, 0), 'forearm.*': (95, 0, 0),
                 '_plant': ['all'], '_root': (-0.55, 0), '_level': ['neck', 'head'],
                 '_body': {'params': ['spine'], 'res': [('shoulder_z', 0.42)], 'couple': {'spine': {'pelvis': -0.85}},
                           'init': {'spine': -20}, 'bounds': {'spine': (-55, 0)}}},
    # Deeper: chest almost on the floor, body further back, head low and long.
    'down_dog': {'neck': (-38, 0, 0), 'head': (-6, 0, 0), 'tail': (-30, 0, 0),
                 'upperarm.*': (0, 0, 0), 'forearm.*': (95, 0, 0),
                 # Front paws walk out well in front and stay there; hips stay
                 # over the back paws so the back legs stand straight.
                 '_feet': {'front': ('at', 0.85, 0), 'hind': 'rest'}, '_root': (0.05, 0), '_level': ['neck', 'head'],
                 '_body': {'params': ['spine'], 'res': [('shoulder_z', 0.26)], 'couple': {'spine': {'pelvis': -0.85}},
                           'init': {'spine': -24}, 'bounds': {'spine': (-60, 0)}}},
}


def with_(pose, **extra):
    """Pose plus overrides, e.g. with_(POSES['sit'], tail=(20, 25, 0))."""
    out = dict(pose)
    out.update({k.replace('__', '.').replace('_STAR', '*'): v for k, v in extra.items()})
    return out


def unsolved(pose):
    """A pose without its contact solve / body placement, for in-between keys."""
    return {k: v for k, v in pose.items() if k not in ('_solve', '_body')}


def free(pose, *legs):
    """Release legs from planting and their direction targets (e.g. a raised paw)."""
    import solver
    out = dict(pose)
    gone = set(solver.legs_of(legs))
    out['_plant'] = [l for l in solver.legs_of(pose.get('_plant')) if l not in gone]
    dirs = solver.expand_dirs(pose.get('_dirs'))
    for leg in gone:
        kind, side = leg.split('.')
        up, lo, lows = solver.LEGS[kind]
        for b in (up, lo, *lows):
            dirs.pop(f'{b}.{side}', None)
    out['_dirs'] = dirs
    out['_fold'] = {lg: v for leg, v in pose.get('_fold', {}).items() for lg in solver.legs_of([leg]) if lg not in gone}
    out['_feet'] = {lg: v for leg, v in pose.get('_feet', {}).items() for lg in solver.legs_of([leg]) if lg not in gone}
    return out


def wag(pose, side_deg):
    p = dict(pose)
    pitch = p.get('tail', (0, 0, 0))[0]
    p['tail'] = (pitch, side_deg, 0)
    return p


POSES['stand'] = {'_plant': ['all']}
S, SI, L, PB, DD = POSES['stand'], POSES['sit'], POSES['lie'], POSES['play_bow'], POSES['down_dog']


def bent(pose, **pitches):
    """Pose with some pitches changed, e.g. bent(SI, neck=14) (a '.' is '__')."""
    out = dict(pose)
    for k, v in pitches.items():
        b = k.replace('__', '.')
        old = pose.get(b, (0, 0, 0))
        out[b] = (v, old[1], old[2])
    return out


def wiggle_keys(base, t0, n=2, dt=0.1, amp=7, tail=30):
    """A happy pre-action wiggle: the rump sways side to side on planted paws
    and the tail swishes the other way."""
    keys = []
    for k in range(n):
        sg = 1 if k % 2 == 0 else -1
        p = base.get('pelvis', (0, 0, 0))
        keys.append((t0 + dt * (k + 1), {**base, 'pelvis': (p[0], sg * amp, 0),
                                         'spine': (base.get('spine', (0, 0, 0))[0], -sg * amp * 0.4, 0),
                                         'tail': (-40, -sg * tail, 0)}))
    return keys


# Transition poses with anticipation.
SIT_LEAN = {**SI, 'neck': (-14, 0, 0), 'head': (-10, 0, 0),
            '_body': {**SI['_body'], 'res': [('shoulder_z', 0.85), ('seat', 0.0), ('back', 28, 48), ('feet', 0), ('knee_max', 0.42)]}}           # gather to rise
GATHER_SIT = {'spine': (3, 0, 0), 'neck': (10, 0, 0), 'head': (4, 0, 0), 'tail': (-15, 0, 0),
              '_plant': ['all'], '_root': (-0.04, 0)}                                    # weight back, head up
PUSH = {'spine': (-7, 0, 0), 'neck': (6, 0, 0), 'tail': (-35, 0, 0), '_plant': ['all'], '_root': (0.06, 0)}
TALL = {'neck': (14, 0, 0), 'head': (6, 0, 0), 'tail': (-50, 18, 0), '_plant': ['all']}          # overshoot
# Back stretch: all four paws stay where they were; the body surges forward over
# the front legs, the hips drop and the back legs stretch out behind with the
# tops of the back paws on the floor.
UP_DOG = {'spine': (6, 0, 0), 'neck': (10, 0, 0), 'head': (8, 0, 0), 'tail': (-15, 0, 0),
          '_feet': {'front': ('at', 0.85, 0), 'hind': 'flat_back'},
          '_body': {'params': ['root_fwd', 'root_up', 'pelvis', 'spine'],
                    'res': [('feet', 0), ('shoulder_z', 0.68), ('shoulder_x', 0.75), ('back', -5, 18)],
                    'init': {'root_fwd': 0.6, 'root_up': -0.2},
                    'bounds': {'root_up': (-0.7, 0.1), 'pelvis': (-40, 30), 'spine': (-10, 25)}}}
LIE_GATHER = {**L, 'neck': (-22, 0, 0), 'head': (-10, 0, 0)}
SIT_TO_LIE = {**unsolved(SI), 'spine': (10, 0, 0), 'neck': (-14, 0, 0), '_plant': [],
              '_feet': {'hind': 'flat'},
              '_dirs': {**SI['_dirs'], 'upperarm.*': (0.55, -1), 'forearm.*': (1, -0.6)}}
PB_UP = {**PB, '_body': {**PB['_body'], 'res': [('shoulder_z', 0.62)]}}          # bounce in the bow
breath_in = {'spine': (1.5, 0, 0), 'neck': (2, 0, 0), 'chest': (1, 0, 0), '_plant': ['all']}
TOES = {'_post': {'paw.*': (14, 0, 0)}}
# (name, loop, keys)
CLIPS = [
    ('idle', True, [(0, wag(S, 12)), (0.5, wag(breath_in, -12)), (1.0, wag(S, 12)), (1.5, wag(breath_in, -12)),
                    (2.0, wag(S, 12))]),
    # Wiggle, weight back and head up, drop into the sit (accelerating), the
    # chest pops up as the rump lands, settle.
    ('sit', False, [(0, S), *wiggle_keys(S, 0), (0.32, GATHER_SIT), (0.6, {**bent(SI, neck=0), '_ease': 'in'}),
                    (0.72, {**bent(SI, neck=16, head=2), '_ease': 'out'}), (0.95, SI)]),
    # Breathing, tail sweeping along the floor around where it lies, a head tilt.
    ('sit_idle', True, [(0, SI), (0.75, wag(bent(SI, neck=4), 22)), (1.5, SI), (1.9, wag({**SI, 'head': (-4, 0, 14)}, 58)),
                        (2.6, wag({**SI, 'head': (-4, 0, 14)}, 25)), (3.0, SI)]),
    # Gather (head dips, weight forward), push up rump-first, overshoot tall,
    # shake the excitement out with a wiggle, settle.
    ('sit_to_stand', False, [(0, SI), (0.16, SIT_LEAN), (0.36, {**PUSH, '_ease': 'out'}), (0.52, TALL),
                             *wiggle_keys(S, 0.52, dt=0.1), (0.86, S)]),
    # Wiggle, sit, then sink straight down into the lie (front paws sliding out),
    # the head dipping a little as it lands.
    ('lie_down', False, [(0, S), *wiggle_keys(S, 0), (0.5, SI),
                         (0.95, {**bent(L, neck=-12), '_ease': 'in'}), (1.25, L)]),
    ('lie_idle', True, [(0, L), (1.0, {**L, 'spine': (1.5, 0, 0)}), (2.0, L)]),
    # Gather, front up into a sit, push up from the back, overshoot, wiggle, settle.
    ('lie_to_stand', False, [(0, L), (0.2, LIE_GATHER), (0.42, SIT_TO_LIE), (0.58, SIT_LEAN),
                             (0.78, {**PUSH, '_ease': 'out'}), (0.94, TALL), *wiggle_keys(S, 0.94, dt=0.1), (1.28, S)]),
    # Crouch, pounce down into the bow, bounce in it with the tail going, pop up.
    ('play_bow', False, [(0, S), (0.14, {**GATHER_SIT, 'neck': (-6, 0, 0)}), (0.3, {**wag(PB, 25), '_ease': 'in'}),
                         (0.42, wag(PB_UP, -25)), (0.54, wag(PB, 25)), (0.66, wag(PB_UP, -25)), (0.78, wag(PB, 25)),
                         (0.92, {**wag(PB_UP, -25), '_ease': 'out'}), (1.1, TALL), (1.3, S)]),
    # Long down-dog with toe stretchies, then forward over the front paws into
    # the back stretch (all four paws stay put), head up, back to standing.
    ('stretch', False, [(0, S), (0.75, {**DD, '_ease': 'out'}), (1.0, {**DD, **TOES}), (1.2, DD),
                        (1.4, {**DD, **TOES}), (1.65, DD), (2.25, UP_DOG), (2.9, {**UP_DOG, 'neck': (18, 0, 0)}),
                        (3.5, TALL), (3.75, S)]),
]
# ---- toys & mouth ----
JAW_OPEN = {'jaw': (-42, 0, 0)}
CROUCH = {'spine': (4, 0, 0), 'neck': (8, 0, 0), 'upperarm.*': (22, 0, 0), 'forearm.*': (-35, 0, 0), 'wrist.*': (15, 0, 0),
          'thigh.*': (38, 0, 0), 'shin.*': (-60, 0, 0), 'hock.*': (26, 0, 0), 'tail': (-10, 0, 0)}
LEAP = {'spine': (12, 0, 0), 'neck': (30, 0, 0), 'head': (18, 0, 0), 'upperarm.*': (45, 0, 0), 'forearm.*': (-25, 0, 0),
        'thigh.*': (-35, 0, 0), 'shin.*': (15, 0, 0), 'hock.*': (10, 0, 0), 'tail': (-35, 0, 0)}
# Head down to the floor: the neck bends (solved per build) until the mouth
# reaches the ground; the spine dips a little and the front legs give.
# Head down to the floor: the neck points down and the front legs bend (elbows
# forward, chest dipping) until the mouth reaches the ground on every build.
REACH = {'spine': (0, 0, 0), 'neck': (-75, 0, 0), 'head': (-20, 0, 0),
         'upperarm.*': (0, 0, 0), 'forearm.*': (0, 0, 0), 'wrist.*': (0, 0, 0),
         # Elbows fold back and up (a dog's elbow points backward), forearms stay upright.
         '_reach': {'bone': 'upperarm.*', 'range': (-95, 0), 'height': 0.12, 'neck_range': (-75, 10),
                    'couple': {'forearm.*': -1.0, 'spine': 0.4, 'thigh.*': -0.4}}}
LEGACY_REACH = REACH


def mouth_to(h, head=-50, **extra):
    """Mouth down to h front-leg lengths above the floor with all paws planted:
    the neck bends first, then the chest dips and the legs give."""
    return {'head': (head, 0, 0), 'tail': (-25, 0, 0), '_plant': ['all'], '_level': ['head'],
            '_body': {'params': ['neck', 'spine', 'root_up'], 'res': [('mouth_z', h)],
                      'couple': {'spine': {'pelvis': -0.85}}, 'init': {'neck': -45},
                      'bounds': {'neck': (-110, 10), 'spine': (-25, 0), 'root_up': (-0.4, 0)}}, **extra}


REACH = mouth_to(0.08, head=-40)
CARRY = {'neck': (8, 0, 0), 'head': (-6, 0, 0)}
SIT_PLAIN = SI

CLIPS += [
    ('speak', False, [(0, SI), (0.15, {**SI, 'neck': (-4, 0, 0), 'head': (12, 0, 0), **JAW_OPEN}), (0.3, SI),
                      (0.45, {**SI, 'neck': (-4, 0, 0), 'head': (12, 0, 0), **JAW_OPEN}), (0.6, SI), (0.9, SI)]),
    ('pick_up', False, [(0, {'_grip': 0}), (0.45, {**REACH, **JAW_OPEN, '_grip': 0}), (0.6, {**REACH, '_grip': 0}),
                        (0.62, {**REACH, '_grip': 1}), (1.1, {**CARRY, '_grip': 1})]),
    ('carry_idle', True, [(0, wag(CARRY, 12)), (0.5, wag({**CARRY, 'spine': (1.5, 0, 0)}, -12)),
                          (1.0, wag(CARRY, 12))]),
    ('put_down', False, [(0, CARRY), (0.45, REACH), (0.55, {**REACH, **JAW_OPEN}),
                         (0.57, {**REACH, **JAW_OPEN, '_grip': 0}), (1.05, {'_grip': 0})]),
    ('drop_it', False, [(0, SI), (0.25, {**SI, **JAW_OPEN, 'head': (-12, 0, 0)}),
                        (0.27, {**SI, **JAW_OPEN, 'head': (-12, 0, 0), '_grip': 0}), (0.6, {**SI, '_grip': 0})]),
    # Crouch, leap with the mouth open, snap it shut on the toy at the top, land.
    ('jump_catch', False, [(0, {'_grip': 0}), (0.25, {**CROUCH, '_grip': 0}),
                           (0.45, {**LEAP, **JAW_OPEN, '_air': 0.35, '_grip': 0}),
                           (0.6, {**LEAP, **JAW_OPEN, '_air': 0.42, '_grip': 0}),
                           (0.62, {**LEAP, '_air': 0.42, '_grip': 1}),
                           (0.85, {**CROUCH, '_air': 0.0, '_grip': 1}), (1.25, {'_grip': 1})]),
]
LOOPING = [n for n, loop, _ in CLIPS if loop]


def bake_all(arm, body, only=None):
    import solver
    solver.init(arm, apply_pose)
    apply_pose(arm, {})
    bpy.context.view_layer.update()
    REST_LOW[0] = lowest_point([body])
    solver.INFO['floor'] = REST_LOW[0]
    import clips_more   # second batch (imports this module, so loaded late)
    bpy.context.scene.render.fps = FPS   # keys are placed at FPS; the exporter reads time from the scene rate
    clips = CLIPS + clips_more.CLIPS
    if only:
        clips = [c for c in clips if c[0] in only]
    LOOPING[:] = [n for n, loop, _ in clips if loop]
    import time
    for name, loop, keys in clips:
        t0 = time.time()
        bake_clip(arm, body, name, keys, loop=loop, ground=True)
        print(f'CLIP {name} {time.time() - t0:.1f}s', flush=True)
