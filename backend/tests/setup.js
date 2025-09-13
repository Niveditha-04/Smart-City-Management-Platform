require("dotenv").config();
const { ensureWeek4Schema, pool, db } = require("../app");

beforeAll(async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','operator','viewer')),
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await ensureWeek4Schema();
});

afterEach(async () => {
  await db.query("DELETE FROM alerts_breaches");
  await db.query("DELETE FROM users");
});

afterAll(async () => {
  await pool.end();
});
