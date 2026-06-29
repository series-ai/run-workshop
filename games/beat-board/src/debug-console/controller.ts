export interface DebugConsoleState {
  open: boolean
}

type Listener = () => void

const state: DebugConsoleState = {
  open: false,
}

const listeners = new Set<Listener>()

function notify(): void {
  listeners.forEach((listener) => listener())
}

export function getDebugConsoleState(): DebugConsoleState {
  return state
}

export function isDebugConsoleOpen(): boolean {
  return state.open
}

export function openDebugConsole(): void {
  if (state.open) {
    return
  }

  state.open = true
  notify()
}

export function closeDebugConsole(): void {
  if (!state.open) {
    return
  }

  state.open = false
  notify()
}

export function toggleDebugConsole(): void {
  state.open = !state.open
  notify()
}

export function subscribeToDebugConsole(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
