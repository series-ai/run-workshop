"""Keep only the tracks shared clips need: rotations, the root's motion and any scale that changes.

python3 strip_tracks.py <file.glb>   (rewrites in place)

Bone offsets are each dog's proportions; a translation track from one dog would
squash another. Unused accessors and buffer views are dropped and the binary
chunk is repacked.
"""
import json
import struct
import sys

path = sys.argv[1]
data = open(path, 'rb').read()
json_len = struct.unpack('<I', data[12:16])[0]
doc = json.loads(data[20:20 + json_len])
bin_start = 20 + json_len + 8
binary = data[bin_start:bin_start + struct.unpack('<I', data[20 + json_len:24 + json_len])[0]]

def floats(acc_id):
    acc = doc['accessors'][acc_id]
    view = doc['bufferViews'][acc['bufferView']]
    n = acc['count'] * {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[acc['type']]
    start = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    return struct.unpack(f'<{n}f', binary[start:start + 4 * n])


for anim in doc.get('animations', []):
    def wanted(c):
        path, name = c['target']['path'], doc['nodes'][c['target']['node']].get('name')
        if path == 'scale':  # paw spread etc.; skip tracks that stay at 1
            return any(abs(v - 1) > 1e-3 for v in floats(anim['samplers'][c['sampler']]['output']))
        return path == 'rotation' or (path == 'translation' and name == 'root')
    keep = [c for c in anim['channels'] if wanted(c)]
    used = sorted({c['sampler'] for c in keep})
    remap = {old: new for new, old in enumerate(used)}
    anim['samplers'] = [anim['samplers'][i] for i in used]
    for c in keep:
        c['sampler'] = remap[c['sampler']]
    anim['channels'] = keep


# Collect accessors still referenced anywhere, then rebuild accessors, views and the buffer.
def walk(node, found):
    if isinstance(node, dict):
        for k, v in node.items():
            if k in ('accessor', 'indices', 'input', 'output', 'inverseBindMatrices') and isinstance(v, int):
                found.add(v)
            elif k == 'attributes':
                found.update(v.values())
            else:
                walk(v, found)
    elif isinstance(node, list):
        for v in node:
            walk(v, found)


refs = set()
walk({k: v for k, v in doc.items() if k not in ('accessors', 'bufferViews')}, refs)
acc_map = {old: new for new, old in enumerate(sorted(refs))}
accessors = [doc['accessors'][i] for i in sorted(refs)]
view_ids = sorted({a['bufferView'] for a in accessors if 'bufferView' in a} |
                  {img['bufferView'] for img in doc.get('images', []) if 'bufferView' in img})
view_map, views, out = {}, [], bytearray()
for old in view_ids:
    v = dict(doc['bufferViews'][old])
    chunk = binary[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
    out += b'\0' * (-len(out) % 4)
    v['byteOffset'] = len(out)
    out += chunk
    view_map[old] = len(views)
    views.append(v)
for a in accessors:
    if 'bufferView' in a:
        a['bufferView'] = view_map[a['bufferView']]
for img in doc.get('images', []):
    if 'bufferView' in img:
        img['bufferView'] = view_map[img['bufferView']]


def remap_refs(node):
    if isinstance(node, dict):
        for k, v in node.items():
            if k in ('accessor', 'indices', 'input', 'output', 'inverseBindMatrices') and isinstance(v, int):
                node[k] = acc_map[v]
            elif k == 'attributes':
                node[k] = {n: acc_map[i] for n, i in v.items()}
            else:
                remap_refs(v)
    elif isinstance(node, list):
        for v in node:
            remap_refs(v)


body = {k: v for k, v in doc.items() if k not in ('accessors', 'bufferViews')}
remap_refs(body)
doc = {**body, 'accessors': accessors, 'bufferViews': views}
out += b'\0' * (-len(out) % 4)
doc['buffers'] = [{'byteLength': len(out)}]

js = json.dumps(doc, separators=(',', ':')).encode()
js += b' ' * (-len(js) % 4)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out))
glb += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out)
open(path, 'wb').write(glb)
