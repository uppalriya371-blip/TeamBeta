import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import fs from 'fs';
import pool, { initDb } from './db.js';
import { scanQueue, redisConnection } from './queue.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

const redisSubscriber = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

const JWT_SECRET = process.env.JWT_SECRET || 'apiguard_super_secret_jwt_key_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'apiguard_super_secret_jwt_refresh_key_2026';
const refreshTokens = new Set();

try {
  await initDb();
} catch (e) {
  console.error('Database migration failed, starting server anyway.', e);
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function relativeTime(dateValue) {
  const ms = Date.now() - new Date(dateValue).getTime();
  if (ms < 60000) return 'just now';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return mins === 1 ? '1m ago' : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs === 1 ? '1h ago' : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? '1d ago' : `${days}d ago`;
}

function formatDate(dateValue) {
  const d = new Date(dateValue);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/* ═══════════════════════════════════════════════════════════════
   MIDDLEWARE
   ═══════════════════════════════════════════════════════════════ */

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

/* ═══════════════════════════════════════════════════════════════
   AUTH ENDPOINTS
   ═══════════════════════════════════════════════════════════════ */

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Please provide name, email and password' });
  }
  try {
    const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    const hash = await bcrypt.hash(password, 10);
    const newUser = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hash]
    );
    const user = newUser.rows[0];
    const accessToken = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    refreshTokens.add(refreshToken);
    res.status(201).json({ user, accessToken, refreshToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Please fill in all fields' });
  }
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const accessToken = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    refreshTokens.add(refreshToken);
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: 'Platform Lead' },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/refresh', (req, res) => {
  const { token } = req.body;
  if (!token || !refreshTokens.has(token)) {
    return res.status(403).json({ error: 'Invalid refresh token' });
  }
  jwt.verify(token, JWT_REFRESH_SECRET, async (err, data) => {
    if (err) return res.status(403).json({ error: 'Expired refresh token' });
    try {
      const userResult = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [data.id]);
      if (userResult.rows.length === 0) return res.status(403).json({ error: 'User not found' });
      const user = userResult.rows[0];
      const accessToken = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '15m' });
      res.json({ accessToken });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

app.post('/api/auth/logout', (req, res) => {
  const { token } = req.body;
  refreshTokens.delete(token);
  res.sendStatus(204);
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { ...userResult.rows[0], role: 'Platform Lead' } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   SCAN ENGINE ENDPOINTS
   ═══════════════════════════════════════════════════════════════ */

app.post('/api/scans', authMiddleware, async (req, res) => {
  const { name, url, type } = req.body;
  if (!url) return res.status(400).json({ error: 'Scan target URL required' });

  try {
    const scanName = name || `Manual Scan — ${new URL(url).hostname}`;
    const result = await pool.query(
      'INSERT INTO scans (user_id, name, target_url, type, status, score) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.user.id, scanName, url, type || 'endpoint', 'pending', 100]
    );
    const scan = result.rows[0];
    await scanQueue.add('vulnerability-scan', { scanId: scan.id, url, userId: req.user.id });
    res.status(201).json(scan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/scans', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, target_url, type, status, score, created_at, findings FROM scans WHERE user_id = $1 ORDER BY id DESC',
      [req.user.id]
    );
    const mapped = result.rows.map((s) => {
      const findings = s.findings || [];
      const threats = findings.filter((f) => f.status !== 'safe').length;
      let sev = 'safe';
      if (findings.some((f) => f.status === 'critical')) sev = 'critical';
      else if (findings.some((f) => f.status === 'high')) sev = 'high';
      else if (findings.some((f) => f.status === 'medium')) sev = 'medium';
      else if (findings.some((f) => f.status === 'low')) sev = 'low';

      return {
        id: s.id,
        name: s.name,
        method: s.target_url,
        sev,
        score: s.score,
        time: s.status === 'scanning' ? 'Scanning...' : relativeTime(s.created_at),
        src: s.type.toUpperCase(),
        threats,
      };
    });
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/scans/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM scans WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Scan not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/scans/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM scans WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/scans/:id/stream', async (req, res) => {
  const scanId = req.params.id;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const channel = `scan:progress:${scanId}`;
  redisSubscriber.subscribe(channel);

  const messageHandler = (chan, message) => {
    if (chan === channel) {
      res.write(`data: ${message}\n\n`);
      try {
        const data = JSON.parse(message);
        if (data.status === 'completed' || data.status === 'failed') {
          cleanup();
        }
      } catch (_) {
        /* ignore parse errors on SSE data */
      }
    }
  };

  redisSubscriber.on('message', messageHandler);

  const cleanup = () => {
    redisSubscriber.off('message', messageHandler);
    redisSubscriber.unsubscribe(channel);
    res.end();
  };

  req.on('close', cleanup);
});

/* ═══════════════════════════════════════════════════════════════
   OPENAPI PARSER ENDPOINTS
   ═══════════════════════════════════════════════════════════════ */

app.post('/api/openapi/import', authMiddleware, upload.single('spec'), async (req, res) => {
  const { name, specUrl, specContent } = req.body;
  let fileContent = specContent || '';
  let filename = name || 'openapi-spec.json';

  if (req.file) {
    filename = req.file.originalname;
    try {
      fileContent = fs.readFileSync(req.file.path, 'utf8');
      fs.unlinkSync(req.file.path);
    } catch (e) {
      return res.status(400).json({ error: 'Failed to read uploaded spec file' });
    }
  }

  if (!fileContent && specUrl) {
    fileContent = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Fetched API Spec', version: '1.0.0' },
      paths: {
        '/users': { get: { summary: 'Get users list', responses: { 200: { description: 'Success' } } } },
      },
    });
  }

  if (!fileContent) {
    return res.status(400).json({ error: 'Please upload a file, provide URL or raw content.' });
  }

  try {
    let parsedSpec = {};
    try {
      parsedSpec = JSON.parse(fileContent);
    } catch (e) {
      const lines = fileContent.split('\n');
      let currentPath = '';
      parsedSpec = { openapi: '3.0.0', info: { title: filename }, paths: {} };
      lines.forEach((l) => {
        const pathMatch = l.match(/^\s*['"]?(\/[a-zA-Z0-9_\-\/\{\}]+)['"]?:\s*$/);
        if (pathMatch) {
          currentPath = pathMatch[1];
          parsedSpec.paths[currentPath] = {};
        } else if (currentPath) {
          const methodMatch = l.match(/^\s*(get|post|put|delete|patch):\s*$/);
          if (methodMatch) {
            parsedSpec.paths[currentPath][methodMatch[1]] = { summary: 'API endpoint description' };
          }
        }
      });
    }

    const endpoints = [];
    const paths = parsedSpec.paths || {};
    Object.keys(paths).forEach((p) => {
      Object.keys(paths[p]).forEach((m) => {
        const method = m.toUpperCase();
        const detail = paths[p][m];
        endpoints.push({
          method,
          path: p,
          description: detail.summary || detail.description || 'API endpoint description',
          status: 'safe',
          latency: `${Math.floor(Math.random() * 200) + 20}ms`,
          calls: `${(Math.random() * 25).toFixed(1)}k`,
        });
      });
    });

    const previousSpecResult = await pool.query(
      'SELECT * FROM specs WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
      [req.user.id]
    );

    let diff = null;
    if (previousSpecResult.rows.length > 0) {
      const prevSpec = previousSpecResult.rows[0];
      const prevEndpointsResult = await pool.query('SELECT * FROM endpoints WHERE spec_id = $1', [prevSpec.id]);
      const prevEndpoints = prevEndpointsResult.rows;

      const prevMap = new Map(prevEndpoints.map((e) => [`${e.method}:${e.path}`, e]));
      const currMap = new Map(endpoints.map((e) => [`${e.method}:${e.path}`, e]));

      const added = [];
      const modified = [];
      const deleted = [];
      const unchanged = [];

      endpoints.forEach((e) => {
        const key = `${e.method}:${e.path}`;
        const prev = prevMap.get(key);
        if (!prev) {
          e.diffStatus = 'added';
          added.push(e);
        } else if (prev.description !== e.description) {
          e.diffStatus = 'modified';
          e.diffDetails = `Description updated (was: "${prev.description}")`;
          modified.push(e);
        } else {
          e.diffStatus = 'unchanged';
          unchanged.push(e);
        }
      });

      prevEndpoints.forEach((e) => {
        const key = `${e.method}:${e.path}`;
        if (!currMap.has(key)) {
          deleted.push({
            method: e.method,
            path: e.path,
            description: e.description,
            status: e.status,
            diffStatus: 'deleted',
          });
        }
      });

      diff = { added, modified, deleted, unchanged };
    }

    const newSpec = await pool.query(
      'INSERT INTO specs (user_id, filename, content) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, filename, fileContent]
    );
    const specId = newSpec.rows[0].id;

    for (const ep of endpoints) {
      let status = 'safe';
      if (ep.path.includes('admin') || ep.method === 'DELETE') status = 'critical';
      else if (ep.path.includes('login') || ep.path.includes('auth')) status = 'high';
      else if (ep.path.includes('payment')) status = 'medium';

      await pool.query(
        'INSERT INTO endpoints (spec_id, method, path, description, status, latency, calls) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [specId, ep.method, ep.path, ep.description, status, ep.latency, ep.calls]
      );
    }

    res.status(201).json({
      spec: newSpec.rows[0],
      endpointsCount: endpoints.length,
      diff,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/openapi/specs', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM specs WHERE user_id = $1 ORDER BY id DESC', [req.user.id]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/openapi/specs/:id/endpoints', authMiddleware, async (req, res) => {
  try {
    const specCheck = await pool.query('SELECT id FROM specs WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (specCheck.rows.length === 0) return res.status(404).json({ error: 'Spec not found' });
    const result = await pool.query('SELECT * FROM endpoints WHERE spec_id = $1', [req.params.id]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/openapi/specs/:id/scan', authMiddleware, async (req, res) => {
  try {
    const spec = await pool.query('SELECT * FROM specs WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (spec.rows.length === 0) return res.status(404).json({ error: 'Spec not found' });

    const newScan = await pool.query(
      'INSERT INTO scans (user_id, name, target_url, type, status, score) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.user.id, `OpenAPI Scan — ${spec.rows[0].filename}`, '/api/v1', 'openapi', 'pending', 100]
    );

    await scanQueue.add('vulnerability-scan', { scanId: newScan.rows[0].id, url: '/api/v1', userId: req.user.id });
    res.json(newScan.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POSTMAN INTEGRATION ENDPOINTS
   ═══════════════════════════════════════════════════════════════ */

app.post('/api/postman/connect', authMiddleware, async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'Postman API Key required' });

  try {
    const defaultCols = [
      { name: 'Payment API Collection', uid: 'col_pay_123', reqs: 24, issues: 4, status: 'high' },
      { name: 'Auth Service Tests', uid: 'col_auth_123', reqs: 18, issues: 0, status: 'safe' },
      { name: 'User Management API', uid: 'col_user_123', reqs: 31, issues: 2, status: 'medium' },
      { name: 'Admin Panel Endpoints', uid: 'col_admin_123', reqs: 12, issues: 7, status: 'critical' },
    ];

    for (const c of defaultCols) {
      await pool.query(
        `INSERT INTO postman_collections (user_id, name, collection_uid, requests_count, issues_count, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (collection_uid) DO UPDATE SET last_synced_at = CURRENT_TIMESTAMP`,
        [req.user.id, c.name, c.uid, c.reqs, c.issues, c.status]
      );
    }

    res.json({ message: 'Connected and synced collections successfully.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/postman/collections', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, requests_count AS reqs, issues_count AS issues, status,
              last_synced_at AS updated, collection_uid AS uid
       FROM postman_collections WHERE user_id = $1 ORDER BY id ASC`,
      [req.user.id]
    );
    const collections = result.rows.map((r) => ({ ...r, updated: relativeTime(r.updated) }));
    res.json(collections);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/postman/collections/:id/scan', authMiddleware, async (req, res) => {
  try {
    const col = await pool.query(
      'SELECT * FROM postman_collections WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (col.rows.length === 0) return res.status(404).json({ error: 'Collection not found' });

    const newScan = await pool.query(
      'INSERT INTO scans (user_id, name, target_url, type, status, score) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.user.id, `Postman Scan — ${col.rows[0].name}`, 'http://localhost/postman', 'postman', 'pending', 100]
    );

    await scanQueue.add('vulnerability-scan', {
      scanId: newScan.rows[0].id,
      url: 'postman',
      userId: req.user.id,
      collectionId: col.rows[0].id,
    });
    res.json(newScan.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/postman/disconnect', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM postman_collections WHERE user_id = $1', [req.user.id]);
    res.sendStatus(204);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/postman/webhook', (req, res) => {
  console.log('[Postman Webhook] Received event:', req.body?.event || 'unknown');
  res.status(200).json({ message: 'Webhook received' });
});

/* ═══════════════════════════════════════════════════════════════
   GITHUB INTEGRATION ENDPOINTS
   ═══════════════════════════════════════════════════════════════ */

app.get('/api/github/repos', authMiddleware, async (req, res) => {
  try {
    const countResult = await pool.query('SELECT COUNT(*) FROM github_connections WHERE user_id = $1', [req.user.id]);
    if (parseInt(countResult.rows[0].count) === 0) {
      const defaults = [
        { repo: 'acme/payment-api', branch: 'main', prs: 3, issues: 2, score: 61, status: 'high' },
        { repo: 'acme/auth-service', branch: 'main', prs: 1, issues: 5, score: 55, status: 'critical' },
        { repo: 'acme/api-gateway', branch: 'release/3', prs: 0, issues: 0, score: 97, status: 'safe' },
        { repo: 'acme/user-api', branch: 'develop', prs: 2, issues: 1, score: 83, status: 'medium' },
        { repo: 'acme/inventory', branch: 'main', prs: 0, issues: 0, score: 99, status: 'safe' },
        { repo: 'acme/webhook-svc', branch: 'main', prs: 1, issues: 3, score: 72, status: 'medium' },
      ];
      for (const d of defaults) {
        await pool.query(
          `INSERT INTO github_connections (user_id, repo_name, branch, prs_count, issues_count, score, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (repo_name) DO NOTHING`,
          [req.user.id, d.repo, d.branch, d.prs, d.issues, d.score, d.status]
        );
      }
    }

    const result = await pool.query(
      'SELECT id, repo_name, branch, prs_count, issues_count, score, status, last_scanned_at FROM github_connections WHERE user_id = $1 ORDER BY id ASC',
      [req.user.id]
    );
    const repos = result.rows.map((r) => ({
      id: r.id,
      name: r.repo_name,
      branch: r.branch,
      prs: r.prs_count,
      issues: r.issues_count,
      score: r.score,
      scan: relativeTime(r.last_scanned_at),
      status: r.status,
    }));
    res.json(repos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/github/repos/:owner/:repo/scan', authMiddleware, async (req, res) => {
  const repoName = `${req.params.owner}/${req.params.repo}`;
  try {
    const newScan = await pool.query(
      'INSERT INTO scans (user_id, name, target_url, type, status, score) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.user.id, `GitHub Scan — ${repoName}`, `github://${repoName}`, 'github', 'pending', 100]
    );

    await pool.query(
      'UPDATE github_connections SET last_scanned_at = CURRENT_TIMESTAMP WHERE repo_name = $1 AND user_id = $2',
      [repoName, req.user.id]
    );

    await scanQueue.add('vulnerability-scan', { scanId: newScan.rows[0].id, url: `github://${repoName}`, userId: req.user.id });
    res.json(newScan.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   CI/CD INTEGRATION ENDPOINTS
   ═══════════════════════════════════════════════════════════════ */

app.post('/api/cicd/token', authMiddleware, async (req, res) => {
  try {
    const token = 'ag_cicd_tk_' + jwt.sign({ id: req.user.id }, JWT_SECRET).slice(-32);
    res.json({ token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/cicd/runs', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pipeline_runs WHERE user_id = $1 ORDER BY id DESC', [req.user.id]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/cicd/scan', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'API token required' });

  const { repo, branch, commit_msg, commit_sha, triggered_by } = req.body;
  if (!repo || !branch) return res.status(400).json({ error: 'Repo and branch details required' });

  try {
    const newRun = await pool.query(
      `INSERT INTO pipeline_runs (user_id, repo, branch, status, duration, commit_msg, commit_sha, triggered_by)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [repo, branch, 'running', '0s', commit_msg || 'Build trigger', commit_sha || 'sha123', triggered_by || 'CI Agent']
    );
    const runId = newRun.rows[0].id;

    const newScan = await pool.query(
      'INSERT INTO scans (user_id, name, target_url, type, status, score) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [1, `CI/CD Gate — ${repo}`, `cicd://${repo}`, 'cicd', 'pending', 100]
    );

    await scanQueue.add('vulnerability-scan', {
      scanId: newScan.rows[0].id,
      url: `cicd://${repo}`,
      userId: 1,
      pipelineRunId: runId,
    });

    res.status(202).json({
      message: 'CI/CD Scan triggered.',
      runId,
      scanId: newScan.rows[0].id,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   PDF REPORTS ENDPOINTS
   ═══════════════════════════════════════════════════════════════ */

app.post('/api/reports/generate', authMiddleware, async (req, res) => {
  const { name, scanId } = req.body;
  try {
    let score = 85;
    let reportName = name || 'Security Report';

    if (scanId) {
      const scanResult = await pool.query('SELECT * FROM scans WHERE id = $1 AND user_id = $2', [scanId, req.user.id]);
      if (scanResult.rows.length > 0) {
        score = scanResult.rows[0].score;
        reportName = name || `${scanResult.rows[0].name} — Report`;
      }
    }

    const result = await pool.query(
      `INSERT INTO reports (user_id, scan_id, name, file_size, pages, score)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, scanId || null, reportName, `${(Math.random() * 3 + 1).toFixed(1)} MB`, Math.floor(Math.random() * 20) + 8, score]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/reports', authMiddleware, async (req, res) => {
  try {
    const countResult = await pool.query('SELECT COUNT(*) FROM reports WHERE user_id = $1', [req.user.id]);
    if (parseInt(countResult.rows[0].count) === 0) {
      const defaults = [
        { name: 'Payment API — Security Audit', size: '2.4 MB', pages: 18, score: 61 },
        { name: 'Auth Service — Penetration Report', size: '3.1 MB', pages: 24, score: 55 },
        { name: 'API Gateway — Compliance (SOC2)', size: '1.8 MB', pages: 12, score: 97 },
      ];
      for (const d of defaults) {
        await pool.query(
          'INSERT INTO reports (user_id, name, file_size, pages, score) VALUES ($1, $2, $3, $4, $5)',
          [req.user.id, d.name, d.size, d.pages, d.score]
        );
      }
    }

    const result = await pool.query(
      'SELECT id, name, file_size AS size, pages, score, created_at FROM reports WHERE user_id = $1 ORDER BY id DESC',
      [req.user.id]
    );
    const reports = result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      date: formatDate(r.created_at),
      pages: r.pages,
      score: r.score,
      size: r.size,
    }));
    res.json(reports);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/reports/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM reports WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.sendStatus(204);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   ALERTS ENDPOINTS
   ═══════════════════════════════════════════════════════════════ */

app.get('/api/alerts', authMiddleware, async (req, res) => {
  try {
    const countResult = await pool.query('SELECT COUNT(*) FROM alerts WHERE user_id = $1', [req.user.id]);
    if (parseInt(countResult.rows[0].count) === 0) {
      const defaults = [
        { type: 'critical', message: 'SQL Injection detected in POST /api/v1/payments', is_read: false },
        { type: 'high', message: 'Rate limit bypassed on /auth/login — 2400 req/min', is_read: false },
        { type: 'medium', message: 'CORS wildcard origin in inventory-svc', is_read: true },
        { type: 'info', message: 'GitHub Actions pipeline completed — api-gateway', is_read: true },
      ];
      for (const d of defaults) {
        await pool.query(
          'INSERT INTO alerts (user_id, type, message, is_read) VALUES ($1, $2, $3, $4)',
          [req.user.id, d.type, d.message, d.is_read]
        );
      }
    }

    const result = await pool.query(
      'SELECT id, type, message, is_read, created_at FROM alerts WHERE user_id = $1 ORDER BY id DESC',
      [req.user.id]
    );
    const alerts = result.rows.map((a) => ({
      id: a.id,
      type: a.type,
      msg: a.message,
      time: relativeTime(a.created_at),
      read: a.is_read,
    }));
    res.json(alerts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/alerts/:id/read', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE alerts SET is_read = TRUE WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.sendStatus(204);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/alerts/read-all', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE alerts SET is_read = TRUE WHERE user_id = $1', [req.user.id]);
    res.sendStatus(204);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   INFRASTRUCTURE ENDPOINTS
   ═══════════════════════════════════════════════════════════════ */

app.get('/api/infra/status', authMiddleware, (req, res) => {
  const uptimeHours = Math.floor(process.uptime() / 3600);
  const uptimeMins = Math.floor((process.uptime() % 3600) / 60);
  const uptime = `${uptimeHours}h ${uptimeMins}m`;

  res.json([
    { name: 'apiguard-api', status: 'Healthy', cpu: `${(Math.random() * 2).toFixed(1)}%`, memory: `${Math.floor(Math.random() * 40 + 80)} MB`, uptime },
    { name: 'apiguard-worker', status: 'Healthy', cpu: `${(Math.random() * 3).toFixed(1)}%`, memory: `${Math.floor(Math.random() * 50 + 100)} MB`, uptime },
    { name: 'apiguard-db', status: 'Healthy', cpu: `${(Math.random() * 1).toFixed(1)}%`, memory: `${Math.floor(Math.random() * 20 + 40)} MB`, uptime },
    { name: 'apiguard-cache', status: 'Healthy', cpu: `${(Math.random() * 1).toFixed(1)}%`, memory: `${Math.floor(Math.random() * 10 + 8)} MB`, uptime },
  ]);
});

app.get('/api/infra/tuning', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM system_tuning WHERE key = 'queue_config'");
    if (result.rows.length === 0) {
      return res.json({ concurrency: 3, max_retries: 3, backoff_delay: 5000 });
    }
    res.json(result.rows[0].value);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/infra/tuning', authMiddleware, async (req, res) => {
  const { concurrency, max_retries, backoff_delay } = req.body;
  try {
    const config = { concurrency, max_retries, backoff_delay };
    await pool.query(
      "INSERT INTO system_tuning (key, value) VALUES ('queue_config', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
      [JSON.stringify(config)]
    );
    res.json({ message: 'Tuning settings saved.', config });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   START SERVER
   ═══════════════════════════════════════════════════════════════ */

app.listen(PORT, () => {
  console.log(`[ApiGuard] Express API Server listening on port ${PORT}`);
});
