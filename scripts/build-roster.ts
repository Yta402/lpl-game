// 一次性脚本：用【修复后】的公式把 overall 转成 9 维属性，写入 src/data/roster.csv
// 修复要点：overall = 9 维目标均值（0-99 量纲），位置偏移 + 高斯扰动，无错误校准
// 运行：npx vite-node scripts/build-roster.ts
import { writeFileSync } from 'node:fs';

// ---------- 修复后的生成公式（与 src/data/generate.ts 保持一致）----------
const REGION_TIER: Record<string, { base: number; variance: number }> = {
  LCK: { base: 85, variance: 8 },
  LPL: { base: 82, variance: 10 },
  LEC: { base: 72, variance: 10 },
  LCS: { base: 68, variance: 10 },
  PCS: { base: 60, variance: 12 },
  VCS: { base: 58, variance: 12 },
};
const W: Record<string, { l: number; t: number; d: number }> = {
  top: { l: 1.2, t: 0.9, d: 0.9 },
  jungle: { l: 0.8, t: 1.2, d: 1.0 },
  mid: { l: 1.15, t: 1.0, d: 0.85 },
  adc: { l: 1.1, t: 0.95, d: 0.95 },
  support: { l: 0.7, t: 1.25, d: 1.05 },
};
const POS = ['top', 'jungle', 'mid', 'adc', 'support'];
const LK = ['操作', '反应', '发育'];
const TK = ['配合', '意识', '开团'];
const DK = ['英雄池', '心态', '适应'];
const BIAS_SCALE = 12;

function seedFrom(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
function genAttrs(id: string, overall: number, pos: string, region: string): number[] {
  const rng = makeRng(seedFrom(id + '|' + pos + '|' + region));
  const tier = REGION_TIER[region];
  const w = W[pos];
  const gauss = (): number => {
    let u = 0;
    let v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const target = (weight: number): number => overall + (weight - 1) * BIAS_SCALE;
  const roll = (t: number): number => clamp(Math.round(t + gauss() * tier.variance), 25, 99);
  const out: number[] = [];
  const lt = target(w.l);
  for (let i = 0; i < 3; i++) out.push(roll(lt));
  const tt = target(w.t);
  for (let i = 0; i < 3; i++) out.push(roll(tt));
  const dt = target(w.d);
  for (let i = 0; i < 3; i++) out.push(roll(dt));
  return out;
}

// ---------- 原始 overall 数据（与 teams.ts 旧版一致）----------
interface Raw {
  id: string;
  name: string;
  full: string;
  region: string;
  style: string;
  synergy: number;
  color: string;
  roster: [string, number][]; // [name, overall] x5, 顺序 上/野/中/下/辅
}
const TEAMS: Raw[] = [
  { id: 'blg', name: 'BLG', full: 'Bilibili Gaming', region: 'LPL', style: '打架队', synergy: 82, color: '#00a1d6', roster: [['Bin', 92], ['Xun', 86], ['Knight', 94], ['Elk', 90], ['ON', 86]] },
  { id: 'jdg', name: 'JDG', full: 'JD Gaming', region: 'LPL', style: '运营流', synergy: 86, color: '#d4213d', roster: [['369', 90], ['Kanavi', 92], ['Yagao', 88], ['Ruler', 91], ['MISSING', 87]] },
  { id: 'tes', name: 'TES', full: 'Top Esports', region: 'LPL', style: '打架队', synergy: 80, color: '#f3a01d', roster: [['Wayward', 86], ['Tian', 87], ['Creme', 85], ['JackeyLove', 90], ['Meiko', 88]] },
  { id: 'lng', name: 'LNG', full: 'LNG Esports', region: 'LPL', style: '运营流', synergy: 83, color: '#1de9b6', roster: [['Zika', 85], ['Weiwei', 86], ['Scout', 90], ['GALA', 88], ['Hang', 84]] },
  { id: 'wbg', name: 'WBG', full: 'Weibo Gaming', region: 'LPL', style: '快节奏', synergy: 78, color: '#ff5a5f', roster: [['Breathe', 84], ['Tarzan', 85], ['Xiaohu', 89], ['Light', 85], ['Crisp', 84]] },
  { id: 'nip', name: 'NIP', full: 'Ninjas in Pyjamas', region: 'LPL', style: '运营流', synergy: 76, color: '#1c3a5e', roster: [['shanji', 83], ['Aki', 82], ['Rookie', 87], ['Photic', 84], ['ppgod', 81]] },
  { id: 'al', name: 'AL', full: "Anyone's Legend", region: 'LPL', style: '快节奏', synergy: 75, color: '#7c4dff', roster: [['Hoya', 80], ['Croco', 82], ['Easyboy', 81], ['Hope', 83], ['Kael', 79]] },
  { id: 'edg', name: 'EDG', full: 'Edward Gaming', region: 'LPL', style: '运营流', synergy: 80, color: '#005bac', roster: [['Ale', 81], ['Jiejie', 84], ['Fisher', 80], ['Leave', 84], ['Vampire', 80]] },
  { id: 'fpx', name: 'FPX', full: 'FunPlus Phoenix', region: 'LPL', style: '打架队', synergy: 74, color: '#e84118', roster: [['Xiaolaohu', 79], ['Milkyway', 83], ['Care', 80], ['Assum', 81], ['deokdam', 80]] },
  { id: 't1', name: 'T1', full: 'T1', region: 'LCK', style: '运营流', synergy: 90, color: '#e2012d', roster: [['Doran', 89], ['Oner', 88], ['Faker', 93], ['Gumayusi', 89], ['Keria', 91]] },
  { id: 'gen', name: 'GEN', full: 'Gen.G', region: 'LCK', style: '运营流', synergy: 89, color: '#aa802b', roster: [['Kiin', 89], ['Canyon', 91], ['Chovy', 94], ['Peyz', 88], ['Lehends', 86]] },
  { id: 'hle', name: 'HLE', full: 'Hanwha Life Esports', region: 'LCK', style: '打架队', synergy: 85, color: '#ff7a00', roster: [['Doro', 87], ['Peanut', 87], ['Zeka', 89], ['Viper', 91], ['Delight', 85]] },
  { id: 'dk', name: 'DK', full: 'Dplus KIA', region: 'LCK', style: '运营流', synergy: 83, color: '#1c3a8f', roster: [['Siwoo', 84], ['Lucid', 85], ['ShowMaker', 89], ['Aiming', 86], ['Kellin', 83]] },
  { id: 'kt', name: 'KT', full: 'KT Rolster', region: 'LCK', style: '快节奏', synergy: 81, color: '#ff0000', roster: [['PerfecT', 83], ['Pyosik', 84], ['Bdd', 85], ['Bull', 82], ['Berdol', 81]] },
  { id: 'ns', name: 'NS', full: 'Nongshim RedForce', region: 'LCK', style: '打架队', synergy: 79, color: '#0c2d74', roster: [['DnDn', 81], ['Sylvie', 81], ['Cali', 82], ['Vlad', 80], ['Peter', 79]] },
  { id: 'g2', name: 'G2', full: 'G2 Esports', region: 'LEC', style: '打架队', synergy: 80, color: '#e6191e', roster: [['BrokenBlade', 84], ['Yike', 82], ['Caps', 86], ['HansSama', 83], ['Mikyx', 83]] },
  { id: 'fnc', name: 'FNC', full: 'Fnatic', region: 'LEC', style: '快节奏', synergy: 76, color: '#ff5800', roster: [['Oscarinin', 79], ['Razork', 82], ['Humanoid', 83], ['Noah', 80], ['Jun', 79]] },
  { id: 'koi', name: 'KOI', full: 'KOI', region: 'LEC', style: '运营流', synergy: 75, color: '#5eff00', roster: [['Myrwn', 78], ['Sheo', 79], ['Saken', 80], ['Supa', 78], ['Trymbi', 80]] },
  { id: 'fly', name: 'FLY', full: 'FlyQuest', region: 'LCS', style: '打架队', synergy: 77, color: '#00b4d8', roster: [['Bwipo', 82], ['Spica', 80], ['Jensen', 83], ['Massu', 80], ['Busio', 79]] },
  { id: 'tl', name: 'TL', full: 'Team Liquid', region: 'LCS', style: '运营流', synergy: 78, color: '#0a1c3d', roster: [['Impact', 81], ['Umti', 80], ['APA', 81], ['Yeon', 81], ['CoreJJ', 83]] },
  { id: 'c9', name: 'C9', full: 'Cloud9', region: 'LCS', style: '快节奏', synergy: 74, color: '#1a6fb0', roster: [['Thanatos', 78], ['Blaber', 82], ['Vladi', 79], ['Sniper', 80], ['Zven', 80]] },
  { id: 'psg', name: 'PSG', full: 'PSG Talon', region: 'PCS', style: '快节奏', synergy: 70, color: '#004b93', roster: [['Azhi', 76], ['Kongyue', 75], ['Maple', 78], ['Betty', 76], ['Woody', 74]] },
  { id: 'gam', name: 'GAM', full: 'GAM Esports', region: 'VCS', style: '打架队', synergy: 72, color: '#d6202a', roster: [['Kiaya', 74], ['Levi', 77], ['Froggy', 75], ['Slayder', 77], ['Easylove', 73]] },
];

// ---------- 生成 CSV ----------
const POS_CN = ['上单', '打野', '中单', '下路', '辅助'];
const header = [
  '战队ID', '战队', '全名', '赛区', '风格', '配合度', '队徽色',
  '选手', '位置',
  ...LK, ...TK, ...DK,
  '综合',
];
const lines: string[] = [header.join(',')];
for (const tm of TEAMS) {
  for (let i = 0; i < 5; i++) {
    const [pname, overall] = tm.roster[i];
    const pos = POS[i];
    const attrs = genAttrs(`${tm.id}/${pname}`, overall, pos, tm.region);
    const avg = Math.round(attrs.reduce((s, x) => s + x, 0) / attrs.length);
    lines.push([
      tm.id, tm.name, tm.full, tm.region, tm.style, tm.synergy, tm.color,
      pname, POS_CN[i],
      ...attrs,
      avg,
    ].join(','));
  }
}
const csv = '\ufeff' + lines.join('\n') + '\n';
writeFileSync('src/data/roster.csv', csv, 'utf-8');
console.log(`已写入 src/data/roster.csv（${TEAMS.length} 队 × 5 = ${TEAMS.length * 5} 位选手）`);
console.log('\n=== 预览（前 10 行）===');
console.log(lines.slice(0, 11).join('\n'));
