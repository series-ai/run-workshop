"""Farmer kids: the real Boo Brigade kids (tools/run-costume-kids wardrobe kit),
dressed with its own dress(), plus NEW farm wardrobe items registered into its
ITEMS catalogue at runtime (nothing in the kit is edited):

  hats   straw-hat, sun-bonnet, farm-cap, head-bandana
  tops   plaid-shirt, apron (outer: hides an overalls bib)
  bottom shortalls, patched-dungarees (both carry an overalls bib)
  shoes  gumboots       hands  work-gloves
  props  hoe, pitchfork, veg-basket, egg-basket, farm-can, carrot-bunch

New items follow the kit rules: the head is the standard Bobble head, hats come
down to HAT_Z and cut the hair, nothing is glass, held props stay short and lean
out to the side clear of the head. Kid units: a kid is ~4.15 tall; KS scales a kid
into Harvest Haul units (~1.37 tall)."""
import math
import os
import sys

import bpy
from mathutils import Matrix, Euler, Vector

_CK = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "run-costume-kids", "concepts"))
_ours = sys.modules.pop("props", None)  # the kit has its own `props` module (costumes/props.py)
sys.path.insert(0, _CK)
sys.path.insert(0, os.path.join(_CK, "costumes"))
try:
    import wardrobe as WD  # noqa: E402
finally:
    _kitdir = os.path.dirname(_CK)  # wardrobe.py also adds its own folders: drop them all, so our `props` stays ours
    sys.path[:] = [p for p in sys.path if not os.path.normpath(p).startswith(_kitdir)]
    sys.modules["kit_props"] = sys.modules.pop("props", None)
    if _ours is not None:
        sys.modules["props"] = _ours

R = math.radians
W = WD.W
box, ball, can, limb, part = WD.box, WD.ball, WD.can, WD.limb, WD.part
KS = 0.33

STRAW = (0.96, 0.82, 0.48)
STRAW_D = (0.86, 0.66, 0.32)
HANDLE = (0.8, 0.62, 0.4)
STEEL = (0.72, 0.74, 0.78)
CL = WD.CLOTH


# ================================================================ hats

def hat_straw(main, trim, accent, _d=None):
    """A wide straw sun hat with a band and a little flower."""
    WD.crown(main, WD.HAT_Z, WD.HEAD_Z + 1.25, grow=0.04, bevel=0.42, segs=3)
    WD.crown(trim, WD.HAT_Z + 0.06, WD.HAT_Z + 0.34, grow=0.12, bevel=0.12, segs=2)
    can(0, W * 0.05, WD.HAT_Z - 0.02, 2.35, 0.12, main, n=16, r2=2.05)
    can(0, W * 0.05, WD.HAT_Z - 0.09, 2.38, 0.04, STRAW_D, n=16)  # frayed rim line
    fy = W * 0.05 - (W * 1.1 + 0.12) / 2
    for i in range(5):
        a = R(i * 72)
        ball(0.55 + 0.13 * math.cos(a), fy - 0.02, WD.HAT_Z + 0.2 + 0.13 * math.sin(a), 0.18, 0.08, 0.18, accent, seg=6, ring=4)
    ball(0.55, fy - 0.05, WD.HAT_Z + 0.2, 0.12, 0.08, 0.12, CL["yellow"], seg=6, ring=4)


def hat_bonnet(main, trim, accent, _d=None):
    """A sun bonnet: a soft crown, a stiff brim round the face, flaps over the ears, ribbon ties."""
    WD.crown(main, WD.HAT_Z, WD.HEAD_Z + 1.3, grow=0.14, bevel=0.5, dy=0.12, segs=3)
    fy = W * 0.05 - (W * 1.1 + 0.14) / 2
    box(0, fy - 0.2, WD.HAT_Z + 0.22, W * 1.22, 0.55, 0.14, main, bevel=0.05, rot=(R(-22), 0, 0))
    box(0, fy - 0.42, WD.HAT_Z + 0.31, W * 1.22, 0.08, 0.2, trim, bevel=0.03, rot=(R(-22), 0, 0))  # frill
    for s in (-1, 1):
        box(s * (W * 0.55 + 0.12), 0.1, WD.HAT_Z - 0.35, 0.18, W * 0.95, 0.95, main, bevel=0.07)
        limb((s * (W * 0.55 + 0.14), -0.55, WD.HAT_Z - 0.82), (s * 0.95, -0.9, WD.HEAD_Z - W * 0.5), 0.05, trim)
    for s in (-1, 1):
        ball(0.95 + s * 0.16, -0.95, WD.HEAD_Z - W * 0.5, 0.26, 0.12, 0.2, trim, seg=6, ring=4)
    ball(0.95, -0.97, WD.HEAD_Z - W * 0.5, 0.1, 0.1, 0.1, accent, seg=6, ring=4)


def hat_farmcap(main, trim, accent, _d=None):
    """A trucker cap: front panel in trim, a curved peak and a leaf patch."""
    WD.hat_backcap(main, trim, accent)
    fy = W * 0.05 - (W * 1.06 + 0.04) / 2
    box(0, fy + 0.03, WD.HAT_Z + 0.62, W * 0.8, 0.06, 0.5, trim, bevel=0.06)
    box(0, fy - 0.01, WD.HAT_Z + 0.64, 0.42, 0.04, 0.3, accent, bevel=0.03)
    can(0, fy - 0.04, WD.HAT_Z + 0.64, 0.1, 0.04, CL["green"], n=3, rot=(R(90), 0, R(30)))


def hat_headbandana(main, trim, accent, _d=None):
    """A bandana tied over the head, knotted at the back with two tails."""
    WD.crown(main, WD.HAT_Z, WD.HEAD_Z + 1.32, grow=0.0, bevel=0.48, segs=3)
    back = W * 0.05 + (W * 1.06) / 2
    ball(0, back + 0.05, WD.HAT_Z + 0.2, 0.32, 0.25, 0.28, main, seg=8, ring=5)
    for s in (-1, 1):
        box(s * 0.18, back + 0.1, WD.HAT_Z - 0.2, 0.22, 0.06, 0.55, main, bevel=0.03, rot=(R(10), R(s * 18), 0))
    fy = W * 0.05 - (W * 1.06) / 2 - 0.02
    for x, z in ((-0.7, 0.3), (-0.2, 0.55), (0.35, 0.35), (0.8, 0.6), (0.1, 0.9), (-0.5, 0.85)):
        ball(x, fy, WD.HAT_Z + z, 0.14, 0.04, 0.14, trim, seg=6, ring=4)


# ================================================================ tops

def top_plaid(main, trim, accent, _d=None):
    """A plaid work shirt: checks, a collar, a pocket and rolled sleeves."""
    with part("chest"):
        WD.torso(main)
        WD.stripes(WD.TUCK_Z, WD.TOP - 0.02, 3, trim, grow=WD.UNDER + 0.012)
        for x in (-0.3, 0.0, 0.3):
            box(x, 0, (WD.TUCK_Z + WD.TOP) / 2, 0.09, WD.TD + WD.UNDER + 0.024, WD.TOP - WD.TUCK_Z - 0.02, trim)
        for s in (-1, 1):
            box(s * 0.16, WD.FRONT_U - 0.03, WD.TOP - 0.02, 0.26, 0.06, 0.16, accent, bevel=0.02, rot=(R(-20), 0, R(s * 14)))
        box(-0.22, WD.DECO_U, WD.SH_Z0 + 0.36, 0.2, 0.02, 0.18, accent, bevel=0.01)
    WD.sleeves(main, length=0.62, r=0.13)
    WD.sleeve_rings(trim, ts=(0.62,), r=0.15, half=0.07)


def top_apron(main, trim, accent, _d=None):
    """A long garden apron over a plain tee, with a pocket and a carrot poking out."""
    with part("chest"):
        WD.torso(main)
        y = WD.FRONT_O - 0.02
        box(0, y, WD.SH_Z0 + 0.2, WD.TW * 0.86, 0.05, 0.9, trim, bevel=0.03)  # bib + body
        WD.band(WD.WAIST_Z - 0.06, WD.WAIST_Z + 0.05, trim, grow=WD.OUTER - 0.02, bevel=0.03)
        for s in (-1, 1):
            limb((s * 0.3, y, WD.SH_Z0 + 0.64), (s * 0.2, 0.0, WD.TOP + 0.08), 0.04, trim)
        box(0.12, y - 0.04, WD.SH_Z0 - 0.08, 0.34, 0.04, 0.24, accent, bevel=0.02)  # pocket
        can(0.2, y - 0.07, WD.SH_Z0 + 0.06, 0.07, 0.3, CL["orange"], n=6, r2=0.02, rot=(R(180), 0, 0))
        for k in range(3):
            box(0.2 + (k - 1) * 0.05, y - 0.07, WD.SH_Z0 + 0.3, 0.05, 0.03, 0.18, CL["green"], rot=(0, R((k - 1) * 25), 0))
    with part("body"):
        box(0, WD.FRONT_O - 0.02, WD.HIP - 0.12, WD.TW * 0.86, 0.05, 0.5, trim, bevel=0.03)  # apron skirt over the hips
    WD.sleeves(main, length=0.45)


# ================================================================ bottoms

def bottom_shortalls(main, trim, accent, _d=None):
    """Short dungarees with rolled hems over bare knees."""
    WD.waist(main)
    for s in (-1, 1):
        fx = s * WD.TW * 0.24
        with part("leg.l" if s > 0 else "leg.r"):
            limb((fx, 0, WD.HIP - 0.22), (fx, 0, WD.HIP + 0.02), 0.15, main)
            limb((fx, 0, WD.HIP - 0.26), (fx, 0, WD.HIP - 0.18), 0.17, trim)


def bottom_patched(main, trim, accent, _d=None):
    """Work dungarees with knee patches and rolled cuffs."""
    WD.bottom_overalls(main, trim)
    for s in (-1, 1):
        fx = s * WD.TW * 0.24
        with part("leg.l" if s > 0 else "leg.r"):
            box(fx, -0.13, WD.FOOT * 0.7, 0.18, 0.04, 0.16, accent, bevel=0.01, rot=(0, R(s * 8), 0))


def patched_bib(main, trim, accent, _d=None):
    WD.overalls_bib(main, trim, accent)
    with part("chest"):
        box(-0.22, WD.BIB_Y - 0.035, WD.SH_Z0 + 0.38, 0.18, 0.03, 0.16, accent, bevel=0.01, rot=(0, R(10), 0))


# ================================================================ shoes + hands

def shoes_gumboots(main, trim, accent, _d=None):
    """Tall farm gumboots: a chunky tread, a coloured top band and mud on the toes."""
    def one(fx):
        WD.shoe_box(fx, main, grow=0.04)
        can(fx, 0, 0.5, 0.19, 0.48, main, n=8)
        can(fx, 0, 0.76, 0.21, 0.1, trim, n=8)
        box(fx, -WD.FOOT * 0.25, WD.FOOT * 0.03, WD.FOOT * 0.84, WD.FOOT * 1.24, 0.1, (0.22, 0.2, 0.22), bevel=0.03)
        for k, (dx, dy, dz) in enumerate(((0.08, -0.55, 0.12), (-0.06, -0.62, 0.06), (0.1, -0.3, 0.05))):
            ball(fx + dx, dy, dz, 0.14, 0.1, 0.1, accent, seg=6, ring=4)
    WD.each_foot(one)


def hands_workgloves(main, trim, accent, _d=None):
    """Chunky work gloves: leather palms, a big canvas cuff, stitching."""
    def one(s, x, y, z):
        WD._mitt(s, x, y, z, main, 0.07)
        can(x, y, z + 0.3, 0.24, 0.18, trim, n=10, r2=0.2)
        box(x, y - 0.27, z + 0.05, 0.3, 0.03, 0.04, accent)
    WD._each_hand(one)


# ================================================================ held props (grip at the mitt centre)

def _hoe(main, trim, *_):
    limb((0, 0, -0.62), (0, 0, 1.25), 0.085, main)
    can(0, 0, 1.2, 0.12, 0.2, trim, n=6)
    box(0, -0.18, -0.62, 0.6, 0.1, 0.28, STEEL, bevel=0.04)
    limb((0, -0.02, -0.6), (0, -0.14, -0.6), 0.05, STEEL)


def _pitchfork(main, trim, *_):
    limb((0, 0, -0.5), (0, 0, 1.0), 0.085, main)
    box(0, 0, 1.02, 0.56, 0.1, 0.1, STEEL, bevel=0.03)
    for x in (-0.23, -0.08, 0.08, 0.23):
        limb((x, 0, 1.02), (x, 0, 1.45), 0.045, STEEL)
    can(0, 0, -0.5, 0.08, 0.14, trim, n=6)


def _veg_basket(main, trim, accent, *_):
    can(0, 0, -0.62, 0.48, 0.42, main, n=10, r2=0.56)
    can(0, 0, -0.42, 0.58, 0.06, trim, n=10)
    for s in (-1, 1):
        limb((s * 0.5, 0, -0.4), (s * 0.3, 0, 0.0), 0.04, trim)
    limb((-0.3, 0, 0.0), (0.3, 0, 0.0), 0.04, trim)
    for i, (x, y, col) in enumerate(((-0.2, -0.1, CL["orange"]), (0.15, -0.15, CL["red"]), (0.0, 0.15, CL["lime"]), (0.25, 0.1, CL["orange"]))):
        ball(x, y, -0.33, 0.3, 0.3, 0.27, col, seg=8, ring=6)
    for k in range(3):
        box(-0.2 + 0.05 * k, -0.1, -0.12, 0.05, 0.05, 0.22, CL["green"], rot=(0, R((k - 1) * 25), 0))


def _egg_basket(main, trim, accent, *_):
    can(0, 0, -0.55, 0.4, 0.28, main, n=10, r2=0.46)
    for s in (-1, 1):
        limb((s * 0.42, 0, -0.42), (s * 0.25, 0, 0.0), 0.035, trim)
    limb((-0.25, 0, 0.0), (0.25, 0, 0.0), 0.035, trim)
    for x, y, c in ((-0.15, -0.08, (0.98, 0.95, 0.88)), (0.12, -0.1, (0.86, 0.66, 0.46)), (0.0, 0.14, (0.98, 0.95, 0.88)), (0.2, 0.1, (0.86, 0.66, 0.46))):
        ball(x, y, -0.3, 0.2, 0.2, 0.26, c, seg=8, ring=6)
    box(-0.1, 0.0, -0.39, 0.6, 0.6, 0.04, accent, bevel=0.01)  # gingham cloth


def _farm_can(main, trim, accent, *_):
    can(0.0, 0.25, -0.45, 0.32, 0.55, main, n=10)
    limb((0.0, 0.25, -0.17), (0, 0.0, 0.0), 0.04, trim)
    limb((0, 0.0, 0.0), (0, 0.4, 0.0), 0.04, trim)
    limb((0, 0.05, -0.55), (0, -0.45, -0.25), 0.07, main)
    can(0, -0.5, -0.22, 0.13, 0.1, trim, n=8, r2=0.08, rot=(R(-60), 0, 0))


def _carrots(main, trim, accent, *_):
    for k in range(3):
        x = (k - 1) * 0.13
        can(x, 0, -0.38, 0.11, 0.55, CL["orange"], n=7, r2=0.02, rot=(R(180), R((k - 1) * 10), 0))
        for j in range(3):
            box(x + (j - 1) * 0.05, 0, 0.22, 0.06, 0.06, 0.4, CL["green"], rot=(0, R((j - 1) * 28 + (k - 1) * 8), 0))
    can(0, 0, -0.1, 0.24, 0.07, trim, n=8)


def _prop(fn, tilt=20):
    def build(main, trim, accent=None, _d=None, side=1):
        WD._held(lambda: fn(main, trim, accent), side, tilt=(0, side * tilt, 0))
    return build


# ================================================================ register into the kit catalogue

def register():
    I = WD.ITEMS
    item = WD.item
    I["hat"]["straw-hat"] = item(hat_straw, {"main": "Straw", "trim": "Band", "accent": "Flower"},
                                 {"natural": (STRAW, "red", "white"), "sunny": (STRAW, "sky", "pink"), "sage": (STRAW, "green", "butter")})
    I["hat"]["sun-bonnet"] = item(hat_bonnet, {"main": "Bonnet", "trim": "Frill and ties", "accent": "Button"},
                                  {"gingham": ("pink", "white", "red"), "butter": ("butter", "white", "sky"), "sky": ("sky", "white", "yellow")})
    I["hat"]["farm-cap"] = item(hat_farmcap, {"main": "Cap", "trim": "Front", "accent": "Patch"},
                                {"red": ("red", "white", "cream"), "green": ("green", "cream", "butter"), "navy": ("navy", "white", "gold")})
    I["hat"]["head-bandana"] = item(hat_headbandana, {"main": "Bandana", "trim": "Dots"},
                                    {"red": ("red", "white"), "blue": ("blue", "white"), "green": ("green", "cream")})
    I["top"]["plaid-shirt"] = item(top_plaid, {"main": "Shirt", "trim": "Checks", "accent": "Collar and pocket"},
                                   {"red": ("red", (0.62, 0.12, 0.12), "red"), "green": ("green", (0.16, 0.36, 0.22), "green"),
                                    "blue": ("blue", "navy", "blue"), "mustard": ("gold", "brown", "gold")})
    I["top"]["apron"] = item(top_apron, {"main": "Tee", "trim": "Apron", "accent": "Pocket"},
                             {"garden": ("cream", "green", "tan"), "sky": ("sky", "white", "pink"), "denim": ("white", "blue", "tan")}, outer=True)
    I["bottom"]["shortalls"] = item(bottom_shortalls, {"main": "Denim", "trim": "Hem", "accent": "Buttons"},
                                    {"denim": ((0.3, 0.45, 0.72), (0.5, 0.65, 0.9), "gold"), "red": ("red", "white", "gold"), "green": ("green", "butter", "gold")},
                                    bib=WD.overalls_bib)
    I["bottom"]["patched-dungarees"] = item(bottom_patched, {"main": "Denim", "trim": "Cuffs", "accent": "Patches"},
                                            {"denim": ((0.3, 0.45, 0.72), (0.5, 0.65, 0.9), "red"), "brown": ("brown", "tan", "green"),
                                             "olive": ((0.45, 0.5, 0.3), "tan", "orange")}, bib=patched_bib)
    I["shoes"]["gumboots"] = item(shoes_gumboots, {"main": "Boot", "trim": "Band", "accent": "Mud"},
                                  {"green": ("green", "yellow", "brown"), "yellow": ("yellow", "green", "brown"), "red": ("red", "white", "brown"),
                                   "navy": ("navy", "orange", "brown")})
    I["hands"]["work-gloves"] = item(hands_workgloves, {"main": "Leather", "trim": "Cuff", "accent": "Stitch"},
                                     {"tan": ("tan", "orange", "brown"), "yellow": ("yellow", "green", "brown"), "grey": ("grey", "red", "charcoal")})
    P = I["prop"]
    P["hoe"] = item(_prop(_hoe, 34), {"main": "Handle", "trim": "Grip"}, {"wood": (HANDLE, "red"), "green": (HANDLE, "green")})
    P["pitchfork"] = item(_prop(_pitchfork, 34), {"main": "Handle", "trim": "Grip"}, {"wood": (HANDLE, "charcoal")})
    P["veg-basket"] = item(_prop(_veg_basket, 0), {"main": "Basket", "trim": "Rim and handle"}, {"wicker": ((0.85, 0.66, 0.4), (0.68, 0.48, 0.28))})
    P["egg-basket"] = item(_prop(_egg_basket, 0), {"main": "Basket", "trim": "Handle", "accent": "Cloth"},
                           {"wicker": ((0.85, 0.66, 0.4), (0.68, 0.48, 0.28), (0.95, 0.45, 0.5))})
    P["farm-can"] = item(_prop(_farm_can, 0), {"main": "Can", "trim": "Handle and rose"}, {"sage": ((0.6, 0.72, 0.48), (0.45, 0.58, 0.38)),
                                                                                        "red": ("red", (0.6, 0.15, 0.15)), "tin": (STEEL, (0.55, 0.57, 0.62))})
    P["carrot-bunch"] = item(_prop(_carrots, 0), {"main": "-", "trim": "Tie"}, {"twine": ((0.8, 0.6, 0.4), (0.8, 0.6, 0.4))})


register()

# ================================================================ looks: ten farmer kids (skin tone index, look)
LOOKS = [
    ("Sunny", 1, {"hair": ("braids", "ginger"), "hat": ("straw-hat", "natural"), "top": ("tee", "white"), "bottom": ("overalls", "denim"),
                  "shoes": ("gumboots", "green"), "prop": ("veg-basket", "wicker")}),
    ("Hank", 4, {"hair": ("crop", "black"), "hat": ("farm-cap", "red"), "top": ("plaid-shirt", "red"), "bottom": ("jeans", "light"),
                 "shoes": ("boots", "brown"), "hands": ("work-gloves", "tan"), "prop": ("pitchfork", "wood")}),
    ("Clover", 0, {"hair": ("long", "blonde"), "hat": ("sun-bonnet", "gingham"), "top": ("apron", "garden"), "bottom": ("skirt", "rose"),
                   "shoes": ("wellies", "red"), "prop": ("egg-basket", "wicker")}),
    ("Rowan", 3, {"hair": ("afro", "dark"), "top": ("plaid-shirt", "green"), "bottom": ("patched-dungarees", "denim"), "neck": ("bandana", "red"),
                  "shoes": ("gumboots", "yellow"), "prop": ("hoe", "wood")}),
    ("Poppy", 2, {"hair": ("puffs", "dark"), "hat": ("head-bandana", "red"), "top": ("stripy", "sailor"), "bottom": ("shortalls", "denim"),
                  "shoes": ("gumboots", "red"), "prop": ("carrot-bunch", "twine")}),
    ("Ozzie", 1, {"hair": ("bowl", "brown"), "hat": ("straw-hat", "sage"), "top": ("plaid-shirt", "blue"), "bottom": ("overalls", "denim"),
                  "shoes": ("boots", "tan"), "hands": ("work-gloves", "yellow"), "prop": ("farm-can", "sage")}),
    ("Marigold", 5, {"hair": ("ponytail", "black"), "hat": ("farm-cap", "green"), "top": ("tee", "yellow"), "bottom": ("patched-dungarees", "olive"),
                     "shoes": ("gumboots", "navy"), "prop": ("veg-basket", "wicker")}),
    ("Basil", 2, {"hair": ("curtains", "chestnut"), "top": ("apron", "denim"), "bottom": ("pants", "khaki"), "neck": ("bandana", "blue"),
                  "shoes": ("gumboots", "green"), "hands": ("work-gloves", "grey"), "prop": ("hoe", "green")}),
    ("Daisy", 3, {"hair": ("cloud", "copper"), "hat": ("sun-bonnet", "butter"), "top": ("plaid-shirt", "mustard"), "bottom": ("shortalls", "green"),
                  "shoes": ("wellies", "yellow"), "prop": ("farm-can", "red")}),
    ("Woody", 0, {"hair": ("quiff", "blonde"), "hat": ("head-bandana", "green"), "top": ("plaid-shirt", "red"), "bottom": ("overalls", "denim"),
                  "shoes": ("gumboots", "green"), "hands": ("work-gloves", "tan"), "prop": ("pitchfork", "wood"), "side": -1}),
]
for _n, _t, _l in LOOKS:
    _l.setdefault("bottom", ("overalls", "denim"))


def _recolour_skin(objs, tone):
    m = WD.mat(tone)
    for o in objs:
        for slot in o.material_slots:
            c = slot.material.diffuse_color if slot.material else None
            if c is not None and all(abs(c[i] - WD.SKIN[i]) < 1e-3 for i in range(3)):
                slot.material = m


def kid(look, tone=1, loc=(0, 0, 0), rz=25.0, s=1.0):
    """Dress one kid with the kit's dress(), then place it (loc in Harvest units)."""
    before = set(bpy.data.objects)
    WD.dress(look)
    objs = [o for o in bpy.data.objects if o not in before]
    _recolour_skin(objs, WD.SKIN_TONES[tone])
    bpy.context.view_layer.update()
    M = Matrix.Translation(Vector(loc)) @ Euler((0, 0, math.radians(rz)), "XYZ").to_matrix().to_4x4() @ Matrix.Scale(s, 4)
    for o in objs:
        o.matrix_world = M @ o.matrix_world
    return objs


PLAIN = {"hair": ("crop", "brown"), "top": ("tee", "white"), "bottom": ("pants", "khaki"), "shoes": ("sneakers", "white")}


def show(slot, name, way, extra=None, tone=1):
    look = dict(PLAIN)
    look[slot] = (name, way)
    if extra:
        look.update(extra)
    kid(look, tone)


def farmer(i):
    name, tone, look = LOOKS[i]
    kid(look, tone)
