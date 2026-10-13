# Promo: script (draft)

Portrait 1080 × 1920, 30 fps, 44 s, cut to 120 BPM (every shot is a whole number of bars). Everything on screen is the real
GLBs and clips, played in a small three.js "game" scene (`promo/index.html`),
so it reads as gameplay capture. Title text, captions and a fake game HUD are
drawn into the frame; the clacks, boings and clicks are a synthesized track
timed to the action (`promo/sfx.py`), over a synthesized swing combo in F
(`promo/music.py`: walking bass, electric piano, brushes, vibes). Text is
candy-coloured balloon letters in Titan One that pop in one at a time.

## Name

Working title: **Critter Cubes** (change it with `?title=` on the page, or
`TITLE=` in `render.sh`).

Other options: Roll Call · Paws & Pips (pips are the dots on dice) ·
Tumble Tails · Dice Mice · Cubeasts.

## Shots

| Time | Shot | Action | On screen |
|---|---|---|---|
| 0–4 s | The throw | Six dice animals are thrown onto a board of grass cubes and tumble at the camera: a rumble and a clack on every face; scared faces mid-roll, X eyes on impact, then they settle and look up | none |
| 4–6 s | Title | Flash cut; they bounce, excited | **CRITTER CUBES** pops in letter by letter · stackable dice animals |
| 6–10 s | Meet the herd | Push over fifteen animals, each in a different loop | 47 ANIMALS |
| 10–12 s | Scared | The sheep tips onto an edge, sweating | SCARED |
| 12–14 s | Squished | A die drops on the pig: X eyes | SQUISHED |
| 14–16 s | Dizzy | The cat spins down off its corner | DIZZY |
| 16–18 s | Boop | A cartoon finger pokes the sheep, pig and chick on the beat: each squishes, then beams | BOOP! BOOP! BOOP! |
| 18–24 s | Puzzles | HUD level. The sheep hops onto the button, the gate sinks, the cow rolls through onto the goal flag | LEVEL 3 ★★☆ · MOVES · PUZZLES! · GOAL! |
| 24–28 s | More pieces | Conveyor, fan, spring, portal, ramp | |
| 28–32 s | Stack 'em | Four animals drop onto a tower on the beats; the chick on top teeters | STACK 'EM! |
| 32–38 s | Dance party | Nine animals hop on the beat, then pop onto a corner and spin; confetti | 25 MOVES · in every animal |
| 38–44 s | End card | The dancers settle, a happy punch-in on the last sting | **CRITTER CUBES** · 47 animals · dice · terrain · puzzle pieces · animated glTF / GLB |

## Make it

```
cd tools/run-dice-animals
python3 promo/server.py 8796            # serves the folder; saves recorded frames
open http://127.0.0.1:8796/promo/       # watch it live (loops)
TITLE="CRITTER CUBES" OUT=promo/out/promo.mp4 promo/render.sh   # frames headless, then music + sfx, then the mp4
```
