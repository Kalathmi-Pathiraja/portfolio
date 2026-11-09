## Kalathmi Pathiraja · portfolio

Static site (HTML, CSS, vanilla JS, D3, Plotly for the 3D lab). No build step.

### Run locally

```bash
python3 -m http.server 8931
```

Open `http://localhost:8931`.

### Files

- `index.html` — page content and section copy
- `styles.css` — the design system (graph paper, ink, signal red, folder colours)
- `charts.js` — the hero chart and ticker, plus every project's live view (forecast fan chart, Taylor rule and prior-tightness 3D surfaces, horse race, price-distribution ridgeline, emissions bubbles, regression run). `window.Charts.mount(name, el)` draws one into an element
- `main.js` — nav, work ledger, and the project cabinet. Folder contents live in the `FILES` array; a folder with `views` gets a Live badge and flips over to those charts
- `data/econ485.js`, `data/econ494.js` — generated data, do not edit by hand
- `assets/work/` — resized project images and photos

### Refreshing the data

The charts read real outputs from the coursework folders:

```bash
python3 scripts/build_econ485.py      # ~/Documents/ECON485 Governors' Challenge outputs
Rscript scripts/build_econ494.R       # ECON 494: BMS::datafls regressions + World Bank WDI (needs internet)
```
