/**
 * HeroCountdown.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Memoized countdown component with its own 1-second interval state.
 *
 * Isolation guarantee: the interval calls setTimeLeft which re-renders only
 * this component and nothing above it. The hero section and the video wrapper
 * are NOT re-rendered on each tick.
 *
 * Dev render counter: in development builds a small badge in the top-right
 * corner of each tile shows how many times it has rendered. The counter
 * increments once per second (expected). The hero root should NOT show any
 * increment driven by this component.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { memo, useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface Props {
  /** ISO date string for the target date, e.g. edition.startDateGC ("2025-04-07") */
  targetDateGC: string;
  /** i18n labels passed in so this component has zero i18n dependency itself */
  labels: {
    startsIn: string;
    days: string;
    hours: string;
    minutes: string;
    seconds: string;
  };
}

function calcTimeLeft(target: number): TimeLeft {
  const dist = target - Date.now();
  if (dist <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days:    Math.floor(dist / 86_400_000),
    hours:   Math.floor((dist % 86_400_000) / 3_600_000),
    minutes: Math.floor((dist % 3_600_000)  / 60_000),
    seconds: Math.floor((dist % 60_000)      / 1_000),
  };
}

// ─── Individual tile — also memoized so only the changed unit re-renders ──────

interface TileProps {
  value: number;
  label: string;
}

const CountdownTile = memo(function CountdownTile({ value, label }: TileProps) {
  /* Dev-only render counter */
  const renderCount = useRef(0);
  if (import.meta.env.DEV) renderCount.current++;

  return (
    <div
      className="flex flex-col items-center rounded-xl border border-white/15 py-2 px-1"
      style={{ background: 'rgba(0,0,0,0.42)' }}
    >
      {import.meta.env.DEV && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 2,
            right: 4,
            fontSize: 8,
            color: '#D9A441',
            opacity: 0.7,
            fontVariantNumeric: 'tabular-nums',
            pointerEvents: 'none',
          }}
        >
          r{renderCount.current}
        </span>
      )}
      <span
        className="block font-editorial font-extrabold tabular-nums text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
        style={{ fontSize: 'clamp(1rem,5vw,1.75rem)' }}
      >
        {String(value).padStart(2, '0')}
      </span>
      <span
        className="block text-stone-300 font-semibold uppercase tracking-wider"
        style={{ fontSize: 'clamp(0.45rem,1.2vw,0.6rem)' }}
      >
        {label}
      </span>
    </div>
  );
});

// ─── Main countdown — memoized on targetDateGC + labels ──────────────────────

export const HeroCountdown = memo(function HeroCountdown({ targetDateGC, labels }: Props) {
  const target = React.useMemo(
    () => new Date(targetDateGC + 'T08:00:00Z').getTime(),
    [targetDateGC],
  );

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calcTimeLeft(target));

  /* Dev-only render counter for the whole countdown block */
  const renderCount = useRef(0);
  if (import.meta.env.DEV) renderCount.current++;

  useEffect(() => {
    setTimeLeft(calcTimeLeft(target)); // sync immediately if target changed
    const id = setInterval(() => setTimeLeft(calcTimeLeft(target)), 1_000);
    return () => clearInterval(id);
  }, [target]);

  const tiles = [
    { v: timeLeft.days,    l: labels.days    },
    { v: timeLeft.hours,   l: labels.hours   },
    { v: timeLeft.minutes, l: labels.minutes },
    { v: timeLeft.seconds, l: labels.seconds },
  ];

  return (
    <div
      className="flex flex-col items-center w-full fade-rise delay-500"
      style={{ gap: 'clamp(6px,1vh,12px)' }}
    >
      {import.meta.env.DEV && (
        <span
          aria-hidden="true"
          style={{ fontSize: 9, color: '#D9A441', opacity: 0.6 }}
        >
          HeroCountdown render #{renderCount.current}
        </span>
      )}
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#D9A441]">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        {labels.startsIn}
      </p>
      <div
        className="grid grid-cols-4 w-full max-w-[280px] xs:max-w-xs sm:max-w-sm"
        style={{ gap: 'clamp(4px,1.2vw,10px)' }}
      >
        {tiles.map(({ v, l }, i) => (
          /* key is stable — index never changes for a fixed 4-unit countdown */
          <div key={i} className="relative">
            <CountdownTile value={v} label={l} />
          </div>
        ))}
      </div>
    </div>
  );
});
