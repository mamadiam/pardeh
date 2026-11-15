# Pardeh (پرده)

A free, open-source screenwriting app in the browser for writers in both directions:
Persian/Arabic (RTL) and English (LTR).

Open it at **https://mamadiam.github.io/pardeh/**.

## What it does

- A4 screenplay page with the six standard element types, Enter and Tab flow, autosave in the browser.
- Project list, export and import of `.pardeh` files.
- Bring-your-own-key AI (optional): chat, scene ideas, breakdown, generate from an idea. Twenty
  providers, local or cloud. Pardeh has no server: the key stays in your browser.
- Interface and script in English or Persian, following the writing direction.

## Run it

```sh
npm ci
npm run dev          # http://localhost:5173
npm test             # Vitest
npm run build        # tsc -b && vite build
```

Node 20 or newer.

## Hosting

GitHub Pages. Every push to `main` builds and deploys through
`.github/workflows/deploy.yml`. Set the repository's Pages source to **GitHub Actions** once, in
Settings → Pages.

## Licence

GPL-3.0-only. See `LICENSE`.
