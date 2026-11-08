"""Space wizard: a generic robed hermit knight. A big brown hood up over the
giant head (the kid's face and fringe peek out of a darker rim), a long
brown robe that flares to the shoes over a cream tunic with crossed front
panels, wide bell sleeves, a dark leather belt with a buckle and pouches,
and a glowing laser sword held up in one mitt: a chunky silver-and-black
hilt and a bright blue blade with a soft glow round it. Carries the empty
bucket in the other mitt. No logos, no names."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

ROBE, ROBE_D, RIM, TUNIC, TUNIC_D = (0.55, 0.35, 0.2), (0.42, 0.25, 0.14), (0.32, 0.19, 0.1), (0.95, 0.88, 0.72), (0.84, 0.75, 0.58)
BELT, BUCKLE, HILT, HILT_D = (0.25, 0.15, 0.09), (0.85, 0.78, 0.5), (0.8, 0.82, 0.88), (0.15, 0.15, 0.17)
BLADE, CORE, HAIR = (0.3, 0.75, 1.0), (0.92, 0.98, 1.0), (0.3, 0.17, 0.09)
X90 = (math.radians(90), 0, 0)


def glow(o, rgb, strength=2.0, alpha=1.0):
    """Swap an object's material for a flat glowing one (optionally see-through)."""
    m = bpy.data.materials.new("glow")
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*[c ** 2.2 for c in rgb], 1.0)
    em.inputs["Strength"].default_value = strength
    out = nt.nodes["Material Output"]
    if alpha < 1.0:
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        mix = nt.nodes.new("ShaderNodeMixShader")
        mix.inputs[0].default_value = alpha
        nt.links.new(tr.outputs[0], mix.inputs[1])
        nt.links.new(em.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs["Surface"])
        try:
            m.surface_render_method = "BLENDED"
        except AttributeError:
            m.blend_method = "BLEND"
    else:
        nt.links.new(em.outputs[0], out.inputs["Surface"])
    m.diffuse_color = (*rgb, 1.0)
    o.data.materials.clear()
    o.data.materials.append(m)
    return o


def laser_sword(hand, tip):
    """A hilt through the mitt and a glowing blade from the hilt to `tip`."""
    h, t = Vector(hand), Vector(tip)
    d = (t - h).normalized()
    a, b = h - d * 0.3, h + d * 0.32
    limb(a, b, 0.09, HILT, n=10)
    for k in (-0.22, 0.12, 0.24):
        p = h + d * k
        limb(p - d * 0.03, p + d * 0.03, 0.11, HILT_D, n=10)
    limb(b, b + d * 0.08, 0.12, HILT, n=10)          # the emitter collar
    limb(a - d * 0.05, a, 0.1, HILT_D, n=10)         # the pommel
    glow(limb(b + d * 0.05, t, 0.09, CORE, n=10), CORE, 3.0)
    glow(limb(b + d * 0.02, t + d * 0.08, 0.19, BLADE, n=10), BLADE, 2.5, alpha=0.6)
    glow(ball(*t, 0.3, 0.3, 0.3, BLADE, seg=8, ring=6), BLADE, 2.5, alpha=0.55)


def build():
    body(shirt=TUNIC, pants=TUNIC_D, leg_colour=TUNIC_D, shoe=BELT, arms=False, torso=False)
    # the robe: a long flared cloak from the shoulders to the shoes, open at the front
    rz0, rz1 = FOOT * 0.62, TOP + 0.1
    can(0, 0.05, (rz0 + rz1) / 2, 1.08, rz1 - rz0, ROBE, n=10, r2=0.64)
    fy = -0.85
    # the cream tunic showing down the front, with crossed panels
    box(0, -0.68, (rz0 + rz1) / 2 + 0.05, 0.62, 0.3, rz1 - rz0 - 0.1, TUNIC, bevel=0.06)
    for s in (-1, 1):
        box(s * 0.12, -0.84, TOP - 0.25, 0.14, 0.04, 0.55, TUNIC_D, rot=(0, s * math.radians(-28), 0))
    for s in (-1, 1):  # the robe's front edges, folded back
        box(s * 0.42, -0.78, (rz0 + rz1) / 2, 0.16, 0.12, rz1 - rz0 - 0.05, ROBE_D, bevel=0.04)
    # the belt with a buckle and pouches
    bz = HIP + 0.32
    can(0, 0.05, bz, 0.95, 0.2, BELT, n=10)
    box(0, -0.94, bz, 0.24, 0.06, 0.18, BUCKLE, bevel=0.02)
    for x in (-0.55, 0.55):
        box(x, -0.82, bz - 0.12, 0.2, 0.12, 0.22, BELT, bevel=0.04)
    # wide bell sleeves: the right holds the laser sword up, the left carries the bucket
    sx = TW * 0.5 + 0.1
    rh = (sx + 0.45, -0.35, TOP - 0.25)
    can(sx + 0.2, -0.15, TOP - 0.1, 0.17, 0.5, ROBE, n=8, r2=0.3, rot=(0, math.radians(120), 0))
    hand_mitt(*rh, 1, MITT, SKIN)
    laser_sword(rh, (rh[0] + 0.7, rh[1] - 0.35, rh[2] + 2.9))
    lh = (-sx - 0.5, -0.3, TOP - 0.45)
    can(-sx - 0.25, -0.18, TOP - 0.22, 0.17, 0.5, ROBE, n=8, r2=0.3, rot=(0, math.radians(-135), 0))
    hand_mitt(*lh, -1, MITT, SKIN)
    bucket(lh, full=False, size=0.62)
    # the hood up over the giant head, the face in a dark rim
    box(0, 0.22, HEAD_Z + 0.02, HEAD * 1.1, HEAD * 1.0, HEAD * 1.06, ROBE, bevel=0.55, segs=3)
    fz = HEAD_Z - 0.15
    box(0, -0.2, fz, HEAD * 0.86, HEAD * 0.8, HEAD * 0.78, RIM, bevel=0.42, segs=2)
    box(0, -0.27, fz - 0.04, HEAD * 0.76, HEAD * 0.8, HEAD * 0.66, SKIN, bevel=0.36, segs=2)
    ffy = -0.27 - HEAD * 0.4
    box(0, ffy - 0.02, fz + HEAD * 0.24, HEAD * 0.68, 0.16, HEAD * 0.16, HAIR, bevel=0.06)   # fringe
    face(0, fz - 0.05, ffy, HEAD * 0.8)
    # a shoulder drape where the hood meets the robe
    can(0, 0.1, TOP + 0.12, 1.05, 0.28, ROBE_D, n=10, r2=0.85)


if __name__ == "__main__" or True:
    run({"space-wizard": build})
