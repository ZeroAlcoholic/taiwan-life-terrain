// ═══ people/hud.js — 介面層:年份/章節/字卡/世代圖例/縣市面板/時間軸 ═══

const $ = id => document.getElementById(id);
export const fmt = n => n == null ? '—' : Math.round(n).toLocaleString('en-US');
export const fmt1 = n => n == null ? '—' : (Math.round(n * 10) / 10).toLocaleString('en-US');
export const fmtWan = n => n == null ? '—' : Math.round(n / 10000).toLocaleString('en-US') + ' 萬';

const toEra = y => `民國 ${y - 1911} 年`;

export class HUD {
  constructor() {
    this.els = {
      top: $('p-hud-top'), chNo: $('p-chapter-no'), chName: $('p-chapter-name'),
      yearWrap: $('p-year-display'), yearNum: $('p-year-num'), yearEra: $('p-year-era'),
      badge: $('p-data-badge'), src: $('p-year-src'), sub: $('p-year-sub'),
      capWrap: $('p-caption'), capCh: $('p-cap-chapter'), capTitle: $('p-cap-title'),
      capBody: $('p-cap-body'), capStat: $('p-cap-stat'), capHint: $('p-cap-hint'),
      legendWrap: $('p-legend'), legTitle: $('p-legend-title'), legBars: $('p-legend-bars'),
      stackCanvas: $('p-stack'), stackCap: $('p-stack-caption'),
      panel: $('p-county-panel'), panelName: $('p-cp-name'), panelRows: $('p-cp-rows'),
      bottom: $('p-hud-bottom'), pips: $('p-pips'),
      tlFill: $('p-tl-fill'), tlCursor: $('p-tl-cursor'), ticks: $('p-tl-ticks'),
      btnPlay: $('p-btn-play'),
      end: $('p-end'),
    };
    this._sctx = this.els.stackCanvas?.getContext('2d');
  }

  showAll() {
    ['top', 'yearWrap', 'capWrap', 'legendWrap', 'bottom'].forEach(k => this.els[k]?.classList.remove('hidden'));
  }

  setPlaying(on) { if (this.els.btnPlay) this.els.btnPlay.textContent = on ? '❚❚' : '▶'; }

  setChapter(ch) {
    this.els.chNo.textContent = ch.no;
    this.els.chName.textContent = ch.name;
  }

  setYear(year, { mode = 'actual', src = '' } = {}) {
    const y = Math.round(year);
    this.els.yearNum.textContent = y;
    this.els.yearEra.textContent = toEra(y);
    const b = this.els.badge;
    b.className = 'p-badge ' + (mode === 'proj' ? 'b-proj' : 'b-actual');
    b.textContent = mode === 'proj' ? '官方推估' : '實際資料';
    if (src) this.els.src.textContent = src;
  }

  setSub(text) { if (this.els.sub) this.els.sub.textContent = text || ''; }

  setCaption(ch, cap, { noFlash = false } = {}) {
    if (!cap) return;
    const w = this.els.capWrap;
    this.els.capCh.textContent = ch.no + '・' + ch.name;
    this.els.capTitle.textContent = cap.title || '';
    this.els.capBody.innerHTML = cap.body || '';
    this.els.capStat.innerHTML = cap.stat || '';
    this.els.capStat.classList.toggle('hidden', !cap.stat);
    if (cap.hint) { this.els.capHint.textContent = cap.hint; this.els.capHint.classList.remove('hidden'); }
    else this.els.capHint.classList.add('hidden');
    if (!noFlash) { w.classList.remove('flash'); void w.offsetWidth; w.classList.add('flash'); }
  }

  // 世代圖例（固定編碼）
  setLegend(title, items) {
    this.els.legTitle.textContent = title;
    this.els.legBars.innerHTML = items.map(it =>
      `<div class="p-leg-row"><span class="p-leg-dot" style="background:${it.color}"></span><span class="p-leg-k">${it.k}</span><b class="p-leg-v">${it.v ?? ''}</b></div>`
    ).join('');
  }
  updateLegendValues(vals) {
    const bs = this.els.legBars.querySelectorAll('.p-leg-v');
    vals.forEach((v, i) => { if (bs[i]) bs[i].textContent = v; });
  }

  // 三段年齡堆疊面積圖（含實際/推估分界線）
  drawStack(bands, year, caption, splitYear) {
    const cv = this.els.stackCanvas, ctx = this._sctx;
    if (!ctx) return;
    const W = cv.width, H = cv.height, pad = 4;
    ctx.clearRect(0, 0, W, H);
    const ys = bands.years, n = ys.length;
    const x = i => pad + (W - 2 * pad) * (i / (n - 1));
    const yy = v => H - pad - (H - 2 * pad) * (v / 100);
    const layers = [
      { arr: bands.young, col: '#7fd9a6' },
      { arr: bands.work, col: '#f2c14e' },
      { arr: bands.old, col: '#e8728c' },
    ];
    let base = new Array(n).fill(0);
    for (const L of layers) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) { const v = (L.arr[i] ?? 0) + base[i]; (i ? ctx.lineTo : ctx.moveTo).call(ctx, x(i), yy(v)); }
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(x(i), yy(base[i]));
      ctx.closePath();
      ctx.fillStyle = L.col; ctx.globalAlpha = 0.82; ctx.fill(); ctx.globalAlpha = 1;
      for (let i = 0; i < n; i++) base[i] += (L.arr[i] ?? 0);
    }
    // 實際/推估分界
    if (splitYear) {
      const si = ys.indexOf(splitYear);
      if (si >= 0) {
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x(si), pad); ctx.lineTo(x(si), H - pad); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    // 年份游標
    let ci = 0; for (let i = 0; i < n; i++) if (ys[i] <= year) ci = i;
    const cx = x(ci);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(cx, pad); ctx.lineTo(cx, H - pad); ctx.stroke();
    if (caption) this.els.stackCap.innerHTML = caption;
  }

  // 縣市面板（hover/點擊）
  showCountyPanel(name, rows, mx, my) {
    const p = this.els.panel;
    this.els.panelName.textContent = name;
    this.els.panelRows.innerHTML = rows.map(r =>
      `<div class="p-cp-row"><span>${r.k}</span><b style="color:${r.color || '#fff'}">${r.v}</b></div>`).join('');
    p.classList.remove('hidden');
    const w = p.offsetWidth || 200, h = p.offsetHeight || 120;
    let x = mx + 18, y = my + 18;
    if (x + w > innerWidth - 8) x = mx - w - 18;
    if (y + h > innerHeight - 8) y = my - h - 18;
    p.style.left = Math.max(8, x) + 'px';
    p.style.top = Math.max(8, y) + 'px';
  }
  hideCountyPanel() { this.els.panel.classList.add('hidden'); }

  buildPips(chapters, onJump) {
    this.els.pips.innerHTML = '';
    chapters.forEach((c, i) => {
      const d = document.createElement('button');
      d.className = 'p-pip';
      d.innerHTML = `<span class="p-pip-no">${c.no}</span><span class="p-pip-nm">${c.name}</span>`;
      d.addEventListener('click', () => onJump(i));
      this.els.pips.appendChild(d);
      c._pip = d;
    });
  }
  buildTicks(chapters, total) {
    this.els.ticks.innerHTML = '';
    chapters.forEach(c => {
      const t = document.createElement('div');
      t.className = 'p-tick';
      t.style.left = (c.t0 / total * 100) + '%';
      this.els.ticks.appendChild(t);
    });
  }
  bindTimeline(onSeek) {
    const track = $('p-tl-track');
    const seek = e => {
      const r = track.getBoundingClientRect();
      onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
    };
    let drag = false;
    track.addEventListener('pointerdown', e => { drag = true; seek(e); track.setPointerCapture(e.pointerId); });
    track.addEventListener('pointermove', e => { if (drag) seek(e); });
    track.addEventListener('pointerup', () => { drag = false; });
  }

  setProgress(t, total, ch) {
    const f = t / total;
    this.els.tlFill.style.width = (f * 100) + '%';
    this.els.tlCursor.style.left = (f * 100) + '%';
    for (const c of (ch._all || [])) c._pip?.classList.toggle('active', c === ch);
  }

  showEnd() { this.els.end?.classList.remove('hidden'); }
  hideEnd() { this.els.end?.classList.add('hidden'); }
}
