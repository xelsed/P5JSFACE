class WavetableGenerator {
  constructor(tableSize = 512) {
    this.tableSize = tableSize;
  }

  generate(polylines) {
    if (!Array.isArray(polylines)) return [];
    return polylines.map((polyline) => this.resamplePolyline(polyline));
  }

  resamplePolyline(polyline) {
    if (!polyline || !polyline.length) {
      return new Array(this.tableSize).fill(0);
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const pt of polyline) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.z < minZ) minZ = pt.z;
      if (pt.z > maxZ) maxZ = pt.z;
    }
    const rangeX = maxX - minX || 1;
    const rangeZ = maxZ - minZ || 1;

    const samples = new Array(this.tableSize).fill(0);
    for (let i = 0; i < this.tableSize; i++) {
      const t = i / (this.tableSize - 1);
      const targetX = minX + t * rangeX;
      const nearest = this.getInterpolatedValue(polyline, targetX);
      const normalized = ((nearest - minZ) / rangeZ) * 2 - 1;
      samples[i] = normalized;
    }
    return samples;
  }

  getInterpolatedValue(polyline, targetX) {
    for (let i = 0; i < polyline.length - 1; i++) {
      const a = polyline[i];
      const b = polyline[i + 1];
      if ((targetX >= a.x && targetX <= b.x) || (targetX >= b.x && targetX <= a.x)) {
        const span = b.x - a.x || 1;
        const lerpT = (targetX - a.x) / span;
        return lerp(a.z, b.z, lerpT);
      }
    }
    return polyline[polyline.length - 1].z;
  }
}
