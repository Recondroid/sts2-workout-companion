"use strict";

const STORAGE_KEY = "sts2-workout-tracker";
const RANGE_RE = /^range\(\s*(\d+)\s*,\s*(\d+)\s*\)$/;

// tracker: array of { id, name, value } -- value is always a resolved number.
let tracker = [];

const totalEl = document.getElementById("total");
const buttonsEl = document.getElementById("buttons");
const trackerEl = document.getElementById("tracker");
const trackerEmptyEl = document.getElementById("tracker-empty");

/**
 * Parse an entry's optional `mult` flag into { min, max, start, step } or null.
 * Accepts `true` (defaults) or an object { min?, max?, start?, step? }.
 * `step` is the increment per −/+ click, clamped to the 0.25–1.0 range
 * (default 0.25). Multiplier values may be fractional.
 */
function parseMult(mult) {
  if (!mult) return null;
  if (mult === true) return { min: 1, max: 99, start: 1, step: 0.25 };
  if (typeof mult === "object") {
    let step = Number.isFinite(mult.step) ? mult.step : 0.25;
    step = Math.min(1, Math.max(0.25, step));
    let min = Number.isFinite(mult.min) ? mult.min : 1;
    if (min < 0) min = 0;
    let max = Number.isFinite(mult.max) ? mult.max : 99;
    if (max < min) max = min;
    let start = Number.isFinite(mult.start) ? mult.start : min;
    start = Math.min(max, Math.max(min, start));
    return { min, max, start, step };
  }
  return null;
}

/** Round a multiplier value to 3 decimals to avoid float drift. */
function roundMult(v) {
  return Math.round(v * 1000) / 1000;
}

/**
 * Classify a config entry. Returns one of
 *   { type: "fixed", name, value, mult }  or
 *   { type: "range", name, min, max, mult }
 * where `mult` is the parsed multiplier config or null.
 * Returns null for invalid entries.
 */
function parseEntry(entry) {
  if (!entry || typeof entry.name !== "string") return null;
  const mult = parseMult(entry.mult);

  if (typeof entry.value === "string") {
    const m = entry.value.match(RANGE_RE);
    if (m) {
      let min = parseInt(m[1], 10);
      let max = parseInt(m[2], 10);
      if (min > max) [min, max] = [max, min];
      return { type: "range", name: entry.name, min, max, mult };
    }
    const n = Number(entry.value);
    if (Number.isFinite(n)) {
      return { type: "fixed", name: entry.name, value: Math.trunc(n), mult };
    }
    return null;
  }

  if (typeof entry.value === "number" && Number.isFinite(entry.value)) {
    return { type: "fixed", name: entry.name, value: Math.trunc(entry.value), mult };
  }

  return null;
}

function newId() {
  if (window.crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function total() {
  return tracker.reduce((sum, item) => sum + item.value, 0);
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tracker }));
  } catch (e) {
    /* storage unavailable -- app still works in-memory */
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.tracker)) {
      tracker = data.tracker
        .filter((i) => i && typeof i.name === "string" && Number.isFinite(i.value))
        .map((i) => ({ id: i.id || newId(), name: i.name, value: i.value }));
    }
  } catch (e) {
    tracker = [];
  }
}

function addEntry(name, value) {
  tracker.push({ id: newId(), name, value });
  save();
  renderTracker();
}

function removeEntry(id) {
  tracker = tracker.filter((item) => item.id !== id);
  save();
  renderTracker();
}

function clearAll() {
  tracker = [];
  save();
  renderTracker();
}

function renderTotal() {
  totalEl.textContent = String(Math.round(total()));
}

function renderTracker() {
  trackerEl.replaceChildren();

  for (const item of tracker) {
    const li = document.createElement("li");
    li.className = "tracker-item";

    const label = document.createElement("span");
    label.className = "tracker-name";
    label.textContent = item.name;

    const val = document.createElement("span");
    val.className = "tracker-value";
    val.textContent = `+${item.value}`;

    const remove = document.createElement("button");
    remove.className = "remove-btn";
    remove.type = "button";
    remove.textContent = "✕";
    remove.title = "Remove";
    remove.setAttribute("aria-label", `Remove ${item.name}`);
    remove.addEventListener("click", () => removeEntry(item.id));

    li.append(label, val, remove);
    trackerEl.appendChild(li);
  }

  trackerEmptyEl.style.display = tracker.length === 0 ? "block" : "none";
  renderTotal();
}

function renderFixedButton(entry) {
  const btn = document.createElement("button");
  btn.className = "event-btn";
  btn.type = "button";

  const name = document.createElement("span");
  name.className = "event-name";
  name.textContent = entry.name;

  const value = document.createElement("span");
  value.className = "event-cost";
  value.textContent = `+${entry.value}`;

  btn.append(name, value);
  btn.addEventListener("click", () => addEntry(entry.name, entry.value));
  return btn;
}

function setSliderValue(slider, readout, n) {
  const min = Number(slider.min);
  const max = Number(slider.max);
  const clamped = Math.min(max, Math.max(min, n));
  slider.value = String(clamped);
  readout.textContent = slider.value;
}

function makeStep(label, ariaLabel, onClick) {
  const btn = document.createElement("button");
  btn.className = "step-btn";
  btn.type = "button";
  btn.textContent = label;
  btn.title = label === "+" ? "Increase" : "Decrease";
  btn.setAttribute("aria-label", ariaLabel);
  btn.addEventListener("click", onClick);
  return btn;
}

/**
 * Renders a control-group entry: a slider (range entries) and/or a ×N multiplier
 * stepper (entries with `mult`). The multiplier always applies last:
 *   reps = base × multiplier, where base is the slider value or the fixed value.
 */
function renderControlGroup(entry) {
  const wrap = document.createElement("div");
  wrap.className = "event-range";

  const name = document.createElement("span");
  name.className = "event-name";
  name.textContent = entry.name;

  const row = document.createElement("div");
  row.className = "range-row";

  let getBase;
  let getMult = () => 1;
  let finalReadout = null;

  function updateFinal() {
    if (finalReadout) finalReadout.textContent = `= ${roundMult(getBase() * getMult())}`;
  }

  // --- Base value source ---
  if (entry.type === "range") {
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(entry.min);
    slider.max = String(entry.max);
    slider.value = String(entry.min);
    slider.className = "range-input";

    const readout = document.createElement("span");
    readout.className = "range-readout";
    readout.textContent = slider.value;

    slider.addEventListener("input", () => {
      readout.textContent = slider.value;
      updateFinal();
    });

    const minus = makeStep("−", `Decrease ${entry.name}`, () => {
      setSliderValue(slider, readout, parseInt(slider.value, 10) - 1);
      updateFinal();
    });
    const plus = makeStep("+", `Increase ${entry.name}`, () => {
      setSliderValue(slider, readout, parseInt(slider.value, 10) + 1);
      updateFinal();
    });

    row.append(minus, slider, plus, readout);
    getBase = () => parseInt(slider.value, 10);
  } else {
    const base = document.createElement("span");
    base.className = "range-readout";
    base.textContent = String(entry.value);
    row.append(base);
    getBase = () => entry.value;
  }

  // --- Optional ×N multiplier (applies last) ---
  if (entry.mult) {
    let multVal = entry.mult.start;
    const multReadout = document.createElement("span");
    multReadout.className = "mult-readout";
    const renderMult = () => {
      multReadout.textContent = `×${multVal}`;
    };
    renderMult();

    const mMinus = makeStep("−", `Decrease multiplier for ${entry.name}`, () => {
      multVal = Math.max(entry.mult.min, roundMult(multVal - entry.mult.step));
      renderMult();
      updateFinal();
    });
    const mPlus = makeStep("+", `Increase multiplier for ${entry.name}`, () => {
      multVal = Math.min(entry.mult.max, roundMult(multVal + entry.mult.step));
      renderMult();
      updateFinal();
    });

    const multGroup = document.createElement("span");
    multGroup.className = "mult-group";
    multGroup.append(mMinus, multReadout, mPlus);
    row.append(multGroup);
    getMult = () => multVal;

    finalReadout = document.createElement("span");
    finalReadout.className = "final-readout";
    row.append(finalReadout);
    updateFinal();
  }

  // --- Add ---
  const add = document.createElement("button");
  add.className = "event-btn range-add";
  add.type = "button";
  add.textContent = "Add";
  add.addEventListener("click", () => {
    const base = getBase();
    const mult = getMult();
    const finalVal = roundMult(base * mult);
    let label;
    if (entry.mult) {
      label = `${entry.name} ×${mult}: ${finalVal}`;
    } else {
      label = `${entry.name}: ${finalVal}`;
    }
    addEntry(label, finalVal);
  });
  row.append(add);

  wrap.append(name, row);
  return wrap;
}

function renderButtons(entries) {
  buttonsEl.replaceChildren();
  for (const raw of entries) {
    const entry = parseEntry(raw);
    if (!entry) continue;
    const el =
      entry.type === "fixed" && !entry.mult
        ? renderFixedButton(entry)
        : renderControlGroup(entry);
    buttonsEl.appendChild(el);
  }
}

/* ---------------- Combat timer ---------------- */

const TIMER_KEY = "sts2-workout-timer";

// { running, accumulatedMs, startedAt }
let timer = { running: false, accumulatedMs: 0, startedAt: null };
let timerInterval = null;

const timerEl = document.getElementById("timer");
const timerStartBtn = document.getElementById("timer-start");
const timerStopBtn = document.getElementById("timer-stop");
const timerResetBtn = document.getElementById("timer-reset");

function timerElapsed() {
  return timer.accumulatedMs + (timer.running ? Date.now() - timer.startedAt : 0);
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function saveTimer() {
  try {
    localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
  } catch (e) {
    /* storage unavailable -- timer still works in-memory */
  }
}

function loadTimer() {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data && typeof data.accumulatedMs === "number") {
      timer = {
        running: !!data.running,
        accumulatedMs: data.accumulatedMs,
        startedAt: typeof data.startedAt === "number" ? data.startedAt : null,
      };
      if (timer.running && timer.startedAt === null) {
        // Inconsistent state -- treat as paused.
        timer.running = false;
      }
    }
  } catch (e) {
    timer = { running: false, accumulatedMs: 0, startedAt: null };
  }
}

function renderTimer() {
  timerEl.textContent = formatTime(timerElapsed());
  timerStartBtn.disabled = timer.running;
  timerStopBtn.disabled = !timer.running;
}

function startTimerInterval() {
  if (timerInterval !== null) return;
  timerInterval = setInterval(renderTimer, 250);
}

function stopTimerInterval() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function timerStart() {
  if (timer.running) return;
  timer.startedAt = Date.now();
  timer.running = true;
  startTimerInterval();
  saveTimer();
  renderTimer();
}

function timerStop() {
  if (!timer.running) return;
  timer.accumulatedMs = timerElapsed();
  timer.running = false;
  timer.startedAt = null;
  stopTimerInterval();
  saveTimer();
  renderTimer();
}

function timerReset() {
  timer = { running: false, accumulatedMs: 0, startedAt: null };
  stopTimerInterval();
  saveTimer();
  renderTimer();
}

function initTimer() {
  loadTimer();
  timerStartBtn.addEventListener("click", timerStart);
  timerStopBtn.addEventListener("click", timerStop);
  timerResetBtn.addEventListener("click", timerReset);
  if (timer.running) startTimerInterval();
  renderTimer();
}

/* ---------------- Init ---------------- */

async function init() {
  load();
  renderTracker();
  initTimer();

  document.getElementById("clear-all").addEventListener("click", clearAll);

  try {
    const res = await fetch("config.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const entries = await res.json();
    if (!Array.isArray(entries)) throw new Error("config.json must be a JSON array");
    renderButtons(entries);
  } catch (e) {
    const msg = document.createElement("p");
    msg.className = "config-error";
    msg.textContent = `Could not load config.json: ${e.message}`;
    buttonsEl.replaceChildren(msg);
  }
}

init();
