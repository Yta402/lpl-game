import type { KDA, Position } from '../types';
import { POSITION_LABEL } from '../constants';

/** KDA 文本化，如 "5/1/8" 或 "0/3/2" */
export function formatKDA(kda: KDA): string {
  return `${kda.kills}/${kda.deaths}/${kda.assists}`;
}

/** KDA 比率 */
export function kdaRatio(kda: KDA): number {
  const { kills, deaths, assists } = kda;
  if (deaths === 0) return kills + assists;
  return (kills + assists) / deaths;
}

/** 位置中文 */
export function posLabel(p: Position): string {
  return POSITION_LABEL[p];
}

/** 比分 "2:1" */
export function formatScore(a: number, b: number): string {
  return `${a} : ${b}`;
}

/** 评分保留一位小数 */
export function formatRating(r: number): string {
  return r.toFixed(1);
}

/** 属性值对应的等级颜色提示词 */
export function attrTier(v: number): { label: string; cls: string } {
  if (v >= 90) return { label: 'S+', cls: 'text-gold' };
  if (v >= 80) return { label: 'S', cls: 'text-gold' };
  if (v >= 70) return { label: 'A', cls: 'text-cyan' };
  if (v >= 60) return { label: 'B', cls: 'text-emerald-400' };
  if (v >= 45) return { label: 'C', cls: 'text-slate-300' };
  return { label: 'D', cls: 'text-slate-500' };
}
