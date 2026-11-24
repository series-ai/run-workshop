# Wasteland Wheels: source

The procedural source for **Wasteland Wheels**, the RUN library's mix-and-match wasteland
vehicle kit (`run-wasteland-wheels/3D/vehicles-racing` in jam-ready-assets). It's built in
Blender on the voxel-pack pipeline (`tools/run-voxel-packs/blender`): chunky toy shapes with
pixel-painted grunge.

The kit:
- **Bodies:** buses, an ice-cream van, muscle cars, a hearse, an armchair, an 18-wheeler and more.
- **Wheel modules:** monster, tractor, wire, spiked, slicks, treads and more, picked per axle.
  The body tips when the front and rear wheels differ.
- **Bolt-ons:** roof, hood, stacks and bumpers.
- **Trailers:** they hitch in chains.
- **Ready-made vehicles:** each has four clips: idle, move, accelerate and brake.

| Path | What |
|---|---|
| `kit/build.py` | Blender entry: builds the whole kit to GLBs plus `kit.json` |
| `kit/bodies.py`, `more_bodies*.py`, `bikes.py`, `trailers.py` | bodies and trailers |
| `kit/modules.py`, `gear.py` | wheel and axle modules |
| `kit/accessories.py` | bolt-ons |
| `kit/clips.py` | the four vehicle clips (spring-damper bounce on starts and stops) |
| `kit/render.py`, `preview.py`, `islands.py` | review renders, loadout previews, floating-part lint |
| `kit/raiders.py` | work in progress: wasteland driver characters (not in the published pack yet) |
| `viewer/` | mix-and-match editor and figure-8 race (`python3 viewer/serve.py`) |
| `pack/pack.mjs` | packages a build into the library leaf, with `wheelskit.js` and the catalogue built in |
| `pack/shots.mjs`, `shots.html` | cover and gallery renders (Playwright) |

## Build

Run from this folder.

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -t 1 --factory-startup --python kit/build.py -- --out out/glb-fresh
node pack/pack.mjs out/glb-fresh <jam-ready-assets>/run-wasteland-wheels/3D/vehicles-racing
```

Vehicles face -Z. Concept art, references and build output stay local (see `.gitignore`).
The cover fonts in `pack/fonts/` are SIL OFL (licences alongside).
