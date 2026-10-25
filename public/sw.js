self.addEventListener("push", (e) => {
  let d = { title: "Tryumph Gym", body: "Your class is starting" };
  try { d = { ...d, ...e.data.json() }; } catch {}
  e.waitUntil(self.registration.showNotification(d.title, { body: d.body, data: { url: d.url || "/live" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || "/live"));
});
