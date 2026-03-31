(function () {
  var helpers = window.AnimuzesiHelpers;
  var orientationApi = window.AnimuzesiOrientation;
  var supabaseApi = window.AnimuzesiSupabase;

  var STORAGE_KEYS = {
    auth: "animuzesi_portal_auth",
    adminSelection: "animuzesi_portal_admin_selection",
  };

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

  function hydrateState() {
    var auth = safeParse(safeStorageGet(STORAGE_KEYS.auth), {
      role: null,
      orderCode: null,
      loggedIn: false,
    });

    return {
      auth: {
        role: auth && auth.loggedIn ? auth.role : null,
        orderCode: auth && auth.loggedIn ? auth.orderCode : null,
        loggedIn: Boolean(auth && auth.loggedIn),
      },
      orders: [],
      orderEntries: {},
      adminSelectedOrder: safeStorageGet(STORAGE_KEYS.adminSelection) || null,
      isBusy: false,
    };
  }

  function persist() {
    safeStorageSet(STORAGE_KEYS.auth, JSON.stringify(state.auth));
    if (state.adminSelectedOrder) {
      safeStorageSet(STORAGE_KEYS.adminSelection, state.adminSelectedOrder);
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function deriveFileName(url) {
    if (!url) {
      return "isimsiz_gorsel.jpg";
    }

    var cleanUrl = String(url).split("?")[0];
    var parts = cleanUrl.split("/");
    return parts[parts.length - 1] || "isimsiz_gorsel.jpg";
  }

  function mapEntryRow(row) {
    var resolvedImageUrl = supabaseApi.resolveStorageImageUrl(row.image_url || "");
    return {
      id: row.id,
      title: row.title || "",
      date: row.date_text || "",
      memoryText: row.description || "",
      previewUrl: resolvedImageUrl,
      image_url: resolvedImageUrl,
      originalFileName: deriveFileName(resolvedImageUrl || row.image_url),
      sortOrder: row.sort_order || 1,
      orientation: row.orientation || "portrait",
      imageWidth: 0,
      imageHeight: 0,
      createdAt: row.created_at || "",
      submittedAt: row.created_at || "",
      dateLabel: helpers.inferDateLabel(row.date_text || ""),
    };
  }

  function revokePreviewUrl(entry) {
    if (entry && entry.isObjectPreview && entry.previewUrl) {
      try {
        URL.revokeObjectURL(entry.previewUrl);
      } catch (error) {
        console.warn("Object URL kaldırılamadı:", error);
      }
    }
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

  function getEntriesForOrder(orderCode) {
    return state.orderEntries[orderCode] ? state.orderEntries[orderCode].slice() : [];
  }

  function getCurrentEntries() {
    var orderCode = getCurrentOrderCode();
    return orderCode ? getEntriesForOrder(orderCode) : [];
  }

  function getAllOrdersSnapshot() {
    var grouped = {};
    state.orders.forEach(function (order) {
      grouped[order.order_no] = {
        draft: clone(getEntriesForOrder(order.order_no)),
        submitted: clone(getEntriesForOrder(order.order_no)),
      };
    });
    return grouped;
  }

  function getState() {
    return {
      auth: clone(state.auth),
      validOrderCodes: state.orders.map(function (order) {
        return order.order_no;
      }),
      currentOrderCode: getCurrentOrderCode(),
      customerDraft: clone(getCurrentEntries()),
      submittedMemories: clone(getCurrentEntries()),
      allOrders: getAllOrdersSnapshot(),
      adminSelectedOrder: state.adminSelectedOrder,
      isBusy: state.isBusy,
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

  function setBusy(value) {
    state.isBusy = Boolean(value);
    emit();
  }

  function normalizeOrderEntries(entries) {
    return entries
      .slice()
      .sort(function (a, b) {
        if (a.sortOrder === b.sortOrder) {
          return String(a.id).localeCompare(String(b.id));
        }
        return a.sortOrder - b.sortOrder;
      })
      .map(function (item, index) {
        return Object.assign({}, item, { sortOrder: index + 1 });
      });
  }

  function setEntriesForOrder(orderNo, entries) {
    state.orderEntries[orderNo] = normalizeOrderEntries(entries);
  }

  function replaceEntry(orderNo, entryId, updater) {
    var current = getEntriesForOrder(orderNo);
    setEntriesForOrder(
      orderNo,
      current.map(function (entry) {
        if (String(entry.id) !== String(entryId)) {
          return entry;
        }
        return updater(entry);
      })
    );
  }

  async function fetchOrders() {
    var client = supabaseApi.getClient();
    var response = await client
      .from("orders")
      .select("id, order_no, created_at")
      .order("created_at", { ascending: true });

    if (response.error) {
      throw response.error;
    }

    state.orders = response.data || [];

    if (!state.adminSelectedOrder && state.orders.length) {
      state.adminSelectedOrder = state.orders[0].order_no;
    }

    return state.orders;
  }

  async function fetchEntriesForOrder(orderNo) {
    var client = supabaseApi.getClient();
    var response = await client
      .from("memory_entries")
      .select("id, order_no, title, date_text, description, image_url, sort_order, orientation, created_at")
      .eq("order_no", orderNo)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (response.error) {
      throw response.error;
    }

    var mapped = (response.data || []).map(mapEntryRow);
    setEntriesForOrder(orderNo, mapped);
    return mapped;
  }

  async function fetchAllEntries() {
    var client = supabaseApi.getClient();
    var response = await client
      .from("memory_entries")
      .select("id, order_no, title, date_text, description, image_url, sort_order, orientation, created_at")
      .order("order_no", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (response.error) {
      throw response.error;
    }

    var grouped = {};
    (response.data || []).forEach(function (row) {
      if (!grouped[row.order_no]) {
        grouped[row.order_no] = [];
      }
      grouped[row.order_no].push(mapEntryRow(row));
    });

    state.orders.forEach(function (order) {
      setEntriesForOrder(order.order_no, grouped[order.order_no] || []);
    });
  }

  async function hydrateCustomerOrder(orderNo) {
    await fetchOrders();
    var exists = state.orders.some(function (order) {
      return order.order_no === orderNo;
    });

    if (!exists) {
      throw new Error("Geçerli bir sipariş numarası girin.");
    }

    await fetchEntriesForOrder(orderNo);
  }

  async function refreshAdminData() {
    await fetchOrders();
    await fetchAllEntries();
  }

  async function loginCustomer(orderCode) {
    var normalized = String(orderCode || "").trim().toUpperCase();

    if (!normalized) {
      return {
        ok: false,
        message: "Geçerli bir sipariş numarası girin.",
      };
    }

    try {
      setBusy(true);
      await hydrateCustomerOrder(normalized);
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
    } catch (error) {
      return {
        ok: false,
        message: error.message || "Sipariş doğrulanamadı.",
      };
    } finally {
      setBusy(false);
    }
  }

  async function loginAdmin(password) {
    if (String(password || "") !== ADMIN_PASSWORD) {
      return {
        ok: false,
        message: "Şifre yanlış. Lütfen tekrar deneyin.",
      };
    }

    try {
      setBusy(true);
      await refreshAdminData();
      state.auth = {
        role: "admin",
        orderCode: null,
        loggedIn: true,
      };
      if (!state.adminSelectedOrder && state.orders.length) {
        state.adminSelectedOrder = state.orders[0].order_no;
      }
      emit();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error.message || "Admin verileri alınamadı.",
      };
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    state.auth = {
      role: null,
      orderCode: null,
      loggedIn: false,
    };
    emit();
  }

  async function restoreSession() {
    if (!state.auth.loggedIn) {
      return;
    }

    try {
      setBusy(true);
      if (state.auth.role === "customer" && state.auth.orderCode) {
        await hydrateCustomerOrder(state.auth.orderCode);
      }

      if (state.auth.role === "admin") {
        await refreshAdminData();
      }
    } catch (error) {
      console.error(error);
      logout();
    } finally {
      setBusy(false);
    }
  }

  async function setAdminSelectedOrder(orderCode) {
    if (!orderCode) {
      return;
    }

    state.adminSelectedOrder = String(orderCode).toUpperCase();
    try {
      setBusy(true);
      await fetchEntriesForOrder(state.adminSelectedOrder);
    } finally {
      setBusy(false);
    }
  }

  async function syncSortOrder(orderNo, entries) {
    var client = supabaseApi.getClient();
    var ordered = normalizeOrderEntries(entries);
    setEntriesForOrder(orderNo, ordered);

    var responses = await Promise.all(
      ordered.map(function (entry, index) {
        return client
          .from("memory_entries")
          .update({ sort_order: index + 1 })
          .eq("id", entry.id);
      })
    );

    var failed = responses.find(function (response) {
      return response.error;
    });

    if (failed) {
      throw failed.error;
    }

    emit();
  }

  async function addFilesToDraft(fileList) {
    var orderCode = getCurrentOrderCode();
    var files = Array.prototype.slice.call(fileList || []);
    if (!orderCode || !files.length) {
      return;
    }

    try {
      setBusy(true);
      var existing = getEntriesForOrder(orderCode);
      for (var i = 0; i < files.length; i += 1) {
        var file = files[i];
        if (!file.type || file.type.indexOf("image/") !== 0) {
          continue;
        }

        var localPreviewUrl = URL.createObjectURL(file);
        var tempId = helpers.generateId();
        var optimisticEntry = helpers.createMemoryRecord({
          id: tempId,
          title: "",
          date: "",
          memoryText: "",
          previewUrl: localPreviewUrl,
          image_url: "",
          originalFileName: file.name,
          mimeType: file.type,
          sortOrder: getEntriesForOrder(orderCode).length + 1,
          orientation: "portrait",
          imageWidth: 0,
          imageHeight: 0,
          isUploading: true,
          isObjectPreview: true,
        });

        setEntriesForOrder(orderCode, getEntriesForOrder(orderCode).concat([optimisticEntry]));
        emit();

        var metadata = await orientationApi.getImageMetadata(localPreviewUrl);
        replaceEntry(orderCode, tempId, function (entry) {
          return Object.assign({}, entry, {
            orientation: metadata.orientation,
            imageWidth: metadata.width,
            imageHeight: metadata.height,
          });
        });
        emit();

        var upload = await supabaseApi.uploadMemoryFile(orderCode, file);
        var client = supabaseApi.getClient();
        var insertResponse = await client
          .from("memory_entries")
          .insert({
            order_no: orderCode,
            title: "",
            date_text: "",
            description: "",
            image_url: upload.imageUrl,
            sort_order: optimisticEntry.sortOrder,
            orientation: metadata.orientation,
          })
          .select("id, order_no, title, date_text, description, image_url, sort_order, orientation, created_at")
          .single();

        if (insertResponse.error) {
          throw insertResponse.error;
        }

        var persistedEntry = mapEntryRow(insertResponse.data);
        persistedEntry.imageWidth = metadata.width;
        persistedEntry.imageHeight = metadata.height;
        persistedEntry.isUploading = false;
        persistedEntry.isObjectPreview = false;
        var nextEntries = getEntriesForOrder(orderCode).map(function (entry) {
          if (entry.id === tempId) {
            return Object.assign({}, persistedEntry, {
              previewUrl: supabaseApi.resolveStorageImageUrl(upload.imageUrl),
              image_url: supabaseApi.resolveStorageImageUrl(upload.imageUrl),
            });
          }
          return entry;
        });
        setEntriesForOrder(orderCode, nextEntries);
        revokePreviewUrl(optimisticEntry);
        emit();
      }
      await fetchEntriesForOrder(orderCode);
      emit();
    } catch (error) {
      var currentEntries = getEntriesForOrder(orderCode);
      currentEntries.forEach(function (entry) {
        if (entry.isUploading) {
          revokePreviewUrl(entry);
        }
      });
      setEntriesForOrder(
        orderCode,
        currentEntries.filter(function (entry) {
          return !entry.isUploading;
        })
      );
      emit();
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function updateDraftMemory(id, updates) {
    var orderCode = getCurrentOrderCode();
    var current = getEntriesForOrder(orderCode);
    var target = current.find(function (item) {
      return String(item.id) === String(id);
    });

    if (!target) {
      return;
    }

    var next = current.map(function (item) {
      if (String(item.id) !== String(id)) {
        return item;
      }

      return Object.assign({}, item, {
        title: helpers.sanitizeText(updates.title != null ? updates.title : item.title),
        date: helpers.sanitizeText(updates.date != null ? updates.date : item.date),
        memoryText: helpers.sanitizeText(updates.memoryText != null ? updates.memoryText : item.memoryText),
      });
    });

    setEntriesForOrder(orderCode, next);
    emit();

    var updated = next.find(function (item) {
      return String(item.id) === String(id);
    });

    var response = await supabaseApi
      .getClient()
      .from("memory_entries")
      .update({
        title: updated.title,
        date_text: updated.date,
        description: updated.memoryText,
        sort_order: updated.sortOrder,
        orientation: updated.orientation,
      })
      .eq("id", id);

    if (response.error) {
      throw response.error;
    }
  }

  async function removeDraftMemory(id) {
    var orderCode = getCurrentOrderCode();
    var currentEntries = getEntriesForOrder(orderCode);
    var target = currentEntries.find(function (item) {
      return String(item.id) === String(id);
    });
    var next = currentEntries.filter(function (item) {
      return String(item.id) !== String(id);
    });

    if (target && target.isUploading) {
      revokePreviewUrl(target);
      setEntriesForOrder(orderCode, next);
      emit();
      return;
    }

    var deleteResponse = await supabaseApi.getClient().from("memory_entries").delete().eq("id", id);
    if (deleteResponse.error) {
      throw deleteResponse.error;
    }

    await syncSortOrder(orderCode, next);
  }

  async function moveDraftMemory(id, direction) {
    var orderCode = getCurrentOrderCode();
    var current = getEntriesForOrder(orderCode);
    var currentIndex = current.findIndex(function (item) {
      return String(item.id) === String(id);
    });

    if (currentIndex === -1) {
      return;
    }

    var targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= current.length) {
      return;
    }

    var next = current.slice();
    var moved = next.splice(currentIndex, 1)[0];
    next.splice(targetIndex, 0, moved);
    await syncSortOrder(orderCode, next);
  }

  async function reorderDraftMemory(fromId, toId) {
    var orderCode = getCurrentOrderCode();
    var placement = arguments.length > 2 ? arguments[2] : "before";
    if (String(fromId) === String(toId)) {
      return;
    }

    var current = getEntriesForOrder(orderCode);
    var fromIndex = current.findIndex(function (item) {
      return String(item.id) === String(fromId);
    });
    var toIndex = current.findIndex(function (item) {
      return String(item.id) === String(toId);
    });

    if (fromIndex === -1 || toIndex === -1) {
      return;
    }

    var next = current.slice();
    var moved = next.splice(fromIndex, 1)[0];
    var insertionIndex = toIndex;

    if (fromIndex < toIndex) {
      insertionIndex -= 1;
    }

    if (placement === "after") {
      insertionIndex += 1;
    }

    if (insertionIndex < 0) {
      insertionIndex = 0;
    }

    if (insertionIndex > next.length) {
      insertionIndex = next.length;
    }

    next.splice(insertionIndex, 0, moved);
    await syncSortOrder(orderCode, next);
  }

  async function submitDraft() {
    var orderCode = getCurrentOrderCode();
    if (!orderCode) {
      return;
    }

    await fetchEntriesForOrder(orderCode);
    emit();
  }

  window.AnimuzesiStore = {
    subscribe: subscribe,
    getState: getState,
    loginCustomer: loginCustomer,
    loginAdmin: loginAdmin,
    logout: logout,
    restoreSession: restoreSession,
    setAdminSelectedOrder: setAdminSelectedOrder,
    addFilesToDraft: addFilesToDraft,
    updateDraftMemory: updateDraftMemory,
    removeDraftMemory: removeDraftMemory,
    moveDraftMemory: moveDraftMemory,
    reorderDraftMemory: reorderDraftMemory,
    submitDraft: submitDraft,
    fetchEntriesForOrder: fetchEntriesForOrder,
  };
})();
