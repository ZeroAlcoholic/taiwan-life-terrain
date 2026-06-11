// ═══ people/director.js — 生命劇場播放引擎:章節調度、自動運鏡、時間軸 ═══
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
    for (const c of this.chapters) for (const cue of (c.cues || []))
      cue._fired = (c.t0 + cue.at) < this.t;
    if (ch !== this.activeChapter || hard) this._enterChapter(ch, hard);
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
    document.getElementById('p-titlecard')?.classList.add('hidden');
    this.hud.setChapter(ch);
    if (ch.enter) ch.enter(this._ctx());
  }

  _ctx() { return { stage: this.stage, hud: this.hud, director: this }; }

  update(dt) {
    if (this.playing) {
      this.t += dt * this.speed;
      if (this.t >= this.total) { this.t = this.total - 0.001; this.pause(); this.hud.onShowEnd?.(); }
    }
    const ch = this.chapterAt(this.t);
    if (ch !== this.activeChapter) this._enterChapter(ch, false);
    const localT = this.t - ch.t0;
    const p = Math.min(1, localT / ch.dur);

    for (const cue of (ch.cues || [])) {
      if (!cue._fired && localT >= cue.at) {
        cue._fired = true;
        if (cue.caption) this.hud.setCaption(ch, cue.caption);
        if (cue.run) cue.run(this._ctx());
      }
    }

    if (ch.tick) ch.tick(localT, p, this._ctx());

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
    const k = 1 - Math.pow(0.0025, dt);
    this.stage.camera.position.lerp(this._camPos, k);
    this.stage.controls.target.lerp(this._camTgt, k);
  }
}
