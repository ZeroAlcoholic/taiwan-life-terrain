// ═══ hud.js — DOM 介面:字卡、年份、戰報、時間軸、圖例、迷你圖、縣市面板 ═══
const $ = id => document.getElementById(id);
const ERA = y => `民國 ${y - 1911} 年`;
export const fmt = n => n == null ? '—' : Math.round(n).toLocaleString('zh-Hant-TW');
export const fmt1 = n => n == null ? '—' : (Math.round(n * 10) / 10).toFixed(1);
export const fmtWan = n => n == null ? '—' : (n / 10000).toFixed(0) + ' 萬';

const BADGES = {
  actual: ['badge badge-actual', '實際資料'],
  proj:   ['badge badge-proj',   '官方推估'],
  sim:    ['badge badge-sim',    '情境推演'],
  mixed:  ['badge badge-proj',   '實際+推估'],
};

export class HUD {
  constructor() {
    this.el = {
      top: $('hud-top'), bottom: $('hud-bottom'), year: $('year-display'),
      caption: $('caption-box'), legend: $('legend-box'),
      yearNum: $('year-num'), yearEra: $('year-era'), badge: $('data-badge'),
      chNo: $('chapter-no'), chName: $('chapter-name'),
      capCh: $('caption-chapter'), capTitle: $('caption-title'), capBody: $('caption-body'), capStat: $('caption-stat'), capHint: $('caption-hint'),
      eventCard: $('event-card'), ecYear: $('ec-year'), ecText: $('ec-text'),
      pips: $('chapter-pips'), tlTrack: $('tl-track'), tlFill: $('tl-fill'), tlCursor: $('tl-cursor'), tlTicks: $('tl-ticks'),
      legendTitle: $('legend-title'), legendScale: $('legend-scale'), legendLabels: $('legend-labels'),
      chart: $('minichart'), chartCap: $('minichart-caption'),
      panel: $('county-panel'), cpName: $('cp-name'), cpRows: $('cp-rows'),
      btnPlay: $('btn-play'),
      yearSrc: $('year-src'), chipY: $('chip-young'), chipW: $('chip-work'), chipO: $('chip-old'),
      shock: $('shockwave'), modeWash: $('mode-wash'),
      ekH: $('ek-h'), ekC: $('ek-c'), ekHDot: $('ek-h-dot'), ekHVal: $('ek-h-val'), ekCDot: $('ek-c-dot'), ekCVal: $('ek-c-val'),
    };
    this._enc = {};
    this.chartCtx = this.el.chart.getContext('2d');
    this._eventTimer = null;
    this._lastYearShown = null;
  }

  showAll() {
    ['top', 'bottom', 'year', 'caption', 'legend'].forEach(k => this.el[k].classList.remove('hidden'));
  }

  buildPips(chapters, onJump) {
    this.el.pips.innerHTML = '';
    chapters.forEach((ch, i) => {
      const b = document.createElement('button');
      b.className = 'pip';
      b.textContent = `${ch.no}・${ch.name}`;
      b.addEventListener('click', () => onJump(i));
      this.el.pips.appendChild(b);
      ch._pip = b;
    });
  }

  bindTimeline(onSeek) {
    const seek = e => {
      const r = this.el.tlTrack.getBoundingClientRect();
      onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
    };
    let drag = false;
    this.el.tlTrack.addEventListener('pointerdown', e => { drag = true; seek(e); });
    addEventListener('pointermove', e => drag && seek(e));
    addEventListener('pointerup', () => drag = false);
  }

  setPlaying(b) { this.el.btnPlay.textContent = b ? '⏸' : '▶'; }

  setChapter(ch) {
    this.el.chNo.textContent = ch.no;
    this.el.chName.textContent = ch.name;
    for (const c of ch._all || []) c._pip?.classList.toggle('active', c === ch);
  }

  setCaption(ch, cap, { noFlash = false } = {}) {
    this.el.capCh.textContent = `${ch.no}・${ch.name}`;
    this.el.capTitle.textContent = cap.title || '';
    this.el.capBody.innerHTML = cap.body || '';
    this.el.capStat.innerHTML = cap.stat || '';
    this.el.capHint.innerHTML = cap.hint || '';
    this.el.capHint.classList.toggle('hidden', !cap.hint);
    if (!noFlash) {
      this.el.caption.classList.remove('flash');
      void this.el.caption.offsetWidth;
      this.el.caption.classList.add('flash');
    }
  }

  setYear(y, badge) {
    const yi = Math.floor(y);
    if (yi !== this._lastYearShown) {
      this._lastYearShown = yi;
      this.el.yearNum.textContent = yi;
      this.el.yearEra.textContent = ERA(yi);
    }
    if (badge && badge !== this._badge) {
      this._badge = badge;
      const [cls, txt] = BADGES[badge] || BADGES.actual;
      this.el.badge.className = cls;
      this.el.badge.textContent = txt;
    }
  }

  setSource(text) {
    if (text !== this._src) { this._src = text; this.el.yearSrc.textContent = text; }
  }

  // 三段年齡讀數(百分比,0-100)
  setAgeChips(y, w, o) {
    this.el.chipY.textContent = y == null ? '—' : fmt1(y) + '%';
    this.el.chipW.textContent = w == null ? '—' : fmt1(w) + '%';
    this.el.chipO.textContent = o == null ? '—' : fmt1(o) + '%';
  }
  swellChip(which) { // 'young'|'work'|'old'
    const el = { young: this.el.chipY, work: this.el.chipW, old: this.el.chipO }[which]?.closest('.chip');
    if (!el) return;
    el.classList.remove('swell'); void el.offsetWidth; el.classList.add('swell');
  }

  shock() {
    const s = this.el.shock;
    s.classList.remove('go'); void s.offsetWidth; s.classList.add('go');
  }

  // 全圖光掃:意義轉場用。color=光色;strong=高度意義翻轉(較劇烈)
  wash(color, strong = false) {
    const w = this.el.modeWash;
    if (color) w.style.setProperty('--wash', color);
    w.classList.remove('go', 'go-strong'); void w.offsetWidth;
    w.classList.add(strong ? 'go-strong' : 'go');
  }

  // 讀法鍵:hKind 'pop'|'money';cColor=顏色軸代表色。只有「改變的軸」會閃動
  setEncoding({ hLabel, hKind, cLabel, cColor }) {
    const prev = this._enc;
    this.el.ekHVal.textContent = hLabel;
    this.el.ekCVal.textContent = cLabel;
    this.el.ekHDot.style.color = hKind === 'money' ? '#f0d878' : '#6fa8c0';
    if (cColor) this.el.ekCDot.style.color = cColor;
    const flash = el => { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); };
    if (prev.hKind !== undefined && prev.hKind !== hKind) flash(this.el.ekH);
    if (prev.cLabel !== undefined && prev.cLabel !== cLabel) flash(this.el.ekC);
    this._enc = { hLabel, hKind, cLabel, cColor };
  }

  // ── 三段年齡「堆疊帶狀圖」:少子化(下帶縮)與高齡化(上帶漲)一眼可見 ──
  // bands: {years, young[], work[], old[]};divideYear 之後以斜紋虛化表示推估
  drawStack(bands, cursorYear, caption, divideYear) {
    const ctx = this.chartCtx, W = this.el.chart.width, H = this.el.chart.height;
    ctx.clearRect(0, 0, W, H);
    const { years } = bands;
    const xmin = years[0], xmax = years[years.length - 1];
    const pad = { l: 6, r: 6, t: 8, b: 16 };
    const X = y => pad.l + (y - xmin) / (xmax - xmin) * (W - pad.l - pad.r);
    const Y = v => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
    const colors = { old: 'rgba(217,51,63,.78)', work: 'rgba(201,162,39,.55)', young: 'rgba(74,163,162,.6)' };
    // 由下而上:0-14 → 15-64 → 65+(老年壓在最上,視覺上「下沉的天花板」)
    const stacks = years.map((yr, i) => {
      const y0 = bands.young[i] ?? 0, y1 = bands.work[i] ?? 0, y2 = bands.old[i] ?? 0;
      return [y0, y0 + y1, y0 + y1 + y2];
    });
    const drawBand = (lowIdx, highIdx, color) => {
      ctx.beginPath();
      years.forEach((yr, i) => { const v = lowIdx < 0 ? 0 : stacks[i][lowIdx]; i ? ctx.lineTo(X(yr), Y(v)) : ctx.moveTo(X(yr), Y(v)); });
      for (let i = years.length - 1; i >= 0; i--) ctx.lineTo(X(years[i]), Y(stacks[i][highIdx]));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    drawBand(-1, 0, colors.young);
    drawBand(0, 1, colors.work);
    drawBand(1, 2, colors.old);
    // 實際/推估分界
    if (divideYear != null && divideYear > xmin && divideYear < xmax) {
      const dx = X(divideYear);
      ctx.fillStyle = 'rgba(5,11,19,.42)';
      ctx.fillRect(dx, pad.t, W - pad.r - dx, H - pad.t - pad.b); // 推估區壓暗
      ctx.strokeStyle = 'rgba(127,212,210,.9)'; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(dx, pad.t - 2); ctx.lineTo(dx, H - pad.b); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#7fd4d2'; ctx.font = '8.5px IBM Plex Mono';
      ctx.fillText('推估→', dx + 3, pad.t + 8);
    }
    // 游標
    if (cursorYear != null && cursorYear >= xmin && cursorYear <= xmax) {
      const x = X(cursorYear);
      ctx.strokeStyle = 'rgba(240,216,120,.95)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x, pad.t - 4); ctx.lineTo(x, H - pad.b); ctx.stroke();
    }
    ctx.fillStyle = '#566069'; ctx.font = '9px IBM Plex Mono';
    ctx.fillText(xmin, pad.l, H - 4);
    ctx.fillText(xmax, W - pad.r - 24, H - 4);
    this.el.chartCap.innerHTML = caption || '';
  }

  // ── 戶量人形圖:一戶幾口人,直接畫出來 ──
  drawHousehold(persons, year, label) {
    const ctx = this.chartCtx, W = this.el.chart.width, H = this.el.chart.height;
    ctx.clearRect(0, 0, W, H);
    const maxP = 5, n = Math.min(maxP, persons);
    const slot = W / (maxP + 0.5), cy = H * 0.52, r = 11;
    for (let i = 0; i < maxP; i++) {
      const frac = Math.max(0, Math.min(1, n - i)); // 第 i 個人形的存在比例
      const cx = slot * (i + 0.75);
      ctx.save();
      ctx.globalAlpha = frac > 0 ? 0.25 + 0.75 * frac : 0.1;
      const col = frac > 0.02 ? '#f0d878' : '#3a4148';
      // 頭
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(cx, cy - r * 1.6, r * 0.62, 0, Math.PI * 2); ctx.fill();
      // 身體(圓角扇形)
      ctx.beginPath();
      ctx.moveTo(cx - r, cy + r * 1.5);
      ctx.quadraticCurveTo(cx, cy - r * 0.9, cx + r, cy + r * 1.5);
      ctx.closePath(); ctx.fill();
      // 部分人形:右側裁切顯示「0.x 人」
      if (frac > 0.02 && frac < 0.98) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#000';
        ctx.fillRect(cx - r * 1.2 + frac * r * 2.4, cy - r * 2.6, r * 2.6, r * 4.4);
      }
      ctx.restore();
    }
    ctx.fillStyle = '#f0d878'; ctx.font = '700 22px IBM Plex Mono'; ctx.textAlign = 'right';
    ctx.fillText(persons.toFixed(2), W - 8, 30);
    ctx.fillStyle = '#b8ae96'; ctx.font = '10px IBM Plex Mono';
    ctx.fillText('人/戶', W - 8, 44);
    ctx.textAlign = 'left';
    this.el.chartCap.innerHTML = label || '';
  }

  event(year, text) {
    this.el.ecYear.textContent = year;
    this.el.ecText.textContent = text;
    const ec = this.el.eventCard;
    ec.classList.remove('hidden', 'show');
    void ec.offsetWidth;
    ec.classList.add('show');
    clearTimeout(this._eventTimer);
    this._eventTimer = setTimeout(() => ec.classList.add('hidden'), 4200);
  }

  setProgress(t, total, ch) {
    const p = (t / total) * 100;
    this.el.tlFill.style.width = p + '%';
    this.el.tlCursor.style.left = p + '%';
  }

  buildTicks(chapters, total) {
    this.el.tlTicks.innerHTML = chapters.map(c => `<span>${c.name}</span>`).join('');
  }

  setLegend(title, stops, labels) {
    this.el.legendTitle.textContent = title;
    this.el.legendScale.style.background = `linear-gradient(90deg, ${stops.join(',')})`;
    this.el.legendLabels.innerHTML = labels.map(l => `<span>${l}</span>`).join('');
  }

  // ── 迷你折線圖:series = [{years, values, color, dash, label}] , cursor = 年 ──
  drawChart(series, cursorYear, caption, yRange) {
    const ctx = this.chartCtx, W = this.el.chart.width, H = this.el.chart.height;
    ctx.clearRect(0, 0, W, H);
    if (!series.length) return;
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const s of series) {
      xmin = Math.min(xmin, s.years[0]); xmax = Math.max(xmax, s.years[s.years.length - 1]);
      for (const v of s.values) if (v != null) { ymin = Math.min(ymin, v); ymax = Math.max(ymax, v); }
    }
    if (yRange) { ymin = yRange[0]; ymax = yRange[1]; }
    const pad = { l: 6, r: 6, t: 10, b: 16 };
    const X = y => pad.l + (y - xmin) / (xmax - xmin) * (W - pad.l - pad.r);
    const Y = v => pad.t + (1 - (v - ymin) / ((ymax - ymin) || 1)) * (H - pad.t - pad.b);
    // 軸
    ctx.strokeStyle = '#2a3138'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, H - pad.b); ctx.lineTo(W - pad.r, H - pad.b); ctx.stroke();
    ctx.fillStyle = '#566069'; ctx.font = '9px IBM Plex Mono';
    ctx.fillText(xmin, pad.l, H - 4);
    ctx.fillText(xmax, W - pad.r - 24, H - 4);
    // 線
    for (const s of series) {
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 1.6;
      ctx.setLineDash(s.dash ? [4, 4] : []);
      ctx.beginPath();
      let started = false;
      s.years.forEach((yr, i) => {
        const v = s.values[i];
        if (v == null) return;
        const x = X(yr), y = Y(v);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // 游標
    if (cursorYear != null && cursorYear >= xmin && cursorYear <= xmax) {
      const x = X(cursorYear);
      ctx.strokeStyle = 'rgba(240,216,120,.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, pad.t - 4); ctx.lineTo(x, H - pad.b); ctx.stroke();
    }
    this.el.chartCap.innerHTML = caption || '';
  }

  // ── 縣市情報 ──
  showCountyPanel(name, rows, x, y) {
    this.el.cpName.textContent = name;
    this.el.cpRows.innerHTML = rows.map(([k, v]) => `<div class="cp-row"><span>${k}</span><span>${v}</span></div>`).join('');
    const p = this.el.panel;
    p.classList.remove('hidden');
    const pw = 250, ph = 170;
    p.style.left = Math.min(innerWidth - pw - 12, x + 18) + 'px';
    p.style.top = Math.min(innerHeight - ph - 12, y + 12) + 'px';
  }
  hideCountyPanel() { this.el.panel.classList.add('hidden'); }
}
