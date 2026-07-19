import { sample } from '../utils/random';
import { TEAMS } from './teams';

export interface PoolEntry {
  playerId: string;
  name: string;
  teamId: string;
  teamName: string;
  region: string;
  position: import('../types').Position;
}

/** 把所有真实选手压平为候选池 */
function buildPool(): PoolEntry[] {
  const pool: PoolEntry[] = [];
  for (const t of TEAMS) {
    for (const p of t.roster) {
      pool.push({
        playerId: p.id,
        name: p.name,
        teamId: t.id,
        teamName: t.name,
        region: t.region,
        position: p.position,
      });
    }
  }
  return pool;
}

/**
 * 随机抽取 n 位选手作为继承候选。
 * @param excludeIds 需排除的选手 id（避免重复）
 */
export function rollInheritancePool(n = 5, excludeIds: string[] = []): PoolEntry[] {
  const pool = buildPool().filter((e) => !excludeIds.includes(e.playerId));
  return sample(pool, n);
}
