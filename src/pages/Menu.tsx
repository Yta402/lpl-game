import { useEffect } from 'react';
import { useGame } from '../store/gameStore';

export function Menu() {
  const phase = useGame((s) => s.phase);
  const hasSave = useGame((s) => s.hasExistingSave);
  const init = useGame((s) => s.init);
  const startNewGame = useGame((s) => s.startNewGame);
  const continueGame = useGame((s) => s.continueGame);

  useEffect(() => {
    init();
  }, [init]);

  if (phase !== 'menu') return null;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-12 text-center">
      <div className="animate-fadeIn">
        <div className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan/80">
          LoL Pro League Simulator
        </div>
        <h1 className="bg-gradient-to-r from-gold via-cyan to-gold bg-clip-text text-5xl font-black tracking-tight text-transparent sm:text-6xl">
          LPL 自建选手模拟器
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-slate-400">
          自建一名选手，继承真实职业选手的属性，加入你喜爱的战队补齐阵容，
          征战<span className="text-slate-200">春季赛 → MSI → 夏季赛 → 世界赛</span>，
          夺取世界冠军。
        </p>
      </div>

      <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
        {hasSave && (
          <button className="btn-primary" onClick={continueGame}>
            继续游戏
          </button>
        )}
        <button
          className={hasSave ? 'btn-secondary' : 'btn-primary'}
          onClick={startNewGame}
        >
          {hasSave ? '开启新档（覆盖）' : '开始游戏'}
        </button>
      </div>

      <div className="mt-12 max-w-xl rounded-lg border border-ink-700 bg-ink-900/60 p-4 text-left text-xs leading-relaxed text-slate-500">
        <span className="font-semibold text-slate-400">版权声明：</span>
        本项目为非商业性同人作品，仅作技术学习与简历展示用途。所有选手 ID、战队名称、赛事名称的知识产权归
        Riot Games 及各俱乐部所有。本项目不使用任何真人照片，头像均为程序生成。选手数据为 2026
        赛季公开名单的近似快照，属性为人工评估值。如有异议请联系移除。
      </div>
    </div>
  );
}
