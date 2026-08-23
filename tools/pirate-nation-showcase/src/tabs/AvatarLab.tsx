/**
 * Avatar Lab — a Pirate Nation character creator.
 *
 * The upstream Unity client downloaded a pre-baked per-pirate glTF. This tab
 * composes pirates on the client instead: it picks part meshes out of the
 * shared 326-part art file on one rig, tints skin/hair, and plays any of the
 * 32 shipped clips. Ported from the game-bot showcase harness.
 */
import { OrbitControls, useProgress } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useMemo, useState } from 'react'
import {
  AVATAR_ANIMATIONS,
  AVATAR_PARTS,
  AVATAR_SLOTS,
  type AvatarAnimationName,
  type AvatarSlot,
} from '../avatar/avatarCatalog.generated'
import {
  HAIR_COLORS,
  randomAvatarSelection,
  REQUIRED_SLOTS,
  SKIN_COLORS,
  type AvatarSelection,
} from '../avatar/composeAvatar'
import {
  PirateAvatar,
  PIRATE_AVATAR_ASSET_PATH,
  PIRATE_AVATAR_ROOT_NAME,
} from '../avatar/PirateAvatar'
import { packAssetUrl } from '../catalog'
import { FitCamera } from '../components/FitCamera'
import { ViewerErrorBoundary } from '../components/ViewerErrorBoundary'

const AVATAR_MODEL_URL = packAssetUrl(PIRATE_AVATAR_ASSET_PATH)

/**
 * A source pirate stands about 0.59 units tall. Scale it to roughly human
 * height so the lab lights and shadows it the way a game scene would.
 * `FitCamera` handles framing, since part sizes vary widely.
 */
const AVATAR_DISPLAY_SCALE = 2.9
const CAMERA_FOV = 32

const REQUIRED = new Set<string>(REQUIRED_SLOTS)

function SlotRow({
  slot,
  selection,
  onChange,
}: {
  slot: AvatarSlot
  selection: AvatarSelection
  onChange: (slot: AvatarSlot, value: number | null) => void
}) {
  const parts = AVATAR_PARTS[slot]
  const current = selection[slot]
  const optional = !REQUIRED.has(slot)

  return (
    <label className="slot-row">
      <span className="slot-row-label">{slot}</span>
      <select
        value={current ?? ''}
        onChange={(event) =>
          onChange(slot, event.target.value === '' ? null : Number(event.target.value))
        }
      >
        {optional && <option value="">— none —</option>}
        {parts.map((part) => (
          <option key={part.nodeName} value={part.index}>
            {part.nodeName}
            {part.tints.length > 0 ? ` · ${part.tints.join('+')}` : ''}
          </option>
        ))}
      </select>
      <span className="slot-row-count">{parts.length}</span>
    </label>
  )
}

function Swatches({
  label,
  colors,
  value,
  onPick,
}: {
  label: string
  colors: readonly string[]
  value: string
  onPick: (color: string) => void
}) {
  return (
    <div className="swatches">
      <span className="control-label">{label}</span>
      <div className="swatch-row">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            onClick={() => onPick(color)}
            className={color === value ? 'swatch selected' : 'swatch'}
            style={{ background: color }}
          />
        ))}
      </div>
    </div>
  )
}

export function AvatarLab() {
  const [selection, setSelection] = useState<AvatarSelection>(() => randomAvatarSelection())
  const [animation, setAnimation] = useState<AvatarAnimationName>('01_Idle_1')
  const [copied, setCopied] = useState(false)
  // The 12.4 MB avatar GLB takes a moment — show progress instead of a
  // black stage.
  const loading = useProgress((state) => state.active)
  // Translucent species (the ghost) and dark outfits vanish on the dark
  // stage; the light backdrop keeps them inspectable.
  const [backdrop, setBackdrop] = useState<'dark' | 'light'>('dark')
  const stageColors =
    backdrop === 'dark' ? { bg: '#0b1220', floor: '#1b2432' } : { bg: '#dfe5ee', floor: '#c7cedb' }

  const setSlot = useCallback((slot: AvatarSlot, value: number | null) => {
    setSelection((previous) => ({ ...previous, [slot]: value }))
  }, [])

  /** Remounts the avatar and retriggers the camera fit on any change. */
  const selectionKey = useMemo(() => JSON.stringify(selection), [selection])

  const partCount = useMemo(
    () => AVATAR_SLOTS.reduce((sum, slot) => sum + AVATAR_PARTS[slot].length, 0),
    [],
  )

  const copySelection = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(selection, null, 2)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [selection])

  return (
    <div className="avatar-lab">
      <aside className="avatar-panel">
        <div className="avatar-actions">
          <button
            type="button"
            className="primary-action"
            onClick={() => setSelection(randomAvatarSelection())}
          >
            Roll a pirate
          </button>
          <button type="button" className="chip" onClick={copySelection}>
            {copied ? 'Copied!' : 'Copy selection JSON'}
          </button>
        </div>

        <label className="control-group">
          <span className="control-label">Animation ({AVATAR_ANIMATIONS.length} clips)</span>
          <select
            value={animation}
            onChange={(event) => setAnimation(event.target.value as AvatarAnimationName)}
          >
            {AVATAR_ANIMATIONS.map((clip) => (
              <option key={clip} value={clip}>
                {clip}
              </option>
            ))}
          </select>
        </label>

        <Swatches
          label="Skin color"
          colors={SKIN_COLORS}
          value={selection.skinColor ?? ''}
          onPick={(color) => setSelection((previous) => ({ ...previous, skinColor: color }))}
        />
        <Swatches
          label="Hair color"
          colors={HAIR_COLORS}
          value={selection.hairColor ?? ''}
          onPick={(color) => setSelection((previous) => ({ ...previous, hairColor: color }))}
        />

        <div className="control-group">
          <span className="control-label">
            Parts ({partCount} across {AVATAR_SLOTS.length} slots)
          </span>
          {AVATAR_SLOTS.map((slot) => (
            <SlotRow key={slot} slot={slot} selection={selection} onChange={setSlot} />
          ))}
        </div>
      </aside>

      <div className="avatar-stage">
        {loading && <div className="viewer-loading">Loading avatar…</div>}
        <button
          type="button"
          className="toggle stage-backdrop-toggle"
          onClick={() => setBackdrop((value) => (value === 'dark' ? 'light' : 'dark'))}
        >
          {backdrop === 'dark' ? 'Light stage' : 'Dark stage'}
        </button>
        <ViewerErrorBoundary>
          {/* Logarithmic depth: the art file nests part shells with ~0.0001-unit
              offsets (face plate front x=0.0900 vs head front x=0.0899), which
              a linear depth buffer cannot separate at orbit distances — the
              classic avatar z-fighting. Unity masked this with reversed-Z. */}
          <Canvas shadows gl={{ logarithmicDepthBuffer: true }} camera={{ fov: CAMERA_FOV, position: [0, 1.2, 4.5] }}>
            <color attach="background" args={[stageColors.bg]} />
            <ambientLight intensity={1.2} />
            <hemisphereLight intensity={0.65} groundColor="#26303f" color="#ffffff" />
            {/* normalBias kills shadow acne (diagonal moiré) on the flat voxel
                faces; 2048 keeps the map dense at avatar scale. */}
            <directionalLight
              castShadow
              intensity={2.2}
              position={[5, 8, 6]}
              shadow-mapSize={[2048, 2048]}
              shadow-normalBias={0.03}
            />
            <Suspense fallback={null}>
              <PirateAvatar
                key={selectionKey}
                selection={selection}
                animation={animation}
                modelUrl={AVATAR_MODEL_URL}
                scale={AVATAR_DISPLAY_SCALE}
              />
            </Suspense>
            {/* Floor sits a hair below y=0 so shoe soles (base-normalized to
                exactly 0) never z-fight the stage. */}
            <mesh position={[0, -0.01, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[40, 40]} />
              <meshStandardMaterial color={stageColors.floor} />
            </mesh>
            <FitCamera rootName={PIRATE_AVATAR_ROOT_NAME} fitKey={selectionKey} />
            <OrbitControls makeDefault enablePan={false} maxDistance={12} minDistance={1.5} />
          </Canvas>
        </ViewerErrorBoundary>
      </div>
    </div>
  )
}
