import { useRef } from 'react';
import type { FC } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MathUtils } from 'three';
import type { GameState, Emotion } from '../game/model';
import { getItemSlot } from './types';
import { COLORS } from './palette';

interface ProceduralAssistantProps {
  state: GameState;
  reducedMotion?: boolean;
}

// Map emotion to physical posture, head orientation, gaze jitter, and eye pupil intensity
function getEmotionPosture(emotion?: Emotion) {
  switch (emotion) {
    case 'scared':
      return {
        hunch: 0.32,
        headPitch: -0.18,
        headRoll: 0.2,
        gazeYaw: 0.1,
        tremble: 0.02,
        eyeTint: '#b8d5e8',
        eyeIntensity: 1.2,
      };
    case 'anxious':
      return {
        hunch: 0.22,
        headPitch: 0.06,
        headRoll: -0.14,
        gazeYaw: -0.08,
        tremble: 0.012,
        eyeTint: '#ffe8a0',
        eyeIntensity: 1.6,
      };
    case 'angry':
      return {
        hunch: 0.36,
        headPitch: 0.26,
        headRoll: 0.0,
        gazeYaw: 0.0,
        tremble: 0.005,
        eyeTint: COLORS.bloodMuted,
        eyeIntensity: 2.2,
      };
    case 'sad':
      return {
        hunch: 0.38,
        headPitch: 0.38,
        headRoll: 0.06,
        gazeYaw: 0.04,
        tremble: 0.002,
        eyeTint: '#727982',
        eyeIntensity: 0.7,
      };
    case 'happy':
      return {
        hunch: 0.1,
        headPitch: -0.06,
        headRoll: 0.16,
        gazeYaw: 0.06,
        tremble: 0.003,
        eyeTint: '#fffde0',
        eyeIntensity: 1.8,
      };
    case 'focused':
    default:
      return {
        hunch: 0.18,
        headPitch: 0.14,
        headRoll: 0.02,
        gazeYaw: 0.0,
        tremble: 0.002,
        eyeTint: COLORS.lampBulb,
        eyeIntensity: 1.9,
      };
  }
}

export const ProceduralAssistant: FC<ProceduralAssistantProps> = ({
  state,
  reducedMotion = false,
}) => {
  const rootRef = useRef<Group>(null!);
  const spineRef = useRef<Group>(null!);
  const headRef = useRef<Group>(null!);
  const leftArmRef = useRef<Group>(null!);
  const rightArmRef = useRef<Group>(null!);
  const rightForearmRef = useRef<Group>(null!);
  const time = useRef(0);

  const {
    emotion,
    pending,
    holding,
    creatureHealth = 100,
    paused = false,
  } = state;
  const posture = getEmotionPosture(emotion);

  // Injury severity factor (0 = healthy, 1 = severely injured)
  const injuryRatio = Math.min(Math.max((100 - creatureHealth) / 100, 0), 1);

  useFrame((_, dt) => {
    if (!rootRef.current || !spineRef.current || !headRef.current) return;
    if (paused) return; // Paused state freezes all character motion

    time.current += dt;
    const t = time.current;

    if (reducedMotion) {
      spineRef.current.rotation.x = posture.hunch;
      spineRef.current.rotation.z = injuryRatio * 0.14;
      headRef.current.rotation.x = posture.headPitch;
      headRef.current.rotation.z = posture.headRoll;
      headRef.current.rotation.y = posture.gazeYaw;
      return;
    }

    // Breathing and organic nervous tremor
    const breathSpeed =
      1.2 + (emotion === 'scared' || emotion === 'anxious' ? 0.8 : 0);
    const breath = Math.sin(t * breathSpeed * 0.4) * 0.003;
    const sway = Math.sin(t * 0.3) * 0.004;
    const totalTremble = posture.tremble + injuryRatio * 0.01;
    const jitter = Math.sin(t * 0.55) * totalTremble * 0.12;

    // Spine posture influenced by emotion and injury
    const targetSpineX = posture.hunch + breath + injuryRatio * 0.12;
    const targetSpineY = sway + jitter;
    const targetSpineZ = injuryRatio * 0.16;

    spineRef.current.rotation.x = MathUtils.damp(
      spineRef.current.rotation.x,
      targetSpineX,
      4,
      dt,
    );
    spineRef.current.rotation.y = MathUtils.damp(
      spineRef.current.rotation.y,
      targetSpineY,
      4,
      dt,
    );
    spineRef.current.rotation.z = MathUtils.damp(
      spineRef.current.rotation.z,
      targetSpineZ,
      4,
      dt,
    );

    // Head and gaze orientation
    const targetHeadX = posture.headPitch + Math.cos(t * 1.1) * 0.02;
    const targetHeadY = posture.gazeYaw + Math.sin(t * 0.9) * 0.04;
    const targetHeadZ = posture.headRoll + jitter * 2;

    headRef.current.rotation.x = MathUtils.damp(
      headRef.current.rotation.x,
      targetHeadX,
      5,
      dt,
    );
    headRef.current.rotation.y = MathUtils.damp(
      headRef.current.rotation.y,
      targetHeadY,
      5,
      dt,
    );
    headRef.current.rotation.z = MathUtils.damp(
      headRef.current.rotation.z,
      targetHeadZ,
      5,
      dt,
    );

    // Left arm: clutches injured ribs when wounded, otherwise hangs
    if (leftArmRef.current) {
      let leftPitch = 0.0;
      let leftRoll = -0.1;
      if (injuryRatio > 0.15) {
        leftPitch = -0.6 * injuryRatio;
        leftRoll = 0.55 * injuryRatio;
      }
      leftArmRef.current.rotation.x = MathUtils.damp(
        leftArmRef.current.rotation.x,
        leftPitch,
        4,
        dt,
      );
      leftArmRef.current.rotation.z = MathUtils.damp(
        leftArmRef.current.rotation.z,
        leftRoll,
        4,
        dt,
      );
    }

    // ── Right Arm Articulation ──
    if (rightArmRef.current && rightForearmRef.current) {
      let armTargetPitch = 0.2;
      let armTargetYaw = 0.1;
      let forearmTarget = 0.3;

      if (pending) {
        const action = pending.action;
        if (action.kind === 'pick_up' || action.kind === 'place') {
          const slot = getItemSlot(
            action.kind === 'place'
              ? action.location
              : (state.items[action.item]?.location ?? 'tray'),
          );
          if (slot[0] > 0) {
            armTargetPitch = -0.7;
            armTargetYaw = 0.55;
            forearmTarget = 0.8;
          } else {
            armTargetPitch = -0.3;
            armTargetYaw = -0.4;
            forearmTarget = 0.4;
          }
        } else if (action.kind === 'use') {
          armTargetPitch = -0.85;
          armTargetYaw = 0.35;
          forearmTarget = 0.95 + Math.sin(t * 6) * 0.08;
        } else if (action.kind === 'adjust_lamp') {
          armTargetPitch = -1.4;
          armTargetYaw = 0.2;
          forearmTarget = 0.3;
        } else if (action.kind === 'combine' || action.kind === 'break') {
          armTargetPitch = -0.6;
          armTargetYaw = 0.15;
          forearmTarget = 0.9 + Math.sin(t * 8) * 0.06;
        }
      } else if (holding) {
        armTargetPitch = -0.65;
        armTargetYaw = 0.25;
        forearmTarget = 1.1;
      } else {
        armTargetPitch = 0.1 + breath * 2;
        armTargetYaw = 0.05;
        forearmTarget = 0.2;
      }

      rightArmRef.current.rotation.x = MathUtils.damp(
        rightArmRef.current.rotation.x,
        armTargetPitch,
        5,
        dt,
      );
      rightArmRef.current.rotation.y = MathUtils.damp(
        rightArmRef.current.rotation.y,
        armTargetYaw,
        5,
        dt,
      );
      rightForearmRef.current.rotation.x = MathUtils.damp(
        rightForearmRef.current.rotation.x,
        forearmTarget,
        5,
        dt,
      );
    }
  });

  return (
    <group
      ref={rootRef}
      position={[-0.82, -0.9, 0.22]}
      rotation={[0, 0.48, 0]}
      name="procedural-assistant"
    >
      {/* ── Lower Body & Apron ── */}
      <mesh position={[0, 0.82, 0]} castShadow>
        <boxGeometry args={[0.26, 0.15, 0.2]} />
        <meshStandardMaterial color={COLORS.tablePad} roughness={0.85} />
      </mesh>

      <mesh position={[-0.08, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.038, 0.045, 0.85, 10]} />
        <meshStandardMaterial color={COLORS.cellarStone} roughness={0.9} />
      </mesh>
      <mesh position={[0.08, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.038, 0.045, 0.85, 10]} />
        <meshStandardMaterial color={COLORS.cellarStone} roughness={0.9} />
      </mesh>

      {/* Mortician apron */}
      <mesh position={[0, 0.84, 0.11]} rotation={[-0.05, 0, 0]} castShadow>
        <boxGeometry args={[0.34, 0.96, 0.02]} />
        <meshStandardMaterial color={COLORS.apronLeather} roughness={0.88} />
      </mesh>

      {/* ── Torso & Spine ── */}
      <group ref={spineRef} position={[0, 0.88, 0]}>
        {/* Ribcage */}
        <mesh position={[0, 0.32, 0]} castShadow>
          <boxGeometry args={[0.32, 0.48, 0.22]} />
          <meshStandardMaterial color={COLORS.bonePale} roughness={0.85} />
        </mesh>

        {/* Apron bib */}
        <mesh position={[0, 0.35, 0.115]} castShadow>
          <boxGeometry args={[0.28, 0.38, 0.015]} />
          <meshStandardMaterial color={COLORS.apronLeather} roughness={0.88} />
        </mesh>

        {/* Injury dark stain on apron if damaged */}
        {injuryRatio > 0.1 && (
          <mesh position={[0.06, 0.28, 0.124]}>
            <circleGeometry args={[0.08 * injuryRatio, 12]} />
            <meshStandardMaterial
              color={COLORS.bloodDried}
              roughness={0.95}
              transparent
              opacity={0.85}
            />
          </mesh>
        )}

        <mesh position={[0, 0.58, 0.05]} rotation={[0.4, 0, 0]}>
          <torusGeometry args={[0.1, 0.01, 6, 16, Math.PI]} />
          <meshStandardMaterial color={COLORS.apronLeather} roughness={0.9} />
        </mesh>

        <mesh position={[0, 0.54, 0]} castShadow>
          <boxGeometry args={[0.42, 0.06, 0.18]} />
          <meshStandardMaterial color={COLORS.boneShadow} roughness={0.8} />
        </mesh>

        {/* ── Stitched Head ── */}
        <group ref={headRef} position={[0, 0.68, 0.04]}>
          <mesh position={[0, -0.06, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.055, 0.14, 10]} />
            <meshStandardMaterial color={COLORS.bonePale} roughness={0.85} />
          </mesh>

          <mesh position={[0, 0.1, 0]} castShadow>
            <boxGeometry args={[0.19, 0.24, 0.21]} />
            <meshStandardMaterial color={COLORS.bonePale} roughness={0.82} />
          </mesh>

          {/* Stitched seam across brow / cranium */}
          <mesh position={[0, 0.21, 0.06]} rotation={[0, 0, 0.1]}>
            <boxGeometry args={[0.16, 0.008, 0.01]} />
            <meshStandardMaterial color={COLORS.cellarMortar} roughness={0.9} />
          </mesh>
          {[-0.05, -0.02, 0.01, 0.04].map((x, i) => (
            <mesh
              key={i}
              position={[x, 0.21, 0.065]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <boxGeometry args={[0.018, 0.004, 0.005]} />
              <meshStandardMaterial
                color={COLORS.cellarMortar}
                roughness={0.9}
              />
            </mesh>
          ))}

          {/* Sunken eye sockets */}
          <mesh position={[-0.045, 0.09, 0.1]} castShadow>
            <boxGeometry args={[0.04, 0.035, 0.03]} />
            <meshStandardMaterial color="#0b0b0d" roughness={0.98} />
          </mesh>
          <mesh position={[0.045, 0.09, 0.1]} castShadow>
            <boxGeometry args={[0.04, 0.035, 0.03]} />
            <meshStandardMaterial color="#0b0b0d" roughness={0.98} />
          </mesh>

          {/* Expressive pupil glow */}
          <group>
            <mesh position={[-0.045, 0.09, 0.11]}>
              <sphereGeometry args={[0.007, 8, 8]} />
              <meshStandardMaterial
                color={posture.eyeTint}
                emissive={posture.eyeTint}
                emissiveIntensity={0}
              />
            </mesh>
            <mesh position={[0.045, 0.09, 0.11]}>
              <sphereGeometry args={[0.007, 8, 8]} />
              <meshStandardMaterial
                color={posture.eyeTint}
                emissive={posture.eyeTint}
                emissiveIntensity={0}
              />
            </mesh>
          </group>

          {/* Gaunt jaw */}
          <mesh position={[0, -0.01, 0.08]} castShadow>
            <boxGeometry args={[0.13, 0.06, 0.12]} />
            <meshStandardMaterial color={COLORS.boneShadow} roughness={0.85} />
          </mesh>
        </group>

        {/* ── Left Arm (Clutches side when hurt) ── */}
        <group ref={leftArmRef} position={[-0.23, 0.52, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.032, 0.38, 8]} />
            <meshStandardMaterial color={COLORS.bonePale} roughness={0.85} />
          </mesh>
          <mesh
            position={[0.02, -0.5, 0.06]}
            rotation={[0.25, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.03, 0.025, 0.38, 8]} />
            <meshStandardMaterial color={COLORS.bonePale} roughness={0.85} />
          </mesh>
          <mesh
            position={[0.03, -0.72, 0.14]}
            rotation={[0.2, 0, 0]}
            castShadow
          >
            <boxGeometry args={[0.05, 0.1, 0.02]} />
            <meshStandardMaterial color={COLORS.boneShadow} roughness={0.8} />
          </mesh>
        </group>

        {/* ── Right Arm (Articulated Active Tool Arm) ── */}
        <group ref={rightArmRef} position={[0.23, 0.52, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.045, 10, 10]} />
            <meshStandardMaterial color={COLORS.boneShadow} roughness={0.8} />
          </mesh>

          <mesh position={[0, -0.2, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.032, 0.38, 8]} />
            <meshStandardMaterial color={COLORS.bonePale} roughness={0.85} />
          </mesh>

          <group ref={rightForearmRef} position={[0, -0.38, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.038, 10, 10]} />
              <meshStandardMaterial color={COLORS.boneShadow} roughness={0.8} />
            </mesh>
            <mesh position={[0, -0.19, 0]} castShadow>
              <cylinderGeometry args={[0.03, 0.025, 0.36, 8]} />
              <meshStandardMaterial color={COLORS.bonePale} roughness={0.85} />
            </mesh>

            <group position={[0, -0.38, 0]}>
              <mesh castShadow>
                <boxGeometry args={[0.048, 0.07, 0.024]} />
                <meshStandardMaterial
                  color={COLORS.boneShadow}
                  roughness={0.8}
                />
              </mesh>
              {[-0.015, 0, 0.015].map((x, i) => (
                <mesh
                  key={i}
                  position={[x, -0.05, 0.015]}
                  rotation={[0.4, 0, 0]}
                  castShadow
                >
                  <cylinderGeometry args={[0.005, 0.004, 0.06, 6]} />
                  <meshStandardMaterial
                    color={COLORS.bonePale}
                    roughness={0.8}
                  />
                </mesh>
              ))}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};
