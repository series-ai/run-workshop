"""A ruined infantry zombie holds a battered rifle at the hip.

A teal zombie in a torn khaki uniform: a low, narrow steel chest plate, a
belt with pouches, a rusty shoulder plate and heavy boots. The head sits
clear above the chest, so the face reads from the front: two red eyes and
a bone jaw. A rounded olive helmet sits on the head with a chin strap.
The right hand holds the rifle at the hip, pointed forward; the left arm
reaches out. Clips: idle (head turn), move
(march), attack (rifle recoil), hit (stagger), death (falls on its side).
Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, fx, keys, limb, make, plan, skin
from _rep_creatures import ground, tube
from pnkit import box
from voxgrid import Clip, Grid

SIZE = (38, 48, 30)
CX = 19.0
ORIGIN = (CX, 0.0, 15.0)
SKIN = ("teal", 5)
NECK = (CX, 30.0, 14.0)
SHOULDERS = {"arm-l": (10.0, 28.5, 15.0), "arm-r": (28.0, 28.5, 15.0)}


def torso() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    shirt = box(g, 10, 15, 9, 28, 30, 21, "khaki", 5)
    P.planks(g, shirt, "khaki", 5, width=4, across="x", seed=1)
    P.flat(g, shirt & (Y < 19), "darkwood", 3)
    PP.blotch(g, shirt, "rust", 4, cell=6, chance=0.07, seed=2)
    # A low, narrow steel chest plate: the face stays clear above it.
    vest = box(g, 12, 18, 6.5, 26, 26.5, 9, "steel", 4)
    P.plates(g, vest, "steel", 4, size=(7, 5), seed=3)
    P.outline(g, vest, "darkwood", 3, normal="z")
    P.flat(g, vest & (np.abs(X - 15.5) < 1.6) & (np.abs(Y - 24) < 1.6), "bone", 6)  # dog tags
    belt = box(g, 11, 14, 8.5, 27, 18, 21.5, "darkwood", 4)
    P.flat(g, belt & (np.abs(X - CX) < 1.2) & (Z < 9.5) & (Y > 15) & (Y < 17), "gold", 5)  # the buckle
    for x0 in (12, 23.5):  # ammo pouches on the belt
        pouch = box(g, x0, 14.5, 7, x0 + 3.5, 18.5, 9, "khaki", 3)
        P.outline(g, pouch, "khaki", 2, normal="z")
    # A battered shoulder plate and a torn sleeve show uneven armour.
    plate = box(g, 7.5, 26.5, 8.5, 14.5, 31.5, 17.5, "steel", 5)
    P.plates(g, plate, "steel", 5, size=(4, 4), seed=4)
    P.flat(g, plate & (X < 10), "rust", 5)
    neck = box(g, CX - 2.5, 29, 12, CX + 2.5, 32, 17, *SKIN)
    skin(g, neck, *SKIN, seed=5)
    return g


def head() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    skull = tube(g, "z", (CX, 36, 5.5, 5), (CX, 36.5, 5.8, 5.3), 8, 19, *SKIN)
    skin(g, skull, *SKIN, seed=6)
    # Two glowing red eyes in dark sockets, and a nose hole.
    for x0 in (CX - 2.8, CX + 2.8):
        P.flat(g, skull & (np.abs(X - x0) < 1.6) & (np.abs(Y - 37) < 1.6) & (Z < 9), "teal", 2)
        P.flat(g, skull & (np.abs(X - x0) < 1.0) & (np.abs(Y - 37) < 1.0) & (Z < 9), "red", 6)
    P.flat(g, skull & (np.abs(X - CX) < 0.8) & (np.abs(Y - 34.6) < 0.6) & (Z < 9), "teal", 2)
    # A bone jaw of chunky teeth, with the chin strap under it.
    jaw = box(g, CX - 4, 31, 7, CX + 4, 34, 9, "bone", 5)
    P.flat(g, jaw & (np.floor(X) % 2 == 0) & (Y > 32), "darkwood", 3)
    P.flat(g, jaw & (Y < 32), "darkwood", 3)
    # The chin strap runs up both cheeks to the helmet.
    P.flat(g, skull & (np.abs(X - CX) > 4.6) & (np.abs(Z - 11.5) < 0.5) & (Y > 31.5), "darkwood", 4)
    # A rounded helmet that sits on the head: a brim ring and a dome.
    brim = plan(g, S.flat_ngon(CX, 13.5, 6.9, 8), 38.6, 39.8, "khaki", 3)
    dome = plan(g, S.flat_ngon(CX, 13.5, 6.4, 8), 39.8, 43.9, "khaki", 3, top=S.flat_ngon(CX, 13.8, 3.6, 8))
    P.mottle(g, dome, "khaki", 3, cell=3, seed=7)
    P.flat(g, brim, "khaki", 2)
    P.flat(g, dome & (np.abs(Y - 40.8) < 0.6), "darkwood", 3)  # the cover band
    P.flat(g, dome & (np.hypot(X - (CX + 3.5), Z - 9) < 1.3) & (Y > 41), "rust", 4)  # a dent
    return g


def arm(name: str) -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    sx, sy, sz = SHOULDERS[name]
    if name == "arm-r":  # down to the pistol grip at the right hip
        elbow, hand = (30, 21.5, 15.5), (30.5, 19, 12.5)
    else:  # the free arm reaches forward, like every zombie
        elbow, hand = (8.5, 25, 8.5), (9, 23.5, 2.5)
    upper = limb(g, (sx, sy, sz), elbow, 3.2, 2.6, "khaki", 5, n=4)
    P.planks(g, upper, "khaki", 5, width=4, across="y", seed=8)
    P.flat(g, upper & (np.hypot(Y - elbow[1], Z - elbow[2]) < 2.2), "khaki", 3)  # the torn cuff
    fore = limb(g, elbow, hand, 2.4, 2.0, *SKIN, n=4)
    fist = box(g, hand[0] - 2, hand[1] - 2, hand[2] - 2, hand[0] + 2, hand[1] + 2, hand[2] + 2, *SKIN)
    skin(g, fore | fist, *SKIN, seed=9)
    if name == "arm-l":  # three hooked claws
        for k in (-1, 0, 1):
            claw = limb(g, (hand[0] + k * 1.3, hand[1] - 0.5, hand[2] - 1.5), (hand[0] + k * 1.3, hand[1] - 2.5, 0.4), 0.7, 0.4, *SKIN, n=4)
            P.flat(g, claw & (Z < 1.2), "gold", 6)
    return g


def leg(side: int) -> Grid:
    g = Grid(*SIZE)
    x = 13 if side < 0 else 25
    m = limb(g, (x, 17, 16), (x + (1 if side > 0 else -1), 3, 16), 3.2, 2.3, "khaki", 5, n=4)
    P.planks(g, m, "khaki", 5, width=4, across="y", seed=10 + side)
    boot = box(g, x - 3, 0, 10, x + 4, 5, 20, "darkwood", 5)
    P.flat(g, boot & (ctr(g)[1] > 3), "steel", 4)
    P.flat(g, boot & (ctr(g)[1] < 1), "darkwood", 3)
    return g


def rifle() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    rx = 30.5
    stock = box(g, rx - 1.5, 18, 13, rx + 1.5, 22, 19, "wood", 4)
    P.planks(g, stock, "wood", 4, width=2, across="y", seed=11)
    body = box(g, rx - 1.5, 19.5, 6, rx + 1.5, 23.5, 13, "steel", 5)
    P.plates(g, body, "steel", 5, size=(5, 3), seed=12)
    box(g, rx - 1, 16, 12, rx + 1, 19.5, 14, "darkwood", 4)  # the pistol grip
    mag = box(g, rx - 1, 15.5, 8, rx + 1, 19.5, 10.5, "steel", 3)
    P.flat(g, mag & (Y < 16.5), "steel", 2)
    guard = box(g, rx - 1.5, 20, 2, rx + 1.5, 23, 6, "wood", 3)
    P.flat(g, guard & (np.floor(Z) % 2 == 0), "wood", 4)
    limb(g, (rx, 22, 2.5), (rx, 22, 0.5), 1.0, 1.0, "iron", 3, n=4)  # the muzzle
    P.flat(g, body & (np.abs(Z - 9) < 0.6), "red", 5)  # a red safety band
    return g


def _build():
    rig = Rig("zombie-soldier", ORIGIN, torso())
    rig.add("head", head(), NECK)
    rig.add("arm-l", arm("arm-l"), SHOULDERS["arm-l"])
    rig.add("arm-r", arm("arm-r"), SHOULDERS["arm-r"])
    rig.add("rifle", rifle(), (30.5, 19, 12.5), parent="arm-r")
    rig.add("leg-l", leg(-1), (13, 15, 16))
    rig.add("leg-r", leg(1), (25, 15, 16))
    idle = {
        "head": {"rot": keys((0, (0, 0, 0)), (0.7, (0, 6, 0)), (1.4, (0, 0, 0)))},
        "arm-l": {"rot": keys((0, (0, 0, 0)), (0.7, (2, 0, 0)), (1.4, (0, 0, 0)))},
    }
    move = {
        "leg-l": {"rot": keys((0, (18, 0, 0)), (0.45, (-18, 0, 0)), (0.9, (18, 0, 0)))},
        "leg-r": {"rot": keys((0, (-18, 0, 0)), (0.45, (18, 0, 0)), (0.9, (-18, 0, 0)))},
        "head": {"rot": keys((0, (0, 0, -4)), (0.45, (0, 0, 4)), (0.9, (0, 0, -4)))},
    }
    attack = {
        "arm-r": {"rot": keys((0, (0, 0, 0)), (0.2, (8, 0, 0)), (0.4, (-4, 0, 0)), (0.7, (0, 0, 0)))},
        "arm-l": {"rot": keys((0, (0, 0, 0)), (0.2, (8, 0, 0)), (0.4, (-4, 0, 0)), (0.7, (0, 0, 0)))},
        "rifle": {"loc": keys((0, (0, 0, 0)), (0.2, (0, 0, 0)), (0.25, (0, 0, 2)), (0.4, (0, 0, 0)), (0.7, (0, 0, 0)))},
        "head": {"rot": keys((0, (0, 0, 0)), (0.25, (8, 0, 0)), (0.5, (0, 0, 0)))},
    }
    hit = {
        "zombie-soldier": {"rot": keys((0, (0, 0, 0)), (0.1, (0, 0, 12)), (0.55, (0, 0, 0)))},
        "head": {"rot": keys((0, (0, 0, 0)), (0.1, (12, 0, 9)), (0.55, (0, 0, 0)))},
    }
    death = {"zombie-soldier": {"rot": keys((0, (0, 0, 0)), (0.5, (0, 0, 28)), (1.1, (0, 0, 82)))},
             "head": {"rot": keys((0, (0, 0, 0)), (1.1, (0, 0, -15)))}}
    return make("creatures", "zombie-soldier", "Zombie Soldier", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                sockets=[rig.socket("socket-rifle", (30.5, 22, 0.5), parent="rifle")],
                pfx=[fx("rvx-apocalypse-shotgun-blast", "socket-rifle", "clip:attack", at=0.22, size=9)])


def build():
    return ground(_build(), names=("move", "hit", "death"))
