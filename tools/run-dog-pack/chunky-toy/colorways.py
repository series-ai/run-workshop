"""Paint colorways for the rigged chunky-toy dogs.

    python3 colorways.py                 # every colorway in SPEC
    python3 colorways.py labrador-retriever shiba-inu     # just these breeds

Writes rigged/<breed>--<colorway>.glb: the same rigged model and clips, with a repainted
texture, plus colorways.json (the list, for the gallery and games).

How a colorway is painted (see coatlib.py for the per-texel data):
  1. Each texel is matched to the breed's original coat colors (SOURCES), keeping its
     lightness offset from that color (shading, fur strokes).
  2. `remap` gives each original color a new one (keeps the original markings), or
     `base` repaints the whole coat one color (drops them).
  3. `layers` paint markings on top: regions from the skeleton (tan points, saddle,
     blaze, socks...) and patterns (merle, brindle, harlequin, spots...).
  4. Eyes, nose and lip lines (on the face, clearly darker than their matched coat
     color) keep their original color; `nose` recolors the nose leather.
"""
import io
import struct
import json
import zlib
import os
import sys

import numpy as np
from PIL import Image

from scipy.spatial import cKDTree

from coatlib import Dog, Noise3, accessor, hex_lab, lab_to_srgb, replace_image, smooth, srgb_to_lab, write_glb

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- palette
C = dict(
    black='#1d1b1a', charcoal='#3a3836', blue='#7e838c', slate='#646a76', silver='#b7b9bd', lilac='#9a8a86',
    white='#eeedea', cream='#ecdcbd', biscuit='#dcc49c', yellow='#dfc497', champagne='#d9c3a5',
    apricot='#dc9d61', fawn='#c79c6c', lightfawn='#d8b78e', red='#ad5c2c', deepred='#8f3d1d', foxred='#b8642b',
    gold='#d79a4c', darkgold='#b8742c', lightgold='#e6c08a', chocolate='#5b3524', liver='#6a3b28', brown='#6f4630',
    tan='#b8743c', rust='#a5552a', mahogany='#7a3a1c', sable='#9b6a3c', copper='#b26a36', isabella='#b39478',
    seal='#3a2a24', brindle_dark='#2f241d', grey='#8d8f93', orange='#e39552', sandy='#d2a46a', caramel='#c47f3f',
    wheaten='#d9b680', mantlewhite='#e8e6e2',
)
NOSE = dict(black='#1a1919', liver='#58301f', blue='#474c55', isabella='#6a5245', grey='#5e5753')


def col(c):
    return C.get(c, c)


# ---------------------------------------------------------------- the breeds' original colors
SOURCES = {
    'labrador-retriever': {'coat': ['#d8bc94', '#bd9669', '#896238']},
    'golden-retriever': {'coat': ['#d2964d', '#cca26d', '#9e5418']},
    'german-shepherd': {'tan': ['#c89962', '#89511f', '#986f4d'], 'black': ['#3a3632']},
    'french-bulldog': {'coat': ['#b9956f', '#8e6035'], 'mask': ['#5a483d']},
    'english-bulldog': {'white': ['#bfbfc0'], 'brindle': ['#907352', '#735741', '#6b605a']},
    'poodle': {'coat': ['#cacbcc', '#b3b4b8', '#8d8e93']},
    'beagle': {'tan': ['#ca9967'], 'black': ['#242121'], 'white': ['#d4d3d3', '#abaaae']},
    'rottweiler': {'black': ['#383d48', '#1e1e26'], 'tan': ['#c58051', '#6f3e24']},
    'dachshund': {'coat': ['#95412c', '#a75b4c', '#511810']},
    'pembroke-welsh-corgi': {'red': ['#e79c5c', '#a45b2d'], 'white': ['#d1cfcd']},
    'siberian-husky': {'grey': ['#828489', '#515867'], 'white': ['#e0e0e2', '#adaeb4']},
    'pug': {'coat': ['#d3bfa2', '#b08f6a'], 'mask': ['#715b48']},
    'chihuahua': {'coat': ['#b08a65', '#cba57f', '#815b38']},
    'shih-tzu': {'white': ['#ccc9c3', '#838284'], 'gold': ['#b2965b']},
    'yorkshire-terrier': {'blue': ['#717984', '#333538'], 'tan': ['#c0924f', '#76471c']},
    'boxer': {'fawn': ['#b78d60', '#86572e'], 'white': ['#cac9c8'], 'mask': ['#35363a']},
    'australian-shepherd': {'blue': ['#7e8085'], 'black': ['#2f2e30'], 'white': ['#cbcac9'], 'copper': ['#a16337']},
    'border-collie': {'black': ['#3f3e42', '#1e1e21'], 'white': ['#e1e2e2', '#a3a3a5']},
    'dalmatian': {'white': ['#d1d1d1', '#bbbbba'], 'spots': ['#313131', '#737373']},
    'doberman': {'black': ['#3b3b3e', '#201e1e'], 'rust': ['#b86c40', '#7d4125']},
    'great-dane': {'fawn': ['#bd9a72', '#9c7045', '#704423'], 'mask': ['#363431']},
    'bernese-mountain-dog': {'black': ['#373637'], 'white': ['#d5d4d3', '#968e8a'], 'rust': ['#834824']},
    'shiba-inu': {'red': ['#aa654a', '#9b4e31'], 'cream': ['#d2bfa1'], 'dark': ['#3e241b']},
    'pomeranian': {'coat': ['#df9758', '#dba272', '#ce7230', '#99400f']},
    'cavalier-king-charles-spaniel': {'chestnut': ['#884d39'], 'white': ['#d5d4d4', '#a5a3a4']},
    'boston-terrier': {'black': ['#323439', '#1a1c21'], 'white': ['#e1e1e2']},
    'jack-russell-terrier': {'white': ['#d5d6d6', '#a8a8aa'], 'tan': ['#be9567', '#513523']},
    'miniature-schnauzer': {'grey': ['#77777a', '#414144', '#a1a1a3'], 'light': ['#c6c7ca']},
    'samoyed': {'coat': ['#d6d7d8', '#c1c2c3', '#9c9d9e']},
    'greyhound': {'slate': ['#7b7e8a', '#585a67', '#383946'], 'white': ['#dddddd']},
}


# Eyes and nose (centres and sizes, glTF space), shared with rig.py which adds glossy
# eye and nose geometry on top: picked on front renders of each original.
FACES = json.load(open(os.path.join(HERE, 'faces.json')))
EYES_KEEP = {'siberian-husky'}       # blue eyes: keep the original eye color


# ---------------------------------------------------------------- recipes
def cw(slug, name, base=None, remap=None, layers=(), nose=None, note='', like=None, marks=None):
    """like: another breed this colorway passes for on this body (a GSP look on the Lab...).
    marks: {mark: (color, size)} from MARKS (socks, muzzle, blaze...), no texture needed."""
    return dict(slug=slug, name=name, base=base, remap=remap or {}, layers=list(layers), nose=nose, note=note, like=like,
                marks=marks or {})


def socks(c='white', h=0.14, legs='fl fr hl hr'):
    return {f'sock_{k}': (c, h) for k in legs.split()}


def L(region, color, a=1.0, on=None):
    """A marking layer; `on` limits it to some of the breed's original colors."""
    return (region, color, a, on)


TAN_POINTS = ['brows', 'cheeks', 'muzzle_sides', 'chest_spots', 'socks', 'vent']
POINTS = lambda c, a=1.0: [L('points', c, a)]            # noqa: E731  tan points (one mask)
IRISH = lambda c='white': [L('irish', c)]                 # noqa: E731  blaze, collar, chest, socks, tail tip

SPEC = {
    'labrador-retriever': [
        cw('black', 'Black', base='black'),
        cw('chocolate', 'Chocolate', base='chocolate', nose='liver'),
        cw('fox-red', 'Fox red', base='foxred'),
        cw('light-yellow', 'Light yellow', base='cream'),
        cw('silver', 'Silver', base='#8f8984', nose='blue', note='non-standard dilute'),
        cw('charcoal', 'Charcoal', base='#4a4643', note='non-standard dilute'),
        cw('champagne', 'Champagne', base='champagne', nose='isabella', note='non-standard dilute'),
    ],
    'golden-retriever': [
        cw('light-cream', 'Light cream', base='cream'),
        cw('light-golden', 'Light golden', base='lightgold'),
        cw('dark-golden', 'Dark golden', base='darkgold'),
        cw('red', 'Red', base='#a95527'),
    ],
    'german-shepherd': [
        cw('black', 'Solid black', base='black'),
        cw('malinois', 'Malinois style', base='#b9813f', layers=[L('mask', 'black'), L('ears', 'black'), L('sable', 'black', 0.55)],
           note='fawn-mahogany with black mask and black-tipped overlay'),
        cw('sable', 'Sable', base='#b58145', layers=[L('sable', '#1f1a17', 0.85), L('mask', '#1f1a17', 0.7)]),
        cw('bicolor', 'Bicolor', base='black', layers=[L('socks', 'tan'), L('brows', 'tan'), L('cheeks', 'tan', 0.7)]),
        cw('white', 'White', base='white'),
        cw('liver', 'Liver and tan', remap={'tan': 'tan', 'black': 'liver'}, nose='liver', note='rare'),
        cw('blue', 'Blue and tan', remap={'tan': 'tan', 'black': 'slate'}, nose='blue', note='rare'),
    ],
    'french-bulldog': [
        cw('blue', 'Blue (all grey)', base='#878a90', nose='blue'),
        cw('brindle', 'Brindle', base='#8d6844', layers=[L('brindle', '#2a201b', 0.9), L('mask', '#2a201b', 0.8)]),
        cw('cream', 'Cream', base='cream'),
        cw('black', 'Black', base='black'),
        cw('pied', 'Pied', base='white', layers=[L('piebald_large', 'black'), L('ears', 'black'), L('eyepatch', 'black')]),
        cw('red-fawn', 'Red fawn', base='#b56b3a', layers=[L('mask', '#2a2322', 0.7)]),
        cw('blue-fawn', 'Blue fawn', base='#c4a487', layers=[L('mask', '#6e7077', 0.8)], nose='blue', note='non-standard'),
        cw('lilac', 'Lilac', base='lilac', nose='isabella', note='non-standard'),
    ],
    'english-bulldog': [
        cw('white', 'White', base='white'),
        cw('fawn', 'Fawn', base='fawn', layers=[L('mask', '#3c312b', 0.6)]),
        cw('red', 'Red', base='red'),
        cw('fawn-white', 'Fawn and white', remap={'white': 'white', 'brindle': 'fawn'}),
        cw('red-white', 'Red and white', remap={'white': 'white', 'brindle': 'red'}),
        cw('brindle', 'Brindle and white', remap={'white': 'white', 'brindle': '#8d6844'}, layers=[L('brindle', '#2a201b', 0.9, on=['brindle'])]),
    ],
    'poodle': [
        cw('cream', 'Cream', base='cream'),
        cw('black', 'Black', base='black'),
        cw('apricot', 'Apricot', base='apricot'),
        cw('red', 'Red', base='#a6522a'),
        cw('silver', 'Silver', base='silver'),
        cw('brown', 'Brown', base='chocolate', nose='liver'),
        cw('blue', 'Blue', base='#5d636d'),
        cw('cafe-au-lait', 'Cafe au lait', base='#b48d6b', nose='liver'),
        cw('parti', 'Parti (white and black)', base='white', layers=[L('piebald_large', 'black'), L('ears', 'black'), L('eyepatch', 'black')]),
        cw('phantom', 'Phantom (black and tan)', base='black', layers=POINTS('apricot')),
    ],
    'beagle': [
        cw('lemon-white', 'Lemon and white', remap={'tan': '#e2c58e', 'black': '#e2c58e', 'white': 'white'}),
        cw('red-white', 'Red and white', remap={'tan': 'red', 'black': 'red', 'white': 'white'}),
        cw('tan-white', 'Tan and white', remap={'tan': 'tan', 'black': 'tan', 'white': 'white'}),
        cw('chocolate-tri', 'Chocolate tricolor', remap={'tan': 'tan', 'black': 'chocolate', 'white': 'white'}, nose='liver'),
        cw('blue-tick', 'Blue tick', remap={'tan': 'tan', 'black': 'black', 'white': '#c9cbcf'}, layers=[L('ticking', '#4a4d55', 0.9, on=['white'])]),
    ],
    'rottweiler': [
        cw('mahogany', 'Black and mahogany', remap={'black': 'black', 'tan': 'mahogany'}),
        cw('red', 'Red', remap={'black': '#7a3d24', 'tan': '#c27a47'}, nose='liver', note='non-standard'),
    ],
    'dachshund': [
        cw('black-tan', 'Black and tan', base='black', layers=POINTS('tan')),
        cw('chocolate-tan', 'Chocolate and tan', base='chocolate', layers=POINTS('tan'), nose='liver'),
        cw('cream', 'Cream', base='cream'),
        cw('dapple', 'Dapple', base='#8a5a3e', layers=[L('merle', '#3a2219')]),
        cw('black-dapple', 'Silver dapple', base='#a4a2a2', layers=[L('merle', 'black'), *POINTS('tan', 0.9)]),
        cw('piebald', 'Piebald', base='white', layers=[L('head_cap', 'red'), L('piebald_large', 'red')]),
        cw('wild-boar', 'Wild boar', base='#8f6e52', layers=[L('sable', 'black', 0.7), *POINTS('tan', 0.6)]),
        cw('blue-tan', 'Blue and tan', base='slate', layers=POINTS('tan'), nose='blue'),
        cw('isabella', 'Isabella and tan', base='isabella', layers=POINTS('#cfa679'), nose='isabella'),
        cw('brindle', 'Brindle', base='#a0623a', layers=[L('brindle', '#2d1f18', 0.9)]),
    ],
    'pembroke-welsh-corgi': [
        cw('sable', 'Sable', remap={'red': '#b8773f', 'white': 'white'}, layers=[L('sable', '#2a211c', 0.7, on=['red'])]),
        cw('tri-black-headed', 'Tricolor (black headed)', remap={'red': 'black', 'white': 'white'},
           layers=[L('brows', 'tan'), L('cheeks', 'tan'), L('legs_outer', 'tan', 0.8)]),
        cw('tri-red-headed', 'Tricolor (red headed)', remap={'red': '#cf7a3c', 'white': 'white'}, layers=[L('saddle', 'black', 0.95)]),
        cw('fawn', 'Fawn', remap={'red': '#e2b07a', 'white': 'white'}),
        cw('deep-red', 'Deep red', remap={'red': '#b8572a', 'white': 'white'}),
    ],
    'siberian-husky': [
        cw('black-white', 'Black and white', remap={'grey': 'black', 'white': 'white'}),
        cw('red-white', 'Red (copper) and white', remap={'grey': 'copper', 'white': 'white'}, nose='liver'),
        cw('agouti', 'Agouti', remap={'grey': '#6d5f52', 'white': '#cdbfa8'}, layers=[L('sable', 'black', 0.75, on=['grey'])]),
        cw('white', 'Pure white', base='white'),
        cw('sable', 'Sable', remap={'grey': '#a3754a', 'white': 'white'}, layers=[L('sable', '#2a211c', 0.6, on=['grey'])]),
        cw('silver', 'Silver', remap={'grey': '#a7abb2', 'white': 'white'}),
        cw('piebald', 'Piebald', remap={'grey': 'grey', 'white': 'white'}, layers=[L('piebald_large', 'white')]),
    ],
    'pug': [
        cw('black', 'Black', base='black'),
        cw('apricot', 'Apricot', remap={'coat': '#d9a76a', 'mask': 'mask'}),
        cw('silver-fawn', 'Silver fawn', remap={'coat': '#d6cfc3', 'mask': 'mask'}),
        cw('brindle', 'Brindle', base='#9a7c5a', layers=[L('brindle', '#2a201b', 0.85), L('mask', '#2a201b', 0.8)], note='non-standard'),
    ],
    'chihuahua': [
        cw('black-tan', 'Black and tan', base='black', layers=POINTS('tan')),
        cw('chocolate', 'Chocolate', base='chocolate', nose='liver'),
        cw('cream', 'Cream', base='cream'),
        cw('white', 'White', base='white'),
        cw('blue', 'Blue', base='slate', nose='blue'),
        cw('tricolor', 'Tricolor', base='black', layers=[*POINTS('tan'), L('chest', 'white'), L('blaze', 'white', 0.8)]),
        cw('merle', 'Blue merle', base='#a8abb0', layers=[L('merle', 'black'), L('chest', 'white', 0.8)]),
        cw('red', 'Red', base='#b0602f'),
        cw('black-white', 'Black and white', base='black', layers=IRISH()),
    ],
    'shih-tzu': [
        cw('black-white', 'Black and white', remap={'white': 'white', 'gold': 'black'}),
        cw('liver-white', 'Liver and white', remap={'white': 'white', 'gold': 'liver'}, nose='liver'),
        cw('solid-black', 'Solid black', base='black'),
        cw('brindle-white', 'Brindle and white', remap={'white': 'white', 'gold': '#9a7448'}, layers=[L('brindle', '#2f241d', 0.75, on=['gold'])]),
        cw('red-white', 'Red and white', remap={'white': 'white', 'gold': '#a85a2c'}),
        cw('silver-white', 'Silver and white', remap={'white': 'white', 'gold': 'silver'}),
        cw('gold', 'Solid gold', base='#c99a54'),
    ],
    'yorkshire-terrier': [
        cw('black-gold', 'Black and gold', remap={'blue': 'black', 'tan': '#c7954e'}, note='puppy coat'),
        cw('parti', 'Parti (white, blue and tan)', remap={'blue': '#5c6470', 'tan': '#c0924f'}, layers=[L('parti', 'white')]),
        cw('chocolate', 'Chocolate', remap={'blue': 'chocolate', 'tan': '#b57a45'}, nose='liver', note='non-standard'),
    ],
    'boxer': [
        cw('brindle', 'Brindle', remap={'fawn': '#9a6b40', 'white': 'white', 'mask': 'mask'}, layers=[L('brindle', '#2a1f18', 0.85, on=['fawn'])]),
        cw('white', 'White', base='white', layers=[L('eyepatch', '#b98d60', 0.8)]),
        cw('red', 'Red fawn', remap={'fawn': '#a8592c', 'white': 'white', 'mask': 'mask'}),
        cw('reverse-brindle', 'Reverse brindle', remap={'fawn': '#3b2a20', 'white': 'white', 'mask': 'mask'},
           layers=[L('brindle', '#9a6b40', 0.6, on=['fawn'])]),
    ],
    'australian-shepherd': [
        cw('red-merle', 'Red merle', remap={'blue': '#c99c80', 'black': '#7a3d26', 'white': 'white', 'copper': 'copper'}, nose='liver'),
        cw('black-tri', 'Black tricolor', remap={'blue': 'black', 'black': 'black', 'white': 'white', 'copper': 'copper'}),
        cw('red-tri', 'Red tricolor', remap={'blue': '#7a3d26', 'black': '#7a3d26', 'white': 'white', 'copper': 'copper'}, nose='liver'),
        cw('black-white', 'Black and white', remap={'blue': 'black', 'black': 'black', 'white': 'white', 'copper': 'white'}),
        cw('red-white', 'Red and white', remap={'blue': '#7a3d26', 'black': '#7a3d26', 'white': 'white', 'copper': 'white'}, nose='liver'),
    ],
    'border-collie': [
        cw('caramel', 'Caramel (ee red) and white', remap={'black': 'caramel', 'white': 'white'}, nose='liver'),
        cw('red-white', 'Red (chocolate) and white', remap={'black': '#6b3a24', 'white': 'white'}, nose='liver'),
        cw('blue-white', 'Blue and white', remap={'black': '#6f7480', 'white': 'white'}, nose='blue'),
        cw('blue-merle', 'Blue merle', remap={'black': '#9a9fa8', 'white': 'white'}, layers=[L('merle', 'black')]),
        cw('red-merle', 'Red merle', remap={'black': '#c9a08a', 'white': 'white'}, layers=[L('merle', '#6b3a24')], nose='liver'),
        cw('tricolor', 'Tricolor', remap={'black': 'black', 'white': 'white'}, layers=[L('brows', 'tan'), L('cheeks', 'tan'), L('vent', 'tan')]),
        cw('lilac', 'Lilac and white', remap={'black': '#a89490', 'white': 'white'}, nose='isabella'),
        cw('sable', 'Sable and white', remap={'black': '#b07e4b', 'white': 'white'}, layers=[L('sable', '#2a211c', 0.65, on=['black'])]),
        cw('slate', 'Slate merle', remap={'black': '#646a74', 'white': 'white'}, layers=[L('merle', '#2a2c31', 0.8)]),
    ],
    'dalmatian': [
        cw('liver', 'Liver spotted', remap={'white': 'white', 'spots': 'liver'}, nose='liver'),
        cw('lemon', 'Lemon spotted', remap={'white': 'white', 'spots': '#e2b56a'}, nose='black'),
        cw('blue', 'Blue spotted', remap={'white': 'white', 'spots': '#5b616b'}, nose='blue', note='non-standard'),
        cw('brindle', 'Brindle spotted', remap={'white': 'white', 'spots': '#4f3a2b'}, note='non-standard'),
    ],
    'doberman': [
        cw('red', 'Red and rust', remap={'black': '#6e3424', 'rust': '#c27a45'}, nose='liver'),
        cw('blue', 'Blue and rust', remap={'black': '#5e636d', 'rust': '#c07a48'}, nose='blue'),
        cw('fawn', 'Fawn (Isabella) and rust', remap={'black': '#ad9077', 'rust': '#d19d6c'}, nose='isabella'),
    ],
    'great-dane': [
        cw('harlequin', 'Harlequin', base='white', layers=[L('harlequin', 'black'), L('ears', 'black', 0.85)]),
        cw('black', 'Black', base='black'),
        cw('blue', 'Blue', base='#646a74', nose='blue'),
        cw('brindle', 'Brindle', remap={'fawn': '#b98a55', 'mask': 'mask'}, layers=[L('brindle', '#2a201b', 0.85, on=['fawn'])]),
        cw('mantle', 'Mantle (Boston)', base='black', layers=[L('mantle_white', 'white')]),
        cw('merle', 'Merle', base='#9a9ca1', layers=[L('merle', 'black')]),
    ],
    'bernese-mountain-dog': [
        cw('red-tri', 'Red tricolor', remap={'black': '#6b2f1e', 'white': 'white', 'rust': '#c27a45'}, nose='liver', note='non-standard'),
    ],
    'shiba-inu': [
        cw('cream', 'Cream (least toasted)', remap={'red': '#ead6b5', 'cream': '#f1e6d3', 'dark': '#a88a72'}),
        cw('light-red', 'Light red (lightly toasted)', remap={'red': '#d39a68', 'cream': 'cream', 'dark': '#7b4b33'}),
        cw('red-medium', 'Red (golden toast)', remap={'red': '#c4783f', 'cream': 'cream', 'dark': '#5a3020'}),
        cw('deep-red', 'Deep red (well toasted)', remap={'red': '#963f1f', 'cream': '#e2c8a4', 'dark': '#3e1f14'}),
        cw('sesame', 'Red sesame', remap={'red': '#b4673a', 'cream': 'cream', 'dark': 'dark'}, layers=[L('sesame', '#2a1a14', 0.7, on=['red', 'dark'])]),
        cw('black-tan', 'Black and tan', remap={'red': 'black', 'cream': 'cream', 'dark': 'black'},
           layers=[L('brows', 'cream'), L('cheeks', '#c48a55', 0.6), L('socks', '#c48a55', 0.6)]),
    ],
    'pomeranian': [
        cw('cream', 'Cream', base='cream'),
        cw('white', 'White', base='white'),
        cw('black', 'Black', base='black'),
        cw('chocolate', 'Chocolate', base='chocolate', nose='liver'),
        cw('red', 'Red', base='#b5582a'),
        cw('sable', 'Orange sable', base='orange', layers=[L('sable', 'black', 0.55)]),
        cw('parti', 'Parti (orange and white)', base='white', layers=[L('ears', '#d47a2a'), L('eyepatch', '#d47a2a'), L('piebald_large', '#d47a2a')]),
        cw('merle', 'Blue merle', base='#a8abb0', layers=[L('merle', 'black')]),
        cw('blue', 'Blue', base='slate', nose='blue'),
        cw('black-tan', 'Black and tan', base='black', layers=POINTS('tan')),
    ],
    'cavalier-king-charles-spaniel': [
        cw('tricolor', 'Tricolor', remap={'chestnut': 'black', 'white': 'white'}, layers=[L('brows', 'tan'), L('cheeks', 'tan'), L('vent', 'tan')]),
        cw('ruby', 'Ruby', base='#9a4a2a'),
        cw('black-tan', 'Black and tan', base='black', layers=POINTS('tan')),
    ],
    'boston-terrier': [
        cw('brindle', 'Brindle and white', remap={'black': '#7a5a40', 'white': 'white'}, layers=[L('brindle', '#1f1813', 0.9, on=['black'])]),
        cw('seal', 'Seal and white', remap={'black': 'seal', 'white': 'white'}),
        cw('red', 'Red and white', remap={'black': '#7a3f26', 'white': 'white'}, nose='liver', note='non-standard'),
        cw('blue', 'Blue and white', remap={'black': '#646a74', 'white': 'white'}, nose='blue', note='non-standard'),
    ],
    'jack-russell-terrier': [
        cw('black-white', 'Black and white', remap={'white': 'white', 'tan': 'black'}),
        cw('tricolor', 'Tricolor', remap={'white': 'white', 'tan': 'black'}, layers=[L('brows', 'tan'), L('cheeks', 'tan', 0.9)]),
        cw('lemon-white', 'Lemon and white', remap={'white': 'white', 'tan': '#e2c58e'}),
        cw('all-white', 'Mostly white', base='white', layers=[L('ears', 'tan')]),
    ],
    'miniature-schnauzer': [
        cw('black', 'Black', remap={'grey': 'black', 'light': '#2b2a2a'}),
        cw('black-silver', 'Black and silver', remap={'grey': 'black', 'light': 'silver'}, layers=POINTS('silver')),
        cw('white', 'White', base='white'),
        cw('liver', 'Liver', remap={'grey': 'liver', 'light': '#9a6b52'}, nose='liver', note='non-standard'),
    ],
    'samoyed': [
        cw('biscuit', 'Biscuit', base='#e8d3ad'),
        cw('cream', 'Cream', base='cream'),
        cw('white-biscuit', 'White and biscuit', base='white', layers=[L('ears', 'biscuit'), L('saddle', '#ead9bb', 0.6)]),
    ],
    'greyhound': [
        cw('brindle', 'Brindle', remap={'slate': '#9a7650', 'white': 'white'}, layers=[L('brindle', '#2a201b', 0.85, on=['slate'])]),
        cw('fawn', 'Fawn', remap={'slate': 'fawn', 'white': 'white'}),
        cw('black', 'Black', remap={'slate': 'black', 'white': 'white'}),
        cw('red', 'Red', remap={'slate': '#a6602f', 'white': 'white'}, nose='liver'),
        cw('white-black', 'White and black', base='white', layers=[L('head_cap', 'black'), L('piebald_large', 'black')]),
        cw('blue', 'Blue', remap={'slate': '#5d636d', 'white': 'white'}, nose='blue'),
    ],
}



# Looks: colorways that let a body pass for another breed (`like`). Trim freely.
LOOKS = {
    'labrador-retriever': [
        cw('gsp-liver-roan', 'Liver roan, liver head', base='white', layers=[L('roan', 'liver', 0.9), L('head_cap', 'liver'), L('piebald_large', 'liver')], nose='liver', like='German Shorthaired Pointer'),
        cw('gsp-solid-liver', 'Solid liver', base='liver', nose='liver', like='German Shorthaired Pointer'),
        cw('vizsla', 'Golden rust', base='#b5652f', nose='liver', like='Vizsla'),
        cw('weimaraner', 'Mouse grey', base='#9c9890', nose='grey', like='Weimaraner'),
        cw('ridgeback', 'Wheaten, dark muzzle', base='#c08a50', layers=[L('mask', '#3a2a20', 0.6)], like='Rhodesian Ridgeback'),
        cw('chesapeake', 'Deadgrass brown', base='#8a6640', nose='liver', like='Chesapeake Bay Retriever'),
    ],
    'golden-retriever': [
        cw('toller', 'Red with white marks', base='#c4682e', layers=[L('irish', 'white')], like='Nova Scotia Duck Tolling Retriever'),
        cw('irish-setter', 'Mahogany', base='#8f3a1e', nose='liver', like='Irish Setter'),
        cw('flat-coat', 'Black', base='black', like='Flat-Coated Retriever'),
    ],
    'beagle': [
        cw('bluetick', 'Blue ticked with tan', remap={'tan': 'tan', 'black': 'black', 'white': '#a9aeb6'}, layers=[L('roan', '#25272c', 0.95, on=['white'])], like='Bluetick Coonhound'),
        cw('redbone', 'Solid red', base='#9a4520', like='Redbone Coonhound'),
    ],
    'boxer': [
        cw('pit-blue', 'Blue, white chest', base='#6d727b', layers=[L('chest', 'white')], nose='blue', like='American Pit Bull Terrier'),
        cw('pit-red', 'Red nose, white chest', base='#a8623a', layers=[L('chest', 'white')], nose='liver', like='American Pit Bull Terrier'),
    ],
    'great-dane': [
        cw('mastiff', 'Apricot, black mask', base='#c9a06a', layers=[L('mask', '#2a2420'), L('ears', '#2a2420', 0.8)], like='English Mastiff'),
        cw('cane-corso', 'Grey', base='#4a4846', like='Cane Corso'),
    ],
    'greyhound': [
        cw('whippet', 'White and fawn', base='white', layers=[L('head_cap', '#8a6440'), L('piebald_large', '#8a6440')], like='Whippet'),
    ],
    'australian-shepherd': [
        cw('solid-black', 'Solid black', base='black'),
        cw('solid-red', 'Solid red', base='#7a3d26', nose='liver'),
        cw('blue-heeler', 'Blue mottled, black mask', base='#8d949e', layers=[L('roan', '#25272c', 0.85), L('eyepatches', '#1d1b1a'), L('points', '#b0652f')], like='Australian Cattle Dog'),
        cw('red-heeler', 'Red mottled', base='#d2b3a0', layers=[L('roan', '#8a3d22', 0.85), L('eyepatches', '#8a3d22')], nose='liver', like='Australian Cattle Dog'),
    ],
    'border-collie': [
        cw('solid-black', 'Solid black', base='black'),
        cw('solid-red', 'Solid red', base='#6b3a24', nose='liver'),
        cw('kelpie', 'Black and tan', base='black', layers=[L('points', 'tan')], like='Australian Kelpie'),
        cw('kelpie-red', 'Red', base='#8a4a2a', nose='liver', like='Australian Kelpie'),
    ],
    'pembroke-welsh-corgi': [
        cw('cardigan-merle', 'Blue merle', remap={'red': '#9aa0a8', 'white': 'white'}, layers=[L('merle', 'black', 1.0, on=['red']), L('brows', 'copper'), L('cheeks', 'copper')], like='Cardigan Welsh Corgi'),
    ],
    'samoyed': [
        cw('keeshond', 'Wolf grey', base='#b9b6ae', layers=[L('sable', '#2a2826', 0.8), L('eyepatches', '#3a3836', 0.6)], like='Keeshond'),
        cw('chow-red', 'Red', base='#b56a35', nose='blue', like='Chow Chow'),
        cw('chow-cinnamon', 'Cinnamon', base='#c9925a', nose='blue', like='Chow Chow'),
    ],
    'chihuahua': [
        cw('min-pin', 'Stag red', base='#a3452a', like='Miniature Pinscher'),
        cw('papillon', 'White and black', base='white', layers=[L('head_cap', '#2a2422'), L('piebald_large', '#2a2422')], like='Papillon'),
        cw('papillon-red', 'White and red', base='white', layers=[L('head_cap', '#b0602f'), L('piebald_large', '#b0602f')], like='Papillon'),
    ],
    'shih-tzu': [
        cw('maltese', 'White', base='white', like='Maltese'),
        cw('havanese', 'Chocolate', base='#6b4630', nose='liver', like='Havanese'),
    ],
    'jack-russell-terrier': [
        cw('rat-terrier', 'Tricolor', base='white', layers=[L('saddle', 'black'), L('head_cap', 'black'), L('brows', 'tan'), L('cheeks', 'tan')], like='Rat Terrier'),
        cw('fox-terrier', 'White, tan head, black saddle', base='white', layers=[L('head_cap', 'tan'), L('saddle', 'black')], like='Fox Terrier'),
    ],
    'cavalier-king-charles-spaniel': [
        cw('brittany', 'Orange and white', remap={'chestnut': '#c8702f', 'white': 'white'}, nose='liver', like='Brittany'),
        cw('springer', 'Liver and white, ticked', remap={'chestnut': '#5a3020', 'white': 'white'}, layers=[L('roan', '#5a3020', 0.5, on=['white'])], nose='liver', like='English Springer Spaniel'),
        cw('cocker', 'Buff', base='#d6a464', like='Cocker Spaniel'),
    ],
}
for _b, _cws in LOOKS.items():
    SPEC[_b] = SPEC[_b] + _cws

# Marked variants: socks, boots, muzzles, blazes, bibs and eye patches (marks, no textures).
FRONT = 'fl fr'
MARKED = {
    'poodle': [
        cw('black-front-socks', 'Black, white front socks and muzzle', base='black', marks={**socks('white', 0.2, FRONT), 'muzzle': ('white', 0.45)},
           note='two white front socks and a white muzzle'),
        cw('brown-front-socks', 'Brown, white front socks and muzzle', base='chocolate', nose='liver', marks={**socks('white', 0.2, FRONT), 'muzzle': ('white', 0.45)}),
        cw('apricot-boots', 'Apricot, white boots', base='apricot', marks=socks('white', 0.3)),
    ],
    'labrador-retriever': [
        cw('black-socks-bib', 'Black, white socks and bib', base='black', marks={**socks('white', 0.1), 'bib': ('white', 0.5)}, note='mismarked'),
        cw('chocolate-boots', 'Chocolate, white boots', base='chocolate', nose='liver', marks=socks('white', 0.28), note='mismarked'),
    ],
    'french-bulldog': [
        cw('black-bib', 'Black, white bib', base='black', marks={'bib': ('white', 0.8)}),
        cw('fawn-eye-patch', 'Fawn, dark eye patch', base='fawn', marks={'eye_r': ('#2a2322', 0.75)}),
    ],
    'chihuahua': [
        cw('fawn-flashy', 'Fawn, white socks, blaze and bib', base='#c9a27c', marks={**socks('white', 0.16), 'blaze': ('white', 0.5), 'bib': ('white', 0.8)}),
        cw('black-boots', 'Black, white boots and muzzle', base='black', marks={**socks('white', 0.3), 'muzzle': ('white', 0.5), 'bib': ('white', 0.7)}),
    ],
    'boxer': [
        cw('flashy', 'Flashy fawn', remap={'fawn': 'fawn', 'white': 'white', 'mask': 'mask'}, marks={**socks('white', 0.3), 'blaze': ('white', 0.6), 'bib': ('white', 1.0)}),
        cw('pit-white-patch', 'White, brindle eye patch', base='white', marks={'eye_r': ('#7a5a40', 0.9)}, like='American Pit Bull Terrier'),
    ],
    'border-collie': [
        cw('black-boots', 'Black, white boots and blaze', base='black', marks={**socks('white', 0.3), 'blaze': ('white', 0.7), 'bib': ('white', 1.0), 'tail_tip': ('white', 1.0)}),
    ],
    'pomeranian': [
        cw('black-white-boots', 'Black, white boots and bib', base='black', marks={**socks('white', 0.3), 'bib': ('white', 1.0)}),
    ],
    'greyhound': [
        cw('black-socks-bib', 'Black, white socks and bib', remap={'slate': 'black', 'white': 'white'}, marks=socks('white', 0.16)),
        cw('fawn-blaze', 'Fawn, white blaze and socks', remap={'slate': 'fawn', 'white': 'white'}, marks={**socks('white', 0.2), 'blaze': ('white', 0.5)}),
    ],
    'dachshund': [
        cw('red-front-socks', 'Red, white front socks', base='#a0522d', marks=socks('white', 0.12, FRONT), note='non-standard'),
    ],
    'jack-russell-terrier': [
        cw('eye-patch', 'White, tan eye patch', base='white', marks={'eye_r': ('tan', 0.9)}),
    ],
    'great-dane': [
        cw('black-socks', 'Black, white socks and bib', base='black', marks={**socks('white', 0.18), 'bib': ('white', 0.7)}, note='mismarked'),
    ],
    'siberian-husky': [
        cw('black-white-mask', 'Black and white, white mask', remap={'grey': 'black', 'white': 'white'}, marks={'muzzle': ('white', 0.8)}),
    ],
}
for _b, _cws in MARKED.items():
    SPEC[_b] = SPEC[_b] + _cws

# Simple geometric layers become marks (computed in the shader, no mask texture).
AS_MARKS = {'socks': {'sock_fl': 0.25, 'sock_fr': 0.25, 'sock_hl': 0.25, 'sock_hr': 0.25}, 'eyepatch': {'eye_l': 0.7},
            'eyepatches': {'eye_l': 0.65, 'eye_r': 0.65}, 'mask': {'mask': 1.0}, 'tail_tip': {'tail_tip': 1.0},
            'blaze': {'blaze': 0.6}, 'chest': {'bib': 1.0}, 'brows': {'brows': 1.0}}
for _cws in SPEC.values():
    for _r in _cws:
        _keep = []
        for _region, _c, _a, _on in _r['layers']:
            if _region in AS_MARKS and _a == 1.0 and not _on:
                _r['marks'] = {**{k: (_c, v) for k, v in AS_MARKS[_region].items()}, **_r['marks']}
            else:
                _keep.append((_region, _c, _a, _on))
        _r['layers'] = _keep


# ---------------------------------------------------------------- regions and patterns
class Regions:
    """Soft 0..1 masks over the texture, built from the dog's skeleton and texel positions."""

    def __init__(self, d, seed, face):
        self.d, self.seed, self.cache = d, seed, {}
        self.eye, self.er = np.array(face['eye']), face['eye_r']
        J, P = d.J, d.P
        self.x, self.y, self.z = P[..., 0], P[..., 1], P[..., 2]
        self.hj, self.mo = J['head'], J['mouth']
        self.hl = np.linalg.norm(self.mo - self.hj)
        self.fwd = (self.z - self.hj[2]) / max(self.mo[2] - self.hj[2], 1e-3)
        self.head = d.bone('head', 'jaw')
        self.legs = d.bone('upperarm', 'forearm', 'hand', 'thigh', 'shin', 'foot')
        self.lower_legs = d.bone('forearm', 'hand', 'shin', 'foot')
        self.tail = d.bone('tail')
        self.neck = d.bone('neck')
        self.body = np.clip(1 - self.head - self.legs - self.tail - self.neck, 0, 1)
        self.spine_y = J['hips'][1]
        hw = np.abs(self.x[(self.head > 0.5) & d.good])
        self.head_w = np.percentile(hw, 90) if len(hw) else 0.12
        self.noise = Noise3(seed)

    def get(self, name):
        if name not in self.cache:
            self.cache[name] = np.clip(getattr(self, name)(), 0, 1) * self.d.cover
        return self.cache[name]

    # face
    def mask(self):
        return self.head * smooth(self.fwd, 0.35, 0.55)

    def muzzle_sides(self):
        return self.head * smooth(self.fwd, 0.6, 0.75) * smooth(np.abs(self.x), 0.25 * self.head_w, 0.45 * self.head_w) * \
            (1 - smooth(self.y, self.mo[1] + 0.1 * self.hl, self.mo[1] + 0.2 * self.hl))

    def brows(self):
        # a dot above each eye
        c = self.eye + [0, 1.6 * self.er, -0.5 * self.er]
        d = np.minimum(np.linalg.norm(self.d.P - c, axis=-1), np.linalg.norm(self.d.P - c * [-1, 1, 1], axis=-1))
        return self.head * (1 - smooth(d, 0.75 * self.er, 1.05 * self.er))

    def cheeks(self):
        return self.head * smooth(self.fwd, 0.35, 0.5) * (1 - smooth(self.y, self.mo[1] + 0.05 * self.hl, self.mo[1] + 0.2 * self.hl)) * \
            smooth(np.abs(self.x), 0.35 * self.head_w, 0.55 * self.head_w) * (1 - smooth(self.fwd, 0.7, 0.82))

    def eyepatch(self):
        # a round patch around the dog's left eye, edge roughened a little
        d = np.linalg.norm(self.d.P - self.eye, axis=-1) + 0.012 * (self.noise(self.d.P + 5.1, 12) - 0.5)
        return self.head * (1 - smooth(d, 2.0 * self.er, 2.2 * self.er))

    def blaze(self):
        return self.head * smooth(self.fwd, 0.25, 0.4) * (1 - smooth(np.abs(self.x), 0.1 * self.head_w, 0.2 * self.head_w))

    def ears(self):
        return smooth(self.head, 0.4, 0.6) * smooth(self.y, self.mo[1] + 0.5 * self.hl, self.mo[1] + 0.65 * self.hl) * smooth(np.abs(self.x), 0.25 * self.head_w, 0.4 * self.head_w)

    def ears_inner(self):
        return self.ears() * smooth(self.fwd, 0.15, 0.3)

    # body
    def chest(self):
        cz = self.d.J['chest'][2]
        return np.clip(self.body + self.neck, 0, 1) * smooth(self.z, cz - 0.02, cz + 0.06) * \
            (1 - smooth(self.y, self.spine_y + 0.05, self.spine_y + 0.2)) * (1 - smooth(np.abs(self.x), 0.08, 0.14))

    def chest_spots(self):
        # two small slanted marks on the forechest
        cz = self.d.J['chest'][2]
        u, v = np.abs(self.x) - 0.065, self.y - (self.spine_y + 0.03)
        a = np.radians(25)
        uu, vv = u * np.cos(a) - v * np.sin(a), u * np.sin(a) + v * np.cos(a)
        d = np.sqrt((uu / 0.022) ** 2 + (vv / 0.038) ** 2)
        return np.clip(self.body + self.neck, 0, 1) * smooth(self.z, cz, cz + 0.05) * (1 - smooth(d, 0.85, 1.0))

    def points(self):
        return np.max([self.get(r) for r in TAN_POINTS], axis=0)

    def irish(self):
        return np.max([self.get(r) for r in ('blaze', 'collar', 'chest', 'socks', 'tail_tip')], axis=0)

    def collar(self):
        return smooth(self.neck, 0.4, 0.7) * (1 - smooth(self.head, 0.1, 0.3))

    def socks(self):
        return self.lower_legs * (1 - smooth(self.y, 0.18 * self.spine_y, 0.32 * self.spine_y))

    def legs_outer(self):
        return self.legs * (1 - smooth(self.y, 0.45 * self.spine_y, 0.7 * self.spine_y))

    def vent(self):
        tb = self.d.J['tail.1']
        d = np.linalg.norm(self.d.P - (tb - np.array([0, 0.06, 0])), axis=-1)
        return (1 - smooth(d, 0.04, 0.08)) * (1 - self.head)

    def tail_tip(self):
        tt = self.d.J.get('tail.tip', self.d.J['tail.1'])
        tl = max(np.linalg.norm(tt - self.d.J['tail.1']), 0.05)
        return self.tail * (1 - smooth(np.linalg.norm(self.d.P - tt, axis=-1), 0.25 * tl, 0.4 * tl))

    def saddle(self):
        hz, cz = self.d.J['hips'][2], self.d.J['chest'][2]
        return np.clip(self.body + self.tail * 0.5, 0, 1) * smooth(self.y, self.spine_y + 0.03, self.spine_y + 0.1) * \
            smooth(self.z, hz - 0.08, hz) * (1 - smooth(self.z, cz, cz + 0.08))

    def mantle_white(self):
        # Boston-pattern Dane: white blaze, collar, chest, legs and tail tip on black.
        return np.clip(self.blaze() + self.collar() * 0.9 + self.chest() + self.socks() +
                       self.legs * (1 - smooth(self.y, 0.35 * self.spine_y, 0.5 * self.spine_y)) + self.tail_tip(), 0, 1)

    # patterns: bold, clean shapes (crisp edges, few sizes) suit the chunky toys better
    # than fine fur-like noise
    def surface_points(self, n, seed, where=None):
        """n random points spread evenly over the dog's surface (by mesh area);
        `where(points) -> bool` keeps only some of them."""
        d = self.d
        rng = np.random.default_rng(self.seed * 7 + seed)
        tri = d.pos[d.idx]
        area = np.linalg.norm(np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]), axis=1)
        k = rng.choice(len(tri), size=n * 4, p=area / area.sum())
        u, v = rng.random((2, n * 4))
        flip = u + v > 1
        u[flip], v[flip] = 1 - u[flip], 1 - v[flip]
        pts = tri[k, 0] + (tri[k, 1] - tri[k, 0]) * u[:, None] + (tri[k, 2] - tri[k, 0]) * v[:, None]
        if where is not None:
            pts = pts[where(pts)]
        return pts[:n], rng

    def blobs(self, pts, radii, warp=0.0, edge=0.08):
        """Crisp round-ish patches at pts (one radius each), edges roughened by noise."""
        P = self.d.P.reshape(-1, 3)
        if warp:
            w = np.stack([self.noise(self.d.P + o, 9) - 0.5 for o in (0.7, 3.9, 8.1)], -1).reshape(-1, 3)
            P = P + w * warp
        dist, k = cKDTree(pts).query(P, k=min(8, len(pts)))
        dist, k = dist.reshape(len(P), -1), k.reshape(len(P), -1)
        f = (dist / radii[k]).min(1).reshape(self.d.P.shape[:2])
        return 1 - smooth(f, 1 - edge, 1)

    def top_shade(self, low, high):
        """A soft wash over the back, top of the head, ears and the top of the tail."""
        top = smooth(self.y, self.spine_y + low, self.spine_y + high)
        crown = self.head * smooth(self.y, self.mo[1] + 0.3 * self.hl, self.mo[1] + 0.65 * self.hl) * \
            (1 - smooth(self.fwd, 0.55, 0.8))
        return np.clip(top * (1 - self.legs) * (1 - self.head) + crown + self.tail * smooth(self.y, self.spine_y - 0.05, self.spine_y + 0.1),
                       0, 1)

    def sable(self):
        # a smooth dark wash over the back (no low-frequency noise: it read as lumps)
        return self.top_shade(-0.08, 0.08) * (0.9 + 0.1 * smooth(self.noise(self.d.P, 22), 0.3, 0.7))

    def sesame(self):
        # Black tipping over the red: heaviest along the back and the crown, fading down the
        # sides, with a little hair-scale texture.
        return self.top_shade(-0.04, 0.12) * (0.7 + 0.3 * smooth(self.noise(self.d.P + 4.4, 30), 0.35, 0.65))

    def torn(self, scale, thresh, warp, offset, edge=0.012):
        """Ragged ink-like patches: noise thresholded after a strong domain warp."""
        P = self.d.P
        w = np.stack([self.noise(P + o, scale * 0.6) - 0.5 for o in (offset + 0.7, offset + 3.9, offset + 8.1)], -1)
        n = self.noise(P + w * warp + offset, scale)
        return n, smooth(n, thresh, thresh + edge)

    def merle(self):
        # Like the original Aussie: scattered small-to-medium torn patches over the dilute
        # base, a few larger ones, a little heavier on the head and ears.
        _, mid = self.torn(11, 0.63, 0.18, 11.0, 0.015)
        _, small = self.torn(22, 0.67, 0.12, 23.0, 0.02)
        _, marble = self.torn(8, 0.55, 0.2, 5.0, 0.04)          # mottled mid-tone between patches
        return np.clip(mid + small + 0.3 * marble, 0, 1) * self.merle_fade()

    def merle_fade(self):
        # merle stays off the face around the eyes and the inside of the ears (distracting)
        face = smooth(self.head, 0.4, 0.7) * smooth(self.fwd, 0.3, 0.5)
        return 1 - 0.9 * np.clip(face + self.get('ears_inner'), 0, 1)

    def merle_bold(self):
        # merle patches only, no mid-tone mottle: a clean two-tone base to recolor from
        _, mid = self.torn(11, 0.63, 0.18, 11.0, 0.015)
        _, small = self.torn(22, 0.67, 0.12, 23.0, 0.02)
        return np.clip(mid + small, 0, 1)

    def harlequin(self):
        # Bold torn black patches on white, fewer and bigger than merle.
        _, big = self.torn(4.5, 0.58 - 0.04 * self.head, 0.3, 31.0, 0.008)
        _, small = self.torn(13, 0.69, 0.2, 47.0, 0.015)
        return np.clip(big + small, 0, 1) * (1 - self.lower_legs * 0.4)

    def underside(self):
        return np.clip(self.body + self.neck, 0, 1) * (1 - smooth(self.y, self.spine_y * 0.55, self.spine_y * 0.85))

    def parti(self):
        # White legs, chest, belly and blaze (a parti Yorkie: blue saddle, tan head).
        legs = self.lower_legs * (1 - smooth(self.y, 0.3 * self.spine_y, 0.45 * self.spine_y))
        return np.max([self.get('blaze'), self.get('chest'), legs], axis=0)

    def piebald_large(self):
        # A few big patches over the back and flanks.
        pts, rng = self.surface_points(5, 4, lambda p: (p[:, 1] > self.spine_y - 0.02) & (np.abs(p[:, 0]) < 0.2))
        # crisp: a patch is there or it isn't (gated by thresholded bone weights, not soft ones)
        return self.blobs(pts, rng.uniform(0.13, 0.2, len(pts)), warp=0.08, edge=0.06) * \
            (1 - smooth(self.lower_legs, 0.4, 0.6)) * (1 - smooth(self.head, 0.4, 0.6))

    def head_cap(self):
        # Colored head (ears, eyes, crown) with a white blaze and muzzle.
        # head weight, plus neck weight up on the head (many faces are partly on the neck bone)
        head = smooth(self.head + self.neck * smooth(self.y, self.mo[1], self.mo[1] + 0.2 * self.hl), 0.3, 0.55)
        return head * (1 - self.get('blaze')) * (1 - smooth(self.fwd, 0.6, 0.7) * (1 - smooth(self.y, self.mo[1] + 0.25 * self.hl, self.mo[1] + 0.35 * self.hl)))

    def brindle(self):
        # Wavy stripes: rings around the body and tail, bands around the legs.
        warp = self.noise(self.d.P, 4) - 0.5
        wob = self.noise(self.d.P + 2.5, 11) - 0.5
        phase = (1 - self.legs) * (self.z * 62 + self.y * 10) + self.legs * self.y * 70
        stripes = np.sin(phase + warp * 9 + wob * 3)
        width = 0.15 + 0.3 * (self.noise(self.d.P + 7.7, 6) - 0.5)
        # stripes are rings along the body: fade them where the surface faces forward or back
        # (chest front, rump), where rings would show as bullseyes
        facing = 1 - smooth(np.abs(self.d.N[..., 2]), 0.55, 0.8) * (1 - self.legs)
        return smooth(stripes, width, width + 0.18) * (1 - self.mask() * 0.7) * (1 - self.head * 0.5) * facing

    def eyepatches(self):
        # a patch around each eye (cattle dog mask, Keeshond spectacles)
        d = np.minimum(np.linalg.norm(self.d.P - self.eye, axis=-1), np.linalg.norm(self.d.P - self.eye * [-1, 1, 1], axis=-1))
        d = d + 0.012 * (self.noise(self.d.P + 5.1, 12) - 0.5)
        return self.head * (1 - smooth(d, 1.9 * self.er, 2.1 * self.er))

    def husky_face(self):
        # white face with a dark cap and a dark stripe down the forehead to between the eyes
        hw, ey, er = self.head_w, self.eye[1], self.er
        front = smooth(self.head + self.neck, 0.3, 0.6) * smooth(self.fwd, 0.05, 0.2)
        stripe = (1 - smooth(np.abs(self.x), 0.13 * hw, 0.19 * hw)) * smooth(self.y, ey + 0.3 * er, ey + 0.9 * er) * \
            (1 - smooth(self.fwd, 0.6, 0.7))
        # the top of the head stays dark, dipping lower toward the ears
        cap = smooth(self.y + 0.6 * np.abs(self.x), ey + 2.0 * er, ey + 2.6 * er)
        return front * (1 - stripe) * (1 - cap)

    def roan(self):
        # dense fine ticking: reads as a mixed (roan / blue heeler) coat
        pts, rng = self.surface_points(2600, 6)
        return self.blobs(pts, rng.uniform(0.004, 0.009, len(pts)), edge=0.3)

    def spots(self):
        # Dalmatian spots: round, crisp, mixed sizes, smaller on the legs and face
        pts, rng = self.surface_points(170, 7)
        r = rng.uniform(0.014, 0.032, len(pts))
        P = self.d.P
        m = self.blobs(pts, r, warp=0.01, edge=0.08)
        return m * (1 - 0.6 * self.get('mask'))

    def ticking(self):
        pts, rng = self.surface_points(900, 5)
        return self.blobs(pts, rng.uniform(0.006, 0.013, len(pts)), edge=0.25) * (1 - self.head * 0.6)


# ---------------------------------------------------------------- markings ("genes")
# Simple markings computed from each texel's rest position and bone weights, with no
# texture: the shader (dogcoat.js) runs the same formulas per pixel, so a game can set them
# per dog from a few numbers (a breeding game's genes). Each mark: a color and a size
# (0 = off). Sizes are 0..1; socks are a height up the leg (0.12 socks, 0.3 boots,
# 0.55 stockings).
MARKS = ['sock_fl', 'sock_fr', 'sock_hl', 'sock_hr', 'muzzle', 'blaze', 'bib', 'eye_l', 'eye_r', 'mask',
         'tail_tip', 'brows']
LEG_GROUPS = [('upperarm.L', 'forearm.L', 'hand.L'), ('upperarm.R', 'forearm.R', 'hand.R'),
              ('thigh.L', 'shin.L', 'foot.L'), ('thigh.R', 'shin.R', 'foot.R')]


def geo_info(d, breed):
    """Landmarks the marks need (rest pose, glTF space), also written to coats.json."""
    J, F = d.J, FACES[breed]
    tip = J.get('tail.tip', J.get('tail.3', J['hips']))
    lo, hi = d.pos.min(0), d.pos.max(0)
    return {'bbox': [np.round(lo, 5).tolist(), np.round(hi, 5).tolist()],   # undoes mesh quantization (dogcoat.js)
            'eye': list(F['eye']), 'eye_r': F['eye_r'], 'nose': list(F['nose']), 'head': J['head'].round(4).tolist(),
            'chest': J['chest'].round(4).tolist(), 'spine_y': round(float(J['hips'][1]), 4), 'tail_tip': np.round(tip, 4).tolist()}


def hash3(p):
    p = (p * 0.3183099 + 0.1) % 1.0 * 17.0
    return (p[..., 0] * p[..., 1] * p[..., 2] * (p[..., 0] + p[..., 1] + p[..., 2])) % 1.0


def vnoise(x):
    """Value noise, same as noise3() in dogcoat.js."""
    i, f = np.floor(x), x - np.floor(x)
    f = f * f * (3 - 2 * f)
    out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (f[..., 0] if dx else 1 - f[..., 0]) * (f[..., 1] if dy else 1 - f[..., 1]) * (f[..., 2] if dz else 1 - f[..., 2])
                out = out + w * hash3(i + np.array([dx, dy, dz], float))
    return out


def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def mark_masks(d, geo):
    """Per-texel inputs for the marks: rest position and group weights (like the shader's
    varyings: interpolated from the vertices)."""
    def grp(names):
        cols = [i for i, n in enumerate(d.joint_names) if n in names]
        return d.Wt[..., cols].sum(-1)
    legs = [grp(g) for g in LEG_GROUPS]
    head = grp(('head', 'jaw', 'mouth', 'neck'))   # big-headed dogs put much of the face on the neck bone
    tail = d.bone('tail')
    return {'P': d.P, 'legs': legs, 'head': head, 'tail': tail}


def mark_value(name, a, g, geo):
    """0..1 coverage of one mark of size a. Mirrors markValue() in dogcoat.js."""
    P = g['P']
    x, y, z = P[..., 0], P[..., 1], P[..., 2]
    n = vnoise(P * 14.0) - 0.5
    eye, er, nose, head, chest = (np.array(geo[k]) if isinstance(geo[k], list) else geo[k] for k in ('eye', 'eye_r', 'nose', 'head', 'chest'))
    sy = geo['spine_y']
    hw = ss(0.4, 0.6, g['head'])
    fwd = (z - head[2]) / max(nose[2] - head[2], 1e-3)
    if name.startswith('sock'):
        k = ['sock_fl', 'sock_fr', 'sock_hl', 'sock_hr'].index(name)
        cut = a * sy
        return ss(0.35, 0.65, g['legs'][k]) * (1 - ss(cut - 0.004, cut + 0.004, y + 0.012 * n))
    if name == 'muzzle':
        # round patch around the nose and mouth, below the eyes
        r = a * 0.16
        dd = np.linalg.norm(P - (nose - np.array([0, 0.5 * er, 0.3 * er])), axis=-1) + 0.012 * n
        return hw * (1 - ss(r - 0.004, r + 0.004, dd)) * (1 - ss(eye[1] - 0.8 * er, eye[1] - 0.3 * er, y))
    if name == 'blaze':
        w = a * 0.08
        return hw * ss(0.05, 0.15, fwd) * (1 - ss(w - 0.004, w + 0.004, np.abs(x) - 0.02 * n)) * ss(nose[1] - er, nose[1], y)
    if name == 'bib':
        # rounded patch on the front of the chest, between the front legs
        body = np.clip(1 - sum(g['legs']) - g['tail'] - g['head'], 0, 1) + g['head'] * (1 - ss(0.3, 0.7, fwd))
        cy = sy - 0.06
        dd = np.sqrt((x / (a * 0.12 + 1e-4)) ** 2 + ((y - cy) / (a * 0.2 + 1e-4)) ** 2) + 0.15 * n
        return ss(0.4, 0.6, np.clip(body, 0, 1)) * ss(chest[2] - 0.06, chest[2] + 0.0, z) * (1 - ss(0.95, 1.05, dd))
    if name in ('eye_l', 'eye_r'):
        e = eye * ([1, 1, 1] if name == 'eye_l' else [-1, 1, 1])
        dd = np.linalg.norm(P - e, axis=-1) + 0.012 * n
        r = a * 3 * er
        return hw * (1 - ss(r - 0.003, r + 0.003, dd))
    if name == 'mask':
        t = 1 - 0.75 * a
        return hw * ss(t - 0.03, t + 0.03, fwd)
    if name == 'tail_tip':
        r = a * 0.12
        return ss(0.5, 0.8, g['tail']) * (1 - ss(r - 0.005, r + 0.005, np.linalg.norm(P - np.array(geo['tail_tip']), axis=-1)))
    if name == 'brows':
        c = eye + np.array([0, 1.6 * er, -0.5 * er])
        dd = np.minimum(np.linalg.norm(P - c, axis=-1), np.linalg.norm(P - c * [-1, 1, 1], axis=-1))
        r = a * 1.05 * er
        return hw * (1 - ss(r - 0.003, r + 0.003, dd))
    raise KeyError(name)


# ---------------------------------------------------------------- nose leather
def nose_mask(d, breed, lab):
    """The painted nose (sides of the sculpted nose; rig.py puts glossy geometry on the
    front). Follows the original's dark shape where there is one, else a round patch."""
    nose = np.array(FACES[breed]['nose'])
    hl = np.linalg.norm(d.J['mouth'] - d.J['head'])
    L = lab[..., 0]
    dist = np.linalg.norm(d.P - nose, axis=-1)
    core = d.cover & (dist < 0.01)
    ring = d.cover & (dist > 0.075) & (dist < 0.095)
    Lc = np.median(L[core]) if core.any() else 50
    Lr = np.median(L[ring]) if ring.any() else 50
    if Lr - Lc > 15:
        m = smooth(Lc + 0.5 * (Lr - Lc) + 3 - L, 0, 6) * (1 - smooth(dist, 0.07, 0.075))
    else:
        r = min(0.2 * hl, 0.055)
        m = 1 - smooth(dist, r - 0.002, r + 0.002)
    return m * smooth(d.bone('head', 'jaw'), 0.2, 0.5) * d.cover


# ---------------------------------------------------------------- coat masks + palettes
# A colorway is not a texture: it is a small palette applied to per-breed masks.
#   channels  coat   how much the texel is coat (0 keeps the original: inner ears, lips...)
#             nose   nose leather;  srcK: the breed's original color areas (src0 is the rest)
#             layerK markings (tan points, merle, saddle...), listed per breed in coats.json
#   Shading and fur detail come from the original texture itself: its lightness against the
#   breed's source colors (ref_l in coats.json), so no channel stores them.
#   Channels are packed tightly per breed into RGBA PNGs (coats.json `channels`: texture,
#   component, kind). Crisp masks are stored as distance fields (`sdf`, 0.5 = the edge) at
#   256 px; soft ones (`lin`) at 256 px unless they need 512 for detail.
#   palette per colorway: a color per source area, a color + strength per layer, a nose.
# recolor(): the exact math the shader runs (dogcoat.js), used to bake previews / textures.
SDF_RANGE = 8.0   # texels (at 512) either side of an edge that a distance field encodes
LUMA = np.array([0.2126, 0.7152, 0.0722])


def lin(hexcol):
    h = col(hexcol).lstrip('#')
    c = np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, 12.92 * c, 1.055 * c ** (1 / 2.4) - 0.055)


def layer_key(region, on):
    return region + (':' + '+'.join(on) if on else '')


def breed_layers(breed, recipes=None):
    keys = []
    for r in (SPEC.get(breed, []) if recipes is None else recipes):
        for region, _c, _a, on in r['layers']:
            k = layer_key(region, on)
            if k not in keys:
                keys.append(k)
    assert len(keys) <= 10, (breed, keys)
    return keys


def build_masks(d, breed, seed, sources=None, layers=None, keep_details=True):
    """Channel masks for a breed (dict name -> HxW 0..1) and its layer list."""
    sources = sources or SOURCES[breed]
    names = list(sources)
    tex = d.repaired_texture()
    lab = srgb_to_lab(tex)
    best_d = np.full(lab.shape[:2], 1e9)
    best_src = np.zeros(lab.shape[:2], int)
    best_ref = np.zeros_like(lab)
    for k, n in enumerate(names):
        for h in sources[n]:
            s = hex_lab(h)
            dd = np.linalg.norm(lab - s, axis=-1)
            better = dd < best_d
            best_d[better], best_src[better], best_ref[better] = dd[better], k, s
    coat_w = 1 - smooth(best_d, 22, 34)
    shade_L = lab[..., 0] - best_ref[..., 0]
    R = Regions(d, seed, FACES[breed])
    # each source area's typical lightness: shading = the original's lightness against it
    ref_l = [float(np.median(lab[..., 0][(best_src == k) & (coat_w > 0.5) & d.good])) if ((best_src == k) & (coat_w > 0.5)).any()
             else 50.0 for k in range(len(names))]
    # Lip lines and other dark details on the face keep their original color.
    face = d.bone('head', 'jaw') * smooth(R.fwd, 0.2, 0.35)
    feat = face * smooth(-shade_L, 7, 14) * smooth(40 - lab[..., 0], 0, 10)
    keep = np.clip(feat * keep_details + (1 - coat_w) * (d.bone('head', 'jaw') > 0.3), 0, 1)
    nose = np.zeros(lab.shape[:2])   # the nose geometry is the nose (rig.py): a solid blob, nothing painted under it
    geo = geo_info(d, breed)
    ch = {'_geo': geo, '_marks': mark_masks(d, geo), '_refL': [round(v, 2) for v in ref_l], 'coat': np.clip(coat_w * (1 - keep), 0, 1) * (1 - nose) + nose,
          'nose': nose}
    for k in range(1, 4):
        ch[f'src{k}'] = (best_src == k).astype(float) if k < len(names) else np.zeros(lab.shape[:2])
    layers = breed_layers(breed) if layers is None else layers
    for i, key in enumerate(layers):
        region, _, on = key.partition(':')
        m = R.get(region)
        if on:
            m = m * np.isin(best_src, [names.index(o) for o in on.split('+')])
        ch[f'layer{i}'] = m
    return ch, layers, tex


def palette(breed, recipe, layers, sources=None):
    """A recipe (base / remap / layers / nose) as a palette for this breed's masks."""
    sources = sources or SOURCES[breed]
    names = list(sources)
    src = []
    for n in names:
        tgt = recipe['remap'].get(n) if recipe['remap'] else None
        if tgt == n or (tgt is None and not recipe['base']):
            src.append(sources[n][0])
        else:
            src.append(col(tgt or recipe['base']))
    lay = [[col('#000000'), 0.0] for _ in layers]
    for region, c, a, on in recipe['layers']:
        lay[layers.index(layer_key(region, on))] = [col(c), a]
    marks = {k: [col(c), a] for k, (c, a) in (recipe.get('marks') or {}).items()}
    return {'src': src, 'layers': lay, 'nose': NOSE[recipe['nose'] or 'black'], **({'marks': marks} if marks else {})}


def shade_offset(ch, orig):
    """Lightness of each texel against its own source color (fur detail and form shading)."""
    ref = ch['_refL'] + [ch['_refL'][0]] * (4 - len(ch['_refL']))
    Lref = ref[0] + sum(ch[f'src{k}'] * (ref[k] - ref[0]) for k in range(1, 4))
    return np.clip(116 * np.cbrt(np.maximum(orig @ LUMA, 1e-5)) - 16 - Lref, -25, 25)


def recolor(ch, tex, pal, shade=None):
    """Palette + masks -> sRGB texture. Same math as the shader in dogcoat.js."""
    src = [lin(h) for h in pal['src']] + [lin(pal['src'][0])] * (4 - len(pal['src']))
    c = src[0] + sum(ch[f'src{k}'][..., None] * (src[k] - src[0]) for k in range(1, 4))
    for i, (h, a) in enumerate(pal['layers']):
        c = c + (lin(h) - c) * (ch[f'layer{i}'] * a)[..., None]
    marks = pal.get('marks') or {}
    for name in MARKS:   # fixed order, as in the shader
        if name in marks and marks[name][1] > 0:
            h, a = marks[name]
            c = c + (lin(h) - c) * mark_value(name, a, ch['_marks'], ch['_geo'])[..., None]
    orig = np.where(tex <= 0.04045, tex / 12.92, ((tex + 0.055) / 1.055) ** 2.4)
    ref = ch['_refL'] + [ch['_refL'][0]] * (4 - len(ch['_refL']))
    Lref = ref[0] + sum(ch[f'src{k}'] * (ref[k] - ref[0]) for k in range(1, 4))
    if shade is None:
        shade = shade_offset(ch, orig)
    Y = np.maximum(c @ LUMA, 1e-5)
    Lc = 116 * np.cbrt(Y) - 16
    k = 0.85 - 0.45 * smooth(np.abs(Lc - 50), 25, 45)
    L2 = np.clip(Lc + shade * k, 0, 100)
    c = c * (((L2 + 16) / 116) ** 3 / Y)[..., None]
    out = orig + (c - orig) * ch['coat'][..., None]
    out = out + (lin(pal['nose']) - out) * ch['nose'][..., None]   # footprint under the nose bead, unshaded
    return to_srgb(out)


CHANNELS = ['coat', 'nose', 'src1', 'src2', 'src3'] + [f'layer{i}' for i in range(10)]


def _down(img):
    return img.reshape(img.shape[0] // 2, 2, img.shape[1] // 2, 2).mean((1, 3))


def _up(img, H, W):
    return np.asarray(Image.fromarray(img.astype(np.float32), 'F').resize((W, H), Image.BILINEAR))


def _sdf(m):
    from scipy.ndimage import distance_transform_edt
    b = m > 0.5
    sd = distance_transform_edt(~b) - distance_transform_edt(b)   # + outside, texels
    return np.clip(0.5 - sd / (2 * SDF_RANGE), 0, 1)


def _from_sdf(v, texel=1.0):
    e = 0.75 * texel / (2 * SDF_RANGE)
    return smooth(v, 0.5 - e, 0.5 + e)


SDF_TOL = float(os.environ.get('SDF_TOL', 0.008))   # mean edge error allowed at 256 px
LIN_TOL = float(os.environ.get('LIN_TOL', 0.04))


def encode_channel(d, m):
    """Pick a storage for one channel: (kind, size, image). Distance field for crisp masks,
    plain coverage for soft ones; 256 px unless that loses detail."""
    m = d.dilate(np.clip(m, 0, 1))
    cov = d.cover
    on = m[cov] > 0.08
    mid = ((m[cov] > 0.08) & (m[cov] < 0.92)).sum() / max(on.sum(), 1)
    H, W = m.shape
    if mid < 0.2:
        sd = _sdf(m)
        small = _down(sd)
        back = _from_sdf(_up(small, H, W))
        if np.mean(np.abs(back - (m > 0.5))[cov]) < SDF_TOL:
            return 'sdf', W // 2, small
        return 'sdf', W, sd
    small = _down(m)
    err = np.abs(_up(small, H, W) - m)[cov]
    if np.mean(err) < LIN_TOL:   # fine patterns (merle, brindle, roan) hold up at 256 on these little dogs
        return 'lin', W // 2, small
    return 'lin', W, m


def write_masks(d, ch, path_stem):
    """Pack the used channels into RGBA PNGs grouped by size. Returns (files, layout)."""
    enc = {}
    for name in CHANNELS:
        if name in ch and np.any(ch[name][d.cover] > 0.002):
            enc[name] = encode_channel(d, ch[name])
    files, layout = [], {}
    for size in sorted({e[1] for e in enc.values()}):
        names = [n for n in CHANNELS if n in enc and enc[n][1] == size]
        for g in range(0, len(names), 4):
            group = names[g:g + 4]
            img = np.zeros((size, size, 4))
            for c, n in enumerate(group):
                img[..., c] = enc[n][2]
                layout[n] = [len(files), c, enc[n][0]]
            p = f'{path_stem}-{len(files)}.png'
            # RGB / RGBA only: browsers read grey PNGs as (L, L, L, A), which would scramble components
            mode = 'RGBA' if len(group) == 4 else 'RGB'
            if len(group) == 1:   # one channel: stored grey (R = G = B), so it compresses well as ETC1S
                img[..., 1] = img[..., 2] = img[..., 0]
            data = (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)
            Image.fromarray(data[..., :len(mode)], mode).save(p, optimize=True)
            files.append({'file': os.path.basename(p), 'size': size, 'channels': len(group)})
    return files, layout


def decode_masks(d, files, layout, out_dir):
    """The channels as the shader sees them (from the PNGs), for faithful bakes."""
    imgs = []
    for f in files:
        a = np.asarray(Image.open(os.path.join(out_dir, f['file'])), dtype=np.float64) / 255
        a = a.reshape(a.shape[0], a.shape[1], -1)
        imgs.append((a, f['size']))
    out = {}
    for n in CHANNELS:
        if n not in layout:
            out[n] = np.zeros((d.H, d.W))
            continue
        t, c, kind = layout[n]
        a, size = imgs[t]
        v = _up(a[..., c], d.H, d.W)
        out[n] = _from_sdf(v, d.W / size) if kind == 'sdf' else v
    return out


def save_variant(d, rgb, out_path, nose=None):
    """The rigged GLB with a new coat texture; the nose's vertex colors (face material,
    _PART 2) take the colorway's nose color, so engines without dogcoat.js get it too."""
    buf = io.BytesIO()
    Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).save(buf, 'JPEG', quality=88)
    import copy
    doc = copy.deepcopy(d.doc)
    binary = replace_image(doc, d.binary, d.image_index, buf.getvalue())
    if nose:
        c = lin(nose)
        for prim in doc['meshes'][0]['primitives']:
            A = prim['attributes']
            if 'COLOR_0' not in A or '_PART' not in A:
                continue
            part = accessor(doc, binary, A['_PART'])[:, 0]
            acc = doc['accessors'][A['COLOR_0']]
            view = doc['bufferViews'][acc['bufferView']]
            comps = {'VEC3': 3, 'VEC4': 4}[acc['type']]
            size = {5126: 4, 5123: 2, 5121: 1}[acc['componentType']]
            stride = view.get('byteStride', comps * size)
            off = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
            scale = {5126: 1.0, 5123: 65535.0, 5121: 255.0}[acc['componentType']]
            fmt = {5126: '<f', 5123: '<H', 5121: '<B'}[acc['componentType']]
            for i in np.nonzero(np.abs(part - 2) < 0.5)[0]:
                for k in range(3):
                    v = c[k] if scale == 1.0 else int(round(c[k] * scale))
                    struct.pack_into(fmt, binary, off + i * stride + k * size, v)
    write_glb(out_path, doc, binary)


# ---------------------------------------------------------------- base coat preparation
# Run once on each freshly rigged dog (rig.py writes the AI texture again on every re-rig):
#  - the painted eyes under the eye geometry are painted out with the fur around them;
#  - breeds whose AI coat pattern is broken on the back (it was guessed from front/side
#    views) get their pattern repainted in 3D from a recipe, so it wraps without seams.
# The GLB is marked (asset.extras.coat_prepared) so it isn't done twice.
REBASE = {
    'dalmatian': (cw('base', 'Original', base='white', layers=[L('spots', '#1d1b1a'), L('ears', '#1d1b1a')]),
                  {'white': ['#eeedea'], 'spots': ['#1d1b1a']}),
    'australian-shepherd': (cw('base', 'Original', base='#8d9097', layers=[L('merle_bold', '#232326'), L('points', '#b0652f'), L('irish', 'white')]),
                            {'blue': ['#8d9097'], 'black': ['#232326'], 'white': ['#eeedea'], 'copper': ['#b0652f']}),
    'siberian-husky': (cw('base', 'Original', base='#7e838c', layers=[L('husky_face', 'white'), L('chest', 'white'), L('underside', 'white'),
                                                                      L('legs_outer', 'white')]),
                       {'grey': ['#7e838c'], 'white': ['#eeedea']}),
    'english-bulldog': (cw('base', 'Original', base='#8d6844', layers=[L('brindle', '#2a201b', 0.9), L('irish', 'white')]),
                        {'white': ['#eeedea'], 'brindle': ['#8d6844', '#2a201b']}),
}


def inpaint(d, tex, region, reach=0.05):
    """Fill `region` texels from the surrounding fur (inverse-distance blend of the nearest
    good texels outside it, in 3D), so nothing of what was painted there survives."""
    from scipy.ndimage import binary_dilation
    region = region & d.cover
    if not region.any():
        return tex, 0
    near = binary_dilation(region, iterations=int(reach * d.W)) & d.good & ~region
    sy, sx = np.nonzero(near)
    by, bx = np.nonzero(region)
    dd, k = cKDTree(d.P[sy, sx]).query(d.P[by, bx], k=16)
    w = 1 / (dd + 2e-3) ** 2
    out = tex.copy()
    out[by, bx] = (tex[sy[k], sx[k]] * w[..., None]).sum(1) / w.sum(1)[:, None]
    return out, len(by)


def clean_face(d, breed, tex):
    """The glossy eye and nose geometry are the eyes and nose now: paint out what the AI
    texture drew under and around them (eyes, white rings, pits, dark nose leather), in
    three passes so the fill comes from clean fur."""
    from scipy.ndimage import binary_dilation
    F = FACES[breed]
    eye, er = np.array(F['eye']), F['eye_r']
    nose, (nrx, nry) = np.array(F['nose']), F['nose_r']
    lab = srgb_to_lab(tex)
    L = lab[..., 0]
    head = d.bone('head', 'jaw', 'neck') > 0.2
    d_eye = np.minimum(np.linalg.norm(d.P - eye, axis=-1), np.linalg.norm(d.P - eye * [-1, 1, 1], axis=-1))
    d_nose = np.linalg.norm(d.P - nose, axis=-1)
    # eyes: a disc a bit wider than the bead, plus any dark or very light blob (painted
    # eye, white ring) reaching out a little further than that
    ring = d.cover & (d_eye > 2.2 * er) & (d_eye < 3.0 * er)
    Lr = np.median(L[ring]) if ring.any() else 50
    odd = (np.abs(L - Lr) > 18) & (d_eye < 2.4 * er)
    eyes = head & ((d_eye < 1.5 * er) | binary_dilation(odd & (d_eye < 2.4 * er), iterations=2))
    # nose: the leather painted on the muzzle tip, around and under the bead
    nring = d.cover & (d_nose > 1.6 * max(nrx, nry)) & (d_nose < 2.1 * max(nrx, nry))
    Ln = np.median(L[nring]) if nring.any() else 50
    dark = (L < Ln - 12) & (d_nose < 1.7 * max(nrx, nry))
    noses = head & ((d_nose < 1.2 * max(nrx, nry)) | binary_dilation(dark, iterations=2))
    tex, n1 = inpaint(d, tex, eyes)
    tex, n2 = inpaint(d, tex, noses)
    return tex, n1 + n2


def prepare_base(breed):
    path = os.path.join(HERE, 'rigged', f'{breed}.glb')
    d = Dog(path)
    if d.doc.get('asset', {}).get('extras', {}).get('coat_prepared'):
        return False
    tex = d.repaired_texture()
    if breed in REBASE:
        recipe, _ = REBASE[breed]
        ch, layers, _ = build_masks(d, breed, seed=zlib.crc32(breed.encode()) % 10000, sources=SOURCES_AI[breed],
                                    layers=breed_layers(breed, [recipe]), keep_details=False)   # a repaint drops the AI's face lines
        # shading from a blurred copy: soft form shading stays, the AI's painted lines go
        from scipy.ndimage import gaussian_filter
        orig = np.where(tex <= 0.04045, tex / 12.92, ((tex + 0.055) / 1.055) ** 2.4)
        soft = gaussian_filter(d.dilate(np.where(d.cover, shade_offset(ch, orig), 0)), 4) * 0.7
        tex = recolor(ch, tex, palette(breed, recipe, layers, SOURCES_AI[breed]), shade=soft)
    tex, n = clean_face(d, breed, tex)
    rgb = d.dilate(np.where(d.cover[..., None], tex, d.tex))
    d.doc.setdefault('asset', {}).setdefault('extras', {})['coat_prepared'] = 1
    save_variant(d, rgb, path)
    print('prepared', breed, 'repainted' if breed in REBASE else '', f'face cleaned ({n} texels)' if n else '', flush=True)
    return True


SOURCES_AI = {b: SOURCES[b] for b in REBASE}
SOURCES.update({b: src for b, (_, src) in REBASE.items()})


def main(args):
    """python3 colorways.py [--bake DIR] [breed ...]
    Writes rigged/coats/ (masks) and coats.json (layers + palettes per breed). --bake also
    writes every colorway as a ready-painted GLB into DIR (for engines without the shader,
    and for review renders)."""
    bake = None
    if '--bake' in args:
        i = args.index('--bake')
        bake, args = args[i + 1], args[:i] + args[i + 2:]
        os.makedirs(bake, exist_ok=True)
    only = set(args)
    out_dir = os.path.join(HERE, 'rigged', 'coats')
    os.makedirs(out_dir, exist_ok=True)
    out_json = os.path.join(HERE, 'coats.json')
    index = json.load(open(out_json)) if os.path.exists(out_json) else {}
    for breed, recipes in SPEC.items():
        if only and breed not in only:
            continue
        prepare_base(breed)
        d = Dog(os.path.join(HERE, 'rigged', f'{breed}.glb'))
        ch, layers, tex = build_masks(d, breed, seed=zlib.crc32(breed.encode()) % 10000)
        for f in os.listdir(out_dir):
            if f.startswith(breed + '-'):
                os.remove(os.path.join(out_dir, f))
        files, layout = write_masks(d, ch, os.path.join(out_dir, breed))
        decoded = {**ch, **decode_masks(d, files, layout, out_dir)} if bake else ch
        entries = []
        for r in recipes:
            pal = palette(breed, r, layers)
            entries.append({'slug': r['slug'], 'name': r['name'], 'note': r['note'], **({'like': r['like']} if r['like'] else {}), **pal})
            if bake:
                rgb = d.dilate(np.where(d.cover[..., None], recolor(decoded, tex, pal), tex))
                save_variant(d, rgb, os.path.join(bake, f"{breed}--{r['slug']}.glb"), pal['nose'])
        index[breed] = {'sources': list(SOURCES[breed]), 'layers': layers, 'masks': files, 'channels': layout,
                        'ref_l': ch['_refL'], 'geo': ch['_geo'],
                        'original': {'src': [v[0] for v in SOURCES[breed].values()], 'nose': NOSE['black']},
                        'colorways': entries}
        print('coat', breed, ' '.join(f"{f['size']}x{f['channels']}" for f in files), ' '.join(f'{n}:{v[2]}' for n, v in layout.items()),
              len(entries), 'colorways', flush=True)
    json.dump(index, open(out_json, 'w'), indent=1)


if __name__ == '__main__':
    main(sys.argv[1:])
