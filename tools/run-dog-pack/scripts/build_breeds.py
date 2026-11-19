#!/usr/bin/env python3
"""Ready-made breeds: one self-contained GLB per row of breeds.csv that works in
any glTF loader, no shader or assembly code needed. (Ported from
tools/run-cat-pack/scripts/build_breeds.py.)

For each breed this takes its build (kit/builds), head (kit/heads), ears and
tail (kit/parts) and makes one skinned mesh on the build's skeleton:
  - body and the breed's coat shell, as built; the tail part skinned to `tail`;
  - the head and its fluff skinned to `head`, the ears to `head`, the jaw to
    `jaw` (the jaw bone is moved to the hinge, so the clips' jaw rotation opens
    the mouth about the right point). The head and jaw also get a back-facing
    copy in the mouth colour: the inside of the mouth, as the kit draws it;
  - `socket_mouth` and `socket_nose` nodes on the head bone (where a held toy
    or a balanced treat goes); the `grip` bone's scale says when the mouth holds;
  - the coat baked into one texture: the kit's recolour shader evaluated per
    triangle (region masks through the anatomical UV set, tile masks through
    UV0), in the kit's papercraft palette, with flat swatches for the nose,
    eyes and mouth.
Every clip of the build comes along, and the rig is scaled to the breed's real
length in metres. Plain Python (numpy, Pillow): run after the kit is built.

    python3 scripts/build_breeds.py [--ready | --only "Pug,Dachshund"]
"""
import csv
import io
import json
import math
import os
import re
import struct
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PACK = os.path.dirname(HERE)
KIT = os.path.join(PACK, 'kit')
OUT = os.path.join(KIT, "breeds")
TEX = 512                     # baked coat texture size

COMP = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8, 5120: np.int8, 5122: np.int16}
NORM = {5121: 255.0, 5123: 65535.0, 5120: 127.0, 5122: 32767.0}
NUM = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


# --------------------------------------------------------------------------
# GLB in / out

class Glb:
    def __init__(self, path):
        data = open(path, 'rb').read()
        jlen = struct.unpack_from('<I', data, 12)[0]
        self.j = json.loads(data[20:20 + jlen])
        self.bin = data[20 + jlen + 8:]

    def view_bytes(self, bvi):
        bv = self.j['bufferViews'][bvi]
        o = bv.get('byteOffset', 0)
        return self.bin[o:o + bv['byteLength']]

    def acc(self, i):
        a = self.j['accessors'][i]
        bv = self.j['bufferViews'][a['bufferView']]
        dt = COMP[a['componentType']]
        n = NUM[a['type']]
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = bv.get('byteStride')
        size = np.dtype(dt).itemsize * n
        if stride and stride != size:
            raw = np.frombuffer(self.bin, np.uint8, a['count'] * stride, off).reshape(a['count'], stride)[:, :size]
            arr = np.frombuffer(raw.tobytes(), dt).reshape(a['count'], n)
        else:
            arr = np.frombuffer(self.bin, dt, a['count'] * n, off).reshape(a['count'], n)
        if a.get('normalized'):
            return arr.astype(np.float32) / NORM[a['componentType']]
        return arr

    def node(self, name):
        return next(i for i, n in enumerate(self.j['nodes']) if n.get('name') == name)


class Writer:
    """Collects buffer views / accessors for a new GLB."""

    def __init__(self):
        self.bin = bytearray()
        self.views, self.accessors = [], []

    def view(self, blob, target=None):
        while len(self.bin) % 4:
            self.bin.append(0)
        v = {'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': len(blob)}
        if target:
            v['target'] = target
        self.bin.extend(blob)
        self.views.append(v)
        return len(self.views) - 1

    def add(self, arr, typ, ctype=5126, target=None, normalized=False, minmax=False):
        arr = np.ascontiguousarray(arr, dtype={5126: np.float32, 5121: np.uint8, 5123: np.uint16, 5125: np.uint32}[ctype])
        a = {'bufferView': self.view(arr.tobytes(), target), 'componentType': ctype,
             'count': int(arr.shape[0]), 'type': typ}
        if normalized:
            a['normalized'] = True
        if minmax:
            m = arr.reshape(arr.shape[0], -1)
            a['min'], a['max'] = m.min(0).tolist(), m.max(0).tolist()
        self.accessors.append(a)
        return len(self.accessors) - 1

    def copy_acc(self, src, i):
        """Copy accessor i of Glb src (its data repacked tight)."""
        a = dict(src.j['accessors'][i])
        arr = src.acc(i) if not a.get('normalized') else None
        if arr is None:   # keep normalised ints as they are
            raw = np.frombuffer(src.view_bytes(a['bufferView']), COMP[a['componentType']])
            n = NUM[a['type']]
            arr = raw[a.get('byteOffset', 0) // raw.itemsize:][:a['count'] * n]
            blob = arr.tobytes()
        else:
            blob = np.ascontiguousarray(arr).tobytes()
        a['bufferView'] = self.view(blob)
        a.pop('byteOffset', None)
        self.accessors.append(a)
        return len(self.accessors) - 1

    def write(self, path, j):
        j['accessors'], j['bufferViews'] = self.accessors, self.views
        while len(self.bin) % 4:
            self.bin.append(0)
        j['buffers'] = [{'byteLength': len(self.bin)}]
        js = json.dumps(j, separators=(',', ':')).encode()
        js += b' ' * (-len(js) % 4)
        glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(self.bin))
        glb += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(self.bin), 0x004E4942) + bytes(self.bin)
        open(path, 'wb').write(glb)
        return len(glb)


# --------------------------------------------------------------------------
# Transforms

def quat_mat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def local(n):
    M = np.eye(4)
    M[:3, :3] = quat_mat(n.get('rotation', [0, 0, 0, 1])) * np.array(n.get('scale', [1, 1, 1]))
    M[:3, 3] = n.get('translation', [0, 0, 0])
    return M


def globals_of(j):
    G, parent = {}, {}
    for i, n in enumerate(j['nodes']):
        for c in n.get('children', []):
            parent[c] = i

    def g(i):
        if i not in G:
            G[i] = (g(parent[i]) if i in parent else np.eye(4)) @ local(j['nodes'][i])
        return G[i]
    for i in range(len(j['nodes'])):
        g(i)
    return G, parent


def xform(M, pts):
    return pts @ M[:3, :3].T + M[:3, 3]


def xnormal(M, nrm):
    n = nrm @ np.linalg.inv(M[:3, :3])
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)


# --------------------------------------------------------------------------
# Colour

def srgb_lin(hexc):
    c = np.array([int(hexc[k:k + 2], 16) / 255 for k in (1, 3, 5)])
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


MASKS = {}


def mask(kind, key):
    if (kind, key) not in MASKS:
        im = Image.open(os.path.join(KIT, 'patterns', f'{kind}-{key}.png')).convert('L')
        MASKS[kind, key] = np.asarray(im, np.float32) / 255.0
    return MASKS[kind, key]


def sample(img, u, v, wrap):
    """Bilinear sample of a single-channel image at uv (glTF convention: v
    down from the top). Tile masks are read like the viewer reads them (three.js
    flips them, so v counts up from the bottom) and repeat."""
    h, w = img.shape
    if wrap:
        u, v = u % 1.0, 1.0 - (v % 1.0)
    x = np.clip(u * w - 0.5, 0, w - 1.0001) if not wrap else (u * w - 0.5) % w
    y = np.clip(v * h - 0.5, 0, h - 1.0001) if not wrap else (v * h - 0.5) % h
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = x - x0, y - y0
    x1, y1 = (x0 + 1) % w if wrap else np.minimum(x0 + 1, w - 1), (y0 + 1) % h if wrap else np.minimum(y0 + 1, h - 1)
    return (img[y0, x0] * (1 - fx) * (1 - fy) + img[y0, x1] * fx * (1 - fy)
            + img[y1, x0] * (1 - fx) * fy + img[y1, x1] * fx * fy)




def coat_colour(spec, uv2, uv0):
    """The kit's shader: base coat, then up to three pattern layers."""
    c = np.tile(spec['coat'], (len(uv2), 1))
    for pat, col in spec['layers']:
        p = DOG['patterns'].get(pat)
        if not p:
            continue
        if 'region' in p:
            t = sample(mask('region', p['region']), uv2[:, 0], uv2[:, 1], False)
        else:
            t = sample(mask('tile', p['tile']), uv0[:, 0], uv0[:, 1], True)
        k = np.clip((t - 0.48) / 0.04, 0, 1)
        k = k * k * (3 - 2 * k)
        c = c * (1 - k[:, None]) + col * k[:, None]
    return c


def papercraft(hexc):
    """The kit's papercraft palette: mid and light tones lifted toward pastels
    (lighter, less saturated), darks kept deep. Same maths as kit/kitcore.js."""
    import colorsys
    r, g, b = (int(hexc[k:k + 2], 16) / 255 for k in (1, 3, 5))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    u = min(1.0, max(0.0, (l - 0.15) / (0.55 - 0.15)))
    lift = 0.22 * u * u * (3 - 2 * u)
    s = s * (1 - 0.28 * lift / 0.22)
    l = l + (1 - l) * lift
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return '#%02x%02x%02x' % tuple(int(round(x * 255)) for x in (r, g, b))


def tags_of(col):
    """COLOR_0 tags: red = nose, green = eyes."""
    t = col[:, :2] >= 0.5
    out = np.full(len(col), '', dtype=object)
    out[t[:, 0]] = 'nose'
    out[t[:, 1] & ~t[:, 0]] = 'eye'
    return out


def slug(name):
    import unicodedata
    name = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode()   # Frisé -> Frise
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def spec_of(r):
    col = lambda name: srgb_lin(papercraft(DOG['colours'][name]))   # noqa: E731
    layers = []
    for l in filter(None, (r['layers'] or '').split('|')):
        p, c = l.split(':')
        layers.append((p, col(c)))
    head = r.get('head') or DOG['headForBuild'].get(r['build'], 'classic')
    return {'name': r['breed'], 'build': r['build'], 'size': r['size'],
            'head': f"classic-{r['build']}" if head == 'classic' else head,
            'ears': r['ears'], 'tail': r['tail'], 'fur': DOG['coatShell'].get(r['coat'], 'none'),
            'coat': col(r['base']), 'layers': layers,
            'nose': DOG['colours'].get(r['nose'], DOG['colours']['black']),
            'length': DOG['sizes'][r['size']] * DOG['buildLength'].get(r['build'], 1.0), 'row': r}


def build(spec):
    B = Glb(os.path.join(KIT, 'builds', f"{spec['build']}.glb"))
    H = Glb(os.path.join(KIT, 'heads', f"{spec['head']}.glb"))
    ears = {s: Glb(os.path.join(KIT, 'parts', f"ear-{spec['ears']}-{s}.glb")) for s in 'LR'}
    T = Glb(os.path.join(KIT, 'parts', f"tail-{spec['tail']}.glb"))
    j = B.j
    G, parent = globals_of(j)
    skin = j['skins'][0]
    joints = [j['nodes'][k]['name'] for k in skin['joints']]
    J = {n: joints.index(n) for n in joints}

    sh = j['nodes'][B.node('socket_head')]
    Ms = G[B.node('socket_head')]
    head_scale = sh['scale'][0]
    ear_scale = sh.get('extras', {}).get('ear_scale', 1.0)
    st = j['nodes'][B.node('socket_tail')]
    Mt = G[B.node('socket_tail')]

    pieces = []

    def mesh_arrays(g, mi):
        p = g.j['meshes'][mi]['primitives'][0]
        at = p['attributes']
        n = g.j['accessors'][at['POSITION']]['count']
        idx = g.acc(p['indices'])[:, 0] if 'indices' in p else np.arange(n)
        get = lambda k: g.acc(at[k]) if k in at else None  # noqa: E731
        C = get('COLOR_0')
        if C is None:
            C = np.zeros((n, 4), np.float32)
        return idx, get('POSITION'), get('NORMAL'), get('TEXCOORD_1'), get('TEXCOORD_0'), C, \
            get('JOINTS_0'), get('WEIGHTS_0')

    def body_piece(name):
        mi = j['nodes'][B.node(name)]['mesh']
        idx, P, N, U2, U0, C, Jn, Wt = mesh_arrays(B, mi)
        pieces.append(dict(idx=idx, P=P, N=N, U2=U2, U0=U0, C=C, J=Jn.astype(np.uint8), W=Wt))

    def rigid_piece(g, name, M, joint, uvscale, part_uv=None, mouth=False):
        mi = g.j['nodes'][g.node(name)]['mesh']
        idx, P, N, U2, U0, C, _, _ = mesh_arrays(g, mi)
        n = len(P)
        Jn = np.zeros((n, 4), np.uint8)
        Jn[:, 0] = J[joint]
        Wt = np.zeros((n, 4), np.float32)
        Wt[:, 0] = 1
        if part_uv is not None or U2 is None:
            U2 = np.tile(part_uv if part_uv is not None else [0.8, 0.99], (n, 1))
        pieces.append(dict(idx=idx, P=xform(M, P), N=xnormal(M, N), U2=U2, U0=U0 * uvscale, C=C, J=Jn, W=Wt,
                           mouth=mouth))

    body_piece('dog')
    has = lambda g, nm: any(n.get('name') == nm for n in g.j['nodes'])  # noqa: E731
    if spec['fur'] != 'none' and has(B, f"coat_{spec['fur']}"):
        body_piece(f"coat_{spec['fur']}")
    rigid_piece(T, f"tail-{spec['tail']}", Mt, 'tail', st['scale'][0],
                part_uv=np.array(st.get('extras', {}).get('uv2', [0.06, 0.35])))
    rigid_piece(H, 'head', Ms, 'head', head_scale, mouth=True)
    hinge = Ms @ local(H.j['nodes'][H.node('jaw')])
    rigid_piece(H, 'jaw', hinge, 'jaw', head_scale, mouth=True)
    if spec['fur'] != 'none' and has(H, f"coat_{spec['fur']}"):
        rigid_piece(H, f"coat_{spec['fur']}", Ms, 'head', head_scale)
    for s in 'LR':
        sn = H.j['nodes'][H.node(f'socket_ear_{s}')]
        sc = [x * ear_scale for x in sn['scale']]
        Mear = Ms @ local({'translation': sn['translation'], 'scale': sc})
        rigid_piece(ears[s], f"ear-{spec['ears']}-{s}", Mear, 'head', head_scale * sc[0],
                    part_uv=np.array(sn.get('extras', {}).get('uv2', [0.8, 0.01])))

    # The jaw bone to the hinge (its clips only rotate it), and the mouth / nose
    # sockets (head part space) as nodes on the head bone.
    k = B.node('jaw')
    t = np.linalg.inv(G[parent[k]]) @ np.append(hinge[:3, 3], 1.0)
    j['nodes'][k]['translation'] = t[:3].tolist()
    G, _ = globals_of(j)
    socket_at = {}
    for nm in ('socket_mouth', 'socket_nose'):
        w = Ms @ np.append(H.j['nodes'][H.node(nm)]['translation'], 1.0)
        socket_at[nm] = (np.linalg.inv(G[B.node('head')]) @ w)[:3]

    # Per-triangle atlas (see the cat pack): every plain triangle gets half a
    # cell holding the shader evaluated across it; tagged faces use swatches.
    tris = []
    for kk, pc in enumerate(pieces):
        tags = tags_of(pc['C'])
        tri = pc['idx'].reshape(-1, 3)
        pc['tri'], pc['tag'] = tri, tags[tri[:, 0]]
        for tt in tri[pc['tag'] == '']:
            tris.append((kk, tt))
    SW = ['nose', 'eye', 'mouth']
    n_cells = (len(tris) + 1) // 2 + len(SW)
    side = int(math.ceil(math.sqrt(n_cells)))
    c = TEX // side
    pad = 1.2

    def cell_xy(i):
        return (i % side) * c, (i // side) * c
    lo, hi = pad, c - pad
    gap = pad * 1.5
    HALF = [np.array([[lo, lo], [hi - gap, lo], [lo, hi - gap]]),
            np.array([[hi, hi], [lo + gap, hi], [hi, lo + gap]])]
    yy, xx = np.mgrid[0:c, 0:c] + 0.5
    pts = np.stack([xx.ravel(), yy.ravel()], 1)
    which = (pts.sum(1) > c).astype(int)
    bary = np.zeros((len(pts), 3))
    for h in (0, 1):
        A = HALF[h]
        Tm = np.array([A[1] - A[0], A[2] - A[0]]).T
        l12 = np.linalg.solve(Tm, (pts - A[0]).T).T
        b = np.clip(np.column_stack([1 - l12.sum(1), l12]), 0, None)
        b /= b.sum(1, keepdims=True)
        bary[which == h] = b[which == h]
    img = np.zeros((TEX, TEX, 3))
    tri_uv = {}
    U2s, U0s, cells = [], [], []
    for i, (kk, tt) in enumerate(tris):
        pc = pieces[kk]
        h = which == (i % 2)
        U2s.append(bary[h] @ pc['U2'][tt])
        U0s.append(bary[h] @ pc['U0'][tt])
        cells.append((i // 2, h))
        x0, y0 = cell_xy(i // 2)
        tri_uv[kk, tuple(tt)] = (HALF[i % 2] + [x0, y0]) / TEX
    cols = coat_colour(spec, np.concatenate(U2s), np.concatenate(U0s))
    o = 0
    for cell, h in cells:
        x0, y0 = cell_xy(cell)
        q = pts[h].astype(int)
        img[y0 + q[:, 1], x0 + q[:, 0]] = cols[o:o + len(q)]
        o += len(q)
    sw_uv = {}
    for k_, (name, hexc) in enumerate((('nose', spec['nose']), ('eye', DOG['fixedColours']['eye']),
                                       ('mouth', DOG['fixedColours']['mouth']))):
        x0, y0 = cell_xy((len(tris) + 1) // 2 + k_)
        img[y0:y0 + c, x0:x0 + c] = srgb_lin(hexc)
        sw_uv[name] = np.array([x0 + c / 2, y0 + c / 2]) / TEX
    png = io.BytesIO()
    Image.fromarray((lin_srgb(img) * 255 + 0.5).astype(np.uint8)).save(png, 'PNG', optimize=True)

    # One mesh, a vertex per triangle corner (flat shaded) so each triangle has
    # its own atlas UVs. Head and jaw get a reversed, mouth-coloured copy.
    Ps, Ns, Us, Js, Ws = [], [], [], [], []
    for kk, pc in enumerate(pieces):
        for tt, tag in zip(pc['tri'], pc['tag']):
            Ps.append(pc['P'][tt]), Ns.append(pc['N'][tt]), Js.append(pc['J'][tt]), Ws.append(pc['W'][tt])
            Us.append(tri_uv[kk, tuple(tt)] if tag == '' else np.tile(sw_uv[tag], (3, 1)))
        if pc.get('mouth'):
            for tt in pc['tri']:
                r_ = tt[::-1]
                Ps.append(pc['P'][r_]), Ns.append(-pc['N'][r_]), Js.append(pc['J'][r_]), Ws.append(pc['W'][r_])
                Us.append(np.tile(sw_uv['mouth'], (3, 1)))
    P, N, U = np.concatenate(Ps), np.concatenate(Ns), np.concatenate(Us).astype(np.float32)
    Jn, Wt = np.concatenate(Js), np.concatenate(Ws)
    I = np.arange(len(P))
    Wt = Wt / np.maximum(Wt.sum(1, keepdims=True), 1e-9)
    Wb = np.round(Wt * 255).astype(int)
    Wb[np.arange(len(Wb)), Wb.argmax(1)] += 255 - Wb.sum(1)

    w = Writer()
    drop = {'socket_head', 'socket_tail'}
    keep = [i for i, n in enumerate(j['nodes']) if 'mesh' not in n and n.get('name') not in drop]
    remap = {old: new for new, old in enumerate(keep)}
    nodes = []
    for old in keep:
        n = dict(j['nodes'][old])
        if 'children' in n:
            n['children'] = [remap[ch] for ch in n['children'] if ch in remap]
            if not n['children']:
                del n['children']
        n.pop('extras', None) if n.get('name') != 'rig' else None
        nodes.append(n)
    head_new = remap[B.node('head')]
    for nm, p in socket_at.items():
        nodes.append({'name': nm, 'translation': p.tolist()})
        nodes[head_new].setdefault('children', []).append(len(nodes) - 1)
    rig = remap[B.node('rig')]
    L = spec['length']
    nodes[rig]['scale'] = [L, L, L]
    nodes[rig]['extras'] = {**j['nodes'][B.node('rig')].get('extras', {}), 'breed': spec['name'],
                            'build': spec['build'], 'length_m': round(L, 3)}
    mesh = {'name': slug(spec['name']), 'primitives': [{
        'attributes': {'POSITION': w.add(P, 'VEC3', target=34962, minmax=True),
                       'NORMAL': w.add(N, 'VEC3', target=34962),
                       'TEXCOORD_0': w.add(U, 'VEC2', target=34962),
                       'JOINTS_0': w.add(Jn, 'VEC4', 5121, target=34962),
                       'WEIGHTS_0': w.add(Wb, 'VEC4', 5121, target=34962, normalized=True)},
        'indices': w.add(I.reshape(-1, 1), 'SCALAR', 5125 if len(P) > 65535 else 5123, target=34963),
        'material': 0}]}
    nodes.append({'name': 'dog', 'mesh': 0, 'skin': 0})
    nodes[rig]['children'] = [len(nodes) - 1] + nodes[rig].get('children', [])
    ibm = np.stack([np.linalg.inv(G[k_]).T.ravel() for k_ in skin['joints']])
    new_skin = {'joints': [remap[k_] for k_ in skin['joints']], 'inverseBindMatrices': w.add(ibm, 'MAT4')}
    anims = []
    for a in j.get('animations', []):
        cache = {}

        def cp(i):
            if i not in cache:
                cache[i] = w.copy_acc(B, i)
            return cache[i]
        chans = [ch for ch in a['channels'] if ch['target']['node'] in remap]
        anims.append({'name': a['name'],
                      'samplers': [{**s, 'input': cp(s['input']), 'output': cp(s['output'])} for s in a['samplers']],
                      'channels': [{'sampler': ch['sampler'], 'target': {**ch['target'], 'node': remap[ch['target']['node']]}}
                                   for ch in chans]})
    img_view = w.view(png.getvalue())
    out = {'asset': {'version': '2.0', 'generator': 'Facet Fauna: Dogs (run-dog-pack/scripts/build_breeds.py)'},
           'scene': 0, 'scenes': [{'name': spec['name'], 'nodes': [rig]}], 'nodes': nodes, 'meshes': [mesh],
           'skins': [new_skin], 'animations': anims,
           'materials': [{'name': 'coat', 'pbrMetallicRoughness': {
               'baseColorTexture': {'index': 0}, 'metallicFactor': 0.0, 'roughnessFactor': 1.0}}],
           'textures': [{'source': 0, 'sampler': 0}], 'samplers': [{'magFilter': 9729, 'minFilter': 9729}],
           'images': [{'bufferView': img_view, 'mimeType': 'image/png', 'name': f"{slug(spec['name'])}-coat"}]}
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{slug(spec['name'])}.glb")
    return path, w.write(path, out)


DOG = json.load(open(os.path.join(KIT, 'catalog.json')))

if __name__ == '__main__':
    only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
    # --ready: just the breeds in ready.txt (the ones the asset library ships ready-made)
    if '--ready' in sys.argv:
        only = [l.strip() for l in open(os.path.join(PACK, 'ready.txt')) if l.strip() and not l.startswith('#')]
    rows = list(csv.DictReader(open(os.path.join(PACK, 'breeds.csv'))))
    rows = [r for r in rows if r['build'] in DOG['builds']]          # not the random "Mixed Breed" row
    # dogkit.js carries the catalog and the breed table (a game copies one file).
    js_path = os.path.join(KIT, 'dogkit.js')
    if os.path.exists(js_path):
        js = open(js_path).read()
        data = {'catalog': DOG, 'breeds': [{k: v for k, v in r.items() if k != 'notes'} for r in rows]}
        block = '// <generated> catalog.json and breeds.csv, written in by scripts/build_breeds.py\n' \
                f'const DATA = {json.dumps(data, separators=(",", ":"))};\n// </generated>'
        open(js_path, 'w').write(re.sub(r'// <generated>.*?// </generated>', lambda m: block, js, flags=re.S))
    total, index = 0, []
    for r in rows:
        if only and r['breed'] not in only:
            continue
        spec = spec_of(r)
        path, size = build(spec)
        total += size
        index.append({'breed': r['breed'], 'file': os.path.basename(path), 'build': r['build'],
                      'length_m': round(spec['length'], 3)})
        print(f"{os.path.relpath(path, PACK)}  {size // 1024} KB")
    # index.json: every breed whose GLB exists (so --only runs keep a usable index)
    have = set(os.listdir(OUT))
    index = [{'breed': r['breed'], 'file': f"{slug(r['breed'])}.glb", 'build': r['build'],
              'length_m': round(spec_of(r)['length'], 3)} for r in rows if f"{slug(r['breed'])}.glb" in have]
    json.dump(index, open(os.path.join(OUT, 'index.json'), 'w'), indent=1)
    print(f'{len(index)} breeds, total {total / 1e6:.1f} MB')
