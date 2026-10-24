# Falak 1259

A multi-page marketing website for **Falak 1259** — a hand-cranked brass desk
instrument that draws a perfectly straight line in sand using the *Tusi couple*,
a 13th-century geometric proof (a circle rolling inside another exactly twice
its size converts rotation into straight-line motion).

Static site. No build step, no framework, no external requests — plain HTML, CSS
and vanilla JS. Open it or drop it on any static host.

---

## Pages

| File            | Page        | What's on it |
|-----------------|-------------|--------------|
| `index.html`    | The Object  | Product landing + the interactive Tusi-couple animation + specification |
| `mission.html`  | Mission     | Long-form editorial — the 1259 story |
| `order.html`    | Order       | £295, numbered first series, reservation form with intent dropdown |
| `gallery.html`  | Gallery     | Image grid + demonstration-video slot |
| `contact.html`  | Contact     | Contact form + details |

Shared header, footer and navigation are built once (in `assets/js/render.js`)
and appear identically on every page.

---

## ✏️ Editing the text — read this first

**All page copy lives in one file: [`assets/js/content.js`](assets/js/content.js).**
You never need to touch the HTML to change words. Open that file, edit the text
inside the quotation marks, save, and reload the page.

- It's heavily commented, one section per page.
- The **Mission** essay (the part you'll edit most) is an ordered list under
  `mission.body`. Each entry is a block:
  ```js
  { type: "p",    text: "A paragraph." }      // body paragraph
  { type: "h2",   text: "A section heading" } // sub-heading
  { type: "pull", text: "A pull-quote." }     // large highlighted quote
  ```
  Add, delete, or reorder these freely — the page follows the order in the file.
- Paragraphs, ledes and pull-quotes allow light inline HTML: `<em>…</em>`,
  `<strong>…</strong>`, `<br>`.

---

## 🖼 Swapping the images

Placeholders live in `assets/img/` and each one displays its own filename on
screen so you know exactly what to replace. To use your own photograph, either:

1. **Keep the filename** — save your photo over the placeholder using the same
   name (e.g. replace `gallery-01.svg` with your own `gallery-01.jpg`) and update
   that one `src` line in `content.js`, **or**
2. **Change the path** — point the `src` in `content.js` at wherever your image
   lives.

Image references, all in `content.js`:

- Hero: `object.heroImage` (and the `<img>` in `index.html`)
- Gallery grid: `gallery.images[]` (`src`, `alt`, `caption`)
- Video poster: `gallery.video.poster`

Recommended sizes: hero ~1000×1250 (4:5), gallery ~800×600 (4:3),
video poster ~1280×720 (16:9). Always keep the `alt` text meaningful.

### The demonstration video

Set `gallery.video.src` in `content.js` to your `.mp4` path, e.g.
`"assets/video/demo.mp4"`. Until it's set, an elegant placeholder shows in its
place. A poster frame is shown before playback.

### The logo

`assets/img/logo.svg` is the full lockup (mark + wordmark). The small mark in the
header/footer is drawn inline from the same geometry in `render.js`
(`markSVG`) so it stays crisp at any size.

---

## 📨 Making the forms send

Both forms (Order and Contact) validate in the browser and then POST as JSON to a
single configurable endpoint. Set it once:

```js
// assets/js/content.js
forms: {
  endpoint: "https://your-form-handler.example/f/xxxx",  // ← put your endpoint here
  method: "POST",
}
```

Works with Formspree, Basin, Getform, a serverless function, or anything that
accepts a JSON POST. **Until you set a real endpoint**, forms confirm on-screen
but do not send anywhere (so nothing is silently lost).

---

## The animation (how it stays honest)

`assets/js/tusi.js` computes the traced curve directly from the rolling geometry
— it is not a preset path. With outer radius `R = 2r` and the drawing point a
distance `d` from the rolling circle's centre:

```
x(θ) = (r + d)·cos θ
y(θ) = (r − d)·sin θ
```

- `d = r` (point on the rim) → `y ≡ 0` → a **perfectly straight line** (verified: max |y| = 0)
- `0 < d < r` → an **ellipse**, semi-axes `(r+d)` and `(r−d)`
- `d = 0` (point at centre) → a **circle** of radius `r`

The slider moves `d` from rim to centre. `prefers-reduced-motion` is respected:
the crank does not auto-run, but the figure and slider still work.

---

## Running locally

Open `index.html` directly, or serve the folder (recommended):

```bash
python3 -m http.server 8000
# visit http://localhost:8000
```

## Deploying (GitHub Pages)

1. Push these files to your repository.
2. **Settings → Pages** → source: your branch, root (`/`).
3. Publishes at `https://<user>.github.io/<repo>/`.

Any static host works too (Netlify, Vercel, Cloudflare Pages, S3) — there is
nothing to build.

---

## Accessibility & performance notes

- Semantic HTML, one `<h1>` per page, skip-link, visible focus rings.
- Forms are keyboard-navigable with real `<label>`s and `aria-live` status.
- Images carry alt text (from `content.js`); gallery images lazy-load.
- No external fonts or scripts — fully offline, no tracking, fast.
- Respects `prefers-reduced-motion` throughout.
