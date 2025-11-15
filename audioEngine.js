class AudioEngine {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.wavetables = [];
    this.semitoneOffset = 0;
    this.adsr = { attack: 0.03, decay: 0.1, sustain: 0.7, release: 0.2 };
    this.activeVoices = new Map();
  }

  ensureContext() {
    if (!this.context) {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.context.destination);
    }
  }

  setWavetables(tables) {
    this.wavetables = tables || [];
  }

  getPlayingSlices() {
    return new Set(this.activeVoices.keys());
  }

  setSemitoneOffset(offset) {
    this.semitoneOffset = offset;
  }

  setEnvelope(adsr) {
    this.adsr = { ...this.adsr, ...adsr };
  }

  triggerSlice(index, wavetable) {
    if (!wavetable || !wavetable.length) return;
    this.ensureContext();

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    gain.connect(this.masterGain);

    const periodic = this.createPeriodicWave(wavetable);
    oscillator.setPeriodicWave(periodic);

    const baseFreq = 220;
    const freq = baseFreq * Math.pow(2, this.semitoneOffset / 12);
    oscillator.frequency.value = freq * (1 + index * 0.02);

    const now = this.context.currentTime;
    const attackEnd = now + this.adsr.attack;
    const decayEnd = attackEnd + this.adsr.decay;

    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, attackEnd);
    gain.gain.linearRampToValueAtTime(this.adsr.sustain, decayEnd);
    gain.gain.setTargetAtTime(0, decayEnd, this.adsr.release);

    oscillator.connect(gain);
    oscillator.start(now);
    oscillator.stop(decayEnd + this.adsr.release * 4);

    this.activeVoices.set(index, oscillator);
    oscillator.onended = () => {
      this.activeVoices.delete(index);
    };
  }

  createPeriodicWave(wavetable) {
    const fftSize = wavetable.length;
    const real = new Float32Array(fftSize);
    const imag = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      const value = wavetable[i];
      real[i] = value;
      imag[i] = 0;
    }
    return this.context.createPeriodicWave(real, imag, { disableNormalization: false });
  }
}
