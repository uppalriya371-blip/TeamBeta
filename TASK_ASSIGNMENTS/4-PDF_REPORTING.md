# Task 4: PDF Reporting

## Team Members
- **Nikhil Patel**
- **Riya Uppal**

## Files Responsible For

### Backend API Endpoints
- `backend/server.js` (lines 773-840):
  - `POST /api/reports/generate` — Generate PDF report from scan
  - `GET /api/reports` — Fetch all generated reports
  - `DELETE /api/reports/:id` — Delete a report

### Database Schema
- `backend/db.js`:
  - `reports` table — Store report metadata
    - name, file_size, pages, score, scan_id
    - created_at for sorting

### Frontend Components
- `src/App.jsx`:
  - `ReportsView()` (lines 1495-1541) — Reports dashboard
    - List all generated reports
    - Display report metadata (name, date, pages, score)
    - Download functionality with signed URLs
    - Delete reports with confirmation

### State Management
- `src/store.js` (Zustand actions):
  - `fetchReports()` — Get all user reports
  - `generateReport(scanId, name)` — Create new PDF report
  - `deleteReport(reportId)` — Remove report

## Key Features to Implement

1. ✅ PDF generation from scan results
2. ✅ Report metadata tracking (pages, file size, score)
3. ✅ Report history management
4. ✅ Download with signed URLs (security feature)
5. ✅ Report associated with specific scans
6. ✅ Scan score embedding in report
7. ✅ Vulnerability findings included in PDF
8. ✅ Compliance-ready formatting (SOC2, ISO27001)

## Report Contents
- Executive summary with security score
- Vulnerability findings by severity
- OWASP Top 10 analysis
- Endpoint security assessment
- Timeline of scan activities
- Remediation recommendations

## API Endpoints Used
- `POST /api/reports/generate` — Create report
- `GET /api/reports` — List reports
- `DELETE /api/reports/:id` — Delete report

## Database Tables
- `reports` — Report metadata
- `scans` — Linked scan data & findings

## PDF Libraries to Consider
- `pdfkit` (Node.js PDF generation)
- `puppeteer` (HTML to PDF via headless browser)
- `jsPDF` (Client-side PDF generation)

---
**Last Updated**: June 4, 2026
**Status**: Ready for Development
