import type { AttrKey, AttrGroup, Position } from '../types';
import { LANDING_KEYS, TEAMFIGHT_KEYS, DEPTH_KEYS } from '../types';

// ============================================
// 位置中英文映射
// ============================================
export const POSITION_LABEL: Record<Position, string> = {
  top: '上单',
  jungle: '打野',
  mid: '中单',
  adc: '下路',
  support: '辅助',
};

export const POSITION_ORDER: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];

// ============================================
// 属性元数据
// ============================================
export interface AttrMeta {
  key: AttrKey;
  label: string;
  group: AttrGroup;
  desc: string;
}

export const ATTR_META: AttrMeta[] = [
  // 对线组
  { key: 'mechanics', label: '操作', group: 'laning', desc: '微操、技能命中率、走位精度' },
  { key: 'reaction', label: '反应', group: 'laning', desc: '躲技能、瞬时判断、操作速度' },
  { key: 'farming', label: '发育', group: 'laning', desc: '补刀、经济效率、资源控制' },
  // 团战组
  { key: 'teamwork', label: '配合', group: 'teamfight', desc: '与队友联动、集火目标选择' },
  { key: 'macro', label: '意识', group: 'teamfight', desc: '大局观、地图意识、节奏判断' },
  { key: 'engage', label: '开团', group: 'teamfight', desc: '发起团战、找机会能力' },
  // 深度组
  { key: 'championPool', label: '英雄池', group: 'depth', desc: '英雄广度、版本适配英雄' },
  { key: 'mentality', label: '心态', group: 'depth', desc: '关键局抗压、逆风韧性' },
  { key: 'communication', label: '沟通', group: 'depth', desc: '指挥、信息同步、节奏调度' },
];

export const GROUP_LABEL: Record<AttrGroup, string> = {
  laning: '对线组',
  teamfight: '团战组',
  depth: '深度组',
};

export const ATTR_BY_GROUP: Record<AttrGroup, AttrKey[]> = {
  laning: LANDING_KEYS,
  teamfight: TEAMFIGHT_KEYS,
  depth: DEPTH_KEYS,
};

export function attrGroup(key: AttrKey): AttrGroup {
  if (LANDING_KEYS.includes(key)) return 'laning';
  if (TEAMFIGHT_KEYS.includes(key)) return 'teamfight';
  return 'depth';
}

// ============================================
// 位置权重：决定各属性组对战力的贡献
// ============================================
export const POSITION_WEIGHTS: Record<
  Position,
  { laning: number; teamfight: number; depth: number }
> = {
  top: { laning: 1.2, teamfight: 0.9, depth: 0.9 },
  jungle: { laning: 0.8, teamfight: 1.2, depth: 1.0 },
  mid: { laning: 1.15, teamfight: 1.0, depth: 0.85 },
  adc: { laning: 1.1, teamfight: 0.95, depth: 0.95 },
  support: { laning: 0.7, teamfight: 1.25, depth: 1.05 },
};

// ============================================
// 数值参数
// ============================================
export const ATTR_MIN = 0;
export const ATTR_MAX = 99;

// —— 亮剑（玩家主动，MSI/世界赛 BO5 决胜局）——
export const CHALLENGE_SELF_MULT = 1.1; // 亮剑：玩家全属性
export const CHALLENGE_TEAM_MULT = 0.9; // 亮剑：队友全属性（惩罚）
export const SOLOKILL_SELF_MULT = 1.3; // 单线击穿：玩家（替换上面）
export const SOLOKILL_TEAM_MULT = 1.0; // 单线击穿：队友（惩罚解除）
export const SOLOKILL_THRESHOLD = 18; // 玩家对线和 − 对位对线和（基础值）

// —— 奉献（同关键局的另一选项）——
export const SACRIFICE_SELF_MULT = 0.8; // 奉献：玩家全属性（自我削弱）
export const SACRIFICE_TEAM_MULT = 1.1; // 奉献：队友全属性
export const TEAMFIGHTCARRY_TEAM_MULT = 1.2; // 团战游龙：队友（替换上面）
export const TEAMFIGHTCARRY_THRESHOLD = 60; // 4 队友团战和 − 敌方 4 团战和（基础值）

// 战力/胜率公式参数
export const WINRATE_SCALE = 60; // Sigmoid 陡峭度（仅用于显示预期胜率）
export const RANDOM_VARIANCE = 0.12; // 高斯随机标准差（爆冷幅度）

// 奖项评选：玩家夺得该奖项所需的最低评分
export const FMVP_PLAYER_RATING = 6.5; // 决赛 FMVP：玩家决赛均分 ≥ 此值且夺冠
export const MVP_PLAYER_RATING = 7.5; // 常规赛 MVP：玩家常规赛均分 ≥ 此值且队伍前三

// 新建选手属性总基线（9 项总和）
export const CUSTOM_PLAYER_TOTAL = 340;

// 头像配色板（程序生成头像用）
export const AVATAR_COLORS = [
  '#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635',
  '#34d399', '#22d3ee', '#60a5fa', '#818cf8', '#a78bfa',
  '#c084fc', '#e879f9', '#f472b6',
];
