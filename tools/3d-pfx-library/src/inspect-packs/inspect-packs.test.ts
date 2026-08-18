import { describe, expect, it } from 'vitest'
import { BURGER_SHOP_RECIPES } from '../burger-shop/recipes'
import { PFX_TAXONOMY } from '../tooling/01'
import {
  BURGER_SHOP_INSPECT_IDS,
  expandInspectSheetMarkIds,
  INSPECT_PACK_IDS,
  INSPECT_SHEETS_MARK_ID,
  isInspectPackId,
} from './ids'
import { INSPECT_PACK_ITEMS, selectInspectPackItems } from './items'
import { getDuelystSpriteRecipe } from './duelystRecipes'
import { getPirateRecipe, PIRATE_RECIPES } from './pirateRecipes'
import { DUELYST_SHEET_DEFS } from './textures'

describe('inspect packs', () => {
  it('covers every BurgerTime recipe and every imported Duelyst sheet', () => {
    expect(BURGER_SHOP_INSPECT_IDS).toEqual(BURGER_SHOP_RECIPES.map((recipe) => `burger-shop-${recipe.id}`))
    expect(INSPECT_PACK_ITEMS.filter((item) => item.effect.id.startsWith('burger-shop-'))).toHaveLength(
      BURGER_SHOP_RECIPES.length,
    )
    expect(INSPECT_PACK_ITEMS.filter((item) => item.effect.id.startsWith('duelyst-'))).toHaveLength(
      DUELYST_SHEET_DEFS.length,
    )
    expect(INSPECT_PACK_ITEMS.filter((item) => item.effect.id.startsWith('pirate-'))).toHaveLength(
      PIRATE_RECIPES.length,
    )
    expect(INSPECT_PACK_IDS).toHaveLength(
      BURGER_SHOP_RECIPES.length + DUELYST_SHEET_DEFS.length + PIRATE_RECIPES.length,
    )
  })

  it('keeps inspect ids out of the locked 500 catalog', () => {
    const catalogIds = new Set(PFX_TAXONOMY.map((effect) => effect.id))
    for (const id of INSPECT_PACK_IDS) {
      expect(catalogIds.has(id)).toBe(false)
      expect(isInspectPackId(id)).toBe(true)
    }
    expect(catalogIds.has(INSPECT_SHEETS_MARK_ID)).toBe(false)
  })

  it('expands the inspect-sheets mark alias', () => {
    expect(expandInspectSheetMarkIds([INSPECT_SHEETS_MARK_ID])).toEqual(INSPECT_PACK_IDS)
    expect(expandInspectSheetMarkIds(['fireball', INSPECT_SHEETS_MARK_ID])).toEqual([
      'fireball',
      ...INSPECT_PACK_IDS,
    ])
  })

  it('plays Duelyst FX atlases as one official flipbook, and stamps from Cocos particle plists', () => {
    const impact = getDuelystSpriteRecipe('duelyst-impact')
    expect(impact.sheet.clips.length).toBeGreaterThan(1)
    expect(impact.emitters).toHaveLength(1)
    expect(impact.emitters[0]?.clipId).toBe('fx_impactorangebig')
    expect(impact.emitters[0]?.count).toBe(1)
    expect(impact.emitters[0]?.variantMode).toBe(false)
    expect(impact.emitters[0]?.fps).toBeCloseTo(12.5)
    expect(impact.emitters[0]?.anchor).toBe('ground')
    const heal = getDuelystSpriteRecipe('duelyst-heal')
    expect(heal.sheet.clips[0]?.frames).toHaveLength(15)
    expect(heal.emitters).toHaveLength(1)
    expect(heal.emitters[0]?.count).toBe(1)
    expect(heal.emitters[0]?.anchor).toBe('character')
    expect(getDuelystSpriteRecipe('duelyst-buff').emitters[0]?.clipId).toBe('fx_buff')
    expect(getDuelystSpriteRecipe('duelyst-swirl').emitters[0]?.clipId).toBe('fx_swirlloop')
    const rain = getDuelystSpriteRecipe('duelyst-rain')
    expect(rain.emitters[0]?.anchor).toBe('weather')
    expect(rain.emitters[0]?.verticalStreak).toBe(true)
    expect(rain.emitters[0]?.count).toBe(40)
    expect(rain.emitters[0]?.life).toEqual({ min: 1, max: 1 })
    expect(rain.emitters[0]?.lumaAlpha).toBe(false)
    expect(rain.emitters[0]?.fadeOverLife).toBe(true)
    expect(rain.emitters[0]?.color?.[1]).toBeGreaterThan(0.9)
    expect(rain.emitters[0]?.color?.[0]).toBeLessThan(0.1)
    expect(getDuelystSpriteRecipe('duelyst-snow').emitters[0]?.lumaAlpha).toBe(false)
    expect(getDuelystSpriteRecipe('duelyst-snow').emitters[0]?.opacity).toBeCloseTo(0.5)
    expect(getDuelystSpriteRecipe('duelyst-snow').emitters[0]?.fadeOverLife).toBe(true)
    expect(getDuelystSpriteRecipe('duelyst-ring-glow').emitters[0]?.billboard).toBe('horizontal')
    const rays = getDuelystSpriteRecipe('duelyst-rays')
    expect(rays.emitters[0]?.variantMode).toBe(true)
    expect(rays.emitters[0]?.lumaAlpha).toBe(true)
    expect(() => getDuelystSpriteRecipe('duelyst-projectile-trail')).not.toThrow()
    expect(getDuelystSpriteRecipe('duelyst-projectile-trail').emitters[0]?.count).toBe(16)
  })

  it('rebuilds Pirate Nation effects as multi-emitter recipes', () => {
    expect(PIRATE_RECIPES.map((recipe) => recipe.sourcePrefab)).toEqual([
      'PF_VFX_Status_Buff',
      'PF_VFX_Status_Debuff',
      'PF_VFX_Status_BuffAttack',
      'PF_VFX_Status_Buff_Heal',
      'Shield',
      'SparkleVFX',
      'VFX_Combat_Rain',
      'VFX_Combat_Snow',
      'VFX_Combat_Ash',
      'VFX_CombatArena_Clouds',
      'VFX_Disappear_Ship_Standalone',
      'ShipTrail',
      'FastConfettiBlastRainbow',
      'VFX_CombatResults_Smoke',
      'vfx_godrays_01',
    ])
    const buff = getPirateRecipe('pirate-status-buff')
    expect(buff.emitters.map((emitter) => emitter.name)).toEqual([
      'WaterSplashes',
      'Icon',
      'Box',
      'Ring',
      'BoilingVoxels',
    ])
    expect(buff.emitters.find((emitter) => emitter.name === 'Icon')?.texture).toBe('status-buff')
    expect(getPirateRecipe('pirate-status-debuff').emitters.find((emitter) => emitter.name === 'Icon')?.texture).toBe(
      'status-debuff',
    )
    expect(getPirateRecipe('pirate-status-attack').emitters.find((emitter) => emitter.name === 'Icon')?.texture).toBe(
      'status-attack',
    )
    expect(getPirateRecipe('pirate-status-heal').emitters.find((emitter) => emitter.name === 'Icon')?.texture).toBe(
      'status-up',
    )
    expect(buff.emitters.find((emitter) => emitter.name === 'WaterSplashes')?.burst).toEqual({ min: 16, max: 16 })
    expect(buff.emitters.find((emitter) => emitter.name === 'WaterSplashes')?.speed.max).toBeLessThan(6)
    expect(buff.emitters.find((emitter) => emitter.name === 'WaterSplashes')?.texture).toBe('glow')
    const rain = getPirateRecipe('pirate-rain')
    expect(rain.emitters[0]?.worldVelocity).toEqual([0.18, -1.9, 0])
    expect(rain.emitters[0]?.texture).toBe('glow')
    expect(rain.emitters[0]?.color[0]?.slice(0, 3)).toEqual([0, 0.92, 1])
    expect(getPirateRecipe('pirate-snow').emitters[0]?.worldVelocity).toEqual([0, -1.1, 0])
    expect(getPirateRecipe('pirate-confetti').emitters.map((emitter) => emitter.name)).toEqual([
      'FastConfettiBlastRainbow',
      'Clouds',
      'Glow',
    ])
    expect(getPirateRecipe('pirate-confetti').emitters[0]?.burst).toEqual({ min: 28, max: 28 })
    expect(getPirateRecipe('pirate-confetti').emitters[0]?.sheetVariant).toBe(true)
    expect(getPirateRecipe('pirate-confetti').emitters.find((emitter) => emitter.name === 'Clouds')?.sheetVariant).toBe(
      true,
    )
    expect(getPirateRecipe('pirate-disappear').emitters[0]?.speed.max).toBeLessThan(8)
    expect(getPirateRecipe('pirate-ship-wake').emitters[0]?.billboard).toBe('horizontal')
    const sparkle = getPirateRecipe('pirate-sparkle')
    expect(sparkle.emitters[0]?.burst?.min).toBeGreaterThan(0)
    expect((sparkle.emitters[0]?.rate ?? 0) * sparkle.emitters[0]!.duration).toBeGreaterThan(1)
    const smoke = getPirateRecipe('pirate-results-smoke')
    expect(smoke.emitters[0]?.gravity).toBeGreaterThan(-0.2)
    expect(smoke.emitters[0]?.speed.max).toBeLessThan(0.3)
    const clouds = getPirateRecipe('pirate-clouds')
    expect(clouds.emitters[0]?.billboard).toBe('camera')
    expect(clouds.emitters[0]?.sheetVariant).toBe(true)
  })

  it('keeps inspect packs in the main catalog and still filters by search', () => {
    expect(selectInspectPackItems({}).map((item) => item.effect.id)).toEqual(INSPECT_PACK_IDS)
    const burgerHits = selectInspectPackItems({ query: 'burgertime' })
    expect(burgerHits.every((item) => item.effect.id.startsWith('burger-shop-'))).toBe(true)
    expect(burgerHits).toHaveLength(BURGER_SHOP_RECIPES.length)
    const duelystHits = selectInspectPackItems({ query: 'duelyst' })
    expect(duelystHits.every((item) => item.effect.id.startsWith('duelyst-'))).toBe(true)
    expect(duelystHits).toHaveLength(DUELYST_SHEET_DEFS.length)
    expect(selectInspectPackItems({ effectType: ['weather'] }).every((item) => item.effect.effectType === 'weather')).toBe(
      true,
    )
  })
})
