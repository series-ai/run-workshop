import type { YardAudioControl } from '../audio/useYardAudio';

export function AudioControls({ audio }: { audio: YardAudioControl }) {
  return <fieldset className="yard-audio">
    <legend>Sound</legend>
    <label className="yard-audio__mute"><input type="checkbox" checked={audio.settings.muted} onChange={event => audio.change({ ...audio.settings, muted: event.target.checked })} />Mute sound</label>
    {(['ambience', 'effects'] as const).map(key => <label className="yard-audio__level" key={key}>
      <span>{key === 'ambience' ? 'Ambience' : 'Effects'}</span>
      <input type="range" min="0" max="100" value={Math.round(audio.settings[key] * 100)} onChange={event => audio.change({ ...audio.settings, [key]: Number(event.target.value) / 100 })} />
      <output>{Math.round(audio.settings[key] * 100)}%</output>
    </label>)}
    {audio.status === 'loading' ? <small role="status">Loading sound…</small> : null}
    {audio.status === 'error' ? <small role="status">Sound did not load. Tap Resume to retry.</small> : null}
  </fieldset>;
}
