/* Interactive force-directed skills graph. Vanilla JS + D3 (loaded via CDN in index.html). */

(function () {
  const DEVICON_BASE = "https://cdn.jsdelivr.net/npm/devicon@2.15.1/icons";
  const devicon = (name, variant) => `${DEVICON_BASE}/${name}/${name}-${variant}.svg`;
  const simpleIcon = (slug, hex) => `https://cdn.simpleicons.org/${slug}${hex ? "/" + hex : ""}`;

  // Base64 data URIs are the most broadly-compatible way to inline an SVG as an <image href>.
  const toDataUri = (svg) => `data:image/svg+xml;base64,${btoa(svg)}`;

  // Lucide path data (inlined so recoloring/theming doesn't need a runtime fetch).
  const LUCIDE_PATHS = {
    calculator:
      '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
    kanban: '<path d="M5 3v14"/><path d="M12 3v8"/><path d="M19 3v18"/>',
    "message-circle":
      '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>',
    presentation: '<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/>',
    "file-spreadsheet":
      '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/>',
    "bell-curve": '<path d="M2 19h20"/><path d="M3 19c2 .2 3.2-13.5 9-13.5S19 18.8 21 19"/>',
    "chart-column": '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  };
  const lucideIcon = (name, hex) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#${hex}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${LUCIDE_PATHS[name]}</svg>`;
    return toDataUri(svg);
  };

  // OpenAI logomark: six interlocking capsule rings around a common centre, matching the
  // reference mark (a woven ring of six rounded loops), rendered as stroked outlines.
  const openaiIcon = (hex) => {
    const ring = (angle) =>
      `<rect x="-3.1" y="-10.4" width="6.2" height="20.8" rx="3.1" transform="rotate(${angle})" />`;
    const rings = [0, 60, 120, 180, 240, 300].map(ring).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="-13 -13 26 26" fill="none" stroke="#${hex}" stroke-width="2.3">${rings}</svg>`;
    return toDataUri(svg);
  };

  // ---- Data -----------------------------------------------------------
  // group: root | category | subcategory | skill
  const NODES = [
    { id: "me", label: "Me", group: "root" },

    // Core consulting
    { id: "core-consulting", label: "Core Consulting", group: "category" },
    {
      id: "financial-modeling",
      label: "Financial Modeling",
      group: "skill",
      parent: "core-consulting",
      icon: { src: lucideIcon("calculator", "3B82F6") },
    },
    {
      id: "client-comm",
      label: "Stakeholder Comms",
      group: "skill",
      parent: "core-consulting",
      icon: { src: lucideIcon("message-circle", "22D3EE") },
    },
    {
      id: "deck-building",
      label: "Deck Building",
      group: "skill",
      parent: "core-consulting",
      icon: { src: lucideIcon("presentation", "B7472A") },
    },
    {
      id: "project-management",
      label: "Project Management",
      group: "skill",
      parent: "core-consulting",
      icon: { src: lucideIcon("kanban", "0052CC") },
    },
    {
      id: "data-storytelling",
      label: "Data Storytelling",
      group: "skill",
      parent: "core-consulting",
      icon: { src: lucideIcon("chart-column", "F472B6") },
    },
    {
      id: "excel-vba",
      label: "Excel VBA & Macros",
      group: "skill",
      parent: "core-consulting",
      icon: { src: lucideIcon("file-spreadsheet", "217346") },
    },

    // Technical
    { id: "technical", label: "Technical", group: "category" },
    {
      id: "python",
      label: "Python",
      group: "skill",
      parent: "technical",
      icon: { src: devicon("python", "original") },
    },
    {
      id: "r",
      label: "R",
      group: "skill",
      parent: "technical",
      icon: { src: devicon("r", "original") },
    },
    {
      id: "sql",
      label: "SQL",
      group: "skill",
      parent: "technical",
      icon: { src: simpleIcon("mysql", "4479A1") },
    },
    {
      id: "matlab",
      label: "MATLAB",
      group: "skill",
      parent: "technical",
      icon: { src: devicon("matlab", "original") },
    },
    {
      id: "julia",
      label: "Julia",
      group: "skill",
      parent: "technical",
      icon: { src: devicon("julia", "original") },
    },
    {
      id: "statistical-modeling",
      label: "Statistical Modeling",
      group: "skill",
      parent: "technical",
      icon: { src: lucideIcon("bell-curve", "A78BFA") },
    },

    // Developer
    { id: "developer", label: "Developer", group: "category" },
    { id: "frontend", label: "Frontend", group: "subcategory", parent: "developer" },
    {
      id: "react",
      label: "React",
      group: "skill",
      parent: "frontend",
      icon: { src: devicon("react", "original") },
    },
    {
      id: "typescript",
      label: "TypeScript",
      group: "skill",
      parent: "frontend",
      icon: { src: devicon("typescript", "plain") },
    },
    {
      id: "javascript",
      label: "JavaScript",
      group: "skill",
      parent: "frontend",
      icon: { src: devicon("javascript", "plain") },
    },
    {
      id: "tailwind",
      label: "Tailwind CSS",
      group: "skill",
      parent: "frontend",
      icon: { src: devicon("tailwindcss", "plain") },
    },
    {
      id: "vite",
      label: "Vite",
      group: "skill",
      parent: "frontend",
      icon: { src: simpleIcon("vite", "646CFF") },
    },

    { id: "backend", label: "Backend", group: "subcategory", parent: "developer" },
    {
      id: "fastapi",
      label: "FastAPI",
      group: "skill",
      parent: "backend",
      icon: { src: simpleIcon("fastapi", "009688") },
    },
    {
      id: "numpy",
      label: "NumPy",
      group: "skill",
      parent: "backend",
      icon: { src: devicon("numpy", "original") },
    },
    {
      id: "pandas",
      label: "pandas",
      group: "skill",
      parent: "backend",
      icon: { src: devicon("pandas", "original") },
    },
    {
      id: "scipy",
      label: "SciPy",
      group: "skill",
      parent: "backend",
      icon: { src: simpleIcon("scipy", "8CAAE6") },
    },
    {
      id: "postgresql",
      label: "PostgreSQL",
      group: "skill",
      parent: "backend",
      icon: { src: devicon("postgresql", "plain") },
    },

    // AI platforms
    { id: "ai-platforms", label: "AI Platforms", group: "category" },
    {
      id: "claude",
      label: "Claude",
      group: "skill",
      parent: "ai-platforms",
      icon: { src: simpleIcon("claude", "D97757") },
    },
    {
      id: "gemini",
      label: "Gemini",
      group: "skill",
      parent: "ai-platforms",
      icon: { src: simpleIcon("googlegemini", "8E75B2") },
    },
    {
      id: "openai",
      label: "OpenAI",
      group: "skill",
      parent: "ai-platforms",
      icon: { src: openaiIcon("111111") },
    },
  ];

  const LINKS = [
    { source: "me", target: "core-consulting" },
    { source: "me", target: "technical" },
    { source: "me", target: "developer" },
    { source: "me", target: "ai-platforms" },
    { source: "developer", target: "frontend" },
    { source: "developer", target: "backend" },
  ];
  NODES.forEach((n) => {
    if (n.parent) LINKS.push({ source: n.parent, target: n.id });
  });

  // ---- Sizing -----------------------------------------------------------
  const RADIUS = { root: 26, category: 20, subcategory: 16, skill: 13 };
  const radiusOf = (d) => RADIUS[d.group] || 12;

  const LINK_DISTANCE = {
    root: 150,
    category: 80,
    subcategory: 90,
    skill: 62,
  };
  const distanceOf = (link) => {
    const t = typeof link.target === "object" ? link.target : NODES.find((n) => n.id === link.target);
    return LINK_DISTANCE[t.group] || 70;
  };

  function init() {
    const host = document.getElementById("skillsGraph");
    if (!host || typeof d3 === "undefined") return;

    const width = host.clientWidth || 900;
    const height = host.clientHeight || 640;

    const svg = d3
      .select(host)
      .append("svg")
      .attr("viewBox", [0, 0, width, height])
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("class", "skills-graph__svg");

    const zoomLayer = svg.append("g").attr("class", "skills-graph__zoom-layer");

    svg.call(
      d3
        .zoom()
        .scaleExtent([0.5, 2.2])
        .on("zoom", (event) => zoomLayer.attr("transform", event.transform))
    );

    const nodes = NODES.map((n) => Object.assign({}, n));
    const links = LINKS.map((l) => Object.assign({}, l));

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance(distanceOf)
          .strength(0.9)
      )
      .force("charge", d3.forceManyBody().strength(-220))
      .force("collide", d3.forceCollide().radius((d) => radiusOf(d) + 26).strength(0.85))
      .force("x", d3.forceX(width / 2).strength(0.03))
      .force("y", d3.forceY(height / 2).strength(0.03));

    const linkSel = zoomLayer
      .append("g")
      .attr("class", "skills-graph__links")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("class", "skills-graph__link");

    const nodeSel = zoomLayer
      .append("g")
      .attr("class", "skills-graph__nodes")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", (d) => `skills-graph__node skills-graph__node--${d.group}`)
      .call(drag(simulation));

    nodeSel
      .append("circle")
      .attr("r", radiusOf)
      .attr("class", "skills-graph__node-circle");

    nodeSel
      .filter((d) => !!d.icon)
      .append("image")
      .attr("href", (d) => d.icon.src)
      .attr("width", (d) => radiusOf(d) * 1.15)
      .attr("height", (d) => radiusOf(d) * 1.15)
      .attr("x", (d) => -(radiusOf(d) * 1.15) / 2)
      .attr("y", (d) => -(radiusOf(d) * 1.15) / 2)
      .attr("class", "skills-graph__node-icon")
      .on("error", function () {
        // Icon failed to load (e.g. CDN slug mismatch); fall back to a plain neutral node.
        d3.select(this).remove();
      });

    nodeSel
      .append("text")
      .attr("class", "skills-graph__label")
      .attr("y", (d) => radiusOf(d) + 14)
      .attr("text-anchor", "middle")
      .text((d) => d.label);

    nodeSel.style("cursor", "grab");

    simulation.on("tick", () => {
      linkSel
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    function drag(sim) {
      function dragstarted(event, d) {
        if (!event.active) sim.alphaTarget(0.25).restart();
        d.fx = d.x;
        d.fy = d.y;
      }
      function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
      }
      function dragended(event, d) {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
      return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
    }

    // Keep the layout roughly centred if the container is resized (e.g. orientation change).
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const w = host.clientWidth || width;
        const h = host.clientHeight || height;
        svg.attr("viewBox", [0, 0, w, h]);
        simulation.force("x", d3.forceX(w / 2).strength(0.03));
        simulation.force("y", d3.forceY(h / 2).strength(0.03));
        simulation.alpha(0.3).restart();
      }, 200);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
