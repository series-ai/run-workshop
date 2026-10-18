import { useEffect, useMemo, useRef, useState } from 'react';
import RundotAPI from '@series-inc/rundot-game-sdk/api';
import { ControllerInputState } from '../game/controllerInput';
import { inputLive, cursorNeededNow } from '../game/playGate';
import type { MatchStatus } from '../game/match';
import type { PlayGateApi } from './usePlayGate';
import { ControllerMenu, controllerMenuRoot } from './controllerMenu';

export function useControllerInput(sdkReady: boolean, gate: PlayGateApi, status: MatchStatus) {
  const latest = useRef({ gate, status });
  latest.current = { gate, status };
  const [active, setActive] = useState(false);
  const [connected, setConnected] = useState(false);
  const activeRef = useRef(false);
  const state = useMemo(() => new ControllerInputState(), []);
  const menu = useMemo(() => new ControllerMenu(), []);
  const ready = useRef(false);
  const hostPaused = useRef(false);
  const hostSleeping = useRef(false);
  const browserBlurred = useRef(false);
  const device = useRef<string | null>(null);
  const root = useRef<HTMLElement | null>(null);

  const input = useMemo(() => ({
    state,
    deactivate() { activeRef.current = false; setActive(false); state.clear(); menu.clear(); },
    poll(now: number) {
      if (!ready.current || hostPaused.current || hostSleeping.current || browserBlurred.current || document.hidden) { state.clear(); return; }
      const pads = RundotAPI.gamepad.getGamepads();
      const pad = pads.find(candidate => `${candidate.source}:${candidate.index}:${candidate.id}` === device.current) ?? pads[0];
      const key = pad ? `${pad.source}:${pad.index}:${pad.id}` : null;
      if (key !== device.current) {
        if (device.current && activeRef.current) latest.current.gate.pause();
        device.current = key;
        state.clear(); menu.clear(); setConnected(Boolean(pad));
      }
      if (!pad) return;
      const nextRoot = controllerMenuRoot();
      if (nextRoot !== root.current) { root.current = nextRoot; state.clear(); menu.clear(); }
      const activity = state.update(pad);
      const edges = new Set(state.edges);
      if (activity && !activeRef.current) {
        activeRef.current = true; setActive(true);
        latest.current.gate.chooseController();
      }
      const currentGate = latest.current.gate;
      if (edges.has('start') && latest.current.status === 'live' && !cursorNeededNow(currentGate.state)) {
        if (nextRoot?.hasAttribute('data-controller-keypad')) nextRoot.querySelector<HTMLElement>('[data-controller-back]')?.click();
        else if (inputLive(currentGate.state)) currentGate.pause();
        else { currentGate.chooseController(); void currentGate.engage(); }
        state.clear(); menu.clear(); return;
      }
      if (nextRoot) {
        if (activeRef.current) menu.step(nextRoot, pad, edges, now);
        state.suppress();
      } else if (!inputLive(currentGate.state) || latest.current.status !== 'live') state.suppress();
    },
  }), [menu, state]);

  useEffect(() => {
    if (!sdkReady) return;
    let live = true;
    void RundotAPI.gamepad.ready().then(() => { if (live) ready.current = RundotAPI.gamepad.isSupported(); });
    const pause = () => { state.clear(); menu.clear(); latest.current.gate.pause(); };
    const blur = () => { browserBlurred.current = true; pause(); };
    const focus = () => { browserBlurred.current = false; state.clear(); };
    const visibility = () => { if (document.hidden) pause(); else state.clear(); };
    const subscriptions = [
      RundotAPI.lifecycles.onPause(() => { hostPaused.current = true; pause(); }),
      RundotAPI.lifecycles.onSleep(() => { hostSleeping.current = true; pause(); }),
      RundotAPI.lifecycles.onResume(() => { hostPaused.current = false; state.clear(); }),
      RundotAPI.lifecycles.onAwake(() => { hostSleeping.current = false; state.clear(); }),
    ];
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      live = false; ready.current = false; state.clear(); menu.clear();
      for (const subscription of subscriptions) subscription.unsubscribe();
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [sdkReady, state, menu]);
  useEffect(() => gate.onClearInput(() => { state.clear(); menu.clear(); }), [gate.onClearInput, state, menu]);
  return { input, active, connected };
}

export type YardControllerInput = ReturnType<typeof useControllerInput>['input'];
