# louisyeaaah.github.io

Personal portfolio site for **Zhipeng (Louis) Ye** — AI Engineer, Sydney.

Live at **[https://louisyeaaah.github.io/](https://louisyeaaah.github.io/)**

## What this is

A hand-built, dependency-free static site: dark futuristic styling, animated ambient
background, canvas particle network, scroll-reveal animations, animated stat counters
and a full responsive layout. No build step, no framework — just HTML, CSS and vanilla JS.

## Structure

```
.
├── index.html          # all page content + SEO/JSON-LD metadata
├── styles.css          # design tokens, layout, animations, responsive rules
├── main.js             # interactions: reveals, counters, canvas, nav, tilt
├── assets/
│   ├── favicon.svg     # gradient ZY monogram
│   └── og.png          # 1200×630 social preview card
└── .nojekyll           # serve files as-is on GitHub Pages
```

## Run locally

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

Any static file server works.

## Deploy

Served by GitHub Pages directly from the `main` branch root of this repository —
push to `main` and the site updates in about a minute. Because this repo is named
`<username>.github.io`, it is the account's **user site**, published at the domain root.

## Accessibility & performance notes

- Respects `prefers-reduced-motion`: all animation is disabled and content is shown immediately.
- Content is never hidden behind JavaScript — the reveal animation only engages once
  scripts confirm they are live, with a safety timeout that un-hides everything otherwise.
- Keyboard navigable with visible focus rings, a skip link, and labelled controls.
- No external JS/CSS dependencies; only Google Fonts is loaded remotely.

## Content source

Content is derived from the résumé of Zhipeng (Louis) Ye. Contact details published here
are limited to email and LinkedIn.
