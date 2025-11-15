class MeshSlicer {
  constructor() {
    this.tempA = new THREE.Vector3();
    this.tempB = new THREE.Vector3();
    this.tempC = new THREE.Vector3();
  }

  slice(meshData, sliceCount) {
    if (!meshData?.geometry || !meshData.bounds) return [];
    const geometry = meshData.geometry;
    const slices = [];
    const bounds = meshData.bounds;
    const minY = bounds.min.y;
    const maxY = bounds.max.y;
    const range = maxY - minY || 1;
    const step = range / Math.max(sliceCount - 1, 1);

    for (let i = 0; i < sliceCount; i++) {
      const targetY = minY + step * i;
      const segments = this.collectSegmentsAtY(geometry, targetY);
      const polyline = this.assemblePolyline(segments);
      if (polyline.length) {
        slices.push(polyline);
      } else {
        slices.push(this.generateFallback(i));
      }
    }
    return slices;
  }

  collectSegmentsAtY(geometry, targetY) {
    const position = geometry.getAttribute('position');
    const indexAttr = geometry.getIndex();
    const segments = [];
    const triCount = indexAttr ? indexAttr.count / 3 : position.count / 3;
    for (let i = 0; i < triCount; i++) {
      const aIndex = indexAttr ? indexAttr.getX(i * 3) : i * 3;
      const bIndex = indexAttr ? indexAttr.getX(i * 3 + 1) : i * 3 + 1;
      const cIndex = indexAttr ? indexAttr.getX(i * 3 + 2) : i * 3 + 2;
      this.tempA.fromBufferAttribute(position, aIndex);
      this.tempB.fromBufferAttribute(position, bIndex);
      this.tempC.fromBufferAttribute(position, cIndex);

      const intersections = this.intersectTriangle(this.tempA, this.tempB, this.tempC, targetY);
      if (intersections.length >= 2) {
        segments.push([intersections[0], intersections[1]]);
      }
    }
    return segments;
  }

  intersectTriangle(a, b, c, targetY) {
    const epsilon = 1e-5;
    const intersections = [];
    const edges = [
      [a, b],
      [b, c],
      [c, a]
    ];
    for (const [p1, p2] of edges) {
      const d1 = p1.y - targetY;
      const d2 = p2.y - targetY;
      if (Math.abs(d1) < epsilon && Math.abs(d2) < epsilon) {
        continue;
      }
      if ((d1 >= 0 && d2 <= 0) || (d1 <= 0 && d2 >= 0)) {
        if (Math.abs(d1) < epsilon) {
          intersections.push(p1.clone());
        } else if (Math.abs(d2) < epsilon) {
          intersections.push(p2.clone());
        } else {
          const t = d1 / (d1 - d2);
          const point = new THREE.Vector3(
            p1.x + (p2.x - p1.x) * t,
            targetY,
            p1.z + (p2.z - p1.z) * t
          );
          intersections.push(point);
        }
      }
      if (intersections.length > 2) break;
    }
    return intersections.length > 2 ? intersections.slice(0, 2) : intersections;
  }

  assemblePolyline(segments) {
    if (!segments.length) return [];
    const nodes = new Map();
    const edges = new Set();
    const getKey = (pt) => `${pt.x.toFixed(4)},${pt.z.toFixed(4)}`;

    const getNode = (pt) => {
      const key = getKey(pt);
      if (!nodes.has(key)) {
        nodes.set(key, { key, point: { x: pt.x, z: pt.z }, neighbors: new Set() });
      }
      return nodes.get(key);
    };

    const edgeKey = (a, b) => (a.key < b.key ? `${a.key}|${b.key}` : `${b.key}|${a.key}`);

    for (const [pa, pb] of segments) {
      const aNode = getNode(pa);
      const bNode = getNode(pb);
      aNode.neighbors.add(bNode);
      bNode.neighbors.add(aNode);
    }

    const start = [...nodes.values()].find((node) => node.neighbors.size === 1) || nodes.values().next().value;
    if (!start) return [];

    const path = [];
    let current = start;
    let prev = null;
    while (current) {
      path.push({ x: current.point.x, z: current.point.z });
      const next = [...current.neighbors].find((neighbor) => {
        const key = edgeKey(current, neighbor);
        if (edges.has(key)) return false;
        if (prev && neighbor.key === prev.key) return false;
        return true;
      });
      if (!next) {
        break;
      }
      edges.add(edgeKey(current, next));
      prev = current;
      current = next;
      if (path.length > 2048) break;
    }

    return path;
  }

  generateFallback(index) {
    const fallback = [];
    const steps = 64;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const angle = t * TWO_PI;
      fallback.push({
        x: lerp(-0.6, 0.6, t),
        z: 0.25 * Math.sin(angle + index * 0.35)
      });
    }
    return fallback;
  }
}
