/* ============================================================================
   FALAK 1259 — shared renderer
   ----------------------------------------------------------------------------
   Builds the header, footer and navigation from content.js, injects page copy
   into labelled slots, and handles form submission. You should not need to edit
   this file to change wording — do that in content.js.
   ============================================================================ */
(function () {
  "use strict";

  var C = window.FALAK || {};

  /* ---- helpers --------------------------------------------------------- */
  function get(path) {
    return path.split(".").reduce(function (o, k) {
      return o == null ? undefined : o[k];
    }, C);
  }
  function el(tag, attrs, html) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (html != null) node.innerHTML = html;
    return node;
  }
  function currentPage() {
    var p = location.pathname.split("/").pop();
    return p && p.length ? p : "index.html";
  }

  /* ---- the logo mark: the Tusi couple, as inline SVG ------------------- */
  /* Outer circle, inner circle (half radius, tangent at the right), the
     diameter line, and the drawing point on the rim — the same geometry the
     product embodies. Uses currentColor so it inherits the brass accent.     */
  function markSVG(size, title) {
    return (
      '<svg class="mark" width="' + size + '" height="' + size + '" viewBox="0 0 100 100" ' +
      'role="img" aria-label="' + (title || "Falak 1259 mark") + '" focusable="false">' +
        '<g fill="none" stroke="currentColor" stroke-width="1.4">' +
          '<circle cx="50" cy="50" r="38"/>' +
          '<circle cx="69" cy="50" r="19"/>' +
          '<line x1="12" y1="50" x2="88" y2="50"/>' +
        '</g>' +
        '<circle cx="88" cy="50" r="2.4" fill="#f2ead6" stroke="none"/>' +
      '</svg>'
    );
  }

  /* ---- header ---------------------------------------------------------- */
  function buildHeader(host) {
    var here = currentPage();
    var header = el("div", { class: "site-header__inner" });

    var brand = el("a", { class: "brand", href: "index.html", "aria-label": get("site.name") });
    brand.innerHTML =
      '<span class="brand__mark">' + markSVG(34) + "</span>" +
      '<span class="brand__word">FALAK <span class="brand__num">1259</span></span>';
    header.appendChild(brand);

    var toggle = el("button", {
      class: "nav-toggle", type: "button",
      "aria-expanded": "false", "aria-controls": "primary-nav",
      "aria-label": "Menu",
    }, '<span></span><span></span><span></span>');

    var nav = el("nav", { class: "site-nav", id: "primary-nav", "aria-label": "Primary" });
    (get("nav") || []).forEach(function (item) {
      var a = el("a", { href: item.href }, item.label);
      if (item.href === here) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    });

    header.appendChild(nav);
    header.appendChild(toggle);
    host.appendChild(header);

    toggle.addEventListener("click", function () {
      var open = host.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        host.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---- footer ---------------------------------------------------------- */
  function buildFooter(host) {
    var here = currentPage();
    var inner = el("div", { class: "site-footer__inner" });

    var brandBlock = el("div", { class: "site-footer__brand" });
    brandBlock.innerHTML =
      '<span class="footer-mark">' + markSVG(48) + "</span>" +
      '<p class="site-footer__blurb">' + (get("footer.blurb") || "") + "</p>";
    inner.appendChild(brandBlock);

    var nav = el("nav", { class: "site-footer__nav", "aria-label": "Footer" });
    (get("nav") || []).forEach(function (item) {
      var a = el("a", { href: item.href }, item.label);
      if (item.href === here) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    });
    inner.appendChild(nav);

    var small = el("p", { class: "site-footer__small" });
    small.innerHTML =
      (get("site.arabic") || "") + " &nbsp;·&nbsp; " +
      (get("footer.smallprint") || "") +
      " &nbsp;·&nbsp; © " + new Date().getFullYear() + " " + (get("site.name") || "");
    inner.appendChild(small);

    host.appendChild(inner);
  }

  /* ---- generic copy injection ------------------------------------------ */
  /* [data-content="a.b.c"]       -> textContent
     [data-content-html="a.b.c"]  -> innerHTML (rich fields, inline HTML)      */
  function injectCopy() {
    document.querySelectorAll("[data-content]").forEach(function (n) {
      var v = get(n.getAttribute("data-content"));
      if (v != null) n.textContent = v;
    });
    document.querySelectorAll("[data-content-html]").forEach(function (n) {
      var v = get(n.getAttribute("data-content-html"));
      if (v != null) n.innerHTML = v;
    });
    // placeholder text for inputs/textareas
    document.querySelectorAll("[data-content-ph]").forEach(function (n) {
      var v = get(n.getAttribute("data-content-ph"));
      if (v != null) n.setAttribute("placeholder", v);
    });
  }

  /* ---- repeating structures -------------------------------------------- */
  var builders = {
    "mission-body": function (host) {
      (get("mission.body") || []).forEach(function (block) {
        if (block.type === "h2")      host.appendChild(el("h2", { class: "prose__h2" }, block.text));
        else if (block.type === "pull") host.appendChild(el("blockquote", { class: "pull" }, block.text));
        else                           host.appendChild(el("p", { class: "prose__p" }, block.text));
      });
    },
    "how-it-works": function (host) {
      (get("object.howItWorks") || []).forEach(function (step, i) {
        var item = el("li", { class: "step" });
        item.innerHTML =
          '<span class="step__num">' + String(i + 1).padStart(2, "0") + "</span>" +
          '<div class="step__body"><h3 class="step__title">' + step.title +
          '</h3><p>' + step.text + "</p></div>";
        host.appendChild(item);
      });
    },
    "spec": function (host) {
      (get("object.spec") || []).forEach(function (row) {
        var dt = el("dt", { class: "spec__label" }, row.label);
        var dd = el("dd", { class: "spec__value" }, row.value);
        host.appendChild(dt); host.appendChild(dd);
      });
    },
    "order-included": function (host) {
      (get("order.included") || []).forEach(function (line) {
        host.appendChild(el("li", null, line));
      });
    },
    "gallery-grid": function (host) {
      (get("gallery.images") || []).forEach(function (img) {
        var fig = el("figure", { class: "shot" });
        fig.innerHTML =
          '<img src="' + img.src + '" alt="' + img.alt + '" loading="lazy" />' +
          '<figcaption>' + (img.caption || "") + "</figcaption>";
        host.appendChild(fig);
      });
    },
    "order-intents": function (host) {
      (get("order.form.intents") || []).forEach(function (opt) {
        host.appendChild(el("option", { value: opt }, opt));
      });
    },
    "gallery-video": function (host) {
      var v = get("gallery.video") || {};
      if (v.src) {
        var video = el("video", {
          class: "video", controls: "", preload: "none",
          poster: v.poster || "",
        });
        video.appendChild(el("source", { src: v.src, type: "video/mp4" }));
        host.appendChild(video);
      } else {
        var ph = el("div", { class: "video video--placeholder", role: "img", "aria-label": v.placeholder || "Demonstration video placeholder" });
        ph.style.backgroundImage = v.poster ? 'url("' + v.poster + '")' : "";
        ph.innerHTML = '<span>' + (v.placeholder || "Demonstration video") + "</span>";
        host.appendChild(ph);
      }
    },
  };

  function runBuilders() {
    document.querySelectorAll("[data-build]").forEach(function (host) {
      var fn = builders[host.getAttribute("data-build")];
      if (fn) fn(host);
    });
  }

  /* ---- forms ----------------------------------------------------------- */
  function wireForms() {
    document.querySelectorAll("form[data-form]").forEach(function (form) {
      var cfgPath = form.getAttribute("data-form");      // e.g. "order.form"
      var cfg = get(cfgPath) || {};
      var status = form.querySelector("[data-form-status]");

      function setStatus(msg, kind) {
        if (!status) return;
        status.textContent = msg;
        status.className = "form-status" + (kind ? " form-status--" + kind : "");
      }

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        setStatus("", "");

        // native validation first (required, type=email)
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }

        var endpoint = get("forms.endpoint") || "";
        var data = Object.fromEntries(new FormData(form).entries());

        // Endpoint not configured yet — confirm on screen, don't send.
        if (!endpoint || /REPLACE-WITH-YOUR-FORM-ENDPOINT/.test(endpoint)) {
          setStatus(cfg.placeholderNotice || "Form endpoint not configured.", "notice");
          form.reset();
          return;
        }

        var btn = form.querySelector('[type="submit"]');
        if (btn) btn.disabled = true;
        setStatus("Sending…", "notice");

        fetch(endpoint, {
          method: (get("forms.method") || "POST"),
          headers: { "Accept": "application/json", "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
          .then(function (r) {
            if (!r.ok) throw new Error("Bad status " + r.status);
            setStatus(cfg.success || "Thank you — your message has been sent.", "success");
            form.reset();
          })
          .catch(function () {
            setStatus(cfg.error || "Something went wrong. Please try again.", "error");
          })
          .finally(function () { if (btn) btn.disabled = false; });
      });
    });
  }

  /* ---- init ------------------------------------------------------------ */
  function init() {
    var h = document.querySelector("[data-site-header]");
    var f = document.querySelector("[data-site-footer]");
    if (h) buildHeader(h);
    injectCopy();
    runBuilders();
    if (f) buildFooter(f);
    wireForms();

    // set document title from page eyebrow/title if present
    var t = document.querySelector("[data-doc-title]");
    if (t) document.title = t.getAttribute("data-doc-title") + " · " + (get("site.name") || "");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
