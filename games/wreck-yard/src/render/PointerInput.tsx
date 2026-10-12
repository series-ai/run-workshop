import { recordInputEvent } from '../perf/localInput';
import { elevatorPanelWithinReach, restackWithinReach, type AttractionRequest, type AttractionCommand } from '../sim/attractions';
import { queueAttraction } from '../ui/AttractionControls';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';
import { CAMERA_BASE, CAMERA_LOOK_AT } from './viewConstants';
import { TOOL, type Tool, type YardInput } from '../sim/input';
import type { MatchController } from '../game/match';
import type { YardBody } from '../sim/state';
import type { YardRender } from './presentation';
import { bodyGeometryChanged, wrapYaw } from './inputPresentation';
import { CHASE_FOLLOW_RATE, chaseCameraPose, recenterChaseView } from './chaseCamera';
import { isGameKey, isThrusterHeld, toolForKey, type PlayTool, type UiTool } from './keyBindings';
import { engageCall, inputLive } from '../game/playGate';
import type { PlayGateApi } from '../ui/usePlayGate';
import { applyLook, BUTTONS_UP, ignoreUntilRelease, pausedInput, pressButton } from './pointerMapping';
import { clearTouchInput, consumeTouchSample, syncTouchWeapon, touchPrimary, TOUCH_LOOK_SENSITIVITY, type TouchInput } from '../ui/touchInput';

/** Radians per pixel: captured mouse look, and drag-to-look. */
const LOOK_SENSITIVITY = 0.0022;
const DRAG_SENSITIVITY = 0.003;

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
 * Runs first in the scene each frame: reads keyboard and mouse look in first
 * person, drives the first-person camera or orbit camera, feeds inputs to the
 * runner, pumps the simulation, and refreshes the shared render ref. Mouse
 * capture belongs to the play gate (src/ui/usePlayGate.ts): while the host owns
 * the lock, look and buttons come from its pointer stream, not DOM events.
 */
export function PointerInput({
  controller,
  tool,
  onToolChange,
  renderRef,
  onBodiesChange,
  gate,
  touchInput,
  attractionInput,
}: {
  attractionInput?: MutableRefObject<AttractionRequest>;
  touchInput?: MutableRefObject<TouchInput>;
  controller: MatchController;
  tool: UiTool;
  onToolChange?: (tool: UiTool) => void;
  renderRef: MutableRefObject<YardRender | null>;
  onBodiesChange: (bodies: readonly YardBody[]) => void;
  gate: PlayGateApi;
}) {
  const gateRef = useRef(gate);
  gateRef.current = gate;
  const { camera, gl } = useThree();
  const lastBodies = useRef<readonly YardBody[] | null>(null);

  const yaw = useRef(0);
  const pitch = useRef(0);
  const buttons = useRef(BUTTONS_UP);
  /** E or F held: use (buttons, the buggy). The right mouse button is the punt. */
  const keyUse = useRef(false);
  const lastPortalCounter = useRef<number | undefined>(undefined);
  const lastBuggyYaw = useRef<number | null>(null);
  /** performance.now() of the last mouse look, so the chase camera does not fight the player. */
  const lastLookMs = useRef(-Infinity);
  const keys = useRef<Set<string>>(new Set());
  const lastPlayTool = useRef<PlayTool>(tool === 'orbit' ? 'hand' : tool);
  if (tool !== 'orbit') lastPlayTool.current = tool;
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

  const { setOrbit } = gate;
  useEffect(() => {
    controls.enabled = tool === 'orbit';
    // Orbit needs a free cursor; the gate releases the capture without the pause menu.
    setOrbit(tool === 'orbit');
    if (tool === 'orbit') {
      camera.position.set(CAMERA_BASE[0], CAMERA_BASE[1] + 2, CAMERA_BASE[2] + 4);
      controls.update();
    }
  }, [camera, controls, tool, setOrbit]);

  // While the host owns the lock, look and buttons arrive here.
  const { port, onClearInput } = gate;
  useEffect(() => {
    if (!port.onPointer) return undefined;
    return port.onPointer((input) => {
      const state = gateRef.current.state;
      if (state.view !== 'playing' || state.look !== 'capture') return;
      if (input.type === 'move') {
        if (input.movementX !== 0 || input.movementY !== 0) lastLookMs.current = performance.now();
        const view = applyLook({ yaw: yaw.current, pitch: pitch.current }, input.movementX, input.movementY, LOOK_SENSITIVITY);
        yaw.current = view.yaw;
        pitch.current = view.pitch;
      } else {
        buttons.current = pressButton(buttons.current, input.button, input.pressed);
      }
    });
  }, [port]);

  // Pointer lock & Mouse / Keyboard handlers
  useEffect(() => {
    const dom = gl.domElement;

    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    if (import.meta.env.DEV) {
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
        lastLookMs.current = performance.now();
      };

      (window as unknown as {
        __SIMULATE_INPUT__?: (action: {
          pressed?: boolean;
          secondary?: boolean;
          use?: boolean;
          tool?: UiTool;
          moveX?: number;
          moveZ?: number;
          jetpack?: boolean;
        }) => void;
      }).__SIMULATE_INPUT__ = (action) => {
        if (action.pressed !== undefined) buttons.current = pressButton(buttons.current, 0, action.pressed);
        if (action.secondary !== undefined) buttons.current = pressButton(buttons.current, 2, action.secondary);
        if (action.use !== undefined) keyUse.current = action.use;
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
    }

    const onPointerDown = (event: MouseEvent) => {
      recordInputEvent();
      const current = gateRef.current;
      if (tool !== 'orbit' && current.state.view === 'free-cursor' && engageCall(current.state) !== 'none') {
        // "Click to look" after orbit: this click captures; it must not also fire the tool.
        buttons.current = ignoreUntilRelease(buttons.current, event.button);
        void current.engage();
        return;
      }
      if (tool !== 'orbit' && current.state.look === 'drag') {
        isDragging = true;
        lastX = event.clientX;
        lastY = event.clientY;
      }
      buttons.current = pressButton(buttons.current, event.button, true);
    };

    const onPointerUp = (event: MouseEvent) => {
      recordInputEvent();
      isDragging = false;
      buttons.current = pressButton(buttons.current, event.button, false);
    };

    const onMouseMove = (event: MouseEvent) => {
      recordInputEvent();
      if (tool === 'orbit') return;
      if (document.pointerLockElement === dom) {
        if (event.movementX !== 0 || event.movementY !== 0) lastLookMs.current = performance.now();
        const view = applyLook({ yaw: yaw.current, pitch: pitch.current }, event.movementX, event.movementY, LOOK_SENSITIVITY);
        yaw.current = view.yaw;
        pitch.current = view.pitch;
      } else if (isDragging) {
        const dx = event.movementX || (event.clientX - lastX);
        const dy = event.movementY || (event.clientY - lastY);
        lastX = event.clientX;
        lastY = event.clientY;
        if (dx !== 0 || dy !== 0) lastLookMs.current = performance.now();
        const view = applyLook({ yaw: yaw.current, pitch: pitch.current }, dx, dy, DRAG_SENSITIVITY);
        yaw.current = view.yaw;
        pitch.current = view.pitch;
      }
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      recordInputEvent();
      if (event.code === 'Escape' && !event.repeat && gateRef.current.state.look === 'drag') {
        gateRef.current.pause();
        return;
      }
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.code === 'Space' && event.target instanceof HTMLButtonElement) return;
      if (isGameKey(event.code)) event.preventDefault();
      keys.current.add(event.code);
      if (event.code === 'KeyE' || event.code === 'KeyF') {
        keyUse.current = true;
      }
      // Behind the gate or the pause menu the tool does not change (no "resume with orbit on").
      if (event.repeat || !inputLive(gateRef.current.state)) return;
      const render = renderRef.current;
      const player = render?.players.find((p) => p.slot === render.localSlot);
      if (attractionInput && player && render && !player.ridingVehicle) {
        const floorKeys = ['KeyG', 'Digit1', 'Digit2', 'Digit3'];
        const floor = floorKeys.indexOf(event.code);
        if (floor >= 0 && elevatorPanelWithinReach(player.position, render.attractions.elevator.y)) {
          event.preventDefault();
          queueAttraction(attractionInput.current, (floor + 1) as AttractionCommand);
          return;
        }
        if (event.code === 'KeyE' && restackWithinReach(player.position)) {
          queueAttraction(attractionInput.current, 5);
          return;
        }
      }
      const nextTool = toolForKey(event.code, tool, lastPlayTool.current);
      if (nextTool) onToolChange?.(nextTool);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      recordInputEvent();
      keys.current.delete(event.code);
      if (event.code === 'KeyE' || event.code === 'KeyF') {
        keyUse.current = false;
      }
    };

    const clearInput = () => {
      keys.current.clear();
      buttons.current = BUTTONS_UP;
      keyUse.current = false;
      if (attractionInput) attractionInput.current.command = 0;
      isDragging = false;
      if (touchInput) clearTouchInput(touchInput.current);
    };
    const preventTouchMouse = (event: PointerEvent) => {
      if (event.pointerType === 'touch') event.preventDefault();
    };
    const stopClear = onClearInput(clearInput);
    const onVisibility = () => { if (document.hidden) clearInput(); };
    dom.addEventListener('mousedown', onPointerDown);
    dom.addEventListener('pointerdown', preventTouchMouse);
    window.addEventListener('blur', clearInput);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('mouseup', onPointerUp);
    document.addEventListener('mousemove', onMouseMove);
    dom.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      stopClear();
      dom.removeEventListener('mousedown', onPointerDown);
      dom.removeEventListener('pointerdown', preventTouchMouse);
      window.removeEventListener('blur', clearInput);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('mouseup', onPointerUp);
      document.removeEventListener('mousemove', onMouseMove);
      if (import.meta.env.DEV) {
        const debug = window as unknown as Record<string, unknown>;
        for (const key of ['__SET_LOOK_ANGLES__', '__SET_CAMERA_OVERRIDE__', '__SIMULATE_INPUT__', '__THREE_RENDERER__']) delete debug[key];
      }
      dom.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [gl, tool, onToolChange, onClearInput, touchInput]);

  const euler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []);
  const buggyQuat = useMemo(() => new THREE.Quaternion(), []);
  const chaseFollowing = useRef(false);
  const chaseTarget = useMemo(() => new THREE.Vector3(), []);
  /** Chassis position last frame and smoothed forward speed (m/s), for chase recentering. */
  const lastChassisPosition = useRef<readonly [number, number, number] | null>(null);
  const chassisForwardSpeed = useRef(0);

  const updateCamera = (render: YardRender | null, deltaSeconds: number) => {
    const localPlayer = render?.players?.find((p) => p.slot === render?.localSlot);
    const isRiding = Boolean(localPlayer?.ridingVehicle);
    if (localPlayer && lastPortalCounter.current !== localPlayer.portalTeleports) {
      chaseFollowing.current = false;
      lastChassisPosition.current = null;
      chassisForwardSpeed.current = 0;
      lastBuggyYaw.current = null;
      lastPortalCounter.current = localPlayer.portalTeleports;
    }
    const buggyPose = render?.poses.get('vehicle-chassis');

    // Turn camera yaw smoothly with buggy chassis rotation when driving
    if (isRiding && buggyPose) {
      const q = buggyPose.rotation;
      euler.setFromQuaternion(buggyQuat.set(q[0], q[1], q[2], q[3]), 'YXZ');
      const chassisYaw = euler.y;
      if (Number.isFinite(chassisYaw)) {
        if (lastBuggyYaw.current === null) {
          yaw.current = chassisYaw;
        } else if (Number.isFinite(lastBuggyYaw.current)) {
          const deltaYaw = Math.atan2(
            Math.sin(chassisYaw - lastBuggyYaw.current),
            Math.cos(chassisYaw - lastBuggyYaw.current),
          );
          if (Number.isFinite(deltaYaw)) {
            yaw.current += deltaYaw;
          }
        }
        lastBuggyYaw.current = chassisYaw;

        // Chase yaw 0 looks along -Z, like the sim; the chassis heading uses the same convention.
        const previous = lastChassisPosition.current;
        const position = buggyPose.position;
        if (previous && deltaSeconds > 0) {
          const forward = ((position[0] - previous[0]) * -Math.sin(chassisYaw) + (position[2] - previous[2]) * -Math.cos(chassisYaw)) / deltaSeconds;
          // Smooth the speed estimate before camera recentering.
          chassisForwardSpeed.current += (forward - chassisForwardSpeed.current) * (1 - Math.exp(-7 * deltaSeconds));
        }
        lastChassisPosition.current = [position[0], position[1], position[2]];
        const view = recenterChaseView(
          { yaw: yaw.current, pitch: pitch.current },
          chassisYaw,
          chassisForwardSpeed.current,
          (performance.now() - lastLookMs.current) / 1000,
          deltaSeconds,
        );
        yaw.current = view.yaw;
        pitch.current = view.pitch;
      }
    } else {
      lastBuggyYaw.current = null;
      chaseFollowing.current = false;
      lastChassisPosition.current = null;
      chassisForwardSpeed.current = 0;
    }

    if (!Number.isFinite(yaw.current)) yaw.current = 0;
    if (!Number.isFinite(pitch.current)) pitch.current = 0;
    yaw.current = wrapYaw(yaw.current);

    if (cameraOverride.current) {
      camera.position.set(cameraOverride.current.pos[0], cameraOverride.current.pos[1], cameraOverride.current.pos[2]);
      camera.lookAt(cameraOverride.current.lookAt[0], cameraOverride.current.lookAt[1], cameraOverride.current.lookAt[2]);
    } else if (tool === 'orbit') {
      controls.update();
    } else {
      if (localPlayer) {
        if (isRiding && buggyPose) {
          const chase = chaseCameraPose(buggyPose.position, yaw.current, pitch.current);
          // Snap on mount; after that, follow smoothly so suspension bumps do not shake the view.
          const follow = chaseFollowing.current ? 1 - Math.exp(-CHASE_FOLLOW_RATE * deltaSeconds) : 1;
          camera.position.lerp(chaseTarget.set(chase.position[0], chase.position[1], chase.position[2]), follow);
          camera.lookAt(chase.lookAt[0], chase.lookAt[1], chase.lookAt[2]);
          chaseFollowing.current = true;
          return;
        }
        camera.position.set(localPlayer.position[0], localPlayer.position[1] + 1.55, localPlayer.position[2]);
      }
      euler.set(pitch.current, yaw.current, 0, 'YXZ');
      camera.quaternion.setFromEuler(euler);
    }

  };

  useFrame((_, deltaSeconds) => {
    const touch = touchInput?.current;
    if (touch && inputLive(gateRef.current.state) && tool !== 'orbit') {
      if (touch.lookX !== 0 || touch.lookY !== 0) lastLookMs.current = performance.now();
      const view = applyLook({ yaw: yaw.current, pitch: pitch.current }, touch.lookX, touch.lookY, TOUCH_LOOK_SENSITIVITY);
      yaw.current = view.yaw;
      pitch.current = view.pitch;
    }
    if (touch) { touch.lookX = 0; touch.lookY = 0; touch.view = { yaw: yaw.current, pitch: pitch.current }; }
    const shot = touch && !touch.secondaryRearm && !touch.dropQueued ? touch.shots[0] : undefined;
    const aim = shot?.aim ?? { yaw: yaw.current, pitch: pitch.current };
    const moveX = THREE.MathUtils.clamp((touch?.moveX ?? 0) + (keys.current.has('KeyD') || keys.current.has('ArrowRight') ? 1 : 0) -
                  (keys.current.has('KeyA') || keys.current.has('ArrowLeft') ? 1 : 0), -1, 1);
    const moveZ = THREE.MathUtils.clamp((touch?.moveZ ?? 0) + (keys.current.has('KeyW') || keys.current.has('ArrowUp') ? 1 : 0) -
                  (keys.current.has('KeyS') || keys.current.has('ArrowDown') ? 1 : 0), -1, 1);
    const jetpack = isThrusterHeld(keys.current) || Boolean(touch?.jetpack);

    const playInput: YardInput = {
      attraction: attractionInput?.current.command ?? 0,
      attractionRequest: attractionInput?.current.sequence ?? 0,
      tool: toSimTool(tool),
      pressed: tool !== 'orbit' && (buttons.current.primary || Boolean(touch && touchPrimary(touch, toSimTool(tool)))),
      secondary: tool !== 'orbit' && (buttons.current.punt || Boolean(shot)),
      drop: Boolean(touch?.dropQueued),
      use: keyUse.current || Boolean(touch?.use || touch?.useQueued),
      jetpack: tool !== 'orbit' && jetpack,
      moveX: tool !== 'orbit' ? moveX : 0,
      moveZ: tool !== 'orbit' ? moveZ : 0,
      yaw: Math.round(wrapYaw(aim.yaw) * 1000),
      pitch: Math.round(aim.pitch * 1000) || 0,
      ox: 0, oy: 0, oz: 0,
      dx: 0, dy: 0, dz: 0,
    };

    // Behind the gate or the pause menu: keep the view and tool, stop the rest.
    const input = inputLive(gateRef.current.state) ? playInput : pausedInput(playInput);
    controller.setInput(input);
    controller.pump(performance.now());
    const nextRender = controller.getRender();
    // A network pump can schedule input without advancing the render frame.
    const sampled = controller.sampledInput;
    if (touch && sampled?.input === input) consumeTouchSample(touch, input, sampled.frame);
    if (touch && nextRender) syncTouchWeapon(touch, nextRender.frame,
      nextRender.players.find((player) => player.slot === nextRender.localSlot));
    renderRef.current = nextRender;
    updateCamera(nextRender, deltaSeconds);
    if (nextRender && nextRender.bodies !== lastBodies.current) {
      const prev = lastBodies.current;
      lastBodies.current = nextRender.bodies;
      const changed = bodyGeometryChanged(prev, nextRender.bodies);
      if (changed) {
        onBodiesChange(nextRender.bodies);
      }
    }
  });

  return null;
}
