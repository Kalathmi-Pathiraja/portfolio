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

function initLightbox() {
  const root = qs("[data-lightbox-root]");
  const img = qs("[data-lightbox-img]");
  const closeBtn = qs("[data-lightbox-close]");
  const triggers = qsa("[data-lightbox]");
  if (!root || !img || !triggers.length) return;

  const open = (src, alt) => {
    img.src = src;
    img.alt = alt || "";
    root.classList.add("is-open");
    root.setAttribute("aria-hidden", "false");
  };

  const close = () => {
    root.classList.remove("is-open");
    root.setAttribute("aria-hidden", "true");
    img.src = "";
  };

  triggers.forEach((el) => {
    el.addEventListener("click", () => open(el.currentSrc || el.src, el.alt));
  });

  closeBtn?.addEventListener("click", close);
  root.addEventListener("click", (e) => {
    if (e.target === root) close();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

function main() {
  initReveal();
  initRotator();
  initFooterYear();
  initLinks();
  initSpotify();
  initHeroFilters();
  initLightbox();
}

document.addEventListener("DOMContentLoaded", main);

