import RundotAPI from '@series-inc/rundot-game-sdk/api'

export type DebugConsoleRole = 'owner' | 'editor' | 'player' | 'anonymous'
export type DebugConsoleAccessThreshold = DebugConsoleRole

export interface DebugConsoleAccess {
  role: DebugConsoleRole
  isOwner: boolean
  isEditor: boolean
  isPlayer: boolean
  canAccessAtLeast: (threshold: DebugConsoleAccessThreshold) => boolean
}

const ACCESS_LEVEL: Record<DebugConsoleRole, number> = {
  anonymous: 0,
  player: 1,
  editor: 2,
  owner: 3,
}

const THRESHOLD_LEVEL: Record<DebugConsoleAccessThreshold, number> = {
  anonymous: 0,
  player: 1,
  editor: 2,
  owner: 3,
}

let cachedAccess: DebugConsoleAccess = createDebugConsoleAccess('anonymous')
let accessOverride: DebugConsoleRole | null = null

export function canAccessAtLeast(
  role: DebugConsoleRole,
  threshold: DebugConsoleAccessThreshold,
): boolean {
  return ACCESS_LEVEL[role] >= THRESHOLD_LEVEL[threshold]
}

export function createDebugConsoleAccess(role: DebugConsoleRole): DebugConsoleAccess {
  return {
    role,
    isOwner: role === 'owner',
    isEditor: role === 'editor' || role === 'owner',
    isPlayer: role === 'player' || role === 'editor' || role === 'owner',
    canAccessAtLeast: (threshold) => canAccessAtLeast(role, threshold),
  }
}

export function getCachedDebugConsoleAccess(): DebugConsoleAccess {
  if (import.meta.env.DEV && accessOverride) {
    return createDebugConsoleAccess(accessOverride)
  }

  return cachedAccess
}

export function setDebugConsoleAccessOverride(role: DebugConsoleRole): void {
  if (!import.meta.env.DEV) {
    return
  }

  accessOverride = role
  cachedAccess = createDebugConsoleAccess(role)
}

export function clearDebugConsoleAccessOverride(): void {
  accessOverride = null
  cachedAccess = createDebugConsoleAccess('anonymous')
}

export async function normalizeDebugConsoleAccess(): Promise<DebugConsoleAccess> {
  if (import.meta.env.DEV && accessOverride) {
    cachedAccess = createDebugConsoleAccess(accessOverride)
    return cachedAccess
  }

  try {
    const profile = await Promise.resolve(RundotAPI.getProfile())
    const appApi = (RundotAPI as { app?: { getMyRole?: () => Promise<'owner' | 'editor' | 'none'> } }).app
    const rawRole = typeof appApi?.getMyRole === 'function'
      ? await appApi.getMyRole()
      : 'none'

    if (rawRole === 'owner') {
      cachedAccess = createDebugConsoleAccess('owner')
      return cachedAccess
    }

    if (rawRole === 'editor') {
      cachedAccess = createDebugConsoleAccess('editor')
      return cachedAccess
    }

    if (profile && profile.isAnonymous === false) {
      cachedAccess = createDebugConsoleAccess('player')
      return cachedAccess
    }
  } catch {
    cachedAccess = createDebugConsoleAccess('anonymous')
    return cachedAccess
  }

  cachedAccess = createDebugConsoleAccess('anonymous')
  return cachedAccess
}
