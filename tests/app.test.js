const request = require('supertest');
const app = require('../src/app');

describe('Health Check', () => {
  test('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('CareCompanion API');
  });
});

describe('Residents API', () => {
  test('GET /api/residents returns all residents', async () => {
    const res = await request(app).get('/api/residents');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('GET /api/residents/:id returns a specific resident', async () => {
    const res = await request(app).get('/api/residents/1');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('1');
    expect(res.body.data.name).toBe('Margaret Thompson');
  });

  test('GET /api/residents/:id returns 404 for unknown resident', async () => {
    const res = await request(app).get('/api/residents/999');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('Wellbeing Summaries API', () => {
  test('GET /api/residents/:id/summary returns summary', async () => {
    const res = await request(app).get('/api/residents/1/summary');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('mood');
    expect(res.body.data).toHaveProperty('sleepHours');
    expect(res.body.data).toHaveProperty('summary');
  });

  test('GET /api/residents/:id/summary returns 404 for unknown resident', async () => {
    const res = await request(app).get('/api/residents/999/summary');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/residents/:id/summary creates new summary', async () => {
    const payload = {
      mood: 'happy',
      activityLevel: 'high',
      sleepHours: 8,
      summary: 'Test summary for resident.',
    };
    const res = await request(app).post('/api/residents/1/summary').send(payload);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.mood).toBe('happy');
    expect(res.body.data.sleepHours).toBe(8);
  });

  test('POST /api/residents/:id/summary rejects missing fields', async () => {
    const res = await request(app).post('/api/residents/1/summary').send({ mood: 'calm' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/residents/:id/summary rejects invalid mood', async () => {
    const res = await request(app).post('/api/residents/1/summary').send({
      mood: 'furious',
      activityLevel: 'low',
      sleepHours: 6,
      summary: 'Test.',
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/residents/:id/summary rejects invalid sleepHours', async () => {
    const res = await request(app).post('/api/residents/1/summary').send({
      mood: 'calm',
      activityLevel: 'low',
      sleepHours: 25,
      summary: 'Test.',
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('Metrics endpoint', () => {
  test('GET /metrics returns prometheus metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('http_requests_total');
  });
});
