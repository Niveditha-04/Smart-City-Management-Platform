const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : false,
});

async function ensureWeek4Schema() {
  const sql = `
  -- 1) base tables needed by the rest
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','operator','viewer')),
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- 2) thresholds per metric
  CREATE TABLE IF NOT EXISTS thresholds (
    id SERIAL PRIMARY KEY,
    metric TEXT NOT NULL CHECK (metric IN ('traffic','aqi','waste','power')),
    warn NUMERIC NOT NULL,
    critical NUMERIC NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(metric)
  );

  -- 3) auto-generated breaches when thresholds are crossed
  CREATE TABLE IF NOT EXISTS alerts_breaches (
    id SERIAL PRIMARY KEY,
    metric TEXT NOT NULL CHECK (metric IN ('traffic','aqi','waste','power')),
    value NUMERIC NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('warn','critical')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    acked_by INTEGER REFERENCES users(id),
    acked_at TIMESTAMPTZ
  );

  -- 4) seed thresholds once
  INSERT INTO thresholds (metric, warn, critical) VALUES
    ('traffic', 70, 90),
    ('aqi', 100, 200),
    ('waste', 75, 90),
    ('power', 80, 95)
  ON CONFLICT (metric) DO NOTHING;
  `;
  await pool.query(sql);
  console.log("[db] Week4 schema ensured.");
}

module.exports = { pool, ensureWeek4Schema };

