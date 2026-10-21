// End-to-end check of every Era flow, with persistence checks after reloads.
// Run: serve this folder on :8777 (python3 -m http.server 8777), then node tests/e2e.js
const { chromium } = require('playwright');
const U = 'http://localhost:8777/';
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('FAIL:', m); } };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const S = () => p.evaluate(() => JSON.parse(localStorage.getItem('era-v1')));
  const reload = async () => { await p.reload(); await p.waitForTimeout(150); };
  const closeX = async () => { await p.click('.sheet:last-child [data-close]'); await p.waitForTimeout(80); };
  const backdrop = async () => { await p.mouse.click(195, 30); await p.waitForTimeout(80); };
  const today = await p.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });

  // Onboarding
  await p.goto(U);
  await p.fill('#o-age', '28'); await p.fill('#o-leave', '20'); await p.click('[data-oe=high]'); await p.click('[data-op=later]');
  await p.click('[data-onb="1"]');
  let s = await S(); ok(s.me.age === '28' && s.me.leave === 20 && s.me.energy === 'high' && s.me.pace === 'later', 'onboarding step 1 saved');
  await p.click('[data-preset=wfh]'); s = await S(); ok(s.week.preset === 'wfh' && s.week.wd.work === 9, 'preset');
  await p.click('[data-preset=office]');
  await p.click('[data-office="6"]'); s = await S(); ok(s.week.office.includes(6), 'office day added');
  await p.click('[data-office="6"]');
  await p.click('[data-act=edit-week]'); await p.click('.sheet [data-step="w:wd:phone|-0.5"]'); await p.click('.sheet [data-step="w:wd:health|0.5"]');
  await p.click('.sheet [data-wm=we]'); await p.click('.sheet [data-step="w:we:people|0.5"]'); await closeX();
  s = await S(); ok(s.week.wd.phone === 1.5 && s.week.wd.health === 0.5 && s.week.we.people === 3.5, 'week editor');
  await p.click('[data-onb="2"]'); await p.fill('#o-era', 'my fitness era'); await p.click('[data-act=finish]');
  s = await S(); ok(s.onboarded && s.eras[Object.keys(s.eras)[0]].name === 'my fitness era', 'finish onboarding');
  await reload(); ok(await p.isVisible('#tabs'), 'stays onboarded after reload');

  // Today
  await p.click('[data-usual]'); s = await S(); ok(s.logs[today] && !s.logs[today].hours, 'usual day');
  await p.click('[data-chip$="|0"]'); s = await S(); let hsum = Object.values(s.logs[today].hours).reduce((a, c) => a + c, 0);
  ok(Math.abs(hsum - 24) < 0.01 && s.logs[today].hours.health >= 1, 'chip adds and keeps 24 (' + hsum + ')');
  await p.fill('[data-logf$="|good"]', 'Good run'); await p.press('[data-logf$="|good"]', 'Tab');
  await p.fill('[data-logf$="|change"]', 'Sleep earlier'); await p.press('[data-logf$="|change"]', 'Tab');
  await p.click(`[data-energy="${today}|low"]`);
  s = await S(); ok(s.logs[today].good === 'Good run' && s.logs[today].change === 'Sleep earlier' && s.logs[today].energy === 'low', 'good/change/energy');
  // Day editor
  await p.click('[data-editday]');
  await p.fill('[data-dv=learn]', '4'); await p.press('[data-dv=learn]', 'Tab');
  await p.fill('[data-dv=work]', '0'); await p.press('[data-dv=work]', 'Tab');
  await p.click('[data-dh="people|0.5"]'); await p.click('[data-dh="sleep|-0.5"]');
  const rng = await p.$('[data-dr=family]'); await rng.evaluate(e => { e.value = 3; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
  s = await S(); const H = s.logs[today].hours; hsum = Object.values(H).reduce((a, c) => a + c, 0);
  ok(Math.abs(hsum - 24) < 0.01, 'editor keeps 24 (' + hsum + ')'); ok(H.learn === 4 && H.work === 0 && H.family === 3, 'editor values ' + JSON.stringify(H));
  ok((await p.textContent('#de-tot')).includes('24 h placed'), 'editor total text');
  await closeX(); await reload(); s = await S(); ok(s.logs[today].hours.learn === 4, 'day hours persist');
  await p.click('[data-editday]'); await p.click('[data-dereset]'); await closeX(); s = await S(); ok(!s.logs[today].hours, 'reset to usual');

  // Week
  await p.click('[data-tab=week]');
  ok(await p.isVisible('.cmp'), 'week compare rows');
  const days = await p.$$('[data-logday]'); ok(days.length >= 1, 'week days list');
  await days[0].click(); await p.fill('[data-dv=people]', '5'); await p.press('[data-dv=people]', 'Tab'); await closeX();
  s = await S(); const d0 = Object.keys(s.logs).sort()[0]; ok(s.logs[d0].hours && s.logs[d0].hours.people === 5, 'past day edited');
  if (await p.isVisible('#r-well')) {
    await p.fill('#r-well', 'Ran'); await p.click('[data-blocker="Too tired"]'); await p.fill('#r-chg', 'Phone away'); await p.click('[data-act=save-retro]');
    s = await S(); const R = Object.values(s.retros)[0]; ok(R && R.well === 'Ran' && R.blockers.includes('Too tired') && R.change === 'Phone away' && R.at, 'weekly retro saved');
  }
  await p.click('[data-week="-7"]'); ok((await p.isVisible('#r-well')), 'past week retro available');
  await p.fill('#r-well', 'Old week'); await p.click('[data-act=save-retro]'); s = await S(); ok(Object.keys(s.retros).length >= 1, 'past retro saved');
  await p.click('[data-week="7"]');
  // Plans in week: save button, then close-to-save
  await p.click('[data-act=add-plan][data-when=week]'); await p.fill('#p-title', 'Dinner with Rohan'); await p.click('[data-saveplan]');
  await p.click('[data-act=add-plan][data-when=week]'); await p.fill('#p-title', 'Guitar'); await closeX();
  s = await S(); ok(s.plans.length === 2, 'plans saved (button + X): ' + s.plans.map(x => x.title));
  const pid = s.plans[0].id;
  await p.click(`[data-plan="${pid}|moved"]`); s = await S(); ok(s.plans[0].moved === 1, 'plan moved');
  await p.click('[data-tab=week]'); await p.click('[data-week="7"]');
  await p.click(`[data-plan="${pid}|done"]`); s = await S(); ok(s.plans[0].status === 'done', 'moved plan done in next week');
  await p.click('[data-week="-7"]'); await p.click(`[data-plan="${s.plans[1].id}|dropped"]`); s = await S(); ok(s.plans[1].status === 'dropped', 'plan dropped');

  // Era
  await p.click('[data-tab=era]');
  await p.fill('[data-eraname]', 'my exam era'); await p.press('[data-eraname]', 'Tab'); s = await S(); ok(Object.values(s.eras)[0].name === 'my exam era', 'era renamed');
  // Shift: save button
  await p.click('[data-act=move]'); await p.selectOption('#mv-to', 'learn'); await p.fill('#mv-h', '3'); await p.fill('#mv-note', 'Course'); await p.click('[data-savemove]');
  // Shift: change only hours then X
  await p.click('[data-act=move]'); await p.fill('#mv-h', '2'); await closeX();
  // Shift: untouched defaults then X (should save defaults too)
  await p.click('[data-act=move]'); await closeX();
  // Shift: backdrop
  await p.click('[data-act=move]'); await p.selectOption('#mv-to', 'people'); await backdrop();
  s = await S(); ok(s.moves.length === 4, 'shifts saved via button, X, untouched X, backdrop: ' + s.moves.map(m => m.from + '>' + m.to + ' ' + m.h));
  await reload(); await p.click('[data-tab=era]'); s = await S(); ok(s.moves.length === 4, 'shifts persist');
  const mid = s.moves[0].id;
  await p.fill(`[data-setval="m:${mid}"]`, '5'); await p.press(`[data-setval="m:${mid}"]`, 'Tab'); s = await S(); ok(s.moves.find(m => m.id === mid).h === 5, 'shift edited');
  await p.click(`[data-step="m:${mid}|0.5"]`); s = await S(); ok(s.moves.find(m => m.id === mid).h === 5.5, 'shift +');
  await p.fill(`[data-setval="m:${mid}"]`, '0'); await p.press(`[data-setval="m:${mid}"]`, 'Tab'); s = await S(); ok(!s.moves.find(m => m.id === mid), 'shift 0 removes');
  await p.click(`[data-rmmove="${s.moves[0].id}"]`); s = await S(); ok(s.moves.length === 2, 'shift x removes');
  // Lock-in: invalid close does not save, valid close saves, button saves
  await p.click('[data-act=makeroom]'); await p.fill('#g-title', 'Half done'); await closeX(); s = await S(); ok(s.goals.length === 0, 'lock-in not saved without hours');
  await p.click('[data-act=makeroom]'); await p.fill('#g-title', 'Exam'); await p.fill('#g-total', '8'); await p.press('#g-total', 'Tab');
  for (let i = 0; i < 4; i++) await p.click('.sheet [data-step="g:phone|0.5"]');
  await p.fill('#g-why', 'Analyst role'); await closeX(); s = await S(); ok(s.goals.length === 1 && s.goals[0].why === 'Analyst role', 'lock-in saved on close');
  await p.click('[data-tab=today]'); ok(await p.isVisible('[data-gchip]'), 'lock-in chip on today');
  await p.click('[data-gchip]'); s = await S(); ok(s.logs[today].hours && s.logs[today].hours.learn >= 1, 'lock-in chip logs hours');
  await p.click('[data-tab=era]'); ok((await p.textContent('#view')).includes('of 8 h logged'), 'lock-in progress shown');
  await p.click('[data-act=add-plan][data-when=quarter]'); await p.fill('#p-title', 'Rajmachi'); await backdrop(); s = await S(); ok(s.plans.some(x => x.title === 'Rajmachi'), 'era quest saved on backdrop');
  await p.fill('#e-keep', 'Runs'); await p.press('#e-keep', 'Tab'); s = await S(); ok(Object.values(s.eras)[0].keep === 'Runs', 'era retro saved');
  await p.click('[data-openweek]'); ok(await p.isVisible('.cmp'), 'weeks list opens week');
  // Goal end flow: move the goal end into the past
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('era-v1')); s.goals[0].start = '2026-09-01'; s.goals[0].end = '2026-09-30'; localStorage.setItem('era-v1', JSON.stringify(s)); });
  await reload(); ok(await p.isVisible('[data-goalend]'), 'lock-in end card');
  await p.click('[data-goalend$="|part"]'); s = await S(); ok(s.goals[0].closed && s.goals[0].result === 'part', 'lock-in closed');

  // Settings
  await p.click('#btnSettings');
  await p.click('.sheet [data-protect=family]'); s = await S(); ok(s.protect.includes('family'), 'protect toggle');
  await p.fill('#s-age', '29'); await p.press('#s-age', 'Tab'); s = await S(); ok(s.me.age === '29', 'age');
  await p.fill('#s-daily', '22:00'); await p.press('#s-daily', 'Tab'); s = await S(); ok(s.remind.daily === '22:00', 'reminder time');
  await p.fill('#lbl-shape', 'My map'); await p.press('#lbl-shape', 'Tab'); s = await S(); ok(s.labels.shape === 'My map', 'rename label');
  ok((await p.textContent('.sheet .foot')).includes('v' + (await p.evaluate(() => self.ERA_VERSION))), 'version shown');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=export]')]);
  const backup = require('fs').readFileSync(await dl.path(), 'utf8'); ok(JSON.parse(backup).week, 'backup exported');
  await closeX(); await p.click('[data-tab=era]'); ok((await p.textContent('#view')).includes('My map'), 'renamed label shown');
  // Reset and restore
  await p.click('#btnSettings'); await p.click('[data-act=reset]'); await p.click('[data-yes]'); s = await S(); ok(!s.onboarded, 'reset');
  await p.evaluate(t => localStorage.setItem('era-v1', t), backup); await reload(); s = await S(); ok(s.onboarded && s.moves.length === 2, 'restore from backup');
  ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  console.log(`passed ${passes}, failed ${fails}`);
  await b.close();
})();
