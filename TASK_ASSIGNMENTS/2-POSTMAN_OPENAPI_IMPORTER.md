# Task 2: Postman Integration + OpenAPI Importer

## Team Members
- **Maitreyi Ingle**
- **Avani**

## Files Responsible For

### Backend API Endpoints
- `backend/server.js`:
  - **OpenAPI Import** (lines 374-519):
    - `POST /api/openapi/import` — Upload/parse OpenAPI specs
    - `GET /api/openapi/specs` — List all specs
    - `GET /api/openapi/specs/:id/endpoints` — Get endpoints from spec
    - `POST /api/openapi/specs/:id/scan` — Scan OpenAPI spec

  - **Postman Integration** (lines 562-641):
    - `POST /api/postman/connect` — Connect Postman API key
    - `GET /api/postman/collections` — Fetch Postman collections
    - `POST /api/postman/collections/:id/scan` — Scan Postman collection
    - `DELETE /api/postman/disconnect` — Disconnect Postman
    - `POST /api/postman/webhook` — Webhook receiver for Postman events

### Database Schema
- `backend/db.js`:
  - `specs` table — Store OpenAPI/Swagger files
  - `endpoints` table — Parsed API endpoints
  - `postman_collections` table — Postman collection metadata

### Frontend Components
- `src/App.jsx`:
  - `OpenAPIView()` (lines 868-1038) — Upload & diff OpenAPI specs
  - `PostmanView()` (lines 1043-1142) — Postman connection & collection scanning

### State Management
- `src/store.js` (Zustand actions):
  - `importSpec(filename, content, file)` — Import OpenAPI spec
  - `fetchSpecs()` — Get all imported specs
  - `fetchEndpoints(specId)` — Get endpoints from spec
  - `scanSpec(specId)` — Trigger spec scan
  - `connectPostman(apiKey)` — Connect Postman integration
  - `fetchPostman()` — Get Postman collections
  - `scanCollection(collectionId)` — Scan Postman collection
  - `disconnectPostman()` — Remove Postman integration

## Key Features to Implement

1. ✅ Drag & drop OpenAPI spec upload
2. ✅ YAML/JSON parser for API specs
3. ✅ OpenAPI v2/v3 spec diff visualization
4. ✅ Automatic endpoint extraction & analysis
5. ✅ Postman API key authentication
6. ✅ Collection sync & display
7. ✅ Vulnerability scanning on specs/collections
8. ✅ Request count & issues tracking

## API Endpoints Used
- `POST /api/openapi/import` — Upload spec files
- `GET /api/openapi/specs` — List specs
- `POST /api/postman/connect` — Authenticate with Postman
- `GET /api/postman/collections` — Fetch collections
- Queue jobs for scanning

## Database Tables
- `specs` — Uploaded OpenAPI specifications
- `endpoints` — Extracted API endpoints
- `postman_collections` — Synced Postman collections
- `scans` — Scan results linked to specs/collections

---
**Last Updated**: June 4, 2026
**Status**: Ready for Development
