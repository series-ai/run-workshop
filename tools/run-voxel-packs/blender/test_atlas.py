"""Atlas mesher checks. Run: python3 blender/test_atlas.py (needs numpy)."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from atlas import atlas_image, face_uvs, mesh_part, pack  # noqa: E402
from voxgrid import C, Grid  # noqa: E402


def test_colour_changes_do_not_split_faces():
    g = Grid(4, 4, 4)
    g.box(0, 0, 0, 4, 4, 4, C("wood", 3))
    g.set(1, 3, 1, C("red", 4))  # a painted top voxel
    faces = mesh_part(g).faces
    assert len(faces) == 6, len(faces)
    top = next(f for f in faces if f.normal[1] > 0)
    assert top.size == (4, 4)
    assert (top.canvas == C("red", 4)).sum() == 1


def test_prism_is_exact_and_hides_the_faces_it_covers():
    g = Grid(10, 12, 4)
    g.box(0, 0, 0, 10, 6, 4, C("stone", 3))
    g.prism("z", [(0, 6), (10, 6), (5, 11)], 0, 4, C("red", 3))  # gable roof
    faces = mesh_part(g).faces
    diagonal = [f for f in faces if np.count_nonzero(np.abs(f.normal) > 1e-6) > 1]
    assert len(diagonal) == 2, len(diagonal)
    # The wall top under the prism is not emitted, and the prism base is buried.
    assert not any(f.normal[1] > 0.99 and abs(f.verts[0][1] - 6) < 1e-6 for f in faces)
    assert not any(f.normal[1] < -0.99 and abs(f.verts[0][1] - 6) < 1e-6 for f in faces)
    for f in diagonal:
        assert (f.canvas == C("red", 3)).all()


def test_atlas_places_canvases_without_overlap():
    g = Grid(6, 5, 3)
    g.box(0, 0, 0, 6, 5, 3, C("gold", 4))
    faces = mesh_part(g).faces
    w, h = pack(faces)
    img = atlas_image(faces, w, h)
    for f in faces:
        x, y = f.atlas_xy
        assert (img[y : y + f.size[1], x : x + f.size[0]] == f.canvas).all()
        uv = face_uvs(f, w, h)
        assert uv.min() >= 0 and uv.max() <= 1


def test_frustums_make_pyramids_hip_roofs_and_cones():
    g = Grid(20, 20, 20)
    g.prism("y", [(2, 2), (18, 2), (18, 12), (2, 12)], 0, 8, C("red", 4), top=[(10, 7)] * 4)  # pyramid
    faces = mesh_part(g).faces
    assert len(faces) == 5, len(faces)  # a base and four triangles
    assert sum(len(f.verts) == 3 for f in faces) == 4
    h = Grid(24, 12, 16)
    h.prism("y", [(0, 0), (24, 0), (24, 16), (0, 16)], 0, 8, C("red", 4), top=[(6, 8), (18, 8), (18, 8), (6, 8)])  # hip roof
    faces = mesh_part(h).faces
    assert sorted(len(f.verts) for f in faces) == [3, 3, 4, 4, 4], sorted(len(f.verts) for f in faces)
    c = Grid(20, 16, 20)
    from pnkit import ngon

    c.prism("y", ngon(10, 10, 8, 12), 0, 14, C("stone", 4), top=ngon(10, 10, 3, 12))  # tapered chimney / cone
    faces = mesh_part(c).faces
    assert len(faces) == 14 and all(f.canvas is not None and (f.canvas > 0).all() for f in faces)


def test_prism_faces_on_voxel_centres_are_kept():
    """A facet whose plane passes through voxel centres must not be buried by its own voxels."""
    from pnshapes import drum

    g = Grid(30, 30, 30)
    drum(g, 15, 14.5, 0, 24, 12, band=("gold", 5), icon="skull")
    front = [f for f in mesh_part(g).faces if f.normal[2] < -0.99 and f.size[1] > 10]
    assert front, "the drum's front facet is missing"
    assert (front[0].canvas == C("darkwood", 2)).any(), "the icon does not show on the front facet"


def test_grid_transforms_keep_prisms():
    g = Grid(12, 9, 7)
    g.prism("y", [(2.3, 1.2), (9.1, 1.4), (6.2, 6.1)], 1, 8, C("red", 3))
    g.prism("x", [(0.2, 0.3), (5.3, 0.1), (0.4, 4.2)], 4, 11, C("gold", 3))
    g.prism("z", [(1.2, 1.1), (7.3, 2.2), (3.1, 8.4)], 0, 6, C("sky", 3))
    g.prism("y", [(1.3, 1.2), (6.1, 1.4), (6.2, 5.3), (1.1, 5.2)], 0.2, 6, C("gold", 3), top=[(3.1, 3.3)] * 4)
    for k in range(4):
        assert (g.rot_y(k).solid_mask() == np.rot90(g.solid_mask(), k, axes=(2, 0))).all(), k
    for axis, i in (("x", 0), ("y", 1), ("z", 2)):
        assert (g.flip(axis).solid_mask() == np.flip(g.solid_mask(), i)).all(), axis
    assert (g.crop(1, 1, 1, 10, 8, 6).solid_mask() == g.solid_mask()[1:10, 1:8, 1:6]).all()


# ---------------------------------------------------------------- the kit
def kit_cases():
    """(name, grid, triangle budget) for every kit shape, glyph and painter.
    The tests mesh them all; a contact sheet can render them too."""
    import pnglyph as G
    import pnkit as K
    import pnpaint as PP
    import pnshapes as S
    import paint as P

    cases = []

    def add(name, g, budget):
        cases.append((name, g, budget))

    g = Grid(8, 24, 24)
    S.wheel(g, "x", 12, 0, 11, 2, 6, spokes=8, gaps=True)
    add("wheel-gaps", g, 400)
    g = Grid(24, 24, 8)
    S.wheel(g, "z", 12, 0, 11, 2, 6, spokes=6)
    add("wheel-solid", g, 200)
    g = Grid(8, 20, 20)
    S.tyre(g, "x", 10, 10, 9, 1, 7)
    add("tyre", g, 120)
    g = Grid(16, 6, 16)
    S.disc(g, "y", 8, 8, 7, 0, 3, "gold", 5, n=12)
    add("disc", g, 120)
    g = Grid(26, 24, 26)
    S.drum(g, 13, 13, 0, 22, 10, ramp="red", band=("gold", 5), icon="skull", seed=3)
    add("drum", g, 300)
    g = Grid(28, 28, 5)
    S.gear(g, "z", 14, 14, 9, 1, 4, teeth=9, depth=3)
    add("gear", g, 400)
    g = Grid(26, 24, 12)
    S.pipe(g, [(4, 3, 6), (4, 18, 6), (20, 18, 6)], s=3)
    add("pipe", g, 300)
    g = Grid(24, 24, 6)
    b = S.bar(g, "z", (3, 2), (20, 21), 3, 1, 5, "wood", 5)
    P.planks(g, b, "wood", 5, width=3, across="y", frame=((0.707, 0.707, 0.0), (0.707, -0.707, 0.0)))
    add("bar", g, 40)
    g = Grid(22, 30, 8)
    g.prism("z", S.quad((11, 3), (6, 14), 3, 2, cap=1.0), 2, 6, C("skin", 4))
    g.prism("z", S.rotate(S.quad((11, 14), (11, 26), 2.5, 1.5, cap=1.2), 11, 14, -25), 2, 6, C("skin", 5))
    add("quad-rotate", g, 80)
    g = Grid(18, 22, 18)
    S.cone(g, "y", 9, 9, 8, 0, 20, "purple", 4, n=8)
    add("cone", g, 60)
    g = Grid(24, 18, 20)
    S.pyramid(g, 2, 2, 22, 18, 0, 16, "red", 4, tiles=True)
    add("pyramid", g, 40)
    g = Grid(40, 16, 28)
    S.hip_roof(g, 1, 1, 39, 27, 0, 14, "red", 4)
    add("hip-roof", g, 40)
    g = Grid(34, 20, 34)
    S.dome(g, 17, 17, 0, 16, n=8, rings=3)
    add("dome", g, 150)
    g = Grid(34, 20, 34)
    S.dome(g, 17, 17, 0, 16, h=14, n=12, rings=4, ramp="cyan", base=5, cap_r=3, ribs=("rust", 3))
    add("dome-cap", g, 250)
    g = Grid(16, 22, 16)
    S.spire(g, 8, 8, 0, 6, 20, style="pyramid")
    add("spire", g, 40)
    g = Grid(16, 22, 16)
    S.spire(g, 8, 8, 0, 6, 20, style="gable")
    add("spire-gable", g, 60)
    g = Grid(26, 22, 6)
    S.cross(g, 13, 0, 3, h=20)
    add("cross", g, 200)
    g = Grid(18, 20, 16)
    S.skull(g, 9, 0, 8, s=14)
    add("skull", g, 200)
    g = Grid(20, 24, 8)
    S.tombstone(g, 10, 4, w=18, h=22, glyph="rip", seed=1)
    add("tombstone", g, 60)
    g = Grid(24, 24, 24)
    S.pumpkin(g, 12, 0, 12, seed=1)
    add("pumpkin", g, 300)
    g = Grid(40, 44, 6)
    S.banner(g, 2, 0, 1, 40, 30, 22)
    add("banner", g, 120)
    g = Grid(22, 32, 22)
    S.lantern(g, 11, 0, 11, seed=10)
    add("lantern", g, 200)
    g = Grid(30, 22, 8)
    g.prism("z", S.arch(15, 1, 10, 20, bulge=1.5), 1, 7, C("bone", 6))
    add("arch", g, 60)

    # pnkit on every face: windows, doors, lancets, roses
    g = Grid(60, 60, 60)
    K.box(g, 10, 0, 10, 50, 44, 50, "stone", 4)
    for face, plane in (("-z", 10), ("+z", 50), ("-x", 10), ("+x", 50)):
        K.window(g, face, plane, 14, 26, 24, 36)
        K.door(g, face, plane, 30, 44, 0, 20)
        K.lancet(g, face, plane, 16, 24, 4, 20)
        K.rose(g, face, plane, 38, 32, 5)
    K.window(g, "top", 44, 14, 26, 14, 26)
    K.door(g, "top", 44, 30, 44, 30, 44)
    add("pnkit-faces", g, 3000)
    g = Grid(60, 50, 50)
    K.box(g, 12, 0, 12, 48, 24, 38, "sand", 5)
    K.gable_roof(g, 12, 48, 12, 38, 24, 42, ramp="purple", trim="stone", trim_shade=6, ridge="z")
    add("gable-stone-trim", g, 400)

    # glyphs and painters on a sign board and slabs
    g = Grid(90, 40, 6)
    K.box(g, 0, 0, 2, 90, 40, 6, "navy", 3)
    y = 30
    G.text(g, "-z", 2, 2, y, "ABCDEFGHIJKLM", "bone", 7)
    G.text(g, "-z", 2, 2, y - 9, "NOPQRSTUVWXYZ", "bone", 7)
    G.text(g, "-z", 2, 2, y - 18, "0123456789-.!?/", "gold", 6)
    add("font", g, 20)
    g = Grid(290, 26, 6)
    K.box(g, 0, 0, 2, 290, 26, 6, "navy", 2)
    u = 3
    for name in G.ICONS:  # left to right as seen from the front
        w, h = G.icon_size(name, 2)
        G.icon(g, "-z", 2, 290 - u - w, 3, name, "gold", 5, scale=2)
        u += w + 4
    add("icons", g, 20)
    # the default camera sees -z and +x; turning the second cube shows +z and -x
    for k, (a, b) in enumerate(((("-z", "FRONT"), ("+x", "+X")), (("+z", "BACK"), ("-x", "-X")))):
        g = Grid(40, 40, 40)
        K.box(g, 2, 0, 2, 38, 36, 38, "sand", 5)
        for face, word in (a, b):
            w, _h = G.text_size(word)
            plane = 2 if face[0] == "-" else 38
            G.text(g, face, plane, 20 - w // 2, 20, word, "red", 3)
        G.text(g, "top", 36, 20 - G.text_size("TOP")[0] // 2, 16, "TOP", "blue", 3)
        add(f"text-faces-{k}", g.rot_y(2) if k else g, 20)
    for name, fn in (
        ("hazard", lambda g, m: PP.hazard(g, m)),
        ("corrugate", lambda g, m: PP.corrugate(g, m, "rust", 4)),
        ("concrete", lambda g, m: PP.concrete(g, m, "sand", 5, size=8)),
        ("fur", lambda g, m: PP.fur(g, m, "wood", 4)),
        ("blotch", lambda g, m: (P.flat(g, m, "purple", 4), PP.blotch(g, m, "purple", 2, chance=0.12))),
        ("plated", lambda g, m: PP.plated(g, m, "steel", 4)),
    ):
        g = Grid(26, 16, 26)
        m = K.box(g, 1, 0, 1, 25, 14, 25, "gray", 4)
        fn(g, m)
        add(f"paint-{name}", g, 20)
    g = Grid(26, 16, 26)
    K.box(g, 1, 0, 3, 25, 14, 25, "steel", 4)
    w = K.box(g, *K.on_face("-z", 3, 4, 22, 2, 12, 0, 1), "cyan", 6)
    PP.glow_window(g, w)
    s = K.box(g, *K.on_face("top", 14, 6, 20, 8, 20, 0, 1), "cyan", 6)
    PP.glow_window(g, s, rim=("steel", 3))
    add("paint-glow-window", g, 60)
    return cases


def _mesh_tris(g):
    faces = mesh_part(g).faces
    return faces, sum(len(f.verts) - 2 for f in faces)


def test_wheels_sit_on_the_ground():
    import pnshapes as S

    for axis in ("x", "z"):
        for n in (6, 8, 12):
            for gaps in (False, True):
                g = Grid(30, 30, 30)
                w = S.wheel(g, axis, 15, 3, 10, 12, 18, n=n, gaps=gaps)
                faces, _ = _mesh_tris(g)
                low = min(float(f.verts[:, 1].min()) for f in faces)
                assert abs(low - 3) < 1e-6, (axis, n, gaps, low)
                bottom = [f for f in faces if f.normal[1] < -0.999 and abs(f.verts[0][1] - 3) < 1e-6]
                assert bottom, (axis, n, gaps, "no flat side on the ground")
                width = max(float(np.ptp(f.verts[:, 0 if axis == "z" else 2])) for f in bottom)
                assert width > 5, (axis, n, gaps, width)  # a whole side rests on y0, not a corner
                assert abs(w["centre"][1] - 13) < 1e-9


def _view(g, face):
    """What a viewer outside `face` sees: palette indices, rows top to bottom,
    columns left to right. Worked out from the camera, not from pnglyph."""
    fwd = {"-z": (0, 0, 1), "+z": (0, 0, -1), "-x": (1, 0, 0), "+x": (-1, 0, 0), "top": (0, -1, 0)}[face]
    up = (0, 0, 1) if face == "top" else (0, 1, 0)
    right = tuple(int(c) for c in np.cross(fwd, up))
    axes = [int(np.nonzero(v)[0][0]) for v in (right, up, fwd)]
    b = np.transpose(g.a, axes)
    for k, v in enumerate((right, up, fwd)):
        if sum(v) < 0:
            b = np.flip(b, axis=k)
    hit = np.argmax(b > 0, axis=2)
    img = np.take_along_axis(b, hit[..., None], axis=2)[..., 0]  # [right, up]
    return img.T[::-1]


def test_text_and_icons_are_never_mirrored():
    import pnglyph as G

    for face, plane in (("-z", 4), ("+z", 36), ("-x", 4), ("+x", 36), ("top", 36)):
        for kind in ("text", "icon"):
            g = Grid(40, 40, 40)
            g.box(4, 0, 4, 36, 36, 36, C("sand", 5))
            if kind == "text":
                rows = G.text_rows("RF74?")
                G.text(g, face, plane, 6, 10, "RF74?", "red", 3)
            else:
                rows = G.ICONS["bolt"]
                G.icon(g, face, plane, 6, 10, "bolt", "red", 3)
            ink = _view(g, face) == C("red", 3)
            ys, xs = np.nonzero(ink)
            seen = ink[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
            want = np.array([[ch == "#" for ch in r.ljust(len(rows[0]), ".")] for r in rows])
            wy, wx = np.nonzero(want)
            want = want[wy.min() : wy.max() + 1, wx.min() : wx.max() + 1]
            assert seen.shape == want.shape and (seen == want).all(), (face, kind, "\n" + "\n".join("".join("#" if c else "." for c in r) for r in seen))


def test_every_kit_shape_meshes_within_budget():
    from voxgrid import palette_colors

    colors = palette_colors("fantasy")
    value = np.array([max(int(c[i : i + 2], 16) for i in (1, 3, 5)) / 255 for c in colors])
    for name, g, budget in kit_cases():
        faces, tris = _mesh_tris(g)
        assert faces, name
        assert tris <= budget, (name, tris, budget)
        for f in faces:
            assert f.canvas is not None and (f.canvas > 0).all(), (name, "empty texels")
            assert value[f.canvas].mean() > 0.12, (name, "a black face", f.normal)


def _diagonal(c: np.ndarray) -> bool:
    """True when a canvas pattern repeats along a diagonal more than along x or z."""
    eq = lambda a, b: float((a == b).mean())  # noqa: E731
    axis = max(eq(c[:, 1:], c[:, :-1]), eq(c[1:, :], c[:-1, :]))
    diag = max(eq(c[1:, 1:], c[:-1, :-1]), eq(c[1:, :-1], c[:-1, 1:]))
    return diag > axis + 0.05


def _top_canvas(painter, thick=6):
    g = Grid(30, 10, 30)
    g.box(1, 0, 1, 29, thick, 29, C("gray", 4))
    painter(g, g.a > 0)
    top = next(f for f in mesh_part(g).faces if f.normal[1] > 0.99)
    return top.canvas[1:-1, 1:-1]  # the rim voxels also show on the sides


def test_painters_leave_tops_free_of_diagonal_streaks():
    import paint as P
    import pnpaint as PP

    painters = {
        "corrugate": lambda g, m: PP.corrugate(g, m, "rust", 4),
        "concrete": lambda g, m: PP.concrete(g, m, "sand", 5, size=8),
        "fur": lambda g, m: PP.fur(g, m, "wood", 4),
        "blotch": lambda g, m: PP.blotch(g, m, "purple", 2, chance=0.2),
        "plated": lambda g, m: PP.plated(g, m, "steel", 4),
        "glow_window": lambda g, m: PP.glow_window(g, m),
        "planks": lambda g, m: P.planks(g, m, "wood", 4),
        "stone": lambda g, m: P.stone(g, m, "stone", 4),
        "thatch": lambda g, m: P.thatch(g, m, "sand", 4),
    }
    for name, fn in painters.items():
        for thick in (1, 6):
            assert not _diagonal(_top_canvas(fn, thick)), (name, thick)
    # the check does see streaks: a wall frame forced onto a top makes them
    assert _diagonal(_top_canvas(lambda g, m: PP.corrugate(g, m, "rust", 4, frame="wall")))
    # hazard stripes are 45° on purpose, on tops too
    assert _diagonal(_top_canvas(lambda g, m: PP.hazard(g, m)))


def test_painters_run_ribs_and_strokes_up_walls():
    import pnpaint as PP

    for fn in (lambda g, m: PP.corrugate(g, m, "rust", 4, length=99), lambda g, m: PP.fur(g, m, "wood", 4)):
        g = Grid(30, 20, 10)
        g.box(1, 0, 1, 29, 20, 9, C("gray", 4))
        fn(g, g.a > 0)
        front = next(f for f in mesh_part(g).faces if f.normal[2] < -0.99)
        c = front.canvas  # rows are y, columns x
        assert (c[1:, :] == c[:-1, :]).mean() > (c[:, 1:] == c[:, :-1]).mean()


def test_facets_follow_slopes():
    import pnshapes as S

    g = Grid(24, 18, 20)
    S.pyramid(g, 2, 2, 22, 18, 0, 16, "red", 4)
    parts = S.facets(g)
    slopes = [(m, fr) for m, fr in parts if fr != "top"]
    assert len(slopes) == 4 and len(parts) <= 5, len(parts)  # four slopes and the base
    for m, (u, v) in slopes:
        assert m.any() and abs(u[1]) < 1e-9 and v[1] < 0  # u level, v down the slope
    X, Y, Z = np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")
    eave = (g.a > 0) & (Y == 0) & ((X < 3) | (X > 20) | (Z < 3) | (Z > 16))
    assert (eave <= np.logical_or.reduce([m for m, _ in slopes])).all()  # the eave row paints with the slopes
    whole = np.logical_or.reduce([m for m, _ in parts])
    assert (whole == (g.a > 0)).all()


def test_gable_roof_trim_shade():
    from pnkit import gable_roof

    g = Grid(60, 50, 50)
    g.box(12, 0, 12, 48, 24, 38, C("sand", 5))
    gable_roof(g, 12, 48, 12, 38, 24, 42, ramp="purple", trim="stone", trim_shade=6, ridge="z")
    assert (g.a == C("stone", 6)).sum() > 100



def test_overlapping_prisms_do_not_share_a_face_plane():
    from atlas import _coplanar_overlap

    # Two roof slabs that overlap and share their end caps (z = 0 and z = 4): the caps would z-fight.
    g = Grid(14, 12, 4)
    g.prism("z", [(0, 0), (8, 0), (4, 6)], 0, 4, C("red", 3))
    g.prism("z", [(4, 0), (12, 0), (8, 6)], 0, 4, C("stone", 3))
    faces = mesh_part(g).faces
    prism = [f for f in faces if f.solid >= 0]
    fights = [(a.solid, b.solid) for i, a in enumerate(prism) for b in prism[i + 1 :] if a.solid != b.solid and _coplanar_overlap(a, b)]
    assert fights == [], fights
    # One prism keeps its exact geometry; the other grows a little, on the 1/64 grid.
    caps = sorted({round(float(f.verts[0][2]), 4) for f in prism if abs(f.normal[2]) > 0.99})
    assert 0.0 in caps and 4.0 in caps and len(caps) == 4, caps
    for f in prism:
        assert np.allclose(f.verts * 64, np.round(f.verts * 64))

if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
