# louisyeaaah.github.io

Personal portfolio site for **Zhipeng (Louis) Ye** — AI Engineer, Sydney.

**[→ Live site](https://louisyeaaah.github.io/)** · **[→ Animation lab](https://louisyeaaah.github.io/lab.html)**

---

## What this is

Two chapters and a hard cut between them:

1. **A dark WebGL chapter.** An agent-graph constellation — eleven nodes wired by
   the résumé's own data — that the camera flies through as you scroll. You can
   drag to orbit, hover a node to light it up, click one to open it, or press
   `⌘K` and search. A pinned 240vh scroll-scrub, rendered with three.js and a
   bloom + grain + chromatic-aberration chain.
2. **A long light chapter.** Warm ivory, serif body copy, no decoration. The
   résumé, as a document.

The point of the split is that the 3D earns attention once, at the top, and then
gets out of the way. A portfolio's job is to be read.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # -> dist/
npm run size      # measure per-library gzip from a real build
npm run preview
```

---

## Design system

The visual language is derived from a measured teardown of Anthropic's
model-launch pages (raw CSS tokens, font tables, and rendered pixel samples),
synthesised with a WebGL chapter. The rules that do the work:

| Rule | Value |
|---|---|
| Display letter-spacing | **`0`** — negative tracking is a template tell |
| Headings | **weight 500**, never 700 |
| Body | **serif** at 1.5 leading, against sans headings |
| Headline ramp | `clamp(2rem, 3.33vw, 2.8rem)` @ 1.1 · hero `clamp(2.1rem, 6.6vw, 7rem)` @ 1.05 |
| Eyebrows | `.875rem` · `500` · `letter-spacing: .12em` · uppercase |
| Neutrals | warm only — `#FAF9F5` cream → `#141413` ink. **Never `#000`** |
| Accent | exactly one: clay `#D97757` |
| Radius | `0` on type and buttons; pills and media only |
| Depth | one-step surface shifts, not shadows |
| Gradients | **zero decorative ones**, and no gradient text |
| Rhythm | **one** dark chapter, then a long light body — not alternating |
| Reveals | `opacity .2s` + `translateY(32px) .5s` on `cubic-bezier(.165,.84,.44,1)` |
| Hover | `opacity: .85`, 150–200 ms |

Fonts: **Geist** (the closest free relative of Anthropic Sans — their font's own
name table reads *"BSPK x Geist x Anthropic"*), **Source Serif 4** (nearest free
stand-in for Tiempos Text), **JetBrains Mono** (the same face they ship).

---

## The animation stack, and what got cut

Ten libraries were installed, integrated, measured and judged. Sizes are **gzip,
per library**, from the emitted production chunks — `npm run size` regenerates
the table from a real build (see [`src/lib/bundle-sizes.json`](src/lib/bundle-sizes.json)).

**Shipped on the main page (4):**

| Library | Gzip | Role |
|---|---:|---|
| three.js | 138.5 KB | The dark chapter: graph, shader floor, bloom/grain/aberration chain |
| GSAP + ScrollTrigger | 42.8 KB | The pinned hero flight and the scrubbed copy exit |
| Lenis | 5.2 KB | Inertial smooth scrolling, on the GSAP ticker |
| AutoAnimate | 3.0 KB | FLIP reflow of the capability grid when filtered |

**Cut to the lab (6) — and that is the result, not an omission:**

| Library | Why it is not on the main page |
|---|---|
| SplitType | Anthropic's hero resolves with a 26 px blur-in, not a per-word split. I built both; the blur-in won. |
| Motion | The reference language is cubic-bezier transitions and `opacity: .85` hovers. Springs were the wrong physics. |
| anime.js | It was carrying the agent-architecture diagram, which has since been cut from the portfolio. |
| tsParticles | The WebGL chapter owns particles now; running both is two systems doing one job. |
| Lottie | The bespoke asset lived in the hero card the 3D chapter replaced. |
| Rive | `.riv` can only be authored in the Rive editor, and exporting needs a paid plan. |

All ten remain integrated and demonstrable on [`/lab.html`](https://louisyeaaah.github.io/lab.html).

**Critical path for `/`: 65.6 KB gzip** — HTML, CSS, GSAP, Lenis and app code.
The scene is a dynamic import; Vite's `modulePreload` filter keeps three.js,
Lottie, Rive and tsParticles off first paint.

### Bugs found by measuring

- **`lottie_light` instead of the full player** — the only thing separating them
  is an `eval`-based expression engine this site never uses: **77.6 → 45.8 KB**.
- **tsParticles' `slim` preset is not slim** — hand-composing from
  `@tsparticles/basic` + three interactions cut it **45.0 → 30.8 KB**. (You must
  load `@tsparticles/plugin-interactivity` yourself; `loadBasic` does not, and
  without it every interaction silently no-ops.)
- **`import * as THREE` defeated tree-shaking** — named imports took the chunk
  from **191 → 138.5 KB gzip**.
- **`cssCodeSplit: false` leaked `lab.css` onto the portfolio**, giving the main
  page a light nav bar over its dark hero. Only visible in the built output.

---

## Playability

| Interaction | Where |
|---|---|
| **Drag to orbit** | Anywhere on the dark chapter — the two camera inputs (scroll position, look offset) live in separate accumulators so they cannot fight |
| **Hover a node** | Raycast → the node scales, its edges light up, its label fades in |
| **Click a node** | Opens the detail panel with that record's résumé content |
| **`⌘K` / `Ctrl-K`** | Command palette: fuzzy search over roles, capabilities, sections and links, with arrow-key navigation |
| **Guided tour** | Flies the camera to each node in turn; any manual scroll cancels it |
| **Reset view** | Returns the camera to the flight path |
| **Filter chips** | Filters the capability grid with an AutoAnimate FLIP reflow (arrow-key navigable, live region announcing results) |
| **Click a card or timeline row** | Opens the same node the 3D graph would |
| **"View in 3D"** | Scrolls the camera back to that node |

---

## Architecture

```
├── index.html                 # dark chapter + light chapter
├── lab.html                   # the ten-library evaluation
├── vite.config.js             # manualChunks, modulepreload filter, cssCodeSplit
├── public/                    # copied verbatim into dist/
│   ├── assets/agent-core.json # bespoke Lottie, generated for this site
│   └── third-party/           # licence texts + provenance
├── src/
│   ├── main.js                # orchestrator; per-module error isolation
│   ├── styles.css             # the design system
│   ├── data/graph.js          # ONE source of truth: 3D nodes + document body
│   ├── scene/
│   │   ├── index.js           # renderer, curve-driven camera rig, picking, labels
│   │   ├── graph.js           # instanced nodes, edge shader, dust shader, grid
│   │   ├── post.js            # EffectComposer: bloom → tone map → grade
│   │   └── palette.js         # colours shared by CSS and GLSL
│   ├── lib/
│   │   ├── prefs.js           # motion prefs, capability detection
│   │   ├── scroll.js          # Lenis + ScrollTrigger wiring
│   │   └── particles-engine.js
│   └── modules/
│       ├── content.js         # renders the document FROM data/graph.js
│       ├── ui.js              # panel, command palette, HUD, nav state
│       ├── hero-flight.js     # scroll → camera progress + blur-in entrance
│       ├── reveals.js         # IntersectionObserver + CSS transitions
│       └── cap-filter.js      # AutoAnimate
└── tools/report-sizes.mjs     # measures a real build
```

### Notes from building the 3D layer

- `Curve.getPointAt()` (arc-length) not `getPoint()` — otherwise the camera
  visibly stutters through the control points.
- Damping uses `1 - exp(-dt·k)`, so the motion is identical at 60/120/144 Hz.
- `InstancedMesh` bounding spheres are **not** recomputed when instance
  transforms change, and a stale sphere silently culls the whole graph. The node
  mesh is `frustumCulled = false`.
- Additive blending ignores `scene.fog` entirely (fog is a shader chunk, not a
  pass), so the dust field fades on depth explicitly.
- All dust motion is in the vertex shader: zero per-frame buffer uploads.

### Resilience and accessibility

- Content is **never** hidden without working scripts: a `<head>` guard holds
  `.reveal`/`.hero-reveal` at `opacity: 0` only while scripts are confirmed live,
  and un-hides everything after 3 s.
- Every subsystem boots through `boot()`; failures land on `window.__siteErrors`
  and degrade instead of throwing.
- No WebGL → the canvas hides, the `<html>` ground colour shows, and the cream
  type is still perfectly readable.
- `prefers-reduced-motion` → Lenis off, camera parks on a single static frame,
  reveals shown immediately, HUD hidden.
- The graph is decoration (`aria-hidden`); every record is real DOM text, and
  the diagram carries a full `role="img"` description.

---

## Deploy

GitHub Pages via GitHub Actions
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)): `npm ci` → build
→ measure sizes → rebuild so the lab ships fresh numbers → deploy `dist/`.
Because the repository is named `<username>.github.io`, it publishes at the
domain root.

## Third-party assets

Runtimes are MIT. Two artwork files are vendored, with licences and provenance in
[`public/third-party/`](public/third-party/README.md): `rating.riv` (MIT) and
`echarts-chart.json` (Apache-2.0). `agent-core.json` is original work.

## Content

Derived from the résumé of Zhipeng (Louis) Ye. Contact details are deliberately
limited to email and LinkedIn.
