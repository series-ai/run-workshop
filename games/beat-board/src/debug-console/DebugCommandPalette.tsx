import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Settings, Switch } from '@modules/ui/skin/semantic'
import { getCachedDebugConsoleAccess, type DebugConsoleAccess } from './access'
import {
  applyDebugCommandFieldValue,
  executeDebugConsoleCommandById,
  executeDebugConsoleTextCommand,
  getDebugConsoleExecutionLog,
  getVisibleDebugConsoleCommands,
  resolveDebugCommandFields,
  subscribeToDebugConsoleExecutionLog,
} from './commands'

interface DebugCommandPaletteProps {
  access: DebugConsoleAccess | null
  registryVersion: number
}

function normalizeSearchValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isSubsequence(query: string, candidate: string): boolean {
  if (!query) {
    return true
  }

  let candidateIndex = 0
  for (const queryChar of query) {
    candidateIndex = candidate.indexOf(queryChar, candidateIndex)
    if (candidateIndex === -1) {
      return false
    }
    candidateIndex += 1
  }

  return true
}

function matchesQuery(query: string, command: ReturnType<typeof getVisibleDebugConsoleCommands>[number]): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) {
    return true
  }

  const haystack = [
    command.id,
    command.label,
    command.description ?? '',
    ...(command.aliases ?? []),
  ]
    .join(' ')
    .toLowerCase()

  if (haystack.includes(normalized)) {
    return true
  }

  return isSubsequence(
    normalizeSearchValue(normalized),
    normalizeSearchValue(haystack),
  )
}

export function DebugCommandPalette({ access, registryVersion }: DebugCommandPaletteProps) {
  const effectiveAccess = access ?? getCachedDebugConsoleAccess()
  const visibleCommands = useMemo(() => {
    void registryVersion
    return getVisibleDebugConsoleCommands(effectiveAccess)
  }, [effectiveAccess, registryVersion])
  const [query, setQuery] = useState('')
  const [selectedCommandId, setSelectedCommandId] = useState<string | null>(null)
  const [formArgs, setFormArgs] = useState<Record<string, unknown>>({})
  const [fieldDescriptors, setFieldDescriptors] = useState<Array<{
    key: string
    label: string
    kind: 'text' | 'number' | 'select' | 'textarea' | 'toggle'
    enabled: boolean
    options: Array<{ label: string; value: string }>
  }>>([])
  const [executionMessage, setExecutionMessage] = useState<string | null>(null)
  const [, setExecutionLogVersion] = useState(0)

  const matchingCommands = useMemo(
    () => visibleCommands.filter((command) => matchesQuery(query, command)),
    [query, visibleCommands],
  )
  const autocompleteOptions = useMemo(() => {
    const seen = new Set<string>()
    return visibleCommands.flatMap((command) => {
      const options = [command.label, command.id, ...(command.aliases ?? [])]
      return options.filter((option) => {
        if (seen.has(option)) {
          return false
        }
        seen.add(option)
        return true
      })
    })
  }, [visibleCommands])
  const selectedCommand = useMemo(
    () => visibleCommands.find((command) => command.id === selectedCommandId) ?? null,
    [selectedCommandId, visibleCommands],
  )

  function updateQuery(nextValue: string): void {
    setQuery(nextValue)
  }

  useEffect(() => {
    return subscribeToDebugConsoleExecutionLog(() => {
      setExecutionLogVersion((version) => version + 1)
    })
  }, [])

  useEffect(() => {
    if (!selectedCommandId && matchingCommands[0]) {
      setSelectedCommandId(matchingCommands[0].id)
    }
  }, [matchingCommands, selectedCommandId])

  useEffect(() => {
    setFormArgs({})
    setExecutionMessage(null)
  }, [selectedCommandId])

  useEffect(() => {
    if (!selectedCommandId) {
      setFieldDescriptors([])
      return
    }

    let cancelled = false
    void resolveDebugCommandFields(selectedCommandId, formArgs, {
      access: effectiveAccess,
    }).then((nextFields) => {
      if (!cancelled) {
        setFieldDescriptors(nextFields)
      }
    })

    return () => {
      cancelled = true
    }
  }, [effectiveAccess, formArgs, selectedCommandId])

  async function runSelectedCommand(): Promise<void> {
    if (!selectedCommandId) {
      return
    }

    const result = await executeDebugConsoleCommandById(selectedCommandId, formArgs, {
      access: effectiveAccess,
    })
    setExecutionMessage(result.status === 'success' ? 'success' : result.error ?? 'error')
  }

  async function runTextCommand(): Promise<void> {
    const result = await executeDebugConsoleTextCommand(query, {
      access: effectiveAccess,
    })
    setExecutionMessage(result.status === 'success' ? 'success' : result.error ?? 'error')
  }

  return (
    <>
      <Settings.Section title="Command Palette">
        <div style={{ display: 'grid', gap: '8px' }}>
          <Input.Text
            aria-label="Debug command input"
            label="Command"
            list="debug-command-autocomplete"
            placeholder="screen settings"
            value={query}
            onChange={(event) => {
              updateQuery(event.currentTarget.value)
            }}
            onInput={(event) => {
              updateQuery((event.target as HTMLInputElement).value)
              }}
            />
            <datalist id="debug-command-autocomplete">
              {autocompleteOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {matchingCommands.map((command) => (
                <Button.Ghost
                  key={command.id}
                  onClick={() => {
                  setSelectedCommandId(command.id)
                }}
              >
                {command.label}
              </Button.Ghost>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button.Secondary
              disabled={query.trim().length === 0}
              onClick={() => {
                void runTextCommand()
              }}
            >
              Run Text
            </Button.Secondary>
            {executionMessage ? <span>{executionMessage}</span> : null}
          </div>
        </div>
      </Settings.Section>

      {selectedCommand ? (
        <Settings.Section title={selectedCommand.label}>
          <div style={{ display: 'grid', gap: '8px' }}>
            {selectedCommand.description ? <span>{selectedCommand.description}</span> : null}
            {fieldDescriptors.map((field) => {
              const ariaLabel = `${selectedCommand.label} ${field.label}`
              const value = formArgs[field.key]

              if (field.kind === 'select') {
                return (
                  <Input.Select
                    key={field.key}
                    aria-label={ariaLabel}
                    disabled={!field.enabled}
                    label={field.label}
                    value={String(value ?? '')}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.value
                      setFormArgs((currentArgs) => applyDebugCommandFieldValue(
                        selectedCommand.id,
                        currentArgs,
                        field.key,
                        nextValue,
                        { access: effectiveAccess },
                      ))
                    }}
                  >
                    <option value="">Select…</option>
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Input.Select>
                )
              }

              if (field.kind === 'toggle') {
                return (
                  <Switch
                    key={field.key}
                    aria-label={ariaLabel}
                    checked={Boolean(value)}
                    disabled={!field.enabled}
                    label={field.label}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.checked
                      setFormArgs((currentArgs) => applyDebugCommandFieldValue(
                        selectedCommand.id,
                        currentArgs,
                        field.key,
                        nextValue,
                        { access: effectiveAccess },
                      ))
                    }}
                  />
                )
              }

              if (field.kind === 'textarea') {
                return (
                  <Input.Textarea
                    key={field.key}
                    aria-label={ariaLabel}
                    disabled={!field.enabled}
                    label={field.label}
                    value={String(value ?? '')}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.value
                      setFormArgs((currentArgs) => applyDebugCommandFieldValue(
                        selectedCommand.id,
                        currentArgs,
                        field.key,
                        nextValue,
                        { access: effectiveAccess },
                      ))
                    }}
                  />
                )
              }

              return (
                <Input.Text
                  key={field.key}
                  aria-label={ariaLabel}
                  disabled={!field.enabled}
                  label={field.label}
                  type={field.kind === 'number' ? 'number' : 'text'}
                  value={String(value ?? '')}
                  onChange={(event) => {
                    const nextValue = event.currentTarget.value
                    setFormArgs((currentArgs) => applyDebugCommandFieldValue(
                      selectedCommand.id,
                      currentArgs,
                      field.key,
                      nextValue,
                      { access: effectiveAccess },
                    ))
                  }}
                />
              )
            })}
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button.Primary
                onClick={() => {
                  void runSelectedCommand()
                }}
              >
                Run Command
              </Button.Primary>
              {executionMessage ? <span>{executionMessage}</span> : null}
            </div>
          </div>
        </Settings.Section>
      ) : null}

      <Settings.Section title="Execution Log">
        {getDebugConsoleExecutionLog().map((entry) => (
          <Settings.Row
            key={`${entry.commandId}-${entry.timestamp}`}
            title={entry.commandId}
            control={<span>{entry.status}</span>}
          />
        ))}
      </Settings.Section>
    </>
  )
}
