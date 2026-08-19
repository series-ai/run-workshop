import { createFullImageSheet, isCocosAtlasPlist, parseCocosAtlasPlist } from '../sprite-sheet/parseCocosAtlas'
import { isCocosParticlePlist, parseCocosParticlePlist } from '../sprite-sheet/parseCocosParticle'
import type { SpriteSheet, SpriteSheetBlend, SpriteSheetEmitter } from '../sprite-sheet/types'
import { readDuelystPlist } from './plists'
import { DUELYST_SHEET_DEFS, type DuelystSheetId } from './textures'

const range = (min: number, max: number) => ({ min, max })
const constant = (value: number) => ({ min: value, max: value })

/** Duelyst board pixels to inspector world units. */
const PX = 80
const SPEED = 120

interface FxPlay {
  prefix: string
  delay: number
  anchor: SpriteSheetEmitter['anchor']
  blend: SpriteSheetBlend
}

/** Official `app/data/resources.js` plays for the imported FX atlases. */
const FX_PLAYS: Partial<Record<string, FxPlay>> = {
  'fx_bladestorm.png': { prefix: 'fx_bladestorm_', delay: 0.08, anchor: 'character', blend: 'cutout' },
  'fx_blood_explosion.png': { prefix: 'fx_bloodbig_', delay: 0.04, anchor: 'ground', blend: 'cutout' },
  'fx_bloodground.png': { prefix: 'fx_bloodground_', delay: 0.08, anchor: 'ground', blend: 'cutout' },
  'fx_bluewatersplash.png': { prefix: 'fx_bluewatersplash_', delay: 0.08, anchor: 'ground', blend: 'cutout' },
  'fx_buff.png': { prefix: 'fx_buff_', delay: 0.08, anchor: 'character', blend: 'additive' },
  'fx_collision.png': { prefix: 'fx_collisionsparks_', delay: 0.08, anchor: 'ground', blend: 'additive' },
  'fx_explosionblue.png': { prefix: 'fx_explosionmediumblue_ground_', delay: 0.08, anchor: 'ground', blend: 'additive' },
  'fx_explosionpurplesmoke.png': { prefix: 'fx_explosionpurplesmoke_', delay: 0.08, anchor: 'ground', blend: 'additive' },
  'fx_heal.png': { prefix: 'fx_heal_', delay: 0.08, anchor: 'character', blend: 'additive' },
  'fx_impact.png': { prefix: 'fx_impactorangebig_', delay: 0.08, anchor: 'ground', blend: 'additive' },
  'fx_impact2.png': { prefix: 'fx_impactorangesmall_', delay: 0.08, anchor: 'ground', blend: 'additive' },
  'fx_lightninghitgreen.png': { prefix: 'fx_lightninghitgreen_', delay: 0.08, anchor: 'ground', blend: 'additive' },
  'fx_smoke2.png': { prefix: 'fx_smokeground_', delay: 0.08, anchor: 'ground', blend: 'alpha' },
  'fx_swirl.png': { prefix: 'fx_swirlloop_', delay: 0.08, anchor: 'character', blend: 'additive' },
  'fx_teleportrecall2.png': { prefix: 'fx_teleportrecall2_', delay: 0.08, anchor: 'character', blend: 'additive' },
  'fx_teleportrecallblue.png': { prefix: 'fx_teleportrecallblue_', delay: 0.08, anchor: 'character', blend: 'additive' },
  'fx_teleportrecallwhite.png': { prefix: 'fx_teleportrecallwhite_', delay: 0.08, anchor: 'character', blend: 'additive' },
}

function clipForPrefix(sheet: SpriteSheet, prefix: string) {
  const id = prefix.replace(/_+$/, '')
  return sheet.clips.find((clip) => clip.id === id) ?? sheet.clips[0]
}

function fxFlipbookEmitter(sheet: SpriteSheet, play: FxPlay): SpriteSheetEmitter {
  const clip = clipForPrefix(sheet, play.prefix)
  const frames = clip?.frames.length ?? 1
  const fps = 1 / play.delay
  return {
    clipId: clip?.id,
    count: 1,
    life: constant(frames / fps),
    size: constant(2.2),
    speed: constant(0),
    gravity: 0,
    radius: 0.02,
    height: play.anchor === 'character' ? 0.7 : 0,
    fps,
    loop: true,
    blend: play.blend,
    lumaAlpha: false,
    variantMode: false,
    grounded: play.anchor === 'ground',
    anchor: play.anchor,
    billboard: 'camera',
  }
}

const STAMP_PIXELS: Record<string, [number, number]> = {
  'snow.png': [20, 20],
  'rain.png': [10, 1],
  'bubble_constant.png': [43, 48],
  'petals_001.png': [72, 50],
  'cloud_001.png': [258, 196],
  'ring_flash.png': [170, 170],
  'ring_glow_circle.png': [163, 163],
  'ripple.png': [70, 20],
  'projectile_trail_particles.png': [80, 80],
}

function particleEmitter(file: string, clipId: string | undefined): SpriteSheetEmitter {
  const xml = readDuelystPlist(file.replace(/\.png$/i, '.plist'))
  if (!xml || !isCocosParticlePlist(xml)) {
    throw new Error(`Missing Cocos particle plist for ${file}`)
  }
  const particle = parseCocosParticlePlist(xml)
  const hasRealAlpha = !['ring_flash.png', 'ring_glow_circle.png'].includes(file)
  const rain = file === 'rain.png'
  const snow = file === 'snow.png'
  const weather = rain || snow || file.includes('petal') || file.includes('cloud')
  const ring = file.includes('ring') || file.includes('ripple')
  const size = Math.min(snow || rain ? 0.32 : 1.8, particle.startSize / PX)
  const sizeVar = particle.startSizeVariance / PX
  const speed = particle.speed / SPEED
  const speedVar = particle.speedVariance / SPEED
  return {
    clipId,
    count: Math.min(particle.maxParticles, snow ? 36 : rain ? 40 : ring ? 4 : weather ? 12 : 16),
    life: range(Math.max(0.2, particle.life - particle.lifeVariance), particle.life + particle.lifeVariance),
    size: range(Math.max(0.05, size - sizeVar), Math.max(0.07, size + sizeVar)),
    speed: range(Math.max(0, speed - speedVar), speed + speedVar),
    gravity: 0,
    radius: Math.max(0.08, Math.min(1.4, particle.sourceVarianceX / PX)),
    height: weather ? Math.max(1.1, Math.min(2.2, particle.sourceVarianceY / PX + 0.8)) : ring ? 0.08 : 0.55,
    fps: 1,
    loop: true,
    blend: particle.additive ? 'additive' : 'alpha',
    lumaAlpha: !hasRealAlpha,
    variantMode: true,
    grounded: ring,
    anchor: weather ? 'weather' : ring ? 'ground' : 'character',
    billboard: ring ? 'horizontal' : 'camera',
    verticalStreak: rain,
    color: particle.startColor,
    opacity: Math.min(1, Math.max(0.2, particle.startColorAlpha)),
    fadeOverLife: true,
  }
}

function raysEmitter(sheet: SpriteSheet): SpriteSheetEmitter {
  const clip = sheet.clips.find((entry) => entry.id === 'ray') ?? sheet.clips[0]
  return {
    clipId: clip?.id,
    count: 8,
    life: constant(1.2),
    size: range(0.7, 1.4),
    speed: range(0.15, 0.4),
    gravity: 0,
    radius: 0.35,
    height: 0.9,
    fps: 1,
    loop: true,
    blend: 'additive',
    lumaAlpha: true,
    variantMode: true,
    grounded: false,
    anchor: 'character',
    billboard: 'camera',
  }
}

export function getDuelystSpriteRecipe(id: DuelystSheetId): {
  textureUrl: string
  sheet: SpriteSheet
  emitters: SpriteSheetEmitter[]
  keyBackground: boolean
} {
  const def = DUELYST_SHEET_DEFS.find((entry) => entry.id === id)
  if (!def) throw new Error(`Unknown Duelyst sheet: ${id}`)
  const plistName = def.file.replace(/\.png$/i, '.plist')
  const plistText = readDuelystPlist(plistName)
  const play = FX_PLAYS[def.file]
  if (plistText && isCocosAtlasPlist(plistText) && play) {
    const sheet = parseCocosAtlasPlist(plistText)
    return { textureUrl: def.url, sheet, emitters: [fxFlipbookEmitter(sheet, play)], keyBackground: true }
  }
  if (plistText && isCocosAtlasPlist(plistText) && def.file === 'rays.png') {
    const sheet = parseCocosAtlasPlist(plistText)
    return { textureUrl: def.url, sheet, emitters: [raysEmitter(sheet)], keyBackground: false }
  }
  if (plistText && isCocosParticlePlist(plistText)) {
    const pixels = STAMP_PIXELS[def.file] ?? [128, 128]
    const sheet = createFullImageSheet(def.file, pixels[0], pixels[1])
    return { textureUrl: def.url, sheet, emitters: [particleEmitter(def.file, sheet.clips[0]?.id)], keyBackground: false }
  }
  throw new Error(`No Duelyst atlas play or particle plist for ${def.file}`)
}
