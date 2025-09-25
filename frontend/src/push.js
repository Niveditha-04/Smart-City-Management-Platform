// src/push.js
export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) throw new Error("SW not supported");
  return navigator.serviceWorker.register("/sw.js");
}
function b64ToU8(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const str = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(str);
  return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}
export async function subscribeToPush(userId="user-123") {
  const reg = await registerServiceWorker();
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Permission denied");
  const { key } = await fetch("/notifications/vapid-public-key").then(r=>r.json());
  const sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: b64ToU8(key) });
  await fetch("/notifications/subscribe", {
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ userId, subscription: sub })
  });
  return sub;
}
