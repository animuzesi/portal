(function () {
  var store = window.AnimuzesiStore;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderCustomerView(container) {
    var snapshot = store.getState();
    var orderCode = snapshot.currentOrderCode || "-";

    container.innerHTML =
      '<div class="shell shell-customer">' +
      '<aside class="panel-nav customer-nav">' +
      '<div>' +
      '<p class="eyebrow">Anı Müzesi</p>' +
      '<h1>Birlikte hatırlayalım.</h1>' +
      '<p class="lede">Fotoğraflarınızı ve onlara eşlik eden küçük hikayeleri bırakın. Her şey sade, sıcak ve kolay ilerlesin.</p>' +
      '</div>' +
      '<div class="nav-actions auth-actions">' +
      '<span class="session-pill">Sipariş: ' + escapeHtml(orderCode) + '</span>' +
      '<button class="secondary-button" id="load-mock-data" type="button">Örnek içerik yükle</button>' +
      '<button class="ghost-button" id="logout-button" type="button">Çıkış yap</button>' +
      '</div>' +
      '</aside>' +
      '<main class="panel-main">' +
      '<section class="hero-card">' +
      '<div>' +
      '<p class="eyebrow">Müşteri Paneli</p>' +
      '<h2>Fotoğraflarınızı bırakın, sıralayın ve anılarınızı yazın.</h2>' +
      '<p class="muted">Bu alanda yalnızca ' + escapeHtml(orderCode) + ' siparişine ait içerikleri görüyorsunuz.</p>' +
      '</div>' +
      '<div class="cta-row">' +
      '<label class="primary-button" for="file-input">Fotoğraf ekle</label>' +
      '<input id="file-input" type="file" accept="image/*" multiple hidden />' +
      '<button class="secondary-button" id="submit-memories" type="button">Gönder</button>' +
      '</div>' +
      '</section>' +
      '<section class="dropzone" id="dropzone">' +
      '<div><strong>Fotoğrafları buraya bırakın</strong><p>Birden fazla fotoğrafı aynı anda ekleyebilirsiniz.</p></div>' +
      '</section>' +
      '<section id="customer-list" class="memory-list"></section>' +
      '</main>' +
      '</div>';

    var fileInput = container.querySelector("#file-input");
    var dropzone = container.querySelector("#dropzone");
    var list = container.querySelector("#customer-list");
    var submitButton = container.querySelector("#submit-memories");

    function paint() {
      var customerDraft = store.getState().customerDraft;

      list.innerHTML = customerDraft.length
        ? customerDraft
            .map(function (item, index) {
              return (
                '<article class="memory-card customer-card" draggable="true" data-id="' + item.id + '">' +
                '<div class="memory-media">' +
                '<img src="' + item.previewUrl + '" alt="' + escapeHtml(item.title || "Anı fotoğrafı") + '" />' +
                '</div>' +
                '<div class="memory-form">' +
                '<div class="card-topline">' +
                '<span class="sort-pill">' + String(index + 1).padStart(2, "0") + '</span>' +
                '<div class="sort-actions">' +
                '<button type="button" class="icon-button move-up" data-id="' + item.id + '">Yukarı</button>' +
                '<button type="button" class="icon-button move-down" data-id="' + item.id + '">Aşağı</button>' +
                '<button type="button" class="icon-button danger remove-memory" data-id="' + item.id + '">Sil</button>' +
                '</div>' +
                '</div>' +
                '<label><span>Başlık</span><input data-field="title" data-id="' + item.id + '" value="' + escapeHtml(item.title) + '" placeholder="Bu fotoğrafa kısa bir başlık verin" /></label>' +
                '<label><span>Tarih</span><input data-field="date" data-id="' + item.id + '" value="' + escapeHtml(item.date) + '" placeholder="Örneğin: Mayıs 2001" /></label>' +
                '<label><span>Anı</span><textarea data-field="memoryText" data-id="' + item.id + '" rows="5" placeholder="Bu fotoğrafın sizde bıraktığı anıyı yazın">' + escapeHtml(item.memoryText) + '</textarea></label>' +
                '</div>' +
                '</article>'
              );
            })
            .join("")
        : '<div class="empty-state"><h3>Henüz fotoğraf eklenmedi.</h3><p>Bu sipariş için ilk görseli eklediğiniz anda kartlar burada görünür.</p></div>';
    }

    paint();
    var unsubscribe = store.subscribe(paint);

    container.querySelector("#logout-button").addEventListener("click", function () {
      store.logout();
      window.location.hash = "#/login";
    });

    container.querySelector("#load-mock-data").addEventListener("click", function () {
      store.loadMockData(orderCode);
    });

    fileInput.addEventListener("change", async function (event) {
      await store.addFilesToDraft(event.target.files);
      fileInput.value = "";
    });

    dropzone.addEventListener("dragover", function (event) {
      event.preventDefault();
      dropzone.classList.add("is-dragging");
    });

    dropzone.addEventListener("dragleave", function () {
      dropzone.classList.remove("is-dragging");
    });

    dropzone.addEventListener("drop", async function (event) {
      event.preventDefault();
      dropzone.classList.remove("is-dragging");
      await store.addFilesToDraft(event.dataTransfer.files);
    });

    list.addEventListener("input", function (event) {
      var target = event.target;
      var id = target.dataset.id;
      var field = target.dataset.field;

      if (!id || !field) {
        return;
      }

      var updates = {};
      updates[field] = target.value;
      store.updateDraftMemory(id, updates);
    });

    list.addEventListener("click", function (event) {
      var button = event.target.closest("button");
      if (!button) {
        return;
      }

      var id = button.dataset.id;
      if (!id) {
        return;
      }

      if (button.classList.contains("move-up")) store.moveDraftMemory(id, "up");
      if (button.classList.contains("move-down")) store.moveDraftMemory(id, "down");
      if (button.classList.contains("remove-memory")) store.removeDraftMemory(id);
    });

    var draggedId = "";

    list.addEventListener("dragstart", function (event) {
      var card = event.target.closest(".memory-card");
      if (!card) {
        return;
      }

      draggedId = card.dataset.id;
      card.classList.add("dragging");
    });

    list.addEventListener("dragend", function (event) {
      var card = event.target.closest(".memory-card");
      if (card) {
        card.classList.remove("dragging");
      }
      draggedId = "";
    });

    list.addEventListener("dragover", function (event) {
      event.preventDefault();
      var card = event.target.closest(".memory-card");
      if (card) {
        card.classList.add("drag-over");
      }
    });

    list.addEventListener("dragleave", function (event) {
      var card = event.target.closest(".memory-card");
      if (card) {
        card.classList.remove("drag-over");
      }
    });

    list.addEventListener("drop", function (event) {
      event.preventDefault();
      var card = event.target.closest(".memory-card");
      if (!card || !draggedId) {
        return;
      }

      list.querySelectorAll(".memory-card").forEach(function (item) {
        item.classList.remove("drag-over");
      });
      store.reorderDraftMemory(draggedId, card.dataset.id);
    });

    submitButton.addEventListener("click", function () {
      store.submitDraft();
      submitButton.textContent = "Gönderildi";
      window.setTimeout(function () {
        submitButton.textContent = "Gönder";
      }, 1600);
    });

    return function () {
      unsubscribe();
    };
  }

  window.AnimuzesiCustomerView = {
    renderCustomerView: renderCustomerView,
  };
})();
