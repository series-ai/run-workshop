import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';
import { CAMERA_BASE, CAMERA_LOOK_AT } from './viewConstants';
import { quantizeRay, TOOL, type Tool, type YardInput } from '../sim/input';
import type { MatchController } from '../game/match';
import type { YardBody } from '../sim/state';
import type { YardRender } from './presentation';

export type UiTool = 'hand' | 'torch' | 'orbit';

function toSimTool(tool: UiTool): Tool {
  switch (tool) {
    case 'hand': return TOOL.hand;
    case 'torch': return TOOL.torch;
    case 'orbit': return TOOL.none;
    default: {
      const unreachable: never = tool;
      throw new Error(`WRECK_YARD_UI_TOOL_INVALID: ${String(unreachable)}`);
    }
  }
}

/**
 * Runs first in the scene each frame: reads the pointer, feeds the runner,
 * pumps the simulation, refreshes the shared render ref, reports body-list
 * changes, and drives the camera. Mount it before any component that reads
 * `renderRef` in its own `useFrame``.
 */
export function PointerInput({ controller, tool, renderRef, onBodiesChange }: {
  controller: MatchController;
  tool: UiTool;
  renderRef: MutableRefObject<YardRender | null>;
  onBodiesChange: (bodies: readonly YardBody[]) => void;
}) {
  const { camera, gl } = useThree();
  const lastBodies = useRef<readonly YardBody[] | null>(null);
  const pressed = useRef(false);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const controls = useMemo(() => {
    const next = new OrbitControlsImpl(camera, gl.domElement);
    next.enablePan = false;
    next.enableDamping = true;
    next.dampingFactor = 0.08;
    next.minDistance = 5.4;
    next.maxDistance = 14.5;
    next.minPolarAngle = 0.42;
    next.maxPolarAngle = 1.34;
    next.target.set(CAMERA_LOOK_AT[0], CAMERA_LOOK_AT[1], CAMERA_LOOK_AT[2]);
    next.enabled = false;
    return next;
  }, [camera, gl]);

  useEffect(() => () => controls.dispose(), [controls]);

  useEffect(() => {
    controls.enabled = tool === 'orbit';
    if (tool === 'orbit') {
      camera.position.set(CAMERA_BASE[0], CAMERA_BASE[1], CAMERA_BASE[2]);
      controls.update();
    }
  }, [camera, controls, tool]);

  useEffect(() => {
    const down = (event: PointerEvent) => { if (event.button === 0) pressed.current = true; };
    const up = () => { pressed.current = false; };
    gl.domElement.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      gl.domElement.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [gl]);

  useFrame((state, delta) => {
    if (tool === 'orbit') {
      controls.update();
    } else {
      target.set(
        CAMERA_BASE[0] + state.pointer.x * 0.45,
        CAMERA_BASE[1] + state.pointer.y * 0.22,
        CAMERA_BASE[2] - state.pointer.x * 0.28,
      );
      state.camera.position.lerp(target, 1 - Math.exp(-delta * 2.6));
      state.camera.lookAt(CAMERA_LOOK_AT[0], CAMERA_LOOK_AT[1], CAMERA_LOOK_AT[2]);
    }

    raycaster.setFromCamera(state.pointer, state.camera);
    const o = raycaster.ray.origin;
    const d = raycaster.ray.direction;
    const input: YardInput = {
      tool: toSimTool(tool),
      pressed: tool !== 'orbit' && pressed.current,
      ...quantizeRay([o.x, o.y, o.z], [d.x, d.y, d.z]),
    };
    controller.setInput(input);
    controller.pump(performance.now());
    const render = controller.getRender();
    renderRef.current = render;
    if (render && render.bodies !== lastBodies.current) {
      lastBodies.current = render.bodies;
      onBodiesChange(render.bodies);
    }
  });

  return null;
}
