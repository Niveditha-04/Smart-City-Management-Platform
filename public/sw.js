self.addEventListener("push", (event) => {
  if (!event.data) return;
  const p = event.data.json();
  event.waitUntil(
    self.registration.showNotification(p.title || "Alert", {
      body: p.body || "",
      data: p.data || {},
      icon: "/logo192.png"
    })
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
