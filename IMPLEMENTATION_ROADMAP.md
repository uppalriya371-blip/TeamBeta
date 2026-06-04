# Phase-Based Implementation Roadmap

## Phase 1: MVP (Foundation - Weeks 1-2)

### 1.1 Database Connection Pooling Optimization
**File**: `backend/db.js`
**Tasks**:
- [ ] Configure pg pool with explicit settings (max: 100, idleTimeoutMillis: 30000)
- [ ] Add connection error handling and retry logic
- [ ] Create connection pool health check endpoint
- [ ] Add pool statistics monitoring

**Code Template**:
```javascript
const pool = new Pool({
  max: 100,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 30000,
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    poolSize: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  });
});
```

---

### 1.2 Batch OpenAPI Endpoint Inserts
**File**: `backend/server.js` (lines 404-414)
**Tasks**:
- [ ] Refactor endpoint insertion to use batch inserts
- [ ] Reduce 100 queries to 1-3 queries
- [ ] Add transaction support
- [ ] Benchmark: measure time reduction

**Code Template**:
```javascript
// Instead of loop with individual INSERTs
const values = endpoints.map((ep, i) => {
  const status = ep.path.includes('admin') ? 'critical' : 'safe';
  return `($1, $${i*7+2}, $${i*7+3}, $${i*7+4}, $${i*7+5}, $${i*7+6}, $${i*7+7})`;
}).join(',');

const params = [specId, ...endpoints.flatMap(ep => [
  ep.method, ep.path, ep.description, 'safe', ep.latency, ep.calls
])];

await pool.query(
  `INSERT INTO endpoints (spec_id, method, path, description, status, latency, calls) 
   VALUES ${values}`,
  params
);
```

---

### 1.3 Frontend Request Batching
**File**: `src/store.js` (lines 181-185)
**Tasks**:
- [ ] Replace sequential API calls with Promise.all()
- [ ] Implement request deduplication
- [ ] Add query parameter for selective data loading
- [ ] Reduce network latency by 400-500ms

**Code Template**:
```javascript
// Before: Sequential
get().fetchScans();
get().fetchAlerts();
get().fetchPostman();

// After: Parallel
await Promise.all([
  get().fetchScans(),
  get().fetchAlerts(),
  get().fetchPostman(),
  get().fetchGitHub(),
  get().fetchPipelineRuns()
]);
```

---

### 1.4 Add Missing Health Check Endpoint
**File**: `backend/server.js`
**Tasks**:
- [ ] Add `/api/health` endpoint with DB connectivity check
- [ ] Add to docker-compose healthcheck
- [ ] Return pool stats and service status

**Code Template**:
```javascript
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date() });
  } catch (e) {
    res.status(503).json({ status: 'unhealthy', error: e.message });
  }
});
```

---

## Phase 2: Stability & Scale (Weeks 3-4)

### 2.1 SSE Connection Management & Cleanup
**File**: `backend/server.js` (lines 238-273)
**Tasks**:
- [ ] Add connection timeout (60 seconds idle)
- [ ] Implement max concurrent connections limit (1000)
- [ ] Add heartbeat messages every 30 seconds
- [ ] Graceful cleanup on disconnect
- [ ] Track active connections metric

**Code Template**:
```javascript
const MAX_CONNECTIONS = 1000;
let activeConnections = 0;

app.get('/api/scans/:id/stream', async (req, res) => {
  if (activeConnections >= MAX_CONNECTIONS) {
    return res.status(503).json({ error: 'Too many connections' });
  }
  
  activeConnections++;
  const timeout = setTimeout(() => {
    cleanup();
  }, 60000);
  
  // ... existing SSE code ...
  
  const cleanup = () => {
    clearTimeout(timeout);
    activeConnections--;
    eventSource?.close?.();
  };
  
  req.on('close', cleanup);
});
```

---

### 2.2 Redis Separation & Optimization
**File**: `backend/server.js`, `backend/worker.js`
**Tasks**:
- [ ] Create separate Redis instances: queue vs pub/sub vs cache
- [ ] Update docker-compose.yml with multiple Redis services
- [ ] Migrate BullMQ to dedicated Redis instance
- [ ] Keep pub/sub on shared instance
- [ ] Update environment variables

**docker-compose changes**:
```yaml
redis-queue:
  image: redis:7-alpine
  
redis-pubsub:
  image: redis:7-alpine
  
redis-cache:
  image: redis:7-alpine

# Update api service env:
environment:
  REDIS_QUEUE_HOST: redis-queue
  REDIS_PUBSUB_HOST: redis-pubsub
  REDIS_CACHE_HOST: redis-cache
```

---

### 2.3 Add Request Rate Limiting
**File**: `backend/server.js`
**Tasks**:
- [ ] Install `express-rate-limit`
- [ ] Add rate limiter middleware
- [ ] Configure per-user limits: 10 concurrent scans, 100 scans/day
- [ ] Return 429 when limit exceeded
- [ ] Store rate limit state in Redis

**Code Template**:
```javascript
import rateLimit from 'express-rate-limit';

const scanLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per windowMs
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (req, res) => res.status(429).json({ error: 'Too many scans' })
});

app.post('/api/scans', authMiddleware, scanLimiter, async (req, res) => {
  // ...
});
```

---

### 2.4 Implement Pagination for Lists
**File**: `src/App.jsx`, `backend/server.js`
**Tasks**:
- [ ] Add pagination to GET /api/scans (20 items per page)
- [ ] Add pagination to GET /api/reports
- [ ] Add pagination to GET /api/alerts
- [ ] Update frontend to support pagination UI
- [ ] Add virtual scrolling for large lists

**Backend changes**:
```javascript
app.get('/api/scans', authMiddleware, async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;
  
  const result = await pool.query(
    'SELECT ... FROM scans WHERE user_id = $1 ORDER BY id DESC LIMIT $2 OFFSET $3',
    [req.user.id, limit, offset]
  );
  
  const countResult = await pool.query(
    'SELECT COUNT(*) FROM scans WHERE user_id = $1',
    [req.user.id]
  );
  
  res.json({
    data: result.rows,
    total: parseInt(countResult.rows[0].count),
    limit, offset
  });
});
```

---

### 2.5 Separate Findings into Own Table
**File**: `backend/db.js`, `backend/server.js`
**Tasks**:
- [ ] Create `scan_findings` table (normalized schema)
- [ ] Add foreign key to scans table
- [ ] Migrate existing findings from JSONB
- [ ] Add pagination endpoint for findings
- [ ] Update worker to insert findings separately

**Migration SQL**:
```sql
CREATE TABLE scan_findings (
  id SERIAL PRIMARY KEY,
  scan_id INTEGER REFERENCES scans(id) ON DELETE CASCADE,
  check_name VARCHAR(255),
  severity VARCHAR(50),
  detail TEXT,
  fix TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scan_findings_scan_id ON scan_findings(scan_id);
```

---

## Phase 3: Optimization & AI Features (Weeks 5-6)

### 3.1 Parallel Scan Operations
**File**: `backend/worker.js`
**Tasks**:
- [ ] Refactor runScan to execute checks in parallel
- [ ] Use Promise.all() for independent checks
- [ ] Add timeout for each check (15 seconds)
- [ ] Implement circuit breaker for failing checks
- [ ] Increase effective concurrency from 3 to 10+ concurrent scans

**Code Template**:
```javascript
async function runScan(job) {
  const { scanId, url, userId } = job.data;
  
  const checkPromises = OWASP_CHECKS.map(check => 
    executeCheckWithTimeout(check, url, 15000)
      .catch(err => ({ check: check.name, error: err.message }))
  );
  
  const findings = await Promise.all(checkPromises);
  
  // Process results...
}

async function executeCheckWithTimeout(check, url, timeout) {
  return Promise.race([
    runCheck(check, url),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('timeout')), timeout)
    )
  ]);
}
```

---

### 3.2 Component Memoization & Re-render Optimization
**File**: `src/App.jsx`
**Tasks**:
- [ ] Split monolithic App.jsx into smaller components
- [ ] Wrap views with React.memo()
- [ ] Use Zustand selectors to limit re-renders
- [ ] Implement windowing for large lists (react-window)
- [ ] Profile with React DevTools

**Code Template**:
```javascript
// Create selector for specific store slice
const selectScans = (state) => state.scans;

// Memoize component
const ScanListView = React.memo(({ scans }) => {
  return <div>{scans.map(...)}</div>;
}, (prev, next) => {
  // Custom comparison
  return prev.scans.length === next.scans.length;
});

// Use in App
function DashboardView({ user }) {
  const scans = useAppStore(selectScans);
  return <ScanListView scans={scans} />;
}
```

---

### 3.3 Cache Layer Implementation
**File**: `backend/server.js`
**Tasks**:
- [ ] Add Redis cache for /api/scans list (TTL: 5 minutes)
- [ ] Cache /api/reports (TTL: 10 minutes)
- [ ] Implement cache invalidation on mutations
- [ ] Add cache hit/miss metrics
- [ ] Use redis-cache package

**Code Template**:
```javascript
const cache = new RedisCache(redisClient);

app.get('/api/scans', authMiddleware, async (req, res) => {
  const cacheKey = `scans:${req.user.id}:${req.query.offset}`;
  
  let data = await cache.get(cacheKey);
  if (!data) {
    data = await pool.query(...);
    await cache.set(cacheKey, data, 300); // 5 min TTL
  }
  
  res.json(data);
});

// Invalidate on mutation
app.delete('/api/scans/:id', authMiddleware, async (req, res) => {
  await pool.query(...);
  await cache.del(`scans:${req.user.id}:*`);
  res.sendStatus(204);
});
```

---

### 3.4 Add AI Documentation Generator
**File**: `backend/server.js` (new endpoint)
**Tasks**:
- [ ] Create POST `/api/ai/generate-docs` endpoint
- [ ] Integrate with LLM API (OpenAI/Claude)
- [ ] Generate API documentation from findings
- [ ] Add rate limiting (5 per day per user)
- [ ] Cache generated documentation

---

### 3.5 Add AI Test Case Generator
**File**: `backend/server.js` (new endpoint)
**Tasks**:
- [ ] Create POST `/api/ai/generate-tests` endpoint
- [ ] Generate test cases from endpoint specs
- [ ] Support multiple frameworks (Jest, Mocha, etc.)
- [ ] Add to scan completion flow
- [ ] Cache templates

---

## Implementation Checklist

### Week 1
- [ ] Phase 1.1: Connection pooling
- [ ] Phase 1.2: Batch inserts
- [ ] Phase 1.3: Frontend batching
- [ ] Test and benchmark improvements

### Week 2
- [ ] Phase 1.4: Health check
- [ ] Phase 2.1: SSE cleanup
- [ ] Phase 2.2: Redis separation (planning)
- [ ] Code review and documentation

### Week 3
- [ ] Phase 2.2: Redis separation (implementation)
- [ ] Phase 2.3: Rate limiting
- [ ] Phase 2.4: Pagination backend
- [ ] Phase 2.5: Findings table migration

### Week 4
- [ ] Phase 2.4: Pagination frontend
- [ ] Phase 3.1: Parallel scan operations
- [ ] Load testing and optimization
- [ ] Documentation and deployment prep

### Week 5-6
- [ ] Phase 3.2: Memoization & optimization
- [ ] Phase 3.3: Cache layer
- [ ] Phase 3.4-3.5: AI features
- [ ] Final testing and production deployment

---

## Success Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Average response time (scan list) | 500ms | 100ms | Week 2 |
| OpenAPI import time (100 endpoints) | 15s | 1-2s | Week 1 |
| Concurrent users | 50 | 500+ | Week 4 |
| SSE connections | Leaks | Stable | Week 3 |
| Memory usage (API server) | 500MB | 200MB | Week 4 |
| Database connections | 50 max | 100 max | Week 1 |
| Scan completion to UI update | 2-3s | <500ms | Week 2 |
| Uptime (SLA) | 99% | 99.9% | Week 6 |

---

## Testing Strategy

- [ ] Add load tests (k6/Artillery) for concurrent scans
- [ ] Add database query performance tests
- [ ] Add memory leak tests for SSE connections
- [ ] Add cache hit ratio monitoring
- [ ] Add E2E tests for critical flows

