export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (response.status === 401 && !path.startsWith('/api/auth/login') && typeof window !== 'undefined') {
    if (window.location.pathname !== '/') {
      window.location.href = '/';
    }
  }
  if (!response.ok) {
    throw new ApiError(response.status, body.error ?? 'הבקשה נכשלה');
  }
  return body as T;
}
