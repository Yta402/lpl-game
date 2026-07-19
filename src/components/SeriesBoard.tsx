import clsx from 'clsx';
import type { SeriesResult } from '../types';
import { getTeam } from '../data/teams';
import { Avatar } from './Avatar';
import { POSITION_LABEL } from '../constants';

interface SeriesBoardProps {
  series: SeriesResult;
  myTeamId: string;
  customPlayerId: string;
}

/** 系列赛全员战绩表：双方各 5 人，KDA 为系列累计，评分为场均 */
export function SeriesBoard({ series, myTeamId, customPlayerId }: SeriesBoardProps) {
  const board = series.board;
  if (!board || board.length === 0) return null;

  const enemyId = series.opponentId;

  const renderTeam = (teamId: string, won: boolean) => {
    const team = getTeam(teamId);
    const rows = board
      .filter((s) => s.teamId === teamId)
      .slice()
      .sort((a, b) => b.rating - a.rating);
    return (
      <div className="rounded-lg bg-ink-900/40 p-2">
        <div className="mb-1.5 flex items-center gap-2 px-1">
          <span className="text-xs font-bold" style={{ color: team.logoColor }}>
            {team.name}
          </span>
          <span
            className={clsx(
              'text-[10px] font-semibold',
              won ? 'text-win' : 'text-lose',
            )}
          >
            {won ? '胜' : '负'}
          </span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-1 py-0.5 font-medium">选手</th>
              <th className="px-1 py-0.5 font-medium">位置</th>
              <th className="px-1 py-0.5 text-right font-medium">K / D / A</th>
              <th className="px-1 py-0.5 text-right font-medium">评分</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const isMe = s.playerId === customPlayerId;
              // 自建选手不在队伍 roster 里，用金色头像兜底
              const avatarColor = isMe
                ? '#eab308'
                : (team.roster.find((p) => p.id === s.playerId)?.avatarColor ?? '');
              return (
                <tr
                  key={s.playerId}
                  className={clsx(
                    'border-t border-ink-800',
                    isMe && 'bg-gold/10',
                  )}
                >
                  <td className="px-1 py-1">
                    <span className="flex items-center gap-1.5">
                      <Avatar
                        name={s.name}
                        color={avatarColor}
                        size={18}
                      />
                      <span
                        className={clsx(
                          'font-semibold',
                          isMe ? 'text-gold' : 'text-slate-200',
                        )}
                      >
                        {s.name}
                        {isMe && ' (你)'}
                      </span>
                    </span>
                  </td>
                  <td className="px-1 py-1 text-slate-400">
                    {POSITION_LABEL[s.position]}
                  </td>
                  <td className="px-1 py-1 text-right font-mono text-slate-300">
                    {s.kills} / {s.deaths} / {s.assists}
                  </td>
                  <td
                    className={clsx(
                      'px-1 py-1 text-right font-mono font-bold',
                      s.rating >= 8
                        ? 'text-gold'
                        : s.rating >= 6
                          ? 'text-slate-200'
                          : 'text-slate-500',
                    )}
                  >
                    {s.rating.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {renderTeam(myTeamId, series.isWin)}
      {renderTeam(enemyId, !series.isWin)}
    </div>
  );
}
