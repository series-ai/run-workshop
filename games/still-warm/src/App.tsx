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
import { canPlayerSpeak, isActionResolving } from "./ui/playerInputState";
import { GameDialog } from "./ui/GameDialog";
import { Awakening } from "./ui/Awakening";
import { defaultWaitingPicker } from "./game/waitingThoughts";
import { WaitingTurn, createWaitingTurn, formatWaitingDots, onAnimationFinished, onFadeComplete, onResponseArrived, onSkipWaiting } from "./ui/waitingTurnState";
import { logConversation } from "./agent/conversationLogger";

export const MEMORY_STOOL = "I was standing on the stool.. reaching above the cabinet. Did I fall?";
export const SENSORY_FIRST_SOUND = "There's a wimper near by. Who is that? Is it.. my boy?";
export const SENSORY_FIRST_SOUND_PULSE =
  "There's a wimper near by...{{pause(2.0)}} Who is that?{{pause(1.5)}} Is it.. my boy?{{pause(2.5)}}";

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
  const stateRef = useRef(state);
  stateRef.current = state;
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
  const [hasInteracted, setHasInteracted] = useState(false);
  const hasInteractedRef = useRef(hasInteracted);
  hasInteractedRef.current = hasInteracted;
  const [hasSpoken, setHasSpoken] = useState(false);
  const hasSpokenRef = useRef(hasSpoken);
  hasSpokenRef.current = hasSpoken;
  const [waitingTurn, setWaitingTurn] = useState<WaitingTurn | null>(null);
  const waitingTurnRef = useRef<WaitingTurn | null>(null);
  waitingTurnRef.current = waitingTurn;
  const [activeResponseText, setActiveResponseText] = useState<string | null>(null);
  const [responseAnimating, setResponseAnimating] = useState(false);
  const [dotCount, setDotCount] = useState(1);
  const wasBusy = useRef(false);
  const busyRef = useRef(false);
  const canSpeakRef = useRef(false);
  const lastResponseId = useRef<number | null>(null);
  const lastEmotion = useRef(state.emotion);
  const lastRoomEventCount = useRef(0);
  const [voice] = useState(
    () =>
      new VoiceInput({
        onFinal: (text) => {
          if (busyRef.current || !canSpeakRef.current) return;
          setInterim("");
          const isFirstSound = !hasSpokenRef.current;
          setHasInteracted(true);
          setHasSpoken(true);
          setHeard(text);
          const waiting = isFirstSound
            ? { full: SENSORY_FIRST_SOUND_PULSE }
            : defaultWaitingPicker.pick(stateRef.current);
          logConversation("WAITING_THOUGHT_STARTED", { thought: waiting.full });
          setWaitingTurn(createWaitingTurn(waiting.full));
          setActiveResponseText(null);
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
          setWaitingTurn(null);
          setResponseAnimating(false);
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
  const hasPendingNarration = waitingTurn !== null || responseAnimating;
  const busy = isActionResolving(connection.status, state.pending, hasPendingNarration);
  busyRef.current = busy;
  const active = started && !state.paused && !terminal && !blackout;
  const canSpeak = canPlayerSpeak({
    active,
    openingComplete: opening.complete,
    mode: connection.mode,
    busy,
  });
  canSpeakRef.current = canSpeak;
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

  const skipWaiting = useCallback(() => {
    const current = waitingTurnRef.current;
    if (!current) return;
    const result = onSkipWaiting(current);
    setWaitingTurn(result.turn);
    if (result.activeResponse !== null) {
      setActiveResponseText(result.activeResponse);
      setResponseAnimating(true);
    }
  }, []);

  const handleWaitingAnimationComplete = useCallback(() => {
    const current = waitingTurnRef.current;
    if (!current) return;
    const result = onAnimationFinished(current);
    setWaitingTurn(result.turn);
    if (result.activeResponse !== null) {
      setActiveResponseText(result.activeResponse);
      setResponseAnimating(true);
    }
  }, []);

  const handleResponseAnimationComplete = useCallback(() => {
    setResponseAnimating(false);
  }, []);

  useEffect(() => {
    if (connection.response && connection.response.id !== lastResponseId.current) {
      lastResponseId.current = connection.response.id;
      const responseText = connection.response.text;
      const current = waitingTurnRef.current;
      const result = onResponseArrived(current, responseText);
      setWaitingTurn(result.turn);
      if (result.activeResponse !== null) {
        setActiveResponseText(result.activeResponse);
        setResponseAnimating(true);
      }
    }
  }, [connection.response]);

  useEffect(() => {
    if (waitingTurn?.phase !== "fading") return;
    const fadeTimer = setTimeout(() => {
      const current = waitingTurnRef.current;
      if (!current || current.phase !== "fading") return;
      const result = onFadeComplete(current);
      setWaitingTurn(result.turn);
      if (result.activeResponse !== null) {
        setActiveResponseText(result.activeResponse);
        setResponseAnimating(true);
      }
    }, reducedMotion ? 0 : 400);
    return () => clearTimeout(fadeTimer);
  }, [waitingTurn?.phase, reducedMotion]);

  useEffect(() => {
    if (waitingTurn?.phase !== "dots") return;
    setDotCount(1);
    const interval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 450);
    return () => clearInterval(interval);
  }, [waitingTurn?.phase]);

  useEffect(() => {
    if (wasBusy.current && !busy) {
      setActiveResponseText(null);
    }
    wasBusy.current = busy;
  }, [busy]);

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
    if (hasSpoken) {
      sound.shuffle();
      if (!liveConversation) {
        vocalize("fear");
        setRoomCaption(SENSORY_FIRST_SOUND);
      }
    }
  }, [hasSpoken, liveConversation, sound, vocalize]);
  useEffect(() => {
    if (!roomCaption) return;
    const duration = roomCaption === SENSORY_FIRST_SOUND ? 4500 : 8500;
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
    setWaitingTurn(null);
    setResponseAnimating(false);
    controller.stop();
  };
  const pause = () => {
    voice.cancel();
    setWaitingTurn(null);
    setResponseAnimating(false);
    controller.pause();
    setTyping(false);
    void fullscreen.release();
  };

  useEffect(() => {
    if (busy) {
      voice.cancel();
    }
  }, [busy, voice]);
  const speak = () => {
    if (!canSpeak || busy) return;
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
        setHasInteracted(true);
        store.tick(openingClickSeconds(store.getSnapshot().elapsed, reducedMotion));
        return;
      }
      if (event.code === "Space" && !interactive && !event.repeat && canSpeak) {
        event.preventDefault();
        setHasInteracted(true);
        silenceCall();
        voice.start();
      }
      if (event.key === "Enter" && !interactive && canSpeak) {
        event.preventDefault();
        setHasInteracted(true);
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
        setHasInteracted(true);
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
      setHasInteracted(true);
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
    setHasInteracted(false);
    setHasSpoken(false);
    setWaitingTurn(null);
    setActiveResponseText(null);
    setResponseAnimating(false);
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
    const isFirstSound = !hasSpoken;
    setHasInteracted(true);
    setHasSpoken(true);
    setHeard("");
    const waiting = isFirstSound
      ? { full: SENSORY_FIRST_SOUND_PULSE }
      : defaultWaitingPicker.pick(state);
    logConversation("WAITING_THOUGHT_STARTED", { thought: waiting.full });
    setWaitingTurn(createWaitingTurn(waiting.full));
    setActiveResponseText(null);
    controller.command(command.trim());
    setCommand("");
  };
  const rehearse = (actions: GameAction[]) => {
    const isFirstSound = !hasSpoken;
    setHasInteracted(true);
    setHasSpoken(true);
    const waiting = isFirstSound
      ? { full: SENSORY_FIRST_SOUND_PULSE }
      : defaultWaitingPicker.pick(state);
    logConversation("WAITING_THOUGHT_STARTED", { thought: waiting.full });
    setWaitingTurn(createWaitingTurn(waiting.full));
    setActiveResponseText(null);
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
          setHasInteracted(true);
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
            setHasInteracted(true);
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
        onClick={() => {
          setHasInteracted(true);
          if (waitingTurn && waitingTurn.phase === "typing") {
            skipWaiting();
          } else if (responseAnimating) {
            setResponseAnimating(false);
          }
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
            onClick={() => {
              setHasInteracted(true);
              store.tick(openingClickSeconds(store.getSnapshot().elapsed, reducedMotion));
            }}
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
          <div
            className={`inner-voice ${!liveConversation && showRoomCaption ? "narrator-voice" : "thought-voice"} ${waitingTurn && waitingTurn.phase === "typing" ? "waiting-skippable" : ""}`}
            aria-live="polite"
            onClick={waitingTurn && waitingTurn.phase === "typing" ? skipWaiting : undefined}
          >
            {waitingTurn?.phase === "dots" ? (
              <div className="waiting-dots-container" aria-label="Waiting for creature...">
                <span className="waiting-dots">
                  <span className="waiting-dots-pulse">{formatWaitingDots(dotCount)}</span>
                </span>
              </div>
            ) : (
              <div className={`waiting-text-wrapper ${waitingTurn?.phase === "fading" ? "fading-out" : ""}`}>
                {waitingTurn?.phase === "fading" ? (
                  <span className="typewriter">{waitingTurn.cleanText}</span>
                ) : (
                  <>
                    <Typewriter
                      paused={state.paused}
                      instant={
                        reducedMotion ||
                        (!waitingTurn &&
                          (liveConversation
                            ? !responseAnimating && !activeResponseText && !connection.response && !hasInteracted
                            : !hasSpoken && !hasInteracted))
                      }
                      onComplete={
                        waitingTurn
                          ? handleWaitingAnimationComplete
                          : responseAnimating
                            ? handleResponseAnimationComplete
                            : undefined
                      }
                      text={
                        waitingTurn
                          ? waitingTurn.rawText
                          : (liveConversation
                            ? activeResponseText ?? connection.response?.text ?? (!hasInteracted ? OPENING_BEATS[0].text : MEMORY_STOOL)
                            : contactOrProblemThought ||
                            roomCaption ||
                            reactionThought ||
                            (!hasSpoken
                              ? (!hasInteracted ? OPENING_BEATS[0].text : MEMORY_STOOL)
                              : thought) ||
                            (connection.needsInstruction && !busy
                              ? "He is waiting for my voice."
                              : ""))
                      }
                    />
                    {waitingTurn && waitingTurn.phase === "typing" && (
                      <button
                        type="button"
                        className="skip-narration-button"
                        onClick={skipWaiting}
                        aria-label="Skip waiting narration"
                      >
                        Skip waiting narration
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
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
              onChange={(value) => {
                setHasInteracted(true);
                setCommand(value);
              }}
              onSubmit={submit}
              onFocus={() => {
                setHasInteracted(true);
                voice.cancel();
                setTyping(true);
              }}
              onBlur={() => setTyping(false)}
              voiceSupported={voice.supported}
              listening={voiceStatus === "listening"}
              busy={busy}
              onStopWork={stop}
              onSpeak={() => {
                setHasInteracted(true);
                speak();
              }}
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
                    setHasInteracted(true);
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
              ? "His hand stays under my head. I can feel each breath. He will not let go."
              : state.outcome === "fire"
                ? "Smoke fills my lungs. His face disappears."
                : state.outcome === "creature_lost"
                  ? "I call for my boy. This time, he does not move."
                  : "My skin is cold. I try to speak, but no sound comes."} />
          </p>
          <button onClick={() => start(connection.mode)}>Begin again</button>
        </GameDialog>
      )}
    </main>
  );
}
