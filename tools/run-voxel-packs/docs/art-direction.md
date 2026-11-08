# Art direction: the Pirate Nation style

Every RUN voxel pack is a Pirate Nation (PN) theme, not a new art style. The
rules below have ids; asset sources and the validator refer to them (for
example "true slopes (F2)"). The scale classes are in the README
("Scale standard") and `contracts/data/scale.json`.

## Form

- **F1 Few big volumes.** Block out every asset from a small number of chunky
  boxes, wedges and faceted cylinders. Triangle budget per class: buildings
  2,500–5,500; ships and vehicles 1,300–4,000; props 300–2,000; plants and
  trees 400–950; bosses 1,700–3,500. More triangles are a sign of modelled
  detail that should be paint.
- **F2 Real diagonals.** Roofs, roof ridges, braces, blades, sails, leaves,
  rocks and creature limbs use true slopes and facets (45°, 2:1 and free
  angles), not voxel stairs. Target diagonal surface: buildings 20–35%, ships
  30–50%, plants and creatures over 60%.
- **F3 Thick members.** Posts, frames and beams are 2–4 units thick. A 1-unit
  step is only for trims and outlines. Corner posts and eave beams frame every
  volume in a dark tone.
- **F4 Caricature proportions.** Roofs are tall (about 35–50% of the building
  height) and steep. Chimneys, signs, flags and function props are oversized.
  Doors are wide and short. Nothing is realistic.
- **F5 Life in the lines.** Ridges curve, chimneys lean, signs tilt, flags
  wave. Use small rotations (5–15°) and asymmetry. No building is a perfect
  symmetric box.
- **F6 Readable at 128 px.** The silhouette and the one function prop must
  read in a 128 px thumbnail.
- **F7 Distinct function.** Compare an asset with its siblings at one scale.
  A different name, colour, sign, or small prop does not make a new shape.
  Give each building, creature, vehicle, and terrain piece a distinct main
  form that shows its function before the viewer reads its label.

## Surface

- **S1 Detail is paint.** Planks, grain, stone blocks, shingles, rivets,
  glyphs and dirt are painted pixels on flat faces, at 1 texel per unit, in a
  per-model atlas. Do not model them as relief.
- **S2 Material patterns.** Wood: planks 3–4 px wide, 1 px dark seam, nail dots
  at plank ends, grain streaks. Stone: blocks about 4×3 to 8×4 px with a 1 px
  mortar line, a few cracks. Roof: rows of tiles or shingles 3–4 px tall with a
  dark lower edge. Metal: plates with a 1 px border and rivet dots. Thatch:
  vertical streaks.
- **S3 Soft ramps.** Each material uses 3–5 close tones (value steps of about
  8–15%). No random per-texel speckle across a whole face. Contrast lives at
  edges and seams, not everywhere.
- **S4 Framed edges.** Panels and planks get a darker 1 px border tone, so
  shapes read as outlined, like the PN plank tiles.

## Colour

- **C1 Theme palette.** Use the theme palette below. Main materials take about
  80% of the area; one or two accent hues take 10–20%.
- **C2 Envelope.** Area darker than value 0.25 at most 6%. Mean saturation
  0.45–0.6 for bright themes. Haunted and steel themes may be 55–65% grey, but
  their accents (violet, toxic green, copper, teal) must be vivid.
- **C3 Accents carry meaning.** Accent hues mark the function or the magic:
  glowing windows, flags, signs, gems, slime, energy.
- **C4 Colour roles.** Choose the main material, support material, and one or
  two accents before building. Compare their area with sibling assets. A pack
  loses variety when every creature uses the same accent as its main colour.

## Kit

- **K1 Building recipe.** Stone base or plinth, wood or plaster body, a tall
  roof, a chimney or tower, one oversized function prop, a sign or flag, and
  2–5 small props around the base (logs, crates, barrels, tools).
- **K2 Theme reskin.** A theme reuses the archetype and swaps materials and
  motifs. PN haunted: grey stone, purple roofs, crosses, skulls, toxic-green
  and magenta glow. PN mecha: steel plates, rivets, copper pipes and gears,
  teal windows.
- **K3 Props are icons.** A prop is one iconic shape with a face or a symbol
  where possible (the skull lamp, the tiki mask, the goblin totem). Few parts,
  big features.
- **K4 Character detail.** Give an asset one purposeful visual detail when its
  subject supports it. A leaning sign, an oversized tool, or a face can add
  humour. The detail must show the asset's function and read at 128 px. Do not
  add a joke that hides the function or repeats across a category.

## Motion

- **M1 Attack shape.** Give each creature an attack that fits its body and weapon. Show a clear windup, action, and recovery.
- **M2 Pack variety.** Compare all creature attacks at the same clip times. Change attacks that use the same arm path and timing.
- **M3 Contact.** Keep feet and weapons above the ground unless contact is part of the action. Check the full clip, not one pose.
- **M4 Effect timing.** Start each attack effect at the action. Check its socket and aim in the RUN viewer.
- **M5 Loop motion.** A loop must pass through its join without a visible
  change in pose or speed. Inspect frames on both sides of the join. A matching
  first and last pose alone does not prove a smooth loop.
- **M6 Grip and direction.** Check a held item in the rest pose and through
  the action. The hand must hold the grip, and the attack and effect must travel
  in the intended direction.
- **M7 Full action.** Inspect the start, windup, action, recovery, and end of
  every changed attack. Compare the arm path with sibling attacks. Check feet,
  weapons, and effects in the RUN viewer.

## Theme palettes

Area-weighted, from every PN model. Each pack keeps the PN envelope (C2).

| Pack | PN source themes | Main materials | Accents |
|---|---|---|---|
| fantasy | PN base pirate | warm woods `#794e2c` `#b8926d` `#ccae8f`, rust roof `#89310b`, cream plaster, grey-blue stone `#47565f` | flame red `#e33619`, orange `#e35f0a`, sky blue `#58a7bb`, gold; royal blue and magic cyan |
| monster | PN haunted and zombie | greys `#737373` `#5d5c5c` `#515151`, violet roof `#5a3e6c`, moss olive `#444a21` | pumpkin orange `#ff520e`, toxic green, magenta `#6f2f61`, bone |
| space | PN mecha | steel `#45454d` `#69727a` `#7e8a8e`, copper `#894d17` `#945531`, white hull panels | teal and cyan glow, hazard orange `#a93d00` |
| apocalypse | PN pirate woods, mecha steel, zombie greens | weathered wood, rust copper, steel greys, dusty sand | zombie teal-green `#2b6f58` `#338268`, hazard yellow `#e9ad45`, signal red |
