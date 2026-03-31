(function () {
  var store = window.AnimuzesiStore;

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
      '<button class="primary-button" id="customer-login-button" type="submit">Müşteri paneline gir</button>' +
      '<div class="form-message" id="customer-login-message"></div>' +
      '</form>' +
      '</article>' +
      '<article class="login-panel login-panel-admin">' +
      '<h2>Admin Girişi</h2>' +
      '<p>Yönetim erişimi için tek şifre kullanılır.</p>' +
      '<form id="admin-login-form" class="login-form">' +
      '<label><span>Şifre</span><input id="admin-password" type="password" autocomplete="current-password" placeholder="Admin şifresi" /></label>' +
      '<button class="secondary-button" id="admin-login-button" type="submit">Admin paneline gir</button>' +
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
    var customerButton = container.querySelector("#customer-login-button");
    var adminButton = container.querySelector("#admin-login-button");

    customerForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      customerMessage.textContent = "";
      customerMessage.className = "form-message";
      customerButton.disabled = true;
      customerButton.textContent = "Kontrol ediliyor";

      try {
        var result = await store.loginCustomer(customerInput.value);
        if (!result.ok) {
          customerMessage.textContent = result.message;
          customerMessage.className = "form-message is-error";
          return;
        }

        window.location.hash = "#/customer";
      } finally {
        customerButton.disabled = false;
        customerButton.textContent = "Müşteri paneline gir";
      }
    });

    adminForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      adminMessage.textContent = "";
      adminMessage.className = "form-message";
      adminButton.disabled = true;
      adminButton.textContent = "Kontrol ediliyor";

      try {
        var result = await store.loginAdmin(adminInput.value);
        if (!result.ok) {
          adminMessage.textContent = result.message;
          adminMessage.className = "form-message is-error";
          return;
        }

        window.location.hash = "#/admin";
      } finally {
        adminButton.disabled = false;
        adminButton.textContent = "Admin paneline gir";
      }
    });

    return function () {};
  }

  window.AnimuzesiLoginView = {
    renderLoginView: renderLoginView,
  };
})();
