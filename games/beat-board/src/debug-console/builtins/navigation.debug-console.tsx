import { z } from 'zod'
import { Settings } from '@modules/ui/skin/semantic'
import { listTabs } from '../../shell/navigation'
import { NAVIGATION } from '../../tabs/tabConfig'
import type { DebugConsoleModuleFactoryExport } from '../types'

function getKnownScreens(): string[] {
  return listTabs(NAVIGATION).map(({ id }) => id)
}

export const createDebugConsoleModule: DebugConsoleModuleFactoryExport['createDebugConsoleModule'] = (context) => ({
  id: 'navigation',
  title: 'Navigation',
  order: 1,
  commands: [
    {
      id: 'open-screen',
      label: 'Open Screen',
      description: 'Open a known tab or screen target.',
      aliases: ['screen', 'goto'],
      schema: z.object({
        screen: z.string().min(1),
      }),
      fields: [
        {
          key: 'screen',
          label: 'Screen',
          kind: 'select',
          getOptions: () => getKnownScreens().map((screen) => ({
            label: screen,
            value: screen,
          })),
        },
      ],
      execute: ({ screen }) => {
        window.__GAME_DEBUG__?.ui.openScreen(String(screen))
        return { currentScreen: window.__GAME_DEBUG__?.ui.getCurrentScreen() ?? screen }
      },
    },
    {
      id: 'reset-navigation',
      label: 'Reset Navigation',
      description: 'Return navigation to the default tab.',
      aliases: ['reset-nav'],
      schema: z.object({}),
      execute: () => {
        window.__GAME_DEBUG__?.ui.reset()
        return { currentScreen: window.__GAME_DEBUG__?.ui.getCurrentScreen() ?? context.getCurrentScreen() }
      },
    },
  ],
  render: () => (
    <Settings.Section title="Navigation">
      <Settings.Row
        title="Current Screen"
        control={<span>{context.getCurrentScreen()}</span>}
      />
      <Settings.Row
        title="Known Screens"
        control={<span>{getKnownScreens().join(', ')}</span>}
      />
    </Settings.Section>
  ),
})
