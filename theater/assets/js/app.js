// ═══ app.js — 開機:載入資料、組裝舞台、綁定控制、主迴圈 ═══
import { Stage } from './scene.js';
import { HUD, fmt, fmt1 } from './hud.js';
import { Director } from './director.js';
import { buildShow } from './script.js';

const $ = id => document.getElementById(id);

// ── 極簡音效(WebAudio 合成) ──
class SFX {
  constructor() { this.on = false; this.ctx = null; }
  _ac() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); return this.ctx; }
  enable() { this.on = true; this._ac().resume(); }
  _env(node, t0, a, d, peak = 1) {
    const g = this._ac().createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    node.connect(g).connect(this._ac().destination);
    return g;
  }
  thud() { // 戰報:太鼓
    if (!this.on) return;
    const ac = this._ac(), t = ac.currentTime;
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    this._env(o, t, 0.005, 0.5, 0.22);
    o.start(t); o.stop(t + 0.6);
  }
  chime() { // 章節:鐘
    if (!this.on) return;
    const ac = this._ac(), t = ac.currentTime;
    [523.25, 783.99].forEach((f, i) => {
      const o = ac.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      this._env(o, t + i * 0.07, 0.01, 1.4, 0.055);
      o.start(t + i * 0.07); o.stop(t + 2);
    });
  }
}

// ── 資料載入 ──
const FILES = [
  ['geo',        'data/counties.geojson',       true,  '縣市界線圖資(內政部國土測繪中心)'],
  ['centroids',  'data/county-centroids.json',  true,  '縣市中心點'],
  ['population', 'data/population.json',        true,  '人口統計(內政部戶政司)'],
  ['projection', 'data/projection.json',        false, '人口推估(國家發展委員會)'],
  ['income',     'data/income.json',            false, '家庭收支調查(行政院主計總處)'],
  ['insurance',  'data/insurance.json',         false, '壽險市場統計(壽險公會/保發中心)'],
];

async function loadAll() {
  const list = $('load-status');
  const data = {};
  let fatal = false;
  for (const [key, url, required, label] of FILES) {
    const li = document.createElement('li');
    li.className = 'wait';
    li.textContent = label;
    list.appendChild(li);
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status);
      data[key] = await r.json();
      li.className = 'ok';
    } catch (e) {
      li.className = 'err';
      li.textContent = label + (required ? ' — 載入失敗(必要)' : ' — 缺少(略過)');
      if (required) fatal = true;
    }
  }
  return { data, fatal };
}

// ── 主程式 ──
(async function main() {
  const { data, fatal } = await loadAll();
  const btn = $('btn-start');
  if (fatal) { btn.textContent = '必要資料缺失'; return; }

  const stage = new Stage($('stage'));
  const hud = new HUD();
  const sfx = new SFX();
  stage.buildMap(data.geo, data.centroids);
  stage.buildLabels(document.body);

  const show = buildShow(data, { fmt, fmt1, sfx });
  show.chapters.forEach(c => c._all = show.chapters);
  const director = new Director(stage, hud, show.chapters);

  hud.buildPips(show.chapters, i => { sfx.chime(); director.jumpChapter(i); });
  hud.buildTicks(show.chapters, director.total);
  hud.bindTimeline(f => director.seek(f * director.total));
  hud.onShowEnd = () => {};

  // 控制
  $('btn-play').addEventListener('click', () => director.toggle());
  const SPEEDS = [1, 1.5, 2, 4, 0.25, 0.5];
  $('btn-speed').addEventListener('click', e => {
    const i = (SPEEDS.indexOf(director.speed) + 1) % SPEEDS.length;
    director.speed = SPEEDS[i];
    e.currentTarget.textContent = SPEEDS[i] + '×';
    e.currentTarget.classList.toggle('active', SPEEDS[i] !== 1);
  });
  $('btn-replay').addEventListener('click', () => { director.seek(0, { hard: true }); director.play(); });
  $('btn-cam').addEventListener('click', e => {
    director.autoCam = !director.autoCam;
    e.currentTarget.classList.toggle('active', director.autoCam);
  });
  $('btn-sound').addEventListener('click', e => {
    sfx.on = !sfx.on;
    if (sfx.on) sfx.enable();
    e.currentTarget.classList.toggle('active', sfx.on);
  });
  addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); director.toggle(); }
    if (e.code === 'ArrowRight') director.seek(director.t + 5);
    if (e.code === 'ArrowLeft') director.seek(director.t - 5);
  });

  // 資料來源 modal
  $('btn-sources').addEventListener('click', () => {
    $('sm-body').innerHTML = show.sourcesHTML;
    $('sources-modal').classList.remove('hidden');
  });
  $('sm-close').addEventListener('click', () => $('sources-modal').classList.add('hidden'));
  $('sources-modal').addEventListener('click', e => { if (e.target.id === 'sources-modal') e.target.classList.add('hidden'); });

  // 縣市 hover 情報
  let mouse = { x: 0, y: 0 };
  addEventListener('pointermove', e => { mouse = { x: e.clientX, y: e.clientY }; });

  // 啟動
  btn.disabled = false;
  btn.textContent = '開 演';
  btn.addEventListener('click', () => {
    // 音效預設關閉(♪ 鈕可開啟);先建立 AudioContext 以便之後開啟時免再次互動
    sfx._ac();
    $('loader').classList.add('hidden');
    setTimeout(() => $('loader').remove(), 1300);
    hud.showAll();
    director.seek(0, { hard: true });
    director.play();
  }, { once: true });

  window.__director = director; // 除錯/導覽輔助
  // 主迴圈
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    director.update(dt);
    stage.update(dt);
    // hover 面板
    if (stage.hovered && show.panelRows) {
      hud.showCountyPanel(stage.hovered, show.panelRows(stage.hovered, director), mouse.x, mouse.y);
    } else hud.hideCountyPanel();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
