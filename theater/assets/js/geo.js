// ═══ geo.js — 經緯度投影 + GeoJSON → Three.js 幾何 ═══
import * as THREE from 'three';

// 台灣中心附近 (120.9E, 23.7N)。簡單等距圓柱投影,經度依緯度餘弦修正,輸出世界座標(單位≈公里/10)
const CENTER = { lon: 120.95, lat: 23.7 };
const KM_PER_DEG_LAT = 110.574;
const SCALE = 0.1; // 1 世界單位 = 10 km

export function project(lon, lat) {
  const x = (lon - CENTER.lon) * KM_PER_DEG_LAT * Math.cos(CENTER.lat * Math.PI / 180) * SCALE;
  const z = -(lat - CENTER.lat) * KM_PER_DEG_LAT * SCALE; // 北 = -z (Three 慣例:相機看 -z)
  return [x, z];
}

// 把 (Multi)Polygon coordinates 轉成 THREE.Shape 陣列
function polygonToShapes(coords) {
  const shapes = [];
  for (const poly of coords) {
    const outer = poly[0];
    if (!outer || outer.length < 4) continue;
    const shape = new THREE.Shape();
    outer.forEach(([lon, lat], i) => {
      const [x, z] = project(lon, lat);
      if (i === 0) shape.moveTo(x, -z); else shape.lineTo(x, -z); // Shape 在 XY 平面,之後旋轉到 XZ
    });
    for (let h = 1; h < poly.length; h++) {
      const ring = poly[h];
      if (!ring || ring.length < 4) continue;
      const hole = new THREE.Path();
      ring.forEach(([lon, lat], i) => {
        const [x, z] = project(lon, lat);
        if (i === 0) hole.moveTo(x, -z); else hole.lineTo(x, -z);
      });
      shape.holes.push(hole);
    }
    shapes.push(shape);
  }
  return shapes;
}

export function featureToShapes(feature) {
  const g = feature.geometry;
  if (!g) return [];
  if (g.type === 'Polygon') return polygonToShapes([g.coordinates]);
  if (g.type === 'MultiPolygon') return polygonToShapes(g.coordinates);
  return [];
}

// 粗略多邊形面積 (投影平面上, 取最大環) — 用來挑「主要」polygon 與過濾碎屑
export function featureMaxRingArea(feature) {
  const g = feature.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : (g.type === 'MultiPolygon' ? g.coordinates : []);
  let max = 0;
  for (const poly of polys) {
    const ring = poly[0]; if (!ring) continue;
    let a = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = project(ring[i][0], ring[i][1]);
      const [x2, y2] = project(ring[i + 1][0], ring[i + 1][1]);
      a += x1 * y2 - x2 * y1;
    }
    max = Math.max(max, Math.abs(a / 2));
  }
  return max;
}
