import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useThree } from "@react-three/fiber";
import { Bounds, Center, useBounds } from "@react-three/drei";
import { ItemModel } from "../scene/Tools";
import { Lamp } from "../scene/Lamp";
import { DitherBridge } from "../scene/DitherBridge";
import {
  CATALOG,
  createInitialState,
  ITEM_IDS,
  type ItemId,
} from "../game/model";
import { SUPPORTED_USES } from "../game/affordances";
import "./objects.css";

type View = "table" | "side";

const VIEW_POSITIONS: Record<View, [number, number, number]> = {
  table: [0.5, 2.1, 1.6],
  side: [2.7, 0.32, 0],
};

function InspectionCamera({ view, item }: { view: View; item: ItemId }) {
  const camera = useThree((state) => state.camera);
  const bounds = useBounds();

  useEffect(() => {
    camera.position.set(...VIEW_POSITIONS[view]);
    camera.lookAt(0, 0, 0);
    bounds.refresh().clip().fit();
  }, [bounds, camera, item, view]);

  return null;
}

function InspectionObject({
  item,
  waterLevel,
  clean,
}: {
  item: ItemId;
  waterLevel: number;
  clean: boolean;
}) {
  const isLamp = item === "lamp";
  return (
    <group
      position={isLamp ? [0, -0.36, 0] : [0, 0, 0]}
      scale={isLamp ? 0.72 : 3.2}
      rotation={[0, 0.2, 0]}
    >
      {isLamp ? (
        <Lamp mode="wound" lit={false} reducedMotion />
      ) : (
        <ItemModel
          id={item}
          lit={false}
          waterLevel={waterLevel}
          clean={clean}
        />
      )}
    </group>
  );
}

function InspectionCanvas({
  item,
  view,
  dither,
  waterLevel,
  clean,
}: {
  item: ItemId;
  view: View;
  dither: boolean;
  waterLevel: number;
  clean: boolean;
}) {
  const patient = useMemo(() => createInitialState().patient, []);

  return (
    <div
      className="object-canvas"
      aria-label={`${dither ? "Dither" : "Raw"} object view`}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{
          position: VIEW_POSITIONS[view],
          fov: 32,
          near: 0.01,
          far: 20,
        }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#66665d"]} />
        <ambientLight intensity={1.05} color="#c6c1a8" />
        <directionalLight
          position={[3, 4, 5]}
          intensity={4}
          color="#fff3d2"
          castShadow
        />
        <directionalLight
          position={[-3, 2, -1]}
          intensity={1.4}
          color="#9aa58f"
        />
        <Bounds fit clip observe margin={1.5} maxDuration={0}>
          <Center key={item}>
            <InspectionObject
              item={item}
              waterLevel={waterLevel}
              clean={clean}
            />
          </Center>
          <InspectionCamera view={view} item={item} />
        </Bounds>
        {dither && <DitherBridge patient={patient} reducedMotion />}
      </Canvas>
      <span className="canvas-caption">
        {dither ? "Dither" : "Raw shading"}
      </span>
    </div>
  );
}

function ObjectReview() {
  const [selected, setSelected] = useState<ItemId>("forceps");
  const [view, setView] = useState<View>("table");
  const [waterLevel, setWaterLevel] = useState(1);
  const [clean, setClean] = useState(true);
  const catalogEntry = CATALOG[selected];
  const uses = SUPPORTED_USES.filter((use) => use.item === selected);

  return (
    <main className="objects-page">
      <header className="objects-header">
        <div>
          <p className="objects-eyebrow">STILL WARM / OBJECT REVIEW</p>
          <h1>Room objects</h1>
          <p className="objects-intro">
            Matched inspection of the actual room object models. Select one item
            to compare raw shading and the final dither treatment.
          </p>
        </div>
        <p className="objects-note">Inspection light; room light differs.</p>
      </header>

      <section className="object-workspace">
        <aside className="object-sidebar" aria-label="Object catalog">
          <div className="object-sidebar-heading">
            <h2>Items</h2>
            <span>{ITEM_IDS.length}</span>
          </div>
          <div className="object-list">
            {ITEM_IDS.map((item) => (
              <button
                type="button"
                key={item}
                className="object-choice"
                aria-pressed={item === selected}
                onClick={() => setSelected(item)}
              >
                <span>{CATALOG[item].name}</span>
                <small>{item}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="object-detail" aria-label="Selected object detail">
          <div className="object-detail-header">
            <div>
              <p className="objects-eyebrow">SELECTED OBJECT</p>
              <h2>{catalogEntry.name}</h2>
              <p className="object-meta">
                <span>{selected}</span>
                <span>{catalogEntry.material}</span>
                <span>{catalogEntry.sharp ? "sharp" : "blunt"}</span>
              </p>
            </div>
            <div className="view-toggle" aria-label="Camera angle">
              {(Object.keys(VIEW_POSITIONS) as View[]).map((angle) => (
                <button
                  type="button"
                  key={angle}
                  aria-pressed={view === angle}
                  onClick={() => setView(angle)}
                >
                  {angle}
                </button>
              ))}
            </div>
          </div>

          {selected === "bowl" && (
            <div className="view-toggle water-toggle" aria-label="Water supply">
              {([1, 1 / 3, 0] as const).map((level) => (
                <button
                  key={level}
                  aria-pressed={waterLevel === level}
                  onClick={() => setWaterLevel(level)}
                >
                  {level === 1 ? "Full" : level === 0 ? "Empty" : "One portion"}
                </button>
              ))}
            </div>
          )}
          {(["cloth", "blanket", "bandage"] as ItemId[]).includes(selected) && (
            <div className="view-toggle" aria-label="Fabric condition">
              <button aria-pressed={clean} onClick={() => setClean(true)}>
                Clean
              </button>
              <button aria-pressed={!clean} onClick={() => setClean(false)}>
                Stained
              </button>
            </div>
          )}
          <div className="object-panels">
            <InspectionCanvas
              item={selected}
              view={view}
              dither={false}
              waterLevel={waterLevel}
              clean={clean}
            />
            <InspectionCanvas
              item={selected}
              view={view}
              dither
              waterLevel={waterLevel}
              clean={clean}
            />
          </div>

          <div className="supported-uses">
            <h3>Supported uses</h3>
            {uses.length > 0 ? (
              <ul>
                {uses.map((use) => (
                  <li key={`${use.item}-${use.target}`}>
                    <strong>{use.target}</strong>
                    <span>{use.description}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No registered use.</p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<ObjectReview />);
