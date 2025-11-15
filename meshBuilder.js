class MeshBuilder {
  build(points) {
    if (!points || !points.length) return null;
    const positions = [];
    for (const pt of points) {
      positions.push(pt.x, pt.y, pt.z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeBoundingBox();
    return {
      geometry,
      points,
      bounds: geometry.boundingBox.clone()
    };
  }
}
