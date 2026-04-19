'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface WpmPoint {
  createdAt: string;
  wpm: number;
  mode: 'fixed' | 'time' | 'words';
}

interface Props {
  points: WpmPoint[];
  emptyMessage?: string;
}

interface ChartDatum {
  index: number;
  date: Date;
  wpm: number;
  mode: 'fixed' | 'time' | 'words';
}

export function WpmProgressionChart({ points, emptyMessage }: Props) {
  if (points.length < 5) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-sm text-[color:var(--muted)]">
        {emptyMessage ?? 'Take a few more tests to see your WPM progression.'}
      </div>
    );
  }

  const data: ChartDatum[] = points
    .slice()
    .reverse()
    .map((p, i) => ({ index: i + 1, date: new Date(p.createdAt), wpm: p.wpm, mode: p.mode }));

  return (
    <div className="h-48">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="wpmFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: Date) =>
              d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            }
            stroke="var(--muted)"
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
          />
          <YAxis stroke="var(--muted)" tick={{ fill: 'var(--muted)', fontSize: 12 }} width={36} />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="wpm"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#wpmFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs shadow-lg">
      <div className="font-mono text-[color:var(--fg)]">{Math.round(p.wpm)} wpm</div>
      <div className="text-[color:var(--muted)]">
        {p.mode} ·{' '}
        {p.date.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}
      </div>
    </div>
  );
}
