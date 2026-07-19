import type { GameSave } from '../types';

const SAVE_KEY = 'lpl-game-save-v1';

/** 读取存档 */
export function loadSave(): GameSave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameSave;
  } catch {
    return null;
  }
}

/** 写入存档 */
export function writeSave(save: GameSave): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // 存储满或隐私模式：静默失败
  }
}

/** 清除存档 */
export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

/** 是否存在存档 */
export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}
