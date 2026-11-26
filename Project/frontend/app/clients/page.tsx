'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Drawer } from '../../components/Drawer';
import { Shell } from '../../components/Shell';
import { api, ApiError } from '../../lib/api';
import { formatDate } from '../../lib/format';
import type { Client } from '../../lib/types';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'פעיל',
  INACTIVE: 'לא פעיל',
};

export default function ClientsPage() {
  return <Shell>{() => <ClientsBody />}</Shell>;
}

function ClientsBody() {
  const [clients, setClients] = useState<Client[]>([]);
  const [fullName, setFullName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [isBasePortfolio, setIsBasePortfolio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);

  async function load() {
    const payload = await api<{ clients: Client[] }>('/api/clients');
    setClients(payload.clients);
  }

  useEffect(() => {
    load().catch((caught: Error) => setError(caught.message));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api('/api/clients', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          idNumber,
          isBasePortfolio,
          ...(birthDate ? { birthDate } : {}),
        }),
      });
      setFullName('');
      setIdNumber('');
      setBirthDate('');
      setIsBasePortfolio(false);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'שמירת הלקוח נכשלה');
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">Shadow Ledger</p>
          <h1 className="page-title">לקוחות</h1>
        </div>
      </header>
      <div className="split-page">
        <form className="card rise" onSubmit={onSubmit}>
          <h2>לקוח חדש</h2>
          <label htmlFor="fullName">שם</label>
          <input id="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          <label htmlFor="idNumber">תעודת זהות</label>
          <input id="idNumber" value={idNumber} onChange={(event) => setIdNumber(event.target.value)} required />
          <label htmlFor="birthDate">תאריך לידה</label>
          <input id="birthDate" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
          <label className="check">
            <input type="checkbox" checked={isBasePortfolio} onChange={(event) => setIsBasePortfolio(event.target.checked)} />
            תיק בסיס
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn btn-primary" type="submit">
            הוספת לקוח
          </button>
        </form>
        <div className="cards-2">
          {clients.length === 0 ? <p className="empty">עדיין אין לקוחות</p> : null}
          {clients.map((client) => (
            <article className="card rise" key={client.id}>
              <strong>{client.fullName}</strong>
              <p className="meta">
                ת״ז {client.idNumberMasked}
                {client.birthDate ? ` · ${formatDate(client.birthDate)}` : ''}
              </p>
              <div className="chips">
                <span className={client.isBasePortfolio ? 'chip' : 'chip ok'}>
                  {client.isBasePortfolio ? 'תיק בסיס' : 'גיוס שותפות'}
                </span>
                <span className={client.status === 'ACTIVE' ? 'chip ok' : 'chip'}>{STATUS_LABELS[client.status] ?? client.status}</span>
              </div>
              <button className="btn btn-ghost" type="button" onClick={() => setEditing(client)}>
                עריכה
              </button>
            </article>
          ))}
        </div>
      </div>
      {editing ? (
        <EditClient
          client={editing}
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

function EditClient({
  client,
  onClose,
  onSaved,
}: {
  client: Client;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [fullName, setFullName] = useState(client.fullName);
  const [birthDate, setBirthDate] = useState(client.birthDate ?? '');
  const [isBasePortfolio, setIsBasePortfolio] = useState(client.isBasePortfolio);
  const [status, setStatus] = useState(client.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE');
  const [idNumber, setIdNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api(`/api/clients/${client.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName,
          birthDate: birthDate || null,
          isBasePortfolio,
          status,
          ...(idNumber.trim() ? { idNumber: idNumber.trim() } : {}),
        }),
      });
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'עדכון הלקוח נכשל');
    }
  }

  return (
    <Drawer title="עריכת לקוח" onClose={onClose}>
      <form onSubmit={save}>
        <label htmlFor="edit-name">שם</label>
        <input id="edit-name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
        <label htmlFor="edit-birth">תאריך לידה</label>
        <input id="edit-birth" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
        <label htmlFor="edit-status">סטטוס</label>
        <select id="edit-status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="ACTIVE">פעיל</option>
          <option value="INACTIVE">לא פעיל</option>
        </select>
        <label className="check">
          <input type="checkbox" checked={isBasePortfolio} onChange={(event) => setIsBasePortfolio(event.target.checked)} />
          תיק בסיס
        </label>
        <label htmlFor="edit-id">תעודת זהות חדשה</label>
        <input
          id="edit-id"
          value={idNumber}
          placeholder="השאר ריק כדי לא לשנות"
          onChange={(event) => setIdNumber(event.target.value)}
        />
        <p className="muted">המספר השמור מוצג כ-{client.idNumberMasked}. הוא מוחלף רק אם מוזנת תעודה חדשה.</p>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-primary" type="submit">
          שמירה
        </button>
      </form>
    </Drawer>
  );
}
