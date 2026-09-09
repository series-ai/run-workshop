import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderCreatureCall } from "../audio/creatureVoice";
import { SurgerySound } from "../audio/sound";
import { VOCAL_CUES, type VocalCue } from "../game/model";
import "./voice.css";

const NOTES: Record<VocalCue, string> = {
  fear: "Two uncertain calls, separated by a breath.",
  effort: "A sustained strain, followed by a shorter effort.",
  pain: "A short, sharp cry with a weak breath after it.",
  anger: "One low, rough growl.",
  relief: "A quiet, falling exhale.",
};

const RATE = 24000;
const CALLS = VOCAL_CUES.map((cue) => {
  const samples = renderCreatureCall(RATE, cue, 713);
  const peaks: number[] = [];
  let maximum = 0;
  for (let bin = 0; bin < 160; bin++) {
    let peak = 0;
    for (
      let index = Math.floor((bin / 160) * samples.length);
      index < ((bin + 1) / 160) * samples.length;
      index++
    ) {
      peak = Math.max(peak, Math.abs(samples[index]));
    }
    maximum = Math.max(maximum, peak);
    peaks.push(peak);
  }
  return { cue, peaks, seconds: samples.length / RATE, maximum };
});

function VoiceReview() {
  const [sound] = useState(() => new SurgerySound());
  const [muted, setMuted] = useState(true);
  const [active, setActive] = useState<VocalCue | null>(null);
  useEffect(() => () => sound.dispose(), [sound]);
  useEffect(() => {
    if (!active) return;
    const seconds = CALLS.find((call) => call.cue === active)!.seconds;
    const timer = window.setTimeout(
      () => setActive(null),
      seconds * 1000 + 100,
    );
    return () => window.clearTimeout(timer);
  }, [active]);

  async function toggleSound() {
    if (muted) await sound.unlock();
    sound.setMuted(!muted);
    setMuted(!muted);
    setActive(null);
  }

  function stop() {
    sound.stopSpeech();
    setActive(null);
  }

  useEffect(() => {
    const hide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, [sound]);

  return (
    <main>
      <header>
        <p className="eyebrow">STILL WARM / SOUND REVIEW</p>
        <h1>My boy’s voice</h1>
        <p>
          Five wordless calls from the game. No speech synthesis or recordings.
        </p>
        <div className="sound-controls">
          <button type="button" onClick={() => void toggleSound()}>
            {muted ? "Sound off · Enable sound" : "Sound on · Mute"}
          </button>
          <button type="button" onClick={stop} disabled={!active}>
            Stop
          </button>
          <span aria-live="polite">
            {active ? `Playing ${active}` : "Silent"}
          </span>
        </div>
      </header>
      <section aria-label="Creature calls" className="calls">
        {CALLS.map(({ cue, peaks, seconds, maximum }) => (
          <article key={cue}>
            <div className="call-heading">
              <h2>{cue}</h2>
              <span>{seconds.toFixed(2)} seconds</span>
            </div>
            <p>{NOTES[cue]}</p>
            <svg
              viewBox="0 0 320 92"
              role="img"
              aria-label={`${cue} amplitude over time`}
            >
              <path d="M0 46H320" stroke="#43483b" />
              {peaks.map((peak, index) => (
                <path
                  key={index}
                  d={`M${index * 2 + 1} ${46 - peak * 250}v${peak * 500}`}
                  stroke="#b7b99a"
                />
              ))}
            </svg>
            <div className="call-footer">
              <span>Peak {(20 * Math.log10(maximum)).toFixed(1)} dBFS</span>
              <button
                type="button"
                disabled={muted || active === cue}
                onClick={() => {
                  sound.vocalize(cue);
                  setActive(cue);
                }}
              >
                Listen
              </button>
            </div>
          </article>
        ))}
      </section>
      <p className="note">
        Sound is off on load. Enable sound, then select Listen. Each call varies
        slightly. The plots use one fixed sample and the same amplitude scale.
      </p>
      <nav>
        <a href="play.html">Guided preview</a>
        <a href="patient.html">Patient review</a>
        <a href="objects.html">Object review</a>
      </nav>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<VoiceReview />);
