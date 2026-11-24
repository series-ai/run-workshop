import { leafFor, type VoxCharLeafKind, type VoxCharPackKey } from '@voxchar/contracts/packs'

export function leafId(pack: VoxCharPackKey, kind: VoxCharLeafKind): string {
  return leafFor(pack, kind).id
}
