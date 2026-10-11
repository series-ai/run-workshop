"""Salvaged extension cable reel, in the Pirate Nation style.

One chunky icon (rule K3): a copper cable drum between two big steel
flanges, carried on a welded A-frame of thick sloped legs (rules F2, F3)
that stands on two ground runners, so every part is clearly joined. The
oversized function prop is the hazard-yellow crank: a big offset arm and a dark
barrel grip with a bright end cap, on the near flange. A signal-red socket block with two zombie-teal outlets is
bolted to the front runner, and the free end of the cable runs out across
the ground to a red plug. Flange hubs, bolt rings, the wound cable bands,
the hazard stripes and three rust blooms with run-off are all paint
(rule S1): the steel keeps long clean stretches (rules S3, S4).
"""
import numpy as np

import paint as P
import pnpaint
from _props import asset, chips, root, rust_runs
from pnkit import box, edges
from pnshapes import bar, coords, disc
from voxgrid import Grid

GW, GH, GD = 38, 28, 26
AY, AZ = 14.0, 13.0  # the axle centre (y, z)
FR = 8.5  # the flange radius
FX0, FX1 = 7, 25  # the flanges (outer faces)
RZ0, RZ1 = 3, 21  # the ground runners


def _frame(g: Grid) -> None:
    """Two ground runners and four thick sloped legs welded to the axle."""
    X, Y, Z = coords(g)
    for z0 in (RZ0, RZ1):
        r = box(g, 4, 0, z0, 28, 3, z0 + 3, "steel", 4)
        P.flat(g, r & (Y > 2), "steel", 5)
        P.flat(g, edges(r), "steel", 3)
    pnpaint.hazard(g, P.region(g, 4, 0, RZ0, 28, 3, RZ0 + 1), period=4, a=("gold", 6), b=("darkwood", 3), frame="z")
    for x0 in (4, 25):
        for z0 in (RZ0 + 1, RZ1 + 1):
            leg = bar(g, "x", (2.0, z0 + 0.5), (AY, AZ), 3.6, x0, x0 + 3, "steel", 3)
            P.flat(g, leg, "steel", 5)
            P.flat(g, leg & (Y < 5), "steel", 4)  # the foot sits in shadow
        plate = box(g, x0, AY - 3, AZ - 3, x0 + 3, AY + 3, AZ + 3, "steel", 3)
        P.flat(g, edges(plate), "steel", 2)


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    _frame(g)
    # the axle through the frame, its ends proud as hubs
    axle = disc(g, "x", AY, AZ, 2.2, 2, 34, "steel", 5)
    P.flat(g, axle & ((X < 4) | (X > 30)), "steel", 6)
    # the two flanges and the copper cable drum between them
    for fx in (FX0, FX1):
        fl = disc(g, "x", AY, AZ, FR, fx, fx + 3, "steel", 6)
        d = np.hypot(Y - AY, Z - AZ)
        P.flat(g, fl & (d > FR - 1.4), "steel", 4)  # the rolled outer edge
        P.flat(g, fl & (d < 4.4), "steel", 7)  # the hub boss
        P.flat(g, fl & (np.abs(d - 4.4) < 0.7), "steel", 4)  # the hub ring
        for k in range(6):  # the bolt ring: six dots on a clean plate (rule S3)
            a = k * np.pi / 3 + 0.3
            P.flat(g, fl & (np.abs(Y - AY - 6.2 * np.cos(a)) < 0.8) & (np.abs(Z - AZ - 6.2 * np.sin(a)) < 0.8), "steel", 3)
        rust_runs(g, fl, ((fx, AY - FR + 2, AZ + 4, 2.6),), base=5, drip=0, seed=fx)
    drum = disc(g, "x", AY, AZ, 5.6, FX0 + 3, FX1, "rust", 5)
    P.flat(g, drum & (np.floor(X) % 3 == 0), "rust", 6)  # the wound cable bands
    P.flat(g, drum & (np.floor(X) % 3 == 1), "rust", 4)
    P.flat(g, drum & (np.hypot(Y - AY, Z - AZ) < 3.0), "steel", 4)  # the bare core at the ends
    # the hazard-yellow crank: an arm on the near flange with a barrel grip
    box(g, FX1 + 3, AY - 2.5, AZ - 2.5, FX1 + 6, AY + 2.5, AZ + 2.5, "steel", 4)  # the crank boss on the axle
    arm = bar(g, "x", (AY, AZ), (AY + 8.0, AZ - 5.0), 4.2, FX1 + 5, FX1 + 9, "gold", 6)
    P.flat(g, arm & (Z < AZ - 2), "gold", 4)
    P.flat(g, arm & (Y > AY + 6), "gold", 7)
    P.flat(g, arm & (np.hypot(Y - AY, Z - AZ) < 3.0), "gold", 5)
    grip = disc(g, "x", AY + 8.0, AZ - 5.0, 3.0, FX1 + 9, FX1 + 13, "darkwood", 5)
    P.flat(g, grip & (np.floor(X) % 2 == 0), "darkwood", 4)
    P.flat(g, grip & (X > FX1 + 11.5), "gold", 7)
    # the signal-red socket block bolted to the front runner
    sock = box(g, 8, 3, RZ0 - 1, 20, 11, RZ0 + 4, "red", 5)
    P.plates(g, sock, "red", 5, size=(7, 6), seed=5)
    P.flat(g, edges(sock), "darkwood", 4)
    for ox in (10, 15):
        o = P.region(g, ox, 5, RZ0 - 1, ox + 4, 9, RZ0)
        P.flat(g, o, "teal", 6)
        P.outline(g, o, "darkwood", 2, normal="z")
        P.flat(g, P.region(g, ox + 1, 6, RZ0 - 1, ox + 2, 8, RZ0), "darkwood", 1)
        P.flat(g, P.region(g, ox + 3, 6, RZ0 - 1, ox + 4, 8, RZ0), "darkwood", 1)
    chips(g, sock, ((20.0, 10.0, RZ0 + 2.0, 2.6),), "rust", 5, seed=6)
    # the free end of the cable, run out across the ground to a red plug
    cab = bar(g, "y", (13.0, RZ0 - 1.5), (29.0, 2.0), 2.6, 0, 3, "rust", 5)
    P.flat(g, cab & (np.floor(X + Z) % 4 == 0), "rust", 3)
    P.flat(g, cab & (Y > 2), "rust", 6)
    plug = box(g, 29, 0, 0, 35, 4, 5, "red", 5)
    P.flat(g, plug & (Y > 3), "red", 6)
    P.flat(g, edges(plug), "darkwood", 4)
    P.flat(g, plug & (X > 34), "gold", 6)
    P.grime(g, g.a > 0, height=2, seed=7)
    return asset("extension-reel", "Extension Cable Reel", root("extension-reel", g))
