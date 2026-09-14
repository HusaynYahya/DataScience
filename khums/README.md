# Khums Calculator

Works out what khums is owed on a khums day, and how the fifth divides, according
to the rulings of **Sayyid Ali al-Husayni al-Sistani** (may Allah prolong his life).

Static page. No build step, no framework, no network of any kind — plain HTML, CSS
and vanilla JS. Open `index.html` or drop the folder on any static host.

---

## The idea it is built on

Most people meet khums as "twenty per cent of your savings" and then get lost in
the details. The detail that actually decides the sum is this:

> Khums is not a tax on income. It is a fifth of what is **left over** on the day
> your khums year closes.

So the form does not ask what you earned and what you spent. What was spent within
the year on a living befitting your standing is gone and is counted no further —
including the house you live in, the car, the furniture, the clothes, and anything
else already put to use. The form asks only two things:

1. **What do you still hold** on your khums day that has not already been khumsed?
2. **What of that is not liable** — already khumsed, never liable, borrowed, or owed?

A fifth of the difference is khums, and it divides in half: the share of the Imam
(a.s.) and the share of the sayyids.

---

## What it implements

**The surplus of income** — the first of the seven, and the one this calculator is
built around:

- A fifth of what remains, with the two halves reported separately.
- Provisions and goods bought from the year's income and still unused are liable,
  at today's value; things already used are not, and never become liable later;
  things kept by their nature for another season are not.
- Capital — the money in a business, its stock, its equipment — is liable in full.
  The calculator does **not** apply relief on that; where paying at once would
  leave someone unable to earn a living befitting his standing, that is for the
  marjaʻ's office to arrange, and the page says so rather than deciding it.
- Money lent out is liable when it can be recovered.
- Mahr, blood money, an inheritance received by the recognised laws of inheritance,
  and khums or zakat received carry no khums. **A gift does** — this is a point
  where Sayyid al-Sistani differs from what many people assume — and so does
  whatever any exempt wealth earns.
- Debts incurred for the necessities of the household come off the year's profit.
- A loan taken to buy the home you live in is met by setting each year's surplus
  against the outstanding balance, until the amount so set aside over the years
  comes to the size of the loan. The calculator tracks that running total: give it
  the balance and what has been set against it so far, and it tells you where the
  total stands after this year.

**The others** — optional, and most people will leave them alone. Each falls due
when the thing comes into your hand, not at the year's end:

| | Threshold | |
|---|---|---|
| A mine | 15 mithqāl of coined gold | 69.12 g |
| A treasure-trove | 105 mithqāl of silver, or 15 of gold — whichever is reached first | 483.84 g / 69.12 g |
| Diving | 18 nukhud of gold (one dinar) | 3.456 g |
| Lawful mixed with unlawful | no threshold — a fifth purifies the whole | |

One common (ṣayrafī) mithqāl is 4.608 g and a nukhud is a twenty-fourth of it; the
page asks for a price per gram so the weights can be compared with money. For a
mine, a treasure and a dive, the cost of getting the thing out comes off **first**,
and it is what remains that must reach the threshold — later costs (refining,
cutting, carriage) come off before the fifth is taken.

---

## Running it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000
# visit http://localhost:8000/khums/
```

## The tests

The ruling engine is a set of pure functions — holdings in, verdict out, no
network, no DOM, no storage — so it can be exercised on its own:

```bash
node test/engine.test.js
```

38 assertions covering the fifth and its two halves, the home-loan relief and its
cap, the cautions the engine raises, junk input, penny drift, the ledger it
produces, the khums-year dates, and each of the other four kinds of khums.

---

## The files

| File | What's in it |
|---|---|
| `index.html` | The form, the result, and the rulings in brief |
| `khums.css` | Styles, tokens at the top, print rules at the bottom |
| `khums.js` | Three parts: the khums year, the ruling engine, the interface |
| `test/engine.test.js` | Tests for the engine, run under node |

`khums.js` exports the engine as `window.KhumsEngine` so the tests can reach it.
Nothing in the interface reads it back.

## Your figures stay with you

There is no server behind this page and no request leaves it. What you type is
kept in this browser's `localStorage` so you can come back to a half-finished
reckoning; **Forget everything** under the buttons clears it. On a shared
computer, use that.

---

## What it is not

A tool for arithmetic and for the ordinary cases. It is not a scholar and it does
not know your circumstances. A first reckoning after years of not paying cannot be
computed at all — it is settled (*musalaha*) with the marjaʻ or his representative,
and the page says so when you tick the box. For a business whose capital cannot be
touched, an uncertain inheritance, or anything close to a line, ask:
[sistani.org](https://www.sistani.org/english/) or your local representative.
