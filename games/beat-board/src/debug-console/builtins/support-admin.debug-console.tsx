import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { Settings } from '@modules/ui/skin/semantic'
import type { DebugConsoleModuleFactoryExport } from '../types'

interface AdminAppApi {
  adminUgc?: unknown
  adminImageGen?: unknown
}

export const createDebugConsoleModule: DebugConsoleModuleFactoryExport['createDebugConsoleModule'] = () => {
  const appApi = (RundotAPI as typeof RundotAPI & { app?: AdminAppApi }).app
  const adminSurfaces = [
    appApi?.adminUgc ? 'adminUgc' : null,
    appApi?.adminImageGen ? 'adminImageGen' : null,
  ].filter((entry): entry is string => entry !== null)

  if (adminSurfaces.length === 0) {
    return null
  }

  return {
    id: 'support-admin',
    title: 'Support Admin',
    order: 5,
    minimumRole: 'editor',
    render: () => (
      <Settings.Section title="Support Admin">
        <Settings.Row
          title="Available Surfaces"
          control={<span>{adminSurfaces.join(', ')}</span>}
        />
      </Settings.Section>
    ),
  }
}
