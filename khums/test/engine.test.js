/* ============================================================================
   Tests for the ruling engine in khums.js — run with:  node test/engine.test.js
   The engine is a set of pure functions, so no browser and no network are
   needed; the few globals it touches are stubbed below.
   ========================================================================== */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");
var assert = require("assert");

/* --- load khums.js with just enough of a browser around it ---------------- */
var sandbox = {
  window: {},
  document: {
    readyState: "complete",
    getElementById: function () { return null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    addEventListener: function () {}
  },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  console: console
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "khums.js"), "utf8"), sandbox);

var E = sandbox.window.KhumsEngine;
var decide = E.decide;
var special = E.special;

/* --- helpers -------------------------------------------------------------- */
function holdings(assets, deductions, extra) {
  return Object.assign({
    currency: "£",
    firstYear: false,
    assets: Object.assign({
      cash: 0, savings: 0, owed: 0, investments: 0,
      capital: 0, property: 0, goods: 0, other: 0
    }, assets || {}),
    deductions: Object.assign({
      khumsed: 0, exempt: 0, borrowed: 0, debts: 0, other: 0
    }, deductions || {}),
    home: { loan: 0, offset: 0 }
  }, extra || {});
}

function warned(res, fragment) {
  return res.warnings.some(function (w) { return w.text.indexOf(fragment) !== -1; });
}

var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok   " + name); }
  catch (err) { failed++; console.log("  FAIL " + name + "\n       " + err.message); }
}

/* --- the fifth ------------------------------------------------------------ */
console.log("\nThe fifth");

test("the rate is one fifth", function () {
  assert.strictEqual(E.RATE, 1 / 5);
});

test("a clean surplus is taxed at twenty per cent", function () {
  var r = decide(holdings({ cash: 1000 }));
  assert.strictEqual(r.taxable, 1000);
  assert.strictEqual(r.khums, 200);
  assert.strictEqual(r.due, true);
});

test("assets are added across every heading", function () {
  var r = decide(holdings({
    cash: 100, savings: 200, owed: 50, investments: 150,
    capital: 400, property: 1000, goods: 75, other: 25
  }));
  assert.strictEqual(r.assetsTotal, 2000);
  assert.strictEqual(r.khums, 400);
});

test("deductions come off before the fifth is taken", function () {
  var r = decide(holdings({ cash: 5000 }, { khumsed: 1000, exempt: 500, borrowed: 400, debts: 100 }));
  assert.strictEqual(r.deductionsTotal, 2000);
  assert.strictEqual(r.taxable, 3000);
  assert.strictEqual(r.khums, 600);
});

test("nothing is due when the deductions swallow the holdings", function () {
  var r = decide(holdings({ cash: 900 }, { debts: 1500 }));
  assert.strictEqual(r.due, false);
  assert.strictEqual(r.khums, 0);
  assert.strictEqual(r.taxable, 0);
  assert.strictEqual(r.headline, "No khums is due");
});

test("a shortfall does not become a negative charge", function () {
  var r = decide(holdings({ cash: 10 }, { debts: 1000 }));
  assert.ok(r.surplus < 0, "the surplus itself is honest about the shortfall");
  assert.strictEqual(r.khums, 0);
});

test("an empty form is not a verdict", function () {
  var r = decide(holdings());
  assert.strictEqual(r.empty, true);
  assert.strictEqual(r.reasons.length, 0);
});

/* --- the two halves ------------------------------------------------------- */
console.log("\nThe two halves");

test("the fifth divides in two", function () {
  var r = decide(holdings({ cash: 1000 }));
  assert.strictEqual(r.sahmImam, 100);
  assert.strictEqual(r.sahmSadat, 100);
});

test("an odd penny does not go missing between the halves", function () {
  var r = decide(holdings({ cash: 333.33 }));      /* khums = 66.666 -> 66.67 */
  assert.strictEqual(r.khums, 66.67);
  assert.strictEqual(r.sahmImam + r.sahmSadat, r.khums);
});

test("the halves are zero when nothing is due", function () {
  var r = decide(holdings({ cash: 100 }, { khumsed: 100 }));
  assert.strictEqual(r.sahmImam, 0);
  assert.strictEqual(r.sahmSadat, 0);
});

/* --- the home loan -------------------------------------------------------- */
console.log("\nThe loan on the home");

test("surplus is set against an outstanding home loan", function () {
  var r = decide(holdings({ savings: 5000 }, {}, { home: { loan: 80000, offset: 0 } }));
  assert.strictEqual(r.homeRelief, 5000);
  assert.strictEqual(r.khums, 0);
  assert.strictEqual(r.homeOffsetAfter, 5000);
});

test("the relief is capped by what is left of the loan", function () {
  var r = decide(holdings({ savings: 5000 }, {}, { home: { loan: 8000, offset: 6000 } }));
  assert.strictEqual(r.homeLoanLeft, 2000);
  assert.strictEqual(r.homeRelief, 2000);
  assert.strictEqual(r.taxable, 3000);
  assert.strictEqual(r.khums, 600);
});

test("a loan already covered gives no further relief", function () {
  var r = decide(holdings({ savings: 5000 }, {}, { home: { loan: 8000, offset: 8000 } }));
  assert.strictEqual(r.homeRelief, 0);
  assert.strictEqual(r.khums, 1000);
});

test("relief is never granted against a shortfall", function () {
  var r = decide(holdings({ cash: 100 }, { debts: 900 }, { home: { loan: 50000, offset: 0 } }));
  assert.strictEqual(r.homeRelief, 0);
  assert.strictEqual(r.khums, 0);
});

test("the running total to carry forward is reported", function () {
  var r = decide(holdings({ savings: 3000 }, {}, { home: { loan: 20000, offset: 4000 } }));
  assert.strictEqual(r.homeOffsetAfter, 7000);
  assert.ok(warned(r, "Keep a running total"));
});

/* --- cautions ------------------------------------------------------------- */
console.log("\nCautions");

test("a first reckoning is sent to settle the past", function () {
  var r = decide(holdings({ cash: 1000 }, {}, { firstYear: true }));
  assert.ok(warned(r, "musalaha"));
});

test("capital is flagged rather than quietly relieved", function () {
  var r = decide(holdings({ capital: 20000 }));
  assert.strictEqual(r.khums, 4000, "no relief is applied on the payer's own say-so");
  assert.ok(warned(r, "Capital is not like household goods"));
});

test("unused goods carry the note on how they are valued", function () {
  var r = decide(holdings({ goods: 300 }));
  assert.ok(warned(r, "valued at what they are worth now"));
});

test("exempt wealth carries the note that its earnings are not exempt", function () {
  var r = decide(holdings({ cash: 5000 }, { exempt: 2000 }));
  assert.ok(warned(r, "But what they <i>earn</i> does"));
});

test("money lent out carries the note about recovery", function () {
  var r = decide(holdings({ owed: 800 }));
  assert.ok(warned(r, "cannot presently recover"));
});

/* --- reading the input ---------------------------------------------------- */
console.log("\nReading the input");

test("blank and junk fields count as nothing, not as NaN", function () {
  var r = decide(holdings({ cash: "", savings: "  ", owed: "abc", investments: "1000" }));
  assert.strictEqual(r.assetsTotal, 1000);
  assert.strictEqual(r.khums, 200);
});

test("a negative figure is not allowed to work backwards", function () {
  var r = decide(holdings({ cash: 1000, savings: -500 }));
  assert.strictEqual(r.assetsTotal, 1000);
});

test("the pennies do not drift", function () {
  var r = decide(holdings({ cash: 0.1, savings: 0.2 }));
  assert.strictEqual(r.assetsTotal, 0.3);
  assert.strictEqual(r.khums, 0.06);
});

test("the ledger names every figure entered, and only those", function () {
  var r = decide(holdings({ cash: 100, goods: 50 }, { debts: 25 }));
  /* Joined rather than compared as arrays: these were built inside the vm
     context, so they are not reference-equal to an array built out here.    */
  assert.strictEqual(r.lines.map(function (l) { return l.key; }).join(","), "cash,goods,debts");
  assert.strictEqual(r.lines.map(function (l) { return l.sign; }).join(""), "++−");
});

/* --- money ---------------------------------------------------------------- */
console.log("\nPrinting money");

test("thousands are grouped and pennies kept", function () {
  assert.strictEqual(E.money(1234567.5, "£"), "£1,234,567.50");
  assert.strictEqual(E.money(0, "£"), "£0.00");
  assert.strictEqual(E.money(-42, "£"), "−£42.00");
});

/* --- the khums year ------------------------------------------------------- */
console.log("\nThe khums year");

test("a lunar year is 354 days on", function () {
  var next = E.nextKhumsDay(new Date(2026, 0, 1), "lunar");
  assert.strictEqual(E.daysBetween(new Date(2026, 0, 1), next), 354);
});

test("a solar year lands on the same date", function () {
  var next = E.nextKhumsDay(new Date(2026, 2, 15), "solar");
  assert.strictEqual(next.getFullYear(), 2027);
  assert.strictEqual(next.getMonth(), 2);
  assert.strictEqual(next.getDate(), 15);
});

test("counting the days does not disturb the dates given", function () {
  var a = new Date(2026, 0, 1, 13, 30), b = new Date(2026, 0, 11, 2, 0);
  assert.strictEqual(E.daysBetween(a, b), 10);
  assert.strictEqual(a.getHours(), 13, "the argument is left as it was found");
  assert.strictEqual(b.getHours(), 2);
});

/* --- the other six -------------------------------------------------------- */
console.log("\nThe other kinds of khums");

test("the thresholds are the weights the law names", function () {
  assert.strictEqual(E.MITHQAL_G, 4.608);
  assert.ok(Math.abs(E.NISAB.mineral.gold - 69.12) < 1e-9, "15 mithqal of gold");
  assert.ok(Math.abs(E.NISAB.treasure.silver - 483.84) < 1e-9, "105 mithqal of silver");
  assert.ok(Math.abs(E.NISAB.diving.gold - 3.456) < 1e-9, "18 nukhud of gold");
});

test("a mine below the threshold bears nothing", function () {
  var r = special({ kind: "mineral", value: 4000, goldPrice: 60, currency: "£" });
  assert.strictEqual(r.nisab, 4147.2);          /* 69.12 g at 60 */
  assert.strictEqual(r.meets, false);
  assert.strictEqual(r.khums, 0);
});

test("a mine above the threshold bears a fifth of what is left", function () {
  var r = special({ kind: "mineral", value: 10000, extractCost: 1000, laterCost: 500, goldPrice: 60 });
  assert.strictEqual(r.net, 9000);
  assert.strictEqual(r.meets, true);
  assert.strictEqual(r.taxable, 8500);
  assert.strictEqual(r.khums, 1700);
});

test("the threshold is measured after the cost of extraction, not before", function () {
  var r = special({ kind: "mineral", value: 5000, extractCost: 2000, goldPrice: 60 });
  assert.strictEqual(r.net, 3000);
  assert.strictEqual(r.meets, false, "5,000 clears 4,147.20 but 3,000 does not");
  assert.strictEqual(r.khums, 0);
});

test("a treasure is judged by whichever threshold is reached first", function () {
  var r = special({ kind: "treasure", value: 1000, goldPrice: 60, silverPrice: 0.7 });
  assert.ok(Math.abs(r.nisab - 338.69) < 0.01, "483.84 g of silver at 0.70 is the lower");
  assert.strictEqual(r.nisabOf.metal, "silver");
  assert.strictEqual(r.meets, true);
  assert.strictEqual(r.khums, 200);
});

test("diving is judged against one dinar of gold", function () {
  var r = special({ kind: "diving", value: 250, goldPrice: 60 });
  assert.ok(Math.abs(r.nisab - 207.36) < 1e-9, "3.456 g at 60");
  assert.strictEqual(r.meets, true);
  assert.strictEqual(r.khums, 50);
});

test("without a metal price no threshold can be compared", function () {
  var r = special({ kind: "mineral", value: 10000 });
  assert.strictEqual(r.khums, 0);
  assert.ok(r.headline.indexOf("price of gold") !== -1);
});

test("mixed wealth is purified by a fifth of the whole, with no threshold", function () {
  var r = special({ kind: "mixed", value: 2500, currency: "£" });
  assert.strictEqual(r.khums, 500);
  assert.strictEqual(r.sahmImam, 250);
  assert.strictEqual(r.headline, "Khums due: £500.00", "a verdict with no headline never reaches the page");
  assert.ok(r.warnings.some(function (w) { return w.text.indexOf("only when both are unknown") !== -1; }));
});

test("no other kind chosen means no second verdict", function () {
  var r = special({ kind: "none", value: 5000 });
  assert.strictEqual(r.khums, 0);
  assert.strictEqual(r.headline, "");
});

/* --- a worked case -------------------------------------------------------- */
console.log("\nA worked case");

test("a household year end", function () {
  /* £4,200 in the bank, £600 of savings certificates, £180 of provisions
     still in the cupboard; of that, £1,500 was khumsed two years ago and
     £800 came as an inheritance. £300 is owed to a relative for the car
     repair. No home loan.                                                   */
  var r = decide(holdings(
    { cash: 4200, investments: 600, goods: 180 },
    { khumsed: 1500, exempt: 800, debts: 300 }
  ));
  assert.strictEqual(r.assetsTotal, 4980);
  assert.strictEqual(r.deductionsTotal, 2600);
  assert.strictEqual(r.taxable, 2380);
  assert.strictEqual(r.khums, 476);
  assert.strictEqual(r.sahmImam, 238);
  assert.strictEqual(r.sahmSadat, 238);
  assert.strictEqual(r.headline, "Khums due: £476.00");
});

/* --- done ----------------------------------------------------------------- */
console.log("\n" + passed + " passed, " + failed + " failed\n");
process.exit(failed ? 1 : 0);
