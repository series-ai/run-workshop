"""Elven guardian statue in the Pirate Nation style.

A pale ivory-marble elf on a weathered grey-blue stone plinth: a long
robe and a cape built from true-slope frustums (rule F2), a carved vine
panel on the plinth, caricature elf proportions — a big serene head, long
swept ears and a gold circlet (rules F4 and K3). Both hands cup a
magic-cyan crystal at the chest; the fairy-mote PFX plays on socket-glow
above it (rule C3). Gold and royal-blue trim, plus a few moss patches, are
painted, not modelled (rule S1). About 16 across and 44 tall on its plinth.
"""

import math

import numpy as np

import paint as P
from _props import coords, gem, glyph, tufts
from pnkit import box, edges
from pnshapes import bar, flat_ngon, last
from voxgrid import C, Asset, Grid, Part, Socket

W, H, D = 26, 46, 22
CX, CZ = 13.0, 11.0
PY = 11                      # the plinth top: the statue stands here
STEPS = (                    # (y0, y1, radius, top radius)
    (0, 3, 8.0, 7.6),
    (3, 9, 7.0, 7.0),        # the straight step that carries the carving
    (9, PY, 7.4, 6.4),
)
BODY = (                     # the figure, bottom up
    (PY, 17, 5.4, 4.6),      # the robe hem
    (17, 25, 4.6, 3.2),      # the skirt
    (25, 27, 3.4, 3.4),      # the sash
    (27, 33, 3.2, 3.9),      # the chest
    (33, 35, 3.9, 3.3),      # the shoulders
    (35, 36.5, 1.7, 1.7),    # the neck
    (36.5, 40, 2.5, 3.2),    # the jaw
    (40, 44, 3.2, 1.9),      # the skull
)
MOSS = ((5, 5, 5, 4), (16, 4, 4, 4), (6, 15, 6, 4), (18, 13, 3, 4))   # x, z, w, d


def spin(g: Grid, mask: np.ndarray, ramp: str, base: int, n: int = 16) -> None:
    """Carved vertical folds: close tones stepped around the turn (rule S3)."""
    X, _, Z = coords(g)
    wedge = np.floor((np.arctan2(Z - CZ, X - CX) + math.pi) / (2 * math.pi) * n).astype(int)
    P._paint(g, mask, ramp, base + np.array([0, 1, 0, -1])[wedge % 4])


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))

    # the stepped octagonal plinth
    plinth = np.zeros(g.shape, dtype=bool)
    for y0, y1, r, rt in STEPS:
        g.prism("y", flat_ngon(CX, CZ, r, 8), y0, y1, C("stone", 5), top=flat_ngon(CX, CZ, rt, 8))
        plinth |= last(g)
    P.stone(g, plinth, "gray", 5, block=(6, 3), seed=1)
    P.flat(g, edges(plinth), "iron", 3)
    P.flat(g, plinth & (Yi >= PY - 1), "gray", 6)                     # the lit cap
    P.flat(g, plinth & (Yi == 2) & (Zi < 5), "iron", 3)               # a chipped corner
    # the carved vine panel on the straight middle step
    P.flat(g, plinth & (Yi >= 3) & (Yi < 9) & (Zi < 5), "stone", 6)
    glyph(g, "-z", 4.0, 10, 3, "tree", "gold", 6, depth=2, reach=3)
    glyph(g, "-z", 4.0, 4, 3, "fleur", "gold", 5, depth=2, reach=3)
    glyph(g, "-z", 4.0, 17, 3, "fleur", "gold", 5, depth=2, reach=3)

    # the figure: robe, sash, chest, shoulders, neck and head
    parts = []
    for y0, y1, r, rt in BODY:
        g.prism("y", flat_ngon(CX, CZ, r, 8), y0, y1, C("bone", 4), top=flat_ngon(CX, CZ, rt, 8))
        parts.append(last(g))
    hem, skirt, sash, chest, shoulder, neck, jaw, skull = parts
    robe = hem | skirt
    spin(g, robe | chest | shoulder, "bone", 5)
    P.flat(g, robe & (Zi < CZ - 2), "bone", 6)                       # the lit front
    P.flat(g, robe & (Zi > CZ + 3), "bone", 3)                       # the shaded back
    P.outline(g, robe, "bone", 2)
    P.flat(g, hem & (Yi < PY + 2), "bone", 4)
    P.flat(g, robe & (Yi == 17), "bone", 4)                          # a seam at the waist
    for cy in (14, 21):                                               # painted cracks (rule S1)
        P.flat(g, robe & (Yi == cy) & (np.abs(X - (CX - 3)) < 1.2) & (Zi < CZ), "bone", 2)
    # a royal-blue trim band down the front of the robe and round the hem
    P.flat(g, robe & (Zi < CZ - 2) & (np.abs(X - CX) < 1.4), "blue", 4)
    P.flat(g, hem & (Yi == PY + 1), "blue", 4)

    # a moss-green sash with a gold buckle
    P.flat(g, sash, "blue", 4)
    P.flat(g, sash & (Yi == 26), "blue", 5)
    P.flat(g, sash & (Zi > CZ + 1), "blue", 2)
    P.flat(g, sash & (Zi < CZ - 2) & (np.abs(X - CX) < 1.6), "gold", 4)

    # the cape: one big true-slope sheet off the shoulders, longer on the left
    g.prism("x", [(34.5, 12.0), (34.5, 15.0), (19.0, 16.2), (16.0, 12.6)], 8.2, 17.8, C("bone", 4))
    cape = last(g)
    g.prism("x", [(21.0, 13.4), (20.0, 16.0), (13.0, 15.2), (13.6, 12.8)], 8.2, 11.6, C("bone", 4))
    cape |= last(g)
    P.flat(g, cape, "bone", 4)
    P.flat(g, cape & (Xi % 4 == 0), "bone", 3)                       # painted folds
    P.flat(g, cape & (Xi % 4 == 2), "bone", 5)
    P.flat(g, cape & (Yi > 33), "bone", 6)
    P.outline(g, cape, "bone", 2, normal="z")   # the cape is thin in z: outline it in the x-y frame
    P.flat(g, cape & (Zi >= 15) & (np.abs(X - CX) < 1.6), "gold", 5)  # an embroidered stripe
    # A broad clasp at the shoulder ties the cape into the figure.
    for sx in (CX - 4, CX + 3):
        box(g, int(sx), 33, 14, int(sx) + 2, 36, 16, "gold", 5)

    # leaf-shaped shoulder caps, so the silhouette is not a plain cone
    for sx in (-1, 1):
        pts = [(2.6, 33.0), (5.6, 33.6), (5.0, 35.4), (2.4, 35.8)]
        poly = [(CX + sx * u, v) for u, v in pts]
        g.prism("z", poly if sx > 0 else poly[::-1], CZ - 2.8, CZ + 2.8, C("bone", 5))
        cap = last(g)
        P.flat(g, cap, "bone", 5)
        P.flat(g, cap & (Yi > 34), "bone", 6)
        P.flat(g, cap & (Zi < CZ - 2), "blue", 4)
        P.flat(g, cap & (Zi > CZ + 1), "bone", 3)

    # the arms, bent forward so both hands cup the crystal
    arms = np.zeros(g.shape, dtype=bool)
    for sx in (-1, 1):
        arms |= bar(g, "z", (CX + sx * 4.0, 33.0), (CX + sx * 3.0, 27.5), 2.8, CZ - 3.2, CZ - 0.6, "bone", 4)
        arms |= bar(g, "z", (CX + sx * 3.2, 27.5), (CX + sx * 1.0, 29.5), 2.6, CZ - 6.0, CZ - 3.4, "bone", 4)
    P.flat(g, arms, "bone", 5)
    P.flat(g, arms & (Zi < CZ - 4), "bone", 6)
    P.flat(g, arms & (Yi > 31), "bone", 6)
    P.outline(g, arms, "bone", 3, normal="z")
    hands = box(g, int(CX) - 3, 29, int(CZ) - 7, int(CX) + 3, 31, int(CZ) - 3, "bone", 5)
    P.flat(g, hands & (Yi == 30), "bone", 6)
    P.flat(g, edges(hands), "bone", 2)

    # the crystal, the one vivid accent
    crystal = gem(g, CX, 29.5, CZ - 5.0, r=2.2, h=5.0, ramp="cyan", shade=4)
    P.flat(g, crystal & (Zi < CZ - 6), "cyan", 5)
    P.flat(g, crystal & (Yi > 33), "cyan", 6)
    P.flat(g, crystal & (Yi < 31), "cyan", 2)

    # the head: swept ears, a gold circlet with a cyan stone, a serene face
    P.flat(g, jaw | skull, "bone", 6)
    P.flat(g, (jaw | skull) & (Zi > CZ + 1), "bone", 4)
    P.flat(g, (jaw | skull) & (Zi > CZ + 1) & (Xi % 2 == 0), "bone", 3)   # carved hair
    P.flat(g, neck, "bone", 4)
    ears = np.zeros(g.shape, dtype=bool)
    for sx in (-1, 1):
        ears |= bar(g, "z", (CX + sx * 2.4, 40.0), (CX + sx * 5.4, 43.6), 2.2, CZ - 1.4, CZ + 0.8, "bone", 6)
    P.flat(g, ears, "bone", 6)
    P.flat(g, ears & (Zi < CZ), "bone", 7)
    P.flat(g, ears & (Yi < 41), "bone", 5)
    band = skull & (Yi == 42)
    P.flat(g, band, "gold", 4)
    P.flat(g, band & (Zi < CZ - 1), "gold", 5)
    P.flat(g, band & (Zi < CZ - 1) & (np.abs(X - CX) < 1.1), "cyan", 5)
    face = (jaw | skull) & (Zi < CZ - 1)
    for ex in (-1.6, 1.6):                                            # deep shadowed eyes
        P.flat(g, face & (Yi == 41) & (np.abs(X - (CX + ex)) < 1.35), "blue", 1)
        P.flat(g, face & (Yi == 40) & (np.abs(X - (CX + ex)) < 1.35), "bone", 6)
    P.flat(g, face & (Yi >= 39) & (Yi <= 40) & (np.abs(X - CX) < 0.8), "bone", 7)   # the nose
    P.flat(g, face & (Yi == 38) & (np.abs(X - CX) < 1.5), "blue", 2)                # the mouth

    # a few moss patches where rain sits: the plinth foot, the hem and one shoulder
    for px, pz, pw, pd in MOSS:
        P.flat(g, plinth & (Yi < 3) & (Xi >= px) & (Xi < px + pw) & (Zi >= pz) & (Zi < pz + pd), "moss", 5)
    P.flat(g, hem & (Yi < PY + 1) & (Xi >= 6) & (Xi < 11), "moss", 5)
    P.flat(g, (shoulder | cape) & (Yi >= 33) & (Zi >= CZ + 2) & (Xi < 11), "moss", 5)

    tufts(g, [(3, 4), (21, 17), (4, 17)], flowers=[("sky", 6), ("gold", 6), ("leaf", 6)])
    root = Part("elf-statue", g)
    return Asset(id="fantasy-props-elf-statue", pack="fantasy", category="props",
                 name="Elf Statue", root=root,
                 sockets=[Socket("socket-glow", at=(CX, 34.5, CZ - 5.0))],
                 pfx=[{"effectId": "rvx-fantasy-fairy-motes", "socket": "socket-glow", "trigger": "idle", "size": 12}])
