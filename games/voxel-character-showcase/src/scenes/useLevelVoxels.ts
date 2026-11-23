import { useEffect, useState } from 'react'
import { LEVEL_KIT_LEAF, type LevelPackKey } from '@voxchar/contracts/levelPacks'
import { resolveAssetUrl } from '../assetSource'
import { assetRefFor } from '../avatar/composePolyAvatar'
import type { VoxelWorkerResult } from './levelVoxels.worker'

export function useLevelVoxels(pack: LevelPackKey | undefined) {
  const [result, setResult] = useState<{ pack: LevelPackKey; value: VoxelWorkerResult }>()

  useEffect(() => {
    if (!pack) return
    const worker = new Worker(new URL('./levelVoxels.worker.ts', import.meta.url), { type: 'module' })
    let active = true
    const report = (value: VoxelWorkerResult) => {
      if (active) setResult({ pack, value })
      worker.terminate()
    }
    worker.onmessage = ({ data }: MessageEvent<VoxelWorkerResult>) => report(data)
    worker.onerror = event => report({ kind: 'error', message: event.message })
    void resolveAssetUrl(assetRefFor(pack, LEVEL_KIT_LEAF, 'level-kit/demo.voxels.json'))
      .then(url => {
        if (active) worker.postMessage(new URL(url, document.baseURI).href)
      })
      .catch(error => report({ kind: 'error', message: String(error) }))
    return () => {
      active = false
      worker.terminate()
      setResult(undefined)
    }
  }, [pack])

  return pack && result?.pack === pack ? result.value : undefined
}
