// ═══ people/script.js — 演出劇本:人口生命劇場「如果臺灣是 100 個人」(約 95 秒) ═══
// 主角是「人」:100 個站在臺灣島上的人形,隨年代重新洗牌。
// 所有數字一律取自 data/*.json(官方公開資料)。
// 實際資料:1990–2025(內政部戶政司);官方推估:2024–2070 中推估(國發會);
// 家庭:主計總處家庭收支調查(實際)。
import { seriesAt } from './geo.js';
import { C_YOUNG, C_WORK, C_OLD } from './scene.js';
import { fmt1, fmtWan } from './hud.js';

export function buildShow(data, util) {
  const sfx = util.sfx;
  const pop = data.population, proj = data.projection, inc = data.income;
  const nat = pop.national;
  const natY0 = nat.years[0], natY1 = nat.years[nat.years.length - 1]; // 1990, 2025
  const projOK = !!proj?.national?.medium;
  const projY1 = projOK ? proj.national.years[proj.national.years.length - 1] : 2070; // 2070

  const natAt = (f, y) => seriesAt(nat.years, nat[f], y);
  const projAt = (f, y) => projOK ? seriesAt(proj.national.years, proj.national.medium[f], y) : null;
  const cAt = (name, f, y) => { const c = pop.counties[name]; return c ? seriesAt(c.years, c[f], y) : null; };

  // 取某年份的三段「人數」(合計湊滿 100):>2025 用官方中推估
  const cohortAt = (year) => {
    const useProj = year > natY1 && projOK;
    let y = useProj ? projAt('pct0_14', year) : natAt('pct0_14', year);
    let o = useProj ? projAt('pct65', year) : natAt('pct65', year);
    let yy = Math.round(y), oo = Math.round(o);
    return { young: yy, old: oo, work: 100 - yy - oo, useProj };
  };

  // 總人口(萬)
  const totalAt = (year) => {
    const useProj = year > natY1 && projOK;
    return useProj ? projAt('total', year) : natAt('total', year);
  };
  // 扶老比(每 100 名青壯扶養之 65+ 人數);實際無序列,用占比推算,推估直接取官方
  const oldDepAt = (year) => {
    if (year > natY1 && projOK) return projAt('oldDependency', year);
    const w = natAt('pct15_64', year), o = natAt('pct65', year);
    return w ? o / w * 100 : null;
  };

  const sweep = (p, y0, y1, ratio = 0.8) => y0 + (y1 - y0) * Math.min(1, p / ratio);

  const legendCohort = (hud) => hud.setLegend('如果臺灣是 100 個人', [
    { color: '#69d6a0', k: '幼年 0–14 歲', v: '' },
    { color: '#f2c14e', k: '青壯 15–64 歲', v: '' },
    { color: '#e8728c', k: '高齡 65+ 歲', v: '' },
  ]);

  // 三段堆疊面積圖資料(1990–2070,實際接官方推估)
  const stackBands = (() => {
    const years = [...nat.years], young = [...nat.pct0_14], work = [...nat.pct15_64], old = [...nat.pct65];
    if (projOK) proj.national.years.forEach((y, i) => {
      if (y <= natY1) return;
      years.push(y);
      young.push(proj.national.medium.pct0_14?.[i] ?? null);
      work.push(proj.national.medium.pct15_64?.[i] ?? null);
      old.push(proj.national.medium.pct65?.[i] ?? null);
    });
    return { years, young, work, old };
  })();
  const STACK_CAP = `世代占比 ${natY0}–${projY1}　<span style="opacity:.6">虛線右為官方推估</span>`;

  const SRC_RIS = '內政部戶政司｜實際資料';
  const SRC_NDC = '國發會 中推估｜官方推估';
  const SRC_DGBAS = '主計總處 家庭收支調查｜實際資料';

  // 每幀:把年份套到人群 + HUD
  const applyYear = (stage, hud, year, { mode, src } = {}) => {
    const c = cohortAt(year);
    stage.setCohort({ young: c.young, work: c.work, old: c.old });
    stage.projMode = mode === 'proj' ? 1 : 0;
    hud.setYear(year, { mode, src });
    hud.updateLegendValues([c.young + ' 人', c.work + ' 人', c.old + ' 人']);
    hud.drawStack(stackBands, year, STACK_CAP, natY1);
    // 副標:總人口 + 扶老比
    const tot = totalAt(year), dep = oldDepAt(year);
    hud.setSub(`總人口 ${fmtWan(tot)}　·　每 100 名青壯扶養 ${fmt1(dep)} 位長者`);
  };

  // 代表縣市(依 2025 65+)
  const C_TAIPEI = '臺北市', C_CHIAYI = '嘉義縣', C_HSINCHU = '新竹縣', C_HSINCHUCITY = '新竹市';

  const chapters = [];

  // ───────── 序幕:集合 ─────────
  chapters.push({
    no: '序', name: '如果臺灣是 100 個人', dur: 12,
    camera: [{ t: 0, pos: [0, 30, 40], tgt: [0.4, 2, 3.2] }, { t: 1, pos: [0, 14, 22], tgt: [0.4, 2.4, 3.2] }],
    enter(ctx) {
      legendCohort(ctx.hud);
      ctx.stage.showCohort(true);
      ctx.stage.restoreCohort();
      ctx.stage.resetCounties();
      document.getElementById('p-titlecard')?.classList.remove('hidden');
    },
    cues: [
      { at: 0.5, caption: {
        title: '把臺灣,縮成一群人',
        body: '想像整座島,只站著 <b>100 個人</b>。<br>他們的<b style="color:#69d6a0">年紀</b>—孩子、青壯、長者—<br>就是這座島的命運。',
        hint: '可拖曳旋轉、滾輪縮放、點選縣市探索' } },
      { at: 6.5, caption: {
        title: '一九九〇年的隊形',
        body: '前排是<b style="color:#69d6a0">孩子</b>、中間是<b style="color:#f2c14e">青壯</b>、<br>後排寥寥幾位<b style="color:#e8728c">長者</b>。<br>這是一支「年輕的隊伍」。',
        stat: '幼年 27 人　·　青壯 67 人　·　高齡 6 人(1990)' } },
    ],
    tick(localT, p, ctx) {
      applyYear(ctx.stage, ctx.hud, natY0, { mode: 'actual', src: SRC_RIS });
      if (localT > 8) document.getElementById('p-titlecard')?.classList.add('hidden');
    },
  });

  // ───────── 第一章:人口紅利 1990→2012 ─────────
  chapters.push({
    no: '一', name: '青壯的高原', dur: 16,
    camera: [{ t: 0, pos: [-12, 13, 20], tgt: [0.4, 2.4, 3.2] }, { t: 1, pos: [11, 12, 19], tgt: [0.4, 2.4, 3.2] }],
    enter(ctx) { legendCohort(ctx.hud); },
    cues: [
      { at: 0.3, caption: {
        title: '人口紅利:撐起一切的中段',
        body: '看著<b style="color:#f2c14e">金色的青壯</b>站滿整片中段。<br>能工作、能繳保費、能照顧老小的人,<br>在這個年代達到最多。',
        stat: '15–64 歲青壯占比在 2012 年達 74.2% 高峰' } },
      { at: 9, caption: {
        title: '但前排已悄悄變少',
        body: '同一時間,<b style="color:#69d6a0">最前排的孩子</b>一個一個退場。<br>1990 有 27 個孩子,2012 只剩 <b>15</b> 個。<br>少子化,從這裡開始。',
        stat: '幼年 0–14 歲:27 人(1990) → 15 人(2012)' } },
    ],
    tick(localT, p, ctx) {
      const year = sweep(p, 1990, 2012);
      applyYear(ctx.stage, ctx.hud, year, { mode: 'actual', src: SRC_RIS });
    },
  });

  // ───────── 第二章:轉折 2012→2025 ─────────
  chapters.push({
    no: '二', name: '隊形重組', dur: 18,
    camera: [{ t: 0, pos: [10, 12, 19], tgt: [0.4, 2.6, 3.2] }, { t: 1, pos: [-6, 16, 17], tgt: [0.4, 2.6, 3.6] }],
    enter(ctx) { legendCohort(ctx.hud); },
    cues: [
      { at: 0.3, caption: {
        title: '後排,正在長高',
        body: '孩子持續退場,<b style="color:#e8728c">後排的長者</b>卻一位位站起、長高。<br>整支隊伍的重心,正從前方移向後方。',
        stat: '65+ 比率:1993 年破 7%　→　2018 年破 14%' } },
      { at: 9.5, caption: {
        title: '二〇二五:每 5 人就有 1 位長者',
        body: '高齡正式越過 <b style="color:#e8728c">20%</b>—100 人裡有 <b>20</b> 位長者,<br>臺灣進入「超高齡社會」。<br>同年新生兒僅 10.8 萬,史上最少。',
        stat: '高齡 20 人　·　幼年 12 人(2025)　·　出生 107,812 人(史上最少)',
        hint: '此後跨入官方推估,人形將轉為幽藍冷光' } },
    ],
    tick(localT, p, ctx) {
      const year = sweep(p, 2012, natY1);
      applyYear(ctx.stage, ctx.hud, year, { mode: 'actual', src: SRC_RIS });
      if (Math.abs(year - 2018) < 0.25) ctx.stage.ringPulse(ctx.stage.figures.position.clone().setY(1.1), C_OLD, 6);
    },
  });

  // ───────── 第三章:縣市差異 ─────────
  chapters.push({
    no: '三', name: '老化的前線', dur: 16,
    camera: [{ t: 0, pos: [-16, 18, 16], tgt: [-2, 2, 2] }, { t: 1, pos: [12, 16, 14], tgt: [3, 2, -4] }],
    enter(ctx) {
      legendCohort(ctx.hud);
      ctx.stage.resetCounties();
    },
    cues: [
      { at: 0.3, caption: {
        title: '老化,不是均勻發生的',
        body: '把人群暫放一旁,看看腳下這座島。<br>有的縣市還年輕、有的已深度高齡—<br>差距,沿著地圖一目了然。',
      },
      run(ctx) {
        // 把最老縣市染玫紅、最年輕縣市染暖綠
        ctx.stage.setCounty(C_TAIPEI, { color: colHex(C_OLD) });
        ctx.stage.setCounty(C_CHIAYI, { color: colHex(C_OLD) });
        ctx.stage.setCounty(C_HSINCHU, { color: colHex(C_YOUNG) });
        ctx.stage.setCounty(C_HSINCHUCITY, { color: colHex(C_YOUNG) });
        ctx.stage.setLabel(C_TAIPEI, fmt1(cAt(C_TAIPEI, 'pct65', natY1)) + '% 老', { hero: true });
        ctx.stage.setLabel(C_CHIAYI, fmt1(cAt(C_CHIAYI, 'pct65', natY1)) + '% 老', { hero: true });
        ctx.stage.setLabel(C_HSINCHU, fmt1(cAt(C_HSINCHU, 'pct65', natY1)) + '% 老', { hero: true });
        ctx.stage.countyRipple(C_CHIAYI, C_OLD, 7);
        ctx.stage.countyRipple(C_HSINCHU, C_YOUNG, 6);
      } },
      { at: 8, caption: {
        title: '最老 vs 最年輕',
        body: `<b style="color:#e8728c">${C_TAIPEI}</b> 與 <b style="color:#e8728c">${C_CHIAYI}</b>:每 4 人就有 1 位長者—全臺最老。<br><b style="color:#69d6a0">${C_HSINCHU}</b>(科技走廊):全臺最年輕。`,
        stat: `${C_TAIPEI} 65+ ${fmt1(cAt(C_TAIPEI, 'pct65', natY1))}%　·　${C_CHIAYI} ${fmt1(cAt(C_CHIAYI, 'pct65', natY1))}%　·　${C_HSINCHU} ${fmt1(cAt(C_HSINCHU, 'pct65', natY1))}%(2025)` },
      run(ctx) { ctx.stage.countyRipple(C_TAIPEI, C_OLD, 6); } },
      { at: 12.5, caption: {
        title: '差的,只是時間',
        body: '今天最年輕的縣市,<br>也走在同一條路上—<br>玫紅,終將沿著前線一路漫開。',
        hint: '點選任一縣市,看它的世代結構' } },
    ],
    tick(localT, p, ctx) {
      ctx.hud.setYear(natY1, { mode: 'actual', src: SRC_RIS });
    },
  });

  // ───────── 第四章:家,越來越小 ─────────
  chapters.push({
    no: '四', name: '家,越來越小', dur: 15,
    camera: [{ t: 0, pos: [0, 9, 16], tgt: [0.4, 1.8, 3.2] }, { t: 1, pos: [-4, 8, 13], tgt: [0.4, 1.6, 3.2] }],
    enter(ctx) {
      legendCohort(ctx.hud);
      ctx.stage.resetCounties();
      ctx.stage.hideAllLabels();
      ctx.stage.hideCohort();   // 讓位給「家庭」特寫
    },
    cues: [
      { at: 0.4, caption: {
        title: '一個「家」,曾經有四個人',
        body: '把鏡頭拉近一個家庭。<br>三十多年前,平均每戶 <b>4.19 人</b>—<br>一家四口,彼此照應。',
        stat: `平均每戶 ${fmt1(inc.nationalTrend.personsPerHH[0])} 人(${inc.nationalTrend.years[0]})` },
      run(ctx) {
        ctx.stage.layoutScratch(inc.nationalTrend.personsPerHH[0], { color: C_WORK, spacing: 1.05, z: 2 });
      } },
      { at: 6.5, caption: {
        title: '如今,只剩不到三個人',
        body: '同樣一個家,現在平均只剩 <b>2.78 人</b>。<br>一個人住的家庭,從 6.5% 升到 <b>15.6%</b>。<br>家裡能互相支撐的手,變少了。',
        stat: `平均每戶 ${fmt1(inc.nationalTrend.personsPerHH.at(-1))} 人　·　單人家庭 ${fmt1(inc.nationalTrend.singlePersonHHpct.at(-1))}%(${inc.meta.year})`,
        hint: '資料:主計總處 家庭收支調查' },
      run(ctx) {
        ctx.stage.layoutScratch(inc.nationalTrend.personsPerHH.at(-1), { color: C_WORK, spacing: 1.05, z: 2 });
      } },
    ],
    tick(localT, p, ctx) {
      ctx.stage.projMode = 0;
      ctx.hud.setYear(inc.meta.year, { mode: 'actual', src: SRC_DGBAS });
      ctx.hud.setSub(`平均每戶 ${fmt1(inc.nationalTrend.personsPerHH.at(-1))} 人　·　單人家庭 ${fmt1(inc.nationalTrend.singlePersonHHpct.at(-1))}%`);
    },
  });

  // ───────── 第五章:誰來撐住一位長者 ─────────
  chapters.push({
    no: '五', name: '誰來撐住一位長者', dur: 14,
    camera: [{ t: 0, pos: [0, 8, 15], tgt: [0.4, 1.8, 3.2] }, { t: 1, pos: [3, 9, 14], tgt: [0.4, 1.8, 3.2] }],
    enter(ctx) {
      legendCohort(ctx.hud);
      ctx.stage.hideCohort();
    },
    cues: [
      { at: 0.4, caption: {
        title: '2025:約 3.4 名青壯撐起 1 位長者',
        body: '把「扶老」具體化:<br><b style="color:#f2c14e">幾位青壯</b>,合力撐住 <b style="color:#e8728c">一位長者</b>。<br>今天,大約 3 到 4 個人分攤這份重量。',
        stat: `扶老比 ${fmt1(oldDepAt(natY1))}(每 100 青壯扶養之長者數,2025)` },
      run(ctx) {
        ctx.stage.supportScene(100 / oldDepAt(natY1)); // ~3.4 青壯 撐 1 長者
      } },
      { at: 7, caption: {
        title: '2070:幾乎 1 人撐 1 人',
        body: '官方推估到 2070,扶老比逼近 <b>100</b>—<br>等於 <b>1 位青壯</b>要撐起 <b style="color:#e8728c">1 位長者</b>。<br>家庭與社會的肩膀,被壓到最緊。',
        stat: `扶老比 ${fmt1(oldDepAt(projY1))}(2070 中推估)`,
        hint: '官方推估｜國發會 中推估' },
      run(ctx) {
        ctx.stage.projMode = 1;
        ctx.stage.supportScene(100 / oldDepAt(projY1)); // ~1 青壯 撐 1 長者
      } },
    ],
    tick(localT, p, ctx) {
      // 高齡那位:在 scratch 群末端用 ripple 強調
      if (localT < 7) { ctx.stage.projMode = 0; ctx.hud.setYear(natY1, { mode: 'actual', src: SRC_RIS }); }
      else { ctx.stage.projMode = 1; ctx.hud.setYear(projY1, { mode: 'proj', src: SRC_NDC }); }
    },
  });

  // ───────── 終章:2070 的隊形 ─────────
  chapters.push({
    no: '終', name: '二〇七〇的隊形', dur: 16,
    camera: [{ t: 0, pos: [-10, 14, 20], tgt: [0.4, 3, 3.2] }, { t: 0.55, pos: [4, 10, 16], tgt: [0.4, 3, 3.2] }, { t: 1, pos: [0, 26, 34], tgt: [0.4, 2.5, 3.2] }],
    enter(ctx) {
      legendCohort(ctx.hud);
      ctx.stage.hideScratch();
      ctx.stage.showCohort(true);
      ctx.stage.restoreCohort();
    },
    cues: [
      { at: 0.3, caption: {
        title: '同一群人,四十年後',
        body: '人形轉為<b style="color:#8aa0c0">幽藍冷光</b>—這是官方推估,不是已發生的事實。<br>前排的綠幾乎消失,後排的玫紅站滿了大半。',
        hint: '官方推估｜國發會 中推估(2024–2070)' } },
      { at: 8.5, caption: {
        title: '二〇七〇:近半是長者',
        body: `100 人裡,有近 <b style="color:#e8728c">47 位</b>長者、僅剩 <b style="color:#69d6a0">7 個</b>孩子。<br>總人口從約 2,330 萬,降到約 <b>1,497 萬</b>。<br>同一座島,同一群人,卻換了一副面孔。`,
        stat: '高齡 47 人　·　幼年 7 人　·　總人口 1,497 萬　·　中位數年齡 62.4 歲(2070 中推估)' } },
    ],
    tick(localT, p, ctx) {
      const year = sweep(p, natY1, projY1, 0.74);
      applyYear(ctx.stage, ctx.hud, year, { mode: 'proj', src: SRC_NDC });
    },
  });

  // ── 縣市面板資料列 ──
  const panelRows = (name) => {
    const old = cAt(name, 'pct65', natY1), young = cAt(name, 'pct0_14', natY1), work = cAt(name, 'pct15_64', natY1);
    const total = cAt(name, 'total', natY1);
    const rows = [
      { k: '總人口(2025)', v: fmtWan(total) },
      { k: '幼年 0–14', v: fmt1(young) + '%', color: '#69d6a0' },
      { k: '青壯 15–64', v: fmt1(work) + '%', color: '#f2c14e' },
      { k: '高齡 65+', v: fmt1(old) + '%', color: '#e8728c' },
    ];
    const ic = inc.counties[name];
    if (ic) rows.push({ k: '平均戶量', v: fmt1(ic.personsPerHH) + ' 人' });
    return rows;
  };

  const sourcesHTML = `
    <div class="sm-block"><b>人口(實際)</b><br>內政部戶政司 人口統計資料,1990–2025(民國 79–114 年)。年齡三分(0–14／15–64／65+)、出生數、死亡數。</div>
    <div class="sm-block"><b>人口推估(官方)</b><br>國家發展委員會《中華民國人口推估(2024–2070)》中推估,2024-10-17 發布。總人口、年齡結構、出生數、扶老比、中位數年齡。</div>
    <div class="sm-block"><b>家庭與所得(實際)</b><br>行政院主計總處 家庭收支調查,${inc.meta.year} 年(民國 ${inc.meta.year - 1911} 年)。平均每戶人數、單人家庭比率。</div>
    <div class="sm-block"><b>圖資</b><br>內政部國土測繪中心 縣市界線。</div>
    <div class="sm-note">本頁「100 個人」之三段人數,直接由官方年齡占比四捨五入而得;>2025 一律採國發會中推估,並以幽藍冷光與「官方推估」徽章明確區分實際與推估。縣市差異採 2025 實際資料。</div>`;

  return { chapters, panelRows, sourcesHTML };

  // helper: 顏色數值 → '#rrggbb'
  function colHex(n) { return '#' + n.toString(16).padStart(6, '0'); }
}
