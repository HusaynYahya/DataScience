/* ============================================================================
   FALAK 1259 — the Tusi couple animation
   ----------------------------------------------------------------------------
   A small circle (radius r) rolls without slipping inside a fixed circle of
   radius R = 2r. A drawing point sits distance d from the small circle's
   centre. The locus is computed from the rolling geometry itself:

        centre of rolling circle:  C(θ) = ( r·cosθ , r·sinθ )
        drawing point:             P(θ) = ( (r+d)·cosθ , (r−d)·sinθ )

   Consequences, all exact:
        d = r  →  y ≡ 0        a perfectly straight line (the Tusi couple)
        0<d<r  →  ellipse, semi-axes (r+d) and (r−d)
        d = 0  →  circle of radius r

   Nothing here is a preset path — every point comes from the formula above.
   ============================================================================ */
(function () {
  "use strict";

  var root = document.getElementById("tusi");
  if (!root || !window.FALAK) return;

  var A = window.FALAK.object.animation || {};
  var SVGNS = "http://www.w3.org/2000/svg";

  // Geometry in SVG user units. viewBox is centred on the origin; a group
  // flips the y-axis so maths-up is screen-up.
  var R = 92;          // outer (fixed) circle radius
  var r = R / 2;       // rolling circle radius
  var VIEW = 220;      // viewBox extent (-110 … 110)

  var d = r;           // drawing-point distance from rolling centre (starts at the rim → straight line)
  var theta = 0;
  var playing = false;
  var rafId = null;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- build the SVG --------------------------------------------------- */
  function svg(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  var fig = svg("svg", {
    viewBox: (-VIEW / 2) + " " + (-VIEW / 2) + " " + VIEW + " " + VIEW,
    class: "tusi__svg", role: "img",
    "aria-label": "Animation of the Tusi couple: a circle rolling inside another twice its size, a point on it tracing a straight line.",
  });
  var flip = svg("g", { transform: "scale(1,-1)" });   // y-up
  fig.appendChild(flip);

  var outer  = svg("circle", { cx: 0, cy: 0, r: R, class: "tusi-outer" });
  var locus  = svg("path",   { class: "tusi-locus", d: "" });
  var inner  = svg("circle", { r: r, class: "tusi-inner" });
  var arm    = svg("line",   { class: "tusi-arm" });
  var hub    = svg("circle", { r: 2.2, class: "tusi-hub" });
  var point  = svg("circle", { r: 3.4, class: "tusi-point" });

  flip.appendChild(outer);
  flip.appendChild(locus);
  flip.appendChild(inner);
  flip.appendChild(arm);
  flip.appendChild(hub);
  flip.appendChild(point);
  root.querySelector("[data-tusi-stage]").appendChild(fig);

  /* ---- maths ----------------------------------------------------------- */
  function centre(t) { return { x: r * Math.cos(t), y: r * Math.sin(t) }; }
  function draw(t)   { return { x: (r + d) * Math.cos(t), y: (r - d) * Math.sin(t) }; }

  function locusPath() {
    var steps = 240, s = "";
    for (var i = 0; i <= steps; i++) {
      var t = (i / steps) * Math.PI * 2;
      var p = draw(t);
      s += (i === 0 ? "M" : "L") + p.x.toFixed(3) + " " + p.y.toFixed(3);
    }
    return s + "Z";
  }

  /* ---- readouts -------------------------------------------------------- */
  var elFigure = root.querySelector("[data-tusi-figure]");
  var elValue  = root.querySelector("[data-tusi-value]");

  function figureName() {
    if (d >= r - 0.001) return A.figureLine || "Straight line";
    if (d <= 0.001)     return A.figureCircle || "Circle";
    return A.figureEllipse || "Ellipse";
  }

  function render() {
    locus.setAttribute("d", locusPath());
    var c = centre(theta), p = draw(theta);
    inner.setAttribute("cx", c.x.toFixed(3));
    inner.setAttribute("cy", c.y.toFixed(3));
    hub.setAttribute("cx", c.x.toFixed(3));
    hub.setAttribute("cy", c.y.toFixed(3));
    point.setAttribute("cx", p.x.toFixed(3));
    point.setAttribute("cy", p.y.toFixed(3));
    arm.setAttribute("x1", c.x.toFixed(3));
    arm.setAttribute("y1", c.y.toFixed(3));
    arm.setAttribute("x2", p.x.toFixed(3));
    arm.setAttribute("y2", p.y.toFixed(3));

    if (elFigure) elFigure.textContent = figureName();
    if (elValue)  elValue.textContent = Math.round(((r - d) / r) * 100) + "% inboard";
  }

  /* ---- animation loop -------------------------------------------------- */
  var last = 0;
  function tick(now) {
    if (!playing) return;
    if (!last) last = now;
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    theta = (theta + dt * 0.9) % (Math.PI * 2);   // ~0.9 rad/s, unhurried
    render();
    rafId = requestAnimationFrame(tick);
  }

  var btn = root.querySelector("[data-tusi-play]");
  function setPlaying(on) {
    playing = on;
    if (btn) {
      btn.textContent = on ? (A.pauseLabel || "Pause") : (A.playLabel || "Play");
      btn.setAttribute("aria-pressed", String(on));
    }
    if (on) { last = 0; rafId = requestAnimationFrame(tick); }
    else if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }
  if (btn) btn.addEventListener("click", function () { setPlaying(!playing); });

  /* ---- slider: d from rim (r) to centre (0) ---------------------------- */
  var slider = root.querySelector("[data-tusi-slider]");
  if (slider) {
    slider.min = 0;
    slider.max = 1000;
    slider.value = 1000;                 // start at the rim → straight line
    slider.addEventListener("input", function () {
      d = (slider.value / 1000) * r;     // 1000 → d=r (rim); 0 → d=0 (centre)
      render();
    });
  }

  /* ---- init ------------------------------------------------------------ */
  render();
  if (!reduce) {
    setPlaying(true);
  } else {
    theta = Math.PI * 0.18;              // a settled, legible frame
    render();
    setPlaying(false);
  }

  // Pause when off-screen to save cycles.
  if ("IntersectionObserver" in window) {
    var wasPlaying = false;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { if (wasPlaying && !reduce) setPlaying(true); }
        else { wasPlaying = playing; if (playing) setPlaying(false); }
      });
    }, { threshold: 0.15 }).observe(root);
  }
})();
