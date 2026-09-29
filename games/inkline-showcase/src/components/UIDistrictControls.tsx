import type { FC } from 'react'
import type { CameraMode } from '../types'
import { EXTRA_LAYOUTS, type DistrictLayoutId } from '../runtime/layouts'
import {
  IconCamera,
  IconWireframe,
  IconOutlines,
  IconReset,
} from './UIIcons'

export interface DistrictControlsProps {
  layout: DistrictLayoutId
  onSelectLayout: (layout: DistrictLayoutId) => void
  ambientEffects: boolean
  onToggleAmbientEffects: () => void
  industrialCount: number
  camera: CameraMode
  onSelectCamera: (cam: CameraMode) => void
  wireframe: boolean
  onToggleWireframe: () => void
  outlines: boolean
  onToggleOutlines: () => void
  onResetStage: () => void
}

const CAMERAS: { id: CameraMode; title: string; desc: string }[] = [
  {
    id: 'perspective',
    title: 'Perspective View',
    desc: 'Dynamic 3D vantage showing architectural depth and elevation levels.',
  },
  {
    id: 'side',
    title: 'Side Elevation',
    desc: 'True orthographic side profile for structural alignment analysis.',
  },
  {
    id: 'top',
    title: 'Top-Down Plan',
    desc: 'Plan-view grid layout showing district zones and transit corridors.',
  },
  {
    id: 'third-person',
    title: 'Close View',
    desc: 'Inspect the center of the scene. Drag to orbit or move the view.',
  },
]

export const UIDistrictControls: FC<DistrictControlsProps> = ({
  layout, onSelectLayout, ambientEffects, onToggleAmbientEffects, industrialCount,
  camera,
  onSelectCamera,
  wireframe,
  onToggleWireframe,
  outlines,
  onToggleOutlines,
  onResetStage,
}) => {
  return (
    <div className="ink-district-panel" aria-label="District Scene Controls">
      <section className="ink-control-section">
        <span className="ink-section-title">LEVEL SCENES</span>
        <div className="ink-camera-cards" role="radiogroup" aria-label="Environment layout">
          {[{ id: 'district' as const, label: 'Industrial District', description: 'Factory yard with a connected ramp route, pipes, rails, storage, and loading areas.' }, ...EXTRA_LAYOUTS].map(scene => (
            <button key={scene.id} type="button" role="radio" aria-label={scene.label} aria-checked={layout === scene.id} className={`ink-cam-card ${layout === scene.id ? 'active' : ''}`} onClick={() => onSelectLayout(scene.id)}>
              <span className="ink-cam-title">{scene.label}</span>
              <p className="ink-cam-desc">{scene.description}</p>
            </button>
          ))}
        </div>
        <div className="ink-district-actions">
          <a className="ink-btn ink-btn-sm ink-btn-secondary" href={`/assets/scenes/${layout === 'district' ? 'industrial-district' : layout}.glb`} download>Download scene GLB</a>
          <a className="ink-btn ink-btn-sm ink-btn-outline" href={`/assets/${layout === 'district' ? 'industrial-district' : layout}.json`} download>Layout JSON</a>
          <button type="button" className="ink-btn ink-btn-sm ink-btn-outline" aria-pressed={ambientEffects} onClick={onToggleAmbientEffects}>Scene effects: {ambientEffects ? 'ON' : 'OFF'}</button>
        </div>
      </section>
      {/* Camera Selection */}
      <section className="ink-control-section">
        <div className="ink-section-header">
          <span className="ink-section-title">CAMERA PERSPECTIVES</span>
          <span className="ink-section-sub">Active: {camera}</span>
        </div>

        <div className="ink-camera-cards" role="radiogroup" aria-label="District Camera Vantage">
          {CAMERAS.map((cam) => {
            const isSelected = camera === cam.id
            return (
              <button
                key={cam.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`ink-cam-card ${isSelected ? 'active' : ''}`}
                onClick={() => onSelectCamera(cam.id)}
              >
                <div className="ink-cam-card-header">
                  <span className="ink-cam-icon">
                    <IconCamera size={14} />
                  </span>
                  <span className="ink-cam-title">{cam.title}</span>
                  {isSelected && <span className="ink-cam-badge">ACTIVE</span>}
                </div>
                <p className="ink-cam-desc">{cam.desc}</p>
              </button>
            )
          })}
        </div>
      </section>

      {/* Orbit & Touch Navigation Instructions */}
      <section className="ink-control-section">
        <span className="ink-section-title">NAVIGATION & GESTURE GUIDE</span>
        <div className="ink-guide-box">
          <div className="ink-guide-block">
            <span className="ink-guide-heading">DESKTOP MOUSE</span>
            <ul className="ink-guide-list">
              <li>
                <kbd>Left Click + Drag</kbd> — Orbit view around district center
              </li>
              <li>
                <kbd>Right Click + Drag</kbd> or <kbd>Shift + Drag</kbd> — Pan camera
              </li>
              <li>
                <kbd>Mouse Scroll</kbd> — Smooth zoom in / out
              </li>
            </ul>
          </div>

          <div className="ink-guide-block">
            <span className="ink-guide-heading">MOBILE TOUCH</span>
            <ul className="ink-guide-list">
              <li>
                <kbd>One-Finger Swipe</kbd> — Rotate & orbit 3D view
              </li>
              <li>
                <kbd>Two-Finger Drag</kbd> — Pan across district planes
              </li>
              <li>
                <kbd>Pinch Gesture</kbd> — Zoom distance
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Architectural Kit Specs */}
      <section className="ink-control-section">
        <span className="ink-section-title">DISTRICT CONSTRUCTION KIT</span>
        <div className="ink-spec-card">
          <p className="ink-spec-desc">
            Build levels with {industrialCount} industrial modules:
            structural beams, platforms, safety rails, steel stairs, overhead ducts,
            processing vats, and factory dressing.
          </p>
          <div className="ink-district-actions">
            <button
              type="button"
              className={`ink-btn ink-btn-sm ${wireframe ? 'ink-btn-primary' : 'ink-btn-secondary'}`}
              onClick={onToggleWireframe}
            >
              <IconWireframe size={14} /> {wireframe ? 'Wireframe: ON' : 'Wireframe: OFF'}
            </button>
            <button
              type="button"
              className={`ink-btn ink-btn-sm ${outlines ? 'ink-btn-primary' : 'ink-btn-secondary'}`}
              onClick={onToggleOutlines}
            >
              <IconOutlines size={14} /> {outlines ? 'Contours: ON' : 'Contours: OFF'}
            </button>
            <button
              type="button"
              className="ink-btn ink-btn-sm ink-btn-outline"
              onClick={onResetStage}
            >
              <IconReset size={14} /> Reset View
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
