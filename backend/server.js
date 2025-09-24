// backend/server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { pool, ensureWeek4Schema } = require("./db");

const db = { query: (text, params) => pool.query(text, params) };

const app = express();
const notificationsRoutes = require("./notifications/notifications.routes");
const PORT = process.env.PORT || 5050;
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// Mount notifications (Twilio/Nodemailer/Web-Push)
app.use("/notifications", notificationsRoutes);

// ----- CORS / security / json -----
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim());

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // allow same-origin / curl
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error("CORS not allowed"));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(helmet());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // per-IP
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ----- helpers -----
function auth(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

// ----- health -----
app.get("/", (_req, res) => res.json({ ok: true }));

// ----- auth -----
app.post("/register", async (req, res) => {
  try {
    const { name, email, role = "viewer", password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }
    if (!["admin", "operator", "viewer"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const hash = await bcrypt.hash(password, 10);
    const q =
      "INSERT INTO users (name,email,role,password_hash) VALUES ($1,$2,$3,$4) RETURNING id,name,email,role,created_at";
    const { rows } = await db.query(q, [name, email, role, hash]);
    res.json({ user: rows[0] });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await db.query(
      "SELECT id,name,email,role,password_hash FROM users WHERE email=$1 LIMIT 1",
      [email]
    );
    if (!rows.length) return res.status(401).json({ error: "Invalid credentials" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ----- metrics (tiles) -----
app.get("/metrics/summary", (_req, res) => {
  res.json({
    traffic: 60 + Math.floor(Math.random() * 100), // 60–159
    airQuality: 80 + Math.floor(Math.random() * 100), // 80–179
    waste: 20 + Math.floor(Math.random() * 70), // 20–89
    electricity: 300 + Math.floor(Math.random() * 250), // 300–549
  });
});

// ----- metrics (charts from DB) -----
// Returns rows from metrics_timeseries seeded by ensureWeek4Schema (last 12h @ 10min)
app.get("/metrics/timeseries", async (req, res) => {
  try {
    // optional ?metric=traffic&since=2025-09-23T00:00:00Z
    const metric = (req.query.metric || "").toString().toLowerCase();
    const since = req.query.since ? new Date(req.query.since) : null;

    const allowed = ["traffic", "aqi", "waste", "power"];
    const where = [];
    const params = [];
    if (metric) {
      if (!allowed.includes(metric)) {
        return res.status(400).json({ error: "Unknown metric" });
      }
      params.push(metric);
      where.push(`metric = $${params.length}`);
    }
    if (since && !isNaN(since.valueOf())) {
      params.push(since.toISOString());
      where.push(`ts >= $${params.length}`);
    } else {
      // default: last 12 hours to keep payload small
      where.push(`ts >= NOW() - INTERVAL '12 hours'`);
    }
    const sql =
      "SELECT metric, value, ts FROM metrics_timeseries" +
      (where.length ? " WHERE " + where.join(" AND ") : "") +
      " ORDER BY ts ASC";

    const { rows } = await db.query(sql, params);
    res.json({ points: rows });
  } catch (err) {
    console.error("Timeseries error:", err);
    res.status(500).json({ error: "Failed to fetch timeseries" });
  }
});

/**
 * IMPORTANT:
 * We intentionally removed/disabled all code that referenced:
 *   - thresholds, alerts_breaches, alerts tables
 *   - background evaluator that queried thresholds
 * This keeps the server error-free with the new DB schema (users + metrics_timeseries only).
 */

// ----- start AFTER ensuring schema -----
ensureWeek4Schema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize DB schema:", err);
    process.exit(1);
  });
