import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'apiguard',
  port: parseInt(process.env.DB_PORT || '5432'),
});

export const initDb = async () => {
  const client = await pool.connect();
  try {
    console.log('Running database migrations...');
    
    // Create Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Specs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS specs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Endpoints Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS endpoints (
        id SERIAL PRIMARY KEY,
        spec_id INTEGER REFERENCES specs(id) ON DELETE CASCADE,
        method VARCHAR(10) NOT NULL,
        path VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'safe',
        latency VARCHAR(50) DEFAULT '0ms',
        calls VARCHAR(50) DEFAULT '0'
      );
    `);

    // Create Scans Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS scans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        target_url VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL, -- 'endpoint', 'openapi', 'postman'
        status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'scanning', 'completed', 'failed'
        score INTEGER DEFAULT 100,
        findings JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Postman Collections Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS postman_collections (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        collection_uid VARCHAR(100) UNIQUE NOT NULL,
        requests_count INTEGER DEFAULT 0,
        issues_count INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'safe',
        last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create GitHub Connections Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS github_connections (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        repo_name VARCHAR(255) UNIQUE NOT NULL,
        branch VARCHAR(100) NOT NULL,
        prs_count INTEGER DEFAULT 0,
        issues_count INTEGER DEFAULT 0,
        score INTEGER DEFAULT 100,
        status VARCHAR(50) DEFAULT 'safe',
        last_scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Pipeline Runs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pipeline_runs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        repo VARCHAR(255) NOT NULL,
        branch VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL, -- 'pass', 'fail', 'running'
        duration VARCHAR(50) NOT NULL,
        commit_msg VARCHAR(255),
        commit_sha VARCHAR(100),
        triggered_by VARCHAR(100),
        scan_report_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Reports Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        scan_id INTEGER REFERENCES scans(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        file_size VARCHAR(50) NOT NULL,
        pages INTEGER DEFAULT 1,
        score INTEGER DEFAULT 100,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Alerts Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL, -- 'critical', 'high', 'medium', 'low', 'info'
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create System Tuning Settings Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_tuning (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL
      );
    `);

    console.log('Database tables verified.');

    // Seed default tuning settings
    await client.query(`
      INSERT INTO system_tuning (key, value)
      VALUES ('queue_config', '{"concurrency": 3, "max_retries": 3, "backoff_delay": 5000}')
      ON CONFLICT (key) DO NOTHING;
    `);

    // Seed a default user if none exists
    const usersCount = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(usersCount.rows[0].count) === 0) {
      console.log('Seeding default user...');
      const passwordHash = await bcrypt.hash('password123', 10);
      await client.query(`
        INSERT INTO users (name, email, password_hash)
        VALUES ('Kartikeya Shukla', 'kartikeya@trustlayerlabs.com', $1);
      `, [passwordHash]);
      console.log('Seeded default user: kartikeya@trustlayerlabs.com / password123');
    }
  } catch (err) {
    console.error('Migration error:', err);
    throw err;
  } finally {
    client.release();
  }
};

export default pool;
