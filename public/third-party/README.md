# Third-party assets

The animation **runtimes** used by this site are all installed from npm and are
MIT-licensed. Two **asset files** are vendored, because animation runtimes are
only as useful as the artwork you feed them.

---

## `public/assets/rive/rating.riv`

| | |
|---|---|
| Source | <https://raw.githubusercontent.com/rive-app/rive-react/main/examples/public/rating.riv> |
| Upstream repo | [`rive-app/rive-react`](https://github.com/rive-app/rive-react) |
| License | **MIT** — see [`LICENSE-MIT-rive-react.txt`](./LICENSE-MIT-rive-react.txt) |
| Size | 16,204 bytes |
| SHA-256 | `2a85d71429e69424415a552fade7b590724c4c03a2426d5fdacc949dc12570f0` |
| Verified | HTTP 200, Rive magic bytes `52 49 56 45` (`RIVE`) |

Used only on the [`/lab.html`](../lab.html) evaluation page to demonstrate the
Rive runtime. The Rive **runtime** (`@rive-app/canvas`) is MIT and free for
commercial use with no attribution; only *authoring/exporting your own* `.riv`
requires a paid Rive plan.

---

## `public/assets/lottie/echarts-chart.json`

| | |
|---|---|
| Source | <https://raw.githubusercontent.com/apache/echarts-www/master/asset/lottie/json/chart.json> |
| Upstream repo | [`apache/echarts-www`](https://github.com/apache/echarts-www) |
| License | **Apache-2.0** — see [`LICENSE-Apache-2.0.txt`](./LICENSE-Apache-2.0.txt) |
| Size | 26,469 bytes |
| SHA-256 | `166a73620a4747f7779216a96a2b3efae54d77248337cb940f95704210cc05bd` |
| Verified | HTTP 200, valid Lottie (v5.7.3, 60 fps, 180×150, 10 layers, bar + line chart) |

Vendored to demonstrate that `lottie-web` renders real, third-party artwork — not
just the bespoke asset generated for this project. `apache/echarts-www` contains
no `NOTICE` file, so retaining the Apache-2.0 licence text above satisfies the
attribution requirement.

---

## Authored for this project

`public/assets/agent-core.json` is **original work**, generated programmatically
(see the generator logic described in [`README.md`](../README.md)). It carries no
third-party licence obligations. It is the only vector asset used on the main page.
