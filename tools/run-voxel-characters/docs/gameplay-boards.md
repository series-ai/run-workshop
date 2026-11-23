# Cubix gameplay boards

Cubix gameplay boards include a complete scene, modular parts, equipment, animated actors, and a map of game interactions. See the `License.txt` file in each pack leaf for its terms.

| Board | Main route | Optional route |
| --- | --- | --- |
| Emberdeep | Hoist, ore rail, dwarf forge, lava bridge, royal vault, exit shaft | Gather a glow shard in the crystal gallery and cross the upper bridge. |
| Last Light | Safehouse, pharmacy, quarantine gate, stadium, broadcast relay, evacuation | Find tools in the salvage alley and open the service bypass. |
| Estuary Front | Command post, rail depot, bridge control, airstrip, coastal battery, landing pier | Get orders at the forward dugout and cross the pontoon deck. |
| Alderwick | Buy grain at the market. Exchange it for iron stock at the mill. Forge a hinge, repair the castle gate, recover the court seal, and return to the cart road. | Pick herbs and make cordial at the apothecary. Get a steward letter and use it to unlock the side gate. |

Alderwick has 96 × 96 m of town ground at a 10 cm cell size. Riverbanks and wooded bluffs extend beyond the town ground. Its inn, apothecary, chapel, and smithy have open entrances and furnished ground floors. Seven eye-level
cameras show the street, workshops, mill, chapel, castle gate, and great hall.

## Original pack worlds

| Pack | Main route | Alternative route |
| --- | --- | --- |
| Core | Pass the timed course, inspect the wheel lift, test the brakes, and release the pickup. | Service the air plant to reach the brake test. |
| Heist | Survey the demolition site, recover the plate, print a slip, and pack and stamp the parcel. | Restock the ink and pack at the covered stand. |
| Industrial | Sample ore, repair the press, weigh the billets, and sign the dispatch manifest. | Service the cooling pump and route flow through the quench line. |
| Security | Log the manifest, read the parcel, calibrate the scanner, and clear the inspection lane. | Get a supervised pass and use the service gate. |
| Creatures | Survey the creek and fen, sample the water, and file the animal counts at the ranger archive. | Record the feed check and use the woodland trail. |
| Fantasy | Mix glaze, fire and mark a tile, and register it at the guild exhibition. | Weave a ribbon and use the textile entrance. |

## Expansion districts

The three earlier boards have twice their original terrain area. The 10 cm cell size applies
to both the original ground and the new districts.

| Board | Terrain footprint | New points of interest | New route |
| --- | --- | --- | --- |
| Emberdeep | 64 × 96 m | 6 | Prime the cistern pump, collect sediment and amethyst, cut a filter stone, and repair the lift chain. |
| Last Light | 80 × 128 m | 5 | Follow the south tram line through the cold store, waterworks, winter garden, and ration market. |
| Estuary Front | 88 × 144 m | 6 | Move cargo from the orchard to the canal. Service the lock and supply the outer harbor beacon. |

The overview camera adjusts to fit all placed geometry in a 3:2 frame.
New eye-level cameras show entrances, controls, and work areas in the
added districts.

## Environment art

Use [the official Teardown screenshot gallery](https://teardowngame.com/#screenshots) to review scale, depth, material changes, and light. Author original buildings, assets, and routes.

- Review each stop close to player eye height. Use an overview to check the whole route. Check that the player view shows how to enter, cross, or use the location.
- Build corners in depth. Add backs, roofs, wall returns, and visible interior supports. Use entrances and windows to show what the room contains.
- Keep the world grid at 10 cm. Use changes in material, fitted edges, and recessed forms to give the grid a clear scale. Put wear where water collects, where people work, and where parts touch.
- Give each important stop a form or light that reads from the approach. Arrange small props in groups that show a use, such as a bench with tools or a loading ramp with waiting cargo.
- Vary districts by function first. Give a rail yard, living quarter, and loading area different rooflines, floor materials, and visible equipment.
- Use shape to identify a character or pickup from a distance. Vary body proportions, clothing layers, and headwear before adding small details. Change a grip or attachment point only when its use changes.
- Check the exported GLB and voxel runs against each other. Use real camera renders to review the surface grain. Confirm that columns, roof supports, and new props leave the gameplay routes clear.

## Screenshot review

Use the published Synty scenes to judge depth, density, and focal points.
Review [Dungeon](https://syntystore.com/products/polygon-dungeon-pack),
[Apocalypse](https://syntystore.com/products/polygon-apocalypse-pack),
[War](https://syntystore.com/products/polygon-war-pack), and
[Fantasy Kingdom](https://syntystore.com/blogs/blog/fantasy-kingdom-demo-in-unity-6).
Use original Cubix geometry and keep the 10 cm level grid.

1. Render the previous and new exports from the same camera. Check a ground
   view and an overview for each board.
2. Check the ground view for a foreground object, a clear destination, and
   distinct layers of geometry between them. Inspect the scene from a second
   stop and an overview.
3. Put equipment next to the place that uses it. Vary whole districts
   through their buildings, terrain, light, and signs.
4. Leave space for the walk route. Use surfaces, signs, overhangs, and the
   edges of the route to add detail where props would obstruct the path.
5. Render again after changes. Check the mesh and raw voxel outputs together
   and run the route and camera tests against the new stage.

Give each board two close views for review. Show one main location and one
different activity. Keep the main subject and the people in view. Check that
cave interiors hide the sky and that the views hide unfinished level edges.

Compare the two views with the reference scenes. Check composition, activity,
lighting, large shapes, surface detail, and how clearly the scene shows its
setting. Use the exported level and its actor positions for every capture.
Measure draw calls and submitted triangles at the same camera positions in
both mesh exports. Measure raw voxel parsing and meshing separately.

## Import

1. Open the board's `level-kit/demo.glb` for a mesh level. It includes parked vehicles, named tour cameras, fixtures, and a sun.
   Engines that support `EXT_mesh_gpu_instancing` can load
   `level-kit/demo.instanced.glb` for the same mesh level. The export groups
   opaque copies of a prefab into 24 m cells so the engine can cull each group.
   Glass keeps individual nodes for sorting. Use `demo.glb` when a game needs
   to access individual prop nodes. Measure both exports at the game's cameras.
   A group can submit more triangles at close range when some instances are off screen.
2. Use `level-kit/demo.voxels.json` for the same static scene from 10 cm cells. See [the Cubix voxel format](level-voxel-format.md) for coordinates, palettes, and finishes.
3. Read `level-kit/gameplay.json` for interaction data. The scene also contains these data under `extras.cubixGameplay` in GLB and `scene.gameplay` in the raw scene.
4. Spawn mobile models from `assets[id].files.motion`. Use the corresponding raw part files if the game renders these models from voxels. Remove the parked placement when you replace it with a live vehicle in the same position.

The scenes use a right-handed system with +Y up and +Z forward. Positions and bounds use meters. An equipment model with a `grip` has its origin at that grip. Parent it to a hand mount. Equipment uses 2.5 cm cells. Actors use 5 cm cells. Vehicle body cells are 10 cm. Many tires use 5 cm cells.

## Gameplay data

- `entry` and `exit` refer to stable point IDs.
- `ambientActors` lists optional actor spawn locations. Resolve `asset` against
  `assets`. Apply `position` to the actor root. Apply `yaw` in degrees around
  +Y, starting from +Z. An optional `pose` gives a named actor clip and a
  time in seconds. The review renderer holds this pose. It uses the last
  frame if the time is longer than the clip. Games can use these positions
  and poses for residents and background activity.
- `points[].position` is the interaction anchor. `radius` is its trigger radius in meters. The ordered `actions` can refer to equipment, actors, vehicles, or static props by their asset IDs.
- Treat `actions[].requires` and `routes[].requires` as sets of prerequisite flags. Assign `actions[].reward` after the game completes that action. The values are stable within a board.
- Each route connects two POIs. `waypoints` supplies intermediate positions from the first POI to the second. The game can use these for tour start points, route hints, or navigation checks. Use `traversal` to select the movement type. Treat a `drop` as one way from the first point to the second.
- The game supplies rules for gates, actors, AI, collision, item pickup, driving, combat, and extraction. An exported action names the rule, inputs, and target assets. It does not run the rule.
- The static scene marks gates and control props in their review positions. Use the action and route flags to control access in a game. The lava action gives an axis-aligned hazard volume.
- Each board has five optional pickups at existing points of interest. A
  `pickup` action names the equipment asset and its `found_` flag. Use the
  point position and radius to place the pickup or expose a nearby interaction.
  Track the flag so the same pickup does not grant a reward again. The
  `collectible` equipment role identifies souvenirs for a collection.

## Vehicle roster

| Board | Vehicle assets |
| --- | --- |
| Emberdeep | Loaded and empty mine carts, exit lift cage |
| Last Light | Salvage pickup, ambulance van, abandoned hatchback, evacuation truck, stadium forklift |
| Estuary Front | Scout jeep, staff car, cargo truck, ambulance, amphibious transport, half-track, light tank, medium tank, heavy tank, tank destroyer, recovery tractor, locomotive, fighter, transport aircraft, bomber, landing craft, patrol launch, supply barge, dockside lifting crane |

## Motion

Move a vehicle from its `vehicle_root`. Road and rail wheels have spin nodes. Road vehicles can have steering nodes. Tracked models have named track shells and powered road-wheel pivots. Turrets and barrels have independent yaw and pitch nodes. An aircraft exposes propeller, landing gear, and roll control pivots. Marine craft have rudder, ramp, gun mount, or cargo hatch pivots. The dock crane has a rotating upper assembly, cable, and hook. These clips demonstrate local motion. A game supplies movement, physics, and track belt motion.

Actor GLBs have an `actor_root`, two hand mounts, and `Idle`, `Walk`, and
`Reach` clips. One mesh uses one joint per vertex. The body grid uses 5 cm
cells. The head uses 2.5 cm cells for the cap edges and trim. The skull,
eyes, and nose use full 5 cm steps. Dwarves have their own shorter build.
The two hand mounts sit in the grip channels.

Use `Board.stage_work` in the board source to place a worker at a prop.
Give each active hand a contact position in world meters. The exporter
solves the shoulder and elbow rotations and adds a named clip to both actor
formats. Animate from rest to contact and back. The review camera holds at
0.45 seconds, when the hands are at the contacts. The exporter rejects contacts
outside the actor's reach.

The two Last Light queue props and the occupied cot use the 10 cm level
grid. They are static scene pieces. Use the separate actor GLBs for
animated characters.

For an animated raw part, apply the part's rest translation relative to its named parent. The optional grid uses the same local run encoding as the static scene and includes the mesh pivot in its origin. The declared cell size belongs to the part. Vehicle track values use GLB quaternion ordering. Translation tracks are offsets from the local rest translation.

## Build

From the run-workshop root, run the script with Blender 5.1 or compatible.

```sh
blender --background --factory-startup --python-exit-code 1 \
  --python tools/run-voxel-characters/blender/build_gameplay_boards.py -- \
  --archive tools/run-voxel-characters/out/cubix-gameplay-boards.zip
```

The default stage is `tools/run-voxel-characters/out/board-stage`. The default build exports Emberdeep, Last Light, Estuary Front, and Alderwick. Use `--board` to select a board. Repeat the option to select more than one. The keys are `caverns`, `apocalypse`, `ww2`, `medieval`, `core`, `heist`, `industrial`, `security`, `creatures`, and `fantasy`. Use `--stage` to select a build directory. The archive contains only the files declared for each selected board.

Render a named stop from the exported GLB. The capture uses the board's
camera, sky colors, lights, and actual models. The Blender review uses the
authored Cubix sun strength in its own light units. Use `--draft` for iteration.
Open the image at full size to
check cell grain and contact between props and surfaces.

```sh
blender --background --factory-startup --python-exit-code 1 \
  --python tools/run-voxel-characters/blender/render_gameplay_board.py -- \
  --leaf tools/run-voxel-characters/out/board-stage/run-cubix-caverns/3D/dungeon \
  --output tools/run-voxel-characters/out/board-previews/caverns \
  --shot "Ore rail and forge"
```

Verify the real exports with the same Blender binary.

```sh
CUBIX_BOARD_STAGE="$PWD/tools/run-voxel-characters/out/board-stage" \
  blender --background --factory-startup --python-exit-code 1 \
  --python tools/run-voxel-characters/blender/test_gameplay_boards.py
```

For a partial stage, set `CUBIX_BOARD_KEYS` to a comma-separated list of the
keys that you built. This option requires the tests to find each selected export.
