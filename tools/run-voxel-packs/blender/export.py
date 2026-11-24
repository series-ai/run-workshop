"""Builds a voxel `Asset` into the Blender scene and exports a GLB, glTF +Y up,
with node-hierarchy clips. World assets get one `atlas` material: a painted
PNG at 1 texel per voxel, meshed by shape (see atlas.py). Avatar-space assets
get the `palette` material (256×1 PNG). Both: nearest + clamp, metallic 0,
roughness 1.

Axis mapping: glTF (x, y, z) == Blender (x, -z, y).
"""
from __future__ import annotations

import math

import bpy
import numpy as np
from mathutils import Euler, Matrix, Quaternion, Vector

import atlas
from mesher import greedy_mesh
from voxgrid import CATEGORIES, CLIPS, PALETTE, RIG, Asset, Part, palette_colors, units_per_voxel

# glTF → Blender basis change.
_B = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))
_B_INV = _B.inverted()


def gl_to_bl(v) -> Vector:
    return Vector((v[0], -v[2], v[1]))


def gl_euler_to_bl_quat(deg) -> Quaternion:
    """XYZ euler (degrees) about glTF axes → Blender quaternion."""
    m = Euler([math.radians(a) for a in deg], "XYZ").to_matrix()
    return (_B @ m @ _B_INV).to_quaternion()


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = CLIPS["fps"]
    scene.frame_start = 0


def palette_material(name: str = "palette") -> bpy.types.Material:
    image = bpy.data.images.new(name, width=256, height=1, alpha=False)
    pixels = []
    for hex_color in PALETTE["colors"]:
        pixels.extend([int(hex_color[i : i + 2], 16) / 255.0 for i in (1, 3, 5)] + [1.0])
    image.pixels.foreach_set(pixels)
    image.file_format = "PNG"
    image.pack()

    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 1.0
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = image
    tex.interpolation = "Closest"
    tex.extension = "EXTEND"
    mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def _image_material(name: str, rgb: np.ndarray) -> bpy.types.Material:
    """Material with a nearest-sampled PNG from an (h, w, 3) uint8 image, row 0 at the top."""
    h, w, _ = rgb.shape
    image = bpy.data.images.new(name, width=w, height=h, alpha=False)
    rgba = np.concatenate([rgb[::-1].astype(np.float32) / 255.0, np.ones((h, w, 1), np.float32)], axis=2)
    image.pixels.foreach_set(rgba.reshape(-1))
    image.file_format = "PNG"
    image.pack()
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 1.0
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = image
    tex.interpolation = "Closest"
    tex.extension = "EXTEND"
    mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def _hex_rgb(colors: list[str]) -> np.ndarray:
    return np.array([[int(c[i : i + 2], 16) for i in (1, 3, 5)] for c in colors], dtype=np.uint8)


def atlas_objects(asset: Asset) -> dict[str, bpy.types.Object]:
    """World assets: meshes by shape, one painted atlas for the whole asset."""
    meshes = {p.name: atlas.mesh_part(p.grid) for p in asset.root.walk() if p.grid is not None and p.grid.count() > 0}
    faces = [f for m in meshes.values() for f in m.faces]
    width, height = atlas.pack(faces)
    rgb = _hex_rgb(palette_colors(asset.pack))[atlas.atlas_image(faces, width, height)]
    material = _image_material("atlas", rgb)
    objects: dict[str, bpy.types.Object] = {}
    for part in asset.root.walk():
        mesh_data = meshes.get(part.name)
        if mesh_data is None:
            obj = bpy.data.objects.new(part.name, None)
        else:
            verts, polys, uvs = [], [], []
            pivot = np.array(part.pivot, dtype=float)
            for f in mesh_data.faces:
                start = len(verts)
                verts.extend(tuple(gl_to_bl(p - pivot)) for p in f.verts)
                polys.append(list(range(start, start + len(f.verts))))
                uv = atlas.face_uvs(f, width, height)
                uvs.extend((float(u), 1.0 - float(v)) for u, v in uv)
            mesh = bpy.data.meshes.new(part.name)
            mesh.from_pydata(verts, [], polys)
            layer = mesh.uv_layers.new(name="UVMap")
            layer.data.foreach_set("uv", [c for uv in uvs for c in uv])
            mesh.materials.append(material)
            mesh.validate()
            mesh.update()
            obj = bpy.data.objects.new(part.name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        objects[part.name] = obj
    return objects


def mesh_object(name: str, part: Part, unit: float, material) -> bpy.types.Object:
    if part.grid is None or part.grid.count() == 0:
        obj = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(obj)
        return obj
    pos, _nrm, uvs, quads = greedy_mesh(part.grid.a, pivot=part.pivot)
    verts = [tuple(gl_to_bl(p * unit)) for p in pos]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], quads.tolist())
    uv_layer = mesh.uv_layers.new(name="UVMap")
    uv_layer.data.foreach_set("uv", np.repeat(uvs, 1, axis=0).reshape(-1).tolist())
    mesh.materials.append(material)
    mesh.validate()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def is_world(asset: Asset) -> bool:
    return CATEGORIES["categories"][asset.category]["space"] == "world"


def build_parts(asset: Asset, material) -> dict[str, bpy.types.Object]:
    unit = units_per_voxel(asset.category)
    objects: dict[str, bpy.types.Object] = {}
    made = atlas_objects(asset) if material is None else None

    def visit(part: Part, parent) -> None:
        obj = made[part.name] if made is not None else mesh_object(part.name, part, unit, material)
        obj.rotation_mode = "QUATERNION"
        obj.rotation_quaternion = gl_euler_to_bl_quat(part.rot)
        obj.location = gl_to_bl([c * unit for c in part.at])
        if parent is not None:
            obj.parent = parent
        objects[part.name] = obj
        for child in part.children:
            visit(child, obj)

    visit(asset.root, None)
    return objects


def rest_position(asset: Asset, name: str) -> tuple[float, float, float]:
    """Pivot of part `name` in root pivot space (voxels), at rest."""
    def find(part: Part, acc):
        here = (acc[0] + part.at[0], acc[1] + part.at[1], acc[2] + part.at[2])
        if part.name == name:
            return here
        for child in part.children:
            hit = find(child, here)
            if hit:
                return hit
        return None

    hit = find(asset.root, (0.0, 0.0, 0.0))
    if hit is None:
        raise ValueError(f"{asset.id}: no part named {name!r}")
    root = asset.root.at
    return (hit[0] - root[0], hit[1] - root[1], hit[2] - root[2])


def build_sockets(asset: Asset, objects) -> None:
    unit = units_per_voxel(asset.category)
    for socket in asset.sockets:
        parent_name = socket.parent or asset.root.name
        base = rest_position(asset, parent_name)
        local = [socket.at[i] - base[i] for i in range(3)]
        empty = bpy.data.objects.new(socket.name, None)
        bpy.context.scene.collection.objects.link(empty)
        empty.parent = objects[parent_name]
        empty.rotation_mode = "QUATERNION"
        empty.location = gl_to_bl([c * unit for c in local])
        empty.rotation_quaternion = gl_euler_to_bl_quat(socket.rot)


def clip_frames(clip) -> tuple[int, int] | None:
    fps = CLIPS["fps"]
    frames = [round(t * fps) for chans in clip.keys.values() for keys in chans.values() for t, _ in keys]
    return (min(frames), max(frames)) if frames else None


def action_channels(action, with_owner: bool = False):
    """F-curves grouped by animated property, per slot: a quaternion's four
    curves form one channel. `with_owner` also yields the part each channel
    moves, (slot, bone path), as `(owner, curves)`."""
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                groups: dict[str, list] = {}
                for fc in bag.fcurves:
                    groups.setdefault(fc.data_path, []).append(fc)
                for path, curves in groups.items():
                    yield ((bag.slot.identifier, path.rpartition(".")[0]), curves) if with_owner else curves


def seamless_loop(action, first: int, last: int) -> None:
    """Make a looping clip run through its seam instead of easing to a stop.

    Blender's auto-clamped handles lie flat on an F-curve's first and last
    key, so every channel of a loop slows to rest at the seam and the clip
    reads as a reset. A channel that closes (same value at both ends) gets a
    Cycles modifier on its curves: their seam handles are then computed
    across the wrap, so the speed leaving the last frame is the speed
    entering the first. A channel that does not close (a whole-turn spin ends
    on −q) takes linear extrapolation, which keeps its end handles on the
    slope to the next key. A curve that spans less than the clip is held to
    both ends first."""
    action.use_frame_range = True
    action.frame_start, action.frame_end = first, last
    action.use_cyclic = True
    for curves in action_channels(action):
        for fc in curves:
            points = fc.keyframe_points
            for frame in (first, last):
                if not any(abs(k.co[0] - frame) < 1e-3 for k in points):
                    points.insert(frame, fc.evaluate(frame), options={"FAST"})
        closes = all(abs(fc.keyframe_points[0].co[1] - fc.keyframe_points[-1].co[1]) < 1e-4 for fc in curves)
        for fc in curves:
            if closes:
                fc.modifiers.new("CYCLES")
            else:
                fc.extrapolation = "LINEAR"
            fc.update()


def snap_impact(action, frame: int) -> None:
    """Make the key span that ends on the impact frame accelerate into it.

    Auto-clamped Bezier eases both ends of every span, so a strike or a fall
    slows down before it lands and reads soft. The span into the impact key
    keeps the speed it already has at its start (a fall carries on through
    its last key instead of restarting from rest) and arrives at twice its
    mean speed; the impact key's outgoing handle is flat, so the next span
    leaves the contact pose from rest (a hard stop)."""
    for curves in action_channels(action):
        for fc in curves:
            points = fc.keyframe_points
            for i in range(1, len(points)):
                key = points[i]
                if abs(key.co[0] - frame) >= 1e-3:
                    continue
                prev = points[i - 1]
                prev.interpolation = "BEZIER"
                dt = key.co[0] - prev.co[0]
                dv = key.co[1] - prev.co[1]
                key.handle_left_type = key.handle_right_type = "FREE"
                key.handle_left = (key.co[0] - dt / 3, key.co[1] - 2 * dv / 3)
                nxt = points[i + 1].co[0] - key.co[0] if i + 1 < len(points) else dt
                key.handle_right = (key.co[0] + nxt / 3, key.co[1])
            fc.update()


def _warp(u: float, k: float, hang_end: bool) -> float:
    """Stroke time warp: a blend of linear time and an ease, so motion lingers
    at the stroke's ends and runs faster through its middle. Without
    `hang_end` the stroke still leaves its start slowly but arrives fast (into
    an impact)."""
    ease = u * u * (3 - 2 * u) if hang_end else u * u
    return (1 - k) * u + k * ease


def _turning_points(frames, vals, loop: bool, closes: bool) -> set[int]:
    """Key frames where a channel reverses or holds (and a one-shot's ends)."""
    n = len(frames)
    out = set()
    for i in range(n):
        if closes and i in (0, n - 1):
            prev, nxt = vals[-2], vals[1]
        elif i in (0, n - 1):
            if not loop:
                out.add(frames[i])
            continue
        else:
            prev, nxt = vals[i - 1], vals[i + 1]
        d0 = [a - b for a, b in zip(vals[i], prev)]
        d1 = [a - b for a, b in zip(nxt, vals[i])]
        if sum(a * b for a, b in zip(d0, d1)) <= 1e-12:
            out.add(frames[i])
    return out


def ease_strokes(action, first: int, last: int, loop: bool, impact: int | None, amount: float) -> None:
    """Hang at the crests: re-time every stroke between two turning points.

    Bezier keys through a swing (rest, crest, rest, crest) move at nearly
    even speed: the crest barely lingers and the bottom of the swing is no
    faster than the rest, so pendulums, rocks and bobs read linear. Each
    channel is split into strokes at its turning points (the keys where it
    reverses or holds, plus a one-shot's first and last frame); in a one-shot
    a part's channels (an object, or a bone of a rig) share theirs, so its
    location and rotation stay in step. Each stroke is re-timed by `_warp`, then baked to one linear key a
    frame. A stroke into the impact frame keeps its speed at the end.
    Channels with no turning point (steady drifts) and rotations that travel
    a whole turn or more (wheels, rotors, winches) are left as they are; `amount` 0 (Clip(ease=0), for machines) skips the clip."""
    if amount <= 0 or last <= first:
        return
    period = last - first
    channels = []
    for owner, curves in action_channels(action, with_owner=True):
        frames = sorted({round(k.co[0]) for fc in curves for k in fc.keyframe_points if first <= round(k.co[0]) <= last})
        if len(frames) < 3:
            continue
        vals = [[fc.evaluate(f) for fc in curves] for f in frames]
        closes = loop and all(abs(a - b) < 1e-4 for a, b in zip(vals[0], vals[-1]))
        if closes:
            # A whole-turn spin can close too (its last quaternion key is stored
            # with the first one's sign); its last step then jumps. A loop
            # moves on smoothly through the seam.
            step = lambda i: sum((a - b) ** 2 for a, b in zip(vals[i + 1], vals[i])) ** 0.5  # noqa: E731
            closes = step(len(vals) - 2) <= 2 * max(step(i) for i in range(len(vals) - 2)) + 1e-6
        if loop and not closes:
            continue  # a whole-turn spin: steady by design
        if curves[0].data_path.endswith("rotation_quaternion") and len(curves) == 4:
            # Wheels, rotors and winches travel a turn or more: machines, left
            # as keyed (key spacing on a fast wheel also fakes turning points).
            travel = 0.0
            for q0, q1 in zip(vals, vals[1:]):
                dot = abs(sum(a * b for a, b in zip(q0, q1))) / max(1e-9, (sum(a * a for a in q0) * sum(b * b for b in q1)) ** 0.5)
                travel += 2 * math.degrees(math.acos(min(1.0, dot)))
            if travel >= 360:
                continue
        turning = _turning_points(frames, vals, loop, closes)
        channels.append((curves, closes, turning, owner))
    # A one-shot is keyed pose to pose: a part's channels share its beats, so
    # they share stroke bounds and stay in step. A loop's channels are often
    # waves out of phase; each keeps its own.
    by_owner: dict = {}
    for curves, closes, turning, owner in channels:
        by_owner.setdefault(owner, set()).update(turning)
    for curves, closes, turning, owner in channels:
        if closes and not turning:
            continue
        bounds = sorted(f for f in (turning if loop else by_owner[owner]) if not (closes and f == last))
        if len(bounds) < (1 if closes else 2):
            continue
        strokes = list(zip(bounds, bounds[1:]))
        if closes:
            strokes.append((bounds[-1], bounds[0] + period))
        wrap = (lambda x: x - period if x >= last else x) if closes else (lambda x: x)  # last ≡ first
        src = {}
        for a, b in strokes:
            for f in range(a, b + 1):
                # a stroke into the impact keeps snap_impact's shape: no hang at either end
                t = f if b == impact else a + _warp((f - a) / (b - a), amount, hang_end=True) * (b - a)
                src[wrap(f)] = wrap(t)
        baked = {f: [fc.evaluate(src.get(f, f)) for fc in curves] for f in range(first, last + 1)}
        if closes:
            baked[last] = baked[first]
        for j, fc in enumerate(curves):
            for m in list(fc.modifiers):
                fc.modifiers.remove(m)
            fc.keyframe_points.clear()
            fc.keyframe_points.add(len(baked))
            for k, (f, v) in zip(fc.keyframe_points, sorted(baked.items())):
                k.co = (f, v[j])
                k.interpolation = "LINEAR"
            fc.extrapolation = "CONSTANT"
            fc.update()


def _lowest_point(scene, meshes) -> float:
    """World-space height of the lowest vertex of `meshes` in the current frame."""
    deps = bpy.context.evaluated_depsgraph_get()
    low = math.inf
    for o in meshes:
        ev = o.evaluated_get(deps)
        mw = ev.matrix_world
        for v in ev.data.vertices:
            low = min(low, (mw @ v.co).z)
    return low


def keep_on_floor(asset: Asset, objects, action, first: int, last: int, impact: int | None = None) -> None:
    """Lift the root wherever a pose would sink into the floor (a death
    toppling about a centre pivot, an arm slamming down), so the model lands
    on the ground and stays there. A pose above the floor (a hop, a flyer)
    keeps its height. Only sinking is corrected, frame by frame, so key the
    landing and the resting pose at the floor: a keyed bounce then rises off
    it. (Holding a lift across frames floated impacts in mid-air.) One linear
    key a frame on the root's location."""
    scene = bpy.context.scene
    rest = {o: (o.location.copy(), o.rotation_quaternion.copy(), o.scale.copy()) for o in objects.values()}
    playing = []
    for obj in objects.values():
        anim = obj.animation_data
        if not anim:
            continue
        for track in anim.nla_tracks:
            for strip in track.strips:
                if strip.action == action:
                    anim.action = action
                    anim.action_slot = strip.action_slot
                    playing.append(obj)
    meshes = [o for o in scene.objects if o.type == "MESH" and not o.hide_render]
    floor = 0.0  # the ground plane: a clip that starts below it is lifted too
    tol = 0.01 * units_per_voxel(asset.category)
    root = objects[asset.root.name]
    lifts = {}
    for f in range(first, last + 1):
        scene.frame_set(f)
        lifts[f] = (root.location.copy(), max(0.0, floor - _lowest_point(scene, meshes)))
    if any(lift > tol for _, lift in lifts.values()):
        anim = root.animation_data or root.animation_data_create()
        if root not in playing:
            anim.action = action
        bag = None
        for layer in action.layers:
            for strip in layer.strips:
                bag = strip.channelbag(anim.action_slot, ensure=True) if anim.action_slot else None
        for f, (loc, lift) in lifts.items():
            root.location = loc + Vector((0.0, 0.0, lift))
            root.keyframe_insert("location", frame=f)
        if bag is not None:
            for fc in bag.fcurves:
                if fc.data_path == "location":
                    for k in fc.keyframe_points:
                        k.interpolation = "LINEAR"
        if root not in playing:
            slot = anim.action_slot
            track = anim.nla_tracks.new()
            track.name = action.name
            track.strips.new(action.name, 0, action).action_slot = slot
            track.mute = True
            playing.append(root)
    for obj in playing:
        obj.animation_data.action = None
    for o, (loc, rot, scale) in rest.items():
        o.location, o.rotation_quaternion, o.scale = loc, rot, scale
    scene.frame_set(0)


def clip_ease(clip) -> float:
    """A clip's stroke hang (see voxgrid.Clip.ease)."""
    return clip.ease if clip.ease is not None else (0.6 if clip.loop else 0.3)


def fill_spins(clip, fps: int) -> dict:
    """A looping clip's whole-turn spins run for the whole loop.

    A spin keyed over less time than its clip (a planet turning once in 8 s
    of a 16 s idle, wheels turning for 1 s of 2.4 s) stops and then restarts
    every loop. Each such channel is re-keyed over the clip with a whole
    number of turns as close to its keyed speed as possible (at least one).
    Other short channels (a lid that peeks, then rests) keep their pause."""
    frames = [round(t * fps) for chans in clip.keys.values() for keys in chans.values() for t, _ in keys]
    if not clip.loop or not frames:
        return clip.keys
    t0, t1 = min(frames) / fps, max(frames) / fps
    out = {}
    for part, chans in clip.keys.items():
        out[part] = dict(chans)
        keys = sorted(chans.get("rot", []), key=lambda k: k[0])
        if len(keys) < 2:
            continue
        span = keys[-1][0] - keys[0][0]
        moved = [i for i in range(3) if abs(keys[-1][1][i] - keys[0][1][i]) > 1e-6]
        if span <= 0 or span >= (t1 - t0) - 0.5 / fps or len(moved) != 1:
            continue
        axis = moved[0]
        total = keys[-1][1][axis] - keys[0][1][axis]
        steady = all((b[1][axis] - a[1][axis]) * total > 0 for a, b in zip(keys, keys[1:]))
        if not steady or abs(total) < 359 or abs(total / 360 - round(total / 360)) > 0.01:
            continue
        turns = max(1, round(abs(total) / 360 * (t1 - t0) / span)) * (1 if total > 0 else -1)
        steps = max(8, math.ceil(abs(turns) * 4))
        base = keys[0][1]
        out[part]["rot"] = [(t0 + (t1 - t0) * i / steps,
                             tuple(base[j] + (360 * turns * i / steps if j == axis else 0) for j in range(3)))
                            for i in range(steps + 1)]
    return out


def build_clips(asset: Asset, objects) -> None:
    unit = units_per_voxel(asset.category)
    fps = CLIPS["fps"]
    for clip in asset.clips:
        action = bpy.data.actions.new(clip.name)
        for part_name, channels in fill_spins(clip, fps).items():
            obj = objects[part_name]
            rest_loc = obj.location.copy()
            rest_rot = obj.rotation_quaternion.copy()
            rest_scale = obj.scale.copy()
            anim = obj.animation_data or obj.animation_data_create()
            anim.action = action
            for channel, keys in channels.items():
                prev = None
                for seconds, value in sorted(keys, key=lambda k: k[0]):
                    frame = round(seconds * fps)
                    if channel == "rot":
                        q = rest_rot @ gl_euler_to_bl_quat(value)
                        if prev is not None:
                            # A matrix gives q or −q at random past a half turn, and
                            # F-curves blend quaternions per component: a sign flip
                            # between keys turns the part back the short way.
                            q.make_compatible(prev)
                        prev = q
                        obj.rotation_quaternion = q
                        obj.keyframe_insert("rotation_quaternion", frame=frame)
                    elif channel == "loc":
                        obj.location = rest_loc + gl_to_bl([c * unit for c in value])
                        obj.keyframe_insert("location", frame=frame)
                    elif channel == "scale":
                        obj.scale = Vector((value[0], value[2], value[1]))
                        obj.keyframe_insert("scale", frame=frame)
                    else:
                        raise ValueError(f"{asset.id}: clip {clip.name!r} has unknown channel {channel!r}")
            slot = anim.action_slot
            track = anim.nla_tracks.new()
            track.name = clip.name
            strip = track.strips.new(clip.name, 0, action)
            strip.action_slot = slot
            track.mute = True  # keep the rest pose unevaluated at export; see export_glb
            anim.action = None
            obj.location, obj.rotation_quaternion, obj.scale = rest_loc, rest_rot, rest_scale
        span = clip_frames(clip)
        if clip.loop and span:
            seamless_loop(action, *span)
        impact = round(clip.impact * fps) if clip.impact is not None else None
        if impact is not None:
            snap_impact(action, impact)
        if span:
            ease_strokes(action, *span, clip.loop, impact, clip_ease(clip))
        floor = clip.floor if clip.floor is not None else asset.category == "creatures"
        if span and floor:
            keep_on_floor(asset, objects, action, *span, impact)


def export_glb(path: str, animated: bool) -> None:
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_apply=False,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_vertex_color="NONE",
        export_extras=False,
        export_cameras=False,
        export_lights=False,
        export_animations=animated,
        export_animation_mode="ACTIONS",
        export_merge_animation="ACTION",
        export_force_sampling=True,
        export_optimize_animation_size=True,
        export_skins=True,
        export_morph=False,
    )


def hand_r_inverse_bl() -> Quaternion:
    """Inverse rest rotation of the PN Hand.R joint, in Blender axes.

    Held items are authored upright in rig-world axes (the character faces
    +X, grip at the origin). Rotating the item root by this makes an identity
    parent to the Hand.R bone show the item as authored at rest."""
    m = next(j["worldMatrix"] for j in RIG["joints"] if j["name"] == "Hand.R")
    rot = Matrix(((m[0], m[4], m[8]), (m[1], m[5], m[9]), (m[2], m[6], m[10])))
    return (_B @ rot @ _B_INV).to_quaternion().inverted()


def center_on_base(asset: Asset, objects) -> None:
    """World assets sit on y = 0 and are centred on x/z by their full rest
    bounds, child parts included, so authors never place the pivot by hand.
    Moves the root before clips are keyed; steps are half voxels."""
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ v.co for o in objects.values() if o.type == "MESH" for v in o.data.vertices]
    if not pts:
        return
    lo = [min(p[i] for p in pts) for i in range(3)]
    hi = [max(p[i] for p in pts) for i in range(3)]
    root = objects[asset.root.name]
    shift = Vector((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]))
    root.location += Vector([round(c * 2) / 2 for c in shift])


def build_asset(asset: Asset, glb_path: str) -> None:
    asset.validate()
    reset_scene()
    # World assets: painted atlas (PN style). Avatar space: the shared palette.
    material = None if is_world(asset) else palette_material()
    objects = build_parts(asset, material)
    if asset.category == "held-items":
        if any(abs(c) > 1e-9 for c in asset.root.at):
            raise ValueError(f"{asset.id}: held item root must sit at the grip (at = 0)")
        objects[asset.root.name].rotation_quaternion = hand_r_inverse_bl()
    build_sockets(asset, objects)
    if is_world(asset) and CATEGORIES["categories"][asset.category]["origin"] == "base":
        center_on_base(asset, objects)
    build_clips(asset, objects)
    export_glb(glb_path, animated=bool(asset.clips))
