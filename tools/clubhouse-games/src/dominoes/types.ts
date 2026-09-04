// Pip values on one side of a domino.
export type PipValue = 0 | 1 | 2 | 3 | 4 | 5 | 6

// A domino tile. By convention left >= right so each unordered pair has
// exactly one representation.
export interface Domino {
  left: PipValue
  right: PipValue
}

export function dominoId(d: Domino): string {
  return `${d.left}-${d.right}`
}

export function parseDominoId(id: string): Domino {
  const m = /^([0-6])-([0-6])$/.exec(id)
  if (!m) throw new Error(`Invalid domino id: ${JSON.stringify(id)}`)
  const left = Number(m[1]) as PipValue
  const right = Number(m[2]) as PipValue
  if (left < right) throw new Error(`Domino id must be high side first: ${JSON.stringify(id)}`)
  return { left, right }
}
