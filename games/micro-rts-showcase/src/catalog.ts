import { resolveAssetUrl } from './assetSource'
import { LEAF_2D, LEAF_UI } from './pins'

export type Dir8 = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'
export const DIRS_8: readonly Dir8[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export type FactionId = 'vanguard' | 'kraxen' | 'solaris' | 'neutral'

export interface RosterUnitEntry {
  readonly id: string
  readonly name: string
  readonly faction: FactionId
  readonly role: string
  readonly layer: 'ground' | 'air'
  readonly twoLayer: boolean
  readonly special?: string
  readonly source?: string
  readonly cellW: number
  readonly cellH: number
  readonly cols: number
  readonly sheet: string
  readonly hullSheet?: string
  readonly turretSheet?: string
  readonly shadowSheet?: string
  readonly overlaySheet?: string
  readonly bodySheet?: string
  readonly tailSheet?: string
  readonly muzzleRel8?: Record<Dir8, readonly [number, number]>
  readonly muzzleCell8?: Record<Dir8, readonly [number, number]>
}

export interface BuildingEntry {
  readonly id: string
  readonly name: string
  readonly faction: string
  readonly role: string
  readonly coreWidth: number
  readonly coreHeight: number
  readonly width: number
  readonly height: number
  readonly anchorX: number
  readonly anchorY: number
  readonly shadowRx: number
  readonly shadowRy: number
  readonly idleSheet: string
  readonly stateSheet?: string
  readonly stateCellW?: number
  readonly stateCellH?: number
  readonly stateAnchorX?: number
  readonly stateAnchorY?: number
  readonly states?: readonly string[]
}

export interface BuildingsManifest {
  readonly teamColors: Record<string, unknown>
  readonly buildingStates: readonly string[]
  readonly buildings: readonly BuildingEntry[]
}

export interface BiomeEntry {
  readonly theme: 'temperate' | 'tundra' | 'volcanic' | 'desert'
  readonly label: string
  readonly atlas: string
  readonly hazardAnim: string
  readonly bridgeH: string
  readonly bridgeV: string
  readonly ramps: Record<'N' | 'S' | 'E' | 'W', string>
}

export interface EnvObjectEntry {
  readonly id: string
  readonly name: string
  readonly category: 'resource' | 'obstacle' | 'objective' | 'flora' | 'wreckage'
  readonly biome: string
  readonly stateMode: string
  readonly stateLabels?: readonly string[]
  readonly blocksMovement: boolean
  readonly blocksVision: boolean
  readonly cellW: number
  readonly cellH: number
  readonly frames: number
  readonly sheet: string
}

export interface EnvManifest {
  readonly biomes: readonly BiomeEntry[]
  readonly objects: readonly EnvObjectEntry[]
  readonly neutrals: readonly RosterUnitEntry[]
}

export interface VfxEntry {
  readonly id: string
  readonly name: string
  readonly category: string
  readonly outline: boolean
  readonly cellW: number
  readonly cellH: number
  readonly frames: number
  readonly sheet: string
}

export interface UnitAttackProfile {
  readonly id: string
  readonly archetype: string
  readonly colorTheme: string
  readonly burstCount?: number
  readonly projSprite?: string
  readonly impactSprite?: string
  readonly slashSprite?: string
}

export interface SelectionRingEntry {
  readonly id: string
  readonly cellW: number
  readonly cellH: number
  readonly states: readonly ('selected' | 'hover' | 'enemy' | 'ally')[]
  readonly sheet: string
}

export interface UiSpriteEntry {
  readonly id: string
  readonly name: string
  readonly category: 'cursor' | 'marker' | 'icon'
  readonly cellW: number
  readonly cellH: number
  readonly frames: number
  readonly sheet: string
}

export interface UiManifest {
  readonly selectionRings: readonly SelectionRingEntry[]
  readonly sprites: readonly UiSpriteEntry[]
}

export interface PackSummaryManifest {
  readonly id: string
  readonly name: string
  readonly version: string
  readonly pixelGrid: string
  readonly factions: readonly string[]
  readonly counts: Record<string, number>
  readonly manifests: Record<string, string>
}

export interface MicroRtsCatalog {
  readonly pack: PackSummaryManifest
  readonly units: readonly RosterUnitEntry[]
  readonly allUnits: readonly RosterUnitEntry[]
  readonly buildings: BuildingsManifest
  readonly environment: EnvManifest
  readonly vfx: readonly VfxEntry[]
  readonly attackByUnitId: ReadonlyMap<string, UnitAttackProfile>
  readonly attacks: readonly UnitAttackProfile[]
  readonly ui: UiManifest
}

async function fetchJson<T>(leafId: string, path: string): Promise<T> {
  const url = await resolveAssetUrl({ leafId, path })
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} loading ${leafId}/${path} (${url})`)
  }
  return (await res.json()) as T
}

export async function loadMicroRtsCatalog(): Promise<MicroRtsCatalog> {
  const [pack, rawUnits, buildings, rawEnv, vfx, attacks, ui] = await Promise.all([
    fetchJson<PackSummaryManifest>(LEAF_2D, 'micro-rts-manifest.json'),
    fetchJson<RosterUnitEntry[]>(LEAF_2D, 'units/roster-manifest.json'),
    fetchJson<BuildingsManifest>(LEAF_2D, 'buildings/buildings-manifest.json'),
    fetchJson<EnvManifest>(LEAF_2D, 'environment/env-manifest.json'),
    fetchJson<VfxEntry[]>(LEAF_2D, 'vfx/vfx-manifest.json'),
    fetchJson<UnitAttackProfile[]>(LEAF_2D, 'vfx/unit-attacks.json'),
    fetchJson<UiManifest>(LEAF_UI, 'ui-manifest.json'),
  ])

  const neutrals: RosterUnitEntry[] = rawEnv.neutrals.map((n) => ({
    ...n,
    faction: 'neutral',
    sheet: `environment/${n.sheet}`,
    hullSheet: n.hullSheet ? `environment/${n.hullSheet}` : undefined,
    turretSheet: n.turretSheet ? `environment/${n.turretSheet}` : undefined,
    shadowSheet: n.shadowSheet ? `environment/${n.shadowSheet}` : undefined,
  }))

  const environment: EnvManifest = {
    biomes: rawEnv.biomes.map((b) => ({
      ...b,
      atlas: `environment/${b.atlas}`,
      hazardAnim: `environment/${b.hazardAnim}`,
      bridgeH: `environment/${b.bridgeH}`,
      bridgeV: `environment/${b.bridgeV}`,
      ramps: {
        N: `environment/${b.ramps.N}`,
        S: `environment/${b.ramps.S}`,
        E: `environment/${b.ramps.E}`,
        W: `environment/${b.ramps.W}`,
      },
    })),
    objects: rawEnv.objects.map((o) => ({ ...o, sheet: `environment/${o.sheet}` })),
    neutrals,
  }

  const normalizedBuildings: BuildingsManifest = {
    ...buildings,
    buildings: buildings.buildings.map((b) => ({
      ...b,
      idleSheet: `buildings/${b.idleSheet}`,
      stateSheet: b.stateSheet ? `buildings/${b.stateSheet}` : undefined,
    })),
  }

  const normalizedVfx: VfxEntry[] = vfx.map((v) => ({ ...v, sheet: `vfx/${v.sheet}` }))
  const attackByUnitId = new Map<string, UnitAttackProfile>(attacks.map((a) => [a.id, a]))

  return {
    pack,
    units: rawUnits,
    allUnits: [...rawUnits, ...neutrals],
    buildings: normalizedBuildings,
    environment,
    vfx: normalizedVfx,
    attackByUnitId,
    attacks,
    ui,
  }
}

export function unitAssetPath(path: string): string {
  return path
}
