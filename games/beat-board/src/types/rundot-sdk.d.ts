declare module '@series-inc/rundot-game-sdk/api' {
  const RundotAPI: any
  export default RundotAPI
}

declare module '@series-inc/rundot-game-sdk' {
  export enum HapticFeedbackStyle {
    Light = 'light',
    Medium = 'medium',
    Heavy = 'heavy',
  }
}
