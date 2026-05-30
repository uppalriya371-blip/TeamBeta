import { Worker } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import pool from './db.js';

dotenv.config();

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379');

// Redis publisher client for scan updates
const redisPublisher = new Redis({
  host: redisHost,
  port: redisPort,
});

const CHECKS = [
  "Broken Object Level Authentication",
  "Broken User Authentication",
  "Excessive Data Exposure",
  "Lack of Resources & Rate Limiting",
  "Broken Function Level Authentication",
  "Mass Assignment Vulnerability",
  "Security Misconfiguration",
  "Injection Flaws (SQLi/NoSQLi)",
  "Improper Assets Management",
  "Insufficient Logging & Monitoring"
];

// Helper to wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const runScan = async (job) => {
  const { scanId, url, userId, collectionId, repoName, pipelineRunId } = job.data;
  console.log(`[Worker] Starting scan job ${job.id} for ScanID ${scanId} (Target: ${url})`);

  try {
    // 1. Update status in database to 'scanning'
    await pool.query("UPDATE scans SET status = 'scanning' WHERE id = $1", [scanId]);

    // 2. Simulate 10 security checks
    for (let i = 0; i < CHECKS.length; i++) {
      await sleep(400); // simulate delay per check
      const progress = Math.round(((i + 1) / CHECKS.length) * 100);
      
      const progressPayload = {
        scanId,
        status: 'scanning',
        progress,
        currentCheck: CHECKS[i]
      };

      // Publish progress to Redis pub/sub
      await redisPublisher.publish(`scan:progress:${scanId}`, JSON.stringify(progressPayload));
      console.log(`[Worker] Scan ${scanId} Progress: ${progress}% - Check: ${CHECKS[i]}`);
    }

    // 3. Compute simulated scan findings based on target URL/context
    const findings = [];
    let critical = 0, high = 0, medium = 0, low = 0;

    if (url.includes('pay') || url.includes('payment') || url.includes('checkout')) {
      findings.push({ check: "Broken Object Level Auth", status: "critical", detail: "Object ID manipulation exposes payment transactions on PUT /api/v1/payments", fix: "Enforce ownership validation check before database mutation." });
      findings.push({ check: "TLS Configuration", status: "low", detail: "TLS 1.1 enabled on checkout gateway", fix: "Disable TLS 1.0/1.1; enforce TLS 1.2 or 1.3 minimum." });
      critical += 1; low += 1;
    }
    if (url.includes('auth') || url.includes('login') || url.includes('oauth') || url.includes('postman')) {
      findings.push({ check: "Rate Limiting", status: "high", detail: "No request throttling on /api/auth/login allows password brute-forcing", fix: "Implement request rate-limiter middleware on authentication endpoints." });
      findings.push({ check: "Input Validation", status: "medium", detail: "JSON injection vulnerability in auth request payload", fix: "Implement strict JSON schema validation for all parameters." });
      high += 1; medium += 1;
    }
    if (url.includes('admin') || url.includes('delete') || url.includes('github') || url.includes('cicd')) {
      findings.push({ check: "Broken Function Level Auth", status: "critical", detail: "Admin user deletion DELETE /api/admin/users accessible without auth headers", fix: "Verify authorization role claims in JWT verify middleware." });
      findings.push({ check: "Excessive Data Exposure", status: "high", detail: "Sensitive configuration fields and DB password returned in GET /api/infra/status response payload", fix: "Filter API response objects to sanitize config variables." });
      critical += 1; high += 1;
    }

    // Default baseline checks if nothing triggered
    if (findings.length === 0) {
      findings.push({ check: "CORS Policy", status: "medium", detail: "Wildcard origin (*) allowed on resource endpoints", fix: "Restrict Allowed-Origins header to trusted domain list." });
      findings.push({ check: "Security Headers", status: "low", detail: "X-Frame-Options and Content-Security-Policy headers missing", fix: "Configure helmet.js middleware in Express app server." });
      medium += 1; low += 1;
    }

    // Add 2 clean checks
    findings.push({ check: "JSON Web Token (JWT) Security", status: "safe", detail: "JWT signature verified, strong HS256 algorithm enforced", fix: null });
    findings.push({ check: "Vulnerability Scanning", status: "safe", detail: "No SQL injection detected in endpoints during scan", fix: null });

    // Calculate score
    const score = Math.max(0, 100 - (critical * 15 + high * 8 + medium * 4 + low * 1));

    // 4. Update scan in DB with completed status
    await pool.query(
      "UPDATE scans SET status = 'completed', score = $1, findings = $2 WHERE id = $3",
      [score, JSON.stringify(findings), scanId]
    );

    // 5. Update Postman Collection status if triggered from Postman
    if (collectionId) {
      let status = 'safe';
      if (critical > 0) status = 'critical';
      else if (high > 0) status = 'high';
      else if (medium > 0) status = 'medium';

      await pool.query(`
        UPDATE postman_collections 
        SET issues_count = $1, status = $2, last_synced_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [critical + high + medium + low, status, collectionId]);
    }

    // 6. Update GitHub repo connection if triggered from GitHub
    if (repoName) {
      let status = 'safe';
      if (critical > 0) status = 'critical';
      else if (high > 0) status = 'high';
      else if (medium > 0) status = 'medium';

      await pool.query(`
        UPDATE github_connections 
        SET score = $1, status = $2, last_scanned_at = CURRENT_TIMESTAMP
        WHERE repo_name = $3
      `, [score, status, repoName]);
    }

    // 7. Update CI/CD Pipeline run status if triggered from CI pipeline
    if (pipelineRunId) {
      // Security Gate exit code 2 logic: fail pipeline if score is below 75 or critical issues exist
      const runStatus = (score < 75 || critical > 0) ? 'fail' : 'pass';
      const duration = `${Math.floor(Math.random() * 20) + 10}s`;

      await pool.query(`
        UPDATE pipeline_runs 
        SET status = $1, duration = $2, scan_report_id = $3
        WHERE id = $4
      `, [runStatus, duration, scanId, pipelineRunId]);

      // If failed, insert alert into Alerts table
      if (runStatus === 'fail') {
        const pipelineResult = await pool.query('SELECT repo, branch FROM pipeline_runs WHERE id = $1', [pipelineRunId]);
        const run = pipelineResult.rows[0];
        
        await pool.query(`
          INSERT INTO alerts (user_id, type, message)
          VALUES ($1, $2, $3)
        `, [userId || 1, 'critical', `CI/CD Security Gate failed on ${run.repo} (${run.branch}) — Score ${score}/100. Build blocked.`]);
      }
    }

    // Publish completed payload
    const finalPayload = {
      scanId,
      status: 'completed',
      progress: 100,
      score,
      findings
    };
    await redisPublisher.publish(`scan:progress:${scanId}`, JSON.stringify(finalPayload));
    console.log(`[Worker] Completed scan job ${job.id} with score ${score}`);

  } catch (err) {
    console.error(`[Worker] Job error on scan ${scanId}:`, err);
    await pool.query("UPDATE scans SET status = 'failed' WHERE id = $1", [scanId]);
    await redisPublisher.publish(`scan:progress:${scanId}`, JSON.stringify({ scanId, status: 'failed', error: err.message }));
  }
};

// Start the worker inside an async block to fetch queue config from database
const startWorker = async () => {
  let concurrency = 3;
  let attempts = 3;
  let backoffDelay = 5000;

  try {
    const configResult = await pool.query("SELECT value FROM system_tuning WHERE key = 'queue_config'");
    if (configResult.rows.length > 0) {
      const config = configResult.rows[0].value;
      concurrency = parseInt(config.concurrency || 3);
      attempts = parseInt(config.max_retries || 3);
      backoffDelay = parseInt(config.backoff_delay || 5000);
      console.log(`[Worker] Concurrency settings loaded from database: concurrency=${concurrency}, attempts=${attempts}, backoffDelay=${backoffDelay}`);
    }
  } catch (e) {
    console.log('[Worker] Database tuning settings not yet available, falling back to default concurrency = 3.');
  }

  const worker = new Worker('scan-queue', runScan, {
    connection: redisPublisher, // reuse redis connection
    concurrency,
    limiter: {
      max: 10,
      duration: 1000
    }
  });

  worker.on('active', (job) => {
    console.log(`[Worker] Job ${job.id} became active`);
  });

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err);
  });

  console.log(`[Worker] Scan Engine Worker started. Concurrency thread count: ${concurrency}`);
};

startWorker();
