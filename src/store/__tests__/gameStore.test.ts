import { beforeEach, describe, expect, it } from 'vitest';
import type { AttrKey } from '../../types';
import { ATTR_META } from '../../constants';
import { useGame } from '../gameStore';

const ATTR_KEYS = ATTR_META.map((m) => m.key);

function createAndEnterInherit() {
  useGame.getState().startNewGame();
  useGame
    .getState()
    .createPlayer({ name: 'Tester', position: 'mid', gender: 'male' });
}

describe('继承流程回归（防卡死）', () => {
  beforeEach(() => {
    useGame.getState().resetGame();
  });

  it('createPlayer 原子化写入：进入 inherit 阶段时 pool 已有 9 位候选', () => {
    createAndEnterInherit();
    const s = useGame.getState();
    expect(s.phase).toBe('inherit');
    expect(s.pool).toHaveLength(9);
    expect(s.idx).toBe(0);
    expect(Object.keys(s.slots)).toHaveLength(0);
  });

  it('反复创建 100 次，每次 pool 都非空（空池曾导致页面卡死）', () => {
    for (let i = 0; i < 100; i++) {
      useGame.getState().resetGame();
      createAndEnterInherit();
      const s = useGame.getState();
      expect(s.pool.length).toBeGreaterThan(0);
      expect(s.idx).toBeLessThan(s.pool.length);
    }
  });

  it('每位候选点击 pickAttr 都能推进 idx，绝不静默卡住', () => {
    createAndEnterInherit();
    for (let i = 0; i < 9; i++) {
      const before = useGame.getState();
      const entry = before.pool[before.idx];
      expect(entry).toBeDefined();
      const attr = ATTR_KEYS.find(
        (k) => before.slots[k] === undefined,
      ) as AttrKey;
      before.pickAttr(entry, attr, false);
      const after = useGame.getState();
      expect(after.idx).toBe(before.idx + 1);
    }
    expect(useGame.getState().idx).toBe(9);
  });

  it('替换（override）已锁定属性同样推进 idx，并附带惩罚槽', () => {
    createAndEnterInherit();
    // 第一位：正常继承 mechanics
    let s = useGame.getState();
    s.pickAttr(s.pool[0], 'mechanics', false);
    expect(useGame.getState().slots.mechanics).toBeDefined();
    // 第二位：替换 mechanics → 应推进并写入一个 isPenalty 槽
    s = useGame.getState();
    const before = s.idx;
    s.pickAttr(s.pool[before], 'mechanics', true);
    const after = useGame.getState();
    expect(after.idx).toBe(before + 1);
    const hasPenalty = Object.values(after.slots).some((v) => v?.isPenalty);
    expect(hasPenalty).toBe(true);
  });

  it('全部跳过后 rollPool 能恢复（UI 依赖此路径兜底）', () => {
    createAndEnterInherit();
    for (let i = 0; i < 9; i++) useGame.getState().skipCurrent();
    let s = useGame.getState();
    expect(s.idx).toBe(9);
    expect(Object.keys(s.slots)).toHaveLength(0);
    // 恢复路径：重新抽池
    s.rollPool();
    s = useGame.getState();
    expect(s.idx).toBe(0);
    expect(s.pool).toHaveLength(9);
  });

  it('applyInheritance 后进入 select-team 阶段', () => {
    createAndEnterInherit();
    const s = useGame.getState();
    s.pickAttr(s.pool[0], 'mechanics', false);
    useGame.getState().applyInheritance();
    const after = useGame.getState();
    expect(after.phase).toBe('select-team');
    expect(after.draftPlayer).not.toBeNull();
  });
});
