'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Shell } from '../../components/Shell';
import { api, ApiError } from '../../lib/api';
import { formatIls } from '../../lib/format';
import type { Client, Deal, Manufacturer, Preview, ProductOption } from '../../lib/types';

export default function DealsPage() {
  return <Shell>{(session) => <DealsBody today={session.today} />}</Shell>;
}

function DealsBody({ today }: { today: string }) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [clientId, setClientId] = useState('');
  const [manufacturerId, setManufacturerId] = useState('');
  const [productType, setProductType] = useState('');
  const [dealDate, setDealDate] = useState(today);
  const [expectedAmount, setExpectedAmount] = useState('');
  const [calculationBaseAmount, setCalculationBaseAmount] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [dealPayload, clientPayload, manufacturerPayload, productPayload] = await Promise.all([
      api<{ deals: Deal[] }>('/api/deals'),
      api<{ clients: Client[] }>('/api/clients'),
      api<{ manufacturers: Manufacturer[] }>('/api/manufacturers'),
      api<{ products: ProductOption[] }>('/api/commission/products'),
    ]);
    setDeals(dealPayload.deals);
    setClients(clientPayload.clients);
    setManufacturers(manufacturerPayload.manufacturers);
    setProducts(productPayload.products);
  }

  useEffect(() => {
    load().catch((caught: Error) => setError(caught.message));
  }, []);

  useEffect(() => {
    if (!manufacturerId || !productType || expectedAmount === '') {
      setPreview(null);
      return;
    }
    const handle = window.setTimeout(() => {
      const body: Record<string, unknown> = {
        manufacturerId,
        productType,
        dealDate,
        expectedAmount: Number(expectedAmount),
      };
      if (calculationBaseAmount !== '') body.calculationBaseAmount = Number(calculationBaseAmount);
      if (manualAmount !== '') body.manualAmount = Number(manualAmount);
      api<Preview>('/api/commission/preview', { method: 'POST', body: JSON.stringify(body) })
        .then(setPreview)
        .catch((caught: Error) => {
          setPreview(null);
          setError(caught.message);
        });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [manufacturerId, productType, dealDate, expectedAmount, calculationBaseAmount, manualAmount]);

  async function createDeal(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api('/api/deals', {
        method: 'POST',
        body: JSON.stringify({
          clientId,
          manufacturerId,
          productType,
          dealDate,
          expectedAmount: Number(expectedAmount),
          ...(calculationBaseAmount !== '' ? { calculationBaseAmount: Number(calculationBaseAmount) } : {}),
          ...(manualAmount !== '' ? { manualAmount: Number(manualAmount) } : {}),
        }),
      });
      setExpectedAmount('');
      setCalculationBaseAmount('');
      setManualAmount('');
      setPreview(null);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'שמירת העסקה נכשלה');
    }
  }

  return (
    <>
      <h2 className="stack-title">עסקאות והלימה</h2>
      <form className="card" onSubmit={createDeal}>
        <h2>עסקה חדשה</h2>
        <label htmlFor="dealDate">תאריך</label>
        <input id="dealDate" type="date" value={dealDate} onChange={(event) => setDealDate(event.target.value)} required />
        <label htmlFor="clientId">לקוח</label>
        <select id="clientId" value={clientId} onChange={(event) => setClientId(event.target.value)} required>
          <option value="">בחירה</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.fullName}
            </option>
          ))}
        </select>
        <label htmlFor="manufacturerId">יצרן</label>
        <select id="manufacturerId" value={manufacturerId} onChange={(event) => setManufacturerId(event.target.value)} required>
          <option value="">בחירה</option>
          {manufacturers.map((manufacturer) => (
            <option key={manufacturer.id} value={manufacturer.id}>
              {manufacturer.nameHe}
            </option>
          ))}
        </select>
        <label htmlFor="productType">מוצר</label>
        <select id="productType" value={productType} onChange={(event) => setProductType(event.target.value)} required>
          <option value="">בחירה</option>
          {products.map((product) => (
            <option key={product.productType} value={product.productType}>
              {product.label}
            </option>
          ))}
        </select>
        <label htmlFor="expectedAmount">צפי סכום לתיק</label>
        <input
          id="expectedAmount"
          inputMode="decimal"
          value={expectedAmount}
          onChange={(event) => setExpectedAmount(event.target.value)}
          required
        />
        {preview?.showSeparateBase ? (
          <>
            <label htmlFor="baseAmount">{preview.calculationBaseLabel ?? 'בסיס חישוב'}</label>
            <input
              id="baseAmount"
              inputMode="decimal"
              value={calculationBaseAmount}
              onChange={(event) => setCalculationBaseAmount(event.target.value)}
            />
          </>
        ) : null}
        {preview?.showManualAmount ? (
          <>
            <label htmlFor="manualAmount">סכום עמלה ידני</label>
            <input
              id="manualAmount"
              inputMode="decimal"
              value={manualAmount}
              onChange={(event) => setManualAmount(event.target.value)}
            />
          </>
        ) : null}
        {preview ? <PreviewCard preview={preview} /> : null}
        {error ? <p className="error">{error}</p> : null}
        <button className="primary" type="submit" disabled={!preview?.ready}>
          שמירת עסקה
        </button>
      </form>
      {deals.length === 0 ? <p className="empty">עדיין אין עסקאות</p> : null}
      {deals.map((deal) => (
        <DealCard key={deal.id} deal={deal} today={today} onChange={load} />
      ))}
    </>
  );
}

function PreviewCard({ preview }: { preview: Preview }) {
  if (!preview.ready) {
    return <p className="preview">{preview.message}</p>;
  }
  return (
    <div className="preview">
      <p>
        <span>עמלת היקף ברוטו</span>
        <strong>{formatIls(preview.grossScope)}</strong>
      </p>
      <p>
        <span>נטו לכיס</span>
        <strong>{formatIls(preview.netScope)}</strong>
      </p>
      <p>
        <span>נפרעים חודשיים ברוטו</span>
        <strong>{formatIls(preview.grossMonthlyOngoing)}</strong>
      </p>
      <p>
        <span>נפרעים נטו</span>
        <strong>{formatIls(preview.netMonthlyOngoing)}</strong>
      </p>
      <p>
        <span>קצב שנתי</span>
        <strong>{formatIls(preview.annualPaceNet)}</strong>
      </p>
      {preview.entersAum ? null : <p>הסכום לא נכנס לשווי התיק</p>}
    </div>
  );
}

function DealCard({ deal, today, onChange }: { deal: Deal; today: string; onChange: () => Promise<void> }) {
  const [actualAmount, setActualAmount] = useState(deal.expectedAmount ? String(deal.expectedAmount) : '');
  const [calculationBaseAmount, setCalculationBaseAmount] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [note, setNote] = useState(deal.note ?? '');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (deal.dealStatus !== 'SUBMITTED' || actualAmount === '') {
      return;
    }
    const handle = window.setTimeout(() => {
      const body: Record<string, unknown> = {
        manufacturerId: deal.manufacturerId,
        productType: deal.productType,
        dealDate: today,
        expectedAmount: Number(actualAmount),
      };
      if (calculationBaseAmount !== '') body.calculationBaseAmount = Number(calculationBaseAmount);
      if (manualAmount !== '') body.manualAmount = Number(manualAmount);
      api<Preview>('/api/commission/preview', { method: 'POST', body: JSON.stringify(body) })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [actualAmount, calculationBaseAmount, deal, manualAmount, today]);

  async function absorb() {
    setError(null);
    try {
      await api(`/api/deals/${deal.id}/absorb`, {
        method: 'POST',
        body: JSON.stringify({
          actualAmount: Number(actualAmount),
          ...(calculationBaseAmount !== '' ? { calculationBaseAmount: Number(calculationBaseAmount) } : {}),
          ...(manualAmount !== '' ? { manualAmount: Number(manualAmount) } : {}),
        }),
      });
      await onChange();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'הקליטה נכשלה');
    }
  }

  async function reconcile(status: 'MATCHED' | 'DISCREPANCY') {
    setError(null);
    try {
      await api(`/api/deals/${deal.id}/reconciliation`, {
        method: 'POST',
        body: JSON.stringify({ status, ...(note ? { note } : {}) }),
      });
      await onChange();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'עדכון ההלימה נכשל');
    }
  }

  return (
    <article className="card">
      <div className="row">
        <strong>{deal.clientName}</strong>
        <span>{deal.dealDate}</span>
      </div>
      <p className="meta">
        {deal.manufacturerName} · {deal.productLabel}
        <strong>{deal.actualAmount != null ? formatIls(deal.actualAmount) : formatIls(deal.expectedAmount)}</strong>
      </p>
      <div className="chips">
        <span className="chip">{deal.dealStatusLabel}</span>
        <span className={deal.reconciliationStatus === 'DISCREPANCY' ? 'chip warn' : deal.reconciliationStatus === 'MATCHED' ? 'chip ok' : 'chip'}>
          {deal.reconciliationStatusLabel}
        </span>
      </div>
      <p className="meta">
        צפי היקף נטו {formatIls(deal.expectedNetScope)}
        {deal.recognizedNetScope != null ? ` · הוכר ${formatIls(deal.recognizedNetScope)}` : ''}
      </p>
      {deal.note ? <p>{deal.note}</p> : null}
      {deal.dealStatus === 'SUBMITTED' ? (
        <>
          <label htmlFor={`actual-${deal.id}`}>סכום סופי שנקלט בתיק</label>
          <input id={`actual-${deal.id}`} inputMode="decimal" value={actualAmount} onChange={(event) => setActualAmount(event.target.value)} />
          {deal.showSeparateBase || preview?.showSeparateBase ? (
            <>
              <label htmlFor={`base-${deal.id}`}>{preview?.calculationBaseLabel ?? 'בסיס חישוב'}</label>
              <input
                id={`base-${deal.id}`}
                inputMode="decimal"
                value={calculationBaseAmount}
                onChange={(event) => setCalculationBaseAmount(event.target.value)}
              />
            </>
          ) : null}
          {deal.requiresManualAmount || preview?.showManualAmount ? (
            <>
              <label htmlFor={`manual-${deal.id}`}>סכום עמלה ידני</label>
              <input
                id={`manual-${deal.id}`}
                inputMode="decimal"
                value={manualAmount}
                onChange={(event) => setManualAmount(event.target.value)}
              />
            </>
          ) : null}
          {preview ? <PreviewCard preview={preview} /> : null}
          <button className="primary" type="button" onClick={() => void absorb()} disabled={!preview?.ready}>
            אשר וקלוט בתיק · {formatIls(Number(actualAmount || 0))}
          </button>
        </>
      ) : null}
      {deal.reconciliationStatus === 'PENDING_REVIEW' || deal.reconciliationStatus === 'DISCREPANCY' ? (
        <>
          <label htmlFor={`note-${deal.id}`}>הערה</label>
          <textarea id={`note-${deal.id}`} value={note} onChange={(event) => setNote(event.target.value)} />
          <div className="actions">
            <button className="secondary" type="button" onClick={() => void reconcile('MATCHED')}>
              תואם
            </button>
            <button className="danger-btn" type="button" onClick={() => void reconcile('DISCREPANCY')}>
              פער
            </button>
          </div>
        </>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </article>
  );
}
