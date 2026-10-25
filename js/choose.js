"use strict";
/* Era · Choose: ten things you want, limited time, money and energy. Budgets, lenses (standard
   frameworks and your own), five views, what fits this era, commit to Era, decisions, monthly check.
   Loaded before app.js; its actions are merged into ACT / IN / AFTER there. */

/* ---------- Constants ---------- */
const STD_LENSES = [
  { id: "areas", n: "Impact on your areas", d: "How much it moves each of your areas", w: 2 },
  { id: "regret", n: "Regret test", d: "At 80, would you regret skipping it?", w: 1.5 },
  { id: "hell", n: "Hell yeah or no", d: "Below 4 of 5 counts as a no", w: 1 },
  { id: "window", n: "Now or never", d: "Some windows close", w: 1 },
  { id: "undo", n: "Reversible", d: "Two-way doors are cheap to try", w: 0.5 }
];
const ENERGY_LEVELS = [[2, "Low"], [4, "Medium"], [6, "High"]];
const WINDOWS = [["any", "Any time", 1], ["year", "This year", 3], ["now", "Now or never", 5]];
const UNDOS = [["easy", "Easy to undo", 5], ["medium", "Some cost", 3], ["hard", "Hard to undo", 1]];
const TYPES = [["habit", "Habit"], ["project", "Project"], ["oneoff", "One-off"]];
const STATUSES = [["now", "Now"], ["next", "Next"], ["later", "Later"], ["letgo", "Let go"], ["idea", "Not sorted"]];
const CURS = ["₹", "$", "€", "£"];
const ACT_FOR = { family: "family", friends: "friends", health: "gym", learn: "study", trips: "trip", selfcare: "rest", partner: "partner", career: "study", create: "hobby", faith: "pray", giving: "help" };

/* ---------- State ---------- */
function chFresh() { return { setup: false, time: 8, month: 20000, pot: 100000, cur: "₹", energy: 4, lenses: STD_LENSES.map(l => ({ id: l.id, on: true, w: l.w })), own: [], things: [], decisions: [], reviews: {} }; }
const CH = () => S.choose || (S.choose = chFresh());
const thing = id => CH().things.find(x => x.id === id);
const decision = id => CH().decisions.find(x => x.id === id);
/* A first guess from the words, so most things need only a tap or two. */
const GUESS = [
  [/parent|mom|mum|dad|family|kids?\b|son|daughter|grand|nani|dadi/i, "family"], [/partner|wife|husband|girlfriend|boyfriend|date night/i, "partner"],
  [/trip|travel|holiday|vacation|trek|goa|tour|abroad|beach|mountain/i, "trips"], [/friend|reunion|party|catch up/i, "friends"],
  [/gym|run|marathon|yoga|walk|swim|cycle|fitness|weight|diet|sleep|health|sport|badminton|cricket|football/i, "health"], [/exam|study|course|learn|guitar|piano|spanish|french|language|read|book|cfa|mba|degree|certif|class/i, "learn"],
  [/career|job|promotion|interview|side project|startup|business|freelance/i, "career"], [/paint|draw|write|music|art|craft|photo|app|build|code/i, "create"],
  [/meditat|therapy|rest|spa|journal|self/i, "selfcare"], [/pray|temple|church|faith/i, "faith"], [/volunteer|donat|charity|help/i, "giving"]
];
function guessArea(t) { for (const [re, k] of GUESS) if (re.test(t)) { if (isArea(k)) return k; if (k === "career" && isArea("learn")) return "learn"; if (k === "partner" && isArea("family")) return "family"; if (k === "create" && isArea("learn")) return "learn"; } return S.areas.includes("learn") ? "learn" : S.areas[0]; }
function guessType(t) { if (/\b(buy|purchase|get a|new (car|phone|laptop|bike))\b|trip|travel|holiday|vacation|trek|tour|wedding|concert/i.test(t)) return "oneoff"; if (/exam|prep|degree|course|certif|project|build|launch|renovat|move house|marathon/i.test(t)) return "project"; return "habit"; }
function newThing(t) { const ty = guessType(t); return { id: uid(), t, area: guessArea(t), type: ty, h: 2, total: 40, by: addD(today(), 90), days: /trip|travel|holiday|vacation|trek|tour/i.test(t) ? 3 : 1, m1: 0, mm: 0, e: 0, sc: { areas: {}, regret: 3, hell: 3, window: "any", undo: ty === "oneoff" && /buy|purchase/i.test(t) ? "medium" : "easy" }, status: "idea", sized: false, scored: false, links: {}, spent: [], at: today() }; }

/* ---------- Money ---------- */
const money = n => { const c = CH().cur; return (n < 0 ? "−" : "") + c + Math.round(Math.abs(n)).toLocaleString(c === "₹" ? "en-IN" : "en-US"); };
const kmoney = n => { const c = CH().cur, a = Math.abs(n); let v; if (c === "₹" && a >= 100000) v = +(a / 100000).toFixed(a % 100000 ? 1 : 0) + "L"; else if (a >= 1000000) v = +(a / 1000000).toFixed(1) + "M"; else if (a >= 1000) v = +(a / 1000).toFixed(a % 1000 ? 1 : 0) + "k"; else v = String(Math.round(a)); return (n < 0 ? "−" : "") + c + v; };

/* ---------- Lenses and scores ---------- */
function lensList() {
  const C = CH(); const std = STD_LENSES.map(l => Object.assign({}, l, C.lenses.find(x => x.id === l.id) || { on: true, w: l.w }));
  return std.concat(C.own.map(o => Object.assign({ d: o.q, own: true }, o)));
}
const activeLenses = () => lensList().filter(l => l.on);
function areaRating(x, k) { const v = x.sc.areas && x.sc.areas[k]; return v != null ? v : (k === x.area ? 4 : 1); }
function lensVal(x, l) {
  if (l.id === "areas") { const vals = S.areas.map(k => areaRating(x, k)); return (Math.max(...vals) + vals.reduce((a, b) => a + b, 0) / vals.length) / 2; }
  if (l.id === "window") return (WINDOWS.find(w => w[0] === x.sc.window) || WINDOWS[0])[2];
  if (l.id === "undo") return (UNDOS.find(w => w[0] === x.sc.undo) || UNDOS[0])[2];
  const v = x.sc[l.id]; return v != null ? v : 3;
}
function score(x) { const ls = activeLenses(); const W = ls.reduce((a, l) => a + l.w, 0); if (!W) return 50; return Math.round(ls.reduce((a, l) => a + l.w * (lensVal(x, l) - 1) / 4, 0) / W * 100); }

/* ---------- Costs ---------- */
const weeksTo = by => Math.max(1, Math.ceil(diffD(today(), by) / 7));
function weekly(x) { return x.type === "habit" ? x.h : x.type === "project" ? r2(x.total / weeksTo(x.by)) : 0; }
function costIx(x) { const C = CH(); return weekly(x) / Math.max(1, C.time) + Math.max(0, x.mm) / Math.max(1, C.month) + x.m1 / Math.max(1, C.pot) + Math.max(0, -x.e) / Math.max(1, C.energy) + (x.type === "oneoff" ? x.days * 0.1 : 0); }
function totals(list) {
  const o = { time: 0, month: 0, pot: 0, drain: 0, back: 0, days: 0 };
  list.forEach(x => { o.time += weekly(x); o.month += x.mm; o.pot += x.m1; o.drain += Math.max(0, -x.e); o.back += Math.max(0, x.e); if (x.type === "oneoff") o.days += x.days; });
  return o;
}
function over(t) { const C = CH(); return { time: Math.max(0, t.time - C.time), month: Math.max(0, t.month - C.month), pot: Math.max(0, t.pot - C.pot), energy: Math.max(0, t.drain - C.energy - t.back) }; }
const fits = t => { const o = over(t); return !o.time && !o.month && !o.pot && !o.energy; };
const sorted = list => list.slice().sort((a, b) => score(b) - score(a) || costIx(a) - costIx(b));
/* Greedy: best value for its cost first, while all four budgets still fit. */
function suggestSet() {
  const pool = CH().things.filter(x => x.status !== "letgo").slice().sort((a, b) => score(b) / (0.15 + costIx(b)) - score(a) / (0.15 + costIx(a)));
  const pick = []; pool.forEach(x => { if (fits(totals(pick.concat([x])))) pick.push(x); });
  return pick.map(x => x.id);
}
/* How low a less-of item can go: its aim, or 60% of your normal week while Era is still watching. */
const lessFloor = (it, tw) => it.aim != null ? it.aim : (tw[it.k] || 0) * 0.6;
/* Free hours that can move without touching what you already have: less-of above its aim, and Other. */
function movable() {
  const pw = planWeek(curQ(), today()), tw = tmplWeek(); let h = 0;
  S.less.forEach(it => { if (!isFree(it.k)) return; h += Math.max(0, (pw[it.k] || 0) - lessFloor(it, tw)); });
  return r2(h + (pw.other || 0));
}
/* Where `h` hours a week come from, in order: less-of (down to its aim), Other, then areas that aren't
   non-negotiables (each keeps at least an hour). */
function takeHours(h, to) {
  const pw = planWeek(curQ(), today()), tw = tmplWeek(), out = []; let need = r2(h);
  const take = (k, avail) => { const t = Math.min(need, Math.floor(Math.max(0, avail) * 2) / 2); if (t > 0) { out.push({ k, h: t }); need = r2(need - t); } };
  S.less.forEach(it => { if (need > 0 && isFree(it.k)) take(it.k, (pw[it.k] || 0) - lessFloor(it, tw)); });
  if (need > 0) take("other", pw.other || 0);
  S.areas.filter(k => k !== to && !S.protect.includes(k)).sort((a, b) => (pw[b] || 0) - (pw[a] || 0)).forEach(k => { if (need > 0) take(k, (pw[k] || 0) - 1); });
  return { from: out, short: need };
}

/* ---------- Commit to Era ---------- */
function nextFreeSat(from) { let d = from || today(); const sats = weekendsFrom(d, addD(d, 400)); return sats.find(s => !claimOf(s)) || sats[0]; }
function plannedLinks(x) {
  const w = weekly(x);
  if (x.type === "habit") { const t = takeHours(w, x.area); return { kind: "beads", text: L("shift") + ": " + hh(w) + " a week" + (t.from.length ? " from " + t.from.map(f => cname(f.k) + " " + h1(f.h)).join(", ") : "") + (t.short > 0 ? " (" + hh(t.short) + " short)" : ""), take: t }; }
  if (x.type === "project") { const t = takeHours(w, x.area); return { kind: "lock", text: L("lockin") + ": " + x.total + " h by " + fmtS(x.by) + ", " + hh(w) + " a week", take: t }; }
  const sat = x.date || nextFreeSat(addD(today(), 1)); return { kind: "weekend", text: "Claims " + fmtS(sat) + (x.m1 ? " · " + money(x.m1) + " from saved" : ""), sat };
}
function linkThing(x) {
  if (x.links && (x.links.moves || x.links.goal || x.links.quest)) return;
  const p = plannedLinks(x), q = curQ(); x.links = {};
  if (p.kind === "beads") { x.links.moves = p.take.from.map(f => { const m = { id: uid(), q, from: f.k, to: x.area, h: f.h, note: x.t, thing: x.id }; S.moves.push(m); return m.id; }); }
  if (p.kind === "lock") { const src = {}; p.take.from.forEach(f => src[f.k] = f.h); const g = { id: uid(), title: x.t, area: x.area, total: x.total, start: today(), end: x.by, src, why: x.why || "Chosen in Choose, score " + score(x), thing: x.id }; S.goals.push(g); x.links.goal = g.id; }
  if (p.kind === "weekend") { const qu = { id: uid(), title: x.t, area: x.area, when: "weekend", week: null, month: today().slice(0, 7), q: qOf(p.sat), date: p.sat, status: "open", moved: 0, created: today(), thing: x.id }; S.quests.push(qu); x.links.quest = qu.id; x.date = p.sat; }
}
function unlinkThing(x) {
  const lk = x.links || {};
  if (lk.moves) S.moves = S.moves.filter(m => !lk.moves.includes(m.id));
  if (lk.goal) { const g = S.goals.find(y => y.id === lk.goal); if (g) { if (goalDone(g) > 0) { g.closed = true; g.result = "stopped"; } else S.goals = S.goals.filter(y => y !== g); } }
  if (lk.quest) { const qu = S.quests.find(y => y.id === lk.quest); if (qu && qu.status === "open") qu.status = "dropped"; }
  x.links = {};
}
function setStatus(x, st) {
  if (x.status === st) return;
  if (x.status === "now") unlinkThing(x);
  x.status = st;
  if (st === "now") linkThing(x);
  if (st === "later" && !x.review) x.review = addD(today(), 90);
  if (st !== "later") x.review = st === "later" ? x.review : null;
}

/* ---------- Progress ---------- */
function hoursFor(x, a, b) { let n = 0; eachDay(a, b, d => { if (logged(d)) S.logs[d].blocks.forEach(bl => { if (bl.thing === x.id) n += bl.e - bl.s; }); }); return n; }
function spentIn(x, ym) { return (x.spent || []).filter(s => s.d.startsWith(ym)).reduce((a, s) => a + s.amt, 0); }
/* One hour of today goes to a thing: taken from less-of, Other or Self-care, the latest such block. */
function logHourTo(x) {
  const t = today(); let bl = logged(t) ? clone(S.logs[t].blocks) : autoFill(t).map(b => { const y = { ...b }; delete y.check; return y; });
  let blk = null;
  for (const k of S.less.map(i => i.k).concat(["other", "selfcare"])) { blk = bl.slice().reverse().find(b => b.k === k && b.e - b.s >= 1); if (blk) break; }
  if (!blk) blk = bl.slice().reverse().find(b => isFree(b.k) && b.k !== x.area && b.e - b.s >= 1);
  if (!blk) return null;
  const patch = { k: x.area, a: ACT_FOR[x.area], thing: x.id, src: "edited" }; if (x.links && x.links.goal) patch.goal = x.links.goal;
  bl = setRange(bl, blk.e - 1, blk.e, patch);
  S.logs[t] = Object.assign({}, S.logs[t] || {}, { blocks: bl, src: "edited", at: Date.now() });
  return blk.k;
}

/* ---------- Decisions ---------- */
const newOpt = n => ({ id: uid(), n, h: 0, m1: 0, mm: 0, e: 0, undo: "easy", sc: {} });
function decLenses() { return activeLenses().filter(l => l.id !== "window"); }
/* Each option gets 1–5 on every lens and on time, money and energy (relative to the other options). */
function decRows(dc) {
  const rows = [];
  decLenses().forEach(l => {
    if (l.id === "areas") S.areas.forEach(k => rows.push({ id: "a:" + k, n: cname(k), w: l.w / S.areas.length * 1.5, v: o => o.sc["a:" + k] || 3 }));
    else if (l.id === "undo") rows.push({ id: "undo", n: "Easy to undo", w: l.w, v: o => (UNDOS.find(u => u[0] === o.undo) || UNDOS[0])[2] });
    else rows.push({ id: l.id, n: l.own ? l.n : l.id === "regret" ? "Regret at 80" : l.id === "hell" ? "Hell yeah?" : l.n, w: l.w, v: o => o.sc[l.id] || 3 });
  });
  const rel = (f, more) => { const vals = dc.opts.map(f), lo = Math.min(...vals), hi = Math.max(...vals); return o => hi === lo ? 3 : 1 + 4 * (more ? (f(o) - lo) : (hi - f(o))) / (hi - lo); };
  rows.push({ id: "time", n: "Time", w: 1, cost: 1, v: rel(o => -o.h, false) });
  rows.push({ id: "money", n: "Money over a year", w: 1, cost: 1, v: rel(o => o.m1 + 12 * o.mm, false) });
  rows.push({ id: "energy", n: "Energy", w: 1, cost: 1, v: rel(o => o.e, true) });
  return rows;
}
function decScores(dc, mult) {
  const rows = decRows(dc); const W = rows.reduce((a, r) => a + r.w * ((mult || {})[r.id] || 1), 0);
  return dc.opts.map(o => ({ o, s: Math.round(rows.reduce((a, r) => a + r.w * ((mult || {})[r.id] || 1) * (r.v(o) - 1) / 4, 0) / W * 100) })).sort((a, b) => b.s - a.s);
}
/* The smallest weight change on one row that makes the runner-up win. */
function decFlip(dc) {
  const sc = decScores(dc); if (sc.length < 2) return null; const win = sc[0].o, run = sc[1].o; let best = null;
  decRows(dc).forEach(r => { if (r.v(run) <= r.v(win)) return; for (let m = 1.1; m <= 5.01; m += 0.1) { const s2 = decScores(dc, { [r.id]: m }); if (s2[0].o === run) { if (!best || m < best.m) best = { m: Math.round(m * 10) / 10, row: r, to: run }; break; } } });
  return best;
}
const strengths = (dc, o) => { const rows = decRows(dc); return rows.filter(r => dc.opts.every(p => p === o || r.v(o) > r.v(p) + 0.01)).map(r => r.n.toLowerCase()); };

/* ---------- Monthly check ---------- */
const ymOf = d => d.slice(0, 7);
const monthName = ym => MON[+ym.slice(5, 7) - 1];
function checkDue() { const ym = ymOf(today()), prev = ymOf(addD(today().slice(0, 8) + "01", -1)); const C = CH(); return C.setup && C.things.some(x => x.status === "now") && !C.reviews[prev] && (!C.since || C.since <= prev + "-28") ? prev : null; }

/* ======================= Screens ======================= */
const dots5 = (act, arg, v) => `<span class="dots5" role="group">${[1, 2, 3, 4, 5].map(i => `<button class="dotb${i <= v ? " on" : ""}" data-act="${act}" data-arg="${esc(arg)}|${i}" aria-label="${i} of 5" aria-pressed="${i === v}"></button>`).join("")}</span>`;
const edots = (act, arg, v) => `<div class="edots" role="group" aria-label="Energy">${[-2, -1, 0, 1, 2].map(e => `<button class="edot e${e + 2}${v === e ? " on" : ""}" data-act="${act}" data-arg="${esc(arg)}|${e}" aria-pressed="${v === e}" aria-label="${["Drains a lot", "Drains a bit", "Neutral", "Recharges a bit", "Recharges a lot"][e + 2]}">${e > 0 ? "+" + e : e < 0 ? "−" + -e : "0"}</button>`).join("")}</div><div class="elabels"><span class="warnc">drains a lot</span><span class="muted">neutral</span><span class="goodc">recharges</span></div>`;
function costChips(x) {
  const w = weekly(x), c = [];
  if (x.type === "oneoff") c.push(`<span class="cc">⏱ ${x.days} day${x.days === 1 ? "" : "s"}</span>`); else if (w) c.push(`<span class="cc">⏱ ${w < 0 ? "saves " + h1(-w) : h1(w)} h/wk</span>`);
  if (x.m1) c.push(`<span class="cc">${kmoney(x.m1)}</span>`);
  if (x.mm) c.push(`<span class="cc">${x.mm < 0 ? "saves " + kmoney(-x.mm) : kmoney(x.mm)}/mo</span>`);
  c.push(`<span class="cc ${x.e > 0 ? "good" : x.e < 0 ? "bad" : ""}">⚡${x.e > 0 ? "+" + x.e : x.e < 0 ? "−" + -x.e : "0"}</span>`);
  return `<span class="ccs">${c.join("")}</span>`;
}
function budgetsCard(list, compact) {
  const C = CH(), t = totals(list), o = over(t);
  const bar = (lbl, used, of, txt, bad) => `<div class="bud"><b>${lbl}</b><div class="bar"><i style="width:${Math.min(100, of > 0 ? used / of * 100 : (used > 0 ? 100 : 0))}%;background:${bad ? "var(--warnbar)" : "var(--btn)"}"></i></div><b class="${bad ? "warnc" : ""}">${txt}</b></div>`;
  return `<div class="card buds" id="buds">${bar("⏱ Time", t.time, C.time, h1(t.time) + " / " + h1(C.time) + " h a week", o.time > 0)}${bar("₹ Month".replace("₹", C.cur), Math.max(0, t.month), C.month, kmoney(t.month) + " / " + kmoney(C.month), o.month > 0)}${compact ? "" : bar(C.cur + " Saved", t.pot, C.pot, kmoney(t.pot) + " / " + kmoney(C.pot), o.pot > 0)}${bar("⚡ Drain", t.drain, C.energy + t.back, t.drain + " / " + (C.energy + t.back) + " pts", o.energy > 0)}${!compact && t.back ? `<p class="tiny muted" style="margin:2px 0 0">${C.energy} you can carry, +${t.back} back from things that recharge you</p>` : ""}</div>`;
}
const chHead = (title, backTxt, sub) => `${head(title, backTxt)}${sub ? `<p class="tiny muted">${sub}</p>` : ""}`;

/* ---- First time: budgets and lenses ---- */
P.choose = () => {
  const C = CH(); fitSel = null; sortDraft = null;
  if (!C.setup) return `<h1>Ten things. One week.</h1><p class="muted">You want to do more than fits. Choose weighs each thing's cost in <b>time</b>, <b>money</b> and <b>energy</b>, looks at it through lenses you pick, and shows what fits this era. The rest waits its turn, on purpose.</p>
    <div class="card trio"><div><b class="bignum">⏱</b><b>Time</b><span class="tiny muted">from Era</span></div><div><b class="bignum">${C.cur}</b><b>Money</b><span class="tiny muted">a monthly budget</span></div><div><b class="bignum">⚡</b><b>Energy</b><span class="tiny muted">drains or recharges</span></div></div>
    <div class="btns">${btn("Set my budgets", "go", "ch_time", "primary block")}</div>`;
  const now = C.things.filter(x => x.status === "now"), nx = C.things.filter(x => x.status === "next"), later = C.things.filter(x => x.status === "later"), ideas = C.things.filter(x => x.status === "idea");
  const t = today(), mon = mondayOf(t);
  let h = `<h1>Choose</h1><p class="muted">${esc(eraName(curQ()) || qLabel(curQ()))} · ${now.length} now${nx.length ? ", " + nx.length + " next" : ""}</p>`;
  const due = checkDue(); if (due) h += `<button class="card rowcard tip" data-act="go" data-arg="ch_review"><span class="grow"><b>Monthly check, 5 minutes</b><br><span class="tiny muted">How did ${monthName(due)} go for your ${now.length} things?</span></span><span class="chev">›</span></button>`;
  C.decisions.filter(dc => dc.chosen && dc.review && dc.review <= t && !dc.outcome).forEach(dc => { h += `<button class="card rowcard tip" data-act="go" data-arg="ch_decreview" data-id="${dc.id}"><span class="grow"><b>${esc(dc.q)}: right call?</b><br><span class="tiny muted">You chose “${esc((dc.opts.find(o => o.id === dc.chosen) || {}).n || "")}” on ${fmtS(dc.at)}</span></span><span class="chev">›</span></button>`; });
  later.filter(x => x.review && x.review <= t).forEach(x => { h += `<button class="card rowcard" data-act="go" data-arg="ch_thing" data-id="${x.id}"><span class="grow"><b>Later: ${esc(x.t)}</b><br><span class="tiny muted">Review date. Bring it back, or keep it waiting?</span></span><span class="chev">›</span></button>`; });
  h += budgetsCard(now, true);
  h += now.length ? `<div class="card list">${now.map(x => { const w = weekly(x); let prog = "", pct = 0;
      if (x.type === "project") { const g = x.links && x.links.goal && S.goals.find(y => y.id === x.links.goal); const done = g ? goalDone(g) : hoursFor(x, x.at, t); prog = h1(done) + " of " + x.total + " h"; pct = done / x.total * 100; }
      else if (x.type === "habit") { const done = hoursFor(x, mon, t); prog = h1(done) + " of " + h1(w) + " h this week"; pct = w ? done / w * 100 : 0; }
      else { prog = x.date ? (x.date < t ? "was " : "") + fmtS(x.date) : "a weekend"; pct = x.date && x.date < t ? 100 : 0; }
      return `<div class="li"><button class="grow blkbtn" data-act="go" data-arg="ch_thing" data-id="${x.id}"><b>${esc(x.t)}</b><div class="bar slim"><i style="width:${Math.min(100, pct)}%;background:${ccol(x.area)}"></i></div><span class="tiny muted">${prog}</span></button>${x.type !== "oneoff" ? btn("+1 h", "ch-hour", x.id, "sm") : ""}</div>`; }).join("")}</div>` : `<div class="card tiny">Nothing chosen yet. ${C.things.length ? "Open What fits to choose." : "Add the things you want to do."}</div>`;
  h += `<div class="btns">${btn("+ A thing", "ch-add", null, "grow")}${btn("Make a decision", "ch-dec-new", null, "grow")}</div>`;
  h += `<div class="card list">${link("All " + C.things.length + " things", "Ranked, 2×2, urgent, balance, reality", "go", "ch_views")}${link("What fits this era", now.length ? "Change what's chosen" : "Pick what fits your budgets", "go", "ch_fit")}${link("Lenses", activeLenses().length + " on" + (C.own.length ? " · " + C.own.length + " your own" : ""), "go", "ch_lenses")}${link("Budgets", h1(C.time) + " h a week · " + kmoney(C.month) + " a month · " + kmoney(C.pot) + " saved · energy " + C.energy, "go", "ch_time")}</div>`;
  if (nx.length) h += `<h3>Next</h3><div class="card list">${nx.map(x => thingRow(x)).join("")}</div>`;
  if (ideas.length) h += `<h3>Not sorted yet</h3><div class="card list">${ideas.map(x => thingRow(x)).join("")}</div>`;
  if (later.length) h += `<h3>Later</h3><div class="card list">${later.map(x => thingRow(x, x.review ? "review " + fmtS(x.review) : "")).join("")}</div>`;
  if (C.decisions.length) h += `<h3>Decisions</h3><div class="card list">${C.decisions.slice().reverse().map(dc => { const ch = dc.opts.find(o => o.id === dc.chosen); return `<button class="li" data-act="go" data-arg="${dc.chosen ? "ch_dec4" : "ch_dec1"}" data-id="${dc.id}"><span class="grow"><b>${esc(dc.q || "Untitled decision")}</b><br><span class="tiny muted">${ch ? "Chose " + esc(ch.n) + (dc.review ? " · review " + fmtS(dc.review) : "") : "not decided yet"}${dc.outcome ? " · " + { yes: "still right", part: "partly", no: "deciding again" }[dc.outcome] : ""}</span></span><span class="chev">›</span></button>`; }).join("")}</div>`;
  return h;
};
function thingRow(x, extra) { return `<button class="li" data-act="go" data-arg="ch_thing" data-id="${x.id}"><i class="vbar" style="background:${ccol(x.area)}"></i><span class="grow"><b>${esc(x.t)}</b><br>${costChips(x)}${extra ? ` <span class="tiny muted">${extra}</span>` : ""}</span><b class="score">${x.scored ? score(x) : "–"}</b></button>`; }
P.ch_time = () => {
  const C = CH(), pw = planWeek(curQ(), today()), keys = S.areas.concat(S.less.map(i => i.k)).filter(k => (pw[k] || 0) > 0 && isFree(k));
  const max = Math.max(1, ...keys.map(k => pw[k] || 0)), mv = movable();
  return `${chHead("Time you can give", C.setup ? "Choose" : "Back", "Budgets 1 of 3")}<p class="muted">From Era: <b class="ink">${Math.round(freeOf(pw))} free hours a week</b>. Most already have a home.</p>
  <div class="card">${keys.map(k => `<div class="cmp"><span>${sw(ccol(k))}${esc(cname(k))}</span><div class="bar"><i style="width:${(pw[k] || 0) / max * 100}%;background:${ccol(k)}"></i></div><span class="t">${hh(pw[k] || 0)}</span></div>`).join("")}<p class="tiny muted" style="margin:6px 0 0"><b class="goodc">${hh(mv)} can move</b> without touching your areas: ${esc(L("less").toLowerCase())} above its aim, and Other.</p></div>
  <div class="card"><div class="li"><span class="grow"><b>For new things</b></span>${stepper("ch-budget", "time", C.time, "hours a week")}</div><p class="tiny muted" style="margin:6px 0 0">${C.time > mv ? `${hh(C.time - mv)} more than can move freely, so some comes from areas you already have. Era says which when you commit.` : "All of it can come from what you want less of."}</p></div>
  <div class="btns">${btn("Next: money", "go", "ch_money", "primary block")}</div>`;
};
P.ch_money = () => {
  const C = CH();
  return `${chHead("Money you can give", "Back", "Budgets 2 of 3")}<p class="muted">Only what you'd put towards these things. Bills and savings you never touch stay out.</p>
  <div class="card"><label class="f" for="ch-month" style="margin-top:0">Each month, for monthly costs: classes, gym, EMIs</label><div class="moneyin"><span>${C.cur}</span><input type="number" inputmode="numeric" min="0" step="500" id="ch-month" data-in="ch-month" value="${C.month}"></div>
  <label class="f" for="ch-pot">Saved for goals now, for one-time costs: trips, fees, things</label><div class="moneyin"><span>${C.cur}</span><input type="number" inputmode="numeric" min="0" step="1000" id="ch-pot" data-in="ch-pot" value="${C.pot}"></div></div>
  <div class="chips">${CURS.map(c => chip(c, "ch-cur", c, C.cur === c)).join("")}</div><p class="tiny muted">Era never connects to your bank. These are your numbers, kept on this phone.</p>
  <div class="btns">${btn("Next: energy", "go", "ch_energy", "primary block")}</div>`;
};
P.ch_energy = () => {
  const C = CH();
  return `${chHead("Energy you can spend", "Back", "Budgets 3 of 3")}<p class="muted">Every thing either drains you or gives energy back.</p>
  <div class="card"><div class="edots static">${[-2, -1, 0, 1, 2].map(e => `<span class="edot e${e + 2}">${e > 0 ? "+" + e : e < 0 ? "−" + -e : "0"}</span>`).join("")}</div><div class="elabels"><span class="warnc">drains a lot</span><span class="muted">neutral</span><span class="goodc">recharges</span></div></div>
  <p class="muted">How much draining stuff can you carry in a normal week?</p><div class="seg" role="group">${ENERGY_LEVELS.map(([v, n]) => `<button data-act="ch-energy" data-arg="${v}" aria-pressed="${C.energy === v}">${n} · ${v}</button>`).join("")}</div>
  <div class="card tiny lh">A thing that drains a lot costs 2 points a week. Things that recharge give points back, so a run can pay for a hard study block.</div>
  <div class="btns">${btn(C.setup ? "Done" : "Next: your lenses", C.setup ? "home" : "go", C.setup ? null : "ch_lenses", "primary block")}</div>`;
};
P.ch_lenses = () => {
  const C = CH();
  return `${chHead("Your lenses", "Back", "How should Era judge them?")}<p class="muted">Standard frameworks, on by default. Weigh what matters more.</p>
  <div class="card list">${lensList().map(l => `<div class="li"><span class="grow"><b>${esc(l.n)}</b><br><span class="tiny muted">${esc(l.d || "")}</span></span>${l.on ? stepper("ch-lens-w", l.id, l.w, "weight", "").replace(/<b class="val">([^<]*)<\/b>/, `<b class="val">×$1</b>`) : ""}<button class="tgl" data-act="ch-lens-on" data-arg="${l.id}" aria-pressed="${l.on}" aria-label="${esc(l.n)} on or off"><i class="tg"></i></button>${l.own ? `<button class="icon-btn" data-act="go" data-arg="ch_own" data-id="${l.id}" aria-label="Edit ${esc(l.n)}">✎</button>` : ""}</div>`).join("")}</div>
  <div class="btns">${btn("+ Your own lens", "go", "ch_own", "block")}${btn(C.setup ? "Done" : "Next: add your things", C.setup ? "back" : "ch-setup-done", null, "primary block")}</div>`;
};
let ownDraft = null;
P.ch_own = a => {
  const C = CH(); if (!ownDraft || ownDraft.id !== (a.id || ownDraft.id)) ownDraft = a.id ? Object.assign({}, C.own.find(o => o.id === a.id)) : { id: "o_" + uid().slice(-6), n: "", q: "", w: 1, on: true, isNew: true };
  return `${chHead("Your own lens", "Lenses")}<p class="muted">Anything you judge by that the standard ones miss.</p>
  <label class="f" for="own-name">Name</label><input type="text" id="own-name" data-in="own-n" value="${esc(ownDraft.n)}" placeholder="Good for my parents" maxlength="32">
  <label class="f" for="own-q">The question it asks</label><input type="text" id="own-q" data-in="own-q" value="${esc(ownDraft.q)}" placeholder="How much does this help Mom and Dad?">
  <div class="card"><div class="li"><span class="grow">Weight</span>${stepper("own-w", "w", ownDraft.w, "weight", "").replace(/<b class="val">([^<]*)<\/b>/, `<b class="val">×$1</b>`)}</div><p class="tiny muted" style="margin:6px 0 0">1 = not at all · 5 = a lot. Era asks it for every thing, old and new, and in every decision.</p></div>
  <div class="btns">${!ownDraft.isNew ? btn("Delete lens", "own-del", null, "warn") : ""}${btn("Save lens", "own-save", null, "primary grow")}</div>`;
};
/* ---- Things ---- */
P.ch_dump = () => {
  const C = CH(), sugg = S.quests.filter(q => q.status === "open" && !q.thing && !C.things.some(x => x.t === q.title)).slice(0, 4);
  return `${chHead("What do you want to do?", "Back", "Your things")}<p class="muted">Don't judge yet. Just get them out.</p>
  <div class="card list" id="dumplist">${C.things.length ? C.things.map((x, i) => `<div class="li"><span class="grow">${i + 1}. ${esc(x.t)}</span>${x.sized ? `<span class="tiny muted">sized</span>` : ""}<button class="icon-btn" data-act="ch-del" data-arg="${x.id}" aria-label="Remove ${esc(x.t)}">✕</button></div>`).join("") : `<p class="tiny muted" style="margin:8px 0">Nothing yet. Type one below and press Enter.</p>`}</div>
  <div class="row"><input type="text" id="dump-in" placeholder="Learn guitar" maxlength="60" aria-label="A thing you want to do" class="grow">${btn("Add", "ch-dump-add", null, "sm")}</div>
  ${sugg.length ? `<p class="tiny muted" style="margin:10px 0 4px">From Era's ${esc(L("quests").toLowerCase())}</p><div class="chips">${sugg.map(q => chip("+ " + esc(q.title), "ch-dump-q", q.id, false)).join("")}</div>` : ""}
  <div class="btns">${btn(C.things.length ? "Size them: " + C.things.length + " thing" + (C.things.length > 1 ? "s" : "") : "Add a thing first", "ch-size-start", null, "primary block")}</div>`;
};
const posOf = x => { const all = CH().things.filter(y => y.status !== "letgo"); return (all.indexOf(x) + 1) + " of " + all.length; };
P.ch_size = a => {
  const x = thing(a.id); if (!x) return P.ch_dump();
  const w = weekly(x);
  return `${chHead("", "Back")}<div class="row"><span class="tiny muted grow">Size it · ${posOf(x)}</span></div><input type="text" class="titlein" data-in="th-t" data-id="${x.id}" value="${esc(x.t)}" aria-label="Name">
  <label class="f">Area</label><div class="chips">${S.areas.map(k => chip(esc(cname(k)), "th-area", x.id + "|" + k, x.area === k, `--cc:${ccol(k)}`)).join("")}</div>
  <div class="seg" role="group" style="margin-top:12px">${TYPES.map(([k, n]) => `<button data-act="th-type" data-arg="${x.id}|${k}" aria-pressed="${x.type === k}">${n}</button>`).join("")}</div>
  <p class="tiny muted" style="margin:6px 2px">${x.type === "habit" ? "Something you'd do every week, like the gym." : x.type === "project" ? "A total of hours by a date, like exam prep." : "A trip or a purchase: days and money, once."}</p>
  <div class="card list">
    ${x.type === "habit" ? `<div class="li"><span class="grow">⏱ Hours a week</span>${stepper("th-num", x.id + "|h|0.5", x.h, "hours a week")}</div>` : ""}
    ${x.type === "project" ? `<div class="li"><span class="grow">⏱ Hours in total</span>${stepper("th-num", x.id + "|total|5", x.total, "hours in total")}</div><div class="li"><label class="grow" for="th-by">By</label><input type="date" id="th-by" data-in="th-by" data-id="${x.id}" value="${x.by}" min="${addD(today(), 7)}" style="width:auto"></div><p class="tiny muted" style="margin:0 0 8px">about ${hh(w)} a week for ${weeksTo(x.by)} weeks</p>` : ""}
    ${x.type === "oneoff" ? `<div class="li"><span class="grow">⏱ Days</span>${stepper("th-num", x.id + "|days|1", x.days, "days", "")}</div>` : ""}
    <div class="li"><label class="grow" for="th-m1">${CH().cur} Once</label><div class="moneyin sm"><span>${CH().cur}</span><input type="number" inputmode="numeric" min="0" step="500" id="th-m1" data-in="th-m1" data-id="${x.id}" value="${x.m1}"></div></div>
    <div class="li"><label class="grow" for="th-mm">${CH().cur} A month <span class="tiny muted">(minus if it saves)</span></label><div class="moneyin sm"><span>${CH().cur}</span><input type="number" inputmode="numeric" step="500" id="th-mm" data-in="th-mm" data-id="${x.id}" value="${x.mm}"></div></div>
    <div class="li" style="border:0"><span class="grow">⚡ Energy</span></div>${edots("th-e", x.id, x.e)}
  </div>
  <div class="btns">${btn("Skip", "ch-next", x.id + "|skip", "")}${btn("Next: lenses", "go", "ch_score", "primary grow").replace('data-arg="ch_score"', `data-arg="ch_score" data-id="${x.id}"`)}</div>`;
};
P.ch_score = a => {
  const x = thing(a.id); if (!x) return P.ch_dump();
  const ls = lensList().filter(l => l.on); let rows = "";
  ls.forEach(l => {
    if (l.id === "areas") rows += S.areas.map(k => `<div class="li"><span class="grow">${sw(ccol(k))}${esc(cname(k))}</span>${dots5("th-sc", x.id + "|a:" + k, areaRating(x, k))}</div>`).join("");
    else if (l.id === "window") rows += `<div class="li"><span class="grow">Window</span></div><div class="chips">${WINDOWS.map(([k, n]) => chip(n, "th-win", x.id + "|" + k, x.sc.window === k)).join("")}</div>`;
    else if (l.id === "undo") rows += `<div class="li"><span class="grow">Can you undo it?</span></div><div class="chips">${UNDOS.map(([k, n]) => chip(n, "th-undo", x.id + "|" + k, x.sc.undo === k)).join("")}</div>`;
    else rows += `<div class="li"><span class="grow">${esc(l.id === "regret" ? "Regret at 80" : l.id === "hell" ? "Hell yeah?" : l.n)}${l.own && l.q ? `<br><span class="tiny muted">${esc(l.q)}</span>` : ""}</span>${dots5("th-sc", x.id + "|" + l.id, lensVal(x, l))}</div>${l.id === "hell" && lensVal(x, l) < 4 ? `<p class="tiny amber" style="margin:0 0 6px">${lensVal(x, l)} of 5 is not a hell yeah. Keep it only if regret is high.</p>` : ""}`;
  });
  const rank = sorted(CH().things.filter(y => y.scored || y === x)).indexOf(x) + 1;
  return `${chHead(x.t, "Size")}<p class="tiny muted">Through your lenses · ${posOf(x)}</p><div class="card list">${rows}</div>
  <div class="card dark row"><span class="grow"><b class="big">Score ${score(x)}</b> of 100<br><span class="tiny" style="opacity:.8">${topLens(x)}</span></span><span class="tiny" style="opacity:.8">#${rank} so far</span></div>
  <div class="btns">${btn("Next thing", "ch-next", x.id + "|scored", "primary block")}</div>`;
};
function topLens(x) { const ls = activeLenses().map(l => [l, l.w * (lensVal(x, l) - 1)]).sort((a, b) => b[1] - a[1]).slice(0, 2).filter(z => z[1] > 0); if (!ls.length) return "low on every lens"; return "heaviest on " + ls.map(([l]) => l.id === "areas" ? cname(S.areas.slice().sort((a, b) => areaRating(x, b) - areaRating(x, a))[0]) : l.id === "regret" ? "regret" : l.id === "hell" ? "excitement" : l.id === "window" ? "its window" : l.id === "undo" ? "being easy to undo" : l.n).join(" and "); }
/* ---- Five views ---- */
const VIEWS = [["rank", "Rank"], ["matrix", "2×2"], ["urgent", "Urgent"], ["balance", "Balance"], ["reality", "Reality"]];
let chView = "rank";
P.ch_views = () => {
  const C = CH(), list = C.things.filter(x => x.status !== "letgo");
  let h = `${chHead("Your " + list.length + " things", "Choose")}<div class="seg small" role="tablist">${VIEWS.map(([k, n]) => `<button data-act="ch-view" data-arg="${k}" aria-pressed="${chView === k}">${n}</button>`).join("")}</div>`;
  if (!list.length) return h + `<div class="card tiny">Add a few things first.</div>${btn("Add things", "go", "ch_dump", "primary block")}`;
  if (chView === "rank") h += `<div class="card list">${sorted(list).map((x, i) => `<button class="li" data-act="go" data-arg="ch_thing" data-id="${x.id}"><span class="rankn">${i + 1}</span><span class="grow"><b>${esc(x.t)}</b><br>${costChips(x)}</span><span class="scorebar"><span class="bar slim"><i style="width:${score(x)}%;background:${ccol(x.area)}"></i></span><b>${x.scored ? score(x) : "–"}</b></span></button>`).join("")}</div><p class="tiny muted">Score from your lenses. Tap one to change it.</p>`;
  if (chView === "matrix") h += `<div class="card">${matrixSVG(list)}</div><p class="tiny muted">Up: more impact through your lenses. Right: more time, money and energy together. Size: money.</p>`;
  if (chView === "urgent") { const med = list.map(score).sort((a, b) => a - b)[Math.floor(list.length / 2)]; const imp = x => score(x) >= Math.max(55, med), urg = x => x.sc.window === "now" || x.sc.window === "year";
    const Q = [["Do now", "window closing, matters", "var(--ink)", x => urg(x) && imp(x)], ["Schedule", "matters, any time", "var(--accent)", x => !urg(x) && imp(x)], ["Limit", "feels urgent, matters less", "var(--amber)", x => urg(x) && !imp(x)], ["Let go for now", "neither", "var(--muted)", x => !urg(x) && !imp(x)]];
    h += `<div class="quad">${Q.map(([n, d, c, f]) => `<div class="card" style="border-top:3px solid ${c}"><b style="color:${c}">${n}</b><div class="tiny muted">${d}</div>${sorted(list.filter(f)).map(x => `<button class="qi" data-act="go" data-arg="ch_thing" data-id="${x.id}">${esc(x.t)}</button>`).join("") || `<div class="tiny muted">–</div>`}</div>`).join("")}</div><p class="tiny muted">Urgent comes from each thing's window: “now or never” and “this year”. Important: a score of 55 or more.</p>`; }
  if (chView === "balance") { const top = sorted(list).slice(0, 5), add = {}; top.forEach(x => add[x.area] = (add[x.area] || 0) + weekly(x)); const pw = planWeek(curQ(), today());
    const row = (lbl, f) => `<div class="li"><b class="grow">${lbl}</b><span class="tiny muted" style="text-align:right">${f}</span></div>`;
    const byArea = (f, fmt) => { const o = {}; top.forEach(x => { o[x.area] = (o[x.area] || 0) + f(x); }); return Object.keys(o).filter(k => o[k]).map(k => cname(k) + " " + fmt(o[k])).join(" · ") || "nothing"; };
    const missing = S.areas.filter(k => !top.some(x => x.area === k));
    h += `<div class="card">${shapeSVG(S.areas, [{ v: pw, kind: "plan" }, { v: addTo(Object.assign({}, pw), add) }], 280)}${legend("Your week now", "With the top 5")}</div><div class="card list">${row("⏱ Time", byArea(weekly, v => "+" + hh(v)))}${row(CH().cur + " Money", byArea(x => x.m1 + 12 * Math.max(0, x.mm), v => kmoney(v) + "/yr"))}${row("⚡ Energy", byArea(x => x.e, v => (v > 0 ? "+" : "") + v))}</div>${missing.length ? `<p class="tiny muted">${esc(missing.map(cname).join(", "))} ${missing.length > 1 ? "get" : "gets"} nothing new. Fine, or add something?</p>` : ""}`; }
  if (chView === "reality") { const pri = {}; list.forEach(x => pri[x.area] = (pri[x.area] || 0) + score(x)); const ranked = Object.keys(pri).sort((a, b) => pri[b] - pri[a]);
    const from = addD(today(), -27), act = actualRange(from, today()), fr = freeOf(act) || 1; const show = ranked.concat(S.less.map(i => i.k).filter(k => !ranked.includes(k)));
    const max = Math.max(1, ...show.map(k => act[k] || 0)); let worst = null;
    ranked.forEach((k, i) => { const share = (act[k] || 0) / fr; if (i < 3 && share < 0.1 && (!worst || share < worst.share)) worst = { k, i, share }; });
    const lessTop = S.less.map(i => [i.k, (act[i.k] || 0) / fr]).sort((a, b) => b[1] - a[1])[0];
    h += `<p class="tiny muted">What you rank first, against where Era says your free time went in the last 4 weeks.</p><div class="card">${show.map(k => { const r = ranked.indexOf(k); return `<div class="realrow"><span>${esc(cname(k))}</span><b>${r >= 0 ? "#" + (r + 1) : ""}</b><div class="bar"><i style="width:${(act[k] || 0) / max * 100}%;background:${ccol(k)}"></i></div><b class="${isLess(k) ? "warnc" : ""}">${Math.round((act[k] || 0) / fr * 100)}%</b></div>`; }).join("")}</div>
    ${worst ? `<div class="card mism tiny lh"><b>${esc(cname(worst.k))} is your #${worst.i + 1} but gets ${Math.round(worst.share * 100)}%.</b>${lessTop && lessTop[1] > 0.15 ? ` ${esc(cname(lessTop[0]))}, which you want less of, gets ${Math.round(lessTop[1] * 100)}%.` : ""} What fits this era can move hours from one to the other.</div>` : `<div class="card good tiny">Your time roughly follows your priorities.</div>`}`; }
  return h + `<div class="btns">${btn("What fits this era", "go", "ch_fit", "primary block")}</div>`;
};
function matrixSVG(list) {
  const W = 320, H = 260, m = 26; const xs = list.map(costIx), xmax = Math.max(0.5, ...xs);
  let g = `<line x1="${m}" y1="${H / 2}" x2="${W - 6}" y2="${H / 2}" stroke="var(--line2)" stroke-dasharray="3 3"/><line x1="${(W + m) / 2}" y1="6" x2="${(W + m) / 2}" y2="${H - 22}" stroke="var(--line2)" stroke-dasharray="3 3"/>`;
  g += `<text x="${m + 4}" y="16" class="ql good">Quick wins</text><text x="${W - 8}" y="16" text-anchor="end" class="ql blue">Big bets</text><text x="${m + 4}" y="${H - 28}" class="ql">Fill-ins</text><text x="${W - 8}" y="${H - 28}" text-anchor="end" class="ql bad">Sinks</text>`;
  g += `<text x="12" y="${H / 2}" class="qa" transform="rotate(-90 12 ${H / 2})" text-anchor="middle">impact</text><text x="${(W + m) / 2}" y="${H - 6}" class="qa" text-anchor="middle">cost: time + money + energy</text>`;
  const seen = {};
  list.forEach(x => { let cx = m + 10 + (costIx(x) / xmax) * (W - m - 30), cy = H - 30 - (score(x) / 100) * (H - 50); const key = Math.round(cx / 14) + ":" + Math.round(cy / 14), n = seen[key] = (seen[key] || 0) + 1; if (n > 1) { const a = n * 2.4; cx += Math.cos(a) * 16 * Math.ceil(n / 4); cy += Math.sin(a) * 16 * Math.ceil(n / 4); } const r = Math.min(16, 6 + Math.sqrt(Math.max(0, x.m1 + 12 * Math.max(0, x.mm))) / 80);
    g += `<g data-act="go" data-arg="ch_thing" data-id="${x.id}" class="bub"><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${ccol(x.area)}" fill-opacity=".8" stroke="var(--surface)" stroke-width="1.5"/><text x="${cx.toFixed(1)}" y="${(cy + r + 10).toFixed(1)}" text-anchor="middle" class="qb">${esc(x.t.length > 16 ? x.t.slice(0, 15) + "…" : x.t)}</text></g>`; });
  return `<svg class="matrix" viewBox="0 0 ${W} ${H}" role="img" aria-label="Your things by impact and cost">${g}</svg>`;
}
/* ---- What fits ---- */
let fitSel = null;
P.ch_fit = () => {
  const C = CH(); if (!fitSel) fitSel = new Set(C.things.filter(x => x.status === "now").map(x => x.id));
  const list = sorted(C.things.filter(x => x.status !== "letgo")), chosen = list.filter(x => fitSel.has(x.id)), t = totals(chosen), o = over(t), mv = movable();
  let msg = "";
  if (o.time) msg += `<b class="warnc">${hh(o.time)} a week over.</b> ${mv > 0 ? `Make room from what you want less of (${hh(mv)} can move), or untick something.` : "Untick something, or raise your time budget."}`;
  if (o.month) msg += ` <b class="warnc">${kmoney(o.month)} a month over.</b>`;
  if (o.pot) msg += ` <b class="warnc">${kmoney(o.pot)} more than you've saved.</b>`;
  if (o.energy) msg += ` <b class="warnc">${o.energy} drain point${o.energy > 1 ? "s" : ""} over.</b> Add something that recharges you, or drop something draining.`;
  return `${chHead("What fits this era", "Choose")}<p class="tiny muted">Tick what you'll do. The bars fill as you go.</p><div id="fitbuds">${budgetsCard(chosen)}</div>
  <div class="card list">${list.map(x => `<button class="li fitrow" data-act="fit-tog" data-arg="${x.id}" aria-pressed="${fitSel.has(x.id)}"><span class="chk" aria-hidden="true">${fitSel.has(x.id) ? "✓" : ""}</span><span class="grow"><b>${esc(x.t)}</b><br>${costChips(x)}</span><b class="score">${x.scored ? score(x) : "–"}</b></button>`).join("")}</div>
  ${msg ? `<div class="card overcard tiny lh">${msg}<div class="btns">${o.time && mv > 0 ? btn("Make room", "fit-room", null, "sm primary") : ""}${btn("Suggest a set", "fit-suggest", null, "sm")}</div></div>` : chosen.length ? `<div class="card good tiny">Everything fits. ${C.room ? "Includes " + hh(C.room) + " made room for from " + esc(L("less").toLowerCase()) + "." : ""}</div>` : `<div class="btns">${btn("Suggest a set", "fit-suggest", null, "block")}</div>`}
  <div class="btns">${btn("Next: sort the rest", "fit-next", null, "primary block")}</div>`;
};
let sortDraft = null;
P.ch_sort = () => {
  const C = CH(), rest = sorted(C.things.filter(x => !fitSel.has(x.id)));
  if (!sortDraft) { sortDraft = {}; rest.forEach((x, i) => { sortDraft[x.id] = x.status === "now" || x.status === "idea" ? (i < 2 ? "next" : "later") : x.status; }); }
  return `${chHead("The rest waits, on purpose", "What fits")}<p class="muted">Next starts when one of now ends. Later gets a review date. Let go means not this era, no guilt.</p>
  <div class="card list">${rest.map(x => `<div class="li col"><span><b>${esc(x.t)}</b> <span class="tiny muted">score ${score(x)}</span></span><div class="seg small" role="group">${[["next", "Next"], ["later", "Later"], ["letgo", "Let go"]].map(([k, n]) => `<button data-act="sort-set" data-arg="${x.id}|${k}" aria-pressed="${sortDraft[x.id] === k}">${n}</button>`).join("")}</div></div>`).join("") || `<p class="tiny muted" style="margin:8px 0">Everything is chosen.</p>`}</div>
  <div class="btns">${btn("Next: what changes in Era", "go", "ch_commit", "primary block")}</div>`;
};
P.ch_commit = () => {
  const C = CH(), list = sorted(C.things.filter(x => fitSel && fitSel.has(x.id)));
  const fresh = list.filter(x => x.status !== "now"), keep = list.filter(x => x.status === "now"), drop = C.things.filter(x => x.status === "now" && !fitSel.has(x.id));
  return `${chHead("Here's what changes", "Back")}<div class="card list">${fresh.map(x => `<div class="li"><span class="grow"><b>${esc(x.t)}</b><br><span class="tiny muted">${esc(plannedLinks(x).text)}</span></span><span class="tiny muted">${esc(cname(x.area))}</span></div>`).join("") || `<p class="tiny muted" style="margin:8px 0">Nothing new to add to Era.</p>`}${keep.map(x => `<div class="li"><span class="grow"><b>${esc(x.t)}</b><br><span class="tiny muted">already in Era</span></span></div>`).join("")}${drop.map(x => `<div class="li"><span class="grow"><b>${esc(x.t)}</b><br><span class="tiny warnc">comes out of Era: its hours go back</span></span></div>`).join("")}</div>
  <p class="tiny muted">Your shape, ${esc(L("lockin").toLowerCase())}s and weekends update. Choose keeps the money and energy side.</p>
  <div class="btns">${btn("Commit " + list.length + " thing" + (list.length === 1 ? "" : "s"), "ch-commit", null, "primary block")}</div>`;
};
/* ---- One thing ---- */
P.ch_thing = a => {
  const x = thing(a.id); if (!x) return P.choose();
  const t = today(), ym = ymOf(t), lk = x.links || {}, w = weekly(x);
  let era = "";
  if (x.status === "now") { if (lk.moves && lk.moves.length) era = `${esc(L("shift"))}: ${S.moves.filter(m => lk.moves.includes(m.id)).map(m => cname(m.from) + " → " + cname(m.to) + " " + h1(m.h) + " h").join(", ")}`; if (lk.goal) era = esc(L("lockin")) + ": " + x.total + " h by " + fmtS(x.by); if (lk.quest) era = "Weekend of " + fmtS(x.date); }
  return `${chHead(x.t, "Back")}<p class="tiny muted">${esc(cname(x.area))} · ${TYPES.find(y => y[0] === x.type)[1].toLowerCase()} · score ${score(x)}</p>
  <div class="seg small" role="group">${STATUSES.slice(0, 4).map(([k, n]) => `<button data-act="th-status" data-arg="${x.id}|${k}" aria-pressed="${x.status === k}">${n}</button>`).join("")}</div>
  ${x.status === "later" ? `<div class="li"><label class="grow" for="th-rev">Review on</label><input type="date" id="th-rev" data-in="th-review" data-id="${x.id}" value="${x.review || addD(t, 90)}" style="width:auto"></div>` : ""}
  ${era ? `<div class="card tiny">In Era: ${era}</div>` : ""}
  <div class="card">${costChips(x)}<div class="li" style="margin-top:6px"><span class="grow tiny">This week</span><b>${h1(hoursFor(x, mondayOf(t), t))} of ${h1(w)} h</b></div><div class="li"><span class="grow tiny">Spent in ${monthName(ym)}</span><b>${money(spentIn(x, ym))}</b></div></div>
  <div class="btns">${x.type !== "oneoff" ? btn("+1 h today", "ch-hour", x.id, "grow") : ""}${btn("Log money spent", "ch-spend", x.id, "grow")}</div>
  <div class="btns">${btn("Change size", "go", "ch_size", "grow").replace('data-arg="ch_size"', `data-arg="ch_size" data-id="${x.id}"`)}${btn("Change score", "go", "ch_score", "grow").replace('data-arg="ch_score"', `data-arg="ch_score" data-id="${x.id}"`)}</div>
  <div class="btns">${btn("Delete", "ch-thing-del", x.id, "warn sm")}</div>`;
};
/* ---- Decisions ---- */
P.ch_dec1 = a => {
  const dc = decision(a.id); if (!dc) return P.choose();
  return `${chHead("What are you deciding?", "Choose", "Decision 1 of 3")}<input type="text" class="titlein" data-in="dc-q" data-id="${dc.id}" value="${esc(dc.q)}" placeholder="Buy a car?" aria-label="The question">
  <label class="f">Your options</label><div class="card list">${dc.opts.map((o, i) => `<div class="li"><span class="optl">${String.fromCharCode(65 + i)}</span><input type="text" class="grow" data-in="opt-n" data-id="${dc.id}" data-o="${o.id}" value="${esc(o.n)}" placeholder="Option ${String.fromCharCode(65 + i)}" aria-label="Option ${String.fromCharCode(65 + i)}">${dc.opts.length > 2 ? `<button class="icon-btn" data-act="opt-del" data-arg="${dc.id}|${o.id}" aria-label="Remove option">✕</button>` : ""}</div>`).join("")}${dc.opts.length < 4 ? `<button class="rowlink" data-act="opt-add" data-arg="${dc.id}"><span class="grow muted">+ Another option</span></button>` : ""}</div>
  <label class="f">Can you undo it?</label><div class="seg" role="group">${[["one", "One-way door"], ["two", "Two-way door"]].map(([k, n]) => `<button data-act="dc-door" data-arg="${dc.id}|${k}" aria-pressed="${dc.door === k}">${n}</button>`).join("")}</div><p class="tiny muted">One-way doors get a slower look and a review date in 3 months.</p>
  <div class="btns">${btn("Next: what each costs", "dc-next", dc.id + "|ch_dec2", "primary block")}</div>`;
};
P.ch_dec2 = a => {
  const dc = decision(a.id); if (!dc) return P.choose(); const C = CH();
  const big = dc.opts.filter(o => o.m1 > C.pot), emi = dc.opts.filter(o => o.mm > C.month * 0.5);
  return `${chHead("What each costs", "Back", "Decision 2 of 3")}${dc.opts.map((o, i) => `<div class="card"><h3>${String.fromCharCode(65 + i)}. ${esc(o.n)}</h3>
    <div class="li"><span class="grow">⏱ Hours a week <span class="tiny muted">(minus if it saves time)</span></span>${stepper("opt-num", dc.id + "|" + o.id + "|h|0.5", o.h, "hours", " h").replace(/<b class="val">-/, '<b class="val">−')}</div>
    <div class="li"><label class="grow" for="o1-${o.id}">${C.cur} Now</label><div class="moneyin sm"><span>${C.cur}</span><input type="number" inputmode="numeric" min="0" step="1000" id="o1-${o.id}" data-in="opt-m1" data-id="${dc.id}" data-o="${o.id}" value="${o.m1}"></div></div>
    <div class="li"><label class="grow" for="om-${o.id}">${C.cur} A month</label><div class="moneyin sm"><span>${C.cur}</span><input type="number" inputmode="numeric" step="500" id="om-${o.id}" data-in="opt-mm" data-id="${dc.id}" data-o="${o.id}" value="${o.mm}"></div></div>
    <div class="li" style="border:0"><span class="grow">⚡ Energy</span></div>${edots("opt-e", dc.id + "|" + o.id, o.e)}
    <div class="chips" style="margin-top:8px">${UNDOS.map(([k, n]) => chip(n, "opt-undo", dc.id + "|" + o.id + "|" + k, o.undo === k)).join("")}</div></div>`).join("")}
  ${big.length || emi.length ? `<div class="card mism tiny lh">${big.map(o => `<b>${esc(o.n)}</b> costs more than your ${money(C.pot)} saved. `).join("")}${emi.map(o => `<b>${esc(o.n)}</b> takes ${Math.round(o.mm / C.month * 100)}% of your monthly budget.`).join(" ")}</div>` : ""}
  <div class="btns">${btn("Next: your lenses", "dc-next", dc.id + "|ch_dec3", "primary block")}</div>`;
};
P.ch_dec3 = a => {
  const dc = decision(a.id); if (!dc) return P.choose(); const rows = decRows(dc).filter(r => !r.cost && r.id !== "undo");
  return `${chHead("Through your lenses", "Back", "Decision 3 of 3")}${dc.opts.map((o, i) => `<div class="card"><h3>${String.fromCharCode(65 + i)}. ${esc(o.n)}</h3>${rows.map(r => `<div class="li"><span class="grow">${esc(r.n)}</span>${dots5("opt-sc", dc.id + "|" + o.id + "|" + r.id, o.sc[r.id] || 3)}</div>`).join("")}</div>`).join("")}
  <p class="tiny muted">Money, time, energy and undo come from the costs you just set, so they're not asked twice.</p><div class="btns">${btn("See the answer", "dc-next", dc.id + "|ch_dec4", "primary block")}</div>`;
};
P.ch_dec4 = a => {
  const dc = decision(a.id); if (!dc) return P.choose(); const sc = decScores(dc), win = sc[0].o, fl = decFlip(dc), chosen = dc.opts.find(o => o.id === dc.chosen);
  const sw1 = strengths(dc, win), run = sc[1] && sc[1].o, sw2 = run ? strengths(dc, run) : [];
  const tie = !chosen && sc[1] && sc[0].s === sc[1].s;
  return `${chHead("", "Choose")}<p class="muted" style="margin:0">${esc(dc.q || "Your decision")}</p><h1>${tie ? "A tie: " + esc(sc[0].o.n) + " or " + esc(sc[1].o.n) : esc(chosen ? chosen.n : win.n) + (chosen ? "" : ", for now")}</h1>
  <div class="card">${sc.map(({ o, s }) => `<div class="cmp"><span><b>${esc(o.n)}</b></span><div class="bar"><i style="width:${s}%;background:${o === win ? "var(--btn)" : "var(--muted)"}"></i></div><span class="t">${s}</span></div>`).join("")}</div>
  <div class="card tiny lh">${tie ? "Your lenses can't separate them. Let the gut check decide." : esc(win.n) + " wins"}${!tie && sw1.length ? " on <b>" + esc(sw1.slice(0, 2).join(" and ")) + "</b>" : ""}${tie ? "" : "."}${!tie && run && sw2.length ? " " + esc(run.n) + " wins on <b>" + esc(sw2.slice(0, 2).join(" and ")) + "</b>." : ""}${tie ? "" : fl ? `<br><span class="muted">It flips to ${esc(fl.to.n)} if ${esc(fl.row.n.toLowerCase())} matters ${fl.m}× more.</span>` : run ? `<br><span class="muted">No single lens flips it: a clear call.</span>` : ""}</div>
  ${!chosen ? `<div class="card tiny"><b>Gut check.</b> A coin chose “${esc(win.n)}”. How do you feel?<div class="btns">${btn("Relieved", "dc-gut", dc.id + "|relieved", "sm grow")}${btn("Disappointed", "dc-gut", dc.id + "|disappointed", "sm grow")}</div>${dc.gut === "disappointed" ? `<p class="amber" style="margin:4px 0 0">Part of you wants something else. Worth a second look before deciding.</p>` : dc.gut === "relieved" ? `<p class="goodc" style="margin:4px 0 0">Your gut agrees.</p>` : ""}</div>
    <label class="f" for="dc-why">Why, in a line (you'll see it at the review)</label><input type="text" id="dc-why" data-in="dc-why" data-id="${dc.id}" value="${esc(dc.why || "")}" placeholder="Money first until the CFA is done">
    <div class="btns col">${btn("Decide: " + esc(win.n) + " · review " + fmtS(addD(today(), dc.door === "one" ? 90 : 30)), "dc-decide", dc.id + "|" + win.id, "primary block")}${dc.opts.filter(o => o !== win).map(o => btn("Choose " + esc(o.n) + " instead", "dc-decide", dc.id + "|" + o.id, "block")).join("")}</div>`
  : `<div class="card tiny">Decided ${fmtS(dc.at)}${dc.why ? ": “" + esc(dc.why) + "”" : ""} · review ${fmtS(dc.review)}</div><div class="btns">${btn("Change the answer", "dc-undecide", dc.id, "block")}${btn("Delete decision", "dc-del", dc.id, "warn sm")}</div>`}`;
};
P.ch_decreview = a => {
  const dc = decision(a.id); if (!dc) return P.choose(); const ch = dc.opts.find(o => o.id === dc.chosen) || {};
  return `${chHead("", "Choose")}<p class="tiny muted">Decision · ${diffD(dc.at, today()) >= 60 ? Math.round(diffD(dc.at, today()) / 30) + " months" : diffD(dc.at, today()) + " days"} on</p><h1>${esc(ch.n || "")}: right call?</h1>
  <div class="card tiny lh">${dc.why ? `You chose it because <b>“${esc(dc.why)}”</b>.` : "You didn't write a reason."} It was ${esc(dc.q)}</div>
  <div class="btns col">${btn("Yes, still right", "dc-out", dc.id + "|yes", "primary block")}${btn("Partly", "dc-out", dc.id + "|part", "block")}${btn("No, decide again", "dc-out", dc.id + "|no", "block")}</div><p class="tiny muted">Either way, you chose it on purpose. Era keeps the reasons, so next time is faster.</p>`;
};
/* ---- Monthly check ---- */
P.ch_review = () => {
  const C = CH(), ym = checkDue() || ymOf(today()), first = ym + "-01", last = addD(ymOf(addD(first, 32)) + "-01", -1), end = last < today() ? last : today();
  const now = C.things.filter(x => x.status === "now"), weeks = Math.max(1, daysIn(first, end) / 7);
  const spent = C.things.reduce((a, x) => a + spentIn(x, ym), 0);
  let drained = 0; eachDay(first, end, d => { if (S.logs[d] && S.logs[d].energy === "low") drained++; });
  const nx = C.things.filter(x => x.status === "next"), gone = C.things.filter(x => x.status === "letgo"), laterDue = C.things.filter(x => x.status === "later" && x.review && x.review <= addD(today(), 7));
  return `${chHead("How did " + monthName(ym) + " go?", "Choose", "Monthly check, 5 minutes")}<div class="card list">${now.map(x => { const done = hoursFor(x, first, end), want = x.type === "habit" ? weekly(x) * weeks : x.type === "project" ? weekly(x) * weeks : 0; const ok = !want || done >= want * 0.8;
    return `<div class="li col"><span class="row"><span class="grow">${esc(x.t)}</span><b class="${ok ? "goodc" : "amber"}">${want ? h1(done) + " of " + h1(want) + " h" + (ok ? " ✓" : " · behind") : x.date ? fmtS(x.date) : ""}</b></span>${!ok ? `<div class="seg small" role="group">${[["keep", "Keep"], ["halve", "Halve it"], ["next", "Move to Next"]].map(([k, n]) => `<button data-act="rv-behind" data-arg="${x.id}|${k}">${n}</button>`).join("")}</div>` : ""}</div>`; }).join("") || `<p class="tiny muted" style="margin:8px 0">Nothing was chosen.</p>`}</div>
  <div class="card tiny lh">${C.cur} <b>${money(spent)} of ${money(C.month)}</b> spent on your things${now.some(x => x.m1 && x.date) ? " · trips set aside ✓" : ""}<br>⚡ Drained on ${drained} day${drained === 1 ? "" : "s"}${drained ? ", " + (now.filter(x => x.e < 0).map(x => x.t).slice(0, 2).join(" and ") || "a heavy month") : ""}.</div>
  ${nx.length ? `<h3>Next</h3><div class="card list">${nx.map(x => `<div class="li"><span class="grow">${esc(x.t)}</span>${btn("Start now", "rv-start", x.id, "sm")}</div>`).join("")}</div>` : ""}
  ${laterDue.length ? `<h3>Later, due for a look</h3><div class="card list">${laterDue.map(x => `<div class="li"><span class="grow">${esc(x.t)}</span>${btn("Bring back", "th-status", x.id + "|next", "sm")}${btn("+3 months", "rv-later", x.id, "sm")}</div>`).join("")}</div>` : ""}
  ${gone.length ? `<h3>Let go</h3><div class="card list faded">${gone.map(x => `<div class="li"><span class="grow">${esc(x.t)}</span>${btn("Bring back", "th-status", x.id + "|next", "sm")}</div>`).join("")}</div>` : ""}
  <div class="btns">${btn("Save the check", "rv-save", ym, "primary block")}</div>`;
};

/* ======================= Actions ======================= */
const chNum = v => { const n = Math.round(+String(v).replace(/[^\d.-]/g, "")); return isFinite(n) ? n : 0; };
function goThing(next) { if (next) { NAV = NAV.slice(0, -1).concat([next]); render(); window.scrollTo(0, 0); } }
function nextToSize(after) {
  const C = CH(), list = C.things.filter(x => x.status !== "letgo"), i = list.findIndex(x => x.id === after), rest = list.slice(i + 1).concat(list.slice(0, i + 1));
  return rest.find(x => !x.scored && x.id !== after);
}
const CH_ACT = {
  "ch-budget": a => { const C = CH(); C.time = Math.max(0, Math.min(60, C.time + (a.endsWith("+") ? 1 : -1))); save(); rerender(); },
  "ch-cur": c => { CH().cur = c; save(); rerender(); },
  "ch-energy": v => { CH().energy = +v; save(); rerender(); },
  "ch-lens-on": id => { const C = CH(); const std = C.lenses.find(l => l.id === id), own = C.own.find(l => l.id === id); const l = std || own; if (l) l.on = !l.on; save(); rerender(); },
  "ch-lens-w": a => { const [id, dir] = a.split("|"); const C = CH(); const l = C.lenses.find(x => x.id === id) || C.own.find(x => x.id === id); l.w = Math.max(0.5, Math.min(3, l.w + (dir === "+" ? 0.5 : -0.5))); save(); rerender(); },
  "ch-setup-done": () => { const C = CH(); C.setup = true; C.since = C.since || today(); save(); NAV = [{ p: "choose" }, { p: "ch_dump" }]; render(); window.scrollTo(0, 0); },
  "own-w": a => { ownDraft.w = Math.max(0.5, Math.min(3, ownDraft.w + (a.endsWith("+") ? 0.5 : -0.5))); rerender(); },
  "own-save": () => { const n = (ownDraft.n || "").trim(); if (!n) { toast("Give it a name"); return; } const C = CH(); const o = { id: ownDraft.id, n, q: (ownDraft.q || "").trim(), w: ownDraft.w, on: true }; const i = C.own.findIndex(x => x.id === o.id); if (i >= 0) C.own[i] = o; else C.own.push(o); ownDraft = null; save(); back(); toast("Lens saved: " + n); },
  "own-del": () => { const C = CH(); C.own = C.own.filter(x => x.id !== ownDraft.id); ownDraft = null; save(); back(); },
  "ch-dump-add": () => { const el = $("#dump-in"); const t = el && el.value.trim(); if (!t) { toast("Type a thing first"); return; } CH().things.push(newThing(t)); save(); rerender(); setTimeout(() => { const e2 = $("#dump-in"); if (e2) e2.focus(); }, 0); },
  "ch-dump-q": id => { const q = S.quests.find(y => y.id === id); if (!q) return; const x = newThing(q.title); x.area = S.areas.includes(q.area) ? q.area : x.area; CH().things.push(x); save(); rerender(); },
  "ch-del": id => { const C = CH(); const x = thing(id); if (x) unlinkThing(x); C.things = C.things.filter(y => y.id !== id); save(); rerender(); },
  "ch-size-start": () => { const C = CH(); if (!C.things.length) { toast("Add a thing first"); return; } const x = C.things.find(y => !y.scored && y.status !== "letgo") || C.things[0]; go("ch_size", { id: x.id }); },
  "ch-add": () => { NAV = [{ p: "choose" }, { p: "ch_dump" }]; render(); window.scrollTo(0, 0); setTimeout(() => { const e = $("#dump-in"); if (e) e.focus(); }, 0); },
  "th-area": a => { const [id, k] = a.split("|"); const x = thing(id); x.area = k; save(); rerender(); },
  "th-type": a => { const [id, k] = a.split("|"); const x = thing(id); x.type = k; save(); rerender(); },
  "th-num": a => { const [id, f, step, dir] = a.split("|"); const x = thing(id); const st = +step; x[f] = Math.max(f === "days" ? 1 : st, r2((x[f] || 0) + (dir === "+" ? st : -st))); save(); rerender(); },
  "th-e": a => { const [id, v] = a.split("|"); thing(id).e = +v; save(); rerender(); },
  "th-sc": a => { const [id, lens, v] = a.split("|"); const x = thing(id); if (lens.startsWith("a:")) { x.sc.areas = x.sc.areas || {}; x.sc.areas[lens.slice(2)] = +v; } else x.sc[lens] = +v; x.scored = true; save(); rerender(); },
  "th-win": a => { const [id, k] = a.split("|"); const x = thing(id); x.sc.window = k; x.scored = true; save(); rerender(); },
  "th-undo": a => { const [id, k] = a.split("|"); const x = thing(id); x.sc.undo = k; x.scored = true; save(); rerender(); },
  "ch-next": a => { const [id, how] = a.split("|"); const x = thing(id); if (how === "scored") { x.sized = true; x.scored = true; } if (how === "skip") x.sized = true; save();
    const nx = nextToSize(id); if (nx) { goThing({ p: "ch_size", id: nx.id }); return; } NAV = [{ p: "choose" }, { p: "ch_views" }]; chView = "rank"; render(); window.scrollTo(0, 0); toast("All sized. Here they are, ranked."); },
  "ch-view": v => { chView = v; rerender(); },
  "fit-tog": id => { fitSel = fitSel || new Set(); if (fitSel.has(id)) fitSel.delete(id); else fitSel.add(id); rerender(); },
  "fit-suggest": () => { fitSel = new Set(suggestSet()); rerender(); toast("Best value for its cost first, within all budgets"); },
  "fit-room": () => { const C = CH(), list = C.things.filter(x => fitSel.has(x.id)), o = over(totals(list)); const add = Math.min(o.time, movable()); C.time = r2(C.time + add); C.room = r2((C.room || 0) + add); save(); rerender(); toast("Made room: +" + hh(add) + " a week from " + L("less").toLowerCase()); },
  "fit-next": () => { const C = CH(), list = C.things.filter(x => fitSel.has(x.id)); if (!list.length) { toast("Tick at least one thing"); return; } if (!fits(totals(list))) { toast("Over a budget. Make room or untick something first."); return; } sortDraft = null; go("ch_sort"); },
  "sort-set": a => { const [id, k] = a.split("|"); sortDraft[id] = k; rerender(); },
  "ch-commit": () => { const C = CH(); C.things.forEach(x => { if (fitSel.has(x.id)) setStatus(x, "now"); else if (sortDraft && sortDraft[x.id]) setStatus(x, sortDraft[x.id]); else if (x.status === "now") setStatus(x, "next"); });
    snapshot("Choose: " + C.things.filter(x => x.status === "now").map(x => x.t).slice(0, 3).join(", ")); fitSel = null; sortDraft = null; save(); NAV = [{ p: "choose" }]; render(); window.scrollTo(0, 0); toast("Committed to Era"); },
  "ch-hour": id => { const x = thing(id); const from = logHourTo(x); if (!from) { toast("No free hour left today to move"); return; } save(); rerender(); toast("+1 h " + x.t + ", from " + cname(from).toLowerCase()); },
  "ch-spend": id => spendSheet(id),
  "th-status": a => { const [id, st] = a.split("|"); const x = thing(id); setStatus(x, st); save(); rerender(); toast(x.t + ": " + STATUSES.find(s => s[0] === st)[1]); },
  "ch-thing-del": id => { const x = thing(id); confirmSheet("Delete ‘" + x.t + "’?", "Its hours come out of Era too.", null, () => {}, () => { unlinkThing(x); CH().things = CH().things.filter(y => y !== x); save(); back(); }, "Delete"); },
  "ch-dec-new": () => { const dc = { id: uid(), q: "", door: "one", opts: [newOpt(""), newOpt("")], at: today() }; CH().decisions.push(dc); save(); go("ch_dec1", { id: dc.id }); },
  "opt-add": id => { decision(id).opts.push(newOpt("")); save(); rerender(); },
  "opt-del": a => { const [id, o] = a.split("|"); const dc = decision(id); dc.opts = dc.opts.filter(x => x.id !== o); save(); rerender(); },
  "dc-door": a => { const [id, k] = a.split("|"); decision(id).door = k; save(); rerender(); },
  "dc-next": a => { const [id, p] = a.split("|"); const dc = decision(id); if (p === "ch_dec2") { if (!dc.q.trim()) { toast("Write what you're deciding"); return; } dc.opts.forEach((o, i) => { if (!o.n.trim()) o.n = "Option " + String.fromCharCode(65 + i); }); save(); } go(p, { id }); },
  "opt-num": a => { const [id, o, f, st, dir] = a.split("|"); const op = decision(id).opts.find(x => x.id === o); op[f] = r2((op[f] || 0) + (dir === "+" ? +st : -st)); save(); rerender(); },
  "opt-e": a => { const [id, o, v] = a.split("|"); decision(id).opts.find(x => x.id === o).e = +v; save(); rerender(); },
  "opt-undo": a => { const [id, o, k] = a.split("|"); decision(id).opts.find(x => x.id === o).undo = k; save(); rerender(); },
  "opt-sc": a => { const [id, o, r, v] = a.split("|"); decision(id).opts.find(x => x.id === o).sc[r] = +v; save(); rerender(); },
  "dc-gut": a => { const [id, g] = a.split("|"); decision(id).gut = g; save(); rerender(); },
  "dc-decide": a => { const [id, o] = a.split("|"); const dc = decision(id); dc.chosen = o; dc.at = today(); dc.review = addD(today(), dc.door === "one" ? 90 : 30); save(); NAV = [{ p: "choose" }, { p: "ch_dec4", id }]; render(); toast("Decided. Review on " + fmtS(dc.review)); },
  "dc-undecide": id => { const dc = decision(id); dc.chosen = null; dc.outcome = null; save(); rerender(); },
  "dc-del": id => { CH().decisions = CH().decisions.filter(x => x.id !== id); save(); NAV = [{ p: "choose" }]; render(); },
  "dc-out": a => { const [id, k] = a.split("|"); const dc = decision(id); dc.outcome = k; save(); if (k === "no") { dc.chosen = null; dc.outcome = null; dc.gut = null; save(); NAV = [{ p: "choose" }, { p: "ch_dec4", id }]; render(); toast("Deciding again, with what you know now"); return; } NAV = [{ p: "choose" }]; render(); toast("Noted"); },
  "rv-behind": a => { const [id, k] = a.split("|"); const x = thing(id); if (k === "halve") { unlinkThing(x); if (x.type === "habit") x.h = Math.max(0.5, r2(x.h / 2)); else x.by = addD(x.by, Math.max(14, diffD(today(), x.by))); linkThing(x); toast("Halved: " + hh(weekly(x)) + " a week"); } if (k === "next") { setStatus(x, "next"); toast(x.t + " moved to Next"); } if (k === "keep") toast("Keeping it"); save(); rerender(); },
  "rv-start": id => { const x = thing(id); setStatus(x, "now"); save(); rerender(); toast(x.t + " started"); },
  "rv-later": id => { const x = thing(id); x.review = addD(today(), 90); save(); rerender(); },
  "rv-save": ym => { CH().reviews[ym] = { at: Date.now() }; save(); NAV = [{ p: "choose" }]; render(); window.scrollTo(0, 0); toast("Check saved"); }
};
const CH_IN = {
  "ch-month": v => { CH().month = Math.max(0, chNum(v)); save(); },
  "ch-pot": v => { CH().pot = Math.max(0, chNum(v)); save(); },
  "own-n": v => { ownDraft.n = v; }, "own-q": v => { ownDraft.q = v; },
  "th-t": (v, el) => { const x = thing(el.dataset.id); if (v.trim()) { x.t = v.trim(); save(); } },
  "th-by": (v, el) => { if (v) { thing(el.dataset.id).by = v; save(); rerender(); } },
  "th-m1": (v, el) => { thing(el.dataset.id).m1 = Math.max(0, chNum(v)); save(); },
  "th-mm": (v, el) => { thing(el.dataset.id).mm = chNum(v); save(); },
  "th-review": (v, el) => { if (v) { thing(el.dataset.id).review = v; save(); } },
  "dc-q": (v, el) => { decision(el.dataset.id).q = v; save(); },
  "opt-n": (v, el) => { decision(el.dataset.id).opts.find(o => o.id === el.dataset.o).n = v; save(); },
  "opt-m1": (v, el) => { decision(el.dataset.id).opts.find(o => o.id === el.dataset.o).m1 = Math.max(0, chNum(v)); save(); },
  "opt-mm": (v, el) => { decision(el.dataset.id).opts.find(o => o.id === el.dataset.o).mm = chNum(v); save(); },
  "dc-why": (v, el) => { decision(el.dataset.id).why = v; save(); }
};
const CH_LIVE = ["own-n", "own-q", "dc-q", "opt-n", "dc-why"];
const CH_AFTER = {
  ch_dump: () => { const el = $("#dump-in"); if (el) el.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); CH_ACT["ch-dump-add"](); } }); }
};
function spendSheet(id) {
  const x = thing(id), C = CH();
  const el = sheet("Spent on " + x.t, `<div class="moneyin"><span>${C.cur}</span><input type="number" inputmode="numeric" min="0" step="100" id="sp-amt" placeholder="2500"></div><div class="btns"><button class="btn primary block" data-ok>Add</button></div><p class="tiny muted">${monthName(ymOf(today()))} so far: ${money(spentIn(x, ymOf(today())))}</p>`);
  const ok = () => { const amt = chNum(el.querySelector("#sp-amt").value); if (amt <= 0) { toast("Type an amount"); return; } x.spent = x.spent || []; x.spent.push({ d: today(), amt }); save(); el.remove(); rerender(); toast(money(amt) + " on " + x.t); };
  el.querySelector("[data-ok]").onclick = ok; el.querySelector("#sp-amt").addEventListener("keydown", e => { if (e.key === "Enter") ok(); }); setTimeout(() => el.querySelector("#sp-amt").focus(), 50);
}
