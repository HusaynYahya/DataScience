# Falak 1259

**Charting the cosmos, one data point at a time.**

Falak 1259 is a research-collective landing site where astronomy meets data
science. *Falak* (فلك) is the classical word for the celestial sphere;
*1259* nods to the founding of the Maragheh observatory, where careful
observation first met rigorous computation.

## The website

A single-page, fully responsive, dependency-free static site:

- **`index.html`** — page markup and content
- **`assets/css/styles.css`** — theme, layout, and animations
- **`assets/js/main.js`** — starfield canvas, scroll reveals, count-up stats,
  mobile nav, and contact-form validation

No build step, no frameworks, no external requests — it runs straight from the
filesystem.

## Run locally

Just open the file:

```bash
open index.html        # macOS
xdg-open index.html    # Linux
```

Or serve it (recommended, so smooth-scroll anchors and the canvas behave):

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy (GitHub Pages)

1. Push to your repository.
2. In **Settings → Pages**, set the source to the branch root (`/`).
3. The site publishes at `https://<user>.github.io/<repo>/`.

## Features

- Animated starfield background (respects `prefers-reduced-motion`)
- Scroll-triggered section reveals and animated stat counters
- Sticky, blur-on-scroll navigation with a mobile menu
- Accessible markup, keyboard-friendly, and light on the network

## License

Built in the open. Content © Falak 1259.
