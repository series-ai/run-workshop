"""Coat painting for the rigged chunky-toy dogs (plain Python: numpy, scipy, Pillow).

A colorway is the same rigged model with a repainted texture. To paint markings in the
right place on any breed, every texel gets:
  - its 3D position on the dog (rest pose, height 1, head toward +Z, dog's left +X, up +Y),
  - its skin weights (head / neck / body / leg / tail bones), interpolated from the mesh,
  - its original coat color, split into a few clusters (e.g. tan / black / white).
Markings are then soft masks built from those (tan points, saddle, blaze, merle...).

Shading and fur detail survive repainting: each texel keeps its lightness offset from its
original cluster, added on top of the new color.
"""
import io
import json
import struct

import numpy as np
from PIL import Image
from scipy.cluster.vq import kmeans2
from scipy.ndimage import distance_transform_edt, gaussian_filter
from scipy.spatial import cKDTree


# ---------------------------------------------------------------- GLB io
def read_glb(path):
    data = open(path, 'rb').read()
    n = struct.unpack('<I', data[12:16])[0]
    doc = json.loads(data[20:20 + n])
    binary = data[20 + n + 8:]
    return doc, bytearray(binary)


def accessor(doc, binary, i):
    a = doc['accessors'][i]
    v = doc['bufferViews'][a['bufferView']]
    comp = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}[a['componentType']]
    nc = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
    size = struct.calcsize(comp)
    stride = v.get('byteStride', size * nc)
    off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    dt = np.dtype(comp).newbyteorder('<')
    if stride == size * nc:
        arr = np.frombuffer(bytes(binary[off:off + a['count'] * stride]), dtype=dt).reshape(a['count'], nc)
    else:
        arr = np.array([np.frombuffer(bytes(binary[off + k * stride: off + k * stride + size * nc]), dtype=dt)
                        for k in range(a['count'])])
    arr = arr.astype(np.float64)
    if a.get('normalized'):
        arr /= {'B': 255, 'H': 65535, 'b': 127, 'h': 32767}[comp]
    return arr


def write_glb(path, doc, binary):
    js = json.dumps(doc, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    binary = bytes(binary) + b'\0' * (-len(binary) % 4)
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binary))
    out += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binary), 0x004E4942) + binary
    open(path, 'wb').write(out)


def replace_image(doc, binary, image_index, jpeg_bytes):
    """Swap one embedded image for new bytes; repacks the binary chunk."""
    views = doc['bufferViews']
    target = doc['images'][image_index]['bufferView']
    chunks = []
    for i, v in enumerate(views):
        src = jpeg_bytes if i == target else bytes(binary[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']])
        chunks.append(src)
    out = bytearray()
    for v, c in zip(views, chunks):
        out += b'\0' * (-len(out) % 4)
        v['byteOffset'] = len(out)
        v['byteLength'] = len(c)
        out += c
    doc['buffers'][0]['byteLength'] = len(out)
    doc['images'][image_index]['mimeType'] = 'image/jpeg'
    return out


# ---------------------------------------------------------------- color
def srgb_to_lab(rgb):
    c = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def lab_to_srgb(lab):
    fy = (lab[..., 0] + 16) / 116
    fx, fz = fy + lab[..., 1] / 500, fy - lab[..., 2] / 200
    f = np.stack([fx, fy, fz], -1)
    xyz = np.where(f ** 3 > 0.008856, f ** 3, (f - 16 / 116) / 7.787) * np.array([0.95047, 1.0, 1.08883])
    Mi = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]])
    c = np.clip(xyz @ Mi.T, 0, 1)
    return np.where(c <= 0.0031308, 12.92 * c, 1.055 * c ** (1 / 2.4) - 0.055)


def hex_lab(h):
    h = h.lstrip('#')
    return srgb_to_lab(np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]))


# ---------------------------------------------------------------- noise
class Noise3:
    """Smooth 3D value noise (fBm) for organic patterns, seeded."""

    def __init__(self, seed, scale=8.0, octaves=3):
        self.rng = np.random.default_rng(seed)
        self.grid = self.rng.random((32, 32, 32))
        self.scale, self.octaves = scale, octaves

    def _one(self, p):
        p = p % 31
        i = np.floor(p).astype(int)
        f = p - i
        f = f * f * (3 - 2 * f)
        g = self.grid
        out = 0
        for dx in (0, 1):
            for dy in (0, 1):
                for dz in (0, 1):
                    w = (f[:, 0] if dx else 1 - f[:, 0]) * (f[:, 1] if dy else 1 - f[:, 1]) * (f[:, 2] if dz else 1 - f[:, 2])
                    out = out + w * g[(i[:, 0] + dx) % 32, (i[:, 1] + dy) % 32, (i[:, 2] + dz) % 32]
        return out

    def __call__(self, pos, scale=None):
        shape = pos.shape[:-1]
        pos = pos.reshape(-1, 3)
        return self._fbm(pos, scale).reshape(shape)

    def _fbm(self, pos, scale=None):
        s = scale or self.scale
        total, amp, norm = 0, 1.0, 0
        for o in range(self.octaves):
            total = total + amp * self._one(pos * s * (2 ** o) + 7.3 * o)
            norm += amp
            amp *= 0.5
        return total / norm


def worley(pos, points):
    d, _ = cKDTree(points).query(pos)
    return d


# ---------------------------------------------------------------- the dog
def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


class Dog:
    """A rigged dog GLB, ready for painting."""

    def __init__(self, path, scale=1):
        self.path = path
        self.doc, self.binary = read_glb(path)
        doc, binary = self.doc, self.binary
        mesh = doc['meshes'][0]
        skin = doc['skins'][0]
        self.joint_names = [doc['nodes'][j]['name'] for j in skin['joints']]
        # The coat primitive is the textured one; mouth and tongue are flat colors.
        prim = next(p for p in mesh['primitives']
                    if 'baseColorTexture' in doc['materials'][p['material']].get('pbrMetallicRoughness', {}))
        tex = doc['materials'][prim['material']]['pbrMetallicRoughness']['baseColorTexture']['index']
        self.image_index = doc['textures'][tex]['source']
        view = doc['bufferViews'][doc['images'][self.image_index]['bufferView']]
        img = Image.open(io.BytesIO(bytes(binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']])))
        img = img.convert('RGB')
        if scale != 1:   # paint at a higher resolution than the source, for crisp markings
            img = img.resize((img.width * scale, img.height * scale), Image.BICUBIC)
        self.tex = np.asarray(img, dtype=np.float64) / 255
        self.H, self.W = self.tex.shape[:2]
        A = prim['attributes']
        self.pos = accessor(doc, binary, A['POSITION'])
        self.uv = accessor(doc, binary, A['TEXCOORD_0'])
        joints = accessor(doc, binary, A['JOINTS_0']).astype(int)
        weights = accessor(doc, binary, A['WEIGHTS_0'])
        self.vw = np.zeros((len(self.pos), len(self.joint_names)))
        for k in range(4):
            np.add.at(self.vw, (np.arange(len(self.pos)), joints[:, k]), weights[:, k])
        self.idx = accessor(doc, binary, prim['indices']).astype(int).reshape(-1, 3)
        self._joints()
        self._rasterize()

    # bones in model space (rest pose) from the node hierarchy
    def _joints(self):
        doc = self.doc
        nodes = doc['nodes']
        parent = {}
        for i, n in enumerate(nodes):
            for c in n.get('children', []):
                parent[c] = i

        def mat(n):
            t = np.array(n.get('translation', [0, 0, 0]))
            x, y, z, w = n.get('rotation', [0, 0, 0, 1])
            s = np.array(n.get('scale', [1, 1, 1]))
            R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                          [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                          [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
            M = np.eye(4)
            M[:3, :3] = R * s
            M[:3, 3] = t
            return M

        def world(i):
            M = mat(nodes[i])
            while i in parent:
                i = parent[i]
                M = mat(nodes[i]) @ M
            return M
        self.J = {n['name']: world(i)[:3, 3] for i, n in enumerate(nodes) if 'name' in n}
        # Mesh may be under a transformed node; positions are in the skinned (bind) space,
        # which matches the joints' world space at rest for these exports.

    def _rasterize(self):
        """Per texel: 3D position and skin weights (barycentric), plus a coverage mask."""
        H, W = self.H, self.W
        pos3 = np.zeros((H, W, 3))
        wts = np.zeros((H, W, self.vw.shape[1]))
        cover = np.zeros((H, W), bool)
        stretch = np.zeros((H, W))
        nrm = np.zeros((H, W, 3))
        uvp = np.stack([self.uv[:, 0] * W - 0.5, self.uv[:, 1] * H - 0.5], -1)  # glTF uv: v down
        for tri in self.idx:
            p = uvp[tri]
            x0, y0 = np.floor(p.min(0)).astype(int)
            x1, y1 = np.ceil(p.max(0)).astype(int)
            x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, W - 1), min(y1, H - 1)
            if x1 < x0 or y1 < y0:
                continue
            xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
            P = np.stack([xs.ravel(), ys.ravel()], -1).astype(float)
            a, b, c = p
            v0, v1 = b - a, c - a
            den = v0[0] * v1[1] - v1[0] * v0[1]
            if abs(den) < 1e-9:
                continue
            v2 = P - a
            l1 = (v2[:, 0] * v1[1] - v1[0] * v2[:, 1]) / den
            l2 = (v0[0] * v2[:, 1] - v2[:, 0] * v0[1]) / den
            l0 = 1 - l1 - l2
            inside = (l0 >= -0.02) & (l1 >= -0.02) & (l2 >= -0.02)
            if not inside.any():
                continue
            L = np.stack([l0, l1, l2], -1)[inside]
            px, py = P[inside, 0].astype(int), P[inside, 1].astype(int)
            pos3[py, px] = L @ self.pos[tri]
            wts[py, px] = L @ self.vw[tri]
            cover[py, px] = True
            # Texels per unit of 3D area: triangles spanning UV islands are huge in UV.
            area3 = np.linalg.norm(np.cross(self.pos[tri[1]] - self.pos[tri[0]], self.pos[tri[2]] - self.pos[tri[0]])) / 2
            stretch[py, px] = abs(den) / 2 / max(area3, 1e-9)
            fn = np.cross(self.pos[tri[1]] - self.pos[tri[0]], self.pos[tri[2]] - self.pos[tri[0]])
            nrm[py, px] = fn / max(np.linalg.norm(fn), 1e-12)
        self.P, self.Wt, self.cover, self.N = pos3, wts, cover, nrm   # N: face normal per texel
        med = np.median(stretch[cover])
        self.bad = cover & (stretch > 8 * med)        # cross-island triangles (sample the gutter)
        self.good = cover & ~self.bad

    # ------------------------------------------------------------ helpers
    def bone(self, *prefixes):
        """Summed skin weight per texel for bones starting with any prefix."""
        cols = [i for i, n in enumerate(self.joint_names) if n.startswith(prefixes)]
        return self.Wt[..., cols].sum(-1) if cols else np.zeros((self.H, self.W))

    def repaired_texture(self):
        """Original texture, with cross-island triangles filled from the nearest good
        surface in 3D, and the gutters filled outward so seams don't bleed grey."""
        tex = self.tex.copy()
        gy, gx = np.nonzero(self.good)
        tree = cKDTree(self.P[gy, gx])
        by, bx = np.nonzero(self.bad)
        if len(by):
            _, k = tree.query(self.P[by, bx])
            tex[by, bx] = self.tex[gy[k], gx[k]]
        return tex

    def dilate(self, img):
        """Fill uncovered texels from the nearest covered one (seam padding)."""
        _, (iy, ix) = distance_transform_edt(~self.cover, return_indices=True)
        return img[iy, ix]


def features(d, tex, lab=None):
    """Eyes and nose: texels on the front of the head that are clearly darker than the
    surface around them in 3D (works on black faces too, where they're only a little
    darker). Returns a soft 0..1 mask over the texture."""
    lab = srgb_to_lab(tex) if lab is None else lab
    L = lab[..., 0]
    head = (d.bone('head', 'jaw') > 0.5) & d.good
    hj, mo = d.J['head'], d.J['mouth']
    fwd = (d.P[..., 2] - hj[2]) / max(mo[2] - hj[2], 1e-3)        # 0 at back of skull, 1 at mouth
    zone = head & (fwd > 0.25)
    ys, xs = np.nonzero(zone)
    if not len(ys):
        return np.zeros(L.shape)
    pts, lv = d.P[ys, xs], L[ys, xs]
    tree = cKDTree(pts)
    r = 0.08 * np.linalg.norm(mo - hj)
    nb = tree.query_ball_point(pts, r)
    local = np.array([np.median(lv[n]) for n in nb])
    dark = (lv < local - 10) & (lv < 40)
    m = np.zeros(L.shape)
    m[ys[dark], xs[dark]] = 1
    # grow slightly so the anti-aliased rim of each eye comes along
    return np.clip(gaussian_filter(m, 1.0) * 3, 0, 1) * head
