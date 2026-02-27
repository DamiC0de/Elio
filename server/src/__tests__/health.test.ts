import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Health Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 with status ok', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload) as Record<string, unknown>;
    expect(body.status).toBe('ok');
    expect(body.version).toBe('0.1.0');
    expect(typeof body.uptime).toBe('number');
  });

  it('GET /api/v1/ping returns pong', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/ping',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload) as Record<string, unknown>;
    expect(body.pong).toBe(true);
  });
});
