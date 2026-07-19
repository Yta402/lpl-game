import clsx from 'clsx';
import type { Strat } from '../types';
import type { PendingDecisive } from '../engine/season';
import { getTeam } from '../data/teams';

interface DecisiveDialogProps {
  pending: PendingDecisive;
  onChoose: (strat: Strat) => void;
}

const OPTIONS: { value: Strat; label: string; desc: string; cls: string }[] = [
  {
    value: 'challenge',
    label: '亮剑',
    desc: '你 ×1.1、队友 ×0.9；若对线打穿（对线和领先 ≥18）→ 单线击穿：你 ×1.3、队友惩罚解除',
    cls: 'border-gold/60 text-gold hover:bg-gold/10',
  },
  {
    value: 'sacrifice',
    label: '奉献',
    desc: '你 ×0.8、队友 ×1.1；若 4 队友团战和领先 ≥60 → 团战游龙：队友 ×1.2',
    cls: 'border-teamfight/60 text-teamfight hover:bg-teamfight/10',
  },
  {
    value: 'none',
    label: '常规',
    desc: '不使用任何特殊策略，按正常状态应战',
    cls: 'border-ink-600 text-slate-300 hover:bg-ink-800',
  },
];

/** 世界赛 BO5 决胜局彩蛋弹窗：2:2 时让玩家抉择最后一局的策略 */
export function DecisiveDialog({ pending, onChoose }: DecisiveDialogProps) {
  const enemy = getTeam(pending.enemyId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 backdrop-blur-sm">
      <div className="card mx-4 w-full max-w-lg animate-fadeIn border-gold/40">
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-gold/80">
            {pending.label} · BO5 第五局
          </div>
          <div className="mt-1 text-2xl font-black text-slate-100">
            战歌起！2 : 2 决胜局
          </div>
          <div className="mt-2 text-sm text-slate-400">
            对阵{' '}
            <span className="font-bold" style={{ color: enemy.logoColor }}>
              {enemy.name}
            </span>
            ，最后一局，你选择怎么打？
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => onChoose(o.value)}
              className={clsx(
                'rounded-lg border p-3 text-left transition',
                o.cls,
              )}
            >
              <div className="text-base font-black">{o.label}</div>
              <div className="mt-0.5 text-[11px] leading-snug opacity-70">
                {o.desc}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
