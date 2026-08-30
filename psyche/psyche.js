/* ============================================================================
   PSYCHE — the interface
   ----------------------------------------------------------------------------
   All of the thinking lives in engine.js. This file moves between four views,
   renders what the engine returns, and keeps a journal in local storage.
   Nothing here talks to a network; there is nothing to talk to.
   ========================================================================== */
(function () {
  "use strict";

  var E = window.PsycheEngine;
  var STORE = "psyche.journal.v1";

  var state = { account: "", answers: {} };
  var history = [];          /* question ids in the order they were answered */
  var current = null;        /* the question on screen */
  var lastReading = null;
  var riskAcknowledged = false;  /* a crisis flag holds the screen once, not twice */

  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---- views ------------------------------------------------------------ */

  function show(name) {
    $$("[data-step]").forEach(function (s) { s.hidden = s.getAttribute("data-step") !== name; });
    var pane = $('[data-step="' + name + '"]');
    var h = pane && pane.querySelector("h1");
    if (h) h.focus();
    if (name !== "reading") window.scrollTo(0, 0);
    if (name === "journal") renderJournal();
  }

  /* ---- 1. the account --------------------------------------------------- */

  var EXAMPLE =
    "A colleague presented my analysis in the review as though it were his own. " +
    "I said nothing — I actually laughed and said it was a good summary. Then I " +
    "couldn't let go of it. I was rewriting the conversation in my head all evening, " +
    "furious, and I still am. It's such a small thing. Everyone knows what I did.";

  function initAccount() {
    var form = $("[data-account-form]"), box = $("[data-account]"), err = $("[data-account-err]");

    $("[data-example]").addEventListener("click", function () {
      box.value = EXAMPLE;
      box.focus();
      checkRisk(EXAMPLE, $("[data-risk-account]"));
    });

    var debounce = null;
    box.addEventListener("input", function () {
      err.hidden = true;
      clearTimeout(debounce);
      debounce = setTimeout(function () { checkRisk(box.value, $("[data-risk-account]")); }, 600);
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var text = box.value.trim();
      if (text.length < 20) {
        err.textContent = "A little more to go on, please — a couple of sentences about what happened and what it did to you.";
        err.hidden = false;
        box.focus();
        return;
      }
      var slot = $("[data-risk-account]");
      var level = checkRisk(text, slot);

      /* A crisis flag stops here once. Moving straight on to seven questions
         about archetypes would be the wrong answer to what was just written,
         and hiding the panel behind the next screen amounts to the same
         thing. One deliberate press to continue; it is not asked twice.     */
      if (level === "crisis" && !riskAcknowledged) {
        riskAcknowledged = true;
        var go = form.querySelector('button[type="submit"]');
        go.textContent = "Continue anyway";
        var h = slot.querySelector("h3");
        if (h) { h.setAttribute("tabindex", "-1"); h.focus(); }
        slot.scrollIntoView({ block: "nearest" });
        return;
      }

      state = { account: text, answers: {} };
      history = [];
      advance();
    });
  }

  /* ---- risk ------------------------------------------------------------- */

  function checkRisk(text, slot) {
    var r = E.riskScan(text);
    slot.innerHTML = "";
    if (!r.level) { slot.hidden = true; return null; }

    var box = el("div", "risk");
    if (r.level === "crisis") {
      box.appendChild(el("h3", null, "Before anything else"));
      box.appendChild(el("p", null,
        "Something in what you wrote reads as more than a difficult reaction. If " +
        "you are thinking about ending your life or hurting yourself, please stop " +
        "reading this page and talk to a person. This tool cannot help with that, " +
        "and it would be dishonest of it to pretend otherwise."));
    } else {
      box.appendChild(el("h3", null, "One thing first"));
      box.appendChild(el("p", null,
        "Part of your account reads as someone frightening or hurting you. If that " +
        "is what is happening, no reading of your reaction is the point — your " +
        "reaction is probably accurate. Safety comes before analysis."));
    }
    var ul = el("ul");
    [
      ["UK & Ireland — Samaritans, free, 24 hours: ", "116 123", null],
      ["US & Canada — Suicide & Crisis Lifeline: call or text ", "988", null],
      ["Anywhere — ", "findahelpline.com", "https://findahelpline.com"],
      ["In immediate danger — emergency services.", null, null]
    ].forEach(function (row) {
      var li = el("li");
      li.appendChild(document.createTextNode(row[0]));
      if (row[1] && row[2]) {
        var a = el("a", null, row[1]);
        a.href = row[2]; a.target = "_blank"; a.rel = "noopener noreferrer";
        li.appendChild(a);
      } else if (row[1]) {
        li.appendChild(el("b", null, row[1]));
      }
      ul.appendChild(li);
    });
    box.appendChild(ul);
    slot.appendChild(box);
    slot.hidden = false;
    return r.level;
  }

  /* ---- 2. the questions -------------------------------------------------- */

  function advance() {
    var q = E.nextQuestion(state);
    if (!q) { renderReading(); return; }
    current = q;
    renderQuestion(q);
    show("question");
  }

  function renderQuestion(q) {
    var answered = history.length;
    var total = Math.max(q.total, E.MAX_QUESTIONS);
    $("[data-progress-text]").textContent = "Question " + (answered + 1) + " of " + total;
    $("[data-progress-fill]").style.width = Math.round((answered / total) * 100) + "%";

    $("[data-question-text]").textContent = q.text;
    $("[data-question-why]").textContent = q.why;
    $("[data-why-wrap]").open = false;

    var opts = $("[data-options]"), txt = $("[data-textanswer]");
    opts.innerHTML = "";

    if (q.kind === "text") {
      opts.hidden = true;
      txt.hidden = false;
      var input = $("[data-text-input]");
      input.value = (state.answers[q.id] && state.answers[q.id].text) || "";
      $("[data-text-label]").textContent = "In your own words";
      setTimeout(function () { input.focus(); }, 40);
    } else {
      txt.hidden = true;
      opts.hidden = false;
      q.options.forEach(function (o) {
        var b = el("button", "opt", o.label);
        b.type = "button";
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", function () { answer(q.id, { optionId: o.id }); });
        opts.appendChild(b);
      });
    }

    $("[data-back]").hidden = history.length === 0;
  }

  function answer(id, value) {
    state.answers[id] = value;
    history.push(id);
    advance();
  }

  function initQuestions() {
    $("[data-text-next]").addEventListener("click", function () {
      answer(current.id, { text: $("[data-text-input]").value.trim() });
    });
    $("[data-text-skip]").addEventListener("click", function () {
      answer(current.id, { text: "" });
    });
    $("[data-text-input]").addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") { ev.preventDefault(); $("[data-text-next]").click(); }
    });
    $("[data-back]").addEventListener("click", function () {
      var last = history.pop();
      if (last == null) return;
      delete state.answers[last];
      /* Answers after this one can no longer be trusted — the branch may
         differ — so anything later was already popped by construction.      */
      advance();
    });
    $$("[data-restart]").forEach(function (b) {
      b.addEventListener("click", function () {
        state = { account: "", answers: {} };
        history = []; current = null; lastReading = null; riskAcknowledged = false;
        $("[data-account]").value = "";
        $("[data-risk-account]").hidden = true;
        $('[data-account-form] button[type="submit"]').textContent = "Begin";
        $("[data-saved]").textContent = "";
        show("account");
      });
    });
  }

  /* ---- 3. the reading ---------------------------------------------------- */

  function renderReading() {
    var out = E.read(state);
    lastReading = out;

    checkRisk(state.account, $("[data-risk-reading]"));
    $("[data-core]").textContent = out.core;
    $("[data-thin]").hidden = !out.thin;

    var host = $("[data-readings]");
    host.innerHTML = "";
    out.readings.forEach(function (r, i) {
      host.appendChild(readingCard(r, i === 0));
    });

    renderProtocol(out.protocol);
    $("[data-saved]").textContent = "";
    show("reading");
    window.scrollTo(0, 0);
  }

  function readingCard(r, lead) {
    var card = el("article", "reading" + (lead ? " reading--lead" : "") + (r.label === "faint" ? " reading--faint" : ""));

    var head = el("div", "reading__head");
    head.appendChild(el("h3", null, r.dynamic.name));
    head.appendChild(el("span", "reading__short", r.dynamic.short));
    card.appendChild(head);

    var gauge = el("div", "gauge");
    var bar = el("div", "gauge__bar");
    var fill = el("i");
    fill.style.width = Math.round(Math.min(1, r.confidence) * 100) + "%";
    bar.appendChild(fill);
    gauge.appendChild(bar);
    gauge.appendChild(el("span", "gauge__label", ({
      strong: "strong signal", present: "present", faint: "faint — held lightly"
    })[r.label]));
    card.appendChild(gauge);

    card.appendChild(el("p", null, r.dynamic.jung));

    if (r.evidence.length) {
      var ul = el("ul", "evidence"), quoted = {};
      r.evidence.forEach(function (e) {
        var li = el("li");
        li.appendChild(document.createTextNode(capitalise(e.claim)));
        if (e.quote && !quoted[e.quote]) {
          quoted[e.quote] = true;
          li.appendChild(document.createTextNode(" — "));
          var q = el("q", null, e.quote);
          li.appendChild(q);
          li.appendChild(document.createTextNode(" "));
          li.appendChild(el("span", "src", e.kind === "text" ? "your account" : "your answer"));
        }
        ul.appendChild(li);
      });
      card.appendChild(ul);
    }

    var qb = el("p", "reading__q");
    qb.appendChild(el("b", null, "The question to sit with"));
    qb.appendChild(document.createTextNode(r.dynamic.question));
    card.appendChild(qb);

    return card;
  }

  function renderProtocol(p) {
    var host = $("[data-protocol]");
    host.innerHTML = "";
    host.appendChild(phase("When it fires again", "In the moment", listOf("ol", p.moment)));
    host.appendChild(phase("Today, while it is fresh", "On paper", listOf("ol", p.today)));

    var week = document.createDocumentFragment();
    p.week.forEach(function (pr) {
      var box = el("div", "practice");
      box.appendChild(el("h4", null, pr.title));
      box.appendChild(listOf("ol", pr.steps));
      week.appendChild(box);
    });
    host.appendChild(phase("This week", "The practice", week));

    host.appendChild(phase("Over a month", "The log", listOf("ul", p.month)));
    var limits = phase("What this is not", "Limits", listOf("ul", p.limits));
    limits.className = "phase phase--limits";
    host.appendChild(limits);
  }

  function phase(when, what, body) {
    var s = el("section", "phase");
    s.appendChild(el("p", "phase__when", when));
    s.appendChild(el("h3", "phase__what", what));
    s.appendChild(body);
    return s;
  }

  function listOf(tag, items) {
    var list = el(tag);
    items.forEach(function (t) { list.appendChild(el("li", null, t)); });
    return list;
  }

  function capitalise(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }

  function initReading() {
    $("[data-copy]").addEventListener("click", function () {
      var text = E.toText(state, lastReading);
      copy(text, function (ok) {
        $("[data-saved]").textContent = ok
          ? "Copied. Paste it wherever you keep things."
          : "Couldn't reach the clipboard — the reading is on screen to copy by hand.";
      });
    });
    $("[data-save]").addEventListener("click", function () {
      if (!saveEntry()) {
        $("[data-saved]").textContent = "This browser won't let the page store anything, so there is nowhere to save it. Copy it as text instead.";
        return;
      }
      $("[data-saved]").textContent = "Saved to this device only. It is in the journal.";
      refreshCount();
    });
  }

  function copy(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallbackCopy(text)); });
    } else {
      done(fallbackCopy(text));
    }
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (err) { return false; }
  }

  /* ---- 4. the journal ---------------------------------------------------- */

  /* Local storage is not guaranteed — private windows and blocked site data
     both throw on access rather than returning nothing — so every touch of it
     is wrapped, and the interface says so plainly when it fails.            */
  function load() {
    try {
      var raw = window.localStorage.getItem(STORE);
      var parsed = raw ? JSON.parse(raw) : [];
      return Object.prototype.toString.call(parsed) === "[object Array]" ? parsed : [];
    } catch (err) { return []; }
  }

  function persist(list) {
    try { window.localStorage.setItem(STORE, JSON.stringify(list)); return true; }
    catch (err) { return false; }
  }

  function saveEntry() {
    var list = load();
    list.unshift({
      id: String(Date.now()),
      at: new Date().toISOString(),
      account: state.account,
      answers: state.answers,
      core: lastReading.core,
      top: lastReading.readings[0].dynamic.short,
      label: lastReading.readings[0].label
    });
    return persist(list.slice(0, 200));
  }

  function renderJournal() {
    var list = load(), host = $("[data-journal]");
    host.innerHTML = "";
    $("[data-clear-journal]").hidden = list.length === 0;

    if (!list.length) {
      host.appendChild(el("p", "empty", "Nothing saved yet. A reading you keep is worth more than a reading you read once — the pattern only shows up across several."));
      return;
    }

    list.forEach(function (entry) {
      var card = el("article", "entry");

      var meta = el("div", "entry__meta");
      meta.appendChild(el("span", null, formatDate(entry.at)));
      meta.appendChild(el("b", null, entry.top || "—"));
      if (entry.label) meta.appendChild(el("span", null, entry.label));
      card.appendChild(meta);

      card.appendChild(el("p", "entry__core", entry.core || ""));
      card.appendChild(el("p", "entry__excerpt", excerpt(entry.account)));

      var acts = el("div", "entry__acts");
      var open = el("button", "btn btn--quiet", "Open");
      open.type = "button";
      open.addEventListener("click", function () {
        state = { account: entry.account, answers: entry.answers || {} };
        history = Object.keys(state.answers);
        renderReading();
      });
      var del = el("button", "btn btn--quiet btn--danger", "Delete");
      del.type = "button";
      del.addEventListener("click", function () {
        persist(load().filter(function (e) { return e.id !== entry.id; }));
        renderJournal();
        refreshCount();
      });
      acts.appendChild(open);
      acts.appendChild(del);
      card.appendChild(acts);

      host.appendChild(card);
    });
  }

  function excerpt(text) {
    var t = String(text || "").replace(/\s+/g, " ").trim();
    return t.length > 180 ? t.slice(0, 177).replace(/\s\S*$/, "") + "…" : t;
  }

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function refreshCount() {
    var n = load().length, badge = $("[data-journal-count]");
    badge.textContent = n;
    badge.hidden = n === 0;
  }

  function initJournal() {
    $("[data-clear-journal]").addEventListener("click", function () {
      if (!window.confirm("Delete every saved reading on this device? This cannot be undone.")) return;
      persist([]);
      renderJournal();
      refreshCount();
    });
  }

  /* ---- boot -------------------------------------------------------------- */

  function init() {
    if (!E) return;
    $$("[data-go]").forEach(function (b) {
      b.addEventListener("click", function () { show(b.getAttribute("data-go")); });
    });
    initAccount();
    initQuestions();
    initReading();
    initJournal();
    refreshCount();
    show("account");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
