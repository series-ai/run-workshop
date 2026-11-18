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
                pouch_target = shoulder_l + Vector((0.125, -0.385, -0.005))
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

            clav_q = src_q[clav_l_si]
            local_rot[ul_idx] = (clav_q.inverted() @ q_ul).normalized()
            local_rot[ll_idx] = (q_ul.inverted() @ q_ll).normalized()
            local_rot[hl_idx] = (q_ll.inverted() @ q_hl).normalized()

            frame_rots.append(local_rot)
            frame_pelvis.append(p_local)

        out_clips.append(_pack_clip_tracks(u1, clip_name, times, frame_rots, frame_pelvis))

    return out_clips

