// ═══ people/people.js — 開機:載入資料、組裝舞台、綁定控制、主迴圈 ═══
import { Stage } from './scene.js';
import { HUD, fmt, fmt1 } from './hud.js';
import { Director } from './director.js';
import { buildShow } from './script.js';

const $ = id => document.getElementById(id);

// ── 極簡音效(WebAudio 合成,預設關閉) ──
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
  chime() {
    if (!this.on) return;
    const ac = this._ac(), t = ac.currentTime;
    [523.25, 659.25].forEach((f, i) => {
      const o = ac.createOscillator();
      o.type = 'triangle'; o.frequency.value = f;
      this._env(o, t + i * 0.06, 0.01, 1.2, 0.045);
      o.start(t + i * 0.06); o.stop(t + 1.6);
    });
  }
}

const FILES = [
  ['geo', 'data/counties.geojson', true, '縣市界線圖資（內政部國土測繪中心）'],
  ['centroids', 'data/county-centroids.json', true, '縣市中心點'],
  ['population', 'data/population.json', true, '人口統計（內政部戶政司）'],
  ['projection', 'data/projection.json', false, '人口推估（國家發展委員會）'],
  ['income', 'data/income.json', false, '家庭收支調查（行政院主計總處）'],
];

async function loadAll() {
  const list = $('p-load-status');
  const data = {};
  let fatal = false;
  for (const [key, url, required, label] of FILES) {
    const li = document.createElement('li');
    li.className = 'wait'; li.textContent = label;
    list.appendChild(li);
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status);
      data[key] = await r.json();
      li.className = 'ok';
    } catch (e) {
      li.className = 'err';
      li.textContent = label + (required ? ' — 載入失敗（必要）' : ' — 缺少（略過）');
      if (required) fatal = true;
    }
  }
  return { data, fatal };
}

(async function main() {
  const { data, fatal } = await loadAll();
  const btn = $('p-btn-start');
  if (fatal) { btn.textContent = '必要資料缺失'; return; }

  const stage = new Stage($('p-stage'));
  const hud = new HUD();
  const sfx = new SFX();
  stage.buildMap(data.geo, data.centroids);
  stage.buildLabels(document.body);

  const show = buildShow(data, { fmt, fmt1, sfx });
  show.chapters.forEach(c => c._all = show.chapters);
  const director = new Director(stage, hud, show.chapters);

  hud.buildPips(show.chapters, i => { sfx.chime(); hud.hideEnd(); director.jumpChapter(i); });
  hud.buildTicks(show.chapters, director.total);
  hud.bindTimeline(f => { hud.hideEnd(); director.seek(f * director.total); });
  hud.onShowEnd = () => hud.showEnd();

  // 控制
  $('p-btn-play').addEventListener('click', () => { hud.hideEnd(); director.toggle(); });
  const SPEEDS = [1, 1.5, 2];
  $('p-btn-speed').addEventListener('click', e => {
    const i = (SPEEDS.indexOf(director.speed) + 1) % SPEEDS.length;
    director.speed = SPEEDS[i];
    e.currentTarget.textContent = SPEEDS[i] + '×';
    e.currentTarget.classList.toggle('active', SPEEDS[i] !== 1);
  });
  $('p-btn-replay').addEventListener('click', () => { hud.hideEnd(); director.seek(0, { hard: true }); director.play(); });
  $('p-btn-cam').addEventListener('click', e => {
    director.autoCam = !director.autoCam;
    e.currentTarget.classList.toggle('active', director.autoCam);
  });
  $('p-btn-sound').addEventListener('click', e => {
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
  $('p-btn-sources').addEventListener('click', () => {
    $('p-sm-body').innerHTML = show.sourcesHTML;
    $('p-sources-modal').classList.remove('hidden');
  });
  $('p-sm-close').addEventListener('click', () => $('p-sources-modal').classList.add('hidden'));
  $('p-sources-modal').addEventListener('click', e => { if (e.target.id === 'p-sources-modal') e.target.classList.add('hidden'); });

  // 滑鼠位置（面板定位）
  let mouse = { x: innerWidth / 2, y: innerHeight / 2 };
  addEventListener('pointermove', e => { mouse = { x: e.clientX, y: e.clientY }; });

  // 縣市點擊：鎖定面板 + 漣漪
  let pinned = null;
  $('p-stage').addEventListener('click', () => {
    if (stage.hovered) {
      pinned = pinned === stage.hovered ? null : stage.hovered;
      if (pinned) stage.countyRipple(pinned, 0xffd9a0, 6);
    } else pinned = null;
  });

  // 結束畫面重播
  $('p-end-replay')?.addEventListener('click', () => { hud.hideEnd(); director.seek(0, { hard: true }); director.play(); });

  // 啟動
  btn.disabled = false;
  btn.textContent = '開 演';
  btn.addEventListener('click', () => {
    sfx._ac();
    $('p-loader').classList.add('hidden');
    setTimeout(() => $('p-loader').remove(), 1200);
    hud.showAll();
    director.seek(0, { hard: true });
    director.play();
  }, { once: true });

  window.__pdirector = director;

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    director.update(dt);
    stage.update(dt);
    const focus = pinned || stage.hovered;
    if (focus && show.panelRows) {
      hud.showCountyPanel(focus, show.panelRows(focus, director), mouse.x, mouse.y);
    } else hud.hideCountyPanel();
    // 點選鎖定縣市:把同一支 100 人隊伍重塑成「如果這個縣市是 100 個人」(2025 實際,蓋過章節)
    if (pinned && show.countyCohort) {
      const cc = show.countyCohort(pinned);
      stage.showCohort(true); stage.restoreCohort();
      if (stage.hideScratch) stage.hideScratch();
      stage.setCohort({ young: cc.young, work: cc.work, old: cc.old });
      stage.projMode = 0;
      hud.updateLegendValues([cc.young + ' 人', cc.work + ' 人', cc.old + ' 人']);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
