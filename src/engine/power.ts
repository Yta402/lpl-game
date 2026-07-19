import type { Attributes, Player, Position, Team } from '../types';
import { POSITION_WEIGHTS } from '../constants';
import { effectiveAttrs, teamfightSum, type AttrMods } from './breakthrough';

// ============================================
// 单人战力
// ============================================
export function calcPlayerPower(attrs: Attributes, position: Position): number {
  const w = POSITION_WEIGHTS[position];
  const laning = (attrs.mechanics + attrs.reaction + attrs.farming) / 3;
  const teamfight = (attrs.teamwork + attrs.macro + attrs.engage) / 3;
  const depth = (attrs.championPool + attrs.mentality + attrs.communication) / 3;
  return laning * w.laning + teamfight * w.teamfight + depth * w.depth;
}

// ============================================
// 战队风格与选手契合
// ============================================
function dominantGroup(a: Attributes): 'laning' | 'teamfight' {
  const l = (a.mechanics + a.reaction + a.farming) / 3;
  const t = (a.teamwork + a.macro + a.engage) / 3;
  return l >= t ? 'laning' : 'teamfight';
}

/**
 * 战术契合：玩家最强组是否契合战队风格
 * - 打架队 / 快节奏 → 偏对线
 * - 运营流 → 偏团战/意识
 */
function styleFit(style: string, playerAttrs: Attributes): number {
  const dom = dominantGroup(playerAttrs);
  if (style === '运营流') return dom === 'teamfight' ? 1.05 : 1.0;
  // 打架队、快节奏 → 对线契合
  return dom === 'laning' ? 1.05 : 1.0;
}

// ============================================
// 战队战力
// ============================================
export interface RosterSlot {
  player: Player;
  position: Position;
}

/**
 * 组装有效阵容：玩家顶替其位置的队友。
 * 返回 5 个位置的有效属性。
 */
export function buildEffectiveRoster(
  team: Team,
  customPlayer: Player,
  mods: AttrMods,
): { position: Position; attrs: Attributes }[] {
  return team.roster.map((p) => {
    const isCustom = p.position === customPlayer.position;
    const source = isCustom ? customPlayer : p;
    return {
      position: p.position,
      attrs: effectiveAttrs(source.attributes, p.position, isCustom, mods),
    };
  });
}

/** 对手战队战力（无自建玩家，全员本属性 + 可选加成） */
export function buildEnemyRoster(
  team: Team,
  mods: AttrMods,
): { position: Position; attrs: Attributes }[] {
  // 对手默认无亮剑/突破（这些是玩家专属机制）
  void mods;
  return team.roster.map((p) => ({
    position: p.position,
    attrs: effectiveAttrs(p.attributes, p.position, false, {
      strat: 'none',
      solokill: false,
      teamfightCarry: false,
    }),
  }));
}

/**
 * 计算战队综合战力。
 * power = Σ(单人战力) × 团队协同 × 风格契合
 */
export function calcTeamPower(
  roster: { position: Position; attrs: Attributes }[],
  teamwork: number,
  customPlayer?: Player,
  style?: string,
): number {
  const base = roster.reduce(
    (s, slot) => s + calcPlayerPower(slot.attrs, slot.position),
    0,
  );

  // 团队协同度：基于配合度 + 阵容团战均值
  const avgTf =
    roster.reduce((s, slot) => s + teamfightSum(slot.attrs), 0) / roster.length;
  const synergy = 0.85 + (teamwork / 100) * 0.15 + (avgTf / 99) * 0.1; // ~0.85-1.10

  // 风格契合：仅对玩家所在队伍生效
  const fit = customPlayer && style ? styleFit(style, customPlayer.attributes) : 1.0;

  return base * synergy * fit;
}

/**
 * 计算我方（含玩家）与敌方战力的对位战力，并返回突破判定所需的对线数据。
 */
export interface PowerBreakdown {
  myPower: number;
  enemyPower: number;
}

export function calcBothPower(
  myTeam: Team,
  customPlayer: Player,
  enemyTeam: Team,
  mods: AttrMods,
): PowerBreakdown {
  const myRoster = buildEffectiveRoster(myTeam, customPlayer, mods);
  const enRoster = buildEnemyRoster(enemyTeam, mods);

  const myPower = calcTeamPower(myRoster, myTeam.teamwork, customPlayer, myTeam.style);
  const enemyPower = calcTeamPower(enRoster, enemyTeam.teamwork);

  return { myPower, enemyPower };
}
