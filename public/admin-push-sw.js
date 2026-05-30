self.addEventListener("push", (event) => {
  let payload = {
    title: "Akinal İnşaat",
    body: "Yeni bir yönetim bildirimi var.",
    url: "/admin/bildirimler",
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Akinal İnşaat", {
      body: payload.body || "Yeni bir yönetim bildirimi var.",
      icon: payload.icon || "/favicon.png",
      badge: payload.badge || "/favicon.png",
      data: {
        url: payload.url || "/admin/bildirimler",
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/admin/bildirimler";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.includes("/admin"));
      if (existing) {
        existing.focus();
        return existing.navigate(url);
      }
      return self.clients.openWindow(url);
    }),
  );
});
