"""Harvest Haul concept boards. Procedural Blender geometry only.

    Blender -b --factory-startup -t 1 --python harvest.py -- renders [board-prefix ...]
    python3 ../../shared/board.py renders [board-prefix ...]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib  # noqa: E402

import hh  # noqa: E402
import crops  # noqa: E402
import gourds  # noqa: E402
import horn  # noqa: E402
import props  # noqa: E402
import grow  # noqa: E402
import crops2  # noqa: E402
import crops3  # noqa: E402
import machines  # noqa: E402
import structures  # noqa: E402
import farmers  # noqa: E402
import kit  # noqa: E402

for m in (hh, gourds, crops, horn, props, grow, crops2, crops3, machines, structures):
    importlib.reload(m)


def crop_row(name, fn, n):
    labels = crops.APPLE_STAGES if n == 7 else crops.STAGES
    return (name, [(labels[i], (lambda i=i, fn=fn: fn(i))) for i in range(n)])


def cells(items):
    return [(lab, (lambda f=f: f())) for lab, f in items]


CROP_A = crops.CROPS[:8]
CROP_B = crops.CROPS[8:]

BOARDS = [
    ("01-crops-a", "Harvest Haul: crops A (growth stages)", {"note": "Every stage of a crop sits on the same soil mound, so stages swap in place. Rows share scale."},
     [crop_row(*c) for c in CROP_A]),
    ("02-crops-b", "Harvest Haul: crops B (growth stages)", {"note": "Every stage of a crop sits on the same soil mound, so stages swap in place. Rows share scale."},
     [crop_row(*c) for c in CROP_B]),
    ("03-produce", "Harvest Haul: harvested produce", {"shared": False, "note": "The loose item each crop drops when harvested (framed one by one)."},
     [("Produce 1", cells([(c[0].replace(" vine", "").replace(" pole", "s").replace(" tree", ""), (lambda n=c[0]: crops.produce(n))) for c in crops.CROPS[:8]])),
      ("Produce 2", cells([(c[0].replace(" vine", "").replace(" pole", "s").replace(" tree", ""), (lambda n=c[0]: crops.produce(n))) for c in crops.CROPS[8:]]))]),
    ("04-pumpkin-parts", "Harvest Haul: pumpkin & gourd parts", {"shared": False, "note": "Body + stem + warts + skin. Every variety on the next board is a recipe of these."},
     gourds.parts_rows()),
    ("05-pumpkin-varieties", "Harvest Haul: pumpkin & gourd varieties", {"shared": False, "note": "16 recipes built only from the parts board (framed one by one; true sizes on the prize board)."},
     [("Varieties 1", cells([(n, (lambda r=r: gourds.gourd(**r))) for n, r in gourds.VARIETIES[:8]])),
      ("Varieties 2", cells([(n, (lambda r=r: gourds.gourd(**r))) for n, r in gourds.VARIETIES[8:]]))]),
    ("06-prize-and-carved", "Harvest Haul: prize sizes & carved faces", {"note": "Prize row is at true relative scale. Carved faces are inserts that wrap onto any round body."},
     gourds.prize_rows()),
    ("07-cornucopia", "Harvest Haul: cornucopias", {"note": "Woven horn in 3 sizes and 2 trims; fill pieces mix freely; examples use only those pieces."},
     horn.rows()),
    ("08-props", "Harvest Haul: harvest props", {"note": "Rows share scale, so sizes read true within a row."},
     props.rows()),
    ("09-scarecrow", "Harvest Haul: scarecrow kit", {"note": "Post + head + hat + outfit snap together; the bottom row is combos built only from these parts."},
     props.scarecrow_rows()),
]



def crop_row2(name, fn, produce, n=6):
    labels = grow.TREE_STAGES if n == 7 else crops.STAGES
    cells_ = [(labels[i], (lambda i=i, fn=fn: fn(i))) for i in range(n)]
    ripe = 5 if n == 7 else 4

    def prod():
        sz = hh.measure(lambda: fn(ripe))
        hh.zoom_fit(lambda: produce(name), max(0.8, min(1.4, 0.55 * max(sz.z, sz.x))))
    cells_.append(("produce (zoomed)", prod))
    return (name, cells_)


NOTE2 = "Same mound footprint for every stage; rows share scale. Last cell: the harvested produce, zoomed to read."
V = crops2.VEG
BOARDS += [
    ("10-veg-leafy", "Harvest Haul: leafy veg & brassicas", {"note": NOTE2}, [crop_row2(n, f, crops2.produce2) for n, f in V[:7]]),
    ("11-veg-more", "Harvest Haul: more veg", {"note": NOTE2}, [crop_row2(n, f, crops2.produce2) for n, f in V[7:13]]),
    ("12-veg-roots", "Harvest Haul: roots & alliums", {"note": NOTE2}, [crop_row2(n, f, crops2.produce2) for n, f in V[13:]]),
    ("13-grains", "Harvest Haul: grains & field crops", {"note": NOTE2}, [crop_row2(n, f, crops2.produce2) for n, f in crops2.GRAINS]),
]

C3 = crops3


def rows3(lst):
    return [crop_row2(n, f, C3.produce3, 7 if n in C3.SEVEN else 6) for n, f in lst]


NOTE7 = "Fruit trees have 7 stages (adds blossom). Same mound footprint; rows share scale. Last cell: produce, zoomed."
BOARDS += [
    ("14-vines", "Harvest Haul: vine & trellis crops", {"note": NOTE2 + " Trellises are part of every stage."}, rows3(C3.VINES)),
    ("15-berries", "Harvest Haul: berry bushes", {"note": NOTE2}, rows3(C3.BERRIES)),
    ("16-fruit-trees-a", "Harvest Haul: fruit trees A", {"note": NOTE7}, rows3(C3.FRUIT_TREES[:5])),
    ("17-fruit-trees-b", "Harvest Haul: fruit trees B & palms", {"note": NOTE7}, rows3(C3.FRUIT_TREES[5:])),
    ("18-herbs", "Harvest Haul: herbs", {"note": NOTE2}, rows3(C3.HERBS)),
    ("19-flowers", "Harvest Haul: flowers grown as crops", {"note": NOTE2}, rows3(C3.FLOWERS)),
    ("20-exotic", "Harvest Haul: exotic & fun crops", {"note": NOTE2 + " Cacao is a tree (7 stages)."}, rows3(C3.EXOTIC)),
]

M = machines
BOARDS += [
    ("21-hand-tools", "Harvest Haul: hand tools & containers", {"note": "Kid-sized: long tools are about as tall as a farmer kid (1.35). Rows share scale."},
     [("Tools", [(n, (lambda k=k: M.tool(k))) for n, k in M.TOOLS]),
      ("Cans, buckets & sacks", [(n, (lambda k=k: M.tool(k))) for n, k in M.CONTAINERS]),
      ("Seed bags", [(n, (lambda k=k: M.tool(k))) for n, k in M.SEEDS])]),
    ("22-tractors", "Harvest Haul: modular tractor", {"note": "Chassis + body + wheel set + paint + front attachment. Wheels are the Bolt-On Racers wheel kit."},
     [("Parts", [(n, (lambda n=n: M.tractor_parts(n))) for n in ("chassis", "chassis-vintage", "rear wheels", "front wheels", "turf wheels", "open", "cab", "canopy")]),
      ("Bodies", [("open + roll bar", lambda: M.tractor("open", "red")), ("cab", lambda: M.tractor("cab", "green")),
                  ("sun canopy", lambda: M.tractor("canopy", "blue")), ("vintage", lambda: M.tractor("vintage", "orange"))]),
      ("Combos", [("loader, yellow", lambda: M.tractor("cab", "yellow", loader=True)), ("turf tyres", lambda: M.tractor("open", "green", rear="slick", front="slick")),
                  ("loader, red", lambda: M.tractor("open", "red", loader=True)), ("vintage, green", lambda: M.tractor("vintage", "green"))])]),
    ("23-machines", "Harvest Haul: implements & vehicles", {"shared": False, "note": "Framed one by one. Implements hitch to the tractor's rear ring."},
     [("Implements", [("plough", M.plough), ("seeder", M.seeder), ("sprayer", M.sprayer), ("hay baler", M.baler),
                      ("wagon", M.wagon), ("wagon, hay", lambda: M.wagon("hay")), ("wagon, pumpkins", lambda: M.wagon("pumpkins"))]),
      ("Vehicles", [("combine harvester", M.combine), ("farm pickup", M.pickup), ("pickup, empty", lambda: M.pickup(hh.C(230, 80, 60), False)),
                    ("quad bike", M.quad), ("quad, green", lambda: M.quad(M.GREEN_T))])]),
]

S = structures
BOARDS += [
    ("24-structures", "Harvest Haul: farm structures", {"note": "Rows share scale. The greenhouse is an open frame (no glass) so the beds inside show."},
     [("Big", [(n, f) for n, f in S.BIG]), ("Medium", [(n, f) for n, f in S.MID]), ("Small, fences & gates", [(n, f) for n, f in S.SMALL])]),
]

F = farmers
KS = F.KS


def look(i):
    return F.LOOKS[i][2], F.LOOKS[i][1]


def scene(kind):
    if kind == "hoe":
        with hh.at((0.75, 0.25, 0)):
            crops.crop_pumpkin(4)
        F.kid(look(3)[0], look(3)[1], (-0.1, -0.1, 0), 15, KS)
    elif kind == "apples":
        with hh.at((0.7, 0.4, 0)):
            crops.crop_apple(5)
        F.kid(look(0)[0], look(0)[1], (-0.25, -0.2, 0), 20, KS)
    elif kind == "water":
        with hh.at((0.7, 0.2, 0)):
            crops.crop_strawberry(4)
        F.kid(look(5)[0], look(5)[1], (-0.15, -0.2, 0), 35, KS)
    elif kind == "carrots":
        with hh.at((0.75, 0.25, 0)):
            crops.crop_carrot(4)
        F.kid(look(4)[0], look(4)[1], (-0.1, -0.15, 0), 20, KS)
    elif kind == "eggs":
        with hh.at((0.9, 0.5, 0)):
            structures.coop()
        F.kid(look(2)[0], look(2)[1], (-0.25, -0.25, 0), 20, KS)
    elif kind == "tractor":
        with hh.at((0.55, 0.6, 0)):
            machines.tractor("cab", "green")
        F.kid(look(1)[0], look(1)[1], (-0.75, -0.35, 0), 25, KS)
    elif kind == "crew":
        with hh.at((0.2, 0.8, 0)):
            machines.wagon("pumpkins")
        for i, (x, y) in zip((6, 8, 9), ((-0.9, -0.3), (0.0, -0.75), (0.95, -0.4))):
            F.kid(look(i)[0], look(i)[1], (x, y, 0), 25, KS)
    elif kind == "lineup":
        F.kid(look(7)[0], look(7)[1], (-0.4, 0, 0), 25, KS)
        with hh.at((0.55, 0, 0)):
            crops.crop_corn(4)
        with hh.at((1.55, 0, 0)):
            crops.crop_sunflower(4)
        with hh.at((3.0, 0.2, 0)):
            machines.tractor("open", "red")
        with hh.at((5.6, 1.0, 0)):
            structures.barn()


BOARDS += [
    ("25-farmer-kit", "Harvest Haul: farmer kids (Boo Brigade kit)", {"note": "The real Boo Brigade kids dressed with the kit's own dress(); new farm items register into its catalogue. Rows share scale."},
     [("New hats", [(n, (lambda n=n, w=w: F.show("hat", n, w))) for n, w in (("straw-hat", "natural"), ("sun-bonnet", "gingham"), ("farm-cap", "red"), ("head-bandana", "red"))]),
      ("New tops, bottoms, boots & gloves", [("plaid-shirt", lambda: F.show("top", "plaid-shirt", "red")), ("apron", lambda: F.show("top", "apron", "garden")),
                                             ("shortalls", lambda: F.show("bottom", "shortalls", "denim")),
                                             ("patched-dungarees", lambda: F.show("bottom", "patched-dungarees", "denim")),
                                             ("gumboots", lambda: F.show("shoes", "gumboots", "green")), ("work-gloves", lambda: F.show("hands", "work-gloves", "tan"))]),
      ("Held farm props (sized for the mitts)", [(n, (lambda n=n, w=w: F.show("prop", n, w))) for n, w in
                                                 (("hoe", "wood"), ("pitchfork", "wood"), ("veg-basket", "wicker"), ("egg-basket", "wicker"),
                                                  ("farm-can", "sage"), ("carrot-bunch", "twine"))]),
      ("Farmer kids 1-5", [(F.LOOKS[i][0], (lambda i=i: F.farmer(i))) for i in range(5)]),
      ("Farmer kids 6-10", [(F.LOOKS[i][0], (lambda i=i: F.farmer(i))) for i in range(5, 10)])]),
    ("26-farm-scale", "Harvest Haul: farmers at work (scale check)", {"shared": False, "note": "Kids at Harvest scale (about 1.37 tall) with crops, a coop, a tractor and a wagon."},
     [("At work", [("hoeing pumpkins", lambda: scene("hoe")), ("apple picking", lambda: scene("apples")), ("watering", lambda: scene("water")),
                   ("pulling carrots", lambda: scene("carrots"))]),
      ("Bigger things", [("egg run", lambda: scene("eggs")), ("tractor", lambda: scene("tractor")), ("harvest crew", lambda: scene("crew")),
                         ("scale lineup", lambda: scene("lineup"))])]),
]

kit.run(BOARDS)
