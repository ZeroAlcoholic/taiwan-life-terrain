// ═══ people/scene.js — 人口生命劇場 3D 舞台(具象人形版) ═══
// 核心視覺語言:把人口「化為一群站在臺灣島上的人」。
//  • 主舞台:一座厚實的 3D 臺灣島(擠出 geojson),作為眾人站立的平臺。
//  • 100 個風格化 3D 人形(THREE.InstancedMesh)排成整齊隊形,
//    依世代上色:幼年 0–14 暖綠 / 青壯 15–64 燈金 / 高齡 65+ 玫紅。
//    人數=四捨五入百分比 →「如果臺灣是 100 個人」。
//  • 時間流動時,instance 逐一改色、年輕者下沉淡出、長者升起放大、青壯變薄,
//    觀眾「親眼看見」世代重新洗牌。
//  • 官方推估(2025+)以半透明/幽藍處理 + 徽章,明確區分實際與推估。
//  • 另設家庭群(戶量縮小)、扶老群(幾個青壯撐住一位長者)、代表縣市小群。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { featureToShapes, project } from './geo.js';

// 世代色(固定編碼)
export const C_YOUNG = 0x69d6a0; // 0–14 暖綠
export const C_WORK  = 0xf2c14e; // 15–64 燈火金
export const C_OLD   = 0xe8728c; // 65+   玫紅
const C_YOUNG_V = new THREE.Color(C_YOUNG);
const C_WORK_V  = new THREE.Color(C_WORK);
const C_OLD_V   = new THREE.Color(C_OLD);
const BAND_COLOR = { young: C_YOUNG_V, work: C_WORK_V, old: C_OLD_V };

const LAND_TOP  = 0x2c2740; // 島面(暖紫灰)
const LAND_SIDE = 0x171320; // 島側壁

export const COHORT_N = 100; // 「如果臺灣是 100 個人」

// 風格化人形:頭(球) + 身(膠囊),合併成單一幾何供 InstancedMesh 使用
function makeFigureGeometry() {
  const parts = [];
  const body = new THREE.CapsuleGeometry(0.26, 0.62, 6, 12);
  body.translate(0, 0.55, 0);
  parts.push(body);
  const head = new THREE.SphereGeometry(0.22, 14, 12);
  head.translate(0, 1.18, 0);
  parts.push(head);
  // 簡易合併(三檔版本不引入 BufferGeometryUtils,手動併入)
  return mergeGeometries(parts);
}

function mergeGeometries(geos) {
  let total = 0;
  for (const g of geos) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const idx = [];
  let vOff = 0;
  for (const g of geos) {
    const p = g.attributes.position.array, nn = g.attributes.normal.array;
    pos.set(p, vOff * 3); nor.set(nn, vOff * 3);
    const gi = g.index ? g.index.array : null;
    if (gi) for (let i = 0; i < gi.length; i++) idx.push(gi[i] + vOff);
    else for (let i = 0; i < g.attributes.position.count; i++) idx.push(i + vOff);
    vOff += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setIndex(idx);
  geos.forEach(g => g.dispose());
  return out;
}

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a14);
    this.scene.fog = new THREE.Fog(0x0a0a14, 70, 230);

    this.camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 700);
    this.camera.position.set(0, 22, 34);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 90;
    this.controls.target.set(0, 2.5, 0);

    this.projMode = 0;       // 0 實際 → 1 官方推估
    this._projK = 0;         // 平滑後的推估程度(影響整體色調與人形透明)

    this._initLights();
    this._initSea();
    this._initFigures();

    this.counties = new Map();
    this.labelLayer = new Map();
    this.effects = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(-9, -9);
    this.hovered = null;
    this._lastUserAct = 0;

    canvas.addEventListener('pointermove', e => {
      this.pointer.x = (e.clientX / innerWidth) * 2 - 1;
      this.pointer.y = -(e.clientY / innerHeight) * 2 + 1;
    });
    ['pointerdown', 'wheel'].forEach(ev =>
      canvas.addEventListener(ev, () => { this._lastUserAct = performance.now(); }));
    canvas.addEventListener('pointerup', () => { this._lastUserAct = performance.now(); });
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  _initLights() {
    this.scene.add(new THREE.HemisphereLight(0x4a3a52, 0x07060c, 0.9));
    const key = new THREE.DirectionalLight(0xffe9c8, 1.7);
    key.position.set(-18, 40, 22);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const c = 26;
    Object.assign(key.shadow.camera, { left: -c, right: c, top: c, bottom: -c, far: 120 });
    key.shadow.bias = -0.0007;
    this.scene.add(key);
    this.keyLight = key;
    const rim = new THREE.DirectionalLight(0xb86a9a, 0.65);
    rim.position.set(28, 16, -26);
    this.scene.add(rim);
  }

  _initSea() {
    this.seaUniforms = {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x070710) },
      uShallow: { value: new THREE.Color(0x14132a) },
      uCrest: { value: new THREE.Color(0x3a3560) },
    };
    const sea = new THREE.Mesh(
      new THREE.CircleGeometry(320, 80),
      new THREE.ShaderMaterial({
        uniforms: this.seaUniforms,
        vertexShader: `varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
        fragmentShader: `
          uniform float uTime; uniform vec3 uDeep,uShallow,uCrest; varying vec2 vP;
          void main(){
            float d=length(vP);
            float w1=sin(d*0.5 - uTime*0.7);
            float w2=sin(vP.x*0.2 + vP.y*0.27 + uTime*0.45);
            float w3=sin(vP.x*0.06 - uTime*0.2)*sin(vP.y*0.05 + uTime*0.16);
            float wave=w1*0.16 + w2*0.2 + w3*0.34;
            vec3 col=mix(uDeep,uShallow,smoothstep(-0.6,0.9,wave));
            col+=uCrest*smoothstep(0.8,1.0,w1*0.5+w2*0.5)*0.16;
            col*=1.0-smoothstep(120.0,300.0,d);
            gl_FragColor=vec4(col,1.0);
          }`,
      })
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.25;
    this.scene.add(sea);
  }

  // ════════════ 人形隊形(核心) ════════════
  // 站位:在臺灣島中部偏南的平地排成整齊網格(10×10)。
  _initFigures() {
    const geo = makeFigureGeometry();
    // 加入全白頂點色屬性 → 啟用 USE_COLOR,讓 InstancedMesh 的 instanceColor
    // 透過內建 <color_fragment> 直接乘入 diffuse(可靠、不依賴 shader patch)。
    const white = new Float32Array(geo.attributes.position.count * 3).fill(1);
    geo.setAttribute('color', new THREE.BufferAttribute(white, 3));

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.5, metalness: 0.06,
      emissive: 0xffffff, emissiveIntensity: 0.45, // 與 vColor 相乘 → 各世代柔光
    });
    // 僅注入:整體透明(推估幽光)+ 讓 emissive 取 instanceColor 而非白色。
    mat.onBeforeCompile = shader => {
      shader.uniforms.uOpacity = this._figU = { value: 1 };
      shader.fragmentShader = 'uniform float uOpacity;\n' + shader.fragmentShader
        .replace('vec3 totalEmissiveRadiance = emissive;',
          'vec3 totalEmissiveRadiance = emissive * vColor;')
        .replace('#include <opaque_fragment>',
          'gl_FragColor = vec4( outgoingLight, diffuseColor.a * uOpacity );');
    };
    mat.customProgramCacheKey = () => 'cohort-fig-v2';
    mat.transparent = true;
    this.figMat = mat;

    const COLS = 10, GAP = 1.05;
    const inst = new THREE.InstancedMesh(geo, mat, COHORT_N);
    inst.castShadow = true;
    inst.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(COHORT_N * 3), 3);
    inst.position.set(0.4, 1.02, 3.2); // 站在島面上(島頂 y≈1)
    this.figures = inst;
    this.figData = [];
    const m = new THREE.Matrix4();
    for (let i = 0; i < COHORT_N; i++) {
      const r = Math.floor(i / COLS), c = i % COLS;
      // 後排(年長)在後、前排在前;x 置中
      const x = (c - (COLS - 1) / 2) * GAP;
      const z = (r - (COLS - 1) / 2) * GAP;
      this.figData.push({
        home: new THREE.Vector3(x, 0, z),
        band: 'work', vis: 1, targetVis: 1,
        scale: 1, targetScale: 1,
        color: new THREE.Color(C_WORK), targetColor: new THREE.Color(C_WORK),
        rot: (Math.random() - 0.5) * 0.5,
        phase: Math.random() * Math.PI * 2, // 站立微擺
        offset: new THREE.Vector3(), targetOffset: new THREE.Vector3(),
      });
      m.makeTranslation(x, 0, z);
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, this.figData[i].color);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.instanceColor.needsUpdate = true;
    inst.visible = false;
    this.scene.add(inst);

    // 隊形底下的柔光圓臺(讓人群「站在舞臺上」)
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(8.2, 64),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(0.4, 1.04, 3.2);
    disc.visible = false;
    this.scene.add(disc);
    this.cohortDisc = disc;
  }

  showCohort(on = true) { this.figures.visible = on; this.cohortDisc.visible = on; }

  // director 設定世代人數(young/work/old 為「人數」,合計=COHORT_N)
  // 由前往後分配:幼年在前、青壯居中、長者在後 → 觀眾看見「前淺後深」的結構。
  setCohort({ young, work, old }) {
    const yy = Math.round(young), oo = Math.round(old);
    let ww = COHORT_N - yy - oo;
    // 防呆
    const bands = [];
    for (let i = 0; i < yy; i++) bands.push('young');
    for (let i = 0; i < ww; i++) bands.push('work');
    for (let i = 0; i < oo; i++) bands.push('old');
    while (bands.length < COHORT_N) bands.push('work');
    bands.length = COHORT_N;
    // 站位順序:前排(z 最小)先放幼年,再青壯,最後長者排在後方
    const order = this.figData.map((_, i) => i)
      .sort((a, b) => this.figData[a].home.z - this.figData[b].home.z
        || this.figData[a].home.x - this.figData[b].home.x);
    order.forEach((idx, k) => {
      const band = bands[k];
      const d = this.figData[idx];
      d.band = band;
      d.targetColor.copy(BAND_COLOR[band]);
      d.targetVis = 1;
      // 長者較高、幼年較矮
      d.targetScale = band === 'old' ? 1.12 : band === 'young' ? 0.72 : 1.0;
      d.targetOffset.set(0, 0, 0);
    });
    this._counts = { young: yy, work: ww, old: oo };
  }

  // 把整群人「攤平/讓位」給某個特寫場景(家庭、扶老)
  hideCohort() { for (const d of this.figData) d.targetVis = 0; }
  restoreCohort() { for (const d of this.figData) d.targetVis = 1; }

  getCounts() { return this._counts || { young: 0, work: 0, old: 0 }; }

  // ════════════ 臺灣島平臺 ════════════
  buildMap(geojson, centroids) {
    const grp = new THREE.Group();
    this.mapGroup = grp;
    const topMat = new THREE.MeshStandardMaterial({ color: LAND_TOP, roughness: 0.7, metalness: 0.12 });
    const sideMat = new THREE.MeshStandardMaterial({ color: LAND_SIDE, roughness: 0.9, metalness: 0.08 });
    for (const f of geojson.features) {
      const name = f.properties.name;
      const shapes = featureToShapes(f);
      if (!shapes.length) continue;
      const geos = shapes.map(s => {
        const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 4 });
        g.rotateX(-Math.PI / 2);
        return g;
      });
      const group = new THREE.Group();
      const meshes = geos.map(g => {
        const m = new THREE.Mesh(g, [topMat.clone(), sideMat]);
        m.castShadow = false; m.receiveShadow = true;
        m.userData.county = name;
        group.add(m);
        return m;
      });
      const edgeMat = new THREE.LineBasicMaterial({ color: 0x6a5a86, transparent: true, opacity: 0.45 });
      shapes.forEach(s => {
        const pts = s.getPoints(6).map(p => new THREE.Vector3(p.x, 1.004, -p.y));
        group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), edgeMat));
      });
      grp.add(group);
      const c = centroids[name] ? project(centroids[name][0], centroids[name][1]) : [0, 0];
      this.counties.set(name, {
        group, meshes, topMat: meshes[0].material[0],
        centroid: c,
        baseColor: new THREE.Color(LAND_TOP),
        targetColor: new THREE.Color(LAND_TOP), curColor: new THREE.Color(LAND_TOP),
      });
    }
    this.scene.add(grp);
  }

  setCounty(name, { color } = {}) {
    const c = this.counties.get(name);
    if (!c) return;
    c.targetColor.set(color !== undefined ? color : LAND_TOP);
  }
  resetCounties() { for (const c of this.counties.values()) c.targetColor.copy(c.baseColor); }

  buildLabels(container) {
    for (const name of this.counties.keys()) {
      const el = document.createElement('div');
      el.className = 'p-label hidden';
      el.innerHTML = `<span class="pl-name">${name}</span><span class="pl-val"></span>`;
      container.appendChild(el);
      this.labelLayer.set(name, el);
    }
  }
  setLabel(name, text, opts = {}) {
    const el = this.labelLayer.get(name);
    if (!el) return;
    if (text == null) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.classList.toggle('hero', !!opts.hero);
    el.querySelector('.pl-val').textContent = text;
  }
  hideAllLabels() { for (const el of this.labelLayer.values()) el.classList.add('hidden'); }

  // ════════════ 場景小群:家庭 / 扶老 ════════════
  // 家庭群:在島前方擺出「一個家」N 人,N=戶量(四捨五入)。
  _ensureScratchGroup() {
    if (this.scratch) return this.scratch;
    const g = new THREE.Group();
    g.position.set(0.4, 1.02, 3.2);
    g.visible = false;
    this.scene.add(g);
    this.scratch = g;
    this.scratchMeshes = [];
    const geo = makeFigureGeometry();
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: C_WORK, emissive: C_WORK, emissiveIntensity: 0.5, roughness: 0.5,
      }));
      m.castShadow = true; m.visible = false;
      g.add(m);
      this.scratchMeshes.push(m);
    }
    return g;
  }

  // 在指定位置擺出 count 個小人,bandColors 為顏色陣列(可選)
  layoutScratch(count, { spacing = 0.95, color = C_WORK, z = 0, scale = 1 } = {}) {
    this._ensureScratchGroup();
    this.scratch.visible = true;
    const n = Math.max(0, Math.min(this.scratchMeshes.length, Math.round(count)));
    this.scratchMeshes.forEach((m, i) => {
      if (i < n) {
        m.visible = true;
        const x = (i - (n - 1) / 2) * spacing;
        m._tx = x; m._tz = z; m._ty = 0; m._ts = scale;
        m.material.color.set(color); m.material.emissive.set(color);
      } else m.visible = false;
    });
    return n;
  }
  hideScratch() { if (this.scratch) this.scratch.visible = false; }

  // 扶老場景:n 位青壯(金)圍站,中央 1 位長者(玫紅、放大)
  supportScene(workersPerElder) {
    this._ensureScratchGroup();
    this.scratch.visible = true;
    const w = Math.max(1, Math.round(workersPerElder));
    const elder = this.scratchMeshes[0];
    elder.visible = true; elder._tx = 0; elder._tz = 1.6; elder._ty = 0; elder._ts = 1.45;
    elder.material.color.set(C_OLD); elder.material.emissive.set(C_OLD);
    const workers = this.scratchMeshes.slice(1);
    const n = Math.min(workers.length, w);
    workers.forEach((m, i) => {
      if (i < n) {
        m.visible = true;
        const x = (i - (n - 1) / 2) * 0.9;
        m._tx = x; m._tz = 3.4; m._ty = 0; m._ts = 0.95;
        m.material.color.set(C_WORK); m.material.emissive.set(C_WORK);
      } else m.visible = false;
    });
    this.ringPulse(new THREE.Vector3(0.4, 1.1, 3.2 + 1.6), C_OLD, 4);
  }

  // ════════════ 特效 ════════════
  ringPulse(pos, color = C_OLD, maxR = 5) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.95, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.copy(pos);
    this.scene.add(m);
    this.effects.push({ mesh: m, t: 0, dur: 1.7, maxR, type: 'ripple' });
  }
  countyRipple(name, color = C_OLD, maxR = 6) {
    const c = this.counties.get(name);
    if (!c) return;
    this.ringPulse(new THREE.Vector3(c.centroid[0], 1.15, c.centroid[1]), color, maxR);
  }
  clearEffects() {
    for (const e of this.effects) { this.scene.remove(e.mesh); e.mesh.geometry.dispose(); e.mesh.material.dispose(); }
    this.effects = [];
  }

  toScreen(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight, v.z];
  }

  update(dt) {
    const k = 1 - Math.pow(0.0016, dt);
    const now = performance.now() * 0.001;

    // 人形隊形更新
    if (this.figures.visible) {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(),
        pos = new THREE.Vector3(), scl = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      let dirty = false, colDirty = false;
      for (let i = 0; i < COHORT_N; i++) {
        const d = this.figData[i];
        d.vis += (d.targetVis - d.vis) * k;
        d.scale += (d.targetScale - d.scale) * k;
        d.offset.lerp(d.targetOffset, k);
        d.color.lerp(d.targetColor, k);
        const s = Math.max(0.0001, d.scale * d.vis);
        const sway = Math.sin(now * 1.2 + d.phase) * 0.04 * d.vis;
        pos.set(d.home.x + d.offset.x, d.home.y + d.offset.y + (1 - d.vis) * -1.4,
                d.home.z + d.offset.z);
        q.setFromAxisAngle(up, d.rot + sway);
        scl.set(s, s, s);
        m.compose(pos, q, scl);
        this.figures.setMatrixAt(i, m);
        this.figures.setColorAt(i, d.color);
        dirty = colDirty = true;
      }
      if (dirty) this.figures.instanceMatrix.needsUpdate = true;
      if (colDirty && this.figures.instanceColor) this.figures.instanceColor.needsUpdate = true;
    }

    // 推估透明度(整體幽光)
    this._projK += ((this.projMode ? 1 : 0) - this._projK) * k;
    if (this._figU) this._figU.value = 1 - this._projK * 0.42;
    this.cohortDisc.material.opacity = (this.figures.visible ? 0.06 : 0) + 0.02 * Math.sin(now * 1.5);

    // scratch 群平滑
    if (this.scratch?.visible) {
      for (const mh of this.scratchMeshes) {
        if (!mh.visible) continue;
        mh.position.x += ((mh._tx ?? 0) - mh.position.x) * k;
        mh.position.z += ((mh._tz ?? 0) - mh.position.z) * k;
        mh.position.y += ((mh._ty ?? 0) - mh.position.y) * k;
        const ts = mh._ts ?? 1;
        mh.scale.x += (ts - mh.scale.x) * k; mh.scale.y = mh.scale.z = mh.scale.x;
      }
    }

    // 縣市平臺染色
    for (const c of this.counties.values()) {
      c.curColor.lerp(c.targetColor, k);
      c.topMat.color.copy(c.curColor);
    }

    // 背景幽藍偏移
    const targetBg = new THREE.Color(0x0a0a14).lerp(new THREE.Color(0x0c1124), this._projK);
    this.scene.background.lerp(targetBg, k);
    this.scene.fog.color.copy(this.scene.background);

    // 特效
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      const p = e.t / e.dur;
      if (p >= 1) { this.scene.remove(e.mesh); e.mesh.geometry.dispose(); e.mesh.material.dispose(); this.effects.splice(i, 1); continue; }
      const s = 1 + p * e.maxR;
      e.mesh.scale.set(s, s, 1);
      e.mesh.material.opacity = 0.9 * (1 - p);
    }

    if (this.seaUniforms) this.seaUniforms.uTime.value += dt;

    // hover 偵測(縣市平臺)
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = [];
    for (const c of this.counties.values()) meshes.push(...c.meshes);
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    this.hovered = hit ? hit.object.userData.county : null;

    // 浮動標籤定位
    for (const [name, el] of this.labelLayer) {
      if (el.classList.contains('hidden')) continue;
      const c = this.counties.get(name);
      const [sx, sy, sz] = this.toScreen(c.centroid[0], 1.6, c.centroid[1]);
      if (sz > 1) { el.style.opacity = 0; continue; }
      el.style.opacity = '';
      el.style.left = sx + 'px';
      el.style.top = sy + 'px';
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
