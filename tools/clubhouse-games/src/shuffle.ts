// Riffle shuffling, modelled the way a hand actually does it: cut the packet
// near the middle, then release cards from whichever half is heavier.

export interface RiffleOptions {
  rng?: () => number
  // How far the cut may stray from the middle, as a fraction of the packet.
  cutVariance?: number
}

// One riffle: cut, then interleave. Follows the Gilbert-Shannon-Reeds model,
// where the chance of the next card coming from a half is that half's share
// of the cards still to drop.
export function riffle<T>(cards: readonly T[], opts: RiffleOptions = {}): T[] {
  const rng = opts.rng ?? Math.random
  const variance = opts.cutVariance ?? 0.16
  if (cards.length < 2) return cards.slice()

  const jitter = (rng() - 0.5) * 2 * variance * cards.length
  const cut = Math.min(
    cards.length - 1,
    Math.max(1, Math.round(cards.length / 2 + jitter)),
  )
  const left = cards.slice(0, cut)
  const right = cards.slice(cut)

  const out: T[] = []
  let i = 0
  let j = 0
  while (i < left.length || j < right.length) {
    const remainingLeft = left.length - i
    const remainingRight = right.length - j
    if (remainingLeft === 0) out.push(right[j++])
    else if (remainingRight === 0) out.push(left[i++])
    else if (rng() < remainingLeft / (remainingLeft + remainingRight)) out.push(left[i++])
    else out.push(right[j++])
  }
  return out
}

// Which half each card came from on the last riffle, in the order they were
// dropped. The table demo uses this to animate the interleave.
export interface RiffleTrace<T> {
  cards: T[]
  cut: number
  // fromLeft[k] is true when the card now at index k fell from the left half.
  fromLeft: boolean[]
}

export function riffleTraced<T>(cards: readonly T[], opts: RiffleOptions = {}): RiffleTrace<T> {
  const rng = opts.rng ?? Math.random
  const variance = opts.cutVariance ?? 0.16
  if (cards.length < 2) {
    return { cards: cards.slice(), cut: cards.length, fromLeft: cards.map(() => true) }
  }

  const jitter = (rng() - 0.5) * 2 * variance * cards.length
  const cut = Math.min(
    cards.length - 1,
    Math.max(1, Math.round(cards.length / 2 + jitter)),
  )
  const left = cards.slice(0, cut)
  const right = cards.slice(cut)

  const out: T[] = []
  const fromLeft: boolean[] = []
  let i = 0
  let j = 0
  while (i < left.length || j < right.length) {
    const remainingLeft = left.length - i
    const remainingRight = right.length - j
    const takeLeft =
      remainingRight === 0 ||
      (remainingLeft > 0 && rng() < remainingLeft / (remainingLeft + remainingRight))
    out.push(takeLeft ? left[i++] : right[j++])
    fromLeft.push(takeLeft)
  }
  return { cards: out, cut, fromLeft }
}

// A shuffle is several riffles. Seven is the usual number quoted for a full
// 52-card deck; fewer leaves the order visibly related to where it started.
export function riffleShuffle<T>(cards: readonly T[], times = 7, opts: RiffleOptions = {}): T[] {
  if (times < 1) throw new Error(`riffleShuffle needs at least one pass, got ${times}`)
  let out = cards.slice()
  for (let i = 0; i < times; i++) out = riffle(out, opts)
  return out
}
