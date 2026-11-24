"""Bolt-On Racers: bolt-ons, the driver, decals, damage bits and debris.

Bolt-ons are authored at M size with the snap point at the origin, facing the
snap's outward direction:
  front  -> extends toward -y          rear   -> sits on the deck, rises +z
  tail   -> points +y                  exhaust-> points +y (right side mirrored)
  side   -> extends +x (right mirrored) roof / hood / mast -> rises +z
The assembler scales them by the chassis class (S 0.86, M 1, L 1.15).
"""
import math
import random

from rk import (C, V, at, box, cyl, cone, ell, lathe, torus, loft, tube, slab, tbox, xslab, rod, star, spring, cast,
                RED, YEL, TEAL, BLUE, WHITE, ORANGE, CHAR, TYRE, BLACK, CHROME, STEEL, GLASS, VISOR, LAMP, TAN,
                PINK, MET, GLOSS, shade, wheel)

FLAME_O, FLAME_I = C(255, 120, 30), C(255, 226, 90)


def flame_jet(L, r):
    """Cartoon exhaust flame pointing +y from the origin."""
    lathe([(r, 0), (r * 0.8, L * 0.4), (0, L)], (0, 0, 0), FLAME_O, n=8, rx=-90, emit=1.3)
    lathe([(r * 0.6, 0), (r * 0.45, L * 0.3), (0, L * 0.65)], (0, 0.005, 0), FLAME_I, n=8, rx=-90, emit=1.8)


# ---------------------------------------------------------------- spoilers (rear)

def sp_wing(a):
    for s in (-1, 1):
        box((0.025, 0.05, 0.14), (s * 0.17, 0.03, 0.07), CHAR)
    xslab([(-0.04, 0.13), (0.12, 0.135), (0.13, 0.17), (-0.03, 0.165)], 0.62, a, bevel=0.008, **GLOSS)
    for s in (-1, 1):
        box((0.02, 0.2, 0.1), (s * 0.315, 0.05, 0.15), CHAR, bevel=0.006)


def sp_duck(a):
    xslab([(-0.14, 0.0), (0.04, 0.0), (0.08, 0.075), (0.03, 0.07), (-0.14, 0.02)], 0.6, a, bevel=0.01, **GLOSS)


def sp_gt(a):
    for s in (-1, 1):
        tube([(s * 0.12, -0.02, 0), (s * 0.12, 0.0, 0.14), (s * 0.12, 0.06, 0.27), (s * 0.12, 0.04, 0.3)],
             lambda t: (0.012, 0.03), CHAR, rings=8, n=4)
    xslab([(-0.06, 0.28), (0.16, 0.29), (0.17, 0.33), (-0.05, 0.315)], 0.76, CHAR, bevel=0.008)
    xslab([(0.13, 0.32), (0.17, 0.32), (0.17, 0.36), (0.15, 0.36)], 0.76, a)  # gurney flap
    for s in (-1, 1):
        xslab([(-0.08, 0.24), (0.2, 0.24), (0.22, 0.38), (-0.02, 0.36)], 0.025, a, x=s * 0.39, **GLOSS)


def sp_biplane(a):
    for s in (-1, 1):
        box((0.025, 0.04, 0.24), (s * 0.2, 0.04, 0.12), CHAR)
        xslab([(-0.06, 0.06), (0.16, 0.06), (0.16, 0.27), (-0.02, 0.27)], 0.025, a, x=s * 0.31, **GLOSS)
    for z, col in ((0.11, a), (0.23, WHITE)):
        xslab([(-0.04, z), (0.12, z + 0.005), (0.13, z + 0.035), (-0.03, z + 0.03)], 0.6, col, bevel=0.007, **GLOSS)


def sp_fins(a):
    for s in (-1, 1):
        xslab([(-0.24, 0.0), (0.06, 0.0), (0.1, 0.22), (0.04, 0.22)], 0.035, a, x=s * 0.26, bevel=0.01, **GLOSS)
        ell((s * 0.26, 0.07, 0.17), (0.03, 0.03, 0.03), C(214, 34, 44), seg=8, ring=6, emit=0.4)
    xslab([(-0.05, 0.1), (0.08, 0.1), (0.09, 0.13), (-0.04, 0.125)], 0.52, CHROME, **MET)


# ---------------------------------------------------------------- bumpers (front)

def bu_chrome(a):
    rod((-0.34, -0.03, 0.0), (0.34, -0.03, 0.0), 0.036, CHROME, n=8, **MET)
    for s in (-1, 1):
        box((0.05, 0.05, 0.04), (s * 0.2, 0.0, 0.0), CHAR)
        box((0.05, 0.05, 0.1), (s * 0.13, -0.06, 0.01), BLACK, bevel=0.015)
        ell((s * 0.34, -0.03, 0.0), 0.04, CHROME, seg=8, ring=6, **MET)


def bu_bull(a):
    k = dict(n=6)
    for s in (-1, 1):
        rod((s * 0.13, 0.0, -0.04), (s * 0.13, -0.09, 0.08), 0.032, CHAR, **k)
        rod((s * 0.13, -0.09, 0.08), (s * 0.13, -0.06, 0.26), 0.032, CHAR, **k)
        rod((s * 0.13, -0.09, 0.08), (s * 0.32, -0.02, 0.06), 0.032, CHAR, **k)
        rod((s * 0.13, -0.06, 0.26), (0, -0.06, 0.26), 0.032, CHAR, **k)
        for z in (0.12, 0.19):
            rod((s * 0.13, -0.08, z), (0, -0.08, z), 0.024, CHAR, **k)
    rod((-0.13, -0.09, 0.08), (0.13, -0.09, 0.08), 0.032, CHAR, **k)
    for s in (-1, 1):
        cyl(0.035, 0.04, (s * 0.065, -0.07, 0.26), CHAR, n=10, rx=90)
        cyl(0.026, 0.045, (s * 0.065, -0.07, 0.26), LAMP, n=10, rx=90, emit=0.4)


def bu_ram(a):
    cols = [YEL, BLACK] * 4
    for i in range(7):
        x0 = -0.35 + i * 0.1
        xslab([(-0.02, -0.06), (-0.17, -0.06), (-0.06, 0.18), (-0.02, 0.18)], 0.1, cols[i], x=x0 + 0.05, **GLOSS)
    for s in (-1, 1):
        box((0.05, 0.06, 0.05), (s * 0.15, 0.0, 0.05), CHAR)


def bu_cow(a):
    rod((-0.3, -0.03, 0.17), (0.3, -0.03, 0.17), 0.03, a, **GLOSS)
    rod((-0.32, -0.04, -0.05), (0, -0.22, -0.05), 0.026, a, **GLOSS)
    rod((0.32, -0.04, -0.05), (0, -0.22, -0.05), 0.026, a, **GLOSS)
    for i in range(9):
        x = -0.3 + i * 0.075
        yb = -0.04 - 0.18 * (1 - abs(x) / 0.32)
        rod((x * 0.95, -0.03, 0.17), (x, yb, -0.05), 0.022, a, n=5, **GLOSS)
    for s in (-1, 1):
        box((0.04, 0.05, 0.05), (s * 0.15, 0.0, 0.08), CHAR)


# ---------------------------------------------------------------- exhausts (+y)

def ex_twin(a):
    box((0.12, 0.04, 0.05), (0, 0.0, 0), CHAR)
    for s in (-1, 1):
        cyl(0.026, 0.1, (s * 0.032, 0.0, 0), CHROME, n=8, rx=-90, **MET)
        cyl(0.017, 0.01, (s * 0.032, 0.095, 0), BLACK, n=8, rx=-90)


def ex_trumpet(a):
    lathe([(0.025, 0), (0.028, 0.08), (0.05, 0.14), (0.065, 0.16), (0.045, 0.16)], (0, 0, 0), CHROME, n=10, rx=-90, cap=False, **MET)
    cyl(0.044, 0.01, (0, 0.145, 0), BLACK, n=10, rx=-90)


def ex_stack(a):
    rod((0, -0.02, 0), (0, 0.06, 0), 0.026, CHROME, n=8, **MET)
    rod((0, 0.06, -0.01), (0, 0.06, 0.38), 0.028, CHROME, n=8, **MET)
    with at((0, 0.06, 0.38), rx=-30):
        box((0.065, 0.065, 0.008), (0, 0, 0.0), CHAR)
    box((0.065, 0.02, 0.16), (0, 0.098, 0.2), BLACK)  # heat shield
    for z in (0.14, 0.2, 0.26):
        box((0.067, 0.022, 0.012), (0, 0.099, z), CHROME, **MET)


def ex_zoomie(a):
    tube([(0, -0.02, 0), (0.0, 0.06, 0.01), (0.05, 0.14, 0.08), (0.08, 0.18, 0.14)], lambda t: 0.024, CHROME, rings=8, n=8, **MET)
    with at((0.08, 0.18, 0.14), rx=-45, rz=-25):
        lathe([(0.022, 0), (0.042, 0.04), (0.03, 0.04)], (0, 0, 0), CHROME, n=8, cap=False, **MET)
        with at((0, 0.0, 0.04), rx=-90):
            flame_jet(0.1, 0.028)


# ---------------------------------------------------------------- boosters (tail, +y)

def bo_rocket(a):
    box((0.08, 0.05, 0.06), (0, 0.0, 0), CHAR)
    lathe([(0.0, -0.02), (0.06, 0.0), (0.08, 0.04), (0.08, 0.22), (0.07, 0.24)], (0, 0.02, 0), a, n=10, rx=-90, **GLOSS)
    torus(0.081, 0.012, (0, 0.12, 0), WHITE, n=10, k=4, rx=-90)
    lathe([(0.05, 0), (0.08, 0.07), (0.065, 0.07), (0.04, 0.0)], (0, 0.26, 0), CHROME, n=10, rx=-90, cap=False, **MET)
    with at((0, 0.31, 0)):
        flame_jet(0.24, 0.065)
    for s in (-1, 1):
        with at((s * 0.08, 0.2, 0)):
            box((0.06, 0.08, 0.012), (s * 0.02, 0, 0), WHITE)


def bo_nitro(a):
    box((0.24, 0.06, 0.05), (0, 0.0, 0), CHAR)
    for s in (-1, 1):
        lathe([(0.0, 0.0), (0.04, 0.01), (0.05, 0.04), (0.05, 0.2), (0.035, 0.24), (0.015, 0.25), (0.015, 0.28), (0, 0.28)],
              (s * 0.065, 0.0, 0.0), BLUE, n=10, rx=-90, **GLOSS)
        cyl(0.051, 0.02, (s * 0.065, 0.08, 0), WHITE, n=10, rx=-90)
        cyl(0.022, 0.02, (s * 0.065, 0.27, 0), RED, n=6, rx=-90)
        with at((s * 0.065, 0.29, 0)):
            lathe([(0.018, 0), (0.012, 0.08), (0, 0.13)], (0, 0, 0), C(120, 200, 255), n=8, rx=-90, emit=1.6)


def bo_jet(a):
    box((0.1, 0.05, 0.06), (0, 0.0, 0), CHAR)
    lathe([(0.075, 0.0), (0.1, 0.03), (0.1, 0.2), (0.08, 0.26), (0.06, 0.26)], (0, 0.02, 0), WHITE, n=12, rx=-90, cap=False, **GLOSS)
    torus(0.09, 0.016, (0, 0.04, 0), a, n=12, k=4, rx=-90)
    cyl(0.07, 0.02, (0, 0.24, 0), C(255, 140, 60), n=12, rx=-90, emit=1.4)
    for i in range(6):
        ang = i * 60
        with at((0, 0.035, 0), ry=ang):
            box((0.012, 0.01, 0.065), (0, 0, 0.035), CHROME, rx=0, **MET)
    cyl(0.03, 0.04, (0, 0.03, 0), CHROME, n=8, rx=90, **MET)
    with at((0, 0.28, 0)):
        flame_jet(0.18, 0.055)


# ---------------------------------------------------------------- roof / hood / mast / side / front

def roof_rack(a):
    for sx in (-1, 1):
        for sy in (-1, 1):
            box((0.03, 0.03, 0.05), (sx * 0.17, sy * 0.15, 0.025), CHAR)
        rod((sx * 0.18, -0.2, 0.06), (sx * 0.18, 0.2, 0.06), 0.014, CHROME, **MET)
    for y in (-0.15, 0.0, 0.15):
        rod((-0.18, y, 0.06), (0.18, y, 0.06), 0.012, CHAR)
    box((0.2, 0.15, 0.1), (0.06, 0.05, 0.12), TAN, bevel=0.015)
    box((0.205, 0.02, 0.105), (0.06, 0.05, 0.12), C(150, 100, 60))
    cyl(0.045, 0.24, (-0.12, -0.12, 0.115), a, n=8, ry=90)
    for x in (-0.06, 0.06):
        torus(0.047, 0.006, (x, -0.12, 0.115), CHAR, n=8, k=3, ry=90)


def roof_siren(a):
    cyl(0.055, 0.03, (0, 0, 0), CHAR, n=10)
    lathe([(0.045, 0), (0.045, 0.05), (0.035, 0.08), (0, 0.09)], (0, 0, 0.03), C(255, 90, 40), n=10, emit=0.8, rough=0.2)
    cyl(0.014, 0.01, (0, 0, 0.12), CHROME, n=6, **MET)


def roof_lightbar(a):
    box((0.48, 0.1, 0.03), (0, 0, 0.015), CHAR, bevel=0.01)
    for s, col in ((-1, C(255, 50, 50)), (1, C(60, 120, 255))):
        box((0.17, 0.085, 0.05), (s * 0.12, 0, 0.055), col, bevel=0.012, emit=0.7, rough=0.2)
    box((0.06, 0.085, 0.045), (0, 0, 0.052), WHITE, bevel=0.01)


def mast_antenna(a):
    cyl(0.025, 0.025, (0, 0, 0), CHAR, n=8)
    rod((0, 0, 0.02), (0, 0, 0.5), 0.014, STEEL, n=6, **MET)
    ell((0, 0, 0.52), 0.032, a, seg=8, ring=6)
    for i in range(4):
        for j in range(3):
            col = BLACK if (i + j) % 2 else WHITE
            box((0.012, 0.055, 0.05), (0, 0.035 + i * 0.055, 0.47 - j * 0.05), col)


def hood_scoop(a):
    tbox(0.0, 0.08, (0.11, -0.12, 0.12), (0.09, -0.07, 0.1), a, bevel=0.015, **GLOSS)
    box((0.15, 0.02, 0.05), (0, -0.075, 0.045), BLACK)


def side_cannon(a):
    box((0.07, 0.12, 0.05), (0.035, 0, 0), CHAR, bevel=0.01)
    with at((0.09, 0.08, 0.03)):
        ell((0, 0.04, 0), 0.05, BLACK, seg=8, ring=6)
        lathe([(0.0, 0.0), (0.058, 0.0), (0.06, 0.03), (0.048, 0.06), (0.044, 0.2), (0.056, 0.22), (0.056, 0.25), (0.035, 0.25), (0.03, 0.23)],
              (0, 0, 0), BLACK, n=10, rx=90, **GLOSS)
        torus(0.05, 0.01, (0, -0.12, 0), YEL, n=10, k=4, rx=90, **MET)
        torus(0.058, 0.01, (0, -0.24, 0), YEL, n=10, k=4, rx=90, **MET)
        ell((0, 0.075, 0), 0.025, BLACK, seg=6, ring=4)


def front_shield(a):
    for s in (-1, 1):
        box((0.03, 0.08, 0.03), (s * 0.08, -0.04, 0.0), CHAR)
    outline = [(-0.16, 0.18), (0.16, 0.18), (0.15, 0.0), (0.0, -0.17), (-0.15, 0.0)]
    slab(outline, 0.03, (0, -0.09, 0.06), WHITE, bevel=0.012, **GLOSS)
    inner = [(x * 0.82, y * 0.82 + 0.005) for x, y in outline]
    slab(inner, 0.03, (0, -0.1, 0.06), a, bevel=0.008, **GLOSS)
    slab(star(0.06), 0.02, (0, -0.118, 0.07), YEL, **GLOSS)


# name: (snap kind, builder, label, group)
BOLTONS = {
    "wing": ("rear", sp_wing, "Classic wing", "Spoilers"),
    "ducktail": ("rear", sp_duck, "Duck tail", "Spoilers"),
    "gtwing": ("rear", sp_gt, "Swan-neck GT", "Spoilers"),
    "biplane": ("rear", sp_biplane, "Biplane wing", "Spoilers"),
    "fins": ("rear", sp_fins, "Twin fins", "Spoilers"),
    "chromebar": ("front", bu_chrome, "Chrome bumper", "Bumpers"),
    "bullbar": ("front", bu_bull, "Bull bar", "Bumpers"),
    "ram": ("front", bu_ram, "Ram plough", "Bumpers"),
    "cowcatcher": ("front", bu_cow, "Cow catcher", "Bumpers"),
    "twinpipe": ("exhaust", ex_twin, "Twin pipes", "Exhausts"),
    "trumpet": ("exhaust", ex_trumpet, "Trumpet", "Exhausts"),
    "stack": ("exhaust", ex_stack, "Stack", "Exhausts"),
    "zoomie": ("exhaust", ex_zoomie, "Zoomie", "Exhausts"),
    "rocket": ("tail", bo_rocket, "Rocket booster", "Boosters"),
    "nitro": ("tail", bo_nitro, "Nitro tanks", "Boosters"),
    "jet": ("tail", bo_jet, "Jet turbine", "Boosters"),
    "rack": ("roof", roof_rack, "Roof rack", "Roof & mast"),
    "siren": ("roof", roof_siren, "Siren", "Roof & mast"),
    "lightbar": ("roof", roof_lightbar, "Light bar", "Roof & mast"),
    "antenna": ("mast", mast_antenna, "Antenna + flag", "Roof & mast"),
    "scoop": ("hood", hood_scoop, "Hood scoop", "Combat & misc"),
    "cannons": ("side", side_cannon, "Side cannons", "Combat & misc"),
    "shield": ("front", front_shield, "Shield", "Combat & misc"),
}


# ---------------------------------------------------------------- driver

SUIT = RED


def driver(style=0, suit=RED, helm=WHITE, acc=BLUE, legs=True):
    """Chibi helmeted bean, seated. Origin = hip on the seat; faces -y; hands forward
    on an imaginary wheel 0.15 ahead. Helmet top is ~0.45 above the hip."""
    ell((0, 0.02, 0.13), (0.115, 0.1, 0.125), suit, seg=10, ring=6, **GLOSS)
    box((0.09, 0.02, 0.05), (0, -0.065, 0.13), WHITE)  # chest badge
    for s in (-1, 1):
        tube([(s * 0.085, 0.0, 0.19), (s * 0.1, -0.07, 0.16), (s * 0.075, -0.14, 0.16)], lambda t: 0.03, suit, rings=6, n=6)
        ell((s * 0.072, -0.155, 0.16), 0.036, CHAR, seg=8, ring=6)
        if legs:
            tube([(s * 0.05, -0.02, 0.03), (s * 0.06, -0.16, 0.03), (s * 0.06, -0.2, -0.06)], lambda t: 0.035, suit, rings=6, n=6)
            ell((s * 0.06, -0.23, -0.08), (0.035, 0.05, 0.03), CHAR, seg=8, ring=4)
    with at((0, 0, 0.34), s=1.32):
        _helmet(style, helm, acc)


def _helmet(style, helm, acc):
    """Big round helmet centred on the origin (radius ~0.12 before the driver's 1.32 scale)."""
    H = V(0, 0, 0)
    if style == 2:  # retro aviator: leather cap + goggles
        ell(H, (0.12, 0.12, 0.115), C(250, 214, 180), seg=12, ring=8)
        ell(H + V(0, 0.01, 0.02), (0.125, 0.122, 0.105), C(156, 96, 56), seg=12, ring=8, rough=0.6)
        for s in (-1, 1):
            ell(H + V(s * 0.12, 0.0, -0.03), (0.025, 0.045, 0.06), C(156, 96, 56), seg=6, ring=4)
        box((0.25, 0.03, 0.035), (0, -0.095, 0.06), C(80, 60, 50))
        for s in (-1, 1):
            torus(0.036, 0.014, (s * 0.05, -0.11, 0.06), CHROME, n=10, k=4, rx=90, **MET)
            ell((s * 0.05, -0.115, 0.06), (0.032, 0.012, 0.032), VISOR, seg=8, ring=4, rough=0.15)
        ell(H + V(0, -0.075, -0.035), (0.08, 0.06, 0.05), VISOR, seg=10, ring=6, rough=0.15)
        tube([(-0.09, 0.0, -0.12), (0, -0.08, -0.12), (0.09, 0.0, -0.12), (0.12, 0.1, -0.14)], lambda t: 0.03, WHITE, rings=10, n=5)
        return
    ell(H, (0.122, 0.125, 0.118), helm, seg=12, ring=8, **GLOSS)
    if style == 0:  # classic: stripe + bubble visor
        ell(H + V(0, 0.0, 0.004), (0.035, 0.128, 0.12), acc, seg=8, ring=8, **GLOSS)
        ell(H + V(0, -0.075, -0.015), (0.09, 0.06, 0.055), VISOR, seg=10, ring=6, rough=0.15)
    elif style == 1:  # full-face racer: wraparound visor + spoiler
        ell(H + V(0, -0.06, -0.01), (0.112, 0.08, 0.05), VISOR, seg=12, ring=6, rough=0.15)
        ell(H + V(0, -0.07, -0.075), (0.09, 0.07, 0.035), acc, seg=10, ring=4, **GLOSS)
        xslab([(0.07, 0.07), (0.135, 0.075), (0.14, 0.095), (0.09, 0.092)], 0.1, acc, bevel=0.006, **GLOSS)
    elif style == 3:  # dirt/moto: peak + chin bar
        ell(H + V(0, -0.075, -0.0), (0.085, 0.055, 0.045), VISOR, seg=10, ring=6, rough=0.15)
        with at(H + V(0, -0.08, 0.085), rx=-18):
            box((0.18, 0.12, 0.025), (0, -0.02, 0), acc, bevel=0.01, **GLOSS)
        ell(H + V(0, -0.1, -0.08), (0.065, 0.055, 0.045), acc, seg=8, ring=4, **GLOSS)
    elif style == 4:  # mohawk crest
        ell(H + V(0, -0.075, -0.015), (0.09, 0.06, 0.055), VISOR, seg=10, ring=6, rough=0.15)
        for i in range(5):
            y = -0.07 + i * 0.04
            z = math.sqrt(max(0.0, 0.118 ** 2 - (y * 0.95) ** 2)) - 0.015
            cone(0.03, 0.075 - abs(i - 2) * 0.01, (0, y, z), acc, n=4, rx=10)
    elif style == 5:  # cat ears
        ell(H + V(0, -0.075, -0.015), (0.09, 0.06, 0.055), VISOR, seg=10, ring=6, rough=0.15)
        for s in (-1, 1):
            with at(H + V(s * 0.07, 0.01, 0.085), ry=s * 20):
                cone(0.05, 0.085, (0, 0, 0), helm, n=4, **GLOSS)
                cone(0.028, 0.055, (0, -0.018, 0.01), acc, n=4)
    torus(0.1, 0.014, (0, 0.02, -0.105), shade(helm, 0.8), n=12, k=4)


HELMETS = ["Classic stripe", "Full-face racer", "Retro aviator", "Dirt peak", "Mohawk crest", "Cat ears"]


# ---------------------------------------------------------------- decals

SEG7 = {0: "abcdef", 1: "bc", 2: "abged", 3: "abgcd", 4: "fgbc", 5: "afgcd", 6: "afgedc", 7: "abc", 8: "abcdefg", 9: "abfgcd"}


def digit(n, h, col):
    """7-segment digit in the local yz plane facing +x (y = viewer's right)."""
    w, t = h * 0.55, h * 0.16
    seg = {"a": (0, h / 2, "h"), "g": (0, 0, "h"), "d": (0, -h / 2, "h"),
           "f": (-w / 2, h / 4, "v"), "b": (w / 2, h / 4, "v"), "e": (-w / 2, -h / 4, "v"), "c": (w / 2, -h / 4, "v")}
    for k in SEG7[n]:
        u, v, o = seg[k]
        size = (0.006, w + t * 0.6, t) if o == "h" else (0.006, t, h / 2 + t * 0.6)
        box(size, (0, u, v), col)


def number_roundel(num, r=0.1, bg=WHITE, ink=BLACK):
    cyl(r, 0.008, (0, 0, 0), bg, n=14, ry=90)
    s = str(num)
    h = r * 1.0
    gap = h * 0.7
    for i, ch in enumerate(s):
        with at((0.009, (i - (len(s) - 1) / 2) * gap, 0)):
            digit(int(ch), h, ink)


def flame_decal(L=0.5, H=0.2):
    o = [(0.0, -0.08), (0.14, 0.05), (0.3, 0.04), (0.5, 0.1), (0.36, 0.0), (0.56, -0.02), (0.38, -0.06),
         (0.52, -0.12), (0.3, -0.1), (0.14, -0.1)]
    for k, col, x in ((1.0, ORANGE, 0.0), (0.7, YEL, 0.005)):
        pts = [(y * k * L / 0.5, z * k * H / 0.2) for y, z in o]
        with at((x, 0, 0), rz=90):
            slab(pts, 0.006, (0, 0, 0), col)
    with at((0.008, 0, 0), rz=90):
        slab([(y * 0.4 * L / 0.5 + 0.0, z * 0.4 * H / 0.2) for y, z in o], 0.006, (0, 0, 0), RED)


def conform_strip(x, y0, y1, w, col, top=4.0, skip_glass=True, steps=26):
    """A paint stripe draped over the top surfaces at lateral offset x (ray cast down)."""
    pts = []
    for i in range(steps + 1):
        y = y0 + (y1 - y0) * i / steps
        hit = cast((x, y, top), (0, 0, -1))
        ok = hit is not None
        if ok and skip_glass:
            ok = not _is_glass_at(x, y, top)
        pts.append((V(hit[0]) + V(hit[1]) * 0.006, ) if ok else None)
    run = []
    for p in pts + [None]:
        if p is None:
            if len(run) >= 2:
                loft([(q, w / 2 * 1.42, 0.008) for q in run], col, n=4)
            run = []
        else:
            run.append(p[0])


def _is_glass_at(x, y, top):
    import bpy
    import kit
    M = kit._xf[-1]
    dg = bpy.context.evaluated_depsgraph_get()
    ok, loc, nrm, idx, obj, mw = bpy.context.scene.ray_cast(dg, M @ V(x, y, top), (M.to_3x3() @ V(0, 0, -1)).normalized(), distance=8)
    if not ok or not obj.active_material:
        return False
    c = obj.active_material.diffuse_color
    return abs(c[0] - GLASS[0]) < 0.02 and abs(c[1] - GLASS[1]) < 0.02 and abs(c[2] - GLASS[2]) < 0.02


def side_hit(y, z, x0=1.5):
    """Where a ray from +x at (y, z) meets the left side of the vehicle."""
    h = cast((x0, y, z), (-1, 0, 0))
    return None if h is None else h[0]


# ---------------------------------------------------------------- damage + debris

def smoke(p, n=6, k=1.0, seed=1):
    rr = random.Random(seed)
    p = V(p)
    for i in range(n):
        t = i / max(1, n - 1)
        c = p + V(rr.uniform(-0.04, 0.04) + t * 0.12, rr.uniform(-0.03, 0.03) + t * 0.06, t * 0.55 * k)
        g = 0.32 + 0.4 * t
        col = (g, g, g * 1.04)
        ell(c, (0.06 + 0.07 * t) * k, col, seg=8, ring=6)
        if i % 2 == 0:
            ell(c + V(0.05, -0.02, 0.02) * k, (0.04 + 0.05 * t) * k, (g + 0.06, g + 0.06, g + 0.08), seg=8, ring=6)


def crumple(p, nrm=(1, 0, 0), col=RED, size=0.08, seed=1):
    """A crumpled panel patch: a few tilted shards in a darker paint shade."""
    rr = random.Random(seed)
    p, n = V(p), V(nrm).normalized()
    for i in range(4):
        off = V(0, rr.uniform(-1, 1) * size, rr.uniform(-1, 1) * size * 0.6)
        with at(tuple(p + off + n * 0.004), rx=rr.uniform(-25, 25), ry=rr.uniform(-20, 20), rz=rr.uniform(-25, 25)):
            box((0.012, size * rr.uniform(0.7, 1.1), size * rr.uniform(0.5, 0.8)), (0, 0, 0), shade(col, rr.uniform(0.6, 0.85)))


def plaster(p):
    """Cartoon sticking-plaster cross over a dent (faces +x)."""
    for rz_ in (35, -35):
        with at(p, rx=rz_):
            box((0.012, 0.05, 0.16), (0, 0, 0), C(255, 214, 170), bevel=0.004)
            box((0.014, 0.04, 0.05), (0, 0, 0), C(240, 180, 140))


def scorch(p, nrm=(0, 0, 1), r=0.1, seed=2):
    rr = random.Random(seed)
    for i in range(3):
        ell(V(p) + V(rr.uniform(-r, r) * 0.5, rr.uniform(-r, r) * 0.5, 0), (r * rr.uniform(0.5, 0.8), r * rr.uniform(0.5, 0.8), 0.012),
            C(40, 36, 40), seg=8, ring=3)


def bolt_piece(seed=0, s=1.0):
    rr = random.Random(seed)
    with at((0, 0, 0.0), s=s):
        cyl(0.03, 0.025, (0, 0, 0), STEEL, n=6, **MET)
        rod((0, 0, 0.02), (0, 0, 0.09), 0.014, STEEL, n=6, **MET)
        for i in range(4):
            torus(0.015, 0.004, (0, 0, 0.035 + i * 0.014), STEEL, n=6, k=3, **MET)


def nut_piece(s=1.0):
    with at((0, 0, 0), s=s):
        cyl(0.03, 0.022, (0, 0, 0), STEEL, n=6, **MET)
        cyl(0.013, 0.023, (0, 0, 0.0), CHAR, n=8)


def door_piece(col=RED):
    with at((0, 0, 0.0)):
        box((0.36, 0.035, 0.2), (0, 0, 0.1), col, bevel=0.015, **GLOSS)
        tbox(0.2, 0.34, (0.16, -0.012, 0.012), (0.12, -0.012, 0.012), GLASS, rough=0.2)
        box((0.06, 0.02, 0.016), (0.08, -0.025, 0.15), CHROME, **MET)


def bumper_piece():
    rod((-0.3, 0, 0.04), (0.0, -0.02, 0.04), 0.036, CHROME, n=8, **MET)
    rod((0.0, -0.02, 0.04), (0.22, -0.1, 0.1), 0.036, CHROME, n=8, **MET)
    ell((-0.3, 0, 0.04), 0.04, CHROME, seg=8, ring=6, **MET)


def hubcap_piece(s=1.0):
    with at((0, 0, 0), s=s):
        _hubcap()


def _hubcap():
    lathe([(0.1, 0), (0.09, 0.02), (0.04, 0.035), (0, 0.04)], (0, 0, 0), CHROME, n=12, **MET)


def loose_wheel(kind="slick", acc=RED):
    with at((0, 0, 0.08), ry=-70):
        wheel(kind, 0.21, 0.19, acc=acc, centred=True)
