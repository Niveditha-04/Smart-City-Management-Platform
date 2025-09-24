// backend/db.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: String(process.env.PGSSLMODE || '').toLowerCase() === 'require'
    ? { rejectUnauthorized: false }
    : false,
});

/**
 * Ensures schema and seeds sample data ONLY for:
 *  - users (admin/operator/viewer) with bcrypt hashes via pgcrypto
 *  - metrics_timeseries (for charts: traffic, aqi, waste, power)
 *
 * NOTE: No alerts / auto-alerts tables or seeds are created here.
 */
async function ensureWeek4Schema() {
  const sql = `
  
  -- 0) crypto for password hashing
  CREATE EXTENSION IF NOT EXISTS pgcrypto;

  -- 1) users
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','operator','viewer')),
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- 1.1) thresholds for auto-alert logic
  CREATE TABLE IF NOT EXISTS thresholds (
    metric TEXT PRIMARY KEY CHECK (metric IN ('traffic','aqi','waste','power')),
    warn NUMERIC NOT NULL,
    critical NUMERIC NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- 1.2) manual alerts created by users
  CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- 1.3) auto-detected breaches based on thresholds
  CREATE TABLE IF NOT EXISTS alerts_breaches (
    id SERIAL PRIMARY KEY,
    metric TEXT NOT NULL CHECK (metric IN ('traffic','aqi','waste','power')),
    value NUMERIC NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('warn','critical')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    acked_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
    acked_at TIMESTAMPTZ NULL
  );

-- 2) metrics time-series for charts
  --    store numeric values for each metric over time
  CREATE TABLE IF NOT EXISTS metrics_timeseries (
    id BIGSERIAL PRIMARY KEY,
    metric TEXT NOT NULL CHECK (metric IN ('traffic','aqi','waste','power')),
    value NUMERIC NOT NULL,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_metrics_timeseries_metric_ts
    ON metrics_timeseries (metric, ts DESC);

  -- 3) users seed (idempotent via email)
  -- admin: alice@example.com / secret123
  INSERT INTO users (name, email, role, password_hash)
  VALUES (
    'Alice',
    'alice@example.com',
    'admin',
    crypt('secret123', gen_salt('bf'))
  )
  ON CONFLICT (email) DO UPDATE
    SET name = EXCLUDED.name,
        role = EXCLUDED.role;

  -- operator: ops@example.com / operator123
  INSERT INTO users (name, email, role, password_hash)
  VALUES (
    'Ops',
    'ops@example.com',
    'operator',
    crypt('operator123', gen_salt('bf'))
  )
  ON CONFLICT (email) DO UPDATE
    SET name = EXCLUDED.name,
        role = EXCLUDED.role;

  -- viewer: viewer@example.com / viewer123
  INSERT INTO users (name, email, role, password_hash)
  VALUES (
    'Viewer',
    'viewer@example.com',
    'viewer',
    crypt('viewer123', gen_salt('bf'))
  )
  ON CONFLICT (email) DO UPDATE
    SET name = EXCLUDED.name,
        role = EXCLUDED.role;

  -- 4) Seed metrics for charts (only if empty)
  --    last 12 hours at 10-minute interval for each metric
  DO $$
  DECLARE
    has_rows boolean;
  BEGIN
    SELECT EXISTS (SELECT 1 FROM metrics_timeseries) INTO has_rows;
    IF NOT has_rows THEN
      INSERT INTO metrics_timeseries (metric, value, ts)
      SELECT m.metric,
             -- Generate semi-realistic values per metric with sinusoidal trend + noise
             CASE m.metric
               WHEN 'traffic' THEN round( (60 + 20 * sin(extract(epoch from g.ts)/1800.0) + (random()*10))::numeric, 2)
               WHEN 'aqi'     THEN round( (90 + 40 * sin(extract(epoch from g.ts)/2400.0) + (random()*20))::numeric, 2)
               WHEN 'waste'   THEN round( (55 + 25 * sin(extract(epoch from g.ts)/2000.0) + (random()*8))::numeric, 2)
               WHEN 'power'   THEN round( (75 + 15 * sin(extract(epoch from g.ts)/2100.0) + (random()*5))::numeric, 2)
               ELSE 0
             END AS value,
             g.ts
      FROM generate_series(
             NOW() - interval '12 hours',
             NOW(),
             interval '10 minutes'
           ) AS g(ts)
      CROSS JOIN (VALUES ('traffic'), ('aqi'), ('waste'), ('power')) AS m(metric);
    END IF;
  END $$;
  `;
  await pool.query(sql);
  console.log('[db] Users + metrics_timeseries ensured (no alerts seeded).');
}

module.exports = { pool, ensureWeek4Schema };
