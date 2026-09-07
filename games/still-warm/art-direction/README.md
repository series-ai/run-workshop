# Still Warm visual study

These images are concept art. They are not game captures or runtime assets.

Generated with the built-in imagegen tool. The reference was `../docs/zombie-game.png`. The exact prompts are in `prompts.json`.

| Study | Character | Main effect |
| --- | --- | --- |
| [A: The Exhumed](a-exhumed.png) | Thin man in a waistcoat, with a slack face and small eyes | A frightened helper who is visibly dead |
| [B: The Drowned](b-drowned.png) | Heavy corpse in wet clothes, with swollen skin | Weight, strength, and close physical danger |
| [C: The Preserved](c-preserved.png) | Dry corpse in a high collar, with stiff hands | Death, age, and a rigid posture |
| [D: The Stitched](d-stitched.png) | Visible stitches, raised scars, and uneven features | Clear signs of reconstruction |

The user requested clearer zombie features, scars, stitches, and deformities. Study D applies this direction. It is the first view in [the HTML gallery](gallery.html). Its exact prompt is in `stitched-prompt.txt`. It was generated with the built-in imagegen tool using A and C as references.

Build the patient as one connected anatomical model. Keep clothes separate. Check the chest, waist, shoulders, wrists, and hands from the game camera. The beam must cross the thighs without hiding the whole body. Keep the wound readable through light and a small blood stain.

Use the current six-color palette as the implementation starting point. These generated boards approximate the dither effect. They do not prove the runtime renderer can reproduce every detail. Check face, hands, and wound at game resolution before adding small surface details.

The local Blender executable is available. A Blender MCP connection was not exposed during this study.

## Approved: Study E

The user requested body parts that look different from each other, with stitches at the joins. [E: The Assembled](e-assembled.png) adds unequal arms, hands, and shoulders, plus a broader lower face attached to a narrow upper face. The gallery now starts with E. This is concept art. It was generated with the built-in imagegen tool using D as the reference. The exact prompt is in `assembled-prompt.txt`.

The user approved E on 2026-09-06. Use this design for the runtime creature. The production reference is `../source-assets/assembled/reference.png`.
