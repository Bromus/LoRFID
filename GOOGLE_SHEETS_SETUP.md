# Google Sheets setup for invite acceptance logging

This project logs "Accept Invitation" clicks to a Google Sheet. Follow these steps to set it up.

## 1. Create the Google Sheet

1. Go to [Google Drive](https://drive.google.com) and create a **New → Google Sheets**.
2. Name it (e.g. "LoRFID Acceptances").
3. In row 1, add headers for the columns:
   - **A:** Timestamp  
   - **B:** Token  
   - **C:** Name  
   - **D:** Accepted at  
   - **E:** (optional, leave empty or add a label)  
   - **F:** (optional, leave empty or add a label)
4. Copy the **Sheet ID** from the URL:  
   `https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_SHEET_ID/edit`  
   You will need it in the script.

## 2. Add the Apps Script

1. In the sheet, go to **Extensions → Apps Script**.
2. Delete any starter code and paste the script below.
3. Replace `YOUR_SHEET_ID_HERE` with your actual Sheet ID (from step 1.4).
4. Click **Save** (Ctrl+S). Give the project a name if prompted.

```javascript
// REMINDER: After any code change, go to Deploy → Manage deployments →
// Edit (pencil) → Version: New version → Deploy (so the web app runs the new code).

function doGet(e) {
  var SHEET_ID = "YOUR_SHEET_ID_HERE";
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheets()[0];

  var token = "";
  var name = "";
  var redirect = "";
  var qs = (e && e.queryString) ? e.queryString : "";
  if (qs) {
    var parts = qs.split("&");
    for (var i = 0; i < parts.length; i++) {
      var idx = parts[i].indexOf("=");
      if (idx === -1) continue;
      var key = decodeURIComponent(parts[i].substring(0, idx).replace(/\+/g, " "));
      var val = decodeURIComponent(parts[i].substring(idx + 1).replace(/\+/g, " "));
      if (key === "token") token = val;
      if (key === "name") name = val;
      if (key === "redirect") redirect = val;
    }
  }

  var now = new Date();
  var acceptedAt = now.toISOString();

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
```

## 3. Deploy as a Web app

1. In the Apps Script editor, click **Deploy → New deployment**.
2. Click **Select type → Web app**.
3. Set:
   - **Description:** e.g. "Accept logging"
   - **Execute as:** Me (your Google account)
   - **Who has access:** Anyone
4. Click **Deploy**. Authorize the app when prompted (choose your Google account and allow access).
5. Copy the **Web app URL** (it ends with `/exec`). You will use it in the project.

## 4. Connect the project to the Web app URL

1. Open **accepted.html** in this repo.
2. Find the line that sets `scriptUrl` (inside the `<script>` block near the bottom).
3. Replace the URL with your **Web app URL** from step 3.5:

   ```javascript
   var scriptUrl = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
   ```

4. Save the file. When users click "Accept Invitation" and land on the accepted page, their token and name are sent to this URL and a new row is added to your sheet.

## 5. Updating the script later

- If you **change the script code** (e.g. add columns or fix a bug), you must **redeploy** or the live web app will keep running the old code:
  1. **Deploy → Manage deployments**
  2. Click the **pencil (Edit)** on your deployment
  3. Under **Version**, select **New version**
  4. Click **Deploy**
- The Web app URL stays the same, so you do **not** need to change **accepted.html** again unless you create a **New deployment** and get a different URL.

## Troubleshooting

- **No new rows in the sheet:** Check **Executions** in the Apps Script project (left sidebar). If you see errors, fix the script and redeploy (new version).
- **"Script function not found: doGet":** Make sure both `doGet` and `doPost` are in your script and you deployed (or created a new version) after saving.
- **Wrong formatting (e.g. one cell with "token=2&name=Bruno"):** You are likely running an old deployment. Edit deployment → Version: **New version** → Deploy.
