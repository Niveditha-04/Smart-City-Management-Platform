self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Notification", body: event.data?.text() || "" };
  }

  const title = data.title || "Smart City";
  const body = data.body || "You have a new alert.";
  const icon = data.icon || "/icons/icon-192.png";
  const badge = data.badge || "/icons/badge-72.png";
  const tag = data.tag || "smart-city-alert";
  const url = data.url || "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      data: { url },
      renotify: true,
      requireInteraction: !!data.requireInteraction,
      actions: data.actions || [{ action: "open", title: "Open" }],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
