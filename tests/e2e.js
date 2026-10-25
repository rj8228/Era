// End-to-end tests for every Era journey (the same journeys as the Era Screens page), in a real browser.
// Run: serve this folder on :8777 (python3 -m http.server 8777), then: node tests/e2e.js
// The Android bridge is stubbed, so screen time, notification buttons and widgets are covered too.
// Exits with code 1 if any check fails.
const { chromium } = require('playwright');
const fs = require('fs');
const U = process.env.ERA_URL || 'http://localhost:8777/';
let passes = 0, fails = 0, _section = ''; const errsAll = [];
const SEC = { set: v => { _section = v; console.log('— ' + v); } };
Object.defineProperty(globalThis, 'section', { get: () => _section, set: v => SEC.set(v) });
let curPage = null, shotN = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log(`FAIL [${section}] ${m}`); if (curPage && process.env.ERA_SHOTS) { fs.mkdirSync(process.env.ERA_SHOTS, { recursive: true }); curPage.screenshot({ path: `${process.env.ERA_SHOTS}/fail-${++shotN}.png`, fullPage: true }).catch(() => {}); } } };
const T0 = '2026-10-22T21:30:00+05:30'; // a Thursday evening

/* A fake EraNative. Screen time per day comes from localStorage.__st (set by a test); taps on
   notification buttons from localStorage.__pending; calls are recorded in localStorage.__calls. */
const NATIVE_STUB = () => {
  const rec = (k, v) => { try { const c = JSON.parse(localStorage.getItem('__calls') || '{}'); (c[k] = c[k] || []).push(v); localStorage.setItem('__calls', JSON.stringify(c)); } catch (e) {} };
  window.EraNative = {
    stStatus: () => localStorage.getItem('__granted') ? 'granted' : 'denied',
    stOpen: () => rec('stOpen', 1),
    stDay: d => { const all = JSON.parse(localStorage.getItem('__st') || '{}'); return JSON.stringify(all[d] || { apps: [], slots: {} }); },
    takePending: () => { const p = localStorage.getItem('__pending') || '[]'; localStorage.removeItem('__pending'); return p; },
    takeOpen: () => { const o = localStorage.getItem('__open') || ''; localStorage.removeItem('__open'); return o; },
    setWidget: j => rec('widget', JSON.parse(j)),
    schedule: j => rec('schedule', JSON.parse(j)),
    share: t => rec('share', t),
    saveFile: (n, t) => rec('saveFile', { n, len: t.length })
  };
};

(async () => {
  const browser = await chromium.launch();
  const errs = errsAll;
  async function newPage(opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Kolkata', acceptDownloads: true });
    if (opts.native) await ctx.addInitScript(NATIVE_STUB);
    if (opts.init) await ctx.addInitScript(opts.init.fn, opts.init.arg);
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const p = await ctx.newPage(); p.setDefaultTimeout(4000);
    p.on('pageerror', e => errs.push(section + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(section + ' console: ' + m.text()); });
    await p.clock.setFixedTime(new Date(opts.time || T0));
    await p.goto(U); curPage = p;
    return p;
  }
  const S = p => p.evaluate(() => JSON.parse(localStorage.getItem('era-v2') || 'null'));
  const setTime = async (p, t) => { await p.clock.setFixedTime(new Date(t)); await p.reload(); await p.waitForTimeout(80); };
  const text = p => p.textContent('#view');
  const sum24 = bl => Math.abs(bl.reduce((a, b) => a + (b.e - b.s), 0) - 24) < 1e-6 && bl.every((b, i) => i === 0 ? b.s === 0 : Math.abs(b.s - bl[i - 1].e) < 1e-6) && bl[bl.length - 1].e === 24;
  const yes = async p => { if (await p.$('.sheet')) await p.click('.sheet [data-wo=no]'); else await p.click('[data-act=sw-yes]'); await p.waitForTimeout(40); };
  async function onboard(p, o = {}) {
    await p.click('[data-act=next][data-arg=s_areas]');
    if (o.selfcare !== false) await p.click('[data-act=area][data-arg=selfcare]');
    await p.click('[data-act=next][data-arg=s_less]');
    if (o.less !== false) await p.click('[data-act=lessk][data-arg=social]');
    await p.click('[data-act=next][data-arg=s_push]');
    if (o.push) await p.click(`[data-act=push][data-arg=${o.push}]`);
    await p.click('[data-act=next][data-arg=s_map]');
    await p.click('[data-act=next][data-arg=s_paint]');
    await p.click('[data-act=next][data-arg=s_st]');
    await p.click('[data-act=next][data-arg=s_shape]');
    await p.fill('#o-era', o.era || 'my fitness era');
    await p.click('[data-act=finish]');
  }

  /* ---------------- 1 · First run ---------------- */
  section = '1 First run';
  let p = await newPage();
  ok(await p.isVisible('text=See where your week goes'), 'intro shows');
  ok(await p.isHidden('#tabs'), 'no tabs before setup');
  await p.click('[data-act=next][data-arg=s_areas]');
  await p.click('[data-act=area][data-arg=selfcare]');
  let s = await S(p); ok(s.areas.includes('selfcare') && s.areas.length === 6, 'self-care added as a corner');
  for (const k of ['trips', 'friends', 'health']) await p.click(`[data-act=area][data-arg=${k}]`);
  s = await S(p); ok(s.areas.length === 3, 'down to 3 corners');
  await p.click('[data-act=area][data-arg=learn]'); s = await S(p); ok(s.areas.length === 3, 'cannot go below 3 corners');
  ok((await p.textContent('.toast')).includes('at least 3'), 'toast explains the minimum');
  for (const k of ['trips', 'friends', 'health']) await p.click(`[data-act=area][data-arg=${k}]`);
  await p.click('[data-act=own-area]'); await p.fill('#own-n', 'Music'); await p.click('.sheet [data-ok]');
  s = await S(p); const music = s.areas.find(k => k.startsWith('c_')); ok(music && s.custom[music].n === 'Music' && s.areas.length === 7, 'own area added (7 corners)');
  await p.click('[data-act=area][data-arg=partner]'); s = await S(p); ok(s.areas.length === 7, 'cannot go above 7 corners');
  await p.click(`[data-act=area][data-arg=${music}]`);
  await p.click('[data-act=next][data-arg=s_less]');
  await p.click('[data-act=lessk][data-arg=social]'); await p.click('[data-act=lessk][data-arg=tv]');
  await p.click('[data-act=own-less]'); await p.fill('#own-n', 'Online shopping'); await p.click('.sheet [data-ok]');
  s = await S(p); ok(s.less.length === 3 && s.less.every(x => x.aim === null), 'less-of items picked, no aims yet');
  ok(await p.isVisible('text=watching'), 'watching card');
  await p.click('[data-act=less-none]'); s = await S(p); ok(s.less.length === 0, 'nothing for now clears');
  await p.click('[data-act=lessk][data-arg=social]');
  await p.click('[data-act=next][data-arg=s_push]');
  await p.click('[data-act=push][data-arg=brutal]'); await p.click('[data-act=push][data-arg=honest]');
  s = await S(p); ok(s.push === 'honest', 'push level chosen');
  await p.click('[data-act=next][data-arg=s_map]');
  ok((await text(p)).includes('Less of: Social media'), 'scrolling maps to Less of: Social media');
  await p.click('[data-act=map][data-arg=scroll]'); await p.click('.sheet [data-m=selfcare]');
  s = await S(p); ok(s.map.scroll === 'selfcare', 'scrolling remapped to Self-care');
  await p.click('[data-act=map][data-arg=scroll]'); await p.click('.sheet [data-m=social]');
  await p.click('[data-act=sharewith]'); s = await S(p); ok(s.shareWith === false, 'share toggle off'); await p.click('[data-act=sharewith]');
  await p.click('[data-act=next][data-arg=s_paint]');
  await p.click('[data-act=preset][data-arg=student]'); s = await S(p); ok(s.week.preset === 'student' && s.week.wd.some(b => b.a === 'study'), 'student preset');
  await p.click('[data-act=preset][data-arg=office]');
  await p.click('[data-act=workday][data-arg="6"]'); s = await S(p); ok(s.week.workdays.includes(6), 'Saturday made a workday');
  await p.click('[data-act=workday][data-arg="6"]');
  await p.click('[data-act=brush][data-arg=gym]');
  const cell = await p.$('[data-paint="wd|20"][data-dow="1"]'); await cell.scrollIntoViewIfNeeded(); const bb = await cell.boundingBox();
  await p.mouse.move(bb.x + 5, bb.y + 5); await p.mouse.down(); await p.mouse.move(bb.x + 5, bb.y + 18, { steps: 4 }); await p.mouse.up();
  s = await S(p); const wd = s.week.wd; const at = h => (wd.find(b => b.s <= h && b.e > h) || {}).a;
  ok(at(20) === 'gym' && at(21) === 'gym', 'painted 8–10 pm on workdays as workout (drag)');
  ok(Math.abs(wd.reduce((a, b) => a + b.e - b.s, 0) - 24) < 1e-6, 'painted workday still 24 h');
  await p.click('[data-act=brush][data-arg=scroll]'); const c2 = await p.$('[data-paint="wd|20"][data-dow="1"]'); await c2.scrollIntoViewIfNeeded(); const bb2 = await c2.boundingBox();
  await p.mouse.move(bb2.x + 5, bb2.y + 5); await p.mouse.down(); await p.mouse.move(bb2.x + 5, bb2.y + 18, { steps: 4 }); await p.mouse.up();
  s = await S(p); ok((s.week.wd.find(b => b.s <= 20 && b.e > 20) || {}).a === 'scroll', 'painted back to scrolling');
  await p.click('[data-act=next][data-arg=s_st]');
  ok((await text(p)).includes('Android app'), 'browser explains screen time is Android only');
  await p.click('[data-act=next][data-arg=s_shape]');
  ok((await text(p)).match(/Your \d+ free hours a week/), 'free hours headline');
  await p.fill('#o-era', 'my fitness era'); await p.click('[data-act=finish]');
  s = await S(p); ok(s.onboarded && s.onboardedAt === '2026-10-22' && s.eras['2026-Q4'].name === 'my fitness era', 'setup finished');
  ok(s.versions.length === 1 && s.versions[0].name === 'Normal week', 'first shape version saved');
  ok(s.less[0].since === '2026-10-22', 'watching starts today');
  ok(await p.isVisible('#tabs') && (await text(p)).includes('Thursday'), 'Today shows');
  await p.reload(); ok((await text(p)).includes('Looks right'), 'still set up after reload');

  /* ---------------- 2 · Log a day ---------------- */
  section = '2 Log a day';
  ok(await p.isVisible('svg.dial'), 'today dial');
  ok((await text(p)).includes('free today'), 'dial centre shows free hours');
  await p.click('[data-act=go][data-arg=fill]');
  ok((await text(p)).includes('Era filled'), 'what Era filled');
  await p.click('[data-act=swipe]');
  ok(await p.isVisible('#scard'), 'swipe card');
  let n = 0; while ((await p.textContent('#scard .stime')).trim() !== '6–7 pm' && n++ < 12) await yes(p);
  await p.click('[data-act=sw-no]'); ok(await p.isVisible('.sheet .actgrid'), 'changed opens the picker');
  await p.click('.sheet [data-pa=gym]'); await p.click('.sheet [data-pt="to|-"]');
  ok((await p.textContent('.sheet .body')).includes('Counts for Health 0.5 h'), 'picker shows what it counts for');
  await p.click('.sheet [data-psave]');
  let d = await p.evaluate(() => window.__era.draft()); ok(d.blocks.some(b => b.s === 18 && b.e === 18.5 && b.k === 'health'), 'split 6–6:30 pm into Health');
  // keep swiping; the scrolling block asks "worth it?"
  let sawWorth = false;
  for (let i = 0; i < 20 && (await p.$('[data-act=sw-yes]') || await p.$('.sheet')); i++) { if (await p.$('.sheet')) { sawWorth = true; } await yes(p); }
  ok(sawWorth, 'worth it? asked for a less-of block');
  ok(await p.isVisible('#dialsvg'), 'after the last card: dial editor');
  d = await p.evaluate(() => window.__era.draft()); ok(d.blocks.some(b => b.k === 'social' && b.wo === 'no'), '“not worth it” kept on the block');
  // fine-tune with the buttons
  const iFam = d.blocks.findIndex(b => b.k === 'family');
  await p.click(`[data-act=edge][data-arg="${iFam}|+"]`);
  d = await p.evaluate(() => window.__era.draft()); ok(d.blocks.find(b => b.k === 'family').e === 20.5, 'end later by half an hour');
  // drag a handle on the dial
  const before = d.blocks.find(b => b.k === 'family').e;
  await (await p.$('#dialsvg')).scrollIntoViewIfNeeded();
  const h = await p.$(`circle.edge[data-edge="${d.blocks.findIndex(b => b.k === 'family')}"]`); const hb = await h.boundingBox(); const db = await (await p.$('#dialsvg')).boundingBox();
  const cx = db.x + db.width / 2, cy = db.y + db.height / 2, rr = db.width * 90 / 240;
  const ang = t => t / 24 * 2 * Math.PI - Math.PI / 2;
  await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await p.mouse.down();
  await p.mouse.move(cx + rr * Math.cos(ang(21)), cy + rr * Math.sin(ang(21)), { steps: 6 }); await p.mouse.up();
  d = await p.evaluate(() => window.__era.draft()); const famEnd = (d.blocks.find(b => b.k === 'family') || {}).e;
  ok(famEnd !== before && Math.abs(famEnd - 21) <= 0.5, 'dragging a handle moves the edge (' + before + ' → ' + famEnd + ')');
  ok(sum24(d.blocks), 'still exactly 24 h after dragging');
  // tap an arc to change it
  const iSelf = d.blocks.findIndex(b => b.k === 'selfcare');
  await p.click('#blist [data-act=pick][data-arg="' + iSelf + '"]'); await p.click('.sheet [data-pa=study]'); await p.click('.sheet [data-psave]');
  d = await p.evaluate(() => window.__era.draft()); ok(d.blocks.some(b => b.k === 'learn'), 'block changed to Learning from the list');
  await p.fill('#d-good', 'First run in weeks'); await p.click('[data-act=energy][data-arg=high]');
  await p.click('[data-act=save-draft]');
  s = await S(p); let lg = s.logs['2026-10-22'];
  ok(lg && sum24(lg.blocks) && lg.good === 'First run in weeks' && lg.energy === 'high' && lg.src === 'edited', 'day saved, 24 h, good thing and energy');
  ok((await text(p)).includes('Today ✓'), 'Today shows logged');
  await p.reload(); s = await S(p); ok(s.logs['2026-10-22'].blocks.some(b => b.k === 'learn'), 'logged day persists');
  // Looks right on the next day
  await setTime(p, '2026-10-23T22:00:00+05:30');
  await p.click('[data-act=looks][data-arg="2026-10-23"]');
  s = await S(p); ok(s.logs['2026-10-23'] && s.logs['2026-10-23'].src === 'auto' && sum24(s.logs['2026-10-23'].blocks), 'Looks right logs the usual day');
  // leaving an edited day asks first
  await p.click('[data-act=go][data-arg=dial]'); await p.click('[data-act=edge][data-arg="0|+"]'); await p.click('[data-act=back]');
  ok(await p.isVisible('.sheet >> text=Save this day?'), 'unsaved day asks before leaving');
  await p.click('.sheet [data-yes]'); s = await S(p); ok(s.logs['2026-10-23'].src === 'edited' && s.logs['2026-10-23'].blocks[0].e === 7.5, 'Save from the prompt keeps the change');
  await p.click('[data-act=go][data-arg=dial]'); await p.click('[data-act=edge][data-arg="0|+"]'); await p.click('[data-act=back]'); await p.click('.sheet [data-no]');
  s = await S(p); ok(s.logs['2026-10-23'].blocks[0].e === 7.5, 'Discard from the prompt drops the change');

  /* ---------------- 2b · Two things at once ---------------- */
  section = '2b Two things at once';
  await setTime(p, '2026-10-24T22:00:00+05:30'); // Saturday
  await p.click('[data-act=go][data-arg=fill]'); await p.click('[data-act=go][data-arg=dial]');
  d = await p.evaluate(() => window.__era.draft()); const iSc = d.blocks.findIndex(b => b.k === 'social');
  await p.click(`#dialsvg .arc[data-arc="${iSc}"]`, { force: true });
  ok(await p.isVisible('.sheet .actgrid'), 'tapping the dial opens the picker');
  await p.click('.sheet [data-pa=movie]'); await p.click('.sheet [data-pw=family]');
  ok((await p.textContent('.sheet .body')).match(/Counts for Family.*also Self-care \(shared\)/), 'movie with family counts for Family, shared Self-care');
  await p.click('.sheet [data-psave]'); await p.click('[data-act=save-draft]');
  s = await S(p); const sat = s.logs['2026-10-24'].blocks.find(b => b.a === 'movie');
  ok(sat && sat.k === 'family' && sat.sh === 'selfcare' && sat.w === 'family', 'saved with who and shared area');
  await p.click('[data-tab=week]');
  ok((await text(p)).includes('shared'), 'week shows shared hours'); ok(await p.isVisible('.legend >> text=Shared'), 'shared legend on the shape');

  /* ---------------- 2c · Too much red ---------------- */
  section = '2c Too much red';
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('era-v2')); s.less[0].aim = 4; localStorage.setItem('era-v2', JSON.stringify(s)); });
  await p.click('[data-tab=today]'); await p.reload();
  ok(await p.isVisible('.redtop'), 'over the aim: red takes the top of Today (Honest)');
  ok((await p.textContent('.redtop')).includes('over your aim of 4'), 'red card says how much over');
  ok(await p.isVisible('text=Your shape fades'), 'faded shape explained');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('era-v2')); s.push = 'gentle'; localStorage.setItem('era-v2', JSON.stringify(s)); }); await p.reload();
  ok(!(await p.isVisible('.redtop')), 'Gentle: no red card');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('era-v2')); s.push = 'brutal'; localStorage.setItem('era-v2', JSON.stringify(s)); }); await p.reload();
  ok((await p.textContent('.redtop')).includes("you didn't have"), 'Brutal: turns hours into what they cost');
  await p.click('[data-tab=week]'); ok(await p.isVisible('.redtop.slim'), 'Brutal: red banner on Week too');
  await p.click('[data-tab=era]'); ok(await p.isVisible('.redtop.slim'), 'Brutal: red banner on Era too');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('era-v2')); s.push = 'honest'; localStorage.setItem('era-v2', JSON.stringify(s)); });
  // Sunday: swap the evening scroll for a run → reclaimed
  await setTime(p, '2026-10-25T21:00:00+05:30');
  await p.click('[data-act=go][data-arg=fill]'); await p.click('[data-act=go][data-arg=dial]');
  d = await p.evaluate(() => window.__era.draft()); const iS2 = d.blocks.findIndex(b => b.k === 'social');
  await p.click(`#blist [data-act=pick][data-arg="${iS2}"]`); await p.click('.sheet [data-pa=gym]'); await p.click('.sheet [data-psave]'); await p.click('[data-act=save-draft]');
  ok((await text(p)).match(/\+3 h reclaimed/), 'reclaimed hours celebrated (+3 h)');
  ok((await text(p)).includes('Reclaimed this era'), 'reclaimed this era total');

  /* ---------------- 3 · Catch up and welcome back ---------------- */
  section = '3 Catch up';
  await setTime(p, '2026-10-29T21:00:00+05:30'); // Thu, 26–28 missed
  ok((await text(p)).includes('3 days not logged'), 'missed days card');
  await p.click('[data-act=go][data-arg=catchup]');
  await p.click('[data-act=looks][data-arg="2026-10-26"]'); s = await S(p); ok(!!s.logs['2026-10-26'], 'one day confirmed');
  await p.click('[data-act=swipe][data-arg="2026-10-27"]'); for (let i = 0; i < 20 && (await p.$('[data-act=sw-yes]') || await p.$('.sheet')); i++) await yes(p); await p.click('[data-act=save-draft]');
  s = await S(p); ok(!!s.logs['2026-10-27'], 'one day swiped and saved');
  await p.click('[data-act=go][data-arg=catchup]'); await p.click('[data-act=looks-all]'); s = await S(p); ok(!!s.logs['2026-10-28'], 'all look right');
  await setTime(p, '2026-11-05T21:00:00+05:30');
  ok((await text(p)).includes('Welcome back'), 'welcome back after a few days away');
  ok(!(await p.isVisible('.redtop')), 'no red waiting on the way back: aims start again from today');
  await p.click('[data-act=skip-missed]'); ok(!(await text(p)).includes('Welcome back') && !(await text(p)).includes('not logged'), 'skip to today clears the backlog');

  /* ---------------- 4 · Vibe check ---------------- */
  section = '4 Vibe check';
  await p.click('[data-tab=week]'); await p.click('[data-act=wk][data-arg="-7"]'); await p.click('[data-act=wk][data-arg="-7"]'); // week of 19 Oct
  ok((await text(p)).includes('19 Oct'), 'past week');
  await p.click('[data-act=go][data-arg=receipt]');
  ok(await p.isVisible('.receipt'), 'receipt');
  ok((await p.textContent('.receipt')).includes('not worth it'), 'receipt counts “not worth it”');
  await p.click('[data-act=go][data-arg=vibe]');
  await p.fill('#r-well', 'Ran twice'); await p.press('#r-well', 'Tab');
  await p.click('[data-act=blocker][data-arg="Too tired"]'); await p.fill('#r-chg', 'Phone in the hall'); await p.press('#r-chg', 'Tab');
  await p.click('[data-act=go][data-arg=nextweek]');
  await p.click('[data-act=quest-add][data-arg=nextweek]'); await p.fill('#q-title', 'Dinner with Rohan'); await p.click('.sheet [data-qa=friends]'); await p.click('.sheet [data-qsave]');
  ok((await text(p)).includes('Dinner with Rohan'), 'side quest added for next week');
  await p.click('[data-act=save-retro]');
  s = await S(p); const R = s.retros['2026-10-19']; ok(R && R.well === 'Ran twice' && R.blockers.includes('Too tired') && R.change === 'Phone in the hall' && R.at, 'retro saved');
  ok((await text(p)).includes('Week saved'), 'week saved screen');
  const q1 = s.quests.find(x => x.title === 'Dinner with Rohan'); ok(q1 && q1.week === '2026-10-26' && q1.area === 'friends', 'quest lands in next week');

  /* ---------------- 4b · Observe, decide, shift ---------------- */
  section = '4b Observe decide shift';
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('era-v2')); s.less[0].aim = null; s.less[0].since = '2026-10-20'; localStorage.setItem('era-v2', JSON.stringify(s)); });
  await p.reload(); await p.click('[data-tab=week]');
  ok((await text(p)).includes('2 weeks of watching'), 'after 2 weeks: see what Era noticed');
  await p.click('[data-act=go][data-arg=observe]');
  ok((await text(p)).includes('Social media'), 'noticed social media');
  await p.click('[data-act=decide][data-arg=social]');
  await p.click('[data-act=dec-swap][data-arg=health]'); await p.fill('#dec-id', "I'm someone who moves every evening");
  await p.click('[data-act=go][data-arg=decide2]');
  await p.click('[data-act=dec-pace][data-arg=bold]'); await p.click('[data-act=dec-target][data-arg="t|-"]');
  await p.fill('#dec-stack', 'After dinner, walk first'); await p.fill('#dec-tiny', 'Shoes on');
  await p.click('[data-act=dec-start]');
  s = await S(p); const it = s.less[0];
  ok(it.ladder && it.ladder.steps.length === 2 && it.swap === 'health' && it.identity.includes('moves') && it.stack && it.tiny && it.pace === 'bold', 'ladder set with swap, identity, stack, 2-minute version');
  ok(it.target < it.base, 'aim below the baseline');
  ok(await p.isVisible('text=Ladder · Social media'), 'ladder card on Week');
  ok(s.versions[0].name.startsWith('Ladder'), 'ladder saved as a shape version');

  /* ---------------- 5 · Change my week (beads) ---------------- */
  section = '5 Change my week';
  await p.click('[data-tab=era]'); await p.click('[data-act=go][data-arg=beads]');
  for (let i = 0; i < 3; i++) { await p.click('.jar[data-jar=social]'); await p.click('.jar[data-jar=learn]'); }
  ok((await text(p)).includes('Social media → Learning, 3 h a week'), 'three beads moved');
  await p.click('.jar[data-jar=health]'); ok((await p.textContent('.toast')).includes('non-negotiable'), 'Health is locked');
  await p.fill('#bd-note', 'Guitar Tue and Thu'); await p.click('[data-act=bead-save]');
  s = await S(p); let mv = s.moves.find(m => m.from === 'social' && m.to === 'learn'); ok(mv && mv.h === 3 && mv.note === 'Guitar Tue and Thu' && mv.q === '2026-Q4', 'change saved');
  // drag a bead
  await (await p.$('.jars')).scrollIntoViewIfNeeded();
  const j1 = await (await p.$('.jar[data-jar=social]')).boundingBox(), j2 = await (await p.$('.jar[data-jar=friends]')).boundingBox();
  await p.mouse.move(j1.x + j1.width / 2, j1.y + 40); await p.mouse.down(); await p.mouse.move(j2.x + j2.width / 2, j2.y + 40, { steps: 5 }); await p.mouse.up();
  ok((await text(p)).includes('Social media → Friends, 1 h'), 'dragging a bead between jars');
  await p.click('[data-tab=today]'); ok(await p.isVisible('.sheet >> text=Save this change?'), 'unsaved beads ask before leaving');
  await p.click('.sheet [data-yes]'); s = await S(p); ok(s.moves.some(m => m.to === 'friends' && m.h === 1), 'saved from the prompt');
  await p.click('[data-tab=era]'); await p.click('[data-act=go][data-arg=beads]');
  await p.click(`[data-act=mv][data-arg="${mv.id}|+"]`); s = await S(p); ok(s.moves.find(m => m.id === mv.id).h === 3.5, 'change +');
  await p.click(`[data-act=mv-rm][data-arg="${s.moves.find(m => m.to === 'friends').id}"]`); s = await S(p); ok(!s.moves.some(m => m.to === 'friends'), 'change removed');
  const pw = await p.evaluate(() => window.__era.planWeek('2026-Q4')); const tw = await p.evaluate(() => window.__era.tmplWeek());
  ok(Math.abs((pw.learn || 0) - (tw.learn || 0) - 3.5) < 1e-6, 'era plan includes the change');

  /* ---------------- 6 · Lock in ---------------- */
  section = '6 Lock in';
  await p.click('[data-act=back]'); await p.click('[data-act=go][data-arg=lock1]');
  await p.click('[data-act=lock-next][data-arg=lock2]'); ok((await p.textContent('.toast')).includes('Name the goal'), 'needs a name');
  await p.fill('#g-title', 'Exam prep'); await p.click('[data-act=g-total][data-arg="t|-"]'); // 25 h
  await p.click('[data-act=g-area][data-arg=learn]');
  await p.click('[data-act=lock-next][data-arg=lock2]');
  s = await S(p);
  await p.click('[data-act=lock-next][data-arg=lock3]'); ok((await p.textContent('.toast')).includes('Choose where'), 'needs the hours');
  const per = 25 / Math.ceil(28 / 7); // 6.25 h a week
  for (let i = 0; i < 9; i++) await p.click('.jar[data-jar=social]');
  for (let i = 0; i < 4; i++) await p.click('[data-act=g-src][data-arg="family|+"]');
  await p.click('[data-act=lock-next][data-arg=lock3]');
  await p.fill('#g-why', 'Analyst role'); await p.click('[data-act=lock-save]');
  s = await S(p); const g = s.goals[0]; ok(g && g.title === 'Exam prep' && g.total === 25 && g.why === 'Analyst role' && Object.values(g.src).reduce((a, b) => a + b, 0) >= per - 0.01, 'lock-in saved with sources');
  ok(!('health' in g.src), 'locked areas not taken');
  await p.click('[data-tab=today]'); ok((await text(p)).includes('Exam prep'), 'lock-in card on Today');
  await p.click('[data-act=goal-hour]'); s = await S(p); ok(s.logs['2026-11-05'].blocks.some(b => b.goal === g.id && b.e - b.s === 1), 'log 1 h of the goal');
  await setTime(p, '2026-12-04T09:30:00+05:30');
  ok((await text(p)).includes('is over'), 'lock-in over card');
  await p.click(`[data-act=goal-end][data-arg="${g.id}|part"]`); s = await S(p); ok(s.goals[0].closed && s.goals[0].result === 'part', 'lock-in closed as partly');
  await setTime(p, '2026-11-05T21:00:00+05:30');

  /* ---------------- 7 · Weekends and side quests ---------------- */
  section = '7 Weekends';
  await p.click('[data-tab=era]'); ok(await p.isVisible('.dots'), 'weekend dots on Era');
  await p.click('[data-act=go][data-arg=horizon]');
  await p.click('.wdot[data-sat="2026-11-07"]'); await p.fill('#q-title', 'Gokarna long weekend'); await p.click('.sheet [data-qsave]');
  s = await S(p); let qg = s.quests.find(x => x.title === 'Gokarna long weekend'); ok(qg && qg.date === '2026-11-07' && qg.area === 'trips', 'weekend claimed');
  ok(await p.isVisible('.wdot.claimed[data-sat="2026-11-07"]'), 'dot shows claimed');
  await p.click('.wdot[data-sat="2026-11-07"]'); await p.click('.sheet [data-s$="|moved"]'); s = await S(p); qg = s.quests.find(x => x.id === qg.id); ok(qg.date === '2026-11-14' && qg.moved === 1, 'moved to the next free weekend');
  await p.click('[data-act=claim-next]'); await p.fill('#q-title', 'College friends'); await p.click('.sheet [data-qa=friends]'); await p.click('.sheet [data-qsave]');
  s = await S(p); ok(s.quests.some(x => x.title === 'College friends' && x.date === '2026-11-07'), 'claim the next free weekend');
  await p.click('[data-act=go][data-arg=quests]'); ok((await text(p)).includes('Gokarna') && (await text(p)).includes('College friends'), 'side quests list');
  await p.click(`[data-act=quest][data-arg="${qg.id}|done"]`); s = await S(p); ok(s.quests.find(x => x.id === qg.id).status === 'done', 'done');
  await p.click('[data-act=quest-add][data-arg=week]'); await p.fill('#q-title', 'Call Nani'); await p.click('.sheet [data-qw=era]'); await p.click('.sheet [data-close]');
  s = await S(p); ok(s.quests.some(x => x.title === 'Call Nani' && x.when === 'era'), 'closing the sheet saves a quest with a title');
  // any side quest can take a weekend or a date, and can be edited later
  await p.click('[data-act=quest-add][data-arg=week]'); await p.fill('#q-title', 'Lonavala drive'); await p.click('.sheet [data-qw=weekend]'); await p.click('.sheet [data-qs="2026-11-21"]'); await p.click('.sheet [data-qsave]');
  s = await S(p); ok(s.quests.some(x => x.title === 'Lonavala drive' && x.date === '2026-11-21'), 'any side quest can claim a weekend');
  await p.click('[data-act=quest-add][data-arg=week]'); await p.fill('#q-title', 'Dentist'); await p.click('.sheet [data-qw=day]'); await p.fill('#q-day', '2026-11-11'); await p.click('.sheet [data-qsave]');
  s = await S(p); const den = s.quests.find(x => x.title === 'Dentist'); ok(den && den.day === '2026-11-11' && !den.date, 'or a date');
  await p.click('[data-act=quest-add][data-arg=week]'); await p.fill('#q-title', 'Picnic'); await p.click('.sheet [data-qw=day]'); await p.fill('#q-day', '2026-11-29'); await p.click('.sheet [data-qsave]');
  s = await S(p); const pic = s.quests.find(x => x.title === 'Picnic'); ok(pic.date === '2026-11-28' && pic.day === '2026-11-29' && !pic.to, 'a Sunday date takes only that Sunday');
  const nani = s.quests.find(x => x.title === 'Call Nani');
  await p.click(`[data-act=quest-edit][data-arg="${nani.id}"]`); await p.click('.sheet [data-qw=weekend]'); await p.click('.sheet [data-qs="2026-11-21"]');
  ok((await p.textContent('.toast')).includes('Already planned'), 'a planned weekend cannot be taken twice');
  await p.click('.sheet [data-qs="2026-12-05"]'); await p.click('.sheet [data-qsave]');
  s = await S(p); const n2 = s.quests.find(x => x.id === nani.id); ok(n2.date === '2026-12-05' && n2.title === 'Call Nani' && s.quests.filter(x => x.title === 'Call Nani').length === 1, 'edit a side quest to link it to a weekend');
  await p.click('[data-tab=today]');
  ok((await p.textContent('.stats .stat:nth-child(2)')).includes('3½') && (await p.textContent('.stats')).includes('free weekends left this era'), 'free weekends this era go down as you plan them (8 left, 4½ planned: the Picnic takes only Sunday)');
  await p.click('[data-tab=era]'); ok((await text(p)).includes('8 weekends left · 4½ planned'), 'Era shows weekends planned, in halves');

  // A weekend is Saturday and Sunday, each with a first and a second half
  await p.click('[data-act=go][data-arg=horizon]');
  ok((await p.getAttribute('.wdot[data-sat="2026-11-28"]', 'aria-label')).includes('Saturday free, Sunday Picnic') || (await p.getAttribute('.wdot[data-sat="2026-11-28"]', 'aria-label')).includes('Saturday free; Sunday Picnic'), 'a dot says which day is planned');
  ok(await p.evaluate(() => { const d = document.querySelector('.wdot[data-sat="2026-11-28"]'); return !d.querySelector('.wh.l.t.on') && d.querySelector('.wh.r.t.on') && d.querySelector('.wh.r.b.on'); }), 'only the Sunday half of the dot is coloured');
  await p.click('.wdot[data-sat="2026-11-28"]'); ok((await text(p)).includes('Picnic') && await p.isVisible('.sheet [data-free="sat|"]'), 'a half-planned weekend offers the free Saturday');
  await p.click('.sheet [data-free="sat|"]'); await p.fill('#q-title', 'Cycling'); await p.click('.sheet [data-qa=health]');
  ok(await p.getAttribute('.sheet [data-qside=sat]', 'aria-pressed') === 'true' && await p.isVisible('.sheet [data-qpart]'), 'it opens on Saturday, with first and second half');
  await p.click('.sheet [data-qpart=am]'); ok(!(await p.isVisible('.sheet [data-qaway]')), 'a half day is never a trip');
  await p.click('.sheet [data-qsave]');
  s = await S(p); const cyc = s.quests.find(x => x.title === 'Cycling'); ok(cyc && cyc.day === '2026-11-28' && cyc.part === 'am' && !cyc.away, 'Saturday first half saved');
  await p.click('.wdot[data-sat="2026-11-28"]'); ok(await p.isVisible('.sheet [data-free="sat|pm"]') && !(await p.isVisible('.sheet [data-free="sun|"]')), 'then only the Saturday second half is left');
  await p.click('.sheet [data-free="sat|pm"]'); await p.fill('#q-title', 'Movie with Rohan'); await p.click('.sheet [data-qa=friends]');
  ok(await p.getAttribute('.sheet [data-qpart=pm]', 'aria-pressed') === 'true' && (await p.getAttribute('.sheet [data-qpart=am]', 'class') || '').includes('busy'), 'the taken half is crossed out');
  await p.click('.sheet [data-qpart=am]'); ok((await p.textContent('.toast')).includes('Cycling'), 'and cannot be taken twice');
  await p.click('.sheet [data-qsave]'); s = await S(p); ok(s.quests.find(x => x.title === 'Movie with Rohan').part === 'pm', 'Saturday second half saved');
  ok(await p.evaluate(() => document.querySelectorAll('.wdot[data-sat="2026-11-28"] .wh.on').length === 4), 'all four slots of that weekend are planned');
  // Trips: dates from first to last day; logging pauses on them
  await p.click('[data-act=go][data-arg=quests]');
  await p.click('[data-act=quest-add][data-arg=week]'); await p.fill('#q-title', 'Goa'); await p.click('.sheet [data-qa=trips]'); await p.click('.sheet [data-qw=day]');
  await p.fill('#q-day', '2026-12-17'); await p.fill('#q-to', '2026-12-21');
  ok(await p.getAttribute('.sheet [data-qaway]', 'aria-pressed') === 'true', 'a trip in Trips is a trip by default');
  await p.click('.sheet [data-qsave]'); s = await S(p); const goa = s.quests.find(x => x.title === 'Goa');
  ok(goa && goa.day === '2026-12-17' && goa.to === '2026-12-21' && goa.away === true && goa.date === '2026-12-19', 'trip saved with its first and last day');
  ok((await text(p)).includes('Thu 17 – Mon 21 Dec') && (await text(p)).includes('Trips'), 'trip listed with its dates');
  await p.click('[data-act=quest-add][data-arg=week]'); await p.fill('#q-title', 'Board games'); await p.click('.sheet [data-qw=day]'); await p.fill('#q-day', '2026-12-20'); await p.click('.sheet [data-qsave]');
  ok((await p.textContent('.toast')).includes('Goa'), 'a trip weekend cannot be taken by something else');
  await p.click('.sheet [data-close]'); s = await S(p); ok(!s.quests.some(x => x.title === 'Board games' && x.status === 'open' && x.day === '2026-12-20'), 'nothing double-booked');
  s.quests = s.quests.filter(x => x.title !== 'Board games'); await p.evaluate(v => localStorage.setItem('era-v2', JSON.stringify(v)), s); await p.reload();
  await p.click('[data-tab=today]'); ok((await p.textContent('.stats .stat:nth-child(2)')).includes('2') && !(await p.textContent('.stats .stat:nth-child(2)')).includes('½'), 'free weekends this era: 2 (6 of 8 planned)');
  // On the trip: nothing to log, no red, days left out of the numbers
  await setTime(p, '2026-12-18T20:00:00+05:30');
  ok(await p.isVisible('.card.trip') && (await text(p)).includes('day 2 of 5') && !(await p.isVisible('[data-act=looks][data-arg="2026-12-18"]')), 'Today on a trip: no dial to confirm');
  ok(!(await p.isVisible('.redtop')), 'no red on a trip');
  ok(await p.evaluate(() => Object.keys(window.__era.actualRange('2026-12-17', '2026-12-18')).length === 0), 'trip days count for nothing');
  await p.click('[data-tab=week]'); ok((await text(p)).includes('On a trip · Goa') && (await text(p)).includes('2 on a trip, not counted'), 'Week shows trip days, not counted');
  await p.click('[data-tab=today]'); if (await p.isVisible('[data-act=go][data-arg=catchup]')) { await p.click('[data-act=go][data-arg=catchup]'); ok(!(await text(p)).includes('Thu 17 Dec'), 'trip days are not missed days'); await p.click('[data-act=back]'); } else ok(true, 'trip days are not missed days');
  // Back: one energy check
  await setTime(p, '2026-12-22T09:00:00+05:30');
  ok((await text(p)).includes('Back from a trip') && await p.isVisible('[data-act=trip-energy]'), 'energy check after the trip');
  await p.click(`[data-act=trip-energy][data-arg="${goa.id}|2"]`); s = await S(p); const g2 = s.quests.find(x => x.id === goa.id);
  ok(g2.back.e === 2 && g2.status === 'done', 'energy saved, trip marked done');
  ok(!(await text(p)).includes('Back from a trip'), 'asked only once');
  await p.click('[data-tab=era]'); await p.click('[data-act=go][data-arg=horizon]'); await p.click('[data-act=go][data-arg=quests]'); ok((await text(p)).includes('⚡ recharged'), 'the answer shows on the trip');
  // Back early
  await p.click('[data-act=quest-add][data-arg=week]'); await p.fill('#q-title', 'Pondicherry'); await p.click('.sheet [data-qa=trips]'); await p.click('.sheet [data-qw=day]'); await p.fill('#q-day', '2026-12-26'); await p.fill('#q-to', '2026-12-29'); await p.click('.sheet [data-qsave]');
  await setTime(p, '2026-12-27T10:00:00+05:30'); await p.click('[data-act=trip-back]');
  s = await S(p); const po = s.quests.find(x => x.title === 'Pondicherry'); ok(po.day === '2026-12-26' && !po.to, 'back early ends the trip yesterday');
  ok(!(await p.isVisible('.card.trip')) && await p.isVisible('[data-act=looks]') && (await text(p)).includes('Back from a trip'), 'today counts again, with the energy check');
  await p.click('[data-act=quest][data-arg="' + po.id + '|dropped"]'); s = await S(p); ok(s.quests.find(x => x.id === po.id).status === 'dropped', 'or “We didn\'t go” drops it');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('era-v2')); s.returned = null; s.lastOpen = '2026-11-05'; localStorage.setItem('era-v2', JSON.stringify(s)); });
  await setTime(p, '2026-11-05T21:00:00+05:30');

  /* ---------------- 8 · Era retro ---------------- */
  section = '8 Era retro';
  await p.click('[data-tab=era]'); await p.click('[data-act=go][data-arg=retro]');
  ok(await p.isVisible('svg.shape'), 'retro shape');
  await p.fill('#e-keep', 'Morning runs'); await p.press('#e-keep', 'Tab'); await p.fill('#e-change', 'More trips'); await p.press('#e-change', 'Tab');
  await p.click('[data-act=go][data-arg=newera]');
  await p.fill('#ne-name', 'my travel era'); await p.click('[data-act=ne-start]');
  s = await S(p); ok(s.eras['2026-Q4'].keep === 'Morning runs' && s.eras['2026-Q4'].change === 'More trips', 'retro saved');
  ok(s.eras['2027-Q1'].name === 'my travel era', 'next era named');
  ok(s.moves.some(m => m.q === '2027-Q1' && m.from === 'social' && m.to === 'learn'), 'next era starts from the last plan');
  await p.click('[data-act=go][data-arg=pasteras]'); ok(await p.isVisible('.card.mini'), 'past eras');
  await p.click('.card.mini[data-q="2026-Q3"]'); ok((await text(p)).includes('Jul – Sep 2026'), 'retro for a past era');
  await p.fill('#e-keep', 'Old keep'); await p.press('#e-keep', 'Tab'); s = await S(p); ok(s.eras['2026-Q3'].keep === 'Old keep', 'past era retro saved');

  /* ---------------- 9 · Me ---------------- */
  section = '9 Me';
  await p.click('[data-tab=me]'); ok((await text(p)).includes('v0.') || (await text(p)).includes('v1.'), 'version shown');
  await p.click('[data-act=go][data-arg=m_paint]'); ok(await p.isVisible('.paint'), 'repaint the week');
  await p.click('[data-act=back]'); await p.click('[data-act=go][data-arg=m_push]'); await p.click('[data-act=push][data-arg=gentle]'); s = await S(p); ok(s.push === 'gentle', 'push level');
  await p.click('[data-act=back]'); await p.click('[data-act=go][data-arg=m_areas]');
  await p.click('[data-act=protect][data-arg=family]'); s = await S(p); ok(s.protect.includes('family'), 'non-negotiable added');
  await p.click('[data-act=back]'); await p.click('[data-act=go][data-arg=m_versions]');
  ok((await p.$$('.card.row')).length >= 3, 'several shape versions');
  const nv = (await S(p)).versions.find(v => v.name === 'Normal week');
  await p.click(`[data-act=version][data-arg="${nv.id}"]`); await p.click('.sheet [data-yes]');
  s = await S(p); ok(!s.moves.some(m => m.q === '2026-Q4') && s.versions[0].name.startsWith('Before switching'), 'switched back to the normal week, previous one saved');
  await p.click('[data-act=back]'); await p.click('[data-act=go][data-arg=m_remind]');
  await p.fill('[data-in=rem-daily]', '22:15'); await p.press('[data-in=rem-daily]', 'Tab'); s = await S(p); ok(s.remind.daily === '22:15', 'reminder time');
  await p.click('[data-act=back]'); await p.click('[data-act=go][data-arg=m_names]');
  await p.fill('#lbl-week', 'Sunday reset'); await p.press('#lbl-week', 'Tab'); await p.click('[data-tab=week]'); ok((await text(p)).includes('sunday reset') || (await text(p)).includes('Sunday reset'), 'renamed label shows');
  await p.click('[data-tab=me]'); await p.click('[data-act=go][data-arg=m_backup]');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=export]')]);
  const backupPath = await dl.path(); const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8')); ok(backup.v === 2 && backup.logs['2026-10-22'], 'backup file');
  await p.click('[data-act=reset]'); await p.click('.sheet [data-no]');
  ok(await p.isVisible('text=See where your week goes'), 'start over shows setup');
  ok(await p.evaluate(() => !localStorage.getItem('era-v2') || !JSON.parse(localStorage.getItem('era-v2')).onboarded), 'data deleted');
  // restore: finish a quick setup, then load the file
  await onboard(p); await p.click('[data-tab=me]'); await p.click('[data-act=go][data-arg=m_backup]');
  fs.writeFileSync('/tmp/era-backup-test.json', JSON.stringify(backup));
  await p.setInputFiles('#m-file', '/tmp/era-backup-test.json'); await p.waitForTimeout(200);
  s = await S(p); ok(s.logs['2026-10-22'] && s.eras['2027-Q1'] && s.labels.week === 'Sunday reset', 'restored from the backup');

  /* ---------------- 10 · Rough week ---------------- */
  section = '10 Rough week';
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('era-v2')); s.push = 'honest'; s.less[0].ladder = null; s.less[0].aim = 1; s.returned = null; localStorage.setItem('era-v2', JSON.stringify(s)); }); await p.reload();
  await p.click('[data-tab=today]'); ok(await p.isVisible('.redtop'), 'over the aim before pausing');
  await p.click('[data-tab=me]'); await p.click('[data-act=go][data-arg=m_pause]'); await p.click('[data-act=pause-len][data-arg="7"]'); await p.click('[data-act=pause]');
  s = await S(p); ok(s.pause && s.pause.until === '2026-11-11', 'paused for a week');
  await p.click('[data-tab=today]'); ok(!(await p.isVisible('.redtop')) && (await text(p)).includes('paused'), 'no red while paused, banner instead');
  await p.click('[data-tab=week]'); await p.click('[data-act=go][data-arg=receipt]'); ok(!(await p.isVisible('.receipt')) && (await text(p)).includes('What went well'), 'no receipt while paused');
  await p.click('[data-act=back]'); await p.click('[data-tab=today]'); await p.click('[data-act=resume]'); s = await S(p); ok(!s.pause, 'resumed');
  ok(errs.length === 0, 'no page errors so far: ' + errs.join(' | '));
  await p.context().close();

  /* ---------------- 11 · Screen time (Android) ---------------- */
  section = '11 Screen time';
  const slots = (from, to, min) => { const a = new Array(48).fill(0); for (let i = from * 2; i < to * 2; i++) a[i] = min; return a; };
  const ST = { apps: [{ pkg: 'com.instagram.android', label: 'Instagram', hint: 'social', min: 100 }, { pkg: 'com.google.android.youtube', label: 'YouTube', hint: 'video', min: 30 }, { pkg: 'com.amazon.kindle', label: 'Kindle', hint: '', min: 50 }],
    slots: { 'com.instagram.android': slots(19, 21, 25).map((v, i) => i === 37 ? 30 : v), 'com.google.android.youtube': slots(21, 22, 15), 'com.amazon.kindle': slots(22, 23, 25) } };
  p = await newPage({ native: true, init: { fn: st => { if (!localStorage.getItem('__st')) localStorage.setItem('__st', JSON.stringify({ '2026-10-22': st })); }, arg: ST } });
  await p.click('[data-act=next][data-arg=s_areas]'); await p.click('[data-act=area][data-arg=selfcare]');
  await p.click('[data-act=next][data-arg=s_less]'); await p.click('[data-act=lessk][data-arg=social]');
  for (const a of ['s_push', 's_map', 's_paint', 's_st']) await p.click(`[data-act=next][data-arg=${a}]`);
  ok(await p.isVisible('[data-act=st-allow]'), 'allow usage access button');
  await p.click('[data-act=st-allow]'); let calls = await p.evaluate(() => JSON.parse(localStorage.getItem('__calls') || '{}')); ok(calls.stOpen, 'opens Android settings');
  await p.evaluate(() => { localStorage.setItem('__granted', '1'); window.eraResume(); });
  s = await S(p); ok(s.st.on, 'screen time on after granting');
  await p.click('[data-act=next][data-arg=s_shape]'); await p.fill('#o-era', 'phone era'); await p.click('[data-act=finish]');
  ok(await p.isVisible('text=Screen time today'), 'live screen time card');
  ok((await text(p)).includes('3 h') && (await text(p)).includes('of 2 h aim'), 'total vs aim (3 h of 2 h)');
  ok((await text(p)).includes('counts for Learning'), 'Kindle counts for Learning, not against you');
  ok((await text(p)).includes('and your phone'), 'dial filled from the phone');
  await p.click('[data-act=go][data-arg=fill]');
  ok((await text(p)).includes('Screen time'), 'rows sourced from screen time');
  ok((await text(p)).includes('Instagram'), 'phone rows name the app');
  d = await p.evaluate(() => window.__era.draft()); ok(d.blocks.some(b => b.k === 'social' && b.src === 'phone' && b.s === 19), '7–9 pm became Social media from the phone');
  ok(d.blocks.some(b => b.k === 'learn' && b.src === 'phone'), 'Kindle time counted as Learning');
  await p.click('[data-act=save-draft]');
  // a logged Health block the phone disagrees with
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('era-v2')); const bl = s.logs['2026-10-22'].blocks; const i = bl.findIndex(b => b.s === 19); bl[i] = Object.assign({}, bl[i], { k: 'health', a: 'gym', src: 'edited' }); localStorage.setItem('era-v2', JSON.stringify(s)); });
  await p.reload(); await p.click('[data-act=go][data-arg=dial]');
  ok(await p.isVisible('.card.mism'), 'mismatch check on a logged block');
  await p.click('[data-act=mismatch]'); await p.click('.sheet [data-split]');
  d = await p.evaluate(() => window.__era.draft()); ok(d.blocks.some(b => b.k === 'social' && b.src === 'phone') && d.blocks.some(b => b.k === 'health'), 'split into Health and Social media');
  await p.click('[data-act=save-draft]');
  await p.click('[data-tab=week]'); ok(await p.isVisible('.stbars'), 'screen time chart on Week');
  await p.click('[data-tab=me]'); await p.click('[data-act=go][data-arg=m_st]'); await p.click('[data-act=st-aim][data-arg="a|+"]'); s = await S(p); ok(s.st.aim === 2.5, 'screen time aim');
  await p.click('[data-act=go][data-arg=m_map]'); await p.click('[data-act=appmap][data-arg="com.amazon.kindle"]'); await p.click('.sheet [data-m=""]');
  s = await S(p); ok(s.st.map['com.amazon.kindle'] === '', 'app mapped to neutral');

  /* ---------------- 12 · Home screen and notification ---------------- */
  section = '12 Home screen';
  calls = await p.evaluate(() => JSON.parse(localStorage.getItem('__calls') || '{}'));
  const w = (calls.widget || []).slice(-1)[0];
  ok(w && w.free && w.blocks.length && w.wleft === 10, 'widget data sent');
  ok(w && !w.blocks.some(b => ['#D2452C', '#E2683F', '#B8336A'].includes(b[2])), 'widget dial has no red');
  const sch = (calls.schedule || []).slice(-1)[0]; ok(sch && sch.daily && sch.once && sch.once.some(o => o.id.startsWith('era-')), 'reminders scheduled, with the era-end one');
  ok(w && w.dots.length === 10 && w.dots[0].length === 4 && w.wtitle === '10 free weekends left in 2026', 'widget dots have four slots each');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('era-v2')); s.quests.push({ id: 'trip1', title: 'Coorg', area: 'trips', when: 'date', day: '2026-10-30', to: '2026-11-01', date: '2026-10-31', q: '2026-Q4', status: 'open', moved: 0, created: '2026-10-22' }); localStorage.setItem('era-v2', JSON.stringify(s)); localStorage.removeItem('__calls'); });
  await p.reload(); calls = await p.evaluate(() => JSON.parse(localStorage.getItem('__calls') || '{}'));
  const sch2 = calls.schedule.slice(-1)[0], w2 = calls.widget.slice(-1)[0];
  ok(sch2.away.join() === '2026-10-30,2026-10-31,2026-11-01' && sch2.once.some(o => o.id === 'back-trip1' && o.at === '2026-11-02 10:00' && o.open === 'today'), 'no daily reminder on trip days, an energy check after');
  ok(w2.awayDays.includes('2026-10-31') && w2.dots[1].every(c => c) && w2.next === 'Coorg, Fri 30 Oct – Sun 1 Nov', 'widgets know the trip');
  await p.evaluate(() => localStorage.setItem('__pending', JSON.stringify([{ t: 'confirm', d: '2026-10-30' }]))); await setTime(p, '2026-10-30T21:40:00+05:30');
  s = await S(p); ok(!s.logs['2026-10-30'], '“Looks right” does nothing on a trip day');
  await p.evaluate(() => localStorage.setItem('__open', 'check')); await p.reload(); ok(!(await text(p)).includes('Era filled') && await p.isVisible('.card.trip'), 'the check opens Today on a trip day');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('era-v2')); s.quests = s.quests.filter(x => x.id !== 'trip1'); localStorage.setItem('era-v2', JSON.stringify(s)); });
  await setTime(p, '2026-10-22T21:30:00+05:30');
  await p.evaluate(() => localStorage.setItem('__pending', JSON.stringify([{ t: 'confirm', d: '2026-10-23' }])));
  await setTime(p, '2026-10-23T21:40:00+05:30');
  s = await S(p); ok(s.logs['2026-10-23'] && s.logs['2026-10-23'].src === 'auto', '“Looks right” from the notification logs the day');
  await p.evaluate(() => localStorage.setItem('__open', 'check')); await p.reload();
  ok((await text(p)).includes('Era filled'), '“Something changed” opens the check');
  await p.click('[data-act=back]');
  await p.click('[data-tab=me]'); await p.click('[data-act=go][data-arg=m_backup]'); await p.click('[data-act=export]');
  calls = await p.evaluate(() => JSON.parse(localStorage.getItem('__calls') || '{}')); ok(calls.saveFile && calls.saveFile[0].n.startsWith('era-backup-'), 'backup saved through Android');
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await p.context().close();

  /* ---------------- C1 · Set up Choose ---------------- */
  section = 'C1 Set up Choose';
  p = await newPage();
  await onboard(p);
  const C = async () => (await S(p)).choose;
  const tid = async t => (await C()).things.find(x => x.t === t).id;
  await p.click('[data-tab=choose]');
  ok((await text(p)).includes('Ten things. One week.'), 'Choose intro');
  await p.click('[data-act=go][data-arg=ch_time]');
  ok((await text(p)).includes('can move'), 'shows how many hours can move');
  await p.click('[data-act=ch-budget][data-arg="time|+"]'); await p.click('[data-act=ch-budget][data-arg="time|+"]');
  let c = await C(); ok(c.time === 10, 'time budget 10 h a week');
  await p.click('[data-act=go][data-arg=ch_money]');
  await p.fill('#ch-month', '20000'); await p.press('#ch-month', 'Tab'); await p.fill('#ch-pot', '150000'); await p.press('#ch-pot', 'Tab');
  await p.click('[data-act=ch-cur][data-arg="$"]'); c = await C(); ok(c.cur === '$', 'currency can change'); await p.click('[data-act=ch-cur][data-arg="₹"]');
  c = await C(); ok(c.month === 20000 && c.pot === 150000 && c.cur === '₹', 'money budgets');
  await p.click('[data-act=go][data-arg=ch_energy]'); await p.click('[data-act=ch-energy][data-arg="6"]'); await p.click('[data-act=ch-energy][data-arg="4"]');
  c = await C(); ok(c.energy === 4, 'energy budget');
  await p.click('[data-act=go][data-arg=ch_lenses]');
  ok((await p.$$('.tgl')).length === 5, 'five standard lenses');
  await p.click('[data-act=ch-lens-w][data-arg="areas|+"]'); c = await C(); ok(c.lenses.find(l => l.id === 'areas').w === 2.5, 'lens weight');
  await p.click('[data-act=ch-lens-on][data-arg=undo]'); c = await C(); ok(!c.lenses.find(l => l.id === 'undo').on, 'lens off');
  await p.click('[data-act=ch-lens-on][data-arg=undo]');
  await p.click('[data-act=go][data-arg=ch_own]'); await p.click('[data-act=own-save]'); ok((await p.textContent('.toast')).includes('name'), 'own lens needs a name');
  await p.fill('#own-name', 'Good for my parents'); await p.fill('#own-q', 'How much does this help Mom and Dad?'); await p.click('[data-act=own-w][data-arg="w|+"]'); await p.click('[data-act=own-save]');
  c = await C(); const own = c.own[0]; ok(own && own.n === 'Good for my parents' && own.w === 1.5 && own.q.includes('Mom'), 'own lens saved');
  await p.click('[data-act=ch-setup-done]'); c = await C(); ok(c.setup && c.since === '2026-10-22', 'setup done');
  ok((await text(p)).includes('What do you want to do?'), 'on to your things');

  /* ---------------- C2 · Size and score ---------------- */
  section = 'C2 Size and score';
  for (const t of ['Call and visit parents', 'Gym 4x a week', 'CFA exam prep', 'Goa trip with friends', 'Learn guitar', 'Buy a car', 'Spanish']) { await p.fill('#dump-in', t); await p.press('#dump-in', 'Enter'); }
  c = await C(); ok(c.things.length === 7, 'seven things added with Enter');
  const gt = t => c.things.find(x => x.t === t);
  ok(gt('Call and visit parents').area === 'family' && gt('Gym 4x a week').area === 'health' && gt('Goa trip with friends').area === 'trips', 'areas guessed from the words');
  ok(gt('CFA exam prep').type === 'project' && gt('Goa trip with friends').type === 'oneoff' && gt('Buy a car').type === 'oneoff' && gt('Learn guitar').type === 'habit', 'types guessed from the words');
  await p.click(`[data-act=ch-del][data-arg="${gt('Spanish').id}"]`); c = await C(); ok(c.things.length === 6, 'removed one');
  await p.click('[data-act=ch-size-start]');
  // 1 parents: 2.5 h a week, recharges
  let id = await tid('Call and visit parents');
  await p.click(`[data-act=th-num][data-arg="${id}|h|0.5|+"]`); await p.click(`[data-act=th-e][data-arg="${id}|1"]`);
  await p.click('[data-act=go][data-arg=ch_score]');
  ok((await text(p)).includes('Good for my parents'), 'own lens asked when scoring');
  for (const a of ['a:family|5', 'regret|5', 'hell|5', `${own.id}|5`]) await p.click(`[data-act=th-sc][data-arg="${id}|${a}"]`);
  ok((await text(p)).match(/Score \d+/), 'score shown');
  await p.click('[data-act=ch-next]');
  // 2 gym: 5 h, ₹3,000 a month
  id = await tid('Gym 4x a week'); ok((await p.inputValue('[data-in=th-t]')) === 'Gym 4x a week', 'next thing to size');
  for (let i = 0; i < 6; i++) await p.click(`[data-act=th-num][data-arg="${id}|h|0.5|+"]`);
  await p.fill('#th-mm', '3000'); await p.press('#th-mm', 'Tab'); await p.click(`[data-act=th-e][data-arg="${id}|1"]`);
  await p.click('[data-act=go][data-arg=ch_score]'); for (const a of ['a:health|5', 'regret|4', 'hell|4']) await p.click(`[data-act=th-sc][data-arg="${id}|${a}"]`); await p.click('[data-act=ch-next]');
  // 3 CFA: project by 31 Jan, ₹60,000, drains a lot, window this year
  id = await tid('CFA exam prep');
  await p.fill('#th-by', '2027-01-31'); await p.press('#th-by', 'Tab');
  await p.fill('#th-m1', '60000'); await p.press('#th-m1', 'Tab'); await p.click(`[data-act=th-e][data-arg="${id}|-2"]`);
  ok((await text(p)).includes('a week for 15 weeks'), 'project shows hours a week');
  await p.click('[data-act=go][data-arg=ch_score]'); for (const a of ['a:learn|5', 'regret|4', 'hell|3']) await p.click(`[data-act=th-sc][data-arg="${id}|${a}"]`);
  ok((await text(p)).includes('not a hell yeah'), 'hell yeah warning below 4');
  await p.click(`[data-act=th-win][data-arg="${id}|year"]`); await p.click('[data-act=ch-next]');
  // 4 Goa: 3 days, ₹35,000, recharges a lot
  id = await tid('Goa trip with friends');
  await p.fill('#th-m1', '35000'); await p.press('#th-m1', 'Tab'); await p.click(`[data-act=th-e][data-arg="${id}|2"]`);
  await p.click('[data-act=go][data-arg=ch_score]'); for (const a of ['a:trips|5', 'a:friends|5', 'regret|4', 'hell|5']) await p.click(`[data-act=th-sc][data-arg="${id}|${a}"]`); await p.click('[data-act=ch-next]');
  // 5 guitar: ₹2,500 a month; skip the lenses
  id = await tid('Learn guitar'); await p.fill('#th-mm', '2500'); await p.press('#th-mm', 'Tab'); await p.click(`[data-act=th-e][data-arg="${id}|1"]`);
  await p.click('[data-act=go][data-arg=ch_score]'); await p.click('[data-act=ch-next]');
  // 6 car: ₹8,00,000 + ₹15,000 a month, hard to undo
  id = await tid('Buy a car'); await p.fill('#th-m1', '800000'); await p.press('#th-m1', 'Tab'); await p.fill('#th-mm', '15000'); await p.press('#th-mm', 'Tab');
  await p.click('[data-act=go][data-arg=ch_score]'); await p.click(`[data-act=th-undo][data-arg="${id}|hard"]`); await p.click('[data-act=ch-next]');
  c = await C(); ok(c.things.every(x => x.scored), 'all sized and scored');
  const sc = await p.evaluate(() => { const C = window.__era.S().choose; return Object.fromEntries(C.things.map(x => [x.t, window.__era.score(x)])); });
  ok(sc['Call and visit parents'] > sc['Buy a car'] && sc['Goa trip with friends'] > sc['Learn guitar'], 'scores follow the lenses ' + JSON.stringify(sc));
  ok(await p.evaluate(() => window.__era.weekly(window.__era.S().choose.things.find(x => x.t === 'CFA exam prep'))) === 2.5, 'project hours spread over the weeks');

  /* ---------------- C3 · Views ---------------- */
  section = 'C3 Views';
  ok((await text(p)).includes('Your 6 things'), 'lands on the ranked view');
  const firstRank = await p.textContent('#view .card.list .li b'); ok(firstRank.includes('Call and visit parents'), 'highest score first: ' + firstRank);
  await p.click('[data-act=ch-view][data-arg=matrix]'); ok((await p.$$('svg.matrix .bub')).length === 6, 'impact against cost: 6 bubbles');
  await p.click('[data-act=ch-view][data-arg=urgent]'); ok((await p.$$('.quad .card')).length === 4 && (await p.textContent('.quad')).includes('CFA exam prep'), 'urgent and important');
  await p.click('[data-act=ch-view][data-arg=balance]'); ok(await p.isVisible('svg.shape') && (await text(p)).includes('With the top 5'), 'balance of your shape');
  await p.click('[data-act=ch-view][data-arg=reality]'); ok((await text(p)).match(/Social media\s*\d+%/), 'priorities against reality shows where time went');
  await p.click('#view .card.list .li >> nth=0').catch(() => {});

  /* ---------------- C4 · What fits this era ---------------- */
  section = 'C4 What fits';
  await p.click('[data-tab=choose]'); await p.click('[data-act=go][data-arg=ch_fit]');
  await p.click('[data-act=fit-suggest]');
  let sel = await p.$$eval('.fitrow[aria-pressed=true] b', els => els.map(e => e.textContent));
  ok(sel.includes('Call and visit parents') && !sel.some(t => t.startsWith('Buy a car')) && !(await p.isVisible('.overcard')), 'suggested set fits all budgets: ' + sel.join(', '));
  c = await C();
  for (const x of c.things) { const on = await p.getAttribute(`.fitrow[data-arg="${x.id}"]`, 'aria-pressed'); if ((x.t !== 'Buy a car') !== (on === 'true')) await p.click(`.fitrow[data-arg="${x.id}"]`); }
  ok(await p.isVisible('.overcard') && (await p.textContent('.overcard')).includes('a week over'), 'over the time budget, says by how much');
  await p.click(`.fitrow[data-arg="${(c.things.find(x => x.t === 'Buy a car')).id}"]`); ok((await p.textContent('.overcard')).includes("more than you've saved"), 'the car is more than saved');
  await p.click(`.fitrow[data-arg="${(c.things.find(x => x.t === 'Buy a car')).id}"]`);
  await p.click('[data-act=fit-next]'); ok((await p.textContent('.toast')).includes('Over a budget'), 'cannot go on while over');
  await p.click('[data-act=fit-room]'); c = await C(); ok(c.time === 12 && c.room === 2, 'made room: +2 h from less-of');
  ok(!(await p.isVisible('.overcard')), 'everything fits after making room');
  await p.click('[data-act=fit-next]');
  ok((await text(p)).includes('The rest waits'), 'sort the rest');
  await p.click(`[data-act=sort-set][data-arg="${c.things.find(x => x.t === 'Buy a car').id}|later"]`);
  await p.click('[data-act=go][data-arg=ch_commit]');
  const cm = await text(p); ok(cm.includes('Lock in: 40 h by 31 Jan') && cm.includes('Claims 24 Oct') && cm.includes('Change my week'), 'shows what changes in Era');
  const hBefore = await p.evaluate(() => window.__era.planWeek('2026-Q4', '2026-10-22').health || 0);
  await p.click('[data-act=ch-commit]');
  let s2 = await S(p); c = s2.choose;
  const now = c.things.filter(x => x.status === 'now').map(x => x.t);
  ok(now.length === 5 && c.things.find(x => x.t === 'Buy a car').status === 'later' && c.things.find(x => x.t === 'Buy a car').review === '2027-01-20', 'statuses committed (car later, review in 3 months)');
  const gymId = c.things.find(x => x.t === 'Gym 4x a week').id, parId = c.things.find(x => x.t === 'Call and visit parents').id;
  ok(s2.moves.filter(m => m.thing === gymId).reduce((a, m) => a + m.h, 0) === 5, 'gym became 5 h of bead changes');
  ok(s2.goals.some(x => x.title === 'CFA exam prep' && x.total === 40 && x.end === '2027-01-31' && x.thing), 'CFA became a lock-in');
  ok(s2.quests.some(x => x.title === 'Goa trip with friends' && x.date === '2026-10-24'), 'Goa claimed the next free weekend');
  const hAfter = await p.evaluate(() => window.__era.planWeek('2026-Q4', '2026-10-22').health || 0); ok(Math.abs(hAfter - hBefore - 5) < 1e-6, 'era plan has 5 more hours of Health');
  ok((await text(p)).includes('5 now'), 'Choose home');
  await p.click(`[data-act=ch-hour][data-arg="${parId}"]`); s2 = await S(p);
  ok(s2.logs['2026-10-22'].blocks.some(b => b.thing === parId && b.k === 'family' && b.e - b.s === 1), '+1 h logs time to the thing');
  ok((await text(p)).includes('1 of 2.5 h this week'), 'progress this week');
  await p.click(`[data-act=go][data-arg=ch_thing][data-id="${gymId}"]`); await p.click(`[data-act=th-status][data-arg="${gymId}|later"]`);
  s2 = await S(p); ok(!s2.moves.some(m => m.thing === gymId), 'moving a thing out takes its hours out of Era');
  await p.click(`[data-act=th-status][data-arg="${gymId}|now"]`); s2 = await S(p); ok(s2.moves.filter(m => m.thing === gymId).length > 0, 'and back in');
  const goaId = s2.choose.things.find(x => x.t === 'Goa trip with friends').id;
  await p.click('[data-act=back]'); await p.click(`[data-act=go][data-arg=ch_thing][data-id="${goaId}"]`); await p.click(`[data-act=ch-spend][data-arg="${goaId}"]`); await p.fill('#sp-amt', '12000'); await p.click('.sheet [data-ok]');
  s2 = await S(p); ok(s2.choose.things.find(x => x.id === goaId).spent[0].amt === 12000, 'money spent logged');

  /* ---------------- C5 · A decision ---------------- */
  section = 'C5 Decision';
  await p.click('[data-tab=choose]'); await p.click('[data-act=ch-dec-new]');
  let dc = (await C()).decisions[0];
  await p.click(`[data-act=dc-next][data-arg="${dc.id}|ch_dec2"]`); ok((await p.textContent('.toast')).includes("what you're deciding"), 'needs a question');
  await p.fill('[data-in=dc-q]', 'Buy a car?'); const on = await p.$$('[data-in=opt-n]'); await on[0].fill('Buy a car'); await on[1].fill('Keep using cabs');
  await p.click(`[data-act=opt-add][data-arg="${dc.id}"]`); await (await p.$$('[data-in=opt-n]'))[2].fill('Two-wheeler');
  await p.click(`[data-act=dc-door][data-arg="${dc.id}|two"]`);
  dc = (await C()).decisions[0]; ok(dc.q === 'Buy a car?' && dc.opts.length === 3 && dc.door === 'two', 'question, three options, two-way door');
  await p.click(`[data-act=dc-next][data-arg="${dc.id}|ch_dec2"]`);
  const [A, B, Cc] = dc.opts.map(o => o.id);
  await p.click(`[data-act=opt-num][data-arg="${dc.id}|${A}|h|0.5|-"]`); for (let i = 0; i < 5; i++) await p.click(`[data-act=opt-num][data-arg="${dc.id}|${A}|h|0.5|-"]`);
  await p.fill(`#o1-${A}`, '800000'); await p.press(`#o1-${A}`, 'Tab'); await p.fill(`#om-${A}`, '15000'); await p.press(`#om-${A}`, 'Tab');
  await p.click(`[data-act=opt-e][data-arg="${dc.id}|${A}|1"]`); await p.click(`[data-act=opt-undo][data-arg="${dc.id}|${A}|hard"]`);
  await p.fill(`#om-${B}`, '9000'); await p.press(`#om-${B}`, 'Tab');
  await p.fill(`#o1-${Cc}`, '120000'); await p.press(`#o1-${Cc}`, 'Tab'); await p.fill(`#om-${Cc}`, '2500'); await p.press(`#om-${Cc}`, 'Tab'); await p.click(`[data-act=opt-e][data-arg="${dc.id}|${Cc}|-1"]`);
  ok((await text(p)).includes('costs more than your'), 'warns when it costs more than saved');
  await p.click(`[data-act=dc-next][data-arg="${dc.id}|ch_dec3"]`);
  ok((await text(p)).includes('Good for my parents'), 'your own lens in decisions');
  await p.click(`[data-act=opt-sc][data-arg="${dc.id}|${A}|a:family|5"]`); await p.click(`[data-act=opt-sc][data-arg="${dc.id}|${A}|hell|4"]`); await p.click(`[data-act=opt-sc][data-arg="${dc.id}|${Cc}|hell|2"]`);
  await p.click(`[data-act=dc-next][data-arg="${dc.id}|ch_dec4"]`);
  const ans = await text(p); ok(ans.includes('Keep using cabs, for now') || ans.includes('Buy a car, for now') || ans.includes('A tie'), 'an answer');
  ok(ans.includes('wins on') || ans.includes('flips') || ans.includes('clear call') || ans.includes('tie'), 'says why, and what would flip it');
  await p.click(`[data-act=dc-gut][data-arg="${dc.id}|relieved"]`); ok((await text(p)).includes('Your gut agrees'), 'gut check');
  await p.fill('#dc-why', 'Money first until the CFA is done'); await p.press('#dc-why', 'Tab');
  await p.click(`[data-act=dc-decide] >> nth=0`);
  dc = (await C()).decisions[0]; ok(dc.chosen && dc.review === '2026-11-21' && dc.why.includes('CFA'), 'decided, review in a month for a two-way door');
  await p.click('[data-act=back]'); ok(await p.isVisible('#tabs'), 'back from the answer goes to Choose'); ok((await text(p)).includes('Buy a car?'), 'decision listed');
  await setTime(p, '2026-11-22T10:00:00+05:30'); await p.click('[data-tab=choose]');
  ok((await text(p)).includes('right call?'), 'review card when due');
  await p.click(`[data-act=go][data-arg=ch_decreview][data-id="${dc.id}"]`); ok((await text(p)).includes('Money first'), 'shows your reason');
  await p.click(`[data-act=dc-out][data-arg="${dc.id}|no"]`); dc = (await C()).decisions[0]; ok(!dc.chosen && (await text(p)).includes('for now'), 'decide again');
  await p.click(`[data-act=dc-decide] >> nth=0`); await setTime(p, '2026-12-23T10:00:00+05:30'); await p.click('[data-tab=choose]');
  await p.click(`[data-act=go][data-arg=ch_decreview][data-id="${dc.id}"]`); await p.click(`[data-act=dc-out][data-arg="${dc.id}|yes"]`);
  dc = (await C()).decisions[0]; ok(dc.outcome === 'yes', 'still right');

  /* ---------------- C6 · Monthly check ---------------- */
  section = 'C6 Monthly check';
  await setTime(p, '2026-11-02T10:00:00+05:30'); await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('era-v2')); delete s.choose.reviews['2026-10']; localStorage.setItem('era-v2', JSON.stringify(s)); }); await p.reload();
  c = await C(); const carId = c.things.find(x => x.t === 'Buy a car').id, guitId = c.things.find(x => x.t === 'Learn guitar').id;
  await p.click('[data-tab=choose]'); await p.click(`[data-act=go][data-arg=ch_thing][data-id="${guitId}"]`); await p.click(`[data-act=th-status][data-arg="${guitId}|letgo"]`);
  await p.click('[data-tab=choose]'); await p.click(`[data-act=go][data-arg=ch_thing][data-id="${carId}"]`); await p.click(`[data-act=th-status][data-arg="${carId}|next"]`);
  await p.click('[data-tab=choose]'); ok((await text(p)).includes('Monthly check'), 'monthly check card on the 1st');
  await p.click('[data-act=go][data-arg=ch_review]'); ok((await text(p)).includes('How did Oct go?'), 'how did October go');
  ok((await text(p)).includes('behind'), 'shows what fell behind');
  await p.click(`[data-act=rv-behind][data-arg="${gymId}|halve"]`); c = await C(); ok(c.things.find(x => x.id === gymId).h === 2.5, 'halved a habit');
  s2 = await S(p); ok(s2.moves.filter(m => m.thing === gymId).reduce((a, m) => a + m.h, 0) === 2.5, 'and its hours in Era');
  ok(await p.isVisible('.faded'), 'let go things shown faded, to bring back');
  await p.click(`[data-act=rv-start][data-arg="${carId}"]`); c = await C(); ok(c.things.find(x => x.id === carId).status === 'now', 'started one from Next');
  await p.click('[data-act=rv-save]'); c = await C(); ok(c.reviews['2026-10'] && c.reviews['2026-10'].at, 'check saved');
  ok(!(await text(p)).includes('Monthly check, 5 minutes'), 'card gone once done');
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await p.context().close();

  /* ---------------- Moving from Era 0.1 ---------------- */
  section = 'Migration';
  const V1 = { v: 1, onboarded: true, onboardedAt: '2026-10-19', me: {}, week: { preset: 'office', office: [1, 2, 3, 4, 5], wd: { sleep: 7, work: 9, commute: 1.5, chores: 2, family: 1.5, phone: 2, rest: 1 }, we: { sleep: 8, chores: 3, family: 4, people: 3, phone: 3, learn: 1, health: 1, rest: 1 } },
    moves: [{ id: 'm1', q: '2026-Q4', from: 'phone', to: 'health', h: 3, note: 'Runs' }], goals: [{ id: 'g1', title: 'Exam', corner: 'learn', total: 20, start: '2026-10-20', end: '2026-11-16', src: { phone: 5 }, why: 'Job' }],
    plans: [{ id: 'p1', title: 'Rajmachi', corner: 'travel', when: 'quarter', q: '2026-Q4', status: 'open', moved: 0 }],
    logs: { '2026-10-19': { e: [{ to: 'health', from: 'phone', h: 1 }], good: 'Ran' }, '2026-10-20': { hours: { sleep: 8, work: 8, commute: 1, chores: 2, family: 2, people: 1, health: 0, learn: 1, travel: 0, rest: 0.5, phone: 0.5, other: 0 } }, '2026-10-21': { e: [] } },
    retros: { '2026-10-12': { well: 'ok', at: 1 } }, eras: { '2026-Q4': { name: 'my fitness era' } }, labels: { week: 'Weekly reset', phone: 'Doomscroll' }, protect: ['sleep', 'health'], remind: { daily: '21:30', weekly: '19:00', on: true } };
  p = await newPage({ init: { fn: v1 => { if (!localStorage.getItem('era-v1')) localStorage.setItem('era-v1', JSON.stringify(v1)); }, arg: V1 } });
  s = await S(p);
  ok(s && s.v === 2 && s.onboarded && s.migratedFrom === 1, 'v1 data moved to v2 on first open');
  ok(await p.evaluate(() => !!localStorage.getItem('era-v1')), 'old data kept as a safety copy');
  ok(Object.keys(s.logs).length === 3 && Object.values(s.logs).every(l => sum24(l.blocks)), 'every old day is a 24 h dial');
  const h19 = s.logs['2026-10-19'].blocks.reduce((o, b) => (o[b.k] = (o[b.k] || 0) + b.e - b.s, o), {});
  ok(h19.health === 1 && h19.social === 1 && h19.family === 1.5, 'old changes replayed (+1 h health from the phone)');
  ok(s.logs['2026-10-19'].good === 'Ran', 'good thing kept');
  const h20 = s.logs['2026-10-20'].blocks.reduce((o, b) => (o[b.k] = (o[b.k] || 0) + b.e - b.s, o), {});
  ok(h20.sleep === 8 && h20.friends === 1 && h20.learn === 1, 'hour-by-hour day kept');
  ok(s.areas.includes('selfcare') && s.less[0].k === 'social', 'Rest is Self-care, Doomscroll is Less of: Social media');
  ok(s.moves[0].from === 'social' && s.moves[0].to === 'health' && s.goals[0].area === 'learn' && s.goals[0].src.social === 5, 'shifts and lock-ins mapped');
  ok(s.quests[0].title === 'Rajmachi' && s.quests[0].area === 'trips' && s.quests[0].when === 'era', 'plans became side quests');
  ok(s.labels.week === 'Weekly reset' && !s.labels.phone && s.eras['2026-Q4'].name === 'my fitness era' && s.retros['2026-10-12'], 'names, eras and retros kept');
  ok((await text(p)).includes('Era 0.2 is here'), 'what changed, explained once');
  await p.click('[data-act=seen][data-arg=migrated]'); ok(!(await text(p)).includes('Era 0.2 is here'), 'explainer dismissed');
  const tw1 = await p.evaluate(() => window.__era.tmplWeek()); ok(Math.abs(Object.values(tw1).reduce((a, b) => a + b, 0) - 168) < 1e-6, 'normal week is 168 h');
  ok(Math.abs((tw1.social || 0) - 16) < 1e-6, 'normal week keeps 16 h of social media');
  // A v1 backup file restores too
  await p.click('[data-tab=me]'); await p.click('[data-act=go][data-arg=m_backup]');
  fs.writeFileSync('/tmp/era-v1-backup.json', JSON.stringify(V1)); await p.setInputFiles('#m-file', '/tmp/era-v1-backup.json'); await p.waitForTimeout(200);
  s = await S(p); ok(s.v === 2 && s.logs['2026-10-20'], 'v1 backup file restores');
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));

  await browser.close();
  console.log(`passed ${passes}, failed ${fails}`);
  process.exitCode = fails ? 1 : 0;
})().catch(async e => { console.error(e); console.log('page errors:', errsAll.join(' | ')); console.log(`passed ${passes}, failed ${fails + 1} (stopped early, in ${section})`);
  if (curPage && process.env.ERA_SHOTS) { fs.mkdirSync(process.env.ERA_SHOTS, { recursive: true }); await curPage.screenshot({ path: `${process.env.ERA_SHOTS}/stopped.png`, fullPage: true }).catch(() => {}); }
  process.exit(1); });
