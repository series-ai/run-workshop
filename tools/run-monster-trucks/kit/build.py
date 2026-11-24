"""Blender entry: build the kit to GLB.

    Blender -b -t 1 --factory-startup --python kit/build.py -- [--out DIR] [--only SUBSTR ...]

out/glb/
  bodies/body-<name>.glb        origin on the body's centre underside; sockets:
                                socket-axle-f/-r, socket-belly, socket-roof,
                                socket-hood, socket-stack-l/-r (when it has them)
  wheels/wheels-<kind>-<f|r>.glb  an axle module: hangs from socket-axle-f/-r
  wheels/treads-<S|M|L>.glb     tracks + hull: hangs from socket-belly
  parts/<slot>-<name>.glb       roof / hood / stack bolt-ons
  vehicles/<body>.glb           ready-made: the body's default loadout
  kit.json                      what fits where, drops, defaults (for the viewer
                                and the JS helper)

Rake: front and rear modules can differ in height (`drop`). The body then
pitches so both reach the ground, and each module counter-rotates to stay
upright: sin(pitch) = (drop_f - drop_r) / wheelbase.
"""
from __future__ import annotations

import json
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import kit  # noqa: E402  (sets up sys.path and the palette)
import export as EX  # noqa: E402
from accessories import ACCESSORIES  # noqa: E402
from bodies import BODIES, DEFAULTS  # noqa: E402
from clips import vehicle_clips  # noqa: E402
from modules import AXLE_KINDS, MONO_KINDS, axle_module, tread_module  # noqa: E402
from trailers import RISER, TRAILER_PAINT, TRAILERS  # noqa: E402
from raiders import RAIDERS  # noqa: E402
from voxgrid import Asset, Part, Socket  # noqa: E402


def renamed(part: Part, prefix: str) -> Part:
    """Prefix every node name (two copies of one part in a vehicle)."""
    for p in part.walk():
        p.name = f"{prefix}{p.name}"
    return part


def smooth_normals(obj, angle: float = 50.0) -> None:
    """Smooth shading over a prism mesh whose faces don't share vertices:
    each corner averages the (area-weighted) normals of faces meeting at the
    same point within `angle` of its own face, so facets and loft seams blend
    while hard edges (soles, cuffs) stay crisp and hidden inner caps (facing
    the other way) don't bleed in."""
    me = obj.data
    if not len(me.polygons):
        return
    me.update()
    nl = len(me.loops)
    vi = np.empty(nl, np.int32)
    me.loops.foreach_get("vertex_index", vi)
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    key = np.round(co.reshape(-1, 3)[vi] * 1e4).astype(np.int64)
    _, group = np.unique(key, axis=0, return_inverse=True)
    group = group.ravel()
    fn = np.empty(len(me.polygons) * 3)
    me.polygons.foreach_get("normal", fn)
    area = np.empty(len(me.polygons))
    me.polygons.foreach_get("area", area)
    tot = np.empty(len(me.polygons), np.int32)
    me.polygons.foreach_get("loop_total", tot)
    face = np.repeat(np.arange(len(me.polygons)), tot)
    ln = fn.reshape(-1, 3)[face]
    w = area[face][:, None] * ln
    lim = np.cos(np.radians(angle))
    out = np.zeros((nl, 3))
    order = np.argsort(group, kind="stable")
    bounds = np.flatnonzero(np.diff(group[order])) + 1
    for idx in np.split(order, bounds):
        d = ln[idx] @ ln[idx].T  # pairwise normal agreement within this point
        out[idx] = (d >= lim).astype(float) @ w[idx]
    out /= np.maximum(np.linalg.norm(out, axis=1, keepdims=True), 1e-9)
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    me.normals_split_custom_set(out.tolist())


def export(asset: Asset, path: str) -> None:
    """export.build_asset without centring: the kit frame is the contract."""
    asset.validate()
    EX.reset_scene()
    objects = EX.build_parts(asset, None)
    if asset.category == "creatures":  # characters: smooth, not faceted
        for obj in objects.values():
            if obj.type == "MESH":
                smooth_normals(obj)
    for p in asset.root.walk():  # node scale (bike meshes drawn at design size)
        if p.meta.get("scale"):
            objects[p.name].scale = (p.meta["scale"],) * 3
    EX.build_sockets(asset, objects)
    EX.build_clips(asset, objects)
    EX.export_glb(path, animated=bool(asset.clips))


SLOT_SOCKETS = {"roof": "socket-roof", "hood": "socket-hood", "bumper": "socket-front"}  # bolt-on slot -> body socket
MAX_PITCH = 10.0  # degrees; past this the lower axle hangs on longer struts


def pitch_for(cls: str, drop_f: float, drop_r: float) -> tuple[float, float, float, float]:
    """(body height, pitch degrees about +x, front and rear strut extension):
    the body tips toward the smaller wheels, up to MAX_PITCH; any height
    still missing is made up by lowering that axle on its stretched struts."""
    half = kit.WB[cls] / 2
    lim = math.sin(math.radians(MAX_PITCH))
    s = max(-lim, min(lim, (drop_f - drop_r) / kit.WB[cls]))
    h = max(drop_f - half * s, drop_r + half * s)
    return h, math.degrees(math.asin(s)), h + half * s - drop_f, h - half * s - drop_r


def assemble(key: str, loadout: dict, allow_extension: bool = False) -> tuple[Part, list[Socket], dict]:
    """A body with wheel modules on its sockets and bolt-ons on top."""
    broot, cls, socks = BODIES[key]()
    at = {s.name: s.at for s in socks}
    root = Part(f"vehicle-{key}", None)
    root.add(broot)
    info = {"class": cls}
    if loadout["front"] == "treads":
        m = tread_module(cls)
        h, pitch = m.drop, 0.0
        m.root.at = at["socket-belly"]
        broot.add(m.root)
        info["modules"] = {"belly": m}
    else:
        mf, mr = axle_module(loadout["front"], "f"), axle_module(loadout["rear"], "r")
        h, pitch, ext_f, ext_r = pitch_for(cls, mf.drop, mr.drop)
        if (ext_f > 1e-6 or ext_r > 1e-6) and not allow_extension:
            raise ValueError(f"{key}: a ready-made loadout must not need strut extension")
        for m, s in ((mf, "socket-axle-f"), (mr, "socket-axle-r")):
            m.root.at = at[s]
            m.root.rot = (-pitch, 0.0, 0.0)
            broot.add(m.root)
        info["modules"] = {"f": mf, "r": mr}
        if "socket-axle-s" in at:  # a sidecar wheel: the rear wheel's kind, as a single
            kind = loadout["rear"] if loadout["rear"].startswith("mono-") else f"mono-{loadout['rear']}"
            ms = axle_module(kind, "s")
            ms.root.at = at["socket-axle-s"]
            ms.root.rot = (-pitch, 0.0, 0.0)
            broot.add(ms.root)
            info["modules"]["s"] = ms
            info["z"] = {"s": at["socket-axle-s"][2]}
    broot.at = (0.0, h, 0.0)
    broot.rot = (pitch, 0.0, 0.0)
    info.update(height=h, pitch=pitch)
    body = next(p for p in broot.children if p.name == "body")  # bolt-ons ride the squash
    part_scale = BIKE_SCALE if key in BIKES else None
    for slot, socket in SLOT_SOCKETS.items():
        name = loadout.get(slot)
        if name and socket in at:
            p = ACCESSORIES[slot][name]()
            p.at = at[socket]
            if part_scale:
                p.meta["scale"] = part_scale
            body.add(p)
    if loadout.get("stacks"):
        for side in ("l", "r"):
            if f"socket-stack-{side}" in at:
                p = renamed(ACCESSORIES["stacks"][loadout["stacks"]](), f"{side}-")
                p.at = at[f"socket-stack-{side}"]
                if part_scale:
                    p.meta["scale"] = part_scale
                body.add(p)
    body_socks = [s for s in socks if not s.name.startswith(("socket-axle", "socket-belly"))]
    return root, body_socks, info


def assets(only: list[str]):
    out = []
    for key, f in BODIES.items():
        root, cls, socks = f()
        out.append(("bodies", f"body-{key}", Asset(id=f"trucks-vehicles-body-{key}", pack=kit.PACK, category="vehicles", name=key, root=root, sockets=socks)))
    for key, f in TRAILERS.items():
        root, socks = f()
        out.append(("bodies", f"trailer-{key}", Asset(id=f"trucks-vehicles-trailer-{key}", pack=kit.PACK, category="vehicles", name=f"{key} trailer", root=root, sockets=socks)))
    for kind in AXLE_KINDS + MONO_KINDS:
        for tag in ("f", "r", "t"):
            m = axle_module(kind, tag)
            out.append(("wheels", f"wheels-{kind}-{tag}", Asset(id=f"trucks-vehicles-wheels-{kind}-{tag}", pack=kit.PACK, category="vehicles", name=f"{kind} {tag}", root=m.root)))
    for cls in kit.WB:
        m = tread_module(cls)
        out.append(("wheels", f"treads-{cls}", Asset(id=f"trucks-vehicles-treads-{cls}", pack=kit.PACK, category="vehicles", name=f"treads {cls}", root=m.root)))
    for slot, items in ACCESSORIES.items():
        for name, f in items.items():
            out.append(("parts", f"{slot}-{name}", Asset(id=f"trucks-vehicles-{slot}-{name}", pack=kit.PACK, category="vehicles", name=f"{slot} {name}", root=f())))
    for key, f in RAIDERS.items():
        out.append(("raiders", f"raider-{key}", Asset(id=f"trucks-creatures-raider-{key}", pack=kit.PACK, category="creatures", name=f"{key} raider", root=f())))
    for key, loadout in DEFAULTS.items():
        root, socks, info = assemble(key, loadout)
        out.append(("vehicles", key, Asset(id=f"trucks-vehicles-{key}", pack=kit.PACK, category="vehicles", name=key, root=root, sockets=socks,
                                           clips=vehicle_clips(root, info))))
    if only:
        out = [o for o in out if any(s in o[1] for s in only)]
    return out


# Paint swaps: each body's main, trim and accent ramp (the accent is the
# bumper/grille metal, or the ice-cream van's teal details), and the ramps a
# player can swap them to (8 shades each, exact atlas colours).
BODY_PAINT = {
    "bus-hood": ("sky", "bone", "steel"), "bus-flat": ("gold", "iron", "steel"),
    "icecream": ("bone", "pink", "teal"), "muscle": ("orange", "teal", "steel"), "hatch": ("lime", "orange", "steel"),
}
from more_bodies import MORE_PAINT  # noqa: E402

BODY_PAINT.update(MORE_PAINT)
from bikes import BIKE_PAINT, BIKES, PART_SCALE as BIKE_SCALE  # noqa: E402

BODY_PAINT.update(BIKE_PAINT)
from more_bodies2 import MORE_PAINT2  # noqa: E402

BODY_PAINT.update(MORE_PAINT2)
# Bolt-on colour roles: which of a part's ramps follow the paint, trim and
# accent picks (anything not listed keeps its own colour, e.g. the cone).
PART_PAINT = {
    "roof-rack-spare": {"trim": "orange", "accent": "steel"},
    "roof-rack-cargo": {"paint": "red", "trim": "khaki", "accent": "steel"},
    "roof-jerry-frame": {"paint": "red", "accent": "iron"},
    "roof-cone": {"accent": "steel"},
    "roof-light-bar": {"accent": "iron"},
    "hood-blower": {"accent": "steel"},
    "hood-blower-giant": {"accent": "steel"},
    "stacks-stack": {"accent": "steel"},
    "bumper-cow-catcher": {"paint": "red", "accent": "steel"},
    "bumper-longhorns": {"accent": "steel"},
    "bumper-roo-bar": {"accent": "iron"},
    "bumper-dozer-blade": {"paint": "gold", "accent": "steel"},
    "bumper-spike-ram": {"paint": "rust", "accent": "steel"},
    "bumper-winch-bumper": {"trim": "red", "accent": "steel"},
    "roof-harpoon": {"paint": "khaki", "accent": "steel"},
    "roof-searchlights": {"paint": "red", "accent": "iron"},
    "roof-tyre-stack": {"trim": "orange", "accent": "steel"},
    "roof-dish": {"paint": "bone", "accent": "steel"},
    "roof-surfboard": {"paint": "teal", "trim": "bone", "accent": "steel"},
    "hood-scoop": {"paint": "red", "accent": "iron"},
    "hood-velocity-stacks": {"accent": "steel"},
    "hood-turbo": {"trim": "orange", "accent": "steel"},
    "stacks-zoomies": {"accent": "steel"},
    "stacks-flame-stack": {"accent": "steel"},
    "bumper-tusks": {"accent": "steel"},
    "bumper-tyre-bumper": {"accent": "steel"},
    "bumper-log-ram": {"accent": "steel"},
}
SWATCHES = ("gold", "orange", "red", "pink", "purple", "sky", "teal", "lime", "khaki", "bone", "steel", "iron")


def ramp_colors(names) -> dict:
    from voxgrid import PALETTE, RAMP_SHADES, palette_colors

    colors = palette_colors(kit.PACK)
    return {r: colors[PALETTE["ramps"][r] * RAMP_SHADES : (PALETTE["ramps"][r] + 1) * RAMP_SHADES] for r in names}


def paints() -> dict:
    return ramp_colors(SWATCHES)


def manifest() -> dict:
    bodies = {}
    for key, f in BODIES.items():
        _, cls, socks = f()
        main, trim, accent = BODY_PAINT[key]
        bodies[key] = {"class": cls, "sockets": [s.name for s in socks], "defaults": DEFAULTS[key], "paint": main, "trim": trim, "accent": accent,
                       "partScale": BIKE_SCALE if key in BIKES else 1}
    wheels = {}
    for kind in AXLE_KINDS + MONO_KINDS:
        m = axle_module(kind, "f")
        wheels[kind] = {"drop": m.drop, "radius": m.radius, "spring": m.spring, "single": bool(m.meta.get("single"))}
    treads = {cls: {"drop": tread_module(cls).drop} for cls in kit.WB}
    import time

    trailers = {}
    for key, f in TRAILERS.items():
        _, socks = f()
        main, trim, accent = TRAILER_PAINT[key]
        trailers[key] = {"sockets": [s.name for s in socks], "paint": main, "trim": trim, "accent": accent}
    from voxgrid import PALETTE

    missing = {f"{slot}-{n}" for slot, items in ACCESSORIES.items() for n in items} - set(PART_PAINT)
    if missing:
        raise ValueError(f"PART_PAINT has no colour roles for {sorted(missing)}")
    return {"version": int(time.time()), "raiders": list(RAIDERS), "riser": RISER, "partPaint": PART_PAINT, "ramps": ramp_colors(PALETTE["ramps"]), "trailers": trailers, "wheelbase": kit.WB, "maxPitch": MAX_PITCH, "bodies": bodies, "wheels": wheels, "treads": treads, "paints": paints(),
            "parts": {slot: list(items) for slot, items in ACCESSORIES.items()}}


def main() -> int:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "out", "glb")
    only: list[str] = []
    i = 0
    while i < len(argv):
        if argv[i] == "--out":
            out_dir = argv[i + 1]; i += 2
        elif argv[i] == "--only":
            only.append(argv[i + 1]); i += 2
        else:
            raise SystemExit(f"unknown arg {argv[i]}")
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "kit.json"), "w") as fh:
        json.dump(manifest(), fh, indent=1)
    for kind, fname, asset in assets(only):
        d = os.path.join(out_dir, kind)
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, f"{fname}.glb")
        export(asset, path)
        print(f"BUILT {path}")
    return 0


if __name__ == "__main__":
    try:
        code = main()
    except Exception:
        import traceback

        traceback.print_exc()
        code = 1
    sys.stdout.flush()
    os._exit(code)
