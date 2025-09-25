// backend/db.js
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    String(process.env.PGSSLMODE || "").toLowerCase() === "require"
      ? { rejectUnauthorized: false }
      : false,
});

pool.on("error", (err) => {
  console.error("[db] Unexpected error on idle client", err);
});

/**
 * Ensures schema and seeds sample data ONLY for:
 *  - users (admin/operator/viewer) with bcrypt hashes via pgcrypto
 *  - thresholds / alerts / alerts_breaches
 *  - metrics_timeseries (traffic, aqi, waste, power)
 *  - webpush_subscriptions for Push API device endpoints
 *  - notifications (NEW) for in-app/user notifications list
 */
async function ensureWeek4Schema() {
  const sql = `
  -- 0) crypto for password hashing
  CREATE EXTENSION IF NOT EXISTS pgcrypto;

  -- 1) users
  CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','operator','viewer')),
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- thresholds for auto-alert logic
  CREATE TABLE IF NOT EXISTS public.thresholds (
    metric TEXT PRIMARY KEY CHECK (metric IN ('traffic','aqi','waste','power')),
    warn NUMERIC NOT NULL,
    critical NUMERIC NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- manual alerts created by users (system-wide)
  CREATE TABLE IF NOT EXISTS public.alerts (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- auto-detected breaches based on thresholds
  CREATE TABLE IF NOT EXISTS public.alerts_breaches (
    id SERIAL PRIMARY KEY,
    metric TEXT NOT NULL CHECK (metric IN ('traffic','aqi','waste','power')),
    value NUMERIC NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('warn','critical')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    acked_by INTEGER NULL REFERENCES public.users(id) ON DELETE SET NULL,
    acked_at TIMESTAMPTZ NULL
  );

  -- 2) metrics time-series
  CREATE TABLE IF NOT EXISTS public.metrics_timeseries (
    id BIGSERIAL PRIMARY KEY,
    metric TEXT NOT NULL CHECK (metric IN ('traffic','aqi','waste','power')),
    value NUMERIC NOT NULL,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_metrics_timeseries_metric_ts
    ON public.metrics_timeseries (metric, ts DESC);

  -- 2b) Push API subscriptions (DEVICE endpoints per user)
  CREATE TABLE IF NOT EXISTS public.webpush_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_webpush_user_id ON public.webpush_subscriptions(user_id);

  -- 2c) (NEW) In-app notifications (MESSAGE rows shown in UI)
  CREATE TABLE IF NOT EXISTS public.notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NULL REFERENCES public.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON public.notifications (user_id, created_at DESC);

  -- 3) seed thresholds once
  INSERT INTO public.thresholds (metric, warn, critical) VALUES
    ('traffic', 70, 90),
    ('aqi', 100, 200),
    ('waste', 75, 90),
    ('power', 80, 95)
  ON CONFLICT (metric) DO NOTHING;

  -- 4) users seed (idempotent via email)
  -- admin: admin@example.com / secret123
  INSERT INTO public.users (name, email, role, password_hash)
  VALUES ('admin', 'admin@example.com', 'admin', crypt('secret123', gen_salt('bf')))
  ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role;

  -- operator: ops@example.com / operator123
  INSERT INTO public.users (name, email, role, password_hash)
  VALUES ('Ops', 'ops@example.com', 'operator', crypt('operator123', gen_salt('bf')))
  ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role;

  -- viewer: viewer@example.com / viewer123
  INSERT INTO public.users (name, email, role, password_hash)
  VALUES ('Viewer', 'viewer@example.com', 'viewer', crypt('viewer123', gen_salt('bf')))
  ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role;

  -- 5) Seed metrics for charts (only if empty)
  DO $$
  DECLARE has_rows boolean;
  BEGIN
    SELECT EXISTS (SELECT 1 FROM public.metrics_timeseries) INTO has_rows;
    IF NOT has_rows THEN
      INSERT INTO public.metrics_timeseries (metric, value, ts)
      SELECT m.metric,
             CASE m.metric
               WHEN 'traffic' THEN round( (60 + 20 * sin(extract(epoch from g.ts)/1800.0) + (random()*10))::numeric, 2)
               WHEN 'aqi'     THEN round( (90 + 40 * sin(extract(epoch from g.ts)/2400.0) + (random()*20))::numeric, 2)
               WHEN 'waste'   THEN round( (55 + 25 * sin(extract(epoch from g.ts)/2000.0) + (random()*8))::numeric, 2)
               WHEN 'power'   THEN round( (75 + 15 * sin(extract(epoch from g.ts)/2100.0) + (random()*5))::numeric, 2)
               ELSE 0
             END AS value,
             g.ts
      FROM generate_series(NOW() - interval '12 hours', NOW(), interval '10 minutes') AS g(ts)
      CROSS JOIN (VALUES ('traffic'), ('aqi'), ('waste'), ('power')) AS m(metric);
    END IF;
  END $$;

  -- 6) Seed a welcome notification if none exist
  DO $$
  DECLARE has_notifs boolean;
  BEGIN
    SELECT EXISTS (SELECT 1 FROM public.notifications) INTO has_notifs;
    IF NOT has_notifs THEN
      INSERT INTO public.notifications (user_id, title, message, severity)
      VALUES
        (NULL, 'Welcome', 'Notifications are live. This is a global message.', 'low'),
        ((SELECT id FROM public.users WHERE email='alice@example.com'), 'System Ready', 'Backend connected to database.', 'low');
    END IF;
  END $$;
  `;
  await pool.query(sql);
  console.log("[db] Schema ensured and seeds applied (users/thresholds/alerts/metrics/webpush/notifications).");
}

module.exports = { pool, ensureWeek4Schema };
