// ═══ people/geo.js — 經緯度投影 + GeoJSON → Three.js 幾何 ═══
// 自 assets/js/geo.js 改寫複製,維持與原版相同投影,避免動到既有檔案。
import * as THREE from 'three';

const CENTER = { lon: 120.95, lat: 23.7 };
const KM_PER_DEG_LAT = 110.574;
const SCALE = 0.1; // 1 世界單位 = 10 km

export function project(lon, lat) {
  const x = (lon - CENTER.lon) * KM_PER_DEG_LAT * Math.cos(CENTER.lat * Math.PI / 180) * SCALE;
  const z = -(lat - CENTER.lat) * KM_PER_DEG_LAT * SCALE;
  return [x, z];
}

function polygonToShapes(coords) {
  const shapes = [];
  for (const poly of coords) {
    const outer = poly[0];
    if (!outer || outer.length < 4) continue;
    const shape = new THREE.Shape();
    outer.forEach(([lon, lat], i) => {
      const [x, z] = project(lon, lat);
      if (i === 0) shape.moveTo(x, -z); else shape.lineTo(x, -z);
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

// ── 資料插值 ──
export function seriesAt(years, values, year) {
  if (!years || !values || !years.length) return null;
  if (year <= years[0]) return values[0];
  if (year >= years[years.length - 1]) return values[values.length - 1];
  for (let i = 0; i < years.length - 1; i++) {
    if (year >= years[i] && year <= years[i + 1]) {
      const v0 = values[i], v1 = values[i + 1];
      if (v0 == null || v1 == null) return v1 ?? v0;
      const f = (year - years[i]) / (years[i + 1] - years[i]);
      return v0 + (v1 - v0) * f;
    }
  }
  return values[values.length - 1];
}

// 0..1 多段色票取色
export function colorRamp(stops, t) {
  t = Math.max(0, Math.min(1, t));
  const n = stops.length - 1;
  const i = Math.min(n - 1, Math.floor(t * n));
  const f = t * n - i;
  const c1 = new THREE.Color(stops[i]), c2 = new THREE.Color(stops[i + 1]);
  return c1.lerp(c2, f);
}
