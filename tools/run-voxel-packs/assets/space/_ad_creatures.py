"""Three Space humanoids, each with its own body plan (Art Director repair).

The brute, the scout and the psionic alien replace one shared, squashed
template. Each one is authored at true scale in voxels (person = 36):

- alien-brute: 44 tall. Wide hunched shoulders, short thick legs, long arms
  with big fists, a small head low between the shoulders, tusks.
- alien-scout: 40 tall. Thin body, long bent legs, a big egg head with two
  big eyes, a backpack with an antenna, a ray pistol.
- psionic-alien: 42 tall. A big brain head, a long robe to the ground, thin
  arms and a floating psionic orb.

Skin is flat paint with soft mottle and a few spots (S3). Armour and kit
use metal plates. Each face has painted eyes and a mouth like the
alien-grunt. Faces -Z. Each death clip turns the actor about its rear
heel line, so no part goes below the ground.
"""
from __future__ import annotations

import numpy as np

import paint as P
from _life import (
    Clip, Grid, Rig, asset, band, box, cartoon_eye, coords, edges, front, keys, light_top,
    mask_of, octo, plan, quad, side, spots, wave,
)
from pnshapes import cone, disc

Z0 = (0.0, 0.0, 0.0)


def _skin(g: Grid, m, ramp: str, base: int = 5, seed: int = 0) -> None:
    """Flat skin: one base tone, a lit top and a few darker spots (S3)."""
    P.flat(g, m, ramp, base)
    spots(g, m, ramp, base - 1, cell=7, r=1.2, chance=3, seed=seed + 5)
    light_top(g, m, ramp, base + 1)


def _lift(seconds: float, height: float, steps: int = 16):
    """Root lift keys that peak twice per stride, when each leg swings the
    most. The lift keeps the swinging feet above the ground."""
    import math
    return [(seconds * k / steps, (0.0, height * abs(math.sin(2 * math.pi * k / steps)), 0.0)) for k in range(steps + 1)]


def _armour(g: Grid, m, ramp: str = "steel", base: int = 5, seed: int = 0) -> None:
    P.plates(g, m, ramp, base, size=(6, 5), seed=seed)
    P.flat(g, edges(m), ramp, base - 2)


def _death(root: str, slump: dict, sink: float = 0.0) -> dict:
    """Fall back about the rear heel line (the root pivot), with a bounce.
    `sink` lowers the body at the end so that it lies on the ground."""
    lie = (0.0, -sink, 0.0)
    out = {root: {"rot": keys((0, Z0), (0.25, (12, 0, 0)), (0.55, (55, 0, 4)), (0.85, (86, 0, 6)), (0.95, (82, 0, 6)), (1.2, (86, 0, 6))),
                  "loc": keys((0, Z0), (0.55, Z0), (0.85, lie), (1.2, lie))}}
    out.update(slump)
    return out


def _lean_back(deg: float = 7.0) -> dict:
    """A hit recoil about the rear heel line: the front lifts, nothing sinks."""
    return {"rot": keys((0, Z0), (0.1, (deg, 0, 0)), (0.45, Z0))}


# ---------------------------------------------------------------- brute
def _brute() -> object:
    S = (40, 48, 36)
    CX, CZ = 20, 18
    SKIN, ARM = "purple", "steel"
    HIP = (CX, 14.0, CZ)
    SHOULDER = {"arm-l": (CX + 11.0, 34.0, CZ), "arm-r": (CX - 11.0, 34.0, CZ)}

    def torso() -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        # A barrel body that is wide at the shoulders and narrow at the hips.
        chest = front(g, [(CX - 8, 12), (CX + 8, 12), (CX + 12, 26), (CX + 11, 36), (CX - 11, 36), (CX - 12, 26)], CZ - 7, CZ + 6, SKIN, 5)
        # The hunched upper back pushes the head forward.
        hump = side(g, [(22, CZ + 4), (34, CZ + 9), (39, CZ + 5), (39, CZ - 3), (30, CZ - 1)], CX - 9, CX + 9, SKIN, 5)
        skin = chest | hump
        _skin(g, skin, SKIN, 5, seed=3)
        belly = chest & (Z < CZ - 5) & (Y < 24) & (np.abs(X - CX) < 7)
        P.flat(g, belly, SKIN, 6)
        P.flat(g, belly & (np.floor(Y) % 3 == 0), SKIN, 5)
        # Bone spikes run along the hunched back; dark scars cross the hide.
        spikes = np.zeros(g.shape, dtype=bool)
        for k, (y, z) in enumerate(((36, CZ + 5), (31, CZ + 8), (26, CZ + 8))):
            spikes |= side(g, quad((y - 1, z - 1), (y + 3 - k, z + 4), 1.8, 0.5), CX - 1.5, CX + 1.5, "bone", 6)
        P.flat(g, spikes, "bone", 6)
        P.flat(g, spikes & (Z < CZ + 8), "bone", 4)
        scars = skin & (Z > CZ + 5) & (np.abs((X - CX) * 0.6 + (Y - 30)) < 0.6) & (np.abs(X - CX) > 3) & (np.abs(X - CX) < 8)
        P.flat(g, scars, SKIN, 3)
        spots(g, skin & (Z > CZ + 2), SKIN, 4, cell=5, r=1.3, chance=2, seed=21)
        # A steel war harness: a belt and one diagonal strap with a gold plate.
        belt = box(g, CX - 9, 11, CZ - 8, CX + 9, 15, CZ + 7, "iron", 3)
        P.flat(g, belt, "iron", 3)
        P.flat(g, belt & (np.floor(X) % 4 == 0), "iron", 4)
        P.flat(g, belt & (np.abs(X - CX) < 2.5) & (Z < CZ - 7), "gold", 6)
        strap = skin & (np.abs((X - CX) - 0.8 * (Y - 25)) < 1.7) & ((Z < CZ - 5) | (Z > CZ + 3))
        P.flat(g, strap, "iron", 4)
        P.flat(g, strap & (np.floor(Y) % 4 == 0), "steel", 6)
        # Big hazard pauldrons sit on the shoulders.
        pads = np.zeros(g.shape, dtype=bool)
        for s in (-1, 1):
            pads |= front(g, [(CX + s * 6, 40), (CX + s * 12, 38), (CX + s * 15, 32), (CX + s * 9, 31)], CZ - 6, CZ + 6, "orange", 5)
        P.flat(g, pads, "orange", 5)
        light_top(g, pads, "orange", 7)
        P.flat(g, pads & (np.floor(X + Y) % 5 == 0), "orange", 4)
        P.flat(g, edges(pads), "orange", 3)
        return g

    def head() -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        # A small skull low between the shoulders, with a heavy brow and jaw.
        skull = plan(g, octo(CX, CZ - 6, 6.5, 5.5, 1.5), 34, 41, SKIN, 5, top=octo(CX, CZ - 5, 5.0, 4.0, 1.2))
        jaw = plan(g, octo(CX, CZ - 7, 7.5, 5.0, 1.5), 31, 35, SKIN, 5)
        brow = box(g, CX - 7, 38, CZ - 12, CX + 7, 41, CZ - 8, SKIN, 4)
        m = skull | jaw | brow
        _skin(g, m, SKIN, 5, seed=4)
        P.flat(g, brow, SKIN, 4)
        light_top(g, brow, SKIN, 5)
        zf = CZ - 11
        # Two small, angry eyes under the brow.
        cartoon_eye(g, "-z", zf, CX - 6, 35, 4, outline=(SKIN, 2), white=("gold", 7), pupil=("red", 2))
        cartoon_eye(g, "-z", zf, CX + 2, 35, 4, outline=(SKIN, 2), white=("gold", 7), pupil=("red", 2), mirror=True)
        # An underbite mouth with a row of teeth.
        mouth = jaw & (Z < CZ - 11) & (np.abs(X - CX) < 5) & (Y > 31.5) & (Y < 34)
        P.flat(g, mouth, "red", 2)
        P.flat(g, mouth & (Y > 33) & (np.floor(X) % 2 == 0), "bone", 7)
        tusks = np.zeros(g.shape, dtype=bool)
        for s in (-1, 1):
            tusks |= cone(g, "y", CX + s * 5, CZ - 10, 1.6, 33, 38, "bone", 7, n=6, r_top=0.3)
        P.flat(g, tusks, "bone", 7)
        P.flat(g, tusks & (Y < 34.5), "bone", 5)
        # Two short horns on the brow.
        horns = np.zeros(g.shape, dtype=bool)
        for s in (-1, 1):
            horns |= front(g, quad((CX + s * 5, 40), (CX + s * 8, 43), 1.8, 0.8), CZ - 9, CZ - 5, "bone", 6)
        P.flat(g, horns, "bone", 6)
        P.flat(g, horns & (Y < 41.5), "bone", 4)
        return g

    def arm(s: int) -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        sx = CX + s * 11
        upper = front(g, quad((sx, 35), (sx + s * 1, 23), 3.4, 3.2), CZ - 3.5, CZ + 3.5, SKIN, 5)
        fore = front(g, quad((sx + s * 1, 24), (sx + s * 1, 13), 3.6, 4.0), CZ - 4, CZ + 4, SKIN, 5)
        _skin(g, upper | fore, SKIN, 5, seed=6 + s)
        guard = box(g, sx + s * 1 - 4.5, 14, CZ - 4.5, sx + s * 1 + 4.5, 21, CZ + 4.5, ARM, 5)
        _armour(g, guard, ARM, 5, seed=8 + s)
        band(g, guard, 1, 19, 21, "orange", 5)
        # A big fist: the right one is a steel gravity gauntlet.
        fx = sx + s * 1
        fist = box(g, fx - 4.5, 4, CZ - 5, fx + 4.5, 14, CZ + 4, SKIN if s > 0 else ARM, 5)
        if s > 0:
            _skin(g, fist, SKIN, 5, seed=9)
            P.flat(g, fist & (Z < CZ - 4) & (np.floor(Y) % 3 == 0), SKIN, 3)
        else:
            _armour(g, fist, ARM, 5, seed=10)
            P.flat(g, fist & (Y < 6), "orange", 6)
            P.flat(g, fist & (Z < CZ - 4) & (np.abs(Y - 9) < 1.5) & (np.abs(X - fx) < 2.5), "cyan", 7)
        light_top(g, fist, SKIN if s > 0 else ARM, 6)
        return g

    def leg(s: int) -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        lx = CX + s * 5
        thigh = front(g, quad((lx, 14), (lx + s, 6), 3.6, 3.4), CZ - 4, CZ + 4, SKIN, 5)
        _skin(g, thigh, SKIN, 5, seed=12 + s)
        boot = box(g, lx + s - 4.5, 0, CZ - 7, lx + s + 4.5, 7, CZ + 4, ARM, 5)
        toe = side(g, [(0, CZ - 7), (4, CZ - 7), (2, CZ - 9), (0, CZ - 9)], lx + s - 4.5, lx + s + 4.5, ARM, 5)
        _armour(g, boot | toe, ARM, 5, seed=14 + s)
        band(g, boot, 1, 5, 7, "orange", 5)
        light_top(g, boot | toe, ARM, 6)
        return g

    rig = Rig()
    heel = (CX, 0.0, CZ + 12.5)
    rig.group("actor", heel)
    rig.add("body", torso(), HIP, "actor")
    rig.add("head", head(), (CX, 35.0, CZ - 2), "body")
    rig.add("arm-l", arm(1), SHOULDER["arm-l"], "body")
    rig.add("arm-r", arm(-1), SHOULDER["arm-r"], "body")
    rig.add("leg-l", leg(1), (CX + 5, 14.0, CZ), "actor")
    rig.add("leg-r", leg(-1), (CX - 5, 14.0, CZ), "actor")
    idle = {"body": {"rot": wave(2.6, "x", 3), "loc": wave(2.6, "y", 0.4)},
            "head": {"rot": keys((0, Z0), (0.8, (0, 12, 0)), (1.3, Z0), (2.0, (0, -12, 0)), (2.6, Z0))},
            "arm-l": {"rot": wave(2.6, "x", 4, phase=1.0)}, "arm-r": {"rot": wave(2.6, "x", 4, phase=2.0)}}
    move = {"leg-l": {"rot": wave(1.0, "x", 16)}, "leg-r": {"rot": wave(1.0, "x", -16)},
            "arm-l": {"rot": wave(1.0, "x", -16)}, "arm-r": {"rot": wave(1.0, "x", 16)},
            "body": {"rot": wave(1.0, "z", 4)}, "actor": {"loc": _lift(1.0, 2.6)}}
    # Ground pound: both fists go up over the head and slam down.
    up = (150, 0, 0)
    attack = {"arm-l": {"rot": keys((0, Z0), (0.2, (80, 0, -8)), (0.38, up), (0.5, (60, 0, 0)), (0.58, (24, 0, 0)), (1.0, Z0))},
              "arm-r": {"rot": keys((0, Z0), (0.2, (80, 0, 8)), (0.38, up), (0.5, (60, 0, 0)), (0.58, (24, 0, 0)), (1.0, Z0))},
              "body": {"rot": keys((0, Z0), (0.38, (-8, 0, 0)), (0.52, (14, 0, 0)), (1.0, Z0))}}
    hit = {"actor": _lean_back(7), "body": {"rot": keys((0, Z0), (0.1, (0, 0, 8)), (0.45, Z0))},
           "head": {"rot": keys((0, Z0), (0.1, (-12, 10, 0)), (0.45, Z0))}}
    death = _death("actor", {"head": {"rot": keys((0, Z0), (1.0, (-20, 15, 0)))},
                             "arm-l": {"rot": keys((0, Z0), (1.0, (0, 0, 40)))},
                             "arm-r": {"rot": keys((0, Z0), (1.0, (0, 0, -40)))}}, sink=SINK["alien-brute"])
    sock = rig.sock("socket-impact", (CX - 12, 4, CZ - 1), parent="arm-r")
    clips = [Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)]
    return asset("creatures", "alien-brute", "Alien Brute", rig.root, clips=clips, sockets=[sock],
                 pfx=[{"effectId": "rvx-space-gravity-slam", "socket": "socket-impact", "trigger": "clip:attack", "size": 18, "aim": [0, -1, 0], "at": 0.5}])


# ---------------------------------------------------------------- scout
def _scout() -> object:
    S = (36, 48, 36)
    CX, CZ = 18, 18
    SKIN, SUIT = "teal", "bone"
    HIP = (CX, 20.0, CZ)

    def torso() -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        # A thin flight suit with a narrow waist.
        suit = front(g, [(CX - 4, 18), (CX + 4, 18), (CX + 6, 26), (CX + 6, 30), (CX - 6, 30), (CX - 6, 26)], CZ - 4, CZ + 4, SUIT, 6)
        P.mottle(g, suit, SUIT, 6, cell=3, seed=1)
        light_top(g, suit, SUIT, 7)
        P.flat(g, suit & (np.abs(X - CX) < 1.2) & (Z < CZ - 3), "orange", 5)
        P.flat(g, suit & (np.abs(Y - 21) < 1), "steel", 3)
        P.flat(g, suit & (np.abs(Y - 21) < 1) & (np.abs(X - CX) < 1.5), "gold", 6)
        P.flat(g, suit & (Z < CZ - 3) & (np.abs(X - (CX + 3)) < 1.3) & (np.abs(Y - 27) < 1.3), "cyan", 7)
        # Shoulder rings in hazard orange.
        for s in (-1, 1):
            ring = box(g, CX + s * 6 - 2, 26, CZ - 3, CX + s * 6 + 2, 30, CZ + 3, "orange", 5)
            P.flat(g, ring, "orange", 5)
            light_top(g, ring, "orange", 6)
        neck = box(g, CX - 1.5, 30, CZ - 1.5, CX + 1.5, 32, CZ + 1.5, SKIN, 4)
        P.flat(g, neck, SKIN, 4)
        # A steel backpack with a tall antenna and a glowing tip.
        pack = box(g, CX - 5, 19, CZ + 4, CX + 5, 30, CZ + 9, "steel", 5)
        _armour(g, pack, "steel", 5, seed=2)
        P.flat(g, pack & (Z > CZ + 8) & (np.abs(Y - 25) < 2) & (np.abs(X - CX) < 3), "cyan", 6)
        mast = box(g, CX + 2, 30, CZ + 6, CX + 4, 40, CZ + 8, "iron", 4)
        P.flat(g, mast & (np.floor(Y) % 4 == 0), "orange", 5)
        tip = box(g, CX + 1, 40, CZ + 5, CX + 5, 43, CZ + 9, "cyan", 6)
        light_top(g, tip, "cyan", 7)
        return g

    def head() -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        # A big egg head: wide at the eyes and narrow at the chin.
        chin = plan(g, octo(CX, CZ - 2, 3.5, 3.5, 1.0), 31, 33, SKIN, 5, top=octo(CX, CZ - 2, 6.0, 5.0, 1.5))
        mid = plan(g, octo(CX, CZ - 2, 6.0, 5.0, 1.5), 33, 38, SKIN, 5, top=octo(CX, CZ - 1, 6.5, 5.5, 1.8))
        top = plan(g, octo(CX, CZ - 1, 6.5, 5.5, 1.8), 38, 42, SKIN, 5, top=octo(CX, CZ, 3.5, 3.0, 1.0))
        m = chin | mid | top
        _skin(g, m, SKIN, 5, seed=5)
        zf = CZ - 7
        # Two big round eyes with cyan glints and a small grin.
        cartoon_eye(g, "-z", zf, CX - 6, 34, 5, outline=(SKIN, 2), pupil=("navy", 1), glint=("cyan", 7))
        cartoon_eye(g, "-z", zf, CX + 1, 34, 5, outline=(SKIN, 2), pupil=("navy", 1), glint=("cyan", 7), mirror=True)
        mouth = m & (Z < CZ - 5) & (np.abs(X - CX) < 2.2) & (np.abs(Y - 32.5) < 0.6)
        P.flat(g, mouth, "navy", 2)
        # Two swept ear fins.
        fins = np.zeros(g.shape, dtype=bool)
        for s in (-1, 1):
            fins |= front(g, [(CX + s * 6, 36), (CX + s * 10, 40), (CX + s * 9, 35), (CX + s * 6, 34)], CZ - 1, CZ + 2, SKIN, 4)
        P.flat(g, fins, SKIN, 4)
        P.flat(g, fins & (np.abs(X - CX) > 8), "orange", 5)
        return g

    def arm(s: int) -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        sx = CX + s * 7
        upper = front(g, quad((sx, 28), (sx + s, 21), 1.6, 1.5), CZ - 1.5, CZ + 1.5, SKIN, 5)
        _skin(g, upper, SKIN, 5, seed=7 + s)
        cuff = box(g, sx + s - 2, 19, CZ - 2, sx + s + 2, 21.5, CZ + 2, "orange", 5)
        P.flat(g, cuff, "orange", 5)
        if s < 0:
            # The right forearm points forward and holds the ray pistol.
            fore = side(g, quad((20, CZ), (19, CZ - 6), 1.5, 1.4), sx + s - 1.5, sx + s + 1.5, SKIN, 5)
            _skin(g, fore, SKIN, 5, seed=9)
            gun = box(g, sx + s - 2, 18, CZ - 11, sx + s + 2, 22, CZ - 4, "steel", 5)
            grip = box(g, sx + s - 1.5, 15, CZ - 7, sx + s + 1.5, 18, CZ - 4.5, "iron", 3)
            P.flat(g, grip, "iron", 3)
            _armour(g, gun, "steel", 5, seed=10)
            coil = disc(g, "z", sx + s, 20, 2.6, CZ - 10, CZ - 8, "rust", 5, n=8)
            P.flat(g, coil, "rust", 6)
            muzzle = disc(g, "z", sx + s, 20, 1.6, CZ - 13, CZ - 11, "cyan", 6, n=8)
            P.flat(g, muzzle, "cyan", 7)
        else:
            fore = front(g, quad((sx + s, 20), (sx + s * 2, 14), 1.5, 1.6), CZ - 1.5, CZ + 1.5, SKIN, 5)
            _skin(g, fore, SKIN, 5, seed=11)
            hand = box(g, sx + s * 2 - 2, 10, CZ - 2, sx + s * 2 + 2, 14, CZ + 2, SKIN, 5)
            _skin(g, hand, SKIN, 5, seed=12)
        return g

    def leg(s: int) -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        x0, x1 = CX + s * 3 - 2, CX + s * 3 + 2
        # Long bent legs: the knee goes forward, the hock goes back.
        thigh = side(g, quad((20, CZ), (12, CZ - 3), 2.1, 1.8), x0, x1, SUIT, 6)
        shin = side(g, quad((12, CZ - 3), (4, CZ + 2), 1.7, 1.5), x0, x1, SKIN, 5)
        P.mottle(g, thigh, SUIT, 6, cell=3, seed=13 + s)
        P.flat(g, thigh & (np.abs(Y - 16) < 0.8), "orange", 5)
        _skin(g, shin, SKIN, 5, seed=14 + s)
        guard = side(g, quad((11, CZ - 3.6), (6, CZ - 0.6), 1.0, 1.0), x0 - 0.5, x1 + 0.5, "steel", 5)
        P.flat(g, guard, "steel", 5)
        foot = side(g, [(0, CZ + 4), (4, CZ + 4), (4, CZ - 1), (2, CZ - 6), (0, CZ - 6)], x0 - 0.5, x1 + 0.5, "steel", 5)
        P.plates(g, foot, "steel", 5, size=(4, 3), seed=15 + s)
        P.flat(g, foot & (Y < 1.5), "iron", 3)
        light_top(g, foot, "steel", 6)
        return g

    rig = Rig()
    heel = (CX, 0.0, CZ + 9.0)
    rig.group("actor", heel)
    rig.add("body", torso(), HIP, "actor")
    rig.add("head", head(), (CX, 31.0, CZ - 1), "body")
    rig.add("arm-l", arm(1), (CX + 7.0, 28.0, CZ), "body")
    rig.add("arm-r", arm(-1), (CX - 7.0, 28.0, CZ), "body")
    rig.add("leg-l", leg(1), (CX + 3, 20.0, CZ), "actor")
    rig.add("leg-r", leg(-1), (CX - 3, 20.0, CZ), "actor")
    idle = {"body": {"loc": wave(2.0, "y", 0.4)},
            "head": {"rot": keys((0, Z0), (0.5, (0, 20, 0)), (0.9, (0, 20, 0)), (1.2, (6, -16, 0)), (1.7, (6, -16, 0)), (2.0, Z0))},
            "arm-l": {"rot": wave(2.0, "x", 4, phase=1.0)}}
    move = {"leg-l": {"rot": wave(0.7, "x", 22)}, "leg-r": {"rot": wave(0.7, "x", -22)},
            "arm-l": {"rot": wave(0.7, "x", -22)}, "arm-r": {"rot": wave(0.7, "x", 6)},
            "body": {"rot": keys((0, (8, 0, 0)), (0.7, (8, 0, 0)))}, "actor": {"loc": _lift(0.7, 2.4)}}
    attack = {"arm-r": {"rot": keys((0, Z0), (0.25, (-10, 0, 0)), (0.5, (-10, 0, 0)), (0.58, (-24, 0, 0)), (1.0, Z0)),
                        "loc": keys((0, Z0), (0.5, Z0), (0.56, (0, 0, 1.5)), (1.0, Z0))},
              "body": {"rot": keys((0, Z0), (0.25, (0, -12, 0)), (0.6, (0, -12, 0)), (1.0, Z0))},
              "head": {"rot": keys((0, Z0), (0.25, (0, 10, 0)), (1.0, Z0))}}
    hit = {"actor": _lean_back(8), "body": {"rot": keys((0, Z0), (0.1, (0, 0, -8)), (0.45, Z0))},
           "head": {"rot": keys((0, Z0), (0.1, (-14, -10, 0)), (0.45, Z0))}}
    death = _death("actor", {"head": {"rot": keys((0, Z0), (1.0, (-15, 25, 0)))},
                             "arm-l": {"rot": keys((0, Z0), (1.0, (0, 0, 50)))},
                             "arm-r": {"rot": keys((0, Z0), (1.0, (0, 0, -40)))}}, sink=SINK["alien-scout"])
    sock = rig.sock("socket-ray", (CX - 8, 20, CZ - 13), parent="arm-r")
    clips = [Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)]
    return asset("creatures", "alien-scout", "Alien Scout", rig.root, clips=clips, sockets=[sock],
                 pfx=[{"effectId": "rvx-space-ray-zap", "socket": "socket-ray", "trigger": "clip:attack", "size": 10, "aim": [0, 0, -1], "at": 0.52}])


# ---------------------------------------------------------------- psionic
def _psionic() -> object:
    S = (40, 48, 36)
    CX, CZ = 18, 18
    SKIN, ROBE = "pink", "purple"
    WAIST = (CX, 2.0, CZ)

    def torso() -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        # A long robe that flares out to the ground (true slopes, F2).
        robe = plan(g, octo(CX, CZ, 9.0, 7.5, 3.0), 0, 21, ROBE, 4, top=octo(CX, CZ, 5.5, 4.0, 1.5))
        P.flat(g, robe, ROBE, 4)
        # Cloth folds: darker lines that fan out toward the hem.
        ang = np.arctan2(Z - CZ, X - CX)
        P.flat(g, robe & (np.abs(np.sin(ang * 7)) < 0.18) & (Y < 18), ROBE, 3)
        light_top(g, robe, ROBE, 5)
        P.flat(g, robe & (Y < 2.5), "magenta", 5)
        P.flat(g, robe & (np.abs(Y - 2.5) < 0.6), "gold", 6)
        # A gold front panel with eye glyphs.
        panel = robe & (Z < CZ - 3) & (np.abs(X - CX) < 2.6 + (16 - Y) * 0.12) & (Y > 3) & (Y < 18)
        P.flat(g, panel, "magenta", 5)
        P.flat(g, panel & (np.abs(X - CX) < 1.0) & (np.floor(Y) % 4 == 0), "gold", 6)
        P.flat(g, robe & (np.abs(Y - 13) < 0.8), "gold", 5)
        collar = plan(g, octo(CX, CZ, 6.5, 5.0, 1.8), 19, 22, "magenta", 5, top=octo(CX, CZ, 5.0, 3.8, 1.4))
        P.flat(g, collar, "magenta", 5)
        light_top(g, collar, "magenta", 6)
        P.flat(g, collar & (Z < CZ - 4) & (np.abs(X - CX) < 1.5), "cyan", 7)
        # Two small feet peek out under the hem.
        toes = np.zeros(g.shape, dtype=bool)
        for s in (-1, 1):
            toes |= box(g, CX + s * 3 - 1.5, 0, CZ - 10, CX + s * 3 + 1.5, 2, CZ - 6, SKIN, 4)
        P.flat(g, toes, SKIN, 4)
        return g

    def head() -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        # A big brain head: a small chin and a wide, tall skull.
        chin = plan(g, octo(CX, CZ - 1, 3.0, 3.0, 1.0), 21, 24, SKIN, 5, top=octo(CX, CZ - 1, 5.5, 4.5, 1.5))
        face = plan(g, octo(CX, CZ - 1, 5.5, 4.5, 1.5), 24, 29, SKIN, 5, top=octo(CX, CZ, 8.5, 7.0, 2.2))
        brain = plan(g, octo(CX, CZ, 8.5, 7.0, 2.2), 29, 37, SKIN, 5, top=octo(CX, CZ + 0.5, 9.0, 7.5, 2.4))
        crown = plan(g, octo(CX, CZ + 0.5, 9.0, 7.5, 2.4), 37, 42, SKIN, 5, top=octo(CX, CZ + 1, 5.0, 4.0, 1.4))
        m = chin | face | brain | crown
        _skin(g, m, SKIN, 5, seed=4)
        # Brain folds are paint: wavy magenta lines on the skull.
        folds = (brain | crown) & (Y > 33) & ((np.abs(np.sin((X - CX) * 0.7 + Z * 0.3) * 1.6 + (Y - 37.5)) < 0.6) | ((np.abs(X - CX) < 0.6) & (Z > CZ - 4)))
        P.flat(g, folds, "magenta", 5)
        zf = CZ - 7
        # Two big almond eyes, a third gold eye, and a small mouth.
        # Two big dark eyes with cyan glints (pixel eyes like the alien-grunt).
        cartoon_eye(g, "-z", zf, CX - 7, 29, 6, outline=("magenta", 3), white=("navy", 2), pupil=("navy", 1), glint=("cyan", 7))
        cartoon_eye(g, "-z", zf, CX + 1, 29, 6, outline=("magenta", 3), white=("navy", 2), pupil=("navy", 1), glint=("cyan", 7), mirror=True)
        gem_eye = brain & (Z < zf + 1.5) & (np.abs(X - CX) + np.abs(Y - 35.2) < 1.6)
        P.flat(g, gem_eye, "gold", 7)
        mouth = face & (Z < CZ - 4.5) & (np.abs(X - CX) < 1.5) & (np.abs(Y - 25.5) < 0.6)
        P.flat(g, mouth, "magenta", 3)
        return g

    def arm(s: int) -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        sx = CX + s * 5
        # A wide sleeve and a thin hand with long fingers.
        sleeve = front(g, quad((sx, 20), (sx + s * 4, 12), 2.2, 3.2), CZ - 3, CZ + 3, ROBE, 4)
        P.flat(g, sleeve, ROBE, 4)
        P.flat(g, edges(sleeve), ROBE, 3)
        P.flat(g, sleeve & (np.abs(Y - 12.8) < 1.0), "gold", 5)
        hand = front(g, quad((sx + s * 4.5, 11.5), (sx + s * 6, 7), 1.4, 1.0), CZ - 1.5, CZ + 1.5, SKIN, 5)
        _skin(g, hand, SKIN, 5, seed=8 + s)
        return g

    def orb() -> Grid:
        g = Grid(*S)
        X, Y, Z = coords(g)
        ox, oy, oz = CX + 14, 24, CZ - 2
        ball = plan(g, octo(ox, oz, 2.0, 2.0, 0.8), oy - 4, oy - 2, "cyan", 6, top=octo(ox, oz, 3.6, 3.6, 1.2))
        ball |= plan(g, octo(ox, oz, 3.6, 3.6, 1.2), oy - 2, oy + 2, "cyan", 6)
        ball |= plan(g, octo(ox, oz, 3.6, 3.6, 1.2), oy + 2, oy + 4, "cyan", 6, top=octo(ox, oz, 2.0, 2.0, 0.8))
        P.flat(g, ball, "cyan", 6)
        light_top(g, ball, "cyan", 7)
        P.flat(g, ball & (Z < oz - 2.5) & (X < ox), "bone", 7)
        # A thin gold ring orbits the orb.
        ring = plan(g, octo(ox, oz, 5.0, 5.0, 1.6), oy - 0.5, oy + 1, "gold", 6)
        P.flat(g, ring & ~ball, "gold", 6)
        return g

    rig = Rig()
    heel = (CX, 0.0, CZ + 8.0)
    rig.group("actor", heel)
    rig.add("body", torso(), WAIST, "actor")
    rig.add("head", head(), (CX, 22.0, CZ), "body")
    rig.add("arm-l", arm(1), (CX + 5.0, 20.0, CZ), "body")
    rig.add("arm-r", arm(-1), (CX - 5.0, 20.0, CZ), "body")
    rig.add("orb", orb(), (CX + 14, 24.0, CZ - 2), "body")
    idle = {"orb": {"loc": wave(2.4, "y", 1.6), "rot": wave(2.4, "y", 20)},
            "head": {"rot": wave(2.4, "z", 4, phase=0.8)},
            "arm-l": {"rot": wave(2.4, "z", 6, phase=1.6)}}
    # The psionic glides: the robe bobs off the ground and the head leads.
    move = {"body": {"loc": wave(1.2, "y", 0.8, base=(0, 1.0, 0))}, "head": {"rot": wave(2.4, "z", 5)},
            "orb": {"loc": wave(1.2, "y", 1.2)}, "arm-l": {"rot": wave(2.4, "x", 8)}, "arm-r": {"rot": wave(2.4, "x", -8)}}
    attack = {"arm-l": {"rot": keys((0, Z0), (0.3, (0, 0, 70)), (0.6, (0, 0, 70)), (1.0, Z0))},
              "arm-r": {"rot": keys((0, Z0), (0.3, (0, 0, -70)), (0.6, (0, 0, -70)), (1.0, Z0))},
              "head": {"rot": keys((0, Z0), (0.3, (-10, 0, 0)), (0.6, (-10, 0, 0)), (1.0, Z0))},
              "orb": {"loc": keys((0, Z0), (0.3, (-6, 6, -2)), (0.5, (-8, 7, -6)), (0.7, (-6, 6, -2)), (1.0, Z0))}}
    hit = {"actor": _lean_back(8),
           "head": {"rot": keys((0, Z0), (0.1, (-14, -8, 0)), (0.45, Z0))},
           "orb": {"loc": keys((0, Z0), (0.1, (2, -2, 2)), (0.45, Z0))}}
    death = _death("actor", {"head": {"rot": keys((0, Z0), (1.0, (-10, 20, 0)))},
                             "orb": {"loc": keys((0, Z0), (0.6, (0, 2, 0)), (1.2, (0, -2, 6)))}}, sink=SINK["psionic-alien"])
    sock = rig.sock("socket-psionic", (CX + 14, 24, CZ - 6), parent="orb")
    clips = [Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)]
    return asset("creatures", "psionic-alien", "Psionic Alien", rig.root, clips=clips, sockets=[sock],
                 pfx=[{"effectId": "rvx-space-teleport-beam", "socket": "socket-psionic", "trigger": "clip:attack", "size": 15, "aim": [0, 0, -1], "at": 0.5}])


# Measured end-of-death lowest points (rt.py poses) that the death clip removes.
SINK = {"alien-brute": 2.0, "alien-scout": 0.8, "psionic-alien": -0.2}

BUILDERS = {"alien-brute": _brute, "alien-scout": _scout, "psionic-alien": _psionic}


def make_humanoid(slug: str) -> object:
    return BUILDERS[slug]()
