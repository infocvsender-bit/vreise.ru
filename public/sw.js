/* Vreise.ru — пуш-уведомления (показ и переход в личный кабинет по нажатию) */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("push", e => {
    let d = {};
    try { d = e.data ? e.data.json() : {}; } catch(x){ d = {title: "Vreise.ru", body: e.data ? e.data.text() : ""}; }
    e.waitUntil(self.registration.showNotification(d.title || "Vreise.ru", {body: d.body || "", icon: "/static/icon-192.png", badge: "/static/icon-192.png", data: {url: d.url || "/"}, tag: d.tag || undefined}));
});
self.addEventListener("notificationclick", e => {
    e.notification.close();
    const url = (e.notification.data && e.notification.data.url) || "/";
    e.waitUntil(self.clients.matchAll({type: "window", includeUncontrolled: true}).then(list => {
        for(const c of list) if(c.url.split("#")[0] === url.split("#")[0] && "focus" in c) return c.focus();
        return self.clients.openWindow(url);
    }));
});
