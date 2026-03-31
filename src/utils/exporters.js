(function () {
  var helpers = window.AnimuzesiHelpers;
  var orientationApi = window.AnimuzesiOrientation;

  function createMuseumEntry(item, index) {
    var sequenceNumber = String(index + 1).padStart(2, "0");
    var fileName = "memory_" + sequenceNumber + ".jpg";
    var orientation = orientationApi.resolveOrientation(item);
    var basePath = "assets/photos/" + orientation + "/" + fileName;

    return {
      id: index + 1,
      image: basePath,
      orientation: orientation,
      frameType: orientation,
      wallLabelTitle: item.title || "Başlıksız Anı",
      wallLabelSubtitle: item.date || "Tarih eklenmedi",
      modalTitle: item.title || "Başlıksız Anı",
      modalDate: item.date || "Tarih eklenmedi",
      modalDescription: item.memoryText || "Açıklama eklenmedi",
      plannedFileName: fileName,
      originalFileName: item.originalFileName || "isimsiz_gorsel.jpg",
      imageWidth: item.imageWidth || 0,
      imageHeight: item.imageHeight || 0,
    };
  }

  function buildMuseumDataset(memories) {
    return memories
      .slice()
      .sort(function (a, b) {
        return a.sortOrder - b.sortOrder;
      })
      .map(createMuseumEntry);
  }

  function splitMuseumData(entries) {
    return {
      realMemories: entries.slice(0, 24),
      extraMemories: entries.slice(24),
    };
  }

  function createMuseumCode(entries) {
    var objects = entries
      .map(function (entry) {
        return (
          "{\n" +
          "  id: " +
          entry.id +
          ",\n" +
          '  image: "' +
          entry.image +
          '\",\n' +
          '  orientation: "' +
          entry.orientation +
          '\",\n' +
          '  frameType: "' +
          entry.frameType +
          '\",\n' +
          '  wallLabelTitle: "' +
          helpers.escapeForTemplate(entry.wallLabelTitle) +
          '\",\n' +
          '  wallLabelSubtitle: "' +
          helpers.escapeForTemplate(entry.wallLabelSubtitle) +
          '\",\n' +
          '  modalTitle: "' +
          helpers.escapeForTemplate(entry.modalTitle) +
          '\",\n' +
          '  modalDate: "' +
          helpers.escapeForTemplate(entry.modalDate) +
          '\",\n' +
          '  modalDescription: "' +
          helpers.escapeForTemplate(entry.modalDescription) +
          '"\n' +
          "}"
        );
      })
      .join(",\n");

    return "[\n" + objects + "\n]";
  }

  function createNamedExport(name, entries) {
    return "export const " + name + " = " + createMuseumCode(entries) + ";";
  }

  function createGroupedRenameList(entries) {
    var portrait = entries.filter(function (entry) {
      return entry.orientation === "portrait";
    });
    var landscape = entries.filter(function (entry) {
      return entry.orientation === "landscape";
    });

    function renderGroup(title, items) {
      return (
        title +
        "\n" +
        (items.length
          ? items
              .map(function (entry) {
                return (
                  entry.originalFileName +
                  " -> assets/photos/" +
                  entry.orientation +
                  "/" +
                  entry.plannedFileName
                );
              })
              .join("\n")
          : "Kayıt yok")
      );
    }

    return [renderGroup("PORTRAIT", portrait), renderGroup("LANDSCAPE", landscape)].join(
      "\n\n"
    );
  }

  function createJsonExport(memories, entries) {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        count: entries.length,
        raw: memories,
        museumEntries: entries,
      },
      null,
      2
    );
  }

  function findMissingFields(item) {
    var missing = [];

    if (!item.title || !item.title.trim()) missing.push("Başlık");
    if (!item.date || !item.date.trim()) missing.push("Tarih");
    if (!item.memoryText || !item.memoryText.trim()) missing.push("Anı metni");

    return missing;
  }

  window.AnimuzesiExporters = {
    buildMuseumDataset: buildMuseumDataset,
    splitMuseumData: splitMuseumData,
    createMuseumCode: createMuseumCode,
    createNamedExport: createNamedExport,
    createGroupedRenameList: createGroupedRenameList,
    createJsonExport: createJsonExport,
    findMissingFields: findMissingFields,
  };
})();
