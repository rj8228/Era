"use strict";
/* Era drawings: the 24-hour dial, the shape of your free hours, bead jars, weekend dots, the paint grid. */

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sw = c => `<i class="sw" style="background:${c}"></i>`;

/* ---------- Dial ----------
   Midnight at the top, clockwise. o: {center, sub, edit (handles + tappable arcs), focus (index),
   noRed (less-of drawn grey, for widgets), now (show the current time), label} */
const DIAL_C = 120, DIAL_R = 90;
const angOf = t => (t / 24) * 2 * Math.PI - Math.PI / 2;
const ptOf = (t, r) => [DIAL_C + r * Math.cos(angOf(t)), DIAL_C + r * Math.sin(angOf(t))];
function arcPath(s, e, r) {
  if (e - s >= 23.999) return `M ${DIAL_C} ${DIAL_C - r} A ${r} ${r} 0 1 1 ${DIAL_C - 0.01} ${DIAL_C - r}`;
  const g = Math.min(0.06, (e - s) / 4), [x0, y0] = ptOf(s + g, r), [x1, y1] = ptOf(e - g, r);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${e - s > 12 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
function blockColor(b, noRed) { if (noRed && isLess(b.k)) return "#C9CEDC"; return ccol(b.k); }
function dialSVG(bl, size, o) {
  o = o || {};
  const w = o.edit ? 34 : 28; let g = "";
  g += `<circle cx="${DIAL_C}" cy="${DIAL_C}" r="${DIAL_R}" fill="none" stroke="var(--sunk)" stroke-width="${w}"/>`;
  bl.forEach((b, i) => {
    const col = blockColor(b, o.noRed), f = o.focus === i;
    g += `<path d="${arcPath(b.s, b.e, DIAL_R)}" stroke="${col}" stroke-width="${f ? w + 8 : w}" fill="none"${o.edit ? ` data-arc="${i}" class="arc" role="button" tabindex="-1" aria-label="${esc(span(b.s, b.e) + " " + blockLabel(b))}"` : ""}/>`;
    if (b.sh) g += `<path d="${arcPath(b.s, b.e, DIAL_R - w / 2 - 5)}" stroke="${ccol(b.sh)}" stroke-width="4" stroke-dasharray="3 3" fill="none"/>`;
    if (b.check) { const [x, y] = ptOf((b.s + b.e) / 2, DIAL_R + w / 2 + 6); g += `<circle cx="${x}" cy="${y}" r="4" fill="#E0742A"/>`; }
  });
  [["12a", 0], ["6a", 6], ["12p", 12], ["6p", 18]].forEach(([t, h]) => { const [x, y] = ptOf(h, DIAL_R - w / 2 - 14); g += `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" class="dtick">${t}</text>`; });
  if (o.now != null) { const [x, y] = ptOf(o.now, DIAL_R + w / 2 + 2); const [x2, y2] = ptOf(o.now, DIAL_R - w / 2 - 2); g += `<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/>`; }
  if (o.edit) bl.forEach((b, i) => { if (i === bl.length - 1) return; const [x, y] = ptOf(b.e, DIAL_R); g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" class="edge${o.edge === i ? " on" : ""}" data-edge="${i}" role="slider" tabindex="0" aria-label="${esc("Edge at " + hm(b.e) + " between " + blockLabel(b) + " and " + blockLabel(bl[i + 1]))}" aria-valuenow="${b.e}" aria-valuemin="0" aria-valuemax="24"/>`; });
  if (o.center != null) g += `<text x="${DIAL_C}" y="${o.sub ? DIAL_C + 2 : DIAL_C + 9}" text-anchor="middle" class="dcenter">${esc(o.center)}</text>`;
  if (o.sub) g += `<text x="${DIAL_C}" y="${DIAL_C + 22}" text-anchor="middle" class="dsub">${esc(o.sub)}</text>`;
  return `<svg class="dial${o.edit ? " editing" : ""}" width="${size}" height="${size}" viewBox="0 0 240 240" role="img" aria-label="${esc(o.label || "Your day as a 24-hour dial")}"${o.id ? ` id="${o.id}"` : ""}>${g}</svg>`;
}
function blockLabel(b) { const a = b.a && ACTS[b.a] ? ACTS[b.a].n : ""; const n = cname(b.k); return a && a !== n && !(b.a === "family" && b.k === "family") && !(b.a === "friends" && b.k === "friends") ? n + " · " + a.toLowerCase() : n; }
/* Time under a pointer on the dial, from its client position. */
function dialTime(svg, cx, cy) {
  const r = svg.getBoundingClientRect(), x = (cx - r.left) / r.width * 240 - DIAL_C, y = (cy - r.top) / r.height * 240 - DIAL_C;
  let a = Math.atan2(y, x) + Math.PI / 2; if (a < 0) a += 2 * Math.PI; return a / (2 * Math.PI) * 24;
}

/* ---------- Shape ----------
   One corner per area. shapes: [{v, kind: "plan"|"actual"|"shared"|"dull"}]. Square-root scale so
   small corners still show. */
function shapeSVG(keys, shapes, size, o) {
  o = o || {}; const n = keys.length; if (n < 3) return barsHTML(keys, shapes[shapes.length - 1].v);
  const cx = 160, cy = 140, R = 96;
  const max = o.max || Math.max(8, ...shapes.map(sh => Math.max(...keys.map(k => (sh.v[k] || 0) + (sh.extra ? sh.extra[k] || 0 : 0)))));
  const ang = i => (-90 + i * 360 / n) * Math.PI / 180;
  const pt = (i, v) => { const r = R * Math.sqrt(Math.min(1, Math.max(0, v) / max)); return [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))]; };
  const poly = f => keys.map((k, i) => pt(i, f(k)).map(z => z.toFixed(1)).join(",")).join(" ");
  let g = `<polygon points="${poly(() => max)}" fill="var(--sunk)" stroke="var(--line2)"/><polygon points="${poly(() => max / 4)}" fill="none" stroke="var(--line2)" opacity=".6"/>`;
  keys.forEach((k, i) => { const [x, y] = pt(i, max); g += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--line2)" opacity=".5"/>`; });
  shapes.forEach(sh => {
    const p = poly(k => Math.max((sh.v[k] || 0) + (sh.extra ? sh.extra[k] || 0 : 0), max * 0.03));
    if (sh.kind === "plan") g += `<polygon points="${p}" fill="none" stroke="var(--muted)" stroke-width="2.2" stroke-dasharray="5 4"/>`;
    else if (sh.kind === "shared") g += `<polygon points="${p}" fill="url(#hatch)" stroke="var(--accent)" stroke-width="1.4" stroke-dasharray="3 3"/>`;
    else if (sh.kind === "dull") g += `<polygon points="${p}" fill="var(--muted)" fill-opacity=".18" stroke="var(--muted)" stroke-width="2" stroke-dasharray="1.5 3" stroke-linejoin="round"/>`;
    else g += `<polygon points="${p}" fill="var(--accent)" fill-opacity=".2" stroke="var(--accent)" stroke-width="2.6" stroke-linejoin="round"/>`;
  });
  if (!o.mini) keys.forEach((k, i) => {
    const a = ang(i), lx = cx + (R + 24) * Math.cos(a), ly = cy + (R + 18) * Math.sin(a); const last = shapes[shapes.length - 1];
    const v = (last.v[k] || 0) + (last.extra ? last.extra[k] || 0 : 0);
    g += `<text x="${lx.toFixed(1)}" y="${(ly - 2).toFixed(1)}" text-anchor="middle" class="slab">${esc(cname(k))}</text><text x="${lx.toFixed(1)}" y="${(ly + 12).toFixed(1)}" text-anchor="middle" class="sval">${h1(v)}h</text>`;
  });
  const vb = o.mini ? "56 36 208 208" : "0 0 320 280";
  return `<svg class="shape" width="${size}" height="${Math.round(size * (o.mini ? 1 : 280 / 320))}" viewBox="${vb}" role="img" aria-label="${esc(o.label || L("shape"))}"><defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--accent)" fill-opacity=".08"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--accent)" stroke-opacity=".55" stroke-width="1.4"/></pattern></defs>${g}</svg>`;
}
function barsHTML(keys, v) { const max = Math.max(4, ...keys.map(k => v[k] || 0)); return `<div class="card">${keys.map(k => `<div class="cmp"><span>${sw(ccol(k))}${esc(cname(k))}</span><div class="bar"><i style="width:${(v[k] || 0) / max * 100}%;background:${ccol(k)}"></i></div><span class="t">${hh(v[k] || 0)}</span></div>`).join("")}</div>`; }
const legend = (a, b, c) => `<div class="legend"><span><svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" stroke="var(--muted)" stroke-width="2" stroke-dasharray="5 4"/></svg> ${a}</span><span><svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" stroke="var(--accent)" stroke-width="3"/></svg> ${b}</span>${c ? `<span><svg width="18" height="8" aria-hidden="true"><rect width="18" height="8" fill="url(#hatch)" stroke="var(--accent)" stroke-dasharray="2 2"/></svg> ${c}</span>` : ""}</div>`;

/* ---------- Less-of card ---------- */
function lessRows(items, mon, big) {
  return items.map(it => {
    const st = lessNow(it, mon); const max = Math.max(st.aim || 0, st.wtd, usualOf(it.k), 1) * 1.15;
    const aimTxt = st.aim == null ? "watching" : hh(st.wtd) + " / " + hh(st.aim);
    return `<div class="lrow${st.over ? " over" : ""}"><span>${esc(cname(it.k))}</span><div class="bar lbar"><i style="width:${Math.min(100, st.wtd / max * 100)}%"></i>${st.aim != null ? `<u style="left:${st.aim / max * 100}%"></u>` : ""}</div><b>${st.aim == null ? hh(st.wtd) : aimTxt}</b></div>`;
  }).join("");
}
function lessCard(mon, opts) {
  opts = opts || {}; if (!S.less.length) return "";
  const watching = S.less.every(it => lessNow(it, mon).watching);
  return `<div class="card less${watching ? " watch" : ""}"><div class="lhd"><b>↓ ${esc(L("less"))}${watching ? " · watching" : ""}</b><span class="tiny muted">${opts.sub || (watching ? "no aim yet" : "this week · aim")}</span></div>${lessRows(S.less, mon)}</div>`;
}

/* ---------- Bead jars ----------
   items: [{k, v (hours a week), plan (dashed line), locked}] — one bead per hour. */
function jarsHTML(items, o) {
  o = o || {}; const max = Math.max(10, ...items.map(it => Math.max(it.v, it.plan || 0)));
  const per = Math.ceil(max / 16) || 1; // beads per row
  return `<div class="jars" style="grid-template-columns:repeat(${items.length},minmax(0,1fr))">${items.map(it => {
    const n = Math.round(it.v), dots = Array.from({ length: Math.min(n, 60) }, () => `<i style="background:${ccol(it.k)}"></i>`).join("");
    const planLine = it.plan != null ? `<u style="bottom:${Math.min(100, it.plan / max * 100)}%"></u>` : "";
    return `<button class="jar${o.sel === it.k ? " sel" : ""}${it.locked ? " locked" : ""}" data-jar="${it.k}" aria-label="${esc(cname(it.k) + ", " + hh(it.v) + " a week" + (it.locked ? ", locked" : ""))}"><span class="jbox">${dots}${planLine}</span><span class="jn">${it.locked ? "🔒 " : ""}${esc(cname(it.k))}</span><span class="jv">${hh(it.v)}</span></button>`;
  }).join("")}</div>`;
}

/* ---------- Weekend dots ----------
   One dot per weekend: Saturday on the left, Sunday on the right, the first half of each day on top.
   A planned slot is tinted in its area's colour, and filled once it's done. */
function dotsHTML(sats, o) {
  o = o || {};
  const tag = o.static ? "span" : "button";
  const q = (c, cls) => `<i class="wh ${cls}${c ? " on" + (c.status === "done" ? " done" : "") : ""}"${c ? ` style="--qc:${ccol(c.area)}"` : ""}></i>`;
  const say = (n, [a, p]) => !a && !p ? n + " free" : a === p ? n + " " + a.title : n + " first half " + (a ? a.title : "free") + ", second half " + (p ? p.title : "free");
  return `<div class="dots">${sats.map(s => { const A = dayPlans(s), B = dayPlans(addD(s, 1)), any = A.concat(B).filter(Boolean);
    const lbl = "Weekend of " + fmtS(s) + (!any.length ? ", free" : any.every(c => c === any[0]) && any.length === 4 ? ": " + any[0].title : ": " + say("Saturday", A) + "; " + say("Sunday", B));
    return `<${tag} class="wdot${any.length ? " claimed" : ""}"${o.static ? "" : ` data-act="sat" data-arg="${s}"`} data-sat="${s}" ${o.static ? "aria-hidden=\"true\"" : `aria-label="${esc(lbl)}"`}>${q(A[0], "l t")}${q(A[1], "l b")}${q(B[0], "r t")}${q(B[1], "r b")}</${tag}>`; }).join("")}</div>`;
}

/* ---------- Paint grid (normal week) ----------
   7 columns (Mon–Sun) × 24 hours. Workday columns share one normal workday; the others share a day off. */
function paintHTML() {
  const cols = [1, 2, 3, 4, 5, 6, 0];
  const wd = tmplFor(true), we = tmplFor(false);
  const at = (bl, h) => (bl.find(b => b.s <= h + 0.01 && b.e > h + 0.01) || { k: "other" }).k;
  let g = `<div class="paint" role="grid" aria-label="Your normal week, hour by hour"><div class="pc ph"></div>${cols.map(d => `<div class="pc ph${S.week.workdays.includes(d) ? " wdh" : ""}">${DOW[d][0]}</div>`).join("")}`;
  for (let h = 0; h < 24; h++) {
    g += `<div class="pc pt">${h % 6 === 0 ? (h === 0 ? "12a" : h === 12 ? "12p" : h < 12 ? h + "a" : h - 12 + "p") : ""}</div>`;
    cols.forEach(d => { const work = S.week.workdays.includes(d), k = at(work ? wd : we, h); g += `<div class="pc cell" data-paint="${work ? "wd" : "we"}|${h}" data-dow="${d}" style="background:${ccol(k)}" title="${esc(DOW[d] + " " + hm(h) + ": " + cname(k))}"></div>`; });
  }
  return g + `</div>`;
}
