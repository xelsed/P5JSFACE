let faceMeshCapture;
let meshBuilder;
let meshSlicer;
let wavetableGen;
let audioEngine;
let visualizer;
let uiControls;
let aiProcessor;

let latestMesh = null;
let latestSlices = [];
let latestWavetables = [];

function setup() {
  const container = document.getElementById('canvas-container');
  const w = container?.clientWidth || window.innerWidth - 320;
  const h = container?.clientHeight || window.innerHeight;

  const cnv = createCanvas(w, h, WEBGL);
  cnv.parent('canvas-container');
  pixelDensity(1);

  faceMeshCapture = new FaceMeshCapture();
  meshBuilder = new MeshBuilder();
  meshSlicer = new MeshSlicer();
  wavetableGen = new WavetableGenerator(512);
  audioEngine = new AudioEngine();
  visualizer = new Visualizer();
  aiProcessor = new AIProcessor();

  uiControls = new UIControls({
    onCapture: () => faceMeshCapture.freeze(),
    onUnfreeze: () => faceMeshCapture.unfreeze(),
    onSliceChange: (value) => regenerateSlices(value),
    onPitchChange: (offset) => audioEngine.setSemitoneOffset(offset),
    onADSRChange: (adsr) => audioEngine.setEnvelope(adsr),
    onToggleView: (view) => visualizer.setViewMode(view),
    onPlaySlice: (index) => audioEngine.triggerSlice(index, latestWavetables[index] || []),
    onRequestAI: async (prompt, apiKey) => {
      if (!latestSlices.length) return;
      try {
        uiControls.setAIStatus('Processing slices with OpenAI...');
        const processed = await aiProcessor.processSlices(latestSlices, prompt, apiKey, wavetableGen.tableSize, (progress) => {
          uiControls.setAIStatus(`AI processing ${progress.completed}/${progress.total}`);
        });
        latestWavetables = processed;
        audioEngine.setWavetables(latestWavetables);
        uiControls.setAIStatus('AI smoothing complete');
      } catch (err) {
        console.error(err);
        uiControls.setAIStatus(err.message || 'AI processing failed');
      }
    }
  });

  faceMeshCapture.initialize({
    onStatus: (msg) => uiControls.setStatus(msg),
    onTrackingState: (state) => uiControls.setCaptureState(state),
    onFrame: () => regenerateSlices(uiControls.getSliceCount())
  });

  regenerateSlices(uiControls.getSliceCount());
}

function windowResized() {
  const container = document.getElementById('canvas-container');
  const w = container?.clientWidth || window.innerWidth - 320;
  const h = container?.clientHeight || window.innerHeight;
  resizeCanvas(w, h);
}

function regenerateSlices(sliceCount) {
  const points = faceMeshCapture.getStablePoints();
  if (!points.length) {
    latestMesh = null;
    latestSlices = [];
    latestWavetables = [];
    uiControls.setSliceInfo(0);
    return;
  }

  latestMesh = meshBuilder.build(points);
  latestSlices = meshSlicer.slice(latestMesh, sliceCount);
  latestWavetables = wavetableGen.generate(latestSlices);
  audioEngine.setWavetables(latestWavetables);
  uiControls.setSliceInfo(sliceCount, latestSlices);
}

function draw() {
  background(8, 10, 18);

  const points = faceMeshCapture.getStablePoints();
  const state = {
    viewMode: visualizer.getViewMode(),
    points,
    slices: latestSlices,
    wavetables: latestWavetables,
    playingSlices: audioEngine.getPlayingSlices()
  };
  visualizer.render(state);
  uiControls.renderOverlays(points, latestSlices, latestWavetables);
}

function keyPressed() {
  if (uiControls) {
    uiControls.handleKey(key, keyCode);
  }
}
