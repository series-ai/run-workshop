"""Working equipment for the six level demonstrations."""

from level_geometry import box


def wheel_service(kit, g):
    hose = box(12, 1, 1, g.RUBBER, x=-4, z=3)
    box(1, 1, 7, g.RUBBER, x=2, z=0, sculpt=hose)
    box(7, 1, 1, g.RUBBER, x=5, z=-3, sculpt=hose)
    box(1, 4, 1, g.RUBBER, x=-9, z=3, sculpt=hose)
    box(2, 1, 1, g.METAL, x=-9, y=4, z=3, sculpt=hose)
    box(1, 8, 1, g.RUBBER, x=8, z=-3, sculpt=hose)
    box(2, 1, 1, g.METAL, x=8, y=8, z=-3, sculpt=hose)
    kit.add('Service air hose', hose, -7.56, -13.62, height=0.02)
    kit.set_palette('Service air hose', hair='#272c2d', metal='#a4aba5', accent='#b99049')
    kit.place('Wheel balancing rim', -8.95, -13.98, 1, 0.02)
    impact = box(5, 2, 2, g.GRIT, y=3)
    box(2, 2, 2, g.METAL, x=-3, y=3, sculpt=impact)
    box(2, 3, 2, g.RUBBER, x=1, sculpt=impact)
    box(2, 1, 2, g.MARK, x=1, y=0, sculpt=impact)
    kit.add('Air impact wrench', impact, -6.8, -13.93, height=.82)
    kit.set_palette('Air impact wrench', primary='#a77038', hair='#292e2c',
                    metal='#a4aba5', accent='#a18450')


def press_proofing(kit, g):
    stand = box(10, 2, 7, g.DARK, y=0)
    for x in (-4, 3):
        box(2, 7, 6, g.BODY, x=x, y=1, sculpt=stand)
    box(12, 1, 9, g.METAL, y=8, sculpt=stand)
    box(11, 1, 6, g.WOOD, y=9, z=-1, sculpt=stand)
    box(8, 1, 5, g.CAP, y=10, x=-1, z=-1, sculpt=stand)
    for z in (-2, 0):
        stand.paint((-4, 1), 10, z, g.DETAIL)
    box(3, 2, 2, g.METAL, y=9, x=4, z=3, sculpt=stand)
    box(3, 1, 1, g.MARK, y=11, x=4, z=3, sculpt=stand)
    stand.paint((2, 4), 8, 4, g.CAP)
    kit.add('Press proofing station', stand, 1.55, -9.35, 1)
    kit.set_palette('Press proofing station', primary='#576d68', trim='#d9cfad',
                    detail='#403a37', metal='#8b8e80', accent='#b08353')


def ingot_cooling(kit, g):
    rack = box(14, 2, 8, g.DARK)
    for x in (-5, 5):
        box(2, 5, 7, g.METAL, x=x, y=1, sculpt=rack)
    for z in (-3, 0, 3):
        box(14, 1, 1, g.METAL, y=5, z=z, sculpt=rack)
    for x, color in ((-4, g.DETAIL), (0, g.GRIT), (4, g.CAP)):
        box(3, 2, 6, color, x=x, y=6, sculpt=rack)
        box(2, 1, 4, color, x=x, y=8, sculpt=rack)
    box(3, 2, 1, g.WOOD, x=4, y=3, z=4, sculpt=rack)
    kit.add('Ingot cooling rack', rack, 1.15, -17.6)
    kit.set_palette('Ingot cooling rack', detail='#ac624a', primary='#826e59',
                    trim='#c1aa82', metal='#6f786e')


def secondary_inspection(kit, g):
    bench = box(11, 2, 7, g.DARK)
    for x in (-4, 4):
        box(2, 6, 6, g.BODY, x=x, y=2, sculpt=bench)
    box(13, 1, 8, g.METAL, y=8, sculpt=bench)
    box(8, 1, 6, g.DARK, x=-1, y=9, sculpt=bench)
    bench.box((-5, 2), 10, -3, g.DETAIL)
    bench.box((-5, 2), 10, 2, g.DETAIL)
    bench.box(-5, 10, (-2, 1), g.DETAIL)
    bench.box(2, 10, (-2, 1), g.DETAIL)
    box(4, 1, 3, g.CAP, x=-1, y=10, sculpt=bench)
    box(2, 4, 2, g.METAL, x=5, y=9, z=-2, sculpt=bench)
    box(3, 2, 2, g.BODY, x=5, y=12, z=-1, sculpt=bench)
    box(2, 1, 1, g.MARK, x=5, y=12, z=0, sculpt=bench)
    bench.paint((-3, 1), 8, 3, g.CAP)
    kit.add('Secondary inspection station', bench, 3.55, -15.15)
    kit.set_palette('Secondary inspection station', detail='#b2754d', trim='#d5c8ab',
                    primary='#426070', metal='#a0aeb0', accent='#b5dec9')


def survey_equipment(kit, g):
    stool = box(8, 1, 7, g.WOOD, y=4)
    for x in (-3, 3):
        box(2, 4, 5, g.WOOD, x=x, sculpt=stool)
    box(6, 3, 4, g.DARK, y=5, sculpt=stool)
    box(6, 1, 1, g.METAL, y=8, z=-2, sculpt=stool)
    box(6, 1, 3, g.BODY, y=8, z=0, sculpt=stool)
    box(4, 1, 2, g.CAP, y=9, x=-1, sculpt=stool)
    stool.paint((-2, 0), 9, -1, g.DETAIL)
    box(2, 1, 2, g.METAL, y=9, x=2, sculpt=stool)
    kit.add('Ranger field kit', stool, .9, -13.78, 1)
    kit.set_palette('Ranger field kit', primary='#68714d', leather='#735940',
                    trim='#d6cda5', detail='#82865d', metal='#a1ac99')


def copper_quench(kit, g):
    trough = box(11, 2, 6, g.WOOD)
    for x in (-4, 3):
        box(2, 3, 5, g.WOOD, x=x, y=1, sculpt=trough)
    box(11, 1, 7, g.DARK, y=4, sculpt=trough)
    trough.box((-5, 5), (5, 8), (-3, -2), g.DETAIL)
    trough.box((-5, 5), (5, 8), (2, 3), g.DETAIL)
    trough.box((-5, -4), (5, 8), (-1, 1), g.DETAIL)
    trough.box((4, 5), (5, 8), (-1, 1), g.DETAIL)
    trough.paint((-4, 4), 8, (-3, -2), g.METAL)
    trough.box((-3, 3), 6, (-1, 1), g.LIGHT)
    box(6, 1, 1, g.DARK, x=1, y=9, z=2, sculpt=trough)
    box(2, 1, 1, g.METAL, x=-2, y=9, z=2, sculpt=trough)
    kit.add('Copper quench trough', trough, -7.35, 4.3, 1)
    kit.set_palette('Copper quench trough', detail='#945741', metal='#b57953',
                    leather='#765639', visor='#536f68')


WORKSTATIONS = {
    'core': wheel_service,
    'heist': press_proofing,
    'industrial': ingot_cooling,
    'security': secondary_inspection,
    'creatures': survey_equipment,
    'fantasy': copper_quench,
}
