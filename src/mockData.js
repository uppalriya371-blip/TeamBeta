const MOCK_USER = { id: 1, name: 'Admin', email: 'admin@apiguard.io', role: 'Platform Lead' };

const MOCK_SCANS = [
  { id: 1, name: 'Payment API — Full Scan', method: 'https://api.acme.com/payments', sev: 'critical', score: 42, time: '2m ago', src: 'ENDPOINT', threats: 4 },
  { id: 2, name: 'Auth Service — Quick Scan', method: 'https://api.acme.com/auth', sev: 'high', score: 61, time: '15m ago', src: 'ENDPOINT', threats: 3 },
  { id: 3, name: 'OpenAPI Scan — petstore.json', method: '/api/v1', sev: 'medium', score: 78, time: '1h ago', src: 'OPENAPI', threats: 2 },
  { id: 4, name: 'Postman Scan — User Management API', method: 'http://localhost/postman', sev: 'safe', score: 95, time: '2h ago', src: 'POSTMAN', threats: 0 },
  { id: 5, name: 'CI/CD Gate — acme/api-gateway', method: 'cicd://acme/api-gateway', sev: 'safe', score: 97, time: '3h ago', src: 'CICD', threats: 0 },
];

const MOCK_SCAN_DETAILS = {
  id: 1, name: 'Payment API — Full Scan', target_url: 'https://api.acme.com/payments',
  type: 'endpoint', status: 'completed', score: 42,
  findings: [
    { check: 'Broken Object Level Authorization', status: 'critical', detail: 'Object ID manipulation exposes payment transactions on PUT /api/v1/payments', fix: 'Enforce ownership validation check before database mutation.' },
    { check: 'Broken Authentication', status: 'critical', detail: 'Payment endpoint lacks proper authentication controls', fix: 'Implement strong authentication mechanisms for all payment endpoints.' },
    { check: 'Rate Limiting', status: 'high', detail: 'No request throttling on payment endpoints allows abuse', fix: 'Implement request rate-limiter middleware on payment endpoints.' },
    { check: 'Security Misconfiguration', status: 'medium', detail: 'CORS wildcard origin allowed on payment API', fix: 'Restrict Allowed-Origins header to trusted domain list.' },
    { check: 'JWT Security', status: 'safe', detail: 'JWT signature verified, strong HS256 algorithm enforced', fix: null },
    { check: 'SSRF Protection', status: 'safe', detail: 'Server-side request forgery protections correctly implemented', fix: null },
  ],
};

const MOCK_GITHUB_REPOS = [
  { id: 1, name: 'acme/payment-api', branch: 'main', prs: 3, issues: 2, score: 61, scan: '2h ago', status: 'high' },
  { id: 2, name: 'acme/auth-service', branch: 'main', prs: 1, issues: 5, score: 55, scan: '1h ago', status: 'critical' },
  { id: 3, name: 'acme/api-gateway', branch: 'release/3', prs: 0, issues: 0, score: 97, scan: '3h ago', status: 'safe' },
  { id: 4, name: 'acme/user-api', branch: 'develop', prs: 2, issues: 1, score: 83, scan: '4h ago', status: 'medium' },
  { id: 5, name: 'acme/inventory', branch: 'main', prs: 0, issues: 0, score: 99, scan: '6h ago', status: 'safe' },
  { id: 6, name: 'acme/webhook-svc', branch: 'main', prs: 1, issues: 3, score: 72, scan: '5h ago', status: 'medium' },
];

const MOCK_POSTMAN_COLLECTIONS = [
  { id: 1, name: 'Payment API Collection', reqs: 24, issues: 4, status: 'high', updated: '10m ago', uid: 'col_pay_123' },
  { id: 2, name: 'Auth Service Tests', reqs: 18, issues: 0, status: 'safe', updated: '1h ago', uid: 'col_auth_123' },
  { id: 3, name: 'User Management API', reqs: 31, issues: 2, status: 'medium', updated: '2h ago', uid: 'col_user_123' },
  { id: 4, name: 'Admin Panel Endpoints', reqs: 12, issues: 7, status: 'critical', updated: '30m ago', uid: 'col_admin_123' },
];

const MOCK_PIPELINE_RUNS = [
  { id: 1, repo: 'acme/payment-api', branch: 'main', status: 'failed', duration: '18s', commit_msg: 'fix: update payment validation', commit_sha: 'a3f8c21', triggered_by: 'GitHub Actions', created_at: new Date(Date.now() - 3600000) },
  { id: 2, repo: 'acme/api-gateway', branch: 'main', status: 'passed', duration: '12s', commit_msg: 'feat: add rate limiting middleware', commit_sha: 'b7d2e94', triggered_by: 'GitHub Actions', created_at: new Date(Date.now() - 7200000) },
  { id: 3, repo: 'acme/auth-service', branch: 'develop', status: 'passed', duration: '15s', commit_msg: 'chore: update dependencies', commit_sha: 'c1e4f67', triggered_by: 'GitHub Actions', created_at: new Date(Date.now() - 10800000) },
];

const MOCK_REPORTS = [
  { id: 1, name: 'Payment API — Security Audit', date: 'May 28, 2026', pages: 18, score: 61, size: '2.4 MB' },
  { id: 2, name: 'Auth Service — Penetration Report', date: 'May 27, 2026', pages: 24, score: 55, size: '3.1 MB' },
  { id: 3, name: 'API Gateway — Compliance (SOC2)', date: 'May 26, 2026', pages: 12, score: 97, size: '1.8 MB' },
];

const MOCK_ALERTS = [
  { id: 1, type: 'critical', msg: 'SQL Injection detected in POST /api/v1/payments', time: '2m ago', read: false },
  { id: 2, type: 'high', msg: 'Rate limit bypassed on /auth/login — 2400 req/min', time: '8m ago', read: false },
  { id: 3, type: 'medium', msg: 'CORS wildcard origin in inventory-svc', time: '1h ago', read: true },
  { id: 4, type: 'info', msg: 'GitHub Actions pipeline completed — api-gateway', time: '2h ago', read: true },
];

const MOCK_INFRA = [
  { name: 'apiguard-api', status: 'Healthy', cpu: '0.8%', memory: '94 MB', uptime: '18h 4m' },
  { name: 'apiguard-worker', status: 'Healthy', cpu: '1.2%', memory: '112 MB', uptime: '18h 4m' },
  { name: 'apiguard-db', status: 'Healthy', cpu: '0.2%', memory: '48 MB', uptime: '18h 5m' },
  { name: 'apiguard-cache', status: 'Healthy', cpu: '0.4%', memory: '12 MB', uptime: '18h 5m' },
];

const OWASP_CHECKS = [
  'Broken Object Level Authorization',
  'Broken Authentication',
  'Broken Object Property Level Authorization',
  'Unrestricted Resource Consumption',
  'Broken Function Level Authorization',
  'Unrestricted Access to Sensitive Business Flows',
  'Server Side Request Forgery',
  'Security Misconfiguration',
  'Improper Inventory Management',
  'Unsafe Consumption of APIs',
];

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let mockScanIdCounter = 100;

export const mockStore = {

  login: async (email, password) => {
    await delay(500);
    if (!email || !password) throw new Error('Please fill in all fields');
    return {
      user: MOCK_USER,
      accessToken: 'mock_access_token_' + Date.now(),
      refreshToken: 'mock_refresh_token_' + Date.now(),
    };
  },

  signup: async (name, email, password) => {
    await delay(500);
    if (!name || !email || !password) throw new Error('Please provide all fields');
    return {
      user: { ...MOCK_USER, name, email },
      accessToken: 'mock_access_token_' + Date.now(),
      refreshToken: 'mock_refresh_token_' + Date.now(),
    };
  },

  fetchMe: async () => {
    await delay(200);
    return { user: MOCK_USER };
  },

  fetchScans: async () => {
    await delay(300);
    return [...MOCK_SCANS];
  },

  fetchScan: async () => {
    await delay(300);
    return { ...MOCK_SCAN_DETAILS };
  },

  triggerScan: async (name, url, type) => {
    const id = ++mockScanIdCounter;
    const scan = { id, name: name || `Scan — ${url}`, target_url: url, type, status: 'pending', score: 100 };
    return scan;
  },

  simulateScanProgress: (scanId, onProgress, onComplete) => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      const progress = Math.round((i / OWASP_CHECKS.length) * 100);
      onProgress({ progress, currentCheck: OWASP_CHECKS[i - 1], status: 'scanning' });
      if (i >= OWASP_CHECKS.length) {
        clearInterval(interval);
        const score = Math.floor(Math.random() * 40) + 55;
        onComplete({ status: 'completed', progress: 100, score, findings: MOCK_SCAN_DETAILS.findings });
      }
    }, 400);
    return () => clearInterval(interval);
  },

  fetchGitHub: async () => {
    await delay(300);
    return [...MOCK_GITHUB_REPOS];
  },

  fetchPostman: async () => {
    await delay(300);
    return [...MOCK_POSTMAN_COLLECTIONS];
  },

  connectPostman: async () => {
    await delay(500);
    return true;
  },

  fetchPipelineRuns: async () => {
    await delay(300);
    return [...MOCK_PIPELINE_RUNS];
  },

  generateCicdToken: async () => {
    await delay(300);
    return 'ag_cicd_tk_mock_' + Date.now().toString(36);
  },

  fetchReports: async () => {
    await delay(300);
    return [...MOCK_REPORTS];
  },

  generateReport: async (scanId, name) => {
    await delay(500);
    return { id: Date.now(), name: name || 'Security Report', pages: 16, score: 78, size: '2.2 MB', date: 'May 30, 2026' };
  },

  fetchAlerts: async () => {
    await delay(200);
    return [...MOCK_ALERTS];
  },

  fetchInfra: async () => {
    await delay(200);
    return [...MOCK_INFRA];
  },

  fetchTuning: async () => {
    await delay(200);
    return { concurrency: 3, max_retries: 3, backoff_delay: 5000 };
  },

  saveTuning: async (config) => {
    await delay(300);
    return config;
  },

  fetchSpecs: async () => {
    await delay(300);
    return [
      { id: 1, filename: 'petstore-v3.json', created_at: new Date(Date.now() - 86400000) },
      { id: 2, filename: 'payments-api.yaml', created_at: new Date(Date.now() - 172800000) },
    ];
  },

  fetchEndpoints: async () => {
    await delay(300);
    return [
      { id: 1, method: 'GET', path: '/pets', description: 'List all pets', status: 'safe', latency: '45ms', calls: '12.3k' },
      { id: 2, method: 'POST', path: '/pets', description: 'Create a pet', status: 'medium', latency: '89ms', calls: '3.1k' },
      { id: 3, method: 'GET', path: '/pets/{id}', description: 'Get pet by ID', status: 'safe', latency: '32ms', calls: '8.7k' },
      { id: 4, method: 'DELETE', path: '/pets/{id}', description: 'Delete a pet', status: 'critical', latency: '67ms', calls: '0.4k' },
      { id: 5, method: 'POST', path: '/auth/login', description: 'User login', status: 'high', latency: '120ms', calls: '15.2k' },
      { id: 6, method: 'GET', path: '/users', description: 'List users', status: 'safe', latency: '55ms', calls: '6.9k' },
    ];
  },

  importSpec: async () => {
    await delay(800);
    return { spec: { id: 3, filename: 'imported-spec.json' }, endpointsCount: 8, diff: null };
  },
};
