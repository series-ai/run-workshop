/**
 * Pack landing page: hero, stats, and exploration routes across the five
 * interactive showcase surfaces.
 */
import { useEffect, useState } from 'react'
import { resolveAssetUrl } from '../assetLibrary'
import {
  loadManifest,
  menuBackgroundAssetReference,
  type PackManifest,
} from '../catalog'

export type ExploreTab = 'models' | 'scene' | 'avatar' | 'sprites' | 'audio'

export interface DashboardProps {
  onNavigate: (tab: ExploreTab) => void
  visited: ReadonlySet<ExploreTab>
}

const EXPEDITIONS: Array<{
  id: ExploreTab
  label: string
  description: string
  count: string
}> = [
  {
    id: 'models',
    label: 'Models',
    count: '375 files · 355 visual models',
    description: 'Inspect ships, buildings, creatures, props, and collision geometry.',
  },
  {
    id: 'scene',
    label: 'Scene',
    count: '5-model scenes',
    description: 'Place several models together with shared scale and ground alignment.',
  },
  {
    id: 'avatar',
    label: 'Avatar Lab',
    count: '326 parts · 32 clips',
    description: 'Build a pirate from the shared character rig.',
  },
  {
    id: 'sprites',
    label: 'Sprites',
    count: '513 sprites',
    description: 'Review icons, interface art, and branding images.',
  },
  {
    id: 'audio',
    label: 'Audio',
    count: '30 tracks',
    description: 'Listen to music and sound effects from the game.',
  },
]

const FALLBACK_HOME_DATA = {
  displayName: 'Pirate Nation Art & Audio Pack',
  totalModels: 375,
  totalSprites: 513,
  totalAudioTracks: 30,
  sourceRepo: 'https://github.com/proofofplay/piratenation-game',
} as const

export function Dashboard({ onNavigate, visited }: DashboardProps) {
  const [manifest, setManifest] = useState<PackManifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)

  useEffect(() => {
    loadManifest().then(setManifest, (err: Error) => setError(err.message))
  }, [])

  useEffect(() => {
    let active = true
    resolveAssetUrl(menuBackgroundAssetReference()).then(
      (url) => {
        if (active) setBackgroundUrl(url)
      },
      () => {
        if (active) setBackgroundUrl(null)
      },
    )
    return () => {
      active = false
    }
  }, [])

  const displayName = manifest?.displayName ?? FALLBACK_HOME_DATA.displayName
  const totalModels = manifest?.counts.totalModels ?? FALLBACK_HOME_DATA.totalModels
  const totalSprites = manifest?.counts.totalSprites ?? FALLBACK_HOME_DATA.totalSprites
  const totalAudioTracks = manifest?.counts.totalAudioTracks ?? FALLBACK_HOME_DATA.totalAudioTracks
  const sourceRepo = manifest?.provenance.sourceRepo ?? FALLBACK_HOME_DATA.sourceRepo

  const heroStyle = backgroundUrl
    ? {
        backgroundImage: `linear-gradient(90deg, rgba(8, 13, 24, 0.94) 0%, rgba(8, 13, 24, 0.68) 48%, rgba(8, 13, 24, 0.2) 100%), url("${backgroundUrl}")`,
      }
    : undefined

  return (
    <section className="landing-page">
      <header className="landing-hero" style={heroStyle}>
        <div className="landing-hero-copy">
          <p className="landing-kicker">{displayName}</p>
          <h2>Build your next world.</h2>
          <p>Explore the models, characters, sprites, and sounds that make a voxel pirate world.</p>
          <button type="button" className="primary-action" onClick={() => onNavigate('models')}>
            Start with models
          </button>
          <p className="landing-thanks">
            Thank you to Proof of Play for sharing this work so others can build with it.
          </p>
          {error && (
            <p className="landing-data-warning" role="status">
              Manifest details unavailable. Explore routes remain available.
            </p>
          )}
        </div>
        <div className="landing-stats" aria-label="Pack contents">
          <span>
            <strong>{totalModels}</strong> model files
          </span>
          <span>
            <strong>{totalSprites}</strong> sprites
          </span>
          <span>
            <strong>{totalAudioTracks}</strong> audio tracks
          </span>
        </div>
      </header>

      <section className="landing-explore" aria-labelledby="landing-explore-title">
        <div className="landing-section-heading">
          <div>
            <p className="landing-kicker">Choose a route</p>
            <h3 id="landing-explore-title">Explore the collection</h3>
          </div>
          <span data-testid="home-progress">
            {visited.size} / {EXPEDITIONS.length} reviewed
          </span>
        </div>
        <div className="landing-route-grid">
          {EXPEDITIONS.map((route) => {
            const reviewed = visited.has(route.id)
            return (
              <button
                key={route.id}
                type="button"
                data-testid={`home-route-${route.id}`}
                className={reviewed ? 'landing-route reviewed' : 'landing-route'}
                onClick={() => onNavigate(route.id)}
              >
                <span className="landing-route-label">{route.label}</span>
                <strong>{route.count}</strong>
                <span>{route.description}</span>
                <span className="landing-route-status">{reviewed ? 'Reviewed' : 'Open'}</span>
              </button>
            )
          })}
        </div>
      </section>

      <p className="landing-license">
        MIT · Copyright (c) 2026 Proof of Play, Inc. · <a href={sourceRepo}>View source</a>
      </p>
    </section>
  )
}
