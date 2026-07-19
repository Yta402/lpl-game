// ============================================
// 核心类型定义
// ============================================

export type Region = 'LPL' | 'LCK' | 'LEC' | 'LCS' | 'PCS' | 'VCS';

export type Position = 'top' | 'jungle' | 'mid' | 'adc' | 'support';

export type Tournament = 'spring' | 'msi' | 'summer' | 'worlds';

// 游戏流程阶段（有限状态机）
export type Phase =
  | 'menu'
  | 'create'
  | 'inherit'
  | 'select-team'
  | 'season-hub'
  | 'result';

// ============================================
// 属性系统：9 维 3 组
// ============================================
export interface Attributes {
  // 对线组 Laning
  mechanics: number; // 操作
  reaction: number; // 反应
  farming: number; // 发育
  // 团战组 Teamfight
  teamwork: number; // 配合
  macro: number; // 意识
  engage: number; // 开团
  // 深度组 Depth
  championPool: number; // 英雄池
  mentality: number; // 心态
  communication: number; // 沟通
}

export type AttrKey = keyof Attributes;

export const LANDING_KEYS: AttrKey[] = ['mechanics', 'reaction', 'farming'];
export const TEAMFIGHT_KEYS: AttrKey[] = ['teamwork', 'macro', 'engage'];
export const DEPTH_KEYS: AttrKey[] = ['championPool', 'mentality', 'communication'];

export type AttrGroup = 'laning' | 'teamfight' | 'depth';

// ============================================
// 选手与战队
// ============================================
export interface Player {
  id: string;
  name: string; // 真实 ID 或自建昵称
  position: Position;
  attributes: Attributes;
  avatarColor: string; // 头像渐变主色
  isCustom: boolean; // 是否玩家自建
}

export interface Team {
  id: string;
  name: string; // 真实战队名，如 "JDG"
  fullName: string;
  region: Region;
  style: string; // 运营流/打架队/快节奏
  logoColor: string;
  roster: Player[]; // 5 位置真实选手
  teamwork: number; // 团队配合度 0-100
}

// ============================================
// 赛区强度档
// ============================================
export interface RegionTier {
  base: number;
  variance: number;
}

export const REGION_TIER: Record<Region, RegionTier> = {
  LCK: { base: 85, variance: 8 },
  LPL: { base: 82, variance: 10 },
  LEC: { base: 72, variance: 10 },
  LCS: { base: 68, variance: 10 },
  PCS: { base: 60, variance: 12 },
  VCS: { base: 58, variance: 12 },
};

// ============================================
// 比赛结果
// ============================================
export interface KDA {
  kills: number;
  deaths: number;
  assists: number;
}

// 关键局策略（MSI/世界赛 BO5 决胜局玩家主动选择）
export type Strat = 'none' | 'challenge' | 'sacrifice';

// 赛事个人奖项
export interface Award {
  type: 'MVP' | 'FMVP'; // MVP=常规赛最有价值选手；FMVP=总决赛最有价值选手
  tournament: Tournament;
  playerId: string;
  playerName: string;
  isCustom: boolean; // 是否颁给玩家自建选手
}

export interface GameResult {
  isWin: boolean;
  kda: KDA;
  rating: number; // 0-10
  events: string[]; // 事件文字播报
  strat: Strat; // 本局使用的策略
  solokillTriggered: boolean; // 亮剑→单线击穿 是否触发
  teamfightCarryTriggered: boolean; // 奉献→团战游龙 是否触发
  duration: number; // 分钟
}

export interface SeriesResult {
  bestOf: 1 | 3 | 5;
  opponentId: string;
  games: GameResult[];
  myWin: number;
  enWin: number;
  isWin: boolean;
  board?: PlayerSeriesStat[]; // 双方 10 名选手的系列赛累计战绩（仅玩家参与的场次生成）
}

/** 单名选手在一个系列赛中的累计战绩 */
export interface PlayerSeriesStat {
  playerId: string;
  name: string;
  teamId: string;
  position: Position;
  kills: number; // 系列累计
  deaths: number;
  assists: number;
  games: number; // 出场局数
  rating: number; // 系列场均评分（1 位小数）
}

/** 时间线上的一场比赛（玩家或 AI 均可），用于季后赛逐场模拟展示 */
export interface MatchRecord {
  stage: 'regular' | 'playoff';
  label: string; // '常规赛' / '小组赛 A组' / '半决赛' / '胜者组决赛' / '总决赛' …
  teamAId: string;
  teamBId: string;
  bestOf: 1 | 3 | 5;
  winA: number;
  winB: number;
  winnerId: string;
  series?: SeriesResult; // 仅玩家参与的场次有（含每局详情 + board）
}

// ============================================
// 积分榜
// ============================================
export interface Standing {
  teamId: string;
  wins: number;
  losses: number;
}

// ============================================
// 赛季/赛事进度
// ============================================
export interface SeasonResult {
  tournament: Tournament;
  regularGames?: SeriesResult[]; // 常规赛（BO1，每场 bestOf=1）
  playoffGames: SeriesResult[]; // 季后赛
  finalRank: number; // 最终名次
  qualified: boolean; // 是否晋级下一国际赛事
  champion: boolean; // 是否夺冠
  standings?: Standing[]; // 常规赛/小组赛积分榜
  groupStandings?: Standing[]; // 世界赛小组榜
  topTeams?: string[]; // 该赛事排名最靠前的队伍 id（供 MSI/世界赛抽签用）
  placements?: Record<string, number>; // 该赛事各队名次（teamId→名次），用于跨赛事积分
  awards?: Award[]; // 该赛事颁发的个人奖项（MVP/FMVP）
  timeline?: MatchRecord[]; // 全部比赛按真实顺序记录（供季后赛逐场模拟展示）
}

export interface CareerProgress {
  spring?: SeasonResult;
  msi?: SeasonResult;
  summer?: SeasonResult;
  worlds?: SeasonResult;
}

// ============================================
// 存档
// ============================================
export interface GameSave {
  customPlayer: Player;
  teamId: string;
  inheritedFrom: string[]; // 继承自哪些选手
  career: CareerProgress;
  achievements: string[];
  createdAt: number;
}

// ============================================
// 继承阶段临时状态
// ============================================
export interface InheritanceChoice {
  playerId: string;
  attr: AttrKey | null; // null 表示放弃该选手的继承
}
