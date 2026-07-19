/** 将数值限制在 [min, max] 区间 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 取整到整数（四舍五入） */
export function roundInt(value: number): number {
  return Math.round(value);
}
