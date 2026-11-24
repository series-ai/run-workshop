# Bolt-On Racers: asset list and snap spec

These are the concept-stage assets, built procedurally in `concepts/` (`rk.py` for the core, chassis and wheels, `bodies.py`, `parts.py`, `track.py`, and `racers.py` for the assembler and boards). Every vehicle on every board is assembled by `vehicle()` purely through the snap points below.

Conventions: z is up, the ground is at z = 0, and vehicles face -y. **L = driver's left = +x**, which is the side the board camera sees.

## Size classes

| Class | Deck L x W | Shell scale (x, y, z) | Bolt-on scale | Chassis |
|---|---|---|---|---|
| S | 0.98 x 0.58 | 0.88, 0.82, 0.88 | 0.86 | kart, hatchback, bike, trike, hover sled |
| M | 1.20 x 0.66 | 1, 1, 1 | 1.0 | buggy, coupe, monster truck |
| L | 1.44 x 0.78 | 1.18, 1.2, 1.12 | 1.15 | pickup, van, tank tread base |

Body shells are authored once at M size (deck y -0.6..0.6, x -0.33..0.33, standing on z = 0) and scaled to the class deck. Every shell therefore fits every chassis except the bike. Bolt-ons scale uniformly with the class. The driver is one fixed size and fits every seat.

## Snap points

### Chassis (`chassis_snaps(name)`, chassis space)
| Snap | Position | Notes |
|---|---|---|
| `wheel_FL / FR / RL / RR` | (±(W/2+0.02), ∓wheelbase/2, r) | On the **hub flange**. Wheels build outward from it, so any width fits without clipping. |
| `wheel_F / wheel_R` | (0, ∓wb/2, r) | Bike (wheels centred) |
| `wheel_F, wheel_RL, wheel_RR` | | Trike |
| `body` | (0, 0, deck) | Shell origin |
| `seat` | on deck | Used when bare. A shell supplies its own seat. |
| `front, rear, tail, exhaust_L/R, side_L/R, hood, roof, mast` | on the deck plate | Bare-chassis fallbacks (bike and kart use these) |

**Wheel lift:** each movement part has a radius factor (monster 1.65, knobbly 1.06, stubby 0.8, others 1.0). The whole vehicle is raised or lowered by `r_eff - r`, so it always sits on z = 0. Treads replace a whole side (FL to RL). Hover pads, skis and thrusters mount on the same wheel snaps.

### Body shell (returned by each shell builder, M units, then scaled)
| Snap | Outward dir | Takes |
|---|---|---|
| `front` | -y | bumpers ×4, shield |
| `rear` | +z (top rear edge) | spoilers ×5 |
| `tail` | +y | boosters ×3 |
| `exhaust_L`, `exhaust_R` | +y (R mirrored) | exhausts ×4 (always a pair) |
| `side_L`, `side_R` | ±x (R mirrored) | side cannons (pair) |
| `roof` | +z | roof rack, siren, light bar |
| `hood` | +z | hood scoop |
| `mast` | +z (rear left corner) | antenna + flag |
| `seat` | (hip point) | driver |
| `open` (flag) | | true means the driver is visible (open cockpit) |

On open shells, `roof` sits on a roll hoop or frame: the race car hoop, jeep roll bar, tractor ROPS and bathtub shower riser.

### Decals
Decals are thin coloured slabs placed by ray casting, so they work on any shell:
- **Side decals** (number roundel, flames, side stripe, checker band) cast from just outside the shell, inside the wheel flanges, toward the shell.
- **Racing stripes** cast down and drape over the top. They skip glass.

### Damage overlays (any shell)
- **Stage 1 (dented):** crumpled panel shards with a sticking plaster, a bent front bolt-on, a cambered FL wheel and a wisp of smoke.
- **Stage 2 (wreck):** the FL wheel is off and the car tips about the FR-RL axis. Paint goes 40% toward charcoal, the hood is popped, there is a scorch mark, smoke, a door-off hole with sparks, a dangling spoiler and a bent mast. The driver has dizzy stars, and loose debris lies on the ground.

## Asset list (as built)

- **Chassis (11):** kart, buggy, coupe, hatchback, pickup, van, monster truck, bike, trike, hover sled, tank tread base
- **Body shells (14):** race car, muscle car, retro bubble car, rally car, jeep, police, taxi, ice-cream van, delivery van, rocket car, tractor, hot dog car, shark car, bathtub kart
- **Wheels & movement (10):** slicks, off-road knobblies, monster, chrome spokes, whitewalls, stubby kart, hover pads, tank treads, skis, rocket thrusters
- **Bolt-ons (23):**
  - Spoilers (5): classic wing, duck tail, swan-neck GT, biplane wing, twin fins
  - Bumpers (4): chrome bumper, bull bar, ram plough, cow catcher
  - Exhausts (4): twin pipes, trumpet, stack, zoomie
  - Boosters (3): rocket, nitro tanks, jet turbine
  - Other: roof rack, siren, light bar, antenna + flag, hood scoop, side cannons, shield
- **Driver:** 1 seated chibi bean with 6 helmets (classic stripe, full-face racer, retro aviator, dirt peak, mohawk crest, cat ears). Suit, helmet and accent colours are free.
- **Paint:** 12 colourways (main / accent / roof)
- **Decals (5):** number (7-segment digits), racing stripes, flames, side stripe, checker band
- **Damage:** 2 overlay stages
- **Debris (7):** wheel, door, bumper, bolts, nuts, hubcap, smoke puff
- **Track kit (optional, 12):** road straight, curve, ramp, loop, boost pad, barriers, tyre stack, cones, start/finish gate, checkered flag, pit stop, item box

## Combinations

- **Shapes:** 9 four-wheel chassis × (14 shells + bare) × 10 movement parts = 1,350. Add the trike (15 × 9, no treads) = 135 and the bike (9 movement parts) = 9, for **1,494 rolling silhouettes**.
- **Bolt-on loadouts:** rear 6 × front 6 × exhaust 5 × tail 4 × roof 4 × mast 2 × hood 2 × side 2 = **46,080** (each count includes "none").
- **Total:** about 69 million distinct builds before paint. With 12 colourways and 6 helmets it is about 5 billion.
