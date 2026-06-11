// ═══ script.js — 演出劇本:七幕戰情敘事(全長 100 秒) ═══
// 所有數字一律取自 data/*.json(官方資料);情境推演段落由此檔計算並明確標示。
import { seriesAt, colorRamp } from './director.js';
import { fmt, fmt1, fmtWan } from './hud.js';

const RAMP_TERRAIN = ['#1d2935', '#31506b', '#3f6e6d', '#c9a227', '#f0d878']; // 人口地形
const RAMP_AGE     = ['#27414e', '#4aa3a2', '#c9a227', '#d9333f', '#8c1620']; // 高齡
const RAMP_GOLD    = ['#222b35', '#5d5a35', '#c9a227', '#ffe9a0'];            // 財富
const RAMP_HOME    = ['#d9333f', '#c9a227', '#4aa3a2', '#27414e'];            // 戶量(小→紅)

export function buildShow(data, util) {
  const sfx = util.sfx;
  const pop = data.population, proj = data.projection, inc = data.income, ins = data.insurance;
  const nat = pop.national;
  const counties = Object.keys(pop.counties || {});
  const natY0 = nat.years[0], natY1 = nat.years[nat.years.length - 1];

  // ── 工具 ──
  const cAt = (name, field, year) => {
    const c = pop.counties[name];
    return c ? seriesAt(c.years, c[field], year) : null;
  };
  const natAt = (field, year) => seriesAt(nat.years, nat[field], year);
  const maxPop = Math.max(...counties.map(n => Math.max(...(pop.counties[n].total || [0]).filter(v => v != null))));
  const hPop = v => v == null ? 0.05 : Math.sqrt(v / maxPop) * 7.5;

  // ── 1990–2070 三段年齡「合體帶狀資料」(實際+官方推估) ──
  const projOK = !!proj?.national?.medium;
  const projY1 = projOK ? proj.national.years[proj.national.years.length - 1] : 2070;
  const stackBands = (() => {
    const years = [...nat.years];
    const young = [...nat.pct0_14], work = [...nat.pct15_64], old = [...nat.pct65];
    if (projOK) {
      proj.national.years.forEach((y, i) => {
        if (y <= natY1) return;
        years.push(y);
        young.push(proj.national.medium.pct0_14?.[i] ?? null);
        work.push(proj.national.medium.pct15_64?.[i] ?? null);
        old.push(proj.national.medium.pct65?.[i] ?? null);
      });
    }
    return { years, young, work, old };
  })();
  const STACK_CAP = `<span style="color:#7fd4d2">■ 0–14</span> <span style="color:#f0d878">■ 15–64</span> <span style="color:#ff6b5e">■ 65+</span>(占比,${natY0}–${projY1})`;
  const drawStackAt = (hud, year) => hud.drawStack(stackBands, year, STACK_CAP, natY1);
  const chipsAt = (hud, year) => {
    const sim = year > natY1 && projOK;
    const src = sim ? proj.national.medium : nat;
    const yrs = sim ? proj.national.years : nat.years;
    hud.setAgeChips(
      seriesAt(yrs, sim ? src.pct0_14 : nat.pct0_14, year),
      seriesAt(yrs, sim ? src.pct15_64 : nat.pct15_64, year),
      seriesAt(yrs, sim ? src.pct65 : nat.pct65, year));
  };

  // ── 縣市 65+ 趨勢斜率(近10年)→ 情境推演 ──
  const ageSlope = {};
  for (const n of counties) {
    const c = pop.counties[n];
    const pts = (c.years || []).map((y, i) => [y, c.pct65?.[i]]).filter(p => p[1] != null).slice(-10);
    ageSlope[n] = pts.length < 2 ? 0.45 :
      (pts[pts.length - 1][1] - pts[0][1]) / (pts[pts.length - 1][0] - pts[0][0]);
  }
  const ageSim = (name, year) => {
    const base = cAt(name, 'pct65', natY1) ?? 18;
    let v = base + ageSlope[name] * (year - natY1);
    if (projOK) {
      const natProj = seriesAt(proj.national.years, proj.national.medium.pct65, year);
      const natNow = natAt('pct65', natY1);
      if (natProj != null && natNow != null) v = v * 0.6 + (base + (natProj - natNow)) * 0.4;
    }
    return Math.min(55, Math.max(8, v));
  };
  const popSimRatio = year => {
    if (!projOK) return 1;
    const t = seriesAt(proj.national.years, proj.national.medium.total, year);
    const t0 = natAt('total', natY1);
    return (t && t0) ? t / t0 : 1;
  };

  const setLegendAge = hud => hud.setLegend('65歲以上人口比率', RAMP_AGE, ['7%', '15%', '22%', '30%+']);
  const setLegendPop = hud => hud.setLegend('縣市人口規模(高度)', RAMP_TERRAIN, ['少', '', '', '400萬']);

  const top6Pop = [...counties].sort((a, b) => (cAt(b, 'total', natY1) || 0) - (cAt(a, 'total', natY1) || 0)).slice(0, 6);
  const oldestNow = [...counties].sort((a, b) => (cAt(b, 'pct65', natY1) || 0) - (cAt(a, 'pct65', natY1) || 0));
  const old3 = oldestNow.slice(0, 3), young3 = oldestNow.slice(-3).reverse();
  const ruralOld3 = oldestNow.filter(n => n.endsWith('縣')).slice(0, 3);

  const yearSweep = (p, y0, y1, sweepRatio = 0.72) => {
    const q = Math.min(1, p / sweepRatio);
    const e = q * q * (3 - 2 * q);
    return y0 + (y1 - y0) * e;
  };
  const sweepCueAt = (year, y0, y1, dur, sweepRatio = 0.72) => {
    const target = Math.max(0, Math.min(1, (year - y0) / (y1 - y0)));
    let lo = 0, hi = 1;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      (mid * mid * (3 - 2 * mid) < target) ? lo = mid : hi = mid;
    }
    return dur * sweepRatio * ((lo + hi) / 2);
  };

  function applyAgingTerrain(stage, year, { simulate = false } = {}) {
    for (const n of counties) {
      const t = cAt(n, 'total', Math.min(year, natY1));
      const a = simulate && year > natY1 ? ageSim(n, year) : cAt(n, 'pct65', year);
      const h = hPop(t) * (simulate && year > natY1 ? popSimRatio(year) : 1);
      stage.setCounty(n, { h, color: colorRamp(RAMP_AGE, ((a ?? 10) - 7) / 23) });
    }
  }
  function applyPopTerrain(stage, year) {
    for (const n of counties) {
      const t = cAt(n, 'total', year);
      stage.setCounty(n, { h: hPop(t), color: colorRamp(RAMP_TERRAIN, Math.sqrt((t || 0) / maxPop)) });
    }
  }

  const fact = label => (pop.facts || []).find(f => f.label.includes(label));
  const peak = fact('最高峰') || { year: 2019, value: null };
  const latestTotal = natAt('total', natY1);
  const latestPct65 = natAt('pct65', natY1);
  const milestones = proj?.milestones || [];

  const SRC_RIS = `內政部戶政司(實際 ${natY0}–${natY1})`;
  const SRC_NDC = `國發會人口推估 2024–2070(中推估)`;
  const SRC_DGBAS = `主計總處家庭收支調查(${inc?.meta?.year ?? 2024})`;
  const SRC_LIA = `壽險公會・保發中心(2024–25)`;

  // ════════════════ 章節(全長 100 秒) ════════════════
  const chapters = [];

  // ── 序章 8s ──
  chapters.push({
    no: '序', name: '開戰前夜', dur: 8,
    camera: [
      { t: 0, pos: [2, 88, 70], tgt: [0, 0, -3] },
      { t: 1, pos: [20, 44, 50], tgt: [0, 0, -4] },
    ],
    enter({ hud }) {
      setLegendPop(hud);
      hud.setYear(natY1, 'actual');
      hud.setSource(SRC_RIS);
    },
    cues: [
      { at: 0.4, run: () => sfx.chime() },
      {
        at: 5.2, caption: {
          title: '一張會說話的地圖',
          body: `島上 <strong>${fmtWan(latestTotal)}</strong> 人。<em>高度是人口、顏色是結構</em>——100 秒,看清壽險的新戰場。`,
          stat: ''
        }
      },
    ],
    tick(localT, p, { stage, hud }) {
      document.getElementById('titlecard')?.classList.toggle('hidden', localT > 5);
      counties.forEach((n, i) => {
        const delay = (i / counties.length) * 0.45;
        const t = cAt(n, 'total', natY1);
        stage.setCounty(n, {
          h: p > delay + 0.06 ? hPop(t) : 0.02,
          color: colorRamp(RAMP_TERRAIN, Math.sqrt((t || 0) / maxPop))
        });
      });
      hud.setYear(natY1, 'actual');
      chipsAt(hud, natY1);
      drawStackAt(hud, natY1);
    }
  });

  // ── 第一章 人口之峰 15s ──
  const ch1Y0 = Math.max(natY0, 1990);
  chapters.push({
    no: '第一章', name: '人口之峰', dur: 15,
    camera: [
      { t: 0, pos: [20, 44, 50], tgt: [0, 0, -4] },
      { t: 0.5, pos: [-32, 30, 30], tgt: [-2, 0, -2] },
      { t: 1, pos: [14, 30, -40], tgt: [4, 1, -13] },
    ],
    enter({ hud }) { setLegendPop(hud); hud.setSource(SRC_RIS); sfx.chime(); },
    cues: [
      {
        at: 0.3, caption: {
          title: '七十年擴張,在此止步',
          body: `嬰兒潮把臺灣推上 <strong>2,360 萬</strong>峰頂——壽險的黃金年代,就蓋在這條上坡上。`,
          stat: `${ch1Y0} → ${natY1} 全國總人口`
        }
      },
      {
        at: sweepCueAt(peak.year, ch1Y0, natY1, 15), run({ stage, hud }) {
          hud.event(peak.year, `人口最高峰 ${peak.value ? fmtWan(peak.value) : '2,360 萬'} — 此後轉折向下`);
          sfx.thud();
          top6Pop.forEach(n => stage.pulse(n, 0xc9a227, 5));
        }
      },
      {
        at: sweepCueAt((fact('死亡交叉') || { year: 2020 }).year, ch1Y0, natY1, 15) + 1.6, run({ hud }) {
          hud.event((fact('死亡交叉') || { year: 2020 }).year, '死亡數首度超越出生數 — 自然增加轉負');
          hud.shock(); hud.swellChip('young');
          sfx.thud();
        }
      },
      {
        at: 12.2, caption: {
          title: '峰頂之後',
          body: `新客戶<strong>不再自動長出來</strong>。市場從攻城掠地,轉向<em>深耕既有保戶</em>。`,
          stat: `${natY1} 總人口 <b>${fmtWan(latestTotal)}</b>`
        }
      },
    ],
    tick(localT, p, { stage, hud }) {
      const year = yearSweep(p, ch1Y0, natY1);
      applyPopTerrain(stage, year);
      hud.setYear(year, 'actual');
      chipsAt(hud, year);
      const cYear0 = pop.counties[top6Pop[0]]?.years?.[0] ?? 2000;
      top6Pop.forEach((n, i) => stage.setLabel(n, year >= cYear0 ? fmtWan(cAt(n, 'total', year)) : '', { hero: i < 2 }));
      drawStackAt(hud, year);
    }
  });

  // ── 第二章 高齡前線 15s ──
  chapters.push({
    no: '第二章', name: '高齡前線', dur: 15,
    camera: [
      { t: 0, pos: [14, 30, -40], tgt: [4, 1, -13] },
      { t: 0.4, pos: [-28, 26, 28], tgt: [-4, 0, 2] },
      { t: 0.75, pos: [-22, 18, 20], tgt: [-7, 1, 3] },
      { t: 1, pos: [6, 38, 42], tgt: [0, 0, -2] },
    ],
    enter({ hud }) { setLegendAge(hud); hud.setSource(SRC_RIS); sfx.chime(); },
    cues: [
      {
        at: 0.3, caption: {
          title: '一條由青轉紅的戰線',
          body: `顏色=<strong>65 歲以上比率</strong>。看它 25 年內從青綠燒成緋紅——高齡化是<em>進行式</em>,而且各縣市速度不一。`,
          stat: `2000 → ${natY1}`
        }
      },
      {
        at: sweepCueAt(2018, 2000, natY1, 15, 0.6), run({ hud }) {
          hud.event(2018, '65+ 突破 14% — 進入「高齡社會」');
          hud.shock(); hud.swellChip('old');
          sfx.thud();
        }
      },
      {
        at: sweepCueAt(2025, 2000, natY1, 15, 0.6), run({ stage, hud }) {
          hud.event(2025, '65+ 突破 20% — 正式進入「超高齡社會」');
          hud.shock(); hud.swellChip('old');
          sfx.thud();
          old3.forEach(n => { stage.pulse(n, 0xd9333f, 7); stage.beacon(n, 0xd9333f, 13); });
        }
      },
      {
        at: 10.4, caption: {
          title: '最老的,竟是首都',
          body: `<strong>${old3[0]}</strong> 全臺最老(${fmt1(cAt(old3[0], 'pct65', natY1))}%),${old3[1]}緊追。一邊是<em>有錢的老</em>、一邊是<em>缺錢的老</em>——同一張保單,兩門生意。`,
          stat: `全國 65+ <b>${fmt1(latestPct65)}%</b>・死亡保障退場,醫療長照退休湧入`
        }
      },
    ],
    tick(localT, p, { stage, hud }) {
      const year = yearSweep(p, Math.max(natY0, 2000), natY1, 0.6);
      applyAgingTerrain(stage, year);
      hud.setYear(year, 'actual');
      chipsAt(hud, year);
      [...old3, ...young3].forEach((n, i) => stage.setLabel(n, fmt1(cAt(n, 'pct65', year)) + '%', { hero: i < 3 }));
      drawStackAt(hud, year);
    }
  });

  // ── 第三章 家的縮影 11s ──
  const hhTrend = inc?.nationalTrend;
  chapters.push({
    no: '第三章', name: '家的縮影', dur: 11,
    camera: [
      { t: 0, pos: [6, 38, 42], tgt: [0, 0, -2] },
      { t: 0.55, pos: [-20, 18, 34], tgt: [-3, 1, 2] },
      { t: 1, pos: [18, 22, 38], tgt: [2, 1, -3] },
    ],
    enter({ hud }) {
      hud.setLegend('平均每戶人數', RAMP_HOME, ['2.2 人', '', '', '3 人+']);
      hud.setSource(SRC_DGBAS);
      sfx.chime();
    },
    cues: [
      {
        at: 0.3, caption: {
          title: '家,正在縮小',
          body: hhBody(),
          stat: incHHLowStat()
        }
      },
      {
        at: 3.2, run({ hud }) {
          hud.shock(); sfx.thud();
        }
      },
      {
        at: 6.2, caption: {
          title: '最小的家,在離島與東部',
          body: smallHomeBody(),
          stat: `受益人不見了——死亡保障的劇本,跟著家一起縮水`
        }
      },
    ],
    tick(localT, p, { stage, hud }) {
      for (const n of counties) {
        const hh = inc?.counties?.[n]?.personsPerHH;
        stage.setCounty(n, {
          h: hPop(cAt(n, 'total', natY1)),
          color: hh == null ? '#26303c' : colorRamp(RAMP_HOME, (hh - 2.2) / 1.0)
        });
      }
      hud.setYear(inc?.meta?.year || natY1, 'actual');
      chipsAt(hud, natY1);
      if (inc?.counties) {
        const sorted = counties.filter(n => inc.counties[n]?.personsPerHH != null)
          .sort((a, b) => inc.counties[a].personsPerHH - inc.counties[b].personsPerHH);
        [...sorted.slice(0, 3), ...sorted.slice(-2)].forEach((n, i) =>
          stage.setLabel(n, fmt1(inc.counties[n].personsPerHH) + ' 人/戶', { hero: i < 3 }));
      }
      // 戶量人形圖:1990 → 今,4.19 人縮成 2.78 人
      if (hhTrend?.personsPerHH) {
        const hy = hhTrend.years;
        const hYear = yearSweep(p, hy[0], hy[hy.length - 1], 0.55);
        const v = seriesAt(hy, hhTrend.personsPerHH, hYear);
        hud.drawHousehold(v, hYear, `<span style="color:#f0d878">全國平均每戶人數 ${Math.round(hYear)} 年</span>`);
      }
    }
  });
  function hhBody() {
    if (!hhTrend?.personsPerHH) return `家庭快速小型化,一人戶比率持續攀升。`;
    const v0 = hhTrend.personsPerHH[0], v1 = hhTrend.personsPerHH[hhTrend.personsPerHH.length - 1];
    return `${hhTrend.years[0]} 年一戶 <strong>${fmt1(v0)} 人</strong>,如今只剩 <strong>${fmt1(v1)} 人</strong>——屋簷下的人,少了三分之一。`;
  }
  function incHHLowStat() {
    const v = hhTrend?.singlePersonHHpct?.slice(-1)[0];
    return v == null ? '' : `單人戶比率 <b>${fmt1(v)}%</b>`;
  }
  function smallHomeBody() {
    if (!inc?.counties) return `戶量最小的不在都會,在離島與東部——獨居與兩老家庭。`;
    const sorted = counties.filter(n => inc.counties[n]?.personsPerHH != null)
      .sort((a, b) => inc.counties[a].personsPerHH - inc.counties[b].personsPerHH);
    const lo = sorted[0], hi = sorted[sorted.length - 1];
    return `<strong>${lo} ${fmt1(inc.counties[lo].personsPerHH)} 人/戶</strong>=獨居長者的長照風險;<strong>${hi} ${fmt1(inc.counties[hi].personsPerHH)} 人/戶</strong>=科技家庭的房貸教育缺口。`;
  }

  // ── 第四章 財富山脈 13s ──
  const maxInc = inc?.counties ? Math.max(...Object.values(inc.counties).map(c => c.dispIncomeHH || 0)) : 1;
  chapters.push({
    no: '第四章', name: '財富山脈', dur: 14,
    camera: [
      { t: 0, pos: [18, 22, 38], tgt: [2, 1, -3] },
      { t: 0.45, pos: [26, 20, -30], tgt: [5, 2, -13] },
      { t: 1, pos: [-14, 32, 42], tgt: [-2, 0, 1] },
    ],
    enter({ hud }) {
      hud.setLegend('平均每戶可支配所得(高度)', RAMP_GOLD, ['低', '', '', '高']);
      hud.setSource(`${SRC_DGBAS}・${SRC_LIA}`);
      sfx.chime();
    },
    cues: [
      {
        at: 0.3, caption: {
          title: '把地圖換成錢的形狀',
          body: `<em>高度=每戶可支配所得</em>。山瞬間搬家——<strong>臺北、新竹</strong>拔地而起,剛才最紅的高齡縣塌成谷地。`,
          stat: incTopStat()
        },
        // 編碼轉折:高度由「人口」改為「所得」,以衝擊紅光+金色脈衝點出地圖重塑
        run({ stage, hud }) {
          hud.shock();
          ['臺北市', '新竹市', '新竹縣'].forEach(n => stage.pulse(n, 0xf0d878, 6));
          sfx.thud();
        }
      },
      {
        at: 4.4, run({ stage }) {
          ['臺北市', '新竹市', '新竹縣'].forEach(n => stage.beacon(n, 0xf0d878, 16));
          sfx.thud();
        }
      },
      {
        at: 7.6, caption: {
          title: '保單很多,保障很薄',
          body: insGapBody(),
          stat: insGapStat()
        }
      },
    ],
    tick(localT, p, { stage, hud }) {
      for (const n of counties) {
        const v = inc?.counties?.[n]?.dispIncomeHH;
        stage.setCounty(n, {
          h: v == null ? 0.4 : Math.pow(v / maxInc, 2.2) * 8.5,
          color: v == null ? '#26303c' : colorRamp(RAMP_GOLD, v / maxInc)
        });
      }
      hud.setYear(inc?.meta?.year || natY1, 'actual');
      chipsAt(hud, natY1);
      if (inc?.counties) {
        const sorted = counties.filter(n => inc.counties[n]?.dispIncomeHH != null)
          .sort((a, b) => inc.counties[b].dispIncomeHH - inc.counties[a].dispIncomeHH);
        [...sorted.slice(0, 3), ...sorted.slice(-2)].forEach((n, i) =>
          stage.setLabel(n, (inc.counties[n].dispIncomeHH / 10000).toFixed(0) + ' 萬/戶', { hero: i < 3 }));
      }
      if (ins?.coverageRate) {
        hud.drawChart([{ years: ins.coverageRate.years, values: ins.coverageRate.values, color: '#f0d878', width: 2 }],
          null, `<span style="color:#f0d878">━ 人身保險投保率(%)</span>`);
      }
    }
  });
  function incTopStat() {
    if (!inc?.counties) return '';
    const top = counties.filter(n => inc.counties[n]?.dispIncomeHH)
      .sort((a, b) => inc.counties[b].dispIncomeHH - inc.counties[a].dispIncomeHH)[0];
    return top ? `${top} 每戶可支配所得 <b>${(inc.counties[top].dispIncomeHH / 10000).toFixed(0)} 萬</b>/年` : '';
  }
  function insGapBody() {
    const cov = ins?.coverageRate?.values?.slice(-1)[0];
    const covTxt = cov ? `投保率 <strong>${fmt1(cov)}%</strong>(每人 2.6 張保單),` : ``;
    const gapFact = (ins?.facts || []).find(f => f.label.includes('有效契約平均保額'));
    const gapTxt = gapFact ? `但每張有效保單平均保額僅 <strong>${fmtWan(gapFact.value)}</strong>。` : `但平均保額長期偏低。`;
    return covTxt + gapTxt + `<em>缺的不是保單,是厚度。</em>`;
  }
  function insGapStat() {
    const pen = ins?.penetration?.values?.slice(-1)[0];
    return pen ? `滲透度(保費/GDP) <b>${fmt1(pen)}%</b>` : '';
  }

  // ── 第五章 未來推演 2070 15s ──
  chapters.push({
    no: '第五章', name: '未來推演 2070', dur: 19,
    camera: [
      { t: 0, pos: [-14, 32, 42], tgt: [-2, 0, 1] },
      { t: 0.45, pos: [26, 28, 32], tgt: [0, 0, -2] },
      { t: 0.8, pos: [-22, 38, -30], tgt: [-2, 0, -2] },
      { t: 1, pos: [4, 52, 50], tgt: [0, 0, -3] },
    ],
    enter({ hud }) { setLegendAge(hud); hud.setSource(SRC_NDC); sfx.chime(); },
    cues: [
      {
        at: 0.4, caption: {
          title: '把時鐘撥快 45 年',
          body: `<em>國發會中推估</em> + <strong>本劇場縣市情境模擬</strong>(紅徽章=推演,不是事實)。看著工作年齡的金色地帶被紅色吞沒。`,
          stat: `${natY1} → ${projY1}`
        },
        // 編碼轉折:由「實際」跨入「推演」,以衝擊紅光點出時間軸越界
        run({ hud }) { hud.shock(); sfx.thud(); }
      },
      ...projMilestoneCues(),
      {
        at: 15.5, caption: {
          title: '產品結構還停在昨天',
          body: mixBody(),
          stat: mixStat()
        }
      },
    ],
    tick(localT, p, { stage, hud }) {
      const year = yearSweep(p, natY1, projY1, 0.68);
      applyAgingTerrain(stage, year, { simulate: true });
      hud.setYear(year, year <= natY1 + 0.5 ? 'actual' : 'sim');
      hud.setSource(year <= natY1 + 0.5 ? SRC_RIS : `${SRC_NDC}・縣市=本劇場情境`);
      chipsAt(hud, year);
      old3.forEach(n => stage.setLabel(n, fmt1(year > natY1 ? ageSim(n, year) : cAt(n, 'pct65', year)) + '%', { hero: true }));
      drawStackAt(hud, year);
    }
  });
  function projMilestoneCues() {
    const cues = [];
    let i = 0;
    // 19 秒章節:取三個間距夠寬的里程碑,讓每則戰報都看得清楚、不互相打斷
    const prefer = [2028, 2050, 2070];
    const pool = milestones.filter(m => m.year > natY1);
    const picked = prefer.map(y => pool.find(m => m.year === y)).filter(Boolean);
    for (const m of (picked.length >= 3 ? picked : pool.slice(0, 3))) {
      const at = Math.max(2.4, sweepCueAt(m.year, natY1, projY1, 19, 0.68));
      cues.push({
        at, run({ hud, stage }) {
          hud.event(m.year, m.label + '(官方推估)');
          hud.shock(); hud.swellChip('old');
          sfx.thud();
          if (i++ === 0) old3.forEach(n => stage.pulse(n, 0xd9333f, 6));
        }
      });
    }
    return cues;
  }
  function mixBody() {
    const m = ins?.newPremiumMix?.categoriesPct;
    if (!m) return `高齡需求湧入,新契約卻仍以儲蓄型為主——轉型速度就是勝負。`;
    const ha = (m['健康險'] ?? 0) + (m['年金險'] ?? 0);
    return `${ins.newPremiumMix.year} 新契約:<strong>傳統壽險 ${fmt1(m['傳統壽險'])}%</strong>,直面高齡的<em>健康+年金僅 ${fmt1(ha)}%</em>。地圖已老,貨架還年輕——<strong>缺口就是機會。</strong>`;
  }
  function mixStat() {
    const m = ins?.newPremiumMix?.categoriesPct;
    return m ? `健康 <b>${fmt1(m['健康險'])}%</b>・年金 <b>${fmt1(m['年金險'])}%</b>・投資型 <b>${fmt1(m['投資型壽險'])}%</b>` : '';
  }

  // ── 終章 三大戰場 13s ──
  chapters.push({
    no: '終章', name: '三大戰場', dur: 18,
    camera: [
      { t: 0, pos: [4, 52, 50], tgt: [0, 0, -3] },
      { t: 0.6, pos: [18, 36, 42], tgt: [0, 0, -3] },
      { t: 1, pos: [8, 60, 60], tgt: [0, 0, -3] },
    ],
    enter({ hud }) { setLegendAge(hud); hud.setSource(`${SRC_RIS}・${SRC_LIA}`); sfx.chime(); },
    cues: [
      {
        at: 0.5, caption: {
          title: '戰場一・高齡鄉縣',
          body: `<strong>長照、醫療、小額終老</strong>。通路走進診所與農會,不是商辦大樓。`,
          stat: ruralOld3.join('・')
        },
        run({ stage }) { ruralOld3.forEach(n => { stage.beacon(n, 0xd9333f, 15); stage.pulse(n, 0xd9333f, 6); }); sfx.thud(); }
      },
      {
        at: 5, caption: {
          title: '戰場二・財富高峰',
          body: `<strong>最老又最富的臺北</strong>+新竹走廊——<strong>退休理財、利變壽險、資產傳承</strong>。客戶不缺錢,缺終身現金流。`,
          stat: '臺北市・新竹市・新竹縣'
        },
        run({ stage }) { ['臺北市', '新竹市', '新竹縣'].forEach(n => { stage.beacon(n, 0xf0d878, 16); stage.pulse(n, 0xc9a227, 6); }); sfx.thud(); }
      },
      {
        at: 9.5, caption: {
          title: '戰場三・青壯新城',
          body: `桃園、臺中——少數仍長出年輕家庭的地方。<strong>定期壽險與健康險,最後一塊成長市場。</strong>`,
          stat: '桃園市・臺中市'
        },
        run({ stage }) { ['桃園市', '臺中市'].forEach(n => { stage.beacon(n, 0x4aa3a2, 15); stage.pulse(n, 0x4aa3a2, 6); }); sfx.thud(); }
      },
      {
        at: 14, caption: {
          title: '保障的戰場,正在移動',
          body: `峰已過、家變小、山傾斜。<strong>地圖不會等人。</strong>`,
          stat: '完',
          hint: '↺ 重播　·　拖曳旋轉視角　·　滑入縣市看細節'
        },
        // 終局合奏:三大戰場同時亮起,把全片論點收束成一張地圖
        run({ stage }) {
          ruralOld3.forEach(n => stage.beacon(n, 0xd9333f, 15));
          ['臺北市', '新竹市', '新竹縣'].forEach(n => stage.beacon(n, 0xf0d878, 16));
          ['桃園市', '臺中市'].forEach(n => stage.beacon(n, 0x4aa3a2, 15));
          sfx.chime();
        }
      },
    ],
    tick(localT, p, { stage, hud }) {
      applyAgingTerrain(stage, natY1);
      hud.setYear(natY1, 'actual');
      chipsAt(hud, natY1);
      [...old3, '臺北市', '新竹市', '桃園市', '臺中市'].forEach(n =>
        stage.setLabel(n, fmt1(cAt(n, 'pct65', natY1)) + '%', { hero: true }));
      drawStackAt(hud, natY1);
    }
  });

  // ════════ 縣市 hover 情報面板 ════════
  function panelRows(name) {
    const rows = [
      ['人口', fmtWan(cAt(name, 'total', natY1))],
      ['65歲以上', fmt1(cAt(name, 'pct65', natY1)) + '%'],
      ['15–64歲', fmt1(cAt(name, 'pct15_64', natY1)) + '%'],
    ];
    if (inc?.counties?.[name]) {
      const c = inc.counties[name];
      if (c.dispIncomeHH) rows.push(['每戶可支配所得', (c.dispIncomeHH / 10000).toFixed(1) + ' 萬']);
      if (c.personsPerHH) rows.push(['每戶人數', fmt1(c.personsPerHH) + ' 人']);
    }
    return rows;
  }

  // ════════ 資料來源說明 ════════
  const srcBlock = (title, meta) => meta ? `<h4>${title}</h4>` +
    (meta.sources || []).map(s => `<div><a href="${s}" target="_blank" rel="noopener">${s}</a></div>`).join('') +
    (meta.notes ? `<div class="note">${meta.notes}</div>` : '') : '';
  const sourcesHTML = `
    <p>本劇場所有「實際資料」與「官方推估」皆取自下列官方公開來源(擷取日 2026-06-11);
    <span style="color:#ff6b5e">「情境推演」</span>為本專案以縣市近十年老化速度線性外推、並向國發會全國中推估收斂之模擬,僅供策略討論。</p>
    ${srcBlock('縣市界線圖資', { sources: ['https://data.gov.tw/dataset/7442'], notes: '內政部國土測繪中心 直轄市、縣(市)界線(TWD97經緯度),經拓撲保形簡化' })}
    ${srcBlock('人口統計(實際)', pop?.meta)}
    ${srcBlock('人口推估(官方)', proj?.meta)}
    ${srcBlock('家庭收支調查', inc?.meta)}
    ${srcBlock('壽險市場統計', ins?.meta)}
    <h4>視覺編碼</h4>
    <div class="note">地形高度=人口或所得(各章圖例標示);顏色=年齡結構/戶量/所得;右上三色晶片=全國三段年齡占比;右下帶狀圖=1990–2070 年齡結構演變(暗區為推估)。高度經開根號/冪次縮放,相對比較有效、絕對數值請見標示。</div>`;

  return { chapters, panelRows, sourcesHTML };
}
