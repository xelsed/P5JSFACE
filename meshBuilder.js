class MeshBuilder {
  build(meshData) {
    if (!meshData?.vertices?.length) return null;
    const positions = new Float32Array(meshData.vertices.length * 3);
    meshData.vertices.forEach((pt, idx) => {
      positions[idx * 3] = pt.x;
      positions[idx * 3 + 1] = pt.y;
      positions[idx * 3 + 2] = pt.z;
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const indices = this.prepareIndices(meshData);
    if (indices?.length) {
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    }

    geometry.computeVertexNormals();
    geometry.computeBoundingBox();

    return {
      geometry,
      points: meshData.vertices,
      bounds: geometry.boundingBox.clone()
    };
  }

  prepareIndices(meshData) {
    const source = meshData.indices && meshData.indices.length ? meshData.indices : null;
    if (source) {
      if (source instanceof Uint16Array || source instanceof Uint32Array) {
        return source;
      }
      const TypedArray = meshData.vertices.length > 65535 ? Uint32Array : Uint16Array;
      return new TypedArray(source);
    }
    const fallback = [];
    const count = meshData.vertices.length;
    if (count < 3) return null;
    for (let i = 1; i < count - 1; i++) {
      fallback.push(0, i, i + 1);
    }
    return new (count > 65535 ? Uint32Array : Uint16Array)(fallback);
  }
}
