(function () {
  function getImageMetadata(src) {
    return new Promise(function (resolve) {
      var image = new Image();

      image.onload = function () {
        var width = image.naturalWidth || 0;
        var height = image.naturalHeight || 0;
        resolve({
          width: width,
          height: height,
          orientation: height >= width ? "portrait" : "landscape",
        });
      };

      image.onerror = function () {
        resolve({
          width: 0,
          height: 0,
          orientation: "portrait",
        });
      };

      image.src = src;
    });
  }

  function detectImageOrientation(src) {
    return new Promise(function (resolve) {
      getImageMetadata(src).then(function (metadata) {
        resolve(metadata.orientation);
      });
    });
  }

  function resolveOrientation(record) {
    var width = Number(record && record.imageWidth ? record.imageWidth : 0);
    var height = Number(record && record.imageHeight ? record.imageHeight : 0);

    if (width > 0 && height > 0) {
      return height >= width ? "portrait" : "landscape";
    }

    if (record && record.orientation === "landscape") {
      return "landscape";
    }

    return "portrait";
  }

  window.AnimuzesiOrientation = {
    getImageMetadata: getImageMetadata,
    detectImageOrientation: detectImageOrientation,
    resolveOrientation: resolveOrientation,
  };
})();
