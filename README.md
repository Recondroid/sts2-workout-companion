# Slay the Spire 2 Workout Companion

A tiny local web app that turns Slay the Spire 2 events into a workout rep counter.
Click an event (e.g. "Buy a Card", "Take 15 Damage") and its rep value is added to
your running total — the number of reps you owe. A tracker lists every click so you
can undo individual ones; **Clear All** resets everything.

No installation, no dependencies — just Python 3.

## Running it

**Windows:** double-click `start.bat`.

**macOS:** double-click `start.command` in Finder. The first time, you may need to
make it runnable: open Terminal in this folder and run `chmod +x start.command`.

**Linux:** run `./start.sh` (run `chmod +x start.sh` once if needed).

**Any OS, from a terminal:** `python serve.py` (or `python3 serve.py`).

The server starts on <http://127.0.0.1:8000> (or the next free port) and opens your
browser automatically. Leave the terminal/launcher window open while you use it;
press **Ctrl-C** there to stop.

## Configuring the buttons

Edit `config.json` — a list of events. Each entry has a `name` and a `value`:

```json
[
  { "name": "Buy a Card", "value": 10 },
  { "name": "Defeat Elite", "value": 25 },
  { "name": "Turn Count", "value": "range(1,25)" }
]
```

- **Fixed value** — `"value"` is a whole number. Renders as a button that adds that
  many reps each click.
- **Slider** — `"value"` is the string `"range(min,max)"` (e.g. `"range(1,25)"`).
  Renders as a slider; pick an amount, click **Add**, and that exact amount is added
  (the chosen value is recorded so removing it later subtracts the right amount).

### Multiplier (×N)

Add `"mult": true` to **any** entry (fixed or slider) to give it a ×N stepper with
−/+ buttons. The multiplier applies **last**: `reps = base × multiplier`, where
the base is the fixed value or the slider value. Individual entries may be
fractional (e.g. `Get a Relic ×1.25: 2.5`); the grand **total** is rounded to a
whole number.

```json
{ "name": "Get a Relic", "value": 2, "mult": true }
```

By default the multiplier ranges ×1–×99 starting at ×1 and steps by **0.25** per
click. To customise, use an object (`step` is clamped to the 0.25–1.0 range):

```json
{ "name": "Get a Relic", "value": 2, "mult": { "min": 1, "max": 10, "start": 1, "step": 0.5 } }
```

Save `config.json`, then refresh the browser to see your changes.

## History

Pressing **Clear Reps** logs the finished session (timestamp + total + the list of
events) to the **History** panel. History keeps the last 100 sessions; hover an entry
to see its event breakdown. **Clear History** wipes the log.

## Leaderboard (optional)

Compare workouts with friends on a shared leaderboard. It uses a **Google Sheet** as
free storage — there is no server to run or pay for, and your friends never log in.
Three boards are shown: **Best Session (all-time)**, **Best This Week**, and **Best
Today**. The all-time best is remembered forever (even after it ages out of your last
100 sessions or you Clear History); the week/today boards reset automatically.

### Host setup (one time, ~5 minutes)

One person sets up the shared sheet:

1. Create a new **Google Sheet** (this is the storage).
2. In the sheet: **Extensions → Apps Script**.
3. Delete any starter code, then paste in the entire contents of
   [`leaderboard-apps-script.gs`](leaderboard-apps-script.gs) and **Save**.
4. **Deploy → New deployment → Web app**, and set:
   - **Execute as:** Me
   - **Who has access:** Anyone
5. Click **Deploy** and approve the one-time permission prompt (host only — it lets the
   script edit *your* sheet).
6. Copy the **Web app URL** (it ends in `/exec`) and share it with your friends. Treat
   it like a password — anyone with it can post to the board.

### Joining (each player)

Open the app → **Leaderboards** → paste the web-app URL and a display name → **Save**.
Your stats publish automatically each time you press **Clear Reps**; press **Refresh**
in the panel to pull everyone's latest.

## Notes

- Your total, tracker, and history are saved in the browser (`localStorage`), so
  refreshing or reopening the page mid-run keeps your progress. **Clear Reps** logs the
  session to History and wipes the tracker.
- The app runs locally and sends nothing anywhere **unless** you set up the optional
  leaderboard, which posts your name and session totals to the shared Google Sheet.
