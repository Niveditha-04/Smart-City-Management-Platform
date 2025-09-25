require("dotenv").config();

const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const webpush = require("web-push");
const { Resend } = require("resend");
const { pool } = require("./db");

// ==================== Auth helpers ====================
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

function auth(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });
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

// ==================== Web Push ====================
let vapidPublic = process.env.VAPID_PUBLIC_KEY || "";
let vapidPrivate = process.env.VAPID_PRIVATE_KEY || "";
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:no-reply@smartcity.com";

if (!vapidPublic || !vapidPrivate) {
  const keys = webpush.generateVAPIDKeys();
  vapidPublic = keys.publicKey;
  vapidPrivate = keys.privateKey;
  console.warn("[notifications] Using ephemeral VAPID keys (set VAPID_* in env).");
}
webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

// public key for frontend
router.get("/webpush/public-key", (_req, res) => {
  res.json({ publicKey: vapidPublic });
});

// subscribe (upsert)
router.post("/webpush/subscribe", auth, async (req, res) => {
  try {
    const sub = req.body || {};
    const { endpoint, keys = {} } = sub;
    if (!endpoint || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: "Invalid subscription" });
    }

    await pool.query(
      `INSERT INTO webpush_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (endpoint) DO UPDATE
         SET user_id=EXCLUDED.user_id, p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth`,
      [req.user.id, endpoint, keys.p256dh, keys.auth]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("[webpush.subscribe] error:", err);
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

// unsubscribe
router.post("/webpush/unsubscribe", auth, async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: "Missing endpoint" });
    await pool.query(
      "DELETE FROM webpush_subscriptions WHERE endpoint=$1 AND user_id=$2",
      [endpoint, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("[webpush.unsubscribe] error:", err);
    res.status(500).json({ error: "Failed to unsubscribe" });
  }
});


// POST /notifications/webpush/send
router.post(
  "/webpush/send",
  auth,
  requireRole("admin", "operator"),
  async (req, res) => {
    try {
      const {
        title,
        body = "",
        url = "/alerts",
        tag,
        // optional metadata to persist
        notification_id,
        alert_id = null,
        severity = "low",
        source = "alert",
        channel = "webpush",
      } = req.body || {};

      if (!title) return res.status(400).json({ error: "Missing title" });

      // 0) Ensure there is a notifications row
      let id = notification_id;
      if (!id) {
        const insert = await pool.query(
          `INSERT INTO notifications (title, message, severity, source, alert_id, channel, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,'queued', NOW())
           RETURNING id`,
          [title, body, severity, source, alert_id, channel]
        );
        id = insert.rows[0].id;
      }

      // 1) Load all current subscriptions
      const { rows } = await pool.query(
        "SELECT endpoint, p256dh, auth FROM webpush_subscriptions"
      );

      // 2) If none, mark and return (still recorded in DB)
      if (!rows.length) {
        await pool.query(
          `UPDATE notifications
             SET status = 'no_subscribers',
                 delivery_report = $2::jsonb,
                 sent_at = NOW()
           WHERE id = $1`,
          [id, JSON.stringify({ sent: 0, results: [] })]
        );
        return res.json({ ok: true, id, sent: 0, results: [] });
      }

      // 3) Send the push
      const payload = JSON.stringify({ title, body, url, tag });
      const results = await Promise.all(
        rows.map(async (r) => {
          const subscription = {
            endpoint: r.endpoint,
            keys: { p256dh: r.p256dh, auth: r.auth },
          };
          try {
            await webpush.sendNotification(subscription, payload);
            return { endpoint: r.endpoint, ok: true };
          } catch (e) {
            // clean up dead subscriptions
            if (e?.statusCode === 404 || e?.statusCode === 410) {
              await pool.query(
                "DELETE FROM webpush_subscriptions WHERE endpoint=$1",
                [r.endpoint]
              );
            }
            return {
              endpoint: r.endpoint,
              ok: false,
              error: e?.message || "send failed",
            };
          }
        })
      );

      const sent = results.filter((r) => r.ok).length;

      // 4) Persist delivery status & report
      await pool.query(
        `UPDATE notifications
           SET status = $2,
               delivery_report = $3::jsonb,
               sent_at = NOW()
         WHERE id = $1`,
        [id, sent > 0 ? "sent" : "failed", JSON.stringify({ sent, results })]
      );

      return res.json({ ok: true, id, sent, results });
    } catch (err) {
      console.error("[webpush.send] error:", err);
      return res.status(500).json({ error: "Failed to send push" });
    }
  }
);






// simple self-test (send to caller)
router.post("/webpush/test", auth, async (req, res) => {
  try {
    const { title = "Test Notification", body = "Hello from SmartCity", url = "/", tag = "test" } = req.body || {};
    const { rows } = await pool.query(
      "SELECT endpoint, p256dh, auth FROM webpush_subscriptions WHERE user_id=$1",
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "No subscriptions" });

    const payload = JSON.stringify({ title, body, url, tag });
    const results = await Promise.all(
      rows.map(async (r) => {
        const subscription = { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } };
        try {
          await webpush.sendNotification(subscription, payload);
          return { endpoint: r.endpoint, ok: true };
        } catch (e) {
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            await pool.query("DELETE FROM webpush_subscriptions WHERE endpoint=$1", [r.endpoint]);
          }
          return { endpoint: r.endpoint, ok: false, error: e?.message || "send failed" };
        }
      })
    );

    res.json({ ok: true, sent: results.filter((r) => r.ok).length, results });
  } catch (err) {
    console.error("[webpush.test] error:", err);
    res.status(500).json({ error: "Failed to send test push" });
  }
});

// optional: quick diagnostics (dev)
router.get("/webpush/mine", auth, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT endpoint, LEFT(p256dh,16) AS key_prefix, created_at FROM webpush_subscriptions WHERE user_id=$1 ORDER BY created_at DESC",
    [req.user.id]
  );
  res.json({ count: rows.length, rows });
});

// ==================== Email (Resend only) ====================
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM = process.env.RESEND_FROM || ""; // MUST be from your verified domain in Resend

if (!RESEND_API_KEY) console.warn("[email] RESEND_API_KEY not set. Email endpoints will return 503.");
if (!RESEND_FROM) console.warn("[email] RESEND_FROM not set. Email endpoints will return 503.");

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

async function sendWithResend({ to, subject, text, html, replyTo }) {
  if (!resend || !RESEND_FROM) {
    const err = new Error("Email service unavailable");
    err.status = 503;
    throw err;
  }
  const payload = { from: RESEND_FROM, to, subject };
  if (html) payload.html = html;
  if (text) payload.text = text;
  if (replyTo) payload.reply_to = replyTo; // e.g. "Your Name <you@gmail.com>"

  const { data, error } = await resend.emails.send(payload);
  if (error) {
    const e = new Error(error.message || "Resend send failed");
    e.status = 502;
    throw e;
  }
  return { id: data?.id || null };
}

// Send email (admin/operator). Accepts: { to? userId? subject, text|html, replyTo? }
router.post("/email/send", auth, requireRole("admin", "operator"), async (req, res) => {
  try {
    let { to, userId, subject, text, html, replyTo } = req.body || {};
    if (!RESEND_API_KEY || !RESEND_FROM) return res.status(503).json({ error: "Email service not configured" });
    if (!subject || (!text && !html)) return res.status(400).json({ error: "Missing subject or body" });

    if (!to) {
      const uid = Number.isFinite(+userId) ? Number(userId) : req.user.id;
      const u = await pool.query("SELECT email FROM users WHERE id=$1", [uid]);
      if (!u.rows.length) return res.status(404).json({ error: "User not found" });
      to = u.rows[0].email;
    }

    const result = await sendWithResend({ to, subject, text, html, replyTo });
    res.json({ ok: true, provider: "resend", id: result.id });
  } catch (err) {
    const code = err.status || 500;
    console.error("[email.send] error:", err.message || err);
    res.status(code).json({ error: "Failed to send email" });
  }
});

// Test email to caller (or explicit to)
router.post("/email/test", auth, async (req, res) => {
  try {
    const { to: toOverride, subject = "SmartCity test email", text = "Hello! This is a test email from SmartCity.", replyTo } = req.body || {};
    if (!RESEND_API_KEY || !RESEND_FROM) return res.status(503).json({ error: "Email service not configured" });

    let to = toOverride;
    if (!to) {
      const u = await pool.query("SELECT email FROM users WHERE id=$1", [req.user.id]);
      if (!u.rows.length) return res.status(404).json({ error: "User not found" });
      to = u.rows[0].email;
    }

    const result = await sendWithResend({ to, subject, text, replyTo });
    res.json({ ok: true, provider: "resend", id: result.id });
  } catch (err) {
    const code = err.status || 500;
    console.error("[email.test] error:", err.message || err);
    res.status(code).json({ error: "Failed to send email" });
  }
});

function buildUserWhere(userId) {
  // show personal + broadcast (user_id IS NULL)
  return {
    where: "(user_id = $1 OR user_id IS NULL)",
    params: [userId],
  };
}

// List (latest-first, paginated)
router.get("/", auth, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit || "5", 10)));
    const offset = Math.max(0, parseInt(req.query.offset || "0", 10));

    const { where, params } = buildUserWhere(req.user.id);

    const { rows: items } = await pool.query(
      `SELECT id, user_id, title, message, severity, is_read, created_at
         FROM notifications
        WHERE ${where}
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [...params, limit, offset]
    );

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE ${where}`,
      params
    );

    res.json({ items, total: count });
  } catch (err) {
    console.error("[notifications.list] error:", err);
    res.status(500).json({ error: "Failed to load notifications" });
  }
});

// Unread count (badge)
router.get("/unread-count", auth, async (req, res) => {
  try {
    const { where, params } = buildUserWhere(req.user.id);
    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*)::int AS count
         FROM notifications
        WHERE ${where} AND is_read = false`,
      params
    );
    res.json({ count });
  } catch (err) {
    console.error("[notifications.unread] error:", err);
    res.status(500).json({ error: "Failed to load unread count" });
  }
});

// Mark read (single or many)
router.post("/mark-read", auth, async (req, res) => {
  try {
    const { ids = [] } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids[] required" });
    }
    // Only mark rows visible to this user
    const { where, params } = buildUserWhere(req.user.id);
    const { rowCount } = await pool.query(
      `UPDATE notifications
          SET is_read = true
        WHERE id = ANY($1)
          AND (user_id = $2 OR user_id IS NULL)`,
      [ids, req.user.id]
    );
    res.json({ ok: true, updated: rowCount });
  } catch (err) {
    console.error("[notifications.mark-read] error:", err);
    res.status(500).json({ error: "Failed to mark read" });
  }
});

// Create (admin/operator) – broadcast if no userId provided
router.post("/notifications", auth, requireRole("admin", "operator"), async (req, res) => {
  try {
    const { userId, title, message, severity = "info" } = req.body || {};
    if (!title || !message) return res.status(400).json({ error: "Missing title/message" });

    if (Number.isFinite(+userId)) {
      const { rows } = await pool.query(
        `INSERT INTO notifications (user_id, title, message, severity)
         VALUES ($1,$2,$3,$4)
         RETURNING id`,
        [Number(userId), title, message, severity]
      );
      return res.json({ ok: true, id: rows[0].id, scope: "single" });
    }

    // broadcast: insert one row with user_id = NULL
    const { rows } = await pool.query(
      `INSERT INTO notifications (user_id, title, message, severity)
       VALUES (NULL, $1, $2, $3)
       RETURNING id`,
      [title, message, severity]
    );
    res.json({ ok: true, id: rows[0].id, scope: "broadcast" });
  } catch (err) {
    console.error("[notifications.create] error:", err);
    res.status(500).json({ error: "Failed to create notification" });
  }
});

module.exports = router;
