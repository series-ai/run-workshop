"""Mesher checks. Run: python3 blender/test_mesher.py (needs numpy)."""
import numpy as np

from mesher import greedy_mesh


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


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
