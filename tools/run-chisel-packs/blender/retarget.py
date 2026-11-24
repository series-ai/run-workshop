"""Retarget CC0 animation clips from Quaternius UAL2 and KayKit CombatRanged onto the 53-joint UAL1 skeleton.

All clips emitted use glTF +Y-up coordinates, animate only bone rotations (plus `pelvis` translation),
and compensate for rest-pose orientation and stature differences so limbs, fingers, and grounded feet
match `ual1-base.glb`.
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from mathutils import Euler, Matrix, Quaternion, Vector

import polykit as pk


def gltf_to_q(xyzw) -> Quaternion:
    return Quaternion((float(xyzw[3]), float(xyzw[0]), float(xyzw[1]), float(xyzw[2]))).normalized()


def q_to_gltf(q: Quaternion) -> tuple[float, float, float, float]:
    qn = q.normalized()
    return (float(qn.x), float(qn.y), float(qn.z), float(qn.w))


def _node_local_trs(node: dict) -> tuple[Vector, Quaternion, Vector]:
    if 'matrix' in node:
        m = Matrix([node['matrix'][i::4] for i in range(4)])
        t, r, s = m.decompose()
        return t, r.normalized(), s
    t = Vector(node.get('translation', (0.0, 0.0, 0.0)))
    r = gltf_to_q(node.get('rotation', (0.0, 0.0, 0.0, 1.0)))
    s = Vector(node.get('scale', (1.0, 1.0, 1.0)))
    return t, r, s


def _read_float_accessor(doc: dict, raw_bin: bytes, idx: int) -> np.ndarray:
    item, data = pk.accessor_bytes(doc, raw_bin, idx)
    comp = pk._COMPONENT[item['componentType']]
    cols = pk._TYPE_SIZE[item['type']]
    arr = np.frombuffer(data, dtype=comp).astype(np.float64)
    if cols > 1:
        return arr.reshape(item['count'], cols)
    return arr


def _interp_vec(times: np.ndarray, values: np.ndarray, t: float) -> Vector:
    if len(times) == 1 or t <= times[0]:
        return Vector(values[0].tolist())
    if t >= times[-1]:
        return Vector(values[-1].tolist())
    hi = int(np.searchsorted(times, t, side='right'))
    lo = max(0, hi - 1)
    hi = min(len(times) - 1, hi)
    dt = float(times[hi] - times[lo])
    alpha = 0.0 if dt <= 1e-9 else (t - float(times[lo])) / dt
    v0 = Vector(values[lo].tolist())
    v1 = Vector(values[hi].tolist())
    return v0.lerp(v1, alpha)


def _interp_quat(times: np.ndarray, values: np.ndarray, t: float) -> Quaternion:
    if len(times) == 1 or t <= times[0]:
        return gltf_to_q(values[0])
    if t >= times[-1]:
        return gltf_to_q(values[-1])
    hi = int(np.searchsorted(times, t, side='right'))
    lo = max(0, hi - 1)
    hi = min(len(times) - 1, hi)
    dt = float(times[hi] - times[lo])
    alpha = 0.0 if dt <= 1e-9 else (t - float(times[lo])) / dt
    q0 = gltf_to_q(values[lo])
    q1 = gltf_to_q(values[hi])
    return q0.slerp(q1, alpha).normalized()


class SourceRig:
    """FK evaluator for a source GLB's rest and animated node poses."""

    def __init__(self, path: Path):
        self.path = Path(path)
        self.doc, self.bin = pk.read_glb(path)
        self.nodes = self.doc['nodes']
        self.by_name = {n['name']: i for i, n in enumerate(self.nodes) if 'name' in n}
        self.parent = [None] * len(self.nodes)
        for pi, node in enumerate(self.nodes):
            for ci in node.get('children', ()):
                self.parent[ci] = pi

        # Topological order
        visited = [False] * len(self.nodes)
        self.order: list[int] = []

        def dfs(idx: int) -> None:
            if visited[idx]:
                return
            p = self.parent[idx]
            if p is not None:
                dfs(p)
            visited[idx] = True
            self.order.append(idx)

        for i in range(len(self.nodes)):
            dfs(i)

        self.rest_local = [_node_local_trs(n) for n in self.nodes]
        self.rest_pos, self.rest_q = self._fk_world({})

    def _fk_world(self, overrides: dict[int, tuple[Vector | None, Quaternion | None]]) -> tuple[list[Vector], list[Quaternion]]:
        pos = [Vector((0.0, 0.0, 0.0))] * len(self.nodes)
        rot = [Quaternion((1.0, 0.0, 0.0, 0.0))] * len(self.nodes)
        for i in self.order:
            t_rest, r_rest, _ = self.rest_local[i]
            ov = overrides.get(i)
            t = ov[0] if (ov and ov[0] is not None) else t_rest
            r = ov[1] if (ov and ov[1] is not None) else r_rest
            p = self.parent[i]
            if p is None:
                pos[i] = t.copy()
                rot[i] = r.normalized()
            else:
                pos[i] = pos[p] + (rot[p] @ t)
                rot[i] = (rot[p] @ r).normalized()
        return pos, rot

    def clip_samplers(self, clip_name: str) -> tuple[float, dict[int, dict[str, tuple[np.ndarray, np.ndarray]]]]:
        anim = next((a for a in self.doc.get('animations', ()) if a['name'] == clip_name), None)
        if anim is None:
            raise ValueError(f'{self.path}: missing animation "{clip_name}"')
        by_node: dict[int, dict[str, tuple[np.ndarray, np.ndarray]]] = {}
        duration = 0.0
        for ch in anim['channels']:
            node_idx = ch['target'].get('node')
            path = ch['target'].get('path')
            if node_idx is None or path not in ('translation', 'rotation'):
                continue
            sampler = anim['samplers'][ch['sampler']]
            times = _read_float_accessor(self.doc, self.bin, sampler['input'])
            values = _read_float_accessor(self.doc, self.bin, sampler['output'])
            if len(times) > 0:
                duration = max(duration, float(times[-1]))
            by_node.setdefault(node_idx, {})[path] = (times, values)
        return duration, by_node

    def sample_world_at(
        self,
        by_node: dict[int, dict[str, tuple[np.ndarray, np.ndarray]]],
        t: float,
    ) -> tuple[list[Vector], list[Quaternion]]:
        overrides: dict[int, tuple[Vector | None, Quaternion | None]] = {}
        for node_idx, tracks in by_node.items():
            tv = _interp_vec(*tracks['translation'], t) if 'translation' in tracks else None
            rv = _interp_quat(*tracks['rotation'], t) if 'rotation' in tracks else None
            overrides[node_idx] = (tv, rv)
        return self._fk_world(overrides)


class Ual1SkeletonState:
    """Rest-pose data and FK evaluator for the 53-joint UAL1 skeleton."""

    def __init__(self, rig: pk.Rig):
        self.rig = rig
        self.names = list(rig.names)
        self.index = dict(rig.index)
        self.parent = list(rig.parent)
        self.rest_local: list[tuple[Vector, Quaternion]] = []
        nodes = rig.doc['nodes']
        for node_idx in rig.joint_nodes:
            t, r, _ = _node_local_trs(nodes[node_idx])
            self.rest_local.append((t, r))
        self.rest_pos, self.rest_q = self.fk({})

    def fk(
        self,
        local_rot_override: dict[int, Quaternion],
        pelvis_local_pos: Vector | None = None,
    ) -> tuple[list[Vector], list[Quaternion]]:
        n = len(self.names)
        pos = [Vector((0.0, 0.0, 0.0))] * n
        rot = [Quaternion((1.0, 0.0, 0.0, 0.0))] * n
        pelvis_idx = self.index['pelvis']
        for j in range(n):
            t_rest, r_rest = self.rest_local[j]
            t = pelvis_local_pos if (j == pelvis_idx and pelvis_local_pos is not None) else t_rest
            r = local_rot_override.get(j, r_rest)
            p = self.parent[j]
            if p is None:
                pos[j] = t.copy()
                rot[j] = r.normalized()
            else:
                pos[j] = pos[p] + (rot[p] @ t)
                rot[j] = (rot[p] @ r).normalized()
        return pos, rot


def _pack_clip_tracks(
    u1: Ual1SkeletonState,
    name: str,
    times: np.ndarray,
    frame_local_rots: list[dict[int, Quaternion]],
    frame_pelvis_pos: list[Vector],
) -> dict:
    """Convert per-frame UAL1 local transforms into compact rotation + pelvis.translation clip tracks."""
    n_frames = len(times)
    pelvis_idx = u1.index['pelvis']
    tracks: dict[int, dict[str, np.ndarray]] = {}

    # Always emit pelvis translation if it deviates from rest.
    p_rest = u1.rest_local[pelvis_idx][0]
    pelvis_arr = np.array([[p.x, p.y, p.z] for p in frame_pelvis_pos], dtype=np.float32)
    if np.max(np.abs(pelvis_arr - np.array([p_rest.x, p_rest.y, p_rest.z], dtype=np.float32))) > 1e-4:
        tracks[pelvis_idx] = {'translation': pelvis_arr}

    # Emit rotation for every joint (except root) that moves away from rest.
    for j in range(len(u1.names)):
        if u1.names[j] == 'root':
            continue
        r_rest = u1.rest_local[j][1]
        quats = []
        prev: Quaternion | None = None
        max_diff = 0.0
        for f in range(n_frames):
            q = frame_local_rots[f].get(j, r_rest).normalized()
            if prev is not None and q.dot(prev) < 0.0:
                q = -q
            prev = q
            diff = 1.0 - abs(q.dot(r_rest))
            if diff > max_diff:
                max_diff = diff
            quats.append(q_to_gltf(q))
        if max_diff > 1e-7:
            tracks.setdefault(j, {})['rotation'] = np.array(quats, dtype=np.float32)

    return {'name': name, 'times': times.astype(np.float32), 'tracks': tracks}


# --------------------------------------------------------------------------
# Quaternius UAL2 -> UAL1 retargeting
# --------------------------------------------------------------------------

def retarget_ual2_clips(u1: Ual1SkeletonState, ual2_path: Path) -> list[dict]:
    """Retarget all non-duplicate UAL2 clips onto the 53-joint UAL1 skeleton."""
    src = SourceRig(ual2_path)
    existing = set(u1.rig.clips)
    src_pelvis_idx = src.by_name['pelvis']
    u1_pelvis_idx = u1.index['pelvis']
    u1_foot_l, u1_foot_r = u1.index['foot_l'], u1.index['foot_r']
    u1_ball_l, u1_ball_r = u1.index['ball_l'], u1.index['ball_r']
    src_foot_l, src_foot_r = src.by_name['foot_l'], src.by_name['foot_r']
    src_ball_l, src_ball_r = src.by_name['ball_l'], src.by_name['ball_r']

    # Scale vertical pelvis excursions by leg ratio and baseline height ratio so feet stay planted.
    u1_pelvis_w = u1.rest_pos[u1_pelvis_idx]
    src_pelvis_w = src.rest_pos[src_pelvis_idx]
    pelvis_scale = u1_pelvis_w.y / src_pelvis_w.y
    u1_leg_span = u1.rest_pos[u1.index['thigh_l']].y - u1.rest_pos[u1_foot_l].y
    src_leg_span = src.rest_pos[src.by_name['thigh_l']].y - src.rest_pos[src_foot_l].y
    xz_scale = u1_leg_span / src_leg_span

    # Rest sole reference heights on UAL1 (ankle & toe ball when sole touches y=0)
    u1_ankle_rest_y = u1.rest_pos[u1_foot_l].y
    u1_ball_rest_y = u1.rest_pos[u1_ball_l].y
    src_ankle_rest_y = src.rest_pos[src_foot_l].y
    src_ball_rest_y = src.rest_pos[src_ball_l].y

    q_root_inv = u1.rest_q[u1.index['root']].inverted()

    ual2_names = sorted(
        a['name'] for a in src.doc.get('animations', ()) if a['name'] not in existing
    )

    out_clips = []
    for clip_name in ual2_names:
        duration, by_node = src.clip_samplers(clip_name)
        # Use the native UAL2 time array from pelvis (or longest sampler).
        times = None
        for tracks in by_node.values():
            for ts, _ in tracks.values():
                if times is None or len(ts) > len(times):
                    times = ts
        if times is None or len(times) == 0:
            continue

        frame_rots: list[dict[int, Quaternion]] = []
        frame_pelvis: list[Vector] = []

        for t_raw in times:
            t = float(t_raw)
            src_pos, src_q = src.sample_world_at(by_node, t)

            # World-space delta rotation retargeting in parent->child order
            world_q: dict[int, Quaternion] = {}
            local_rot: dict[int, Quaternion] = {}
            for j, jname in enumerate(u1.names):
                if jname == 'root':
                    world_q[j] = u1.rest_q[j]
                    local_rot[j] = u1.rest_local[j][1]
                    continue
                si = src.by_name[jname]
                d_w = (src_q[si] @ src.rest_q[si].inverted()).normalized()
                q_w = (d_w @ u1.rest_q[j]).normalized()
                world_q[j] = q_w
                p = u1.parent[j]
                local_rot[j] = (world_q[p].inverted() @ q_w).normalized()

            # Compute UAL1 pelvis world position from UAL2 pelvis displacement
            dp = src_pos[src_pelvis_idx] - src_pelvis_w
            p_world = Vector((
                u1_pelvis_w.x + dp.x * xz_scale,
                u1_pelvis_w.y + dp.y * pelvis_scale,
                u1_pelvis_w.z + dp.z * xz_scale,
            ))
            p_local = q_root_inv @ p_world

            # Evaluate FK with candidate pelvis and keep grounded soles/toes/knees/hands above y=0
            fk_pos, fk_q = u1.fk(local_rot, p_local)
            min_contact = min(
                fk_pos[u1_foot_l].y - u1_ankle_rest_y,
                fk_pos[u1_foot_r].y - u1_ankle_rest_y,
                fk_pos[u1_ball_l].y - u1_ball_rest_y,
                fk_pos[u1_ball_r].y - u1_ball_rest_y,
                fk_pos[u1.index['calf_l']].y - 0.085,
                fk_pos[u1.index['calf_r']].y - 0.085,
                fk_pos[u1.index['hand_l']].y - 0.065,
                fk_pos[u1.index['hand_r']].y - 0.065,
            )
            for ball_j, foot_j in ((u1_ball_l, u1_foot_l), (u1_ball_r, u1_foot_r)):
                d_ball = fk_q[ball_j] @ u1.rest_q[ball_j].inverted()
                d_foot = fk_q[foot_j] @ u1.rest_q[foot_j].inverted()
                for dx in (-0.055, 0.055):
                    for dz in (0.0, 0.085):
                        toe_y = (fk_pos[ball_j] + d_ball @ Vector((dx, -u1_ball_rest_y, dz))).y
                        min_contact = min(min_contact, toe_y)
                    heel_y = (fk_pos[foot_j] + d_foot @ Vector((dx, -u1_ankle_rest_y, -0.055))).y
                    min_contact = min(min_contact, heel_y)

            src_min_sole = min(
                src_pos[src_foot_l].y - src_ankle_rest_y,
                src_pos[src_foot_r].y - src_ankle_rest_y,
                src_pos[src_ball_l].y - src_ball_rest_y,
                src_pos[src_ball_r].y - src_ball_rest_y,
            )
            target_floor = max(-0.002, src_min_sole) if src_min_sole >= -0.015 else -0.002
            if min_contact < target_floor:
                p_world.y += target_floor - min_contact
                p_local = q_root_inv @ p_world

            # Low-floor poses (LayToIdle / Slide_* / Hit_Knockback): ensure pelvis center stays >= 0.165m
            # so hip/torso/cape geometry never clips under y = 0.
            if clip_name in ('LayToIdle', 'Slide_Start', 'Slide_Loop', 'Slide_Exit', 'Hit_Knockback'):
                if p_world.y < 0.165:
                    p_world.y = 0.165
                    p_local = q_root_inv @ p_world

            frame_rots.append(local_rot)
            frame_pelvis.append(p_local)

        out_clips.append(_pack_clip_tracks(u1, clip_name, times, frame_rots, frame_pelvis))

    return out_clips


# --------------------------------------------------------------------------
# KayKit CombatRanged 2H Rifle -> UAL1 retargeting
# --------------------------------------------------------------------------

def _swing_rotation(u: Vector, v: Vector) -> Quaternion:
    """Minimal-angle quaternion rotating unit vector u -> v."""
    u_n = u.normalized()
    v_n = v.normalized()
    dot = max(-1.0, min(1.0, u_n.dot(v_n)))
    if dot > 0.999999:
        return Quaternion((1.0, 0.0, 0.0, 0.0))
    if dot < -0.999999:
        perp = Vector((0.0, 1.0, 0.0)).cross(u_n)
        if perp.length < 1e-4:
            perp = Vector((0.0, 0.0, 1.0)).cross(u_n)
        return Quaternion(perp.normalized(), math.pi)
    return u_n.rotation_difference(v_n).normalized()


def _solve_2bone_arm_ik(
    shoulder: Vector,
    target: Vector,
    l1: float,
    l2: float,
    pole: Vector,
    rest_u_dir: Vector,
    rest_l_dir: Vector,
    rest_u_q: Quaternion,
    rest_l_q: Quaternion,
) -> tuple[Quaternion, Quaternion, Vector]:
    """Solve 2-bone arm IK returning world rotations (q_upper, q_lower) and wrist pos."""
    to_t = target - shoulder
    dist = to_t.length
    min_d = abs(l1 - l2) + 1e-3
    max_d = l1 + l2 - 1e-3
    if dist < 1e-6:
        to_t = Vector((0.0, -1.0, 0.5)).normalized()
        dist = min_d
    else:
        to_t = to_t / dist
    d = max(min_d, min(max_d, dist))

    cos_a = max(-1.0, min(1.0, (l1 * l1 + d * d - l2 * l2) / (2.0 * l1 * d)))
    sin_a = math.sqrt(max(0.0, 1.0 - cos_a * cos_a))

    bend = pole - shoulder
    bend -= to_t * bend.dot(to_t)
    if bend.length < 1e-5:
        bend = Vector((0.0, -1.0, 0.0)) - to_t * to_t.y
    bend.normalize()

    u_dir = (to_t * cos_a + bend * sin_a).normalized()
    elbow = shoulder + u_dir * l1
    wrist = shoulder + to_t * d
    l_dir = (wrist - elbow).normalized()

    # Align upperarm axis along u_dir and roll so the elbow hinge axis matches the IK bend plane normal.
    q_swing1 = _swing_rotation(rest_u_dir, u_dir)
    q_u_cand = (q_swing1 @ rest_u_q).normalized()
    # In rest pose, forearm stays nearly collinear, so compute desired hinge normal: u_dir x bend
    plane_n = u_dir.cross(bend).normalized()
    cand_fore = (q_swing1 @ rest_l_dir).normalized()
    # Roll around u_dir so cand_fore bends toward l_dir along plane
    cand_proj = cand_fore - u_dir * cand_fore.dot(u_dir)
    target_proj = l_dir - u_dir * l_dir.dot(u_dir)
    if cand_proj.length > 1e-5 and target_proj.length > 1e-5:
        q_roll = _swing_rotation(cand_proj.normalized(), target_proj.normalized())
        q_upper = (q_roll @ q_u_cand).normalized()
    else:
        q_upper = q_u_cand

    # Rotate lowerarm from its post-upper-rotation direction onto l_dir around hinge axis
    cur_l_dir = ((q_upper @ rest_u_q.inverted()) @ rest_l_dir).normalized()
    q_swing2 = _swing_rotation(cur_l_dir, l_dir)
    q_lower = (q_swing2 @ (q_upper @ rest_u_q.inverted()) @ rest_l_q).normalized()
    return q_upper, q_lower, elbow


def _quat_from_axes(col_x: Vector, col_y: Vector, col_z: Vector) -> Quaternion:
    x = col_x.normalized()
    y = (col_y - x * col_y.dot(x)).normalized()
    z = x.cross(y).normalized()
    y = z.cross(x).normalized()
    m = Matrix((
        (x.x, y.x, z.x),
        (x.y, y.y, z.y),
        (x.z, y.z, z.z),
    ))
    return m.to_quaternion().normalized()


def _split_forearm_twist(
    q_ll: Quaternion,
    q_hl: Quaternion,
    rest_q_ll: Quaternion,
    rest_q_hl: Quaternion,
    rest_forearm_dir: Vector,
    share: float = 0.45,
) -> Quaternion:
    """Return updated lowerarm world quaternion carrying `share` of wrist axial twist without moving the wrist."""
    forearm_axis = ((q_ll @ rest_q_ll.inverted()) @ rest_forearm_dir).normalized()
    q_hl_zero = (q_ll @ rest_q_ll.inverted() @ rest_q_hl).normalized()
    q_wrist_world = (q_hl @ q_hl_zero.inverted()).normalized()
    if q_wrist_world.w < 0.0:
        q_wrist_world = -q_wrist_world
    proj = forearm_axis * Vector((q_wrist_world.x, q_wrist_world.y, q_wrist_world.z)).dot(forearm_axis)
    q_twist = Quaternion((q_wrist_world.w, proj.x, proj.y, proj.z))
    if q_twist.magnitude < 1e-6:
        return q_ll
    q_twist.normalize()
    if q_twist.w < 0.0:
        q_twist = -q_twist
    q_share = Quaternion((1.0, 0.0, 0.0, 0.0)).slerp(q_twist, share)
    return (q_share @ q_ll).normalized()


def _sample_pistol_finger_curls(u1: Ual1SkeletonState) -> dict[int, Quaternion]:
    """Read finger joint local rotations from UAL1's Pistol_Idle_Loop frame 0 for natural weapon grip."""
    anim = next((a for a in u1.rig.doc['animations'] if a['name'] == 'Pistol_Idle_Loop'), None)
    if anim is None:
        return {}
    node_to_joint = {node: joint for joint, node in enumerate(u1.rig.joint_nodes)}
    curls: dict[int, Quaternion] = {}
    finger_prefixes = ('thumb_', 'index_', 'middle_', 'ring_', 'pinky_')
    for ch in anim['channels']:
        if ch['target']['path'] != 'rotation':
            continue
        j = node_to_joint.get(ch['target']['node'])
        if j is None or not u1.names[j].startswith(finger_prefixes):
            continue
        arr = _read_float_accessor(u1.rig.doc, u1.rig.bin, anim['samplers'][ch['sampler']]['output'])
        curls[j] = gltf_to_q(arr[0])
    return curls


def retarget_kaykit_ranged_clips(u1: Ual1SkeletonState, kaykit_path: Path) -> list[dict]:
    """Retarget KayKit CombatRanged two-handed rifle clips onto the 53-joint UAL1 skeleton."""
    src = SourceRig(kaykit_path)
    finger_curls = _sample_pistol_finger_curls(u1)

    u1_pelvis_idx = u1.index['pelvis']
    u1_pelvis_w = u1.rest_pos[u1_pelvis_idx]
    src_hips_idx = src.by_name['hips']
    src_hips_w = src.rest_pos[src_hips_idx]
    src_foot_l, src_foot_r = src.by_name['foot.l'], src.by_name['foot.r']
    u1_foot_l, u1_foot_r = u1.index['foot_l'], u1.index['foot_r']
    u1_ball_l, u1_ball_r = u1.index['ball_l'], u1.index['ball_r']

    leg_scale = (u1.rest_pos[u1.index['thigh_l']].y - u1.rest_pos[u1_foot_l].y) / (
        src.rest_pos[src.by_name['upperleg.l']].y - src.rest_pos[src_foot_l].y
    )
    u1_ankle_rest_y = u1.rest_pos[u1_foot_l].y
    u1_ball_rest_y = u1.rest_pos[u1_ball_l].y
    q_root_inv = u1.rest_q[u1.index['root']].inverted()

    # Right & left leg segment lengths & rest directions in UAL1 world space
    l1_leg_l = (u1.rest_pos[u1.index['calf_l']] - u1.rest_pos[u1.index['thigh_l']]).length
    l2_leg_l = (u1.rest_pos[u1.index['foot_l']] - u1.rest_pos[u1.index['calf_l']]).length
    l1_leg_r = (u1.rest_pos[u1.index['calf_r']] - u1.rest_pos[u1.index['thigh_r']]).length
    l2_leg_r = (u1.rest_pos[u1.index['foot_r']] - u1.rest_pos[u1.index['calf_r']]).length

    rest_leg_u_l = (u1.rest_pos[u1.index['calf_l']] - u1.rest_pos[u1.index['thigh_l']]).normalized()
    rest_leg_l_l = (u1.rest_pos[u1.index['foot_l']] - u1.rest_pos[u1.index['calf_l']]).normalized()
    rest_leg_u_r = (u1.rest_pos[u1.index['calf_r']] - u1.rest_pos[u1.index['thigh_r']]).normalized()
    rest_leg_l_r = (u1.rest_pos[u1.index['foot_r']] - u1.rest_pos[u1.index['calf_r']]).normalized()

    # Right & left arm segment lengths & rest directions in UAL1 world space
    l1_r = (u1.rest_pos[u1.index['lowerarm_r']] - u1.rest_pos[u1.index['upperarm_r']]).length
    l2_r = (u1.rest_pos[u1.index['hand_r']] - u1.rest_pos[u1.index['lowerarm_r']]).length
    l1_l = (u1.rest_pos[u1.index['lowerarm_l']] - u1.rest_pos[u1.index['upperarm_l']]).length
    l2_l = (u1.rest_pos[u1.index['hand_l']] - u1.rest_pos[u1.index['lowerarm_l']]).length

    rest_u_dir_r = (u1.rest_pos[u1.index['lowerarm_r']] - u1.rest_pos[u1.index['upperarm_r']]).normalized()
    rest_l_dir_r = (u1.rest_pos[u1.index['hand_r']] - u1.rest_pos[u1.index['lowerarm_r']]).normalized()
    rest_u_dir_l = (u1.rest_pos[u1.index['lowerarm_l']] - u1.rest_pos[u1.index['upperarm_l']]).normalized()
    rest_l_dir_l = (u1.rest_pos[u1.index['hand_l']] - u1.rest_pos[u1.index['lowerarm_l']]).normalized()

    # Socket & rifle geometry (heldSockets.hand_r -> held_rifle foregrip & barrel axis)
    # Three.js Euler(..., 'XYZ') is intrinsic Rx * Ry * Rz.
    sock_r = pk.RIG_CONTRACT['heldSockets']['hand_r']
    rx, ry, rz = sock_r['rotationEuler']
    q_sock_r = (
        Quaternion((1.0, 0.0, 0.0), rx)
        @ Quaternion((0.0, 1.0, 0.0), ry)
        @ Quaternion((0.0, 0.0, 1.0), rz)
    ).normalized()
    palm_r_local = Vector(sock_r['palmOffset'])
    # In build_packs.py held_rifle: xform = Translation(-0.009, 0.018, 0.022) @ RotY(-13 deg)
    q_rifle_yaw = Quaternion((0.0, 1.0, 0.0), math.radians(-13.0))
    rifle_barrel_in_sock = (q_rifle_yaw @ Vector((0.0, 0.0, 1.0))).normalized()
    rifle_up_in_sock = Vector((0.0, 1.0, 0.0))
    # Foregrip point along wooden forend (z=0.33, slightly below barrel centerline)
    rifle_foregrip_in_sock = Vector((-0.009, 0.018, 0.022)) + (q_rifle_yaw @ Vector((0.0, 0.022, 0.33)))

    # Desired hand_r world rotation from target rifle aim_dir & up_dir:
    # We want (q_hand_r * q_sock_r) * rifle_barrel_in_sock == aim_dir
    # and (q_hand_r * q_sock_r) * rifle_up_in_sock ~ up_dir
    q_sock_basis = _quat_from_axes(
        rifle_up_in_sock.cross(rifle_barrel_in_sock).normalized(),
        rifle_up_in_sock,
        rifle_barrel_in_sock,
    )
    q_sock_to_hand = (q_sock_r @ q_sock_basis).inverted()

    # Reference KayKit aiming pose (Ranged_2H_Shooting frame 0) so torso/leg/recoil motion is relative
    # to a clean upright athletic rifle stance rather than KayKit's stubby chibi proportions.
    _, aim_ref_by_node = src.clip_samplers('Ranged_2H_Shooting')
    aim_ref_pos, aim_ref_q = src.sample_world_at(aim_ref_by_node, 0.0)
    kr_hips_ref = aim_ref_pos[src_hips_idx]
    kr_hand_r_ref = aim_ref_pos[src.by_name['hand.r']]
    kr_q_hips_inv = aim_ref_q[src_hips_idx].inverted()
    kr_q_spine_inv = aim_ref_q[src.by_name['spine']].inverted()
    kr_q_chest_inv = aim_ref_q[src.by_name['chest']].inverted()
    kr_q_head_inv = aim_ref_q[src.by_name['head']].inverted()

    # Upright, balanced bladed rifleman base orientation deltas (in UAL1 world space).
    # Keeps pelvis & spine stacked over the feet (no forward hunch) while blading shoulders ~32 deg.
    def _yaw_pitch(yaw_deg: float, pitch_deg: float) -> Quaternion:
        return (
            Quaternion((0.0, 1.0, 0.0), math.radians(yaw_deg))
            @ Quaternion((1.0, 0.0, 0.0), math.radians(pitch_deg))
        ).normalized()

    base_spine = {
        'pelvis': _yaw_pitch(-24.0, -4.0),
        'spine_01': _yaw_pitch(-28.0, -2.0),
        'spine_02': _yaw_pitch(-31.0, 1.0),
        'spine_03': _yaw_pitch(-34.0, 3.0),
        'neck_01': _yaw_pitch(-16.0, 2.0),
        'Head': _yaw_pitch(-4.0, 2.0),
    }

    # Planted athletic firing stance foot targets (matches Pistol_Idle_Loop balance: pelvis centered over feet)
    stance_foot_l = Vector((0.185, u1_ankle_rest_y, 0.135))
    stance_foot_r = Vector((-0.175, u1_ankle_rest_y, -0.265))
    q_foot_l_world = (Quaternion((0.0, 1.0, 0.0), math.radians(14.0)) @ u1.rest_q[u1_foot_l]).normalized()
    q_foot_r_world = (Quaternion((0.0, 1.0, 0.0), math.radians(-38.0)) @ u1.rest_q[u1_foot_r]).normalized()

    # Hand_l T-pose world axes in UAL1: fingers=+X, back_of_hand=+Y, thumb=+Z
    u1_hand_l_rest_q = u1.rest_q[u1.index['hand_l']]

    # (clip_name, trim_start_sec)
    specs = [
        # Trim frames 0..12 entry blend so Ranged_2H_Aiming loops seamlessly at breathing aim stance.
        ('Ranged_2H_Aiming', 12.0 / 30.0),
        ('Ranged_2H_Reload', 0.0),
        # Trim frames 0..8 entry blend on Shoot so it starts cleanly at aim-ready -> fire -> low-ready.
        ('Ranged_2H_Shoot', 8.0 / 30.0),
        ('Ranged_2H_Shooting', 0.0),
    ]

    q_id = Quaternion((1.0, 0.0, 0.0, 0.0))
    out_clips = []
    for clip_name, t_start in specs:
        duration, by_node = src.clip_samplers(clip_name)
        dt = 1.0 / 30.0
        usable_dur = max(dt, duration - t_start)
        n_steps = max(2, int(round(usable_dur / dt)) + 1)
        sample_times = np.linspace(t_start, duration, n_steps, dtype=np.float64)
        out_times = (sample_times - t_start).astype(np.float32)

        frame_rots: list[dict[int, Quaternion]] = []
        frame_pelvis: list[Vector] = []

        for t_src in sample_times:
            t = float(t_src)
            src_pos, src_q = src.sample_world_at(by_node, t)

            world_q: dict[int, Quaternion] = {}
            local_rot: dict[int, Quaternion] = {}

            # 1. Root
            root_idx = u1.index['root']
            world_q[root_idx] = u1.rest_q[root_idx]
            local_rot[root_idx] = u1.rest_local[root_idx][1]

            # 2. Spine & Head: relative KayKit torso motion damped & layered over upright athletic rifle stance
            rel_hips = (src_q[src_hips_idx] @ kr_q_hips_inv).normalized()
            rel_spine = (src_q[src.by_name['spine']] @ kr_q_spine_inv).normalized()
            rel_chest = (src_q[src.by_name['chest']] @ kr_q_chest_inv).normalized()
            rel_head = (src_q[src.by_name['head']] @ kr_q_head_inv).normalized()

            spine_w_gain = 0.45 if clip_name == 'Ranged_2H_Reload' else 0.55
            chest_w_gain = 0.65 if clip_name == 'Ranged_2H_Reload' else 0.70
            spine_deltas = {
                'pelvis': q_id.slerp(rel_hips, 0.50) @ base_spine['pelvis'],
                'spine_01': q_id.slerp(rel_hips.slerp(rel_spine, 0.5), spine_w_gain) @ base_spine['spine_01'],
                'spine_02': q_id.slerp(rel_spine, spine_w_gain) @ base_spine['spine_02'],
                'spine_03': q_id.slerp(rel_chest, chest_w_gain) @ base_spine['spine_03'],
                'neck_01': q_id.slerp(rel_chest.slerp(rel_head, 0.35), 0.55) @ base_spine['neck_01'],
                'Head': q_id.slerp(rel_head, 0.65) @ base_spine['Head'],
            }
            for jname, dw in spine_deltas.items():
                j = u1.index[jname]
                q_w = (dw @ u1.rest_q[j]).normalized()
                world_q[j] = q_w
                local_rot[j] = (world_q[u1.parent[j]].inverted() @ q_w).normalized()

            d_chest = spine_deltas['spine_03']

            # 3. Pelvis placement centered over the planted feet (~4.5 cm lower than T-pose so both knees stay softly bent)
            dp_rel = src_pos[src_hips_idx] - kr_hips_ref
            # Subtle recoil/breathing excursion without lunging 20 cm backward
            p_world = Vector((
                u1_pelvis_w.x + dp_rel.x * 0.45,
                u1_pelvis_w.y - 0.045 + dp_rel.y * 0.90,
                -0.068 + max(-0.040, min(0.030, dp_rel.z * 0.45)),
            ))
            p_local = q_root_inv @ p_world

            # Keep clavicles slightly rolled forward/relaxed for shoulder pocket
            for clav_name, yaw_deg in (('clavicle_r', -8.0), ('clavicle_l', 10.0)):
                cj = u1.index[clav_name]
                q_cw = (Quaternion((0.0, 1.0, 0.0), math.radians(yaw_deg)) @ d_chest @ u1.rest_q[cj]).normalized()
                world_q[cj] = q_cw
                local_rot[cj] = (world_q[u1.parent[cj]].inverted() @ q_cw).normalized()

            # Compute torso & hip FK positions
            fk_pos, _ = u1.fk(local_rot, p_local)

            # 4. Two-bone analytical Leg IK to planted stance feet (prevents knee lock / back-leg pulsing)
            hip_l = fk_pos[u1.index['thigh_l']]
            hip_r = fk_pos[u1.index['thigh_r']]
            # Clamp max reach slightly below full extension so knees always keep a natural >= 20 deg bend
            max_reach_l = (l1_leg_l + l2_leg_l) * 0.984
            max_reach_r = (l1_leg_r + l2_leg_r) * 0.984
            to_fl = stance_foot_l - hip_l
            if to_fl.length > max_reach_l:
                target_foot_l = hip_l + to_fl.normalized() * max_reach_l
            else:
                target_foot_l = stance_foot_l
            to_fr = stance_foot_r - hip_r
            if to_fr.length > max_reach_r:
                target_foot_r = hip_r + to_fr.normalized() * max_reach_r
            else:
                target_foot_r = stance_foot_r

            pole_knee_l = hip_l + Vector((0.14, -0.35, 0.55))
            pole_knee_r = hip_r + Vector((-0.24, -0.35, 0.45))

            q_tl, q_cl, _ = _solve_2bone_arm_ik(
                hip_l,
                target_foot_l,
                l1_leg_l,
                l2_leg_l,
                pole_knee_l,
                rest_leg_u_l,
                rest_leg_l_l,
                u1.rest_q[u1.index['thigh_l']],
                u1.rest_q[u1.index['calf_l']],
            )
            q_tr, q_cr, _ = _solve_2bone_arm_ik(
                hip_r,
                target_foot_r,
                l1_leg_r,
                l2_leg_r,
                pole_knee_r,
                rest_leg_u_r,
                rest_leg_l_r,
                u1.rest_q[u1.index['thigh_r']],
                u1.rest_q[u1.index['calf_r']],
            )

            for jname, q_w in (
                ('thigh_l', q_tl), ('calf_l', q_cl), ('foot_l', q_foot_l_world),
                ('thigh_r', q_tr), ('calf_r', q_cr), ('foot_r', q_foot_r_world),
            ):
                j = u1.index[jname]
                world_q[j] = q_w
                local_rot[j] = (world_q[u1.parent[j]].inverted() @ q_w).normalized()
            local_rot[u1_ball_l] = u1.rest_local[u1_ball_l][1]
            local_rot[u1_ball_r] = u1.rest_local[u1_ball_r][1]

            # Recompute FK with solved legs and ground the lowest sole contact at y = 0
            fk_pos, _ = u1.fk(local_rot, p_local)
            min_sole = min(
                fk_pos[u1_foot_l].y - u1_ankle_rest_y,
                fk_pos[u1_foot_r].y - u1_ankle_rest_y,
                fk_pos[u1_ball_l].y - u1_ball_rest_y,
                fk_pos[u1_ball_r].y - u1_ball_rest_y,
            )
            p_world.y -= min_sole
            p_local = q_root_inv @ p_world
            fk_pos, _ = u1.fk(local_rot, p_local)

            # 5. Two-handed rifle arms (analytical IK anchored to spine_03 chest frame + recoil)
            chest_pos = fk_pos[u1.index['spine_03']]
            shoulder_r = fk_pos[u1.index['upperarm_r']]
            shoulder_l = fk_pos[u1.index['upperarm_l']]

            # Blend weight for low-ready in Ranged_2H_Shoot end and magazine swap in Ranged_2H_Reload
            if clip_name == 'Ranged_2H_Shoot':
                w_aim_l = max(0.0, 1.0 - max(0.0, (t - 0.72) / 0.28))
            elif clip_name == 'Ranged_2H_Reload':
                if t < 0.16:
                    w_aim_l = 1.0 - t / 0.16
                elif t > 1.32:
                    w_aim_l = min(1.0, (t - 1.32) / 0.25)
                else:
                    w_aim_l = 0.0
            else:
                w_aim_l = 1.0

            # Recoil / breathing offset from KayKit hand.r relative to aiming reference
            recoil_gain = 0.30 if clip_name == 'Ranged_2H_Reload' else 0.90
            recoil_r = (src_pos[src.by_name['hand.r']] - kr_hand_r_ref) * recoil_gain
            # Ideal right-hand firing position: outside right chest/pectoral so stock & receiver clear jacket
            base_hand_r = chest_pos + (d_chest @ Vector((-0.170, -0.095, 0.255)))
            target_hand_r = base_hand_r + recoil_r

            pole_r = shoulder_r + Vector((-0.34, -0.35, -0.02))
            q_ur_ik, q_lr_ik, _ = _solve_2bone_arm_ik(
                shoulder_r,
                target_hand_r,
                l1_r,
                l2_r,
                pole_r,
                rest_u_dir_r,
                rest_l_dir_r,
                u1.rest_q[u1.index['upperarm_r']],
                u1.rest_q[u1.index['lowerarm_r']],
            )

            # Orient hand_r so rifle points straight downrange (+Z) across chest
            recoil_pitch = -recoil_r.z * 1.1
            reload_cant = math.radians(12.0) if clip_name == 'Ranged_2H_Reload' else math.radians(6.0)
            aim_dir = (d_chest @ Vector((0.54, 0.02 + recoil_pitch * 0.4, 1.0))).normalized()
            aim_up = (Quaternion(aim_dir, -reload_cant) @ Vector((0.0, 1.0, 0.0))).normalized()
            aim_right = aim_up.cross(aim_dir).normalized()
            aim_up_ortho = aim_dir.cross(aim_right).normalized()
            q_rifle_world = _quat_from_axes(aim_right, aim_up_ortho, aim_dir)
            q_hr = (q_rifle_world @ q_sock_to_hand).normalized()

            # Set right arm joints
            for jname, q_w in (('upperarm_r', q_ur_ik), ('lowerarm_r', q_lr_ik), ('hand_r', q_hr)):
                j = u1.index[jname]
                world_q[j] = q_w
                local_rot[j] = (world_q[u1.parent[j]].inverted() @ q_w).normalized()

            # Compute exact world position of rifle foregrip from hand_r
            hand_r_actual = shoulder_r + ((q_ur_ik @ u1.rest_q[u1.index['upperarm_r']].inverted()) @ (
                u1.rest_pos[u1.index['lowerarm_r']] - u1.rest_pos[u1.index['upperarm_r']]
            )) + ((q_lr_ik @ u1.rest_q[u1.index['lowerarm_r']].inverted()) @ (
                u1.rest_pos[u1.index['hand_r']] - u1.rest_pos[u1.index['lowerarm_r']]
            ))
            sock_origin = hand_r_actual + (q_hr @ palm_r_local)
            q_sock_world = (q_hr @ q_sock_r).normalized()
            foregrip_world = sock_origin + (q_sock_world @ rifle_foregrip_in_sock)

            # Left-hand target: cradle cleanly below/left of the wooden forend (zero mesh intersection)
            target_hand_l_aim = foregrip_world + Vector((0.056, -0.064, -0.025))
            if w_aim_l < 0.999:
                if clip_name == 'Ranged_2H_Reload':
                    # During reload, drop left hand cleanly underneath the receiver to chest pouch and back up to mag well
                    mag_pos = sock_origin + (q_sock_world @ (Vector((-0.009, 0.018, 0.022)) + (q_rifle_yaw @ Vector((0.055, -0.105, 0.14)))))
                    pouch_pos = chest_pos + (d_chest @ Vector((0.16, -0.22, 0.24)))
                    phase_drop = math.sin(min(1.0, max(0.0, (t - 0.14) / 1.18)) * math.pi)
                    fk_hand_l = mag_pos.lerp(pouch_pos, phase_drop)
                else:
                    # Low-ready drop at end of Ranged_2H_Shoot
                    fk_hand_l = target_hand_l_aim + Vector((0.05, -0.16, -0.02))
                target_hand_l = fk_hand_l.lerp(target_hand_l_aim, w_aim_l)
            else:
                target_hand_l = target_hand_l_aim

            pole_l = shoulder_l + Vector((0.28, -0.38, 0.04))
            q_ul_ik, q_ll_ik, elbow_l = _solve_2bone_arm_ik(
                shoulder_l,
                target_hand_l,
                l1_l,
                l2_l,
                pole_l,
                rest_u_dir_l,
                rest_l_dir_l,
                u1.rest_q[u1.index['upperarm_l']],
                u1.rest_q[u1.index['lowerarm_l']],
            )

            # Orient hand_l so palm (-Y) faces upward-right cradling the forend, fingers (+X) wrap around
            forearm_dir_l = (target_hand_l - elbow_l).normalized()
            hand_l_fingers = (forearm_dir_l + Vector((-0.35, 0.35, 0.25))).normalized()
            hand_l_back = Vector((-0.35, -0.88, -0.20)).normalized()
            q_hl = (_quat_from_axes(hand_l_fingers, hand_l_back, hand_l_fingers.cross(hand_l_back)) @ u1_hand_l_rest_q).normalized()
            q_ll_ik = _split_forearm_twist(
                q_ll_ik,
                q_hl,
                u1.rest_q[u1.index['lowerarm_l']],
                u1_hand_l_rest_q,
                rest_l_dir_l,
                share=0.45,
            )

            for jname, q_w in (('upperarm_l', q_ul_ik), ('lowerarm_l', q_ll_ik), ('hand_l', q_hl)):
                j = u1.index[jname]
                world_q[j] = q_w
                local_rot[j] = (world_q[u1.parent[j]].inverted() @ q_w).normalized()

            # 6. Natural grip finger curls
            for j, q_curl in finger_curls.items():
                local_rot[j] = q_curl

            frame_rots.append(local_rot)
            frame_pelvis.append(p_local)

        out_clips.append(_pack_clip_tracks(u1, clip_name, out_times, frame_rots, frame_pelvis))

    return out_clips


# --------------------------------------------------------------------------
# UAL1 Pistol_* two-handed support grip fix
# --------------------------------------------------------------------------

PISTOL_CLIP_NAMES = (
    'Pistol_Aim_Down',
    'Pistol_Aim_Neutral',
    'Pistol_Aim_Up',
    'Pistol_Idle_Loop',
    'Pistol_Reload',
    'Pistol_Shoot',
)


def fix_ual1_pistol_clips(u1: Ual1SkeletonState, rig_path: Path) -> list[dict]:
    """Fix crossed forearms in UAL1's Pistol_* clips by solving left-arm IK into a two-handed support grip.

    In Quaternius's `ual1-base.glb`, `hand_l` overshoots ~11 cm past `hand_r` to `-X`, causing the left
    and right forearms to cross in an X from top-down view. Keeping right-arm, torso, leg, and finger-curl
    tracks intact, this solves `upperarm_l`, `lowerarm_l`, and `hand_l` to cup the left/bottom of `hand_r`
    and the pistol grip cleanly, while smoothly blending out/in during `Pistol_Reload`'s mag swap.
    """
    src = SourceRig(rig_path)
    u1_pelvis_idx = u1.index['pelvis']
    src_pelvis_idx = src.by_name['pelvis']
    q_root_inv = u1.rest_q[u1.index['root']].inverted()
    u1_hand_l_rest_q = u1.rest_q[u1.index['hand_l']]

    l1_l = (u1.rest_pos[u1.index['lowerarm_l']] - u1.rest_pos[u1.index['upperarm_l']]).length
    l2_l = (u1.rest_pos[u1.index['hand_l']] - u1.rest_pos[u1.index['lowerarm_l']]).length
    rest_u_dir_l = (u1.rest_pos[u1.index['lowerarm_l']] - u1.rest_pos[u1.index['upperarm_l']]).normalized()
    rest_l_dir_l = (u1.rest_pos[u1.index['hand_l']] - u1.rest_pos[u1.index['lowerarm_l']]).normalized()

    sock_r = pk.RIG_CONTRACT['heldSockets']['hand_r']
    rx, ry, rz = sock_r['rotationEuler']
    q_sock_r = (
        Quaternion((1.0, 0.0, 0.0), rx)
        @ Quaternion((0.0, 1.0, 0.0), ry)
        @ Quaternion((0.0, 0.0, 1.0), rz)
    ).normalized()
    palm_r_local = Vector(sock_r['palmOffset'])

    hr_si = src.by_name['hand_r']
    clav_l_si = src.by_name['clavicle_l']
    ul_si = src.by_name['upperarm_l']
    ll_si = src.by_name['lowerarm_l']
    hl_si = src.by_name['hand_l']

    ul_idx = u1.index['upperarm_l']
    ll_idx = u1.index['lowerarm_l']
    hl_idx = u1.index['hand_l']

    out_clips: list[dict] = []
    for clip_name in PISTOL_CLIP_NAMES:
        duration, by_node = src.clip_samplers(clip_name)
        times = None
        for tracks in by_node.values():
            for ts, _ in tracks.values():
                if times is None or len(ts) > len(times):
                    times = ts
        if times is None or len(times) == 0:
            continue

        frame_rots: list[dict[int, Quaternion]] = []
        frame_pelvis: list[Vector] = []

        for t_raw in times:
            t = float(t_raw)
            src_pos, src_q = src.sample_world_at(by_node, t)

            local_rot: dict[int, Quaternion] = {}
            for j, jname in enumerate(u1.names):
                pj = u1.parent[j]
                if pj is None:
                    local_rot[j] = u1.rest_local[j][1]
                else:
                    p_si = src.by_name[u1.names[pj]]
                    c_si = src.by_name[jname]
                    local_rot[j] = (src_q[p_si].inverted() @ src_q[c_si]).normalized()

            p_local = q_root_inv @ src_pos[src_pelvis_idx]

            if clip_name == 'Pistol_Reload' and duration > 1e-6:
                f = max(0.0, min(1.0, t / duration))
                smooth = lambda a: 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, a)))
            else:
                f = 0.0
                smooth = lambda a: 0.0

            palm_r_world = src_pos[hr_si] + (src_q[hr_si] @ palm_r_local)
            q_sock_r_world = (src_q[hr_si] @ q_sock_r).normalized()
            barrel_world = q_sock_r_world @ Vector((0.0, 0.0, 1.0))
            down_blend = max(0.0, -barrel_world.y) ** 1.5

            # Cup the left/underside of hand_r and the pistol grip without crossing past hand_r.
            target_hand_l_aim = palm_r_world + (
                q_sock_r_world @ Vector((0.080 + 0.015 * down_blend, -0.048 + 0.025 * down_blend, -0.074))
            )
            shoulder_l = src_pos[ul_si]
            pole_l_aim = (
                shoulder_l
                + (q_sock_r_world @ Vector((0.30 + 0.18 * down_blend, -0.32 * (1.0 - 0.70 * down_blend), -0.05)))
                + Vector((0.0, 0.0, 0.24 * down_blend))
            )

            f_dir_aim = (q_sock_r_world @ Vector((-0.28, -0.15, 0.95))).normalized()
            b_dir_aim = (q_sock_r_world @ Vector((0.90, -0.32, 0.29))).normalized()
            q_hl_aim = (_quat_from_axes(f_dir_aim, b_dir_aim, f_dir_aim.cross(b_dir_aim)) @ u1_hand_l_rest_q).normalized()

            if clip_name == 'Pistol_Reload' and duration > 1e-6:
                pouch_target = shoulder_l + Vector((0.160, -0.360, 0.020))
                mag_target = palm_r_world + (q_sock_r_world @ Vector((0.055, -0.125, -0.068)))
                seat_target = palm_r_world + (q_sock_r_world @ Vector((0.062, -0.088, -0.068)))
                pole_l_pouch = shoulder_l + Vector((0.36, -0.18, -0.26))
                q_hl_pouch = (
                    _quat_from_axes(
                        Vector((-0.20, -0.86, 0.47)).normalized(),
                        Vector((0.93, -0.28, -0.24)).normalized(),
                        Vector((-0.20, -0.86, 0.47)).normalized().cross(Vector((0.93, -0.28, -0.24)).normalized()),
                    )
                    @ u1_hand_l_rest_q
                ).normalized()

                if f < 0.25:
                    u = smooth(f / 0.25)
                    target_hand_l = target_hand_l_aim.lerp(pouch_target, u)
                    pole_l = pole_l_aim.lerp(pole_l_pouch, u)
                    q_hl = q_hl_aim.slerp(q_hl_pouch, u).normalized()
                elif f < 0.50:
                    u = smooth((f - 0.25) / 0.25)
                    target_hand_l = pouch_target.lerp(mag_target, u)
                    pole_l = pole_l_pouch.lerp(pole_l_aim, u)
                    q_hl = q_hl_pouch.slerp(q_hl_aim, u).normalized()
                elif f < 0.68:
                    u = smooth((f - 0.50) / 0.18)
                    target_hand_l = mag_target.lerp(seat_target, u)
                    pole_l = pole_l_aim
                    q_hl = q_hl_aim
                else:
                    u = smooth((f - 0.68) / 0.32)
                    target_hand_l = seat_target.lerp(target_hand_l_aim, u)
                    pole_l = pole_l_aim
                    q_hl = q_hl_aim
            else:
                target_hand_l = target_hand_l_aim
                pole_l = pole_l_aim
                q_hl = q_hl_aim

            q_ul, q_ll, _ = _solve_2bone_arm_ik(
                shoulder_l,
                target_hand_l,
                l1_l,
                l2_l,
                pole_l,
                rest_u_dir_l,
                rest_l_dir_l,
                u1.rest_q[ul_idx],
                u1.rest_q[ll_idx],
            )

            q_ll = _split_forearm_twist(
                q_ll,
                q_hl,
                u1.rest_q[ll_idx],
                u1_hand_l_rest_q,
                rest_l_dir_l,
                share=0.45,
            )

            clav_q = src_q[clav_l_si]
            local_rot[ul_idx] = (clav_q.inverted() @ q_ul).normalized()
            local_rot[ll_idx] = (q_ul.inverted() @ q_ll).normalized()
            local_rot[hl_idx] = (q_ll.inverted() @ q_hl).normalized()

            frame_rots.append(local_rot)
            frame_pelvis.append(p_local)

        out_clips.append(_pack_clip_tracks(u1, clip_name, times, frame_rots, frame_pelvis))

    return out_clips


def fix_ual1_sword_idle_clip(u1: Ual1SkeletonState, rig_path: Path) -> dict:
    """Lift UAL1 `Sword_Idle` pelvis by +12mm in world Y so heels/soles stay grounded without dipping below y=0."""
    src = SourceRig(rig_path)
    src_pelvis_idx = src.by_name['pelvis']
    q_root_inv = u1.rest_q[u1.index['root']].inverted()
    pelvis_lift = q_root_inv @ Vector((0.0, 0.012, 0.0))

    _, by_node = src.clip_samplers('Sword_Idle')
    times = None
    for tracks in by_node.values():
        for ts, _ in tracks.values():
            if times is None or len(ts) > len(times):
                times = ts
    if times is None or len(times) == 0:
        raise ValueError(f'{rig_path}: Sword_Idle has no animation samples')

    frame_rots: list[dict[int, Quaternion]] = []
    frame_pelvis: list[Vector] = []
    for t_raw in times:
        t = float(t_raw)
        src_pos, src_q = src.sample_world_at(by_node, t)
        local_rot: dict[int, Quaternion] = {}
        for j, jname in enumerate(u1.names):
            pj = u1.parent[j]
            if pj is None:
                local_rot[j] = u1.rest_local[j][1]
            else:
                p_si = src.by_name[u1.names[pj]]
                c_si = src.by_name[jname]
                local_rot[j] = (src_q[p_si].inverted() @ src_q[c_si]).normalized()
        frame_rots.append(local_rot)
        frame_pelvis.append((q_root_inv @ src_pos[src_pelvis_idx]) + pelvis_lift)

    return _pack_clip_tracks(u1, 'Sword_Idle', times, frame_rots, frame_pelvis)


# --------------------------------------------------------------------------
# Mesh2Motion CC0 Creature -> RUN Chisel Packs Creature Rig Retargeting
# --------------------------------------------------------------------------

class CreatureSkeletonState:
    """Rest-pose data and FK evaluator for any custom creature rig contract."""

    def __init__(self, contract: dict):
        self.contract = contract
        self.names = list(contract['joints'])
        self.index = {name: i for i, name in enumerate(self.names)}
        parents = contract['parents']
        self.parent = [self.index[parents[n]] if parents[n] is not None else None for n in self.names]
        self.rest_pos = [Vector(contract['worldPositions'][n]) for n in self.names]
        self.rest_local: list[tuple[Vector, Quaternion]] = []
        q_id = Quaternion((1.0, 0.0, 0.0, 0.0))
        for i, p in enumerate(self.parent):
            t = self.rest_pos[i].copy() if p is None else (self.rest_pos[i] - self.rest_pos[p])
            self.rest_local.append((t, q_id.copy()))
        self.pelvis_name = 'body' if 'body' in self.index else 'pelvis'
        self.pelvis_idx = self.index[self.pelvis_name]

    def fk(
        self,
        local_rot_override: dict[int, Quaternion],
        pelvis_local_pos: Vector | None = None,
    ) -> list[Vector]:
        n = len(self.names)
        pos = [Vector((0.0, 0.0, 0.0))] * n
        rot = [Quaternion((1.0, 0.0, 0.0, 0.0))] * n
        for j in range(n):
            t_rest, r_rest = self.rest_local[j]
            t = pelvis_local_pos if (j == self.pelvis_idx and pelvis_local_pos is not None) else t_rest
            r = local_rot_override.get(j, r_rest)
            p = self.parent[j]
            if p is None:
                pos[j] = t.copy()
                rot[j] = r.normalized()
            else:
                pos[j] = pos[p] + (rot[p] @ t)
                rot[j] = (rot[p] @ r).normalized()
        return pos


def _chain_world_delta(
    src: SourceRig,
    src_pos: list[Vector],
    src_q: list[Quaternion],
    start_name: str,
    end_name: str,
    twist_name: str | None = None,
) -> Quaternion:
    """World delta rotation combining segment swing (start->end) and axial twist from twist_name."""
    si0 = src.by_name[start_name]
    si1 = src.by_name[end_name]
    v_rest = src.rest_pos[si1] - src.rest_pos[si0]
    v_anim = src_pos[si1] - src_pos[si0]
    if v_rest.length < 1e-5 or v_anim.length < 1e-5:
        ti = src.by_name[twist_name or start_name]
        return (src_q[ti] @ src.rest_q[ti].inverted()).normalized()
    d_swing = _swing_rotation(v_rest, v_anim)
    ti = src.by_name[twist_name or start_name]
    d_raw = (src_q[ti] @ src.rest_q[ti].inverted()).normalized()
    # Extract residual axial twist of d_raw around animated axis
    axis = v_anim.normalized()
    q_res = (d_raw @ d_swing.inverted()).normalized()
    if q_res.w < 0.0:
        q_res = -q_res
    proj = axis * Vector((q_res.x, q_res.y, q_res.z)).dot(axis)
    q_twist = Quaternion((q_res.w, proj.x, proj.y, proj.z))
    if q_twist.magnitude < 1e-5:
        return d_swing
    q_twist.normalize()
    return (q_twist @ d_swing).normalized()


def _pack_creature_clip(
    tgt: CreatureSkeletonState,
    clip_name: str,
    times: np.ndarray,
    frame_rots: list[dict[int, Quaternion]],
    frame_pelvis: list[Vector],
) -> dict:
    n_frames = len(times)
    tracks: dict[str, dict[str, list]] = {}
    p_rest = tgt.rest_local[tgt.pelvis_idx][0]
    p_arr = np.array([[p.x, p.y, p.z] for p in frame_pelvis], dtype=np.float32)
    if np.max(np.abs(p_arr - np.array([p_rest.x, p_rest.y, p_rest.z], dtype=np.float32))) > 1e-4:
        tracks[tgt.pelvis_name] = {'translation': p_arr.tolist()}

    q_id = Quaternion((1.0, 0.0, 0.0, 0.0))
    for j, jname in enumerate(tgt.names):
        if jname == 'root':
            continue
        quats = []
        prev: Quaternion | None = None
        max_diff = 0.0
        for f in range(n_frames):
            q = frame_rots[f].get(j, q_id).normalized()
            if prev is not None and q.dot(prev) < 0.0:
                q = -q
            prev = q
            diff = 1.0 - abs(q.dot(q_id))
            if diff > max_diff:
                max_diff = diff
            quats.append(list(q_to_gltf(q)))
        if max_diff > 1e-6:
            tracks.setdefault(jname, {})['rotation'] = quats

    return {'name': clip_name, 'times': times.astype(np.float32), 'tracks': tracks}


def _rot_xyz(rx_deg: float = 0.0, ry_deg: float = 0.0, rz_deg: float = 0.0) -> Quaternion:
    return Euler((math.radians(rx_deg), math.radians(ry_deg), math.radians(rz_deg)), 'XYZ').to_quaternion()


def _smooth_joint_pops(
    frame_rots: list[dict[int, Quaternion]],
    n_joints: int,
    max_step_deg: float = 32.0,
) -> None:
    """Eliminate single-frame IK pole flips and velocity spikes across sampled joint quaternions."""
    n_frames = len(frame_rots)
    if n_frames < 3:
        return
    q_id = Quaternion((1.0, 0.0, 0.0, 0.0))
    for j in range(n_joints):
        qs = [frame_rots[f].get(j, q_id).normalized() for f in range(n_frames)]
        for f in range(1, n_frames):
            if qs[f].dot(qs[f - 1]) < 0.0:
                qs[f] = -qs[f]
        # Pass 1: bridge IK pole-flip islands (e.g. a limb flipping ~150-180 deg for 1..18 frames and returning)
        f = 1
        while f < n_frames - 1:
            dot_in = min(1.0, abs(qs[f].dot(qs[f - 1])))
            deg_in = math.degrees(2.0 * math.acos(dot_in))
            if deg_in > 68.0:
                end_idx = None
                for k in range(f + 1, min(n_frames, f + 22)):
                    dot_ret = min(1.0, abs(qs[k].dot(qs[f - 1])))
                    if math.degrees(2.0 * math.acos(dot_ret)) < 58.0:
                        end_idx = k
                        break
                if end_idx is not None:
                    q_start = qs[f - 1]
                    q_end = qs[end_idx]
                    if q_start.dot(q_end) < 0.0:
                        q_end = -q_end
                    span = end_idx - (f - 1)
                    for m in range(f, end_idx):
                        qs[m] = q_start.slerp(q_end, (m - (f - 1)) / span).normalized()
                    f = end_idx
                    continue
            f += 1
        # Pass 2: cap remaining single-frame angular step to max_step_deg
        for f in range(1, n_frames):
            prev = qs[f - 1]
            cur = qs[f]
            if cur.dot(prev) < 0.0:
                cur = -cur
            dot = min(1.0, max(-1.0, prev.dot(cur)))
            deg = math.degrees(2.0 * math.acos(dot))
            if deg > max_step_deg:
                qs[f] = prev.slerp(cur, max_step_deg / deg).normalized()
            else:
                qs[f] = cur
        for f in range(n_frames):
            if j in frame_rots[f]:
                frame_rots[f][j] = qs[f]


def retarget_m2m_clips(
    contract: dict,
    src_path: Path,
    clip_specs: list[tuple[str, str, bool]],
    joint_rules: dict[str, tuple],
    *,
    src_pelvis_name: str = 'hips',
    ground_bones: tuple[str, ...] = (),
    ground_margin: float = 0.0,
    floor_clearances: dict[str, float] | None = None,
    xz_scale: float | None = None,
    y_scale: float | None = None,
    pelvis_y_lift: float = 0.0,
    hover_clips: set[str] | None = None,
    ground_snap_clips: set[str] | None = None,
    pose_adjust_fn=None,
    fps: float = 24.0,
) -> list[dict]:
    """Retarget Mesh2Motion CC0 clips onto a RUN Chisel Packs creature contract.

    clip_specs: list of (target_clip_name, source_clip_name, close_loop)
    joint_rules: target_joint ->
      ('chain', src_start, src_end, twist_bone_or_None)
      ('delta', src_bone)
      ('rel', src_child, src_parent)  # local relative delta (e.g., jaw vs head)
    """
    src = SourceRig(src_path)
    tgt = CreatureSkeletonState(contract)
    src_p_idx = src.by_name[src_pelvis_name]
    src_p_rest = src.rest_pos[src_p_idx]
    tgt_p_rest = tgt.rest_pos[tgt.pelvis_idx]

    if y_scale is None:
        y_scale = (tgt_p_rest.y / src_p_rest.y) if abs(src_p_rest.y) > 0.05 else 0.55
    if xz_scale is None:
        xz_scale = y_scale

    ground_map: dict[int, float] = {}
    for b in ground_bones:
        if b in tgt.index:
            idx = tgt.index[b]
            ground_map[idx] = tgt.rest_pos[idx].y - ground_margin
    if floor_clearances:
        for b, min_y in floor_clearances.items():
            if b in tgt.index:
                idx = tgt.index[b]
                ground_map[idx] = max(ground_map.get(idx, -1e9), min_y)
    ground_indices = list(ground_map.items())
    hover_set = hover_clips or set()
    snap_set = ground_snap_clips or set()
    sole_indices = [tgt.index[b] for b in ground_bones if b in tgt.index]

    out_clips = []
    for tgt_name, src_name, close_loop in clip_specs:
        duration, by_node = src.clip_samplers(src_name)
        times = None
        for tr in by_node.values():
            for ts, _ in tr.values():
                if times is None or len(ts) > len(times):
                    times = ts
        if times is None or len(times) == 0:
            continue

        frame_rots: list[dict[int, Quaternion]] = []
        frame_pelvis: list[Vector] = []
        q_id = Quaternion((1.0, 0.0, 0.0, 0.0))

        for t_raw in times:
            t = float(t_raw)
            src_pos, src_q = src.sample_world_at(by_node, t)
            world_q: dict[int, Quaternion] = {}
            local_rot: dict[int, Quaternion] = {}

            for j, jname in enumerate(tgt.names):
                if jname == 'root':
                    world_q[j] = q_id
                    local_rot[j] = q_id
                    continue
                rule = joint_rules.get(jname)
                p = tgt.parent[j]
                if rule is None:
                    q_w = world_q[p] if p is not None else q_id
                    world_q[j] = q_w
                    local_rot[j] = q_id
                    continue
                kind = rule[0]
                if kind == 'chain':
                    _, s0, s1, st = rule
                    d_w = _chain_world_delta(src, src_pos, src_q, s0, s1, st)
                    world_q[j] = d_w
                    local_rot[j] = (world_q[p].inverted() @ d_w).normalized() if p is not None else d_w
                elif kind == 'delta':
                    _, sb = rule
                    si = src.by_name[sb]
                    d_w = (src_q[si] @ src.rest_q[si].inverted()).normalized()
                    world_q[j] = d_w
                    local_rot[j] = (world_q[p].inverted() @ d_w).normalized() if p is not None else d_w
                elif kind == 'rel':
                    _, sc, sp = rule
                    ic, ip = src.by_name[sc], src.by_name[sp]
                    q_rel_anim = (src_q[ip].inverted() @ src_q[ic]).normalized()
                    q_rel_rest = (src.rest_q[ip].inverted() @ src.rest_q[ic]).normalized()
                    d_local = (q_rel_anim @ q_rel_rest.inverted()).normalized()
                    local_rot[j] = d_local
                    world_q[j] = (world_q[p] @ d_local).normalized() if p is not None else d_local
                else:
                    raise ValueError(f'Unknown joint rule: {kind}')

            if pose_adjust_fn is not None:
                pose_adjust_fn(tgt_name, tgt, local_rot)

            dp = src_pos[src_p_idx] - src_p_rest
            p_world = Vector((
                tgt_p_rest.x + dp.x * xz_scale,
                tgt_p_rest.y + dp.y * y_scale + pelvis_y_lift,
                tgt_p_rest.z + dp.z * xz_scale,
            ))

            if ground_indices and tgt_name not in hover_set:
                fk_pos = tgt.fk(local_rot, p_world)
                if tgt_name in snap_set and sole_indices:
                    min_sole = min(fk_pos[si].y - tgt.rest_pos[si].y for si in sole_indices)
                    if min_sole > 0.002:
                        p_world.y -= min_sole - 0.002
                        fk_pos = tgt.fk(local_rot, p_world)
                min_contact = min(fk_pos[gi].y - rest_y for gi, rest_y in ground_indices)
                if min_contact < -0.002:
                    p_world.y += -0.002 - min_contact

            frame_rots.append(local_rot)
            frame_pelvis.append(p_world)

        _smooth_joint_pops(frame_rots, len(tgt.names), max_step_deg=min(28.0, 26.0 * (24.0 / fps)))

        out_times = np.asarray(times, dtype=np.float32)
        if close_loop and len(frame_rots) >= 2:
            # Check start vs end discontinuity; if > 1.5 deg or pelvis > 3mm, append 1 closing frame back to frame 0
            max_deg = 0.0
            for j in range(len(tgt.names)):
                q0 = frame_rots[0].get(j, q_id)
                qe = frame_rots[-1].get(j, q_id)
                dot = min(1.0, abs(q0.dot(qe)))
                max_deg = max(max_deg, math.degrees(2.0 * math.acos(dot)))
            p_diff = (frame_pelvis[-1] - frame_pelvis[0]).length
            if max_deg > 1.5 or p_diff > 0.003:
                dt = 1.0 / fps
                out_times = np.append(out_times, out_times[-1] + dt).astype(np.float32)
                frame_rots.append(dict(frame_rots[0]))
                frame_pelvis.append(frame_pelvis[0].copy())

        out_clips.append(_pack_creature_clip(tgt, tgt_name, out_times, frame_rots, frame_pelvis))

    return out_clips


def build_retargeted_quadruped_clips(contract: dict, creatures_dir: Path) -> list[dict]:
    """Retarget CC0 fox & horse clips onto the 23-joint quadruped rig."""
    fox_rules = {
        'pelvis': ('delta', 'hips'),
        'spine_01': ('chain', 'spine_1', 'spine_2', 'spine_1'),
        'spine_02': ('chain', 'spine_2', 'spine_3', 'spine_2'),
        'chest': ('chain', 'spine_3', 'spine_4', 'spine_3'),
        'neck': ('chain', 'spine_4', 'head', 'spine_5'),
        'head': ('delta', 'head'),
        'jaw': ('rel', 'mouth', 'head'),
        'tail_01': ('chain', 'tail_1', 'tail_2', 'tail_1'),
        'tail_02': ('chain', 'tail_2', 'tail_3', 'tail_2'),
        'tail_03': ('chain', 'tail_3', 'tail_tip', 'tail_3'),
        'leg_fl_upper': ('chain', 'front_leg_upper_l', 'front_leg_lower_l', 'front_leg_upper_l'),
        'leg_fl_lower': ('chain', 'front_leg_lower_l', 'front_leg_ankle_l', 'front_leg_lower_l'),
        'leg_fl_paw': ('delta', 'front_leg_foot_l'),
        'leg_fr_upper': ('chain', 'front_leg_upper_r', 'front_leg_lower_r', 'front_leg_upper_r'),
        'leg_fr_lower': ('chain', 'front_leg_lower_r', 'front_leg_ankle_r', 'front_leg_lower_r'),
        'leg_fr_paw': ('delta', 'front_leg_foot_r'),
        'leg_bl_upper': ('chain', 'back_leg_upper_l', 'back_leg_ankle_l', 'back_leg_upper_l'),
        'leg_bl_lower': ('chain', 'back_leg_ankle_l', 'back_leg_foot_l', 'back_leg_ankle_l'),
        'leg_bl_paw': ('delta', 'back_leg_foot_l'),
        'leg_br_upper': ('chain', 'back_leg_upper_r', 'back_leg_ankle_r', 'back_leg_upper_r'),
        'leg_br_lower': ('chain', 'back_leg_ankle_r', 'back_leg_foot_r', 'back_leg_ankle_r'),
        'leg_br_paw': ('delta', 'back_leg_foot_r'),
    }
    horse_rules = {
        'pelvis': ('delta', 'hips'),
        'spine_01': ('chain', 'spine_1', 'spine_2', 'spine_1'),
        'spine_02': ('chain', 'spine_2', 'spine_3', 'spine_2'),
        'chest': ('chain', 'spine_3', 'spine_4', 'spine_3'),
        'neck': ('chain', 'spine_4', 'head', 'spine_5'),
        'head': ('delta', 'head'),
        'jaw': ('rel', 'mouth', 'head'),
        'tail_01': ('chain', 'tail_1', 'tail_2', 'tail_1'),
        'tail_02': ('chain', 'tail_2', 'tail_3', 'tail_2'),
        'tail_03': ('chain', 'tail_3', 'tail_leaf', 'tail_3'),
        'leg_fl_upper': ('chain', 'front_leg_upper_l', 'front_leg_lower_l', 'front_leg_upper_l'),
        'leg_fl_lower': ('chain', 'front_leg_lower_l', 'front_leg_ankle_l', 'front_leg_lower_l'),
        'leg_fl_paw': ('delta', 'front_leg_foot_l'),
        'leg_fr_upper': ('chain', 'front_leg_upper_r', 'front_leg_lower_r', 'front_leg_upper_r'),
        'leg_fr_lower': ('chain', 'front_leg_lower_r', 'front_leg_ankle_r', 'front_leg_lower_r'),
        'leg_fr_paw': ('delta', 'front_leg_foot_r'),
        'leg_bl_upper': ('chain', 'back_leg_upper_l', 'back_leg_ankle_l', 'back_leg_upper_l'),
        'leg_bl_lower': ('chain', 'back_leg_ankle_l', 'back_leg_foot_l', 'back_leg_ankle_l'),
        'leg_bl_paw': ('delta', 'back_leg_foot_l'),
        'leg_br_upper': ('chain', 'back_leg_upper_r', 'back_leg_ankle_r', 'back_leg_upper_r'),
        'leg_br_lower': ('chain', 'back_leg_ankle_r', 'back_leg_foot_r', 'back_leg_ankle_r'),
        'leg_br_paw': ('delta', 'back_leg_foot_r'),
    }
    paws = ('leg_fl_paw', 'leg_fr_paw', 'leg_bl_paw', 'leg_br_paw')
    quad_clearance = {
        'pelvis': 0.17,
        'spine_01': 0.14,
        'spine_02': 0.16,
        'chest': 0.21,
        'neck': 0.12,
        'head': 0.11,
        'jaw': 0.06,
        'tail_01': 0.10,
        'tail_02': 0.08,
        'tail_03': 0.07,
    }
    q_id = Quaternion((1.0, 0.0, 0.0, 0.0))

    def adjust_quadruped(clip_name: str, tgt: CreatureSkeletonState, local_rot: dict[int, Quaternion]) -> None:
        # Keep the tail lifted clear of hind hocks/ankles across deep crouches, kicks, and rears.
        t01 = tgt.index['tail_01']
        t02 = tgt.index['tail_02']
        if clip_name == 'Sneak':
            local_rot[t01] = (_rot_xyz(58.0, 0.0, 0.0) @ q_id.slerp(local_rot[t01], 0.35)).normalized()
            local_rot[t02] = (_rot_xyz(18.0, 0.0, 0.0) @ q_id.slerp(local_rot[t02], 0.45)).normalized()
            for jn in ('leg_fl_lower', 'leg_fr_lower', 'leg_bl_lower', 'leg_br_lower'):
                idx = tgt.index[jn]
                local_rot[idx] = q_id.slerp(local_rot[idx], 0.62).normalized()
            for jn, sign in (('leg_bl_upper', 1.0), ('leg_br_upper', -1.0)):
                idx = tgt.index[jn]
                local_rot[idx] = (_rot_xyz(0.0, 0.0, sign * 15.0) @ q_id.slerp(local_rot[idx], 0.68)).normalized()
        elif clip_name == 'Kick':
            local_rot[t01] = (_rot_xyz(50.0, 0.0, 0.0) @ q_id.slerp(local_rot[t01], 0.40)).normalized()
            local_rot[t02] = (_rot_xyz(18.0, 0.0, 0.0) @ q_id.slerp(local_rot[t02], 0.50)).normalized()
            for jn in ('leg_bl_lower', 'leg_br_lower'):
                idx = tgt.index[jn]
                local_rot[idx] = q_id.slerp(local_rot[idx], 0.72).normalized()
        elif clip_name in ('Eating', 'Rear', 'Jump'):
            local_rot[t01] = (_rot_xyz(36.0, 0.0, 0.0) @ local_rot[t01]).normalized()
            local_rot[t02] = (_rot_xyz(14.0, 0.0, 0.0) @ local_rot[t02]).normalized()
        if clip_name == 'Trot':
            for jn in ('leg_fl_lower', 'leg_fr_lower'):
                idx = tgt.index[jn]
                local_rot[idx] = q_id.slerp(local_rot[idx], 0.80).normalized()
        elif clip_name == 'Swim':
            for jn in ('leg_fl_lower', 'leg_fr_lower'):
                idx = tgt.index[jn]
                local_rot[idx] = q_id.slerp(local_rot[idx], 0.65).normalized()
            for jn in ('leg_fl_upper', 'leg_fr_upper'):
                idx = tgt.index[jn]
                local_rot[idx] = q_id.slerp(local_rot[idx], 0.80).normalized()
        elif clip_name == 'Rear':
            for jn in ('leg_bl_lower', 'leg_br_lower'):
                idx = tgt.index[jn]
                local_rot[idx] = q_id.slerp(local_rot[idx], 0.72).normalized()
        if clip_name == 'Jump':
            for jn in ('leg_fl_upper', 'leg_fr_upper', 'leg_bl_upper', 'leg_br_upper'):
                idx = tgt.index[jn]
                local_rot[idx] = q_id.slerp(local_rot[idx], 0.65).normalized()
            for jn in ('leg_fl_lower', 'leg_fr_lower', 'leg_bl_lower', 'leg_br_lower'):
                idx = tgt.index[jn]
                local_rot[idx] = q_id.slerp(local_rot[idx], 0.62).normalized()
            local_rot[tgt.index['leg_fl_upper']] = (_rot_xyz(-8.0, 0.0, 10.0) @ local_rot[tgt.index['leg_fl_upper']]).normalized()
            local_rot[tgt.index['leg_fr_upper']] = (_rot_xyz(-8.0, 0.0, -10.0) @ local_rot[tgt.index['leg_fr_upper']]).normalized()
            local_rot[tgt.index['leg_bl_upper']] = (_rot_xyz(12.0, 0.0, 10.0) @ local_rot[tgt.index['leg_bl_upper']]).normalized()
            local_rot[tgt.index['leg_br_upper']] = (_rot_xyz(12.0, 0.0, -10.0) @ local_rot[tgt.index['leg_br_upper']]).normalized()
        elif clip_name == 'Kick':
            # Prevent left and right forelegs from scissoring inward across the midline during the kick wind-up.
            for jn, sign in (('leg_fl_upper', 1.0), ('leg_fr_upper', -1.0)):
                idx = tgt.index[jn]
                local_rot[idx] = (_rot_xyz(0.0, 0.0, sign * 12.0) @ q_id.slerp(local_rot[idx], 0.80)).normalized()
        elif clip_name == 'Sleep':
            # Relax the tight fox curl so paws and muzzle rest beside the ribcage without penetrating chest colliders.
            for jn in ('leg_fl_upper', 'leg_fr_upper', 'leg_bl_upper', 'leg_br_upper',
                       'leg_fl_lower', 'leg_fr_lower', 'leg_bl_lower', 'leg_br_lower'):
                idx = tgt.index[jn]
                local_rot[idx] = q_id.slerp(local_rot[idx], 0.55).normalized()
            local_rot[tgt.index['leg_fl_upper']] = (_rot_xyz(0.0, 0.0, 16.0) @ local_rot[tgt.index['leg_fl_upper']]).normalized()
            local_rot[tgt.index['leg_fr_upper']] = (_rot_xyz(0.0, 0.0, -16.0) @ local_rot[tgt.index['leg_fr_upper']]).normalized()
            local_rot[tgt.index['leg_bl_upper']] = (_rot_xyz(0.0, 0.0, 14.0) @ local_rot[tgt.index['leg_bl_upper']]).normalized()
            local_rot[tgt.index['leg_br_upper']] = (_rot_xyz(0.0, 0.0, -14.0) @ local_rot[tgt.index['leg_br_upper']]).normalized()
            for jn in ('neck', 'head', 'jaw'):
                idx = tgt.index[jn]
                local_rot[idx] = q_id.slerp(local_rot[idx], 0.55).normalized()
            local_rot[tgt.index['neck']] = (_rot_xyz(-10.0, 0.0, 0.0) @ local_rot[tgt.index['neck']]).normalized()

    fox_clips = retarget_m2m_clips(
        contract,
        creatures_dir / 'm2m-fox.glb',
        [
            ('Trot', 'Trot', True),
            ('Jump', 'Jump', False),
            ('Sit', 'Sit', False),
            ('Sleep', 'Sleep', True),
            ('Sneak', 'Sneak', True),
            ('Bite', 'Bite', False),
            ('Swim', 'Swim', True),
        ],
        fox_rules,
        src_pelvis_name='hips',
        ground_bones=paws,
        floor_clearances=quad_clearance,
        pose_adjust_fn=adjust_quadruped,
        fps=24.0,
    )
    horse_clips = retarget_m2m_clips(
        contract,
        creatures_dir / 'm2m-horse.glb',
        [
            ('Eating', 'Eating', False),
            ('Rear', 'Rear', False),
            ('Kick', 'Kick', False),
        ],
        horse_rules,
        src_pelvis_name='hips',
        ground_bones=paws,
        floor_clearances=quad_clearance,
        pose_adjust_fn=adjust_quadruped,
        fps=30.0,
    )
    return fox_clips + horse_clips


def build_retargeted_arachnid_clips(contract: dict, creatures_dir: Path) -> list[dict]:
    """Retarget CC0 spider clips onto the 28-joint arachnid rig."""
    rules = {
        'body': ('delta', 'spine_1'),
        'head': ('delta', 'head'),
        'abdomen': ('chain', 'hips', 'tail_tip', 'hips'),
    }
    for idx, letter in ((1, 'a'), (2, 'b'), (3, 'c'), (4, 'd')):
        for side in ('l', 'r'):
            rules[f'leg_{idx}_{side}_coxa'] = ('chain', f'leg_{letter}_1_{side}', f'leg_{letter}_2_{side}', f'leg_{letter}_1_{side}')
            rules[f'leg_{idx}_{side}_femur'] = ('chain', f'leg_{letter}_2_{side}', f'leg_{letter}_3_{side}', f'leg_{letter}_2_{side}')
            rules[f'leg_{idx}_{side}_tibia'] = ('chain', f'leg_{letter}_3_{side}', f'leg_{letter}_tip_{side}', f'leg_{letter}_3_{side}')

    q_id = Quaternion((1.0, 0.0, 0.0, 0.0))

    def adjust_arachnid(clip_name: str, tgt: CreatureSkeletonState, local_rot: dict[int, Quaternion]) -> None:
        # Scale thick chitin leg swing slightly so adjacent legs and abdomen never intersect during Jump/Bite/Eating.
        damp = 0.56 if clip_name in ('Jump', 'Bite') else 0.72 if clip_name == 'Eating' else 0.85
        for jn in tgt.names:
            if jn.startswith('leg_'):
                idx = tgt.index[jn]
                local_rot[idx] = q_id.slerp(local_rot[idx], damp).normalized()
        if clip_name in ('Jump', 'Bite', 'Eating'):
            ab = tgt.index['abdomen']
            local_rot[ab] = (_rot_xyz(12.0, 0.0, 0.0) @ q_id.slerp(local_rot[ab], 0.75)).normalized()

    return retarget_m2m_clips(
        contract,
        creatures_dir / 'm2m-spider.glb',
        [
            ('Threat', 'Threat', True),
            ('Jump', 'Jump', False),
            ('Bite', 'Bite', False),
            ('Eating', 'Eating', True),
        ],
        rules,
        src_pelvis_name='spine_1',
        ground_bones=('body', 'head', 'abdomen'),
        ground_margin=0.14,
        y_scale=1.6,
        xz_scale=0.65,
        pose_adjust_fn=adjust_arachnid,
        fps=24.0,
    )


def build_retargeted_avian_clips(contract: dict, creatures_dir: Path) -> list[dict]:
    rules = {
        'pelvis': ('delta', 'hips'),
        'spine_01': ('chain', 'spine_0', 'spine_1', 'spine_0'),
        'chest': ('chain', 'spine_1', 'spine_3', 'spine_1'),
        'neck': ('chain', 'spine_3', 'head', 'spine_3'),
        'head': ('delta', 'head'),
        'jaw': ('rel', 'mouth_lower', 'head'),
        'tail_01': ('chain', 'tail_1', 'tail_2', 'tail_1'),
        'tail_02': ('chain', 'tail_2', 'tail_tip', 'tail_2'),
        'wing_upper_l': ('chain', 'wing_1_L', 'wing_3_L', 'wing_1_L'),
        'wing_mid_l': ('chain', 'wing_3_L', 'wing_4_L', 'wing_3_L'),
        'wing_tip_l': ('chain', 'wing_4_L', 'wing_tip_L', 'wing_4_L'),
        'wing_upper_r': ('chain', 'wing_1_R', 'wing_3_R', 'wing_1_R'),
        'wing_mid_r': ('chain', 'wing_3_R', 'wing_4_R', 'wing_3_R'),
        'wing_tip_r': ('chain', 'wing_4_R', 'wing_tip_R', 'wing_4_R'),
        'leg_upper_l': ('chain', 'UpperLeg_L', 'AnkleLeg_L', 'UpperLeg_L'),
        'leg_lower_l': ('chain', 'AnkleLeg_L', 'Foot_L', 'AnkleLeg_L'),
        'foot_l': ('delta', 'Foot_L'),
        'leg_upper_r': ('chain', 'UpperLeg_R', 'AnkleLeg_R', 'UpperLeg_R'),
        'leg_lower_r': ('chain', 'AnkleLeg_R', 'Foot_R', 'AnkleLeg_R'),
        'foot_r': ('delta', 'Foot_R'),
    }
    q_id = Quaternion((1.0, 0.0, 0.0, 0.0))

    def adjust_avian(clip_name: str, tgt: CreatureSkeletonState, local_rot: dict[int, Quaternion]) -> None:
        if clip_name in ('Idle', 'Hop', 'Land'):
            for side, sign in (('l', 1.0), ('r', -1.0)):
                wu = tgt.index[f'wing_upper_{side}']
                local_rot[wu] = (_rot_xyz(0.0, sign * -6.0, sign * 10.0) @ local_rot[wu]).normalized()
        elif clip_name == 'Death':
            for jn in ('leg_upper_l', 'leg_upper_r', 'leg_lower_l', 'leg_lower_r', 'foot_l', 'foot_r'):
                idx = tgt.index[jn]
                local_rot[idx] = q_id.slerp(local_rot[idx], 0.30).normalized()
            local_rot[tgt.index['leg_upper_l']] = (_rot_xyz(-18.0, 0.0, 14.0) @ local_rot[tgt.index['leg_upper_l']]).normalized()
            local_rot[tgt.index['leg_upper_r']] = (_rot_xyz(-18.0, 0.0, -14.0) @ local_rot[tgt.index['leg_upper_r']]).normalized()
            local_rot[tgt.index['wing_upper_l']] = (_rot_xyz(0.0, 0.0, 16.0) @ local_rot[tgt.index['wing_upper_l']]).normalized()

    return retarget_m2m_clips(
        contract,
        creatures_dir / 'm2m-bird.glb',
        [
            ('Idle', 'Idle', True),
            ('Walk', 'Walk', True),
            ('Hop', 'Hop', True),
            ('Take_Off', 'Take_Off', False),
            ('Flap', 'Flap', True),
            ('Glide', 'Glide', True),
            ('Land', 'Land', False),
            ('Death', 'Death', False),
        ],
        rules,
        src_pelvis_name='hips',
        ground_bones=('foot_l', 'foot_r'),
        floor_clearances={
            'pelvis': 0.11,
            'spine_01': 0.11,
            'chest': 0.13,
            'neck': 0.08,
            'head': 0.08,
            'jaw': 0.05,
            'wing_upper_l': 0.07,
            'wing_upper_r': 0.07,
            'wing_mid_l': 0.06,
            'wing_mid_r': 0.06,
            'wing_tip_l': 0.05,
            'wing_tip_r': 0.05,
            'tail_01': 0.06,
            'tail_02': 0.05,
        },
        pose_adjust_fn=adjust_avian,
        fps=24.0,
    )


def build_retargeted_dragon_clips(contract: dict, creatures_dir: Path) -> list[dict]:
    rules = {
        'pelvis': ('delta', 'hips'),
        'spine_01': ('chain', 'spine_0', 'spine_1', 'spine_0'),
        'chest': ('chain', 'spine_1', 'spine_2', 'spine_1'),
        'neck': ('chain', 'spine_2', 'head', 'spine_3'),
        'head': ('delta', 'head'),
        'jaw': ('rel', 'mouth_lower', 'head'),
        'tail_01': ('chain', 'tail_1', 'tail_2', 'tail_1'),
        'tail_02': ('chain', 'tail_2', 'tail_4', 'tail_2'),
        'tail_03': ('chain', 'tail_4', 'tail_tip', 'tail_5'),
        'wing_upper_l': ('chain', 'wing_1_l', 'wing_3_l', 'wing_1_l'),
        'wing_mid_l': ('chain', 'wing_3_l', 'wing_4_l', 'wing_3_l'),
        'wing_tip_l': ('chain', 'wing_4_l', 'wing_tip_l', 'wing_4_l'),
        'wing_upper_r': ('chain', 'wing_1_r', 'wing_3_r', 'wing_1_r'),
        'wing_mid_r': ('chain', 'wing_3_r', 'wing_4_r', 'wing_3_r'),
        'wing_tip_r': ('chain', 'wing_4_r', 'wing_tip_r', 'wing_4_r'),
        'foreleg_upper_l': ('chain', 'front_leg_l', 'front_ankle_l', 'front_leg_l'),
        'foreleg_lower_l': ('chain', 'front_ankle_l', 'front_foot_l', 'front_ankle_l'),
        'foreleg_foot_l': ('delta', 'front_toes_l'),
        'foreleg_upper_r': ('chain', 'front_leg_r', 'front_ankle_r', 'front_leg_r'),
        'foreleg_lower_r': ('chain', 'front_ankle_r', 'front_foot_r', 'front_ankle_r'),
        'foreleg_foot_r': ('delta', 'front_toes_r'),
        'hindleg_upper_l': ('chain', 'back_leg_l', 'back_ankle_l', 'back_leg_l'),
        'hindleg_lower_l': ('chain', 'back_ankle_l', 'back_foot_l', 'back_ankle_l'),
        'hindleg_foot_l': ('delta', 'back_toes_l'),
        'hindleg_upper_r': ('chain', 'back_leg_r', 'back_ankle_r', 'back_leg_r'),
        'hindleg_lower_r': ('chain', 'back_ankle_r', 'back_foot_r', 'back_ankle_r'),
        'hindleg_foot_r': ('delta', 'back_toes_r'),
    }
    q_id = Quaternion((1.0, 0.0, 0.0, 0.0))

    def adjust_dragon(clip_name: str, tgt: CreatureSkeletonState, local_rot: dict[int, Quaternion]) -> None:
        # Dragon target rig has closer fore-to-hind spacing (0.60m vs 0.89m in source).
        # Separate forelegs forward and hindlegs aft so right-side claws never overlap, while keeping wings clear of shoulders.
        leg_damp = 0.45 if clip_name == 'Death' else 0.55 if clip_name == 'Take_Off' else 0.72
        for jn in ('foreleg_upper_l', 'foreleg_upper_r', 'foreleg_lower_l', 'foreleg_lower_r',
                   'hindleg_upper_l', 'hindleg_upper_r', 'hindleg_lower_l', 'hindleg_lower_r'):
            idx = tgt.index[jn]
            local_rot[idx] = q_id.slerp(local_rot[idx], leg_damp).normalized()

        if clip_name not in ('Fly_Flap', 'Fly_Glide'):
            for side, sign in (('l', 1.0), ('r', -1.0)):
                fu = tgt.index[f'foreleg_upper_{side}']
                fl = tgt.index[f'foreleg_lower_{side}']
                hu = tgt.index[f'hindleg_upper_{side}']
                hl = tgt.index[f'hindleg_lower_{side}']
                splay = 12.0 if clip_name == 'Death' else 4.0
                # Spread foreleg slightly forward and hindleg aft/outward so talons and shoulders clear cleanly.
                local_rot[fu] = (_rot_xyz(-8.0, 0.0, sign * -3.0) @ local_rot[fu]).normalized()
                local_rot[fl] = (_rot_xyz(8.0, 0.0, 0.0) @ local_rot[fl]).normalized()
                local_rot[hu] = (_rot_xyz(14.0, 0.0, sign * splay) @ local_rot[hu]).normalized()
                local_rot[hl] = (_rot_xyz(-14.0, 0.0, 0.0) @ local_rot[hl]).normalized()

        if clip_name == 'Death':
            for jn in ('wing_upper_l', 'wing_upper_r', 'wing_mid_l', 'wing_mid_r', 'wing_tip_l', 'wing_tip_r'):
                idx = tgt.index[jn]
                local_rot[idx] = q_id.slerp(local_rot[idx], 0.35).normalized()

        if clip_name in ('Take_Off', 'Land', 'Walk', 'Death'):
            # Lift wing roots upward (+Z left / -Z right) and sweep backward (+Y left / -Y right) away from foreleg shoulders.
            for side, sign in (('l', 1.0), ('r', -1.0)):
                wu = tgt.index[f'wing_upper_{side}']
                local_rot[wu] = (_rot_xyz(0.0, sign * 16.0, sign * 18.0) @ local_rot[wu]).normalized()

    return retarget_m2m_clips(
        contract,
        creatures_dir / 'm2m-dragon.glb',
        [
            ('Idle', 'Idle', True),
            ('Walk', 'Walk', True),
            ('Attack', 'Attack', False),
            ('Fire_Breath', 'Fire_Breath', False),
            ('Roar', 'Roar', False),
            ('Take_Off', 'Take_Off', False),
            ('Fly_Flap', 'Fly Flap', True),
            ('Fly_Glide', 'Fly Glide', True),
            ('Land', 'Land', False),
            ('Hurt', 'Hurt', False),
            ('Death', 'Death', False),
        ],
        rules,
        src_pelvis_name='hips',
        ground_bones=('foreleg_foot_l', 'foreleg_foot_r', 'hindleg_foot_l', 'hindleg_foot_r'),
        floor_clearances={
            'pelvis': 0.16,
            'spine_01': 0.15,
            'chest': 0.18,
            'neck': 0.11,
            'head': 0.10,
            'jaw': 0.06,
            'tail_01': 0.10,
            'tail_02': 0.08,
            'tail_03': 0.06,
            'wing_upper_l': 0.09,
            'wing_upper_r': 0.09,
            'wing_mid_l': 0.06,
            'wing_mid_r': 0.06,
            'wing_tip_l': 0.05,
            'wing_tip_r': 0.05,
        },
        xz_scale=0.55,
        pose_adjust_fn=adjust_dragon,
        fps=24.0,
    )


def build_retargeted_kaiju_clips(contract: dict, creatures_dir: Path) -> list[dict]:
    rules = {
        'pelvis': ('delta', 'hips'),
        'spine_01': ('chain', 'spine_1', 'spine_2', 'spine_1'),
        'chest': ('chain', 'spine_2', 'spine_3', 'spine_2'),
        'neck': ('chain', 'spine_3', 'head', 'spine_4'),
        'head': ('delta', 'head'),
        'jaw': ('rel', 'mouth', 'head'),
        'tail_01': ('chain', 'tail_1', 'tail_2', 'tail_1'),
        'tail_02': ('chain', 'tail_2', 'tail_4', 'tail_2'),
        'tail_03': ('chain', 'tail_4', 'tail_tip', 'tail_5'),
        'arm_upper_l': ('chain', 'front_leg_upper_l', 'front_leg_lower_l', 'front_leg_upper_l'),
        'arm_lower_l': ('chain', 'front_leg_lower_l', 'hand_l', 'front_leg_lower_l'),
        'hand_l': ('delta', 'hand_l'),
        'arm_upper_r': ('chain', 'front_leg_upper_r', 'front_leg_lower_r', 'front_leg_upper_r'),
        'arm_lower_r': ('chain', 'front_leg_lower_r', 'hand_r', 'front_leg_lower_r'),
        'hand_r': ('delta', 'hand_r'),
        'leg_upper_l': ('chain', 'back_leg_upper_l', 'back_leg_ankle_l', 'back_leg_upper_l'),
        'leg_lower_l': ('chain', 'back_leg_ankle_l', 'back_leg_foot_l', 'back_leg_ankle_l'),
        'foot_l': ('delta', 'back_leg_foot_l'),
        'leg_upper_r': ('chain', 'back_leg_upper_r', 'back_leg_ankle_r', 'back_leg_upper_r'),
        'leg_lower_r': ('chain', 'back_leg_ankle_r', 'back_leg_foot_r', 'back_leg_ankle_r'),
        'foot_r': ('delta', 'back_leg_foot_r'),
    }
    q_id = Quaternion((1.0, 0.0, 0.0, 0.0))

    def adjust_kaiju(clip_name: str, tgt: CreatureSkeletonState, local_rot: dict[int, Quaternion]) -> None:
        if clip_name != 'Death':
            t01 = tgt.index['tail_01']
            t02 = tgt.index['tail_02']
            local_rot[t01] = (_rot_xyz(14.0, 0.0, 0.0) @ local_rot[t01]).normalized()
            local_rot[t02] = (_rot_xyz(8.0, 0.0, 0.0) @ local_rot[t02]).normalized()

    return retarget_m2m_clips(
        contract,
        creatures_dir / 'm2m-kaiju.glb',
        [
            ('Idle', 'Idle', True),
            ('Walk', 'Walk', True),
            ('Attack', 'Attack', False),
            ('Tail_Attack', 'Tail Attack', False),
            ('Roar', 'Roar', False),
            ('Hit', 'Hit', False),
            ('Swim', 'Swim', True),
            ('Death', 'Death', False),
        ],
        rules,
        src_pelvis_name='hips',
        ground_bones=('foot_l', 'foot_r'),
        hover_clips={'Death'},
        ground_snap_clips={'Walk'},
        floor_clearances={
            'pelvis': 0.14,
            'spine_01': 0.14,
            'chest': 0.14,
            'neck': 0.10,
            'head': 0.10,
            'jaw': 0.06,
            'tail_01': 0.10,
            'tail_02': 0.08,
            'tail_03': 0.06,
            'hand_l': 0.05,
            'hand_r': 0.05,
        },
        pose_adjust_fn=adjust_kaiju,
        fps=30.0,
    )


def build_retargeted_serpent_clips(contract: dict, creatures_dir: Path) -> list[dict]:
    rules = {
        'pelvis': ('delta', 'tail02'),
        'neck': ('chain', 'tail02', 'head', 'neck'),
        'head': ('delta', 'head'),
        'jaw': ('rel', 'mouth', 'head'),
        'spine_01': ('chain', 'tail02', 'tail05', 'tail03'),
        'spine_02': ('chain', 'tail05', 'tail08', 'tail06'),
        'tail_01': ('chain', 'tail08', 'tail11', 'tail09'),
        'tail_02': ('chain', 'tail11', 'tail14', 'tail12'),
        'tail_03': ('chain', 'tail14', 'tail17', 'tail15'),
        'tail_04': ('chain', 'tail17', 'tail20', 'tail18'),
        'tail_tip': ('chain', 'tail20', 'tail_tip', 'tail20'),
    }
    q_id = Quaternion((1.0, 0.0, 0.0, 0.0))

    def adjust_serpent(clip_name: str, tgt: CreatureSkeletonState, local_rot: dict[int, Quaternion]) -> None:
        if clip_name == 'Coiled':
            for jn in ('tail_01', 'tail_02', 'tail_03', 'tail_04', 'tail_tip'):
                idx = tgt.index[jn]
                local_rot[idx] = q_id.slerp(local_rot[idx], 0.70).normalized()
        elif clip_name == 'Hit':
            for jn in ('neck', 'head', 'jaw'):
                idx = tgt.index[jn]
                local_rot[idx] = q_id.slerp(local_rot[idx], 0.68).normalized()

    return retarget_m2m_clips(
        contract,
        creatures_dir / 'm2m-snake.glb',
        [
            ('Idle', 'Idle', True),
            ('Coiled', 'Coiled', True),
            ('Sidewinding', 'Side winding', True),
            ('Bite', 'Bite', False),
            ('Dance', 'Dance', True),
            ('Hit', 'Hit', False),
            ('Death', 'Death', False),
        ],
        rules,
        src_pelvis_name='tail02',
        ground_bones=('pelvis', 'spine_01', 'spine_02', 'tail_01', 'tail_02', 'tail_03', 'tail_04', 'tail_tip', 'head'),
        ground_margin=0.0,
        floor_clearances={
            'pelvis': 0.08,
            'head': 0.06,
            'jaw': 0.04,
            'spine_01': 0.075,
            'spine_02': 0.072,
            'tail_01': 0.068,
            'tail_02': 0.064,
            'tail_03': 0.060,
            'tail_04': 0.056,
            'tail_tip': 0.044,
        },
        y_scale=0.55,
        xz_scale=0.55,
        pose_adjust_fn=adjust_serpent,
        fps=24.0,
    )


def build_retargeted_aquatic_clips(contract: dict, creatures_dir: Path) -> list[dict]:
    rules = {
        'pelvis': ('delta', 'pelvis'),
        'neck': ('chain', 'pelvis', 'neck', 'neck'),
        'head': ('delta', 'head'),
        'jaw': ('rel', 'mouth_1', 'head'),
        'spine_01': ('chain', 'pelvis', 'tail_2', 'tail_1'),
        'tail_01': ('chain', 'tail_2', 'tail_4', 'tail_3'),
        'tail_02': ('chain', 'tail_4', 'tail_6', 'tail_5'),
        'tail_fin': ('chain', 'tail_6', 'tail_tip', 'tail_7'),
        'fin_l': ('chain', 'front_fin_1_l', 'front_fin_tip_l', 'front_fin_1_l'),
        'fin_r': ('chain', 'front_fin_1_r', 'front_fin_tip_r', 'front_fin_1_r'),
        'pelvic_fin_l': ('chain', 'back_fin_1_l', 'back_fin_tip_l', 'back_fin_1_l'),
        'pelvic_fin_r': ('chain', 'back_fin_1_r', 'back_fin_tip_r', 'back_fin_1_r'),
    }
    return retarget_m2m_clips(
        contract,
        creatures_dir / 'm2m-shark.glb',
        [
            ('Idle', 'Idle', True),
            ('Swim_Horizontal', 'Swim Horizontal', True),
            ('Swim_Vertical', 'Swim Vertical', True),
            ('Bite', 'Bite', False),
            ('Hit', 'Hit', False),
            ('Dead_Floating', 'Dead Floating', False),
        ],
        rules,
        src_pelvis_name='pelvis',
        ground_bones=('fin_l', 'fin_r', 'pelvis', 'tail_fin'),
        ground_margin=0.06,
        y_scale=0.55,
        xz_scale=0.55,
        fps=24.0,
    )


def clamp_clips_to_floor(
    clips: list[dict],
    meshes: list,
    contract: dict,
    *,
    min_floor_y: float = -0.005,
    skip_clips: set[str] | None = None,
    settle_clips: set[str] | None = None,
) -> list[dict]:
    """Lift pelvis/body translation.y on any clip frame where posed mesh vertices drop below `min_floor_y`,
    and lower pelvis/body translation.y on `settle_clips` when vertices float above `y = 0`."""
    names = list(contract['joints'])
    parents = contract['parents']
    n_joints = len(names)
    rest = np.array([contract['worldPositions'][n] for n in names], dtype=np.float64)
    parent_idx = [names.index(parents[n]) if parents[n] is not None else -1 for n in names]
    pelvis_name = 'body' if 'body' in names else 'pelvis'
    pelvis_idx = names.index(pelvis_name)
    rest_local_p = rest[pelvis_idx] - rest[parent_idx[pelvis_idx]]
    skip = skip_clips or set()
    settle = settle_clips or set()

    for clip in clips:
        if clip['name'] in skip:
            continue
        is_settle = clip['name'] in settle
        n_frames = len(clip['times'])
        if n_frames == 0:
            continue
        tracks = clip['tracks']
        existing_tr = tracks.get(pelvis_name, {}).get('translation')
        lifts = np.zeros(n_frames, dtype=np.float64)

        for f in range(n_frames):
            rotation = np.zeros((n_joints, 3, 3), dtype=np.float64)
            position = np.zeros((n_joints, 3), dtype=np.float64)
            for j, jname in enumerate(names):
                j_tr = tracks.get(jname, {})
                local = np.eye(3, dtype=np.float64)
                if 'rotation' in j_tr:
                    x, y, z, w = j_tr['rotation'][f]
                    local = np.array([
                        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
                    ], dtype=np.float64)
                p = parent_idx[j]
                if p < 0:
                    rotation[j] = local
                    position[j] = rest[j]
                else:
                    offset = np.array(j_tr['translation'][f], dtype=np.float64) if 'translation' in j_tr else (rest[j] - rest[p])
                    rotation[j] = rotation[p] @ local
                    position[j] = position[p] + rotation[p] @ offset

            min_y = float('inf')
            for mesh in meshes:
                posed_y = np.zeros(len(mesh.positions), dtype=np.float64)
                for slot in range(4):
                    js = mesh.joints[:, slot]
                    ws = mesh.weights[:, slot]
                    rel = mesh.positions - rest[js]
                    moved_y = np.einsum('vj,vj->v', rotation[js, 1, :], rel) + position[js, 1]
                    posed_y += moved_y * ws
                m_min = float(posed_y.min())
                if m_min < min_y:
                    min_y = m_min
            if min_y < min_floor_y:
                lifts[f] = min_floor_y - min_y
            elif is_settle and min_y > 0.002:
                lifts[f] = -min_y

        if np.max(np.abs(lifts)) > 1e-4:
            if existing_tr is not None:
                arr = np.asarray(existing_tr, dtype=np.float32)
            else:
                arr = np.tile(rest_local_p.astype(np.float32), (n_frames, 1))
            arr[:, 1] += lifts.astype(np.float32)
            tracks.setdefault(pelvis_name, {})['translation'] = arr.tolist()

    return clips




