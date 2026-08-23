/* ============================================================================
   Tests for the ruling engine in qasr.js — run with:  node test/engine.test.js
   The engine is a pure function, so no browser and no network are needed; the
   few globals it touches are stubbed below.
   ========================================================================== */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");
var assert = require("assert");

/* --- load qasr.js with just enough of a browser around it ----------------- */
var sandbox = {
  window: {},
  document: {
    readyState: "complete",
    getElementById: function () { return null; },
    addEventListener: function () {}
  },
  fetch: function () { return Promise.reject(new Error("no network in tests")); },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  console: console
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "qasr.js"), "utf8"), sandbox);

var decide = sandbox.window.QasrEngine.decide;
var LIMIT = sandbox.window.QasrEngine.LIMIT_KM;

/* --- helpers -------------------------------------------------------------- */
function journey(over) {
  return Object.assign({
    oneWayKm: 0,
    edgeKm: 0,
    roundTrip: true,
    intendedFromStart: true,
    destIsWatan: false,
    tenDays: false,
    hesitant: false,
    passesWatan: false,
    frequentTraveller: false,
    sinful: false
  }, over);
}

var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok   " + name); }
  catch (err) { failed++; console.log("  FAIL " + name + "\n       " + err.message); }
}

/* --- the legal distance --------------------------------------------------- */
console.log("\nThe legal distance (8 farsakh = " + LIMIT + " km)");

test("the limit is 44 km", function () {
  assert.strictEqual(LIMIT, 44);
});

test("60 km one way, not returning — a journey", function () {
  var v = decide(journey({ oneWayKm: 60, roundTrip: false }));
  assert.strictEqual(v.enRoute, "qasr");
  assert.strictEqual(v.atDest, "qasr");
});

test("25 km one way, not returning — short of the limit", function () {
  var v = decide(journey({ oneWayKm: 25, roundTrip: false }));
  assert.strictEqual(v.enRoute, "full");
  assert.strictEqual(v.atDest, "full");
});

test("30 km each way, returning — 60 km counted, a journey", function () {
  var v = decide(journey({ oneWayKm: 30 }));
  assert.strictEqual(v.metrics.countedKm, 60);
  assert.strictEqual(v.enRoute, "qasr");
});

test("20 km each way, returning — 40 km counted, short", function () {
  var v = decide(journey({ oneWayKm: 20 }));
  assert.strictEqual(v.metrics.countedKm, 40);
  assert.strictEqual(v.enRoute, "full");
});

test("exactly 22 km each way, returning — meets the limit", function () {
  var v = decide(journey({ oneWayKm: 22 }));
  assert.strictEqual(v.metrics.countedKm, 44);
  assert.strictEqual(v.metrics.meets, true);
  assert.strictEqual(v.enRoute, "qasr");
});

test("the distance to the edge of town is deducted from each leg", function () {
  var v = decide(journey({ oneWayKm: 26, edgeKm: 5 }));   /* 21 + 21 = 42 */
  assert.strictEqual(v.metrics.legKm, 21);
  assert.strictEqual(v.metrics.countedKm, 42);
  assert.strictEqual(v.enRoute, "full");
});

test("a deduction larger than the journey does not go negative", function () {
  var v = decide(journey({ oneWayKm: 3, edgeKm: 5 }));
  assert.strictEqual(v.metrics.legKm, 0);
  assert.strictEqual(v.metrics.countedKm, 0);
});

/* --- the destination ------------------------------------------------------ */
console.log("\nWhat happens at the destination");

test("a hometown at the end: shorten on the road, full on arrival", function () {
  var v = decide(journey({ oneWayKm: 100, roundTrip: false, destIsWatan: true }));
  assert.strictEqual(v.enRoute, "qasr");
  assert.strictEqual(v.atDest, "full");
});

test("an intention of ten days: shorten on the road, full on arrival", function () {
  var v = decide(journey({ oneWayKm: 100, roundTrip: false, tenDays: true }));
  assert.strictEqual(v.enRoute, "qasr");
  assert.strictEqual(v.atDest, "full");
});

test("an undecided stay: shorten, for up to thirty days", function () {
  var v = decide(journey({ oneWayKm: 100, roundTrip: false, hesitant: true }));
  assert.strictEqual(v.atDest, "qasr-30");
});

test("a short journey to a hometown is still full both ways", function () {
  var v = decide(journey({ oneWayKm: 10, destIsWatan: true }));
  assert.strictEqual(v.enRoute, "full");
  assert.strictEqual(v.atDest, "full");
});

/* --- the exemptions ------------------------------------------------------- */
console.log("\nWhere the rulings of travel do not apply");

test("a sinful purpose overrides the distance", function () {
  var v = decide(journey({ oneWayKm: 500, roundTrip: false, sinful: true }));
  assert.strictEqual(v.enRoute, "full");
  assert.strictEqual(v.atDest, "full");
});

test("one whose work is travel prays in full", function () {
  var v = decide(journey({ oneWayKm: 500, roundTrip: false, frequentTraveller: true }));
  assert.strictEqual(v.enRoute, "full");
  assert.strictEqual(v.atDest, "full");
});

test("a sinful purpose is judged before the occupation", function () {
  var v = decide(journey({ oneWayKm: 500, roundTrip: false, sinful: true, frequentTraveller: true }));
  assert.ok(/unlawful/.test(v.reasons[0]));
});

/* --- the intention -------------------------------------------------------- */
console.log("\nThe intention at the outset");

test("without intention from the start, one is not yet a traveller", function () {
  var v = decide(journey({ oneWayKm: 200, roundTrip: false, intendedFromStart: false }));
  assert.strictEqual(v.enRoute, "full");
  assert.strictEqual(v.atDest, "full");
  assert.ok(v.warnings.some(function (w) { return /counted afresh|from there|starting point/.test(w.text); }));
});

test("a short journey without intention needs no restart warning", function () {
  var v = decide(journey({ oneWayKm: 5, intendedFromStart: false }));
  assert.strictEqual(v.enRoute, "full");
});

/* --- interruptions and cautions ------------------------------------------- */
console.log("\nInterruptions and cautions");

test("stopping in a hometown on the way flags the verdict as provisional", function () {
  var v = decide(journey({ oneWayKm: 200, roundTrip: false, passesWatan: true }));
  assert.strictEqual(v.enRoute, "qasr");
  assert.ok(v.warnings.some(function (w) { return /provisional/.test(w.text); }));
});

test("a distance sitting on the limit raises a caution", function () {
  var v = decide(journey({ oneWayKm: 44.5, roundTrip: false }));
  assert.ok(v.warnings.some(function (w) { return /precaution/.test(w.text); }));
});

test("a distance just under the limit raises the same caution", function () {
  var v = decide(journey({ oneWayKm: 43, roundTrip: false }));
  assert.strictEqual(v.enRoute, "full");
  assert.ok(v.warnings.some(function (w) { return /precaution/.test(w.text); }));
});

test("a distance far from the limit raises no caution", function () {
  var v = decide(journey({ oneWayKm: 200, roundTrip: false }));
  assert.ok(!v.warnings.some(function (w) { return /precaution/.test(w.text); }));
});

/* --- shape of the result -------------------------------------------------- */
console.log("\nThe shape of the result");

test("every verdict carries a headline, reasons and metrics", function () {
  [journey({ oneWayKm: 5 }), journey({ oneWayKm: 100 }), journey({ oneWayKm: 100, sinful: true })]
    .forEach(function (j) {
      var v = decide(j);
      assert.ok(v.headline.length > 0);
      assert.ok(v.sub.length > 0);
      assert.ok(v.reasons.length > 0);
      assert.ok(typeof v.metrics.countedKm === "number");
      assert.ok(["qasr", "full"].indexOf(v.enRoute) >= 0);
      assert.ok(["qasr", "qasr-30", "full"].indexOf(v.atDest) >= 0);
    });
});

console.log("\n" + passed + " passed, " + failed + " failed\n");
process.exit(failed ? 1 : 0);
