"""Roadside payphone, in the Pirate Nation style.

A person-size icon (rules F4, K3): a teal hooded shroud with true sloped
sides and a sloped roof on a thick post in a sand footing, crowned by an
oversized glowing TEL sign. Inside, a steel phone with a painted keypad,
coin slot and shelf; the handset dangles on its cord (a rest rotation,
rule F5) and a flyer is taped to the side. Keys, slots, the flyer and the
glow are paint (rule S1).
"""
import numpy as np

import paint as P
import pnglyph
from _props import asset, child, root, tuft
from pnkit import box, edges
from pnshapes import coords
from voxgrid import C, Clip, Grid, sway

HX0, HX1 = 3, 21  # hood width (x)
HY0, HY1 = 16, 33  # hood bottom and top
HZB = 12  # hood back (z); the front is open
PX = 12  # post centre x


def build():
    g = Grid(24, 49, 16)
    X, Y, Z = coords(g)
    # footing and post
    f = box(g, PX - 5, 0, 3, PX + 5, 2, 13, "sand", 5)
    P.flat(g, edges(f), "sand", 4)
    post = box(g, PX - 1.5, 2, 8, PX + 1.5, HY0, 11, "steel", 5)
    P.flat(g, post & (np.floor(X) == PX), "steel", 6)
    # the hood: back panel, two sloped side panels, a sloped roof
    back = box(g, HX0, HY0, HZB - 2, HX1, HY1, HZB, "teal", 5)
    for sx in (HX0, HX1 - 2):
        g.prism("x", [(HY0, HZB), (HY1, HZB), (HY1, 1), (HY0 + 5, 3), (HY0, 5)], sx, sx + 2, C("teal", 5))
    g.prism("x", [(HY1, HZB + 1), (HY1 + 3, HZB + 1), (HY1 + 1.5, 0), (HY1 - 0.5, 0)], HX0 - 1, HX1 + 1, C("teal", 4))
    roof = g.solids[-1].mask(g.shape)
    P.flat(g, roof & (Y > HY1 + 1), "teal", 6)
    hood = back | g.solid_mask()
    P.flat(g, hood & ~roof & (Y < HY0 + 1), "teal", 3)
    P.flat(g, hood & ~roof & (Z < 3.5) & (Y > HY0 + 1), "teal", 6)  # lit front edges
    # a flyer taped to the +x side
    P.flat(g, hood & (X > HX1 - 0.5) & (Y > HY0 + 6) & (Y < HY0 + 12) & (Z > 5) & (Z < 10), "bone", 7)
    P.flat(g, hood & (X > HX1 - 0.5) & (np.floor(Y) % 2 == 0) & (Y > HY0 + 7) & (Y < HY0 + 10) & (Z > 6) & (Z < 9), "red", 4)
    # the phone: a steel box on the back panel
    ph = box(g, 7, HY0 + 3, HZB - 6, 17, HY0 + 15, HZB - 2, "steel", 5)
    P.flat(g, edges(ph), "steel", 3)
    front = ph & (Z < HZB - 5)
    for r_ in range(4):  # a 3 × 4 keypad
        for c in range(3):
            kx, ky = 11 + c * 2, HY0 + 5 + r_ * 2
            P.flat(g, front & (np.floor(X) == kx) & (np.floor(Y) == ky), "bone", 7)
    P.flat(g, front & (X > 14.5) & (X < 16) & (Y > HY0 + 11) & (Y < HY0 + 14), "steel", 2)  # coin slot
    P.flat(g, front & (X > 11) & (X < 16) & (Y > HY0 + 12) & (Y < HY0 + 14) & (X < 14), "teal", 6)  # display
    cradle = box(g, 7, HY0 + 8, HZB - 7, 9, HY0 + 14, HZB - 6, "steel", 4)
    shelf = box(g, HX0 + 2, HY0 + 2, HZB - 8, HX1 - 2, HY0 + 3, HZB - 2, "steel", 6)
    # the oversized TEL sign on the roof
    sign = box(g, 1, HY1 + 3, 5, 23, HY1 + 14, 8, "gold", 6)
    P.outline(g, sign, "teal", 4, normal="z")
    P.flat(g, sign & (coords(g)[1] > HY1 + 12), "gold", 7)
    tw, _ = pnglyph.text_size("TEL")
    pnglyph.text(g, "-z", 5, 12 - tw // 2, HY1 + 5, "TEL", "red", 4)
    box(g, 6, HY1 + 2, 6, 8, HY1 + 3, 7, "steel", 5)
    box(g, 16, HY1 + 2, 6, 18, HY1 + 3, 7, "steel", 5)
    tuft(g, 3, 4, 0, seed=1)
    tuft(g, 19, 12, 0, seed=2)
    r = root("payphone", g)
    # the handset dangles from the cradle on its cord
    hs = Grid(3, 16, 3)
    box(hs, 1, 8, 1, 2, 16, 2, "steel", 3)  # cord
    hm = box(hs, 0, 0, 0, 3, 8, 3, "steel", 4)
    P.flat(hs, hm & ((coords(hs)[1] < 2) | (coords(hs)[1] > 6)), "steel", 6)
    child(r, "handset", hs, pivot=(1.5, 16.0, 1.5), at_grid=(8.0, HY0 + 9.0, HZB - 7.5), rot=(12.0, 0.0, -10.0))
    # the dangling handset turns and swings a little on its cord
    return asset("payphone", "Payphone", r, clips=[Clip("idle", {"handset": {"rot": sway(3.6, amp=(4.0, 10.0, 5.0), phase=(0.0, 0.0, 1.5))}})])
