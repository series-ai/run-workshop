"""The tall car from the street scene: a boxy, rounded, old-fashioned cartoon
jalopy with a tall cabin, chunky wheels and round glowing headlights.
Front faces -y.

    Blender -b -t 1 --factory-startup --python neighborhood/props/car.py -- neighborhood/renders [slug ...]
"""
import math
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from kit import *  # noqa: E402,F403
import kit  # noqa: E402

TYRE = (0.17, 0.16, 0.19)
CHROME = (0.86, 0.85, 0.81)
WIN = (0.20, 0.22, 0.30)
RED = (0.78, 0.16, 0.14)
SEAM = (0.30, 0.24, 0.22)

AX = (0, math.radians(90), 0)      # a can lying along x (wheels)
AY = (math.radians(90), 0, 0)      # a can lying along y (lights)

L, WID = 5.8, 3.4                  # body length (y) and width (x)
WR = 0.92                          # wheel radius
WY = 1.95                          # axle offset from centre


def car(c):
    body, roof, trim = c["body"], c["roof"], c.get("trim", CHROME)
    front, rear = -L / 2, L / 2
    # wheels: chunky tyres with a cream hubcap
    for sx in (-1, 1):
        for wy in (-WY, WY):
            can(sx * (WID / 2 - 0.15), wy, WR, WR, 0.75, TYRE, n=10, rot=AX)
            can(sx * (WID / 2 + 0.25), wy, WR, WR * 0.48, 0.12, c.get("hub", CHROME), n=8, rot=AX)
            ball(sx * (WID / 2 + 0.33), wy, WR, 0.3, 0.2, 0.3, trim, seg=6, ring=4)
    # lower body: a tall rounded tub
    box(0, 0, 2.0, WID, L, 1.6, body, bevel=0.32, segs=2)
    # rounded fenders arching over each wheel
    for sx in (-1, 1):
        for wy in (-WY, WY):
            box(sx * (WID / 2 - 0.05), wy, WR + 0.75, 0.95, 2.3, 0.75, body, bevel=0.3, segs=2)
        box(sx * (WID / 2 + 0.12), 0, 1.05, 0.5, 2 * WY - 2.2, 0.16, SEAM)  # running board
        # door seams and handles
        for y in (-0.75, 0.9):
            box(sx * (WID / 2 + 0.01), y, 2.1, 0.04, 0.07, 1.0, SEAM)
        box(sx * (WID / 2 + 0.03), 0.6, 2.45, 0.08, 0.38, 0.1, trim)
    # tall cabin and its roof
    cy0, cy1 = -0.9, 2.55
    box(0, (cy0 + cy1) / 2, 3.95, WID - 0.3, cy1 - cy0, 2.3, body, bevel=0.3, segs=2)
    box(0, (cy0 + cy1) / 2 + 0.05, 5.12, WID - 0.15, cy1 - cy0 + 0.3, 0.36, roof, bevel=0.16, segs=2)
    # windows: dark flat panels (no glass)
    box(0, cy0 - 0.02, 4.05, WID - 0.95, 0.06, 1.35, WIN)               # windscreen
    box(0, cy1 + 0.02, 4.05, WID - 1.0, 0.06, 1.15, WIN)                # rear window
    for sx in (-1, 1):
        for y, w in ((-0.05, 1.25), (1.65, 1.1)):
            box(sx * ((WID - 0.3) / 2 + 0.01), y, 4.05, 0.06, w, 1.3, WIN)
    # hood: the front of the tub, with a grille, ornament and lights
    box(0, front - 0.02, 2.05, 1.25, 0.12, 1.15, trim, bevel=0.06)
    for i in range(4):
        box(-0.42 + i * 0.28, front - 0.08, 2.05, 0.1, 0.06, 0.95, SEAM)
    box(0, -1.8, 2.83, 0.08, 1.9, 0.05, SEAM)  # hood centre seam
    ball(0, front + 0.45, 2.95, 0.3, 0.4, 0.3, trim, seg=6, ring=4)
    for sx in (-1, 1):
        x = sx * 1.12
        can(x, front - 0.05, 2.25, 0.4, 0.22, trim, n=10, rot=AY)
        with glow():
            can(x, front - 0.12, 2.25, 0.31, 0.16, GLOW_RGB, n=10, rot=AY)
        box(sx * 1.25, rear + 0.04, 2.35, 0.36, 0.1, 0.5, RED)   # tail lights
    # bumpers
    for y in (front - 0.3, rear + 0.3):
        box(0, y, 1.3, WID + 0.3, 0.3, 0.34, trim, bevel=0.1)
    # a spare tyre on the back
    can(0, rear + 0.32, 2.3, 0.72, 0.4, TYRE, n=10, rot=AY)
    can(0, rear + 0.5, 2.3, 0.34, 0.08, c.get("hub", CHROME), n=8, rot=AY)


COLOURS = {
    "car-a": dict(body=(0.84, 0.68, 0.53), roof=(0.74, 0.58, 0.45), hub=(0.95, 0.91, 0.82)),   # cream-tan like the concept
    "car-b": dict(body=(0.36, 0.58, 0.58), roof=(0.93, 0.89, 0.79), hub=(0.93, 0.89, 0.79)),   # muted teal, cream roof
}


def main():
    out = out_dir_arg()
    only = sys.argv[sys.argv.index("--") + 2:] if "--" in sys.argv else []
    entries = []
    for slug, col in COLOURS.items():
        if only and slug not in only:
            continue
        entries.append(build_and_ship(slug, "car", lambda: car(col), out))
    kit.update_index(entries)


main()
