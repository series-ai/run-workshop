import { Card, riffleTraced } from '@clubhouse'

// A card's placement on the table. y is height above the felt, yaw is its
// spin about the vertical, tilt lifts the near edge while a card is airborne.
export interface Pose {
  x: number
  y: number
  z: number
  yaw: number
  tilt: number
}

// One eased move. Cards hold their last pose until the next leg starts.
export interface Leg {
  start: number
  end: number
  from: Pose
  to: Pose
  // Peak extra height at the middle of the leg, for arcs.
  lift: number
}

export interface CardPlan {
  legs: Leg[]
  // Time at which this card turns over, or null to leave it as it is.
  flipAt: number | null
  faceUp: boolean
}

export interface TablePlan {
  // Card order after the plan finishes.
  order: Card[]
  // Per-card plans, indexed to match `order`.
  plans: CardPlan[]
  duration: number
}

export const DECK_HOME = { x: -1.95, z: 1.15 }
// Vertical spacing between cards in a squared-up stack.
export const STACK_STEP = 0.017
const HALF_OFFSET = 1.05
const FAN_PIVOT = { x: 0.6, z: 3.4 }
const FAN_RADIUS = 2.3
const FAN_SPREAD = 1.16

export function stackPose(index: number, jitter = 0): Pose {
  return {
    x: DECK_HOME.x + jitter * 0.02,
    y: index * STACK_STEP,
    z: DECK_HOME.z + jitter * 0.02,
    yaw: jitter * 0.03,
    tilt: 0,
  }
}

export function fanPose(index: number, count: number): Pose {
  const t = count === 1 ? 0 : index / (count - 1) - 0.5
  const angle = t * FAN_SPREAD
  return {
    x: FAN_PIVOT.x + Math.sin(angle) * FAN_RADIUS,
    y: 0.004 + index * 0.004,
    z: FAN_PIVOT.z - Math.cos(angle) * FAN_RADIUS,
    yaw: -angle,
    tilt: 0,
  }
}

// Every card returns to a squared stack, face down.
export function gatherPlan(order: Card[], from: Pose[]): TablePlan {
  const plans = order.map((_, i) => {
    // The top of the stack goes home first, so the pile builds downward.
    const delay = (order.length - 1 - i) * 0.045
    return {
      legs: [
        {
          start: delay,
          end: delay + 0.42,
          from: from[i],
          to: stackPose(i, hash(i)),
          lift: 0.34,
        },
      ],
      flipAt: delay,
      faceUp: false,
    }
  })
  return { order, plans, duration: order.length * 0.045 + 0.5 }
}

// Cards leave the top of the deck one at a time and land in a fan, turning
// over as they travel.
export function dealPlan(order: Card[], from: Pose[]): TablePlan {
  const n = order.length
  const plans = order.map((_, i) => {
    // The top card of the stack is dealt first.
    const delay = (n - 1 - i) * 0.085
    return {
      legs: [
        {
          start: delay,
          end: delay + 0.46,
          from: from[i],
          to: fanPose(i, n),
          lift: 0.6,
        },
      ],
      flipAt: delay + 0.12,
      faceUp: true,
    }
  })
  return { order, plans, duration: (n - 1) * 0.085 + 0.5 }
}

const SPLIT = 0.22
const DROP = 0.5
const SQUARE = 0.16
const PASS = SPLIT + DROP + SQUARE

// Three riffles, each animated as split, interleave, square up. The order the
// cards end in is the order the riffle actually produced.
export function shufflePlan(order: Card[], from: Pose[], passes = 3): TablePlan {
  const n = order.length
  const legs: Leg[][] = order.map(() => [])
  // Where each card sits at the start of the pass, keyed by card identity.
  let current = order.slice()
  let poseOf = new Map<Card, Pose>(order.map((c, i) => [c, from[i]]))

  for (let pass = 0; pass < passes; pass++) {
    const t0 = pass * PASS
    const trace = riffleTraced(current)
    const nextPose = new Map<Card, Pose>()

    // Split: the two halves slide apart, the right half riding a little high.
    const splitPose = new Map<Card, Pose>()
    current.forEach((card, i) => {
      const isLeft = i < trace.cut
      const withinHalf = isLeft ? i : i - trace.cut
      splitPose.set(card, {
        x: DECK_HOME.x + (isLeft ? -HALF_OFFSET : HALF_OFFSET),
        y: withinHalf * STACK_STEP + (isLeft ? 0 : 0.02),
        z: DECK_HOME.z,
        yaw: isLeft ? -0.05 : 0.05,
        tilt: 0,
      })
    })

    // Drop: cards fall into the merged pile in the order the riffle chose.
    trace.cards.forEach((card, k) => {
      const target = stackPose(k, hash(k + pass * 13))
      nextPose.set(card, target)
      const index = current.indexOf(card)
      const dropStart = t0 + SPLIT + (k / n) * DROP * 0.8
      const dropEnd = dropStart + DROP * 0.32
      legs[index].push({
        start: t0,
        end: t0 + SPLIT,
        from: poseOf.get(card)!,
        to: splitPose.get(card)!,
        lift: 0.12,
      })
      legs[index].push({
        start: dropStart,
        end: dropEnd,
        from: splitPose.get(card)!,
        to: { ...target, y: target.y + 0.03 },
        lift: 0.18,
      })
      // Each card squares up from the moment its own drop lands. A fixed
      // start would overlap the drop for the last cards of the pass, and
      // poseAt would leave the drop part way into the square-up.
      legs[index].push({
        start: dropEnd,
        end: t0 + PASS,
        from: { ...target, y: target.y + 0.03 },
        to: target,
        lift: 0,
      })
    })

    // The next pass starts from the merged pile, in the new order.
    const reordered = trace.cards
    const reorderedLegs = reordered.map((card) => legs[current.indexOf(card)])
    legs.length = 0
    legs.push(...reorderedLegs)
    current = reordered
    poseOf = nextPose
  }

  return {
    order: current,
    plans: current.map((_, i) => ({ legs: legs[i], flipAt: null, faceUp: false })),
    duration: passes * PASS + 0.1,
  }
}

// Small deterministic offset so a squared stack still looks hand-stacked.
function hash(i: number): number {
  const s = Math.sin(i * 12.9898) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}
