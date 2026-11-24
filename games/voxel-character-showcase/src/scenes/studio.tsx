import { NeutralToneMapping } from 'three'

/**
 * Studio look that the lab, the context stage and the perf bench share.
 *
 * Three directional lights make each flat facet read: a warm key from the front right, a cool
 * fill from the front left and a cool rim from behind. Crowd/stage modes cast zero shadows
 * (performance rule P2); hero Focus views enable optional directional shadows.
 */

/** Renderer options for each showcase canvas. Neutral tone mapping keeps the palette colors true. */
export const STUDIO_GL = { toneMapping: NeutralToneMapping, toneMappingExposure: 1.08 } as const

export interface StudioLightsProps {
  /** Distance scale of the light positions. Use the approximate radius of the scene. */
  reach?: number
  /** The fill light. The perf bench turns it off to keep the fragment cost low. */
  fill?: boolean
  /** Enable real directional cast shadows for hero inspection in Focus modes. */
  heroShadows?: boolean
}

export function StudioLights({ reach = 1, fill = true, heroShadows = false }: StudioLightsProps) {
  return (
    <>
      <hemisphereLight args={['#c3d6f0', '#928379', 0.78]} />
      <directionalLight
        position={[3.4 * reach, 4.6 * reach, 5.2 * reach]}
        intensity={2.95}
        color="#fff0db"
        castShadow={heroShadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={24 * reach}
        shadow-camera-left={-3.0 * reach}
        shadow-camera-right={3.0 * reach}
        shadow-camera-top={3.5 * reach}
        shadow-camera-bottom={-1.5 * reach}
        shadow-bias={-0.0005}
        shadow-normalBias={0.015}
      />
      {fill && <directionalLight position={[-5.0 * reach, 2.2 * reach, 3.4 * reach]} intensity={0.85} color="#adc8ef" />}
      <directionalLight position={[-2.5 * reach, 4.4 * reach, -5.8 * reach]} intensity={1.32} color="#b8d6ff" />
    </>
  )
}
