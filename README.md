# docteur-super

A visual collection website.

## Structure

```
/
├── index.html          — main page
├── css/
│   └── style.css       — all styles (Utopia tokens, layout, CRT, grain)
├── js/
│   └── main.js         — Lenis smooth scroll init
├── fonts/
│   ├── OT2049.woff2    — display font (SUPER title)
│   └── OTNeueMontreal.woff2 — UI font (description bar)
└── assets/             — drop your .webp images here
```

## Images

Place your `.webp` images in `/assets/`. Then replace the placeholder `.img` divs in `index.html` with actual `<img>` tags:

```html
<img class="img ar-1-1" src="assets/001.webp" alt="" loading="lazy" />
```

## Dev

No build step — open `index.html` directly in a browser, or use a local server:

```bash
npx serve .
# or
python3 -m http.server
```
