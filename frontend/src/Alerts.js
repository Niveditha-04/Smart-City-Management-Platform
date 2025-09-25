// src/Alerts.js
import React, { useEffect, useState } from "react";
import axios from "axios";
import { enableNotifications, isSubscribed } from "./Notification"; // ensure file name matches exactly

const rawUrl = window.__API_URL__ || process.env.REACT_APP_API_URL || "";
const API_BASE = rawUrl.replace(/\/$/, "");

// Practical email regex (JS)
const EMAIL_REGEX = /^(?:[a-zA-Z0-9_'^&+%`{}~.-]+)@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

/* ---------------- Toast UI (no deps) ---------------- */
function Toast({ id, type = "info", msg, onDone, duration = 3000 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showT = setTimeout(() => setVisible(true), 10);
    const hideT = setTimeout(() => setVisible(false), duration);
    const removeT = setTimeout(() => onDone(id), duration + 220);
    return () => {
      clearTimeout(showT); clearTimeout(hideT); clearTimeout(removeT);
    };
  }, [id, duration, onDone]);

  const palette = {
    success: { bg: "#0f5132", border: "#badbcc" },
    error:   { bg: "#842029", border: "#f5c2c7" },
    info:    { bg: "#084298", border: "#b6d4fe" },
    warn:    { bg: "#664d03", border: "#ffecb5" },
  };
  const c = palette[type] || palette.info;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: c.bg,
        color: "#fff",
        border: `1px solid ${c.border}`,
        borderRadius: 10,
        padding: "10px 12px",
        minWidth: 240,
        maxWidth: 360,
        boxShadow: "0 6px 24px rgba(0,0,0,0.15)",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        transform: `translateY(${visible ? "0" : "10px"})`,
        opacity: visible ? 1 : 0,
        transition: "opacity .18s ease, transform .18s ease",
      }}
    >
      <div style={{ lineHeight: 1.3, flex: 1 }}>{msg}</div>
      <button
        onClick={() => { setVisible(false); setTimeout(() => onDone(id), 200); }}
        aria-label="Close notification"
        style={{
          background: "transparent", border: 0, color: "#fff",
          fontWeight: 700, fontSize: 16, cursor: "pointer", lineHeight: 1
        }}
      >
        ×
      </button>
    </div>
  );
}

function ToastHost({ toasts, remove }) {
  return (
    <div style={{
      position: "fixed", right: 16, bottom: 16,
      display: "flex", flexDirection: "column", gap: 10, zIndex: 9999
    }}>
      {toasts.map((t) => <Toast key={t.id} {...t} onDone={remove} />)}
    </div>
  );
}
/* -------------- End Toast UI ----------------------- */

export default function Alerts() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState("low");
  const [alerts, setAlerts] = useState([]);

  // form-level email (optional) – moved here from each alert line item
  const [notifyEmail, setNotifyEmail] = useState("");

  const [subbed, setSubbed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // toasts
  const [toasts, setToasts] = useState([]);
  const addToast = (msg, type = "info", duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, type, duration }]);
    return id;
  };
  const removeToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const token = localStorage.getItem("token") || "";

  const loadAlerts = async () => {
    try {
      const res = await axios.get(`${API_BASE}/alerts`);
      setAlerts(res.data.alerts || []);
    } catch {
      setAlerts([]);
      addToast("Failed to load alerts", "error");
    }
  };

  useEffect(() => {
    if (token) axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    isSubscribed().then(setSubbed).catch(() => setSubbed(false));
    loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensurePushReady = async () => {
    if (subbed) return true;
    try {
      await enableNotifications(token);
      setSubbed(true);
      addToast("Push enabled", "success");
      return true;
    } catch (e) {
      addToast(e?.message || "Failed to enable push notifications", "error");
      return false;
    }
  };

  // uses SAME API routes as before; called after alert is created
  const sendPushFor = async (alertObj) => {
    const ready = await ensurePushReady();
    if (!ready) return;

    const payload = {
      title: `[${(alertObj.severity || "").toUpperCase()}] ${alertObj.title}`,
      body: alertObj.message || "",
      url: "/alerts",
      tag: `alert-${alertObj.id}`,
    };

    try {
      await axios.post(`${API_BASE}/notifications/webpush/send`, payload);
    } catch (err) {
      if (err?.response?.status === 404) {
        await axios.post(`${API_BASE}/notifications/webpush/test`, payload);
      } else {
        throw err;
      }
    }
    addToast("Push sent", "success");
  };

  // uses SAME email routes; called if notifyEmail is non-empty & valid
  const sendEmailFor = async (alertObj, to) => {
    const subject = `[${(alertObj.severity || "").toUpperCase()}] ${alertObj.title}`;
    const text = `${alertObj.message || ""}\n\nCreated at: ${
      alertObj.created_at ? new Date(alertObj.created_at).toLocaleString() : "now"
    }`;

    try {
      await axios.post(`${API_BASE}/notifications/email/send`, { to, subject, text });
    } catch (err) {
      if (err?.response?.status === 404) {
        await axios.post(`${API_BASE}/notifications/email/test`, { to, subject, text });
      } else {
        throw err;
      }
    }
    addToast(`Email sent to ${to}`, "success");
  };

  const submitAlert = async (e) => {
    e.preventDefault();
    if (submitting) return;

    // Validate optional email
    const emailTrim = (notifyEmail || "").trim();
    if (emailTrim && !EMAIL_REGEX.test(emailTrim)) {
      addToast("Please enter a valid email address (or leave it empty).", "warn", 3500);
      return;
    }

    setSubmitting(true);
    try {
      // 1) Create alert (UNCHANGED route)
      const res = await axios.post(`${API_BASE}/alerts`, { title, message, severity });
      const created = res?.data?.alert;
      if (!created) throw new Error("Alert creation failed");

      addToast("Alert submitted", "success");

      // 2) Auto PUSH (UNCHANGED routes)
      try {
        await sendPushFor(created);
      } catch (ePush) {
        addToast(ePush?.response?.data?.error || ePush?.message || "Failed to send push", "error");
      }

      // 3) Optional EMAIL using SAME routes as before
      if (emailTrim) {
        try {
          await sendEmailFor(created, emailTrim);
        } catch (eMail) {
          addToast(eMail?.response?.data?.error || eMail?.message || "Failed to send email", "error");
        }
      }

      // Reset form and refresh list
      setTitle("");
      setMessage("");
      setSeverity("low");
      // keep the email in the field for convenience
      await loadAlerts();
    } catch (e2) {
      addToast(e2?.response?.data?.error || "Failed to submit alert", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const input = { display: "block", width: "100%", margin: "8px 0", padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc" };
  const muted = { color: "#666", fontSize: 12, marginTop: 4 };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* Toast host */}
      <ToastHost toasts={toasts} remove={removeToast} />

      <h2>Alerts</h2>

      <form onSubmit={submitAlert} style={{ border: "1px solid #eee", padding: 16, borderRadius: 12, marginBottom: 16 }}>
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={input} placeholder="e.g., High AQI in Sector 7" required />

        <label>Message</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} style={{ ...input, minHeight: 80 }} placeholder="Short description" required />

        <label>Severity</label>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={input}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>

        <label>Email (optional)</label>
        <input
          type="email"
          value={notifyEmail}
          onChange={(e) => setNotifyEmail(e.target.value)}
          style={{
            ...input,
            border: notifyEmail && !EMAIL_REGEX.test(notifyEmail) ? "1px solid #cc0000" : "1px solid #ccc",
          }}
          placeholder={user?.email ? `e.g., ${user.email}` : "recipient@example.com"}
        />
        {notifyEmail && !EMAIL_REGEX.test(notifyEmail) && (
          <div style={{ color: "#cc0000", fontSize: 12, marginTop: -4, marginBottom: 8 }}>
            Please enter a valid email address.
          </div>
        )}

        <button type="submit" style={{ padding: "8px 14px", borderRadius: 8 }} disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Alert"}
        </button>
      </form>

      <h3>Recent Alerts</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {alerts.map((a) => (
          <li key={a.id} style={{ padding: "12px 14px", border: "1px solid #eee", borderRadius: 8, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 260 }}>
                <div><strong>[{(a.severity || "").toUpperCase()}]</strong> {a.title} — {a.message}</div>
                <div style={muted}>{a.created_at ? new Date(a.created_at).toLocaleString() : ""}</div>
              </div>
            </div>
            {/* No per-alert email input or buttons here anymore */}
          </li>
        ))}
      </ul>
    </div>
  );
}

