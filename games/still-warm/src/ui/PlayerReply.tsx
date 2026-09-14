import { useEffect, type FormEvent, type RefObject } from "react";

export const FIRST_INSTRUCTION_PLACEHOLDER = "Speak to him, he can help you";
export const SUBSEQUENT_INSTRUCTION_PLACEHOLDER = "Tell him what to do next";

interface Props {
  inputRef: RefObject<HTMLInputElement>;
  value: string;
  onChange(value: string): void;
  onSubmit(event: FormEvent): void;
  onFocus(): void;
  onBlur(): void;
  voiceSupported: boolean;
  listening: boolean;
  busy: boolean;
  onStopWork(): void;
  onSpeak(): void;
  onStopSpeaking(): void;
  onCancelSpeaking(): void;
  hasSpoken?: boolean;
  placeholder?: string;
}

function focusInput(input: HTMLInputElement | null) {
  if (!document.hidden && (!window.matchMedia || window.matchMedia("(hover: hover) and (pointer: fine)").matches)) {
    input?.focus({ preventScroll: true });
  }
}

export function PlayerReply(props: Props) {
  const { inputRef, busy, listening } = props;
  const placeholder =
    props.placeholder ??
    (props.hasSpoken
      ? SUBSEQUENT_INSTRUCTION_PLACEHOLDER
      : FIRST_INSTRUCTION_PLACEHOLDER);

  // Blur on becoming busy to ensure keyboard drops and no stray keystrokes while fading out
  useEffect(() => {
    if (busy) {
      inputRef.current?.blur();
    }
  }, [busy, inputRef]);

  // Focus input on desktop when idle and ready for the next instruction
  useEffect(() => {
    if (busy || listening) return;
    const focus = () => focusInput(inputRef.current);
    focus();
    const frame = requestAnimationFrame(focus);
    const timer = setTimeout(focus, 160);
    window.addEventListener("focus", focus);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      window.removeEventListener("focus", focus);
    };
  }, [inputRef, busy, listening]);

  return (
    <>
      <form
        className={`command-form ${busy ? "resolving" : ""}`}
        onSubmit={(event) => {
          if (busy) {
            event.preventDefault();
            return;
          }
          props.onSubmit(event);
          focusInput(inputRef.current);
        }}
      >
        <input
          id="player-words"
          ref={props.inputRef}
          aria-label="Your instruction"
          inputMode="text"
          enterKeyHint="send"
          disabled={busy}
          aria-disabled={busy}
          tabIndex={busy ? -1 : 0}
          onFocus={props.onFocus}
          onBlur={props.onBlur}
          value={props.value}
          onChange={(event) => {
            if (busy) return;
            props.onChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (busy) {
              event.preventDefault();
            }
          }}
          maxLength={1000}
          placeholder={placeholder}
          autoComplete="off"
        />
        <button
          aria-label="Send instruction"
          disabled={busy || !props.value.trim()}
          tabIndex={busy ? -1 : 0}
        >
          Send
        </button>
      </form>
      <div className="controls">
        <button
          aria-label="Hold to speak"
          className={`speak-button ${props.listening ? "listening" : ""} ${busy ? "resolving" : ""}`}
          disabled={!props.voiceSupported || busy}
          tabIndex={busy ? -1 : 0}
          onPointerDown={(event) => {
            if (busy || !props.voiceSupported) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            props.onSpeak();
          }}
          onPointerUp={props.onStopSpeaking}
          onPointerCancel={props.onCancelSpeaking}
          onKeyDown={(event) => {
            if (busy) return;
            if (event.code !== "Space" && event.key !== "Enter") return;
            event.preventDefault();
            event.stopPropagation();
            if (!event.repeat) props.onSpeak();
          }}
          onKeyUp={(event) => {
            if (busy) return;
            if (event.code !== "Space" && event.key !== "Enter") return;
            event.preventDefault();
            event.stopPropagation();
            props.onStopSpeaking();
          }}
        >
          {props.listening ? "Listening…" : "Hold to speak"}
        </button>
        <button
          className="stop-control"
          disabled={!props.busy}
          onClick={props.onStopWork}
        >
          Stop
        </button>
        <span>Drag to look</span>
      </div>
    </>
  );
}
