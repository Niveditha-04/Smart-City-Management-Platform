import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import Dashboard from "./Dashboard";
import Alerts from "./Alerts";
import AutoAlerts from "./AutoAlerts";
import NotificationsBell from "./NotificationBell"; // <-- NEW

function ProtectedRoute({ children, roles }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/" replace />;

  if (roles && roles.length > 0) {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const role = user.role || "viewer";
    if (!roles.includes(role)) return <Navigate to="/dashboard" replace />;
  }
  return children;
}

// ---------- Nav ----------
function NavBar({ onLogout, authed, role }) {
  const showBell = authed && (role === "viewer" || role === "operator");

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: "1px solid #eee",
        position: "sticky",
        top: 0,
        background: "#fff",
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", gap: 16 }}>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/alerts">Alerts</Link>
        <Link to="/auto-alerts">Auto Alerts</Link>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {showBell && <NotificationsBell />}
        {authed && <span style={{ fontSize: 12, opacity: 0.7 }}>Role: {role}</span>}
        {authed && (
          <button onClick={onLogout} style={{ padding: "6px 10px" }}>
            Logout
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Login ----------
function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("secret123");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) nav("/dashboard", { replace: true });
  }, [nav]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/login`, { email, password });
      const { token, user } = res.data;

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user || {}));

      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      window.location.replace("/dashboard");
    } catch (err) {
      console.error("Login failed:", err?.response?.data || err.message);
      setError(
        err?.response?.data?.error
          ? `Login failed: ${err.response.data.error}`
          : "Login failed: Network/Error"
      );
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "120px auto", padding: "0 16px" }}>
      <h2 style={{ textAlign: "center", marginBottom: 20 }}>SmartCity Login</h2>
      <form onSubmit={handleLogin} style={{ display: "grid", gap: 12 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          required
        />
        <button type="submit" style={{ padding: 10, borderRadius: 8 }}>
          Login
        </button>
      </form>
      {error && <p style={{ color: "red", marginTop: 12 }}>{error}</p>}
    </div>
  );
}

// ---------- App ----------
export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem("token"));
  const [role, setRole] = useState(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    return u.role || "viewer";
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    else delete axios.defaults.headers.common["Authorization"];
  }, [authed]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    delete axios.defaults.headers.common["Authorization"];
    setAuthed(false);
    setRole("viewer");
    window.location.replace("/");
  };

  useEffect(() => {
    const onStorage = () => {
      setAuthed(!!localStorage.getItem("token"));
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      setRole(u.role || "viewer");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <BrowserRouter>
      <NavBar authed={authed} role={role} onLogout={handleLogout} />
      <Routes>
        <Route path="/" element={<Login />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/alerts"
          element={
            <ProtectedRoute>
              <Alerts />
            </ProtectedRoute>
          }
        />

        <Route
          path="/auto-alerts"
          element={
            <ProtectedRoute>
              <AutoAlerts />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
