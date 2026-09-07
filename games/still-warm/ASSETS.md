# Current asset records

## Creature

The playable loads `public/assets/creature.glb`. The approved assembled body
has nine source clips, hand grips, and a mouth opening. It has no runtime IK,
custom gait, or bone rotation overrides. The actor root moves to each work target.

The mesh was generated with Hunyuan3D v3.1 Pro through RUN. RUN animation
responses use the Meshy action catalog. This is the existing approved asset;
no new mesh, rig, or animation generation ran during the September 7 gameplay pass.

- Reference: `source-assets/assembled/reference.png`.
- Mesh and hosted URL record: `source-assets/assembled/generation.json`.
- Mesh generation: `ebd45fb6-ef8c-4bd3-9f42-b38a200d2664`.
- Rig: `0914b87b-d7d4-42fe-9ebe-3dcded1be86c`.
- Source motion request and responses: `source-assets/assembled/animations/expanded/`.
- Finger additions: `scripts/prepare-hand-grips.py`.
- Mouth addition: `scripts/prepare-scream-mouth.py`.
- Combined playable build: `scripts/prepare-game-creature.py`.
- Final clip sources and durations: `public/assets/creature.json`.

The combined build transfers world poses between the exported source rigs.
Do not copy bone-local curves between those files. Their rest transforms differ.
The hand and mouth additions preserve source body motion.

| Runtime clip | Source |
| --- | --- |
| idle | Original idle response |
| walk | Action 112 |
| pickup | Action 276 |
| collect | Action 284 |
| push | Action 262 |
| kneel | Action 365 |
| scream | Action 386 |
| left | Action 576 |
| right | Action 586 |

RUN's old named walk preset returned action 7, a fall response. It is kept in
the raw viewer for review. The playable uses action 112 for walking.
The source viewer also retains the other walking candidates.

From this game directory, rebuild the combined asset with:

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --python-exit-code 1 --python scripts/prepare-game-creature.py
```

Use `scripts/check-game-clips.playwright.js` with the source proof server to
compare the combined bone positions with each source. The check rejects a
position error above 0.1 mm. The raw viewer is `proof.html`.

## Patient

The playable loads `public/assets/patient.glb`. The father lies on the floor
in a linen shirt and trousers. The chest has Breath and Crushed shape keys.
The wound, fragment, closure, dressing, and brace are separate objects.
The arms and hands have separate pivots.

- Reference and source: `source-assets/patient/`.
- RUN mesh: `6eeefe1a-e495-4bc0-906f-b9bfd781cd07`.
- RUN rig: `5da74b5c-1f6d-4b83-88f2-19b4308c1dfb`.
- Editable Blender file: `source-assets/patient/patient.blend`.
- Build: `scripts/prepare-patient.py`, which loads `prepare-patient-parts.py`.
- Measured body targets: `src/scene/patientLayout.ts`.

The build checks all required parts and shape keys after GLB export. The scene
uses the measured body surface for tool contact. Beam motion and chest pressure
use the same hand contact data.

## Room and sound

The cellar, roof damage, support, lamp, tools, fire, and dust use procedural
Three.js geometry. `objects.html` compares all 18 item models before and after
dithering. Water level and fabric stains reflect their game state.

The opening, private thoughts, breath, heartbeat, and wordless creature calls
use local code. There is no text-to-speech and no generated audio file.
Sound is off by default.

## Cost records

The original generation budget was below $200. Earlier CLI checks reported
260,950 credits and zero CLI usage after the completed jobs. Those values do
not confirm final provider billing. No paid generation ran in this gameplay pass.

The older generation and replacement records remain in
[asset history](docs/asset-history.md). Their runtime paths and pose controls
are obsolete. Source binaries remain in Git LFS.
