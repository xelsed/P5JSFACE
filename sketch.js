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

  elSliceCount.textContent = String(sliceCount);
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
  video.size(320, 240);
  video.hide();

  facemeshModel = ml5.facemesh(video, () => {
    elCaptureStatus.textContent = "Live tracking";
    elMeshStatus.textContent = "0 faces";
    elStatusBar.textContent = "Facemesh model loaded. Look at the camera and press C to capture.";
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
    renderWavetableViewPlaceholder();
  }

  pop();

  // Draw small video preview in top-left corner as a 2D overlay
  if (video) {
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
  // Live tracking as ghosted background
  if (stabilizedLivePoints && stabilizedLivePoints.length > 0) {
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

function renderWavetableViewPlaceholder() {
  // Placeholder: show a simple text plane until wavetable 3D view is implemented.
  push();
  rotateX(-Math.PI / 4);
  rotateY(0.3);
  noStroke();
  fill(40, 60, 120);
  plane(1.4, 0.4);
  pop();
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
  if (frozenMesh[upperLipIndex] && frozenMesh[lowerLipIndex]) {
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
    rawSlices[idx].push({ x: p.x, z: p.z });
  }

  for (let i = 0; i < sliceCount; i++) {
    const pts = rawSlices[i];
    sliceCollisionCounts[i] = estimateCollisionsForSlice(pts);
    totalCollisions += sliceCollisionCounts[i];
  }

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

function keyPressed() {
  if (key === "c" || key === "C") {
    if (stabilizedLivePoints && stabilizedLivePoints.length > 0) {
      frozenMesh = stabilizedLivePoints.map((p) => ({ x: p.x, y: p.y, z: p.z }));
      elCaptureStatus.textContent = "Frozen";
      elStatusBar.textContent = "Frozen mesh captured. Adjust slices with [ and ]";
      recomputeSlices();
    }
  } else if (key === "[") {
    sliceCount = Math.max(2, sliceCount - 1);
    if (frozenMesh) recomputeSlices();
  } else if (key === "]") {
    sliceCount = Math.min(64, sliceCount + 1);
    if (frozenMesh) recomputeSlices();
  } else if (key === "v" || key === "V") {
    viewMode = viewMode === "mesh" ? "wavetable" : "mesh";
    elViewStatus.textContent = viewMode === "mesh" ? "Facemesh" : "Wavetable";
  }
}
