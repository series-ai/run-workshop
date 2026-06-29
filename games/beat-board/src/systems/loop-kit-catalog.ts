/**
 * loop-kit-catalog — BeatBoard's project-side wrapper around the loop-kit
 * pipeline shipped by asset-bot (PR #122).
 *
 * Issue beat-board-04-loop-kit-catalog owns this file. Responsibilities:
 *   - Discover available kit ids via the catalog index (`kits/index.json`),
 *     loaded through the installed `data/catalog-system` module so the
 *     ingestion path is uniform with other game data catalogs.
 *   - Validate each per-kit manifest: every pad MUST carry one of the four
 *     supported color families. On validation failure the loader emits a
 *     loud `RundotAPI.error` diagnostic (per prd.md § Mechanics Detail edge
 *     case "kit metadata missing") and returns an `error` Kit whose
 *     `invalidMetadata` flag tells the harmonic-lockout rule to fall back
 *     to "any combination valid".
 *   - Decode each pad's per-layer .wav buffer through the audio engine,
 *     keyed by `padId`, so the Pad-Grid Engine can later schedule
 *     bar-aligned crossfades against the buffer cache.
 *
 * The loader is deliberately stateless — the kits-store owns the loaded-kit
 * record. Side effects (audio decode, RundotAPI logging) are funnelled
 * through narrow seams (`KitBufferRegistrar`, `KitFetcher`) so vitest cases
 * can drive the whole pipeline without touching Web Audio or the network.
 */

import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { createCatalog } from '@modules/data/catalog-system/CatalogSystem'
import type { CatalogDefinition, CatalogEntry } from '@modules/data/catalog-system/types'
import type { Kit, KitIndexEntry, PadBank, PadColor, PadMeta } from '../types/kit'

// ── Constants ────────────────────────────────────────────────────────────

/**
 * Hero pack id — preloaded at install time per prd.md § Pack ownership and
 * access tiers (Free).
 */
export const HERO_KIT_ID = 'lofi_heights_hero' as const

/** Path to the catalog index JSON, relative to the bundled content-assets root. */
export const KIT_CATALOG_INDEX_PATH = 'src/content-assets/kits/index.json'

/** Path prefix for per-kit manifests, relative to the catalog index. */
export const KIT_CATALOG_DIR = 'src/content-assets/kits/'

const VALID_PAD_COLORS: ReadonlySet<PadColor> = new Set([
  'drums',
  'bass',
  'melody',
  'vocals',
  'drumFills',
  'fx',
])

const VALID_PAD_BANKS: ReadonlySet<PadBank> = new Set<PadBank>(['A', 'B'])

/** Default bank when a manifest omits the field. */
export const DEFAULT_PAD_BANK: PadBank = 'A'

// ── External seams ───────────────────────────────────────────────────────

/**
 * Buffer registrar — the Pad-Grid Engine wires this to
 * `audio-manager.loadAudio(key, ArrayBuffer)`. We keep it as a callable seam
 * so vitest cases can supply a Promise-returning stub instead of a real
 * audio engine.
 */
export type KitBufferRegistrar = (padId: string, bufferUrl: string) => Promise<void>

/** Fetcher for catalog/manifest JSON. Tests override via `__setKitFetcher`. */
export type KitFetcher = (path: string) => Promise<unknown>

let activeFetcher: KitFetcher = defaultKitFetcher

async function defaultKitFetcher(path: string): Promise<unknown> {
  // Production: the catalog index + per-kit manifests are bundled into the
  // app payload via Vite's static-assets pipeline. We import them lazily so a
  // missing manifest surfaces as an exception (caught and logged by the
  // public load functions).
  const importer = import.meta.glob('../content-assets/kits/*.json', {
    import: 'default',
  }) as Record<string, () => Promise<unknown>>

  const filename = path.replace(/^.*\//, '')
  const matchKey = Object.keys(importer).find((key) => key.endsWith(`/${filename}`))
  if (!matchKey) {
    throw new Error(`[loop-kit-catalog] no bundled manifest at ${path}`)
  }
  const importerFn = importer[matchKey]
  if (!importerFn) {
    throw new Error(`[loop-kit-catalog] bundled manifest importer missing at ${path}`)
  }
  return importerFn()
}

/** Test-only: inject a fake fetcher. */
export function __setKitFetcher(fetcher: KitFetcher): void {
  activeFetcher = fetcher
}

/** Test-only: restore the default bundled-import fetcher. */
export function __resetKitFetcher(): void {
  activeFetcher = defaultKitFetcher
}

// ── Validation ───────────────────────────────────────────────────────────

function isValidPad(pad: unknown): pad is PadMeta {
  if (!pad || typeof pad !== 'object') return false
  const p = pad as Partial<PadMeta>
  if (typeof p.padId !== 'string' || p.padId.length === 0) return false
  if (typeof p.layerId !== 'string') return false
  if (typeof p.bufferUrl !== 'string') return false
  if (typeof p.color !== 'string') return false
  if (!VALID_PAD_COLORS.has(p.color as PadColor)) return false
  // `bank` is optional for back-compat with pre-Phase-2 manifests; if present
  // it must be one of the valid bank values.
  if (p.bank !== undefined && !VALID_PAD_BANKS.has(p.bank as PadBank)) return false
  return true
}

/**
 * Coerce a pad's bank field into a definite value, defaulting missing fields
 * to `DEFAULT_PAD_BANK` for back-compat with pre-Phase-2 manifests. Used by
 * the loader before handing the Kit to consumers so downstream code can
 * trust `pad.bank` is always set.
 */
function withBankDefaults(pads: PadMeta[]): PadMeta[] {
  return pads.map((p) =>
    p.bank ? p : { ...p, bank: DEFAULT_PAD_BANK },
  )
}

/**
 * Validate that every pad in `kit` carries one of the four supported color
 * families. Returns false if any pad is missing a color, has an unknown
 * color, has an unknown bank value, or the kit shape itself is malformed.
 * (`bank` is optional — missing banks default to `DEFAULT_PAD_BANK` after
 * validation.) The kits store and `loadKitFromManifest` use this to decide
 * whether to materialise the kit as a real Kit or fall back to an `error`
 * Kit.
 */
export function validateKitManifest(kit: Kit | unknown): kit is Kit {
  if (!kit || typeof kit !== 'object') return false
  const k = kit as Partial<Kit>
  if (typeof k.id !== 'string' || k.id.length === 0) return false
  if (typeof k.name !== 'string') return false
  if (typeof k.bpm !== 'number' || !Number.isFinite(k.bpm)) return false
  if (typeof k.key !== 'string') return false
  if (!Array.isArray(k.pads)) return false
  for (const pad of k.pads) {
    if (!isValidPad(pad)) return false
  }
  return true
}

// ── Error-Kit factory ────────────────────────────────────────────────────

/**
 * Build an "error" Kit for use when validation fails. The harmonic-lockout
 * rule reads `invalidMetadata` and falls back to "any combination valid"
 * per prd.md § Mechanics Detail edge case.
 */
export function buildErrorKit(id: string, name: string): Kit {
  return {
    id,
    name,
    bpm: 0,
    key: '',
    pads: [],
    invalidMetadata: true,
  }
}

// ── Kit loader ───────────────────────────────────────────────────────────

export interface LoadKitOptions {
  /**
   * Per-pad buffer registrar. The Pad-Grid Engine wires this to
   * `audio-manager.loadAudio(key, ArrayBuffer)`; tests pass a stub.
   */
  register?: KitBufferRegistrar
}

/**
 * Decode and register every pad's wav buffer for `manifest`, returning the
 * validated Kit. On validation failure, logs a loud diagnostic and returns
 * an error Kit rather than throwing — the kits store treats this as a
 * normal-but-degraded state so the rest of the app keeps running.
 *
 * Buffer-registration failures are individually logged but do NOT degrade
 * the kit to error state; a single failed pad shouldn't disable the whole
 * harmonic lockout.
 */
export async function loadKitFromManifest(
  manifest: Kit | unknown,
  options: LoadKitOptions = {},
): Promise<Kit> {
  if (!validateKitManifest(manifest)) {
    const id = (manifest as Partial<Kit> | null)?.id ?? 'unknown'
    const name = (manifest as Partial<Kit> | null)?.name ?? 'Unknown Kit'
    RundotAPI.error('[loop-kit-catalog] invalid kit metadata — falling back', {
      kitId: id,
      reason: 'pad color validation failed',
    })
    return buildErrorKit(id, name)
  }

  // From here `manifest` is definitely a Kit — TypeScript narrowed via the
  // type predicate on validateKitManifest. Coerce missing bank fields to the
  // default for back-compat with pre-Phase-2 manifests.
  const kit: Kit = { ...manifest, pads: withBankDefaults(manifest.pads) }

  const register = options.register
  if (register) {
    await Promise.all(
      kit.pads.map(async (pad) => {
        try {
          await register(pad.padId, pad.bufferUrl)
        } catch (err) {
          RundotAPI.error('[loop-kit-catalog] buffer load failed', {
            kitId: kit.id,
            padId: pad.padId,
            bufferUrl: pad.bufferUrl,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }),
    )
  }

  return kit
}

// ── Catalog index ────────────────────────────────────────────────────────

/**
 * Load the catalog index of available kit ids. Returns an empty list (and
 * logs) if no kit JSONs are bundled — the kits store treats an empty list
 * as a degraded state rather than throwing.
 *
 * Discovery is data-driven: every `src/content-assets/kits/*.json` (except
 * the legacy `index.json`) is enumerated via Vite's eager `import.meta.glob`,
 * and the entry's `id` field is the source of truth. This matches
 * `kitsStore`'s discovery so a new pack is "drop a JSON, no other edits"
 * end to end.
 */
const BUNDLED_KIT_MODULES = import.meta.glob<{ id?: unknown }>(
  '../content-assets/kits/*.json',
  { eager: true, import: 'default' },
)

export async function loadKitIndex(): Promise<KitIndexEntry[]> {
  const entries: KitIndexEntry[] = []
  for (const [path, mod] of Object.entries(BUNDLED_KIT_MODULES)) {
    if (path.endsWith('/index.json')) continue
    const id = mod && typeof mod.id === 'string' ? mod.id : null
    if (!id) continue
    const manifestPath = path.replace(/^.*\//, '')
    entries.push({ id, manifestPath })
  }
  return entries
}

/**
 * Catalog-system entry view of a Kit. The catalog-system module requires
 * an index signature (`CatalogEntry`); we widen the value type so the same
 * `id`/`createCatalog()` ergonomics work for kits.
 */
export type KitCatalogEntry = Kit & CatalogEntry

/**
 * Build a typed catalog from a list of fully-loaded Kits. Thin wrapper
 * around `data/catalog-system.createCatalog()` so callers get the same
 * `CatalogDefinition<Kit>` ergonomics other game-data catalogs use.
 */
export function buildKitCatalog(kits: Kit[]): CatalogDefinition<KitCatalogEntry> {
  return createCatalog(kits as KitCatalogEntry[])
}

/**
 * Convenience: load a kit by id by fetching its manifest path and decoding
 * its pad buffers via `register`. Returns an error Kit on missing manifest
 * or validation failure.
 */
export async function loadKit(
  kitId: string,
  options: LoadKitOptions = {},
): Promise<Kit> {
  const index = await loadKitIndex()
  const entry = index.find((e) => e.id === kitId)
  if (!entry) {
    RundotAPI.error('[loop-kit-catalog] kit not found in catalog index', {
      kitId,
    })
    return buildErrorKit(kitId, kitId)
  }

  let manifest: unknown
  try {
    manifest = await activeFetcher(`${KIT_CATALOG_DIR}${entry.manifestPath}`)
  } catch (err) {
    RundotAPI.error('[loop-kit-catalog] kit manifest fetch failed', {
      kitId,
      manifestPath: entry.manifestPath,
      error: err instanceof Error ? err.message : String(err),
    })
    return buildErrorKit(kitId, kitId)
  }

  return loadKitFromManifest(manifest, options)
}
