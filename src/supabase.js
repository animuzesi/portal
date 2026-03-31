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

  window.AnimuzesiSupabase = {
    getClient: getClient,
    uploadMemoryFile: uploadMemoryFile,
  };
})();
