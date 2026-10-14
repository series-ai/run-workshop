# Boo Brigade: trailer script (draft 2)

Portrait 1080 × 1920, 30 fps, 46.3 s (27 bars), cut to 140 BPM so every shot
is a whole number of bars (one beat is 0.429 s, one bar is 1.714 s). Everything
on screen is the real GLBs and clips playing in a small three.js scene
(`promo/index.html`, built from the previewer's street, house builder and kid
loaders), so it reads as gameplay capture. The kids get a soft toon look that reads at
dusk but sits in the mood of the scene: a five-step toon ramp with no pure-white step, a
warm lamp-coloured light from the camera, a small cool blue-purple self-light and a cool
grade on the kids only, moodier on the street than in the close-ups (the street keeps its
dusk sky, lamps and shadows;
`?look=fill` and `?look=plain` show the alternatives). Title text and captions are
drawn into the frame in Creepster (Font Diner, SIL OFL 1.1, `promo/fonts/`): acid
green and purple letters with orange numbers, a heavy black outline, a dark
extrusion and a neon glow, popping in one at a time. The knocks, door creak, candy,
pops, ticks, face blips, part snaps, the ghost's "booo" and cackle and the cheer are
a synthesized track (`promo/sfx.py`), every one placed exactly on the beat grid, over
a synthesized high-energy spooky track (`promo/music.py`: 140 BPM in D minor, Dm Bb
Gm A; four-on-the-floor kick, snare on 2 and 4, sixteenth hats, a harpsichord riff
in sixteenths doubled by pizzicato, a pulsing eighth-note bass, a church organ bed and
stabs, a gliding theremin melody, ghostly "ooo" choir swells, a tolling bell, thunder
on the title and a wolf howl over the street).

## Name

**Boo Brigade**. Packs of costume kids marching house to house for candy.

## Shots

| Time | Bars | Shot | Action | On screen |
|---|---|---|---|---|
| 0–3.43 s | 2 (bars 1–2) | Knock knock | Close on a glowing Victorian door at dusk. A tiny witch climbs the steps, knocks twice on the beat (beats 5 and 6, the door glow pulses with each), the door creaks, she holds up her bucket with a grin | none |
| 3.43–6.86 s | 2 (3–4) | Title | Flash cut and thunder. The door glows brighter; the pack (witch, superhero, pumpkin clown, cupcake, T-rex) stands at the foot of the steps, backs to camera, spins round to camera, grinning, and cheers | **BOO BRIGADE** pops in letter by letter on 32nd notes · *trick-or-treat costume kids* |
| 6.86–13.71 s | 4 (5–8) | Roll call | A costume every two beats: each kid hops in from the right and lands on the beat, strikes a pose and holds it a beat, then slides off as the next lands: T-rex, vending machine, Marie Antoinette, octopus, taco, mummy, rocket, unicorn | **96 COSTUMES** · the costume's name |
| 13.71–17.14 s | 2 (9–10) | Any kid | The baker through all six skin tones, one a beat, a swatch row under him; on beat 7 a 2 × 3 grid of six kids, one tone each | **ANY SKIN TONE** |
| 17.14–20.57 s | 2 (11–12) | Faces | Tight on the sports player's face on a held pose: smile, ooh, grin, grr, eek, dizzy, hee hee, sulk, a blip per swap | **EXPRESSIONS** · the face's name |
| 20.57–25.71 s | 3 (13–15) | Moves | Two-beat bursts in a 2 × 2 grid (Dracula, cupcake, superhero, unicorn), every cell a different clip each burst, so all 22 clips appear | **22 ANIMATIONS** · the clip under each cell |
| 25.71–29.14 s | 2 (16–17) | Boo! | The street. A princess ambles along the sidewalk and stops by a dark fence; the music drops to a heartbeat and a riser. On the downbeat of the second bar a kid in the ghost costume pops up over the fence, she jumps in fright; two beats later the ghost cackles | **BOO!** |
| 29.14–34.29 s | 3 (18–20) | Build a house | The house parts kit, live: a part group falls and hits exactly on each beat with a tuned snap up the chord (walls, steep roof, gingerbread, porch, rails, turret, wing, trimmings); a kid hops onto the porch on the and of beat 4; then the colours flick through four palettes, one a beat | **MIX & MATCH HOUSES** · the part or palette name |
| 34.29–39.43 s | 3 (21–23) | On patrol | The last house on the street at dusk, a slow crane down: one kid climbs the steps, knocks twice and trick-or-treats while two queue down the path, a pack walks the sidewalk toward us, another cluster at the next door; a wolf howls | **PROPS · CARS · CANDY** |
| 39.43–42.86 s | 2 (24–25) | The brigade | Fifty kids staged across the street, spaced so each one reads: a line walking the far sidewalk (inside the lamps), two lines running the road clear of the parked cars, a line on the near sidewalk, clusters of three at three doors. The camera cranes up and back | **BUILT FOR MOBILE** · *2 draw calls a kid · 50 at once* |
| 42.86–46.29 s | 2 (26–27) | End card | Everyone stops, turns to the camera and cheers and waves; on the last sting (bar 27) they all jump | **BOO BRIGADE** · 96 kids · houses · cars · props · animated glTF / GLB |

## Music cues (bar numbers count from 1)

The page writes the bar each shot starts on into `events.json`, and `music.py` arranges to that.

- Bars 1–2: a ticking clock, a midnight bell, the riff soft over a low organ pedal; the knocks, the creak and the candy are sfx.
- Bar 3: the title. Thunder, bell, crash, a full organ chord, the theremin swoop; the drums, pizzicato, bass and church organ drop in.
- A tom fill into every new shot.
- Bars 5–8, 13–15, 21–25: the theremin melody (two four-bar phrases, gliding between notes).
- Bars 9–12 and 21–23: ghostly "ooo" choir swells. Bar 21: a wolf howl.
- Bar 16: the Boo! set-up. Drums and bass out: a heartbeat kick, ticking hats, a riser, a diminished organ chord and choir.
- Bar 17: BOO! Crash, bell and organ on the downbeat, a falling theremin, the groove back in; the ghost cackles on beat 3.
- Bars 18–20: the riff steps back so the part snaps (tuned up the chord, D F Bb D / G Bb D G) carry the tune; the palette swaps on beats 9–12.
- Bar 26: the end card. Crash, bell, organ, theremin.
- Bar 27: the sting. A held D minor chord on the full organ, kick, crash and a low bell on the downbeat, then it rings out.

## Notes

- Kids at street scale (0.4) for the street shots and the house builder; full size for the roll call, skin tones, faces and moves.
- Every street shot is staged (positions are a function of time, each kid on its own lane, spaced by its footprint), not the previewer's wandering sim, so nobody walks through anybody. `?check=1` steps the whole trailer and tests every on-screen kid's footprint against every other kid and the solid props (cars, lamp posts, hydrants, mailboxes, jack-o'-lanterns, trees...); it reports none.
- `?events=1` writes just the sound cues (`out/still-events.jpg`, JSON despite the name) for checking the beat grid.
- Buckets on throughout (it's the trick-or-treat pack).
- The house builder shot uses the parts kit live (`previewer/house-parts/`), so it shows the real assembly.
- Skin tones recolour the SKIN material. The plain base kids (`kid-*`) now have their skin in SKIN too (re-exported), as the costume kids do; `pirate-ghost` has no SKIN by design (a ghost). The skin shot uses six costume kids.
- The street layout mirrors `previewer/street.js` (lamps on the kerb edge at z 15.8, hydrants and the sign at z 15.55, kids' lanes inside 14.3, cars between the lamps); the one change is the beetle, nudged from X0 + 136 to X0 + 128 so it sits in the patrol shot without hiding the kids.

## Make it

```
cd tools/run-costume-kids
python3 promo/server.py 8798            # serves the folder; saves recorded frames
open http://127.0.0.1:8798/promo/       # watch it live (loops)
OUT=promo/out/trailer.mp4 promo/render.sh   # frames headless, then music + sfx, then the mp4
promo/still.sh sheet 1,4,8,13           # a contact sheet of moments (needs the server)
promo/still.sh at 25.8                  # one full-size still
promo/still.sh check 1                  # the clip check (out/still-check.jpg holds the JSON report)
```

`PORT=` picks another port for all three if 8798 is taken.
