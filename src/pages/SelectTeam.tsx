import { useState } from 'react';
import type { Position } from '../types';
import { useGame, getLplTeams } from '../store/gameStore';
import { TeamCard } from '../components/TeamCard';
import { POSITION_LABEL, POSITION_ORDER } from '../constants';
import clsx from 'clsx';

export function SelectTeam() {
  const lplTeams = getLplTeams();
  const draftPlayer = useGame((s) => s.draftPlayer);
  const joinTeam = useGame((s) => s.joinTeam);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pos, setPos] = useState<Position | null>(null);

  if (!draftPlayer) return null;
  const position = draftPlayer.position;

  // 默认锁定玩家位置（顶替该位置）
  const effectivePos = pos ?? position;

  const selected = lplTeams.find((t) => t.id === selectedId) ?? null;
  const replacedPlayer = selected
    ? selected.roster.find((p) => p.position === effectivePos)
    : null;

  const handleJoin = () => {
    if (!selectedId) return;
    joinTeam(selectedId);
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6">
        <h2 className="text-3xl font-black text-slate-100">加入战队</h2>
        <p className="mt-1 text-sm text-slate-400">
          你将作为 <span className="font-bold text-gold">{POSITION_LABEL[position]}</span> 加入战队，
          顶替该位置的现役选手，与另外 4 位真实队友并肩作战。
        </p>
      </header>

      {/* 位置选择（默认玩家位置，可切换查看） */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">顶替位置：</span>
        {POSITION_ORDER.map((p) => (
          <button
            key={p}
            onClick={() => setPos(p)}
            className={clsx(
              'rounded-md border px-3 py-1 text-xs transition',
              p === effectivePos
                ? p === position
                  ? 'border-gold bg-gold/15 text-gold'
                  : 'border-cyan bg-cyan/15 text-cyan'
                : 'border-ink-600 text-slate-400 hover:border-cyan/40',
            )}
          >
            {POSITION_LABEL[p]}
            {p === position && ' ✓'}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {lplTeams.map((t) => (
          <TeamCard
            key={t.id}
            team={t}
            selected={selectedId === t.id}
            onClick={() => setSelectedId(t.id)}
          />
        ))}
      </div>

      {/* 确认栏 */}
      <div className="sticky bottom-0 mt-8 border-t border-ink-700 bg-ink-950/90 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="text-sm text-slate-400">
            {selected ? (
              <>
                加入 <span className="font-bold text-slate-100">{selected.name}</span>，
                顶替{' '}
                <span className="font-bold text-gold">
                  {replacedPlayer?.name ?? '—'}
                </span>
                （{POSITION_LABEL[effectivePos]}）
              </>
            ) : (
              '请选择一支战队'
            )}
          </div>
          <button
            className={selectedId ? 'btn-primary' : 'btn-secondary'}
            disabled={!selectedId}
            onClick={handleJoin}
          >
            确认加入 → 开始赛季
          </button>
        </div>
      </div>
    </div>
  );
}
