import React, { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = (window.__API_URL__ || process.env.REACT_APP_API_URL || "http://localhost:5050").replace(/\/$/,"");

export default function Alerts() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState("low");
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const loadAlerts = async () => {
    try {
      const res = await axios.get(`${API_BASE}/alerts`);
      setAlerts(res.data.alerts || []);
      setError("");
    } catch (e) {
      // If 404 or network error, just show no alerts
      setAlerts([]);
      setError("");
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    loadAlerts();
  }, []);

  const submitAlert = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");
    try {
      const res = await axios.post(`${API_BASE}/alerts`, { title, message, severity });
      if (res.data && res.data.alert) {
        setOk("Alert submitted");
        setTitle("");
        setMessage("");
        setSeverity("low");
        await loadAlerts();
      } else {
        setError("Failed to submit alert");
      }
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.error || "Failed to submit alert");
    }
  };

  const input = { display: "block", width: "100%", margin: "8px 0", padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc" };

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <h2>Alerts</h2>
      <form onSubmit={submitAlert} style={{ border: "1px solid #eee", padding: 16, borderRadius: 12, marginBottom: 16 }}>
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={input} placeholder="e.g., High AQI in Sector 7" />
        <label>Message</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} style={{ ...input, minHeight: 80 }} placeholder="Short description" />
        <label>Severity</label>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={input}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <button type="submit" style={{ padding: "8px 14px", borderRadius: 8 }}>Submit Alert</button>
        {ok && <span style={{ marginLeft: 12, color: "green" }}>{ok}</span>}
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <h3>Recent Alerts</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {alerts.map((a) => (
          <li key={a.id} style={{ padding: "10px 12px", border: "1px solid #eee", borderRadius: 8, marginBottom: 10 }}>
            <strong>[{(a.severity || "").toUpperCase()}]</strong> {a.title} — {a.message}
            <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
              {a.created_at ? new Date(a.created_at).toLocaleString() : ""}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
