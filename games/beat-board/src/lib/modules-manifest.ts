/**
 * modules-manifest — authoritative enumeration of every module installed
 * into BeatBoard during Issue 01 (`beat-board-01-core-ui-modules`).
 *
 * Later infra/feature issues read this list to:
 *   - Assert their dependencies are present before wiring (integration checks).
 *   - Drive smoke/analytics health checks without re-reading build-manifest.json.
 *   - Provide a stable type for the runtime-facing `ModuleId` union.
 *
 * This file is the project-side contract surface. `.project/build-manifest.json`
 * is the pipeline-side contract (generated post-install). The two must agree;
 * any drift should be resolved in favour of build-manifest.json (regenerated
 * by `scripts/pipeline/build-manifest/generate.ts`) and this file updated.
 *
 * Do NOT import module source from here — this is a metadata manifest only.
 */

export type ModuleCategory =
  | 'ui'
  | 'data'
  | 'monetization'
  | 'multiplayer'
  | 'simulation'
  | 'systems'
  | 'ugc'
  | 'onboarding'
  | 'audio'
  | 'juice';

export interface ModuleManifestEntry {
  /** Stable `<category>/<name>` id used across install metadata + build-manifest.json. */
  id: string;
  category: ModuleCategory;
  /** Bare module name (category-prefix stripped). */
  name: string;
  /**
   * Tier number tracks which infra issue installed the module. Tier 0 = Issue
   * 01 (core UI/data). Tier 0 entries from later infra issues use the same
   * value but the spirit is unchanged: prerequisites for downstream features.
   */
  tier: 0;
}

function entry(id: string): ModuleManifestEntry {
  const sep = id.indexOf('/');
  if (sep === -1) {
    throw new Error(`modules-manifest: malformed module id "${id}" (expected "<category>/<name>")`);
  }
  const category = id.slice(0, sep) as ModuleCategory;
  const name = id.slice(sep + 1);
  return { id, category, name, tier: 0 };
}

/**
 * Core UI modules installed in Issue 01. Ordering matches prd.md
 * § Modules to Install for the tier-0 subset.
 *
 * `ui/shadcn-components` is installed via shadcn/ui CLI into `src/components/`
 * (see `components.json`) rather than into `src/modules/ui/`; it is enumerated
 * here for parity with the issue frontmatter.
 *
 * `ui/skin` ships pre-bundled with the scaffold template (project-owned at
 * `src/modules/ui/skin/`). The skin module is the renderer surface every
 * downstream UI module reskins through, so it is enumerated here.
 */
export const CORE_UI_MODULES: readonly ModuleManifestEntry[] = [
  entry('ui/skin'),
  entry('ui/lucide-icon-system'),
  entry('ui/shadcn-components'),
  entry('ui/tab-navigation'),
  entry('ui/bottom-sheet'),
  entry('ui/confirmation-dialog'),
  entry('ui/settings-overlay'),
  entry('ui/currency-indicator'),
  entry('ui/badge-notifications'),
] as const;

/**
 * Core data + simulation modules installed in Issue 01.
 *
 * `simulation/base-types` is a transitive install pulled in by
 * `data/catalog-system` (catalog entries reuse the simulation entity type
 * vocabulary). It is listed here so downstream issues can assert it is
 * present.
 */
export const CORE_DATA_MODULES: readonly ModuleManifestEntry[] = [
  entry('data/storage-service'),
  entry('data/server-time'),
  entry('data/app-lifecycle'),
  entry('data/safe-area-service'),
  entry('data/feature-flags'),
  entry('data/catalog-system'),
  entry('simulation/base-types'),
] as const;

/**
 * Audio + juice modules installed in Issue 03 (audio engine + beat sequencer).
 * The Pad-Grid Engine, TransportBar, ambient grid pulse, and recording-capture
 * system depend on this set; they read from `isModuleInstalled` to assert
 * presence before wiring.
 */
export const AUDIO_JUICE_MODULES: readonly ModuleManifestEntry[] = [
  entry('audio/audio-manager'),
  entry('juice/beat-sequencer'),
  entry('juice/punch'),
  entry('juice/ui-spring'),
  entry('juice/feedback-channel'),
  entry('juice/feedback-player'),
] as const;

/** Every module installed across the BeatBoard infra tier. */
export const TIER_0_MODULES: readonly ModuleManifestEntry[] = [
  ...CORE_UI_MODULES,
  ...CORE_DATA_MODULES,
  ...AUDIO_JUICE_MODULES,
] as const;

/** Union of every tier-0 module id (e.g. `'ui/skin' | 'data/storage-service' | ...`). */
export type Tier0ModuleId = (typeof TIER_0_MODULES)[number]['id'];

/** Quick membership check — used by later-issue integration assertions. */
export function isModuleInstalled(id: string): boolean {
  return TIER_0_MODULES.some((m) => m.id === id);
}

/** Convenience accessor for grouping modules by category. */
export function modulesByCategory(category: ModuleCategory): readonly ModuleManifestEntry[] {
  return TIER_0_MODULES.filter((m) => m.category === category);
}
