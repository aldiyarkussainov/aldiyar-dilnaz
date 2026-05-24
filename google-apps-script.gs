/**
 * RSVP → Google Sheets endpoint.
 * Колонки таблицы: timestamp | name | attending | guests | userAgent
 * Полная инструкция деплоя — в README.md
 */

const SHEET_NAME = "RSVP";

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const sheet = getOrCreateSheet_(SHEET_NAME);

    // ── DELETE ────────────────────────────────────────
    // Удаление RSVP по timestamp. Юзер на сайте нажал «Жауапты жою».
    if (body.action === "delete" && body.timestamp) {
      const values = sheet.getDataRange().getValues();
      // идём с конца, чтобы удалить даже если по ошибке несколько с тем же ts
      for (let i = values.length - 1; i >= 1; i--) {
        if (String(values[i][0]) === String(body.timestamp)) {
          sheet.deleteRow(i + 1); // +1 — листы 1-индексированные
        }
      }
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, deleted: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── CREATE ────────────────────────────────────────
    sheet.appendRow([
      body.timestamp || new Date().toISOString(),
      body.name      || "",
      body.attending || "",
      body.guests    || "",
      body.userAgent || "",
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// GET — простая проверка, что endpoint живой. Открой URL в браузере — увидишь "ok".
function doGet() {
  return ContentService.createTextOutput("ok");
}

function getOrCreateSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(["timestamp", "name", "attending", "guests", "userAgent"]);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}
