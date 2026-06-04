# Task 3: CI/CD Integration + Deployment Pipelines

## Team Members
- **Avani**
- **Nikhil Patel**

## Files Responsible For

### Backend API Endpoints
- `backend/server.js` (lines 713-767):
  - `POST /api/cicd/token` — Generate CI/CD API token
  - `GET /api/cicd/runs` — Fetch pipeline run history
  - `POST /api/cicd/scan` — Trigger security scan from CI/CD pipeline

### Scan Processing Engine
- `backend/worker.js` — BullMQ worker for vulnerability scanning
  - Job processing with concurrency control
  - Scan result aggregation
  - Pipeline status updates based on scan results
  - Exit code generation for CI/CD gates

- `backend/queue.js` — BullMQ queue configuration
  - Redis connection setup
  - Queue initialization
  - Job retry configuration

### Database Schema
- `backend/db.js`:
  - `pipeline_runs` table — Track CI/CD pipeline executions
    - repo, branch, status, duration, commit info
    - Linked to scan results for gating

### Frontend Components
- `src/App.jsx`:
  - `CICDView()` (lines 1221-1318) — CI/CD dashboard
    - Token manager & copy functionality
    - Pipeline run history display
    - Manual pipeline trigger for testing
    - Scan progress visualization

### State Management
- `src/store.js` (Zustand actions):
  - `generateCicdToken()` — Create long-lived API token
  - `fetchPipelineRuns()` — Get pipeline execution history
  - `triggerPipelineScan()` — Manually trigger pipeline scan

### Infrastructure & Deployment
- `docker-compose.yml` — Docker orchestration with services:
  - API server container
  - Worker container
  - PostgreSQL database
  - Redis cache/queue
  - Health checks for all services

- `backend/Dockerfile` — Backend container image configuration
- `Dockerfile` — Frontend container image configuration
- `backend/package.json` — Backend npm dependencies
- `backend/templates/apiguard-scan.yml` — GitHub Actions workflow template

## Key Features to Implement

1. ✅ Long-lived CI/CD API token generation
2. ✅ Webhook receiver for pipeline events
3. ✅ Security scan execution during build process
4. ✅ Exit code management for build gating (exit 0 for pass, exit 1 for fail)
5. ✅ Pipeline run history tracking
6. ✅ Docker multi-container orchestration
7. ✅ Health checks & service monitoring
8. ✅ Worker concurrency tuning (configurable threads)
9. ✅ Job retry & backoff mechanisms

## API Endpoints Used
- `POST /api/cicd/token` — Generate token
- `POST /api/cicd/scan` — Trigger scan from CI
- `GET /api/cicd/runs` — Fetch pipeline history

## Database Tables
- `pipeline_runs` — Track build executions
- `scans` — Vulnerability scan results
- `alerts` — Pipeline failure notifications

## Configuration
- BullMQ Concurrency: 3 (configurable via Infrastructure panel)
- Max Retries: 3 (configurable)
- Backoff Delay: 5000ms (configurable)

---
**Last Updated**: June 4, 2026
**Status**: Ready for Development
