# Independent RUN voxel art review

Review the final GLB. Do not read the author verdict or an earlier review.
Use the final GLB SHA-256 in the record. A new GLB needs a new review.

## Inputs

- The asset intent: function, scale class, main shape, colour roles, and
  character detail.
- Four rest views, a 128 px view, and full motion samples for changed clips.
- One native-scale lineup with a 36-voxel person, a same-class Pirate Nation
  reference, and RUN siblings.
- The whole category sheet and the RUN viewer for effects.

## Decide

Check the function and main shape at 128 px. Check that a sibling does not
reuse its main form with only a new colour, sign, or small part. Check the
colour roles, accent meaning, painted pixel density, and category colour
variety. Check size, doors, seats, cabins, paths, and part contact at native
scale. Check a character detail when it helps the subject. This detail can be
humorous, but it must not hide the function.

For motion, check start, windup, action, recovery, and end. Check both sides
of every loop join. Check grip, arm path, ground and weapon contact, effect
timing, and effect direction. Compare sibling attacks at the same times.

Record one of `ship`, `revise`, or `reject`. Name the view, part, clip, and
time for each defect. Mark each defect P0, P1, or P2. Give a repair action.
`ship` requires no P0 or P1. A high score cannot change a `revise` verdict
to `ship`. If a dimension is estimated from an image, mark it as an estimate.
The author can dispute it with a GLB measurement.

Keep the result in the pull request or in a tracked review record. Link to
durable images or video. Do not leave the only record under the ignored
`.plans/` or `out/` directories. Use these fields. Set `glbPath` relative to
the record file. Run `npm run review:check -- --record <review.json>` after
the final build. Use `--min-reviewers 2` for a large batch.

```json
{
  "assetId": "fantasy-buildings-market-hall",
  "glbPath": "<path to final GLB>",
  "glbSha256": "<64 hex digits from the final GLB>",
  "author": "<author name>",
  "evidence": {
    "fourViews": "<image link>",
    "thumbnail128": "<image link>",
    "nativeScaleLineup": "<image link>",
    "categorySheet": "<image link>",
    "motion": ["<clip sheet or video link>"],
    "viewer": "<RUN viewer link or review note>"
  },
  "reviews": [
    {
      "reviewer": "<reviewer name>",
      "verdict": "ship",
      "findings": []
    }
  ]
}
```

After all assets pass, review each whole category and all four packs at one
scale. Look for repeated shapes, repeated colour use, size drift, attack
motion reuse, and terrain pieces that do not join. A per-asset pass does not
replace this review.
