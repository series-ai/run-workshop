import type { Species, TotOptions } from '../promo/kit'
import type { SkinPattern } from '../body/skinPattern'

/**
 * The Terra Tots cast and the extras' looks, shared by the trailer and the pack exporter: each character's plant,
 * pot, limbs and proportions.
 */
export const PERSONAS: [string, SkinPattern, string][] = [
  ['#f2826a', 'spots', '#ffd36b'], ['#bfe3c8', 'marble', '#ffffff'], ['#4fb3a9', 'pinstripe', '#e9fff6'], ['#d9c6ef', 'speckle', '#7a5aa6'],
  ['#f4c95d', 'brindle', '#e07448'], ['#8fae8c', 'vitiligo', '#efe6c8'], ['#3a3540', 'wavy', '#9b7fd1'], ['#f6cdb2', 'splash', '#e9846b'],
  ['#9b7fd1', 'spots', '#f3e8c4'], ['#c4dcf2', 'wavy', '#5b86b8'], ['#2f4a3a', 'pinstripe', '#bfe3a8'], ['#f6c6d0', 'none', '#ffffff'],
  ['#7fa38e', 'brindle', '#e9e4c8'], ['#e9846b', 'marble', '#fff0e0'],
]
export const look = (k: number): TotOptions => {
  const [skin, pattern, patternColor] = PERSONAS[k % PERSONAS.length]
  return { skin, pattern, patternColor, seed: k }
}
/** How grown each species looks: mature monsteras are big, pothos small. */
export const AGE: Partial<Record<Species, number>> = { laurentii: 0.6, satin: 0.4, blackvelvet: 0.65, dottie: 0.55, monstera: 0.93, albo: 0.9, thai: 0.9, pothos: 0.35, bop: 0.75, snake: 0.6, cylindrical: 0.6, whale: 0.7, peacelily: 0.6, domino: 0.6, zz: 0.5, raven: 0.55, alocasia: 0.6, frydek: 0.6, calathea: 0.55, whitefusion: 0.55 }
export const age = (sp: Species) => AGE[sp] ?? 0.55
/** Body size by plant, for the extras: big plants in big pots, small ones in small. */
export const SIZE: Partial<Record<Species, number>> = { monstera: 1.35, albo: 1.25, thai: 1.2, bop: 1.2, whale: 1.15, raven: 1.05, zz: 1.0, snake: 1.0, laurentii: 1.0, cylindrical: 0.95, peacelily: 0.95, domino: 0.95, alocasia: 1.0, frydek: 1.0, calathea: 0.9, whitefusion: 0.9, dottie: 0.85, pothos: 0.8, satin: 0.8 }

/** The cast: ten characters, each with a plant, a pot, limbs and proportions that suit them, and an intro card. */
export interface Member { sp: Species; name: string; plant: string; title: string; joke: string; o: TotOptions }
export const MEMBERS: Member[] = [
  { sp: 'monstera', name: 'Blanche', plant: 'Monstera', title: 'The Minimalist.', joke: 'Beige is a personality.', o: { size: 1.7, pot: 'egg', cw: 0, skin: '#e6b08c', pattern: 'vitiligo', patternColor: '#fbf6ee', legs: 1.35, arms: 1.1 } },
  { sp: 'thai', name: 'Stella', plant: 'Thai Constellation', title: 'The Dreamer.', joke: 'Named after the stars. Brings it up a lot.', o: { size: 1.2, pot: 'stepped', cw: 3, skin: '#2f4f6e', pattern: 'spots', patternColor: '#f6e9b8', legs: 0.9, arms: 1.1 } },
  { sp: 'domino', name: 'Domino', plant: "Peace Lily 'Domino'", title: 'The Wildcard.', joke: 'Knocks things over. On purpose.', o: { size: 0.95, pot: 'checker', cw: 0, skin: '#f4f1ea', pattern: 'spots', patternColor: '#2a2a2a' } },
  { sp: 'alocasia', name: 'Velvet', plant: "Alocasia 'Frydek'", title: 'The Drama Queen.', joke: 'Droops if you look at her wrong.', o: { size: 1.0, pot: 'scales', cw: 2, skin: '#2e5a3e', pattern: 'splash', patternColor: '#e3f0d6', legs: 0.75, arms: 1.2 } },
  { sp: 'calathea', name: 'Tutu', plant: 'Calathea', title: 'The Ballerina.', joke: 'Folds her leaves up every night. Dramatic exit.', o: { size: 0.9, pot: 'hearts', cw: 1, skin: '#f6c6d0', pattern: 'pinstripe', patternColor: '#ffffff', legs: 1.5, arms: 1.1 } },
  { sp: 'raven', name: 'Raven', plant: "ZZ 'Raven'", title: 'The Goth.', joke: 'A plant who hates the sun.', o: { size: 1.1, pot: 'cauldron', cw: 2, skin: '#433a4c', pattern: 'brindle', patternColor: '#8a3058', legs: 1.4, arms: 1.3 } },
  { sp: 'whale', name: 'Finn', plant: 'Whale Fin', title: 'The Sailor.', joke: 'Has never seen the sea. Won’t stop talking about it.', o: { size: 1.15, pot: 'barrel', cw: 0, skin: '#7f9cb5', pattern: 'wavy', patternColor: '#e8f1f6', legs: 0.8, arms: 0.9 } },
  { sp: 'laurentii', name: 'Sunny', plant: "Snake Plant 'Laurentii'", title: 'The Optimist.', joke: 'Up at 6am. Thrilled about it.', o: { size: 1.0, pot: 'drip', cw: 1, skin: '#f2cf5b', pattern: 'none', patternColor: '#4f8a52', legs: 1.1 } },
  { sp: 'satin', name: 'Pearl', plant: 'Satin Pothos', title: 'The Spy.', joke: 'Not actually a pothos. Shh.', o: { size: 0.8, pot: 'crackle', cw: 0, skin: '#c9a7b6', pattern: 'speckle', patternColor: '#f4eef0', legs: 1.0 } },
  { sp: 'dottie', name: 'Dottie', plant: "Calathea 'Dottie'", title: 'The Foodie.', joke: 'Calls fertiliser “a little treat.”', o: { size: 0.85, pot: 'fluted', cw: 2, skin: '#4a2f45', pattern: 'spots', patternColor: '#f2a3c0', legs: 0.9 } },
]
export const M_ = (name: string) => MEMBERS.find((m) => m.name === name)!
export const CAST: Partial<Record<Species, TotOptions>> = Object.fromEntries(MEMBERS.map((m) => [m.sp, m.o]))
/** Options for a cast member (by name), or for any species (cast look if it has one, else an extra's look). */
export function who(name: string, k = 0): TotOptions {
  const m = M_(name)
  return { species: m.sp, age: age(m.sp), ...m.o, seed: k + 11 }
}
export const cast = (sp: Species, k = 0): TotOptions => ({ species: sp, age: age(sp), ...look(k), ...(CAST[sp] ?? {}), seed: k })
