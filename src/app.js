const express = require('express');
const client = require('prom-client');

const app = express();
app.use(express.json());

// Prometheus metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route'],
  registers: [register],
});

// Middleware: track metrics
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer({ method: req.method, route: req.path });
  res.on('finish', () => {
    httpRequestCounter.inc({ method: req.method, route: req.path, status: res.statusCode });
    end();
  });
  next();
});

// In-memory store (no real DB needed for pipeline demo)
const residents = [
  { id: '1', name: 'Margaret Thompson', room: '12A', facility: 'Sunset Lodge' },
  { id: '2', name: 'Harold Jenkins', room: '7B', facility: 'Sunset Lodge' },
];

const summaries = [
  {
    residentId: '1',
    date: '2025-05-27',
    mood: 'calm',
    activityLevel: 'moderate',
    sleepHours: 7.5,
    summary: 'Margaret had a peaceful day. She joined the morning garden walk and enjoyed lunch with friends.',
    alerts: [],
  },
  {
    residentId: '2',
    date: '2025-05-27',
    mood: 'anxious',
    activityLevel: 'low',
    sleepHours: 5,
    summary: 'Harold rested for most of the day. Staff noted reduced appetite — care coordinator has been informed.',
    alerts: [{ severity: 'low', message: 'Reduced appetite observed' }],
  },
];

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'CareCompanion API', version: process.env.APP_VERSION || '1.0.0' });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/api/residents', (req, res) => {
  res.json({ success: true, data: residents });
});

app.get('/api/residents/:id', (req, res) => {
  const resident = residents.find(r => r.id === req.params.id);
  if (!resident) return res.status(404).json({ success: false, message: 'Resident not found' });
  res.json({ success: true, data: resident });
});

app.get('/api/residents/:id/summary', (req, res) => {
  const summary = summaries.find(s => s.residentId === req.params.id);
  if (!summary) return res.status(404).json({ success: false, message: 'Summary not found' });
  res.json({ success: true, data: summary });
});

app.post('/api/residents/:id/summary', (req, res) => {
  const { mood, activityLevel, sleepHours, summary: text } = req.body;
  if (!mood || !activityLevel || sleepHours === undefined || !text) {
    return res.status(400).json({ success: false, message: 'Missing required fields: mood, activityLevel, sleepHours, summary' });
  }
  const validMoods = ['calm', 'happy', 'anxious', 'sad', 'agitated'];
  if (!validMoods.includes(mood)) {
    return res.status(400).json({ success: false, message: `Invalid mood. Must be one of: ${validMoods.join(', ')}` });
  }
  if (sleepHours < 0 || sleepHours > 24) {
    return res.status(400).json({ success: false, message: 'sleepHours must be between 0 and 24' });
  }
  const newSummary = {
    residentId: req.params.id,
    date: new Date().toISOString().split('T')[0],
    mood,
    activityLevel,
    sleepHours,
    summary: text,
    alerts: [],
  };
  res.status(201).json({ success: true, data: newSummary });
});

module.exports = app;
