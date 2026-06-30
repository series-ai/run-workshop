import type { CSSProperties, ReactNode } from 'react'
import type { SkinTagTone } from './SkinTag'
import type { UiSkinIconName } from './types'
import {
  ActionChip,
  ActionBar,
  Badge,
  Button,
  Chip,
  Cluster,
  Countdown,
  Dialog,
  Header,
  Icon,
  IconFrame,
  Label,
  Panel,
  ProgressBar,
  ResponsiveGrid,
  Stack,
  Tabs,
  Tag,
} from './semantic'

type PatternMetaProps = {
  className?: string
  style?: CSSProperties
  testId?: string
}

function patternMeta(patternName: string, testId?: string) {
  return {
    'data-semantic-pattern': patternName,
    'data-testid': testId,
  }
}

function StatValue({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--ui-font-display)',
        fontSize: 14,
        fontWeight: 'var(--ui-font-weight-heading)' as CSSProperties['fontWeight'],
      }}
    >
      {children}
    </div>
  )
}

export interface ChapterProgressHeaderProps extends PatternMetaProps {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  progressLabel?: string
  progressValue: number
  progressMax: number
  badge?: ReactNode
  actionLabel?: string
}

export function ChapterProgressHeader({
  eyebrow,
  title,
  subtitle,
  progressLabel,
  progressValue,
  progressMax,
  badge,
  actionLabel,
  className,
  style,
  testId,
}: ChapterProgressHeaderProps) {
  const percentage = progressMax > 0 ? (progressValue / progressMax) * 100 : 0
  return (
    <Panel.Card
      {...patternMeta('chapter-progress-header', testId)}
      className={className}
      style={style}
      title={<Header eyebrow={eyebrow} title={title} subtitle={subtitle} />}
    >
      <Stack>
        <ActionBar>
          <Chip.Value>{progressLabel ?? `${progressValue}/${progressMax}`}</Chip.Value>
          {badge ?? (actionLabel ? <Button.Ghost>{actionLabel}</Button.Ghost> : null)}
        </ActionBar>
        <ProgressBar value={percentage} label={`${progressValue}/${progressMax}`} showValue />
      </Stack>
    </Panel.Card>
  )
}

export interface CampaignStageNodeProps extends PatternMetaProps {
  title: ReactNode
  subtitle?: ReactNode
  iconName?: UiSkinIconName
  stateLabel?: ReactNode
  reward?: ReactNode
  actionLabel?: string
  locked?: boolean
}

export function CampaignStageNode({
  title,
  subtitle,
  iconName = 'trophy',
  stateLabel,
  reward,
  actionLabel,
  locked = false,
  className,
  style,
  testId,
}: CampaignStageNodeProps) {
  return (
    <Panel.Card
      {...patternMeta('campaign-stage-node', testId)}
      className={className}
      style={style}
      title={title}
      subtitle={subtitle}
    >
      <Stack>
        <ActionBar>
          <IconFrame iconName={iconName} />
          {stateLabel ? <Tag.Status tone={locked ? 'orange' : 'blue'}>{stateLabel}</Tag.Status> : null}
        </ActionBar>
        {reward ? (
          <ActionBar space="sm">
            <Label.Section>Reward</Label.Section>
            <StatValue>{reward}</StatValue>
          </ActionBar>
        ) : null}
        {actionLabel ? (
          <Stack space="sm">
            <Button.Primary disabled={locked}>{actionLabel}</Button.Primary>
          </Stack>
        ) : null}
      </Stack>
    </Panel.Card>
  )
}

export interface DeckSelectorTabSetProps extends PatternMetaProps {
  items: Array<{ id: string; label: string; badgeCount?: number }>
  activeId: string
}

export function DeckSelectorTabSet({
  items,
  activeId,
  className,
  style,
  testId,
}: DeckSelectorTabSetProps) {
  return (
    <div
      {...patternMeta('deck-selector-tab-set', testId)}
      className={className}
      style={style}
    >
      <Tabs activeId={activeId} items={items} />
    </div>
  )
}

export interface DeckSlotCardProps extends PatternMetaProps {
  title: ReactNode
  subtitle?: ReactNode
  iconName?: UiSkinIconName
  status?: ReactNode
  equipped?: boolean
  actionLabel?: string
}

export function DeckSlotCard({
  title,
  subtitle,
  iconName = 'shield',
  status,
  equipped = false,
  actionLabel,
  className,
  style,
  testId,
}: DeckSlotCardProps) {
  return (
    <Panel.Card
      {...patternMeta('deck-slot-card', testId)}
      className={className}
      style={style}
      title={title}
      subtitle={subtitle}
    >
      <Stack space="sm" align="start">
        <IconFrame iconName={iconName} />
        {status}
        {equipped ? <Button.Pill>Equipped</Button.Pill> : null}
        {actionLabel ? <Button.Secondary>{actionLabel}</Button.Secondary> : null}
      </Stack>
    </Panel.Card>
  )
}

export interface UpgradeCtaBlockProps extends PatternMetaProps {
  title: ReactNode
  subtitle?: ReactNode
  cost?: ReactNode
  requirement?: ReactNode
  actionLabel?: string
  ribbon?: string
}

export function UpgradeCtaBlock({
  title,
  subtitle,
  cost,
  requirement,
  actionLabel = 'Upgrade',
  ribbon,
  className,
  style,
  testId,
}: UpgradeCtaBlockProps) {
  return (
    <Panel.Section
      {...patternMeta('upgrade-cta-block', testId)}
      className={className}
      style={style}
      title={title}
      subtitle={subtitle}
    >
      <Stack>
        {requirement ? <Tag.Callout tone="orange">{requirement}</Tag.Callout> : null}
        {cost ? (
          <ActionBar>
            <Label.Section>Cost</Label.Section>
            <StatValue>{cost}</StatValue>
          </ActionBar>
        ) : null}
        <Button.Primary ribbon={ribbon}>{actionLabel}</Button.Primary>
      </Stack>
    </Panel.Section>
  )
}

export interface ConstructionBuildingCardProps extends PatternMetaProps {
  title: ReactNode
  subtitle?: ReactNode
  iconName?: UiSkinIconName
  countdown?: string
  progressValue?: number
  progressMax?: number
  queueLabel?: ReactNode
  actionLabel?: string
}

export function ConstructionBuildingCard({
  title,
  subtitle,
  iconName = 'settings',
  countdown,
  progressValue = 0,
  progressMax = 100,
  queueLabel,
  actionLabel,
  className,
  style,
  testId,
}: ConstructionBuildingCardProps) {
  return (
    <Panel.Card
      {...patternMeta('construction-building-card', testId)}
      className={className}
      style={style}
      title={title}
      subtitle={subtitle}
    >
      <Stack>
        <ActionBar>
          <IconFrame iconName={iconName} />
          {countdown ? <Countdown time={countdown} /> : null}
        </ActionBar>
        <ProgressBar value={progressMax > 0 ? (progressValue / progressMax) * 100 : 0} label={`${progressValue}/${progressMax}`} showValue />
        {queueLabel ? <Chip.Value>{queueLabel}</Chip.Value> : null}
        {actionLabel ? <Button.Secondary>{actionLabel}</Button.Secondary> : null}
      </Stack>
    </Panel.Card>
  )
}

export interface BuilderQueueRowProps extends PatternMetaProps {
  title: ReactNode
  subtitle?: ReactNode
  iconName?: UiSkinIconName
  countdown?: string
  progressValue?: number
  progressMax?: number
  actionLabel?: string
}

export function BuilderQueueRow({
  title,
  subtitle,
  iconName = 'settings',
  countdown,
  progressValue = 0,
  progressMax = 100,
  actionLabel,
  className,
  style,
  testId,
}: BuilderQueueRowProps) {
  return (
    <Panel.Section
      {...patternMeta('builder-queue-row', testId)}
      className={className}
      style={style}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center' }}>
        <IconFrame iconName={iconName} />
        <div style={{ display: 'grid', gap: 4 }}>
          <StatValue>{title}</StatValue>
          {subtitle ? <Label.Section>{subtitle}</Label.Section> : null}
          <ProgressBar value={progressMax > 0 ? (progressValue / progressMax) * 100 : 0} label={`${progressValue}/${progressMax}`} />
        </div>
        <div style={{ display: 'grid', justifyItems: 'end', gap: 6 }}>
          {countdown ? <Countdown time={countdown} /> : null}
          {actionLabel ? <Button.Ghost>{actionLabel}</Button.Ghost> : null}
        </div>
      </div>
    </Panel.Section>
  )
}

export interface TimedEventBannerProps extends PatternMetaProps {
  title: ReactNode
  subtitle?: ReactNode
  countdown: string
  reward?: ReactNode
  actionLabel?: string
}

export function TimedEventBanner({
  title,
  subtitle,
  countdown,
  reward,
  actionLabel,
  className,
  style,
  testId,
}: TimedEventBannerProps) {
  return (
    <Panel.Section
      {...patternMeta('timed-event-banner', testId)}
      className={className}
      style={style}
      title={<Header eyebrow="Live Event" title={title} subtitle={subtitle} />}
    >
      <ActionBar>
        <Countdown time={countdown} />
        {reward ? <Chip.Value>{reward}</Chip.Value> : null}
        {actionLabel ? <Button.Primary>{actionLabel}</Button.Primary> : null}
      </ActionBar>
    </Panel.Section>
  )
}

export interface MilestoneRowProps extends PatternMetaProps {
  title: ReactNode
  subtitle?: ReactNode
  progressValue: number
  progressMax: number
  reward: ReactNode
  rewardIconName?: UiSkinIconName
  complete?: boolean
  actionLabel?: string
}

export function MilestoneRow({
  title,
  subtitle,
  progressValue,
  progressMax,
  reward,
  rewardIconName = 'trophy',
  complete = false,
  actionLabel = 'Claim',
  className,
  style,
  testId,
}: MilestoneRowProps) {
  return (
    <Panel.Section
      {...patternMeta('milestone-row', testId)}
      className={className}
      style={style}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <StatValue>{title}</StatValue>
          {subtitle ? <Label.Section>{subtitle}</Label.Section> : null}
          <ProgressBar value={progressMax > 0 ? (progressValue / progressMax) * 100 : 0} label={`${progressValue}/${progressMax}`} />
        </div>
        <Chip.Currency iconName={rewardIconName}>{reward}</Chip.Currency>
        {complete ? <Button.Primary>{actionLabel}</Button.Primary> : <Tag.Status tone="blue">Locked</Tag.Status>}
      </div>
    </Panel.Section>
  )
}

export interface RewardCalendarDayCellProps extends PatternMetaProps {
  dayLabel: ReactNode
  rewardLabel: ReactNode
  iconName?: UiSkinIconName
  claimed?: boolean
  today?: boolean
  featured?: boolean
}

export function RewardCalendarDayCell({
  dayLabel,
  rewardLabel,
  iconName = 'coin',
  claimed = false,
  today = false,
  featured = false,
  className,
  style,
  testId,
}: RewardCalendarDayCellProps) {
  return (
    <Panel.Card
      {...patternMeta('reward-calendar-day-cell', testId)}
      className={className}
      style={{
        outline: today ? '2px solid var(--ui-button-primary-border, #2b74f2)' : undefined,
        outlineOffset: today ? '-2px' : undefined,
        opacity: claimed ? 0.45 : 1,
        ...style,
      }}
    >
      <Stack space="sm" align="center" style={{ textAlign: 'center' }}>
        <ActionBar space="sm">
          <Label.Section>{dayLabel}</Label.Section>
          {today ? <Badge.New>TODAY</Badge.New> : null}
        </ActionBar>
        <IconFrame iconName={iconName} size={featured ? 44 : 36} />
        <StatValue>{rewardLabel}</StatValue>
        {claimed ? <Tag.Status tone="green">Claimed</Tag.Status> : featured ? <Tag.Callout tone="orange">Featured</Tag.Callout> : null}
      </Stack>
    </Panel.Card>
  )
}

export interface ClaimCountdownBlockProps extends PatternMetaProps {
  title: ReactNode
  subtitle?: ReactNode
  countdown: string
  reward?: ReactNode
  actionLabel?: string
  disabled?: boolean
}

export function ClaimCountdownBlock({
  title,
  subtitle,
  countdown,
  reward,
  actionLabel = 'Claim',
  disabled = false,
  className,
  style,
  testId,
}: ClaimCountdownBlockProps) {
  return (
    <Panel.Section
      {...patternMeta('claim-countdown-block', testId)}
      className={className}
      style={style}
      title={title}
      subtitle={subtitle}
    >
      <Stack>
        <Countdown time={countdown} />
        {reward ? <Chip.Value>{reward}</Chip.Value> : null}
        <Button.Primary disabled={disabled}>{actionLabel}</Button.Primary>
      </Stack>
    </Panel.Section>
  )
}

export interface ModalFormShellProps extends PatternMetaProps {
  title: ReactNode
  subtitle?: ReactNode
  fields: ReactNode
  primaryActionLabel: string
  secondaryActionLabel?: string
  footerNote?: ReactNode
}

export function ModalFormShell({
  title,
  subtitle,
  fields,
  primaryActionLabel,
  secondaryActionLabel = 'Cancel',
  footerNote,
  className,
  style,
  testId,
}: ModalFormShellProps) {
  return (
    <Panel.Modal
      {...patternMeta('modal-form-shell', testId)}
      className={className}
      style={style}
      title={title}
      subtitle={subtitle}
    >
      <Stack space="lg">
        {fields}
        {footerNote ? <Label.Section>{footerNote}</Label.Section> : null}
        <ActionBar justify="end">
          <Button.Secondary>{secondaryActionLabel}</Button.Secondary>
          <Button.Primary>{primaryActionLabel}</Button.Primary>
        </ActionBar>
      </Stack>
    </Panel.Modal>
  )
}

export interface ConfirmDialogShellProps extends PatternMetaProps {
  title: ReactNode
  subtitle?: ReactNode
  iconName?: UiSkinIconName
  summary?: ReactNode
  message: ReactNode
  primaryActionLabel: ReactNode
  secondaryActionLabel?: ReactNode
  stackActions?: boolean
  actionsTestId?: string
}

export function ConfirmDialogShell({
  title,
  subtitle,
  iconName = 'coin',
  summary,
  message,
  primaryActionLabel,
  secondaryActionLabel = 'Cancel',
  stackActions = false,
  actionsTestId,
  className,
  style,
  testId,
}: ConfirmDialogShellProps) {
  return (
    <Dialog
      {...patternMeta('confirm-dialog-shell', testId)}
      className={className}
      contained
      showBackdrop={false}
      style={style}
      subtitle={subtitle}
      title={title}
      width="100%"
    >
      <Stack space="lg">
        {summary ? (
          <Cluster space="sm">
            <IconFrame iconName={iconName} />
            <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>{summary}</div>
          </Cluster>
        ) : null}
        <div style={{ lineHeight: 1.5 }}>{message}</div>
        <ResponsiveGrid
          data-testid={actionsTestId}
          min={stackActions ? 'wide' : 'tile'}
          space="sm"
        >
          {!stackActions ? <Button.Secondary style={{ width: '100%' }}>{secondaryActionLabel}</Button.Secondary> : null}
          <Button.Primary style={{ width: '100%' }}>{primaryActionLabel}</Button.Primary>
          {stackActions ? <Button.Secondary style={{ width: '100%' }}>{secondaryActionLabel}</Button.Secondary> : null}
        </ResponsiveGrid>
      </Stack>
    </Dialog>
  )
}

export interface AlertDialogShellProps extends PatternMetaProps {
  title: ReactNode
  statusLabel?: ReactNode
  message: ReactNode
  actionLabel: ReactNode
  iconName?: UiSkinIconName
}

export function AlertDialogShell({
  title,
  statusLabel,
  message,
  actionLabel,
  iconName = 'warning',
  className,
  style,
  testId,
}: AlertDialogShellProps) {
  return (
    <Dialog
      {...patternMeta('alert-dialog-shell', testId)}
      className={className}
      contained
      showBackdrop={false}
      style={style}
      title={title}
      width="100%"
    >
      <Stack space="lg" align="center" style={{ textAlign: 'center' }}>
        <IconFrame iconName={iconName} />
        {statusLabel ? <div>{statusLabel}</div> : null}
        <div style={{ lineHeight: 1.5 }}>{message}</div>
        <Stack space="sm">
          <Button.Primary style={{ width: '100%' }}>{actionLabel}</Button.Primary>
        </Stack>
      </Stack>
    </Dialog>
  )
}

export interface RewardBundleDialogProps extends PatternMetaProps {
  title?: ReactNode
  description?: ReactNode
  items?: ReactNode
  actionLabel?: ReactNode
}

export function RewardBundleDialog({
  title = 'Rewards Ready',
  description,
  items,
  actionLabel = 'Claim',
  className,
  style,
  testId,
}: RewardBundleDialogProps) {
  return (
    <Dialog.Reward
      {...patternMeta('reward-bundle-dialog', testId)}
      actionLabel={actionLabel}
      className={className}
      contained
      description={description}
      items={items}
      showBackdrop={false}
      style={style}
      title={title}
      width="100%"
    />
  )
}

export interface RewardCalendarDialogProps extends PatternMetaProps {
  title: ReactNode
  dayCells: ReactNode
  featuredReward?: ReactNode
  primaryActionLabel: ReactNode
}

export function RewardCalendarDialog({
  title,
  dayCells,
  featuredReward,
  primaryActionLabel,
  className,
  style,
  testId,
}: RewardCalendarDialogProps) {
  return (
    <Dialog
      {...patternMeta('reward-calendar-dialog', testId)}
      className={className}
      contained
      showBackdrop={false}
      style={style}
      title={title}
      width="100%"
    >
      <Stack>
        <ResponsiveGrid min="tile" space="sm">
          {dayCells}
          {featuredReward ? (
            <div>
              {featuredReward}
            </div>
          ) : null}
        </ResponsiveGrid>
        <Button.Primary style={{ width: '100%' }}>{primaryActionLabel}</Button.Primary>
      </Stack>
    </Dialog>
  )
}

type DialogSummaryStat = {
  label: ReactNode
  value: ReactNode
}

export interface StatusSummaryDialogProps extends PatternMetaProps {
  title: ReactNode
  statusLabel?: ReactNode
  progress?: ReactNode
  stats?: readonly DialogSummaryStat[]
  rewards?: ReactNode
  primaryActionLabel: ReactNode
  secondaryActionLabel?: ReactNode
}

export function StatusSummaryDialog({
  title,
  statusLabel,
  progress,
  stats = [],
  rewards,
  primaryActionLabel,
  secondaryActionLabel,
  className,
  style,
  testId,
}: StatusSummaryDialogProps) {
  return (
    <Dialog
      {...patternMeta('status-summary-dialog', testId)}
      className={className}
      contained
      showBackdrop={false}
      style={style}
      title={title}
      width="100%"
    >
      <Stack space="lg" align="center" style={{ textAlign: 'center' }}>
        {statusLabel ? <div>{statusLabel}</div> : null}
        {progress ? <div style={{ width: '100%' }}>{progress}</div> : null}
        {stats.length > 0 ? (
          <Stack space="xs">
            {stats.map((stat, index) => (
              <ActionBar
                key={index}
              >
                <Label.Section>{stat.label}</Label.Section>
                <StatValue>{stat.value}</StatValue>
              </ActionBar>
            ))}
          </Stack>
        ) : null}
        {rewards ? <Cluster space="sm" justify="center">{rewards}</Cluster> : null}
        <ResponsiveGrid min={secondaryActionLabel ? 'tile' : 'wide'}>
          {secondaryActionLabel ? <Button.Ghost style={{ width: '100%' }}>{secondaryActionLabel}</Button.Ghost> : null}
          <Button.Primary style={{ width: '100%' }}>{primaryActionLabel}</Button.Primary>
        </ResponsiveGrid>
      </Stack>
    </Dialog>
  )
}

export interface SegmentedToolbarRowProps extends PatternMetaProps {
  title?: ReactNode
  segments: Array<{ id: string; label: string }>
  activeId: string
  primaryActionLabel?: string
  secondaryActionLabel?: string
}

export function SegmentedToolbarRow({
  title,
  segments,
  activeId,
  primaryActionLabel,
  secondaryActionLabel,
  className,
  style,
  testId,
}: SegmentedToolbarRowProps) {
  return (
    <Panel.Section
      {...patternMeta('segmented-toolbar-row', testId)}
      className={className}
      style={style}
    >
      <Stack space="sm">
        {title ? <Label.Title>{title}</Label.Title> : null}
        <ActionBar>
          <div style={{ minWidth: 220, flex: 1 }}>
            <Tabs activeId={activeId} items={segments} />
          </div>
          <Cluster space="sm">
            {secondaryActionLabel ? <Button.Ghost size="compact">{secondaryActionLabel}</Button.Ghost> : null}
            {primaryActionLabel ? <Button.Secondary size="compact">{primaryActionLabel}</Button.Secondary> : null}
          </Cluster>
        </ActionBar>
      </Stack>
    </Panel.Section>
  )
}

export interface CommunityCardShellProps extends PatternMetaProps {
  title: ReactNode
  subtitle?: ReactNode
  artwork?: ReactNode
  tagLabel?: ReactNode
  statLabel?: ReactNode
  primaryActionLabel?: string
  secondaryActionLabel?: string
}

export function CommunityCardShell({
  title,
  subtitle,
  artwork,
  tagLabel,
  statLabel,
  primaryActionLabel,
  secondaryActionLabel,
  className,
  style,
  testId,
}: CommunityCardShellProps) {
  return (
    <Panel.Card
      {...patternMeta('community-card-shell', testId)}
      className={className}
      style={style}
      title={title}
      subtitle={subtitle}
    >
      <Stack>
        <ActionBar>
          {artwork ?? <IconFrame iconName="star" size={44} />}
          <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
            {tagLabel ? <Tag.Status tone="purple">{tagLabel}</Tag.Status> : null}
            {statLabel ? <Chip.Value>{statLabel}</Chip.Value> : null}
          </div>
        </ActionBar>
        <Cluster space="sm">
          {secondaryActionLabel ? <Button.Ghost>{secondaryActionLabel}</Button.Ghost> : null}
          {primaryActionLabel ? <Button.Primary>{primaryActionLabel}</Button.Primary> : null}
        </Cluster>
      </Stack>
    </Panel.Card>
  )
}

export interface CommunityGridTileShellProps extends PatternMetaProps {
  title: ReactNode
  subtitle?: ReactNode
  artwork?: ReactNode
  tagLabel?: ReactNode
  statLabel?: ReactNode
  actionLabel?: string
}

export function CommunityGridTileShell({
  title,
  subtitle,
  artwork,
  tagLabel,
  statLabel,
  actionLabel,
  className,
  style,
  testId,
}: CommunityGridTileShellProps) {
  return (
    <Panel.Card
      {...patternMeta('community-grid-tile-shell', testId)}
      className={className}
      style={style}
    >
      <Stack space="sm">
        <Stack space="sm" align="center" style={{ textAlign: 'center' }}>
          {artwork ?? <IconFrame iconName="sparkles" size={48} />}
          <StatValue>{title}</StatValue>
          {subtitle ? <Label.Section>{subtitle}</Label.Section> : null}
          {tagLabel ? <Tag.Status tone="green">{tagLabel}</Tag.Status> : null}
          {statLabel ? <Chip.Value>{statLabel}</Chip.Value> : null}
        </Stack>
        {actionLabel ? <Button.Secondary>{actionLabel}</Button.Secondary> : null}
      </Stack>
    </Panel.Card>
  )
}

export interface MergeOrderRibbonCardProps extends PatternMetaProps {
  title: ReactNode
  subtitle?: ReactNode
  items?: Array<{ iconName: UiSkinIconName; label: ReactNode }>
  progressValue?: number
  progressMax?: number
  reward?: ReactNode
  countdown?: string
  actionLabel?: string
}

export function MergeOrderRibbonCard({
  title,
  subtitle,
  items = [],
  progressValue = 0,
  progressMax = 100,
  reward,
  countdown,
  actionLabel,
  className,
  style,
  testId,
}: MergeOrderRibbonCardProps) {
  return (
    <Panel.Card
      {...patternMeta('merge-order-ribbon-card', testId)}
      className={className}
      style={style}
      title={title}
      subtitle={subtitle}
    >
      <Stack>
        {countdown ? <Countdown time={countdown} /> : null}
        {items.length > 0 ? (
          <Cluster space="sm">
            {items.map((item) => (
              <Chip.Value key={`${item.iconName}-${String(item.label)}`}>
                <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <Icon name={item.iconName} size={14} />
                  {item.label}
                </span>
              </Chip.Value>
            ))}
          </Cluster>
        ) : null}
        <ProgressBar value={progressMax > 0 ? (progressValue / progressMax) * 100 : 0} label={`${progressValue}/${progressMax}`} showValue />
        <ActionBar>
          {reward ? <Tag.Callout tone="orange">{reward}</Tag.Callout> : <span />}
          {actionLabel ? <Button.Primary>{actionLabel}</Button.Primary> : null}
        </ActionBar>
      </Stack>
    </Panel.Card>
  )
}

export interface StorageDrawerRowProps extends PatternMetaProps {
  title: ReactNode
  subtitle?: ReactNode
  iconName?: UiSkinIconName
  quantity?: ReactNode
  status?: ReactNode
  primaryActionLabel?: string
  secondaryActionLabel?: string
}

export function StorageDrawerRow({
  title,
  subtitle,
  iconName = 'package',
  quantity,
  status,
  primaryActionLabel,
  secondaryActionLabel,
  className,
  style,
  testId,
}: StorageDrawerRowProps) {
  return (
    <Panel.Section
      {...patternMeta('storage-drawer-row', testId)}
      className={className}
      style={style}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center' }}>
        <IconFrame iconName={iconName} />
        <div style={{ display: 'grid', gap: 4 }}>
          <StatValue>{title}</StatValue>
          {subtitle ? <Label.Section>{subtitle}</Label.Section> : null}
          <Cluster space="sm">
            {quantity ? <Chip.Value>{quantity}</Chip.Value> : null}
            {status ? <Tag.Status tone="blue">{status}</Tag.Status> : null}
          </Cluster>
        </div>
        <Stack space="xs">
          {primaryActionLabel ? <Button.Primary>{primaryActionLabel}</Button.Primary> : null}
          {secondaryActionLabel ? <Button.Ghost>{secondaryActionLabel}</Button.Ghost> : null}
        </Stack>
      </div>
    </Panel.Section>
  )
}

export interface EditorToolbarActionStripProps extends PatternMetaProps {
  title?: ReactNode
  actions: Array<{ id: string; label: string; iconName: UiSkinIconName; active?: boolean }>
}

export function EditorToolbarActionStrip({
  title,
  actions,
  className,
  style,
  testId,
}: EditorToolbarActionStripProps) {
  return (
    <Panel.Section
      {...patternMeta('editor-toolbar-action-strip', testId)}
      className={className}
      style={style}
    >
      <Stack space="sm">
        {title ? <Label.Title>{title}</Label.Title> : null}
        <Cluster space="sm">
          {actions.map((action) => (
            <ActionChip
              key={action.id}
              aria-pressed={action.active}
              style={action.active ? { outline: '2px solid var(--ui-button-secondary-border, #3a8dff)' } : undefined}
              iconName={action.iconName}
              label={action.label}
            />
          ))}
        </Cluster>
      </Stack>
    </Panel.Section>
  )
}

export interface DialogueChoiceRowProps extends PatternMetaProps {
  title: ReactNode
  subtitle?: ReactNode
  iconName?: UiSkinIconName
  selected?: boolean
}

export function DialogueChoiceRow({
  title,
  subtitle,
  iconName = 'info',
  selected = false,
  className,
  style,
  testId,
}: DialogueChoiceRowProps) {
  return (
    <Button.Secondary
      {...patternMeta('dialogue-choice-row', testId)}
      active={selected}
      className={className}
      style={{
        justifyContent: 'flex-start',
        textAlign: 'left',
        width: '100%',
        ...style,
      }}
      leadingVisual={<IconFrame iconName={iconName} size={36} />}
    >
      <span style={{ display: 'grid', gap: 4 }}>
        <StatValue>{title}</StatValue>
        {subtitle ? <Label.Section>{subtitle}</Label.Section> : null}
      </span>
    </Button.Secondary>
  )
}

export interface CampaignMapNodeProps extends PatternMetaProps {
  title: ReactNode
  subtitle?: ReactNode
  iconName?: UiSkinIconName
  status?: ReactNode
  actionLabel?: string
}

export function CampaignMapNode({
  title,
  subtitle,
  iconName = 'star',
  status,
  actionLabel,
  className,
  style,
  testId,
}: CampaignMapNodeProps) {
  return (
    <Panel.Card
      {...patternMeta('campaign-map-node', testId)}
      className={className}
      style={style}
    >
      <Stack space="sm" align="center" style={{ textAlign: 'center' }}>
        <IconFrame iconName={iconName} size={40} />
        <StatValue>{title}</StatValue>
        {subtitle ? <Label.Section>{subtitle}</Label.Section> : null}
        {status ? <Tag.Status tone="green">{status}</Tag.Status> : null}
        {actionLabel ? <Button.Primary>{actionLabel}</Button.Primary> : null}
      </Stack>
    </Panel.Card>
  )
}

export interface CampaignMapLegendProps extends PatternMetaProps {
  items: Array<{ label: ReactNode; iconName: UiSkinIconName; tone?: SkinTagTone }>
}

export function CampaignMapLegend({
  items,
  className,
  style,
  testId,
}: CampaignMapLegendProps) {
  return (
    <Panel.Section
      {...patternMeta('campaign-map-legend', testId)}
      className={className}
      style={style}
      title="Legend"
    >
      <Stack space="sm">
        {items.map((item) => (
          <Cluster key={`${item.iconName}-${String(item.label)}`} space="sm">
            <Icon name={item.iconName} size={16} />
            <Label.Section>{item.label}</Label.Section>
            <Tag.Status tone={item.tone ?? 'blue'}>{item.label}</Tag.Status>
          </Cluster>
        ))}
      </Stack>
    </Panel.Section>
  )
}

export interface CampaignMapTooltipProps extends PatternMetaProps {
  title: ReactNode
  subtitle?: ReactNode
  reward?: ReactNode
  requirement?: ReactNode
}

export function CampaignMapTooltip({
  title,
  subtitle,
  reward,
  requirement,
  className,
  style,
  testId,
}: CampaignMapTooltipProps) {
  return (
    <Panel.Tooltip
      {...patternMeta('campaign-map-tooltip', testId)}
      className={className}
      style={style}
      title={title}
    >
      <Stack space="sm">
        {subtitle ? <Label.Section>{subtitle}</Label.Section> : null}
        {reward ? <Chip.Value>{reward}</Chip.Value> : null}
        {requirement ? <Tag.Callout tone="orange">{requirement}</Tag.Callout> : null}
      </Stack>
    </Panel.Tooltip>
  )
}

export interface ActionableTileProps extends PatternMetaProps {
  title: ReactNode
  body?: ReactNode
  iconName?: UiSkinIconName
  badge?: ReactNode
  costLabel?: ReactNode
  actionLabel: string
  onAction?: () => void
  disabled?: boolean
  minHeight?: number | string
}

/**
 * "Choice tile" — icon + optional badge header, title, body copy, and a
 * footer row with a cost/value tag and a primary CTA. Used for create-mode
 * pickers, shop entries, and any grid of "pick one of these" cards.
 *
 * The footer row wraps gracefully, so narrow viewports stack the cost
 * tag above the action button instead of overflowing the panel.
 */
export function ActionableTile({
  title,
  body,
  iconName,
  badge,
  costLabel,
  actionLabel,
  onAction,
  disabled = false,
  minHeight = 160,
  className,
  style,
  testId,
}: ActionableTileProps) {
  return (
    <Panel.Card
      {...patternMeta('actionable-tile', testId)}
      className={className}
      style={style}
    >
      <Stack space="sm" style={{ minHeight, alignContent: 'start' }}>
        {iconName || badge ? (
          <ActionBar space="sm">
            {iconName ? <IconFrame iconName={iconName} /> : <span />}
            {badge ?? null}
          </ActionBar>
        ) : null}
        <Label.Title>{title}</Label.Title>
        {body ? <div style={{ color: 'var(--ui-text-muted)', lineHeight: 1.4 }}>{body}</div> : null}
        <ActionBar style={{ marginTop: 'auto' }}>
          {costLabel ? <Tag.Value>{costLabel}</Tag.Value> : <span />}
          <Button.Primary disabled={disabled} onClick={onAction}>
            {actionLabel}
          </Button.Primary>
        </ActionBar>
      </Stack>
    </Panel.Card>
  )
}

export const Patterns = {
  ActionableTile,
  ChapterProgressHeader,
  CampaignStageNode,
  DeckSelectorTabSet,
  DeckSlotCard,
  UpgradeCtaBlock,
  ConstructionBuildingCard,
  BuilderQueueRow,
  TimedEventBanner,
  MilestoneRow,
  RewardCalendarDayCell,
  ClaimCountdownBlock,
  ModalFormShell,
  ConfirmDialogShell,
  AlertDialogShell,
  RewardBundleDialog,
  RewardCalendarDialog,
  StatusSummaryDialog,
  SegmentedToolbarRow,
  CommunityCardShell,
  CommunityGridTileShell,
  MergeOrderRibbonCard,
  StorageDrawerRow,
  EditorToolbarActionStrip,
  DialogueChoiceRow,
  CampaignMapNode,
  CampaignMapLegend,
  CampaignMapTooltip,
} as const
