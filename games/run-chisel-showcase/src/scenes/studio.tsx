import { NeutralToneMapping } from 'three'

/**
 * Studio look that the lab, the context stage and the perf bench share.
 *
 * Three directional lights make each flat facet read: a warm key from the front right, a cool
 * fill from the front left and a cool rim from behind. No light casts a shadow (performance rule P2).
 */

/** Renderer options for each showcase canvas. Neutral tone mapping keeps the palette colors true. */
export const STUDIO_GL = { toneMapping: NeutralToneMapping } as const

export interface StudioLightsProps {
  /** Distance scale of the light positions. Use the approximate radius of the scene. */
  reach?: number
  /** The fill light. The perf bench turns it off to keep the fragment cost low. */
  fill?: boolean
}

export function StudioLights({ reach = 1, fill = true }: StudioLightsProps) {
  return (
    <>
      <hemisphereLight args={['#eef2fb', '#5f5d62', 1.0]} />
      <directionalLight position={[3.2 * reach, 5.5 * reach, 4.6 * reach]} intensity={1.75} color="#fff2df" />
      {fill && <directionalLight position={[-5 * reach, 2.2 * reach, 3.2 * reach]} intensity={0.5} color="#c3d2ec" />}
      <directionalLight position={[-2.4 * reach, 4.2 * reach, -6 * reach]} intensity={0.95} color="#d3e0f4" />
    </>
  )
}
