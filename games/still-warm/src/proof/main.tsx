import { Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import {
  ProviderAssistant,
  RAW_CLIPS,
  EDITED_CLIPS,
  type RawClip,
  type ClipInfo,
} from "./ProviderAssistant";
import "./proof.css";

const VIEWS = {
  front: [0, 1.15, 4.3],
  side: [4.3, 1.15, 0],
  back: [0, 1.15, -4.3],
} satisfies Record<string, [number, number, number]>;

function CameraView({
  view,
  focusPart,
}: {
  view: keyof typeof VIEWS;
  focusPart: "Left" | "Right" | "Head" | null;
}) {
  const camera = useThree((state) => state.camera);
  useEffect(
    function selectCameraView() {
      if (focusPart) return;
      camera.position.set(...VIEWS[view]);
      camera.lookAt(0, 1.05, 0);
    },
    [camera, view, focusPart],
  );
  return null;
}

function RawAnimationProof() {
  const [clip, setClip] = useState<RawClip>(() => {
    const clip = new URLSearchParams(location.search).get("clip");
    return clip === "action276" || clip === "action284" || clip === "action386"
      ? clip
      : "idle";
  });
  const [edited, setEdited] = useState(true);
  const [focusPart, setFocusPart] = useState<"Left" | "Right" | "Head" | null>(
    () => {
      if (new URLSearchParams(location.search).get("view") === "face")
        return "Head";
      const hand = new URLSearchParams(location.search).get("hand");
      return hand === "left" ? "Left" : hand === "right" ? "Right" : null;
    },
  );
  const [paused, setPaused] = useState(false);
  const [repeat, setRepeat] = useState(true);
  const [rate, setRate] = useState(1);
  const [restart, setRestart] = useState(0);
  const [view, setView] = useState<keyof typeof VIEWS>("front");
  const [info, setInfo] = useState<ClipInfo | null>(null);
  const editAsset =
    clip === "action276" || clip === "action284" || clip === "action386"
      ? EDITED_CLIPS[clip]
      : null;
  const useEdit = edited && editAsset !== null;
  const asset = useEdit ? editAsset : RAW_CLIPS[clip];
  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">STILL WARM / SOURCE REVIEW</p>
          <h1>Animation review</h1>
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
          {editAsset && (
            <label>
              {editAsset.control}
              <select
                aria-label={editAsset.control}
                value={edited ? "grip" : "original"}
                onChange={(event) => {
                  setEdited(event.target.value === "grip");
                  setInfo(null);
                }}
              >
                <option value="grip">{editAsset.label}</option>
                <option value="original">Original</option>
              </select>
            </label>
          )}
          <p>
            {useEdit
              ? editAsset.note
              : "Original mesh, rig, materials, and animation tracks. No added poses or movement controls."}
          </p>
          <div className="settings">
            <h2>File details</h2>
            <p>
              <a href={asset.url} download={asset.filename}>
                Download {asset.filename}
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
            <CameraView view={view} focusPart={focusPart} />
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
                key={`${clip}-${restart}-${useEdit}`}
                url={asset.url}
                focusPart={focusPart}
                paused={paused}
                rate={rate}
                repeat={repeat}
                onLoaded={setInfo}
              />
            </Suspense>
            {!focusPart && (
              <OrbitControls
                target={[0, 1.05, 0]}
                minDistance={0.4}
                maxDistance={12}
              />
            )}
          </Canvas>
          <div className="view-controls">
            {(Object.keys(VIEWS) as (keyof typeof VIEWS)[]).map((id) => (
              <button
                key={id}
                aria-pressed={!focusPart && view === id}
                onClick={() => {
                  setFocusPart(null);
                  setView(id);
                }}
              >
                {id}
              </button>
            ))}
            <button
              aria-pressed={focusPart === "Right"}
              onClick={() => setFocusPart("Right")}
            >
              Right hand
            </button>
            <button
              aria-pressed={focusPart === "Left"}
              onClick={() => setFocusPart("Left")}
            >
              Left hand
            </button>
            <button
              aria-pressed={focusPart === "Head"}
              onClick={() => setFocusPart("Head")}
            >
              Face
            </button>
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
