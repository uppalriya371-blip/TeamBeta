# Task 1: Dashboard UI + Free Scan Page

## Team Members
- **Maitreyi Ingle**
- **Riya Uppal**
- **Kartikeya Shukla**

## Files Responsible For

### Frontend Components
- `src/App.jsx` — Main application UI with all dashboard views
  - DashboardView (lines 498-664)
  - ScanView (lines 766-863)
  - AlertsView (lines 721-761)
  - EndpointsView (lines 669-716)
  - Sidebar & Topbar navigation

- `src/main.jsx` — React entry point with Google OAuth setup
- `src/index.css` — Dashboard styling & animations
- `src/mockData.js` — Mock data for free scan simulation

### State Management
- `src/store.js` (Zustand store):
  - `fetchScans()` — Retrieve scan history
  - `triggerScan()` — Initiate API security scan
  - `listenToScanStream()` — Real-time scan progress updates
  - `fetchAlerts()` — Retrieve security alerts
  - `markAlertRead()` — Mark alerts as read

### Configuration
- `vite.config.js` — Frontend dev server configuration with API proxy
- `package.json` (frontend) — React, Recharts, Zustand dependencies
- `src/api.js` — Axios HTTP client setup

## Key Features to Implement

1. ✅ Dashboard metrics display (total scans, threats, security score)
2. ✅ Live scan feed with real-time updates
3. ✅ Free scan page with URL input
4. ✅ Scan progress visualization (progress bar + OWASP checks)
5. ✅ Alerts notification system
6. ✅ Threat distribution pie chart
7. ✅ Weekly/monthly scan trends

## API Endpoints Used
- `GET /api/scans` — Fetch user's scans
- `POST /api/scans` — Trigger new scan
- `GET /api/scans/:id/stream` — SSE stream for scan progress
- `GET /api/alerts` — Fetch alerts
- `PATCH /api/alerts/:id/read` — Mark alert as read

## Database Tables
- `scans` — Scan records with findings
- `alerts` — User security alerts

---
**Last Updated**: June 4, 2026
**Status**: Ready for Development
