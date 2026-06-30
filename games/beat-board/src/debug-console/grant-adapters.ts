import { z } from 'zod'
import type { DebugConsoleAccessThreshold } from './access'
import type {
  DebugCommandConfirmation,
  DebugCommandExecuteContext,
  DebugCommandOption,
  DebugGrantProvider,
} from './types'

interface BaseDebugGrantAdapterConfig {
  id?: string
  label?: string
  description?: string
  aliases?: string[]
  minimumRole?: DebugConsoleAccessThreshold
  confirm?: DebugCommandConfirmation
}

export interface DebugCurrencyGrantAdapterConfig extends BaseDebugGrantAdapterConfig {
  getOptions: () => DebugCommandOption[] | Promise<DebugCommandOption[]>
  executeGrant: (
    args: { currencyId: string; amount: number },
    context: DebugCommandExecuteContext,
  ) => unknown | Promise<unknown>
}

export interface DebugInventoryGrantAdapterConfig extends BaseDebugGrantAdapterConfig {
  getOptions: () => DebugCommandOption[] | Promise<DebugCommandOption[]>
  executeGrant: (
    args: { itemId: string; quantity: number },
    context: DebugCommandExecuteContext,
  ) => unknown | Promise<unknown>
}

export function createDebugCurrencyGrantProvider(
  config: DebugCurrencyGrantAdapterConfig,
): DebugGrantProvider {
  return {
    id: config.id ?? 'grant-currency',
    label: config.label ?? 'Grant Currency',
    description: config.description ?? 'Grant a currency balance through a canonical adapter.',
    aliases: config.aliases ?? ['currency-grant'],
    minimumRole: config.minimumRole ?? 'editor',
    confirm: config.confirm,
    schema: z.object({
      currencyId: z.string().min(1),
      amount: z.coerce.number().int().positive(),
    }),
    fields: [
      {
        key: 'currencyId',
        label: 'Currency',
        kind: 'select',
        getOptions: config.getOptions,
      },
      {
        key: 'amount',
        label: 'Amount',
        kind: 'number',
      },
    ],
    executeGrant: config.executeGrant,
  }
}

export function createDebugInventoryGrantProvider(
  config: DebugInventoryGrantAdapterConfig,
): DebugGrantProvider {
  return {
    id: config.id ?? 'grant-item',
    label: config.label ?? 'Grant Item',
    description: config.description ?? 'Grant an inventory item through a canonical adapter.',
    aliases: config.aliases ?? ['item-grant'],
    minimumRole: config.minimumRole ?? 'editor',
    confirm: config.confirm,
    schema: z.object({
      itemId: z.string().min(1),
      quantity: z.coerce.number().int().positive(),
    }),
    fields: [
      {
        key: 'itemId',
        label: 'Item',
        kind: 'select',
        getOptions: config.getOptions,
      },
      {
        key: 'quantity',
        label: 'Quantity',
        kind: 'number',
      },
    ],
    executeGrant: config.executeGrant,
  }
}
