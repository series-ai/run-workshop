import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sound } from '../src/audio.js';

describe('SoundSystem: Master Bus, Dynamics Compression and Volume Calibration', () => {
  let mockDestination: any;
  let mockMasterGain: any;
  let mockCompressor: any;
  let mockSfxGain: any;

  beforeEach(() => {
    // Mock Web Audio API in Node.js environment
    mockDestination = { id: 'destination' };
    const createMockParam = (initialVal = 0) => ({
      value: initialVal,
      setValueAtTime: vi.fn((val: number) => {}),
      exponentialRampToValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    });

    const createMockNode = () => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    (globalThis as any).window = {
      AudioContext: vi.fn().mockImplementation(() => ({
        state: 'running',
        currentTime: 0,
        sampleRate: 44100,
        destination: mockDestination,
        resume: vi.fn().mockResolvedValue(undefined),
        createGain: vi.fn().mockImplementation(() => ({
          ...createMockNode(),
          gain: createMockParam(1.0),
        })),
        createDynamicsCompressor: vi.fn().mockImplementation(() => ({
          ...createMockNode(),
          threshold: createMockParam(-24),
          knee: createMockParam(30),
          ratio: createMockParam(12),
          attack: createMockParam(0.003),
          release: createMockParam(0.25),
        })),
        createOscillator: vi.fn().mockImplementation(() => ({
          ...createMockNode(),
          frequency: createMockParam(440),
          type: 'sine',
          start: vi.fn(),
          stop: vi.fn(),
        })),
        createBufferSource: vi.fn().mockImplementation(() => ({
          ...createMockNode(),
          buffer: null,
          start: vi.fn(),
          stop: vi.fn(),
        })),
        createBuffer: vi.fn().mockImplementation((channels: number, length: number) => ({
          getChannelData: vi.fn().mockReturnValue(new Float32Array(length)),
        })),
        createBiquadFilter: vi.fn().mockImplementation(() => ({
          ...createMockNode(),
          frequency: createMockParam(1000),
          type: 'lowpass',
        })),
      })),
    };

    // Reset sound instance
    (sound as any).ctx = null;
    (sound as any).masterGain = null;
    (sound as any).compressor = null;
    (sound as any).sfxGain = null;
  });

  it('1. Initializes Master Dynamics Compressor and calibrated Master Gain Node', () => {
    const dest = sound.getDestination();
    expect(dest).toBeDefined();

    const masterGain = (sound as any).masterGain;
    const compressor = (sound as any).compressor;
    const sfxGain = (sound as any).sfxGain;

    expect(masterGain).toBeDefined();
    expect(compressor).toBeDefined();
    expect(sfxGain).toBeDefined();

    // Verify master volume defaults to calibrated safe level (0.32)
    expect(sound.getMasterVolume()).toBeCloseTo(0.32, 2);

    // Verify chain: sfxGain -> compressor -> masterGain -> destination
    expect(sfxGain.connect).toHaveBeenCalledWith(compressor);
    expect(compressor.connect).toHaveBeenCalledWith(masterGain);
    expect(masterGain.connect).toHaveBeenCalledWith(mockDestination);
  });

  it('2. Volume controls: setMasterVolume updates gain and clamps range 0.0 - 1.0', () => {
    sound.setMasterVolume(0.5);
    expect(sound.getMasterVolume()).toBe(0.5);

    sound.setMasterVolume(1.5); // Clamped
    expect(sound.getMasterVolume()).toBe(1.0);

    sound.setMasterVolume(-0.2); // Clamped
    expect(sound.getMasterVolume()).toBe(0.0);
  });

  it('3. Mute controls: setMuted silences master bus without losing volume setting', () => {
    sound.setMasterVolume(0.45);
    sound.setMuted(true);
    expect(sound.isAudioMuted()).toBe(true);
    expect(sound.getMasterVolume()).toBe(0.45);

    sound.setMuted(false);
    expect(sound.isAudioMuted()).toBe(false);
    expect(sound.getMasterVolume()).toBe(0.45);
  });

  it('4. Gunshot, Shotgun, and Explosion audio route through Master Bus', () => {
    expect(() => {
      sound.playGunshot();
      sound.playShotgun();
      sound.playExplosion();
      sound.playHitmarker(true);
      sound.playArmorHit();
    }).not.toThrow();

    const sfxGain = (sound as any).sfxGain;
    expect(sfxGain.connect).toHaveBeenCalled();
  });
});
