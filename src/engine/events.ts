import { pick, randInt, chance } from '../utils/random';
import type { Strat } from '../types';

export interface EventCtx {
  playerName: string;
  enemyName: string;
  myTeamName: string;
  enemyTeamName: string;
  posLabel: string;
  strat: Strat;
  solokill: boolean;
  teamfightCarry: boolean;
  isWin: boolean;
}

const OPENERS = (c: EventCtx) => [
  `比赛开始，双方在召唤师峡谷列阵，${c.myTeamName} 选手们神情专注。`,
  `BP 结束，${c.playerName} 锁定本命英雄，镜头给到 ${c.enemyName} 的对位选手。`,
  `一级团前试探，${c.myTeamName} 在野区布下视野，气氛紧绷。`,
];

function earlyLane(c: EventCtx): string {
  if (c.solokill) {
    return pick([
      `${c.playerName}（${c.posLabel}）彻底打穿对位！单杀 ${c.enemyName}，补刀全面领先！`,
      `对线期 ${c.playerName} 操作拉满，${c.enemyName} 塔下苟活，单线已经崩盘。`,
      `${c.playerName} 连续单杀，敌方打野来帮也挡不住，单线击穿！`,
    ]);
  }
  if (c.strat === 'challenge') {
    return pick([
      `${c.playerName} 选择亮剑强压对线，但 ${c.enemyName} 顶住压力，节奏紧咬。`,
      `${c.playerName} 主动换血拼操作，对线火花四溅，视野有所缺失。`,
    ]);
  }
  if (c.strat === 'sacrifice') {
    return pick([
      `${c.playerName} 主动让资源做视野，把兵线和野区让给队友发育。`,
      `${c.playerName} 选了工具人英雄游走支援，把carry机会让给队友。`,
    ]);
  }
  return pick([
    `对线期 ${c.playerName} 与 ${c.enemyName} 互有来回，兵线平稳。`,
    `${c.playerName} 稳健发育，补刀不落下风。`,
    `双方 ${c.posLabel} 都在试探，等待打野节奏。`,
  ]);
}

function dragonFight(c: EventCtx): string {
  if (c.teamfightCarry) {
    return pick([
      `小龙团战 ${c.myTeamName} 队友完美配合，连续收割打出 0 换 4，团战游龙！`,
      `${c.myTeamName} 团战默契拉满，${c.playerName} 做视野开路，队友四打四碾压拿下小龙。`,
    ]);
  }
  if (c.strat === 'challenge' && !c.solokill) {
    return pick([
      `小龙团 ${c.playerName} 专注单线未能及时赶到，${c.myTeamName} 团战少打多丢掉小龙。`,
      `${c.myTeamName} 团战受 ${c.playerName} 单线节奏影响稍乱，让出小龙。`,
    ]);
  }
  if (c.isWin) {
    return pick([
      `小龙团战 ${c.myTeamName} 完美开团，拿下小龙并打出优势换人！`,
      `${c.myTeamName} 抢下小龙，节奏起飞。`,
    ]);
  }
  return pick([
    `小龙团 ${c.enemyTeamName} 先手开团，${c.myTeamName} 被迫撤退让出小龙。`,
    `双方争夺激烈，${c.enemyTeamName} 凭阵容优势控下小龙。`,
  ]);
}

function baronFight(c: EventCtx): string {
  if (c.isWin) {
    return pick([
      `大龙坑决战，${c.playerName} 侧翼切入秒杀后排，${c.myTeamName} 拿下大龙！`,
      `${c.myTeamName} 41 分带牵扯成功，转大龙逼退 ${c.enemyTeamName}。`,
    ]);
  }
  return pick([
    `${c.enemyTeamName} 抢到大龙，${c.myTeamName} 关键团战失利。`,
    `大龙团 ${c.playerName} 被先手秒杀，${c.myTeamName} 节节败退。`,
  ]);
}

function ending(c: EventCtx): string {
  if (c.isWin) {
    if (c.solokill) return `${c.playerName} 单线打穿带领 ${c.myTeamName} 推平水晶，全场 MVP！`;
    if (c.teamfightCarry) return `${c.myTeamName} 团战游龙推平水晶，${c.playerName} 的奉献成就团队胜利！`;
    return pick([
      `${c.myTeamName} 推平敌方水晶，${c.playerName} 表现出色！`,
      `比赛结束，${c.myTeamName} 拿下胜利，观众席欢呼雷动。`,
    ]);
  }
  return pick([
    `${c.enemyTeamName} 推平水晶，${c.myTeamName} 遗憾落败。`,
    `比赛结束，${c.myTeamName} 输掉本局，需要调整状态。`,
    `${c.enemyTeamName} 后期团战更胜一筹，${c.myTeamName} 未能翻盘。`,
  ]);
}

export function generateEvents(c: EventCtx): string[] {
  const events: string[] = [];
  events.push(pick(OPENERS(c)));
  events.push(earlyLane(c));
  if (chance(0.9)) events.push(dragonFight(c));
  if (chance(0.85)) events.push(baronFight(c));
  events.push(ending(c));
  void randInt;
  return events;
}
