/* Era — see where your week goes, move hours on purpose, and plan your eras.
   Everything is stored on this device. */
(function () {
"use strict";
const APP = "Era";
const KEY = "era-v1";

/* ---------- Buckets ---------- */
const B = {
  sleep:   { n: "Sleep", c: "#C9CEDC", fixed: 1 },
  work:    { n: "Work or classes", c: "#8E95AB", fixed: 1 },
  commute: { n: "Commute", c: "#A9AFC0", fixed: 1 },
  chores:  { n: "Chores and meals", c: "#DDE0EA", fixed: 1 },
  family:  { n: "Family", c: "#8A5CC2", corner: 1 },
  people:  { n: "Friends and people", c: "#E07A2A", corner: 1 },
  health:  { n: "Health", c: "#2E9A60", corner: 1 },
  learn:   { n: "Learning and hobbies", c: "#1F8A93", corner: 1 },
  travel:  { n: "Trips and outings", c: "#D9A22B", corner: 1 },
  rest:    { n: "Rest", c: "#B9D3F0" },
  phone:   { n: "Doomscroll (phone and TV)", c: "stripe" },
  other:   { n: "Not sure", c: "#E3E6EE", fixed: 1 }
};
const ORDER = ["sleep", "work", "commute", "chores", "family", "people", "health", "learn", "travel", "rest", "phone", "other"];
const FREE = ORDER.filter(k => !B[k].fixed);
const CORNERS = ["travel", "people", "health", "learn", "family"]; // pentagon, clockwise from the top
const SHORT0 = { travel: "Travel", people: "People", health: "Health", learn: "Learn", family: "Family", rest: "Rest", phone: "Phone", sleep: "Sleep", work: "Work", commute: "Commute", chores: "Chores" };
const PRESETS = {
  office: { n: "Office job", wd: { sleep: 7, work: 9, commute: 1.5, chores: 2, family: 1.5, phone: 2, rest: 1 }, we: { sleep: 8, chores: 3, family: 4, people: 3, phone: 3, learn: 1, health: 1, rest: 1 } },
  wfh:    { n: "Work from home", wd: { sleep: 7.5, work: 9, chores: 2.5, family: 2, phone: 2, health: 0.5, rest: 0.5 }, we: { sleep: 8, chores: 3, family: 4, people: 3, phone: 3, learn: 1, health: 1, rest: 1 } },
  student:{ n: "Student", wd: { sleep: 7.5, work: 6, commute: 1, learn: 3, chores: 2, family: 1.5, people: 1, phone: 2 }, we: { sleep: 8.5, learn: 3, chores: 2.5, family: 3, people: 3, phone: 3, rest: 1 } }
};
const CHIPS = [
  { l: "Workout or run", to: "health", h: 1, from: "phone" },
  { l: "Studied or practised", to: "learn", h: 1, from: "phone" },
  { l: "Met friends", to: "people", h: 2, from: "phone" },
  { l: "Family time", to: "family", h: 1, from: "phone" },
  { l: "Went out", to: "travel", h: 3, from: "phone" },
  { l: "Worked late", to: "work", h: 2, from: "rest" },
  { l: "More phone than usual", to: "phone", h: 1, from: "rest" },
  { l: "Rested", to: "rest", h: 1, from: "phone" }
];
const FALLBACK = ["phone", "rest", "travel", "learn", "people", "family", "health", "chores", "sleep"];
const BLOCKERS = ["Work ran late", "Too tired", "Plans fell through", "Phone at night", "Family needed me", "Unwell", "Forgot"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOWL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ---------- Names (editable in Settings) ---------- */
const LABELS = {
  shape: ["Your shape", "the pentagon of your free hours"],
  today: ["Today's recap", "the 30-second daily retro"],
  week: ["Vibe check", "the weekly retro"],
  era: ["retro", "the quarterly retro, shown as ‘my fitness era’ retro"],
  quests: ["Side quests", "plans: trips, courses, people"],
  shift: ["Shift hours", "moving hours between areas"],
  lockin: ["Lock-in mode", "making room for a big goal"],
  protect: ["Non-negotiables", "areas lock-in won't take from"],
  phone: ["Doomscroll", "the phone and TV bucket"]
};
const L = k => (S.labels && S.labels[k]) || LABELS[k][0];
const L_ = L;

/* ---------- State ---------- */
function defaults() {
  return {
    v: 1, onboarded: false,
    me: { age: "", leave: 18, save: "", energy: "okay", pace: "plan" },
    week: { preset: "office", office: [1, 2, 3, 4, 5], wd: Object.assign({}, PRESETS.office.wd), we: Object.assign({}, PRESETS.office.we) },
    moves: [], goals: [], plans: [], logs: {}, retros: {}, eras: {},
    protect: ["sleep", "health"],
    remind: { daily: "21:30", weeklyDow: 0, weekly: "19:00", on: true }
  };
}
let S = load();
function load() { try { const t = localStorage.getItem(KEY); if (t) return Object.assign(defaults(), JSON.parse(t)); } catch (e) {} return defaults(); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- Dates ---------- */
const pad = n => String(n).padStart(2, "0");
const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const add = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const diff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const dow = s => parse(s).getDay();
const fmt = s => { const d = parse(s); return DOW[d.getDay()] + " " + d.getDate() + " " + MON[d.getMonth()]; };
const fmtShort = s => { const d = parse(s); return d.getDate() + " " + MON[d.getMonth()]; };
const monday = s => add(s, -((dow(s) + 6) % 7));
const qKey = s => { const d = parse(s); return d.getFullYear() + "-Q" + (Math.floor(d.getMonth() / 3) + 1); };
const qStart = q => { const [y, n] = q.split("-Q").map(Number); return ymd(new Date(y, (n - 1) * 3, 1)); };
const qEnd = q => { const [y, n] = q.split("-Q").map(Number); return ymd(new Date(y, n * 3, 0)); };
const qPrev = q => { let [y, n] = q.split("-Q").map(Number); n--; if (n < 1) { n = 4; y--; } return y + "-Q" + n; };
const qLabel = q => { const s = parse(qStart(q)), e = parse(qEnd(q)); return MON[s.getMonth()] + " – " + MON[e.getMonth()] + " " + e.getFullYear(); };
function weekendsLeft(to) { // weekends with at least one day from today on
  let n = 0; const t = today();
  for (let d = t; d <= to; d = add(d, 1)) if (dow(d) === 6 || (d === t && dow(d) === 0)) n++;
  return n;
}

/* ---------- Hours ---------- */
const zero = () => { const o = {}; ORDER.forEach(k => o[k] = 0); return o; };
const isOffice = s => S.week.office.includes(dow(s));
function templateDay(s) { const t = isOffice(s) ? S.week.wd : S.week.we; const o = zero(); for (const k in t) o[k] = +t[k] || 0; return o; }
function sumDay(o) { return ORDER.reduce((a, k) => a + (o[k] || 0), 0); }
function take(o, from, h) { // take h hours, preferring `from`, then the fallbacks
  const order = [from].concat(FALLBACK.filter(k => k !== from));
  for (const k of order) { if (h <= 0) break; const t = Math.min(o[k], h); o[k] -= t; h -= t; }
}
function actualDay(s) {
  const L = S.logs[s];
  const o = L && L.hours ? Object.assign(zero(), L.hours) : templateDay(s);
  if (L && L.e) L.e.forEach(x => { take(o, x.from, x.h); o[x.to] += x.h; });
  return o;
}
function planDelta(s) { // weekly shifts from moves (this quarter) and active goals, spread over 7 days
  const d = zero(); const q = qKey(s);
  S.moves.filter(m => m.q === q).forEach(m => { d[m.from] -= m.h / 7; d[m.to] += m.h / 7; });
  S.goals.filter(g => !g.closed && s >= g.start && s <= g.end).forEach(g => {
    const wk = goalPerWeek(g); for (const k in g.src) { d[k] -= g.src[k] / 7; } d[g.corner] += wk / 7;
  });
  return d;
}
function plannedDay(s) { const o = templateDay(s), d = planDelta(s); ORDER.forEach(k => o[k] = Math.max(0, o[k] + d[k])); return o; }
function range(from, to, fn) { const o = zero(); for (let s = from; s <= to; s = add(s, 1)) { const d = fn(s); ORDER.forEach(k => o[k] += d[k]); } return o; }
const free = o => FREE.reduce((a, k) => a + o[k], 0);
const days = (from, to) => diff(from, to) + 1;
function avgWeek(from, to, fn) { const n = days(from, to); const o = range(from, to, fn); ORDER.forEach(k => o[k] = o[k] * 7 / n); return o; }
function templateWeek() { const o = zero(); for (let i = 0; i < 7; i++) { const t = S.week.office.includes(i) ? S.week.wd : S.week.we; for (const k in t) o[k] += +t[k] || 0; } return o; }
function goalWeeks(g) { return Math.max(1, Math.ceil(days(g.start, g.end) / 7)); }
function goalPerWeek(g) { return g.total / goalWeeks(g); }
const h1 = x => { const r = Math.round(x * 2) / 2; return (r % 1 ? r.toFixed(1) : String(r)); };
const hh = x => h1(x) + " h";

const SHORT = new Proxy(SHORT0, { get: (o, k) => k === "phone" ? L("phone") : o[k] });

/* A day always holds exactly 24 hours. Raising one area takes the hours from "Not sure", then
   doomscroll, then rest, then the rest in order; lowering one puts the hours into "Not sure". */
const SOURCE = ["other", "phone", "rest", "travel", "learn", "people", "family", "health", "chores", "sleep", "commute", "work"];
function dayHours(d) { const o = actualDay(d); const t = sumDay(o); if (Math.abs(t - 24) > 0.01) { if (t < 24) o.other += 24 - t; else take(o, "other", t - 24); } return o; }
function setHour(d, k, v, prefer) {
  const o = dayHours(d); v = Math.max(0, Math.min(24, Math.round(v * 2) / 2)); let delta = v - o[k];
  if (delta < 0) { o.other += -delta; o[k] = v; }
  else if (delta > 0) { const order = (prefer ? [prefer] : []).concat(SOURCE).filter((x, i, a) => x !== k && a.indexOf(x) === i);
    for (const x of order) { if (delta <= 0) break; const t = Math.min(o[x], delta); o[x] -= t; o[k] += t; delta -= t; } }
  const Lg = S.logs[d] = S.logs[d] || {}; Lg.hours = o; Lg.e = []; Lg.at = Date.now(); save();
}

/* ---------- Pentagon ---------- */
function pentagon(shapes, size, opts) {
  opts = opts || {};
  const cx = 160, cy = 135, R = 100, A = [-90, -18, 54, 126, 198];
  let max = opts.max || Math.max(8, ...shapes.map(sh => Math.max(...CORNERS.map(k => sh.v[k] || 0))));
  const pt = (k, v) => { const i = CORNERS.indexOf(k), a = A[i] * Math.PI / 180, r = R * Math.sqrt(Math.min(1, Math.max(0, v) / max)); return (cx + r * Math.cos(a)).toFixed(1) + "," + (cy + r * Math.sin(a)).toFixed(1); };
  const ring = f => CORNERS.map(k => pt(k, max * f)).join(" ");
  let g = `<polygon points="${ring(1)}" fill="var(--sunk)" stroke="var(--line2)" stroke-width="1"></polygon><polygon points="${ring(0.25)}" fill="none" stroke="var(--line2)" stroke-width="1" opacity=".6"></polygon>`;
  CORNERS.forEach(k => g += `<line x1="${cx}" y1="${cy}" x2="${pt(k, max).split(",")[0]}" y2="${pt(k, max).split(",")[1]}" stroke="var(--line2)" opacity=".6"></line>`);
  shapes.forEach(sh => {
    const pts = CORNERS.map(k => pt(k, Math.max(sh.v[k] || 0, max * 0.03))).join(" ");
    g += sh.dash ? `<polygon points="${pts}" fill="none" stroke="var(--muted)" stroke-width="2.2" stroke-dasharray="5 4"></polygon>`
                 : `<polygon points="${pts}" fill="var(--accent)" fill-opacity="0.2" stroke="var(--accent)" stroke-width="2.6" stroke-linejoin="round"></polygon>`;
  });
  if (!opts.mini) {
    const L = [[160, 22, "Travel"], [284, 101, "People"], [236, 238, "Health"], [84, 238, "Learn"], [34, 101, "Family"]];
    L.forEach(([x, y, t], i) => { const v = shapes[shapes.length - 1].v[CORNERS[i]] || 0; g += `<text x="${x}" y="${y}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink)" font-family="Figtree, sans-serif">${t}</text><text x="${x}" y="${y + 15}" text-anchor="middle" font-size="12" fill="var(--muted)" font-family="Figtree, sans-serif">${h1(v)}h</text>`; });
  }
  const vb = opts.mini ? "50 25 220 210" : "0 0 320 258";
  return `<svg class="pent" width="${size}" height="${Math.round(size * (opts.mini ? 210 / 220 : 258 / 320))}" viewBox="${vb}" role="img" aria-label="${esc(opts.label || L("shape"))}">${g}</svg>`;
}
const LEG = (a, b) => `<div class="legend"><span><svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" stroke="var(--muted)" stroke-width="2" stroke-dasharray="5 4"></line></svg> ${a}</span><span><svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" stroke="var(--accent)" stroke-width="3"></line></svg> ${b}</span></div>`;

/* ---------- Day bar ---------- */
const BAR_ORDER = ["sleep", "chores", "commute", "work", "family", "people", "health", "learn", "travel", "phone", "rest", "other"];
function dayBar(o, label) {
  let x = 0, r = "", W = 330, tot = Math.max(24, sumDay(o));
  BAR_ORDER.forEach(k => { const w = o[k] / tot * W; if (w <= 0.2) return; r += `<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="26" fill="${B[k].c === "stripe" ? "url(#strp)" : B[k].c}"></rect>`; x += w; });
  return `<svg width="100%" height="26" viewBox="0 0 330 26" preserveAspectRatio="none" role="img" aria-label="${esc(label || "Day by hour")}" style="border-radius:6px;display:block"><defs><pattern id="strp" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#F6D3CC"></rect><rect width="3" height="6" fill="#D2452C"></rect></pattern></defs>${r}</svg>`;
}
const dotFor = k => B[k].c === "stripe" ? `<i class="dot stripe"></i>` : `<i class="dot" style="background:${B[k].c}"></i>`;

/* ---------- Helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function toast(m) { const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2300); }
let tab = "today", weekOf = null;
const stepper = (key, v, lbl) => `<button class="step" data-step="${key}|-0.5" aria-label="Less ${esc(lbl)}">−</button>${/^[emd]:/.test(key) ? `<input class="valin" type="number" inputmode="decimal" min="0" max="24" step="0.5" data-setval="${key}" value="${h1(v)}" aria-label="${esc(lbl)} hours">` : `<span class="val">${hh(v)}</span>`}<button class="step" data-step="${key}|0.5" aria-label="More ${esc(lbl)}">+</button>`;
function setVal(key, v) { // set an entry, a shift or a day's bucket to exactly v hours
  const p = key.split(":"); v = Math.max(0, Math.min(24, +v || 0));
  if (p[0] === "e") { const L = S.logs[p[1]]; if (!L || !L.e[+p[2]]) return; if (v === 0) L.e.splice(+p[2], 1); else L.e[+p[2]].h = v; }
  if (p[0] === "m") { const m = S.moves.find(x => x.id === p[1]); if (!m) return; if (v === 0) S.moves = S.moves.filter(x => x !== m); else m.h = v; }
  if (p[0] === "d") { const d = p[1], k = p[2]; const Lg = S.logs[d] = S.logs[d] || { e: [] }; if (!Lg.hours) { Lg.hours = actualDay(d); Lg.e = []; } Lg.hours[k] = v; Lg.at = Date.now(); }
  save();
}
function curVal(key) { const p = key.split(":");
  if (p[0] === "e") { const L = S.logs[p[1]]; return L && L.e[+p[2]] ? L.e[+p[2]].h : 0; }
  if (p[0] === "m") { const m = S.moves.find(x => x.id === p[1]); return m ? m.h : 0; }
  if (p[0] === "d") return actualDay(p[1])[p[2]] || 0; return 0; }
const eraName = q => (S.eras[q] && S.eras[q].name) || "";

/* ---------- Render ---------- */
let detailsOpen = false;
function render() {
  const dt = document.querySelector("#view details"); if (dt) detailsOpen = dt.open;
  const y = window.scrollY;
  render0();
  const n = document.querySelector("#view details"); if (n && detailsOpen) n.open = true;
  if (n || tab === "today") window.scrollTo(0, y);
}
function render0() {
  document.querySelectorAll("#tabs button").forEach(b => b.setAttribute("aria-current", b.dataset.tab === tab ? "page" : "false"));
  if (!S.onboarded) { $("#tabs").hidden = true; $("#top").hidden = true; return renderOnb(); }
  $("#tabs").hidden = false; $("#top").hidden = false;
  const q = qKey(today()); $("#brand").innerHTML = APP + (eraName(q) ? `<small>${esc(eraName(q))}</small>` : "");
  ({ today: renderToday, week: renderWeek, era: renderEra })[tab]();
}

/* Today */
function renderToday() {
  const t = today(), q = qKey(t), yEnd = t.slice(0, 4) + "-12-31";
  const sunday = add(monday(t), 6);
  const freeLeft = free(range(t, sunday, plannedDay));
  const wq = weekendsLeft(qEnd(q)), wy = weekendsLeft(yEnd);
  const Lg = S.logs[t] || null;
  const o = actualDay(t);
  let h = `<h1>${DOWL[dow(t)]}</h1><p class="muted">${fmtShort(t)} · ${isOffice(t) ? "a usual office day" : "a free day"}</p>`;
  h += `<div class="card dark"><div class="stats"><div class="stat"><b>${Math.round(freeLeft)}</b><span>free hours left this week</span></div><div class="stat"><b>${wq}</b><span>weekends left this quarter</span></div><div class="stat"><b>${wy}</b><span>weekends left in ${t.slice(0, 4)}</span></div></div></div>`;
  // yesterday
  const y = add(t, -1);
  if (!S.logs[y] && S.onboardedAt && y >= S.onboardedAt) h += `<div class="card row"><span class="grow">Yesterday isn't logged.</span><button class="btn sm" data-act="usual-yday">Same as usual</button><button class="btn sm" data-act="open-yday">Log it</button></div>`;
  // goal end reflections
  S.goals.filter(g => !g.closed && g.end < t).forEach(g => { h += `<div class="card"><span class="tag blue">Make room ended</span><h3 style="margin-top:6px">${esc(g.title)}</h3><p class="small muted" style="margin-top:4px">You chose this because: “${esc(g.why || "you didn't write a reason")}”</p><div class="btns"><button class="btn sm" data-goalend="${g.id}|done">It happened</button><button class="btn sm" data-goalend="${g.id}|part">Partly</button><button class="btn sm" data-goalend="${g.id}|no">Not this time</button></div></div>`; });
  h += `<h2>${esc(L("today"))}</h2><p class="small muted" style="margin-top:-4px">Today so far: ${hh(free(o))} free · ${hh(o.phone)} ${esc(L("phone").toLowerCase())} · ${hh(o.sleep)} sleep</p>` + logCard(t, Lg, o);
  // plans due
  const open = S.plans.filter(p => p.status === "open" && (p.when === "week" ? p.week === monday(t) : p.q === q));
  if (open.length) h += `<h2>${esc(L("quests"))}</h2><div class="card">` + open.slice(0, 6).map(planRow).join("") + `</div>`;
  if (dow(t) === 0 || dow(t) === 6) h += `<div class="card row"><span class="grow"><b>${esc(L("week"))}</b><br><span class="small muted">3 minutes on how the week went</span></span><button class="btn sm primary" data-gotab="week">Open</button></div>`;
  $("#view").innerHTML = h;
}
function logCard(s, Lg, o) {
  const L = Lg; const e = (L && L.e) || [];
  let h = `<div class="card"><div class="small muted" style="margin-bottom:6px">${L ? (L.hours ? "Logged hour by hour" : e.length ? "Logged, with changes" : "Logged as a usual day") : "Your usual " + DOWL[dow(s)]}</div>${dayBar(o, "Today by hour")}`;
  h += `<div class="btns"><button class="btn ${L && !e.length ? "" : "primary"} grow" data-usual="${s}">${L && !e.length && !L.hours ? "Usual day ✓" : "Same as usual"}</button></div>`;
  h += `<div class="small" style="font-weight:600;margin:4px 0 6px">Or tap what was different</div><div class="chips">` +
    CHIPS.map((c, i) => `<button class="chip" data-chip="${s}|${i}">${esc(c.l)}</button>`).join("") +
    S.goals.filter(g => !g.closed && s >= g.start && s <= g.end).map(g => `<button class="chip" data-gchip="${s}|${g.id}">${esc(g.title)} · 1 h</button>`).join("") +
    `<button class="chip" data-act="custom-entry" data-day="${s}">Something else</button></div>`;
  if (L && L.tags && L.tags.length) h += `<p class="small" style="margin:8px 0 0">${L.tags.map(x => `<span class="tag good" style="margin:0 4px 4px 0">${esc(x)}</span>`).join("")}</p>`;
  if (e.length) h += `<div style="margin-top:8px">` + e.map((x, i) => `<div class="li"><span class="grow small">${dotFor(x.to)}<b>${esc(x.l || B[x.to].n)}</b><br><span class="muted">from ${esc(B[x.from].n.toLowerCase())}</span></span>${stepper("e:" + s + ":" + i, x.h, x.l || B[x.to].n)}<button class="icon-btn" data-rme="${s}|${i}" aria-label="Remove"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`).join("") + `</div>`;
  h += `<div class="btns"><button class="btn block" data-editday="${s}">Edit all 24 hours</button></div>`;
  h += `<label class="f" for="good-${s}">One good thing</label><input type="text" id="good-${s}" data-logf="${s}|good" value="${esc(L && L.good || "")}" placeholder="e.g. First run in weeks">`;
  h += `<label class="f" for="chg-${s}">One thing to change tomorrow</label><input type="text" id="chg-${s}" data-logf="${s}|change" value="${esc(L && L.change || "")}" placeholder="e.g. Phone in the hall after 10">`;
  h += `<label class="f">Energy</label><div class="seg" role="group">${[["low", "Drained"], ["okay", "Okay"], ["high", "Full of it"]].map(([k, n]) => `<button data-energy="${s}|${k}" aria-pressed="${L && L.energy === k}">${n}</button>`).join("")}</div></div>`;
  return h;
}
function planRow(p) {
  return `<div class="li"><span class="grow"><b>${esc(p.title)}</b><br><span class="tiny muted">${dotFor(p.corner)}${esc(SHORT[p.corner])} · ${p.when === "week" ? "this week" : p.when === "month" ? "this month" : "this quarter"}${p.moved ? " · moved " + p.moved + "×" : ""}</span></span><button class="btn sm" data-plan="${p.id}|done">Done</button><button class="btn sm" data-plan="${p.id}|moved">Move</button><button class="icon-btn" data-plan="${p.id}|dropped" aria-label="Drop ${esc(p.title)}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;
}

/* Week */
function renderWeek() {
  const t = today(); if (!weekOf) weekOf = monday(t);
  const end = add(weekOf, 6), last = end < t ? end : t, started = weekOf <= t;
  const act = started ? range(weekOf, last, actualDay) : zero(), plan = started ? range(weekOf, last, plannedDay) : range(weekOf, end, plannedDay);
  const full = range(weekOf, end, plannedDay);
  const logged = Object.keys(S.logs).filter(d => d >= weekOf && d <= end).length;
  const elapsed = started ? days(weekOf, last) : 0;
  let h = `<div class="row" style="margin-top:4px"><button class="icon-btn" data-week="-7" aria-label="Previous week"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><div class="grow" style="text-align:center;font-weight:700">${fmtShort(weekOf)} – ${fmtShort(end)}${weekOf === monday(t) ? " · this week" : ""}</div><button class="icon-btn" data-week="7" aria-label="Next week"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button></div>`;
  if (started) {
    h += `<div class="card">${pentagon([{ v: plan, dash: 1 }, { v: act }], 300, { label: "This week so far against the plan" })}${LEG("Plan", "Actual so far")}<p class="tiny muted" style="text-align:center;margin-top:6px">${elapsed} of 7 days · ${logged} logged · unlogged days count as usual</p></div>`;
    h += `<div class="card">` + FREE.map(k => { const a = act[k], p = plan[k]; const pct = Math.min(100, p ? a / p * 100 : (a ? 100 : 0)); const over = k === "phone" ? a > p + 0.5 : false; return `<div class="cmp"><span>${dotFor(k)}${SHORT[k]}</span><div class="bar"><i style="width:${pct}%;background:${k === "phone" ? "#D2452C" : (B[k].c)}"></i></div><span class="t" style="${over ? "color:var(--warn)" : ""}">${h1(a)} of ${h1(p)}</span></div>`; }).join("") + `</div>`;
  } else h += `<div class="card"><p class="muted">This week hasn't started. It's planned at ${hh(free(full))} of free time.</p>${pentagon([{ v: full }], 280)}</div>`;
  // retro
  const R = S.retros[weekOf] || {};
  const retroOpen = started && (end <= t || dow(t) === 0 || dow(t) >= 5 || R.at);
  if (retroOpen) {
    h += `<h2>${esc(L("week"))}</h2><div class="card"><label class="f" for="r-well" style="margin-top:0">What went well</label><input type="text" id="r-well" data-retro="well" value="${esc(R.well || "")}" placeholder="e.g. Ran three times">`;
    h += `<label class="f">What got in the way</label><div class="chips">${BLOCKERS.map(b => `<button class="chip" data-blocker="${esc(b)}" aria-pressed="${(R.blockers || []).includes(b)}">${esc(b)}</button>`).join("")}</div>`;
    h += `<label class="f" for="r-chg">One change for next week</label><input type="text" id="r-chg" data-retro="change" value="${esc(R.change || "")}" placeholder="e.g. Phone stays in the hall after 10 pm">`;
    const goods = Object.keys(S.logs).filter(d => d >= weekOf && d <= end && S.logs[d].good).map(d => `<li><b>${DOW[dow(d)]}</b> ${esc(S.logs[d].good)}</li>`);
    if (goods.length) h += `<div class="small" style="margin-top:12px;font-weight:600">Good things this week</div><ul class="small" style="margin:4px 0 0;padding-left:18px">${goods.join("")}</ul>`;
    h += `<div class="btns"><button class="btn primary block" data-act="save-retro">${R.at ? "Update retro" : "Save retro"}</button></div></div>`;
  } else if (started) h += `<div class="card"><span class="muted small">The ${esc(L("week").toLowerCase())} opens on Friday.</span></div>`;
  if (started) h += `<h2>Days</h2><div class="card">` + [...Array(7)].map((_, i) => add(weekOf, i)).filter(d => d <= t).map(d => { const g = S.logs[d]; const st = !g ? "not logged, counts as usual" : (g.e && g.e.length ? g.e.map(x => x.l || SHORT[x.to]).join(", ") : "usual day") + (g.good ? " · " + g.good : ""); return `<div class="li"><span class="grow"><b>${fmt(d)}</b><br><span class="tiny muted">${esc(st)}</span></span><button class="btn sm" data-logday="${d}">${g ? "Edit" : "Log"}</button></div>`; }).join("") + `</div>`;
  // next week's plans
  const nextMon = add(weekOf, 7);
  const wk = S.plans.filter(p => p.when === "week" && (p.week === weekOf || p.week === nextMon));
  h += `<h2>${esc(L("quests"))} this week</h2><div class="card">${wk.length ? wk.map(p => p.status === "open" ? planRow(p) : `<div class="li"><span class="grow">${esc(p.title)}</span><span class="tag ${p.status === "done" ? "good" : ""}">${p.status}</span></div>`).join("") : `<p class="muted small" style="margin:0">Nothing yet. Add 2 or 3 small things that move your shape.</p>`}<div class="btns"><button class="btn sm" data-act="add-plan" data-when="week">Add a plan</button></div></div>`;
  $("#view").innerHTML = h;
}

/* Era (quarter) */
function renderEra() {
  const t = today(), q = qKey(t), qs = qStart(q), qe = qEnd(q), pq = qPrev(q);
  const planQ = avgWeek(t < qs ? qs : t, qe, plannedDay);
  const lastFrom = S.onboardedAt && S.onboardedAt > qStart(pq) ? null : qStart(pq);
  const lastQ = avgWeek(qStart(pq), qEnd(pq), actualDay);
  const tmpl = templateWeek();
  const freeQ = free(range(t, qe, plannedDay));
  let h = `<h1>${esc(eraName(q) || "Name this era")}</h1><p class="small" style="margin:0 0 4px;font-weight:600">${esc(L("shape"))}</p><p class="muted">${qLabel(q)} · ${days(t, qe)} days, ${weekendsLeft(qe)} weekends and ${Math.round(freeQ)} free hours left</p>`;
  h += `<div class="row"><input type="text" data-eraname="${q}" value="${esc(eraName(q))}" placeholder="e.g. my fitness era, my exam era" aria-label="Name this era"></div>`;
  h += `<div class="card">${pentagon([{ v: lastFrom ? lastQ : tmpl, dash: 1 }, { v: planQ }], 300, { label: "Last quarter against this era's plan" })}${LEG(lastFrom ? "Last quarter" : "Your usual week", "This era's plan")}<p class="tiny muted" style="text-align:center;margin-top:6px">Hours a week in each area</p></div>`;
  // moves
  const mv = S.moves.filter(m => m.q === q);
  h += `<h2>${esc(L("shift"))}</h2><div class="card">${mv.length ? mv.map(m => `<div class="li"><span class="grow"><span style="color:var(--warn);font-weight:700">${SHORT[m.from]}</span> → <b>${SHORT[m.to]}</b><br><span class="tiny muted">${esc(m.note || "")}</span></span>${stepper("m:" + m.id, m.h, SHORT[m.to])}<button class="icon-btn" data-rmmove="${m.id}" aria-label="Remove move"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`).join("") : `<p class="muted small" style="margin:0">${esc(L("phone"))} takes ${hh(tmpl.phone)} a week, about ${Math.round(tmpl.phone * 52)} hours a year. Move a few to what matters.</p>`}<div class="btns"><button class="btn sm primary" data-act="move">${esc(L("shift"))}</button><button class="btn sm" data-act="makeroom">${esc(L("lockin"))}</button></div></div>`;
  // goals
  const gs = S.goals.filter(g => !g.closed || g.end >= qs);
  if (gs.length) h += `<h2>${esc(L("lockin"))}</h2><div class="card">` + gs.map(g => { const done = range(g.start, (t < g.end ? t : g.end), actualDay)[g.corner] - range(g.start, (t < g.end ? t : g.end), templateDay)[g.corner]; return `<div class="li"><span class="grow"><b>${esc(g.title)}</b><br><span class="tiny muted">${hh(goalPerWeek(g))} a week until ${fmtShort(g.end)} · from ${Object.keys(g.src).filter(k => g.src[k] > 0).map(k => SHORT[k].toLowerCase()).join(", ")}${g.closed ? " · " + ({ done: "it happened", part: "partly", no: "not this time" }[g.result] || "closed") : ""}</span><div class="bar" style="margin-top:6px"><i style="width:${Math.min(100, Math.max(0, done) / g.total * 100)}%;background:${B[g.corner].c}"></i></div><span class="tiny muted">${h1(Math.max(0, done))} of ${g.total} h logged</span></span>${g.closed ? "" : `<button class="icon-btn" data-rmgoal="${g.id}" aria-label="Remove goal"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`}</div>`; }).join("") + `</div>`;
  // plans
  const ps = S.plans.filter(p => p.q === q && p.when !== "week");
  const done = S.plans.filter(p => p.q === q && p.status === "done"), late = done.filter(p => p.moved);
  h += `<h2>${esc(L("quests"))}</h2><div class="card">${ps.length ? ps.map(p => p.status === "open" ? planRow(p) : `<div class="li"><span class="grow">${esc(p.title)}</span><span class="tag ${p.status === "done" ? "good" : ""}">${p.status}</span></div>`).join("") : `<p class="muted small" style="margin:0">Trips, courses, people to see. Things that make this era yours.</p>`}<div class="btns"><button class="btn sm" data-act="add-plan" data-when="quarter">Add a plan</button></div>${S.plans.some(p => p.q === q) ? `<p class="small" style="margin:8px 0 0"><b>${done.length} of ${S.plans.filter(p => p.q === q && p.status !== "dropped").length}</b> done${late.length ? `, ${late.length} of them late. Late still counts.` : "."}</p>` : ""}</div>`;
  // quarterly retro
  const E = S.eras[q] || {};
  const wks = []; for (let w = monday(qs); w <= t; w = add(w, 7)) wks.push(w);
  h += `<h2>Weeks this era</h2><div class="card">` + wks.reverse().map(w => { const r = S.retros[w]; const n = Object.keys(S.logs).filter(d => d >= w && d <= add(w, 6)).length; return `<div class="li"><span class="grow"><b>${fmtShort(w)} – ${fmtShort(add(w, 6))}</b><br><span class="tiny muted">${n} of 7 days logged · ${r && r.at ? esc(L("week").toLowerCase()) + " done" : "no " + esc(L("week").toLowerCase()) + " yet"}</span></span><button class="btn sm" data-openweek="${w}">${r && r.at ? "View" : "Do it"}</button></div>`; }).join("") + `</div>`;
  h += `<h2>${esc(eraName(q) ? "‘" + eraName(q) + "’ " + L("era") : "Era " + L("era"))}</h2><div class="card"><p class="small muted" style="margin-top:0">At the end of the era, look at the shape and say what you'd keep.</p><label class="f" for="e-keep">What I'd keep</label><input type="text" id="e-keep" data-erar="keep" value="${esc(E.keep || "")}"><label class="f" for="e-change">What I'd change next era</label><input type="text" id="e-change" data-erar="change" value="${esc(E.change || "")}"></div>`;
  // past eras
  const past = []; let pk = pq; for (let i = 0; i < 4; i++) { if (S.onboardedAt && qEnd(pk) < S.onboardedAt && i > 0) break; past.push(pk); pk = qPrev(pk); }
  h += `<h2>Past eras</h2><div class="card"><div class="minis">` + past.map(k => { const v = avgWeek(qStart(k), qEnd(k), actualDay); return `<div>${pentagon([{ v }], 130, { mini: 1, max: Math.max(8, ...CORNERS.map(c => tmpl[c])) * 1.4, label: qLabel(k) })}<b>${qLabel(k)}</b><br><span class="muted">${esc(eraName(k) || (S.onboardedAt && qEnd(k) < S.onboardedAt ? "estimated from your usual week" : ""))}</span></div>`; }).join("") + `</div></div>`;
  h += `<p class="foot">Coming next: money and energy shapes, the 1-year view, then 3, 5 and 10 year plans.</p>`;
  $("#view").innerHTML = h;
}

/* ---------- Onboarding ---------- */
let onb = 0;
function renderOnb() {
  const w = S.week, m = S.me;
  let h = `<div class="onb"><div class="row"><span class="brand">${APP}</span><div class="progress"><i style="width:${(onb + 1) / 3 * 100}%"></i></div><span class="small muted">${onb + 1} of 3</span></div>`;
  if (onb === 0) {
    h += `<h1 style="margin-top:18px">See where your week goes. Then choose.</h1><p class="muted">Describe a normal week once. ${APP} shows your free hours as a shape, helps you move them on purpose, and keeps you honest with 30-second daily retros.</p>
    <div class="two"><div><label class="f" for="o-age">Age</label><input type="number" id="o-age" value="${esc(m.age)}" placeholder="27"></div><div><label class="f" for="o-leave">Leave days a year</label><input type="number" id="o-leave" value="${esc(m.leave)}"></div></div>
    <label class="f">Energy most weeks</label><div class="seg" role="group">${[["low", "Drained"], ["okay", "Okay"], ["high", "Full of it"]].map(([k, n]) => `<button data-oe="${k}" aria-pressed="${m.energy === k}">${n}</button>`).join("")}</div>
    <label class="f">When you really want something, you usually…</label><div style="display:flex;flex-direction:column;gap:6px">${[["now", "want it now, all of it"], ["plan", "plan it, then do it"], ["later", "keep meaning to get to it"]].map(([k, n]) => `<button class="chip" style="text-align:left;min-height:46px" data-op="${k}" aria-pressed="${m.pace === k}">${n}</button>`).join("")}</div>
    <div class="btns" style="margin-top:20px"><button class="btn primary block" data-onb="1">Next: a normal day</button></div>
    <p class="tiny muted" style="text-align:center">Everything stays on this phone.</p>`;
  } else if (onb === 1) {
    h += `<h1 style="margin-top:18px">What does a normal day look like?</h1><p class="muted">Pick the closest, then adjust the hours.</p>
    <div class="chips">${Object.keys(PRESETS).map(k => `<button class="chip" data-preset="${k}" aria-pressed="${w.preset === k}">${PRESETS[k].n}</button>`).join("")}</div>
    <div class="card"><div class="row small" style="justify-content:space-between"><b>Workdays</b><span class="muted">${w.office.length} a week</span></div>${dayBar(Object.assign(zero(), w.wd))}<div class="row small" style="justify-content:space-between;margin-top:10px"><b>Other days</b><span class="muted">${7 - w.office.length} a week</span></div>${dayBar(Object.assign(zero(), w.we))}
    <label class="f">Workdays</label><div class="chips">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button class="chip" data-office="${d}" aria-pressed="${w.office.includes(d)}">${DOW[d]}</button>`).join("")}</div>
    <div class="btns"><button class="btn sm" data-act="edit-week">Adjust hours</button></div></div>
    <div class="btns"><button class="btn" data-onb="0">Back</button><button class="btn primary grow" data-onb="2">Next: your shape</button></div>`;
  } else {
    const tw = templateWeek();
    h += `<h1 style="margin-top:18px">Your ${Math.round(free(tw))} free hours a week</h1><p class="muted">Out of 168. Here's where they go.</p><div class="card">${pentagon([{ v: tw }], 300)}<div style="margin-top:8px">${FREE.map(k => `<div class="row small" style="padding:3px 0"><span class="grow">${dotFor(k)}${B[k].n}</span><b style="${k === "phone" ? "color:var(--warn)" : ""}">${hh(tw[k])}</b></div>`).join("")}</div></div>
    <label class="f" for="o-era">Name this era (this quarter)</label><input type="text" id="o-era" placeholder="e.g. my fitness era" value="${esc(eraName(qKey(today())))}">
    <div class="btns" style="margin-top:16px"><button class="btn" data-onb="1">Back</button><button class="btn primary grow" data-act="finish">Start</button></div>`;
  }
  $("#view").innerHTML = h + `</div>`;
}
function readOnb0() { const a = $("#o-age"), l = $("#o-leave"); if (a) S.me.age = a.value; if (l) S.me.leave = +l.value || 0; }

/* ---------- Sheets ---------- */
function sheet(title, html) {
  const el = document.createElement("div"); el.className = "sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", title);
  el.innerHTML = `<div class="in"><div class="grab"></div><div class="hd"><h2 tabindex="-1">${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="body">${html}</div></div>`;
  el.addEventListener("click", e => { if (e.target === el || e.target.closest("[data-close]")) el.remove(); });
  $("#sheets").appendChild(el); el.querySelector("h2").focus({ preventScroll: true });
  return el;
}
const closeSheets = () => $("#sheets").innerHTML = "";
document.addEventListener("keydown", e => { if (e.key === "Escape") { const s = document.querySelector(".sheet:last-child"); if (s) s.remove(); } });
const bucketOpts = (sel, list) => (list || ORDER).map(k => `<option value="${k}" ${k === sel ? "selected" : ""}>${B[k].n}</option>`).join("");

function weekEditor() {
  let mode = "wd";
  const body = () => { const d = S.week[mode], o = Object.assign(zero(), d), tot = sumDay(o);
    return `<div class="seg" role="group"><button data-wm="wd" aria-pressed="${mode === "wd"}">Workdays</button><button data-wm="we" aria-pressed="${mode === "we"}">Other days</button></div><div style="margin:12px 0">${dayBar(o)}</div><p class="small" style="font-weight:700;color:${Math.abs(tot - 24) < 0.01 ? "var(--good)" : "var(--warn)"}">${hh(tot)} of 24 h ${tot < 24 ? "· " + hh(24 - tot) + " to place" : tot > 24 ? "· " + hh(tot - 24) + " too many" : "✓"}</p><div class="card" style="padding:4px 14px">` +
      ORDER.map(k => `<div class="li"><span class="grow">${dotFor(k)}${B[k].n}</span>${stepper("w:" + mode + ":" + k, o[k], B[k].n)}</div>`).join("") + `</div><div class="btns"><button class="btn primary block" data-close>Done</button></div>`; };
  const el = sheet("Adjust a normal day", body());
  el.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.wm) { mode = b.dataset.wm; el.querySelector(".body").innerHTML = body(); }
    if (b.dataset.step && b.dataset.step.startsWith("w:")) { const [, md, k] = b.dataset.step.split("|")[0].split(":"); const dv = +b.dataset.step.split("|")[1]; S.week[md][k] = Math.max(0, (S.week[md][k] || 0) + dv); S.week.preset = "custom"; save(); el.querySelector(".body").innerHTML = body(); render(); }
  });
}
function moveSheet() {
  const q = qKey(today()); const tw = templateWeek();
  const el = sheet(L("shift"), `<p class="muted small">Take hours a week from one bucket and give them to another, for this era.</p>
    <label class="f" for="mv-from">From</label><select id="mv-from">${bucketOpts("phone", FREE.concat(["sleep", "chores"]))}</select>
    <label class="f" for="mv-to">To</label><select id="mv-to">${bucketOpts("health", FREE)}</select>
    <label class="f" for="mv-h">Hours a week</label><input type="number" id="mv-h" value="2" min="0.5" step="0.5">
    <label class="f" for="mv-note">How, in a few words</label><input type="text" id="mv-note" placeholder="e.g. Run Tue, Thu and Sat mornings">
    <p class="tiny muted" id="mv-info"></p><div class="btns"><button class="btn primary block" data-savemove>Move them</button></div>`);
  const info = () => { const f = el.querySelector("#mv-from").value, h = +el.querySelector("#mv-h").value || 0; el.querySelector("#mv-info").textContent = `${B[f].n} has ${hh(tw[f])} a week now. ${S.protect.includes(f) ? "It's protected; you can still move from it, on purpose." : ""} ${h ? Math.round(h * 13) + " hours over the era." : ""}`; };
  info(); el.addEventListener("input", info);
  el.querySelector("[data-savemove]").onclick = () => { const f = el.querySelector("#mv-from").value, to = el.querySelector("#mv-to").value, h = +el.querySelector("#mv-h").value || 0; if (f === to || h <= 0) { toast("Pick two different buckets"); return; } S.moves.push({ id: uid(), q, from: f, to, h, note: el.querySelector("#mv-note").value.trim() }); save(); el.remove(); render(); toast("Shifted " + hh(h) + " a week to " + SHORT[to]); };
}
function makeRoomSheet() {
  const t = today(); const tw = templateWeek();
  const g = { title: "", corner: "learn", total: 30, start: t, end: add(t, 27), src: {}, why: "" };
  const body = () => { const wks = goalWeeks(g), per = g.total / wks; const got = Object.values(g.src).reduce((a, b) => a + b, 0);
    const chosen = Object.keys(g.src).filter(k => g.src[k] > 0);
    return `<label class="f" for="g-title" style="margin-top:0">What needs the hours</label><input type="text" id="g-title" value="${esc(g.title)}" placeholder="e.g. Study for my exam">
    <div class="two"><div><label class="f" for="g-total">Hours in total</label><input type="number" id="g-total" value="${g.total}" min="1"></div><div><label class="f" for="g-end">By</label><input type="date" id="g-end" value="${g.end}" min="${add(t, 6)}"></div></div>
    <label class="f" for="g-corner">It counts as</label><select id="g-corner">${bucketOpts(g.corner, CORNERS)}</select>
    <div class="card dark" style="margin-top:14px"><b style="font-size:18px">${hh(per)} a week for ${wks} week${wks > 1 ? "s" : ""}</b><div class="small" style="opacity:.8">Your week is full, so they come from somewhere. You choose where.</div></div>
    <div class="card" style="padding:4px 14px">` + FREE.filter(k => k !== g.corner).map(k => S.protect.includes(k) ? `<div class="li"><span class="grow">${dotFor(k)}${B[k].n}<br><span class="tiny" style="color:var(--good);font-weight:600">${esc(L("protect").replace(/s$/, ""))}</span></span><span class="muted small">0 h</span></div>` : `<div class="li"><span class="grow">${dotFor(k)}${B[k].n}<br><span class="tiny muted">${hh(tw[k])} a week now</span></span>${stepper("g:" + k, g.src[k] || 0, B[k].n)}</div>`).join("") + `</div>
    <div class="row"><div class="bar grow"><i style="width:${Math.min(100, got / per * 100)}%;background:${got >= per - 0.01 ? "var(--good)" : "var(--accent)"}"></i></div><b>${h1(got)} of ${h1(per)} h</b></div>
    ${chosen.length ? `<div class="card"><b>What you're choosing</b><p class="small" style="margin:4px 0 0">${chosen.map(k => hh(g.src[k]) + " a week less " + B[k].n.toLowerCase()).join(", ")}, for ${wks} weeks. Back to normal on ${fmtShort(add(g.end, 1))}.</p></div>` : ""}
    <label class="f" for="g-why">Why it's worth it</label><input type="text" id="g-why" value="${esc(g.why)}" placeholder="e.g. Passing this gets me the analyst role">
    <p class="tiny muted">You'll see this line again on ${fmtShort(add(g.end, 1))}, whatever happens.</p>
    <div class="btns"><button class="btn primary block" data-savegoal ${got >= per - 0.01 ? "" : "disabled style=\"opacity:.5\""}>Make room for ${wks} week${wks > 1 ? "s" : ""}</button></div>`; };
  const el = sheet(L("lockin"), body());
  const sync = () => { g.title = el.querySelector("#g-title").value; g.total = Math.max(1, +el.querySelector("#g-total").value || 1); g.end = el.querySelector("#g-end").value || g.end; const c = el.querySelector("#g-corner").value; if (c !== g.corner) { delete g.src[c]; g.corner = c; } g.why = el.querySelector("#g-why").value; };
  const rerender = (focusId) => { const pos = focusId && el.querySelector("#" + focusId) ? el.querySelector("#" + focusId).selectionStart : null; el.querySelector(".body").innerHTML = body(); if (focusId) { const f = el.querySelector("#" + focusId); if (f) { f.focus(); try { if (pos != null) f.setSelectionRange(pos, pos); } catch (e) {} } } };
  el.addEventListener("change", e => { if (["g-total", "g-end", "g-corner"].includes(e.target.id)) { sync(); rerender(); } });
  el.addEventListener("input", e => { if (e.target.id === "g-title" || e.target.id === "g-why") sync(); });
  el.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.step && b.dataset.step.startsWith("g:")) { sync(); const k = b.dataset.step.split("|")[0].slice(2), dv = +b.dataset.step.split("|")[1]; g.src[k] = Math.max(0, Math.min(tw[k], (g.src[k] || 0) + dv)); rerender(); }
    if (b.hasAttribute("data-savegoal")) { sync(); if (!g.title.trim()) { toast("Name the goal first"); return; } S.goals.push(Object.assign({ id: uid() }, g, { title: g.title.trim() })); save(); el.remove(); render(); toast("Room made for " + g.title.trim()); }
  });
}
function planSheet(when) {
  const t = today();
  const el = sheet("Add to " + L("quests").toLowerCase(), `<label class="f" for="p-title" style="margin-top:0">What</label><input type="text" id="p-title" placeholder="e.g. Trek to Rajmachi, dinner with Rohan">
    <label class="f" for="p-corner">Area</label><select id="p-corner">${bucketOpts("travel", CORNERS)}</select>
    <label class="f">When</label><div class="seg" role="group">${[["week", "This week"], ["next", "Next week"], ["month", "This month"], ["quarter", "This era"]].map(([k, n]) => `<button data-pw="${k}" aria-pressed="${k === (when || "week")}">${n}</button>`).join("")}</div>
    <div class="btns"><button class="btn primary block" data-saveplan>Add</button></div>`);
  let w = when || "week";
  el.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.pw) { w = b.dataset.pw; el.querySelectorAll("[data-pw]").forEach(x => x.setAttribute("aria-pressed", x === b)); }
    if (b.hasAttribute("data-saveplan")) { const title = el.querySelector("#p-title").value.trim(); if (!title) { toast("Write what the plan is"); return; }
      const wk = w === "next" ? add(monday(t), 7) : monday(t);
      S.plans.push({ id: uid(), title, corner: el.querySelector("#p-corner").value, when: w === "next" ? "week" : w, week: (w === "week" || w === "next") ? wk : null, month: t.slice(0, 7), q: qKey(w === "next" ? wk : t), status: "open", moved: 0, created: t }); save(); el.remove(); render(); }
  });
}
function customEntry(day) {
  const el = sheet("Something else", `<label class="f" for="c-to" style="margin-top:0">Time went to</label><select id="c-to">${bucketOpts("learn")}</select>
    <label class="f" for="c-from">Instead of</label><select id="c-from">${bucketOpts("phone")}</select>
    <label class="f" for="c-h">Hours</label><input type="number" id="c-h" value="1" min="0.5" step="0.5">
    <label class="f" for="c-l">Label (optional)</label><input type="text" id="c-l" placeholder="e.g. Guitar class">
    <div class="btns"><button class="btn primary block" data-savecustom>Add</button></div>`);
  el.querySelector("[data-savecustom]").onclick = () => { const to = el.querySelector("#c-to").value, from = el.querySelector("#c-from").value, h = +el.querySelector("#c-h").value || 0; if (to === from || h <= 0) { toast("Pick two different buckets"); return; } addEntry(day, { to, from, h, l: el.querySelector("#c-l").value.trim() }); el.remove(); };
}
function addEntry(day, x) { const L = S.logs[day] = S.logs[day] || { e: [] }; L.e = L.e || []; const same = L.e.find(y => y.to === x.to && y.from === x.from && (y.l || "") === (x.l || "")); if (same) same.h += x.h; else L.e.push(x); L.at = Date.now(); save(); render(); }

function settingsSheet() {
  const m = S.me, r = S.remind;
  const native = !!(window.EraNative && window.EraNative.schedule);
  const el = sheet("Settings", `
    <h2 style="margin-top:4px">Your normal week</h2>
    <div class="card">${dayBar(Object.assign(zero(), S.week.wd), "Workday")}<div style="height:8px"></div>${dayBar(Object.assign(zero(), S.week.we), "Other day")}
    <label class="f">Workdays</label><div class="chips">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button class="chip" data-office="${d}" aria-pressed="${S.week.office.includes(d)}">${DOW[d]}</button>`).join("")}</div>
    <div class="btns"><button class="btn sm" data-act="edit-week">Adjust hours</button></div></div>
    <h2>${esc(L("protect"))}</h2><p class="small muted">${esc(L("lockin"))} won't take from these.</p><div class="chips">${FREE.concat(["sleep"]).map(k => `<button class="chip" data-protect="${k}" aria-pressed="${S.protect.includes(k)}">${SHORT[k]}</button>`).join("")}</div>
    <h2>About you</h2><div class="two"><div><label class="f" for="s-age">Age</label><input type="number" id="s-age" value="${esc(m.age)}"></div><div><label class="f" for="s-leave">Leave days a year</label><input type="number" id="s-leave" value="${esc(m.leave)}"></div></div>
    <h2>Reminders</h2><div class="two"><div><label class="f" for="s-daily">Daily retro at</label><input type="time" id="s-daily" value="${r.daily}"></div><div><label class="f" for="s-weekly">Weekly retro, Sunday</label><input type="time" id="s-weekly" value="${r.weekly}"></div></div>
    ${native ? `<label class="check" style="margin-top:8px"><input type="checkbox" id="s-on" ${r.on ? "checked" : ""}>Notifications on this phone</label>` : `<p class="small muted">Add them to your calendar so they ring on any phone.</p><div class="btns"><button class="btn sm" data-act="ics">Add to calendar</button><a class="btn sm" id="g-d" target="_blank" rel="noopener">Google Calendar: daily</a><a class="btn sm" id="g-w" target="_blank" rel="noopener">Google Calendar: weekly</a></div>`}
    <h2>Names</h2><p class="small muted">Call things what you like.</p>${Object.keys(LABELS).map(k => `<label class="f" for="lbl-${k}">${esc(LABELS[k][1])}</label><input type="text" id="lbl-${k}" data-label="${k}" value="${esc(L(k))}">`).join("")}
    <h2>Share and back up</h2><div class="btns"><button class="btn sm" data-act="share-app">Share ${APP} with friends</button><button class="btn sm" data-act="export">Save a backup</button><button class="btn sm" data-act="import">Load a backup</button></div><input type="file" id="s-file" accept=".json,application/json" hidden>
    <div class="btns"><button class="btn sm warn" data-act="reset">Start over</button></div>
    <p class="foot">${APP} v0.1 · everything stays on this phone.</p>`);
  const links = () => { const a = el.querySelector("#g-d"), b = el.querySelector("#g-w"); if (a) a.href = gcal(APP + ": daily retro", nextAt(S.remind.daily), "RRULE:FREQ=DAILY"); if (b) b.href = gcal(APP + ": weekly retro", nextAt(S.remind.weekly, 0), "RRULE:FREQ=WEEKLY"); };
  links();
  el.addEventListener("change", e => { const t = e.target;
    if (t.id === "s-age") S.me.age = t.value; if (t.id === "s-leave") S.me.leave = +t.value || 0;
    if (t.id === "s-daily") S.remind.daily = t.value || "21:30"; if (t.id === "s-weekly") S.remind.weekly = t.value || "19:00";
    if (t.id === "s-on") S.remind.on = t.checked;
    if (t.dataset.label) { S.labels = S.labels || {}; const v = t.value.trim(); if (v) S.labels[t.dataset.label] = v; else delete S.labels[t.dataset.label]; render(); }
    if (t.id === "s-file") { const f = t.files[0]; if (f) f.text().then(txt => { try { const o = JSON.parse(txt); if (!o.week || !o.logs) throw 0; S = Object.assign(defaults(), o); save(); closeSheets(); render(); toast("Backup loaded"); } catch (er) { toast("That isn't an " + APP + " backup"); } }); }
    save(); links(); scheduleNative();
  });
  el.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.protect) { const k = b.dataset.protect, i = S.protect.indexOf(k); if (i >= 0) S.protect.splice(i, 1); else S.protect.push(k); b.setAttribute("aria-pressed", i < 0); save(); }
    if (b.dataset.act === "import") el.querySelector("#s-file").click();
  });
}

function dayEditor(d) {
  const row = k => `<div style="padding:8px 0;border-bottom:1px solid var(--line)" data-row="${k}"><div class="row"><span class="grow">${dotFor(k)}<b>${esc(k === "phone" ? L("phone") : B[k].n)}</b></span><button class="step" data-dh="${k}|-0.5" aria-label="Less ${esc(B[k].n)}">−</button><input class="valin" type="number" inputmode="decimal" min="0" max="24" step="0.5" data-dv="${k}" aria-label="${esc(B[k].n)} hours"><button class="step" data-dh="${k}|0.5" aria-label="More ${esc(B[k].n)}">+</button></div><input type="range" min="0" max="16" step="0.5" data-dr="${k}" aria-label="${esc(B[k].n)}" style="width:100%;margin-top:6px;accent-color:${B[k].c === "stripe" ? "#D2452C" : B[k].c === "#DDE0EA" || B[k].c === "#E3E6EE" || B[k].c === "#C9CEDC" ? "#8E95AB" : B[k].c}"></div>`;
  const el = sheet(fmt(d), `<div style="position:sticky;top:44px;z-index:2;background:var(--bg);padding:4px 0 6px"><div id="de-bar"></div><p class="small" id="de-tot" style="font-weight:700;margin:8px 0 0"></p></div><p class="tiny muted" style="margin:0 0 6px">Raise an area and the hours come from “Not sure”, then ${esc(L("phone").toLowerCase())}, then rest. Lower one and they go to “Not sure”.</p>
    <div class="card" style="padding:2px 14px"><div class="tiny muted" style="padding-top:8px;font-weight:700">Fixed</div>${["sleep", "work", "commute", "chores"].map(row).join("")}<div class="tiny muted" style="padding-top:10px;font-weight:700">Free time</div>${["family", "people", "health", "learn", "travel", "rest", "phone"].map(row).join("")}${row("other")}</div>
    <label class="f" for="de-good">One good thing</label><input type="text" id="de-good" data-logf="${d}|good" value="${esc((S.logs[d] || {}).good || "")}">
    <label class="f" for="de-chg">One thing to change</label><input type="text" id="de-chg" data-logf="${d}|change" value="${esc((S.logs[d] || {}).change || "")}">
    <div class="btns"><button class="btn" data-dereset>Reset to usual</button><button class="btn primary grow" data-close>Done</button></div>`);
  const paint = () => { const o = dayHours(d);
    el.querySelector("#de-bar").innerHTML = dayBar(o, "This day by hour");
    el.querySelector("#de-tot").innerHTML = `24 h placed ✓ <span class="muted" style="font-weight:400">· ${hh(free(o))} free · ${hh(o.other)} not sure</span>`;
    ORDER.forEach(k => { const r = el.querySelector(`[data-row="${k}"]`); if (!r) return; const vi = r.querySelector("[data-dv]"), ri = r.querySelector("[data-dr]"); if (document.activeElement !== vi) vi.value = h1(o[k]); if (document.activeElement !== ri) ri.value = o[k]; if (k === "other") r.style.display = o.other > 0 ? "" : "none"; }); };
  paint();
  el.addEventListener("input", e => { const k = e.target.dataset.dr; if (k) { setHour(d, k, +e.target.value); paint(); } });
  el.addEventListener("change", e => { const k = e.target.dataset.dv || e.target.dataset.dr; if (k) { setHour(d, k, +e.target.value); paint(); render(); } });
  el.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.dh) { const [k, dv] = b.dataset.dh.split("|"); setHour(d, k, dayHours(d)[k] + +dv); paint(); render(); }
    if (b.hasAttribute("data-dereset")) { const Lg = S.logs[d] = S.logs[d] || {}; Lg.hours = null; Lg.e = []; Lg.tags = []; Lg.at = Date.now(); save(); paint(); render(); }
  });
  el.addEventListener("click", e => { if (e.target === el || e.target.closest("[data-close]")) render(); });
}
function daySheet(d) { const el = sheet(fmt(d), logCard(d, S.logs[d], actualDay(d))); const re = () => { if (!el.isConnected) return; const dt = el.querySelector("details"), open = dt && dt.open, y = el.querySelector(".in").scrollTop; el.querySelector(".body").innerHTML = logCard(d, S.logs[d], actualDay(d)); const n = el.querySelector("details"); if (n && open) n.open = true; el.querySelector(".in").scrollTop = y; }; el.addEventListener("click", e => { if (e.target.closest("button")) setTimeout(re, 0); }); el.addEventListener("refresh", () => setTimeout(re, 0)); }

/* ---------- Calendar and native reminders ---------- */
function nextAt(hm, dowWanted) { const [H, M] = hm.split(":").map(Number); const d = new Date(); d.setHours(H, M, 0, 0); if (dowWanted !== undefined) { while (d.getDay() !== dowWanted || d < new Date()) d.setDate(d.getDate() + 1); } else if (d < new Date()) d.setDate(d.getDate() + 1); return d; }
const icsDate = d => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "T" + pad(d.getHours()) + pad(d.getMinutes()) + "00";
function gcal(title, start, rr) { const end = new Date(start.getTime() + 10 * 6e4); const u = new URL("https://calendar.google.com/calendar/render"); u.searchParams.set("action", "TEMPLATE"); u.searchParams.set("text", title); u.searchParams.set("dates", icsDate(start) + "/" + icsDate(end)); u.searchParams.set("details", "Open " + APP + ": " + location.origin + location.pathname); u.searchParams.set("recur", rr); return u.toString(); }
function ics() {
  const ev = (id, title, start, rr) => ["BEGIN:VEVENT", "UID:" + id + "@era", "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, ""), "DTSTART:" + icsDate(start), "DTEND:" + icsDate(new Date(start.getTime() + 6e5)), "SUMMARY:" + title, rr, "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + title, "TRIGGER:PT0M", "END:VALARM", "END:VEVENT"].join("\r\n");
  const txt = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Era//EN", ev("daily", APP + ": daily retro", nextAt(S.remind.daily), "RRULE:FREQ=DAILY"), ev("weekly", APP + ": weekly retro", nextAt(S.remind.weekly, 0), "RRULE:FREQ=WEEKLY"), "END:VCALENDAR"].join("\r\n");
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) { location.href = "data:text/calendar;charset=utf-8," + encodeURIComponent(txt); return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/calendar" })); a.download = "era-reminders.ics"; document.body.appendChild(a); a.click(); a.remove(); toast("Open the file to add it to your calendar");
}
function scheduleNative() { try { if (window.EraNative && window.EraNative.schedule) window.EraNative.schedule(JSON.stringify({ on: S.remind.on, daily: S.remind.daily, weekly: S.remind.weekly, weeklyDow: 0, app: APP })); } catch (e) {} }

/* ---------- Events ---------- */
document.addEventListener("click", e => {
  const b = e.target.closest("button,a[data-act]"); if (!b) return;
  if (b.dataset.tab) { tab = b.dataset.tab; closeSheets(); render(); window.scrollTo(0, 0); return; }
  if (b.dataset.gotab) { tab = b.dataset.gotab; render(); window.scrollTo(0, 0); return; }
  if (b.id === "btnSettings") return settingsSheet();
  if (b.dataset.usual) { const d = b.dataset.usual; S.logs[d] = Object.assign(S.logs[d] || {}, { e: [], hours: null, tags: [], at: Date.now() }); save(); render(); toast("Logged as a usual day"); return; }
  if (b.dataset.chip) { const [d, i] = b.dataset.chip.split("|"); const c = CHIPS[+i]; setHour(d, c.to, dayHours(d)[c.to] + c.h, c.from); const Lg = S.logs[d]; Lg.tags = (Lg.tags || []).concat(c.l); save(); render(); toast("+" + hh(c.h) + " " + SHORT[c.to].toLowerCase()); return; }
  if (b.dataset.gchip) { const [d, id] = b.dataset.gchip.split("|"); const g = S.goals.find(x => x.id === id); const from = Object.keys(g.src).sort((a, c) => g.src[c] - g.src[a])[0] || "phone"; setHour(d, g.corner, dayHours(d)[g.corner] + 1, from); const Lg = S.logs[d]; Lg.tags = (Lg.tags || []).concat(g.title); save(); render(); return; }
  if (b.dataset.editday) return dayEditor(b.dataset.editday);
  if (b.dataset.rme) { const [d, i] = b.dataset.rme.split("|"); S.logs[d].e.splice(+i, 1); save(); render(); return; }
  if (b.dataset.step && /^[emd]:/.test(b.dataset.step)) { const [key, dv] = b.dataset.step.split("|"); setVal(key, curVal(key) + +dv); render(); return; }
  if (b.dataset.energy) { const [d, k] = b.dataset.energy.split("|"); S.logs[d] = S.logs[d] || { e: [] }; S.logs[d].energy = k; save(); render(); return; }
  if (b.dataset.plan) { const [id, st] = b.dataset.plan.split("|"); const p = S.plans.find(x => x.id === id);
    if (st === "moved") { p.moved = (p.moved || 0) + 1; if (p.when === "week") p.week = add(p.week, 7); else if (p.when === "month") p.when = "quarter"; else p.q = qKey(add(qEnd(p.q), 1)); toast("Moved. It keeps its place in line."); }
    else { p.status = st; p.doneAt = today(); if (st === "done") toast(p.moved ? "Done, a bit late. Late still counts." : "Done"); }
    save(); render(); return; }
  if (b.dataset.balance) { const d = b.dataset.balance; const o = actualDay(d), gap = 24 - sumDay(o); if (gap > 0) setVal("d:" + d + ":rest", o.rest + gap); else { let need = -gap; for (const k of ["rest", "phone", "travel", "learn", "people", "family", "health", "chores", "sleep"]) { const cur = actualDay(d)[k], t = Math.min(cur, need); if (t > 0) { setVal("d:" + d + ":" + k, cur - t); need -= t; } if (need <= 0) break; } } render(); return; }
  if (b.dataset.logday) return dayEditor(b.dataset.logday);
  if (b.dataset.openweek) { weekOf = b.dataset.openweek; tab = "week"; render(); window.scrollTo(0, 0); return; }
  if (b.dataset.week) { weekOf = add(weekOf, +b.dataset.week); render(); return; }
  if (b.dataset.blocker) { const R = S.retros[weekOf] = S.retros[weekOf] || {}; R.blockers = R.blockers || []; const i = R.blockers.indexOf(b.dataset.blocker); if (i >= 0) R.blockers.splice(i, 1); else R.blockers.push(b.dataset.blocker); b.setAttribute("aria-pressed", i < 0); save(); return; }
  if (b.dataset.rmmove) { S.moves = S.moves.filter(m => m.id !== b.dataset.rmmove); save(); render(); return; }
  if (b.dataset.rmgoal) { S.goals = S.goals.filter(g => g.id !== b.dataset.rmgoal); save(); render(); return; }
  if (b.dataset.goalend) { const [id, r] = b.dataset.goalend.split("|"); const g = S.goals.find(x => x.id === id); g.closed = true; g.result = r; save(); render(); toast(r === "no" ? "Not this time. You chose it for a reason; that still stands." : "Noted. A choice you made on purpose."); return; }
  // onboarding
  if (b.dataset.oe) { readOnb0(); S.me.energy = b.dataset.oe; render(); return; }
  if (b.dataset.op) { readOnb0(); S.me.pace = b.dataset.op; render(); return; }
  if (b.dataset.preset) { const p = PRESETS[b.dataset.preset]; S.week.preset = b.dataset.preset; S.week.wd = Object.assign({}, p.wd); S.week.we = Object.assign({}, p.we); save(); render(); return; }
  if (b.dataset.office) { const d = +b.dataset.office, i = S.week.office.indexOf(d); if (i >= 0) S.week.office.splice(i, 1); else S.week.office.push(d); save(); render(); if (b.closest(".sheet")) b.setAttribute("aria-pressed", i < 0); return; }
  if (b.dataset.onb) { if (onb === 0) readOnb0(); onb = +b.dataset.onb; render(); window.scrollTo(0, 0); return; }
  const a = b.dataset.act; if (!a) return;
  if (a === "finish") { const n = $("#o-era").value.trim(); const q = qKey(today()); S.eras[q] = Object.assign(S.eras[q] || {}, { name: n }); S.onboarded = true; S.onboardedAt = today(); save(); scheduleNative(); tab = "today"; render(); toast("Welcome to your era"); return; }
  if (a === "edit-week") return weekEditor();
  if (a === "move") return moveSheet();
  if (a === "makeroom") return makeRoomSheet();
  if (a === "add-plan") return planSheet(b.dataset.when);
  if (a === "custom-entry") return customEntry(b.dataset.day);
  if (a === "usual-yday") { const y = add(today(), -1); S.logs[y] = { e: [], at: Date.now() }; save(); render(); return; }
  if (a === "open-yday") return dayEditor(add(today(), -1));
  if (a === "save-retro") { const R = S.retros[weekOf] = S.retros[weekOf] || {}; R.well = $("#r-well").value.trim(); R.change = $("#r-chg").value.trim(); R.at = Date.now(); save(); render(); toast("Retro saved. Add next week's plans below."); return; }
  if (a === "ics") return ics();
  if (a === "share-app") { const url = location.protocol.startsWith("http") ? location.origin + location.pathname : "https://rj8228.github.io/era/"; const text = APP + ": see where your week goes and spend it on purpose. " + url; if (window.EraNative && window.EraNative.share) window.EraNative.share(text); else if (navigator.share) navigator.share({ text }).catch(() => {}); else window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank"); return; }
  if (a === "export") { if (window.EraNative && window.EraNative.saveFile) { window.EraNative.saveFile("era-backup-" + today() + ".json", JSON.stringify(S)); return; } const blob = new Blob([JSON.stringify(S)], { type: "application/json" }); const u = URL.createObjectURL(blob); const l = document.createElement("a"); l.href = u; l.download = "era-backup-" + today() + ".json"; document.body.appendChild(l); l.click(); l.remove(); return; }
  if (a === "reset") { const el = sheet("Start over", `<p>This deletes your week, logs, plans and eras from this phone. Save a backup first if you might want them.</p><div class="btns"><button class="btn warn" data-yes>Delete everything</button><button class="btn" data-close>Cancel</button></div>`); el.querySelector("[data-yes]").onclick = () => { S = defaults(); save(); onb = 0; closeSheets(); render(); }; return; }
});
document.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.setval) { setVal(t.dataset.setval, t.value); render(); const sh = t.closest(".sheet"); if (sh) sh.dispatchEvent(new Event("refresh")); return; }
  if (t.dataset.logf) { const [d, f] = t.dataset.logf.split("|"); S.logs[d] = S.logs[d] || { e: [] }; S.logs[d][f] = t.value.trim(); S.logs[d].at = S.logs[d].at || Date.now(); save(); }
  if (t.dataset.eraname) { const q = t.dataset.eraname; S.eras[q] = Object.assign(S.eras[q] || {}, { name: t.value.trim() }); save(); render(); }
  if (t.dataset.erar) { const q = qKey(today()); S.eras[q] = Object.assign(S.eras[q] || {}, { [t.dataset.erar]: t.value.trim() }); save(); }
  if (t.dataset.retro) { const R = S.retros[weekOf] = S.retros[weekOf] || {}; R[t.dataset.retro] = t.value.trim(); save(); }
});

/* ---------- Boot ---------- */
render();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
window.__era = { S: () => S, actualDay, plannedDay, templateWeek, range, avgWeek };
})();
