"""Contract lint for the Trainspotter kit. Plain Python + numpy, no Blender.

    python lint/lint.py [--tier slice|release] [--family a,b] [--mesh]

Track: every route runs from its `from` connector to its `to` connector with
matching headings and no kinks, connectors sit on the lattice, and standard
layouts (circles of 90 and 45 degree curves, an oval, a passing loop, a
diagonal run, a ramp up and down) close exactly.
With --mesh, also meshes every piece with the pipeline's atlas mesher and
checks triangle and atlas budgets (slow).
Exit code 1 on any failure.
"""
from __future__ import annotations

import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "kit"))

import railkit as RK  # noqa: E402
import track as T  # noqa: E402
from layout import chain, mates, on_lattice, rotate, same  # noqa: E402

FAILS: list[str] = []
TOL = 1e-6


def fail(msg: str) -> None:
    FAILS.append(msg)
    print("FAIL", msg)


def check_piece(spec: T.PieceSpec) -> None:
    for k, c in spec.connectors.items():
        # diagonal pieces are laid at 45 degrees: their connectors land on the lattice there
        q = c if not spec.extras.get("diagonal") else T.Connector((*rotate_xz(c.p, 315),), c.yaw)
        if not on_lattice(q, RK.LATTICE):
            fail(f"{spec.name}: connector {k} at {c.p} heading {c.yaw} is off the {RK.LATTICE} lattice / 45-degree headings")
    for r in spec.routes:
        start, end = spec.connectors[r.frm], spec.connectors.get(r.to) if r.to else None
        p0, t0 = r.point(0), r.tangent(0)
        if math.dist(p0, start.p) > TOL or abs(((T.heading_of(t0[0], t0[2]) + 180 - start.yaw + 180) % 360) - 180) > 1e-6:
            fail(f"{spec.name}/{r.id}: does not leave connector {r.frm} along its heading")
        if end is not None:
            p1, t1 = r.point(r.length), r.tangent(r.length)
            if math.dist(p1, end.p) > TOL:
                fail(f"{spec.name}/{r.id}: ends at {tuple(round(v, 6) for v in p1)}, connector {r.to} is at {end.p}")
            if abs(((T.heading_of(t1[0], t1[2]) - end.yaw + 180) % 360) - 180) > 1e-6:
                fail(f"{spec.name}/{r.id}: ends heading {T.heading_of(t1[0], t1[2]):.6f}, connector {r.to} faces {end.yaw}")
        for a, b in zip(r.segs, r.segs[1:]):  # tangent-continuous joins
            pa, ta, pb, tb = a.point(a.length), a.tangent(a.length), b.point(0), b.tangent(0)
            if math.dist(pa, pb) > TOL or math.dist(ta, tb) > 1e-6:
                fail(f"{spec.name}/{r.id}: kink or gap between segments")
        if r.state and r.state not in ("open", "close"):
            fail(f"{spec.name}/{r.id}: route state {r.state!r} is not open/close")
    for k in spec.connectors:  # every connector is the end of some route
        if not any(k in (r.frm, r.to) for r in spec.routes):
            fail(f"{spec.name}: connector {k} is not on any route")


def rotate_xz(p, theta: float):
    x, z = rotate(p[0], p[2], theta)
    return (x, p[1], z)


def check_layouts(by: dict[str, T.PieceSpec]) -> None:
    start = T.Connector((0, 0, 0), 0)  # chain() starts here; a closed loop ends here too
    curve, s128 = by["track-curve-90-r192"], by["track-straight-128"]
    for label, steps in (
        ("circle of four curves", [(curve, "a", "b")] * 4),
        ("circle of four reversed (left-hand) curves", [(curve, "b", "a")] * 4),
        ("oval", [(curve, "a", "b"), (curve, "a", "b"), (s128, "a", "b"), (s128, "a", "b")] * 2),
    ):
        _, end = chain(steps)
        if not same(end, start):
            fail(f"{label} does not close: ends at {end}")
    # passing loop: right-hand points, the main line, then left-hand points
    # run backwards; the loop line from the first diverging leg must meet the
    # second points' diverging leg
    sw_r, sw_l = by["track-switch-right"], by["track-switch-left"]
    main, _ = chain([(sw_r, "a", "b"), (s128, "a", "b"), (sw_l, "b", "a")])
    _, side = chain([(sw_r, "a", "c"), (s128, "a", "b")])
    if not mates(side, main[2].connector("c")):
        fail(f"passing loop: the loop line ends at {side}, the second points' leg is at {main[2].connector('c')}")
    if "track-curve-45-right" not in by:
        return  # the slice has no 45-degree system
    c45r, c45l, diag = by["track-curve-45-right"], by["track-curve-45-left"], by["track-straight-diagonal"]
    _, end = chain([(c45r, "a", "b"), (c45l, "b", "a")] * 4)
    if not same(end, start):
        fail(f"circle of eight 45-degree curves does not close: ends at {end}")
    _, end = chain([(c45l, "a", "b"), (c45r, "b", "a")] * 4)
    if not same(end, start):
        fail(f"left-hand circle of eight 45-degree curves does not close: ends at {end}")
    # onto the diagonal (right-hand curve), three diagonals, back onto the grid (the same curve run backwards)
    placed, end = chain([(c45r, "a", "b"), (diag, "a", "b"), (diag, "a", "b"), (diag, "a", "b"), (c45r, "b", "a")])
    if not on_lattice(end, RK.LATTICE) or abs(end.yaw) > 1e-6 and abs(end.yaw - 360) > 1e-6:
        fail(f"a diagonal run does not rejoin the grid: ends at {end}")
    for p in placed[1:4]:
        if not on_lattice(p.connector("b"), RK.LATTICE):
            fail(f"diagonal straight ends off the lattice: {p.connector('b')}")
    # an S of 45s and diagonals: grid -> diagonal -> grid, heading the same way
    _, end = chain([(c45l, "a", "b"), (diag, "a", "b"), (c45l, "b", "a")])
    if not on_lattice(end, RK.LATTICE) or min(end.yaw % 360, 360 - end.yaw % 360) > 1e-6:
        fail(f"45-degree S-bend to the left does not rejoin the grid heading the same way: {end}")
    ramp = by["track-ramp-32"]
    placed, end = chain([(ramp, "a", "b"), (s128, "a", "b"), (ramp, "b", "a")])
    if abs(placed[1].ty - ramp.extras["rise"]) > TOL or abs(end.p[1]) > TOL or not on_lattice(end, RK.LATTICE):
        fail(f"up a ramp, along, and down again does not come back to the ground: ends at {end}")
    cross = by["track-crossing-90"]
    # a crossing in the middle of a figure: both routes laid with straights stay on the lattice
    placed, _ = chain([(s128, "a", "b"), (cross, "a", "b"), (s128, "a", "b")])
    for k in ("c", "d"):
        if not on_lattice(placed[1].connector(k), RK.LATTICE):
            fail(f"crossing connector {k} off the lattice when laid")


def check_mesh(spec: T.PieceSpec) -> None:
    import atlas  # pipeline mesher, pure numpy

    root, _, _ = T.build_piece(spec)
    faces, tris = [], 0
    for part in root.walk():
        if part.grid is not None and part.grid.count():
            m = atlas.mesh_part(part.grid)
            faces += m.faces
            tris += sum(len(f.verts) - 2 for f in m.faces)
    w, h = atlas.pack(faces)
    status = "ok"
    if tris > 1200:
        status = "OVER"
        fail(f"{spec.name}: {tris} triangles (budget 1200)")
    print(f"  {spec.name:28s} {tris:5d} tris  atlas {w}x{h}  {status}")


def _part_bounds(root) -> dict:
    """Rest-pose x/y/z bounds of every part's voxels in the vehicle frame (rest rotations ignored:
    only rods carry one, and they turn about x, which leaves x unchanged)."""
    import numpy as np

    out = {}

    def walk(part, off):
        here = tuple(o + a for o, a in zip(off, part.at))
        if part.grid is not None and part.grid.count():
            idx = np.argwhere(part.grid.a > 0)
            lo = idx.min(axis=0) - np.array(part.pivot) + np.array(here)
            hi = idx.max(axis=0) + 1 - np.array(part.pivot) + np.array(here)
            out[part.name] = (lo, hi)
        for c in part.children:
            walk(c, here)

    walk(root, (0.0, 0.0, 0.0))
    return out


def check_stock(e) -> None:
    """Contract checks on an assembled vehicle (pure Python, before export)."""
    import numpy as np
    from shapes import BX

    root, sockets, clips, d = e.built()
    body = next(p for p in root.children if p.name == "body")
    a = body.grid.a
    xs, ys, zs = np.nonzero(a)
    if xs.min() < BX - RK.GAUGE_HALF or xs.max() + 1 > BX + RK.GAUGE_HALF:
        fail(f"{e.file}: body is {xs.min() - BX}..{xs.max() + 1 - BX} across, wider than the +/-{RK.GAUGE_HALF} loading gauge")
    if ys.max() + 1 > RK.GAUGE_TOP:
        fail(f"{e.file}: body is {ys.max() + 1} tall, over the {RK.GAUGE_TOP} loading gauge")
    if zs.min() < 0 or zs.max() + 1 > d["L"]:
        fail(f"{e.file}: body runs past its coupler faces (z {zs.min()}..{zs.max() + 1}, L {d['L']})")
    if not (a[:, :, 0] > 0).any() or not (a[:, :, d["L"] - 1] > 0).any():
        fail(f"{e.file}: nothing reaches a coupler face (couplers must meet face to face)")
    # every part, not just the body: rods, crossheads, pantographs and doors stay in the gauge too
    for part, (lo, hi) in _part_bounds(root).items():
        if lo[0] < -RK.GAUGE_HALF - 1e-6 or hi[0] > RK.GAUGE_HALF + 1e-6:
            fail(f"{e.file}: part {part} reaches x {lo[0]:.1f}..{hi[0]:.1f}, past the +/-{RK.GAUGE_HALF} loading gauge")
    for name, r in d["wheels"].items():
        if r not in RK.WHEEL_RADII:
            fail(f"{e.file}: {name} radius {r} is not one of {RK.WHEEL_RADII}")
    for part in root.walk():
        if part.name.startswith("wheel-") and abs(part.at[1] - part.meta["radius"]) > 1e-9:
            fail(f"{e.file}: {part.name} is not standing on the rail")
    for g in d.get("rods", []):
        if len({d["wheels"][w] for w in g["drivers"]}) != 1:
            fail(f"{e.file}: coupled drivers{(' ' + g['tag']) if g['tag'] else ''} have different radii")
    socks = {s.name: s.at for s in sockets}
    for end in ("f", "r"):
        if abs(socks[f"socket-coupler-{end}"][1] - RK.COUPLER_Y) > 1e-9:
            fail(f"{e.file}: socket-coupler-{end} is not at coupler height {RK.COUPLER_Y}")
    roles = [d["paint"], d["trim"], d["accent"]]
    if len(set(roles)) != 3:
        fail(f"{e.file}: paint, trim and accent must be three different ramps, got {roles}")
    used = set()
    for part in root.walk():
        if part.grid is not None:
            used |= RK.ramps_used(part.grid)
    stray = (used & set(RK.SWATCHES)) - set(roles)
    if stray:
        fail(f"{e.file}: uses swappable ramps {sorted(stray)} outside its paint/trim/accent roles")
    loose = used - set(RK.SWATCHES) - set(RK.FIXED_RAMPS)
    if loose:
        fail(f"{e.file}: uses ramps {sorted(loose)} that are neither fixed nor swatches")


def main() -> int:
    tier = sys.argv[sys.argv.index("--tier") + 1] if "--tier" in sys.argv else "release"
    import catalog

    fams = catalog.parse_families(sys.argv)
    specs = T.pieces(tier) if not fams or "track" in fams else []
    by = {s.name: s for s in specs}
    for s in specs:
        check_piece(s)
    if specs:
        check_layouts(by)
    items = catalog.entries(tier, fams)
    stock = [e for e in items if e.section == "stock"]
    for e in items:  # every model assembles, and has unique part names
        try:
            root = e.built()[0]
            names = [p.name for p in root.walk()]
            if len(names) != len(set(names)):
                fail(f"{e.file}: duplicate part names")
        except Exception as exc:  # noqa: BLE001
            fail(f"{e.file}: does not build: {exc!r}")
    for e in stock:
        check_stock(e)
    if "--mesh" in sys.argv:
        print("meshing track pieces:")
        for s in specs:
            check_mesh(s)
    print(f"{len(specs)} track pieces, {len(stock)} vehicles, {len(FAILS)} failure(s)")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
