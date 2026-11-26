'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../lib/api';
import { formatCount, formatIls } from '../../lib/format';
import type { Dashboard } from '../../lib/types';

export default function DashboardPage() {
  return <Shell>{() => <DashboardBody />}</Shell>;
}

function DashboardBody() {
  const [month, setMonth] = useState('');
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = month ? `?month=${month}` : '';
    api<Dashboard>(`/api/dashboard${query}`)
      .then((payload) => {
        setData(payload);
        setMonth((current) => current || payload.month);
        setError(null);
      })
      .catch((caught: Error) => setError(caught.message));
  }, [month]);

  if (!data) {
    return <p>{error ?? 'טוען…'}</p>;
  }

  return (
    <>
      <div className="row">
        <h2 className="stack-title">{data.monthLabel}</h2>
        <input aria-label="חודש" type="month" value={data.month} onChange={(event) => setMonth(event.target.value)} />
      </div>
      {data.discrepancies.length > 0 ? (
        <Link href="/deals" className="alert">
          <strong>{formatCount(data.discrepancies.length)} פערים לבדיקה</strong>
          <ul>
            {data.discrepancies.map((item) => (
              <li key={item.id}>
                {item.clientName} · {item.manufacturerName} · {item.productLabel}
                {item.note ? ` — ${item.note}` : ''}
              </li>
            ))}
          </ul>
        </Link>
      ) : null}
      <section className="card">
        <h2>שווי תיק פעיל</h2>
        <p className="money">{formatIls(data.aum.total)}</p>
        <div className="split">
          <div>
            <span>תיק בסיס</span>
            <strong>{formatIls(data.aum.base)}</strong>
          </div>
          <div>
            <span>גיוסי שותפות</span>
            <strong>{formatIls(data.aum.partnership)}</strong>
          </div>
        </div>
      </section>
      <section className="card">
        <h2>עמלת היקף לכיס החודש</h2>
        <p className="money green">{formatIls(data.monthRewards.scopeNet)}</p>
      </section>
      <section className="card">
        <h2>תוספת נפרעים</h2>
        <p className="money green">{formatIls(data.monthRewards.ongoingMonthlyNet)}</p>
        <p className="meta">
          קצב שנתי
          <strong>{formatIls(data.monthRewards.annualPaceNet)}</strong>
        </p>
      </section>
      <section className="card">
        <h2>סה״כ תגמול שותף</h2>
        <p className="money gold">{formatIls(data.monthRewards.totalNet)}</p>
      </section>
      <TargetCard title="יעד חודשי" period={data.targets.month} />
      <TargetCard title="יעד שנתי" period={data.targets.year} />
      <section className="card">
        <h2>פילוח יצרנים</h2>
        {data.manufacturers.length === 0 ? <p className="empty">אין עדיין נכסים שנקלטו</p> : null}
        {data.manufacturers.map((item) => (
          <div className="bar-line" key={item.id}>
            <span>{item.name}</span>
            <div className="track">
              <span style={{ width: `${item.percent}%` }} />
            </div>
            <strong>
              {item.percent}% · {formatIls(item.amount)}
            </strong>
          </div>
        ))}
      </section>
    </>
  );
}

function TargetCard({ title, period }: { title: string; period: Dashboard['targets']['month'] }) {
  return (
    <section className="card">
      <div className="row">
        <h2>{title}</h2>
        <strong>{period.targetDefined ? `${period.completionPercent}%` : 'לא הוגדר יעד'}</strong>
      </div>
      <div className="meter">
        <span style={{ width: `${period.barPercent}%` }} />
      </div>
      <div className="split">
        <div>
          <span>גיוס בפועל</span>
          <strong>{formatIls(period.actual)}</strong>
        </div>
        <div>
          <span>יעד</span>
          <strong>{formatIls(period.target)}</strong>
        </div>
        <div>
          <span>עסקאות שנקלטו</span>
          <strong>{formatCount(period.dealCount)}</strong>
        </div>
        <div>
          <span>ממוצע עמלת היקף ברוטו</span>
          <strong>{formatIls(period.averageGrossScope)}</strong>
        </div>
      </div>
    </section>
  );
}
