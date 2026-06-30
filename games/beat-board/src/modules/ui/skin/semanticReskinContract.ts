import { SEMANTIC_UI_COMPONENTS, type SemanticUiComponentDefinition } from './semanticComponents'
import { UI_GEOMETRY_CONTRACT } from './theme/geometry-contract'
import type { UiSkinRole, UiSkinState } from './types'

export type SemanticReskinSurfaceName =
  | 'ScreenChrome'
  | 'Panel'
  | 'Button'
  | 'Tabs'
  | 'SegmentedControl'
  | 'ToggleGroup'
  | 'Layout'
  | 'ListRow'
  | 'ShopCard'

export interface SemanticReskinFootprintBudget {
  minTouchTargetPx: number
  defaultHorizontalPaddingPx: number
  maxHorizontalPaddingPx: number
  longText: 'wrap' | 'truncate' | 'wrap-or-truncate'
  minHeightPx: number
  maxExpectedHeightPx: number | null
  phonePortraitNotes: string
  decorativeRendererException: string
}

export interface SemanticReskinSurfaceContract {
  surface: SemanticReskinSurfaceName
  semanticComponents: readonly string[]
  roles: readonly UiSkinRole[]
  requiredSlots: readonly string[]
  requiredMarkers: readonly string[]
  supportedStates: readonly UiSkinState[]
  layoutSensitiveProps: readonly string[]
  rendererOwnedHooks: readonly string[]
  callerResponsibilities: readonly string[]
  portraitPhoneBudget: SemanticReskinFootprintBudget
}

const SEMANTIC_COMPONENT_BY_NAME = new Map<string, SemanticUiComponentDefinition>(
  SEMANTIC_UI_COMPONENTS.map((component) => [component.name, component]),
)

function statesFor(componentNames: readonly string[]): UiSkinState[] {
  const states = new Set<UiSkinState>()
  for (const name of componentNames) {
    for (const state of SEMANTIC_COMPONENT_BY_NAME.get(name)?.states ?? []) {
      states.add(state)
    }
  }
  return [...states]
}

function rolesFor(componentNames: readonly string[]): UiSkinRole[] {
  const roles = new Set<UiSkinRole>()
  for (const name of componentNames) {
    for (const role of SEMANTIC_COMPONENT_BY_NAME.get(name)?.roles ?? []) {
      roles.add(role)
    }
  }
  return [...roles]
}

const buttonComponents = [
  'Button.Primary',
  'Button.Secondary',
  'Button.Ghost',
  'Button.Icon',
  'Button.Grid',
  'Button.Tab',
  'Button.Pill',
  'Button.Stacked',
  'Button.TrailingVisual',
  'Button.LeadingVisual',
  'Button.Currency',
] as const

const panelComponents = [
  'Panel.Card',
  'Panel.Section',
  'Panel.Modal',
  'Panel.Sheet',
  'Panel.Popover',
  'Panel.Tooltip',
] as const

export const SEMANTIC_RESKIN_V1_SURFACES = [
  'ScreenChrome',
  'Panel',
  'Button',
  'Tabs',
  'SegmentedControl',
  'ToggleGroup',
  'Layout',
  'ListRow',
  'ShopCard',
] as const satisfies readonly SemanticReskinSurfaceName[]

export const SEMANTIC_RESKIN_V1_CONTRACT: readonly SemanticReskinSurfaceContract[] = [
  {
    surface: 'ScreenChrome',
    semanticComponents: ['Background', 'NavBack', 'NavClose'],
    roles: rolesFor(['Background', 'NavBack', 'NavClose']),
    requiredSlots: ['header', 'content', 'footer'],
    requiredMarkers: ['data-ui-screen-chrome', 'data-ui-screen-chrome-slot'],
    supportedStates: statesFor(['Background', 'NavBack', 'NavClose']),
    layoutSensitiveProps: ['back', 'close', 'currency', 'title', 'banner', 'tabs', 'footer'],
    rendererOwnedHooks: ['surface.background', 'button.back', 'button.close'],
    callerResponsibilities: [
      'Keep primary screen content inside the content slot.',
      'Use footer for persistent primary actions instead of absolute-positioned CTAs.',
      'Do not add project CSS that reduces the preview inset in portrait-phone formats.',
    ],
    portraitPhoneBudget: {
      minTouchTargetPx: UI_GEOMETRY_CONTRACT.controlHeightsPx.touchTarget,
      defaultHorizontalPaddingPx: 16,
      maxHorizontalPaddingPx: UI_GEOMETRY_CONTRACT.panelPhonePaddingPx.max,
      longText: 'wrap-or-truncate',
      minHeightPx: UI_GEOMETRY_CONTRACT.controlHeightsPx.touchTarget,
      maxExpectedHeightPx: null,
      phonePortraitNotes: 'ScreenChrome uses getScreenChromeInset(), which intentionally matches getPreviewInset() for full-screen back-button layouts.',
      decorativeRendererException: 'Decorative renderers may add chrome inside semantic children, but not reduce the content slot below the preview inset budget.',
    },
  },
  {
    surface: 'Panel',
    semanticComponents: panelComponents,
    roles: rolesFor(panelComponents),
    requiredSlots: ['content', 'header', 'titles', 'actions', 'body'],
    requiredMarkers: ['data-ui-skin-role', 'data-variant', 'data-ui-slot'],
    supportedStates: statesFor(panelComponents),
    layoutSensitiveProps: ['title', 'subtitle', 'actions', 'ribbon', 'ribbonPlacement', 'children'],
    rendererOwnedHooks: ['.ui-panel', '.ui-panel__content', '.ui-panel__header', '.ui-panel__body', '--ui-panel-*'],
    callerResponsibilities: ['Do not nest panel padding as a layout shortcut.', 'Replace wrapless space-between header rows with semantic actions that can wrap.', 'Keep scrollable content inside body children, not around the panel chrome.'],
    portraitPhoneBudget: {
      minTouchTargetPx: UI_GEOMETRY_CONTRACT.controlHeightsPx.touchTarget,
      defaultHorizontalPaddingPx: UI_GEOMETRY_CONTRACT.panelPhonePaddingPx.default,
      maxHorizontalPaddingPx: UI_GEOMETRY_CONTRACT.panelPhonePaddingPx.max,
      longText: 'wrap',
      minHeightPx: UI_GEOMETRY_CONTRACT.controlHeightsPx.touchTarget,
      maxExpectedHeightPx: null,
      phonePortraitNotes: 'Panel content padding must stay within 24px per side in portrait-phone stress fixtures.',
      decorativeRendererException: 'A renderer may use larger decorative padding on tablet/landscape or modal hero treatments, but v1 phone fixtures cap covered panel padding.',
    },
  },
  {
    surface: 'Button',
    semanticComponents: buttonComponents,
    roles: rolesFor(buttonComponents),
    requiredSlots: ['content', 'label', 'supporting', 'leading', 'trailing'],
    requiredMarkers: ['data-ui-skin-role', 'data-variant', 'data-state', 'data-ui-slot'],
    supportedStates: statesFor(buttonComponents),
    layoutSensitiveProps: ['children', 'iconName', 'iconPosition', 'layout', 'size', 'leadingVisual', 'trailingVisual', 'supportingText', 'ribbon'],
    rendererOwnedHooks: ['.ui-button', '.ui-button__content', '.ui-button__label', '--ui-button-*'],
    callerResponsibilities: ['Prefer icon-only buttons for compact tools when a semantic icon exists.', 'Keep primary action text concise; long labels must still fit by wrapping or truncating.', 'Use full-width styling only from the caller layout, not renderer internals.'],
    portraitPhoneBudget: {
      minTouchTargetPx: UI_GEOMETRY_CONTRACT.controlHeightsPx.touchTarget,
      defaultHorizontalPaddingPx: 16,
      maxHorizontalPaddingPx: 22,
      longText: 'wrap-or-truncate',
      minHeightPx: UI_GEOMETRY_CONTRACT.controlHeightsPx.touchTarget,
      maxExpectedHeightPx: 88,
      phonePortraitNotes: 'Text buttons may grow to two lines; icon-only buttons remain square and at least 44px.',
      decorativeRendererException: 'Decorative shadows, strokes, and ribbons may extend visually but cannot force horizontal overflow.',
    },
  },
  {
    surface: 'Tabs',
    semanticComponents: ['Tabs'],
    roles: rolesFor(['Tabs']),
    requiredSlots: ['tablist', 'tab', 'label', 'badge'],
    requiredMarkers: ['data-ui-skin-role', 'role="tablist"', 'role="tab"', 'aria-selected'],
    supportedStates: statesFor(['Tabs']),
    layoutSensitiveProps: ['items', 'activeId', 'orientation'],
    rendererOwnedHooks: ['.ui-tabs', '.ui-tab-button', '.ui-tab-button__label', '--ui-button-tab-*'],
    callerResponsibilities: ['Use short tab labels in segmented navigation.', 'Move high-cardinality navigation to a list or chips pattern.'],
    portraitPhoneBudget: {
      minTouchTargetPx: UI_GEOMETRY_CONTRACT.navigationFloorsPx.tab,
      defaultHorizontalPaddingPx: 6,
      maxHorizontalPaddingPx: 10,
      longText: 'truncate',
      minHeightPx: UI_GEOMETRY_CONTRACT.navigationFloorsPx.tab,
      maxExpectedHeightPx: 72,
      phonePortraitNotes: 'Horizontal tabs divide the available width equally and truncate long labels.',
      decorativeRendererException: 'Active indicators may vary, but labels and badges must stay inside each tab cell.',
    },
  },
  {
    surface: 'SegmentedControl',
    semanticComponents: ['SegmentedControl'],
    roles: rolesFor(['SegmentedControl']),
    requiredSlots: ['radiogroup', 'radio', 'label'],
    requiredMarkers: ['data-ui-skin-role', 'data-layout', 'data-selection-model', 'aria-checked'],
    supportedStates: statesFor(['SegmentedControl']),
    layoutSensitiveProps: ['items', 'activeId', 'size', 'disabled', 'layout'],
    rendererOwnedHooks: ['.ui-segmented-control', '.ui-choice-row', '.ui-button[data-variant="segment"]', '--ui-segmented-control-*'],
    callerResponsibilities: ['Use layout="chips" for many or variable-width labels.', 'Keep layout="segmented" to 2-5 short labels.'],
    portraitPhoneBudget: {
      minTouchTargetPx: UI_GEOMETRY_CONTRACT.navigationFloorsPx.segment,
      defaultHorizontalPaddingPx: 14,
      maxHorizontalPaddingPx: 18,
      longText: 'wrap-or-truncate',
      minHeightPx: UI_GEOMETRY_CONTRACT.navigationFloorsPx.segment,
      maxExpectedHeightPx: 96,
      phonePortraitNotes: 'Segmented mode stays one row; chip mode may wrap to multiple rows without horizontal overflow.',
      decorativeRendererException: 'Renderer segment fills may change, but equal-width cells must retain shrinkable labels.',
    },
  },
  {
    surface: 'ToggleGroup',
    semanticComponents: ['ToggleGroup'],
    roles: rolesFor(['ToggleGroup']),
    requiredSlots: ['group', 'button', 'label'],
    requiredMarkers: ['data-ui-skin-role', 'data-layout', 'data-selection-model', 'aria-pressed'],
    supportedStates: statesFor(['ToggleGroup']),
    layoutSensitiveProps: ['items', 'value', 'size', 'disabled', 'layout'],
    rendererOwnedHooks: ['.ui-toggle-group', '.ui-choice-row', '.ui-button[data-variant="toggle"]', '--ui-toggle-group-*'],
    callerResponsibilities: ['Use layout="chips" for dense filters and variable labels.', 'Do not emulate toggles with ad hoc active buttons.'],
    portraitPhoneBudget: {
      minTouchTargetPx: UI_GEOMETRY_CONTRACT.navigationFloorsPx.toggle,
      defaultHorizontalPaddingPx: 14,
      maxHorizontalPaddingPx: 18,
      longText: 'wrap-or-truncate',
      minHeightPx: UI_GEOMETRY_CONTRACT.navigationFloorsPx.toggle,
      maxExpectedHeightPx: 96,
      phonePortraitNotes: 'Toggle groups follow the same segmented/chips footprint split as SegmentedControl.',
      decorativeRendererException: 'Active checkmarks may consume inline space, but labels must remain shrinkable.',
    },
  },
  {
    surface: 'Layout',
    semanticComponents: ['Stack', 'Cluster', 'ActionBar', 'ResponsiveGrid'],
    roles: [],
    requiredSlots: ['children'],
    requiredMarkers: ['data-ui-layout', 'data-layout-primitive', 'data-space'],
    supportedStates: ['default'],
    layoutSensitiveProps: ['space', 'align', 'justify', 'kind', 'min', 'children'],
    rendererOwnedHooks: ['.ui-stack', '.ui-cluster', '.ui-action-bar', '.ui-responsive-grid'],
    callerResponsibilities: [
      'Use Stack, Cluster, ActionBar, and ResponsiveGrid instead of hand-rolled action rows and fixed phone-hostile grids.',
      'Use the primitive data props for spacing and alignment instead of inline per-call geometry.',
    ],
    portraitPhoneBudget: {
      minTouchTargetPx: UI_GEOMETRY_CONTRACT.controlHeightsPx.touchTarget,
      defaultHorizontalPaddingPx: 0,
      maxHorizontalPaddingPx: 0,
      longText: 'wrap-or-truncate',
      minHeightPx: 0,
      maxExpectedHeightPx: null,
      phonePortraitNotes: `ResponsiveGrid uses contract minimums: item ${UI_GEOMETRY_CONTRACT.responsiveGridMinPx.item}px, card ${UI_GEOMETRY_CONTRACT.responsiveGridMinPx.card}px, tile ${UI_GEOMETRY_CONTRACT.responsiveGridMinPx.tile}px, wide ${UI_GEOMETRY_CONTRACT.responsiveGridMinPx.wide}px. kind="richCard" maps to wide so rich card collections default to one readable column on narrow phones.`,
      decorativeRendererException: 'Renderers do not own layout primitive geometry; they may only style child semantic surfaces.',
    },
  },
  {
    surface: 'ListRow',
    semanticComponents: ['ListRow'],
    roles: rolesFor(['ListRow']),
    requiredSlots: ['rank', 'avatar', 'name', 'score'],
    requiredMarkers: ['data-ui-skin-role', 'data-ui-slot'],
    supportedStates: statesFor(['ListRow']),
    layoutSensitiveProps: ['rank', 'avatar', 'name', 'score', 'highlight', 'children'],
    rendererOwnedHooks: ['.ui-list-row', '.ui-list-row__name', '.ui-list-row__score', '--ui-list-row-*'],
    callerResponsibilities: ['Pass compact rank/avatar visuals.', 'Treat score as a short value; long values truncate before pushing the name offscreen.'],
    portraitPhoneBudget: {
      minTouchTargetPx: 44,
      defaultHorizontalPaddingPx: 16,
      maxHorizontalPaddingPx: 18,
      longText: 'truncate',
      minHeightPx: 56,
      maxExpectedHeightPx: 72,
      phonePortraitNotes: 'Name and score slots must both shrink; name truncates first and score has a bounded max width.',
      decorativeRendererException: 'Rank or avatar art can vary, but the row grid cannot require horizontal scrolling.',
    },
  },
  {
    surface: 'ShopCard',
    semanticComponents: ['ShopCard'],
    roles: rolesFor(['ShopCard']),
    requiredSlots: ['badge', 'banner', 'header', 'artwork', 'quantity', 'name', 'price'],
    requiredMarkers: ['data-ui-skin-role', 'data-size', 'data-tint', 'data-ui-slot'],
    supportedStates: statesFor(['ShopCard']),
    layoutSensitiveProps: ['tint', 'size', 'banner', 'header', 'artwork', 'quantity', 'name', 'price', 'badge', 'ribbon'],
    rendererOwnedHooks: ['.ui-shop-card', '.ui-shop-card__name', '.ui-shop-card__price', '--ui-shop-card-*'],
    callerResponsibilities: ['Use responsive grids that collapse to one column when the card width is narrow.', 'Keep artwork decorative and non-essential when the card is compressed.', 'Use PriceLabel for price content so renderer typography is bounded consistently.'],
    portraitPhoneBudget: {
      minTouchTargetPx: 44,
      defaultHorizontalPaddingPx: 10,
      maxHorizontalPaddingPx: 14,
      longText: 'wrap-or-truncate',
      minHeightPx: 140,
      maxExpectedHeightPx: 280,
      phonePortraitNotes: 'Standard cards fit a two-column 375px phone grid; featured cards may occupy a full row.',
      decorativeRendererException: 'Promotional ribbons and badges may overlap card chrome, but not hide name or price slots.',
    },
  },
] as const

export function getSemanticReskinContract(surface: SemanticReskinSurfaceName): SemanticReskinSurfaceContract {
  const contract = SEMANTIC_RESKIN_V1_CONTRACT.find((candidate) => candidate.surface === surface)
  if (!contract) {
    throw new Error(`Unknown semantic reskin surface: ${surface}`)
  }
  return contract
}

export function findMissingSemanticReskinComponentReferences(): string[] {
  const missing = new Set<string>()
  for (const contract of SEMANTIC_RESKIN_V1_CONTRACT) {
    for (const name of contract.semanticComponents) {
      if (!SEMANTIC_COMPONENT_BY_NAME.has(name)) {
        missing.add(name)
      }
    }
  }
  return [...missing].sort()
}
