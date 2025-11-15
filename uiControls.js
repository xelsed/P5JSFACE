class UIControls {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.sliceCount = 12;
    this.viewMode = 'mesh';
    this.pitchOffset = 0;
    this.adsr = { attack: 0.03, decay: 0.1, sustain: 0.7, release: 0.2 };

    this.captureStatusEl = document.getElementById('capture-status');
    this.meshStatusEl = document.getElementById('mesh-status');
    this.viewStatusEl = document.getElementById('view-status');
    this.sliceCountEl = document.getElementById('slice-count');
    this.aiButtonEl = document.getElementById('ai-process-btn');
    this.aiStatusEl = document.getElementById('ai-status');
    this.statusBarEl = document.getElementById('status-bar');
    this.pitchDisplayEl = document.getElementById('pitch-display');
    this.adsrEls = {
      attack: document.getElementById('adsr-attack'),
      decay: document.getElementById('adsr-decay'),
      sustain: document.getElementById('adsr-sustain'),
      release: document.getElementById('adsr-release')
    };
    this.smoothingSelect = document.getElementById('smoothing-method');
    this.promptEl = document.getElementById('ai-prompt');
    this.apiKeyEl = document.getElementById('openai-key');

    this.updatePitchDisplay();
    this.updateADSRElements();
    this.sliceCountEl.textContent = this.sliceCount;

    this.aiButtonEl.addEventListener('click', () => {
      if (this.isAIEnabled()) {
        this.callbacks.onRequestAI?.(this.promptEl.value, this.apiKeyEl.value);
      }
    });

    this.smoothingSelect.addEventListener('change', () => {
      this.updateAIAvailability();
    });
    this.apiKeyEl.addEventListener('input', () => {
      this.updateAIAvailability();
    });

    this.updateAIAvailability();
  }

  updateAIAvailability() {
    const enabled = this.isAIEnabled();
    this.aiButtonEl.disabled = !enabled;
    this.aiStatusEl.textContent = enabled ? 'AI ready' : 'AI smoothing idle.';
  }

  isAIEnabled() {
    return this.smoothingSelect.value === 'ai' && !!this.apiKeyEl.value;
  }

  handleKey(key, keyCode) {
    if (key === 'c' || key === 'C') {
      this.callbacks.onCapture?.();
    } else if (keyCode === 27) {
      this.callbacks.onUnfreeze?.();
    } else if (key === '[') {
      this.sliceCount = Math.max(3, this.sliceCount - 1);
      this.sliceCountEl.textContent = this.sliceCount;
      this.callbacks.onSliceChange?.(this.sliceCount);
    } else if (key === ']') {
      this.sliceCount = Math.min(48, this.sliceCount + 1);
      this.sliceCountEl.textContent = this.sliceCount;
      this.callbacks.onSliceChange?.(this.sliceCount);
    } else if (key === 'v' || key === 'V') {
      this.viewMode = this.viewMode === 'mesh' ? 'wavetable' : 'mesh';
      this.viewStatusEl.textContent = this.viewMode === 'mesh' ? 'Mesh View' : 'Wavetable View';
      this.callbacks.onToggleView?.(this.viewMode);
    } else if (key === '-' || key === '_') {
      this.pitchOffset -= 1;
      this.updatePitchDisplay();
      this.callbacks.onPitchChange?.(this.pitchOffset);
    } else if (key === '+' || key === '=') {
      this.pitchOffset += 1;
      this.updatePitchDisplay();
      this.callbacks.onPitchChange?.(this.pitchOffset);
    } else if (key.match(/^[1-9]$/) || key === '0') {
      if (keyIsDown(32)) {
        const index = key === '0' ? 9 : parseInt(key, 10) - 1;
        this.callbacks.onPlaySlice?.(index);
      }
    } else if (key === 'a' || key === 'A') {
      this.updateADSR('attack', key === 'A' ? 0.01 : -0.01);
    } else if (key === 'd' || key === 'D') {
      this.updateADSR('decay', key === 'D' ? 0.02 : -0.02);
    } else if (key === 's' || key === 'S') {
      this.updateADSR('sustain', key === 'S' ? 0.05 : -0.05);
    } else if (key === 'r' || key === 'R') {
      this.updateADSR('release', key === 'R' ? 0.02 : -0.02);
    }
  }

  updateADSR(property, delta) {
    const minMax = {
      attack: [0.005, 0.5],
      decay: [0.02, 1.5],
      sustain: [0.05, 1],
      release: [0.02, 2.5]
    };
    const value = this.adsr[property] + delta;
    const [min, max] = minMax[property];
    this.adsr[property] = constrain(value, min, max);
    this.updateADSRElements();
    this.callbacks.onADSRChange?.(this.adsr);
  }

  updatePitchDisplay() {
    this.pitchDisplayEl.textContent = `${this.pitchOffset} st`; // simple text
  }

  updateADSRElements() {
    this.adsrEls.attack.textContent = `${(this.adsr.attack * 1000).toFixed(0)} ms`;
    this.adsrEls.decay.textContent = `${(this.adsr.decay * 1000).toFixed(0)} ms`;
    this.adsrEls.sustain.textContent = this.adsr.sustain.toFixed(2);
    this.adsrEls.release.textContent = `${(this.adsr.release * 1000).toFixed(0)} ms`;
  }

  setStatus(message) {
    this.statusBarEl.textContent = message;
  }

  setCaptureState(state) {
    this.captureStatusEl.textContent = state;
    this.meshStatusEl.textContent = state === 'CAPTURED' ? 'Frozen mesh' : 'Live mesh';
  }

  setSliceInfo(count, slices = []) {
    this.sliceCountEl.textContent = count;
    const collisionList = document.getElementById('collision-list');
    if (collisionList) {
      collisionList.innerHTML = slices
        .map((slice, idx) => `<div><span>Slice ${idx + 1}</span><span>${slice.length} pts</span></div>`)
        .join('');
    }
  }

  getSliceCount() {
    return this.sliceCount;
  }

  setAIStatus(text) {
    this.aiStatusEl.textContent = text;
  }

  renderOverlays() {}
}
