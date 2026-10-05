/** RUN voxel monster pack effects (ids `rvx-monster-*`). PN haunted and
 * zombie themes: moonlit purples, ghost teal, bone, rot green, blood red and
 * candle ember. */
import { FIRE, hex, SMOKE, theme, WHITE, type RvxRecipe } from './common'
import { bubbles, burst, dim, exhaust, fire, glyphs, lampGlow, mist, motes, muzzle, orbit, rake, slash, smokeColumn, spray, swarm, waves } from './kit'

const t = theme('monster')
const id = (slug: string, label: string) => ({ id: `rvx-monster-${slug}`, label: `RUN Monster ${label}` })

const GHOST = [t('teal', 6), t('teal', 7), hex('#dff7f2')]
// one shade lighter than a deep red: darker drops vanish on dark ground
const BLOOD = [t('red', 4), t('red', 5), t('blood', 5)]
const AURA = [t('red', 5), t('red', 6), t('magenta', 6)]
// two shades lighter than a silhouette, so the bats read on dark ground too
const BATS = [t('purple', 6), t('purple', 5)]
const ROT = [t('toxic', 5), t('moss', 5), t('toxic', 6)]
const HOLY = [t('bone', 7), hex('#fff1b8')]

export const MONSTER_RECIPES: RvxRecipe[] = [
  // ---------------------------------------------------------------- loops
  fire({ ...id('candle-flame', 'candle flame'), source: 'chandelier, lanterns, carriage lamps', effectType: 'fire', role: 'loop' }, { kind: 'torch', follow: true }),
  fire({ ...id('torch-flame', 'torch flame'), source: 'torch sconce, torch', effectType: 'fire', role: 'loop' }, { kind: 'torch', smoke: [SMOKE.dark, SMOKE.mid] }),
  motes({ ...id('ghost-wisps', 'ghost wisps'), source: 'mirror, ghost, windmill, ghost ship, hearse horse', effectType: 'horror', role: 'loop' }, {
    colors: GHOST,
    glints: [t('teal', 7)],
    halo: dim(t('teal', 5), 0.28),
    spread: 0.45,
    rise: 1.5,
  }),
  mist({ ...id('grave-mist', 'grave mist'), source: 'coffins, trapdoor, fog pit', effectType: 'smoke', role: 'loop' }, {
    colors: [t('purple', 6), t('purple', 7), t('magenta', 7)],
    motes: [t('teal', 7)],
  }),
  // a soft trail out behind the stern (along the aim), not a mist cloud that stays beside it
  exhaust({ ...id('ghost-wake', 'ghost wake'), source: 'ghost ship stern', effectType: 'movement', role: 'trail' }, {
    smoke: GHOST,
    rate: 9,
    soft: true,
  }),
  mist({ ...id('sewer-fume', 'sewer fume'), source: 'dungeon grate', effectType: 'smoke', role: 'loop' }, {
    // light greens: a darker haze reads as a dirty smear on the tile
    colors: [t('toxic', 6), t('toxic', 7)],
    // over the grate, not the whole tile
    width: 0.5,
    rate: 4,
  }),
  bubbles({ ...id('witch-brew', 'witch brew'), source: 'witch cauldron', effectType: 'magic', role: 'loop' }, {
    bubble: [t('toxic', 6), t('toxic', 5)],
    fume: [t('purple', 6), t('toxic', 6)],
    chips: [t('toxic', 7), t('magenta', 7)],
  }),
  swarm({ ...id('bat-swarm', 'bat swarm'), source: 'bell tower', effectType: 'horror', role: 'loop' }, {
    colors: BATS,
  }),
  smokeColumn({ ...id('ghost-smoke', 'ghost smoke'), source: 'manor and undertaker chimneys', effectType: 'smoke', role: 'loop' }, {
    colors: [t('purple', 5), t('stone', 5), t('purple', 6)],
    embers: [t('teal', 7)],
  }),
  smokeColumn({ ...id('witch-smoke', 'witch smoke'), source: 'witch hut chimney', effectType: 'smoke', role: 'loop' }, {
    colors: [t('toxic', 5), t('moss', 6), t('toxic', 6)],
    embers: [t('magenta', 7)],
  }),
  orbit({ ...id('blood-moon-aura', 'blood moon aura'), source: 'vampire lord', effectType: 'aura', role: 'loop' }, {
    colors: AURA,
    core: dim(t('red', 5), 0.4),
    ring: t('red', 4),
    radius: 0.55,
    spin: 1.6,
  }),
  motes({ ...id('spore-glow', 'spore glow'), source: 'glow mushrooms', effectType: 'environment', role: 'loop' }, {
    colors: [t('teal', 7), t('magenta', 7), t('teal', 6)],
    glints: [t('teal', 7)],
    spread: 0.6,
    rise: 1.2,
  }),
  lampGlow({ ...id('ghost-lantern', 'ghost lantern'), source: 'bone cart, spider carriage lanterns', effectType: 'aura', role: 'loop' }, {
    halo: dim(t('teal', 6), 0.4),
    motes: GHOST,
    glints: true,
  }),
  exhaust({ ...id('broom-trail', 'broom trail'), source: 'witch broom', effectType: 'movement', role: 'trail' }, {
    smoke: [t('purple', 6), t('magenta', 6), t('purple', 7)],
    rate: 10,
  }),
  // ---------------------------------------------------------------- one-shots
  glyphs({ ...id('curse-cloud', 'curse cloud'), source: 'chained coffin, mummy, witch wand', effectType: 'horror', role: 'burst' }, {
    texture: 'rvx-skull',
    colors: [t('toxic', 6), t('purple', 7)],
    cloud: [t('purple', 5), t('purple', 6), t('magenta', 5)],
    motes: [t('toxic', 7)],
  }),
  glyphs({ ...id('soul-burst', 'soul burst'), source: 'skull staff, wailing ghost death', effectType: 'horror', role: 'despawn' }, {
    texture: 'rvx-skull',
    colors: [t('teal', 7), WHITE],
    cloud: GHOST,
    motes: [t('teal', 7)],
  }),
  burst({ ...id('web-burst', 'web burst'), source: 'spider thread, giant spider', effectType: 'impact', role: 'release' }, {
    pieces: { texture: 'rvx-streak', colors: [hex('#f1efe8'), t('bone', 7)], count: 10, size: 0.2, gravity: 0.3 },
    puffs: [hex('#f1efe8'), t('bone', 6)],
    reach: 0.9,
  }),
  burst({ ...id('stone-crumble', 'stone crumble'), source: 'gargoyle death', effectType: 'dissolve', role: 'despawn' }, {
    puffs: [t('stone', 6), t('stone', 5), t('gray', 6)],
    cubes: [t('stone', 4), t('stone', 5), t('gray', 4)],
    cubeCount: 12,
  }),
  spray({ ...id('venom-spit', 'venom spit'), source: 'giant spider attack', effectType: 'elemental', role: 'release' }, {
    kind: 'puff',
    colors: ROT,
    embers: [t('toxic', 7)],
    length: 1.6,
    duration: 0.5,
  }),
  burst({ ...id('rot-poof', 'rot poof'), source: 'spider and ghoul deaths', effectType: 'dissolve', role: 'despawn' }, {
    puffs: ROT,
    cubes: [t('moss', 4), t('bone', 5)],
    pieces: { texture: 'rvx-skull', colors: [t('toxic', 7)], count: 1, size: 0.3, gravity: -0.1 },
  }),
  waves({ ...id('screech', 'screech'), source: 'vampire bat attack', effectType: 'horror', role: 'release' }, {
    color: t('magenta', 6),
    face: true,
    count: 2,
    size: 0.9,
  }),
  waves({ ...id('howl', 'howl'), source: 'werewolf howl', effectType: 'impact', role: 'release' }, {
    color: hex('#c7d4e6'),
    face: true,
    count: 3,
    size: 1.5,
    motes: [hex('#dde6f0')],
  }),
  burst({ ...id('bat-burst', 'bat burst'), source: 'vampire lord claw', effectType: 'horror', role: 'burst' }, {
    pieces: { texture: 'rvx-bat', colors: BATS, count: 7, sheet: { columns: 4, rows: 2 }, flipbook: true, size: 0.24, gravity: -0.15 },
    puffs: [t('purple', 5), t('purple', 6)],
  }),
  burst({ ...id('blood-splat', 'blood splat'), source: 'vampire lord hit, cleaver, club, pitchfork', effectType: 'impact', role: 'impact' }, {
    star: WHITE,
    pieces: { texture: 'rvx-drop', colors: BLOOD, count: 9, size: 0.14, gravity: 1 },
    cubes: BLOOD,
    cubeCount: 5,
    reach: 0.9,
  }),
  rake({ ...id('claw-slash', 'claw slash'), source: 'werewolf claw', effectType: 'weapon', role: 'impact' }, {
    body: t('red', 5),
    edge: WHITE,
  }),
  slash({ ...id('silver-slash', 'silver slash'), source: 'silver axe, silver dagger', effectType: 'weapon', role: 'trail' }, {
    edge: WHITE,
    body: hex('#d8e2ea', 0.9),
  }),
  // one big crescent at the strike: a trail of the scythe's flat sweep cut across the body
  // as a pale band
  rake({ ...id('reaper-slash', 'reaper slash'), source: 'reaper scythe', effectType: 'weapon', role: 'impact' }, {
    body: t('purple', 6),
    edge: t('teal', 7),
    marks: 1,
    size: 1.3,
  }),
  burst({ ...id('holy-burst', 'holy burst'), source: 'garlic mace, holy water, wooden stake', effectType: 'magic', role: 'impact' }, {
    flash: dim(HOLY[1]!, 0.8),
    star: WHITE,
    ring: { color: HOLY[1]!, kind: 'face' },
    sparks: HOLY,
    sparkCount: 12,
    cubes: HOLY,
    cubeCount: 6,
  }),
  burst({ ...id('dirt-toss', 'dirt toss'), source: 'grave shovel', effectType: 'impact', role: 'impact' }, {
    puffs: [t('wood', 5), t('wood', 4)],
    cubes: [t('darkwood', 4), t('wood', 4), t('moss', 4)],
    cubeCount: 10,
    ground: true,
    reach: 0.9,
  }),
  muzzle({ ...id('blunderbuss-blast', 'blunderbuss blast'), source: 'silver blunderbuss', effectType: 'weapon', role: 'release' }, {
    flash: dim(FIRE.yellow, 0.8),
    core: FIRE.white,
    smoke: [SMOKE.light, SMOKE.mid],
    sparks: [hex('#e8eef2'), FIRE.yellow],
    big: true,
  }),
  muzzle({ ...id('bolt-twang', 'bolt twang'), source: 'stake crossbow', effectType: 'weapon', role: 'release' }, {
    flash: dim(t('bone', 7), 0.35),
    core: t('bone', 7),
    smoke: [t('bone', 6), t('stone', 6)],
  }),
]
