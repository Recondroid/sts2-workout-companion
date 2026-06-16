"use strict";

/**
 * Leaderboard -- shares workout stats with friends via a Google Sheet that is
 * read/written through a host-deployed Google Apps Script web app.
 *
 * Friends paste one URL (the script's /exec URL) + a display name. Stats are
 * POSTed on Clear All and the boards are GET-fetched when the panel is opened
 * or Refresh is pressed (poll, not push).
 *
 * Boards:
 *   - All-time best: a persisted record ({ total, ts }) that is never lowered
 *     and survives both eviction from the rolling session window and Clear History.
 *   - This week / Today: computed at read time from each player's last-100
 *     sessions, relative to the viewer's local clock (so they auto-reset).
 */
class Leaderboard {
  constructor({ storageKey, getSessions, configEl, statusEl, boardsEl }) {
    this.storageKey = storageKey;
    this.getSessions = getSessions; // () => [{ ts, total }]
    this.configEl = configEl;
    this.statusEl = statusEl;
    this.boardsEl = boardsEl;

    this.url = "";
    this.name = "";
    this.bestAllTime = null; // { total, ts } | null
  }

  /* ---------------- Persistence ---------------- */

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        this.url = typeof data.url === "string" ? data.url : "";
        this.name = typeof data.name === "string" ? data.name : "";
        if (
          data.bestAllTime &&
          Number.isFinite(data.bestAllTime.total) &&
          Number.isFinite(data.bestAllTime.ts)
        ) {
          this.bestAllTime = { total: data.bestAllTime.total, ts: data.bestAllTime.ts };
        }
      }
    } catch (e) {
      /* keep defaults */
    }
  }

  save() {
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify({ url: this.url, name: this.name, bestAllTime: this.bestAllTime })
      );
    } catch (e) {
      /* storage unavailable -- still works in-memory */
    }
  }

  isConfigured() {
    return !!(this.url && this.name);
  }

  setConfig({ url, name }) {
    this.url = (url || "").trim();
    this.name = (name || "").trim().slice(0, 40);
    this.save();
  }

  /** Update the all-time best from a new session. Never lowers it. */
  recordSession({ ts, total }) {
    if (!Number.isFinite(total)) return;
    if (!this.bestAllTime || total > this.bestAllTime.total) {
      this.bestAllTime = { total, ts };
      this.save();
    }
  }

  /* ---------------- Network ---------------- */

  /** POST our stats. Best-effort: never throws to the caller. */
  async publish() {
    if (!this.isConfigured()) return;
    const payload = {
      name: this.name,
      bestAllTime: this.bestAllTime,
      sessions: this.getSessions().slice(-100),
    };
    try {
      // text/plain keeps this a "simple" request (no CORS preflight, which
      // Apps Script web apps cannot answer). The script reads the raw body.
      await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      /* best-effort -- a failed publish must never break the UI */
    }
  }

  async fetchPlayers() {
    const res = await fetch(this.url, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !data.ok || !Array.isArray(data.players)) {
      throw new Error("unexpected response");
    }
    return data.players;
  }

  /* ---------------- Board math ---------------- */

  startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  // Week starts Monday 00:00 local.
  startOfWeek() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const mondayOffset = (d.getDay() + 6) % 7; // Sun=6, Mon=0, ...
    d.setDate(d.getDate() - mondayOffset);
    return d.getTime();
  }

  _bestSince(sessions, since) {
    let best = 0;
    for (const s of sessions) {
      if (s && Number.isFinite(s.total) && Number.isFinite(s.ts) && s.ts >= since) {
        if (s.total > best) best = s.total;
      }
    }
    return best;
  }

  computeBoards(players) {
    const week = this.startOfWeek();
    const today = this.startOfToday();
    const allTime = [];
    const wk = [];
    const td = [];

    for (const p of players) {
      if (!p || typeof p.name !== "string") continue;
      const sessions = Array.isArray(p.sessions) ? p.sessions : [];

      const at = p.bestAllTime && Number.isFinite(p.bestAllTime.total) ? p.bestAllTime.total : 0;
      if (at > 0) allTime.push({ name: p.name, value: at });

      const w = this._bestSince(sessions, week);
      if (w > 0) wk.push({ name: p.name, value: w });

      const t = this._bestSince(sessions, today);
      if (t > 0) td.push({ name: p.name, value: t });
    }

    const byValueDesc = (a, b) => b.value - a.value;
    allTime.sort(byValueDesc);
    wk.sort(byValueDesc);
    td.sort(byValueDesc);
    return { allTime, week: wk, today: td };
  }

  /* ---------------- Rendering ---------------- */

  setStatus(msg, isError) {
    this.statusEl.textContent = msg || "";
    this.statusEl.classList.toggle("lb-error", !!isError);
  }

  renderConfig() {
    this.configEl.replaceChildren();

    const urlField = this._field("Sheet web-app URL", "url", this.url, "https://script.google.com/macros/s/.../exec");
    const nameField = this._field("Your display name", "text", this.name, "e.g. Ironclad");

    const save = document.createElement("button");
    save.className = "clear-btn";
    save.type = "button";
    save.textContent = "Save";
    save.addEventListener("click", async () => {
      this.setConfig({ url: urlField.input.value, name: nameField.input.value });
      await this.publish();
      await this.refresh();
    });

    this.configEl.append(urlField.wrap, nameField.wrap, save);
  }

  _field(labelText, type, value, placeholder) {
    const wrap = document.createElement("label");
    wrap.className = "lb-field";
    const span = document.createElement("span");
    span.textContent = labelText;
    const input = document.createElement("input");
    input.type = type === "url" ? "url" : "text";
    input.value = value || "";
    input.placeholder = placeholder || "";
    wrap.append(span, input);
    return { wrap, input };
  }

  /** Fetch + render the boards (or prompt for config). */
  async refresh() {
    if (!this.isConfigured()) {
      this.renderBoards({ allTime: [], week: [], today: [] });
      this.setStatus("Enter your sheet URL and display name above, then Save.");
      return;
    }
    this.setStatus("Loading…");
    try {
      const players = await this.fetchPlayers();
      this.renderBoards(this.computeBoards(players));
      this.setStatus(`${players.length} player(s) • updated ${new Date().toLocaleTimeString()}`);
    } catch (e) {
      this.renderBoards({ allTime: [], week: [], today: [] });
      this.setStatus(`Could not load leaderboard: ${e.message}`, true);
    }
  }

  renderBoards(boards) {
    this.boardsEl.replaceChildren();
    this.boardsEl.append(
      this._board("Best Session (all-time)", boards.allTime),
      this._board("Best This Week", boards.week),
      this._board("Best Today", boards.today)
    );
  }

  _board(title, rows) {
    const col = document.createElement("div");
    col.className = "lb-board";

    const h = document.createElement("h3");
    h.className = "lb-board-title";
    h.textContent = title;
    col.appendChild(h);

    if (!rows.length) {
      const empty = document.createElement("p");
      empty.className = "lb-board-empty";
      empty.textContent = "No entries yet.";
      col.appendChild(empty);
      return col;
    }

    const ol = document.createElement("ol");
    ol.className = "lb-rank";
    rows.forEach((row, i) => {
      const li = document.createElement("li");
      li.className = "lb-rank-item";

      const rank = document.createElement("span");
      rank.className = "lb-rank-num";
      rank.textContent = `${i + 1}.`;

      const name = document.createElement("span");
      name.className = "lb-rank-name";
      name.textContent = row.name;

      const value = document.createElement("span");
      value.className = "lb-rank-value";
      value.textContent = `${row.value}`;

      li.append(rank, name, value);
      ol.appendChild(li);
    });
    col.appendChild(ol);
    return col;
  }
}
