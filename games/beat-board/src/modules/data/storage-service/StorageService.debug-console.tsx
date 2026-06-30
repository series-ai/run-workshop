import { useState } from 'react'
import { z } from 'zod'
import type { PersistenceManager } from './PersistenceManager'
import type { StorageScope, StorageService } from './StorageService'

interface DebugConsoleContext {
  getBinding: <T>(id: string) => T | undefined
}

const STORAGE_BINDING_ID = 'data/storage-service:service'
const PERSISTENCE_BINDING_ID = 'data/storage-service:persistence-manager'
const STORAGE_SCOPES = ['appStorage', 'globalStorage', 'deviceCache'] as const

function getStorageService(context: DebugConsoleContext): StorageService | undefined {
  return context.getBinding<StorageService>(STORAGE_BINDING_ID)
}

function getPersistenceManager(context: DebugConsoleContext): PersistenceManager | undefined {
  return context.getBinding<PersistenceManager>(PERSISTENCE_BINDING_ID)
}

function requireStorageService(context: DebugConsoleContext): StorageService {
  const service = getStorageService(context)
  if (!service) {
    throw new Error(
      `Storage service not wired. Register ${STORAGE_BINDING_ID} from your game bootstrap.`,
    )
  }

  return service
}

function summarizeRawValue(value: string | null): string {
  if (value === null) {
    return 'missing'
  }

  return value.length > 120
    ? `${value.slice(0, 117)}...`
    : value
}

function safeJsonPreview(value: string | null): string {
  if (value === null) {
    return 'missing'
  }

  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return 'not json'
  }
}

async function inspectStorageKey(
  service: StorageService,
  scope: StorageScope,
  key: string,
): Promise<{
  key: string
  scope: StorageScope
  prefixedKey: string
  rawValue: string | null
  jsonPreview: string
}> {
  const storage = service.getStorage(scope)
  const rawValue = await storage.getItem(key)

  return {
    key,
    scope,
    prefixedKey: service.getDebugSnapshot(scope, key).prefixedKey,
    rawValue,
    jsonPreview: safeJsonPreview(rawValue),
  }
}

function StorageServiceDebugPanel({ context }: { context: DebugConsoleContext }) {
  const [scope, setScope] = useState<StorageScope>('appStorage')
  const [key, setKey] = useState('')
  const [status, setStatus] = useState('idle')
  const [prefixedKey, setPrefixedKey] = useState('')
  const [rawValue, setRawValue] = useState<string | null>(null)
  const [jsonPreview, setJsonPreview] = useState('missing')
  const service = getStorageService(context)
  const persistenceDiagnostics = getPersistenceManager(context)?.getDebugDiagnostics() ?? null

  async function handleInspect(): Promise<void> {
    if (!service || key.trim().length === 0) {
      return
    }

    setStatus('loading')
    try {
      const result = await inspectStorageKey(service, scope, key.trim())
      setPrefixedKey(result.prefixedKey)
      setRawValue(result.rawValue)
      setJsonPreview(result.jsonPreview)
      setStatus(result.rawValue === null ? 'missing' : 'loaded')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    }
  }

  if (!service) {
    return (
      <section style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
        <h3>Storage Service</h3>
        <span>Binding Status: not wired</span>
        <span>Register `data/storage-service:service` to enable storage inspection.</span>
      </section>
    )
  }

  return (
    <section style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
      <h3>Storage Service</h3>
      <label style={{ display: 'grid', gap: '4px' }}>
        <span>Scope</span>
        <select value={scope} onChange={(event) => setScope(event.currentTarget.value as StorageScope)}>
          {STORAGE_SCOPES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'grid', gap: '4px' }}>
        <span>Key</span>
        <input value={key} onChange={(event) => setKey(event.currentTarget.value)} />
      </label>
      <button type="button" onClick={() => void handleInspect()}>
        Inspect Key
      </button>
      <span>Status: {status}</span>
      <span>Prefixed Key: {prefixedKey || 'n/a'}</span>
      <label style={{ display: 'grid', gap: '4px' }}>
        <span>Raw Value</span>
        <textarea readOnly rows={4} value={rawValue ?? 'missing'} />
      </label>
      <label style={{ display: 'grid', gap: '4px' }}>
        <span>JSON Preview</span>
        <textarea readOnly rows={6} value={jsonPreview} />
      </label>
      {persistenceDiagnostics ? (
        <>
          <span>Persistence Initialized: {String(persistenceDiagnostics.initialized)}</span>
          <span>Registered Keys: {persistenceDiagnostics.registeredKeys.join(', ') || 'none'}</span>
          <span>Dirty Keys: {persistenceDiagnostics.dirtyKeys.join(', ') || 'none'}</span>
          <span>Pending Keys: {persistenceDiagnostics.pendingKeys.join(', ') || 'none'}</span>
        </>
      ) : (
        <span>Persistence Manager: not wired</span>
      )}
    </section>
  )
}

export const createDebugConsoleModule = (context: DebugConsoleContext) => ({
  id: 'data/storage-service',
  title: 'Storage Service',
  minimumRole: 'editor' as const,
  commands: [
    {
      id: 'data/storage-service:inspect-key',
      label: 'Inspect Storage Key',
      description: 'Inspect an exact key in appStorage, globalStorage, or deviceCache.',
      minimumRole: 'editor' as const,
      safety: 'diagnostic' as const,
      schema: z.object({
        scope: z.enum(STORAGE_SCOPES),
        key: z.string().min(1),
      }),
      fields: [
        {
          key: 'scope',
          label: 'Scope',
          kind: 'select' as const,
          getOptions: () => STORAGE_SCOPES.map((scope) => ({ label: scope, value: scope })),
        },
        {
          key: 'key',
          label: 'Key',
          kind: 'text' as const,
        },
      ],
      isEnabled: () => Boolean(getStorageService(context)),
      execute: async ({ scope, key }: { scope: StorageScope; key: string }) => {
        const result = await inspectStorageKey(requireStorageService(context), scope, key)
        return {
          scope: result.scope,
          key: result.key,
          prefixedKey: result.prefixedKey,
          valuePreview: summarizeRawValue(result.rawValue),
          jsonPreview: result.jsonPreview === 'not json' ? 'not json' : 'json',
        }
      },
    },
    {
      id: 'data/storage-service:set-key',
      label: 'Set Storage Key',
      description: 'Set a storage key to a raw string or JSON payload.',
      minimumRole: 'editor' as const,
      safety: 'support-mutation' as const,
      confirm: {
        message: 'Write this storage key?',
        confirmLabel: 'Write Key',
      },
      schema: z.object({
        scope: z.enum(STORAGE_SCOPES),
        key: z.string().min(1),
        value: z.string(),
        parseAsJson: z.boolean().default(false),
      }),
      fields: [
        {
          key: 'scope',
          label: 'Scope',
          kind: 'select' as const,
          getOptions: () => STORAGE_SCOPES.map((scope) => ({ label: scope, value: scope })),
        },
        {
          key: 'key',
          label: 'Key',
          kind: 'text' as const,
        },
        {
          key: 'value',
          label: 'Value',
          kind: 'textarea' as const,
          redact: true,
        },
        {
          key: 'parseAsJson',
          label: 'Validate JSON',
          kind: 'toggle' as const,
        },
      ],
      isEnabled: () => Boolean(getStorageService(context)),
      execute: async ({
        scope,
        key,
        value,
        parseAsJson,
      }: {
        scope: StorageScope
        key: string
        value: string
        parseAsJson: boolean
      }) => {
        if (parseAsJson) {
          JSON.parse(value)
        }

        const service = requireStorageService(context)
        await service.getStorage(scope).setItem(key, value)

        return {
          scope,
          key,
          prefixedKey: service.getDebugSnapshot(scope, key).prefixedKey,
          written: true,
        }
      },
    },
    {
      id: 'data/storage-service:remove-key',
      label: 'Remove Storage Key',
      description: 'Remove an exact key from one storage scope.',
      minimumRole: 'editor' as const,
      safety: 'dangerous-mutation' as const,
      confirm: {
        message: 'Remove this storage key?',
        confirmLabel: 'Remove',
      },
      schema: z.object({
        scope: z.enum(STORAGE_SCOPES),
        key: z.string().min(1),
      }),
      fields: [
        {
          key: 'scope',
          label: 'Scope',
          kind: 'select' as const,
          getOptions: () => STORAGE_SCOPES.map((scope) => ({ label: scope, value: scope })),
        },
        {
          key: 'key',
          label: 'Key',
          kind: 'text' as const,
        },
      ],
      isEnabled: () => Boolean(getStorageService(context)),
      execute: async ({ scope, key }: { scope: StorageScope; key: string }) => {
        const service = requireStorageService(context)
        await service.getStorage(scope).removeItem(key)
        return {
          scope,
          key,
          removed: true,
        }
      },
    },
    {
      id: 'data/storage-service:flush-persistence',
      label: 'Flush Persistence',
      description: 'Flush all dirty persistence keys immediately.',
      minimumRole: 'editor' as const,
      safety: 'support-mutation' as const,
      schema: z.object({}),
      isEnabled: () => Boolean(getPersistenceManager(context)),
      execute: async () => {
        const persistenceManager = getPersistenceManager(context)
        if (!persistenceManager) {
          throw new Error(
            `Persistence manager not wired. Register ${PERSISTENCE_BINDING_ID} from your game bootstrap.`,
          )
        }

        await persistenceManager.flush()
        return persistenceManager.getDebugDiagnostics()
      },
    },
    {
      id: 'data/storage-service:restore-persistence',
      label: 'Restore Persistence',
      description: 'Run restoreAll() against registered persistence keys.',
      minimumRole: 'editor' as const,
      safety: 'support-mutation' as const,
      schema: z.object({}),
      isEnabled: () => Boolean(getPersistenceManager(context)),
      execute: async () => {
        const persistenceManager = getPersistenceManager(context)
        if (!persistenceManager) {
          throw new Error(
            `Persistence manager not wired. Register ${PERSISTENCE_BINDING_ID} from your game bootstrap.`,
          )
        }

        await persistenceManager.restoreAll()
        return persistenceManager.getDebugDiagnostics()
      },
    },
  ],
  render: () => <StorageServiceDebugPanel context={context} />,
})
