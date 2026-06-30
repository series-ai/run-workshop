export const UI_GEOMETRY_CONTRACT = {
  controlHeightsPx: {
    compact: 40,
    touchTarget: 44,
    standard: 48,
    roomy: 52,
    hero: 60,
  },
  panelPhonePaddingPx: {
    default: 14,
    max: 20,
  },
  navigationFloorsPx: {
    tab: 44,
    segment: 44,
    toggle: 44,
  },
  responsiveGridMinPx: {
    item: 96,
    card: 156,
    tile: 112,
    wide: 220,
  },
  responsiveGridKindMin: {
    card: 'card',
    item: 'item',
    tile: 'tile',
    richCard: 'wide',
    control: 'tile',
  },
  layoutGapPx: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
  textOverflow: {
    default: 'wrap',
    label: 'truncate',
    denseValue: 'truncate',
  },
  mobileFitPx: {
    touchTargetMin: 44,
    panelContentPaddingMax: 20,
    viewportOverflowTolerance: 1,
  },
} as const

export type UiGeometryContract = typeof UI_GEOMETRY_CONTRACT
export type UiLayoutGap = keyof UiGeometryContract['layoutGapPx']
export type UiResponsiveGridMin = keyof UiGeometryContract['responsiveGridMinPx']
export type UiResponsiveGridKind = keyof UiGeometryContract['responsiveGridKindMin']

export const UI_RENDERER_LOCKED_GEOMETRY_TOKENS = [
  '--ui-geometry-touch-target-min',
  '--ui-control-height-compact',
  '--ui-control-height-touch',
  '--ui-control-height-standard',
  '--ui-control-height-roomy',
  '--ui-control-height-hero',
  '--ui-panel-phone-padding-default',
  '--ui-panel-phone-padding-max',
  '--ui-button-pill-height',
  '--ui-button-segment-height',
  '--ui-button-segment-compact-height',
  '--ui-button-toggle-height',
  '--ui-button-toggle-compact-height',
  '--ui-panel-card-padding',
  '--ui-panel-section-padding',
  '--ui-layout-grid-min-card',
  '--ui-layout-grid-min-item',
  '--ui-layout-grid-min-tile',
  '--ui-layout-grid-min-wide',
] as const

export const UI_RENDERER_BOUNDED_GEOMETRY_TOKENS = {
  '--ui-button-back-width': { minPx: 44, maxPx: 60 },
  '--ui-button-back-height': { minPx: 44, maxPx: 60 },
  '--ui-button-icon-size': { minPx: 44, maxPx: 64 },
  '--ui-button-icon-min-size': { minPx: 44, maxPx: 60 },
  '--ui-button-icon-compact-size': { minPx: 40, maxPx: 52 },
  '--ui-button-grid-size': { minPx: 56, maxPx: 96 },
  '--ui-button-grid-min-size': { minPx: 44, maxPx: 72 },
  '--ui-button-compact-height': { minPx: 40, maxPx: 52 },
  '--ui-button-cta-height': { minPx: 44, maxPx: 64 },
  '--ui-input-height': { minPx: 44, maxPx: 64 },
  '--ui-progress-track-height': { minPx: 12, maxPx: 32 },
  '--ui-slider-track-height': { minPx: 14, maxPx: 36 },
  '--ui-slider-thumb-width': { minPx: 20, maxPx: 40 },
  '--ui-slider-thumb-height': { minPx: 20, maxPx: 40 },
  '--ui-scrollbar-thickness': { minPx: 10, maxPx: 18 },
  '--ui-scrollbar-min-thumb-size': { minPx: 24, maxPx: 44 },
  '--ui-shop-card-price-height': { minPx: 32, maxPx: 48 },
  '--ui-icon-frame-size': { minPx: 44, maxPx: 88 },
  '--ui-input-visual-size': { minPx: 20, maxPx: 40 },
  '--ui-select-chevron-size': { minPx: 24, maxPx: 36 },
} as const

export type UiRendererBoundedGeometryToken = keyof typeof UI_RENDERER_BOUNDED_GEOMETRY_TOKENS
