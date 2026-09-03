export interface TossVec {
  x: number
  y: number
  z: number
}

export interface TossQuat {
  x: number
  y: number
  z: number
  w: number
}

export interface TossBody {
  position: TossVec
  velocity: TossVec
  quaternion: TossQuat
  angularVelocity: TossVec
  settled: boolean
  bounces: number
}

export interface TossOptions {
  restY: number
  radius: number
  gravity?: number
  restitution?: number
  friction?: number
  settleSpeed?: number
  homeX?: number
  homeZ?: number
  maxDist?: number
}

const DEFAULT_GRAVITY = -22
const DEFAULT_RESTITUTION = 0.42
const DEFAULT_FRICTION = 0.62
const DEFAULT_SETTLE = 0.55

function mulQuat(a: TossQuat, b: TossQuat): TossQuat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  }
}

function normQuat(q: TossQuat): void {
  const n = Math.hypot(q.x, q.y, q.z, q.w) || 1
  q.x /= n
  q.y /= n
  q.z /= n
  q.w /= n
}

export function startToss(homeX: number, homeZ: number, radius: number, rng = Math.random): TossBody {
  const axisX = rng() * 2 - 1
  const axisY = rng() * 2 - 1
  const axisZ = rng() * 2 - 1
  const spin = 10 + rng() * 10
  const len = Math.hypot(axisX, axisY, axisZ) || 1
  return {
    position: {
      x: homeX + (rng() - 0.5) * 0.2,
      y: radius + 2.4 + rng() * 0.6,
      z: homeZ + (rng() - 0.5) * 0.2,
    },
    velocity: {
      x: (rng() - 0.5) * 0.9,
      y: 2.2 + rng() * 1.6,
      z: (rng() - 0.5) * 0.9,
    },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    angularVelocity: {
      x: (axisX / len) * spin,
      y: (axisY / len) * spin,
      z: (axisZ / len) * spin,
    },
    settled: false,
    bounces: 0,
  }
}

export function stepToss(body: TossBody, dt: number, opts: TossOptions): void {
  if (body.settled) return
  if (dt <= 0) throw new Error(`stepToss dt must be positive, got ${dt}`)

  const gravity = opts.gravity ?? DEFAULT_GRAVITY
  const restitution = opts.restitution ?? DEFAULT_RESTITUTION
  const friction = opts.friction ?? DEFAULT_FRICTION
  const settleSpeed = opts.settleSpeed ?? DEFAULT_SETTLE
  const restY = opts.restY

  body.velocity.y += gravity * dt
  body.position.x += body.velocity.x * dt
  body.position.y += body.velocity.y * dt
  body.position.z += body.velocity.z * dt

  const wx = body.angularVelocity.x
  const wy = body.angularVelocity.y
  const wz = body.angularVelocity.z
  const angle = Math.hypot(wx, wy, wz) * dt
  if (angle > 0) {
    const s = Math.sin(angle / 2)
    const c = Math.cos(angle / 2)
    const inv = 1 / Math.hypot(wx, wy, wz)
    const dq: TossQuat = { x: wx * inv * s, y: wy * inv * s, z: wz * inv * s, w: c }
    const next = mulQuat(dq, body.quaternion)
    body.quaternion.x = next.x
    body.quaternion.y = next.y
    body.quaternion.z = next.z
    body.quaternion.w = next.w
    normQuat(body.quaternion)
  }

  if (body.position.y < restY) {
    body.position.y = restY
    if (body.velocity.y < 0) {
      body.velocity.y = -body.velocity.y * restitution
      body.velocity.x *= friction
      body.velocity.z *= friction
      body.angularVelocity.x *= friction
      body.angularVelocity.y *= friction
      body.angularVelocity.z *= friction
      body.bounces += 1
    }
  }

  const homeX = opts.homeX ?? 0
  const homeZ = opts.homeZ ?? 0
  const maxDist = opts.maxDist ?? 1.15
  const dx = body.position.x - homeX
  const dz = body.position.z - homeZ
  const dist = Math.hypot(dx, dz)
  if (dist > maxDist) {
    const s = maxDist / dist
    body.position.x = homeX + dx * s
    body.position.z = homeZ + dz * s
    body.velocity.x *= 0.35
    body.velocity.z *= 0.35
  }

  const speed = Math.hypot(body.velocity.x, body.velocity.y, body.velocity.z)
  const spin = Math.hypot(body.angularVelocity.x, body.angularVelocity.y, body.angularVelocity.z)
  if (
    body.bounces >= 1 &&
    body.position.y <= restY + 1e-4 &&
    speed < settleSpeed &&
    spin < settleSpeed * 3
  ) {
    body.position.y = restY
    body.velocity.x = 0
    body.velocity.y = 0
    body.velocity.z = 0
    body.angularVelocity.x = 0
    body.angularVelocity.y = 0
    body.angularVelocity.z = 0
    body.settled = true
  }
}
