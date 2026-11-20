import { leafFor, type PolyLeafKind, type PolyPackKey } from '@chisel/contracts/packs'

export function leafId(pack: PolyPackKey, kind: PolyLeafKind): string {
  return leafFor(pack, kind).id
}
