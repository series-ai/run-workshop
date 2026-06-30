import { GameIconName } from './types';
import { iconMap } from './config';

export function resolveIconName(gameName: GameIconName): string {
  return iconMap[gameName];
}

export function isValidIconName(name: string): name is GameIconName {
  return Object.prototype.hasOwnProperty.call(iconMap, name);
}

export function getAllIconNames(): GameIconName[] {
  return Object.keys(iconMap) as GameIconName[];
}
