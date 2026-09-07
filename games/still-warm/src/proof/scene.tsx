// @refresh reset
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { GameStore } from "../game/store";
import {
  createInitialState,
  VOCAL_CUES,
  type GameAction,
  type VocalCue,
} from "../game/model";
import type { CreatureCall } from "../audio/creatureVoice";
import { SurgeryScene } from "../scene/SurgeryScene";
import { LookInput } from "../scene/look";

export default function SceneReview() {
  const store = useMemo(
    () => new GameStore({ ...createInitialState(), phase: "playing" }),
    [],
  );
  const look = useMemo(() => {
    const look = new LookInput();
    look.enabled = true;
    return look;
  }, []);
  const [result, setResult] = useState("");
  const [call, setCall] = useState<CreatureCall | null>(null);
  const callSequence = useRef(0);
  const vocalize = (cue: VocalCue) =>
    setCall({ cue, id: ++callSequence.current });
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => {
    let previous = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      if (store.getSnapshot().pending)
        store.tick(Math.min((now - previous) / 1000, 0.25));
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      store.dispose();
    };
  }, [store]);
  const run = async (actions: GameAction[]) => {
    for (const action of actions) {
      const result = await store.run(action);
      setResult(result.message);
      if (!result.ok) break;
      if (action.kind === "vocalize") vocalize(action.cue);
      if (action.kind === "signal_intent") vocalize("effort");
    }
  };
  const emptyHand: GameAction[] = state.holding
    ? [{ kind: "place", item: state.holding, location: "tray" }]
    : [];
  return (
    <main
      style={{
        height: "100dvh",
        width: "100%",
        minWidth: 0,
        display: "grid",
        gridTemplateRows: "minmax(0, 1fr) auto",
        overflow: "hidden",
        background: "#070807",
        color: "#b9af8b",
        fontFamily: "monospace",
      }}
    >
      <div
        style={{
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
          touchAction: "none",
        }}
        onPointerDown={(event) =>
          event.currentTarget.setPointerCapture(event.pointerId)
        }
        onPointerMove={(event) => {
          if (event.buttons) look.move(event.movementX, event.movementY);
        }}
      >
        <SurgeryScene state={state} look={look} call={call} />
      </div>
      <footer
        style={{
          boxSizing: "border-box",
          width: "100%",
          minWidth: 0,
          padding: 12,
          maxHeight: "44dvh",
          overflowY: "auto",
        }}
      >
        <div>
          Room review · Drag to look · {state.stage} ·{" "}
          {state.pending?.label ?? result ?? "Waiting"}
        </div>
        <div
          style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}
        >
          <button
            onClick={() => {
              setCall(null);
              store.reset();
              store.start();
              look.reset();
            }}
          >
            Reset
          </button>
          <button onClick={() => store.pause(!store.getSnapshot().paused)}>
            Pause / resume
          </button>
          <button
            onClick={() => {
              setCall(null);
              store.cancel("Stopped in room review");
            }}
          >
            STOP
          </button>
          <button
            disabled={!!state.pending}
            onClick={() => void run([{ kind: "light_lantern" }])}
          >
            Light lantern
          </button>
          <button
            disabled={!!state.pending}
            onClick={() =>
              void run([
                ...emptyHand,
                { kind: "react", stimulus: "reassure" },
                {
                  kind: "signal_intent",
                  contact: { kind: "lift_debris", style: "gentle" },
                },
                { kind: "lift_debris", style: "gentle" },
              ])
            }
          >
            Lift beam
          </button>
          <button
            disabled={!!state.pending}
            onClick={() =>
              void run([...emptyHand, { kind: "pick_up", item: "forceps" }])
            }
          >
            Take forceps
          </button>
          <button
            disabled={!!state.pending}
            onClick={() => void run(emptyHand)}
          >
            Put down
          </button>
          <button
            disabled={
              !!state.pending || !["covered", "exposed"].includes(state.stage)
            }
            onClick={() => {
              const item = state.stage === "covered" ? "cloth" : "forceps";
              void run([
                ...emptyHand,
                { kind: "adjust_lamp", position: "wound" },
                { kind: "pick_up", item },
                {
                  kind: "signal_intent",
                  contact: {
                    kind: "use",
                    item,
                    target: "wound",
                    style: "gentle",
                  },
                },
                { kind: "use", item, target: "wound", style: "gentle" },
              ]);
            }}
          >
            Treat wound
          </button>
          <button
            onClick={() => {
              look.yaw = -0.72;
              look.pitch = 0.65;
            }}
          >
            Look at son
          </button>
          <button onClick={() => look.reset()}>Look at chest</button>
          {VOCAL_CUES.map((cue) => (
            <button
              key={cue}
              disabled={state.paused}
              onClick={() => vocalize(cue)}
            >
              Mouth · {cue}
            </button>
          ))}
        </div>
      </footer>
    </main>
  );
}
