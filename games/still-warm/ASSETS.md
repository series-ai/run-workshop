# Asset records

## Current approved creature: The Assembled

The user approved concept E. The runtime now loads `public/assets/assembled.glb`.
The old asset is archived at `source-assets/legacy-assistant.glb` and is not shipped.

- Reference: `source-assets/assembled/reference.png`, generated from the approved board with built-in imagegen.
- Exact reference prompt: `source-assets/assembled/reference-prompt.txt`.
- RUN mesh: Hunyuan3D v3.1 Pro, image-to-3D, standard quality.
- Generation ID: `ebd45fb6-ef8c-4bd3-9f42-b38a200d2664`.
- Rig ID: `0914b87b-d7d4-42fe-9ebe-3dcded1be86c`.
- Motion: new idle and walk clips from this rig. Pass each preset with a separate `--animations` flag.
- Build: `scripts/prepare-assembled.py`. Run it with local Blender from the game directory.
- Output: 24 bones, 80,000 body triangles, 1,032 raised-stitch triangles, and two animation clips. About 1.55 MiB.

The Blender build preserves the new texture, removes the provider's self-lighting material,
adds weighted raised stitches, reduces the mesh for the game, and combines the clips.
It does not reuse the old character geometry. The game retains slow movement and arm reach.
The source reference and all downloaded meshes stay outside the public build directory.

`source-assets/assembled/generation.json` records the hosted model URL and job IDs.
`source-assets/assembled/build.json` records the exact output size and skeleton.

The CLI ledger reported 260,950 credits before generation and after all completed jobs.
It reported zero CLI usage. These values do not confirm final provider billing.
One animation request failed because comma-separated names were treated as one preset.
The corrected request completed with two clips. No failed asset is used.

The opening, lantern, narration, and wordless voice use local code. They add no generated audio asset.

## Current player body

The playable loads `public/assets/patient.glb`. This replaces the primitive body and the operating table.
The father lies on the floor in an open linen shirt and trousers.

- Reference: `source-assets/patient/reference.png`, based on the human patient in concept E.
- Prompt: `source-assets/patient/reference-prompt.txt`.
- RUN generation: `6eeefe1a-e495-4bc0-906f-b9bfd781cd07`, Hunyuan3D v3.1 Pro, standard quality.
- RUN rig: `5da74b5c-1f6d-4b83-88f2-19b4308c1dfb`, height 1.8 m.
- Build: `scripts/prepare-patient.py`, run with Blender. It calls `prepare-patient-parts.py`.
- Editable result: `source-assets/patient/patient.blend`.
- Runtime result: 2,281,980 bytes, with a shared texture atlas and Draco compression.

The build poses the RUN rig, divides the body at its joints, and preserves the texture coordinates.
Arms and hands have separate local pivots. The chest has `Breath` and `Crushed` shape keys.
The wound has a real surface opening. The fragment, closure, cover, dressing, and brace are separate objects.
`src/scene/patientLayout.ts` is generated from the measured skin surface. The tool targets use this file.
The build imports the final GLB to check its required parts and shape keys.

The CLI ledger still reported 260,950 credits and zero CLI usage after the patient jobs.
Final provider billing is not confirmed. This pass generated one reference, one mesh, and one rig.
It did not generate new animation clips or audio.

## Previous versions


The room, patient, tools, fire, and sound use code. They require no generated files.
The creature uses one RUN-generated mesh, a generated rig, and five motion clips.
Blender combines the clips, builds the damaged face and cloth, and compresses the texture.

## Completed generation

| Step | Tool | Record |
| --- | --- | --- |
| Mesh | `rundot game generate-3d` | Hunyuan3D v3.1 Pro, text-to-3D, standard, 40,000 faces |
| Mesh record | RUN | `e086b710-5568-480c-bf6d-4db5bea3d808`, seed `286832667` |
| Rig | `rundot game rig-3d` | `df823bb4-090f-48aa-8a1d-15f219a1c473` |
| Motion | `rundot game animate-3d` | idle, walk, crouch, hit, wave |
| Final asset | Blender 5.1 | `public/assets/assistant.glb` |

Mesh prompt:

> A stylized tall slender adult male hospital orderly character, long angular face, pale gray skin, short dark hair, ivory sleeveless canvas work apron over dark trousers and boots. Long arms and large hands. Neutral expression. Standing in a symmetrical A-pose with arms away from torso and legs slightly apart for animation rigging. Full body, single character, no base, no objects. Matte video game style with simple fabric materials.

The rig uses the hosted mesh URL. A local file path alone is not sufficient.
The animation command uses the rig record and space-separated preset names.
There are no generated reach or grab presets. The app uses a two-bone arm solve
for physical reach and attaches the tool to the actual hand.

## Rebuild the local asset

The downloaded rig and clips are in `source-assets/`. They stay outside `public/`
so the build does not include duplicate meshes from each clip file.
Git LFS stores the binary files.

From this game directory:

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --python scripts/prepare-assistant.py
```

The script preserves five named clips and the 24-bone rig. It adds weighted seam
geometry and a Victorian coat with a high collar, waistcoat, and aged buttons.
It deforms the source face into concave sockets and a torn mouth. One eye is
clouded; the other socket is empty. Face wraps and flat face plates are removed.
The revised GLB is 624,584 bytes (about 610 KiB). These changes use local geometry. It exports a Draco-compressed GLB with a JPEG texture. The app loads
only the combined GLB. The procedural creature is a fallback for load failure.

## Cost check

The user set a budget below $200 for generation. The work plan set a $180 cap.
No further generation is planned for this version.

The credit check before generation, at 2026-09-06 02:21 UTC, reported:

- Balance: 260,950 credits.
- CLI usage today: 0 credits.

Checks after all mesh, rig, and motion jobs completed, at 02:41, 02:55, and 03:27 UTC,
still reported the same balance and zero usage. The 02:55 check also filtered
by the new game's ID. These are the reported ledger values, not proof that the
provider's final charge is zero. Check the ledger again before more generation.

`rundot generate estimate` does not support these 3D jobs. Use:

```sh
rundot credits --consumer cli --period today
```

Three mesh requests failed before the successful request: an overlong prompt,
a content check, and an unsupported face count. One animation request failed
because comma-separated names were treated as one preset. No failed job asset
is used by the game.


## Zombie revision

The visible asset remains the original RUN mesh and rig, rebuilt in Blender.
The source face was deformed directly. The script preserves 24 bones and five
clips. Added geometry has no unweighted vertices.

One request for a new Hunyuan zombie base was rejected by its content checker.
It returned no mesh or hosted URL. No retry was sent. The CLI ledger immediately
before that request still reported 260,950 credits and zero CLI usage.
The local server cost table estimates Hunyuan standard generation at $0.675
before markup. That estimate is not a receipt or final charge confirmation.

The runtime samples a still pose from the RUN idle clip. It uses the walk clip
only during floor travel. It does not play the wave or hit clips during care.
Arm reach and a slow torso bend drive treatment. The hips keep their sampled
translation, so animation clips cannot add unwanted vertical movement.
