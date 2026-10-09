"""Scavenged battery bank, in the Pirate Nation style.

One chunky icon (rule K3): four salvaged cell blocks bolted into a steel
angle-iron rack on a weathered pallet. Every casing carries painted cell
caps, a charge label and zombie-teal terminals, so the rack reads as full
from every side. An oversized dial with a red needle is the function prop
(rule F4), its bracket set a little crooked (rule F5); heavy red cables
loop from terminal to terminal and a hazard plate warns off the curious.
Plates, rivets, labels, the dial face and rust are paint (rule S1).
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint
from _props import asset, chips, pallet, root, rust_runs, seam_rust
from pnkit import box, edges, on_face
from pnshapes import bar, coords, disc
from voxgrid import Grid

GW, GH, GD = 34, 30, 26
X0, X1, Z0, Z1 = 2, 30, 3, 18  # the rack
Y0, Y1 = 4, 26


def cell(g: Grid, x: int, y: int, w: int, h: int, seed: int) -> np.ndarray:
    """One salvaged cell block: a light casing with painted cell caps, a
    charge label and two teal terminals on the top."""
    X, Y, Z = coords(g)
    m = box(g, x, y, Z0 + 2, x + w, y + h, Z1 - 2, "steel", 5)
    P.plates(g, m, "steel", 5, size=(6, 5), seed=seed)
    P.flat(g, edges(m), "steel", 2)
    cap = m & (Y > y + h - 2)
    P.flat(g, cap, "steel", 4)
    for k in range(3):  # the cell caps on the top
        cx = x + 2 + k * (w - 5) // 2
        P.flat(g, cap & (np.abs(X - cx - 1) < 1.6) & (np.abs(Z - (Z0 + Z1) / 2) < 2.2), "steel", 6)
    label = m & (Z < Z0 + 3) & (Y > y + 2) & (Y < y + h - 4) & (X > x + 1) & (X < x + w - 1)
    P.flat(g, label, "bone", 6)
    P.outline(g, label, "darkwood", 2, normal="z")
    P.flat(g, label & (np.floor(Y) % 3 == 0), "bone", 7)
    P.flat(g, label & (X < x + 1 + (w - 2) * 0.6), "teal", 3)  # the charge bar
    chips(g, m, ((x, y, Z0 + 2, 2.6), (x + w, y + h, Z1 - 2, 2.2)), "rust", 5, seed=seed + 3)
    for tx in (x + 2, x + w - 4):  # the teal terminals
        t = box(g, tx, y + h, (Z0 + Z1) // 2 - 2, tx + 2, y + h + 2, (Z0 + Z1) // 2, "teal", 3)
        P.flat(g, edges(t), "teal", 1)
    return m


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    pallet(g, X0 - 1, 0, Z0 - 1, w=X1 - X0 + 2, d=Z1 - Z0 + 2, ramp="wood", base=5, seed=2)
    # the angle-iron rack: four corner posts, a shelf rail and a top rail
    frame_m = np.zeros(g.shape, dtype=bool)
    for px in (X0, X1 - 3):
        for pz in (Z0, Z1 - 3):
            frame_m |= box(g, px, Y0, pz, px + 3, Y1, pz + 3, "steel", 4)
    for ry in (Y0 + 10, Y1 - 2):
        frame_m |= box(g, X0, ry, Z0, X1, ry + 2, Z0 + 3, "steel", 4)
        frame_m |= box(g, X0, ry, Z1 - 3, X1, ry + 2, Z1, "steel", 4)
    frame_m |= box(g, X0, Y0, Z0, X1, Y0 + 2, Z1, "steel", 4)
    P.flat(g, frame_m, "steel", 4)
    P.flat(g, frame_m & (Z < Z0 + 1), "steel", 5)  # the lit front of every member
    P.flat(g, edges(frame_m), "steel", 2)
    seam_rust(g, frame_m, (Y0 + 1, Y0 + 11), shade=4)
    rust_runs(g, frame_m, ((X0, Y0 + 6, Z0, 3.0), (X1, Y1 - 4, Z1, 2.6)), base=5, drip=5, seed=5)
    # four cell blocks, two per shelf
    for k, (cx, cy) in enumerate(((X0 + 3, Y0 + 2), (X0 + 15, Y0 + 2), (X0 + 3, Y0 + 12), (X0 + 15, Y0 + 12))):
        cell(g, cx, cy, 11, 8, seed=10 + k)
    # heavy cables looping between the terminals, and down to the ground
    mz = (Z0 + Z1) // 2 - 1
    for p0, p1 in (((Y0 + 11, mz), (Y0 + 15, mz)), ((Y0 + 21, mz), (Y1 + 1, mz)), ((Y0 + 11, mz), (Y0 + 13, Z1 + 2))):
        bar(g, "x", p0, p1, 1.3, X0 + 5, X0 + 7, "red", 4)
        bar(g, "x", p0, p1, 1.3, X0 + 17, X0 + 19, "red", 4)
    tail = bar(g, "x", (Y0 + 13, Z1 + 2), (float(Y0 + 1), Z1 + 4), 1.3, X0 + 5, X0 + 7, "red", 4)
    P.flat(g, tail, "red", 4)
    P.flat(g, tail & (np.floor(Y) % 4 == 0), "red", 3)
    # the oversized dial on a crooked bracket, on the +x end of the rack
    br = box(g, X1 - 2, Y0 + 14, Z0 + 4, X1 + 1, Y0 + 18, Z1 - 4, "steel", 4)
    P.flat(g, edges(br), "steel", 2)
    gy, gz = Y0 + 16, (Z0 + Z1) / 2
    face = disc(g, "x", gy, gz, 7.0, X1 + 1, X1 + 3, "bone", 7)
    rr = np.hypot(Y - gy, Z - gz)
    P.flat(g, face & (rr > 5.6), "steel", 2)  # the dark bezel
    P.flat(g, face & (rr > 4.8) & (rr < 5.6), "steel", 5)  # its lit lip
    P.flat(g, face & (rr < 4.8), "bone", 7)  # one clean face
    P.flat(g, face & (rr > 3.6) & (rr < 4.6) & (Z < gz - 1) & (Y > gy + 1), "teal", 3)  # the safe arc
    needle = face & (np.abs((Y - gy) - (Z - gz)) < 1.1) & (rr < 4.2) & (Z > gz) & (Y > gy)
    P.flat(g, needle, "red", 4)  # one bold needle, reading high
    P.flat(g, face & (rr < 1.8), "darkwood", 2)  # its boss
    # the hazard plate bolted across the top rail
    plate = box(g, *on_face("-z", Z0, X0 + 5, X0 + 21, Y1 - 1, Y1 + 8, 0, 2), "gold", 4)
    P.flat(g, plate, "gold", 4)
    pnpaint.hazard(g, plate & (Y < Y1 + 2), period=8, a=("gold", 4), b=("darkwood", 2), frame="z")
    iw, ih = pnglyph.icon_size("bolt")
    pnglyph.icon(g, "-z", Z0 - 2, X0 + 5 + (16 - iw) // 2, Y1 + 2 + (7 - ih) // 2, "bolt", "darkwood", 1, depth=2)
    P.outline(g, plate, "darkwood", 2, normal="z")
    for sx in (X0 + 7, X0 + 17):  # its two stand-off bolts
        box(g, sx, Y1, Z0, sx + 2, Y1 + 3, Z0 + 2, "steel", 5)
    return asset("battery-bank", "Battery Bank", root("battery-bank", g))
