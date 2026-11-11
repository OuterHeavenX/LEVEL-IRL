# LEVEL IRL — Vite Edition

LEVEL IRL is a mobile-first fitness RPG built with vanilla JavaScript ES modules and Vite.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Development

```bash
npm install
npm run dev
```

Vite will print the local address. The dev server is configured with `--host 0.0.0.0`, so it can also be opened from another device on the same network when your environment permits it.

## Production build

```bash
npm run build
npm run preview
```

The production bundle is written to `dist/`.

## Project structure

```text
.
├── index.html                  static markup; loads src/main.js
├── package.json
├── vite.config.js
├── wrangler.jsonc              Cloudflare Worker config (serves dist/ and /api/youversion/*)
└── src/
    ├── main.js                 entry point; imports every module in load order
    ├── app.js                  core state and UI
    ├── history.js              workout history (with history.css)
    ├── workoutCompletion.js    adventure strike / end buttons
    ├── navigation.js           tab bar and screens
    ├── bossBattle.js, dailyActivity.js, progressOverview.js, characterProgression.js,
    │   juiceEngine.js, superJuice.js, restCamp.js, rpgExpansion.js, rpgCore.js,
    │   campaignMap.js, chronicler.js, comboSystem.js, lootSystem.js, personalRecords.js,
    │   questBoard.js, randomEncounters.js
    │                           feature modules; most inject their own CSS
    ├── styles.css              base styles
    ├── layout.css              responsive layout and the shared card spec (loaded last)
    ├── worker-with-youversion.js   the Cloudflare Worker
    ├── data/
    │   └── defaultData.js
    └── lib/
        ├── achievements.js
        ├── bosses.js
        ├── dom.js
        ├── exercise.js
        ├── nutrition.js
        ├── progression.js
        └── storage.js
```

## Verse of the Day (Cloudflare Worker)

`npm run dev` and `npm run preview` do not serve `/api/youversion/*`, so Camp's Verse of the Day shows "The Bible service isn’t reachable from this build."

To test it locally, put `YOUVERSION_APP_KEY=<key>` in a `.dev.vars` file, then run:

```bash
npm run build && npx wrangler dev
```

`npx` downloads wrangler; it is not a devDependency. To deploy, set the key once with `npx wrangler secret put YOUVERSION_APP_KEY`, then run `npm run build && npx wrangler deploy`.

## Saving

LEVEL IRL has no accounts or login. Progress is saved in the browser's localStorage on the device you play on; use the Workout History **Backup** button to download a copy and **Import** to merge a backup into this device.

## Save compatibility

LEVEL IRL intentionally preserves the legacy localStorage key (`fitquest-save-v1`). Running this version on the same origin/host preserves compatible saves created before the product rename.

Note: browser localStorage is origin-specific. If the hostname or port changes, the browser may treat it as a different storage origin even though the app uses the same key.

## Nutrition search

Online nutrition lookup still uses Open Food Facts from the browser. Internet access and browser CORS/network policies therefore apply.
