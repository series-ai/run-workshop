"""RUN Poly Packs geometry kit for Blender 5.1 Python.

Coordinate space: glTF. +Y is up, +Z is forward, +X is the left side of the
character. The unit is the metre. No axis conversion occurs at export.

The kit has four layers:
  1. GLB input and output. The rig bytes (joints, inverse bind matrices, clips)
     are copied without change.
  2. `Part`: a faceted mesh builder. Each polygon gets a flat normal, a palette
     region (UV u) and a baked shade ramp (UV v).
  3. `WeightSolver`: KDTree skin weight transfer from the UAL1 bind body.
  4. Anatomy: `BodySpec` and the ring functions that bodies and outfits share.

Visual rules: see docs/visual-direction.md (F1..F6, S1..S5, M1..M4).
"""

from __future__ import annotations

import json
import math
import re
import struct
from contextlib import contextmanager
from dataclasses import dataclass, replace
from pathlib import Path

import numpy as np
from mathutils import Matrix, Vector
from mathutils.kdtree import KDTree

TOOL_ROOT = Path(__file__).resolve().parent.parent
CONTRACTS = TOOL_ROOT / 'contracts'

MATERIAL_NAME = 'Poly_Atlas_Mat'
REGIONS = ('skin', 'hair', 'primary', 'secondary', 'accent', 'metal', 'eye')
V_MIN, V_MAX = 0.15, 0.85

X = Vector((1.0, 0.0, 0.0))
Y = Vector((0.0, 1.0, 0.0))
Z = Vector((0.0, 0.0, 1.0))


def V(x, y, z):
    return Vector((float(x), float(y), float(z)))


# --------------------------------------------------------------------------
# Contracts
# --------------------------------------------------------------------------

def load_region_u():
    """Read the UV u value of each palette region from contracts/palette.ts."""
    text = (CONTRACTS / 'palette.ts').read_text()
    block = re.search(r'PALETTE_REGION_U[^=]*=\s*\{([^}]*)\}', text)
    if not block:
        raise ValueError('contracts/palette.ts has no PALETTE_REGION_U block.')
    values = {name: float(value) for name, value in re.findall(r'(\w+):\s*([0-9.]+)', block.group(1))}
    if tuple(values) != REGIONS:
        raise ValueError(f'Palette regions changed: {tuple(values)}')
    return values


REGION_U = load_region_u()


def load_json(name):
    return json.loads((CONTRACTS / 'data' / name).read_text())


BUDGETS = load_json('budgets.json')
PACKS = load_json('packs.json')['packs']
RIG_CONTRACT = load_json('ual1-rig.json')


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
    return (struct.pack('<III', 0x46546C67, 2, length)
            + struct.pack('<II', len(header), 0x4E4F534A) + header
            + struct.pack('<II', len(payload), 0x004E4942) + payload)


def accessor_bytes(document, binary, index):
    """Return the accessor definition and its exact, tightly packed bytes."""
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
    values = np.frombuffer(data, dtype=_COMPONENT[item['componentType']])
    return values.reshape(item['count'], _TYPE_SIZE[item['type']])


class Rig:
    """A skeleton and clips of a GLB. UAL1 rig bytes stay exact."""

    def __init__(self, path, expected_joints=None):
        self.path = Path(path)
        self.doc, self.bin = read_glb(path)
        skins = self.doc.get('skins', [])
        if len(skins) != 1:
            raise ValueError(f'{path}: expected one skin, found {len(skins)}.')
        self.skin = skins[0]
        nodes = self.doc['nodes']
        self.joint_nodes = list(self.skin['joints'])
        self.names = [nodes[index]['name'] for index in self.joint_nodes]
        target_joints = RIG_CONTRACT['joints'] if expected_joints is None else list(expected_joints)
        if self.names != target_joints:
            raise ValueError(f'{path}: the joint order differs from rig contract.')
        self.index = {name: index for index, name in enumerate(self.names)}
        parent_of = {child: index for index, node in enumerate(nodes) for child in node.get('children', [])}
        node_to_joint = {node: joint for joint, node in enumerate(self.joint_nodes)}
        self.parent = [node_to_joint.get(parent_of.get(node)) for node in self.joint_nodes]
        self.children = [[] for _ in self.names]
        for joint, parent in enumerate(self.parent):
            if parent is not None:
                self.children[parent].append(joint)
        inverse = accessor_array(self.doc, self.bin, self.skin['inverseBindMatrices'])
        # glTF matrices are column-major.
        self.inverse_bind = inverse.reshape(-1, 4, 4).transpose(0, 2, 1).astype(np.float64)
        self.world = np.linalg.inv(self.inverse_bind)
        self.position = {name: Vector(self.world[index][:3, 3]) for name, index in self.index.items()}
        self.clips = [clip['name'] for clip in self.doc.get('animations', [])]

    def joint(self, name):
        return self.position[name]

    def frame(self, name):
        """Bind-pose world rotation of a joint as a 3x3 matrix."""
        return Matrix(self.world[self.index[name]][:3, :3].tolist())

    def check_contract(self, tolerance=2e-4, contract=None, check_clips=True):
        spec = RIG_CONTRACT if contract is None else contract
        for name, expected in spec['worldPositions'].items():
            if (self.position[name] - Vector(expected)).length > tolerance:
                raise ValueError(f'Joint {name} is not at the contract bind position.')
        if check_clips and self.clips and self.clips != [clip['name'] for clip in spec['clips']]:
            raise ValueError('The clip list differs from the rig contract.')


@dataclass
class MeshData:
    """Vertex data of one primitive. Skin and morph data are optional."""
    name: str
    positions: np.ndarray
    normals: np.ndarray
    uvs: np.ndarray
    indices: np.ndarray
    joints: np.ndarray | None = None
    weights: np.ndarray | None = None
    morphs: dict | None = None
    extras: dict | None = None

    @property
    def triangles(self):
        return len(self.indices) // 3

    def bounds(self):
        low, high = self.positions.min(axis=0), self.positions.max(axis=0)
        return {'min': [round(float(v), 5) for v in low], 'max': [round(float(v), 5) for v in high],
                'size': [round(float(v), 5) for v in high - low]}


class GlbBuilder:
    def __init__(self):
        self.doc = {
            'asset': {'version': '2.0', 'generator': 'RUN Poly Packs polykit'},
            'scene': 0,
            'scenes': [{'name': 'Scene', 'nodes': []}],
            'nodes': [],
            'meshes': [],
            'materials': [{
                'name': MATERIAL_NAME,
                'doubleSided': False,
                'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0.0, 'roughnessFactor': 0.82},
            }],
            'accessors': [],
            'bufferViews': [],
        }
        self.bin = bytearray()
        self.rig_root = None
        self._shared = {}

    def _view(self, data, target=None):
        self.bin.extend(bytes((-len(self.bin)) % 4))
        view = {'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': len(data)}
        if target is not None:
            view['target'] = target
        self.bin.extend(data)
        self.doc['bufferViews'].append(view)
        return len(self.doc['bufferViews']) - 1

    def _accessor(self, array, kind, target=None, bounds=False):
        array = np.ascontiguousarray(array)
        item = {'bufferView': self._view(array.tobytes(), target), 'componentType': _COMPONENT_ID[array.dtype],
                'count': int(array.shape[0]), 'type': kind}
        if bounds:
            if array.ndim == 1:
                item['min'] = [float(array.min())]
                item['max'] = [float(array.max())]
            else:
                item['min'] = [float(v) for v in array.min(axis=0)]
                item['max'] = [float(v) for v in array.max(axis=0)]
        self.doc['accessors'].append(item)
        return len(self.doc['accessors']) - 1

    def _copy_accessor(self, rig, index):
        """Copy exact accessor bytes from the rig source. Equal data is stored one time."""
        item, data = accessor_bytes(rig.doc, rig.bin, index)
        key = (item['componentType'], item['type'], item['count'], bytes(data))
        if key not in self._shared:
            copy = {name: value for name, value in item.items() if name not in ('bufferView', 'byteOffset')}
            copy['bufferView'] = self._view(data)
            self.doc['accessors'].append(copy)
            self._shared[key] = len(self.doc['accessors']) - 1
        return self._shared[key]

    def _build_clip(self, clip):
        """Build a glTF animation dict from {'name', 'times', 'tracks'} onto the 53-joint UAL1 rig."""
        times = np.asarray(clip['times'], dtype=np.float32)
        time_acc = self._accessor(times, 'SCALAR', bounds=True)
        samplers, channels = [], []
        for joint_idx, tracks in sorted(clip['tracks'].items()):
            for path, values in sorted(tracks.items()):
                kind = 'VEC4' if path == 'rotation' else 'VEC3'
                out_acc = self._accessor(np.asarray(values, dtype=np.float32), kind)
                samplers.append({'input': time_acc, 'output': out_acc, 'interpolation': 'LINEAR'})
                channels.append({'sampler': len(samplers) - 1, 'target': {'node': int(joint_idx), 'path': path}})
        return {'name': clip['name'], 'samplers': samplers, 'channels': channels}

    def add_rig(self, rig, with_clips, replace_clips=None):
        """Add the 53 joints in skin order, the exact inverse bind matrices and (optionally) all clips."""
        if self.doc['nodes']:
            raise ValueError('Add the rig before the meshes.')
        source_nodes = rig.doc['nodes']
        remap = {node: joint for joint, node in enumerate(rig.joint_nodes)}
        for node in rig.joint_nodes:
            copy = {key: value for key, value in source_nodes[node].items() if key in ('name', 'translation', 'rotation', 'scale')}
            children = [remap[child] for child in source_nodes[node].get('children', [])]
            if children:
                copy['children'] = children
            self.doc['nodes'].append(copy)
        roots = [joint for joint, parent in enumerate(rig.parent) if parent is None]
        self.rig_root = len(self.doc['nodes'])
        self.doc['nodes'].append({'name': 'UAL1_Rig', 'children': roots})
        self.doc['scenes'][0]['nodes'].append(self.rig_root)
        self.doc['skins'] = [{'name': 'UAL1_Rig', 'joints': list(range(len(rig.joint_nodes))),
                              'inverseBindMatrices': self._copy_accessor(rig, rig.skin['inverseBindMatrices'])}]
        if with_clips:
            replacements = dict(replace_clips or {})
            clips = []
            for clip in rig.doc['animations']:
                if clip['name'] in replacements:
                    clips.append(self._build_clip(replacements[clip['name']]))
                    continue
                samplers = [{'input': self._copy_accessor(rig, sampler['input']),
                             'output': self._copy_accessor(rig, sampler['output']),
                             'interpolation': sampler.get('interpolation', 'LINEAR')} for sampler in clip['samplers']]
                channels = [{'sampler': channel['sampler'],
                             'target': {'node': remap[channel['target']['node']], 'path': channel['target']['path']}}
                            for channel in clip['channels']]
                clips.append({'name': clip['name'], 'samplers': samplers, 'channels': channels})
            self.doc['animations'] = clips

    def add_clip(self, clip):
        """Append a retargeted clip dict {'name', 'times', 'tracks'} onto the 53-joint UAL1 rig."""
        if 'animations' not in self.doc:
            self.doc['animations'] = []
        self.doc['animations'].append(self._build_clip(clip))

    def add_custom_rig(self, contract, animations=None, rig_name='Creature_Rig'):
        """Add a procedural creature rig from a contract JSON + optional sampled animations."""
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
            # glTF MAT4 is column-major
            ibm[i] = mat.T
        roots = [i for i, name in enumerate(joints) if parents[name] is None]
        self.rig_root = len(self.doc['nodes'])
        self.doc['nodes'].append({'name': rig_name, 'children': roots})
        self.doc['scenes'][0]['nodes'].append(self.rig_root)
        ibm_flat = ibm.reshape(len(joints), 16)
        self.doc['skins'] = [{'name': rig_name, 'joints': list(range(len(joints))),
                              'inverseBindMatrices': self._accessor(ibm_flat, 'MAT4')}]
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

    def add_mesh(self, mesh, node_extras=None):
        attributes = {
            'POSITION': self._accessor(mesh.positions.astype(np.float32), 'VEC3', ARRAY_BUFFER, bounds=True),
            'NORMAL': self._accessor(mesh.normals.astype(np.float32), 'VEC3', ARRAY_BUFFER),
            'TEXCOORD_0': self._accessor(mesh.uvs.astype(np.float32), 'VEC2', ARRAY_BUFFER),
        }
        skinned = mesh.joints is not None
        if skinned:
            if self.rig_root is None:
                raise ValueError(f'{mesh.name}: a skinned mesh needs the rig.')
            attributes['JOINTS_0'] = self._accessor(mesh.joints.astype(np.uint8), 'VEC4', ARRAY_BUFFER)
            attributes['WEIGHTS_0'] = self._accessor(mesh.weights.astype(np.float32), 'VEC4', ARRAY_BUFFER)
        index_type = np.uint16 if len(mesh.positions) < 65535 else np.uint32
        primitive = {'attributes': attributes, 'material': 0,
                     'indices': self._accessor(mesh.indices.astype(index_type), 'SCALAR', ELEMENT_ARRAY_BUFFER)}
        definition = {'name': mesh.name, 'primitives': [primitive]}
        if mesh.morphs:
            primitive['targets'] = [{'POSITION': self._accessor(delta.astype(np.float32), 'VEC3', ARRAY_BUFFER, bounds=True)}
                                    for delta in mesh.morphs.values()]
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


def write_static_glb(path, mesh):
    builder = GlbBuilder()
    builder.add_mesh(mesh)
    return builder.write(path)


# --------------------------------------------------------------------------
# Skin weights
# --------------------------------------------------------------------------

def mirror_name(name):
    if name.endswith('_l'):
        return name[:-2] + '_r'
    if name.endswith('_r'):
        return name[:-2] + '_l'
    return name


class Skin:
    """How the vertices of a chunk get weights.

    rigid:   fixed bone weights. No KDTree lookup.
    allowed: KDTree result is limited to these bones.
    alias:   KDTree bones are renamed first (for example all fingers -> middle finger).
    blend:   fixed bone weights that are mixed into the KDTree result (bone -> share of the total).
    """

    def __init__(self, allowed=None, alias=None, rigid=None, blend=None):
        self.allowed = frozenset(allowed) if allowed else None
        self.alias = dict(alias or {})
        self.rigid = dict(rigid) if rigid else None
        self.blend = dict(blend) if blend else None
        self._mirror = None

    def mirrored(self):
        if self._mirror is None:
            twin = Skin([mirror_name(name) for name in self.allowed] if self.allowed else None,
                        {mirror_name(key): mirror_name(value) for key, value in self.alias.items()},
                        {mirror_name(key): value for key, value in self.rigid.items()} if self.rigid else None,
                        {mirror_name(key): value for key, value in self.blend.items()} if self.blend else None)
            twin._mirror = self
            self._mirror = twin
        return self._mirror


def rigid(**bones):
    return Skin(rigid=bones)


AUTO = Skin()
SPINE = ('pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01')
SKIN_HEAD = Skin(rigid={'Head': 1.0})
SKIN_TORSO = Skin(allowed=SPINE + ('clavicle_l', 'clavicle_r'))
SKIN_ARM_L = Skin(allowed=('clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l'))
SKIN_SHOULDER_ROOT_L = Skin(rigid={'clavicle_l': 0.96, 'spine_03': 0.04})
SKIN_SHOULDER_CAP_L = Skin(rigid={'clavicle_l': 0.35, 'upperarm_l': 0.65})
SKIN_WRIST_L = Skin(rigid={'lowerarm_l': 0.65, 'hand_l': 0.35})
SKIN_LEG_L = Skin(allowed=('thigh_l', 'calf_l', 'foot_l', 'ball_l'))
SKIN_HIP_SOCKET_L = Skin(rigid={'thigh_l': 0.78, 'pelvis': 0.22})
_FINGERS = [f'{finger}_0{segment}_l' for finger in ('index', 'ring', 'pinky') for segment in (1, 2, 3)]
SKIN_MITTEN_L = Skin(allowed=('hand_l', 'middle_01_l', 'middle_02_l', 'middle_03_l'),
                     alias={name: 'middle_' + name.split('_', 1)[1] for name in _FINGERS})
SKIN_THUMB_L = Skin(allowed=('hand_l', 'thumb_01_l', 'thumb_02_l', 'thumb_03_l'))
SKIN_PALM_L = Skin(allowed=('hand_l', 'lowerarm_l'))


class WeightSolver:
    """KDTree transfer of 4-bone skin weights from the UAL1 bind body."""

    def __init__(self, rig, mesh_name='Jill_Body'):
        self.rig = rig
        nodes = rig.doc['nodes']
        node = next((node for node in nodes if node.get('name') == mesh_name), None)
        if node is None:
            raise ValueError(f'The bind body {mesh_name} is missing from {rig.path}.')
        primitive = rig.doc['meshes'][node['mesh']]['primitives'][0]['attributes']
        self.points = accessor_array(rig.doc, rig.bin, primitive['POSITION']).astype(np.float64)
        self.joints = accessor_array(rig.doc, rig.bin, primitive['JOINTS_0'])
        self.weights = accessor_array(rig.doc, rig.bin, primitive['WEIGHTS_0']).astype(np.float64)
        self.tree = KDTree(len(self.points))
        for index, point in enumerate(self.points):
            self.tree.insert(point, index)
        self.tree.balance()
        self.segments = []
        for joint, name in enumerate(rig.names):
            start = rig.position[name]
            ends = [rig.position[rig.names[child]] for child in rig.children[joint]] or [start]
            for end in ends:
                self.segments.append((name, start, end))

    def _nearest_bone(self, point, allowed):
        best, best_distance = None, float('inf')
        for name, start, end in self.segments:
            if allowed is not None and name not in allowed:
                continue
            axis = end - start
            t = 0.0 if axis.length_squared < 1e-12 else max(0.0, min(1.0, (point - start).dot(axis) / axis.length_squared))
            distance = (point - (start + axis * t)).length
            if distance < best_distance:
                best, best_distance = name, distance
        if best is None:
            raise ValueError('No allowed bone exists for a vertex.')
        return best

    def solve(self, point, skin):
        """Return up to four (joint index, weight) pairs. The weights sum to 1."""
        if skin.rigid:
            pairs = sorted(skin.rigid.items(), key=lambda row: (-row[1], row[0]))[:4]
        else:
            combined = {}
            for _, index, distance in self.tree.find_n(point, 8):
                factor = 1.0 / max(distance, 0.004) ** 2
                for joint, weight in zip(self.joints[index], self.weights[index]):
                    if weight <= 1e-6:
                        continue
                    name = self.rig.names[int(joint)]
                    name = skin.alias.get(name, name)
                    if skin.allowed is not None and name not in skin.allowed:
                        continue
                    combined[name] = combined.get(name, 0.0) + factor * weight
            if not combined:
                combined = {self._nearest_bone(point, skin.allowed): 1.0}
            total = sum(combined.values())
            combined = {name: weight / total for name, weight in combined.items()}
            if skin.blend:
                keep = 1.0 - sum(skin.blend.values())
                combined = {name: weight * keep for name, weight in combined.items()}
                for name, share in skin.blend.items():
                    combined[name] = combined.get(name, 0.0) + share
            pairs = [(name, weight) for name, weight in combined.items() if weight >= 0.02]
            pairs = sorted(pairs, key=lambda row: (-row[1], row[0]))[:4]
        total = sum(weight for _, weight in pairs)
        if total <= 0:
            raise ValueError('A vertex has no bind weight.')
        return [(self.rig.index[name], weight / total) for name, weight in pairs]


class SegmentWeightSolver:
    """Capsule-distance and rigid 4-bone weight solver for procedural creature rigs."""

    def __init__(self, rig):
        self.rig = rig
        self.segments = []
        for joint, name in enumerate(rig.names):
            start = rig.position[name]
            ends = [rig.position[rig.names[child]] for child in rig.children[joint]] or [start]
            for end in ends:
                self.segments.append((name, start, end))

    def solve(self, point, skin):
        if skin.rigid:
            pairs = sorted(skin.rigid.items(), key=lambda row: (-row[1], row[0]))[:4]
        else:
            point = Vector(point)
            scores = {}
            for name, start, end in self.segments:
                if skin.allowed is not None and name not in skin.allowed:
                    continue
                axis = end - start
                t = 0.0 if axis.length_squared < 1e-12 else max(0.0, min(1.0, (point - start).dot(axis) / axis.length_squared))
                distance = (point - (start + axis * t)).length
                w = 1.0 / (max(distance, 0.012) ** 2)
                scores[name] = max(scores.get(name, 0.0), w)
            if not scores:
                raise ValueError('SegmentWeightSolver: no allowed bone exists for vertex.')
            pairs = sorted(scores.items(), key=lambda row: (-row[1], row[0]))[:4]
        total = sum(w for _, w in pairs)
        return [(self.rig.index[name], w / total) for name, w in pairs]


# --------------------------------------------------------------------------
# Faceted mesh builder
# --------------------------------------------------------------------------

def polygon_normal(points):
    """Newell normal. The length is two times the polygon area."""
    normal = Vector((0.0, 0.0, 0.0))
    for index, point in enumerate(points):
        following = points[(index + 1) % len(points)]
        normal.x += (point.y - following.y) * (point.z + following.z)
        normal.y += (point.z - following.z) * (point.x + following.x)
        normal.z += (point.x - following.x) * (point.y + following.y)
    return normal


def centroid(points):
    total = Vector((0.0, 0.0, 0.0))
    for point in points:
        total += point
    return total / len(points)


def ring(center, u, v, ru, rv, n, *, rv_neg=None, squareness=1.0, phase=0.0):
    """A closed n-gon. `squareness` below 1 pushes the corners out (box-like sections)."""
    points = []
    for index in range(n):
        angle = phase + math.tau * index / n
        c, s = math.cos(angle), math.sin(angle)
        cu = math.copysign(abs(c) ** squareness, c)
        sv = math.copysign(abs(s) ** squareness, s)
        radius_v = rv_neg if (s < 0 and rv_neg is not None) else rv
        points.append(center + u * (ru * cu) + v * (radius_v * sv))
    return points


def rect_ring(center, u, v, half_u, half_v, corner=0.0):
    """A rectangle (4 points) or a rectangle with cut corners (8 points)."""
    if corner <= 0:
        return [center + u * (su * half_u) + v * (sv * half_v) for su, sv in ((1, -1), (1, 1), (-1, 1), (-1, -1))]
    points = []
    for su, sv in ((1, -1), (1, 1), (-1, 1), (-1, -1)):
        a = center + u * (su * half_u) + v * (sv * (half_v - corner))
        b = center + u * (su * (half_u - corner)) + v * (sv * half_v)
        points.extend((b, a) if su * sv < 0 else (a, b))
    return points


def frame_from(normal, up):
    """Return right, up, normal as unit vectors. `up` is made perpendicular to `normal`."""
    n = normal.normalized()
    up = up - n * up.dot(n)
    if up.length < 1e-6:
        raise ValueError('The up vector is parallel to the normal.')
    up.normalize()
    return up.cross(n), up, n


class Part:
    """A faceted mesh. Every polygon is flat shaded and has one palette region."""

    def __init__(self, name):
        self.name = name
        self.pos = []
        self.ref = []
        self.vskin = []
        self.faces = []      # (vertex ids, region, ao, group, tag)
        self.skin = AUTO
        self.tag = None      # body region label (used for culling under outfits)
        self.covers = []     # body regions that this outfit hides
        self._groups = 0
        self._anchor = None
        self._matrix = None

    # ---- vertices and faces ------------------------------------------------

    def vert(self, point, ref=None):
        point = Vector(point)
        if self._matrix is not None:
            point = self._matrix @ point
            ref = self._matrix @ Vector(ref) if ref is not None else None
        if ref is None and self._anchor is not None:
            ref = self._anchor
        self.pos.append(point)
        self.ref.append(Vector(ref) if ref is not None else None)
        self.vskin.append(self.skin)
        return len(self.pos) - 1

    def group(self):
        self._groups += 1
        return self._groups

    def face(self, ids, region, *, ao=0.0, group=None, away_from=None, toward=None, tag=None):
        """Add a polygon. `away_from` (a point) or `toward` (a direction) sets the outward side."""
        if region not in REGION_U:
            raise ValueError(f'Unknown palette region "{region}".')
        ids = tuple(ids)
        points = [self.pos[index] for index in ids]
        normal = polygon_normal(points)
        if away_from is not None and normal.dot(centroid(points) - away_from) < 0:
            ids = ids[::-1]
        elif toward is not None and normal.dot(toward) < 0:
            ids = ids[::-1]
        self.faces.append((ids, region, ao, group if group is not None else self.group(), tag if tag is not None else self.tag))

    @contextmanager
    def anchored(self, point):
        """Vertices made inside use the skin weights of `point`. The chunk then moves as one piece."""
        previous, self._anchor = self._anchor, Vector(point)
        try:
            yield
        finally:
            self._anchor = previous

    @contextmanager
    def skinned(self, skin):
        previous, self.skin = self.skin, skin
        try:
            yield
        finally:
            self.skin = previous

    @contextmanager
    def tagged(self, tag):
        previous, self.tag = self.tag, tag
        try:
            yield
        finally:
            self.tag = previous

    @contextmanager
    def placed(self, matrix):
        """Vertices made inside are transformed by `matrix` (a 4x4 Matrix)."""
        previous = self._matrix
        self._matrix = matrix if previous is None else previous @ matrix
        try:
            yield
        finally:
            self._matrix = previous

    @contextmanager
    def mirrored(self):
        """Build the left side inside the block. The block exit adds the right side."""
        first_vertex, first_face, first_group = len(self.pos), len(self.faces), self._groups
        yield
        last_vertex, last_face = len(self.pos), len(self.faces)
        offset = self._groups - first_group
        self._groups += offset
        remap = {}
        for index in range(first_vertex, last_vertex):
            point, ref = self.pos[index], self.ref[index]
            self.pos.append(Vector((-point.x, point.y, point.z)))
            self.ref.append(Vector((-ref.x, ref.y, ref.z)) if ref is not None else None)
            self.vskin.append(self.vskin[index].mirrored())
            remap[index] = len(self.pos) - 1
        for ids, region, ao, group, tag in self.faces[first_face:last_face]:
            self.faces.append((tuple(remap[index] for index in reversed(ids)), region, ao, group + offset, tag))

    # ---- primitives ----------------------------------------------------------

    def loft(self, rings, region, *, refs=None, closed=True, cap_start=False, cap_end=False,
             tip_start=None, tip_end=None, ao=0.0, band_regions=None, band_ao=None, band_tags=None, toward=None,
             ring_skins=None, two_sided=False, thickness=0.005, inner_ao=-0.18, inner_region=None):
        """Join a list of rings with quads. Optional flat caps or pointed tips close the ends.

        `refs` gives a weight sample point for each ring point. `ring_skins` gives one Skin for each ring.
        `two_sided=True` adds a solid inner lining offset opposite the front normal so FrontSide renders cleanly.
        """
        count = len(rings[0])
        if any(len(points) != count for points in rings):
            raise ValueError('All rings of a loft need the same point count.')
        group = self.group()
        ids = []
        for row, points in enumerate(rings):
            with self.skinned(ring_skins[row] if ring_skins and ring_skins[row] is not None else self.skin):
                ids.append([self.vert(point, refs[row][column] if refs else None) for column, point in enumerate(points)])
        # Use the stored vertices: inside `placed()` they differ from the ring points, and the
        # outward test of `face()` works in the space of the stored vertices.
        centers = [centroid([self.pos[index] for index in row]) for row in ids]
        if toward is not None and self._matrix is not None:
            toward = self._matrix.to_3x3() @ Vector(toward)
        sides = count if closed else count - 1
        bands = []
        for row in range(len(rings) - 1):
            middle = (centers[row] + centers[row + 1]) / 2
            for column in range(sides):
                following = (column + 1) % count
                bands.append((row, column, middle,
                              (ids[row][column], ids[row][following], ids[row + 1][following], ids[row + 1][column])))
        # All quads of a loft share one winding, so one decision sets the outward side of the full loft.
        # A test for each quad fails on a flat step (two rings at one height): its normal is along the axis.
        outward = sum(polygon_normal([self.pos[index] for index in quad]).dot(
            centroid([self.pos[index] for index in quad]) - middle) for _, _, middle, quad in bands)
        front_faces = []
        for row, column, middle, quad in bands:
            band_region = band_regions[row] if band_regions else region
            band_shade = band_ao[row] if band_ao else ao
            tag = band_tags[row] if band_tags else None
            before = len(self.faces)
            if toward is not None:
                self.face(quad, band_region, ao=band_shade, group=group, toward=toward, tag=tag)
            else:
                self.face(quad if outward >= 0 else quad[::-1], band_region, ao=band_shade, group=group, tag=tag)
            front_faces.append((row, column, band_region, tag, self.faces[before][0]))
        if two_sided:
            vn = [[Vector((0.0, 0.0, 0.0)) for _ in range(count)] for _ in range(len(rings))]
            for row, column, _, _, ordered_ids in front_faces:
                n = polygon_normal([self.pos[idx] for idx in ordered_ids])
                if n.length > 1e-9:
                    n.normalize()
                for dr in (0, 1):
                    for dc in (0, 1):
                        vn[row + dr][(column + dc) % count] += n
            b_ids = []
            for row, points in enumerate(rings):
                skin_row = ring_skins[row] if ring_skins and ring_skins[row] is not None else self.skin
                with self.skinned(skin_row):
                    b_row = []
                    for col, point in enumerate(points):
                        n = vn[row][col]
                        offset = n.normalized() * thickness if n.length > 1e-9 else Vector((0.0, 0.0, 0.0))
                        ref_pt = refs[row][col] if refs else None
                        b_row.append(self.vert(point - offset, ref_pt))
                    b_ids.append(b_row)
            back_group = self.group()
            for row in range(len(rings) - 1):
                band_region = inner_region or (band_regions[row] if band_regions else region)
                tag = band_tags[row] if band_tags else None
                for column in range(sides):
                    following = (column + 1) % count
                    f_ordered = front_faces[row * sides + column][4]
                    f_norm = polygon_normal([self.pos[idx] for idx in f_ordered])
                    b_quad = (b_ids[row][column], b_ids[row + 1][column], b_ids[row + 1][following], b_ids[row][following])
                    self.face(b_quad, band_region, ao=inner_ao, group=back_group, toward=-f_norm, tag=tag)
        first_region = band_regions[0] if band_regions else region
        last_region = band_regions[-1] if band_regions else region
        first_tag = band_tags[0] if band_tags else None
        last_tag = band_tags[-1] if band_tags else None
        # The start cap looks away from the next ring centre that is at a different place. A loft of one
        # ring is a flat disc: its end cap looks up (+Y) and its start cap looks down.
        other_start = next((point for point in centers[1:] if (point - centers[0]).length > 1e-6), centers[0] + Y)
        other_end = next((point for point in reversed(centers[:-1]) if (point - centers[-1]).length > 1e-6),
                         centers[-1] - Y)
        if cap_start:
            self.face(ids[0], first_region, ao=ao, group=group, toward=centers[0] - other_start, tag=first_tag)
        if cap_end:
            self.face(ids[-1], last_region, ao=ao, group=group, toward=centers[-1] - other_end, tag=last_tag)
        for tip, row, region_name, tag in ((tip_start, 0, first_region, first_tag), (tip_end, -1, last_region, last_tag)):
            if tip is None:
                continue
            apex_skin = ring_skins[row] if ring_skins and ring_skins[row] is not None else self.skin
            with self.skinned(apex_skin):
                apex = self.vert(tip)
            for column in range(sides):
                following = (column + 1) % count
                self.face((ids[row][column], ids[row][following], apex), region_name, ao=ao, group=group,
                          away_from=centers[row], tag=tag)
        return ids

    def tube(self, path, radii, n, region, *, up=Y, squareness=1.0, phase=0.0, **options):
        """Loft along a polyline. `radii` holds one number or one (ru, rv) pair for each path point."""
        rings = []
        for index, point in enumerate(path):
            before = path[max(index - 1, 0)]
            after = path[min(index + 1, len(path) - 1)]
            right, upward, _ = frame_from(after - before, up)
            radius = radii[index]
            ru, rv = radius if isinstance(radius, (tuple, list)) else (radius, radius)
            rings.append(ring(point, right, upward, ru, rv, n, squareness=squareness, phase=phase))
        return self.loft(rings, region, **options)

    def lathe(self, profile, n, region, *, center=(0, 0, 0), scale_z=1.0, squareness=1.0, phase=None, **options):
        """Loft rings around the Y axis. `profile` is a list of (radius, y)."""
        base = Vector(center)
        phase = math.pi / n if phase is None else phase
        rings = [ring(base + Y * height, X, Z, radius, radius * scale_z, n, squareness=squareness, phase=phase)
                 for radius, height in profile]
        return self.loft(rings, region, **options)

    def slab(self, outline, depth, region, *, normal=None, shrink=0.78, back=False, **options):
        """A bevelled plate. The outline is the base. The top face is smaller and raised by `depth`."""
        outline = [Vector(point) for point in outline]
        middle = centroid(outline)
        direction = (Vector(normal) if normal is not None else polygon_normal(outline)).normalized()
        top = [middle + (point - middle) * shrink + direction * depth for point in outline]
        return self.loft([outline, top], region, cap_end=True, cap_start=back, **options)

    def plate(self, center, normal, up, width, height, depth, region, *, shrink=0.78, corner=0.0, back=False, **options):
        """A rectangular bevelled plate on a surface point."""
        right, upward, direction = frame_from(Vector(normal), Vector(up))
        outline = rect_ring(Vector(center), right, upward, width / 2, height / 2, corner)
        return self.slab(outline, depth, region, normal=direction, shrink=shrink, back=back, **options)

    def box(self, center, size, region, *, right=X, up=Y, taper=1.0, bevel=0.0, corner=0.0, cap_start=True, cap_end=True,
            **options):
        """A box along `up`. `taper` scales the top. `bevel` cuts the top and bottom edges, `corner` cuts the side edges."""
        right_axis, up_axis, forward = frame_from(Vector(right).cross(Vector(up)), Vector(up))
        center = Vector(center)
        half_x, half_y, half_z = size[0] / 2, size[1] / 2, size[2] / 2
        tx, tz = taper if isinstance(taper, (tuple, list)) else (taper, taper)

        def section(height, inset):
            t = (height + half_y) / (2 * half_y)
            sx, sz = 1 + (tx - 1) * t, 1 + (tz - 1) * t
            return rect_ring(center + up_axis * height, right_axis, forward, half_x * sx - inset, half_z * sz - inset, corner)

        if bevel > 0:
            rings = [section(-half_y, bevel), section(-half_y + bevel, 0), section(half_y - bevel, 0), section(half_y, bevel)]
        else:
            rings = [section(-half_y, 0), section(half_y, 0)]
        return self.loft(rings, region, cap_start=cap_start, cap_end=cap_end, **options)

    def prism(self, start, end, radius_start, radius_end, n, region, *, up=Y, cap_start=True, cap_end=True, **options):
        """A tapered n-gon prism between two points."""
        start, end = Vector(start), Vector(end)
        return self.tube([start, end], [radius_start, radius_end], n, region, up=up,
                         cap_start=cap_start, cap_end=cap_end, **options)

    # ---- export ----------------------------------------------------------------

    def layout(self):
        """Expand polygons to flat-shaded vertices and triangles. The result depends on topology and base positions."""
        order = []
        for face in self.faces:
            if face[4] not in order:
                order.append(face[4])
        faces = sorted(self.faces, key=lambda face: order.index(face[4]))
        rows, triangles, ranges = [], [], {}
        for ids, region, ao, group, tag in faces:
            points = [self.pos[index] for index in ids]
            if len(ids) == 3:
                local = [(0, 1, 2)]
            elif len(ids) == 4:
                if (points[0] - points[2]).length <= (points[1] - points[3]).length:
                    local = [(0, 1, 2), (0, 2, 3)]
                else:
                    local = [(0, 1, 3), (1, 2, 3)]
            else:
                local = [(0, index, index + 1) for index in range(1, len(ids) - 1)]
            local = [tri for tri in local
                     if (points[tri[1]] - points[tri[0]]).cross(points[tri[2]] - points[tri[0]]).length > 1e-9]
            if not local:
                continue
            normal = polygon_normal(points)
            if normal.length < 1e-12:
                normal = (points[local[0][1]] - points[local[0][0]]).cross(points[local[0][2]] - points[local[0][0]])
            normal.normalize()
            base = len(rows)
            for index in ids:
                rows.append((index, normal, region, ao, group))
            start = ranges.setdefault(tag, [len(triangles) * 3, 0])
            for tri in local:
                triangles.append((base + tri[0], base + tri[1], base + tri[2]))
            start[1] = len(triangles) * 3 - start[0]
        return rows, triangles, ranges

    def to_mesh(self, solver=None, variants=None):
        """Build the vertex data. `variants` maps morph names to parts with the same topology."""
        rows, triangles, ranges = self.layout()
        if not triangles:
            raise ValueError(f'{self.name}: the part has no triangles.')
        spans = {}
        skin_high = 1.984
        for index, _, region, _, group in rows:
            height = self.pos[index].y
            low, high = spans.get(group, (height, height))
            spans[group] = (min(low, height), max(high, height))
            if region == 'skin' and height > skin_high:
                skin_high = height
        positions = np.array([self.pos[index] for index, *_ in rows], dtype=np.float64)
        normals = np.array([normal for _, normal, *_ in rows], dtype=np.float64)
        uvs = np.zeros((len(rows), 2), dtype=np.float64)
        for row, (index, normal, region, ao, group) in enumerate(rows):
            if region == 'skin' and solver is not None:
                gradient = (self.pos[index].y / skin_high) - 0.5
                ny = max(normal.y, -0.30)
                shade = 0.60 + 0.14 * ny + 0.10 * gradient + ao
            else:
                low, high = spans[group]
                gradient = 0.0 if high - low < 1e-6 else (self.pos[index].y - low) / (high - low) - 0.5
                shade = 0.58 + 0.2 * normal.y + 0.14 * gradient + ao
            uvs[row] = (REGION_U[region], min(V_MAX, max(V_MIN, shade)))
        mesh = MeshData(self.name, positions, normals, uvs, np.array(triangles, dtype=np.uint32).reshape(-1))
        extras = {}
        # A part never hides its own geometry: a boot of a legs outfit has the 'foot' tag of the shared foot
        # builder, and the outfit covers 'foot'. Only the regions that some other part can cover go to the file.
        regions = {str(tag): span for tag, span in ranges.items() if tag is not None and tag not in self.covers}
        if regions:
            extras['polyRegions'] = regions
        if self.covers:
            extras['polyCovers'] = list(self.covers)
        mesh.extras = extras or None
        if solver is not None:
            cache = {}
            joints = np.zeros((len(rows), 4), dtype=np.uint8)
            weights = np.zeros((len(rows), 4), dtype=np.float32)
            for row, (index, *_) in enumerate(rows):
                if index not in cache:
                    sample = self.ref[index] if self.ref[index] is not None else self.pos[index]
                    cache[index] = solver.solve(sample, self.vskin[index])
                for slot, (joint, weight) in enumerate(cache[index]):
                    joints[row, slot] = joint
                    weights[row, slot] = weight
            weights /= weights.sum(axis=1, keepdims=True)
            mesh.joints, mesh.weights = joints, weights
        if variants:
            morphs = {}
            for name, other in variants.items():
                # The winding of a face can differ between bodies. The vertex set must not.
                if len(other.pos) != len(self.pos) or ([sorted(face[0]) for face in other.faces]
                                                       != [sorted(face[0]) for face in self.faces]):
                    raise ValueError(f'{self.name}: the "{name}" variant has a different topology.')
                delta = np.array([other.pos[index] for index, *_ in rows], dtype=np.float64) - positions
                if np.abs(delta).max() > 1e-5:
                    morphs[name] = delta
            mesh.morphs = morphs or None
        if not np.isfinite(positions).all():
            raise ValueError(f'{self.name}: a position is not finite.')
        if solver is not None and hasattr(solver, 'rig'):
            rig_id = infer_rig_id(solver.rig)
            colliders = measure_ragdoll_colliders(mesh, solver.rig, rig_id)
            if colliders:
                mesh.extras = {**(mesh.extras or {}), 'polyRagdollColliders': colliders}
        return mesh


_UAL1_FINGER_L = re.compile(r'^(thumb|index|middle|ring|pinky)_0[1-3]_l$')
_UAL1_FINGER_R = re.compile(r'^(thumb|index|middle|ring|pinky)_0[1-3]_r$')


def infer_rig_id(rig):
    if 'leg_fl_upper' in rig.index:
        return 'quadruped'
    if 'leg_1_l_coxa' in rig.index:
        return 'arachnid'
    return 'ual1'


def ragdoll_group_for(rig_id, bone_name):
    if bone_name == 'root':
        return None
    if rig_id != 'ual1':
        return bone_name
    if bone_name in ('spine_02', 'clavicle_l', 'clavicle_r'):
        return 'spine_03'
    if bone_name == 'neck_01':
        return 'Head'
    if _UAL1_FINGER_L.match(bone_name):
        return 'hand_l'
    if _UAL1_FINGER_R.match(bone_name):
        return 'hand_r'
    if bone_name == 'ball_l':
        return 'foot_l'
    if bone_name == 'ball_r':
        return 'foot_r'
    return bone_name


def _capsule_axis(group_name, rig, rig_id, pts):
    def unit(v, fallback):
        n = float(np.linalg.norm(v))
        return (v / n) if n > 1e-6 else np.array(fallback, dtype=np.float64)

    if rig_id == 'ual1':
        if group_name in ('pelvis', 'spine_01', 'spine_03'):
            return np.array([1.0, 0.0, 0.0])
        if group_name == 'Head':
            return np.array([0.0, 1.0, 0.0])
        if group_name in ('upperarm_l', 'lowerarm_l', 'hand_l'):
            return np.array([1.0, 0.0, 0.0])
        if group_name in ('upperarm_r', 'lowerarm_r', 'hand_r'):
            return np.array([-1.0, 0.0, 0.0])
        if group_name in ('thigh_l', 'calf_l', 'thigh_r', 'calf_r'):
            return np.array([0.0, -1.0, 0.0])
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


def measure_ragdoll_colliders(mesh, rig, rig_id='ual1'):
    """Fit bind-pose bone-local capsules to actual mesh vertices per ragdoll body group."""
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

        # Reject distant cape/tail outliers anchored on torso bones when fitting torso capsules
        if rig_id == 'ual1' and grp in ('pelvis', 'spine_01', 'spine_03'):
            near = pts[np.linalg.norm(pts - j_pos, axis=1) <= 0.30]
            if len(near) >= 6:
                pts = near
        if rig_id == 'ual1' and grp == 'Head':
            near = pts[np.linalg.norm(pts - (j_pos + np.array([0.0, 0.14, 0.02])), axis=1) <= 0.24]
            if len(near) >= 6:
                pts = near

        center = 0.5 * (pts.min(axis=0) + pts.max(axis=0))
        if rig_id == 'ual1' and grp in ('thigh_l', 'thigh_r', 'calf_l', 'calf_r'):
            center[0] = float(np.median(pts[:, 0]))
            center[2] = float(np.median(pts[:, 2]))
        if rig_id == 'ual1' and grp in ('foot_l', 'foot_r'):
            center[0] = float(np.median(pts[:, 0]))
            center[1] = float(np.clip(np.median(pts[:, 1]), 0.045, 0.085))
        if (rig_id == 'quadruped' and (grp.endswith('_upper') or grp.endswith('_lower'))) or (
            rig_id == 'arachnid' and (grp.endswith('_coxa') or grp.endswith('_femur') or grp.endswith('_tibia'))
        ):
            center = np.median(pts, axis=0)

        rel = pts - center
        s = rel @ axis
        perp = np.linalg.norm(rel - np.outer(s, axis), axis=1)
        pct = 75 if ((rig_id == 'arachnid' and grp.endswith('_tibia')) or (rig_id == 'ual1' and grp in ('hand_l', 'hand_r'))) else 86
        radius = max(0.016, min(0.24, float(np.percentile(perp, pct)) * 0.94))
        if rig_id == 'ual1' and grp in ('hand_l', 'hand_r'):
            radius = min(radius, 0.034)
        if rig_id == 'ual1' and grp in ('foot_l', 'foot_r'):
            radius = min(radius, max(0.04, center[1] - 0.004))

        s_min, s_max = float(s.min()), float(s.max())
        s_mid = 0.5 * (s_min + s_max)
        inset = radius * (0.88 if (s_max - s_min) > 2.2 * radius else 0.62)
        s_lo = min(s_mid, s_min + inset)
        s_hi = max(s_mid, s_max - inset)
        a_model = center + axis * s_lo
        b_model = center + axis * s_hi
        a_local = r_bind_t @ (a_model - j_pos)
        b_local = r_bind_t @ (b_model - j_pos)
        colliders[grp] = {
            'type': 'capsule',
            'a': [round(float(v), 4) for v in a_local],
            'b': [round(float(v), 4) for v in b_local],
            'radius': round(float(radius), 4),
        }
    return colliders



# --------------------------------------------------------------------------
# Anatomy shared by bodies and outfits
# --------------------------------------------------------------------------

TORSO_SIDES, ARM_SIDES, LEG_SIDES = 10, 6, 8
TORSO_KEYS = ('crotch', 'hips', 'belt', 'waist', 'ribs', 'chest', 'shoulder', 'neck_base', 'neck_top')
SHOULDER = Vector(RIG_CONTRACT['worldPositions']['upperarm_l'])
ELBOW = Vector(RIG_CONTRACT['worldPositions']['lowerarm_l'])
WRIST = Vector(RIG_CONTRACT['worldPositions']['hand_l'])
HIP = Vector(RIG_CONTRACT['worldPositions']['thigh_l'])
KNEE = Vector(RIG_CONTRACT['worldPositions']['calf_l'])
ANKLE = Vector(RIG_CONTRACT['worldPositions']['foot_l'])
BALL = Vector(RIG_CONTRACT['worldPositions']['ball_l'])
HEAD = Vector(RIG_CONTRACT['worldPositions']['Head'])
HEAD_Z = HEAD.z + 0.006


@dataclass(frozen=True)
class Station:
    """One horizontal torso section: height, half width, front depth, back depth, centre z."""
    y: float
    w: float
    zf: float
    zb: float
    zc: float


@dataclass(frozen=True)
class BodySpec:
    id: str
    label: str
    torso: dict
    arm: tuple   # (x, radius y, radius z, centre y offset) for the left arm in the T pose
    leg: tuple   # (y, radius x, radius z, centre x, centre z) for the left leg
    hand: float  # hand thickness scale
    foot: float  # foot width scale


def make_body(body_id, label, *, chest=1.0, waist=1.0, belly=1.0, hips=1.0, depth=1.0, arm=1.0, leg=1.0, neck=1.0,
              shoulder=1.0):
    """Heroic base body. The factors bend the athletic baseline into other archetypes."""
    base_neck = 0.4 + 0.6 * neck
    top_neck = min(neck, 1.0)
    torso = {
        'crotch': Station(0.990, 0.050 * hips, 0.054 * depth, 0.056 * depth, -0.012),
        'hips': Station(1.045, 0.114 * hips, 0.088 * depth * belly, 0.080 * depth, -0.010),
        'belt': Station(1.135, 0.103 * waist, 0.080 * depth * belly, 0.074 * depth, 0.000),
        'waist': Station(1.235, 0.092 * waist, 0.075 * depth * belly, 0.051 * depth, 0.016),
        'ribs': Station(1.355, 0.077 * chest, 0.067 * depth, 0.040 * depth, 0.028),
        'chest': Station(1.465, 0.091 * chest, 0.078 * depth, 0.048 * depth, 0.026),
        'shoulder': Station(1.562, 0.090 * chest, 0.062 * depth, 0.049 * depth, 0.026),
        'neck_base': Station(1.616, 0.065 * base_neck, 0.056 * base_neck, 0.054 * base_neck, 0.024),
        'neck_top': Station(1.708, 0.052 * top_neck, 0.050 * top_neck, 0.050 * top_neck, HEAD_Z),
    }
    arms = (
        (0.072, 0.036 * arm, 0.037 * arm, 0.004),
        (0.136, 0.038 * arm * shoulder, 0.040 * max(arm * shoulder, depth), 0.006),
        (0.255, 0.0275 * arm, 0.0285 * arm, 0.017),
        (0.385, 0.029 * arm, 0.030 * arm, 0.002),
        (0.455, 0.033 * arm, 0.034 * arm, 0.002),
        (0.565, 0.029 * arm, 0.031 * arm, 0.001),
        (0.672, 0.027 * arm, 0.030 * arm, 0.002),
    )
    legs = (
        (1.060, 0.047 * leg, 0.054 * leg, 0.086, -0.016),
        (0.920, 0.047 * leg, 0.055 * leg, 0.088, -0.014),
        (0.685, 0.041 * leg, 0.049 * leg, 0.088, -0.018),
        (0.585, 0.046 * leg, 0.052 * leg, 0.088, -0.026),
        (0.430, 0.051 * leg, 0.059 * leg, 0.090, -0.040),
        (0.108, 0.039 * leg, 0.045 * leg, 0.092, -0.058),
    )
    return BodySpec(body_id, label, torso, arms, legs, hand=0.5 + 0.5 * arm, foot=0.5 + 0.5 * leg)


BODIES = {
    'body_athletic': make_body('body_athletic', 'Athletic'),
    'body_heavy': make_body('body_heavy', 'Heavy', chest=1.01, waist=1.12, belly=1.22, hips=1.03, depth=1.14, arm=1.02,
                            leg=1.02, neck=1.12, shoulder=1.03),
    'body_slim': make_body('body_slim', 'Slim', chest=0.90, waist=0.86, belly=0.90, hips=0.92, depth=0.84, arm=0.86,
                           leg=0.88, neck=0.90, shoulder=0.94),
}


def make_monster_body(body_id, label, *, chest, waist, belly, hips, depth, arm, leg, neck, shoulder, slouch=0.0):
    base = make_body(body_id, label, chest=chest, waist=waist, belly=belly, hips=hips,
                     depth=depth, arm=arm, leg=leg, neck=neck, shoulder=shoulder)
    shifts = {'ribs': slouch * 0.45, 'chest': slouch * 0.85, 'shoulder': slouch * 0.90,
              'neck_base': slouch * 0.45}
    for key, dz in shifts.items():
        st = base.torso[key]
        base.torso[key] = Station(st.y, st.w, st.zf, st.zb, st.zc + dz)
    return base


ORC_BODY = make_monster_body(
    'body_orc', 'Orc Muscular',
    chest=1.04, waist=1.06, belly=1.08, hips=1.02, depth=1.10,
    arm=1.06, leg=1.02, neck=1.22, shoulder=1.08, slouch=0.028,
)
TROLL_BODY = make_monster_body(
    'body_troll', 'Troll Hulking',
    chest=1.05, waist=1.03, belly=1.08, hips=1.01, depth=1.12,
    arm=1.04, leg=1.01, neck=1.16, shoulder=1.08, slouch=0.052,
)
MONSTER_BODIES = {
    'body_orc': ORC_BODY,
    'body_troll': TROLL_BODY,
}
ALL_UAL1_BODIES = {**BODIES, **MONSTER_BODIES}
BASE_BODY = 'body_athletic'


def _lerp_rows(rows, position):
    """Interpolate a tuple table at a fractional row index."""
    position = max(0.0, min(float(position), len(rows) - 1.0))
    low = min(int(math.floor(position)), len(rows) - 2)
    t = position - low
    return tuple(a + (b - a) * t for a, b in zip(rows[low], rows[low + 1]))


def station_at(body, height):
    """Interpolate the torso section at a height."""
    stations = [body.torso[key] for key in TORSO_KEYS]
    if height <= stations[0].y:
        return replace(stations[0], y=height)
    for low, high in zip(stations, stations[1:]):
        if height <= high.y:
            t = (height - low.y) / (high.y - low.y)
            return Station(height, *(getattr(low, name) + (getattr(high, name) - getattr(low, name)) * t
                                     for name in ('w', 'zf', 'zb', 'zc')))
    return replace(stations[-1], y=height)


def torso_ring(body, key, grow=0.0, *, y=None, widen=0.0, front=0.0, back=0.0, squareness=0.65):
    """Torso section at a station name or at a height.

    Point 0 is the left side, points 1..4 are the front, 5 is the right side, 6..9 are the back.
    Facet 2 (points 2 -> 3) is the flat front. Facet 7 is the flat back.
    """
    station = body.torso[key] if isinstance(key, str) else station_at(body, key)
    center = Vector((0.0, station.y if y is None else y, station.zc))
    return ring(center, X, Z, station.w + grow + widen, station.zf + grow + front, TORSO_SIDES,
                rv_neg=station.zb + grow + back, squareness=squareness)


def arm_ring(body, index, grow=0.0, *, x=None, scale=1.0):
    """Left arm section in the T pose at a station index (fractions interpolate). Facet 1 is the flat top."""
    along, ry, rz, lift = _lerp_rows(body.arm, index)
    center = Vector((along if x is None else x, SHOULDER.y + lift, SHOULDER.z - 0.008))
    return ring(center, Z, Y, rz * scale + grow, ry * scale + grow, ARM_SIDES)


def leg_ring(body, index, grow=0.0, *, y=None, scale=1.0, squareness=0.9):
    """Left leg section at a station index (fractions interpolate). Facet 1 is the flat front, facet 7 the outer side."""
    height, rx, rz, cx, cz = _lerp_rows(body.leg, index)
    center = Vector((cx, height if y is None else y, cz))
    return ring(center, X, Z, rx * scale + grow, rz * scale + grow, LEG_SIDES, squareness=squareness,
                phase=math.pi / LEG_SIDES)


def leg_section_at_y(body, height):
    """Interpolate (height, rx, rz, cx, cz) of the left leg at world `height`."""
    rows = body.leg  # ordered top (y=1.065) to bottom (y=0.175)
    if height >= rows[0][0]:
        return (height, *rows[0][1:])
    for high, low in zip(rows, rows[1:]):
        if height >= low[0]:
            span = max(high[0] - low[0], 1e-6)
            t = (height - low[0]) / span
            return (height, *(l + (h - l) * t for l, h in zip(low[1:], high[1:])))
    return (height, *rows[-1][1:])


# Worst-case trouser/breeches/greaves radial thickness envelope along the thigh so split skirts
# clear every compatible leg outfit across every body archetype.
_LEG_OUTFIT_PAD = ((1.065, 0.010), (0.930, 0.015), (0.720, 0.014), (0.600, 0.012))


def leg_outfit_pad(height):
    if height >= _LEG_OUTFIT_PAD[0][0]:
        return _LEG_OUTFIT_PAD[0][1]
    for (y_hi, p_hi), (y_lo, p_lo) in zip(_LEG_OUTFIT_PAD, _LEG_OUTFIT_PAD[1:]):
        if height >= y_lo:
            t = (height - y_lo) / max(y_hi - y_lo, 1e-6)
            return p_lo + (p_hi - p_lo) * t
    return _LEG_OUTFIT_PAD[-1][1]


def skirt_skin(pelvis_share):
    """Graduated pelvis -> left-thigh skinning for a split coat/tunic/kilt tail.

    Use inside `part.mirrored()` so the right tail automatically switches to `thigh_r`.
    """
    if pelvis_share >= 0.99:
        return SKIN_TORSO
    if pelvis_share <= 0.01:
        return Skin(allowed=('thigh_l',))
    return Skin(allowed=('thigh_l',), blend={'pelvis': float(pelvis_share)})


def skirt_tail_ring(body, height, *, clearance=0.022, torso_grow=0.024, back_x=0.008, front_x=0.010,
                    torso_weight=0.0, front_flare=0.0, back_flare=0.0, side_flare=0.0):
    """5-point left half-skirt ring ordered Back-Inner -> Back-Outer -> Left-Outer -> Front-Outer -> Front-Inner.

    Combines the dressed-thigh envelope (body leg + trouser pad + clearance) with the torso envelope at `height`
    so neither high-belly archetypes (`body_heavy`) nor thick trousers (`officer_breeches`) clip the flat facets.
    """
    t_ring = torso_ring(body, height, torso_grow)
    t_back_mid = t_ring[7] + (t_ring[8] - t_ring[7]) * max(0.0, min(1.0, (back_x - t_ring[7].x) / max(t_ring[8].x - t_ring[7].x, 1e-6)))
    t_front_mid = t_ring[3] + (t_ring[2] - t_ring[3]) * max(0.0, min(1.0, (front_x - t_ring[3].x) / max(t_ring[2].x - t_ring[3].x, 1e-6)))
    t_half = [
        V(back_x, height, t_back_mid.z),
        t_ring[9],
        t_ring[0],
        t_ring[1],
        V(front_x, height, t_front_mid.z),
    ]
    if torso_weight >= 0.999:
        return t_half

    _, rx, rz, cx, cz = leg_section_at_y(body, height)
    pad = leg_outfit_pad(height)
    rad_x = (rx + pad + clearance) * 1.02 + side_flare
    rad_z_front = (rz + pad + clearance) * 1.02 + front_flare
    rad_z_back = (rz + pad + clearance) * 1.02 + back_flare
    l_half = [
        V(back_x, height, cz - rad_z_back * 0.96),
        V(cx + rad_x * 0.62, height, cz - rad_z_back * 0.84),
        V(cx + rad_x * 1.00, height, cz),
        V(cx + rad_x * 0.62, height, cz + rad_z_front * 0.84),
        V(front_x, height, cz + rad_z_front * 0.96),
    ]
    if torso_weight > 0.0:
        l_half = [l_pt.lerp(t_pt, torso_weight) for l_pt, t_pt in zip(l_half, t_half)]

    # Clamp each column radially outward to at least the torso surface envelope (prevents belly/hip pokethrough).
    zc = station_at(body, height).zc
    out = []
    for l_pt, t_pt in zip(l_half, t_half):
        x = max(l_pt.x, t_pt.x) if t_pt.x > 0.06 else l_pt.x
        z = max(l_pt.z, t_pt.z) if t_pt.z >= zc else min(l_pt.z, t_pt.z)
        out.append(V(x, height, z))
    return out



def torso_surface_z(body, height, x, grow=0.0, side='front'):
    """Z of the torso surface at a height and an x position, on the front or the back."""
    points = torso_ring(body, height, grow)
    chain = points[0:6] if side == 'front' else [points[5], points[6], points[7], points[8], points[9], points[0]]
    for start, end in zip(chain, chain[1:]):
        low, high = min(start.x, end.x), max(start.x, end.x)
        if low - 1e-9 <= x <= high + 1e-9 and high - low > 1e-9:
            return start.z + (end.z - start.z) * (x - start.x) / (end.x - start.x)
    raise ValueError(f'x = {x} is outside the torso at y = {height}.')


def torso_point(body, height, x, grow=0.0, side='front', lift=0.0):
    """A point on the torso surface. `lift` moves it out along z."""
    z = torso_surface_z(body, height, x, grow, side)
    return Vector((x, height, z + (lift if side == 'front' else -lift)))


def facet(points, index, axis=Y):
    """Centre, outward normal and width of one flat side of a ring. `axis` is the ring axis (Y for torso and legs, X for the left arm)."""
    start, end = points[index % len(points)], points[(index + 1) % len(points)]
    tangent = end - start
    return (start + end) / 2, Vector(axis).cross(tangent).normalized(), tangent.length


def build_hand(part, body, region='skin', grow=0.0, *, cap_start=True):
    """Left hand in the T pose: palm, mitten fingers and thumb. Use inside `part.mirrored()` for both hands."""
    ref_body = BODIES[BASE_BODY]
    palm_y = WRIST.y + 0.004
    palm_z = WRIST.z - 0.002

    def section(target, x, half_y, half_z, lift=0.0, g=0.0):
        return ring(Vector((x, palm_y + lift, palm_z)), Z, Y, half_z + g, half_y * target.hand + g, ARM_SIDES)

    specs = (
        (0.668, 0.020, 0.028, 0.0),
        (0.775, 0.017, 0.032, 0.0),
        (0.828, 0.015, 0.030, -0.002),
        (0.875, 0.010, 0.024, -0.004),
    )
    with part.tagged('hand'):
        rings = [section(body, x, hy, hz, lift, grow) for x, hy, hz, lift in specs]
        refs = [section(ref_body, x, hy, hz, lift, 0.0) for x, hy, hz, lift in specs]
        part.loft(rings, region, refs=refs, cap_start=cap_start, cap_end=True,
                  ring_skins=[SKIN_WRIST_L, SKIN_PALM_L, SKIN_MITTEN_L, SKIN_MITTEN_L])
        with part.skinned(SKIN_THUMB_L):
            path = [Vector((0.715, palm_y - 0.004, palm_z + 0.026)), Vector((0.750, palm_y - 0.018, palm_z + 0.046)),
                    Vector((0.780, palm_y - 0.030, palm_z + 0.056))]
            part.tube(path, [0.014 + grow, 0.012 + grow, 0.008 + grow], 4, region, up=Y, cap_end=True,
                      phase=math.pi / 4)


SKIN_FOOT_L = Skin(allowed=('foot_l', 'ball_l', 'calf_l'))


def build_foot(part, body, region='skin', grow=0.0, *, sole=0.0, toe=0.0, sole_region=None, top=1.0, ao=0.0):
    """Left foot or shoe as a tapered wedge. `sole` adds a sole slab, `toe` adds toe length, `top` scales the height."""
    width = 0.046 * body.foot + grow
    cx = ANKLE.x
    base_low = max(sole - 0.005, 0.0)

    # The shoe body starts inside the sole slab, so no two faces share a plane (rule F4).
    def section(z, half_w, height, low=base_low):
        return [Vector((cx - half_w, low, z)), Vector((cx + half_w, low, z)),
                Vector((cx + half_w * 0.84, low + height, z)), Vector((cx - half_w * 0.84, low + height, z))]

    stations = (
        (-0.096 - grow * 0.6, 0.64, 0.072 * top + grow, 0.004),
        (-0.046, 0.76, 0.122 * top + grow, 0.0),
        (0.025, 0.88, 0.090 * top + grow, 0.0),
        (0.096, 0.92, 0.058 * top + grow, 0.0),
        (0.156 + grow + toe, 0.68, 0.036 * top + grow * 0.4, 0.004),
    )
    # A value step from heel to toe keeps the planes of a dark boot apart: the toe cap is the brightest band.
    bands = [ao - 0.05, ao, ao + 0.04, ao + 0.09]
    with part.tagged('foot'), part.skinned(SKIN_FOOT_L):
        part.loft([section(z, width * scale, height, base_low + lift) for z, scale, height, lift in stations],
                  region, cap_start=True, cap_end=True, ao=ao, band_ao=bands)
        if sole > 0:
            rim = 0.004
            slab = [[Vector((cx - width * scale - rim, lift, z)), Vector((cx + width * scale + rim, lift, z)),
                     Vector((cx + width * scale + rim, sole + lift, z)), Vector((cx - width * scale - rim, sole + lift, z))]
                    for z, scale, lift in ((stations[0][0] - rim, 0.64, 0.004), (stations[3][0], 0.92, 0.0), (stations[4][0] + rim, 0.68, 0.004))]
            # A sole in the boot region needs its own value step.
            part.loft(slab, sole_region or region, cap_start=True, cap_end=True, ao=-0.1 if sole_region else ao - 0.16)


# ---- head -------------------------------------------------------------------

HEAD_SIDES = 8
HEAD_SQUARENESS = 0.88
HEAD_STATION_KEYS = ('plug', 'chin', 'jaw', 'cheek', 'brow', 'upper', 'crown')
HEAD_Y = {'plug': 1.688, 'chin': 1.716, 'jaw': 1.772, 'cheek': 1.842, 'brow': 1.906, 'upper': 1.956, 'crown': 1.984}
# Fraction of the half width / depth where the flat side and front planes sit.
HEAD_PLANE = math.cos(math.pi / HEAD_SIDES) ** HEAD_SQUARENESS


@dataclass(frozen=True)
class HeadSpec:
    id: str
    label: str
    shape: dict       # station -> (half width, front depth, back depth)
    nose: tuple       # (length, half width, height)
    eye: tuple        # (width, height, spacing, y)
    brow: tuple       # (width, height, depth, tilt)
    mouth: tuple      # (width, height, smile)
    beard: bool = False


def _head_shape(**changes):
    shape = {'plug': (0.056, 0.054, 0.052), 'chin': (0.056, 0.084, 0.048), 'jaw': (0.088, 0.098, 0.086),
             'cheek': (0.098, 0.104, 0.098), 'brow': (0.100, 0.108, 0.102), 'upper': (0.086, 0.088, 0.092),
             'crown': (0.050, 0.048, 0.054)}
    shape.update(changes)
    return shape


HEADS = {
    'head_hero': HeadSpec('head_hero', 'Hero', _head_shape(), nose=(0.032, 0.015, 0.068), eye=(0.028, 0.018, 0.036, 1.864),
                          brow=(0.038, 0.012, 0.010, 0.10), mouth=(0.044, 0.010, 0.002)),
    'head_stern': HeadSpec('head_stern', 'Stern',
                           _head_shape(chin=(0.052, 0.084, 0.046), jaw=(0.084, 0.096, 0.084), cheek=(0.094, 0.102, 0.096),
                                       brow=(0.099, 0.112, 0.102)),
                           nose=(0.038, 0.015, 0.076), eye=(0.026, 0.013, 0.034, 1.862), brow=(0.040, 0.015, 0.014, -0.22),
                           mouth=(0.036, 0.009, 0.0), beard=True),
    'head_cheerful': HeadSpec('head_cheerful', 'Cheerful',
                              _head_shape(chin=(0.062, 0.080, 0.050), jaw=(0.093, 0.098, 0.088), cheek=(0.103, 0.106, 0.099),
                                          brow=(0.101, 0.105, 0.102)),
                              nose=(0.026, 0.015, 0.052), eye=(0.031, 0.023, 0.038, 1.864), brow=(0.035, 0.010, 0.009, 0.28),
                              mouth=(0.054, 0.012, 0.010)),
}
HEAD_ENVELOPE = {key: tuple(max(spec.shape[key][axis] for spec in HEADS.values()) for axis in range(3))
                 for key in HEAD_STATION_KEYS}

ORC_HEAD_SHAPE = {
    'plug': (0.064, 0.058, 0.064),
    'chin': (0.092, 0.128, 0.054),
    'jaw': (0.122, 0.132, 0.098),
    'cheek': (0.126, 0.122, 0.114),
    'brow': (0.126, 0.132, 0.118),
    'upper': (0.104, 0.102, 0.104),
    'crown': (0.062, 0.056, 0.060),
}
TROLL_HEAD_SHAPE = {
    'plug': (0.058, 0.054, 0.060),
    'chin': (0.090, 0.150, 0.050),
    'jaw': (0.114, 0.144, 0.094),
    'cheek': (0.106, 0.118, 0.108),
    'brow': (0.114, 0.134, 0.112),
    'upper': (0.090, 0.092, 0.098),
    'crown': (0.052, 0.048, 0.056),
}


def _max_head_shape(*shapes, extra=None):
    out = {}
    for key in HEAD_STATION_KEYS:
        w, zf, zb = (max(s[key][i] for s in shapes) for i in range(3))
        if extra and key in extra:
            ew, ezf, ezb = extra[key]
            w, zf, zb = w + ew, zf + ezf, zb + ezb
        out[key] = (w, zf, zb)
    return out


HEAD_FIT_SHAPES = {
    'head_orc': _max_head_shape(HEAD_ENVELOPE, ORC_HEAD_SHAPE, extra={
        'jaw': (0.004, 0.006, 0.0),
        'brow': (0.004, 0.010, 0.0),
    }),
    'head_troll': _max_head_shape(HEAD_ENVELOPE, TROLL_HEAD_SHAPE, extra={
        'chin': (0.006, 0.014, 0.0),
        'jaw': (0.006, 0.014, 0.0),
        'brow': (0.004, 0.022, 0.0),
    }),
}


def head_section(shape, height):
    """Interpolate the head shape (half width, front depth, back depth) at a height."""
    keys = HEAD_STATION_KEYS
    if height <= HEAD_Y[keys[0]]:
        return shape[keys[0]]
    for low, high in zip(keys, keys[1:]):
        if height <= HEAD_Y[high]:
            t = (height - HEAD_Y[low]) / (HEAD_Y[high] - HEAD_Y[low])
            return tuple(a + (b - a) * t for a, b in zip(shape[low], shape[high]))
    return shape[keys[-1]]


def head_ring(shape, height, grow=0.0, *, widen=0.0):
    """Head section. Columns: 0 left temple, 1 and 2 front, 3 right temple, 4 right back, 5 and 6 back, 7 left back."""
    w, zf, zb = head_section(shape, height)
    return ring(Vector((0.0, height, HEAD_Z)), X, Z, w + grow + widen, zf + grow, HEAD_SIDES, rv_neg=zb + grow,
                squareness=HEAD_SQUARENESS, phase=math.pi / HEAD_SIDES)


def head_front_z(shape, height, grow=0.0):
    return HEAD_Z + (head_section(shape, height)[1] + grow) * HEAD_PLANE


def head_side_x(shape, height, grow=0.0):
    return (head_section(shape, height)[0] + grow) * HEAD_PLANE


def head_shell(part, region, grow, *, front, temple, side, back, top_lift=0.012, flare=0.0, levels=(), shape=None,
               ao=0.0, widen=0.0):
    """A shell on the skull (hair, cap, helmet liner). Each column stops at its own lowest height.

    front, temple, side, back: lowest y of the front, temple, side-back and back columns.
    flare: extra radius at the lowest ring (bob cut, helmet rim).
    """
    shape = shape or HEAD_ENVELOPE
    limits = [temple, front, front, temple, side, back, back, side]
    lowest = min(limits)
    heights = sorted({lowest, *(height for height in (*levels, HEAD_Y['cheek'], HEAD_Y['brow'], HEAD_Y['upper'],
                                                      HEAD_Y['crown']) if height > lowest + 0.004)})
    rings = []
    for height in heights:
        points = []
        for column, limit in enumerate(limits):
            y = max(height, limit)
            span = max(HEAD_Y['brow'] - limit, 1e-6)
            extra = flare * max(0.0, 1.0 - (y - limit) / span) ** 2
            points.append(head_ring(shape, y, grow + extra, widen=widen)[column])
        rings.append(points)
    tip = Vector((0.0, HEAD_Y['crown'] + grow + top_lift, HEAD_Z))
    return part.loft(rings, region, tip_end=tip, ao=ao)


def finish_budget(kind, mesh):
    limit = BUDGETS['classes'][kind]['maxTriangles']
    if mesh.triangles > limit:
        raise ValueError(f'{mesh.name}: {mesh.triangles} triangles exceed the {kind} budget ({limit}).')


def build_skinned(name, builder, solver, *, morph=True, bodies=None):
    """Run `builder(part, body)` for the base body and for each other archetype. The others become morph targets."""
    pool = ALL_UAL1_BODIES if bodies is None else bodies
    base = Part(name)
    builder(base, pool[BASE_BODY])
    variants = {}
    if morph:
        for body_id, body in pool.items():
            if body_id == BASE_BODY:
                continue
            other = Part(name)
            builder(other, body)
            variants[body_id] = other
    return base.to_mesh(solver, variants)


def build_head_skinned(name, builder, solver, *, morph=True):
    """Run `builder(part, head_shape)` on HEAD_ENVELOPE and add monster head-fit morphs (`head_orc`, `head_troll`)."""
    base = Part(name)
    builder(base, HEAD_ENVELOPE)
    variants = {}
    if morph:
        for head_id, shape in HEAD_FIT_SHAPES.items():
            other = Part(name)
            builder(other, shape)
            variants[head_id] = other
    return base.to_mesh(solver, variants)


# --------------------------------------------------------------------------
# Catalog entries (contracts/catalog.ts)
# --------------------------------------------------------------------------

def part_entry(mesh, pack, slot, label, path, *, hides_hair=False, hides_legs_upper=False, rig_id='ual1'):
    finish_budget(slot, mesh)
    entry = {'id': mesh.name, 'pack': pack, 'leaf': 'characters', 'relativePath': path, 'nodeName': mesh.name,
             'slot': slot, 'label': label, 'triangles': mesh.triangles, 'rigId': rig_id,
             'rules': {'hidesHair': hides_hair, 'hidesLegsUpper': hides_legs_upper}}
    if mesh.extras and 'polyRagdollColliders' in mesh.extras:
        entry['ragdollColliders'] = mesh.extras['polyRagdollColliders']
    return entry


def held_entry(mesh, pack, label, hand, path, size):
    finish_budget('held', mesh)
    limit = BUDGETS['classes']['held']['maxBytes']
    if size > limit:
        raise ValueError(f'{mesh.name}: {size} bytes exceed the held budget ({limit}).')
    return {'id': mesh.name, 'pack': pack, 'leaf': 'characters', 'relativePath': path, 'nodeName': mesh.name,
            'label': label, 'hand': hand, 'triangles': mesh.triangles}


def prop_entry(mesh, pack, label, path, size):
    finish_budget('prop', mesh)
    limit = BUDGETS['classes']['prop']['maxBytes']
    if size > limit:
        raise ValueError(f'{mesh.name}: {size} bytes exceed the prop budget ({limit}).')
    bounds = mesh.bounds()
    if abs(bounds['min'][1]) > 0.001:
        raise ValueError(f'{mesh.name}: the prop is not on y = 0 (min y = {bounds["min"][1]}).')
    for axis in (0, 2):
        if abs(bounds['min'][axis] + bounds['max'][axis]) / 2 > 0.02:
            raise ValueError(f'{mesh.name}: the prop is not centred on X/Z.')
    return {'id': mesh.name, 'pack': pack, 'leaf': 'world', 'relativePath': path, 'nodeName': mesh.name,
            'label': label, 'triangles': mesh.triangles, 'bounds': bounds}


def pack_catalog(pack, *, parts=(), held=(), props=(), presets=(), clips=(), rig_model_path=None, creature_rigs=None):
    catalog = {'version': 1, 'pack': pack, 'label': PACKS[pack]['label'], 'license': PACKS[pack]['license'],
               'clips': list(clips), 'parts': list(parts), 'heldItems': list(held), 'props': list(props),
               'presets': list(presets)}
    if rig_model_path:
        catalog['rigModelPath'] = rig_model_path
    if creature_rigs:
        catalog['creatureRigs'] = list(creature_rigs)
    return catalog


def leaf_dir(stage, pack, kind):
    definition = PACKS[pack]
    leaf = 'characters' if kind == 'characters' else definition['worldTheme']
    return Path(stage) / definition['dir'] / '3D' / leaf


def script_args(description, *names):
    import argparse
    import sys
    parser = argparse.ArgumentParser(description=description)
    for name in names:
        parser.add_argument(f'--{name}', type=Path, required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
