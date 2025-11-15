// ============================================================================
// FACE-TO-WAVETABLE 3D SYNTHESIZER
// ============================================================================
// Architecture (UPGRADED TO MEDIAPIPE FACE GEOMETRY):
//   1. MediaPipe Face Geometry → TRUE 3D mesh (metric coordinates in cm)
//   2. Capture (C key) → freeze mesh geometry with topology
//   3. Horizontal slicing → Y-bands across face (mouth-aligned)
//   4. Collision detection → report multi-valued Z at same X
//   5. Wavetable generation → X or Y time-axis, Z → amplitude
//   6. Web Audio playback → per-slice oscillators with ADSR
//   7. 3D visualization → mesh view + wavetable view (5 modes)
// 
// MediaPipe provides:
//   - 468 vertices in metric 3D space (centimeters, not normalized)
//   - Triangular mesh topology (not just points)
//   - UV texture coordinates for accurate mapping
//   - 4x4 pose transformation matrix
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
let faceMesh; // MediaPipe FaceMesh instance
let camera; // MediaPipe Camera helper
let currentFaceResults = null; // Latest detection results

let liveGeometry = null; // Current face geometry (vertices + topology)
let frozenMesh = null; // Captured mesh vertices

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
let playingAnimations = new Map(); // Store animation state per slice

let viewMode = "mesh"; // "mesh" | "wavetable"
let wavetable3DMode = "curves"; // "curves" | "surface" | "bars" | "spiral" | "extrude"

// UI elements
let elCaptureStatus, elMeshStatus, elViewStatus, el3DModeStatus;
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
  el3DModeStatus = document.getElementById("3d-mode-status");

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
  elStatusBar.textContent = "Initializing MediaPipe Face Geometry...";
  
  // Create p5 video capture
  video = createCapture(VIDEO, () => {
    elStatusBar.textContent = "Webcam ready. Loading Face Geometry model...";
    startMediaPipe();
  });
  
  video.size(640, 480);
  video.hide();
}

function startMediaPipe() {
  // Initialize MediaPipe FaceMesh with Face Geometry Module
  faceMesh = new FaceMesh({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
    }
  });

  // CRITICAL: Enable Face Geometry for true 3D mesh (not just landmarks)
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,  // Better accuracy around eyes and lips
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    enableFaceGeometry: true  // ← THIS IS KEY: Provides metric 3D mesh
  });

  // Handle results
  faceMesh.onResults(onFaceResults);

  // Use MediaPipe Camera helper for optimal frame handling
  camera = new Camera(video.elt, {
    onFrame: async () => {
      await faceMesh.send({ image: video.elt });
    },
    width: 640,
    height: 480
  });

  camera.start().then(() => {
    elCaptureStatus.textContent = "Live tracking";
    elMeshStatus.textContent = "0 faces";
    elStatusBar.textContent = "✓ MediaPipe Face Geometry loaded. Press C to capture.";
    console.log("✓ MediaPipe Face Geometry Module initialized");
    console.log("  - 468 vertices in metric 3D space (cm)");
    console.log("  - Triangular mesh topology");
    console.log("  - UV texture coordinates");
    console.log("  - 4x4 pose transformation matrix");
  }).catch((err) => {
    console.error("Camera error:", err);
    elStatusBar.textContent = "⚠️ Webcam access denied. Please grant camera permission.";
    elCaptureStatus.textContent = "No camera";
  });
}

// Handle MediaPipe face detection results
function onFaceResults(results) {
  currentFaceResults = results;
  
  // Update status
  const hasFace = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;
  elMeshStatus.textContent = hasFace ? "1 face" : "0 faces";
  
  if (hasFace && results.multiFaceGeometry && results.multiFaceGeometry.length > 0) {
    // Extract true 3D geometry
    liveGeometry = extractFaceGeometry(results.multiFaceGeometry[0], results.multiFaceLandmarks[0]);
    
    // Debug log first detection
    if (!window.facemeshDebugLogged) {
      console.log("✓ First face with geometry detected!");
      console.log("  Vertices:", liveGeometry.vertices.length);
      console.log("  Sample vertex (metric cm):", liveGeometry.vertices[0]);
      if (liveGeometry.vertices.length > 0) {
        const zValues = liveGeometry.vertices.map(v => v.z);
        console.log("  Z range (cm):", Math.min(...zValues).toFixed(2), "to", Math.max(...zValues).toFixed(2));
      }
      window.facemeshDebugLogged = true;
    }
  } else {
    liveGeometry = null;
  }
}

// Extract true 3D geometry from MediaPipe Face Geometry Module
// Returns metric 3D coordinates (centimeters) + mesh topology
function extractFaceGeometry(faceGeometry, landmarks) {
  const mesh = faceGeometry.getMesh();
  
  // Get vertex buffer (XYZ positions in metric space - centimeters!)
  const vertexBuffer = mesh.getVertexBufferList();
  const vertices = [];
  
  // MediaPipe provides flat array: [x0,y0,z0, x1,y1,z1, ...]
  for (let i = 0; i < vertexBuffer.length; i += 3) {
    vertices.push({
      x: vertexBuffer[i],
      y: vertexBuffer[i + 1],
      z: vertexBuffer[i + 2]
    });
  }
  
  // Get index buffer (triangle topology)
  const indexBuffer = mesh.getIndexBufferList();
  const indices = Array.from(indexBuffer);
  
  // Get pose transformation matrix (4x4 for AR placement)
  const poseMatrix = faceGeometry.getPoseTransformMatrix();
  const matrix = poseMatrix ? poseMatrix.getPackedDataList() : null;
  
  // Normalize coordinates for consistent visualization
  // MediaPipe geometry is already centered and scaled appropriately
  // We just need to flip Y for p5.js coordinate system
  const normalized = normalizeGeometry(vertices);
  
  return {
    vertices: normalized,
    indices: indices,
    matrix: matrix,
    rawVertices: vertices, // Keep original metric coordinates
    landmarks: landmarks   // Keep normalized landmarks for reference
  };
}

// Normalize MediaPipe geometry for p5.js rendering
// MediaPipe uses metric coordinates (cm), we scale to [-1,1] for display
function normalizeGeometry(vertices) {
  if (!vertices || vertices.length === 0) return [];
  
  // Find bounds
  let xmin = Infinity, xmax = -Infinity;
  let ymin = Infinity, ymax = -Infinity;
  let zmin = Infinity, zmax = -Infinity;
  
  for (const v of vertices) {
    if (v.x < xmin) xmin = v.x;
    if (v.x > xmax) xmax = v.x;
    if (v.y < ymin) ymin = v.y;
    if (v.y > ymax) ymax = v.y;
    if (v.z < zmin) zmin = v.z;
    if (v.z > zmax) zmax = v.z;
  }
  
  // Calculate center and scale
  const cx = (xmin + xmax) / 2;
  const cy = (ymin + ymax) / 2;
  const cz = (zmin + zmax) / 2;
  
  const width = xmax - xmin || 1;
  const height = ymax - ymin || 1;
  const depth = zmax - zmin || 1;
  
  // Scale to fit in [-1, 1] range
  const scale = 2.0 / Math.max(width, height, depth);
  
  // Normalize and flip Y (MediaPipe Y+ is down, p5.js Y+ is up)
  const normalized = [];
  for (const v of vertices) {
    normalized.push({
      x: (v.x - cx) * scale,
      y: -(v.y - cy) * scale,  // Flip Y axis
      z: (v.z - cz) * scale
    });
  }
  
  return normalized;
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

  // Draw small video preview in top-left corner (only in mesh view)
  if (viewMode === "mesh" && video && video.loadedmetadata) {
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
  if (!frozenMesh && liveGeometry && liveGeometry.vertices.length > 0) {
    stroke(255, 240, 0, 220);
    strokeWeight(0.012);
    noFill();
    beginShape(POINTS);
    for (const v of liveGeometry.vertices) {
      vertex(v.x, v.y, v.z); // Full 3D depth from MediaPipe geometry
    }
    endShape();
    
    // Draw key landmarks for debug (eyes, nose, mouth)
    drawKeyLandmarks(liveGeometry.vertices, [255, 240, 0]);
  }

  // Frozen mesh
  if (frozenMesh && frozenMesh.length > 0) {
    stroke(255, 255, 255);
    strokeWeight(0.015);
    noFill();
    beginShape(POINTS);
    for (const v of frozenMesh) {
      vertex(v.x, v.y, v.z); // Full 3D depth
    }
    endShape();
    
    // Draw key landmarks for debug
    drawKeyLandmarks(frozenMesh, [255, 255, 255]);

    drawSliceLines();
  }
}

// Draw important landmark points for debugging
function drawKeyLandmarks(points, color) {
  if (!points || points.length < 468) return;
  
  // MediaPipe facemesh key landmark indices
  const landmarks = {
    leftEye: 33,
    rightEye: 263,
    noseTip: 1,
    upperLip: 13,
    lowerLip: 14,
    leftMouth: 61,
    rightMouth: 291
  };
  
  fill(color[0], color[1], color[2], 200);
  noStroke();
  
  for (const [name, idx] of Object.entries(landmarks)) {
    if (points[idx]) {
      push();
      translate(points[idx].x, points[idx].y, points[idx].z);
      sphere(0.03);
      pop();
    }
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

  // Dispatch to specific rendering mode
  if (wavetable3DMode === "curves") {
    renderWavetableCurves();
  } else if (wavetable3DMode === "surface") {
    renderWavetableSurface();
  } else if (wavetable3DMode === "bars") {
    renderWavetableBars();
  } else if (wavetable3DMode === "spiral") {
    renderWavetableSpiral();
  } else if (wavetable3DMode === "extrude") {
    renderWavetableExtrude();
  }
}

// Mode 1: Stacked curves (original, enhanced with animation)
function renderWavetableCurves() {
  const sliceSpacing = 0.25;
  const ampScale = 1.2;

  for (let i = 0; i < wavetables.length; i++) {
    const wav = wavetables[i];
    if (!wav) continue;

    const y = (i - (wavetables.length - 1) / 2) * sliceSpacing;
    const isPlaying = playingSlices.has(i);
    const isMouthSlice = mouthSliceIndex !== null && i === mouthSliceIndex;

    // Animation pulse
    let pulseScale = 1.0;
    let alpha = 255;
    if (isPlaying) {
      const t = (millis() % 500) / 500; // 0 to 1 cycle
      pulseScale = 1.0 + sin(t * TWO_PI) * 0.3; // Pulse between 0.7 and 1.3
      alpha = 255;
    }

    let col;
    let weight;
    if (isPlaying) {
      col = [120, 255, 180, alpha]; // Bright green
      weight = 0.025 * pulseScale;
    } else if (isMouthSlice) {
      col = [80, 180, 255, 200];
      weight = 0.018;
    } else {
      col = [180, 200, 255, 180];
      weight = 0.012;
    }
    
    stroke(col[0], col[1], col[2], col[3] || 255);
    strokeWeight(weight);
    noFill();

    beginShape();
    for (let j = 0; j < wav.length; j++) {
      const t = j / (wav.length - 1);
      const x = (t - 0.5) * 2.4;
      const z = wav[j] * ampScale * (isPlaying ? pulseScale : 1.0);
      vertex(x, y, z);
    }
    endShape();
  }
}

// Mode 2: 3D Surface mesh
function renderWavetableSurface() {
  const sliceSpacing = 0.25;
  const ampScale = 1.2;
  
  for (let i = 0; i < wavetables.length - 1; i++) {
    const wav1 = wavetables[i];
    const wav2 = wavetables[i + 1];
    if (!wav1 || !wav2) continue;

    const y1 = (i - (wavetables.length - 1) / 2) * sliceSpacing;
    const y2 = (i + 1 - (wavetables.length - 1) / 2) * sliceSpacing;
    const isPlaying = playingSlices.has(i) || playingSlices.has(i + 1);

    let fillCol = isPlaying ? [120, 255, 180, 150] : [180, 200, 255, 100];
    let strokeCol = isPlaying ? [120, 255, 180, 200] : [180, 200, 255, 150];
    
    fill(fillCol[0], fillCol[1], fillCol[2], fillCol[3]);
    stroke(strokeCol[0], strokeCol[1], strokeCol[2], strokeCol[3]);
    strokeWeight(0.005);

    // Draw quad strips
    const step = 8; // Sample every 8th point for performance
    for (let j = 0; j < wav1.length - step; j += step) {
      beginShape(QUAD_STRIP);
      for (let k = 0; k <= step; k++) {
        const idx = Math.min(j + k, wav1.length - 1);
        const t = idx / (wav1.length - 1);
        const x = (t - 0.5) * 2.4;
        const z1 = wav1[idx] * ampScale;
        const z2 = wav2[idx] * ampScale;
        vertex(x, y1, z1);
        vertex(x, y2, z2);
      }
      endShape();
    }
  }
}

// Mode 3: Vertical bars (histogram style)
function renderWavetableBars() {
  const sliceSpacing = 0.25;
  const ampScale = 1.5;
  
  for (let i = 0; i < wavetables.length; i++) {
    const wav = wavetables[i];
    if (!wav) continue;

    const y = (i - (wavetables.length - 1) / 2) * sliceSpacing;
    const isPlaying = playingSlices.has(i);

    let pulseScale = 1.0;
    if (isPlaying) {
      const t = (millis() % 400) / 400;
      pulseScale = 1.0 + sin(t * TWO_PI) * 0.4;
    }

    const step = 4; // Draw every 4th sample
    for (let j = 0; j < wav.length; j += step) {
      const t = j / (wav.length - 1);
      const x = (t - 0.5) * 2.4;
      const amp = wav[j] * ampScale * pulseScale;
      
      if (isPlaying) {
        stroke(120, 255, 180);
        fill(120, 255, 180, 100);
      } else {
        stroke(180, 200, 255, 150);
        fill(180, 200, 255, 50);
      }
      
      strokeWeight(0.005);
      push();
      translate(x, y, amp / 2);
      box(0.02, 0.02, Math.abs(amp));
      pop();
    }
  }
}

// Mode 4: Spiral / Radial layout
function renderWavetableSpiral() {
  const ampScale = 0.8;
  
  for (let i = 0; i < wavetables.length; i++) {
    const wav = wavetables[i];
    if (!wav) continue;

    const radius = 0.3 + i * 0.15;
    const isPlaying = playingSlices.has(i);

    let pulseScale = 1.0;
    if (isPlaying) {
      const t = (millis() % 600) / 600;
      pulseScale = 1.0 + sin(t * TWO_PI) * 0.2;
    }

    if (isPlaying) {
      stroke(120, 255, 180, 255);
      strokeWeight(0.02 * pulseScale);
    } else {
      stroke(180, 200, 255, 180);
      strokeWeight(0.01);
    }
    noFill();

    beginShape();
    for (let j = 0; j < wav.length; j++) {
      const angle = map(j, 0, wav.length - 1, 0, TWO_PI);
      const r = radius + wav[j] * ampScale * pulseScale;
      const x = r * cos(angle);
      const y = r * sin(angle);
      const z = (i - wavetables.length / 2) * 0.15;
      vertex(x, y, z);
    }
    endShape(CLOSE);
  }
}

// Mode 5: Extruded solid shapes
function renderWavetableExtrude() {
  const sliceSpacing = 0.3;
  const ampScale = 1.0;
  
  for (let i = 0; i < wavetables.length; i++) {
    const wav = wavetables[i];
    if (!wav) continue;

    const y = (i - (wavetables.length - 1) / 2) * sliceSpacing;
    const isPlaying = playingSlices.has(i);

    let pulseScale = 1.0;
    let glowIntensity = 0;
    if (isPlaying) {
      const t = (millis() % 500) / 500;
      pulseScale = 1.0 + sin(t * TWO_PI) * 0.25;
      glowIntensity = (sin(t * TWO_PI) + 1) * 0.5; // 0 to 1
    }

    // Draw as filled ribbon with thickness
    const step = 4;
    for (let j = 0; j < wav.length - step; j += step) {
      const t1 = j / (wav.length - 1);
      const t2 = (j + step) / (wav.length - 1);
      const x1 = (t1 - 0.5) * 2.4;
      const x2 = (t2 - 0.5) * 2.4;
      const z1 = wav[j] * ampScale * pulseScale;
      const z2 = wav[Math.min(j + step, wav.length - 1)] * ampScale * pulseScale;
      
      if (isPlaying) {
        fill(120, 255, 180, 150 + glowIntensity * 100);
        stroke(120, 255, 180, 200);
      } else {
        fill(180, 200, 255, 80);
        stroke(180, 200, 255, 150);
      }
      strokeWeight(0.006);

      // Draw quad ribbon
      beginShape(QUADS);
      vertex(x1, y - 0.05, z1);
      vertex(x2, y - 0.05, z2);
      vertex(x2, y + 0.05, z2);
      vertex(x1, y + 0.05, z1);
      endShape();
    }
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
  // MediaPipe facemesh landmark indices for lips
  const upperLipCenter = 13;  // Upper lip center
  const lowerLipCenter = 14;  // Lower lip center
  mouthSliceIndex = null;
  if (frozenMesh.length > Math.max(upperLipCenter, lowerLipCenter) && 
      frozenMesh[upperLipCenter] && frozenMesh[lowerLipCenter]) {
    const mouthY = (frozenMesh[upperLipCenter].y + frozenMesh[lowerLipCenter].y) * 0.5;
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
    if (liveGeometry && liveGeometry.vertices.length > 0) {
      frozenMesh = liveGeometry.vertices.map((v) => ({ x: v.x, y: v.y, z: v.z }));
      elCaptureStatus.textContent = "Frozen (MediaPipe 3D)";
      elStatusBar.textContent = "✓ True 3D mesh captured (metric geometry). Press Esc to unfreeze.";
      console.log("✓ Captured MediaPipe Face Geometry:", frozenMesh.length, "vertices");
      recomputeSlices();
    } else {
      elStatusBar.textContent = "⚠️ No face detected. Look at camera.";
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
    elViewStatus.textContent = viewMode === "mesh" ? "Face Geometry" : "Wavetable";
  } else if (key === "m" || key === "M") {
    // Cycle through 3D visualization modes
    const modes = ["curves", "surface", "bars", "spiral", "extrude"];
    const currentIdx = modes.indexOf(wavetable3DMode);
    wavetable3DMode = modes[(currentIdx + 1) % modes.length];
    const modeNames = {
      "curves": "Stacked Curves",
      "surface": "3D Surface",
      "bars": "Bar Graph",
      "spiral": "Spiral Radial",
      "extrude": "Extruded Ribbons"
    };
    const modeName = modeNames[wavetable3DMode];
    if (elStatusBar) elStatusBar.textContent = `3D Mode: ${modeName}`;
    if (el3DModeStatus) el3DModeStatus.textContent = modeName;
  } else if (key === "x" || key === "X") {
    timeAxisMode = "x";
    generateWavetables();
    if (elStatusBar) elStatusBar.textContent = "Time axis: X (left → right)";
  } else if (key === "y" || key === "Y") {
    timeAxisMode = "y";
    generateWavetables();
    if (elStatusBar) elStatusBar.textContent = "Time axis: Y (top → bottom)";
  } else if (key >= "1" && key <= "9") {
    // Number keys 1..9 to play slices
    const idx = parseInt(key) - 1;
    if (idx < wavetables.length) {
      playSlice(idx);
      if (elStatusBar) elStatusBar.textContent = `Playing slice ${idx + 1}`;
    }
  } else if (key === "0") {
    // 0 key → 10th slice
    if (wavetables.length > 9) {
      playSlice(9);
      if (elStatusBar) elStatusBar.textContent = "Playing slice 10";
    }
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
