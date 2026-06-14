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
−/+ buttons. The multiplier applies **last**: `reps = base × multiplier`, where the
base is the fixed value or the slider value. The control shows the current ×N and
the resulting total, and the tracker records e.g. `Get a Relic ×3: 6`.

```json
{ "name": "Get a Relic", "value": 2, "mult": true }
```

By default the multiplier ranges ×1–×99 starting at ×1. To customise, use an object:

```json
{ "name": "Get a Relic", "value": 2, "mult": { "min": 1, "max": 10, "start": 1 } }
```

Save `config.json`, then refresh the browser to see your changes.

## Notes

- Your total and tracker are saved in the browser (`localStorage`), so refreshing or
  reopening the page mid-run keeps your progress. **Clear All** wipes it.
- Everything runs locally; nothing is sent anywhere.
