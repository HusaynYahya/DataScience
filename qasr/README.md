# Qasr Calculator

A single-page calculator that takes a starting address and a destination and
says whether the traveller shortens his prayers, according to the rulings of
**Sayyid Ali al-Husayni al-Sistani**.

Open `index.html` — there is no build step, no framework and no API key.

```
qasr/
├── index.html          the page, the form and the reference notes
├── qasr.css            styles; the design tokens sit at the top
├── qasr.js             geocoding, routing, the ruling engine, the interface
└── test/engine.test.js tests for the ruling engine — node test/engine.test.js
```

## How the distance is measured

| Step | Source |
| --- | --- |
| Address → coordinates | [Nominatim](https://nominatim.openstreetmap.org) (OpenStreetMap), debounced to stay inside its one-request-per-second policy |
| Coordinates → road distance | [OSRM](https://project-osrm.org/) driving route |
| If routing is unreachable | great-circle distance, clearly labelled as the straight line |
| If neither can be reached | the "I already know the distance" panel in the form takes a figure by hand and needs no network at all |

The law counts the path actually travelled, not the straight line on the map,
which is why the driving route is used and the straight line is only ever a
labelled fallback.

## The rules encoded

The engine lives in `decide()` in `qasr.js` — a pure function, circumstances in,
verdict out. In the order it applies them:

1. **The exemptions.** A journey for an unlawful purpose, and one whose
   occupation is travel (driver, pilot, commuter, nomad) — full prayers, whatever
   the distance.
2. **The distance.** Eight *farsakh*, taken as 5.5 km each, so **44 km**. The
   outward and return legs are added together when the traveller returns without
   staying ten days, so 22 km each way is enough. An optional deduction accounts
   for the road from the door to the edge of town, since the count begins where
   the town ends. Within 2 km of the limit the result carries a caution to pray
   both and ask a scholar.
3. **The intention.** The distance must have been intended at the outset;
   otherwise the count restarts from wherever the intention forms.
4. **The interruptions.** Stopping in a hometown en route (the verdict is then
   marked provisional and the journey must be re-measured from that town), a
   certain intention of ten continuous days, and thirty days of hesitation.
5. **The destination.** A hometown or a ten-day stay means full prayers on
   arrival while the road there is still travel; an undecided stay means
   shortening for up to thirty days.

Output covers both the road and the destination: rak'ahs per prayer, the ruling
on fasting, the reasoning, and the *hadd al-tarakhkhus* and four-places-of-choice
notes.

## Tests

```sh
node test/engine.test.js
```

22 cases over the distance thresholds, the destination rules, the exemptions,
the intention and the cautions. They stub the browser and never touch the
network.

## Caveat

A tool for estimating distance and applying the common cases — not a substitute
for a qualified scholar. Unusual cases belong with
[sistani.org](https://www.sistani.org/english/) or a local representative.
