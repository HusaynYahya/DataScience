/* ============================================================================
   FALAK 1259 — SITE CONTENT
   ----------------------------------------------------------------------------
   This is the ONLY file you need to edit to change the words on the site.
   Layout and styling live elsewhere; nothing here touches design.

   HOW TO EDIT
   - Change any text inside the quotation marks "like this".
   - Keep the punctuation around it: the quotes, the commas, the braces { }.
   - A few fields allow light inline HTML: <em>italic</em>, <strong>bold</strong>,
     and <br> for a line break. These are marked "(HTML allowed)".
   - The Mission page reads from `mission.body`, an ordered list of blocks.
     Add, remove, or reorder blocks freely — see the note above that section.
   - To change where the forms send their data, edit `forms.endpoint` at the
     very bottom.

   After editing, just reload the page in your browser. No build step.
   ============================================================================ */

window.FALAK = {

  /* ---- Site-wide ------------------------------------------------------- */
  site: {
    name: "Falak 1259",
    arabic: "فلك",
    tagline: "A drawing instrument built on a proof from 1259.",
  },

  /* ---- Navigation (same order everywhere) ------------------------------ */
  nav: [
    { label: "The Object", href: "index.html" },
    { label: "Mission",    href: "mission.html" },
    { label: "Order",      href: "order.html" },
    { label: "Gallery",    href: "gallery.html" },
    { label: "Contact",    href: "contact.html" },
  ],

  /* ---- Footer ---------------------------------------------------------- */
  footer: {
    blurb: "A hand-cranked brass instrument that draws a straight line from turning circles. Made in a numbered first series.",
    smallprint: "Falak 1259 — made by hand, in a numbered first series.",
  },

  /* =====================================================================
     MISSION PAGE   ← you told us you'll edit this most often.
     ---------------------------------------------------------------------
     `body` is an ordered list of blocks. Each block has a "type":
        { type: "p",     text: "…" }   a paragraph        (HTML allowed)
        { type: "h2",    text: "…" }   a section heading
        { type: "pull",  text: "…" }   a large pull-quote (HTML allowed)
     Add, delete, or drag blocks around to restructure the essay. Order here
     is the order on the page.
     ===================================================================== */
  mission: {
    eyebrow: "Mission",
    title: "A straight line, drawn by circles",
    lede: "In 1259, on a hill above the plains of Maragha, an astronomer resolved a problem that had troubled geometers since antiquity: how to draw perfectly straight motion using nothing but rotation. Falak 1259 is that proof, cut in brass and set upon a desk.",
    body: [
      { type: "p", text: "The Maragha observatory was the most advanced scientific institution of its age. Founded in 1259 under the patronage of the Ilkhanate, it gathered astronomers, mathematicians and instrument-makers from across the known world. At its centre worked <strong>Nasir al-Din al-Tusi</strong> — polymath, philosopher, and the man who would give his name to a small, exact piece of geometry." },

      { type: "h2", text: "The problem of straight motion" },
      { type: "p", text: "The heavens, the ancients held, moved in circles. Everything turned. Yet a turning thing cannot, on its own, produce a straight line — and the astronomers needed straight, back-and-forth motion to reconcile their models of the planets with what they saw in the sky. The question was old and stubborn: can rotation alone be made to travel in a perfectly straight path?" },
      { type: "p", text: "Al-Tusi answered it with two circles. Let a small circle roll inside a larger one exactly twice its size. Fix your attention on a single point on the edge of the smaller circle. As the small circle rolls, that point does not curve, does not wander, does not wobble. It travels back and forth along a dead-straight line — a diameter of the larger circle." },

      { type: "pull", text: "A circle rolling inside another twice its size turns rotation into a perfectly straight line. No approximation. A proof." },

      { type: "p", text: "This device — a circle within a circle, half the size — is now called the <em>Tusi couple</em>. It is not an approximation that happens to look straight. It is exact, provable from the geometry alone. Seven and a half centuries later it remains one of the most quietly astonishing results a person can hold in the hand." },

      { type: "h2", text: "Falak" },
      { type: "p", text: "<em>Falak</em> (فلك) is the old word for the celestial sphere — the turning vault of the heavens that al-Tusi and his colleagues spent their lives measuring. It is the right name for an object about rotation, and about the sky that first posed the question." },

      { type: "h2", text: "Why we made it" },
      { type: "p", text: "Most proofs live on paper. This one asks to be turned. We built Falak 1259 so that the argument could be felt: crank the handle, and a stylus draws al-Tusi's straight line in fine sand, slowly, in front of you. Move the drawing point inward and the line opens into an ellipse, then closes to a circle — the whole family of figures the geometry contains, under your hand." },
      { type: "p", text: "It is made of brass, walnut and glass, in a numbered first series. It does nothing useful. It only demonstrates something true, beautifully, for as long as you care to turn it." },
    ],
  },

  /* =====================================================================
     THE OBJECT PAGE  (this is the home page, index.html)
     ===================================================================== */
  object: {
    eyebrow: "The Object",
    title: "Falak 1259",
    lede: "A hand-cranked brass instrument that draws a perfectly straight line in sand — then, with a turn of the stylus, an ellipse, then a circle. The mechanism is a 13th-century geometric proof, made real.",
    ctaOrder: "Order — £295",
    ctaMission: "Read the story",

    howHeading: "How it works",
    howItWorks: [
      { title: "The Tusi couple", text: "A brass gear rolls a small circle inside a fixed ring exactly twice its diameter. This is the Tusi couple — the geometry that converts turning into straight-line travel." },
      { title: "The crank", text: "Turning the handle drives the rolling circle at a slow, even pace. There is no motor and no electronics. The motion you see is the motion of your hand, geared down." },
      { title: "The stylus and the sand", text: "A fine stylus rides a point on the rolling circle and traces its path in a shallow bed of drawing sand beneath the glass dome. Level the sand to begin again." },
      { title: "From line to circle", text: "Slide the stylus inward, toward the centre of the rolling circle, and the straight line opens into an ellipse and finally a circle — every figure the geometry allows." },
    ],

    animation: {
      heading: "The geometry, exactly",
      caption: "The curve below is computed directly from the rolling geometry — not drawn from a preset path. Move the drawing point from the rim to the centre and watch the straight line open into an ellipse, then a circle.",
      sliderLabel: "Drawing point — rim to centre",
      equation: "x = (r + d)·cos θ   ·   y = (r − d)·sin θ",
      playLabel: "Play",
      pauseLabel: "Pause",
      figureLine: "Straight line",
      figureEllipse: "Ellipse",
      figureCircle: "Circle",
    },

    specHeading: "Specification",
    spec: [
      { label: "Principle",   value: "Tusi couple — a circle rolling inside one twice its size (R = 2r)" },
      { label: "Movement",    value: "Hand-cranked brass gear train, no motor" },
      { label: "Figures",     value: "Straight line, ellipse, circle — continuously variable" },
      { label: "Materials",   value: "Machined brass, oiled walnut base, blown-glass dome" },
      { label: "Medium",      value: "Fine-grained drawing sand (included)" },
      { label: "Dimensions",  value: "180 mm high · 160 mm diameter" },
      { label: "Weight",      value: "1.9 kg" },
      { label: "Edition",     value: "Numbered first series" },
      { label: "Price",       value: "£295" },
    ],

    heroImage: { src: "assets/img/object-hero.svg", alt: "Falak 1259 — a brass drawing instrument beneath a glass dome on a walnut base." },
  },

  /* =====================================================================
     ORDER PAGE
     ===================================================================== */
  order: {
    eyebrow: "Order",
    title: "The first series",
    price: "£295",
    lede: "Falak 1259 is made by hand in a limited first series. Each instrument is numbered and finished individually. Reserve a number below and we will be in touch with availability and delivery.",
    included: [
      "One Falak 1259 instrument, numbered",
      "Blown-glass dome and oiled walnut base",
      "Drawing sand and levelling tool",
      "Crank handle and spare stylus",
      "Note of authenticity with your series number",
    ],
    includedHeading: "What arrives",
    seriesHeading: "Limited &amp; numbered",
    seriesNote: "The first series is small. Numbers are assigned in the order reservations are confirmed.",

    form: {
      heading: "Reserve a number",
      note: "No payment is taken now. We will contact you to confirm your number and arrange delivery.",
      submit: "Send reservation",
      success: "Thank you. Your reservation is noted — we will be in touch shortly.",
      placeholderNotice: "Form endpoint not yet configured. Set forms.endpoint in assets/js/content.js to receive submissions.",
      error: "Something went wrong sending your reservation. Please try again, or email us directly.",
      fields: {
        name:   { label: "Name",    placeholder: "Your name" },
        email:  { label: "Email",   placeholder: "you@example.com" },
        intent: { label: "I'm writing to" },
        message:{ label: "Message (optional)", placeholder: "Anything you'd like us to know" },
      },
      intents: [
        "Reserve a number",
        "Ask about availability",
        "Press or exhibition",
        "Wholesale enquiry",
      ],
    },
  },

  /* =====================================================================
     GALLERY PAGE
     ---------------------------------------------------------------------
     Swap the placeholder images by replacing the files in assets/img/
     (keep the same filenames) or by changing the `src` paths below.
     For the video, set `video.src` to your .mp4 file path.
     ===================================================================== */
  gallery: {
    eyebrow: "Gallery",
    title: "In detail",
    lede: "The instrument, its mechanism, and the figures it draws. Replace these placeholders with your own photographs.",
    images: [
      { src: "assets/img/gallery-01.svg", alt: "Falak 1259 under its glass dome, three-quarter view.",         caption: "The complete instrument" },
      { src: "assets/img/gallery-02.svg", alt: "Close view of the brass gear train and rolling circle.",        caption: "The Tusi couple, in brass" },
      { src: "assets/img/gallery-03.svg", alt: "The stylus resting in a bed of fine drawing sand.",             caption: "Stylus and sand" },
      { src: "assets/img/gallery-04.svg", alt: "A straight line freshly traced across the sand bed.",           caption: "The straight line" },
      { src: "assets/img/gallery-05.svg", alt: "An ellipse traced in the sand as the stylus is moved inward.",  caption: "The stylus, moved inward" },
      { src: "assets/img/gallery-06.svg", alt: "The crank handle and oiled walnut base, detail.",               caption: "Crank and walnut base" },
    ],
    videoHeading: "Demonstration",
    video: {
      poster: "assets/img/video-poster.svg",
      src: "",  /* ← drop the path to your .mp4 here, e.g. "assets/video/demo.mp4" */
      caption: "A full turn of the crank, from level sand to finished line.",
      placeholder: "Demonstration video — add your file path to gallery.video.src in content.js",
    },
  },

  /* =====================================================================
     CONTACT PAGE
     ===================================================================== */
  contact: {
    eyebrow: "Contact",
    title: "Get in touch",
    lede: "For orders, exhibitions, press or anything else, write to us below or by email. We read every message.",
    email: "hello@falak1259.example",
    studio: "The Workshop, Maragha House, London",
    hours: "Correspondence answered Monday to Friday.",
    detailsHeading: "Details",
    form: {
      heading: "Send a message",
      submit: "Send message",
      success: "Thank you — your message has been sent. We will reply shortly.",
      placeholderNotice: "Form endpoint not yet configured. Set forms.endpoint in assets/js/content.js to receive submissions.",
      error: "Something went wrong sending your message. Please try again, or email us directly.",
      fields: {
        name:    { label: "Name",    placeholder: "Your name" },
        email:   { label: "Email",   placeholder: "you@example.com" },
        message: { label: "Message", placeholder: "How can we help?" },
      },
    },
  },

  /* =====================================================================
     FORMS — where submissions are sent
     ---------------------------------------------------------------------
     Replace the endpoint below with your form handler (Formspree, Basin,
     Getform, a serverless function, etc.). Until you do, forms validate and
     confirm on-screen but do not send anywhere.
     ===================================================================== */
  forms: {
    endpoint: "https://REPLACE-WITH-YOUR-FORM-ENDPOINT.example",
    method: "POST",
  },
};
