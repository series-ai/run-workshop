/** RUN voxel space pack effects (ids `rvx-space-*`). PN mecha theme: steel
 * and iron, cyan energy, gold hazard, orange thrust, toxic-green xeno. */
import { FIRE, hex, SMOKE, theme, WHITE, type RvxRecipe } from './common'
import { beam, bolt, burst, dim, exhaust, mist, motes, muzzle, orbit, slash, spray, waves } from './kit'

const t = theme('space')
const id = (slug: string, label: string) => ({ id: `rvx-space-${slug}`, label: `RUN Space ${label}` })

const XENO = [t('toxic', 5), t('toxic', 6), t('lime', 6)]
const JET = [
  { t: 0, c: WHITE },
  { t: 0.3, c: t('cyan', 7) },
  { t: 1, c: t('cyan', 5) },
] as { t: number; c: [number, number, number, number] }[]

export const SPACE_RECIPES: RvxRecipe[] = [
  // ---------------------------------------------------------------- loops
  orbit({ ...id('shield-dome', 'shield dome'), source: 'shield generator field', effectType: 'shield', role: 'loop' }, {
    colors: [t('cyan', 6), t('cyan', 7)],
    core: dim(t('cyan', 5), 0.28),
    ring: t('cyan', 6),
    radius: 0.55,
    spin: 1.2,
    rise: 0,
  }),
  beam({ ...id('teleport-beam', 'teleport beam'), source: 'teleporter pad', effectType: 'portal', role: 'beam' }, {
    color: t('cyan', 7),
    motes: [t('cyan', 7), WHITE],
    length: 2.4,
    width: 0.8,
  }),
  beam({ ...id('tractor-beam', 'tractor beam'), source: 'UFO saucer beam', effectType: 'sci-fi', role: 'beam' }, {
    color: t('lime', 6),
    motes: [t('lime', 7), WHITE],
    length: 2.2,
    width: 0.9,
  }),
  motes({ ...id('spore-drift', 'spore drift'), source: 'alien hive spores', effectType: 'environment', role: 'loop' }, {
    colors: XENO,
    glints: [t('lime', 7)],
    halo: dim(t('toxic', 5), 0.2),
    spread: 0.6,
    rise: 1.5,
  }),
  mist({ ...id('launch-steam', 'launch steam'), source: 'launch pad', effectType: 'smoke', role: 'loop' }, {
    colors: [hex('#eef3f5'), hex('#d9e1e4'), t('gray', 7)],
    width: 1.2,
    rate: 8,
  }),
  exhaust({ ...id('engine-exhaust', 'engine exhaust'), source: 'freighter, shuttle and fighter engines', effectType: 'movement', role: 'trail' }, {
    jet: JET,
    halo: dim(t('cyan', 6), 0.4),
    smoke: [t('gray', 7), t('steel', 6)],
    rate: 6,
  }),
  exhaust({ ...id('hover-thrust', 'hover thrust'), source: 'hover bike', effectType: 'movement', role: 'trail' }, {
    jet: [
      { t: 0, c: WHITE },
      { t: 0.4, c: t('orange', 7) },
      { t: 1, c: t('orange', 5) },
    ],
    halo: dim(t('orange', 6), 0.35),
    smoke: [t('gray', 7), t('gray', 6)],
  }),
  // ---------------------------------------------------------------- one-shots
  bolt({ ...id('laser-bolt', 'laser bolt'), source: 'turret, rifles, pistol, cannon, fighter guns', effectType: 'projectile', role: 'projectile' }, {
    core: WHITE,
    edge: t('cyan', 6),
    sparks: [t('cyan', 7), WHITE],
  }),
  bolt({ ...id('ray-bolt', 'ray bolt'), source: 'ray gun', effectType: 'projectile', role: 'projectile' }, {
    core: WHITE,
    edge: t('lime', 6),
    sparks: [t('lime', 7), t('magenta', 7)],
  }),
  burst({ ...id('shield-hit', 'shield hit'), source: 'shield generator hit, energy shield', effectType: 'shield', role: 'impact' }, {
    flash: dim(t('cyan', 6), 0.6),
    ring: { color: t('cyan', 7), kind: 'face' },
    sparks: [t('cyan', 7), WHITE],
    sparkCount: 12,
    cubes: [t('cyan', 6), t('cyan', 7)],
    cubeCount: 6,
  }),
  burst({ ...id('data-burst', 'data burst'), source: 'loot cache', effectType: 'loot', role: 'reward' }, {
    flash: dim(t('cyan', 6), 0.6),
    star: t('cyan', 7),
    cubes: [t('cyan', 6), t('cyan', 7), t('gold', 7)],
    cubeCount: 12,
    ground: true,
  }),
  muzzle({ ...id('cannon-blast', 'cannon blast'), source: 'mech walker cannons', effectType: 'weapon', role: 'release' }, {
    flash: dim(t('orange', 7), 0.8),
    core: FIRE.white,
    smoke: [SMOKE.light, SMOKE.mid],
    sparks: [FIRE.yellow, t('orange', 7)],
    big: true,
  }),
  beam({ ...id('ray-zap', 'ray zap'), source: 'UFO drone attack', effectType: 'sci-fi', role: 'beam' }, {
    color: t('lime', 7),
    motes: [t('lime', 7), WHITE],
    length: 1.6,
    width: 0.35,
    oneShotDuration: 0.6,
  }),
  spray({ ...id('acid-spray', 'acid spray'), source: 'xeno queen attack', effectType: 'elemental', role: 'release' }, {
    kind: 'puff',
    colors: XENO,
    embers: [t('lime', 7), t('toxic', 6)],
    length: 2,
  }),
  burst({ ...id('goo-shot', 'goo shot'), source: 'bio blaster', effectType: 'projectile', role: 'release' }, {
    pieces: { texture: 'rvx-drop', colors: XENO, count: 8, size: 0.14, gravity: 0.8 },
    puffs: [t('toxic', 6), t('lime', 6)],
    reach: 0.8,
  }),
  burst({ ...id('holo-scan', 'holo scan'), source: 'data pad, scanner', effectType: 'ui', role: 'charge' }, {
    ring: { color: t('cyan', 7), kind: 'flat' },
    cubes: [t('cyan', 6), t('cyan', 7)],
    cubeCount: 8,
    star: t('cyan', 7),
    reach: 0.8,
  }),
  burst({ ...id('gravity-slam', 'gravity slam'), source: 'gravity hammer', effectType: 'impact', role: 'impact' }, {
    flash: dim(t('purple', 6), 0.7),
    ring: { color: t('purple', 7), kind: 'flat' },
    star: t('purple', 7),
    cubes: [t('purple', 6), t('steel', 6), t('purple', 7)],
    cubeCount: 10,
    ground: true,
  }),
  burst({ ...id('plasma-blast', 'plasma blast'), source: 'plasma grenade', effectType: 'impact', role: 'burst' }, {
    flash: dim(t('cyan', 7), 0.9),
    ring: { color: t('cyan', 7), kind: 'flat' },
    puffs: [t('cyan', 6), t('steel', 6), t('gray', 7)],
    cubes: [t('cyan', 7), WHITE, t('steel', 5)],
    sparks: [t('cyan', 7), WHITE],
    sparkCount: 14,
    reach: 1.2,
  }),
  slash({ ...id('plasma-slash', 'plasma slash'), source: 'plasma sword', effectType: 'weapon', role: 'trail' }, {
    edge: WHITE,
    body: t('cyan', 6, 0.9),
  }),
  burst({ ...id('stun-arc', 'stun arc'), source: 'stun baton', effectType: 'elemental', role: 'impact' }, {
    flash: dim(t('cyan', 6), 0.7),
    star: t('cyan', 7),
    sparks: [t('cyan', 7), WHITE],
    sparkCount: 14,
    reach: 0.7,
  }),
  spray({ ...id('weld-sparks', 'weld sparks'), source: 'welding torch', effectType: 'fire', role: 'release' }, {
    kind: 'fire',
    tint: JET,
    embers: [FIRE.yellow, FIRE.white],
    length: 0.6,
    duration: 0.9,
  }),
  waves({ ...id('warp-jump', 'warp jump'), source: 'shuttle warp', effectType: 'portal', role: 'despawn' }, {
    color: t('cyan', 7),
    face: true,
    count: 3,
    size: 1.6,
    motes: [t('cyan', 7), WHITE],
  }),
]
