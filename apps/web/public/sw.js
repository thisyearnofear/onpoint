// Service worker for OnPoint order tracking push notifications
// Installed when the user enables notifications on the tracking page.

const TRACKING_URL_BASE = "/track";

self.addEventListener("install", () => {
  // Force the waiting service worker to become the active one
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Take control of all clients immediately
  event.waitUntil(clients.claim());
});

self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data?.json();
  } catch {
    data = null;
  }

  const title = data?.title || "Order status updated";
  const body = data?.body || "Your order tracking has been updated.";
  const tag = data?.tag || "onpoint-order";
  const paymentId = data?.paymentId || "";
  const curatorSlug = data?.curatorSlug || "";
  const icon = data?.icon || "/favicon.ico";

  const options = {
    body,
    icon,
    badge: "/favicon.ico",
    tag,
    data: {
      paymentId,
      curatorSlug,
      url: paymentId && curatorSlug
        ? `${TRACKING_URL_BASE}?id=${encodeURIComponent(paymentId)}&slug=${encodeURIComponent(curatorSlug)}`
        : TRACKING_URL_BASE,
    },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || TRACKING_URL_BASE;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If we already have a tab open to the tracking page, focus it and navigate
        for (const client of clientList) {
          const clientUrl = new URL(client.url);
          const target = new URL(targetUrl, self.location.origin);
          if (clientUrl.pathname.startsWith("/track")) {
            client.navigate(target.pathname + target.search);
            return client.focus();
          }
        }
        // Otherwise open a new window
        return clients.openWindow(targetUrl);
      }),
  );
});
