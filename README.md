# Axiom Flow Studio — company website

Static site, no build step: `index.html`, `styles.css`, `site.js` (hero cycle, scroll reveals) and
`glass.js` (the workbench's liquid-glass refraction, without React; Chromium only, frost elsewhere).
The kitchens in `assets/kitchens/` are made from the sign-in stills in `webui/public/showcase/`, at
800/1200/1800/2400 px, WebP q80 (no visible difference from the originals at 1:1, a third of the bytes).
If those stills are remade, make the four sizes again.

## Performance: decisions measured, not to undo blindly (2026-11-22)

Lighthouse 100 on desktop, 99-100 on mobile; 60 fps idle, scrolling and with pointer moves, also under 4x CPU throttling.
- Refraction (`glass.js`) only on desktop-class machines (fine pointer, wide window). On a throttled phone it held
  the page at 25 fps; with frost it holds 60. iOS can't draw it anyway.
- One displacement pass (no colour dispersion); map at 1x and computed only along the rim; built after first paint.
- The rim light follows the pointer on its own `.glass-rim` child, never on the pane or the root: restyling the pane
  rebuilt its backdrop filter (about 10x the style work), and a custom property on the root restyles the whole page.
- The hero zooms only during a crossfade, then is still: a perpetually moving backdrop makes the glass refilter every frame.
  The next picture is decoded before it is shown, the other two are fetched after load, and nothing cycles off screen.
- The first hero picture is visible from the first frame (it is the page's largest paint).
- Short font list: every family named that a machine lacks costs a font lookup on first layout (it doubled layout).
  Inter is self-hosted, `font-display: optional`, and not preloaded, because Apple devices never use it.
- No `content-visibility`: it saved about 15% of layout but made the nav's in-page links land up to 474 px off.
- Things Lighthouse still flags on the local server (no compression, short cache) are handled by GitHub Pages.

Preview: open `index.html` in a browser, or `python -m http.server 8080` in this folder.

Publishing: `.github/workflows/pages.yml` deploys the site on every push to `main`
(Settings > Pages > Source: "GitHub Actions"). It is served at https://axiomflowstudio.com:
the domain is set in Settings > Pages > Custom domain (`CNAME` here records it), with DNS at the
registrar pointing at GitHub Pages (apex A/AAAA records, `www` a CNAME to `ulascanersoy.github.io`).

## Hero videos (not published)

The showreels rendered from the 3D engine are on trial: `?video=1` in the address plays them in place of
the stills, from `assets/video/<kitchen>-<1920|1280>.<av1|h264>.mp4`. That folder is git-ignored
(about 170 MB); without the files the page falls back to the stills. To publish them, remove the
`.gitignore` line, and consider making them the default in `site.js`.
