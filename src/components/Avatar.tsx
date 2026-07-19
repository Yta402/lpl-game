import clsx from 'clsx';

interface AvatarProps {
  name: string;
  color: string;
  size?: number;
  className?: string;
}

/**
 * 程序生成的几何头像：圆形渐变背景 + 首字母。
 * 不使用任何真人照片，规避版权。
 */
export function Avatar({ name, color, size = 48, className }: AvatarProps) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  // 防御：color 缺失时用灰色兜底，避免渲染抛错导致整个应用白屏（无 error boundary）
  const safeColor = color || '#64748b';
  const id = `av-${safeColor.replace('#', '')}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={clsx('rounded-full', className)}
    >
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor={safeColor} stopOpacity="0.95" />
          <stop offset="100%" stopColor={safeColor} stopOpacity="0.45" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="23" fill={`url(#${id})`} stroke="#0f1424" strokeWidth="1.5" />
      <text
        x="24"
        y="24"
        dy="0.35em"
        textAnchor="middle"
        fontSize="20"
        fontWeight="800"
        fill="#0a0e1a"
        fontFamily="system-ui, sans-serif"
      >
        {initial}
      </text>
    </svg>
  );
}
