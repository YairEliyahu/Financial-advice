'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { SessionUser } from '../lib/types';

const links = [
  { href: '/dashboard', label: 'דאשבורד' },
  { href: '/deals', label: 'עסקאות' },
  { href: '/clients', label: 'לקוחות' },
  { href: '/agreement', label: 'הסכם' },
];

export function Shell({ children }: { children: (session: SessionUser) => ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js');
    }
    api<SessionUser>('/api/auth/me')
      .then(setSession)
      .catch(() => router.replace('/'));
  }, [router]);

  function logout() {
    void api('/api/auth/logout', { method: 'POST' }).finally(() => router.replace('/'));
  }

  if (!session) {
    return <main className="workspace-inner">טוען…</main>;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="logo-dot" aria-hidden="true" />
          <div>
            <strong>Shadow Ledger</strong>
            <p>{session.phone}</p>
          </div>
        </div>
        <nav className="side-nav" aria-label="ניווט ראשי">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={pathname === link.href ? 'side-link active' : 'side-link'}>
              <NavIcon name={link.href} />
              {link.label}
            </Link>
          ))}
        </nav>
        <button className="btn btn-ghost logout" type="button" onClick={logout}>
          יציאה
        </button>
      </aside>
      <div className="workspace">
        <div className="workspace-inner">
          <header className="mobile-top">
            <strong>Shadow Ledger</strong>
            <button className="btn btn-ghost" type="button" onClick={logout}>
              יציאה
            </button>
          </header>
          {children(session)}
        </div>
      </div>
      <nav className="bottom-nav" aria-label="ניווט">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={pathname === link.href ? 'active' : undefined}>
            <NavIcon name={link.href} />
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function NavIcon({ name }: { name: string }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true as const };
  if (name === '/dashboard') {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="5" rx="2" />
        <rect x="13" y="10" width="8" height="11" rx="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
      </svg>
    );
  }
  if (name === '/deals') {
    return (
      <svg {...common}>
        <path d="M6 4h12v16H6z" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </svg>
    );
  }
  if (name === '/clients') {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3" />
        <path d="M5 19c1.5-3 3.8-4.5 7-4.5S17.5 16 19 19" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M7 3h8l4 4v14H7z" />
      <path d="M15 3v5h5" />
    </svg>
  );
}
