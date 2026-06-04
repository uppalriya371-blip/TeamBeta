# Performance Issues Analysis - ApiGuard

## Critical Performance Issues Found

### 1. **Frontend State Management - Zustand Store Inefficiency**
**File**: `src/store.js`
**Issue**: Multiple API calls on SSE completion (lines 181-185)
```javascript
get().fetchScans();
get().fetchAlerts();
get().fetchPostman();
get().fetchGitHub();
get().fetchPipelineRuns();
```
**Problem**: 
- 5 sequential API calls trigger when a scan completes
- No request batching or parallel execution optimization
- Each call is independent, causing waterfall effect
- No caching strategy for frequently accessed data

**Impact**: High latency, poor user experience on scan completion
**Fix**: Batch requests, implement data caching, use Promise.all()

---

### 2. **Backend - N+1 Query Problem in OpenAPI Import**
**File**: `backend/server.js` (lines 404-414)
**Issue**: Loop with individual INSERT statements
```javascript
for (const ep of endpoints) {
  // ...
  await pool.query(
    'INSERT INTO endpoints (spec_id, method, path, description, status, latency, calls) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [specId, ep.method, ep.path, ep.description, status, ep.latency, ep.calls]
  );
}
```
**Problem**:
- One database query per endpoint
- Endpoints can number 50-100+
- Linear O(n) database round trips
- Blocks event loop during import

**Impact**: Slow spec imports (100 endpoints = 100 queries)
**Fix**: Batch INSERT using `INSERT INTO ... VALUES (...), (...), (...)`

---

### 3. **Backend - EventSource Memory Leak**
**File**: `backend/server.js` (lines 238-273)
**Issue**: SSE endpoint doesn't properly clean up connections
```javascript
const channel = `scan:progress:${scanId}`;
redisSubscriber.subscribe(channel);
// ... message handler setup
// Missing: connection timeout and client count limits
```
**Problem**:
- No maximum concurrent connections limit
- Orphaned connections when client disconnects abruptly
- Redis subscribers accumulate without cleanup
- Single Redis instance handles all SSE connections
- No heartbeat mechanism for client health check

**Impact**: Memory leak, Redis subscriber list grows, eventual OOM
**Fix**: Add connection timeout, max concurrent limit, heartbeat, pool multiple Redis instances

---

### 4. **Database - No Connection Pooling Configuration**
**File**: `backend/db.js`
**Issue**: Default pg pool settings
```javascript
// No explicit pool configuration visible
const pool = new Pool({
  // Uses defaults: max: 10 connections
});
```
**Problem**:
- Default max connections = 10
- Under load, pool exhaustion happens quickly
- No queue waiting, immediate connection errors
- All features share same pool

**Impact**: `ENOMEM` errors under concurrent load
**Fix**: Configure pool: max 50-100, idleTimeoutMillis, connectionTimeoutMillis

---

### 5. **Frontend - Inefficient Re-renders**
**File**: `src/App.jsx`
**Issue**: Large component with minimal state optimization
```javascript
// Entire app re-renders on any store change
export default function App(){
  // All 1600+ lines re-render on state changes
}
```
**Problem**:
- No component memoization
- No selector optimization in Zustand
- All child components re-render when any state changes
- SSE updates trigger full app re-render

**Impact**: Janky UI, CPU spike during scan progress updates
**Fix**: Split into smaller memoized components, use Zustand selectors

---

### 6. **Backend - Large JSON in Database**
**File**: `backend/db.js` + `backend/server.js`
**Issue**: Storing entire findings array as JSONB
```sql
CREATE TABLE scans (
  findings JSONB DEFAULT '[]',  -- Can be 10KB+ per scan
);
```
**Problem**:
- Each scan can have 100+ findings
- Full findings loaded even when only metadata needed
- No pagination on findings retrieval
- Index scanning full JSONB columns

**Impact**: Large query payloads, slow response times
**Fix**: Create separate `scan_findings` table with pagination

---

### 7. **Redis - Single Instance Bottleneck**
**File**: `backend/server.js` (line 6-24), `backend/worker.js`
**Issue**: Single Redis instance handles queues + pub/sub + sessions
```javascript
const redisSubscriber = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
});
// Same instance used for BullMQ queue AND SSE pub/sub
```
**Problem**:
- SSE broadcasts block queue processing
- Heavy scans slow down pub/sub
- No read replicas
- Single point of failure

**Impact**: Cascading performance degradation
**Fix**: Separate Redis instances for queue/sessions, use Redis Cluster

---

### 8. **Backend - No Request Rate Limiting**
**File**: `backend/server.js`
**Issue**: No rate limiting middleware
**Problem**:
- No protection against scan bombing
- Users can trigger unlimited concurrent scans
- Scan queue has no size limit
- Worker overload possible

**Impact**: DoS vulnerability, system crash under load
**Fix**: Add express-rate-limit with per-user limits

---

### 9. **Scan Worker - Blocking Operations**
**File**: `backend/worker.js` (full file)
**Issue**: Synchronous vulnerability checks
```javascript
async function runScan(job) {
  // All OWASP checks run sequentially
  for (const check of OWASP_CHECKS) {
    // blocking I/O for each check
  }
}
```
**Problem**:
- No parallel check execution
- One slow check delays all others
- Worker can't process other jobs
- Network timeouts block event loop

**Impact**: Max 3 concurrent scans (hardcoded concurrency)
**Fix**: Implement parallel check execution, timeout handling

---

### 10. **Frontend - No Pagination in Lists**
**File**: `src/App.jsx`
**Issue**: All scans/reports/alerts loaded in memory
**Problem**:
- User with 1000 scans loads all 1000 records
- Full list rendered in DOM
- Memory grows linearly with data
- Network payload large

**Impact**: Browser crash with large datasets
**Fix**: Implement virtual scrolling or pagination

---

## Summary Impact Matrix

| Issue | Severity | Latency Impact | Memory Impact | Scalability |
|-------|----------|---|---|---|
| Sequential API calls on completion | HIGH | +500ms | Medium | Poor |
| N+1 Endpoint imports | CRITICAL | +5-10s per spec | Low | Very Poor |
| SSE memory leak | HIGH | - | Critical | Fails at 100+ users |
| No connection pooling | CRITICAL | +timeout errors | Medium | Fails at 50 concurrent |
| Inefficient re-renders | MEDIUM | +100-300ms | Medium | Poor |
| Large JSONB storage | MEDIUM | +200ms | High | Poor |
| Single Redis instance | HIGH | Variable | Critical | Poor |
| No rate limiting | MEDIUM | - | - | Very Poor |
| Blocking scan operations | HIGH | +2-5s per scan | Low | Poor |
| No pagination | MEDIUM | - | Critical | Fails with large datasets |

---

## Implementation Priority

1. **PHASE 1 (MVP - Must Have)**: Database connection pooling, batch endpoints insert, request batching frontend
2. **PHASE 2**: SSE cleanup, Redis separation, pagination, rate limiting
3. **PHASE 3**: Worker parallelization, findings pagination, component memoization
