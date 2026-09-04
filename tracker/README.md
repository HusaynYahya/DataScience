# Fuel & Frame

A holistic health tracker — diet, training and supplements in one page — built
around **Base 12**, a twelve-week, five-day calisthenics-and-barbell programme.

Two documents hold the plan in readable form:

- [`PROGRAM.md`](PROGRAM.md) — the full training block: every session, the
  progression rule, the skill ladders, the twelve-week wave structure.
- [`NUTRITION.md`](NUTRITION.md) — how the calorie and macro targets are derived,
  the halal meal library, and the supplement stack (and what to skip).

**Live app:** https://claude.ai/code/artifact/cd10bf45-3c95-4c5c-9f84-631af2c1522e
(private to your account — sync and photo reading are on there)

## What the app does

- **Today** — an energy ring against your daily target, macro bars, and a
  thirteen-nutrient board showing what's been met and what's still short.
- **Photograph a meal** and get a per-item calorie and nutrient breakdown you can
  adjust before it goes in the log. Or describe the meal in words. Or type the
  numbers off a label.
- **Train** — this week's schedule, today's session with every set logged (weight
  and reps, or seconds for holds), the skill ladders, and the twelve-week map.
- **Eat** — the halal meal library, plus a suggestion built around whatever macros
  you have left today.
- **Stack** — the supplement list with doses and reasons, ticked off daily.
- **Trends** — bodyweight, energy against target, and whether the weekly rate of
  change is inside the lean-gain band.

Targets recalculate from your age, height, weight, training frequency and goal —
Mifflin–St Jeor for resting rate, an activity multiplier, then a goal adjustment.

## Running it

Open `index.html`, or serve the folder:

```bash
python3 -m http.server 8000    # then visit http://localhost:8000/tracker/
```

Everything works offline from `localStorage`. Photo reading, meal suggestions and
cross-device sync need the Claude artifact runtime — published as an Artifact, the
page picks those up automatically and the status dots in the sidebar turn green.

## Editing it

`app.html` is the source. It is written as an Artifact-ready fragment (no
`<!doctype>`, `<html>`, `<head>` or `<body>` — the Claude viewer supplies those),
so it can be published as an Artifact unchanged.

`index.html` is generated from it. After editing `app.html`:

```bash
node build.mjs
```

The wrapper in `build.mjs` mirrors the reset the Claude viewer injects, so the
hosted page and the published Artifact render identically.

The data that drives the app lives in plain objects at the top of the script in
`app.html` — `PROGRAM`, `MEALS`, `SUPPS`, `RDA`, `GOALS`. Change a rep range or add
a meal there and both surfaces follow. Keep `PROGRAM.md` and `NUTRITION.md` in step
by hand.

## Privacy

The hosted copy stores nothing on a server: entries, weights and logged sets live
in the browser's own `localStorage`, on that device only. Published as an Artifact
with the `db` capability, the same data syncs across your devices in a store only
your organisation's signed-in members can read. Nothing is sent anywhere else, and
photographs are sent only to Claude, only when you pick one, and are not stored.
