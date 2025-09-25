import axios from "axios";

const API_BASE = (window.__API_URL__ || process.env.REACT_APP_API_URL || "http://localhost:5050").replace(/\/$/, "");

// ---------- helpers ----------
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function ensureServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Worker not supported in this browser.");
  }
  // Reuse existing reg if present; otherwise register
  const existing = await navigator.serviceWorker.getRegistration();
  return existing || navigator.serviceWorker.register("/sw.js");
}

async function getPublicVapidKey(token) {
  const { data } = await axios.get(`${API_BASE}/notifications/webpush/public-key`, {
    headers: authHeaders(token),
  });
  if (!data?.publicKey) throw new Error("Failed to fetch VAPID public key.");
  return data.publicKey;
}

// ---------- exported API ----------
/**
 * Ask permission, register SW, subscribe, and upsert the subscription on the server.
 */
export async function enableNotifications(token) {
  if (!("PushManager" in window)) {
    throw new Error("Push API not supported in this browser.");
  }

  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notification permission was not granted.");

  const reg = await ensureServiceWorker();
  const publicKey = await getPublicVapidKey(token);

  // If already subscribed, keep it; otherwise create new one
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  // Upsert on backend
  await axios.post(`${API_BASE}/notifications/webpush/subscribe`, sub.toJSON(), {
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
  });

  return true;
}

/**
 * Returns true if a push subscription exists in the browser.
 */
export async function isSubscribed() {
  if (!("serviceWorker" in navigator)) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return !!sub;
}

/**
 * Unsubscribe locally and inform backend (best-effort).
 */
export async function disableNotifications(token) {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    try {
      await axios.post(
        `${API_BASE}/notifications/webpush/unsubscribe`,
        { endpoint: sub.endpoint },
        { headers: { "Content-Type": "application/json", ...authHeaders(token) } }
      );
    } catch {
      /* ignore */
    }
    await sub.unsubscribe();
  }
}

/**
 * Convenience: trigger server’s /webpush/test to send a test notification to the current user.
 * Optional overrides: { title, body, url, tag }
 */
export async function sendTestPush(token, overrides = {}) {
  if (!token) throw new Error("Auth token required for test push.");
  const headers = { "Content-Type": "application/json", ...authHeaders(token) };
  const { data } = await axios.post(`${API_BASE}/notifications/webpush/test`, overrides, { headers });
  return data; // { ok, sent, results } per backend
}
