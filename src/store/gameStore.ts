import { create } from "zustand";
import type { Phase, Player, GameSave, AttrKey, Position, SeriesResult, Standing, Strat } from "../types";
import {
  loadSave,
  writeSave,
  clearSave,
  hasSave,
} from "../utils/storage";
import { rollInheritancePool, type PoolEntry } from "../data/pool";
import { getTeam, getLplTeams } from "../data/teams";
import { createCustomPlayer, growPlayer } from "../engine/customPlayer";
import { applySlots, weakestAttr, type Slots } from "../engine/inheritance";
import {
  simulateWorldsGroups,
  createKnockoutSession,
  stepKnockout,
  chooseKnockoutStrat,
  buildWorldsResult,
  type KnockoutSession,
} from "../engine/season";
import type { SeasonResult } from "../types";

const POOL_SIZE = 9; // 9 属性 ↔ 9 位候选选手
const REROLL_INITIAL = 1;

/** 世界赛淘汰赛进行中的实时状态（不持久化：中途退出则世界赛重来） */
interface WorldsLive {
  playerGroupStandings: Standing[] | null;
  regularGames: SeriesResult[];
  advanced: boolean;
  session: KnockoutSession;
}

interface GameState {
  phase: Phase;
  save: GameSave | null;
  hasExistingSave: boolean;

  // 创建 / 继承阶段临时数据
  draftPlayer: Player | null;
  pool: PoolEntry[];
  idx: number; // 当前候选序号 0..POOL_SIZE（=POOL_SIZE 表示已结束）
  slots: Slots; // 已继承的属性槽（有值=已锁定）
  rerollsLeft: number;

  // 世界赛淘汰赛实时会话（决胜局策略彩蛋用；不进存档）
  worldsLive: WorldsLive | null;

  // ---------- actions ----------
  init: () => void;
  startNewGame: () => void;
  continueGame: () => void;

  // 创建角色
  createPlayer: (input: {
    name: string;
    position: Position;
    gender: "male" | "female";
  }) => void;

  // 继承 v2
  rollPool: () => void;
  rerollPool: () => void;
  pickAttr: (entry: PoolEntry, attr: AttrKey, override: boolean) => void;
  skipCurrent: () => void;
  applyInheritance: () => void;

  // 世界赛淘汰赛（交互式，决胜局策略彩蛋）
  startWorlds: (lplSeeds: string[]) => void;
  stepWorlds: () => void;
  chooseWorldsStrat: (strat: Strat) => void;
  /** 内部：淘汰赛会话推进后的收尾（未完赛更新 live，完赛写存档） */
  _finishWorlds: (live: WorldsLive) => void;

  // 选战队
  joinTeam: (teamId: string) => void;

  // 赛季相关
  setSave: (updater: (s: GameSave) => GameSave) => void;
  persist: () => void;
  resetGame: () => void;
  goTo: (phase: Phase) => void;
}

export const useGame = create<GameState>((set, get) => ({
  phase: "menu",
  save: null,
  hasExistingSave: false,
  draftPlayer: null,
  pool: [],
  idx: 0,
  slots: {},
  rerollsLeft: REROLL_INITIAL,
  worldsLive: null,

  init: () => {
    set({ hasExistingSave: hasSave() });
  },

  startNewGame: () => {
    clearSave();
    set({
      phase: "create",
      save: null,
      draftPlayer: null,
      pool: [],
      idx: 0,
      slots: {},
      rerollsLeft: REROLL_INITIAL,
      worldsLive: null,
      hasExistingSave: false,
    });
  },

  continueGame: () => {
    const save = loadSave();
    if (!save) {
      set({ phase: "menu", hasExistingSave: false });
      return;
    }
    set({ save, phase: "season-hub", hasExistingSave: true });
  },

  createPlayer: (input) => {
    const player = createCustomPlayer(input);
    const pool = rollInheritancePool(POOL_SIZE);
    // 原子化 set：draftPlayer + pool 一同写入，避免渲染到 draftPlayer 有值但 pool 为空的中间状态
    set({ draftPlayer: player, pool, idx: 0, slots: {}, phase: "inherit" });
  },

  rollPool: () => {
    const pool = rollInheritancePool(POOL_SIZE);
    set({ pool, idx: 0, slots: {} });
  },

  rerollPool: () => {
    if (get().rerollsLeft <= 0 || get().idx !== 0) return; // 仅在尚未选择时可重抽
    set({ rerollsLeft: get().rerollsLeft - 1 });
    get().rollPool();
  },

  /**
   * 从当前候选选择一项属性。
   * - override=false 且该属性未锁定：正常继承，锁定该属性，前进到下一位
   * - override=true 且该属性已锁定：替换该属性，并强制连带继承该选手最弱的一项（惩罚）
   */
  pickAttr: (entry, attr, override) => {
    const { idx, pool, slots, draftPlayer } = get();
    if (idx >= pool.length || !draftPlayer) return;
    if (pool[idx].playerId !== entry.playerId) return; // 只能选当前候选
    const team = getTeam(entry.teamId);
    const src = team.roster.find((p) => p.id === entry.playerId);
    if (!src) return;

    const newSlots: Slots = { ...slots };
    const locked = newSlots[attr] !== undefined;

    if (override && locked) {
      // 替换 + 惩罚（连带最弱项）
      newSlots[attr] = {
        playerId: src.id,
        playerName: src.name,
        value: src.attributes[attr],
      };
      const w = weakestAttr(src.attributes, attr);
      newSlots[w] = {
        playerId: src.id,
        playerName: src.name,
        value: src.attributes[w],
        isPenalty: true,
      };
    } else if (!locked) {
      // 正常选择
      newSlots[attr] = {
        playerId: src.id,
        playerName: src.name,
        value: src.attributes[attr],
      };
    } else {
      // override=false 但属性已锁定：不允许
      return;
    }

    set({ slots: newSlots, idx: idx + 1 });
  },

  skipCurrent: () => {
    if (get().idx >= get().pool.length) return;
    set({ idx: get().idx + 1 });
  },

  applyInheritance: () => {
    const { draftPlayer, slots } = get();
    if (!draftPlayer) return;
    const player = applySlots(draftPlayer, slots);
    set({ draftPlayer: player, phase: "select-team" });
  },

  // ---------- 世界赛淘汰赛（交互式） ----------
  startWorlds: (lplSeeds) => {
    const { save } = get();
    if (!save) return;
    const team = getTeam(save.teamId);
    const groups = simulateWorldsGroups(team, save.customPlayer, lplSeeds);
    set({
      worldsLive: {
        playerGroupStandings: groups.playerGroupStandings,
        regularGames: groups.playerSeries,
        advanced: groups.advanced,
        session: createKnockoutSession(groups.bracket),
      },
    });
  },

  stepWorlds: () => {
    const { save, worldsLive } = get();
    if (!save || !worldsLive || worldsLive.session.pending) return;
    const team = getTeam(save.teamId);
    const session = stepKnockout(worldsLive.session, team, save.customPlayer);
    get()._finishWorlds({ ...worldsLive, session });
  },

  chooseWorldsStrat: (strat) => {
    const { save, worldsLive } = get();
    if (!save || !worldsLive || !worldsLive.session.pending) return;
    const team = getTeam(save.teamId);
    const session = chooseKnockoutStrat(worldsLive.session, team, save.customPlayer, strat);
    get()._finishWorlds({ ...worldsLive, session });
  },

  /** 内部：会话推进后收尾——未完赛则更新 live，完赛则写入存档并结算成长 */
  _finishWorlds: (live: WorldsLive) => {
    const { save } = get();
    if (!save) return;
    if (!live.session.done) {
      set({ worldsLive: live });
      return;
    }
    const team = getTeam(save.teamId);
    const result: SeasonResult = buildWorldsResult(
      team,
      save.customPlayer,
      {
        playerSeries: live.regularGames,
        playerGroupStandings: live.playerGroupStandings,
        advanced: live.advanced,
      },
      live.session,
    );
    // 成长：与 SeasonHub 同一规则（小组赛 + 淘汰赛全部系列的场均评分）
    const allSeries = [...live.regularGames, ...result.playoffGames];
    const games = allSeries.flatMap((s) => s.games);
    const avg =
      games.length === 0
        ? 0
        : games.reduce((s, g) => s + g.rating, 0) / games.length;
    const grown = growPlayer(save.customPlayer, avg);
    const next: GameSave = {
      ...save,
      customPlayer: grown,
      career: { ...save.career, worlds: result },
    };
    writeSave(next);
    set({ save: next, worldsLive: null });
  },

  joinTeam: (teamId) => {
    const { draftPlayer } = get();
    if (!draftPlayer) return;
    const save: GameSave = {
      customPlayer: draftPlayer,
      teamId,
      inheritedFrom: [],
      career: {},
      achievements: [],
      createdAt: Date.now(),
    };
    writeSave(save);
    set({
      save,
      draftPlayer: null,
      pool: [],
      idx: 0,
      slots: {},
      phase: "season-hub",
    });
  },

  setSave: (updater) => {
    const cur = get().save;
    if (!cur) return;
    const next = updater(cur);
    writeSave(next);
    set({ save: next });
  },

  persist: () => {
    const cur = get().save;
    if (cur) writeSave(cur);
  },

  resetGame: () => {
    clearSave();
    set({
      phase: "menu",
      save: null,
      draftPlayer: null,
      pool: [],
      idx: 0,
      slots: {},
      rerollsLeft: REROLL_INITIAL,
      worldsLive: null,
      hasExistingSave: false,
    });
  },

  goTo: (phase) => set({ phase }),
}));

export { getLplTeams };
