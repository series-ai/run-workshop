import { useRef, useState } from 'react';

/** Room codes remain selectable when clipboard access is unavailable. */
export function RoomControls({ roomCode = null, disabled = false, onJoin }: {
  readonly roomCode?: string | null;
  readonly disabled?: boolean;
  readonly onJoin: (code: string) => void;
}) {
  const [code, setCode] = useState('');
  const [copyStatus, setCopyStatus] = useState<'ready' | 'copied' | 'manual'>('ready');
  const ownCode = useRef<HTMLInputElement>(null);
  const normalized = code.trim().toUpperCase();

  async function copyCode() {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopyStatus('copied');
    } catch {
      ownCode.current?.focus();
      ownCode.current?.select();
      setCopyStatus('manual');
    }
  }

  return (
    <section className="yard-room-controls" aria-label="Room">
      {roomCode ? (
        <div className="yard-room-controls__group">
          <label htmlFor="yard-own-room">Your room code</label>
          <div className="yard-gate__row">
            <input id="yard-own-room" ref={ownCode} className="yard-input yard-room-code" value={roomCode} readOnly
              onFocus={(event) => event.currentTarget.select()} />
            <button type="button" className="yard-button" onClick={() => { void copyCode(); }} disabled={disabled}>
              {copyStatus === 'copied' ? 'Copied' : 'Copy code'}
            </button>
          </div>
          <small role="status">{copyStatus === 'manual' ? 'Select and copy the code. Clipboard access is unavailable.' : 'Share this code so others can join.'}</small>
        </div>
      ) : null}
      <form className="yard-room-controls__group" onSubmit={(event) => {
        event.preventDefault();
        if (!disabled && normalized && normalized !== roomCode) onJoin(normalized);
      }}>
        <label htmlFor="yard-join-room">{roomCode ? 'Join another room' : 'Join a room'}</label>
        <div className="yard-gate__row">
          <input id="yard-join-room" className="yard-input" value={code} disabled={disabled}
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/\s/g, ''))}
            placeholder="ROOM CODE" autoComplete="off" autoCapitalize="characters" spellCheck={false} />
          <button type="submit" className="yard-button" disabled={disabled || !normalized || normalized === roomCode}>Join</button>
        </div>
      </form>
    </section>
  );
}
