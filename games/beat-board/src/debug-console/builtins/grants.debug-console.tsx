import { Settings } from '@modules/ui/skin/semantic'
import { getCachedDebugConsoleAccess } from '../access'
import { getVisibleDebugConsoleCommandIds } from '../commands'
import type { DebugConsoleModuleFactoryExport } from '../types'

function readVisibleGrantCommandIds(role = getCachedDebugConsoleAccess()): string[] {
  return getVisibleDebugConsoleCommandIds(role)
    .filter((commandId) => commandId.startsWith('grant-'))
}

export const createDebugConsoleModule: DebugConsoleModuleFactoryExport['createDebugConsoleModule'] = () => ({
  id: 'grants',
  title: 'Grants',
  order: 4,
  render: ({ access }) => (
    <Settings.Section title="Grants">
      <Settings.Row
        title="Available Grants"
        control={<span>{readVisibleGrantCommandIds(access ?? getCachedDebugConsoleAccess()).join(', ') || 'No grant providers'}</span>}
      />
    </Settings.Section>
  ),
})
