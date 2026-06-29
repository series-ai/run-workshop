import { createUiSkinIconPack, createUiSkinSvgIcon, type UiSkinResolvedIconComponent } from './runtime'

const coinIcon = createUiSkinSvgIcon(
  <>
    <circle cx="12" cy="12" r="8" />
    <path d="M9.5 9.5h5a2 2 0 0 1 0 4h-5a2 2 0 0 0 0 4h5" />
  </>,
)

const gemIcon = createUiSkinSvgIcon(
  <path d="M6 9l3-4h6l3 4-6 10-6-10Z" />,
)

const heartIcon = createUiSkinSvgIcon(
  <path d="M12 19s-7-4.4-7-9.5A4 4 0 0 1 12 7a4 4 0 0 1 7 2.5C19 14.6 12 19 12 19Z" />,
)

const starIcon = createUiSkinSvgIcon(
  <path d="m12 4 2.5 5 5.5.8-4 3.9 1 5.5L12 16.5 7 19.2l1-5.5-4-3.9 5.5-.8L12 4Z" />,
)

const sparklesIcon = createUiSkinSvgIcon(
  <>
    <path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z" />
    <path d="m18.5 13 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
    <path d="m5.5 13 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
  </>,
)

const flameIcon = createUiSkinSvgIcon(
  <path d="M12 3c2.2 2 4.5 4.9 4.5 8.2A4.5 4.5 0 0 1 12 15.7a4.5 4.5 0 0 1-4.5-4.5C7.5 7.9 9.8 5 12 3Zm0 7.3c1 0 1.8.8 1.8 1.8S13 13.9 12 13.9s-1.8-.8-1.8-1.8.8-1.8 1.8-1.8Z" />,
)

const playIcon = createUiSkinSvgIcon(
  <path d="M8 6v12l10-6-10-6Z" />,
)

const shieldIcon = createUiSkinSvgIcon(
  <path d="M12 4 6 6v5c0 4 2.4 6.9 6 9 3.6-2.1 6-5 6-9V6l-6-2Z" />,
)

const swordIcon = createUiSkinSvgIcon(
  <path d="m14 4 6 6-2 2-2-2-4 4 2 2-2 2-2-2-4 4-2-2 4-4-2-2 2-2 2 2 4-4-2-2 2-2Z" />,
)

const skullIcon = createUiSkinSvgIcon(
  <>
    <path d="M8 15v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2" />
    <path d="M8.5 15C7 14 6 12 6 9.8A6 6 0 0 1 12 4a6 6 0 0 1 6 5.8c0 2.2-1 4.2-2.5 5.2" />
    <circle cx="9.5" cy="10" r="1" fill="currentColor" stroke="none" />
    <circle cx="14.5" cy="10" r="1" fill="currentColor" stroke="none" />
    <path d="M11 13h2l-1 1.5L11 13Z" />
  </>,
)

const trophyIcon = createUiSkinSvgIcon(
  <>
    <path d="M8 5h8v3a4 4 0 0 1-8 0V5Z" />
    <path d="M9 16h6" />
    <path d="M10 19h4" />
    <path d="M8 7H5a2 2 0 0 0 2 3h1" />
    <path d="M16 7h3a2 2 0 0 1-2 3h-1" />
  </>,
)

const giftIcon = createUiSkinSvgIcon(
  <>
    <rect x="4" y="8" width="16" height="12" rx="2" />
    <path d="M12 8v12" />
    <path d="M4 12h16" />
    <path d="M12 8H8.5A2.5 2.5 0 0 1 6 5.5 2.5 2.5 0 0 1 8.5 3C10.5 3 12 4.8 12 8Z" />
    <path d="M12 8h3.5A2.5 2.5 0 0 0 18 5.5 2.5 2.5 0 0 0 15.5 3C13.5 3 12 4.8 12 8Z" />
  </>,
)

const bagIcon = createUiSkinSvgIcon(
  <>
    <path d="M7 8h10l1 11H6L7 8Z" />
    <path d="M9 8a3 3 0 0 1 6 0" />
    <path d="M9 11v0" />
    <path d="M15 11v0" />
  </>,
)

const cardsIcon = createUiSkinSvgIcon(
  <>
    <rect x="7" y="5" width="10" height="14" rx="2" />
    <path d="M9 8h6" />
    <path d="M9 11h4" />
    <path d="M5 8V6a2 2 0 0 1 2-2h8" />
    <path d="M19 10v8a2 2 0 0 1-2 2H9" />
  </>,
)

const packageIcon = createUiSkinSvgIcon(
  <>
    <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" />
    <path d="M12 4v16" />
    <path d="M4 8.5 12 13l8-4.5" />
  </>,
)

const lockIcon = createUiSkinSvgIcon(
  <>
    <rect x="7" y="11" width="10" height="8" rx="2" />
    <path d="M9 11V8a3 3 0 0 1 6 0v3" />
  </>,
)

const unlockIcon = createUiSkinSvgIcon(
  <>
    <rect x="7" y="11" width="10" height="8" rx="2" />
    <path d="M15 11V8a3 3 0 0 0-6 0" />
  </>,
)

const checkIcon = createUiSkinSvgIcon(
  <path d="m5 12 4 4 10-10" />,
)

const closeIcon = createUiSkinSvgIcon(
  <>
    <path d="M6 6l12 12" />
    <path d="M18 6 6 18" />
  </>,
)

const backIcon = createUiSkinSvgIcon(
  <path d="M19 12H5m6-6-6 6 6 6" />,
)

const infoIcon = createUiSkinSvgIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 10v5" />
    <path d="M12 7h.01" />
  </>,
)

const questionIcon = createUiSkinSvgIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.8 9.2a2.6 2.6 0 0 1 4.7 1.3c0 1.7-1.8 2.2-2.5 3.2" />
    <path d="M12 16h.01" />
  </>,
)

const warningIcon = createUiSkinSvgIcon(
  <>
    <path d="M12 4 3 19h18L12 4Z" />
    <path d="M12 9v4" />
    <path d="M12 16h.01" />
  </>,
)

const successIcon = createUiSkinSvgIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12 2.5 2.5L16 9" />
  </>,
)

const errorIcon = createUiSkinSvgIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9l6 6" />
    <path d="M15 9 9 15" />
  </>,
)

const homeIcon = createUiSkinSvgIcon(
  <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
)

const mailIcon = createUiSkinSvgIcon(
  <>
    <rect x="4" y="6" width="16" height="12" rx="2" />
    <path d="m5 7 7 6 7-6" />
  </>,
)

const chatIcon = createUiSkinSvgIcon(
  <path d="M5 6h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H11l-4 3v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />,
)

const searchIcon = createUiSkinSvgIcon(
  <>
    <circle cx="11" cy="11" r="6" />
    <path d="m20 20-4.2-4.2" />
  </>,
)

const megaphoneIcon = createUiSkinSvgIcon(
  <>
    <path d="M4 11v2l10-4V5L4 9v2Z" />
    <path d="M14 5v8" />
    <path d="M8 13v4a2 2 0 0 0 2 2h1" />
    <path d="M16 8h2a2 2 0 0 1 0 4h-2" />
  </>,
)

const settingsIcon = createUiSkinSvgIcon(
  <>
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 3.5v2.2" />
    <path d="M12 18.3v2.2" />
    <path d="m4.9 6.1 1.6 1.6" />
    <path d="m17.5 18.7 1.6 1.6" />
    <path d="M3.5 12h2.2" />
    <path d="M18.3 12h2.2" />
    <path d="m4.9 17.9 1.6-1.6" />
    <path d="m17.5 5.3 1.6-1.6" />
  </>,
)

const gamepadIcon = createUiSkinSvgIcon(
  <>
    <path d="M7.5 9h9A4.5 4.5 0 0 1 21 13.5v1a3.5 3.5 0 0 1-6 2.5l-1.2-1.2a2.5 2.5 0 0 0-3.6 0L9 17a3.5 3.5 0 0 1-6-2.5v-1A4.5 4.5 0 0 1 7.5 9Z" />
    <path d="M8 12v4" />
    <path d="M6 14h4" />
    <circle cx="16.5" cy="13" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="18.5" cy="15" r="0.8" fill="currentColor" stroke="none" />
  </>,
)

const clockIcon = createUiSkinSvgIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </>,
)

const rank1Icon = createUiSkinSvgIcon(
  <>
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2" />
    <circle cx="12" cy="12" r="9" />
    <text x="12" y="16" textAnchor="middle" fontSize="12" fontWeight="800" fill="currentColor" stroke="none">1</text>
  </>,
)

const rank2Icon = createUiSkinSvgIcon(
  <>
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15" />
    <circle cx="12" cy="12" r="9" />
    <text x="12" y="16" textAnchor="middle" fontSize="12" fontWeight="800" fill="currentColor" stroke="none">2</text>
  </>,
)

const rank3Icon = createUiSkinSvgIcon(
  <>
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.1" />
    <circle cx="12" cy="12" r="9" />
    <text x="12" y="16" textAnchor="middle" fontSize="12" fontWeight="800" fill="currentColor" stroke="none">3</text>
  </>,
)

const plusIcon = createUiSkinSvgIcon(
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>,
)

const shareIcon = createUiSkinSvgIcon(
  <>
    <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </>,
)

const copyIcon = createUiSkinSvgIcon(
  <>
    <rect x="9" y="9" width="10" height="10" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </>,
)

const undoIcon = createUiSkinSvgIcon(
  <>
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9H3" />
  </>,
)

const redoIcon = createUiSkinSvgIcon(
  <>
    <path d="M21 7v6h-6" />
    <path d="M3 17a9 9 0 0 1 9-9h9" />
  </>,
)

const pencilIcon = createUiSkinSvgIcon(
  <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" />,
)

const eraserIcon = createUiSkinSvgIcon(
  <>
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
    <path d="M22 21H7" />
    <path d="m5 11 9 9" />
  </>,
)

const linkIcon = createUiSkinSvgIcon(
  <>
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </>,
)

const userIcon = createUiSkinSvgIcon(
  <>
    <circle cx="12" cy="8" r="5" />
    <path d="M20 21a8 8 0 1 0-16 0" />
  </>,
)

const usersIcon = createUiSkinSvgIcon(
  <>
    <circle cx="9" cy="7" r="4" />
    <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
    <circle cx="17" cy="7" r="3" />
    <path d="M21 21v-2a3 3 0 0 0-3-3h-.5" />
  </>,
)

const alertIcon = createUiSkinSvgIcon(
  <>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </>,
)

const LUCIDE_STYLE_ICON_COMPONENTS = {
  coin: coinIcon,
  gem: gemIcon,
  heart: heartIcon,
  star: starIcon,
  sparkles: sparklesIcon,
  flame: flameIcon,
  play: playIcon,
  shield: shieldIcon,
  sword: swordIcon,
  skull: skullIcon,
  trophy: trophyIcon,
  gift: giftIcon,
  bag: bagIcon,
  shop: bagIcon,
  cards: cardsIcon,
  package: packageIcon,
  lock: lockIcon,
  unlock: unlockIcon,
  check: checkIcon,
  close: closeIcon,
  back: backIcon,
  info: infoIcon,
  question: questionIcon,
  warning: warningIcon,
  success: successIcon,
  error: errorIcon,
  home: homeIcon,
  mail: mailIcon,
  chat: chatIcon,
  search: searchIcon,
  megaphone: megaphoneIcon,
  settings: settingsIcon,
  gamepad: gamepadIcon,
  clock: clockIcon,
  'rank-1': rank1Icon,
  'rank-2': rank2Icon,
  'rank-3': rank3Icon,
  // New icons (added for PRD-referenced names)
  plus: plusIcon,
  share: shareIcon,
  copy: copyIcon,
  undo: undoIcon,
  redo: redoIcon,
  pencil: pencilIcon,
  eraser: eraserIcon,
  link: linkIcon,
  user: userIcon,
  users: usersIcon,
  help: questionIcon, // alias
  alert: alertIcon,
} satisfies Record<string, UiSkinResolvedIconComponent>

export const lucideUiSkinIconPack = createUiSkinIconPack({
  id: 'lucide',
  label: 'Lucide',
  icons: LUCIDE_STYLE_ICON_COMPONENTS,
})
