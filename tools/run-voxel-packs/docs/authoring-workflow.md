# RUN voxel asset workflow

This workflow applies to a new asset and to an update of an existing asset.
The Python source is the source of the model. The GLB is the output. Keep the
asset ID and its clip, socket, and effect contracts during a repair unless the
task changes them.

Check the inventory before adding a source. The current content contract is
175 models per pack, with exact counts for each category in
`src/validate/pack.ts`. If the requested ID exists, treat the work as an
update. A new ID needs an inventory decision. Replace an ID or approve a
larger category before changing the count contract. Do not raise a count only
to make validation pass. `--only` uses a substring. Use a source slug that
matches one Python file. Check the built ID in the output. Use the full asset
ID for `npm run review`.

## 1. Set the visual target

Read [art-direction.md](art-direction.md). Select the scale class in
`assets/<pack>/scale-classes.json`. Use `contracts/data/scale.json` for size
and `contracts/data/themes.json` for the pack colours. Use
`contracts/data/style.json` for measured style limits.

Write a short intent record before authoring. Include:

| Item | Record |
|---|---|
| Function | What the asset does or represents. |
| Main shape | The form that identifies it at 128 px. Name two siblings with different forms. |
| Size | Scale class, expected height and footprint, and a same-class Pirate Nation reference. |
| Colour | Main material, support material, accent, and the meaning of the accent. |
| Paint | Materials that need 1 texel per world unit patterns. |
| Character | One purposeful detail or visual joke, if the subject supports one. State how it helps the function read. |
| Motion | Clip action, direction, contact, loop behavior, grip, and effect timing when applicable. |

Humour was not a formal rule in the first pack gate. It is now a human review
item. A joke is optional when it would hide the asset's function.

## 2. Author and check the output

Put a world source at `assets/<pack>/<category>/<slug>.py`. Use
`blender/voxgrid.py` and the shared tools in `blender/`. Use 1 world unit per
voxel. Paint world surfaces at 1 atlas texel per unit. Use a small number of
large forms and true slopes. Use paint for small detail.

From `tools/run-voxel-packs`:

```bash
npm run build:pack -- --pack <pack> --only <slug>
npm run validate -- --pack <pack> --level asset
npm run review -- --pack <pack> --only <full-asset-id> --clips
```

The validator checks material settings, scale, texture density, triangle
count, diagonal share, broad colour limits, sockets, and basic clip closure.
Its texture density measure is an area-weighted median. Inspect any large
surface that looks more coarse or fine than its neighbours. A passing number
does not prove good colour design or a distinct shape.

## 3. Review the asset at real scale

Open the review sheet. Check front, back, side, and top. Look at the asset at
128 px in the separate `<asset-id>-128.png` output. Compare it with a Pirate
Nation model in the same scale class and at
least two RUN siblings. Use a native-scale lineup with the 36-voxel person and
16-voxel tile. The review command includes a same-class lineup. Use
`npm run lineup` for a chosen group and `npm run pack-sheet` for a category.

Check these questions on the final GLB:

- Does the main shape show the function before the label is read?
- Does the asset have its own main form? A new colour, sign, or small prop is
  not enough to separate it from a sibling.
- Do the main material and accents fit the pack palette? Does the accent show
  function? Is one colour repeated too often across the category?
- Do painted details use the same pixel size and density as the references?
- Do doors, seats, cabins, wheels, paths, and terrain joins work at the
  36-voxel person and 16-voxel tile scale?
- Is every part connected and visible from the back and sides?
- Does a purposeful character detail help the asset read at 128 px?

The first per-asset review of the pack expansion passed 335 targets. A later
Art Director review found 121 targets to revise or reject. Equal-size cells
hid scale errors. Separate sheets hid repeated building and creature forms.
Always check a full category sheet and true-scale lineup before pack release.

## 4. Review motion in the RUN viewer

For an animated asset, run `npm run review -- --pack <pack> --only
<full-asset-id> --motion <clip>` for each changed clip. The motion sheet samples
five times for a one-shot or seven times for a loop. The `--clips` option
samples one middle frame from each clip and is only an index of the clips.
Motion sheets use a separate file name, so a later motion review does not
replace the rest sheet.

Check start, windup, action, recovery, and end. For a loop, check frames on
both sides of the join. Check pose and speed through the join. Check all arms,
the held item grip, foot and weapon contact, and the direction of each effect.
Compare attacks in the category at the same times. Use the RUN viewer to check
the effect at its socket and during the action. The sample frames are a guide.
Scrub or play the full clip in the local viewer. From
`games/run-voxel-showcase`, run `npm run dev` and open
`http://localhost:5192`. The viewer reads the local stage built by this tool.

The `clips.loop` validator compares the first and last pose of world clips.
It does not check speed through the join or the full arm path. It does not
prove avatar loop quality. A full viewer review is required.

## 5. Use an independent art gate

Give a reviewer the final GLB and its hash, the intent record, four views,
128 px view, clip motion sheets, the native-scale lineup, and the full
category sheet. Give the reviewer Pirate Nation references and RUN siblings.
Do not give the author score or an earlier verdict. Ask for evidence by view,
part, clip, and time.

Record `ship`, `revise`, or `reject` for each asset. Record each defect as P0,
P1, or P2 and state a repair. Only `ship` with no P0 or P1 passes. A score
alone cannot override a `revise` verdict. Bind the review to the GLB SHA-256.
After a rebuild, use a new hash and review again. In a large batch, use two
independent reviewers. Rework a failed asset at most twice before you replace
its design or revise the author brief.

Use [the independent reviewer brief](reviewer-brief.md) and save one review
record per final GLB. The reviewer must inspect the output, not the Python
source. The author must answer each P0 and P1 finding with a changed output
or measured evidence that disputes the finding. Run
`npm run review:check -- --record <review.json>` before release. The command
rejects a stale GLB hash, a `revise` verdict, or a P0 or P1 finding.

Review the full category after per-asset approval. Check repeated shapes,
palette drift, size drift, paint density, attack variety, and terrain joins.
Review all categories together before release. For a new pack or large batch,
start with a pilot that covers every category. Revise the brief when the pilot
shows the same defect in several assets.

### How the four-pack expansion ran

The first four-pack build used voxel-as-code sources and Pirate Nation rig
data as its reference. The first scale pass followed the user's report that
mixed voxel sizes looked poor. It set a 36-voxel person and a 16-voxel tile.
Authors re-authored detail at one-voxel resolution instead of scaling a
finished grid. The next art pass followed the user's report that one-voxel
relief looked too small. It moved small detail into a painted atlas and used
large forms and true slopes for geometry. The palette limits came from
area-weighted Pirate Nation measurements. Later passes added effect aim and
timing, z-fighting checks, and closing loop helpers. These decisions were
saved in local project memory and in the original art direction plan. This
workflow carries their current rules into the repository.

The expansion first measured Pirate Nation references. It tested 40 pilot
models, 10 per pack, with every category represented. Two reviewers judged
each pilot model without seeing the author or each other's verdict. A pack
with fewer than seven accepted models in its first ten after rework had to
revise its author brief before bulk work.

The accepted pilot was followed by three gated batches per pack. Batch A had
26 more props. Batch B had 10 animated props and 9 buildings. Batch C had 9
terrain pieces, 7 creatures, and 5 vehicles. The author built and checked
each source before the next batch. The first gate allowed at most two rework
rounds, then replaced a failed design. The later Art Director pass added the
full category and true-scale checks above. Those checks found defects that
the first gate missed. The process ended with two equal build hashes, release
validation, previews, icons, catalogs, and viewer checks.

## 6. Release

Run the full build, content validation, UI and catalog generation, previews,
staging, release validation, and two-build hash check from [README.md](../README.md).
Run the showcase tests and inspect the deployed viewer before publication.
Keep RUN License text with each staged leaf. Keep the Pirate Nation MIT notice
with character files that carry its armature data.
