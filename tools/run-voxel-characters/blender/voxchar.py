"""Chunky orthogonal voxel character & pack geometry kit for Blender 5.1 Python.

Coordinate space: glTF. +Y is up, +Z is forward, +X is the left side of the
character. Unit = metre. `VOX` (0.04 m) is the voxel size of the sculpted creatures.
The voxel humans use `contracts/data/proportions.json` -> `humanoid.voxelSize`
(0.05 m, 38 voxels tall on the 53-joint Quaternius UAL1 rig).

Key design guarantees:
  1. Pure axis-aligned orthogonal voxels (normals strictly +/-X, +/-Y, +/-Z).
  2. Greedy face meshing merged by (region, quantized_v, mottle_flag) for
     low triangle counts (<= 2,200 tris per full composed character).
  3. Baked per-face voxel crevice AO (zero diagonal triangulation artifacts).
  4. Dual UV encoding:
       - TEXCOORD_0: (region_u, shade_v) where u selects Skin/Hair/Primary/
         Secondary/Accent/Metal and v in [0.15, 0.85] encodes shade+AO
         (v >= 0.93 encodes emissive accent voxels).
       - TEXCOORD_1: integer voxel-grid coordinates (i + seed, j + seed) for
         sharp 1-voxel-cell shader micro-mottling at zero extra triangles, or
         (-999, -999) when mottle=False (eyes, badges, glowing LEDs).
  5. Rigid per-bone segment skinning (weight = 1.0 per segment) with clean
     joint overlap so voxels never shear or stretch during UAL1 animation.
  6. Byte-exact UAL1 rig copy (joints, inverseBindMatrices, 95 clips) +
     automatic body_slim / body_heavy orthogonal morph targets + ragdoll fit.
  7. Sculpt pose (`SculptPose`): the voxel humans are sculpted in the pose of the
     default humanoid proportions. The mesh stores the inverse of the runtime bone
     scale, thus the runtime shows exact cubes on one lattice.
"""

from __future__ import annotations

import json
import re
import struct
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from mathutils import Vector

TOOL_ROOT = Path(__file__).resolve().parent.parent
CONTRACTS = TOOL_ROOT / 'contracts'

VOX = 0.04  # 4.0 cm canonical character voxel
MATERIAL_NAME = 'VoxChar_Atlas_Mat'
V_MIN, V_MAX = 0.15, 0.85
V_EMISSIVE = 0.96

X = Vector((1.0, 0.0, 0.0))
Y = Vector((0.0, 1.0, 0.0))
Z = Vector((0.0, 0.0, 1.0))


def V(x, y, z):
    return Vector((float(x), float(y), float(z)))


# --------------------------------------------------------------------------
# Contracts
# --------------------------------------------------------------------------

def load_region_u():
    text = (CONTRACTS / 'palette.ts').read_text()
    block = re.search(r'PALETTE_REGION_U[^=]*=\s*\{([^}]*)\}', text)
    if not block:
        raise ValueError('contracts/palette.ts has no PALETTE_REGION_U block.')
    values = {name: float(value) for name, value in re.findall(r'(\w+):\s*([0-9.]+)', block.group(1))}
    if len(values) < 6:
        raise ValueError(f'Unexpected PALETTE_REGION_U count: {len(values)}')
    return values


REGION_U = load_region_u()
REGIONS = tuple(REGION_U.keys())
REGION_INDEX = {name: i for i, name in enumerate(REGIONS)}


def load_json(name):
    return json.loads((CONTRACTS / 'data' / name).read_text())


BUDGETS = load_json('budgets.json')
PACKS = load_json('packs.json')['packs']
RIG_CONTRACT = load_json('ual1-rig.json')
PROPORTION_CONTRACT = load_json('proportions.json')


# --------------------------------------------------------------------------
# GLB input and output
# --------------------------------------------------------------------------

_COMPONENT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
_COMPONENT_ID = {np.dtype(value): key for key, value in _COMPONENT.items()}
_TYPE_SIZE = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER = 34962, 34963


def read_glb(path):
    raw = Path(path).read_bytes()
    if struct.unpack_from('<III', raw) != (0x46546C67, 2, len(raw)):
        raise ValueError(f'Invalid GLB header: {path}')
    size, kind = struct.unpack_from('<II', raw, 12)
    if kind != 0x4E4F534A:
        raise ValueError(f'The GLB JSON chunk is missing: {path}')
    length, kind = struct.unpack_from('<II', raw, 20 + size)
    if kind != 0x004E4942:
        raise ValueError(f'The GLB binary chunk is missing: {path}')
    return json.loads(raw[20:20 + size]), raw[28 + size:28 + size + length]


def encode_glb(document, binary):
    payload = bytes(binary) + bytes((-len(binary)) % 4)
    document['buffers'] = [{'byteLength': len(payload)}]
    header = json.dumps(document, separators=(',', ':')).encode()
    header += b' ' * ((-len(header)) % 4)
    length = 12 + 8 + len(header) + 8 + len(payload)
    return (
        struct.pack('<III', 0x46546C67, 2, length)
        + struct.pack('<II', len(header), 0x4E4F534A)
        + header
        + struct.pack('<II', len(payload), 0x004E4942)
        + payload
    )


def accessor_bytes(document, binary, index):
    item = document['accessors'][index]
    if 'sparse' in item:
        raise ValueError('Sparse accessors are not supported.')
    view = document['bufferViews'][item['bufferView']]
    width = np.dtype(_COMPONENT[item['componentType']]).itemsize * _TYPE_SIZE[item['type']]
    if view.get('byteStride', width) != width:
        raise ValueError('Interleaved accessors are not supported.')
    offset = view.get('byteOffset', 0) + item.get('byteOffset', 0)
    return item, binary[offset:offset + width * item['count']]


def accessor_array(document, binary, index):
    item, data = accessor_bytes(document, binary, index)
    shape = (item['count'],) if item['type'] == 'SCALAR' else (item['count'], _TYPE_SIZE[item['type']])
    return np.frombuffer(data, dtype=_COMPONENT[item['componentType']]).reshape(shape)


class RigData:
    """Joints, bind pose, and clips read directly from a GLB."""

    def __init__(self, path, expected_joints=None):
        self.doc, self.bin = read_glb(path)
        skins = self.doc.get('skins') or []
        if len(skins) != 1:
            raise ValueError(f'{path}: expected 1 skin, found {len(skins)}')
        self.skin = skins[0]
        self.joint_nodes = list(self.skin['joints'])
        self.names = [self.doc['nodes'][node]['name'] for node in self.joint_nodes]
        if expected_joints is not None and tuple(self.names) != tuple(expected_joints):
            raise ValueError(f'{path}: joint list does not match the contract.')
        self.index = {name: i for i, name in enumerate(self.names)}
        self.parent = [None] * len(self.names)
        self.children = [[] for _ in self.names]
        by_node = {node: i for i, node in enumerate(self.joint_nodes)}
        for joint, node in enumerate(self.joint_nodes):
            for child in self.doc['nodes'][node].get('children', ()):
                if child in by_node:
                    c = by_node[child]
                    self.parent[c] = joint
                    self.children[joint].append(c)
        raw_ibm = accessor_array(self.doc, self.bin, self.skin['inverseBindMatrices'])
        self.inverse_binds = raw_ibm.reshape(-1, 4, 4).transpose(0, 2, 1)
        self.world = np.linalg.inv(self.inverse_binds)
        self.position = {name: Vector(self.world[i, :3, 3]) for i, name in enumerate(self.names)}

    def joint(self, name):
        return self.position[name].copy()

    def check_contract(self, tolerance=2e-4, contract=None, check_clips=True):
        c = contract or RIG_CONTRACT
        if self.names != c['joints']:
            raise ValueError('Joint names differ from contract.')
        for name, target in c['worldPositions'].items():
            delta = (self.position[name] - Vector(target)).length
            if delta > tolerance:
                raise ValueError(f'{name}: joint moved by {delta:.5f} m.')
        if check_clips:
            clips = {clip['name'] for clip in self.doc.get('animations', ())}
            missing = [entry['name'] for entry in c['clips'] if entry['name'] not in clips]
            if missing:
                raise ValueError(f'Missing clips: {missing}')


class SculptPose:
    """Pose of a rig at the default proportions of its characters, and the map back to the bind pose.

    The runtime (`proportionRig.ts`) scales each bone around its bind joint and moves each child joint
    with the scale of its parent. A voxel grid that is sculpted in this pose is thus not in the bind
    pose of the rig. `to_bind` gives the bind-pose position of a sculpted point:

        sculpted = posed_joint + scale * (bind - bind_joint)

    `scripts/build.ts` writes the bone scales (`contracts/humanoidPose.ts`).
    """

    GROUND_BONES = ('foot_l', 'foot_r')

    def __init__(self, rig: RigData, path):
        data = json.loads(Path(path).read_text())
        scales = data['boneScales']
        missing = [name for name in rig.names if name not in scales]
        if missing:
            raise ValueError(f'{path}: no bone scale for {missing}.')
        self.voxel_size = float(data['voxelSize'])
        self.proportions = dict(data['proportions'])
        self.scale = {name: np.array(scales[name], dtype=np.float64) for name in rig.names}
        self.bind = {name: np.array(rig.position[name], dtype=np.float64) for name in rig.names}
        if any((value <= 0).any() for value in self.scale.values()):
            raise ValueError(f'{path}: a bone scale is not positive.')
        self.posed = {}
        for index, name in enumerate(rig.names):
            parent = rig.parent[index]
            if parent is not None and parent > index:
                raise ValueError(f'{name}: the joint list must give each parent before its children.')
            parent_name = None if parent is None else rig.names[parent]
            if parent_name is None or parent_name == 'root':
                self.posed[name] = self.bind[name].copy()
            else:
                offset = (self.bind[name] - self.bind[parent_name]) * self.scale[parent_name]
                self.posed[name] = self.posed[parent_name] + offset
        # The runtime puts the lowest sole on y = 0.
        lift = min(self.posed[name][1] - self.scale[name][1] * self.bind[name][1] for name in self.GROUND_BONES)
        for value in self.posed.values():
            value[1] -= lift

    def joint(self, bone: str):
        """Position of a joint in the sculpt pose."""
        return self.posed[bone].copy()

    def to_bind(self, bone: str, points: np.ndarray) -> np.ndarray:
        """Bind-pose positions of points that are sculpted on `bone`."""
        return self.bind[bone] + (np.asarray(points, dtype=np.float64) - self.posed[bone]) / self.scale[bone]

    def delta_to_bind(self, bone: str, deltas: np.ndarray) -> np.ndarray:
        """Bind-pose value of a displacement (a morph delta) that is sculpted on `bone`."""
        return np.asarray(deltas, dtype=np.float64) / self.scale[bone]


@dataclass
class MeshData:
    name: str
    positions: np.ndarray
    normals: np.ndarray
    uvs: np.ndarray
    uv1s: np.ndarray
    indices: np.ndarray
    joints: np.ndarray | None = None
    weights: np.ndarray | None = None
    morphs: dict | None = None
    extras: dict | None = None

    @property
    def triangles(self):
        return len(self.indices) // 3

    def bounds(self):
        lo = self.positions.min(axis=0).tolist()
        hi = self.positions.max(axis=0).tolist()
        return {
            'min': [round(v, 5) for v in lo],
            'max': [round(v, 5) for v in hi],
            'size': [round(b - a, 5) for a, b in zip(lo, hi)],
        }


class GlbBuilder:
    """Minimal glTF 2.0 binary writer with exact rig preservation and TEXCOORD_1."""

    def __init__(self):
        self.bin = bytearray()
        self.doc = {
            'asset': {'version': '2.0', 'generator': 'run-voxel-characters/voxchar.py'},
            'scene': 0,
            'scenes': [{'name': 'Scene', 'nodes': []}],
            'nodes': [],
            'meshes': [],
            'materials': [{
                'name': MATERIAL_NAME,
                'pbrMetallicRoughness': {
                    'baseColorFactor': [1.0, 1.0, 1.0, 1.0],
                    'metallicFactor': 0.0,
                    'roughnessFactor': 0.85,
                },
                'doubleSided': False,
            }],
            'accessors': [],
            'bufferViews': [],
            'buffers': [],
        }
        self.rig_root = None

    def _view(self, data, target=None):
        self.bin.extend(b'\x00' * ((-len(self.bin)) % 4))
        offset = len(self.bin)
        self.bin.extend(data)
        view = {'buffer': 0, 'byteOffset': offset, 'byteLength': len(data)}
        if target is not None:
            view['target'] = target
        self.doc['bufferViews'].append(view)
        return len(self.doc['bufferViews']) - 1

    def _accessor(self, array, kind, target=None, bounds=False):
        array = np.ascontiguousarray(array)
        accessor = {
            'bufferView': self._view(array.tobytes(), target),
            'componentType': _COMPONENT_ID[array.dtype],
            'count': len(array),
            'type': kind,
        }
        if bounds and len(array):
            if array.ndim == 1:
                accessor['min'] = [float(array.min())]
                accessor['max'] = [float(array.max())]
            else:
                accessor['min'] = array.min(axis=0).astype(float).tolist()
                accessor['max'] = array.max(axis=0).astype(float).tolist()
        self.doc['accessors'].append(accessor)
        return len(self.doc['accessors']) - 1

    def _copy_accessor_raw(self, doc, binary, index, cache=None):
        if cache is not None and index in cache:
            return cache[index]
        item, data = accessor_bytes(doc, binary, index)
        copy = {k: v for k, v in item.items() if k in ('componentType', 'count', 'type', 'min', 'max', 'normalized')}
        copy['bufferView'] = self._view(data)
        self.doc['accessors'].append(copy)
        out = len(self.doc['accessors']) - 1
        if cache is not None:
            cache[index] = out
        return out

    def _copy_accessor(self, rig, index, cache=None):
        return self._copy_accessor_raw(rig.doc, rig.bin, index, cache)

    def add_rig(self, rig, with_clips):
        if self.doc['nodes']:
            raise ValueError('Add the rig before the meshes.')
        remap = {node: i for i, node in enumerate(rig.joint_nodes)}
        for src in rig.joint_nodes:
            node = rig.doc['nodes'][src]
            copy = {'name': node['name']}
            for key in ('translation', 'rotation', 'scale'):
                if key in node:
                    copy[key] = list(node[key])
            kids = [remap[c] for c in node.get('children', ()) if c in remap]
            if kids:
                copy['children'] = kids
            self.doc['nodes'].append(copy)
        roots = [j for j, p in enumerate(rig.parent) if p is None]
        self.rig_root = len(self.doc['nodes'])
        self.doc['nodes'].append({'name': 'UAL1_Rig', 'children': roots})
        self.doc['scenes'][0]['nodes'].append(self.rig_root)
        acc_cache = {}
        self.doc['skins'] = [{
            'name': 'UAL1_Rig',
            'joints': list(range(len(rig.joint_nodes))),
            'inverseBindMatrices': self._copy_accessor(rig, rig.skin['inverseBindMatrices'], acc_cache),
        }]
        if with_clips:
            clips = []
            for clip in rig.doc['animations']:
                samplers = [{
                    'input': self._copy_accessor(rig, s['input'], acc_cache),
                    'output': self._copy_accessor(rig, s['output'], acc_cache),
                    'interpolation': s.get('interpolation', 'LINEAR'),
                } for s in clip['samplers']]
                channels = [{
                    'sampler': ch['sampler'],
                    'target': {'node': remap[ch['target']['node']], 'path': ch['target']['path']},
                } for ch in clip['channels']]
                clips.append({'name': clip['name'], 'samplers': samplers, 'channels': channels})
            self.doc['animations'] = clips

    def add_extra_clips(self, clip_path):
        """Append animation clips from an animation-only GLB matched by joint node name."""
        if not self.doc.get('skins'):
            raise ValueError('Add the rig before extra clips.')
        joint_by_name = {self.doc['nodes'][i]['name']: i for i in self.doc['skins'][0]['joints']}
        existing = {a['name'] for a in self.doc.get('animations', ())}
        src_doc, src_bin = read_glb(clip_path)
        acc_cache = {}
        clips = self.doc.setdefault('animations', [])
        for clip in src_doc.get('animations', ()):
            name = clip['name']
            if name in existing:
                raise ValueError(f'{clip_path}: duplicate clip name "{name}"')
            existing.add(name)
            samplers = [{
                'input': self._copy_accessor_raw(src_doc, src_bin, s['input'], acc_cache),
                'output': self._copy_accessor_raw(src_doc, src_bin, s['output'], acc_cache),
                'interpolation': s.get('interpolation', 'LINEAR'),
            } for s in clip['samplers']]
            channels = []
            for ch in clip['channels']:
                src_node_name = src_doc['nodes'][ch['target']['node']]['name']
                if src_node_name not in joint_by_name:
                    raise ValueError(f'{clip_path}: clip "{name}" targets unknown joint "{src_node_name}"')
                channels.append({
                    'sampler': ch['sampler'],
                    'target': {'node': joint_by_name[src_node_name], 'path': ch['target']['path']},
                })
            clips.append({'name': name, 'samplers': samplers, 'channels': channels})

    def check_clips(self, contract=None):
        c = contract or RIG_CONTRACT
        clips = {clip['name'] for clip in self.doc.get('animations', ())}
        missing = [entry['name'] for entry in c['clips'] if entry['name'] not in clips]
        if missing:
            raise ValueError(f'Missing clips: {missing}')

    def add_custom_rig(self, contract, animations=None, rig_name='Creature_Rig'):
        if self.doc['nodes']:
            raise ValueError('Add the rig before the meshes.')
        joints = list(contract['joints'])
        parents = contract['parents']
        world_pos = {k: np.array(v, dtype=np.float64) for k, v in contract['worldPositions'].items()}
        joint_index = {name: i for i, name in enumerate(joints)}
        children_of = {name: [] for name in joints}
        for name in joints:
            p = parents[name]
            if p is not None:
                children_of[p].append(joint_index[name])
        ibm = np.zeros((len(joints), 4, 4), dtype=np.float32)
        for i, name in enumerate(joints):
            p = parents[name]
            rel = world_pos[name] if p is None else (world_pos[name] - world_pos[p])
            node = {'name': name, 'translation': [float(rel[0]), float(rel[1]), float(rel[2])]}
            if children_of[name]:
                node['children'] = children_of[name]
            self.doc['nodes'].append(node)
            mat = np.eye(4, dtype=np.float32)
            mat[:3, 3] = -world_pos[name].astype(np.float32)
            ibm[i] = mat.T
        roots = [i for i, name in enumerate(joints) if parents[name] is None]
        self.rig_root = len(self.doc['nodes'])
        self.doc['nodes'].append({'name': rig_name, 'children': roots})
        self.doc['scenes'][0]['nodes'].append(self.rig_root)
        self.doc['skins'] = [{
            'name': rig_name,
            'joints': list(range(len(joints))),
            'inverseBindMatrices': self._accessor(ibm.reshape(len(joints), 16), 'MAT4'),
        }]
        if animations:
            clips = []
            for clip in animations:
                times = np.asarray(clip['times'], dtype=np.float32)
                time_acc = self._accessor(times, 'SCALAR', bounds=True)
                samplers, channels = [], []
                for joint_name, tracks in clip['tracks'].items():
                    j_idx = joint_index[joint_name]
                    for path, values in tracks.items():
                        kind = 'VEC4' if path == 'rotation' else 'VEC3'
                        out_acc = self._accessor(np.asarray(values, dtype=np.float32), kind)
                        samplers.append({'input': time_acc, 'output': out_acc, 'interpolation': 'LINEAR'})
                        channels.append({'sampler': len(samplers) - 1, 'target': {'node': j_idx, 'path': path}})
                clips.append({'name': clip['name'], 'samplers': samplers, 'channels': channels})
            self.doc['animations'] = clips

    def add_mesh(self, mesh: MeshData, node_extras=None):
        attributes = {
            'POSITION': self._accessor(mesh.positions.astype(np.float32), 'VEC3', ARRAY_BUFFER, bounds=True),
            'NORMAL': self._accessor(mesh.normals.astype(np.float32), 'VEC3', ARRAY_BUFFER),
            'TEXCOORD_0': self._accessor(mesh.uvs.astype(np.float32), 'VEC2', ARRAY_BUFFER),
            'TEXCOORD_1': self._accessor(mesh.uv1s.astype(np.float32), 'VEC2', ARRAY_BUFFER),
        }
        skinned = mesh.joints is not None
        if skinned:
            if self.rig_root is None:
                raise ValueError(f'{mesh.name}: a skinned mesh needs the rig.')
            attributes['JOINTS_0'] = self._accessor(mesh.joints.astype(np.uint8), 'VEC4', ARRAY_BUFFER)
            attributes['WEIGHTS_0'] = self._accessor(mesh.weights.astype(np.float32), 'VEC4', ARRAY_BUFFER)
        index_type = np.uint16 if len(mesh.positions) < 65535 else np.uint32
        primitive = {
            'attributes': attributes,
            'material': 0,
            'indices': self._accessor(mesh.indices.astype(index_type), 'SCALAR', ELEMENT_ARRAY_BUFFER),
        }
        definition = {'name': mesh.name, 'primitives': [primitive]}
        if mesh.morphs:
            primitive['targets'] = [
                {'POSITION': self._accessor(delta.astype(np.float32), 'VEC3', ARRAY_BUFFER, bounds=True)}
                for delta in mesh.morphs.values()
            ]
            definition['weights'] = [0.0] * len(mesh.morphs)
            definition['extras'] = {'targetNames': list(mesh.morphs)}
        self.doc['meshes'].append(definition)
        node = {'name': mesh.name, 'mesh': len(self.doc['meshes']) - 1}
        extras = {**(mesh.extras or {}), **(node_extras or {})}
        if extras:
            node['extras'] = extras
        if skinned:
            node['skin'] = 0
        self.doc['nodes'].append(node)
        index = len(self.doc['nodes']) - 1
        if skinned:
            self.doc['nodes'][self.rig_root]['children'].append(index)
        else:
            self.doc['scenes'][0]['nodes'].append(index)
        return index

    def write(self, path):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(encode_glb(self.doc, self.bin))
        return path.stat().st_size


def write_static_glb(path, mesh: MeshData):
    builder = GlbBuilder()
    builder.add_mesh(mesh)
    return builder.write(path)


# --------------------------------------------------------------------------
# Voxel encoding + greedy meshing with baked crevice AO & uv1 grid
# --------------------------------------------------------------------------

def vox(region: str, shade: float = 0.0, *, mottle: bool = True, emissive: bool = False) -> int:
    """Encode a voxel cell value.

    region: 'skin' | 'hair' | 'primary' | 'secondary' | 'accent' | 'metal'
    shade:  [-1.0 .. +1.0], where 0.0 is neutral (v=0.50), negative darkens, positive brightens.
    mottle: True enables sharp 1-voxel-cell tonal variation in the fragment shader.
    emissive: True makes the voxel glow brightly using the accent palette color (mottle disabled).
    """
    if region not in REGION_INDEX:
        raise ValueError(f'Unknown palette region "{region}"')
    if emissive:
        r_idx = REGION_INDEX['accent']
        s_bucket = 31  # sentinel for V_EMISSIVE
        m_bit = 0
    else:
        r_idx = REGION_INDEX[region]
        # Quantize shade to 0..24 (step ~0.083) so large surfaces merge cleanly while preserving tone steps
        clamped = max(-1.0, min(1.0, float(shade)))
        s_bucket = int(round((clamped + 1.0) * 12.0))  # 0..24
        m_bit = 1 if mottle else 0
    return 1 + (r_idx << 8) + (s_bucket << 1) + m_bit


def _decode_vox(code: int):
    raw = code - 1
    m_bit = raw & 1
    s_bucket = (raw >> 1) & 0x7F
    r_idx = raw >> 8
    if s_bucket == 31:
        return r_idx, V_EMISSIVE, 0
    v = V_MIN + (s_bucket / 24.0) * (V_MAX - V_MIN)
    return r_idx, v, m_bit


_PLANE_AXES = {0: (1, 2), 1: (0, 2), 2: (0, 1)}
_RIGHT_HANDED = {0: True, 1: False, 2: True}


def _greedy_2d(mask: np.ndarray):
    nu, nv = mask.shape
    done = np.zeros(mask.shape, dtype=bool)
    us, vs = np.nonzero(mask)
    for i, j in zip(us.tolist(), vs.tolist()):
        if done[i, j]:
            continue
        key = int(mask[i, j])
        h = 1
        while j + h < nv and mask[i, j + h] == key and not done[i, j + h]:
            h += 1
        w = 1
        while i + w < nu and np.all(mask[i + w, j:j + h] == key) and not done[i + w, j:j + h].any():
            w += 1
        done[i:i + w, j:j + h] = True
        yield i, j, w, h, key


def _greedy_mesh_grid(
    grid: np.ndarray,
    origin_world: tuple[float, float, float],
    pivot_vox: tuple[float, float, float],
    voxel_size: float,
    *,
    layer_pad: float = 0.0,
    plane_seed: float = 0.0,
    bake_ao: bool = True,
):
    """Greedy-mesh a 3D int32 voxel grid into flat-shaded triangles with crevice AO & uv1."""
    if grid.ndim != 3:
        raise ValueError('grid must be 3D')
    if not np.any(grid):
        empty2 = np.zeros((0, 2), dtype=np.float32)
        empty3 = np.zeros((0, 3), dtype=np.float32)
        return empty3, empty3, empty2, empty2, np.zeros((0,), dtype=np.int32)

    # Precompute lookup table from voxel code -> (r_idx, v_bucket, m_bit)
    # Using a cache for speed
    code_cache: dict[int, tuple[int, int, int]] = {}
    unique_codes = np.unique(grid)
    for c in unique_codes.tolist():
        if c == 0:
            continue
        r_idx, v, m_bit = _decode_vox(c)
        v_bucket = 63 if v >= 0.90 else int(round((v - V_MIN) / (V_MAX - V_MIN) * 16.0))
        code_cache[c] = (r_idx, max(0, min(63, v_bucket)), m_bit)

    ox, oy, oz = origin_world
    px, py, pz = pivot_vox
    pos_list, nrm_list, uv_list, uv1_list = [], [], [], []

    for d in range(3):
        u_axis, v_axis = _PLANE_AXES[d]
        A = np.transpose(grid, (d, u_axis, v_axis))
        P = np.zeros((A.shape[0] + 2, A.shape[1], A.shape[2]), dtype=np.int32)
        P[1:-1] = A
        S = np.pad(A != 0, 2)  # padded occupancy [x+2, u+2, v+2]

        pos_faces = np.where((P[1:] == 0) & (P[:-1] != 0), P[:-1], 0)
        neg_faces = np.where((P[:-1] == 0) & (P[1:] != 0), P[1:], 0)

        for sign, M in ((1, pos_faces), (-1, neg_faces)):
            planes = np.nonzero(M.reshape(M.shape[0], -1).any(axis=1))[0]
            for s in planes.tolist():
                slice_codes = M[s]
                front_idx = (s if sign > 0 else s - 1) + 2  # in S coords (padded by +2)
                nu, nv = slice_codes.shape

                # Compute per-cell baked crevice + overhang AO in [-1 .. +6] steps out of 16
                if bake_ao and 0 <= front_idx < S.shape[0]:
                    F = S[front_idx].astype(np.int32)
                    edge_occ = (
                        F[1:nu + 1, 2:nv + 2]
                        + F[3:nu + 3, 2:nv + 2]
                        + F[2:nu + 2, 1:nv + 1]
                        + F[2:nu + 2, 3:nv + 3]
                    )
                    diag_occ = (
                        F[1:nu + 1, 1:nv + 1]
                        + F[3:nu + 3, 1:nv + 1]
                        + F[1:nu + 1, 3:nv + 3]
                        + F[3:nu + 3, 3:nv + 3]
                    )
                    weighted = edge_occ * 2 + diag_occ
                    ao_step = np.where(weighted >= 6, 2, np.where(weighted >= 2, 1, 0))
                    if d == 1:
                        if sign < 0:
                            ao_step = ao_step + 2
                        else:
                            sky_block = S[min(S.shape[0] - 1, front_idx + 1), 2:nu + 2, 2:nv + 2].astype(np.int32)
                            ao_step = ao_step + np.where(sky_block > 0, 2, np.where(edge_occ == 0, -1, 0))
                    else:
                        # Clean 2-step overhang shadow right below protruding brows, brims, and collars
                        if d == 0:
                            up1 = F[3:nu + 3, 2:nv + 2]
                        else:
                            up1 = F[2:nu + 2, 3:nv + 3]
                        ao_step = np.minimum(4, ao_step + np.where(up1 > 0, 2, 0))
                else:
                    ao_step = np.zeros_like(slice_codes)

                # Build merge key grid: 0 = empty, else packed (r_idx, v_after_ao, m_bit)
                key_grid = np.zeros_like(slice_codes, dtype=np.int32)
                nz_u, nz_v = np.nonzero(slice_codes)
                for ui, vi in zip(nz_u.tolist(), nz_v.tolist()):
                    c = int(slice_codes[ui, vi])
                    r_idx, v_b, m_bit = code_cache[c]
                    if v_b != 63:
                        step_val = int(ao_step[ui, vi])
                        v_b = max(0, min(16, v_b - step_val))
                    key_grid[ui, vi] = 1 + (r_idx << 8) + (v_b << 1) + m_bit

                seed_u = plane_seed + s * 17.0 + d * 53.0
                seed_v = plane_seed * 0.7 + s * 31.0 + d * 97.0

                for i, j, w, h, key in _greedy_2d(key_grid):
                    raw = key - 1
                    m_bit = raw & 1
                    v_b = (raw >> 1) & 0x7F
                    r_idx = raw >> 8
                    u_pal = REGION_U[REGIONS[r_idx]]
                    v_pal = V_EMISSIVE if v_b == 63 else (V_MIN + (v_b / 16.0) * (V_MAX - V_MIN))

                    corners = [(i, j), (i + w, j), (i + w, j + h), (i, j + h)]
                    if (sign > 0) != _RIGHT_HANDED[d]:
                        corners.reverse()

                    # The pad moves each face out along its normal. A quad also grows by the pad in its plane to
                    # close the convex corners, but only on an edge that has no other quad of this plane next to
                    # it. Two quads that grow into each other on one plane flicker (z-fighting at eye borders).
                    grow_u_low = layer_pad if i == 0 or not key_grid[i - 1, j:j + h].any() else 0.0
                    grow_u_high = layer_pad if i + w == nu or not key_grid[i + w, j:j + h].any() else 0.0
                    grow_v_low = layer_pad if j == 0 or not key_grid[i:i + w, j - 1].any() else 0.0
                    grow_v_high = layer_pad if j + h == nv or not key_grid[i:i + w, j + h].any() else 0.0

                    for cu, cv in corners:
                        pt = [0.0, 0.0, 0.0]
                        pt[d] = float(s) * voxel_size + sign * layer_pad
                        pt[u_axis] = float(cu) * voxel_size + (-grow_u_low if cu == i else grow_u_high)
                        pt[v_axis] = float(cv) * voxel_size + (-grow_v_low if cv == j else grow_v_high)
                        pos_list.append([
                            ox + pt[0] - px * voxel_size,
                            oy + pt[1] - py * voxel_size,
                            oz + pt[2] - pz * voxel_size,
                        ])
                        if m_bit:
                            uv1_list.append([float(cu) + seed_u, float(cv) + seed_v])
                        else:
                            uv1_list.append([-999.0, -999.0])

                    nrm = [0.0, 0.0, 0.0]
                    nrm[d] = float(sign)
                    nrm_list.extend([nrm] * 4)
                    uv_list.extend([[u_pal, v_pal]] * 4)

    n_verts = len(pos_list)
    n_quads = n_verts // 4
    q = np.arange(n_verts, dtype=np.int32).reshape(n_quads, 4)
    tris = np.empty((n_quads, 6), dtype=np.int32)
    tris[:, 0] = q[:, 0]
    tris[:, 1] = q[:, 1]
    tris[:, 2] = q[:, 2]
    tris[:, 3] = q[:, 0]
    tris[:, 4] = q[:, 2]
    tris[:, 5] = q[:, 3]

    return (
        np.asarray(pos_list, dtype=np.float32),
        np.asarray(nrm_list, dtype=np.float32),
        np.asarray(uv_list, dtype=np.float32),
        np.asarray(uv1_list, dtype=np.float32),
        tris.reshape(-1),
    )


# --------------------------------------------------------------------------
# VoxelGrid & VoxelPart (Rigid Bone Segments)
# --------------------------------------------------------------------------

class VoxelGrid:
    """An integer voxel grid anchored around a local coordinate origin (ix, iy, iz)."""

    def __init__(
        self,
        min_x: int, max_x: int,
        min_y: int, max_y: int,
        min_z: int, max_z: int,
        *,
        origin_world=(0.0, 0.0, 0.0),
        voxel_size: float = VOX,
        bone: str | None = None,
        tag: str | None = None,
        layer_pad: float = 0.0,
        morph_center: tuple[float, float, float] | None = None,
        morph_scale: tuple[float, float] = (1.0, 1.0),
        bake_ao: bool = True,
        plane_seed: float = 0.0,
        center_x: bool = False,
        center_y: bool = False,
        center_z: bool = False,
    ):
        self.min_c = (int(min_x), int(min_y), int(min_z))
        self.max_c = (int(max_x), int(max_y), int(max_z))
        sx = max_x - min_x + 1
        sy = max_y - min_y + 1
        sz = max_z - min_z + 1
        self.data = np.zeros((sx, sy, sz), dtype=np.int32)
        self.origin_world = tuple(float(v) for v in origin_world)
        px = -float(min_x) + (0.5 if center_x else 0.0)
        py = -float(min_y) + (0.5 if center_y else 0.0)
        pz = -float(min_z) + (0.5 if center_z else 0.0)
        self.pivot_vox = (px, py, pz)
        self.voxel_size = float(voxel_size)
        self.bone = bone
        self.tag = tag
        self.layer_pad = float(layer_pad)
        self.morph_center = morph_center or self.origin_world
        self.morph_scale = morph_scale  # (slim_xz_delta, heavy_xz_delta) relative to morph_center
        self.bake_ao = bake_ao
        self.plane_seed = float(plane_seed)
        self.center_x = center_x
        self.center_y = center_y
        self.center_z = center_z
        # Optional: row index -> bone that owns that row for the ragdoll collider fit. A rigid garment
        # that covers more than one body segment uses it (see build_core.collider_probe).
        self.collider_bone_for_row = None

    def _idx(self, x: int, y: int, z: int):
        return x - self.min_c[0], y - self.min_c[1], z - self.min_c[2]

    def in_bounds(self, x: int, y: int, z: int) -> bool:
        return (
            self.min_c[0] <= x <= self.max_c[0]
            and self.min_c[1] <= y <= self.max_c[1]
            and self.min_c[2] <= z <= self.max_c[2]
        )

    def set(self, x: int, y: int, z: int, code: int):
        if self.in_bounds(x, y, z):
            ix, iy, iz = self._idx(x, y, z)
            self.data[ix, iy, iz] = int(code)

    def get(self, x: int, y: int, z: int) -> int:
        if not self.in_bounds(x, y, z):
            return 0
        ix, iy, iz = self._idx(x, y, z)
        return int(self.data[ix, iy, iz])

    def set_sym(self, x: int, y: int, z: int, code: int):
        """Set (x, y, z) and (-x, y, z) symmetrically around local x = 0."""
        self.set(x, y, z, code)
        self.set(-x, y, z, code)

    def fill(self, x0: int, y0: int, z0: int, x1: int, y1: int, z1: int, code: int):
        """Fill inclusive integer box [x0..x1, y0..y1, z0..z1]."""
        lo_x, hi_x = max(self.min_c[0], min(x0, x1)), min(self.max_c[0], max(x0, x1))
        lo_y, hi_y = max(self.min_c[1], min(y0, y1)), min(self.max_c[1], max(y0, y1))
        lo_z, hi_z = max(self.min_c[2], min(z0, z1)), min(self.max_c[2], max(z0, z1))
        if lo_x > hi_x or lo_y > hi_y or lo_z > hi_z:
            return
        ix0, iy0, iz0 = self._idx(lo_x, lo_y, lo_z)
        ix1, iy1, iz1 = self._idx(hi_x, hi_y, hi_z)
        self.data[ix0:ix1 + 1, iy0:iy1 + 1, iz0:iz1 + 1] = int(code)

    def clear(self, x0: int, y0: int, z0: int, x1: int, y1: int, z1: int):
        self.fill(x0, y0, z0, x1, y1, z1, 0)

    def paint_if_filled(self, x0: int, y0: int, z0: int, x1: int, y1: int, z1: int, code: int):
        lo_x, hi_x = max(self.min_c[0], min(x0, x1)), min(self.max_c[0], max(x0, x1))
        lo_y, hi_y = max(self.min_c[1], min(y0, y1)), min(self.max_c[1], max(y0, y1))
        lo_z, hi_z = max(self.min_c[2], min(z0, z1)), min(self.max_c[2], max(z0, z1))
        if lo_x > hi_x or lo_y > hi_y or lo_z > hi_z:
            return
        ix0, iy0, iz0 = self._idx(lo_x, lo_y, lo_z)
        ix1, iy1, iz1 = self._idx(hi_x, hi_y, hi_z)
        sub = self.data[ix0:ix1 + 1, iy0:iy1 + 1, iz0:iz1 + 1]
        sub[sub != 0] = int(code)

    def scatter_patches(self, region: str, shades: tuple[float, ...], *, seed: int = 7, density: float = 0.25, mottle: bool = True):
        """Replace a fraction of voxels matching `region` with weathered shade patches."""
        r_idx = REGION_INDEX[region]
        rng = np.random.default_rng(seed)
        sx, sy, sz = self.data.shape
        for ix in range(sx):
            for iy in range(sy):
                for iz in range(sz):
                    c = int(self.data[ix, iy, iz])
                    if c == 0:
                        continue
                    cr, _, _ = _decode_vox(c)
                    if cr == r_idx and rng.random() < density:
                        sh = float(rng.choice(shades))
                        self.data[ix, iy, iz] = vox(region, sh, mottle=mottle)

    def clone_mirrored_x(self, bone_name: str, *, origin_world=None, morph_center=None) -> 'VoxelGrid':
        """Create a -X mirrored copy bound to `bone_name`."""
        ox, oy, oz = origin_world or (-self.origin_world[0], self.origin_world[1], self.origin_world[2])
        mc = morph_center or (-self.morph_center[0], self.morph_center[1], self.morph_center[2])
        mx0 = -self.max_c[0] if self.center_x else (-self.max_c[0] - 1)
        mx1 = -self.min_c[0] if self.center_x else (-self.min_c[0] - 1)
        out = VoxelGrid(
            mx0, mx1,
            self.min_c[1], self.max_c[1],
            self.min_c[2], self.max_c[2],
            origin_world=(ox, oy, oz),
            voxel_size=self.voxel_size,
            bone=bone_name,
            tag=self.tag,
            layer_pad=self.layer_pad,
            morph_center=mc,
            morph_scale=self.morph_scale,
            bake_ao=self.bake_ao,
            plane_seed=self.plane_seed + 41.0,
            center_x=self.center_x,
            center_y=self.center_y,
            center_z=self.center_z,
        )
        out.data = self.data[::-1, :, :].copy()
        return out

    def build_geometry(self):
        return _greedy_mesh_grid(
            self.data,
            self.origin_world,
            self.pivot_vox,
            self.voxel_size,
            layer_pad=self.layer_pad,
            plane_seed=self.plane_seed,
            bake_ao=self.bake_ao,
        )


def mirror_name(name: str) -> str:
    if name.endswith('_l'):
        return name[:-2] + '_r'
    if name.endswith('_r'):
        return name[:-2] + '_l'
    return name


# Canonical UAL1 voxel segment anchors (world space, torso/head plumbed on x=0, z=0.025)
UAL1_SEGMENT_ORIGINS = {
    'pelvis': (0.0, 1.04, 0.025),
    'spine_02': (0.0, 1.28, 0.025),
    'spine_03': (0.0, 1.44, 0.025),
    'neck_01': (0.0, 1.60, 0.025),
    'Head': (0.0, 1.70, 0.025),
    'upperarm_l': (0.12, 1.5236, 0.045),
    'lowerarm_l': (0.42, 1.5236, 0.045),
    'hand_l': (0.6867, 1.5236, 0.048),
    'thigh_l': (0.095, 1.08, -0.02),
    'calf_l': (0.095, 0.63, -0.024),
    'foot_l': (0.095, 0.16, -0.055),
}

# Morph build deltas (slim_xz_scale_delta, heavy_xz_scale_delta) per bone
DEFAULT_MORPH_SCALES = {
    'pelvis': (-0.12, 0.18),
    'spine_02': (-0.13, 0.22),
    'spine_03': (-0.11, 0.16),
    'neck_01': (-0.08, 0.10),
    'Head': (-0.04, 0.06),
    'upperarm_l': (-0.12, 0.16),
    'lowerarm_l': (-0.10, 0.14),
    'hand_l': (-0.05, 0.08),
    'thigh_l': (-0.12, 0.16),
    'calf_l': (-0.10, 0.14),
    'foot_l': (-0.04, 0.06),
}


class VoxelPart:
    """Composes rigid bone-bound VoxelGrids into a single skinned or static MeshData."""

    def __init__(self, name: str, *, covers: tuple[str, ...] = ()):
        self.name = name
        self.covers = list(covers)
        self.segments: list[VoxelGrid] = []
        self._mirror_active = False

    def add_grid(self, grid: VoxelGrid, *, mirror: bool = False) -> VoxelGrid:
        self.segments.append(grid)
        if mirror or self._mirror_active:
            if not grid.bone:
                raise ValueError('Mirrored voxel grid requires a bone name.')
            m_bone = mirror_name(grid.bone)
            self.segments.append(grid.clone_mirrored_x(m_bone))
        return grid

    def ual1_segment(
        self,
        bone: str,
        min_x: int, max_x: int,
        min_y: int, max_y: int,
        min_z: int, max_z: int,
        *,
        tag: str | None = None,
        layer_pad: float = 0.0,
        mirror: bool = False,
        bake_ao: bool = True,
        voxel_size: float = VOX,
        center_x: bool | None = None,
        center_y: bool = False,
        center_z: bool | None = None,
    ) -> VoxelGrid:
        if bone not in UAL1_SEGMENT_ORIGINS:
            raise ValueError(f'Unknown UAL1 segment "{bone}"')
        ox, oy, oz = UAL1_SEGMENT_ORIGINS[bone]
        is_central = bone in ('pelvis', 'spine_02', 'spine_03', 'neck_01', 'Head')
        if center_x is None:
            center_x = is_central and ((max_x - min_x + 1) % 2 == 1)
        if center_z is None:
            center_z = is_central and ((max_z - min_z + 1) % 2 == 1)
        morph = DEFAULT_MORPH_SCALES.get(bone, (-0.10, 0.14))
        grid = VoxelGrid(
            min_x, max_x, min_y, max_y, min_z, max_z,
            origin_world=(ox, oy, oz),
            voxel_size=voxel_size,
            bone=bone,
            tag=tag,
            layer_pad=layer_pad,
            morph_center=(ox, oy, oz),
            morph_scale=morph,
            bake_ao=bake_ao,
            plane_seed=len(self.segments) * 13.0,
            center_x=center_x,
            center_y=center_y,
            center_z=center_z,
        )
        return self.add_grid(grid, mirror=mirror)

    def custom_segment(
        self,
        bone: str,
        origin_world: tuple[float, float, float],
        min_x: int, max_x: int,
        min_y: int, max_y: int,
        min_z: int, max_z: int,
        *,
        tag: str | None = None,
        layer_pad: float = 0.0,
        mirror: bool = False,
        bake_ao: bool = True,
        voxel_size: float = VOX,
        center_x: bool | None = None,
        center_y: bool = False,
        center_z: bool | None = None,
    ) -> VoxelGrid:
        if center_x is None:
            center_x = abs(float(origin_world[0])) < 1e-4 and ((max_x - min_x + 1) % 2 == 1)
        if center_z is None:
            center_z = False
        grid = VoxelGrid(
            min_x, max_x, min_y, max_y, min_z, max_z,
            origin_world=origin_world,
            voxel_size=voxel_size,
            bone=bone,
            tag=tag,
            layer_pad=layer_pad,
            morph_center=origin_world,
            morph_scale=(0.0, 0.0),
            bake_ao=bake_ao,
            plane_seed=len(self.segments) * 13.0,
            center_x=center_x,
            center_y=center_y,
            center_z=center_z,
        )
        return self.add_grid(grid, mirror=mirror)

    @contextmanager
    def mirrored(self):
        prev, self._mirror_active = self._mirror_active, True
        try:
            yield
        finally:
            self._mirror_active = prev

    def to_mesh(self, rig: RigData | None = None, *, morph: bool = True, static: bool = False,
                pose: SculptPose | None = None) -> MeshData:
        """Greedy-mesh all segments. With `pose`, the segments are in the sculpt pose of that `SculptPose`."""
        if pose is not None and static:
            raise ValueError(f'{self.name}: a static mesh has no sculpt pose.')
        all_pos, all_nrm, all_uv, all_uv1, all_idx = [], [], [], [], []
        all_joints, all_weights = [], []
        all_slim, all_heavy = [], []
        regions: dict[str, list[int]] = {}

        v_offset = 0
        idx_offset = 0

        for seg in self.segments:
            pos, nrm, uv, uv1, idx = seg.build_geometry()
            if len(pos) == 0:
                continue
            n_v = len(pos)
            n_i = len(idx)
            sculpted = pos
            if pose is not None:
                pos = pose.to_bind(seg.bone, sculpted).astype(np.float32)
            all_pos.append(pos)
            all_nrm.append(nrm)
            all_uv.append(uv)
            all_uv1.append(uv1)
            all_idx.append(idx + v_offset)

            if not static:
                if rig is None or not seg.bone:
                    raise ValueError(f'{self.name}: skinned segment requires rig and bone name')
                j_idx = rig.index[seg.bone]
                j_arr = np.zeros((n_v, 4), dtype=np.uint8)
                w_arr = np.zeros((n_v, 4), dtype=np.float32)
                j_arr[:, 0] = j_idx
                w_arr[:, 0] = 1.0
                all_joints.append(j_arr)
                all_weights.append(w_arr)

            if morph and not static:
                cx, _, cz = seg.morph_center
                d_slim, d_heavy = seg.morph_scale
                slim_delta = np.zeros_like(sculpted)
                heavy_delta = np.zeros_like(sculpted)
                # Orthogonal X/Z expansion/contraction around bone centerline keeps normals 100% orthogonal
                slim_delta[:, 0] = (sculpted[:, 0] - cx) * d_slim
                slim_delta[:, 2] = (sculpted[:, 2] - cz) * d_slim
                heavy_delta[:, 0] = (sculpted[:, 0] - cx) * d_heavy
                heavy_delta[:, 2] = (sculpted[:, 2] - cz) * d_heavy
                if pose is not None:
                    slim_delta = pose.delta_to_bind(seg.bone, slim_delta).astype(np.float32)
                    heavy_delta = pose.delta_to_bind(seg.bone, heavy_delta).astype(np.float32)
                all_slim.append(slim_delta)
                all_heavy.append(heavy_delta)

            if seg.tag:
                if seg.tag not in regions:
                    regions[seg.tag] = [idx_offset, n_i]
                else:
                    # Emit [first_index, index_count] matching polyRig.ts and animationAudit.ts
                    prev_start, prev_count = regions[seg.tag]
                    new_start = min(prev_start, idx_offset)
                    new_end = max(prev_start + prev_count, idx_offset + n_i)
                    regions[seg.tag] = [new_start, new_end - new_start]

            v_offset += n_v
            idx_offset += n_i

        if not all_pos:
            raise ValueError(f'{self.name}: voxel part generated zero geometry.')

        positions = np.concatenate(all_pos, axis=0)
        normals = np.concatenate(all_nrm, axis=0)
        uvs = np.concatenate(all_uv, axis=0)
        uv1s = np.concatenate(all_uv1, axis=0)
        indices = np.concatenate(all_idx, axis=0)

        extras = {
            'polyBakeAo': all(seg.bake_ao for seg in self.segments if np.any(seg.data)),
        }
        own_tags = set(regions)
        covers = [c for c in self.covers if c not in own_tags]
        if regions:
            extras['polyRegions'] = regions
        if covers:
            extras['polyCovers'] = covers

        morphs = None
        if morph and not static and all_slim:
            morphs = {
                'body_slim': np.concatenate(all_slim, axis=0),
                'body_heavy': np.concatenate(all_heavy, axis=0),
            }

        return MeshData(
            name=self.name,
            positions=positions,
            normals=normals,
            uvs=uvs,
            uv1s=uv1s,
            indices=indices,
            joints=None if static else np.concatenate(all_joints, axis=0),
            weights=None if static else np.concatenate(all_weights, axis=0),
            morphs=morphs,
            extras=extras or None,
        )


# --------------------------------------------------------------------------
# Ragdoll collider fitter (identical contract to run-poly-packs)
# --------------------------------------------------------------------------

def infer_rig_id(rig):
    if 'pelvis' in rig.index and 'Head' in rig.index and len(rig.names) == 53:
        return 'ual1'
    if 'leg_fl_upper' in rig.index:
        return 'quadruped'
    if 'leg_1_l_coxa' in rig.index:
        return 'arachnid'
    raise ValueError(f'Unknown rig layout ({len(rig.names)} joints)')


def ragdoll_group_for(rig_id, bone_name):
    if bone_name == 'root':
        return None
    if rig_id == 'ual1':
        if bone_name == 'pelvis':
            return 'pelvis'
        if bone_name in ('spine_01', 'spine_02'):
            return 'spine_01'
        if bone_name in ('spine_03', 'neck_01', 'clavicle_l', 'clavicle_r'):
            return 'spine_03'
        if bone_name == 'Head':
            return 'Head'
        if bone_name in ('upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r',
                         'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r'):
            return bone_name
        if bone_name == 'ball_l':
            return 'foot_l'
        if bone_name == 'ball_r':
            return 'foot_r'
        if bone_name == 'hand_l' or bone_name.endswith('_l'):
            return 'hand_l'
        if bone_name == 'hand_r' or bone_name.endswith('_r'):
            return 'hand_r'
        return None
    return bone_name


def _capsule_axis(group_name, rig, rig_id, pts):
    def unit(v, fallback):
        n = float(np.linalg.norm(v))
        return (v / n) if n > 1e-6 else np.array(fallback, dtype=np.float64)

    if rig_id == 'ual1':
        if group_name in ('pelvis', 'spine_01', 'spine_03'):
            return np.array([1.0, 0.0, 0.0])
        if group_name in ('Head', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r'):
            return np.array([0.0, 1.0, 0.0])
        if group_name in ('upperarm_l', 'lowerarm_l', 'hand_l'):
            return np.array([1.0, 0.0, 0.0])
        if group_name in ('upperarm_r', 'lowerarm_r', 'hand_r'):
            return np.array([-1.0, 0.0, 0.0])
        if group_name in ('foot_l', 'foot_r'):
            return np.array([0.0, 0.0, 1.0])
    elif rig_id == 'quadruped':
        if group_name == 'neck' and 'head' in rig.index:
            return unit(rig.world[rig.index['head']][:3, 3] - rig.world[rig.index['neck']][:3, 3], (0.0, 1.0, 1.0))
        if group_name.endswith('_upper'):
            child = group_name.replace('_upper', '_lower')
            if child in rig.index:
                return unit(rig.world[rig.index[child]][:3, 3] - rig.world[rig.index[group_name]][:3, 3], (0.0, -1.0, 0.0))
        if group_name.endswith('_lower'):
            child = group_name.replace('_lower', '_paw')
            if child in rig.index:
                return unit(rig.world[rig.index[child]][:3, 3] - rig.world[rig.index[group_name]][:3, 3], (0.0, -1.0, 0.0))
        if group_name.startswith('tail_'):
            return np.array([0.0, 0.0, -1.0])
        return np.array([0.0, 0.0, 1.0])
    elif rig_id == 'arachnid':
        if group_name.endswith('_coxa'):
            child = group_name.replace('_coxa', '_femur')
            if child in rig.index:
                return unit(rig.world[rig.index[child]][:3, 3] - rig.world[rig.index[group_name]][:3, 3], (1.0, 0.0, 0.0))
        if group_name.endswith('_femur'):
            child = group_name.replace('_femur', '_tibia')
            if child in rig.index:
                return unit(rig.world[rig.index[child]][:3, 3] - rig.world[rig.index[group_name]][:3, 3], (1.0, 1.0, 0.0))
        if group_name.endswith('_tibia'):
            j_pos = rig.world[rig.index[group_name]][:3, 3]
            lowest = pts[np.argsort(pts[:, 1])[:max(3, len(pts) // 8)]].mean(axis=0)
            return unit(lowest - j_pos, (0.0, -1.0, 0.0))
        return np.array([0.0, 0.0, 1.0])
    return np.array([0.0, 1.0, 0.0])


def measure_ragdoll_colliders(mesh: MeshData, rig: RigData, rig_id='ual1'):
    if mesh.joints is None or mesh.weights is None:
        return {}
    group_points = {}
    group_of_joint = [ragdoll_group_for(rig_id, name) for name in rig.names]
    for vi in range(len(mesh.positions)):
        acc = {}
        for j, w in zip(mesh.joints[vi], mesh.weights[vi]):
            if w <= 1e-4:
                continue
            grp = group_of_joint[int(j)]
            if grp is not None:
                acc[grp] = acc.get(grp, 0.0) + float(w)
        if not acc:
            continue
        best_grp, best_w = max(acc.items(), key=lambda kv: kv[1])
        if best_w >= 0.35:
            group_points.setdefault(best_grp, []).append(mesh.positions[vi])

    colliders = {}
    for grp, raw_list in group_points.items():
        if len(raw_list) < 4 or grp not in rig.index:
            continue
        pts = np.unique(np.round(np.asarray(raw_list, dtype=np.float64), 4), axis=0)
        if len(pts) < 4:
            pts = np.asarray(raw_list, dtype=np.float64)
        j_idx = rig.index[grp]
        j_pos = rig.world[j_idx][:3, 3]
        r_bind_t = rig.world[j_idx][:3, :3].T
        axis = _capsule_axis(grp, rig, rig_id, pts)

        if rig_id == 'ual1' and grp in ('pelvis', 'spine_01', 'spine_03'):
            near = pts[np.linalg.norm(pts - j_pos, axis=1) <= 0.32]
            if len(near) >= 6:
                pts = near
        if rig_id == 'ual1' and grp == 'Head':
            near = pts[np.linalg.norm(pts - (j_pos + np.array([0.0, 0.14, 0.02])), axis=1) <= 0.28]
            if len(near) >= 6:
                pts = near

        center = 0.5 * (pts.min(axis=0) + pts.max(axis=0))
        if rig_id == 'ual1' and grp in ('foot_l', 'foot_r'):
            center[1] = float(np.clip(center[1], 0.045, 0.085))
        if (rig_id == 'quadruped' and (grp.endswith('_upper') or grp.endswith('_lower'))) or (
            rig_id == 'arachnid' and (grp.endswith('_coxa') or grp.endswith('_femur') or grp.endswith('_tibia'))
        ):
            center = np.median(pts, axis=0)

        if rig_id == 'quadruped' and (grp in ('chest', 'jaw') or grp.endswith('_paw')):
            low, high = pts.min(axis=0), pts.max(axis=0)
            center = 0.5 * (low + high)
            half = 0.5 * (high - low)
            radius = max(0.016, min(0.24, float(min(half[0], half[1]))))
            reach = max(0.0, float(half[2]) - radius)
            a_local = r_bind_t @ ((center - np.array([0.0, 0.0, reach])) - j_pos)
            b_local = r_bind_t @ ((center + np.array([0.0, 0.0, reach])) - j_pos)
            colliders[grp] = {
                'type': 'capsule',
                'a': [round(float(v), 5) for v in a_local],
                'b': [round(float(v), 5) for v in b_local],
                'radius': round(float(radius), 5),
            }
            continue

        rel = pts - center
        s = rel @ axis
        perp = np.linalg.norm(rel - np.outer(s, axis), axis=1)
        pct = 75 if (rig_id == 'arachnid' and grp.endswith('_tibia')) else 86
        radius = max(0.016, min(0.24, float(np.percentile(perp, pct)) * 0.94))
        if rig_id == 'ual1' and grp in ('foot_l', 'foot_r'):
            radius = min(radius, max(0.04, center[1] - 0.004))

        s_min, s_max = float(s.min()), float(s.max())
        s_mid = 0.5 * (s_min + s_max)
        if rig_id == 'ual1' and grp in ('foot_l', 'foot_r'):
            inset = radius * 0.55
        else:
            inset = radius * (0.68 if (s_max - s_min) > 2.2 * radius else 0.58)
        s_lo = min(s_mid, s_min + inset)
        s_hi = max(s_mid, s_max - inset)
        a_model = center + axis * s_lo
        b_model = center + axis * s_hi
        a_local = r_bind_t @ (a_model - j_pos)
        b_local = r_bind_t @ (b_model - j_pos)
        colliders[grp] = {
            'type': 'capsule',
            'a': [round(float(v), 5) for v in a_local],
            'b': [round(float(v), 5) for v in b_local],
            'radius': round(float(radius), 5),
        }
    return colliders


# --------------------------------------------------------------------------
# Catalog & budget helpers
# --------------------------------------------------------------------------

def finish_budget(kind: str, mesh: MeshData):
    limit = BUDGETS['classes'][kind]['maxTriangles']
    if mesh.triangles > limit:
        raise ValueError(f'{mesh.name}: {mesh.triangles} triangles exceed {kind} budget ({limit}).')


def part_entry(mesh: MeshData, pack: str, slot: str, label: str, path: str, *, hides_hair=False, hides_legs_upper=False, rig_id='ual1'):
    finish_budget(slot, mesh)
    entry = {
        'id': mesh.name,
        'pack': pack,
        'leaf': 'characters',
        'relativePath': path,
        'nodeName': mesh.name,
        'slot': slot,
        'label': label,
        'triangles': mesh.triangles,
        'rigId': rig_id,
        'rules': {'hidesHair': hides_hair, 'hidesLegsUpper': hides_legs_upper},
    }
    if mesh.extras and 'polyRagdollColliders' in mesh.extras:
        entry['ragdollColliders'] = mesh.extras['polyRagdollColliders']
    return entry


def held_entry(mesh: MeshData, pack: str, label: str, hand: str, path: str, size: int, *, grip_style: str = 'handle'):
    finish_budget('held', mesh)
    limit = BUDGETS['classes']['held']['maxBytes']
    if size > limit:
        raise ValueError(f'{mesh.name}: {size} bytes exceed the held budget ({limit}).')
    return {
        'id': mesh.name,
        'pack': pack,
        'leaf': 'characters',
        'relativePath': path,
        'nodeName': mesh.name,
        'label': label,
        'hand': hand,
        'gripStyle': grip_style,
        'triangles': mesh.triangles,
    }


def prop_entry(mesh: MeshData, pack: str, label: str, path: str, size: int):
    finish_budget('prop', mesh)
    limit = BUDGETS['classes']['prop']['maxBytes']
    if size > limit:
        raise ValueError(f'{mesh.name}: {size} bytes exceed the prop budget ({limit}).')
    bounds = mesh.bounds()
    if abs(bounds['min'][1]) > 0.005:
        raise ValueError(f'{mesh.name}: prop is not grounded on y=0 (min.y={bounds["min"][1]})')
    for axis in (0, 2):
        if abs(bounds['min'][axis] + bounds['max'][axis]) / 2 > 0.05:
            raise ValueError(f'{mesh.name}: prop is not centered on X/Z ({bounds["min"][axis]}..{bounds["max"][axis]})')
    return {
        'id': mesh.name,
        'pack': pack,
        'leaf': 'world',
        'relativePath': path,
        'nodeName': mesh.name,
        'label': label,
        'triangles': mesh.triangles,
        'bounds': bounds,
    }


def pack_catalog(pack: str, *, parts=(), held=(), props=(), presets=(), clips=(), rig_model_path=None, creature_rigs=None):
    catalog = {
        'version': 1,
        'pack': pack,
        'label': PACKS[pack]['label'],
        'license': PACKS[pack]['license'],
        'clips': list(clips),
        'parts': list(parts),
        'heldItems': list(held),
        'props': list(props),
        'presets': list(presets),
    }
    if rig_model_path:
        catalog['rigModelPath'] = rig_model_path
    if creature_rigs:
        catalog['creatureRigs'] = list(creature_rigs)
    return catalog


def leaf_dir(stage, pack: str, kind: str) -> Path:
    definition = PACKS[pack]
    leaf = 'characters' if kind == 'characters' else definition['worldTheme']
    return Path(stage) / definition['dir'] / '3D' / leaf


def script_args(description: str, *names: str):
    import argparse
    import sys
    parser = argparse.ArgumentParser(description=description)
    for name in names:
        parser.add_argument(f'--{name}', type=Path, required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
