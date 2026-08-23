/* ============================================================================
   QASR CALCULATOR
   ----------------------------------------------------------------------------
   Takes a starting address and a destination, measures the road distance
   between them, and applies the rulings of Sayyid Ali al-Sistani on the
   prayers and fast of a traveller.

   Three parts, in order:
     1. Geography — geocoding (Nominatim) and routing (OSRM), with a
        straight-line fallback and a manual override when either is unreachable.
     2. The ruling engine — a pure function: circumstances in, verdict out.
        No network, no DOM. This is the part worth reading.
     3. The interface — form wiring and rendering.
   ========================================================================== */
(function () {
  "use strict";

  /* ---- constants ------------------------------------------------------- */

  /* Eight farsakh. One farsakh is three miles, about 5.5 km, so the legal
     distance is roughly 44 km. Sources differ by a few hundred metres either
     way, which is why NEAR_KM below asks for caution close to the line.       */
  var FARSAKH_KM = 5.5;
  var LIMIT_KM   = 8 * FARSAKH_KM;   /* 44 km */
  var NEAR_KM    = 2;                /* caution band on either side of the limit */
  var KM_PER_MI  = 1.609344;

  var NOMINATIM = "https://nominatim.openstreetmap.org/search";
  var OSRM      = "https://router.project-osrm.org/route/v1/driving/";

  /* ==========================================================================
     1. GEOGRAPHY
     ========================================================================== */

  var geocodeCache = Object.create(null);

  function geocode(query, limit, signal) {
    var key = limit + "|" + query.toLowerCase();
    if (geocodeCache[key]) return Promise.resolve(geocodeCache[key]);

    var url = NOMINATIM + "?format=jsonv2&addressdetails=1&limit=" + limit +
              "&q=" + encodeURIComponent(query);

    return fetch(url, { signal: signal, headers: { Accept: "application/json" } })
      .then(function (r) {
        if (!r.ok) throw new Error("Geocoding service returned " + r.status);
        return r.json();
      })
      .then(function (rows) {
        var places = (rows || []).map(function (row) {
          return {
            label: row.display_name,
            lat: parseFloat(row.lat),
            lon: parseFloat(row.lon)
          };
        });
        geocodeCache[key] = places;
        return places;
      });
  }

  /* Great-circle distance — the straight line, used only as a fallback and
     always labelled as such. The legal distance follows the road.            */
  function haversineKm(a, b) {
    var R = 6371.0088, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad;
    var dLon = (b.lon - a.lon) * rad;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(a.lat * rad) * Math.cos(b.lat * rad) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  /* Road distance by car. Falls back to the straight line if the routing
     service cannot be reached, flagging the result so the interface can say so. */
  function routeKm(a, b) {
    var coords = a.lon + "," + a.lat + ";" + b.lon + "," + b.lat;
    return fetch(OSRM + coords + "?overview=full&geometries=geojson&alternatives=false")
      .then(function (r) {
        if (!r.ok) throw new Error("Routing service returned " + r.status);
        return r.json();
      })
      .then(function (data) {
        if (data.code !== "Ok" || !data.routes || !data.routes.length) {
          throw new Error("No road route found");
        }
        var geo = data.routes[0].geometry;
        return {
          km: data.routes[0].distance / 1000,
          minutes: data.routes[0].duration / 60,
          source: "road",
          /* GeoJSON gives [lon, lat]; the map wants [lat, lon]. */
          line: (geo && geo.coordinates || []).map(function (c) { return [c[1], c[0]]; })
        };
      })
      .catch(function () {
        return {
          km: haversineKm(a, b),
          minutes: null,
          source: "straight",
          line: [[a.lat, a.lon], [b.lat, b.lon]]
        };
      });
  }

  /* ==========================================================================
     2. THE RULING ENGINE

     Input:
       oneWayKm          road distance of the outward leg
       edgeKm            distance from the door to the town limit, deducted per leg
       roundTrip         returning without a ten-day stay, so both legs count
       intendedFromStart the whole distance was intended when setting out
       destIsWatan       the destination is one of the traveller's hometowns
       tenDays           a certain intention to stay ten continuous days
       hesitant          no idea how long the stay will be
       passesWatan       the route passes through, and stops in, a hometown
       frequentTraveller travel is part of the occupation, or the person is a nomad
       sinful            the journey is for an unlawful purpose

     Output: a verdict for the road and a verdict for the destination, the
     numbers behind them, the reasoning, and any cautions.
     ========================================================================== */

  function decide(o) {
    var reasons  = [];
    var warnings = [];

    var legKm     = Math.max(0, o.oneWayKm - o.edgeKm);
    var countedKm = o.roundTrip ? legKm * 2 : legKm;
    var meets     = countedKm >= LIMIT_KM;

    var metrics = {
      oneWayKm: o.oneWayKm,
      edgeKm: o.edgeKm,
      legKm: legKm,
      countedKm: countedKm,
      limitKm: LIMIT_KM,
      roundTrip: o.roundTrip,
      meets: meets
    };

    function out(enRoute, atDest, headline, sub) {
      return {
        enRoute: enRoute, atDest: atDest, headline: headline, sub: sub,
        reasons: reasons, warnings: warnings, metrics: metrics
      };
    }

    /* -- the exemptions come first: they hold whatever the distance -------- */
    if (o.sinful) {
      reasons.push("A journey undertaken for an unlawful purpose is not a journey in the eyes of the law. <b>The prayers are not shortened</b> and the fast is not lifted, however far one travels.");
      return out("full", "full", "Pray in full",
        "The rulings of travel do not apply to a journey whose purpose is sinful.");
    }

    if (o.frequentTraveller) {
      reasons.push("Travel is part of your occupation — a driver, a pilot, a commuting worker or student, or one with no settled home. <b>Such a person prays in full and fasts</b> while travelling for that work.");
      warnings.push({ kind: "info", text: "The exemption applies to the travel of the occupation itself. A journey of a different kind — a holiday, a pilgrimage — is judged on its own terms, and the first journey after a long break from the work is treated as ordinary travel." });
      return out("full", "full", "Pray in full",
        "One whose work is travel is not a traveller in the eyes of the law.");
    }

    /* -- the distance ------------------------------------------------------ */
    reasons.push(
      "The outward leg measures <b>" + fmtKm(o.oneWayKm) + "</b>" +
      (o.edgeKm > 0 ? ", less " + fmtKm(o.edgeKm) + " counted from your door to the edge of town, leaving <b>" + fmtKm(legKm) + "</b>" : "") +
      (o.roundTrip
        ? ". Since you return without staying ten days, the outward and return legs are added: <b>" + fmtKm(countedKm) + "</b>."
        : ". You are not counting a return, so this leg alone must reach the limit.")
    );

    if (!meets) {
      reasons.push("That is short of the legal distance of eight <i>farsakh</i> — <b>" + fmtKm(LIMIT_KM) + "</b>. <b>You are not a traveller</b>: pray in full and fast as usual.");
      nearLimit();
      return out("full", "full", "Pray in full",
        "The journey falls short of eight farsakh, so the rulings of travel do not apply.");
    }

    reasons.push("That meets the legal distance of eight <i>farsakh</i> — <b>" + fmtKm(LIMIT_KM) + "</b>.");
    nearLimit();

    /* -- the intention ----------------------------------------------------- */
    if (!o.intendedFromStart) {
      reasons.push("The intention to cover the distance was not present when you set out. <b>Until that intention forms you are not a traveller</b>, and once it does the distance is counted afresh from wherever you happen to be.");
      warnings.push({ kind: "warn", text: "Run the calculation again using the place where you decided to continue as the starting point. Only the road from there onwards counts towards the eight farsakh." });
      return out("full", "full", "Pray in full — for now",
        "The distance was not intended from the outset, so the count restarts from the point the intention formed.");
    }

    /* -- a hometown on the way --------------------------------------------- */
    if (o.passesWatan) {
      warnings.push({ kind: "warn", text: "You stop in one of your hometowns on the way, which ends the journey at that point. The verdict below is provisional: run the calculator again with that town as the starting point, and treat the remaining road as a journey of its own." });
    }

    /* -- the destination --------------------------------------------------- */
    if (o.destIsWatan) {
      reasons.push("The destination is one of your hometowns. <b>In your own hometown you pray in full and fast</b>, even having travelled the legal distance to reach it. On the road between the two you are still a traveller.");
      return out("qasr", "full", "Shorten on the road, pray in full on arrival",
        "The journey meets the legal distance, but a person is never a traveller in his own hometown.");
    }

    if (o.tenDays) {
      reasons.push("You intend to stay ten continuous days or more. <b>That intention ends the journey</b>: at the destination you pray in full and fast as a resident. On the road you remain a traveller.");
      warnings.push({ kind: "info", text: "The ten days must be certain from the outset and spent in one place. Once a single four-rak'ah prayer has been offered in full there, the resident's ruling holds for as long as you remain, even if you then leave earlier than planned." });
      return out("qasr", "full", "Shorten on the road, pray in full on arrival",
        "An intention to stay ten continuous days makes you a resident at the destination.");
    }

    if (o.hesitant) {
      reasons.push("You do not know how long you will stay. <b>Remain a traveller and shorten</b> — for up to thirty days in that one place. From the thirty-first day you pray in full without any new intention.");
      warnings.push({ kind: "info", text: "If certainty arrives during the stay that you will remain ten more days, you become a resident from that moment; the days already spent are not counted towards the ten." });
      return out("qasr", "qasr-30", "Shorten your prayers",
        "You remain a traveller while the length of the stay is undecided, up to thirty days.");
    }

    reasons.push("Nothing interrupts the journey: no hometown at its end, no intention of a ten-day stay. <b>Shorten the four-rak'ah prayers and do not fast.</b>");
    return out("qasr", "qasr", "Shorten your prayers",
      "The journey meets every condition, so the rulings of travel apply from the limit of your town onwards.");

    /* -- a caution when the distance sits on the line ---------------------- */
    function nearLimit() {
      if (Math.abs(countedKm - LIMIT_KM) <= NEAR_KM) {
        warnings.push({
          kind: "warn",
          text: "This journey sits within " + fmtKm(NEAR_KM) + " of the legal limit, and the road you take may differ from the one measured here. Where the distance is genuinely doubtful, the precaution is to pray both — shortened and in full — and to ask a scholar."
        });
      }
    }
  }

  /* ==========================================================================
     3. THE INTERFACE
     ========================================================================== */

  var $ = function (id) { return document.getElementById(id); };

  var unit = "km";                    /* display unit */
  var places = { from: null, to: null };
  var lastRoute = null;               /* { km, minutes, source } */

  function toKm(v)      { return unit === "mi" ? v * KM_PER_MI : v; }
  function fromKm(v)    { return unit === "mi" ? v / KM_PER_MI : v; }
  function unitLabel()  { return unit === "mi" ? "miles" : "km"; }

  function fmtKm(km) {
    var v = fromKm(km);
    var s = v >= 100 ? v.toFixed(0) : v.toFixed(1);
    return s.replace(/\.0$/, "") + " " + unitLabel();
  }

  /* ---- address autocomplete -------------------------------------------- */

  function attachAutocomplete(inputId, listId, slot, hintId) {
    var input = $(inputId), list = $(listId), hint = $(hintId);
    var timer = null, controller = null, items = [], active = -1;

    function close() {
      list.hidden = true;
      list.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
      active = -1;
    }

    function choose(place) {
      places[slot] = place;
      input.value = place.label;
      hint.textContent = "Located at " + place.lat.toFixed(4) + ", " + place.lon.toFixed(4) + ".";
      hint.className = "hint hint--ok";
      close();
    }

    function render(rows) {
      items = rows;
      list.innerHTML = "";
      if (!rows.length) {
        var none = document.createElement("li");
        none.className = "is-empty";
        none.textContent = "No place of that name was found.";
        list.appendChild(none);
      } else {
        rows.forEach(function (place, i) {
          var li = document.createElement("li");
          li.setAttribute("role", "option");
          li.setAttribute("aria-selected", "false");
          li.textContent = place.label;
          li.addEventListener("mousedown", function (e) { e.preventDefault(); choose(place); });
          li.dataset.index = String(i);
          list.appendChild(li);
        });
      }
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    function highlight(next) {
      var nodes = list.querySelectorAll("li[role='option']");
      if (!nodes.length) return;
      if (active >= 0) nodes[active].setAttribute("aria-selected", "false");
      active = (next + nodes.length) % nodes.length;
      nodes[active].setAttribute("aria-selected", "true");
      nodes[active].scrollIntoView({ block: "nearest" });
    }

    input.addEventListener("input", function () {
      places[slot] = null;
      hint.className = "hint";
      var q = input.value.trim();
      if (timer) clearTimeout(timer);
      if (controller) controller.abort();
      if (q.length < 3) { close(); return; }

      /* Nominatim asks for no more than one request a second; the debounce
         keeps well inside that, and in-flight requests are abandoned.        */
      timer = setTimeout(function () {
        controller = new AbortController();
        geocode(q, 6, controller.signal)
          .then(render)
          .catch(function (err) { if (err.name !== "AbortError") close(); });
      }, 450);
    });

    input.addEventListener("keydown", function (e) {
      if (list.hidden) return;
      if (e.key === "ArrowDown")      { e.preventDefault(); highlight(active + 1); }
      else if (e.key === "ArrowUp")   { e.preventDefault(); highlight(active - 1); }
      else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(items[active]); }
      else if (e.key === "Escape")    { close(); }
    });

    input.addEventListener("blur", function () { setTimeout(close, 120); });
  }

  /* ---- reading the form ------------------------------------------------- */

  function readCircumstances(oneWayKm) {
    return {
      oneWayKm: oneWayKm,
      edgeKm: toKm(Math.max(0, parseFloat($("edgeKm").value) || 0)),
      roundTrip:         $("qReturn").checked,
      intendedFromStart: $("qIntent").checked,
      destIsWatan:       $("qWatan").checked,
      tenDays:           $("qTenDays").checked,
      hesitant:          $("qHesitant").checked,
      passesWatan:       $("qPassWatan").checked,
      frequentTraveller: $("qFrequent").checked,
      sinful:            $("qSin").checked
    };
  }

  /* ---- the map ----------------------------------------------------------
     Leaflet is loaded from a CDN. If it does not arrive — an offline machine,
     a blocked network — every other part of the page carries on without it and
     the map card simply stays hidden.
     ---------------------------------------------------------------------- */

  var mapState = { map: null, drawn: null, fitted: null };

  function walkTo(line, targetKm, scale) {
    /* The point on the route at a given distance along it. OSRM's polyline is
       a shade shorter than the distance it reports, so the walk is scaled to
       agree with the figure shown to the reader.                              */
    var run = 0;
    for (var i = 1; i < line.length; i++) {
      var a = { lat: line[i - 1][0], lon: line[i - 1][1] };
      var b = { lat: line[i][0], lon: line[i][1] };
      var seg = haversineKm(a, b) * scale;
      if (run + seg >= targetKm) {
        var t = seg > 0 ? (targetKm - run) / seg : 0;
        return [a.lat + (b.lat - a.lat) * t, a.lon + (b.lon - a.lon) * t];
      }
      run += seg;
    }
    return null;
  }

  function polylineKm(line) {
    var total = 0;
    for (var i = 1; i < line.length; i++) {
      total += haversineKm({ lat: line[i - 1][0], lon: line[i - 1][1] },
                           { lat: line[i][0], lon: line[i][1] });
    }
    return total;
  }

  function drawMap(m) {
    var card = $("mapCard");
    var line = lastRoute && lastRoute.line;

    /* No library, or no geometry to draw — a hand-entered distance, say. */
    if (typeof L === "undefined" || !line || line.length < 2 || !places.from || !places.to) {
      card.hidden = true;
      return;
    }

    /* The card must be visible before Leaflet measures the container, or the
       map sizes itself to nothing and the route lands outside the view.      */
    card.hidden = false;

    if (!mapState.map) {
      mapState.map = L.map("map", { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }).addTo(mapState.map);
      mapState.drawn = L.layerGroup().addTo(mapState.map);
    }
    mapState.drawn.clearLayers();
    mapState.map.invalidateSize();

    var straight = lastRoute.source === "straight";

    L.polyline(line, {
      color: "#4db6a4", weight: 4, opacity: .85,
      dashArray: straight ? "6 8" : null
    }).addTo(mapState.drawn);

    marker(line[0], "#86e2d0", places.from.label.split(",")[0] + " — start");
    marker(line[line.length - 1], "#f0c977", places.to.label.split(",")[0] + " — destination");

    /* The town limit, beyond which the counting starts. */
    var hasEdge = m.edgeKm > 0;
    if (hasEdge) {
      L.circle(line[0], {
        radius: m.edgeKm * 1000, color: "#8792a1", weight: 1,
        dashArray: "4 6", fill: false
      }).addTo(mapState.drawn).bindTooltip("Edge of town — " + fmtKm(m.edgeKm) + " out");
    }

    /* Where the eight farsakh falls along this road. It marks the distance
       only: once a journey qualifies, the shortening runs from the town limit
       onwards, not from this point.                                          */
    var oneWayNeeded = m.roundTrip ? m.limitKm / 2 : m.limitKm;
    var polyKm = polylineKm(line);
    var scale = polyKm > 0 ? lastRoute.km / polyKm : 1;
    var at = m.meets ? walkTo(line, m.edgeKm + oneWayNeeded, scale) : null;
    if (at) {
      L.circleMarker(at, {
        radius: 6, color: "#4db6a4", weight: 2, fillColor: "#0d1117", fillOpacity: 1
      }).addTo(mapState.drawn).bindTooltip("Eight farsakh — " + fmtKm(m.limitKm) +
        (m.roundTrip ? " counted, outward and back" : ""));
    }

    $("mapLegend").querySelector(".is-edge").hidden = !hasEdge;
    $("mapLegend").querySelector(".is-limit").hidden = !at;
    $("mapNote").textContent = straight
      ? "The road could not be fetched, so this is the straight line between the two places — not a route."
      : "The driving route, which is what the law measures. The eight-farsakh mark shows where that distance falls; once a journey qualifies, the shortening runs from the limit of your town onwards.";

    /* Only re-frame when the route itself changes — not on every toggle. */
    var key = line.length + ":" + line[0] + ":" + line[line.length - 1];
    if (mapState.fitted !== key) {
      mapState.map.fitBounds(L.latLngBounds(line).pad(0.12));
      mapState.fitted = key;
    }

    function marker(at, colour, label) {
      L.circleMarker(at, {
        radius: 7, color: colour, weight: 3, fillColor: "#0d1117", fillOpacity: 1
      }).addTo(mapState.drawn).bindTooltip(label);
    }
  }

  /* ---- rendering the verdict -------------------------------------------- */

  var RAKAHS = [
    { name: "Fajr",    full: 2, short: 2 },
    { name: "Dhuhr",   full: 4, short: 2 },
    { name: "Asr",     full: 4, short: 2 },
    { name: "Maghrib", full: 3, short: 3 },
    { name: "Isha",    full: 4, short: 2 }
  ];

  function render(verdict) {
    var m = verdict.metrics;
    var shortensSomewhere = verdict.enRoute === "qasr" || verdict.atDest.indexOf("qasr") === 0;

    /* the headline */
    $("verdict").className = "verdict" + (shortensSomewhere ? "" : " verdict--full");
    $("verdictLabel").textContent = verdict.headline;
    $("verdictSub").textContent = verdict.sub;

    /* the numbers */
    var rows = [
      ["Road distance, one way", fmtKm(m.oneWayKm) +
        (lastRoute && lastRoute.minutes ? " · about " + fmtDuration(lastRoute.minutes) + " by car" : "")]
    ];
    if (m.edgeKm > 0) {
      rows.push(["Deducted to the edge of town", "− " + fmtKm(m.edgeKm) + " per leg"]);
      rows.push(["Counted, one way", fmtKm(m.legKm)]);
    }
    if (m.roundTrip) rows.push(["Return leg", "+ " + fmtKm(m.legKm)]);
    rows.push(["Legal distance — 8 farsakh", fmtKm(m.limitKm)]);

    var dl = $("measure");
    dl.innerHTML = "";
    rows.forEach(function (r) { dl.appendChild(measureRow(r[0], r[1], false)); });
    dl.appendChild(measureRow(
      m.roundTrip ? "Total counted for this journey" : "Counted for this journey",
      fmtKm(m.countedKm) + (m.meets ? " — meets the limit" : " — short of the limit"),
      true
    ));

    var pct = Math.max(2, Math.min(100, (m.countedKm / m.limitKm) * 100));
    $("gaugeFill").style.width = pct + "%";
    $("gaugeFill").className = "gauge__fill" + (m.meets ? " is-over" : "");

    var src = lastRoute ? lastRoute.source : "road";
    $("measureNote").textContent =
      src === "straight" ? "The routing service could not be reached, so this is the straight-line distance — always shorter than the road. Enter the real distance by hand before relying on this verdict." :
      src === "manual"   ? "Measured from the distance you entered by hand." :
      "Measured along the driving route, as the law requires: the path travelled, not the straight line on the map.";
    $("measureNote").className = "hint" + (src === "straight" ? " hint--warn" : "");

    /* the prayers */
    var body = $("prayers").querySelector("tbody");
    body.innerHTML = "";
    RAKAHS.forEach(function (p) {
      var onRoad = verdict.enRoute === "qasr" ? p.short : p.full;
      var atDest = verdict.atDest.indexOf("qasr") === 0 ? p.short : p.full;
      var tr = document.createElement("tr");
      tr.appendChild(cell("th", p.name));
      tr.appendChild(cell("td", onRoad + " rak'ah", onRoad < p.full));
      tr.appendChild(cell("td", atDest + " rak'ah" + (verdict.atDest === "qasr-30" ? " *" : ""), atDest < p.full));
      body.appendChild(tr);
    });

    /* the fast */
    var fastRoad = verdict.enRoute === "qasr"
      ? "You do not fast while travelling. If you are fasting and set out <b>after</b> the adhan of Dhuhr, that day's fast must be completed; if you set out before it, the fast is not valid and is made up later."
      : "Fast as usual — this journey does not lift the obligation.";
    var fastDest = verdict.atDest.indexOf("qasr") === 0
      ? "You do not fast at the destination either, and the days are made up afterwards."
      : "At the destination you fast as a resident.";

    $("fasting").innerHTML =
      "<div><h3>Fasting on the road</h3><p>" + fastRoad + "</p></div>" +
      "<div><h3>Fasting at the destination</h3><p>" + fastDest + "</p></div>" +
      (verdict.atDest === "qasr-30"
        ? "<p class='hint'>* Shortened for up to thirty days in that one place; from the thirty-first day, pray in full.</p>"
        : "");

    /* the reasoning */
    var ol = $("reasons");
    ol.innerHTML = "";
    verdict.reasons.forEach(function (text) {
      var li = document.createElement("li");
      li.innerHTML = text;
      ol.appendChild(li);
    });

    /* the cautions */
    var warn = $("warnings");
    warn.innerHTML = "";
    verdict.warnings.forEach(function (w) {
      var div = document.createElement("div");
      div.className = "note" + (w.kind === "info" ? " note--info" : "");
      div.innerHTML = "<b>" + (w.kind === "info" ? "Note" : "Take care") + ".</b> " + w.text;
      warn.appendChild(div);
    });
    if (shortensSomewhere) {
      var choice = document.createElement("div");
      choice.className = "note note--info";
      choice.innerHTML = "<b>Note.</b> The shortening begins at the <i>hadd al-tarakhkhus</i> — the point at which you no longer see the people of your town, nor they you — and ends on returning within it. In Makkah, Madinah, the Masjid of Kufa and the sanctuary of Imam al-Husayn (peace be upon him), a traveller may choose between shortening and praying in full.";
      warn.appendChild(choice);
    }

    /* The panel must be on screen before the map measures itself — Leaflet
       reads the container's size, and a hidden ancestor makes that zero.     */
    $("result").hidden = false;
    drawMap(m);
  }

  function measureRow(term, value, total) {
    var div = document.createElement("div");
    if (total) div.className = "is-total";
    var dt = document.createElement("dt"); dt.textContent = term;
    var dd = document.createElement("dd"); dd.textContent = value;
    div.appendChild(dt); div.appendChild(dd);
    return div;
  }

  function cell(tag, text, isShort) {
    var node = document.createElement(tag);
    if (tag === "th") node.setAttribute("scope", "row");
    node.textContent = text;
    if (isShort) node.className = "is-short";
    return node;
  }

  function fmtDuration(minutes) {
    var h = Math.floor(minutes / 60), m = Math.round(minutes % 60);
    if (!h) return m + " min";
    return m ? h + " h " + m + " min" : h + " h";
  }

  /* ---- orchestration ----------------------------------------------------- */

  function say(text, isError) {
    var el = $("status");
    el.textContent = text || "";
    el.className = "status" + (isError ? " status--err" : "");
  }

  /* Resolve a field to coordinates: the place picked from the list if there is
     one, otherwise the best match for whatever was typed.                     */
  function resolve(slot, inputId, label) {
    if (places[slot]) return Promise.resolve(places[slot]);
    var q = $(inputId).value.trim();
    if (!q) return Promise.reject(new Error("Enter the " + label + " address."));
    return geocode(q, 1).then(function (rows) {
      if (!rows.length) throw new Error("Could not find “" + q + "”. Try adding the town and country.");
      places[slot] = rows[0];
      $(inputId).value = rows[0].label;
      return rows[0];
    });
  }

  function calculate(e) {
    if (e) e.preventDefault();
    var btn = $("calcBtn");

    /* A distance typed by hand wins, and needs neither service. */
    var typed = parseFloat($("manualKm").value);
    if (!isNaN(typed) && typed >= 0) {
      lastRoute = { km: toKm(typed), minutes: null, source: "manual" };
      render(decide(readCircumstances(lastRoute.km)));
      say("Calculated from the distance you entered.");
      $("result").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    btn.disabled = true;
    say("Finding the addresses…");

    Promise.all([
      resolve("from", "fromInput", "starting"),
      resolve("to", "toInput", "destination")
    ])
      .then(function (pair) {
        say("Measuring the road…");
        return routeKm(pair[0], pair[1]);
      })
      .then(function (route) {
        lastRoute = route;
        render(decide(readCircumstances(route.km)));
        say(route.source === "straight" ? "Routing unavailable — showing the straight-line distance." : "");
        $("result").scrollIntoView({ behavior: "smooth", block: "start" });
      })
      .catch(function (err) {
        /* A browser reports an unreachable service as "Failed to fetch", which
           tells nobody anything. Say what to do about it instead.            */
        var base = err.message || "Something went wrong. Check the addresses and try again.";
        var offline = /failed to fetch|networkerror|load failed|returned \d+/i.test(base);
        say(offline
          ? "Could not reach the address lookup. Enter the distance by hand — the panel is open above — and press Calculate."
          : base, true);
        if (offline) $("manualKm").closest("details").open = true;
      })
      .then(function () { btn.disabled = false; });
  }

  /* Recalculate from the numbers already held, without touching the network. */
  function recalc() {
    if (!lastRoute) return;
    render(decide(readCircumstances(lastRoute.km)));
  }

  function init() {
    if (!$("qasrForm")) return;   /* nothing to wire — the engine is still exported below */

    attachAutocomplete("fromInput", "fromList", "from", "fromHint");
    attachAutocomplete("toInput", "toList", "to", "toHint");

    $("qasrForm").addEventListener("submit", calculate);

    $("resetBtn").addEventListener("click", function () {
      $("qasrForm").reset();
      places = { from: null, to: null };
      lastRoute = null;
      $("result").hidden = true;
      $("fromHint").className = $("toHint").className = "hint";
      $("fromHint").textContent = "Your hometown, or wherever the journey begins.";
      $("toHint").textContent = "The furthest point you intend to reach on this journey.";
      say("");
      $("fromInput").focus();
    });

    /* Any change to the circumstances re-runs the ruling on the same distance. */
    ["qReturn", "qIntent", "qWatan", "qTenDays", "qHesitant", "qPassWatan", "qFrequent", "qSin"]
      .forEach(function (id) { $(id).addEventListener("change", recalc); });
    $("edgeKm").addEventListener("input", recalc);
    window.addEventListener("resize", function () {
      if (mapState.map && !$("mapCard").hidden) mapState.map.invalidateSize();
    });

    $("manualKm").addEventListener("input", function () {
      var v = parseFloat(this.value);
      if (!isNaN(v) && v >= 0) { lastRoute = { km: toKm(v), minutes: null, source: "manual" }; }
      recalc();
    });

    /* Ten days and hesitation are contraries — one excludes the other. */
    $("qTenDays").addEventListener("change", function () { if (this.checked) $("qHesitant").checked = false; });
    $("qHesitant").addEventListener("change", function () { if (this.checked) $("qTenDays").checked = false; });

    /* Switching units converts what is already typed, then redraws. */
    $("units").addEventListener("change", function () {
      var was = unit;
      unit = this.value;
      if (was !== unit) {
        ["edgeKm", "manualKm"].forEach(function (id) {
          var el = $(id), v = parseFloat(el.value);
          if (!isNaN(v)) el.value = (unit === "mi" ? v / KM_PER_MI : v * KM_PER_MI).toFixed(1);
        });
      }
      recalc();
    });

  }

  /* The ruling engine is exported so it can be exercised on its own — see
     test/engine.test.js. Nothing in the interface reads it back.             */
  window.QasrEngine = { decide: decide, LIMIT_KM: LIMIT_KM, FARSAKH_KM: FARSAKH_KM };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
