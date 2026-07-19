import clsx from 'clsx';
import type { Player } from '../types';
import { Avatar } from './Avatar';
import { AttrBar } from './AttrBar';
import { AttrRadar } from './AttrRadar';
import { POSITION_LABEL } from '../constants';
import { posLabel } from '../utils/format';
import type { AttrKey } from '../types';
import { ATTR_META, attrGroup } from '../constants';

const GROUP_DOT: Record<string, string> = {
  laning: 'bg-laning',
  teamfight: 'bg-teamfight',
  depth: 'bg-depth',
};

interface PlayerCardProps {
  player: Player;
  showRadar?: boolean;
  showBars?: boolean;
  highlightAttr?: AttrKey | null;
  compareAttrs?: Player['attributes'];
  onSelectAttr?: (attr: AttrKey) => void;
  selectedAttr?: AttrKey | null;
  className?: string;
  footer?: React.ReactNode;
}

export function PlayerCard({
  player,
  showRadar,
  showBars,
  highlightAttr,
  compareAttrs,
  onSelectAttr,
  selectedAttr,
  className,
  footer,
}: PlayerCardProps) {
  const selectable = !!onSelectAttr;
  return (
    <div
      className={clsx(
        'card flex flex-col gap-3',
        player.isCustom && 'ring-1 ring-gold/50',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar name={player.name} color={player.avatarColor} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-bold text-slate-100">{player.name}</span>
            {player.isCustom && <span className="chip bg-gold/20 text-gold">自建</span>}
          </div>
          <span className="text-xs text-slate-400">
            {POSITION_LABEL[player.position]} · {posLabel(player.position)}
          </span>
        </div>
      </div>

      {showRadar && (
        <div className="flex justify-center">
          <AttrRadar attributes={player.attributes} compare={compareAttrs} size={220} />
        </div>
      )}

      {showBars && (
        <div className="flex flex-col gap-1.5">
          {ATTR_META.map((m) => {
            const isSel = selectedAttr === m.key;
            return (
              <div
                key={m.key}
                onClick={() => selectable && onSelectAttr?.(m.key)}
                className={clsx(
                  'rounded',
                  selectable && 'cursor-pointer px-1 -mx-1',
                  isSel && 'bg-gold/10',
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', GROUP_DOT[attrGroup(m.key)])}
                  />
                  <div className="flex-1">
                    <AttrBar
                      attrKey={m.key}
                      value={player.attributes[m.key]}
                      highlight={highlightAttr === m.key || isSel}
                      showLabel
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {footer}
    </div>
  );
}
