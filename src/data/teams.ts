import type { Team, Region, Position, Player, Attributes, AttrKey } from '../types';
import { AVATAR_COLORS } from '../constants';
import rosterRaw from './roster.csv?raw';

// ============================================
// 选手/战队数值表 —— 唯一数据源
// 维护方式：直接编辑 src/data/roster.csv（可用 Excel 打开）
// 列：战队ID,战队,全名,赛区,风格,配合度,队徽色,选手,位置,操作,反应,发育,配合,意识,开团,英雄池,心态,适应,综合
// 综合列仅作参考（=9项均值），不参与计算
// ============================================

const ATTR_MAP: [string, AttrKey][] = [
  ['操作', 'mechanics'],
  ['反应', 'reaction'],
  ['发育', 'farming'],
  ['配合', 'teamwork'],
  ['意识', 'macro'],
  ['开团', 'engage'],
  ['英雄池', 'championPool'],
  ['心态', 'mentality'],
  ['沟通', 'communication'],
];

const POS_MAP: Record<string, Position> = {
  上单: 'top',
  打野: 'jungle',
  中单: 'mid',
  下路: 'adc',
  辅助: 'support',
};

interface Row {
  [k: string]: string;
}

/** 极简 CSV 解析（字段内不含逗号，无需处理引号） */
function parseCsv(raw: string): Row[] {
  const text = raw.replace(/^\ufeff/, ''); // 去 BOM
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const obj: Row = {};
    header.forEach((h, i) => (obj[h.trim()] = (cols[i] ?? '').trim()));
    return obj;
  });
}

/** 由名字稳定地取一个头像色 */
function colorFor(name: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Math.imul 返回有符号 int32，h 可能为负；
  // 负数的 % 结果仍为负 → AVATAR_COLORS[负索引] = undefined → Avatar 渲染 color.replace 崩溃。
  // 必须 >>> 0 转成无符号再取模。
  return AVATAR_COLORS[(h >>> 0) % AVATAR_COLORS.length];
}

function buildPlayer(row: Row, teamId: string): Player {
  const name = row['选手'];
  const position = POS_MAP[row['位置']] ?? 'top';
  const attributes = {} as Attributes;
  for (const [cn, key] of ATTR_MAP) {
    const v = Number(row[cn]);
    attributes[key] = Number.isFinite(v) ? v : 50;
  }
  return {
    id: `${teamId}-${name}`.toLowerCase(),
    name,
    position,
    attributes,
    avatarColor: colorFor(name),
    isCustom: false,
  };
}

function buildTeams(): Team[] {
  const rows = parseCsv(rosterRaw);
  const order: string[] = [];
  const byTeam = new Map<string, Row[]>();
  for (const r of rows) {
    const id = r['战队ID'];
    if (!byTeam.has(id)) {
      byTeam.set(id, []);
      order.push(id);
    }
    byTeam.get(id)!.push(r);
  }
  return order.map((id) => {
    const rows = byTeam.get(id)!;
    const first = rows[0];
    const roster = rows.map((r) => buildPlayer(r, id));
    // 团队配合度从阵容 5 人「配合」属性均值推导（无需单独填写）
    const teamwork = Math.round(
      roster.reduce((s, p) => s + p.attributes.teamwork, 0) / roster.length,
    );
    return {
      id,
      name: first['战队'],
      fullName: first['全名'],
      region: first['赛区'] as Region,
      style: first['风格'],
      logoColor: first['队徽色'],
      teamwork,
      roster,
    } as Team;
  });
}

export const TEAMS: Team[] = buildTeams();

export const TEAM_BY_ID: Record<string, Team> = Object.fromEntries(
  TEAMS.map((t) => [t.id, t]),
);

export function getTeam(id: string): Team {
  const t = TEAM_BY_ID[id];
  if (!t) throw new Error(`Team not found: ${id}`);
  return t;
}

export function getLplTeams(): Team[] {
  return TEAMS.filter((t) => t.region === 'LPL');
}

export function getInternationalTeams(): Team[] {
  return TEAMS.filter((t) => t.region !== 'LPL');
}

export function getAllRealPlayers() {
  return TEAMS.flatMap((t) =>
    t.roster.map((p) => ({ player: p, teamId: t.id, region: t.region })),
  );
}
