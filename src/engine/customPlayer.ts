import type { Attributes, Player, Position } from '../types';
import { POSITION_WEIGHTS, AVATAR_COLORS, CUSTOM_PLAYER_TOTAL } from '../constants';
import { clamp } from '../utils/clamp';
import { pick } from '../utils/random';

/**
 * 生成自建选手的基础属性。
 * - 总分约 CUSTOM_PLAYER_TOTAL（9 项均值 ~33，明显低于职业选手）
 * - 按位置权重分布：位置擅长的组略高
 * - 有少量随机扰动，每次创建略有不同
 */
export function genCustomBaseAttrs(position: Position): Attributes {
  const w = POSITION_WEIGHTS[position];
  // 权重越高 → 该组的基准均值越高
  const totalWeight = w.laning + w.teamfight + w.depth;
  const groupBase = (weight: number) => (CUSTOM_PLAYER_TOTAL * weight) / totalWeight / 3;

  const laningAvg = groupBase(w.laning);
  const tfAvg = groupBase(w.teamfight);
  const depthAvg = groupBase(w.depth);

  const jitter = (avg: number) => clamp(Math.round(avg + (Math.random() * 2 - 1) * 6), 10, 60);

  return {
    mechanics: jitter(laningAvg),
    reaction: jitter(laningAvg),
    farming: jitter(laningAvg),
    teamwork: jitter(tfAvg),
    macro: jitter(tfAvg),
    engage: jitter(tfAvg),
    championPool: jitter(depthAvg),
    mentality: jitter(depthAvg),
    communication: jitter(depthAvg),
  };
}

export interface CustomPlayerInput {
  name: string;
  position: Position;
  gender: 'male' | 'female';
}

export function createCustomPlayer(input: CustomPlayerInput): Player {
  const attrs = genCustomBaseAttrs(input.position);
  return {
    id: 'custom-player',
    name: input.name.trim() || '新人选手',
    position: input.position,
    attributes: attrs,
    avatarColor: pick(AVATAR_COLORS),
    isCustom: true,
  };
}

/**
 * 赛季成长：根据本阶段平均评分提升属性。
 * 评分越高成长越多；优先提升对线组（实战锻炼）。
 * 每项成长幅度小，避免数值膨胀。
 */
export function growPlayer(player: Player, avgRating: number): Player {
  const attrs = { ...player.attributes };
  // 基础成长：评分 5 → +0.5，评分 10 → +3
  const baseGrowth = Math.max(0, (avgRating - 5) * 0.6);
  // 对线组成长系数更高（实战主要练对线）
  const growthPlan: { key: keyof typeof attrs; weight: number }[] = [
    { key: 'mechanics', weight: 1.2 },
    { key: 'reaction', weight: 1.0 },
    { key: 'farming', weight: 1.0 },
    { key: 'teamwork', weight: 0.8 },
    { key: 'macro', weight: 0.8 },
    { key: 'engage', weight: 0.7 },
    { key: 'mentality', weight: 0.9 },
    { key: 'communication', weight: 0.9 },
    { key: 'championPool', weight: 0.9 },
  ];
  for (const { key, weight } of growthPlan) {
    const gain = baseGrowth * weight + Math.random() * 0.5;
    attrs[key] = clamp(Math.round((attrs[key] + gain) * 10) / 10, 0, 99);
  }
  return { ...player, attributes: attrs };
}
