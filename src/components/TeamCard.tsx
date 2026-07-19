import clsx from 'clsx';
import type { Team } from '../types';
import { REGION_TIER } from '../types';
import { POSITION_LABEL, POSITION_ORDER } from '../constants';
import { Avatar } from './Avatar';

interface TeamCardProps {
  team: Team;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
  showRoster?: boolean;
  badge?: string;
}

export function TeamCard({
  team,
  onClick,
  selected,
  className,
  showRoster = true,
  badge,
}: TeamCardProps) {
  const tier = REGION_TIER[team.region];
  return (
    <div
      onClick={onClick}
      className={clsx(
        'card card-hover flex flex-col gap-3',
        onClick && 'cursor-pointer',
        selected && 'ring-2 ring-cyan',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-lg text-lg font-black text-ink-950"
          style={{ background: team.logoColor }}
        >
          {team.name.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-lg font-bold text-slate-100">{team.name}</span>
            <span className="chip bg-ink-700 text-slate-300">{team.region}</span>
            {badge && <span className="chip bg-gold/20 text-gold">{badge}</span>}
          </div>
          <div className="truncate text-xs text-slate-400">
            {team.fullName} · {team.style} · 配合 {team.teamwork} · 均档 ≈{Math.round(tier.base)}
          </div>
        </div>
      </div>

      {showRoster && (
        <div className="flex flex-wrap gap-2">
          {POSITION_ORDER.map((pos) => {
            const p = team.roster.find((m) => m.position === pos);
            if (!p) return null;
            return (
              <div
                key={pos}
                className="flex items-center gap-1.5 rounded-md bg-ink-800 px-2 py-1"
                title={`${POSITION_LABEL[pos]} ${p.name}`}
              >
                <Avatar name={p.name} color={p.avatarColor} size={22} />
                <div className="leading-tight">
                  <div className="text-[10px] text-slate-500">{POSITION_LABEL[pos]}</div>
                  <div className="text-xs font-semibold text-slate-200">{p.name}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
