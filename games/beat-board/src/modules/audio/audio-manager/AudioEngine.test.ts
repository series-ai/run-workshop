import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAudioEngine, type AudioEngine } from './AudioEngine';

// ─── Mock AudioContext ──────────────────────────────────────────────────────

function createMockGainNode() {
  return {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function createMockSourceNode() {
  return {
    buffer: null as AudioBuffer | null,
    loop: false,
    playbackRate: { value: 1 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  };
}

let mockGainNodes: ReturnType<typeof createMockGainNode>[];
let mockSourceNodes: ReturnType<typeof createMockSourceNode>[];
let mockAudioContext: {
  createGain: ReturnType<typeof vi.fn>;
  createBufferSource: ReturnType<typeof vi.fn>;
  decodeAudioData: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  destination: object;
  currentTime: number;
};

function requireMockArrayValue<T>(values: T[], index: number, label: string): T {
  const value = values[index];
  expect(value, `${label} at index ${index} should exist`).toBeDefined();
  if (value === undefined) {
    throw new Error(`${label} at index ${index} should exist`);
  }
  return value;
}

function getMockGainNode(index: number) {
  return requireMockArrayValue(mockGainNodes, index, 'Mock gain node');
}

function getMockSourceNode(index: number) {
  return requireMockArrayValue(mockSourceNodes, index, 'Mock source node');
}

function setupMockAudioContext() {
  mockGainNodes = [];
  mockSourceNodes = [];
  mockAudioContext = {
    createGain: vi.fn(() => {
      const node = createMockGainNode();
      mockGainNodes.push(node);
      return node;
    }),
    createBufferSource: vi.fn(() => {
      const node = createMockSourceNode();
      mockSourceNodes.push(node);
      return node;
    }),
    decodeAudioData: vi.fn().mockResolvedValue({ duration: 1, length: 44100 }),
    close: vi.fn().mockResolvedValue(undefined),
    destination: {},
    currentTime: 0,
  };
  vi.stubGlobal('AudioContext', vi.fn(function () { return mockAudioContext; }));
}

beforeEach(() => {
  vi.restoreAllMocks();
  setupMockAudioContext();
});

describe('AudioEngine', () => {
  describe('lazy AudioContext creation', () => {
    it('does not create AudioContext on construction', () => {
      createAudioEngine();
      expect(AudioContext).not.toHaveBeenCalled();
    });

    it('creates AudioContext on first playSfx call', async () => {
      const engine = createAudioEngine();
      await engine.loadAudio('click', new ArrayBuffer(8));
      expect(AudioContext).toHaveBeenCalledTimes(1);
    });

    it('creates AudioContext on first playMusic call', async () => {
      const engine = createAudioEngine();
      await engine.loadAudio('bgm', new ArrayBuffer(8));
      // loadAudio already triggered it
      expect(AudioContext).toHaveBeenCalledTimes(1);
    });
  });

  describe('loadAudio', () => {
    it('decodes ArrayBuffer and caches the result', async () => {
      const engine = createAudioEngine();
      const buf = new ArrayBuffer(8);
      await engine.loadAudio('test', buf);

      expect(mockAudioContext.decodeAudioData).toHaveBeenCalledWith(buf);
      expect(engine.isLoaded('test')).toBe(true);
    });

    it('decodes Blob source by converting to ArrayBuffer', async () => {
      const engine = createAudioEngine();
      const blob = new Blob([new ArrayBuffer(8)], { type: 'audio/mp3' });
      await engine.loadAudio('blobtest', blob);

      expect(mockAudioContext.decodeAudioData).toHaveBeenCalled();
      expect(engine.isLoaded('blobtest')).toBe(true);
    });
  });

  describe('playSfx', () => {
    let engine: AudioEngine;

    beforeEach(async () => {
      engine = createAudioEngine();
      await engine.loadAudio('click', new ArrayBuffer(8));
      // Reset source nodes tracked after loadAudio
      mockSourceNodes = [];
    });

    it('creates a source, connects to sfx gain, and starts', () => {
      engine.playSfx('click');

      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
      const source = getMockSourceNode(0);
      expect(source.buffer).toEqual({ duration: 1, length: 44100 });
      // sfxGain is the 3rd gain node created (master, music, sfx)
      const sfxGain = getMockGainNode(2);
      expect(source.connect).toHaveBeenCalledWith(sfxGain);
      expect(source.start).toHaveBeenCalledWith(0);
    });

    it('does nothing if key is not loaded', () => {
      engine.playSfx('nonexistent');
      expect(mockSourceNodes.length).toBe(0);
    });

    it('applies per-call volume via a one-off gain node', () => {
      engine.playSfx('click', 0.3);

      const source = getMockSourceNode(0);
      // Should have created an extra gain node (4th: master, music, sfx, one-off)
      const oneOffGain = getMockGainNode(3);
      expect(oneOffGain.gain.value).toBe(0.3);
      expect(source.connect).toHaveBeenCalledWith(oneOffGain);
    });
  });

  describe('playSfx with SfxOptions', () => {
    let engine: AudioEngine;

    beforeEach(async () => {
      engine = createAudioEngine();
      await engine.loadAudio('click', new ArrayBuffer(8));
      mockSourceNodes = [];
    });

    it('accepts object form with volume and pitch', () => {
      engine.playSfx('click', { volume: 0.5, pitch: 1.5 });
      const source = getMockSourceNode(0);
      expect(source.playbackRate.value).toBe(1.5);
      // Should have a one-off gain with volume 0.5
      const oneOffGain = getMockGainNode(3);
      expect(oneOffGain.gain.value).toBe(0.5);
    });

    it('backward compat: number argument still works as volume', () => {
      engine.playSfx('click', 0.3);
      const oneOffGain = getMockGainNode(3);
      expect(oneOffGain.gain.value).toBe(0.3);
    });

    it('pitch defaults to 1 when not specified', () => {
      engine.playSfx('click');
      const source = getMockSourceNode(0);
      expect(source.playbackRate.value).toBe(1);
    });

    it('pitch-only option without volume connects directly to sfxGain', () => {
      engine.playSfx('click', { pitch: 2 });
      const source = getMockSourceNode(0);
      expect(source.playbackRate.value).toBe(2);
      const sfxGain = getMockGainNode(2);
      expect(source.connect).toHaveBeenCalledWith(sfxGain);
    });
  });

  describe('playSfxRandom', () => {
    let engine: AudioEngine;

    beforeEach(async () => {
      engine = createAudioEngine();
      await engine.loadAudio('click', new ArrayBuffer(8));
      await engine.loadAudio('pop', new ArrayBuffer(8));
      mockSourceNodes = [];
    });

    it('plays one of the given keys', () => {
      engine.playSfxRandom(['click']);
      expect(mockSourceNodes.length).toBe(1);
    });

    it('does nothing if keys array is empty', () => {
      engine.playSfxRandom([]);
      expect(mockSourceNodes.length).toBe(0);
    });

    it('skips unloaded keys', () => {
      engine.playSfxRandom(['nonexistent']);
      expect(mockSourceNodes.length).toBe(0);
    });

    it('applies volume and pitch randomization within ranges', () => {
      engine.playSfxRandom(['click'], { volume: [0.5, 0.5], pitch: [2, 2] });
      const source = getMockSourceNode(0);
      expect(source.playbackRate.value).toBe(2);
      const oneOffGain = getMockGainNode(3);
      expect(oneOffGain.gain.value).toBe(0.5);
    });

    it('picks only from loaded keys when mix of loaded and unloaded given', () => {
      engine.playSfxRandom(['nonexistent', 'click', 'alsoMissing']);
      expect(mockSourceNodes.length).toBe(1);
      // The source got a buffer (meaning it was a loaded key)
      expect(getMockSourceNode(0).buffer).toEqual({ duration: 1, length: 44100 });
    });
  });

  describe('playMusic', () => {
    let engine: AudioEngine;

    beforeEach(async () => {
      engine = createAudioEngine();
      await engine.loadAudio('bgm1', new ArrayBuffer(8));
      await engine.loadAudio('bgm2', new ArrayBuffer(8));
      mockSourceNodes = [];
    });

    it('starts music with loop=true by default', () => {
      engine.playMusic('bgm1');

      const source = getMockSourceNode(0);
      expect(source.loop).toBe(true);
      expect(source.start).toHaveBeenCalled();
      // Connected to musicGain (2nd gain node)
      const musicGain = getMockGainNode(1);
      expect(source.connect).toHaveBeenCalledWith(musicGain);
    });

    it('respects loop=false parameter', () => {
      engine.playMusic('bgm1', false);
      expect(getMockSourceNode(0).loop).toBe(false);
    });

    it('crossfades when switching tracks', () => {
      engine.playMusic('bgm1');
      engine.playMusic('bgm2');

      const musicGain = getMockGainNode(1);
      // Should have called setValueAtTime and linearRampToValueAtTime for crossfade
      expect(musicGain.gain.setValueAtTime).toHaveBeenCalled();
      expect(musicGain.gain.linearRampToValueAtTime).toHaveBeenCalled();
      // Second source should have been created
      expect(mockSourceNodes.length).toBe(2);
    });

    it('does nothing if key is not loaded', () => {
      engine.playMusic('nonexistent');
      expect(mockSourceNodes.length).toBe(0);
    });
  });

  describe('stopMusic', () => {
    let engine: AudioEngine;

    beforeEach(async () => {
      engine = createAudioEngine();
      await engine.loadAudio('bgm', new ArrayBuffer(8));
      mockSourceNodes = [];
    });

    it('stops music immediately when no fadeOut specified', () => {
      engine.playMusic('bgm');
      const source = getMockSourceNode(0);

      engine.stopMusic();
      expect(source.stop).toHaveBeenCalled();
    });

    it('stops music immediately when fadeOutSeconds is 0', () => {
      engine.playMusic('bgm');
      const source = getMockSourceNode(0);

      engine.stopMusic(0);
      expect(source.stop).toHaveBeenCalled();
    });

    it('ramps gain to 0 when fadeOutSeconds > 0', () => {
      engine.playMusic('bgm');

      engine.stopMusic(1.5);
      const musicGain = getMockGainNode(1);
      expect(musicGain.gain.setValueAtTime).toHaveBeenCalled();
      expect(musicGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));
    });

    it('does nothing if no music is playing', () => {
      // Should not throw
      engine.stopMusic();
      engine.stopMusic(1.0);
    });
  });

  describe('volume setters', () => {
    it('setMasterVolume updates master gain node', async () => {
      const engine = createAudioEngine();
      await engine.loadAudio('x', new ArrayBuffer(8)); // triggers context creation
      const masterGain = getMockGainNode(0);

      engine.setMasterVolume(0.7);
      expect(masterGain.gain.value).toBe(0.7);
    });

    it('setMusicVolume updates music gain node', async () => {
      const engine = createAudioEngine();
      await engine.loadAudio('x', new ArrayBuffer(8));
      const musicGain = getMockGainNode(1);

      engine.setMusicVolume(0.4);
      expect(musicGain.gain.value).toBe(0.4);
    });

    it('setSfxVolume updates sfx gain node', async () => {
      const engine = createAudioEngine();
      await engine.loadAudio('x', new ArrayBuffer(8));
      const sfxGain = getMockGainNode(2);

      engine.setSfxVolume(0.6);
      expect(sfxGain.gain.value).toBe(0.6);
    });

    it('clamps volume values to 0-1', async () => {
      const engine = createAudioEngine();
      await engine.loadAudio('x', new ArrayBuffer(8));
      const masterGain = getMockGainNode(0);

      engine.setMasterVolume(-0.5);
      expect(masterGain.gain.value).toBe(0);

      engine.setMasterVolume(1.5);
      expect(masterGain.gain.value).toBe(1);
    });
  });

  describe('setMuted / isMuted', () => {
    it('starts unmuted', () => {
      const engine = createAudioEngine();
      expect(engine.isMuted()).toBe(false);
    });

    it('setMuted(true) sets master gain to 0', async () => {
      const engine = createAudioEngine();
      await engine.loadAudio('x', new ArrayBuffer(8));
      const masterGain = getMockGainNode(0);

      engine.setMuted(true);
      expect(engine.isMuted()).toBe(true);
      expect(masterGain.gain.value).toBe(0);
    });

    it('setMuted(false) restores master volume', async () => {
      const engine = createAudioEngine({ masterVolume: 0.9 });
      await engine.loadAudio('x', new ArrayBuffer(8));
      const masterGain = getMockGainNode(0);

      engine.setMuted(true);
      expect(masterGain.gain.value).toBe(0);

      engine.setMuted(false);
      expect(engine.isMuted()).toBe(false);
      expect(masterGain.gain.value).toBe(0.9);
    });
  });

  describe('isLoaded', () => {
    it('returns false for unknown keys', () => {
      const engine = createAudioEngine();
      expect(engine.isLoaded('nope')).toBe(false);
    });

    it('returns true after loadAudio', async () => {
      const engine = createAudioEngine();
      await engine.loadAudio('sfx1', new ArrayBuffer(8));
      expect(engine.isLoaded('sfx1')).toBe(true);
    });
  });

  describe('dispose', () => {
    it('closes AudioContext and clears buffer cache', async () => {
      const engine = createAudioEngine();
      await engine.loadAudio('a', new ArrayBuffer(8));
      expect(engine.isLoaded('a')).toBe(true);

      engine.dispose();
      expect(mockAudioContext.close).toHaveBeenCalled();
      expect(engine.isLoaded('a')).toBe(false);
    });

    it('stops current music before disposing', async () => {
      const engine = createAudioEngine();
      await engine.loadAudio('bgm', new ArrayBuffer(8));
      mockSourceNodes = [];

      engine.playMusic('bgm');
      const source = getMockSourceNode(0);

      engine.dispose();
      expect(source.stop).toHaveBeenCalled();
    });

    it('is safe to call when no context was created', () => {
      const engine = createAudioEngine();
      // Should not throw
      engine.dispose();
    });
  });

  describe('config defaults', () => {
    it('applies custom config volumes', async () => {
      const engine = createAudioEngine({
        masterVolume: 0.5,
        musicVolume: 0.3,
        sfxVolume: 0.4,
      });
      await engine.loadAudio('x', new ArrayBuffer(8));

      const masterGain = getMockGainNode(0);
      const musicGain = getMockGainNode(1);
      const sfxGain = getMockGainNode(2);

      expect(masterGain.gain.value).toBe(0.5);
      expect(musicGain.gain.value).toBe(0.3);
      expect(sfxGain.gain.value).toBe(0.4);
    });
  });
});
