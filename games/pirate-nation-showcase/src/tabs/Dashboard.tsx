/**
 * Pack overview: what is in the pack, where it comes from, how to attribute,
 * and — just as important — what the showcase cannot show.
 */
import { useEffect, useState } from 'react'
import { loadManifest, PACK_CDN_PREFIX, type PackManifest } from '../catalog'

/** Honest scope: content the pack (and therefore the showcase) cannot have. */
const OUT_OF_SCOPE = [
  'Unity particle-system VFX (BattleVFX) — particle graphs do not port to GLB',
  'Epic Toon FX and Stylized Water 2 — paid packs, removed from the source release',
  'Animator controllers and blend trees — only raw animation clips survive',
  'Third-party packs: Honeti GUI, Pixel Art Icons, Meebits, DemoPlaceholder art, commercial SND-library SFX',
  'Baked voxel islands (Unity .asset) — the exported island GLBs stand in for them',
  'Game logic, backend, and anything playable — this is an art library',
]

export function Dashboard() {
  const [manifest, setManifest] = useState<PackManifest | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadManifest().then(setManifest, (err: Error) => setError(err.message))
  }, [])

  if (error) return <div className="load-error">Could not load the pack manifest: {error}</div>
  if (!manifest) return <div className="loading">Loading pack manifest…</div>

  return (
    <section className="dashboard">
      <header className="dashboard-hero">
        <h2>{manifest.displayName}</h2>
        <p>
          An allowlisted extract from the archival open-source release of{' '}
          <strong>Pirate Nation</strong>, the high-seas adventure game by Proof of Play. Browse
          the full art and audio library: voxel ships, buildings, sea monsters, a 326-part pirate
          avatar system, the original soundtrack, and the game&apos;s UI art.
        </p>
        <div className="stat-row">
          <div className="stat">
            <strong>{manifest.counts.totalModels}</strong>
            <span>models</span>
          </div>
          <div className="stat">
            <strong>{manifest.counts.totalSprites}</strong>
            <span>sprites</span>
          </div>
          <div className="stat">
            <strong>{manifest.counts.totalAudioTracks}</strong>
            <span>audio tracks</span>
          </div>
          <div className="stat">
            <strong>{manifest.collections.length}</strong>
            <span>collections</span>
          </div>
        </div>
      </header>

      <section>
        <h3>Collections</h3>
        <div className="collection-grid">
          {manifest.collections.map((collection) => (
            <div key={collection.id} className="collection-card">
              <strong>{collection.name}</strong>
              <p>{collection.description}</p>
              <span className="count">{collection.count} assets</span>
            </div>
          ))}
        </div>
      </section>

      <section className="provenance-panel">
        <h3>Provenance &amp; attribution</h3>
        <dl className="metadata">
          <div>
            <dt>Source</dt>
            <dd>
              <a href={manifest.provenance.sourceRepo}>{manifest.provenance.sourceRepo}</a>
            </dd>
          </div>
          <div>
            <dt>Pinned commit</dt>
            <dd className="mono">{manifest.provenance.sourceCommit}</dd>
          </div>
          <div>
            <dt>License</dt>
            <dd>
              {manifest.license} — {manifest.copyright}
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{manifest.provenance.openSourceStatus}</dd>
          </div>
          <div>
            <dt>Pack files</dt>
            <dd className="mono">
              cdn-assets/{PACK_CDN_PREFIX}/LICENSE · cdn-assets/{PACK_CDN_PREFIX}/PROVENANCE.md
            </dd>
          </div>
        </dl>
        <p className="attribution-note">
          To reuse these assets, keep the {manifest.license} license and the Proof of Play
          copyright notice with your distribution.
        </p>
      </section>

      <section>
        <h3>What this showcase cannot show</h3>
        <ul className="scope-list">
          {OUT_OF_SCOPE.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </section>
  )
}
