# Bean Squad (run-bean-people)

Tall, boxy art-toy beans: a procedural Blender kit (no mesh generators), rigged with 70 clips, a
mix-and-match kit and 12 toy weapons. Ships to the asset library as `run-bean-squad/3D/characters`.

- `kit/boxykit.py` (on `beankit*.py`): the static kit parts.
- `kit/rig/`: rig, clips, weapons and checks; see [kit/rigged/README.md](kit/rigged/README.md).
- `kit/anim-viewer/`: the three.js viewer (serve `kit/`, open `anim-viewer/`).
- `kit/pack/`: the library leaf's Readme, License, the `beankit.js` helper source, and the cover/gallery page.

Build and package:

```sh
cd kit && npm install
B=/Applications/Blender.app/Contents/MacOS/Blender
$B -b --factory-startup --python boxykit.py -- rigged manifest          # kit.json
$B -b --factory-startup --python rig/beanrig.py -- rigged anim           # base.glb + all clips
$B -b --factory-startup --python rig/beanrig.py -- rigged parts          # every part and weapon
node scripts/compress.mjs mobile && node scripts/compress.mjs --verify mobile
node scripts/pack.mjs <jam-ready-assets>/run-bean-squad/3D/characters   # the library leaf
node scripts/pack.mjs pack-out && node pack/shots.mjs <dir>              # cover + gallery (serve tools/ on :5240)
```

Concept art, references and exploration builds stay local (see `.gitignore`).
