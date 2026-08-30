/* ============================================================================
   Tests for the reading engine — run with:  node psyche/test/engine.test.js
   The engine is pure, so there is no browser and no network to stand up.
   ========================================================================== */
"use strict";

var assert = require("assert");
var E = require("../engine.js");

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; }
  catch (err) {
    console.error("FAIL: " + name);
    console.error("      " + err.message);
    process.exitCode = 1;
  }
}

/* Answer a session mechanically, choosing options by id where given. */
function session(account, picks) {
  var state = { account: account || "", answers: {} };
  for (var i = 0; i < 12; i++) {
    var q = E.nextQuestion(state);
    if (!q) break;
    if (Object.prototype.hasOwnProperty.call(picks, q.id)) {
      var p = picks[q.id];
      state.answers[q.id] = q.kind === "text" ? { text: p } : { optionId: p };
    } else if (q.kind === "text") {
      state.answers[q.id] = { text: "" };
    } else {
      state.answers[q.id] = { optionId: q.options[0].id };
    }
  }
  return state;
}

function topId(state) { return E.read(state).readings[0].id; }

/* ---- 1. reading the free text ------------------------------------------ */

test("contempt words raise contempt and moralising", function () {
  var r = E.readText("He was so smug about it, I can't stand him.");
  assert.ok(r.signals.contempt > 0, "contempt not detected");
  assert.ok(r.signals.moralising > 0, "moralising not detected");
});

test("text evidence is halved — it corroborates, it does not testify", function () {
  var r = E.readText("It was disgusting.");
  assert.ok(r.signals.contempt <= 0.28, "text weight not halved: " + r.signals.contempt);
});

test("the matched sentence is kept so it can be quoted back", function () {
  var r = E.readText("The meeting ran late. He was completely smug about it. Then we left.");
  var src = r.sources.contempt[0];
  assert.strictEqual(src.kind, "text");
  assert.strictEqual(src.label, "He was completely smug about it");
});

test("a long matched sentence is truncated rather than dumped whole", function () {
  var long = "x ".repeat(140) + "smug";
  var r = E.readText(long);
  assert.ok(r.sources.contempt[0].label.length <= 141);
});

test("an account with nothing in it yields no signals", function () {
  var r = E.readText("We discussed the timetable and agreed a date.");
  assert.strictEqual(Object.keys(r.signals).length, 0);
});

/* ---- 2. question order and selection ------------------------------------ */

test("the spine is asked first, in order", function () {
  var state = { account: "", answers: {} };
  assert.strictEqual(E.nextQuestion(state).id, "size");
  state.answers.size = { optionId: "much" };
  assert.strictEqual(E.nextQuestion(state).id, "age");
  state.answers.age = { optionId: "own" };
  assert.strictEqual(E.nextQuestion(state).id, "before");
});

test("questioning stops at the declared maximum", function () {
  var state = session("I was furious.", {});
  assert.strictEqual(Object.keys(state.answers).length, E.MAX_QUESTIONS);
  assert.strictEqual(E.nextQuestion(state), null);
});

test("the projection follow-up is never offered before the trait is named", function () {
  var state = { account: "", answers: { size: { optionId: "much" }, age: { optionId: "own" }, before: { optionId: "often" } } };
  for (var i = 0; i < 4; i++) {
    var q = E.nextQuestion(state);
    assert.notStrictEqual(q.id, "traitInMe", "asked traitInMe with no trait");
    if (q.id === "trait") break;
    state.answers[q.id] = { optionId: q.options[0].id };
  }
});

test("naming a trait brings the follow-up next", function () {
  var state = { account: "He is so entitled and smug, it made me see red.", answers: {
    size: { optionId: "much" }, age: { optionId: "own" }, before: { optionId: "often" },
    trait: { text: "entitlement" }
  } };
  assert.strictEqual(E.nextQuestion(state).id, "traitInMe");
});

test("a skipped trait does not trigger the follow-up", function () {
  var state = { account: "He is so smug.", answers: {
    size: { optionId: "much" }, age: { optionId: "own" }, before: { optionId: "often" },
    trait: { text: "   " }
  } };
  assert.notStrictEqual(E.nextQuestion(state).id, "traitInMe");
});

test("the follow-up question quotes the trait back", function () {
  var state = { answers: { size: { optionId: "much" }, age: { optionId: "own" },
    before: { optionId: "often" }, trait: { text: "self-importance" } } };
  assert.ok(E.nextQuestion(state).text.indexOf("self-importance") > -1);
});

test("selection is deterministic", function () {
  var a = { account: "trapped and furious", answers: { size: { optionId: "much" }, age: { optionId: "own" }, before: { optionId: "often" } } };
  var b = JSON.parse(JSON.stringify(a));
  assert.strictEqual(E.nextQuestion(a).id, E.nextQuestion(b).id);
});

test("every question carries its reason for being asked", function () {
  var all = E.SPINE.concat(E.POOL);
  for (var i = 0; i < all.length; i++) {
    assert.ok(all[i].why && all[i].why.length > 20, all[i].id + " has no stated reason");
  }
});

test("a question is worth more when it separates live contenders", function () {
  var q = E.questionById("freedom");
  var hot  = E.questionValue(q, { puer: 0.8, mother: 0.5, power: 0.4, child: 0.8 });
  var cold = E.questionValue(q, { puer: 0.0, mother: 0.0, power: 0.0, child: 0.8 });
  assert.ok(hot > cold, "contention not rewarded");
});

/* ---- 3. scoring --------------------------------------------------------- */

test("scores stay inside 0..1", function () {
  var s = E.score(session("furious trapped ashamed excluded guilty envious blamed", {
    size: "much", age: "small", before: "life"
  })).scores;
  for (var id in s) assert.ok(s[id] >= 0 && s[id] <= 1, id + " = " + s[id]);
});

test("a dynamic with none of its defining signals is damped, not merely low", function () {
  var withAuthority = E.score({ answers: { who: { optionId: "auth" }, size: { optionId: "much" } } }).scores.father;
  var without       = E.score({ answers: { who: { optionId: "stranger" }, size: { optionId: "much" } } }).scores.father;
  assert.ok(withAuthority > without * 2, "needs-damping not applied");
});

test("denial plus heat reads as projection", function () {
  var state = { account: "He is unbearably smug and entitled. How dare he.", answers: {
    size: { optionId: "much" }, age: { optionId: "own" }, before: { optionId: "some" },
    trait: { text: "arrogance" }, traitInMe: { optionId: "none" }, after: { optionId: "right" }
  } };
  assert.strictEqual(topId(state), "projection");
});

test("owning the quality moves the reading off projection", function () {
  var denied = { account: "He is unbearably smug and entitled.", answers: {
    size: { optionId: "much" }, age: { optionId: "own" }, before: { optionId: "some" },
    trait: { text: "arrogance" }, traitInMe: { optionId: "none" } } };
  var owned = JSON.parse(JSON.stringify(denied));
  owned.answers.traitInMe = { optionId: "was" };
  var d = E.read(denied), o = E.read(owned);
  var dp = d.readings.filter(function (r) { return r.id === "projection"; })[0];
  var op = o.readings.filter(function (r) { return r.id === "projection"; })[0];
  assert.ok(dp && (!op || op.confidence < dp.confidence), "owning it did not reduce projection");
});

test("feeling small and left out reads as the abandoned child", function () {
  var state = { account: "They all went without me. I wasn't even asked.", answers: {
    size: { optionId: "much" }, age: { optionId: "small" }, before: { optionId: "life" },
    wanted: { optionId: "notice" }, impulse: { optionId: "weep" }
  } };
  assert.strictEqual(topId(state), "child");
});

test("a boss and an inner critic in their voice read as the father complex", function () {
  var state = { account: "My manager questioned my work in front of the team.", answers: {
    size: { optionId: "much" }, age: { optionId: "own" }, before: { optionId: "often" },
    who: { optionId: "auth" }, voice: { optionId: "boss" }, after: { optionId: "shame" }
  } };
  assert.strictEqual(topId(state), "father");
});

test("a closing door reads as puer and senex", function () {
  var state = { account: "She asked me to commit to the whole year. I felt cornered with no way out.", answers: {
    size: { optionId: "much" }, age: { optionId: "own" }, before: { optionId: "some" },
    freedom: { optionId: "yes" }, wanted: { optionId: "free" }, impulse: { optionId: "leave" }
  } };
  assert.strictEqual(topId(state), "puer");
});

test("unreturned giving reads as the rescuer", function () {
  var state = { account: "After everything I do for them, not one word of thanks.", answers: {
    size: { optionId: "much" }, age: { optionId: "own" }, before: { optionId: "often" },
    cost: { optionId: "care" }, role: { optionId: "cope" }, after: { optionId: "spent" }
  } };
  assert.strictEqual(topId(state), "hero");
});

test("wanting what they have reads as the unlived life", function () {
  var state = { account: "She got the promotion and I couldn't be happy for her.", answers: {
    size: { optionId: "much" }, age: { optionId: "own" }, before: { optionId: "some" },
    envyq: { optionId: "yes" }, trait: { text: "confidence" }, traitInMe: { optionId: "want" }
  } };
  assert.strictEqual(topId(state), "envy");
});

test("being blamed by the group reads as the group's shadow", function () {
  var state = { account: "It landed on me again, as usual. They singled me out.", answers: {
    size: { optionId: "much" }, age: { optionId: "own" }, before: { optionId: "often" },
    role: { optionId: "problem" }, witness: { optionId: "group" }, who: { optionId: "group" }
  } };
  assert.strictEqual(topId(state), "scapegoat");
});

test("a proportionate reaction is not forced into a complex", function () {
  var out = E.read({ account: "They cancelled on me and I was annoyed.", answers: {
    size: { optionId: "fit" }, age: { optionId: "own" }, before: { optionId: "new" } } });
  assert.ok(out.thin, "a thin reading was not marked thin");
  assert.ok(out.core.indexOf("close to the size of the event") > -1,
    "the reading did not concede proportionality");
});

/* ---- 4. the reading and the protocol ------------------------------------ */

test("a reading always has at least one dynamic, its evidence and a protocol", function () {
  var out = E.read(session("Everything went wrong today.", {}));
  assert.ok(out.readings.length >= 1);
  assert.ok(out.readings[0].evidence.length >= 1);
  assert.ok(out.protocol.moment.length >= 3);
  assert.ok(out.protocol.week[0].steps.length >= 3);
});

test("no more than three dynamics are offered", function () {
  var out = E.read(session("furious ashamed trapped excluded guilty envious blamed smug", {
    size: "much", age: "small", before: "life" }));
  assert.ok(out.readings.length <= 3);
});

test("evidence names where each claim came from", function () {
  var out = E.read({ account: "He was smug about it.", answers: {
    size: { optionId: "much" }, age: { optionId: "school" }, before: { optionId: "often" } } });
  var ev = out.readings[0].evidence[0];
  assert.ok(ev.claim && ev.quote && (ev.from === "your account" || ev.from === "your answer"));
});

test("the protocol uses the words the person actually wrote", function () {
  var out = E.read({ account: "He took the credit.", answers: {
    size: { optionId: "much" }, age: { optionId: "own" }, before: { optionId: "often" },
    trait: { text: "Shamelessness" }, rule: { text: "you don't take what isn't yours" } } });
  var today = out.protocol.today.join("\n");
  assert.ok(today.indexOf("shamelessness") > -1, "trait not carried into the protocol");
  assert.ok(today.indexOf("you don't take what isn't yours") > -1, "rule not carried into the protocol");
});

test("a hot reaction and a shutdown get opposite first steps", function () {
  var hot = E.read({ account: "", answers: { size: { optionId: "much" }, age: { optionId: "own" },
    before: { optionId: "some" }, body: { optionId: "hands" } } });
  var cold = E.read({ account: "", answers: { size: { optionId: "cold" }, age: { optionId: "own" },
    before: { optionId: "some" }, body: { optionId: "gone" } } });
  assert.ok(hot.protocol.moment[0].indexOf("ninety seconds") > -1);
  assert.ok(cold.protocol.moment[0].indexOf("come back into the room") > -1);
});

test("a recurring feeling adds the pattern-hunting prompt", function () {
  var once = E.read({ answers: { size: { optionId: "much" }, age: { optionId: "own" }, before: { optionId: "new" } } });
  var many = E.read({ answers: { size: { optionId: "much" }, age: { optionId: "own" }, before: { optionId: "life" } } });
  var has = function (o) { return o.protocol.today.join(" ").indexOf("three earlier occasions") > -1; };
  assert.ok(!has(once) && has(many));
});

test("a second practice appears only when a second dynamic is really in play", function () {
  var out = E.read(session("furious trapped excluded ashamed guilty blamed", {
    size: "much", age: "small", before: "life" }));
  assert.ok(out.protocol.week.length === 2, "expected a second practice");
  var thin = E.read({ answers: { size: { optionId: "fit" }, age: { optionId: "own" }, before: { optionId: "new" } } });
  assert.strictEqual(thin.protocol.week.length, 1);
});

test("every dynamic carries a practice and a question of its own", function () {
  for (var i = 0; i < E.DYNAMICS.length; i++) {
    var d = E.DYNAMICS[i];
    assert.ok(d.practice && d.practice.steps.length >= 3, d.id + " has a thin practice");
    assert.ok(/\?$/.test(d.question), d.id + " has no question");
    assert.ok(d.jung.length > 120, d.id + " has no account of the idea");
  }
});

test("the limits of the thing are always stated", function () {
  var out = E.read(session("anything", {}));
  assert.ok(out.protocol.limits.join(" ").indexOf("not a diagnosis") > -1);
});

/* ---- 5. risk ------------------------------------------------------------ */

test("an account of suicidal intent is flagged as crisis", function () {
  assert.strictEqual(E.riskScan("some days I don't want to be here at all").level, "crisis");
  assert.strictEqual(E.riskScan("I keep thinking about ending it all").level, "crisis");
});

test("an account of being hurt by someone is flagged", function () {
  assert.strictEqual(E.riskScan("he grabbed me and threatened me again").level, "harm");
});

test("ordinary distress is not flagged", function () {
  assert.strictEqual(E.riskScan("I could have died of embarrassment").level, null);
  assert.strictEqual(E.riskScan("the deadline is killing me").level, null);
  assert.strictEqual(E.riskScan("I was furious and went home").level, null);
});

test("the flag rides along on the reading", function () {
  var out = E.read({ account: "I hate myself so much I want to die.", answers: {} });
  assert.strictEqual(out.risk.level, "crisis");
});

/* ---- 6. export ---------------------------------------------------------- */

test("the plain-text export carries the account, the answers and the protocol", function () {
  var state = session("He took the credit in front of everyone.", { size: "much", trait: "shamelessness" });
  var txt = E.toText(state, E.read(state));
  assert.ok(txt.indexOf("He took the credit in front of everyone.") > -1);
  assert.ok(txt.indexOf("THE READING") > -1);
  assert.ok(txt.indexOf("PROTOCOL") > -1);
  assert.ok(txt.indexOf("LIMITS") > -1);
  assert.ok(txt.indexOf("shamelessness") > -1);
});

test("the export names the option chosen, not its internal id", function () {
  var state = { account: "x", answers: { size: { optionId: "much" } } };
  var txt = E.toText(state, E.read(state));
  assert.ok(txt.indexOf("Much more — it took me over") > -1);
});

console.log(passed + " tests passed");
