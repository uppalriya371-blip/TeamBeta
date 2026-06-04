# Team Responsibility Matrix

## Overview

This document maps team members to their assigned tasks and files.

---

## 👤 Individual Assignments

### **Maitreyi Ingle**
**Role**: Frontend Lead & Integrations

| Task | Files | Responsibility |
|------|-------|-----------------|
| Dashboard UI + Free Scan | `src/App.jsx`, `src/store.js`, `src/mockData.js` | Primary implementation |
| Postman Integration | `PostmanView()`, API endpoints (562-641) | Postman UI & API integration |
| OpenAPI Importer | `OpenAPIView()`, API endpoints (374-519) | Spec upload & parsing |

**Key Files**:
- `src/App.jsx` (DashboardView, ScanView, PostmanView, OpenAPIView)
- `src/store.js` (store actions)
- `backend/server.js` (Postman endpoints 562-641, OpenAPI 374-519)

---

### **Riya Uppal**
**Role**: Full-Stack Developer (UI & Backend)

| Task | Files | Responsibility |
|------|-------|-----------------|
| Dashboard UI + Free Scan | `src/App.jsx`, `src/store.js` | UI refinement & alerts |
| PDF Reporting | `ReportsView()`, API (773-840), `reports` table | Report generation & UI |
| GitHub Integration | `GitHubView()`, API (647-707), `github_connections` table | GitHub UI & endpoints |

**Key Files**:
- `src/App.jsx` (ReportsView, GitHubView, AlertsView)
- `backend/server.js` (Reports 773-840, GitHub 647-707)
- `backend/db.js` (reports, github_connections tables)

---

### **Kartikeya Shukla**
**Role**: Frontend & Integration Specialist

| Task | Files | Responsibility |
|------|-------|-----------------|
| Dashboard UI + Free Scan | `src/App.jsx`, Visualizations | Dashboard metrics & charts |
| OpenAPI Importer | `OpenAPIView()`, Diff visualization | Spec diff UI & visualization |
| GitHub Integration | `GitHubView()`, Status display | Repository display & metrics |

**Key Files**:
- `src/App.jsx` (OpenAPIView, GitHubView dashboard components)
- Recharts integration for visualizations
- Frontend state management

---

### **Avani**
**Role**: Integration & DevOps Lead

| Task | Files | Responsibility |
|------|-------|-----------------|
| Postman Integration | API integration, webhook handling | Postman API authentication & sync |
| OpenAPI Importer | Batch import optimization | Spec parsing & endpoint extraction |
| CI/CD Pipelines | `backend/worker.js`, `queue.js`, BullMQ | Job queue setup, worker implementation |

**Key Files**:
- `backend/server.js` (Postman 562-641, OpenAPI 374-519)
- `backend/worker.js` (scan processing)
- `backend/queue.js` (queue configuration)
- `docker-compose.yml` (orchestration)

---

### **Nikhil Patel**
**Role**: Backend Lead & DevOps Engineer

| Task | Files | Responsibility |
|------|-------|-----------------|
| CI/CD Pipelines | `backend/server.js` (713-767), worker integration | CI/CD endpoints & gating |
| PDF Reporting | `backend/server.js` (773-840), PDF generation | Report generation & storage |
| GitHub Integration | `backend/server.js` (647-707), webhooks | GitHub API integration & scanning |

**Key Files**:
- `backend/server.js` (CI/CD 713-767, Reports 773-840, GitHub 647-707)
- `backend/worker.js` (scan results aggregation)
- `docker-compose.yml` (infrastructure setup)
- `backend/Dockerfile` (containerization)

---

## 🎯 Task Distribution

### Task 1: Dashboard UI + Free Scan Page
```
Maitreyi Ingle ███████░░░ (70%) - Lead
Riya Uppal     ██████░░░░ (60%) - UI Refinement
Kartikeya      ██████░░░░ (60%) - Visualizations
```

### Task 2: Postman Integration + OpenAPI Importer
```
Maitreyi Ingle ███████░░░ (70%) - Lead
Avani          ███████░░░ (70%) - Backend Integration
Kartikeya      ████░░░░░░ (40%) - UI/Diff Visualization
```

### Task 3: CI/CD Integration + Deployment Pipelines
```
Avani          ███████░░░ (70%) - Queue & Worker Setup
Nikhil Patel   ███████░░░ (70%) - API Endpoints & Docker
```

### Task 4: PDF Reporting
```
Nikhil Patel   ███████░░░ (70%) - Backend PDF Generation
Riya Uppal     ██████░░░░ (60%) - Frontend UI & Storage
```

### Task 5: GitHub Integration
```
Nikhil Patel   ███████░░░ (70%) - Backend API Integration
Riya Uppal     ██████░░░░ (60%) - Frontend UI & Display
Kartikeya      ████░░░░░░ (40%) - Visualization & Metrics
```

---

## 📁 File Ownership

### Backend Files (server-side responsibility)
| File | Owner(s) |
|------|----------|
| `backend/server.js` | Maitreyi, Avani, Nikhil |
| `backend/worker.js` | Avani, Nikhil |
| `backend/db.js` | All (shared infrastructure) |
| `backend/queue.js` | Avani, Nikhil |

### Frontend Files (client-side responsibility)
| File | Owner(s) |
|------|----------|
| `src/App.jsx` | Maitreyi, Riya, Kartikeya |
| `src/store.js` | All (shared infrastructure) |
| `src/api.js` | All (shared infrastructure) |
| `src/mockData.js` | Maitreyi |

### Infrastructure Files (DevOps responsibility)
| File | Owner(s) |
|------|----------|
| `docker-compose.yml` | Avani, Nikhil |
| `Dockerfile` | Nikhil |
| `backend/Dockerfile` | Nikhil |
| `package.json` files | All (shared infrastructure) |

---

## 🔄 Collaboration Points

### Critical Dependencies

1. **Maitreyi ↔ Avani**
   - Postman & OpenAPI integration
   - Files: `backend/server.js`, `src/store.js`

2. **Riya ↔ Nikhil**
   - PDF Reports & GitHub Integration
   - Files: `backend/server.js`, `src/App.jsx`

3. **Kartikeya ↔ All**
   - Frontend visualizations & UI components
   - Files: `src/App.jsx`, Recharts components

4. **Avani ↔ Nikhil**
   - CI/CD Pipeline & Docker Deployment
   - Files: `backend/worker.js`, `docker-compose.yml`

---

## 📊 Code Statistics

| Component | LOC | Primary Dev | Secondary Dev |
|-----------|-----|------------|--------------|
| `src/App.jsx` | 1,744 | Maitreyi | Riya, Kartikeya |
| `backend/server.js` | 950 | Nikhil | Avani, Maitreyi, Riya |
| `backend/worker.js` | 270 | Avani | Nikhil |
| `src/store.js` | 400+ | Maitreyi | All |
| `backend/db.js` | 167+ | Nikhil | All |

---

## ✅ Checklist for Team Leads

- [ ] Frontend Lead (Maitreyi) - Dashboard & Integrations
  - [ ] Review API integration tests
  - [ ] Validate state management
  - [ ] Test Postman/OpenAPI flows

- [ ] Backend Lead (Nikhil) - Server & Infrastructure
  - [ ] Set up Docker Compose
  - [ ] Configure database migrations
  - [ ] Review endpoint security

- [ ] DevOps Lead (Avani) - CI/CD & Queue
  - [ ] Set up BullMQ workers
  - [ ] Configure Redis queues
  - [ ] Test job processing

---

**Last Updated**: June 4, 2026  
**Created**: 2026-06-04  
**Version**: 1.0
