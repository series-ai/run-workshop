/**
 * @file audio.ts
 * High-fidelity tactical Web Audio synthesizer for punchy gunshots, shotgun blasts,
 * chamber cycles, shell drops, tactical slides, melee kicks, and atmospheric cues
 * without external audio files.
 */

class SoundSystem {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Meaty, punchy 5.56 tactical rifle shot:
   * 1. Supersonic bullet crack transient (sharp highpass filtered noise burst)
   * 2. Concussive gunpowder punch (185Hz -> 45Hz sub-bass thump)
   * 3. Mechanical bolt chamber click
   * 4. Acoustic room reverberation decay
   */
  public playGunshot(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    // 1. Supersonic crack transient (0 - 15ms)
    const crackSize = Math.floor(ctx.sampleRate * 0.025);
    const crackBuf = ctx.createBuffer(1, crackSize, ctx.sampleRate);
    const crackData = crackBuf.getChannelData(0);
    for (let i = 0; i < crackSize; i++) {
      crackData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.004));
    }
    const crackNode = ctx.createBufferSource();
    crackNode.buffer = crackBuf;
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'highpass';
    crackFilter.frequency.setValueAtTime(3200, t);
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.85, t);
    crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    crackNode.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(ctx.destination);
    crackNode.start(t);

    // 2. Concussive gunpowder punch body (185Hz -> 42Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(185, t);
    subOsc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    subGain.gain.setValueAtTime(0.75, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(t);
    subOsc.stop(t + 0.16);

    // 3. Acoustic chamber reverberation tail (0 - 200ms)
    const tailSize = Math.floor(ctx.sampleRate * 0.22);
    const tailBuf = ctx.createBuffer(1, tailSize, ctx.sampleRate);
    const tailData = tailBuf.getChannelData(0);
    for (let i = 0; i < tailSize; i++) {
      tailData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.045));
    }
    const tailNode = ctx.createBufferSource();
    tailNode.buffer = tailBuf;
    const tailFilter = ctx.createBiquadFilter();
    tailFilter.type = 'lowpass';
    tailFilter.frequency.setValueAtTime(1800, t);
    tailFilter.frequency.exponentialRampToValueAtTime(250, t + 0.22);
    const tailGain = ctx.createGain();
    tailGain.gain.setValueAtTime(0.45, t);
    tailGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    tailNode.connect(tailFilter);
    tailFilter.connect(tailGain);
    tailGain.connect(ctx.destination);
    tailNode.start(t);
  }

  /**
   * Heavy Tarkov-style 12-gauge shotgun blast:
   * Concussive 35Hz sub-bass punch + dense buckshot explosion + pump-action mechanical cycle
   */
  public playShotgun(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    // 1. Heavy concussive sub-bass thump
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(160, t);
    subOsc.frequency.exponentialRampToValueAtTime(32, t + 0.32);
    subGain.gain.setValueAtTime(0.95, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(t);
    subOsc.stop(t + 0.32);

    // 2. High-energy multi-pellet buckshot noise explosion
    const bufSize = Math.floor(ctx.sampleRate * 0.28);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.055));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, t);
    filter.frequency.exponentialRampToValueAtTime(180, t + 0.28);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.85, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(t);

    // 3. Pump action mechanical rack (at t + 160ms)
    setTimeout(() => {
      const c = this.getContext();
      if (!c) return;
      const tPump = c.currentTime;
      const pOsc = c.createOscillator();
      const pGain = c.createGain();
      pOsc.type = 'triangle';
      pOsc.frequency.setValueAtTime(950, tPump);
      pOsc.frequency.exponentialRampToValueAtTime(350, tPump + 0.04);
      pGain.gain.setValueAtTime(0.25, tPump);
      pGain.gain.exponentialRampToValueAtTime(0.001, tPump + 0.05);
      pOsc.connect(pGain);
      pGain.connect(c.destination);
      pOsc.start(tPump);
      pOsc.stop(tPump + 0.05);
    }, 160);
  }

  /** Sharp metallic dry-fire click on empty chamber */
  public playEmptyClick(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.02);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.02);
  }

  /** Spent brass casing bouncing on concrete */
  public playShellDrop(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    [0, 0.06].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2800 - idx * 400, t + offset);
      osc.frequency.exponentialRampToValueAtTime(1400, t + offset + 0.035);
      gain.gain.setValueAtTime(0.12 - idx * 0.04, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.035);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + offset);
      osc.stop(t + offset + 0.035);
    });
  }

  /** Sharp visceral metallic hitmarker crunch */
  public playHitmarker(isCrit = false): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const freq = isCrit ? 2600 : 1950;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.05);
    gain.gain.setValueAtTime(isCrit ? 0.45 : 0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  /** Scav Radio Bark / Squawk Alert */
  public playScavBark(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(750, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(280, t + 0.18);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  /** Propital Medpen Injection (Air-hiss + needle click) */
  public playHealInject(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    // Needle snap
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(350, t + 0.04);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.04);

    // Pressurized antiseptic pneumatic hiss
    const bufSize = Math.floor(ctx.sampleRate * 0.18);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, t + 0.02);
    filter.Q.setValueAtTime(2.0, t + 0.02);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.3, t + 0.02);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(t + 0.02);
  }

  /**
   * Authentic 3-stage tactical weapon reload:
   * 1. Magazine release click (t=0)
   * 2. Fresh magazine rock & lock insertion (t=160ms)
   * 3. Bolt release snap (t=340ms)
   */
  public playReload(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    // Stage 1: Mag release latch
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(1600, t);
    osc1.frequency.exponentialRampToValueAtTime(450, t + 0.03);
    gain1.gain.setValueAtTime(0.3, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.03);

    // Stage 2: Mag rock and lock
    setTimeout(() => {
      const c = this.getContext();
      if (!c) return;
      const t2 = c.currentTime;
      const osc2 = c.createOscillator();
      const gain2 = c.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(800, t2);
      osc2.frequency.exponentialRampToValueAtTime(1200, t2 + 0.04);
      gain2.gain.setValueAtTime(0.4, t2);
      gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.05);
      osc2.connect(gain2);
      gain2.connect(c.destination);
      osc2.start(t2);
      osc2.stop(t2 + 0.05);
    }, 160);

    // Stage 3: Bolt carrier release
    setTimeout(() => {
      const c = this.getContext();
      if (!c) return;
      const t3 = c.currentTime;
      const osc3 = c.createOscillator();
      const gain3 = c.createGain();
      osc3.type = 'triangle';
      osc3.frequency.setValueAtTime(1900, t3);
      osc3.frequency.exponentialRampToValueAtTime(320, t3 + 0.06);
      gain3.gain.setValueAtTime(0.45, t3);
      gain3.gain.exponentialRampToValueAtTime(0.001, t3 + 0.07);
      osc3.connect(gain3);
      gain3.connect(c.destination);
      osc3.start(t3);
      osc3.stop(t3 + 0.07);
    }, 340);
  }

  public playHeartbeat(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(65, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.15);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  public playHitGrunt(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  public playSlide(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    const bufSize = Math.floor(ctx.sampleRate * 0.45);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.15));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.frequency.exponentialRampToValueAtTime(220, t + 0.45);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(t);
  }

  public playRoll(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(380, t + 0.18);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.4);
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  public playKick(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.22);
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  public playRadarPing(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(920, t);
    osc.frequency.setValueAtTime(1380, t + 0.07);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  public playExfilSiren(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.linearRampToValueAtTime(880, t + 0.4);
    osc.frequency.linearRampToValueAtTime(440, t + 0.8);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.8);
  }

  public playLootChime(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.06);
      gain.gain.setValueAtTime(0.15, t + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.3);
    });
  }

  public playClick(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.025);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.025);
  }

  public playKillConfirmed(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    // Sub bass thud
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(150, t);
    osc1.frequency.exponentialRampToValueAtTime(32, t + 0.3);
    gain1.gain.setValueAtTime(0.6, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.3);

    // High mechanical confirmation chirp
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1100, t + 0.04);
    osc2.frequency.setValueAtTime(2200, t + 0.1);
    gain2.gain.setValueAtTime(0.28, t + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t + 0.04);
    osc2.stop(t + 0.22);
  }

  public playArmorHit(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.exponentialRampToValueAtTime(350, t + 0.07);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  public playDeploy(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Heavy pneumatic airlock hiss
    const bufSize = Math.floor(ctx.sampleRate * 0.4);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.1));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.4);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(t);

    // Mechanical clamp
    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t + 0.1);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.35);
    oGain.gain.setValueAtTime(0.4, t + 0.1);
    oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(oGain);
    oGain.connect(ctx.destination);
    osc.start(t + 0.1);
    osc.stop(t + 0.35);
  }

  public playLevelUp(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    [440, 554.37, 659.25, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.08);
      gain.gain.setValueAtTime(0.25, t + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.4);
    });
  }

  /** Concussive F-1 Fragmentation Grenade Blast */
  public playExplosion(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    // 1. Heavy sub-bass ground shockwave (120Hz -> 25Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(120, t);
    subOsc.frequency.exponentialRampToValueAtTime(25, t + 0.65);
    subGain.gain.setValueAtTime(1.0, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(t);
    subOsc.stop(t + 0.65);

    // 2. High-energy explosive blast noise & shrapnel scatter
    const bufSize = Math.floor(ctx.sampleRate * 0.75);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.14));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4200, t);
    filter.frequency.exponentialRampToValueAtTime(90, t + 0.75);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(t);
  }

  /** Mechanical grenade spoon release / pin pull click */
  public playGrenadePin(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.05);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  /** Tactical weapon switch: sling rustle + heavy chamber bolt slap */
  public playWeaponSwitch(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    // 1. Tactical sling fabric rustle (bandpass filtered noise)
    const bufSize = Math.floor(ctx.sampleRate * 0.12);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(t);

    // 2. Heavy steel bolt chamber slap (metallic click at t + 40ms)
    const boltOsc = ctx.createOscillator();
    const boltGain = ctx.createGain();
    boltOsc.type = 'sine';
    boltOsc.frequency.setValueAtTime(880, t + 0.04);
    boltOsc.frequency.exponentialRampToValueAtTime(220, t + 0.11);
    boltGain.gain.setValueAtTime(0.4, t + 0.04);
    boltGain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    boltOsc.connect(boltGain);
    boltGain.connect(ctx.destination);
    boltOsc.start(t + 0.04);
    boltOsc.stop(t + 0.11);
  }
}

export const sound = new SoundSystem();
