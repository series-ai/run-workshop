/**
 * Terra Tots for three.js: the mix-and-match kit behind the pack's ready-made characters.
 *
 *   import * as TT from './terratots.js'
 *   const kit = await TT.loadPackKit('assets/terra-tots/kit/', loader)   // a GLTFLoader with the meshopt decoder
 *   const tot = new TT.Tot(kit, { species: 'monstera', age: 0.8, pot: 'egg', cw: 0, skin: '#e6b08c', pattern: 'vitiligo' })
 *   scene.add(tot.root)
 *   // every frame: tot.pose(time, 'walk')   (any of TT.ANIMS; returns the travel speed for walking clips)
 *
 * Plants grow leaf by leaf (`age` 0..1, or `tot.setPlant(species, age)` live), 37 pots in their colourways, limbs with
 * any skin colour, marking, length, and the animation library. See the pack Readme for the full list.
 */
export { loadKit, growPlant, Tot, SCALE, type Kit, type Species, type TotOptions } from '../promo/kit'
export { buildPot, potById, POTS, type PotDef, type BuiltPot } from '../body/pots'
export { buildMonster, loadBodyParts, type Monster, type BodyParts } from '../body/limbs'
export { poseMonster, frameFor, ANIMS, GAITS, hangSetup, type MonsterAnim, type HangSetup } from '../body/anims'
export { skinMaterial, SKIN_PATTERNS, type SkinPattern } from '../body/skinPattern'
export { PROPS, hanger, ceilingHook, rope, pest, type Prop, type HangerKind, type PestKind } from '../props/props'
export { infest, clearPests, rollPestCount, PEST_KINDS, MAX_PESTS } from '../props/infest'
export { MEMBERS, CAST, who, cast, look } from './cast'

import { loadKit as load } from '../promo/kit'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
/** Load the kit as shipped in the pack (kit/monstera, kit/pothos, kit/leaves, kit/body; compressed .glb files). */
export const loadPackKit = (base: string, loader: GLTFLoader) => load(base, { ext: '.glb', leafDir: 'leaves', loader })
