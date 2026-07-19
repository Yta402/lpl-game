import clsx from 'clsx';
import type { AttrKey } from '../types';
import { ATTR_META } from '../constants';
import { attrGroup } from '../constants';
import { attrTier } from '../utils/format';

const GROUP_BAR: Record<string, string> = {
  laning: 'bg-laning',
  teamfight: 'bg-teamfight',
  depth: 'bg-depth',
};

interface AttrBarProps {
  attrKey: AttrKey;
  value: number;
  highlight?: boolean; // 被选中/继承高亮
  showLabel?: boolean;
}

export function AttrBar({ attrKey, value, highlight, showLabel = true }: AttrBarProps) {
  const meta = ATTR_META.find((m) => m.key === attrKey)!;
  const group = attrGroup(attrKey);
  const tier = attrTier(value);
  const barColor = GROUP_BAR[group];
  return (
    <div className="flex items-center gap-2 text-sm">
      {showLabel && (
        <span className="w-16 shrink-0 text-slate-300" title={meta.desc}>
          {meta.label}
        </span>
      )}
      <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-ink-700">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
        {highlight && (
          <div className="absolute inset-0 animate-pulse2 rounded-full ring-2 ring-gold/60" />
        )}
      </div>
      <span className={clsx('w-8 shrink-0 text-right font-mono font-bold', tier.cls)}>
        {value}
      </span>
    </div>
  );
}
