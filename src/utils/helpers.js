(function () {
  function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return "memory_" + window.crypto.randomUUID();
    }

    return "memory_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
  }

  function sanitizeText(value) {
    return String(value == null ? "" : value).replace(/^\s+/, "");
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function createMemoryRecord(overrides) {
    return Object.assign(
      {
        id: "",
        sortOrder: 1,
        title: "",
        date: "",
        memoryText: "",
        previewUrl: "",
        image_url: "",
        originalFileName: "",
        mimeType: "image/jpeg",
        orientation: "portrait",
        submittedAt: "",
        dateLabel: "",
      },
      overrides || {}
    );
  }

  function inferDateLabel(value) {
    return value && String(value).trim() ? String(value).trim() : "Tarih eklenmedi";
  }

  function isUsableImageSource(value) {
    if (!value) {
      return false;
    }

    var normalized = String(value).trim();
    if (!normalized) {
      return false;
    }

    return /^(https?:\/\/|blob:|data:image\/)/i.test(normalized);
  }

  function canLoadImage(src, timeoutMs) {
    return new Promise(function (resolve) {
      if (!isUsableImageSource(src)) {
        resolve(false);
        return;
      }

      var image = new Image();
      var settled = false;
      var timer = window.setTimeout(function () {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      }, timeoutMs || 4000);

      image.onload = function () {
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          resolve(true);
        }
      };

      image.onerror = function () {
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          resolve(false);
        }
      };

      image.src = src;
    });
  }

  function getImagePlaceholderUrl() {
    return (
      "data:image/svg+xml;charset=UTF-8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000">' +
          '<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">' +
          '<stop offset="0%" stop-color="#eadfce" />' +
          '<stop offset="100%" stop-color="#f6efe5" />' +
          "</linearGradient></defs>" +
          '<rect width="100%" height="100%" fill="url(#g)" />' +
          '<circle cx="400" cy="360" r="120" fill="rgba(181,101,69,0.16)" />' +
          '<path d="M220 720l140-170 110 110 70-85 140 145v90H220z" fill="rgba(141,68,39,0.18)" />' +
          '<text x="50%" y="83%" dominant-baseline="middle" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="34" fill="#8d4427">Gorsel hazirlaniyor</text>' +
          "</svg>"
      )
    );
  }

  function resolveImageSrc(item) {
    var supabaseApi = window.AnimuzesiSupabase;
    var rawImageValue = item ? item.image_url || item.imageUrl || "" : "";

    if (item && isUsableImageSource(item.previewUrl)) {
      return item.previewUrl;
    }

    if (item && isUsableImageSource(item.resolvedImageUrl)) {
      return item.resolvedImageUrl;
    }

    if (item && isUsableImageSource(rawImageValue)) {
      return rawImageValue;
    }

    if (
      item &&
      rawImageValue &&
      supabaseApi &&
      typeof supabaseApi.resolveStorageImageUrl === "function"
    ) {
      var resolvedImageUrl = supabaseApi.resolveStorageImageUrl(rawImageValue);
      if (isUsableImageSource(resolvedImageUrl)) {
        return resolvedImageUrl;
      }
    }

    return null;
  }

  function getFallbackImageSource(item, currentSource) {
    var current = String(currentSource || "");
    var supabaseApi = window.AnimuzesiSupabase;
    var rawImageValue = item ? item.image_url || item.imageUrl || "" : "";

    if (
      item &&
      isUsableImageSource(item.previewUrl) &&
      current !== String(item.previewUrl)
    ) {
      return item.previewUrl;
    }

    if (
      item &&
      isUsableImageSource(item.resolvedImageUrl) &&
      current !== String(item.resolvedImageUrl)
    ) {
      return item.resolvedImageUrl;
    }

    if (
      item &&
      isUsableImageSource(rawImageValue) &&
      current !== String(rawImageValue)
    ) {
      return rawImageValue;
    }

    if (
      item &&
      rawImageValue &&
      supabaseApi &&
      typeof supabaseApi.resolveStorageImageUrl === "function"
    ) {
      var resolvedImageUrl = supabaseApi.resolveStorageImageUrl(rawImageValue);
      if (isUsableImageSource(resolvedImageUrl) && current !== String(resolvedImageUrl)) {
        return resolvedImageUrl;
      }
    }

    return null;
  }

  function getDisplayImageSrc(item) {
    return resolveImageSrc(item) || getImagePlaceholderUrl();
  }

  function triggerBlobDownload(blob, filename) {
    var objectUrl = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(objectUrl);
    }, 1000);
  }

  async function downloadFileFromUrl(url, filename) {
    if (!isUsableImageSource(url)) {
      throw new Error("İndirilecek geçerli bir görsel URL'si bulunamadı.");
    }

    var response = await fetch(url);
    if (!response.ok) {
      throw new Error("Görsel indirilemedi.");
    }

    var blob = await response.blob();
    triggerBlobDownload(blob, filename);
  }

  async function downloadFilesAsZip(options) {
    var items = options && Array.isArray(options.items) ? options.items : [];
    var zipName = (options && options.zipName) || "downloads.zip";

    if (!window.JSZip) {
      throw new Error("ZIP kütüphanesi yüklenemedi.");
    }

    var zip = new window.JSZip();
    var failures = [];

    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      try {
        if (!isUsableImageSource(item.url)) {
          throw new Error("Geçerli görsel URL'si yok");
        }

        var response = await fetch(item.url);
        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }

        var blob = await response.blob();
        zip.file(item.zipPath || item.fileName || ("file-" + (i + 1)), blob);
      } catch (error) {
        failures.push({
          fileName: item.fileName || ("file-" + (i + 1)),
          message: error.message || "İndirilemedi",
        });
      }
    }

    var hasFiles = Object.keys(zip.files).length > 0;
    if (!hasFiles) {
      throw new Error(
        failures.length
          ? "Hiçbir görsel indirilemedi. " +
            failures.map(function (item) {
              return item.fileName + ": " + item.message;
            }).join(" | ")
          : "İndirilecek dosya bulunamadı."
      );
    }

    var zipBlob = await zip.generateAsync({ type: "blob" });
    triggerBlobDownload(zipBlob, zipName);

    return {
      downloadedCount: Object.keys(zip.files).length,
      failures: failures,
    };
  }

  function escapeForTemplate(value) {
    return String(value == null ? "" : value)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n");
  }

  function downloadTextFile(filename, content, type) {
    var blob = new Blob([content], { type: type || "application/json" });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    return true;
  }

  window.AnimuzesiHelpers = {
    generateId: generateId,
    sanitizeText: sanitizeText,
    fileToDataUrl: fileToDataUrl,
    createMemoryRecord: createMemoryRecord,
    inferDateLabel: inferDateLabel,
    isUsableImageSource: isUsableImageSource,
    canLoadImage: canLoadImage,
    getImagePlaceholderUrl: getImagePlaceholderUrl,
    resolveImageSrc: resolveImageSrc,
    getFallbackImageSource: getFallbackImageSource,
    getDisplayImageSrc: getDisplayImageSrc,
    escapeForTemplate: escapeForTemplate,
    downloadTextFile: downloadTextFile,
    downloadFileFromUrl: downloadFileFromUrl,
    downloadFilesAsZip: downloadFilesAsZip,
    copyToClipboard: copyToClipboard,
  };
})();
