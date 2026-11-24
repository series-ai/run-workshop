// Explicit material quality, atlas registry, and caller-owned depth source for
// one R3F canvas. Mount the provider inside <Canvas>: its frame counter uses
// useFrame. Without a provider, consumers get low quality, the built-in
// atlases, and no depth source (the existing hard depth test).

import { useFrame } from '@react-three/fiber'
import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { PFX_DEFAULT_ATLAS_REGISTRY, isPfxAtlasRegistry, type PfxAtlasRegistry } from './atlas'
import {
  PFX_DEFAULT_MATERIAL_QUALITY,
  PFX_MATERIAL_DEPTH_FALLBACK_REASONS,
  PFX_MATERIAL_QUALITIES,
  type PfxMaterialDepthEncoding,
  type PfxMaterialDepthFallbackReason,
  type PfxMaterialDepthSource,
  type PfxMaterialDepthSourceRef,
  type PfxMaterialDepthValidity,
  type PfxMaterialQuality,
} from './types'

/**
 * Frame order in one canvas. A non-positive priority never takes over the
 * R3F v8 render loop. The host finishes camera and opaque updates before
 * the capture priority. Material consumers run at priority 0.
 */
export const PFX_MATERIAL_FRAME_PRIORITY = -2
export const PFX_MATERIAL_DEPTH_CAPTURE_PRIORITY = -1

/** Read-only, stable for the provider lifetime. Increments once per frame. */
export interface PfxMaterialFrameHandle {
  readonly token: number
}

export interface PfxMaterialContextValue {
  quality: PfxMaterialQuality
  atlasRegistry: PfxAtlasRegistry
  depthSource: PfxMaterialDepthSourceRef | null
  /** Null when no provider is mounted. */
  frame: PfxMaterialFrameHandle | null
  /** Records a hard-depth fallback. Reports each reason once per provider. */
  reportDepthFallback: (reason: PfxMaterialDepthFallbackReason) => void
}

const DEFAULT_CONTEXT: PfxMaterialContextValue = Object.freeze({
  quality: PFX_DEFAULT_MATERIAL_QUALITY,
  atlasRegistry: PFX_DEFAULT_ATLAS_REGISTRY,
  depthSource: null,
  frame: null,
  reportDepthFallback: () => {},
})

const PfxMaterialContext = createContext<PfxMaterialContextValue>(DEFAULT_CONTEXT)

export interface PfxMaterialProviderProps {
  /** Default `low`. Only `high` enables distortion and scene depth. */
  quality?: PfxMaterialQuality
  /** Default: the two built-in sheets. Must come from createPfxAtlasRegistry. */
  atlasRegistry?: PfxAtlasRegistry
  /**
   * Stable caller-owned ref. Its descriptor is mutated in place by the host.
   * Used only at `high` quality. The library never disposes its texture.
   */
  depthSource?: PfxMaterialDepthSourceRef | null
  /**
   * Called once per provider for each reason that selects the hard-depth
   * fallback. Default: one console.warn per reason. It never shows UI.
   */
  onDepthFallback?: (reason: PfxMaterialDepthFallbackReason) => void
  children?: ReactNode
}

export function PfxMaterialProvider({
  quality = PFX_DEFAULT_MATERIAL_QUALITY,
  atlasRegistry = PFX_DEFAULT_ATLAS_REGISTRY,
  depthSource = null,
  onDepthFallback,
  children,
}: PfxMaterialProviderProps) {
  if (!(PFX_MATERIAL_QUALITIES as readonly unknown[]).includes(quality)) {
    throw new Error(`PfxMaterialProvider: quality must be 'low' or 'high', got ${String(quality)}`)
  }
  if (!isPfxAtlasRegistry(atlasRegistry)) {
    throw new Error('PfxMaterialProvider: atlasRegistry must come from createPfxAtlasRegistry')
  }
  const counter = useRef(0)
  const frame = useMemo<PfxMaterialFrameHandle>(
    () => Object.freeze({
      get token() {
        return counter.current
      },
    }),
    [],
  )
  useFrame(() => {
    counter.current += 1
  }, PFX_MATERIAL_FRAME_PRIORITY)
  const reported = useRef(new Set<PfxMaterialDepthFallbackReason>())
  const onDepthFallbackRef = useRef(onDepthFallback)
  onDepthFallbackRef.current = onDepthFallback
  const reportDepthFallback = useMemo(
    () => (reason: PfxMaterialDepthFallbackReason) => {
      if (reported.current.has(reason)) return
      reported.current.add(reason)
      const report = onDepthFallbackRef.current
      if (report) report(reason)
      else console.warn(`PfxMaterialProvider: depth fade uses the hard-depth fallback (${reason})`)
    },
    [],
  )
  const value = useMemo<PfxMaterialContextValue>(
    () => ({ quality, atlasRegistry, depthSource, frame, reportDepthFallback }),
    [atlasRegistry, depthSource, frame, quality, reportDepthFallback],
  )
  return <PfxMaterialContext.Provider value={value}>{children}</PfxMaterialContext.Provider>
}

export function usePfxMaterialContext(): PfxMaterialContextValue {
  return useContext(PfxMaterialContext)
}

/** For a host depth capture. Throws when no provider is mounted. */
export function usePfxMaterialFrame(): PfxMaterialFrameHandle {
  const { frame } = useContext(PfxMaterialContext)
  if (!frame) throw new Error('usePfxMaterialFrame: mount PfxMaterialProvider inside <Canvas> first')
  return frame
}

// ---------------------------------------------------------------------------
// Reusable depth descriptor. Allocate once; stamp in place after each
// successful capture. Validation and use belong to the material consumers.

export function createPfxMaterialDepthSource(
  texture: THREE.DepthTexture,
  encoding: PfxMaterialDepthEncoding = 'standard',
): PfxMaterialDepthSource {
  return {
    texture,
    encoding,
    camera: null,
    cameraMatrixWorldInverse: new THREE.Matrix4(),
    projectionMatrix: new THREE.Matrix4(),
    bufferSize: new THREE.Vector2(),
    viewport: new THREE.Vector4(),
    frameToken: -1,
    xr: false,
  }
}

export interface PfxMaterialDepthCapture {
  camera: THREE.Camera
  width: number
  height: number
  token: number
  xr: boolean
  /** Capture viewport in drawing-buffer pixels. Default: (0, 0, width, height). */
  viewport?: THREE.Vector4
}

/**
 * Marks the descriptor as not captured. Call it before a capture starts, so a
 * capture that throws leaves an invalid stamp and the hard-depth fallback.
 */
export function invalidatePfxMaterialDepthSource(source: PfxMaterialDepthSource): void {
  source.frameToken = -1
}

/**
 * Copies the capture camera snapshot into the preallocated descriptor.
 * Call it only after the capture succeeds. Allocates nothing.
 */
export function stampPfxMaterialDepthSource(source: PfxMaterialDepthSource, capture: PfxMaterialDepthCapture): void {
  capture.camera.updateMatrixWorld()
  source.camera = capture.camera
  source.cameraMatrixWorldInverse.copy(capture.camera.matrixWorldInverse)
  source.projectionMatrix.copy(capture.camera.projectionMatrix)
  source.bufferSize.set(capture.width, capture.height)
  if (capture.viewport) source.viewport.copy(capture.viewport)
  else source.viewport.set(0, 0, capture.width, capture.height)
  source.xr = capture.xr
  source.frameToken = capture.token
}

// ---------------------------------------------------------------------------
// Depth source validation. Pure; allocates nothing. Consumers call it at
// priority 0, after the host capture, with the state of the frame that is
// about to render.

/** Renderer facts for one frame. Fill a preallocated object with readPfxMaterialDepthFrame. */
export interface PfxMaterialDepthFrame {
  /** Current provider frame token. */
  token: number
  /** Camera that renders this frame. */
  camera: THREE.Camera | null
  /** Drawing-buffer size in pixels. */
  readonly bufferSize: THREE.Vector2
  logarithmicDepthBuffer: boolean
  reversedDepthBuffer: boolean
  xrPresenting: boolean
}

export function createPfxMaterialDepthFrame(): PfxMaterialDepthFrame {
  return {
    token: -1,
    camera: null,
    bufferSize: new THREE.Vector2(),
    logarithmicDepthBuffer: false,
    reversedDepthBuffer: false,
    xrPresenting: false,
  }
}

/** Writes the renderer facts into `target`. Updates the camera world matrices first. */
export function readPfxMaterialDepthFrame(
  target: PfxMaterialDepthFrame,
  renderer: THREE.WebGLRenderer,
  camera: THREE.Camera,
  token: number,
): PfxMaterialDepthFrame {
  camera.updateMatrixWorld()
  target.token = token
  target.camera = camera
  renderer.getDrawingBufferSize(target.bufferSize)
  target.logarithmicDepthBuffer = renderer.capabilities.logarithmicDepthBuffer === true
  target.reversedDepthBuffer = renderer.state.buffers.depth.getReversed() === true
  target.xrPresenting = renderer.xr.isPresenting === true
  return target
}

const PFX_DEPTH_VALID: PfxMaterialDepthValidity = Object.freeze({ valid: true, reason: null })
const PFX_DEPTH_INVALID = Object.freeze(Object.fromEntries(
  PFX_MATERIAL_DEPTH_FALLBACK_REASONS.map((reason) => [reason, Object.freeze({ valid: false, reason })]),
)) as Readonly<Record<PfxMaterialDepthFallbackReason, PfxMaterialDepthValidity>>

/**
 * True for a standard perspective or orthographic projection: clip z and w
 * depend only on view z. Off-axis x/y terms are allowed.
 */
export function isPfxStandardDepthProjection(projection: THREE.Matrix4): boolean {
  const e = projection.elements
  if (e[2] !== 0 || e[6] !== 0 || e[3] !== 0 || e[7] !== 0) return false
  return (e[11] === -1 && e[15] === 0) || (e[11] === 0 && e[15] === 1)
}

/**
 * A source is valid only for standard WebGL depth, outside XR, from this
 * provider frame, for the active camera, with equal camera matrices, and at
 * the current drawing-buffer size. Every other state names its fallback.
 */
export function validatePfxMaterialDepthSource(
  source: PfxMaterialDepthSource | null,
  frame: PfxMaterialDepthFrame,
): PfxMaterialDepthValidity {
  if (!source) return PFX_DEPTH_INVALID['no-source']
  if (frame.xrPresenting || source.xr) return PFX_DEPTH_INVALID.xr
  if (frame.logarithmicDepthBuffer || source.encoding === 'logarithmic') return PFX_DEPTH_INVALID['logarithmic-depth']
  if (frame.reversedDepthBuffer || source.encoding === 'reversed') return PFX_DEPTH_INVALID['reversed-depth']
  if (source.encoding !== 'standard') return PFX_DEPTH_INVALID['packed-depth']
  const texture = source.texture as THREE.Texture & { isDepthTexture?: boolean; compareFunction?: unknown }
  if (texture.isDepthTexture !== true || texture.compareFunction != null) return PFX_DEPTH_INVALID['unsupported-texture']
  if (source.frameToken < 0 || source.frameToken !== frame.token) return PFX_DEPTH_INVALID['stale-token']
  const camera = frame.camera
  if (!camera || source.camera !== camera) return PFX_DEPTH_INVALID['wrong-camera']
  if (!isPfxStandardDepthProjection(camera.projectionMatrix)) return PFX_DEPTH_INVALID['unsupported-projection']
  if (!source.bufferSize.equals(frame.bufferSize)) return PFX_DEPTH_INVALID['size-mismatch']
  const image = texture.image as { width?: number; height?: number } | null
  if (!image || image.width !== frame.bufferSize.x || image.height !== frame.bufferSize.y) return PFX_DEPTH_INVALID['size-mismatch']
  if (!camera.matrixWorldInverse.equals(source.cameraMatrixWorldInverse)) return PFX_DEPTH_INVALID['camera-matrix-mismatch']
  if (!camera.projectionMatrix.equals(source.projectionMatrix)) return PFX_DEPTH_INVALID['projection-matrix-mismatch']
  return PFX_DEPTH_VALID
}

/**
 * Draw-time check of a source that was valid at priority 0: same camera
 * object, unchanged matrices, and the capture viewport. It catches a camera
 * update that ran after the consumers in the same frame. Allocates nothing;
 * `viewport` is caller scratch.
 */
export function checkPfxMaterialDepthDraw(
  source: PfxMaterialDepthSource,
  renderer: THREE.WebGLRenderer,
  camera: THREE.Camera,
  viewport: THREE.Vector4,
): PfxMaterialDepthValidity {
  if (source.camera !== camera) return PFX_DEPTH_INVALID['wrong-camera']
  if (!camera.matrixWorldInverse.equals(source.cameraMatrixWorldInverse)) return PFX_DEPTH_INVALID['camera-matrix-mismatch']
  if (!camera.projectionMatrix.equals(source.projectionMatrix)) return PFX_DEPTH_INVALID['projection-matrix-mismatch']
  if (!renderer.getCurrentViewport(viewport).equals(source.viewport)) return PFX_DEPTH_INVALID['size-mismatch']
  return PFX_DEPTH_VALID
}
