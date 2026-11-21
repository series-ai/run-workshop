"""Build the smelting works and the baggage hall.

Sculpt dimensions use 10 cm cells. Site placements use metres.
"""

from level_geometry import box


def gallery(g, steel, edge, *, rear_rail=True):
    deck = box(40, 3, 21, steel, y=27)
    for x in (-17, 16):
        for z in (-8, 8):
            box(3, 27, 3, g.DARK, x=x, z=z, sculpt=deck)
            box(5, 2, 5, g.METAL, x=x, z=z, sculpt=deck)
        if rear_rail:
            box(3, 11, 2, edge, x=x, y=30, z=-9, sculpt=deck)
    if rear_rail:
        for y in (34, 40):
            box(40, 1, 2, edge, y=y, z=-9, sculpt=deck)
    if not rear_rail:
        box(11, 1, 7, g.METAL, x=2, y=29, sculpt=deck)
        box(5, 1, 1, g.DARK, x=2, y=29, z=1, sculpt=deck)
        for x in (-13, 13):
            box(1, 1, 18, g.PATINA, x=x, y=29, sculpt=deck)
    box(40, 3, 2, edge, y=26, z=9, sculpt=deck)
    return deck


def stairs(g, edge):
    stair = box(15, 1, 2, g.METAL)
    for step in range(1, 15):
        y, z = step, -step * 2
        box(15, y + 1, 2, g.METAL, z=z, sculpt=stair)
        box(1, 2, 3, edge, x=-7, y=y + 9, z=z, sculpt=stair)
        if step in (1, 7, 14):
            box(1, 10, 1, edge, x=-7, y=y, z=z, sculpt=stair)
    return stair


def stair_bearers(g):
    base = box(14, 2, 29, g.MASONRY)
    for x in (-5, 5):
        box(2, 13, 29, g.DARK, x=x, y=2, sculpt=base)
    for z in (-12, 11):
        box(12, 2, 2, g.METAL, y=13, z=z, sculpt=base)
    return base


def dispatch_cabin(g):
    cabin = box(32, 2, 23, g.MASONRY)
    box(32, 23, 2, g.BODY, y=2, z=-10, sculpt=cabin)
    for x in (-15, 14):
        box(2, 10, 22, g.BODY, x=x, y=2, sculpt=cabin)
        for z in (-9, 0, 9):
            box(2, 13, 2, g.CAP, x=x, y=12, z=z, sculpt=cabin)
    box(20, 10, 2, g.BODY, x=5, y=2, z=10, sculpt=cabin)
    for x in (-5, 4, 14):
        box(2, 13, 2, g.CAP, x=x, y=12, z=10, sculpt=cabin)
    box(34, 3, 25, g.CAP, y=25, sculpt=cabin)
    return cabin


def charge_bin(g):
    shape = box(9, 4, 9, g.DARK, y=19)
    for step in range(3):
        width = 13 + 8 * step
        box(width, 5, width, g.BODY, y=23 + 5 * step, sculpt=shape)
    box(32, 8, 32, g.METAL, y=38, sculpt=shape)
    shape.cut((-13, 12), (40, 46), (-13, 12))
    for x in (-13, 12):
        for z in (-13, 12):
            box(3, 38, 3, g.DARK, x=x, z=z, sculpt=shape)
    box(31, 3, 31, g.DARK, y=37, sculpt=shape)
    return shape


def rails(g):
    track = box(17, 1, 40, g.GRIT)
    for z in (-16, -6, 4, 14):
        box(17, 1, 3, g.WOOD, y=1, z=z, sculpt=track)
    for x in (-7, 6):
        box(2, 2, 40, g.METAL, x=x, y=2, sculpt=track)
    return track


def rail_crossing(g):
    crossing = box(36, 1, 17, g.GRIT)
    for y, width in ((1, 30), (2, 24), (3, 18)):
        box(width, 1, 17, g.WOOD, y=y, sculpt=crossing)
    return crossing


def transfer_car(g):
    car = box(18, 3, 23, g.DARK, y=4)
    for x in (-7, 6):
        for z in (-8, 7):
            box(3, 5, 5, g.RUBBER, x=x, z=z, sculpt=car)
    for step in range(4):
        size = 11 + 2 * step
        box(size, 3, size, g.PATINA, y=7 + step * 3, sculpt=car)
    box(13, 1, 13, g.MARK, y=19, sculpt=car)
    box(5, 1, 7, g.LAMP, x=-2, y=20, sculpt=car)
    return car


def landing_lever(g):
    lever = box(10, 2, 9, g.MASONRY)
    box(6, 6, 6, g.METAL, y=2, sculpt=lever)
    box(3, 7, 3, g.DARK, y=7, sculpt=lever)
    box(2, 5, 2, g.METAL, x=1, y=13, sculpt=lever)
    box(4, 2, 3, g.MARK, x=1, y=18, sculpt=lever)
    return lever


def gas_main(g):
    duct = box(40, 8, 8, g.PATINA)
    for x in (-18, 0, 17):
        box(2, 10, 10, g.METAL, x=x, sculpt=duct)
    return duct


def gas_trestle(g):
    frame = box(20, 3, 5, g.BODY, y=48)
    for x in (-8, 7):
        box(3, 48, 3, g.BODY, x=x, sculpt=frame)
        box(6, 3, 6, g.MASONRY, x=x, sculpt=frame)
    for step in range(6):
        box(4, 4, 2, g.DARK, x=-7 + step * 2, y=31 + 3 * step, sculpt=frame)
    return frame


def stack(g):
    tower = box(18, 5, 18, g.MASONRY)
    for y, width, height, face in (
        (5, 13, 21, g.BODY),
        (26, 11, 24, g.PATINA),
        (50, 9, 28, g.BODY),
        (78, 9, 4, g.CAP),
        (82, 9, 6, g.DETAIL),
        (88, 11, 2, g.DARK),
    ):
        box(width, height, width, face, y=y, sculpt=tower)
    tower.cut((-2, 2), (85, 90), (-2, 2))
    return tower


def ladle_hood(g):
    hood = box(29, 3, 24, g.DARK)
    for i in range(4):
        box(27 - 4 * i, 4, 22 - 3 * i, g.PATINA, y=3 + 4 * i, sculpt=hood)
    box(11, 4, 11, g.METAL, y=19, sculpt=hood)
    return hood


def ore_stockpile(g):
    pile = box(42, 3, 38, g.SOIL)
    for x, z, w, d, y in (
        (-3, -1, 35, 34, 3),
        (4, 1, 28, 25, 6),
        (0, -3, 23, 21, 9),
        (-3, -4, 18, 14, 12),
        (-5, -3, 12, 9, 15),
        (-5, -2, 6, 5, 18),
    ):
        box(w, 3, d, g.GRIT if y in (9, 15) else g.SOIL, x=x, y=y, z=z, sculpt=pile)
    return pile


def bunker_wall(g):
    wall = box(40, 34, 5, g.MASONRY)
    for x in (-16, 14):
        box(4, 26, 8, g.PATINA, x=x, sculpt=wall)
    box(40, 2, 5, g.PATINA, y=32, sculpt=wall)
    return wall


def crane_column(g):
    leg = box(10, 4, 10, g.MASONRY)
    for x in (-3, 3):
        box(2, 57, 5, g.BODY, x=x, y=4, sculpt=leg)
    for x in (-4, 3):
        for z in (-4, 3):
            box(2, 2, 2, g.METAL, x=x, y=4, z=z, sculpt=leg)
    box(5, 57, 2, g.BODY, y=4, sculpt=leg)
    box(10, 2, 8, g.METAL, y=4, sculpt=leg)
    for side in (-1, 1):
        for step in range(3):
            box(2, 8 - 2 * step, 2, g.DARK, x=side * (2 + step), y=6, sculpt=leg)
        box(3, 9, 1, g.METAL, x=side * 3, y=13, z=3, sculpt=leg)
        for y in (14, 19):
            box(1, 1, 1, g.DARK, x=side * 3, y=y, z=4, sculpt=leg)
    box(12, 3, 10, g.DARK, y=61, sculpt=leg)
    box(12, 2, 7, g.METAL, y=64, sculpt=leg)
    return leg


def crane_rail(g):
    rail = box(48, 2, 5, g.PATINA)
    box(48, 5, 2, g.BODY, y=2, sculpt=rail)
    box(48, 2, 5, g.BODY, y=7, sculpt=rail)
    box(48, 1, 2, g.METAL, y=8, sculpt=rail)
    for x in (-18, 0, 17):
        box(3, 3, 4, g.DARK, x=x, y=2, sculpt=rail)
    return rail


def crane_bridge(g):
    bridge = box(58, 2, 8, g.MARK)
    for step in range(6):
        for x in (-20, 0, 20):
            box(3, 3, 3, g.BODY, x=x - 5 + step * 2, y=2 + step, sculpt=bridge)
    box(58, 2, 8, g.MARK, y=10, sculpt=bridge)
    for x in (-27, 26):
        box(3, 9, 8, g.BODY, x=x, y=2, sculpt=bridge)
    return bridge


def hook_block(g):
    hook = box(3, 6, 4, g.METAL)
    box(6, 2, 4, g.METAL, x=2, sculpt=hook)
    box(2, 3, 4, g.METAL, x=4, y=1, sculpt=hook)
    box(9, 6, 7, g.MARK, y=6, sculpt=hook)
    for x in (-3, 3):
        box(1, 16, 1, g.RUBBER, x=x, y=12, sculpt=hook)
    box(12, 4, 9, g.DARK, y=28, sculpt=hook)
    for x in (-3, 3):
        box(1, 14, 1, g.RUBBER, x=x, y=31, sculpt=hook)
    return hook


def rolled_sheet(g):
    coil = box(22, 3, 15, g.WOOD)
    for x in (-7, 7):
        box(5, 3, 13, g.BODY, x=x, y=3, sculpt=coil)
    for y, w, h in ((4, 10, 2), (6, 16, 3), (9, 20, 8), (17, 16, 3), (20, 10, 2)):
        box(w, h, 12, g.METAL, y=y, sculpt=coil)
    coil.cut((-3, 2), (10, 15), (-7, 7))
    for z in (-5, 4):
        box(15, 1, 1, g.DARK, y=19, z=z, sculpt=coil)
        box(9, 1, 1, g.DARK, y=21, z=z, sculpt=coil)
    return coil


def crane_yard(kit, g):
    kit.add('Runway stanchion', crane_column(g), 1.6, 1.6)
    for x, z in ((1.6, 6.4), (7.2, 1.6), (7.2, 6.4)):
        kit.place('Runway stanchion', x, z)
    kit.add('Crane runway', crane_rail(g), 1.6, 4, 1, height=6.6)
    kit.place('Crane runway', 7.2, 4, 1, height=6.6)
    kit.add('Travelling bridge beam', crane_bridge(g), 4.4, 3.1, height=7.5)
    kit.place('Travelling bridge beam', 4.4, 4.1, height=7.5)
    kit.add('Travelling hook block', hook_block(g), 4.3, 3.55, height=4.55)


def tank_frame(g):
    frame = box(28, 3, 6, g.DARK, y=48)
    for x in (-12, 11):
        box(3, 48, 4, g.METAL, x=x, sculpt=frame)
        box(7, 3, 8, g.MASONRY, x=x, sculpt=frame)
    for step in range(8):
        box(4, 4, 2, g.BODY, x=-11 + 3 * step, y=12 + 4 * step, sculpt=frame)
    box(25, 2, 4, g.DARK, y=10, sculpt=frame)
    return frame


def octagonal_section(shape, width, height, y, shade):
    bevel = width // 5
    box(width - 2 * bevel, height, width, shade, y=y, sculpt=shape)
    box(width, height, width - 2 * bevel, shade, y=y, sculpt=shape)
    inner = width - bevel
    box(inner, height, inner, shade, y=y, sculpt=shape)


def water_tank(g):
    shape = box(20, 2, 20, g.DARK)
    for width, y, h, shade in (
        (27, 2, 5, g.BODY),
        (35, 7, 23, g.BODY),
    ):
        octagonal_section(shape, width, h, y, shade)
    box(3, 17, 2, g.METAL, x=2, y=10, z=17, sculpt=shape)
    box(1, 13, 1, g.LIGHT, x=2, y=12, z=18, sculpt=shape)
    for y in (10, 25):
        box(5, 2, 3, g.DARK, x=2, y=y, z=17, sculpt=shape)
    return shape


def tank_service_ladder(g):
    ladder = box(8, 2, 3, g.DARK)
    for x in (-3, 3):
        box(1, 39, 2, g.METAL, x=x, y=1, sculpt=ladder)
        for y in (8, 35):
            box(2, 2, 6, g.DARK, x=x, y=y, z=-2, sculpt=ladder)
    for y in range(4, 40, 4):
        box(5, 1, 1, g.METAL, y=y, sculpt=ladder)
    return ladder


def tank_cap(g):
    lid = box(28, 2, 28, g.CAP)
    octagonal_section(lid, 37, 2, 0, g.METAL)
    octagonal_section(lid, 23, 2, 2, g.CAP)
    box(13, 2, 13, g.CAP, y=4, sculpt=lid)
    box(6, 3, 6, g.DARK, y=6, sculpt=lid)
    return lid


def ladder_landing(g):
    landing = box(12, 2, 10, g.METAL)
    for x in (-5, 5):
        box(2, 10, 2, g.DARK, x=x, y=2, z=4, sculpt=landing)
        box(2, 6, 2, g.MARK, x=x, y=10, z=4, sculpt=landing)
    for z in (-2, 1, 4):
        box(10, 1, 1, g.DARK, y=1, z=z, sculpt=landing)
    return landing


def riser(g):
    pipe = box(6, 55, 6, g.BODY)
    for y in (2, 20, 36, 52):
        box(8, 2, 8, g.METAL, y=y, sculpt=pipe)
    box(12, 5, 6, g.BODY, x=3, y=5, sculpt=pipe)
    box(2, 8, 8, g.DETAIL, x=10, y=4, sculpt=pipe)
    return pipe


def pump_skid(g):
    skid = box(23, 2, 12, g.DARK)
    for x in (-7, 6):
        box(6, 2, 8, g.METAL, x=x, y=2, sculpt=skid)
    box(10, 6, 7, g.BODY, x=-5, y=4, sculpt=skid)
    for x in (-8, -5, -2):
        box(1, 8, 8, g.DARK, x=x, y=3, sculpt=skid)
    box(4, 4, 4, g.MARK, x=2, y=5, sculpt=skid)
    box(5, 8, 8, g.BODY, x=6, y=3, sculpt=skid)
    box(5, 3, 5, g.METAL, x=6, y=9, sculpt=skid)
    box(11, 2, 8, g.BODY, x=-5, y=9, sculpt=skid)
    box(4, 2, 5, g.METAL, x=-6, y=11, sculpt=skid)
    for x in (-9, -5, -1):
        box(1, 5, 1, g.METAL, x=x, y=4, z=4, sculpt=skid)
    for x in (-9, 8):
        for z in (-5, 4):
            box(2, 1, 2, g.METAL, x=x, y=2, z=z, sculpt=skid)
    return skid


def quench_bath(g):
    bath = box(18, 7, 29, g.MASONRY)
    bath.cut((-7, 6), (3, 7), (-12, 11))
    box(14, 2, 24, g.LIGHT, y=3, sculpt=bath)
    box(4, 10, 2, g.CAP, x=4, y=4, z=-13, sculpt=bath)
    for y in (5, 8, 11):
        box(2, 1, 1, g.DARK, x=4, y=y, z=-12, sculpt=bath)
    for x, z in ((-3, -4), (1, 6), (3, -8)):
        box(4, 1, 1, g.DARK, x=x, y=4, z=z, sculpt=bath)
    for x in (-8, 7):
        box(2, 2, 30, g.METAL, x=x, y=7, sculpt=bath)
    # A lift handle spans the removable strainer at the return end.
    for z in (4, 7, 10):
        box(11, 1, 1, g.METAL, y=5, z=z, sculpt=bath)
    for x in (-5, 5):
        box(1, 2, 9, g.DARK, x=x, y=5, z=7, sculpt=bath)
    for z in (5, 9):
        box(2, 3, 1, g.METAL, x=4, y=7, z=z, sculpt=bath)
    box(2, 1, 5, g.METAL, x=4, y=10, z=7, sculpt=bath)
    return bath


def coolant_line(g):
    pipe = box(40, 3, 3, g.BODY, y=3)
    for x in (-14, 13):
        box(2, 5, 5, g.METAL, x=x, y=2, sculpt=pipe)
        box(4, 2, 6, g.MASONRY, x=x, sculpt=pipe)
    return pipe


def sample_station(g):
    stand = box(13, 2, 8, g.DARK)
    for x in (-4, 4):
        box(2, 15, 3, g.METAL, x=x, y=2, sculpt=stand)
    box(13, 8, 5, g.BODY, y=15, sculpt=stand)
    box(11, 6, 1, g.CAP, y=16, z=3, sculpt=stand)
    box(4, 4, 1, g.DARK, x=-3, y=17, z=3, sculpt=stand)
    box(2, 2, 1, g.CAP, x=-3, y=18, z=4, sculpt=stand)
    box(1, 2, 1, g.METAL, x=-2, y=19, z=4, sculpt=stand)
    box(4, 2, 1, g.DARK, x=3, y=19, z=3, sculpt=stand)
    box(2, 1, 1, g.LIGHT, x=3, y=20, z=4, sculpt=stand)
    box(4, 4, 2, g.DETAIL, x=-5, y=12, z=1, sculpt=stand)
    box(5, 2, 5, g.METAL, x=-5, y=12, z=1, sculpt=stand)
    box(2, 4, 2, g.BODY, x=-5, y=9, z=3, sculpt=stand)
    box(5, 1, 4, g.DETAIL, x=2, y=16, z=3, sculpt=stand)
    return stand


def service_grating(g):
    tray = box(17, 2, 11, g.DARK)
    for x in range(-6, 8, 3):
        box(1, 1, 9, g.METAL, x=x, y=2, sculpt=tray)
    for z in (-5, 5):
        box(17, 1, 1, g.METAL, y=2, z=z, sculpt=tray)
    return tray


def intake_louvres(g):
    face = box(20, 14, 2, g.RUBBER)
    for y in (2, 5, 8, 11):
        box(17, 2, 3, g.METAL, y=y, sculpt=face)
    return face


def quench_tower(kit, g):
    kit.add('Cooling tower trestle', tank_frame(g), 12.4, -1.2)
    kit.place('Cooling tower trestle', 12.4, 1)
    kit.add('Process water tank', water_tank(g), 12.4, -0.1, height=5.1)
    kit.add('Tank inspection ladder', tank_service_ladder(g), 10.66, -0.12, 3)
    kit.place('Tank inspection ladder', 10.66, -0.12, 3, height=4)
    kit.add('Inspection ladder landing', ladder_landing(g), 10.47, -0.12, 3, height=8)
    kit.set_palette('Tank inspection ladder', metal='#989f91', skin='#8c8b78', secondary='#4c5e56')
    kit.add('Tank access cap', tank_cap(g), 12.4, -0.1, height=8.1)
    kit.add('Cooling water riser', riser(g), 12.4, -0.1)
    kit.add('Pump sampling panel', sample_station(g), 11.28, 2.0)
    kit.add('Pump service grate', service_grating(g), 12.22, 3.12, height=-0.1)
    kit.set_palette('Pump sampling panel', primary='#567769', trim='#cad0b8', metal='#888e85', detail='#b47042')
    kit.set_palette('Pump service grate', metal='#839187', secondary='#444c48')
    kit.add('Cooling circulation pump', pump_skid(g), 13.1, 1.85)
    kit.add('Return water main', coolant_line(g), 14.7, 1.35)
    kit.add('Quench bath', quench_bath(g), 15.85, 2.8)
    kit.set_palette('Cooling circulation pump', primary='#6e8875', accent='#c49351', metal='#a1a598')
    kit.set_palette('Return water main', primary='#637e68', metal='#9fa493')
    kit.set_palette('Quench bath', skin='#887e70', visor='#50858b', secondary='#6da5a0')
    kit.set_palette('Cooling tower trestle', primary='#635b4e', metal='#8b8b78', secondary='#454d48')
    kit.set_palette('Process water tank', primary='#688b7c', trim='#c5c5a5', metal='#829e8c')
    kit.set_palette('Cooling water riser', primary='#618a78', detail='#a4533c')


def mill_wall(g):
    wall = box(40, 50, 4, g.BODY)
    wall.cut((-15, 14), (19, 39), (-2, 2))
    for x in (-17, -5, 5, 16):
        box(2, 23, 3, g.METAL, x=x, y=18, sculpt=wall)
    for y in (18, 28, 39):
        box(34, 2, 5, g.DARK, y=y, sculpt=wall)
    for x in (-18, 17):
        box(3, 50, 6, g.DARK, x=x, sculpt=wall)
    box(40, 4, 5, g.MASONRY, sculpt=wall)
    return wall


def loading_sill_plate(g):
    plate = box(5, 1, 9, g.METAL)
    box(2, 1, 9, g.DARK, x=2, y=1, sculpt=plate)
    for z in (-3, 3):
        box(1, 1, 1, g.MARK, x=-1, z=z, sculpt=plate)
    return plate


def pump_service_door(g):
    bay = box(40, 5, 5, g.METAL, y=43)
    for x in (-18, 17):
        box(4, 43, 5, g.BODY, x=x, sculpt=bay)
        box(4, 6, 6, g.DARK, x=x, sculpt=bay)
        box(2, 28, 2, g.METAL, x=x, y=7, z=-3, sculpt=bay)
    for y in (36, 39, 42):
        box(32, 3, 3, g.PATINA, y=y, z=-1, sculpt=bay)
        box(32, 1, 1, g.METAL, y=y, z=-3, sculpt=bay)
    box(40, 2, 7, g.DARK, y=48, sculpt=bay)
    box(16, 2, 4, g.DARK, y=34, z=1, sculpt=bay)
    box(12, 1, 2, g.LAMP, y=34, z=2, sculpt=bay)
    return bay


def edge_mill(kit, g):
    kit.add('Rolling mill sash', mill_wall(g), 16.9, 8, 3)
    kit.add('Pump room service opening', pump_service_door(g), 16.9, 4, 3)
    kit.set_palette('Pump room service opening', primary='#67776c', skin='#847b68', metal='#8f9689', secondary='#495653')
    kit.add('Rolling mill loading door', g.deep_arch(40, 50, 4, 29, g.BODY, g.DARK), 16.9, 0, 3)
    kit.add('Rolling mill rear wall', g.clad_wall(40, 50, 4, g.BODY, g.DARK), 19.7, 0, 3)
    kit.add('Rolling mill shed roof', g.roof(40, 32, g.PATINA), 18.3, 0, 3, height=5)
    for z in (4, 8):
        kit.place('Rolling mill rear wall', 19.7, z, 3)
        kit.place('Rolling mill shed roof', 18.3, z, 3, height=5)
    for z in (-2, 10):
        kit.place('Rolling mill rear wall', 18.0, z)
    for z in (0, 4, 8):
        kit.place('Workshop deck', 18.0, z, height=-0.19)
    kit.place('Loaded steel rack', 18.4, 0, 1)
    kit.place('Material rack', 18.5, 6.4, 1)
    for name in ('Rolling mill sash', 'Rolling mill loading door', 'Rolling mill rear wall'):
        kit.set_palette(name, primary='#86725e', secondary='#4c5e57', skin='#978b76')


def furnace_front(g):
    body = box(32, 25, 16, g.PATINA)
    body.cut((-10, 9), (5, 19), (0, 8))
    box(19, 12, 2, g.DETAIL, y=6, z=1, sculpt=body)
    for x, w, h in ((-6, 5, 6), (0, 7, 10), (6, 4, 5)):
        box(w, h, 2, g.MARK, x=x, y=6, z=2, sculpt=body)
    box(11, 3, 2, g.LAMP, y=6, z=3, sculpt=body)
    for x in (-14, 13):
        box(3, 23, 3, g.DARK, x=x, y=2, z=8, sculpt=body)
    box(34, 3, 18, g.DARK, y=25, sculpt=body)
    for step in range(3):
        box(27 - 6 * step, 4, 15 - 3 * step, g.BODY, y=28 + step * 4, sculpt=body)
    box(8, 7, 7, g.METAL, y=40, sculpt=body)
    return body


def casting_table(g):
    base = box(24, 2, 12, g.METAL, y=6)
    for x in (-10, 9):
        box(3, 6, 10, g.DARK, x=x, sculpt=base)
    for x in (-6, 5):
        box(9, 4, 10, g.PATINA, x=x, y=8, sculpt=base)
        base.cut((x - 2, x + 2), (9, 12), (-3, 2))
    return base


def tapping_ladle(g):
    pot = box(13, 2, 13, g.DARK)
    box(11, 7, 11, g.METAL, y=2, sculpt=pot)
    box(14, 2, 14, g.PATINA, y=8, sculpt=pot)
    pot.cut((-5, 4), (4, 10), (-5, 4))
    for side in (-7, 7):
        box(2, 7, 3, g.BODY, x=side, y=2, sculpt=pot)
    for step in range(4):
        box(5, 1, 4, g.PATINA, z=-7 - step * 3, y=9 + step, sculpt=pot)
        for x in (-3, 3):
            box(1, 3, 4, g.METAL, x=x, z=-7 - step * 3, y=9 + step, sculpt=pot)
    return pot


def picket_panel(g):
    wall = box(40, 4, 3, g.BODY)
    for x in range(-16, 17, 8):
        box(1, 37, 2, g.METAL, x=x, y=4, sculpt=wall)
    box(40, 2, 3, g.DARK, y=40, sculpt=wall)
    return wall


def firebrick_repair(g):
    # Older dark joints remain between the replacement firebricks.
    patch = box(28, 4, 2, g.WOOD, y=15)
    for row in range(2):
        for x in (-10, -4, 2, 8):
            box(5, 2, 2, g.CAP if x == -4 else g.PATINA, x=x + row, y=15 + row * 2, z=1, sculpt=patch)
    for x in (-12, 11):
        for y in (0, 4, 8, 12):
            box(3, 3, 2, g.PATINA if y == 8 else g.CAP, x=x, y=y, sculpt=patch)
    return patch


def tapping_instruments(g):
    board = box(9, 13, 3, g.DARK)
    box(7, 11, 2, g.METAL, y=1, z=1, sculpt=board)
    for x in (-2, 2):
        box(3, 3, 1, g.CAP, x=x, y=7, z=3, sculpt=board)
        box(1, 2, 1, g.DARK, x=x, y=8, z=4, sculpt=board)
    box(2, 2, 1, g.DETAIL, x=-2, y=2, z=3, sculpt=board)
    box(2, 2, 1, g.LIGHT, x=2, y=2, z=3, sculpt=board)
    return board


def service_manifold(g):
    pipes = box(34, 3, 3, g.BODY, y=11)
    box(29, 2, 2, g.METAL, x=-2, y=6, sculpt=pipes)
    for x in (-14, -3, 10):
        box(3, 11, 3, g.BODY, x=x, sculpt=pipes)
        box(5, 2, 5, g.METAL, x=x, y=4, sculpt=pipes)
        box(2, 2, 3, g.DARK, x=x, y=9, z=2, sculpt=pipes)
    for x in (-14, 10):
        box(5, 2, 1, g.DETAIL, x=x, y=10, z=4, sculpt=pipes)
        box(1, 4, 1, g.DETAIL, x=x, y=9, z=4, sculpt=pipes)
    return pipes


def casting_tools(g):
    tray = box(12, 1, 5, g.DARK)
    box(9, 1, 1, g.METAL, x=1, y=1, z=-1, sculpt=tray)
    box(7, 1, 1, g.METAL, y=1, z=1, sculpt=tray)
    box(2, 2, 3, g.DARK, x=-4, y=1, sculpt=tray)
    box(3, 1, 2, g.MARK, x=4, y=1, z=1, sculpt=tray)
    return tray


def cast_services(kit, g):
    kit.add('Repaired firebrick throat', firebrick_repair(g), 0.9, -19.99, height=0.45)
    kit.place('Repaired firebrick throat', 4.2, -19.99, height=0.45)
    kit.add('Tapping instrument panel', tapping_instruments(g), 2.15, -19.97, height=0.85)
    kit.place('Tapping instrument panel', 5.43, -19.97, height=0.85)
    kit.add('Furnace cooling manifold', service_manifold(g), 7.78, -17.6, 3, height=1.75)
    kit.place('Furnace cooling manifold', 7.78, -20.0, 3, height=1.75)
    kit.add('Ladle landing brake', landing_lever(g), -9.25, -9.2)
    kit.add('Casting bench tongs', casting_tools(g), -0.44, -18.3, 1, height=1.2)
    kit.set_palette('Repaired firebrick throat', trim='#b39273', skin='#876e5b', leather='#5e4e44')
    kit.set_palette('Tapping instrument panel', trim='#d7d2b5', visor='#80a696', detail='#ae513b')
    kit.set_palette('Furnace cooling manifold', primary='#4c6861', metal='#8b9689', detail='#9c4c3b')
    kit.set_palette('Furnace tapping ladle', metal='#667b72', skin='#9e7961', primary='#657867')
    kit.set_palette('Ingot casting bench', metal='#768a84', skin='#6a6b62', accent='#cb8753')


def hoist_trolley(g):
    carriage = box(18, 3, 18, g.DARK, y=3)
    for x in (-6, 6):
        for z in (-6, 6):
            box(5, 5, 3, g.METAL, x=x, z=z, sculpt=carriage)
    box(12, 6, 8, g.BODY, y=6, sculpt=carriage)
    for x in (-4, 0, 4):
        box(2, 8, 10, g.DARK, x=x, y=5, sculpt=carriage)
    box(6, 6, 7, g.MARK, x=8, y=6, sculpt=carriage)
    return carriage


def spreader(g):
    beam = box(30, 4, 8, g.MARK)
    for x in (-13, 12):
        box(3, 6, 8, g.METAL, x=x, sculpt=beam)
    for i in range(7):
        for side in (-1, 1):
            box(3, 3, 2, g.DARK, x=side * (12 - 2 * i), y=4 + 2 * i, sculpt=beam)
    box(4, 3, 4, g.METAL, y=17, sculpt=beam)
    return beam


def sling_load(g):
    steel = box(35, 3, 12, g.PATINA)
    for z in (-4, 3):
        box(35, 3, 4, g.METAL, y=3, z=z, sculpt=steel)
    for x in (-12, 11):
        box(3, 1, 14, g.DARK, x=x, sculpt=steel)
        for z in (-6, 6):
            box(2, 12, 2, g.DARK, x=x, z=z, sculpt=steel)
        box(3, 2, 13, g.METAL, x=x, y=11, sculpt=steel)
    return steel


def billet_cradle(g):
    frame = box(28, 2, 3, g.DARK)
    for x in (-12, 11):
        box(6, 4, 17, g.METAL, x=x, sculpt=frame)
        box(5, 2, 14, g.WOOD, x=x, y=4, sculpt=frame)
        for z in (-7, 7):
            box(5, 3, 2, g.MARK, x=x, y=4, z=z, sculpt=frame)
    return frame


def hatch_front(g):
    hatch = box(40, 47, 4, g.BODY)
    hatch.cut((-17, 3), (0, 33), (-3, 3))
    for x in (-18, 4):
        box(3, 34, 6, g.DARK, x=x, sculpt=hatch)
    box(26, 4, 8, g.METAL, x=-7, y=34, sculpt=hatch)
    for y in (29, 31, 33):
        box(20, 2, 3, g.PATINA, x=-7, y=y, z=-2, sculpt=hatch)
    box(7, 6, 2, g.MARK, x=11, y=27, z=2, sculpt=hatch)
    for x, y in ((9, 29), (10, 30), (11, 31)):
        box(2, 1, 1, g.DARK, x=x, y=y, z=3, sculpt=hatch)
    for y in (9, 13, 17, 21):
        box(10, 2, 6, g.METAL, x=12, y=y, sculpt=hatch)
    box(39, 4, 5, g.DARK, y=42, sculpt=hatch)
    return hatch


def hose_reel(g):
    reel = box(13, 2, 9, g.MASONRY)
    for x in (-5, 5):
        box(2, 10, 3, g.METAL, x=x, y=2, sculpt=reel)
        box(2, 10, 9, g.MARK, x=x, y=8, sculpt=reel)
        box(2, 6, 13, g.MARK, x=x, y=10, sculpt=reel)
    box(8, 8, 8, g.RUBBER, y=10, sculpt=reel)
    box(3, 4, 3, g.METAL, x=7, y=12, sculpt=reel)
    return reel


def flanged_branch(g):
    branch = box(5, 5, 19, g.BODY, y=4)
    for z in (-8, 4):
        box(7, 7, 2, g.METAL, y=3, z=z, sculpt=branch)
    box(5, 8, 5, g.BODY, y=5, z=7, sculpt=branch)
    box(7, 2, 7, g.METAL, y=12, z=7, sculpt=branch)
    box(2, 4, 2, g.DARK, y=14, z=7, sculpt=branch)
    box(7, 1, 6, g.DETAIL, y=18, z=7, sculpt=branch)
    branch.cut((-2, 2), (18, 18), (5, 8))
    box(1, 1, 6, g.DETAIL, y=18, z=7, sculpt=branch)
    box(2, 2, 2, g.METAL, y=17, z=7, sculpt=branch)
    for x in (-2, 2):
        box(2, 4, 4, g.MASONRY, x=x, z=-1, sculpt=branch)
    return branch


def seated_console(g):
    table = box(15, 3, 8, g.DARK, y=8)
    for x in (-6, 5):
        box(3, 8, 4, g.METAL, x=x, sculpt=table)
    box(6, 5, 2, g.BODY, x=-3, y=11, z=-2, sculpt=table)
    box(4, 2, 1, g.LIGHT, x=-3, y=12, z=-1, sculpt=table)
    box(2, 3, 2, g.DARK, x=4, y=11, z=1, sculpt=table)
    box(3, 1, 2, g.MARK, x=4, y=14, z=1, sculpt=table)
    return table


def operator_seat(g):
    seat = box(7, 2, 7, g.DARK)
    box(3, 4, 3, g.METAL, y=2, sculpt=seat)
    box(8, 2, 7, g.BODY, y=6, sculpt=seat)
    box(8, 6, 2, g.BODY, y=8, z=-3, sculpt=seat)
    return seat


def vessel_outlet(g):
    joint = box(14, 4, 4, g.BODY, y=8)
    for x in (-5, 4):
        box(2, 6, 6, g.METAL, x=x, y=7, sculpt=joint)
    box(3, 5, 3, g.METAL, x=1, y=12, sculpt=joint)
    box(7, 2, 6, g.DETAIL, x=1, y=17, sculpt=joint)
    joint.cut((-1, 2), (17, 18), (-1, 1))
    box(2, 9, 3, g.DARK, x=6, sculpt=joint)
    return joint


def vessel_header(g):
    line = box(34, 4, 4, g.BODY, y=8)
    for x in (-11, 10):
        box(2, 6, 6, g.METAL, x=x, y=7, sculpt=line)
        box(3, 7, 4, g.DARK, x=x, sculpt=line)
        box(5, 2, 6, g.MASONRY, x=x, sculpt=line)
    return line


def discharge_spout(g):
    spout = box(5, 9, 5, g.BODY, z=-3)
    box(5, 4, 12, g.BODY, y=7, z=1, sculpt=spout)
    box(5, 5, 4, g.BODY, y=4, z=5, sculpt=spout)
    box(7, 2, 7, g.METAL, y=2, z=-3, sculpt=spout)
    box(4, 6, 3, g.LIGHT, z=5, sculpt=spout)
    box(3, 2, 3, g.METAL, y=11, z=-2, sculpt=spout)
    box(2, 3, 2, g.DARK, y=13, z=-2, sculpt=spout)
    box(5, 7, 2, g.METAL, y=16, z=-1, sculpt=spout)
    box(7, 5, 2, g.METAL, y=17, z=-1, sculpt=spout)
    box(5, 3, 1, g.CAP, y=18, z=0, sculpt=spout)
    box(3, 5, 1, g.CAP, y=17, z=0, sculpt=spout)
    for x, y in ((-1, 18), (0, 19), (1, 20)):
        box(1, 1, 1, g.DARK, x=x, y=y, z=0, sculpt=spout)
    box(1, 1, 1, g.DETAIL, x=2, y=20, z=0, sculpt=spout)
    return spout


def pressure_bank(kit, g):
    tank = next(sculpt for _, label, sculpt in kit.props if label == 'Pressure vessel')
    box(7, 2, 7, g.BODY, y=21, sculpt=tank)
    box(4, 4, 4, g.METAL, y=23, sculpt=tank)
    box(6, 1, 6, g.CAP, y=27, sculpt=tank)
    kit.add('Cooling yard paving', g.paving(20, 40, g.MASONRY, g.DARK, g.METAL), 15, 0, height=-0.18)
    kit.place('Cooling yard paving', 15, 4, height=-0.18)
    kit.place('Cooling yard paving', 15, 8, height=-0.18)
    kit.add('Receiver branch valve', vessel_outlet(g), 10.98, -15)
    for z in (-18.4, -21.8):
        kit.place('Receiver branch valve', 10.98, z)
    kit.place('Receiver branch valve', -5.9, -12.02, 3)
    kit.add('Receiver header', vessel_header(g), 11.55, -16.7, 1)
    kit.place('Receiver header', 11.55, -20.1, 1)
    kit.add('Bath discharge spout', discharge_spout(g), 16.08, 1.66, height=0.38)
    kit.set_palette('Bath discharge spout', primary='#5f7b6b', metal='#a1a693', visor='#689a96', trim='#e4d9ac', detail='#ad5a41')
    kit.set_palette('Pressure vessel', metal='#8d9c91', primary='#506c62', trim='#b9b59b')
    kit.set_palette('Receiver branch valve', primary='#617e72', metal='#9ca38c', detail='#a05440')
    kit.set_palette('Receiver header', primary='#617e72', metal='#9ca38c')
    feed_height = 2.1
    pipes = checked_group(
        kit, 'Tank feed pipes', [(10, z) for z in (-14.5, -17.9, -21.3)],
        lambda x, y, z: near(x, 10) and near(y, feed_height), height=feed_height,
    )
    for pipe in pipes:
        kit.placements.remove(pipe)


def runway_services(kit, g):
    kit.add('Bridge hoist trolley', hoist_trolley(g), 4.3, 3.55, height=8.55)
    kit.add('Billet spreader', spreader(g), 4.3, 3.55, height=2.6)
    kit.add('Suspended steel billets', sling_load(g), 4.3, 3.55, height=1.4)
    kit.add('Billet landing cradle', billet_cradle(g), 4.3, 3.55)
    kit.add('Crane station console', seated_console(g), 13.45, 4.6, 1)
    kit.add('Crane station seat', operator_seat(g), 14.75, 4.6, 3)
    kit.add('Hose winding stand', hose_reel(g), -4.41, -8.9)
    kit.add('Service water branch', flanged_branch(g), 12.45, 0.85)
    kit.place('Service water branch', 13.65, 1.35, 1)
    kit.set_palette('Service water branch', primary='#597a68', metal='#969f8f', detail='#ad5239')
    kit.set_palette('Empty ore skip', primary='#677a77', secondary='#4b5454')
    kit.set_palette('Suspended steel billets', skin='#835743', metal='#976b54', secondary='#473f39')
    kit.set_palette('Bridge hoist trolley', primary='#666e60', accent='#be8c46')
    kit.set_palette('Billet spreader', accent='#cf9648', secondary='#454b48')
    kit.set_palette('Crane station console', primary='#71806b', visor='#72a599')


def industrial(kit, g, stops, fixtures):
    kit.add('Charging gallery', gallery(g, g.DARK, g.MARK), -10, -11)
    kit.place('Charging gallery', -14, -11)
    kit.add('Charging gallery stairs', stairs(g, g.MARK), -14, -5.45)
    kit.place('Charging gallery stairs', -14, -8.45, height=1.5)
    kit.add('Charging stair bearers', stair_bearers(g), -14, -8.45)
    kit.add('Gravity charge bin', charge_bin(g), -10.3, -14)
    kit.place('Gravity charge bin', -14.1, -14)
    kit.add('Casting railway', rails(g), -10.3, -14)
    for z in (-18, -10, -6, -2, 2):
        kit.place('Casting railway', -10.3, z)
    kit.add('Timber rail crossing', rail_crossing(g), -10.3, -5.3)
    kit.place('Timber rail crossing', -10.3, -17)
    kit.add('Ladle transfer car', transfer_car(g), -10.3, -9.2, height=0.4)
    kit.place('Ladle transfer car', -10.3, -12.65, height=0.4)
    kit.add('Extraction main', gas_main(g), -10, -16.5, height=5.1)
    for x in (-14, -6):
        kit.place('Extraction main', x, -16.5, height=5.1)
    kit.add('Extraction pipe bent', gas_trestle(g), -15.5, -16.5, 1)
    for x in (-12, -8, -4.4):
        kit.place('Extraction pipe bent', x, -16.5, 1)
    kit.add('Refractory exhaust stack', stack(g), -18.9, -16.5)
    kit.place('Extraction main', -18, -16.5, height=5.1)
    kit.place('Extraction main', -18.9, -18.2, 1, height=5.1)
    kit.place('Refractory exhaust stack', -18.9, -19.6)
    kit.add('Gallery tapping desk', g.counter(14, 10, g.BODY, g.METAL, shelf=True), -11.2, -11.1, height=3)
    kit.add('Charging signal', g.post(19, g.DARK, g.MARK, arm=True), -8.5, -11.1, height=3)
    kit.place('Metal scrap skip', -13, -19)
    # Connect each flue to a furnace or a roof penetration.
    clearances = {
        ('Hoist frame', 7.97, 4.85): (4.1, 0.15),
        ('Empty ore skip', 7.4, 1.65): (8.4, 2.8),
        ('Sorted casting stock', 6.7, 6.3): (5.6, 6.1),
        ('Material rack', 7.8, 1.05): (8.6, 0.8),
        ('Ribbed wall', 5.8, 6.9): (9.1, 9.4),
        ('Roadside earth bed', -10.6, 0): (-15.9, 2.2),
        ('Roadside earth bed', 10.8, -2.0): (12.8, 11.5),
        ('Roadside shade tree', 10.4, -1.5): (12.4, 12.0),
        ('Yard poplar', 15, 2): (19.0, 12.0),
        ('Roadside shade tree', -11, 0.5): (-16.3, 2.7),
    }
    pave_bays(kit, [kit.placement_at('Yard embankment', 12, z) for z in (0, 4, 8)])
    for (label, x, z), (new_x, new_z) in clearances.items():
        part = kit.placement_at(label, x, z)
        part.update(position=[new_x, part['position'][1], new_z])
    kit.placement_at('Ribbed wall', 9.1, 9.4, height=0).update(propId=kit.prop_id('Service frame'))
    kit.placement_at('Foundry press', 4.4, -20.8, height=0).update(position=[6.9, 0, -20.8])
    flues = checked_group(
        kit, 'Smelting works chimney', [(x, -13.4) for x in (6.8, 8.1, 9.4)],
        lambda x, y, z: True, height=5,
    )
    for part, x in zip(flues, (6.8, 3.8, 1.8)):
        part.update(position=[x, 4.7, -13.4])
    for x, z, new_x in ((-9, -14.9, -13.2), (-11, -14.7, -14.7)):
        kit.placement_at('Metal scrap skip', x, z, height=0).update(position=[new_x, 0, -18.7])
    # The east end of the charge floor follows the interior wall.
    kit.place('Charging gallery', -1.8, -18.2, 1)
    kit.place('Charging gallery stairs', -1.8, -11.7)
    kit.place('Charging gallery stairs', -1.8, -14.7, height=1.5)
    kit.place('Charging stair bearers', -1.8, -14.7)
    kit.place('Gallery tapping desk', -1.8, -19, height=3)
    kit.add('Charge bay service portal', hatch_front(g), -6, -10)
    kit.remove_at('Smelting works window', -6, -10, height=0)
    kit.set_palette('Charge bay service portal', primary='#796451', secondary='#484f49', metal='#8d9386')
    kit.add('Ore retaining wall', bunker_wall(g), -18, -7.6, 1)
    for z in (-11.6, -15.6, -19.6, -23.6):
        kit.place('Ore retaining wall', -18, z, 1)
    kit.add('Ore stockpile', ore_stockpile(g), -17, -6)
    for x, z, turn in ((-16.1, -10.2, 1), (-16.7, -14.2, 2), (-15.9, -22, 3)):
        kit.place('Ore stockpile', x, z, turn)
    crane_yard(kit, g)
    kit.add('Rolled sheet coil', rolled_sheet(g), 3.9, 2.0, 1)
    kit.place('Rolled sheet coil', 7.8, -0.1, 1)
    kit.set_palette('Rolled sheet coil', metal='#96a296', primary='#736747', secondary='#505752')
    quench_tower(kit, g)
    runway_services(kit, g)
    pressure_bank(kit, g)
    edge_mill(kit, g)
    kit.add('Loading sill access plate', loading_sill_plate(g), 6.62, 4.15)
    kit.place('Loading sill access plate', 7.98, 4.15, 2)
    kit.set_palette('Loading sill access plate', metal='#8b9182', secondary='#505750', accent='#c29a59')
    fixtures.append(dict(position=[16.73, 3.3, 4.0], color='#fff0d5', intensity=10, distance=5.8))
    kit.add('Mill intake louvres', intake_louvres(g), -4.96, -0.5, 3, height=2.2)
    kit.place('Mill intake louvres', -4.96, -1.85, 3, height=1.1)
    kit.place('Maintenance bench', -5.6, -0.1, 1)
    kit.place('Ore samples and tongs', -5.6, -0.1, 1, height=0.9)
    kit.add('Ladle extraction hood', ladle_hood(g), -10.3, -16.5, height=2.8)
    kit.place('Ore retaining wall', -15.7, -24)
    kit.place('Ore retaining wall', -11.7, -24)
    kit.place('Ore stockpile', -12.1, -22.8, 1)
    kit.place('Charging gallery', -16.8, -13.8, 1)
    kit.place('Charging gallery', -16.8, -17.8, 1)
    kit.place('Charging gallery', -14.7, -18.3, 1)
    kit.add('Foundry dispatch cabin', dispatch_cabin(g), -16.15, -18.3, 1, height=3)
    kit.set_palette('Foundry dispatch cabin', primary='#637760', trim='#c7c6a9', skin='#948a75')
    kit.set_palette('Charging gallery', secondary='#59666a', accent='#dfa452')
    kit.set_palette('Charging gallery stairs', metal='#737b79', accent='#dfa452')
    kit.set_palette('Gravity charge bin', primary='#a06642', metal='#7c7164', secondary='#434e4f')
    kit.set_palette('Ore stockpile', primary='#49453f', leather='#705345')
    kit.set_palette('Runway stanchion', primary='#637674', secondary='#464f4b', metal='#a3a897', accent='#b79156')
    kit.set_palette('Travelling bridge beam', primary='#795338', accent='#dfa248')
    kit.add('Melting furnace', furnace_front(g), 0.9, -20.9)
    kit.place('Melting furnace', 4.2, -20.9)
    kit.set_palette(
        'Melting furnace',
        primary='#7a4837',
        skin='#827366',
        accent='#e08b4c',
        detail='#803425',
        trim='#f2c77b',
    )
    kit.add('Ingot casting bench', casting_table(g), 0.0, -18.3, 1)
    kit.add('Furnace tapping ladle', tapping_ladle(g), 4.2, -18.7)
    cast_services(kit, g)
    kit.add('Heat screen', picket_panel(g), 6.0, -19.1, 1)
    stops[0].update(label='Ore charging gallery', eye=[-8.4, 1.65, -2.4], target=[-12, 3.2, -14.3])
    stops[1].update(label='Ingot casting floor', eye=[5.9, 1.65, -15.7], target=[1.8, 1.95, -20.4])
    stops[2].update(label='Crane runway', eye=[2.7, 1.65, 13.75], target=[4.3, 4.65, 3.5])
    stops.append(dict(label='Charging platform', eye=[-14.95, 4.65, -10.5], target=[-7.5, 2.6, -6.3]))
    stops.append(dict(label='Cooling water station', eye=[16.9, 1.65, 3.9], target=[10.6, 2.55, 0.35]))
    stops.append(dict(label='Crane controls', eye=[15.25, 1.65, 4.95], target=[4.3, 4.4, 3.55]))
    for x in (0.9, 4.2):
        fixtures.append(dict(position=[x, 1.55, -19.9], color='#ffae70', intensity=7, distance=4.7))
    fixtures.append(dict(position=[-10.3, 2.15, -9.2], color='#ff882b', intensity=9, distance=5))


def sorter_canopy(g):
    roof = box(40, 3, 35, g.CAP, y=31)
    for x in (-17, 16):
        box(3, 31, 4, g.METAL, x=x, z=-14, sculpt=roof)
        for step in range(5):
            box(3, 3, 5, g.BODY, x=x, y=20 + step * 2, z=-11 + step * 4, sculpt=roof)
    box(40, 2, 3, g.MARK, y=30, z=15, sculpt=roof)
    box(22, 1, 3, g.LAMP, y=30, sculpt=roof)
    return roof


def belt(g):
    run = box(18, 3, 40, g.BODY, y=8)
    for z in (-16, 14):
        for x in (-7, 6):
            box(2, 8, 2, g.METAL, x=x, z=z, sculpt=run)
    box(14, 1, 40, g.RUBBER, y=11, sculpt=run)
    for z in range(-18, 18, 5):
        box(13, 1, 1, g.DARK, y=11, z=z, sculpt=run)
    for x in (-8, 7):
        box(1, 2, 40, g.METAL, x=x, y=11, sculpt=run)
    return run


def sloping_belt(g):
    run = box(17, 10, 3, g.BODY)
    for step in range(8):
        y, z = 10 + 4 * step, -step * 8
        box(16, 4, 8, g.RUBBER, y=y, z=z, sculpt=run)
        for x in (-8, 7):
            if step in (3, 7):
                box(2, y, 2, g.BODY, x=x, z=z, sculpt=run)
    return run


def luggage(g, face):
    case = box(7, 7, 5, face, y=1)
    for x in (-2, 2):
        box(2, 2, 2, g.RUBBER, x=x, sculpt=case)
    box(1, 7, 5, g.CAP, x=-1, y=1, sculpt=case)
    box(3, 1, 2, g.METAL, y=8, sculpt=case)
    box(2, 2, 1, g.CAP, x=2, y=5, z=2, sculpt=case)
    return case


def cart(g):
    body = box(16, 2, 27, g.METAL, y=4)
    for x in (-7, 6):
        for z in (-9, 8):
            box(3, 5, 5, g.RUBBER, x=x, z=z, sculpt=body)
    for z in (-12, 11):
        box(16, 3, 2, g.MARK, y=6, z=z, sculpt=body)
        for x in (-7, 6):
            box(2, 14, 2, g.CAP, x=x, y=6, z=z, sculpt=body)
        box(16, 2, 2, g.CAP, y=18, z=z, sculpt=body)
    box(3, 2, 6, g.DARK, y=3, z=16, sculpt=body)
    return body


def cargo_facade(g):
    face = box(48, 47, 5, g.MASONRY)
    face.cut((-17, 16), (0, 34), (-3, 3))
    for x in (-18, 17):
        box(3, 36, 6, g.BODY, x=x, sculpt=face)
    for y in (33, 36, 39, 42):
        box(35, 3, 6, g.METAL, y=y, sculpt=face)
    box(49, 3, 8, g.CAP, y=45, sculpt=face)
    return face


def claim_cage(g):
    rack = box(22, 2, 15, g.METAL, y=2)
    for x in (-9, 8):
        for z in (-6, 5):
            box(2, 17, 2, g.CAP, x=x, y=3, z=z, sculpt=rack)
    for y in (9, 19):
        box(22, 1, 2, g.METAL, y=y, z=-6, sculpt=rack)
    box(9, 8, 10, g.BODY, x=-4, y=4, sculpt=rack)
    box(7, 6, 11, g.DETAIL, x=4, y=4, sculpt=rack)
    box(13, 5, 9, g.MASONRY, y=12, sculpt=rack)
    return rack


def shutter(g):
    door = box(33, 19, 2, g.BODY)
    for y in (1, 5, 9, 13, 17):
        box(33, 1, 3, g.METAL, y=y, sculpt=door)
    box(33, 2, 3, g.DARK, sculpt=door)
    return door


def airfreight_can(g):
    # The lower bevel clears the aircraft hold.
    shell = box(14, 2, 15, g.DARK, x=2)
    for step in range(4):
        box(14 + step, 2, 15, g.METAL, x=2 - step // 2, y=2 + step * 2, sculpt=shell)
    box(19, 10, 15, g.METAL, y=10, sculpt=shell)
    shell.cut((-6, 6), (5, 17), (-5, 8))
    box(20, 2, 16, g.CAP, y=20, sculpt=shell)
    for x in (-8, 7):
        box(2, 10, 2, g.BODY, x=x, y=10, z=7, sculpt=shell)
    box(14, 3, 2, g.BODY, y=17, z=7, sculpt=shell)
    box(5, 3, 1, g.CAP, x=-5, y=14, z=-8, sculpt=shell)
    box(3, 1, 1, g.DARK, x=-5, y=15, z=-8, sculpt=shell)
    return shell


def baggage_depot(kit, g):
    kit.add('Depot service slab', g.paving(20, 48, g.MASONRY, g.DARK, g.CAP), -19, -1.4, height=-0.15)
    for z in (-6.2, -11):
        kit.place('Depot service slab', -19, z, height=-0.15)
    for z in (-1.4, -6.2, -11):
        kit.place('Cargo handling bay', -16.9, z, 1)
        kit.place('Cargo bay roof', -18.1, z, 1, height=4.7)
        kit.place('Service yard boundary', -19.65, z, 1)
        kit.place('Airside luggage trailer', -18.05, z, 1)
        if z != -1.4:
            kit.place('Blue tagged suitcase', -18.0, z, height=0.6)
    kit.add('Cargo loading cage', claim_cage(g), -16.15, -1.2, 1)
    kit.place('Cargo loading cage', -16.1, -10.4, 1)
    kit.place('Cargo loading cage', -14.7, -21.3)
    kit.add('Depot roller shutter', shutter(g), -16.89, -6.2, 1, height=1.55)
    kit.place('Depot roller shutter', -10.0, -21.9, height=0.2)
    kit.set_palette('Cargo loading cage', primary='#6d846d', skin='#b79a66', detail='#9b583d')
    kit.set_palette('Depot roller shutter', primary='#829a8e', metal='#9ca79c')
    kit.add('Aircraft hold container', airfreight_can(g), -16.15, -8.4, 1)
    kit.place('Aircraft hold container', -18.05, -1.4, 1, height=0.6)
    kit.place('Red tagged suitcase', -16.15, -8.45, 1, height=0.5)
    kit.place('Blue tagged suitcase', -17.99, -1.4, 1, height=1.1)
    kit.set_palette('Aircraft hold container', metal='#b3b9ac', primary='#58816b', trim='#d7d6c3')
    kit.place('Service yard boundary', -18.05, 1)
    kit.place('Service yard boundary', -18.05, -13.4)


def ticket_canopy(g):
    # The narrow rear column carries the deeper curbside eave.
    roof = box(40, 2, 44, g.CAP, y=35)
    box(40, 2, 9, g.DETAIL, y=33, z=17, sculpt=roof)
    box(40, 2, 8, g.MARK, y=37, z=-17, sculpt=roof)
    for x in (-18, 17):
        box(3, 35, 4, g.BODY, x=x, z=-15, sculpt=roof)
        for step in range(4):
            box(3, 2, 7, g.METAL, x=x, y=26 + step * 2, z=-12 + step * 6, sculpt=roof)
    box(18, 1, 3, g.LAMP, y=34, z=3, sculpt=roof)
    return roof


def transit_pylon(g):
    pylon = box(13, 3, 8, g.PATINA)
    box(9, 36, 4, g.BODY, y=3, sculpt=pylon)
    box(11, 11, 5, g.DETAIL, y=29, sculpt=pylon)
    for z in (-3, 2):
        box(7, 6, 1, g.CAP, y=31, z=z, sculpt=pylon)
        box(5, 2, 1, g.DARK, y=34, z=z, sculpt=pylon)
        for x in (-2, 2):
            box(1, 1, 1, g.LAMP, x=x, y=32, z=z, sculpt=pylon)
    for z in (-2, 2):
        for y in (9, 12, 19, 22):
            box(5, 1, 1, g.CAP, x=-1, y=y, z=z, sculpt=pylon)
    return pylon


def airport_seat(g):
    seat = box(26, 2, 4, g.METAL, y=4)
    for x in (-10, 9):
        box(2, 4, 5, g.DARK, x=x, sculpt=seat)
    for x in (-8, 0, 8):
        box(7, 2, 6, g.DETAIL, x=x, y=6, sculpt=seat)
        box(7, 5, 2, g.DETAIL, x=x, y=8, z=-2, sculpt=seat)
    return seat


def station_clock(g):
    clock = box(12, 12, 3, g.DARK)
    box(10, 10, 1, g.CAP, y=1, z=2, sculpt=clock)
    for x, y in ((0, 2), (-4, 6), (0, 10), (4, 6)):
        box(1, 1, 1, g.BODY, x=x, y=y, z=3, sculpt=clock)
    box(1, 4, 1, g.DARK, y=5, z=3, sculpt=clock)
    box(3, 1, 1, g.DETAIL, x=1, y=5, z=3, sculpt=clock)
    box(3, 5, 2, g.METAL, y=12, sculpt=clock)
    return clock


def boarding_reader(g):
    reader = box(4, 10, 4, g.BODY)
    box(6, 6, 5, g.DETAIL, y=10, sculpt=reader)
    box(4, 2, 1, g.LIGHT, y=13, z=3, sculpt=reader)
    box(3, 1, 1, g.DARK, y=11, z=3, sculpt=reader)
    return reader


def baggage_sign(g):
    sign = box(29, 13, 2, g.DARK)
    for z in (-1, 1):
        box(10, 6, 1, g.CAP, x=-6, y=3, z=z, sculpt=sign)
        box(5, 2, 1, g.CAP, x=-6, y=9, z=z, sculpt=sign)
        box(6, 2, 1, g.MARK, x=6, y=6, z=z, sculpt=sign)
        for step in range(3):
            box(2, 2, 1, g.MARK, x=6 + step, y=8 - step, z=z, sculpt=sign)
            box(2, 2, 1, g.MARK, x=6 + step, y=4 + step, z=z, sculpt=sign)
    for x in (-10, 9):
        box(2, 6, 2, g.METAL, x=x, y=13, sculpt=sign)
    return sign


def destination_board(g):
    digits = {
        '0': ('111', '101', '101', '101', '111'),
        '1': ('010', '110', '010', '010', '111'),
        '2': ('111', '001', '111', '100', '111'),
        '8': ('111', '101', '111', '101', '111'),
    }
    sign = box(29, 13, 2, g.RUBBER)
    for z in (-1, 0):
        for row, (route, time) in enumerate((('1', '08'), ('2', '12'))):
            y = 7 - 6 * row
            for x, digit, color in ((-10, route, g.MARK), (2, time[0], g.CAP), (6, time[1], g.CAP)):
                for line, bits in enumerate(digits[digit]):
                    for col, bit in enumerate(bits):
                        if bit == '1':
                            px = x + col if z == 0 else -x - col
                            box(1, 1, 1, color, x=px, y=y + 4 - line, z=z, sculpt=sign)
            box(2, 2, 1, g.LIGHT, x=11 if z == 0 else -11, y=y + 1, z=z, sculpt=sign)
    for x in (-8, 7):
        box(2, 5, 2, g.DARK, x=x, y=13, sculpt=sign)
    return sign


def passenger_kerb(g):
    kerb = box(31, 2, 11, g.MASONRY)
    for x in (-13, -5, 3, 11):
        box(6, 1, 2, g.CAP, x=x, y=1, z=5, sculpt=kerb)
    for z in (-3, 0):
        for x in (-12, -8, -4, 0, 4, 8, 12):
            box(1, 1, 1, g.MARK, x=x, y=2, z=z, sculpt=kerb)
    box(4, 2, 4, g.DARK, x=-10, y=2, z=2, sculpt=kerb)
    box(2, 7, 2, g.METAL, x=-10, y=4, z=2, sculpt=kerb)
    box(2, 2, 2, g.MARK, x=-10, y=8, z=2, sculpt=kerb)
    return kerb


def layby_shelter(g):
    roof = box(34, 2, 28, g.CAP, y=29)
    for x in (-14, 13):
        box(4, 2, 5, g.DARK, x=x, z=-9, sculpt=roof)
        box(2, 28, 3, g.METAL, x=x, y=2, z=-9, sculpt=roof)
        for step in range(4):
            box(2, 2, 5, g.BODY, x=x, y=23 + step * 2, z=-7 + step * 4, sculpt=roof)
    box(32, 2, 2, g.BODY, y=29, z=13, sculpt=roof)
    for x in (-9, 8):
        box(7, 1, 2, g.LAMP, x=x, y=28, z=4, sculpt=roof)
    # The seat has a gap at each end for a suitcase or chair.
    for x in (-8, 7):
        box(2, 5, 3, g.METAL, x=x, z=-7, sculpt=roof)
    box(22, 2, 5, g.WOOD, y=5, z=-7, sculpt=roof)
    box(22, 3, 2, g.WOOD, y=8, z=-9, sculpt=roof)
    for x in (-8, 7):
        box(2, 4, 2, g.METAL, x=x, y=6, z=-9, sculpt=roof)
    return roof


def layby_marker(g):
    marker = box(5, 2, 5, g.DARK)
    box(2, 22, 2, g.METAL, y=2, sculpt=marker)
    box(10, 10, 3, g.BODY, y=18, sculpt=marker)
    for z in (-2, 1):
        for x in (-2, 2):
            box(1, 1, 1, g.CAP, x=x, y=20, z=z, sculpt=marker)
        box(7, 2, 1, g.CAP, y=21, z=z, sculpt=marker)
        box(5, 2, 1, g.CAP, y=23, z=z, sculpt=marker)
        box(3, 1, 1, g.LIGHT, y=23, z=z, sculpt=marker)
    for x in (-3, 0, 3):
        box(2, 1, 1, g.MARK, x=x, y=26, z=1, sculpt=marker)
    box(3, 2, 3, g.MARK, y=9, sculpt=marker)
    return marker


def kerb_cut(g):
    ramp = box(24, 1, 13, g.MASONRY)
    for x in (-11, 10):
        box(2, 2, 7, g.CAP, x=x, z=-3, sculpt=ramp)
    for x in (-5, 0, 5):
        box(2, 1, 3, g.MARK, x=x, z=-4, sculpt=ramp)
    return ramp


def kerb_landing(g):
    paving = box(31, 2, 25, g.MASONRY)
    for x in (-12, 1, 11):
        box(1, 1, 25, g.PATINA, x=x, y=1, sculpt=paving)
    box(31, 1, 1, g.PATINA, y=1, z=-3, sculpt=paving)
    return paving


def parking_deck_bay(g, column_x=-19):
    # Drivers pass under the deck. The parapet leaves the top row open to daylight.
    bay = box(44, 3, 39, g.MASONRY, y=36)
    for z in (-16, 15):
        box(44, 3, 4, g.METAL, y=33, z=z, sculpt=bay)
        box(4, 33, 4, g.MASONRY, x=column_x, z=z, sculpt=bay)
        box(6, 7, 6, g.DARK, x=column_x, z=z, sculpt=bay)
        box(6, 2, 6, g.MARK, x=column_x, y=7, z=z, sculpt=bay)
        box(8, 3, 6, g.MASONRY, x=column_x, y=30, z=z, sculpt=bay)
    box(44, 5, 3, g.CAP, y=39, z=17, sculpt=bay)
    for x in (-19, -6, 7, 20):
        box(2, 5, 2, g.METAL, x=x, y=44, z=17, sculpt=bay)
    box(44, 1, 2, g.BODY, y=49, z=17, sculpt=bay)
    box(12, 1, 3, g.LAMP, x=4, y=35, z=8, sculpt=bay)
    return bay


def parking_rear_screen(g):
    wall = box(44, 12, 4, g.MASONRY)
    for x in (-19, 18):
        box(4, 54, 4, g.MASONRY, x=x, sculpt=wall)
    for y in (15, 24, 44):
        box(42, 3, 3, g.BODY, y=y, z=-1, sculpt=wall)
    box(44, 5, 4, g.MASONRY, y=33, sculpt=wall)
    return wall


def parking_entry_sign(g):
    sign = box(19, 10, 2, g.BODY)
    box(19, 1, 2, g.CAP, y=9, sculpt=sign)
    for row, bits in enumerate(('1110', '1001', '1110', '1000', '1000')):
        for col, bit in enumerate(bits):
            if bit == '1':
                box(1, 1, 1, g.CAP, x=-7 + col, y=7 - row, z=1, sculpt=sign)
    box(8, 2, 1, g.MARK, x=3, y=4, z=1, sculpt=sign)
    for x, y in ((2, 2), (1, 3), (1, 6), (2, 7)):
        box(1, 1, 1, g.MARK, x=x, y=y, z=1, sculpt=sign)
    return sign


def kerb_return(g):
    kerb = box(14, 2, 7, g.MASONRY, x=-7, z=4)
    for step in range(4):
        box(5, 2, 6, g.MASONRY, x=1 + step * 2, z=2 - step * 2, sculpt=kerb)
    box(6, 2, 12, g.MASONRY, x=7, z=-10, sculpt=kerb)
    for x, z in ((-8, 7), (0, 5), (5, 0), (9, -8)):
        box(3, 1, 1, g.CAP, x=x, y=1, z=z, sculpt=kerb)
    return kerb


def return_lane_arrow(g):
    paving = box(40, 2, 40, g.GRIT)
    box(4, 1, 12, g.CAP, y=1, z=-2, sculpt=paving)
    for step, width in enumerate((12, 8, 4)):
        box(width, 1, 2, g.CAP, y=1, z=5 + 2 * step, sculpt=paving)
    box(2, 1, 12, g.CAP, x=-19, y=1, sculpt=paving)
    box(2, 1, 4, g.PATINA, x=12, y=1, z=-11, sculpt=paving)
    return paving


def parking_stair_core(g):
    # The door opens onto the covered lane. The narrow lights follow the stairs.
    core = box(32, 3, 21, g.MASONRY)
    box(28, 64, 18, g.MASONRY, y=3, sculpt=core)
    for x, y in ((-7, 26), (4, 36), (-7, 48)):
        core.cut((x - 3, x + 2), (y, y + 6), (6, 9))
        box(6, 7, 1, g.LIGHT, x=x, y=y, z=5, sculpt=core)
    core.cut((-5, 5), (3, 22), (6, 9))
    box(11, 19, 1, g.BODY, y=3, z=5, sculpt=core)
    box(3, 4, 1, g.LIGHT, x=2, y=15, z=6, sculpt=core)
    box(3, 1, 1, g.METAL, x=2, y=11, z=6, sculpt=core)
    box(16, 2, 5, g.METAL, y=23, z=10, sculpt=core)
    box(28, 2, 18, g.BODY, y=59, sculpt=core)
    box(30, 3, 20, g.DARK, y=67, sculpt=core)
    return core


def garage_tree_strip(g):
    soil = box(36, 3, 19, g.MASONRY)
    box(34, 2, 16, g.WOOD, y=3, sculpt=soil)
    for x, z in ((-12, 3), (-6, -2), (7, 2), (12, -3)):
        box(5, 2, 4, g.GRIT, x=x, y=4, z=z, sculpt=soil)
    return soil


def parking_return(kit, g, fixtures):
    # The return lane meets the inspection yard behind the arrivals hall.
    for x in (20, 24):
        for z in (0, -4, -8, -12, -16, -20):
            kit.place('Service road asphalt', x, z, 1, height=-0.2)
    # The inspection lane already supplies the pavement under the two earth tiles.
    for x in (12, 16):
        kit.remove_at('Yard embankment', x, -24, height=-0.25)
    for x in (18, 22, 26):
        kit.place('Service road asphalt', x, -24, 1, height=-0.2)
    for x, z in ((20, -8), (24, -12)):
        kit.remove_at('Service road asphalt', x, z, height=-0.2)
    kit.add('Parking return lane arrow', return_lane_arrow(g), 20, -8, height=-0.2)
    kit.place('Parking return lane arrow', 24, -12, 2, height=-0.2)
    kit.set_palette('Parking return lane arrow', secondary='#484f51', trim='#c1ba9c', skin='#686d66')
    kit.add('Set down kerb return', kerb_return(g), 18.95, -5.25)
    kit.set_palette('Set down kerb return', skin='#acae9e', trim='#e0d8b6')
    kit.add('Parking entrance canopy', parking_deck_bay(g, column_x=18), 23.85, -4.0, 3)
    kit.add('Parking deck bay', parking_deck_bay(g), 23.85, -8.4, 3)
    kit.add('Parking ventilation screen', parking_rear_screen(g), 26.0, -4.0, 3)
    for z in (-12.8, -17.2):
        kit.place('Parking deck bay', 23.85, z, 3)
        kit.place('Parking ventilation screen', 26.0, z, 3)
    kit.add('Parking stair tower', parking_stair_core(g), 26.33, -8.4, 3)
    kit.set_palette('Parking stair tower', skin='#ab8872', primary='#537569', visor='#738b87', metal='#9b9a84')
    kit.add('Parking tree strip', garage_tree_strip(g), 27.15, -3.55, 1, height=-0.2)
    kit.place('Yard poplar', 27.2, -3.68, 1, height=0.3)
    kit.set_palette('Parking tree strip', skin='#95846d', leather='#7e7155', secondary='#6b7353')
    kit.add('Parking entrance sign', parking_entry_sign(g), 21.76, -4.1, 3, height=3.55)
    for label in ('Parking deck bay', 'Parking entrance canopy'):
        kit.set_palette(label, skin='#a7947d', trim='#c9c8b3', primary='#50776c', metal='#63756e', accent='#c99754')
    kit.set_palette('Parking ventilation screen', skin='#ad9f89', primary='#778e82')
    kit.set_palette('Parking entrance sign', primary='#38645b', trim='#f0e7cb', accent='#dfb461')
    for z in (-3.6, -12.4):
        fixtures.append(dict(position=[23.05, 3.4, z], color='#ffdab1', intensity=5, distance=4))


def passenger_layby(kit, g, fixtures):
    kit.add('Drop off kerb', passenger_kerb(g), 10.6, -5.1)
    kit.place('Drop off kerb', 16.1, -5.1)
    kit.add('Dropped kerb crossing', kerb_cut(g), 13.34, -5.17)
    kit.set_palette('Dropped kerb crossing', skin='#bfc0aa', trim='#dbd4b3', accent='#b59256')
    kit.add('Set down landing', kerb_landing(g), 16.1, -6.9)
    kit.place('Set down landing', 13.0, -6.9)
    kit.add('Kerbside waiting shelter', layby_shelter(g), 16.0, -6.95, height=0.2)
    kit.set_palette('Set down landing', skin='#adae9f', secondary='#747c72')
    kit.add('Set down marker', layby_marker(g), 12.0, -5.45, height=0.2)
    kit.set_palette('Drop off kerb', skin='#acae9e', trim='#e0d8b6', accent='#b49255')
    kit.set_palette('Set down marker', primary='#35665d', trim='#ece7c9', accent='#c58948', visor='#69918a')
    kit.set_palette('Kerbside waiting shelter', primary='#466c62', trim='#d1cbb5', leather='#9a724d')
    fixtures.append(dict(position=[15.1, 2.95, -6.55], color='#ffe5b7', intensity=5, distance=4))


def curbside(kit, g):
    kit.add('Passenger drop off canopy', ticket_canopy(g), 6, -7.9)
    kit.place('Passenger drop off canopy', 2, -7.9)
    kit.add('Transit stop pylon', transit_pylon(g), 7.4, -5.45)
    kit.add('Terminal seat row', airport_seat(g), 0.7, -8.7, 1)
    kit.place('Terminal seat row', -1.6, -9.2)
    kit.place('Departure information board', 2.6, -7.7, height=1.8)
    kit.add('Boarding tactile strip', tactile_surface(g, True), 2.05, -5.55, height=-0.17)
    kit.place('Boarding tactile strip', 5.65, -5.55, height=-0.17)
    kit.set_palette('Boarding tactile strip', accent='#b39254', trim='#d6b66d')
    kit.add('Boarding clock', station_clock(g), 4.4, -7.6, height=1.8)
    kit.add('Boarding pass reader', boarding_reader(g), 6.9, -8.3)
    kit.place('Boarding pass reader', 5.15, -8.3)
    kit.set_palette('Boarding pass reader', primary='#7e8983', detail='#b96845')
    kit.place('Airside luggage trailer', 9.65, -6.8)
    kit.place('Red tagged suitcase', 9.65, -6.3, height=0.6)
    kit.place('Blue tagged suitcase', 9.65, -7.3, height=0.6)


def screening_desk(g):
    desk = box(23, 11, 10, g.MASONRY)
    box(24, 2, 12, g.CAP, y=11, sculpt=desk)
    box(19, 2, 1, g.MARK, y=8, z=5, sculpt=desk)
    box(4, 2, 4, g.DARK, x=-4, y=13, sculpt=desk)
    box(8, 6, 2, g.BODY, x=-4, y=15, sculpt=desk)
    box(6, 4, 1, g.LIGHT, x=-4, y=16, z=1, sculpt=desk)
    box(5, 1, 3, g.RUBBER, x=5, y=13, z=2, sculpt=desk)
    return desk


def desk_marker(g, number):
    marker = box(11, 12, 2, g.MARK)
    rows = ('110', '010', '010', '010', '111') if number == 1 else ('111', '001', '111', '100', '111')
    for row, digits in enumerate(rows):
        for col, digit in enumerate(digits):
            if digit == '1':
                box(2, 2, 1, g.CAP, x=-2 + col * 2, y=9 - row * 2, z=1, sculpt=marker)
    box(2, 5, 2, g.METAL, y=12, sculpt=marker)
    return marker


def carousel(g):
    reclaim = box(37, 4, 12, g.MASONRY)
    box(43, 4, 8, g.MASONRY, sculpt=reclaim)
    box(41, 3, 15, g.RUBBER, y=4, sculpt=reclaim)
    box(45, 3, 9, g.RUBBER, y=4, sculpt=reclaim)
    box(37, 2, 11, g.RUBBER, y=7, sculpt=reclaim)
    box(29, 3, 6, g.METAL, y=8, sculpt=reclaim)
    for x in range(-15, 16, 5):
        for z in (-6, 6):
            box(1, 1, 2, g.DARK, x=x, y=6, z=z, sculpt=reclaim)
    return reclaim


def reclaim_banner(g):
    sign = box(22, 9, 2, g.BODY)
    for x in (-8, 7):
        box(2, 6, 2, g.METAL, x=x, y=9, sculpt=sign)
    for z in (-1, 1):
        box(4, 4, 1, g.DETAIL, x=-7, y=2, z=z, sculpt=sign)
        box(8, 2, 1, g.CAP, x=2, y=5, z=z, sculpt=sign)
        box(6, 1, 1, g.CAP, x=1, y=2, z=z, sculpt=sign)
    return sign


def reclaim_area(kit, g):
    kit.add('Baggage reclaim carousel', carousel(g), 0.9, -13.4)
    kit.place('Red tagged suitcase', 0.0, -12.85, 1, height=0.7)
    kit.place('Blue tagged suitcase', 1.7, -13.95, height=0.7)
    kit.add('Baggage reclaim indicator', reclaim_banner(g), 0.9, -13.35, height=1.95)
    kit.set_palette('Baggage reclaim carousel', skin='#8b9b94', metal='#afb5a7', secondary='#505c55')
    kit.set_palette('Baggage reclaim indicator', primary='#3d6259', trim='#e4d8b2', detail='#dfa24f')


def terrazzo(g):
    slab = box(40, 2, 40, g.MASONRY)
    for x, z, w, d, shade in (
        (-16, -11, 2, 1, g.CAP),
        (-10, 6, 1, 2, g.PATINA),
        (-5, -4, 2, 1, g.METAL),
        (0, -15, 1, 1, g.CAP),
        (4, 5, 2, 1, g.CAP),
        (13, -12, 2, 1, g.PATINA),
        (16, 9, 1, 2, g.METAL),
        (8, 16, 2, 1, g.CAP),
        (-10, 14, 1, 2, g.CAP),
    ):
        box(w, 1, d, shade, x=x, y=1, z=z, sculpt=slab)
    box(40, 1, 1, g.WOOD, y=1, z=-20, sculpt=slab)
    box(1, 1, 40, g.WOOD, x=-20, y=1, sculpt=slab)
    return slab


def tactile_surface(g, warning):
    panel = box(32, 2, 7, g.MARK)
    if warning:
        for x in range(-13, 15, 4):
            for z in (-2, 1):
                box(2, 1, 2, g.CAP, x=x, y=2, z=z, sculpt=panel)
    else:
        for z in (-2, 1):
            box(30, 1, 1, g.CAP, y=2, z=z, sculpt=panel)
    return panel


def terminal_glazing(g):
    # Thin gaskets hold the upper panes above the passenger sightline.
    frame = box(39, 2, 4, g.METAL, y=19)
    for x in (-18, -5, 7, 18):
        box(2, 19, 4, g.METAL, x=x, sculpt=frame)
    box(39, 2, 3, g.DARK, y=13, sculpt=frame)
    for x, width in ((-11, 11), (1, 10), (13, 8)):
        box(width, 4, 1, g.LIGHT, x=x, y=15, sculpt=frame)
        box(width, 1, 1, g.CAP, x=x, y=18, z=1, sculpt=frame)
    return frame


def waiting_perch(g):
    seat = box(30, 3, 5, g.WOOD, y=8)
    for x in (-11, 10):
        box(2, 8, 3, g.METAL, x=x, sculpt=seat)
        box(5, 2, 5, g.DARK, x=x, sculpt=seat)
    box(29, 2, 3, g.WOOD, y=12, z=-2, sculpt=seat)
    for x in (-12, 10):
        box(2, 4, 2, g.METAL, x=x, y=9, z=-1, sculpt=seat)
    return seat


def luggage_trolley(g):
    trolley = box(9, 2, 13, g.METAL, y=2)
    for x in (-3, 3):
        for z in (-4, 4):
            box(2, 3, 3, g.RUBBER, x=x, z=z, sculpt=trolley)
        box(1, 9, 1, g.METAL, x=x, y=3, z=-5, sculpt=trolley)
    box(9, 2, 2, g.DARK, y=11, z=-5, sculpt=trolley)
    box(7, 3, 2, g.BODY, y=6, z=-5, sculpt=trolley)
    return trolley


def trolley_corral(g):
    corral = box(3, 2, 14, g.DARK, x=-11)
    for z in (-6, 6):
        for x in (-11, 10):
            box(2, 7, 2, g.METAL, x=x, z=z, sculpt=corral)
        box(24, 2, 2, g.METAL, y=7, z=z, sculpt=corral)
    box(2, 3, 12, g.BODY, x=-11, y=6, sculpt=corral)
    return corral


def dispatch_clipboard(g):
    desk = box(12, 2, 7, g.METAL, y=8)
    for x in (-4, 4):
        box(2, 8, 3, g.DARK, x=x, sculpt=desk)
    box(6, 1, 4, g.CAP, x=-1, y=10, sculpt=desk)
    box(4, 1, 1, g.MASONRY, x=-1, y=11, z=-1, sculpt=desk)
    box(3, 2, 4, g.DARK, x=4, y=10, sculpt=desk)
    box(2, 1, 2, g.LIGHT, x=4, y=12, sculpt=desk)
    box(7, 5, 2, g.BODY, x=2, y=11, z=-3, sculpt=desk)
    box(5, 3, 1, g.LIGHT, x=2, y=12, z=-1, sculpt=desk)
    box(3, 1, 1, g.DARK, x=1, y=13, z=0, sculpt=desk)
    return desk


def concourse(kit, g):
    selected = checked_group(
        kit, 'Baggage hall floor', [(x, z) for z in (-16, -12) for x in (-2, 2, 6)],
        lambda x, y, z: x >= -2 - 1e-6 and (near(z, -12) or near(z, -16)), height=-0.18,
    )
    first = selected.pop()
    x, y, z = first['position']
    kit.placements.remove(first)
    terrazzo_id = kit.add('Terrazzo concourse bay', terrazzo(g), x, z, height=y)
    for part in selected:
        part.update(propId=terrazzo_id)
    kit.add('Concourse guidance ribs', tactile_surface(g, False), 2, -8.7, 1, height=-0.19)
    kit.place('Concourse guidance ribs', 2, -11.7, 1, height=-0.19)
    kit.add('Concourse transom frame', terminal_glazing(g), 7.83, -12.0, 1, height=1.2)
    kit.place('Concourse transom frame', -2, -10.1, height=1.2)
    kit.place('Concourse transom frame', -0.1, -20, 1, height=1.2)
    kit.add('Covered waiting perch', waiting_perch(g), 6.4, -6.10)
    kit.add('Passenger luggage trolley', luggage_trolley(g), 4.0, -6.55, 1)
    kit.place('Passenger luggage trolley', 3.25, -6.55, 1)
    kit.add('Luggage trolley corral', trolley_corral(g), 3.5, -6.55)
    kit.add('Dispatch manifest ledge', dispatch_clipboard(g), -4.62, -9.98, 1, height=3)
    kit.set_palette(
        'Terrazzo concourse bay', skin='#aba99a', trim='#cfc9b7', metal='#888e85', leather='#827657'
    )
    kit.set_palette('Concourse guidance ribs', accent='#ba9354', trim='#cfac67')
    kit.set_palette('Concourse transom frame', metal='#92978a', visor='#749b95', trim='#b2c4b9')
    kit.set_palette('Covered waiting perch', leather='#ad8059', metal='#8e998a')
    kit.set_palette('Dispatch manifest ledge', trim='#eee2bb', visor='#78ada1')


def ramp_flight(g):
    ramp = box(19, 1, 12, g.MASONRY, z=12)
    for step in range(3):
        z = 12 - step * 12
        box(19, step + 1, 12, g.MASONRY, z=z, sculpt=ramp)
        for x in (-9, 8):
            box(1, 2, 12, g.WOOD, x=x, y=step + 10, z=z, sculpt=ramp)
            box(1, 9, 1, g.METAL, x=x, y=step + 1, z=z, sculpt=ramp)
    return ramp


def pavilion_deck(g):
    slab = box(30, 6, 28, g.MASONRY)
    box(30, 1, 1, g.METAL, y=5, z=13, sculpt=slab)
    for x, z in ((-8, 5), (-3, -8), (9, 2), (13, -5)):
        box(2, 1, 1, g.CAP, x=x, y=5, z=z, sculpt=slab)
    return slab


def pavilion_glass(g):
    face = box(30, 4, 4, g.WOOD)
    for x in (-14, 0, 13):
        box(2, 28, 3, g.METAL, x=x, y=4, sculpt=face)
    for y in (12, 26, 31):
        box(30, 2, 3, g.METAL, y=y, sculpt=face)
    for x in (-7, 7):
        box(12, 4, 1, g.LIGHT, x=x, y=27, sculpt=face)
        box(3, 10, 1, g.LIGHT, x=x - 4, y=15, sculpt=face)
        box(12, 1, 1, g.CAP, x=x, y=13, z=1, sculpt=face)
    return face


def vestibule_gate(g):
    gate = box(30, 3, 4, g.BODY, y=30)
    for x in (-14, 13):
        box(3, 30, 4, g.METAL, x=x, sculpt=gate)
        box(3, 4, 5, g.DARK, x=x, sculpt=gate)
    box(22, 2, 4, g.DARK, y=25, sculpt=gate)
    box(22, 1, 1, g.METAL, y=25, z=2, sculpt=gate)
    box(5, 3, 3, g.DARK, y=27, z=2, sculpt=gate)
    for x in (-11, 10):
        box(2, 23, 2, g.BODY, x=x, sculpt=gate)
        box(3, 5, 1, g.LIGHT, x=x, y=17, z=2, sculpt=gate)
    return gate


def hall_roof(g):
    roof = box(31, 2, 57, g.CAP)
    for i in range(3):
        box(8, 2, 57, g.BODY, x=-12 + 8 * i, y=2 + 2 * i, sculpt=roof)
    box(7, 8, 57, g.BODY, x=12, y=2, sculpt=roof)
    for z in (-23, -10, 3, 16):
        box(2, 4, 9, g.LIGHT, x=-15, y=2, z=z, sculpt=roof)
    return roof


def ramp_roof(g):
    cover = box(23, 2, 37, g.CAP, y=30)
    for z in (-15, 14):
        box(2, 30, 2, g.METAL, x=10, z=z, sculpt=cover)
        box(8, 2, 2, g.BODY, x=7, y=26, z=z, sculpt=cover)
        box(8, 2, 2, g.BODY, x=2, y=28, z=z, sculpt=cover)
    box(4, 1, 15, g.LAMP, y=29, sculpt=cover)
    box(2, 4, 37, g.WOOD, x=-11, y=29, sculpt=cover)
    return cover


def walking_sign(g):
    sign = box(13, 8, 2, g.BODY)
    for z in (-1, 0):
        for row, bits in enumerate(('010', '101', '111', '101', '101')):
            for col, bit in enumerate(bits):
                if bit == '1':
                    box(1, 1, 1, g.CAP, x=-5 + col, y=6 - row, z=z, sculpt=sign)
        box(5, 1, 1, g.MARK, x=2, y=4, z=z, sculpt=sign)
        for x, y in ((2, 6), (3, 5), (3, 3), (2, 2)):
            box(1, 1, 1, g.MARK, x=x, y=y, z=z, sculpt=sign)
    box(3, 3, 2, g.METAL, y=8, sculpt=sign)
    return sign


def hall_steps(g):
    stair = box(18, 1, 4, g.MASONRY)
    for i in range(1, 6):
        box(18, i + 1, 4, g.MASONRY, z=-4 * i, sculpt=stair)
        box(17, 1, 1, g.CAP, y=i, z=-4 * i + 1, sculpt=stair)
    return stair


def arrivals_fascia(g):
    letters = {
        'A': ('010', '101', '111', '101', '101'),
        'R': ('110', '101', '110', '101', '101'),
        'I': ('111', '010', '010', '010', '111'),
        'V': ('101', '101', '101', '101', '010'),
        'L': ('100', '100', '100', '100', '111'),
        'S': ('111', '100', '111', '001', '111'),
    }
    board = box(35, 10, 3, g.BODY)
    for index, letter in enumerate('ARRIVALS'):
        for row, bits in enumerate(letters[letter]):
            for col, bit in enumerate(bits):
                if bit == '1':
                    box(1, 1, 1, g.CAP, x=-15 + index * 4 + col, y=7 - row, z=1, sculpt=board)
    box(35, 1, 3, g.WOOD, y=9, sculpt=board)
    return board


def retaining_planter(g):
    bed = box(38, 5, 15, g.MASONRY)
    box(34, 2, 12, g.WOOD, y=5, sculpt=bed)
    for x, z, w, d, h in ((-12, 1, 8, 7, 6), (-5, -1, 7, 9, 9), (3, 1, 9, 8, 5), (11, -1, 8, 7, 8)):
        box(w, h, d, g.BODY, x=x, y=7, z=z, sculpt=bed)
        box(w - 3, 3, d - 2, g.GRIT, x=x, y=7 + h, z=z, sculpt=bed)
    return bed


def route_map(g):
    board = box(21, 15, 2, g.CAP)
    box(21, 3, 2, g.BODY, y=12, sculpt=board)
    box(17, 1, 1, g.MARK, y=7, z=1, sculpt=board)
    box(1, 9, 1, g.DETAIL, x=2, y=2, z=1, sculpt=board)
    box(6, 1, 1, g.DETAIL, x=4, y=2, z=1, sculpt=board)
    for x in (-8, -4, 6):
        box(1, 3, 1, g.DARK, x=x, y=6, z=1, sculpt=board)
    box(3, 3, 1, g.DARK, x=2, y=6, z=1, sculpt=board)
    box(1, 1, 1, g.CAP, x=2, y=7, z=1, sculpt=board)
    return board


def timber_back(g):
    wall = box(30, 19, 3, g.WOOD)
    for x in (-12, -6, 0, 6, 12):
        box(1, 18, 3, g.GRIT, x=x, y=1, sculpt=wall)
    box(30, 2, 4, g.METAL, y=18, sculpt=wall)
    return wall


def lounge_light(g):
    beam = box(25, 2, 5, g.WOOD, y=1)
    box(19, 1, 3, g.LAMP, sculpt=beam)
    for x in (-9, 8):
        box(3, 2, 3, g.METAL, x=x, y=3, sculpt=beam)
    return beam


def arrivals_pavilion(kit, g, fixtures):
    # The covered ramp rises 60 cm in 7.2 metres.
    kit.add('Arrivals access ramp', ramp_flight(g), 14.2, -9.8)
    kit.place('Arrivals access ramp', 14.2, -13.4, height=0.3)
    kit.add('Ramp shelter', ramp_roof(g), 14.18, -9.8)
    kit.place('Ramp shelter', 14.18, -13.4, height=0.3)
    kit.add('Arrivals plinth', pavilion_deck(g), 11.1, -16.6)
    for x, z in ((14.1, -16.6), (11.1, -19.4), (14.1, -19.4)):
        kit.place('Arrivals plinth', x, z)
    kit.add('Arrivals entrance frame', vestibule_gate(g), 14.1, -15.3, height=0.6)
    kit.place('Arrivals entrance frame', 9.65, -16.6, 3, height=0.6)
    kit.add('Arrivals curtain wall', pavilion_glass(g), 11.1, -15.3, height=0.6)
    for x, z, turn in (
        (11.1, -20.72, 2),
        (14.1, -20.72, 2),
        (15.53, -16.6, 1),
        (15.53, -19.4, 1),
        (9.65, -19.4, 3),
    ):
        kit.place('Arrivals curtain wall', x, z, turn, height=0.6)
    kit.add('Arrivals clerestory roof', hall_roof(g), 11.1, -18, height=3.9)
    kit.place('Arrivals clerestory roof', 14.1, -18, 2, height=3.9)
    kit.add('Hall link steps', hall_steps(g), 8.66, -16.35, 3)
    kit.add('Passenger entrance sign', walking_sign(g), 14.1, -15.0, height=2.84)
    kit.place('Passenger entrance sign', 13.0, -12.2, 1, height=2.18)
    kit.place('Terminal seat row', 10.65, -18.65, 1, height=0.6)
    kit.place('Covered waiting perch', 13.7, -20.1, 2, height=0.6)
    kit.place('Departure information board', 15.24, -19.25, 3, height=2.05)
    kit.place('Boarding clock', 10.7, -16.8, height=2.2)
    kit.place('Blue tagged suitcase', 11.6, -18.8, height=0.6)
    kit.place('Passenger luggage trolley', 13.8, -19.3, height=0.6)
    kit.place('Boarding pass reader', 15.0, -16.6, height=0.6)
    kit.add('Arrivals fascia', arrivals_fascia(g), 12.6, -15.05, height=3.88)
    kit.add('Timber waiting wall', timber_back(g), 14.05, -20.55, height=0.6)
    kit.place('Timber waiting wall', 15.48, -19.25, 3, height=0.6)
    kit.add('Pavilion route map', route_map(g), 14.0, -20.34, height=1.55)
    kit.add('Terminal garden bed', retaining_planter(g), 18.45, -7.6, 1)
    for z in (-11.4, -15.2, -19):
        kit.place('Terminal garden bed', 18.45, z, 1)
    kit.set_palette('Terminal garden bed', skin='#bdb9a1', leather='#746751', primary='#768b61')
    kit.set_palette('Timber waiting wall', leather='#a47a54', primary='#756045', metal='#a4a591')
    kit.set_palette('Pavilion route map', primary='#567561', trim='#d8d2b8', accent='#689383')
    kit.set_palette('Arrivals fascia', primary='#3e6858', trim='#f1e7c9', leather='#b78d5d')
    kit.add('Lounge ceiling light', lounge_light(g), 11.1, -18.65, height=3.4)
    kit.place('Lounge ceiling light', 14.1, -18.4, height=3.4)
    for x, z in ((11.1, -18.65), (14.1, -18.4)):
        fixtures.append(dict(position=[x, 3.36, z], color='#ffdfb2', intensity=8, distance=5))
    kit.set_palette('Arrivals access ramp', skin='#c0baa8', leather='#ab8161', metal='#9da69a')
    kit.set_palette('Arrivals plinth', skin='#b6b4a2', trim='#d2c8a9', metal='#7f9788')
    kit.set_palette(
        'Arrivals curtain wall', leather='#ab7d56', metal='#8b9b91', visor='#81a59e', trim='#dce1ca'
    )
    kit.set_palette('Arrivals entrance frame', primary='#4a7268', metal='#b1b6a3', visor='#a1bcab')
    kit.set_palette('Arrivals clerestory roof', primary='#768e7a', trim='#dbd2bd', visor='#97b3a6')
    kit.set_palette('Ramp shelter', leather='#ad7c59', primary='#63816b', trim='#e3d6ba', metal='#939f8d')
    kit.set_palette('Passenger entrance sign', primary='#385e51', trim='#f2ead0', accent='#eab75b')
    kit.set_palette('Hall link steps', skin='#b6b4a2', trim='#dad0a9')
    fixtures.append(dict(position=[14.2, 2.86, -9.8], color='#fff0ce', intensity=11, distance=6))
    fixtures.append(dict(position=[14.2, 3.16, -13.4], color='#fff0ce', intensity=11, distance=6))


def security(kit, g, stops, fixtures):
    kit.placement_at('Yard poplar', 14, -17).update(position=[18.6, 0, -20.0])
    kit.placement_at('Service line pole', 16.4, -7).update(position=[18.25, 0, -12.0])
    kit.placement_at('Service road curb', 8, -15).update(position=[15.7, -0.12, -12.0], turn=1)
    kit.placement_at('Queue rail', 4.4, -14.5).update(position=[5.0, 0, -14.55], turn=0)
    kit.placement_at('Transit bench island', 6.8, -17).update(position=[6.55, 0, -17.57], turn=0)
    kit.placement_at('Camera pod', 7.5, -15.4).update(position=[7.6, 0, -14.5], turn=1)
    kit.placement_at('Service yard boundary', 12, -21).update(position=[17.7, 0, -22.7], turn=0)
    kit.placement_at('Patrol rover', 10.6, -13.4).update(position=[10.4, 0, -23.5], turn=3)
    kit.placement_at('Parking barrier arm', 11.5, -20.6).update(position=[11.5, 0, -22.5])
    kit.placement_at('Roadside shade tree', 10.4, -1.5).update(position=[14.6, 0, 3.3])
    kit.placement_at('Roadside earth bed', 10.8, -2).update(position=[15, -0.1, 2.8])
    kit.placement_at('Ticket kiosk', 4.6, -16.7).update(position=[3.9, 0, -11.75], turn=3)
    paving = checked_group(
        kit, 'Yard embankment', [(12, 0), (12, 4)],
        lambda x, y, z: (near(x, 12) or near(x, 16)) and (near(z, 0) or near(z, 4)), height=-0.25,
    )
    pave_bays(kit, paving)
    kit.placement_at('Baggage hall solid', 2, -10, height=0).update(propId=kit.prop_id('Baggage hall door'))
    kit.add('Transfer sorting deck', gallery(g, g.MASONRY, g.CAP, rear_rail=False), -10, -13)
    for x in (-14, -6):
        kit.place('Transfer sorting deck', x, -13)
    kit.place('Transfer sorting deck', -10, -15.1)
    kit.place('Transfer sorting deck', -10.7, -17.1)
    kit.add('Transfer deck guard', g.fence(38, 11, g.CAP), -10.75, -18.05, height=3)
    kit.place('Transfer deck guard', -2.3, -8.45, height=3)
    kit.place('Transfer sorting deck', -5.1, -10.7, 1)
    kit.place('Transfer sorting deck', -2.3, -9.4, 2)
    kit.add('Apron access stairs', stairs(g, g.CAP), -14.4, -7.45)
    kit.place('Apron access stairs', -14.4, -10.45, height=1.5)
    kit.add('Apron stair bearers', stair_bearers(g), -14.4, -10.45)
    kit.add('Apron cantilever canopy', sorter_canopy(g), -10, -13.3, height=3)
    for x in (-14, -6):
        kit.place('Apron cantilever canopy', x, -13.3, height=3)
    kit.add('Inclined transfer conveyor', sloping_belt(g), -10.8, -9.0)
    kit.add('Parcel transfer rollers', belt(g), -10.8, -4.1)
    kit.place('Parcel transfer rollers', -10.8, -13.9, height=2.9)
    kit.add('Red tagged suitcase', luggage(g, g.DETAIL), -10.7, -4.4, height=1.2)
    kit.add('Blue tagged suitcase', luggage(g, g.MARK), -10.9, -7.5, height=1.9)
    kit.place('Red tagged suitcase', -10.8, -10.7, 1, height=3.5)
    kit.place('Blue tagged suitcase', -10.8, -13.9, height=4.1)
    kit.add('Airside luggage trailer', cart(g), -8.4, -6)
    kit.place('Airside luggage trailer', -8.4, -2.7)
    for z in (-6.6, -5.6, -2.7):
        kit.place('Red tagged suitcase', -8.3, z, 1, height=0.6)
        kit.place('Blue tagged suitcase', -8.8, z, 1, height=0.6)
    kit.add('Departure information board', destination_board(g), -7, -11.65, height=4.35)
    kit.place('Departure information board', 4.25, -14.0, height=1.6)
    kit.add('Check in desk', g.counter(23, 11, g.CAP, g.BODY, shelf=True), -7.2, -13.5, height=3)
    kit.add('Desk terminal', g.case(8, 8, 5, g.DARK, g.METAL, screen=True), -7.1, -13.4, height=4.1)
    kit.place('Parcel transfer rollers', 2.9, -17.8)
    kit.place('Red tagged suitcase', 2.9, -17.4, height=1.2)
    kit.place('Blue tagged suitcase', 2.9, -18.5, height=1.2)
    kit.place('Service road asphalt', 16, 0, height=-0.15)
    curbside(kit, g)
    concourse(kit, g)
    reclaim_area(kit, g)
    kit.place('Transfer sorting deck', -14, -15.1)
    kit.add('Sorting control cabin', dispatch_cabin(g), -14.65, -15.1, height=3)
    kit.place('Check in desk', -14.7, -15.45, height=3.2)
    kit.place('Desk terminal', -14.35, -15.45, height=4.3)
    kit.add('Cargo handling bay', cargo_facade(g), -14.8, -21.9)
    kit.place('Cargo handling bay', -10.0, -21.9)
    kit.add('Cargo bay roof', g.roof(48, 38, g.MASONRY), -14.8, -23.7, height=4.7)
    kit.place('Cargo bay roof', -10.0, -23.7, height=4.7)
    baggage_depot(kit, g)
    for x in (-14.8, -10.0):
        kit.place('Service yard boundary', x, -25.4)
        kit.place('Airside luggage trailer', x, -22.5)
        kit.place('Blue tagged suitcase', x, -22.5, height=0.6)
    kit.add('Baggage transfer sign', baggage_sign(g), -11.8, -11.65, height=4.2)
    kit.place('Baggage transfer sign', 5.75, -7.85, height=2.05)
    kit.placement_at('Baggage hall trade sign', 6, -9.75, height=3).update(position=[-13.8, 5.8, -14.1], turn=0)
    kit.placement_at('Baggage hall letter board', 8.1, -9.8, height=3.5).update(position=[4.05, 3.7, -6.05], turn=0)
    kit.set_palette('Baggage transfer sign', secondary='#284c45', trim='#fff2d6', accent='#edc360')
    kit.set_palette('Transfer sorting deck', skin='#a69578', trim='#d1bc8f', secondary='#43514e')
    kit.set_palette('Sorting control cabin', primary='#587369', trim='#dbd8c5', skin='#a79d88')
    kit.set_palette(
        'Cargo handling bay', primary='#657e74', trim='#c7bda4', metal='#7b8e88', skin='#afae98'
    )
    kit.set_palette('Apron cantilever canopy', primary='#675f4d', trim='#d9d3bf', accent='#d69c44')
    kit.set_palette('Apron access stairs', metal='#949c9d', trim='#d6ae5c')
    kit.set_palette('Airside luggage trailer', trim='#b9b7a8', accent='#dda546')
    kit.set_palette('Blue tagged suitcase', accent='#277b86', trim='#e2d8b9')
    kit.set_palette('Red tagged suitcase', detail='#a64b38', trim='#e2d8b9')
    kit.set_palette('Passenger drop off canopy', trim='#dfdcd0', detail='#b76a3e', accent='#7d9f8d')
    kit.set_palette('Terminal seat row', detail='#ad603d', metal='#b5a998')
    kit.set_palette('Departure information board', accent='#eac767', trim='#dce3d0')
    kit.add('Passenger screening desk', screening_desk(g), 0.8, -16.9, 0)
    kit.place('Passenger screening desk', 4.7, -16.9, 0)
    kit.add('Desk one marker', desk_marker(g, 1), 0.8, -16.8, 0, height=1.7)
    kit.add('Desk two marker', desk_marker(g, 2), 4.7, -16.8, 0, height=1.7)
    for label in ('Desk one marker', 'Desk two marker'):
        kit.set_palette(label, accent='#a46843', trim='#ffedcc')
    kit.set_palette(
        'Passenger screening desk', skin='#87988a', trim='#d7d0b9', accent='#a87648', visor='#82c9ca'
    )
    arrivals_pavilion(kit, g, fixtures)
    passenger_layby(kit, g, fixtures)
    parking_return(kit, g, fixtures)
    stops[0].update(label='Arrivals pavilion', eye=[9.15, 1.65, -8.65], target=[13.4, 2.4, -17.0])
    stops[1].update(label='Screening desks', eye=[-1.9, 1.65, -11.3], target=[3.1, 1.65, -16.55])
    stops[2].update(label='Passenger drop off', eye=[9.5, 1.6, -0.25], target=[14.6, 1.75, -8.0])
    stops.append(dict(label='Transfer sorting deck', eye=[-2.4, 4.65, -9.4], target=[-11, 3.2, -12]))
    stops.append(dict(label='Arrivals waiting room', eye=[14.4, 2.25, -16.2], target=[11.8, 1.8, -19.5]))
    fixtures.append(dict(position=[4.3, 3.25, -7.75], color='#ffe2b2', intensity=14, distance=7))
    fixtures.append(dict(position=[-10, 5.8, -13.2], color='#e9faff', intensity=14, distance=8))


def near(a, b):
    return abs(a - b) <= 1e-6


def checked_group(kit, label, positions, includes, *, height):
    prop_id = kit.prop_id(label)
    count = sum(
        part['propId'] == prop_id and includes(*part['position'])
        for part in kit.placements
    )
    if count != len(positions):
        raise ValueError(f'{label}: expected {len(positions)} placements in the selected area, found {count}.')
    return [kit.placement_at(label, x, z, height=height) for x, z in positions]


def pave_bays(kit, placements):
    for part in placements:
        x, _, z = part['position']
        part.update(propId=kit.prop_id('Service road asphalt'), position=[x, -0.15, z])


def upgrade(kit, g, stops, fixtures):
    # A paved apron carries the trailer wheels and the gallery footings.
    apron = checked_group(
        kit, 'Yard embankment', [(x, z) for x in (-16, -12) for z in (-20, -16, -12, -8, -4)],
        lambda x, y, z: x <= -12 + 1e-6 and -20 - 1e-6 <= z <= -4 + 1e-6, height=-0.25,
    )
    pave_bays(kit, apron)
    if kit.key == 'industrial':
        industrial(kit, g, stops, fixtures)
    elif kit.key == 'security':
        security(kit, g, stops, fixtures)
