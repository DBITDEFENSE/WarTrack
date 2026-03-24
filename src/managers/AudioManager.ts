/**
 * Procedural audio using Web Audio API.
 * No external sound files needed — all synthesized.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled: boolean = true;
  private initialized: boolean = false;

  init(): void {
    if (this.initialized) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch {
      this.enabled = false;
    }
  }

  private ensureContext(): void {
    if (!this.initialized) this.init();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  private noise(duration: number, volume: number, filterFreq: number): void {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * volume;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    source.connect(filter).connect(gain).connect(this.masterGain);
    source.start();
  }

  private tone(freq: number, duration: number, volume: number, type: OscillatorType = 'square'): void {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain).connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playAutocannon(): void {
    this.ensureContext();
    this.noise(0.05, 0.15, 3000);
    this.tone(200, 0.03, 0.08, 'square');
  }

  playRocket(): void {
    this.ensureContext();
    this.noise(0.3, 0.3, 1500);
    this.tone(150, 0.15, 0.12, 'sawtooth');
    // Whoosh
    if (this.ctx && this.masterGain) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.3);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.08, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
      osc.connect(g).connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
    }
  }

  playExplosionSmall(): void {
    this.ensureContext();
    this.noise(0.2, 0.25, 800);
    this.tone(80, 0.15, 0.1, 'sine');
  }

  playExplosionLarge(): void {
    this.ensureContext();
    this.noise(0.5, 0.4, 600);
    this.tone(50, 0.3, 0.15, 'sine');
    this.tone(35, 0.4, 0.1, 'sine');
  }

  playFlare(): void {
    this.ensureContext();
    this.tone(1200, 0.1, 0.1, 'sine');
    this.tone(1800, 0.15, 0.08, 'sine');
    this.noise(0.2, 0.1, 5000);
  }

  playHit(): void {
    this.ensureContext();
    this.tone(300, 0.05, 0.12, 'square');
    this.noise(0.04, 0.1, 2000);
  }

  playShipHit(): void {
    this.ensureContext();
    this.tone(100, 0.1, 0.15, 'sine');
    this.noise(0.15, 0.2, 500);
  }

  playApacheHit(): void {
    this.ensureContext();
    this.tone(180, 0.08, 0.2, 'square');
    this.noise(0.08, 0.15, 1200);
  }

  playMineBeep(): void {
    this.ensureContext();
    this.tone(800, 0.08, 0.06, 'sine');
  }

  playAlert(): void {
    this.ensureContext();
    this.tone(600, 0.15, 0.1, 'square');
    setTimeout(() => this.tone(600, 0.15, 0.1, 'square'), 200);
  }

  playMissionComplete(): void {
    this.ensureContext();
    const delays = [0, 150, 300, 450];
    const freqs = [523, 659, 784, 1047]; // C5 E5 G5 C6
    delays.forEach((d, i) => {
      setTimeout(() => this.tone(freqs[i], 0.3, 0.12, 'sine'), d);
    });
  }

  playMissionFailed(): void {
    this.ensureContext();
    this.tone(300, 0.4, 0.1, 'sine');
    setTimeout(() => this.tone(200, 0.5, 0.1, 'sine'), 300);
  }

  playEnemyShoot(): void {
    this.ensureContext();
    this.noise(0.04, 0.08, 2500);
  }

  playCIWS(): void {
    this.ensureContext();
    // Rapid buzzing fire
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this.noise(0.02, 0.06, 4000), i * 30);
    }
  }

  playWaveWarning(): void {
    this.ensureContext();
    this.tone(440, 0.2, 0.08, 'square');
    setTimeout(() => this.tone(550, 0.2, 0.08, 'square'), 250);
  }

  playBossWarning(): void {
    this.ensureContext();
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.tone(200, 0.3, 0.12, 'sawtooth');
        this.tone(100, 0.3, 0.1, 'sine');
      }, i * 400);
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  setVolume(v: number): void {
    if (this.masterGain) this.masterGain.gain.value = v;
  }
}

// Singleton
export const audio = new AudioManager();
