"""A salvaged autogyro with a slow rotor and bright rescue markings."""
import math

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _bld import part
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Part, Socket, turn

GW, GH, GD = 68, 86, 116
CX = 34.0
HUB = (CX, 63.0, 48.0)


def fuselage() -> Grid:
    g = Grid(GW, GH, GD)
    X, Y, Z = S.coords(g)
    # A pointed nose, raised cockpit and long tapered tail boom.
    g.prism("x", [(12, 8), (26, 8), (34, 12), (36, 23), (33, 36), (25, 54), (22, 82), (13, 106),
                   (11, 106), (18, 82), (19, 54), (20, 36), (16, 23)], 27, 41, C("rust", 5))
    shell = S.last(g)
    P.plates(g, shell, "rust", 5, size=(10, 8), rivets=True, seed=2)
    P.flat(g, shell & (Y > 29) & (Z < 44), "khaki", 6)
    # Bubble canopy with a thick frame.
    g.prism("x", [(28, 22), (40, 22), (48, 28), (47, 39), (41, 47), (29, 47), (23, 39), (22, 29)], 27, 41, C("steel", 5))
    canopy = S.last(g)
    P.flat(g, canopy & (Y >= 29) & (Y < 43), "sky", 5)
    P.flat(g, canopy & (Z % 5 == 0), "steel", 5)
    P.flat(g, edges(canopy), "iron", 4)
    P.flat(g,canopy & (Y > 29) & (Y < 43) & (Z > 27) & (Z < 41),"sky",5)
    for xx in (27,40):
        box(g,xx,31,30,xx+1,34,37,"navy",3)
    engine=box(g,27,25,54,41,35,67,"steel",5)
    P.plates(g,engine,"steel",5,size=(5,4),seed=31)
    for yy in (27,30,33):
        box(g,25,yy,55,27,yy+1,66,"iron",3)
    # A fixed mast connects the rotor hub to the airframe.
    box(g, CX - 2, 24, 46, CX + 2, 64, 50, "steel", 5)
    box(g, CX - 5, 28, 43, CX + 5, 34, 53, "iron", 4)
    # Twin landing skids and struts.
    for x in (19, 47):
        S.bar(g, "x", (22, 35), (14, 47), 2, x, x + 2, "steel", 5)
        S.bar(g, "z", (x + 1, 14), (x + 1, 13), 2.2, 24, 75, "steel", 5)
    for z in (26, 72):
        S.bar(g, "x", (18, z), (20, z), 2, 17, 51, "iron", 5)
    # A rescue stripe and a lamp at the nose.
    P.flat(g, shell & (Y >= 18) & (Y < 21) & (Z < 35), "gold", 6)
    S.disc(g, "z", CX, 19, 5.0, 8, 12, "steel", 5, n=8)
    S.disc(g, "z", CX, 19, 3.5, 6, 9, "bone", 7, n=8)
    box(g, CX - 2, 12, 101, CX + 2, 28, 105, "steel", 5)
    # Exhaust manifold at the rear.
    S.bar(g, "x", (22, 88), (22, 103), 1.8, 31, 37, "steel", 5)
    exhaust = (CX, 22, 104)
    return g


def main_rotor() -> Grid:
    g = Grid(GW, GH, GD)
    X, Y, Z = S.coords(g)
    hx, hy, hz = HUB
    for k in range(4):
        a = math.pi * k / 2
        dx, dz = math.cos(a), math.sin(a)
        px, pz = -dz, dx
        r0, r1, w0, w1 = 4, 33, 2.2, 4.2
        poly = [(hx + dx * r0 + px * w0, hz + dz * r0 + pz * w0),
                (hx + dx * r1 + px * w1, hz + dz * r1 + pz * w1),
                (hx + dx * r1 - px * w1, hz + dz * r1 - pz * w1),
                (hx + dx * r0 - px * w0, hz + dz * r0 - pz * w0)]
        g.prism("y", poly, hy - 1, hy + 2, C("bone", 6))
        blade = S.last(g)
        P.flat(g, blade & (np.hypot(X - hx, Z - hz) > 25), "red", 5)
    S.disc(g, "y", hx, hz, 5, hy - 3, hy + 4, "gold", 6, n=8)
    return g


def tail_rotor() -> Grid:
    g = Grid(GW, GH, GD)
    cx, cy, cz = CX, 27.0, 104.0
    for k in range(2):
        a = math.pi * k
        dx, dy = math.cos(a), math.sin(a)
        px, py = -dy, dx
        poly = [(cx + dx * 2 + px * 1.5, cy + dy * 2 + py * 1.5),
                (cx + dx * 12 + px * 2.5, cy + dy * 12 + py * 2.5),
                (cx + dx * 12 - px * 2.5, cy + dy * 12 - py * 2.5),
                (cx + dx * 2 - px * 1.5, cy + dy * 2 - py * 1.5)]
        g.prism("z", poly, cz - 1, cz + 2, C("gold", 5))
        P.flat(g, S.last(g), "red", 5)
    S.disc(g, "z", cx, cy, 3, cz - 2, cz + 3, "steel", 5, n=8)
    return g


def build() -> Asset:
    body = fuselage()
    root = Part("gyrocopter", None, pivot=(CX, 0.0, 48.0))
    part(root, "fuselage", body, (CX, 25.0, 48.0))
    part(root, "main-rotor", main_rotor(), HUB)
    tail_hub = (CX, 27.0, 104.0)
    part(root, "tail-rotor", tail_rotor(), tail_hub)
    idle = {"main-rotor": {"rot": turn(3.0, "y", 360)}, "tail-rotor": {"rot": turn(1.0, "z", -360)}}
    move = {"main-rotor": {"rot": turn(0.55, "y", 360 / 0.55)}, "tail-rotor": {"rot": turn(0.28, "z", -360 / 0.28)},
            "fuselage": {"loc": [(0.0, (0.0, 0.0, 0.0)), (0.25, (0.0, 1.2, 0.0)), (0.5, (0.0, 0.0, 0.0))]}}
    sockets = [Socket("socket-exhaust", at=(0.0, 22.0, 56.0), parent="fuselage"),
               Socket("socket-searchlight", at=(0.0, 19.0, -42.0), parent="fuselage")]
    return Asset(id="apocalypse-vehicles-gyrocopter", pack="apocalypse", category="vehicles", name="Rescue Gyrocopter",
                 root=root, clips=[Clip("idle", idle), Clip("move", move)], sockets=sockets,
                 pfx=[{"effectId": "rvx-apocalypse-exhaust-smoke", "socket": "socket-exhaust", "trigger": "clip:move", "size": 20},
                      {"effectId": "rvx-apocalypse-searchlight", "socket": "socket-searchlight", "trigger": "idle", "size": 25, "aim": [0.0, -0.3, -1.0]}])
