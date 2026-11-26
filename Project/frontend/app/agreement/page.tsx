'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Shell } from '../../components/Shell';
import { api, ApiError } from '../../lib/api';
import { formatIls } from '../../lib/format';
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
    try {
      await api('/api/agreements/targets', {
        method: 'PATCH',
        body: JSON.stringify({
          monthlyRecruitmentTarget: Number(monthly),
          annualRecruitmentTarget: Number(annual),
        }),
      });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'עדכון היעדים נכשל');
    }
  }

  async function addManufacturer(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api('/api/manufacturers', {
        method: 'POST',
        body: JSON.stringify({ nameHe, manufacturerType }),
      });
      setNameHe('');
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'הוספת היצרן נכשלה');
    }
  }

  async function openVersion(event: FormEvent) {
    event.preventDefault();
    setError(null);
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
      <h2 className="stack-title">גרסת הסכם</h2>
      <section className="card">
        <h2>גרסה פעילה</h2>
        <p className="meta">
          בתוקף מ-{agreement.version.validFrom}
          {agreement.version.validTo ? ` עד ${agreement.version.validTo}` : ''}
        </p>
        <div className="split">
          <div>
            <span>מע״מ</span>
            <strong>{agreement.version.vatRate}</strong>
          </div>
          <div>
            <span>הוצאות מטה</span>
            <strong>{agreement.version.hqOverheadRate}</strong>
          </div>
          <div>
            <span>חלק היועץ</span>
            <strong>{agreement.version.partnerSplitRate}</strong>
          </div>
          <div>
            <span>מכסת פגישות</span>
            <strong>{agreement.version.meetingQuota}</strong>
          </div>
        </div>
      </section>
      {agreement.rules.map((rule) => (
        <article className="card" key={rule.id}>
          <div className="row">
            <strong>{rule.productLabel}</strong>
            {rule.requiresManualAmount ? <span className="manual">הזנה ידנית</span> : null}
          </div>
          <p className="meta">
            {rule.manufacturerName ?? rule.manufacturerTypeLabel}
            <strong>{rule.summary}</strong>
          </p>
        </article>
      ))}
      <form className="card" onSubmit={saveTargets}>
        <h2>יעדי גיוס</h2>
        <label htmlFor="monthly">יעד חודשי</label>
        <input id="monthly" inputMode="decimal" value={monthly} onChange={(event) => setMonthly(event.target.value)} />
        <label htmlFor="annual">יעד שנתי</label>
        <input id="annual" inputMode="decimal" value={annual} onChange={(event) => setAnnual(event.target.value)} />
        <button className="primary" type="submit">
          שמירת יעדים
        </button>
      </form>
      <section className="card">
        <h2>יצרנים</h2>
        {manufacturers.map((manufacturer) => (
          <p className="row" key={manufacturer.id}>
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
          <button className="primary" type="submit">
            הוספה לרשימה
          </button>
        </form>
      </section>
      <form className="card" onSubmit={openVersion}>
        <h2>גרסה חדשה</h2>
        <p className="muted">שינוי התעריפים סוגר את הגרסה הנוכחית. עסקאות שנקלטו נשארות על הצילום שלהן.</p>
        <label htmlFor="validFrom">בתוקף מ-</label>
        <input id="validFrom" type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} required />
        <label htmlFor="vat">מע״מ</label>
        <input id="vat" inputMode="decimal" value={vatRate} onChange={(event) => setVatRate(event.target.value)} />
        <label htmlFor="hq">הוצאות מטה</label>
        <input id="hq" inputMode="decimal" value={hqRate} onChange={(event) => setHqRate(event.target.value)} />
        <label htmlFor="split">חלק היועץ</label>
        <input id="split" inputMode="decimal" value={splitRate} onChange={(event) => setSplitRate(event.target.value)} />
        <button className="primary" type="submit">
          פתיחת גרסה
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      <p className="muted">עלות פגישה שמורה בגרסה: {formatIls(agreement.version.meetingCost)}</p>
    </>
  );
}
