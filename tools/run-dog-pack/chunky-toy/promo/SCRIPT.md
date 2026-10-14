# Trailer: Chonky Hounds: Doggo Dynasties

Portrait 1080 × 1920, 30 fps, 54 s (27 bars at 120 BPM). An over-the-top movie-trailer
parody. Everything on screen is the real rigged dogs, clips, coats, wearables and props in
a three.js backyard (`promo/index.html`).

**Rules for this pack:** the dogs look best from three-quarters above, in crowds. Never
frame a dog bigger than the two-parents medium shot (`orbit()` keeps the camera up and
back). Show lots of dogs doing things at once; joke, don't explain.

**Sound:** `promo/music.py` follows the cut (each shot lists what its bars are): a dusk
drone with BRAAMs, a record scratch into a marching oompah theme (tuba, snare, pizzicato,
brass, glockenspiel), a sad trombone for the play-dead joke, a shameless key change, a soft
bit for the puppies and a brass finale. `promo/sfx.py` adds woofs, yips, the slam, squeaks,
zips and the chime from cues the page records (`MIX` sets their levels).

## Shots

| Bars | Time | Shot | On screen |
|---|---|---|---|
| 2 | 0–4 | Black card, then the whole pack at dusk, BRAAM. The opening is one continuous camera move over one crowd | IN A WORLD... · ...OF CHONK. |
| 1 | 4–6 | Same crowd, BRAAM | THIRTY GOOD BOYS. |
| 1 | 6–8 | All thirty spin together on the hit, BRAAM | ONE RIG. |
| 1 | 8–10 | Record scratch: the light comes up, everybody play-bows | **CHONKY HOUNDS** · DOGGO DYNASTIES |
| 2 | 10–14 | The dognado: four rings nose to tail, alternating directions (toys robot, small dogs trot, mediums run, big dogs gallop) | THEY TROT. · THEY RUN. · THEY GALLOP. · THEY... ROBOT? (one every two beats) |
| 2 | 14–18 | A Jack Russell lifts a leg on the hydrant; a queue waits behind (tiptoe pizzicato) | THEY STAY HYDRATED. · (there's a queue.) |
| 2 | 18–22 | Fifteen dogs do tricks at once; one sploots instead | THEY DO TRICKS. · (most of them.) |
| 2 | 22–26 | Fourteen dogs play dead on the same beat; sad trombone | BANG. · (they're fine.) |
| 2 | 26–30 | Five puppies walk forward and grow up; the Chihuahua doesn't | THEY GROW UP SO FAST. · (mostly.) |
| 3 | 30–36 | Eighteen dogs re-roll their coats on every beat; the last bar is bred coats | 223 COATS. · (yes, we counted.) · …or make your own |
| 4 | 36–44 | The breeding pitch: German Shepherd MOM (brown eyes, black nose) and red Husky DAD (copper and white, blue eyes, liver nose). Five pups trot in with mom's shape and dad's colours; their genes re-roll on the beat (marks, saddle, eyes, noses); then they spin | MOM'S SHAPE. · DAD'S COLORS. · SOCKS. SPOTS. SPLOTCHES. · eyes and noses from both · BREED 'EM. · every pup's a one-off |
| 1 | 44–46 | Eight dogs, collars and bandanas swapping on the beat | ACCESSORIZE. |
| 1 | 46–48 | Beds in two rows from a towel to a teepee; a Pug on the towel, a Pom on the sofa | BEDS. FANCY ONES. · (and a towel.) |
| 3 | 48–54 | The dognado again under the title; final BRAAM and a squeak | **CHONKY HOUNDS** · DOGGO DYNASTIES · COMING SOON TO A GAME NEAR YOU |

The score leads into every change (a riser out of the dusk, snare fills and a crash into
the band, a glockenspiel into the soft bits), so no cut just stops.

## Make it

```
cd tools/run-dog-pack/chunky-toy
python3 promo/server.py 8795
open http://127.0.0.1:8795/promo/       # live (loops); ?at=12 jumps; ?sheet=1,5,9 contact sheet
OUT=promo/out/trailer.mp4 promo/render.sh
```
