// ============================================
// 随机数工具
// ============================================

/** 可播种随机数生成器（mulberry32），便于测试复现 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let _globalSeed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
const _globalRng = makeRng(_globalSeed);

/** 全局 [0,1) 随机数 */
export function rand(): number {
  return _globalRng();
}

/** [min, max] 区间整数 */
export function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

/** 从数组随机取一个元素 */
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

/** 从数组随机取 n 个不重复元素 */
export function sample<T>(arr: readonly T[], n: number): T[] {
  const pool = arr.slice();
  const result: T[] = [];
  const count = Math.min(n, pool.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rand() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

/** 洗牌（Fisher-Yates） */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Box-Muller 高斯分布采样，返回 [mean - sd*?, mean + sd*?] 范围内的值 */
export function gaussian(mean = 0, sd = 1): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * sd;
}

/** 以概率 p 返回 true */
export function chance(p: number): boolean {
  return rand() < p;
}

/** 基于 base 和 variance 生成一个属性值（高斯，钳制 0-99） */
export function rollAttr(base: number, variance: number): number {
  const v = gaussian(base, variance);
  return Math.max(0, Math.min(99, Math.round(v)));
}
