self.addEventListener("message", (event) => {
  if (event.data?.type === "NOTIFY") {
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: "/favicon.ico",
    });
  }
});
