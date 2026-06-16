/**
 * StS2 Workout Companion -- Leaderboard backend (Google Apps Script web app).
 *
 * HOST SETUP (one time, ~5 minutes):
 *   1. Create a Google Sheet (this is the storage).
 *   2. In the sheet: Extensions -> Apps Script.
 *   3. Paste this entire file into the editor (replace anything there) and Save.
 *   4. Deploy -> New deployment -> type "Web app".
 *        - Execute as: Me
 *        - Who has access: Anyone
 *      Click Deploy and authorize the one-time permission prompt (host only).
 *   5. Copy the Web app URL (ends in /exec) and share it with friends.
 *
 * Friends paste that URL + a display name into the app's Leaderboards panel.
 * No friend logins required -- the script runs as the host.
 *
 * Sheet row layout: name | bestAllTime(JSON) | sessions(JSON) | updated
 */

const SHEET_NAME = "leaderboard";

/** Receive a player's stats and upsert their row (keyed by name). */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(5000);
  try {
    const body = JSON.parse(e.postData.contents);
    const name = String(body.name || "").slice(0, 40);
    if (!name) return json({ ok: false, error: "missing name" });

    const best = JSON.stringify(body.bestAllTime || null);
    const sessions = JSON.stringify((body.sessions || []).slice(-100));

    const sheet = getSheet();
    const rows = sheet.getDataRange().getValues();
    let r = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === name) {
        r = i + 1;
        break;
      }
    }
    if (r === -1) {
      sheet.appendRow([name, best, sessions, new Date()]);
    } else {
      sheet.getRange(r, 2, 1, 3).setValues([[best, sessions, new Date()]]);
    }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Return every player's record + sessions for the leaderboard. */
function doGet() {
  const rows = getSheet().getDataRange().getValues();
  const players = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    let best = null;
    let sessions = [];
    try {
      best = JSON.parse(rows[i][1] || "null");
    } catch (_) {}
    try {
      sessions = JSON.parse(rows[i][2] || "[]");
    } catch (_) {}
    players.push({ name: rows[i][0], bestAllTime: best, sessions: sessions });
  }
  return json({ ok: true, players: players });
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(["name", "bestAllTime", "sessions", "updated"]);
  }
  return sh;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
