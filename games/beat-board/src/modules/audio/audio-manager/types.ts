export type AudioCategory = 'sfx' | 'music' | 'voice'
export interface AudioTrack { id: string; url: string; category: AudioCategory; loop?: boolean }
export interface AudioState { sfxVolume: number; musicVolume: number; isMuted: boolean }
