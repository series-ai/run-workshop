/**
 * Avatar Lab: one avatar dressed from every pack. Modular mode picks parts
 * per slot from any pack; skin mode picks a full-body skin from any pack.
 * Any pack's clip plays on either, and a held item rides the right hand.
 */
import { OrbitControls } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { AVATAR_SLOTS, type AvatarPartRef, type AvatarSlot, type PackCatalog } from '@rvx/contracts/catalog'
import { PackFilter, type PackChoice } from '../PackFilter'
import { CameraCommands, FitCamera, PackCanvas, useCommandBus, ViewerErrorBoundary, ViewerFrame } from '../pack3d'
import { defaultSelection, HAIR_COLORS, PartIndex, refKey, rollModular, SKIN_COLORS, type AvatarSelection, type ModularBase } from '../avatar/compose'
import { AVATAR_ROOT_NAME, VoxelAvatar } from '../avatar/VoxelAvatar'


const COLOR_NAMES: Record<string, string> = {
  '#f2d5b4': 'light', '#e0ac69': 'tan', '#c68642': 'bronze', '#8d5524': 'brown', '#5c3a21': 'dark brown',
  '#add8e6': 'pale blue', '#7fffd4': 'aquamarine', '#008080': 'teal', '#9acd32': 'yellow green', '#f2f2f2': 'white',
  '#2c1b10': 'black brown', '#4b2e1f': 'dark brown', '#8b4513': 'chestnut', '#c76a1e': 'ginger', '#d9b382': 'blond',
  '#e8e8e8': 'silver', '#3b3b3b': 'charcoal', '#7b2d8b': 'purple', '#1f6f8b': 'teal blue', '#a01f1f': 'red',
}

type OptionalSlot = Exclude<AvatarSlot, 'species'>

function encodeRef(ref: AvatarPartRef): string {
  return refKey(ref)
}

function decodeRef(value: string): AvatarPartRef {
  const [pack, slot, index] = value.split(':')
  return { pack, slot, index: Number(index) } as AvatarPartRef
}

export function AvatarLab({ catalogs }: { catalogs: PackCatalog[] }) {
  const [selection, setSelection] = useState<AvatarSelection>(defaultSelection)
  const [pack, setPack] = useState<PackChoice>('all')
  const [heldPfx, setHeldPfx] = useState(true)
  const bus = useCommandBus()
  const [resets, setResets] = useState(0)
  const index = useMemo(() => new PartIndex(catalogs), [catalogs])
  const labels = useMemo(() => new Map(catalogs.map((c) => [c.pack, c.label])), [catalogs])
  const models = useMemo(() => catalogs.flatMap((c) => c.models), [catalogs])
  const skins = models.filter((m) => m.category === 'characters-skins' && m.clips.length !== 1 && (m.pack !== 'pirate' || m.id.startsWith('characters-skins-skin-')))
  const held = models.filter((m) => m.category === 'held-items')
  const inPack = (p: string) => pack === 'all' || p === pack

  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as { __rvxLab?: unknown }).__rvxLab = { setSelection, getSelection: () => selection }
  }, [selection])

  const modular: ModularBase = selection.base.kind === 'modular' ? selection.base : defaultSelection().base as ModularBase
  const setModular = (next: ModularBase) => setSelection((s) => ({ ...s, base: next }))
  const setSlot = (slot: OptionalSlot, value: string) => {
    const parts = { ...modular.parts }
    if (value) parts[slot] = decodeRef(value)
    else delete parts[slot]
    setModular({ ...modular, parts })
  }

  /**
   * A random avatar, themed by the pack filter: one pack, or a random RUN pack
   * for "All". Skin mode rolls a skin; modular mode rolls parts. The clip stays.
   */
  const roll = () => {
    const rvx = catalogs.filter((c) => c.pack !== 'pirate').map((c) => c.pack)
    const theme = pack === 'all' ? (rvx.length > 0 ? rvx[Math.floor(Math.random() * rvx.length)]! : 'pirate') : pack
    const any = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]
    const themedSkins = skins.filter((m) => m.pack === theme)
    const themedHeld = held.filter((m) => m.pack === theme)
    setSelection((s) => ({
      ...s,
      base: s.base.kind === 'skin' ? { kind: 'skin', skin: any(themedSkins.length > 0 ? themedSkins : skins)!.id } : rollModular(index, theme, Math.random),
      held: Math.random() < 0.5 ? (any(themedHeld.length > 0 ? themedHeld : held)?.id ?? null) : null,
      skinColor: any(SKIN_COLORS)!,
      hairColor: any(HAIR_COLORS)!,
    }))
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(selection, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'voxel-avatar.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  }

  const optionsFor = (slot: AvatarSlot) =>
    catalogs.map((c) => {
      const parts = index.list(slot).filter((p) => p.ref.pack === c.pack && inPack(c.pack))
      return parts.length === 0 ? null : (
        <optgroup key={c.pack} label={c.label}>
          {parts.map((p) => (
            <option key={encodeRef(p.ref)} value={encodeRef(p.ref)}>
              {p.name}
            </option>
          ))}
        </optgroup>
      )
    })

  return (
    <div className="avatar-lab">
      <section className="avatar-panel">
        <PackFilter catalogs={catalogs} value={pack} onChange={setPack} />
        <div className="chip-row" role="group" aria-label="Avatar mode">
          <button type="button" className={selection.base.kind === 'modular' ? 'chip active' : 'chip'} aria-pressed={selection.base.kind === 'modular'} onClick={() => setModular(modular)}>
            Modular parts
          </button>
          <button
            type="button"
            className={selection.base.kind === 'skin' ? 'chip active' : 'chip'}
            aria-pressed={selection.base.kind === 'skin'}
            disabled={skins.length === 0}
            onClick={() => setSelection((s) => ({ ...s, base: { kind: 'skin', skin: skins.find((m) => m.pack !== 'pirate')?.id ?? skins[0]!.id } }))}
          >
            Full-body skin
          </button>
        </div>
        <button type="button" className="primary-action" onClick={roll}>
          Roll an avatar
        </button>

        {selection.base.kind === 'skin' ? (
          <label className="slot-row">
            <span className="slot-row-label">Skin</span>
            <select aria-label="Skin" value={selection.base.skin} onChange={(e) => setSelection((s) => ({ ...s, base: { kind: 'skin', skin: e.target.value } }))}>
              {skins.filter((m) => inPack(m.pack)).map((m) => (
                <option key={m.id} value={m.id}>
                  {labels.get(m.pack)} · {m.name}
                </option>
              ))}
            </select>
            <span className="slot-row-count" />
          </label>
        ) : (
          <div className="control-group">
            <label className="slot-row">
              <span className="slot-row-label">species</span>
              <select aria-label="species" value={encodeRef(modular.species)} onChange={(e) => setModular({ ...modular, species: decodeRef(e.target.value) })}>
                {optionsFor('species')}
              </select>
              <span className="slot-row-count">{index.list('species').length}</span>
            </label>
            {AVATAR_SLOTS.filter((s): s is OptionalSlot => s !== 'species').map((slot) => (
              <label key={slot} className="slot-row">
                <span className="slot-row-label">{slot}</span>
                <select aria-label={slot} value={modular.parts[slot] ? encodeRef(modular.parts[slot]!) : ''} onChange={(e) => setSlot(slot, e.target.value)}>
                  <option value="">None</option>
                  {optionsFor(slot)}
                </select>
                <span className="slot-row-count">{index.list(slot).length}</span>
              </label>
            ))}
          </div>
        )}

        <label className="slot-row">
          <span className="slot-row-label">Held item</span>
          <select aria-label="Held item" value={selection.held ?? ''} onChange={(e) => setSelection((s) => ({ ...s, held: e.target.value || null }))}>
            <option value="">None</option>
            {held.filter((m) => inPack(m.pack)).map((m) => (
              <option key={m.id} value={m.id}>
                {labels.get(m.pack)} · {m.name}
              </option>
            ))}
          </select>
          <span className="slot-row-count">{held.length}</span>
        </label>
        {selection.held && (
          <button type="button" className={heldPfx ? 'toggle active' : 'toggle'} aria-pressed={heldPfx} onClick={() => setHeldPfx((v) => !v)}>
            Held item PFX
          </button>
        )}
        <label className="slot-row">
          <span className="slot-row-label">Clip</span>
          <select aria-label="Clip" value={selection.clip} onChange={(e) => setSelection((s) => ({ ...s, clip: e.target.value }))}>
            {catalogs.map((c) =>
              c.avatar.clips.length === 0 ? null : (
                <optgroup key={c.pack} label={c.label}>
                  {c.avatar.clips.map((clip) => (
                    <option key={clip} value={clip}>
                      {clip}
                    </option>
                  ))}
                </optgroup>
              ),
            )}
          </select>
          <span className="slot-row-count" />
        </label>

        <div className="swatches">
          <span className="control-label">Skin tint (Pirate Nation parts)</span>
          <div className="swatch-row">
            {SKIN_COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Skin tint ${COLOR_NAMES[c] ?? c}`} aria-pressed={c === selection.skinColor} className={c === selection.skinColor ? 'swatch selected' : 'swatch'} style={{ background: c }} onClick={() => setSelection((s) => ({ ...s, skinColor: c }))} />
            ))}
          </div>
          <span className="control-label">Hair tint (Pirate Nation parts)</span>
          <div className="swatch-row">
            {HAIR_COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Hair tint ${COLOR_NAMES[c] ?? c}`} aria-pressed={c === selection.hairColor} className={c === selection.hairColor ? 'swatch selected' : 'swatch'} style={{ background: c }} onClick={() => setSelection((s) => ({ ...s, hairColor: c }))} />
            ))}
          </div>
        </div>
        <div className="avatar-actions">
          <button type="button" className="primary-action" onClick={exportJson}>
            Export JSON
          </button>
        </div>
      </section>
      <section className="avatar-stage">
        <ViewerFrame bus={bus} label="3D view of the avatar" onReset={() => setResets((n) => n + 1)}>
        <ViewerErrorBoundary resetKey={JSON.stringify(selection)}>
          <PackCanvas>
            <Suspense fallback={null}>
              <VoxelAvatar selection={selection} catalogs={catalogs} heldPfx={heldPfx} />
            </Suspense>
            <OrbitControls makeDefault />
            <CameraCommands bus={bus} />
            <FitCamera rootName={AVATAR_ROOT_NAME} fitKey={`${JSON.stringify(selection.base)}:${resets}`} targetMode="center" margin={1.35} />
          </PackCanvas>
        </ViewerErrorBoundary>
        </ViewerFrame>
      </section>
    </div>
  )
}
