'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Donut, Funnel, Ring, TrendChart } from '../../components/charts';
import { Shell } from '../../components/Shell';
import { api } from '../../lib/api';
import { formatCount, formatDate, formatIls, formatPercent, previousIsoDate } from '../../lib/format';
import type { Dashboard, DashboardRange, TargetPeriod } from '../../lib/types';

const RANGES: Array<{ id: DashboardRange; label: string }> = [
  { id: 'month', label: 'חודש נוכחי' },
  { id: 'quarter', label: 'רבעון' },
  { id: 'year', label: 'השנה' },
];

const ACTIVITY_LABELS = {
  SUBMITTED: 'נרשמה',
  ABSORBED: 'נקלטה',
  MATCHED: 'אומתה',
  DISCREPANCY: 'פער',
} as const;

const DEAL_STATUS = {
  SUBMITTED: 'נרשמה',
  ABSORBED: 'נקלטה',
  CHURNED: 'נטישה',
} as const;

const RECON_STATUS = {
  PENDING_INTAKE: 'ממתין לקליטה',
  PENDING_REVIEW: 'ממתין לאימות',
  MATCHED: 'תואם',
  DISCREPANCY: 'פער',
} as const;

export default function DashboardPage() {
  return <Shell>{() => <DashboardBody />}</Shell>;
}

function DashboardBody() {
  const router = useRouter();
  const [range, setRange] = useState<DashboardRange>('month');
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [makerId, setMakerId] = useState<string | null>(null);
  const [tableMode, setTableMode] = useState<'deals' | 'makers'>('deals');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'dealDate', dir: 'desc' });

  useEffect(() => {
    api<Dashboard>(`/api/dashboard?range=${range}`)
      .then((payload) => {
        setData(payload);
        setError(null);
      })
      .catch((caught: Error) => setError(caught.message));
  }, [range]);

  const deals = useMemo(() => {
    const rows = (data?.recentDeals ?? []).filter((deal) => (makerId ? deal.manufacturerId === makerId : true));
    const sorted = [...rows].sort((left, right) => compareDeal(left, right, sort.key));
    return sort.dir === 'asc' ? sorted : sorted.reverse();
  }, [data, makerId, sort]);

  const makers = useMemo(() => {
    const rows = [...(data?.manufacturers ?? [])];
    rows.sort((left, right) => {
      const value = sort.key === 'name' ? left.name.localeCompare(right.name, 'he') : left.amount - right.amount;
      return sort.dir === 'asc' ? value : -value;
    });
    return rows;
  }, [data, sort]);

  if (!data) {
    return <p>{error ?? 'טוען…'}</p>;
  }

  const hasGaps = data.discrepancies.length > 0;
  const endLabel = formatDate(previousIsoDate(data.periodEnd));

  function toggleSort(key: string) {
    setSort((current) => (current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  }

  return (
    <>
      <header className="page-head rise">
        <div>
          <p className="kicker">Shadow Ledger</p>
          <h1 className="page-title">{data.advisorName || 'יועץ'}</h1>
          <p className="summary">
            {formatCount(data.clientCount)} לקוחות · שווי תיק פעיל {formatIls(data.aum.total)}
          </p>
          <p className="period">
            {data.periodLabel} · {formatDate(data.periodStart)} – {endLabel}
          </p>
        </div>
        <div className="segmented" role="group" aria-label="טווח">
          {RANGES.map((item) => (
            <button key={item.id} type="button" className={range === item.id ? 'active' : undefined} onClick={() => setRange(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <section className="kpi-grid">
        <article className="panel kpi rise">
          <h2 className="kpi-label">שווי תיק פעיל</h2>
          <p className="kpi-value">{formatIls(data.aum.total)}</p>
          <p className="kpi-sub">בסיס {formatIls(data.aum.base)}</p>
          <p className="kpi-sub">שותפות {formatIls(data.aum.partnership)}</p>
        </article>
        <article className="panel kpi rise">
          <h2 className="kpi-label">עמלת היקף לכיס</h2>
          <p className="kpi-value green">{formatIls(data.rewards.scopeNet)}</p>
          <p className="kpi-sub">{data.periodLabel}</p>
        </article>
        <article className="panel kpi rise">
          <h2 className="kpi-label">תוספת נפרעים</h2>
          <p className="kpi-value green">{formatIls(data.rewards.ongoingMonthlyNet)}</p>
          <p className="kpi-sub">קצב שנתי {formatIls(data.rewards.annualPaceNet)}</p>
        </article>
        <article className="panel kpi rise">
          <h2 className="kpi-label">סה״כ תגמול שותף</h2>
          <p className="kpi-value accent">{formatIls(data.rewards.totalNet)}</p>
          <p className="kpi-sub">{data.periodLabel}</p>
        </article>
        <article className="panel kpi kpi-ring rise">
          <div className="stack">
            <h2 className="kpi-label">{data.goal.label}</h2>
            <p className="kpi-value compact">{formatIls(data.goal.actual)}</p>
            <p className="kpi-sub">יעד {formatIls(data.goal.target)}</p>
            {data.goal.hint ? <p className="kpi-sub">{data.goal.hint}</p> : null}
            {!data.goal.targetDefined ? <p className="kpi-sub">לא הוגדר יעד</p> : null}
          </div>
          <Ring percent={data.goal.targetDefined ? data.goal.completionPercent : 0} />
        </article>
      </section>

      <section className="center-grid">
        <article className="panel rise">
          <h2>מגמת גיוסים ועמלות</h2>
          <TrendChart points={data.trend} />
        </article>
        <article className={hasGaps ? 'panel rise activity-first' : 'panel rise'}>
          <h2>{hasGaps ? 'פערים לטיפול' : 'פעילות אחרונה'}</h2>
          {hasGaps ? (
            <ul className="activity">
              {data.discrepancies.map((item) => (
                <li key={item.id}>
                  <Link href={`/deals?deal=${item.id}`}>
                    <span>
                      <strong>{item.clientName}</strong>
                      <small>
                        {' '}
                        · {item.manufacturerName} · {item.productLabel}
                        {item.note ? ` — ${item.note}` : ''}
                      </small>
                    </span>
                    <small>{formatDate(item.dealDate)}</small>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <ActivityList items={data.activity} />
          )}
          {hasGaps ? (
            <>
              <h2 style={{ marginTop: '1rem' }}>פעילות אחרונה</h2>
              <ActivityList items={data.activity} />
            </>
          ) : null}
        </article>
      </section>

      <section className="analysis-grid">
        <article className="panel rise">
          <h2>פילוח יצרנים</h2>
          <Donut
            items={data.manufacturers}
            activeId={makerId}
            onSelect={(id) => {
              setMakerId(id);
              setTableMode('deals');
            }}
          />
        </article>
        <article className="panel rise">
          <h2>משפך עסקאות</h2>
          <p className="meta">{data.periodLabel}</p>
          <Funnel funnel={data.funnel} />
        </article>
        <article className="panel rise">
          <h2>יעדים ותגמול</h2>
          <GoalBar title="יעד חודשי" period={data.targets.month} />
          <GoalBar title="יעד שנתי" period={data.targets.year} />
          <div className="split">
            <div>
              <span>עסקאות שנקלטו החודש</span>
              <strong>{formatCount(data.targets.month.dealCount)}</strong>
            </div>
            <div>
              <span>ממוצע עמלת היקף ברוטו</span>
              <strong>{formatIls(data.targets.month.averageGrossScope)}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="panel rise" style={{ marginTop: '0.8rem' }}>
        <div className="table-tools">
          <h2>{tableMode === 'deals' ? 'עסקאות אחרונות' : 'פילוח יצרנים'}</h2>
          <div className="segmented" role="group" aria-label="תצוגת טבלה">
            <button type="button" className={tableMode === 'deals' ? 'active' : undefined} onClick={() => setTableMode('deals')}>
              עסקאות
            </button>
            <button type="button" className={tableMode === 'makers' ? 'active' : undefined} onClick={() => setTableMode('makers')}>
              יצרנים
            </button>
          </div>
        </div>
        {makerId ? (
          <button className="btn btn-ghost" type="button" onClick={() => setMakerId(null)}>
            ניקוי סינון יצרן
          </button>
        ) : null}
          <label className="sort-mobile">
          מיון
          <select value={sort.key} onChange={(event) => setSort({ key: event.target.value, dir: 'desc' })}>
            {tableMode === 'deals' ? (
              <>
                <option value="dealDate">תאריך</option>
                <option value="clientName">לקוח</option>
                <option value="amount">סכום</option>
                <option value="manufacturerName">יצרן</option>
              </>
            ) : (
              <>
                <option value="amount">שווי</option>
                <option value="name">שם</option>
              </>
            )}
          </select>
          <button className="btn btn-ghost" type="button" onClick={() => setSort((current) => ({ ...current, dir: current.dir === 'asc' ? 'desc' : 'asc' }))}>
            {sort.dir === 'asc' ? 'עולה' : 'יורד'}
          </button>
        </label>
        {tableMode === 'deals' ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th><button type="button" onClick={() => toggleSort('dealDate')}>תאריך</button></th>
                  <th><button type="button" onClick={() => toggleSort('clientName')}>לקוח</button></th>
                  <th><button type="button" onClick={() => toggleSort('manufacturerName')}>יצרן</button></th>
                  <th>מוצר</th>
                  <th><button type="button" onClick={() => toggleSort('amount')}>סכום</button></th>
                  <th>סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {deals.length === 0 ? (
                  <tr>
                    <td colSpan={6}>אין עסקאות להצגה</td>
                  </tr>
                ) : null}
                {deals.map((deal) => (
                  <tr key={deal.id} onClick={() => router.push(`/deals?deal=${deal.id}`)}>
                    <td data-label="תאריך">{formatDate(deal.dealDate)}</td>
                    <td data-label="לקוח">{deal.clientName}</td>
                    <td data-label="יצרן">{deal.manufacturerName}</td>
                    <td data-label="מוצר">{deal.productLabel}</td>
                    <td data-label="סכום">{formatIls(deal.amount)}</td>
                    <td data-label="סטטוס">
                      {DEAL_STATUS[deal.dealStatus]} · {RECON_STATUS[deal.reconciliationStatus]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th><button type="button" onClick={() => toggleSort('name')}>יצרן</button></th>
                  <th><button type="button" onClick={() => toggleSort('amount')}>שווי</button></th>
                  <th>אחוז</th>
                </tr>
              </thead>
              <tbody>
                {makers.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => {
                      setMakerId(item.id);
                      setTableMode('deals');
                    }}
                  >
                    <td data-label="יצרן">{item.name}</td>
                    <td data-label="שווי">{formatIls(item.amount)}</td>
                    <td data-label="אחוז">{formatPercent(item.percent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function ActivityList({ items }: { items: Dashboard['activity'] }) {
  if (items.length === 0) {
    return <p className="empty">אין פעילות עדיין</p>;
  }
  return (
    <ul className="activity">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={`/deals?deal=${item.dealId}`}>
            <span>
              <strong>{ACTIVITY_LABELS[item.kind]}</strong>
              <small>
                {' '}
                · {item.clientName} · {item.productLabel}
              </small>
            </span>
            <span>
              {formatDate(item.date)}
              <small> {formatIls(item.amount)}</small>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function GoalBar({ title, period }: { title: string; period: TargetPeriod }) {
  return (
    <div className="goal-block">
      <div className="goal-head">
        <span>{title}</span>
        <strong>{period.targetDefined ? formatPercent(period.completionPercent) : 'לא הוגדר יעד'}</strong>
      </div>
      <div className="meter" aria-hidden="true">
        <span style={{ width: `${period.barPercent}%` }} />
      </div>
      <p className="meta">
        בפועל {formatIls(period.actual)} מתוך {formatIls(period.target)} · {formatCount(period.dealCount)} עסקאות · ממוצע{' '}
        {formatIls(period.averageGrossScope)}
      </p>
    </div>
  );
}

function compareDeal(
  left: Dashboard['recentDeals'][number],
  right: Dashboard['recentDeals'][number],
  key: string,
): number {
  if (key === 'amount') {
    return left.amount - right.amount;
  }
  if (key === 'clientName') {
    return left.clientName.localeCompare(right.clientName, 'he');
  }
  if (key === 'manufacturerName') {
    return left.manufacturerName.localeCompare(right.manufacturerName, 'he');
  }
  return left.dealDate.localeCompare(right.dealDate);
}
