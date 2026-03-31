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
      '<button class="secondary-button" id="submit-memories" type="button">Kaydet ve yenile</button>' +
      '</div>' +
      '</section>' +
      '<section class="dropzone" id="dropzone">' +
      '<div><strong>Fotoğrafları buraya bırakın</strong><p>Yüklenen görseller doğrudan buluta kaydedilir ve bu siparişe bağlanır.</p></div>' +
      '</section>' +
      '<section id="customer-list" class="memory-list"></section>' +
      '</main>' +
      '</div>';

    var fileInput = container.querySelector("#file-input");
    var dropzone = container.querySelector("#dropzone");
    var list = container.querySelector("#customer-list");
    var submitButton = container.querySelector("#submit-memories");

    function paint() {
      var currentState = store.getState();
      var customerDraft = currentState.customerDraft;
      submitButton.disabled = currentState.isBusy;
      fileInput.disabled = currentState.isBusy;

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
        : '<div class="empty-state"><h3>Henüz fotoğraf eklenmedi.</h3><p>Bu sipariş için ilk görseli eklediğiniz anda kayıtlar burada görünür.</p></div>';
    }

    paint();
    var unsubscribe = store.subscribe(paint);

    container.querySelector("#logout-button").addEventListener("click", function () {
      store.logout();
      window.location.hash = "#/login";
    });

    fileInput.addEventListener("change", async function (event) {
      try {
        await store.addFilesToDraft(event.target.files);
        fileInput.value = "";
      } catch (error) {
        alert(error.message || "Görsel yüklenemedi.");
      }
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
      try {
        await store.addFilesToDraft(event.dataTransfer.files);
      } catch (error) {
        alert(error.message || "Görsel yüklenemedi.");
      }
    });

    list.addEventListener("change", async function (event) {
      var target = event.target;
      var id = target.dataset.id;
      var field = target.dataset.field;
      if (!id || !field) {
        return;
      }

      var updates = {};
      updates[field] = target.value;

      try {
        await store.updateDraftMemory(id, updates);
      } catch (error) {
        alert(error.message || "Kayıt güncellenemedi.");
      }
    });

    list.addEventListener("click", async function (event) {
      var button = event.target.closest("button");
      if (!button) {
        return;
      }

      var id = button.dataset.id;
      if (!id) {
        return;
      }

      try {
        if (button.classList.contains("move-up")) await store.moveDraftMemory(id, "up");
        if (button.classList.contains("move-down")) await store.moveDraftMemory(id, "down");
        if (button.classList.contains("remove-memory")) await store.removeDraftMemory(id);
      } catch (error) {
        alert(error.message || "İşlem tamamlanamadı.");
      }
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

    list.addEventListener("drop", async function (event) {
      event.preventDefault();
      var card = event.target.closest(".memory-card");
      if (!card || !draggedId) {
        return;
      }

      list.querySelectorAll(".memory-card").forEach(function (item) {
        item.classList.remove("drag-over");
      });

      try {
        await store.reorderDraftMemory(draggedId, card.dataset.id);
      } catch (error) {
        alert(error.message || "Sıralama güncellenemedi.");
      }
    });

    submitButton.addEventListener("click", async function () {
      submitButton.disabled = true;
      submitButton.textContent = "Yenileniyor";
      try {
        await store.submitDraft();
        submitButton.textContent = "Kaydedildi";
      } catch (error) {
        submitButton.textContent = "Tekrar dene";
      }
      window.setTimeout(function () {
        submitButton.disabled = false;
        submitButton.textContent = "Kaydet ve yenile";
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
