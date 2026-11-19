"""Every Glowdrop asset that ships: output path, builder, orientation and clips.

Builders are the concept-board functions (one source of truth). Creatures built
nose-along-+x are turned -90° so they face -Y in Blender (= +Z in glTF)."""
import re

import kit
import bugs
import plants
import props
import sea
import shrooms
import clips as C

SKIP = set()  # asset paths cut from the pack (filled in from the review)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


ASSETS = []


def add(path, fn, **opt):
    if path not in SKIP:
        ASSETS.append(dict(path=path, fn=fn, **opt))


# ---------------------------------------------------------------- growing things (static)
for name, f in shrooms.SPECIES:
    for i, st in enumerate(shrooms.STAGES):
        add(f"mushrooms/{slug(name)}-{i + 1}-{slug(st)}", (lambda f=f, i=i: f(i)))

for name, f in plants.PLANTS:
    for i, st in enumerate(plants.STAGES):
        add(f"plants/{slug(name)}-{i + 1}-{slug(st)}", (lambda f=f, i=i: f(i)))

for kind in ("branch", "fan", "brain", "bubble"):
    f = plants.coral(kind)
    label = "finger" if kind == "branch" else kind
    for i, st in enumerate(plants.CORAL_STAGES):
        add(f"corals/{label}-coral-{i + 1}-{slug(st)}", (lambda f=f, i=i: f(i)))

# ---------------------------------------------------------------- mushroom kit (any cap on any stem)
STEM_TOP = {"slim": 0.47, "stout": 0.42, "bulb": 0.44, "ringed": 0.47, "curved": 0.42}


def _cap(shape, glow=None):
    z0 = shrooms.CAP_SHAPES[shape][0][1]

    def f():
        with kit.at((0, 0, -z0 - 0.03)):  # underside at the origin, sunk 3 cm onto the stem
            if glow:
                glow(shape)
            else:
                shrooms.part_cap(shape, shrooms.INDIGO)()
    return f


for shape in shrooms.CAP_SHAPES:
    add(f"kit/mushroom/cap-{shape}", _cap(shape))
    for gname, g in (("spots", shrooms.glow_spots), ("rim", shrooms.glow_rim), ("gills", shrooms.glow_gills),
                     ("whole", shrooms.glow_cap), ("stripes", shrooms.glow_stripes)):
        add(f"kit/mushroom/glow-{gname}-for-{shape}", _cap(shape, g))
for kind, top in STEM_TOP.items():
    add(f"kit/mushroom/stem-{kind}", shrooms.part_stem(kind), sockets={"cap": (0.02 if kind == "curved" else 0, 0, top)})

# ---------------------------------------------------------------- jellyfish
for name, f in sea.JELLY:
    for i, st in enumerate(sea.JSTAGES):
        grounded = i == 0 or (name == "Upside-down jelly" and i == 2)  # polyps and the upside-down medusa sit on the floor
        add(f"creatures/jellies/{slug(name)}-{i + 1}-{st}", (lambda f=f, i=i: f(i)),
            center=not grounded, clips=C.jelly_clips(i, grounded))

# ---------------------------------------------------------------- fish and sea critters
FACING_FRONT = {"sea angel", "dumbo octopus"}   # built facing -Y already


def _flip(fn):
    def f():
        with kit.at((0, 0, 0), rz=180):
            fn()
    return f


for name, fn in sea.FISH:
    if name == "firefly squid":  # built arms-toward -x: spin so its arms lead
        fn = _flip(fn)
    add(f"creatures/sea/{slug(name)}", fn, turn=0 if name in FACING_FRONT else -90, center=True, clips=C.fish_clips(name))

# ---------------------------------------------------------------- bugs
for name, f, stages in bugs.BUGS:
    for i, st in enumerate(stages):
        add(f"creatures/bugs/{slug(name)}-{i + 1}-{slug(st)}", (lambda f=f, i=i: f(i)), turn=-90, scale=1.6,
            clips=C.bug_clips(name, i, len(stages)))

# ---------------------------------------------------------------- props, FX, habitat
for name, fn in (("bug-net", props.bug_net), ("fishing-rod", props.fishing_rod), ("field-guide", props.field_guide),
                 ("lantern", props.lantern), ("terrarium", props.terrarium), ("museum-plinth", props.plinth),
                 ("display-case", props.display_case)):
    add(f"props/{name}", fn)
for content in (None, "firefly", "mushroom", "jelly"):
    add(f"props/jar-{content or 'empty'}", props.jar(content))
for size in ("small", "medium", "large"):
    add(f"props/aquarium-{size}", props.aquarium(size))
for k in range(1, 7):
    add(f"fx/shadow-{k}", (lambda k=k: _shadow_only(k)))
add("fx/spawn-sparkle", props.spawn_sparkle, clips=C.fx_clips("sparkle"))
add("fx/bubbles", props.bubbles, clips=C.fx_clips("bubbles"))
add("fx/ripple-ring", props.ripple, clips=C.fx_clips("ripple"))
for size in ("small", "medium", "large"):
    add(f"habitat/glow-pond-{size}", props.pond(size))
for kind in ("straight", "corner"):
    add(f"habitat/shore-{kind}", props.shore(kind))
for name, fn in (("tide-pool", props.tide_pool), ("mossy-log", props.mossy_log), ("stump", props.stump),
                 ("rock-cluster", props.rocks), ("stalagmites", props.stalagmites), ("driftwood", props.driftwood)):
    add(f"habitat/{name}", fn)


def _shadow_only(k):
    """The ground shadow without the sand tile the board shows it on."""
    import bpy
    props.shadow(k)()
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.name.startswith("box"):  # the 1.3 x 0.9 board tile
            bpy.data.objects.remove(o, do_unlink=True)
