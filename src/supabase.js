(function () {
  function getConfig() {
    var config = window.AnimuzesiConfig || {};
    if (!config.NEXT_PUBLIC_SUPABASE_URL || !config.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error("Supabase ayarları eksik.");
    }
    return config;
  }

  function getClient() {
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Supabase istemcisi yüklenemedi.");
    }

    if (!window.__animuzesiSupabaseClient) {
      var config = getConfig();
      window.__animuzesiSupabaseClient = window.supabase.createClient(
        config.NEXT_PUBLIC_SUPABASE_URL,
        config.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
    }

    return window.__animuzesiSupabaseClient;
  }

  function sanitizePathPart(value) {
    return String(value || "file")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "file";
  }

  function getFileExtension(file) {
    var fileName = file && file.name ? file.name : "image.jpg";
    var parts = fileName.split(".");
    if (parts.length > 1) {
      return parts.pop().toLowerCase();
    }

    if (file && file.type) {
      if (file.type.indexOf("png") > -1) return "png";
      if (file.type.indexOf("webp") > -1) return "webp";
      if (file.type.indexOf("jpeg") > -1 || file.type.indexOf("jpg") > -1) return "jpg";
    }

    return "jpg";
  }

  async function uploadMemoryFile(orderNo, file) {
    var client = getClient();
    var extension = getFileExtension(file);
    var safeOrderNo = sanitizePathPart(orderNo);
    var safeFileName = sanitizePathPart(file && file.name ? file.name.replace(/\.[^.]+$/, "") : "memory");
    var path = safeOrderNo + "/" + Date.now() + "-" + Math.floor(Math.random() * 100000) + "-" + safeFileName + "." + extension;

    var uploadResult = await client.storage
      .from("memory-uploads")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadResult.error) {
      throw uploadResult.error;
    }

    var publicUrlResult = client.storage.from("memory-uploads").getPublicUrl(path);
    return {
      path: path,
      imageUrl: publicUrlResult.data.publicUrl,
    };
  }

  function resolveStorageImageUrl(value) {
    if (!value) {
      return "";
    }

    if (/^https?:\/\//i.test(value) || /^blob:/i.test(value) || /^data:/i.test(value)) {
      return value;
    }

    var path = String(value).replace(/^memory-uploads\//, "").replace(/^\/+/, "");
    var publicUrlResult = getClient().storage.from("memory-uploads").getPublicUrl(path);
    return publicUrlResult && publicUrlResult.data && publicUrlResult.data.publicUrl
      ? publicUrlResult.data.publicUrl
      : "";
  }

  function extractStoragePath(value) {
    if (!value) {
      return "";
    }

    var normalized = String(value).trim();
    if (!normalized) {
      return "";
    }

    if (!/^https?:\/\//i.test(normalized)) {
      return normalized.replace(/^memory-uploads\//, "").replace(/^\/+/, "");
    }

    try {
      var url = new URL(normalized);
      var markerIndex = url.pathname.indexOf("/storage/v1/object/");
      if (markerIndex === -1) {
        return "";
      }

      var remainder = url.pathname.slice(markerIndex + "/storage/v1/object/".length);
      var segments = remainder.split("/").filter(Boolean);
      if (!segments.length) {
        return "";
      }

      if (segments[0] === "public" || segments[0] === "sign" || segments[0] === "authenticated") {
        segments.shift();
      }

      if (segments[0] === "memory-uploads") {
        segments.shift();
      }

      return segments.join("/");
    } catch (error) {
      return "";
    }
  }

  async function createSignedStorageUrl(path, expiresInSeconds) {
    if (!path) {
      return "";
    }

    var response = await getClient()
      .storage
      .from("memory-uploads")
      .createSignedUrl(path, expiresInSeconds || 3600);

    if (response.error) {
      throw response.error;
    }

    return response.data && response.data.signedUrl ? response.data.signedUrl : "";
  }

  async function ensureAccessibleImageUrl(value) {
    if (!value) {
      return "";
    }

    if (/^blob:/i.test(value) || /^data:/i.test(value)) {
      return value;
    }

    var path = extractStoragePath(value);
    if (path) {
      try {
        var signedUrl = await createSignedStorageUrl(path, 3600);
        if (signedUrl) {
          return signedUrl;
        }
      } catch (error) {
        console.warn("Signed URL üretilemedi, public URL kullanılacak:", error);
      }

      return resolveStorageImageUrl(path);
    }

    return resolveStorageImageUrl(value);
  }

  window.AnimuzesiSupabase = {
    getClient: getClient,
    uploadMemoryFile: uploadMemoryFile,
    resolveStorageImageUrl: resolveStorageImageUrl,
    extractStoragePath: extractStoragePath,
    createSignedStorageUrl: createSignedStorageUrl,
    ensureAccessibleImageUrl: ensureAccessibleImageUrl,
  };
})();
