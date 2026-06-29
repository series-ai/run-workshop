import { UI_SKIN_ROLE_INVENTORY } from './roles'
import type { UiSkinRole } from './types'

export interface UiSkinComponentDefinition {
  name: string
  summary: string
  roles: readonly UiSkinRole[]
}

export const UI_SKIN_COMPONENT_CATALOG: readonly UiSkinComponentDefinition[] = [
  {
    name: 'SkinButton',
    summary: 'Primary, secondary, ghost, icon, grid, tab, pill, and composed visual buttons.',
    roles: [
      'button.primary',
      'button.secondary',
      'button.ghost',
      'button.icon',
      'button.grid',
      'button.tab',
      'button.pill',
    ],
  },
  {
    name: 'SkinPanel',
    summary: 'Card, section, modal, dialog, and tab-bar panel chrome.',
    roles: ['panel.card', 'panel.section', 'panel.modal'],
  },
  {
    name: 'SkinSheet',
    summary: 'Slide-in sheet surface built on the shared panel skin.',
    roles: ['panel.sheet'],
  },
  {
    name: 'SkinPopover',
    summary: 'Popover surface for inline floating content.',
    roles: ['panel.popover'],
  },
  {
    name: 'SkinTooltip',
    summary: 'Tooltip surface for short helper copy.',
    roles: ['panel.tooltip'],
  },
  {
    name: 'SkinHeader',
    summary: 'Header ribbon/tag primitive sourced from the canonical prefab family.',
    roles: ['frame.header'],
  },
  {
    name: 'SkinTicket',
    summary: 'SVG-backed ticket frame for pass cards, promos, and reward markers.',
    roles: ['frame.ticket'],
  },
  {
    name: 'SkinIconFrame',
    summary: 'Standalone framed icon surface.',
    roles: ['frame.icon'],
  },
  {
    name: 'SkinCircleFrame',
    summary: 'Circular framed avatar/icon surface.',
    roles: ['frame.circle'],
  },
  {
    name: 'SkinTabs',
    summary: 'Tabbed navigation container surface.',
    roles: ['nav.tabBar'],
  },
  {
    name: 'SkinSegmentedControl',
    summary: 'Single-select option row (role="radiogroup" + role="radio" + aria-checked). Reach for this any time you render `items.map(i => <ButtonLike active={i.id === selectedId} onClick={() => setSelected(i.id)}>)`. layout="segmented" (default) is iOS-style: shared pill container, equal-width, single row, no wrap — 2–5 short labels. layout="chips" is wrap-friendly, content-width — many options or variable-width labels (e.g. 7 export presets).',
    roles: ['nav.segmentedControl', 'button.segment'],
  },
  {
    name: 'SkinToggleGroup',
    summary: 'Multi-select option row (role="group" + aria-pressed). Reach for this any time you render `items.map(i => <ButtonLike active={selectedIds.includes(i.id)} onClick={() => toggle(i.id)}>)`. layout="segmented" (default) is a shared-container row with a leading ✓ on active items; layout="chips" is wrap-friendly for many/variable-width options.',
    roles: ['nav.toggleGroup', 'button.toggle'],
  },
  {
    name: 'SkinNavDrawer',
    summary: 'Side-drawer navigation container with its matching drawer trigger button.',
    roles: ['nav.sideDrawer', 'nav.drawerButton'],
  },
  {
    name: 'SkinNavRail / SkinRailButton',
    summary: 'Side-rail navigation and rail buttons.',
    roles: ['nav.sideRail', 'nav.railButton'],
  },
  {
    name: 'SkinPaginationDots',
    summary: 'Pagination-dot navigation surface.',
    roles: ['nav.paginationDot'],
  },
  {
    name: 'SkinScrollBar',
    summary: 'Themed horizontal and vertical scrollbar chrome with floating thumb state.',
    roles: ['nav.scrollbar'],
  },
  {
    name: 'SkinBadge',
    summary: 'Status, counter, new, currency, and value badges/chips.',
    roles: ['badge.status', 'badge.counter', 'badge.new', 'chip.currency', 'chip.value'],
  },
  {
    name: 'SkinTag',
    summary: 'Status rarity tags, info callouts, and slanted value callouts.',
    roles: ['tag.status', 'tag.callout', 'tag.value'],
  },
{
    name: 'SkinProgress',
    summary: 'Progress bar surface with fill-asset support.',
    roles: ['progress.bar'],
  },
  {
    name: 'SkinSlider',
    summary: 'Interactive slider surface with optional fill and handle assets.',
    roles: ['progress.slider'],
  },
  {
    name: 'SkinLabel',
    summary: 'Title, section, and value text chrome.',
    roles: ['label.title', 'label.section', 'label.value'],
  },
  {
    name: 'SkinInput',
    summary: 'Single-line text input surface.',
    roles: ['input.text'],
  },
  {
    name: 'SkinTextarea',
    summary: 'Multiline text input surface.',
    roles: ['input.textarea'],
  },
  {
    name: 'SkinSelect',
    summary: 'Select/dropdown surface.',
    roles: ['input.select'],
  },
  {
    name: 'SkinCheckbox',
    summary: 'Checkbox surface.',
    roles: ['input.checkbox'],
  },
  {
    name: 'SkinRadio',
    summary: 'Radio surface.',
    roles: ['input.radio'],
  },
  {
    name: 'SkinSwitch',
    summary: 'Switch/toggle surface.',
    roles: ['input.switch'],
  },
  {
    name: 'SkinSettingsRow',
    summary: 'Single settings row with control slot.',
    roles: ['settings.row'],
  },
  {
    name: 'SkinSettingsSection',
    summary: 'Grouped settings section container.',
    roles: ['settings.section'],
  },
  {
    name: 'SkinToastCard / SkinToastStack',
    summary: 'Info, success, warning, and error toast surfaces.',
    roles: ['toast.info', 'toast.success', 'toast.warning', 'toast.error'],
  },
  {
    name: 'SkinDialog / SkinConfirmationDialog / SkinRewardAnnouncement',
    summary: 'Dialog wrappers for modal, confirmation, and reward patterns.',
    roles: ['dialog.confirmation', 'dialog.reward'],
  },
  {
    name: 'SkinState / SkinEmptyState / SkinLoadingState / SkinErrorState',
    summary: 'Empty, loading, and error state surfaces.',
    roles: ['state.empty', 'state.loading', 'state.error'],
  },
  {
    name: 'SkinFtueCallout',
    summary: 'FTUE callout, step-card, gate banner, and highlight frame owner.',
    roles: ['ftue.stepCard', 'ftue.callout', 'ftue.highlightFrame', 'ftue.gateBanner'],
  },
  {
    name: 'Background',
    summary: 'Full-bleed page surface; empty usage becomes a non-interactive background layer.',
    roles: ['surface.background'],
  },
  {
    name: 'SkinTabBar',
    summary: 'Bottom navigation bar with icon + label items, badge counts, and active state.',
    roles: ['nav.bottomBar'],
  },
  { name: 'SkinListRow', summary: 'Compact leaderboard row with rank, avatar, name, and score slots.', roles: ['list.row'] },
  { name: 'SkinRankBadge', summary: 'Rank position indicator with medal icons for top 3.', roles: ['list.rankBadge'] },
  { name: 'SkinAvatarFrame', summary: 'Square avatar placeholder with colored background.', roles: ['frame.avatar'] },
  { name: 'SkinCountdown', summary: 'Inline countdown display with clock icon and time text.', roles: ['display.countdown'] },
  { name: 'SkinShopCard', summary: 'Tinted card for shop items with banner, artwork, name, price, and promo badge slots.', roles: ['shop.card'] },
  { name: 'SkinPriceLabel', summary: 'Price display for in-game currency or real money.', roles: ['shop.price'] },
  { name: 'SkinPromoBadge', summary: 'Floating promo badge for shop cards (2x Value, Best Value, etc).', roles: ['shop.promoBadge'] },
  { name: 'SkinNavIcon', summary: 'Compact back and close navigation icons for dialogs and screen chrome.', roles: ['button.back', 'button.close'] },
  { name: 'Patterns.ActionableTile', summary: 'Choice tile composition (icon + title + body + cost + primary CTA) with a wrap-safe footer row. Use for grids of "pick one" cards — prompt/photo/draw creation entries, shop SKUs, game-mode pickers.', roles: ['panel.card', 'frame.icon', 'label.title', 'tag.value', 'button.primary'] },
  { name: 'Patterns.ChapterProgressHeader', summary: 'Shared chapter/campaign progress header composition.', roles: ['frame.header', 'progress.bar', 'chip.value'] },
  { name: 'Patterns.CampaignStageNode', summary: 'Campaign node card composition with stage status and CTA.', roles: ['panel.card', 'frame.icon', 'tag.status', 'button.primary'] },
  { name: 'Patterns.DeckSelectorTabSet', summary: 'Deck-selector tab strip built on semantic tabs.', roles: ['nav.tabBar', 'button.tab'] },
  { name: 'Patterns.DeckSlotCard', summary: 'Deck slot card composition with state and equip CTA.', roles: ['panel.card', 'frame.icon', 'button.pill', 'button.secondary'] },
  { name: 'Patterns.UpgradeCtaBlock', summary: 'Upgrade CTA block with requirement, cost, and action.', roles: ['panel.section', 'tag.callout', 'button.primary'] },
  { name: 'Patterns.ConstructionBuildingCard', summary: 'Construction/building card with countdown and progress.', roles: ['panel.card', 'frame.icon', 'display.countdown', 'progress.bar'] },
  { name: 'Patterns.BuilderQueueRow', summary: 'Queue row for builder/construction progress.', roles: ['panel.section', 'frame.icon', 'display.countdown', 'progress.bar'] },
  { name: 'Patterns.TimedEventBanner', summary: 'Timed-event banner with countdown and CTA.', roles: ['panel.section', 'frame.header', 'display.countdown', 'button.primary'] },
  { name: 'Patterns.MilestoneRow', summary: 'Milestone/progression row with reward and progress.', roles: ['panel.section', 'progress.bar', 'chip.currency', 'button.primary'] },
  { name: 'Patterns.RewardCalendarDayCell', summary: 'Reward-calendar day cell for claim schedules.', roles: ['panel.card', 'badge.new', 'frame.icon', 'tag.status'] },
  { name: 'Patterns.ClaimCountdownBlock', summary: 'Claim countdown block with reward summary and CTA.', roles: ['panel.section', 'display.countdown', 'chip.value', 'button.primary'] },
  { name: 'Patterns.ModalFormShell', summary: 'Publish/report modal form shell for semantic dialogs.', roles: ['panel.modal', 'input.text', 'input.textarea', 'button.primary', 'button.secondary'] },
  { name: 'Patterns.ConfirmDialogShell', summary: 'Confirmation dialog shell with summary row and paired actions.', roles: ['panel.modal', 'frame.icon', 'button.primary', 'button.secondary'] },
  { name: 'Patterns.AlertDialogShell', summary: 'Alert dialog shell with centered icon, status tag, and primary CTA.', roles: ['panel.modal', 'frame.icon', 'tag.callout', 'button.primary'] },
  { name: 'Patterns.RewardBundleDialog', summary: 'Reward bundle dialog built on the shared reward dialog chrome.', roles: ['dialog.reward', 'chip.currency', 'button.primary'] },
  { name: 'Patterns.RewardCalendarDialog', summary: 'Calendar-style reward dialog with featured reward rail and claim CTA.', roles: ['panel.modal', 'panel.card', 'panel.section', 'button.primary'] },
  { name: 'Patterns.StatusSummaryDialog', summary: 'Outcome/status summary dialog with stats, rewards, and CTA row.', roles: ['panel.modal', 'tag.status', 'progress.bar', 'button.primary'] },
  { name: 'Patterns.SegmentedToolbarRow', summary: 'Segmented filter and toolbar row composition.', roles: ['panel.section', 'nav.tabBar', 'button.tab', 'button.secondary'] },
  { name: 'Patterns.CommunityCardShell', summary: 'Community content card shell with actions and metadata.', roles: ['panel.card', 'tag.status', 'chip.value', 'button.primary'] },
  { name: 'Patterns.CommunityGridTileShell', summary: 'Community grid tile shell for dense card layouts.', roles: ['panel.card', 'frame.icon', 'tag.status', 'button.secondary'] },
  { name: 'Patterns.MergeOrderRibbonCard', summary: 'Merge order ribbon card with progress, reward, and countdown.', roles: ['panel.card', 'display.countdown', 'progress.bar', 'tag.callout'] },
  { name: 'Patterns.StorageDrawerRow', summary: 'Storage drawer row composition with quantity and actions.', roles: ['panel.section', 'frame.icon', 'chip.value', 'button.primary'] },
  { name: 'Patterns.EditorToolbarActionStrip', summary: 'Editor toolbar strip for semantic action chips.', roles: ['panel.section', 'button.pill'] },
  { name: 'Patterns.DialogueChoiceRow', summary: 'Dialogue choice row for story/UI choice prompts.', roles: ['button.secondary', 'frame.icon', 'label.section'] },
  { name: 'Patterns.CampaignMapNode', summary: 'Campaign map node composition for world routes.', roles: ['panel.card', 'frame.icon', 'tag.status', 'button.primary'] },
  { name: 'Patterns.CampaignMapLegend', summary: 'Campaign map legend shell with semantic icon and status rows.', roles: ['panel.section', 'tag.status', 'label.section'] },
  { name: 'Patterns.CampaignMapTooltip', summary: 'Campaign map tooltip shell for node details.', roles: ['panel.tooltip', 'chip.value', 'tag.callout'] },
] as const

export const UI_SKIN_ROLE_OWNERS = (() => {
  const owners = Object.fromEntries(
    UI_SKIN_ROLE_INVENTORY.map((role) => [role, [] as string[]]),
  ) as Record<UiSkinRole, string[]>

  for (const component of UI_SKIN_COMPONENT_CATALOG) {
    if (component.name.startsWith('Patterns.')) {
      continue
    }
    for (const role of component.roles) {
      owners[role].push(component.name)
    }
  }

  return owners
})()
