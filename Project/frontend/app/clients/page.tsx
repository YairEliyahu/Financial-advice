'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Shell } from '../../components/Shell';
import { api, ApiError } from '../../lib/api';
import type { Client } from '../../lib/types';

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
      <h2 className="stack-title">לקוחות</h2>
      <form className="card" onSubmit={onSubmit}>
        <h2>לקוח חדש</h2>
        <label htmlFor="fullName">שם</label>
        <input id="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
        <label htmlFor="idNumber">תעודת זהות</label>
        <input id="idNumber" value={idNumber} onChange={(event) => setIdNumber(event.target.value)} required />
        <label htmlFor="birthDate">תאריך לידה</label>
        <input id="birthDate" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
        <label className="check">
          <input
            type="checkbox"
            checked={isBasePortfolio}
            onChange={(event) => setIsBasePortfolio(event.target.checked)}
          />
          תיק בסיס
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="primary" type="submit">
          הוספת לקוח
        </button>
      </form>
      {clients.length === 0 ? <p className="empty">עדיין אין לקוחות</p> : null}
      {clients.map((client) => (
        <article className="card" key={client.id}>
          <strong>{client.fullName}</strong>
          <p className="meta">
            ת״ז {client.idNumberMasked}
            {client.birthDate ? ` · ${client.birthDate}` : ''}
          </p>
          <span className={client.isBasePortfolio ? 'chip' : 'chip ok'}>
            {client.isBasePortfolio ? 'תיק בסיס' : 'גיוס שותפות'}
          </span>
        </article>
      ))}
    </>
  );
}
