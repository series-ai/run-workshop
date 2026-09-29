"""Glowing mushrooms on a rotten log, in the Pirate Nation haunted style.

A fallen log (a faceted octagonal prism with painted bark, a mossy top
and ringed end grain) on a small mossy patch of ground, with six big
toadstools of different sizes: chunky octagonal stems and wide faceted
caps (a gill skirt under a sloped frustum, true slopes) with painted
spots, in glowing toxic green, magenta and purple. Parts: log (root) and
m0..m5, one per toadstool, each pulsing by scale on idle with its own
phase (the loop closes cleanly). socket-spores sits above the tallest
cap for the ghost-wisp effect. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnpaint
import pnshapes
from _kit import keys, pfx, world
from _life import assemble, coords, moss_top, plan
from voxgrid import C, Clip, Grid, Socket

S = (64, 40, 44)
LOG_Y, LOG_Z, LOG_R = 6.0, 22.0, 5.5
LOG_X0, LOG_X1 = 10.0, 52.0
# (x, z, ground y, stem height, stem radius, cap radius, cap height, ramp, lean)
SHROOMS = [
    (22.0, 31.0, 1.0, 20, 2.4, 9.0, 6.0, "toxic", 4.0),
    (38.0, 23.0, 11.0, 11, 1.8, 6.5, 5.0, "magenta", -6.0),
    (29.0, 21.0, 11.0, 6, 1.3, 4.0, 3.5, "purple", 8.0),
    (13.0, 12.0, 1.0, 12, 1.8, 6.0, 4.5, "magenta", -5.0),
    (47.0, 12.0, 1.0, 8, 1.5, 4.8, 4.0, "toxic", 7.0),
    (50.0, 20.5, 10.0, 5, 1.2, 3.4, 3.0, "toxic", -8.0),
]
CAP_SHADE = {"toxic": 5, "magenta": 5, "purple": 6}


def ngon(cx, cz, r, n=8, turn=math.pi / 8):
    return [(cx + r * math.cos(turn + 2 * math.pi * k / n), cz + r * math.sin(turn + 2 * math.pi * k / n)) for k in range(n)]


def shroom(k) -> Grid:
    x, z, y0, h, sr, cr, ch, ramp, lean = SHROOMS[k]
    g = Grid(*S)
    X, Y, Z = coords(g)
    dx = math.sin(math.radians(lean)) * h  # a leaning stem: a sheared frustum
    stem = plan(g, ngon(x, z, sr * 1.25), y0, y0 + h, "bone", 6, top=ngon(x + dx, z, sr))
    P.planks(g, stem, "bone", 6, width=2, across="x", length=(40, 41), nails=False, grain=False, seed=k)
    P.flat(g, stem & (Y < y0 + 1.5), "bone", 5)
    cx = x + dx
    yc = y0 + h
    base = CAP_SHADE[ramp]
    # the gill skirt (flares out) and the cap (a faceted frustum with a crown)
    gill = plan(g, ngon(cx, z, cr * 0.45), yc - 1.5, yc, ramp, 3, top=ngon(cx, z, cr))
    cap = plan(g, ngon(cx, z, cr), yc, yc + ch * 0.6, ramp, base, top=ngon(cx, z, cr * 0.62))
    crown = plan(g, ngon(cx, z, cr * 0.62), yc + ch * 0.6, yc + ch, ramp, base, top=ngon(cx, z, cr * 0.2))
    # gills: radial lines on the underside, lit by the cap's own glow
    ang = np.arctan2(Z + 0.5 - z, X + 0.5 - cx)
    P.flat(g, gill & (np.abs(np.sin(ang * 6)) < 0.35), ramp, 4)
    top = cap | crown
    P.flat(g, top & (Y >= yc + ch * 0.6), ramp, min(7, base + 1))
    P.flat(g, top & (Y < yc + 1), ramp, base - 1)  # a darker rim
    # big pale spots (2 x 2 patches) on the upper slopes
    spot = top & (Y >= yc + 1) & ((P._hash(X // 2, Y // 2, Z // 2, seed=40 + k) % np.uint64(4)) == 0)
    P.flat(g, spot, "bone", 7)
    return g


def log() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    # a mossy patch of ground under it all
    ring = [(32 + 26 * math.cos(a) * (1 + 0.08 * math.sin(3 * a)), 22 + 17 * math.sin(a) * (1 + 0.1 * math.cos(2 * a))) for a in np.linspace(0, 2 * math.pi, 11)[:-1]]
    ground = plan(g, ring, 0, 1.5, "moss", 5, top=[(32 + (px - 32) * 0.93, 22 + (pz - 22) * 0.93) for px, pz in ring])
    P.mottle(g, ground, "moss", 5, cell=3, seed=1)
    pnpaint.blotch(g, ground, "skindark", 3, cell=3, chance=0.2, seed=2)
    # the log: a faceted octagonal prism along x, bark on the sides
    body = pnshapes.disc(g, "x", LOG_Y, LOG_Z, LOG_R, LOG_X0, LOG_X1, "wood", 5)
    for m, fr in pnshapes.facets(g, [g.solids[-1]]):
        if fr == "top":
            continue
        P.planks(g, m, "wood", 5, width=3, across="y", length=(6, 12), nails=False, frame=fr, seed=3)
    # ringed end grain on both ends
    rr = pnshapes.ngon_radius(g, "x", LOG_Y, LOG_Z)
    ends = body & ((X == int(LOG_X0)) | (X == int(LOG_X1) - 1))
    P.flat(g, ends, "wood", 6)
    P.flat(g, ends & ((np.floor(rr) % 2) == 1), "wood", 5)
    P.flat(g, ends & (rr > LOG_R - 1.2), "wood", 3)
    P.flat(g, ends & (rr < 1.2), "wood", 3)
    # moss on the top and a rotten, darker belly
    moss_top(g, body & (Y >= LOG_Y + LOG_R - 2), depth=1, seed=4)
    P.flat(g, body & (Y < LOG_Y - 3.5) & ~ends, "wood", 4)
    # a broken branch stub (true slope) and a few ferns on the ground
    g.prism("z", [(30, 9), (33, 9), (35, 15), (33, 15.5)], LOG_Z - 1.5, LOG_Z + 1.5, C("wood", 4))
    for fx, fz, s in ((6, 26, 1), (57, 30, -1), (33, 36, 1)):
        for j in range(3):
            a = math.radians(60 + 30 * j)
            tip = (fx + s * math.cos(a) * 6, 1 + math.sin(a) * 6)
            g.prism("z", [(fx - 0.8, 1), (fx + 0.8, 1), (tip[0] + 0.6, tip[1]), (tip[0] - 0.4, tip[1] + 0.4)], fz - 1 + j, fz + j, C("moss", 5 + (j % 2)))
    return g


def build():
    parts = {"log": log()}
    joints = [("log", None, (32.0, 0.0, 22.0))]
    for k, s in enumerate(SHROOMS):
        parts[f"m{k}"] = shroom(k)
        joints.append((f"m{k}", "log", (s[0], s[2], s[1])))
    root = assemble(parts, joints)
    T = 2.4
    clip = {}
    for k in range(len(SHROOMS)):
        pts = []
        for i in range(9):
            f = math.sin(2 * math.pi * i / 8 + k * 1.1)
            pts.append((T * i / 8, (1.0 + 0.07 * f, 1.0 + 0.1 * f, 1.0 + 0.07 * f)))
        clip[f"m{k}"] = {"scale": keys(*pts)}
    tall = SHROOMS[0]
    spores = (tall[0] + math.sin(math.radians(tall[8])) * tall[3] - 32.0, tall[2] + tall[3] + tall[6] + 2 - 0.0, tall[1] - 22.0)
    return world("glow-mushrooms", "terrain-nature", "Glowing Mushrooms", root, clips=[Clip("idle", clip)],
                 sockets=[Socket("socket-spores", at=spores)], pfx=[pfx("rvx-monster-spore-glow", "socket-spores", "idle", size=40)])
