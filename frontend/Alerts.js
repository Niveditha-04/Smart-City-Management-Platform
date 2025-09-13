import React, { useEffect, useState } from "react";
import axios from "axios";

export default function Alerts() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState("low");
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");

  const loadAlerts = async () => {
    try {
      const res = await axios.get("http://localhost:5050/alerts");
      setAlerts(res.data.alerts || []);
      setError("");
    } catch (e) {
      console.error(e);
      setError("Failed to load alerts");
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

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please login first.");
        return;
      }
      const res = await axios.post("http://localhost:5050/alerts", {
        title,
        message,
        severity,
      });
      setAlerts((prev) => [res.data.alert, ...(prev || [])]);
      setTitle("");
      setMessage("");
      setSeverity("low");
    } catch (e) {
      console.error(e);
      setError("Failed to submit alert");
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "32px auto", padding: "0 16px" }}>
      <h2 style={{ marginBottom: 12 }}>Alerts</h2>

      <form onSubmit={submitAlert} style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Alert title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ display: "block", width: "100%", margin: "8px 0", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          required
        />
        <textarea
          placeholder="Alert message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{ display: "block", width: "100%", margin: "8px 0", padding: 10, borderRadius: 8, border: "1px solid #ccc", minHeight: 90 }}
          required
        />
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          style={{ display: "block", width: "100%", margin: "8px 0", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>

        <button type="submit" style={{ padding: "10px 16px", borderRadius: 8 }}>Submit Alert</button>
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
