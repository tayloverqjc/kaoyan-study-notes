# Repository Guide for AI Agents

This repository builds a static GitHub Pages study handbook hosted at subpath `/kaoyan-study-notes/` (never root `/`).

## Source of Truth
- **Markdown notes & images**: `notes/<subject>/`
  - `os`: `notes/os/复盘/*.md` -> `chapter-0.html`..`chapter-5.html` (`storagePrefix`: `os-reader-v1-ch`)
  - `network`: `notes/network/复盘/*.md` -> `network-0.html`..`network-6.html` (`storagePrefix`: `notes-network-ch`)
  - `architecture`: `notes/architecture/复盘/*.md` -> `architecture-0.html`..`architecture-7.html` (`storagePrefix`: `notes-architecture-ch`)
  - `ds`: `notes/ds/复盘/*.md` -> `ds-0.html`..`ds-8.html` (`storagePrefix`: `notes-ds-ch`)
  - `math`: `notes/math/知识点与考点整理/*.md` -> `math-0.html`..`math-15.html` (`storagePrefix`: `notes-math-ch`)
  - `linear`: `notes/linear/*.md` -> `linear-0.html`..`linear-5.html` (`storagePrefix`: `notes-linear-ch`)
- **App shell frontend**: `public/index.html`, `public/english.html`, `public/notes.html`, `public/method.html`, and `public/study/`.
- **Reader shell templates & build pipeline**: `tools/build-all.cjs`, `tools/build-note.cjs`, `tools/render-mermaid.cjs`, `tools/upgrade-readers-and-index.cjs`, `tools/reader.css`, `tools/reader.js`, `tools/highlights.css`, `tools/sidebar.css`, `tools/sidebar.js`.

## Build & Deployment Rules
1. Never commit `dist/` or `node_modules/`. CI runs `npm ci`, `npx playwright install --with-deps chromium`, `npm run build`, and deploys `dist/` via `.github/workflows/deploy-pages.yml`.
2. Preserve subpath safety: never re-introduce `<base href="/">` or leading-slash `/study/...` URLs; use relative URLs (`study/...` in HTML/JS, `./wallpapers/...` in `app.css`, `./study/wallpapers/...` in `reader.css`).
3. Keep `public/study/theme-boot.js` loaded before stylesheets on both shell HTMLs and reader HTMLs to prevent FOUT (theme flash).
4. Keep strict CSP on generated reader pages (`img-src 'self' data:; style-src 'unsafe-inline'; script-src 'self' 'unsafe-inline';`) — formulas (MathJax) and flowcharts (Mermaid) must be pre-rendered into inline SVG at build time, not fetched from CDNs.
5. `build-note.cjs` enforces text integrity (`bodyBefore === bodyAfter`), MathJax zero-error checking (`data-mjx-error` / `<merror>`), and zero unrendered `**`. If you add a new `.md` chapter or image, run `npm run build` locally (or test with `PLAYWRIGHT_CHROME_PATH` if Playwright Chromium isn't installed in default cache) before pushing.
6. Note storage keys (`personal-notes-reader-prefs`, `personal-study-english-v1`, `personal-notes-sidebar-collapsed`, `os-reader-v1-ch*`, `notes-*-ch*`) preserve backward compatibility with users' browser `localStorage` data. Do not rename them without migration.
