# louisyeaaah.github.io

Personal portfolio site for **Zhipeng (Louis) Ye** — AI Engineer, Sydney.

**[→ Live site](https://louisyeaaah.github.io/)** · **[→ Animation lab](https://louisyeaaah.github.io/lab.html)**

---

## What this is

A dark, heavily animated single-page portfolio, plus a second page
(`lab.html`) that documents and demonstrates the animation libraries it is
built from.

It is a real Vite build — not a hand-written static folder — because the
brief was to evaluate ten animation libraries and **measure** them, and you
cannot attribute bytes to a library without a bundler.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # -> dist/
npm run size      # measure per-library cost from dist/
npm run preview   # serve the production build
```

---

## The animation stack, and why

Ten libraries were installed, integrated, measured and judged. Sizes below are
**gzip, per library**, taken from the emitted production chunks
(`npm run size` regenerates this table from a real build — see
[`src/lib/bundle-sizes.json`](src/lib/bundle-sizes.json)).

| Library | Gzip | Verdict | Role |
|---|---:|---|---|
| three.js | 129.7 KB | Adopted · heavy | Hero: GLSL aurora shader + 3D point constellation |
| GSAP + ScrollTrigger | 42.8 KB | Adopted · core | Timeline sequencing, scroll scrubbing, staggered reveals |
| Rive | 52.4 KB | **Lab only** | Technically excellent; blocked on the asset pipeline |
| Lottie (`lottie_light`) | 45.8 KB | Adopted | Animated "agent core" badge in the hero card |
| tsParticles | 28.3 KB | Adopted · scoped | Interactive particle field behind the contact card |
| Motion | 18.8 KB | Adopted | Spring physics for every short UI interaction |
| anime.js v4 | 16.0 KB | Adopted | The agent-architecture SVG diagram |
| Lenis | 5.2 KB | Adopted · global | Inertial smooth scrolling |
| SplitType | 4.2 KB | Adopted | Line/word splitting for masked headline reveals |
| AutoAnimate | 3.0 KB | Adopted · scoped | FLIP reflow of the capability grid when filtered |

**Critical path** (what a first visit to `/` actually downloads):
**67.1 KB gzip** — HTML, CSS, GSAP, Lenis and the app code. Every heavy media
library is a dynamic import, and `vite.config.js` filters them out of Vite's
`modulepreload` injection so they are not fetched until they are needed.

### How the responsibilities were split

Three animation runtimes coexisting is a real risk of doing the same job three
ways, so ownership was partitioned deliberately:

- **GSAP owns *when*.** Anything with a timeline, a scroll position or a
  stagger: the hero intro, heading reveals, counters, the scrubbed experience
  timeline, the velocity-reactive marquee, background parallax.
- **Motion owns *how it feels*.** Short, retargetable springs: the sliding nav
  indicator, mobile menu, cursor spotlight, card tilt, magnetic buttons.
  Re-implementing spring settling on top of GSAP would have been busywork.
- **anime.js owns *SVG*.** `svg.createDrawable` for path drawing,
  `svg.createMotionPath` for travelling dots, `scrambleText` for the label.
  These ship in the box rather than as plugins.
- **AutoAnimate owns *layout diffs*.** The skills grid reflows because of a
  click, not a timeline — AutoAnimate watches the parent and interpolates.
- **tsParticles owns *the contact card only*.** A declarative config replaced
  ~150 lines of bespoke canvas; it cannot match a purpose-built shader, which
  is why the hero uses one.

### Notable findings during the evaluation

- **Lottie's full player bundles an `eval`-based expression engine.** The site
  never uses expressions, so it imports
  `lottie-web/build/player/lottie_light` instead: **77.6 KB → 45.8 KB gzip**,
  and the `eval` warning disappears.
- **tsParticles' `slim` preset is not slim enough.** It registers emoji, image,
  line, polygon, square and star shapes plus nine interactions this site never
  touches. Composing the engine from `@tsparticles/basic` + three interactions
  cut it **45.0 KB → 28.3 KB gzip**. (Composing by hand also means you must
  load `@tsparticles/plugin-interactivity` yourself — `loadBasic` does not, and
  without it every interaction silently no-ops.)
- **Vite preloads dynamically-imported chunks from the entry HTML.** tsParticles
  was being fetched on first paint for an effect below the fold. A
  `build.modulePreload.resolveDependencies` filter removed it, taking the index
  critical path from **95.4 KB → 67.1 KB gzip**.
- **Rive is the one that got away.** Its runtime is MIT, needs no attribution,
  and its player is smaller than Lottie's — but `.riv` is a compiled binary that
  can only be produced by the Rive editor, and *exporting* one requires a paid
  plan (Cadet, ~$9/seat/mo). You can play any `.riv` for free, which is what the
  lab page does with the MIT-licensed `rating.riv`. It is not on the main page
  only because a star-rating widget says nothing about AI engineering. See
  [`src/modules/vector-assets.js`](src/modules/vector-assets.js) — `RIVE_SRC`
  is the single switch that enables it.

---

## Architecture

```
├── index.html                 # portfolio page (Vite entry)
├── lab.html                    # library evaluation page
├── vite.config.js              # manualChunks, modulepreload filter, size naming
├── public/                     # copied verbatim into dist/
│   ├── assets/
│   │   ├── agent-core.json     # bespoke Lottie, generated for this site
│   │   ├── favicon.svg
│   │   ├── og.png              # 1200x630 social card
│   │   ├── lottie/             # third-party Apache-2.0 demo asset
│   │   └── rive/               # third-party MIT demo asset
│   └── third-party/            # licence texts + provenance
├── src/
│   ├── main.js                 # orchestrator; per-module error isolation
│   ├── lab.js                  # the ten live demos + size table
│   ├── styles.css              # design tokens, layout, components
│   ├── lab.css
│   ├── lib/
│   │   ├── prefs.js            # motion prefs, capability detection, helpers
│   │   ├── scroll.js           # Lenis + GSAP + ScrollTrigger wiring
│   │   ├── split.js            # SplitType wrapper (accessibility-safe)
│   │   ├── particles-engine.js # minimal hand-composed tsParticles engine
│   │   └── bundle-sizes.json   # measured sizes + verdict metadata
│   └── modules/
│       ├── hero.js             # three.js shader + points, with 2D fallback
│       ├── reveals.js          # GSAP entrances + counters
│       ├── scroll-fx.js        # scrubbed effects, marquee, parallax
│       ├── nav.js              # Motion-driven nav + mobile menu
│       ├── interactions.js     # cursor, tilt, magnetic, typewriter
│       ├── skills-filter.js    # AutoAnimate filter grid
│       ├── diagram.js          # anime.js architecture diagram
│       ├── particles.js        # tsParticles contact layer
│       └── vector-assets.js    # Lottie + Rive loaders
└── tools/report-sizes.mjs      # measures a real build, writes bundle-sizes.json
```

### Resilience

Six animation runtimes share one document, so failure is contained:

- Every subsystem boots through `boot()` / `safe()` in
  [`src/main.js`](src/main.js) — a broken library logs and degrades, it does
  not take the page down. Failures are collected on `window.__siteErrors`.
- Content is **never** hidden behind JavaScript. A guard in `<head>` hides
  `.reveal` elements only while scripts are confirmed live, and un-hides
  everything after 3 seconds if they never arrive.
- WebGL is feature-detected; without it the hero falls back to a lightweight 2D
  canvas particle network.

### Accessibility

- `prefers-reduced-motion` is honoured throughout: Lenis is disabled, all
  animation is skipped, reveal elements are shown immediately, and counters are
  set to their **final values** rather than left at `0`.
- SplitType fragments are `aria-hidden` and the container carries an
  `aria-label`, so screen readers hear one clean sentence instead of letters.
- The skills filter is a keyboard-operable group with `aria-pressed` state and a
  live region announcing the result.
- Skip link, visible focus rings, labelled controls, and the SVG diagram has a
  full `role="img"` description.

---

## Deploy

GitHub Pages, built by GitHub Actions
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)): `npm ci` →
build → measure sizes → rebuild so the lab page ships fresh numbers → deploy
`dist/` as the Pages artifact. Push to `main` and the site updates.

Because the repository is named `<username>.github.io`, it is the account's
**user site** and publishes at the domain root.

---

## Third-party assets

The runtimes are MIT. Two artwork files are vendored, each with its licence
text and provenance recorded in
[`public/third-party/`](public/third-party/README.md):

- `assets/rive/rating.riv` — MIT, from `rive-app/rive-react`
- `assets/lottie/echarts-chart.json` — Apache-2.0, from `apache/echarts-www`

`assets/agent-core.json` is original work generated for this project and
carries no third-party obligations.

---

## Content

Content is derived from the résumé of Zhipeng (Louis) Ye. Contact details
published here are deliberately limited to email and LinkedIn.
