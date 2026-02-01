
class NeuralAcousticEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled: boolean = true;

  private init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.15; // Keep it subtle and ambient
    this.masterGain.connect(this.ctx.destination);
  }

  private playTone(freq: number, type: OscillatorType, duration: number, volume: number = 1) {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playTick() {
    this.playTone(800, 'sine', 0.05, 0.2);
  }

  playDataCrunch() {
    this.init();
    if (!this.ctx) return;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.playTone(1200 + Math.random() * 400, 'square', 0.03, 0.1);
      }, i * 80);
    }
  }

  playSuccess() {
    this.playTone(440, 'sine', 0.5, 0.5);
    setTimeout(() => this.playTone(880, 'sine', 0.6, 0.3), 100);
  }

  playError() {
    this.playTone(150, 'sawtooth', 0.3, 0.4);
    setTimeout(() => this.playTone(120, 'sawtooth', 0.4, 0.4), 150);
  }

  playGlitch() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 10; i++) {
      this.playTone(50 + Math.random() * 1000, 'sawtooth', 0.02, 0.1);
    }
  }

  playUplink() {
    this.playTone(200, 'sine', 1.0, 0.3);
    setTimeout(() => this.playTone(400, 'sine', 0.8, 0.2), 200);
    setTimeout(() => this.playTone(880, 'sine', 0.6, 0.1), 400);
  }

  playScan() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 2);
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.5);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 2);
  }
}

export const acousticEngine = new NeuralAcousticEngine();
