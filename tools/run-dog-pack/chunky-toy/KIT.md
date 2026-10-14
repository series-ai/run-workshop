# Chonky Hounds: Doggo Dynasties

![Chonky Hounds: Doggo Dynasties](cover.webp)

30 chunky toy dogs on one shared rig, 40+ shared animations, 223 colourways driven by a
recolour shader, markings ("genes"), breeding, collars and bandanas, and 41 props.
Optimised for phones: compressed textures and geometry, about 2 draw calls per dog.

## What's in the box

| Path | What |
|---|---|
| `rigged/<breed>.glb` | the 30 dogs: ~1,470 triangles, skinned to the shared skeleton, ~75 KB each |
| `rigged/clips.glb` | every animation, once, for every dog (~450 KB) |
| `rigged/coats/` | per-breed coat masks (KTX2), and `coats.json`: layers, colourway palettes |
| `rigged/wear/` | a collar and a bandana fitted to each dog (wear one at a time: they share the neck); `cloth.ktx2` / `cloth.png` bandana patterns |
| `props/models/` | beds, toys and care items (basic / standard / premium) |
| `dogclips.js` | playback: `loadClipLibrary`, `setupDog`, `attachWear` |
| `dogcoat.js` | coats: `loadCoats`, colourways, markings, face colours, `breed()`, `makeLite`, cloth tints |
| `breeds.csv` | slug, breed, size class (toy / small / medium / large) |
| `example.html` | the smallest working scene |
| `cover.webp`, `preview.webp` | the pack cover (1024 px) and its 512 px catalogue thumbnail |

Everything is glTF 2.0 / GLB. Textures are KTX2 (Basis), geometry is meshopt-compressed
and quantised, so load with three's `KTX2Loader` and `MeshoptDecoder` (see `example.html`).

## Use it (three.js)

```js
const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
const lib = await loadClipLibrary(loader, 'rigged/clips.glb');
const coats = await loadCoats('coats.json', 'rigged/coats/', { ktx2Loader: ktx2 });

const scene = (await loader.loadAsync('rigged/beagle.glb')).scene;
const dog = setupDog(scene, lib);
const coat = await coats.apply(scene, 'beagle', { lite: true });   // lite: cheap phone lighting
coat.set(coats.palette('beagle', 'lemon-white'));                 // a colourway
coat.set({ ...pal, marks: { sock_fl: ['#eeedea', 0.2] } });       // markings
coat.setFace({ eye_l: '#3f78c4', nose: '#58301f' });               // eyes, nose, mouth, tongue
dog.play('trot'); dog.setSpeed(1.2, scale);                        // feet stay planted
// each frame: dog.update(dt)

// a collar or a bandana (one at a time), bound to the dog's own skeleton
const cloth = await loadClothPatterns('rigged/wear/cloth.ktx2', { ktx2Loader: ktx2 });
const bandana = (await loader.loadAsync('rigged/wear/beagle--bandana.glb')).scene;
for (const m of attachWear(scene, bandana))
  if (m.material.name === 'bandana') tintCloth(m.material, cloth, '#b8322a', '#f6f0e4', 'dots');   // dots, gingham, stripes, plain
```

Puppies: scale the dog's root (0.45 is a puppy, sizes grow to toy 0.45, small 0.65,
medium 0.85, large 1.1); proportions never change. Breeding: `breed(palA, palB)` mixes two
palettes of the same breed into a puppy palette.

## Animations

Gaits (walk, trot, run, gallop, robot), play (play bow, catch, drop ball, stretch, bark,
rapid bark, sniff, point, idle), potty, poses with get-in / loop / get-out (sit, down, comfy,
sploot, sit pretty, dance, play dead) and tricks (paw, roll over, leaping spin). Clip
metadata (`lib.meta`) gives each clip's start and end state, events (bark, catch, pee...)
and gait stride.

## Performance (measured)

| | 30 dogs | 90 dogs |
|---|---|---|
| draw calls | 52 | 155 |
| triangles | 39k | 116k |
| animation CPU / frame (desktop) | 0.46 ms | 1.5 ms |
| shader programs | 2 (one for every breed) | 2 |
| GPU texture memory (all 30 breeds) | 10 MB | 10 MB |

On a low-end Android phone (Mali-G52 / Adreno 610 class), expect roughly 25-40 dogs at
30 fps with `lite` materials; a handful of dogs is comfortable at 60. Tips: animate
off-screen and distant dogs at a lower rate, cap the pixel ratio at about 1.5, skip shadows.
