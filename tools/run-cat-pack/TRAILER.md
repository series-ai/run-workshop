# Facet Fauna: Cats — trailer

The cat half of the *Facet Fauna* series. It uses the same format as the dog trailer
(`tools/run-dog-pack/TRAILER.md`): crowd patterns, small animals, and glass UI. It has
cat gags of its own.

**Format:**
- Portrait 1080 × 1920 at 30 fps, about 48 s.
- Cut to music at 120 BPM.
- Built from the real kit in a three.js scene: `kit/catkit.js`, the same parts, clips
  and recolours a game gets.
- Cats are drawn 1.5× size so the crowd spacing reads like the dog trailer's.

**Look:**
- Soft mint floor and sky (the dogs had lavender).
- Glass cards and Inter type, like the dogs.
- Accent colours taken from the coats: ginger, sage, laser red, tape tan, night violet.

## Shots

| Time | Pattern | Glass UI / gag |
|---|---|---|
| 0–5 s | Stripes: rows stream in from both sides, alternating direction | wordmark **FACET FAUNA · CATS** |
| 5–9 s | Roll call: rows of breeds sorted small to big | **83** breeds |
| 9–13 s | Waves: columns snake toward the camera | 6 body types |
| 13–17 s | Mix & match: one ginger trots while ears, tails, coat and face swap on the beat; lanes stream behind | 6 · 6 · 7 · 7 |
| 17–21 s | Coat genetics: a grid of sitting cats repainted every beat (tabbies, tortie, calico, points, tuxedo, smoke, rosettes) | coat genetics |
| 21–25 s | **Laser:** rings of cats around an empty middle turn to follow a darting red dot, wiggle, and all pounce at once; the dot is gone | LASER? … IT'S GONE |
| 25–30 s | **If I fits, I sits:** the crowd runs into a grid of tape squares and loafs in them; a Maine Coon takes the smallest square | 37 animations |
| 30–36 s | Tricks grid: every cat a different clip, switching every bar | ONE CLIP · EVERY BREED |
| 36–40 s | **3 AM:** the lights go down and rings of cats sprint in opposite directions | 3:00 AM |
| 40–48 s | Finale: dark cats run into formation and spell **CATS**; a ginger strolls in last, sits and grooms | "on cat time", stats |

## Making it

`promo/` is the dog trailer's engine, copied:
- shot list, crowd paths, letter formation and glass cards;
- frame-by-frame capture (`server.py`);
- encoding (`render.sh`);
- synthesized music (`music.py`, moved to a jazzier Dmaj7–Bm7–Gmaj7–A loop);
- sound effects (`sfx.py`, adding a chirp, a laser blip, a pounce thump and a synthesized meow).

**catkit hooks it uses:** `cat.recolour()` for the coat shot and the dark finale cats, and
`cat.clip()` / `cat.looping` for per-frame clip control.

**Render:** run `promo/render.sh` from `tools/run-cat-pack` (about 10 minutes, one render
at a time). It writes `promo/out/trailer.mp4`.

**Release:** run `promo/release.sh` after a render. It writes `promo/release/`:
- `facet-fauna-cats-trailer.mp4`, about 22 MB, H.264 with fast start and the cover embedded as its thumbnail;
- `facet-fauna-cats-trailer-cover.jpg`, the title over the crowd at 4.5 s, 1080 × 1920;
- `facet-fauna-cats-trailer-cover-square.jpg`, a 1080 × 1080 crop centred on the wordmark.

These are committed (through LFS), unlike the working frames in `promo/frames/` and `promo/out/`.

**Check one moment:** open `promo/?at=<seconds>` in a real browser. Headless Chrome is too
slow for the later shots.
