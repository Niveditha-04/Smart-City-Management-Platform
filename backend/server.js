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
const PORT = process.env.PORT || 5050;
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

/**
 * Allow your Render FE + localhost. Set CORS_ORIGIN in Render like:
 * "https://smart-city-management-platform.onrender.com,http://localhost:3000"
 */
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// If you ever set cookies over a proxy/CDN (Render), keep this:
app.set("trust proxy", 1);

// ---- CORS FIRST, before everything else ----
const corsOptions = {
  origin(origin, cb) {
    // no Origin (e.g. curl, server-to-server) -> allow
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("CORS: origin not allowed"));
  },
  credentials: true, // ok even if you don't use cookies; harmless
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

// Make sure preflights always succeed fast
app.options("*", cors(corsOptions));

// ---- Body + security ----
app.use(express.json());
// Keep helmet after CORS so the CORS headers aren’t interfered with
app.use(
  helmet({
    // If you ever embed cross-origin resources and see COEP/COOP issues,
    // you can relax these, but defaults are fine for a pure JSON API.
    // crossOriginEmbedderPolicy: false,
    // crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Don’t rate-limit CORS preflights
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === "OPTIONS",
  })
);

// --------------------- Notifications (Twilio / Nodemailer / Web-Push) -----
const notificationsRoutes = require("./notifications.routes");
app.use("/notifications", notificationsRoutes);

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

// ----- metrics -----
app.get("/metrics/summary", (_req, res) => {
  res.json({
    traffic: 60 + Math.floor(Math.random() * 100),
    airQuality: 80 + Math.floor(Math.random() * 100),
    waste: 20 + Math.floor(Math.random() * 70),
    electricity: 300 + Math.floor(Math.random() * 250),
  });
});

// ----- thresholds -----
app.get("/thresholds", auth, async (_req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT metric, warn, critical, updated_at FROM thresholds ORDER BY metric"
    );
    res.json({ thresholds: rows });
  } catch (err) {
    console.error("Get thresholds error:", err);
    res.status(500).json({ error: "Failed to fetch thresholds" });
  }
});

app.put("/thresholds/:metric", auth, requireRole("admin"), async (req, res) => {
  try {
    const metric = String(req.params.metric || "").toLowerCase();
    const { warn, critical } = req.body;

    if (!["traffic", "aqi", "waste", "power"].includes(metric)) {
      return res.status(400).json({ error: "Unknown metric" });
    }
    if (warn == null || critical == null) {
      return res.status(400).json({ error: "Missing warn or critical" });
    }
    if (Number(warn) >= Number(critical)) {
      return res.status(400).json({ error: "warn must be < critical" });
    }

    const { rows } = await db.query(
      `INSERT INTO thresholds (metric, warn, critical, updated_at)
       VALUES ($1,$2,$3,NOW())
       ON CONFLICT (metric)
       DO UPDATE SET warn=EXCLUDED.warn, critical=EXCLUDED.critical, updated_at=NOW()
       RETURNING metric, warn, critical, updated_at`,
      [metric, warn, critical]
    );
    res.json({ threshold: rows[0] });
  } catch (err) {
    console.error("Update threshold error:", err);
    res.status(500).json({ error: "Failed to update threshold" });
  }
});

// ----- auto alert breaches -----
app.get("/alerts/breaches", auth, async (req, res) => {
  try {
    const status = (req.query.status || "all").toLowerCase();
    let sql =
      "SELECT id, metric, value, severity, message, created_at, acked_by, acked_at FROM alerts_breaches";
    if (status === "active") sql += " WHERE acked_at IS NULL";
    sql += " ORDER BY created_at DESC LIMIT 100";
    const { rows } = await db.query(sql);
    res.json({ breaches: rows });
  } catch (err) {
    console.error("List breaches error:", err);
    res.status(500).json({ error: "Failed to fetch breaches" });
  }
});

app.post(
  "/alerts/breaches/:id/ack",
  auth,
  requireRole("operator", "admin"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { rows } = await db.query(
        `UPDATE alerts_breaches
         SET acked_by=$1, acked_at=NOW()
         WHERE id=$2 AND acked_at IS NULL
         RETURNING id, metric, severity, acked_by, acked_at`,
        [req.user.id, id]
      );
      if (!rows.length) return res.status(404).json({ error: "Already acked or not found" });
      res.json({ ok: true, breach: rows[0] });
    } catch (err) {
      console.error("Ack breach error:", err);
      res.status(500).json({ error: "Failed to ack breach" });
    }
  }
);

// ----- background evaluator -----
const EVAL_EVERY_MS = 15_000;

async function evaluateAndInsertBreaches() {
  try {
    const { rows: ths } = await db.query("SELECT metric, warn, critical FROM thresholds");
    const map = {};
    for (const t of ths) map[t.metric] = { warn: Number(t.warn), critical: Number(t.critical) };

    const current = {
      traffic: 60 + Math.floor(Math.random() * 100),
      aqi: 80 + Math.floor(Math.random() * 100),
      waste: 20 + Math.floor(Math.random() * 70),
      power: 80 + Math.floor(Math.random() * 20) + 20,
    };

    const checks = [
      { metric: "traffic", value: current.traffic },
      { metric: "aqi", value: current.aqi },
      { metric: "waste", value: current.waste },
      { metric: "power", value: current.power },
    ];

    for (const c of checks) {
      const th = map[c.metric];
      if (!th) continue;

      let severity = null;
      if (c.value >= th.critical) severity = "critical";
      else if (c.value >= th.warn) severity = "warn";
      if (!severity) continue;

      const message = `${c.metric.toUpperCase()} ${severity.toUpperCase()} — value=${c.value}, thresholds warn=${th.warn}, critical=${th.critical}`;

      const { rows: recent } = await db.query(
        `SELECT id FROM alerts_breaches
         WHERE metric=$1 AND severity=$2 AND created_at >= NOW() - INTERVAL '5 minutes'
         ORDER BY created_at DESC LIMIT 1`,
        [c.metric, severity]
      );
      if (recent.length) continue;

      await db.query(
        `INSERT INTO alerts_breaches (metric, value, severity, message)
         VALUES ($1,$2,$3,$4)`,
        [c.metric, c.value, severity, message]
      );
    }
  } catch (err) {
    console.error("Evaluator error:", err);
  }
}

// ----- manual alerts -----
app.get("/alerts", async (_req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT id,title,message,severity,created_at FROM alerts ORDER BY created_at DESC LIMIT 50"
    );
    res.json({ alerts: rows });
  } catch (err) {
    console.error("List alerts error:", err);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

app.post("/alerts", auth, async (req, res) => {
  try {
    const { title, message, severity = "low" } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: "Missing title or message" });
    }

    const { rows } = await db.query(
      "INSERT INTO alerts (title,message,severity,created_at) VALUES ($1,$2,$3,NOW()) RETURNING id,title,message,severity,created_at",
      [title, message, severity]
    );
    res.json({ alert: rows[0] });
  } catch (err) {
    console.error("Create alert error:", err);
    res.status(500).json({ error: "Failed to create alert" });
  }
});

// ---- last: error handlers (important for CORS) ----
app.use((err, req, res, _next) => {
  if (err && /CORS/i.test(err.message)) {
    // Make failures explicit instead of showing 500 in the browser console
    res.setHeader("Vary", "Origin");
    return res.status(403).json({ error: "CORS blocked for this origin" });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// ----- start after schema -----
ensureWeek4Schema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`);
      setInterval(evaluateAndInsertBreaches, EVAL_EVERY_MS);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize DB schema:", err);
    process.exit(1);
  });
