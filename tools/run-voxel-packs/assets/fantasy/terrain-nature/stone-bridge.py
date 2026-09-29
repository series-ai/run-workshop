"""Stone bridge in the Pirate Nation style.

One chunky humpbacked span: the side profile (a faceted hump with one big
arch cut from below) is a single prism, so the deck ramps and the arch are
true slopes. Thick parapets follow the hump, with square end posts and
gold-capped pyramid finials. Painted dressed stone, a voussoir ring with
a keystone carrying a royal-blue elven rune, a cobbled deck, moss at the
feet and a little ivy. About 100 long, 40 tall, 32 deep. Faces -Z (the
river runs along z, under the arch).
"""
import math

import numpy as np

import paint as P
import pnglyph
from _life import asset, coords, facet_paint, front, plan, rockface
from pnkit import box, edges
from voxgrid import C, Grid, Part

L, D = 104, 36
Z0, Z1 = 2, 34  # bridge faces
PAR = 3  # parapet thickness
PH = 6  # parapet height above the deck
S = (L, 48, D)
AX, ARX, ARY = 52.0, 25.0, 21.0  # arch centre x, half span, rise

# deck top profile (x, y), left to right: a faceted hump
DECK = [(2, 5), (14, 11), (30, 23), (44, 28.5), (60, 28.5), (74, 23), (90, 11), (102, 5)]


def deck_y(x: np.ndarray) -> np.ndarray:
    xs, ys = zip(*DECK)
    return np.interp(x, xs, ys)


def arch_pts(n: int = 10) -> list[tuple[float, float]]:
    """The arch opening, right foot to left foot over the crown."""
    return [(AX + ARX * math.cos(math.pi * k / n), ARY * math.sin(math.pi * k / n)) for k in range(n + 1)]


def body(g: Grid) -> np.ndarray:
    X, Y, Z = coords(g)
    # the ground line with the arch cut from below (left foot, crown, right foot), then the deck back
    outline = [(0, 0), (AX - ARX, 0)] + arch_pts()[::-1][1:-1] + [(AX + ARX, 0), (L, 0), (L, 5)] + list(reversed(DECK)) + [(0, 5)]
    m = front(g, outline, Z0, Z1, "stone", 5)
    solid = [g.solids[-1]]

    def painter(gg, mm, fr):
        if isinstance(fr, str) or abs(fr[1][1]) > 0.2:  # the side walls and the arch soffit: dressed stone
            P.stone(gg, mm, "sand", 4, block=(7, 4), cracks=0.08, frame=fr, seed=3)
        else:  # the deck: red brick pavers (PN red/orange tiles)
            P.stone(gg, mm, "orange", 3, block=(4, 2), cracks=0.0, frame=fr, seed=4)

    facet_paint(g, solid, painter)
    # the deck top reads as a warm cobbled path between the parapets
    deck = m & (Y > deck_y(X) - 1.2) & (Z > Z0 + PAR) & (Z < Z1 - PAR)
    P.stone(g, deck, "orange", 3, block=(4, 2), cracks=0.0, frame="top", seed=4)
    # the arch soffit a shade darker, the voussoir ring lighter, radial blocks
    ex = ((X - AX) / ARX) ** 2 + (Y / ARY) ** 2
    ring = m & (ex > 1.0) & (np.sqrt(((X - AX) / (ARX + 4)) ** 2 + (Y / (ARY + 4)) ** 2) <= 1.0)
    ang = np.arctan2(Y, (X - AX) * ARY / ARX)
    P.flat(g, ring, "stone", 6)
    P.flat(g, ring & (((ang / math.pi * 13) % 1) < 0.12), "stone", 4)  # voussoir joints
    key = ring & (np.abs(X - AX) < 3.2)
    P.flat(g, key, "bone", 6)
    P.outline(g, key, "stone", 4, normal="z")
    soffit = m & (ex <= 1.25) & (Z > Z0 + 0.9) & (Z < Z1 - 0.9)
    P.stone(g, soffit, "sand", 3, block=(6, 4), frame="top", seed=5)
    # a string course under the parapets
    course = m & (Y > deck_y(X) - 3.0) & (Y <= deck_y(X) - 1.2) & ((Z < Z0 + 1) | (Z > Z1 - 1))
    P.flat(g, course, "stone", 6)
    # moss at the feet, with a wavy top edge
    Xi = np.floor(X).astype(int)
    wave = (P._hash(Xi // 3, seed=7) % np.uint64(3)).astype(float)
    P.flat(g, m & (Y < 2.0 + wave) & (ex > 1.0), "leaf", 4)
    P.flat(g, m & (Y < 1.0 + wave * 0.5) & (ex > 1.0), "leaf", 3)
    return m


def parapets(g: Grid) -> np.ndarray:
    X, Y, Z = coords(g)
    m = np.zeros(g.shape, dtype=bool)
    lo = [(x, y - 0.5) for x, y in DECK]
    hi = [(x, y + PH) for x, y in reversed(DECK)]
    for z0 in (Z0 - 1, Z1 - PAR + 1):
        pm = front(g, lo + hi, z0, z0 + PAR, "sand", 4)
        facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: P.stone(gg, mm, "sand", 4, block=(6, 3), cracks=0.05, frame=fr, seed=8))
        cap = pm & (Y > deck_y(X) + PH - 1.3)
        P.flat(g, cap, "stone", 6)
        m |= pm
    # end posts with pyramid finials and gold balls
    for px in (2, L - 8):
        for pz in (Z0 - 1, Z1 - 4):
            y0 = 0
            top = int(round(float(deck_y(np.array([px + 3.0]))[0]))) + PH + 4
            post = box(g, px, y0, pz, px + 6, top, pz + 5, "sand", 4)
            P.stone(g, post, "sand", 4, block=(6, 4), seed=9)
            P.flat(g, edges(post), "sand", 3)
            band = post & (Y > top - 2)
            P.flat(g, band, "stone", 6)
            plan(g, [(px - 0.5, pz - 0.5), (px + 6.5, pz - 0.5), (px + 6.5, pz + 5.5), (px - 0.5, pz + 5.5)], top, top + 5, "blue", 4, top=[(px + 3, pz + 2.5)] * 4)
            cap = g.solids[-1].mask(g.shape)
            facet_paint(g, [g.solids[-1]], lambda gg, mm, fr: P.tiles(gg, mm, "blue", 4, row=2, width=3, frame=fr, seed=10))
            ball = box(g, px + 2, top + 4, pz + 1, px + 4, top + 7, pz + 4, "gold", 5)
            P.flat(g, ball & (Y > top + 6), "gold", 7)
            m |= post | cap | ball
    return m


def ivy(g: Grid) -> None:
    """A few ivy strands hanging from the parapets on both faces."""
    X, Y, Z = coords(g)
    occ = g.a > 0
    for x0, length in ((22, 9), (27, 5), (78, 8), (84, 12), (60, 4)):
        top = float(deck_y(np.array([x0 + 0.5]))[0])
        for zf in (Z0 - 1, Z1 + 1):
            strand = occ & (np.abs(X - x0 - 0.5) < 1.0) & (Y < top + 2) & (Y > top - length) & (np.abs(Z - zf) < 1.6)
            P.flat(g, strand, "leaf", 4)
            P.flat(g, strand & (np.floor(Y).astype(int) % 3 == 0), "leaf", 5)


def build():
    g = Grid(*S)
    body(g)
    parapets(g)
    ivy(g)
    # an elven rune on the keystone, on both faces
    rune = ["#.#.#", ".###.", "..#..", ".###.", "#.#.#"]
    pnglyph.stamp(g, "-z", Z0, int(AX) - 2, int(ARY) + 1, rune, {"#": C("blue", 4)})
    pnglyph.stamp(g, "+z", Z1, int(AX) - 3, int(ARY) + 1, rune, {"#": C("blue", 4)})
    return asset("terrain-nature", "stone-bridge", "Stone Bridge", Part("stone-bridge", g, pivot=(L / 2, 0.0, D / 2)))
