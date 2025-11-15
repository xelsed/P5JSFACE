class FaceMeshCapture {
  constructor() {
    this.video = null;
    this.faceMesh = null;
    this.currentGeometry = null;
    this.frozenGeometry = null;
    this.isReady = false;
    this.statusCallbacks = {
      onStatus: () => {},
      onTrackingState: () => {},
      onFrame: () => {}
    };
  }

  initialize(callbacks = {}) {
    this.statusCallbacks = { ...this.statusCallbacks, ...callbacks };
    this.statusCallbacks.onStatus?.('Initializing webcam...');

    this.video = createCapture(VIDEO, () => {
      this.statusCallbacks.onStatus?.('Webcam ready. Loading FaceMesh...');
      this.setupMediaPipe();
    });
    this.video.size(640, 480);
    this.video.hide();
  }

  async setupMediaPipe() {
    try {
      this.faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559614/${file}`
      });
      this.faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        enableFaceGeometry: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      this.faceMesh.onResults((results) => this.handleResults(results));

      this.cameraHelper = new Camera(this.video.elt, {
        onFrame: async () => {
          await this.faceMesh.send({ image: this.video.elt });
        },
        width: 640,
        height: 480
      });
      await this.cameraHelper.start();
      this.isReady = true;
      this.statusCallbacks.onStatus?.('MediaPipe FaceMesh tracking');
      this.statusCallbacks.onTrackingState?.('LIVE TRACKING');
    } catch (err) {
      console.error('Failed to init MediaPipe', err);
      this.statusCallbacks.onStatus?.('MediaPipe error. Check console.');
    }
  }

  handleResults(results) {
    if (!results.multiFaceLandmarks || !results.multiFaceLandmarks.length) {
      this.currentGeometry = null;
      this.statusCallbacks.onTrackingState?.(this.isFrozen() ? 'CAPTURED' : 'SEARCHING...');
      return;
    }

    try {
      this.currentGeometry = this.extractGeometry(results);
    } catch (err) {
      console.error('Failed to extract face geometry', err);
      this.currentGeometry = null;
    }

    if (this.currentGeometry?.vertices?.length && !this.isFrozen()) {
      this.statusCallbacks.onTrackingState?.('LIVE TRACKING');
      this.statusCallbacks.onFrame?.(this.currentGeometry.vertices);
    }
  }

  extractGeometry(results) {
    const hasGeometry = results.multiFaceGeometry && results.multiFaceGeometry.length;
    if (hasGeometry) {
      const geometry = this.extractFromFaceGeometry(results.multiFaceGeometry[0]);
      if (geometry) return geometry;
    }
    const fallback = this.createGeometryFromLandmarks(results.multiFaceLandmarks[0]);
    return fallback;
  }

  extractFromFaceGeometry(faceGeometry) {
    if (!faceGeometry?.getMesh) return null;
    const mesh = faceGeometry.getMesh();
    const vertexBuffer = mesh.getVertexBufferList();
    const indexBuffer = mesh.getIndexBufferList();
    const vertices = [];
    for (let i = 0; i < vertexBuffer.length; i += 3) {
      vertices.push({ x: vertexBuffer[i], y: vertexBuffer[i + 1], z: vertexBuffer[i + 2] });
    }
    const normalized = this.normalizeGeometry(vertices);
    return {
      vertices: normalized,
      indices: indexBuffer ? Array.from(indexBuffer) : [],
      rawVertices: vertices
    };
  }

  createGeometryFromLandmarks(landmarks) {
    if (!landmarks?.length) return null;
    const vertices = landmarks.map((pt) => ({ x: pt.x, y: pt.y, z: pt.z || 0 }));
    const normalized = this.normalizePoints(vertices);
    return {
      vertices: normalized,
      indices: this.generateFallbackIndices(normalized.length)
    };
  }

  normalizeGeometry(points) {
    if (!points.length) return [];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    const scale = 2 / Math.max(maxX - minX, maxY - minY, maxZ - minZ, 0.001);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    return points.map((p) => ({
      x: (p.x - cx) * scale,
      y: -(p.y - cy) * scale,
      z: -(p.z - cz) * scale
    }));
  }

  normalizePoints(points) {
    if (!points.length) return [];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const scale = 2 / Math.max(maxX - minX, maxY - minY, 0.001);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return points.map((p) => ({
      x: (p.x - cx) * scale,
      y: -(p.y - cy) * scale,
      z: (p.z || 0) * scale
    }));
  }

  generateFallbackIndices(count) {
    if (count < 3) return [];
    const indices = [];
    for (let i = 1; i < count - 1; i++) {
      indices.push(0, i, i + 1);
    }
    return indices;
  }

  freeze() {
    const data = this.getStableMesh();
    if (data?.vertices?.length) {
      this.frozenGeometry = {
        vertices: data.vertices.map((p) => ({ ...p })),
        indices: data.indices ? [...data.indices] : []
      };
      this.statusCallbacks.onTrackingState?.('CAPTURED');
    }
  }

  unfreeze() {
    this.frozenGeometry = null;
    this.statusCallbacks.onTrackingState?.('LIVE TRACKING');
  }

  isFrozen() {
    return !!(this.frozenGeometry && this.frozenGeometry.vertices?.length);
  }

  getStableMesh() {
    if (this.isFrozen()) {
      return this.frozenGeometry;
    }
    if (this.currentGeometry?.vertices?.length) {
      return this.currentGeometry;
    }
    return this.generateFallbackMesh();
  }

  getStablePoints() {
    const mesh = this.getStableMesh();
    return mesh?.vertices || [];
  }

  generateFallbackMesh() {
    const vertices = this.generateFallbackFace();
    return {
      vertices,
      indices: this.generateFallbackIndices(vertices.length)
    };
  }

  generateFallbackFace() {
    const points = [];
    const rings = 8;
    const pointsPerRing = 24;
    for (let r = 0; r < rings; r++) {
      const radius = 0.15 + (r / (rings - 1)) * 0.35;
      const y = 0.4 - (r / (rings - 1)) * 0.8;
      for (let i = 0; i < pointsPerRing; i++) {
        const angle = (i / pointsPerRing) * TWO_PI;
        points.push({
          x: radius * Math.cos(angle),
          y,
          z: 0.2 * Math.sin(angle * 1.5)
        });
      }
    }
    return points;
  }
}
