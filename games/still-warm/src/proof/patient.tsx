import { useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { createRoot } from "react-dom/client";
import { PerspectiveCamera } from "three";
import { createInitialState, type GameState, type Stage } from "../game/model";
import { DitherBridge } from "../scene/DitherBridge";
import { Debris } from "../scene/Debris";
import { PatientTorso } from "../scene/PatientTorso";
import { SceneLighting } from "../scene/SceneLighting";
import { PATIENT_LAYOUT } from "../scene/patientLayout";
import { createHandSocket } from "../scene/types";
import "./patient.css";

type PatientView = "first-person" | "overhead";

const STAGES: readonly Stage[] = [
  "pinned",
  "covered",
  "exposed",
  "extracted",
  "closed",
  "dressed",
];

const STAGE_NOTES: Record<Stage, string> = {
  pinned: "The fallen support still covers the wound.",
  covered: "The support is clear. The wound remains covered.",
  exposed: "The incision is open and the fragment is visible.",
  extracted: "The fragment is out. The incision remains open.",
  closed: "The incision is sutured and waiting for a dressing.",
  dressed: "The dressing is in place over the closed wound.",
};

function createPatientFixture(
  stage: Stage,
  dirtyDressing: boolean,
  lowBlood: boolean,
  paused: boolean,
): GameState {
  const initial = createInitialState();
  return {
    ...initial,
    phase: "playing",
    paused,
    stage,
    posture: "supine",
    lamp: "wound",
    patient: {
      ...initial.patient,
      health: lowBlood ? 64 : 86,
      blood: lowBlood ? 28 : 94,
      pain: stage === "dressed" ? 67 : stage === "pinned" ? 36 : 55,
    },
    items: {
      ...initial.items,
      shard: {
        ...initial.items.shard,
        location:
          stage === "pinned" || stage === "covered" || stage === "exposed"
            ? "patient"
            : "tray",
      },
      cloth: {
        ...initial.items.cloth,
        location: stage === "dressed" ? "patient" : "cabinet",
        clean: stage === "dressed" ? !dirtyDressing : true,
      },
      bandage: { ...initial.items.bandage, location: "consumed" },
    },
    environment: { ...initial.environment, lanternLit: true },
  };
}

function ProofCamera({ view }: { view: PatientView }) {
  const camera = useThree((three) => three.camera);

  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const firstPerson = view === "first-person";
    const position: [number, number, number] = firstPerson
      ? [0, 0.48, -0.38]
      : [0, 1.35, 0.16];
    const target: [number, number, number] = firstPerson
      ? [0, PATIENT_LAYOUT.wound[1], PATIENT_LAYOUT.wound[2]]
      : [0, -0.67, 0.06];
    camera.position.set(...position);
    camera.fov = firstPerson ? 58 : 48;
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
  }, [camera, view]);

  return null;
}

function PatientCanvas({
  state,
  view,
  dither,
  breathing,
}: {
  state: GameState;
  view: PatientView;
  dither: boolean;
  breathing: boolean;
}) {
  const socket = useMemo(createHandSocket, []);
  return (
    <div
      className="patient-canvas"
      aria-label={`${dither ? "Dither" : "Raw"} patient view`}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0.48, -0.38], fov: 58, near: 0.03, far: 12 }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#090a09"]} />
        <fog attach="fog" args={["#090a09", 2.4, 7]} />
        <SceneLighting inspection />
        <mesh
          position={[0, -0.9, 0.35]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[3.4, 2.6]} />
          <meshStandardMaterial color="#34362f" roughness={0.9} />
        </mesh>
        <PatientTorso
          key={`torso-${state.stage}`}
          state={state}
          socket={socket}
          reducedMotion={!breathing}
        />
        <Debris key={`debris-${state.stage}`} state={state} socket={socket} />
        <ProofCamera view={view} />
        {dither && (
          <DitherBridge patient={state.patient} reducedMotion={!breathing} />
        )}
      </Canvas>
      <span className="patient-canvas-label">
        {dither ? "Dither" : "Raw shading"}
      </span>
    </div>
  );
}

export default function PatientReview() {
  const [stage, setStage] = useState<Stage>("pinned");
  const [dirtyDressing, setDirtyDressing] = useState(false);
  const [lowBlood, setLowBlood] = useState(false);
  const [view, setView] = useState<PatientView>("first-person");
  const [breathing, setBreathing] = useState(true);
  const [paused, setPaused] = useState(false);
  const state = useMemo(
    () => createPatientFixture(stage, dirtyDressing, lowBlood, paused),
    [dirtyDressing, lowBlood, paused, stage],
  );

  return (
    <main className="patient-page">
      <header className="patient-header">
        <p className="patient-eyebrow">STILL WARM / PATIENT REVIEW</p>
        <h1>Patient body</h1>
        <p className="patient-intro">
          Inspect the actual patient model at each wound stage. The proof uses
          fixed fixtures and has no clock or game actions.
        </p>
      </header>

      <section
        className="patient-controls"
        aria-label="Patient fixture controls"
      >
        <label>
          <span>Stage</span>
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value as Stage)}
          >
            {STAGES.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>
        <div className="patient-control-group">
          <span>Blood</span>
          <div className="patient-buttons">
            <button
              type="button"
              aria-pressed={!lowBlood}
              onClick={() => setLowBlood(false)}
            >
              Normal
            </button>
            <button
              type="button"
              aria-pressed={lowBlood}
              onClick={() => setLowBlood(true)}
            >
              Low
            </button>
          </div>
        </div>
        <div className="patient-control-group">
          <span>View</span>
          <div className="patient-buttons">
            <button
              type="button"
              aria-pressed={view === "first-person"}
              onClick={() => setView("first-person")}
            >
              First person
            </button>
            <button
              type="button"
              aria-pressed={view === "overhead"}
              onClick={() => setView("overhead")}
            >
              Overhead
            </button>
          </div>
        </div>
        <div className="patient-control-group patient-checks">
          <label>
            <input
              type="checkbox"
              checked={dirtyDressing}
              onChange={(event) => setDirtyDressing(event.target.checked)}
              disabled={stage !== "dressed"}
            />
            Dirty dressing
          </label>
          <label>
            <input
              type="checkbox"
              checked={breathing}
              onChange={(event) => setBreathing(event.target.checked)}
            />
            Breathing
          </label>
          <label>
            <input
              type="checkbox"
              checked={paused}
              onChange={(event) => setPaused(event.target.checked)}
            />
            Pause
          </label>
        </div>
      </section>

      <section className="patient-summary" aria-live="polite">
        <strong>{stage}</strong>
        <span>{STAGE_NOTES[stage]}</span>
        <span>Blood {state.patient.blood}%</span>
        {stage === "dressed" && (
          <span>{dirtyDressing ? "Dirty cloth" : "Clean cloth"}</span>
        )}
      </section>

      <section className="patient-panels" aria-label="Patient model comparison">
        <PatientCanvas
          state={state}
          view={view}
          dither={false}
          breathing={breathing}
        />
        <PatientCanvas state={state} view={view} dither breathing={breathing} />
      </section>

      <p className="patient-note">
        Fixed inspection light. Body geometry and wound visibility come from the
        game scene.
      </p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<PatientReview />);
