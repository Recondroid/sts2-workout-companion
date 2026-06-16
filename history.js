"use strict";

/**
 * HistoryLog -- a persistent, point-in-time log of cleared workout sessions.
 *
 * Each entry is a snapshot taken when "Clear All" is pressed:
 *   { id, ts, total, events: ["Name: value", ...] }
 * Entries are never recomputed after creation. The log is capped at `max`
 * entries with first-in-first-out eviction (oldest dropped first).
 */
class HistoryLog {
  constructor({ listEl, emptyEl, storageKey, max = 100 }) {
    this.listEl = listEl;
    this.emptyEl = emptyEl;
    this.storageKey = storageKey;
    this.max = max;
    this.entries = [];
  }

  _newId() {
    if (window.crypto && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.entries)) {
        this.entries = data.entries
          .filter(
            (e) =>
              e &&
              typeof e.ts === "number" &&
              Number.isFinite(e.total) &&
              Array.isArray(e.events)
          )
          .map((e) => ({
            id: e.id || this._newId(),
            ts: e.ts,
            total: e.total,
            events: e.events.map(String),
          }))
          .slice(-this.max);
      }
    } catch (e) {
      this.entries = [];
    }
  }

  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({ entries: this.entries }));
    } catch (e) {
      /* storage unavailable -- log still works in-memory */
    }
  }

  /** Append a snapshot. Enforces the FIFO cap, persists, and re-renders. */
  record({ total, events }) {
    this.entries.push({
      id: this._newId(),
      ts: Date.now(),
      total,
      events: Array.isArray(events) ? events.map(String) : [],
    });
    while (this.entries.length > this.max) {
      this.entries.shift();
    }
    this.save();
    this.render();
  }

  clear() {
    this.entries = [];
    this.save();
    this.render();
  }

  render() {
    this.listEl.replaceChildren();

    // Newest first.
    for (const entry of [...this.entries].reverse()) {
      const li = document.createElement("li");
      li.className = "history-item";
      li.title = entry.events.join("\n");

      const time = document.createElement("span");
      time.className = "history-time";
      time.textContent = new Date(entry.ts).toLocaleString();

      const total = document.createElement("span");
      total.className = "history-total";
      total.textContent = `${entry.total} reps`;

      li.append(time, total);
      this.listEl.appendChild(li);
    }

    this.emptyEl.style.display = this.entries.length === 0 ? "block" : "none";
  }
}
