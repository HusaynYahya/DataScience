# Fuel & Frame

A holistic health tracker — diet, training and supplements in one page — built
around **Base 12**, a twelve-week, five-day calisthenics-and-barbell programme.

Two documents hold the plan in readable form:

- [`PROGRAM.md`](PROGRAM.md) — the full training block: every session, the
  progression rule, the skill ladders, the twelve-week wave structure.
- [`NUTRITION.md`](NUTRITION.md) — how the calorie and macro targets are derived,
  the halal meal library, and the supplement stack (and what to skip).
- [`SOURCES.md`](SOURCES.md) — the three sources the guidance draws on, what each
  contributed, and the three places they contradict one another.

**Live app:** https://claude.ai/code/artifact/cd10bf45-3c95-4c5c-9f84-631af2c1522e
(private to your account — sync and photo reading are on there)

## How it's laid out

Two levels of navigation, and never more than one subject on screen. The rail
picks a **section**; a strip under the heading picks a **page** within it. Every
panel is its own page — 39 across eight sections — with a pager at the foot to
step through them in order. Every section opens on the day's entry.

| Section | Pages |
|---------|-------|
| Today | **The day** · Fuel · Micronutrients · Protocol · Targets |
| Train | **Log a workout** · Add an exercise · This week · Warm-up · Ladders · The block |
| Overload | At a glance · Movements · Ladders · Turning up |
| Eat | **Today's meals** · Fill the gap · Library · How you've eaten · The record · Food quality |
| Body | **Log today** · Where you are · Composition · Bodyweight · Tape |
| Sleep | **Last night** · At a glance · When you slept |
| Ihsan | **Pledge** · Murāqaba · Non-negotiables · Muḥāsaba · Thirty days |
| Stack | **Core** · Situational · Skip · Safety · Sources |

The app itself carries no explanatory copy — names, numbers, doses and units
only. The reasoning behind the programme, the targets, the supplement choices
and the sources lives in the three markdown documents above, where it can be read
once rather than repeated on every screen.

## On the Ihsan tab

The three practices are treated as one in the akhlāq literature — al-Ghazālī
devotes a book of the *Iḥyāʾ* to *murāqaba* and *muḥāsaba* together — and the
structure is deliberately kept: a pledge with no reckoning is a wish, and a
reckoning with no pledge has nothing to measure against. The standing pledge and
the non-negotiables are yours to write; the six defaults are a starting point and
every one of them can be edited or removed.

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
