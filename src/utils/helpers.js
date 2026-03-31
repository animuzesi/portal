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
    escapeForTemplate: escapeForTemplate,
    downloadTextFile: downloadTextFile,
    copyToClipboard: copyToClipboard,
  };
})();
