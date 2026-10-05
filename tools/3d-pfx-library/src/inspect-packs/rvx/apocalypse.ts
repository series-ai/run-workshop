/** RUN voxel post-apocalypse pack effects (ids `rvx-apocalypse-*`). PN woods,
 * mecha steel and zombie greens: rust, khaki dust, oily smoke, toxic green,
 * gore red and hot muzzle yellow. */
import { FIRE, hex, SMOKE, theme, WHITE, type RvxRecipe } from './common'
import { beam, bubbles, burst, dim, exhaust, fire, lampGlow, muzzle, slam, smokeColumn, spray } from './kit'

const t = theme('apocalypse')
const id = (slug: string, label: string) => ({ id: `rvx-apocalypse-${slug}`, label: `RUN Apocalypse ${label}` })

const OILY = [SMOKE.dark, hex('#3f3b38'), SMOKE.mid]
// Exhaust: oily but light enough to read over dark ground and dark bodies.
const EXHAUST = [SMOKE.mid, SMOKE.light, hex('#6f6964')]
const DUST = [t('sand', 6), t('khaki', 6), t('sand', 5)]
const TOXIC = [t('toxic', 5), t('toxic', 6), t('moss', 6)]
const GORE = [t('red', 3), t('red', 4), hex('#6e1a14')]

export const APOCALYPSE_RECIPES: RvxRecipe[] = [
  // ---------------------------------------------------------------- loops
  fire({ ...id('barrel-fire', 'barrel fire'), source: 'burning barrel, campfire', effectType: 'fire', role: 'loop' }, {
    kind: 'hearth',
    smoke: OILY,
  }),
  fire({ ...id('wick-flame', 'wick flame'), source: 'molotov wick', effectType: 'fire', role: 'loop' }, { kind: 'torch', smoke: [SMOKE.dark], follow: true }),
  smokeColumn({ ...id('exhaust-smoke', 'exhaust smoke'), source: 'generator, raider bot, chainsaw, armored van', effectType: 'smoke', role: 'loop' }, {
    colors: EXHAUST,
    rate: 6,
    rise: 1.3,
  }),
  smokeColumn({ ...id('chimney-smoke', 'chimney smoke'), source: 'survivor shack chimney', effectType: 'smoke', role: 'loop' }, {
    colors: [SMOKE.light, SMOKE.mid, t('khaki', 6)],
  }),
  smokeColumn({ ...id('toxic-vent', 'toxic vent'), source: 'mutant behemoth vents', effectType: 'smoke', role: 'loop' }, {
    colors: TOXIC,
    rate: 5,
    embers: [t('toxic', 7)],
  }),
  lampGlow({ ...id('lamp-flicker', 'lamp flicker'), source: 'street lamp bulb', effectType: 'aura', role: 'loop' }, {
    halo: dim(t('gold', 7), 0.6),
    motes: [t('gold', 7), WHITE],
  }),
  bubbles({ ...id('toxic-bubbles', 'toxic bubbles'), source: 'toxic barrel, bloated zombie', effectType: 'environment', role: 'loop' }, {
    bubble: [t('toxic', 6), t('toxic', 5)],
    chips: [t('toxic', 7)],
    width: 0.5,
  }),
  bubbles({ ...id('toxic-pool', 'toxic pool'), source: 'toxic pool', effectType: 'environment', role: 'loop' }, {
    bubble: [t('toxic', 6), t('toxic', 5)],
    fume: TOXIC,
    chips: [t('toxic', 7)],
    width: 1,
  }),
  beam({ ...id('searchlight', 'searchlight'), source: 'watchtower light', effectType: 'environment', role: 'beam' }, {
    color: hex('#fff3c4'),
    length: 3,
    width: 0.7,
  }),
  beam({ ...id('flashlight-beam', 'flashlight beam'), source: 'flashlight', effectType: 'environment', role: 'beam' }, {
    color: hex('#fff3c4'),
    length: 2.4,
    width: 0.55,
  }),
  exhaust({ ...id('engine-smoke', 'engine smoke'), source: 'van, pickups, bus, buggy, motorbike exhausts', effectType: 'movement', role: 'trail' }, {
    smoke: EXHAUST,
    rate: 9,
    lift: 0.6,
  }),
  exhaust({ ...id('dust-kick', 'dust kick'), source: 'mutant dog paws', effectType: 'movement', role: 'trail' }, {
    smoke: DUST,
    rate: 7,
  }),
  // ---------------------------------------------------------------- one-shots
  burst({ ...id('metal-clang', 'metal clang'), source: 'crowbar, frying pan, pipe wrench', effectType: 'impact', role: 'impact' }, {
    flash: dim(FIRE.yellow, 0.6),
    star: WHITE,
    sparks: [FIRE.yellow, FIRE.white],
    sparkCount: 12,
    reach: 0.8,
  }),
  burst({ ...id('metal-snap', 'metal snap'), source: 'bear trap', effectType: 'impact', role: 'impact' }, {
    star: WHITE,
    sparks: [FIRE.yellow, FIRE.white],
    sparkCount: 10,
    cubes: [t('rust', 4), t('rust', 5), t('steel', 5)],
    cubeCount: 6,
    reach: 0.8,
  }),
  burst({ ...id('saw-sparks', 'saw sparks'), source: 'raider bot saw', effectType: 'impact', role: 'impact' }, {
    flash: dim(FIRE.orange, 0.6),
    sparks: [FIRE.yellow, FIRE.white, FIRE.orange],
    sparkCount: 20,
    cubes: [t('steel', 5), t('rust', 5)],
    cubeCount: 5,
  }),
  burst({ ...id('gore-burst', 'gore burst'), source: 'zombie hits, chainsaw, machete, axe, nail bat, spear', effectType: 'impact', role: 'impact' }, {
    star: hex('#ffe9e0'),
    pieces: { texture: 'rvx-drop', colors: GORE, count: 9, size: 0.15, gravity: 1 },
    cubes: [...GORE, t('toxic', 5)],
    cubeCount: 7,
  }),
  burst({ ...id('crate-dust', 'crate dust'), source: 'supply crate', effectType: 'loot', role: 'reward' }, {
    puffs: DUST,
    cubes: [t('wood', 5), t('wood', 4), t('khaki', 5)],
    cubeCount: 8,
    star: t('gold', 7),
    ground: true,
  }),
  burst({ ...id('explosion', 'explosion'), source: 'raider bot death', effectType: 'impact', role: 'burst' }, {
    flash: dim(FIRE.yellow, 1),
    ring: { color: FIRE.orange, kind: 'flat' },
    pieces: { texture: 'rvx-flame', colors: [FIRE.yellow, FIRE.orange, FIRE.red], count: 9, sheet: { columns: 2, rows: 2 }, size: 0.34, gravity: -0.2 },
    puffs: OILY,
    cubes: [t('steel', 4), t('rust', 4), SMOKE.dark],
    cubeCount: 10,
    sparks: [FIRE.yellow, FIRE.white],
    reach: 1.3,
  }),
  slam({ ...id('ground-slam', 'ground slam'), source: 'mutant behemoth fist', effectType: 'impact', role: 'impact' }, {
    dust: DUST,
    rubble: [t('sand', 4), t('darkwood', 4), t('steel', 4)],
  }),
  spray({ ...id('vomit-spray', 'vomit spray'), source: 'bloated zombie attack', effectType: 'elemental', role: 'release' }, {
    kind: 'puff',
    colors: TOXIC,
    embers: [t('toxic', 7), t('moss', 5)],
    length: 1.4,
    duration: 0.6,
  }),
  muzzle({ ...id('shotgun-blast', 'shotgun blast'), source: 'double barrel, pump shotgun, sawn-off', effectType: 'weapon', role: 'release' }, {
    flash: dim(FIRE.yellow, 0.9),
    core: FIRE.white,
    smoke: [SMOKE.light, SMOKE.mid],
    sparks: [FIRE.yellow, FIRE.white],
    big: true,
  }),
  muzzle({ ...id('pistol-shot', 'pistol shot'), source: 'pistol', effectType: 'weapon', role: 'release' }, {
    flash: dim(FIRE.yellow, 0.8),
    core: FIRE.white,
    smoke: [SMOKE.light],
  }),
  burst({ ...id('fuel-splash', 'fuel splash'), source: 'gas can', effectType: 'elemental', role: 'release' }, {
    pieces: { texture: 'rvx-drop', colors: [t('gold', 5), t('khaki', 5), t('gold', 6)], count: 9, size: 0.13, gravity: 1 },
    puffs: [t('khaki', 6), t('gold', 7)],
    reach: 0.8,
  }),
]
