# Agent guide

Pardeh (پرده, first named ScreenForge) is a GPL-3.0 web screenplay editor for RTL (Persian/Arabic) and LTR writers, built with
React, Vite, TypeScript and TipTap, with an optional bring-your-own-model AI layer.

**Read `skills/pardeh/SKILL.md` before changing anything.** It has the code map, the rules
that must not break, the UI contract, the test approach and the roadmap.

## Quick reference

```sh
npm ci && npm test && npm run build   # all must pass before work is done
npm run dev                           # http://localhost:5173
```

## Never

- Reformat the whole document on each keystroke, or use invisible characters for empty blocks.
- Strip or insert ZWNJ (U+200C), or use `left`/`right` CSS for script layout (use logical properties).
- Let AI block the editor or replace the writer's text without an explicit accept.
- Add provider SDKs (use `src/ai/client.ts`), paid TipTap extensions, or non-GPL-compatible code.
- Commit or push unless the human asks.
