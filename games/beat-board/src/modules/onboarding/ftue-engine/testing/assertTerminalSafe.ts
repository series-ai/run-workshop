/**
 * assertFtueStoreIsTerminalSafe — contract test for any FTUE-shaped store.
 *
 * Every FTUE store (whether the canonical `ftue-engine` store or a
 * game-specific reimplementation) MUST be a no-op after the flow has been
 * skipped or completed. Without this invariant, a "notify" or "advance"
 * method called from a post-FTUE core-loop button can re-activate the
 * onboarding overlay on top of normal gameplay — the bug class is
 * "re-triggering FTUE on replay".
 *
 * The upstream `FtueStoreFactory.advanceStep` in this module already guards
 * with `if (!state.isActive || !state.currentStepId) return`. This helper
 * lets any OTHER store (a game's custom flow controller) prove it enforces
 * the same invariant. Pair with the repo lint in
 * `scripts/quality/ftue/check-ftue-reimplementation.ts` — the lint requires
 * a call to this helper when it finds an FTUE-shaped store outside this
 * module.
 *
 * The helper is test-runner agnostic: it throws a plain `Error` with a
 * diff-style message on violation and returns void on success.
 */

export interface FtueTerminalSafetyOptions {
  /** Label used in violation messages. Default: "FTUE store". */
  storeLabel?: string
  /**
   * Read the store's current state. Must return an object carrying at least
   * `currentPhase`, `isActive`, `currentStepId`, and `currentSurfaceId`.
   */
  getState: () => Record<string, unknown>
  /**
   * Method names that live on the state object and are expected to be
   * no-ops once the flow is terminal. Typical names: `notify*`, `advanceStep`,
   * `completeCurrentStep`, `startFtue`, `showStep`. The helper reads each
   * method off `getState()` and invokes it with the args from `argsForMethod`
   * (default: no args).
   */
  guardedMethods: string[]
  /** Per-method args factory. Default: () => [] */
  argsForMethod?: (name: string) => unknown[]
  /**
   * Force the store into the 'skipped' terminal state. Typically calls
   * `store.getState().skipAll()`. Required — the helper does not assume.
   */
  forceSkipped: () => void
  /**
   * Force the store into the 'completed' terminal state. Typically walks the
   * full flow then publishes, or calls a terminal helper. Required.
   */
  forceCompleted: () => void
  /** Reset the store to its initial pre-FTUE state between the two phases. */
  resetToInitial: () => void
  /**
   * State fields that ARE allowed to mutate in terminal state because they
   * carry orthogonal data (e.g. `zeroEnergyShopUnlocked` on a game whose
   * prompt/photo solves flip a shop-gate data flag regardless of FTUE
   * status). Mutations to these fields do not count as violations.
   */
  allowedOrthogonalFields?: readonly string[]
  /**
   * Additional state fields that MUST NOT mutate in terminal state. Added to
   * the built-in protected set of
   * { currentPhase, isActive, currentStepId, currentSurfaceId, currentStep,
   *   currentPhaseId, status }.
   */
  alsoProtectedFields?: readonly string[]
}

const BUILTIN_PROTECTED_FIELDS: readonly string[] = [
  // Canonical ftue-engine field names
  'currentPhase',
  'currentStepId',
  'currentStep',
  'currentPhaseId',
  'isActive',
  'isStepHidden',
  'status',
  // Common game-specific surface field name (used by ortho, likely adopted
  // by other games that follow the same multi-surface overlay pattern)
  'currentSurfaceId',
]

interface Violation {
  method: string
  phase: 'skipped' | 'completed'
  field: string
  before: unknown
  after: unknown
}

function formatViolation(v: Violation): string {
  const preview = (value: unknown): string => {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return (
    `  • after ${v.method}() in phase "${v.phase}": ` +
    `field "${v.field}" mutated ${preview(v.before)} → ${preview(v.after)}`
  )
}

function snapshotProtected(
  state: Record<string, unknown>,
  protectedFields: readonly string[],
): Record<string, unknown> {
  const snap: Record<string, unknown> = {}
  for (const field of protectedFields) {
    if (field in state) snap[field] = state[field]
  }
  return snap
}

function runGuardedMethodsIn(
  phase: 'skipped' | 'completed',
  opts: FtueTerminalSafetyOptions,
  protectedFields: readonly string[],
): Violation[] {
  const violations: Violation[] = []
  const argsFactory = opts.argsForMethod ?? (() => [])

  const before = snapshotProtected(opts.getState(), protectedFields)
  // Sanity: the caller's forceSkipped/forceCompleted must actually land us
  // in the advertised phase. A forceSkipped() that sets currentPhase to
  // 'skipped' is a prerequisite for the helper to be meaningful.
  const expectedPhase = phase
  const actualPhase = String(before['currentPhase'] ?? before['status'] ?? '')
  if (actualPhase !== expectedPhase) {
    throw new Error(
      `[assertFtueStoreIsTerminalSafe] forceFor${phase === 'skipped' ? 'Skipped' : 'Completed'}() did not land the store in "${phase}" — got "${actualPhase}". Check the force* hook in the caller.`,
    )
  }

  for (const methodName of opts.guardedMethods) {
    const state = opts.getState()
    const fn = state[methodName]
    if (typeof fn !== 'function') {
      throw new Error(
        `[assertFtueStoreIsTerminalSafe] store.getState().${methodName} is not a function. Remove it from guardedMethods, or add it to the store.`,
      )
    }
    const beforeCall = snapshotProtected(opts.getState(), protectedFields)
    try {
      ;(fn as (...a: unknown[]) => unknown).apply(state, argsFactory(methodName))
    } catch {
      // A method that throws on terminal-state invocation is ALSO acceptable
      // behavior — it means "refuse the late event". Don't count a throw as
      // a mutation; snapshot the state and continue.
    }
    const afterCall = snapshotProtected(opts.getState(), protectedFields)
    for (const field of protectedFields) {
      if (beforeCall[field] !== afterCall[field]) {
        violations.push({
          method: methodName,
          phase,
          field,
          before: beforeCall[field],
          after: afterCall[field],
        })
      }
    }
  }
  return violations
}

/**
 * Assert that every method in `guardedMethods` is a no-op with respect to
 * FTUE-flow fields when the store is in the 'skipped' or 'completed' terminal
 * phase. Throws with a diff-style message on the first violation; returns
 * void on success.
 */
export function assertFtueStoreIsTerminalSafe(opts: FtueTerminalSafetyOptions): void {
  if (opts.guardedMethods.length === 0) {
    throw new Error('[assertFtueStoreIsTerminalSafe] guardedMethods must be a non-empty list')
  }
  const orthogonal = new Set(opts.allowedOrthogonalFields ?? [])
  const protectedFields = [
    ...BUILTIN_PROTECTED_FIELDS,
    ...(opts.alsoProtectedFields ?? []),
  ].filter((field) => !orthogonal.has(field))

  const allViolations: Violation[] = []

  // Phase 1 — skipped
  opts.resetToInitial()
  opts.forceSkipped()
  allViolations.push(...runGuardedMethodsIn('skipped', opts, protectedFields))

  // Phase 2 — completed
  opts.resetToInitial()
  opts.forceCompleted()
  allViolations.push(...runGuardedMethodsIn('completed', opts, protectedFields))

  if (allViolations.length > 0) {
    const label = opts.storeLabel ?? 'FTUE store'
    const lines = [
      `[assertFtueStoreIsTerminalSafe] ${label} mutated protected flow fields in terminal state.`,
      `Every notify*/advance*/start* method must be a no-op once currentPhase is 'skipped' or 'completed'.`,
      `Violations:`,
      ...allViolations.map(formatViolation),
      ``,
      `Fix: add \`if (isFtueTerminal(get())) return\` (or equivalent) to each offending method,`,
      `or whitelist genuinely-orthogonal data fields via allowedOrthogonalFields.`,
    ]
    throw new Error(lines.join('\n'))
  }
}
