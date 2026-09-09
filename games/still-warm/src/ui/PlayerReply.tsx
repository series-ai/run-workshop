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

function focusDesktopInput(input: HTMLInputElement | null) {
  if (!document.hidden && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
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

  useEffect(() => {
    if (busy || listening) return;
    const focus = () => focusDesktopInput(inputRef.current);
    focus();
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [inputRef, busy, listening]);

  return (
    <>
      <form className="command-form" onSubmit={(event) => {
        props.onSubmit(event);
        focusDesktopInput(inputRef.current);
      }}>
        <input
          id="player-words"
          ref={props.inputRef}
          aria-label="Your instruction"
          inputMode="text"
          enterKeyHint="send"
          onFocus={props.onFocus}
          onBlur={props.onBlur}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          maxLength={1000}
          placeholder={placeholder}
          autoComplete="off"
        />
        <button aria-label="Send instruction" disabled={!props.value.trim()}>Send</button>
      </form>
      <div className="controls">
        <button
          aria-label="Hold to speak"
          className={`speak-button ${props.listening ? "listening" : ""}`}
          disabled={!props.voiceSupported}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            props.onSpeak();
          }}
          onPointerUp={props.onStopSpeaking}
          onPointerCancel={props.onCancelSpeaking}
          onKeyDown={(event) => {
            if (event.code !== "Space" && event.key !== "Enter") return;
            event.preventDefault();
            event.stopPropagation();
            if (!event.repeat) props.onSpeak();
          }}
          onKeyUp={(event) => {
            if (event.code !== "Space" && event.key !== "Enter") return;
            event.preventDefault();
            event.stopPropagation();
            props.onStopSpeaking();
          }}
        >
          {props.listening ? "Listening…" : "Hold to speak"}
        </button>
        <button className="stop-control" disabled={!props.busy} onClick={props.onStopWork}>Stop</button>
        <span>Drag to look</span>
      </div>
    </>
  );
}
