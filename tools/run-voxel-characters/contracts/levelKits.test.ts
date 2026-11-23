import { describe, expect, it } from 'vitest'
import { levelPropEntrySchema, type PackCatalog, type LevelPropEntry } from './catalog'
import { resolveLevelKits, levelKitsSchema, withLevelProps, type LevelKits } from './levelKits'
import { VOXCHAR_PACK_KEYS } from './packs'
import { levelFinishesSchema } from './levelFinishes'
import finishes from './data/level-finishes.json'

function fixture() {
  const catalogs: PackCatalog[] = VOXCHAR_PACK_KEYS.map((pack) => ({
    version: 1,
    pack,
    label: pack,
    license: 'CC0-1.0',
    clips: [],
    parts: [],
    heldItems: [],
    presets: [],
    props: [],
    levelKitProps: Array.from({ length: 24 }, (_, index): LevelPropEntry => ({
      id: `prop_${pack}_${index}`,
      pack,
      leaf: 'characters',
      relativePath: `level-kit/${index}.glb`,
      nodeName: `prop_${pack}_${index}`,
      label: `Model ${index + 1}`,
      bounds: { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5], size: [1, 1, 1] },
      triangles: 12,
    })),
  }))
  const kits: LevelKits = levelKitsSchema.parse(Object.fromEntries(catalogs.map((catalog) => [
    catalog.pack,
    {
      title: 'Demo',
      route: 'Follow the lane.',
      view: { center: [0, 0], size: [16, 12], eye: [0, 1.65, 5], target: [0, 1.65, -2] },
      placements: catalog.levelKitProps.map((prop, index) => ({ propId: prop.id, position: [index, 0, 0], turn: 0 })),
    },
  ])))
  return { kits, catalogs, core: catalogs[0]! }
}

describe('Cubix level kit contracts', () => {
  it('rejects a missing finish region, invalid finish values, and broken grain rows', () => {
    expect(levelFinishesSchema.parse(finishes)).toEqual(finishes)
    const { visor: _, ...missing } = finishes.regions
    expect(levelFinishesSchema.safeParse({ ...finishes, regions: missing }).success).toBe(false)
    expect(levelFinishesSchema.safeParse({ ...finishes, water: [2, 0] }).success).toBe(false)
    expect(levelFinishesSchema.safeParse({ ...finishes, grain: finishes.grain.slice(1) }).success).toBe(false)
    const darkFlatFace = finishes.grain.map((row, index) => index === 9
      ? row.map((tone, column) => column === 9 ? 128 : tone)
      : row)
    expect(levelFinishesSchema.safeParse({ ...finishes, grain: darkFlatFace }).success).toBe(false)
  })

  it('keeps a prefab palette override and rejects unknown swatches', () => {
    const { core } = fixture()
    const entry = { ...core.levelKitProps[0], palette: { primary: '#507443', trim: '#ccb499' } }
    expect(levelPropEntrySchema.parse(entry)).toEqual(entry)
    expect(levelPropEntrySchema.safeParse({ ...entry, palette: { wood: '#507443' } }).success).toBe(false)
  })

  it.each(['water', 'glass'])('preserves the %s finish on a level prefab', (surface) => {
    const { core } = fixture()
    const entry = { ...core.levelKitProps[0], surface }
    expect(levelPropEntrySchema.parse(entry)).toEqual(entry)
    expect(levelPropEntrySchema.safeParse({ ...entry, surface: 'unknown' }).success).toBe(false)
  })

  it('resolves each placement to its catalog model before rendering', () => {
    const { kits, catalogs, core } = fixture()
    const resolved = resolveLevelKits(kits, catalogs)
    expect(resolved.size).toBe(6)
    expect(resolved.get('core')?.placements[0]).toEqual({
      item: core.levelKitProps[0], position: [0, 0, 0], turn: 0,
    })
  })

  it('preserves tour stops, scene lights, and atmosphere in the exported layout', () => {
    const { kits } = fixture()
    const stop = { label: 'Loading bay', eye: [2, 1.65, 4], target: [2, 1.65, 0] }
    const fixtureLight = { position: [2, 3.2, 0], color: '#ffcc88', intensity: 12, distance: 7 }
    const environment = {
      zenith: '#6f89a2', horizon: '#d0c9b2', fogDensity: 0.032,
      skyFill: '#c2cbdb', groundFill: '#91816c', fillIntensity: 1.1,
      sunDirection: [-2.4, 1.8, 1.8], sunColor: '#fff0db', sunIntensity: 2.6,
    }
    const core = { ...kits.core, view: { ...kits.core.view, far: 240, stops: [stop] }, fixtures: [fixtureLight], environment }

    const parsed = levelKitsSchema.parse({ ...kits, core })

    expect(parsed.core).toEqual(core)
    const invalid = { ...core, fixtures: [{ ...fixtureLight, distance: -1 }] }
    expect(levelKitsSchema.safeParse({ ...kits, core: invalid }).success).toBe(false)
  })

  it('rejects a prop count below 24', () => {
    const { kits, catalogs, core } = fixture()
    core.levelKitProps.pop()
    expect(() => resolveLevelKits(kits, catalogs)).toThrow('expected at least 24 level props')
  })

  it('rejects missing and non-kit references', () => {
    const { kits, catalogs, core } = fixture()
    const prop = { ...core.levelKitProps[0]!, id: 'old_prop', relativePath: 'old.glb' }
    core.props.push(prop)
    const placement = kits.core.placements[0]!
    placement.propId = prop.id
    expect(() => resolveLevelKits(kits, catalogs)).toThrow('missing level prop old_prop')
    placement.propId = 'missing_prop'
    expect(() => resolveLevelKits(kits, catalogs)).toThrow('missing level prop missing_prop')
  })

  it('rejects repeated and missing placements', () => {
    const { kits, catalogs } = fixture()
    const placements = kits.core.placements
    placements.push(placements[0]!)
    expect(() => resolveLevelKits(kits, catalogs)).toThrow('repeated placement')
    placements.pop()
    placements.pop()
    expect(() => resolveLevelKits(kits, catalogs)).toThrow('is missing from the demo')
  })

  it('rejects a missing pack, an empty layout and an invalid turn', () => {
    const { kits } = fixture()
    const { core: _, ...partial } = kits
    expect(levelKitsSchema.safeParse(partial).success).toBe(false)
    expect(levelKitsSchema.safeParse({ ...kits, core: { ...kits.core, placements: [] } }).success).toBe(false)
    kits.core.placements[0]!.turn = 4
    expect(levelKitsSchema.safeParse(kits).success).toBe(false)
  })

  it('rejects duplicate IDs across the base catalog and level kit', () => {
    const { core } = fixture()
    const duplicate = core.levelKitProps[0]!
    expect(() => withLevelProps({ ...core, props: [duplicate] }, [duplicate])).toThrow('duplicate prop ID')
  })

  it('preserves the world prop list when adding level kits', () => {
    const { core } = fixture()
    const [kitProp] = core.levelKitProps
    const worldProps = [{ ...kitProp!, id: 'world_prop', relativePath: 'world.glb' }]
    const catalog = withLevelProps({ ...core, props: worldProps }, [kitProp!])
    expect(catalog.props).toEqual(worldProps)
    expect(catalog.levelKitProps).toEqual([kitProp])
  })
})
