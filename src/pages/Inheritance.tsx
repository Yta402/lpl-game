import { useMemo } from "react";
import clsx from "clsx";
import type { AttrKey } from "../types";
import { useGame } from "../store/gameStore";
import { getTeam } from "../data/teams";
import { applySlots } from "../engine/inheritance";
import { Avatar } from "../components/Avatar";
import { AttrBar } from "../components/AttrBar";
import { AttrRadar } from "../components/AttrRadar";
import {
  POSITION_LABEL,
  ATTR_META,
  attrGroup,
} from "../constants";

const GROUP_DOT: Record<string, string> = {
  laning: "bg-laning",
  teamfight: "bg-teamfight",
  depth: "bg-depth",
};

export function Inheritance() {
  const draftPlayer = useGame((s) => s.draftPlayer);
  const pool = useGame((s) => s.pool);
  const idx = useGame((s) => s.idx);
  const slots = useGame((s) => s.slots);
  const rerollsLeft = useGame((s) => s.rerollsLeft);
  const pickAttr = useGame((s) => s.pickAttr);
  const skipCurrent = useGame((s) => s.skipCurrent);
  const rerollPool = useGame((s) => s.rerollPool);
  const rollPool = useGame((s) => s.rollPool);
  const apply = useGame((s) => s.applyInheritance);

  const preview = useMemo(
    () => (draftPlayer ? applySlots(draftPlayer, slots) : null),
    [draftPlayer, slots],
  );

  if (!draftPlayer || !preview) return null;

  // 注意：pool 为空时 idx(0) >= pool.length(0) 恒为 true，
  // 若不加 pool.length > 0 会把「空池」误判为「已完成」，
  // 导致显示“全部处理完毕”且确认按钮被禁用 → 页面卡死无任何出路。
  const done = pool.length > 0 && idx >= pool.length;
  const current = done ? null : pool[idx];
  const currentSrc = current
    ? getTeam(current.teamId).roster.find((p) => p.id === current.playerId)
    : null;
  const currentTeam = current ? getTeam(current.teamId) : null;

  const filledCount = Object.keys(slots).filter(
    (k) => slots[k as AttrKey],
  ).length;
  const poolSize = pool.length || 9;

  // 预计算当前候选的最弱项（遍历一次，不在 map 循环里调 weakestAttr）
  const currentWeakest: AttrKey | null = currentSrc
    ? (ATTR_META.reduce(
        (worst, m) =>
          currentSrc.attributes[m.key] < currentSrc.attributes[worst]
            ? m.key
            : worst,
        ATTR_META[0].key,
      ) as AttrKey)
    : null;
  const currentWeakestVal = currentWeakest
    ? currentSrc?.attributes[currentWeakest] ?? 0
    : 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-black text-slate-100">属性继承</h2>
          <p className="mt-1 text-sm text-slate-400">
            逐位选择 {poolSize}{" "}
            位职业选手的 1 项属性。每项属性只能正常继承一次；若要
            <span className="text-gold">替换</span>
            已选属性，需连带接受该选手最弱的一项。
          </p>
        </div>
        <button
          className="btn-secondary"
          disabled={rerollsLeft <= 0 || idx !== 0}
          onClick={rerollPool}
        >
          重抽池（剩 {rerollsLeft}）
        </button>
      </header>

      {pool.length === 0 && (
        <div className="card animate-fadeIn text-center">
          <div className="text-lg font-bold text-amber-400">
            ⚠ 继承池为空，请重抽
          </div>
          <button
            className="btn-primary mt-3"
            onClick={() => rollPool()}
          >
            重试
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* 左：当前候选 */}
        <div className="flex flex-col gap-4">
          {!done && currentSrc && current && currentTeam ? (
            <div className="card animate-fadeIn">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-cyan/80">
                  第 {idx + 1} / {poolSize} 位候选
                </span>
                <span className="text-xs text-slate-500">
                  已填 {filledCount} / 9 槽
                </span>
              </div>
              <div className="mb-4 flex items-center gap-3">
                <Avatar
                  name={currentSrc.name}
                  color={currentSrc.avatarColor}
                  size={48}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-bold text-slate-100">
                      {currentSrc.name}
                    </span>
                    <span className="chip bg-ink-700 text-slate-300">
                      {currentTeam.name}
                    </span>
                    <span className="chip bg-ink-700 text-slate-400">
                      {currentTeam.region} ·{" "}
                      {POSITION_LABEL[currentSrc.position]}
                    </span>
                    <span className="chip bg-ink-700 text-slate-400">
                      {currentTeam.style}
                    </span>
                  </div>
                </div>
              </div>

              {/* 一键替换时统一使用 currentWeakest 作为惩罚提示 */}
              {ATTR_META.map((m) => {
                const val = currentSrc.attributes[m.key];
                const locked = slots[m.key] !== undefined;
                const slot = slots[m.key];
                const isUpgrade = locked ? val > (slot?.value ?? 0) : false;
                // 替换时固定使用 currentWeakest（绝对不会是 undefined）
                const penaltyW = currentWeakest ?? ATTR_META[0].key;
                const penaltyVal =
                  currentWeakestVal > 0
                    ? currentWeakestVal
                    : currentSrc.attributes[penaltyW];
                const penaltyLabel =
                  ATTR_META.find((a) => a.key === penaltyW)?.label ??
                  penaltyW;

                return (
                  <div
                    key={m.key}
                    className={clsx(
                      "flex items-center gap-3 rounded-lg px-2 py-1.5",
                      locked && "bg-ink-800/60",
                    )}
                  >
                    <span
                      className={clsx(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        GROUP_DOT[attrGroup(m.key)],
                      )}
                    />
                    <div className="flex-1">
                      <AttrBar attrKey={m.key} value={val} showLabel />
                    </div>
                    <div className="w-[150px] shrink-0 text-right">
                      {!locked ? (
                        <button
                          className="btn-secondary px-3 py-1 text-xs"
                          onClick={() => pickAttr(current, m.key, false)}
                        >
                          继承
                        </button>
                      ) : (
                        <button
                          className={clsx(
                            "rounded-lg border px-3 py-1 text-xs",
                            isUpgrade
                              ? "border-gold/60 bg-gold/10 text-gold hover:bg-gold/20"
                              : "border-ink-600 text-slate-500",
                          )}
                          onClick={() => pickAttr(current, m.key, true)}
                          title={
                            isUpgrade
                              ? `替换为 ${val}（原 ${slot?.value}），连带强制继承 ${penaltyLabel}=${penaltyVal}`
                              : `当前 ${val} 不如已有 ${slot?.value}，替换无收益且仍要连带 ${penaltyLabel}=${penaltyVal}`
                          }
                        >
                          替换↻ {isUpgrade ? "↑" : "↓"} ＋{penaltyLabel}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="mt-4 flex items-center justify-between border-t border-ink-700 pt-3">
                <span className="text-xs text-slate-500">
                  替换会覆盖该属性原值，并强制连带继承该选手最弱项（占一槽）。
                </span>
                <button
                  className="btn-secondary px-4 py-1.5 text-sm"
                  onClick={skipCurrent}
                >
                  跳过这位 →
                </button>
              </div>
            </div>
          ) : done ? (
            <div className="card animate-fadeIn text-center">
              <div className="text-xl font-black text-gold">
                {poolSize} 位候选已全部处理完毕
              </div>
              <p className="mt-1 text-sm text-slate-400">
                已继承 {filledCount} / 9 项属性。确认后进入战队选择。
              </p>
              {filledCount === 0 && (
                <div className="mt-3">
                  <p className="text-sm text-amber-400">
                    你还没有继承任何属性，无法确认。
                  </p>
                  <button
                    className="btn-primary mt-3"
                    onClick={() => rollPool()}
                  >
                    重新抽池
                  </button>
                </div>
              )}
            </div>
          ) : pool.length > 0 ? (
            /* 候选数据缺失的兜底：之前渲染 null，连“跳过”按钮都没有，会硬卡死 */
            <div className="card animate-fadeIn text-center">
              <div className="text-lg font-bold text-amber-400">
                ⚠ 当前候选数据缺失
              </div>
              <button
                className="btn-primary mt-3"
                onClick={skipCurrent}
              >
                跳过这位 →
              </button>
            </div>
          ) : null}

          {/* 已选槽位总览 */}
          <div className="card">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              继承槽位（{filledCount}/9）
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
              {ATTR_META.map((m) => {
                const s = slots[m.key];
                return (
                  <div
                    key={m.key}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <span
                      className={clsx(
                        "h-1.5 w-1.5 rounded-full",
                        GROUP_DOT[attrGroup(m.key)],
                      )}
                    />
                    <span className="text-slate-400">{m.label}</span>
                    {s ? (
                      <span
                        className={clsx(
                          "ml-auto font-mono font-bold",
                          s.isPenalty ? "text-lose" : "text-cyan",
                        )}
                        title={`来自 ${s.playerName}`}
                      >
                        {s.value}
                        {s.isPenalty && " ⚠"}
                      </span>
                    ) : (
                      <span className="ml-auto text-slate-600">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 右：实时预览 */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="card flex flex-col items-center gap-3">
            <div className="stat-label self-start">继承后预览</div>
            <AttrRadar
              attributes={preview.attributes}
              compare={draftPlayer.attributes}
              size={220}
            />
            <div className="w-full rounded-lg bg-ink-800/60 p-3 text-xs text-slate-400">
              <div className="text-slate-500">
                虚线=继承前 · 实线=继承后（朝源值移动 72%）。红色 ⚠ 为惩罚项。
              </div>
            </div>
          </div>
          <button
            className="btn-primary mt-4 w-full"
            onClick={apply}
            disabled={filledCount === 0}
          >
            {done
              ? "确认继承 → 选择战队"
              : `提前完成（已选 ${filledCount} 项）`}
          </button>
          {!done && (
            <p className="mt-2 text-center text-xs text-slate-600">
              你也可以处理完所有候选再确认
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
