# Authoring Micro-RTS Units & 8-Way Pixel Craft

This guide codifies the design rules, palette conventions, 3D rotational cues, and verification gates established across `tools/run-micro-sprites/`. Follow it whenever creating a new faction, infantry unit, Titan/flyer, split-hull vehicle, or building.

---

## 1. Mixed-Scale Hierarchy

All sprites live on one shared native pixel grid (`1×` = authentic retro pixel density on a `480×256` viewport) with strict proportional scale tiers:

| Tier | Core Size | Outlined Size | Layers / Facings | Source File |
|---|---:|---:|---|---|
| **Ultra-Micro Swarm** | `4×4` | `6×6` | Single-layer, 2-way (`R`/`L`), 3f | `src/micro4.ts` |
| **Infantry** | `8×8` | `10×10` | Single-layer, 8-way (`N..NW`), 13f (`2+4+4+3`) | `src/units.ts` |
| **Flyers** | `14×12` / `16×12` | `16×14` / `18×14` | Single-layer, 8-way (`N..NW`), 13f (`2+4+4+3`) | `src/titans.ts` |
| **Ground Titans** | `16×16` / `18×16` | `18×18` / `20×18` | Single-layer, 8-way (`N..NW`), 13–14f | `src/titans.ts` |
| **Split-Hull Vehicles** | `22×20` | `24×22` | 2-layer (8-way hull × 8-way turret), 4 tread + 4 recoil frames | `src/tankIso.ts` |
| **Buildings & Props** | `16×14` – `32×25` | `+2px` | Static grounded footprints (`2.5×–3.5×` infantry) | `src/buildings.ts` |

Canonical 8-row sheet order everywhere:
```ts
export const DIRS_8: readonly Dir8[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
```
Author the 5 base headings (`N`, `NE`, `E`, `SE`, `S`). Headings `SW`, `W`, and `NW` are derived by horizontally mirroring `SE`, `E`, and `NE` (and relighting top-left steel highlights on vehicles via `relightMirroredSteel`).

---

## 2. Faction Palettes & Outline Discipline

All palettes live in `src/palette.ts`. Each faction uses a vivid 3-step hue-shifted primary ramp + a signature emissive accent so factions stay separable at `1×` in 200-unit clashes:

| Faction | Material Ramp | Team-Remappable Ramp | Signature Accent |
|---|---|---|---|
| **Vanguard** | Steel `w` `#f2f7fc` → `m` `#cddae8` → `s` `#9cb0c9` → `d` `#4e607a` → `q` `#364359` → `k` `#202636` | Cobalt `b` → `B` → `D` | Warm gold visor `v` `#ffd23f`, orange-cream fire `f`/`F`, cyan VTOL exhaust `c` |
| **Kraxen** | Organic flesh/hide `r` `#47192d`, `R`, `x`, `n`, `t`, `a`, `e` + Bone `o` `#f5e8c6` → `c` → `C` | Magenta/Orchid `p` → `m` → `u` | Acid lime `g`/`G` (`#9dff3b` / `#ebffb3`) — **used on bio-combat units, kept off buildings** |
| **Solaris** | Solar Gold `w` → `y` `#ffe875` → `g` `#e3a127` → `b` `#8a4e16` | Royal Teal/Blue `T` → `t` → `D` | Electric cyan psi `c`/`C` (`#2ce8f5` / `#e0ffff`) |

### The `1px` Outline Weight Rule (Critical!)
- Every sprite gets a **single exterior `1px` outline** via `addPixelOutline(raw, INK_OUTLINE)` (`#130f1e`).
- **Never paint `k` (`#202636`) or `K` on the outer silhouette boundary** of tracks, gun barrels, armor rims, or wings. Placing a near-black pixel adjacent to `#130f1e` optically doubles the outline to `2px`, making vehicles look chunky and out-of-family next to `8×8` infantry.
- Reserve `k` for strictly interior crevices (recessed tread links, barrel undersides next to brighter armor, bunker gun slits). Use slate `q`/`d` (Vanguard), dark plum/hide `u`/`r` (Kraxen), or bronze `b` (Solaris) for outer sprite edges.
- On split-layer units (like the Siege Tank), composite `hull + turret` on the raw surface **first**, then apply `addPixelOutline` **once** to the combined silhouette so no thick black ring disconnects the turret from the hull deck.

---

## 3. True 3D 8-Way Silhouette Rules (By Archetype)

The #1 failure mode in 8-way pixel art is **recycled diagonals**: drawing `N` and `S` vertically, then leaving `NE`, `E`, and `SE` with nearly identical horizontal silhouettes. Every heading MUST read clearly at **idle (with zero weapon effects)**!

### A. Humanoid / Bipedal `8×8` Infantry (`src/units.ts`)
With only 64 pixels, directional cues come from **head/visor placement + weapon elevation + torso shoulder angle**:
- **`N` (away)**: Solid rear helmet/hood (`ssdd` / `ggy`), backpack or rear mantle, weapon pointed up or tucked behind shoulder. Zero visor/eye pixels.
- **`NE` (back-right 3/4)**: No front visor/eyes. Weapon/barrel/blade/casting hand steps **`1px` outward and UP** above the hand/shoulder (or shows a distinct bright-steel shoulder casing like Vanguard Heavy's `ws`/`qd` launcher).
- **`E` (side profile)**: Single visor/eye pixel on the **leading right edge** (`sssv` / `ggC` / `yggC`). Weapon/blade/hand points **horizontally level**. For shoulder launchers or rifles, extend the dark barrel/opening `1px` past the shoulder and place the attack flash **beyond** it (never a bright vertical bar covering the armor).
- **`SE` (front-right 3/4)**: Exposed front visor/face pixel (`ssvd` / `gCg` / `ygCy`). Weapon/barrel/blade/casting hand steps **`1px` outward and DOWN** below the hand.
- **`S` (toward camera)**: Symmetric twin visor/eyes (`svvs` / `gCg` / `yCCy`), centered chest weapon or twin melee sweep pointing down.
- **Strike separation rules**:
  - **Rifles**: Keep at least `1px` of dark barrel (`d`/`k`) between hand and muzzle flash.
  - **Melee blades**: Preserve `1px` of gold/armored hand at the base of the energy slash so the blade doesn't merge into a round glow ball. Keep the head unobstructed on `N` slashes.
  - **Casters**: Keep the robe hem centered over the hover glow and leave a **`1px` empty gap** between the casting hand and the released projectile orb on `A1`.

### B. Organic Quadrupeds & Flyers (`src/units.ts` & `src/titans.ts`)
- **Axis shift on diagonals**: Shift the head/snout `1–2px` toward the named corner (`NE` = upper-right, `SE` = lower-right) and anchor the rump/tail at the **opposite** diagonal corner (`SW` for `NE`, `NW` for `SE`).
- **Foreshortening & occlusion**:
  - On `NE`/`NW`, hide the far tusk/foreleg behind the shoulder and shorten the far wing by `1–2px`.
  - On `SE`/`SW`, lower the snout `1px`, expose eyes/acid glow, extend the near tusk `2px` past the snout, and plant the **near forefoot 1 row below the far forefoot**.
- **Volume parity on `E`/`W` profiles**: Pure side profiles easily shrink to 70–80% of diagonal pixel mass (looking like a tiny lump). Build side-profile flyers around a solid `2×2` chest, distinct head ahead, `2–3px` tail behind, and a **notched near-wing elbow rising above the chest** (leave a `1px` dark/empty notch between wing and neck so it reads as a wing, not a slug!).
- **Open-mouth & cleave readability**:
  - On `E`/`W` bite attacks (`Swarmling`), separate upper and lower bone fangs with `1px` of dark mouth (`r`/empty) instead of a solid pale vertical bar.
  - On `S` cleave attacks (`Behemoth`), leave a `1–2px` dark gap between the sweeping tusk tips so the dark snout and glaring eyes remain visible.

### C. Walkers & Capital Ships (`src/titans.ts`)
- **Pick unmistakable front & stern landmarks**:
  - **Colossus**: Glowing cyan beam port is the front — hidden behind the golden dome on `N`, on the upper-right rim on `NE`, leading right rim on `E`, lower-right rim on `SE`, and lower front rim on `S`. Start the `S` beam **below** the lower rim so it never covers the body center. Overlap far stilts behind near stilts in `E`/`W` profile, and stagger near/far feet by `1–2` rows on `NE`/`SE`.
  - **Sky-Carrier & Gunship**: Twin cyan exhausts mark the stern; a `2px` tapered nose/bow marks the front; a continuous pale-steel fuselage stripe (`Valkyrie`) or `2px` cyan deck strip (`Sky-Carrier`) connects bow to stern along the exact heading axis. On `NE`/`NW`, step the bow up `1–2` rows and stern down `1–2` rows; reverse on `SE`/`SW`.

### D. Split-Hull + Independent-Turret Vehicles (`src/tankIso.ts`)
Follow the Codex-verified `22×20` Siege Tank blueprint:
1. **Exposed chassis hierarchy**: Spend pixel budget on visible rolling treads (`3px` wide on `N`/`S`, long cleat belt on `E`/`W`, parallel `2:1`-stepped belts on `NE`/`SE`), a clear pale-steel armored upper deck, blue faction trim, and a **low beveled turret** that never swallows the tracks.
2. **North vs South hull readability (even when turrets aim East!)**: Give `N` a dark rear engine plate with glowing amber exhaust vents (`dkffdkfd`), and `S` a bright steel-and-blue sloped glacis with gold headlights (`vmmmmmmv`).
3. **Isometric `2:1` diagonal slope**: Diagonal tracks and barrels step **2 pixels horizontally per 1 pixel vertically** (`NE`, `SE`, `SW`, `NW`) so turning never makes the vehicle look shorter.
4. **Barrel clearance & barrel-only recoil**: Extend idle barrels `2–3px` past the hull nose. On `A1–A3`, recoil **only the barrel** (keep the turret body fixed on `TANK_HULL_PIVOT[hullDir]`).
5. **Relit horizontal mirrors**: Call `relightMirroredSteel()` on mirrored `NW`/`W`/`SW` hulls and turrets so upper-left lighting stays consistent across all 8 headings.
6. **Track-hugging contact shadows**: Generate per-heading shadows directly from the lower tread footprint (`buildTankContactShadow(hullDir)`), not a generic oval.
7. **Exact 64-combo muzzle sync**: Verify programmatically that `TANK_HULL_PIVOT[hullDir] + TANK_MUZZLE_REL_8[turretDir]` lands on a painted `F` flash-core pixel on `A1` for all `8 × 8 = 64` hull×turret combinations! Also draw the shell on frame 0 at the muzzle before advancing velocity so the first visible frame sits inside the flash.

### E. Grounded Buildings (`src/buildings.ts`)
- Size buildings `2.5×–3.5×` larger than `8×8` infantry (`16×14` defense structures, `32×23..32×25` main bases).
- Paint a **flush, wide bottom foundation/root skirt** reaching the lowest row of the core pattern (`y = height - 1`) with an anchored ground shadow beneath it so structures visibly sit on the terrain with zero floating gap.
- Keep Kraxen buildings purely organic (magenta/plum carapace, bone spires, earthy chitin roots, wet cavernous maw) — reserve neon acid-lime (`g`/`G`) for combat units and acid projectiles.

---

## 4. Anti-Jitter 8-Way Simulation Steering (`src/cli.ts`)

When animating 8-way sprites in a live RTS simulation, raw `Math.atan2(dy, dx)` quantizes across `22.5°` octant boundaries and causes ugly sprite flicker. Always apply all 4 stabilizers implemented in `src/cli.ts`:

1. **Angular hysteresis + 1-octant step (`stepDir8Smooth`)**: Require the desired angle to exceed a deadband (`32°` for units/hulls, `28°` for tank turrets) from the current heading before stepping, and advance at most **1 octant (`45°`) per turn cooldown**.
2. **Per-layer turn cooldowns**: Infantry `dirTurnCd = 0.22s`, Flyers `0.24s`, Tank Hull `hullTurnCd = 0.28s`, Tank Turret `turretTurnCd = 0.16s`.
3. **Sticky targeting (`stickyTarget`, `retargetCd = 0.55–0.90s`)**: Keep engaging the current live in-range target instead of re-picking the nearest enemy every frame.
4. **Smoothed velocity steering (`svx`, `svy`)**: Low-pass filter instantaneous velocity (`svx += (vx - svx) * 6 * dt`) and steer facing/banking along `(svx, svy)` rather than raw separation impulses.

---

## 5. Verification Checklist & Proof Design

- **Proof sheet layout** (`renderSpriteContactProof`, `renderTitansContactProof` in `src/cli.ts`):
  - Render **2 rows per unit** across all 8 columns (`N, NE, E, SE, S, SW, W, NW`) on a **single uniform dark slate background** (`#181d29` swatch):
    - **Row 1 (`Idle 0`)**: Exposes facing readability and silhouette rotation with weapon effects absent.
    - **Row 2 (`Strike A1`)**: Exposes exact weapon origin, hand/barrel/jaw separation, and emitter alignment.
- **Automated audit snippet** (run right after `npm run build`):
  1. Check `minMaskDiff > 0` across `(NE, E, SE)` idle masks for every unit and confirm `E` painted pixel count stays within ~80–115% of diagonal pixel count.
  2. Assert `COLOSSUS_EMITTER_8` lands on painted cyan (`c`/`C`) pixels for **8/8** headings.
  3. Assert `TANK_HULL_PIVOT[h] + TANK_MUZZLE_REL_8[t]` lands on painted `F` flash pixels for **64/64** combos.
- **Visual sign-off**: Always inspect `proof-titans-16x16.png`, `proof-8x8-sprites.png`, and `proof-combined-arms-battle.png` directly—never rely on numeric checks alone.
