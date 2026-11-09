/* Charts for the portfolio. Data: window.GC (ECON 485 work) and window.E494 (ECON 494 work).
   The hero chart and ticker run on the page. Every project chart is a "live view" that main.js
   mounts on the back of a project folder: window.Charts.mount(name, root) returns a cleanup. */
(() => {
  "use strict";

  const GC = window.GC;
  const E494 = window.E494;
  if (!window.d3 || !GC) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const C = {
    ink: css("--ink"),
    ink2: css("--ink-2"),
    muted: css("--muted"),
    paper: css("--paper"),
    red: css("--red"),
    blue: css("--blue"),
    blueSoft: css("--blue-soft"),
    pink: css("--pink"),
    yellow: css("--yellow"),
    green: css("--green"),
    orange: css("--orange"),
  };
  const ease = d3.easeCubicOut;
  const parse = d3.timeParse("%Y-%m");
  const fmtMonth = d3.timeFormat("%b %Y");

  const SCEN = [
    {
      key: "Base case",
      short: "Base",
      color: C.red,
      title: "Base case",
      body:
        "Oil eases from US$95 toward US$80 by mid-2028, tariffs stay where they are, the Fed's September projections hold for the US, and the policy rate sits at 2.5% throughout.",
    },
    {
      key: "S1: energy shock escalates",
      short: "Energy shock",
      color: C.orange,
      title: "S1 · The energy shock escalates",
      body:
        "Shipping through Hormuz stays disrupted. WTI builds to US$110 and stays there, energy costs spread into US core prices, and US growth slows a year later. The rate rises in 25 bp steps to 3.0%.",
    },
    {
      key: "S2: AI bubble bursts",
      short: "AI bust",
      color: C.blue,
      title: "S2 · The AI bubble bursts",
      body:
        "Calibrated on the dot-com bust: US growth, core inflation and Canadian exports follow the 2001 path, financial conditions tighten as in 2011 and 2022, and oil falls US$15. The rate is cut to 2.0%.",
    },
    {
      key: "S3: tariff loosening",
      short: "Tariffs ease",
      color: C.green,
      title: "S3 · Tariffs loosen",
      body:
        "After the US midterms Congress pushes back and tariffs are scaled back from late 2026. Exports to the US end 15% above the base path, phased in over half a year, and uncertainty fades.",
    },
  ];
  const SCEN_BY_KEY = Object.fromEntries(SCEN.map((s) => [s.key, s]));

  const SERIES = {
    cpi: { label: "CPI inflation", target: 2, fmt: (v) => `${v.toFixed(1)}%` },
    gdp: { label: "Real GDP growth", target: null, fmt: (v) => `${v.toFixed(1)}%` },
    unemp: { label: "Unemployment rate", target: null, fmt: (v) => `${v.toFixed(1)}%` },
  };

  /* ------------------------------------------------------------------ helpers */
  function whenVisible(el, fn, rootMargin = "0px 0px -15% 0px") {
    if (!el) return () => {};
    if (!("IntersectionObserver" in window)) {
      fn();
      return () => {};
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          fn();
        }
      },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }

  function onResize(el, fn) {
    let w = el.clientWidth;
    let t;
    const ro = new ResizeObserver(() => {
      if (Math.abs(el.clientWidth - w) < 4) return;
      w = el.clientWidth;
      clearTimeout(t);
      t = setTimeout(fn, 120);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }

  function tip(container) {
    const el = document.createElement("div");
    el.className = "chart-tip";
    container.style.position = "relative";
    container.appendChild(el);
    return {
      show(html, x, y) {
        el.innerHTML = html;
        el.classList.add("is-on");
        const cw = container.clientWidth;
        const tw = el.offsetWidth;
        let left = x + 14;
        if (left + tw > cw - 4) left = x - tw - 14;
        el.style.left = `${Math.max(4, left)}px`;
        el.style.top = `${Math.max(4, y - 10)}px`;
      },
      hide() {
        el.classList.remove("is-on");
      },
    };
  }

  function svgIn(container, margin) {
    d3.select(container).selectAll("svg").remove();
    const w = container.clientWidth;
    const h = container.clientHeight;
    const svg = d3
      .select(container)
      .insert("svg", ":first-child")
      .attr("class", "chart")
      .attr("width", w)
      .attr("height", h)
      .attr("viewBox", `0 0 ${w} ${h}`);
    const g = svg.append("g").attr("transform", `translate(${margin.l},${margin.t})`);
    // a container can measure 0 before layout settles; the resize observer redraws it
    return { svg, g, w: Math.max(40, w - margin.l - margin.r), h: Math.max(40, h - margin.t - margin.b) };
  }

  function drawLine(path, ms, delay = 0) {
    if (reduce) return;
    const node = path.node();
    if (!node) return;
    const len = node.getTotalLength();
    path
      .attr("stroke-dasharray", `${len} ${len}`)
      .attr("stroke-dashoffset", len)
      .transition()
      .delay(delay)
      .duration(ms)
      .ease(d3.easeCubicInOut)
      .attr("stroke-dashoffset", 0)
      .on("end", () => path.attr("stroke-dasharray", null));
  }

  function segTabs(root, sel, onPick, attr = "aria-selected") {
    const btns = [...root.querySelectorAll(`${sel} button`)];
    btns.forEach((b) =>
      b.addEventListener("click", () => {
        btns.forEach((o) => o.setAttribute(attr, String(o === b)));
        onPick(b);
      })
    );
  }

  const rows = (series, key) =>
    GC.forecast[key][series].map((r) => ({ date: parse(r[0]), lo95: r[1], lo80: r[2], med: r[3], hi80: r[4], hi95: r[5] }));
  const forecastStart = (fc) => (fc.find((d) => d.hi95 - d.lo95 > 1e-6) || fc[0]).date;
  const hist = (series, from) =>
    GC.history[series].map((r) => ({ date: parse(r[0]), v: r[1] })).filter((d) => d.date >= from);

  /* ------------------------------------------------------------------ hero collage: a halftone city behind the chart
     card, towers at its right edge, and a crane lowering its hook onto the forecast line */
  function city(animate, hook) {
    const stage = document.querySelector("[data-stage]");
    const back = stage && stage.querySelector("[data-city-back]");
    const front = stage && stage.querySelector("[data-city-front]");
    const body = document.getElementById("heroChart");
    if (!stage || !back || !front || !body) return;
    // layout offsets, not screen rects: the card may still be mid-entrance (translated) when this runs
    const card = stage.querySelector(".hero__chart");
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const cardL = card.offsetLeft;
    const cardR = card.offsetLeft + card.offsetWidth;
    const cardT = card.offsetTop;
    const cardB = card.offsetTop + card.offsetHeight;
    const bodyL = cardL + body.offsetLeft;
    const bodyT = cardT + body.offsetTop;
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const anim = animate && !reduce;

    const prep = (svgEl, id) => {
      const s = d3.select(svgEl).attr("width", W).attr("height", H).attr("viewBox", `0 0 ${W} ${H}`);
      s.selectAll("*").remove();
      const defs = s.append("defs");
      defs.append("pattern").attr("id", `dots-${id}`).attr("width", 4).attr("height", 4).attr("patternUnits", "userSpaceOnUse")
        .append("circle").attr("cx", 2).attr("cy", 2).attr("r", 1.1).attr("fill", C.blue);
      const win = defs.append("pattern").attr("id", `win-${id}`).attr("width", 7).attr("height", 9).attr("patternUnits", "userSpaceOnUse");
      win.append("rect").attr("x", 2).attr("y", 2).attr("width", 2.6).attr("height", 4).attr("fill", "#f3f0e8").attr("opacity", 0.75);
      return s;
    };
    const tower = (s, id, x0, top, bw, bottom, opts = {}) => {
      const g = s.append("g").attr("class", "bld");
      const rect = (x, y, w, h) => {
        g.append("rect").attr("x", x).attr("y", y).attr("width", w).attr("height", h).attr("fill", opts.base || "#c3cdf3");
        g.append("rect").attr("x", x).attr("y", y).attr("width", w).attr("height", h).attr("fill", `url(#dots-${id})`);
        g.append("rect").attr("x", x).attr("y", y).attr("width", w).attr("height", h).attr("fill", `url(#win-${id})`);
        g.append("path").attr("d", `M${x},${y + h} V${y} H${x + w} V${y + h}`).attr("fill", "none").attr("stroke", C.ink).attr("stroke-width", 1);
      };
      rect(x0, top, bw, bottom - top);
      if (opts.setback) rect(x0 + bw * 0.18, top - 14, bw * 0.64, 14);
      if (opts.spire) g.append("line").attr("x1", x0 + bw / 2).attr("x2", x0 + bw / 2).attr("y1", top - (opts.setback ? 14 : 0)).attr("y2", top - 34).attr("stroke", C.ink).attr("stroke-width", 1.2);
      if (anim)
        g.attr("transform", `translate(0,${bottom}) scale(1,0) translate(0,${-bottom})`)
          .transition().delay(opts.delay || 0).duration(700).ease(d3.easeCubicOut)
          .attr("transform", `translate(0,${bottom}) scale(1,1) translate(0,${-bottom})`);
      return g;
    };

    // behind the card: rooftops peeking over its top edge
    const sb = prep(back, "b");
    let x = cardL - 6;
    let i = 0;
    while (x < cardR + 30) {
      const bw = 22 + rnd() * 34;
      const peek = 10 + rnd() * Math.max(10, cardT - 14);
      tower(sb, "b", x, cardT - peek, bw, cardB - 40, { setback: rnd() < 0.3, spire: rnd() > 0.85, delay: 60 + i * 35 });
      x += bw + 3 + rnd() * 10;
      i++;
    }

    // in front, at the card's right edge: a cluster of towers and the crane
    const sf = prep(front, "f");
    const narrow = W < 560;
    const gut = W - cardR;
    const tw = narrow ? [18, 22, 16] : [30, 40, 26];
    const tops = [cardT + (cardB - cardT) * 0.45, cardT - (narrow ? 8 : 26), cardT + (cardB - cardT) * 0.3];
    const xs = [narrow ? cardR + 1 : cardR - tw[0] * 0.35, cardR + gut * 0.1, cardR + gut - tw[2] * 0.95];
    const bottomF = H;
    [0, 2, 1].forEach((k, n) => tower(sf, "f", xs[k], tops[k], tw[k], bottomF, { setback: k === 1, delay: 300 + n * 120, base: k === 1 ? "#b4c1f1" : "#c3cdf3" }));

    const mastX = xs[1] + tw[1] / 2 - 4;
    const mastBase = tops[1] - 14;
    const mastTop = Math.max(4, mastBase - (narrow ? 34 : 58));
    const hx = bodyL + hook.px;
    const hy = bodyT + hook.py - 14;
    const jibY = mastTop + 6;
    const jibL = Math.min(hx - 26, mastX - 60);
    const crane = sf.append("g").attr("stroke", C.ink).attr("fill", "none");
    const mw = 7;
    crane.append("line").attr("x1", mastX).attr("x2", mastX).attr("y1", mastBase).attr("y2", mastTop);
    crane.append("line").attr("x1", mastX + mw).attr("x2", mastX + mw).attr("y1", mastBase).attr("y2", mastTop);
    for (let yy = mastBase; yy > mastTop + mw; yy -= mw) crane.append("line").attr("x1", mastX).attr("x2", mastX + mw).attr("y1", yy).attr("y2", yy - mw).attr("stroke-width", 0.7);
    crane.append("line").attr("x1", jibL).attr("x2", mastX + mw + 22).attr("y1", jibY).attr("y2", jibY);
    crane.append("line").attr("x1", jibL).attr("x2", mastX + mw + 22).attr("y1", jibY + 5).attr("y2", jibY + 5);
    for (let xx = jibL; xx < mastX + mw + 20; xx += 6) crane.append("line").attr("x1", xx).attr("x2", xx + 6).attr("y1", jibY + 5).attr("y2", jibY).attr("stroke-width", 0.6);
    crane.append("line").attr("x1", mastX + mw / 2).attr("x2", mastX + mw / 2).attr("y1", jibY).attr("y2", jibY - 14);
    crane.append("line").attr("x1", mastX + mw / 2).attr("x2", jibL + 10).attr("y1", jibY - 14).attr("y2", jibY).attr("stroke-width", 0.6);
    crane.append("line").attr("x1", mastX + mw / 2).attr("x2", mastX + mw + 22).attr("y1", jibY - 14).attr("y2", jibY).attr("stroke-width", 0.6);
    crane.append("rect").attr("x", mastX + mw + 10).attr("y", jibY + 5).attr("width", 12).attr("height", 8).attr("fill", C.ink);
    crane.append("rect").attr("x", hx - 4).attr("y", jibY + 5).attr("width", 8).attr("height", 4).attr("fill", C.ink);
    const cable = crane.append("line").attr("x1", hx).attr("x2", hx).attr("y1", jibY + 9).attr("y2", hy - 6).attr("stroke-width", 0.9);
    const bucket = sf.append("path").attr("d", `M${hx - 7},${hy - 6} h14 l-3.5,10 h-7 z`).attr("fill", C.ink);
    if (anim) {
      crane.attr("opacity", 0).transition().delay(700).duration(500).attr("opacity", 1);
      cable.attr("y2", jibY + 9).transition().delay(2200).duration(1000).ease(d3.easeCubicInOut).attr("y2", hy - 6);
      bucket.attr("opacity", 0).attr("transform", `translate(0,${jibY + 15 - hy})`)
        .transition().delay(2200).duration(1000).ease(d3.easeCubicInOut).attr("opacity", 1).attr("transform", "translate(0,0)");
    }
  }

  /* ------------------------------------------------------------------ hero chart (page) */
  function heroChart() {
    const el = document.getElementById("heroChart");
    if (!el) return;
    const render = (animate) => {
      const narrow = el.clientWidth < 520;
      const m = { t: 18, r: narrow ? 14 : 22, b: 26, l: 30 };
      const { svg, g, w, h } = svgIn(el, m);
      const fc = rows("cpi", "Base case");
      const fStart = forecastStart(fc);
      const lastData = fc.filter((d) => d.date < fStart).pop();
      const hData = hist("cpi", parse("2019-01")).filter((d) => d.date < fc[0].date);
      fc.filter((d) => d.date < fStart).forEach((d) => hData.push({ date: d.date, v: d.med }));
      const fLine = fc.filter((d) => d.date >= lastData.date);

      const x = d3.scaleTime().domain([parse("2019-01"), fc[fc.length - 1].date]).range([0, w]);
      const y = d3.scaleLinear().domain([-1, 9]).range([h, 0]);

      g.append("rect").attr("class", "fc-zone").attr("x", x(fStart)).attr("y", 0).attr("width", w - x(fStart)).attr("height", h);
      if (w - x(fStart) > 70) g.append("text").attr("class", "fc-label").attr("x", x(fStart) + 8).attr("y", 12).text("Forecast");
      g.append("g").attr("class", "grid").call(d3.axisLeft(y).tickValues([0, 2, 4, 6, 8]).tickSize(-w).tickFormat(""));
      g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickValues([0, 2, 4, 6, 8]).tickSize(0).tickPadding(8));
      g.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${h})`)
        .call(d3.axisBottom(x).ticks(d3.timeYear.every(narrow ? 2 : 1)).tickSize(0).tickPadding(10));
      g.append("line").attr("class", "target").attr("x1", 0).attr("x2", w).attr("y1", y(2)).attr("y2", y(2));
      g.append("text").attr("x", x(parse("2023-09"))).attr("y", y(2) + 16).text("2% target");

      const line = d3.line().x((d) => x(d.date)).y((d) => y(d.v)).curve(d3.curveMonotoneX);
      const medAt = (date) => fLine.reduce((a, b) => (Math.abs(b.date - date) < Math.abs(a.date - date) ? b : a));
      const hookPt = medAt(parse("2027-07"));
      requestAnimationFrame(() => city(animate, { px: m.l + x(hookPt.date), py: m.t + y(hookPt.med) }));

      const area = (lo, hi) => d3.area().x((d) => x(d.date)).y0((d) => y(d[lo])).y1((d) => y(d[hi])).curve(d3.curveMonotoneX);
      const b95 = g.append("path").datum(fLine).attr("d", area("lo95", "hi95")).attr("fill", C.red).attr("opacity", 0.12);
      const b80 = g.append("path").datum(fLine).attr("d", area("lo80", "hi80")).attr("fill", C.red).attr("opacity", 0.22);
      // a paper halo keeps the line readable where it crosses the buildings
      const halo = g.append("path").datum(hData).attr("d", line).attr("fill", "none").attr("stroke", "#fbfaf6").attr("stroke-width", 6).attr("stroke-linejoin", "round");
      const hp = g.append("path").datum(hData).attr("class", "hist-line").attr("d", line);
      if (animate && !reduce) drawLine(halo, 1500, 250);
      const fp = g
        .append("path")
        .datum(fLine.map((d) => ({ date: d.date, v: d.med })))
        .attr("d", line)
        .attr("fill", "none")
        .attr("stroke", C.red)
        .attr("stroke-width", 2.6);

      const peak = hData.reduce((a, b) => (b.v > a.v ? b : a));
      const shock = hData.find((d) => +d.date === +parse("2026-03")) || hData[hData.length - 6];
      const end = fLine[fLine.length - 1];
      const notes = [
        { d: peak, v: peak.v, t: `${peak.v.toFixed(1)}%`, s: fmtMonth(peak.date), dx: 14, dy: -4 },
        { d: shock, v: shock.v, t: "Oil shock", s: "Mar 2026", dx: -16, dy: -34, anchor: "end" },
        narrow
          ? { d: end, v: end.med, t: `${end.med.toFixed(1)}%`, s: "", dx: -10, dy: 26, anchor: "end" }
          : { d: end, v: end.med, t: `${end.med.toFixed(1)}%`, s: "mid-2028", dx: -14, dy: 46, anchor: "end" },
      ];
      const ann = g.append("g");
      notes.forEach((n, i) => {
        const cx = x(n.d.date);
        const cy = y(n.v);
        const gg = ann.append("g").attr("opacity", animate && !reduce ? 0 : 1);
        gg.append("circle").attr("class", "ring").attr("cx", cx).attr("cy", cy).attr("r", 9);
        if (!narrow || i !== 1) {
          gg.append("text").attr("class", "anno").attr("x", cx + n.dx).attr("y", cy + n.dy).attr("text-anchor", n.anchor || "start").text(n.t);
          gg.append("text").attr("class", "anno-sub").attr("x", cx + n.dx).attr("y", cy + n.dy + 14).attr("text-anchor", n.anchor || "start").text(n.s);
        }
        if (animate && !reduce) gg.transition().delay(1500 + i * 180).duration(400).ease(ease).attr("opacity", 1);
      });

      if (animate && !reduce) {
        drawLine(hp, 1500, 250);
        drawLine(fp, 700, 1650);
        [b95, b80].forEach((b) => b.attr("opacity", 0).transition().delay(1750).duration(700).attr("opacity", b === b95 ? 0.12 : 0.22));
      }
    };
    render(true);
    onResize(el, () => render(false));
  }

  /* ------------------------------------------------------------------ ticker (page): interests and projects */
  function ticker() {
    const el = document.querySelector("[data-ticker]");
    if (!el) return;
    const items = [
      ["BVAR", "Governors' Challenge forecast", "up"],
      ["RMSE", "Forecast error vs. a plain AR", "down"],
      ["CLMB", "Rock climbing", "up"],
      ["SLEP", "Sleep in Governors' Challenge week", "down"],
      ["CPI", "Oil shock price study", "up"],
      ["HIKE", "Hiking", "up"],
      ["CAFF", "Coffee left in the pot", "down"],
      ["OLS", "7,770 regressions", "up"],
      ["FOOD", "Travel & local food", "up"],
      ["MOI", "Housing affordability squeeze", "down"],
      ["CO2", "Emissions and income", "up"],
      ["FREE", "Free time this semester", "down"],
      ["SWIM", "Swimming", "up"],
      ["MCMC", "Monte Carlo pay valuation", "up"],
      ["KRTE", "Karate", "up"],
      ["BUGS", "Errors in the R scripts", "down"],
      ["NGHT", "Nightlight consumer map", "up"],
      ["BDMN", "Badminton", "up"],
      ["MUSC", "Playlists on repeat", "up"],
    ];
    const html = items
      .map(([k, s, dir]) => `<span class="ticker__item"><b class="${dir}">${k} ${dir === "up" ? "▲" : "▼"}</b><span>${s}</span></span>`)
      .join("");
    el.innerHTML = html + html;
  }

  /* ------------------------------------------------------------------ live view: forecast */
  function forecastView(root) {
    root.innerHTML = `
      <div class="live">
        <div class="live-card live-card--main">
          <div class="panel__bar">
            <div class="seg" role="tablist" aria-label="Forecast variable" data-series-tabs>
              <button role="tab" aria-selected="true" data-series="cpi">CPI inflation</button>
              <button role="tab" aria-selected="false" data-series="gdp">Real GDP</button>
              <button role="tab" aria-selected="false" data-series="unemp">Unemployment</button>
            </div>
            <div class="seg seg--scen" role="radiogroup" aria-label="Scenario" data-scen-tabs>
              ${SCEN.map((s, i) => `<button role="radio" aria-checked="${i === 0}" data-scen="${s.key}" style="--c:${s.color}"><i></i>${s.short}</button>`).join("")}
            </div>
          </div>
          <div class="fan" data-fan></div>
          <div class="panel__foot">
            <span><i class="sw sw--band95"></i>95% band</span>
            <span><i class="sw sw--band80"></i>80% band</span>
            <span><i class="sw sw--line"></i>Median</span>
            <span><i class="sw" style="height:0;border-top:1.5px dashed var(--muted);background:none"></i>Other scenarios</span>
          </div>
        </div>
        <div class="live-row">
          <div class="live-card">
            <p class="panel__label">Annual averages · <span data-scen-name>Base case</span></p>
            <table class="avg" aria-label="Annual average forecasts for the selected scenario">
              <thead><tr><th scope="col"></th><th scope="col">2026</th><th scope="col">2027</th><th scope="col">2028 H1</th></tr></thead>
              <tbody data-avg-body></tbody>
            </table>
          </div>
          <div class="live-story">
            <p class="panel__label">The scenario</p>
            <h4 class="story__title" data-scen-title>Base case</h4>
            <p class="story__body" data-scen-body></p>
            <div class="story__sparks">
              <figure><figcaption>WTI oil, y/y change (US$)</figcaption><div class="spark" data-spark="oil"></div></figure>
              <figure><figcaption>Policy rate path (%)</figcaption><div class="spark" data-spark="rate"></div></figure>
            </div>
          </div>
        </div>
      </div>`;

    const state = { series: "cpi", scen: "Base case" };
    const el = root.querySelector("[data-fan]");
    const card = root.querySelector(".live-card--main");
    const t = tip(el);
    let ctx = null;

    function build() {
      const narrow = el.clientWidth < 560;
      const m = { t: 16, r: narrow ? 12 : 20, b: 28, l: 36 };
      const { svg, g, w, h } = svgIn(el, m);
      const start = parse("2023-01");
      const anyFc = rows("cpi", "Base case");
      const end = anyFc[anyFc.length - 1].date;
      const x = d3.scaleTime().domain([start, end]).range([0, w]);
      const y = d3.scaleLinear().range([h, 0]);
      const fStart = forecastStart(anyFc);
      g.append("rect").attr("class", "fc-zone").attr("x", x(fStart)).attr("width", w - x(fStart)).attr("height", h);
      g.append("text").attr("class", "fc-label").attr("x", x(fStart) + 8).attr("y", 12).text("Forecast");
      const gridG = g.append("g").attr("class", "grid");
      const yAx = g.append("g").attr("class", "axis");
      g.append("g").attr("class", "axis").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(d3.timeYear.every(1)).tickSize(0).tickPadding(10));
      const target = g.append("line").attr("class", "target").attr("x1", 0).attr("x2", w);
      const b95 = g.append("path").attr("opacity", 0.14);
      const b80 = g.append("path").attr("opacity", 0.28);
      const ghosts = g.append("g");
      const hp = g.append("path").attr("class", "hist-line");
      const mp = g.append("path").attr("fill", "none").attr("stroke-width", 2.6);
      const endDot = g.append("circle").attr("r", 4.5).attr("stroke", "#fff").attr("stroke-width", 2);
      const endLbl = g.append("text").attr("class", "anno").attr("text-anchor", "end");
      const cross = g.append("line").attr("class", "crosshair").attr("y1", 0).attr("y2", h).attr("opacity", 0);
      const hot = g.append("circle").attr("r", 4).attr("opacity", 0);
      const overlay = g.append("rect").attr("width", w).attr("height", h).attr("fill", "transparent");
      ctx = { svg, g, w, h, x, y, start, gridG, yAx, target, b95, b80, ghosts, hp, mp, endDot, endLbl, cross, hot, overlay };
      update(false);
    }

    function update(animate) {
      if (!ctx) return;
      const { x, y, w, gridG, yAx, target, b95, b80, ghosts, hp, mp, endDot, endLbl, start } = ctx;
      const s = state.series;
      const sc = SCEN_BY_KEY[state.scen];
      card.style.setProperty("--scen", sc.color);
      const fcAll = SCEN.map((k) => ({ k, fc: rows(s, k.key) }));
      const fc = fcAll.find((f) => f.k.key === state.scen).fc;
      const hData = hist(s, start).filter((d) => d.date < fc[0].date);
      const fStart = forecastStart(fc);
      fc.filter((d) => d.date < fStart).forEach((d) => hData.push({ date: d.date, v: d.med }));
      const fc2 = fc.filter((d) => d.date >= fc.filter((q) => q.date < fStart).pop().date);

      const lo = d3.min([...hData.map((d) => d.v), ...fcAll.flatMap((f) => f.fc.map((d) => d.lo95))]);
      const hi = d3.max([...hData.map((d) => d.v), ...fcAll.flatMap((f) => f.fc.map((d) => d.hi95))]);
      y.domain([Math.floor(lo - 0.3), Math.ceil(hi + 0.3)]).nice();

      const T = (sel) => (animate && !reduce ? sel.transition().duration(650).ease(d3.easeCubicInOut) : sel);
      T(gridG).call(d3.axisLeft(y).ticks(6).tickSize(-w).tickFormat(""));
      T(yAx).call(d3.axisLeft(y).ticks(6).tickSize(0).tickPadding(8));
      const tgt = SERIES[s].target;
      T(target).attr("y1", tgt != null ? y(tgt) : -10).attr("y2", tgt != null ? y(tgt) : -10).attr("opacity", tgt != null ? 1 : 0);

      const area = (l, u) => d3.area().x((d) => x(d.date)).y0((d) => y(d[l])).y1((d) => y(d[u])).curve(d3.curveMonotoneX);
      const line = d3.line().x((d) => x(d.date)).y((d) => y(d.v)).curve(d3.curveMonotoneX);
      T(b95.datum(fc2).attr("fill", sc.color)).attr("d", area("lo95", "hi95"));
      T(b80.datum(fc2).attr("fill", sc.color)).attr("d", area("lo80", "hi80"));
      T(hp.datum(hData)).attr("d", line);

      const gs = ghosts.selectAll("path").data(fcAll.filter((f) => f.k.key !== state.scen), (d) => d.k.key);
      gs.exit().remove();
      T(gs.enter().append("path").attr("fill", "none").attr("stroke-width", 1.4).attr("stroke-dasharray", "4 3").merge(gs).attr("stroke", (d) => d.k.color).attr("opacity", 0.55)).attr(
        "d",
        (d) => line(d.fc.filter((q) => q.date >= fc2[0].date).map((q) => ({ date: q.date, v: q.med })))
      );

      const med = fc2.map((d) => ({ date: d.date, v: d.med }));
      T(mp.datum(med).attr("stroke", sc.color)).attr("d", line);
      const last = med[med.length - 1];
      T(endDot.attr("fill", sc.color)).attr("cx", x(last.date)).attr("cy", y(last.v));
      endLbl.text(SERIES[s].fmt(last.v));
      T(endLbl).attr("x", x(last.date) - 10).attr("y", y(last.v) - 12);

      const all = [...hData.map((d) => ({ ...d, kind: "data" })), ...fc2.slice(1).map((d) => ({ date: d.date, v: d.med, d, kind: "fc" }))];
      const bis = d3.bisector((d) => d.date).center;
      ctx.overlay
        .on("pointermove", (ev) => {
          const [mx] = d3.pointer(ev);
          const p = all[bis(all, x.invert(mx))];
          if (!p) return;
          ctx.cross.attr("x1", x(p.date)).attr("x2", x(p.date)).attr("opacity", 1);
          ctx.hot.attr("cx", x(p.date)).attr("cy", y(p.v)).attr("opacity", 1).attr("fill", p.kind === "fc" ? sc.color : C.ink);
          const html =
            p.kind === "fc"
              ? `<span class="k">${fmtMonth(p.date)} · ${sc.short}</span><br><b>${SERIES[s].fmt(p.v)}</b> median<br><span class="k">80%: ${p.d.lo80.toFixed(1)} to ${p.d.hi80.toFixed(1)}</span>`
              : `<span class="k">${fmtMonth(p.date)} · data</span><br><b>${SERIES[s].fmt(p.v)}</b>`;
          t.show(html, x(p.date) + 36, y(p.v) + 16);
        })
        .on("pointerleave", () => {
          ctx.cross.attr("opacity", 0);
          ctx.hot.attr("opacity", 0);
          t.hide();
        });
    }

    function tweenText(cell, to) {
      const from = parseFloat(cell.textContent);
      if (reduce || !Number.isFinite(from) || from === to) {
        cell.textContent = to.toFixed(1);
        return;
      }
      d3.select(cell)
        .transition()
        .duration(500)
        .ease(ease)
        .tween("text", () => {
          const i = d3.interpolateNumber(from, to);
          return (tt) => (cell.textContent = i(tt).toFixed(1));
        });
    }

    function side(animate) {
      const sc = SCEN_BY_KEY[state.scen];
      root.querySelector("[data-scen-name]").textContent = sc.short === "Base" ? "Base case" : sc.title.split(" · ")[1];
      root.querySelector("[data-scen-title]").textContent = sc.title;
      root.querySelector("[data-scen-body]").textContent = sc.body;
      const tb = root.querySelector("[data-avg-body]");
      const A = GC.annual[state.scen];
      const B = GC.annual["Base case"];
      const periods = ["2026", "2027", "2028 H1"];
      const lab = { cpi: "CPI", gdp: "GDP", unemp: "Unemployment" };
      if (!tb.children.length) {
        tb.innerHTML = Object.keys(lab)
          .map((k) => `<tr data-row="${k}"><th scope="row">${lab[k]}</th>${periods.map((p) => `<td data-p="${p}">${A[`${k}|${p}`].toFixed(1)}</td>`).join("")}</tr>`)
          .join("");
      }
      Object.keys(lab).forEach((k) =>
        periods.forEach((p) => {
          const td = tb.querySelector(`[data-row="${k}"] [data-p="${p}"]`);
          const v = A[`${k}|${p}`];
          const d = v - B[`${k}|${p}`];
          td.classList.toggle("is-up", d > 0.05);
          td.classList.toggle("is-down", d < -0.05);
          animate ? tweenText(td, v) : (td.textContent = v.toFixed(1));
        })
      );
      sparks(animate);
    }

    function sparks(animate) {
      root.querySelectorAll("[data-spark]").forEach((sp) => {
        const key = sp.dataset.spark;
        const pts = (k) => (GC.paths[k]?.[key] || []).map((r) => ({ date: parse(r[0]), v: r[1] }));
        const data = pts("Data");
        const base = pts("Base case");
        const cur = pts(state.scen);
        if (!data.length) return;
        const sc = SCEN_BY_KEY[state.scen];
        let svg = d3.select(sp).select("svg");
        const w = sp.clientWidth;
        const h = sp.clientHeight;
        const m = { t: 10, r: 34, b: 6, l: 4 };
        const all = [...data, ...base, ...cur];
        const x = d3.scaleTime().domain(d3.extent(all, (d) => d.date)).range([m.l, w - m.r]);
        const y = d3.scaleLinear().domain(d3.extent(all, (d) => d.v)).nice().range([h - m.b, m.t]);
        const line = d3.line().x((d) => x(d.date)).y((d) => y(d.v)).curve(d3.curveMonotoneX);
        if (svg.empty() || +svg.attr("width") !== w) {
          d3.select(sp).selectAll("svg").remove();
          svg = d3.select(sp).append("svg").attr("width", w).attr("height", h).attr("class", "chart");
          svg.append("path").attr("class", "sp-data").attr("fill", "none").attr("stroke", "rgba(243,240,232,.85)").attr("stroke-width", 1.6);
          svg.append("path").attr("class", "sp-base").attr("fill", "none").attr("stroke", "rgba(243,240,232,.4)").attr("stroke-width", 1.4).attr("stroke-dasharray", "3 3");
          svg.append("path").attr("class", "sp-cur").attr("fill", "none").attr("stroke-width", 2.4);
          svg.append("text").attr("class", "sp-val").style("fill", "#f3f0e8").style("font-size", "12px");
        }
        const T = (s) => (animate && !reduce ? s.transition().duration(600).ease(d3.easeCubicInOut) : s);
        svg.select(".sp-data").datum(data).attr("d", line);
        T(svg.select(".sp-base").datum([data[data.length - 1], ...base])).attr("d", line);
        T(svg.select(".sp-cur").datum([data[data.length - 1], ...cur]).attr("stroke", sc.color)).attr("d", line);
        const lv = cur[cur.length - 1];
        svg.select(".sp-val").text(key === "rate" ? lv.v.toFixed(2) : `${lv.v > 0 ? "+" : ""}${Math.round(lv.v)}`);
        T(svg.select(".sp-val")).attr("x", x(lv.date) + 4).attr("y", y(lv.v) + 4);
      });
    }

    segTabs(root, "[data-series-tabs]", (b) => {
      state.series = b.dataset.series;
      update(true);
    });
    segTabs(
      root,
      "[data-scen-tabs]",
      (b) => {
        state.scen = b.dataset.scen;
        update(true);
        side(true);
      },
      "aria-checked"
    );

    build();
    side(false);
    if (!reduce) {
      drawLine(ctx.mp, 900, 150);
      [ctx.b95, ctx.b80].forEach((b, i) => b.attr("opacity", 0).transition().delay(500).duration(700).attr("opacity", i ? 0.28 : 0.14));
    }
    const offs = [onResize(el, build), onResize(root, () => sparks(false))];
    return () => offs.forEach((f) => f());
  }

  /* ------------------------------------------------------------------ live view: horse race */
  function raceView(root) {
    const MODELS = [
      { k: "rbvar_27", n: "Restricted BVAR (mine)", c: C.red, w: 3.2 },
      { k: "combo", n: "Combination", c: C.ink, w: 1.8 },
      { k: "lasso", n: "Lasso", c: C.blue, w: 1.8 },
      { k: "rf", n: "Random forest", c: C.green, w: 1.8 },
      { k: "nn", n: "Neural network", c: "#c76a96", w: 1.8 },
      { k: "var_all", n: "VAR, all 12 (OLS)", c: C.orange, w: 1.8 },
    ].filter((m) => GC.race[m.k]);
    root.innerHTML = `
      <div class="live">
        <div class="live-card live-card--main">
          <div class="panel__bar">
            <div>
              <p class="panel__label">133 monthly forecasts, Dec 2007 to Dec 2018</p>
              <h4 class="live__title">Tested against six rivals before I trusted it</h4>
            </div>
            <div class="seg" role="tablist" aria-label="Variable" data-race-tabs>
              <button role="tab" aria-selected="true" data-target="gdp">GDP</button>
              <button role="tab" aria-selected="false" data-target="cpi">CPI</button>
              <button role="tab" aria-selected="false" data-target="unemp">Unemployment</button>
            </div>
          </div>
          <div class="race" data-race></div>
          <div class="panel__foot panel__foot--wrap">
            ${MODELS.map((m) => `<span data-m="${m.k}"><i class="sw" style="--c:${m.c};height:${m.w > 2 ? 4 : 3}px"></i>${m.n}</span>`).join("")}
            <span><i class="sw" style="height:0;border-top:1.5px dashed ${C.ink2};background:none"></i>AR benchmark</span>
          </div>
          <p class="panel__note">Forecast error relative to a simple AR model, using only data available at the time. Below the dashed line beats the benchmark. Hover a line to isolate it.</p>
        </div>
      </div>`;
    const el = root.querySelector("[data-race]");
    const legend = root.querySelector(".panel__foot");
    const H = [1, 3, 6, 12];
    let target = "gdp";
    let ctx;
    const t = tip(el);

    function build(animate) {
      const m = { t: 14, r: 16, b: 30, l: 38 };
      const { g, w, h } = svgIn(el, m);
      const x = d3.scaleLinear().domain([1, 12]).range([0, w]);
      const y = d3.scaleLinear().domain([0.75, 1.8]).range([h, 0]);
      const clipId = `raceClip${Math.random().toString(36).slice(2, 7)}`;
      g.append("defs").append("clipPath").attr("id", clipId).append("rect").attr("x", -6).attr("y", -6).attr("width", w + 12).attr("height", h + 6);
      g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(5).tickSize(-w).tickFormat(""));
      g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(8));
      g.append("g").attr("class", "axis").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).tickValues(H).tickSize(0).tickPadding(10).tickFormat((d) => `${d}m`));
      g.append("line").attr("class", "target").attr("x1", 0).attr("x2", w).attr("y1", y(1)).attr("y2", y(1));
      g.append("text").attr("x", w).attr("y", h - 6).attr("text-anchor", "end").text("better ↓");
      const lines = g.append("g").attr("clip-path", `url(#${clipId})`);
      ctx = { x, y, lines };
      update(animate);
    }

    function update(animate) {
      const { x, y, lines } = ctx;
      const line = d3.line().x((d) => x(d.h)).y((d) => y(Math.min(d.v, 1.86))).curve(d3.curveMonotoneX);
      const data = [...MODELS].reverse().map((m) => ({ ...m, pts: H.map((hh) => ({ h: hh, v: GC.race[m.k][target][hh] })) }));
      const sel = lines.selectAll("g.m").data(data, (d) => d.k);
      const enter = sel.enter().append("g").attr("class", "m");
      enter.append("path").attr("class", "ln").attr("fill", "none").attr("stroke-linejoin", "round").attr("stroke-linecap", "round");
      enter.append("g").attr("class", "dots");
      enter.append("path").attr("class", "hit").attr("fill", "none").attr("stroke", "transparent").attr("stroke-width", 14);
      const all = enter.merge(sel);
      const T = (s) => (animate === true && !reduce ? s.transition().duration(650).ease(d3.easeCubicInOut) : s);
      all.each(function (d) {
        const gg = d3.select(this);
        T(gg.select(".ln").attr("stroke", d.c).attr("stroke-width", d.w)).attr("d", line(d.pts));
        gg.select(".hit").attr("d", line(d.pts));
        const dots = gg.select(".dots").selectAll("circle").data(d.pts);
        T(dots.enter().append("circle").attr("r", d.w > 2 ? 4.5 : 3.2).attr("fill", d.c).attr("stroke", "#fff").attr("stroke-width", 1.5).merge(dots))
          .attr("cx", (q) => x(q.h))
          .attr("cy", (q) => y(Math.min(q.v, 1.86)));
      });
      const focus = (k) => {
        all.transition().duration(160).attr("opacity", (d) => (!k || d.k === k ? 1 : 0.12));
        legend.querySelectorAll("[data-m]").forEach((s) => (s.style.opacity = !k || s.dataset.m === k ? 1 : 0.4));
      };
      all
        .on("pointerenter", (ev, d) => focus(d.k))
        .on("pointermove", (ev, d) => {
          const [mx, my] = d3.pointer(ev, el);
          const hh = H[d3.bisector((q) => q).center(H, x.invert(mx - 38))];
          t.show(`<b>${d.n}</b><br><span class="k">${hh} month${hh > 1 ? "s" : ""} ahead:</span> ${GC.race[d.k][target][hh].toFixed(2)}× AR`, mx, my);
        })
        .on("pointerleave", () => {
          focus(null);
          t.hide();
        });
      legend.querySelectorAll("[data-m]").forEach((s) => {
        s.onpointerenter = () => focus(s.dataset.m);
        s.onpointerleave = () => focus(null);
      });
      if (animate === "draw" && !reduce) all.select(".ln").each(function (d, i) { drawLine(d3.select(this), 800, i * 90); });
    }

    segTabs(root, "[data-race-tabs]", (b) => {
      target = b.dataset.target;
      update(true);
    });
    build("draw");
    return onResize(el, () => build(false));
  }

  /* ------------------------------------------------------------------ live view: price distribution ridgeline */
  function distView(root) {
    const GROUPS = [
      { k: "insulated", n: "Insulated", c: C.blueSoft },
      { k: "indirect", n: "Indirect energy", c: C.pink },
      { k: "tariff", n: "Counter-tariff", c: C.yellow },
      { k: "energy", n: "Direct energy", c: C.ink },
    ];
    const KIND = {
      cpi: { label: "Consumer prices (CPI)", dom: [-25, 35], bw: 1.4, unit: "of the basket", note: "49 CPI components weighted by what households spend on them." },
      ippi: { label: "Producer prices (IPPI)", dom: [-15, 75], bw: 2.6, unit: "of industrial output", note: "21 product groups weighted by their share of industrial output." },
    };
    root.innerHTML = `
      <div class="live">
        <div class="live-card live-card--main">
          <div class="panel__bar">
            <div>
              <p class="panel__label">Share at each inflation rate, by month · taller = more spending at that rate</p>
              <h4 class="live__title">Energy is the outlier. Most prices are easing.</h4>
            </div>
            <div class="seg" role="tablist" aria-label="Price index" data-dist-tabs>
              <button role="tab" aria-selected="true" data-kind="cpi">Consumer</button>
              <button role="tab" aria-selected="false" data-kind="ippi">Producer</button>
            </div>
          </div>
          <div class="ridge" data-ridge></div>
          <div class="panel__foot panel__foot--wrap">
            ${GROUPS.map((g) => `<span><i class="sw" style="--c:${g.c}"></i>${g.n}</span>`).join("")}
            <span><i class="sw" style="height:0;border-top:1.5px dashed ${C.ink};background:none"></i>Weighted median</span>
          </div>
          <p class="panel__note" data-dist-note></p>
        </div>
      </div>`;
    const el = root.querySelector("[data-ridge]");
    const note = root.querySelector("[data-dist-note]");
    const t = tip(el);
    let kind = "cpi";

    const wMedian = (items) => {
      const s = [...items].sort((a, b) => a[0] - b[0]);
      const tot = d3.sum(s, (d) => d[1]);
      let acc = 0;
      for (const d of s) {
        acc += d[1];
        if (acc >= tot / 2) return d[0];
      }
      return s[s.length - 1][0];
    };

    function render(animate) {
      const K = KIND[kind];
      note.textContent = `${K.note} The column on the right is the share of ${K.unit.replace("of ", "")} with prices rising faster than 3% a year.`;
      const months = Object.keys(GC.dist[kind]).sort();
      const narrow = el.clientWidth < 560;
      const m = { t: 40, r: narrow ? 46 : 64, b: 30, l: narrow ? 50 : 70 };
      const rowLabel = narrow ? d3.timeFormat("%b ’%y") : fmtMonth;
      const { g, w, h } = svgIn(el, m);
      const x = d3.scaleLinear().domain(K.dom).range([0, w]);
      const step = h / (months.length - 0.2);
      const xs = d3.range(K.dom[0], K.dom[1] + 0.001, (K.dom[1] - K.dom[0]) / 260);
      const kern = (u) => Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);

      const rowsData = months.map((mo, i) => {
        const items = GC.dist[kind][mo];
        const tot = d3.sum(items, (d) => d[1]);
        const layers = [];
        let base = xs.map(() => 0);
        GROUPS.forEach((gr) => {
          const its = items.filter((d) => d[2] === gr.k);
          const top = xs.map((xv, j) => base[j] + d3.sum(its, (d) => (d[1] / tot) * kern((xv - d[0]) / K.bw)) / K.bw);
          layers.push({ gr, lo: base, hi: top });
          base = top;
        });
        const above = (100 * d3.sum(items.filter((d) => d[0] > 3), (d) => d[1])) / tot;
        const hot = [...items].sort((a, b) => b[0] - a[0])[0];
        return { mo, i, items, layers, env: base, above, med: wMedian(items), hot };
      });
      const peak = d3.max(rowsData, (r) => d3.max(r.env));
      const yk = (step * 1.55) / peak;
      const base = (i) => m.t * 0 + (i + 1) * step - step * 0.2;

      // grid + axis
      g.append("g").attr("class", "grid").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(narrow ? 4 : 7).tickSize(-h - 30).tickFormat(""));
      g.append("g").attr("class", "axis").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(narrow ? 4 : 7).tickSize(0).tickPadding(10).tickFormat((d) => `${d}%`));
      g.append("text").attr("x", w + (narrow ? 40 : 58)).attr("y", -22).attr("text-anchor", "end").style("fill", C.ink).text("> 3%");

      const rowsG = g.append("g");
      const area = (lo, hi) =>
        d3
          .area()
          .x((d, j) => x(xs[j]))
          .y0((d, j) => -lo[j] * yk)
          .y1((d, j) => -hi[j] * yk)
          .curve(d3.curveBasis);
      const rowSel = rowsG
        .selectAll("g.row")
        .data(rowsData)
        .join("g")
        .attr("class", "row")
        .attr("transform", (r) => `translate(0,${base(r.i)})`);
      const inner = rowSel.append("g").attr("class", "row__inner");
      inner.each(function (r) {
        const gg = d3.select(this);
        r.layers.forEach((L) => gg.append("path").attr("d", area(L.lo, L.hi)(xs)).attr("fill", L.gr.c).attr("fill-opacity", L.gr.k === "insulated" ? 0.85 : 0.92));
        gg.append("path")
          .attr("d", d3.line().x((d, j) => x(xs[j])).y((d, j) => -r.env[j] * yk).curve(d3.curveBasis)(xs))
          .attr("fill", "none")
          .attr("stroke", C.ink)
          .attr("stroke-width", 1.2);
        const mi = d3.bisector((v) => v).center(xs, r.med);
        gg.append("line")
          .attr("x1", x(r.med))
          .attr("x2", x(r.med))
          .attr("y1", 0)
          .attr("y2", -r.env[mi] * yk)
          .attr("stroke", C.ink)
          .attr("stroke-width", 1.4)
          .attr("stroke-dasharray", "3 3");
      });
      rowSel
        .append("text")
        .attr("x", -10)
        .attr("y", 4)
        .attr("text-anchor", "end")
        .style("fill", C.ink2)
        .text((r) => rowLabel(parse(r.mo)));
      rowSel
        .append("text")
        .attr("x", w + (narrow ? 40 : 58))
        .attr("y", -4)
        .attr("text-anchor", "end")
        .style("font-family", "var(--serif)")
        .style("font-size", narrow ? "15px" : "18px")
        .style("fill", C.ink)
        .text((r) => `${Math.round(r.above)}%`);

      // hover a row
      rowSel
        .append("rect")
        .attr("x", -m.l)
        .attr("y", -step)
        .attr("width", w + m.l + m.r)
        .attr("height", step)
        .attr("fill", "transparent")
        .on("pointerenter", function (ev, r) {
          rowSel.attr("opacity", (q) => (q === r ? 1 : 0.35));
          const [mx, my] = d3.pointer(ev, el);
          t.show(
            `<b>${fmtMonth(parse(r.mo))}</b><br><span class="k">Above 3%:</span> ${Math.round(r.above)}% ${K.unit}<br><span class="k">Median item:</span> ${r.med.toFixed(1)}%<br><span class="k">Fastest:</span> ${r.hot[3]} ${r.hot[0] > 0 ? "+" : ""}${r.hot[0].toFixed(1)}%`,
            mx,
            my
          );
        })
        .on("pointerleave", () => {
          rowSel.attr("opacity", 1);
          t.hide();
        });

      if (animate && !reduce) {
        inner
          .attr("transform", "scale(1,0)")
          .transition()
          .delay((r) => 120 + r.i * 110)
          .duration(650)
          .ease(d3.easeCubicOut)
          .attr("transform", "scale(1,1)");
      }
    }

    segTabs(root, "[data-dist-tabs]", (b) => {
      kind = b.dataset.kind;
      render(true);
    });
    render(true);
    return onResize(el, () => render(false));
  }

  /* ------------------------------------------------------------------ 3D views (Plotly, loaded on demand) */
  let plotlyP = null;
  function loadPlotly() {
    if (window.Plotly) return Promise.resolve(window.Plotly);
    if (!plotlyP)
      plotlyP = new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/plotly.js-gl3d-dist-min@2.35.2/plotly-gl3d.min.js";
        s.onload = () => res(window.Plotly);
        s.onerror = rej;
        document.head.appendChild(s);
      });
    return plotlyP;
  }
  // the 3D engine is ~1.5 MB: fetch it once the page is idle so a folder flip is instant
  window.addEventListener("load", () => {
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 2000));
    idle(() => loadPlotly().catch(() => {}), { timeout: 5000 });
  });

  const font = { family: "Geist Mono, monospace", color: "#f3f0e8", size: 11 };
  const axis3 = (title, extra = {}) => ({
    title: { text: title, font: { ...font, size: 12 } },
    gridcolor: "rgba(243,240,232,0.14)",
    zerolinecolor: "rgba(243,240,232,0.3)",
    linecolor: "rgba(243,240,232,0.3)",
    tickfont: font,
    showbackground: false,
    ...extra,
  });
  const layout3 = (scene) => ({
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    margin: { l: 0, r: 0, t: 0, b: 0 },
    showlegend: false,
    font,
    hoverlabel: { bgcolor: "#f3f0e8", bordercolor: "#f3f0e8", font: { family: "Geist Mono, monospace", color: "#121212", size: 12 } },
    scene: { aspectmode: "manual", aspectratio: { x: 1.15, y: 1.15, z: 0.75 }, ...scene },
  });

  function threeD(root, copyHTML, legendHTML, figure) {
    root.innerHTML = `
      <div class="live-3d">
        <div class="live-3d__copy">${copyHTML}<ul class="lab__legend">${legendHTML}</ul></div>
        <div class="live-3d__stage"><div class="live-3d__plot" role="img" aria-label="Interactive 3D surface"></div><p class="lab__hint">Loading the 3D engine…</p></div>
      </div>`;
    const plot = root.querySelector(".live-3d__plot");
    const hint = root.querySelector(".lab__hint");
    let alive = true;
    let stopSweep = () => {};
    loadPlotly()
      .then((Plotly) => {
        if (!alive) return;
        const fig = figure();
        Plotly.react(plot, fig.data, fig.layout, { displayModeBar: false, responsive: true, scrollZoom: false });
        hint.textContent = "Drag to rotate · hover for values";
        if (!reduce) stopSweep = sweep(Plotly, plot, fig.layout.scene.camera);
      })
      .catch(() => (hint.textContent = "The 3D engine could not load. Check your connection and reload."));
    return () => {
      alive = false;
      stopSweep();
      if (window.Plotly) window.Plotly.purge(plot);
    };
  }

  // one-time camera sweep so the third dimension reads at first sight
  function sweep(Plotly, plot, cam) {
    const e0 = cam.eye;
    const r = Math.hypot(e0.x, e0.y);
    const a1 = Math.atan2(e0.y, e0.x);
    const a0 = a1 - 0.9;
    const t0 = performance.now();
    let stopped = false;
    const stop = () => (stopped = true);
    plot.addEventListener("pointerdown", stop, { once: true });
    const frame = (now) => {
      if (stopped) return;
      const k = Math.min(1, (now - t0) / 2600);
      const a = a0 + (a1 - a0) * d3.easeCubicInOut(k);
      Plotly.relayout(plot, { "scene.camera.eye": { x: r * Math.cos(a), y: r * Math.sin(a), z: e0.z } });
      if (k < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    return stop;
  }

  function priorView(root) {
    const M = GC.ml;
    let best = { a: 0, b: 0, z: -Infinity };
    M.z.forEach((row, j) => row.forEach((v, i) => v != null && v > best.z && (best = { a: M.lambda[i], b: M.lambda_x[j], z: v })));
    const copy = `
      <p class="panel__label">Prior tightness, chosen by marginal likelihood</p>
      <h4 class="live__title">How much should the data be trusted?</h4>
      <p>λ sets how tightly the Canadian coefficients shrink toward the Minnesota prior; λ<sub>x</sub> does the same for the outside variables. Every point on this surface is a full marginal likelihood, computed by hand in R.</p>
      <p>The ridge peaks at <b>λ = ${best.a}</b> and <b>λ<sub>x</sub> = ${best.b}</b>. Too tight and the model ignores the data; too loose and it overfits.</p>`;
    const legend = `<li><i style="--c:#f4de4b"></i>Chosen tightness</li><li><i style="--c:#e2352b"></i>Better fit</li><li><i style="--c:#555"></i>Prior too tight</li>`;
    return threeD(root, copy, legend, () => ({
      data: [
        {
          type: "surface",
          x: M.lambda,
          y: M.lambda_x,
          z: M.z,
          colorscale: [
            [0, "#1d1d1d"],
            [0.55, "#6a2a26"],
            [0.85, "#e2352b"],
            [1, "#f4de4b"],
          ],
          showscale: false,
          contours: { z: { show: true, usecolormap: true, highlightcolor: "#f3f0e8", project: { z: true } } },
          hovertemplate: "λ %{x}<br>λx %{y}<br>log ML <b>%{z:.1f}</b><extra></extra>",
          lighting: { ambient: 0.7, diffuse: 0.6, specular: 0.25, roughness: 0.6 },
        },
        {
          type: "scatter3d",
          mode: "markers+text",
          x: [best.a],
          y: [best.b],
          z: [best.z + 2],
          text: [`chosen: λ=${best.a}, λx=${best.b}`],
          textposition: "top center",
          textfont: { family: "Geist Mono, monospace", color: "#f4de4b", size: 12 },
          marker: { size: 6, color: "#f4de4b", line: { color: "#121212", width: 1 } },
          hovertemplate: `Highest marginal likelihood<br>λ ${best.a} · λx ${best.b}<br>log ML ${best.z.toFixed(1)}<extra></extra>`,
        },
      ],
      layout: layout3({
        xaxis: axis3("λ (Canadian block)", { type: "log" }),
        yaxis: axis3("λx (outside block)", { type: "log" }),
        zaxis: axis3("log marginal likelihood"),
        camera: { eye: { x: 1.45, y: -1.35, z: 0.8 } },
      }),
    }));
  }

  /* ------------------------------------------------------------------ live view: emissions bubbles */
  function wdiView(root) {
    if (!E494) return () => {};
    const REG = [
      ["East Asia & Pacific", C.red],
      ["Europe & Central Asia", C.blue],
      ["Latin America & Caribbean", C.green],
      ["Middle East, North Africa, Afghanistan & Pakistan", C.orange],
      ["North America", C.ink],
      ["South Asia", C.yellow],
      ["Sub-Saharan Africa", C.pink],
    ];
    const regColor = new Map(REG);
    const shortReg = (r) => r.replace(", Afghanistan & Pakistan", "").replace(" & Caribbean", "").replace("Middle East, North Africa", "Middle East & N. Africa");
    root.innerHTML = `
      <div class="live">
        <div class="live-card live-card--main">
          <div class="panel__bar">
            <div>
              <p class="panel__label">World Bank WDI · every country, 2000 onward</p>
              <h4 class="live__title">60 countries got richer while cutting emissions per person</h4>
            </div>
            <div class="player">
              <button class="icon-btn" type="button" data-play aria-label="Play years" aria-pressed="false">
                <svg viewBox="0 0 16 16" aria-hidden="true" class="i-play"><path d="M4 2.5v11l9-5.5z" /></svg>
                <svg viewBox="0 0 16 16" aria-hidden="true" class="i-pause"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" /></svg>
              </button>
              <input type="range" class="range" data-year aria-label="Year" />
            </div>
          </div>
          <div class="bubbles" data-bubbles></div>
          <div class="panel__foot panel__foot--wrap">${REG.map(([r, c]) => `<span><i class="sw" style="--c:${c};width:10px;height:10px;border-radius:50%"></i>${shortReg(r)}</span>`).join("")}</div>
        </div>
      </div>`;
    const el = root.querySelector("[data-bubbles]");
    const slider = root.querySelector("[data-year]");
    const btn = root.querySelector("[data-play]");
    const countries = E494.wdi.countries.map((c) => ({ ...c, byYear: new Map(c.series.map((s) => [s[0], { gdp: s[1], co2: s[2], pop: s[3] }])) }));
    const years = E494.wdi.years.filter((yy) => countries.filter((c) => c.byYear.has(yy)).length > 150);
    const y0 = years[0];
    const y1 = years[years.length - 1];
    Object.assign(slider, { min: y0, max: y1, step: 1, value: y0 });
    const LABELS = new Set(["CAN", "USA", "CHN", "IND", "QAT", "NOR"]);
    const t = tip(el);
    let year = y0;
    let timer = null;
    let ctx;
    const at = (c, yr) => {
      for (let k = yr; k >= y0; k--) if (c.byYear.has(k)) return c.byYear.get(k);
      return null;
    };

    function build() {
      const narrow = el.clientWidth < 520;
      const m = { t: 10, r: 12, b: 34, l: 40 };
      const { g, w, h } = svgIn(el, m);
      const x = d3.scaleLog().domain([600, 150000]).range([0, w]).clamp(true);
      const y = d3.scaleLog().domain([0.03, 120]).range([h, 0]).clamp(true);
      const r = d3.scaleSqrt().domain([0, 1.45e9]).range([0, narrow ? 26 : 38]);
      const ghost = g.append("text").attr("class", "year-ghost").attr("x", w - 4).attr("y", h - 14).attr("text-anchor", "end");
      g.append("g").attr("class", "grid").call(d3.axisLeft(y).tickValues([0.1, 1, 10, 100]).tickSize(-w).tickFormat(""));
      g.append("g").attr("class", "grid").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).tickValues([1000, 10000, 100000]).tickSize(-h).tickFormat(""));
      g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickValues([0.1, 1, 10, 100]).tickSize(0).tickPadding(6).tickFormat(d3.format("~g")));
      g.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${h})`)
        .call(d3.axisBottom(x).tickValues([1000, 3000, 10000, 30000, 100000]).tickSize(0).tickPadding(8).tickFormat((d) => `$${d3.format("~s")(d)}`));
      g.append("text").attr("x", w).attr("y", h + 30).attr("text-anchor", "end").text("GDP per person, PPP 2021 $ (log)");
      g.append("text").attr("x", 4).attr("y", 10).text("CO₂ per person, tonnes (log)");
      ctx = { x, y, r, ghost, dots: g.append("g"), tags: g.append("g"), narrow };
      draw(false);
    }

    function draw(animate) {
      const { x, y, r, ghost, dots, tags, narrow } = ctx;
      ghost.text(year);
      slider.value = year;
      const live = countries.map((c) => ({ c, v: at(c, year) })).filter((d) => d.v).sort((a, b) => b.v.pop - a.v.pop);
      const T = (s) => (animate && !reduce ? s.transition().duration(560).ease(d3.easeLinear) : s);
      const sel = dots.selectAll("circle").data(live, (d) => d.c.iso);
      sel.exit().remove();
      const ent = sel
        .enter()
        .append("circle")
        .attr("fill", (d) => regColor.get(d.c.region) || C.muted)
        .attr("fill-opacity", 0.8)
        .classed("is-canada", (d) => d.c.iso === "CAN")
        .attr("cx", (d) => x(d.v.gdp))
        .attr("cy", (d) => y(d.v.co2))
        .attr("r", (d) => r(d.v.pop))
        .on("pointerenter", (ev, d) => {
          const v = at(d.c, year);
          const [mx, my] = d3.pointer(ev, el);
          t.show(
            `<b>${d.c.country}</b> · ${year}<br><span class="k">GDP/person</span> $${d3.format(",")(v.gdp)}<br><span class="k">CO₂/person</span> ${v.co2} t<br><span class="k">Population</span> ${d3.format(".3~s")(v.pop).replace("G", "B")}`,
            mx,
            my
          );
          d3.select(ev.currentTarget).attr("stroke", C.ink).attr("stroke-width", 2);
        })
        .on("pointerleave", (ev) => {
          t.hide();
          d3.select(ev.currentTarget).attr("stroke", null).attr("stroke-width", null);
        });
      T(ent.merge(sel).order())
        .attr("cx", (d) => x(d.v.gdp))
        .attr("cy", (d) => y(d.v.co2))
        .attr("r", (d) => r(d.v.pop));
      const lab = live.filter((d) => LABELS.has(d.c.iso) && (!narrow || ["CAN", "CHN", "USA", "IND"].includes(d.c.iso)));
      const ts = tags.selectAll("text").data(lab, (d) => d.c.iso);
      ts.exit().remove();
      const left = (d) => d.c.iso === "CAN" || d.c.iso === "QAT";
      T(ts.enter().append("text").attr("class", "tag").text((d) => (d.c.iso === "USA" ? "US" : d.c.country)).merge(ts))
        .attr("text-anchor", (d) => (left(d) ? "end" : "start"))
        .attr("x", (d) => x(d.v.gdp) + (left(d) ? -1 : 1) * (r(d.v.pop) * 0.7 + 4))
        .attr("y", (d) => y(d.v.co2) + (d.c.iso === "CAN" ? r(d.v.pop) + 12 : -r(d.v.pop) * 0.7));
    }

    const setYear = (yr, animate) => {
      year = Math.max(y0, Math.min(y1, yr));
      draw(animate);
    };
    const stop = () => {
      clearInterval(timer);
      timer = null;
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-label", "Play years");
    };
    const play = () => {
      if (year >= y1) setYear(y0, false);
      btn.setAttribute("aria-pressed", "true");
      btn.setAttribute("aria-label", "Pause");
      timer = setInterval(() => (year >= y1 ? stop() : setYear(year + 1, true)), 600);
    };
    btn.addEventListener("click", () => (timer ? stop() : play()));
    slider.addEventListener("input", () => {
      stop();
      setYear(+slider.value, true);
    });
    build();
    reduce ? setYear(y1, false) : setTimeout(play, 500);
    const off = onResize(el, build);
    return () => {
      stop();
      off();
    };
  }

  /* ------------------------------------------------------------------ live view: 7,770 regressions */
  function regView(root) {
    if (!E494) return () => {};
    root.innerHTML = `
      <div class="live">
        <div class="live-card live-card--main">
          <div class="panel__bar">
            <div>
              <p class="panel__label">Sala-i-Martin robustness test · 72 countries, growth 1960–92</p>
              <h4 class="live__title">Rule of law survives every control</h4>
            </div>
            <button class="btn btn--ghost btn--sm" type="button" data-run>Run again</button>
          </div>
          <div class="reg__count"><span class="reg__n" data-n>0</span><span class="reg__of">of 7,770 regressions run</span></div>
          <div class="hist" data-hist></div>
          <dl class="reg__stats">
            <div><dt>Positive sign</dt><dd data-pos>–</dd></div>
            <div><dt>|t| above 1.96</dt><dd data-sig>–</dd></div>
            <div><dt>Smallest t</dt><dd data-min>–</dd></div>
          </dl>
          <p class="panel__note">Every regression holds initial income, life expectancy and school enrolment fixed, adds rule of law, and tries one of the 7,770 possible trios of the other 37 variables.</p>
        </div>
      </div>`;
    const el = root.querySelector("[data-hist]");
    const T = E494.q2.t;
    const E = E494.q2.est;
    const N = T.length;
    const q = (s) => root.querySelector(s);
    const fmtN = d3.format(",");
    const bins = d3.bin().domain([0, 6.5]).thresholds(d3.range(0, 6.5, 0.25))(T);
    let raf;

    function render() {
      const m = { t: 12, r: 10, b: 40, l: 38 };
      const { g, w, h } = svgIn(el, m);
      const x = d3.scaleLinear().domain([0, 6.5]).range([0, w]);
      const y = d3.scaleLinear().domain([0, d3.max(bins, (b) => b.length)]).nice().range([h, 0]);
      g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(4).tickSize(-w).tickFormat(""));
      g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(4).tickSize(0).tickPadding(6).tickFormat(d3.format("~s")));
      g.append("g").attr("class", "axis").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(6).tickSize(0).tickPadding(8));
      g.append("text").attr("x", w).attr("y", h + 36).attr("text-anchor", "end").text("t statistic on rule of law");
      const bars = g
        .append("g")
        .selectAll("rect")
        .data(bins)
        .join("rect")
        .attr("x", (b) => x(b.x0) + 1)
        .attr("width", (b) => Math.max(0, x(b.x1) - x(b.x0) - 2))
        .attr("fill", (b) => (b.x0 >= 1.96 ? C.red : C.ink))
        .attr("fill-opacity", (b) => (b.x0 >= 1.96 ? 0.9 : 0.55))
        .attr("y", h)
        .attr("height", 0);
      g.append("line").attr("class", "target").attr("x1", x(1.96)).attr("x2", x(1.96)).attr("y1", 0).attr("y2", h);
      g.append("text").attr("x", x(1.96) + 6).attr("y", 12).style("fill", C.ink).text("t = 1.96");
      return { bars, y, h };
    }

    function run() {
      cancelAnimationFrame(raf);
      const { bars, y, h } = render();
      const order = d3.shuffle(d3.range(N));
      const counts = bins.map(() => 0);
      const binOf = (v) => Math.min(bins.length - 1, Math.max(0, Math.floor(v / 0.25)));
      let done = 0;
      let pos = 0;
      let sig = 0;
      let mn = Infinity;
      const dur = reduce ? 0 : 2400;
      const t0 = performance.now();
      const frame = (now) => {
        const k = dur ? Math.min(1, (now - t0) / dur) : 1;
        const target = Math.round(d3.easeCubicOut(k) * N);
        while (done < target) {
          const i = order[done++];
          counts[binOf(T[i])]++;
          if (E[i] > 0) pos++;
          if (Math.abs(T[i]) > 1.96) sig++;
          mn = Math.min(mn, T[i]);
        }
        bars.attr("y", (b, i) => y(counts[i])).attr("height", (b, i) => h - y(counts[i]));
        q("[data-n]").textContent = fmtN(done);
        q("[data-pos]").textContent = `${((100 * pos) / Math.max(1, done)).toFixed(1)}%`;
        q("[data-sig]").textContent = `${((100 * sig) / Math.max(1, done)).toFixed(1)}%`;
        q("[data-min]").textContent = Number.isFinite(mn) ? mn.toFixed(2) : "–";
        if (k < 1) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }

    q("[data-run]").addEventListener("click", run);
    run();
    const off = onResize(el, () => {
      cancelAnimationFrame(raf);
      const { bars, y, h } = render();
      bars.attr("y", (b) => y(b.length)).attr("height", (b) => h - y(b.length));
    });
    return () => {
      cancelAnimationFrame(raf);
      off();
    };
  }

  /* ------------------------------------------------------------------ live views: housing market */
  const HS = GC.housing;
  const parseQ = (q) => {
    const [y, qq] = q.split(" Q");
    return new Date(+y, (+qq - 1) * 3 + 1, 15);
  };

  function housingCard(root, label, title, legend, note) {
    root.innerHTML = `
      <div class="live">
        <div class="live-card live-card--main">
          <div class="panel__bar"><div><p class="panel__label">${label}</p><h4 class="live__title">${title}</h4></div></div>
          <div class="hchart" data-h></div>
          <div class="panel__foot panel__foot--wrap">${legend}</div>
          ${note ? `<p class="panel__note">${note}</p>` : ""}
        </div>
      </div>`;
    return root.querySelector("[data-h]");
  }
  const sw = (c, kind = "box") =>
    kind === "line"
      ? `<i class="sw" style="height:3px;background:${c}"></i>`
      : kind === "dash"
        ? `<i class="sw" style="height:0;border-top:2px dashed ${c};background:none"></i>`
        : `<i class="sw" style="--c:${c}"></i>`;

  function hoverMonths(g, el, x, h, data, html, w) {
    const t = tip(el);
    const cross = g.append("line").attr("class", "crosshair").attr("y1", 0).attr("y2", h).attr("opacity", 0);
    const bis = d3.bisector((d) => d.date).center;
    g.append("rect")
      .attr("width", w)
      .attr("height", h)
      .attr("fill", "transparent")
      .on("pointermove", (ev) => {
        const [mx, my] = d3.pointer(ev);
        const d = data[bis(data, x.invert(mx))];
        cross.attr("x1", x(d.date)).attr("x2", x(d.date)).attr("opacity", 1);
        t.show(html(d), x(d.date) + 40, Math.min(my, h - 60));
      })
      .on("pointerleave", () => {
        cross.attr("opacity", 0);
        t.hide();
      });
  }

  function hBalanceView(root) {
    const el = housingCard(
      root,
      "CREA · seasonally adjusted, monthly",
      "From a sellers' market to a pile of listings",
      `<span>${sw(C.blueSoft)}Months of inventory (left)</span><span>${sw(C.ink, "line")}Sales-to-new-listings ratio (right)</span>`,
      "Months of inventory went from 1.6 in January 2022 to 4.9 by September 2026, while the sales-to-new-listings ratio fell from 87% to 49%."
    );
    const data = HS.balance.map((r) => ({ date: parse(r[0]), inv: r[1], ratio: r[2] }));
    const render = (animate) => {
      const narrow = el.clientWidth < 520;
      const m = { t: 14, r: 40, b: 28, l: 34 };
      const { g, w, h } = svgIn(el, m);
      const x = d3.scaleBand().domain(data.map((d) => +d.date)).range([0, w]).padding(0.18);
      const xt = d3.scaleTime().domain(d3.extent(data, (d) => d.date)).range([x.bandwidth() / 2, w - x.bandwidth() / 2]);
      const yl = d3.scaleLinear().domain([1, 6]).range([h, 0]);
      const yr = d3.scaleLinear().domain([40, 90]).range([h, 0]);
      g.append("g").attr("class", "grid").call(d3.axisLeft(yl).ticks(5).tickSize(-w).tickFormat(""));
      g.append("g").attr("class", "axis").call(d3.axisLeft(yl).ticks(5).tickSize(0).tickPadding(6));
      g.append("g").attr("class", "axis").attr("transform", `translate(${w},0)`).call(d3.axisRight(yr).ticks(5).tickSize(0).tickPadding(6).tickFormat((d) => `${d}%`));
      g.append("g").attr("class", "axis").attr("transform", `translate(0,${h})`).call(d3.axisBottom(xt).ticks(d3.timeYear.every(1)).tickSize(0).tickPadding(8));
      const bars = g
        .append("g")
        .selectAll("rect")
        .data(data)
        .join("rect")
        .attr("x", (d) => x(+d.date))
        .attr("width", x.bandwidth())
        .attr("fill", C.blueSoft)
        .attr("y", (d) => yl(d.inv))
        .attr("height", (d) => h - yl(d.inv));
      const line = g
        .append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", C.ink)
        .attr("stroke-width", 2.4)
        .attr("d", d3.line().x((d) => xt(d.date)).y((d) => yr(d.ratio)).curve(d3.curveMonotoneX));
      if (!narrow) {
        const lo = data.reduce((a, b) => (b.inv < a.inv ? b : a));
        g.append("circle").attr("class", "ring").attr("cx", x(+lo.date) + x.bandwidth() / 2).attr("cy", yl(lo.inv)).attr("r", 9);
        g.append("text").attr("class", "anno").attr("x", x(+lo.date) + 14).attr("y", yl(lo.inv) + 26).text(`${lo.inv.toFixed(1)} months`);
      }
      if (animate && !reduce) {
        bars.attr("y", h).attr("height", 0).transition().delay((d, i) => i * 14).duration(400).ease(ease).attr("y", (d) => yl(d.inv)).attr("height", (d) => h - yl(d.inv));
        drawLine(line, 1300, 300);
      }
      hoverMonths(g, el, xt, h, data, (d) => `<span class="k">${fmtMonth(d.date)}</span><br><b>${d.inv.toFixed(1)}</b> months of inventory<br><b>${d.ratio.toFixed(0)}%</b> sales to new listings`, w);
    };
    render(true);
    return onResize(el, () => render(false));
  }

  function hRatesView(root) {
    const el = housingCard(
      root,
      "Chartered banks, uninsured residential mortgages, monthly",
      "New mortgages are back down to what borrowers already pay",
      `<span>${sw(C.blue, "line")}New mortgages</span><span>${sw("#6a2a26", "line")}All outstanding</span><span>${sw("#a07b84", "dash")}of which fixed</span><span>${sw("#c9aab1", "dash")}of which variable</span>`,
      "New-mortgage rates peaked at 6.43% in December 2023 and are back to 4.29%, almost level with the 4.21% average on outstanding loans. Borrowers renewing a pre-2022 loan still reset higher."
    );
    const data = HS.rates.map((r) => ({ date: parse(r[0]), nw: r[1], out: r[2], fix: r[3], vr: r[4] }));
    const S = [
      { k: "vr", c: "#c9aab1", w: 1.6, dash: "2 4" },
      { k: "fix", c: "#a07b84", w: 1.6, dash: "6 4" },
      { k: "out", c: "#6a2a26", w: 2.8 },
      { k: "nw", c: C.blue, w: 2.8 },
    ];
    const render = (animate) => {
      const m = { t: 14, r: 14, b: 28, l: 32 };
      const { g, w, h } = svgIn(el, m);
      const x = d3.scaleTime().domain(d3.extent(data, (d) => d.date)).range([0, w]);
      const y = d3.scaleLinear().domain([0, 7]).range([h, 0]);
      g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(4).tickSize(-w).tickFormat(""));
      g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(4).tickSize(0).tickPadding(6).tickFormat((d) => `${d}%`));
      g.append("g").attr("class", "axis").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(d3.timeYear.every(1)).tickSize(0).tickPadding(8));
      S.forEach((s, i) => {
        const p = g
          .append("path")
          .datum(data.filter((d) => d[s.k] != null))
          .attr("fill", "none")
          .attr("stroke", s.c)
          .attr("stroke-width", s.w)
          .attr("d", d3.line().x((d) => x(d.date)).y((d) => y(d[s.k])).curve(d3.curveMonotoneX));
        if (animate && !reduce && !s.dash) drawLine(p, 1400, 150 * i);
        if (s.dash) p.attr("stroke-dasharray", s.dash);
      });
      const pk = data.reduce((a, b) => (b.nw > a.nw ? b : a));
      g.append("circle").attr("class", "ring").attr("cx", x(pk.date)).attr("cy", y(pk.nw)).attr("r", 9);
      g.append("text").attr("class", "anno").attr("x", x(pk.date) + 14).attr("y", y(pk.nw) - 6).text(`${pk.nw.toFixed(2)}%`);
      hoverMonths(
        g,
        el,
        x,
        h,
        data,
        (d) => `<span class="k">${fmtMonth(d.date)}</span><br>New <b>${d.nw.toFixed(2)}%</b> · outstanding <b>${d.out.toFixed(2)}%</b>${d.fix != null ? `<br><span class="k">fixed ${d.fix.toFixed(2)}% · variable ${d.vr.toFixed(2)}%</span>` : ""}`,
        w
      );
    };
    render(true);
    return onResize(el, () => render(false));
  }

  function hShelterView(root) {
    const K = [
      { k: "water", i: 5, n: "Water, fuel and electricity", c: C.green },
      { k: "other", i: 4, n: "Other owned accommodation", c: C.blueSoft },
      { k: "rent", i: 3, n: "Rented accommodation", c: C.yellow },
      { k: "mic", i: 2, n: "Mortgage interest cost", c: C.blue },
    ];
    const el = housingCard(
      root,
      "Contributions to CPI inflation, year over year, percentage points",
      "Mortgage interest stopped driving shelter inflation",
      [...K].reverse().map((k) => `<span>${sw(k.c)}${k.n}</span>`).join("") + `<span>${sw(C.ink, "line")}All of shelter</span>`,
      "Shelter added 1.87 points to CPI inflation in February 2024, half of it from mortgage interest. By September 2026 it added 0.50, and mortgage interest had fallen to zero."
    );
    const data = HS.shelter.map((r) => ({ date: parse(r[0]), total: r[1], mic: r[2], rent: r[3], other: r[4], water: r[5] }));
    const render = (animate) => {
      const m = { t: 14, r: 12, b: 28, l: 34 };
      const { g, w, h } = svgIn(el, m);
      const x = d3.scaleBand().domain(data.map((d) => +d.date)).range([0, w]).padding(0.16);
      const xt = d3.scaleTime().domain(d3.extent(data, (d) => d.date)).range([x.bandwidth() / 2, w - x.bandwidth() / 2]);
      const stack = d3.stack().keys(K.map((k) => k.k)).offset(d3.stackOffsetDiverging)(data);
      const y = d3.scaleLinear().domain([Math.min(-0.1, d3.min(stack, (s) => d3.min(s, (d) => d[0]))), 2]).nice().range([h, 0]);
      g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(5).tickSize(-w).tickFormat(""));
      g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(6));
      g.append("g").attr("class", "axis").attr("transform", `translate(0,${h})`).call(d3.axisBottom(xt).ticks(d3.timeMonth.every(6)).tickSize(0).tickPadding(8).tickFormat(d3.timeFormat("%b %Y")));
      const bars = g
        .append("g")
        .selectAll("g")
        .data(stack)
        .join("g")
        .attr("fill", (s) => K.find((k) => k.k === s.key).c)
        .selectAll("rect")
        .data((s) => s)
        .join("rect")
        .attr("x", (d) => x(+d.data.date))
        .attr("width", x.bandwidth())
        .attr("y", (d) => y(Math.max(d[0], d[1])))
        .attr("height", (d) => Math.abs(y(d[0]) - y(d[1])));
      g.append("line").attr("class", "zero").attr("x1", 0).attr("x2", w).attr("y1", y(0)).attr("y2", y(0));
      const line = g.append("path").datum(data).attr("fill", "none").attr("stroke", C.ink).attr("stroke-width", 1.8).attr("d", d3.line().x((d) => xt(d.date)).y((d) => y(d.total)));
      const dots = g.append("g").selectAll("circle").data(data).join("circle").attr("cx", (d) => xt(d.date)).attr("cy", (d) => y(d.total)).attr("r", 2.6).attr("fill", C.ink);
      if (animate && !reduce) {
        bars.attr("y", y(0)).attr("height", 0).transition().delay((d) => data.indexOf(d.data) * 35).duration(420).ease(ease).attr("y", (d) => y(Math.max(d[0], d[1]))).attr("height", (d) => Math.abs(y(d[0]) - y(d[1])));
        drawLine(line, 1300, 300);
        dots.attr("opacity", 0).transition().delay((d, i) => 300 + i * 35).attr("opacity", 1);
      }
      hoverMonths(
        g,
        el,
        xt,
        h,
        data,
        (d) => `<span class="k">${fmtMonth(d.date)}</span> · shelter <b>${d.total.toFixed(2)} pt</b><br>` + [...K].reverse().map((k) => `<span class="k">${k.n}</span> ${d[k.k] >= 0 ? "+" : ""}${d[k.k].toFixed(2)}`).join("<br>"),
        w
      );
    };
    render(true);
    return onResize(el, () => render(false));
  }

  function hStartsView(root) {
    const el = housingCard(
      root,
      "Housing starts (2021 = 100) and borrowing costs, quarterly",
      "Builders switched to multiples as single-detached starts fell 40%",
      `<span>${sw(C.blue, "line")}Multiples starts</span><span>${sw(C.orange, "line")}Single-detached starts</span><span>${sw(C.ink, "line")}New 5-year fixed</span><span>${sw(C.blueSoft, "line")}Prime rate</span>`,
      "Single-detached starts are 40% below their 2021 level while multiples sit above it. The prime rate has come down to 4.45%, next to 4.27% on a new five-year fixed mortgage."
    );
    el.classList.add("hchart--tall");
    const data = HS.starts.map((r) => ({ date: parseQ(r[0]), q: r[0], mul: r[1], sgl: r[2], fix: r[3], prime: r[4] }));
    const render = (animate) => {
      const m = { t: 14, r: 14, b: 28, l: 34 };
      const { g, w, h } = svgIn(el, m);
      const gap = 30;
      const h1 = (h - gap) * 0.55;
      const h2 = h - gap - h1;
      const x = d3.scaleTime().domain(d3.extent(data, (d) => d.date)).range([0, w]);
      const y1 = d3.scaleLinear().domain([50, 125]).range([h1, 0]);
      const y2 = d3.scaleLinear().domain([0, 8]).range([h1 + gap + h2, h1 + gap]);
      g.append("g").attr("class", "grid").call(d3.axisLeft(y1).ticks(4).tickSize(-w).tickFormat(""));
      g.append("g").attr("class", "axis").call(d3.axisLeft(y1).ticks(4).tickSize(0).tickPadding(6));
      g.append("line").attr("class", "zero").attr("x1", 0).attr("x2", w).attr("y1", y1(100)).attr("y2", y1(100)).attr("stroke-opacity", 0.5);
      g.append("g").attr("class", "grid").call(d3.axisLeft(y2).ticks(4).tickSize(-w).tickFormat(""));
      g.append("g").attr("class", "axis").call(d3.axisLeft(y2).ticks(4).tickSize(0).tickPadding(6).tickFormat((d) => `${d}%`));
      g.append("g").attr("class", "axis").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(d3.timeYear.every(1)).tickSize(0).tickPadding(8));
      g.append("text").attr("x", 4).attr("y", -2).text("Starts, index");
      g.append("text").attr("x", 4).attr("y", h1 + gap - 4).text("Rates, %");
      const paths = [
        g.append("path").datum(data).attr("d", d3.line().x((d) => x(d.date)).y((d) => y1(d.mul)).curve(d3.curveMonotoneX)).attr("stroke", C.blue),
        g.append("path").datum(data).attr("d", d3.line().x((d) => x(d.date)).y((d) => y1(d.sgl)).curve(d3.curveMonotoneX)).attr("stroke", C.orange),
        g.append("path").datum(data).attr("d", d3.line().x((d) => x(d.date)).y((d) => y2(d.fix)).curve(d3.curveMonotoneX)).attr("stroke", C.ink),
        g.append("path").datum(data).attr("d", d3.line().x((d) => x(d.date)).y((d) => y2(d.prime)).curve(d3.curveStepAfter)).attr("stroke", C.blueSoft),
      ];
      paths.forEach((p, i) => {
        p.attr("fill", "none").attr("stroke-width", 2.6);
        if (animate && !reduce) drawLine(p, 1300, i * 140);
      });
      hoverMonths(
        g,
        el,
        x,
        h,
        data,
        (d) => `<span class="k">${d.q}</span><br>Multiples <b>${d.mul.toFixed(0)}</b> · single <b>${d.sgl.toFixed(0)}</b><br>5-yr fixed <b>${d.fix.toFixed(2)}%</b> · prime <b>${d.prime.toFixed(2)}%</b>`,
        w
      );
    };
    render(true);
    return onResize(el, () => render(false));
  }

  /* ------------------------------------------------------------------ public API + boot */
  const VIEWS = {
    forecast: forecastView,
    prior: priorView,
    race: raceView,
    dist: distView,
    wdi: wdiView,
    reg: regView,
    hbalance: hBalanceView,
    hrates: hRatesView,
    hshelter: hShelterView,
    hstarts: hStartsView,
  };
  window.Charts = {
    mount(name, root) {
      const v = VIEWS[name];
      return v ? v(root) || (() => {}) : () => {};
    },
  };

  function boot() {
    heroChart();
    ticker();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
