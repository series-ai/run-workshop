import { useEffect, useRef, type FC } from 'react'
import { IconClose } from './UIIcons'

export interface DocsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const UIDocsModal: FC<DocsModalProps> = ({ isOpen, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const prevActive = document.activeElement as HTMLElement | null

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
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

    // Auto-focus first focusable element inside modal
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
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
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="ink-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ink-docs-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div ref={modalRef} className="ink-modal-box ink-docs-box">
        <div className="ink-modal-header">
          <div>
            <span className="ink-modal-badge">INKLINE SPECIFICATION</span>
            <h2 id="ink-docs-title" className="ink-modal-title">
              UI Contract & Pack Architecture
            </h2>
          </div>
          <button
            type="button"
            className="ink-icon-btn"
            onClick={onClose}
            aria-label="Close Documentation"
          >
            <IconClose size={18} />
          </button>
        </div>

        <div className="ink-modal-body ink-docs-content">
          <section className="ink-doc-section">
            <h3>1. Integration Architecture</h3>
            <p>
              The showcase connects the responsive React interface to the coordinator-owned 3D
              canvas via the <code>&lt;Stage /&gt;</code> component:
            </p>
            <pre>
              <code>{`<Stage
  settings={settings}       // StageSettings (immutable updates)
  manifest={manifest}       // PackManifest (loaded from ./assets/manifest.json)
  onStats={handleStats}     // (stats: StageStats) => void
/>`}</code>
            </pre>
          </section>

          <section className="ink-doc-section">
            <h3>2. Input Bus Contract</h3>
            <p>
              For combat, parkour, and interactive locomotion, the 3D Stage listens to native window
              CustomEvents:
            </p>
            <pre>
              <code>{`window.dispatchEvent(new CustomEvent('inkline-input', {
  detail: {
    action: 'left' | 'right' | 'forward' | 'back' | 'jump' | 'attack' | 'dash' | 'reset',
    pressed: boolean
  }
}));`}</code>
            </pre>
            <p>
              On-screen buttons dispatch this input event. The keyboard uses the same action names.
            </p>
          </section>

          <section className="ink-doc-section">
            <h3>3. Procedural VFX Catalog</h3>
            <p>
              Imported from <code>./runtime/effects</code> with the full set of distinct presets. Effects are
              triggered by incrementing <code>settings.trigger</code> and take color highlights
              dynamically from <code>settings.effectColor</code>.
            </p>
          </section>

          <section className="ink-doc-section">
            <h3>4. Avatar Customization & Strict Validation</h3>
            <ul>
              <li>
                <strong>12 Presets:</strong> Standard, Runner, Fighter, Tall, Compact, Heavy, Scout,
                Acrobat, Worker, Agent, Striker, Sentinel.
              </li>
              <li>
                <strong>Bounds:</strong> Height (0.85 – 1.15), Thickness (0.70 – 1.30), Head Ratio
                (0.80 – 1.20).
              </li>
              <li>
                <strong>Headwear:</strong> <code>none</code>, <code>cap</code>, <code>headband</code>,{' '}
                <code>beanie</code>, <code>visor</code>, <code>helmet</code>.
              </li>
              <li>
                <strong>Equipment:</strong> Props categorized under weapons, sports, sci-fi, or
                tagged <code>held</code>.
              </li>
              <li>
                <strong>Storage:</strong> Safely serialized to <code>localStorage</code> with
                boundary checks and export/import validation.
              </li>
            </ul>
          </section>

          <section className="ink-doc-section">
            <h3>5. Performance Target & Verification Status</h3>
            <p>
              Targeting 60 FPS at 720p with 20 stick figures and 10 concurrent VFX bursts. Continuous
              15-minute runtime on physical Android devices is <strong>UNVERIFIED</strong> pending
              hardware lab access. All FPS, draw call, and polygon numbers displayed in this UI are
              genuine measurements reported by WebGL.
            </p>
          </section>
        </div>

        <div className="ink-modal-footer">
          <button type="button" className="ink-btn ink-btn-primary" onClick={onClose}>
            Close Documentation
          </button>
        </div>
      </div>
    </div>
  )
}
