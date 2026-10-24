// Material runtime status for an authoring preview. This module is viewer
// code, not library API. It measures the resources that the mounted preview
// actually uses:
//
// 1. Each new revision reports `loading` and compiles the mounted subtree
//    (invisible objects included), with compileAsync when the renderer has
//    parallel shader compilation.
// 2. Each frame after that, until the revision settles, it reads the real
//    program link status and the texture load state. A missing image is
//    pending. A host atlas that failed to decode is an error.
// 3. `ready` or `error` is reported once, with the revision it measured.
//
// Ready never comes from valid input or from a timer. A newer revision
// cancels the older measurement, and the hook drops a result whose revision
// is not current. On an error the hook shows the last ready value. The
// edits stay in their store. Retry measures the same values again.

import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { PFX_MATERIAL_PATH_USERDATA_KEY, PFX_TEXTURE_LOAD_USERDATA_KEY, type PfxTextureLoadState } from '@pfx'

export type PfxMaterialRuntimeStatus =
  | { state: 'loading'; revision: number }
  | { state: 'ready'; revision: number }
  | { state: 'error'; revision: number; message: string }

export function describePfxMaterialRuntime(status: PfxMaterialRuntimeStatus): string {
  return `${status.state}@${status.revision}`
}

// ---------------------------------------------------------------------------
// Resource check. Reads the renderer state; changes nothing.

export type PfxPreviewResourceCheck =
  | { state: 'pending'; pending: string[]; uncompiled: boolean }
  | { state: 'ready'; materials: number }
  | { state: 'error'; message: string }

interface CompiledProgram {
  program: WebGLProgram
  isReady(): boolean
}

function collectMaterials(root: THREE.Object3D): THREE.Material[] {
  const materials = new Set<THREE.Material>()
  root.traverse((object) => {
    const material = (object as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
    if (!material) return
    for (const entry of Array.isArray(material) ? material : [material]) materials.add(entry)
  })
  return [...materials]
}

function collectTextures(material: THREE.Material): THREE.Texture[] {
  const textures = new Set<THREE.Texture>()
  const add = (value: unknown) => {
    if (value instanceof THREE.Texture) textures.add(value)
    else if (Array.isArray(value)) for (const entry of value) if (entry instanceof THREE.Texture) textures.add(entry)
  }
  for (const value of Object.values(material)) add(value)
  const uniforms = (material as THREE.ShaderMaterial).uniforms
  if (uniforms) for (const uniform of Object.values(uniforms)) add(uniform?.value)
  return [...textures]
}

function materialLabel(material: THREE.Material): string {
  return (material.userData[PFX_MATERIAL_PATH_USERDATA_KEY] as string | undefined) ?? material.type
}

export function checkPfxPreviewResources(root: THREE.Object3D, renderer: THREE.WebGLRenderer): PfxPreviewResourceCheck {
  const gl = renderer.getContext()
  const materials = collectMaterials(root)
  const pending: string[] = []
  let uncompiled = false
  for (const material of materials) {
    const label = materialLabel(material)
    const program = (renderer.properties.get(material) as { currentProgram?: CompiledProgram }).currentProgram
    if (!program) {
      uncompiled = true
      pending.push(`${label}: program not compiled`)
      continue
    }
    if (!program.isReady()) {
      pending.push(`${label}: program compiling`)
      continue
    }
    if (gl.getProgramParameter(program.program, gl.LINK_STATUS) !== true) {
      const log = gl.getProgramInfoLog(program.program)?.trim()
      return { state: 'error', message: `The ${label} shader program did not link${log ? `: ${log}` : ''}` }
    }
    for (const texture of collectTextures(material)) {
      const load = texture.userData[PFX_TEXTURE_LOAD_USERDATA_KEY] as PfxTextureLoadState | undefined
      if (load?.state === 'error') return { state: 'error', message: load.message }
      if (load?.state === 'loading' || texture.image == null) pending.push(`${label}: texture ${texture.name || texture.uuid} is loading`)
    }
  }
  return pending.length > 0 ? { state: 'pending', pending, uncompiled } : { state: 'ready', materials: materials.length }
}

// ---------------------------------------------------------------------------
// Probe. Mount it inside <Canvas> around the preview it measures.

interface ProbeJob {
  revision: number
  compiled: boolean
  settled: boolean
}

export function PfxMaterialRuntimeProbe({
  revision,
  active,
  onReport,
  children,
}: {
  revision: number
  /** False while the preview shows a fallback; nothing is measured. */
  active: boolean
  onReport: (status: PfxMaterialRuntimeStatus) => void
  children: ReactNode
}) {
  const root = useRef<THREE.Group>(null)
  const { gl, camera, scene } = useThree()
  const job = useRef<ProbeJob | null>(null)
  const report = useRef(onReport)
  useLayoutEffect(() => {
    report.current = onReport
  })
  const settle = (current: ProbeJob, status: PfxMaterialRuntimeStatus) => {
    if (job.current !== current || current.settled) return
    current.settled = true
    report.current(status)
  }
  // Runs after the preview subtree commits, so its objects and materials exist.
  useEffect(() => {
    if (!active) return
    const node = root.current
    if (!node) throw new Error('PfxMaterialRuntimeProbe: the preview group is not mounted')
    const current: ProbeJob = { revision, compiled: false, settled: false }
    job.current = current
    report.current({ state: 'loading', revision })
    const fail = (error: unknown) => settle(current, { state: 'error', revision, message: `Shader compilation failed: ${String(error)}` })
    // compileAsync warns when the parallel-compile extension is absent. Then
    // compilation is synchronous anyway, and the frame check reads the result.
    if (gl.extensions.has('KHR_parallel_shader_compile')) {
      gl.compileAsync(node, camera, scene).then(() => {
        current.compiled = true
      }, fail)
    } else {
      try {
        gl.compile(node, camera, scene)
        current.compiled = true
      } catch (error) {
        fail(error)
      }
    }
    return () => {
      if (job.current === current) job.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, revision, gl, camera, scene])
  useFrame(() => {
    const current = job.current
    const node = root.current
    if (!current || !current.compiled || current.settled || !node) return
    const result = checkPfxPreviewResources(node, gl)
    if (result.state === 'ready') settle(current, { state: 'ready', revision: current.revision })
    else if (result.state === 'error') settle(current, { state: 'error', revision: current.revision, message: result.message })
    // A material created after the first compile gets its program here.
    else if (result.uncompiled) gl.compile(node, camera, scene)
  })
  return <group ref={root}>{children}</group>
}

// ---------------------------------------------------------------------------
// Preview state. One revision per change of scope, candidate identity,
// resource input, or retry.

export type PfxPreviewDisplay<T> =
  | { kind: 'candidate'; value: T }
  | { kind: 'fallback'; value: T }
  | { kind: 'none' }

export interface PfxMaterialPreview<T> {
  revision: number
  runtime: PfxMaterialRuntimeStatus
  display: PfxPreviewDisplay<T>
  /** Pass to PfxMaterialRuntimeProbe. */
  probeActive: boolean
  report: (status: PfxMaterialRuntimeStatus) => void
  retry: () => void
}

interface PreviewTrack<T> {
  scope: string
  candidate: T
  inputs: readonly unknown[]
  attempt: number
  revision: number
}

interface PreviewState<T> {
  track: PreviewTrack<T>
  runtime: PfxMaterialRuntimeStatus
  lastReady: { scope: string; value: T } | null
}

function sameInputs(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]))
}

/**
 * `scope` resets the fallback (for example the effect ID). `candidate` is
 * the newest valid value; keep its identity stable while it is unchanged.
 * `resourceInputs` are other inputs that select resources, such as quality.
 */
export function usePfxMaterialPreview<T>(
  scope: string,
  candidate: T,
  resourceInputs: readonly unknown[],
  enabled = true,
): PfxMaterialPreview<T> {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<PreviewState<T>>(() => ({
    track: { scope, candidate, inputs: resourceInputs, attempt, revision: 0 },
    runtime: { state: 'loading', revision: 0 },
    lastReady: null,
  }))
  let { track } = state
  if (track.scope !== scope || !Object.is(track.candidate, candidate) || track.attempt !== attempt || !sameInputs(track.inputs, resourceInputs)) {
    // Derived state: React renders again at once with the new revision.
    track = { scope, candidate, inputs: resourceInputs, attempt, revision: track.revision + 1 }
    const next = track
    setState((current) => ({ ...current, track: next }))
  }
  // The stale check runs against committed state, inside the updater. A
  // result for any other revision changes nothing.
  const report = useCallback((status: PfxMaterialRuntimeStatus) => {
    setState((current) => {
      if (status.revision !== current.track.revision) return current
      return {
        ...current,
        runtime: status,
        lastReady: status.state === 'ready' ? { scope: current.track.scope, value: current.track.candidate } : current.lastReady,
      }
    })
  }, [])
  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  const { runtime, lastReady } = state
  const failed = runtime.state === 'error' && runtime.revision === track.revision
  const fallback = lastReady && lastReady.scope === scope ? lastReady : null
  const display: PfxPreviewDisplay<T> = !failed
    ? { kind: 'candidate', value: candidate }
    : fallback
      ? { kind: 'fallback', value: fallback.value }
      : { kind: 'none' }
  return { revision: track.revision, runtime, display, probeActive: enabled && !failed, report, retry }
}
