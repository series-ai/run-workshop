import { useEffect, type MutableRefObject } from 'react';
import type { MatchSnapshot } from '../game/match';
import { inputLive } from '../game/playGate';
import { elevatorPanelWithinReach, restackWithinReach, type AttractionCommand, type AttractionRequest } from '../sim/attractions';
import type { PlayGateApi } from './usePlayGate';
import './AttractionControls.css';

export function queueAttraction(request: AttractionRequest, command: AttractionCommand): void {
  request.command = command;
  request.sequence = (request.sequence + 1) & 65535;
}
export function AttractionControls({ snapshot, gate, request, controllerActive = false }: { snapshot: MatchSnapshot; gate: PlayGateApi; request: MutableRefObject<AttractionRequest>; controllerActive?: boolean }) {
  const render = snapshot.render;
  const player = render?.players.find((p) => p.slot === render.localSlot);
  const live = snapshot.status === 'live' && inputLive(gate.state) && !player?.ridingVehicle;
  const elevator = render?.attractions.elevator;
  const panel = Boolean(live && player && elevator && elevatorPanelWithinReach(player.position, elevator.y));
  const reset = Boolean(live && player && restackWithinReach(player.position));
  useEffect(() => {
    const clear = () => { request.current.command = 0; };
    const remove = gate.onClearInput(clear);
    window.addEventListener('blur', clear);
    clear();
    return () => { remove(); window.removeEventListener('blur', clear); clear(); };
  }, [gate.onClearInput, request, snapshot.roomCode, snapshot.status]);
  if ((!panel && !reset) || !elevator || !render) return null;
  return <section className="attraction-controls" aria-label={panel ? 'Elevator floors' : 'Storage reset'} onPointerDown={(event) => event.stopPropagation()}>
    {panel ? <><div className="attraction-controls__title">FREIGHT LIFT <small>{elevator.status === 'blocked' ? 'Path blocked' : elevator.status === 'moving' ? 'Moving' : 'Select floor'}</small></div>
      <div className="attraction-controls__floors">{[0, 1, 2, 3].map((floor) => <button key={floor} type="button" aria-label={`Elevator floor ${floor === 0 ? 'ground' : floor}`} aria-pressed={elevator.target === floor} onClick={() => queueAttraction(request.current, (floor + 1) as AttractionCommand)}>{floor === 0 ? 'G' : floor}</button>)}</div><small className="attraction-controls__keys">{controllerActive ? 'Dpad: ↓ G · ← 1 · ↑ 2 · → 3' : 'Keys: G · 1 · 2 · 3'}</small></>
      : <><div className="attraction-controls__title">PERFECTLY SAFE STORAGE</div><button type="button" onClick={() => queueAttraction(request.current, 5)}>RESTACK{controllerActive ? ' (X)' : ''}</button>{render.attractions.resetStatus === 'blocked' ? <small role="status">Clear people and other objects from the bay.</small> : <small>Clear the bay before reset.</small>}</>}
  </section>;
}
