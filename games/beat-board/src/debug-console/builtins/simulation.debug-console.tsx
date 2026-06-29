import { z } from 'zod'
import { Button, Settings } from '@modules/ui/skin/semantic'
import {
  collectDebugSimulationRun,
  executeDebugSimulationRecipe,
  getDebugSimulationSnapshot,
  refreshDebugSimulationSnapshot,
  useDebugSimulationSnapshot,
} from '../simulation'
import type { DebugConsoleModuleFactoryExport } from '../types'

function DebugSimulationSection() {
  const snapshot = useDebugSimulationSnapshot()

  return (
    <Settings.Section title="Simulation">
      <Settings.Row
        title="Recipes"
        control={<span>{snapshot.recipeOptions.length}</span>}
      />
      <Settings.Row
        title="Can Execute"
        control={<span>{snapshot.recipeOptions.map((recipe) => recipe.id).join(', ') || 'None'}</span>}
      />
      <Settings.Row
        title="Active Runs"
        control={<span>{snapshot.activeRuns.length}</span>}
      />
      <Settings.Row
        title="Run IDs"
        control={<span>{snapshot.activeRuns.map((run) => run.runId).join(', ') || 'None'}</span>}
      />
      <Settings.Row
        title="Entities"
        control={<span>{snapshot.entityCount}</span>}
      />
      <Settings.Row
        title="Status"
        control={<span>{snapshot.lastUpdatedAt === null ? 'Not refreshed' : snapshot.lastError ?? 'Ready'}</span>}
      />
      <Settings.Row
        title="Refresh"
        control={(
          <Button.Ghost
            onClick={() => {
              void refreshDebugSimulationSnapshot()
            }}
          >
            Refresh Snapshot
          </Button.Ghost>
        )}
      />
    </Settings.Section>
  )
}

export const createDebugConsoleModule: DebugConsoleModuleFactoryExport['createDebugConsoleModule'] = () => ({
  id: 'simulation',
  title: 'Simulation',
  order: 3,
  commands: [
    {
      id: 'refresh-simulation',
      label: 'Refresh Simulation',
      description: 'Refresh recipe, run, and entity diagnostics.',
      aliases: ['sim-refresh'],
      schema: z.object({}),
      execute: async () => refreshDebugSimulationSnapshot(),
    },
    {
      id: 'execute-recipe',
      label: 'Execute Recipe',
      description: 'Run a recipe through the SDK simulation surface.',
      aliases: ['recipe'],
      minimumRole: 'editor',
      safety: 'support-mutation',
      schema: z.object({
        recipeId: z.string().min(1),
      }),
      fields: [
        {
          key: 'recipeId',
          label: 'Recipe',
          kind: 'select',
          getOptions: async () => {
            await refreshDebugSimulationSnapshot()
            return getDebugSimulationSnapshot().recipeOptions.map((recipe) => ({
              label: recipe.label,
              value: recipe.id,
            }))
          },
        },
      ],
      execute: async ({ recipeId }) => executeDebugSimulationRecipe(recipeId),
    },
    {
      id: 'collect-simulation-run',
      label: 'Collect Active Run',
      description: 'Collect a finished simulation run by run ID.',
      aliases: ['collect-run'],
      minimumRole: 'editor',
      safety: 'support-mutation',
      schema: z.object({
        runId: z.string().min(1),
      }),
      fields: [
        {
          key: 'runId',
          label: 'Run',
          kind: 'select',
          getOptions: async () => {
            await refreshDebugSimulationSnapshot()
            return getDebugSimulationSnapshot().activeRuns.map((run) => ({
              label: run.runId,
              value: run.runId,
            }))
          },
        },
      ],
      execute: async ({ runId }) => collectDebugSimulationRun(runId),
    },
  ],
  render: () => <DebugSimulationSection />,
})
