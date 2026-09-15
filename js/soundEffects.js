/**
 * MP2000 Pallet Verifier - Procedural Industrial Web Audio Synthesizer
 * 100% offline, zero external audio files, pure Web Audio API.
 */

window.SoundEngine = class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.motorOsc = null;
    this.motorGain = null;
    this.liftNoiseNode = null;
    this.liftGain = null;

    // Auto-init on first user gesture
    const unlockAudio = () => {
      this.init();
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.setupMotorSynth();
      }
    } catch (e) {
      console.warn('Web Audio not supported:', e);
    }
  }

  setupMotorSynth() {
    if (!this.ctx) return;

    // Continuous electric motor hum
    this.motorOsc = this.ctx.createOscillator();
    this.motorOsc.type = 'sawtooth';
    this.motorOsc.frequency.setValueAtTime(65, this.ctx.currentTime);

    // Low-pass filter to give smooth electric vehicle hum
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180, this.ctx.currentTime);

    this.motorGain = this.ctx.createGain();
    this.motorGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.motorOsc.connect(filter);
    filter.connect(this.motorGain);
    this.motorGain.connect(this.ctx.destination);

    this.motorOsc.start();
  }

  setMotorSpeed(normalizedSpeed) {
    if (!this.ctx || this.isMuted || !this.motorGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    if (normalizedSpeed > 0.05) {
      const freq = 65 + normalizedSpeed * 55;
      this.motorOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.08);
      this.motorGain.gain.setTargetAtTime(0.04, this.ctx.currentTime, 0.05);
    } else {
      this.motorGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
  }

  stopMotor() {
    if (this.motorGain && this.ctx) {
      this.motorGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  playHydraulicLift() {
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // Synthesize pneumatic/hydraulic hiss using filtered noise
    const bufferSize = this.ctx.sampleRate * 0.8;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, this.ctx.currentTime);
    filter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
  }

  playSuccessChime() {
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 arpeggio
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);

      gain.gain.setValueAtTime(0, t + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.08, t + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 0.45);
    });
  }

  playCollisionAlarm() {
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const t = this.ctx.currentTime;

    // 1. Heavy bass thud
    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(140, t);
    thud.frequency.exponentialRampToValueAtTime(30, t + 0.2);

    thudGain.gain.setValueAtTime(0.2, t);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    thud.connect(thudGain);
    thudGain.connect(this.ctx.destination);
    thud.start(t);
    thud.stop(t + 0.26);

    // 2. High warning alert beep
    const beep = this.ctx.createOscillator();
    const beepGain = this.ctx.createGain();
    beep.type = 'square';
    beep.frequency.setValueAtTime(880, t + 0.05);

    beepGain.gain.setValueAtTime(0.08, t + 0.05);
    beepGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    beep.connect(beepGain);
    beepGain.connect(this.ctx.destination);
    beep.start(t + 0.05);
    beep.stop(t + 0.32);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopMotor();
    }
    return this.isMuted;
  }
};
