import { useState, useId, useMemo, useEffect, useRef, type FC, type ChangeEvent } from 'react'
import type { AvatarConfig, PackManifest } from '../types'
import { CHARACTER_ROLES, ROLE_BY_ID, roleAvatar } from '../runtime/roles'
import { validateAvatar } from '../runtime/physics'
import { IconDownload, IconReset } from './UIIcons'

export interface AvatarEditorProps {
  avatar: AvatarConfig
  onUpdateAvatar: (updater: (prev: AvatarConfig) => AvatarConfig) => void
  onSelectModelId: (modelId: string) => void
  manifest: PackManifest | null
  onReset: () => void
}

export interface PresetDef {
  id: string
  label: string
  role: string
}

/**
 * Canonical 12 character presets matching generated catalog models
 */
export const DEFAULT_CHARACTER_PRESETS: PresetDef[] = CHARACTER_ROLES.map(role => ({ id: role.id, label: role.label, role: role.family }))

export const AVATAR_PRESETS = DEFAULT_CHARACTER_PRESETS

export const HEADWEAR_OPTIONS: { id: AvatarConfig['headwear']; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'cap', label: 'Cap' },
  { id: 'headband', label: 'Headband' },
  { id: 'beanie', label: 'Beanie' },
  { id: 'visor', label: 'Visor' },
  { id: 'helmet', label: 'Helmet' },
]

const SWATCH_COLORS = ['#151716', '#2b2e2a', '#3f443e', '#faf9f5', '#485055']
const SWATCH_ACCENTS = ['#d45538', '#d99b26', '#3a7d66', '#4361ee', '#b83a28']

/**
 * Validates avatar config JSON against consolidated runtime physics rules
 * and validates preset & equipment IDs against the manifest catalog.
 */
export function validateAvatarJson(
  jsonString: string,
  manifest?: PackManifest | null
): {
  valid: boolean
  errors: string[]
  data?: AvatarConfig
} {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonString)
  } catch {
    return { valid: false, errors: ['Invalid JSON syntax. Please verify the JSON string.'] }
  }

  let validated: AvatarConfig
  try {
    validated = validateAvatar(parsed)
  } catch (err) {
    return { valid: false, errors: [err instanceof Error ? err.message : String(err)] }
  }

  // Check imported preset/equipment against manifest catalog before apply
  const catalogErrors: string[] = []
  if (manifest && manifest.models.length > 0) {
    const characterIds = new Set(
      manifest.models.filter((m) => m.kind === 'character').map((m) => m.id)
    )
    if (!characterIds.has(validated.preset)) {
      catalogErrors.push(`Preset "${validated.preset}" was not found in the character catalog.`)
    }

    if (validated.equipment !== null) {
      const propIds = new Set(
        manifest.models.filter((m) => m.kind === 'prop' && m.tags.includes('held')).map((m) => m.id)
      )
      if (!propIds.has(validated.equipment)) {
        catalogErrors.push(`Equipment "${validated.equipment}" was not found in the props catalog.`)
      }
    }
  }

  if (catalogErrors.length > 0) {
    return { valid: false, errors: catalogErrors }
  }

  return { valid: true, errors: [], data: validated }
}

export const UIAvatarEditor: FC<AvatarEditorProps> = ({
  avatar,
  onUpdateAvatar,
  onSelectModelId,
  manifest,
  onReset,
}) => {
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [exportNotice, setExportNotice] = useState<string | null>(null)

  const heightId = useId()
  const thicknessId = useId()
  const headScaleId = useId()
  const equipmentSelectId = useId()
  const importTextareaId = useId()
  const importModalRef = useRef<HTMLDivElement>(null)

  // Derive character presets dynamically from manifest models of kind character
  const characterPresets: PresetDef[] = useMemo(() => {
    const chars = manifest?.models.filter((m) => m.kind === 'character')
    if (chars && chars.length > 0) {
      return [...chars].sort((a, b) => CHARACTER_ROLES.findIndex(role => role.id === a.id) - CHARACTER_ROLES.findIndex(role => role.id === b.id)).map((m) => ({
        id: m.id,
        label: m.label,
        role: ROLE_BY_ID.get(m.id)?.family ?? m.category,
      }))
    }
    return DEFAULT_CHARACTER_PRESETS
  }, [manifest])

  // Eligible held equipment from manifest
  const heldProps = useMemo(() => {
    return (
      manifest?.models.filter(
        (m) =>
          m.kind === 'prop' &&
          m.tags.includes('held')
      ) ?? []
    )
  }, [manifest])

  // Focus containment and Escape key handling for import modal dialog
  useEffect(() => {
    if (!importModalOpen) return
    const prevActive = document.activeElement as HTMLElement | null

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setImportModalOpen(false)
        return
      }
      if (e.key === 'Tab' && importModalRef.current) {
        const focusable = importModalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    const focusable = importModalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable && focusable.length > 0) {
      focusable[0].focus()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      prevActive?.focus()
    }
  }, [importModalOpen])

  const selectedRole = ROLE_BY_ID.get(avatar.preset)

  const handleSelectPreset = (presetId: string) => {
    onUpdateAvatar((prev) => ({ ...prev, preset: presetId }))
    onSelectModelId(presetId)
  }

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(avatar, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inkline-avatar-${avatar.preset}.json`
    a.click()
    URL.revokeObjectURL(url)

    if (navigator.clipboard) {
      void navigator.clipboard.writeText(jsonStr)
      setExportNotice('Config copied to clipboard & downloaded.')
      setTimeout(() => setExportNotice(null), 3000)
    }
  }

  const handleImportSubmit = () => {
    const res = validateAvatarJson(importText, manifest)
    if (!res.valid || !res.data) {
      setImportErrors(res.errors)
      return
    }

    onUpdateAvatar(() => res.data!)
    onSelectModelId(res.data.preset)
    setImportErrors([])
    setImportModalOpen(false)
    setImportText('')
    setExportNotice('Avatar configuration loaded successfully.')
    setTimeout(() => setExportNotice(null), 3000)
  }

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setImportText(content)
      const res = validateAvatarJson(content, manifest)
      if (!res.valid) {
        setImportErrors(res.errors)
      } else {
        setImportErrors([])
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="ink-avatar-panel" aria-label="Avatar Configuration Lab">
      {exportNotice && (
        <div className="ink-notice-banner" role="status">
          {exportNotice}
        </div>
      )}

      {/* 12 Character Presets */}
      <section className="ink-control-section">
        <div className="ink-section-header">
          <span className="ink-section-title">{characterPresets.length} CHARACTER PRESETS</span>
          <span className="ink-section-sub">Active: {avatar.preset}</span>
        </div>
        <div className="ink-presets-grid" role="group" aria-label="Character Presets">
          {characterPresets.map((preset) => {
            const isSelected = avatar.preset === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                className={`ink-preset-card ${isSelected ? 'active' : ''}`}
                onClick={() => handleSelectPreset(preset.id)}
                aria-pressed={isSelected}
                title={`${preset.label} — ${preset.role}`}
              >
                <span className="ink-preset-name">{preset.label}</span>
                <span className="ink-preset-role">{preset.role}</span>
              </button>
            )
          })}
        </div>
        {selectedRole && <div className="ink-role-summary">
          <p>{selectedRole.description}</p><p>Kit action: {selectedRole.preview.replaceAll('-', ' ')}.</p>
          <button type="button" className="ink-btn ink-btn-secondary" onClick={() => onUpdateAvatar(() => roleAvatar(selectedRole))}>Apply {selectedRole.label} kit</button>
          <small>Sets the body, colors, headwear, and held gear. All parts remain editable.</small>
        </div>}
      </section>

      {/* Ink & Accent Colors */}
      <section className="ink-control-section">
        <span className="ink-section-title">COLOR & CONTOUR PALETTE</span>

        <div className="ink-color-row">
          <div className="ink-color-item">
            <label className="ink-field-label">Primary Ink (Body):</label>
            <div className="ink-color-picker-wrap">
              <input
                type="color"
                className="ink-color-input"
                value={avatar.color}
                onChange={(e) =>
                  onUpdateAvatar((prev) => ({ ...prev, color: e.target.value }))
                }
                aria-label="Body Color Hex Picker"
              />
              <span className="ink-hex-val">{avatar.color.toUpperCase()}</span>
            </div>
            <div className="ink-swatch-list" role="group" aria-label="Body color swatches">
              {SWATCH_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className={`ink-swatch ${avatar.color.toLowerCase() === hex.toLowerCase() ? 'active' : ''}`}
                  style={{ backgroundColor: hex }}
                  onClick={() => onUpdateAvatar((prev) => ({ ...prev, color: hex }))}
                  aria-label={`Select body color ${hex}`}
                  title={hex}
                />
              ))}
            </div>
          </div>

          <div className="ink-color-item">
            <label className="ink-field-label">Accent Highlight:</label>
            <div className="ink-color-picker-wrap">
              <input
                type="color"
                className="ink-color-input"
                value={avatar.accent}
                onChange={(e) =>
                  onUpdateAvatar((prev) => ({ ...prev, accent: e.target.value }))
                }
                aria-label="Accent Color Hex Picker"
              />
              <span className="ink-hex-val">{avatar.accent.toUpperCase()}</span>
            </div>
            <div className="ink-swatch-list" role="group" aria-label="Accent color swatches">
              {SWATCH_ACCENTS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className={`ink-swatch ${avatar.accent.toLowerCase() === hex.toLowerCase() ? 'active' : ''}`}
                  style={{ backgroundColor: hex }}
                  onClick={() => onUpdateAvatar((prev) => ({ ...prev, accent: hex }))}
                  aria-label={`Select accent color ${hex}`}
                  title={hex}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Proportions: Bounded Sliders */}
      <section className="ink-control-section">
        <span className="ink-section-title">BOUNDED SILHOUETTE PROPORTIONS</span>

        {/* Height: 0.85 - 1.15 */}
        <div className="ink-slider-group">
          <div className="ink-slider-header">
            <label htmlFor={heightId} className="ink-slider-label">
              Stature Height (0.85 – 1.15):
            </label>
            <span className="ink-slider-value">{avatar.height.toFixed(2)}×</span>
          </div>
          <input
            id={heightId}
            type="range"
            min="0.85"
            max="1.15"
            step="0.01"
            className="ink-range-slider"
            value={avatar.height}
            onChange={(e) =>
              onUpdateAvatar((prev) => ({
                ...prev,
                height: parseFloat(e.target.value),
              }))
            }
          />
        </div>

        {/* Thickness: 0.70 - 1.30 */}
        <div className="ink-slider-group">
          <div className="ink-slider-header">
            <label htmlFor={thicknessId} className="ink-slider-label">
              Limb Thickness (0.70 – 1.30):
            </label>
            <span className="ink-slider-value">{avatar.thickness.toFixed(2)}×</span>
          </div>
          <input
            id={thicknessId}
            type="range"
            min="0.70"
            max="1.30"
            step="0.01"
            className="ink-range-slider"
            value={avatar.thickness}
            onChange={(e) =>
              onUpdateAvatar((prev) => ({
                ...prev,
                thickness: parseFloat(e.target.value),
              }))
            }
          />
        </div>

        {/* Head Scale: 0.80 - 1.20 */}
        <div className="ink-slider-group">
          <div className="ink-slider-header">
            <label htmlFor={headScaleId} className="ink-slider-label">
              Head Ratio (0.80 – 1.20):
            </label>
            <span className="ink-slider-value">{avatar.headScale.toFixed(2)}×</span>
          </div>
          <input
            id={headScaleId}
            type="range"
            min="0.80"
            max="1.20"
            step="0.01"
            className="ink-range-slider"
            value={avatar.headScale}
            onChange={(e) =>
              onUpdateAvatar((prev) => ({
                ...prev,
                headScale: parseFloat(e.target.value),
              }))
            }
          />
        </div>
      </section>

      {/* Six Headwear Choices */}
      <section className="ink-control-section">
        <span className="ink-section-title">HEADWEAR ATTACHMENTS</span>
        <div className="ink-segmented-control ink-headwear-group" role="radiogroup" aria-label="Headwear Selection">
          {HEADWEAR_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={avatar.headwear === opt.id}
              className={`ink-segmented-btn ${avatar.headwear === opt.id ? 'active' : ''}`}
              onClick={() => onUpdateAvatar((prev) => ({ ...prev, headwear: opt.id }))}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Held Equipment */}
      <section className="ink-control-section">
        <span className="ink-section-title">HELD GEAR & EQUIPMENT</span>
        <label htmlFor={equipmentSelectId} className="ink-field-label">
          Weapons / Sports / Sci-Fi / Held Props:
        </label>
        <select
          id={equipmentSelectId}
          className="ink-select"
          value={avatar.equipment ?? ''}
          onChange={(e) => {
            const val = e.target.value === '' ? null : e.target.value
            onUpdateAvatar((prev) => ({ ...prev, equipment: val }))
          }}
        >
          <option value="">None (Unarmed)</option>
          {heldProps.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} [{p.category}]
            </option>
          ))}
          {heldProps.length === 0 && (
            <option value="" disabled>
              No equipment props in catalog
            </option>
          )}
        </select>
      </section>

      {/* Actions: Export / Import / Reset */}
      <section className="ink-control-section ink-avatar-actions">
        <div className="ink-btn-row">
          <button
            type="button"
            className="ink-btn ink-btn-primary"
            onClick={handleExportJson}
            title="Export JSON configuration to file and clipboard"
          >
            <IconDownload size={14} /> Export JSON
          </button>

          <button
            type="button"
            className="ink-btn ink-btn-secondary"
            onClick={() => setImportModalOpen(true)}
            title="Import custom avatar configuration JSON"
          >
            Import JSON...
          </button>

          <button
            type="button"
            className="ink-btn ink-btn-outline"
            onClick={onReset}
            title="Reset avatar to default stick parameters"
          >
            <IconReset size={14} /> Reset
          </button>
        </div>
      </section>

      {/* Import Modal */}
      {importModalOpen && (
        <div className="ink-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div ref={importModalRef} className="ink-modal-box">
            <div className="ink-modal-header">
              <h3 id="modal-title" className="ink-modal-title">
                Import Avatar JSON Config
              </h3>
              <button
                type="button"
                className="ink-icon-btn"
                onClick={() => setImportModalOpen(false)}
                aria-label="Close import dialog"
              >
                ✕
              </button>
            </div>

            <div className="ink-modal-body">
              <p className="ink-modal-desc">
                Paste valid JSON configuration or upload a saved configuration file. All values are
                strictly validated against system bounds.
              </p>

              <div className="ink-upload-row">
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="ink-file-input"
                  aria-label="Upload configuration JSON file"
                />
              </div>

              <label htmlFor={importTextareaId} className="ink-field-label">
                Raw JSON Configuration:
              </label>
              <textarea
                id={importTextareaId}
                className="ink-textarea"
                rows={8}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='{"preset": "stick-standard", "color": "#151716", "accent": "#d45538", "height": 1, "thickness": 1, "headScale": 1, "headwear": "none", "equipment": null}'
              />

              {importErrors.length > 0 && (
                <div className="ink-modal-errors" role="alert">
                  <span className="ink-error-heading">Validation Errors:</span>
                  <ul className="ink-error-list">
                    {importErrors.map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="ink-modal-footer">
              <button
                type="button"
                className="ink-btn ink-btn-secondary"
                onClick={() => setImportModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ink-btn ink-btn-primary"
                onClick={handleImportSubmit}
              >
                Apply Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
