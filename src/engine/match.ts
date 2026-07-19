import type { GameResult, KDA, Player, PlayerGameStat, PlayerSeriesStat, SeriesResult, Team, Strat } from '../types';
import { RANDOM_VARIANCE } from '../constants';
import { gaussian, randInt, chance } from '../utils/random';
import { clamp } from '../utils/clamp';
import {
  effectiveAttrs,
  teamfightSum,
  checkSolokill,
  checkTeamfightCarry,
  type AttrMods,
} from './breakthrough';
import { calcBothPower, calcPlayerPower } from './power';
import { generateEvents, type EventCtx } from './events';

// ============================================
// 预期胜率（仅用于 UI 展示，判胜负用高斯扰动）
// ============================================
export function calcWinRate(myPower: number, enemyPower: number): number {
  return 1 / (1 + Math.exp((enemyPower - myPower) / 60));
}

// ============================================
// 单局模拟
// ============================================
export interface GameOpts {
  myTeam: Team;
  enemyTeam: Team;
  customPlayer: Player;
  strat: Strat; // 本局策略（关键局才非 none）
}

export function simulateGame(opts: GameOpts): GameResult {
  const { myTeam, enemyTeam, customPlayer, strat } = opts;

  // 对位选手（同位置）
  const enemyCounterpart =
    enemyTeam.roster.find((p) => p.position === customPlayer.position) ?? enemyTeam.roster[0];

  // —— 单线击穿判定（亮剑，基于基础对线和）——
  const solokill =
    strat === 'challenge' &&
    checkSolokill(customPlayer.attributes, enemyCounterpart.attributes);

  // —— 团战游龙判定（奉献，基于 4 队友 vs 敌方 4 人基础团战和）——
  const mates4Sum = myTeam.roster
    .filter((p) => p.position !== customPlayer.position)
    .reduce((s, p) => s + teamfightSum(p.attributes), 0);
  const enemy4Sum = enemyTeam.roster
    .filter((p) => p.position !== enemyCounterpart.position)
    .reduce((s, p) => s + teamfightSum(p.attributes), 0);
  const teamfightCarry =
    strat === 'sacrifice' && checkTeamfightCarry(mates4Sum, enemy4Sum);

  const mods: AttrMods = { strat, solokill, teamfightCarry };
  const { myPower, enemyPower } = calcBothPower(myTeam, customPlayer, enemyTeam, mods);

  // 高斯扰动决定胜负
  const myRoll = myPower * gaussian(1, RANDOM_VARIANCE);
  const enRoll = enemyPower * gaussian(1, RANDOM_VARIANCE);
  const isWin = myRoll > enRoll;

  const { kda, rating } = genPerformance(customPlayer, mods, isWin);

  const posLabelMap: Record<string, string> = {
    top: '上单', jungle: '打野', mid: '中单', adc: '下路', support: '辅助',
  };
  const ctx: EventCtx = {
    playerName: customPlayer.name,
    enemyName: enemyCounterpart.name,
    myTeamName: myTeam.name,
    enemyTeamName: enemyTeam.name,
    posLabel: posLabelMap[customPlayer.position],
    strat, solokill, teamfightCarry, isWin,
  };
  const events = generateEvents(ctx);

  // 本局全员数据：自建选手用主结果，其余 9 人简化生成（团战游龙时队友同享加成）
  const noneMods: AttrMods = { strat: 'none', solokill: false, teamfightCarry: false };
  const mateMods: AttrMods = teamfightCarry
    ? { ...noneMods, teamfightCarry: true }
    : noneMods;
  const stats: PlayerGameStat[] = [
    {
      playerId: customPlayer.id,
      name: customPlayer.name,
      teamId: myTeam.id,
      position: customPlayer.position,
      kills: kda.kills,
      deaths: kda.deaths,
      assists: kda.assists,
      rating,
    },
    ...myTeam.roster
      .filter((p) => p.position !== customPlayer.position)
      .map((p) => {
        const perf = genPerformance(p, mateMods, isWin);
        return {
          playerId: p.id,
          name: p.name,
          teamId: myTeam.id,
          position: p.position,
          kills: perf.kda.kills,
          deaths: perf.kda.deaths,
          assists: perf.kda.assists,
          rating: perf.rating,
        };
      }),
    ...enemyTeam.roster.map((p) => {
      const perf = genPerformance(p, noneMods, !isWin);
      return {
        playerId: p.id,
        name: p.name,
        teamId: enemyTeam.id,
        position: p.position,
        kills: perf.kda.kills,
        deaths: perf.kda.deaths,
        assists: perf.kda.assists,
        rating: perf.rating,
      };
    }),
  ];

  return {
    isWin,
    kda,
    rating,
    events,
    strat,
    solokillTriggered: solokill,
    teamfightCarryTriggered: teamfightCarry,
    duration: randInt(26, 42),
    stats,
  };
}

// ============================================
// 个人表现（KDA + 评分）
// ============================================
function genPerformance(
  player: Player,
  mods: AttrMods,
  isWin: boolean,
): { kda: KDA; rating: number } {
  const eff = effectiveAttrs(player.attributes, player.position, true, mods);
  const power = calcPlayerPower(eff, player.position);
  const skill = clamp((power - 45) / 55, 0, 1.4);

  let kills = Math.round(skill * 5 + randInt(0, 4));
  let assists = randInt(2, 10) + Math.round(skill * 4);
  let deaths = isWin ? randInt(0, 3) : randInt(2, 6);

  // 单线击穿 → 个人数据爆炸
  if (mods.solokill) {
    kills += randInt(2, 4);
    deaths = Math.max(0, deaths - 2);
    assists += randInt(0, 2);
  }
  // 亮剑但未击穿 → 风险更高
  if (mods.strat === 'challenge' && !mods.solokill && chance(0.4)) {
    deaths += 1;
  }
  // 奉献 → 玩家让资源，KDA 偏低
  if (mods.strat === 'sacrifice') {
    kills = Math.max(0, kills - randInt(1, 3));
    assists += randInt(1, 4); // 但助攻多
  }

  kills = Math.max(0, kills);
  assists = Math.max(0, assists);
  deaths = Math.max(0, deaths);

  const ratio = deaths === 0 ? kills + assists : (kills + assists) / deaths;
  let rating = clamp(5 + ratio * 0.8 + (isWin ? 1.2 : -1.2), 1, 10);
  if (mods.solokill) rating = clamp(rating + 1.5, 1, 10);
  if (mods.teamfightCarry) rating = clamp(rating + 0.8, 1, 10); // 团队游龙，玩家也有功劳
  if (mods.strat === 'sacrifice') rating = clamp(rating - 0.5, 1, 10); // 牺牲个人数据
  rating = Math.round(rating * 10) / 10;

  return { kda: { kills, deaths, assists }, rating };
}

// ============================================
// 系列赛（BO1/BO3/BO5）
// ============================================

/** 把若干局的 10 人数据聚合为系列赛战绩表（KDA 累计、评分取场均） */
export function aggregateBoard(games: GameResult[]): PlayerSeriesStat[] {
  const agg = new Map<string, PlayerSeriesStat>();
  for (const g of games) {
    for (const s of g.stats ?? []) {
      const cur = agg.get(s.playerId) ?? {
        playerId: s.playerId,
        name: s.name,
        teamId: s.teamId,
        position: s.position,
        kills: 0,
        deaths: 0,
        assists: 0,
        games: 0,
        rating: 0,
      };
      cur.kills += s.kills;
      cur.deaths += s.deaths;
      cur.assists += s.assists;
      cur.games += 1;
      cur.rating += s.rating;
      agg.set(s.playerId, cur);
    }
  }
  return [...agg.values()].map((s) => ({
    ...s,
    rating: Math.round((s.rating / (s.games || 1)) * 10) / 10,
  }));
}

export interface SeriesOpts {
  bestOf: 1 | 3 | 5;
  myTeam: Team;
  enemyTeam: Team;
  customPlayer: Player;
  /** 关键局（BO5 赛点局）玩家选择的策略，每个系列仅在第一个赛点局生效一次 */
  decisiveStrat?: Strat;
}

export function simulateSeries(opts: SeriesOpts): SeriesResult {
  const need = Math.ceil(opts.bestOf / 2);
  let myWin = 0;
  let enWin = 0;
  let stratUsed = false;
  const games: GameResult[] = [];

  let guard = 0;
  while (myWin < need && enWin < need && guard < 10) {
    guard++;
    // 赛点局 = 任一方再赢一局即结束。BO5 时在此局使用玩家策略（仅一次）
    const isMatchPoint =
      opts.bestOf === 5 && (myWin === need - 1 || enWin === need - 1);
    const strat: Strat =
      !stratUsed && isMatchPoint && opts.decisiveStrat ? opts.decisiveStrat : 'none';
    if (strat !== 'none') stratUsed = true;

    const g = simulateGame({
      myTeam: opts.myTeam,
      enemyTeam: opts.enemyTeam,
      customPlayer: opts.customPlayer,
      strat,
    });
    games.push(g);
    if (g.isWin) myWin++;
    else enWin++;
  }

  return {
    bestOf: opts.bestOf,
    opponentId: opts.enemyTeam.id,
    games,
    myWin,
    enWin,
    isWin: myWin > enWin,
    board: aggregateBoard(games),
  };
}
