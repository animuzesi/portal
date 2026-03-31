(function () {
  var store = window.AnimuzesiStore;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderLoginView(container) {
    container.innerHTML =
      '<div class="login-shell">' +
      '<section class="login-card">' +
      '<div class="login-hero">' +
      '<p class="eyebrow">Anı Müzesi Portal</p>' +
      '<h1>Hoş geldiniz</h1>' +
      '<p class="lede">Sipariş numaranızla anılarınızı bırakın ya da yönetim erişimiyle tüm kayıtları yönetin.</p>' +
      '</div>' +
      '<div class="login-grid">' +
      '<article class="login-panel">' +
      '<h2>Müşteri Girişi</h2>' +
      '<p>Sadece size özel sipariş numaranızı girin.</p>' +
      '<form id="customer-login-form" class="login-form">' +
      '<label><span>Sipariş numarası</span><input id="customer-order-code" type="text" inputmode="text" autocomplete="off" placeholder="Örn: AM-0001" /></label>' +
      '<button class="primary-button" type="submit">Müşteri paneline gir</button>' +
      '<p class="inline-hint">Örnek siparişler: AM-0001, AM-0002, AM-0003, AM-0004, AM-0005</p>' +
      '<div class="form-message" id="customer-login-message"></div>' +
      '</form>' +
      '</article>' +
      '<article class="login-panel login-panel-admin">' +
      '<h2>Admin Girişi</h2>' +
      '<p>Yönetim erişimi için tek şifre kullanılır.</p>' +
      '<form id="admin-login-form" class="login-form">' +
      '<label><span>Şifre</span><input id="admin-password" type="password" autocomplete="current-password" placeholder="Admin şifresi" /></label>' +
      '<button class="secondary-button" type="submit">Admin paneline gir</button>' +
      '<div class="form-message" id="admin-login-message"></div>' +
      '</form>' +
      '</article>' +
      '</div>' +
      '</section>' +
      '</div>';

    var customerForm = container.querySelector("#customer-login-form");
    var adminForm = container.querySelector("#admin-login-form");
    var customerInput = container.querySelector("#customer-order-code");
    var adminInput = container.querySelector("#admin-password");
    var customerMessage = container.querySelector("#customer-login-message");
    var adminMessage = container.querySelector("#admin-login-message");

    customerForm.addEventListener("submit", function (event) {
      event.preventDefault();
      customerMessage.textContent = "";
      var result = store.loginCustomer(customerInput.value);

      if (!result.ok) {
        customerMessage.textContent = result.message;
        customerMessage.className = "form-message is-error";
        return;
      }

      window.location.hash = "#/customer";
    });

    adminForm.addEventListener("submit", function (event) {
      event.preventDefault();
      adminMessage.textContent = "";
      var result = store.loginAdmin(adminInput.value);

      if (!result.ok) {
        adminMessage.textContent = result.message;
        adminMessage.className = "form-message is-error";
        return;
      }

      window.location.hash = "#/admin";
    });

    return function () {};
  }

  window.AnimuzesiLoginView = {
    renderLoginView: renderLoginView,
  };
})();
