(function () {
  var store = window.AnimuzesiStore;
  var exporters = window.AnimuzesiExporters;
  var helpers = window.AnimuzesiHelpers;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bindCopy(selector, text) {
    var button = document.querySelector(selector);
    if (!button) {
      return;
    }

    button.onclick = async function () {
      try {
        await helpers.copyToClipboard(text);
        var original = button.textContent;
        button.textContent = "Kopyalandı";
        window.setTimeout(function () {
          button.textContent = original;
        }, 1400);
      } catch (error) {
        console.error(error);
        button.textContent = "Kopyalanamadı";
      }
    };
  }

  function wireActions(outputs) {
    bindCopy("#copy-museum-code", outputs.museumCode);
    bindCopy("#copy-museum-preview", outputs.museumCode);
    bindCopy("#copy-real", outputs.realCode);
    bindCopy("#copy-extra", outputs.extraCode);
    bindCopy("#copy-rename-list", outputs.groupedRenameList);
    bindCopy("#copy-rename-preview", outputs.groupedRenameList);

    var downloadButton = document.querySelector("#download-json");
    if (downloadButton) {
      downloadButton.onclick = function () {
        helpers.downloadTextFile(
          "animuzesi-export-" + new Date().toISOString().slice(0, 10) + ".json",
          outputs.jsonExport
        );
      };
    }
  }

  function renderAdminView(container) {
    var snapshot = store.getState();
    var orderButtons = snapshot.validOrderCodes
      .map(function (code) {
        return '<button class="order-filter ' + (code === snapshot.adminSelectedOrder ? 'is-active' : '') + '" data-order-code="' + code + '" type="button">' + code + '</button>';
      })
      .join('');

    container.innerHTML =
      '<div class="shell shell-admin">' +
      '<aside class="panel-nav admin-nav">' +
      '<div><p class="eyebrow">Anı Müzesi</p><h1>Yönetim ve çıktı merkezi</h1><p class="lede">Tüm siparişleri tek yerden yönetin, teknik çıktıları üretin ve sipariş bazında kontrol edin.</p></div>' +
      '<div class="nav-actions auth-actions">' +
      '<span class="session-pill">Admin oturumu</span>' +
      '<button class="secondary-button" id="load-admin-mock-data" type="button">Örnek veri yükle</button>' +
      '<button class="ghost-button" id="logout-button" type="button">Çıkış yap</button>' +
      '</div>' +
      '</aside>' +
      '<main class="panel-main">' +
      '<section class="hero-card admin-hero-card">' +
      '<div><p class="eyebrow">Admin Paneli</p><h2>Sipariş kayıtları ve teknik çıktılar</h2><p class="muted">Seçili sipariş için müze kodunu üretin, tüm siparişlerin durumunu tek bakışta görün.</p></div>' +
      '<div class="order-switcher">' +
      '<p class="switcher-label">Sipariş seç</p>' +
      '<div class="order-filter-grid">' + orderButtons + '</div>' +
      '</div>' +
      '</section>' +
      '<section class="toolbar">' +
      '<button class="primary-button" id="copy-museum-code" type="button">Müze kodunu oluştur</button>' +
      '<button class="secondary-button" id="copy-real" type="button">REAL_MEMORIES olarak kopyala</button>' +
      '<button class="secondary-button" id="copy-extra" type="button">EXTRA_MEMORIES olarak kopyala</button>' +
      '<button class="secondary-button" id="copy-rename-list" type="button">Yeniden adlandırma listesi oluştur</button>' +
      '<button class="secondary-button" id="download-json" type="button">JSON dışa aktar</button>' +
      '</section>' +
      '<section class="dashboard-grid">' +
      '<article class="summary-card"><span>Toplam sipariş</span><strong id="summary-orders">0</strong></article>' +
      '<article class="summary-card"><span>Seçili sipariş kayıtları</span><strong id="summary-count">0</strong></article>' +
      '<article class="summary-card"><span>REAL_MEMORIES</span><strong id="summary-real">0</strong></article>' +
      '<article class="summary-card warning"><span>Eksik alanlı kayıt</span><strong id="summary-missing">0</strong></article>' +
      '</section>' +
      '<section class="output-grid">' +
      '<article class="output-card"><div class="output-card-head"><h2>Üretilen müze kodu</h2><button class="ghost-button" id="copy-museum-preview" type="button">Kopyala</button></div><pre id="museum-code-preview"></pre></article>' +
      '<article class="output-card"><div class="output-card-head"><h2>Yeniden adlandırma listesi</h2><button class="ghost-button" id="copy-rename-preview" type="button">Kopyala</button></div><pre id="rename-list-preview"></pre></article>' +
      '</section>' +
      '<section id="admin-list" class="admin-list"></section>' +
      '</main>' +
      '</div>';

    var list = container.querySelector("#admin-list");
    var museumPreview = container.querySelector("#museum-code-preview");
    var renamePreview = container.querySelector("#rename-list-preview");

    function buildOutputs() {
      var state = store.getState();
      var selectedOrderCode = state.adminSelectedOrder;
      var selectedOrder = state.allOrders[selectedOrderCode] || { draft: [], submitted: [] };
      var submittedMemories = selectedOrder.submitted;
      var entries = exporters.buildMuseumDataset(submittedMemories);
      var splitted = exporters.splitMuseumData(entries);
      var museumCode = exporters.createMuseumCode(entries);
      var realCode = exporters.createNamedExport("REAL_MEMORIES", splitted.realMemories);
      var extraCode = exporters.createNamedExport("EXTRA_MEMORIES", splitted.extraMemories);
      var groupedRenameList = exporters.createGroupedRenameList(entries);
      var jsonExport = exporters.createJsonExport(submittedMemories, entries);
      var totalOrdersWithData = state.validOrderCodes.filter(function (code) {
        var order = state.allOrders[code];
        return order && (order.draft.length || order.submitted.length);
      }).length;

      museumPreview.textContent = museumCode;
      renamePreview.textContent = groupedRenameList;
      container.querySelector("#summary-orders").textContent = String(totalOrdersWithData);
      container.querySelector("#summary-count").textContent = String(entries.length);
      container.querySelector("#summary-real").textContent = String(splitted.realMemories.length);

      var missingCount = submittedMemories.filter(function (item) {
        return exporters.findMissingFields(item).length;
      }).length;
      container.querySelector("#summary-missing").textContent = String(missingCount);

      container.querySelectorAll(".order-filter").forEach(function (button) {
        button.classList.toggle("is-active", button.dataset.orderCode === selectedOrderCode);
      });

      list.innerHTML = submittedMemories.length
        ? submittedMemories
            .slice()
            .sort(function (a, b) {
              return a.sortOrder - b.sortOrder;
            })
            .map(function (item, index) {
              var missing = exporters.findMissingFields(item);
              var plannedFileName = entries[index] ? entries[index].plannedFileName : "-";
              var plannedPath = entries[index] ? entries[index].image : "-";

              return (
                '<article class="admin-memory-card ' + (missing.length ? 'has-missing' : '') + '">' +
                '<div class="admin-media"><img src="' + item.previewUrl + '" alt="' + escapeHtml(item.title || 'Anı görseli') + '" /></div>' +
                '<div class="admin-content">' +
                '<div class="admin-topline">' +
                '<span class="sort-pill">' + String(index + 1).padStart(2, '0') + '</span>' +
                '<span class="meta-chip">' + entries[index].orientation + '</span>' +
                '<span class="meta-chip">' + plannedFileName + '</span>' +
                '<span class="meta-chip">' + escapeHtml(selectedOrderCode) + '</span>' +
                '</div>' +
                '<h3>' + escapeHtml(item.title || 'Başlıksız Anı') + '</h3>' +
                '<p class="admin-date">' + escapeHtml(item.date || 'Tarih eklenmedi') + '</p>' +
                '<p class="admin-memory-text">' + escapeHtml(item.memoryText || 'Anı metni eklenmedi') + '</p>' +
                '<div class="admin-metadata">' +
                '<span><strong>Path:</strong> ' + plannedPath + '</span>' +
                '<span><strong>Kaynak dosya:</strong> ' + escapeHtml(item.originalFileName) + '</span>' +
                '<span><strong>Ölçü:</strong> ' + (item.imageWidth || 0) + ' x ' + (item.imageHeight || 0) + '</span>' +
                '</div>' +
                (missing.length
                  ? '<div class="missing-banner">Eksik alanlar: ' + missing.join(', ') + '</div>'
                  : '<div class="ok-banner">Tüm temel alanlar tamam.</div>') +
                '</div>' +
                '</article>'
              );
            })
            .join('')
        : '<div class="empty-state admin-empty"><h3>Bu sipariş için gönderilmiş kayıt yok.</h3><p>' + escapeHtml(selectedOrderCode) + ' siparişinden gönderim geldiğinde burada görünecek.</p></div>';

      wireActions({
        museumCode: museumCode,
        realCode: realCode,
        extraCode: extraCode,
        groupedRenameList: groupedRenameList,
        jsonExport: jsonExport,
      });
    }

    buildOutputs();
    var unsubscribe = store.subscribe(buildOutputs);

    container.querySelector("#logout-button").addEventListener("click", function () {
      store.logout();
      window.location.hash = "#/login";
    });

    container.querySelector("#load-admin-mock-data").addEventListener("click", function () {
      store.loadMockData(store.getState().adminSelectedOrder);
    });

    container.querySelector(".order-filter-grid").addEventListener("click", function (event) {
      var button = event.target.closest(".order-filter");
      if (!button) {
        return;
      }

      store.setAdminSelectedOrder(button.dataset.orderCode);
    });

    return function () {
      unsubscribe();
    };
  }

  window.AnimuzesiAdminView = {
    renderAdminView: renderAdminView,
  };
})();
