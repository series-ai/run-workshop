"""Make every bed, cave, house and litter box big enough for the biggest cat.

python3 fit.py [cat-sizes.json] [--write]     (cat-sizes.json: capture.py sizes -> /tmp/chonky-cats/)

For each container prop it compares the space inside (outer bounds of models/<slug>.glb less its
rims and walls) with the biggest cat body (tail left out) at the large size, 0.65, in the pose
used there: curled up (loaf) for beds, caves and houses, sitting for litter boxes, crouched for
the tunnel. A prop that is too small grows uniformly until the cat fits; --write puts the new
height (and length) into props.csv, so optimize_all.sh rebuilds it. Props are never shrunk.
"""
import csv
import json
import os
import struct
import sys

here = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
sizes = json.load(open(args[0] if args else '/tmp/chonky-cats/cat-sizes.json'))
LARGE = 0.65


def cat(pose):
    """(length, width, height) of the biggest body in a pose at the large size."""
    return tuple(max(sizes[b][pose][k] for b in sizes) * LARGE for k in ('l', 'w', 'h'))


# slug: (pose, wall: fraction of the outer size lost to rims / walls on each side,
#        roof: fraction of the height lost to the roof, or None for an open top)
SPEC = {
    'avocado-bed': ('loaf_loop', 0.12, None), 'watermelon-bed': ('loaf_loop', 0.12, None),
    'fruit-tart-bed': ('loaf_loop', 0.1, None), 'toast-bed': ('loaf_loop', 0.08, None),
    'heated-pad': ('loaf_loop', 0.0, None), 'scratch-pad': ('loaf_loop', 0.04, None),
    'scratch-lounge': ('loaf_loop', 0.05, None), 'radiator-hammock': ('loaf_loop', 0.08, None),
    'window-perch': ('loaf_loop', 0.08, None), 'laundry-basket': ('loaf_loop', 0.08, None),
    'cardboard-box': ('loaf_loop', 0.05, None), 'litter-tray': ('sit_loop', 0.07, None),
    'paper-bag': ('loaf_loop', 0.06, 0.06), 'cat-cave': ('loaf_loop', 0.1, 0.15),
    'cat-condo': ('loaf_loop', 0.08, 0.12), 'cat-teepee': ('loaf_loop', 0.12, 0.3),
    'pineapple-house': ('loaf_loop', 0.1, 0.3), 'strawberry-cave': ('loaf_loop', 0.1, 0.25),
    'mushroom-house': ('loaf_loop', 0.2, 0.45), 'shark-bed': ('loaf_loop', 0.1, 0.2),
    'covered-litter': ('sit_loop', 0.07, 0.12), 'carrier': ('loaf_loop', 0.08, 0.12),
    'crinkle-tunnel': ('down_loop', 0.05, 0.05), 'mushroom-tree': ('loaf_loop', 0.05, None),
}


def bounds(path):
    """(x, y, z) size of a GLB, glTF axes (y up), from its POSITION accessor bounds."""
    d = open(path, 'rb').read()
    jl = struct.unpack('<I', d[12:16])[0]
    doc = json.loads(d[20:20 + jl])
    mn, mx = [1e9] * 3, [-1e9] * 3
    for n in doc['nodes']:
        if 'mesh' not in n:
            continue
        s = n.get('scale', [1, 1, 1])
        for p in doc['meshes'][n['mesh']]['primitives']:
            a = doc['accessors'][p['attributes']['POSITION']]
            mn = [min(m, v * k) for m, v, k in zip(mn, a['min'], s)]
            mx = [max(m, v * k) for m, v, k in zip(mx, a['max'], s)]
    return [b - a for a, b in zip(mn, mx)]


rows = list(csv.DictReader(open(os.path.join(here, 'props.csv'))))
changed = []
for r in rows:
    spec = SPEC.get(r['slug'])
    path = os.path.join(here, 'models', r['slug'] + '.glb')
    if not spec or not os.path.exists(path):
        continue
    pose, wall, roof = spec
    L, W, H = cat(pose)
    x, y, z = bounds(path)
    long_, short = max(x, z), min(x, z)
    need = [L / (long_ * (1 - 2 * wall)), W / (short * (1 - 2 * wall))]
    if roof is not None:
        need.append(H / (y * (1 - roof)))
    k = max(need)
    status = 'fits' if k <= 1.0 else f'grow x{k:.2f}'
    print(f"{r['slug']:18} inside {long_ * (1 - 2 * wall):.2f} x {short * (1 - 2 * wall):.2f}"
          f"{'' if roof is None else f' x {y * (1 - roof):.2f}'}  cat {L:.2f} x {W:.2f}{'' if roof is None else f' x {H:.2f}'}  {status}")
    if k > 1.0:
        k *= 1.03   # a little room to spare
        r['height'] = str(round(float(r['height']) * k, 4))
        if r.get('length'):
            r['length'] = str(round(float(r['length']) * k, 4))
        changed.append(r['slug'])
if '--write' in sys.argv and changed:
    w = csv.DictWriter(open(os.path.join(here, 'props.csv'), 'w', newline=''), fieldnames=rows[0].keys())
    w.writeheader()
    w.writerows(rows)
print('CHANGED', ' '.join(changed))
