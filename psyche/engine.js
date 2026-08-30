/* ============================================================================
   PSYCHE — the reading engine
   ----------------------------------------------------------------------------
   Pure logic. No DOM, no network, no storage. An account of a reaction goes in,
   questions come out one at a time, and at the end a reading and a protocol.

   The model, in one paragraph. Jung's complexes are feeling-toned clusters in
   the unconscious that behave autonomously: when one is "constellated" it takes
   over, and the giveaway is that the affect does not match the stimulus. So the
   engine does not try to judge whether a reaction was justified. It measures
   disproportion, age, recurrence and the shape of the aftermath, and asks which
   known dynamic best accounts for that shape.

   Three layers:
     1. SIGNALS  — evidence, 0..1, gathered from the free text (weakly) and from
                   the answers (strongly). Every signal keeps its provenance so
                   the reading can show its working.
     2. DYNAMICS — twelve Jungian formulations, each a weighted read over the
                   signals, each with its own protocol.
     3. QUESTIONS— a fixed spine of three, then adaptive: ask whatever best
                   separates the dynamics still in contention.

   Nothing here diagnoses anything. It produces hypotheses with their evidence
   attached, which is the most an instrument like this can honestly do.
   ========================================================================== */
(function (root) {
  "use strict";

  var MAX_QUESTIONS = 7;

  /* ==========================================================================
     1. SIGNALS
     ========================================================================== */

  /* How each signal reads in a sentence, for showing the working. */
  var SIGNAL_PROSE = {
    disproportion: "the reaction outran the event",
    recurrence:    "the feeling is an old one, not a new one",
    regression:    "you felt younger than you are",
    outOfCharacter:"it was not how you usually behave",
    shame:         "shame followed, aimed at yourself",
    rage:          "there was heat, and it wanted out",
    contempt:      "there was contempt in it, not just anger",
    fear:          "fear was underneath it",
    grief:         "there was grief in it",
    envy:          "something of theirs was wanted",
    guilt:         "guilt was doing the steering",
    numbness:      "you went flat or far away",
    moralising:    "it came with a verdict about their character",
    exposure:      "you were being seen while it happened",
    authority:     "someone with standing over you was involved",
    care:          "it turned on being looked after, or looking after",
    intimacy:      "it happened close in, where you are known",
    peer:          "it happened among equals",
    constraint:    "a door was closing on you",
    exclusion:     "you were left out, unnoticed or dropped",
    overgiving:    "you had given more than came back",
    control:       "the question was who was in charge",
    unfairness:    "a rule was broken that you would not break",
    comparison:    "you were measuring yourself against them",
    collapse:      "the body went small — dropped, closed, cold",
    charge:        "the body went hot — jaw, hands, face",
    blamed:        "the fault was placed on you",
    appeasement:   "you moved to smooth it over",
    denial:        "the quality is one you say you have nothing of",
    judgement:     "you were being measured against a standard"
  };

  /* Free-text lexicon. Text evidence is deliberately weak — people describe
     events, not complexes — but it is enough to steer the first questions.   */
  var LEXICON = [
    { re: /\b(over ?reacted|overreaction|out of nowhere|from nowhere|blew up|lost it|snapped|saw red|exploded)\b/i,
      s: { disproportion: 0.6, charge: 0.3 } },
    { re: /\b(tiny|small|trivial|nothing really|no big deal|silly|stupid little)\b/i,
      s: { disproportion: 0.35 } },
    { re: /\b(again|always happens|every time|keeps happening|same thing|as usual)\b/i,
      s: { recurrence: 0.5 } },
    { re: /\b(like when i was|as a (kid|child)|childhood|growing up|at school|my (mum|mom|mother))\b/i,
      s: { recurrence: 0.3, regression: 0.3 } },
    { re: /\b(ashamed|shame[ds]?|embarrass\w*|humiliat\w*|cringe|mortified)\b/i,
      s: { shame: 0.6, exposure: 0.25 } },
    { re: /\b(furious|angry|rage|livid|seething|fuming|hate(d)? (them|him|her)|wanted to scream)\b/i,
      s: { rage: 0.6, charge: 0.3 } },
    { re: /\b(pathetic|disgust\w*|contempt\w*|can'?t stand|sickening|beneath|smug|entitled|arrogant)\b/i,
      s: { contempt: 0.55, moralising: 0.35 } },
    { re: /\b(scared|afraid|frightened|panic\w*|anxious|terrified|dread)\b/i,
      s: { fear: 0.55 } },
    { re: /\b(cried|crying|tears|welled up|sob|heartbroken|devastated)\b/i,
      s: { grief: 0.55, collapse: 0.3 } },
    { re: /\b(jealous|envious|envy|why (do|does) they|they get to|deserved it more|unfair that they)\b/i,
      s: { envy: 0.6, comparison: 0.4 } },
    { re: /\b(guilty|guilt|selfish of me|should have|owe (them|him|her)|let (them|him|her) down)\b/i,
      s: { guilt: 0.55 } },
    { re: /\b(numb|blank|shut down|switched off|checked out|went cold|dissociat\w*|far away)\b/i,
      s: { numbness: 0.55, collapse: 0.35 } },
    { re: /\b(they had no right|how dare|unacceptable|you (just )?don'?t do that|no one should|disgraceful)\b/i,
      s: { moralising: 0.55, unfairness: 0.4 } },
    { re: /\b(in front of|everyone (saw|heard)|in the meeting|in public|whole (team|room|family)|on the call)\b/i,
      s: { exposure: 0.5 } },
    { re: /\b(boss|manager|supervisor|my (dad|father)|teacher|professor|landlord|the (police|committee)|interview)\b/i,
      s: { authority: 0.55, judgement: 0.3 } },
    { re: /\b(look(ing|ed)? after|took care of|nursed|carried them|checked on|my (mum|mom|mother)|smother)\b/i,
      s: { care: 0.5 } },
    { re: /\b(my (wife|husband|partner|girlfriend|boyfriend)|marriage|relationship|we'?ve been together)\b/i,
      s: { intimacy: 0.5 } },
    { re: /\b(colleague|coworker|co-worker|classmate|teammate|my friend|mate of mine)\b/i,
      s: { peer: 0.45 } },
    { re: /\b(trapped|stuck|cornered|pinned|tied down|no way out|obliged|have to now|committed to)\b/i,
      s: { constraint: 0.6 } },
    { re: /\b(left out|excluded|not invited|ignored|forgot(ten)? (me|about me)|didn'?t notice|talked over|abandoned)\b/i,
      s: { exclusion: 0.6 } },
    { re: /\b(after everything i|i do everything|no one helps|took it all on|never say no|always the one who)\b/i,
      s: { overgiving: 0.6 } },
    { re: /\b(told me what to do|ordered|controll\w*|micromanag\w*|treated me like a child|overruled|dismissed me|talked down)\b/i,
      s: { control: 0.55 } },
    { re: /\b(not fair|unfair|cheat\w*|lied|broke (the )?(rule|promise)|got away with|double standard)\b/i,
      s: { unfairness: 0.55 } },
    { re: /\b(they got|promot\w+|richer|thinner|better than me|compar\w+|next to them|while i)\b/i,
      s: { comparison: 0.45 } },
    { re: /\b(my fault|blamed me|pointed at me|scapegoat|singled out|picked on)\b/i,
      s: { blamed: 0.55 } },
    { re: /\b(apolog\w+|smoothed it over|said it was fine|laughed it off|backed down|kept the peace)\b/i,
      s: { appeasement: 0.5 } }
  ];

  function normalise(t) { return String(t == null ? "" : t); }

  /* Pull the sentence a match sits in, so evidence can quote the user back. */
  function quoteAround(text, index, len) {
    var start = index, end = index + len;
    while (start > 0 && !/[.!?\n]/.test(text.charAt(start - 1))) start--;
    while (end < text.length && !/[.!?\n]/.test(text.charAt(end))) end++;
    var q = text.slice(start, end).trim().replace(/\s+/g, " ");
    if (q.length > 140) q = q.slice(0, 137).replace(/\s\S*$/, "") + "…";
    return q;
  }

  function readText(account) {
    var text = normalise(account), out = { signals: {}, sources: {} };
    for (var i = 0; i < LEXICON.length; i++) {
      var m = LEXICON[i].re.exec(text);
      if (!m) continue;
      var quote = quoteAround(text, m.index, m[0].length);
      for (var sig in LEXICON[i].s) {
        if (!Object.prototype.hasOwnProperty.call(LEXICON[i].s, sig)) continue;
        /* Text is corroboration, not testimony: halve it. */
        add(out, sig, LEXICON[i].s[sig] * 0.5, { kind: "text", label: quote });
      }
    }
    return out;
  }

  function add(acc, sig, weight, source) {
    if (!(weight > 0)) return;
    acc.signals[sig] = Math.min(1, (acc.signals[sig] || 0) + weight);
    (acc.sources[sig] = acc.sources[sig] || []).push({
      kind: source.kind, label: source.label, weight: weight
    });
  }

  /* ==========================================================================
     2. DYNAMICS
     ========================================================================== */

  var DYNAMICS = [
    {
      id: "projection",
      name: "The shadow, worn by someone else",
      short: "Shadow projection",
      core: "A quality you will not carry has been handed to them, and the heat you felt is the weight of it coming back.",
      jung: "Jung's rule of thumb was blunt: everything that irritates us about others can lead us to an understanding of ourselves. What is disowned does not vanish — it goes out, finds a carrier, and the carrier receives the charge that belongs at home. The tell is not that you disliked what they did. It is that you could not put it down afterwards.",
      needs: ["contempt", "moralising", "denial"],
      w: { contempt: 1.0, moralising: 0.9, denial: 1.1, disproportion: 0.8, unfairness: 0.5, rage: 0.4, recurrence: 0.3 },
      practice: {
        title: "Withdrawing the projection",
        steps: [
          "Write the case against them in full. Do not be fair, do not balance it, do not add \"but to be honest\". Fifteen minutes, no editing.",
          "Now rewrite the whole thing in the first person. Every \"they\" becomes \"I\". Change nothing else.",
          "Read the second version aloud. One sentence will make you flinch, or laugh, or want to stop. Mark it. That is the hook the projection hangs on.",
          "Beside it, write one occasion — however small, however long ago — when that sentence was true of you."
        ]
      },
      question: "What would I lose if I admitted I have some of that in me?"
    },
    {
      id: "persona",
      name: "The mask slipped",
      short: "Persona threat",
      core: "What was threatened was not you but the face you keep for the world, and the alarm was proportionate to how much you depend on it.",
      jung: "The persona is the compromise between who you are and what the situation requires. It is necessary — Jung never argued for going without one — but it is not you, and trouble starts when the difference is forgotten. Then anything that shows the world a face other than the managed one is met as if it were an attack on your life.",
      needs: ["exposure", "shame"],
      w: { exposure: 1.1, shame: 1.0, appeasement: 0.5, comparison: 0.4, disproportion: 0.6, fear: 0.4, control: 0.2 },
      practice: {
        title: "The persona inventory",
        steps: [
          "List the three qualities you most need other people to see in you. Be exact — \"competent\" is not the same as \"unflappable\".",
          "Beside each, write its opposite. That column is the list of what you are most afraid of being seen as, and it is where the day's reaction actually landed.",
          "Choose the mildest item in the second column and let one safe person see it this week, in one small way. Not a confession — an unmanaged moment.",
          "Afterwards, write down what you predicted would happen and what did."
        ]
      },
      question: "Who would still be here if they saw the version I work hardest to hide?"
    },
    {
      id: "inferior",
      name: "The inferior function erupting",
      short: "The inferior function",
      core: "You were called into the part of yourself that never got developed, and it answered the only way it can — all at once.",
      jung: "Every strength is paid for by a neglected function, which stays primitive, clumsy and hot. When it does break through it is absolute, out of character, and followed by shame at yourself rather than anger at them. Jung thought this was also where the growth was: the inferior function is the door to the unconscious, which is exactly why it is guarded so badly.",
      needs: ["outOfCharacter"],
      w: { outOfCharacter: 1.3, shame: 0.8, disproportion: 0.9, charge: 0.4, rage: 0.4, recurrence: -0.3 },
      practice: {
        title: "Naming the undeveloped function",
        steps: [
          "Which of these do you avoid, and secretly consider beneath you or beyond you: handling feeling directly, thinking something through coldly, dealing with practical detail, or entertaining possibilities without proof?",
          "That is the neglected one. Note that the situation almost certainly demanded it of you.",
          "Practise it this week where the stakes are near zero — one small deliberate rep, done badly on purpose.",
          "Refuse the shame after the eruption. It is a competence gap, not a character flaw, and shame is what keeps it undeveloped."
        ]
      },
      question: "What was this situation asking me to be good at that I have never practised?"
    },
    {
      id: "mother",
      name: "The mother complex",
      short: "Mother complex",
      core: "Not your mother — the structure that formed around being cared for, fed, held and steered by care.",
      jung: "It fires in two directions at once: the pull toward being looked after, and the panic at being swallowed by it. Guilt is its signature and obligation its currency. When someone's kindness makes you furious, or their need makes you unable to move, this is usually the one at work.",
      needs: ["care", "guilt"],
      w: { care: 1.1, guilt: 1.0, constraint: 0.6, control: 0.5, appeasement: 0.5, regression: 0.6, recurrence: 0.4 },
      practice: {
        title: "Separating the debt from the love",
        steps: [
          "Two columns. Left: what I actually owe this person. Right: what I have been given to understand I owe them.",
          "The gap between the columns is the complex, in writing. It is usually larger than expected.",
          "Say one true, small no this week — to anyone. The point is the sentence leaving your mouth, not the stakes.",
          "Note the guilt that follows, and time it. It is shorter than the fear of it."
        ]
      },
      question: "Is this care, or is it a claim?"
    },
    {
      id: "father",
      name: "The father complex",
      short: "Father complex",
      core: "Someone stood in the position of judge, and the verdict was in before they opened their mouth — because you had already delivered it.",
      jung: "The structure that formed around authority, standard, permission and judgement. It fires whenever another person is placed to assess you, and it recruits your own inner critic to their side in advance. The voice it speaks in is usually not yours, although it uses your mouth and your vocabulary.",
      needs: ["authority", "judgement"],
      w: { authority: 1.2, judgement: 1.1, shame: 0.7, fear: 0.6, unfairness: 0.5, control: 0.6, recurrence: 0.5, appeasement: 0.4, rage: 0.3 },
      practice: {
        title: "Taking dictation from the critic",
        steps: [
          "Ten minutes, writing as the critical voice, in the second person. \"You always…\", \"You never…\". Let it be as unfair as it actually is.",
          "Read it back and ask whose cadence that is. Most people know within a line or two.",
          "Now answer it in writing, as the adult who has evidence. Not defence — evidence. Dates, facts, things you did.",
          "Keep both pages. The next time the reaction fires, you will recognise the wording."
        ]
      },
      question: "Whose approval was I actually waiting for in that room?"
    },
    {
      id: "child",
      name: "The child who was left",
      short: "The abandoned child",
      core: "The part of you that answered was much younger than you are, and it was answering something much older than today.",
      jung: "The child is an archetype of new life, but the same figure carries the memory of being small and unattended. When tears arrive before words, or the room goes cold and you cannot speak, this is usually it. Being left out, unnoticed or dropped constellates it faster than open cruelty does.",
      needs: ["regression", "exclusion"],
      w: { regression: 1.3, exclusion: 1.1, grief: 0.8, collapse: 0.7, recurrence: 0.7, disproportion: 0.6, numbness: 0.4, fear: 0.3 },
      practice: {
        title: "Two letters",
        steps: [
          "Write the age you felt at the top of a page — the number that came to you, not the one that makes sense.",
          "Let that age write first, in its own words, about what happened today. Do not tidy the grammar.",
          "Then answer as the adult who is actually here, who has resources that child did not have. Say specifically what you can do that they could not.",
          "Then do the adult thing the child could never do: ask one person, directly and in plain words, for the thing you wanted them to offer unprompted."
        ]
      },
      question: "How old was I, in that moment, and who was missing?"
    },
    {
      id: "puer",
      name: "The door closing",
      short: "Puer and senex",
      core: "Something was being fixed in place, and what reacted was the part of you that keeps every door open.",
      jung: "Puer aeternus is the eternal youth — possibility preserved, commitment deferred, the life that is always about to begin. Its opposite, senex, is order, duty and rigidity. Each carries the other as shadow. A door closing constellates the puer as panic and flight; it constellates the senex as contempt for anyone who is not serious.",
      needs: ["constraint"],
      w: { constraint: 1.3, fear: 0.6, rage: 0.4, contempt: 0.4, control: 0.5, disproportion: 0.5, numbness: 0.3 },
      practice: {
        title: "Sizing the actual commitment",
        steps: [
          "Write down exactly what was being asked of you — hours, money, dates, obligations. Only what was literally asked.",
          "Beside it, write what it felt like was being asked. The distance between the two is the complex.",
          "Make one small commitment this week and keep it: something with a defined end, so that keeping it does not confirm the fear.",
          "Notice whether the freedom you are protecting is being used for anything, or only kept."
        ]
      },
      question: "Am I keeping this door open in order to walk through it, or so that I never have to?"
    },
    {
      id: "anima",
      name: "Taken over in the place you are known",
      short: "Anima / animus",
      core: "In close quarters something took the wheel, and it argued in absolutes that you would not defend when calm.",
      jung: "Jung's name for the contrasexual figure in the psyche: the unconscious carrier of relatedness in one attitude, of conviction in the other. Possession by it reads as a mood that cannot be reasoned with, or as opinions delivered like verdicts. It shows most in intimate relationship, because that is where it is projected first.",
      needs: ["intimacy"],
      w: { intimacy: 1.2, moralising: 0.6, rage: 0.5, grief: 0.4, recurrence: 0.6, disproportion: 0.6, contempt: 0.4 },
      practice: {
        title: "Catching the absolute",
        steps: [
          "Find the sentence with \"always\", \"never\", \"everyone\" or \"typical\" in it. There is always one.",
          "Rewrite it in the singular and the first person: one incident, one person, one feeling, owned.",
          "Then hold a written dialogue with whatever was speaking. Give it a name, ask it what it wants, and write its reply without correcting it. Jung called this active imagination; it works precisely because you do not manage the other side.",
          "Bring the rewritten sentence to the other person. Not the dialogue — the sentence."
        ]
      },
      question: "What was speaking, and would I have signed my name to it an hour earlier?"
    },
    {
      id: "hero",
      name: "The one who copes",
      short: "The rescuer",
      core: "You were identified with the strong one, and the bill for that came due as resentment rather than as a request.",
      jung: "Identification with the capable, giving, coping figure. It is real strength and it is also a shelter: the one who gives is never the one who needs. Resentment is the tell, because it is what unpaid giving turns into, and it embarrasses the identification, so it comes out sideways — in tone, in withdrawal, in a reaction like the one you had.",
      needs: ["overgiving"],
      w: { overgiving: 1.3, rage: 0.5, unfairness: 0.6, care: 0.5, appeasement: 0.4, disproportion: 0.5, grief: 0.3 },
      practice: {
        title: "The audit of unasked-for help",
        steps: [
          "List what you did for others this month that nobody actually requested.",
          "Beside each, write what you expected in return, honestly, even if it is only \"to be seen doing it\".",
          "Stop one item on that list this week without announcing it, and watch what happens. Usually less than feared.",
          "Ask for one thing, small and specific, from someone who owes you nothing. Let it be uncomfortable; the discomfort is the practice."
        ]
      },
      question: "If I stopped being useful here, what am I afraid would be left of me?"
    },
    {
      id: "scapegoat",
      name: "Carrying what the group will not",
      short: "The group's shadow",
      core: "The tension in that system found its usual destination, which is you, and the reaction was the weight of a load that is not all yours.",
      jung: "Groups have a shadow as much as people do, and it is usually deposited into one member, who is then experienced as the problem. If the same tension appears in a family or a team every time, and it always lands in the same place, the question is not only what you did. It is what the group needs you to be so that it does not have to look at itself.",
      needs: ["blamed"],
      w: { blamed: 1.3, exposure: 0.7, exclusion: 0.6, unfairness: 0.7, recurrence: 0.7, shame: 0.4, numbness: 0.3 },
      practice: {
        title: "Mapping the system",
        steps: [
          "Draw the people involved. Mark who was calmer after the incident than before it — that is who the arrangement serves.",
          "Write the accusation in one sentence, then split it: the part that is genuinely yours, and the part that is the group's, handed over.",
          "Return the second part with a single sentence, spoken once, without argument or evidence: \"That one isn't mine.\" Then let the silence be theirs.",
          "Expect pressure afterwards. Pressure at that exact point confirms the map rather than disproving it."
        ]
      },
      question: "Who gets to stay comfortable while I carry this?"
    },
    {
      id: "envy",
      name: "The unlived life",
      short: "Envy and the road not taken",
      core: "They were holding something you have not permitted yourself, and the sting was aimed at your own decision rather than at them.",
      jung: "Envy is precise in a way most feelings are not: it points directly at the life you did not allow. It does not attach to what you genuinely do not want. The bitterness is rarely about their having it — it is about a choice of your own, usually made long ago, never revisited, and now defended.",
      needs: ["envy", "comparison"],
      w: { envy: 1.3, comparison: 1.0, contempt: 0.5, unfairness: 0.5, grief: 0.4, moralising: 0.3 },
      practice: {
        title: "Naming the thing, not the person",
        steps: [
          "Write what they have in concrete terms — not \"their life\", but the specific thing. Ease. An audience. Being chosen. Not caring.",
          "Ask when you decided you could not have it, and what the reason was. Write the reason down and check whether it is still true.",
          "Price it honestly. Most unlived lives are unlived because the cost was real, and knowing the cost turns envy into a decision.",
          "Take the smallest available version of it this week — an hour of it, an inch of it — and see whether the charge drops."
        ]
      },
      question: "What did they take that I told myself I never wanted?"
    },
    {
      id: "power",
      name: "The power complex",
      short: "Power and position",
      core: "Your standing was reduced, and what answered was not an argument but a move to restore position.",
      jung: "Where eros fails, Jung said, power moves in to fill the space. The complex constellates around being made small — overruled, handled, dismissed, spoken past — and it answers in the same currency. It generally arrives dressed as principle, which is what makes it so hard to see from the inside while it is happening.",
      needs: ["control"],
      w: { control: 1.2, rage: 0.7, contempt: 0.6, moralising: 0.6, unfairness: 0.6, charge: 0.5, exposure: 0.4, disproportion: 0.5 },
      practice: {
        title: "Separating the injury from the answer",
        steps: [
          "Write what actually happened to your standing, in plain terms and without justification.",
          "Then write what you wanted to happen to theirs. Be exact and do not soften it; nobody is reading it.",
          "Notice that the second is a different size from the first. That difference is the complex, not the situation.",
          "Then decide what you would ask for if position were not at stake at all — and ask for that instead, once."
        ]
      },
      question: "Do I want this settled, or do I want to be the one who settled it?"
    }
  ];

  var BY_ID = {};
  for (var d = 0; d < DYNAMICS.length; d++) BY_ID[DYNAMICS[d].id] = DYNAMICS[d];

  /* ==========================================================================
     3. QUESTIONS
     ========================================================================== */

  /* The spine. Asked of everyone, in this order, because disproportion, age
     and recurrence are the three classical markers of a constellated complex
     and nothing else can be scored sensibly without them.                    */
  var SPINE = [
    {
      id: "size",
      text: "Set the size of the reaction against the size of the event.",
      why: "A complex is defined by the mismatch. Where the feeling fits the facts there is usually nothing here to analyse — which is a real and useful answer.",
      options: [
        { id: "fit",  label: "About right — it fitted what happened", says: "the reaction fitted the event", s: { disproportion: 0 } },
        { id: "some", label: "Somewhat more than it warranted",       says: "it was more than the event warranted", s: { disproportion: 0.45 } },
        { id: "much", label: "Much more — it took me over",           says: "it took you over", s: { disproportion: 0.95 } },
        { id: "cold", label: "It looked like nothing and I went cold", says: "you went cold where a reaction should have been", s: { disproportion: 0.8, numbness: 0.7, collapse: 0.5 } }
      ]
    },
    {
      id: "age",
      text: "In the moment it hit, how old did you feel?",
      why: "Complexes carry the age at which they formed. The number that arrives unbidden is more reliable than the one that makes sense.",
      options: [
        { id: "own",   label: "My own age", says: "you stayed your own age", s: {} },
        { id: "teen",  label: "Adolescent — fifteen or so", says: "you felt about fifteen", s: { regression: 0.5, recurrence: 0.3 } },
        { id: "school",label: "School age — eight to twelve", says: "you felt eight to twelve", s: { regression: 0.85, recurrence: 0.5 } },
        { id: "small", label: "Very young — smaller than words", says: "you felt smaller than words", s: { regression: 1.0, recurrence: 0.6, collapse: 0.5 } },
        { id: "old",   label: "Older and harder than I am", says: "you felt older and harder than you are", s: { contempt: 0.4, control: 0.4, moralising: 0.3 } }
      ]
    },
    {
      id: "before",
      text: "How familiar is that exact feeling?",
      why: "An autonomous complex has a history. If the feeling has an age, the situation today is the trigger and not the cause.",
      options: [
        { id: "new",  label: "New — I don't recognise it", says: "the feeling was unfamiliar", s: { outOfCharacter: 0.5 } },
        { id: "some", label: "Now and then", says: "it comes now and then", s: { recurrence: 0.4 } },
        { id: "often",label: "Often — it's a known visitor", says: "it is a known visitor", s: { recurrence: 0.85 } },
        { id: "life", label: "It has been with me as long as I can remember", says: "it has been with you as long as you can remember", s: { recurrence: 1.0, regression: 0.4 } }
      ]
    }
  ];

  /* The adaptive pool. `probes` says which dynamics a question can separate. */
  var POOL = [
    {
      id: "who",
      text: "Who was the other person to you?",
      why: "Complexes are relational. Which one is constellated depends heavily on the position the other person occupied.",
      probes: ["father", "mother", "anima", "scapegoat", "peer"],
      options: [
        { id: "auth",   label: "Someone with authority over me", says: "they had authority over you", s: { authority: 0.9, judgement: 0.4 } },
        { id: "family", label: "A parent or family member", says: "they are family", s: { care: 0.6, guilt: 0.4, recurrence: 0.4 } },
        { id: "partner",label: "My partner", says: "it was your partner", s: { intimacy: 0.95 } },
        { id: "peer",   label: "A colleague or peer", says: "they were a peer", s: { peer: 0.8, comparison: 0.3 } },
        { id: "group",  label: "A group, more than one person", says: "it was a group", s: { exposure: 0.6, blamed: 0.3 } },
        { id: "stranger",label:"A stranger, or nobody in particular", says: "they were a stranger", s: { moralising: 0.3, disproportion: 0.3 } }
      ]
    },
    {
      id: "trait",
      text: "Name the quality in them that set it off. One or two words.",
      why: "The shadow is specific. A projection can only be withdrawn once the quality is named exactly, in words you would use yourself.",
      kind: "text",
      probes: ["projection"],
      bonus: 0.2
    },
    {
      id: "traitInMe",
      requires: "trait",
      text: function (state) {
        var t = (state.answers && state.answers.trait && state.answers.trait.text) || "that quality";
        return "Where does “" + t + "” live in you?";
      },
      why: "This is the whole question. Jung's point is that the charge is proportionate to the disowning — so the flattest denial and the hottest reaction tend to arrive together.",
      probes: ["projection"],
      bonus: 0.3,
      options: [
        { id: "none",  label: "Nowhere. I'm nothing like that", says: "you place none of it in yourself", s: { denial: 1.0, moralising: 0.4 } },
        { id: "fight", label: "I work hard not to be like that", says: "you work hard not to be like that", s: { denial: 0.85, shame: 0.4 } },
        { id: "said",  label: "People have said that about me", says: "others have said it of you", s: { denial: 0.25, shame: 0.5 } },
        { id: "was",   label: "I used to be exactly that", says: "you used to be exactly that", s: { denial: 0.2, shame: 0.4, recurrence: 0.3 } },
        { id: "want",  label: "Honestly, I'd like to be able to do that", says: "you would like to be able to do it", s: { envy: 0.8, comparison: 0.6 } }
      ]
    },
    {
      id: "after",
      text: "Once the reaction had passed, what was left?",
      why: "The aftermath separates the dynamics better than the reaction does. Shame, righteousness and emptiness point in three different directions.",
      probes: ["persona", "inferior", "power", "child", "hero"],
      options: [
        { id: "shame", label: "Shame — at myself, at how I was", says: "shame at yourself followed", s: { shame: 0.9, outOfCharacter: 0.4 } },
        { id: "right", label: "Righteousness — I was right", says: "righteousness followed", s: { moralising: 0.85, contempt: 0.4 } },
        { id: "spent", label: "Exhaustion", says: "you were left exhausted", s: { overgiving: 0.5, collapse: 0.5 } },
        { id: "empty", label: "Emptiness, flatness, nothing", says: "you were left empty", s: { numbness: 0.8, grief: 0.4, collapse: 0.4 } },
        { id: "fear",  label: "Fear of what it would cost me", says: "you were left afraid of the cost", s: { fear: 0.8, exposure: 0.4 } },
        { id: "relief",label: "Relief — it finally came out", says: "it was a relief to have it out", s: { rage: 0.5, recurrence: 0.4 } }
      ]
    },
    {
      id: "witness",
      text: "Was anyone watching?",
      why: "The persona is a public structure. If it was the audience rather than the event that stung, that is worth knowing.",
      probes: ["persona", "scapegoat"],
      options: [
        { id: "alone", label: "No one", says: "no one was watching", s: {} },
        { id: "one",   label: "One person whose opinion matters to me", says: "one person whose opinion matters was watching", s: { exposure: 0.6 } },
        { id: "group", label: "A group", says: "a group was watching", s: { exposure: 0.9 } },
        { id: "manage",label: "People whose opinion of me I manage carefully", says: "the people watching were ones you manage carefully", s: { exposure: 1.0, appeasement: 0.4 } }
      ]
    },
    {
      id: "impulse",
      text: "If there were no consequences whatsoever, what would you have done?",
      why: "The impulse you did not act on shows the archetypal shape more cleanly than the behaviour you settled for.",
      probes: ["power", "puer", "child", "hero", "projection"],
      options: [
        { id: "shout",  label: "Shouted them down", says: "you wanted to shout them down", s: { rage: 0.8, control: 0.6, charge: 0.5 } },
        { id: "leave",  label: "Walked out and never gone back", says: "you wanted to walk out for good", s: { constraint: 0.7, contempt: 0.3 } },
        { id: "weep",   label: "Wept", says: "you wanted to weep", s: { grief: 0.9, regression: 0.4, collapse: 0.4 } },
        { id: "hit",    label: "Hit something", says: "you wanted to hit something", s: { rage: 0.9, charge: 0.7 } },
        { id: "explain",label: "Explained until they finally understood", says: "you wanted to be understood", s: { exclusion: 0.5, appeasement: 0.4, control: 0.3 } },
        { id: "vanish", label: "Disappeared", says: "you wanted to disappear", s: { shame: 0.6, numbness: 0.5, collapse: 0.6 } },
        { id: "return", label: "Made them feel exactly what I felt", says: "you wanted them to feel it too", s: { control: 0.8, contempt: 0.5, unfairness: 0.4 } }
      ]
    },
    {
      id: "rule",
      text: "What rule did they break that you would never break?",
      why: "The rule you hold hardest usually marks the border of the shadow. It is the thing you police in yourself first.",
      kind: "text",
      probes: ["projection", "father", "power"]
    },
    {
      id: "body",
      text: "Where did it land in the body?",
      why: "The affect arrives in the body before the story does, and collapse and charge belong to different dynamics.",
      probes: ["child", "power", "inferior"],
      options: [
        { id: "chest", label: "Chest — tight, or heavy", says: "it landed in your chest", s: { collapse: 0.5, fear: 0.4 } },
        { id: "throat",label: "Throat — closed, couldn't speak", says: "your throat closed", s: { collapse: 0.7, regression: 0.4 } },
        { id: "gut",   label: "Stomach — dropped", says: "your stomach dropped", s: { fear: 0.6, collapse: 0.5 } },
        { id: "face",  label: "Heat in the face", says: "heat rose in your face", s: { shame: 0.6, charge: 0.6, exposure: 0.4 } },
        { id: "hands", label: "Hands and jaw", says: "it went to your hands and jaw", s: { charge: 0.9, rage: 0.5 } },
        { id: "gone",  label: "Nowhere — I went numb and far away", says: "you went numb and far away", s: { numbness: 0.9, collapse: 0.6 } }
      ]
    },
    {
      id: "wanted",
      text: "What did you want them to say or do?",
      why: "The unmet wish names the complex more directly than the grievance does, and it is usually much older than the situation.",
      probes: ["child", "father", "hero", "mother", "puer"],
      options: [
        { id: "wrong", label: "Admit they were wrong", says: "you wanted them to admit they were wrong", s: { control: 0.6, unfairness: 0.5 } },
        { id: "sorry", label: "Apologise and mean it", says: "you wanted a real apology", s: { unfairness: 0.5, grief: 0.3 } },
        { id: "notice",label: "Notice me", says: "you wanted to be noticed", s: { exclusion: 0.9, regression: 0.4 } },
        { id: "stop",  label: "Stop, and leave me alone", says: "you wanted them to stop", s: { constraint: 0.7, control: 0.4 } },
        { id: "choose",label: "Choose me", says: "you wanted to be chosen", s: { exclusion: 0.8, intimacy: 0.5, grief: 0.4 } },
        { id: "free",  label: "Let me out of it", says: "you wanted to be let out of it", s: { constraint: 0.9, guilt: 0.4 } },
        { id: "praise",label: "Say I'd done well", says: "you wanted to be told you had done well", s: { authority: 0.5, overgiving: 0.5, exclusion: 0.3 } }
      ]
    },
    {
      id: "role",
      text: "In that situation, what were you being asked to be?",
      why: "Roles are handed out before anyone speaks. The reaction is often to the role rather than to the words.",
      probes: ["hero", "persona", "scapegoat", "child"],
      options: [
        { id: "strong", label: "The strong one", says: "you were cast as the strong one", s: { overgiving: 0.7, exposure: 0.3 } },
        { id: "reason", label: "The reasonable one", says: "you were cast as the reasonable one", s: { appeasement: 0.7, overgiving: 0.4 } },
        { id: "good",   label: "The good one", says: "you were cast as the good one", s: { guilt: 0.6, appeasement: 0.5, exposure: 0.3 } },
        { id: "cope",   label: "The one who copes", says: "you were cast as the one who copes", s: { overgiving: 0.9, numbness: 0.3 } },
        { id: "problem",label: "The difficult one", says: "you were cast as the difficult one", s: { blamed: 0.9, exclusion: 0.4 } },
        { id: "nobody", label: "No one at all", says: "you were cast as no one at all", s: { exclusion: 0.9, numbness: 0.4 } }
      ]
    },
    {
      id: "cost",
      text: "What had you given in that situation that never came back?",
      why: "Resentment is unpaid giving with nowhere to go, and it is the most reliable sign of an identification with the capable one.",
      probes: ["hero", "mother", "envy"],
      options: [
        { id: "time",   label: "Time and effort", says: "your time and effort went unreturned", s: { overgiving: 0.8 } },
        { id: "care",   label: "Care — I carried them", says: "you had been carrying them", s: { overgiving: 0.9, care: 0.7 } },
        { id: "honest", label: "Honesty, at cost to myself", says: "you were honest at cost to yourself", s: { unfairness: 0.5, exposure: 0.4 } },
        { id: "loyal",  label: "Loyalty", says: "your loyalty went unreturned", s: { overgiving: 0.6, unfairness: 0.6, grief: 0.3 } },
        { id: "nothing",label: "Nothing — if anything I took", says: "you were the one taking", s: { guilt: 0.7, shame: 0.4, overgiving: -0.5 } }
      ]
    },
    {
      id: "envyq",
      text: "Did they have something you don't let yourself have?",
      why: "Envy is exact. It only attaches where a door was closed from the inside.",
      probes: ["envy", "projection", "puer"],
      options: [
        { id: "yes",   label: "Yes, and I can see it clearly", says: "they had what you don't allow yourself", s: { envy: 1.0, comparison: 0.8 } },
        { id: "admit", label: "Yes, but I'd never say so out loud", says: "they had something you won't admit wanting", s: { envy: 0.9, comparison: 0.7, denial: 0.5 } },
        { id: "no",    label: "No, nothing I want", says: "you wanted nothing of theirs", s: {} },
        { id: "less",  label: "They had less than me and still got more", says: "they had less and still got more", s: { unfairness: 0.9, comparison: 0.8, envy: 0.5 } }
      ]
    },
    {
      id: "freedom",
      text: "Did it feel like a door closing?",
      why: "Constraint and its opposite constellate very different figures — the one that flees, and the one that hardens.",
      probes: ["puer", "mother", "power"],
      options: [
        { id: "yes",  label: "Yes — pinned, with no way out", says: "you felt pinned", s: { constraint: 1.0, fear: 0.4 } },
        { id: "some", label: "Somewhat", says: "something was closing", s: { constraint: 0.5 } },
        { id: "no",   label: "No", says: "nothing was closing", s: {} },
        { id: "open", label: "The opposite — too open, no ground under me", says: "there was too little ground under you", s: { fear: 0.7, exclusion: 0.4, numbness: 0.3 } }
      ]
    },
    {
      id: "voice",
      text: "The criticism in your head afterwards — whose voice is it in?",
      why: "The inner critic is rarely original. It is generally a recording, and recognising the speaker takes most of its authority away.",
      probes: ["father", "mother", "persona"],
      options: [
        { id: "parent", label: "A parent's", says: "the critic speaks in a parent's voice", s: { authority: 0.7, judgement: 0.85, recurrence: 0.7, care: 0.3 } },
        { id: "boss",   label: "A teacher's or a boss's", says: "the critic speaks in a teacher's or boss's voice", s: { authority: 0.9, judgement: 0.95, exposure: 0.3 } },
        { id: "mine",   label: "My own — it always has been", says: "the critic sounds like you", s: { shame: 0.6, judgement: 0.5, recurrence: 0.5 } },
        { id: "none",   label: "No voice, just a feeling", says: "there is no voice, only a feeling", s: { regression: 0.6, numbness: 0.4 } },
        { id: "unknown",label: "Someone I've never put a name to", says: "the voice has never been named", s: { recurrence: 0.6, regression: 0.4 } }
      ]
    },
    {
      id: "pattern",
      text: "Where else does this happen?",
      why: "A complex has a radius. Knowing whether it fires everywhere or only in one room tells you what you are dealing with.",
      probes: ["scapegoat", "father", "anima", "projection"],
      options: [
        { id: "only",   label: "Only with this person", says: "it happens only with this person", s: { intimacy: 0.4 } },
        { id: "kind",   label: "With this kind of person", says: "it happens with this kind of person", s: { recurrence: 0.8, denial: 0.2 } },
        { id: "work",   label: "Mostly at work", says: "it happens mostly at work", s: { authority: 0.5, exposure: 0.4, recurrence: 0.5 } },
        { id: "home",   label: "Mostly at home", says: "it happens mostly at home", s: { intimacy: 0.6, care: 0.4, recurrence: 0.5 } },
        { id: "every",  label: "Everywhere, if I'm honest", says: "it happens everywhere", s: { recurrence: 1.0, denial: 0.3 } }
      ]
    }
  ];

  var Q_BY_ID = {};
  for (var qi = 0; qi < SPINE.length; qi++) Q_BY_ID[SPINE[qi].id] = SPINE[qi];
  for (var qj = 0; qj < POOL.length; qj++) Q_BY_ID[POOL[qj].id] = POOL[qj];

  function questionText(q, state) {
    return typeof q.text === "function" ? q.text(state || {}) : q.text;
  }

  /* ==========================================================================
     SCORING
     ========================================================================== */

  /* Gather every signal with its provenance, from the account and the answers. */
  function collect(state) {
    var acc = readText(state && state.account);
    var answers = (state && state.answers) || {};
    for (var qid in answers) {
      if (!Object.prototype.hasOwnProperty.call(answers, qid)) continue;
      var q = Q_BY_ID[qid], a = answers[qid];
      if (!q || !a) continue;
      if (q.kind === "text") {
        /* Free-text answers carry no weights of their own; they are quoted
           back in the reading, and the follow-up question does the scoring. */
        continue;
      }
      var opt = null;
      for (var k = 0; k < (q.options || []).length; k++) {
        if (q.options[k].id === a.optionId) { opt = q.options[k]; break; }
      }
      if (!opt) continue;
      for (var sig in opt.s) {
        if (!Object.prototype.hasOwnProperty.call(opt.s, sig)) continue;
        add(acc, sig, opt.s[sig], { kind: "answer", label: opt.says });
      }
    }
    return acc;
  }

  /* Score every dynamic against the gathered signals. 0..1, comparable. */
  function score(state) {
    var acc = collect(state), out = {};
    for (var i = 0; i < DYNAMICS.length; i++) {
      var dyn = DYNAMICS[i], raw = 0, max = 0;
      for (var sig in dyn.w) {
        if (!Object.prototype.hasOwnProperty.call(dyn.w, sig)) continue;
        var w = dyn.w[sig];
        if (w > 0) max += w;
        raw += w * (acc.signals[sig] || 0);
      }
      var v = max > 0 ? Math.max(0, raw / max) : 0;
      /* A dynamic with none of its defining signals present is not ruled out,
         but it is not allowed to lead on circumstantial evidence either.     */
      var met = false;
      for (var n = 0; n < (dyn.needs || []).length; n++) {
        if ((acc.signals[dyn.needs[n]] || 0) > 0.15) { met = true; break; }
      }
      if ((dyn.needs || []).length && !met) v *= 0.3;
      out[dyn.id] = Math.min(1, v);
    }
    return { scores: out, signals: acc.signals, sources: acc.sources };
  }

  /* ==========================================================================
     QUESTION SELECTION
     ========================================================================== */

  /* Worth of asking a question now: how much live contention it touches.
     Dynamics near the top of the table are worth separating; ones far behind
     are not worth spending a question on.                                    */
  function questionValue(q, scores) {
    var leader = 0, id;
    for (id in scores) if (scores[id] > leader) leader = scores[id];
    var probes = q.probes || [], total = 0;
    for (var i = 0; i < probes.length; i++) {
      var s = scores[probes[i]] || 0;
      var closeness = leader > 0 ? 1 - (leader - s) / leader : 1;
      total += s * (0.4 + 0.6 * Math.max(0, closeness));
    }
    /* Divide by sqrt so that a question touching six dynamics does not beat a
       sharp one touching two purely on breadth. */
    var v = probes.length ? total / Math.sqrt(probes.length) : 0;
    /* Before anything is known, fall back on the declared order plus bonus. */
    if (leader === 0) v = 0.01 * (POOL.length - POOL.indexOf(q));
    return v + (q.bonus || 0);
  }

  function answered(state, id) {
    return !!(state && state.answers && state.answers[id]);
  }

  function nextQuestion(state) {
    state = state || {};
    for (var i = 0; i < SPINE.length; i++) {
      if (!answered(state, SPINE[i].id)) return decorate(SPINE[i], state, i, SPINE.length);
    }
    var count = Object.keys(state.answers || {}).length;
    if (count >= MAX_QUESTIONS) return null;

    var sc = score(state).scores, best = null, bestV = -1;
    for (var j = 0; j < POOL.length; j++) {
      var q = POOL[j];
      if (answered(state, q.id)) continue;
      if (q.requires && !answered(state, q.requires)) continue;
      if (q.requires) {
        var dep = state.answers[q.requires];
        if (dep && dep.text != null && !String(dep.text).trim()) continue;
      }
      var v = questionValue(q, sc);
      if (v > bestV) { bestV = v; best = q; }
    }
    return best ? decorate(best, state, count, MAX_QUESTIONS) : null;
  }

  function decorate(q, state, index, total) {
    return {
      id: q.id,
      kind: q.kind || "choice",
      text: questionText(q, state),
      why: q.why,
      options: q.options || null,
      index: index,
      total: total
    };
  }

  /* ==========================================================================
     RISK
     ========================================================================== */

  /* Not a screening tool and not pretending to be one. It exists so that an
     account describing danger is met with a person to call rather than a
     paragraph about archetypes.                                             */
  var RISK = [
    { level: "crisis", re: /\b(kill myself|killing myself|end my life|ending it all|take my own life|suicid\w*|want to die|don'?t want to be here|better off without me|no reason to (go on|live))\b/i },
    { level: "crisis", re: /\b(hurt myself|harm myself|self ?harm|cut myself|cutting myself|burn myself)\b/i },
    { level: "crisis", re: /\b(kill (him|her|them)|hurt (him|her|them) badly|make (him|her|them) pay for good|seriously hurt)\b/i },
    { level: "harm",   re: /\b(hit me|hits me|beat me|beats me|punched me|strangl\w+|threatened me|forced me|assault\w*|won'?t let me leave|afraid of (him|her|them))\b/i }
  ];

  function riskScan(text) {
    var t = normalise(text), level = null;
    for (var i = 0; i < RISK.length; i++) {
      if (RISK[i].re.test(t)) {
        if (RISK[i].level === "crisis") return { level: "crisis" };
        level = level || "harm";
      }
    }
    return { level: level };
  }

  /* ==========================================================================
     THE READING
     ========================================================================== */

  function confidenceLabel(v) {
    if (v >= 0.55) return "strong";
    if (v >= 0.32) return "present";
    return "faint";
  }

  /* Show the working: the signals that carried this dynamic, and where each
     one came from — their words or their answer.                            */
  function evidenceFor(dyn, sig, sources) {
    var lines = [], seen = {};
    var ranked = [];
    for (var s in dyn.w) {
      if (!Object.prototype.hasOwnProperty.call(dyn.w, s)) continue;
      if (dyn.w[s] <= 0) continue;
      var strength = (sig[s] || 0) * dyn.w[s];
      if (strength > 0.12) ranked.push({ sig: s, strength: strength });
    }
    ranked.sort(function (a, b) { return b.strength - a.strength; });
    for (var i = 0; i < ranked.length && lines.length < 4; i++) {
      var name = ranked[i].sig;
      if (seen[name] || !SIGNAL_PROSE[name]) continue;
      seen[name] = true;
      var src = (sources[name] || []).slice().sort(function (a, b) { return b.weight - a.weight; })[0];
      lines.push({
        claim: SIGNAL_PROSE[name],
        from: src ? (src.kind === "text" ? "your account" : "your answer") : null,
        quote: src ? src.label : null,
        kind: src ? src.kind : null
      });
    }
    return lines;
  }

  function protocolFor(top, state, res) {
    var sig = res.signals, ans = state.answers || {};
    var trait = (ans.trait && ans.trait.text || "").trim();
    var rule  = (ans.rule && ans.rule.text || "").trim();
    var young = (sig.regression || 0) >= 0.5;
    var hot   = (sig.charge || 0) >= (sig.collapse || 0);

    var moment = [
      hot
        ? "Before anything else, let the body finish. The surge of a constellated complex runs its physical course in about ninety seconds if it is not fed by rehearsal. Feet on the floor, longer out-breath than in, and say nothing you will have to unsay."
        : "Before anything else, come back into the room. When the reaction is a shutdown rather than a flare, the work is the opposite of calming down: name five things you can see, put weight through your feet, and let the body come back before the words do.",
      "Name it while it is happening, silently and specifically: “this is the " + top.short.toLowerCase() + ", and it is here again.” Naming does not stop it. It restores the small distance between you and it, which is the whole of the freedom you have in that moment.",
      "Ask the age question in the moment: how old do I feel right now? " + (young
        ? "You have already answered it once here, and the number will very likely be the same one."
        : "The answer is diagnostic, and it takes two seconds."),
      "Postpone the response, not the feeling. “I want to answer this properly — give me until tomorrow.” A complex loses most of its grip once it is denied its immediate outlet, and nothing worth saying is lost by a day."
    ];

    var today = [
      "Write the whole episode out longhand while it is fresh, in the order it happened, without arguing your case. You are collecting the material, not winning.",
      "Underline the exact moment the reaction started — usually a single gesture, phrase, or tone, several seconds before you thought anything.",
      "Then answer, in writing: " + top.question
    ];
    if (trait) {
      today.push("You named the quality as “" + trait + "”. Finish this sentence without softening it: “The last time I was " + trait.toLowerCase() + " was…”");
    }
    if (rule) {
      today.push("You said the rule they broke was: “" + rule + "”. Write down what you believe would happen to you if you broke it. That belief, not the rule, is what was defended today.");
    }
    if ((sig.recurrence || 0) >= 0.5) {
      today.push("List three earlier occasions with this same feeling in them. Look for what the three situations share rather than what today's had. The common factor is the complex; the situations are only its occasions.");
    }

    var week = [top.practice];
    /* A second practice from the runner-up, where one is genuinely in play. */
    if (res.readings.length > 1 && res.readings[1].confidence >= 0.32) {
      week.push(res.readings[1].dynamic.practice);
    }

    var month = [
      "Keep a one-line log for a month: date, trigger, how old you felt, what you did. Four columns, nothing else.",
      "After three or four entries the pattern shows itself in the trigger column, and it is almost never what you would have predicted from any single incident.",
      "The measure of progress is not that the complex stops firing. It is the gap between the firing and the response getting longer, and the recovery getting shorter."
    ];

    var limits = [
      "This is a structured way of thinking about one reaction. It is not therapy, not analysis, and not a diagnosis, and it has only your own account to go on.",
      "If the same complex is costing you relationships, work, or sleep, that is the point at which it wants a person rather than a page — a therapist or an analyst, who can see what you cannot narrate.",
      "If the situation involves someone frightening you or hurting you, the reading above is beside the point. Safety comes first, and it is not a psychological question."
    ];

    return { moment: moment, today: today, week: week, month: month, limits: limits };
  }

  function formulate(state) {
    state = state || {};
    var res = score(state);
    var ranked = [];
    for (var i = 0; i < DYNAMICS.length; i++) {
      ranked.push({ dynamic: DYNAMICS[i], confidence: res.scores[DYNAMICS[i].id] });
    }
    ranked.sort(function (a, b) {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return DYNAMICS.indexOf(a.dynamic) - DYNAMICS.indexOf(b.dynamic);
    });

    var readings = [];
    for (var j = 0; j < ranked.length && readings.length < 3; j++) {
      if (ranked[j].confidence < 0.18 && readings.length >= 1) break;
      readings.push({
        id: ranked[j].dynamic.id,
        dynamic: ranked[j].dynamic,
        confidence: ranked[j].confidence,
        label: confidenceLabel(ranked[j].confidence),
        evidence: evidenceFor(ranked[j].dynamic, res.signals, res.sources)
      });
    }

    var top = readings[0].dynamic;
    var disproportion = res.signals.disproportion || 0;

    var core = top.core;
    if (disproportion >= 0.6) {
      core += " The size of it is the evidence: a complex is precisely a place where the charge does not match the event.";
    } else if ((state.answers || {}).size && state.answers.size.optionId === "fit") {
      core += " Though by your own account the reaction was close to the size of the event — which is worth taking at face value. Not every strong feeling is a complex, and a proportionate one deserves to be acted on rather than analysed.";
    }

    return {
      core: core,
      readings: readings,
      protocol: null, /* filled below, once readings exist */
      risk: riskScan(state.account),
      signals: res.signals,
      thin: readings[0].confidence < 0.3
    };
  }

  function read(state) {
    var out = formulate(state);
    out.protocol = protocolFor(out.readings[0].dynamic, state, out);
    return out;
  }

  /* Plain-text export, for a notebook or for taking to a therapist. */
  function toText(state, out) {
    var L = [], i, j;
    L.push("A REACTION, LOOKED AT");
    L.push(new Date().toLocaleString());
    L.push("");
    L.push("WHAT HAPPENED");
    L.push(String(state.account || "").trim());
    L.push("");
    L.push("WHAT I ANSWERED");
    var order = SPINE.concat(POOL);
    for (i = 0; i < order.length; i++) {
      var a = (state.answers || {})[order[i].id];
      if (!a) continue;
      var val = a.text != null ? a.text : (function () {
        for (j = 0; j < (order[i].options || []).length; j++) {
          if (order[i].options[j].id === a.optionId) return order[i].options[j].label;
        }
        return a.optionId;
      })();
      L.push("- " + questionText(order[i], state) + "\n  " + val);
    }
    L.push("");
    L.push("THE READING");
    L.push(out.core);
    L.push("");
    for (i = 0; i < out.readings.length; i++) {
      var r = out.readings[i];
      L.push((i + 1) + ". " + r.dynamic.name + " (" + r.label + ")");
      L.push("   " + r.dynamic.jung);
      for (j = 0; j < r.evidence.length; j++) {
        L.push("   · " + capitalise(r.evidence[j].claim) +
          (r.evidence[j].quote ? " — " + r.evidence[j].quote : ""));
      }
      L.push("");
    }
    L.push("PROTOCOL");
    var p = out.protocol;
    L.push("When it fires again:");
    for (i = 0; i < p.moment.length; i++) L.push("  " + (i + 1) + ". " + p.moment[i]);
    L.push("Today:");
    for (i = 0; i < p.today.length; i++) L.push("  " + (i + 1) + ". " + p.today[i]);
    L.push("This week:");
    for (i = 0; i < p.week.length; i++) {
      L.push("  " + p.week[i].title);
      for (j = 0; j < p.week[i].steps.length; j++) L.push("    - " + p.week[i].steps[j]);
    }
    L.push("Over a month:");
    for (i = 0; i < p.month.length; i++) L.push("  - " + p.month[i]);
    L.push("");
    L.push("LIMITS");
    for (i = 0; i < p.limits.length; i++) L.push("  - " + p.limits[i]);
    return L.join("\n");
  }

  function capitalise(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }

  /* ==========================================================================
     EXPORTS
     ========================================================================== */

  var API = {
    MAX_QUESTIONS: MAX_QUESTIONS,
    DYNAMICS: DYNAMICS,
    SPINE: SPINE,
    POOL: POOL,
    SIGNAL_PROSE: SIGNAL_PROSE,
    questionById: function (id) { return Q_BY_ID[id]; },
    questionText: questionText,
    readText: readText,
    collect: collect,
    score: score,
    questionValue: questionValue,
    nextQuestion: nextQuestion,
    riskScan: riskScan,
    read: read,
    toText: toText
  };

  if (typeof module === "object" && module.exports) module.exports = API;
  else root.PsycheEngine = API;

})(typeof window !== "undefined" ? window : globalThis);
