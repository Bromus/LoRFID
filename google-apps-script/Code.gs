// REMINDER: After editing, Deploy → Manage deployments → Edit → Version: New version → Deploy
//
// Backup copy of the web app script (doGet / order + sorry handlers).
// Paste into Apps Script editor if you need to restore or compare.

function doGet(e) {
  var ACCEPT_SHEET_ID = "1BF7hsJHva_Xqr6VKsVe28pYAy92ZNDZ1ZQR-z5U8EGY";
  var ORDERS_SHEET_ID = "1q0wZ-zyKorAVemr-Cv9fFUVurwpfLuHscXGFW7CRNg0";

  e = e || {};
  var params = e.parameter || {};

  var mode     = params.mode     || "";
  var token    = params.token    || "";
  var name     = params.name     || "";
  var redirect = params.redirect || "";

  if (mode === "pass_attempt") {
    return handlePassAttempt(e, ORDERS_SHEET_ID, token, name);
  }
  if (mode === "orders_status") {
    return handleOrdersStatus(e, ORDERS_SHEET_ID, token, name);
  }
  if (mode === "next_order") {
    return handleNextOrder(e, ORDERS_SHEET_ID, token, name);
  }
  if (mode === "peek_next_order") {
    return handlePeekNextOrder(e, ORDERS_SHEET_ID, token, name);
  }
  if (mode === "sorry_increment") {
    return handleSorryIncrement(e, ORDERS_SHEET_ID, token, name);
  }
  if (mode === "sorry_count") {
    return handleSorryCount(e, ORDERS_SHEET_ID, token, name);
  }

  // Default: accepted.html logging
  var ss = SpreadsheetApp.openById(ACCEPT_SHEET_ID);
  var sheet = ss.getSheets()[0];
  var now = new Date();
  var acceptedAt = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  var nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, 1, 1, 6).setValues([[now, token, name, acceptedAt, "", ""]]);

  if (redirect) {
    return HtmlService.createHtmlOutput(
      '<script>window.location.href=' + JSON.stringify(redirect) + ';</script>'
    );
  }
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  return doGet(e);
}

function handlePassAttempt(e, sheetId, token, name) {
  var params = e.parameter || {};
  var attemptedPass = params.attemptedPass || "";
  var correctPass  = params.correctPass   || "";

  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName("passes");
  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "passes sheet not found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var now = new Date();
  var timeString = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  var lastRow = sheet.getLastRow();
  var attemptNumber = Math.max(lastRow - 1, 0) + 1;

  sheet.getRange(lastRow + 1, 1, 1, 7).setValues([[
    attemptNumber, attemptedPass, correctPass, token, name, timeString, ""
  ]]);

  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleOrdersStatus(e, sheetId, token, name) {
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName("Orders");
  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "Orders sheet not found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return ContentService
      .createTextOutput(JSON.stringify({ lastOrderCompleted: false, nextOrderGiven: false }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var rows = data.slice(1);
  var targetName = (name || "").toString().trim().toLowerCase();
  var targetToken = (token || "").toString().trim();

  var userIndexes = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var rowToken = (row[6] || "").toString().trim();
    var rowName  = (row[7] || "").toString().trim().toLowerCase();
    if (rowName === targetName && (!targetToken || rowToken === targetToken)) {
      userIndexes.push(i);
    }
  }

  if (userIndexes.length === 0) {
    return ContentService
      .createTextOutput(JSON.stringify({ lastOrderCompleted: false, nextOrderGiven: false }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var lastGivenIdx = -1;
  for (var j = 0; j < userIndexes.length; j++) {
    var idx = userIndexes[j];
    if (rows[idx][2]) lastGivenIdx = idx; // OrderGiven col 3
  }

  if (lastGivenIdx === -1) {
    return ContentService
      .createTextOutput(JSON.stringify({ lastOrderCompleted: false, nextOrderGiven: false }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var lastCompleted = !!rows[lastGivenIdx][4]; // OrderCompleted col 5
  if (!lastCompleted) {
    return ContentService
      .createTextOutput(JSON.stringify({ lastOrderCompleted: false, nextOrderGiven: false }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var nextOrderGiven = false;
  for (var k = lastGivenIdx + 1; k < rows.length; k++) {
    var r = rows[k];
    var rToken = (r[6] || "").toString().trim();
    var rName  = (r[7] || "").toString().trim().toLowerCase();
    if (rName === targetName && (!targetToken || rToken === targetToken)) {
      if (r[2]) nextOrderGiven = true;
      break;
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ lastOrderCompleted: true, nextOrderGiven: nextOrderGiven }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleNextOrder(e, sheetId, token, name) {
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName("Orders");
  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "Orders sheet not found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "no orders" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var rows = data.slice(1);
  var targetName = (name || "").toString().trim().toLowerCase();
  var targetToken = (token || "").toString().trim();

  var now = new Date();
  var tsString = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  var nextRowIndex = -1;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var rowToken = (row[6] || "").toString().trim();
    var rowName  = (row[7] || "").toString().trim().toLowerCase();
    if (rowName !== targetName) continue;
    if (targetToken && rowToken !== targetToken) continue;
    if (!row[2]) {
      nextRowIndex = i;
      break;
    }
  }

  if (nextRowIndex === -1) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "no remaining orders" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var targetRow = rows[nextRowIndex];
  var orderNumber = targetRow[0];
  var orderText   = targetRow[1];

  var sheetRowNumber = nextRowIndex + 2;
  sheet.getRange(sheetRowNumber, 3).setValue("YES");
  sheet.getRange(sheetRowNumber, 4).setValue(tsString);

  return ContentService
    .createTextOutput(JSON.stringify({ orderNumber: orderNumber, order: orderText }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handlePeekNextOrder(e, sheetId, token, name) {
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName("Orders");
  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "Orders sheet not found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "no orders" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var rows = data.slice(1);
  var targetName = (name || "").toString().trim().toLowerCase();
  var targetToken = (token || "").toString().trim();

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var rowToken = (row[6] || "").toString().trim();
    var rowName  = (row[7] || "").toString().trim().toLowerCase();
    if (rowName !== targetName) continue;
    if (targetToken && rowToken !== targetToken) continue;
    if (!row[2]) {
      return ContentService
        .createTextOutput(JSON.stringify({ orderNumber: row[0], order: row[1] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ error: "no remaining orders" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleSorryIncrement(e, sheetId, token, name) {
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName("Orders");
  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "Orders sheet not found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "no orders" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var rows = data.slice(1);
  var targetName = (name || "").toString().trim().toLowerCase();
  var targetToken = (token || "").toString().trim();

  var userIndexes = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var rowToken = (row[6] || "").toString().trim();
    var rowName  = (row[7] || "").toString().trim().toLowerCase();
    if (rowName === targetName && (!targetToken || rowToken === targetToken)) {
      userIndexes.push(i);
    }
  }

  if (userIndexes.length === 0) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "no user rows" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var lastGivenIdx = -1;
  for (var j = 0; j < userIndexes.length; j++) {
    var idx = userIndexes[j];
    if (rows[idx][2]) lastGivenIdx = idx;
  }

  if (lastGivenIdx === -1) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "no given orders" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var sheetRowNumber = lastGivenIdx + 2;
  var current = sheet.getRange(sheetRowNumber, 9).getValue();
  var n = parseInt(current, 10);
  if (isNaN(n)) n = 0;
  n += 1;
  sheet.getRange(sheetRowNumber, 9).setValue(n);

  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", sorries: n }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleSorryCount(e, sheetId, token, name) {
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName("Orders");
  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "Orders sheet not found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return ContentService
      .createTextOutput(JSON.stringify({ count: 0 }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var rows = data.slice(1);
  var targetName = (name || "").toString().trim().toLowerCase();
  var targetToken = (token || "").toString().trim();

  var userIndexes = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var rowToken = (row[6] || "").toString().trim();
    var rowName  = (row[7] || "").toString().trim().toLowerCase();
    if (rowName === targetName && (!targetToken || rowToken === targetToken)) {
      userIndexes.push(i);
    }
  }

  if (userIndexes.length === 0) {
    return ContentService
      .createTextOutput(JSON.stringify({ count: 0 }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var lastGivenIdx = -1;
  for (var j = 0; j < userIndexes.length; j++) {
    var idx = userIndexes[j];
    if (rows[idx][2]) lastGivenIdx = idx;
  }

  if (lastGivenIdx === -1) {
    return ContentService
      .createTextOutput(JSON.stringify({ count: 0 }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var sheetRowNumber = lastGivenIdx + 2;
  var current = sheet.getRange(sheetRowNumber, 9).getValue();
  var n = parseInt(current, 10);
  if (isNaN(n)) n = 0;

  return ContentService
    .createTextOutput(JSON.stringify({ count: n }))
    .setMimeType(ContentService.MimeType.JSON);
}
