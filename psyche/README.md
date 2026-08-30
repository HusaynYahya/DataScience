# Psyche

A self-contained page under `/psyche`. You describe one reaction you had to a
situation; it asks seven questions about it; it gives you a reading in Jungian
terms with the evidence it rests on, and a protocol for the next time the same
thing fires.

Static. No build step, no framework, no network, no accounts. Open
`index.html` and it works.

---

## The idea it is built on

Jung's complexes are feeling-toned clusters in the unconscious that behave
autonomously. When one is *constellated* it takes the wheel, and the giveaway
is not the content of the reaction but its size — the affect does not match the
stimulus.

So the page never asks whether you were right. It asks:

1. **How big was the reaction against the event?** — the classical marker.
2. **How old did you feel?** — complexes carry the age at which they formed.
3. **How familiar is the feeling?** — an autonomous complex has a history.

Those three are asked of everyone. The remaining four are chosen adaptively:
whichever question best separates the readings still in contention.

## The twelve dynamics

| id | Reading | Fires on |
|----|---------|----------|
| `projection` | The shadow, worn by someone else | contempt, moral verdict, flat denial of the trait |
| `persona`    | The mask slipped                 | being watched, shame, image management |
| `inferior`   | The inferior function erupting   | out of character, all-or-nothing, shame after |
| `mother`     | The mother complex               | care, guilt, obligation, engulfment |
| `father`     | The father complex               | authority, judgement, a borrowed inner critic |
| `child`      | The child who was left           | feeling young, exclusion, grief, collapse |
| `puer`       | The door closing                 | constraint, flight, contempt for the unserious |
| `anima`      | Taken over where you are known   | intimacy, absolutes, moods that won't be reasoned with |
| `hero`       | The one who copes                | unreturned giving, resentment, exhaustion |
| `scapegoat`  | Carrying what the group will not | being blamed, singled out, the same role every time |
| `envy`       | The unlived life                 | comparison, wanting what you won't admit wanting |
| `power`      | The power complex                | being made small, and answering in kind |

Each carries its own practice, and its own question to sit with.

## How the reading is produced

Three layers, all in [`engine.js`](engine.js):

1. **Signals** — about thirty of them (`disproportion`, `regression`,
   `exclusion`, `denial`, `judgement`, …), each 0–1. The free text contributes
   weakly, through a lexicon; the answers contribute strongly. Every signal
   keeps its provenance, which is why the reading can quote you back at
   yourself instead of asserting things.
2. **Dynamics** — each is a weighted read over the signals, normalised to 0–1.
   A dynamic with none of its defining signals present is damped rather than
   ruled out, so it can never lead on circumstantial evidence alone.
3. **Questions** — after the spine, each candidate question is scored by how
   much live contention it touches: a question separating two dynamics near the
   top is worth more than one probing an also-ran.

Nothing is hidden. Every reading is displayed with the claims that carried it
and where each claim came from, so you can disagree with it specifically.

## The protocol

Four timescales, built from the leading dynamic and from your own words:

- **In the moment** — what to do while it is firing. Differs for a flare and a
  shutdown, because the work is opposite in the two cases.
- **Today** — writing prompts, including ones assembled from the trait and the
  rule you named.
- **This week** — the practice belonging to the leading dynamic, plus the
  runner-up's when it is genuinely in play.
- **Over a month** — a four-column log, because the pattern shows up across
  entries and never within one.

Then the limits, stated every time.

## Safety

The account is scanned for language about suicide, self-harm, harm to others,
and being hurt by someone. A crisis flag stops the flow on the first screen —
once, with an explicit *Continue anyway* — and repeats on the reading. It is
not a screening instrument and does not pretend to be one; it exists so that an
account describing danger is met with a person to call rather than a paragraph
about archetypes.

## Privacy

Everything runs in the browser. There are no requests of any kind — no fonts,
no analytics, no endpoint. Saving a reading writes it to `localStorage` under
`psyche.journal.v1` on that device only, and every access to storage is wrapped
because private windows throw rather than returning nothing. Deleting an entry
removes it.

## Tests

```bash
node psyche/test/engine.test.js
```

40 tests over the engine: the lexicon, question ordering and selection, the
scoring of each dynamic, the protocol assembly, the risk scan and the text
export. The engine is pure, so no browser and no network are needed.

## Files

| File | What it is |
|------|-----------|
| `index.html` | The four views: account, question, reading, journal (plus About) |
| `engine.js`  | The whole model. No DOM, no network, no storage. The part worth reading |
| `psyche.js`  | The interface: view switching, rendering, the journal |
| `psyche.css` | Design tokens at the top; edit those to retune |
| `test/engine.test.js` | The tests |

## Running locally

```bash
python3 -m http.server 8000
# visit http://localhost:8000/psyche/
```

`file://` works too — nothing here is loaded over the network.

---

## A note on scope

This sits in its own directory and nothing on the Falak 1259 site links to it.
It shares no code and no stylesheet with the rest of the repository, so it can
be lifted out into its own repo by copying the folder, with nothing to unpick.

It is a reflective instrument, not therapy, not analysis, and not a diagnosis.
It cannot see you and has only the account you typed. A reading that does not
land is simply wrong.
