"use strict";
/* Era app: navigation, sheets, actions, gestures (dial, swipe, paint, beads) and the Android bridge. */

const $ = s => document.querySelector(s);
const clone = x => JSON.parse(JSON.stringify(x));
function toast(m) { document.querySelectorAll(".toast").forEach(x => x.remove()); const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }

/* ---------- Navigation ----------
   NAV is a stack; its first page is the tab. Pages that hold unsaved work ask before you leave them. */
let NAV = [];
let prevOpen = S.lastOpen;
const SETUP = new Set(["intro", "s_areas", "s_less", "s_push", "s_map", "s_paint", "s_st", "s_shape"]);
const TABS = ["today", "week", "era", "me"];
const FULL = new Set(["fill", "swipe", "dial", "lock1", "lock2", "lock3", "decide1", "decide2", "receipt", "vibe", "nextweek", "catchup"]);
const FLOWS = [
  { pages: ["fill", "swipe", "dial"], dirty: () => draft && draft.dirty, title: "Save this day?", body: () => "You changed " + (draft ? fmtD(draft.d) : "this day") + ".", save: () => commitDraft(), drop: () => { draft = null; } },
  { pages: ["beads"], dirty: () => beadDraft && beadDraft.length, title: "Save this change?", body: () => beadDraft.map(m => cname(m.from) + " → " + cname(m.to)).join(", ") + ".", save: () => saveBeads(), drop: () => { beadDraft = null; beadSel = null; beadNote = ""; } },
  { pages: ["lock1", "lock2", "lock3"], dirty: () => goalDraft && (goalDraft.title || Object.keys(goalDraft.src).length), title: "Leave this lock-in?", body: () => "It isn't saved yet.", save: null, drop: () => { goalDraft = null; } }
];
const top_ = () => NAV[NAV.length - 1] || {};
function render(keepScroll) {
  if (!S.onboarded) { if (!NAV.length || !SETUP.has(top_().p)) NAV = [{ p: "intro" }]; }
  else if (!NAV.length || SETUP.has(NAV[0].p)) NAV = [{ p: "today" }];
  const c = top_(); const y = window.scrollY;
  let html; try { html = P[c.p](c); } catch (e) { console.error(e); html = `<h1>Something went wrong</h1><p class="muted">${esc(e.message)}</p>${btn("Back to today", "tab", "today", "primary block")}`; }
  $("#view").innerHTML = html;
  const root = TABS.includes(c.p);
  $("#tabs").hidden = !S.onboarded || FULL.has(c.p);
  $("#top").hidden = !S.onboarded || !root;
  document.body.classList.toggle("flow", FULL.has(c.p));
  if (S.onboarded) { const q = curQ(); $("#brand").innerHTML = APPNAME + (eraName(q) ? `<small>${esc(eraName(q))}</small>` : ""); }
  document.querySelectorAll("#tabs button").forEach(b => b.setAttribute("aria-current", b.dataset.tab === NAV[0].p ? "page" : "false"));
  if (AFTER[c.p]) AFTER[c.p](c);
  if (keepScroll) window.scrollTo(0, y);
}
const rerender = () => render(true);
function setNav(next) {
  const leaving = NAV.map(x => x.p), staying = next.map(x => x.p);
  const f = FLOWS.find(fl => fl.dirty() && leaving.some(p => fl.pages.includes(p)) && !staying.some(p => fl.pages.includes(p)));
  if (f) return confirmSheet(f.title, f.body(), f.save ? "Save" : null, () => { f.save(); NAV = next; render(); window.scrollTo(0, 0); }, () => { f.drop(); NAV = next; render(); window.scrollTo(0, 0); });
  NAV = next; render(); window.scrollTo(0, 0);
}
const go = (p, a) => setNav(NAV.concat([Object.assign({ p }, a || {})]));
const back = () => setNav(NAV.length > 1 ? NAV.slice(0, -1) : NAV);
const home = () => setNav([NAV[0]]);
const tabTo = t => setNav([{ p: t }]);
window.eraBack = () => {
  const s = document.querySelector(".sheet:last-child"); if (s) { closeSheet(s); return "closed"; }
  if (NAV.length > 1) { back(); return "closed"; }
  if (S.onboarded && NAV[0].p !== "today") { tabTo("today"); return "closed"; }
  return "none";
};

/* ---------- Sheets ---------- */
function sheet(title, html, onClose) {
  const el = document.createElement("div"); el.className = "sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", title);
  el.innerHTML = `<div class="in"><div class="grab"></div><div class="hd"><h2 tabindex="-1">${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">✕</button></div><div class="body">${html}</div></div>`;
  el.onClose = onClose;
  el.addEventListener("click", e => { if (e.target === el || e.target.closest("[data-close]")) closeSheet(el); });
  $("#sheets").appendChild(el); el.querySelector("h2").focus({ preventScroll: true });
  return el;
}
function closeSheet(el) { if (!el.isConnected) return; el.remove(); if (el.onClose) el.onClose(); }
const closeSheets = () => { document.querySelectorAll(".sheet").forEach(s => s.remove()); };
document.addEventListener("keydown", e => { if (e.key === "Escape") { const s = document.querySelector(".sheet:last-child"); if (s) closeSheet(s); } });
function confirmSheet(title, body, saveTxt, onSave, onDrop, dropTxt) {
  const el = sheet(title, `<p>${esc(body)}</p><div class="btns col">${saveTxt ? `<button class="btn primary block" data-yes>${esc(saveTxt)}</button>` : ""}<button class="btn block ${saveTxt ? "" : "warn"}" data-no>${esc(dropTxt || "Discard")}</button><button class="btn block" data-close>Keep editing</button></div>`);
  const y = el.querySelector("[data-yes]"); if (y) y.onclick = () => { el.remove(); onSave(); };
  el.querySelector("[data-no]").onclick = () => { el.remove(); onDrop(); };
  return el;
}

/* ---------- The day being edited ---------- */
let draft = null;
function ensureDraft(d, auto) {
  if (draft && draft.d === d) return draft;
  const lg = S.logs[d];
  draft = { d, blocks: logged(d) ? clone(lg.blocks) : autoFill(d), dirty: false, pos: 0, good: (lg && lg.good) || "", energy: (lg && lg.energy) || null, wasLogged: logged(d) };
  return draft;
}
function commitDraft() {
  if (!draft) return; const d = draft.d;
  S.logs[d] = Object.assign({}, S.logs[d] || {}, { blocks: draft.blocks.map(b => { const x = { ...b }; delete x.check; return x; }), src: draft.dirty ? "edited" : "auto", at: Date.now(), good: draft.good || "", energy: draft.energy || null });
  draft = null; save(); toast("Day saved");
}
function logUsual(d) { S.logs[d] = Object.assign({}, S.logs[d] || {}, { blocks: autoFill(d).map(b => { const x = { ...b }; delete x.check; return x; }), src: "auto", at: Date.now() }); save(); }

/* What a pick of activity, category and company counts as. */
function countFor(k, w) {
  if (S.shareWith && w) { const wk = w === "partner" ? (isArea("partner") ? "partner" : isArea("family") ? "family" : null) : (isArea(w) ? w : null); if (wk && wk !== k) return { k: wk, sh: isArea(k) ? k : null }; }
  return { k, sh: null };
}
function pickSheet(i, mode) {
  const b = draft.blocks[i]; if (!b) return;
  let a = b.a || null, kk = b.a ? null : b.k, w = b.w || "", from = b.s, to = b.e;
  const catNow = () => kk || (a ? catOf(a) : b.k);
  const cats = S.areas.concat(S.less.map(x => x.k), NEUTRAL.filter(k => !isLess(k)));
  const body = () => { const c = countFor(catNow(), w);
    return `<p class="tiny muted">${span(from, to)}${mode === "swipe" ? " · you swiped “changed”" : ""}</p><h3>What did this time really go to?</h3>
    <div class="actgrid">${PICK_ACTS.map(x => `<button class="actb" data-pa="${x}" aria-pressed="${!kk && a === x}"><i style="background:${ccol(catOf(x))}"></i>${esc(ACTS[x].n)}</button>`).join("")}</div>
    <details${kk ? " open" : ""}><summary class="tiny">Or count it as…</summary><div class="chips">${cats.map(k => `<button class="chip" data-pk="${k}" aria-pressed="${kk === k}" style="--cc:${ccol(k)}">${esc(cname(k))}</button>`).join("")}</div></details>
    ${S.shareWith ? `<h3 style="margin-top:12px">Who were you with?</h3><div class="chips">${WITH.map(([k, n]) => `<button class="chip" data-pw="${k}" aria-pressed="${w === k}">${n}</button>`).join("")}</div>` : ""}
    <div class="li"><span class="grow">From</span>${stepper("x", "from", from, "start", "").replace(/data-act="x" data-arg="from\|([-+])"/g, 'data-pt="from|$1"').replace(/<b class="val">[^<]*<\/b>/, `<b class="val">${hm(from)}</b>`)}</div>
    <div class="li"><span class="grow">Until</span>${stepper("x", "to", to, "end", "").replace(/data-act="x" data-arg="to\|([-+])"/g, 'data-pt="to|$1"').replace(/<b class="val">[^<]*<\/b>/, `<b class="val">${to >= 24 ? "12 am" : hm(to)}</b>`)}</div>
    <div class="card tiny">Counts for <b>${esc(cname(c.k))} ${hh(to - from)}</b>${c.sh ? `, also <b>${esc(cname(c.sh))}</b> (shared)` : ""}${(to < b.e || from > b.s) ? `<br><span class="muted">The rest stays ${esc(cname(b.k))}.</span>` : ""}</div>
    <div class="btns"><button class="btn primary block" data-psave>${mode === "swipe" ? "Save, next block" : "Save block"}</button></div>`; };
  const el = sheet(mode === "swipe" ? "What was it?" : span(b.s, b.e), body());
  const re = () => { const open = el.querySelector("details") && el.querySelector("details").open; el.querySelector(".body").innerHTML = body(); if (open) el.querySelector("details").open = true; };
  el.addEventListener("click", e => { const t = e.target.closest("button"); if (!t || !el.contains(t)) return;
    if (t.dataset.pa) { a = t.dataset.pa; kk = null; re(); }
    else if (t.dataset.pk) { kk = t.dataset.pk; re(); }
    else if (t.dataset.pw !== undefined) { w = t.dataset.pw; re(); }
    else if (t.dataset.pt) { const [f, dir] = t.dataset.pt.split("|"), dv = dir === "+" ? 0.5 : -0.5; if (f === "from") from = Math.max(0, Math.min(to - 0.5, from + dv)); else to = Math.min(24, Math.max(from + 0.5, to + dv)); re(); }
    else if (t.hasAttribute("data-psave")) {
      const c = countFor(catNow(), w);
      draft.blocks = setRange(draft.blocks, from, to, { k: c.k, a: kk ? undefined : a, w: w || undefined, sh: c.sh || undefined, src: "edited" });
      draft.dirty = true; if (mode === "swipe") draft.pos = to;
      el.remove(); toast("Saved " + span(from, to) + " as " + cname(c.k)); afterSwipeStep();
    }
  });
}
function worthSheet(i) {
  const b = draft.blocks[i];
  const el = sheet(span(b.s, b.e) + " · " + cname(b.k), `<p class="tiny muted">You swiped “happened”. One quick question:</p><h3>Worth it?</h3><div class="seg" role="group">${[["yes", "Yes"], ["meh", "Meh"], ["no", "No"]].map(([k, n]) => `<button data-wo="${k}">${n}</button>`).join("")}</div><div class="card tiny lh">No cost either way. An honest day counts toward your streak like any other.<br><span class="muted">“No” ${worthNo(addD(today(), -30), today())} times in the last month. You'll see them in your ${esc(L("week").toLowerCase())}.</span></div>`, () => { if (!answered) { draft.pos = b.e; afterSwipeStep(); } });
  let answered = false;
  el.querySelectorAll("[data-wo]").forEach(x => x.onclick = () => { answered = true; draft.blocks[i] = Object.assign({}, draft.blocks[i], { wo: x.dataset.wo }); draft.dirty = true; draft.pos = b.e; el.remove(); afterSwipeStep(); });
}
function afterSwipeStep() {
  if (top_().p !== "swipe") return rerender();
  if ((draft.pos || 0) >= 24 - 1e-6) { NAV = NAV.slice(0, -1).concat([{ p: "dial", d: draft.d }]); render(); window.scrollTo(0, 0); toast("All blocks checked. Fine-tune, then save."); return; }
  render();
}
function swipeYes() { const bl = draft.blocks, i = bl.findIndex(b => b.s >= (draft.pos || 0) - 1e-6); if (i < 0) return afterSwipeStep(); const b = bl[i]; if (isLess(b.k) && pushing()) return worthSheet(i); draft.pos = b.e; afterSwipeStep(); }
function swipeNo() { const bl = draft.blocks, i = bl.findIndex(b => b.s >= (draft.pos || 0) - 1e-6); if (i >= 0) pickSheet(i, "swipe"); }
function mismatchSheet(i) {
  const d = draft.d, b = draft.blocks[i], m = stInBlock(d, b); if (!m) return;
  const len = (b.e - b.s) * 60, phone = Math.min(len, r2(m.min / 30) * 30);
  const el = sheet(span(b.s, b.e) + " · " + cname(b.k), `<div class="card warnsoft tiny">Your phone shows <b>${hmin(m.min)} of ${esc(cname(m.k).toLowerCase())}</b> in this block.</div><p class="tiny muted">Era doesn't assume. Which is closer?</p><div class="btns col"><button class="btn primary block" data-split>Split it: ${hmin(len - phone)} ${esc(cname(b.k))}, ${hmin(phone)} ${esc(cname(m.k))}</button><button class="btn block" data-keep>It was ${esc(cname(b.k))}, the phone was music or maps</button></div><p class="tiny muted">Honest answers keep your streak either way.</p>`);
  el.querySelector("[data-split]").onclick = () => { if (phone > 0) draft.blocks = setRange(draft.blocks, b.e - phone / 60, b.e, { k: m.k, a: m.k === "social" ? "scroll" : undefined, src: "phone" }); draft.dirty = true; el.remove(); rerender(); };
  el.querySelector("[data-keep]").onclick = () => { draft.blocks[i] = Object.assign({}, b, { okphone: 1 }); el.remove(); rerender(); };
}

/* ---------- Beads ---------- */
function moveBead(from, to) {
  if (from === to) return;
  const jar = jarItems(beadSum()).find(j => j.k === from);
  if (!jar || jar.v < 1 - 1e-6) { toast(cname(from) + " has no beads left"); return; }
  if (jar.locked) { toast(cname(from) + " is a non-negotiable"); return; }
  const rev = beadDraft.find(m => m.from === to && m.to === from);
  if (rev) { rev.h -= 1; if (rev.h <= 0) beadDraft.splice(beadDraft.indexOf(rev), 1); } else beadDraft.push({ from, to, h: 1 });
}
function saveBeads() {
  const q = curQ(); const pend = {};
  (beadDraft || []).forEach(m => { const key = m.from + ">" + m.to; pend[key] = (pend[key] || 0) + m.h; });
  Object.keys(pend).forEach(key => { const [from, to] = key.split(">"); let h = pend[key];
    const rev = S.moves.find(m => m.q === q && m.from === to && m.to === from); if (rev) { const t = Math.min(rev.h, h); rev.h -= t; h -= t; if (rev.h <= 0) S.moves = S.moves.filter(m => m !== rev); }
    if (h <= 0) return; const ex = S.moves.find(m => m.q === q && m.from === from && m.to === to); if (ex) { ex.h += h; if (beadNote) ex.note = beadNote; } else S.moves.push({ id: uid(), q, from, to, h, note: beadNote || "" }); });
  const names = Object.keys(pend).map(k => k.split(">").map(cname).join(" → ")).join(", ");
  beadDraft = []; beadSel = null; beadNote = "";
  snapshot((eraName(q) || "This era") + ": " + names); save(); toast("Change saved");
}

/* ---------- Small sheets ---------- */
function mapSheet(a) {
  const opts = S.areas.concat(S.less.map(x => x.k), ["other"]); const cur = catOf(a);
  const el = sheet(ACTS[a].n, `<p class="tiny muted">Where does this count for you?</p><div class="btns col">${opts.map(k => `<button class="btn block${k === cur ? " primary" : ""}" data-m="${k}">${isLess(k) ? esc(L("less")) + ": " : ""}${esc(k === "other" ? "Neutral" : cname(k))}</button>`).join("")}</div>`);
  el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { S.map[a] = b.dataset.m; save(); el.remove(); rerender(); });
}
function appMapSheet(pkg) {
  const v = stDay(today()), app = ((v && v.apps) || []).find(x => x.pkg === pkg) || { label: pkg }; const cur = appCat(pkg, app.hint);
  const opts = S.less.map(x => x.k).concat(S.areas);
  const el = sheet(app.label || pkg, `<p class="tiny muted">Where does time in this app count?</p><div class="btns col">${opts.map(k => `<button class="btn block${k === cur ? " primary" : ""}" data-m="${k}">${isLess(k) ? esc(L("less")) + ": " : ""}${esc(cname(k))}</button>`).join("")}<button class="btn block${!cur ? " primary" : ""}" data-m="">Neutral (don't count it)</button></div>`);
  el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { S.st.map[pkg] = b.dataset.m; Object.keys(stCache).forEach(k => delete stCache[k]); save(); el.remove(); rerender(); });
}
function ownSheet(kind) {
  const el = sheet(kind === "area" ? "Something you want more of" : "Something you want less of", `<label class="f" for="own-n">Name</label><input type="text" id="own-n" placeholder="${kind === "area" ? "Music" : "Online shopping"}" maxlength="24"><div class="btns"><button class="btn primary block" data-ok>Add</button></div>`);
  const ok = () => { const n = el.querySelector("#own-n").value.trim(); if (!n) { toast("Write a name first"); return; }
    if (kind === "area" && S.areas.length >= 7) { toast("Up to 7 areas"); return; }
    const k = "c_" + uid().slice(-6), used = Object.keys(S.custom).length;
    S.custom[k] = { n, c: kind === "area" ? CUSTOM_COLORS[used % CUSTOM_COLORS.length] : LESS_CUSTOM_COLORS[used % LESS_CUSTOM_COLORS.length], kind };
    if (kind === "area") S.areas.push(k); else S.less.push({ k, since: today(), aim: null });
    save(); el.remove(); rerender(); };
  el.querySelector("[data-ok]").onclick = ok; el.querySelector("#own-n").addEventListener("keydown", e => { if (e.key === "Enter") ok(); }); setTimeout(() => el.querySelector("#own-n").focus(), 50);
}
function questSheet(o) {
  o = o || {}; let when = o.date ? "weekend" : (o.when || "week"), area = S.areas.includes("trips") && o.date ? "trips" : S.areas[0];
  const body = () => `<label class="f" for="q-title">What</label><input type="text" id="q-title" placeholder="${o.date ? "Gokarna long weekend" : "Dinner with Rohan"}" value="${esc(o.title || "")}">
    <label class="f">Area</label><div class="chips">${S.areas.map(k => `<button class="chip" data-qa="${k}" aria-pressed="${area === k}" style="--cc:${ccol(k)}">${esc(cname(k))}</button>`).join("")}</div>
    <label class="f">When</label><div class="seg wrap" role="group">${(o.date ? [["weekend", "Weekend of " + fmtS(o.date)]] : []).concat(o.week ? [["week", "Week of " + fmtS(o.week)], ["month", "This month"], ["era", "This era"]] : [["week", "This week"], ["next", "Next week"], ["month", "This month"], ["era", "This era"]]).map(([k, n]) => `<button data-qw="${k}" aria-pressed="${when === k}">${n}</button>`).join("")}</div>
    <div class="btns"><button class="btn primary block" data-qsave>Save ${esc(L("quests").toLowerCase().replace(/s$/, ""))}</button></div>`;
  let saved = false;
  const el = sheet(o.date ? "Claim " + fmtS(o.date) : "New " + L("quests").toLowerCase().replace(/s$/, ""), body(), () => { if (!saved && el.querySelector("#q-title").value.trim()) doSave(); });
  const doSave = () => { const title = el.querySelector("#q-title").value.trim(); if (!title) { toast("Write what it is"); return false; }
    const t = today(), mon = mondayOf(t), wk = o.week && when === "week" ? o.week : when === "next" ? addD(mon, 7) : mon;
    S.quests.push({ id: uid(), title, area, when: when === "next" ? "week" : when, week: (when === "week" || when === "next") ? wk : null, month: t.slice(0, 7), q: qOf(when === "weekend" ? o.date : wk), date: when === "weekend" ? o.date : null, status: "open", moved: 0, created: t });
    saved = true; save(); el.remove(); rerender(); toast("Saved " + title); return true; };
  el.addEventListener("click", e => { const t = e.target.closest("button"); if (!t) return; const keep = el.querySelector("#q-title").value;
    if (t.dataset.qa) { area = t.dataset.qa; el.querySelector(".body").innerHTML = body(); el.querySelector("#q-title").value = keep; }
    if (t.dataset.qw) { when = t.dataset.qw; el.querySelector(".body").innerHTML = body(); el.querySelector("#q-title").value = keep; }
    if (t.hasAttribute("data-qsave")) doSave(); });
}
function satSheet(sat) {
  const c = claimOf(sat); if (!c) return questSheet({ date: sat });
  const el = sheet(fmtS(sat) + " · " + c.title, `<p class="tiny muted">${esc(cname(c.area))}${c.status === "done" ? " · done" : ""}</p><div class="btns col">${c.status === "open" ? `<button class="btn primary block" data-s="done">Done</button><button class="btn block" data-s="moved">Move to the next free weekend</button>` : ""}<button class="btn block warn" data-s="dropped">Drop it</button></div>`);
  el.querySelectorAll("[data-s]").forEach(b => b.onclick = () => { questAct(c.id, b.dataset.s); el.remove(); });
}
function questAct(id, st) {
  const x = S.quests.find(y => y.id === id); if (!x) return;
  if (st === "moved") { x.moved = (x.moved || 0) + 1;
    if (x.date) { let d = addD(x.date, 7); while (claimOf(d) && claimOf(d) !== x) d = addD(d, 7); x.date = d; x.q = qOf(d); }
    else if (x.when === "week") x.week = addD(x.week, 7); else if (x.when === "month") x.when = "era"; else x.q = qNext(x.q);
    toast("Moved. It keeps its place in line."); }
  else { x.status = st; x.doneAt = today(); if (st === "done") toast(x.moved ? "Done, a bit late. Late still counts." : "Done"); }
  save(); rerender();
}
function renameSheet() {
  const q = curQ(); const el = sheet("Name this era", `<p class="tiny muted">${qLabel(q)}</p><input type="text" id="era-n" value="${esc(eraName(q))}" placeholder="my fitness era"><div class="btns"><button class="btn primary block" data-ok>Save</button></div>`);
  el.querySelector("[data-ok]").onclick = () => { S.eras[q] = Object.assign(S.eras[q] || {}, { name: el.querySelector("#era-n").value.trim() }); save(); el.remove(); rerender(); };
}

/* ---------- Actions (data-act) ---------- */
const ACT = {
  back: () => back(), home: () => home(), tab: t => tabTo(t),
  go: (p, el) => { const a = {}; if (["receipt", "observe"].includes(p) && NAV[0].p === "today") weekOf = mondayOf(today()); if (el.dataset.d) a.d = el.dataset.d; if (el.dataset.q) a.q = el.dataset.q; if (p === "fill" || p === "dial") a.d = a.d || today(); if ((p === "fill" || p === "dial") && draft && draft.d !== a.d && !draft.dirty) draft = null; go(p, a); },
  next: p => { if (top_().p === "s_areas" && S.areas.length < 3) { toast("Pick at least 3"); return; } if (top_().p === "s_shape") return; go(p); },
  // first run and Me
  area: k => { const i = S.areas.indexOf(k); if (i >= 0) { if (S.areas.length <= 3) { toast("Keep at least 3 corners"); return; } S.areas.splice(i, 1); } else { if (S.areas.length >= 7) { toast("Up to 7 corners"); return; } S.areas.push(k); } save(); rerender(); },
  lessk: k => { const i = S.less.findIndex(x => x.k === k); if (i >= 0) S.less.splice(i, 1); else S.less.push({ k, since: today(), aim: null }); save(); rerender(); },
  "less-none": () => { S.less = []; save(); rerender(); },
  "own-area": () => ownSheet("area"), "own-less": () => ownSheet("less"),
  push: k => { S.push = k; save(); rerender(); },
  map: a => mapSheet(a), appmap: p => appMapSheet(p),
  sharewith: () => { S.shareWith = !S.shareWith; save(); rerender(); },
  preset: k => { S.week.preset = k; S.week.wd = PRESETS[k].wd.map(b => ({ ...b })); S.week.we = PRESETS[k].we.map(b => ({ ...b })); save(); rerender(); },
  workday: d => { d = +d; const i = S.week.workdays.indexOf(d); if (i >= 0) S.week.workdays.splice(i, 1); else S.week.workdays.push(d); save(); rerender(); },
  brush: b => { brush = b; document.querySelectorAll(".brush").forEach(x => x.setAttribute("aria-pressed", x.dataset.arg === b)); },
  "st-allow": () => { S.st.want = true; save(); const N = NATIVE(); if (N && N.stOpen) N.stOpen(); },
  "st-on": () => { S.st.on = true; save(); rerender(); },
  "st-off": () => { S.st.on = false; S.st.want = false; save(); rerender(); },
  "st-aim": (a) => { S.st.aim = Math.max(0.5, Math.min(12, S.st.aim + (a.endsWith("+") ? 0.5 : -0.5))); save(); rerender(); },
  finish: () => {
    const n = ($("#o-era") || {}).value; const q = curQ(); S.eras[q] = Object.assign(S.eras[q] || {}, { name: (n || "").trim() });
    S.onboarded = true; S.onboardedAt = today(); S.less.forEach(it => it.since = today()); snapshot("Normal week"); save(); nativeSync();
    NAV = [{ p: "today" }]; render(); window.scrollTo(0, 0); toast("Welcome to your era");
  },
  // today
  looks: d => { logUsual(d); if (draft && draft.d === d) draft = null; toast(d === today() ? "Day logged" : fmtD(d) + " logged"); rerender(); },
  "looks-all": () => { missedDays().forEach(logUsual); toast("All caught up"); home(); },
  "skip-missed": () => { S.skipBefore = today(); save(); rerender(); },
  swipe: d => { if (!draft || draft.d !== d) draft = null; ensureDraft(d, true); draft.pos = 0; go("swipe", { d }); },
  "sw-yes": () => swipeYes(), "sw-no": () => swipeNo(),
  "save-draft": () => { commitDraft(); setNav([NAV[0]]); },
  "reset-day": () => { draft.blocks = autoFill(draft.d); draft.dirty = true; rerender(); },
  pick: i => pickSheet(+i, "dial"),
  edge: a => { const [i, dir] = a.split("|"); const b = draft.blocks[+i]; draft.blocks = moveEdge(draft.blocks, +i, b.e + (dir === "+" ? 0.5 : -0.5)); draft.dirty = true; rerender(); },
  energy: k => { draft.energy = k; draft.dirty = true; rerender(); },
  mismatch: i => mismatchSheet(+i),
  "goal-end": a => { const [id, r] = a.split("|"); const g = S.goals.find(x => x.id === id); g.closed = true; g.result = r; save(); rerender(); toast(r === "no" ? "Not this time. You chose it for a reason; that still stands." : "Noted. You chose it on purpose."); },
  "goal-hour": id => { const g = S.goals.find(x => x.id === id), t = today(); let bl = logged(t) ? clone(S.logs[t].blocks) : autoFill(t).map(b => { const x = { ...b }; delete x.check; return x; });
    const src = Object.keys(g.src).sort((a, b) => g.src[b] - g.src[a]); let blk = null;
    for (const k of src.concat(S.less.map(x => x.k), ["other", "selfcare"])) { blk = bl.slice().reverse().find(b => b.k === k && b.e - b.s >= 1); if (blk) break; }
    if (!blk) blk = bl.slice().reverse().find(b => isFree(b.k) && b.k !== g.area && b.e - b.s >= 1);
    if (!blk) { toast("No free hour left today to move"); return; }
    bl = setRange(bl, blk.e - 1, blk.e, { k: g.area, a: "study", goal: g.id, src: "edited" }); S.logs[t] = Object.assign({}, S.logs[t] || {}, { blocks: bl, src: "edited", at: Date.now() }); save(); toast("+1 h " + g.title + ", from " + cname(blk.k).toLowerCase()); rerender(); },
  quest: a => { const [id, st] = a.split("|"); questAct(id, st); },
  "quest-add": w => questSheet(w === "nextweek" ? { when: "week", week: addD(weekOf || mondayOf(today()), 7) } : { when: w }),
  seen: k => { S.seen[k] = 1; save(); rerender(); },
  resume: () => { S.pause = null; save(); rerender(); toast("The push is back on"); },
  // week
  wk: n => { weekOf = addD(weekOf || mondayOf(today()), +n); rerender(); },
  blocker: b => { const mon = weekOf || mondayOf(today()), R = S.retros[mon] = S.retros[mon] || {}; R.blockers = R.blockers || []; const i = R.blockers.indexOf(b); if (i >= 0) R.blockers.splice(i, 1); else R.blockers.push(b); save(); rerender(); },
  "save-retro": () => { const mon = weekOf || mondayOf(today()), R = S.retros[mon] = S.retros[mon] || {}; R.at = Date.now(); save(); NAV = [NAV[0], { p: "weekdone" }]; render(); window.scrollTo(0, 0); toast(L("week") + " saved"); },
  observed: () => { S.less.forEach(it => { if (it.aim == null && !it.ladder) it.observed = today(); }); save(); home(); toast("Fine. Era keeps watching, quietly."); },
  decide: k => { if (!isLess(k)) S.less.push({ k, since: addD(today(), -14), aim: null }); dec = null; go("decide1", { k }); },
  "dec-swap": k => { dec.swap = k; rerender(); },
  "dec-pace": p => { dec.pace = p; rerender(); },
  "dec-target": a => { dec.target = Math.max(0, (dec.target || 0) + (a.endsWith("+") ? 0.5 : -0.5)); rerender(); },
  "dec-start": () => { const it = lessItem(dec.k), base = r2(baseline(dec.k));
    Object.assign(it, { base, target: dec.target, aim: dec.target, pace: dec.pace, ladder: makeLadder(base, dec.target, dec.pace), swap: dec.swap, identity: dec.identity, stack: dec.stack, tiny: dec.tiny, decided: today() });
    snapshot("Ladder: less " + cname(dec.k).toLowerCase()); save(); const first = aimFor(it, mondayOf(today())); dec = null; NAV = [{ p: "week" }]; render(); window.scrollTo(0, 0); toast("Ladder started. This week: " + hh(first)); },
  aim: a => { const [k, dir] = a.split("|"); const it = lessItem(k); it.aim = Math.max(0, it.aim + (dir === "+" ? 0.5 : -0.5)); save(); rerender(); },
  // era
  "rename-era": () => renameSheet(),
  jar: () => {},
  "bead-undo": key => { const [f, t] = key.split(">"); beadDraft = beadDraft.filter(m => !(m.from === f && m.to === t)); rerender(); },
  "bead-save": () => { saveBeads(); rerender(); },
  mv: a => { const [id, dir] = a.split("|"); const m = S.moves.find(x => x.id === id); m.h = Math.max(0, m.h + (dir === "+" ? 0.5 : -0.5)); if (!m.h) S.moves = S.moves.filter(x => x !== m); save(); rerender(); },
  "mv-rm": id => { S.moves = S.moves.filter(x => x.id !== id); save(); rerender(); toast("Change removed"); },
  "lock-next": p => { const g = goalDraft;
    if (p === "lock2" && !g.title.trim()) { toast("Name the goal first"); return; }
    if (p === "lock3") { const got = Object.values(g.src).reduce((a, b) => a + b, 0); if (got < goalPer(g) - 0.01) { toast("Choose where all " + hh(goalPer(g)) + " a week come from"); return; } }
    go(p); },
  "g-total": a => { goalDraft.total = Math.max(5, goalDraft.total + (a.endsWith("+") ? 5 : -5)); rerender(); },
  "g-area": k => { delete goalDraft.src[k]; goalDraft.area = k; rerender(); },
  "g-src": a => { const [k, dir] = a.split("|"); const g = goalDraft, cur = g.src[k] || 0, avail = planWeek(curQ(), today())[k] || 0; g.src[k] = Math.max(0, Math.min(avail, cur + (dir === "+" ? 0.5 : -0.5))); if (!g.src[k]) delete g.src[k]; rerender(); },
  "lock-save": () => { const g = goalDraft; S.goals.push(Object.assign({ id: uid() }, clone(g), { title: g.title.trim() })); snapshot(L("lockin") + ": " + g.title.trim()); goalDraft = null; save(); NAV = [{ p: "era" }]; render(); window.scrollTo(0, 0); toast("Locked in: " + g.title.trim()); },
  sat: s => satSheet(s),
  "claim-next": () => { const t = today(), y = +t.slice(0, 4); const free = weekendsFrom(t, (y + 1) + "-12-31").find(s => !claimOf(s)); if (free) questSheet({ date: free }); },
  "era-retro-save": q => { S.eras[q] = Object.assign(S.eras[q] || {}, { at: Date.now() }); save(); home(); toast("Retro saved"); },
  "ne-from": k => { newEraFrom = k; rerender(); },
  "ne-start": nq => { const name = ($("#ne-name") || {}).value || ""; const pq = qPrev(nq); S.eras[pq] = Object.assign(S.eras[pq] || {}, { at: (S.eras[pq] || {}).at || Date.now() }); S.eras[nq] = Object.assign(S.eras[nq] || {}, { name: name.trim() });
    if (newEraFrom === "plan" && !S.moves.some(m => m.q === nq)) S.moves.filter(m => m.q === pq).forEach(m => S.moves.push({ ...m, id: uid(), q: nq }));
    save(); NAV = [{ p: "era" }]; render(); window.scrollTo(0, 0); toast(name.trim() ? "‘" + name.trim() + "’ is set for " + qLabel(nq) : "Next era saved"); },
  // me
  protect: k => { const i = S.protect.indexOf(k); if (i >= 0) S.protect.splice(i, 1); else S.protect.push(k); save(); rerender(); },
  version: id => { const v = S.versions.find(x => x.id === id); confirmSheet("Switch back to ‘" + v.name + "’?", "Your current shape is saved as a version first, so you can come back to it.", "Switch back", () => { restoreVersion(id); rerender(); toast("Switched back to " + v.name); }, () => {}, "Cancel"); },
  "pause-len": k => { pauseLen = k; rerender(); },
  pause: () => { S.pause = pauseLen === "0" ? { forever: true } : { until: addD(today(), +pauseLen - 1) }; save(); rerender(); toast("Paused. Logging still works."); },
  "rem-on": () => { S.remind.on = !S.remind.on; save(); nativeSync(); rerender(); },
  ics: () => ics(),
  "share-app": () => { const url = "https://github.com/rj8228/Era/releases/latest"; const text = APPNAME + ": see where your week goes and spend it on purpose. " + url; const N = NATIVE(); if (N && N.share) N.share(text); else if (navigator.share) navigator.share({ text }).catch(() => {}); else window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank"); },
  export: () => { S.lastBackup = today(); save(); const name = "era-backup-" + today() + ".json", txt = JSON.stringify(S); const N = NATIVE(); if (N && N.saveFile) { N.saveFile(name, txt); rerender(); return; } const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "application/json" })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); rerender(); },
  import: () => { const f = $("#m-file"); if (f) f.click(); },
  reset: () => confirmSheet("Delete everything?", "This deletes your week, logs, plans and eras from this phone. Save a backup first if you might want them.", null, () => {}, () => { try { localStorage.removeItem(KEY); localStorage.removeItem(KEY_OLD); } catch (e) {} S = fresh(); draft = null; NAV = []; render(); }, "Delete everything")
};

/* ---------- Inputs (data-in) ---------- */
const IN = {
  good: v => { draft.good = v; draft.dirty = true; },
  "retro-well": v => { const mon = weekOf || mondayOf(today()); (S.retros[mon] = S.retros[mon] || {}).well = v; save(); },
  "retro-change": v => { const mon = weekOf || mondayOf(today()); (S.retros[mon] = S.retros[mon] || {}).change = v; save(); },
  "dec-identity": v => { dec.identity = v; }, "dec-stack": v => { dec.stack = v; }, "dec-tiny": v => { dec.tiny = v; },
  "bead-note": v => { beadNote = v; },
  "g-title": v => { goalDraft.title = v; }, "g-why": v => { goalDraft.why = v; },
  "g-end": v => { if (v) { goalDraft.end = v; rerender(); } },
  "era-keep": (v, el) => { const q = el.dataset.q; S.eras[q] = Object.assign(S.eras[q] || {}, { keep: v }); save(); },
  "era-change": (v, el) => { const q = el.dataset.q; S.eras[q] = Object.assign(S.eras[q] || {}, { change: v }); save(); },
  "ne-name": () => {},
  "rem-daily": v => { S.remind.daily = v || "21:30"; save(); nativeSync(); },
  "rem-weekly": v => { S.remind.weekly = v || "19:00"; save(); nativeSync(); },
  label: (v, el) => { const k = el.dataset.k; if (v.trim()) S.labels[k] = v.trim(); else delete S.labels[k]; save(); }
};
const LIVE_IN = new Set(["good", "dec-identity", "dec-stack", "dec-tiny", "bead-note", "g-title", "g-why"]);

document.addEventListener("click", e => {
  if (e.target.closest(".sheet")) return;
  const tb = e.target.closest("#tabs button"); if (tb) { tabTo(tb.dataset.tab); return; }
  const b = e.target.closest("[data-act]"); if (!b) return;
  const f = ACT[b.dataset.act]; if (f) f(b.dataset.arg, b);
});
document.addEventListener("input", e => { const t = e.target; if (t.dataset.in && LIVE_IN.has(t.dataset.in)) IN[t.dataset.in](t.value, t); });
document.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.in && IN[t.dataset.in]) IN[t.dataset.in](t.value, t);
  if (t.id === "m-file" && t.files[0]) t.files[0].text().then(txt => { try { S = fromBackup(JSON.parse(txt)); save(); draft = null; NAV = [{ p: "today" }]; render(); toast("Backup restored"); } catch (er) { toast("That isn't an Era backup"); } });
});

/* ---------- Gestures, attached after a page renders ---------- */
const AFTER = {};
AFTER.dial = () => {
  const wrap = $("#dialwrap"); if (!wrap) return; let drag = null;
  const redraw = () => { const bl = draft.blocks; wrap.innerHTML = dialSVG(bl, 300, { edit: true, center: hh(dayFree(bl)), sub: "free", id: "dialsvg", edge: drag ? drag.i : null }); $("#blist").innerHTML = blockList(bl); $("#dialtot").textContent = "24 h · " + hh(dayFree(bl)) + " free"; };
  wrap.addEventListener("pointerdown", e => { const c = e.target.closest(".edge"); if (!c) return; e.preventDefault(); drag = { i: +c.dataset.edge, n: draft.blocks.length }; wrap.setPointerCapture(e.pointerId); redraw(); });
  wrap.addEventListener("pointermove", e => { if (!drag) return; const svg = wrap.querySelector("svg"); let t = dialTime(svg, e.clientX, e.clientY); const b = draft.blocks[drag.i]; if (!b) return; if (t < b.s - 12) t += 24; if (t > b.e + 12 && t - 24 >= 0) t -= 24; const nb = moveEdge(draft.blocks, drag.i, t); if (nb.length !== drag.n) { draft.blocks = nb; draft.dirty = true; drag = null; redraw(); return; } draft.blocks = nb; draft.dirty = true; redraw(); });
  const end = () => { if (drag) { drag = null; redraw(); } };
  wrap.addEventListener("pointerup", end); wrap.addEventListener("pointercancel", end);
  wrap.addEventListener("click", e => { const a = e.target.closest(".arc"); if (a && !drag) pickSheet(+a.dataset.arc, "dial"); });
  wrap.addEventListener("keydown", e => { const c = e.target.closest(".edge"); if (!c) return; const i = +c.dataset.edge; if (e.key === "ArrowRight" || e.key === "ArrowUp") { draft.blocks = moveEdge(draft.blocks, i, draft.blocks[i].e + 0.5); } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { draft.blocks = moveEdge(draft.blocks, i, draft.blocks[i].e - 0.5); } else return; e.preventDefault(); draft.dirty = true; redraw(); const n = wrap.querySelector(`[data-edge="${i}"]`); if (n) n.focus(); });
};
AFTER.swipe = () => {
  const card = $("#scard"); if (!card) return; let x0 = null, dx = 0;
  card.addEventListener("pointerdown", e => { x0 = e.clientX; dx = 0; card.setPointerCapture(e.pointerId); card.style.transition = "none"; });
  card.addEventListener("pointermove", e => { if (x0 == null) return; dx = e.clientX - x0; card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`; card.querySelector(".stamp.yes").style.opacity = Math.max(0, Math.min(1, dx / 90)); card.querySelector(".stamp.no").style.opacity = Math.max(0, Math.min(1, -dx / 90)); });
  const up = () => { if (x0 == null) return; x0 = null; card.style.transition = ""; if (dx > 90) { card.style.transform = "translateX(140%) rotate(18deg)"; setTimeout(swipeYes, 160); } else if (dx < -90) { card.style.transform = "translateX(-140%) rotate(-18deg)"; setTimeout(swipeNo, 160); } else { card.style.transform = ""; card.querySelectorAll(".stamp").forEach(s => s.style.opacity = 0); } };
  card.addEventListener("pointerup", up); card.addEventListener("pointercancel", up);
};
function paintAt(cell) {
  const [kind, h] = cell.dataset.paint.split("|"); const hr = +h;
  const patch = brush.startsWith("k:") ? { k: brush.slice(2) } : { a: brush };
  S.week[kind] = setRange(S.week[kind], hr, hr + 1, patch).map(b => { const x = { s: b.s, e: b.e }; if (b.a) x.a = b.a; if (b.k && !b.a) x.k = b.k; return x; });
  S.week.preset = "custom";
  const bl = tmplFor(kind === "wd"); document.querySelectorAll(`[data-paint^="${kind}|"]`).forEach(c => { const hh_ = +c.dataset.paint.split("|")[1]; const blk = bl.find(b => b.s <= hh_ + 0.01 && b.e > hh_ + 0.01); c.style.background = ccol(blk ? blk.k : "other"); });
}
const paintAfter = () => {
  const w = $("#paintwrap"); if (!w) return; let on = false, last = null;
  w.addEventListener("pointerdown", e => { const c = e.target.closest(".cell"); if (!c) return; e.preventDefault(); on = true; last = c; paintAt(c); });
  w.addEventListener("pointermove", e => { if (!on) return; const el = document.elementFromPoint(e.clientX, e.clientY); const c = el && el.closest && el.closest(".cell"); if (c && c !== last && w.contains(c)) { last = c; paintAt(c); } });
  const end = () => { if (!on) return; on = false; save(); rerender(); };
  w.addEventListener("pointerup", end); w.addEventListener("pointercancel", end); w.addEventListener("pointerleave", end);
};
AFTER.s_paint = paintAfter; AFTER.m_paint = paintAfter;
const jarsAfter = mode => () => {
  const box = document.querySelector(".jars"); if (!box) return; let down = null, dragged = false;
  box.addEventListener("pointerdown", e => { const j = e.target.closest(".jar"); down = j ? j.dataset.jar : null; dragged = false; });
  box.addEventListener("pointerup", e => { const el = document.elementFromPoint(e.clientX, e.clientY), j = el && el.closest && el.closest(".jar"); const upk = j ? j.dataset.jar : null; if (down && upk && down !== upk) { dragged = true; if (mode === "beads") { moveBead(down, upk); beadSel = null; rerender(); } } down = null; });
  box.addEventListener("click", e => { const j = e.target.closest(".jar"); if (!j || dragged) { dragged = false; return; } const k = j.dataset.jar;
    if (mode === "beads") { if (!beadSel) { const it = jarItems(beadSum()).find(x => x.k === k); if (it.locked) { toast(cname(k) + " is a non-negotiable"); return; } if (it.v < 1 - 1e-6) { toast(cname(k) + " has no beads left"); return; } beadSel = k; } else if (beadSel === k) beadSel = null; else { moveBead(beadSel, k); beadSel = null; } rerender(); }
    else { const g = goalDraft; if (k === g.area) return; if (j.classList.contains("locked")) { toast(cname(k) + " is a non-negotiable"); return; } ACT["g-src"](k + "|+"); } });
};
AFTER.beads = jarsAfter("beads"); AFTER.lock2 = jarsAfter("lock");

/* ---------- Calendar file for browsers ---------- */
function nextAt(hmS, dw) { const [H, M] = hmS.split(":").map(Number); const d = new Date(); d.setHours(H, M, 0, 0); if (dw !== undefined) { while (d.getDay() !== dw || d < new Date()) d.setDate(d.getDate() + 1); } else if (d < new Date()) d.setDate(d.getDate() + 1); return d; }
const icsDate = d => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "T" + pad(d.getHours()) + pad(d.getMinutes()) + "00";
function ics() {
  const ev = (id, title, start, rr) => ["BEGIN:VEVENT", "UID:" + id + "@era", "DTSTAMP:" + icsDate(new Date()), "DTSTART:" + icsDate(start), "DTEND:" + icsDate(new Date(start.getTime() + 6e5)), "SUMMARY:" + title, rr, "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + title, "TRIGGER:PT0M", "END:VALARM", "END:VEVENT"].join("\r\n");
  const txt = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Era//EN", ev("daily", APPNAME + ": today's recap", nextAt(S.remind.daily), "RRULE:FREQ=DAILY"), ev("weekly", APPNAME + ": " + L("week"), nextAt(S.remind.weekly, 0), "RRULE:FREQ=WEEKLY"), "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/calendar" })); a.download = "era-reminders.ics"; document.body.appendChild(a); a.click(); a.remove(); toast("Open the file to add it to your calendar");
}

/* ---------- Android bridge ---------- */
function scheduleNative() {
  const N = NATIVE(); if (!N || !N.schedule) return;
  const once = [];
  const q = curQ(); once.push({ id: "era-" + q, at: qEnd(q) + " 19:00", title: "‘" + (eraName(q) || "This era") + "’ ends today", text: "Look back at it and name the next one" });
  S.goals.filter(g => !g.closed).forEach(g => once.push({ id: "goal-" + g.id, at: addD(g.end, 1) + " 09:00", title: L("lockin") + " done: " + g.title, text: "You said it was worth it because…" }));
  try { N.schedule(JSON.stringify({ on: S.remind.on, daily: S.remind.daily, weekly: S.remind.weekly, weeklyDow: S.remind.weeklyDow || 0, app: APPNAME, weeklyTitle: L("week") + ", 3 minutes", once })); } catch (e) {}
}
let widgetTimer = null;
function pushWidget() {
  const N = NATIVE(); if (!N || !N.setWidget || !S.onboarded) return;
  const t = today(), bl = logged(t) ? S.logs[t].blocks : autoFill(t), y = t.slice(0, 4), sats = weekendsFrom(t, y + "-12-31");
  const next = S.quests.filter(x => x.date && x.date >= addD(t, -1) && x.status === "open").sort((a, b) => a.date < b.date ? -1 : 1)[0];
  try { N.setWidget(JSON.stringify({ date: t, logged: logged(t), free: hh(dayFree(bl)), blocks: bl.map(b => [b.s, b.e, blockColor(b, true)]), wleft: sats.length, year: y, next: next ? next.title + ", " + fmtS(next.date) : "", dots: sats.slice(0, 10).map(s => { const c = claimOf(s); return c ? ccol(c.area) : ""; }) })); } catch (e) {}
}
const nativeSync = () => { scheduleNative(); pushWidget(); };
saveHooks.push(() => { clearTimeout(widgetTimer); widgetTimer = setTimeout(pushWidget, 400); });
/* Taps on notification and widget buttons wait in the app until it runs. */
function applyPending() {
  const N = NATIVE(); if (!N || !N.takePending) return false; let list = [];
  try { list = JSON.parse(N.takePending() || "[]"); } catch (e) {}
  let n = 0; list.forEach(x => { if (x.t === "confirm" && x.d && !logged(x.d)) { logUsual(x.d); n++; } });
  let open = ""; try { open = N.takeOpen ? N.takeOpen() || "" : ""; } catch (e) {}
  if (open && S.onboarded) { draft = null; NAV = open === "check" ? [{ p: "today" }, { p: "fill", d: today() }] : open === "era" ? [{ p: "era" }, { p: "horizon" }] : open === "week" ? [{ p: "week" }] : [{ p: "today" }]; }
  return n > 0 || !!open;
}
function onResume() {
  Object.keys(stCache).forEach(k => delete stCache[k]);
  if (S.st.want && !S.st.on && stGranted()) { S.st.on = true; save(); toast("Screen time is on"); }
  applyPending(); render(true);
}
window.eraResume = onResume;
document.addEventListener("visibilitychange", () => { if (!document.hidden && NATIVE()) onResume(); });

/* ---------- Boot ---------- */
// Back after 5 or more days away: a neutral welcome, and aims start again from today.
if (S.onboarded && prevOpen && diffD(prevOpen, today()) >= 5 && S.returned !== today()) { S.returned = today(); save(); }
applyPending();
render();
if (S.onboarded) { if (S.lastOpen !== today()) { S.lastOpen = today(); save(); } nativeSync(); }
if (NATIVE()) {
  if ("serviceWorker" in navigator) navigator.serviceWorker.getRegistrations().then(rs => { const had = rs.length || navigator.serviceWorker.controller; Promise.all(rs.map(r => r.unregister())).then(() => (window.caches ? caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))) : null)).then(() => { if (had && !sessionStorage.getItem("era-sw-cleared")) { sessionStorage.setItem("era-sw-cleared", "1"); location.reload(); } }); }).catch(() => {});
} else if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
window.__era = { S: () => S, NAV: () => NAV, draft: () => draft, autoFill, dayBlocks, lessNow, reclaimed, planWeek, tmplWeek, actualRange };
