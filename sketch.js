// ============================================================================
// FACE-TO-WAVETABLE 3D SYNTHESIZER
// ============================================================================
// Architecture:
//   1. Facemesh tracking (ml5.js) → stabilized 3D point cloud
//   2. Capture (C key) → freeze mesh geometry
//   3. Horizontal slicing → Y-bands across face (mouth-aligned)
//   4. Collision detection → report multi-valued Z at same X
//   5. Wavetable generation → X or Y time-axis, Z → amplitude
//   6. Web Audio playback → per-slice oscillators with ADSR
//   7. 3D visualization → mesh view + wavetable view
// ============================================================================

// --- Utility Functions ---
function findMinMax(points, accessor) {
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    const val = accessor(p);
    if (val < min) min = val;
    if (val > max) max = val;
  }
  return { min, max };
}

// --- Global state ---
let video;
let facemeshModel;
let predictions = [];

let stabilizedLivePoints = [];
let frozenMesh = null;

let sliceCount = 12;
let rawSlices = [];
let sliceCollisionCounts = [];
let totalCollisions = 0;
let sliceBoundsY = { min: 0, max: 0 };
let mouthSliceIndex = null;

const WAVETABLE_SIZE = 512;
let wavetables = [];
let timeAxisMode = "x"; // "x" = left→right, "y" = top→bottom
let audioCtx = null;
let masterGain = null;
let semitoneOffset = 0;
let baseFrequency = 220; // A3
let adsr = { attack: 0.02, decay: 0.12, sustain: 0.7, release: 0.2 };
let playingSlices = new Set();

let viewMode = "mesh"; // "mesh" | "wavetable" (wavetable view to be added)

// UI elements
let elCaptureStatus, elMeshStatus, elViewStatus;
let elSliceCount, elCollisionTotal, elCollisionList;
let elStatusBar;
let elSmoothingMethod, elOpenAIKey, elAIPrompt, elAIButton, elAIStatus;
let elPitchDisplay, elADSRAtk, elADSRDec, elADSRSus, elADSRRel;

function setup() {
  const container = document.getElementById("canvas-container");
  const w = container.clientWidth || window.innerWidth - 320;
  const h = container.clientHeight || window.innerHeight;

  const cnv = createCanvas(w, h, WEBGL);
  cnv.parent("canvas-container");

  pixelDensity(1);

  initUIRefs();
  initAIPromptDefault();

  initVideoAndFacemesh();
}

function windowResized() {
  const container = document.getElementById("canvas-container");
  const w = container.clientWidth || window.innerWidth - 320;
  const h = container.clientHeight || window.innerHeight;
  resizeCanvas(w, h);
}

function initUIRefs() {
  elCaptureStatus = document.getElementById("capture-status");
  elMeshStatus = document.getElementById("mesh-status");
  elViewStatus = document.getElementById("view-status");

  elSliceCount = document.getElementById("slice-count");
  elCollisionTotal = document.getElementById("collision-total");
  elCollisionList = document.getElementById("collision-list");

  elStatusBar = document.getElementById("status-bar");

  elSmoothingMethod = document.getElementById("smoothing-method");
  elOpenAIKey = document.getElementById("openai-key");
  elAIPrompt = document.getElementById("ai-prompt");
  elAIButton = document.getElementById("ai-process-btn");
  elAIStatus = document.getElementById("ai-status");

  elPitchDisplay = document.getElementById("pitch-display");
  elADSRAtk = document.getElementById("adsr-attack");
  elADSRDec = document.getElementById("adsr-decay");
  elADSRSus = document.getElementById("adsr-sustain");
  elADSRRel = document.getElementById("adsr-release");

  elSliceCount.textContent = String(sliceCount);
  updatePitchUI();
  updateADSRUI();
}

function initAIPromptDefault() {
  const defaultPrompt = [
    "Analyze this facial contour slice data representing X positions and Z depths from a 3D face scan.",
    "Smooth and interpolate it into a musically useful wavetable waveform while preserving the general",
    "contour shape. Return the data as an array of amplitude values normalized between -1 and +1.",
    "Input data: [provide X,Z pairs here]"
  ].join(" ");
  elAIPrompt.value = defaultPrompt;
}

function initVideoAndFacemesh() {
  elStatusBar.textContent = "Requesting webcam...";

  video = createCapture(VIDEO, () => {
    elStatusBar.textContent = "Webcam ready. Loading facemesh...";
  });
  
  // Check if video loaded successfully after a short delay
  setTimeout(() => {
    if (!video || !video.elt || !video.elt.srcObject) {
      console.error("Webcam access denied or failed");
      elStatusBar.textContent = "⚠️ Webcam access denied. Please grant camera permission.";
      elCaptureStatus.textContent = "No camera";
    }
  }, 2000);
  
  video.size(320, 240);
  video.hide();

  facemeshModel = ml5.facemesh(video, () => {
    elCaptureStatus.textContent = "Live tracking";
    elMeshStatus.textContent = "0 faces";
    elStatusBar.textContent = "Facemesh model loaded. Look at the camera and press C to capture.";
  }, (err) => {
    // Error callback for model loading failure
    console.error("Facemesh model error:", err);
    elStatusBar.textContent = "⚠️ Failed to load facemesh model. Check your internet connection.";
    elCaptureStatus.textContent = "Model error";
  });

  facemeshModel.on("predict", (results) => {
    predictions = results || [];
    elMeshStatus.textContent = predictions.length > 0 ? "1 face" : "0 faces";
    if (predictions.length > 0) {
      const pts = extractPointsFromPrediction(predictions[0]);
      stabilizedLivePoints = stabilizePoints(pts);
    }
  });
}

function extractPointsFromPrediction(pred) {
  const raw = pred.scaledMesh || [];
  const points = [];
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i];
    points.push({ x: p[0], y: p[1], z: p[2] });
  }
  return points;
}

// Stabilize the 3D point cloud: center, scale, and roughly align eyes horizontally.
function stabilizePoints(points) {
  if (!points || points.length === 0) return [];

  let cx = 0, cy = 0, cz = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
    cz += p.z;
  }
  cx /= points.length;
  cy /= points.length;
  cz /= points.length;

  let xmin = Infinity, xmax = -Infinity;
  let ymin = Infinity, ymax = -Infinity;
  for (const p of points) {
    const x = p.x - cx;
    const y = p.y - cy;
    if (x < xmin) xmin = x;
    if (x > xmax) xmax = x;
    if (y < ymin) ymin = y;
    if (y > ymax) ymax = y;
  }
  const width = xmax - xmin || 1;
  const height = ymax - ymin || 1;
  const scale = 2.0 / Math.max(width, height); // fit roughly into [-1,1]

  // Estimate head roll using approximate eye landmarks (MediaPipe indices).
  const leftEyeIndex = 33;
  const rightEyeIndex = 263;
  let angle = 0;
  if (points[leftEyeIndex] && points[rightEyeIndex]) {
    const lx = (points[leftEyeIndex].x - cx) * scale;
    const ly = (points[leftEyeIndex].y - cy) * scale;
    const rx = (points[rightEyeIndex].x - cx) * scale;
    const ry = (points[rightEyeIndex].y - cy) * scale;
    angle = Math.atan2(ry - ly, rx - lx);
  }

  const ca = Math.cos(-angle);
  const sa = Math.sin(-angle);

  const out = [];
  for (const p of points) {
    let x = (p.x - cx) * scale;
    let y = (p.y - cy) * scale;
    const z = (p.z - cz) * scale;

    const rx = x * ca - y * sa;
    const ry = x * sa + y * ca;

    out.push({ x: rx, y: ry, z });
  }

  return out;
}

function draw() {
  background(5, 6, 10);
  orbitControl();

  // Soft light
  directionalLight(255, 255, 255, 0.4, -0.7, -1);
  ambientLight(40);

  push();
  // Uniform scale; tie to video width so mesh and video are similar physical size
  const baseScale = video && video.width ? video.width * 0.5 : 200;
  scale(baseScale, baseScale, baseScale);

  if (viewMode === "mesh") {
    renderMeshView();
  } else {
    renderWavetableView();
  }

  pop();

  // Draw small video preview in top-left corner as a 2D overlay
  if (video && video.loadedmetadata) {
    push();
    resetMatrix();
    translate(-width / 2 + 90, -height / 2 + 70, 0);
    noStroke();
    texture(video);
    plane(video.width, video.height);
    pop();
  }
}

function renderMeshView() {
  // Live tracking as ghosted background (only show if NOT frozen)
  if (!frozenMesh && stabilizedLivePoints && stabilizedLivePoints.length > 0) {
    stroke(255, 240, 0, 220);
    strokeWeight(0.012);
    noFill();
    beginShape(POINTS);
    for (const p of stabilizedLivePoints) {
      vertex(p.x, p.y, p.z * 0.7);
    }
    endShape();
  }

  // Frozen mesh
  if (frozenMesh && frozenMesh.length > 0) {
    stroke(255, 255, 255);
    strokeWeight(0.015);
    noFill();
    beginShape(POINTS);
    for (const p of frozenMesh) {
      vertex(p.x, p.y, p.z * 0.7);
    }
    endShape();

    drawSliceLines();
  }
}

function drawSliceLines() {
  if (!frozenMesh || rawSlices.length === 0) return;

  const minY = sliceBoundsY.min;
  const maxY = sliceBoundsY.max;
  if (minY === maxY) return;

  const h = maxY - minY;
  for (let i = 0; i < sliceCount; i++) {
    const y = minY + h * (i + 0.5) / sliceCount;
    const collisions = sliceCollisionCounts[i] || 0;
    const hasCollision = collisions > 0;

    let col;
    let weight = 0.004;
    if (mouthSliceIndex !== null && i === mouthSliceIndex) {
      // Highlight the mouth-aligned slice
      col = [80, 180, 255];
      weight = 0.007;
    } else {
      col = hasCollision ? [255, 80, 80] : [80, 255, 140];
    }
    stroke(col[0], col[1], col[2]);
    strokeWeight(weight);

    const extent = 1.1; // extend across face
    line(-extent, y, 0, extent, y, 0);
  }
}

function renderWavetableView() {
  if (!wavetables || wavetables.length === 0) return;

  const sliceSpacing = 0.18;
  const ampScale = 0.4;

  for (let i = 0; i < wavetables.length; i++) {
    const wav = wavetables[i];
    if (!wav) continue;

    const y = (i - (wavetables.length - 1) / 2) * sliceSpacing;
    const isPlaying = playingSlices.has(i);
    const isMouthSlice = mouthSliceIndex !== null && i === mouthSliceIndex;

    let col;
    let weight;
    if (isPlaying) {
      col = [120, 255, 180]; // Bright green for playing
      weight = 0.012;
    } else if (isMouthSlice) {
      col = [80, 180, 255]; // Blue for mouth-aligned slice
      weight = 0.009;
    } else {
      col = [180, 200, 255]; // Default light blue
      weight = 0.006;
    }
    
    stroke(col[0], col[1], col[2]);
    strokeWeight(weight);
    noFill();

    beginShape();
    for (let j = 0; j < wav.length; j++) {
      const t = j / (wav.length - 1);
      const x = (t - 0.5) * 1.6;
      const z = wav[j] * ampScale;
      vertex(x, y, z);
    }
    endShape();
  }
}

// Slice frozenMesh horizontally and compute per-slice collision counts.
function recomputeSlices() {
  rawSlices = [];
  sliceCollisionCounts = [];
  totalCollisions = 0;

  if (!frozenMesh || frozenMesh.length === 0) {
    updateCollisionUI();
    return;
  }

  let minY = Infinity, maxY = -Infinity;
  for (const p of frozenMesh) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  if (!isFinite(minY) || !isFinite(maxY) || minY === maxY) {
    updateCollisionUI();
    return;
  }

  const h = maxY - minY;
  const sliceH = h / sliceCount;

  let sliceMinY = minY;
  const upperLipIndex = 13;
  const lowerLipIndex = 14;
  mouthSliceIndex = null;
  if (frozenMesh.length > Math.max(upperLipIndex, lowerLipIndex) && 
      frozenMesh[upperLipIndex] && frozenMesh[lowerLipIndex]) {
    const mouthY = (frozenMesh[upperLipIndex].y + frozenMesh[lowerLipIndex].y) * 0.5;
    const anchorIndex = Math.floor(sliceCount / 2);
    sliceMinY = mouthY - sliceH * (anchorIndex + 0.5);
    mouthSliceIndex = anchorIndex;
  }

  sliceBoundsY.min = sliceMinY;
  sliceBoundsY.max = sliceMinY + h;

  for (let i = 0; i < sliceCount; i++) {
    rawSlices[i] = [];
  }

  for (const p of frozenMesh) {
    const idx = Math.max(0, Math.min(sliceCount - 1, Math.floor((p.y - sliceMinY) / sliceH)));
    rawSlices[idx].push({ x: p.x, y: p.y, z: p.z });
  }

  for (let i = 0; i < sliceCount; i++) {
    const pts = rawSlices[i];
    sliceCollisionCounts[i] = estimateCollisionsForSlice(pts);
    totalCollisions += sliceCollisionCounts[i];
  }

  generateWavetables();
  updateCollisionUI();
}

// Collision heuristic: count how many X buckets contain multiple Z depths.
function estimateCollisionsForSlice(points) {
  if (!points || points.length === 0) return 0;

  let minX = Infinity, maxX = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
  }
  if (minX === maxX) return 0;

  const bins = 64;
  const width = maxX - minX;
  const binSize = width / bins;

  const buckets = new Map();
  for (const p of points) {
    const idx = Math.max(0, Math.min(bins - 1, Math.floor((p.x - minX) / binSize)));
    const key = idx;
    if (!buckets.has(key)) {
      buckets.set(key, [p.z]);
    } else {
      buckets.get(key).push(p.z);
    }
  }

  let collisions = 0;
  const eps = 1e-3;
  for (const [, zs] of buckets.entries()) {
    if (zs.length < 2) continue;
    zs.sort((a, b) => a - b);
    let distinct = 1;
    for (let i = 1; i < zs.length; i++) {
      if (Math.abs(zs[i] - zs[i - 1]) > eps) distinct++;
    }
    if (distinct > 1) collisions++;
  }

  return collisions;
}

function generateWavetables() {
  wavetables = [];
  if (!rawSlices || rawSlices.length === 0) return;

  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < rawSlices.length; i++) {
    const pts = rawSlices[i];
    if (!pts) continue;
    for (const p of pts) {
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
  }

  if (!isFinite(minZ) || !isFinite(maxZ) || minZ === maxZ) {
    return;
  }

  for (let i = 0; i < rawSlices.length; i++) {
    wavetables[i] = generateWavetableForSlice(rawSlices[i] || [], minZ, maxZ);
  }
}

function generateWavetableForSlice(points, minZ, maxZ) {
  const out = new Float32Array(WAVETABLE_SIZE);
  if (!points || points.length === 0) {
    return out;
  }

  const axisVals = [];
  const amps = [];
  const midZ = (minZ + maxZ) * 0.5;
  const rangeZ = (maxZ - minZ) * 0.5 || 1;

  for (const p of points) {
    const axis = timeAxisMode === "y" ? p.y : p.x;
    axisVals.push(axis);
    const normAmp = (p.z - midZ) / rangeZ;
    const clamped = Math.max(-1, Math.min(1, normAmp));
    amps.push(clamped);
  }

  let minAxis = Infinity;
  let maxAxis = -Infinity;
  for (const v of axisVals) {
    if (v < minAxis) minAxis = v;
    if (v > maxAxis) maxAxis = v;
  }

  if (minAxis === maxAxis) {
    const a = amps.length > 0 ? amps[0] : 0;
    for (let i = 0; i < WAVETABLE_SIZE; i++) out[i] = a;
    return out;
  }

  const idxs = axisVals.map((_, i) => i);
  idxs.sort((a, b) => axisVals[a] - axisVals[b]);
  const sortedAxis = idxs.map((i) => axisVals[i]);
  const sortedAmp = idxs.map((i) => amps[i]);

  let j = 0;
  for (let i = 0; i < WAVETABLE_SIZE; i++) {
    const t = i / (WAVETABLE_SIZE - 1);
    const target = minAxis + t * (maxAxis - minAxis);

    while (j < sortedAxis.length - 2 && sortedAxis[j + 1] < target) {
      j++;
    }

    const a0 = sortedAxis[j];
    const a1 = sortedAxis[Math.min(j + 1, sortedAxis.length - 1)];
    const v0 = sortedAmp[j];
    const v1 = sortedAmp[Math.min(j + 1, sortedAmp.length - 1)];
    const denom = a1 - a0;
    const u = denom === 0 ? 0 : (target - a0) / denom;
    out[i] = v0 + (v1 - v0) * u;
  }

  return out;
}

function updateCollisionUI() {
  elSliceCount.textContent = String(sliceCount);
  elCollisionTotal.textContent = String(totalCollisions);

  elCollisionList.innerHTML = "";
  for (let i = 0; i < sliceCount; i++) {
    const c = sliceCollisionCounts[i] || 0;
    const row = document.createElement("div");
    row.textContent = `Slice ${i + 1}`;
    const span = document.createElement("span");
    span.textContent = c;
    span.style.color = c > 0 ? "#ff7070" : "#7fffd4";
    row.appendChild(span);
    elCollisionList.appendChild(row);
  }
}

function updatePitchUI() {
  if (!elPitchDisplay) return;
  const freq = baseFrequency * Math.pow(2, semitoneOffset / 12);
  elPitchDisplay.textContent = freq.toFixed(1) + " Hz";
}

function updateADSRUI() {
  if (!elADSRAtk) return;
  elADSRAtk.textContent = Math.round(adsr.attack * 1000) + " ms";
  elADSRDec.textContent = Math.round(adsr.decay * 1000) + " ms";
  elADSRSus.textContent = adsr.sustain.toFixed(2);
  elADSRRel.textContent = Math.round(adsr.release * 1000) + " ms";
}

function initAudioIfNeeded() {
  if (audioCtx) return;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) {
    if (elStatusBar) elStatusBar.textContent = "Web Audio API not supported.";
    return;
  }
  audioCtx = new Ctor();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.4;
  masterGain.connect(audioCtx.destination);
}

function playSlice(index) {
  if (!wavetables || !wavetables[index]) return;
  initAudioIfNeeded();
  if (!audioCtx || !masterGain) return;

  const wav = wavetables[index];
  const buffer = audioCtx.createBuffer(1, wav.length, audioCtx.sampleRate);
  buffer.copyToChannel(wav, 0);

  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;

  const g = audioCtx.createGain();
  g.gain.value = 0;
  src.connect(g);
  g.connect(masterGain);

  const now = audioCtx.currentTime;
  const freq = baseFrequency * Math.pow(2, semitoneOffset / 12);
  src.playbackRate.value = freq / baseFrequency;

  const attack = adsr.attack;
  const decay = adsr.decay;
  const sustain = adsr.sustain;
  const release = adsr.release;
  const sustainTime = 0.2;
  const t0 = now;
  const tA = t0 + attack;
  const tD = tA + decay;
  const tS = tD + sustainTime;
  const tR = tS + release;

  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(1, tA);
  g.gain.linearRampToValueAtTime(sustain, tD);
  g.gain.setValueAtTime(sustain, tS);
  g.gain.linearRampToValueAtTime(0, tR);

  src.start(t0);
  src.stop(tR);

  playingSlices.add(index);
  setTimeout(() => {
    playingSlices.delete(index);
  }, (tR - t0) * 1000);
}

function changeSemitone(delta) {
  semitoneOffset += delta;
  updatePitchUI();
}

function changeADSR(part, delta) {
  if (part === "attack" || part === "decay" || part === "release") {
    adsr[part] = Math.max(0, adsr[part] + delta);
  } else if (part === "sustain") {
    adsr.sustain = Math.min(1, Math.max(0, adsr.sustain + delta));
  }
  updateADSRUI();
}

function keyPressed() {
  if (key === "c" || key === "C") {
    if (stabilizedLivePoints && stabilizedLivePoints.length > 0) {
      frozenMesh = stabilizedLivePoints.map((p) => ({ x: p.x, y: p.y, z: p.z }));
      elCaptureStatus.textContent = "Frozen";
      elStatusBar.textContent = "Frozen mesh captured. Press R to reset, [ ] to adjust slices";
      recomputeSlices();
    }
  } else if (key === "Escape") {
    // Reset/unfreeze - go back to live tracking
    frozenMesh = null;
    rawSlices = [];
    wavetables = [];
    sliceCollisionCounts = [];
    totalCollisions = 0;
    mouthSliceIndex = null;
    elCaptureStatus.textContent = "Live tracking";
    elStatusBar.textContent = "Mesh unfrozen. Press C to capture again.";
    updateCollisionUI();
  } else if (key === "[") {
    sliceCount = Math.max(2, sliceCount - 1);
    if (frozenMesh) recomputeSlices();
  } else if (key === "]") {
    sliceCount = Math.min(64, sliceCount + 1);
    if (frozenMesh) recomputeSlices();
  } else if (key === "v" || key === "V") {
    viewMode = viewMode === "mesh" ? "wavetable" : "mesh";
    elViewStatus.textContent = viewMode === "mesh" ? "Facemesh" : "Wavetable";
  } else if (key === "x" || key === "X") {
    timeAxisMode = "x";
    generateWavetables();
    if (elStatusBar) elStatusBar.textContent = "Time axis: X (left → right)";
  } else if (key === "y" || key === "Y") {
    timeAxisMode = "y";
    generateWavetables();
    if (elStatusBar) elStatusBar.textContent = "Time axis: Y (top → bottom)";
  } else if (keyCode >= 49 && keyCode <= 57 && keyIsDown(32)) {
    // Space + 1..9
    const idx = keyCode - 49;
    if (idx < wavetables.length) playSlice(idx);
  } else if (key === "0" && keyIsDown(32)) {
    // Space + 0 → 10th slice
    if (wavetables.length > 9) playSlice(9);
  } else if (key === "-" || key === "_") {
    changeSemitone(-1);
  } else if (key === "+" || key === "=") {
    changeSemitone(1);
  } else if (key === "a") {
    changeADSR("attack", -0.01);
  } else if (key === "A") {
    changeADSR("attack", 0.01);
  } else if (key === "d") {
    changeADSR("decay", -0.01);
  } else if (key === "D") {
    changeADSR("decay", 0.01);
  } else if (key === "s") {
    changeADSR("sustain", -0.05);
  } else if (key === "S") {
    changeADSR("sustain", 0.05);
  } else if (key === "r") {
    changeADSR("release", -0.02);
  } else if (key === "R") {
    changeADSR("release", 0.02);
  }
}

// ============================================================================
// OPTIONAL FEATURES (Not Yet Implemented)
// ============================================================================
// The following UI elements exist but are not yet wired up:
//
// 1. AI Smoothing Integration (elAIButton, elOpenAIKey, elAIPrompt):
//    - Would send wavetable data to OpenAI API for AI-based smoothing
//    - Requires OpenAI API key and prompt configuration
//
// 2. Processing Method Dropdown (elSmoothingMethod):
//    - "None" = raw geometry data (not recommended)
//    - "Basic interpolation" = current implementation (default)
//    - "AI smoothing" = would trigger OpenAI processing
//
// 3. Progress Indicators:
//    - Visual feedback during wavetable generation
//    - Progress bar for AI processing
//
// To implement AI smoothing:
//    - Add event listener to elAIButton
//    - Send rawSlices data to OpenAI API
//    - Parse response and update wavetables array
//    - Show progress in elAIStatus
// ============================================================================
