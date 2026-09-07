import { Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import {
  ProviderAssistant,
  RAW_CLIPS,
  type RawClip,
  type ClipInfo,
} from "./ProviderAssistant";
import "./proof.css";

const VIEWS = {
  front: [0, 1.15, 4.3],
  side: [4.3, 1.15, 0],
  back: [0, 1.15, -4.3],
} satisfies Record<string, [number, number, number]>;

function CameraView({ view }: { view: keyof typeof VIEWS }) {
  const camera = useThree((state) => state.camera);
  useEffect(
    function selectCameraView() {
      camera.position.set(...VIEWS[view]);
      camera.lookAt(0, 1.05, 0);
    },
    [camera, view],
  );
  return null;
}

function RawAnimationProof() {
  const [clip, setClip] = useState<RawClip>("idle");
  const [paused, setPaused] = useState(false);
  const [repeat, setRepeat] = useState(true);
  const [rate, setRate] = useState(1);
  const [restart, setRestart] = useState(0);
  const [view, setView] = useState<keyof typeof VIEWS>("front");
  const [info, setInfo] = useState<ClipInfo | null>(null);
  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">STILL WARM / SOURCE REVIEW</p>
          <h1>Original animation files</h1>
        </div>
        <span className="local">NO RUN SIGN-IN REQUIRED</span>
      </header>
      <div className="layout">
        <aside>
          <h2>Provider responses</h2>
          <div className="clip-list">
            {(Object.keys(RAW_CLIPS) as RawClip[]).map((id) => (
              <button
                className="sequence"
                key={id}
                aria-pressed={clip === id}
                onClick={() => {
                  setClip(id);
                  setInfo(null);
                  setPaused(false);
                  setRestart((n) => n + 1);
                }}
              >
                {RAW_CLIPS[id].label}
                <small>{RAW_CLIPS[id].category}</small>
              </button>
            ))}
          </div>
          <p className="clip-purpose">{RAW_CLIPS[clip].note}</p>
          <p>
            Each file plays with its original mesh, rig, materials, and
            animation tracks.
          </p>
          <p>
            No added poses, IK, foot controls, movement paths, or dither
            effects.
          </p>
          <div className="settings">
            <h2>File details</h2>
            <p>
              <a href={RAW_CLIPS[clip].url} download={RAW_CLIPS[clip].filename}>
                Download {RAW_CLIPS[clip].filename}
              </a>
            </p>
            <dl>
              <dt>Clip name in file</dt>
              <dd>{info?.name ?? "Loading…"}</dd>
              <dt>Duration</dt>
              <dd>{info ? `${info.duration.toFixed(3)} s` : "—"}</dd>
              <dt>Tracks</dt>
              <dd>{info?.tracks ?? "—"}</dd>
            </dl>
            {clip === "walk" && (
              <p className="note">
                The walk response contains a clip named “BeHit_FlyUp”. This is
                the name in the returned file.
              </p>
            )}
          </div>
        </aside>
        <section className="stage" aria-label="Raw animation viewer">
          <Canvas
            camera={{ position: VIEWS.front, fov: 42, near: 0.01, far: 100 }}
            dpr={[1, 2]}
          >
            <CameraView view={view} />
            <color attach="background" args={["#303236"]} />
            <hemisphereLight args={["#ffffff", "#757575", 2]} />
            <directionalLight position={[3, 5, 4]} intensity={2.5} />
            <directionalLight position={[-3, 2, -2]} intensity={1} />
            <gridHelper
              args={[8, 16, "#565a60", "#3c4046"]}
              position={[0, -0.005, 0]}
            />
            <Suspense fallback={<Html center>Loading original GLB…</Html>}>
              <ProviderAssistant
                key={`${clip}-${restart}`}
                clip={clip}
                paused={paused}
                rate={rate}
                repeat={repeat}
                onLoaded={setInfo}
              />
            </Suspense>
            <OrbitControls
              target={[0, 1.05, 0]}
              minDistance={0.4}
              maxDistance={12}
            />
          </Canvas>
          <div className="view-controls">
            {(Object.keys(VIEWS) as (keyof typeof VIEWS)[]).map((id) => (
              <button
                key={id}
                aria-pressed={view === id}
                onClick={() => setView(id)}
              >
                {id}
              </button>
            ))}
          </div>
          <footer>
            <button onClick={() => setPaused((value) => !value)}>
              {paused ? "Play" : "Pause"}
            </button>
            <button onClick={() => setRestart((value) => value + 1)}>
              Restart
            </button>
            <label htmlFor="playback-rate">Speed</label>
            <select
              id="playback-rate"
              value={rate}
              onChange={(event) => setRate(Number(event.target.value))}
            >
              <option value={1}>1× original</option>
              <option value={0.5}>0.5×</option>
              <option value={0.25}>0.25×</option>
            </select>
            <label>
              <input
                type="checkbox"
                checked={repeat}
                onChange={(event) => setRepeat(event.target.checked)}
              />
              Repeat
            </label>
            <span>Drag to orbit · Scroll to zoom</span>
          </footer>
        </section>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<RawAnimationProof />);
