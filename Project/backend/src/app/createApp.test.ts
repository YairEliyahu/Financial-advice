import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './createApp.js';

const app = createApp();

describe('API', () => {
  it('GET /health returns ok', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('rejects a login body without a phone and password', async () => {
    const response = await request(app).post('/api/auth/login').send({});
    expect(response.status).toBe(400);
  });

  it('rejects the current user without a session cookie', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
  });

  it('rejects logout without a session cookie', async () => {
    const response = await request(app).post('/api/auth/logout');
    expect(response.status).toBe(401);
  });

  it('rejects tenant routes without a session cookie', async () => {
    const routes = [
      '/api/clients',
      '/api/deals',
      '/api/dashboard',
      '/api/agreements/current',
      '/api/manufacturers',
      '/api/commission/products',
    ];
    for (const route of routes) {
      const response = await request(app).get(route);
      expect(response.status).toBe(401);
    }
    const preview = await request(app).post('/api/commission/preview').send({});
    expect(preview.status).toBe(401);
    const clientUpdate = await request(app)
      .patch('/api/clients/00000000-0000-4000-8000-000000000001')
      .send({ fullName: 'לקוח לדוגמה', status: 'ACTIVE' });
    expect(clientUpdate.status).toBe(401);
    const dealUpdate = await request(app)
      .patch('/api/deals/00000000-0000-4000-8000-000000000002')
      .send({ reconciliationStatus: 'PENDING_REVIEW' });
    expect(dealUpdate.status).toBe(401);
    const ranged = await request(app).get('/api/dashboard?range=quarter');
    expect(ranged.status).toBe(401);
  });

  it('rejects client and deal updates without a session', async () => {
    const malformed = await request(app).patch('/api/clients/not-a-uuid').send({ fullName: 'לקוח' });
    expect(malformed.status).toBe(401);
    const emptyDeal = await request(app).patch('/api/deals/00000000-0000-4000-8000-000000000002').send({});
    expect(emptyDeal.status).toBe(401);
    expect(emptyDeal.body).toEqual({ error: 'נדרשת התחברות' });
  });
});
