import clsx from 'clsx';
import type { Standing } from '../engine/season';
import type { Team } from '../types';
import { getTeam } from '../data/teams';

interface StandingsTableProps {
  standings: Standing[];
  highlightTeamId?: string;
  topN?: number; // 高亮前 N 名（出线区）
  teams?: Team[]; // 可选，用于显示更多信息
}

export function StandingsTable({
  standings,
  highlightTeamId,
  topN,
}: StandingsTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-ink-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-ink-800 text-xs uppercase tracking-wider text-slate-400">
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">战队</th>
            <th className="px-3 py-2 text-center">胜</th>
            <th className="px-3 py-2 text-center">负</th>
            <th className="px-3 py-2 text-center">胜率</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, idx) => {
            const team = getTeam(s.teamId);
            const total = s.wins + s.losses;
            const rate = total > 0 ? Math.round((s.wins / total) * 100) : 0;
            const isMe = s.teamId === highlightTeamId;
            const inTop = topN != null && idx < topN;
            return (
              <tr
                key={s.teamId}
                className={clsx(
                  'border-t border-ink-700/60',
                  isMe ? 'bg-gold/10' : 'bg-ink-850/40',
                )}
              >
                <td className="px-3 py-2">
                  <span
                    className={clsx(
                      'inline-flex h-5 w-5 items-center justify-center rounded text-xs font-bold',
                      inTop ? 'bg-cyan/20 text-cyan' : 'text-slate-500',
                    )}
                  >
                    {idx + 1}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ background: team.logoColor }}
                    />
                    <span
                      className={clsx(
                        'font-semibold',
                        isMe ? 'text-gold' : 'text-slate-200',
                      )}
                    >
                      {team.name}
                    </span>
                    {isMe && <span className="text-[10px] text-gold">（你）</span>}
                  </span>
                </td>
                <td className="px-3 py-2 text-center font-mono text-win">{s.wins}</td>
                <td className="px-3 py-2 text-center font-mono text-lose">{s.losses}</td>
                <td className="px-3 py-2 text-center font-mono text-slate-400">{rate}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
