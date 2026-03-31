(function () {
  var cleanup = null;
  var store = window.AnimuzesiStore;

  function normalizeRoute(hashValue) {
    var hash = hashValue || "";

    if (!hash || hash === "#") {
      return "/login";
    }

    if (hash.indexOf("#") === 0) {
      hash = hash.slice(1);
    }

    if (hash === "/admin" || hash === "admin") {
      return "/admin";
    }

    if (hash === "/customer" || hash === "customer") {
      return "/customer";
    }

    if (hash === "/login" || hash === "login") {
      return "/login";
    }

    return "/login";
  }

  function getGuardedRoute(route) {
    var auth = store.getState().auth;

    if (!auth.loggedIn) {
      return "/login";
    }

    if (route === "/admin" && auth.role !== "admin") {
      return auth.role === "customer" ? "/customer" : "/login";
    }

    if (route === "/customer" && auth.role !== "customer") {
      return auth.role === "admin" ? "/admin" : "/login";
    }

    if (route === "/login") {
      return auth.role === "admin" ? "/admin" : "/customer";
    }

    return route;
  }

  function ensureHash(route) {
    var target = "#" + route;
    if (window.location.hash !== target) {
      window.location.hash = target;
      return false;
    }
    return true;
  }

  function getApp() {
    return document.getElementById("app");
  }

  function renderFallback(message) {
    var app = getApp();
    if (!app) {
      return;
    }

    app.innerHTML =
      '<div class="boot-error">' +
      '<p class="eyebrow">Anı Müzesi</p>' +
      '<h1>Görünüm yüklenemedi</h1>' +
      '<p>' + message + '</p>' +
      '<div class="nav-actions">' +
      '<a class="primary-button" href="#/login">Giriş ekranına dön</a>' +
      '</div>' +
      '</div>';
  }

  function renderApp() {
    var app = getApp();

    if (!app) {
      throw new Error("#app kök elemanı bulunamadı.");
    }

    if (typeof cleanup === "function") {
      cleanup();
      cleanup = null;
    }

    var normalizedRoute = normalizeRoute(window.location.hash);
    var route = getGuardedRoute(normalizedRoute);

    if (!ensureHash(route)) {
      return;
    }

    try {
      if (route === "/login") {
        cleanup = window.AnimuzesiLoginView.renderLoginView(app);
        return;
      }

      if (route === "/admin") {
        cleanup = window.AnimuzesiAdminView.renderAdminView(app);
        return;
      }

      cleanup = window.AnimuzesiCustomerView.renderCustomerView(app);
    } catch (error) {
      console.error(error);
      renderFallback(error.message || "Bilinmeyen bir görünüm hatası oluştu.");
    }
  }

  function onHashChange() {
    renderApp();
  }

  function start() {
    var auth = store.getState().auth;
    var initialRoute = auth.loggedIn ? (auth.role === "admin" ? "/admin" : "/customer") : "/login";

    if (!window.location.hash) {
      window.location.hash = "#" + initialRoute;
    }

    window.removeEventListener("hashchange", onHashChange);
    window.addEventListener("hashchange", onHashChange);
    renderApp();
  }

  window.AnimuzesiRouter = {
    normalizeRoute: normalizeRoute,
    renderApp: renderApp,
    start: start,
  };
})();
