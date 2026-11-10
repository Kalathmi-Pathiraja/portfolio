/* Page behaviour: nav, hero entrance, links, work ledger, and the project cabinet, whose folders
   open onto a desk and flip over to a live, interactive version of the project (charts.js). */
(() => {
  "use strict";

  const LINKS = {
    email: "kalathmi.pathiraja@gmail.com",
    linkedin: "https://www.linkedin.com/in/kalathmi-pathiraja-30597b271/",
    spotifyEmbedUrl: "https://open.spotify.com/embed/playlist/7k8NJ5KavWTHrjsKatm651",
  };

  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------- links, year, spotify */
  $$("[data-email-link]").forEach((a) => (a.href = `mailto:${LINKS.email}`));
  $$("[data-linkedin-link]").forEach((a) => (a.href = LINKS.linkedin));
  $$("[data-year]").forEach((e) => (e.textContent = new Date().getFullYear()));

  const spot = $("[data-spotify-embed]");
  if (spot && LINKS.spotifyEmbedUrl) {
    const load = () => {
      spot.innerHTML = `<iframe title="Kalathmi's Spotify playlist" src="${LINKS.spotifyEmbedUrl}?utm_source=generator&theme=0" height="152" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>`;
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (e) => {
          if (e[0].isIntersecting) {
            io.disconnect();
            load();
          }
        },
        { rootMargin: "300px" }
      );
      io.observe(spot);
    } else load();
  }

  /* ---------------------------------------------------------------- hero entrance (once) */
  const hero = $("[data-enter]");
  if (hero) requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add("is-in")));

  /* ---------------------------------------------------------------- topbar + active nav */
  const topbar = $("[data-topbar]");
  const onScroll = () => topbar.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const navLinks = $$(".nav a");
  const sections = navLinks.map((a) => $(a.getAttribute("href"))).filter(Boolean);
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${e.target.id}`));
        }),
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((s) => io.observe(s));
  }

  /* ---------------------------------------------------------------- work ledger */
  $$("[data-ledger] .ledger__head").forEach((btn) =>
    btn.addEventListener("click", () => {
      const row = btn.closest(".ledger__row");
      const open = !row.classList.contains("is-open");
      row.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
    })
  );
  const firstRow = $("[data-ledger] .ledger__row");
  if (firstRow) {
    firstRow.classList.add("is-open");
    $(".ledger__head", firstRow).setAttribute("aria-expanded", "true");
  }

  /* ---------------------------------------------------------------- lightbox */
  const lb = $("[data-lightbox]");
  const lbImg = lb && $(".lightbox__img", lb);
  let lastFocus = null;
  function openLightbox(src, alt) {
    if (!lb) return;
    lastFocus = document.activeElement;
    lbImg.src = src;
    lbImg.alt = alt || "";
    lb.hidden = false;
    requestAnimationFrame(() => lb.classList.add("is-open"));
    $("[data-lightbox-close]", lb).focus();
  }
  function closeLightbox() {
    lb.classList.remove("is-open");
    setTimeout(() => (lb.hidden = true), reduce ? 0 : 200);
    lastFocus?.focus();
  }
  lb?.addEventListener("click", (e) => {
    if (e.target === lb || e.target.closest("[data-lightbox-close]")) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lb && !lb.hidden) closeLightbox();
  });

  /* ---------------------------------------------------------------- the files */
  const IMG = (n) => `./assets/work/${n}.jpg`;
  const FILES = [
    {
      id: "gc",
      tab: "Governors' Challenge",
      when: "Oct – Nov 2026",
      color: "var(--red)",
      title: "Forecasting Canada for the Bank of Canada Governors' Challenge",
      meta: ["Solo build", "R · Bayesian VAR", "Monthly, 1998–2026"],
      body: [
        "I built this forecast end to end for the Bank of Canada's Governors' Challenge: the data pipeline, the model, the scenarios and the policy recommendation. The model is a restricted Bayesian VAR on monthly data from 1998 to 2026, with four Canadian variables (real GDP, CPI, unemployment and composite inflation expectations) and eight outside drivers, from WTI and the New York Fed's supply chain index to US financial conditions and Canada's policy uncertainty.",
        "Every forecast is conditional on a path for the outside variables, so each scenario is a story told in numbers: an escalating energy shock, an AI bust calibrated on 2001, tariffs scaled back after the midterms.",
        "To be able to defend every number I also wrote the BVAR out by hand: the Minnesota prior, an inverse-Wishart prior on the shocks, prior tightness chosen by the marginal likelihood, 2,000 posterior draws and the ragged edge. It matches the package's forecast to fifteen decimal places. Then I raced the model against lasso, random forests, a neural network and a combination forecast over 133 out-of-sample months. It ranked first on GDP.",
      ],
      tags: ["Bayesian VAR", "Minnesota prior", "Marginal likelihood", "Conditional forecasting", "Diebold-Mariano"],
      flip: "Play with the live forecast",
      views: [
        { id: "forecast", label: "Live forecast" },
        { id: "prior", label: "Prior selection" },
        { id: "race", label: "Model horse race" },
      ],
      pieces: [
        { type: "excerpt", label: "Excerpt A", img: "gc-base-case", alt: "Fan charts for GDP growth and CPI inflation, base case" },
        { type: "excerpt", label: "Excerpt B", img: "bvar-ml-heatmap", alt: "Heat map of log marginal likelihood over prior tightness values" },
        { type: "note", kicker: "My recommendation", text: "Hold at 2.5%. Look through the oil spike while tariffs build slack." },
        { type: "stamp", top: "Rank", big: "#1", bottom: "on GDP" },
      ],
    },
    {
      id: "housing",
      tab: "Housing market",
      when: "Oct 2026",
      color: "var(--blue)",
      title: "Canada's housing market after the rate cycle",
      meta: ["CREA · CMHC · Bank of Canada · StatCan", "R · ggplot2"],
      body: [
        "Housing was where the rate cycle hit hardest, so I tracked it from four angles. Listings piled up: months of inventory went from 1.6 in January 2022 to 4.9 by September 2026, and the sales-to-new-listings ratio fell from 87% to 49%.",
        "Borrowing costs came off their peak. New uninsured mortgages fell from 6.43% in December 2023 to 4.29%, almost level with the 4.21% borrowers pay on average, and mortgage interest stopped adding to CPI. Shelter's contribution to inflation fell from 1.87 points to 0.50. Builders moved to multiples while single-detached starts sank 40% below their 2021 level.",
      ],
      tags: ["Housing", "Mortgage renewals", "Shelter CPI", "Market balance"],
      flip: "Explore the housing charts",
      views: [
        { id: "hbalance", label: "Market balance" },
        { id: "hrates", label: "Mortgage rates" },
        { id: "hshelter", label: "Shelter inflation" },
        { id: "hstarts", label: "Starts & rates" },
      ],
      pieces: [
        { type: "excerpt", label: "Excerpt A", img: "housing-balance", alt: "Months of inventory and the sales-to-new-listings ratio, 2021 to 2026" },
        { type: "excerpt", label: "Excerpt B", img: "housing-shelter", alt: "Contributions of shelter components to CPI inflation" },
        { type: "note", kicker: "Finding", text: "Renewals still reset payments about 18% higher, and starts are down." },
      ],
    },
    {
      id: "oil",
      tab: "The 2026 oil shock",
      when: "Oct 2026",
      color: "var(--ink)",
      title: "Did oil make everything pricier, or just gas?",
      meta: ["StatCan CPI and IPPI", "49 components", "R"],
      body: [
        "Brent jumped in March 2026. I split the CPI basket into 49 non-overlapping pieces, sorted them into direct energy, indirect energy, counter-tariff and insulated, and rebuilt each group's contribution to headline inflation with StatCan's own link-month method. My total reproduces official CPI to within 0.04 percentage points every month.",
        "Then I looked at the whole distribution, item by item. Energy flipped from subtracting 0.9 points to adding 1.3, but the share of the basket rising faster than 3% fell from 54% to 30% over the year. Oil drove the spike; it had not spread. Producer prices tell the opposite story, with pressure broadening across industrial output.",
      ],
      tags: ["Price distributions", "CPI decomposition", "Basket weights", "Sensitivity checks"],
      flip: "Explore the price distribution",
      views: [{ id: "dist", label: "Price distribution" }],
      pieces: [
        { type: "excerpt", label: "Excerpt A", img: "dist-cpi", alt: "Ridgeline chart of CPI component inflation by month" },
        { type: "excerpt", label: "Excerpt B", img: "dist-ippi", alt: "Ridgeline chart of producer price growth by month" },
        { type: "note", kicker: "Finding", text: "Basket rising above 3%: 54% a year ago, 30% now. Energy is the outlier." },
      ],
    },
    {
      id: "regs",
      tab: "7,770 regressions",
      when: "Sep 2026",
      color: "var(--green)",
      title: "I just ran 7,770 regressions",
      meta: ["R · foreach · glmnet", "72 countries"],
      body: [
        "A robustness test in the spirit of Sala-i-Martin (1997). Growth from 1960 to 1992 for 72 countries, three variables in every regression, and rule of law tested against every possible trio of the 37 remaining controls: 7,770 regressions, run in parallel across cores and then serially to measure the speed-up.",
        "Rule of law kept its positive sign in all 7,770 and cleared |t| > 1.96 in 97.4% of them. A cross-validated lasso then picked its own model from all 41 variables for comparison with OLS.",
      ],
      tags: ["Model uncertainty", "Parallel computing", "Lasso", "tidyverse"],
      flip: "Watch the regressions run",
      views: [{ id: "reg", label: "7,770 regressions" }],
      pieces: [
        { type: "stamp", top: "Positive", big: "100%", bottom: "of runs" },
        { type: "note", kicker: "Result", text: "Significant at 5% in 97.4% of 7,770 specifications. Smallest t: 0.94." },
        { type: "receipt", title: "Setup", rows: [["Countries", "72"], ["Candidates", "41"], ["Fixed", "GDP60, LifeExp, PrScEnroll"], ["Trios", "C(37,3) = 7,770"]] },
      ],
    },
    {
      id: "emis",
      tab: "Recessions & emissions",
      when: "Sep 2026",
      color: "var(--yellow)",
      fg: "var(--ink)",
      title: "Recessions, core inflation and emissions",
      meta: ["Base R graphics · ggplot2", "World Bank · StatCan"],
      body: [
        "Part one shades Canadian recessions on the unemployment rate and the Bank of Canada's CPIW core inflation measure, in base R only, with peaks and troughs pulled programmatically from each series.",
        "Part two takes CO₂ per person against GDP per person for every country in the World Bank's data, cleans out aggregates and implausible zeros, fits a log-log regression and counts the decouplers: 60 of 183 countries got richer between 2000 and 2023 while cutting emissions per person. Canada went from 17.7 to 14.0 tonnes.",
      ],
      tags: ["World Bank WDI", "Log-log regression", "Data cleaning", "Base R"],
      flip: "Play the emissions chart",
      views: [{ id: "wdi", label: "Emissions and income" }],
      pieces: [
        { type: "note", kicker: "Canada", text: "GDP per person +19%, CO₂ per person −21%, 2000 to 2024." },
        { type: "receipt", title: "Indicators", rows: [["CO₂ / person", "EN.GHG.CO2.PC"], ["GDP / person", "NY.GDP.PCAP.PP.KD"], ["Population", "SP.POP.TOTL"], ["Countries", "184"]] },
        { type: "stamp", top: "Decoupled", big: "60", bottom: "countries" },
      ],
    },
    {
      id: "geo",
      tab: "Consumer geographies",
      when: "Frontier Research · 2025",
      color: "var(--pink)",
      fg: "var(--ink)",
      title: "Where Sri Lanka's consumers are, seen from space",
      meta: ["Research report", "ArcGIS"],
      body: [
        "How consumption is shifting across districts, and where it is heading. With little district-level spending data available, I used nightlight satellite imagery as a proxy for economic activity, mapped in ArcGIS alongside amenity counts by category.",
        "The report sorts households into three income brackets that account for 60% of consumption and assigns each a probability range of spending across FMCG, clothing, food and beverage, entertainment and automobiles.",
      ],
      tags: ["Nightlight data", "ArcGIS", "Market sizing", "Forecasting"],
      pieces: [
        { type: "excerpt", label: "Excerpt A", img: "consumer-geo-1", alt: "Diagram of the consumption model by income bracket" },
        { type: "excerpt", label: "Excerpt B", img: "consumer-geo-2", alt: "Distribution of amenities in Western Province by district" },
        { type: "note", kicker: "Method", text: "Nightlights as a proxy where spending data runs out." },
      ],
    },
    {
      id: "remit",
      tab: "Remittance cycles",
      when: "Frontier Research · 2025",
      color: "var(--orange)",
      title: "Personal remittances and the business cycle",
      meta: ["Research report", "World Bank · CBSL"],
      body: [
        "Remittances are one of Sri Lanka's largest sources of foreign exchange. This research traces how they move with the economic cycle: what drove each wave of growth, from the opening of the economy in the late 1970s to the post-pandemic recovery, and how they line up against the current account balance.",
        "Delivered to Tier-1 banks and central bank officials as part of Frontier's macro coverage.",
      ],
      tags: ["Macro", "Time series", "Balance of payments", "Research writing"],
      pieces: [
        { type: "excerpt", label: "Excerpt A", img: "remittances-1", alt: "Chart of causes for growth in remittances over time" },
        { type: "excerpt", label: "Excerpt B", img: "remittances-2", alt: "Current account balance against remittances year over year" },
      ],
    },
    {
      id: "rates",
      tab: "Inflation & rates paper",
      when: "2025",
      color: "var(--blue-soft)",
      fg: "var(--ink)",
      title: "Central banks, inflation and the prime rate",
      meta: ["Research paper"],
      body: [
        "How central bank rate decisions track inflation, and what the relationship implies for stability and credibility. The paper pairs a long history of inflation and aggregated prime rates with a cross-country regression of one on the other.",
      ],
      tags: ["Monetary policy", "Regression", "Macro history"],
      pieces: [
        { type: "excerpt", label: "Excerpt A", img: "inflation-paper-2", alt: "Inflation and prime rates over time" },
        { type: "excerpt", label: "Excerpt B", img: "inflation-paper-1", alt: "Scatter plot of inflation against aggregated prime rates with a fitted line" },
      ],
    },
    {
      id: "energy",
      tab: "Alberta energy",
      when: "Jan – Apr 2026",
      color: "var(--green-soft)",
      fg: "var(--ink)",
      title: "Alberta's energy economy in three charts",
      meta: ["Energy economics", "AER · AESO data", "R · Plotly"],
      body: [
        "WCS crude under high, low and tariff scenarios; the merit order that stacks generators by marginal cost and sets the pool price; and monthly pool prices that show the seasonality and spikes of a deregulated power market. Read together they trace how oil revenue, generation mix and spot prices interact.",
        "Alongside them I built an interactive Plotly map of China's solar PV exports by destination from Ember's trade data.",
      ],
      tags: ["Power markets", "WCS", "Scenario analysis", "Plotly"],
      pieces: [
        { type: "excerpt", label: "Excerpt A", img: "alberta-wcs", alt: "WCS crude oil price scenarios to 2035" },
        { type: "excerpt", label: "Excerpt B", img: "alberta-merit", alt: "Alberta energy merit order on selected dates" },
        { type: "excerpt", label: "Excerpt C", img: "alberta-pool", alt: "Alberta pool price by month and hour" },
      ],
    },
    {
      id: "loan",
      tab: "Loan default model",
      when: "Personal project",
      color: "#121212",
      title: "Predicting loan defaults",
      meta: ["Python · scikit-learn"],
      body: [
        "A decision tree that predicts loan defaults with about 85% accuracy, trained on 10,000+ borrower records after exploratory analysis and feature scaling.",
        "Wrapped in a command-line tool that returns an accept or reject recommendation, so a credit decision takes one command instead of a notebook.",
      ],
      tags: ["Classification", "scikit-learn", "pandas", "CLI"],
      pieces: [
        { type: "stamp", top: "Accuracy", big: "~85%", bottom: "holdout" },
        { type: "receipt", title: "Model", rows: [["Records", "10,000+"], ["Algorithm", "Decision tree"], ["Output", "Accept / reject"], ["Interface", "CLI"]] },
      ],
    },
  ];

  const cabinet = $("[data-cabinet]");
  if (!cabinet) return;
  const drawer = $("[data-drawer]", cabinet);
  const desk = $("[data-desk]", cabinet);
  desk.id = "desk";
  desk.setAttribute("role", "tabpanel");
  const TAB_X = ["0%", "32%", "10%", "40%", "22%", "6%", "36%", "16%", "44%", "28%"];

  drawer.innerHTML = FILES.map(
    (f, i) => `
    <button class="folder" role="tab" id="tab-${f.id}" aria-controls="desk" aria-selected="false" tabindex="-1"
      data-file="${f.id}" style="--c:${f.color};--tab-x:${TAB_X[i % TAB_X.length]};${f.fg ? `--fg:${f.fg};` : ""}z-index:${i + 1}">
      <span class="folder__tab"><b>${String(i + 1).padStart(2, "0")}</b>${f.tab}${f.views ? '<i class="folder__live">Live</i>' : ""}</span>
      <span class="folder__body"><span>${f.title}</span><span>${f.when}</span></span>
    </button>`
  ).join("");
  const folders = $$(".folder", drawer);

  const pieceHTML = (p) => {
    const t = `data-type="${p.type}"`;
    if (p.type === "excerpt")
      return `<div class="piece piece--excerpt" ${t} tabindex="0" role="button" aria-label="${p.alt}. Press Enter to enlarge, arrow keys to move." data-src="${IMG(p.img)}" data-alt="${p.alt}">
        <p class="piece__label">${p.label}</p><img src="${IMG(p.img)}" alt="${p.alt}" draggable="false" /></div>`;
    if (p.type === "note") return `<div class="piece piece--note" ${t} tabindex="0" aria-label="Note: ${p.text}"><small>${p.kicker}</small>${p.text}</div>`;
    if (p.type === "receipt")
      return `<div class="piece piece--receipt" ${t} tabindex="0" aria-label="${p.title}"><div class="rc__title">${p.title}</div>${p.rows
        .map((r) => `<div class="rc__row"><span>${r[0]}</span><b>${r[1]}</b></div>`)
        .join("")}</div>`;
    if (p.type === "stamp") return `<div class="piece piece--stamp" ${t} tabindex="0" aria-label="${p.top} ${p.big} ${p.bottom}"><div>${p.top}<b>${p.big}</b>${p.bottom}</div></div>`;
    return "";
  };

  let current = null;
  let zTop = 10;
  let cleanupView = () => {};
  const draggable = () => window.matchMedia("(min-width: 761px)").matches;

  // Pieces stack down the free column left of the sheet, slightly askew, like papers dropped on a desk.
  const TILTS = [-3, 2.5, -1.5, 3, -2];
  function layout(pieces, animate) {
    const W = desk.clientWidth;
    const H = desk.clientHeight;
    const sheet = $(".sheet", desk);
    const colW = Math.max(220, (sheet ? sheet.offsetLeft : W * 0.38) - 12);
    let y = desk.classList.contains("desk--live") ? 80 : 34;
    let k = 0;
    pieces.forEach((el) => {
      let x;
      let py;
      let r;
      if (el.dataset.type === "stamp") {
        x = W - el.offsetWidth - 34;
        py = H - el.offsetHeight - 40;
        r = -10;
      } else {
        const jitter = k % 2 ? 22 : 6;
        x = Math.min(jitter + 12, Math.max(8, colW - el.offsetWidth + jitter));
        py = y;
        if (py + el.offsetHeight > H - 60) py = Math.max(24, H - el.offsetHeight - 60 - k * 18);
        y += el.offsetHeight + 22;
        r = TILTS[k % TILTS.length];
        k++;
      }
      el.classList.toggle("is-settling", !!animate);
      setPos(el, x, py);
      el.style.setProperty("--r", `${r}deg`);
      if (animate) setTimeout(() => el.classList.remove("is-settling"), 560);
    });
  }

  function setPos(el, x, y) {
    el._x = x;
    el._y = y;
    el.style.setProperty("--x", `${x}px`);
    el.style.setProperty("--y", `${y}px`);
  }

  function bindDrag(el) {
    let sx, sy, ox, oy, lastT, lastX, lastY, vx, vy, moved, raf;
    const clamp = (x, y) => {
      const bw = desk.clientWidth - el.offsetWidth;
      const bh = desk.clientHeight - el.offsetHeight;
      return [Math.min(Math.max(-el.offsetWidth * 0.35, x), bw + el.offsetWidth * 0.35), Math.min(Math.max(0, y), bh + el.offsetHeight * 0.3)];
    };
    el.addEventListener("pointerdown", (e) => {
      if (!draggable() || e.button !== 0) return;
      cancelAnimationFrame(raf);
      el.setPointerCapture(e.pointerId);
      sx = lastX = e.clientX;
      sy = lastY = e.clientY;
      ox = el._x || 0;
      oy = el._y || 0;
      lastT = performance.now();
      vx = vy = 0;
      moved = false;
      el.style.zIndex = ++zTop;
      el.classList.remove("is-settling");
      el.classList.add("is-dragging");
    });
    el.addEventListener("pointermove", (e) => {
      if (!el.classList.contains("is-dragging")) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      vx = 0.8 * ((e.clientX - lastX) / dt) + 0.2 * vx;
      vy = 0.8 * ((e.clientY - lastY) / dt) + 0.2 * vy;
      lastT = now;
      lastX = e.clientX;
      lastY = e.clientY;
      setPos(el, ...clamp(ox + dx, oy + dy));
    });
    const end = () => {
      if (!el.classList.contains("is-dragging")) return;
      el.classList.remove("is-dragging");
      if (!moved) {
        if (el.dataset.src) openLightbox(el.dataset.src, el.dataset.alt);
        return;
      }
      if (reduce) return;
      // momentum: keep the throw's velocity, then let it decay
      let px = vx * 16;
      let py = vy * 16;
      const step = () => {
        px *= 0.9;
        py *= 0.9;
        if (Math.abs(px) < 0.2 && Math.abs(py) < 0.2) return;
        setPos(el, ...clamp(el._x + px, el._y + py));
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("keydown", (e) => {
      const k = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] }[e.key];
      if (k && draggable()) {
        e.preventDefault();
        el.style.zIndex = ++zTop;
        setPos(el, ...clamp((el._x || 0) + k[0], (el._y || 0) + k[1]));
      } else if ((e.key === "Enter" || e.key === " ") && el.dataset.src) {
        e.preventDefault();
        openLightbox(el.dataset.src, el.dataset.alt);
      }
    });
  }

  /* the flip: the folder turns over to its live side, and back */
  function turn(fromDeg, toDeg, easing, ms) {
    if (reduce) return Promise.resolve();
    const a = desk.animate([{ transform: `perspective(1800px) rotateY(${fromDeg}deg)` }, { transform: `perspective(1800px) rotateY(${toDeg}deg)` }], {
      duration: ms,
      easing,
      fill: "forwards",
    });
    return a.finished.then(() => a);
  }

  function showView(f, id) {
    cleanupView();
    const view = $("[data-view]", desk);
    $$("[data-view-tab]", desk).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.viewTab === id)));
    view.innerHTML = "";
    cleanupView = window.Charts ? window.Charts.mount(id, view) : () => {};
  }

  async function flip(toBack, viewId, byKeyboard = false) {
    const f = FILES.find((q) => q.id === current);
    if (!f || !f.views || desk.classList.contains("is-turning")) return;
    desk.classList.add("is-turning");
    const dir = toBack ? 1 : -1;
    const first = await turn(0, 90 * dir, "cubic-bezier(0.5, 0, 0.75, 0)", 230);
    desk.classList.toggle("is-back", toBack);
    $(".desk__front", desk).hidden = toBack;
    $(".desk__back", desk).hidden = !toBack;
    desk.dataset.tab = toBack ? `${f.when} · live` : f.when;
    if (toBack) showView(f, viewId || f.views[0].id);
    else {
      cleanupView();
      cleanupView = () => {};
      layout($$(".piece", desk), false);
    }
    first?.cancel();
    const second = await turn(-90 * dir, 0, "cubic-bezier(0.23, 1, 0.32, 1)", 460);
    second?.cancel();
    desk.classList.remove("is-turning");
    if (!draggable() || desk.getBoundingClientRect().top < 0) desk.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    if (byKeyboard) $(toBack ? "[data-flip-back]" : "[data-flip]", desk)?.focus({ preventScroll: true });
  }

  function open(id, focusTab) {
    const f = FILES.find((q) => q.id === id) || FILES[0];
    cleanupView();
    cleanupView = () => {};
    current = f.id;
    folders.forEach((b) => {
      const on = b.dataset.file === f.id;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focusTab) b.focus();
    });
    desk.setAttribute("aria-labelledby", `tab-${f.id}`);
    desk.style.setProperty("--c", f.color);
    desk.style.setProperty("--fg", f.fg || "#fff");
    desk.toggleAttribute("data-light", !!f.fg);
    desk.classList.toggle("desk--live", !!f.views);
    desk.classList.remove("is-back");
    desk.dataset.tab = f.when;
    const flipBtn = (cls) =>
      f.views
        ? `<button class="${cls}" type="button" data-flip><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8a6 6 0 0 1 10.2-4.3L14 2v5H9l2-2A4 4 0 1 0 12 8h2a6 6 0 0 1-12 0z"/></svg>${f.flip}</button>`
        : "";
    desk.innerHTML = `
      <div class="desk__front">
        ${f.views ? `<div class="desk__bar">${flipBtn("desk__flip")}</div>` : ""}
        <article class="sheet">
          <div class="sheet__meta">${f.meta.map((m) => `<span>${m}</span>`).join("")}</div>
          <h3>${f.title}</h3>
          ${f.body.map((p) => `<p>${p}</p>`).join("")}
          <div class="sheet__tags">${f.tags.map((t) => `<span>${t}</span>`).join("")}</div>
          ${flipBtn("sheet__flip")}
        </article>
        <div class="desk__pieces">${f.pieces.map(pieceHTML).join("")}</div>
        <div class="desk__tools">
          <button class="btn btn--sm" type="button" data-tidy>Tidy the desk</button>
          <span>Drag the pieces around</span>
        </div>
      </div>
      ${
        f.views
          ? `<div class="desk__back" hidden>
        <div class="back__bar">
          ${
            f.views.length > 1
              ? `<div class="seg seg--dark" role="tablist" aria-label="Live views">${f.views
                  .map((v, i) => `<button role="tab" aria-selected="${i === 0}" data-view-tab="${v.id}">${v.label}</button>`)
                  .join("")}</div>`
              : `<p class="back__title">${f.views[0].label}</p>`
          }
          <button class="btn btn--ghost-light btn--sm" type="button" data-flip-back>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8a6 6 0 0 1 10.2-4.3L14 2v5H9l2-2A4 4 0 1 0 12 8h2a6 6 0 0 1-12 0z"/></svg>Back to the file
          </button>
        </div>
        <div class="back__view" data-view></div>
      </div>`
          : ""
      }`;
    const pieces = $$(".piece", desk);
    pieces.forEach(bindDrag);
    $("[data-tidy]", desk).addEventListener("click", () => layout(pieces, true));
    // a click with detail 0 came from the keyboard: only then move focus to the other side
    $$("[data-flip]", desk).forEach((b) => b.addEventListener("click", (e) => flip(true, null, e.detail === 0)));
    $("[data-flip-back]", desk)?.addEventListener("click", (e) => flip(false, null, e.detail === 0));
    $$("[data-view-tab]", desk).forEach((b) => b.addEventListener("click", () => showView(f, b.dataset.viewTab)));
    const doLayout = () => draggable() && !desk.classList.contains("is-back") && layout(pieces, false);
    Promise.all($$("img", desk).map((im) => (im.complete ? 0 : new Promise((r) => (im.onload = im.onerror = r))))).then(doLayout);
    doLayout();
    if (!reduce && draggable()) {
      desk.animate(
        [
          { transform: "translateY(10px)", opacity: 0.6 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 320, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
      );
    }
  }

  folders.forEach((b, i) => {
    b.addEventListener("click", () => {
      if (b.dataset.file === current) {
        if (desk.classList.contains("is-back")) flip(false);
        return;
      }
      open(b.dataset.file);
      if (!draggable()) desk.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
    b.addEventListener("keydown", (e) => {
      const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (d) {
        e.preventDefault();
        open(folders[(i + d + folders.length) % folders.length].dataset.file, true);
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        open(folders[e.key === "Home" ? 0 : folders.length - 1].dataset.file, true);
      }
    });
  });

  open(FILES[0].id);
  let rw = window.innerWidth;
  window.addEventListener("resize", () => {
    if (Math.abs(window.innerWidth - rw) < 40) return;
    rw = window.innerWidth;
    if (draggable() && !desk.classList.contains("is-back")) layout($$(".piece", desk), false);
  });
})();
