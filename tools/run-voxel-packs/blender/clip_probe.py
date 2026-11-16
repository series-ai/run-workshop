"""Dev tool: per-frame numbers for one clip of a GLB, to judge contact, weight and snap.

    Blender -b --factory-startup --python blender/clip_probe.py -- a.glb clip [--parts]

Prints one line per frame, in model units (voxels for creatures; Blender Z is up, +Y is the
model's front, so a fall backwards moves the centre toward −Y):

    f  low  high  cx cy cz  speed      [part=low ...]

- low/high: the lowest and highest vertex. low ≈ 0 is on the floor; low > 0 on every vertex is
  airborne; low < 0 is sinking.
- cx cy cz: the mean vertex position (a stand-in for the body centre). A run of frames where it
  barely moves is a hold (fine) or a dead hang (not fine, if nothing else moves either).
- speed: the mean vertex movement since the previous frame. A strike or a fall should peak AT
  its contact frame; a hit should be fastest on frames 0–2.
- --parts adds each part's lowest point, to find what props a body up or digs into the floor.

The last line is the snap score (see the procedural-animation skill): contrast = the 90th
percentile speed / the median speed (sine motion is about 1.5; pose-to-pose action is 3 or more)
and hold = the share of frames under 30% of the peak speed (actions want 35% or more).
Parts the clip doesn't key stay at rest, not in the importer's last clip.
"""
from __future__ import annotations

import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
path, clip = argv[0], argv[1]
show_parts = "--parts" in argv

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
bpy.ops.import_scene.gltf(filepath=path)
action = bpy.data.actions.get(clip)
if action is None:
    raise SystemExit(f"no clip {clip!r}; clips: {[a.name for a in bpy.data.actions]}")
for obj in scene.objects:
    ad = obj.animation_data
    if not ad:
        continue
    ad.action = None
    for track in ad.nla_tracks:
        for strip in track.strips:
            if strip.action == action:
                ad.action = action
                ad.action_slot = strip.action_slot
        track.mute = True

meshes = [o for o in scene.objects if o.type == "MESH" and not o.hide_render]
first, last = round(action.frame_range[0]), round(action.frame_range[1])
prev = None
speeds = []
for f in range(first, last + 1):
    scene.frame_set(f)
    deps = bpy.context.evaluated_depsgraph_get()
    pts, parts = [], {}
    for o in meshes:
        ev = o.evaluated_get(deps)
        mw = ev.matrix_world
        vs = [mw @ v.co for v in ev.data.vertices]
        pts.extend(vs)
        if vs:
            parts[o.name] = min(v.z for v in vs)
    n = len(pts)
    lo, hi = min(p.z for p in pts), max(p.z for p in pts)
    c = sum((p for p in pts), pts[0] * 0) / n
    speed = 0.0 if prev is None else sum((a - b).length for a, b in zip(pts, prev)) / n
    if prev is not None:
        speeds.append(speed)
    prev = pts
    line = f"{f:3d} low {lo:6.2f} high {hi:6.2f}  c {c.x:6.2f} {c.y:6.2f} {c.z:6.2f}  speed {speed:5.2f}"
    if show_parts:
        line += "  " + " ".join(f"{k}={v:.2f}" for k, v in sorted(parts.items()))
    print(line)
if speeds:
    s = sorted(speeds)
    median = s[len(s) // 2] or 1e-6
    p90 = s[min(len(s) - 1, int(len(s) * 0.9))]
    peak = s[-1] or 1e-6
    hold = sum(1 for x in speeds if x < 0.3 * peak) / len(speeds)
    print(f"SNAP contrast {p90 / median:.1f} hold {hold:.0%} peak {peak:.2f} at f{first + 1 + speeds.index(peak)}")
