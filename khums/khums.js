/* ============================================================================
   KHUMS CALCULATOR
   ----------------------------------------------------------------------------
   Works out what is owed on a khums day, according to the rulings of Sayyid
   Ali al-Husayni al-Sistani (may Allah prolong his life).

   Khums is not a tax on income. It is a fifth of what is *left over* on the
   day your khums year closes — so the calculation is not "what did I earn,
   less what I spent", but "what do I still hold that has not already been
   khumsed, and is not exempt". Everything spent within the year on a living
   befitting your standing is already gone and is counted no further.

   Three parts, in order:
     1. The khums year — the small arithmetic of dates.
     2. The ruling engine — pure functions: holdings in, verdict out. No
        network, no DOM, no storage. This is the part worth reading.
     3. The interface — form wiring, saving, and rendering.
   ========================================================================== */
(function () {
  "use strict";

  /* ---- constants ------------------------------------------------------- */

  /* A fifth. The fifth is then halved: the share of the Imam (a.s.) and the
     share of the sayyids.                                                   */
  var RATE = 1 / 5;

  /* One common (sayrafi) mithqal is 4.608 g, and one nukhud is a twenty-fourth
     of it. The thresholds below are the ones the law names, converted once:
       minerals   15 mithqal of coined gold              = 69.12 g
       treasure   105 mithqal of silver, or 15 of gold   = 483.84 g / 69.12 g
       diving     18 nukhud of gold (one dinar)          = 3.456 g            */
  var MITHQAL_G = 4.608;
  var NUKHUD_G  = MITHQAL_G / 24;

  var NISAB = {
    mineral:  { gold: 15 * MITHQAL_G },
    treasure: { gold: 15 * MITHQAL_G, silver: 105 * MITHQAL_G },
    diving:   { gold: 18 * NUKHUD_G }
  };

  /* A lunar year is 354 days and a fraction. Adding 354 days a time drifts by
     about a third of a day each year, which is why the interface says to check
     the hijri date rather than trust the arithmetic indefinitely.            */
  var LUNAR_DAYS = 354;

  /* ==========================================================================
     1. THE KHUMS YEAR
     ========================================================================== */

  /* The day the year closes next, counted from the day it last closed (or, in
     a first year, from the day the first income was received).               */
  function nextKhumsDay(from, calendar) {
    var d = new Date(from.getTime());
    if (calendar === "solar") {
      d.setFullYear(d.getFullYear() + 1);
    } else {
      d.setDate(d.getDate() + LUNAR_DAYS);
    }
    return d;
  }

  /* Whole days from one date to another, ignoring the time of day and leaving
     both arguments as they were found.                                      */
  function daysBetween(a, b) {
    var from = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    var to   = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((to - from) / 86400000);
  }

  /* ==========================================================================
     2. THE RULING ENGINE

     Input — everything measured on the khums day itself:

       currency     the symbol to print amounts with
       firstYear    khums has never been paid before
       assets       what is held on the day, from wealth not yet khumsed:
                      cash        cash in hand and current accounts
                      savings     savings, deposits, money set aside
                      owed        money lent out that can be recovered
                      investments shares, funds, gold or silver held as savings
                      capital     business capital, stock, tools of trade
                      property    land or property held as an investment
                      goods       bought this year and not yet used, at today's value
                      other       anything else held from this year's income
       deductions   what comes off again:
                      khumsed     wealth khums has already been paid on
                      exempt      mahr, valid inheritance, diyah, khums or zakat received
                      borrowed    money borrowed and still held — it is not profit
                      debts       debts owed which were incurred for living costs
                      other       anything else that should come off
       home         loan    outstanding balance of a loan taken to buy the home
                    offset  surplus already set against that loan in earlier years

     Output: the amount due, the two halves it divides into, the ledger behind
     it, the reasoning, and any cautions.
     ========================================================================== */

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function num(v) {
    var n = typeof v === "number" ? v : parseFloat(v);
    return isFinite(n) && n > 0 ? n : 0;
  }

  /* Money, without Intl — the engine is meant to run anywhere, including in a
     bare sandbox under node for the tests.                                   */
  function money(n, sym) {
    var neg = n < 0;
    var parts = Math.abs(round2(n)).toFixed(2).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "−" : "") + (sym || "") + parts.join(".");
  }

  var ASSET_LABELS = {
    cash:        "Cash and current accounts",
    savings:     "Savings and money set aside",
    owed:        "Money owed to you, recoverable",
    investments: "Shares, funds, gold held as savings",
    capital:     "Business capital, stock and tools",
    property:    "Property held as an investment",
    goods:       "Goods bought this year and not yet used",
    other:       "Other holdings"
  };

  var DEDUCTION_LABELS = {
    khumsed:  "Wealth already khumsed",
    exempt:   "Mahr, inheritance, diyah, khums or zakat received",
    borrowed: "Money borrowed and still held",
    debts:    "Debts owed for living costs",
    other:    "Other deductions"
  };

  function decide(o) {
    var sym      = o.currency || "";
    var assets   = o.assets || {};
    var deducts  = o.deductions || {};
    var home     = o.home || {};
    var reasons  = [];
    var warnings = [];
    var lines    = [];

    function tally(source, labels, sign) {
      var total = 0;
      Object.keys(labels).forEach(function (key) {
        var v = num(source[key]);
        if (v > 0) {
          total += v;
          lines.push({ key: key, label: labels[key], amount: v, sign: sign });
        }
      });
      return round2(total);
    }

    var assetsTotal  = tally(assets, ASSET_LABELS, "+");
    var deductsTotal = tally(deducts, DEDUCTION_LABELS, "−");

    var surplus = round2(assetsTotal - deductsTotal);

    /* -- the home loan ----------------------------------------------------- */
    /* A loan taken to buy the home one lives in may be set against the year's
       surplus — but only until the surplus set against it over the years has
       come to the size of the loan. So the relief is capped twice: by what is
       left of the loan, and by the surplus there is to set against it.       */
    var loanLeft = round2(Math.max(0, num(home.loan) - num(home.offset)));
    var relief   = round2(Math.min(loanLeft, Math.max(0, surplus)));
    if (relief > 0) {
      lines.push({
        key: "homeRelief", label: "Set against the loan on your home",
        amount: relief, sign: "−"
      });
    }

    var taxable   = round2(Math.max(0, surplus - relief));
    var khums     = round2(taxable * RATE);
    var sahmImam  = round2(khums / 2);
    var sahmSadat = round2(khums - sahmImam);   /* so the halves add up exactly */

    var result = {
      currency: sym,
      assetsTotal: assetsTotal,
      deductionsTotal: deductsTotal,
      homeLoanLeft: loanLeft,
      homeRelief: relief,
      homeOffsetAfter: round2(num(home.offset) + relief),
      surplus: surplus,
      taxable: taxable,
      khums: khums,
      sahmImam: sahmImam,
      sahmSadat: sahmSadat,
      rate: RATE,
      due: khums > 0,
      empty: assetsTotal === 0 && deductsTotal === 0,
      lines: lines,
      reasons: reasons,
      warnings: warnings,
      headline: "",
      sub: ""
    };

    if (result.empty) {
      result.headline = "Nothing entered yet";
      result.sub = "Fill in what you hold on your khums day and the fifth will be worked out from it.";
      return result;
    }

    /* -- the reasoning ----------------------------------------------------- */
    reasons.push(
      "On your khums day you hold <b>" + money(assetsTotal, sym) + "</b> of wealth that has " +
      "not yet been khumsed. What you spent during the year on a living befitting your " +
      "standing — food, rent, clothing, travel, medicine, gifts given, debts repaid — is " +
      "spent, and is counted no further."
    );

    if (deductsTotal > 0) {
      reasons.push(
        "Of that, <b>" + money(deductsTotal, sym) + "</b> is not liable: wealth khums has " +
        "already been paid on, wealth khums was never due on, money you have borrowed rather " +
        "than earned, and debts you owe for your living costs. That leaves <b>" +
        money(surplus, sym) + "</b>."
      );
    }

    if (relief > 0) {
      reasons.push(
        "A loan taken to buy the home you live in still stands at <b>" + money(loanLeft, sym) +
        "</b>, so <b>" + money(relief, sym) + "</b> of this year's surplus is set against it " +
        "and carries no khums."
      );
      warnings.push({
        kind: "info",
        text: "Keep a running total. The surplus set against a home loan is allowed until the " +
              "amount set aside over the years reaches the size of the loan; after that the " +
              "repayments of the capital are no longer deducted, though the interest on it is " +
              "still an expense of the year. After this year the running total stands at " +
              money(result.homeOffsetAfter, sym) + "."
      });
    }

    if (surplus <= 0) {
      reasons.push(
        "Nothing is left over: what comes off exceeds what you hold. <b>No khums is due this " +
        "year.</b> The shortfall does not carry forward — next year begins on its own terms."
      );
      result.headline = "No khums is due";
      result.sub = "Nothing remains from this year's income once what is not liable is taken out.";
    } else if (taxable <= 0) {
      reasons.push(
        "The whole of the surplus is set against the loan on your home, so <b>no khums is due " +
        "this year</b>."
      );
      result.headline = "No khums is due";
      result.sub = "This year's surplus is entirely set against the loan on the home you live in.";
    } else {
      reasons.push(
        "<b>" + money(taxable, sym) + "</b> remains. A fifth of it is khums: <b>" +
        money(khums, sym) + "</b>."
      );
      reasons.push(
        "The fifth divides in two. <b>" + money(sahmImam, sym) + "</b> is the share of the Imam " +
        "(peace be upon him), which is given to the marjaʻ or to whoever he has authorised, " +
        "or spent as he permits. <b>" + money(sahmSadat, sym) + "</b> is the share of the sayyids, " +
        "for a sayyid who is poor, or an orphan, or stranded on a journey."
      );
      result.headline = "Khums due: " + money(khums, sym);
      result.sub = "A fifth of " + money(taxable, sym) + " — half to the share of the Imam, half to the share of the sayyids.";
    }

    /* -- cautions ---------------------------------------------------------- */
    if (o.firstYear) {
      warnings.push({
        kind: "warn",
        text: "This is your first reckoning. Khums owed from earlier years cannot be guessed at: " +
              "settle it (<i>musalaha</i>) with the marjaʻ or his representative, who will " +
              "agree terms for what is past. Fix your khums day now — for someone on a salary it " +
              "is the day the first pay was received — and keep it."
      });
    }

    if (num(assets.goods) > 0) {
      warnings.push({
        kind: "info",
        text: "Provisions and goods bought from this year's income and still unused on the khums " +
              "day are valued at what they are worth now, not at what you paid. Things kept by " +
              "their nature for another season — winter coats put away in summer — are not " +
              "counted, nor is anything already put to use during the year, even if you no " +
              "longer need it."
      });
    }

    if (num(assets.capital) > 0) {
      warnings.push({
        kind: "warn",
        text: "Capital is not like household goods: stock, tools and the money in the business " +
              "are liable in full on the khums day. Where paying it at once would leave you " +
              "unable to earn a living befitting your standing, put the case to the marjaʻ's " +
              "office rather than deciding it yourself — terms can be arranged."
      });
    }

    if (num(assets.owed) > 0) {
      warnings.push({
        kind: "info",
        text: "Only money you can actually get back belongs in this year's reckoning. A debt you " +
              "cannot presently recover may be left out and counted in the year it comes back " +
              "to you."
      });
    }

    if (num(deducts.exempt) > 0) {
      warnings.push({
        kind: "info",
        text: "Mahr, an inheritance received by the recognised laws of inheritance, blood money, " +
              "and khums or zakat given to you carry no khums. But what they <i>earn</i> does: " +
              "the rent of an inherited house, or the profit of a business started with a gift, " +
              "is this year's income like any other. Two exceptions on inheritance: wealth left " +
              "by someone who had not paid khums on it, and an inheritance from a relation you " +
              "had no expectation of inheriting from — khums is due on both."
      });
    }

    if (num(deducts.khumsed) > 0) {
      warnings.push({
        kind: "info",
        text: "Keep the record. Wealth khums has been paid on is never liable again, however " +
              "many years it sits — but only what you can still identify as khumsed can be " +
              "taken out of a later reckoning."
      });
    }

    return result;
  }

  /* --------------------------------------------------------------------------
     The other six — minerals, treasure, diving, and lawful wealth mixed with
     unlawful. Each has its own threshold, and none of them waits for a khums
     year: they fall due when the thing is acquired.
     -------------------------------------------------------------------------- */
  function special(o) {
    var sym      = o.currency || "";
    var kind     = o.kind;
    var value    = num(o.value);
    var extract  = num(o.extractCost);
    var later    = num(o.laterCost);
    var reasons  = [];
    var warnings = [];

    var out = {
      kind: kind, currency: sym, value: value,
      net: 0, nisab: 0, meets: false, taxable: 0, khums: 0,
      sahmImam: 0, sahmSadat: 0,
      reasons: reasons, warnings: warnings, headline: "", sub: ""
    };

    if (!kind || kind === "none" || value <= 0) return out;

    /* Lawful wealth mixed with unlawful has no threshold. A fifth of the whole
       purifies it — but only where both the amount of the unlawful part and
       its owner are genuinely unknown.                                       */
    if (kind === "mixed") {
      out.net     = value;
      out.taxable = value;
      out.khums   = round2(value * RATE);
      out.meets   = true;
      reasons.push(
        "Lawful wealth mixed with unlawful, where neither the amount of the unlawful part nor " +
        "its owner can be known, is purified by khums: a fifth of the whole, <b>" +
        money(out.khums, sym) + "</b>. The remainder is then lawful to you."
      );
      out.headline = "Khums due: " + money(out.khums, sym);
      warnings.push({
        kind: "warn",
        text: "This applies only when both are unknown. If you know the amount but not the owner, " +
              "give that amount away on the owner's behalf, with the permission of the religious " +
              "authority — it is not khums. If you know the owner, it must be returned or " +
              "settled with him. And if what you pay as khums turns out to be less than the " +
              "unlawful part, the difference is still owed."
      });
    } else {
      /* Minerals, treasure and diving: the cost of getting the thing out comes
         off first, and it is what remains that must reach the threshold. Costs
         incurred after that — refining, cutting, carriage — come off before the
         fifth is taken.                                                      */
      var thresholds = NISAB[kind];
      if (!thresholds) return out;

      var candidates = [];
      if (thresholds.gold && num(o.goldPrice) > 0) {
        candidates.push({
          metal: "gold", grams: thresholds.gold,
          value: round2(thresholds.gold * num(o.goldPrice))
        });
      }
      if (thresholds.silver && num(o.silverPrice) > 0) {
        candidates.push({
          metal: "silver", grams: thresholds.silver,
          value: round2(thresholds.silver * num(o.silverPrice))
        });
      }
      if (!candidates.length) {
        out.headline = "The price of gold is needed";
        out.sub = "The threshold is set in weights of coined gold and silver, so a price per gram " +
                  "is needed before it can be compared with what you have.";
        return out;
      }

      /* Where the law names two thresholds, reaching either one is enough — so
         the lower of them is the one that binds.                             */
      candidates.sort(function (a, b) { return a.value - b.value; });
      var bound = candidates[0];

      out.net     = round2(value - extract);
      out.nisab   = bound.value;
      out.nisabOf = bound;
      out.meets   = out.net >= bound.value;
      out.taxable = round2(Math.max(0, out.net - later));
      out.khums   = out.meets ? round2(out.taxable * RATE) : 0;

      var named = {
        mineral:  "15 mithqāl of coined gold",
        treasure: "105 mithqāl of silver or 15 mithqāl of gold, whichever is reached first",
        diving:   "18 nukhud of gold — one dinar"
      }[kind];

      reasons.push(
        "The threshold here is <b>" + named + "</b>: " + bound.grams.toFixed(3).replace(/\.?0+$/, "") +
        " g of " + bound.metal + ", which at the price you gave comes to <b>" +
        money(bound.value, sym) + "</b>."
      );
      reasons.push(
        "What you have is worth " + money(value, sym) +
        (extract > 0 ? ", less " + money(extract, sym) + " spent getting it out, leaving <b>" + money(out.net, sym) + "</b>" : "") +
        ". That " + (out.meets ? "reaches" : "falls short of") + " the threshold."
      );

      if (out.meets) {
        if (later > 0) {
          reasons.push(
            "Costs incurred after that — " + money(later, sym) + " — come off before the " +
            "fifth is taken, leaving <b>" + money(out.taxable, sym) + "</b>."
          );
        }
        reasons.push("A fifth is due: <b>" + money(out.khums, sym) + "</b>, payable now rather than at the year's end.");
        out.headline = "Khums due: " + money(out.khums, sym);
      } else {
        reasons.push("<b>No khums is due on it.</b>");
        out.headline = "Below the threshold";
      }

      if (kind === "treasure") {
        warnings.push({
          kind: "warn",
          text: "Treasure found on land that belongs to someone else, or which you bought from " +
                "someone, is not simply yours: the owner — or the previous owners in turn — " +
                "must be asked first, and only if none of them claims it does it become yours " +
                "and liable to khums."
        });
      }
      if (kind === "mineral") {
        warnings.push({
          kind: "info",
          text: "Where several people extract together, the threshold is judged against each " +
                "person's share, not the whole. What is taken out of one mine over a period is " +
                "added together even if the work stopped in between."
        });
      }
    }

    out.sahmImam  = round2(out.khums / 2);
    out.sahmSadat = round2(out.khums - out.sahmImam);
    if (!out.sub && out.khums > 0) {
      out.sub = "Half to the share of the Imam, half to the share of the sayyids — " +
                money(out.sahmImam, sym) + " each.";
    }
    return out;
  }

  /* ==========================================================================
     3. THE INTERFACE
     ========================================================================== */

  var ASSET_KEYS    = ["cash", "savings", "owed", "investments", "capital", "property", "goods", "other"];
  var DEDUCT_KEYS   = ["khumsed", "exempt", "borrowed", "debts", "other"];
  var STORE_KEY     = "khums.workbook.v1";

  function $(id) { return document.getElementById(id); }

  function symbol() {
    var sel = $("currency");
    if (!sel) return "";
    if (sel.value === "other") {
      var custom = ($("currencyOther").value || "").trim();
      return custom ? custom + " " : "";
    }
    return sel.value;
  }

  function read(id) {
    var el = $(id);
    return el ? el.value : "";
  }

  function gather() {
    var assets = {}, deductions = {};
    ASSET_KEYS.forEach(function (k) { assets[k] = read("a_" + k); });
    DEDUCT_KEYS.forEach(function (k) { deductions[k] = read("d_" + k); });
    return {
      currency: symbol(),
      firstYear: $("firstYear").checked,
      assets: assets,
      deductions: deductions,
      home: { loan: read("h_loan"), offset: read("h_offset") }
    };
  }

  function gatherSpecial() {
    return {
      currency: symbol(),
      kind: read("sKind"),
      value: read("sValue"),
      extractCost: read("sExtract"),
      laterCost: read("sLater"),
      goldPrice: read("goldPrice"),
      silverPrice: read("silverPrice")
    };
  }

  /* ---- rendering -------------------------------------------------------- */

  function row(label, amount, sym, cls) {
    var div = document.createElement("div");
    if (cls) div.className = cls;
    var dt = document.createElement("dt");
    dt.textContent = label;
    var dd = document.createElement("dd");
    dd.textContent = amount === null ? "" : money(amount, sym);
    div.appendChild(dt);
    div.appendChild(dd);
    return div;
  }

  function renderLedger(res) {
    var host = $("ledger");
    host.innerHTML = "";
    var sym = res.currency;

    /* The relief on a home loan is a deduction, but it is not one of the
       figures the payer entered as such — it is shown on its own, after the
       deductions have been totalled.                                        */
    var plus  = res.lines.filter(function (l) { return l.sign === "+"; });
    var minus = res.lines.filter(function (l) { return l.sign === "−" && l.key !== "homeRelief"; });

    plus.forEach(function (l) { host.appendChild(row(l.label, l.amount, sym)); });
    if (plus.length) host.appendChild(row("What you hold", res.assetsTotal, sym, "is-sub"));

    minus.forEach(function (l) {
      host.appendChild(row(l.label, -l.amount, sym, "is-minus"));
    });
    if (minus.length) {
      host.appendChild(row("What comes off", -res.deductionsTotal, sym, "is-sub"));
    }
    if (res.homeRelief > 0) {
      host.appendChild(row("Set against the loan on your home", -res.homeRelief, sym, "is-minus"));
    }
    if (res.surplus < 0) {
      host.appendChild(row("What is left", res.surplus, sym, "is-sub"));
    }

    host.appendChild(row("Liable surplus", res.taxable, sym, "is-total"));
    host.appendChild(row("Khums — one fifth", res.khums, sym, "is-total is-khums"));
  }

  function renderHalves(res) {
    var host = $("halves");
    host.innerHTML = "";
    if (!res.due) { host.hidden = true; return; }
    host.hidden = false;

    [
      {
        label: "Share of the Imam (a.s.)", amount: res.sahmImam,
        note: "To the marjaʻ, or to whoever he has authorised to receive it, or spent on what he permits."
      },
      {
        label: "Share of the sayyids", amount: res.sahmSadat,
        note: "To a sayyid — by descent through the father — who is poor, or an orphan, or stranded on a journey."
      }
    ].forEach(function (half) {
      var card = document.createElement("div");
      card.className = "half";
      card.innerHTML =
        '<p class="half__label"></p><p class="half__amount"></p><p class="half__note"></p>';
      card.querySelector(".half__label").textContent  = half.label;
      card.querySelector(".half__amount").textContent = money(half.amount, res.currency);
      card.querySelector(".half__note").textContent   = half.note;
      host.appendChild(card);
    });
  }

  function renderList(host, items) {
    host.innerHTML = "";
    items.forEach(function (text) {
      var li = document.createElement("li");
      li.innerHTML = text;
      host.appendChild(li);
    });
  }

  function renderWarnings(host, warnings) {
    host.innerHTML = "";
    warnings.forEach(function (w) {
      var p = document.createElement("p");
      p.className = "note" + (w.kind === "info" ? " note--info" : "");
      p.innerHTML = "<b>" + (w.kind === "info" ? "Note" : "Take care") + ".</b> " + w.text;
      host.appendChild(p);
    });
  }

  /* The khums day itself: when the year closes next, and how long there is. */
  function renderYear() {
    var host = $("yearNote");
    var value = read("khumsDate");
    if (!value) { host.textContent = ""; return; }

    var parts = value.split("-");
    var day = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    if (isNaN(day.getTime())) { host.textContent = ""; return; }

    var calendar = document.querySelector('input[name="calendar"]:checked').value;
    var next = nextKhumsDay(day, calendar);
    var left = daysBetween(new Date(), next);
    var fmt = function (d) {
      return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
    };

    host.innerHTML =
      "Counting a " + (calendar === "solar" ? "solar" : "lunar") + " year from " + fmt(day) +
      ", your year closes next on <b>" + fmt(next) + "</b>" +
      (left > 0 ? " — " + left + " day" + (left === 1 ? "" : "s") + " away."
                : left === 0 ? " — today." : ". That day has passed; reckon from it and set the next one.") +
      (calendar === "lunar"
        ? " The lunar year is counted here as 354 days, which drifts by about a third of a day a " +
          "year; keep the hijri date itself and the drift never matters."
        : "");
  }

  function renderSpecial() {
    var kind = read("sKind");
    var card = $("specialResult");
    if (!kind || kind === "none") { card.hidden = true; return; }

    var res = special(gatherSpecial());
    if (!res.headline) { card.hidden = true; return; }

    card.hidden = false;
    $("specialLabel").textContent = res.headline;
    $("specialSub").textContent = res.sub || "";
    $("specialVerdict").classList.toggle("verdict--none", !res.khums);
    renderList($("specialReasons"), res.reasons);
    renderWarnings($("specialWarnings"), res.warnings);
  }

  function render() {
    var res = decide(gather());

    $("verdictLabel").textContent = res.headline;
    $("verdictSub").textContent   = res.sub;
    $("verdict").classList.toggle("verdict--none", !res.due);

    renderLedger(res);
    renderHalves(res);
    renderList($("reasons"), res.reasons);
    renderWarnings($("warnings"), res.warnings);
    renderYear();
    renderSpecial();
    return res;
  }

  /* ---- saving ----------------------------------------------------------- */
  /* The workbook stays in this browser. Nothing is sent anywhere — there is no
     server to send it to — but a shared computer is a shared computer, which
     is why "Forget everything" is next to the buttons that use it.          */

  function fields() {
    var ids = ["currency", "currencyOther", "khumsDate", "sKind", "sValue", "sExtract",
               "sLater", "goldPrice", "silverPrice", "h_loan", "h_offset"];
    ASSET_KEYS.forEach(function (k) { ids.push("a_" + k); });
    DEDUCT_KEYS.forEach(function (k) { ids.push("d_" + k); });
    return ids;
  }

  function save() {
    try {
      var data = { v: 1, values: {}, firstYear: $("firstYear").checked };
      fields().forEach(function (id) { data.values[id] = read(id); });
      var cal = document.querySelector('input[name="calendar"]:checked');
      if (cal) data.calendar = cal.value;
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) { /* private browsing, or storage full — the page still works */ }
  }

  function restore() {
    var data;
    try { data = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); }
    catch (e) { return false; }
    if (!data || !data.values) return false;

    fields().forEach(function (id) {
      var el = $(id);
      if (el && typeof data.values[id] === "string") el.value = data.values[id];
    });
    $("firstYear").checked = !!data.firstYear;
    if (data.calendar) {
      var cal = document.querySelector('input[name="calendar"][value="' + data.calendar + '"]');
      if (cal) cal.checked = true;
    }
    return true;
  }

  function forget() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  /* ---- wiring ----------------------------------------------------------- */

  function applySymbol() {
    var sym = symbol().trim();
    Array.prototype.forEach.call(document.querySelectorAll(".money__sym"), function (el) {
      el.textContent = sym;
    });
    $("currencyOther").hidden = $("currency").value !== "other";
  }

  function applySpecialKind() {
    var kind = read("sKind");
    var on   = kind && kind !== "none";
    $("specialFields").hidden = !on;
    $("specialPrices").hidden = !on || kind === "mixed";
    $("specialCosts").hidden  = !on || kind === "mixed";

    var label = {
      mineral:  "Value of what you extracted",
      treasure: "Value of the treasure",
      diving:   "Value of what you brought up",
      mixed:    "The whole of the mixed wealth"
    }[kind];
    if (label) $("sValueLabel").textContent = label;
  }

  function init() {
    if (!$("khumsForm")) return;

    var shown = false;
    var saveSoon = (function () {
      var t = null;
      return function () { clearTimeout(t); t = setTimeout(save, 400); };
    })();

    function update() {
      if (shown) render();
      saveSoon();
    }

    $("khumsForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var res = render();
      shown = true;
      $("result").hidden = false;
      $("status").textContent = res.empty
        ? "Nothing has been entered yet — fill in what you hold on your khums day."
        : "";
      $("status").classList.toggle("status--err", res.empty);
      if (!res.empty) $("result").scrollIntoView({ behavior: "smooth", block: "start" });
      save();
    });

    $("khumsForm").addEventListener("input", update);
    $("khumsForm").addEventListener("change", function (e) {
      if (e.target.id === "currency" || e.target.id === "currencyOther") applySymbol();
      if (e.target.id === "sKind") applySpecialKind();
      update();
    });

    $("resetBtn").addEventListener("click", function () {
      $("khumsForm").reset();
      applySymbol();
      applySpecialKind();
      $("result").hidden = true;
      $("status").textContent = "";
      shown = false;
      save();
    });

    $("forgetBtn").addEventListener("click", function () {
      forget();
      $("khumsForm").reset();
      applySymbol();
      applySpecialKind();
      $("result").hidden = true;
      shown = false;
      $("status").textContent = "Cleared. Nothing of this workbook is left in this browser.";
      $("status").classList.remove("status--err");
    });

    $("printBtn").addEventListener("click", function () { window.print(); });

    /* The save above is debounced, so a tab closed a moment after typing would
       otherwise lose the last figure entered.                               */
    window.addEventListener("pagehide", save);

    restore();
    applySymbol();
    applySpecialKind();
    renderYear();
  }

  /* The ruling engine is exported so it can be exercised on its own — see
     test/engine.test.js. Nothing in the interface reads it back.             */
  if (typeof window !== "undefined") {
    window.KhumsEngine = {
      decide: decide, special: special, money: money,
      nextKhumsDay: nextKhumsDay, daysBetween: daysBetween,
      RATE: RATE, NISAB: NISAB, MITHQAL_G: MITHQAL_G, NUKHUD_G: NUKHUD_G
    };
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})();
