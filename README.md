# Era

See where your week goes, then spend your free hours on purpose. Each day is a 24-hour dial, filled from your normal week and (on Android) your real screen time. Your free hours make a shape with one corner per area you want more of; what you want less of sits apart in red, where smaller is the win. A 30-second nightly recap (swipe to confirm), a weekly vibe check and a retro for every era (quarter) keep it honest.

**Choose** is for when you want to do ten things and only have so much time, money and energy. Set three budgets (time comes from Era), size each thing, judge them through lenses (standard frameworks like the regret test and "hell yeah or no", plus your own with weights), see them ranked, as impact against cost, urgent against important, against your shape, and against where your time really goes. Pick what fits this era and commit it to Era: habits become bead changes, projects become lock-ins, trips claim weekends. Decisions (buy a car?) get the same treatment, with a review date.

- **Use it:** https://rj8228.github.io/Era/ — on iPhone, Safari → Share → Add to Home Screen; on Android, Chrome → Add to Home screen.
- **Android app** (reminders with a “Looks right” button, screen time, home-screen widgets): download `Era.apk` from the [latest release](https://github.com/rj8228/Era/releases/tag/latest).

Everything is stored on the phone. Backups are JSON files. Data from Era 0.1 moves over on first open (the old copy is kept).

## Code

- `index.html` — page and styles. `version.js` — the one place the version lives (the offline cache and the Android build follow it).
- `js/model.js` — categories, dates, saved state, the move from 0.1, and the numbers. `js/draw.js` — dial, shape, bead jars, weekend dots, paint grid. `js/screens.js` — every screen. `js/choose.js` — the Choose tab: budgets, lenses, scoring, fit, commit to Era, decisions. `js/app.js` — navigation, actions, gestures and the Android bridge.
- `android/` wraps the same files in a WebView and adds notifications, screen time (`ScreenTime.kt`), widgets (`EraWidgets.kt`).

## Tests

`tests/e2e.js` walks through every journey on the Era Screens page in a real browser (first run, logging a day, two things at once, too much red, catch up, vibe check, observe → decide → shift, beads, lock in, weekends, era retro, Me, rough week, screen time, widgets and notifications, the seven Choose journeys, and the move from 0.1), with the Android bridge stubbed.

```
python3 -m http.server 8777 &
npm install --no-save playwright@1.56.0 && npx playwright install chromium
node tests/e2e.js
```

GitHub Actions runs them on every push and pull request; the APK is only built and published when they all pass. The signing key lives in Actions secrets (backup in a private repo), so every build installs as an update.
