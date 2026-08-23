/**
 * Plays back the pack's 30 audio tracks: the original Proof of Play score
 * (11 music tracks, WAV originals — some are 25 MB+) and 19 SFX. Tracks use
 * `preload="none"` so the tab never pulls audio it does not play.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  formatBytes,
  loadAudio,
  runtimeAssetUrl,
  type PirateNationAudioEntry,
} from '../catalog'

const CATEGORY_LABELS: Record<string, string> = {
  music: 'Music & Soundtracks',
  sfx: 'Sound Effects',
}

function groupBySubCategory(
  tracks: PirateNationAudioEntry[],
): Map<string, PirateNationAudioEntry[]> {
  const groups = new Map<string, PirateNationAudioEntry[]>()
  for (const track of tracks) {
    const key = track.subCategory || 'other'
    const list = groups.get(key)
    if (list) list.push(track)
    else groups.set(key, [track])
  }
  return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])))
}

export function AudioRoom() {
  const [tracks, setTracks] = useState<PirateNationAudioEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAudio().then(setTracks, (err: Error) => setError(err.message))
  }, [])

  const byCategory = useMemo(() => {
    if (!tracks) return []
    const categories = new Map<string, PirateNationAudioEntry[]>()
    for (const track of tracks) {
      const list = categories.get(track.category)
      if (list) list.push(track)
      else categories.set(track.category, [track])
    }
    return [...categories.entries()]
  }, [tracks])

  if (error) return <div className="load-error">Could not load the audio catalog: {error}</div>
  if (!tracks) return <div className="loading">Loading audio catalog…</div>

  return (
    <section className="audio-room">
      {byCategory.map(([category, categoryTracks]) => (
        <section key={category} className="audio-category">
          <h2>
            {CATEGORY_LABELS[category] ?? category}{' '}
            <span className="count">{categoryTracks.length}</span>
          </h2>
          {[...groupBySubCategory(categoryTracks).entries()].map(([subCategory, items]) => (
            <div key={subCategory} className="audio-group">
              <h3>{subCategory}</h3>
              <ul className="track-list">
                {items.map((track) => (
                  <li key={track.id} className="track-row">
                    <div className="track-info">
                      <span className="track-name">{track.name}</span>
                      <span className="track-meta">
                        {track.format.toUpperCase()} · {formatBytes(track.sizeBytes)}
                      </span>
                    </div>
                    <audio controls preload="none" src={runtimeAssetUrl(track)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
      <p className="audio-note">
        Music ships as the original WAV masters. Files stream from the local dev server; nothing
        downloads until you press play.
      </p>
    </section>
  )
}
