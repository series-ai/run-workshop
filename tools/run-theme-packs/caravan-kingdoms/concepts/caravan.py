"""Caravan Kingdoms concept boards (Silk Road jam week).

    Blender -b --factory-startup -t 1 --python caravan.py -- renders [board-prefix ...]
    python3 ../../shared/board.py renders [board-prefix ...]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ck_terrain import *  # noqa: E402,F401,F403

BOARDS = []


def cells(items):
    return [(lab, fn) for lab, fn in items]


# ---------------------------------------------------------------- 01 terrain
def _t(name, e="mid", seed=1):
    return lambda: tile(name, e, seed)


T = [n for n, _ in TERRAIN]
BOARDS.append(("01-terrain", "Caravan Kingdoms: terrain tiles", {"note": "20 hex types, radius 1, mid elevation. Thick earthy side band, flat-shaded top."}, [
    ("Dry lands", [(n, _t(n)) for n in T[0:6]]),
    ("Rivers + lakes", [(n, _t(n)) for n in T[6:11]]),
    ("High + rugged", [(n, _t(n)) for n in (T[11], T[12], T[13], T[19])]),
    ("Green + wet", [(n, _t(n)) for n in T[14:19]]),
]))

# ---------------------------------------------------------------- 02 elevation
rows = []
for i in range(0, 20, 2):
    pair = T[i:i + 2]
    rows.append((" / ".join(pair), [(f"{n.split()[-1]} {e}", _t(n, e)) for n in pair for e in ("low", "mid", "high")]))
BOARDS.append(("02-terrain-elev", "Terrain: low / mid / high", {"note": "Heights 0.22 / 0.42 / 0.66. Water stays at 0.15; for sea the variants are shallows / sea / deep."}, rows))


# ---------------------------------------------------------------- 04 decorators
def _dec(name, ter):
    def f():
        H = plain("low", {"desert": SAND, "steppe": STEPPE, "grassland": GRASS}[ter])
        with at((0, 0, H)):
            decor(name)
    return f


BOARDS.append(("04-decorators", "Tile decorators", {"note": "Drop onto any tile top (snap: tile centre). Shown on bare low tiles."}, [
    ("Nature", [(n, _dec(n, t)) for n, fn, t, s in DECOR[:6]]),
    ("People + traces", [(n, _dec(n, t)) for n, fn, t, s in DECOR[6:]]),
]))

# ---------------------------------------------------------------- 05 / 06 cities
from ck_city import *  # noqa: E402,F401,F403


def _part(st, kind, *a):
    def f():
        with at((0, 0, 0)):
            getattr(st, kind)(*a)
    return f


rows = []
for st in STYLES:
    rows.append((f"{st.name}: homes", [("house S", _part(st, "house", 0)), ("house S alt", _part(st, "house", 0, True)),
                                       ("house M", _part(st, "house", 1)), ("house L", _part(st, "house", 2)),
                                       ("district block", _part(st, "block")), ("camp tent", _part(st, "tent"))]))
    rows.append((f"{st.name}: civic + walls", [("town hall", _part(st, "landmark", 0)), ("city centre", _part(st, "landmark", 1)),
                                               ("capital palace", _part(st, "landmark", 2)), ("wall run", _part(st, "wall", 0.6)),
                                               ("tower", _part(st, "tower")), ("gate", _part(st, "gate", 0.84))]))
BOARDS.append(("05-city-parts", "City parts: 4 regional styles", {"note": "Same part contract per style (house S/M/L, block, landmark x3, wall, tower, gate, tent). Rows share scale."}, rows))

BOARDS.append(("06-city-growth", "City growth: camp > village > town > city > capital", {"note": "One shared layout per stage; each style fills the same slots. Same hex, so stages swap in place."},
               [(st.name, [(sg, (lambda st=st, sg=sg: city(st, sg))) for sg in STAGES]) for st in STYLES]))

# ---------------------------------------------------------------- 07 / 08 improvements + wonders
from ck_build import *  # noqa: E402,F401,F403

BOARDS.append(("07-improvements", "Buildings + improvements", {"note": "Each fills one tile. Staged ones swap in place on the same footprint."}, IMPROVEMENTS))

BOARDS.append(("08-wonders", "Wonders: scaffolding > half-built > complete", {"note": "Stages come from the finished model: footings + scaffold, sliced at half height + scaffold, done."},
               [(f"{WONDERS[i][0]} / {WONDERS[i + 1][0]}", [(f"{n.split()[-1].lower()} {s}", f(k)) for n, f in WONDERS[i:i + 2] for k, s in enumerate(("scaffold", "half", "done"))])
                for i in range(0, 8, 2)]))

# ---------------------------------------------------------------- 09 units
from ck_units import *  # noqa: E402,F401,F403


def _on(ter, fn, e="low", p=(0, 0, 0), rz=0.0, s=1.0, top=None):
    def f():
        H = tile(ter, e, 3) if ter in ("sea",) else plain(e, top or {"desert": SAND, "steppe": STEPPE, "grassland": GRASS}[ter])
        with at((p[0], p[1], H + p[2]), rz=rz, s=s):
            fn()
    return f


def _road_cart():
    H = plain("low", STEPPE)
    with at((0, 0, H)):
        link([2, 5], 0.01, 0.2, C(206, 176, 128), t=0.016)
        with at((0.05, -0.05, 0.01), rz=-SIDE - 30, s=UNIT_S):
            ox_cart("spice")


BOARDS.append(("09-units", "Units", {"note": "Wargame-mini figures: boxy, tall hats, long spears, team pennants. Cargo snaps to the saddle point and swaps (silk / spice / tea / ceramics)."}, [
    ("Pack animals", [("Bactrian camel", unit_camel(True, "silk")), ("dromedary", unit_camel(False, "spice")), ("horse rider", horse_rider),
                      ("yak", yak), ("ox cart", lambda: ox_cart("ceramics"))]),
    ("People", [(r, unit_person(r)) for r in ("merchant", "scout", "guard", "envoy")]),
    ("Cargo swap (one camel)", [(k, unit_camel(True, k)) for k in LOADS] + [("dromedary tea", unit_camel(False, "tea")), ("empty", unit_camel(True, None))]),
    ("Camel trains", [(f"{n} camel{'s' if n > 1 else ''}", (lambda n=n: camel_train(n))) for n in (1, 3, 5)]),
    ("Boats", [("dhow", dhow), ("junk", junk), ("river barge", barge)]),
    ("On a tile (true scale)", [("train of 3", _on("desert", lambda: camel_train(3), p=(0.26, -0.14, 0), s=1.1)),
                                ("guard + merchant", _on("steppe", lambda: person_pair(), s=UNIT_S)),
                                ("dhow at sea", _on("sea", dhow, e="mid", s=UNIT_S)), ("cart on road", _road_cart)]),
]))


# ---------------------------------------------------------------- 10 goods
def _good_on(ter, name, e="low"):
    def f():
        H = tile(ter, e, 5)
        with at((0.32, -0.32, H), s=2.0):
            GOOD[name]()
    return f


BOARDS.append(("10-goods", "Trade goods: resource icons", {"note": "Each sits on a small plinth that drops onto a tile corner. Rows share scale."}, [
    ("Luxuries", [(n, f) for n, f in GOODS[:7]]),
    ("Staples + wealth", [(n, f) for n, f in GOODS[7:]]),
    ("On tiles", [("silk on grassland", _good_on("grassland", "silk")), ("spice in desert", _good_on("desert", "spice")),
                  ("jade in mountains", _good_on("mountain", "jade")), ("salt on salt flat", _good_on("salt flat", "salt")),
                  ("tea in bamboo", _good_on("bamboo", "tea")), ("horses on steppe", _good_on("steppe", "horses"))]),
]))

# ---------------------------------------------------------------- 11 routes
from ck_routes import *  # noqa: E402,F401,F403


def _flag_cell(rgb):
    return lambda: route_flag(rgb)


def _banner_cell(rgb):
    return lambda: city_banner(rgb)


BOARDS.append(("11-routes", "Routes, bridges, flags + borders", {"note": "Roads are 6 edge-to-centre segments + a hub; any edge set makes a junction. Player colours x6."}, [
    ("Dirt road", [(n, road_tile("dirt", e)) for n, e in ROAD_SETS[:6]]),
    ("Stone road", [(n, road_tile("stone", e)) for n, e in ROAD_SETS[1:]]),
    ("Bridges + borders", [("wooden bridge", bridge_tile(wood_bridge)), ("stone bridge", bridge_tile(stone_bridge)),
                           ("border edges", border_tile)]),
    ("Trade route markers (3 tiles)", [("dotted route + flag", route_strip)]),
    ("Route flags", [(n, _flag_cell(c)) for n, c in PLAYER]),
    ("City banners + border posts", [(n, _banner_cell(c)) for n, c in PLAYER] + [("border post", lambda: border_post(PLAYER[0][1]))]),
]))


# ---------------------------------------------------------------- 03 map patch
def map_patch():
    import bpy
    bpy.context.scene.render.resolution_x = bpy.context.scene.render.resolution_y = 1600
    from ck_build import i_farm, i_port, i_watchtower
    PS = STYLES[0]
    L = ELEV["low"]

    def put(q, r, fn):
        x, y = axial(q, r)
        with at((x, y, 0)):
            fn()

    put(0, 0, lambda: city(PS, "city"))
    put(0, 1, i_farm(2))
    put(1, 0, lambda: tile("oasis", "low", 2))
    put(-1, 1, lambda: tile("river straight", "low", 3))
    put(-1, 0, lambda: tile("river straight", "low", 4))
    put(-1, 2, lambda: (tile("lake", "mid", 5), river(ELEV["mid"], [4])))
    put(-1, -1, lambda: tile("river delta", "low", 6))
    put(-1, -2, lambda: tile("sea", "mid", 7))
    put(0, -2, i_port(1))
    put(1, 1, lambda: tile("mountain", "high", 8))
    put(0, 2, lambda: tile("high pass", "high", 9))
    put(-2, 1, lambda: tile("rice terraces", "low", 10))
    put(-2, 2, lambda: tile("forest", "mid", 11))
    put(2, -1, i_watchtower)
    put(2, 0, lambda: plain("low", STEPPE))
    put(1, -1, lambda: plain("low", SAND))
    put(0, -1, lambda: plain("low", SAND))

    def on(q, r, H, fn, rz=0.0, s=1.0, d=(0, 0)):
        x, y = axial(q, r)
        with at((x + d[0], y + d[1], H), rz=rz, s=s):
            fn()

    on(0, -1, L, lambda: stone_road([1, 0]))
    on(1, -1, L, lambda: stone_road([3, 0]))
    on(1, -1, L, lambda: camel_train(3), rz=120 - SIDE, s=1.0, d=(0.25, 0.14))
    on(0, -1, L, lambda: decor("rocks", s=0.5), d=(-0.45, -0.3))
    on(0, -1, L, lambda: person("guard"), rz=TURN, s=UNIT_S, d=(-0.3, 0.15))
    on(2, 0, L, lambda: decor("yurts", s=0.8), d=(0.1, 0.15))
    on(2, 0, L, horse_rider, s=UNIT_S * 0.8, d=(-0.3, -0.35))
    on(-1, -2, WATER_Z, dhow, s=UNIT_S, d=(0.1, 0.0))
    on(0, 2, ELEV["high"], yak, s=1.2, d=(0.05, -0.45))
    on(-1, 0, L, lambda: wood_bridge(), rz=30)
    a, b, c3 = axial(0, 0), axial(1, 0), axial(2, 0)
    route_dots((a[0] + 0.6, a[1] + 0.35), b, L + 0.01)
    route_dots(b, c3, L + 0.01)
    on(1, 0, L, lambda: route_flag(PLAYER[0][1]), d=(0.35, -0.35), s=1.2)


BOARDS.append(("03-map-patch", "Map patch: 17 tiles assembled", {"shared": False, "note": "Persian city, river to the delta, port, caravan on the road, mountains behind. Full-res cell: renders/03-map-patch/00-00.png"},
               [("", [("patch", map_patch)])]))


# ---------------------------------------------------------------- v2: full hex set
from ck_tiles2 import *  # noqa: E402,F401,F403


def rows_of(items, n, label, e="mid"):
    out = []
    for i in range(0, len(items), n):
        out.append((label if i == 0 else f"{label} (cont.)", [(nm, cell(fn, e, 3 + j)) for j, (nm, fn) in enumerate(items[i:i + n])]))
    return out


BOARDS.append(("12-forests", "Hex set: forests", {"note": "Mid elevation. Round-blob broadleaf, chunky pines, jungle, autumn, snow."}, rows_of(FORESTS, 8, "Forests")))
BOARDS.append(("13-ocean", "Hex set: ocean", {"note": "Water surface 0.15. Fish shoals are the sea resource tile."}, rows_of(OCEAN, 5, "Ocean")))
BOARDS.append(("14-coasts", "Hex set: shore configurations", {"note": "Land drawn along the land edges (trapezoid + sector pieces) over a sea tile, with a beach step. Rotate for all 6 orientations."}, [
    ("Beach coast (low)", [(n, coast_tile(e, "low")) for n, e in COASTS]),
    ("Cliff coast (high)", [(n, coast_tile(e, "high")) for n, e in COASTS[:4]]),
]))
BOARDS.append(("15-rivers", "Hex set: rivers", {"note": "Edge-to-centre river connectors: any edge set works. Plus spring, lake mouth, waterfall, ford, delta."}, rows_of(RIVERS, 7, "Rivers", "low")))
BOARDS.append(("16-wild", "Hex set: wild lands", {"note": "Mid elevation."}, rows_of(WILD, 6, "Wild lands")))
BOARDS.append(("17-highlands", "Hex set: highlands + resources", {"note": "Mountain ranges with 1-3 peaks, and resource-bearing variants."}, rows_of(HIGHLANDS, 6, "Highlands + resources")))
BOARDS.append(("18-farm-oasis", "Hex set: farmland + oases", {"note": "Low elevation."}, rows_of(FARMS, 8, "Farm + oasis", "low")))
BOARDS.append(("19-transitions", "Hex set: terrain transitions", {"note": "Base terrain with a neighbour's terrain creeping in along 1-3 edges; rotate to fit."}, rows_of(TRANSITIONS, 8, "Blends", "low")))


def _team_city(rgb, st, stage):
    def f():
        set_team(rgb)
        city(STYLES[st], stage)
        set_team(PLAYER[0][1])
    return f


def _team_units(rgb):
    def f():
        set_team(rgb)
        H = plain("low", SAND)
        with at((-0.42, 0.12, H), rz=TURN, s=UNIT_S):
            person("guard")
        with at((-0.02, -0.42, H), rz=TURN, s=UNIT_S):
            person("envoy")
        with at((0.38, 0.22, H), rz=SIDE, s=1.25):
            camel(True, "silk")
        set_team(PLAYER[0][1])
    return f


BOARDS.append(("20-team-colours", "Team colour: one material slot", {"note": "Flags, banners, pennants, shield and saddle stripes all use the material named 'team'; a game recolours it per player."}, [
    ("Persian city", [(n, _team_city(c, 0, "city")) for n, c in PLAYER]),
    ("Chinese capital", [(n, _team_city(c, 2, "capital")) for n, c in PLAYER]),
    ("Units", [(n, _team_units(c)) for n, c in PLAYER]),
]))


# ---------------------------------------------------------------- 21-23 proportion exploration
from ck_props import *  # noqa: E402,F401,F403


def ruler(h, x=-0.2, w=None):
    """Height gauge (and optional floor bar of width w) in every cell: fixes the
    frame so all rows share one scale."""
    box((0.012, 0.012, h), (x, 0.12, h / 2), C(214, 210, 204))
    if w:
        box((w, 0.012, 0.006), (x + w / 2, 0.12, 0.003), C(214, 210, 204))
    for i in range(1, int(h / 0.1) + 1):
        box((0.03 if i % 5 else 0.05, 0.014, 0.006), (x, 0.12, i * 0.1), C(160, 156, 150))


def _pp(role, pr):
    def f():
        ruler(0.55, x=-0.24)
        with at((0, 0, 0), rz=TURN):
            person_p(role, pr)
    return f


def _ap(kind, pr, rider_pr):
    def f():
        ruler(0.72, x=-0.34, w=0.74)
        with at((0, 0, 0), rz=SIDE):
            if kind == "bactrian":
                camel_p(True, pr, None)
            elif kind == "dromedary":
                camel_p(False, pr, "spice")
            elif kind == "horse":
                horse_p(pr, rider=True, rider_pr=rider_pr)
            elif kind == "yak":
                yak_p(pr)
            else:
                ox_p(pr)
    return f


BOARDS.append(("21-proportions-people", "Proportions: people", {"note": "Same 4 minis per row; the grey gauge (0.1 ticks) is identical in every cell, so all rows share one scale."}, [
    (f"{n}: {label(pr)}", [(r, _pp(r, pr)) for r in ("merchant", "scout", "guard", "envoy")]) for n, pr in PEOPLE_VARIANTS]))

BOARDS.append(("22-proportions-animals", "Proportions: animals", {"note": "Bactrian (unloaded, so the humps show), dromedary (spice), horse + rider (matching people proportions), yak, ox. Shared gauge in every cell."}, [
    (f"{n}: {label(pr)}" + (f"  (rider: {next(pn for pn, pp in PEOPLE_VARIANTS if pp == rp)})" if rp else ""),
     [(a if a != "bactrian" else "bactrian (unloaded)", _ap(a, pr, rp)) for a in ("bactrian", "dromedary", "horse", "yak", "ox")])
    for n, pr, rp in ANIMAL_VARIANTS]))

PAIRS = [("Baseline", {}, {}), ("Super-deformed + toy block", PEOPLE_VARIANTS[1][1], ANIMAL_VARIANTS[9][1]),
         ("Heroic + long legs", PEOPLE_VARIANTS[2][1], ANIMAL_VARIANTS[1][1]), ("Stocky + barrel body", PEOPLE_VARIANTS[6][1], ANIMAL_VARIANTS[7][1])]


def _on_tile(ppr, apr):
    def f():
        H = plain("low", SAND)
        with at((-0.55, 0.22, H), rz=TURN, s=UNIT_S):
            person_p("guard", ppr)
        with at((-0.3, -0.42, H), rz=TURN, s=UNIT_S):
            person_p("merchant", ppr)
        with at((0.2, 0.4, H), rz=SIDE, s=1.25):
            camel_p(True, apr, "silk")
        with at((0.42, -0.22, H), rz=SIDE, s=1.25):
            horse_p(apr, rider=True, rider_pr=ppr)
    return f


BOARDS.append(("23-proportions-on-tile", "Proportions at strategy zoom", {"note": "Guard, merchant, Bactrian camel and horse rider on one hex at true map scale (people 1.7x, animals 1.25x)."}, [
    ("On a hex", [(n, _on_tile(p, a)) for n, p, a in PAIRS])]))


def person_pair():
    with at((-0.15, 0, 0), rz=TURN):
        person("guard")
    with at((0.15, -0.05, 0), rz=TURN):
        person("merchant")


if __name__ == "__main__":
    kit.run(BOARDS)
