"""The mix-and-match part library (run inside Blender, used by build.py).

Every head is the same skull plus a species snout, nose, face markings and extras
(horns, antlers, manes, crests), so the shared eye styles and hairstyles fit them all.
Ears, tails and feet are their own swappable pieces. A species is just a recipe:
which head, ears, tail, feet, hair and eyes, and its colours (SPECIES below).

Part meshes are named <kind>_<name>: head_wolf, ears_fox, tail_lion, feet_hooves, ...
"""
import math
import bmesh

from mathutils import Vector as V

import anthro as A


def C(r, g, b):
    return (r / 255, g / 255, b / 255)


# ---------------------------------------------------------------- recipes

# snout profiles, authored per animal: rows of (y forward of the head centre, z, half width,
# depth above, depth below), from inside the skull to the tip. The front is rounded off by
# the builder. exp: squareness. nose type. jaw: a separate lower jaw piece (two-piece
# muzzle). pads: puffy whisker pads and a chin (cats, rabbits, mice, otters).
SNOUTS = {
    "dog":      dict(exp=3.4, nose="dog", rows=[(-0.02, -0.042, 0.094, 0.068, 0.102), (-0.08, -0.048, 0.092, 0.066, 0.1), (-0.135, -0.056, 0.084, 0.058, 0.09),
                                                (-0.18, -0.063, 0.076, 0.052, 0.08), (-0.21, -0.067, 0.07, 0.048, 0.072), (-0.225, -0.069, 0.06, 0.04, 0.06)]),
    "fox":      dict(exp=2.8, nose="dog", rows=[(-0.02, -0.042, 0.098, 0.064, 0.096), (-0.07, -0.046, 0.088, 0.058, 0.084), (-0.12, -0.052, 0.068, 0.046, 0.066),
                                                (-0.17, -0.058, 0.05, 0.036, 0.05), (-0.21, -0.062, 0.038, 0.028, 0.038), (-0.24, -0.064, 0.028, 0.021, 0.027)]),
    "lab":      dict(exp=3.6, nose="dog", rows=[(-0.02, -0.044, 0.102, 0.072, 0.108), (-0.08, -0.05, 0.1, 0.07, 0.108), (-0.14, -0.058, 0.094, 0.062, 0.102),
                                                (-0.18, -0.064, 0.088, 0.056, 0.094), (-0.2, -0.067, 0.08, 0.05, 0.082), (-0.21, -0.068, 0.066, 0.04, 0.066)]),
    "bear":     dict(exp=2.5, nose="dog", jaw=True, rows=[(-0.02, -0.05, 0.1, 0.07, 0.096), (-0.08, -0.054, 0.094, 0.064, 0.088), (-0.13, -0.06, 0.082, 0.056, 0.076),
                                                          (-0.165, -0.064, 0.07, 0.048, 0.064), (-0.185, -0.066, 0.056, 0.04, 0.05)]),
    "hyena":    dict(exp=3.0, nose="dog", jaw=True, rows=[(-0.02, -0.046, 0.1, 0.074, 0.1), (-0.08, -0.05, 0.096, 0.07, 0.096), (-0.14, -0.056, 0.088, 0.062, 0.086),
                                                          (-0.185, -0.06, 0.08, 0.056, 0.076), (-0.21, -0.062, 0.07, 0.048, 0.064)]),
    "raccoon":  dict(exp=2.6, nose="dog", rows=[(-0.02, -0.046, 0.094, 0.062, 0.086), (-0.07, -0.05, 0.084, 0.056, 0.076), (-0.12, -0.056, 0.064, 0.044, 0.058),
                                                (-0.16, -0.06, 0.046, 0.034, 0.042), (-0.185, -0.062, 0.032, 0.024, 0.03)]),
    "cat":      dict(exp=2.4, nose="cat", pads=True, rows=[(-0.03, -0.05, 0.08, 0.05, 0.066), (-0.085, -0.055, 0.076, 0.046, 0.062), (-0.115, -0.058, 0.064, 0.04, 0.052),
                                                           (-0.13, -0.06, 0.048, 0.03, 0.038)]),
    "bigcat":   dict(exp=2.6, nose="cat", pads=True, rows=[(-0.03, -0.05, 0.094, 0.06, 0.078), (-0.09, -0.056, 0.09, 0.056, 0.074), (-0.13, -0.06, 0.078, 0.048, 0.064),
                                                           (-0.15, -0.062, 0.058, 0.036, 0.048)]),
    "bunny":    dict(exp=2.4, nose="bunny", pads=True, rows=[(-0.03, -0.05, 0.078, 0.05, 0.064), (-0.08, -0.055, 0.072, 0.046, 0.058), (-0.11, -0.058, 0.06, 0.038, 0.048),
                                                             (-0.125, -0.06, 0.044, 0.028, 0.036)]),
    "mouse":    dict(exp=2.4, nose="bunny", pads=True, rows=[(-0.02, -0.046, 0.082, 0.056, 0.074), (-0.07, -0.05, 0.072, 0.05, 0.062), (-0.12, -0.056, 0.05, 0.036, 0.044),
                                                             (-0.155, -0.06, 0.03, 0.024, 0.028)]),
    "otter":    dict(exp=2.4, nose="dog", pads=True, rows=[(-0.02, -0.05, 0.11, 0.056, 0.076), (-0.08, -0.054, 0.104, 0.05, 0.07), (-0.115, -0.058, 0.09, 0.042, 0.06),
                                                           (-0.135, -0.06, 0.068, 0.032, 0.046)]),
    "deer":     dict(exp=2.6, nose="dog", rows=[(-0.02, -0.046, 0.094, 0.064, 0.094), (-0.08, -0.052, 0.08, 0.056, 0.08), (-0.14, -0.06, 0.064, 0.046, 0.064),
                                                (-0.19, -0.068, 0.054, 0.04, 0.054), (-0.225, -0.073, 0.05, 0.037, 0.048), (-0.24, -0.075, 0.042, 0.031, 0.038)]),
    "horse":    dict(exp=2.8, nose="horse", jaw=True, rows=[(-0.02, -0.05, 0.096, 0.068, 0.108), (-0.09, -0.058, 0.08, 0.06, 0.096), (-0.16, -0.07, 0.066, 0.052, 0.078),
                                                            (-0.22, -0.082, 0.066, 0.05, 0.072), (-0.26, -0.09, 0.074, 0.054, 0.076), (-0.285, -0.094, 0.07, 0.05, 0.068)]),
    "goat":     dict(exp=2.6, nose="horse", rows=[(-0.02, -0.046, 0.09, 0.064, 0.094), (-0.08, -0.05, 0.076, 0.06, 0.08), (-0.14, -0.06, 0.062, 0.054, 0.064),
                                                  (-0.19, -0.07, 0.054, 0.046, 0.054), (-0.225, -0.078, 0.05, 0.04, 0.048), (-0.24, -0.08, 0.042, 0.032, 0.038)]),
    "kangaroo": dict(exp=2.6, nose="dog", rows=[(-0.02, -0.046, 0.094, 0.064, 0.092), (-0.08, -0.052, 0.082, 0.058, 0.08), (-0.14, -0.058, 0.068, 0.05, 0.066),
                                                (-0.185, -0.064, 0.06, 0.044, 0.058), (-0.21, -0.067, 0.054, 0.04, 0.05)]),
    "bat":      dict(exp=2.4, nose="leaf", rows=[(-0.03, -0.05, 0.088, 0.06, 0.078), (-0.08, -0.054, 0.084, 0.056, 0.074), (-0.11, -0.056, 0.07, 0.046, 0.06),
                                                 (-0.125, -0.058, 0.05, 0.034, 0.044)]),
    "dragon":   dict(exp=3.6, nose="nostrils", jaw=True, rows=[(-0.02, -0.04, 0.1, 0.06, 0.084), (-0.1, -0.048, 0.092, 0.054, 0.074), (-0.18, -0.056, 0.08, 0.046, 0.062),
                                                               (-0.24, -0.062, 0.072, 0.04, 0.054), (-0.275, -0.064, 0.064, 0.036, 0.046)]),
    "lizard":   dict(exp=3.0, nose="nostrils", jaw=True, rows=[(-0.02, -0.042, 0.098, 0.058, 0.08), (-0.09, -0.048, 0.088, 0.052, 0.07), (-0.15, -0.054, 0.074, 0.044, 0.058),
                                                               (-0.2, -0.058, 0.062, 0.036, 0.048), (-0.225, -0.06, 0.052, 0.03, 0.04)]),
    "shark":    dict(exp=2.2, nose="none", jaw=True, rows=[(0.0, -0.03, 0.12, 0.09, 0.1), (-0.08, -0.04, 0.102, 0.076, 0.084), (-0.16, -0.05, 0.078, 0.056, 0.062),
                                                           (-0.22, -0.056, 0.052, 0.04, 0.044), (-0.26, -0.058, 0.032, 0.025, 0.028)]),
    "bird":     dict(exp=2.2, nose="beak", rows=[(-0.02, -0.03, 0.06, 0.05, 0.04), (-0.1, -0.05, 0.04, 0.034, 0.026), (-0.17, -0.07, 0.016, 0.014, 0.01)]),
}

# ears: shape, length, base width, thickness, splay (degrees out), lean (degrees back),
# curl (tip toward the centre), sideways (deer: held out to the side), lop (hang down).
EARS = {
    "wolf":   dict(shape="point", len=0.23, w=0.068, t=0.038, splay=14, lean=-4, curl=0.02),
    "fox":    dict(shape="point", len=0.27, w=0.08, t=0.038, splay=18, lean=-2, curl=0.025),
    "cat":    dict(shape="point", len=0.16, w=0.072, t=0.034, splay=18, lean=0, curl=0.012),
    "round":  dict(shape="round", len=0.1, w=0.07, t=0.034, splay=26, lean=6, curl=0.0),
    "big_round": dict(shape="round", len=0.15, w=0.1, t=0.03, splay=32, lean=8, curl=0.0),
    "bunny":  dict(shape="long", len=0.38, w=0.06, t=0.032, splay=8, lean=10, curl=0.0),
    "horse":  dict(shape="point", len=0.18, w=0.05, t=0.034, splay=10, lean=-6, curl=0.02),
    "tall":   dict(shape="long", len=0.28, w=0.075, t=0.032, splay=16, lean=4, curl=0.0),
    "small":  dict(shape="round", len=0.06, w=0.05, t=0.03, splay=40, lean=8, curl=0.0),
    "deer":   dict(shape="leaf", len=0.2, w=0.072, t=0.03, splay=80, lean=10, curl=0.0),
    "bat":    dict(shape="point", len=0.3, w=0.11, t=0.03, splay=24, lean=4, curl=0.03),
    "lop":    dict(shape="lop", len=0.22, w=0.08, t=0.03, splay=95, lean=10, curl=0.0),
    "fin":    dict(shape="fin", len=0.19, w=0.09, t=0.022, splay=70, lean=55, curl=0.0),
    "none":   None,
}

# tails: control points (x, y back, z up, in torso lengths from the tail root), a radius
# profile, tufty jag, and how it is coloured (tip, underside, rings, tuft).
TAILS = {
    "wolf":     dict(pts=[(0, 0, 0), (0, .34, -.14), (0, .62, -.4), (0, .82, -.52), (0, 1.0, -.48)], r=(0.04, 0.12), jag=0.18, tip=0.68, under=True),
    "fox":      dict(pts=[(0, 0, 0), (0, .34, -.1), (.1, .7, -.16), (.2, .98, .06), (.24, 1.16, .34)], r=(0.05, 0.15), jag=0.22, tip=0.72, under=True),
    "cat":      dict(pts=[(0, 0, 0), (0, .3, -.24), (.06, .62, -.18), (.12, .82, .14), (.08, .8, .5), (0, .7, .66)], r=(0.04, 0.045), jag=0, tip=0.85),
    "lion":     dict(pts=[(0, 0, 0), (0, .3, -.24), (.04, .62, -.3), (.08, .9, -.2), (.08, 1.08, 0)], r=(0.035, 0.036), jag=0, tuft=True),
    "tiger":    dict(pts=[(0, 0, 0), (0, .3, -.24), (.06, .62, -.2), (.12, .84, .08), (.1, .86, .4)], r=(0.045, 0.045), jag=0, rings=7),
    "bunny":    dict(puff=0.11),
    "deer":     dict(pts=[(0, 0, 0), (0, .12, .06), (0, .2, .2)], r=(0.06, 0.07), jag=0, under=True, short=True),
    # a horse tail: a short dock, then a long fall of hair that fans out and comes to a soft point at hock height
    "horse":    dict(pts=[(0, 0, 0), (0, .2, -.02), (0, .34, -.2), (0, .42, -.44), (0, .44, -.66)], r=(0.06, 0.15), jag=0, hair=True, plume=True),
    "dragon":   dict(pts=[(0, 0, 0), (0, .4, -.18), (.06, .82, -.36), (.16, 1.24, -.42), (.3, 1.58, -.34)], r=(0.115, 0.005), jag=0, spines=True, taper=True),
    "lizard":   dict(pts=[(0, 0, 0), (0, .38, -.18), (.04, .76, -.34), (.12, 1.1, -.4), (.22, 1.38, -.36)], r=(0.1, 0.005), jag=0, taper=True),
    "shark":    dict(pts=[(0, 0, 0), (0, .36, -.18), (.06, .74, -.36), (.14, 1.02, -.42)], r=(0.14, 0.03), jag=0, taper=True, fluke=True),
    "bear":     dict(pts=[(0, 0, 0), (0, .08, -.02), (0, .14, -.06)], r=(0.06, 0.05), jag=0, short=True),
    "raccoon":  dict(pts=[(0, 0, 0), (0, .3, -.14), (.08, .62, -.12), (.16, .86, .06), (.2, .98, .3)], r=(0.06, 0.12), jag=0.12, rings=8),
    "redpanda": dict(pts=[(0, 0, 0), (0, .32, -.12), (.08, .68, -.14), (.18, .96, .02), (.22, 1.12, .26)], r=(0.07, 0.13), jag=0.1, rings=8),
    "otter":    dict(pts=[(0, 0, 0), (0, .3, -.28), (0, .62, -.5), (.04, .9, -.62), (.08, 1.1, -.64)], r=(0.11, 0.01), jag=0, taper=True),
    "kangaroo": dict(pts=[(0, 0, 0), (0, .32, -.26), (0, .64, -.52), (0, .94, -.66), (0, 1.22, -.7)], r=(0.105, 0.02), jag=0, taper=True),
    "bird":     dict(feathers=True),
    "bat":      dict(pts=[(0, 0, 0), (0, .12, -.06), (0, .22, -.06)], r=(0.04, 0.01), jag=0, taper=True, short=True),
    "mouse":    dict(pts=[(0, 0, 0), (0, .3, -.3), (.08, .7, -.46), (.2, 1.04, -.4), (.3, 1.3, -.22)], r=(0.026, 0.012), jag=0, taper=True, pink=True),
    "hyena":    dict(pts=[(0, 0, 0), (0, .2, -.16), (0, .36, -.34), (0, .46, -.48)], r=(0.045, 0.07), jag=0.2, tip=0.5),
    "none":     None,
}

FEET = ["paws", "hooves", "cloven", "talons", "reptile"]
HAIRS = ["crest", "mohawk", "swoop", "long", "none"]

# (head snout, face markings, extras, ears, tail, feet, hair, eyes, colours)
GREY = dict(fur=C(112, 128, 158), fur_light=C(226, 232, 242), fur_dark=C(78, 90, 120), hair=C(52, 168, 150), inner_ear=C(214, 220, 232),
            nose=C(28, 28, 34), iris=C(120, 150, 140), horn=C(232, 222, 196), pads=C(58, 60, 76))
SPECIES = {
    "wolf":      dict(snout="dog", mask="muzzle", extras=[], ears="wolf", tail="wolf", feet="paws", hair="crest", eyes="almond", colours=GREY),
    "husky":     dict(snout="dog", mask="husky", extras=[], ears="wolf", tail="wolf", feet="paws", hair="none", eyes="round",
                      colours=dict(fur=C(70, 76, 96), fur_light=C(245, 245, 250), fur_dark=C(48, 52, 66), hair=C(70, 76, 96), iris=C(110, 200, 255))),
    "fox":       dict(snout="fox", mask="muzzle", extras=[], ears="fox", tail="fox", feet="paws", hair="swoop", eyes="sharp",
                      colours=dict(fur=C(238, 122, 52), fur_light=C(255, 244, 228), fur_dark=C(56, 40, 40), hair=C(250, 120, 190), iris=C(110, 210, 90),
                                   inner_ear=C(255, 244, 228))),
    "dog":       dict(snout="lab", mask="muzzle", extras=[], ears="lop", tail="wolf", feet="paws", hair="none", eyes="round",
                      colours=dict(fur=C(214, 168, 96), fur_light=C(250, 236, 206), fur_dark=C(150, 104, 56), hair=C(150, 104, 56), iris=C(96, 64, 40))),
    "cat":       dict(snout="cat", mask="catface", extras=[], ears="cat", tail="cat", feet="paws", hair="crest", eyes="slit",
                      colours=dict(fur=C(176, 150, 220), fur_light=C(244, 236, 252), fur_dark=C(110, 80, 170), hair=C(110, 80, 170), iris=C(255, 196, 60),
                                   nose=C(240, 150, 170), inner_ear=C(240, 170, 190))),
    "tiger":     dict(snout="bigcat", mask="catface", extras=["tiger_stripes"], ears="round", tail="tiger", feet="paws", hair="none", eyes="sharp",
                      colours=dict(fur=C(242, 140, 50), fur_light=C(255, 246, 230), fur_dark=C(40, 30, 30), hair=C(40, 30, 30), iris=C(180, 210, 80),
                                   inner_ear=C(255, 246, 230))),
    "lion":      dict(snout="bigcat", mask="catface", extras=["mane"], ears="round", tail="lion", feet="paws", hair="none", eyes="almond",
                      colours=dict(fur=C(222, 176, 104), fur_light=C(250, 236, 206), fur_dark=C(120, 72, 40), hair=C(150, 82, 40), iris=C(200, 150, 60),
                                   nose=C(150, 92, 80))),
    "bunny":     dict(snout="bunny", mask="muzzle", extras=[], ears="bunny", tail="bunny", feet="paws", hair="swoop", eyes="round",
                      colours=dict(fur=C(250, 236, 226), fur_light=C(255, 250, 246), fur_dark=C(240, 200, 214), hair=C(255, 170, 200), iris=C(220, 80, 120),
                                   nose=C(240, 150, 170), inner_ear=C(240, 160, 180))),
    "deer":      dict(snout="deer", mask="muzzle", extras=["antlers"], ears="deer", tail="deer", feet="cloven", hair="none", eyes="round",
                      colours=dict(fur=C(196, 130, 78), fur_light=C(250, 238, 220), fur_dark=C(120, 76, 50), hair=C(120, 76, 50), iris=C(96, 60, 40),
                                   horn=C(236, 220, 190), inner_ear=C(250, 210, 210))),
    "horse":     dict(snout="horse", mask="blaze", extras=["horse_mane"], ears="horse", tail="horse", feet="hooves", hair="none", eyes="almond",
                      colours=dict(fur=C(130, 82, 52), fur_light=C(245, 238, 226), fur_dark=C(60, 40, 30), hair=C(40, 28, 24), iris=C(70, 46, 30),
                                   horn=C(50, 40, 36), nose=C(60, 46, 40))),
    "goat":      dict(snout="goat", mask="muzzle", extras=["goat_horns", "beard"], ears="deer", tail="deer", feet="cloven", hair="none", eyes="sharp",
                      colours=dict(fur=C(206, 184, 152), fur_light=C(250, 246, 236), fur_dark=C(120, 110, 100), hair=C(200, 196, 186), iris=C(220, 170, 50),
                                   horn=C(150, 130, 110), nose=C(120, 100, 100))),
    "bear":      dict(snout="bear", mask="snout_light", extras=[], ears="round", tail="bear", feet="paws", hair="none", eyes="dot",
                      colours=dict(fur=C(130, 88, 60), fur_light=C(214, 182, 140), fur_dark=C(80, 54, 38), hair=C(80, 54, 38), iris=C(60, 40, 30))),
    "raccoon":   dict(snout="raccoon", mask="raccoon", extras=[], ears="round", tail="raccoon", feet="paws", hair="mohawk", eyes="round",
                      colours=dict(fur=C(140, 140, 150), fur_light=C(232, 232, 236), fur_dark=C(40, 38, 46), hair=C(40, 38, 46), iris=C(250, 180, 60))),
    "redpanda":  dict(snout="raccoon", mask="redpanda", extras=[], ears="round", tail="redpanda", feet="paws", hair="none", eyes="dot",
                      colours=dict(fur=C(196, 82, 40), fur_light=C(252, 244, 232), fur_dark=C(60, 30, 26), hair=C(196, 82, 40), iris=C(60, 30, 20),
                                   inner_ear=C(252, 244, 232))),
    "otter":     dict(snout="otter", mask="snout_light", extras=[], ears="small", tail="otter", feet="paws", hair="none", eyes="dot",
                      colours=dict(fur=C(120, 86, 60), fur_light=C(214, 190, 160), fur_dark=C(80, 56, 40), hair=C(80, 56, 40), iris=C(40, 30, 24))),
    "hyena":     dict(snout="hyena", mask="snout_dark", extras=["hyena_mane"], ears="round", tail="hyena", feet="paws", hair="mohawk", eyes="sharp",
                      colours=dict(fur=C(206, 176, 120), fur_light=C(232, 214, 176), fur_dark=C(70, 54, 44), hair=C(70, 54, 44), iris=C(220, 170, 50))),
    "mouse":     dict(snout="mouse", mask="muzzle", extras=[], ears="big_round", tail="mouse", feet="paws", hair="swoop", eyes="dot",
                      colours=dict(fur=C(160, 156, 166), fur_light=C(236, 232, 238), fur_dark=C(110, 104, 116), hair=C(110, 104, 116), iris=C(30, 26, 30),
                                   nose=C(240, 150, 170), inner_ear=C(240, 170, 190), pads=C(240, 170, 190))),
    "kangaroo":  dict(snout="kangaroo", mask="muzzle", extras=[], ears="tall", tail="kangaroo", feet="paws", hair="none", eyes="almond",
                      colours=dict(fur=C(176, 124, 92), fur_light=C(236, 220, 200), fur_dark=C(110, 76, 58), hair=C(110, 76, 58), iris=C(60, 40, 30),
                                   inner_ear=C(236, 200, 190))),
    "bat":       dict(snout="bat", mask="none", extras=[], ears="bat", tail="bat", feet="paws", hair="swoop", eyes="round",
                      colours=dict(fur=C(84, 60, 104), fur_light=C(150, 110, 170), fur_dark=C(56, 40, 70), hair=C(200, 120, 255), iris=C(255, 90, 140),
                                   inner_ear=C(240, 150, 190), nose=C(214, 120, 172))),
    "dragon":    dict(snout="dragon", mask="jaw_light", extras=["dragon_horns", "spikes"], ears="fin", tail="dragon", feet="reptile", hair="none", eyes="slit",
                      colours=dict(fur=C(52, 92, 196), fur_light=C(250, 206, 92), fur_dark=C(30, 56, 130), hair=C(250, 206, 92), iris=C(255, 170, 40),
                                   horn=C(250, 245, 230), inner_ear=C(110, 200, 230), claws=C(250, 245, 230))),
    "lizard":    dict(snout="lizard", mask="jaw_light", extras=["spikes"], ears="none", tail="lizard", feet="reptile", hair="none", eyes="slit",
                      colours=dict(fur=C(90, 170, 90), fur_light=C(220, 236, 170), fur_dark=C(50, 110, 60), hair=C(250, 120, 60), iris=C(250, 210, 60),
                                   horn=C(220, 236, 170))),
    "shark":     dict(snout="shark", mask="jaw_light", extras=["head_fin"], ears="none", tail="shark", feet="paws", hair="none", eyes="dot",
                      colours=dict(fur=C(98, 140, 172), fur_light=C(240, 244, 248), fur_dark=C(70, 100, 130), hair=C(255, 110, 90), iris=C(30, 30, 40))),
    "bird":      dict(snout="bird", mask="none", extras=["crest"], ears="none", tail="bird", feet="talons", hair="none", eyes="round",
                      colours=dict(fur=C(70, 110, 200), fur_light=C(240, 240, 250), fur_dark=C(40, 60, 130), hair=C(250, 200, 60), iris=C(250, 180, 40),
                                   horn=C(250, 190, 60))),
}


# teeth are their own swappable kind (fitted to every snout); chest tufts only on furry species
TEETH = ["fangs", "buck", "shark", "tusks", "snaggle"]
TEETH_OF = dict(bunny="buck", mouse="buck", bat="fangs", tiger="fangs", hyena="fangs", dragon="fangs", shark="shark")
NO_TUFT = {"shark", "dragon", "lizard"}
CHEEKS = ["spiky", "round", "fin"]
CHEEKS_OF = dict(bunny="round", mouse="round", bear="round", otter="round", redpanda="round", dragon="fin", shark="fin", lizard="none", bird="none")
for _sp, _R in SPECIES.items():
    _R.setdefault("teeth", TEETH_OF.get(_sp, "none"))
    _R.setdefault("tuft", _sp not in NO_TUFT)
    _R.setdefault("cheeks", CHEEKS_OF.get(_sp, "spiky"))


# ---------------------------------------------------------------- builders

class Kit:
    """Everything the builders need from build.py."""

    def __init__(self, **kw):
        self.__dict__.update(kw)


def skull_rings(K):
    CRANIUM = [(0.13, 0.005, 0.05, 0.06, 0.05), (0.1, 0.012, 0.098, 0.108, 0.095), (0.04, 0.012, 0.118, 0.125, 0.11), (-0.02, 0.0, 0.118, 0.115, 0.112),
               (-0.07, -0.008, 0.104, 0.1, 0.098), (-0.1, -0.012, 0.082, 0.078, 0.072)]
    return [A.ring(K.H0 + V((0, y, z)), (0, -1, 0), w, t, b, n=16, exp=3.0) for y, z, w, t, b in A.catmull(CRANIUM, 10)]


def build_skull(K, mesh):
    """The shared cranium: squarish, the same for every species."""
    mesh.loft(skull_rings(K), "fur", tip1=K.H0 + V((0, -0.118, -0.012)))


def snout_geo(K, sp):
    """Rows of a species snout (a separate piece sitting inside the skull, under the brow)."""
    S = dict(SNOUTS[sp])
    jw = K.TUNE["jaw"] if not S.get("jaw") else 1.0
    return S, [(y, z, w, t, b * jw) for y, z, w, t, b in S["rows"]]


def build_snout(K, mesh, sp):
    S, rows = snout_geo(K, sp)
    H0 = K.H0
    region = "horn" if S["nose"] == "beak" else "fur"
    body = A.catmull(rows, 4 * len(rows))
    y, z, w, t, b = rows[-1]
    # round the front off: a few shrinking rings rather than a flat cap
    cap = [(y - 0.012 * k, z + t * 0.05 * k, w * f, t * f, b * f) for k, f in ((1, 0.86), (2, 0.6))]
    rings = [A.ring(H0 + V((0, yy, zz)), (0, -1, 0), ww, tt, bb, n=12, exp=S["exp"]) for yy, zz, ww, tt, bb in body + cap]
    mesh.loft(rings, region, tip1=H0 + V((0, y - 0.03, z + t * 0.12)))
    mesh.jaw_from = None
    if S.get("jaw"):   # a separate lower jaw tucked under the muzzle: the two-piece look, a clear mouth line
        mesh.jaw_from = len(mesh.bm.faces)
        jr = [(yy, zz - bb * 0.62, ww * 0.84, bb * 0.32, bb * 0.42) for yy, zz, ww, tt, bb in rows[:-1]]
        ye = rows[-2][0]
        mesh.loft([A.ring(H0 + V((0, yy, zz)), (0, -1, 0), ww, tt, bb, n=10, exp=S["exp"]) for yy, zz, ww, tt, bb in A.catmull(jr, 3 * len(jr))],
                  region, tip1=H0 + V((0, ye - 0.02, jr[-1][1])))
        mesh.jaw_to = len(mesh.bm.faces)
    if S["nose"] == "cat":   # cat muzzle: two round whisker puffs meeting under the nose (the W), and a small chin
        k = w / 0.048
        fy = y - 0.016   # just behind the rounded front
        for sd in (1, -1):
            c0 = H0 + V((sd * 0.026 * k, fy, z - 0.008 * k))
            mesh.loft([A.ring(c0 + V((0, 0.026 * k, 0)), (0, -1, 0), 0.022 * k, 0.018 * k, n=10),
                       A.ring(c0 + V((0, 0.008 * k, 0)), (0, -1, 0), 0.03 * k, 0.025 * k, n=10),
                       A.ring(c0 - V((0, 0.01 * k, 0)), (0, -1, 0), 0.024 * k, 0.02 * k, n=10)], "fur_light", tip1=c0 - V((0, 0.02 * k, 0)))
        c0 = H0 + V((0, fy + 0.012 * k, z - 0.036 * k))
        mesh.loft([A.ring(c0 + V((0, 0.02 * k, 0.004)), (0, -1, 0), 0.02 * k, 0.012 * k, n=8),
                   A.ring(c0, (0, -1, 0), 0.022 * k, 0.014 * k, n=8)], "fur_light", tip1=c0 - V((0, 0.014 * k, 0)))
    elif S.get("pads"):   # puffy whisker pads either side of the nose, and a little chin
        for sd in (1, -1):
            c0 = H0 + V((sd * w * 0.62, y + 0.01, z - b * 0.15))
            mesh.loft([A.ring(c0 + V((0, 0.03, 0)), (0, -1, 0), w * 0.62, b * 0.72, n=8), A.ring(c0, (0, -1, 0), w * 0.66, b * 0.76, n=8)], "fur",
                      tip1=c0 - V((0, 0.035, 0)))
        c0 = H0 + V((0, y + 0.02, z - b * 0.85))
        mesh.loft([A.ring(c0 + V((0, 0.02, 0.01)), (0, -1, 0.3), w * 0.5, b * 0.36, n=8)], "fur", tip1=c0 - V((0, 0.03, 0.0)))
    if S["nose"] == "beak":   # a hooked upper beak over the lower one
        mesh.loft([A.ring(H0 + V((0, -0.06, -0.02)), (0, -1, -0.3), 0.07, 0.045, 0.02, n=10, exp=2.4),
                   A.ring(H0 + V((0, -0.16, -0.05)), (0, -1, -0.6), 0.04, 0.028, 0.014, n=10, exp=2.4)], "horn", tip1=H0 + V((0, -0.23, -0.12)))
    return rows


def build_nose(K, mesh, sp, rows, surf):
    S = SNOUTS[sp]
    H0 = K.H0
    y, z, w, t, b = rows[-1]
    top = z + t
    kind = S["nose"]
    if kind == "dog":   # a big rounded nose pad capping the front of the muzzle (the front is rounded ~0.03 past the last row)
        nw = max(0.028, w * 0.6)
        y -= 0.026
        mesh.loft([A.ring(H0 + V((0, y + 0.03, top - 0.016)), (0, -1, 0.15), nw * 0.8, 0.02, 0.018, n=10, exp=2.2),
                   A.ring(H0 + V((0, y + 0.012, top - 0.014)), (0, -1, 0.15), nw, 0.025, 0.022, n=10, exp=2.2),
                   A.ring(H0 + V((0, y - 0.005, top - 0.018)), (0, -1, 0.15), nw * 0.86, 0.021, 0.019, n=10, exp=2.2)], "nose",
                  tip1=H0 + V((0, y - 0.014, top - 0.024)))
    elif kind == "cat":   # a bold inverted-triangle nose capping the top of the whisker puffs
        k = w / 0.048
        c = H0 + V((0, y - 0.025 * k, z + 0.014 * k))
        k = min(k, 1.05)
        fwd = V((0, -1, 0.55)).normalized()          # faces forward and a little up
        up = V((0, 0.55, 1)).normalized()
        side = V((1, 0, 0))

        def tri(c, sc):
            return [c + up * 0.012 * k * sc + side * 0.026 * k * sc, c - up * 0.016 * k * sc, c + up * 0.012 * k * sc - side * 0.026 * k * sc]
        mesh.loft([tri(c + fwd * 0.014 * k, 0.8), tri(c, 1.0), tri(c - fwd * 0.008 * k, 0.86)], "nose")
    elif kind == "bunny":
        # a chunky triangular nose sitting on top of the muzzle front
        nw = 0.03
        p0 = H0 + V((0, y - 0.016, top - 0.008))
        mesh.loft([A.ring(p0 + V((0, 0.02, 0.004)), (0, -1, 0.3), nw, 0.014, 0.012, n=3, roll=math.pi),
                   A.ring(p0, (0, -1, 0.3), nw * 0.9, 0.013, 0.011, n=3, roll=math.pi)], "nose", tip1=p0 + V((0, -0.008, -0.02)))
    elif kind in ("horse", "nostrils"):
        for sd in (1, -1):
            A.decal(mesh, surf, H0 + V((sd * w * 0.55, y - 0.1, z + t * 0.2)), V((-sd * 0.2, 1, -0.2)), A.disc(0.013, 8, 0.009), "nose", lift=0.003)
    elif kind == "leaf":   # bat: a pug nose with a little leaf
        mesh.loft([A.ring(H0 + V((0, y - 0.015, top - 0.01)), (0, -1, 0.3), 0.034, 0.024, 0.02, n=8)], "nose", tip1=H0 + V((0, y - 0.042, top - 0.012)))
        mesh.loft([A.ring(H0 + V((0, y - 0.025, top + 0.002)), (0, -0.3, 1), 0.016, 0.008, n=4)], "nose", tip1=H0 + V((0, y - 0.03, top + 0.035)))


def build_mouth(K, mesh, sp, rows, surf):
    if SNOUTS[sp]["nose"] == "beak":
        return
    H0 = K.H0
    if SNOUTS[sp]["nose"] == "cat":
        y, z, w, t, b = rows[-1]
        k = w / 0.048
        fy = y - 0.04 * k
        out = lambda p: V((0, -1, 0.1)).normalized()
        A.strip(mesh, surf, [H0 + V((0, fy, z + 0.0 * k)), H0 + V((0, fy, z - 0.018 * k))], out, 0.007 * k, "mouth", lift=0.003)
        for sd in (1, -1):
            pts = [H0 + V((0, fy, z - 0.018 * k)), H0 + V((sd * 0.016 * k, fy + 0.006 * k, z - 0.026 * k)),
                   H0 + V((sd * 0.034 * k, fy + 0.016 * k, z - 0.024 * k)), H0 + V((sd * 0.05 * k, fy + 0.03 * k, z - 0.016 * k))]
            A.strip(mesh, surf, pts, lambda p, sd=sd: V((sd * 0.5, -1, 0.1)).normalized(), 0.007 * k, "mouth", lift=0.003)
        return
    for sd in (1, -1):   # a closed mouth line along each side of the jaw
        pts = []
        for f in (1.0, 0.85, 0.6, 0.3):
            y, z, w, t, b = rows[min(len(rows) - 1, int(round(f * (len(rows) - 1))))]
            pts.append(H0 + V((sd * w * (0.15 + 0.6 * (1 - f)), y + 0.004, z - b * 0.5)))
        A.strip(mesh, surf, pts, lambda p, sd=sd: V((-sd * 0.8, 0.1, 0.2)).normalized(), 0.012 if sp == "shark" else 0.008, "mouth", lift=0.003)


JAW_PIVOT = (0.0, -0.07)   # (y, z) from the head centre: the jaw hinge, shared by every head (the "jaw" bone)


def jaw_plane(K, sp):
    """The mouth's cut plane for a snout: through the shared hinge and the front of the mouth line."""
    S, rows = snout_geo(K, sp)
    y, z, w, t, b = rows[-1]
    k = w / 0.048
    zm = (z - 0.026 * k) if S["nose"] == "cat" else (z - b * 0.5)
    p0 = K.H0 + V((0, JAW_PIVOT[0], JAW_PIVOT[1]))
    p1 = K.H0 + V((0, y - 0.03, zm))
    d = (p1 - p0).normalized()
    n = V((0, d.z, -d.y)).normalized()   # perpendicular in the side plane, pointing up
    return p0, n, rows


def split_jaw(K, mesh, sp):
    """Cut the head along the mouth line so the lower jaw can open on the "jaw" bone: bisect the
    snout and the chin forward of the hinge, split the cut so the halves come apart, tag the
    lower half's vertices "jaw", and cap both halves with dark faces so an open mouth reads as a
    mouth, not a hollow shell."""
    p0, n, rows = jaw_plane(K, sp)
    bm = mesh.bm
    lim = p0.y + 0.006
    faces = [f for f in bm.faces if all(v.co.y < lim for v in f.verts)]
    geom = list({e for f in faces for e in f.edges}) + list({v for f in faces for v in f.verts}) + faces
    res = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=p0, plane_no=n, dist=1e-5)
    cut = [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
    if cut:
        bmesh.ops.split_edges(bm, edges=cut)
    jaw = mesh.parts.index("jaw") if "jaw" in mesh.parts else (mesh.parts.append("jaw") or len(mesh.parts) - 1)
    for v in bm.verts:
        if v.co.y >= lim:
            continue
        dsg = (v.co - p0).dot(n)
        if dsg < -1e-5 or (abs(dsg) <= 1e-5 and v.link_faces and
                            sum((f.calc_center_median() - p0).dot(n) for f in v.link_faces) < 0):
            v[mesh.part] = jaw
    # close both halves along the cut with dark caps: each half stays a solid (so the outline shell has no
    # open edge to catch), and the caps are the inside of the mouth when the jaw opens
    on_cut = [e for e in bm.edges if e.is_boundary and all(v.co.y < lim and abs((v.co - p0).dot(n)) < 2e-4 for v in e.verts)]
    if on_cut:
        res = bmesh.ops.holes_fill(bm, edges=on_cut, sides=0)
        for f in res["faces"]:
            f[mesh.reg] = A.REGIONS.index("mouth")


def build_teeth(K, mesh, style, sp, surf):
    """One teeth style fitted to one snout: found by casting onto that snout's head, so
    every style sits on the mouth of every head. Chunky, readable on a small screen."""
    S, rows = snout_geo(K, sp)
    H0 = K.H0
    y, z, w, t, b = rows[-1]
    cat = S["nose"] == "cat"
    k = w / 0.048
    zm = (z - 0.026 * k) if cat else (z - b * 0.5)   # the mouth line at the front
    yf = y - (0.03 * k if cat else 0.018)            # roughly the front of the mouth

    def side_hit(sd, yy, zz):
        h = surf.hit(H0 + V((sd * 0.5, yy, zz)), V((-sd, 0, 0)))
        return h or (H0 + V((sd * w * 0.8, yy, zz)), V((sd, 0, 0)))

    def front_hit(x, zz):
        h = surf.hit(H0 + V((x, -0.7, zz)), V((0, 1, 0)))
        return h or (H0 + V((x, yf, zz)), V((0, -1, 0)))

    def fang(base, n, down, ln, wd):   # a chunky cone, its root sunk into the lip
        r0 = base - n * 0.004
        d = (down + n * 0.18).normalized()
        mesh.loft([A.ring(r0 - d * 0.006, d, wd, wd * 0.8, n=4), A.ring(r0 + d * ln * 0.45, d, wd * 0.8, wd * 0.65, n=4)], "eye_white",
                  tip1=r0 + d * ln)

    def fang_y():   # where along the snout a canine sits: just behind the front
        return yf + (0.01 * k if cat else 0.014)

    if style in ("fangs", "snaggle"):
        for sd in ((1, -1) if style == "fangs" else (-1,)):   # snaggle: on the character's right (the side a 3/4 view shows)
            p, n = side_hit(sd, fang_y(), zm + 0.004)
            fang(p, n, V((0, 0, -1)), 0.042 * max(1.0, k * 0.9), 0.013)
    elif style == "tusks":   # lower canines pointing up past the upper lip
        for sd in (1, -1):
            p, n = side_hit(sd, fang_y() + 0.012, zm - 0.006)
            fang(p, n, V((0, 0, 1)), 0.042, 0.014)
    elif style == "buck":    # two big front incisors
        for sd in (1, -1):
            p, n = front_hit(sd * 0.0105, zm + 0.004)
            r0 = p - n * 0.004
            mesh.loft([A.ring(r0, (0, 0, -1), 0.0095, 0.005, n=4, up=(0, -1, 0), flat=True),
                       A.ring(r0 + V((0, 0, -0.032)), (0, 0, -1), 0.0095, 0.005, n=4, up=(0, -1, 0), flat=True)], "eye_white")
    elif style == "shark":   # a row of triangles round the mouth, front to back
        ys = [yf + 0.004 + i * (0.022 if not cat else 0.014) for i in range(5)]
        for sd in (1, -1):
            for i, yy in enumerate(ys):
                fr = i / 4
                zz = zm + 0.002 + fr * (rows[0][1] - rows[-1][1]) * 0.6
                p, n = side_hit(sd, yy, zz)
                tw, tl = 0.011, 0.027 - 0.008 * fr
                r0 = p - n * 0.003
                along = V((0, 1, 0))
                tri = lambda c: [c - along * tw, c + along * tw, c + V((0, 0, -tl))]  # noqa: E731
                mesh.loft([tri(r0), tri(r0 + n * 0.006)], "eye_white")
        for sd in (1, -1):   # and two at the front
            p, n = front_hit(sd * 0.012, zm + 0.002)
            r0 = p - n * 0.003
            side = V((1, 0, 0))
            tri = lambda c: [c - side * 0.011, c + side * 0.011, c + V((0, 0, -0.027))]  # noqa: E731
            mesh.loft([tri(r0), tri(r0 + n * 0.006)], "eye_white")


def face_paint(K, mesh, mask, start):
    """Snout markings. Only the snout piece's faces (index >= start) are painted, so the
    colour edge runs along the fine snout rings and the snout/skull seam, never as
    stairs across the coarse skull. Markings elsewhere on the head are decals (face_marks)."""
    H0 = K.H0
    faces = list(mesh.bm.faces)
    jaw = set(faces[mesh.jaw_from:mesh.jaw_to]) if getattr(mesh, "jaw_from", None) is not None else set()

    def sides(f, q, n):        # wolf-style: the top of the snout keeps the fur colour, the sides and underside go light
        return "fur_light" if n.z < 0.35 else None

    def catface(f, q, n):
        return "fur_light" if q.y < -0.1 and q.z < -0.05 and n.z < 0.3 else None

    def all_light(f, q, n):
        return "fur_light"

    def all_dark(f, q, n):
        return "fur_dark"

    def jaw_light(f, q, n):
        return "fur_light" if f in jaw or n.z < -0.25 else None

    fn = dict(muzzle=sides, husky=sides, raccoon=sides, redpanda=all_light, catface=catface, blaze=None, snout_light=all_light,
              snout_dark=all_dark, jaw_light=jaw_light, none=None)[mask]
    if not fn:
        return
    bmesh.ops.recalc_face_normals(mesh.bm, faces=[f for f in faces[start:] if f not in mesh.decals])
    for f in faces[start:]:
        if f in mesh.decals or f[mesh.reg] in (A.REGIONS.index("nose"), A.REGIONS.index("mouth")):
            continue
        r = fn(f, f.calc_center_median() - H0, f.normal)
        if r:
            f[mesh.reg] = A.REGIONS.index(r)


def face_marks(K, mesh, mask, surf, rows):
    """Markings on the skull as projected patches (clean curved edges): eye masks, brows, blazes."""
    H0 = K.H0

    def ellipse(w, h, dx=0.0, dy=0.0, n=16):
        return [(dx + w * math.cos(2 * math.pi * k / n), dy + h * math.sin(2 * math.pi * k / n)) for k in range(n)]

    def at_eye(sd, outline, region, up=0.0, lift=0.0016):   # centred on the eye (same ray the eyes use), shifted up/down
        A.patch(mesh, surf, H0 + V((sd * 0.15, -0.19, 0.035 + up)), V((-sd * 0.62, 0.78, -0.03)), outline, region, lift=lift)

    if mask == "husky":   # the white mask around the eyes, and a dark forehead diamond
        for sd in (1, -1):
            at_eye(sd, ellipse(0.085, 0.055, 0.0, -0.03), "fur_light")   # big enough to show round the eye shapes
            at_eye(sd, ellipse(0.024, 0.016), "fur_light", up=0.06)      # the husky brow dots
        A.patch(mesh, surf, H0 + V((0, -0.3, 0.07)), V((0, 1, -0.1)), [(0, 0.05), (0.024, 0.0), (0, -0.035), (-0.024, 0.0)], "fur_dark", lift=0.0018)
    elif mask == "raccoon":   # the bandit mask, with white brows over it
        for sd in (1, -1):
            at_eye(sd, ellipse(0.075, 0.038, 0.0, -0.006), "fur_dark")
            at_eye(sd, ellipse(0.05, 0.016), "fur_light", up=0.055)
    elif mask == "redpanda":   # white brow patches and dark tear marks running down the cheeks
        for sd in (1, -1):
            at_eye(sd, ellipse(0.045, 0.022), "fur_light", up=0.058)
            at_eye(sd, ellipse(0.02, 0.045), "fur_dark", up=-0.06)
    elif mask == "blaze":   # a white stripe from the forehead down the top of the snout
        y, z, w, t, b = rows[-1]
        pts = [H0 + V((0, -0.06, 0.13)), H0 + V((0, -0.13, 0.06)), H0 + V((0, -0.18, z + t + 0.01))]
        pts += [H0 + V((0, yy - 0.01, zz + tt)) for yy, zz, ww, tt, bb in rows[2:]]
        A.strip(mesh, surf, pts, lambda p: V((0, 0.25, -1)).normalized(), 0.065, "fur_light", lift=0.0016)


def build_cheeks(K, mesh, style):
    """Cheek tufts, a swappable part on the shared skull (fits every head).
    spiky: two chunky pointed tufts per side. round: two puffy rounded lobes per side.
    fin: a flat three-spined frill per side (dragons, sharks, aquatic types)."""
    H0 = K.H0
    for sd in (1, -1):
        if style == "spiky":
            for y, z, ln, w, up, dx in ((-0.01, -0.01, 0.12, 0.08, 0.3, 0.085), (0.01, -0.055, 0.11, 0.075, -0.1, 0.08)):
                b0 = H0 + V((sd * dx, y, z))
                d = V((sd * 0.55, 0.85, up)).normalized()
                mesh.loft([A.ring(b0, d, w, w * 0.42, n=6, up=(sd, 0, 0), roll=0), A.ring(b0 + d * ln * 0.55, d, w * 0.78, w * 0.34, n=6, up=(sd, 0, 0), roll=0)],
                          "fur_light", tip1=b0 + d * ln)
        elif style == "round":   # puffy rounded lobes, blunt ends, overlapping like a scalloped ruff
            for y, z, ln, w, up, dx in ((-0.015, -0.005, 0.1, 0.06, 0.25, 0.08), (0.01, -0.06, 0.095, 0.058, -0.15, 0.078)):
                b0 = H0 + V((sd * dx, y, z))
                d = V((sd * 0.6, 0.8, up)).normalized()
                prof = [(0.0, 0.75), (0.35, 1.0), (0.65, 0.95), (0.88, 0.7), (1.0, 0.3)]
                mesh.loft([A.ring(b0 + d * ln * f, d, w * r, w * r * 0.62, n=8, up=(sd, 0, 0)) for f, r in prof], "fur_light",
                          tip1=b0 + d * ln * 1.04)
        elif style == "fin":     # a flat frill, three spines, rooted in the cheek, swept back
            b0 = H0 + V((sd * 0.085, 0.0, -0.03))
            u = V((sd * 0.75, 0.62, 0.05)).normalized()
            v = (V((0, 0, 1)) - u * u.z).normalized()
            n = u.cross(v).normalized()
            shape = [(-0.03, 0.04), (0.08, 0.085), (0.065, 0.035), (0.135, 0.022), (0.09, -0.01), (0.11, -0.06), (-0.03, -0.035)]
            th = 0.009
            ring_ = lambda o: [b0 + (u * a + v * c) * 1.3 + n * o for a, c in shape]  # noqa: E731
            mesh.loft([ring_(-th), ring_(th)], "fur_dark")


def build_extras(K, mesh, extras, surf):
    H0 = K.H0

    def on_skull(yaw, pitch, lift=0.0):
        yw, pt = math.radians(yaw), math.radians(pitch)
        d = V((math.sin(yw) * math.cos(pt), -math.cos(yw) * math.cos(pt), math.sin(pt)))
        hit = surf.hit(H0 + d * 0.6, -d)
        return (hit[0] + hit[1] * lift, hit[1]) if hit else (H0 + d * 0.12, d)

    def chunk(path, w, t, region, n=6):
        pts = [V(p) for p in path]
        rings = [A.ring(p, pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)], w * (1 - 0.3 * i / max(1, len(pts) - 2)), t, n=n, up=(0, 0, 1))
                 for i, p in enumerate(pts[:-1])]
        mesh.loft(rings, region, tip1=pts[-1])

    for ex in extras:
        if ex == "antlers":
            for sd in (1, -1):
                b = on_skull(sd * 30, 58, -0.01)[0]
                main = [b, b + V((sd * 0.05, 0.03, 0.12)), b + V((sd * 0.12, 0.06, 0.22)), b + V((sd * 0.16, 0.05, 0.32))]
                chunk(main, 0.022, 0.022, "horn")
                chunk([main[1], main[1] + V((-sd * 0.02, -0.06, 0.08))], 0.016, 0.016, "horn")
                chunk([main[2], main[2] + V((sd * 0.07, -0.04, 0.05))], 0.015, 0.015, "horn")
        elif ex == "dragon_horns":
            for sd in (1, -1):
                b = on_skull(sd * 28, 55, -0.01)[0]
                chunk([b, b + V((sd * 0.03, 0.08, 0.06)), b + V((sd * 0.05, 0.2, 0.08))], 0.032, 0.032, "horn")
        elif ex == "goat_horns":
            for sd in (1, -1):
                b = on_skull(sd * 24, 60, -0.01)[0]
                chunk([b, b + V((sd * 0.02, 0.06, 0.08)), b + V((sd * 0.05, 0.16, 0.06)), b + V((sd * 0.07, 0.2, -0.04))], 0.03, 0.026, "horn")
        elif ex == "mane":   # a lion ruff: two rings of big flat petals framing the face (front light, back dark), and lobes over the back
            hc = H0 + V((0, 0.035, -0.02))

            def petal(a, y0, r0, ln, w, t, region, sweep):
                r = V((math.sin(a), 0, math.cos(a)))
                b = hc + V((0, y0, 0)) + r * r0
                d = (r + V((0, sweep, 0))).normalized()
                mesh.loft([A.ring(b, d, w, t, n=6, up=(0, 1, 0)), A.ring(b + d * ln * 0.55, d, w, t * 0.9, n=6, up=(0, 1, 0)),
                           A.ring(b + d * ln * 0.88, d, w * 0.62, t * 0.6, n=6, up=(0, 1, 0))], region, tip1=b + d * ln)
            for i in range(12):   # back ring: longer, dark, offset half a step
                a = math.radians(15 + 30 * i)
                low = max(0.0, -math.cos(a))   # shorter under the chin so it sits on the chest
                petal(a, 0.045, 0.08, 0.19 - 0.07 * low, 0.075, 0.05, "fur_dark", 0.35)
            for i in range(12):   # front ring: shorter, the hair colour, just behind the cheek tufts
                a = math.radians(30 * i)
                low = max(0.0, -math.cos(a))
                if abs(math.degrees(a) % 360 - 180) > 150 or 30 < math.degrees(a) < 60 or 300 < math.degrees(a) < 330:
                    continue   # leave the ears clear
                petal(a, 0.01, 0.085, 0.15 - 0.05 * low, 0.07, 0.045, "hair", 0.15)
            for yw, pitch in ((150, 55), (210, 55), (180, 20), (140, 10), (220, 10), (180, -20)):
                b, nrm = on_skull(yw, pitch, -0.02)
                d = (nrm + V((0, 0.6, -0.3))).normalized()
                chunk([b, b + d * 0.07, b + d * 0.13], 0.08, 0.035, "fur_dark", n=4)
        elif ex == "tiger_stripes":   # bold tapered stripes: three down the forehead, bands over the crown and cheeks
            def wedge(L, W, bend=0.0):
                return [(-W, L * 0.5), (W, L * 0.5), (W * 0.5 + bend, 0.0), (bend, -L * 0.5), (-W * 0.5 + bend, 0.0)]

            def stripe(yaw, pitch, outline, up=(0, 0, 1)):
                yw, pt = math.radians(yaw), math.radians(pitch)
                d = V((math.sin(yw) * math.cos(pt), -math.cos(yw) * math.cos(pt), math.sin(pt)))
                A.decal(mesh, surf, H0 + d * 0.6, -d, outline, "fur_dark", lift=0.003, up=up)
            stripe(0, 44, wedge(0.07, 0.016))
            for sd in (1, -1):
                stripe(sd * 20, 42, wedge(0.06, 0.014, sd * 0.004))
                for yaw, pitch, L in ((55, 48, 0.09), (90, 38, 0.09), (118, 30, 0.08)):   # crown bands, running down the side (small enough to hug the skull)
                    stripe(sd * yaw, pitch, wedge(L, 0.018))
                for pitch in (12, -14):   # cheek bars pointing at the muzzle
                    stripe(sd * 78, pitch, [(sd * 0.045, 0.012), (sd * 0.045, -0.012), (-sd * 0.03, 0.0)])
        elif ex == "horse_mane":
            for k, pitch in enumerate((80, 60, 40, 20, 0, -20)):
                b, nrm = on_skull(180 if pitch < 85 else 0, pitch, -0.02)
                d = (nrm + V((0.25 * (1 if k % 2 else -1), 0.5, -0.2))).normalized()
                chunk([b, b + d * 0.08, b + d * 0.14], 0.06, 0.045, "hair")
            b, nrm = on_skull(0, 80, -0.02)   # a forelock between the ears
            chunk([b, b + V((0.0, -0.05, 0.02)), b + V((0.02, -0.1, -0.03))], 0.055, 0.04, "hair")
        elif ex == "hyena_mane":
            for pitch in (70, 45, 20, -5):
                b, nrm = on_skull(180, pitch, -0.02)
                chunk([b, b + (nrm + V((0, 0.2, 0.4))).normalized() * 0.09], 0.05, 0.035, "hair")
        elif ex == "whisker_pads":   # big round puffy whisker pads
            for sd in (1, -1):
                c0 = H0 + V((sd * 0.05, -0.135, -0.06))
                mesh.loft([A.ring(c0 + V((0, 0.02, 0)), (0, -1, 0), 0.05, 0.045, n=8), A.ring(c0 - V((0, 0.02, 0)), (0, -1, 0), 0.045, 0.04, n=8)],
                          "fur_light", tip1=c0 - V((0, 0.04, 0)))
        elif ex == "beard":
            b = H0 + V((0, -0.17, -0.12))
            chunk([b, b + V((0, -0.02, -0.08)), b + V((0, 0.0, -0.13))], 0.04, 0.03, "fur_light")
        elif ex == "teeth":
            S, rows = snout_geo(K, "bunny")
            y, z, w, t, b = rows[-1]
            for sd in (1, -1):
                p = H0 + V((sd * 0.012, y + 0.002, z - b * 0.7))
                mesh.loft([A.ring(p, (0, 0, -1), 0.011, 0.004, n=4), A.ring(p + V((0, 0, -0.022)), (0, 0, -1), 0.011, 0.004, n=4)], "eye_white")
        elif ex == "fangs":
            for sd in (1, -1):
                p = H0 + V((sd * 0.035, -0.135, -0.1))
                mesh.loft([A.ring(p, (0, 0, -1), 0.01, 0.008, n=4)], "eye_white", tip1=p + V((0, 0, -0.03)))
        elif ex == "spikes":   # chunky spines down the back of the head
            for k, pitch in enumerate((70, 45, 20)):
                b, nrm = on_skull(180, pitch, -0.01)
                chunk([b, b + (nrm + V((0, 0.5, 0.2))).normalized() * (0.07 - 0.012 * k)], 0.026, 0.012, "horn", n=4)
        elif ex == "head_fin":
            b, nrm = on_skull(180, 60, -0.02)
            mesh.loft([A.ring(b, (0, 0.7, 1), 0.012, 0.08, n=4, up=(0, 1, 0)), A.ring(b + V((0, 0.06, 0.06)), (0, 0.7, 1), 0.01, 0.05, n=4, up=(0, 1, 0))],
                      "fur", tip1=b + V((0, 0.13, 0.1)))
        elif ex == "crest":   # a chunky feather crest
            for k, yw in enumerate((-12, 0, 12)):
                b, nrm = on_skull(yw, 70, -0.01)
                chunk([b, b + V((yw * 0.002, 0.04, 0.08)), b + V((yw * 0.003, 0.1, 0.14 - abs(yw) * 0.002))], 0.04, 0.02, "hair")


def ear_points(K, spec, sd):
    H0 = K.H0
    L, sp, ln_ = spec["len"], math.radians(spec["splay"]), math.radians(spec["lean"])
    base = H0 + V((sd * 0.06, 0.03, 0.06))
    d = V((sd * math.sin(sp), math.sin(ln_), math.cos(sp) * math.cos(ln_))).normalized()
    if spec["shape"] == "lop":   # floppy: up over the skull then hanging down beside the face
        b2 = H0 + V((sd * 0.1, 0.03, 0.07))
        return [b2, b2 + V((sd * 0.06, -0.005, 0.0)), b2 + V((sd * 0.09, -0.01, -0.1)), b2 + V((sd * 0.09, -0.012, -0.21))]
    curl = V((-sd * spec["curl"], 0, 0))
    return [base, base + d * L * 0.45, base + d * L * 0.75 + curl * 0.5, base + d * L + curl]


def build_ears(K, mesh, name):
    spec = EARS[name]
    if spec is None:
        return
    for sd in (1, -1):
        pts = ear_points(K, spec, sd)
        face = V((sd * 0.55, -1, 0)).normalized()
        if spec["shape"] in ("leaf", "lop", "fin"):
            face = V((0, -0.3, 1)).normalized() if spec["shape"] != "lop" else V((sd, 0, 0))
        w, t = spec["w"], spec["t"]
        if spec["shape"] == "round":
            wid = [(w, t, t), (w * 1.05, t, t), (w * 0.8, t * 0.9, t * 0.9)]
        elif spec["shape"] == "long":
            wid = [(w * 0.8, t, t), (w * 1.1, t, t), (w * 0.85, t * 0.9, t * 0.9)]
        elif spec["shape"] == "fin":
            wid = [(w, t, t), (w * 0.8, t, t), (w * 0.5, t, t)]
        else:
            wid = [(w, t, t * 1.1), (w * 0.82, t * 0.85, t * 0.95), (w * 0.52, t * 0.6, t * 0.6)]
        rs = [A.ring(p, pts[min(i + 1, 3)] - pts[max(i - 1, 0)], a, f, bk, n=8 if spec["shape"] == "round" else 6, up=face)
              for i, (p, (a, f, bk)) in enumerate(zip(pts[:3], wid))]
        tip = pts[3] if spec["shape"] != "round" else pts[2] + (pts[3] - pts[2]) * 0.4
        mesh.loft(rs, "fur", tip1=tip)
        if spec["shape"] in ("fin", "lop"):
            continue
        off = face * (t * 0.9)
        mesh.loft([A.ring(pts[0].lerp(pts[1], 0.45) + off, pts[1] - pts[0], w * 0.6, 0.012, n=4, up=face),
                   A.ring(pts[1] + off, pts[2] - pts[0], w * 0.52, 0.012, n=4, up=face)], "inner_ear", tip1=pts[1].lerp(tip, 0.7) + off * 0.7)


def build_tail(K, mesh, name):
    spec = TAILS[name]
    if spec is None:
        return
    root = V((0, 0.12, 0.99 - K.TUNE["tail_drop"] * 0.0))
    sc = 0.85
    if spec.get("puff"):
        r = spec["puff"]
        mesh.loft([A.ring(root - V((0, 0.06, 0)), (0, 1, 0), r * 0.7, r * 0.7, n=8), A.ring(root + V((0, 0.06, 0.01)), (0, 1, 0), r, r, n=8),
                   A.ring(root + V((0, 0.16, 0.01)), (0, 1, 0), r * 0.75, r * 0.75, n=8)], "fur_light", tip1=root + V((0, 0.2, 0.01)))
        return
    if spec.get("feathers"):
        for k, ang in enumerate((-40, -20, 0, 20, 40)):
            a = math.radians(ang)
            d = V((math.sin(a) * 0.6, 1, -0.5)).normalized()
            mesh.loft([A.ring(root - d * 0.07, d, 0.03, 0.012, n=4, up=(0, 0, 1)), A.ring(root + d * 0.18, d, 0.06, 0.012, n=4, up=(0, 0, 1))],
                      "fur" if k % 2 else "fur_dark", tip1=root + d * 0.34)
        return
    # the root starts well inside the hips at full thickness, so the tail is buried in the body, not stuck on its surface
    thick = spec["r"][0] >= 0.1 or name in ("dragon", "lizard", "kangaroo", "shark", "otter")   # heavy reptile/kangaroo tails: attach lower, no flare (or they wedge up the back)
    if thick:   # (from the rump, below the waist: the base's height would otherwise reach up the back)
        root = root + V((0, 0.02, -0.13))
    ctrl = [root + V((0, -0.09, 0.015 if not thick else -0.03))] + [root + V((x * sc, y * sc, z * sc)) for x, y, z in spec["pts"]]
    n_r = (9 if spec.get("short") else 15) + 3
    pts = A.catmull(ctrl, n_r)
    r0, r1 = spec["r"]
    out = [i for i, p in enumerate(pts) if V(p).y >= root.y]
    i0 = out[0] if out else 0
    rings = []
    for i, p in enumerate(pts):
        t = max(0.0, (i - i0) / max(1, n_r - 1 - i0))
        if spec.get("taper"):
            r = r0 * (1 - t) ** 0.9 + r1
        else:
            r = r0 + (r1 - r0) * math.sin(math.pi * min(1.0, t * 1.05)) ** 0.75
            if spec.get("tuft") and t > 0.8:
                r = r0 + (0.07 - r0) * math.sin(math.pi * (t - 0.8) / 0.2 * 0.5 + 0.0)
        if t < 0.18 and not thick:   # a thick root that flares into the hips (thicker still inside the body)
            r *= 1 + 0.7 * (1 - t / 0.18) ** 1.5
        if spec["jag"] and 0 < i < n_r - 1 and i % 2:
            r *= 1 - spec["jag"]
        tan = V(pts[min(i + 1, n_r - 1)]) - V(pts[max(i - 1, 0)])
        if spec.get("plume"):   # a flat fan of hair: wide side to side, slim front to back, widest two thirds down
            wv = 0.05 + 0.11 * math.sin(math.pi * min(1.0, t * 1.15)) ** 0.8
            rings.append(A.ring(p, tan, wv, wv * 0.45, n=8, up=(0, 1, 0), roll=0.0))
        else:
            rings.append(A.ring(p, tan, r, r * 0.92, n=8, up=(0, 0, 1), roll=0.39 * (i % 2)))
    mesh.tail_path, mesh.tail_i0 = [V(p) for p in pts], i0   # skinned along its own length (see anthro.skin_path)
    region = "hair" if spec.get("hair") else ("pads" if spec.get("pink") else "fur")
    mesh.loft(rings, region, tip1=V(pts[-1]) + (V(pts[-1]) - V(pts[-2])).normalized() * (0.06 if not spec.get("taper") else 0.03))
    if spec.get("under"):
        mesh.paint(lambda c, n, r: "fur_light" if n.z < -0.15 else None)
    if spec.get("tip"):
        cut = V(pts[int(i0 + (n_r - 1 - i0) * spec["tip"])])
        d = (V(pts[-1]) - cut)
        mesh.paint(lambda c, n, r: "fur_light" if (c - cut).dot(d) > 0 else None)
    if spec.get("tuft"):
        cut = V(pts[int(i0 + (n_r - 1 - i0) * 0.8)])
        d = (V(pts[-1]) - cut)
        mesh.paint(lambda c, n, r: "hair" if (c - cut).dot(d) > 0 else None)
    if spec.get("rings"):
        k = spec["rings"]
        seg = [V(p) for p in pts]

        def band(c, n, r):
            best = min(range(n_r), key=lambda i: (seg[i] - c).length)
            return "fur_dark" if int(max(0, best - i0) / (n_r - 1 - i0) * k) % 2 else None
        mesh.paint(band)
    if spec.get("spines"):
        for i in range(i0 + 1, n_r - 2, 2):
            t = (i - i0) / (n_r - 1 - i0)
            r = r0 * (1 - t) ** 0.9 + r1
            b = V(pts[i]) + V((0, 0, r * 0.8))
            mesh.loft([A.ring(b, (0, 0.3, 1), 0.018, r * 0.5 + 0.015, n=4, up=(0, 1, 0))], "horn", tip1=b + V((0, 0.05, r * 0.7 + 0.04)))
    if spec.get("fluke"):
        end = V(pts[-1])
        for d in (V((0.1, 0.18, 0.3)), V((0.06, 0.12, -0.2))):
            mesh.loft([A.ring(end, d, 0.022, 0.07, n=4, up=(0, 1, 0))], "fur", tip1=end + d)


def build_feet(K, mesh, kind, s, sd):
    """Feet for one leg, rigid to the toes bone. `paws` are built by build.py (with the claws part)."""
    J = K.J
    b = J[f"ball.{s}"]
    if kind == "hooves":   # a single big rounded hoof with a fetlock tuft above it
        c = V((b.x, b.y - 0.02, 0.0))
        mesh.loft([A.ring(c + V((0, 0, 0.11)), (0, 0, -1), 0.082, 0.09, 0.076, n=12, exp=2.2, up=(0, -1, 0)),
                   A.ring(c + V((0, -0.01, 0.05)), (0, 0, -1), 0.094, 0.104, 0.086, n=12, exp=2.2, up=(0, -1, 0)),
                   A.ring(c + V((0, -0.015, 0.004)), (0, 0, -1), 0.1, 0.112, 0.09, n=12, exp=2.2, up=(0, -1, 0))], "horn")
        mesh.loft([A.ring(c + V((0, 0.005, 0.16)), (0, 0, -1), 0.095, 0.1, 0.09, n=10, up=(0, -1, 0)),
                   A.ring(c + V((0, 0.0, 0.1)), (0, 0, -1), 0.11, 0.116, 0.104, n=10, up=(0, -1, 0))], "fur_light")
    elif kind == "cloven":   # two hoof halves
        for k in (-1, 1):
            c = V((b.x + k * 0.042, b.y - 0.03, 0.0))
            mesh.loft([A.ring(c + V((0, 0.01, 0.1)), (0, 0, -1), 0.04, 0.07, 0.05, n=8, exp=2.2, up=(0, -1, 0)),
                       A.ring(c + V((0, -0.01, 0.004)), (0, 0, -1), 0.048, 0.09, 0.056, n=8, exp=2.2, up=(0, -1, 0))], "horn", tip1=c + V((0, -0.11, 0.004)))
        c = V((b.x, b.y - 0.01, 0.0))
        mesh.loft([A.ring(c + V((0, 0.0, 0.15)), (0, 0, -1), 0.088, 0.09, 0.08, n=10, up=(0, -1, 0)),
                   A.ring(c + V((0, -0.01, 0.09)), (0, 0, -1), 0.1, 0.104, 0.09, n=10, up=(0, -1, 0))], "fur")
    elif kind in ("talons", "reptile"):   # long scaly toes with big claws (and a back toe for birds)
        toes = ((-0.05, -0.25), (0.0, 0.0), (0.05, 0.25)) if kind == "talons" else ((-0.06, -0.3), (0.0, 0.0), (0.06, 0.3))
        region = "horn" if kind == "talons" else "fur_dark"
        r = 0.032 if kind == "talons" else 0.042
        for dx, ang in toes:
            d = V((sd * math.sin(ang), -math.cos(ang), 0)).normalized()
            base = V((b.x + sd * dx, b.y + 0.02, r + 0.002))
            ln = 0.2 if kind == "talons" else 0.17
            pts = [base, base + d * ln * 0.5 + V((0, 0, r * 0.2)), base + d * ln]
            mesh.loft([A.ring(p, d, r * (1 - 0.25 * i), r * (1 - 0.25 * i), n=8, up=(0, 0, 1)) for i, p in enumerate(pts)], region)
            tipc = pts[-1]
            mesh.loft([A.ring(tipc, d + V((0, 0, -0.3)), r * 0.6, r * 0.5, n=5, up=(0, 0, 1))], "claws", tip1=tipc + (d + V((0, 0, -0.5))).normalized() * 0.06)
        if kind == "talons":
            base = V((b.x, b.y + 0.04, 0.03))
            mesh.loft([A.ring(base, (0, 1, -0.2), 0.026, 0.026, n=8, up=(0, 0, 1)), A.ring(base + V((0, 0.08, -0.01)), (0, 1, -0.2), 0.02, 0.02, n=8, up=(0, 0, 1))],
                      region)
            mesh.loft([A.ring(base + V((0, 0.08, -0.01)), (0, 1, -0.5), 0.016, 0.014, n=5, up=(0, 0, 1))], "claws", tip1=base + V((0, 0.13, -0.03)))
        # a scaly pad joining the toes to the cannon
        mesh.loft([A.ring(V((b.x, b.y + 0.03, 0.09)), (0, 0, -1), 0.07, 0.06, 0.06, n=10, up=(0, -1, 0)),
                   A.ring(V((b.x, b.y + 0.0, 0.03)), (0, 0, -1), 0.075, 0.07, 0.06, n=10, up=(0, -1, 0))], region)
