import { useState } from 'react';
import clsx from 'clsx';
import type { Position } from '../types';
import { POSITION_LABEL, POSITION_ORDER, POSITION_WEIGHTS } from '../constants';
import { useGame } from '../store/gameStore';
import { Avatar } from '../components/Avatar';
import { genCustomBaseAttrs } from '../engine/customPlayer';
import { AVATAR_COLORS } from '../constants';
import { pick } from '../utils/random';

const POS_DESC: Record<Position, string> = {
  top: '孤岛上路，对线压制与单带分推的艺术家',
  jungle: '野区指挥官，掌控节奏与资源的灵魂',
  mid: '中路枢纽，游走支援与团战爆发的核心',
  adc: '下路输出，后期 Carry 全队的火力点',
  support: '辅助大脑，开团保护与视野的节拍器',
};

export function CreatePlayer() {
  const createPlayer = useGame((s) => s.createPlayer);
  const [name, setName] = useState('');
  const [position, setPosition] = useState<Position | null>(null);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [color, setColor] = useState(AVATAR_COLORS[5]);
  const [previewSeed, setPreviewSeed] = useState(0);

  // 预览属性：基于当前位置实时生成（仅展示分布，不锁定）
  const previewAttrs =
    position != null ? genCustomBaseAttrs(position) : null;
  const w = position ? POSITION_WEIGHTS[position] : null;

  const canConfirm = name.trim().length > 0 && position != null;

  const handleConfirm = () => {
    if (!canConfirm || !position) return;
    createPlayer({ name: name.trim(), position, gender });
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-8 text-center">
        <h2 className="text-3xl font-black text-slate-100">创建你的选手</h2>
        <p className="mt-1 text-sm text-slate-400">
          从一名新人开始。基础属性较弱，将在下一步从职业选手处继承。
        </p>
      </header>

      {/* 预览头像 */}
      <div className="mb-8 flex flex-col items-center gap-2">
        <Avatar name={name || '?'} color={color} size={88} />
        <button
          className="text-xs text-cyan hover:underline"
          onClick={() => {
            setColor(pick(AVATAR_COLORS));
            setPreviewSeed((s) => s + 1);
          }}
        >
          换个配色 ↻
        </button>
        {previewSeed !== null && <span className="hidden">{previewSeed}</span>}
      </div>

      {/* 昵称 */}
      <section className="card mb-5">
        <label className="stat-label">选手 ID</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 12))}
          placeholder="输入你的职业 ID（最多 12 字符）"
          className="mt-2 w-full rounded-lg border border-ink-600 bg-ink-900 px-4 py-3 text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan"
        />
      </section>

      {/* 位置 */}
      <section className="card mb-5">
        <div className="stat-label mb-3">游戏位置</div>
        <div className="grid grid-cols-5 gap-2">
          {POSITION_ORDER.map((p) => (
            <button
              key={p}
              onClick={() => setPosition(p)}
              className={clsx(
                'rounded-lg border py-3 text-center text-sm font-semibold transition',
                position === p
                  ? 'border-cyan bg-cyan/15 text-cyan'
                  : 'border-ink-600 bg-ink-800 text-slate-300 hover:border-cyan/50',
              )}
            >
              {POSITION_LABEL[p]}
            </button>
          ))}
        </div>
        {position && (
          <p className="mt-3 text-sm text-slate-400">{POS_DESC[position]}</p>
        )}
      </section>

      {/* 属性分布预览 */}
      {previewAttrs && w && (
        <section className="card mb-5">
          <div className="stat-label mb-2">基础属性分布预览（位置权重）</div>
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            {(
              [
                ['对线组', w.laning],
                ['团战组', w.teamfight],
                ['深度组', w.depth],
              ] as const
            ).map(([label, weight]) => (
              <div key={label} className="rounded-lg bg-ink-800 py-3">
                <div className="text-slate-400">{label}</div>
                <div
                  className={clsx(
                    'mt-1 text-lg font-bold',
                    weight > 1.1 ? 'text-gold' : weight < 0.9 ? 'text-slate-500' : 'text-cyan',
                  )}
                >
                  ×{weight.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            该位置更依赖的属性组会略高；具体数值将在继承阶段进一步强化。
          </p>
        </section>
      )}

      {/* 性别（仅称谓） */}
      <section className="card mb-8">
        <div className="stat-label mb-3">性别（仅影响播报称谓）</div>
        <div className="flex gap-2">
          {(['male', 'female'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGender(g)}
              className={clsx(
                'flex-1 rounded-lg border py-2 text-sm transition',
                gender === g
                  ? 'border-cyan bg-cyan/15 text-cyan'
                  : 'border-ink-600 bg-ink-800 text-slate-300',
              )}
            >
              {g === 'male' ? '男' : '女'}
            </button>
          ))}
        </div>
      </section>

      <button
        className={clsx('w-full', canConfirm ? 'btn-primary' : 'btn-secondary')}
        disabled={!canConfirm}
        onClick={handleConfirm}
      >
        下一步：继承属性
      </button>
    </div>
  );
}
