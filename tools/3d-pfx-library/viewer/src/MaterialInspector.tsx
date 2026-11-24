// Per-layer Material group for the detail viewer. The capability table,
// limits, and atlas registry come from src/materials; this file only maps
// them to labelled native inputs. Edits are feature-level operations that
// PfxBrowserApp stores next to its other layer edits. The parser in
// PfxBrowserApp is the one validation boundary: out-of-range input reaches
// it unchanged and fails there with a named field.

import { useId, useRef, useState, type ReactNode } from 'react'
import {
  PFX_LEGACY_PULSE_LABEL,
  PFX_MATERIAL_CONTROLS,
  PFX_MATERIAL_FEATURES,
  PFX_MATERIAL_QUALITIES,
  getPfxLayerAnimationMode,
  getPfxMaterialCapability,
  getPfxMaterialControlAvailability,
  resolvePfxMaterialPath,
  type PfxAtlasId,
  type PfxAtlasRegistry,
  type PfxLifeValue,
  type PfxMaterialCapability,
  type PfxMaterialControlAvailability,
  type PfxMaterialControlDefinition,
  type PfxMaterialControlGroup,
  type PfxMaterialControlId,
  type PfxMaterialFeature,
  type PfxMaterialFeatureUnsupportedReason,
  type PfxMaterialPath,
  type PfxMaterialQuality,
  type PfxMaterialTuning,
  type PfxNumericLimit,
  type PfxRecipeParseError,
  type PfxRenderSurface,
  type PfxUnsupportedMaterialPathReason,
  type PfxVec2,
} from '@pfx'
import { describePfxMaterialRuntime, type PfxMaterialRuntimeStatus } from './materialRuntimeStatus'

// ---------------------------------------------------------------------------
// Edit model. An absent feature key keeps the base recipe value. `remove`
// deletes a feature that the base recipe sets. Material reset deletes the
// whole layer edit, which restores the base recipe material.

type PfxMaterialFeatureValue<F extends PfxMaterialFeature> = NonNullable<PfxMaterialTuning[F]>

export type PfxMaterialFeatureEdit<F extends PfxMaterialFeature> =
  | { op: 'set'; value: PfxMaterialFeatureValue<F> }
  | { op: 'remove' }

export type PfxMaterialLayerEdit = { [F in PfxMaterialFeature]?: PfxMaterialFeatureEdit<F> }

export function setPfxMaterialFeature<F extends PfxMaterialFeature>(
  edit: PfxMaterialLayerEdit | undefined,
  feature: F,
  value: PfxMaterialFeatureValue<F>,
): PfxMaterialLayerEdit {
  return { ...edit, [feature]: { op: 'set', value } }
}

/** `remove` only when the base sets the feature; otherwise drop the edit key. */
export function removePfxMaterialFeature(
  edit: PfxMaterialLayerEdit | undefined,
  feature: PfxMaterialFeature,
  base: PfxMaterialTuning | undefined,
): PfxMaterialLayerEdit | undefined {
  const next: PfxMaterialLayerEdit = { ...edit }
  if (base?.[feature] !== undefined) (next as Record<PfxMaterialFeature, { op: 'remove' }>)[feature] = { op: 'remove' }
  else delete next[feature]
  return Object.keys(next).length > 0 ? next : undefined
}

/**
 * Applies feature edits to the base material. Untouched features keep their
 * base values. A layer without a base material and without set features
 * stays on the existing renderer (no `material` key).
 */
export function applyPfxMaterialLayerEdit(
  base: PfxMaterialTuning | undefined,
  edit: PfxMaterialLayerEdit | undefined,
): PfxMaterialTuning | undefined {
  if (!edit) return base
  const next: Record<string, unknown> = { ...base }
  for (const feature of PFX_MATERIAL_FEATURES) {
    const featureEdit = edit[feature]
    if (!featureEdit) continue
    if (featureEdit.op === 'set') next[feature] = featureEdit.value
    else delete next[feature]
  }
  if (base === undefined && Object.keys(next).length === 0) return undefined
  return next as PfxMaterialTuning
}

// ---------------------------------------------------------------------------
// Runtime status comes from PfxMaterialRuntimeProbe (materialRuntimeStatus.tsx),
// which measures the compiled programs and loaded textures of the preview.

export type PfxMaterialInspectorState = 'empty' | 'default' | 'loading' | 'error'

// ---------------------------------------------------------------------------
// Quality. The detail viewer authors at high. `materialQuality=low|high`
// selects a fixed value for captures. Quality is preview state only.

export const PFX_MATERIAL_VIEWER_DEFAULT_QUALITY: PfxMaterialQuality = 'high'

export type PfxMaterialQualityQuery =
  | { status: 'absent'; quality: PfxMaterialQuality }
  | { status: 'valid'; quality: PfxMaterialQuality }
  | { status: 'invalid'; quality: PfxMaterialQuality; raw: string }

export function readPfxMaterialQualityQuery(search: string): PfxMaterialQualityQuery {
  const raw = new URLSearchParams(search).get('materialQuality')
  if (raw === null) return { status: 'absent', quality: PFX_MATERIAL_VIEWER_DEFAULT_QUALITY }
  if ((PFX_MATERIAL_QUALITIES as readonly string[]).includes(raw)) return { status: 'valid', quality: raw as PfxMaterialQuality }
  return { status: 'invalid', quality: PFX_MATERIAL_VIEWER_DEFAULT_QUALITY, raw }
}

export function MaterialQualitySelector({
  quality,
  query,
  onChange,
}: {
  quality: PfxMaterialQuality
  query: PfxMaterialQualityQuery
  onChange: (quality: PfxMaterialQuality) => void
}) {
  const noteId = useId()
  return (
    <div className="pfx-material-quality" data-testid="pfx-material-quality" data-quality={quality}>
      <label>
        <span>Material quality</span>
        <select
          aria-label="Material quality"
          aria-describedby={noteId}
          data-testid="pfx-material-quality-select"
          value={quality}
          onChange={(event) => onChange(event.currentTarget.value as PfxMaterialQuality)}
        >
          <option value="high">High (authoring)</option>
          <option value="low">Low (host default)</option>
        </select>
      </label>
      <p id={noteId} className="pfx-material-note">
        Preview setting only. Recipe JSON does not store it. Low turns off distortion and depth fade.
      </p>
      {query.status === 'invalid' ? (
        <p role="alert" className="pfx-material-error-text" data-testid="pfx-material-quality-error">
          The materialQuality value "{query.raw}" is not valid. Use low or high. The preview uses high.
        </p>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Static UI data. Labels and limits come from PFX_MATERIAL_CONTROLS.

const GROUPS: ReadonlyArray<{ id: PfxMaterialControlGroup; label: string }> = [
  { id: 'texture-motion', label: 'Texture motion' },
  { id: 'mask-dissolve', label: 'Mask and dissolve' },
  { id: 'rim', label: 'Rim' },
  { id: 'depth-fade', label: 'Depth fade' },
]

const CONTROL_IDS = Object.keys(PFX_MATERIAL_CONTROLS) as PfxMaterialControlId[]

/** The group and first control of each feature, derived from the control table. */
const FEATURE_INFO = Object.fromEntries(
  PFX_MATERIAL_FEATURES.map((feature) => {
    const primary = CONTROL_IDS.find((id) => PFX_MATERIAL_CONTROLS[id].feature === feature)
    if (!primary) throw new Error(`MaterialInspector: feature ${feature} has no control definition`)
    return [feature, { primary, group: PFX_MATERIAL_CONTROLS[primary].group }]
  }),
) as Record<PfxMaterialFeature, { primary: PfxMaterialControlId; group: PfxMaterialControlGroup }>

const FEATURE_LABELS: Record<PfxMaterialFeature, string> = {
  uv: 'UV transform',
  distortion: 'Distortion',
  mask: 'Mask',
  dissolve: 'Dissolve',
  rim: 'Rim override',
  frameAnimation: 'Frame animation',
  softParticles: 'Depth fade',
}

/** Keyboard step per numeric control. Each step aligns with its limit minimum. */
const CONTROL_STEPS: Partial<Record<PfxMaterialControlId, number>> = {
  'uv.scale': 0.01,
  'uv.offset': 0.01,
  'uv.rotation': 0.01,
  'uv.scroll': 0.01,
  'distortion.strength': 0.005,
  'distortion.direction': 0.05,
  'distortion.scroll': 0.01,
  'mask.strength': 0.01,
  'dissolve.progress': 0.01,
  'dissolve.softness': 0.0001,
  'dissolve.edgeWidth': 0.005,
  'rim.power': 0.1,
  'rim.strength': 0.01,
  'softParticles.distance': 0.001,
}

const UNIT_NAMES: Record<string, string> = {
  '×': 'multiplier',
  UV: 'UV units',
  'UV/s': 'UV units per second',
  rad: 'radians',
  'world units': 'world units',
}

const PATH_LABELS: Record<PfxMaterialPath['kind'], string> = {
  'generic-sprite': 'Sprite shader',
  'fresnel-shell': 'Shared shell shader',
  'vortex-swirl': 'Vortex shader',
  'portal-throat': 'Portal throat shader',
  unsupported: 'Not available',
}

const PATH_REASONS: Record<PfxUnsupportedMaterialPathReason, string> = {
  'screen-shader': 'This layer is a screen shader.',
  'meteor-chunk-instances': 'This layer draws meteor chunk meshes.',
  'plasma-impact-flipbook': 'This layer uses the plasma impact sheet factory.',
  'special-mesh-geometry': 'This layer uses a special mesh shape.',
  'bubble-shell-cluster': 'This layer draws a bubble shell cluster.',
  'shader-not-opted-in': 'This mesh shader does not use shared material settings.',
  'mesh-kind-not-opted-in': 'This mesh layer does not use shared material settings.',
}

const FEATURE_REASONS: Record<PfxMaterialFeatureUnsupportedReason, string> = {
  'unsupported-path': 'This layer does not use shared material settings.',
  'flat-billboard-has-no-rim': 'A flat sprite has no rim.',
  'no-texture-uv': 'This shader has no texture UV input.',
  'not-on-this-path': 'This shader does not support it.',
  'needs-explicit-alpha-sprite': 'Only sprites with alpha blend support it.',
  'no-frame-sheet-path': 'Only sprite layers can play an animation sheet.',
}

const DISABLED_REASONS: Record<Extract<PfxMaterialControlAvailability, { state: 'disabled' }>['reason'], string> = {
  'needs-high-quality': 'Low quality turns this off. Your values are saved.',
  'reduced-motion': 'Reduced motion stops this motion. Your values are saved.',
}

function defaultFeatureValue<F extends PfxMaterialFeature>(
  feature: F,
  capability: PfxMaterialCapability,
  atlasId: PfxAtlasId | undefined,
): PfxMaterialFeatureValue<F> {
  const values: { [K in PfxMaterialFeature]: () => PfxMaterialFeatureValue<K> } = {
    uv: () => ({ scale: [1, 1], offset: [0, 0], rotation: 0, scroll: [0, 0], wrap: 'clamp' }),
    distortion: () => ({ kind: 'noise', map: 'noise-a', strength: 0.05, direction: [0, 1], scroll: [0, 0.25] }),
    mask: () => ({ map: 'mask-a', channel: 'r', strength: 1 }),
    dissolve: () => ({ map: 'noise-a', progress: 0, softness: 0.05, edgeWidth: 0.02, edgeColor: '#ffffff' }),
    rim: () => ({ power: capability.baselineRim?.power ?? 2, strength: capability.baselineRim?.strength ?? 1 }),
    frameAnimation: () => {
      if (!atlasId) throw new Error('MaterialInspector: frame animation needs an atlas ID')
      return { atlas: atlasId, frameBlend: false }
    },
    softParticles: () => ({ distance: 0.5 }),
  }
  return values[feature]() as PfxMaterialFeatureValue<F>
}

// ---------------------------------------------------------------------------
// Inspector.

export interface MaterialInspectorProps {
  /** Layer edit key: the surface phase, or its kind. */
  phase: string
  /** Effective surface: base recipe plus every pending layer edit. */
  surface: PfxRenderSurface
  /** Base recipe material, used to restore a feature after Off. */
  baseMaterial: PfxMaterialTuning | undefined
  edited: boolean
  quality: PfxMaterialQuality
  reducedMotion: boolean
  atlasRegistry: PfxAtlasRegistry
  /** Parser error inside this layer's material. The preview keeps the last valid recipe. */
  editError: PfxRecipeParseError | null
  runtime: PfxMaterialRuntimeStatus
  /** Revision of the current material edit. Older runtime results are stale. */
  revision: number
  onSetFeature: <F extends PfxMaterialFeature>(feature: F, value: PfxMaterialFeatureValue<F>) => void
  onRemoveFeature: (feature: PfxMaterialFeature) => void
  onReset: () => void
  onRetry: () => void
}

function inspectorState(
  path: PfxMaterialPath,
  editError: PfxRecipeParseError | null,
  runtime: PfxMaterialRuntimeStatus,
  revision: number,
): PfxMaterialInspectorState {
  if (path.kind === 'unsupported') return 'empty'
  if (editError) return 'error'
  switch (runtime.state) {
    case 'loading':
      return 'loading'
    case 'ready':
      return runtime.revision === revision ? 'default' : 'loading'
    case 'error':
      return runtime.revision === revision ? 'error' : 'loading'
    default: {
      const exhausted: never = runtime
      throw new Error(`Unhandled material runtime status ${JSON.stringify(exhausted)}`)
    }
  }
}

export function MaterialInspector(props: MaterialInspectorProps) {
  const { phase, surface, edited, editError, runtime, revision, onReset, onRetry } = props
  const path = resolvePfxMaterialPath({ surface })
  const capability = getPfxMaterialCapability(path)
  const state = inspectorState(path, editError, runtime, revision)
  const material = surface.tuning?.material
  const statusId = useId()
  return (
    <details
      className="pfx-material"
      data-testid={`pfx-material-${phase}`}
      data-state={state}
      data-path={path.kind}
      data-revision={revision}
      data-runtime={describePfxMaterialRuntime(runtime)}
    >
      <summary aria-label={`Material for ${phase}`}>
        <span className="pfx-material-title">Material</span>
        <span className="pfx-material-path">
          {PATH_LABELS[path.kind]}
          {edited ? ' · edited' : ''}
        </span>
      </summary>
      <div className="pfx-material-body" aria-describedby={statusId}>
        <MaterialStatus id={statusId} state={state} path={path} editError={editError} runtime={runtime} onRetry={onRetry} />
        {path.kind === 'unsupported' ? null : (
          <>
            {GROUPS.map((group) => (
              <MaterialGroup key={group.id} group={group} capability={capability} material={material} {...props} />
            ))}
            <UnavailableFeatures capability={capability} material={material} phase={phase} onRemoveFeature={props.onRemoveFeature} />
            <div className="pfx-material-actions">
              <button
                type="button"
                data-testid={`pfx-material-reset-${phase}`}
                aria-label={`Reset material for ${phase}`}
                disabled={!edited}
                onClick={onReset}
              >
                Reset material
              </button>
              <span className="pfx-material-note">Restores the recipe values for this layer only.</span>
            </div>
          </>
        )}
      </div>
    </details>
  )
}

function MaterialStatus({
  id,
  state,
  path,
  editError,
  runtime,
  onRetry,
}: {
  id: string
  state: PfxMaterialInspectorState
  path: PfxMaterialPath
  editError: PfxRecipeParseError | null
  runtime: PfxMaterialRuntimeStatus
  onRetry: () => void
}) {
  const status = useRef<HTMLDivElement>(null)
  const retry = () => {
    status.current?.focus()
    onRetry()
  }
  switch (state) {
    case 'empty':
      return (
        <div ref={status} tabIndex={-1} id={id} className="pfx-material-status" data-testid="pfx-material-empty">
          Material controls are not available for this layer.{' '}
          {path.kind === 'unsupported' ? PATH_REASONS[path.reason] : null}
        </div>
      )
    case 'loading':
      return (
        <div ref={status} tabIndex={-1} id={id} className="pfx-material-status" role="status" data-testid="pfx-material-loading">
          Loading material resources. Your settings are saved.
        </div>
      )
    case 'error':
      return (
        <div ref={status} tabIndex={-1} id={id} className="pfx-material-status pfx-material-error" role="alert" data-testid="pfx-material-error">
          <p>
            {editError
              ? `This edit is not valid: ${editError.message}`
              : `Material could not load: ${runtime.state === 'error' ? runtime.message : 'unknown error'}`}
          </p>
          <p>The preview uses the last valid recipe, if one is available. Your edits are saved.</p>
          {editError ? null : (
            <button type="button" data-testid="pfx-material-retry" onClick={retry}>
              Retry
            </button>
          )}
        </div>
      )
    case 'default':
      return (
        <div ref={status} tabIndex={-1} id={id} className="pfx-material-status" data-testid="pfx-material-default">
          Settings are valid. The material is ready.
        </div>
      )
    default: {
      const exhausted: never = state
      throw new Error(`Unhandled material inspector state ${String(exhausted)}`)
    }
  }
}

// A feature can become unsupported after another edit, for example a blend
// change on a sprite with depth fade. Its saved value then gets a Remove
// action, because its controls are hidden.
function UnavailableFeatures({
  capability,
  material,
  phase,
  onRemoveFeature,
}: {
  capability: PfxMaterialCapability
  material: PfxMaterialTuning | undefined
  phase: string
  onRemoveFeature: (feature: PfxMaterialFeature) => void
}) {
  const unavailable = PFX_MATERIAL_FEATURES.flatMap((feature) => {
    const support = capability.features[feature]
    return support.status === 'unsupported' ? [{ feature, reason: support.reason }] : []
  })
  if (unavailable.length === 0) return null
  return (
    <ul className="pfx-material-unavailable" aria-label="Not available on this layer">
      {unavailable.map(({ feature, reason }) => (
        <li key={feature}>
          {FEATURE_LABELS[feature]}: {FEATURE_REASONS[reason]}
          {material?.[feature] !== undefined ? (
            <button type="button" aria-label={`Remove ${FEATURE_LABELS[feature]} for ${phase}`} onClick={() => onRemoveFeature(feature)}>
              Remove
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

type GroupProps = MaterialInspectorProps & {
  group: { id: PfxMaterialControlGroup; label: string }
  capability: PfxMaterialCapability
  material: PfxMaterialTuning | undefined
}

function MaterialGroup(props: GroupProps) {
  const { group, capability } = props
  const features = PFX_MATERIAL_FEATURES.filter(
    (feature) => FEATURE_INFO[feature].group === group.id && capability.features[feature].status === 'supported',
  )
  if (features.length === 0) {
    // Texture motion still states the animation mode, as plain text.
    return group.id === 'texture-motion' ? <AnimationNote {...props} /> : null
  }
  return (
    <fieldset className="pfx-material-group" data-testid={`pfx-material-group-${props.phase}-${group.id}`}>
      <legend>{group.label}</legend>
      {features.map((feature) => (
        <FeatureEditor key={feature} feature={feature} {...props} />
      ))}
      {group.id === 'texture-motion' ? <AnimationNote {...props} /> : null}
      {group.id === 'depth-fade' ? (
        <p className="pfx-material-note">
          Depth fade needs a host depth source. This viewer has none, so the preview uses the hard depth test.
        </p>
      ) : null}
    </fieldset>
  )
}

function AnimationNote({ surface, capability }: GroupProps) {
  const mode = getPfxLayerAnimationMode(surface.tuning)
  if (capability.features.frameAnimation.status !== 'supported') {
    return <p className="pfx-material-note">No animation sheet. This layer uses procedural motion.</p>
  }
  if (mode === 'frame-animation') return null
  const legacyAtlas = surface.tuning?.flipbookAtlas
  return (
    <p className="pfx-material-note" data-testid="pfx-material-legacy-pulse">
      Animation: {PFX_LEGACY_PULSE_LABEL}. It changes brightness and size. It does not play image frames.
      {legacyAtlas ? ` This layer also samples the ${legacyAtlas} sheet through flipbookAtlas.` : ' No animation sheet is selected.'}
    </p>
  )
}

function FeatureEditor({ feature, ...props }: GroupProps & { feature: PfxMaterialFeature }) {
  const { capability, material, quality, reducedMotion, baseMaterial, phase, onSetFeature, onRemoveFeature, atlasRegistry, surface } = props
  const context = { quality, reducedMotion }
  const availability = (control: PfxMaterialControlId) => getPfxMaterialControlAvailability(capability, control, context)
  const primary = availability(FEATURE_INFO[feature].primary)
  const reasonId = useId()
  // One reason line per feature covers every disabled control in it, for
  // example UV scroll under reduced motion while UV scale stays editable.
  // A feature that is off shows only its on/off control, so only that
  // control can carry a reason.
  const visibleControls = material?.[feature] !== undefined
    ? CONTROL_IDS.filter((id) => PFX_MATERIAL_CONTROLS[id].feature === feature)
    : [FEATURE_INFO[feature].primary]
  const reasons = [...new Set(
    visibleControls.flatMap((id) => {
      const state = availability(id)
      return state.state === 'disabled' ? [DISABLED_REASONS[state.reason]] : []
    }),
  )]
  const reason = reasons.length > 0 ? reasons.join(' ') : null
  const enable = () => {
    const base = baseMaterial?.[feature]
    onSetFeature(feature, base ?? defaultFeatureValue(feature, capability, atlasRegistry.ids[0]))
  }
  const toggle = (on: boolean) => (on ? enable() : onRemoveFeature(feature))
  const controlProps = { phase, availability, lifeCurves: capability.lifeCurves, reasonId }
  const body = (() => {
    switch (feature) {
      case 'uv': {
        const value = material?.uv
        return (
          <FeatureToggle label={FEATURE_LABELS.uv} phase={phase} on={Boolean(value)} disabled={primary.state === 'disabled'} reasonId={reasonId} onToggle={toggle}>
            {value ? (
              <>
                <Vec2Control id="uv.scale" value={value.scale} axes={['U', 'V']} onChange={(scale) => onSetFeature('uv', { ...value, scale })} {...controlProps} />
                <Vec2Control id="uv.offset" value={value.offset} axes={['U', 'V']} onChange={(offset) => onSetFeature('uv', { ...value, offset })} {...controlProps} />
                <NumberControl id="uv.rotation" value={value.rotation} onChange={(rotation) => onSetFeature('uv', { ...value, rotation })} {...controlProps} />
                <Vec2Control id="uv.scroll" value={value.scroll} axes={['U', 'V']} onChange={(scroll) => onSetFeature('uv', { ...value, scroll })} {...controlProps} />
                <EnumControl id="uv.wrap" value={value.wrap} onChange={(wrap) => onSetFeature('uv', { ...value, wrap: wrap as typeof value.wrap })} {...controlProps} />
              </>
            ) : null}
          </FeatureToggle>
        )
      }
      case 'distortion': {
        const value = material?.distortion
        const kindDisabled = primary.state !== 'available'
        return (
          <>
            <label className="pfx-material-field">
              <span>{PFX_MATERIAL_CONTROLS['distortion.kind'].label}</span>
              <select
                aria-label={`${PFX_MATERIAL_CONTROLS['distortion.kind'].label} for ${phase}`}
                aria-describedby={reason ? reasonId : undefined}
                data-control="distortion.kind"
                disabled={kindDisabled}
                value={value?.kind ?? 'off'}
                onChange={(event) => {
                  const kind = event.currentTarget.value
                  if (kind === 'off') return onRemoveFeature('distortion')
                  const strength = value?.strength ?? 0.05
                  const scroll = value?.scroll ?? [0, 0.25]
                  onSetFeature(
                    'distortion',
                    kind === 'flow'
                      ? { kind: 'flow', map: 'flow-a', strength, scroll }
                      : { kind: 'noise', map: 'noise-a', strength, scroll, direction: value?.kind === 'noise' ? value.direction : [0, 1] },
                  )
                }}
              >
                <option value="off">Off</option>
                <option value="noise">Noise</option>
                <option value="flow">Flow map</option>
              </select>
            </label>
            {value ? (
              <>
                <LifeControl id="distortion.strength" value={value.strength} onChange={(strength) => onSetFeature('distortion', { ...value, strength })} {...controlProps} />
                {value.kind === 'noise' ? (
                  <Vec2Control id="distortion.direction" value={value.direction} axes={['X', 'Y']} onChange={(direction) => onSetFeature('distortion', { ...value, direction })} {...controlProps} />
                ) : null}
                <Vec2Control id="distortion.scroll" value={value.scroll} axes={['U', 'V']} onChange={(scroll) => onSetFeature('distortion', { ...value, scroll })} {...controlProps} />
              </>
            ) : null}
          </>
        )
      }
      case 'frameAnimation': {
        const value = material?.frameAnimation
        const legacyAtlas = surface.tuning?.flipbookAtlas
        // A legacy flipbookAtlas fixes the sheet: the parser rejects any other ID.
        const atlasIds = legacyAtlas ? atlasRegistry.ids.filter((id) => id === legacyAtlas) : atlasRegistry.ids
        return (
          <>
            <label className="pfx-material-field pfx-material-field-wide">
              <span>{PFX_MATERIAL_CONTROLS['frameAnimation.atlas'].label}</span>
              <select
                aria-label={`${PFX_MATERIAL_CONTROLS['frameAnimation.atlas'].label} for ${phase}`}
                aria-describedby={reason ? reasonId : undefined}
                data-control="frameAnimation.atlas"
                disabled={primary.state !== 'available'}
                value={value?.atlas ?? 'none'}
                onChange={(event) => {
                  const selected = event.currentTarget.value
                  if (selected === 'none') return onRemoveFeature('frameAnimation')
                  const descriptor = atlasRegistry.lookup(selected)
                  if (!descriptor) throw new Error(`MaterialInspector: atlas ${selected} is not in the registry`)
                  onSetFeature('frameAnimation', { atlas: descriptor.id, frameBlend: value?.frameBlend ?? false })
                }}
              >
                <option value="none">No animation sheet ({PFX_LEGACY_PULSE_LABEL.toLowerCase()})</option>
                {atlasIds.map((id) => {
                  const descriptor = atlasRegistry.get(id)
                  return (
                    <option key={id} value={id}>
                      {id} · {descriptor.frameCount} frames · {descriptor.frameRate} fps
                    </option>
                  )
                })}
              </select>
            </label>
            {value ? (
              <BooleanControl id="frameAnimation.frameBlend" value={value.frameBlend} onChange={(frameBlend) => onSetFeature('frameAnimation', { ...value, frameBlend })} {...controlProps} />
            ) : null}
          </>
        )
      }
      case 'mask': {
        const value = material?.mask
        return (
          <FeatureToggle label={FEATURE_LABELS.mask} phase={phase} on={Boolean(value)} disabled={primary.state === 'disabled'} reasonId={reasonId} onToggle={toggle}>
            {value ? (
              <>
                <EnumControl id="mask.channel" value={value.channel} onChange={(channel) => onSetFeature('mask', { ...value, channel: channel as typeof value.channel })} {...controlProps} />
                <NumberControl id="mask.strength" value={value.strength} onChange={(strength) => onSetFeature('mask', { ...value, strength })} {...controlProps} />
              </>
            ) : null}
          </FeatureToggle>
        )
      }
      case 'dissolve': {
        const value = material?.dissolve
        return (
          <FeatureToggle label={FEATURE_LABELS.dissolve} phase={phase} on={Boolean(value)} disabled={primary.state === 'disabled'} reasonId={reasonId} onToggle={toggle}>
            {value ? (
              <>
                <LifeControl id="dissolve.progress" value={value.progress} onChange={(progress) => onSetFeature('dissolve', { ...value, progress })} {...controlProps} />
                <NumberControl id="dissolve.softness" value={value.softness} onChange={(softness) => onSetFeature('dissolve', { ...value, softness })} {...controlProps} />
                <NumberControl id="dissolve.edgeWidth" value={value.edgeWidth} onChange={(edgeWidth) => onSetFeature('dissolve', { ...value, edgeWidth })} {...controlProps} />
                <ColorControl id="dissolve.edgeColor" value={value.edgeColor} onChange={(edgeColor) => onSetFeature('dissolve', { ...value, edgeColor })} {...controlProps} />
              </>
            ) : null}
          </FeatureToggle>
        )
      }
      case 'rim': {
        const value = material?.rim
        return (
          <FeatureToggle label={FEATURE_LABELS.rim} phase={phase} on={Boolean(value)} disabled={primary.state === 'disabled'} reasonId={reasonId} onToggle={toggle}>
            {value ? (
              <>
                <NumberControl id="rim.power" value={value.power} onChange={(power) => onSetFeature('rim', { ...value, power })} {...controlProps} />
                <LifeControl id="rim.strength" value={value.strength} onChange={(strength) => onSetFeature('rim', { ...value, strength })} {...controlProps} />
                <label className="pfx-material-check">
                  <input
                    type="checkbox"
                    aria-label={`Custom rim colour for ${phase}`}
                    checked={value.color !== undefined}
                    onChange={(event) => {
                      if (event.currentTarget.checked) return onSetFeature('rim', { ...value, color: '#ffffff' })
                      const { color: _omitted, ...rest } = value
                      onSetFeature('rim', rest)
                    }}
                  />
                  <span>Custom rim colour</span>
                </label>
                {value.color !== undefined ? (
                  <ColorControl id="rim.color" value={value.color} onChange={(color) => onSetFeature('rim', { ...value, color })} {...controlProps} />
                ) : (
                  <p className="pfx-material-note">The rim uses the shader hot colour.</p>
                )}
              </>
            ) : capability.baselineRim ? (
              <p className="pfx-material-note">
                The shader rim is power {capability.baselineRim.power}, strength {capability.baselineRim.strength}. An override replaces it.
              </p>
            ) : null}
          </FeatureToggle>
        )
      }
      case 'softParticles': {
        const value = material?.softParticles
        return (
          <FeatureToggle label={FEATURE_LABELS.softParticles} phase={phase} on={Boolean(value)} disabled={primary.state === 'disabled'} reasonId={reasonId} onToggle={toggle}>
            {value ? (
              <NumberControl id="softParticles.distance" value={value.distance} onChange={(distance) => onSetFeature('softParticles', { distance })} {...controlProps} />
            ) : null}
          </FeatureToggle>
        )
      }
      default: {
        const exhausted: never = feature
        throw new Error(`Unhandled material feature ${String(exhausted)}`)
      }
    }
  })()
  return (
    <div className="pfx-material-feature" data-feature={feature} data-availability={primary.state}>
      {body}
      {reason ? (
        <p id={reasonId} className="pfx-material-reason" data-testid={`pfx-material-reason-${phase}-${feature}`}>
          {reason}
        </p>
      ) : null}
    </div>
  )
}

function FeatureToggle({
  label,
  phase,
  on,
  disabled,
  reasonId,
  onToggle,
  children,
}: {
  label: string
  phase: string
  on: boolean
  disabled: boolean
  reasonId: string
  onToggle: (on: boolean) => void
  children: ReactNode
}) {
  return (
    <>
      <label className="pfx-material-check">
        <input
          type="checkbox"
          aria-label={`${label} for ${phase}`}
          aria-describedby={disabled ? reasonId : undefined}
          checked={on}
          disabled={disabled}
          onChange={(event) => onToggle(event.currentTarget.checked)}
        />
        <span>{label}</span>
      </label>
      {children}
    </>
  )
}

// ---------------------------------------------------------------------------
// Native inputs. Each value is in the native unit of the contract.

interface ControlProps {
  phase: string
  availability: (control: PfxMaterialControlId) => PfxMaterialControlAvailability
  lifeCurves: boolean
  /** ID of the feature reason line. Disabled controls point to it. */
  reasonId: string
}

function unitSuffix(id: PfxMaterialControlId): { short: string; long: string } | null {
  const definition: PfxMaterialControlDefinition = PFX_MATERIAL_CONTROLS[id]
  if (!definition.unit) return null
  return { short: definition.unit, long: UNIT_NAMES[definition.unit] ?? definition.unit }
}

function accessibleName(id: PfxMaterialControlId, phase: string, detail?: string): string {
  const unit = unitSuffix(id)
  const label = `${PFX_MATERIAL_CONTROLS[id].label}${detail ? ` ${detail}` : ''}`
  return `${label}${unit ? ` (${unit.long})` : ''} for ${phase}`
}

function controlLimit(id: PfxMaterialControlId): PfxNumericLimit {
  const definition: PfxMaterialControlDefinition = PFX_MATERIAL_CONTROLS[id]
  if (!definition.limit) throw new Error(`MaterialInspector: control ${id} has no numeric limit`)
  return definition.limit
}

function NumberField({
  id,
  name,
  visibleLabel,
  value,
  disabled,
  describedBy,
  onChange,
}: {
  id: PfxMaterialControlId
  name: string
  visibleLabel: string
  value: number
  disabled: boolean
  describedBy: string | undefined
  onChange: (value: number) => void
}) {
  // A draft keeps partial text such as "-" or "0." while the user types.
  // Only finite numbers reach the store; the parser checks the range.
  const [draft, setDraft] = useState<string | null>(null)
  const limit = controlLimit(id)
  const unit = unitSuffix(id)
  const invalidDraft = draft !== null && !Number.isFinite(Number.parseFloat(draft))
  return (
    <label className="pfx-material-field">
      <span>
        {visibleLabel}
        {unit ? <abbr title={unit.long}> {unit.short}</abbr> : null}
      </span>
      <input
        type="number"
        aria-label={name}
        data-control={id}
        min={limit.min}
        max={limit.max}
        step={CONTROL_STEPS[id] ?? 'any'}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={invalidDraft || value < limit.min || value > limit.max}
        value={draft ?? String(value)}
        onChange={(event) => {
          setDraft(event.currentTarget.value)
          const next = event.currentTarget.valueAsNumber
          if (Number.isFinite(next)) onChange(next)
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  )
}

function disabledFor(availability: PfxMaterialControlAvailability): boolean {
  return availability.state !== 'available'
}

function describedByFor(disabled: boolean, reasonId: string): string | undefined {
  return disabled ? reasonId : undefined
}

function NumberControl({ id, value, onChange, phase, availability, reasonId }: ControlProps & { id: PfxMaterialControlId; value: number; onChange: (value: number) => void }) {
  const disabled = disabledFor(availability(id))
  return (
    <NumberField
      id={id}
      name={accessibleName(id, phase)}
      visibleLabel={PFX_MATERIAL_CONTROLS[id].label}
      value={value}
      disabled={disabled}
      describedBy={describedByFor(disabled, reasonId)}
      onChange={onChange}
    />
  )
}

function Vec2Control({
  id,
  value,
  axes,
  onChange,
  phase,
  availability,
  reasonId,
}: ControlProps & { id: PfxMaterialControlId; value: PfxVec2; axes: [string, string]; onChange: (value: PfxVec2) => void }) {
  const disabled = disabledFor(availability(id))
  return (
    <div className="pfx-material-vec" role="group" aria-label={`${PFX_MATERIAL_CONTROLS[id].label} for ${phase}`}>
      {axes.map((axis, index) => (
        <NumberField
          key={axis}
          id={id}
          name={accessibleName(id, phase, axis)}
          visibleLabel={`${PFX_MATERIAL_CONTROLS[id].label} ${axis}`}
          value={value[index]!}
          disabled={disabled}
          describedBy={describedByFor(disabled, reasonId)}
          onChange={(component) => onChange(index === 0 ? [component, value[1]] : [value[0], component])}
        />
      ))}
    </div>
  )
}

const LIFE_STOPS = ['age 0', 'age 0.5', 'age 1'] as const

function LifeControl({
  id,
  value,
  onChange,
  phase,
  availability,
  lifeCurves,
  reasonId,
}: ControlProps & { id: PfxMaterialControlId; value: PfxLifeValue; onChange: (value: PfxLifeValue) => void }) {
  const disabled = disabledFor(availability(id))
  const label = PFX_MATERIAL_CONTROLS[id].label
  return (
    <div className="pfx-material-life" role="group" aria-label={`${label} for ${phase}`}>
      {lifeCurves ? (
        <label className="pfx-material-field">
          <span>{label} over life</span>
          <select
            aria-label={`${label} curve type for ${phase}`}
            data-control={`${id}.mode`}
            disabled={disabled}
            aria-describedby={describedByFor(disabled, reasonId)}
            value={typeof value === 'number' ? 'constant' : 'life'}
            onChange={(event) => {
              if (event.currentTarget.value === 'life') {
                if (typeof value === 'number') onChange({ kind: 'life', values: [value, value, value] })
              } else if (typeof value !== 'number') {
                onChange(value.values[0])
              }
            }}
          >
            <option value="constant">Constant</option>
            <option value="life">Life curve</option>
          </select>
        </label>
      ) : null}
      {typeof value === 'number' ? (
        <NumberField id={id} name={accessibleName(id, phase)} visibleLabel={label} value={value} disabled={disabled} describedBy={describedByFor(disabled, reasonId)} onChange={onChange} />
      ) : (
        value.values.map((stop, index) => (
          <NumberField
            key={LIFE_STOPS[index]}
            id={id}
            name={accessibleName(id, phase, `at ${LIFE_STOPS[index]}`)}
            visibleLabel={`${label} at ${LIFE_STOPS[index]}`}
            value={stop}
            disabled={disabled}
            describedBy={describedByFor(disabled, reasonId)}
            onChange={(next) => {
              const values: [number, number, number] = [...value.values]
              values[index] = next
              onChange({ kind: 'life', values })
            }}
          />
        ))
      )}
    </div>
  )
}

function EnumControl({ id, value, onChange, phase, availability, reasonId }: ControlProps & { id: PfxMaterialControlId; value: string; onChange: (value: string) => void }) {
  const definition: PfxMaterialControlDefinition = PFX_MATERIAL_CONTROLS[id]
  return (
    <label className="pfx-material-field">
      <span>{definition.label}</span>
      <select
        aria-label={accessibleName(id, phase)}
        data-control={id}
        disabled={disabledFor(availability(id))}
        aria-describedby={describedByFor(disabledFor(availability(id)), reasonId)}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {(definition.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function BooleanControl({ id, value, onChange, phase, availability, reasonId }: ControlProps & { id: PfxMaterialControlId; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="pfx-material-check">
      <input
        type="checkbox"
        aria-label={accessibleName(id, phase)}
        data-control={id}
        disabled={disabledFor(availability(id))}
        aria-describedby={describedByFor(disabledFor(availability(id)), reasonId)}
        checked={value}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>{PFX_MATERIAL_CONTROLS[id].label}</span>
    </label>
  )
}

function ColorControl({ id, value, onChange, phase, availability, reasonId }: ControlProps & { id: PfxMaterialControlId; value: string; onChange: (value: string) => void }) {
  return (
    <label className="pfx-material-field">
      <span>{PFX_MATERIAL_CONTROLS[id].label}</span>
      <input
        type="color"
        aria-label={accessibleName(id, phase)}
        data-control={id}
        disabled={disabledFor(availability(id))}
        aria-describedby={describedByFor(disabledFor(availability(id)), reasonId)}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  )
}
