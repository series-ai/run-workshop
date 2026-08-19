import bladestorm from '../../assets/duelyst/fx_bladestorm.png'
import bloodExplosion from '../../assets/duelyst/fx_blood_explosion.png'
import bloodground from '../../assets/duelyst/fx_bloodground.png'
import waterSplash from '../../assets/duelyst/fx_bluewatersplash.png'
import buff from '../../assets/duelyst/fx_buff.png'
import collision from '../../assets/duelyst/fx_collision.png'
import explosionBlue from '../../assets/duelyst/fx_explosionblue.png'
import explosionPurpleSmoke from '../../assets/duelyst/fx_explosionpurplesmoke.png'
import heal from '../../assets/duelyst/fx_heal.png'
import impact from '../../assets/duelyst/fx_impact.png'
import impact2 from '../../assets/duelyst/fx_impact2.png'
import lightningHit from '../../assets/duelyst/fx_lightninghitgreen.png'
import smoke from '../../assets/duelyst/fx_smoke2.png'
import swirl from '../../assets/duelyst/fx_swirl.png'
import teleportRecall from '../../assets/duelyst/fx_teleportrecall2.png'
import teleportRecallBlue from '../../assets/duelyst/fx_teleportrecallblue.png'
import teleportRecallWhite from '../../assets/duelyst/fx_teleportrecallwhite.png'
import projectileTrail from '../../assets/duelyst/projectile_trail_particles.png'
import rays from '../../assets/duelyst/rays.png'
import ringFlash from '../../assets/duelyst/ring_flash.png'
import ringGlow from '../../assets/duelyst/ring_glow_circle.png'
import ripple from '../../assets/duelyst/ripple.png'
import snow from '../../assets/duelyst/snow.png'
import rain from '../../assets/duelyst/rain.png'
import bubble from '../../assets/duelyst/bubble_constant.png'
import petals from '../../assets/duelyst/petals_001.png'
import cloud from '../../assets/duelyst/cloud_001.png'

export const DUELYST_SHEET_DEFS = [
  { id: 'duelyst-bladestorm', label: 'Duelyst blade storm', file: 'fx_bladestorm.png', url: bladestorm, role: 'burst' as const, type: 'weapon' as const },
  { id: 'duelyst-blood-explosion', label: 'Duelyst blood explosion', file: 'fx_blood_explosion.png', url: bloodExplosion, role: 'burst' as const, type: 'impact' as const },
  { id: 'duelyst-bloodground', label: 'Duelyst blood ground', file: 'fx_bloodground.png', url: bloodground, role: 'impact' as const, type: 'impact' as const },
  { id: 'duelyst-water-splash', label: 'Duelyst water splash', file: 'fx_bluewatersplash.png', url: waterSplash, role: 'impact' as const, type: 'water' as const },
  { id: 'duelyst-buff', label: 'Duelyst buff', file: 'fx_buff.png', url: buff, role: 'loop' as const, type: 'aura' as const },
  { id: 'duelyst-collision', label: 'Duelyst collision', file: 'fx_collision.png', url: collision, role: 'impact' as const, type: 'impact' as const },
  { id: 'duelyst-explosion-blue', label: 'Duelyst blue explosion', file: 'fx_explosionblue.png', url: explosionBlue, role: 'burst' as const, type: 'explosion' as const },
  { id: 'duelyst-explosion-purple-smoke', label: 'Duelyst purple smoke explosion', file: 'fx_explosionpurplesmoke.png', url: explosionPurpleSmoke, role: 'burst' as const, type: 'explosion' as const },
  { id: 'duelyst-heal', label: 'Duelyst heal', file: 'fx_heal.png', url: heal, role: 'release' as const, type: 'aura' as const },
  { id: 'duelyst-impact', label: 'Duelyst impact', file: 'fx_impact.png', url: impact, role: 'impact' as const, type: 'impact' as const },
  { id: 'duelyst-impact-2', label: 'Duelyst impact 2', file: 'fx_impact2.png', url: impact2, role: 'impact' as const, type: 'impact' as const },
  { id: 'duelyst-lightning-hit', label: 'Duelyst lightning hit', file: 'fx_lightninghitgreen.png', url: lightningHit, role: 'impact' as const, type: 'elemental' as const },
  { id: 'duelyst-smoke', label: 'Duelyst smoke', file: 'fx_smoke2.png', url: smoke, role: 'release' as const, type: 'smoke' as const },
  { id: 'duelyst-swirl', label: 'Duelyst swirl', file: 'fx_swirl.png', url: swirl, role: 'loop' as const, type: 'magic' as const },
  { id: 'duelyst-teleport-recall', label: 'Duelyst teleport recall', file: 'fx_teleportrecall2.png', url: teleportRecall, role: 'spawn' as const, type: 'portal' as const },
  { id: 'duelyst-teleport-recall-blue', label: 'Duelyst teleport recall blue', file: 'fx_teleportrecallblue.png', url: teleportRecallBlue, role: 'spawn' as const, type: 'portal' as const },
  { id: 'duelyst-teleport-recall-white', label: 'Duelyst teleport recall white', file: 'fx_teleportrecallwhite.png', url: teleportRecallWhite, role: 'spawn' as const, type: 'portal' as const },
  { id: 'duelyst-projectile-trail', label: 'Duelyst projectile trail', file: 'projectile_trail_particles.png', url: projectileTrail, role: 'trail' as const, type: 'trail' as const },
  { id: 'duelyst-rays', label: 'Duelyst rays', file: 'rays.png', url: rays, role: 'trail' as const, type: 'magic' as const },
  { id: 'duelyst-ring-flash', label: 'Duelyst ring flash', file: 'ring_flash.png', url: ringFlash, role: 'impact' as const, type: 'impact' as const },
  { id: 'duelyst-ring-glow', label: 'Duelyst ring glow', file: 'ring_glow_circle.png', url: ringGlow, role: 'loop' as const, type: 'aura' as const },
  { id: 'duelyst-ripple', label: 'Duelyst ripple', file: 'ripple.png', url: ripple, role: 'impact' as const, type: 'water' as const },
  { id: 'duelyst-snow', label: 'Duelyst snow', file: 'snow.png', url: snow, role: 'loop' as const, type: 'weather' as const },
  { id: 'duelyst-rain', label: 'Duelyst rain', file: 'rain.png', url: rain, role: 'loop' as const, type: 'weather' as const },
  { id: 'duelyst-bubble', label: 'Duelyst bubble', file: 'bubble_constant.png', url: bubble, role: 'loop' as const, type: 'water' as const },
  { id: 'duelyst-petals', label: 'Duelyst petals', file: 'petals_001.png', url: petals, role: 'loop' as const, type: 'environment' as const },
  { id: 'duelyst-cloud', label: 'Duelyst cloud', file: 'cloud_001.png', url: cloud, role: 'loop' as const, type: 'weather' as const },
] as const

export type DuelystSheetId = (typeof DUELYST_SHEET_DEFS)[number]['id']

export const DUELYST_SHEET_URLS: Record<DuelystSheetId, string> = Object.fromEntries(
  DUELYST_SHEET_DEFS.map((sheet) => [sheet.id, sheet.url]),
) as Record<DuelystSheetId, string>
