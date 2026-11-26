'use client';

import { useMemo, useState, type PointerEvent } from 'react';
import { formatDate, formatIls, formatPercent } from '../lib/format';
import type { Dashboard } from '../lib/types';

const PLOT = { width: 640, height: 248, padX: 16, padY: 22 };

const SLICE_COLORS = ['#6d5dfc', '#15a34a', '#0ea5e9', '#f59e0b', '#e11d48', '#14b8a6', '#8b5cf6', '#64748b'];

function smoothPath(points: Array<{ x: number; y: number }>): string {
  const first = points[0];
  if (!first) {
    return '';
  }
  if (points.length === 1) {
    return `M ${first.x} ${first.y}`;
  }
  const slopes: number[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    if (!current || !next || next.x === current.x) {
      slopes.push(0);
    } else {
      slopes.push((next.y - current.y) / (next.x - current.x));
    }
  }
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0] ?? 0;
    if (index === points.length - 1) return slopes[index - 1] ?? 0;
    const previous = slopes[index - 1] ?? 0;
    const next = slopes[index] ?? 0;
    if (previous * next <= 0) return 0;
    return (previous + next) / 2;
  });
  for (let index = 0; index < slopes.length; index += 1) {
    const slope = slopes[index] ?? 0;
    if (Math.abs(slope) < 1e-6) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }
    const alpha = (tangents[index] ?? 0) / slope;
    const beta = (tangents[index + 1] ?? 0) / slope;
    const magnitude = alpha * alpha + beta * beta;
    if (magnitude > 9) {
      const scale = 3 / Math.sqrt(magnitude);
      tangents[index] = scale * alpha * slope;
      tangents[index + 1] = scale * beta * slope;
    }
  }
  let path = `M ${first.x} ${first.y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    if (!current || !next) continue;
    const width = next.x - current.x;
    const c1x = current.x + width / 3;
    const c1y = current.y + ((tangents[index] ?? 0) * width) / 3;
    const c2x = next.x - width / 3;
    const c2y = next.y - ((tangents[index + 1] ?? 0) * width) / 3;
    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${next.x} ${next.y}`;
  }
  return path;
}

function place(values: number[], max: number) {
  return values.map((value, index) => {
    const x = PLOT.padX + (index * (PLOT.width - PLOT.padX * 2)) / Math.max(values.length - 1, 1);
    const y = PLOT.height - PLOT.padY - (value / max) * (PLOT.height - PLOT.padY * 2);
    return { x, y, value };
  });
}

export function TrendChart({ points }: { points: Dashboard['trend'] }) {
  const [active, setActive] = useState<number | null>(null);
  const recruitmentKey = points.some((point) => point.absorbed > 0) ? 'absorbed' : 'registered';
  const recruitmentLabel = recruitmentKey === 'absorbed' ? 'גיוס שנקלט' : 'גיוס שנרשם';
  const hasSignal = points.some((point) => point.registered > 0 || point.absorbed > 0 || point.scopeNet > 0);
  const recruitmentMax = Math.max(1, ...points.map((point) => point[recruitmentKey]));
  const commissionMax = Math.max(1, ...points.map((point) => point.scopeNet));
  const recruitment = useMemo(
    () => place(points.map((point) => point[recruitmentKey]), recruitmentMax),
    [points, recruitmentKey, recruitmentMax],
  );
  const commission = useMemo(
    () => place(points.map((point) => point.scopeNet), commissionMax),
    [points, commissionMax],
  );
  const current = active != null ? points[active] : undefined;
  const marker = active != null ? recruitment[active] : undefined;

  if (!hasSignal) {
    return <p className="empty">אין גיוסים או עמלות בטווח שנבחר</p>;
  }

  function move(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * PLOT.width;
    let nearest = 0;
    let best = Number.POSITIVE_INFINITY;
    recruitment.forEach((point, index) => {
      const distance = Math.abs(point.x - x);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    setActive(nearest);
  }

  const ticks = points.filter((_, index) => index % Math.ceil(points.length / 6) === 0 || index === points.length - 1);

  return (
    <div className="chart-plot" dir="ltr">
      <div className="legend">
        <span><i className="swatch indigo" /> {recruitmentLabel}</span>
        <span><i className="swatch green" /> עמלה לכיס</span>
      </div>
      <svg
        viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
        role="img"
        aria-label="מגמת גיוסים ועמלות"
        onPointerMove={move}
        onPointerLeave={() => setActive(null)}
      >
        <path d={smoothPath(recruitment)} className="line indigo" />
        <path d={smoothPath(commission)} className="line green" />
        {marker && current ? (
          <g>
            <line className="crosshair" x1={marker.x} x2={marker.x} y1={PLOT.padY} y2={PLOT.height - PLOT.padY} />
            <circle className="dot indigo" cx={marker.x} cy={marker.y} r="4.5" />
            {commission[active ?? 0] ? <circle className="dot green" cx={commission[active ?? 0]?.x} cy={commission[active ?? 0]?.y} r="4.5" /> : null}
          </g>
        ) : null}
      </svg>
      <div className="axis">
        {ticks.map((point) => (
          <span key={point.date}>{formatDate(point.date)}</span>
        ))}
      </div>
      {current && marker ? (
        <div className="tooltip" style={{ left: `${(marker.x / PLOT.width) * 100}%` }}>
          <strong>{formatDate(current.date)}</strong>
          <span>{recruitmentLabel}: {formatIls(current[recruitmentKey])}</span>
          <span>עמלה לכיס: {formatIls(current.scopeNet)}</span>
        </div>
      ) : null}
      <ul className="sr-only">
        {points.map((point) => (
          <li key={point.date}>
            {formatDate(point.date)} {recruitmentLabel} {formatIls(point[recruitmentKey])} עמלה {formatIls(point.scopeNet)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Ring({ percent }: { percent: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const shown = Math.max(0, Math.min(100, percent));
  return (
    <svg className="ring" viewBox="0 0 96 96" role="img" aria-label={`השלמת יעד ${formatPercent(shown)}`}>
      <circle className="ring-track" cx="48" cy="48" r={radius} />
      <circle
        className="ring-value"
        cx="48"
        cy="48"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - shown / 100)}
      />
      <text x="48" y="52" textAnchor="middle">
        {formatPercent(shown)}
      </text>
    </svg>
  );
}

function arcPath(cx: number, cy: number, radius: number, start: number, end: number): string {
  const large = end - start > Math.PI ? 1 : 0;
  const x1 = cx + radius * Math.cos(start);
  const y1 = cy + radius * Math.sin(start);
  const x2 = cx + radius * Math.cos(end);
  const y2 = cy + radius * Math.sin(end);
  return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
}

export function Donut({
  items,
  activeId,
  onSelect,
}: {
  items: Dashboard['manufacturers'];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (items.length === 0) {
    return <p className="empty">אין עדיין נכסים שנקלטו</p>;
  }
  let angle = -Math.PI / 2;
  const slices = items.map((item, index) => {
    const sweep = (Math.max(item.percent, 0) / 100) * Math.PI * 2;
    const start = angle;
    angle += sweep || 0.0001;
    return { ...item, start, end: angle, color: SLICE_COLORS[index % SLICE_COLORS.length] ?? '#6d5dfc' };
  });
  const active = slices.find((slice) => slice.id === activeId) ?? slices[0];

  return (
    <div className="donut-layout">
      <svg viewBox="0 0 180 180" role="img" aria-label="פילוח יצרנים">
        {slices.length === 1 && slices[0] ? (
          <circle
            cx="90"
            cy="90"
            r={slices[0].id === activeId ? 78 : 72}
            fill={slices[0].color}
            onClick={() => onSelect(activeId === slices[0]?.id ? null : slices[0]?.id ?? null)}
          />
        ) : slices.map((slice) => (
          <path
            key={slice.id}
            d={arcPath(90, 90, slice.id === activeId ? 78 : 72, slice.start, slice.end)}
            fill={slice.color}
            opacity={activeId && slice.id !== activeId ? 0.35 : 1}
            onClick={() => onSelect(activeId === slice.id ? null : slice.id)}
          >
            <title>
              {slice.name} {formatPercent(slice.percent)} {formatIls(slice.amount)}
            </title>
          </path>
        ))}
        <circle cx="90" cy="90" r="42" className="donut-hole" />
        {active ? (
          <text x="90" y="88" textAnchor="middle" className="donut-center">
            <tspan x="90" dy="0">{formatPercent(active.percent)}</tspan>
            <tspan x="90" dy="16">{active.name}</tspan>
          </text>
        ) : null}
      </svg>
      <ul className="legend-list">
        {slices.map((slice) => (
          <li key={slice.id}>
            <button
              type="button"
              className={slice.id === activeId ? 'legend-btn active' : 'legend-btn'}
              onClick={() => onSelect(activeId === slice.id ? null : slice.id)}
            >
              <i className="swatch" style={{ background: slice.color }} />
              <span>{slice.name}</span>
              <strong>
                {formatPercent(slice.percent)} · {formatIls(slice.amount)}
              </strong>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const FUNNEL_STEPS = [
  { key: 'submitted', label: 'נרשמו' },
  { key: 'absorbed', label: 'נקלטו' },
  { key: 'matched', label: 'אומתו' },
  { key: 'discrepancy', label: 'פערים' },
] as const;

export function Funnel({ funnel }: { funnel: Dashboard['funnel'] }) {
  const max = Math.max(1, funnel.submitted, funnel.absorbed, funnel.matched, funnel.discrepancy);
  return (
    <ol className="funnel">
      {FUNNEL_STEPS.map((step) => {
        const value = funnel[step.key];
        return (
          <li key={step.key}>
            <div className="funnel-label">
              <span>{step.label}</span>
              <strong>{value}</strong>
            </div>
            <div className="track">
              <span className={step.key === 'discrepancy' ? 'danger' : undefined} style={{ width: `${(value / max) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
