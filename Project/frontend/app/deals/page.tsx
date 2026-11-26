'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Drawer } from '../../components/Drawer';
import { Shell } from '../../components/Shell';
import { api, ApiError } from '../../lib/api';
import { formatDate, formatIls } from '../../lib/format';
import type { Client, Deal, Manufacturer, Preview, ProductOption } from '../../lib/types';

export default function DealsPage() {
  return (
    <Suspense fallback={<main className="workspace-inner">טוען…</main>}>
      <Shell>{(session) => <DealsBody today={session.today} />}</Shell>
    </Suspense>
  );
}

function DealsBody({ today }: { today: string }) {
  const focus = useSearchParams().get('deal');
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
  const [editing, setEditing] = useState<Deal | null>(null);

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
    if (!focus) {
      return;
    }
    document.getElementById(`deal-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focus, deals]);

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
      <header className="page-head">
        <div>
          <p className="kicker">Shadow Ledger</p>
          <h1 className="page-title">עסקאות והלימה</h1>
        </div>
      </header>
      <div className="split-page">
        <form className="card rise" onSubmit={createDeal}>
          <h2>עסקה חדשה</h2>
          <div className="form-grid">
            <div>
              <label htmlFor="dealDate">תאריך</label>
              <input id="dealDate" type="date" value={dealDate} onChange={(event) => setDealDate(event.target.value)} required />
            </div>
            <div>
              <label htmlFor="clientId">לקוח</label>
              <select id="clientId" value={clientId} onChange={(event) => setClientId(event.target.value)} required>
                <option value="">בחירה</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="manufacturerId">יצרן</label>
              <select id="manufacturerId" value={manufacturerId} onChange={(event) => setManufacturerId(event.target.value)} required>
                <option value="">בחירה</option>
                {manufacturers.map((manufacturer) => (
                  <option key={manufacturer.id} value={manufacturer.id}>
                    {manufacturer.nameHe}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="productType">מוצר</label>
              <select id="productType" value={productType} onChange={(event) => setProductType(event.target.value)} required>
                <option value="">בחירה</option>
                {products.map((product) => (
                  <option key={product.productType} value={product.productType}>
                    {product.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="expectedAmount">צפי סכום לתיק</label>
              <input
                id="expectedAmount"
                inputMode="decimal"
                value={expectedAmount}
                onChange={(event) => setExpectedAmount(event.target.value)}
                required
              />
            </div>
          </div>
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
          <button className="btn btn-primary" type="submit" disabled={!preview?.ready}>
            שמירת עסקה
          </button>
        </form>
        <div>
          {deals.length === 0 ? <p className="empty">עדיין אין עסקאות</p> : null}
          {deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              today={today}
              focused={focus === deal.id}
              onChange={load}
              onEdit={() => setEditing(deal)}
            />
          ))}
        </div>
      </div>
      {editing ? (
        <EditDeal
          deal={editing}
          clients={clients}
          manufacturers={manufacturers}
          products={products}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      ) : null}
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

function DealCard({
  deal,
  today,
  focused,
  onChange,
  onEdit,
}: {
  deal: Deal;
  today: string;
  focused: boolean;
  onChange: () => Promise<void>;
  onEdit: () => void;
}) {
  const [actualAmount, setActualAmount] = useState(deal.expectedAmount ? String(deal.expectedAmount) : '');
  const [calculationBaseAmount, setCalculationBaseAmount] = useState(
    deal.calculationBaseAmount != null ? String(deal.calculationBaseAmount) : '',
  );
  const [manualAmount, setManualAmount] = useState(deal.manualAmount != null ? String(deal.manualAmount) : '');
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

  const chipClass =
    deal.reconciliationStatus === 'DISCREPANCY' ? 'chip warn' : deal.reconciliationStatus === 'MATCHED' ? 'chip ok' : 'chip';

  return (
    <article id={`deal-${deal.id}`} className={focused ? 'card card-focus rise' : 'card rise'}>
      <div className="row" style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
        <strong>{deal.clientName}</strong>
        <span>{formatDate(deal.dealDate)}</span>
      </div>
      <p className="meta">
        {deal.manufacturerName} · {deal.productLabel}
        <strong>{deal.actualAmount != null ? formatIls(deal.actualAmount) : formatIls(deal.expectedAmount)}</strong>
      </p>
      <div className="chips">
        <span className="chip">{deal.dealStatusLabel}</span>
        <span className={chipClass}>{deal.reconciliationStatusLabel}</span>
      </div>
      <p className="meta">
        צפי היקף נטו {formatIls(deal.expectedNetScope)}
        {deal.recognizedNetScope != null ? ` · הוכר ${formatIls(deal.recognizedNetScope)}` : ''}
        {deal.absorbedOn ? ` · נקלט ${formatDate(deal.absorbedOn)}` : ''}
      </p>
      {deal.note ? <p>{deal.note}</p> : null}
      {deal.dealStatus === 'SUBMITTED' || deal.dealStatus === 'ABSORBED' ? (
        <button className="btn btn-ghost" type="button" onClick={onEdit}>
          עריכה
        </button>
      ) : null}
      {deal.dealStatus === 'SUBMITTED' ? (
        <>
          <label htmlFor={`actual-${deal.id}`}>סכום סופי שנקלט בתיק</label>
          <input id={`actual-${deal.id}`} inputMode="decimal" value={actualAmount} onChange={(event) => setActualAmount(event.target.value)} />
          {deal.showSeparateBase || preview?.showSeparateBase ? (
            <>
              <label htmlFor={`base-${deal.id}`}>{preview?.calculationBaseLabel ?? deal.calculationBaseLabel ?? 'בסיס חישוב'}</label>
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
          <button className="btn btn-primary" type="button" onClick={() => void absorb()} disabled={!preview?.ready}>
            אשר וקלוט בתיק · {formatIls(Number(actualAmount || 0))}
          </button>
        </>
      ) : null}
      {deal.reconciliationStatus === 'PENDING_REVIEW' || deal.reconciliationStatus === 'DISCREPANCY' ? (
        <>
          <label htmlFor={`note-${deal.id}`}>הערה</label>
          <textarea id={`note-${deal.id}`} value={note} onChange={(event) => setNote(event.target.value)} />
          <div className="actions">
            <button className="btn btn-ok" type="button" onClick={() => void reconcile('MATCHED')}>
              תואם
            </button>
            <button className="btn btn-danger" type="button" onClick={() => void reconcile('DISCREPANCY')}>
              פער
            </button>
          </div>
        </>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </article>
  );
}

function EditDeal({
  deal,
  clients,
  manufacturers,
  products,
  onClose,
  onSaved,
}: {
  deal: Deal;
  clients: Client[];
  manufacturers: Manufacturer[];
  products: ProductOption[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const submitted = deal.dealStatus === 'SUBMITTED';
  const [clientId, setClientId] = useState(deal.clientId);
  const [manufacturerId, setManufacturerId] = useState(deal.manufacturerId);
  const [productType, setProductType] = useState(deal.productType);
  const [dealDate, setDealDate] = useState(deal.dealDate);
  const [expectedAmount, setExpectedAmount] = useState(String(deal.expectedAmount));
  const [calculationBaseAmount, setCalculationBaseAmount] = useState(
    deal.calculationBaseAmount != null ? String(deal.calculationBaseAmount) : '',
  );
  const [manualAmount, setManualAmount] = useState(deal.manualAmount != null ? String(deal.manualAmount) : '');
  const [actualAmount, setActualAmount] = useState(deal.actualAmount != null ? String(deal.actualAmount) : '');
  const [status, setStatus] = useState(deal.reconciliationStatus);
  const [note, setNote] = useState(deal.note ?? '');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const quoteDate = submitted ? dealDate : (deal.absorbedOn ?? deal.dealDate);
  const quoteAmount = submitted ? expectedAmount : actualAmount;

  useEffect(() => {
    if (quoteAmount === '' || !manufacturerId || !productType) {
      setPreview(null);
      return;
    }
    if (!submitted && deal.reconciliationStatus === 'MATCHED') {
      setPreview(null);
      return;
    }
    const handle = window.setTimeout(() => {
      const body: Record<string, unknown> = {
        manufacturerId,
        productType,
        dealDate: quoteDate,
        expectedAmount: Number(quoteAmount),
      };
      if (calculationBaseAmount !== '') body.calculationBaseAmount = Number(calculationBaseAmount);
      if (manualAmount !== '') body.manualAmount = Number(manualAmount);
      api<Preview>('/api/commission/preview', { method: 'POST', body: JSON.stringify(body) })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [calculationBaseAmount, deal.reconciliationStatus, manualAmount, manufacturerId, productType, quoteAmount, quoteDate, submitted]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const body = submitted
        ? {
            clientId,
            manufacturerId,
            productType,
            dealDate,
            expectedAmount: Number(expectedAmount),
            calculationBaseAmount: calculationBaseAmount === '' ? null : Number(calculationBaseAmount),
            manualAmount: manualAmount === '' ? null : Number(manualAmount),
          }
        : {
            reconciliationStatus: status,
            note: note.trim() === '' ? null : note.trim(),
            ...(deal.reconciliationStatus !== 'MATCHED'
              ? {
                  actualAmount: Number(actualAmount),
                  calculationBaseAmount: calculationBaseAmount === '' ? null : Number(calculationBaseAmount),
                  manualAmount: manualAmount === '' ? null : Number(manualAmount),
                }
              : {}),
          };
      await api(`/api/deals/${deal.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'עדכון העסקה נכשל');
    }
  }

  return (
    <Drawer title={submitted ? 'עריכת עסקה שנרשמה' : 'עדכון עסקה שנקלטה'} onClose={onClose}>
      <form onSubmit={save}>
        {submitted ? (
          <>
            <label htmlFor="edit-client">לקוח</label>
            <select id="edit-client" value={clientId} onChange={(event) => setClientId(event.target.value)} required>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.fullName}
                </option>
              ))}
            </select>
            <label htmlFor="edit-maker">יצרן</label>
            <select id="edit-maker" value={manufacturerId} onChange={(event) => setManufacturerId(event.target.value)} required>
              {manufacturers.map((manufacturer) => (
                <option key={manufacturer.id} value={manufacturer.id}>
                  {manufacturer.nameHe}
                </option>
              ))}
            </select>
            <label htmlFor="edit-product">מוצר</label>
            <select id="edit-product" value={productType} onChange={(event) => setProductType(event.target.value)} required>
              {products.map((product) => (
                <option key={product.productType} value={product.productType}>
                  {product.label}
                </option>
              ))}
            </select>
            <label htmlFor="edit-date">תאריך</label>
            <input id="edit-date" type="date" value={dealDate} onChange={(event) => setDealDate(event.target.value)} required />
            <label htmlFor="edit-expected">צפי סכום</label>
            <input id="edit-expected" inputMode="decimal" value={expectedAmount} onChange={(event) => setExpectedAmount(event.target.value)} required />
          </>
        ) : (
          <>
            <p className="muted">
              {deal.clientName} · {deal.manufacturerName} · {deal.productLabel} · נקלט {formatDate(deal.absorbedOn)}
            </p>
            <label htmlFor="edit-status">סטטוס הלימה</label>
            <select id="edit-status" value={status} onChange={(event) => setStatus(event.target.value as Deal['reconciliationStatus'])}>
              <option value="PENDING_REVIEW">ממתין לאימות</option>
              <option value="MATCHED">תואם</option>
              <option value="DISCREPANCY">פער</option>
            </select>
            <label htmlFor="edit-note">הערת הלימה</label>
            <textarea id="edit-note" value={note} onChange={(event) => setNote(event.target.value)} />
            {deal.reconciliationStatus !== 'MATCHED' ? (
              <>
                <label htmlFor="edit-actual">תיקון סכום קליטה</label>
                <input id="edit-actual" inputMode="decimal" value={actualAmount} onChange={(event) => setActualAmount(event.target.value)} required />
              </>
            ) : null}
          </>
        )}
        {(submitted || deal.reconciliationStatus !== 'MATCHED') && (preview?.showSeparateBase || deal.showSeparateBase) ? (
          <>
            <label htmlFor="edit-base">{preview?.calculationBaseLabel ?? deal.calculationBaseLabel ?? 'בסיס חישוב'}</label>
            <input
              id="edit-base"
              inputMode="decimal"
              value={calculationBaseAmount}
              onChange={(event) => setCalculationBaseAmount(event.target.value)}
            />
          </>
        ) : null}
        {(submitted || deal.reconciliationStatus !== 'MATCHED') && (preview?.showManualAmount || deal.requiresManualAmount) ? (
          <>
            <label htmlFor="edit-manual">סכום עמלה ידני</label>
            <input id="edit-manual" inputMode="decimal" value={manualAmount} onChange={(event) => setManualAmount(event.target.value)} />
          </>
        ) : null}
        {preview ? <PreviewCard preview={preview} /> : null}
        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={Boolean(preview && !preview.ready)}>
          שמירת עדכון
        </button>
      </form>
    </Drawer>
  );
}
