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
  faceHasBuiltInEyebrows,
  FULL_BODY_SPECIES,
  HAIR_COLORS,
  HEADWEAR_HAIR_MAP,
  headwearHidesHair,
  headwearHidesEyebrows,
  headwearHidesFacialHair,
  isFullBodySpecies,
  isSlotSupportedForSpecies,
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
import { avatarAssetReference } from '../catalog'
import { useAssetUrl } from '../useAssetUrl'
import { FitCamera } from '../pack3d/FitCamera'
import { ViewerErrorBoundary } from '../pack3d/ViewerErrorBoundary'

/**
 * A source pirate stands about 0.59 units tall. Scale it to roughly human
 * height so the lab lights and shadows it the way a game scene would.
 * `FitCamera` handles framing, since part sizes vary widely.
 */
const AVATAR_DISPLAY_SCALE = 2.9
const CAMERA_FOV = 32

const REQUIRED = new Set<string>(REQUIRED_SLOTS)

const SPECIES_NAMES: Record<number, string> = {
  1: 'Human',
  2: 'Piratetron',
  3: 'Vampire',
  4: 'Zombie',
  5: 'Ghost',
  6: 'Gold',
  7: 'Shark · Full Body',
  8: 'Druid · Full Body',
  9: 'Crusty · Full Body',
  10: 'Berserker · Full Body',
  11: 'Mage · Full Body',
  12: 'Catrina',
  13: 'Deep Diver',
  14: 'Ghost Captain A · Full Body',
  15: 'Ghost Captain B · Full Body',
  16: 'Ghost Outfit A · Full Body',
  17: 'Ghost Outfit B · Full Body',
  18: 'Skeleton · Full Body',
  19: 'Scarecrow · Full Body',
}

function getPartLabel(
  slot: AvatarSlot,
  part: { nodeName: string; index: number; tints: readonly string[] },
): string {
  if (slot === 'species' && SPECIES_NAMES[part.index]) {
    const name = SPECIES_NAMES[part.index]
    const full = isFullBodySpecies(part.index) ? ' (full-body)' : ''
    return `${part.index}: ${name}${full}`
  }
  if (slot === 'face' && [2, 5, 15, 16].includes(part.index)) {
    return `face ${part.index} (eyebrows only)`
  }
  if (slot === 'eyebrow' && [2, 5].includes(part.index)) {
    return `eyebrow ${part.index} (face decal — contains mouth)`
  }
  if (slot === 'eyebrow' && part.index === 15) {
    return `eyebrow 15 (eyes only)`
  }
  const tint = part.tints.length > 0 ? ` [${part.tints.join(', ')}]` : ''
  return `${slot} ${part.index}${tint}`
}

function SlotRow({
  slot,
  selection,
  onChange,
}: {
  slot: AvatarSlot
  selection: AvatarSelection
  onChange: (slot: AvatarSlot, index: number | null) => void
}) {
  const parts = AVATAR_PARTS[slot]
  const current = selection[slot]
  const isSupported = isSlotSupportedForSpecies(slot, selection.species)
  const isFullSkin = isFullBodySpecies(selection.species)
  const isHiddenByHat =
    (slot === 'hair' && headwearHidesHair(selection.headwear)) ||
    (slot === 'eyebrow' && headwearHidesEyebrows(selection.headwear)) ||
    (slot === 'facialhair' && headwearHidesFacialHair(selection.headwear))
  const hatHairRule = selection.headwear ? HEADWEAR_HAIR_MAP[selection.headwear] : undefined
  const isTailoredByHat = slot === 'hair' && typeof hatHairRule === 'number' && hatHairRule > 0
  const isBuiltInToFace = slot === 'eyebrow' && faceHasBuiltInEyebrows(selection.face)
  const optional = slot !== 'species' && (!REQUIRED.has(slot) || isFullSkin)

  if (!isSupported) {
    return (
      <label className="slot-row slot-row-disabled" style={{ opacity: 0.45 }}>
        <span className="slot-row-label">{slot}</span>
        <select disabled value="">
          <option value="">— built-in to skin —</option>
        </select>
        <span className="slot-row-count">—</span>
      </label>
    )
  }

  if (isHiddenByHat) {
    return (
      <label className="slot-row slot-row-disabled" style={{ opacity: 0.45 }}>
        <span className="slot-row-label">{slot}</span>
        <select disabled value="">
          <option value="">— hidden by hat —</option>
        </select>
        <span className="slot-row-count">—</span>
      </label>
    )
  }

  if (isTailoredByHat) {
    return (
      <label className="slot-row slot-row-disabled" style={{ opacity: 0.45 }}>
        <span className="slot-row-label">{slot}</span>
        <select disabled value="">
          <option value="">— tailored to hat —</option>
        </select>
        <span className="slot-row-count">—</span>
      </label>
    )
  }

  if (isBuiltInToFace) {
    return (
      <label className="slot-row slot-row-disabled" style={{ opacity: 0.45 }}>
        <span className="slot-row-label">{slot}</span>
        <select disabled value="">
          <option value="">— built-in to face —</option>
        </select>
        <span className="slot-row-count">—</span>
      </label>
    )
  }

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
            {getPartLabel(slot, part)}
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
  const avatarModelUrl = useAssetUrl(avatarAssetReference(PIRATE_AVATAR_ASSET_PATH))

  // zwei/drei loading manager tracks in-flight glTF requests.
  const loading = useProgress((state) => state.active)
  const [backdrop, setBackdrop] = useState<'dark' | 'light'>('dark')
  const stageColors = {
    dark: { floor: '#141a24' },
    light: { floor: '#d8dee9' },
  }[backdrop]

  /** Remounts the camera fit on any change. */
  const selectionKey = useMemo(() => JSON.stringify(selection), [selection])

  const partCount = useMemo(
    () => Object.values(AVATAR_PARTS).reduce((sum, list) => sum + list.length, 0),
    [],
  )

  const handleSlotChange = useCallback((slot: AvatarSlot, value: number | null) => {
    setSelection((previous) => {
      const next = { ...previous, [slot]: value }
      if (slot === 'species') {
        if (isFullBodySpecies(value)) {
          // Clear clothing and hair when switching to a full body skin to avoid z-fighting
          next.tops = null
          next.bottoms = null
          next.shoes = null
          next.hair = null
          next.headwear = null
          next.facialhair = null
          next.eyebrow = null
          next.face = null
        } else if (isFullBodySpecies(previous.species)) {
          // Restore default required clothing when switching back to base bodies
          next.face = next.face ?? 1
          next.tops = next.tops ?? 1
          next.bottoms = next.bottoms ?? 1
          next.shoes = next.shoes ?? 1
        }
      }
      return next
    })
  }, [])

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
          <div className="slot-grid">
            {AVATAR_SLOTS.map((slot) => (
              <SlotRow
                key={slot}
                slot={slot}
                selection={selection}
                onChange={handleSlotChange}
              />
            ))}
          </div>
        </div>
      </aside>

      <div className="avatar-stage">
        {loading && <div className="viewer-loading">Loading avatar…</div>}
        <button
          type="button"
          className="stage-backdrop-toggle"
          onClick={() => setBackdrop((value) => (value === 'dark' ? 'light' : 'dark'))}
        >
          {backdrop === 'dark' ? 'Light stage' : 'Dark stage'}
        </button>
        <ViewerErrorBoundary key={PIRATE_AVATAR_ASSET_PATH}>
          <Canvas
            camera={{ position: [0, 0.85, 3.2], fov: CAMERA_FOV, near: 0.3, far: 6.0 }}
            gl={{ preserveDrawingBuffer: true, antialias: true, logarithmicDepthBuffer: true }}
            shadows
          >
            <ambientLight intensity={1.1} />
            <hemisphereLight intensity={0.6} groundColor="#26303f" color="#ffffff" />
            <directionalLight
              castShadow
              intensity={2.0}
              position={[5, 8, 6]}
              shadow-mapSize={[2048, 2048]}
              shadow-normalBias={0.03}
            />
            <Suspense fallback={null}>
              {avatarModelUrl && (
                <PirateAvatar
                  selection={selection}
                  animation={animation}
                  modelUrl={avatarModelUrl}
                  scale={AVATAR_DISPLAY_SCALE}
                />
              )}
            </Suspense>
            {/* Floor sits a hair below y=0 so shoe soles (base-normalized to
                exactly 0) never z-fight the stage. */}
            <mesh position={[0, -0.01, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[40, 40]} />
              <meshStandardMaterial color={stageColors.floor} />
            </mesh>
            <FitCamera
              rootName={PIRATE_AVATAR_ROOT_NAME}
              fitKey="avatar-lab-stage"
              targetMode="center"
              margin={1.25}
            />
            <OrbitControls
              makeDefault
              target={[0, 0.85, 0]}
              enablePan={false}
              maxDistance={12}
              minDistance={1.5}
            />
          </Canvas>
        </ViewerErrorBoundary>
      </div>
    </div>
  )
}
