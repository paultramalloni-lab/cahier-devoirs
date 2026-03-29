// Service Worker — Mon Cahier de Devoirs
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// Reçoit un message depuis l'appli et affiche une notification
self.addEventListener("message", e => {
  if (e.data?.type === "NOTIFY") {
    const { title, body, icon } = e.data;
    self.registration.showNotification(title, {
      body,
      icon: icon || "/favicon.svg",
      badge: "/favicon.svg",
      vibrate: [200, 100, 200],
      tag: "cahier-devoirs-" + Date.now(),
      renotify: true,
      requireInteraction: false,
    });
  }
});

// Clic sur la notification → ouvre/focus l'onglet du site
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      for (const c of clients) {
        if (c.url.includes(self.location.origin)) { c.focus(); return; }
      }
      self.clients.openWindow(self.location.origin);
    })
  );
});
