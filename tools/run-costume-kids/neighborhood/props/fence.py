"""Picket fence kit (concepts/street-scene.png, street-props.png): a 4-unit
section that tiles (its post sits on its left end, x = -2), a gate with two
tall ball-capped posts at x = -2 and x = +2 (they enclose the neighbours'
posts), and an end post to cap a run. White and dark variants. The build
origin is kept (pivot = the section's centre on the ground), so sections laid
4 units apart tile. Budget <= 400 tris each.

    Blender -b -t 1 --factory-startup --python neighborhood/props/fence.py -- neighborhood/renders [slug ...]
"""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from streetkit import *  # noqa: E402,F403

WHITE = (0.95, 0.93, 0.87)
WHITE_SH = (0.84, 0.81, 0.75)
DARK = (0.27, 0.24, 0.30)
DARK_SH = (0.20, 0.18, 0.22)
HINGE = (0.20, 0.19, 0.22)
PH, PW, PD = 2.45, 0.34, 0.12      # picket height / width / depth


def picket(x, rgb, h=PH, y=0.0):
    """A flat board with a pointed top (6-sided prism)."""
    w = PW / 2
    pts = [(x - w, 0.0), (x + w, 0.0), (x + w, h - 0.26), (x, h), (x - w, h - 0.26)]
    return hull([(px, y + dy, pz) for px, pz in pts for dy in (-PD / 2, PD / 2)], rgb)


def post(x, rgb, h=2.95, w=0.44, ball_cap=False):
    box(x, 0, h / 2, w, w, h, rgb, bevel=0.04)
    box(x, 0, h + 0.07, w + 0.14, w + 0.14, 0.14, rgb)
    if ball_cap:
        ball(x, 0, h + 0.36, 0.42, 0.42, 0.42, rgb, seg=6, ring=4)
    else:
        frustum(x, 0, h + 0.14, w, w, 0.2, 0.08, 0.08, rgb)


def rails(x0, x1, rgb):
    for z in (0.65, 1.8):
        box((x0 + x1) / 2, 0.12, z, x1 - x0, 0.1, 0.2, rgb)


def section(rgb, sh):
    post(-2, rgb)
    rails(-1.8, 2.0, sh)
    for i in range(7):
        picket(-1.5 + 0.5 * i, rgb)


def gate(rgb, sh):
    for x in (-2, 2):
        post(x, rgb, h=3.25, w=0.52, ball_cap=True)
    # the door: shorter pickets on two rails with a diagonal brace, hinges on the left
    for i in range(6):
        picket(-1.35 + 0.54 * i, rgb, h=2.25, y=-0.02)
    for z in (0.6, 1.65):
        box(0, 0.11, z, 3.3, 0.1, 0.22, sh)
    hull([(x, yy, z) for yy in (0.06, 0.16) for x, z in ((-1.55, 0.7), (-1.3, 0.6), (1.55, 1.55), (1.3, 1.65))], sh)
    for z in (0.6, 1.65):
        box(-1.62, -0.09, z, 0.36, 0.05, 0.14, HINGE)
    box(1.62, -0.1, 1.15, 0.22, 0.06, 0.12, HINGE)


def end_post(rgb, sh):
    post(0, rgb)


FENCES = {}
for tag, (rgb, sh) in (("white", (WHITE, WHITE_SH)), ("dark", (DARK, DARK_SH))):
    FENCES[f"fence-{tag}"] = (lambda r=rgb, s=sh: section(r, s))
    FENCES[f"fence-{tag}-gate"] = (lambda r=rgb, s=sh: gate(r, s))
    FENCES[f"fence-{tag}-post"] = (lambda r=rgb, s=sh: end_post(r, s))

main_for(FENCES, "fence", recentre=tuple(FENCES))
