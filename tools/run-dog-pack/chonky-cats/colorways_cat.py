"""Chonky Cats colourways: the Chonky Hounds coat system (../chunky-toy/colorways.py, dogcoat.js)
on the 8 cat bodies, with cat coat patterns.

    python3 colorways_cat.py [--bake DIR] [body ...]

Writes rigged/coats/ (mask PNGs) and coats.json (per body: masks, layers, colourway palettes),
read by ../chunky-toy/dogcoat.js exactly like the dogs' (loadCoats('coats.json', 'rigged/coats/')).

Each body is first repainted once to a plain neutral coat (REBASE: the AI's own stripes,
points and calico patches go, its soft shading stays), so every pattern is a mask a game can
recolour: tabby stripes (mackerel, classic), spots and rosettes, colour points, tuxedo,
van, calico and tortie patches, mitts. A colourway is a palette over those masks: the 30
breeds in breeds.csv are colourways of their body (`breed` in coats.json), plus common
moggy colours on every body.
"""
import os
import sys
import zlib

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'chunky-toy'))
import colorways as cwm  # noqa: E402
from coatlib import smooth  # noqa: E402
from colorways import L, Regions, cw  # noqa: E402

# ---------------------------------------------------------------- colours
CAT = dict(
    black='#24211f', white='#efece6', blue='#7d8592', cream='#e6d2b0', red='#d8893f', darkred='#b4642a',
    brown='#a8794c', browntabby='#3b2c21', silver='#cbccd0', silvertabby='#2b2b2e', chocolate='#5d3b29',
    lilac='#ad9f9d', seal='#3d2b23', bluepoint='#5e6672', fawn='#cdab8c', cinnamon='#a1603a', ruddy='#b8743c',
    golden='#d9a865', gold='#c99a55', pink='#e2bcb2', bodyseal='#efe3d2', bodyblue='#e9e7e6', bodylilac='#f0e8e4',
    chestnut='#6e3c25', smoke='#45413f', ginger='#e09048', grey='#9a9ea6',
)
cwm.C.update(CAT)
cwm.NOSE.update(pink='#e8939b', brick='#b0573f', grey='#5d6470', rose='#d07a80', choc='#5a3528')
EYES = dict(blue='#4f8fd6', green='#5aa058', gold='#d4a32e', copper='#c8742a')

# ---------------------------------------------------------------- bodies: the AI coat, and the plain base
# The AI coat's colours (k-means over each body's texture, biggest first), matched when the
# body is repainted to the plain base, so every one of them becomes base coat.
AI = {
    'moggy': ['#cf9258', '#b76a2c', '#c9a682', '#433935'],
    'cobby': ['#7f8591', '#686f7f', '#454e5e', '#262f3e'],
    'flatface': ['#d0d1d1', '#bfbfc2', '#949399', '#3d3d41'],
    'floof': ['#826954', '#46392e', '#675241', '#c4baaf'],
    'sleek': ['#d2c5bb', '#56463e', '#a08b7e', '#1e1a17'],
    'pixie': ['#c3aba3', '#b4938a', '#906357', '#523c35'],
    'munchkin': ['#d6c8af', '#cfaf86', '#b78655', '#393836'],
    'bobtail': ['#cdcdd0', '#d7965d', '#343436', '#9a99a1'],
}
BASE = '#c9c3bb'   # the plain neutral every body is repainted to; colourways recolour it


# ---------------------------------------------------------------- cat patterns
class CatRegions(Regions):
    """The dog regions (chest, socks, mask, ears, blaze, spots...) plus cat coat patterns."""

    def _tail_t(self):
        """0 at the tail root, 1 at the tip, per texel (on the tail)."""
        J = self.d.J
        a, b = J['tail.1'], J.get('tail.tip', J['tail.3'])
        ab = b - a
        return np.clip(((self.d.P - a) @ ab) / max(ab @ ab, 1e-6), 0, 1)

    def _rings(self, t, freq, width, warp=0.0, wob=0.0):
        """Crisp stripes across a coordinate t (rings round the body, bands on legs)."""
        w = (self.noise(self.d.P + 1.3, 5) - 0.5) * warp + (self.noise(self.d.P + 6.1, 13) - 0.5) * wob
        s = np.sin(t * freq + w)
        return smooth(s, 1 - 2 * width, 1 - 2 * width + 0.25)

    def _belly_fade(self):
        # stripes and spots fade out on the belly and under the chin (tabbies are pale there)
        # only the low belly: underside() reaches most of the flank on these round bodies
        low = np.clip(self.body + self.neck, 0, 1) * (1 - smooth(self.y, 0.3 * self.spine_y, 0.55 * self.spine_y))
        return 1 - 0.85 * low

    def _forehead_m(self):
        # the tabby M: a few short vertical lines on the forehead between the ears
        hw, ey, er = self.head_w, self.eye[1], self.er
        crown = self.head * smooth(self.y, ey + 1.4 * er, ey + 2.0 * er) * (1 - smooth(self.fwd, 0.55, 0.75))
        lines = self._rings(self.x / max(hw, 1e-3), 11.0, 0.3)
        return crown * lines * (1 - smooth(np.abs(self.x), 0.5 * hw, 0.65 * hw))

    def _cheek_lines(self):
        hw, ey, er = self.head_w, self.eye[1], self.er
        side = self.head * smooth(np.abs(self.x), 0.45 * hw, 0.6 * hw) * smooth(self.fwd, 0.2, 0.35) * \
            (1 - smooth(self.fwd, 0.6, 0.7))
        return side * self._rings(self.y / max(er, 1e-3), 0.9, 0.18) * (1 - smooth(self.y, ey + 0.5 * er, ey + 1.2 * er))

    def _limbs_and_tail(self, freq_leg=55.0, freq_tail=14.0, width=0.24):
        legs = self.legs * self._rings(self.y, freq_leg, width, warp=1.5) * (1 - smooth(self.y, 0.75 * self.spine_y, 0.95 * self.spine_y))
        tail = self.tail * self._rings(self._tail_t(), freq_tail, width + 0.04)
        return np.clip(legs + tail, 0, 1)

    def mackerel(self):
        """Mackerel tabby: narrow stripes running down the sides from the spine, bands on the
        legs, rings round the tail, the M on the forehead and lines on the cheeks."""
        body = np.clip(self.body + self.neck * 0.8, 0, 1)
        sides = body * self._rings(self.z, 40.0, 0.3, warp=2.5, wob=1.2) * self._belly_fade()
        spine = body * (1 - smooth(np.abs(self.x), 0.03, 0.06)) * smooth(self.y, self.spine_y + 0.03, self.spine_y + 0.09)
        return np.clip(sides + spine + self._limbs_and_tail() + self._forehead_m() + self._cheek_lines(), 0, 1)

    def classic(self):
        """Classic (blotched) tabby, toy-simplified: broad wavy marbled bands round the body (no
        ring-round-a-spot swirl: on these round flanks it read as a big eyeball), three stripes down
        the spine, bands on legs and tail, the M on the forehead."""
        body = np.clip(self.body + self.neck * 0.6, 0, 1)
        bands = body * self._rings(self.z + 0.25 * self.y, 26.0, 0.36, warp=4.5, wob=2.0) * self._belly_fade()
        spine = np.maximum.reduce([(1 - smooth(np.abs(np.abs(self.x) - o), 0.012, 0.024)) for o in (0.0, 0.05)]) * \
            smooth(self.y, self.spine_y + 0.04, self.spine_y + 0.1) * body
        return np.clip(bands + spine + self._limbs_and_tail() + self._forehead_m() + self._cheek_lines(), 0, 1)

    def tabby_spots(self):
        """Spotted tabby (Egyptian Mau, Bengal): broken round spots on the body, bands on the
        legs and tail, the M on the forehead."""
        body = np.clip(self.body + self.neck * 0.5, 0, 1)
        pts, rng = self.surface_points(170, 11, lambda p: np.abs(p[:, 0]) > 0.02)
        spots = self.blobs(pts, rng.uniform(0.022, 0.036, len(pts)), warp=0.012, edge=0.1)
        return np.clip(body * spots * self._belly_fade() + self._limbs_and_tail(width=0.2) + self._forehead_m(), 0, 1)

    def leopard(self):
        """Bengal spotting: many solid spots of mixed sizes, some paired into short dashes, over the
        body and down the legs (solid: ring rosettes read as something growing on the cat)."""
        body = np.clip(self.body + self.neck * 0.6 + self.legs * 0.7, 0, 1)
        pts, rng = self.surface_points(260, 19, lambda p: np.abs(p[:, 0]) > 0.012)
        spots = self.blobs(pts, rng.uniform(0.016, 0.034, len(pts)), warp=0.01, edge=0.08)
        return np.clip(body * spots * self._belly_fade() + self.tail * self._rings(self._tail_t(), 14.0, 0.26) + self._forehead_m(), 0, 1)

    def bold_spots(self):
        """Savannah / serval spots: fewer, bigger, solid oval spots with crisp edges, down onto the legs."""
        body = np.clip(self.body + self.neck * 0.6 + self.legs * 0.8, 0, 1)
        pts, rng = self.surface_points(80, 17, lambda p: np.abs(p[:, 0]) > 0.015)
        spots = self.blobs(pts, rng.uniform(0.03, 0.048, len(pts)), warp=0.008, edge=0.04)
        return np.clip(body * spots * self._belly_fade() + self.tail * self._rings(self._tail_t(), 14.0, 0.28) + self._forehead_m(), 0, 1)

    def rosettes(self):
        """Bengal / Savannah rosettes: ring-shaped spots (dark rim, the coat showing inside)."""
        body = np.clip(self.body + self.neck * 0.5 + self.legs * 0.6, 0, 1)
        pts, rng = self.surface_points(110, 13, lambda p: np.abs(p[:, 0]) > 0.02)
        r = rng.uniform(0.032, 0.05, len(pts))
        outer = self.blobs(pts, r, warp=0.015, edge=0.08)
        inner = self.blobs(pts, r * 0.5, warp=0.015, edge=0.12)
        return np.clip(body * outer * (1 - 0.65 * inner) * self._belly_fade() + self._limbs_and_tail(width=0.18) + self._forehead_m(), 0, 1)

    def ticked(self):
        """Ticked tabby (Abyssinian): no stripes, a darker wash along the spine and the crown,
        faint bars on the legs and a dark tail tip."""
        return np.clip(self.top_shade(-0.02, 0.1) * 0.7 + self._limbs_and_tail(width=0.12) * 0.5 + self.tail_tip(), 0, 1)

    def colorpoint(self):
        """Colour points (Siamese, Ragdoll, Himalayan): the face mask, ears, legs and tail, each
        darkening toward its end, soft edges."""
        # the mask: an oval round the nose reaching just past the eyes (head-forward measures
        # missed most of these flat cat faces), plus the whisker pads and chin
        nose = np.array(self.d.J.get('mouth', self.mo)) * 0 + np.array(FACE_NOSE[self.body_name])
        c = (nose + self.eye * [0, 1, 1]) / 2
        rad = np.linalg.norm(self.eye - c) * 1.45
        dd = np.linalg.norm((self.d.P - c) * [1, 1.15, 0.6], axis=-1)
        face = smooth(self.head + self.neck, 0.3, 0.55) * (1 - smooth(dd, rad * 0.65, rad * 1.15)) * smooth(self.d.P[..., 2], c[2] - 2 * rad, c[2] - rad)
        # cat ears: the head above the skull top, out to the sides (the dog ears() region hangs low)
        hw, ey, er = self.head_w, self.eye[1], self.er
        # only what rises above the skull: the crown's height on the centre line, then a little up
        headish = smooth(self.head + self.neck, 0.3, 0.55)
        centre = (headish > 0.5) & (np.abs(self.x) < 0.12 * hw) & self.d.good
        crown = np.percentile(self.y[centre], 98) if centre.any() else ey + 2.5 * er
        ears = headish * smooth(self.y, crown - 0.005, crown + 0.035)
        legs = self.legs * (1 - smooth(self.y, 0.25 * self.spine_y, 0.75 * self.spine_y))
        tail = self.tail * smooth(self._tail_t(), 0.0, 0.35)
        return np.clip(np.maximum.reduce([face, ears, legs, tail]), 0, 1)

    def muzzle_white(self):
        """The white lower face of a bicolour: muzzle, chin and a point up between the eyes."""
        hw, ey, er = self.head_w, self.eye[1], self.er
        low = self.head * smooth(self.fwd, 0.45, 0.62) * (1 - smooth(self.y, ey - 0.6 * er, ey + 0.1 * er))
        wedge = self.head * smooth(self.fwd, 0.4, 0.55) * (1 - smooth(np.abs(self.x), 0.12 * hw, 0.2 * hw)) * \
            (1 - smooth(self.y, ey + 0.6 * er, ey + 1.2 * er))
        chin = (self.head + self.neck) * (1 - smooth(self.y, self.mo[1] - 0.05 * self.hl, self.mo[1] + 0.1 * self.hl)) * smooth(self.fwd, 0.3, 0.5)
        return np.clip(low + wedge + chin, 0, 1)

    def tuxedo(self):
        """Bicolour / tuxedo white: chest, belly, paws and the lower face."""
        return np.clip(np.maximum.reduce([self.chest(), self.underside(), self.socks(), self.muzzle_white()]), 0, 1)

    def mitts(self):
        """Ragdoll / Birman white gloves: short white paws on every foot."""
        return self.lower_legs * (1 - smooth(self.y, 0.1 * self.spine_y, 0.18 * self.spine_y))

    def van(self):
        """Van pattern: colour only on the top of the head (above the eyes, ears included, split
        by a white blaze) and the tail."""
        ey, er, hw = self.eye[1], self.er, self.head_w
        # head or neck weight: the crown of these big heads is partly on the neck bone
        head = smooth(self.head + self.neck, 0.3, 0.55)
        cap = head * smooth(self.y, ey + 0.4 * er, ey + 1.0 * er)
        blaze = (1 - smooth(np.abs(self.x), 0.1 * hw, 0.18 * hw)) * smooth(self.fwd, 0.3, 0.45)
        return np.clip(cap * (1 - blaze) + self.ears() + self.tail, 0, 1)

    def patches_a(self):
        """Calico / bicolour patches, set A (the bigger ones), over the back, flanks and head."""
        pts, rng = self.surface_points(9, 21, lambda p: p[:, 1] > self.spine_y * 0.7)
        return self.blobs(pts, rng.uniform(0.09, 0.15, len(pts)), warp=0.07, edge=0.05) * (1 - smooth(self.lower_legs, 0.4, 0.6))

    def patches_b(self):
        """Calico patches, set B: smaller, between and over set A's."""
        pts, rng = self.surface_points(10, 37, lambda p: p[:, 1] > self.spine_y * 0.5)
        return self.blobs(pts, rng.uniform(0.06, 0.1, len(pts)), warp=0.06, edge=0.05) * (1 - smooth(self.lower_legs, 0.4, 0.6))

    def tortie(self):
        """Tortoiseshell: torn, mottled patches of the second colour all over."""
        # the second colour (orange) in smaller torn patches: a tortie reads mostly black
        _, big = self.torn(7, 0.6, 0.25, 61.0, 0.02)
        _, small = self.torn(17, 0.66, 0.15, 73.0, 0.03)
        return np.clip(big + 0.6 * small, 0, 1)

    def shaded(self):
        """Smoke / shaded / chinchilla: darker tips over the back, crown and tail."""
        return self.top_shade(-0.06, 0.1)


cwm.Regions = CatRegions
FACE_NOSE = {}   # body -> nose position (faces.json), set below


# ---------------------------------------------------------------- colourways
def darker(c, k=0.42):
    """A shade of a coat colour toward a warm near-black (the rim round a cat's eyes)."""
    h = cwm.col(c).lstrip('#')
    rgb = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    return '#%02x%02x%02x' % tuple(int(v * (1 - k) + t * k) for v, t in zip(rgb, (0x24, 0x1b, 0x17)))


POINT_REGIONS = ('colorpoint',)


def cat(slug, name, base, layers=(), nose='pink', eyes=None, breed=None, note='', marks=None, rim=0.44):
    """rim: size of the darker area round the eyes (the eye_l / eye_r marks, drawn by the shader:
    no texture), in a shade of the coat round them, so the eye colour pops. 0 = none."""
    marks = dict(marks or {})
    if rim:
        point = next((c for region, c, _a, _on in layers if region in POINT_REGIONS), None)
        tone = darker(point or base, 0.35 if point else 0.62)   # thin and dark: eyeliner, not spectacles
        marks.setdefault('eye_l', (tone, rim))
        marks.setdefault('eye_r', (tone, rim))
    r = cw(slug, name, base=base, layers=layers, nose=nose, note=note, marks=marks)
    r['eyes'], r['breed'] = (EYES.get(eyes, eyes) if eyes else None), breed
    return r


# Patterns (light stripes on a light base read as nothing: tabbies need a clear contrast)
MACK = lambda c, a=1.0: L('mackerel', c, a)             # noqa: E731
CLASSIC = lambda c, a=1.0: L('classic', c, a)           # noqa: E731
TUX = L('tuxedo', 'white')
TORTIE_ORANGE = '#bf7438'   # softer, browner than ginger: a bright orange on black read as unnatural
WSOCKS = lambda h: {f'sock_{k}': ('white', h) for k in ('fl', 'fr', 'hl', 'hr')}   # noqa: E731  cats' short legs: 0.17 mitts, 0.28 socks, 0.55 boots
CALICO = [L('patches_a', 'red'), L('patches_b', 'black')]

COMMON = [   # the everyday moggy colours, on every body
    cat('black', 'Black', 'black', nose='black', eyes='gold'),   # black eyes vanish on a black coat
    cat('white', 'White', 'white'),
    cat('blue', 'Blue grey', 'blue', nose='grey'),
    cat('cream', 'Cream', 'cream'),
    cat('ginger', 'Ginger', 'ginger'),
    cat('ginger-tabby', 'Ginger tabby', 'ginger', [MACK('darkred')]),
    cat('grey-tabby', 'Grey tabby', 'grey', [MACK('#4a4c52')], nose='brick'),
    cat('tuxedo', 'Tuxedo', 'black', [TUX], nose='pink', eyes='green'),
    cat('ginger-white', 'Ginger and white', 'ginger', [MACK('darkred', 0.6), TUX]),
    cat('calico', 'Calico', 'white', CALICO),
    # more calicos from the same patch masks, different colours and amounts of white
    cat('calico-swap', 'Calico (black patches)', 'white', [L('patches_a', 'black'), L('patches_b', 'red')]),
    cat('calico-dilute', 'Dilute calico', 'white', [L('patches_a', 'cream'), L('patches_b', 'blue')], eyes='gold'),
    cat('calico-high-white', 'Calico (high white)', 'white', [L('patches_b', 'red')], marks={'brows': ('black', 1.0)}),
    cat('calico-tabby', 'Calico tabby (caliby)', 'white', [L('patches_a', 'ginger'), L('patches_b', 'brown'), MACK('browntabby', 0.55)],
        nose='brick', eyes='green'),
    cat('tortie-white', 'Tortie and white', 'black', [L('tortie', TORTIE_ORANGE), TUX], nose='rose', eyes='copper'),
    cat('tortie', 'Tortoiseshell', 'black', [L('tortie', TORTIE_ORANGE)], nose='rose', eyes='copper'),
    cat('calico-tuxedo', 'Tuxedo calico', 'black', [L('patches_a', 'red'), TUX], nose='pink', eyes='gold'),
    # white socks, boots and mitts (the shader's sock marks: no texture, a game can set them per cat)
    cat('black-socks', 'Black with white socks', 'black', marks=WSOCKS(0.28), nose='black', eyes='gold'),
    cat('black-boots', 'Black with white boots', 'black', marks={**WSOCKS(0.55), 'bib': ('white', 0.8)}, nose='pink', eyes='green'),
    cat('grey-boots', 'Grey tabby with white boots', 'grey', [MACK('#4a4c52')], marks={**WSOCKS(0.5), 'muzzle': ('white', 0.7)},
        nose='pink', eyes='green'),
    cat('ginger-socks', 'Ginger with white socks', 'ginger', [MACK('darkred', 0.6)], marks=WSOCKS(0.28), eyes='gold'),
    cat('blue-mitts', 'Blue with white mitts', 'blue', marks={**WSOCKS(0.17), 'bib': ('white', 0.7)}, nose='pink', eyes='copper'),
    cat('odd-socks', 'Black with odd socks', 'black', marks={'sock_fl': ('white', 0.28), 'sock_hr': ('white', 0.6),
                                                             'sock_hl': ('white', 0.17)}, nose='black', eyes='gold'),
    # white cats with a little colour on the head: eyebrow patches above the eyes (the brows mark,
    # size 1: a patch clear of the eye), or a cap split by a white blaze (the van mask), tail to match
    cat('brows-black', 'White with black brows', 'white', marks={'brows': ('black', 1.0)}, eyes='green'),
    cat('brows-ginger', 'White with ginger brows', 'white', marks={'brows': ('ginger', 1.0), 'tail_tip': ('ginger', 0.6)}, eyes='gold'),
    cat('cap-black', 'White with a black cap', 'white', [L('van', 'black')], eyes='gold'),
    cat('cap-ginger', 'White with a ginger cap', 'white', [L('van', 'ginger')], eyes='blue'),
    cat('cap-calico', 'White with a calico cap', 'white', [L('van', 'ginger')], marks={'brows': ('black', 1.0)}, eyes='blue'),
]

SPEC = {
    'moggy': COMMON + [
        cat('brown-tabby', 'Brown tabby', 'brown', [CLASSIC('browntabby')], nose='brick', breed='brown-tabby'),
        cat('american-shorthair', 'American Shorthair', 'silver', [CLASSIC('silvertabby')], nose='brick', breed='american-shorthair'),
        cat('bengal', 'Bengal', '#d9a35e', [L('leopard', '#2e1d12')], nose='brick', eyes='green', breed='bengal'),
        cat('egyptian-mau', 'Egyptian Mau', 'silver', [L('tabby_spots', '#26262a')], nose='brick', eyes='green', breed='egyptian-mau'),
        cat('turkish-van', 'Turkish Van', 'white', [L('van', 'darkred')], eyes='blue', breed='turkish-van'),
        cat('black-smoke', 'Black smoke', 'silver', [L('shaded', 'black', 0.9)], nose='black', eyes='copper'),
    ],
    'cobby': COMMON + [
        cat('british-blue', 'British Shorthair (blue)', 'blue', nose='grey', eyes='copper', breed='british-shorthair'),
        cat('scottish-fold', 'Scottish Fold (blue and white)', 'blue', [TUX], nose='pink', eyes='gold', breed='scottish-fold'),
        cat('lilac', 'Lilac', 'lilac', nose='rose', eyes='copper'),
        cat('silver-tabby', 'Silver tabby', 'silver', [CLASSIC('silvertabby')], nose='brick', eyes='green'),
        cat('golden-shaded', 'Golden shaded', 'cream', [L('shaded', 'gold', 0.8)], nose='brick', eyes='green'),
    ],
    'flatface': COMMON + [
        cat('persian-white', 'Persian (white)', 'white', eyes='copper', breed='persian'),
        cat('himalayan', 'Himalayan (seal point)', 'bodyseal', [L('colorpoint', 'seal')], eyes='blue', breed='himalayan'),
        cat('exotic-cream', 'Exotic Shorthair (cream)', 'cream', eyes='copper', breed='exotic-shorthair'),
        cat('chinchilla', 'Chinchilla silver', 'white', [L('shaded', '#6c6e74', 0.6)], nose='brick', eyes='green'),
        cat('blue-point', 'Blue point', 'bodyblue', [L('colorpoint', 'bluepoint')], nose='grey', eyes='blue'),
    ],
    'floof': COMMON + [
        cat('maine-coon', 'Maine Coon (brown tabby)', 'brown', [CLASSIC('browntabby'), L('chest', 'white')], nose='brick', eyes='gold', breed='maine-coon'),
        cat('norwegian-forest', 'Norwegian Forest (silver tabby)', 'silver', [MACK('silvertabby'), L('chest', 'white'), L('mitts', 'white')],
            nose='brick', eyes='green', breed='norwegian-forest-cat'),
        cat('siberian', 'Siberian (golden tabby)', '#dfae66', [MACK('#8a4f22')], nose='brick', eyes='green', breed='siberian'),
        cat('ragdoll', 'Ragdoll (seal mitted)', 'bodyseal', [L('colorpoint', 'seal'), L('mitts', 'white'), L('chest', 'white')],
            eyes='blue', breed='ragdoll'),
        cat('birman', 'Birman (seal point)', 'bodyseal', [L('colorpoint', 'seal'), L('mitts', 'white')], eyes='blue', breed='birman'),
        cat('red-maine-coon', 'Red Maine Coon', 'ginger', [CLASSIC('darkred'), L('chest', 'white')], eyes='gold'),
    ],
    'sleek': COMMON + [
        cat('siamese', 'Siamese (seal point)', 'bodyseal', [L('colorpoint', 'seal')], nose='black', eyes='blue', breed='siamese'),
        cat('oriental', 'Oriental Shorthair (chestnut)', 'chestnut', nose='choc', eyes='green', breed='oriental-shorthair'),
        cat('russian-blue', 'Russian Blue', 'blue', nose='grey', eyes='green', breed='russian-blue'),
        cat('abyssinian', 'Abyssinian (ruddy)', 'ruddy', [L('ticked', '#5a2e15', 0.8)], nose='brick', eyes='gold', breed='abyssinian'),
        cat('savannah', 'Savannah', '#dcb26a', [L('tabby_spots', '#17110d')], nose='black', eyes='gold', breed='savannah'),
        cat('blue-point', 'Blue point', 'bodyblue', [L('colorpoint', 'bluepoint')], nose='grey', eyes='blue'),
        cat('lilac-point', 'Lilac point', 'bodylilac', [L('colorpoint', 'lilac')], nose='rose', eyes='blue'),
    ],
    'pixie': [
        cat('sphynx', 'Sphynx (pink)', 'pink', breed='sphynx'),
        cat('sphynx-black-white', 'Sphynx (black and white)', 'pink', [L('patches_a', '#5a5052')]),
        cat('sphynx-grey', 'Sphynx (grey)', '#a59a98', nose='grey'),
        cat('devon-rex', 'Devon Rex (lilac)', 'lilac', nose='rose', eyes='gold', breed='devon-rex'),
        cat('devon-cream', 'Devon Rex (cream)', 'cream', eyes='gold'),
        cat('devon-tabby', 'Devon Rex (brown tabby)', 'brown', [MACK('browntabby')], nose='brick'),
        cat('devon-black', 'Devon Rex (black)', 'black', nose='black', eyes='gold'),
    ],
    'munchkin': COMMON + [
        cat('munchkin', 'Munchkin (cream tabby)', 'cream', [MACK('#c5874a')], breed='munchkin'),
    ],
    'bobtail': COMMON + [
        cat('manx', 'Manx (ginger and white)', 'ginger', [MACK('darkred', 0.6), TUX], breed='manx'),
        cat('mi-ke', 'Japanese Bobtail (mi-ke)', 'white', CALICO, eyes='gold', breed='japanese-bobtail'),
        cat('bobtail-black-white', 'Black and white', 'white', [L('patches_a', 'black')]),
    ],
}
# On the Moggy the everyday colours are breeds.csv's moggies (ginger tabby, tuxedo...): tag them there.
MOGGY_BREEDS = {'ginger-tabby': 'ginger-tabby', 'tuxedo': 'tuxedo', 'calico': 'calico', 'black': 'black-cat',
                'tortie': 'tortoiseshell'}
SPEC['moggy'] = [dict(r, breed=MOGGY_BREEDS[r['slug']]) if r['slug'] in MOGGY_BREEDS else r for r in SPEC['moggy']]
for body, recipes in SPEC.items():   # the breed colourways first in each list
    recipes.sort(key=lambda r: r['breed'] is None)

# Every body: repainted once to the plain base (all its AI colours -> BASE, no layers).
REBASE = {b: (cw('base', 'Plain', base=BASE), {'coat': cols}) for b, cols in AI.items()}


# ---------------------------------------------------------------- wire into the Hounds module
cwm.HERE = HERE
cwm.SPEC = SPEC
cwm.REBASE = REBASE
cwm.SOURCES_AI = {b: src for b, (_, src) in REBASE.items()}
cwm.SOURCES = {b: {'coat': [BASE]} for b in AI}
cwm.FACES = __import__('json').load(open(os.path.join(HERE, 'faces.json')))
cwm.EYES_KEEP = set()
# The AI coats' own stripes and patches leave dark blurs in the shading a repaint keeps: on the
# fluffy body they made golden coats muddy. Keep less of it, more blurred.
cwm.REBASE_BLUR, cwm.REBASE_SHADE = 8, 0.35
FACE_NOSE.update({b: f['nose'] for b, f in cwm.FACES.items()})

_build = cwm.build_masks


def build_masks(d, breed, seed, *a, **k):
    CatRegions.body_name = breed   # colorpoint() needs the body's nose
    return _build(d, breed, seed, *a, **k)


cwm.build_masks = build_masks

_palette = cwm.palette


def palette(breed, recipe, layers, sources=None):
    pal = _palette(breed, recipe, layers, sources)
    if recipe.get('eyes'):
        pal['face'] = {'eyes': recipe['eyes']}   # coat.setFace(pal.face) in a game
    if recipe.get('breed'):
        pal['breed'] = recipe['breed']           # which breeds.csv breed this colourway is
    return pal


cwm.palette = palette

if __name__ == '__main__':
    cwm.main(sys.argv[1:])
