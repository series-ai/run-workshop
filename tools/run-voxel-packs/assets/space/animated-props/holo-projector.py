"""Holo projector, in the Pirate Nation mecha style.

One iconic shape (rule K3): a riveted steel pedestal on a tapered base
with four sloped fins, an orange collar and a wide lens dish that flares
up (true slopes) with a glowing teal lens. Above it floats an oversized
hologram of a starfighter (faceted fuselage, swept wings, tail fin) in
glowing cyan with painted scan lines. On `spin` the hologram turns and
bobs. Faces -Z.
"""
import numpy as np

from _life import P, Clip, Grid, Rig, asset, band, coords, facet_paint, front, keys, light_top, ngon_y, octo, plan, plate_facets, side, spin, wave

S = (34, 38, 34)
CX, CZ = 17, 17
YD = 15  # the top of the lens dish


def projector() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    base = plan(g, octo(CX, CZ, 11, 11, 3.5), 0, 4, "steel", 5, top=octo(CX, CZ, 9, 9, 3))
    plate_facets(g, [g.solids[-1]], "steel", 5, size=(8, 5), seed=1)
    band(g, base, 1, 0, 1, "steel", 3)
    col = ngon_y(g, CX, CZ, 4.5, 4, 11, "steel", 4)
    P.plates(g, col, "steel", 4, size=(5, 4), seed=2)
    fins = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        fins |= front(g, [(CX + s * 4, 4), (CX + s * 9, 4), (CX + s * 4, 10)], CZ - 1, CZ + 1, "orange", 6)
        fins |= side(g, [(4, CZ + s * 4), (4, CZ + s * 9), (10, CZ + s * 4)], CX - 1, CX + 1, "orange", 6)
    P.flat(g, fins, "orange", 6)
    light_top(g, fins, "orange", 7)
    collar = ngon_y(g, CX, CZ, 5.5, 11, 12, "orange", 5)
    del collar
    dish = ngon_y(g, CX, CZ, 5, 12, YD, "steel", 5, r_top=9)
    facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: P.plates(gg, mm, "steel", 5, size=(6, 4), rivets=False, frame=fr))
    top = light_top(g, dish, "steel", 6)
    rr = np.hypot(X - CX, Z - CZ)
    P.flat(g, top & (rr < 6.5), "cyan", 6)
    P.flat(g, top & (rr < 3.5), "cyan", 7)
    P.flat(g, top & (np.abs(rr - 5) < 0.6), "cyan", 4)
    # a status light on the front of the base
    P.flat(g, base & (Z < CZ - 9.5) & (np.abs(X - CX) < 2) & (Y > 1) & (Y < 3), "toxic", 6)
    return g


def hologram() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    y0 = 22
    # fuselage: a faceted wedge that narrows to the nose at the front (-z)
    g.prism("z", [(CX - 0.8, y0), (CX + 0.8, y0), (CX + 1, y0 + 1), (CX, y0 + 1.6), (CX - 1, y0 + 1)], 3, 27, 0,
            top=[(CX - 3, y0 - 2), (CX + 3, y0 - 2), (CX + 3.5, y0 + 1.5), (CX, y0 + 4), (CX - 3.5, y0 + 1.5)])
    body = g.solids[-1].mask(g.shape)
    wings = plan(g, [(CX - 14, 26), (CX + 14, 26), (CX + 3, 12), (CX - 3, 12)], y0, y0 + 1, "cyan", 5)
    fin = side(g, [(y0 + 3, 18), (y0 + 3, 27), (y0 + 9, 27)], CX - 0.5, CX + 0.5, "cyan", 5)
    engines = front(g, [(CX - 6, y0 - 1), (CX - 3, y0 - 1), (CX - 3, y0 + 2), (CX - 6, y0 + 2)], 20, 29, "cyan", 4)
    engines |= front(g, [(CX + 3, y0 - 1), (CX + 6, y0 - 1), (CX + 6, y0 + 2), (CX + 3, y0 + 2)], 20, 29, "cyan", 4)
    m = body | wings | fin | engines
    P.flat(g, m, "cyan", 6)
    P.flat(g, m & (np.floor(Y) % 2 == 0), "cyan", 5)  # scan lines
    P.flat(g, wings, "cyan", 5)
    P.flat(g, wings & (np.floor(Z) % 3 == 0), "cyan", 7)
    P.flat(g, body & (Y > y0 + 2) & (Z < 16), "bone", 7)  # the lit canopy
    P.flat(g, engines & (Z > 28), "cyan", 7)
    P.flat(g, (wings | fin) & ((np.abs(np.abs(X - CX) - 13) < 1) | (Y > y0 + 8)), "cyan", 7)
    return g


def build():
    rig = Rig()
    rig.add("projector", projector(), (CX, 0, CZ))
    rig.add("hologram", hologram(), (CX, 22, CZ), "projector")
    clip = {"hologram": {"rot": spin(4.0, "y", 360), "loc": wave(4.0, "y", 1.5)}}
    return asset("animated-props", "holo-projector", "Holo Projector", rig.root, clips=[Clip("spin", clip)])
