import React from 'react'
import ReactDOM from 'react-dom/client'
import { PfxBrowserApp } from './PfxBrowserApp'
import './styles.css'

// The material-controls proof launcher passes these values to its own Vite
// process. The read-only doctor compares them with the expected run before it
// trusts any capture from this page. Normal dev and build runs set none.
const runMarker: Record<'pfxRunToken' | 'pfxSourceRevision' | 'pfxSourceDiff', unknown> = {
  pfxRunToken: import.meta.env.VITE_PFX_RUN_TOKEN,
  pfxSourceRevision: import.meta.env.VITE_PFX_SOURCE_REVISION,
  pfxSourceDiff: import.meta.env.VITE_PFX_SOURCE_DIFF,
}
for (const [key, value] of Object.entries(runMarker)) {
  if (typeof value === 'string' && value.length > 0) document.documentElement.dataset[key] = value
}

const MaterialProofApp = React.lazy(() =>
  import('./MaterialProofApp').then((module) => ({ default: module.MaterialProofApp })))
const materialProof = new URLSearchParams(window.location.search).get('materialProof') === '1'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {materialProof ? (
      <React.Suspense fallback={<p>Loading material proof fixture…</p>}>
        <MaterialProofApp />
      </React.Suspense>
    ) : (
      <PfxBrowserApp />
    )}
  </React.StrictMode>,
)
