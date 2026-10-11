"""Mutant dog, in the Pirate Nation creature style.

A small chunky caricature hound: a huge boxy head with a jutting snout,
three glowing toxic eyes, pointed ears and a mouth full of teeth, a deep
chest behind a spiked steel collar, a sloping back ridged with bone spikes
(true slopes), stubby legs with big paws and a crooked tail. Mangy rust
fur with teal mange patches and bare ribs is paint. Clips: idle (pant and
wag), move (gallop), attack (lunging bite), hit, death (falls on its
side). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, front, fx, limb, make, seq, side, skin, wave
from pnkit import box
from voxgrid import C, Clip, Grid

SZ = (18, 24, 28)
CX = 9.0
FUR = ("rust", 5)
MUZZLE = ("sand", 5)
NECK = (CX, 12.0, 11.0)
TAIL = (CX, 12.5, 21.5)
LEGS = {"leg-fl": (CX - 2.8, 7.0, 11.5), "leg-fr": (CX + 2.8, 7.0, 11.5), "leg-bl": (CX - 2.8, 7.0, 19.0), "leg-br": (CX + 2.8, 7.0, 19.0)}


def fur(g, m, ramp=FUR[0], base=FUR[1], seed=0):
    PP.fur(g, m, ramp, base, stroke=3, seed=seed)


def body() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    m = side(g, [(5.5, 9.5), (5.5, 22), (12.5, 22.5), (14, 16.5), (14.5, 10), (11, 8)], CX - 4.5, CX + 4.5, *FUR)
    fur(g, m, seed=1)
    P.flat(g, m & (Y > 13.5), FUR[0], FUR[1] - 1)  # a darker back
    # teal mange and bare ribs on the flank
    skin(g, m & (np.hypot(Z - 17.5, Y - 10) < 2.2), "teal", 5, seed=2)
    for zr in (12.5, 14.5, 16.5):
        P.flat(g, m & (np.abs(Z - zr) < 0.5) & (Y > 7.5) & (Y < 11.5) & (np.abs(np.abs(X - CX) - 4.2) < 0.5), "bone", 6)
    # bone spikes along the spine (triangle prisms)
    for k, z0 in enumerate((11.5, 14.5, 17.5, 20.5)):
        top = 14.3 - (z0 - 11.5) * 0.25
        side(g, [(top - 0.5, z0 - 1.2), (top - 0.5, z0 + 1.2), (top + 2.8 - k * 0.3, z0 + 1.5)], CX - 0.9, CX + 0.9, "bone", 6)
    P.flat(g, m & (Z < 11.5) & (Y < 10.5), *MUZZLE)  # a pale chest
    # a spiked collar, spikes pointing out to the sides and up
    collar = box(g, CX - 5, 8, 10, CX + 5, 13, 12.5, "steel", 5)
    P.outline(g, collar, "steel", 3)
    for s in (-1, 1):
        limb(g, (CX + s * 4.5, 10.5, 11.25), (CX + s * 7.5, 10.5, 11.25), 1.1, 0.0, "steel", 7, n=4)
    limb(g, (CX, 12.5, 11.25), (CX, 15.0, 11.25), 1.1, 0.0, "steel", 7, n=4)
    return g


def head() -> Grid:
    """A broad dog head: wider than tall, a short square muzzle with a big
    black nose, an open jaw with fangs, one pricked ear and one torn ear
    that flops out to the side, and three glowing eyes."""
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    nx, ny, nz = NECK
    skull = box(g, 3, 10, 5, 15, 19, 11, *FUR)
    cheeks = box(g, 2, 10, 6, 16, 14, 9.5, FUR[0], FUR[1] - 1)  # jowls wider than the skull
    muzzle = side(g, [(11, 5), (14, 5), (13.5, 3), (12.5, 1.5), (11, 1.5)], 5, 13, *MUZZLE)
    jaw = side(g, [(8, 5.5), (10, 5.5), (10, 3), (8.5, 3.5)], 5.5, 12.5, *MUZZLE)
    fur(g, skull, seed=3)
    fur(g, cheeks, FUR[0], FUR[1] - 1, seed=6)
    fur(g, muzzle, *MUZZLE, seed=7)
    P.flat(g, jaw, *MUZZLE)
    P.flat(g, skull & (Y < 14) & (Z < 6), "red", 2)  # the dark throat behind the open jaw
    box(g, 6, 10, 3, 12, 11, 5, "red", 4)  # the tongue and gums
    nose = box(g, 7, 12, 1, 11, 14, 2.5, "iron", 2)
    P.flat(g, nose & (Y > 13) & (X < CX), "iron", 4)  # a wet highlight
    for x0 in (6, 11):  # upper fangs
        box(g, x0, 9, 1.5, x0 + 1, 11, 2.5, "bone", 7)
    for x0 in (6.5, 10.5):  # lower fangs
        side(g, [(9.5, 3.2), (9.5, 4.2), (11.5, 3.7)], x0, x0 + 1, "bone", 6)
    # ears: the left pricked and leaning out, the right torn and flopped out to the side
    ear_l = front(g, [(CX - 2.5, 18.5), (CX - 6.5, 18.5), (CX - 8, 22.5)], 8, 10.5, FUR[0], FUR[1] - 1)
    ear_r = front(g, [(CX + 5, 18.5), (CX + 5, 16), (CX + 8.8, 14)], 8, 10.5, FUR[0], FUR[1] - 1)
    P.flat(g, ear_l & (Z < 9) & (X > CX - 6.5) & (X < CX - 3.5) & (Y < 21), "pink", 2)
    P.flat(g, ear_r & (X > CX + 7.5), "red", 3)  # the torn tip
    legend = {"e": C("toxic", 5), "o": C("iron", 1), "p": C("iron", 0)}
    rows = ["....oeeo....", "....oepo....", ".oeeo..oeeo.", ".oepo..opeo."]
    G.stamp(g, "-z", 5, 3, 15, rows, legend, depth=2)
    return g


def leg(name: str) -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    hx, hy, hz = LEGS[name]
    fore = name.startswith("leg-f")
    m = limb(g, (hx, hy, hz), (hx, 2.0, hz - 0.3), 1.6 if fore else 1.5, 1.2, *FUR, n=4)
    paw = side(g, [(0, hz - 3.6), (0, hz + 1.8), (2.6, hz + 1.6), (3.0, hz - 0.5), (2.2, hz - 3.4)], hx - 2.2, hx + 2.2, *MUZZLE)
    fur(g, m, seed=4)
    P.flat(g, paw, *MUZZLE)
    P.flat(g, paw & (Y < 1.5), MUZZLE[0], MUZZLE[1] - 1)
    for dx in (-1.5, 0.0, 1.5):  # three bone claws on the toes
        P.flat(g, paw & (Z < hz - 2.6) & (np.abs(X - hx - dx) < 0.5), "bone", 7)
    return g


def tail() -> Grid:
    """A short thick tail that curls up and back (not a tall stick)."""
    g = Grid(*SZ)
    tx, ty, tz = TAIL
    m = limb(g, (tx, ty, tz), (tx, ty + 1.8, tz + 2.8), 1.3, 1.1, *FUR, n=4)
    tip = limb(g, (tx, ty + 1.5, tz + 2.4), (tx, ty + 4.2, tz + 3.0), 1.1, 0.5, *FUR, n=4)
    fur(g, m, seed=5)
    P.flat(g, tip, *MUZZLE)
    return g


def build():
    rig = Rig("mutant-dog", (CX, 0, 15.5))
    rig.add("body", body(), (CX, 8.0, 15.5))
    rig.add("head", head(), NECK, parent="body")
    rig.add("tail", tail(), TAIL, parent="body")
    for name in LEGS:
        rig.add(name, leg(name), LEGS[name])
    idle = {"head": {"rot": wave(0.6, (4, 0, 0))}, "tail": {"rot": wave(0.5, (0, 0, 25))},
            "body": {"scale": wave(0.6, (0.03, 0.04, 0), base=(1, 1, 1))}}
    gal = 0.5
    move = {"leg-fl": {"rot": wave(gal, (35, 0, 0))}, "leg-fr": {"rot": wave(gal, (35, 0, 0), phase=0.5)},
            "leg-bl": {"rot": wave(gal, (-35, 0, 0), phase=0.2)}, "leg-br": {"rot": wave(gal, (-35, 0, 0), phase=0.7)},
            "body": {"rot": wave(gal, (6, 0, 0)), "loc": wave(gal, (0, 0.8, 0), phase=1.6, double=True)},
            "head": {"rot": wave(gal, (-6, 0, 0), phase=0.4)}, "tail": {"rot": wave(gal, (20, 0, 0))}}
    attack = {"body": {"loc": seq((0, 0, 0, 0), (0.15, 0, 0, 2), (0.35, 0, 1, -5), (0.7, 0, 0, 0)), "rot": seq((0, 0, 0, 0), (0.15, 8, 0, 0), (0.35, -10, 0, 0), (0.7, 0, 0, 0))},
              "head": {"rot": seq((0, 0, 0, 0), (0.2, 20, 0, 0), (0.35, -15, 0, 0), (0.45, 10, 0, 0), (0.7, 0, 0, 0))}}
    hit = {"body": {"rot": seq((0, 0, 0, 0), (0.1, 12, 0, -8), (0.45, 0, 0, 0)), "loc": seq((0, 0, 0, 0), (0.1, 0, 0, 2), (0.45, 0, 0, 0))},
           "head": {"rot": seq((0, 0, 0, 0), (0.1, 20, 15, 0), (0.45, 0, 0, 0))}}
    death = {rig.root.name: {"rot": seq((0, 0, 0, 0), (0.3, 0, 0, -20), (0.7, 0, 0, 88), (0.85, 0, 0, 82), (1.1, 0, 0, 86)), "loc": seq((0, 0, 0, 0), (0.7, 0, 3, 0), (1.1, 0, 3, 0))},
             "head": {"rot": seq((0, 0, 0, 0), (0.7, 20, 0, 0))},
             "leg-fl": {"rot": seq((0, 0, 0, 0), (0.7, 40, 0, 0))}, "leg-bl": {"rot": seq((0, 0, 0, 0), (0.7, -40, 0, 0))}}
    return make("creatures", "mutant-dog", "Mutant Dog", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                sockets=[rig.socket("socket-mouth", (CX, 10.5, 2.0), parent="head"), rig.socket("socket-feet", (CX, 0.5, 15.5))],
                pfx=[fx("rvx-apocalypse-dust-kick", "socket-feet", "clip:move", size=28, aim=(0.0, 0.0, 1.0))])
