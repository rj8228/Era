"use strict";
/* Era model: categories, activities, dates, saved state (with the move from v1), and the numbers
   every screen is drawn from. A day is a list of blocks {s, e, k} that always covers 0–24 h. */

const APPNAME = "Era";
const KEY = "era-v2", KEY_OLD = "era-v1";

/* ---------- Categories ----------
   An area is something you want more of (a corner of your shape). A less-of item is something you
   chose to shrink. Neutral time frames the day (sleep, work, commute, chores) or is just "other". */
const CATS = {
  family:   { n: "Family", c: "#8A5CC2" },
  friends:  { n: "Friends", c: "#E07A2A" },
  health:   { n: "Health", c: "#2E9A60" },
  learn:    { n: "Learning", c: "#1F8A93" },
  trips:    { n: "Trips", c: "#D9A22B" },
  selfcare: { n: "Self-care", c: "#6F9FD8" },
  partner:  { n: "Partner", c: "#D4537E" },
  career:   { n: "Career growth", c: "#3B6FB6" },
  create:   { n: "Creativity", c: "#B0569E" },
  faith:    { n: "Faith", c: "#9C7A3C" },
  giving:   { n: "Giving back", c: "#4F8F7A" },
  social:   { n: "Social media", c: "#D2452C" },
  tv:       { n: "TV and streaming", c: "#E2683F" },
  gaming:   { n: "Gaming", c: "#B8336A" },
  overtime: { n: "Overtime", c: "#E39A2D" },
  sleep:    { n: "Sleep", c: "#C9CEDC" },
  work:     { n: "Work", c: "#8E95AB" },
  commute:  { n: "Commute", c: "#A9AFC0" },
  chores:   { n: "Chores and meals", c: "#D6DAE4" },
  other:    { n: "Other", c: "#E8EAF0" }
};
const AREA_OPTS = ["family", "friends", "health", "learn", "trips", "selfcare", "partner", "career", "create", "faith", "giving"];
const LESS_OPTS = ["social", "tv", "gaming", "overtime", "commute"];
const NEUTRAL = ["sleep", "work", "commute", "chores", "other"];
const NOT_FREE = ["sleep", "work", "commute", "chores", "overtime"];
const CUSTOM_COLORS = ["#5B7DB1", "#A0662E", "#6E8B3D", "#8C5A9E", "#C2577A", "#3D8C8C", "#B07D2B"];
const LESS_CUSTOM_COLORS = ["#C0392B", "#B5482A", "#A53D59"];

/* What you did, and where it counts by default (the first option you're using wins). */
const ACTS = {
  sleep:   { n: "Sleep", to: ["sleep"] },
  work:    { n: "Work or classes", to: ["work"] },
  late:    { n: "Worked late", to: ["overtime", "work"] },
  commute: { n: "Commute", to: ["commute"] },
  chores:  { n: "Chores and meals", to: ["chores"] },
  scroll:  { n: "Scrolling", hint: "Instagram, YouTube", to: ["social", "selfcare", "other"] },
  tv:      { n: "TV or a show", to: ["tv", "selfcare", "other"] },
  game:    { n: "Gaming", to: ["gaming", "selfcare", "other"] },
  family:  { n: "Family time", to: ["family", "selfcare", "other"] },
  friends: { n: "Friends", hint: "dinner, a call", to: ["friends", "other"] },
  partner: { n: "Partner time", to: ["partner", "family", "friends", "other"] },
  gym:     { n: "Workout or walk", to: ["health", "selfcare", "other"] },
  study:   { n: "Study or reading", to: ["learn", "career", "other"] },
  hobby:   { n: "Hobby or making", to: ["create", "learn", "selfcare", "other"] },
  rest:    { n: "Nap, bath, alone time", to: ["selfcare", "other"] },
  movie:   { n: "Movie", to: ["selfcare", "tv", "other"] },
  trip:    { n: "Trip or outing", to: ["trips", "friends", "family", "other"] },
  pray:    { n: "Prayer or quiet", to: ["faith", "selfcare", "other"] },
  help:    { n: "Helping others", to: ["giving", "other"] },
  other:   { n: "Something else", to: ["other"] }
};
const PICK_ACTS = ["scroll", "gym", "family", "friends", "study", "rest", "movie", "tv", "game", "trip", "hobby", "partner", "late", "work", "chores", "commute", "sleep", "pray", "help", "other"];
const MAP_ACTS = ["scroll", "tv", "movie", "rest", "gym", "family", "friends", "study", "hobby", "trip", "game", "late"];
const WITH = [["", "Alone"], ["family", "Family"], ["friends", "Friends"], ["partner", "Partner"]];

/* Normal days to start from, as [hours, activity] from midnight. */
const seq = list => { let t = 0; return list.map(([h, a]) => { const b = { s: t, e: t + h, a }; t += h; return b; }); };
const PRESETS = {
  office:  { n: "Office job", wd: seq([[7, "sleep"], [1, "chores"], [1, "commute"], [9, "work"], [1, "commute"], [1, "family"], [2, "scroll"], [1, "rest"], [1, "sleep"]]),
             we: seq([[8, "sleep"], [1, "gym"], [2, "chores"], [4, "family"], [3, "friends"], [1, "chores"], [3, "scroll"], [2, "rest"]]) },
  wfh:     { n: "Work from home", wd: seq([[7.5, "sleep"], [1, "chores"], [9, "work"], [1, "chores"], [0.5, "gym"], [2, "family"], [2, "scroll"], [0.5, "rest"], [0.5, "sleep"]]),
             we: seq([[8, "sleep"], [1, "gym"], [2, "chores"], [4, "family"], [3, "friends"], [1, "chores"], [3, "scroll"], [2, "rest"]]) },
  student: { n: "Student", wd: seq([[7.5, "sleep"], [1, "chores"], [1, "commute"], [6, "work"], [1, "commute"], [3, "study"], [1, "friends"], [1, "family"], [2, "scroll"], [0.5, "sleep"]]),
             we: seq([[8.5, "sleep"], [3, "study"], [2.5, "chores"], [3, "family"], [3, "friends"], [3, "scroll"], [1, "rest"]]) }
};

/* Names people can change in Me → Names. */
const LABELS = {
  shape: ["Your shape", "The shape of your free hours"],
  today: ["Today's recap", "The daily recap"],
  week: ["Vibe check", "The weekly retro"],
  era: ["retro", "The era retro (shown as ‘my fitness era’ retro)"],
  quests: ["Side quests", "Trips, courses, people to see"],
  shift: ["Change my week", "Moving hours between areas"],
  lockin: ["Lock in", "Making room for a big goal"],
  less: ["Less of", "Things you want less of"],
  reclaimed: ["Reclaimed", "Hours won back"]
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOWL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BLOCKERS = ["Work ran late", "Too tired", "Phone at night", "Plans fell through", "Family needed me", "Unwell", "Forgot"];

/* ---------- Dates (all local, as yyyy-mm-dd) ---------- */
const pad = n => String(n).padStart(2, "0");
const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const parseD = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addD = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const nowH = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
const diffD = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
const dowOf = s => parseD(s).getDay();
const fmtD = s => { const d = parseD(s); return DOW[d.getDay()] + " " + d.getDate() + " " + MON[d.getMonth()]; };
const fmtS = s => { const d = parseD(s); return d.getDate() + " " + MON[d.getMonth()]; };
const mondayOf = s => addD(s, -((dowOf(s) + 6) % 7));
const qOf = s => { const d = parseD(s); return d.getFullYear() + "-Q" + (Math.floor(d.getMonth() / 3) + 1); };
const qStart = q => { const [y, n] = q.split("-Q").map(Number); return ymd(new Date(y, (n - 1) * 3, 1)); };
const qEnd = q => { const [y, n] = q.split("-Q").map(Number); return ymd(new Date(y, n * 3, 0)); };
const qPrev = q => { let [y, n] = q.split("-Q").map(Number); n--; if (n < 1) { n = 4; y--; } return y + "-Q" + n; };
const qNext = q => { let [y, n] = q.split("-Q").map(Number); n++; if (n > 4) { n = 1; y++; } return y + "-Q" + n; };
const qLabel = q => { const s = parseD(qStart(q)), e = parseD(qEnd(q)); return MON[s.getMonth()] + " – " + MON[e.getMonth()] + " " + e.getFullYear(); };
const daysIn = (a, b) => diffD(a, b) + 1;
function eachDay(a, b, fn) { for (let d = a; d <= b; d = addD(d, 1)) fn(d); }
/* Saturdays from today (a Sunday today counts as this weekend) up to `to`. */
function weekendsFrom(from, to) { const out = []; let d = from; if (dowOf(d) === 0) { out.push(addD(d, -1)); d = addD(d, 1); } while (dowOf(d) !== 6) d = addD(d, 1); for (; d <= to; d = addD(d, 7)) out.push(d); return out; }
const weekendsLeft = to => weekendsFrom(today(), to).length;
const hm = h => { const H = Math.floor(h + 1e-9) % 24, M = Math.round((h - Math.floor(h + 1e-9)) * 60); const ap = H < 12 ? "am" : "pm", h12 = H % 12 || 12; return h12 + (M ? ":" + pad(M) : "") + " " + ap; };
const hmShort = h => { const H = Math.floor(h + 1e-9) % 24, M = Math.round((h - Math.floor(h + 1e-9)) * 60); return (H % 12 || 12) + (M ? ":" + pad(M) : ""); };
const span = (s, e) => { const sa = Math.floor(s) % 24 < 12, ea = Math.floor(e - 1e-9) % 24 < 12 || e >= 24; return sa === ea && e < 24 ? hmShort(s) + "–" + hm(e) : hm(s) + "–" + (e >= 24 ? "12 am" : hm(e)); };

/* ---------- Numbers ---------- */
const r2 = x => Math.round(x * 2) / 2;
const r4 = x => Math.round(x * 4) / 4;                  // 15 minutes
const rmin = x => Math.round(x * 60) / 60;              // a minute
/* One 15-minute step from h, landing on the quarter hour (12:10 + one step is 12:15). */
const qStep = (h, dir) => dir > 0 ? Math.floor(h * 4 + 1e-6) / 4 + 0.25 : Math.ceil(h * 4 - 1e-6) / 4 - 0.25;
const h1 = x => { const r = Math.round(x * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
const hh = x => h1(x) + " h";
const hmin = m => m >= 60 ? Math.floor(m / 60) + " h" + (Math.round(m % 60) ? " " + Math.round(m % 60) + " m" : "") : Math.round(m) + " m";
const dur = h => hmin(Math.round(h * 60));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- State ---------- */
function fresh() {
  return {
    v: 2, onboarded: false, onboardedAt: null,
    areas: ["trips", "friends", "health", "learn", "family"], custom: {},
    less: [], push: "honest", pause: null, map: {}, shareWith: true,
    week: { preset: "office", workdays: [1, 2, 3, 4, 5], wd: PRESETS.office.wd.map(b => ({ ...b })), we: PRESETS.office.we.map(b => ({ ...b })) },
    logs: {}, moves: [], goals: [], quests: [], retros: {}, eras: {}, versions: [],
    protect: ["sleep", "health"],
    st: { on: false, aim: 2, map: {} },
    remind: { on: true, daily: "21:30", weekly: "19:00", weeklyDow: 0 },
    labels: {}, seen: {}, lastOpen: null, skipBefore: null, choose: null, acts: {}
  };
}
let S; // loaded at the end of this file, once everything it needs is defined
function loadState() {
  try {
    const t = localStorage.getItem(KEY);
    if (t) return Object.assign(fresh(), JSON.parse(t));
    const old = localStorage.getItem(KEY_OLD);
    if (old) { const m = fromV1(JSON.parse(old)); try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {} return m; }
  } catch (e) {}
  return fresh();
}
let saveHooks = [];
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} saveHooks.forEach(f => { try { f(); } catch (e) {} }); }
const L = k => (S.labels && S.labels[k]) || LABELS[k][0];

/* ---------- Categories in use ---------- */
const cat = k => CATS[k] || (S.custom && S.custom[k]) || CATS.other;
const cname = k => cat(k).n;
const ccol = k => cat(k).c;
const lessItem = k => S.less.find(x => x.k === k);
const isLess = k => !!lessItem(k);
const isArea = k => S.areas.includes(k);
const inUse = k => isArea(k) || isLess(k) || NEUTRAL.includes(k);
const kindOf = k => isLess(k) ? "less" : isArea(k) ? "area" : "neutral";
const isFree = k => !NOT_FREE.includes(k);
function catOf(a) {
  if (S.map[a] && inUse(S.map[a])) return S.map[a];
  const A = ACTS[a]; if (!A) return "other";
  return A.to.find(inUse) || "other";
}
const actName = a => (ACTS[a] && ACTS[a].n) || "";
/* Your own activities, like singing: S.acts = {id: {n, to, hidden}}. They join the built-in ones, first
   in the picker. A removed one stays hidden, so days that used it keep their label. */
function addActs() {
  Object.keys(ACTS).forEach(a => { if (ACTS[a].own) delete ACTS[a]; });
  for (let i = PICK_ACTS.length - 1; i >= 0; i--) if (!ACTS[PICK_ACTS[i]]) PICK_ACTS.splice(i, 1);
  const own = S.acts || {};
  Object.keys(own).forEach(id => { ACTS[id] = { n: own[id].n, to: [own[id].to, "other"], own: 1 }; });
  Object.keys(own).filter(id => !own[id].hidden).reverse().forEach(id => PICK_ACTS.unshift(id));
}
const ownActs = () => Object.keys(S.acts || {}).filter(id => !S.acts[id].hidden);

/* ---------- Blocks ---------- */
const sameB = (a, b) => a.k === b.k && (a.a || "") === (b.a || "") && (a.w || "") === (b.w || "") && (a.sh || "") === (b.sh || "") && (a.wo || "") === (b.wo || "") && (a.src || "") === (b.src || "") && (a.check || 0) === (b.check || 0) && (a.goal || "") === (b.goal || "") && (a.thing || "") === (b.thing || "");
function norm(list) {
  const bl = list.filter(b => b.e - b.s > 1e-6).map(b => ({ ...b })).sort((x, y) => x.s - y.s);
  const out = []; let t = 0;
  for (const b of bl) {
    if (b.e <= t + 1e-6) continue;
    if (b.s > t + 1e-6) out.push({ s: t, e: b.s, k: "other" });
    if (b.s < t) b.s = t;
    out.push(b); t = b.e;
  }
  if (t < 24 - 1e-6) out.push({ s: t, e: 24, k: "other" });
  const m = [];
  for (const b of out) { const p = m[m.length - 1]; if (p && sameB(p, b)) p.e = b.e; else m.push(b); }
  return m;
}
function setRange(list, s, e, patch) {
  const out = [];
  for (const b of list) {
    if (b.e <= s || b.s >= e) { out.push({ ...b }); continue; }
    if (b.s < s) out.push({ ...b, e: s });
    if (b.e > e) out.push({ ...b, s: e });
  }
  out.push(Object.assign({ s, e }, patch));
  return norm(out);
}
function moveEdge(list, i, t) {
  const a = list[i], b = list[i + 1]; if (!a || !b) return list;
  t = Math.max(a.s, Math.min(b.e, rmin(t)));
  const c = list.map(x => ({ ...x })); c[i].e = t; c[i + 1].s = t;
  return norm(c);
}
function hoursOf(bl) { const o = {}; bl.forEach(b => { o[b.k] = (o[b.k] || 0) + (b.e - b.s); }); return o; }
function sharedOf(bl) { const o = {}; bl.forEach(b => { if (b.sh) o[b.sh] = (o[b.sh] || 0) + (b.e - b.s); }); return o; }
const freeOf = o => Object.keys(o).reduce((a, k) => a + (isFree(k) ? o[k] : 0), 0);
const addTo = (o, p, f = 1) => { for (const k in p) o[k] = (o[k] || 0) + p[k] * f; return o; };

/* ---------- Normal week, logs and plans ---------- */
const isWorkday = d => S.week.workdays.includes(dowOf(d));
const tmplRaw = workday => workday ? S.week.wd : S.week.we;
function tmplFor(workday) { return norm(tmplRaw(workday).map(b => ({ s: b.s, e: b.e, k: b.k || catOf(b.a), a: b.a, src: "usual" }))); }
const tmplBlocks = d => tmplFor(isWorkday(d));
const logged = d => !!(S.logs[d] && S.logs[d].blocks);
const dayBlocks = d => logged(d) ? S.logs[d].blocks : tmplBlocks(d);
function tmplWeek() { const o = {}; for (let i = 0; i < 7; i++) addTo(o, hoursOf(tmplFor(S.week.workdays.includes(i)))); return o; }
/* Hours that actually happened from `a` to `b` (unlogged days before today count as your usual day).
   Trip days are left out of every number: they count neither for nor against anything. */
function actualRange(a, b) { const o = {}, t = today(); eachDay(a, b, d => { if (d > t || (d === t && !logged(d)) || awayOn(d)) return; addTo(o, hoursOf(dayBlocks(d))); }); return o; }
function sharedRange(a, b) { const o = {}, t = today(); eachDay(a, b, d => { if (d <= t && logged(d) && !awayOn(d)) addTo(o, sharedOf(S.logs[d].blocks)); }); return o; }
function countedDays(a, b) { const t = today(); let n = 0; eachDay(a, b, d => { if ((d < t || (d === t && logged(d))) && !awayOn(d)) n++; }); return n; }
function avgWeek(a, b) { const n = countedDays(a, b); const o = actualRange(a, b); if (!n) return o; for (const k in o) o[k] = o[k] * 7 / n; return o; }
/* This era's plan as hours a week: the normal week plus changes and lock-ins. */
function planDelta(q, d) {
  const o = {};
  S.moves.filter(m => m.q === q).forEach(m => { o[m.from] = (o[m.from] || 0) - m.h; o[m.to] = (o[m.to] || 0) + m.h; });
  S.goals.filter(g => !g.closed && (!d || (d >= g.start && d <= g.end))).forEach(g => { const per = goalPer(g); for (const k in g.src) o[k] = (o[k] || 0) - g.src[k]; o[g.area] = (o[g.area] || 0) + per; });
  return o;
}
function planWeek(q, d) { const o = addTo(tmplWeek(), planDelta(q, d)); for (const k in o) o[k] = Math.max(0, o[k]); return o; }
const goalWeeks = g => Math.max(1, Math.ceil(daysIn(g.start, g.end) / 7));
const goalPer = g => g.total / goalWeeks(g);
function goalDone(g) { const t = today(), end = t < g.end ? t : g.end; let n = 0; eachDay(g.start, end, d => { if (logged(d)) S.logs[d].blocks.forEach(b => { if (b.goal === g.id) n += b.e - b.s; }); }); return n; }

/* ---------- Less of: aims, ladders, pressure ---------- */
function aimFor(it, mon) {
  if (it.ladder) { const i = Math.floor(diffD(it.ladder.start, mon) / 7); if (i < 0) return it.base; if (i < it.ladder.steps.length) return it.ladder.steps[i]; return it.target; }
  return it.aim;
}
function lessNow(it, mon) {
  mon = mon || mondayOf(today());
  const from = S.returned && S.returned > mon ? S.returned : mon; // after time away, aims start again from the day you came back
  const end = addD(mon, 6), wtd = actualRange(from, end)[it.k] || 0, aim = aimFor(it, mon);
  return { wtd, aim, over: aim != null && wtd > aim + 0.01, watching: aim == null };
}
const paused = () => !!(S.pause && (S.pause.forever || (S.pause.until && S.pause.until >= today())));
const pushing = () => !paused() && !awayOn(today()) && S.push !== "gentle";
const brutal = () => !paused() && !awayOn(today()) && S.push === "brutal";
function overItems() { return S.less.filter(it => lessNow(it).over); }
/* The hours a less-of item took on a normal week, from your usual days. */
const usualOf = k => tmplWeek()[k] || 0;
function baseline(k) { const it = lessItem(k); const from = it && it.since && it.since > addD(today(), -28) ? it.since : addD(today(), -27); const n = countedDays(from, today()); if (n < 3) return usualOf(k); return (actualRange(from, today())[k] || 0) * 7 / n; }
function makeLadder(base, target, pace) {
  const weeks = pace === "gentle" ? 6 : pace === "bold" ? 2 : 4;
  const steps = []; for (let i = 1; i <= weeks; i++) steps.push(Math.max(target, r2(base - (base - target) * i / weeks)));
  return { start: mondayOf(addD(today(), 7)) <= addD(today(), 3) ? mondayOf(addD(today(), 7)) : mondayOf(today()), steps };
}
/* Hours won back: on each logged day, less-of time below your usual day, moved into areas. */
function reclaimed(a, b) {
  let tot = 0; const to = {}; const t = today();
  eachDay(a, b, d => {
    if (d > t || !logged(d) || awayOn(d)) return;
    const act = hoursOf(S.logs[d].blocks), us = hoursOf(tmplBlocks(d));
    let won = 0; S.less.forEach(it => { won += Math.max(0, (us[it.k] || 0) - (act[it.k] || 0)); });
    if (won <= 0) return; tot += won;
    const gains = S.areas.map(k => [k, Math.max(0, (act[k] || 0) - (us[k] || 0))]).filter(x => x[1] > 0);
    const g = gains.reduce((x, y) => x + y[1], 0);
    gains.forEach(([k, v]) => to[k] = (to[k] || 0) + won * v / g);
  });
  return { tot, to };
}
function worthNo(a, b) { let n = 0; eachDay(a, b, d => { if (logged(d)) S.logs[d].blocks.forEach(x => { if (x.wo === "no") n++; }); }); return n; }
function honestStreak() { let n = 0, d = today(); if (!logged(d)) d = addD(d, -1); for (let i = 0; i < 400; i++, d = addD(d, -1)) { if (awayOn(d)) continue; if (!logged(d)) break; n++; } return n; }
const UNITS = { health: [1, "run", "runs"], learn: [1, "guitar lesson", "guitar lessons"], friends: [3, "long dinner with friends", "long dinners with friends"], family: [3, "evening with family", "evenings with family"], trips: [8, "day trip", "day trips"], selfcare: [2, "slow morning", "slow mornings"], partner: [3, "date night", "date nights"], create: [2, "afternoon of making", "afternoons of making"], career: [1, "hour of a course", "hours of a course"] };
function costOf(h, area) {
  const u = UNITS[area] || [1, "hour of " + cname(area).toLowerCase(), "hours of " + cname(area).toLowerCase()];
  const n = Math.floor(h / u[0]); if (n < 1) return hh(h) + " of " + cname(area).toLowerCase();
  return n + " " + (n === 1 ? u[1] : u[2]);
}
function evening(h) { return h >= 16 ? "two whole days" : h >= 8 ? "a whole day" : h >= 4 ? "a whole afternoon" : h >= 1.5 ? "a whole evening" : "an hour back"; }

/* ---------- Era and weekend helpers ---------- */
const eraName = q => (S.eras[q] && S.eras[q].name) || "";
const curQ = () => qOf(today());
const freeLeftWeek = () => { const t = today(), sun = addD(mondayOf(t), 6), q = curQ(); let o = 0; eachDay(t, sun, d => { if (awayOn(d)) return; o += freeOf(hoursOf(tmplBlocks(d))) + freeOf(planDelta(q, d)) / 7; }); return o; };
function questsFor(fn) { return S.quests.filter(fn); }
/* ---------- Side quests on the calendar ----------
   A dated side quest takes the days from `day` to `to` (or just `day`). One saved before 0.3.2 with
   only `date` (a Saturday) takes the whole weekend. A weekend has four slots: Saturday and Sunday,
   each with a first half (morning) and a second half (afternoon and evening). A one-day plan can take
   just one half (`part`: am or pm). A trip (away) takes whole days and pauses logging on them. */
function qSpan(x) { if (x.day) return [x.day, x.to && x.to > x.day ? x.to : x.day]; if (x.date) return [x.date, addD(x.date, 1)]; return null; }
const covers = (x, d) => { const r = qSpan(x); return !!r && d >= r[0] && d <= r[1]; };
const live = x => x.status !== "dropped";
const onDay = (d, not) => S.quests.find(x => x !== not && live(x) && covers(x, d)) || null;
const HALVES = [["am", "First half", "morning"], ["pm", "Second half", "afternoon and evening"]];
const takes = (x, d, h) => covers(x, d) && (!x.part || !h || x.part === h);
const onSlot = (d, h, not) => S.quests.find(x => x !== not && live(x) && takes(x, d, h)) || null;
/* What's on one weekend day: the plan in each half (the same one for a whole-day plan). */
const dayPlans = (d, not) => [onSlot(d, "am", not), onSlot(d, "pm", not)];
const isAway = x => !!x && !!qSpan(x) && !x.part && (x.away != null ? !!x.away : x.area === "trips");
const awayOn = d => S.quests.find(x => live(x) && isAway(x) && covers(x, d)) || null;
const claimOf = sat => onDay(sat) || onDay(addD(sat, 1));
/* Weekend half-days from `from` to `to`: how many are left, free and planned. Four make a weekend. */
function wkDays(from, to) { let left = 0, free = 0; weekendsFrom(from, to).forEach(s => [s, addD(s, 1)].forEach(d => { if (d < from || d > to) return; ["am", "pm"].forEach(h => { left++; if (!onSlot(d, h)) free++; }); })); return { left, free, planned: left - free }; }
const qW = n => { const w = Math.floor(n / 4), f = ["", "¼", "½", "¾"][n % 4]; return (w || !f ? String(w) : "") + f; };
const wks = n => qW(n) + (n > 0 && n <= 4 ? " weekend" : " weekends");
/* "Sat 7 Nov", "weekend of 7 Nov", "Fri 6 – Mon 9 Nov". */
function spanLabel(x, bare) {
  const r = qSpan(x); if (!r) return x.when === "week" ? "this week" : x.when === "month" ? "this month" : "this era";
  const [a, b] = r; if (a === b) return (bare ? "" : "on ") + fmtD(a) + (x.part ? ", " + (x.part === "am" ? "first" : "second") + " half" : "");
  if (dowOf(a) === 6 && b === addD(a, 1)) return "weekend of " + fmtS(a);
  const da = parseD(a), db = parseD(b);
  return da.getMonth() === db.getMonth() && da.getFullYear() === db.getFullYear() ? DOW[da.getDay()] + " " + da.getDate() + " – " + fmtD(b) : fmtD(a) + " – " + fmtD(b);
}
function shiftQ(x, n) { if (x.day) x.day = addD(x.day, n); if (x.to) x.to = addD(x.to, n); if (x.date) x.date = addD(x.date, n); x.q = qOf(x.day || x.date); }
/* Would moving this side quest n days land on a weekend day someone else has? */
function clashAt(x, n) { const r = qSpan(x); if (!r) return null; let hit = null; eachDay(addD(r[0], n), addD(r[1], n), d => { if (!hit && [0, 6].includes(dowOf(d))) { const c = x.part ? onSlot(d, x.part, x) : onDay(d, x); if (c) hit = { d, c }; } }); return hit; }
const BACK = ["Drained", "Tired", "Same as before", "Rested", "Recharged"];

/* ---------- Screen time (Android only) ---------- */
const NATIVE = () => window.EraNative || null;
const APP_HINTS = [
  [/instagram|facebook\.katana|com\.twitter|x\.android|snapchat|reddit|youtube|linkedin|threads|pinterest|musically|tiktok|sharechat|moj|josh/i, "social"],
  [/netflix|primevideo|amazon\.avod|hotstar|disney|jiocinema|sonyliv|zee5|mxplayer|hulu|max\b/i, "tv"],
  [/kindle|duolingo|audible|coursera|udemy|khan|byjus|unacademy/i, "learn"],
  [/strava|fitness|nike|healthifyme|cult/i, "health"]
];
function appCat(pkg, hint) {
  if (S.st.map[pkg] !== undefined) return S.st.map[pkg] || null;
  for (const [re, k] of APP_HINTS) if (re.test(pkg) && inUse(k)) return k;
  const byHint = { social: "social", video: "tv", game: "gaming" }[hint];
  if (byHint && inUse(byHint)) return byHint;
  if (byHint === "tv" && inUse("social")) return null;
  return null;
}
const stCache = {};
/* {apps:[{pkg,label,hint,min}], slots:{pkg:[48 half-hours of minutes]}} for a day, or null. */
function stDay(d, fresh) {
  const N = NATIVE(); if (!S.st.on || !N || !N.stDay) return null;
  if (!fresh && stCache[d] && (d !== today() || Date.now() - stCache[d].at < 60000)) return stCache[d].v;
  let v = null; try { v = JSON.parse(N.stDay(d)); } catch (e) { v = null; }
  stCache[d] = { v, at: Date.now() }; return v;
}
const stGranted = () => { const N = NATIVE(); try { return !!(N && N.stStatus && N.stStatus() === "granted"); } catch (e) { return false; } };
/* Minutes per category inside each half hour of a day. */
function stSlots(d) {
  const v = stDay(d); if (!v || !v.slots) return null;
  const out = {};
  for (const pkg in v.slots) { const app = (v.apps || []).find(a => a.pkg === pkg) || {}; const k = appCat(pkg, app.hint); if (!k) continue; out[k] = out[k] || new Array(48).fill(0); v.slots[pkg].forEach((m, i) => out[k][i] += m); }
  return out;
}
function stTotal(d) { const v = stDay(d); if (!v || !v.apps) return null; return v.apps.reduce((a, x) => a + x.min, 0); }
/* Your usual day, corrected by what the phone saw: a free half hour with 20+ minutes in a mapped app
   becomes that app's category (so does usual sleep time: you weren't asleep); 10–19 minutes in free
   time is marked to check. */
function autoFill(d) {
  let bl = tmplBlocks(d); const sl = stSlots(d); if (!sl) return bl;
  for (let i = 0; i < 48; i++) {
    const s = i / 2, e = s + 0.5, cur = bl.find(b => b.s <= s + 1e-6 && b.e >= e - 1e-6); if (!cur) continue;
    let best = null, bm = 0; for (const k in sl) if (sl[k][i] > bm) { bm = sl[k][i]; best = k; }
    if ((isFree(cur.k) || cur.k === "sleep") && best && bm >= 20 && best !== cur.k) bl = setRange(bl, s, e, { k: best, a: best === "social" ? "scroll" : best === "tv" ? "tv" : undefined, src: "phone" });
    else if (isFree(cur.k) && best && bm >= 10 && best !== cur.k && !cur.check) { const { s: _s, e: _e, ...rest } = cur; bl = setRange(bl, s, e, { ...rest, check: 1 }); }
  }
  return bl;
}
/* Phone minutes in mapped apps inside a block (for checking a logged block). */
function stInBlock(d, b) {
  const sl = stSlots(d); if (!sl) return null; let best = null, bm = 0;
  for (const k in sl) { if (k === b.k) continue; let m = 0; for (let i = Math.round(b.s * 2); i < Math.round(b.e * 2); i++) m += sl[k][i] || 0; if (m > bm) { bm = m; best = k; } }
  return best ? { k: best, min: bm } : null;
}

/* ---------- Moving from v1 ---------- */
const V1_CAT = { sleep: "sleep", work: "work", commute: "commute", chores: "chores", family: "family", people: "friends", health: "health", learn: "learn", travel: "trips", rest: "selfcare", phone: "social", other: "other" };
const V1_ACT = { sleep: "sleep", work: "work", commute: "commute", chores: "chores", family: "family", people: "friends", health: "gym", learn: "study", travel: "trip", rest: "rest", phone: "scroll", other: "other" };
const V1_ORDER = ["sleep", "work", "commute", "chores", "family", "people", "health", "learn", "travel", "rest", "phone", "other"];
const V1_FALLBACK = ["phone", "rest", "travel", "learn", "people", "family", "health", "chores", "sleep"];
/* Lay a v1 day of hours out from 11 pm, in a believable order, then cut it at midnight. */
function blocksFromHours(o, withK) {
  const h = k => Math.max(0, +o[k] || 0);
  const chores1 = Math.min(1, h("chores")), c2 = h("commute") / 2;
  const order = [["sleep", h("sleep")], ["chores", chores1], ["commute", c2], ["work", h("work")], ["commute", c2], ["health", h("health")], ["family", h("family")], ["people", h("people")], ["learn", h("learn")], ["travel", h("travel")], ["chores", h("chores") - chores1], ["phone", h("phone")], ["rest", h("rest")], ["other", h("other")]];
  let t = 23; const out = [];
  for (const [k, v] of order) { if (v <= 0) continue; let s = t, e = t + v; const b = { a: V1_ACT[k] }; if (withK) b.k = V1_CAT[k];
    if (e <= 24) out.push(Object.assign({ s, e }, b)); else if (s >= 24) out.push(Object.assign({ s: s - 24, e: e - 24 }, b)); else { out.push(Object.assign({ s, e: 24 }, b)); out.push(Object.assign({ s: 0, e: e - 24 }, b)); }
    t = e; }
  const mapped = out.map(b => ({ ...b, s: r2(b.s), e: r2(Math.min(24, b.e)) })).filter(b => b.s < 24);
  return norm(mapped).map(b => { if (!withK) delete b.k; else if (!b.k) b.k = "other"; return b; });
}
function fromV1(o) {
  const N = fresh();
  N.migratedFrom = 1; N.onboarded = !!o.onboarded; N.onboardedAt = o.onboardedAt || (o.onboarded ? today() : null);
  N.areas = ["trips", "friends", "health", "learn", "selfcare", "family"];
  N.less = [{ k: "social", since: N.onboardedAt || today(), aim: null }];
  const w = o.week || {};
  N.week = { preset: w.preset || "custom", workdays: (w.office || [1, 2, 3, 4, 5]).slice(),
    wd: blocksFromHours(w.wd || {}), we: blocksFromHours(w.we || {}) };
  // Days: replay v1's own sums (usual day plus changes), then lay them out as blocks.
  const zero = () => { const z = {}; V1_ORDER.forEach(k => z[k] = 0); return z; };
  const tmpl = d => { const t = (w.office || [1, 2, 3, 4, 5]).includes(dowOf(d)) ? (w.wd || {}) : (w.we || {}); const z = zero(); for (const k in t) z[k] = +t[k] || 0; return z; };
  const take = (x, from, h) => { for (const k of [from].concat(V1_FALLBACK.filter(k => k !== from))) { if (h <= 0) break; const t = Math.min(x[k] || 0, h); x[k] -= t; h -= t; } };
  for (const d in (o.logs || {})) {
    const Lg = o.logs[d] || {}; const x = Lg.hours ? Object.assign(zero(), Lg.hours) : tmpl(d);
    (Lg.e || []).forEach(en => { take(x, en.from, en.h); x[en.to] = (x[en.to] || 0) + en.h; });
    const tot = V1_ORDER.reduce((a, k) => a + (x[k] || 0), 0); if (tot < 24) x.other += 24 - tot;
    N.logs[d] = { blocks: blocksFromHours(x, true).map(b => ({ ...b, src: "v1" })), src: "v1", at: Lg.at || Date.now() };
    if (Lg.good) N.logs[d].good = Lg.good; if (Lg.energy) N.logs[d].energy = Lg.energy; if (Lg.change) N.logs[d].change = Lg.change;
  }
  N.moves = (o.moves || []).map(m => ({ id: m.id || uid(), q: m.q, from: V1_CAT[m.from] || m.from, to: V1_CAT[m.to] || m.to, h: m.h, note: m.note || "" }));
  N.goals = (o.goals || []).map(g => { const src = {}; for (const k in (g.src || {})) src[V1_CAT[k] || k] = g.src[k]; return { id: g.id || uid(), title: g.title, area: V1_CAT[g.corner] || "learn", total: g.total, start: g.start, end: g.end, src, why: g.why || "", closed: !!g.closed, result: g.result }; });
  N.quests = (o.plans || []).map(p => ({ id: p.id || uid(), title: p.title, area: V1_CAT[p.corner] || "trips", when: p.when === "quarter" ? "era" : p.when, week: p.week || null, month: p.month || null, q: p.q, status: p.status || "open", moved: p.moved || 0, created: p.created || today() }));
  N.retros = o.retros || {}; N.eras = o.eras || {};
  N.protect = (o.protect || ["sleep", "health"]).map(k => V1_CAT[k] || k);
  N.remind = Object.assign(N.remind, o.remind || {});
  const lb = {}; ["shape", "today", "week", "era", "quests", "shift", "lockin"].forEach(k => { if (o.labels && o.labels[k]) lb[k] = o.labels[k]; }); N.labels = lb;
  N.versions = [{ id: uid(), name: "From Era 0.1", at: today(), areas: N.areas.slice(), less: JSON.parse(JSON.stringify(N.less)), moves: N.moves.filter(m => m.q === qOf(today())).map(m => ({ ...m })) }];
  return N;
}
/* Accepts a v2 backup or a v1 one. */
function fromBackup(o) { if (!o || typeof o !== "object") throw new Error("not a backup"); if (o.v === 2) return Object.assign(fresh(), o); if (o.week && o.logs) return fromV1(o); throw new Error("not a backup"); }

/* ---------- Shape versions ---------- */
function snapshot(name) {
  const v = { id: uid(), name: name || ("Changed " + fmtS(today())), at: today(), areas: S.areas.slice(), less: JSON.parse(JSON.stringify(S.less)), moves: S.moves.filter(m => m.q === curQ()).map(m => ({ ...m })) };
  S.versions.unshift(v); S.versions = S.versions.slice(0, 20); return v;
}
function restoreVersion(id) {
  const v = S.versions.find(x => x.id === id); if (!v) return;
  snapshot("Before switching back to " + v.name);
  S.areas = v.areas.slice(); S.less = JSON.parse(JSON.stringify(v.less));
  const q = curQ(); S.moves = S.moves.filter(m => m.q !== q).concat(v.moves.map(m => ({ ...m, id: uid(), q })));
  save();
}

S = loadState();
addActs();
