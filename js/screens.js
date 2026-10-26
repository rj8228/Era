"use strict";
/* Era screens. Each page returns HTML; actions live in app.js (data-act / data-in attributes). */

const btn = (t, act, arg, cls) => `<button class="btn ${cls || ""}" data-act="${act}"${arg != null ? ` data-arg="${esc(arg)}"` : ""}>${t}</button>`;
const head = (title, backTxt) => `<div class="subhd"><button class="backbtn" data-act="back">‹ ${esc(backTxt || "Back")}</button></div>${title ? `<h1>${esc(title)}</h1>` : ""}`;
const link = (label, sub, act, arg, extra) => `<button class="rowlink" data-act="${act}"${arg != null ? ` data-arg="${esc(arg)}"` : ""}><span class="grow"><b>${label}</b>${sub ? `<br><span class="tiny muted">${sub}</span>` : ""}${extra || ""}</span><span class="chev" aria-hidden="true">›</span></button>`;
const chip = (t, act, arg, on, style) => `<button class="chip" data-act="${act}" data-arg="${esc(arg)}" aria-pressed="${!!on}"${style ? ` style="${style}"` : ""}>${t}</button>`;
const stepper = (act, arg, v, lbl, unit) => `<span class="stp"><button class="step" data-act="${act}" data-arg="${esc(arg)}|-" aria-label="Less ${esc(lbl)}">−</button><b class="val">${h1(v)}${unit == null ? " h" : unit}</b><button class="step" data-act="${act}" data-arg="${esc(arg)}|+" aria-label="More ${esc(lbl)}">+</button></span>`;
const freeWeekends = to => qW(wkDays(today(), to).free);
const statsCard = () => { const t = today(), q = curQ(); return `<div class="card dark"><div class="stats"><div class="stat"><b>${Math.max(0, Math.round(freeLeftWeek()))}</b><span>free hours left this week</span></div><div class="stat"><b>${freeWeekends(qEnd(q))}</b><span>free weekends left this era</span></div><div class="stat"><b>${freeWeekends(t.slice(0, 4) + "-12-31")}</b><span>free weekends left in ${t.slice(0, 4)}</span></div></div></div>`; };
const pausedBanner = () => paused() ? `<div class="card banner">${S.pause.forever ? "The push is paused until you turn it back on." : "The push is paused until " + fmtS(S.pause.until) + "."} Logging still works.<div class="btns">${btn("Resume now", "resume", null, "sm")}</div></div>` : "";
function brutalBanner() { if (!brutal()) return ""; const o = overItems(); if (!o.length) return ""; const it = o[0], st = lessNow(it); return `<div class="card redtop slim"><b>↓ ${esc(cname(it.k))}: ${hh(st.wtd)} this week</b><span class="tiny">${hh(st.wtd - st.aim)} over your aim. That's ${costOf(st.wtd - st.aim, it.swap || S.areas[0])}.</span></div>`; }
function miniDay(bl, txt, free) { return `<div class="miniday">${dialSVG(bl, 84, { center: free != null ? hh(free) : null })}<div class="tiny muted">${txt}</div></div>`; }
const dayFree = bl => freeOf(hoursOf(bl));

/* ======================= First run ======================= */
const SETUP_STEPS = 7;
const stepTxt = n => `<div class="tiny muted stepn">Step ${n} of ${SETUP_STEPS}</div>`;
const P = {};
P.intro = () => `<div class="onb"><div class="brand big">${APPNAME}</div><div style="margin:18px 0 6px">${shapeSVG(["trips", "friends", "health", "learn", "selfcare", "family"], [{ v: { trips: 1, friends: 6, health: 2, learn: 2, selfcare: 7, family: 15 } }], 230, { mini: 1 })}</div>
  <h1 class="hero">See where your week goes. Then choose.</h1><p class="muted">Describe a normal week once. Era turns your free hours into a shape, fills each day from your usual week and your phone, and a 30-second recap each night keeps it honest.</p>
  <div class="btns">${btn("Set up my week", "next", "s_areas", "primary block")}</div><p class="tiny muted center">Everything stays on this phone.</p></div>`;
P.s_areas = () => {
  const opts = AREA_OPTS.concat(Object.keys(S.custom).filter(k => S.custom[k].kind === "area"));
  return `<div class="onb">${stepTxt(1)}<h1>What do you want more of?</h1><p class="muted">These become the corners of your shape. Pick 3 to 7.</p>
  <div class="chips">${opts.map(k => chip(esc(cname(k)), "area", k, isArea(k), `--cc:${ccol(k)}`)).join("")}${chip("+ Your own", "own-area", "", false)}</div>
  <div class="card">${shapeSVG(S.areas, [{ v: tmplWeek() }], 240, { mini: 0 })}</div>
  <p class="tiny muted">Sleep, work, commute and chores frame your day. Only free hours make the shape.</p>
  <div class="btns">${btn("Back", "back")}${btn("Next: what you want less of", "next", "s_less", "primary grow")}</div></div>`;
};
P.s_less = () => {
  const opts = LESS_OPTS.concat(Object.keys(S.custom).filter(k => S.custom[k].kind === "less"));
  return `<div class="onb">${stepTxt(2)}<h1>What do you want less of?</h1><p class="muted">Only you decide this. Scrolling can be rest for one person and a drain for another.</p>
  <div class="chips">${opts.map(k => chip(esc(cname(k)), "lessk", k, isLess(k))).join("")}${chip("+ Your own", "own-less", "", false)}${chip("Nothing for now", "less-none", "", !S.less.length)}</div>
  ${S.less.length ? `<div class="card less watch"><div class="lhd"><b>↓ ${esc(L("less"))} · watching</b><span class="tiny muted">no aim yet</span></div>${S.less.map(it => `<div class="lrow"><span>${esc(cname(it.k))}</span><span class="tiny muted">about ${hh(usualOf(it.k))} a week now</span></div>`).join("")}</div>` : ""}
  <div class="card tiny"><b>No aim yet.</b> For two weeks Era only watches. Then it shows you what it saw, and you decide if anything should change.</div>
  <div class="btns">${btn("Back", "back")}${btn("Next: how hard to push", "next", "s_push", "primary grow")}</div></div>`;
};
const PUSH = [["gentle", "Gentle", "A quiet red bar. No fuss."], ["honest", "Honest", "Red grows on Today and your shape fades until you're back under."], ["brutal", "Brutal", "Red tops every tab and turns hours into what they cost you."]];
const pushOpts = () => PUSH.map(([k, t, d]) => `<button class="opt" data-act="push" data-arg="${k}" aria-pressed="${S.push === k}"><b>${t}</b><span class="tiny muted">${d}</span></button>`).join("");
P.s_push = () => `<div class="onb">${stepTxt(3)}<h1>How hard should Era push?</h1><p class="muted">When you go over an aim for something you want less of, the app gets…</p>${pushOpts()}
  <p class="tiny muted">It never blocks you, and nothing red shows outside the app. Change it any time in Me.</p>
  <div class="btns">${btn("Back", "back")}${btn("Next: check the mapping", "next", "s_map", "primary grow")}</div></div>`;
function mapRows() {
  return MAP_ACTS.map(a => { const k = catOf(a); return `<button class="rowlink" data-act="map" data-arg="${a}"><span class="grow">${esc(ACTS[a].n)}${ACTS[a].hint ? `<br><span class="tiny muted">${esc(ACTS[a].hint)}</span>` : ""}</span><b style="color:${kindOf(k) === "less" ? "var(--warn)" : "var(--ink)"}">${kindOf(k) === "less" ? esc(L("less")) + ": " : ""}${esc(kindOf(k) === "neutral" && k === "other" ? "Neutral" : cname(k))}</b><span class="chev">›</span></button>`; }).join("");
}
const shareToggle = () => `<button class="toggle" data-act="sharewith" aria-pressed="${!!S.shareWith}"><span class="grow"><b>With people, count it for them</b><br><span class="tiny muted">A movie with family counts for Family, and also shows as shared Self-care</span></span><i class="tg"></i></button>`;
P.s_map = () => `<div class="onb">${stepTxt(4)}<h1>Where does each thing count?</h1><p class="muted">Every hour goes to More of, ${esc(L("less"))} or Neutral. Tap any you see differently.</p>
  <div class="card list">${mapRows()}</div>${shareToggle()}
  <div class="btns">${btn("Back", "back")}${btn("Looks right", "next", "s_paint", "primary grow")}</div></div>`;
const BRUSHES = () => ["sleep", "work", "commute", "chores", "scroll", "family", "friends", "gym", "study", "rest", "tv", "trip", "other"].map(a => ({ a, k: catOf(a) })).concat(Object.keys(S.custom).filter(k => S.custom[k].kind === "area").map(k => ({ k })));
let brush = "gym";
function paintBody() {
  return `<div class="chips">${Object.keys(PRESETS).map(k => chip(PRESETS[k].n, "preset", k, S.week.preset === k)).join("")}</div>
  <div class="tiny muted" style="margin:10px 0 4px">Workdays</div><div class="chips">${[1, 2, 3, 4, 5, 6, 0].map(d => chip(DOW[d], "workday", d, S.week.workdays.includes(d))).join("")}</div>
  <div class="tiny muted" style="margin:10px 0 4px">Pick a colour, then swipe down a column</div>
  <div class="chips brushes">${BRUSHES().map(b => { const id = b.a || "k:" + b.k; return `<button class="chip brush" data-act="brush" data-arg="${id}" aria-pressed="${brush === id}" style="--cc:${ccol(b.k)}">${esc(b.a ? ACTS[b.a].n : cname(b.k))}</button>`; }).join("")}</div>
  <div id="paintwrap">${paintHTML()}</div>
  <p class="tiny muted">${hh(freeOf(tmplWeek()))} free a week · workdays: ${hh(freeOf(hoursOf(tmplFor(true))))} free · days off: ${hh(freeOf(hoursOf(tmplFor(false))))} free</p>`;
}
P.s_paint = () => `<div class="onb">${stepTxt(5)}<h1>Paint your normal week</h1><p class="muted">Start from the closest preset, then paint what's different.</p>${paintBody()}
  <div class="btns">${btn("Back", "back")}${btn("Next: screen time", "next", "s_st", "primary grow")}</div></div>`;
function stIntro() {
  if (!NATIVE() || !NATIVE().stStatus) return `<div class="card tiny">Screen time works in the Android app: Era reads how long each app was open, so you don't have to guess. In a browser, you log by hand.</div>`;
  const g = stGranted();
  return `<div class="card tiny lh">✓ Totals per app, read on this phone<br>✓ Never leaves the phone, never uploaded<br>✗ Era can't see what you do inside apps</div>
  ${g ? `<div class="card good">Usage access is on. ${S.st.on ? "Era reads your screen time." : ""}</div>` : `<p class="tiny muted">Android opens a settings page. Turn on <b>Usage access</b> for Era, then come back.</p>`}
  <div class="btns">${g ? (S.st.on ? "" : btn("Use screen time", "st-on", null, "primary block")) : btn("Allow usage access", "st-allow", null, "primary block")}</div>`;
}
P.s_st = () => `<div class="onb">${stepTxt(6)}<h1>Use your real screen time</h1><p class="muted">Android already counts how long each app is open. Era can read those totals to fill your day and keep ${esc(L("less").toLowerCase())} honest.</p>${stIntro()}
  <div class="btns">${btn("Back", "back")}${btn(S.st.on ? "Next: your shape" : "Not now, next", "next", "s_shape", "grow" + (S.st.on || !NATIVE() ? " primary" : ""))}</div></div>`;
P.s_shape = () => { const tw = tmplWeek(), q = curQ(); return `<div class="onb">${stepTxt(7)}<h1>Your ${Math.round(freeOf(tw))} free hours a week</h1>
  <div class="card">${shapeSVG(S.areas, [{ v: tw }], 300)}</div>
  ${S.less.length ? `<div class="card less watch"><div class="lhd"><b>↓ ${esc(L("less"))} · watching</b><span class="tiny muted">for 2 weeks</span></div>${S.less.map(it => `<div class="lrow"><span>${esc(cname(it.k))}</span><span class="tiny muted">${hh(tw[it.k] || 0)} on a normal week</span></div>`).join("")}</div>` : ""}
  <label class="f" for="o-era">Name this era (${qLabel(q)})</label><input type="text" id="o-era" placeholder="my fitness era" value="${esc(eraName(q))}">
  <div class="btns">${btn("Back", "back")}${btn("Start my era", "finish", null, "primary grow")}</div></div>`; };

/* ======================= Today ======================= */
function missedDays() {
  const t = today(); let from = addD(t, -14);
  if (S.onboardedAt && S.onboardedAt > from) from = S.onboardedAt;
  if (S.skipBefore && S.skipBefore > from) from = S.skipBefore;
  const out = []; eachDay(from, addD(t, -1), d => { if (!logged(d) && !awayOn(d)) out.push(d); }); return out;
}
P.today = () => {
  const t = today(), q = curQ(), lg = logged(t);
  let h = `<h1>${DOWL[dowOf(t)]}</h1><p class="muted">${fmtS(t)}</p>`;
  h += pausedBanner();
  if (S.migratedFrom === 1 && !S.seen.migrated) h += `<div class="card tip"><b>Era 0.2 is here</b><p class="tiny" style="margin:4px 0 0">Your days, plans and eras moved over. Each day is now a 24-hour dial, filled from your normal week. Doomscroll is now <b>Social media</b> under ${esc(L("less"))}: Era watches it for two weeks before asking about an aim. Rest is now Self-care, a corner of your shape.</p><div class="btns">${btn("Got it", "seen", "migrated", "sm")}${btn("Check the mapping", "go", "m_map", "sm")}</div></div>`;
  // Over an aim: red takes the top (Honest and Brutal).
  if (pushing()) overItems().slice(0, 1).forEach(it => { const st = lessNow(it), left = 6 - ((dowOf(t) + 6) % 7);
    h += `<div class="card redtop"><div class="lhd"><b>↓ ${esc(cname(it.k))}</b><span class="tiny">${left ? left + " day" + (left > 1 ? "s" : "") + " left" : "last day"}</span></div><div class="bignum">${hh(st.wtd)}</div><div class="bar lbar big"><i style="width:100%"></i><u style="left:${st.aim / st.wtd * 100}%"></u></div><p class="tiny" style="margin:6px 0 0">${hh(st.wtd - st.aim)} over your aim of ${h1(st.aim)}. That's ${evening(st.wtd - st.aim)}.${brutal() ? ` It's ${costOf(st.wtd, it.swap || S.areas[0])} you didn't have.` : ""}${it.identity ? `<br>“${esc(it.identity)}”` : ""}</p></div>`; });
  // Missed days / welcome back
  const miss = missedDays();
  if (miss.length && S.returned === t) h += `<div class="card"><h3>Welcome back</h3><p class="tiny" style="margin:4px 0 0">${miss.length} days to catch up. Two taps each, or skip them. There's no red waiting. Your aims start again from today.</p><div class="btns">${btn("Catch up " + miss.length + " days", "go", "catchup", "primary grow")}${btn("Skip to today", "skip-missed", null, "grow")}</div></div>`;
  else if (miss.length) h += `<button class="card rowcard warnline" data-act="go" data-arg="catchup"><span class="grow"><b>${miss.length} day${miss.length > 1 ? "s" : ""} not logged</b><br><span class="tiny muted">${miss.slice(0, 3).map(d => DOW[dowOf(d)]).join(", ")}${miss.length > 3 ? "…" : ""}. Confirm them in one go.</span></span><span class="chev">›</span></button>`;
  // Lock-ins that ended
  S.goals.filter(g => !g.closed && g.end < t).forEach(g => { h += `<div class="card"><span class="tag blue">${esc(L("lockin"))} is over</span><h3 style="margin-top:6px">${esc(g.title)}</h3><p class="tiny muted" style="margin:4px 0">You chose it because</p><p><b>“${esc(g.why || "you didn't write a reason")}”</b></p><p class="tiny muted">${h1(goalDone(g))} of ${g.total} h logged. Did it happen?</p><div class="btns">${btn("It happened", "goal-end", g.id + "|done", "sm primary")}${btn("Partly", "goal-end", g.id + "|part", "sm")}${btn("Not this time", "goal-end", g.id + "|no", "sm")}</div></div>`; });
  // Back from a trip: one energy check
  const bk = tripBack(t);
  if (bk) h += `<div class="card tip"><span class="tag blue">Back from a trip</span><h3 style="margin-top:6px">${esc(bk.title)}</h3><p class="tiny muted" style="margin:4px 0 6px">${spanLabel(bk, true)}. One question: how's your energy now?</p>${backDots(bk)}<div class="btns">${btn("We didn't go", "quest", bk.id + "|dropped", "sm")}${btn("Skip", "trip-skip", bk.id, "sm")}</div></div>`;
  h += statsCard();
  // Today's dial, or a trip
  const trip = awayOn(t);
  if (trip) { const r = qSpan(trip), n = diffD(r[0], t) + 1, all = daysIn(r[0], r[1]);
    h += `<div class="card trip"><div class="row"><span class="tripicon" aria-hidden="true">🧳</span><span class="grow"><b>${esc(trip.title)}</b><br><span class="tiny muted">On a trip · day ${n} of ${all}${r[1] > t ? " · back " + fmtD(addD(r[1], 1)) : " · last day"}</span></span></div><p class="tiny" style="margin:8px 0 0">Nothing to log on trip days. They don't count for or against anything.</p><div class="btns">${btn("Edit dates", "quest-edit", trip.id, "sm")}${n > 1 ? btn("I'm back early", "trip-back", trip.id, "sm") : ""}</div></div>`; }
  else if (lg) {
    const bl = S.logs[t].blocks, rc = reclaimed(t, t);
    h += `<div class="card"><div class="row"><h3 class="grow">Today ✓</h3><button class="linkbtn" data-act="go" data-arg="dial" data-d="${t}">Edit ›</button></div>${miniDay(bl, rc.tot > 0 ? `+${hh(rc.tot)} ${esc(Object.keys(rc.to).map(cname).join(", ") || "free time")} instead of ${esc(S.less.map(x => cname(x.k).toLowerCase()).join(" or "))}.` + (S.logs[t].good ? `<br>“${esc(S.logs[t].good)}”` : "") : (S.logs[t].good ? `“${esc(S.logs[t].good)}”` : "Logged. Your shape is up to date."), dayFree(bl))}</div>`;
    if (rc.tot > 0) { const era = reclaimed(qStart(q), t); h += `<div class="card dark center"><div class="bignum">+${hh(rc.tot)} ${esc(L("reclaimed").toLowerCase())}</div><div class="tiny">${esc(S.less.filter(it => (hoursOf(tmplBlocks(t))[it.k] || 0) > (hoursOf(bl)[it.k] || 0)).map(it => cname(it.k)).join(", "))} → ${esc(Object.keys(rc.to).map(cname).join(", ") || "free time")}</div><div class="tiny" style="opacity:.8;margin-top:4px">${esc(L("reclaimed"))} this era <b>${hh(era.tot)}</b></div></div>`; }
  } else {
    const bl = autoFill(t), src = stSlots(t) ? " and your phone" : "";
    h += `<div class="card"><div class="dialwrap">${dialSVG(bl, 210, { center: hh(dayFree(bl)), sub: "free today", now: nowH() })}</div><p class="tiny muted center">Filled from your usual ${DOWL[dowOf(t)]}${src}</p><div class="btns">${btn("Looks right", "looks", t, "primary grow")}${btn("Check today", "go", "fill", "grow")}</div></div>`;
  }
  // Shape fades while over
  if (pushing() && overItems().length) { const mon = mondayOf(t); h += `<div class="card row">${shapeSVG(S.areas, [{ v: actualRange(mon, t), kind: "dull" }], 96, { mini: 1 })}<p class="tiny muted grow" style="margin:0">Your shape fades while you're over. One good day starts bringing the colour back.</p></div>`; }
  h += lessCard(mondayOf(t));
  h += screenTimeCard(t);
  // Active lock-ins
  S.goals.filter(g => !g.closed && g.start <= t && g.end >= t).forEach(g => { const done = goalDone(g), days = Math.max(1, daysIn(t, g.end)); h += `<div class="card"><h3>${esc(g.title)}</h3><div class="bar" style="margin:8px 0"><i style="width:${Math.min(100, done / g.total * 100)}%;background:${ccol(g.area)}"></i></div><p class="tiny muted">${h1(done)} of ${g.total} h · ${hh(Math.max(0, (g.total - done) / days))} a day keeps you on track</p>${btn("Log 1 h of " + esc(g.title.toLowerCase()), "goal-hour", g.id, "primary block sm")}</div>`; });
  // Side quests this week
  const mon = mondayOf(t), open = S.quests.filter(x => x.status === "open" && inWeek(x, mon));
  if (open.length) h += `<h2>${esc(L("quests"))} this week</h2><div class="card list">${open.map(questRow).join("")}</div>`;
  if ([5, 6, 0].includes(dowOf(t)) && !(S.retros[mon] && S.retros[mon].at)) h += link(esc(L("week")), "3 minutes on how the week went", "go", "receipt");
  if (NATIVE() && NATIVE().setWidget && !S.seen.widgetTip) h += `<div class="card tip"><b>Add Era to your home screen</b><p class="tiny" style="margin:4px 0 0">Long-press your home screen → Widgets → Era. Log a normal day with one tap, see today's dial and the weekends left. Widgets stay neutral: no red.</p><div class="btns">${btn("Got it", "seen", "widgetTip", "sm")}</div></div>`;
  return h;
};
function screenTimeCard(d) {
  if (!S.st.on || !NATIVE()) return "";
  const v = stDay(d); if (!v) return "";
  const tot = stTotal(d) || 0, aim = S.st.aim * 60, over = tot > aim;
  const apps = (v.apps || []).slice().sort((a, b) => b.min - a.min).slice(0, 4), max = Math.max(1, ...apps.map(a => a.min));
  return `<div class="card less${over ? " over" : ""}"><div class="lhd"><b>↓ Screen time today</b><span class="tiny muted">live · Android</span></div><div class="row" style="align-items:baseline"><span class="bignum warnc">${hmin(tot)}</span><span class="tiny muted">of ${hh(S.st.aim)} aim</span></div><div class="bar lbar"><i style="width:${Math.min(100, tot / Math.max(aim, tot) * 100)}%"></i>${tot > aim ? `<u style="left:${aim / tot * 100}%"></u>` : ""}</div>
  ${apps.map(a => { const k = appCat(a.pkg, a.hint); return `<div class="lrow"><span>${esc(a.label || a.pkg)}</span><div class="bar"><i style="width:${a.min / max * 100}%;background:${k ? ccol(k) : "var(--line2)"}"></i></div><b>${hmin(a.min)}</b></div>${k && isArea(k) ? `<div class="tiny muted" style="margin:-2px 0 2px">counts for ${esc(cname(k))}, not against you</div>` : ""}`; }).join("")}
  <p class="tiny" style="margin:6px 0 0">${tot < aim ? `<b>${hmin(aim - tot)} left today.</b>` : `<b>${hmin(tot - aim)} over today.</b>`}</p></div>`;
}
const inWeek = (x, mon) => { const r = qSpan(x); return r ? r[0] <= addD(mon, 6) && r[1] >= mon : x.when === "week" && x.week === mon; };
/* A trip that ended in the last two weeks and hasn't had its energy check. */
const tripBack = t => S.quests.filter(x => live(x) && isAway(x) && !x.back && qSpan(x)[1] < t && qSpan(x)[1] >= addD(t, -14)).sort((a, b) => qSpan(a)[1] < qSpan(b)[1] ? 1 : -1)[0] || null;
const backDots = x => `<div class="edots" role="group" aria-label="Energy after ${esc(x.title)}">${BACK.map((n, i) => `<button class="edot e${i}" data-act="trip-energy" data-arg="${x.id}|${i - 2}" aria-label="${n}">${i > 2 ? "+" + (i - 2) : i < 2 ? "−" + (2 - i) : "0"}</button>`).join("")}</div><div class="elabels"><span class="warnc">drained</span><span class="muted">same</span><span class="goodc">recharged</span></div>`;
function questRow(x) {
  const when = spanLabel(x), away = isAway(x) ? "🧳 " : "", back = x.back && x.back.e != null ? " · ⚡ " + BACK[x.back.e + 2].toLowerCase() : "";
  return `<div class="li"><button class="grow blkbtn" data-act="quest-edit" data-arg="${x.id}" aria-label="Edit ${esc(x.title)}"><b>${away}${esc(x.title)}</b><br><span class="tiny muted">${sw(ccol(x.area))}${esc(cname(x.area))} · ${when}${x.moved ? " · moved " + x.moved + "×" : ""}${back}</span></button>${x.status === "open" ? btn("Done", "quest", x.id + "|done", "sm") + btn("Move", "quest", x.id + "|moved", "sm") + `<button class="icon-btn" data-act="quest" data-arg="${x.id}|dropped" aria-label="Drop ${esc(x.title)}">✕</button>` : `<span class="tag ${x.status === "done" ? "good" : ""}">${x.status}</span>`}</div>`;
}

/* What Era filled */
const lastNight = b => b.s === 0 && b.e <= 12 ? "last night, " : "";
P.fill = a => {
  const d = a.d || today(); ensureDraft(d, true);
  const rows = draft.blocks.map((b, i) => { const src = b.check ? "check" : b.src === "phone" ? "Screen time" : b.src === "edited" ? "You changed it" : b.src === "auto" || b.src === "usual" ? "Your usual" : "Logged"; const ph = b.src === "phone" ? stPhoneText(d, b) : "";
    return `<button class="li" data-act="pick" data-arg="${i}"><i class="vbar" style="background:${ccol(b.k)}"></i><span class="grow"><b>${esc(ph || blockLabel(b))}</b><br><span class="tiny muted">${lastNight(b)}${span(b.s, b.e)} · ${src === "check" ? "phone and usual disagree" : src}</span></span>${b.check ? `<span class="pdot" aria-label="Check this one"></span>` : "✓"}<span class="chev" aria-hidden="true">›</span></button>`; }).join("");
  const checks = draft.blocks.filter(b => b.check).length;
  return `${head(DOWL[dowOf(d)], d === today() ? "Today" : "Back")}<p class="muted">${fmtS(d)} · filled from your ${stSlots(d) ? "phone and your " : ""}usual ${DOWL[dowOf(d)]}</p>
  <div class="card list"><h3>Era filled ${checks ? "most of" : ""} ${d === today() ? "today" : "this day"}</h3><p class="tiny muted">${checks ? `Check the ${checks === 1 ? "one" : checks} with a dot. ` : ""}Tap any block to change it.</p>${rows}</div>
  ${btn("+ Add something", "pick-add", null, "block")}
  <div class="btns">${btn("Looks right", "save-draft", null, "primary block")}${btn("Swipe through to check", "swipe", d, "block")}<button class="btn block" data-act="go" data-arg="dial" data-d="${d}">Fine-tune on the dial</button></div>`;
};
function stPhoneText(d, b) { const v = stDay(d); if (!v) return ""; const apps = (v.apps || []).filter(x => appCat(x.pkg, x.hint) === b.k); let m = 0; const names = []; apps.forEach(x => { let mm = 0; for (let i = Math.round(b.s * 2); i < Math.round(b.e * 2); i++) mm += (v.slots[x.pkg] || [])[i] || 0; if (mm > 5) { m += mm; names.push(x.label); } }); return names.length ? names.slice(0, 2).join(", ") + " " + hmin(m) : ""; }

/* Swipe the recap */
P.swipe = a => {
  const d = a.d; ensureDraft(d, true); const bl = draft.blocks;
  const i = bl.findIndex(b => b.s >= (draft.pos || 0) - 1e-6); if (i < 0) return `${head("Done")}<p class="muted">All blocks checked.</p>${btn("Fine-tune on the dial", "go", "dial", "primary block")}`;
  const b = bl[i];
  return `${head(DOWL[dowOf(d)] + ", block by block", "Back")}<p class="muted">Swipe right if it happened. Left to change it.</p>
  <div class="swipe"><div class="scard back"></div><div class="scard" id="scard" data-i="${i}"><div class="sbar" style="background:${ccol(b.k)}"></div><div class="stime">${span(b.s, b.e)}</div><div class="sq">${esc(blockLabel(b))}?</div><div class="tiny muted">${b.src === "phone" ? "from your phone" : b.check ? "your phone saw something else here" : "your usual " + DOWL[dowOf(d)]}</div><div class="stamp yes">YES</div><div class="stamp no">CHANGED</div></div></div>
  <div class="swbtns"><button class="btn warnb" data-act="sw-no">← Changed</button><span class="tiny muted">${i + 1} of ${bl.length}</span><button class="btn goodb" data-act="sw-yes">Happened →</button></div>
  <div class="btns">${btn("Skip to the dial", "go", "dial", "sm")}</div>`;
};

/* The dial editor */
P.dial = a => {
  const d = a.d || today(); ensureDraft(d, false); const bl = draft.blocks;
  const mism = logged(d) || draft.dirty ? bl.map((b, i) => ({ i, m: isArea(b.k) && !b.okphone ? stInBlock(d, b) : null })).filter(x => x.m && x.m.min >= 15) : [];
  return `${head(fmtD(d), d === today() ? "Today" : "Back")}<p class="tiny muted">Drag a handle to move where one block ends and the next begins. Tap a part of the dial to change it.</p>
  <div class="card dialcard"><div class="dialwrap" id="dialwrap">${dialSVG(bl, 300, { edit: true, center: hh(dayFree(bl)), sub: "free", id: "dialsvg" })}</div><p class="tiny muted center" id="dialtot">24 h · ${hh(dayFree(bl))} free</p></div>
  ${mism.map(x => `<div class="card mism"><b>${span(bl[x.i].s, bl[x.i].e)} · ${esc(cname(bl[x.i].k))}</b><p class="tiny" style="margin:4px 0">Your phone shows <b>${hmin(x.m.min)} of ${esc(cname(x.m.k).toLowerCase())}</b> in this block.</p>${btn("Check it", "mismatch", x.i, "sm")}</div>`).join("")}
  <div class="card list" id="blist">${blockList(bl)}</div>
  ${btn("+ Add something", "pick-add", null, "block")}
  <label class="f" for="d-good">One good thing</label><input type="text" id="d-good" data-in="good" value="${esc(draft.good || "")}" placeholder="First run in weeks">
  <div class="seg" role="group" aria-label="Energy" style="margin-top:10px">${[["low", "Drained"], ["okay", "Okay"], ["high", "Full of it"]].map(([k, n]) => `<button data-act="energy" data-arg="${k}" aria-pressed="${draft.energy === k}">${n}</button>`).join("")}</div>
  <div class="btns sticky">${btn("Reset to usual", "reset-day")}${btn("Save day", "save-draft", null, "primary grow")}</div>`;
};
function blockList(bl) {
  return bl.map((b, i) => `<div class="li blk"><i class="vbar" style="background:${ccol(b.k)}"></i><button class="grow blkbtn" data-act="pick" data-arg="${i}"><b>${esc(blockLabel(b))}</b>${b.sh ? ` <span class="tag blue">+ ${esc(cname(b.sh))} shared</span>` : ""}${b.wo ? ` <span class="tag">${{ yes: "worth it", meh: "meh", no: "not worth it" }[b.wo]}</span>` : ""}<br><span class="tiny muted">${lastNight(b)}${span(b.s, b.e)} · ${hh(b.e - b.s)}</span></button>${i < bl.length - 1 ? `<span class="stp"><button class="step" data-act="edge" data-arg="${i}|-" aria-label="End ${esc(blockLabel(b))} earlier">−</button><button class="step" data-act="edge" data-arg="${i}|+" aria-label="End ${esc(blockLabel(b))} later">+</button></span>` : ""}</div>`).join("");
}

/* Catch up */
P.catchup = () => {
  const miss = missedDays();
  if (!miss.length) return `${head("Catch up", "Today")}<div class="card good">All caught up.</div>${btn("Back to today", "home", null, "primary block")}`;
  return `${head("Catch up", "Today")}<p class="muted">Most days are your usual. Fix only what changed.</p><div class="card list">${miss.slice().reverse().map(d => { const bl = autoFill(d), tx = stDiffText(d); return `<div class="li">${dialSVG(bl, 46)}<span class="grow"><b>${fmtD(d)}</b><br><span class="tiny muted">${tx || (isWorkday(d) ? "usual workday" : "usual day off")}</span></span>${btn("Looks right", "looks", d, "sm" + (tx ? "" : " primary"))}${btn("Swipe", "swipe", d, "sm")}</div>`; }).join("")}</div>
  <div class="btns">${btn("All look right", "looks-all", null, "primary block")}</div>`;
};
function stDiffText(d) { const sl = stSlots(d); if (!sl) return ""; const parts = []; for (const k in sl) { const m = sl[k].reduce((a, b) => a + b, 0), us = (hoursOf(tmplBlocks(d))[k] || 0) * 60; if (Math.abs(m - us) >= 60) parts.push("phone: " + hmin(m) + " " + cname(k).toLowerCase()); } return parts.join(" · "); }

/* ======================= Week ======================= */
let weekOf = null;
function planRange(a, b) { const o = {}, q = qOf(a); eachDay(a, b, d => { if (awayOn(d)) return; addTo(o, hoursOf(tmplBlocks(d))); addTo(o, planDelta(q, d), 1 / 7); }); for (const k in o) o[k] = Math.max(0, o[k]); return o; }
P.week = () => {
  const t = today(); if (!weekOf) weekOf = mondayOf(t);
  const mon = weekOf, sun = addD(mon, 6), last = sun < t ? sun : t, started = mon <= t;
  let h = `<div class="weeknav"><button class="icon-btn" data-act="wk" data-arg="-7" aria-label="Previous week">‹</button><b>${fmtS(mon)} – ${fmtS(sun)}${mon === mondayOf(t) ? " · this week" : ""}</b><button class="icon-btn" data-act="wk" data-arg="7" aria-label="Next week">›</button></div>`;
  h += pausedBanner() + (mon === mondayOf(t) ? brutalBanner() : "");
  if (!started) return h + `<div class="card"><p class="muted">This week hasn't started. Plan: ${hh(freeOf(planWeek(qOf(mon))))} of free time.</p>${shapeSVG(S.areas, [{ v: planWeek(qOf(mon)) }], 280)}</div>`;
  const act = actualRange(mon, last), plan = planRange(mon, last), sh = sharedRange(mon, last);
  let away = 0; eachDay(mon, last, d => { if (awayOn(d)) away++; });
  const nLogged = Object.keys(S.logs).filter(d => d >= mon && d <= sun && logged(d) && !awayOn(d)).length, elapsed = daysIn(mon, last) - away;
  const fade = mon === mondayOf(t) && pushing() && overItems().length;
  if (!elapsed) h += `<div class="card trip"><div class="row"><span class="tripicon" aria-hidden="true">🧳</span><p class="grow" style="margin:0">On a trip so far this week. Trip days don't count, so there's nothing to compare yet.</p></div></div>`;
  else h += `<div class="card">${shapeSVG(S.areas, [{ v: plan, kind: "plan" }].concat(Object.keys(sh).length ? [{ v: act, extra: sh, kind: "shared" }] : []).concat([{ v: act, kind: fade ? "dull" : "actual" }]), 300, { label: "This week against the plan" })}${legend("Plan", fade ? "This week (faded: over an aim)" : "This week", Object.keys(sh).length ? "Shared" : "")}<p class="tiny muted center">${elapsed} of ${7 - away} days · ${nLogged} logged${away ? " · " + away + " on a trip, not counted" : ""} · unlogged days count as usual</p></div>`;
  if (elapsed) h += `<div class="card">${S.areas.map(k => { const a = act[k] || 0, p = plan[k] || 0; return `<div class="cmp"><span>${sw(ccol(k))}${esc(cname(k))}</span><div class="bar"><i style="width:${Math.min(100, p ? a / p * 100 : a ? 100 : 0)}%;background:${ccol(k)}"></i></div><span class="t">${h1(a)} of ${h1(p)}${sh[k] ? `<br><span class="tiny muted">+${h1(sh[k])} shared</span>` : ""}</span></div>`; }).join("")}</div>`;
  h += lessCard(mon);
  const usualWork = (() => { let o = 0; eachDay(mon, last, d => { if (!awayOn(d)) o += hoursOf(tmplBlocks(d)).work || 0; }); return o; })();
  const work = (act.work || 0) + (act.overtime || 0), ot = Math.max(0, work - usualWork), sleepAvg = (act.sleep || 0) / (elapsed || 1);
  if (elapsed) h += `<p class="tiny frameline">Work ${hh(work)}${ot > 0.01 ? `, <b class="amber">${hh(ot)} overtime</b>` : ""} · sleep ${h1(sleepAvg)} h a night${sleepAvg < 7 - 0.01 ? `, <b class="amber">below 7–8</b>` : sleepAvg > 9.5 ? `, <b class="amber">above 7–9</b>` : ""}</p>`;
  // Observe → decide → shift
  if (mon === mondayOf(t)) {
    const ready = S.less.filter(it => it.aim == null && !it.ladder && it.since && diffD(it.since, t) >= 14 && !(it.observed && diffD(it.observed, t) < 28));
    if (ready.length) h += `<button class="card rowcard tip" data-act="go" data-arg="observe"><span class="grow"><b>2 weeks of watching</b><br><span class="tiny muted">See what Era noticed, and decide if anything should change.</span></span><span class="chev">›</span></button>`;
    S.less.filter(it => it.ladder).forEach(it => { h += ladderCard(it); });
  }
  if (S.st.on && NATIVE()) h += stWeekCard(mon);
  const R = S.retros[mon] || {};
  h += R.at ? link(esc(L("week")) + " done", esc(R.change ? "Change: " + R.change : "Saved"), "go", "receipt") : `<div class="btns">${btn("Do the " + esc(L("week").toLowerCase()), "go", "receipt", "primary block")}</div>`;
  h += `<h2>Days</h2><div class="card list">${[...Array(7)].map((_, i) => addD(mon, i)).filter(d => d <= t).map(d => { const lg = logged(d), bl = dayBlocks(d), tr = awayOn(d); if (tr) return `<div class="li dayrow away"><span class="tripicon" aria-hidden="true">🧳</span><span class="grow"><b>${fmtD(d)}</b><br><span class="tiny muted">On a trip · ${esc(tr.title)}</span></span></div>`; return `<button class="li dayrow" data-act="go" data-arg="dial" data-d="${d}">${dialSVG(bl, 42)}<span class="grow"><b>${fmtD(d)}</b><br><span class="tiny muted">${lg ? (S.logs[d].good ? esc(S.logs[d].good) : "logged · " + hh(dayFree(bl)) + " free") : "not logged · counts as usual"}</span></span><span class="chev">›</span></button>`; }).join("")}</div>`;
  const qs = S.quests.filter(x => inWeek(x, mon));
  if (qs.length) h += `<h2>${esc(L("quests"))} this week</h2><div class="card list">${qs.map(questRow).join("")}</div>`;
  return h;
};
function ladderCard(it) {
  const t = today(), mon = mondayOf(t), st = lessNow(it, mon), steps = it.ladder.steps, idx = Math.floor(diffD(it.ladder.start, mon) / 7);
  const maxv = Math.max(it.base || 1, ...steps);
  let bars = `<div class="ladder">${[it.base].concat(steps).map((v, i) => { const wk = addD(it.ladder.start, (i - 1) * 7), done = i > 0 && wk < mon && (actualRange(wk, addD(wk, 6))[it.k] || 0) <= v + 0.01, curr = i - 1 === idx; return `<div class="lstep${done ? " done" : ""}${curr ? " cur" : ""}"><i style="height:${Math.max(6, v / maxv * 54)}px"></i><span>${h1(v)}</span></div>`; }).join("")}</div>`;
  // Never miss twice: days over the daily pace this week
  const per = (st.aim || 0) / 7; const slips = []; eachDay(mon, t, d => { if (logged(d) && (hoursOf(S.logs[d].blocks)[it.k] || 0) > per + 0.01) slips.push(d); });
  let nmt = "No slips yet"; if (slips.length) { const s = slips[slips.length - 1], nx = addD(s, 1); nmt = "Slip " + DOW[dowOf(s)] + (nx <= t && logged(nx) && !slips.includes(nx) ? " · back " + DOW[dowOf(nx)] + " ✓" : nx <= t && slips.includes(nx) ? " · two in a row, start fresh today" : ""); }
  const rc = reclaimed(t.slice(0, 8) + "01", t);
  const cleared = idx > 0 && (actualRange(addD(mon, -7), addD(mon, -1))[it.k] || 0) <= (steps[idx - 1] || it.base) + 0.01;
  return `<div class="card">${cleared ? `<div class="card dark center inner"><div class="bignum">Step ${idx} cleared</div><div class="tiny">${esc(cname(it.k))} last week was under ${h1(steps[idx - 1])} h</div></div>` : ""}<div class="lhd"><b>Ladder · ${esc(cname(it.k))}</b><span class="tiny muted">${idx < 0 ? "starts " + fmtS(it.ladder.start) : idx < steps.length ? "step " + (idx + 1) + " of " + steps.length : "at your aim"}</span></div>${bars}
  <div class="li"><span class="grow tiny">This week</span><b class="${st.over ? "warnc" : ""}">${hh(st.wtd)} of ${hh(st.aim)}</b></div><div class="li"><span class="grow tiny">Never miss twice</span><b class="tiny">${nmt}</b></div><div class="li"><span class="grow tiny">${esc(L("reclaimed"))} this month</span><b class="goodc">+${hh(rc.tot)}${it.swap ? " → " + esc(cname(it.swap)) : ""}</b></div>${it.identity ? `<div class="li"><span class="grow tiny">“${esc(it.identity)}”</span></div>` : ""}</div>`;
}
function stWeekCard(mon) {
  const days = [...Array(7)].map((_, i) => addD(mon, i)); const vals = days.map(d => d <= today() ? (stTotal(d) || 0) / 60 : null);
  const max = Math.max(S.st.aim * 1.5, ...vals.filter(v => v != null)); const under = vals.filter(v => v != null && v <= S.st.aim).length, tot = vals.reduce((a, v) => a + (v || 0), 0);
  return `<div class="card"><div class="lhd"><b>Screen time</b><span class="tiny muted">from Android, not typed</span></div><div class="stbars">${vals.map((v, i) => `<div><i style="height:${v == null ? 0 : v / max * 100}%;background:${v > S.st.aim ? "var(--warnbar)" : "var(--goodbar)"}"></i><span>${DOW[dowOf(days[i])][0]}</span></div>`).join("")}<u style="bottom:calc(${S.st.aim / max * 100}% + 16px)"></u></div><div class="li"><span class="grow tiny">Days under your ${hh(S.st.aim)} aim</span><b>${under} of ${vals.filter(v => v != null).length}</b></div><div class="li"><span class="grow tiny">Week total</span><b>${hh(tot)}</b></div></div>`;
}
/* Vibe check: receipt → what went well → next week → saved */
P.receipt = () => {
  const mon = weekOf || mondayOf(today()), sun = addD(mon, 6), last = sun < today() ? sun : today();
  if (paused()) return P.vibe();
  const act = actualRange(mon, last); const line = (n, v, cls) => `<div class="rl ${cls || ""}"><span>${esc(n)}</span><span>${v}</span></div>`;
  let r = S.areas.map(k => line(cname(k), hh(act[k] || 0))).join("") + `<div class="rsep"></div>`;
  S.less.forEach(it => { const st = lessNow(it, mon); r += line(cname(it.k), hh(st.wtd), "red b"); if (st.aim != null) r += line("  aim", hh(st.aim), "red"); const no = worthNo(mon, sun); if (no) r += line("  “not worth it”", no + " ×", "red"); });
  const ot = act.overtime || 0; if (ot) r += line("Overtime", hh(ot), "amber");
  const top = S.less.map(it => [it, lessNow(it, mon)]).sort((a, b) => b[1].wtd - a[1].wtd)[0];
  let note = "";
  if (top) { const [it, st] = top, nx = it.ladder ? aimFor(it, addD(mon, 7)) : null; note = `<div class="card tiny lh">${hh(st.wtd)} of ${esc(cname(it.k).toLowerCase())} is <b>${costOf(st.wtd, it.swap || S.areas[0])}</b>.${nx != null ? ` Next week's step is ${hh(nx)}.` : ""}</div>`; }
  return `${head("Your week's receipt", "Week")}<p class="tiny muted">${esc(L("week"))} 1 of 3 · ${fmtS(mon)} – ${fmtS(sun)}</p><div class="card receipt">${r}</div>${note}<div class="btns">${btn("Next: what went well", "go", "vibe", "primary block")}</div>`;
};
P.vibe = () => {
  const mon = weekOf || mondayOf(today()), R = S.retros[mon] || {};
  const goods = Object.keys(S.logs).filter(d => d >= mon && d <= addD(mon, 6) && S.logs[d].good).sort().map(d => `<li><b>${DOW[dowOf(d)]}</b> ${esc(S.logs[d].good)}</li>`);
  return `${head("What went well", paused() ? "Week" : "Receipt")}<p class="tiny muted">${esc(L("week"))} 2 of 3</p>
  <label class="f" for="r-well">What went well</label><input type="text" id="r-well" data-in="retro-well" value="${esc(R.well || "")}" placeholder="Ran three times">
  ${goods.length ? `<ul class="tiny goods">${goods.join("")}</ul>` : ""}
  <label class="f">What got in the way</label><div class="chips">${BLOCKERS.map(b => chip(esc(b), "blocker", b, (R.blockers || []).includes(b))).join("")}</div>
  <label class="f" for="r-chg">One change for next week</label><input type="text" id="r-chg" data-in="retro-change" value="${esc(R.change || "")}" placeholder="Phone stays in the hall after 10 pm">
  <div class="btns">${btn("Next: plan next week", "go", "nextweek", "primary block")}</div>`;
};
P.nextweek = () => {
  const mon = weekOf || mondayOf(today()), nx = addD(mon, 7);
  const qs = S.quests.filter(x => x.status === "open" && inWeek(x, nx));
  return `${head("Next week", "Back")}<p class="muted">2 or 3 small things that move your shape.</p><div class="card list">${qs.length ? qs.map(questRow).join("") : `<p class="tiny muted" style="margin:0">Nothing yet.</p>`}</div>
  <div class="btns">${btn("+ Add a side quest", "quest-add", "nextweek", "block")}${btn("Save " + esc(L("week").toLowerCase()), "save-retro", null, "primary block")}</div>`;
};
P.weekdone = () => {
  const mon = weekOf || mondayOf(today()), sun = addD(mon, 6), last = sun < today() ? sun : today(), R = S.retros[mon] || {};
  const n = Object.keys(S.logs).filter(d => d >= mon && d <= sun && logged(d) && !awayOn(d)).length; let away = 0; eachDay(mon, sun, d => { if (awayOn(d)) away++; });
  return `<h1>Week saved</h1><div class="card center">${shapeSVG(S.areas, [{ v: planRange(mon, last), kind: "plan" }, { v: actualRange(mon, last) }], 260)}<h3>${n} of ${7 - away} days logged · ${esc(L("week").toLowerCase())} done</h3>${R.change ? `<p class="tiny muted">Change: ${esc(R.change)}</p>` : ""}</div><p class="tiny muted">We'll show your change on Monday morning.</p>${btn("Back to the week", "home", null, "primary block")}`;
};
/* Observe → decide → shift */
P.observe = () => {
  const t = today(), from = addD(t, -13), n = countedDays(from, t) || 1, act = actualRange(from, t);
  const peak = k => { const c = new Array(24).fill(0); eachDay(from, t, d => { if (!logged(d)) return; S.logs[d].blocks.forEach(b => { if (b.k === k) for (let x = Math.floor(b.s); x < Math.ceil(b.e); x++) c[x]++; }); }); const m = Math.max(...c); if (!m) return ""; const hs = c.map((v, i) => [v, i]).filter(x => x[0] >= m * 0.6).map(x => x[1]); return ", mostly " + hm(Math.min(...hs)) + "–" + hm(Math.max(...hs) + 1); };
  const rows = S.less.filter(it => it.aim == null && !it.ladder).map(it => [cname(it.k), hh((act[it.k] || 0) * 7 / n) + " a week" + peak(it.k), it.k]);
  const ot = (act.overtime || 0) * 7 / n + Math.max(0, ((act.work || 0) - (() => { let o = 0; eachDay(from, t, d => o += hoursOf(tmplBlocks(d)).work || 0); return o; })()) * 7 / n);
  if (ot >= 1 && !isLess("overtime")) rows.push(["Overtime", hh(ot) + " a week", "overtime"]);
  const sl = (act.sleep || 0) / n; if (sl < 7) rows.push(["Sleep", h1(sl) + " h a night, below 7–8", ""]);
  return `${head("What Era noticed", "Week")}<p class="muted">No judgement. Just your own numbers from the last 2 weeks.</p><div class="card list">${rows.map(([a, b]) => `<div class="li"><span class="grow"><b>${esc(a)}</b><br><span class="tiny muted">${esc(b)}</span></span></div>`).join("")}</div>
  <h3>Want less of any of these?</h3><div class="btns col">${rows.filter(r => r[2]).map(r => btn("Yes: less " + esc(r[0].toLowerCase()), "decide", r[2], "primary block")).join("")}${btn("They're fine for now", "observed", null, "block")}</div><p class="tiny muted">Or count one as something else, like scrolling as Self-care.</p>${btn("Where things count", "go", "m_map", "sm")}`;
};
let dec = null;
P.decide1 = a => {
  const k = a.k; if (!dec || dec.k !== k) dec = { k, swap: S.areas[0], identity: "", pace: "steady", target: null, stack: "", tiny: "" };
  return `${head("", "Back")}<p class="tiny muted">Decide 1 of 2</p><h1>Less ${esc(cname(k).toLowerCase())}</h1><p class="muted">Hours don't vanish, they move. Swap it for:</p><div class="chips">${S.areas.map(x => chip(esc(cname(x)), "dec-swap", x, dec.swap === x, `--cc:${ccol(x)}`)).join("")}</div>
  <label class="f" for="dec-id">Who do you want to be?</label><input type="text" id="dec-id" data-in="dec-identity" value="${esc(dec.identity)}" placeholder="I'm someone who moves every evening"><p class="tiny muted">You'll see this line when the red grows, and when it shrinks.</p>
  <div class="btns">${btn("Next: how fast", "go", "decide2", "primary block")}</div>`;
};
P.decide2 = () => {
  const k = dec.k, base = r2(baseline(k)); if (dec.target == null) dec.target = Math.max(0, r2(base * 0.7));
  const lad = makeLadder(base, dec.target, dec.pace), maxv = Math.max(base, 1);
  return `${head("", "Back")}<p class="tiny muted">Decide 2 of 2</p><h1>How fast?</h1><div class="seg" role="group">${[["gentle", "Gentle"], ["steady", "Steady"], ["bold", "Bold"]].map(([p, n]) => `<button data-act="dec-pace" data-arg="${p}" aria-pressed="${dec.pace === p}">${n}</button>`).join("")}</div>
  <div class="card"><div class="row"><span class="grow tiny">Now about <b>${hh(base)}</b> a week. Aim:</span>${stepper("dec-target", "t", dec.target, "aim")}</div><div class="tiny muted" style="margin-top:6px">Your ladder, a step a week</div><div class="ladder">${[base].concat(lad.steps).map((v, i) => `<div class="lstep${i ? "" : " now"}"><i style="height:${Math.max(6, v / maxv * 60)}px"></i><span>${h1(v)}${i ? "" : " now"}</span></div>`).join("")}</div></div>
  <label class="f" for="dec-stack">Stack it on something you already do</label><input type="text" id="dec-stack" data-in="dec-stack" value="${esc(dec.stack)}" placeholder="After dinner, I'll walk 20 min before I open my phone">
  <label class="f" for="dec-tiny">On a hard day, the 2-minute version</label><input type="text" id="dec-tiny" data-in="dec-tiny" value="${esc(dec.tiny)}" placeholder="Just put my shoes on">
  <div class="btns">${btn("Start the ladder", "dec-start", null, "primary block")}</div>`;
};

/* ======================= Era ======================= */
P.era = () => {
  const t = today(), q = curQ(), qe = qEnd(q), act = S.goals.filter(g => !g.closed && g.end >= t);
  const sats = weekendsFrom(t, qe), wd = wkDays(t, qe), nmv = S.moves.filter(m => m.q === q).length;
  let h = `<p class="tiny muted">${qLabel(q)} · ${daysIn(t, qe)} days, ${wks(wd.left)} left</p><button class="titlebtn" data-act="rename-era" aria-label="Rename this era"><h1>${esc(eraName(q) || "Name this era")}</h1></button>`;
  h += pausedBanner() + brutalBanner();
  h += `<div class="card">${shapeSVG(S.areas, [{ v: tmplWeek(), kind: "plan" }, { v: planWeek(q, t) }], 300, { label: "Your normal week against this era's plan" })}${legend("Your normal week", "This era's plan")}</div>`;
  h += `<div class="card list">${link(esc(L("shift")), nmv ? "Drag hour beads · " + nmv + " change" + (nmv > 1 ? "s" : "") : "Drag hour beads between areas", "go", "beads")}
  ${link(esc(L("lockin")) + " for a goal", act.length ? esc(act[0].title) + " · " + h1(goalDone(act[0])) + " of " + act[0].total + " h" : "Make room for a big goal, like an exam", "go", "lock1")}
  ${link("Weekends and " + esc(L("quests").toLowerCase()), wks(wd.left) + " left · " + qW(wd.planned) + " planned", "go", "horizon", `<div style="margin-top:6px">${dotsHTML(sats.slice(0, 10), { static: 1 })}</div>`)}
  ${link("‘" + esc(eraName(q) || "This era") + "’ " + esc(L("era")), "What happened against the plan", "go", "retro")}
  ${link("Past eras", "Look back, and do a retro for any of them", "go", "pasteras")}</div>`;
  return h;
};
/* Change my week: bead jars */
let beadDraft = null, beadSel = null;
function jarItems(extra) {
  const q = curQ(), pw = planWeek(q, today()), tw = tmplWeek();
  const keys = S.areas.concat(S.less.map(x => x.k).filter(k => isFree(k)));
  return keys.map(k => ({ k, v: Math.max(0, (pw[k] || 0) + ((extra || {})[k] || 0)), plan: tw[k] || 0, locked: S.protect.includes(k) }));
}
function beadSum() { const o = {}; (beadDraft || []).forEach(m => { o[m.from] = (o[m.from] || 0) - m.h; o[m.to] = (o[m.to] || 0) + m.h; }); return o; }
P.beads = () => {
  beadDraft = beadDraft || []; const q = curQ(), mv = S.moves.filter(m => m.q === q), wk = Math.max(1, Math.round(daysIn(today(), qEnd(q)) / 7));
  const pend = {}; beadDraft.forEach(m => { const key = m.from + ">" + m.to; pend[key] = (pend[key] || 0) + m.h; });
  return `${head(L("shift"), "Era")}<p class="muted">Each bead is one free hour a week. Tap a jar to pick a bead up, then tap the jar it goes to. Dashed line: your normal week.</p>
  <div class="card">${jarsHTML(jarItems(beadSum()), { sel: beadSel })}<p class="tiny center ${beadSel ? "" : "muted"}" id="beadhint">${beadSel ? "Holding a bead from " + esc(cname(beadSel)) + ". Tap where it goes." : "Tap a jar to pick up a bead."}</p></div>
  ${Object.keys(pend).length ? `<div class="card"><b>New</b>${Object.keys(pend).map(key => { const [f, to] = key.split(">"); return `<div class="li"><span class="grow"><b class="${isLess(f) ? "warnc" : ""}">${esc(cname(f))}</b> → <b>${esc(cname(to))}</b>, ${hh(pend[key])} a week<br><span class="tiny muted">About ${Math.round(pend[key] * wk)} hours over this era</span></span><button class="icon-btn" data-act="bead-undo" data-arg="${esc(key)}" aria-label="Undo">↶</button></div>`; }).join("")}<label class="f" for="bd-note">How, in a few words</label><input type="text" id="bd-note" data-in="bead-note" value="${esc(beadNote)}" placeholder="Runs Tue, Thu and Sat mornings"><div class="btns">${btn("Save change", "bead-save", null, "primary block")}</div></div>` : ""}
  <div class="row" style="gap:12px">${shapeSVG(S.areas, [{ v: tmplWeek(), kind: "plan" }, { v: addTo(planWeek(q, today()), beadSum()) }], 120, { mini: 1 })}<p class="tiny muted grow">${esc(L("shape"))} with this change. Dashed: your normal week.</p></div>
  ${mv.length ? `<h2>Changes this era</h2><div class="card list">${mv.map(m => `<div class="li"><span class="grow"><b class="${isLess(m.from) ? "warnc" : ""}">${esc(cname(m.from))}</b> → <b>${esc(cname(m.to))}</b>${m.note ? `<br><span class="tiny muted">${esc(m.note)}</span>` : ""}</span>${stepper("mv", m.id, m.h, cname(m.to))}<button class="icon-btn" data-act="mv-rm" data-arg="${m.id}" aria-label="Remove this change">✕</button></div>`).join("")}</div>` : ""}`;
};
let beadNote = "";
/* Lock in */
let goalDraft = null;
const newGoal = () => ({ title: "", area: S.areas.includes("learn") ? "learn" : S.areas[0], total: 30, start: today(), end: addD(today(), 27), src: {}, why: "" });
P.lock1 = () => {
  goalDraft = goalDraft || newGoal(); const g = goalDraft, wks = goalWeeks(g);
  return `${head("What needs the hours?", "Era")}<p class="tiny muted">${esc(L("lockin"))} 1 of 3</p><label class="f" for="g-title">The goal</label><input type="text" id="g-title" data-in="g-title" value="${esc(g.title)}" placeholder="Exam prep">
  <div class="card list"><div class="li"><span class="grow">Hours in total</span>${stepper("g-total", "t", g.total, "hours")}</div><div class="li"><label class="grow" for="g-end">By</label><input type="date" id="g-end" data-in="g-end" value="${g.end}" min="${addD(today(), 6)}" style="width:auto"></div><div class="li"><span class="grow">Counts as</span></div><div class="chips">${S.areas.map(k => chip(esc(cname(k)), "g-area", k, g.area === k, `--cc:${ccol(k)}`)).join("")}</div></div>
  <div class="card dark"><b class="big">${hh(goalPer(g))} a week for ${wks} week${wks > 1 ? "s" : ""}</b><div class="tiny" style="opacity:.8">Your week is full, so they come from somewhere.</div></div>
  <div class="btns">${btn("Next: where from", "lock-next", "lock2", "primary block")}</div>`;
};
P.lock2 = () => {
  const g = goalDraft, per = goalPer(g), got = Object.values(g.src).reduce((a, b) => a + b, 0), tw = planWeek(curQ(), today());
  const items = S.areas.filter(k => k !== g.area).concat(S.less.map(x => x.k).filter(isFree)).map(k => ({ k, v: Math.max(0, (tw[k] || 0) - (g.src[k] || 0)), locked: S.protect.includes(k) }));
  return `${head("Where from?", "Back")}<p class="tiny muted">${esc(L("lockin"))} 2 of 3</p><p class="muted">Tap a jar to move half an hour a week into ${esc(g.title || "the goal")}.</p>
  <div class="card">${jarsHTML(items.concat([{ k: g.area, v: got }]).map(it => it.k === g.area ? Object.assign(it, { plan: per }) : it))}<p class="tiny muted center">Last jar: ${esc(g.title || "your goal")}, counted as ${esc(cname(g.area))}. Dashed line: what it needs.</p></div>
  <div class="card list">${items.filter(it => !it.locked).map(it => `<div class="li"><span class="grow">${sw(ccol(it.k))}${esc(cname(it.k))}<br><span class="tiny muted">${hh(tw[it.k] || 0)} a week now</span></span>${stepper("g-src", it.k, g.src[it.k] || 0, cname(it.k))}</div>`).join("")}${items.filter(it => it.locked).length ? `<div class="li"><span class="grow">🔒 ${esc(items.filter(it => it.locked).map(it => cname(it.k)).join(", "))}</span><span class="tiny muted">locked, can't be taken</span></div>` : ""}</div>
  <div class="row"><div class="bar grow"><i style="width:${Math.min(100, got / per * 100)}%;background:${got >= per - 0.01 ? "var(--good)" : "var(--accent)"}"></i></div><b>${h1(got)} of ${h1(per)} h</b></div>
  <div class="btns">${btn("Next: why", "lock-next", "lock3", "primary block")}</div>`;
};
P.lock3 = () => {
  const g = goalDraft, wks = goalWeeks(g), chosen = Object.keys(g.src).filter(k => g.src[k] > 0);
  return `${head("You're choosing", "Back")}<p class="tiny muted">${esc(L("lockin"))} 3 of 3</p><div class="card lh">${chosen.map(k => hh(g.src[k]) + " less " + esc(cname(k).toLowerCase())).join(", ")} each week, for ${wks} week${wks > 1 ? "s" : ""}. Back to normal on ${fmtS(addD(g.end, 1))}.</div>
  <label class="f" for="g-why">Why it's worth it</label><input type="text" id="g-why" data-in="g-why" value="${esc(g.why)}" placeholder="Passing gets me the analyst role"><p class="tiny muted">You'll see this line again on ${fmtS(addD(g.end, 1))}, whatever happens.</p>
  <div class="btns">${btn(esc(L("lockin")) + " for " + wks + " week" + (wks > 1 ? "s" : ""), "lock-save", null, "primary block")}</div>`;
};
/* Weekends and side quests */
P.horizon = () => {
  const t = today(), y = +t.slice(0, 4), a = weekendsFrom(t, y + "-12-31"), b = weekendsFrom((y + 1) + "-01-01", (y + 1) + "-12-31"), wa = wkDays(t, y + "-12-31");
  const up = S.quests.filter(x => live(x) && qSpan(x) && qSpan(x)[1] >= t).sort((p, q) => qSpan(p)[0] < qSpan(q)[0] ? -1 : 1);
  return `${head("Weekends left", "Era")}<p class="muted">One dot per weekend: Saturday on the left, Sunday on the right, first half on top. Tap one to plan it.</p>
  <div class="card"><h3>${y} · ${wks(wa.left)} left${wa.planned ? ", " + qW(wa.planned) + " planned" : ""}</h3>${dotsHTML(a)}<h3 style="margin-top:12px">${y + 1} · ${b.length}</h3>${dotsHTML(b)}</div>
  ${up.length ? `<div class="card list">${up.map(x => `<button class="li" data-act="quest-edit" data-arg="${x.id}"><span class="grow"><b>${spanLabel(x, true)}</b> ${isAway(x) ? "🧳 " : ""}${esc(x.title)}</span><span class="tiny muted">${esc(cname(x.area))}${x.status === "done" ? " ✓" : ""}</span></button>`).join("")}</div>` : ""}
  <div class="btns">${btn("Claim a weekend", "claim-next", null, "block")}${btn("All " + esc(L("quests").toLowerCase()), "go", "quests", "block")}</div>`;
};
P.quests = () => {
  const q = curQ(), mon = mondayOf(today()), groups = [["This week", x => !qSpan(x) && x.when === "week" && x.week >= mon], ["Trips", x => isAway(x)], ["Weekends and dates", x => !!qSpan(x)], ["This month", x => x.when === "month"], ["This era", x => x.when === "era" && x.q === q]];
  const shown = new Set(); let h = `${head(L("quests"), "Era")}<p class="muted">Trips, courses, people to see. Late still counts.</p>`;
  const byStart = (a, b) => { const p = qSpan(a), r = qSpan(b); return p && r ? (p[0] < r[0] ? -1 : 1) : 0; };
  groups.forEach(([n, f]) => { const xs = S.quests.filter(x => !shown.has(x.id) && f(x) && x.status !== "dropped").sort(byStart); xs.forEach(x => shown.add(x.id)); if (xs.length) h += `<h3>${n}</h3><div class="card list">${xs.map(questRow).join("")}</div>`; });
  const done = S.quests.filter(x => x.q === q && x.status === "done").length, all = S.quests.filter(x => x.q === q && x.status !== "dropped").length;
  if (all) h += `<p class="tiny"><b>${done} of ${all}</b> done this era.</p>`;
  return h + `<div class="btns">${btn("+ Add a side quest", "quest-add", "week", "primary block")}</div>`;
};
/* Era retro, next era, past eras */
P.retro = a => {
  const q = a.q || curQ(), qs = qStart(q), qe = qEnd(q), t = today(), last = qe < t ? qe : t, E = S.eras[q] || {};
  const act = last >= qs ? avgWeek(qs, last) : {}, nq = qNext(q);
  const qq = S.quests.filter(x => x.q === q && x.status !== "dropped"), gs = S.goals.filter(g => g.start <= qe && g.end >= qs);
  let lg = 0, el = 0; eachDay(qs, last, d => { if (awayOn(d)) return; el++; if (logged(d)) lg++; });
  return `${head("‘" + (eraName(q) || qLabel(q)) + "’ " + L("era"), "Era")}<p class="tiny muted">${qLabel(q)}</p><div class="card">${shapeSVG(S.areas, [{ v: planWeek(q), kind: "plan" }, { v: act }], 280)}${legend("Plan", "What happened")}</div>
  <div class="card tiny lh">${esc(L("quests"))} <b>${qq.filter(x => x.status === "done").length} of ${qq.length}</b> · ${esc(L("lockin").toLowerCase())}s <b>${gs.filter(g => g.result === "done").length} of ${gs.length}</b> · days logged <b>${lg} of ${el}</b> · ${esc(L("reclaimed").toLowerCase())} <b>${hh(reclaimed(qs, last).tot)}</b></div>
  <label class="f" for="e-keep">Keep</label><input type="text" id="e-keep" data-in="era-keep" data-q="${q}" value="${esc(E.keep || "")}" placeholder="Morning runs">
  <label class="f" for="e-change">Change</label><input type="text" id="e-change" data-in="era-change" data-q="${q}" value="${esc(E.change || "")}" placeholder="More trips">
  <div class="btns">${q >= curQ() || qNext(q) === curQ() ? btn("Save and name the next era", "go", "newera", "primary block", ) : btn("Save", "era-retro-save", q, "primary block")}</div>`.replace('data-arg="newera"', `data-arg="newera" data-q="${nq}"`);
};
let newEraFrom = "plan";
P.newera = a => {
  const nq = a.q || qNext(curQ());
  return `${head("Name your next era", "Back")}<p class="tiny muted">${qLabel(nq)}</p><input type="text" id="ne-name" data-in="ne-name" data-q="${nq}" value="${esc(eraName(nq))}" placeholder="my travel era"><p class="muted" style="margin-top:12px">Start from your last plan, or from your normal week?</p><div class="seg" role="group">${[["plan", "Last plan"], ["normal", "Normal week"]].map(([k, n]) => `<button data-act="ne-from" data-arg="${k}" aria-pressed="${newEraFrom === k}">${n}</button>`).join("")}</div><div class="card">${shapeSVG(S.areas, [{ v: newEraFrom === "plan" ? planWeek(qPrev(nq)) : tmplWeek() }], 220)}</div><div class="btns">${btn("Start " + esc(eraName(nq) || "the next era"), "ne-start", nq, "primary block")}</div>`;
};
P.pasteras = () => {
  const out = []; let q = curQ(); for (let i = 0; i < 5; i++) { if (S.onboardedAt && qEnd(q) < S.onboardedAt && i > 1) break; out.push(q); q = qPrev(q); }
  const max = Math.max(8, ...S.areas.map(k => tmplWeek()[k] || 0)) * 1.4;
  return `${head("Past eras", "Era")}<div class="minis">${out.map(k => { const last = qEnd(k) < today() ? qEnd(k) : today(); const v = last >= qStart(k) ? avgWeek(qStart(k), last) : {}; const est = S.onboardedAt && qEnd(k) < S.onboardedAt; return `<button class="card mini" data-act="go" data-arg="retro" data-q="${k}">${shapeSVG(S.areas, [{ v }], 120, { mini: 1, max })}<b>${esc(eraName(k) || qLabel(k))}</b><br><span class="tiny muted">${est ? "estimated from your usual week" : qLabel(k)}${S.eras[k] && S.eras[k].at ? " · retro done" : ""}</span></button>`; }).join("")}</div><p class="tiny muted">Tap an era to read or write its retro.</p>`;
};

/* ======================= Me ======================= */
P.me = () => {
  const nat = !!NATIVE();
  return `<h1>Me</h1><div class="card list">
  ${link("My normal week", (S.week.preset && PRESETS[S.week.preset] ? PRESETS[S.week.preset].n + ", " : "") + S.week.workdays.length + " workdays", "go", "m_paint")}
  ${link("More of and less of", S.areas.length + " areas · " + (S.less.length ? S.less.length + " less" : "nothing to cut"), "go", "m_areas")}
  ${link("Where things count", "Activities, apps and shared time", "go", "m_map")}
  ${link("Push level", PUSH.find(p => p[0] === S.push)[1], "go", "m_push")}
  ${link("Pause", paused() ? (S.pause.forever ? "Paused" : "Until " + fmtS(S.pause.until)) : "Off", "go", "m_pause")}
  ${link("Screen time", S.st.on ? "On · " + hh(S.st.aim) + " a day aim" : nat ? "Off" : "Android app only", "go", "m_st")}
  ${link("Shape versions", S.versions.length + " saved", "go", "m_versions")}
  ${link("Reminders", S.remind.on ? S.remind.daily + " daily · Sun " + S.remind.weekly : "Off", "go", "m_remind")}
  ${link("Names", "Call things what you like", "go", "m_names")}
  ${link("Backup", S.lastBackup ? "Last: " + fmtS(S.lastBackup) : "Never", "go", "m_backup")}
  ${link("Share Era with friends", "", "share-app")}</div>
  <p class="foot center">${APPNAME} v${esc(self.ERA_VERSION || "")} · everything stays on this phone</p>`;
};
P.m_paint = () => `${head("My normal week", "Me")}${paintBody()}<p class="tiny muted">Saved as you paint.</p>`;
P.m_areas = () => {
  const aOpts = AREA_OPTS.concat(Object.keys(S.custom).filter(k => S.custom[k].kind === "area")), lOpts = LESS_OPTS.concat(Object.keys(S.custom).filter(k => S.custom[k].kind === "less"));
  return `${head("More of and less of", "Me")}<h2>More of</h2><p class="tiny muted">The corners of your shape. 3 to 7.</p><div class="chips">${aOpts.map(k => chip(esc(cname(k)), "area", k, isArea(k), `--cc:${ccol(k)}`)).join("")}${chip("+ Your own", "own-area", "", false)}</div>
  <h2>${esc(L("less"))}</h2><div class="chips">${lOpts.map(k => chip(esc(cname(k)), "lessk", k, isLess(k))).join("")}${chip("+ Your own", "own-less", "", false)}</div>
  ${S.less.length ? `<div class="card list">${S.less.map(it => `<div class="li"><span class="grow"><b>${esc(cname(it.k))}</b><br><span class="tiny muted">${it.ladder ? "ladder · aim " + hh(it.target) : it.aim != null ? "aim " + hh(it.aim) + " a week" : "watching since " + fmtS(it.since || today())}</span></span>${it.aim != null && !it.ladder ? stepper("aim", it.k, it.aim, cname(it.k)) : btn(it.ladder ? "Redo" : "Set an aim", "decide", it.k, "sm")}</div>`).join("")}</div>` : ""}
  <h2>Non-negotiables</h2><p class="tiny muted">${esc(L("lockin"))} and bead changes can't take from these.</p><div class="chips">${S.areas.map(k => chip(esc(cname(k)), "protect", k, S.protect.includes(k))).join("")}</div>`;
};
P.m_map = () => {
  const v = NATIVE() && S.st.on ? stDay(today()) : null;
  const apps = v ? (v.apps || []).slice().sort((a, b) => b.min - a.min).slice(0, 12) : [];
  return `${head("Where things count", "Back")}<div class="card list">${mapRows()}</div>${shareToggle()}
  ${apps.length ? `<h2>Apps</h2><p class="tiny muted">Same rule as everything else: your call.</p><div class="card list">${apps.map(a => { const k = appCat(a.pkg, a.hint); return `<button class="rowlink" data-act="appmap" data-arg="${esc(a.pkg)}"><span class="grow">${esc(a.label || a.pkg)}<br><span class="tiny muted">${hmin(a.min)} today</span></span><b style="color:${k && isLess(k) ? "var(--warn)" : "var(--ink)"}">${k ? (isLess(k) ? esc(L("less")) + ": " : "") + esc(cname(k)) : "Neutral"}</b><span class="chev">›</span></button>`; }).join("")}</div>` : ""}`;
};
P.m_push = () => `${head("Push level", "Me")}<p class="muted">When you go over an aim, the app gets…</p>${pushOpts()}<p class="tiny muted">It never blocks you, and nothing red shows outside the app.</p>`;
P.m_pause = () => `${head("Pause the push", "Me")}<p class="muted">Sick, travelling, a rough week. Logging still works. Era just stops pushing.</p>${paused() ? `<div class="card">${S.pause.forever ? "Paused until you're back." : "Paused until " + fmtS(S.pause.until) + "."}</div>${btn("Resume now", "resume", null, "primary block")}` : `<div class="seg" role="group">${[["3", "3 days"], ["7", "1 week"], ["0", "Until I'm back"]].map(([k, n]) => `<button data-act="pause-len" data-arg="${k}" aria-pressed="${pauseLen === k}">${n}</button>`).join("")}</div><div class="card tiny lh">While paused: no red growth, no faded shape, no receipt. Your aims pick up again when it ends.</div>${btn(pauseLen === "0" ? "Pause until I'm back" : "Pause for " + (pauseLen === "7" ? "1 week" : "3 days"), "pause", null, "primary block")}`}`;
let pauseLen = "7";
P.m_st = () => {
  const N = NATIVE();
  if (!N || !N.stStatus) return `${head("Screen time", "Me")}<div class="card tiny lh">Screen time works in the Android app. Era reads how long each app was open (totals only, never what you do inside), fills your day with it, and checks logged blocks against it.</div>`;
  const g = stGranted();
  return `${head("Screen time", "Me")}${stIntro()}${g && S.st.on ? `<div class="card list"><div class="li"><span class="grow"><b>Screen time aim</b><br><span class="tiny muted">all apps, a day</span></span>${stepper("st-aim", "a", S.st.aim, "screen time aim")}</div>${link("Where each app counts", "", "go", "m_map")}</div>${btn("Turn off screen time", "st-off", null, "block")}` : ""}`;
};
P.m_versions = () => `${head("Shape versions", "Me")}<p class="muted">Change your shape any day. Each change is kept here.</p>${S.versions.map((v, i) => { const pw = addTo(tmplWeek(), (() => { const o = {}; v.moves.forEach(m => { o[m.from] = (o[m.from] || 0) - m.h; o[m.to] = (o[m.to] || 0) + m.h; }); return o; })()); return `<div class="card row">${shapeSVG(v.areas.length >= 3 ? v.areas : S.areas, [{ v: pw }], 70, { mini: 1 })}<span class="grow"><b>${esc(v.name)}</b><br><span class="tiny muted">${fmtS(v.at)} · ${v.areas.length} areas${v.moves.length ? " · " + v.moves.length + " change" + (v.moves.length > 1 ? "s" : "") : ""}</span></span>${i === 0 ? `<span class="tiny muted">latest</span>` : btn("Switch back", "version", v.id, "sm")}</div>`; }).join("") || `<p class="tiny muted">Nothing saved yet.</p>`}`;
P.m_remind = () => { const r = S.remind; return `${head("Reminders", "Me")}<div class="card list"><label class="li"><span class="grow"><b>Daily recap</b></span><input type="time" data-in="rem-daily" value="${r.daily}" style="width:auto"></label><label class="li"><span class="grow"><b>${esc(L("week"))}</b><br><span class="tiny muted">Sundays</span></span><input type="time" data-in="rem-weekly" value="${r.weekly}" style="width:auto"></label><div class="li"><span class="grow"><b>Era retro</b></span><span class="tiny muted">Last day of the era</span></div></div>
  ${NATIVE() ? `<button class="toggle" data-act="rem-on" aria-pressed="${!!r.on}"><span class="grow"><b>Notifications on this phone</b><br><span class="tiny muted">The daily one has a “Looks right” button</span></span><i class="tg"></i></button>` : `<p class="tiny muted">Add them to your calendar so they ring on any phone.</p><div class="btns">${btn("Add to calendar", "ics", null, "sm")}</div>`}`; };
P.m_names = () => `${head("Names", "Me")}<p class="muted">Call things what you like.</p>${Object.keys(LABELS).map(k => `<label class="f" for="lbl-${k}">${esc(LABELS[k][1])}</label><input type="text" id="lbl-${k}" data-in="label" data-k="${k}" value="${esc(L(k))}">`).join("")}`;
P.m_backup = () => `${head("Backup", "Me")}<p class="muted lh">Your week, logs, eras and side quests in one file. Use it to move to a new phone.</p>${btn("Save backup", "export", null, "primary block")}${btn("Restore from a file", "import", null, "block")}<input type="file" id="m-file" accept=".json,application/json" hidden>${S.lastBackup ? `<p class="tiny muted">Last saved ${fmtS(S.lastBackup)}</p>` : ""}<h2>Start over</h2><p class="tiny muted">Deletes everything on this phone. Save a backup first.</p>${btn("Delete everything", "reset", null, "warn block")}`;
