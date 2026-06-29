import { Children, forwardRef, type ComponentProps, type ComponentPropsWithoutRef, type HTMLAttributes } from 'react'
import { SkinBadge } from './SkinBadge'
import { SkinButton } from './SkinButton'
import { SkinCheckbox, SkinRadio, SkinSelect, SkinSwitch } from './SkinFormControls'
import { SkinFtueCallout } from './SkinFtueCallout'
import { SkinHeader } from './SkinHeader'
import { SkinIconFrame } from './SkinIconFrame'
import { SkinInput } from './SkinInput'
import { SkinLabel, SkinSectionLabel, SkinTitleLabel, SkinValueLabel } from './SkinLabel'
import { SkinNavDrawer, SkinDrawerButton } from './SkinNavDrawer'
import { SkinNavRail, SkinRailButton } from './SkinNavRail'
import { SkinPaginationDot, SkinPaginationDots } from './SkinPagination'
import { SkinPanel } from './SkinPanel'
import { SkinPopover, SkinTooltip } from './SkinPopover'
import { SkinProgress } from './SkinProgress'
import { SkinSettingsRow, SkinSettingsSection } from './SkinSettings'
import { SkinSheet } from './SkinSheet'
import { SkinSlider } from './SkinSlider'
import { SkinScrollBar } from './SkinScrollBar'
import { SkinEmptyState, SkinErrorState, SkinLoadingState } from './SkinState'
import { SkinTabButton, SkinTabs } from './SkinTabs'
import { SkinSegmentedControl } from './SkinSegmentedControl'
import { SkinToggleGroup } from './SkinToggleGroup'
import { SkinTag } from './SkinTag'
import { SkinTicket } from './SkinTicket'
import { SkinTextarea } from './SkinTextarea'
import { SkinConfirmationDialog, SkinDialog, SkinRewardAnnouncement } from './SkinDialog'
import { SkinToastCard, SkinToastStack } from './SkinToastStack'
export { ActionBar, Cluster, ResponsiveGrid, Stack } from './SkinLayout'
export type { ActionBarProps, ClusterProps, ResponsiveGridProps, StackProps } from './SkinLayout'

type SkinButtonSemanticProps = Omit<ComponentPropsWithoutRef<typeof SkinButton>, 'variant'>
type SkinPanelSemanticProps = Omit<ComponentProps<typeof SkinPanel>, 'variant'>
type SkinBadgeSemanticProps = Omit<ComponentProps<typeof SkinBadge>, 'variant'>
type SkinLabelSemanticProps = Omit<ComponentProps<typeof SkinLabel>, 'variant'>
type SkinTagSemanticProps = Omit<ComponentProps<typeof SkinTag>, 'variant'>

const ButtonPrimary = forwardRef<HTMLButtonElement, SkinButtonSemanticProps>(function ButtonPrimary(props, ref) {
  return <SkinButton {...props} ref={ref} variant="primary" />
})

const ButtonSecondary = forwardRef<HTMLButtonElement, SkinButtonSemanticProps>(function ButtonSecondary(props, ref) {
  return <SkinButton {...props} ref={ref} variant="secondary" />
})

const ButtonGhost = forwardRef<HTMLButtonElement, SkinButtonSemanticProps>(function ButtonGhost(props, ref) {
  return <SkinButton {...props} ref={ref} variant="ghost" />
})

const ButtonIcon = forwardRef<HTMLButtonElement, SkinButtonSemanticProps>(function ButtonIcon(props, ref) {
  return <SkinButton {...props} ref={ref} variant="icon" />
})

const ButtonGrid = forwardRef<HTMLButtonElement, SkinButtonSemanticProps>(function ButtonGrid(props, ref) {
  return <SkinButton {...props} ref={ref} layout="grid-stack" variant="grid" />
})

const ButtonTab = forwardRef<HTMLButtonElement, SkinButtonSemanticProps>(function ButtonTab(props, ref) {
  return <SkinButton {...props} ref={ref} variant="tab" />
})

const ButtonPill = forwardRef<HTMLButtonElement, SkinButtonSemanticProps>(function ButtonPill(props, ref) {
  return <SkinButton {...props} ref={ref} variant="pill" />
})

const ButtonStacked = forwardRef<HTMLButtonElement, SkinButtonSemanticProps>(function ButtonStacked(props, ref) {
  return <SkinButton {...props} ref={ref} variant="primary" layout="leading-tile" />
})

const ButtonTrailingVisual = forwardRef<HTMLButtonElement, SkinButtonSemanticProps>(function ButtonTrailingVisual(props, ref) {
  return <SkinButton {...props} ref={ref} variant="secondary" layout="trailing-visual" />
})

const ButtonLeadingVisual = forwardRef<HTMLButtonElement, SkinButtonSemanticProps>(function ButtonLeadingVisual(props, ref) {
  return <SkinButton {...props} ref={ref} variant="secondary" layout="leading-visual" />
})

const ButtonCurrency = forwardRef<HTMLButtonElement, SkinButtonSemanticProps>(function ButtonCurrency(props, ref) {
  return <SkinButton {...props} ref={ref} variant="secondary" layout="currency-stack" />
})

const ButtonRoot = forwardRef<HTMLButtonElement, SkinButtonSemanticProps>(function ButtonRoot(props, ref) {
  return <ButtonPrimary {...props} ref={ref} />
})

export const Button = Object.assign(ButtonRoot, {
  Primary: ButtonPrimary,
  Secondary: ButtonSecondary,
  Ghost: ButtonGhost,
  Icon: ButtonIcon,
  Grid: ButtonGrid,
  Tab: ButtonTab,
  Pill: ButtonPill,
  Stacked: ButtonStacked,
  TrailingVisual: ButtonTrailingVisual,
  LeadingVisual: ButtonLeadingVisual,
  Currency: ButtonCurrency,
})

function PanelCard(props: SkinPanelSemanticProps) {
  return <SkinPanel {...props} variant="card" />
}

function PanelSection(props: SkinPanelSemanticProps) {
  return <SkinPanel {...props} variant="section" />
}

function PanelModal(props: SkinPanelSemanticProps) {
  return <SkinPanel {...props} variant="modal" />
}

function PanelRoot(props: SkinPanelSemanticProps) {
  return <PanelCard {...props} />
}

export const Panel = Object.assign(PanelRoot, {
  Card: PanelCard,
  Section: PanelSection,
  Modal: PanelModal,
  Sheet: SkinSheet,
  Popover: SkinPopover,
  Tooltip: SkinTooltip,
})

function BadgeStatus(props: SkinBadgeSemanticProps) {
  return <SkinBadge {...props} variant="status" />
}

function BadgeCounter(props: SkinBadgeSemanticProps) {
  return <SkinBadge {...props} variant="counter" />
}

function BadgeNew(props: SkinBadgeSemanticProps) {
  return <SkinBadge {...props} variant="new" />
}

function BadgeRoot(props: SkinBadgeSemanticProps) {
  return <BadgeStatus {...props} />
}

export const Badge = Object.assign(BadgeRoot, {
  Status: BadgeStatus,
  Counter: BadgeCounter,
  New: BadgeNew,
})

function ChipCurrency(props: SkinBadgeSemanticProps) {
  return <SkinBadge {...props} variant="currency" />
}

function ChipValue(props: SkinBadgeSemanticProps) {
  return <SkinBadge {...props} variant="value" />
}

function ChipRoot(props: SkinBadgeSemanticProps) {
  return <ChipCurrency {...props} />
}

export const Chip = Object.assign(ChipRoot, {
  Currency: ChipCurrency,
  Value: ChipValue,
})

function TagStatus(props: SkinTagSemanticProps) {
  return <SkinTag {...props} variant="status" />
}

function TagCallout(props: SkinTagSemanticProps) {
  return <SkinTag {...props} variant="callout" />
}

function TagValue(props: SkinTagSemanticProps) {
  return <SkinTag {...props} variant="value" />
}

function TagRoot(props: SkinTagSemanticProps) {
  return <TagStatus {...props} />
}

export const Tag = Object.assign(TagRoot, {
  Status: TagStatus,
  Callout: TagCallout,
  Value: TagValue,
})

function LabelRoot(props: SkinLabelSemanticProps) {
  return <SkinSectionLabel {...props} />
}

export const Label = Object.assign(LabelRoot, {
  Title: SkinTitleLabel,
  Section: SkinSectionLabel,
  Value: SkinValueLabel,
})

function InputRoot(props: Omit<ComponentProps<typeof SkinInput>, 'kind'>) {
  return <SkinInput {...props} kind="text" />
}

export const Input = Object.assign(InputRoot, {
  Text: (props: Omit<ComponentProps<typeof SkinInput>, 'kind'>) => <SkinInput {...props} kind="text" />,
  Textarea: SkinTextarea,
  Select: SkinSelect,
})

export const Checkbox = SkinCheckbox
export const Radio = SkinRadio
export const Switch = SkinSwitch
export const ProgressBar = SkinProgress
export const Slider = SkinSlider
const ScrollBarRoot = (props: ComponentProps<typeof SkinScrollBar>) => <SkinScrollBar {...props} orientation="horizontal" />
const ScrollBarHorizontal = (props: ComponentProps<typeof SkinScrollBar>) => <SkinScrollBar {...props} orientation="horizontal" />
const ScrollBarVertical = (props: ComponentProps<typeof SkinScrollBar>) => <SkinScrollBar {...props} orientation="vertical" />
export const ScrollBar = Object.assign(ScrollBarRoot, {
  Horizontal: ScrollBarHorizontal,
  Vertical: ScrollBarVertical,
})
export const Tabs = SkinTabs
export const SegmentedControl = SkinSegmentedControl
export const ToggleGroup = SkinToggleGroup
export const TabButton = SkinTabButton
const HeaderRoot = (props: ComponentProps<typeof SkinHeader>) => <SkinHeader {...props} variant="banner" />
const HeaderBanner = (props: ComponentProps<typeof SkinHeader>) => <SkinHeader {...props} variant="banner" />
const HeaderRibbon = (props: ComponentProps<typeof SkinHeader>) => <SkinHeader {...props} variant="ribbon" />
export const Header = Object.assign(HeaderRoot, {
  Banner: HeaderBanner,
  Ribbon: HeaderRibbon,
})
export const Ticket = SkinTicket
export const IconFrame = SkinIconFrame
export const NavDrawer = SkinNavDrawer
export const DrawerButton = SkinDrawerButton
export const NavRail = SkinNavRail
export const RailButton = SkinRailButton
export const PaginationDot = SkinPaginationDot
export const PaginationDots = SkinPaginationDots

function DialogRoot(props: ComponentProps<typeof SkinDialog>) {
  return <SkinDialog {...props} />
}

export const Dialog = Object.assign(DialogRoot, {
  Confirmation: SkinConfirmationDialog,
  Reward: SkinRewardAnnouncement,
})

function StateRoot(props: ComponentProps<typeof SkinEmptyState>) {
  return <SkinEmptyState {...props} />
}

export const State = Object.assign(StateRoot, {
  Empty: SkinEmptyState,
  Loading: SkinLoadingState,
  Error: SkinErrorState,
})

export const Settings = {
  Row: SkinSettingsRow,
  Section: SkinSettingsSection,
}

function ToastInfo(props: Omit<ComponentProps<typeof SkinToastCard>, 'item'>) {
  return <SkinToastCard {...props} item={{ id: 'toast-info', severity: 'info', message: 'Info update' }} />
}

function ToastSuccess(props: Omit<ComponentProps<typeof SkinToastCard>, 'item'>) {
  return <SkinToastCard {...props} item={{ id: 'toast-success', severity: 'success', message: 'Success update' }} />
}

function ToastWarning(props: Omit<ComponentProps<typeof SkinToastCard>, 'item'>) {
  return <SkinToastCard {...props} item={{ id: 'toast-warning', severity: 'warning', message: 'Warning update' }} />
}

function ToastError(props: Omit<ComponentProps<typeof SkinToastCard>, 'item'>) {
  return <SkinToastCard {...props} item={{ id: 'toast-error', severity: 'error', message: 'Error update' }} />
}

export const Toast = {
  Info: ToastInfo,
  Success: ToastSuccess,
  Warning: ToastWarning,
  Error: ToastError,
  Card: SkinToastCard,
  Stack: SkinToastStack,
}

export function Background({ className, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  const hasChildren = Children.count(props.children) > 0

  return (
    <div
      {...props}
      className={className}
      data-ui-skin-role="surface.background"
      style={{
        backgroundImage: 'var(--ui-page-bg)',
        backgroundColor: 'var(--ui-page-bg-color, transparent)',
        color: 'var(--ui-text-primary)',
        width: '100%',
        ...(hasChildren
          ? {
              minHeight: '100%',
            }
          : {
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
            }),
        ...style,
      }}
    />
  )
}

export { SkinIcon as Icon } from './SkinIcon'
export { SkinTabBar as TabBar } from './SkinTabBar'
export { SkinListRow as ListRow } from './SkinListRow'
export { SkinRankBadge as RankBadge } from './SkinRankBadge'
export { SkinAvatarFrame as AvatarFrame } from './SkinAvatarFrame'
export { SkinCountdown as Countdown } from './SkinCountdown'
export { SkinShopCard as ShopCard } from './SkinShopCard'
export { SkinPriceLabel as PriceLabel } from './SkinPriceLabel'
export { SkinPromoBadge as PromoBadge } from './SkinPromoBadge'
export { NavBack, NavClose } from './SkinNavIcon'
export { SkinModalOverlay as ModalOverlay } from './SkinModalOverlay'
export type { SkinModalOverlayProps as ModalOverlayProps } from './SkinModalOverlay'
export { SkinCircleFrame as CircleFrame } from './SkinCircleFrame'
export { SkinActionChip as ActionChip } from './SkinActionChip'
export { Patterns } from './semanticPatterns'

export const Ftue = {
  Callout: SkinFtueCallout,
  StepCard: (props: Omit<ComponentProps<typeof SkinFtueCallout>, 'variant'>) => <SkinFtueCallout {...props} variant="step-card" />,
  GateBanner: (props: Omit<ComponentProps<typeof SkinFtueCallout>, 'variant'>) => <SkinFtueCallout {...props} variant="gate-banner" />,
  HighlightFrame: (props: SkinPanelSemanticProps) => <SkinPanel {...props} variant="section" />,
}
