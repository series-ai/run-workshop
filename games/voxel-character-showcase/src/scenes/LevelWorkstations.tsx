import { useMemo } from 'react'
import type { VoxCharPackKey } from '@voxchar/contracts/packs'
import { PolyAvatar } from '../avatar/PolyAvatar'
import { selectionFromPreset, type PolyPartIndex } from '../avatar/composePolyAvatar'
import type { PolyCatalogBundle } from '../catalog'

interface Worker {
  preset: string
  position: [number, number, number]
  yaw: number
  clip: string
  phase: number
}

const workstations: Record<VoxCharPackKey, { stop: string; workers: Worker[] }> = {
  core: {
    stop: 'Wheel lift',
    workers: [
      { preset: 'ind_craftsman', position: [-6.55, 0, -14.25], yaw: -1.18, clip: 'Interact', phase: 0.46 },
    ],
  },
  heist: {
    stop: 'Rotary press line',
    workers: [
      { preset: 'heist_fixer', position: [0.9, 0.02, -8.83], yaw: 2.36, clip: 'Interact', phase: 0.43 },
    ],
  },
  industrial: {
    stop: 'Ingot casting floor',
    workers: [
      { preset: 'ind_foreman', position: [2.35, 0.02, -18.35], yaw: -0.99, clip: 'Interact', phase: 0.53 },
    ],
  },
  security: {
    stop: 'Screening desks',
    workers: [
      { preset: 'sec_night_guard', position: [2.78, 0.02, -15.46], yaw: 1.18, clip: 'Interact', phase: 0.48 },
    ],
  },
  creatures: {
    stop: 'Survey map table',
    workers: [
      { preset: 'heist_lookout', position: [1.92, 0.02, -14.02], yaw: 1.94, clip: 'Interact', phase: 0.53 },
      { preset: 'creature_k9_gsd', position: [1.07, 0.02, -14.51], yaw: 1.67, clip: 'sit_idle', phase: 0.2 },
    ],
  },
  fantasy: {
    stop: 'Coppersmith court',
    workers: [
      { preset: 'fantasy_goblin_scavenger', position: [-7.59, 0, 5.38], yaw: -1.78, clip: 'Interact', phase: 0.48 },
    ],
  },
}

export function LevelWorkstations({ pack, stop, bundle, index }: {
  pack: VoxCharPackKey
  stop?: string
  bundle: PolyCatalogBundle
  index: PolyPartIndex
}) {
  const poses = useMemo(() => {
    const workstation = workstations[pack]
    if (workstation.stop !== stop) return []
    const presets = bundle.ordered.flatMap(catalog => catalog.presets)
    return workstation.workers.map(worker => {
      const preset = presets.find(candidate => candidate.id === worker.preset)
      if (!preset) throw new Error(`Missing workstation preset ${worker.preset}.`)
      const selection = selectionFromPreset(preset)
      selection.clip = worker.clip
      selection.heldRight = null
      selection.heldLeft = null
      return { worker, selection }
    })
  }, [bundle, pack, stop])

  return poses.map(({ worker, selection }) => (
    <PolyAvatar key={worker.preset} selection={selection} index={index} holdPhase={worker.phase} castShadow
      position={worker.position} rotation={[0, worker.yaw, 0]} />
  ))
}
