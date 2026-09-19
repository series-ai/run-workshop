import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';
import { CAMERA_BASE, CAMERA_LOOK_AT } from './viewConstants';
import { TOOL, type Tool, type YardInput } from '../sim/input';
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
 * Runs first in the scene each frame: captures keyboard & mouse look in first person,
 * drives the first-person camera or orbit camera, feeds inputs to the runner,
 * pumps the simulation, and refreshes the shared render ref.
 */
export function PointerInput({
  controller,
  tool,
  onToolChange,
  renderRef,
  onBodiesChange,
}: {
  controller: MatchController;
  tool: UiTool;
  onToolChange?: (tool: UiTool) => void;
  renderRef: MutableRefObject<YardRender | null>;
  onBodiesChange: (bodies: readonly YardBody[]) => void;
}) {
  const { camera, gl } = useThree();
  const lastBodies = useRef<readonly YardBody[] | null>(null);

  const yaw = useRef(0);
  const pitch = useRef(0);
  const pressed = useRef(false);
  const secondary = useRef(false);
  const keys = useRef<Set<string>>(new Set());
  const cameraOverride = useRef<{ pos: [number, number, number]; lookAt: [number, number, number] } | null>(null);

  const controls = useMemo(() => {
    const next = new OrbitControlsImpl(camera, gl.domElement);
    next.enablePan = false;
    next.enableDamping = true;
    next.dampingFactor = 0.08;
    next.minDistance = 5.4;
    next.maxDistance = 28.0;
    next.minPolarAngle = 0.2;
    next.maxPolarAngle = 1.45;
    next.target.set(CAMERA_LOOK_AT[0], CAMERA_LOOK_AT[1], CAMERA_LOOK_AT[2]);
    next.enabled = false;
    return next;
  }, [camera, gl]);

  useEffect(() => () => controls.dispose(), [controls]);

  useEffect(() => {
    controls.enabled = tool === 'orbit';
    if (tool === 'orbit') {
      camera.position.set(CAMERA_BASE[0], CAMERA_BASE[1] + 2, CAMERA_BASE[2] + 4);
      controls.update();
    }
  }, [camera, controls, tool]);

  // Pointer lock & Mouse / Keyboard handlers
  useEffect(() => {
    const dom = gl.domElement;

    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    (window as unknown as {
      __SET_LOOK_ANGLES__?: (y: number, p: number) => void;
      __SET_CAMERA_OVERRIDE__?: (pos: [number, number, number] | null, lookAt?: [number, number, number] | null) => void;
      __THREE_RENDERER__?: unknown;
    }).__SET_CAMERA_OVERRIDE__ = (pos, lookAt) => {
      if (pos && lookAt) {
        cameraOverride.current = { pos, lookAt };
      } else {
        cameraOverride.current = null;
      }
    };
    (window as unknown as { __THREE_RENDERER__?: unknown }).__THREE_RENDERER__ = gl;

    (window as unknown as { __SET_LOOK_ANGLES__?: (y: number, p: number) => void }).__SET_LOOK_ANGLES__ = (y, p) => {
      yaw.current = y;
      pitch.current = THREE.MathUtils.clamp(p, -1.45, 1.45);
    };

    (window as unknown as {
      __SIMULATE_INPUT__?: (action: {
        pressed?: boolean;
        secondary?: boolean;
        tool?: UiTool;
        moveX?: number;
        moveZ?: number;
        jetpack?: boolean;
      }) => void;
    }).__SIMULATE_INPUT__ = (action) => {
      if (action.pressed !== undefined) pressed.current = action.pressed;
      if (action.secondary !== undefined) secondary.current = action.secondary;
      if (action.tool !== undefined) onToolChange?.(action.tool);
      if (action.jetpack !== undefined) {
        if (action.jetpack) keys.current.add('Space');
        else keys.current.delete('Space');
      }
      if (action.moveZ !== undefined) {
        if (action.moveZ > 0) keys.current.add('KeyW');
        else keys.current.delete('KeyW');
        if (action.moveZ < 0) keys.current.add('KeyS');
        else keys.current.delete('KeyS');
      }
      if (action.moveX !== undefined) {
        if (action.moveX > 0) keys.current.add('KeyD');
        else keys.current.delete('KeyD');
        if (action.moveX < 0) keys.current.add('KeyA');
        else keys.current.delete('KeyA');
      }
    };

    const onPointerDown = (event: MouseEvent) => {
      if (tool !== 'orbit') {
        if (document.pointerLockElement !== dom) {
          try { dom.requestPointerLock?.(); } catch {}
        }
        isDragging = true;
        lastX = event.clientX;
        lastY = event.clientY;
      }
      if (event.button === 0) pressed.current = true;
      if (event.button === 2) secondary.current = true;
    };

    const onPointerUp = (event: MouseEvent) => {
      isDragging = false;
      if (event.button === 0) pressed.current = false;
      if (event.button === 2) secondary.current = false;
    };

    const onMouseMove = (event: MouseEvent) => {
      if (tool === 'orbit') return;
      if (document.pointerLockElement === dom) {
        yaw.current -= event.movementX * 0.0022;
        pitch.current = THREE.MathUtils.clamp(pitch.current - event.movementY * 0.0022, -1.45, 1.45);
      } else if (isDragging || event.buttons > 0) {
        const dx = event.movementX || (event.clientX - lastX);
        const dy = event.movementY || (event.clientY - lastY);
        lastX = event.clientX;
        lastY = event.clientY;
        yaw.current -= dx * 0.003;
        pitch.current = THREE.MathUtils.clamp(pitch.current - dy * 0.003, -1.45, 1.45);
      }
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      keys.current.add(event.code);
      if (event.code === 'Digit1') onToolChange?.('hand');
      if (event.code === 'Digit2') onToolChange?.('torch');
      if (event.code === 'Digit3') onToolChange?.('orbit');
    };

    const onKeyUp = (event: KeyboardEvent) => {
      keys.current.delete(event.code);
    };

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mouseup', onPointerUp);
    document.addEventListener('mousemove', onMouseMove);
    dom.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mouseup', onPointerUp);
      document.removeEventListener('mousemove', onMouseMove);
      dom.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [gl, tool, onToolChange]);

  const dirVec = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []);

  useFrame(() => {
    const render = renderRef.current;
    const localPlayer = render?.players?.find((p) => p.slot === render?.localSlot);

    if (cameraOverride.current) {
      camera.position.set(cameraOverride.current.pos[0], cameraOverride.current.pos[1], cameraOverride.current.pos[2]);
      camera.lookAt(cameraOverride.current.lookAt[0], cameraOverride.current.lookAt[1], cameraOverride.current.lookAt[2]);
      dirVec.set(0, 0, -1).applyQuaternion(camera.quaternion);
    } else if (tool === 'orbit') {
      controls.update();
      dirVec.set(0, 0, -1).applyQuaternion(camera.quaternion);
    } else {
      if (localPlayer) {
        camera.position.set(localPlayer.position[0], localPlayer.position[1] + 1.55, localPlayer.position[2]);
      }
      euler.set(pitch.current, yaw.current, 0, 'YXZ');
      camera.quaternion.setFromEuler(euler);
      dirVec.set(0, 0, -1).applyQuaternion(camera.quaternion);
    }

    const moveX = (keys.current.has('KeyD') || keys.current.has('ArrowRight') ? 1 : 0) -
                  (keys.current.has('KeyA') || keys.current.has('ArrowLeft') ? 1 : 0);
    const moveZ = (keys.current.has('KeyW') || keys.current.has('ArrowUp') ? 1 : 0) -
                  (keys.current.has('KeyS') || keys.current.has('ArrowDown') ? 1 : 0);
    const jetpack = keys.current.has('Space');

    const input: YardInput = {
      tool: toSimTool(tool),
      pressed: tool !== 'orbit' && pressed.current,
      secondary: tool !== 'orbit' && secondary.current,
      jetpack,
      moveX,
      moveZ,
      yaw: Math.round(yaw.current * 1000),
      pitch: Math.round(pitch.current * 1000),
      ox: Math.round(camera.position.x * 1000),
      oy: Math.round(camera.position.y * 1000),
      oz: Math.round(camera.position.z * 1000),
      dx: Math.round(dirVec.x * 10000),
      dy: Math.round(dirVec.y * 10000),
      dz: Math.round(dirVec.z * 10000),
    };

    controller.setInput(input);
    controller.pump(performance.now());
    const nextRender = controller.getRender();
    renderRef.current = nextRender;
    if (nextRender && nextRender.bodies !== lastBodies.current) {
      lastBodies.current = nextRender.bodies;
      onBodiesChange(nextRender.bodies);
    }
  });

  return null;
}
