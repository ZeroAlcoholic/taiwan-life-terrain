// ═══ scene.js — 3D 戰情舞台:縣市地形、光影、特效、標籤、拾取 ═══
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { featureToShapes, project } from './geo.js';

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050b13);
    this.scene.fog = new THREE.Fog(0x050b13, 70, 200);

    this.camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 600);
    this.camera.position.set(0, 38, 46);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 120;
    this.controls.target.set(0, 0, 0);

    this._initLights();
    this._initSea();

    this.counties = new Map();   // name -> {group, meshes[], edge, mat, target:{h,color}, current:{h,color}, centroid:[x,z], baseY}
    this.labelLayer = new Map(); // name -> DOM el
    this.effects = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(-9, -9);
    this.hovered = null;
    this.userInteracting = false;
    this.clock = new THREE.Clock();

    canvas.addEventListener('pointermove', e => {
      this.pointer.x = (e.clientX / innerWidth) * 2 - 1;
      this.pointer.y = -(e.clientY / innerHeight) * 2 + 1;
    });
    ['pointerdown', 'wheel'].forEach(ev =>
      canvas.addEventListener(ev, () => { this.userInteracting = true; this._lastUserAct = performance.now(); }));
    canvas.addEventListener('pointerup', () => { this._lastUserAct = performance.now(); });
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  _initLights() {
    this.scene.add(new THREE.HemisphereLight(0x3a4a5c, 0x0a0c10, 0.9));
    const key = new THREE.DirectionalLight(0xffe9b8, 2.1);
    key.position.set(-28, 42, 18);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const c = 40;
    Object.assign(key.shadow.camera, { left: -c, right: c, top: c, bottom: -c, far: 140 });
    key.shadow.bias = -0.0008;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x3fa8a6, 0.85);
    rim.position.set(30, 16, -34);
    this.scene.add(rim);
    this.keyLight = key;
  }

  _initSea() {
    // 深藍海洋:程序式波紋 shader(凸顯臺灣主體)
    this.seaUniforms = {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x07131f) },
      uShallow: { value: new THREE.Color(0x123249) },
      uCrest: { value: new THREE.Color(0x2a5e74) },
    };
    const sea = new THREE.Mesh(
      new THREE.CircleGeometry(280, 72),
      new THREE.ShaderMaterial({
        uniforms: this.seaUniforms,
        vertexShader: `
          varying vec2 vP;
          void main() {
            vP = position.xy;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform float uTime; uniform vec3 uDeep, uShallow, uCrest;
          varying vec2 vP;
          void main() {
            float d = length(vP);
            // 兩組行進波 + 緩慢湧浪
            float w1 = sin(d * 0.55 - uTime * 0.9);
            float w2 = sin(vP.x * 0.22 + vP.y * 0.31 + uTime * 0.55);
            float w3 = sin(vP.x * 0.07 - uTime * 0.25) * sin(vP.y * 0.06 + uTime * 0.2);
            float wave = w1 * 0.18 + w2 * 0.22 + w3 * 0.32;
            vec3 col = mix(uDeep, uShallow, smoothstep(-0.6, 0.9, wave));
            // 浪尖微光
            col += uCrest * smoothstep(0.78, 1.0, w1 * 0.5 + w2 * 0.5) * 0.18;
            // 邊緣漸暗融入夜色
            col *= 1.0 - smoothstep(110.0, 270.0, d);
            gl_FragColor = vec4(col, 1.0);
          }`,
      })
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.18;
    this.scene.add(sea);

    // 戰情雷達圈(改藍調)
    const rings = new THREE.Group();
    for (let r = 8; r <= 88; r += 10) {
      const pts = [];
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x1e3a52, transparent: true, opacity: 0.4 })
      );
      rings.add(line);
    }
    const grid = new THREE.GridHelper(220, 44, 0x12283c, 0x0e1f30);
    grid.position.y = -0.14;
    rings.position.y = -0.12;
    this.scene.add(grid, rings);
    this.radarRings = rings;
  }

  // ── 建構縣市地形 ──
  buildMap(geojson, centroids) {
    const mapGroup = new THREE.Group();
    this.mapGroup = mapGroup;
    for (const f of geojson.features) {
      const name = f.properties.name;
      const shapes = featureToShapes(f);
      if (!shapes.length) continue;
      const geos = shapes.map(s => {
        const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 4 });
        g.rotateX(-Math.PI / 2);
        return g;
      });
      const mat = new THREE.MeshStandardMaterial({
        color: 0x26303c, roughness: 0.55, metalness: 0.3,
        emissive: 0x000000, emissiveIntensity: 1
      });
      const sideMat = new THREE.MeshStandardMaterial({
        color: 0x10151c, roughness: 0.8, metalness: 0.2, emissive: 0x000000
      });
      const group = new THREE.Group();
      const meshes = geos.map(g => {
        const m = new THREE.Mesh(g, [mat, sideMat]);
        m.castShadow = m.receiveShadow = true;
        m.userData.county = name;
        group.add(m);
        return m;
      });
      // 頂面描金邊(只描上輪廓,避免側壁線條雜訊)
      const edgeGroup = new THREE.Group();
      const edgeMat = new THREE.LineBasicMaterial({ color: 0x9d8430, transparent: true, opacity: 0.85 });
      shapes.forEach(s => {
        const pts = s.getPoints(6).map(p => new THREE.Vector3(p.x, 1.002, -p.y));
        edgeGroup.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), edgeMat));
      });
      group.add(edgeGroup);
      group.scale.y = 0.001;
      mapGroup.add(group);

      const c = centroids[name] ? project(centroids[name][0], centroids[name][1]) : [0, 0];
      this.counties.set(name, {
        group, meshes, edgeGroup, mat,
        centroid: c,
        target: { h: 0.6, color: new THREE.Color(0x26303c), emissive: new THREE.Color(0x000000) },
        current: { h: 0.001, color: new THREE.Color(0x26303c), emissive: new THREE.Color(0x000000) }
      });
    }
    this.scene.add(mapGroup);
  }

  buildLabels(container) {
    for (const name of this.counties.keys()) {
      const el = document.createElement('div');
      el.className = 'county-label hidden';
      el.innerHTML = `<span class="cl-name">${name}</span><span class="cl-val"></span>`;
      container.appendChild(el);
      this.labelLayer.set(name, el);
    }
  }

  // ── 每幀由 director 設定目標,場景平滑趨近 ──
  setCounty(name, { h, color, emissive } = {}) {
    const c = this.counties.get(name);
    if (!c) return;
    if (h !== undefined) c.target.h = Math.max(0.02, h);
    if (color !== undefined) c.target.color.set(color);
    c.target.emissive.set(emissive !== undefined ? emissive : 0x000000);
  }

  setLabel(name, text, opts = {}) {
    const el = this.labelLayer.get(name);
    if (!el) return;
    if (text == null) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.classList.toggle('hero', !!opts.hero);
    el.querySelector('.cl-val').textContent = text;
  }
  hideAllLabels() { for (const el of this.labelLayer.values()) el.classList.add('hidden'); }

  // ── 特效 ──
  pulse(name, color = 0xd9333f, maxR = 7) {
    const c = this.counties.get(name);
    if (!c) return;
    const geo = new THREE.RingGeometry(0.8, 1.0, 48);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(c.centroid[0], c.current.h + 0.15, c.centroid[1]);
    this.scene.add(m);
    this.effects.push({ mesh: m, t: 0, dur: 1.6, maxR, type: 'pulse' });
  }

  beacon(name, color = 0xc9a227, height = 16) {
    const c = this.counties.get(name);
    if (!c) return;
    const geo = new THREE.CylinderGeometry(0.22, 0.5, height, 12, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(c.centroid[0], height / 2, c.centroid[1]);
    this.scene.add(m);
    this.effects.push({ mesh: m, t: 0, dur: 3.2, type: 'beacon' });
  }

  clearEffects() {
    for (const e of this.effects) { this.scene.remove(e.mesh); e.mesh.geometry.dispose(); e.mesh.material.dispose(); }
    this.effects = [];
  }

  // 螢幕座標 (供標籤定位)
  toScreen(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight, v.z];
  }

  update(dt) {
    // 縣市趨近目標
    const k = 1 - Math.pow(0.0015, dt); // 平滑係數
    for (const c of this.counties.values()) {
      c.current.h += (c.target.h - c.current.h) * k;
      c.current.color.lerp(c.target.color, k);
      c.current.emissive.lerp(c.target.emissive, k);
      c.group.scale.y = c.current.h;
      c.mat.color.copy(c.current.color);
      c.mat.emissive.copy(c.current.emissive);
    }
    // 特效
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      const p = e.t / e.dur;
      if (p >= 1) {
        this.scene.remove(e.mesh); e.mesh.geometry.dispose(); e.mesh.material.dispose();
        this.effects.splice(i, 1); continue;
      }
      if (e.type === 'pulse') {
        const s = 1 + p * e.maxR;
        e.mesh.scale.set(s, s, 1);
        e.mesh.material.opacity = 0.9 * (1 - p);
      } else if (e.type === 'beacon') {
        e.mesh.material.opacity = 0.42 * (p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8);
      }
    }
    // 海浪時間 + 雷達圈緩轉
    if (this.seaUniforms) this.seaUniforms.uTime.value += dt;
    if (this.radarRings) this.radarRings.rotation.y += dt * 0.02;
    // hover 拾取
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = [];
    for (const c of this.counties.values()) meshes.push(...c.meshes);
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    this.hovered = hit ? hit.object.userData.county : null;

    // 標籤定位
    for (const [name, el] of this.labelLayer) {
      if (el.classList.contains('hidden')) continue;
      const c = this.counties.get(name);
      const [sx, sy, sz] = this.toScreen(c.centroid[0], c.current.h + 0.4, c.centroid[1]);
      if (sz > 1) { el.style.opacity = 0; continue; }
      el.style.opacity = '';
      el.style.left = sx + 'px';
      el.style.top = sy + 'px';
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
