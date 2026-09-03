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
  // Seconds spent continuously slow and touching the table.
  restTime: number
}

export interface TossOptions {
  // Height of the table surface. The body rests on it through its corners,
  // so this is the plane itself, not the center height of a resting die.
  tableY: number
  // Contact points in body space, already scaled to world size. Every corner
  // of the die goes in here: corner contacts are what make it tip and tumble.
  vertices: readonly TossVec[]
  // Scalar moment of inertia. A cube of half-size a wants (2/3)a².
  inertia: number
  gravity?: number
  restitution?: number
  friction?: number
  // Per-second velocity decay while airborne.
  linearDamping?: number
  angularDamping?: number
  // Extra spin decay applied only while a corner touches the table.
  rollingFriction?: number
  settleSpeed?: number
  // Half-width of the invisible walls that keep the die on the table.
  bounds?: number
  homeX?: number
  homeZ?: number
}

const DEFAULT_GRAVITY = -26
const DEFAULT_RESTITUTION = 0.32
const DEFAULT_FRICTION = 0.55
const DEFAULT_LINEAR_DAMPING = 0.25
const DEFAULT_ANGULAR_DAMPING = 0.45
const DEFAULT_ROLLING_FRICTION = 3.2
const DEFAULT_SETTLE = 0.32
const DEFAULT_BOUNDS = 1.35
// Time the body must stay slow and in contact before it counts as asleep.
const SLEEP_TIME = 0.12

export function mulQuat(a: TossQuat, b: TossQuat): TossQuat {
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

// Rotates a body-space point into world space.
export function rotateVec(q: TossQuat, v: TossVec): TossVec {
  const ix = q.w * v.x + q.y * v.z - q.z * v.y
  const iy = q.w * v.y + q.z * v.x - q.x * v.z
  const iz = q.w * v.z + q.x * v.y - q.y * v.x
  const iw = -q.x * v.x - q.y * v.y - q.z * v.z
  return {
    x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
  }
}

export interface StartTossOptions {
  homeX: number
  homeZ: number
  // Rest height of the die center, used to place the throw arc above it.
  height: number
  rng?: () => number
}

// A throw comes in from the side of the table with real forward speed, the
// way a hand releases dice, rather than dropping straight down.
export function startToss(opts: StartTossOptions): TossBody {
  const rng = opts.rng ?? Math.random
  const side = rng() < 0.5 ? -1 : 1
  const axisX = rng() * 2 - 1
  const axisY = rng() * 2 - 1
  const axisZ = rng() * 2 - 1
  const spin = 16 + rng() * 14
  const len = Math.hypot(axisX, axisY, axisZ) || 1
  const throwX = opts.homeX + side * (1.5 + rng() * 0.3)
  const throwZ = opts.homeZ + 0.9 + rng() * 0.4
  return {
    position: {
      x: throwX,
      y: opts.height + 1.9 + rng() * 0.5,
      z: throwZ,
    },
    velocity: {
      x: -side * (2.1 + rng() * 1.1),
      y: 1.1 + rng() * 0.8,
      z: -(1.5 + rng() * 0.9),
    },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    angularVelocity: {
      x: (axisX / len) * spin,
      y: (axisY / len) * spin,
      z: (axisZ / len) * spin,
    },
    settled: false,
    bounces: 0,
    restTime: 0,
  }
}

export function stepToss(body: TossBody, dt: number, opts: TossOptions): void {
  if (body.settled) return
  if (dt <= 0) throw new Error(`stepToss dt must be positive, got ${dt}`)
  if (opts.vertices.length === 0) throw new Error('stepToss needs at least one contact vertex')
  if (opts.inertia <= 0) throw new Error(`stepToss inertia must be positive, got ${opts.inertia}`)

  const gravity = opts.gravity ?? DEFAULT_GRAVITY
  const restitution = opts.restitution ?? DEFAULT_RESTITUTION
  const friction = opts.friction ?? DEFAULT_FRICTION
  const linearDamping = opts.linearDamping ?? DEFAULT_LINEAR_DAMPING
  const angularDamping = opts.angularDamping ?? DEFAULT_ANGULAR_DAMPING
  const rollingFriction = opts.rollingFriction ?? DEFAULT_ROLLING_FRICTION
  const settleSpeed = opts.settleSpeed ?? DEFAULT_SETTLE
  const bounds = opts.bounds ?? DEFAULT_BOUNDS
  const homeX = opts.homeX ?? 0
  const homeZ = opts.homeZ ?? 0
  const I = opts.inertia

  integrate(body, dt, gravity)
  applyDamping(body, dt, linearDamping, angularDamping)

  const touching = resolveContacts(body, opts.tableY, opts.vertices, restitution, friction, I)
  if (touching) {
    const decay = Math.max(0, 1 - rollingFriction * dt)
    body.angularVelocity.x *= decay
    body.angularVelocity.y *= decay
    body.angularVelocity.z *= decay
  }

  resolveWalls(body, homeX, homeZ, bounds, restitution)

  const speed = Math.hypot(body.velocity.x, body.velocity.y, body.velocity.z)
  const spin = Math.hypot(body.angularVelocity.x, body.angularVelocity.y, body.angularVelocity.z)
  if (touching && speed < settleSpeed && spin < settleSpeed * 2.5) {
    body.restTime += dt
  } else {
    body.restTime = 0
  }
  if (body.restTime >= SLEEP_TIME) {
    body.velocity.x = 0
    body.velocity.y = 0
    body.velocity.z = 0
    body.angularVelocity.x = 0
    body.angularVelocity.y = 0
    body.angularVelocity.z = 0
    body.settled = true
  }
}

function integrate(body: TossBody, dt: number, gravity: number): void {
  body.velocity.y += gravity * dt
  body.position.x += body.velocity.x * dt
  body.position.y += body.velocity.y * dt
  body.position.z += body.velocity.z * dt

  const { x: wx, y: wy, z: wz } = body.angularVelocity
  const rate = Math.hypot(wx, wy, wz)
  if (rate > 0) {
    const angle = rate * dt
    const s = Math.sin(angle / 2) / rate
    const dq: TossQuat = { x: wx * s, y: wy * s, z: wz * s, w: Math.cos(angle / 2) }
    const next = mulQuat(dq, body.quaternion)
    body.quaternion.x = next.x
    body.quaternion.y = next.y
    body.quaternion.z = next.z
    body.quaternion.w = next.w
    normQuat(body.quaternion)
  }
}

function applyDamping(body: TossBody, dt: number, linear: number, angular: number): void {
  const lin = Math.max(0, 1 - linear * dt)
  const ang = Math.max(0, 1 - angular * dt)
  body.velocity.x *= lin
  body.velocity.y *= lin
  body.velocity.z *= lin
  body.angularVelocity.x *= ang
  body.angularVelocity.y *= ang
  body.angularVelocity.z *= ang
}

// Impulse response at every corner below the table. Because each impulse acts
// at an offset from the center, the body picks up spin from the hit and tips
// onto a face on its own.
function resolveContacts(
  body: TossBody,
  tableY: number,
  vertices: readonly TossVec[],
  restitution: number,
  friction: number,
  I: number,
): boolean {
  let deepest = 0
  let touching = false

  for (const local of vertices) {
    const r = rotateVec(body.quaternion, local)
    const worldY = body.position.y + r.y
    const depth = tableY - worldY
    if (depth < 0) continue
    touching = true
    if (depth > deepest) deepest = depth

    // Velocity of the contact point: v + omega x r.
    const w = body.angularVelocity
    const vp = {
      x: body.velocity.x + (w.y * r.z - w.z * r.y),
      y: body.velocity.y + (w.z * r.x - w.x * r.z),
      z: body.velocity.z + (w.x * r.y - w.y * r.x),
    }
    if (vp.y >= 0) continue

    // Normal impulse. |r x n|^2 with n = (0,1,0) is r.x^2 + r.z^2.
    const rn = r.x * r.x + r.z * r.z
    const jn = (-(1 + restitution) * vp.y) / (1 + rn / I)
    applyImpulse(body, r, { x: 0, y: jn, z: 0 }, I)
    body.bounces += 1

    // Coulomb friction along the contact plane.
    const vt = Math.hypot(vp.x, vp.z)
    if (vt > 1e-5) {
      const tx = -vp.x / vt
      const tz = -vp.z / vt
      // |r x t|^2 for a horizontal tangent.
      const rt = r.y * r.y + (r.x * tz - r.z * tx) ** 2
      let jt = vt / (1 + rt / I)
      const max = friction * jn
      if (jt > max) jt = max
      applyImpulse(body, r, { x: tx * jt, y: 0, z: tz * jt }, I)
    }
  }

  if (deepest > 0) body.position.y += deepest
  return touching
}

// Unit mass, so the linear term is the impulse itself.
function applyImpulse(body: TossBody, r: TossVec, j: TossVec, I: number): void {
  body.velocity.x += j.x
  body.velocity.y += j.y
  body.velocity.z += j.z
  body.angularVelocity.x += (r.y * j.z - r.z * j.y) / I
  body.angularVelocity.y += (r.z * j.x - r.x * j.z) / I
  body.angularVelocity.z += (r.x * j.y - r.y * j.x) / I
}

// Invisible rails around the throwing area, so a hard throw rebounds instead
// of being teleported back.
function resolveWalls(
  body: TossBody,
  homeX: number,
  homeZ: number,
  bounds: number,
  restitution: number,
): void {
  const dx = body.position.x - homeX
  if (dx > bounds && body.velocity.x > 0) {
    body.position.x = homeX + bounds
    body.velocity.x = -body.velocity.x * restitution
  } else if (dx < -bounds && body.velocity.x < 0) {
    body.position.x = homeX - bounds
    body.velocity.x = -body.velocity.x * restitution
  }
  const dz = body.position.z - homeZ
  if (dz > bounds && body.velocity.z > 0) {
    body.position.z = homeZ + bounds
    body.velocity.z = -body.velocity.z * restitution
  } else if (dz < -bounds && body.velocity.z < 0) {
    body.position.z = homeZ - bounds
    body.velocity.z = -body.velocity.z * restitution
  }
}

export interface TossPair {
  body: TossBody
  radius: number
}

// Separates dice that overlap and swaps the velocity along the line between
// them, so a throw of several dice knocks itself apart instead of stacking.
export function resolvePairs(pairs: readonly TossPair[], restitution = 0.4): void {
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const a = pairs[i]
      const b = pairs[j]
      const dx = b.body.position.x - a.body.position.x
      const dy = b.body.position.y - a.body.position.y
      const dz = b.body.position.z - a.body.position.z
      const min = a.radius + b.radius
      const distSq = dx * dx + dy * dy + dz * dz
      if (distSq >= min * min) continue

      // Coincident centers have no separation axis; nudge along x instead.
      const dist = Math.sqrt(distSq)
      const nx = dist > 1e-6 ? dx / dist : 1
      const ny = dist > 1e-6 ? dy / dist : 0
      const nz = dist > 1e-6 ? dz / dist : 0

      const overlap = min - dist
      const push = overlap / 2
      a.body.position.x -= nx * push
      a.body.position.y -= ny * push
      a.body.position.z -= nz * push
      b.body.position.x += nx * push
      b.body.position.y += ny * push
      b.body.position.z += nz * push

      const rvn =
        (b.body.velocity.x - a.body.velocity.x) * nx +
        (b.body.velocity.y - a.body.velocity.y) * ny +
        (b.body.velocity.z - a.body.velocity.z) * nz
      if (rvn >= 0) continue
      // Equal masses, so each body takes half of the exchange.
      const jn = (-(1 + restitution) * rvn) / 2
      a.body.velocity.x -= nx * jn
      a.body.velocity.y -= ny * jn
      a.body.velocity.z -= nz * jn
      b.body.velocity.x += nx * jn
      b.body.velocity.y += ny * jn
      b.body.velocity.z += nz * jn
      // A knock wakes a sleeping die back up.
      a.body.settled = false
      b.body.settled = false
      a.body.restTime = 0
      b.body.restTime = 0
    }
  }
}
