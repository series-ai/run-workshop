export type OrientationMode = 'responsive' | 'portrait' | 'landscape'
export type DesktopNavMode = 'sidebar' | 'rail'

export interface AppShellConfig {
  orientation: OrientationMode
  desktopNavMode: DesktopNavMode
}

/**
 * App shell defaults used by the scaffold template.
 *
 * Scaffolded projects should update this file when the visual design specifies:
 * - portrait-locked or landscape-locked behavior
 * - desktop nav as a full sidebar vs an icon rail
 */
export const appShellConfig: AppShellConfig = {
  orientation: 'responsive',
  desktopNavMode: 'sidebar',
}
