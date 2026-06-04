# Shared Infrastructure & Core Files

**All team members** are responsible for understanding and maintaining these foundation files.

## Core Backend Files

### API Server
- **`backend/server.js`** (950 lines)
  - Express.js application with all endpoints
  - Authentication middleware & JWT token management
  - Request validation & error handling
  - CORS configuration
  - Google OAuth2 integration

### Database Layer
- **`backend/db.js`**
  - PostgreSQL connection pooling
  - Schema migrations for all tables:
    - users, scans, specs, endpoints
    - postman_collections, github_connections
    - pipeline_runs, reports, alerts, system_tuning
  - Default data seeding

### Job Queue & Workers
- **`backend/worker.js`** (270 lines)
  - BullMQ worker for vulnerability scanning
  - Scan orchestration & result aggregation
  - Real-time progress updates via Redis pub/sub
  - Pipeline status integration
  - Error handling & retry logic

- **`backend/queue.js`**
  - BullMQ queue initialization
  - Redis connection setup
  - Queue configuration constants

## Core Frontend Files

### Application Entry Points
- **`src/main.jsx`**
  - React root rendering
  - Google OAuth provider setup
  - CSS injection

- **`src/App.jsx`** (1,744 lines)
  - Main application component
  - View routing & navigation
  - Global styles & animations
  - Helper components (Chip, ScoreArc, AnimNum, etc.)

### State Management
- **`src/store.js`** (Zustand Store)
  - Global application state
  - Auth actions (login, logout, signup)
  - Scan management (fetch, trigger, stream)
  - Integration actions (Postman, GitHub, CI/CD)
  - Demo mode fallback with mock store

### HTTP Client
- **`src/api.js`**
  - Axios configuration
  - Token refresh middleware
  - API base URL configuration
  - Request/response interceptors

### Testing & Mock Data
- **`src/mockData.js`**
  - Mock user data
  - Simulated scan results
  - Default Postman collections
  - GitHub repos data
  - Pipeline runs
  - Demo mode implementation

## Configuration & Build Files

### Frontend Build
- **`vite.config.js`**
  - Vite development server config
  - API proxy for local development
  - Build optimization

- **`package.json`** (Frontend)
  - React, React DOM, Zustand
  - Recharts for visualizations
  - Axios for HTTP requests
  - Tabler Icons

### Backend Dependencies
- **`backend/package.json`**
  - Express, CORS
  - bcryptjs for password hashing
  - jsonwebtoken for JWT
  - BullMQ for job queuing
  - Redis client (ioredis)
  - PostgreSQL (pg)
  - Google Auth Library
  - Multer for file uploads

### Styling
- **`src/index.css`**
  - CSS variables for theming
  - Component-specific styles
  - Animation definitions

## Docker & Deployment

### Orchestration
- **`docker-compose.yml`** (1,000+ lines)
  - Full-stack service configuration:
    - Frontend (Vite dev server)
    - Backend API (Express)
    - Worker (BullMQ consumer)
    - PostgreSQL database
    - Redis cache/queue
  - Health checks for all services
  - Environment variable configuration
  - Volume mounts for persistence

### Container Images
- **`Dockerfile`** (Frontend)
  - Node 20 base image
  - Vite development server

- **`backend/Dockerfile`** (Backend)
  - Node 20 base image
  - Express server setup

## Environment Configuration

### Required Environment Variables
```
REDIS_HOST=redis
REDIS_PORT=6379
DB_HOST=postgres
DB_PORT=5432
DB_NAME=apiguard
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=apiguard_super_secret_jwt_key_2026
JWT_REFRESH_SECRET=apiguard_super_secret_jwt_refresh_key_2026
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
PORT=5000
```

## Database Schema Overview

| Table | Purpose | Owner(s) |
|-------|---------|----------|
| `users` | User accounts & auth | All |
| `scans` | Vulnerability scan records | All |
| `specs` | OpenAPI specifications | Maitreyi, Avani |
| `endpoints` | Parsed API endpoints | Maitreyi, Avani |
| `postman_collections` | Postman integration | Maitreyi, Avani |
| `github_connections` | GitHub repos tracking | Nikhil, Riya, Kartikeya |
| `pipeline_runs` | CI/CD execution history | Avani, Nikhil |
| `reports` | Generated PDF reports | Nikhil, Riya |
| `alerts` | Security notifications | All |
| `system_tuning` | Queue configuration | Avani, Nikhil |

## Development Workflow

### Local Setup
```bash
# 1. Clone repository
git clone https://github.com/uppalriya371-blip/TeamBeta.git
cd TeamBeta

# 2. Start all services
docker compose up

# 3. Access application
# Frontend: http://localhost:5173
# API: http://localhost:5000

# 4. Default credentials
# Email: admin@apiguard.io
# Password: password123
```

### Running Individual Services
```bash
# Frontend only
npm run dev

# Backend only
cd backend && npm start

# Worker only
cd backend && npm run worker
```

## Performance Issues to Address

See `PERFORMANCE_ISSUES.md` for known bottlenecks:
1. Sequential API calls on scan completion
2. N+1 query problem in OpenAPI imports
3. EventSource memory leaks
4. Database connection pool exhaustion
5. Inefficient React re-renders
6. Large JSON in database

## Monitoring & Health Checks

- **Health Check Endpoint**: `GET /api/health` (recommended)
- **Infrastructure Dashboard**: UI at `/infra` (BullMQ, Docker, logs)
- **Logs**: Docker Compose output & terminal views
- **Metrics**: CPU, Memory, Uptime per container

---

**Last Updated**: June 4, 2026  
**All teams responsible** for these foundation files
