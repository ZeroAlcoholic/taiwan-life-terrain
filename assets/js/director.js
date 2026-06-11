// ═══ director.js — 播放引擎:章節調度、自動運鏡、時間軸 ═══
import * as THREE from 'three';

const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export class Director {
  constructor(stage, hud, chapters) {
    this.stage = stage;
    this.hud = hud;
    this.chapters = chapters;
    this.total = chapters.reduce((s, c) => s + c.dur, 0);
    let acc = 0;
    for (const c of chapters) { c.t0 = acc; acc += c.dur; }
    this.t = 0;
    this.playing = false;
    this.autoCam = true;
    this.activeChapter = null;
    this.speed = 1;
    this._camPos = new THREE.Vector3();
    this._camTgt = new THREE.Vector3();
  }

  chapterAt(t) {
    for (let i = this.chapters.length - 1; i >= 0; i--)
      if (t >= this.chapters[i].t0 - 1e-6) return this.chapters[i];
    return this.chapters[0];
  }

  play() { this.playing = true; this.hud.setPlaying(true); }
  pause() { this.playing = false; this.hud.setPlaying(false); }
  toggle() { this.playing ? this.pause() : this.play(); }

  seek(t, { hard = false } = {}) {
    this.t = Math.max(0, Math.min(this.total - 0.001, t));
    const ch = this.chapterAt(this.t);
    // 時間點之前的 cue 視為已觸發(避免連環補放),之後的重新武裝
    for (const c of this.chapters) for (const cue of (c.cues || []))
      cue._fired = (c.t0 + cue.at) < this.t;
    if (ch !== this.activeChapter || hard) this._enterChapter(ch, hard);
    // 立即套用最後一個已過的字卡 cue
    let lastCap = null;
    for (const cue of (ch.cues || [])) if (cue.caption && cue.at <= (this.t - ch.t0)) lastCap = cue;
    if (lastCap) this.hud.setCaption(ch, lastCap.caption, { noFlash: true });
  }

  jumpChapter(i) {
    const ch = this.chapters[i];
    if (!ch) return;
    this.seek(ch.t0 + 0.001, { hard: true });
    this.play();
  }

  _enterChapter(ch, hard) {
    this.activeChapter = ch;
    this.stage.clearEffects();
    this.stage.hideAllLabels();
    document.getElementById('titlecard')?.classList.add('hidden'); // 序章 tick 會自行接管
    this.hud.setChapter(ch);
    if (ch.enter) ch.enter(this._ctx());
  }

  _ctx() {
    return { stage: this.stage, hud: this.hud, director: this };
  }

  update(dt) {
    if (this.playing) {
      this.t += dt * this.speed;
      if (this.t >= this.total) { this.t = this.total - 0.001; this.pause(); this.hud.onShowEnd?.(); }
    }
    const ch = this.chapterAt(this.t);
    if (ch !== this.activeChapter) this._enterChapter(ch, false);
    const localT = this.t - ch.t0;
    const p = Math.min(1, localT / ch.dur);

    // cue 觸發
    for (const cue of (ch.cues || [])) {
      if (!cue._fired && localT >= cue.at) {
        cue._fired = true;
        if (cue.caption) this.hud.setCaption(ch, cue.caption);
        if (cue.run) cue.run(this._ctx());
      }
    }

    // 章節 tick(設定地形目標、年份、圖表)
    if (ch.tick) ch.tick(localT, p, this._ctx());

    // 自動運鏡
    const idleMs = performance.now() - (this.stage._lastUserAct || 0);
    if (this.autoCam && idleMs > 4500 && ch.camera && ch.camera.length) {
      this._applyCamera(ch.camera, p, dt);
    }

    this.hud.setProgress(this.t, this.total, ch);
  }

  _applyCamera(track, p, dt) {
    let a = track[0], b = track[track.length - 1];
    for (let i = 0; i < track.length - 1; i++) {
      if (p >= track[i].t && p <= track[i + 1].t) { a = track[i]; b = track[i + 1]; break; }
    }
    const span = Math.max(1e-6, b.t - a.t);
    const lp = a === b ? 1 : easeInOut(Math.min(1, Math.max(0, (p - a.t) / span)));
    this._camPos.fromArray(a.pos).lerp(new THREE.Vector3().fromArray(b.pos), lp);
    this._camTgt.fromArray(a.tgt).lerp(new THREE.Vector3().fromArray(b.tgt), lp);
    // 平滑趨近(避免 seek 跳切太硬)
    const k = 1 - Math.pow(0.002, dt);
    this.stage.camera.position.lerp(this._camPos, k);
    this.stage.controls.target.lerp(this._camTgt, k);
  }
}

// ── 資料插值工具 ──
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

// 色階:依 0..1 在多段色票間取色
export function colorRamp(stops, t) {
  t = Math.max(0, Math.min(1, t));
  const n = stops.length - 1;
  const i = Math.min(n - 1, Math.floor(t * n));
  const f = t * n - i;
  const c1 = new THREE.Color(stops[i]), c2 = new THREE.Color(stops[i + 1]);
  return c1.lerp(c2, f);
}
