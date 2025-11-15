class FaceMeshCapture {
  constructor() {
    this.video = null;
    this.mesh = null;
    this.faceMesh = null;
    this.currentLandmarks = [];
    this.frozenLandmarks = null;
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
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      });
      this.faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
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
      this.currentLandmarks = [];
      this.statusCallbacks.onTrackingState?.(this.isFrozen() ? 'CAPTURED' : 'SEARCHING...');
      return;
    }

    const landmarks = results.multiFaceLandmarks[0].map((pt) => ({
      x: pt.x,
      y: pt.y,
      z: pt.z || 0
    }));

    this.currentLandmarks = this.normalizePoints(landmarks);
    if (!this.isFrozen()) {
      this.statusCallbacks.onTrackingState?.('LIVE TRACKING');
    }
    this.statusCallbacks.onFrame?.(this.currentLandmarks);
  }

  normalizePoints(points) {
    if (!points.length) return [];
    const centered = points.map((p) => ({ ...p }));
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of centered) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const scale = 1 / Math.max(maxX - minX, maxY - minY, 0.001);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return centered.map((p) => ({
      x: (p.x - cx) * scale,
      y: (p.y - cy) * scale,
      z: (p.z || 0) * scale
    }));
  }

  freeze() {
    const data = this.getStablePoints();
    if (data.length) {
      this.frozenLandmarks = data.map((p) => ({ ...p }));
      this.statusCallbacks.onTrackingState?.('CAPTURED');
    }
  }

  unfreeze() {
    this.frozenLandmarks = null;
    this.statusCallbacks.onTrackingState?.('LIVE TRACKING');
  }

  isFrozen() {
    return Array.isArray(this.frozenLandmarks) && this.frozenLandmarks.length > 0;
  }

  getStablePoints() {
    if (this.isFrozen()) {
      return this.frozenLandmarks;
    }
    if (this.currentLandmarks.length) {
      return this.currentLandmarks;
    }
    return this.generateFallbackFace();
  }

  generateFallbackFace() {
    const points = [];
    for (let i = 0; i < 200; i++) {
      const angle = (i / 200) * TWO_PI;
      const x = 0.4 * Math.cos(angle);
      const y = 0.6 * Math.sin(angle);
      const z = 0.1 * Math.sin(angle * 3.0);
      points.push({ x, y, z });
    }
    return points;
  }
}
