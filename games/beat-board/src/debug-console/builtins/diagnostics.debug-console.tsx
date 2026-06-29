import { Settings } from '@modules/ui/skin/semantic'
import type { DebugConsoleModuleFactoryExport } from '../types'

export const createDebugConsoleModule: DebugConsoleModuleFactoryExport['createDebugConsoleModule'] = (context) => ({
  id: 'diagnostics',
  title: 'Diagnostics',
  order: 0,
  render: ({ access }) => (
    <Settings.Section title="Diagnostics">
      <Settings.Row
        title="Current Screen"
        control={<span>{context.getCurrentScreen()}</span>}
      />
      <Settings.Row
        title="Access Role"
        control={<span>{access?.role ?? 'loading'}</span>}
      />
    </Settings.Section>
  ),
})
