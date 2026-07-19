import clsx from 'clsx';
import type { SeriesResult } from '../types';
import { getTeam } from '../data/teams';
import { formatKDA } from '../utils/format';

interface SeriesResultCardProps {
  series: SeriesResult;
  label?: string; // 如 "半决赛 / 决赛"
}

export function SeriesResultCard({ series, label }: SeriesResultCardProps) {
  const enemy = getTeam(series.opponentId);
  const avgRating =
    series.games.reduce((s, g) => s + g.rating, 0) / (series.games.length || 1);
  const solokills = series.games.filter((g) => g.solokillTriggered).length;
  const carries = series.games.filter((g) => g.teamfightCarryTriggered).length;
  const challenged = series.games.filter((g) => g.strat === 'challenge').length;
  const sacrificed = series.games.filter((g) => g.strat === 'sacrifice').length;
  const lastGame = series.games[series.games.length - 1];

  return (
    <div
      className={clsx(
        'card flex flex-col gap-2',
        series.isWin ? 'border-l-4 border-l-win' : 'border-l-4 border-l-lose',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          {label && <span className="text-xs text-slate-500">{label}</span>}
          <span className="font-semibold text-slate-300">vs</span>
          <span className="font-bold text-slate-100">{enemy.name}</span>
          <span className="chip bg-ink-700 text-xs text-slate-400">{enemy.region}</span>
        </div>
        <div
          className={clsx(
            'font-mono text-xl font-black',
            series.isWin ? 'text-win' : 'text-lose',
          )}
        >
          {series.myWin} : {series.enWin}
          <span className="ml-2 text-xs">
            BO{series.bestOf} · {series.isWin ? '胜' : '负'}
          </span>
        </div>
      </div>

      {lastGame && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
          <span>
            决胜局 KDA:{' '}
            <span className="font-mono font-semibold text-slate-200">
              {formatKDA(lastGame.kda)}
            </span>
          </span>
          <span>
            评分 <span className="font-semibold text-gold">{avgRating.toFixed(1)}</span>
          </span>
          {solokills > 0 && (
            <span className="chip bg-laning/20 text-laning">
              单线击穿 ×{solokills}
            </span>
          )}
          {carries > 0 && (
            <span className="chip bg-teamfight/20 text-teamfight">
              团战游龙 ×{carries}
            </span>
          )}
          {challenged > 0 && solokills === 0 && (
            <span className="chip bg-gold/20 text-gold">亮剑(未击穿) ×{challenged}</span>
          )}
          {sacrificed > 0 && (
            <span className="chip bg-depth/20 text-depth">奉献 ×{sacrificed}</span>
          )}
        </div>
      )}
    </div>
  );
}
