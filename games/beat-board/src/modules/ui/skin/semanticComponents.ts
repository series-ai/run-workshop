import type { UiSkinRole, UiSkinState } from './types'

export interface SemanticUiComponentDefinition {
  name: string
  variant: string | null
  group:
    | 'buttons'
    | 'panels'
    | 'frames'
    | 'navigation'
    | 'badges'
    | 'progress'
    | 'inputs'
    | 'settings'
    | 'dialogs'
    | 'states'
    | 'ftue'
    | 'layout'
  roles: readonly UiSkinRole[]
  states: readonly UiSkinState[]
}

export interface SemanticUiComponentUsage {
  name: string
  variant: string | null
  states: UiSkinState[]
  roles: UiSkinRole[]
}

export const SEMANTIC_UI_COMPONENTS: readonly SemanticUiComponentDefinition[] = [
  { name: 'Stack', variant: null, group: 'layout', roles: [], states: ['default'] },
  { name: 'Cluster', variant: null, group: 'layout', roles: [], states: ['default'] },
  { name: 'ActionBar', variant: null, group: 'layout', roles: [], states: ['default'] },
  { name: 'ResponsiveGrid', variant: null, group: 'layout', roles: [], states: ['default'] },
  { name: 'Button.Primary', variant: 'primary', group: 'buttons', roles: ['button.primary'], states: ['default', 'active', 'disabled'] },
  { name: 'Button.Secondary', variant: 'secondary', group: 'buttons', roles: ['button.secondary'], states: ['default', 'active', 'disabled'] },
  { name: 'Button.Ghost', variant: 'ghost', group: 'buttons', roles: ['button.ghost'], states: ['default', 'active', 'disabled'] },
  { name: 'Button.Icon', variant: 'icon', group: 'buttons', roles: ['button.icon'], states: ['default', 'active', 'disabled'] },
  { name: 'Button.Grid', variant: 'grid', group: 'buttons', roles: ['button.grid'], states: ['default', 'active', 'disabled'] },
  { name: 'Button.Tab', variant: 'tab', group: 'buttons', roles: ['button.tab'], states: ['default', 'active', 'disabled'] },
  { name: 'Button.Pill', variant: 'pill', group: 'buttons', roles: ['button.pill'], states: ['default', 'active', 'disabled'] },
  { name: 'Button.Stacked', variant: 'stacked', group: 'buttons', roles: ['button.primary'], states: ['default', 'active', 'disabled'] },
  { name: 'Button.TrailingVisual', variant: 'trailing-visual', group: 'buttons', roles: ['button.secondary'], states: ['default', 'active', 'disabled'] },
  { name: 'Button.LeadingVisual', variant: 'leading-visual', group: 'buttons', roles: ['button.secondary'], states: ['default', 'active', 'disabled'] },
  { name: 'Button.Currency', variant: 'currency', group: 'buttons', roles: ['button.secondary'], states: ['default', 'active', 'disabled'] },
  { name: 'Panel.Card', variant: 'card', group: 'panels', roles: ['panel.card'], states: ['default'] },
  { name: 'Panel.Section', variant: 'section', group: 'panels', roles: ['panel.section'], states: ['default'] },
  { name: 'Panel.Modal', variant: 'modal', group: 'panels', roles: ['panel.modal'], states: ['default'] },
  { name: 'Panel.Sheet', variant: 'sheet', group: 'panels', roles: ['panel.sheet'], states: ['default'] },
  { name: 'Panel.Popover', variant: 'popover', group: 'panels', roles: ['panel.popover'], states: ['default'] },
  { name: 'Panel.Tooltip', variant: 'tooltip', group: 'panels', roles: ['panel.tooltip'], states: ['default'] },
  { name: 'Header', variant: null, group: 'frames', roles: ['frame.header'], states: ['default'] },
  { name: 'Header.Ribbon', variant: 'ribbon', group: 'frames', roles: ['frame.header'], states: ['default'] },
  { name: 'Ticket', variant: null, group: 'frames', roles: ['frame.ticket'], states: ['default'] },
  { name: 'IconFrame', variant: null, group: 'frames', roles: ['frame.icon'], states: ['default'] },
  { name: 'Tabs', variant: null, group: 'navigation', roles: ['nav.tabBar'], states: ['default', 'active'] },
  { name: 'SegmentedControl', variant: null, group: 'navigation', roles: ['nav.segmentedControl'], states: ['default', 'active', 'disabled'] },
  { name: 'ToggleGroup', variant: null, group: 'navigation', roles: ['nav.toggleGroup'], states: ['default', 'active', 'disabled'] },
  { name: 'NavRail', variant: null, group: 'navigation', roles: ['nav.sideRail', 'nav.railButton'], states: ['default', 'active'] },
  { name: 'NavDrawer', variant: null, group: 'navigation', roles: ['nav.sideDrawer', 'nav.drawerButton'], states: ['default', 'active'] },
  { name: 'PaginationDots', variant: null, group: 'navigation', roles: ['nav.paginationDot'], states: ['default', 'active', 'disabled'] },
  { name: 'ScrollBar.Horizontal', variant: 'horizontal', group: 'navigation', roles: ['nav.scrollbar'], states: ['default', 'active', 'disabled'] },
  { name: 'ScrollBar.Vertical', variant: 'vertical', group: 'navigation', roles: ['nav.scrollbar'], states: ['default', 'active', 'disabled'] },
  { name: 'Badge.Status', variant: 'status', group: 'badges', roles: ['badge.status'], states: ['default', 'active'] },
  { name: 'Badge.Counter', variant: 'counter', group: 'badges', roles: ['badge.counter'], states: ['default', 'active'] },
  { name: 'Badge.New', variant: 'new', group: 'badges', roles: ['badge.new'], states: ['default', 'active'] },
  { name: 'Tag.Status', variant: 'status', group: 'badges', roles: ['tag.status'], states: ['default'] },
  { name: 'Tag.Callout', variant: 'callout', group: 'badges', roles: ['tag.callout'], states: ['default'] },
  { name: 'Tag.Value', variant: 'value', group: 'badges', roles: ['tag.value'], states: ['default'] },
  { name: 'Chip.Currency', variant: 'currency', group: 'badges', roles: ['chip.currency'], states: ['default'] },
  { name: 'Chip.Value', variant: 'value', group: 'badges', roles: ['chip.value'], states: ['default'] },
  { name: 'ProgressBar', variant: null, group: 'progress', roles: ['progress.bar'], states: ['default', 'active'] },
  { name: 'Slider', variant: null, group: 'progress', roles: ['progress.slider'], states: ['default', 'active', 'disabled'] },
  { name: 'Label.Title', variant: 'title', group: 'frames', roles: ['label.title'], states: ['default'] },
  { name: 'Label.Section', variant: 'section', group: 'frames', roles: ['label.section'], states: ['default'] },
  { name: 'Label.Value', variant: 'value', group: 'frames', roles: ['label.value'], states: ['default'] },
  { name: 'Input.Text', variant: 'text', group: 'inputs', roles: ['input.text'], states: ['default', 'active', 'disabled'] },
  { name: 'Input.Textarea', variant: 'textarea', group: 'inputs', roles: ['input.textarea'], states: ['default', 'active', 'disabled'] },
  { name: 'Input.Select', variant: 'select', group: 'inputs', roles: ['input.select'], states: ['default', 'active', 'disabled'] },
  { name: 'Checkbox', variant: null, group: 'inputs', roles: ['input.checkbox'], states: ['default', 'active', 'disabled'] },
  { name: 'Radio', variant: null, group: 'inputs', roles: ['input.radio'], states: ['default', 'active', 'disabled'] },
  { name: 'Switch', variant: null, group: 'inputs', roles: ['input.switch'], states: ['default', 'active', 'disabled'] },
  { name: 'Settings.Row', variant: 'row', group: 'settings', roles: ['settings.row'], states: ['default'] },
  { name: 'Settings.Section', variant: 'section', group: 'settings', roles: ['settings.section'], states: ['default'] },
  { name: 'Toast.Info', variant: 'info', group: 'dialogs', roles: ['toast.info'], states: ['default'] },
  { name: 'Toast.Success', variant: 'success', group: 'dialogs', roles: ['toast.success'], states: ['default'] },
  { name: 'Toast.Warning', variant: 'warning', group: 'dialogs', roles: ['toast.warning'], states: ['default'] },
  { name: 'Toast.Error', variant: 'error', group: 'dialogs', roles: ['toast.error'], states: ['default'] },
  { name: 'Dialog.Confirmation', variant: 'confirmation', group: 'dialogs', roles: ['dialog.confirmation'], states: ['default'] },
  { name: 'Dialog.Reward', variant: 'reward', group: 'dialogs', roles: ['dialog.reward'], states: ['default'] },
  { name: 'State.Empty', variant: 'empty', group: 'states', roles: ['state.empty'], states: ['default'] },
  { name: 'State.Loading', variant: 'loading', group: 'states', roles: ['state.loading'], states: ['default'] },
  { name: 'State.Error', variant: 'error', group: 'states', roles: ['state.error'], states: ['default'] },
  { name: 'Ftue.StepCard', variant: 'step-card', group: 'ftue', roles: ['ftue.stepCard'], states: ['default'] },
  { name: 'Ftue.Callout', variant: 'callout', group: 'ftue', roles: ['ftue.callout'], states: ['default'] },
  { name: 'Ftue.HighlightFrame', variant: 'highlight-frame', group: 'ftue', roles: ['ftue.highlightFrame'], states: ['default'] },
  { name: 'Ftue.GateBanner', variant: 'gate-banner', group: 'ftue', roles: ['ftue.gateBanner'], states: ['default'] },
  { name: 'Background', variant: null, group: 'panels', roles: ['surface.background'], states: ['default'] },
  { name: 'TabBar', variant: null, group: 'navigation', roles: ['nav.bottomBar'], states: ['default', 'active'] },
  { name: 'ListRow', variant: null, group: 'navigation', roles: ['list.row'], states: ['default', 'active'] },
  { name: 'RankBadge', variant: null, group: 'badges', roles: ['list.rankBadge'], states: ['default'] },
  { name: 'AvatarFrame', variant: null, group: 'frames', roles: ['frame.avatar'], states: ['default'] },
  { name: 'Countdown', variant: null, group: 'badges', roles: ['display.countdown'], states: ['default'] },
  { name: 'ShopCard', variant: null, group: 'panels', roles: ['shop.card'], states: ['default'] },
  { name: 'PriceLabel', variant: null, group: 'badges', roles: ['shop.price'], states: ['default'] },
  { name: 'PromoBadge', variant: null, group: 'badges', roles: ['shop.promoBadge'], states: ['default'] },
  { name: 'NavBack', variant: null, group: 'buttons', roles: ['button.back'], states: ['default'] },
  { name: 'NavClose', variant: null, group: 'buttons', roles: ['button.close'], states: ['default'] },
  { name: 'CircleFrame', variant: null, group: 'frames', roles: ['frame.circle'], states: ['default'] },
  { name: 'ActionChip', variant: null, group: 'badges', roles: ['chip.value'], states: ['default'] },
] as const

export const SEMANTIC_UI_COMPONENTS_BY_ROLE = new Map<UiSkinRole, SemanticUiComponentDefinition[]>(
  SEMANTIC_UI_COMPONENTS.flatMap((component) =>
    component.roles.map((role) => [role, SEMANTIC_UI_COMPONENTS.filter((candidate) => candidate.roles.includes(role))] as const),
  ),
)

export function deriveSemanticUiComponentsFromRoles(roles: readonly UiSkinRole[]): SemanticUiComponentUsage[] {
  const usages = new Map<string, SemanticUiComponentUsage>()

  for (const role of roles) {
    const components = SEMANTIC_UI_COMPONENTS_BY_ROLE.get(role) ?? []
    for (const component of components) {
      const key = `${component.name}:${component.variant ?? 'null'}`
      const existing = usages.get(key) ?? {
        name: component.name,
        variant: component.variant,
        states: [],
        roles: [],
      }

      for (const state of component.states) {
        if (!existing.states.includes(state)) {
          existing.states.push(state)
        }
      }

      if (!existing.roles.includes(role)) {
        existing.roles.push(role)
      }

      usages.set(key, existing)
    }
  }

  return Array.from(usages.values()).sort((left, right) => left.name.localeCompare(right.name))
}
