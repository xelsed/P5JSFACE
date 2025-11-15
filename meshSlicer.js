class MeshSlicer {
  slice(meshData, sliceCount) {
    if (!meshData || !meshData.points?.length) return [];
    const slices = [];
    const bounds = meshData.bounds;
    const minY = bounds.min.y;
    const maxY = bounds.max.y;
    const range = maxY - minY || 1;
    const step = range / Math.max(sliceCount - 1, 1);

    for (let i = 0; i < sliceCount; i++) {
      const targetY = minY + step * i;
      const tolerance = step * 0.75;
      const collected = [];
      for (const pt of meshData.points) {
        const weight = 1 - Math.min(Math.abs(pt.y - targetY) / tolerance, 1);
        if (weight > 0) {
          collected.push({ x: pt.x, z: pt.z, weight });
        }
      }
      collected.sort((a, b) => a.x - b.x);
      const simplified = collected.map(({ x, z }) => ({ x, z }));
      if (!simplified.length) {
        const fallback = [];
        for (let s = 0; s < 32; s++) {
          const t = (s / 31) * TWO_PI;
          fallback.push({ x: -0.5 + (s / 31), z: 0.2 * Math.sin(t + i * 0.2) });
        }
        slices.push(fallback);
      } else {
        slices.push(simplified);
      }
    }
    return slices;
  }
}
