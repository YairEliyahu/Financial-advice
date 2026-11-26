'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Shell } from '../../components/Shell';
import { api, ApiError } from '../../lib/api';
import { formatDate, formatIls, formatRate } from '../../lib/format';
import type { Agreement, Manufacturer } from '../../lib/types';

export default function AgreementPage() {
  return <Shell>{() => <AgreementBody />}</Shell>;
}

function AgreementBody() {
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [monthly, setMonthly] = useState('');
  const [annual, setAnnual] = useState('');
  const [nameHe, setNameHe] = useState('');
  const [manufacturerType, setManufacturerType] = useState<'INVESTMENT_HOUSE' | 'INSURANCE'>('INSURANCE');
  const [validFrom, setValidFrom] = useState('');
  const [vatRate, setVatRate] = useState('');
  const [hqRate, setHqRate] = useState('');
  const [splitRate, setSplitRate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function load() {
    const [current, makerPayload] = await Promise.all([
      api<Agreement>('/api/agreements/current'),
      api<{ manufacturers: Manufacturer[] }>('/api/manufacturers'),
    ]);
    setAgreement(current);
    setManufacturers(makerPayload.manufacturers);
    setMonthly(String(current.targets.monthlyRecruitmentTarget));
    setAnnual(String(current.targets.annualRecruitmentTarget));
    setVatRate(String(current.version.vatRate));
    setHqRate(String(current.version.hqOverheadRate));
    setSplitRate(String(current.version.partnerSplitRate));
  }

  useEffect(() => {
    load().catch((caught: Error) => setError(caught.message));
  }, []);

  async function saveTargets(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(null);
    try {
      await api('/api/agreements/targets', {
        method: 'PATCH',
        body: JSON.stringify({
          monthlyRecruitmentTarget: Number(monthly),
          annualRecruitmentTarget: Number(annual),
        }),
      });
      setSaved('יעדי הגיוס נשמרו');
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'עדכון היעדים נכשל');
    }
  }

  async function addManufacturer(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(null);
    try {
      await api('/api/manufacturers', {
        method: 'POST',
        body: JSON.stringify({ nameHe, manufacturerType }),
      });
      setNameHe('');
      setSaved('היצרן נוסף לרשימה');
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'הוספת היצרן נכשלה');
    }
  }

  async function openVersion(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(null);
    try {
      await api('/api/agreements/versions', {
        method: 'POST',
        body: JSON.stringify({
          validFrom,
          vatRate: Number(vatRate),
          hqOverheadRate: Number(hqRate),
          partnerSplitRate: Number(splitRate),
          meetingQuota: agreement?.version.meetingQuota ?? 10,
          meetingCost: agreement?.version.meetingCost ?? 0,
          vehicleCredit: agreement?.version.vehicleCredit ?? 0,
        }),
      });
      setValidFrom('');
      setSaved('נפתחה גרסת הסכם חדשה. עסקאות שנקלטו נשארו על הצילום הקודם.');
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'פתיחת הגרסה נכשלה');
    }
  }

  if (!agreement) {
    return <p>{error ?? 'טוען…'}</p>;
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">Shadow Ledger</p>
          <h1 className="page-title">גרסת הסכם</h1>
          <p className="summary">
            בתוקף מ-{formatDate(agreement.version.validFrom)}
            {agreement.version.validTo ? ` עד ${formatDate(agreement.version.validTo)}` : ''}
          </p>
        </div>
      </header>
      {saved ? <p className="chip ok">{saved}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <section className="analysis-grid">
        <article className="panel rise">
          <h2>גרסה פעילה</h2>
          <div className="split">
            <div>
              <span>מע״מ</span>
              <strong>{formatRate(agreement.version.vatRate)}</strong>
            </div>
            <div>
              <span>הוצאות מטה</span>
              <strong>{formatRate(agreement.version.hqOverheadRate)}</strong>
            </div>
            <div>
              <span>חלק היועץ</span>
              <strong>{formatRate(agreement.version.partnerSplitRate)}</strong>
            </div>
            <div>
              <span>מכסת פגישות</span>
              <strong>{agreement.version.meetingQuota}</strong>
            </div>
          </div>
          <p className="muted">עלות פגישה שמורה בגרסה: {formatIls(agreement.version.meetingCost)}</p>
        </article>
        <form className="panel rise" onSubmit={saveTargets}>
          <h2>יעדי גיוס</h2>
          <label htmlFor="monthly">יעד חודשי</label>
          <input id="monthly" inputMode="decimal" value={monthly} onChange={(event) => setMonthly(event.target.value)} />
          <label htmlFor="annual">יעד שנתי</label>
          <input id="annual" inputMode="decimal" value={annual} onChange={(event) => setAnnual(event.target.value)} />
          <button className="btn btn-primary" type="submit">
            שמירת יעדים
          </button>
        </form>
        <section className="panel rise">
          <h2>יצרנים</h2>
          {manufacturers.map((manufacturer) => (
            <p className="row" key={manufacturer.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
              <span>{manufacturer.nameHe}</span>
              <span className="muted">{manufacturer.manufacturerTypeLabel}</span>
            </p>
          ))}
          <form onSubmit={addManufacturer}>
            <label htmlFor="maker">יצרן חדש</label>
            <input id="maker" value={nameHe} onChange={(event) => setNameHe(event.target.value)} required />
            <label htmlFor="makerType">סוג</label>
            <select
              id="makerType"
              value={manufacturerType}
              onChange={(event) => setManufacturerType(event.target.value as 'INVESTMENT_HOUSE' | 'INSURANCE')}
            >
              <option value="INSURANCE">חברת ביטוח</option>
              <option value="INVESTMENT_HOUSE">בית השקעות</option>
            </select>
            <button className="btn btn-primary" type="submit">
              הוספה לרשימה
            </button>
          </form>
        </section>
      </section>
      <section className="cards-2" style={{ marginTop: '0.8rem' }}>
        {agreement.rules.map((rule) => (
          <article className="card rise" key={rule.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
              <strong>{rule.productLabel}</strong>
              {rule.requiresManualAmount ? <span className="manual">הזנה ידנית</span> : null}
            </div>
            <p className="meta">
              {rule.manufacturerName ?? rule.manufacturerTypeLabel}
              <strong>{rule.summary}</strong>
            </p>
          </article>
        ))}
      </section>
      <form className="card rise" onSubmit={openVersion} style={{ marginTop: '0.8rem' }}>
        <h2>גרסה חדשה</h2>
        <p className="muted">תאריך תחילת התוקף סוגר את הגרסה הנוכחית. עסקאות שכבר נקלטו נשארות על הצילום שלהן.</p>
        <div className="form-grid two">
          <div>
            <label htmlFor="validFrom">בתוקף מ-</label>
            <input id="validFrom" type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} required />
          </div>
          <div>
            <label htmlFor="vat">מע״מ</label>
            <input id="vat" inputMode="decimal" value={vatRate} onChange={(event) => setVatRate(event.target.value)} />
          </div>
          <div>
            <label htmlFor="hq">הוצאות מטה</label>
            <input id="hq" inputMode="decimal" value={hqRate} onChange={(event) => setHqRate(event.target.value)} />
          </div>
          <div>
            <label htmlFor="split">חלק היועץ</label>
            <input id="split" inputMode="decimal" value={splitRate} onChange={(event) => setSplitRate(event.target.value)} />
          </div>
        </div>
        <p className="muted">השדות נשמרים כשיעור עשרוני, למשל 0.18. בתצוגה הם מוצגים באחוזים.</p>
        <button className="btn btn-primary" type="submit">
          פתיחת גרסה
        </button>
      </form>
    </>
  );
}
