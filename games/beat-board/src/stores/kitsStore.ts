/**
 * Kits store — pack catalog + ownership state + runtime loaded-kit data.
 *
 * Two-layer responsibility:
 *
 *   1. **Visual catalog** — `KitMeta` extends the runtime `Kit` shape with
 *      the visual-only fields (flavor, hero gradient, ownership, price)
 *      that PackDrawer / KitCard / MyMixes need. The hero pack
 *      `lofi_heights_hero` is preloaded at install time per prd.md §
 *      Pack ownership and access tiers (Free).
 *
 *   2. **Runtime kits** — every entry in `kits` carries the full `Kit`
 *      contract from `src/types/kit.ts` (id, name, bpm, key, pads). The
 *      Pad-Grid Engine reads pads via `getKitById(activeKitId).pads`. Kits
 *      whose color metadata fails validation surface with
 *      `invalidMetadata: true` so the harmonic-lockout rule can fall back
 *      to "any combination valid".
 *
 * Catalog source: every `src/content-assets/kits/*.json` is auto-discovered
 * at build time via Vite's eager `import.meta.glob`. Adding a new pack is
 * a JSON drop — no TS edits to this file. A kit JSON ships its full
 * `KitMeta` (runtime + catalog fields), and pads default to `[]` when the
 * audio is still being authored (`comingSoon: true`).
 *
 * Issue beat-board-04-loop-kit-catalog owns the runtime `Kit` shape;
 * `loop-kit-catalog` is the system that hydrates async-loaded kits over
 * the wire post-install. The synchronous catalog seed below is the
 * preload baseline for screens to render against on first frame.
 */

import { create } from 'zustand'
import type { Kit } from '../types/kit'
import { HERO_KIT_ID } from '../systems/loop-kit-catalog'

export type KitOwnership = 'free' | 'owned' | 'trial' | 'paid'
export type KitTier = 'hero' | 'genre' | 'themed' | 'subscriber' | 'pack-pass'

/**
 * KitMeta = runtime Kit (per issue 04) + the visual fields the pack/grid
 * UI binds to. Visual-only fields are optional so freshly-loaded kits from
 * `loop-kit-catalog` (without pre-baked artwork) still satisfy the type.
 */
export interface KitMeta extends Kit {
  /** Short flavor sentence used in KitDetail and KitCard subtitle. */
  flavor: string
  /** BPM range string (e.g. "84" or "80–95") for chip pills; derived from `bpm`. */
  bpmRange: string
  /** Total layer count surfaced in chip pills. */
  layers: number
  /** Ownership state at session start. */
  ownership: KitOwnership
  /** Price in Runbucks (only meaningful when ownership !== 'owned' && !== 'free'). */
  priceRunbucks: number
  /** Catalog tier, drives section grouping in PackDrawer. */
  tier: KitTier
  /** Hex stops for the hero gradient placeholder (not pad colors — see PadGrid). */
  heroGradient: [string, string]
  /**
   * Optional cover-art URL (under `/images/packs/<kit-id>.png` by
   * convention). When set, KitHeroArt renders the image cropped to fill
   * the card; falls back to `heroGradient` when the field is absent or
   * the asset fails to load. Generated via `asset-bot generate image`
   * — see `tools/generate-pack-covers.sh`.
   */
  coverArt?: string
  /** Optional countdown copy when ownership === 'trial'. */
  trialRemaining?: string
  /**
   * True when the kit is registered in the catalog but its audio assets
   * have not shipped yet (pads array is empty). PackDrawer renders these
   * tiles disabled with a "Coming soon" badge so taps don't navigate into
   * a kit-detail screen that can't load.
   */
  comingSoon?: boolean
}

export interface KitsState {
  /**
   * Runtime kits keyed by id. The contract from issue 04 — every entry
   * carries the full `Kit` shape (id, name, bpm, key, pads). Hero pack is
   * preloaded; paid packs hydrate on-demand via `loadKit()`.
   */
  kits: Record<string, KitMeta>
  /** Currently active kit on PadGrid (id). */
  activeKitId: string
  setActiveKit: (id: string) => void
  /** Replace or insert a kit at runtime — used by `loop-kit-catalog.loadKit()`. */
  upsertKit: (kit: KitMeta) => void
}

// ── Catalog auto-discovery ────────────────────────────────────────────────
//
// Every `src/content-assets/kits/*.json` (except `index.json`) is loaded
// eagerly via Vite. Drop a new JSON in there and the catalog picks it up
// at the next dev-server restart — no edits to this file.
//
// Each JSON ships the full `KitMeta` shape: runtime fields (id, name,
// bpm, key, pads) plus catalog-visual fields (flavor, bpmRange, layers,
// ownership, priceRunbucks, tier, heroGradient, comingSoon).

const KIT_JSON_MODULES = import.meta.glob<KitMeta>(
  '../content-assets/kits/*.json',
  { eager: true, import: 'default' },
)

/**
 * Returns a fresh deep copy of every catalog kit. Deep-cloned so that test
 * mutations of the returned objects don't leak into other tests' baseline.
 * The order is stable: hero pack first, then everything else by id.
 */
function loadCatalog(): KitMeta[] {
  const out: KitMeta[] = []
  for (const [path, mod] of Object.entries(KIT_JSON_MODULES)) {
    // Skip the legacy `index.json` discovery file — it isn't a kit.
    if (path.endsWith('/index.json')) continue
    out.push(JSON.parse(JSON.stringify(mod)))
  }
  out.sort((a, b) => {
    if (a.id === HERO_KIT_ID) return -1
    if (b.id === HERO_KIT_ID) return 1
    return a.id.localeCompare(b.id)
  })
  return out
}

/**
 * Build the catalog map keyed by id. Hero pack first, others alphabetised
 * by id (matching `loadCatalog`'s ordering). Returns a new object on every
 * call so test resets are immutable.
 */
function seedKits(): Record<string, KitMeta> {
  const catalog = loadCatalog()
  const map: Record<string, KitMeta> = {}
  for (const kit of catalog) map[kit.id] = kit
  return map
}

// Legacy hardcoded HERO_PADS + per-kit seedKits arrays were removed in
// favour of `loadCatalog()` above. Pad layout for `lofi_heights_hero`
// lives in `src/content-assets/kits/lofi_heights_hero.json`; catalog
// metadata for every other kit lives alongside it. Drop a JSON, get a
// catalog tile.

const INITIAL_KITS = seedKits()
const INITIAL_ACTIVE_KIT_ID = HERO_KIT_ID

export const useKitsStore = create<KitsState>((set) => ({
  kits: INITIAL_KITS,
  activeKitId: INITIAL_ACTIVE_KIT_ID,
  setActiveKit: (id) => set({ activeKitId: id }),
  upsertKit: (kit) =>
    set((state) => ({
      kits: { ...state.kits, [kit.id]: kit },
    })),
}))

/** Test helper — restore the seeded baseline. Used by vitest specs only. */
export function resetKitsStore(): void {
  useKitsStore.setState({
    kits: seedKits(),
    activeKitId: INITIAL_ACTIVE_KIT_ID,
  })
}

export function getKitById(id: string): KitMeta | undefined {
  return useKitsStore.getState().kits[id]
}

/** Convenience accessor: snapshot of all visual catalog entries as an array. */
export function listKits(): KitMeta[] {
  return Object.values(useKitsStore.getState().kits)
}
