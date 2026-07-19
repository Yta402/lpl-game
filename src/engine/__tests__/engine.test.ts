import { describe, it, expect } from 'vitest';
import { calcPlayerPower } from '../power';
import {
  effectiveAttrs,
  teamfightSum,
  checkSolokill,
  checkTeamfightCarry,
} from '../breakthrough';
import { calcWinRate, simulateGame, simulateSeries } from '../match';
import {
  teamBasePower,
  simulateSpring,
  simulateSummer,
  simulateMsi,
  simulateWorlds,
  simulateWorldsGroups,
  createKnockoutSession,
  stepKnockout,
  chooseKnockoutStrat,
} from '../season';
import { TEAMS, getLplTeams } from '../../data/teams';
import { createCustomPlayer } from '../customPlayer';
import type { Attributes } from '../../types';

const baseAttrs: Attributes = {
  mechanics: 50, reaction: 50, farming: 50,
  teamwork: 50, macro: 50, engage: 50,
  championPool: 50, mentality: 50, communication: 50,
};

describe('战力计算', () => {
  it('单人战力在全 50 时为三组加权和（约 150）', () => {
    const p = calcPlayerPower(baseAttrs, 'mid');
    // mid 权重 1.15+1.0+0.85=3.0，50*3.0=150
    expect(p).toBeGreaterThan(145);
    expect(p).toBeLessThan(155);
  });

  it('属性提升应提高战力', () => {
    const strong: Attributes = { ...baseAttrs, mechanics: 90, reaction: 90, farming: 90 };
    expect(calcPlayerPower(strong, 'mid')).toBeGreaterThan(calcPlayerPower(baseAttrs, 'mid'));
  });

  it('LCK 战队平均强于 LPL，LPL 强于外卡', () => {
    const avgPower = (region: string) => {
      const ts = TEAMS.filter((t) => t.region === region);
      return ts.reduce((s, t) => s + teamBasePower(t), 0) / ts.length;
    };
    expect(avgPower('LCK')).toBeGreaterThan(avgPower('LPL'));
    expect(avgPower('LPL')).toBeGreaterThan(avgPower('PCS'));
  });
});

describe('胜率函数（Sigmoid）', () => {
  it('双方相等时胜率约 0.5', () => {
    expect(calcWinRate(100, 100)).toBeCloseTo(0.5, 1);
  });
  it('己方更强时胜率 > 0.5 但 < 1', () => {
    const r = calcWinRate(120, 80);
    expect(r).toBeGreaterThan(0.5);
    expect(r).toBeLessThan(1);
  });
  it('极端差距也不会达到 0 或 1', () => {
    expect(calcWinRate(1000, 0)).toBeLessThan(1);
    expect(calcWinRate(0, 1000)).toBeGreaterThan(0);
  });
});

describe('亮剑 / 奉献 / 单线击穿 / 团战游龙', () => {
  it('亮剑：玩家全属性×1.1，队友×0.9', () => {
    const me = effectiveAttrs(baseAttrs, 'mid', true, { strat: 'challenge', solokill: false, teamfightCarry: false });
    const mate = effectiveAttrs(baseAttrs, 'mid', false, { strat: 'challenge', solokill: false, teamfightCarry: false });
    expect(me.mechanics).toBe(55); // 50×1.1
    expect(mate.mechanics).toBe(45); // 50×0.9
  });
  it('单线击穿：玩家×1.3，队友惩罚解除×1.0', () => {
    const me = effectiveAttrs(baseAttrs, 'mid', true, { strat: 'challenge', solokill: true, teamfightCarry: false });
    const mate = effectiveAttrs(baseAttrs, 'mid', false, { strat: 'challenge', solokill: true, teamfightCarry: false });
    expect(me.mechanics).toBe(65); // 50×1.3
    expect(mate.mechanics).toBe(50); // 惩罚解除
  });
  it('奉献：玩家×0.8，队友×1.1；团战游龙队友×1.2', () => {
    const me = effectiveAttrs(baseAttrs, 'mid', true, { strat: 'sacrifice', solokill: false, teamfightCarry: false });
    const mate = effectiveAttrs(baseAttrs, 'mid', false, { strat: 'sacrifice', solokill: false, teamfightCarry: true });
    expect(me.mechanics).toBe(40); // 50×0.8
    expect(mate.mechanics).toBe(60); // 50×1.2
  });
  it('单线击穿判定：对线和差 ≥ 阈值', () => {
    const strong: Attributes = { ...baseAttrs, mechanics: 70, reaction: 70, farming: 70 };
    expect(checkSolokill(strong, baseAttrs)).toBe(true); // 210−150=60 ≥18
    expect(checkSolokill(baseAttrs, baseAttrs)).toBe(false);
  });
  it('团战游龙判定：4 队友团战和差 ≥ 阈值', () => {
    expect(checkTeamfightCarry(teamfightSum(baseAttrs) * 4 + 100, teamfightSum(baseAttrs) * 4)).toBe(true);
    expect(checkTeamfightCarry(teamfightSum(baseAttrs) * 4 + 10, teamfightSum(baseAttrs) * 4)).toBe(false);
  });
  it('none 策略不变属性', () => {
    const me = effectiveAttrs(baseAttrs, 'mid', true, { strat: 'none', solokill: false, teamfightCarry: false });
    expect(me.mechanics).toBe(50);
  });
});

describe('单局/系列赛', () => {
  it('simulateGame 返回完整结果', () => {
    const my = getLplTeams()[0];
    const enemy = getLplTeams()[1];
    const player = createCustomPlayer({ name: 'Test', position: 'mid', gender: 'male' });
    const g = simulateGame({ myTeam: my, enemyTeam: enemy, customPlayer: player, strat: 'none' });
    expect(g).toHaveProperty('isWin');
    expect(g.kda.kills).toBeGreaterThanOrEqual(0);
    expect(g.events.length).toBeGreaterThan(2);
    expect(g.rating).toBeGreaterThan(0);
    expect(g.strat).toBe('none');
  });

  it('BO5 最多打 5 局且胜场先到 3 结束', () => {
    const my = getLplTeams()[0];
    const enemy = getLplTeams()[2];
    const player = createCustomPlayer({ name: 'Test', position: 'top', gender: 'male' });
    const s = simulateSeries({ bestOf: 5, myTeam: my, enemyTeam: enemy, customPlayer: player, decisiveStrat: 'challenge' });
    expect(s.games.length).toBeLessThanOrEqual(5);
    expect(s.games.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(s.myWin, s.enWin)).toBe(3);
    // 至少有一局可能使用了策略（赛点局）
    expect(s.games.some((g) => g.strat !== 'none' || g.solokillTriggered)).toBeTruthy();
  });
});

describe('全年赛季端到端', () => {
  it('完整职业生涯无运行时错误', () => {
    const my = getLplTeams()[0];
    const player = createCustomPlayer({ name: 'Rookie', position: 'mid', gender: 'male' });

    const spring = simulateSpring(my, player);
    expect(spring.standings.length).toBe(getLplTeams().length);
    expect(spring.finalRank).toBeGreaterThan(0);

    if (spring.qualified) {
      const msi = simulateMsi(my, player, spring.topTeams ?? [my.id]);
      expect(msi.playoffGames.length).toBeGreaterThan(0);
    }

    const summer = simulateSummer(my, player);
    expect(summer.standings.length).toBe(getLplTeams().length);

    // 世界赛（不论是否晋级都不应抛错）
    const seeds = getLplTeams().slice(0, 4).map((t) => t.id);
    const worlds = simulateWorlds(my, player, seeds);
    expect(worlds.finalRank).toBeGreaterThan(0);
  });

  it('每个赛事都颁发 FMVP，春/夏还颁发常规赛 MVP', () => {
    const my = getLplTeams()[0];
    const player = createCustomPlayer({ name: 'Star', position: 'mid', gender: 'male' });

    const spring = simulateSpring(my, player);
    expect(spring.awards).toBeDefined();
    expect(spring.awards!.map((a) => a.type).sort()).toEqual(['FMVP', 'MVP']);
    expect(spring.awards!.every((a) => a.playerName.length > 0)).toBe(true);

    const msi = simulateMsi(my, player, spring.topTeams ?? [my.id], 'none');
    expect(msi.awards).toBeDefined();
    expect(msi.awards!.map((a) => a.type)).toEqual(['FMVP']);

    const worlds = simulateWorlds(my, player, getLplTeams().slice(0, 4).map((t) => t.id), 'none');
    expect(worlds.awards!.map((a) => a.type)).toEqual(['FMVP']);
  });

  it('多次模拟春季赛，最终名次分布合理', () => {
    const my = getLplTeams()[0];
    const player = createCustomPlayer({ name: 'X', position: 'adc', gender: 'male' });
    const ranks: number[] = [];
    for (let i = 0; i < 20; i++) {
      ranks.push(simulateSpring(my, player).finalRank);
    }
    const avg = ranks.reduce((a, b) => a + b, 0) / ranks.length;
    // 50 级新人替换顶级战队的明星选手，会拖累战队落到中游（设计如此：新人需成长）
    // 强队底蕴仍在，平均名次应在上半区到中游（< 7）
    expect(avg).toBeLessThan(7);
  });
});

describe('数据完整性（防头像色哈希负数崩溃回归）', () => {
  it('所有选手 avatarColor 都是合法十六进制色值', () => {
    for (const t of TEAMS) {
      for (const p of t.roster) {
        // 曾因 colorFor 哈希取模为负导致 avatarColor=undefined，Avatar 渲染时崩溃白屏
        expect(p.avatarColor, `${t.name}/${p.name}`).toMatch(/^#[0-9a-fA-F]{3,8}$/);
      }
    }
  });
});

describe('逐场模拟时间线与全员战绩', () => {
  it('每局生成双方 10 名选手数据（stats）', () => {
    const my = getLplTeams()[0];
    const enemy = getLplTeams()[1];
    const player = createCustomPlayer({ name: 'X', position: 'mid', gender: 'male' });
    const s = simulateSeries({ bestOf: 3, myTeam: my, enemyTeam: enemy, customPlayer: player });
    expect(s.games.length).toBeGreaterThan(0);
    for (const g of s.games) {
      expect(g.stats).toHaveLength(10);
    }
    // 系列赛 board：10 人、含自建选手、出场局数一致
    expect(s.board).toHaveLength(10);
    const me = s.board!.find((b) => b.playerId === player.id);
    expect(me).toBeDefined();
    expect(me!.games).toBe(s.games.length);
    // KDA 累计 = 每局之和
    const kSum = s.games.reduce((sum, g) => sum + g.kda.kills, 0);
    expect(me!.kills).toBe(kSum);
  });

  it('春季赛季后赛 timeline：3 场，半决赛×2 + 决赛×1，比分与胜负一致', () => {
    const my = getLplTeams()[0];
    const player = createCustomPlayer({ name: 'X', position: 'mid', gender: 'male' });
    const r = simulateSpring(my, player);
    expect(r.timeline).toHaveLength(3);
    expect(r.timeline!.map((m) => m.label)).toEqual(['半决赛', '半决赛', '决赛']);
    for (const m of r.timeline!) {
      const loserScore = Math.min(m.winA, m.winB);
      const winnerScore = Math.max(m.winA, m.winB);
      expect(winnerScore).toBe(3); // BO5 先拿 3 局
      expect(loserScore).toBeLessThan(3);
      const winnerScoreIsA = m.winA === winnerScore;
      expect(m.winnerId).toBe(winnerScoreIsA ? m.teamAId : m.teamBId);
    }
  });

  it('MSI timeline：7 场，顺序为 1/4×4 → 半决赛×2 → 决赛×1', () => {
    const my = getLplTeams()[0];
    const player = createCustomPlayer({ name: 'X', position: 'adc', gender: 'male' });
    const r = simulateMsi(my, player, [my.id, getLplTeams()[1].id], 'none');
    expect(r.timeline).toHaveLength(7);
    expect(r.timeline!.map((m) => m.label)).toEqual([
      '1/4 决赛', '1/4 决赛', '1/4 决赛', '1/4 决赛',
      '半决赛', '半决赛',
      '决赛',
    ]);
  });

  it('世界赛淘汰赛交互会话：逐步推进至完赛，共 7 场，冠军有效', () => {
    const my = getLplTeams()[0];
    const player = createCustomPlayer({ name: 'X', position: 'mid', gender: 'male' });
    const seeds = getLplTeams().slice(0, 8).map((t) => t.id);
    let session = createKnockoutSession(seeds);
    let guard = 0;
    while (!session.done && guard < 20) {
      guard++;
      session = session.pending
        ? chooseKnockoutStrat(session, my, player, 'challenge')
        : stepKnockout(session, my, player);
    }
    expect(session.done).toBe(true);
    expect(session.matches).toHaveLength(7);
    expect(session.championId).toBeTruthy();
    expect(seeds).toContain(session.championId);
    expect(session.matches.map((m) => m.label)).toEqual([
      '1/4 决赛', '1/4 决赛', '1/4 决赛', '1/4 决赛',
      '半决赛', '半决赛',
      '决赛',
    ]);
    // 玩家参与的系列都记录了 board
    for (const s of session.playerSeries) {
      expect(s.board).toHaveLength(10);
    }
  });

  it('pending 只在玩家系列赛 2:2 时出现，且决胜局会应用所选策略', () => {
    const my = getLplTeams()[0];
    const player = createCustomPlayer({ name: 'X', position: 'mid', gender: 'male' });
    const seeds = [my.id, ...getLplTeams().slice(1, 8).map((t) => t.id)];
    // 跑多个会话，直到遇到一次 2:2（概率较高）；验证 pending 结构与选择后完赛
    let sawPending = false;
    for (let attempt = 0; attempt < 30 && !sawPending; attempt++) {
      let session = createKnockoutSession(seeds);
      let guard = 0;
      while (!session.done && guard < 20) {
        guard++;
        if (session.pending) {
          sawPending = true;
          expect(session.pending.games).toHaveLength(4);
          const wins = session.pending.games.filter((g) => g.isWin).length;
          expect(wins).toBe(2);
          session = chooseKnockoutStrat(session, my, player, 'challenge');
          // 决胜局（第 5 局）应记录所选的亮剑策略
          const last = session.matches[session.matches.length - 1];
          const g5 = last.series!.games[4];
          expect(g5.strat).toBe('challenge');
        } else {
          session = stepKnockout(session, my, player);
        }
      }
      expect(session.done).toBe(true);
    }
    // 30 次尝试中至少应遇到一次 2:2；若极端未遇到，至少保证流程可完赛
    expect(sawPending).toBe(true);
  });

  it('simulateWorlds（兼容包装）与小组赛拆分结果一致', () => {
    const my = getLplTeams()[0];
    const player = createCustomPlayer({ name: 'X', position: 'mid', gender: 'male' });
    const seeds = getLplTeams().slice(0, 4).map((t) => t.id);
    const groups = simulateWorldsGroups(my, player, seeds);
    expect(groups.bracket).toHaveLength(8);
    expect(groups.playerGroupStandings).not.toBeNull();
    expect(groups.playerSeries.length).toBe(3); // 小组单循环 3 场
    const r = simulateWorlds(my, player, seeds, 'none');
    expect(r.timeline!.length).toBe(7);
    expect(r.groupStandings).toBeDefined();
  });
});
