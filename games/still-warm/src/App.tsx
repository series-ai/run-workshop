// @refresh reset
import {
  useEffect,
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FormEvent,
} from "react";
import SurgeryScene from "./scene/SurgeryScene";
import { LookInput } from "./scene/look";
import { sceneThought, previewChoices } from "./game/experience";
import { contactThought, EMOTION_THOUGHTS } from "./game/perception";
import { OPENING_BEATS, openingAt, openingTickSeconds, openingClickSeconds } from "./game/opening";
import { GameStore } from "./game/store";
import { RULE_IDS, RULES, type GameAction, type VocalCue } from "./game/model";
import { CreatureController, type PlayMode } from "./agent/controller";
import { DEFAULT_MUTED, SurgerySound } from "./audio/sound";
import type { CreatureCall } from "./audio/creatureVoice";
import { VoiceInput, type VoiceStatus } from "./audio/voice";
import { FullscreenController } from "./platform/fullscreen";
import { Typewriter } from "./ui/Typewriter";
import { useKeyboardInset } from "./ui/useKeyboardInset";
import { PlayerReply } from "./ui/PlayerReply";
import { GameDialog } from "./ui/GameDialog";
import { Awakening } from "./ui/Awakening";
import { defaultWaitingPicker } from "./game/waitingThoughts";
import { getMonsterResponse } from "./game/monsterResponse";

export default function App({ preview = false }: { preview?: boolean }) {
  const listening = useRef(false);
  const [store] = useState(() => new GameStore());
  const [sound] = useState(() => new SurgerySound());
  const [call, setCall] = useState<CreatureCall | null>(null);
  const callSequence = useRef(0);
  const vocalize = useCallback(
    (cue: VocalCue) => {
      setCall({ cue, id: ++callSequence.current });
      if (!listening.current) sound.vocalize(cue);
    },
    [sound],
  );
  const silenceCall = useCallback(() => {
    sound.stopSpeech();
    setCall(null);
  }, [sound]);
  const [look] = useState(() => new LookInput());
  const [fullscreen] = useState(
    () => new FullscreenController((dx, dy) => look.move(dx, dy), preview),
  );
  const [controller] = useState(
    () =>
      new CreatureController(store, {
        vocalize,
        silence: silenceCall,
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
  const keyboardInset = useKeyboardInset();
  const [muted, setMuted] = useState(DEFAULT_MUTED);
  const [platformReady, setPlatformReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [thought, setThought] = useState("");
  const [roomCaption, setRoomCaption] = useState("");
  const [reactionThought, setReactionThought] = useState("");
  const [heard, setHeard] = useState("");
  const [hasSpoken, setHasSpoken] = useState(false);
  const [waitingThought, setWaitingThought] = useState("");
  const [monsterResponseText, setMonsterResponseText] = useState("");
  const wasBusy = useRef(false);
  const lastResponseId = useRef<number | null>(null);
  const lastEmotion = useRef(state.emotion);
  const lastRoomEventCount = useRef(0);
  const [voice] = useState(
    () =>
      new VoiceInput({
        onFinal: (text) => {
          setInterim("");
          setHasSpoken(true);
          setHeard(text);
          const waiting = defaultWaitingPicker.pick();
          setWaitingThought(waiting.full);
          setMonsterResponseText("");
          controller.command(text);
        },
        onInterim: setInterim,
        onStatus: (status, error) => {
          listening.current = status === "listening";
          setVoiceStatus(status);
          setVoiceError(error);
        },
        onStop: () => {
          setHeard("");
          controller.stop();
        },
      }),
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const started = state.phase !== "ready";
  const opening = openingAt(state.elapsed);
  const introPlaying = started && !opening.complete;
  const lastOpeningShuffle = useRef(false);
  const terminal = state.phase === "won" || state.phase === "lost";
  const blackout = state.phase === "blackout";
  const busy = ["thinking", "acting", "stopping"].includes(connection.status);
  const active = started && !state.paused && !terminal && !blackout;
  const canSpeak = active && opening.complete && connection.mode === "live";
  const liveConversation = connection.mode === "live";
  const moment = sceneThought(state);
  const choices = previewChoices(state);
  const intent = state.declaredContact
    ? contactThought(state.declaredContact, state)
    : "";
  const contactOrProblemThought = state.problem?.thought || intent;
  const showRoomCaption = Boolean(roomCaption && !contactOrProblemThought);
  const toggleSound = () => {
    sound.setMuted(!muted);
    setMuted(!muted);
    if (muted) void sound.unlock();
  };

  useEffect(() => {
    let mounted = true;
    void fullscreen.initialize().then(() => {
      if (mounted) setPlatformReady(true);
    });
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      store.tick(openingTickSeconds(store.getSnapshot().elapsed, Math.min((now - previous) / 1000, 0.25)));
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
      mounted = false;
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
      silenceCall();
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
    silenceCall,
    terminal,
    typing,
    voice,
  ]);
  useEffect(() => {
    if (liveConversation || !started || !opening.complete) return;
    setThought(moment.text);
  }, [liveConversation, started, moment.id, moment.text, opening.complete]);

  useEffect(() => {
    if (connection.response && connection.response.id !== lastResponseId.current) {
      lastResponseId.current = connection.response.id;
      setWaitingThought("");
      const isWordy = /["“”]/.test(connection.response.text) || connection.response.text.length > 120;
      const resp = isWordy ? getMonsterResponse(state.emotion) : null;
      const text = resp ? resp.text : connection.response.text;
      setMonsterResponseText(text);
      if (resp) {
        vocalize(resp.cue);
      }
    }
  }, [connection.response, state.emotion, vocalize]);

  useEffect(() => {
    if (busy) {
      wasBusy.current = true;
    } else if (wasBusy.current) {
      wasBusy.current = false;
      if (waitingThought) {
        const resp = getMonsterResponse(state.emotion);
        setWaitingThought("");
        setMonsterResponseText(resp.text);
        vocalize(resp.cue);
      }
    }
  }, [busy, waitingThought, state.emotion, vocalize]);

  useEffect(() => {
    if (!monsterResponseText) return;
    const timer = setTimeout(() => setMonsterResponseText(""), 7000);
    return () => clearTimeout(timer);
  }, [monsterResponseText]);
  useEffect(() => {
    if (!heard) return;
    const timer = setTimeout(() => setHeard(""), 5000);
    return () => clearTimeout(timer);
  }, [heard]);
  useEffect(() => {
    const changed = lastEmotion.current !== state.emotion;
    lastEmotion.current = state.emotion;
    if (liveConversation || !started || !opening.complete || !changed) return;
    setReactionThought(EMOTION_THOUGHTS[state.emotion]);
    const timer = setTimeout(() => setReactionThought(""), 6500);
    return () => clearTimeout(timer);
  }, [liveConversation, started, opening.complete, state.emotion]);
  useEffect(() => {
    if (liveConversation) return;
    const events = state.environment.events;
    if (!events.length) {
      lastRoomEventCount.current = 0;
      setRoomCaption("");
      return;
    }
    const arrived = events.slice(lastRoomEventCount.current);
    lastRoomEventCount.current = events.length;
    if (!arrived.length) return;
    setRoomCaption(
      arrived
        .map((event) =>
          event.kind === "fire"
            ? "Glass breaks. Something catches fire."
            : "Heavy blows at the cellar door.",
        )
        .join(" "),
    );
  }, [liveConversation, state.environment.events]);
  useEffect(() => {
    if (!started) lastOpeningShuffle.current = false;
    if (
      started &&
      !state.paused &&
      opening.shuffle &&
      !lastOpeningShuffle.current
    ) {
      lastOpeningShuffle.current = true;
      sound.shuffle();
    }
  }, [started, state.paused, opening.shuffle, sound]);
  useEffect(() => {
    if (hasSpoken && !liveConversation) {
      vocalize("fear");
      setRoomCaption("A low moan in the darkness.");
    }
  }, [hasSpoken, liveConversation, vocalize]);
  useEffect(() => {
    if (!roomCaption) return;
    const duration = roomCaption === "A low moan in the darkness." ? 3500 : 8500;
    const timer = setTimeout(() => setRoomCaption(""), duration);
    return () => clearTimeout(timer);
  }, [roomCaption]);
  useEffect(() => {
    if (typing) inputRef.current?.focus();
  }, [typing]);

  const stop = () => {
    setHeard("");
    setCommand("");
    voice.cancel();
    controller.stop();
  };
  const pause = () => {
    voice.cancel();
    controller.pause();
    setTyping(false);
    void fullscreen.release();
  };
  const speak = () => {
    if (!canSpeak) return;
    silenceCall();
    voice.start();
  };
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const interactive =
        event.target instanceof HTMLElement &&
        !!event.target.closest(
          "input, textarea, button, select, summary, a, [contenteditable]",
        );
      if (event.key === "Escape") {
        event.preventDefault();
        voice.cancel();
        controller.pause();
        setTyping(false);
        void fullscreen.release();
        return;
      }
      if (introPlaying && active && !interactive && !event.repeat &&
          (event.code === "Space" || event.key === "Enter")) {
        event.preventDefault();
        store.tick(openingClickSeconds(store.getSnapshot().elapsed, reducedMotion));
        return;
      }
      if (event.code === "Space" && !interactive && !event.repeat && canSpeak) {
        event.preventDefault();
        silenceCall();
        voice.start();
      }
      if (event.key === "Enter" && !interactive && canSpeak) {
        event.preventDefault();
        voice.cancel();
        setTyping(true);
        void fullscreen.release();
      }
      if (
        (event.key === "ArrowLeft" ||
          event.key === "ArrowRight" ||
          event.key === "ArrowUp" ||
          event.key === "ArrowDown") &&
        !interactive &&
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
  }, [active, canSpeak, controller, fullscreen, look, silenceCall, voice, introPlaying, reducedMotion, store]);

  useEffect(() => {
    if (!introPlaying || !active || !screen.pointerLocked) return;
    const advance = (event: MouseEvent) => {
      if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button"))) return;
      store.tick(openingClickSeconds(store.getSnapshot().elapsed, reducedMotion));
    };
    window.addEventListener("click", advance);
    return () => window.removeEventListener("click", advance);
  }, [introPlaying, active, screen.pointerLocked, reducedMotion, store]);

  const start = (mode: PlayMode) => {
    void fullscreen.enter(false);
    void sound.unlock();
    voice.cancel();
    look.reset();
    lastOpeningShuffle.current = false;
    setHasSpoken(false);
    setWaitingThought("");
    setMonsterResponseText("");
    setHeard("");
    setCommand("");
    setReactionThought("");
    setTyping(false);
    void controller.start(mode);
  };
  const resume = () => {
    controller.resume();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!command.trim() || !canSpeak) return;
    setHasSpoken(true);
    setHeard("");
    const waiting = defaultWaitingPicker.pick();
    setWaitingThought(waiting.full);
    setMonsterResponseText("");
    controller.command(command.trim());
    setCommand("");
  };
  const rehearse = (actions: GameAction[]) => {
    setHasSpoken(true);
    const waiting = defaultWaitingPicker.pick();
    setWaitingThought(waiting.full);
    setMonsterResponseText("");
    controller.resume();
    void controller.rehearse(actions);
  };

  return (
    <main
      className={`game-shell ${connection.mode === "rehearsal" ? "guided-preview" : ""} ${started ? "in-operation" : "at-title"} ${reducedMotion ? "reduce-motion" : ""}`}
      style={
        {
          "--keyboard-inset": `${keyboardInset}px`,
          "--pain": state.patient.pain / 100,
          "--blood-loss": (100 - state.patient.blood) / 100,
          "--sedation": state.patient.sedation / 100,
          "--run-safe-top": `${screen.safeArea.top}px`,
          "--run-safe-right": `${screen.safeArea.right}px`,
          "--run-safe-bottom": `${screen.safeArea.bottom}px`,
          "--run-safe-left": `${screen.safeArea.left}px`,
        } as CSSProperties
      }
    >
      <div
        className="scene-wrap"
        tabIndex={0}
        aria-label="The cellar. Drag to look around."
        onPointerDown={(event) => {
          if (!active) return;
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
          };

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
        <SurgeryScene
          state={state}
          look={look}
          call={call}
          reducedMotion={reducedMotion}
        />
      </div>
      {(!started || introPlaying) && (
        <Awakening
          targetProgress={started ? opening.eyes : 0}
          reducedMotion={reducedMotion}
        />
      )}
      {introPlaying && (
        <section className="opening-story" aria-live="polite">
          <button
            className="opening-advance"
            aria-label="Reveal text or continue"
            disabled={!active}
            onClick={() => store.tick(openingClickSeconds(store.getSnapshot().elapsed, reducedMotion))}
          />
          {opening.narration && (
            <p className={`opening-narration ${opening.voice}-voice`} key={opening.narration}>
              <Typewriter
                text={opening.narration}
                seconds={opening.age}
                paused={state.paused}
                instant={reducedMotion}
              />
            </p>
          )}
          <span className="opening-click-hint" aria-hidden="true"><span className="fine-pointer">Click to continue</span><span className="coarse-pointer">Tap to continue</span></span>

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
          <p className="eyebrow">
            <Typewriter
              text="IN THE DARK, *IT* IS..."
              instant={reducedMotion}
            />
          </p>
          <h1>
            <Typewriter text="Still Warm" instant={reducedMotion} />
          </h1>
          <p className="premise">
            <Typewriter
              text="But you are slowly bleeding out."
              instant={reducedMotion}
            />
          </p>
          <button
            className="sound-choice"
            aria-pressed={!muted}
            onClick={toggleSound}
          >
            {muted ? "Sound off · Enable sound" : "Sound on · Mute"}
          </button>
          <button
            className="begin"
            disabled={!platformReady}
            aria-busy={!platformReady}
            onClick={() => start(preview ? "rehearsal" : "live")}
          >
            Begin
          </button>
          {!platformReady && (
            <p className="preview-note">Preparing the room…</p>
          )}
          {preview && (
            <p className="preview-note">Guided preview · No model connection</p>
          )}
          <p className="title-controls">
            {preview
              ? "Drag to look. Choose what to say. Select Stop to stop his hands."
              : "Type or hold to speak."}
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
          <div className={`inner-voice ${!liveConversation && showRoomCaption ? "narrator-voice" : "thought-voice"}`} aria-live="polite">
            <Typewriter
              paused={state.paused}
              instant={reducedMotion || (!waitingThought && !monsterResponseText && (liveConversation ? !connection.response : !hasSpoken))}
              text={
                waitingThought ||
                monsterResponseText ||
                (liveConversation
                  ? connection.response?.text ?? OPENING_BEATS[OPENING_BEATS.length - 1].text
                  : contactOrProblemThought ||
                  roomCaption ||
                  reactionThought ||
                  (!hasSpoken ? OPENING_BEATS[OPENING_BEATS.length - 1].text : thought) ||
                  (connection.needsInstruction && !busy
                    ? "He is waiting for my voice."
                    : ""))
              }
            />
          </div>
          {(interim || heard) && (
            <p className="transcript" aria-live="polite">
              {interim || (
                <Typewriter
                  text={`“${heard}”`}
                  paused={state.paused}
                  instant={reducedMotion}
                />
              )}
            </p>
          )}
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
          {connection.mode === "live" ? (
            <PlayerReply
              inputRef={inputRef}
              value={command}
              onChange={setCommand}
              onSubmit={submit}
              onFocus={() => { voice.cancel(); setTyping(true); }}
              onBlur={() => setTyping(false)}
              voiceSupported={voice.supported}
              listening={voiceStatus === "listening"}
              busy={busy}
              onStopWork={stop}
              onSpeak={speak}
              onStopSpeaking={() => voice.stop()}
              onCancelSpeaking={() => voice.cancel()}
              hasSpoken={hasSpoken}
            />
          ) : (
            <div className="controls"><span>Guided preview · Choose an instruction</span></div>
          )}
          {connection.mode === "rehearsal" && !busy && (
            <div className="preview-choices" aria-label="What to say">
              {choices.map((choice) => (
                <button
                  key={choice.id}
                  onClick={() => {
                    setHasSpoken(true);
                    rehearse(choice.actions);
                  }}
                >
                  <span aria-hidden="true" className="reply-marker">›</span>
                  <Typewriter text={choice.label} instant={reducedMotion} />
                  <span aria-hidden="true" className="reply-send">↵</span>
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
          {busy && connection.mode === "rehearsal" && (
            <button className="stop-button" onClick={stop}>
              Stop
            </button>
          )}
        </>
      )}
      {blackout && !state.paused && (
        <div className="blackout-cover">
          <p>
            <Typewriter text={state.rules.waitBlackout
              ? "He should be waiting."
              : "I can still hear him."} instant={reducedMotion} />
          </p>
          <button onClick={stop}>Stop</button>
          <button className="blackout-pause" onClick={pause}>
            Pause operation
          </button>
        </div>
      )}
      {connection.status === "connecting" && (
        <GameDialog label="Connecting to RUN">
          <p>Listen.</p>
          <p className="small">Connecting to RUN…</p>
          <button onClick={() => start("rehearsal")}>
            Use offline rehearsal
          </button>
        </GameDialog>
      )}
      {connection.status === "error" && (
        <GameDialog label="Connection interrupted">
          <h2>He cannot hear you.</h2>
          <p>{connection.error}</p>
          {connection.canResume && (
            <button onClick={resume}>Continue this operation</button>
          )}
          <button onClick={() => start(preview ? "rehearsal" : "live")}>
            Start again
          </button>
        </GameDialog>
      )}
      {state.paused &&
        started &&
        !terminal &&
        connection.status !== "connecting" &&
        connection.status !== "error" && (
          <GameDialog label="Operation paused">
            <h2>Take a breath.</h2>
            <button
              onClick={resume}
              disabled={connection.status === "stopping"}
            >
              {connection.status === "stopping" ? "Stopping…" : "Continue"}
            </button>
            {screen.supported && (
              <button
                onClick={() =>
                  void fullscreen.enter(false)
                }
              >
                Fullscreen
              </button>
            )}
            <button onClick={toggleSound}>
              {muted ? "Enable sound" : "Mute sound"}
            </button>
            <button onClick={() => setReducedMotion(!reducedMotion)}>
              {reducedMotion ? "Enable motion" : "Reduce motion"}
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
              Drag or use arrow keys to look. Hold Space to speak. Say “stop” to
              stop his hands. Escape pauses.
            </p>
          </GameDialog>
        )}
      {terminal && (
        <GameDialog label="Operation ended" ending>
          <h2>
            <Typewriter instant={reducedMotion} text={state.outcome === "saved"
              ? "Still warm."
              : state.outcome === "creature_lost"
                ? "No answer."
                : "The room goes quiet."} />
          </h2>
          <p>
            <Typewriter instant={reducedMotion} text={state.outcome === "saved"
              ? "His hand stays under your head. You can feel each breath. He will not let go."
              : state.outcome === "fire"
                ? "Smoke fills your lungs. His face disappears."
                : state.outcome === "creature_lost"
                  ? "I call for my boy. This time, he does not move."
                  : "Your skin is cold. You try to speak, but no sound comes."} />
          </p>
          <button onClick={() => start(connection.mode)}>Begin again</button>
        </GameDialog>
      )}
    </main>
  );
}
