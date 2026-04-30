const LINKS = {
  email: "kalathmi.pathiraja@gmail.com",
  linkedin: "https://www.linkedin.com/in/kalathmi-pathiraja-30597b271/",
  twitter: "",
  behance: "",
  github: "",
  spotifyEmbedUrl: "https://open.spotify.com/embed/playlist/7k8NJ5KavWTHrjsKatm651",
  spotifyPlaylistUrl: "https://open.spotify.com/user/kalathmi",
};

function qs(sel, parent = document) {
  return parent.querySelector(sel);
}

function qsa(sel, parent = document) {
  return Array.from(parent.querySelectorAll(sel));
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function setLink(el, href, fallbackText) {
  if (!el) return;
  if (href && href.trim()) {
    el.setAttribute("href", href);
    el.removeAttribute("aria-disabled");
    el.classList.remove("is-disabled");
    return;
  }

  el.setAttribute("href", "#");
  el.setAttribute("aria-disabled", "true");
  el.classList.add("is-disabled");
  if (fallbackText) el.textContent = fallbackText;
}

function hideIfDisabled(el) {
  if (!el) return;
  const disabled = el.getAttribute("aria-disabled") === "true";
  el.classList.toggle("is-hidden", disabled);
}

function initTopbar() {
  const toggle = qs(".nav-toggle");
  const nav = qs(".nav");
  if (!toggle || !nav) return;

  const close = () => {
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", () => {
    const next = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", next);
    toggle.setAttribute("aria-expanded", String(next));
  });

  qsa(".nav a").forEach((a) => a.addEventListener("click", close));
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

function initReveal() {
  const items = qsa(".reveal");
  if (!items.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.12 }
  );

  items.forEach((el) => io.observe(el));
}

function initRotator() {
  const el = qs("[data-rotator]");
  if (!el) return;

  const items = [
    '"building a forecasting intuition"',
    '"writing clean, readable analysis"',
    '"making charts that tell the story"',
    '"exploring policy trade-offs in macro"',
    '"connecting the dots in the data"',
  ];

  let idx = 0;

  const tick = () => {
    el.classList.add("is-out");
    setTimeout(() => {
      el.textContent = items[idx % items.length];
      idx += 1;
      el.classList.remove("is-out");
    }, 160);
  };

  el.textContent = items[0];
  idx = 1;
  window.setInterval(tick, 1500);
}

function initFooterYear() {
  const y = qs("[data-year]");
  if (y) y.textContent = String(new Date().getFullYear());
}

function initLinks() {
  const email = qs("[data-email-link]");
  const linkedin = qs("[data-linkedin-link]");
  const linkedinRail = qs("[data-linkedin-link-rail]");
  const twitterRail = qs("[data-twitter-link-rail]");
  const behanceRail = qs("[data-behance-link-rail]");
  const github = qs("[data-github-link]");
  const playlist = qs("[data-playlist-link]");
  const rail = qs(".hero__follow");

  if (email) email.setAttribute("href", `mailto:${LINKS.email}`);
  setLink(linkedin, LINKS.linkedin, null);
  setLink(github, LINKS.github, null);
  setLink(playlist, LINKS.spotifyPlaylistUrl, null);
  setLink(linkedinRail, LINKS.linkedin, null);
  setLink(twitterRail, LINKS.twitter, null);
  setLink(behanceRail, LINKS.behance, null);

  hideIfDisabled(linkedin);
  hideIfDisabled(github);

  hideIfDisabled(linkedinRail);
  hideIfDisabled(twitterRail);
  hideIfDisabled(behanceRail);

  const anyVisible =
    !!linkedinRail && !linkedinRail.classList.contains("is-hidden")
      ? true
      : !!twitterRail && !twitterRail.classList.contains("is-hidden")
        ? true
        : !!behanceRail && !behanceRail.classList.contains("is-hidden");

  if (rail) rail.classList.toggle("is-hidden", !anyVisible);
}

function initSpotify() {
  const host = qs("[data-spotify-embed]");
  if (!host) return;

  const url = LINKS.spotifyEmbedUrl?.trim();
  if (!url) return;

  host.innerHTML = "";
  const iframe = document.createElement("iframe");
  iframe.title = "Spotify playlist";
  iframe.src = url;
  iframe.width = "100%";
  iframe.height = "152";
  iframe.allow =
    "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
  iframe.loading = "lazy";
  iframe.style.border = "0";
  host.appendChild(iframe);
}

function initHeroFilters() {
  const tabs = qsa(".hero__tabs .tab");
  const pills = qsa(".hero__filters .pill");

  const setActive = (btn, group) => {
    group.forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
  };

  tabs.forEach((btn) =>
    btn.addEventListener("click", () => {
      setActive(btn, tabs);
    })
  );

  pills.forEach((btn) =>
    btn.addEventListener("click", () => {
      setActive(btn, pills);
    })
  );
}

function initModel() {
  const shockSel = qs("#shock");
  const hawk = qs("#hawk");
  const horizon = qs("#horizon");
  const run = qs("#runModel");
  const reset = qs("#resetModel");
  const chartEl = qs("#irfChart");
  if (!shockSel || !hawk || !horizon || !run || !reset || !chartEl) return;

  let expectations = "rational";
  let persistence = "temporary";

  const setSegmentActive = (btn) => {
    const group = btn.parentElement;
    if (!group) return;
    qsa(".segmented__btn", group).forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
  };

  qsa("[data-expect]").forEach((btn) => {
    btn.addEventListener("click", () => {
      expectations = btn.dataset.expect || "rational";
      setSegmentActive(btn);
      draw();
    });
  });

  qsa("[data-persist]").forEach((btn) => {
    btn.addEventListener("click", () => {
      persistence = btn.dataset.persist || "temporary";
      setSegmentActive(btn);
      draw();
    });
  });

  const baseLayout = {
    margin: { l: 44, r: 18, t: 18, b: 34 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "IBM Plex Mono, monospace", color: "rgba(232,236,240,0.82)" },
    xaxis: {
      title: "period",
      gridcolor: "rgba(138,168,255,0.12)",
      zerolinecolor: "rgba(138,168,255,0.2)",
      tickcolor: "rgba(138,168,255,0.18)",
    },
    yaxis: {
      title: "response (index)",
      gridcolor: "rgba(138,168,255,0.12)",
      zerolinecolor: "rgba(138,168,255,0.2)",
      tickcolor: "rgba(138,168,255,0.18)",
    },
    legend: {
      orientation: "h",
      yanchor: "bottom",
      y: 1.02,
      xanchor: "left",
      x: 0,
    },
  };

  // Stylised "three-equation" intuition:
  // x_t: output gap, pi_t: inflation, i_t: nominal policy rate deviation.
  function simulate({ T, shockType, hawkish, exp, persist }) {
    const phiPi = 1.1 + 1.2 * hawkish; // hawkishness strengthens inflation response
    const phiX = 0.2 + 0.35 * hawkish;
    const piInertia = exp === "adaptive" ? 0.78 : 0.55;
    const shockDecay = persist === "persistent" ? 0.86 : 0.55;

    const a1 = 0.65; // output inertia
    const a2 = 0.35; // policy sensitivity
    const b2 = 0.30; // phillips curve slope

    const x = new Array(T).fill(0);
    const pi = new Array(T).fill(0);
    const i = new Array(T).fill(0);

    let sD = 0;
    let sS = 0;
    let sI = 0;
    if (shockType === "demand") sD = 1.0;
    if (shockType === "supply") sS = 1.0;
    if (shockType === "policy") sI = 1.0;

    for (let t = 0; t < T; t += 1) {
      const shockT = Math.pow(shockDecay, t);
      const dShock = sD * shockT;
      const sShock = sS * shockT;
      const iShock = sI * shockT;

      const prevX = t === 0 ? 0 : x[t - 1];
      const prevPi = t === 0 ? 0 : pi[t - 1];
      const prevI = t === 0 ? 0 : i[t - 1];

      // IS-style: output responds to real rate gap
      x[t] = a1 * prevX - a2 * (prevI - prevPi) + dShock;

      // Phillips-style: inflation responds to output gap + inertia + supply shock
      pi[t] = piInertia * prevPi + b2 * x[t] + 0.65 * sShock;

      // Monetary rule: responds to inflation & output + policy shock
      i[t] = phiPi * pi[t] + phiX * x[t] + 0.85 * iShock;
    }

    const norm = (arr) => {
      const m = Math.max(...arr.map((v) => Math.abs(v)), 1e-6);
      return arr.map((v) => v / m);
    };

    // Normalise each series so curves are comparable visually.
    return { x: norm(x), pi: norm(pi), i: norm(i) };
  }

  function buildTraces() {
    const T = clamp(Number(horizon.value) || 24, 12, 40);
    const hawkish = clamp((Number(hawk.value) || 65) / 100, 0, 1);
    const shockType = shockSel.value;

    const { x, pi, i } = simulate({
      T,
      shockType,
      hawkish,
      exp: expectations,
      persist: persistence,
    });

    const periods = Array.from({ length: T }, (_, k) => k);

    return [
      {
        x: periods,
        y: x,
        type: "scatter",
        mode: "lines",
        name: "output gap",
        line: { width: 3, color: "rgba(14,165,233,0.95)" },
      },
      {
        x: periods,
        y: pi,
        type: "scatter",
        mode: "lines",
        name: "inflation",
        line: { width: 3, color: "rgba(37,99,235,0.95)" },
      },
      {
        x: periods,
        y: i,
        type: "scatter",
        mode: "lines",
        name: "policy rate",
        line: { width: 2.6, color: "rgba(232,236,240,0.85)" },
      },
    ];
  }

  let hasInit = false;
  function draw() {
    const traces = buildTraces();

    const config = {
      displayModeBar: false,
      responsive: true,
    };

    if (!hasInit) {
      Plotly.newPlot(chartEl, traces, baseLayout, config);
      hasInit = true;
      return;
    }

    Plotly.react(chartEl, traces, baseLayout, config);
  }

  run.addEventListener("click", draw);
  reset.addEventListener("click", () => {
    shockSel.value = "demand";
    hawk.value = "65";
    horizon.value = "24";

    expectations = "rational";
    persistence = "temporary";
    qsa("[data-expect]").forEach((b) =>
      b.classList.toggle("is-active", b.dataset.expect === "rational")
    );
    qsa("[data-persist]").forEach((b) =>
      b.classList.toggle("is-active", b.dataset.persist === "temporary")
    );

    draw();
  });

  // redraw on control tweaks for instant feedback
  shockSel.addEventListener("change", draw);
  hawk.addEventListener("input", draw);
  horizon.addEventListener("input", draw);

  draw();
}

function main() {
  initTopbar();
  initReveal();
  initRotator();
  initFooterYear();
  initLinks();
  initSpotify();
  initHeroFilters();
  initModel();
}

document.addEventListener("DOMContentLoaded", main);

