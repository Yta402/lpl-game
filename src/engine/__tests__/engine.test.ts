import { describe, it, expect } from 'vitest';
import { calcPlayerPower } from '../power';
import {
  effectiveAttrs,
  teamfightSum,
  checkSolokill,
  checkTeamfightCarry,
} from '../breakthrough';
import { calcWinRate, simulateGame, simulateSeries } from '../match';
import { teamBasePower, simulateSpring, simulateSummer, simulateMsi, simulateWorlds } from '../season';
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
