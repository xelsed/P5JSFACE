class Visualizer {
  constructor() {
    this.viewMode = 'mesh';
  }

  setViewMode(mode) {
    this.viewMode = mode;
  }

  getViewMode() {
    return this.viewMode;
  }

  render(state) {
    push();
    rotateX(-0.4);
    translate(0, 60, 0);
    if (state.viewMode === 'mesh') {
      this.renderPointCloud(state.points);
      this.renderSlices(state.slices);
    } else {
      this.renderWavetableStack(state.wavetables, state.playingSlices);
    }
    pop();
  }

  renderPointCloud(points) {
    if (!points?.length) return;
    stroke(120, 160, 255, 200);
    strokeWeight(3);
    noFill();
    beginShape(POINTS);
    for (const p of points) {
      vertex(p.x * 300, p.y * -300, p.z * 300);
    }
    endShape();
  }

  renderSlices(slices) {
    if (!slices?.length) return;
    noFill();
    for (let i = 0; i < slices.length; i++) {
      const slice = slices[i];
      stroke(255, 120 + i * 5, 160, 180);
      beginShape();
      for (const pt of slice) {
        vertex(pt.x * 300, 0, pt.z * 300);
      }
      endShape();
      translate(0, -4, 0);
    }
  }

  renderWavetableStack(wavetables, playing) {
    if (!wavetables?.length) return;
    const stackSpacing = 18;
    for (let i = 0; i < wavetables.length; i++) {
      const wave = wavetables[i];
      stroke(playing.has(i) ? color(255, 180, 80) : color(140, 200, 255));
      noFill();
      push();
      translate(-200, -i * stackSpacing, 0);
      beginShape();
      for (let s = 0; s < wave.length; s++) {
        const x = map(s, 0, wave.length - 1, 0, 400);
        const z = wave[s] * 120;
        vertex(x, 0, z);
      }
      endShape();
      pop();
    }
  }
}
