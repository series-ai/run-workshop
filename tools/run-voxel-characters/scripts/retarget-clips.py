#!/usr/bin/env python3
"""Retarget CC0 animation clips from Quaternius UAL2 and KayKit Rig_Medium onto UAL1 53-joint base.

Produces animation-only GLBs in assets/source/ that `build_core.py` merges into core-rig.glb:
  - assets/source/ual2-clips.glb       (42 Quaternius Universal Animation Library 2 clips)
  - assets/source/kaykit-2h-clips.glb  (10 KayKit Rig_Medium two-handed Melee_2H_* + Ranged_2H_* clips)
"""

from __future__ import annotations

import argparse
import json
import struct
from pathlib import Path
import numpy as np

TOOL_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_UAL1 = TOOL_ROOT / 'assets/source/ual1-base.glb'
DEFAULT_OUT_DIR = TOOL_ROOT / 'assets/source'
DEFAULT_JRA = Path.home() / 'dev/jam-ready-assets-cubix'

FINGER_PREFIXES = ('thumb_', 'index_', 'middle_', 'ring_', 'pinky_')


def read_glb(path: Path):
    data = path.read_bytes()
    jlen = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + jlen])
    bin_off = 20 + jlen + 8
    return doc, data[bin_off:]


def read_acc(doc, bin_data, idx):
    acc = doc['accessors'][idx]
    bv = doc['bufferViews'][acc['bufferView']]
    off = bv.get('byteOffset', 0) + acc.get('byteOffset', 0)
    stride = bv.get('byteStride', 0)
    dt = {5126: np.float32, 5123: np.uint16, 5121: np.uint8, 5125: np.uint32}[acc['componentType']]
    cnt = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[acc['type']]
    item_bytes = np.dtype(dt).itemsize * cnt
    if stride and stride != item_bytes:
        out = np.zeros((acc['count'], cnt), dtype=dt)
        for i in range(acc['count']):
            out[i] = np.frombuffer(bin_data, dtype=dt, count=cnt, offset=off + i * stride)
        return out if cnt > 1 else out[:, 0]
    arr = np.frombuffer(bin_data, dtype=dt, count=acc['count'] * cnt, offset=off)
    return arr.reshape(acc['count'], cnt) if cnt > 1 else arr


def q_to_mat(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ], dtype=np.float64)


def mat_to_q(R):
    tr = R[0, 0] + R[1, 1] + R[2, 2]
    if tr > 0:
        s = 2.0 * np.sqrt(tr + 1.0)
        w = 0.25 * s
        x = (R[2, 1] - R[1, 2]) / s
        y = (R[0, 2] - R[2, 0]) / s
        z = (R[1, 0] - R[0, 1]) / s
    elif R[0, 0] > R[1, 1] and R[0, 0] > R[2, 2]:
        s = 2.0 * np.sqrt(1.0 + R[0, 0] - R[1, 1] - R[2, 2])
        w = (R[2, 1] - R[1, 2]) / s
        x = 0.25 * s
        y = (R[0, 1] + R[1, 0]) / s
        z = (R[0, 2] + R[2, 0]) / s
    elif R[1, 1] > R[2, 2]:
        s = 2.0 * np.sqrt(1.0 + R[1, 1] - R[0, 0] - R[2, 2])
        w = (R[0, 2] - R[2, 0]) / s
        x = (R[0, 1] + R[1, 0]) / s
        y = 0.25 * s
        z = (R[1, 2] + R[2, 1]) / s
    else:
        s = 2.0 * np.sqrt(1.0 + R[2, 2] - R[0, 0] - R[1, 1])
        w = (R[1, 0] - R[0, 1]) / s
        x = (R[0, 2] + R[2, 0]) / s
        y = (R[1, 2] + R[2, 1]) / s
        z = 0.25 * s
    q = np.array([x, y, z, w], dtype=np.float64)
    return q / np.linalg.norm(q)


def slerp_q(q0, q1, alpha):
    if np.dot(q0, q1) < 0:
        q1 = -q1
    dot = float(np.clip(np.dot(q0, q1), -1.0, 1.0))
    if dot > 0.9995:
        q = q0 + alpha * (q1 - q0)
        return q / np.linalg.norm(q)
    theta0 = np.arccos(dot)
    theta = theta0 * alpha
    q2 = q1 - q0 * dot
    q2 = q2 / np.linalg.norm(q2)
    return np.cos(theta) * q0 + np.sin(theta) * q2


def build_skeleton_info(doc):
    nodes = doc['nodes']
    parent = {i: None for i in range(len(nodes))}
    for i, nd in enumerate(nodes):
        for c in nd.get('children', []):
            parent[c] = i
    name_to_idx = {nd['name']: i for i, nd in enumerate(nodes) if 'name' in nd}
    rest_t = [np.array(nd.get('translation', [0, 0, 0]), dtype=np.float64) for nd in nodes]
    rest_q = [np.array(nd.get('rotation', [0, 0, 0, 1]), dtype=np.float64) for nd in nodes]

    rest_world_R = {}
    rest_world_p = {}

    def calc_rest(i):
        if i in rest_world_R:
            return rest_world_R[i], rest_world_p[i]
        Rl = q_to_mat(rest_q[i])
        tl = rest_t[i]
        if parent[i] is None:
            Rw, pw = Rl, tl
        else:
            Rp, pp = calc_rest(parent[i])
            Rw = Rp @ Rl
            pw = pp + Rp @ tl
        rest_world_R[i], rest_world_p[i] = Rw, pw
        return Rw, pw

    for i in range(len(nodes)):
        calc_rest(i)

    return {
        'nodes': nodes,
        'parent': parent,
        'name_to_idx': name_to_idx,
        'rest_t': rest_t,
        'rest_q': rest_q,
        'rest_world_R': rest_world_R,
        'rest_world_p': rest_world_p,
    }


def sample_clip_at_times(doc, bin_data, skel, anim, times):
    chans = []
    for ch in anim['channels']:
        s = anim['samplers'][ch['sampler']]
        inp = read_acc(doc, bin_data, s['input']).astype(np.float64)
        out = read_acc(doc, bin_data, s['output']).astype(np.float64)
        chans.append((ch['target']['node'], ch['target']['path'], inp, out))

    frames = []
    for t in times:
        loc_t = [x.copy() for x in skel['rest_t']]
        loc_q = [x.copy() for x in skel['rest_q']]
        for ni, path, inp, out in chans:
            if path == 'scale':
                continue
            if t <= inp[0]:
                val = out[0]
            elif t >= inp[-1]:
                val = out[-1]
            else:
                idx = int(np.searchsorted(inp, t, side='right')) - 1
                t0, t1 = inp[idx], inp[idx + 1]
                alpha = (t - t0) / (t1 - t0) if t1 > t0 else 0.0
                if path == 'rotation':
                    val = slerp_q(out[idx], out[idx + 1], alpha)
                else:
                    val = out[idx] * (1.0 - alpha) + out[idx + 1] * alpha
            if path == 'translation':
                loc_t[ni] = val
            elif path == 'rotation':
                loc_q[ni] = val

        world_R = {}
        world_p = {}

        def calc_pose(i):
            if i in world_R:
                return world_R[i], world_p[i]
            Rl = q_to_mat(loc_q[i])
            tl = loc_t[i]
            p = skel['parent'][i]
            if p is None:
                Rw, pw = Rl, tl
            else:
                Rp, pp = calc_pose(p)
                Rw = Rp @ Rl
                pw = pp + Rp @ tl
            world_R[i], world_p[i] = Rw, pw
            return Rw, pw

        for i in range(len(skel['nodes'])):
            calc_pose(i)
        frames.append((loc_t, loc_q, world_R, world_p))
    return frames


def extract_grip_finger_pose(doc, bin_data, skel, clip_name='Idle_Loop'):
    """Sample frame 0 local rotations for UAL1 finger joints from a closed-grip clip."""
    anim = next(a for a in doc['animations'] if a['name'] == clip_name)
    _, loc_q, _, _ = sample_clip_at_times(doc, bin_data, skel, anim, [0.0])[0]
    out = {}
    for name, idx in skel['name_to_idx'].items():
        if name.startswith(FINGER_PREFIXES):
            out[name] = loc_q[idx].copy()
    return out


def retarget_clip(
    src_doc, src_bin, src_skel, tgt_skel, tgt_joints, anim, bone_map, root_scale,
    *, ground_feet=False, local_rot_overrides=None,
):
    all_times = set()
    for ch in anim['channels']:
        inp = read_acc(src_doc, src_bin, anim['samplers'][ch['sampler']]['input'])
        for t in inp:
            all_times.add(round(float(t), 6))
    times = np.array(sorted(all_times), dtype=np.float32)
    frames = sample_clip_at_times(src_doc, src_bin, src_skel, anim, times)

    tgt_idx = tgt_skel['name_to_idx']
    ordered_tgt = list(tgt_joints)
    tgt_sole_offsets = {
        'foot_l': tgt_skel['rest_world_p'][tgt_idx['foot_l']][1],
        'foot_r': tgt_skel['rest_world_p'][tgt_idx['foot_r']][1],
        'ball_l': tgt_skel['rest_world_p'][tgt_idx['ball_l']][1],
        'ball_r': tgt_skel['rest_world_p'][tgt_idx['ball_r']][1],
    }

    pelvis_tgt_i = tgt_idx['pelvis']
    pelvis_src_i = src_skel['name_to_idx'][bone_map['pelvis']]
    pelvis_src_rest_pos = src_skel['rest_world_p'][pelvis_src_i]

    rot_tracks = {j: [] for j in ordered_tgt}
    pelvis_trans = []
    prev_q = {}

    for _loc_t, _loc_q, src_wR, src_wp in frames:
        tgt_wR = {}
        tgt_wp = {}
        src_pel_wpos = src_wp[pelvis_src_i]
        pel_delta = (src_pel_wpos - pelvis_src_rest_pos) * root_scale
        pel_pos = tgt_skel['rest_world_p'][pelvis_tgt_i] + pel_delta

        for jname in ordered_tgt:
            ti = tgt_idx[jname]
            pi = tgt_skel['parent'][ti]
            Rp = tgt_wR[pi] if (pi is not None and pi in tgt_wR) else (tgt_skel['rest_world_R'][pi] if pi is not None else np.eye(3))
            pp = tgt_wp[pi] if (pi is not None and pi in tgt_wp) else (tgt_skel['rest_world_p'][pi] if pi is not None else np.zeros(3))
            src_name = bone_map.get(jname)
            if src_name is not None:
                si = src_skel['name_to_idx'][src_name]
                delta_wR = src_wR[si] @ src_skel['rest_world_R'][si].T
                wR = delta_wR @ tgt_skel['rest_world_R'][ti]
                locR = Rp.T @ wR
                q = mat_to_q(locR)
            elif local_rot_overrides and jname in local_rot_overrides:
                q = local_rot_overrides[jname].copy()
                wR = Rp @ q_to_mat(q)
            else:
                q = tgt_skel['rest_q'][ti].copy()
                wR = Rp @ q_to_mat(q)

            tgt_wR[ti] = wR
            if jname == 'pelvis':
                tgt_wp[ti] = pel_pos
            else:
                tgt_wp[ti] = pp + Rp @ tgt_skel['rest_t'][ti]

            if jname in prev_q and np.dot(q, prev_q[jname]) < 0:
                q = -q
            prev_q[jname] = q
            rot_tracks[jname].append(q)

        if ground_feet:
            src_foot_l_y = src_wp[src_skel['name_to_idx'][bone_map['foot_l']]][1]
            src_foot_r_y = src_wp[src_skel['name_to_idx'][bone_map['foot_r']]][1]
            src_foot_rest_y = src_skel['rest_world_p'][src_skel['name_to_idx'][bone_map['foot_l']]][1]
            desired_foot_lift = max(0.0, min(src_foot_l_y, src_foot_r_y) - src_foot_rest_y) * root_scale
            sole_ys = [tgt_wp[tgt_idx[k]][1] - tgt_sole_offsets[k] for k in tgt_sole_offsets]
            min_sole_y = min(sole_ys)
            pel_pos = pel_pos + np.array([0.0, desired_foot_lift - min_sole_y, 0.0])

        root_i = tgt_idx['root']
        pel_local = tgt_wR[root_i].T @ (pel_pos - tgt_wp[root_i])
        pelvis_trans.append(pel_local.astype(np.float32))

    tracks = {j: {'rotation': np.asarray(rot_tracks[j], dtype=np.float32)} for j in ordered_tgt}
    tracks['pelvis']['translation'] = np.asarray(pelvis_trans, dtype=np.float32)
    return {'name': anim['name'], 'times': times, 'tracks': tracks}


def write_clips_glb(out_path: Path, tgt_doc, tgt_skel, clips):
    contract_joints = [tgt_doc['nodes'][j]['name'] for j in tgt_doc['skins'][0]['joints']]
    src_idx = tgt_skel['name_to_idx']
    remap = {src_idx[name]: i for i, name in enumerate(contract_joints)}
    nodes = []
    for name in contract_joints:
        orig = tgt_doc['nodes'][src_idx[name]]
        nd = {'name': name}
        for k in ('translation', 'rotation', 'scale'):
            if k in orig:
                nd[k] = list(orig[k])
        kids = [remap[c] for c in orig.get('children', []) if c in remap]
        if kids:
            nd['children'] = kids
        nodes.append(nd)

    bin_buf = bytearray()
    accessors = []
    buffer_views = []

    def add_acc(arr, kind, bounds=False):
        arr = np.ascontiguousarray(arr)
        bin_buf.extend(b'\x00' * ((-len(bin_buf)) % 4))
        off = len(bin_buf)
        raw = arr.tobytes()
        bin_buf.extend(raw)
        bv_idx = len(buffer_views)
        buffer_views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(raw)})
        acc = {'bufferView': bv_idx, 'componentType': 5126, 'count': len(arr), 'type': kind}
        if bounds and len(arr):
            if arr.ndim == 1:
                acc['min'] = [float(arr.min())]
                acc['max'] = [float(arr.max())]
            else:
                acc['min'] = arr.min(axis=0).astype(float).tolist()
                acc['max'] = arr.max(axis=0).astype(float).tolist()
        accessors.append(acc)
        return len(accessors) - 1

    joint_to_i = {name: i for i, name in enumerate(contract_joints)}
    anims = []
    for clip in clips:
        time_acc = add_acc(clip['times'], 'SCALAR', bounds=True)
        samplers, channels = [], []
        for jname, tr in clip['tracks'].items():
            ji = joint_to_i[jname]
            for path, vals in tr.items():
                kind = 'VEC4' if path == 'rotation' else 'VEC3'
                out_acc = add_acc(vals, kind)
                samplers.append({'input': time_acc, 'output': out_acc, 'interpolation': 'LINEAR'})
                channels.append({'sampler': len(samplers) - 1, 'target': {'node': ji, 'path': path}})
        anims.append({'name': clip['name'], 'samplers': samplers, 'channels': channels})

    bin_buf.extend(b'\x00' * ((-len(bin_buf)) % 4))
    doc = {
        'asset': {'version': '2.0', 'generator': 'run-voxel-characters/retarget-clips.py'},
        'scene': 0,
        'scenes': [{'nodes': [0]}],
        'nodes': nodes,
        'animations': anims,
        'accessors': accessors,
        'bufferViews': buffer_views,
        'buffers': [{'byteLength': len(bin_buf)}],
    }
    json_bytes = json.dumps(doc, separators=(',', ':')).encode('utf-8')
    json_bytes += b' ' * ((-len(json_bytes)) % 4)
    total = 12 + 8 + len(json_bytes) + 8 + len(bin_buf)
    header = struct.pack('<3I', 0x46546C67, 2, total)
    c0 = struct.pack('<2I', len(json_bytes), 0x4E4F534A)
    c1 = struct.pack('<2I', len(bin_buf), 0x004E4942)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(header + c0 + json_bytes + c1 + bin_buf)
    print(f'Wrote {out_path} ({out_path.stat().st_size} bytes, {len(anims)} clips)')


def main():
    parser = argparse.ArgumentParser(description='Retarget UAL2 and KayKit 2H clips onto UAL1 53-joint base.')
    parser.add_argument('--ual1', type=Path, default=DEFAULT_UAL1)
    parser.add_argument('--jra', type=Path, default=DEFAULT_JRA)
    parser.add_argument('--out-dir', type=Path, default=DEFAULT_OUT_DIR)
    args = parser.parse_args()

    tgt_doc, tgt_bin = read_glb(args.ual1)
    tgt_skel = build_skeleton_info(tgt_doc)
    tgt_joints = [tgt_doc['nodes'][j]['name'] for j in tgt_doc['skins'][0]['joints']]
    grip_fingers = extract_grip_finger_pose(tgt_doc, tgt_bin, tgt_skel, 'Idle_Loop')

    # 1. Quaternius Universal Animation Library 2 (42 non-A_TPose clips, CC0-1.0)
    u2_src = args.jra / 'quaternius-universal-animation-library-2/3D/characters/UAL2_Standard.glb'
    u2_doc, u2_bin = read_glb(u2_src)
    u2_skel = build_skeleton_info(u2_doc)
    u2_map = {j: j for j in tgt_joints}
    u2_scale = (
        tgt_skel['rest_world_p'][tgt_skel['name_to_idx']['pelvis']][1]
        / u2_skel['rest_world_p'][u2_skel['name_to_idx']['pelvis']][1]
    )
    u2_clips = []
    for anim in u2_doc['animations']:
        if anim['name'] == 'A_TPose':
            continue
        u2_clips.append(retarget_clip(u2_doc, u2_bin, u2_skel, tgt_skel, tgt_joints, anim, u2_map, u2_scale, ground_feet=False))
    write_clips_glb(args.out_dir / 'ual2-clips.glb', tgt_doc, tgt_skel, u2_clips)

    # 2. KayKit Two-Handed Combat Melee & Ranged (10 clips, CC0-1.0)
    kk_map = {
        'root': 'root',
        'pelvis': 'hips',
        'spine_01': 'spine',
        'spine_03': 'chest',
        'Head': 'head',
        'upperarm_l': 'upperarm.l',
        'lowerarm_l': 'lowerarm.l',
        'hand_l': 'hand.l',
        'upperarm_r': 'upperarm.r',
        'lowerarm_r': 'lowerarm.r',
        'hand_r': 'hand.r',
        'thigh_l': 'upperleg.l',
        'calf_l': 'lowerleg.l',
        'foot_l': 'foot.l',
        'ball_l': 'toes.l',
        'thigh_r': 'upperleg.r',
        'calf_r': 'lowerleg.r',
        'foot_r': 'foot.r',
        'ball_r': 'toes.r',
    }
    kk_dir = args.jra / 'kaykit-character-animations/3D/characters/Animations/gltf/Rig_Medium'
    kk_clips = []
    for fname, prefix in [('Rig_Medium_CombatMelee.glb', 'Melee_2H_'), ('Rig_Medium_CombatRanged.glb', 'Ranged_2H_')]:
        sdoc, sbin = read_glb(kk_dir / fname)
        sskel = build_skeleton_info(sdoc)
        tgt_leg = (
            tgt_skel['rest_world_p'][tgt_skel['name_to_idx']['thigh_l']][1]
            - tgt_skel['rest_world_p'][tgt_skel['name_to_idx']['foot_l']][1]
        )
        src_leg = (
            sskel['rest_world_p'][sskel['name_to_idx']['upperleg.l']][1]
            - sskel['rest_world_p'][sskel['name_to_idx']['foot.l']][1]
        )
        kk_scale = tgt_leg / src_leg
        for anim in sdoc['animations']:
            if anim['name'].startswith(prefix):
                kk_clips.append(
                    retarget_clip(
                        sdoc, sbin, sskel, tgt_skel, tgt_joints, anim, kk_map, kk_scale,
                        ground_feet=True, local_rot_overrides=grip_fingers,
                    )
                )
    write_clips_glb(args.out_dir / 'kaykit-2h-clips.glb', tgt_doc, tgt_skel, kk_clips)


if __name__ == '__main__':
    main()
