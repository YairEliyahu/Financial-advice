'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    api('/api/auth/me')
      .then(() => router.replace('/dashboard'))
      .catch(() => undefined);
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone, password }),
      });
      router.replace('/dashboard');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'ההתחברות נכשלה');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-frame">
      <section className="card login-card rise">
        <p className="kicker">Shadow Ledger</p>
        <h1>כניסה ליומן הצל</h1>
        <p className="muted">טלפון וסיסמה. ההתחברות נשמרת במכשיר.</p>
        <form onSubmit={onSubmit}>
          <label htmlFor="phone">מספר טלפון</label>
          <input
            id="phone"
            name="username"
            type="tel"
            inputMode="tel"
            autoComplete="username"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
          />
          <label htmlFor="password">סיסמה</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error ? <p className="error">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? 'מתחבר…' : 'כניסה'}
          </button>
        </form>
      </section>
    </main>
  );
}
