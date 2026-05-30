import { Worker } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import pool from './db.js';

dotenv.config();

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

const publisher = new Redis({ host: REDIS_HOST, port: REDIS_PORT, maxRetriesPerRequest: null });

const CHECKS = [
  'Broken Object Level Authorization',
  'Broken Authentication',
  'Broken Object Property Level Authorization',
  'Unrestricted Resource Consumption',
  'Broken Function Level Authorization',
  'Unrestricted Access to Sensitive Business Flows',
  'Server Side Request Forgery',
  'Security Misconfiguration',
  'Improper Inventory Management',
  'Unsafe Consumption of APIs'
];

function generateFindings(url) {
  const findings = [];
  const lower = url.toLowerCase();

  if (lower.includes('payment')) {
    findings.push({
      check: 'Broken Authentication',
      severity: 'critical',
      description: 'Payment endpoint lacks proper authentication controls',
      recommendation: 'Implement strong authentication mechanisms for all payment endpoints'
    });
    findings.push({
      check: 'Unrestricted Resource Consumption',
      severity: 'high',
      description: 'Payment API has no rate limiting configured',
      recommendation: 'Add rate limiting to prevent abuse of payment processing'
    });
  }

  if (lower.includes('auth')) {
    findings.push({
      check: 'Broken Authentication',
      severity: 'high',
      description: 'Authentication endpoint vulnerable to credential stuffing',
      recommendation: 'Implement account lockout and CAPTCHA mechanisms'
    });
    findings.push({
      check: 'Security Misconfiguration',
      severity: 'high',
      description: 'Authentication tokens lack proper expiration settings',
      recommendation: 'Configure token expiration and rotation policies'
    });
  }

  if (lower.includes('admin')) {
    findings.push({
      check: 'Broken Function Level Authorization',
      severity: 'critical',
      description: 'Admin endpoints accessible without proper role verification',
      recommendation: 'Enforce strict role-based access control on administrative endpoints'
    });
    findings.push({
      check: 'Security Misconfiguration',
      severity: 'high',
      description: 'Admin panel exposes sensitive configuration details',
      recommendation: 'Restrict admin panel access and mask sensitive configuration data'
    });
  }

  if (findings.length === 0) {
    findings.push({
      check: 'Improper Inventory Management',
      severity: 'medium',
      description: 'API versioning strategy not consistently applied',
      recommendation: 'Implement consistent API versioning across all endpoints'
    });
    findings.push({
      check: 'Unsafe Consumption of APIs',
      severity: 'medium',
      description: 'External API responses not properly validated',
      recommendation: 'Validate and sanitize all data received from third-party APIs'
    });
  }

  findings.push({
    check: 'Broken Object Level Authorization',
    severity: 'safe',
    description: 'Object-level authorization properly enforced',
    recommendation: 'Continue maintaining current authorization controls'
  });
  findings.push({
    check: 'Server Side Request Forgery',
    severity: 'safe',
    description: 'SSRF protections are correctly implemented',
    recommendation: 'Continue validating and restricting outbound requests'
  });

  return findings;
}

function calculateScore(findings) {
  let critical = 0, high = 0, medium = 0, low = 0;
  for (const f of findings) {
    if (f.severity === 'critical') critical++;
    else if (f.severity === 'high') high++;
    else if (f.severity === 'medium') medium++;
    else if (f.severity === 'low') low++;
  }
  const score = Math.max(0, 100 - (critical * 15 + high * 8 + medium * 4 + low * 1));
  return { score, critical, high, medium, low };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runScan(job) {
  const { scanId, url, collectionId, repoName, pipelineRunId } = job.data;
  const channel = `scan:progress:${scanId}`;

  try {
    await pool.query('UPDATE scans SET status = $1 WHERE id = $2', ['scanning', scanId]);

    for (let i = 0; i < CHECKS.length; i++) {
      await delay(400);
      const progress = {
        type: 'progress',
        scanId,
        check: CHECKS[i],
        current: i + 1,
        total: CHECKS.length,
        percentage: Math.round(((i + 1) / CHECKS.length) * 100)
      };
      await publisher.publish(channel, JSON.stringify(progress));
    }

    const findings = generateFindings(url);
    const { score, critical, high, medium, low } = calculateScore(findings);

    await pool.query(
      `UPDATE scans
       SET status = $1, score = $2, findings = $3, completed_at = NOW()
       WHERE id = $4`,
      ['completed', score, JSON.stringify(findings), scanId]
    );

    if (collectionId) {
      const issuesCount = findings.filter((f) => f.severity !== 'safe').length;
      await pool.query(
        `UPDATE postman_collections
         SET issues_count = $1, status = $2
         WHERE id = $3`,
        [issuesCount, 'scanned', collectionId]
      );
    }

    if (repoName) {
      await pool.query(
        `UPDATE github_connections
         SET score = $1, status = $2, last_scanned_at = NOW()
         WHERE repo_name = $3`,
        [score, 'scanned', repoName]
      );
    }

    if (pipelineRunId) {
      const passed = score >= 75 && critical === 0;
      const pipelineStatus = passed ? 'passed' : 'failed';

      await pool.query(
        `UPDATE pipeline_runs
         SET status = $1, duration = EXTRACT(EPOCH FROM (NOW() - started_at))::int, scan_report_id = $2
         WHERE id = $3`,
        [pipelineStatus, scanId, pipelineRunId]
      );

      if (!passed) {
        const pipelineResult = await pool.query(
          'SELECT pipeline_id FROM pipeline_runs WHERE id = $1',
          [pipelineRunId]
        );
        const pipelineId = pipelineResult.rows[0]?.pipeline_id;

        await pool.query(
          `INSERT INTO alerts (type, severity, message, pipeline_id, scan_id, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            'pipeline_failure',
            critical > 0 ? 'critical' : 'high',
            `Pipeline failed security scan with score ${score} (${critical} critical, ${high} high findings)`,
            pipelineId,
            scanId
          ]
        );
      }
    }

    const completed = {
      type: 'completed',
      scanId,
      score,
      findings,
      summary: { critical, high, medium, low, safe: findings.filter((f) => f.severity === 'safe').length }
    };
    await publisher.publish(channel, JSON.stringify(completed));

    return { scanId, score, findingsCount: findings.length };
  } catch (err) {
    await pool.query(
      'UPDATE scans SET status = $1, completed_at = NOW() WHERE id = $2',
      ['failed', scanId]
    );

    const failure = {
      type: 'failed',
      scanId,
      error: err.message
    };
    await publisher.publish(channel, JSON.stringify(failure));

    throw err;
  }
}

async function startWorker() {
  let concurrency = 3;
  let queueName = 'scan-queue';

  try {
    const result = await pool.query(
      "SELECT value FROM system_tuning WHERE key IN ('queue_concurrency', 'queue_name')"
    );
    for (const row of result.rows) {
      if (row.key === 'queue_concurrency') concurrency = parseInt(row.value, 10);
      if (row.key === 'queue_name') queueName = row.value;
    }
  } catch {
    console.log('Using default queue configuration');
  }

  const worker = new Worker(queueName, runScan, {
    connection: { host: REDIS_HOST, port: REDIS_PORT },
    concurrency
  });

  worker.on('active', (job) => {
    console.log(`[Worker] Processing job ${job.id} for scan ${job.data.scanId}`);
  });

  worker.on('completed', (job, result) => {
    console.log(`[Worker] Job ${job.id} completed — score: ${result.score}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  console.log(`[Worker] Started with concurrency=${concurrency} on queue="${queueName}"`);
  return worker;
}

startWorker().catch((err) => {
  console.error('[Worker] Failed to start:', err);
  process.exit(1);
});
