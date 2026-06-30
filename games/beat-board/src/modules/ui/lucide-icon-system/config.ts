import { GameIconName } from './types';

// Maps game icon names to lucide-react icon names
export const iconMap: Record<GameIconName, string> = {
  coin: 'Coins', gem: 'Gem', heart: 'Heart', star: 'Star', shield: 'Shield',
  sword: 'Sword', trophy: 'Trophy', lock: 'Lock', unlock: 'Unlock',
  check: 'Check', close: 'X', info: 'Info', warning: 'AlertTriangle',
  success: 'CheckCircle', error: 'XCircle'
}
