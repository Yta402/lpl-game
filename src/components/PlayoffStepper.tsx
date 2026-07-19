import { useState } from 'react';
import clsx from 'clsx';
import type { MatchRecord } from '../types';
import { getTeam } from '../data/teams';
import { SeriesBoard } from './SeriesBoard';

interface PlayoffStepperProps {
  /** 已完成的比赛（回放模式=全部预计算结果；实时模式=会话中已完成的场次） */
  matches: MatchRecord[];
  myTeamId: string;
  customPlayerId: string;
  /**
   * replay：结果已预计算，点击逐场揭示（赛事重看时默认全部展开）
   * live：世界赛交互会话，点击才真正模拟下一场
   */
  mode: 'replay' | 'live';
  /** 实时模式：是否正在等待玩家做决胜局抉择 */
  pending?: boolean;
  /** 实时模式：是否已全部打完 */
  done?: boolean;
  /** 实时模式：模拟下一场 */
  onStep?: () => void;
  /** 回放模式：初次查看为 true（从 0 开始逐步揭示），重看为 false（全部展开） */
  startCollapsed?: boolean;
}

/**
 * 季后赛/淘汰赛逐场模拟器：按真实顺序一场一场展示对阵、比分与全员战绩。
 */
export function PlayoffStepper({
  matches,
  myTeamId,
  customPlayerId,
  mode,
  pending = false,
  done = false,
  onStep,
  startCollapsed = false,
}: PlayoffStepperProps) {
  const [revealed, setRevealed] = useState(
    mode === 'live' || !startCollapsed ? matches.length : 0,
  );

  const visible = mode === 'live' ? matches : matches.slice(0, revealed);
  const allRevealed = mode === 'live' ? done : revealed >= matches.length;
  const total = mode === 'live' ? undefined : matches.length;

  return (
    <div className="flex flex-col gap-3">
      {visible.length === 0 && (
        <div className="card text-center text-sm text-slate-500">
          淘汰赛对阵已确定，点击下方按钮开始逐场模拟。
        </div>
      )}

      {visible.map((m, i) => (
        <MatchCard
          key={i}
          match={m}
          myTeamId={myTeamId}
          customPlayerId={customPlayerId}
        />
      ))}

      {/* 底部操作区 */}
      <div className="flex items-center justify-center gap-3">
        {!allRevealed && !pending && (
          <button
            className="btn-primary"
            onClick={() => {
              if (mode === 'live') onStep?.();
              else setRevealed((r) => Math.min(r + 1, matches.length));
            }}
          >
            模拟下一场 ▶
            {total != null && (
              <span className="ml-1 text-xs opacity-70">
                {revealed}/{total}
              </span>
            )}
          </button>
        )}
        {pending && (
          <div className="text-sm font-semibold text-gold animate-pulse">
            ⏳ 决胜局！请在弹窗中做出你的抉择…
          </div>
        )}
        {allRevealed && visible.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              {mode === 'live' ? '本届淘汰赛已全部结束' : '全部比赛已展示'}
            </span>
            {mode === 'replay' && startCollapsed && (
              <button
                className="btn-secondary px-3 py-1 text-xs"
                onClick={() => setRevealed(0)}
              >
                重新播放 ↻
              </button>
            )}
          </div>
        )}
        {!allRevealed && mode === 'replay' && revealed > 0 && (
          <button
            className="btn-secondary px-3 py-1 text-xs"
            onClick={() => setRevealed(matches.length)}
          >
            全部展开
          </button>
        )}
      </div>
    </div>
  );
}

function MatchCard({
  match,
  myTeamId,
  customPlayerId,
}: {
  match: MatchRecord;
  myTeamId: string;
  customPlayerId: string;
}) {
  const a = getTeam(match.teamAId);
  const b = getTeam(match.teamBId);
  const involvesMe = match.teamAId === myTeamId || match.teamBId === myTeamId;
  const iWon = match.winnerId === myTeamId;

  return (
    <div
      className={clsx(
        'card animate-fadeIn flex flex-col gap-3',
        involvesMe &&
          (iWon ? 'border-l-4 border-l-win' : 'border-l-4 border-l-lose'),
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="chip bg-ink-700 text-xs text-cyan">{match.label}</span>
          <span className="text-xs text-slate-500">BO{match.bestOf}</span>
        </div>
        {involvesMe && (
          <span
            className={clsx(
              'text-sm font-black',
              iWon ? 'text-win' : 'text-lose',
            )}
          >
            {iWon ? '胜' : '负'}
          </span>
        )}
      </div>

      <div className="flex items-center justify-center gap-4">
        <TeamName name={a.name} color={a.logoColor} winner={match.winnerId === a.id} />
        <span className="font-mono text-2xl font-black text-slate-100">
          {match.winA} : {match.winB}
        </span>
        <TeamName name={b.name} color={b.logoColor} winner={match.winnerId === b.id} />
      </div>

      {match.series?.board && (
        <SeriesBoard
          series={match.series}
          myTeamId={myTeamId}
          customPlayerId={customPlayerId}
        />
      )}
    </div>
  );
}

function TeamName({
  name,
  color,
  winner,
}: {
  name: string;
  color: string;
  winner: boolean;
}) {
  return (
    <span
      className={clsx('text-base font-bold', !winner && 'opacity-50')}
      style={{ color }}
    >
      {name}
    </span>
  );
}
