(function () {
  function ensureAppRoot() {
    var app = document.getElementById("app");

    if (!app) {
      app = document.createElement("div");
      app.id = "app";
      document.body.appendChild(app);
    }

    return app;
  }

  function renderBootError(message) {
    var app = ensureAppRoot();
    app.innerHTML =
      '<div class="boot-error">' +
      '<p class="eyebrow">Anı Müzesi</p>' +
      '<h1>Portal başlatılamadı</h1>' +
      '<p>' + message + '</p>' +
      '<a class="primary-button" href="#/login">Giriş ekranını aç</a>' +
      '</div>';
  }

  async function boot() {
    try {
      ensureAppRoot();

      if (!window.AnimuzesiRouter || !window.AnimuzesiRouter.renderApp) {
        throw new Error("Router yüklenemedi.");
      }

      if (!window.location.hash) {
        window.location.hash = "#/login";
      }

      if (window.AnimuzesiStore && window.AnimuzesiStore.restoreSession) {
        await window.AnimuzesiStore.restoreSession();
      }

      window.AnimuzesiRouter.start();
    } catch (error) {
      console.error(error);
      renderBootError(error.message || "Başlangıç sırasında bir hata oluştu.");
    }
  }

  window.addEventListener("error", function (event) {
    var message = event && event.error && event.error.message ? event.error.message : "Beklenmeyen bir JavaScript hatası oluştu.";
    renderBootError(message);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
    return;
  }

  boot();
})();
