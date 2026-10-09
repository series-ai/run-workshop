"""Blast crater, in the Pirate Nation style.

A raised lip of thrown dirt around a scorched floor: twelve faceted rim
segments with true slopes inside and out, framed steel scrap on the crown,
a leaning toxic shard, and a teal fallout puddle in the middle. Soot,
strata and the glow are paint. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _life import ctr, limb, make, plan, rock
from voxgrid import Grid, Part

N = 58
C0 = N / 2


def build():
    g = Grid(N, 14, N)
    X, Y, Z = ctr(g)
    floor = plan(g, S.flat_ngon(C0, C0, 18.5, 12), 0, 1, "sand", 3)
    # the rim: twelve segments, each a frustum with a sloped outside and inside
    rim = np.zeros(g.shape, dtype=bool)
    ro0, ri0, ro1, ri1 = 27.5, 14.0, 22.5, 19.0
    for k in range(12):
        a0, a1 = 2 * math.pi * k / 12+0.008, 2 * math.pi * (k + 1) / 12-0.008
        h = 7 + (k % 4)
        pt = lambda r, a: (C0 + r * math.cos(a), C0 + r * math.sin(a))  # noqa: E731
        base = [pt(ro0, a0), pt(ro0, a1), pt(ri0, a1), pt(ri0, a0)]
        top = [pt(ro1, a0), pt(ro1, a1), pt(ri1, a1), pt(ri1, a0)]
        rim |= plan(g, base, 0, h, "sand", 5, top=top)
    d = np.hypot(X - C0, Z - C0)
    # Calm strata follow the bowl instead of adding noise to every face.
    P.flat(g, rim, "sand", 5)
    P.flat(g, rim & (Y < 2), "sand", 3)
    P.flat(g, rim & (Y >= 2) & (Y < 4) & (np.floor((d + Y * 0.35) / 5) % 2 == 0), "sand", 4)
    P.flat(g, rim & (d < 20.5), "sand", 3)  # scorched inner slope
    P.flat(g, rim & (d > 24.5) & (Y < 2), "sand", 4)
    # A few broad cracks and dark seams break the largest faces.
    wall_angle = np.arctan2(Z - C0, X - C0)
    seam = rim & (np.abs(np.sin(wall_angle * 6 + Y * 0.16)) > 0.985)
    P.flat(g, seam & (Y > 2), "sand", 2)
    # Broken horizontal strata add broad, readable bands across the slopes.
    for level in (2.5, 5.0, 7.5):
        layer_y = level + 0.35 * np.sin(wall_angle * 3 + level)
        layer = rim & (np.abs(Y - layer_y) < 0.65) & (np.sin(wall_angle * 4 + level) > -0.2)
        P.flat(g, layer, "sand", 3)
        P.flat(g, layer & (np.abs(Y - (layer_y - 1.0)) < 0.55), "sand", 6)
    for k in range(9):
        a = k*2*math.pi/9 + .13
        radius = 24 + (k%2)
        xx,zz=C0+radius*math.cos(a),C0+radius*math.sin(a)
        m=rock(g,xx,zz,1,3.3,3.0,4+(k%3),"sand",4,shrink=.8,n=5,seed=70+k)
        rock(g,xx-.7,zz+.6,4+(k%3),2.5,2.2,2,"sand",5,shrink=.65,n=5,seed=90+k)
    # the scorched floor with radial soot and a glowing fallout puddle
    ang = np.arctan2(Z - C0, X - C0)
    P.flat(g, floor & ((np.floor((ang + math.pi) / (math.pi / 10)) % 2) == 0), "sand", 2)
    puddle = plan(g, [(C0 - 8, C0 - 3), (C0 - 4, C0 - 7), (C0 + 5, C0 - 6), (C0 + 8, C0 - 1), (C0 + 5, C0 + 5), (C0 - 3, C0 + 7), (C0 - 8, C0 + 3)], 1, 1.8, "teal", 5)
    P.flat(g, puddle, "teal", 3)
    P.flat(g, puddle & (np.hypot(X - C0, Z - C0) < 5), "teal", 4)
    P.flat(g, puddle & (np.hypot(X - C0, Z - C0) < 2), "teal", 5)
    P.outline(g, puddle, "steel", 3, normal="y")
    P.flat(g, puddle & (np.abs(X - Z) < 1.0), "gold", 6)  # toxic sheen
    # Thick torn scrap plates sit on the crown, above the inner and outer slopes.
    for k, (a, radius, length, width) in enumerate(((0.35, 21.0, 8.5, 3.5), (2.65, 20.9, 8, 3.5), (4.8, 21.0, 8, 3.5))):
        cx, cz = C0 + radius * math.cos(a), C0 + radius * math.sin(a)
        turn = math.degrees(a) + 90
        half_l, half_w = length / 2, width / 2
        torn = [(-half_l, -half_w), (-half_l + 1.2, -half_w), (half_l - 1.3, -half_w),
                (half_l, -half_w + 0.8), (half_l - 0.7, half_w), (-half_l + 0.8, half_w),
                (-half_l, half_w - 0.7)]
        pts = S.rotate([(cx + x, cz + z) for x, z in torn], cx, cz, turn)
        s = plan(g, pts, 8.0, 10.5, "steel", 5)
        P.plates(g, s, "steel", 5, size=(5, 3), frame="top", seed=k + 12)
        top = s & (Y >= 10)
        P.flat(g, top, "steel", 6)
        # One broken seam and restrained hazard paint mark each plate.
        P.flat(g, top & (np.abs(X - cx) < 0.7), "steel", 2)
        P.flat(g, top & (np.abs(Z - cz) < 0.7) & (np.abs(X - cx) > 2), "gold", 5)
        P.outline(g, s, "steel", 3, normal="y")
        for dx, dz in ((-half_l + 1.5, -half_w + 0.8), (half_l - 1.5, -half_w + 0.8),
                       (-half_l + 1.5, half_w - 0.8), (half_l - 1.5, half_w - 0.8)):
            rr = math.radians(turn)
            rx, rz = cx + dx * math.cos(rr) - dz * math.sin(rr), cz + dx * math.sin(rr) + dz * math.cos(rr)
            rivet = top & (np.abs(X - rx) < 0.7) & (np.abs(Z - rz) < 0.7)
            P.flat(g, rivet, "steel", 7)
    for k,(xx,zz,rr) in enumerate(((9,23,5),(44,19,6),(39,46,4),(17,47,4))):
        ejecta=rock(g,xx,zz,1,rr,rr*0.8,rr+3,"sand",5,shrink=0.6,n=5,seed=44+k)
        P.flat(g,ejecta & (np.floor(Y/3)%2==0),"sand",4)
    # A leaning toxic shard rises from the pool, with a steel point and a
    # rusted warning collar. Its silhouette remains the same from every view.
    body = limb(g, (C0 + 2, 1.2, C0 + 2), (C0 + 3, 10.5, C0 + 3), 3.8, 2.8, "teal", 6, n=6)
    X, Y, Z = ctr(g)
    along = np.clip((Y - 1.2) / 9.3, 0, 1)
    shard_facet = body & (np.abs((X - (C0 + 2 + along)) - (Z - (C0 + 2 + along)) * 0.38) < 1.0)
    P.flat(g, body, "teal", 4)
    P.flat(g, shard_facet, "teal", 5)
    fracture = body & (Y > 2.5) & (Y < 9.0) & (np.abs(X - Z - 0.6 * np.sin(Y * 1.25)) < 0.65)
    P.flat(g, fracture, "teal", 2)
    branch = body & (Y > 5.0) & (Y < 8.0) & (np.abs(X - Z - 3.2 - 0.35 * Y) < 0.55)
    P.flat(g, branch, "teal", 2)
    P.flat(g, body & (Y > 4) & (Y < 5.5), "red", 5)
    P.flat(g, body & (Y > 5.5) & (Y < 6.5), "rust", 4)
    nose = limb(g, (C0 + 3, 10.5, C0 + 3), (C0 + 4, 13, C0 + 4), 2.8, 0.0, "steel", 6, n=6)
    P.flat(g, nose & (X < C0 + 11), "steel", 4)
    # Two broken steel fins anchor the shard into the scorched ground.
    limb(g, (C0 + 2, 4.0, C0 + 2), (C0 - 1, 3.0, C0 + 1), 1.8, 0.8, "steel", 4, n=4)
    limb(g, (C0 + 2, 4.0, C0 + 2), (C0 + 3, 3.2, C0 - 2), 1.6, 0.7, "rust", 4, n=4)
    return make("terrain-nature", "crater", "Blast Crater", Part("crater", g))
