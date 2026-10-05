/** RUN voxel fantasy pack effects (ids `rvx-fantasy-*`). PN base-pirate
 * theme: warm woods and stone, gold, sky-blue frost, magenta arcane, leaf green. */
import { FIRE, hex, SMOKE, theme, WHITE, type RvxRecipe } from './common'
import { bubbles, burst, dim, fall, fire, glint, lampGlow, mist, motes, muzzle, orbit, slam, slash, smokeColumn, spray, waves } from './kit'

const t = theme('fantasy')
const id = (slug: string, label: string) => ({ id: `rvx-fantasy-${slug}`, label: `RUN Fantasy ${label}` })

export const FANTASY_RECIPES: RvxRecipe[] = [
  // ---------------------------------------------------------------- loops
  smokeColumn({ ...id('chimney-smoke', 'chimney smoke'), source: 'tavern, blacksmith and forge chimneys', effectType: 'smoke', role: 'loop' }, {
    colors: [t('stone', 6), t('stone', 5), t('bone', 5)],
  }),
  fire({ ...id('hearth-fire', 'hearth fire'), source: 'brazier, blacksmith forge', effectType: 'fire', role: 'loop' }, {
    kind: 'hearth',
    smoke: [SMOKE.mid, SMOKE.dark],
  }),
  fire({ ...id('torch-flame', 'torch flame'), source: 'torch, lantern staff, airship burner', effectType: 'fire', role: 'loop' }, { kind: 'torch', follow: true }),
  lampGlow({ ...id('lantern-glow', 'lantern glow'), source: 'swan boat lantern', effectType: 'aura', role: 'loop' }, {
    halo: dim(t('gold', 6), 0.35),
    motes: [t('gold', 7), t('gold', 6)],
    glints: true,
  }),
  bubbles({ ...id('cauldron-brew', 'cauldron brew'), source: 'bubbling cauldron', effectType: 'magic', role: 'loop' }, {
    bubble: [t('leaf', 6), t('leaf', 5)],
    fume: [t('leaf', 7, 1), t('moss', 6)],
    chips: [t('leaf', 7), t('gold', 7)],
  }),
  motes({ ...id('fairy-motes', 'fairy motes'), source: 'fairy ring, forest wisp', effectType: 'magic', role: 'loop' }, {
    colors: [t('leaf', 7), t('gold', 7), t('sky', 7)],
    glints: [t('gold', 7), WHITE],
    halo: dim(t('leaf', 6), 0.22),
  }),
  glint({ ...id('treasure-glint', 'treasure glint'), source: 'treasure pile', effectType: 'loot', role: 'loop' }, { colors: [t('gold', 7), WHITE] }),
  orbit({ ...id('arcane-orbit', 'arcane orbit'), source: 'wizard tower spire, scrying orb', effectType: 'magic', role: 'loop' }, {
    colors: [t('magenta', 6), t('magenta', 7), t('sky', 7)],
    runes: [t('magenta', 7), t('sky', 7)],
    core: dim(t('magenta', 5), 0.3),
  }),
  orbit({ ...id('portal-swirl', 'portal swirl'), source: 'rune portal', effectType: 'portal', role: 'loop' }, {
    colors: [t('sky', 6), t('sky', 7), t('magenta', 6)],
    runes: [t('sky', 7)],
    core: dim(t('blue', 5), 0.4),
    ring: t('sky', 6),
    spin: 3.2,
    rise: 0,
    lift: 0.14,
  }),
  fall({ ...id('leaf-fall', 'leaf fall'), source: 'elven trees, treehouse canopy, ent', effectType: 'environment', role: 'loop' }, {
    colors: [t('leaf', 5), t('leaf', 6), t('gold', 6)],
  }),
  mist({ ...id('waterfall-mist', 'waterfall mist'), source: 'cliff waterfall splash', effectType: 'environment', role: 'loop' }, {
    colors: [hex('#e6f2f5'), hex('#cfe3ea'), t('sky', 7)],
    motes: [WHITE, t('sky', 7)],
    rate: 7,
  }),
  // ---------------------------------------------------------------- one-shots
  burst({ ...id('arcane-bolt', 'arcane bolt'), source: 'spell book, mage staff', effectType: 'magic', role: 'release' }, {
    flash: dim(t('magenta', 6), 0.8),
    star: t('magenta', 7),
    ring: { color: t('magenta', 6), kind: 'face' },
    cubes: [t('magenta', 6), t('magenta', 7), t('sky', 7)],
    sparks: [t('magenta', 7), WHITE],
  }),
  spray({ ...id('dragon-breath', 'dragon breath'), source: 'dragon attack', effectType: 'fire', role: 'release' }, { kind: 'fire', length: 2.2, duration: 0.9 }),
  burst({ ...id('frost-nova', 'frost nova'), source: 'frost wand, crystals, crystal pylon', effectType: 'elemental', role: 'burst' }, {
    flash: dim(t('sky', 6), 0.8),
    ring: { color: t('sky', 7), kind: 'flat' },
    pieces: { texture: 'rvx-shard', colors: [t('sky', 7), t('sky', 6), WHITE], count: 9, size: 0.18, gravity: 0.5 },
    puffs: [hex('#e8f4f8'), t('sky', 7)],
  }),
  burst({ ...id('holy-smite', 'holy smite'), source: 'unicorn horn', effectType: 'magic', role: 'impact' }, {
    flash: dim(t('gold', 7), 0.9),
    star: WHITE,
    ring: { color: t('gold', 7), kind: 'face' },
    sparks: [t('gold', 7), WHITE],
    sparkCount: 14,
    cubes: [t('gold', 7), WHITE],
  }),
  waves({ ...id('bell-toll', 'bell toll'), source: 'bell frame', effectType: 'magic', role: 'burst' }, {
    color: t('gold', 7),
    face: true,
    count: 3,
    motes: [t('gold', 7)],
  }),
  burst({ ...id('metal-clang', 'metal clang'), source: 'blades, maces, shield, mimic bite', effectType: 'impact', role: 'impact' }, {
    flash: dim(FIRE.yellow, 0.6),
    star: WHITE,
    sparks: [FIRE.yellow, FIRE.white],
    sparkCount: 12,
    reach: 0.8,
  }),
  slash({ ...id('slash-arc', 'slash arc'), source: 'swords, axes, spears, griffin beak', effectType: 'weapon', role: 'trail' }, {
    edge: WHITE,
    body: t('cyan', 4),
  }),
  muzzle({ ...id('bow-release', 'bow release'), source: 'bow, crossbow, ballista, catapult', effectType: 'weapon', role: 'release' }, {
    flash: dim(t('sand', 7), 0.4),
    core: t('sand', 7),
    smoke: [t('sand', 6), t('bone', 6)],
  }),
  slam({ ...id('dust-slam', 'dust slam'), source: 'ent slam, siege tower bridge', effectType: 'impact', role: 'impact' }, {
    dust: [t('sand', 6), t('sand', 5), t('bone', 6)],
    rubble: [t('stone', 4), t('wood', 4), t('moss', 5)],
  }),
  burst({ ...id('loot-burst', 'loot burst'), source: 'treasure chest', effectType: 'loot', role: 'reward' }, {
    flash: dim(t('gold', 7), 0.7),
    star: t('gold', 7),
    cubes: [t('gold', 6), t('gold', 7), t('gold', 5)],
    cubeCount: 12,
    sparks: [t('gold', 7), WHITE],
    ground: true,
  }),
  burst({ ...id('bone-poof', 'bone poof'), source: 'skeleton knight death', effectType: 'dissolve', role: 'despawn' }, {
    puffs: [t('bone', 6), t('bone', 5), t('stone', 6)],
    cubes: [t('bone', 7), t('bone', 5)],
    cubeCount: 10,
  }),
  burst({ ...id('slime-splat', 'slime splat'), source: 'slime death', effectType: 'dissolve', role: 'despawn' }, {
    pieces: { texture: 'rvx-drop', colors: [t('leaf', 6), t('leaf', 5), t('moss', 6)], count: 10, size: 0.16, gravity: 1 },
    puffs: [t('leaf', 6), t('leaf', 7)],
    ground: true,
  }),
  burst({ ...id('potion-fizz', 'potion fizz'), source: 'alchemy table', effectType: 'magic', role: 'reward' }, {
    puffs: [t('magenta', 6), t('magenta', 7)],
    pieces: { texture: 'rvx-bubble', colors: [t('magenta', 7), t('leaf', 7)], count: 7, size: 0.12, gravity: -0.1 },
    star: t('gold', 7),
    ground: true,
  }),
  burst({ ...id('forge-flare', 'forge flare'), source: 'forge bellows', effectType: 'fire', role: 'burst' }, {
    flash: dim(FIRE.orange, 0.7),
    pieces: { texture: 'rvx-flame', colors: [FIRE.yellow, FIRE.orange], count: 7, sheet: { columns: 2, rows: 2 }, size: 0.26, gravity: -0.15 },
    sparks: [FIRE.yellow, FIRE.white],
    sparkCount: 14,
    ground: true,
  }),
]
