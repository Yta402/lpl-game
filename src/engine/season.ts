import type {
  Team,
  Player,
  Position,
  SeriesResult,
  SeasonResult,
  Standing,
  Region,
  Strat,
  Tournament,
  Award,
  MatchRecord,
  GameResult,
} from '../types';
import { TEAMS, TEAM_BY_ID, getTeam, getLplTeams } from '../data/teams';
import { simulateSeries, simulateGame, aggregateBoard, type SeriesOpts } from './match';
import { calcTeamPower, calcPlayerPower } from './power';
import { FMVP_PLAYER_RATING, MVP_PLAYER_RATING } from '../constants';

// ============================================
// AI 战队基础战力（不含自建玩家）
// ============================================
export function teamBasePower(team: Team): number {
  const roster = team.roster.map((p) => ({
    position: p.position,
    attrs: p.attributes,
  }));
  return calcTeamPower(roster, team.teamwork, undefined, undefined);
}

// ============================================
// 个人奖项评选：MVP（常规赛）/ FMVP（总决赛）
// 玩家夺冠且个人评分达标 → 颁给玩家；否则颁给该队/联赛最强职业选手
// ============================================
function playerPower(p: Player): number {
  return calcPlayerPower(p.attributes, p.position);
}
function topPlayerOnTeam(team: Team): Player {
  return team.roster.slice().sort((a, b) => playerPower(b) - playerPower(a))[0];
}
function strongestTeammate(team: Team, excludePosition: Position): Player {
  return team.roster
    .filter((p) => p.position !== excludePosition)
    .slice()
    .sort((a, b) => playerPower(b) - playerPower(a))[0];
}
function topPlayerAmong(teamIds: string[]): Player {
  let best: Player | null = null;
  let bestP = -1;
  for (const id of teamIds) {
    for (const p of getTeam(id).roster) {
      const pw = playerPower(p);
      if (pw > bestP) {
        bestP = pw;
        best = p;
      }
    }
  }
  return best ?? getTeam(teamIds[0]).roster[0];
}
function avgRating(series: SeriesResult[] | undefined): number {
  const games = (series ?? []).flatMap((s) => s.games);
  if (games.length === 0) return 0;
  return games.reduce((s, g) => s + g.rating, 0) / games.length;
}

/** 总决赛 FMVP：夺冠队伍里表现最好的。玩家夺冠且决赛均分达标 → 玩家。 */
function finalsMvp(
  tournament: Tournament,
  championId: string,
  playerSeries: SeriesResult[],
  myTeam: Team,
  customPlayer: Player,
): Award {
  if (championId === myTeam.id && playerSeries.length > 0) {
    const fs = playerSeries[playerSeries.length - 1]; // 决赛（玩家夺冠路径最后一轮）
    const avgR = fs.games.reduce((s, g) => s + g.rating, 0) / (fs.games.length || 1);
    if (avgR >= FMVP_PLAYER_RATING) {
      return { type: 'FMVP', tournament, playerId: customPlayer.id, playerName: customPlayer.name, isCustom: true };
    }
    // 玩家决赛拉胯 → 颁给最强队友
    const mate = strongestTeammate(getTeam(championId), customPlayer.position);
    return { type: 'FMVP', tournament, playerId: mate.id, playerName: mate.name, isCustom: false };
  }
  // AI 队伍夺冠 → 该队最强选手
  const star = topPlayerOnTeam(getTeam(championId));
  return { type: 'FMVP', tournament, playerId: star.id, playerName: star.name, isCustom: false };
}

/** 常规赛 MVP：玩家常规赛均分达标且队伍前三 → 玩家；否则联赛前四队伍里最强选手。 */
function seasonMvp(
  tournament: Tournament,
  regularSeries: SeriesResult[] | undefined,
  standings: Standing[] | undefined,
  myTeam: Team,
  customPlayer: Player,
): Award {
  const avgR = avgRating(regularSeries);
  const rank = (standings ?? []).findIndex((s) => s.teamId === myTeam.id);
  if (avgR >= MVP_PLAYER_RATING && rank >= 0 && rank <= 2) {
    return { type: 'MVP', tournament, playerId: customPlayer.id, playerName: customPlayer.name, isCustom: true };
  }
  const top4 = (standings ?? []).slice(0, 4).map((s) => s.teamId);
  const star = topPlayerAmong(top4.length ? top4 : getLplTeams().map((t) => t.id));
  return { type: 'MVP', tournament, playerId: star.id, playerName: star.name, isCustom: false };
}

function simAiGame(a: Team, b: Team): boolean {
  const pa = teamBasePower(a);
  const pb = teamBasePower(b);
  const winA = 1 / (1 + Math.exp((pb - pa) / 60));
  return Math.random() < winA;
}

function simAiSeries(a: Team, b: Team, bestOf: 1 | 3 | 5): SeriesResult {
  const need = Math.ceil(bestOf / 2);
  let aw = 0;
  let bw = 0;
  const games = [];
  let guard = 0;
  while (aw < need && bw < need && guard < 10) {
    guard++;
    const win = simAiGame(a, b);
    games.push({
      isWin: win,
      kda: { kills: 0, deaths: 0, assists: 0 },
      rating: 0,
      events: [],
      strat: 'none' as const,
      solokillTriggered: false,
      teamfightCarryTriggered: false,
      duration: 0,
    });
    if (win) aw++;
    else bw++;
  }
  return {
    bestOf,
    opponentId: b.id,
    games,
    myWin: aw,
    enWin: bw,
    isWin: aw > bw,
  };
}

function simPlayerSeries(
  myTeam: Team,
  enemy: Team,
  customPlayer: Player,
  bestOf: 1 | 3 | 5,
  decisiveStrat: Strat = 'none',
): SeriesResult {
  const opts: SeriesOpts = {
    bestOf,
    myTeam,
    enemyTeam: enemy,
    customPlayer,
    decisiveStrat,
  };
  return simulateSeries(opts);
}

// ============================================
// 统一：决定一场系列赛胜负
// 返回 winnerId + 玩家视角 series（仅当玩家参与时）
// ============================================

/** 季后赛时间线记录器：由 simulateX 创建，逐场收集 MatchRecord */
export interface MatchRecorder {
  record: (m: MatchRecord) => void;
}

function decideSeries(
  myTeam: Team,
  customPlayer: Player,
  aId: string,
  bId: string,
  bestOf: 1 | 3 | 5,
  decisiveStrat: Strat = 'none',
  rec?: MatchRecorder,
  label = '',
): { winnerId: string; loserId: string; series: SeriesResult | null } {
  const a = getTeam(aId);
  const b = getTeam(bId);
  const playerIn = aId === myTeam.id || bId === myTeam.id;

  if (playerIn) {
    const playerIsA = aId === myTeam.id;
    const enemy = playerIsA ? b : a;
    const s = simPlayerSeries(myTeam, enemy, customPlayer, bestOf, decisiveStrat);
    const playerWon = s.isWin;
    const aWon = playerIsA ? playerWon : !playerWon;
    rec?.record({
      stage: 'playoff',
      label,
      teamAId: aId,
      teamBId: bId,
      bestOf,
      winA: playerIsA ? s.myWin : s.enWin,
      winB: playerIsA ? s.enWin : s.myWin,
      winnerId: aWon ? aId : bId,
      series: s, // 玩家视角
    });
    return {
      winnerId: aWon ? aId : bId,
      loserId: aWon ? bId : aId,
      series: s, // 玩家视角
    };
  }
  const s = simAiSeries(a, b, bestOf);
  rec?.record({
    stage: 'playoff',
    label,
    teamAId: aId,
    teamBId: bId,
    bestOf,
    winA: s.myWin,
    winB: s.enWin,
    winnerId: s.isWin ? aId : bId,
  });
  return {
    winnerId: s.isWin ? aId : bId,
    loserId: s.isWin ? bId : aId,
    series: null,
  };
}

// ============================================
// 积分榜（Standing 已在 types 中定义，此处重导出）
// ============================================
export type { Standing };

/** 单循环常规赛：所有队伍互打一次 */
function simulateRoundRobin(
  myTeam: Team,
  customPlayer: Player,
  teams: Team[],
  bestOf: 1 | 3 = 1,
): { standings: Standing[]; playerSeries: SeriesResult[] } {
  const rec = new Map<string, { w: number; l: number }>();
  for (const t of teams) rec.set(t.id, { w: 0, l: 0 });
  const playerSeries: SeriesResult[] = [];

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const aId = teams[i].id;
      const bId = teams[j].id;
      const { winnerId, loserId, series } = decideSeries(
        myTeam,
        customPlayer,
        aId,
        bId,
        bestOf,
      );
      rec.get(winnerId)!.w++;
      rec.get(loserId)!.l++;
      if (series) playerSeries.push(series);
    }
  }
  const standings: Standing[] = [...rec.entries()]
    .map(([teamId, v]) => ({ teamId, wins: v.w, losses: v.l }))
    .sort((x, y) => y.wins - x.wins || x.losses - y.losses);
  return { standings, playerSeries };
}

// ============================================
// 单败淘汰赛（用于春季赛季后赛 Top4 / MSI / 世界赛可复用）
// 返回冠军 + 玩家参与的所有系列（玩家视角）
// ============================================
function runSingleElim(
  myTeam: Team,
  customPlayer: Player,
  seedIds: string[],
  bestOf: 1 | 3 | 5,
  decisiveStrat: Strat = 'none',
  rec?: MatchRecorder,
): {
  championId: string;
  runnerUpId: string;
  playerSeries: SeriesResult[];
  playerEliminatedInFinal: boolean;
  placements: Record<string, number>; // teamId → 名次（1冠军 / 2亚军 / 3-4半决赛 / 5-8四分之一）
} {
  let bracket = seedIds.slice();
  const playerSeries: SeriesResult[] = [];
  let runnerUpId = '';
  const placements: Record<string, number> = {};

  while (bracket.length > 1) {
    const next: string[] = [];
    const isFinalRound = bracket.length === 2;
    // 按本轮开赛时剩余队伍数命名轮次
    const roundLabel =
      bracket.length === 2
        ? '决赛'
        : bracket.length === 4
          ? '半决赛'
          : bracket.length === 8
            ? '1/4 决赛'
            : `${bracket.length} 进 ${bracket.length / 2}`;
    for (let i = 0; i < bracket.length; i += 2) {
      const aId = bracket[i];
      const bId = bracket[i + 1];
      const { winnerId, loserId, series } = decideSeries(
        myTeam,
        customPlayer,
        aId,
        bId,
        bestOf,
        decisiveStrat,
        rec,
        roundLabel,
      );
      next.push(winnerId);
      if (series) playerSeries.push(series);
      if (isFinalRound) runnerUpId = loserId;
      // 输者名次 = 本轮晋级后剩余队伍数 + 1
      // （8→4 的输者=5-8；4→2 的输者=3-4；2→1 的输者=2）
      placements[loserId] = next.length + 1;
    }
    bracket = next;
  }
  placements[bracket[0]] = 1; // 冠军

  const playerEliminatedInFinal =
    playerSeries.length > 0 &&
    !playerSeries[playerSeries.length - 1].isWin &&
    runnerUpId === myTeam.id;

  return {
    championId: bracket[0],
    runnerUpId,
    playerSeries,
    playerEliminatedInFinal,
    placements,
  };
}

// ============================================
// 春季赛
// ============================================
export interface SpringResult extends SeasonResult {
  standings: Standing[];
}

export function simulateSpring(myTeam: Team, customPlayer: Player): SpringResult {
  const allLpl = getLplTeams();
  // 1) 常规赛单循环
  const { standings, playerSeries } = simulateRoundRobin(
    myTeam,
    customPlayer,
    allLpl,
    1,
  );
  // 2) 季后赛 Top4（1v4 2v3 单败 BO5）——无论玩家是否晋级都跑完，决出冠军/亚军
  const top4 = standings.slice(0, 4).map((s) => s.teamId);
  const seeds = [top4[0], top4[3], top4[1], top4[2]]; // 1v4,2v3 配对
  const playerInPlayoff = top4.includes(myTeam.id);
  const timeline: MatchRecord[] = [];
  const rec: MatchRecorder = { record: (m) => timeline.push(m) };
  const r = runSingleElim(myTeam, customPlayer, seeds, 5, 'none', rec);
  const championId = r.championId;
  const runnerUpId = r.runnerUpId;
  const playoffGames = r.playerSeries;

  let finalRank: number;
  if (!playerInPlayoff) {
    finalRank = standings.findIndex((s) => s.teamId === myTeam.id) + 1;
  } else if (championId === myTeam.id) {
    finalRank = 1;
  } else if (r.playerEliminatedInFinal) {
    finalRank = 2;
  } else {
    finalRank = 3; // 半决赛出局
  }

  // LPL MSI 两个名额 = 春季季后赛冠军 + 亚军
  const msiSeeds = championId && runnerUpId ? [championId, runnerUpId] : top4.slice(0, 2);

  const awards: Award[] = [
    seasonMvp('spring', playerSeries, standings, myTeam, customPlayer),
    finalsMvp('spring', championId, playoffGames, myTeam, customPlayer),
  ];

  return {
    tournament: 'spring',
    regularGames: playerSeries,
    playoffGames,
    finalRank,
    qualified: msiSeeds.includes(myTeam.id),
    champion: championId === myTeam.id,
    standings,
    topTeams: msiSeeds,
    awards,
    timeline,
  };
}

// 供 MSI 使用的春季 Top2 由调用方通过 champion/runnerUp 判定

// ============================================
// 夏季赛（常规赛 + Top6 胜败组双败）
// ============================================
export interface SummerResult extends SeasonResult {
  standings: Standing[];
}

export function simulateSummer(myTeam: Team, customPlayer: Player): SummerResult {
  const allLpl = getLplTeams();
  const { standings, playerSeries } = simulateRoundRobin(
    myTeam,
    customPlayer,
    allLpl,
    1,
  );
  const top6 = standings.slice(0, 6).map((s) => s.teamId);
  const qualified = top6.includes(myTeam.id);

  let playoffGames: SeriesResult[] = [];
  let championId = '';
  let finalRank: number;
  const timeline: MatchRecord[] = [];
  const rec: MatchRecorder = { record: (m) => timeline.push(m) };

  if (qualified) {
    const r = runDoubleElim6(myTeam, customPlayer, top6, rec);
    playoffGames = r.playerSeries;
    championId = r.championId;
    finalRank = r.playerRank;
  } else {
    finalRank = standings.findIndex((s) => s.teamId === myTeam.id) + 1;
    championId = top6.length
      ? runDoubleElim6(myTeam, customPlayer, top6, rec).championId
      : '';
  }

  const awards: Award[] = [
    seasonMvp('summer', playerSeries, standings, myTeam, customPlayer),
    finalsMvp('summer', championId, playoffGames, myTeam, customPlayer),
  ];

  return {
    tournament: 'summer',
    regularGames: playerSeries,
    playoffGames,
    finalRank,
    qualified: qualified,
    champion: championId === myTeam.id,
    standings,
    awards,
    timeline,
  };
}

/** 6 队胜败组双败（BO5）。种子顺序 1-6。 */
function runDoubleElim6(
  myTeam: Team,
  customPlayer: Player,
  seeds: string[],
  rec?: MatchRecorder,
): { championId: string; playerSeries: SeriesResult[]; playerRank: number } {
  const [s1, s2, s3, s4, s5, s6] = seeds;
  const playerSeries: SeriesResult[] = [];
  let playerEliminatedStage: 'none' | 'early' | 'lbFinal' | 'gf' = 'none';

  const play = (aId: string, bId: string, label: string): { winnerId: string; loserId: string } => {
    const { winnerId, loserId, series } = decideSeries(
      myTeam,
      customPlayer,
      aId,
      bId,
      5,
      'none', // 夏季赛季后赛不使用关键局策略（仅 MSI/世界赛 BO5）
      rec,
      label,
    );
    if (series) playerSeries.push(series);
    return { winnerId, loserId };
  };

  // 胜者组
  const wb1 = play(s3, s6, '胜者组第一轮'); // 3v6
  const wb2 = play(s4, s5, '胜者组第一轮'); // 4v5
  const wb3 = play(s1, wb1.winnerId, '胜者组第二轮'); // 1vW(3v6)
  const wb4 = play(s2, wb2.winnerId, '胜者组第二轮'); // 2vW(4v5)
  const wbFinal = play(wb3.winnerId, wb4.winnerId, '胜者组决赛'); // 胜者组决赛

  // 败者组
  const lb1 = play(wb1.loserId, wb2.loserId, '败者组第一轮'); // L(3v6) vs L(4v5)
  const lb2 = play(wb3.loserId, wb4.loserId, '败者组第二轮'); // L(1v..) vs L(2v..)
  const lb3 = play(lb1.winnerId, lb2.winnerId, '败者组第三轮');
  const lbFinal = play(wbFinal.loserId, lb3.winnerId, '败者组决赛'); // 败者组决赛

  // 记录玩家淘汰阶段（用于排名）
  const lastPlayerLoss = [...playerSeries].reverse().find((s) => !s.isWin);
  void lastPlayerLoss;

  // 总决赛：胜者组冠军 vs 败者组冠军（BO5）
  const gf = play(wbFinal.winnerId, lbFinal.winnerId, '总决赛');

  // 判定玩家排名
  let playerRank = 1;
  if (gf.winnerId !== myTeam.id) {
    if (lbFinal.winnerId === myTeam.id) {
      playerEliminatedStage = 'gf';
      playerRank = 2; // 总决赛亚军
    } else if (wbFinal.winnerId === myTeam.id || lb3.winnerId === myTeam.id) {
      playerRank = 3; // 败者组决赛前出局 / 胜者组决赛前
    } else {
      playerRank = 5;
    }
  }
  void playerEliminatedStage;

  return { championId: gf.winnerId, playerSeries, playerRank };
}

// ============================================
// MSI（春季 Top2 代表 LPL）
// ============================================
// ============================================
// MSI 季中冠军赛（8 队单败 BO5）
// LPL2 + LCK2 + LEC1 + LCS1 + PCS1 + VCS1
// ============================================
export interface MsiResult extends SeasonResult {}

/**
 * @param lplSeeds LPL 春季赛 top2（冠军+亚军）
 * @param decisiveStrat 玩家为本届 MSI 关键局（BO5 赛点局）选择的策略
 */
export function simulateMsi(
  myTeam: Team,
  customPlayer: Player,
  lplSeeds: string[],
  decisiveStrat: Strat = 'none',
): MsiResult {
  const lck = topNByRegion('LCK', 2);
  const lec = topNByRegion('LEC', 1);
  const lcs = topNByRegion('LCS', 1);
  const pcs = topNByRegion('PCS', 1);
  const vcs = topNByRegion('VCS', 1);

  // 8 队排列：避免 LPL/LCK 在 1/4 决赛相遇
  // 上半区: LPL1-PCS, LCK1-LCS   下半区: LPL2-VCS, LCK2-LEC
  const bracket = [
    lplSeeds[0], pcs[0],
    lck[0], lcs[0],
    lplSeeds[1], vcs[0],
    lck[1], lec[0],
  ];

  const timeline: MatchRecord[] = [];
  const rec: MatchRecorder = { record: (m) => timeline.push(m) };
  const r = runSingleElim(myTeam, customPlayer, bracket, 5, decisiveStrat, rec);
  const playerIn = lplSeeds.includes(myTeam.id);
  let finalRank: number;
  if (!playerIn) {
    finalRank = 0; // 玩家未参赛（MSI 仍照常进行，决出冠军）
  } else if (r.championId === myTeam.id) {
    finalRank = 1;
  } else if (r.playerEliminatedInFinal) {
    finalRank = 2;
  } else {
    finalRank = 3; // 半决赛出局
  }
  return {
    tournament: 'msi',
    playoffGames: r.playerSeries,
    finalRank,
    qualified: playerIn,
    champion: r.championId === myTeam.id,
    placements: r.placements,
    awards: [finalsMvp('msi', r.championId, r.playerSeries, myTeam, customPlayer)],
    timeline,
  };
}

// ============================================
// 全球总决赛（16 队：小组循环 + 8 强淘汰 BO5）
// LPL4 + LCK4 + LEC3 + LCS3 + PCS1 + VCS1
// ============================================
export interface WorldsResult extends SeasonResult {
  groupStandings?: Standing[];
}

/** 世界赛小组赛阶段：分组 + 各组单循环，返回玩家组数据与 8 强对阵 */
export function simulateWorldsGroups(
  myTeam: Team,
  customPlayer: Player,
  lplSeeds: string[], // LPL 年度 top4
): {
  playerSeries: SeriesResult[];
  playerGroupStandings: Standing[] | null;
  advanced: boolean;
  bracket: string[]; // 8 强淘汰赛种子（跨组对阵顺序）
} {
  const lpl = lplSeeds.slice(0, 4);
  const lck = topNByRegion('LCK', 4);
  const lec = topNByRegion('LEC', 3);
  const lcs = topNByRegion('LCS', 3);
  const pcs = topNByRegion('PCS', 1);
  const vcs = topNByRegion('VCS', 1);

  // 分档（每档 4 队，避免同组同赛区）
  const p1 = [lpl[0], lck[0], lec[0], lcs[0]];
  const p2 = [lpl[1], lck[1], lec[1], lcs[1]];
  const p3 = [lpl[2], lck[2], lec[2], lcs[2]];
  const p4 = [lpl[3], lck[3], pcs[0], vcs[0]];
  // 蛇形分入 4 组：每组从每档取一队，且不重赛区
  const groups = [
    [p1[0], p2[1], p3[2], p4[3]],
    [p1[1], p2[0], p3[3], p4[2]],
    [p1[2], p2[3], p3[0], p4[1]],
    [p1[3], p2[2], p3[1], p4[0]],
  ];

  // 每组单循环；玩家所在组用完整引擎，其余组 AI 模拟
  let playerSeries: SeriesResult[] = [];
  let playerGroupStandings: Standing[] | null = null;
  const groupTop2: string[][] = [[], [], [], []];
  for (let g = 0; g < 4; g++) {
    const teams = groups[g].map((id) => getTeam(id));
    const res = simulateRoundRobin(myTeam, customPlayer, teams, 1);
    groupTop2[g] = res.standings.slice(0, 2).map((s) => s.teamId);
    if (groups[g].includes(myTeam.id)) {
      playerSeries = res.playerSeries;
      playerGroupStandings = res.standings;
    }
  }

  const advanced =
    playerGroupStandings != null &&
    playerGroupStandings.slice(0, 2).some((s) => s.teamId === myTeam.id);

  // 8 强淘汰赛：A1-B2, C1-D2, B1-A2, D1-C2（跨组对阵）
  const [A, B, C, D] = groupTop2;
  const bracket = [A[0], B[1], C[0], D[1], B[0], A[1], D[0], C[1]];

  return { playerSeries, playerGroupStandings, advanced, bracket };
}

// ============================================
// 世界赛淘汰赛：交互式会话
// 一场一场真实模拟；玩家系列赛打到 2:2 时暂停（pending），
// 等玩家选择 亮剑/奉献/常规 后再模拟决胜局 —— 策略是彩蛋，不是常驻选项。
// ============================================
export interface PendingDecisive {
  label: string; // 轮次名（1/4 决赛 / 半决赛 / 决赛）
  teamAId: string;
  teamBId: string;
  enemyId: string; // 对手（玩家视角）
  games: GameResult[]; // 前 4 局（2:2）
}

export interface KnockoutSession {
  seeds: string[]; // 8 队
  matches: MatchRecord[]; // 已完成，按真实顺序
  pending: PendingDecisive | null; // 等待玩家抉择的决胜局
  done: boolean;
  championId: string | null;
  runnerUpId: string | null;
  playerSeries: SeriesResult[]; // 玩家参与的系列（按顺序）
}

export function createKnockoutSession(seeds: string[]): KnockoutSession {
  return {
    seeds: seeds.slice(),
    matches: [],
    pending: null,
    done: false,
    championId: null,
    runnerUpId: null,
    playerSeries: [],
  };
}

/** 由已完成比赛推算当前轮次的下一场对阵（单败：按顺序两两配对，胜者晋级） */
function knockoutNextMatch(
  seeds: string[],
  matches: MatchRecord[],
): { aId: string; bId: string; bracketSize: number } | null {
  let bracket = seeds.slice();
  let consumed = 0;
  while (bracket.length > 1) {
    const pairs = bracket.length / 2;
    if (matches.length < consumed + pairs) {
      const i = matches.length - consumed;
      return { aId: bracket[i * 2], bId: bracket[i * 2 + 1], bracketSize: bracket.length };
    }
    bracket = matches.slice(consumed, consumed + pairs).map((m) => m.winnerId);
    consumed += pairs;
  }
  return null;
}

function knockoutLabel(bracketSize: number): string {
  return bracketSize === 2 ? '决赛' : bracketSize === 4 ? '半决赛' : '1/4 决赛';
}

function appendKnockoutMatch(
  session: KnockoutSession,
  m: MatchRecord,
  series?: SeriesResult,
): KnockoutSession {
  const matches = [...session.matches, m];
  const playerSeries = series ? [...session.playerSeries, series] : session.playerSeries;
  const done = knockoutNextMatch(session.seeds, matches) === null;
  const loserId = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
  return {
    ...session,
    matches,
    playerSeries,
    pending: null,
    done,
    championId: done ? m.winnerId : null,
    runnerUpId: done ? loserId : null,
  };
}

function playerSeriesOf(opponentId: string, games: GameResult[]): SeriesResult {
  const myWin = games.filter((g) => g.isWin).length;
  const enWin = games.length - myWin;
  return {
    bestOf: 5,
    opponentId,
    games,
    myWin,
    enWin,
    isWin: myWin > enWin,
    board: aggregateBoard(games),
  };
}

function playerMatchRecord(
  label: string,
  aId: string,
  bId: string,
  myTeamId: string,
  series: SeriesResult,
): MatchRecord {
  const playerIsA = aId === myTeamId;
  return {
    stage: 'playoff',
    label,
    teamAId: aId,
    teamBId: bId,
    bestOf: 5,
    winA: playerIsA ? series.myWin : series.enWin,
    winB: playerIsA ? series.enWin : series.myWin,
    winnerId: series.isWin ? myTeamId : playerIsA ? bId : aId,
    series,
  };
}

/**
 * 推进一场淘汰赛。
 * - AI 对阵：直接模拟整场并推进
 * - 玩家对阵：最多模拟 4 局；3:0/3:1 直接结束，2:2 则置 pending 等待玩家抉择
 */
export function stepKnockout(
  session: KnockoutSession,
  myTeam: Team,
  customPlayer: Player,
): KnockoutSession {
  if (session.done || session.pending) return session;
  const next = knockoutNextMatch(session.seeds, session.matches);
  if (!next) return { ...session, done: true };
  const { aId, bId, bracketSize } = next;
  const label = knockoutLabel(bracketSize);
  const playerIn = aId === myTeam.id || bId === myTeam.id;

  if (!playerIn) {
    const a = getTeam(aId);
    const b = getTeam(bId);
    const s = simAiSeries(a, b, 5);
    return appendKnockoutMatch(session, {
      stage: 'playoff',
      label,
      teamAId: aId,
      teamBId: bId,
      bestOf: 5,
      winA: s.myWin,
      winB: s.enWin,
      winnerId: s.isWin ? aId : bId,
    });
  }

  const enemyId = aId === myTeam.id ? bId : aId;
  const enemy = getTeam(enemyId);
  const games: GameResult[] = [];
  let myWin = 0;
  let enWin = 0;
  while (myWin < 3 && enWin < 3 && games.length < 4) {
    const g = simulateGame({ myTeam, enemyTeam: enemy, customPlayer, strat: 'none' });
    games.push(g);
    if (g.isWin) myWin++;
    else enWin++;
  }

  if (myWin === 2 && enWin === 2) {
    // 战歌起：决胜局交给玩家抉择
    return { ...session, pending: { label, teamAId: aId, teamBId: bId, enemyId, games } };
  }

  const series = playerSeriesOf(enemyId, games);
  return appendKnockoutMatch(
    session,
    playerMatchRecord(label, aId, bId, myTeam.id, series),
    series,
  );
}

/** 玩家在决胜局选择策略后，模拟第五局并完成该系列赛 */
export function chooseKnockoutStrat(
  session: KnockoutSession,
  myTeam: Team,
  customPlayer: Player,
  strat: Strat,
): KnockoutSession {
  if (!session.pending) return session;
  const { label, teamAId, teamBId, enemyId, games } = session.pending;
  const g5 = simulateGame({ myTeam, enemyTeam: getTeam(enemyId), customPlayer, strat });
  const series = playerSeriesOf(enemyId, [...games, g5]);
  return appendKnockoutMatch(
    session,
    playerMatchRecord(label, teamAId, teamBId, myTeam.id, series),
    series,
  );
}

/** 由小组赛结果 + 完成的淘汰赛会话组装最终 WorldsResult */
export function buildWorldsResult(
  myTeam: Team,
  customPlayer: Player,
  groups: {
    playerSeries: SeriesResult[];
    playerGroupStandings: Standing[] | null;
    advanced: boolean;
  },
  session: KnockoutSession,
): WorldsResult {
  const { playerGroupStandings, advanced } = groups;
  let finalRank: number;
  if (!advanced) {
    finalRank = playerGroupStandings
      ? playerGroupStandings.findIndex((s) => s.teamId === myTeam.id) + 1
      : 0;
  } else if (session.championId === myTeam.id) {
    finalRank = 1;
  } else if (session.runnerUpId === myTeam.id) {
    finalRank = 2;
  } else if (session.playerSeries.length >= 2) {
    finalRank = 3; // 半决赛
  } else {
    finalRank = 5; // 1/4 决赛
  }

  return {
    tournament: 'worlds',
    regularGames: groups.playerSeries,
    playoffGames: session.playerSeries,
    finalRank,
    qualified: advanced,
    champion: session.championId === myTeam.id,
    groupStandings: playerGroupStandings ?? undefined,
    awards: [
      finalsMvp('worlds', session.championId ?? '', session.playerSeries, myTeam, customPlayer),
    ],
    timeline: session.matches,
  };
}

/** 一次性跑完世界赛（测试/兼容用；决胜局策略自动按 'none' 处理） */
export function simulateWorlds(
  myTeam: Team,
  customPlayer: Player,
  lplSeeds: string[],
  decisiveStrat: Strat = 'none',
): WorldsResult {
  const groups = simulateWorldsGroups(myTeam, customPlayer, lplSeeds);
  let session = createKnockoutSession(groups.bracket);
  let guard = 0;
  while (!session.done && guard < 20) {
    guard++;
    session = session.pending
      ? chooseKnockoutStrat(session, myTeam, customPlayer, decisiveStrat)
      : stepKnockout(session, myTeam, customPlayer);
  }
  return buildWorldsResult(myTeam, customPlayer, groups, session);
}

/** 某赛区按基础战力取前 n 名（其他赛区直接凭战力进入 MSI/世界赛） */
function topNByRegion(region: Region, n: number): string[] {
  return TEAMS.filter((t) => t.region === region)
    .slice()
    .sort((a, b) => teamBasePower(b) - teamBasePower(a))
    .slice(0, n)
    .map((t) => t.id);
}

// ============================================
// 年度积分：综合 春季赛 + MSI + 夏季赛，决定世界赛 LPL 4 个名额
// ============================================

/** MSI/世界赛名次 → 积分（跨赛事加权用） */
function placementPoints(placement: number): number {
  switch (placement) {
    case 1: return 8;   // 冠军
    case 2: return 6;   // 亚军
    case 3: return 4;   // 半决赛（3-4）
    case 4: return 4;
    default: return 2;  // 5-8（四分之一决赛及以后）
  }
}

export function computeYearlyPoints(
  spring: SeasonResult | undefined,
  msi: SeasonResult | undefined,
  summer: SeasonResult | undefined,
): { teamId: string; points: number }[] {
  const points = new Map<string, number>();

  // 常规赛排名积分（所有 LPL 队伍）
  const addStandings = (standings: Standing[] | undefined, weight: number) => {
    if (!standings) return;
    const n = standings.length;
    standings.forEach((s, idx) => {
      const p = Math.max(0, n - idx) * weight;
      points.set(s.teamId, (points.get(s.teamId) ?? 0) + p);
    });
  };
  addStandings(spring?.standings, 1.0);
  addStandings(summer?.standings, 1.3); // 夏季赛权重略高

  // MSI 名次积分（仅参加 MSI 的 LPL 两队有）
  if (msi?.placements) {
    for (const [teamId, placement] of Object.entries(msi.placements)) {
      // 只给 LPL 队伍计分（其他赛区不参与 LPL 世界赛名额竞争）
      const team = TEAM_BY_ID[teamId];
      if (!team || team.region !== 'LPL') continue;
      points.set(teamId, (points.get(teamId) ?? 0) + placementPoints(placement));
    }
  }

  return [...points.entries()]
    .map(([teamId, pts]) => ({ teamId, points: Math.round(pts * 10) / 10 }))
    .sort((a, b) => b.points - a.points);
}

/** 世界赛 LPL 4 个名额（年度积分 Top4：春+MSI+夏综合） */
export function worldsLplSeeds(
  spring: SeasonResult | undefined,
  msi: SeasonResult | undefined,
  summer: SeasonResult | undefined,
): string[] {
  return computeYearlyPoints(spring, msi, summer)
    .slice(0, 4)
    .map((x) => x.teamId);
}
