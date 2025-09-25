import React, { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";

const PAGE_SIZE = 5;
const rawUrl = window.__API_URL__ || process.env.REACT_APP_API_URL || "";
const API_BASE = rawUrl.replace(/\/$/, "");

// scoped axios with auth once
const api = axios.create({ baseURL: API_BASE });

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [badge, setBadge] = useState(0);

  const panelRef = useRef(null);
  const btnRef   = useRef(null);

  // guards
  const mounted  = useRef(false);
  const inFlight = useRef(false);
  const badgePollId = useRef(null);
  const badgeLastAt = useRef(0);
  const pageAbort = useRef(null);

  // ----- setup auth on first mount -----
  useEffect(() => {
    mounted.current = true;
    const token = localStorage.getItem("token") || "";
    if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    return () => { mounted.current = false; };
  }, []);

  // ----- cancel helper -----
  const cancelPageReq = () => {
    if (pageAbort.current) {
      pageAbort.current.abort();
      pageAbort.current = null;
    }
  };

  // ----- load a page (throttled, single-flight, cancelable) -----
  const fetchPage = useCallback(async (nextOffset = 0) => {
    if (!mounted.current || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);

    cancelPageReq();
    const ac = new AbortController();
    pageAbort.current = ac;

    try {
      const res = await api.get("/notifications", {
        params: { limit: PAGE_SIZE, offset: nextOffset },
        signal: ac.signal,
      });
      if (!mounted.current) return;

      const pageItems = res.data?.items ?? [];
      console.log(res.data);
      const t = res.data?.total ?? 0;

      if (nextOffset === 0) setItems(pageItems);
      else setItems(prev => [...prev, ...pageItems]);

      setTotal(t);
      setOffset(nextOffset + (pageItems.length || 0));
    } catch (e) {
      if (e.name !== "CanceledError" && e.message !== "canceled") {
        // keep state stable on error
        // console.error("notifications.load", e?.response?.data || e.message);
      }
    } finally {
      if (mounted.current) setLoading(false);
      inFlight.current = false;
      pageAbort.current = null;
    }
  }, []);

  const hasMore = items.length < total;

  // ----- badge polling: paused while open or tab hidden -----
  const refreshBadge = useCallback(async () => {
    if (!mounted.current) return;
    if (open) return; // pause while panel open
    if (document.visibilityState === "hidden") return;

    // throttle to >= 20s between calls
    const now = Date.now();
    if (now - badgeLastAt.current < 20000) return;
    badgeLastAt.current = now;

    try {
      const res = await api.get("/notifications/unread-count");
      if (mounted.current) setBadge(res.data?.count || 0);
    } catch {
      // ignore
    }
  }, [open]);

  // start/stop interval safely (avoid StrictMode duplicates)
  const startBadgePoll = useCallback(() => {
    if (badgePollId.current) return;
    // call once immediately
    refreshBadge();
    badgePollId.current = setInterval(refreshBadge, 30000);
  }, [refreshBadge]);

  const stopBadgePoll = useCallback(() => {
    if (badgePollId.current) {
      clearInterval(badgePollId.current);
      badgePollId.current = null;
    }
  }, []);

  useEffect(() => {
    // visibility-aware polling
    const onVis = () => {
      if (document.visibilityState === "visible" && !open) {
        startBadgePoll();
      } else {
        stopBadgePoll();
      }
    };
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stopBadgePoll();
    };
  }, [open, startBadgePoll, stopBadgePoll]);

  // open/close logic
  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      // pause polling and load first page fresh, cancel any in-flight
      stopBadgePoll();
      setOffset(0);
      cancelPageReq();
      fetchPage(0);
    } else {
      // resume polling on close
      startBadgePoll();
    }
  };

  // close on outside / ESC
  useEffect(() => {
    const onDocClick = (e) => {
      if (!open) return;
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) {
        toggleOpen();
      }
    };
    const onEsc = (e) => e.key === "Escape" && open && toggleOpen();
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const refreshFirstPage = () => {
    if (!open) return;
    setOffset(0);
    fetchPage(0);
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={btnRef}
        onClick={toggleOpen}
        aria-label="Notifications"
        style={{
          position: "relative",
          border: "1px solid #ddd",
          background: "#fff",
          borderRadius: 8,
          padding: "6px 10px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer"
        }}
      >
        {/* Bell */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 1 0-14 0v5l-2 2v1h18v-1l-2-2Z"
            stroke="#444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* Badge */}
        <span
          style={{
            minWidth: 18,
            height: 18,
            lineHeight: "18px",
            fontSize: 12,
            borderRadius: 9,
            background: badge > 0 ? "#e53935" : "#f0f0f0",
            color: badge > 0 ? "#fff" : "#666",
            textAlign: "center",
            padding: "0 6px"
          }}
        >
          {badge}
        </span>
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 360,
            maxHeight: 420,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            overflow: "hidden",
            zIndex: 1000
          }}
        >
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #eee", fontWeight: 600 }}>
            Notifications
          </div>

          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {items.length === 0 && !loading && (
              <div style={{ padding: 16, color: "#777" }}>No notifications</div>
            )}
            {items.map((n) => (
              <div key={n.id} style={{ padding: "10px 12px", borderBottom: "1px solid #f4f4f4" }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{n.title}</div>
                <div style={{ fontSize: 13, color: "#444" }}>{n.message}</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
                  {new Date(n.created_at).toLocaleString()} {n.severity && `· ${n.severity}`}
                </div>
              </div>
            ))}
            {loading && <div style={{ padding: 12, fontSize: 13, color: "#666" }}>Loading…</div>}
          </div>

          <div style={{ padding: 8, borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
            <button
              onClick={refreshFirstPage}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", background: "#fff" }}
              disabled={loading}
            >
              Refresh
            </button>
            <button
              onClick={() => fetchPage(offset)}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", background: "#fff" }}
              disabled={!hasMore || loading}
              title={hasMore ? "" : "No more"}
            >
              Show more
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

