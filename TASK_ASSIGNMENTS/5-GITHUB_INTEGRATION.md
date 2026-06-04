# Task 5: GitHub Integration

## Team Members
- **Nikhil Patel**
- **Riya Uppal**
- **Kartikeya Shukla**

## Files Responsible For

### Backend API Endpoints
- `backend/server.js` (lines 647-707):
  - `GET /api/github/repos` — Fetch GitHub repositories
  - `POST /api/github/repos/:owner/:repo/scan` — Trigger repository scan

### Database Schema
- `backend/db.js`:
  - `github_connections` table — Store GitHub repo metadata
    - repo_name, branch, prs_count, issues_count, score, status
    - last_scanned_at tracking

### Frontend Components
- `src/App.jsx`:
  - `GitHubView()` (lines 1147-1216) — GitHub dashboard
    - Display connected repositories
    - Show PR/issue counts
    - Security score badges
    - Scan status indicators
    - Manual scan trigger buttons

### State Management
- `src/store.js` (Zustand actions):
  - `fetchGitHub()` — Get all connected GitHub repos
  - `scanRepo(owner, repoName)` — Trigger repo scan

### GitHub Actions Integration
- `backend/templates/apiguard-scan.yml` — GitHub Actions workflow template
  - Automated scanning on push/pull request
  - Uses CI/CD token for authentication
  - Exit code gates to block merges
  - Scan result reporting

## Key Features to Implement

1. ✅ GitHub OAuth app registration
2. ✅ Repository discovery & listing
3. ✅ Pull request security scanning
4. ✅ Branch protection rule integration
5. ✅ Status checks for PR gates
6. ✅ Webhook support for automatic scans
7. ✅ Repository metrics tracking (PRs, issues)
8. ✅ Security score calculation per repo
9. ✅ Last scanned timestamp

## Security Scanning on GitHub

### PR-Level Scanning
- Scan modified endpoints in PRs
- Comment on PR with security findings
- Block merge if critical issues found
- Auto-remediation suggestions

### Repository Metrics
- Total critical/high/medium/low findings
- Overall security score (0-100)
- Trend analysis over time
- Compliance status

## API Endpoints Used
- `GET /api/github/repos` — List repos
- `POST /api/github/repos/:owner/:repo/scan` — Scan repo
- Queue jobs for repository scanning

## Database Tables
- `github_connections` — Repository metadata
- `scans` — Scan results linked to repos
- `alerts` — Security alerts for GitHub issues

## GitHub Actions Workflow Example
```yaml
name: ApiGuard Security Scan
on: [push, pull_request]
jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run ApiGuard Scan
        run: |
          curl -X POST -H "Authorization: Bearer ${{ secrets.APIGUARD_TOKEN }}" \
            -d '{"repo":"${{ github.repository }}","branch":"${{ github.ref }}"}' \
            http://apiguard-api/api/cicd/scan
```

---
**Last Updated**: June 4, 2026
**Status**: Ready for Development
