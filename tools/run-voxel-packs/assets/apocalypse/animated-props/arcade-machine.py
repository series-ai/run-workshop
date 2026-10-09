"""A rescued arcade cabinet with a moving joystick and bright game screen.

Person-size (scale class person-size): the cabinet is 40 high and 20 wide,
so a 36-voxel player stands at the control deck (about 21 high) and sees
the screen centre at about 28. The marquee makes it 41 high and 22 wide. The side profile has a forward control
deck, a screen that leans back and an overhanging lit PLAY marquee (true
slopes, rule F2). The cabinet is dark blue with painted side art: a gold
T-moulding, a ringed planet, stars and a red speed band (rules S1, C3).
The rear has a louvred vent panel and a power cable that runs down to a
plug on the ground. Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
from _life import Rig, ctr, fx, keys, limb, make
from pnkit import box, edges
from pnshapes import disc
from voxgrid import C, Clip, Grid

SIZE = (28, 42, 36)
X0, X1 = 4, 24  # the cabinet sides (20 wide)
ZB = 26  # the rear face
# Side profile (y, z): kick panel, control deck, leaning screen, marquee.
PROFILE = [(0, 5), (0, ZB), (41, ZB), (41, 4), (33, 4), (33, 10), (23, 7), (21, 1), (18, 1), (16, 5)]
STICK = (10.5, 21.8, 3.5)  # the joystick foot on the deck


def deck_z(y):
    """The z of the deck top at height y (it slopes down to the player)."""
    return 1 + (y - 21) * 3


def screen_z(y):
    """The z of the leaning screen face at height y."""
    return 7 + (y - 23) * 3 / 11


def cabinet() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    g.prism("x", PROFILE, X0, X1, C("blue", 2))
    shell = g.solids[-1].mask(g.shape)
    P.flat(g, shell & (Y > 20), "blue", 3)  # the upper cabinet catches more light
    P.flat(g, edges(shell), "navy", 3)
    # Gold T-moulding round the two side panels.
    for xs in (X0, X1 - 1):
        side = shell & (np.floor(X) == xs)
        P.outline(g, side, "gold", 4, normal="x")
    # Side art: a red speed band, a ringed planet and four stars on each side.
    band = shell & ((X < X0 + 1) | (X > X1 - 1)) & (np.abs((Y - 9) - (Z - 5) * 0.45) < 1.6) & (Z > 6) & (Z < ZB - 1)
    P.flat(g, band, "red", 5)
    P.flat(g, band & (np.abs((Y - 9) - (Z - 5) * 0.45) < 0.6), "orange", 6)
    for face, plane in (("-x", X0), ("+x", X1)):
        G.icon(g, face, plane, 10, 24, "planet", "orange", 5, inks={"+": ("gold", 6)})
        for zz, yy in ((8, 18), (19, 15), (13, 35), (20, 31)):
            G.stamp(g, face, plane, zz, yy, [".#.", "###", ".#."], {"#": C("bone", 7)})
    # Rust creeps up from the floor on the lowest rows (worn, not new).
    PP.blotch(g, shell & (Y < 4), "rust", 4, cell=2, chance=0.18, seed=2)
    # The screen leans back between the deck and the marquee.
    face = shell & (Y > 23) & (Y < 33) & (Z < screen_z(Y) + 1.6) & (X > X0 + 2) & (X < X1 - 2)
    P.flat(g, face, "navy", 2)
    P.outline(g, face, "iron", 2, normal="z")
    sx = X - (X0 + 3)
    P.flat(g, face & (Y > 30.5) & (Y < 31.5) & (sx > 1) & (sx < 6), "gold", 6)  # the score bar
    for ix in (2, 6, 10):  # three rows of invaders
        for iy in (28, 26):
            P.flat(g, face & (np.floor(Y) == np.floor(iy)) & (sx >= ix) & (sx < ix + 2), "toxic", 6)
    P.flat(g, face & (np.floor(Y) == 24) & (sx >= 6) & (sx < 9), "cyan", 6)  # the player ship
    P.flat(g, face & (np.floor(Y) == 25) & (np.floor(sx) == 7), "cyan", 7)
    # The control deck: steel plates, two fire buttons and a coin label.
    deck = shell & (Y > 20.5) & (Y < 23) & (Z < deck_z(Y) + 1.6) & (X > X0 + 0.5) & (X < X1 - 0.5)
    P.plates(g, deck, "steel", 4, size=(6, 4), rivets=False, seed=3)
    for bx, ramp in ((15.5, "red"), (19.0, "gold")):
        disc(g, "y", bx, 4.0, 1.5, 21.0, 23.4, ramp, 6, n=8)
    # The lit marquee overhangs the screen, one voxel wider than the cabinet.
    marquee = box(g, X0 - 1, 33, 2, X1 + 1, 41, 4, "bone", 7)
    P.outline(g, marquee, "gold", 5, normal="z")
    P.flat(g, edges(marquee), "navy", 3)
    w, _h = G.text_size("PLAY", gap=0)
    G.text(g, "-z", 2, (X0 + X1) // 2 - w // 2, 34, "PLAY", "red", 4, gap=0)
    # The coin door and the kick plate on the lower front.
    door = box(g, 9, 7, 4, 19, 14, 5, "steel", 4)
    P.flat(g, edges(door), "iron", 3)
    for cx in (11, 16):
        P.flat(g, door & (np.floor(X) >= cx) & (np.floor(X) < cx + 2) & (np.floor(Y) >= 10) & (np.floor(Y) < 12), "orange", 6)
        P.flat(g, door & (np.floor(X) == cx) & (np.floor(Y) == 12), "iron", 2)
    kick = shell & (Y < 3) & (Z < 6)
    PP.hazard(g, kick, period=4, a=("gold", 5), b=("iron", 3))
    # The rear: a louvred vent panel and a cable socket.
    vent = box(g, 8, 24, ZB, 20, 34, ZB + 1, "steel", 4)
    P.flat(g, edges(vent), "iron", 3)
    P.flat(g, vent & (np.floor(Y) % 2 == 0) & (Y > 24.5) & (Y < 33.5) & (X > 9) & (X < 19), "iron", 2)
    service = shell & (Z > ZB - 1) & (Y > 4) & (Y < 20) & (X > X0 + 3) & (X < X1 - 3)
    P.outline(g, service, "navy", 3, normal="z")  # the rear service hatch
    P.flat(g, service & (np.floor(Y) == 12) & (np.floor(X) == X0 + 4), "gold", 5)  # its lock
    box(g, 15, 6, ZB, 19, 10, ZB + 1, "iron", 3)  # the cable socket
    # The power cable drops to the floor and runs out to a plug.
    cable = limb(g, (17, 8, ZB + 1.2), (17, 1.2, ZB + 2.4), 1.0, 1.0, "iron", 3, n=6)
    cable |= limb(g, (17, 1.0, ZB + 2.4), (11, 1.0, ZB + 7.5), 1.0, 1.0, "iron", 3, n=6)
    plug = box(g, 8, 0, ZB + 6.5, 11, 2, ZB + 8.5, "steel", 5)
    P.flat(g, plug & (ctr(g)[0] < 8.6), "iron", 3)
    for pz in (ZB + 6.5, ZB + 7.5):  # the two plug pins
        box(g, 7, 0.5, pz, 8, 1.5, pz + 0.6, "gold", 6)
    P.flat(g, cable & (np.floor(Y + Z) % 5 == 0), "iron", 4)
    return g


def joystick() -> Grid:
    g = Grid(*SIZE)
    x, y, z = STICK
    box(g, x - 2, y - 0.4, z - 2, x + 2, y + 0.8, z + 2, "iron", 4)
    limb(g, (x, y + 0.5, z), (x, y + 5.0, z), 0.8, 0.7, "steel", 5, n=6)
    ball = disc(g, "y", x, z, 1.9, y + 4.6, y + 7.4, "red", 5, n=8)
    P.flat(g, ball & (ctr(g)[1] > y + 6.6), "red", 7)
    return g


def build():
    rig = Rig("arcade-machine", ((X0 + X1) / 2, 0, 14), cabinet())
    rig.add("joystick", joystick(), STICK)
    active = {"joystick": {"rot": keys((0, (0, 0, -12)), (0.25, (0, 0, 12)), (0.5, (0, 0, -12)), (0.75, (0, 0, 12)), (1, (0, 0, -12)))}}
    idle = {"joystick": {"rot": keys((0, (0, 0, 0)), (1, (0, 0, 2)), (2, (0, 0, 0)))}}
    x, y, z = STICK
    socket = rig.socket("socket-joystick", (x, y + 6.0, z), parent="joystick")
    return make("animated-props", "arcade-machine", "Wasteland Arcade Cabinet", rig.root,
                clips=[Clip("idle", idle), Clip("active", active)], sockets=[socket],
                pfx=[fx("rvx-apocalypse-metal-clang", "socket-joystick", "clip:active", at=0.25, size=6)])
