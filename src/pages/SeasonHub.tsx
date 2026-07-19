import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useGame } from '../store/gameStore';
import { getTeam } from '../data/teams';
import type { SeasonResult, SeriesResult, Standing, Tournament } from '../types';
import {
  simulateSpring,
  simulateSummer,
  simulateMsi,
  worldsLplSeeds,
} from '../engine/season';
import { growPlayer } from '../engine/customPlayer';
import { Avatar } from '../components/Avatar';
import { AttrRadar } from '../components/AttrRadar';
import { StandingsTable } from '../components/StandingsTable';
import { SeriesResultCard } from '../components/SeriesResultCard';
import { PlayoffStepper } from '../components/PlayoffStepper';
import { DecisiveDialog } from '../components/DecisiveDialog';
import { POSITION_LABEL } from '../constants';

const TOURNAMENT_LABEL: Record<Tournament, string> = {
  spring: 'LPL 春季赛',
  msi: 'MSI 季中冠军赛',
  summer: 'LPL 夏季赛',
  worlds: '全球总决赛',
};

export function SeasonHub() {
  const save = useGame((s) => s.save);
  const setSave = useGame((s) => s.setSave);
  const goTo = useGame((s) => s.goTo);
  const worldsLive = useGame((s) => s.worldsLive);
  const startWorlds = useGame((s) => s.startWorlds);
  const stepWorlds = useGame((s) => s.stepWorlds);
  const chooseWorldsStrat = useGame((s) => s.chooseWorldsStrat);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<Tournament | null>(null);
  // 刚模拟完的赛事：季后赛逐场揭示；重看旧赛事则全部展开
  const [fresh, setFresh] = useState<Tournament | null>(null);

  const team = save ? getTeam(save.teamId) : null;
  const player = save?.customPlayer ?? null;
  const career = save?.career ?? {};

  // 决定下一个动作
  const next = useMemo(() => {
    if (!career.spring) return { kind: 'spring' as const };
    if (!career.msi) return { kind: 'msi' as const }; // MSI 总是进行（玩家未晋级也照常模拟）
    if (!career.summer) return { kind: 'summer' as const };
    const seeds = worldsLplSeeds(career.spring, career.msi, career.summer);
    const qualified = save && seeds.includes(save.teamId);
    if (qualified && !career.worlds) return { kind: 'worlds' as const };
    return { kind: 'done' as const }; // 未进世界赛 → 赛季结束
  }, [career, save]);

  if (!save || !team || !player) return null;

  const avgRatingOf = (series: SeriesResult[] = []) =>
    series.length === 0
      ? 0
      : series.reduce(
          (s, sr) =>
            s + sr.games.reduce((g, x) => g + x.rating, 0) / sr.games.length,
          0,
        ) / series.length;

  const applyGrowth = (result: SeasonResult) => {
    const allSeries = [
      ...(result.regularGames ?? []),
      ...result.playoffGames,
    ];
    const avg = avgRatingOf(allSeries);
    return growPlayer(player, avg);
  };

  const runStage = async (kind: typeof next.kind) => {
    setBusy(true);
    // 让 UI 有机会更新（loading）
    await new Promise((r) => setTimeout(r, 30));
    try {
      if (kind === 'spring') {
        const r = simulateSpring(team, player);
        setSave((s) => ({
          ...s,
          customPlayer: applyGrowth(r),
          career: { ...s.career, spring: r },
        }));
        setFocus('spring');
        setFresh('spring');
      } else if (kind === 'msi') {
        const lplSeeds = career.spring?.topTeams ?? [team.id];
        const r = simulateMsi(team, player, lplSeeds, 'none');
        setSave((s) => ({
          ...s,
          customPlayer: applyGrowth(r),
          career: { ...s.career, msi: r },
        }));
        setFocus('msi');
        setFresh('msi');
      } else if (kind === 'summer') {
        const r = simulateSummer(team, player);
        setSave((s) => ({
          ...s,
          customPlayer: applyGrowth(r),
          career: { ...s.career, summer: r },
        }));
        setFocus('summer');
        setFresh('summer');
      } else if (kind === 'worlds') {
        // 世界赛改为交互式：先跑小组赛，淘汰赛由玩家逐场推进（决胜局触发策略彩蛋）
        const seeds = worldsLplSeeds(career.spring, career.msi, career.summer);
        startWorlds(seeds);
        setFocus('worlds');
        setFresh('worlds');
      }
    } finally {
      setBusy(false);
    }
  };

  const focusResult: SeasonResult | undefined = focus
    ? career[focus]
    : undefined;
  // 世界赛淘汰赛进行中（尚未写入 career）
  const liveWorlds = focus === 'worlds' && !focusResult ? worldsLive : null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* 顶部：玩家 + 战队概览 */}
      <header className="card mb-6 flex flex-wrap items-center gap-4">
        <Avatar name={player.name} color={player.avatarColor} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-slate-100">{player.name}</span>
            <span className="chip bg-gold/20 text-gold">自建 · {POSITION_LABEL[player.position]}</span>
          </div>
          <div className="text-sm text-slate-400">
            效力{' '}
            <span
              className="font-semibold"
              style={{ color: team.logoColor }}
            >
              {team.name}
            </span>{' '}
            · {team.fullName}
          </div>
        </div>
        <div className="w-[140px]">
          <AttrRadar attributes={player.attributes} size={140} />
        </div>
      </header>

      {/* 赛事进度时间线 */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['spring', 'msi', 'summer', 'worlds'] as Tournament[]).map((t) => {
          const r = career[t];
          const done = !!r;
          const isFocus = focus === t;
          const live = t === 'worlds' && !done && !!worldsLive;
          return (
            <button
              key={t}
              onClick={() => {
                if (done || live) {
                  setFocus(t);
                  setFresh(null);
                }
              }}
              className={clsx(
                'card flex flex-col items-start gap-1 text-left transition',
                isFocus && 'ring-2 ring-cyan',
                !done && !live && 'opacity-50',
              )}
            >
              <span className="text-xs uppercase tracking-wider text-slate-500">
                {TOURNAMENT_LABEL[t]}
              </span>
              {done ? (
                <span
                  className={clsx(
                    'text-lg font-black',
                    r!.champion
                      ? 'text-gold'
                      : r!.qualified
                        ? 'text-cyan'
                        : r!.finalRank > 0
                          ? 'text-slate-300'
                          : 'text-slate-500',
                  )}
                >
                  {r!.champion
                    ? '冠军 🏆'
                    : r!.finalRank > 0
                      ? `第 ${r!.finalRank} 名`
                      : '未参赛'}
                </span>
              ) : live ? (
                <span className="text-lg font-black text-cyan">进行中…</span>
              ) : (
                <span className="text-lg font-black text-slate-600">未进行</span>
              )}
            </button>
          );
        })}
      </div>

      {/* 下一步动作 */}
      <div className="mb-6">
        {next.kind !== 'done' ? (
          <div className="card flex flex-col gap-4 bg-gradient-to-r from-ink-850 to-ink-800">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-cyan/80">下一阶段</div>
                <div className="text-2xl font-black text-slate-100">
                  {TOURNAMENT_LABEL[next.kind]}
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  {next.kind === 'msi' && '代表 LPL 出征国际赛场，8 队 BO5 单败淘汰'}
                  {next.kind === 'spring' && '常规赛单循环 + Top4 季后赛 BO5'}
                  {next.kind === 'summer' && '常规赛 + Top6 胜败组双败 BO5'}
                  {next.kind === 'worlds' && '16 队小组循环 + 8 强 BO5 淘汰（决胜局有惊喜）'}
                </div>
              </div>
              <button
                className="btn-primary"
                disabled={busy || (next.kind === 'worlds' && !!worldsLive)}
                onClick={() => runStage(next.kind)}
              >
                {busy
                  ? '模拟中…'
                  : next.kind === 'worlds' && worldsLive
                    ? '世界赛进行中'
                    : `开始 ${TOURNAMENT_LABEL[next.kind]}`}
              </button>
            </div>
          </div>
        ) : (
          <div className="card flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-2xl font-black text-gold">全年征程结束</div>
              <div className="mt-1 text-sm text-slate-400">查看你的职业生涯总结</div>
            </div>
            <button className="btn-primary" onClick={() => goTo('result')}>
              查看结局 →
            </button>
          </div>
        )}

        {/* 未晋级 MSI / 世界赛 提示 */}
        {next.kind === 'msi' &&
          career.spring &&
          !career.spring.qualified && (
            <div className="mt-2 text-sm text-amber-400">
              ⓘ 春季赛未进入 Top2，MSI 将由其他 LPL 队伍出征（赛事仍照常进行，可查看赛果）。
            </div>
          )}
        {next.kind === 'done' && career.summer && !career.worlds && (
          <div className="mt-2 text-sm text-lose">
            ⚠ 年度积分（春+MSI+夏）未进入 LPL 前 4，无缘世界赛，本赛季结束。
          </div>
        )}
      </div>

      {/* 当前关注阶段的详情 */}
      {focusResult && (
        <StageDetail
          result={focusResult}
          teamId={team.id}
          customPlayerId={player.id}
          fresh={fresh === focus}
        />
      )}
      {liveWorlds && (
        <LiveWorldsDetail
          teamId={team.id}
          customPlayerId={player.id}
          onStep={stepWorlds}
        />
      )}
      {!focusResult && !liveWorlds && (
        <div className="card text-center text-sm text-slate-500">
          点击上方赛事卡片查看详细赛况，或开始下一阶段。
        </div>
      )}

      {/* 世界赛决胜局策略彩蛋弹窗 */}
      {worldsLive?.session.pending && (
        <DecisiveDialog
          pending={worldsLive.session.pending}
          onChoose={chooseWorldsStrat}
        />
      )}
    </div>
  );
}

// ============================================
// 战绩汇总条：明确告诉玩家赢了几场、输了几场
// ============================================
function WinLossBar({
  standings,
  regularLabel,
  playoffGames,
  teamId,
}: {
  standings?: Standing[];
  regularLabel: string;
  playoffGames: { isWin: boolean }[];
  teamId: string;
}) {
  const reg = standings?.find((s) => s.teamId === teamId);
  const poWins = playoffGames.filter((g) => g.isWin).length;
  const poLosses = playoffGames.length - poWins;
  if (!reg && playoffGames.length === 0) return null;
  return (
    <div className="card flex flex-wrap items-center justify-center gap-x-8 gap-y-2 bg-ink-850/60">
      {reg && (
        <div className="text-center">
          <div className="text-xs uppercase tracking-wider text-slate-500">
            {regularLabel}
          </div>
          <div className="text-xl font-black">
            <span className="text-win">{reg.wins} 胜</span>
            <span className="mx-1 text-slate-600">·</span>
            <span className="text-lose">{reg.losses} 负</span>
          </div>
        </div>
      )}
      {playoffGames.length > 0 && (
        <div className="text-center">
          <div className="text-xs uppercase tracking-wider text-slate-500">
            淘汰赛
          </div>
          <div className="text-xl font-black">
            <span className="text-win">{poWins} 胜</span>
            <span className="mx-1 text-slate-600">·</span>
            <span className="text-lose">{poLosses} 负</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// 阶段详情（已完成的赛事）
// ============================================
function StageDetail({
  result,
  teamId,
  customPlayerId,
  fresh,
}: {
  result: SeasonResult;
  teamId: string;
  customPlayerId: string;
  fresh: boolean;
}) {
  const standings = result.standings ?? result.groupStandings;
  // 从名次表推算本届冠军（玩家未参赛时用于叙事展示）
  const championFromPlacements = result.placements
    ? Object.entries(result.placements).find(([, p]) => p === 1)?.[0]
    : undefined;
  const championTeam = championFromPlacements ? getTeam(championFromPlacements) : undefined;
  const notParticipated = !result.qualified && result.finalRank === 0;
  const timeline = result.timeline ?? [];

  return (
    <div className="flex flex-col gap-4">
      {result.champion && (
        <div className="card animate-fadeIn bg-gold/10 text-center">
          <div className="text-3xl font-black text-gold">🏆 夺冠！</div>
          <div className="mt-1 text-sm text-slate-300">
            {TOURNAMENT_LABEL[result.tournament]} 冠军
          </div>
        </div>
      )}

      {notParticipated && championTeam && (
        <div className="card animate-fadeIn text-center">
          <div className="text-lg font-black text-slate-200">
            你的战队未参赛
          </div>
          <div className="mt-1 text-sm text-slate-400">
            本届 {TOURNAMENT_LABEL[result.tournament]} 冠军：
            <span className="font-bold" style={{ color: championTeam.logoColor }}>
              {' '}{championTeam.name}
            </span>
          </div>
        </div>
      )}

      {result.awards && result.awards.length > 0 && (
        <div className="card flex flex-wrap items-center justify-center gap-3 bg-ink-850/60 text-center">
          {result.awards.map((a) => (
            <span
              key={a.type + a.playerId}
              className={clsx(
                'chip text-sm',
                a.isCustom ? 'bg-gold/20 text-gold' : 'bg-ink-700 text-slate-300',
              )}
            >
              🏅 {a.type === 'MVP' ? '常规赛 MVP' : '总决赛 FMVP'}
              {' '}
              <span className="font-bold">{a.playerName}</span>
              {a.isCustom && '（你）'}
            </span>
          ))}
        </div>
      )}

      <WinLossBar
        standings={standings}
        regularLabel={result.tournament === 'worlds' ? '小组赛' : '常规赛'}
        playoffGames={result.playoffGames}
        teamId={teamId}
      />

      {standings && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            积分榜{result.tournament === 'worlds' ? '（你的小组）' : ''}
          </h3>
          <StandingsTable
            standings={standings}
            highlightTeamId={teamId}
            topN={result.tournament === 'worlds' ? 2 : result.tournament === 'summer' ? 6 : 4}
          />
        </section>
      )}

      {(result.regularGames?.length ?? 0) > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            {result.tournament === 'worlds' ? '小组赛' : '常规赛'}（{result.regularGames!.length} 场）
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {result.regularGames!.map((s, i) => (
              <SeriesResultCard key={i} series={s} label={`第 ${i + 1} 场 BO${s.bestOf}`} />
            ))}
          </div>
        </section>
      )}

      {/* 季后赛/淘汰赛：逐场模拟 */}
      {timeline.length > 0 ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            淘汰赛（BO{timeline[0]?.bestOf ?? 5}）· 逐场模拟
          </h3>
          <PlayoffStepper
            matches={timeline}
            myTeamId={teamId}
            customPlayerId={customPlayerId}
            mode="replay"
            startCollapsed={fresh}
          />
        </section>
      ) : (
        result.playoffGames.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
              淘汰赛（BO{result.playoffGames[0]?.bestOf ?? 5}）
            </h3>
            <div className="grid gap-2">
              {result.playoffGames.map((s, i) => (
                <SeriesResultCard
                  key={i}
                  series={s}
                  label={playoffLabel(result.tournament, i, result.playoffGames.length)}
                />
              ))}
            </div>
          </section>
        )
      )}
    </div>
  );
}

// ============================================
// 世界赛淘汰赛进行中（交互式会话）
// ============================================
function LiveWorldsDetail({
  teamId,
  customPlayerId,
  onStep,
}: {
  teamId: string;
  customPlayerId: string;
  onStep: () => void;
}) {
  const worldsLive = useGame((s) => s.worldsLive);
  if (!worldsLive) return null;
  const { playerGroupStandings, regularGames, advanced, session } = worldsLive;

  return (
    <div className="flex flex-col gap-4">
      <WinLossBar
        standings={playerGroupStandings ?? undefined}
        regularLabel="小组赛"
        playoffGames={session.playerSeries}
        teamId={teamId}
      />

      {playerGroupStandings && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            积分榜（你的小组）
          </h3>
          <StandingsTable
            standings={playerGroupStandings}
            highlightTeamId={teamId}
            topN={2}
          />
          {!advanced && (
            <div className="mt-2 text-sm text-amber-400">
              ⓘ 小组未能出线，淘汰赛将由其他队伍进行（仍可逐场查看赛果）。
            </div>
          )}
        </section>
      )}

      {regularGames.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            小组赛（{regularGames.length} 场）
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {regularGames.map((s, i) => (
              <SeriesResultCard key={i} series={s} label={`第 ${i + 1} 场 BO${s.bestOf}`} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          淘汰赛（BO5）· 逐场模拟
        </h3>
        <PlayoffStepper
          matches={session.matches}
          myTeamId={teamId}
          customPlayerId={customPlayerId}
          mode="live"
          pending={!!session.pending}
          done={session.done}
          onStep={onStep}
        />
      </section>
    </div>
  );
}

function playoffLabel(t: Tournament, i: number, total: number): string {
  if (t === 'summer') {
    // 夏季赛双败：系列较多，简单按顺序标
    return `第 ${i + 1} 场`;
  }
  if (total === 1) return '决赛';
  if (total === 2) return i === 0 ? '半决赛' : '决赛';
  return `第 ${i + 1} 轮`;
}
