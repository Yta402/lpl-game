import { create } from "zustand";
import type { Phase, Player, GameSave, AttrKey, Position, Strat } from "../types";
import {
  loadSave,
  writeSave,
  clearSave,
  hasSave,
} from "../utils/storage";
import { rollInheritancePool, type PoolEntry } from "../data/pool";
import { getTeam, getLplTeams } from "../data/teams";
import { createCustomPlayer } from "../engine/customPlayer";
import { applySlots, weakestAttr, type Slots } from "../engine/inheritance";

const POOL_SIZE = 9; // 9 属性 ↔ 9 位候选选手
const REROLL_INITIAL = 1;

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
  decisiveStrat: Strat; // MSI/世界赛关键局（BO5 赛点局）玩家选择的策略

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
  setDecisiveStrat: (strat: Strat) => void;

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
  decisiveStrat: "none",

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
      decisiveStrat: "none",
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

  setDecisiveStrat: (strat) => set({ decisiveStrat: strat }),

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
      decisiveStrat: "none",
      hasExistingSave: false,
    });
  },

  goTo: (phase) => set({ phase }),
}));

export { getLplTeams };
