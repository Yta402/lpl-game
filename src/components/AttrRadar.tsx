import type { Attributes, AttrKey } from '../types';
import { ATTR_META } from '../constants';

interface AttrRadarProps {
  attributes: Attributes;
  size?: number;
  className?: string;
  /** 对照属性（半透明叠加，用于对比继承前后） */
  compare?: Attributes;
}

const ATTR_KEYS: AttrKey[] = ATTR_META.map((m) => m.key);

function polar(cx: number, cy: number, r: number, angleRad: number) {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

export function AttrRadar({ attributes, size = 240, className, compare }: AttrRadarProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 34;
  const n = ATTR_KEYS.length;
  // 起始角度从顶部 (-90°)
  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;

  const toPoints = (attrs: Attributes) =>
    ATTR_KEYS.map((k, i) => {
      const r = (Math.max(0, Math.min(99, attrs[k])) / 99) * radius;
      const { x, y } = polar(cx, cy, r, angleFor(i));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className}>
      {/* 背景网格 */}
      {rings.map((r, idx) => (
        <polygon
          key={idx}
          points={ATTR_KEYS.map((_, i) => {
            const { x, y } = polar(cx, cy, radius * r, angleFor(i));
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(' ')}
          fill="none"
          stroke="#334155"
          strokeWidth={1}
          strokeOpacity={0.5}
        />
      ))}
      {/* 轴线 */}
      {ATTR_KEYS.map((_, i) => {
        const { x, y } = polar(cx, cy, radius, angleFor(i));
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="#334155"
            strokeWidth={1}
            strokeOpacity={0.5}
          />
        );
      })}
      {/* 对照（继承前） */}
      {compare && (
        <polygon
          points={toPoints(compare)}
          fill="#64748b"
          fillOpacity={0.15}
          stroke="#94a3b8"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
      )}
      {/* 当前属性 */}
      <polygon
        points={toPoints(attributes)}
        fill="#22d3ee"
        fillOpacity={0.22}
        stroke="#22d3ee"
        strokeWidth={2}
      />
      {/* 顶点 */}
      {ATTR_KEYS.map((k, i) => {
        const r = (Math.max(0, Math.min(99, attributes[k])) / 99) * radius;
        const { x, y } = polar(cx, cy, r, angleFor(i));
        return <circle key={k} cx={x} cy={y} r={2.5} fill="#22d3ee" />;
      })}
      {/* 标签 */}
      {ATTR_META.map((m, i) => {
        const { x, y } = polar(cx, cy, radius + 16, angleFor(i));
        return (
          <text
            key={m.key}
            x={x}
            y={y}
            dy="0.35em"
            textAnchor="middle"
            fontSize="10"
            fill="#cbd5e1"
            fontWeight={600}
          >
            {m.label}
          </text>
        );
      })}
    </svg>
  );
}
