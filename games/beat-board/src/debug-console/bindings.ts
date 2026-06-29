type Listener = () => void

const bindings = new Map<string, unknown>()
const listeners = new Set<Listener>()

function notify(): void {
  listeners.forEach((listener) => listener())
}

export function registerDebugConsoleBinding<T>(id: string, value: T): () => void {
  bindings.set(id, value)
  notify()

  return () => {
    if (bindings.get(id) !== value) {
      return
    }

    bindings.delete(id)
    notify()
  }
}

export function unregisterDebugConsoleBinding(id: string): void {
  if (!bindings.has(id)) {
    return
  }

  bindings.delete(id)
  notify()
}

export function getDebugConsoleBinding<T>(id: string): T | undefined {
  return bindings.get(id) as T | undefined
}

export function clearDebugConsoleBindingsForTesting(): void {
  if (bindings.size === 0) {
    return
  }

  bindings.clear()
  notify()
}

export function subscribeToDebugConsoleBindings(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
