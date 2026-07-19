import type { Attributes, AttrKey, Strat } from '../types';
import {
  ATTR_MAX,
  CHALLENGE_SELF_MULT,
  CHALLENGE_TEAM_MULT,
  SOLOKILL_SELF_MULT,
  SOLOKILL_TEAM_MULT,
  SOLOKILL_THRESHOLD,
  SACRIFICE_SELF_MULT,
  SACRIFICE_TEAM_MULT,
  TEAMFIGHTCARRY_TEAM_MULT,
  TEAMFIGHTCARRY_THRESHOLD,
} from '../constants';
import { clamp } from '../utils/clamp';

// ============================================
// 对线组合计 / 团战组合计
// ============================================
export function laningSum(a: Attributes): number {
  return a.mechanics + a.reaction + a.farming;
}
export function teamfightSum(a: Attributes): number {
  return a.teamwork + a.macro + a.engage;
}

// ============================================
// 关键局策略：亮剑→单线击穿 / 奉献→团战游龙
// 判定均基于「基础属性」（选手真实实力差距），策略本身不帮助达成阈值
// ============================================

/** 亮剑是否触发单线击穿：玩家对线和 − 对位对线和 ≥ 阈值 */
export function checkSolokill(
  playerBase: Attributes,
  enemyCounterpartBase: Attributes,
): boolean {
  return laningSum(playerBase) - laningSum(enemyCounterpartBase) >= SOLOKILL_THRESHOLD;
}

/** 奉献是否触发团战游龙：4 队友团战和 − 敌方 4 人团战和 ≥ 阈值 */
export function checkTeamfightCarry(
  mates4BaseSum: number,
  enemy4BaseSum: number,
): boolean {
  return mates4BaseSum - enemy4BaseSum >= TEAMFIGHTCARRY_THRESHOLD;
}

// ============================================
// 有效属性（应用策略乘数）
// ============================================
export interface AttrMods {
  strat: Strat;
  solokill: boolean; // 单线击穿是否触发（仅 strat=challenge 有意义）
  teamfightCarry: boolean; // 团战游龙是否触发（仅 strat=sacrifice 有意义）
}

function clampAttrs(a: Attributes): Attributes {
  const out = {} as Attributes;
  (Object.keys(a) as AttrKey[]).forEach((k) => {
    out[k] = clamp(Math.round(a[k]), 0, ATTR_MAX);
  });
  return out;
}

/**
 * 计算一名选手在单局中的有效属性。
 * - 亮剑 challenge：玩家 ×1.1，队友 ×0.9；若单线击穿则玩家 ×1.3、队友 ×1.0（惩罚解除）
 * - 奉献 sacrifice：玩家 ×0.8，队友 ×1.1；若团战游龙则队友 ×1.2（玩家仍 ×0.8）
 * - none：不变
 */
export function effectiveAttrs(
  base: Attributes,
  _position: import('../types').Position,
  isCustom: boolean,
  mods: AttrMods,
): Attributes {
  let mult = 1.0;
  if (mods.strat === 'challenge') {
    if (isCustom) {
      mult = mods.solokill ? SOLOKILL_SELF_MULT : CHALLENGE_SELF_MULT;
    } else {
      mult = mods.solokill ? SOLOKILL_TEAM_MULT : CHALLENGE_TEAM_MULT;
    }
  } else if (mods.strat === 'sacrifice') {
    if (isCustom) {
      mult = SACRIFICE_SELF_MULT; // 玩家始终自我削弱
    } else {
      mult = mods.teamfightCarry ? TEAMFIGHTCARRY_TEAM_MULT : SACRIFICE_TEAM_MULT;
    }
  }

  if (mult === 1.0) return { ...base };
  const out = {} as Attributes;
  (Object.keys(base) as AttrKey[]).forEach((k) => {
    out[k] = base[k] * mult;
  });
  return clampAttrs(out);
}
