"""Mesher checks. Run: python3 blender/test_mesher.py (needs numpy)."""
import numpy as np

from mesher import greedy_mesh, layered_mesh


def face_normal(p):
    return np.cross(p[1] - p[0], p[2] - p[0])


def test_single_voxel_is_six_outward_quads():
    a = np.zeros((1, 1, 1), np.uint8)
    a[0, 0, 0] = 9
    pos, nrm, uv, quads = greedy_mesh(a, pivot=(0.5, 0.5, 0.5))
    assert quads.shape == (6, 4)
    for q in quads:
        n = face_normal(pos[q])
        assert np.allclose(n / np.linalg.norm(n), nrm[q[0]]), (n, nrm[q[0]])
        assert np.dot(pos[q].mean(axis=0), nrm[q[0]]) > 0  # outward
    assert np.allclose(uv[:, 0], (9 + 0.5) / 256)


def test_solid_box_merges_to_six_quads_and_hides_inner_faces():
    a = np.zeros((4, 3, 5), np.uint8)
    a[:] = 20
    _, _, _, quads = greedy_mesh(a)
    assert len(quads) == 6


def test_two_colours_split_faces():
    a = np.zeros((2, 1, 1), np.uint8)
    a[0, 0, 0], a[1, 0, 0] = 10, 11
    _, _, uv, quads = greedy_mesh(a)
    assert len(quads) == 10  # 4 side faces split in two + 2 end caps
    assert sorted({round(u * 256 - 0.5) for u in uv[:, 0]}) == [10, 11]


def test_closed_mesh_edges_pair_up():
    rng = np.random.default_rng(1)
    a = (rng.random((6, 6, 6)) > 0.5).astype(np.uint8) * 30
    pos, _, _, quads = greedy_mesh(a)
    # Signed volume via divergence theorem equals voxel count for a closed, outward mesh.
    vol = 0.0
    for q in quads:
        p = pos[q]
        for t in ((0, 1, 2), (0, 2, 3)):
            vol += np.dot(p[t[0]], np.cross(p[t[1]], p[t[2]])) / 6.0
    assert abs(vol - np.count_nonzero(a)) < 1e-3, (vol, np.count_nonzero(a))



def _cell_corner(solid, d, sign, s, cu, cv, i, j, eps):
    """Reference offset of corner (cu, cv) of the face cell (i, j) on plane s, one cell at a time."""
    axes = {0: (1, 2), 1: (0, 2), 2: (0, 1)}[d]
    own = [0, 0, 0]
    own[d], own[axes[0]], own[axes[1]] = (s - 1 if sign > 0 else s), i, j

    def filled(v):
        return all(0 <= v[k] < solid.shape[k] for k in range(3)) and bool(solid[tuple(v)])

    p = [0.0, 0.0, 0.0]
    p[d] = s + eps * sign
    for axis, c, lo in ((axes[0], cu, i), (axes[1], cv, j)):
        t = -1 if c == lo else 1
        side = list(own)
        side[axis] += t
        ahead = list(side)
        ahead[d] += sign
        shift = -t if filled(ahead) else 0 if filled(side) else t
        p[axis] = c + eps * shift
    return p


def test_layered_mesh_moves_open_faces_out_flat_and_joined():
    rng = np.random.default_rng(3)
    eps = 0.2
    for trial in range(12):
        solid = (rng.random((5, 5, 4)) < 0.55).astype(np.uint8) * rng.integers(1, 4, (5, 5, 4)).astype(np.uint8)
        solid[solid > 0] = np.where(rng.random(int((solid > 0).sum())) < 0.5, 3, 5)
        blocks = [np.where(np.arange(5)[:, None, None] < 2, solid, 0).astype(np.uint8), np.where(np.arange(5)[:, None, None] >= 2, solid, 0).astype(np.uint8)]
        for block in blocks:
            pos, nrm, _uv, quads = layered_mesh(block, (0, 0, 0), solid != 0, eps)
            for q in quads:
                n = nrm[q[0]]
                d = int(np.argmax(np.abs(n)))
                sign = int(np.sign(n[d]))
                s = int(round(pos[q[0], d] - eps * sign))
                assert np.allclose(pos[q, d], s + eps * sign), pos[q]  # flat, eps out along the normal
                axes = {0: (1, 2), 1: (0, 2), 2: (0, 1)}[d]
                lat = np.rint(pos[q][:, list(axes)]).astype(int)
                i, j = lat.min(axis=0)
                w, h = lat.max(axis=0) - (i, j)
                # corners equal the reference; every cell corner along a side lies on that side (no cracks)
                for cu, cv in ((i, j), (i + w, j), (i + w, j + h), (i, j + h)):
                    ci, cj = min(cu, i + w - 1), min(cv, j + h - 1)
                    ref = _cell_corner(solid != 0, d, sign, s, cu, cv, ci, cj, eps)
                    k = int(np.argmin(np.abs(lat - (cu, cv)).sum(axis=1)))
                    assert np.allclose(pos[q[k]], ref, atol=1e-5), (pos[q[k]], ref)
                u_lo, u_hi = pos[q, axes[0]].min(), pos[q, axes[0]].max()
                v_lo, v_hi = pos[q, axes[1]].min(), pos[q, axes[1]].max()
                for cv in range(j, j + h + 1):
                    cj = min(cv, j + h - 1)
                    assert abs(_cell_corner(solid != 0, d, sign, s, i, cv, i, cj, eps)[axes[0]] - u_lo) < 1e-5
                    assert abs(_cell_corner(solid != 0, d, sign, s, i + w, cv, i + w - 1, cj, eps)[axes[0]] - u_hi) < 1e-5
                for cu in range(i, i + w + 1):
                    ci = min(cu, i + w - 1)
                    assert abs(_cell_corner(solid != 0, d, sign, s, cu, j, ci, j, eps)[axes[1]] - v_lo) < 1e-5
                    assert abs(_cell_corner(solid != 0, d, sign, s, cu, j + h, ci, j + h - 1, eps)[axes[1]] - v_hi) < 1e-5


def test_layered_mesh_joins_a_diagonal_step():
    # Two voxels touching along one edge: the grown boxes overlap there, and the faces meet at their true corners.
    a = np.zeros((2, 2, 1), np.uint8)
    a[0, 0, 0] = a[1, 1, 0] = 9
    pos, nrm, _uv, _q = layered_mesh(a, (0, 0, 0), a != 0, 0.1)
    xy = {(round(float(p[0]), 4), round(float(p[1]), 4)) for p, n in zip(pos, nrm) if abs(n[2]) < 0.5}
    assert (1.1, 0.9) in xy and (0.9, 1.1) in xy  # A's +x meets B's -y; B's -x meets A's +y
    assert (1.1, 1.1) not in xy and (0.9, 0.9) not in xy


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
