# CareCompanion API

A family-facing wellbeing portal that extends Gopher Industries' **Guardian Monitor** aged care AI system. Built for the SIT753 DevOps Pipeline assignment.

## Project Overview

CareCompanion provides families of aged care residents with accessible daily wellbeing summaries, smart notifications, and secure messaging — powered by Guardian Monitor's existing AI behavioural analysis backend.

**Tech stack:** Node.js, Express, Prometheus, Grafana, Docker

---

## Jenkins Pipeline — 7 Stages

| Stage | Tool | Purpose |
|-------|------|---------|
| Build | Docker | Build versioned image |
| Test | Jest + Supertest | Unit + integration tests with coverage |
| Code Quality | SonarCloud | Quality gate, code smells, coverage |
| Security | Trivy + npm audit | CVE scanning of image and dependencies |
| Deploy | Docker | Automated staging deployment + health check |
| Release | Docker + Git tag | Prod promotion + versioned Git tag |
| Monitoring | Prometheus + Grafana | Live metrics, dashboards, incident simulation |

---

## Quick Start (Local)

```bash
npm install
npm test
docker build -t carecompanion:local .
docker run -p 3000:3000 carecompanion:local
```

## Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | /health | Health check |
| GET | /metrics | Prometheus metrics |
| GET | /api/residents | List all residents |
| GET | /api/residents/:id | Get resident by ID |
| GET | /api/residents/:id/summary | Get today's wellbeing summary |
| POST | /api/residents/:id/summary | Create new wellbeing summary |

---

## Monitoring

After pipeline runs:
- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3030 (admin / carecompanion)

---

## Jenkins Setup

1. Start Jenkins: `docker start jenkins`
2. Go to `http://localhost:8080`
3. Create new Pipeline job → point to this GitHub repo
4. Add credential `sonar-token` (SonarCloud token) in Jenkins credentials
5. Run the pipeline
