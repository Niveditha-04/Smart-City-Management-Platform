import React, { useEffect, useState } from "react";

const rawUrl = window.__API_URL__ || process.env.REACT_APP_API_URL || "";
const API_BASE = rawUrl.replace(/\/$/, "");

export default function AutoAlerts() {
  const [breaches, setBreaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // derive role once from localStorage
  const userRole = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}").role || "viewer";
    } catch {
      return "viewer";
    }
  })();

  // canAck is derived, no extra state needed
  const canAck = userRole === "operator" || userRole === "admin";

  async function fetchBreaches() {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/alerts/breaches?status=active`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        setError("Unauthorized (401). Please log in again.");
        setBreaches([]);
        return;
      }

      if (res.status === 404) {
        setBreaches([]);
        setError("");
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`Failed: ${res.status}`);

      const data = await res.json();
      setBreaches(data.breaches || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function ack(id) {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/alerts/breaches/${id}/ack`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        alert("Unauthorized (401). Please log in again.");
        return;
      }

      if (!res.ok) {
        const txt = await res.text();
        alert(`Ack failed: ${res.status}\n${txt}`);
        return;
      }

      await fetchBreaches();
    } catch (e) {
      alert("Ack error: " + e.message);
    }
  }

  useEffect(() => {
    fetchBreaches();
    const t = setInterval(fetchBreaches, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1>Auto Alerts</h1>
      <button onClick={fetchBreaches} style={{ marginBottom: 12 }}>
        Refresh
      </button>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "crimson" }}>Failed: {error}</p>}
      {!loading && breaches.length === 0 && <p>No active breaches.</p>}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {breaches.map((b) => (
          <li
            key={b.id}
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 8,
              background: b.severity === "critical" ? "#ffe3e3" : "#fff7d6",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <strong>[{b.severity.toUpperCase()}] {b.metric.toUpperCase()}</strong>
              <div style={{ fontSize: 14, opacity: 0.8 }}>{b.message}</div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>
                Created: {new Date(b.created_at).toLocaleString()}
              </div>
            </div>
            {canAck && <button onClick={() => ack(b.id)}>Ack</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
