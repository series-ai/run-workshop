# Cubix level reference study

The first pass used the same 12 m square and perimeter for most of the demos.
It showed the models at a consistent scale. The Teardown screenshots show a
different approach to level composition. Buildings have depth, rooms connect
to service spaces, and the ground changes where people or vehicles use it.

Teardown's scripting API gives 0.1 m as the default voxel size. Cubix uses
that size for structures and 4 m for standard wall and floor modules. Use
the same cell size for most of the level. Put the fine detail at joints,
openings, steps, and worn surfaces. Use separate values for broad materials
and small variations within a material. [Teardown API](https://teardowngame.com/modding/api.html#GetShapeSize)

| Cubix kit | Published reference and observed treatment | Cubix revision |
| --- | --- | --- |
| Core | The base game yard image shows enclosed work space beside open pavement. Roofs cast distinct shadows. [Base game screenshots](https://store.steampowered.com/app/1167630/Teardown/) | Add a sheltered workshop, a lit window wall, and a side practice bay. Keep the center open so the workshop entrance stays visible. |
| Heist | The Evertides storefront image shows a facade with upper windows, a sidewalk, and a separate road level. [Base game screenshots](https://store.steampowered.com/app/1167630/Teardown/) | Add a street extension, a curb, a recessed storefront, and a loading alley behind a corner. Put brick patches near the shutters and worn paving along the route. |
| Industrial | The Time Campers rail yard image shows continuous track, raised platforms, awnings, and structures along the rail line. [Time Campers screenshots](https://store.steampowered.com/app/2657050/Teardown_Time_Campers/) | Make the open loading apron connect to the process bay. Add a raised service walk, a wide equipment opening, and overhead services. |
| Security | The Greenwash Gambit station interior uses a short, enclosed corridor, inset equipment, and light at the end of the route. [Greenwash Gambit screenshots](https://store.steampowered.com/app/2657100/Teardown_The_Greenwash_Gambit/) | Put the scanner under a partial roof. Add a separate control room, glazed partitions, and a service door. Use cyan for active equipment and a lighter floor along the route. |
| Creatures | The wooded base game approach has irregular vegetation and a road that follows the terrain. The Barkuna shoreline images have several levels between water and buildings. [Base game screenshots](https://store.steampowered.com/app/1167630/Teardown/), [Barkuna screenshots](https://store.steampowered.com/app/2657090/Teardown_Relics_of_Barkuna/) | Cut an open stream between two banks. Add bridge approaches, uneven rocks, and groups of mixed-size trees and brush. Keep the shelter visible from the trail. |
| Fantasy | The Barkuna courtyard images show walls with depth, stair approaches, and lamps that mark destinations. [Barkuna screenshots](https://store.steampowered.com/app/2657090/Teardown_Relics_of_Barkuna/) | Connect a lower market to a raised shrine. Add a deep arcade, separate masonry courses, a paved approach, and more than one route into the courtyard. |

Check the routes from near eye level and check the full site from above.
Give each kit at least one area where walls and a roof change the light,
or where terrain changes elevation. Keep the Cubix layouts and props original.

## Third pass

The reference screenshots use large shapes to frame the view at eye level.
Smaller objects show what people do in each area. Put the objects for one task
together. Let a stair, lane, or bridge lead to that group. Put details such as
sills, seams, and trim where materials or parts meet.

| Kit | Main feature | Example parts for other layouts |
| --- | --- | --- |
| Core | A training lane ends at three targets. A separate gantry marks the repair area. | Corrugated wall, pitched roof, parts rack, work table, and floor patch. |
| Heist | An upper wall has a broken bay with exposed joists and rubble below. | Recessed shop corner, alley arch, rooftop air unit, hatchback, and utility pipes. |
| Industrial | A raised ore hopper feeds a stepped conveyor and receiving bin. | Scrap bin, sheet metal wall, loading canopy, rack, drain, and ramp. |
| Security | A window and counter face an inspection lane with a barrier and overhead signal. | Service door, wall return, terminal panel, bench, and ceiling services. |
| Creatures | A bridge approaches a roofed lookout between rock faces. | Lookout stairs, shale return, reeds, willow, alder, and bridge footings. |
| Fantasy | A two-part gate tower sits beyond two different market stalls. | Window bay, stone return, awning, produce and cloth bins, and damaged wall end. |

Use the same 10 cm grid for wear and large forms. Keep the silhouette clear
when the camera moves back. The showcase uses a sky gradient, directional
shadows, and local lights below roofs and at entrances. The GLBs contain the
scene geometry and vertex colors. See [Cubix level kit files](level-voxel-format.md)
for the camera and light data.

## Vehicle pass

The base game and Folkrace screenshots show tires inside the body, distinct
hood and roof profiles, narrow window frames, and work equipment with visible
supports. Use these cues to make vehicle types easy to identify. Use the
Time Campers references for timber carriage proportions and wheel hardware.
[Base game screenshots](https://store.steampowered.com/app/1167630/Teardown/)
[Folkrace screenshots](https://store.steampowered.com/app/2657060/Teardown_Folkrace/)
[Time Campers screenshots](https://store.steampowered.com/app/2657050/Teardown_Time_Campers/)

Keep the large forms on the 10 cm grid. Use a 5 cm grid for driven wheels.
Set the wheels in wells. Check both steering limits while the wheels roll.
Use a dark tread, recessed hub, and a distinct rim for road vehicles. Leave
openings between the spokes of timber wheels. Use stepped windshield and hood
profiles for the road fleet. Give the forklift visible mast guides and give
the crane open boom sections with a clear path for the trolley.

## Vehicle silhouettes

Give each vehicle a profile that shows its job. Use a low hood and long rear
window on the hatchback. Put the delivery van's cab ahead of a tall cargo
box. Give the ranger truck a rescue ladder with supports and keep its bed
open. Raise the crane boom in steps and keep the trolley rail level. Keep the
forklift cab open so the mast and forks stay visible. Use a striped canopy
with timber supports on the market wagon.

Compare revisions from the same three-quarter and side camera positions.
Keep the scale and lights fixed for both captures. Check that the route still
fits the parked model. Check wheel clearance during turn and roll. Check that
lamp mounts, moving pivots, and clip names still match the catalog.

## Vehicle surface wear

Put road film along the lower sills. Expose steel along rubbed loading edges.
Put grease along the forklift guides and bright steel at the fork tips.
Make the crane's working surfaces dull near joints. Use pale plank edges
and faded stripes on the market wagon. Group the marks in the contact areas.
Use the 10 cm body grid for paint wear and the 5 cm wheel grid for tread.
Keep glass and lenses in their own surfaces. Apply wear to the named rigid
part so the marks move with a wheel, fork, or tailgate.

Bake the wear into vertex colors on the detailed GLBs. Give dust and oxide
matte materials. The parked models use the coarse surfaces for scene budgets.

## Prop surface wear

Keep wear on the 10 cm grid. Group marks into small areas where a part gets
wet, gets handled, or makes contact with another part. Wash lower masonry
with darker tones and chip exposed edges. Show pale grain on worn timber.
Use rust on exposed steel and dark grease around service equipment. Fade
cloth on the exposed side. Keep glass, lamps, and safety marks easy to see.

Use the same palette regions and tones in the showcase and the exported
vertex colors. If a prop is near its triangle limit, put the change on an
existing band or edge. Keep the shape and placement of the prop the same.
Check the finish at eye level and in a close view under the same lights.

## Rooms and exterior routes

The Teardown courtyard screenshot shows rooms, balconies, stairs, and yard
equipment in one view. The waterfront screenshot shows the near path, the
next street, and buildings behind it. Set up the Cubix view so the player
can see the next place to go from a door or corner. [Courtyard reference](https://teardowngame.com/assets/img/screens/s7.jpg) [Waterfront reference](https://teardowngame.com/assets/img/screens/s11.jpg)

Build the whole room, including its floor, walls, and roof. Connect the
room to a side yard or another room. Leave enough space at doors for the
route to turn. Put machines, tools, and supplies near the part of the room
where people use them. Use low props near the path and taller forms behind
them. Put lights below the fixtures that hold them.

Use the approach view to show the entrance. Use a second view inside the
building to show its work area. Use a third view to show the return route.
Check these views in the showcase and confirm that the exported scene has
the same placements. The layout JSON carries the cameras and light values.

| Kit | Interior landmark | Space along the return route |
| --- | --- | --- |
| Core | Service lift and tool carts | Motor pool service yard |
| Heist | Offset press and paper handling area | Print works loading yard |
| Industrial | Charge furnace and ore bins | Smelting works tank yard |
| Security | Parcel scanner and control desks | Baggage hall service lane |
| Creatures | Survey map table and gear shelves | Lodge animal yard and creek |
| Fantasy | Bread oven and worktables | Bakehouse market yard |

## Tools, stock, and approaches

Put the tools for the current job on the work surface. Leave room around
them for the work. Place stock near the door where it comes in or goes out.
Use a floor treatment at the threshold to show where traffic changes from
walking to loading. Keep the main route clear.

Pair tools with parts at the motor pool, paper with ink at the press, and
ore with tongs at the foundry. Put trays near the scanner, samples near the
ranger map, and bread boards near the oven. Check that supplies sit on the
work surface and that the entrance and the main machine stay visible.


## Paving scale and sight lines

Use staggered joints near the edge of a paved lane. Show a few complete
stones before the joints meet the wide part of the road. Put fine chips
near large repairs and stains. Keep plain areas between marks.

Keep the entrance path clear of the nearest props. At the creek, show
the bridge deck and water from the same stop. At the terminal, continue
the road behind the canopy to the inspection yard. At the motor pool,
show the compressor bench through the side loading door.
