"""Last Light quarantine district and stadium evacuation board."""

from random import Random

from . import city_blocks as city
from . import city_landmarks as landmarks
from . import city_dressing, city_south, city_vignettes

import build_level_props as lp
import level_vehicles as vehicles
import voxchar as vk
from creature_kit import Sculpt
from level_geometry import box, span
from .common import (BODY, DARK, GLASS, GLOW, GREEN, JOINT, MARK, METAL, RUBBER, STONE,
                     WOOD, action, barricade, color_profile, create_board, floors,
                     fractured_wall, glyph, roof_bay, rubble, screen, slab)


def road_tile(seed, *, stripe=False, crosswise=False):
    shape = box(80, 3, 80, RUBBER)
    rng = Random(seed)
    patch = vk.vox('hair', 0.43)
    for x, z, w, d in ((-23, -17, 19, 29), (25, 10, 13, 35), (-28, 32, 22, 12)):
        box(w, 1, d, patch, x=x, y=2, z=z, sculpt=shape)
    for i in range(9):
        x, z = rng.randint(-29, 29), rng.randint(-30, 15)
        for j in range(rng.randint(4, 9)):
            box(1, 1, 3, DARK if j % 5 else JOINT, x=x, y=2, z=z, sculpt=shape)
            x += rng.choice((-1, 0, 1))
            z += 2
    if stripe:
        for x, lengths in ((-2, (19, 7, 26)), (1, (22, 11, 22))):
            for z, length in zip((-28, -6, 21), lengths):
                box(1, 1, length, MARK, x=x, y=2, z=z, sculpt=shape)
        for x in (-36, 36):
            box(1, 1, 69, STONE, x=x, y=2, z=0, sculpt=shape)
    if crosswise:
        shape.ops = [(z, y, x, code, paint) for x, y, z, code, paint in shape.ops]
    return shape


def upper_windows(width, *, seed=0):
    return city.tenement_windows(width, seed)


def stadium_steps(width=70, *, collapsed=False):
    shape = Sculpt()
    for row in range(8):
        z = -20 + row * 6
        height = 4 + row * 3
        box(width, height, 6, STONE, z=z, sculpt=shape)
        box(width, 1, 1, JOINT, y=height - 1, z=z + 2, sculpt=shape)
        for x in range(-width // 2 + 5, width // 2, 6):
            if x < width // 2 - 9 and (x + row * 5) % 13 < 10:
                box(4, 1, 3, BODY if row % 3 else MARK, x=x, y=height, z=z, sculpt=shape)
                box(4, 3, 1, DARK, x=x, y=height, z=z + 1, sculpt=shape)
    if collapsed:
        for row in range(1, 8):
            z = -20 + row * 6
            height = 4 + row * 3
            left = -6 - row * 2
            right = 1 + row
            shape.cut((left, right), (max(2, height-3*row), height+4), (z-3, z+2))
            box(4, 2, 5, JOINT, x=left+2, y=height-row*3, z=z, sculpt=shape)
            if row % 2:
                box(8, 1, 1, METAL, x=left+2, y=height-1, z=z, sculpt=shape)
            box(7 + row % 3, 1, 6, WOOD, x=right+7, y=height+1, z=z, sculpt=shape)
    return shape


def scoreboard():
    shape = box(62, 25, 8, DARK)
    box(56, 19, 2, RUBBER, y=4, z=4, sculpt=shape)
    glyph(shape, ('###', '..#', '###', '#..', '###'), -12, 7, 5, MARK, 2)
    glyph(shape, ('###', '#.#', '#.#', '#.#', '###'), 3, 7, 5, MARK, 2)
    for x in (-25, 25):
        box(5, 9, 2, METAL, x=x, y=5, z=5, sculpt=shape)
    return shape


def field_tile(x, z):
    shape = slab(80, 80, face=GREEN, joint=WOOD, seed=70 + x + z)
    rng = Random(109 * x + z)
    for local_z in range(-40, 40, 4):
        pz = z * 10 + local_z
        if -114 <= pz <= 43:
            center = 251 + (pz+35) // 7 + (pz+35)**2 // 2200 - x * 10
            for offset in (-8, 8):
                middle = center + offset
                left, right = max(-40, middle-2), min(39, middle+rng.randrange(2, 5))
                if left <= right:
                    shape.box((left, right), 2, (local_z, local_z+3), WOOD if rng.randrange(3) else JOINT)
    # Put chalk in the same turf cells as the grass.
    for local_z in range(-40, 40):
        pz = z * 10 + local_z
        for local_x in range(-40, 40):
            px = x * 10 + local_x
            on_boundary = ((px in (109, 315) and -130 <= pz <= 49)
                           or (pz in (-130, 49) and 109 <= px <= 315))
            center_radius = (px - 200)**2 + (pz + 40)**2
            at_midfield = (px == 200 and -130 <= pz <= 49) or 21**2 <= center_radius < 23**2
            penalty = ((px in (135, 289) and -77 <= pz <= -3)
                       or (pz in (-77, -3) and (109 <= px <= 135 or 289 <= px <= 315)))
            if (on_boundary or at_midfield or penalty) and (px + pz) % 23 != 0:
                shape.box(local_x, 2, local_z, STONE)
    return shape


def lamp_tower():
    shape = box(7, 4, 7, STONE)
    box(4, 57, 4, METAL, y=4, sculpt=shape)
    box(23, 4, 4, METAL, y=59, sculpt=shape)
    for x in (-9, -3, 3, 9):
        box(4, 5, 4, DARK, x=x, y=61, sculpt=shape)
        box(4, 3, 1, GLOW, x=x, y=62, z=2, sculpt=shape)
    return shape


def make_board():
    board = create_board('apocalypse', 'Last Light', 'Collect medicine, restore the stadium relay, and open evacuation.',
                         ('#777e75', '#384044', '#a56b48', '#5f4d3f', '#d4ac50', '#97a7aa',
                          '#a8edba', '#7eacb0', '#292c2e', '#546956'),
                         color_profile('#3c557d', '#e5ad84', '#ffcb96', strength=5.8, direction=(4.5, 3.5, -7.1)),
                         'safehouse', 'evac')
    board.environment.update(
        skyFill='#a5bddf', groundFill='#8d7774', fillIntensity=1.05, reviewSkyGradientTop=0.30
    )
    a, place = board.add, board.place
    grid = [(x, z) for x in range(-36, 37, 8) for z in range(-28, 29, 8)]
    stadium = [(x, z) for x, z in grid if x in (12, 20, 28) and z in (-12, -4, 4)]
    street = [(x, z) for x, z in grid if (x, z) not in stadium and (z in (-20, 12) or x == -4)]
    urban = [point for point in grid if point not in stadium and point not in street]
    intersections = [p for p in street if p[0] == -4 and p[1] in (-20, 12)]
    floors(board, 'Potted asphalt', road_tile(4), intersections)
    lanes = [p for p in street if p not in intersections]
    floors(board, 'Faded junction marking', road_tile(17, stripe=True, crosswise=True),
           [p for p in lanes if p[0] != -4])
    floors(board, 'Crosstown center stripe', road_tile(17, stripe=True),
           [p for p in lanes if p[0] == -4])
    floors(board, 'Cracked concrete yard', slab(80, 80, face=STONE, joint=DARK, seed=7), urban[::2])
    floors(board, 'Abandoned paving apron', slab(80, 80, face=JOINT, joint=GREEN, seed=19), urban[1::2])
    turf = (('Torn stadium turf', 'West penalty area', 'West touchline'),
            ('Painted midfield stripe', 'Midfield circle', 'Broadcast touchline'),
            ('East field corner', 'East penalty area', 'Ward touchline'))
    for x, z in stadium:
        label = turf[(x - 12) // 8][(z + 12) // 8]
        a(label, field_tile(x, z), x, z, height=-0.3)
        board.set_palette(label, skin='#c3c6ae')

    a('Pharmacy storefront', city.dispensary_front(), -24, 16.5)
    a('Enamel dispensary blade', city.blade_sign(), -20.8, 15.55, height=2.65)
    a('Broken pharmacy floorboards', city.broken_floor(), -24, 20.5, height=3.12)
    a('Pharmacy roof deck', slab(78, 80, face=DARK, joint=JOINT, seed=11), -24, 20.5, height=6.41)
    a('Pharmacy water tower', city.roof_tank(), -25.8, 21.9, height=6.71)
    a('Rear pharmacy casements', city.tenement_windows(77, 15), -24, 24.4, 2, 3.19)
    a('Dispensary strip light', city.clinic_light(), -25.1, 20.2, height=2.89)
    place('Dispensary strip light', -22.2, 22.5, 1, 2.89)
    board.light(-25.1, 2.57, 20.2, '#fff0ce', 6200, 8)
    board.light(-22.2, 2.57, 22.5, '#e5f5e8', 4200, 7)
    a('Dispensary tile floor', city.linoleum(), -24, 20.5)
    a('Rear staff door', box(24, 26, 2, GREEN), -24, 24.65)
    a('Pharmacy wall ivy', city.climbing_ivy(), -20.8, 16.24)
    place('Pharmacy wall ivy', -19.84, 21.1, 1)
    place('Pharmacy wall ivy', -27.7, 16.2, 0, 1.9)
    a('Broken brick wall', fractured_wall(78, 32, 5, holes=7, seed=13), -27.8, 20.5, 1)
    a('Rear loading doorway', fractured_wall(76, 31, 5, door=24, holes=4, seed=32), -24, 24.5)
    a('Dispensary service windows', city.dispensary_service_wall(), -20.2, 20.5, 1)
    a('Crumbling upper windows', upper_windows(77, seed=2), -24, 16.6, height=3.14)
    for x, z, turn in ((-27.7, 20.5, 1), (-20.3, 20.5, 3), (-34, -5, 0), (-28, -12, 1)):
        place('Crumbling upper windows', x, z, turn, 3.15)
    a('Pharmacy counter', lp.counter(33, 10, BODY, METAL, shelf=True), -25, 21, 2)
    a('Dispensary cash register', city.dispensary_till(), -25.9, 21.25, height=1.6)
    a('Medicine shelf', city.stocked_cabinet(), -26.1, 23.5)
    place('Medicine shelf', -21.3, 23.5)
    a('Clinic bed', lp.platform(11, 23, 8, STONE, METAL), -22.2, 21.6, 1)
    a('Shuttered shop window', fractured_wall(65, 26, 6, holes=1, seed=3), -33.8, -5)
    a('Roof parapet break', fractured_wall(49, 15, 7, holes=5, seed=6), -34, -5, height=6.4)
    a('Apartment floor slab', slab(76, 54, face=STONE, seed=4), -34, -8, height=3)
    a('Apartment roof slab', slab(76, 98, face=STONE, seed=25), -34, -10.1, height=6.1)
    a('Roof stair landing', slab(26, 24, face=METAL, seed=16), -38, -14.4, height=6.1)
    a('Apartment wall return', fractured_wall(55, 34, 6, door=21, holes=6, seed=9), -37.8, -8, 1)
    place('Apartment wall return', -30.2, -8, 1, 3.15)
    a('Apartment stair tread', box(17, 2, 4, METAL), -38.5, -6.8)
    for i in range(1, 29):
        place('Apartment stair tread', -38.5, -6.8 - i * 0.27, height=i * 0.22)
    a('Apartment rooftop vent', lp.service_pipes(), -33, -9, height=6.4)
    a('Rubble slump', rubble(39, 27, seed=11), -32, -2.4)
    a('Broken curb', barricade(44, face=JOINT, stripe=STONE), -17, 11, 1)
    a('Overgrown street rubble', rubble(30, 23, seed=16, face=GREEN), -17.8, -12.7)
    a('Split road concrete', rubble(49, 32, seed=21), -11.5, -5)
    for x, z, turn in ((-30, 23, 1), (-20, -14, 0), (-8, 16, 2), (8, 21, 3), (34, 19, 1),
                       (-12, -26, 1), (35, -25, 2), (-24, 9, 0), (6, -22, 3)):
        place('Rubble slump', x, z, turn)
    a('Quarantine chain fence', screen(60, 24), -2.4, 16)
    a('Triage gate header', city.triage_portal(), 2.1, 16)
    for x, z, turn in ((6.6, 16, 0), (-4, 19, 1), (8, 19, 1), (-4, 25, 1), (8, 25, 1), (2, 28, 2)):
        place('Quarantine chain fence', x, z, turn)
    a('Concrete checkpoint barrier', barricade(35), -2.5, 12.5)
    for x, z, turn in ((5, 12.5, 2), (8, 5.5, 1), (32.7, 15, 1), (34, -15, 2), (-12.5, -14, 1)):
        place('Concrete checkpoint barrier', x, z, turn)
    a('Quarantine canopy', city.intake_tent(), 1.7, 21.5)
    a('Field wash station', lp.case(22, 18, 13, STONE, BODY), 4.4, 20, 3)
    a('Checkpoint gate motor', lp.case(16, 15, 11, METAL, BODY, screen=True), 4.6, 16.6, 1)
    a('Inspection desk', lp.counter(23, 13, DARK, STONE), -0.9, 21, 2)
    a('Intake lockers', lp.case(25, 25, 10, METAL, GREEN), -2.9, 24, 1)
    a('Supply tent', city.intake_tent(), -9, 6, 1)
    a('Hospital cots', lp.platform(19, 27, 6, STONE, METAL), -10.2, 5.2)
    place('Hospital cots', -7.8, 7)
    a('Service culvert mouth', lp.deep_arch(43, 28, 15, 30, JOINT, METAL), -8, -7)
    a('Service vault wall', fractured_wall(53, 27, 5, door=25, holes=3, seed=42), -7.9, -12, 2)
    a('Service vault roof', slab(55, 56, face=JOINT, seed=3), -7.9, -9.5, height=2.7)
    for x, z, turn in ((-10.6, -9.5, 1), (-5.3, -9.5, 3)):
        place('Service vault wall', x, z, turn)
    a('Utility shutoff panel', lp.case(15, 19, 11, DARK, METAL, screen=True), -10.2, -9.4, 1)
    a('Cracked grandstand bay', stadium_steps(), 13, -15.6, 2)
    for x, z, turn in ((27, -15.6, 2), (13, 11.8, 0), (32.7, -1, 1), (32.7, 6, 1)):
        place('Cracked grandstand bay', x, z, turn)
    a('Collapsed spectator terrace', stadium_steps(collapsed=True), 20, -15.6, 2)
    place('Collapsed spectator terrace', 32.7, -8, 1)
    place('Collapsed spectator terrace', 20, 11.8, 0)
    place('Rubble slump', 19.4, -12.4, 1)
    a('Bent training goal', landmarks.collapsed_goal(), 13.4, -11.4, 2)
    a('Grandstand exit aisle', stadium_steps(46), 25.7, 11.8)
    a('Stadium vomitory', lp.deep_arch(76, 42, 18, 30, STONE, BODY), 8, -3.6, 1)
    a('Stadium ticket bay', lp.booth(), 6.1, -0.6, 3)
    a('Cracked stadium roof frame', city.cantilever(), 20, -17.1)
    place('Cracked stadium roof frame', 27, -17.1)
    a('Stadium scoreboard', scoreboard(), 16.2, -19.3, height=6.5)
    a('Stadium floodlights', city.lattice_lights(), 30, -17, 2)
    for x, z, turn in ((30, 11, 2), (10, 11, 2)):
        place('Stadium floodlights', x, z, turn)
    a('Sheared light tower', landmarks.broken_pylon(), 10, -17)
    a('Team sideline bench', lp.bench(32, BODY), 15.4, 6.7)
    place('Team sideline bench', 18.7, 6.7)
    a('Team equipment cage', screen(32, 20), 21.5, 6.3)
    a('Portable relay mast', lamp_tower(), 27.5, 6.6, 3)
    a('Portable generator', lp.case(21, 14, 15, BODY, METAL, screen=True), 27.9, 8.8, 2)
    a('Broadcast trailer steps', lp.step_run(14, 3, 9, METAL, MARK), 26.3, 11.5, 2)
    a('Esplanade brick planter', lp.crate(35, 8, 15, STONE, GREEN), 16.8, 24.6, 1)
    a('Quarantine warning lamp', lp.post(18, DARK, GLOW, arm=True), 4, 15.7)
    for x, z in ((-4, -7), (6.5, -1.8), (26, 9.5), (33, 20), (30, 26)):
        place('Quarantine warning lamp', x, z)
        board.light(x, 2.7, z, '#bde9ba', 18, 7)
    board.light(20, 7, -16, '#eee2c1', 90, 15)
    board.light(24, 7, 11, '#eee2c1', 90, 15)

    pickup = board.vehicle('Salvage pickup', 'utility', vehicles.pickup(), -22.5, -1.8, 1, primary='#8a5b40')
    van = board.vehicle('Ambulance van', 'medical', vehicles.panel_van(), -1.2, 24.7, 2, primary='#b9b5a3', detail='#8c4f42')
    cars = board.vehicle('Abandoned hatchback', 'civilian', vehicles.hatchback(), -12.2, 12.4, 1, primary='#66716b')
    board.place('Abandoned hatchback', 13.9, -22.6, 1)
    board.place('Abandoned hatchback', -23.4, -18.5, 3)
    board.place('Abandoned hatchback', 14.4, 22.8, 2)
    truck = board.vehicle('Evacuation truck', 'transport', vehicles.pickup(ranger=True), 34.4, 22, 2, primary='#78825b')
    board.vehicle('Stadium forklift', 'cargo', vehicles.forklift(), 11.3, -22.8, 1, primary='#9a794b')

    a('Brick warehouse loading bay', fractured_wall(83, 37, 6, door=30, holes=3, seed=11), -20, -23)
    a('Brick warehouse return', fractured_wall(65, 38, 6, door=22, holes=3, seed=8), -24.1, -26.1, 1)
    a('Warehouse corrugated roof', lp.pitched_roof(84, 68, DARK, METAL), -20, -26.3, height=3.7)
    for x, z in ((-8, -26), (-30, -26)):
        place('Brick warehouse loading bay', x, z + 3)
        place('Brick warehouse return', x - 4.1, z, 1)
        place('Brick warehouse return', x + 4.1, z, 3)
    a('Clerestory shop roof', landmarks.sawtooth_roof(), -8, -26, height=3.7)
    a('Stripped warehouse rafters', landmarks.broken_roof(), -30, -26, height=3.7)
    a('Collapsed terrace stair', lp.step_run(23, 3, 14, STONE, JOINT), -17.7, -26.8, 1)
    a('Bricked apartment lower storey', fractured_wall(69, 33, 6, door=22, holes=5, seed=25), -31, 10)
    a('Apartment upper brick bay', upper_windows(68, seed=29), -31, 10, height=3.13)
    a('Slumped apartment roof', lp.pitched_roof(72, 63, DARK, METAL), -31, 12.8, height=6.3)
    a('Concrete apartment side wall', fractured_wall(61, 33, 6, door=21, holes=3, seed=51), -34.5, 13, 1)
    for x, z in ((-31, 11.6), (-13, 23.7)):
        if (x, z) != (-31, 11.6):
            place('Bricked apartment lower storey', x, z - 2.8)
            place('Apartment upper brick bay', x, z - 2.8, height=3.13)
            a('Slate mansard and dormers', landmarks.mansard(), x, z, height=6.3)
        place('Concrete apartment side wall', x + 3.5, z, 3)
        place('Concrete apartment side wall', x, z + 3, 2)
        place('Medicine shelf', x - 1.2, z + 2.5, 2)
        place('Rubble slump', x + 1.6, z - 2.1, 2)
    a('Stadium service concession', fractured_wall(74, 28, 4, door=24, holes=4, seed=49), 21.9, -24.8)
    a('Service concession canopy', roof_bay(74, 38, 29, face=BODY), 21.9, -26.4)
    place('Stadium service concession', 30.2, -24.8)
    place('Service concession canopy', 30.2, -26.4, 2)
    a('Torn safety awning', lp.awning(), -26.7, 15.55)
    a('Chain-link dumpster cage', screen(36, 19, frame=DARK), -29, 3.8, 1)
    a('Sidewalk container', lp.latched_case(29, 14, 19, GREEN, METAL, MARK), -28, 3.5)
    a('Torn street light', lp.post(38, METAL, GLOW, arm=True), -15.3, 15.4)
    for x, z, turn in ((-29.8, -18.7, 1), (-20.8, -17.8, 3), (-12, 14, 0), (-1.2, 8.7, 0),
                       (9.8, 12.6, 3), (34.2, -23.9, 3), (33.8, 19.5, 0), (35.6, 25.5, 2)):
        place('Torn street light', x, z, turn)
    a('Sapling in cracked pavement', city.street_tree(8), -33.9, 17.2)
    for x, z, turn in ((-36.5, 20.2, 0), (-27, 1.8, 1),
                       (-28, -22.7, 1), (-4.8, 29, 1), (8.8, 22.1, 3), (17.5, 23.6, 2),
                       (37.6, 12.8, 3), (36.6, 28.5, 2)):
        place('Sapling in cracked pavement', x, z, turn)
    a('Lightning-struck elm', landmarks.dead_elm(), -32, 5)
    for x, z, turn in ((-20, -13.5, 0), (34.3, -13.7, 1), (22.7, 28.7, 3)):
        place('Lightning-struck elm', x, z, turn)
    a('Pharmacy iron escape', landmarks.fire_escape(), -19.5, 20.2, 3, 1.45)
    a('District boiler chimney', landmarks.brick_chimney(), 34, -26.7)
    a('Abandoned concrete drain', lp.drainage_grate(), -32.5, 1.3)
    for x, z, turn in ((-25, 10.2, 3), (-18.2, 8.2, 1), (4.9, -14.3, 0),
                       (30.2, 14.5, 1), (34.1, 26.9, 1)):
        place('Abandoned concrete drain', x, z, turn)

    # Return the upper walls to the back of each housing block.
    for x, z in ((-31, 12.8), (-13, 23.7)):
        place('Apartment upper brick bay', x, z+3, 2, 3.13)
        for side, turn in ((-3.4, 1), (3.4, 3)):
            place('Apartment upper brick bay', x+side, z, turn, 3.13)

    for x in (-8, -20, -30):
        place('Brick warehouse loading bay', x, -29.3, 2)
        place('Medicine shelf', x-2.3, -28.4, 2)
        place('Sidewalk container', x+1.8, -27.8, 1)
    place('Brick warehouse return', -15.9, -26.1, 3)

    a('Housing block cistern', city.roof_tank(), -35.3, 29.6, height=6.85)
    a('Staff service wing', city.staff_wing_bay(), -20.1, 25.3)
    for x, stories in ((-20.1, 3), (-27.4, 2), (-34.7, 2)):
        for h in (0, 3.3, 6.6)[:stories]:
            if (x, h) != (-20.1, 0):
                place('Staff service wing', x, 25.3, 0, h)
            place('Staff service wing', x, 32.4, 2, h)
        place('Pharmacy roof deck', x, 28.85, 0, stories*3.3-0.05)
    for x, heights in ((-38.2, (0, 3.3)), (-16.5, (0, 3.3, 6.6)), (-23.7, (6.6,))):
        for h in heights:
            place('Staff service wing', x, 28.85, 1, h)
    a('Iron tenement balcony', city.balcony(), -31.5, 9.25, height=3.33)
    place('Iron tenement balcony', -12.1, 20.15, 0, 3.33)
    a('Rio cinema auditorium', landmarks.picture_house(), 12, 25)
    a('Cinema ticket lobby', landmarks.cinema_entrance(), 12, 21.7)
    a('Rio illuminated marquee', landmarks.marquee(), 12, 20.8, height=2.65)
    a('Rio neon pylon', landmarks.cinema_pylon(), 12, 21.55, height=3.6)
    board.light(12, 2.4, 20.75, '#ffbf71', 1250, 6)
    a('Burned repair workshop', landmarks.burned_workshop(), 24, 24.7)
    place('Rubble slump', 21.3, 22.1)
    place('Sidewalk container', 26.2, 24.9, 1)
    place('Inspection desk', 24.6, 25.8)
    place('Pharmacy wall ivy', 20.5, 25.7, 3)
    a('Esplanade bus shelter', landmarks.bus_shelter(), 18.6, 20.4, 1)
    a('Stadium press cabin', city.press_box(), 25.1, -18, height=4.94)
    a('Scoreboard gantry', roof_bay(58, 15, 64, face=DARK), 16.2, -19.3)
    a('Raised curb and footway', city.sidewalk(27), -24, 15.1)
    for x, z, turn in ((-32, 15.1, 0), (-16, 15.1, 0), (-8, 15.1, 0),
                       (-24, -16.3, 2), (-32, -16.3, 2), (-16, -16.3, 2),
                       (32, 16.8, 2), (24, 16.8, 2), (16, 16.8, 2)):
        place('Raised curb and footway', x, z, turn)
    a('Fireweed and dock', city.verge(19), -21.2, 15.3)
    for x, z, turn in ((-27.6, 15.4, 0), (-29.6, 14.8, 0), (-17.1, 15.9, 0), (-19.5, 12.6, 1),
                       (-32.5, -16.2, 0), (-23.8, -15.7, 0), (-6.3, 16.1, 0), (7.3, 17.2, 1),
                       (9.3, 20.3, 1), (16, 16.8, 0), (23.2, 17.2, 0), (35.1, 16.8, 0),
                       (29.7, -12.7, 1), (30.6, -4, 1), (12.4, -13.1, 0), (-36.3, 10.3, 0)):
        place('Fireweed and dock', x, z, turn)
    a('Quarantine field ward', city.intake_tent(), 27.4, -6.9, 1)
    a('Mobile triage clinic', landmarks.relay_clinic(), 27.5, -0.7, 1)
    for x, z in ((27.7, -8.1), (27.7, -5.6), (27.7, -0.6)):
        place('Hospital cots', x, z, 1)
    a('Stadium medical pallet', lp.pallet(18, 22, WOOD, DARK), 24.4, -8.8)
    place('Stadium medical pallet', 24.4, -8.8, 0, 0.35)
    place('Intake lockers', 26.3, -10.8, 2)
    place('Inspection desk', 26.6, 2.6, 0)
    a('Stadium service enclosure', screen(58, 25), 28.5, -11.5)
    place('Stadium service enclosure', 30.7, -8.6, 1)
    place('Stadium service enclosure', 30.7, -2.8, 1)
    place('Quarantine warning lamp', 25.2, -4)
    board.light(26, 2.3, -6.9, '#fff3c7', 80, 6)

    for label in ('Pharmacy storefront', 'Enamel dispensary blade', 'Medicine shelf'):
        board.set_palette(label, detail='#3a8276', skin='#eee1bf', leather='#ba7953', visor='#92abb1')
    for label in ('Crumbling upper windows', 'Rear pharmacy casements', 'Apartment upper brick bay', 'Staff service wing'):
        board.set_palette(label, primary='#c98963', skin='#dcc9a4', leather='#975d46', detail='#577b72')
    for label in ('Sapling in cracked pavement', 'Fireweed and dock', 'Pharmacy wall ivy'):
        board.set_palette(label, primary='#879450', secondary='#455a3a', detail='#627d43', trim='#bda56d')
    for label in ('Quarantine canopy', 'Supply tent', 'Quarantine field ward'):
        board.set_palette(label, skin='#ccbf99', detail='#66785f')
    for label in ('Cracked grandstand bay', 'Grandstand exit aisle', 'Collapsed spectator terrace'):
        board.set_palette(label, primary='#638f88', secondary='#455b57', trim='#c3ab75', skin='#a59787')
    board.set_palette('Cracked stadium roof frame', detail='#788f89', primary='#986b50')
    board.set_palette('Staff service wing', primary='#b29e80', skin='#bcaf94', visor='#365058', leather='#5a5852')
    board.set_palette('Stadium press cabin', detail='#637f79', metal='#a09f92', visor='#607f85')
    board.set_palette('Dispensary service windows', skin='#bfb29a', detail='#468679', leather='#a56a4c')
    board.set_palette('Dispensary tile floor', skin='#bcb8a1', detail='#829289')
    board.set_palette('Pharmacy counter', primary='#557b70', metal='#c4c1aa')
    board.set_palette('Rear staff door', detail='#4a7568')
    board.set_palette('Triage gate header', detail='#54766e', skin='#f2e7ce')
    board.set_palette('Brick warehouse loading bay', skin='#b88d72', secondary='#8c7260', metal='#837c6c')
    board.set_palette('Brick warehouse return', skin='#b88d72', secondary='#8c7260')
    board.set_palette('Warehouse corrugated roof', secondary='#786558', metal='#a8a292')
    for label in ('Faded junction marking', 'Crosstown center stripe'):
        board.set_palette(label, hair='#52565a', trim='#c8ad71', skin='#a7a69a')
    board.set_palette('Potted asphalt', hair='#52565a')
    board.set_palette('Raised curb and footway', skin='#b9b1a0', metal='#a3a097')
    board.set_palette('Stadium floodlights', accent='#ffe3a3', metal='#989389')
    board.set_palette('Slumped apartment roof', secondary='#71584e', metal='#918d7f')

    for label in ('Rio cinema auditorium', 'Cinema ticket lobby', 'Rio illuminated marquee', 'Rio neon pylon'):
        board.set_palette(label, primary='#a35440', skin='#e3c7a3', detail='#41817c', metal='#997549',
                          trim='#e9ac64', accent='#ffb36f', visor='#638c8d')
    board.set_palette('District boiler chimney', primary='#ab6d52', skin='#d6bda1', secondary='#624f43')
    board.set_palette('Lightning-struck elm', leather='#7a6a56', primary='#b1a17b')
    board.set_palette('Pharmacy iron escape', metal='#687570', secondary='#504f48', leather='#956d51')
    board.set_palette('Burned repair workshop', primary='#955747', skin='#a39075', hair='#39342f', detail='#66584f')
    board.set_palette('Clerestory shop roof', detail='#657777', metal='#9b9a87', visor='#8aadb0')
    board.set_palette('Slate mansard and dormers', secondary='#455e68', metal='#687976')
    board.set_palette('Collapsed spectator terrace', leather='#ad6d51')
    board.set_palette('Mobile triage clinic', skin='#d5cfb5', primary='#a65348', detail='#697e75')

    city_south.scene(board)
    city_dressing.block_frontage(board)
    city_dressing.street_fittings(board)
    city_dressing.checkpoint_and_stadium(board)
    city_vignettes.scene(board)

    board.point('safehouse', 'Apartment safehouse', -32, -9, actions=(
        action('player-spawn'), action('loadout', assets=('crowbar', 'flashlight', 'respirator'))))
    board.point('rooftop', 'Apartment rooftop', -34, -9, y=6.4, actions=(
        action('scout', assets=('binoculars',), reward='back_alley_seen'),))
    board.point('pharmacy', 'Pharmacy', -24, 19.7, actions=(
        action('loot', assets=('medical_kit',), reward='medicine'),
        action('encounter', assets=('shambler',), activation='on-entry')))
    board.point('quarantine', 'Quarantine checkpoint', 1.7, 19, actions=(
        action('treat', assets=('field_medic', van), requires=('medicine',), reward='gate_pass'),
        action('unlock', assets=(board.prop_id('Checkpoint gate motor'),), requires=('gate_pass',), reward='gate_open')))
    board.point('alley', 'Salvage alley', -17, -0.5, actions=(
        action('loot', assets=('pump_shotgun', 'shell_box', pickup, cars), reward='toolkit'),
        action('encounter', assets=('runner',))))
    board.point('culvert', 'Utility culvert', -7.9, -9.3, actions=(
        action('activate', assets=(board.prop_id('Utility shutoff panel'),), requires=('toolkit',), reward='service_bypass'),
        action('pickup', assets=('bolt_cutters',))))
    board.point('stadium', 'Stadium pitch', 18, -4, radius=5, actions=(
        action('wave', assets=('shambler', 'runner', 'armored_infected'), waves=[3, 5, 7], reward='pitch_clear'),
        action('resupply', assets=('field_rations', 'fuse_pack'), reward='relay_fuse')))
    board.point('relay', 'Stadium broadcast relay', 26, 7.6, actions=(
        action('restore', assets=(board.prop_id('Portable generator'), 'fuse_pack'),
               requires=('pitch_clear', 'relay_fuse'), reward='evac_signal'),))
    board.point('evac', 'Evacuation lane', 31, 23.3, actions=(
        action('extract', requires=('evac_signal',), assets=(truck,)),))
    board.link('safehouse', 'rooftop', [-35, 0, -6.6], [-38.5, 0, -6.8], [-38.5, 6.4, -14.4],
               [-35, 6.4, -10], traversal='stairs')
    board.link('safehouse', 'alley', [-28, 0, -1], [-22, 0, -0.5])
    board.link('alley', 'pharmacy', [-18.5, 0, 8], [-24, 0, 14], [-24, 0, 17.6])
    board.link('rooftop', 'pharmacy', [-34, 6.4, -5.6], [-34, 0, -3.8], [-24, 0, 14],
               [-24, 0, 17.6], requires=('back_alley_seen',), traversal='drop')
    board.link('pharmacy', 'quarantine', [-24, 0, 14.2], [1.7, 0, 14.2])
    board.link('alley', 'culvert', [-8, 0, -5.3])
    board.link('quarantine', 'stadium', [1.7, 0, 11], [3.5, 0, -3.6], [10, 0, -3.6],
               requires=('gate_open',))
    board.link('culvert', 'stadium', [-7.9, 0, -13.9], [-3.6, 0, -14.5], [4, 0, -10], [6, 0, -3.6], [10, 0, -3.6],
               requires=('service_bypass',))
    board.link('stadium', 'relay', [25.9, 0, 5.1])
    board.link('relay', 'evac', [29.2, 0, 7.6], [29.2, 0, 14.7], [31.5, 0, 16.3], requires=('evac_signal',))
    city_south.gameplay(board)
    board.shot('Board overview', [101, 107, 43], [0, 0, -32])
    board.shot('Last Light perimeter', [8.95, 5.4, 1.75], [0.4, 2.88, 17.4])
    board.shot('Treatment yard decks', [5.02, 2.43, 27.45], [3.10, 1.47, 21.46])
    board.shot('Ambulance inspection lane', [4.4, 3.55, 4.45], [1.45, 2.35, 16.85])
    board.shot('Quarantine intake overlook', [5.1, 5.3, 6.5], [1.7, 2.9, 19.3])
    board.shot('Quarantine lane', [2.55, 1.7, 11.6], [1.0, 1.6, 21.9])
    board.shot('Stadium relief perimeter', [9.7, 4.2, 8.6], [22, 1.4, -10.3])
    board.shot('Stadium bowl', [11.6, 2.3, 5.2], [23.6, 2, -11])
    board.shot('Pharmacy street', [-17.8, 1.73, 9.9], [-24.3, 2.95, 19.0])
    board.shot('Dispensary interior', [-26.7, 1.65, 18.5], [-23.4, 1.55, 22.9])
    board.shot('Burned service lane', [28.8, 1.72, 16.8], [21.4, 2.58, 24.1])
    board.shot('Rio esplanade', [19.4, 1.7, 14.9], [13.6, 3.65, 23.4])
    board.shot('South Line interchange', [-13.1, 1.72, -38.6], [-24, 2.3, -48.9])
    board.shot('Municipal waterworks', [26.0, 1.75, -60.6], [26.8, 2.9, -76])
    board.shot('Winter garden', [-14.05, 1.67, -72.7], [-14.4, 1.26, -78.8])
    board.shot('Ration market', [-0.5, 1.71, -81.8], [0.3, 1.75, -91.6])
    board.shot('Safehouse bunks', [-31.7, 1.65, -9.6], [-35.1, 1.38, -12.9])
    return board
