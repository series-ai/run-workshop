"""Props for the dice animals: regular dice, plain cubes and terrain cubes.

The same 2 x 2 x 2 rounded cube as the animals (so everything stacks on one
grid), but sitting flat on the ground (no feet). Built and animated with the
dice.py machinery: dice get the rolls, drops and corner spin; plain and
terrain cubes get place, drop, land and tap.

    Blender -b --factory-startup -t 1 --python props.py -- <out dir> [prop ...]
"""
import math
import os
import random
import sys

os.environ["DICE_NO_MAIN"] = "1"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dice as D  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

# props sit on the ground: no feet under the cube
S = D.S
D.NUB_H = 0.0
D.BOTTOM = 0.0
D.CZ = S / 2
D.TOP = S
D.C = Vector((0, 0, S / 2))
D._CUBE_PTS = [Vector((x, y, z)) for x in (-S / 2, S / 2) for y in (-S / 2, S / 2) for z in (0.0, S)]
D._GROUND_PTS = list(D._CUBE_PTS)
D.ROLL, D.ROLL_SIDE, D.ROLL_IN = D.Roller((1, 0, 0)), D.Roller((0, -1, 0)), D.RollIn()
CZ, TOP, FRONT = S / 2, S, -S / 2
_face_trs = D.face_trs
D.face_trs = lambda rest, p: _face_trs(rest, p) if "eye_l" in rest else {}  # props have no face
box, ball, can, flat, limb, stroke = D.box, D.ball, D.can, D.flat, D.limb, D.stroke

DICE_CLIPS = [("roll_in", D.ROLL_IN.n, False, D.ROLL_IN), ("roll", D.ROLL.n, False, D.ROLL),
              ("roll_side", D.ROLL_SIDE.n, False, D.ROLL_SIDE), ("drop", 56, False, D.c_drop), ("place", 32, False, D.c_place),
              ("tap", 22, False, D.c_tap), ("spin", 38 + 2 * D.SPIN_LOOP + 76, False, D.c_spin),
              ("spin_start", 38, False, D.c_spin_start), ("spin_loop", D.SPIN_LOOP, True, D.c_spin_loop),
              ("spin_end", 76, False, D.c_spin_end)]
BLOCK_CLIPS = [("place", 32, False, D.c_place), ("drop", 56, False, D.c_drop), ("land", 30, False, D.c_land),
               ("tap", 22, False, D.c_tap)]


def cube(rgb, bevel=D.ROUND):
    return box(0, 0, CZ, S, S, S, rgb, bevel=S * bevel, segs=3)


FACES = {  # name: (normal, u axis, v axis)
    "front": (Vector((0, -1, 0)), Vector((1, 0, 0)), Vector((0, 0, 1))),
    "back": (Vector((0, 1, 0)), Vector((-1, 0, 0)), Vector((0, 0, 1))),
    "right": (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))),
    "left": (Vector((-1, 0, 0)), Vector((0, -1, 0)), Vector((0, 0, 1))),
    "top": (Vector((0, 0, 1)), Vector((1, 0, 0)), Vector((0, 1, 0))),
    "bottom": (Vector((0, 0, -1)), Vector((1, 0, 0)), Vector((0, -1, 0))),
}


def on_face(face, u, v, out=0.0):
    n, a, b = FACES[face]
    return Vector((0, 0, CZ)) + n * (S / 2 + out) + a * u + b * v


def disc(face, u, v, r, rgb, out=0.0, depth=0.05, sides=20):
    n, a, b = FACES[face]
    p = on_face(face, u, v, out)
    o = can(p.x, p.y, p.z, r, depth, rgb, n=sides)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(n)
    return o


def plate(face, u, v, w, h, rgb, out=0.0, depth=0.06, bevel=0.04, segs=1, rot=0.0):
    """A flat rounded rectangle lying on a face (w along u, h along v)."""
    n, a, b = FACES[face]
    p = on_face(face, u, v, out)
    o = box(0, 0, 0, w, h, depth, rgb, bevel=bevel, segs=segs)
    m = D.Matrix((a, b, n)).transposed().to_4x4()   # local x->u, y->v, z->normal
    o.matrix_world = D.Matrix.Translation(p) @ m @ D.Matrix.Rotation(math.radians(rot), 4, "Z")
    return o


# -------------------------------------------------------------- regular dice
G = 0.52
PIPS = {1: [(0, 0)], 2: [(-G, G), (G, -G)], 3: [(-G, G), (0, 0), (G, -G)], 4: [(-G, G), (G, G), (-G, -G), (G, -G)],
        5: [(-G, G), (G, G), (0, 0), (-G, -G), (G, -G)], 6: [(-G, G), (-G, 0), (-G, -G), (G, G), (G, 0), (G, -G)]}
LAYOUT = {"front": 1, "back": 6, "top": 2, "bottom": 5, "right": 3, "left": 4}  # opposite faces add up to 7


def die(body, pip, one=None):
    cube(body, bevel=0.16)
    for face, k in LAYOUT.items():
        for u, v in PIPS[k]:
            r = 0.26 if k == 1 else 0.17
            col = one if (k == 1 and one) else pip
            disc(face, u, v, r, col, out=-0.01, depth=0.06)
            # a little shine on every pip, like the animals' eyes
            disc(face, u - r * 0.35, v + r * 0.38, r * 0.3, (1, 1, 1), out=0.025, depth=0.02, sides=10)
    return {}


def die_white():
    return die((0.99, 0.98, 0.95), (0.16, 0.14, 0.16), one=(0.88, 0.2, 0.24))


def die_red():
    return die((0.88, 0.2, 0.24), (0.99, 0.98, 0.95))


def die_wood():
    return die((0.86, 0.66, 0.42), (0.36, 0.22, 0.14))


# -------------------------------------------------------------- plain cubes
PLAIN = {"cube_white": (0.98, 0.97, 0.95), "cube_red": (0.9, 0.26, 0.26), "cube_orange": (0.98, 0.6, 0.2),
         "cube_yellow": (1.0, 0.86, 0.3), "cube_green": (0.44, 0.78, 0.36), "cube_blue": (0.34, 0.6, 0.95),
         "cube_purple": (0.62, 0.46, 0.86), "cube_pink": (1.0, 0.62, 0.74), "cube_black": (0.2, 0.19, 0.22)}


def plain(rgb):
    def build():
        cube(rgb)
        return {}
    return build


# -------------------------------------------------------------- terrain
def cap_with_drips(rgb, depth, seed, drip=0.22):
    """A thick top layer (grass, snow) whose edge drips down over the sides."""
    rnd = random.Random(seed)
    box(0, 0, TOP - depth / 2 + 0.01, S + 0.06, S + 0.06, depth, rgb, bevel=S * D.ROUND, segs=3)
    edge = (TOP - depth) - CZ  # the cap's lower edge, in face coordinates
    for face in ("front", "back", "right", "left"):
        for k in range(7):  # the cap's edge flows down in soft overlapping waves
            u = -0.9 + 0.3 * k + rnd.uniform(-0.03, 0.03)
            d = drip * rnd.uniform(0.35, 1.0)
            w = rnd.uniform(0.42, 0.52)
            p = on_face(face, u, edge - d * 0.5 + 0.12, -0.02)
            n = FACES[face][0]
            th = 0.1
            ball(p.x, p.y, p.z, w if abs(n.x) < 0.5 else th, w if abs(n.y) < 0.5 else th, d * 2 + 0.24, rgb, seg=14, ring=8)


def dirt():
    DIRT, DARK_D, LIGHT_D = (0.62, 0.42, 0.26), (0.48, 0.32, 0.2), (0.72, 0.52, 0.34)
    cube(DIRT)
    rnd = random.Random(5)
    for face in FACES:
        if face == "bottom":
            continue
        for _ in range(5):
            disc(face, rnd.uniform(-0.75, 0.75), rnd.uniform(-0.75, 0.75), rnd.uniform(0.06, 0.13),
                 rnd.choice((DARK_D, LIGHT_D)), out=0.0, depth=0.05, sides=8)
    return {}


def rock():
    GREY, GREY_D, GREY_L, CRACK = (0.62, 0.62, 0.66), (0.5, 0.5, 0.55), (0.72, 0.72, 0.76), (0.36, 0.36, 0.4)
    cube(GREY, bevel=0.1)
    rnd = random.Random(8)
    for face in FACES:  # chunky slabs: a few rounded blocks slightly raised, like a carved stone
        if face == "bottom":
            continue
        for u, v, w, h in ((-0.42, 0.42, 0.9, 0.86), (0.48, 0.45, 0.8, 0.8), (-0.4, -0.45, 0.86, 0.8), (0.46, -0.42, 0.82, 0.86)):
            plate(face, u + rnd.uniform(-0.04, 0.04), v + rnd.uniform(-0.04, 0.04), w, h, rnd.choice((GREY_D, GREY_L, GREY)),
                  out=0.02, depth=0.1, bevel=0.1, segs=2, rot=rnd.uniform(-4, 4))
    stroke([(-0.3, CZ + 0.9), (-0.18, CZ + 0.5), (-0.3, CZ + 0.2)], FRONT - 0.07, 0.025, CRACK)
    return {}


def brick():
    BRICK, BRICK_L, MORTAR = (0.82, 0.38, 0.3), (0.88, 0.46, 0.36), (0.9, 0.84, 0.76)
    cube(MORTAR, bevel=0.08)
    rnd = random.Random(7)
    for face in ("front", "right", "left", "back", "top"):
        for r_ in range(4):  # running bond: rows offset by half a brick
            v = -0.72 + 0.48 * r_
            off = 0.0 if r_ % 2 == 0 else 0.45
            for c_ in range(-1, 3):
                u = -0.9 + 0.9 * c_ + off
                lo, hi = max(u - 0.42, -0.98), min(u + 0.42, 0.98)
                if hi - lo < 0.12:
                    continue
                plate(face, (lo + hi) / 2, v, hi - lo, 0.4, rnd.choice((BRICK, BRICK_L)), out=0.02, depth=0.08, bevel=0.05)
    return {}


def face_stroke(face, pts, r, rgb, out=0.03):
    """A drawn line on any face: round bars through (u, v) points, a ball on every joint."""
    ps = [on_face(face, u, v, out) for u, v in pts]
    for p0, p1 in zip(ps, ps[1:]):
        limb(p0, p1, r, rgb, n=8)
    for p in ps:
        ball(p.x, p.y, p.z, r * 2, r * 2, r * 2, rgb, seg=8, ring=6)


def wave(face, v, rgb, amp=0.08, r=0.045, u0=-0.75, u1=0.75, waves=2.0, phase=0.0):
    n = 14
    face_stroke(face, [(u0 + (u1 - u0) * i / n, v + amp * math.sin(2 * math.pi * waves * i / n + phase)) for i in range(n + 1)], r, rgb)


def tuft(p, rgb, h=0.26, lean=0.0):
    """A chunky grass tuft: three soft blades."""
    for dx, hh, a in ((-0.07, 0.8, -20), (0.0, 1.0, 0), (0.07, 0.8, 20)):
        o = can(p.x + dx, p.y, p.z + h * hh * 0.5, 0.07, h * hh, rgb, n=6, r2=0.015,
                rot=(0, math.radians(a + lean), 0))
        m = o.modifiers.new("b", "BEVEL")
        m.width, m.segments, m.limit_method = 0.02, 2, "NONE"


def grass():
    DIRT, GRASS, GRASS_D = (0.62, 0.42, 0.26), (0.44, 0.78, 0.32), (0.34, 0.66, 0.26)
    cube(DIRT)
    # a clean grass cap with a straight edge, overhanging the dirt a little
    h = 0.5
    box(0, 0, TOP - h / 2 + 0.02, S + 0.08, S + 0.08, h, GRASS, bevel=0.22, segs=3)
    rnd = random.Random(2)
    for _ in range(6):  # pebbles in the dirt
        face = rnd.choice(("front", "back", "right", "left"))
        disc(face, rnd.uniform(-0.7, 0.7), rnd.uniform(-0.85, -0.25), rnd.uniform(0.06, 0.1), (0.48, 0.32, 0.2), depth=0.04, sides=8)
    for x, y, lean in ((-0.55, -0.5, 8), (0.55, 0.35, -6), (-0.2, 0.6, 0), (0.62, -0.62, 10)):  # a few chunky tufts on top
        tuft(Vector((x, y, TOP + 0.02)), GRASS_D, lean=lean)
    for x, y, col in ((0.2, -0.15, (1.0, 0.95, 0.5)), (-0.5, 0.15, (1.0, 0.62, 0.76))):  # two little flowers
        for k in range(5):
            a = k * 2 * math.pi / 5
            disc("top", x + 0.1 * math.cos(a), y + 0.1 * math.sin(a), 0.08, col, out=0.06, depth=0.05, sides=10)
        disc("top", x, y, 0.06, (1.0, 0.8, 0.25), out=0.09, depth=0.04, sides=10)
    return {}


def sand():
    SAND, DOT = (0.98, 0.86, 0.58), (0.88, 0.7, 0.42)
    cube(SAND)
    rnd = random.Random(4)
    for face in ("front", "back", "right", "left", "top"):  # the same little dots all over
        for _ in range(7):
            disc(face, rnd.uniform(-0.8, 0.8), rnd.uniform(-0.8, 0.8), 0.035, DOT, depth=0.04, sides=6)
    for k in range(5):  # a little seashell
        a = math.radians(-60 + 30 * k)
        plate("top", 0.55 + 0.1 * math.sin(a), 0.5 + 0.1 * math.cos(a), 0.06, 0.2, (1.0, 0.76, 0.72), out=0.04, depth=0.06,
              bevel=0.025, rot=-math.degrees(a))
    return {}


def snow():
    STONE, SNOW, ICICLE = (0.6, 0.62, 0.68), (0.97, 0.98, 1.0), (0.82, 0.93, 1.0)
    cube(STONE)
    # a pillowy snow cap, soft and overhanging
    h = 0.6
    box(0, 0, TOP - h / 2 + 0.06, S + 0.14, S + 0.14, h, SNOW, bevel=0.28, segs=4)
    for x, y in ((-0.5, -0.4), (0.45, 0.5), (0.5, -0.45), (-0.4, 0.5)):  # soft lumps on top
        ball(x, y, TOP + 0.06, 0.7, 0.7, 0.24, SNOW, seg=14, ring=8)
    rnd = random.Random(3)
    edge = TOP - h + 0.1
    for face in ("front", "back", "right", "left"):  # icicles hanging from the cap's edge
        n, a, b = FACES[face]
        for k in range(4):
            u = -0.72 + 0.48 * k + rnd.uniform(-0.06, 0.06)
            ln = rnd.uniform(0.18, 0.42)
            p = Vector((0, 0, CZ)) + n * (S / 2 + 0.03) + a * u
            p.z = edge - ln / 2
            o = can(p.x, p.y, p.z, 0.08, ln, ICICLE, n=6, r2=0.012, rot=(math.radians(180), 0, 0))
            m = o.modifiers.new("b", "BEVEL")
            m.width, m.segments, m.limit_method = 0.02, 2, "NONE"
    return {}


def ice():
    ICE, ICE_D = (0.7, 0.9, 0.98), (0.58, 0.82, 0.95)
    cube(ICE, bevel=0.1)
    for face in ("front", "right", "left", "back", "top"):
        plate(face, 0, 0, 1.3, 1.3, ICE_D, out=-0.01, depth=0.05, bevel=0.14, segs=2)  # a deeper square inside
    return {}


def water():
    """A block of water: a lighter top layer whose edge rolls over in soft round
    wave crests, a deeper body with a few bubbles, and soft highlights."""
    DEEP, BODY, TOP_C, SHINE = (0.24, 0.5, 0.88), (0.34, 0.62, 0.96), (0.56, 0.82, 1.0), (0.94, 0.98, 1.0)
    cube(BODY)
    h = 0.42
    box(0, 0, TOP - h / 2 + 0.03, S + 0.06, S + 0.06, h, TOP_C, bevel=0.2, segs=3)
    rnd = random.Random(12)
    edge = TOP - h + 0.06
    for face in ("front", "back", "right", "left"):  # wave crests rolling over the top edge
        n, a, b = FACES[face]
        for k in range(3):  # three wide, low crests per side: one rolling wave
            u = -0.6 + 0.6 * k
            p = Vector((0, 0, CZ)) + n * (S / 2 + 0.01) + a * u
            p.z = edge - 0.02
            ball(p.x, p.y, p.z, 0.78 if abs(n.x) < 0.5 else 0.1, 0.78 if abs(n.y) < 0.5 else 0.1, 0.26, TOP_C, seg=12, ring=6)
        for _ in range(3):  # bubbles
            disc(face, rnd.uniform(-0.6, 0.6), rnd.uniform(-0.75, -0.05), rnd.uniform(0.07, 0.12), TOP_C, out=0.01, depth=0.04)
    for x, y, w, l in ((-0.45, -0.4, 0.5, 0.22), (-0.1, -0.62, 0.18, 0.12), (0.5, 0.45, 0.36, 0.16)):  # soft highlights on top
        plate("top", x, y, w, l, SHINE, out=0.05, depth=0.04, bevel=0.06, segs=2, rot=-20)
    return {}

def crate():
    WOOD, FRAME = (0.72, 0.5, 0.28), (0.9, 0.7, 0.44)
    cube(WOOD, bevel=0.08)
    for face in ("front", "right", "left", "back", "top"):  # a thick soft frame and brace, nothing fussy
        for u, v, w, h in ((0, 0.8, 1.98, 0.38), (0, -0.8, 1.98, 0.38), (0.8, 0, 0.38, 1.98), (-0.8, 0, 0.38, 1.98)):
            plate(face, u, v, w, h, FRAME, out=0.04, depth=0.12, bevel=0.08, segs=2)
        plate(face, 0, 0, 1.75, 0.34, FRAME, out=0.05, depth=0.12, bevel=0.08, segs=2, rot=45)
    return {}


def hay():
    HAY, HAY_D, TWINE = (0.98, 0.82, 0.38), (0.88, 0.68, 0.26), (0.72, 0.36, 0.24)
    cube(HAY, bevel=0.12)
    rnd = random.Random(6)
    for x in (-0.48, 0.48):  # two twine bands, all the way round
        for face in ("front", "back", "top", "bottom"):
            plate(face, x if face != "back" else -x, 0, 0.12, 2.04, TWINE, out=0.02, depth=0.06, bevel=0.03)
    for _ in range(10):  # tufts poking out
        face = rnd.choice(("front", "right", "left", "back"))
        n, a, b = FACES[face]
        p = on_face(face, rnd.uniform(-0.8, 0.8), rnd.uniform(-0.8, 0.8))
        limb(p, p + n * 0.16 + a * rnd.uniform(-0.08, 0.08) + b * rnd.uniform(-0.05, 0.08), 0.03, HAY_D)
    return {}


def bush():
    LEAF, LEAF_D, LEAF_L = (0.36, 0.7, 0.32), (0.28, 0.58, 0.26), (0.46, 0.8, 0.4)
    cube(LEAF)
    rnd = random.Random(10)
    for face in FACES:  # big rounded-cube leaf clusters, like the sheep's wool
        if face == "bottom":
            continue
        for u in (-0.45, 0.45):
            for v in (-0.45, 0.45):
                plate(face, u + rnd.uniform(-0.05, 0.05), v + rnd.uniform(-0.05, 0.05), 0.86, 0.86, rnd.choice((LEAF, LEAF_D, LEAF_L)),
                      out=0.04, depth=0.24, bevel=0.2, segs=3, rot=rnd.uniform(-8, 8))
    for x, y in ((0.4, -0.3), (-0.45, 0.4)):  # two little berries
        ball(x, y, TOP + 0.2, 0.18, 0.18, 0.18, (0.9, 0.24, 0.3), seg=8, ring=6)
    return {}


PROPS = {"die_white": die_white, "die_red": die_red, "die_wood": die_wood,
         "cube": plain((1.0, 1.0, 1.0)),  # one plain cube: tint its material colour in code
         "grass": grass, "dirt": dirt, "rock": rock, "sand": sand, "snow": snow, "ice": ice, "water": water,
         "crate": crate, "hay": hay, "brick": brick, "bush": bush}


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    out, names = args[0], args[1:] or list(PROPS)
    os.makedirs(out, exist_ok=True)
    D.ANIMALS.clear()
    D.ANIMALS.update(PROPS)
    for name in names:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        D.bobble._mats.clear()
        bpy.context.scene.render.fps = D.FPS
        nodes, rest = D.build(name)
        D.CLIPS[:] = DICE_CLIPS if name.startswith("die_") else BLOCK_CLIPS
        D.bake(nodes, rest)
        D.still(os.path.join(out, f"{name}-34.png"))
        bpy.ops.export_scene.gltf(filepath=os.path.join(out, f"{name}.glb"), export_format="GLB", export_yup=True,
                                  export_apply=False, export_animations=True, export_animation_mode="ACTIONS",
                                  export_merge_animation="ACTION", export_force_sampling=True,
                                  export_optimize_animation_size=True, export_optimize_animation_keep_anim_object=True,
                                  export_texcoords=False, export_skins=False, export_morph=False,
                                  export_cameras=False, export_lights=False, export_extras=False)
        print("WROTE", name)


main()
