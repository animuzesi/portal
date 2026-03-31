(function () {
  var helpers = window.AnimuzesiHelpers;
  var orientationApi = window.AnimuzesiOrientation;

  var STORAGE_KEYS = {
    auth: "animuzesi_portal_auth",
    orders: "animuzesi_portal_orders",
    adminSelection: "animuzesi_portal_admin_selection",
  };

  var VALID_ORDER_CODES = ["AM-0001", "AM-0002", "AM-0003", "AM-0004", "AM-0005"];
  var ADMIN_PASSWORD = "3aydamilyoner";
  var listeners = [];
  var state = hydrateState();

  function safeStorageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn("localStorage yazılamadı:", error);
    }
  }

  function safeParse(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function buildDefaultOrdersState() {
    var orders = {};
    VALID_ORDER_CODES.forEach(function (code) {
      orders[code] = {
        draft: [],
        submitted: [],
      };
    });
    return orders;
  }

  function hydrateState() {
    var persistedOrders = safeParse(safeStorageGet(STORAGE_KEYS.orders), {});
    var orders = buildDefaultOrdersState();

    VALID_ORDER_CODES.forEach(function (code) {
      if (persistedOrders[code]) {
        orders[code] = {
          draft: Array.isArray(persistedOrders[code].draft) ? persistedOrders[code].draft : [],
          submitted: Array.isArray(persistedOrders[code].submitted)
            ? persistedOrders[code].submitted
            : [],
        };
      }
    });

    var auth = safeParse(safeStorageGet(STORAGE_KEYS.auth), {
      role: null,
      orderCode: null,
      loggedIn: false,
    });
    var adminSelectedOrder = safeStorageGet(STORAGE_KEYS.adminSelection) || VALID_ORDER_CODES[0];

    return {
      auth: {
        role: auth && auth.loggedIn ? auth.role : null,
        orderCode: auth && auth.loggedIn ? auth.orderCode : null,
        loggedIn: Boolean(auth && auth.loggedIn),
      },
      orders: orders,
      adminSelectedOrder: VALID_ORDER_CODES.indexOf(adminSelectedOrder) > -1
        ? adminSelectedOrder
        : VALID_ORDER_CODES[0],
    };
  }

  function persist() {
    safeStorageSet(STORAGE_KEYS.auth, JSON.stringify(state.auth));
    safeStorageSet(STORAGE_KEYS.orders, JSON.stringify(state.orders));
    safeStorageSet(STORAGE_KEYS.adminSelection, state.adminSelectedOrder);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getCurrentOrderCode() {
    if (state.auth.role === "customer" && state.auth.orderCode) {
      return state.auth.orderCode;
    }

    if (state.auth.role === "admin") {
      return state.adminSelectedOrder;
    }

    return null;
  }

  function getOrderBucket(orderCode) {
    var code = orderCode || getCurrentOrderCode();

    if (!code || !state.orders[code]) {
      return {
        draft: [],
        submitted: [],
      };
    }

    return state.orders[code];
  }

  function getOrderSnapshot(orderCode) {
    var bucket = getOrderBucket(orderCode);
    return {
      draft: clone(bucket.draft),
      submitted: clone(bucket.submitted),
    };
  }

  function getAllOrdersSnapshot() {
    var snapshot = {};
    VALID_ORDER_CODES.forEach(function (code) {
      snapshot[code] = getOrderSnapshot(code);
    });
    return snapshot;
  }

  function getState() {
    var currentOrderCode = getCurrentOrderCode();
    var currentBucket = getOrderBucket(currentOrderCode);

    return {
      auth: clone(state.auth),
      validOrderCodes: VALID_ORDER_CODES.slice(),
      currentOrderCode: currentOrderCode,
      customerDraft: clone(currentBucket.draft),
      submittedMemories: clone(currentBucket.submitted),
      allOrders: getAllOrdersSnapshot(),
      adminSelectedOrder: state.adminSelectedOrder,
    };
  }

  function emit() {
    persist();
    var snapshot = getState();
    listeners.slice().forEach(function (listener) {
      listener(snapshot);
    });
  }

  function subscribe(listener) {
    listeners.push(listener);

    return function () {
      listeners = listeners.filter(function (item) {
        return item !== listener;
      });
    };
  }

  function normalizeSortOrder(item, index) {
    return Object.assign({}, item, { sortOrder: index + 1 });
  }

  function createMockSvg(label, accent, orientation) {
    var isPortrait = orientation !== "landscape";
    var width = isPortrait ? 800 : 1200;
    var height = isPortrait ? 1100 : 800;

    return (
      "data:image/svg+xml;charset=UTF-8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="' +
          width +
          '" height="' +
          height +
          '" viewBox="0 0 ' +
          width +
          " " +
          height +
          '">' +
          "<defs>" +
          '<linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">' +
          '<stop offset="0%" stop-color="' + accent + '" />' +
          '<stop offset="100%" stop-color="#f4e9da" />' +
          "</linearGradient>" +
          "</defs>" +
          '<rect width="100%" height="100%" fill="url(#g)" />' +
          '<circle cx="' + Math.round(width * 0.75) + '" cy="' + Math.round(height * 0.25) + '" r="' + Math.round(width * 0.12) + '" fill="rgba(255,255,255,0.32)" />' +
          '<text x="50%" y="48%" dominant-baseline="middle" text-anchor="middle" font-family="Georgia, serif" font-size="' + Math.round(width * 0.06) + '" fill="#3f2e21">' + label + "</text>" +
          "</svg>"
      )
    );
  }

  function isValidOrderCode(orderCode) {
    return VALID_ORDER_CODES.indexOf(String(orderCode || "").toUpperCase()) > -1;
  }

  function loginCustomer(orderCode) {
    var normalized = String(orderCode || "").trim().toUpperCase();

    if (!isValidOrderCode(normalized)) {
      return {
        ok: false,
        message: "Geçerli bir sipariş numarası girin.",
      };
    }

    state.auth = {
      role: "customer",
      orderCode: normalized,
      loggedIn: true,
    };
    emit();
    return {
      ok: true,
      orderCode: normalized,
    };
  }

  function loginAdmin(password) {
    if (String(password || "") !== ADMIN_PASSWORD) {
      return {
        ok: false,
        message: "Şifre yanlış. Lütfen tekrar deneyin.",
      };
    }

    state.auth = {
      role: "admin",
      orderCode: null,
      loggedIn: true,
    };
    emit();
    return { ok: true };
  }

  function logout() {
    state.auth = {
      role: null,
      orderCode: null,
      loggedIn: false,
    };
    emit();
  }

  function setAdminSelectedOrder(orderCode) {
    if (!isValidOrderCode(orderCode)) {
      return;
    }

    state.adminSelectedOrder = String(orderCode).toUpperCase();
    emit();
  }

  async function addFilesToDraft(fileList) {
    var orderCode = state.auth.role === "customer" ? state.auth.orderCode : state.adminSelectedOrder;
    var bucket = getOrderBucket(orderCode);
    var files = Array.prototype.slice.call(fileList || []);

    if (!files.length) {
      return;
    }

    var mapped = await Promise.all(
      files
        .filter(function (file) {
          return file.type && file.type.indexOf("image/") === 0;
        })
        .map(async function (file, index) {
          var previewUrl = await helpers.fileToDataUrl(file);
          var metadata = await orientationApi.getImageMetadata(previewUrl);
          return helpers.createMemoryRecord({
            id: helpers.generateId(),
            sortOrder: bucket.draft.length + index + 1,
            title: "",
            date: "",
            memoryText: "",
            originalFileName: file.name,
            mimeType: file.type,
            previewUrl: previewUrl,
            orientation: metadata.orientation,
            imageWidth: metadata.width,
            imageHeight: metadata.height,
          });
        })
    );

    state.orders[orderCode].draft = bucket.draft.concat(mapped).map(normalizeSortOrder);
    emit();
  }

  function updateDraftMemory(id, updates) {
    var orderCode = state.auth.role === "customer" ? state.auth.orderCode : state.adminSelectedOrder;
    state.orders[orderCode].draft = getOrderBucket(orderCode).draft.map(function (item) {
      if (item.id !== id) {
        return item;
      }

      return Object.assign({}, item, {
        title: helpers.sanitizeText(updates.title != null ? updates.title : item.title),
        date: helpers.sanitizeText(updates.date != null ? updates.date : item.date),
        memoryText: helpers.sanitizeText(updates.memoryText != null ? updates.memoryText : item.memoryText),
      });
    });
    emit();
  }

  function removeDraftMemory(id) {
    var orderCode = state.auth.role === "customer" ? state.auth.orderCode : state.adminSelectedOrder;
    state.orders[orderCode].draft = getOrderBucket(orderCode).draft
      .filter(function (item) {
        return item.id !== id;
      })
      .map(normalizeSortOrder);
    emit();
  }

  function moveDraftMemory(id, direction) {
    var orderCode = state.auth.role === "customer" ? state.auth.orderCode : state.adminSelectedOrder;
    var bucket = getOrderBucket(orderCode);
    var currentIndex = bucket.draft.findIndex(function (item) {
      return item.id === id;
    });

    if (currentIndex === -1) {
      return;
    }

    var targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= bucket.draft.length) {
      return;
    }

    var next = bucket.draft.slice();
    var moved = next.splice(currentIndex, 1)[0];
    next.splice(targetIndex, 0, moved);
    state.orders[orderCode].draft = next.map(normalizeSortOrder);
    emit();
  }

  function reorderDraftMemory(fromId, toId) {
    var orderCode = state.auth.role === "customer" ? state.auth.orderCode : state.adminSelectedOrder;
    if (fromId === toId) {
      return;
    }

    var list = getOrderBucket(orderCode).draft.slice();
    var fromIndex = list.findIndex(function (item) {
      return item.id === fromId;
    });
    var toIndex = list.findIndex(function (item) {
      return item.id === toId;
    });

    if (fromIndex === -1 || toIndex === -1) {
      return;
    }

    var moved = list.splice(fromIndex, 1)[0];
    list.splice(toIndex, 0, moved);
    state.orders[orderCode].draft = list.map(normalizeSortOrder);
    emit();
  }

  function submitDraft() {
    var orderCode = state.auth.role === "customer" ? state.auth.orderCode : state.adminSelectedOrder;
    var bucket = getOrderBucket(orderCode);
    var stampedAt = new Date().toISOString();

    state.orders[orderCode].submitted = bucket.draft.map(function (item, index) {
      return Object.assign({}, item, {
        id: item.id || helpers.generateId(),
        sortOrder: index + 1,
        submittedAt: stampedAt,
        dateLabel: helpers.inferDateLabel(item.date),
      });
    });
    emit();
  }

  function loadMockData(orderCode) {
    var targetOrder = orderCode || (state.auth.role === "customer" ? state.auth.orderCode : state.adminSelectedOrder);
    var bucket = getOrderBucket(targetOrder);

    if (bucket.draft.length || bucket.submitted.length) {
      return;
    }

    var draft = [
      helpers.createMemoryRecord({
        id: helpers.generateId(),
        sortOrder: 1,
        title: "İlk Yaz",
        date: "Haziran 1998",
        memoryText: "Bahçedeki salıncağın yanında saatlerce oturur, akşam serinliğini beklerdik.",
        originalFileName: "IMG_4411.jpg",
        mimeType: "image/jpeg",
        previewUrl: createMockSvg("Ilk Yaz", "#d2aa8c", "portrait"),
        orientation: "portrait",
        imageWidth: 800,
        imageHeight: 1100,
      }),
      helpers.createMemoryRecord({
        id: helpers.generateId(),
        sortOrder: 2,
        title: "Sahil Günü",
        date: "Ağustos 2004",
        memoryText: "Rüzgar sertti ama hepimiz çok mutluyduk. Kumlara isimlerimizi yazmıştık.",
        originalFileName: "uploaded_9832.jpg",
        mimeType: "image/jpeg",
        previewUrl: createMockSvg("Sahil Gunu", "#afc8be", "landscape"),
        orientation: "landscape",
        imageWidth: 1200,
        imageHeight: 800,
      }),
    ].map(normalizeSortOrder);

    state.orders[targetOrder].draft = draft;
    state.orders[targetOrder].submitted = draft.map(function (item, index) {
      return Object.assign({}, item, {
        sortOrder: index + 1,
        submittedAt: new Date().toISOString(),
        dateLabel: helpers.inferDateLabel(item.date),
      });
    });
    emit();
  }

  window.AnimuzesiStore = {
    subscribe: subscribe,
    getState: getState,
    getOrderSnapshot: getOrderSnapshot,
    isValidOrderCode: isValidOrderCode,
    loginCustomer: loginCustomer,
    loginAdmin: loginAdmin,
    logout: logout,
    setAdminSelectedOrder: setAdminSelectedOrder,
    addFilesToDraft: addFilesToDraft,
    updateDraftMemory: updateDraftMemory,
    removeDraftMemory: removeDraftMemory,
    moveDraftMemory: moveDraftMemory,
    reorderDraftMemory: reorderDraftMemory,
    submitDraft: submitDraft,
    loadMockData: loadMockData,
  };
})();
