import React, { useState, useRef, useEffect } from 'react'
import { AUDIO_TRACKS, type AudioTrackDef } from '../catalog'
import { resolveAssetUrl } from '../assetLibrary'
import { Volume2, Play, Pause, Music, Wind, Zap, Radio } from 'lucide-react'

export const AudioRoom: React.FC = () => {
  const [currentMusic, setCurrentMusic] = useState<AudioTrackDef | null>(null)
  const [currentAmbient, setCurrentAmbient] = useState<AudioTrackDef | null>(null)
  const [isPlayingMusic, setIsPlayingMusic] = useState(false)
  const [isPlayingAmbient, setIsPlayingAmbient] = useState(false)
  const [volume, setVolume] = useState(0.7)

  const musicAudioRef = useRef<HTMLAudioElement | null>(null)
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null)
  const sfxAudioRef = useRef<HTMLAudioElement | null>(null)

  const musicTracks = AUDIO_TRACKS.filter((t) => t.category === 'music')
  const ambientTracks = AUDIO_TRACKS.filter((t) => t.category === 'ambient')
  const sfxTracks = AUDIO_TRACKS.filter((t) => t.category === 'sfx')

  const playMusic = async (track: AudioTrackDef) => {
    try {
      if (musicAudioRef.current) {
        musicAudioRef.current.pause()
      }
      const url = await resolveAssetUrl(track.path)
      const audio = new Audio(url)
      audio.loop = true
      audio.volume = volume
      audio.play()
      musicAudioRef.current = audio
      setCurrentMusic(track)
      setIsPlayingMusic(true)
    } catch {
      // Audio playback handling
    }
  }

  const toggleMusic = () => {
    if (!musicAudioRef.current) {
      if (musicTracks.length > 0) playMusic(musicTracks[0])
      return
    }
    if (isPlayingMusic) {
      musicAudioRef.current.pause()
      setIsPlayingMusic(false)
    } else {
      musicAudioRef.current.play()
      setIsPlayingMusic(true)
    }
  }

  const playAmbient = async (track: AudioTrackDef) => {
    try {
      if (ambientAudioRef.current) {
        ambientAudioRef.current.pause()
      }
      const url = await resolveAssetUrl(track.path)
      const audio = new Audio(url)
      audio.loop = true
      audio.volume = volume * 0.8
      audio.play()
      ambientAudioRef.current = audio
      setCurrentAmbient(track)
      setIsPlayingAmbient(true)
    } catch {
      // Audio playback handling
    }
  }

  const toggleAmbient = () => {
    if (!ambientAudioRef.current) {
      if (ambientTracks.length > 0) playAmbient(ambientTracks[0])
      return
    }
    if (isPlayingAmbient) {
      ambientAudioRef.current.pause()
      setIsPlayingAmbient(false)
    } else {
      ambientAudioRef.current.play()
      setIsPlayingAmbient(true)
    }
  }

  const triggerSfx = async (track: AudioTrackDef) => {
    try {
      const url = await resolveAssetUrl(track.path)
      const audio = new Audio(url)
      audio.volume = volume
      audio.play()
      sfxAudioRef.current = audio
    } catch {
      // Audio playback handling
    }
  }

  // Update volume
  useEffect(() => {
    if (musicAudioRef.current) musicAudioRef.current.volume = volume
    if (ambientAudioRef.current) ambientAudioRef.current.volume = volume * 0.8
  }, [volume])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      musicAudioRef.current?.pause()
      ambientAudioRef.current?.pause()
      sfxAudioRef.current?.pause()
    }
  }, [])

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-pink-400" />
            Cozy Audio Room
          </h2>
          <p className="text-slate-400 text-xs">
            Native .ogg soundscapes: background soundtracks, ambient loops, and interactive SFX soundboard.
          </p>
        </div>

        {/* Global Volume Slider */}
        <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
          <Volume2 className="w-4 h-4 text-slate-400" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-24 accent-pink-500 cursor-pointer"
          />
          <span className="text-[11px] font-mono text-pink-300 w-8 text-right">
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Music & Ambient Players */}
        <div className="lg:col-span-5 space-y-5">
          {/* Active Music Player Card */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-pink-400" />
                <span className="text-xs font-semibold text-slate-200">Background Music</span>
              </div>
              {isPlayingMusic && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30 animate-pulse">
                  Playing Loop
                </span>
              )}
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
                  <Radio className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">
                    {currentMusic?.name ?? 'Select a music track'}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {currentMusic?.path ?? 'audio/music/...'}
                  </div>
                </div>
              </div>

              <button
                onClick={toggleMusic}
                className="w-9 h-9 rounded-lg bg-pink-600 hover:bg-pink-500 text-white flex items-center justify-center shadow-lg shadow-pink-900/30 transition shrink-0 ml-2"
              >
                {isPlayingMusic ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
            </div>

            {/* Track List */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {musicTracks.map((track) => (
                <div
                  key={track.id}
                  onClick={() => playMusic(track)}
                  className={`px-3 py-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition ${
                    currentMusic?.id === track.id
                      ? 'border-pink-500 bg-pink-500/10 text-pink-300 font-semibold'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <span className="truncate">{track.name}</span>
                  <span className="text-[10px] font-mono text-slate-600">.ogg</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ambient Loops Card */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-slate-200">Ambient Atmosphere</span>
              </div>
              {isPlayingAmbient && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse">
                  Atmosphere On
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {ambientTracks.map((track) => (
                <button
                  key={track.id}
                  onClick={() => {
                    if (currentAmbient?.id === track.id && isPlayingAmbient) {
                      toggleAmbient()
                    } else {
                      playAmbient(track)
                    }
                  }}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                    currentAmbient?.id === track.id && isPlayingAmbient
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300 font-semibold shadow'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-medium truncate">{track.name}</span>
                  <span className="text-[10px] text-slate-500 mt-1">Seamless Loop</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Soundboard SFX */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                Interactive Sound Effects Board ({sfxTracks.length})
              </h3>
              <p className="text-slate-400 text-[11px] mt-0.5">
                Click any sound button to trigger instant playback.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
              {sfxTracks.map((sfx) => (
                <button
                  key={sfx.id}
                  onClick={() => triggerSfx(sfx)}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/80 active:scale-95 transition flex flex-col items-start justify-between text-left group"
                >
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-amber-300 truncate w-full">
                    {sfx.name}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono mt-2">
                    {sfx.subCategory ?? 'SFX'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
