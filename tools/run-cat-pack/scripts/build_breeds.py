#!/usr/bin/env python3
"""Ready-made breeds: one self-contained GLB per row of breeds.csv that works in
any glTF loader, no shader or assembly code needed.

For each breed this takes its build (kit/builds), head (kit/heads) and ears
(kit/parts) and makes one skinned mesh on the build's skeleton:
  - body, the breed's coat shell and tail, as built;
  - the head, its fluff and eyes skinned to the head bone (eyes to `lids`, so
    the clips' blinks squash them shut), the ears to ear.L / ear.R. The lids
    and ear bones are moved to the eye centre and the ear roots, so they scale
    and turn about the right point (their clips only scale / rotate them);
  - the coat baked into one texture: the viewer's recolour shader evaluated in
    the body's anatomical UV layout (TEXCOORD_1 of the kit), region masks and
    tile masks alike, with flat swatches for the nose, eyes, mouth line and
    inner ears in the unused corner of the layout.
Every clip of the build comes along, and the root is scaled to the breed's
real length in metres. Plain Python (numpy, Pillow): run after the kit is built.

    python3 scripts/build_breeds.py [--only "Siamese,Maine Coon"]
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
OUT = os.environ.get('CAT_OUT') or os.path.join(KIT, 'breeds')
TEX = int(os.environ.get('CAT_TEX', 512))    # baked coat texture size (CAT_TEX / CAT_OUT: test bakes)
LINE_W = 2                    # half-width (px) of the leg columns (legs are lines in the layout)

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


def coat_colour(spec, uv2, uv0, tile_ok=None):
    """The viewer's shader: base coat, then up to three pattern layers. Tile
    layers only where tile_ok (texels with a real tile coordinate)."""
    c = np.tile(spec['coat'], (len(uv2), 1))
    for pat, col in spec['layers']:
        p = CAT['patterns'].get(pat)
        if not p:
            continue
        if 'region' in p:
            t = sample(mask('region', p['region']), uv2[:, 0], uv2[:, 1], False)
        else:
            t = sample(mask('tile', p['tile']), uv0[:, 0], uv0[:, 1], True)
            if tile_ok is not None:
                t = np.where(tile_ok, t, 0.0)
        k = np.clip((t - 0.48) / 0.04, 0, 1)
        k = k * k * (3 - 2 * k)
        c = c * (1 - k[:, None]) + col * k[:, None]
    return c


# Flat colour swatches in the free corner of the layout: u 0.76-1, v 0.55-1 in
# glTF's convention (v down; the head's face window is v 0-0.55 there, the
# body / legs / tail use u < 0.76).
SWATCHES = ['nose', 'eye', 'ink', 'inner', 'shine', 'ear']


def swatch_uv(name):
    k = SWATCHES.index(name)
    return np.array([0.80 + 0.07 * (k % 3), 0.64 + 0.1 * (k // 3)])


# --------------------------------------------------------------------------
# Baking

def tags_of(col):
    t = col[:, :3] >= 0.5
    r, g, b = t[:, 0], t[:, 1], t[:, 2]
    out = np.full(len(col), '', dtype=object)
    out[r & g & b] = 'shine'
    out[r & b & ~g] = 'inner'
    out[r & ~g & ~b] = 'nose'
    out[g & ~r] = 'eye'
    out[b & ~r & ~g] = 'ink'
    return out


def raster_uv0(uv0map, cov, tris_uv2, tris_uv0):
    """Rasterise triangles in the layout (UV2) and record each texel's tile
    coordinate (UV0), which the tile patterns are read with. Legs are lines in
    the layout (one u per leg, v along it): they get a thin column."""
    for a2, a0 in zip(tris_uv2, tris_uv0):
        P = a2 * TEX
        (ax, ay), (bx, by), (cx, cy) = P
        d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(d) < 0.5:
            v0, v1 = P[:, 1].min(), P[:, 1].max()
            if v1 - v0 < 0.5:
                continue
            ys = np.arange(int(v0), int(np.ceil(v1)) + 1)
            ys = ys[(ys >= 0) & (ys < TEX)]
            # Legs and the tail are lines in the layout (one u, v along them): a
            # 2D tile pattern can't be laid along a line, so they take the base
            # coat and the region layers only (tabby rings, points, socks).
            continue
        x0, y0 = np.floor(P.min(0)).astype(int)
        x1, y1 = np.ceil(P.max(0)).astype(int)
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, TEX - 1), min(y1, TEX - 1)
        if x1 < x0 or y1 < y0:
            continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        px, py = xs.ravel(), ys.ravel()
        w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / d
        w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / d
        w2 = 1 - w0 - w1
        e = -0.6 / max(1.0, abs(d) ** 0.5)          # a little conservative: no cracks along edges
        inside = (w0 >= e) & (w1 >= e) & (w2 >= e)
        if not inside.any():
            continue
        W = np.stack([w0, w1, w2], 1)[inside]
        ix, iy = px[inside].astype(int), py[inside].astype(int)
        uv0map[iy, ix] = W @ a0
        cov[iy, ix] = True


def dilate(img, cov, passes=6):
    """Grow covered texels into uncovered neighbours (averaging)."""
    for _ in range(passes):
        if cov.all():
            break
        acc = np.zeros_like(img)
        n = np.zeros(cov.shape)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            s = np.roll(np.roll(cov, dy, 0), dx, 1)
            acc += np.roll(np.roll(img, dy, 0), dx, 1) * s[..., None]
            n += s
        fill = ~cov & (n > 0)
        img[fill] = acc[fill] / n[fill][:, None]
        cov = cov | fill
    return img, cov


# --------------------------------------------------------------------------

def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def spec_of(r):
    layers = []
    if r['layers']:
        for l in r['layers'].split('|'):
            p, c = l.split(':')
            layers.append((p, srgb_lin(CAT['colours'][c])))
    return {'name': r['breed'], 'build': r['build'], 'size': r['size'],
            'head': r['head'] or CAT['headForBuild'].get(r['build'], 'domestic'),
            'ears': r['ears'], 'tail': r['tail'], 'fur': CAT['coatShell'].get(r['coat'], 'none'),
            'coat': srgb_lin(CAT['colours'][r['base']]), 'layers': layers,
            'nose': CAT['noseColours'].get(r['nose'], CAT['noseColours']['pink']), 'eyes': r['eyes'],
            'row': r}


def build(spec):
    B = Glb(os.path.join(KIT, 'builds', f"{spec['build']}.glb"))
    H = Glb(os.path.join(KIT, 'heads', f"{spec['head']}.glb"))
    ears = {s: Glb(os.path.join(KIT, 'parts', f"ear-{spec['ears']}-{s}.glb")) for s in 'LR'}
    j = B.j
    G, parent = globals_of(j)
    skin = j['skins'][0]
    joints = [j['nodes'][k]['name'] for k in skin['joints']]
    J = {n: joints.index(n) for n in joints}

    sock = j['nodes'][B.node('socket_head')]
    Ms = G[B.node('socket_head')]
    head_scale = sock['scale'][0]
    ear_scale = sock.get('extras', {}).get('ear_scale', 1.0)

    # Gather pieces: (positions, normals, uv2, uv0 * uvScale, tags, joints, weights, part)
    pieces = []

    def mesh_arrays(g, mi):
        p = g.j['meshes'][mi]['primitives'][0]
        at = p['attributes']
        idx = g.acc(p['indices'])[:, 0] if 'indices' in p else np.arange(g.j['accessors'][at['POSITION']]['count'])
        get = lambda k: g.acc(at[k]) if k in at else None  # noqa: E731
        return idx, get('POSITION'), get('NORMAL'), get('TEXCOORD_1'), get('TEXCOORD_0'), get('COLOR_0'), \
            get('JOINTS_0'), get('WEIGHTS_0')

    def body_piece(name):
        mi = j['nodes'][B.node(name)]['mesh']
        idx, P, N, U2, U0, C, Jn, Wt = mesh_arrays(B, mi)
        pieces.append(dict(idx=idx, P=P, N=N, U2=U2, U0=U0, C=C, J=Jn.astype(np.uint8), W=Wt))

    def rigid_piece(g, name, M, joint, uvscale, part_uv=None):
        mi = g.j['nodes'][g.node(name)]['mesh']
        idx, P, N, U2, U0, C, _, _ = mesh_arrays(g, mi)
        n = len(P)
        Jn = np.zeros((n, 4), np.uint8)
        Jn[:, 0] = J[joint]
        Wt = np.zeros((n, 4), np.float32)
        Wt[:, 0] = 1
        if U2 is None:
            U2 = np.tile(part_uv if part_uv is not None else [0.8, 0.99], (n, 1))
        pieces.append(dict(idx=idx, P=xform(M, P), N=xnormal(M, N), U2=U2, U0=U0 * uvscale, C=C,
                           J=Jn, W=Wt, part=part_uv is not None))

    body_piece('body')
    if spec['fur'] != 'none':
        body_piece(f"coat_{spec['fur']}")
    body_piece(f"tail_{spec['tail']}")
    rigid_piece(H, 'head', Ms, 'head', head_scale)
    if spec['fur'] != 'none' and any(n.get('name') == f"coat_{spec['fur']}" for n in H.j['nodes']):
        rigid_piece(H, f"coat_{spec['fur']}", Ms, 'head', head_scale)
    eyes_node = H.j['nodes'][H.node('eyes')]
    Me = Ms @ local(eyes_node)
    rigid_piece(H, 'eyes', Me, 'lids', head_scale)
    ear_at = {}
    for s in 'LR':
        sn = H.j['nodes'][H.node(f'socket_ear_{s}')]
        Mear = Ms @ local({'translation': sn['translation'], 'scale': [x * ear_scale for x in sn['scale']]})
        ear_at[s] = Mear[:3, 3]
        rigid_piece(ears[s], f"ear-{spec['ears']}-{s}", Mear, f'ear.{s}', head_scale * sn['scale'][0] * ear_scale,
                    part_uv=np.array(sn.get('extras', {}).get('uv2', [0.8, 0.01])))

    # Move the lids bone to the eye centre and the ear bones to the ear roots
    # (their clips only scale / rotate them, so only the pivot changes).
    def move(name, point):
        k = B.node(name)
        Gp = G[parent[k]]
        t = np.linalg.inv(Gp) @ np.append(point, 1.0)
        j['nodes'][k]['translation'] = t[:3].tolist()
    move('lids', Me[:3, 3])
    move('ear.L', ear_at['L'])
    move('ear.R', ear_at['R'])
    G, _ = globals_of(j)

    # Bake the coat into a per-triangle atlas: every plain (untagged) triangle
    # gets half of a square cell, and each of its texels is the viewer's shader
    # evaluated at that point of the triangle (its layout UV2 and tile UV0
    # interpolated), so region and tile patterns come out as the kit draws them,
    # on legs and tail too, with nothing stretched or mirrored. Tagged faces
    # (nose, eyes, mouth line, inner ears) use flat swatch cells.
    tris = []                                    # (piece, triangle vertex indices)
    for k, pc in enumerate(pieces):
        tags = tags_of(pc['C'])
        tri = pc['idx'].reshape(-1, 3)
        pc['tri'], pc['tag'] = tri, tags[tri[:, 0]]
        for t in tri[pc['tag'] == '']:
            tris.append((k, t))
    n_cells = (len(tris) + 1) // 2 + len(SWATCHES)
    side = int(math.ceil(math.sqrt(n_cells)))
    c = TEX // side                              # cell size in texels
    pad = 1.6                                    # texels between a triangle and its cell edges

    def cell_xy(i):
        return (i % side) * c, (i // side) * c
    # Triangle corners inside a cell (texel units), lower-left half and upper-right half.
    lo, hi = pad, c - pad
    gap = pad * 1.5
    HALF = [np.array([[lo, lo], [hi - gap, lo], [lo, hi - gap]]),
            np.array([[hi, hi], [lo + gap, hi], [hi, lo + gap]])]
    # Texels of one cell and which half (triangle) each belongs to, with the
    # barycentrics of its centre in that triangle (clamped: the margin repeats the edge).
    yy, xx = np.mgrid[0:c, 0:c] + 0.5
    pts = np.stack([xx.ravel(), yy.ravel()], 1)
    which = (pts.sum(1) > c).astype(int)
    bary = np.zeros((len(pts), 3))
    for h in (0, 1):
        A = HALF[h]
        T = np.array([A[1] - A[0], A[2] - A[0]]).T
        l12 = np.linalg.solve(T, (pts - A[0]).T).T
        b = np.column_stack([1 - l12.sum(1), l12])
        b = np.clip(b, 0, None)
        b /= b.sum(1, keepdims=True)
        bary[which == h] = b[which == h]
    img = np.zeros((side * c, side * c, 3))
    tri_uv = {}
    U2s, U0s, cells = [], [], []
    for i, (k, t) in enumerate(tris):
        pc = pieces[k]
        h = which == (i % 2)
        U2s.append(bary[h] @ pc['U2'][t])
        U0s.append(bary[h] @ pc['U0'][t])
        cells.append((i // 2, i % 2, h))
        x0, y0 = cell_xy(i // 2)
        tri_uv[k, tuple(t)] = (HALF[i % 2] + [x0, y0]) / (side * c)
    cols = coat_colour(spec, np.concatenate(U2s), np.concatenate(U0s))
    o = 0
    for cell, half, h in cells:
        x0, y0 = cell_xy(cell)
        q = pts[h].astype(int)
        img[y0 + q[:, 1], x0 + q[:, 0]] = cols[o:o + len(q)]
        o += len(q)
    fixed = {'nose': srgb_lin(spec['nose']), 'eye': srgb_lin(CAT['fixedColours']['eye']),
             'ink': srgb_lin(CAT['fixedColours']['ink']), 'inner': srgb_lin(CAT['fixedColours']['innerEar']),
             'shine': srgb_lin(CAT['fixedColours']['shine'])}
    sw_uv = {}
    for j_, (name, col) in enumerate(fixed.items()):
        x0, y0 = cell_xy((len(tris) + 1) // 2 + j_)
        img[y0:y0 + c, x0:x0 + c] = col
        sw_uv[name] = np.array([x0 + c / 2, y0 + c / 2]) / (side * c)
    png = io.BytesIO()
    Image.fromarray((lin_srgb(img) * 255 + 0.5).astype(np.uint8)).save(png, 'PNG', optimize=True)

    # One mesh, a vertex per triangle corner (flat shaded anyway) so each
    # triangle can have its own atlas UVs.
    Ps, Ns, Us, Js, Ws = [], [], [], [], []
    for k, pc in enumerate(pieces):
        for t, tag in zip(pc['tri'], pc['tag']):
            Ps.append(pc['P'][t]), Ns.append(pc['N'][t]), Js.append(pc['J'][t]), Ws.append(pc['W'][t])
            Us.append(tri_uv[k, tuple(t)] if tag == '' else np.tile(sw_uv[tag], (3, 1)))
    P, N, U = np.concatenate(Ps), np.concatenate(Ns), np.concatenate(Us).astype(np.float32)
    Jn, Wt = np.concatenate(Js), np.concatenate(Ws)
    I = np.arange(len(P))
    base = len(P)
    Wt = Wt / np.maximum(Wt.sum(1, keepdims=True), 1e-9)
    Wb = np.round(Wt * 255).astype(int)
    Wb[np.arange(len(Wb)), Wb.argmax(1)] += 255 - Wb.sum(1)

    # New GLB: the build's nodes minus its meshes, one mesh node, the skin with
    # fresh inverse bind matrices, every clip.
    w = Writer()
    keep = [i for i, n in enumerate(j['nodes']) if 'mesh' not in n]
    remap = {old: new for new, old in enumerate(keep)}
    nodes = []
    for old in keep:
        n = dict(j['nodes'][old])
        if 'children' in n:
            n['children'] = [remap[c] for c in n['children'] if c in remap]
        nodes.append(n)
    rig = remap[B.node('rig')]
    L = CAT['sizes'][spec['size']]
    nodes[rig]['scale'] = [L, L, L]
    nodes[rig]['extras'] = {**nodes[rig].get('extras', {}), 'breed': spec['name'], 'build': spec['build'],
                            'length_m': L}
    mesh = {'name': slug(spec['name']), 'primitives': [{
        'attributes': {'POSITION': w.add(P, 'VEC3', target=34962, minmax=True),
                       'NORMAL': w.add(N, 'VEC3', target=34962),
                       'TEXCOORD_0': w.add(U, 'VEC2', target=34962),
                       'JOINTS_0': w.add(Jn, 'VEC4', 5121, target=34962),
                       'WEIGHTS_0': w.add(Wb, 'VEC4', 5121, target=34962, normalized=True)},
        'indices': w.add(I.reshape(-1, 1), 'SCALAR', 5125 if base > 65535 else 5123, target=34963),
        'material': 0}]}
    nodes.append({'name': 'cat', 'mesh': 0, 'skin': 0})
    nodes[rig]['children'] = [len(nodes) - 1] + nodes[rig].get('children', [])
    ibm = np.stack([np.linalg.inv(G[k]).T.ravel() for k in skin['joints']])   # column-major
    new_skin = {'joints': [remap[k] for k in skin['joints']], 'inverseBindMatrices': w.add(ibm, 'MAT4')}
    anims = []
    for a in j.get('animations', []):
        cache = {}

        def cp(i):
            if i not in cache:
                cache[i] = w.copy_acc(B, i)
            return cache[i]
        anims.append({'name': a['name'],
                      'samplers': [{**s, 'input': cp(s['input']), 'output': cp(s['output'])} for s in a['samplers']],
                      'channels': [{'sampler': c['sampler'], 'target': {**c['target'], 'node': remap[c['target']['node']]}}
                                   for c in a['channels']]})
    img_view = w.view(png.getvalue())
    out = {'asset': {'version': '2.0', 'generator': 'Facet Fauna: Cats (run-cat-pack/scripts/build_breeds.py)'},
           'scene': 0, 'scenes': [{'name': spec['name'], 'nodes': [rig]}], 'nodes': nodes, 'meshes': [mesh],
           'skins': [new_skin], 'animations': anims,
           'materials': [{'name': 'coat', 'doubleSided': True, 'pbrMetallicRoughness': {
               'baseColorTexture': {'index': 0}, 'metallicFactor': 0.0, 'roughnessFactor': 1.0}}],
           'textures': [{'source': 0, 'sampler': 0}], 'samplers': [{'magFilter': 9729, 'minFilter': 9729}],
           'images': [{'bufferView': img_view, 'mimeType': 'image/png', 'name': f"{slug(spec['name'])}-coat"}]}
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{slug(spec['name'])}.glb")
    size = w.write(path, out)
    return path, size


CAT = json.load(open(os.path.join(KIT, 'catalog.json')))

if __name__ == '__main__':
    only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
    rows = list(csv.DictReader(open(os.path.join(PACK, 'breeds.csv'))))
    # catkit.js carries the catalog and the breed table (a game copies one file;
    # only GLBs and textures ship through the asset library).
    js_path = os.path.join(KIT, 'catkit.js')
    js = open(js_path).read()
    data = {'catalog': {k: v for k, v in CAT.items() if not k.startswith('_')},
            'breeds': [{k: v for k, v in r.items() if k != 'notes'} for r in rows if r['build'] in CAT['builds']]}
    block = '// <generated> catalog.json and breeds.csv, written in by scripts/build_breeds.py\n' \
            f'const DATA = {json.dumps(data, separators=(",", ":"))};\n// </generated>'
    js = re.sub(r'// <generated>.*?// </generated>', lambda m: block, js, flags=re.S)
    open(js_path, 'w').write(js)
    total = 0
    index = []
    for r in rows:
        if r['build'] not in CAT['builds']:      # the random "Mixed Breed" row
            continue
        if only and r['breed'] not in only:
            continue
        spec = spec_of(r)
        path, size = build(spec)
        total += size
        index.append({'breed': r['breed'], 'file': os.path.basename(path), 'build': r['build'],
                      'length_m': CAT['sizes'][r['size']]})
        print(f"{os.path.relpath(path, PACK)}  {size // 1024} KB")
    if not only:
        json.dump(index, open(os.path.join(OUT, 'index.json'), 'w'), indent=1)
    print(f'total {total / 1e6:.1f} MB')
