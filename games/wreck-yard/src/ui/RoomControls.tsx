import { useRef, useState } from 'react';

/** Room codes remain selectable when clipboard access is unavailable. */
export function RoomControls({ roomCode = null, disabled = false, onJoin, controllerActive = false }: {
  readonly roomCode?: string | null;
  readonly disabled?: boolean;
  readonly onJoin: (code: string) => void;
  readonly controllerActive?: boolean;
}) {
  const [code, setCode] = useState('');
  const [copyStatus, setCopyStatus] = useState<'ready' | 'copied' | 'manual'>('ready');
  const [keypad, setKeypad] = useState(false);
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
            onClick={() => { if (controllerActive) setKeypad(true); }}
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/\s/g, ''))}
            placeholder="ROOM CODE" autoComplete="off" autoCapitalize="characters" spellCheck={false} />
          <button type="submit" className="yard-button" disabled={disabled || !normalized || normalized === roomCode}>Join</button>
        </div>
        {controllerActive ? <button type="button" className="yard-button" disabled={disabled} onClick={() => setKeypad(true)}>Enter code</button> : null}
      </form>
      {keypad ? <div className="yard-controller-keypad" data-controller-keypad role="dialog" aria-modal="true" aria-label="Room code keypad">
        <div className="yard-plate yard-controller-keypad__card">
          <h2>Room code</h2>
          <output aria-label="Entered room code">{normalized.padEnd(6, '·')}</output>
          <div className="yard-controller-keypad__keys">
            {[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'].map((character, index) => <button type="button" key={character}
              data-controller-default={index === 0 ? '' : undefined} className="yard-button" disabled={disabled}
              onClick={() => setCode(value => value.length < 6 ? value + character : value)}>{character}</button>)}
          </div>
          <div className="yard-gate__row">
            <button type="button" className="yard-button" disabled={disabled} onClick={() => setCode(value => value.slice(0, -1))}>Delete</button>
            <button type="button" className="yard-button" disabled={disabled} onClick={() => setCode('')}>Clear</button>
          </div>
          <button type="button" className="yard-button yard-button--primary" disabled={disabled || !/^[A-Z0-9]{6}$/.test(normalized) || normalized === roomCode}
            onClick={() => { setKeypad(false); onJoin(normalized); }}>Join</button>
          <button type="button" className="yard-button" data-controller-back onClick={() => setKeypad(false)}>Back</button>
          <small>Dpad Navigate · A Select · B Back</small>
        </div>
      </div> : null}
    </section>
  );
}
