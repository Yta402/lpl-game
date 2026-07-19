import { useGame } from '../store/gameStore';
import { getTeam } from '../data/teams';
import { Avatar } from '../components/Avatar';
import { AttrRadar } from '../components/AttrRadar';
import type { Tournament } from '../types';
import { POSITION_LABEL } from '../constants';
import clsx from 'clsx';

const TOURNAMENT_LABEL: Record<Tournament, string> = {
  spring: 'LPL 春季赛',
  msi: 'MSI 季中冠军赛',
  summer: 'LPL 夏季赛',
  worlds: '全球总决赛',
};

export function Result() {
  const save = useGame((s) => s.save);
  const resetGame = useGame((s) => s.resetGame);

  if (!save) return null;
  const team = getTeam(save.teamId);
  const player = save.customPlayer;
  const career = save.career;

  const worldsChamp = career.worlds?.champion;
  const anyChamp =
    career.spring?.champion ||
    career.msi?.champion ||
    career.summer?.champion ||
    worldsChamp;

  const worldsFmvp = career.worlds?.awards?.some((a) => a.isCustom && a.type === 'FMVP');
  const ending = worldsChamp
    ? {
        title: '世界之巅 👑',
        sub: worldsFmvp
          ? `${player.name} 带领 ${team.name} 夺得全球总决赛冠军，并荣膺总决赛 FMVP，登顶世界！`
          : `${player.name} 带领 ${team.name} 夺得全球总决赛冠军，登顶世界！`,
        cls: 'from-gold via-yellow-300 to-gold text-ink-950',
      }
    : anyChamp
      ? {
          title: '职业生涯圆满',
          sub: `${player.name} 随 ${team.name} 拿下国内/国际赛事冠军，留下浓墨重彩的一笔。`,
          cls: 'from-cyan to-cyan-dark text-ink-950',
        }
      : {
          title: '新人启航',
          sub: `${player.name} 完成了在 ${team.name} 的首个全年征程，未来可期。`,
          cls: 'from-slate-300 to-slate-500 text-ink-950',
        };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div
        className={clsx(
          'card mb-6 bg-gradient-to-r text-center',
          ending.cls,
        )}
      >
        <div className="text-4xl font-black">{ending.title}</div>
        <div className="mt-2 text-sm font-medium opacity-80">{ending.sub}</div>
      </div>

      {/* 玩家名片 */}
      <div className="card mb-6 flex flex-wrap items-center gap-4">
        <Avatar name={player.name} color={player.avatarColor} size={64} />
        <div className="flex-1">
          <div className="text-xl font-black text-slate-100">{player.name}</div>
          <div className="text-sm text-slate-400">
            {POSITION_LABEL[player.position]} · {team.name}
          </div>
        </div>
        <AttrRadar attributes={player.attributes} size={150} />
      </div>

      {/* 成绩单 */}
      <div className="card mb-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          全年成绩单
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {(['spring', 'msi', 'summer', 'worlds'] as Tournament[]).map((t) => {
            const r = career[t];
            return (
              <div
                key={t}
                className={clsx(
                  'rounded-lg border p-3',
                  r?.champion
                    ? 'border-gold/50 bg-gold/10'
                    : 'border-ink-700 bg-ink-800/40',
                )}
              >
                <div className="text-xs text-slate-500">{TOURNAMENT_LABEL[t]}</div>
                {r ? (
                  <div
                    className={clsx(
                      'text-lg font-black',
                      r.champion ? 'text-gold' : 'text-slate-200',
                    )}
                  >
                    {r.champion ? '冠军 🏆' : `第 ${r.finalRank} 名`}
                  </div>
                ) : (
                  <div className="text-lg font-black text-slate-600">未参赛</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 个人荣誉（玩家获得的 MVP/FMVP） */}
      {(() => {
        const myAwards = (['spring', 'msi', 'summer', 'worlds'] as Tournament[])
          .flatMap((t) => career[t]?.awards ?? [])
          .filter((a) => a.isCustom);
        if (myAwards.length === 0) return null;
        return (
          <div className="card mb-6 bg-gold/5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gold">
              🏅 个人荣誉
            </h3>
            <div className="flex flex-wrap gap-2">
              {myAwards.map((a, i) => (
                <span key={i} className="chip bg-gold/15 text-gold">
                  {TOURNAMENT_LABEL[a.tournament]} {a.type === 'MVP' ? '常规赛 MVP' : 'FMVP'}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="flex gap-3">
        <button className="btn-secondary flex-1" onClick={() => resetGame()}>
          重新开始
        </button>
      </div>

      <p className="mt-6 text-center text-xs text-slate-600">
        感谢游玩 LPL 自建选手模拟器 · 本项目为非商业性同人作品
      </p>
    </div>
  );
}
