import type { Player, AttrKey, Attributes } from '../types';
import { ATTR_META } from '../constants';
import { ATTR_MAX } from '../constants';
import { clamp } from '../utils/clamp';

/** 继承比例：新属性 = 基础×(1-R) + 源值×R。越大越接近源选手。 */
const INHERIT_RATIO = 0.72;

export interface InheritanceItem {
  playerId: string;
  attr: AttrKey;
  value: number; // 源选手的该属性值
}

export interface InheritanceResult {
  player: Player;
  inheritedFrom: string[]; // 继承自哪些选手 id
}

/**
 * 将继承的属性混合到玩家基础属性上（blend，软上限 ATTR_MAX）。
 * - 新属性 = 基础×(1-R) + 源值×R，朝源选手方向移动 R 比例
 * - 选源值高的属性收益更大，保留策略深度（补短板 vs 拉长板）
 */
export function applyInheritance(
  player: Player,
  items: InheritanceItem[],
): InheritanceResult {
  const attrs = { ...player.attributes };
  const inheritedFrom: string[] = [];

  for (const item of items) {
    const base = attrs[item.attr];
    const blended = base * (1 - INHERIT_RATIO) + item.value * INHERIT_RATIO;
    attrs[item.attr] = clamp(Math.round(blended), 0, ATTR_MAX);
    if (!inheritedFrom.includes(item.playerId)) {
      inheritedFrom.push(item.playerId);
    }
  }

  return {
    player: { ...player, attributes: attrs },
    inheritedFrom,
  };
}

// ============================================
// 继承 v2：8 槽（每属性一槽）+ 顺序选择 + 替换惩罚
// ============================================

/** 单个属性槽：来自哪位选手、值多少 */
export interface SlotValue {
  playerId: string;
  playerName: string;
  value: number;
  isPenalty?: boolean; // 是否为替换惩罚带入的最弱项
}

export type Slots = Partial<Record<AttrKey, SlotValue>>;

/** 找出选手最弱的属性（用于替换惩罚）。可排除某项。 */
export function weakestAttr(attrs: Attributes, exclude?: AttrKey): AttrKey {
  let worst: AttrKey = ATTR_META[0].key;
  let worstVal = Infinity;
  for (const m of ATTR_META) {
    if (m.key === exclude) continue;
    if (attrs[m.key] < worstVal) {
      worstVal = attrs[m.key];
      worst = m.key;
    }
  }
  return worst;
}

/**
 * 把 8 个槽的继承值混合进玩家基础属性。
 * 每个有值的槽：final = 基础×(1-R) + 槽值×R；无值的槽保持基础。
 */
export function applySlots(player: Player, slots: Slots): Player {
  const attrs = { ...player.attributes };
  for (const key of Object.keys(slots) as AttrKey[]) {
    const s = slots[key];
    if (!s) continue;
    const blended = player.attributes[key] * (1 - INHERIT_RATIO) + s.value * INHERIT_RATIO;
    attrs[key] = clamp(Math.round(blended), 0, ATTR_MAX);
  }
  return { ...player, attributes: attrs };
}
