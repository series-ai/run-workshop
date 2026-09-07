// @refresh reset
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FormEvent,
} from "react";
import SurgeryScene from "./scene/SurgeryScene";
import { LookInput } from "./scene/look";
import { sceneThought, previewChoices } from "./game/experience";
import { openingAt } from "./game/opening";
import { GameStore } from "./game/store";
import { RULE_IDS, RULES, type GameAction } from "./game/model";
import { CreatureController, type PlayMode } from "./agent/controller";
import { DEFAULT_MUTED, SurgerySound } from "./audio/sound";
import { VoiceInput, type VoiceStatus } from "./audio/voice";
import { FullscreenController } from "./platform/fullscreen";

export default function App({ preview = false }: { preview?: boolean }) {
  const listening = useRef(false);
  const [store] = useState(() => new GameStore());
  const [sound] = useState(() => new SurgerySound());
  const [look] = useState(() => new LookInput());
  const [fullscreen] = useState(
    () => new FullscreenController((dx, dy) => look.move(dx, dy), preview),
  );
  const [controller] = useState(
    () =>
      new CreatureController(store, {
        speak: (text) => {
          if (!listening.current) sound.speak(text);
        },
        silence: () => sound.stopSpeech(),
      }),
  );
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const connection = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  const screen = useSyncExternalStore(
    fullscreen.subscribe,
    fullscreen.getSnapshot,
  );
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [interim, setInterim] = useState("");
  const [command, setCommand] = useState("");
  const [typing, setTyping] = useState(false);
  const [muted, setMuted] = useState(DEFAULT_MUTED);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [thought, setThought] = useState("");
  const [roomCaption, setRoomCaption] = useState("");
  const [voice] = useState(
    () =>
      new VoiceInput({
        onFinal: (text) => {
          setInterim("");
          controller.command(text);
        },
        onInterim: setInterim,
        onStatus: (status, error) => {
          listening.current = status === "listening";
          setVoiceStatus(status);
          setVoiceError(error);
        },
        onStop: () => controller.stop(),
      }),
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const hadPointerLock = useRef(false);
  const started = state.phase !== "ready";
  const opening = openingAt(state.elapsed);
  const introPlaying = started && !opening.complete;
  const lastOpeningCall = useRef(0);
  const terminal = state.phase === "won" || state.phase === "lost";
  const blackout = state.phase === "blackout";
  const busy = ["thinking", "acting", "stopping"].includes(connection.status);
  const active = started && !state.paused && !terminal && !blackout;
  const canSpeak = active && opening.complete && connection.mode === "live";
  const moment = sceneThought(state);
  const choices = previewChoices(state);
  const toggleSound = () => {
    sound.setMuted(!muted);
    setMuted(!muted);
    if (muted) void sound.unlock();
  };

  useEffect(() => {
    const released = hadPointerLock.current && !screen.pointerLocked;
    hadPointerLock.current = screen.pointerLocked;
    if (released && active && !typing) {
      voice.cancel();
      controller.pause();
    }
  }, [active, controller, screen.pointerLocked, typing, voice]);

  useEffect(() => {
    void fullscreen.initialize();
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      store.tick(Math.min((now - previous) / 1000, 0.25));
      previous = now;
      if (openingAt(store.getSnapshot().elapsed).complete)
        controller.observeEvents();
    }, 100);
    const hide = () => {
      if (document.hidden) {
        voice.cancel();
        controller.pause();
        void fullscreen.release();
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", hide);
      voice.dispose();
      sound.dispose();
      store.dispose();
      fullscreen.dispose();
      void controller.dispose();
    };
  }, [controller, fullscreen, sound, store, voice]);
  useEffect(() => {
    sound.update(state);
  }, [sound, state]);
  useEffect(() => {
    look.enabled = active && !typing && opening.eyes > 0;
    if (!active) {
      voice.cancel();
      sound.stopSpeech();
      void fullscreen.release();
    }
    if (terminal) controller.stop();
  }, [
    active,
    controller,
    fullscreen,
    look,
    opening.eyes,
    sound,
    terminal,
    typing,
    voice,
  ]);
  useEffect(() => {
    if (!started || !opening.complete) return;
    setThought(moment.text);
    if (moment.id === "light") return;
    const timer = setTimeout(() => setThought(""), 10000);
    return () => clearTimeout(timer);
  }, [started, moment.id, moment.text, opening.complete]);
  useEffect(() => {
    if (!state.environment.eventCount) {
      setRoomCaption("");
      return;
    }
    setRoomCaption(
      state.environment.lastEvent?.includes("fire")
        ? "Glass breaks. Something catches fire."
        : "Heavy blows at the cellar door.",
    );
    const timer = setTimeout(() => setRoomCaption(""), 8500);
    return () => clearTimeout(timer);
  }, [state.environment.eventCount]);
  useEffect(() => {
    if (!started) lastOpeningCall.current = 0;
    if (
      started &&
      !state.paused &&
      opening.call &&
      opening.call !== lastOpeningCall.current
    ) {
      lastOpeningCall.current = opening.call;
      sound.call();
    }
  }, [started, state.paused, opening.call, sound]);
  useEffect(() => {
    if (typing) inputRef.current?.focus();
  }, [typing]);

  const stop = () => {
    voice.cancel();
    controller.stop();
  };
  const pause = () => {
    voice.cancel();
    controller.pause();
    setTyping(false);
    void fullscreen.release();
  };
  const openTyping = () => {
    if (!canSpeak) return;
    voice.cancel();
    setTyping(true);
    void fullscreen.release();
  };
  const speak = () => {
    if (!canSpeak) return;
    sound.stopSpeech();
    voice.start();
  };
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const input = event.target instanceof HTMLInputElement;
      if (event.key === "Escape") {
        event.preventDefault();
        voice.cancel();
        controller.pause();
        setTyping(false);
        void fullscreen.release();
        return;
      }
      if (event.code === "Space" && !input && !event.repeat && canSpeak) {
        event.preventDefault();
        sound.stopSpeech();
        voice.start();
      }
      if (event.key === "Enter" && !input && canSpeak) {
        event.preventDefault();
        setTyping(true);
        void fullscreen.release();
      }
      if (
        (event.key === "ArrowLeft" ||
          event.key === "ArrowRight" ||
          event.key === "ArrowUp" ||
          event.key === "ArrowDown") &&
        !input &&
        active
      ) {
        event.preventDefault();
        look.move(
          event.key === "ArrowLeft" ? -22 : event.key === "ArrowRight" ? 22 : 0,
          event.key === "ArrowUp" ? -22 : event.key === "ArrowDown" ? 22 : 0,
        );
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") voice.stop();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [active, canSpeak, controller, fullscreen, look, sound, voice]);

  const start = (mode: PlayMode) => {
    void fullscreen.enter(mode === "live");
    void sound.unlock();
    voice.cancel();
    look.reset();
    lastOpeningCall.current = 0;
    setTyping(false);
    void controller.start(mode);
  };
  const resume = () => {
    if (connection.mode === "live") void fullscreen.capture();
    controller.resume();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!command.trim() || !canSpeak) return;
    controller.command(command);
    setCommand("");
    setTyping(false);
    void fullscreen.capture();
  };
  const rehearse = (actions: GameAction[]) => {
    controller.resume();
    void controller.rehearse(actions);
  };

  return (
    <main
      className={`game-shell ${connection.mode === "rehearsal" ? "guided-preview" : ""} ${started ? "in-operation" : "at-title"} ${reducedMotion ? "reduce-motion" : ""}`}
      style={
        {
          "--pain": state.patient.pain / 100,
          "--blood-loss": (100 - state.patient.blood) / 100,
          "--sedation": state.patient.sedation / 100,
        } as CSSProperties
      }
    >
      <div
        className="scene-wrap"
        tabIndex={0}
        aria-label="The cellar. Drag to look around."
        onPointerDown={(event) => {
          if (!active || typing) return;
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
          };
          if (
            event.pointerType === "mouse" &&
            connection.mode === "live" &&
            screen.active &&
            !screen.pointerLocked
          )
            void fullscreen.capture();
        }}
        onPointerMove={(event) => {
          if (!active || typing || screen.pointerLocked) return;
          const p = drag.current;
          if (p && p.id === event.pointerId) {
            look.move(event.clientX - p.x, event.clientY - p.y);
            p.x = event.clientX;
            p.y = event.clientY;
          }
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <SurgeryScene state={state} look={look} reducedMotion={reducedMotion} />
      </div>
      {(!started || introPlaying) && (
        <div
          className="awakening"
          aria-hidden="true"
          style={{ "--eye-open": started ? opening.eyes : 0 } as CSSProperties}
        >
          <div className="eyelid upper" />
          <div className="eyelid lower" />
        </div>
      )}
      {introPlaying && (
        <section className="opening-story" aria-live="polite">
          {opening.narration && (
            <p className="opening-narration" key={opening.narration}>
              {opening.narration}
            </p>
          )}
        </section>
      )}
      <div className="vignette" aria-hidden="true" />
      <div className="screen-grain" aria-hidden="true" />
      {started && <div className="blood-loss" aria-hidden="true" />}
      {started && !terminal && state.patient.sedation > 35 && (
        <div className="hallucination" aria-hidden="true">
          <span>don't leave me here</span>
        </div>
      )}
      {!started && connection.status !== "connecting" && (
        <section className="intro">
          <p className="eyebrow">A FATHER. A SON. SOMETHING LEFT UNFINISHED.</p>
          <h1>Still Warm</h1>
          <p className="premise">You can hear him in the dark.</p>
          <button
            className="sound-choice"
            aria-pressed={!muted}
            onClick={toggleSound}
          >
            {muted ? "Sound off · Enable sound" : "Sound on · Mute"}
          </button>
          <button
            className="begin"
            onClick={() => start(preview ? "rehearsal" : "live")}
          >
            Begin
          </button>
          {preview ? (
            <p className="preview-note">Guided preview · No model connection</p>
          ) : (
            <button className="quiet" onClick={() => start("rehearsal")}>
              Offline rehearsal
            </button>
          )}
          <p className="title-controls">
            {preview
              ? "Drag to look. Choose what to say. Select Stop to stop his hands."
              : "Look around. Speak to him. Say “stop” at any time."}
          </p>
        </section>
      )}
      {started && !terminal && (
        <button
          className="sound-toggle"
          aria-pressed={!muted}
          onClick={toggleSound}
        >
          {muted ? "Sound off" : "Sound on"}
        </button>
      )}
      {active && !introPlaying && (
        <>
          <button
            className="pause-button"
            aria-label="Pause operation"
            onClick={pause}
          >
            Ⅱ
          </button>
          <div className="inner-voice" aria-live="polite">
            {thought ||
              (connection.needsInstruction && !busy
                ? "He is waiting for my voice."
                : "")}
          </div>
          {roomCaption && (
            <p className="room-caption" role="status">
              {roomCaption}
            </p>
          )}
          {interim && <p className="transcript">{interim}</p>}
          {connection.mode === "rehearsal" && connection.error && (
            <p className="voice-error" role="status">
              {connection.error}
            </p>
          )}
          {voiceError && (
            <p className="voice-error" role="status">
              {voiceError} Press Enter to type.
            </p>
          )}
          {typing ? (
            <form className="command-form" onSubmit={submit}>
              <input
                ref={inputRef}
                aria-label="Instruction for the creature"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                maxLength={1000}
                placeholder="Say it quietly…"
                autoComplete="off"
              />
              <button aria-label="Send instruction" disabled={!command.trim()}>
                ↵
              </button>
            </form>
          ) : (
            <div
              className={`controls ${connection.turns > 0 ? "subdued" : ""}`}
            >
              {connection.mode === "live" ? (
                <>
                  <button
                    aria-label="Hold to speak"
                    className={voiceStatus === "listening" ? "listening" : ""}
                    disabled={!voice.supported}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      speak();
                    }}
                    onPointerUp={() => voice.stop()}
                    onPointerCancel={() => voice.cancel()}
                  >
                    {voiceStatus === "listening"
                      ? "Listening…"
                      : "Hold Space to speak"}
                  </button>
                  <span>·</span>
                  <button onClick={openTyping}>Enter to type</button>
                  <span>·</span>
                  <span>Drag to look</span>
                </>
              ) : (
                <span>Guided preview · Choose what to say</span>
              )}
            </div>
          )}
          {connection.mode === "rehearsal" && !busy && (
            <div className="preview-choices" aria-label="What to say">
              {choices.map((choice) => (
                <button
                  key={choice.id}
                  onClick={() => {
                    setThought(`“${choice.label}”`);
                    rehearse(choice.actions);
                  }}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          )}
          {connection.mode === "live" &&
            connection.needsInstruction &&
            !busy && (
              <button
                className="continue-task"
                onClick={() =>
                  controller.command(
                    "Continue the task I gave you. Keep all my standing rules.",
                  )
                }
              >
                Keep going.
              </button>
            )}
          {busy && (
            <button className="stop-button" onClick={stop}>
              Stop
            </button>
          )}
        </>
      )}
      {blackout && !state.paused && (
        <div className="blackout-cover">
          <p>
            {state.rules.waitBlackout
              ? "He promised to wait."
              : "I can still hear him."}
          </p>
          <button onClick={stop}>Stop</button>
        </div>
      )}
      {connection.status === "connecting" && (
        <div className="modal-shade">
          <section className="modal">
            <p>Listen.</p>
            <p className="small">Connecting to RUN…</p>
            <button onClick={() => start("rehearsal")}>
              Use offline rehearsal
            </button>
          </section>
        </div>
      )}
      {connection.status === "error" && (
        <div className="modal-shade">
          <section className="modal">
            <h2>He cannot hear you.</h2>
            <p>{connection.error}</p>
            {connection.canResume && (
              <button onClick={resume}>Continue this operation</button>
            )}
            <button onClick={() => start(preview ? "rehearsal" : "live")}>
              Start again
            </button>
          </section>
        </div>
      )}
      {state.paused &&
        started &&
        !terminal &&
        connection.status !== "error" && (
          <div className="modal-shade">
            <section className="modal">
              <h2>Take a breath.</h2>
              <button onClick={resume}>Continue</button>
              {screen.supported && (
                <button
                  onClick={() =>
                    void fullscreen.enter(connection.mode === "live")
                  }
                >
                  Fullscreen
                </button>
              )}
              <button onClick={toggleSound}>
                {muted ? "Enable sound" : "Mute sound"}
              </button>
              <button onClick={() => setReducedMotion(!reducedMotion)}>
                {reducedMotion
                  ? "Enable camera motion"
                  : "Reduce camera motion"}
              </button>
              <details>
                <summary>Standing rules</summary>
                {RULE_IDS.map((rule) => (
                  <button
                    key={rule}
                    aria-pressed={state.rules[rule]}
                    onClick={() => {
                      controller.resume();
                      controller.changeRule(rule, !state.rules[rule]);
                      controller.pause();
                    }}
                  >
                    {state.rules[rule] ? "✓" : "—"} {RULES[rule].label}
                  </button>
                ))}
              </details>
              <button onClick={() => start(preview ? "rehearsal" : "live")}>
                Start a new operation
              </button>
              <p className="small">
                Drag or use arrow keys to look. Hold Space to speak. Say “stop”
                to stop his hands. Escape pauses.
              </p>
            </section>
          </div>
        )}
      {terminal && (
        <div className="modal-shade ending">
          <section className="modal">
            <h2>
              {state.outcome === "saved"
                ? "Still warm."
                : state.outcome === "creature_lost"
                  ? "No answer."
                  : "The room goes quiet."}
            </h2>
            <p>
              {state.outcome === "saved"
                ? "His hand stays under your head. You can feel each breath. He will not let go."
                : state.outcome === "fire"
                  ? "Smoke fills your lungs. His face disappears."
                  : state.outcome === "creature_lost"
                    ? "You call for your son. This time, he does not move."
                    : "Your skin is cold. You try to speak, but no sound comes."}
            </p>
            <button onClick={() => start(connection.mode)}>Begin again</button>
          </section>
        </div>
      )}
    </main>
  );
}
