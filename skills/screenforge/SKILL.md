---
name: screenforge
description: Use for any work in the ScreenForge repo, a web screenplay editor for RTL and LTR writers with a bring-your-own-model AI layer. Covers what the product is, how the code is laid out, the rules that must not break, how to test, and what to build next.
---

# ScreenForge

ScreenForge is a free, open-source (GPL-3.0-only) screenwriting app that runs in the browser. It is
built for writers in both directions: Persian/Arabic (RTL) as well as English (LTR). The long-term
goal is a tool where a writer pitches a scene in a sentence or two, the engine writes it, and scene by
scene a full movie script grows; later, filmmakers get breakdowns, shot lists and schedules from the
same script.

It descends from **filmnevis** (`~/filmnevis-explore`, an RTL screenplay editor whose GTK and Qt
prototypes failed on pagination and performance). Read `archive/README.md` there once: it explains
the mistakes this codebase exists to avoid.

## Commands

```sh
npm ci            # node_modules on the owner's Mac are macOS builds; reinstall on Linux
npm run dev       # Vite dev server, http://localhost:5173
npm test          # Vitest (jsdom + fake-indexeddb), all of tests/
npm run build     # tsc -b && vite build — must pass before you call work done
```

There is no linter; TypeScript is `strict` with `noUnusedLocals` / `noUnusedParameters`.

## Map

| Path | What lives there |
| --- | --- |
| `src/core/types.ts` | Document model: `ScreenplayDoc { schemaVersion, meta, direction, blocks[] }`, six `ElementType`s |
| `src/core/flow.ts` | Element order, labels, Enter flow, Tab cycling (ported from filmnevis `constants.py`) |
| `src/core/serialize.ts` | `.screenforge` JSON save/load, tolerant of corrupt or legacy records |
| `src/editor/schema.ts` | TipTap (v2) editor: one `block` node with an `elementType` attr; `tiptapToDoc` |
| `src/editor/keymap.ts` | Enter / Tab / Ctrl+1…6 behaviour |
| `src/editor/blocks.css`, `blockStyle.ts` | Screenplay indents in mm, written as logical CSS (`margin-inline-start`) |
| `src/storage/db.ts` | IndexedDB `screenforge` / store `scripts` — script bodies |
| `src/storage/projects.ts` | Project index in localStorage `sf-projects` |
| `src/storage/autosave.ts` | Debounced autosave with a visible error state |
| `src/ai/client.ts` | One client (`chat`, `listModels`, `AiError`) for every provider: OpenAI-compatible by default, plus small built-in adapters for Claude's Messages API and the OpenCode service |
| `src/ai/types.ts`, `config.ts` | Provider registry (Ollama, LM Studio, OpenAI, Claude, OpenRouter, OpenCode, custom); config in localStorage `sf-ai` |
| `src/ai/rewrite.ts`, `breakdown.ts`, `generate.ts` | Selection rewrite, script breakdown, generate-from-idea |
| `src/ai/assist.ts`, `src/ui/AssistPanel.tsx` | Writer's Assistant: ideas for what happens next or for this scene, fill the gap (inserted at the cursor as one undo step), ask anything; reads the scene around the cursor |
| `src/ui/*` | Toolbar, StatusBar, EditorView, SelectionMenu, FloatingMenu, AiSettings, BreakdownPanel, GeneratePanel |
| `src/App.tsx`, `App.css` | App shell, project switching, design tokens and all component styles |
| `src/i18n.tsx` | English and Persian strings; language follows direction |
| `tests/` | One test file per feature; `tests/setup.ts` loads `fake-indexeddb/auto` |
| `docs/superpowers/specs`, `plans` | Design docs and task-by-task plans; read the newest before a feature |
| `.taste-skill/direction.json` | The visual style contract (framed-sheet), see UI rules |

## Rules that must not break

These come from the filmnevis post-mortems and the design doc. Breaking one is a bug even if tests pass.

1. **Never reformat the whole document per keystroke.** Work per block; keep edits incremental.
2. **No invisible-character hacks.** Empty blocks stay truly empty. Never strip or insert ZWNJ
   (U+200C); it is real Persian spelling.
3. **Direction is first-class.** Use logical CSS (`inline-start/end`, `block-start/end`), never
   `left/right` for script layout. Test every layout change in both `ltr` and `rtl`.
4. **Stored text is never rewritten for display.** Caps for English headings and bold for Persian
   come from styles, not from changing the text.
5. **AI is optional and never blocks the editor.** No provider configured, a timeout or bad output
   must each show a visible state (loading, error with Retry, "open settings"). AI output is inserted
   as plain text or typed blocks, and every insert is one undo step.
6. **AI never silently replaces the writer's text.** It proposes; the writer accepts.
7. **One AI client.** All providers go through `src/ai/client.ts`. Do not add provider SDKs; a provider
   with its own API shape gets a small adapter there (see Claude: `x-api-key`, `anthropic-version`,
   `anthropic-dangerous-direct-browser-access`).
8. **Free components only.** TipTap core (MIT) is fine; no paid/Pro extensions.
9. **No lock-in.** Anything a writer creates must remain exportable.
10. **Licence.** GPL-3.0-only. Code from filmnevis is GPL-3.0 and may be reused; keep Ebrahim Saedi's
    notices. MIT/Apache-2.0 libraries are fine; check anything else before adding it.

## UI rules

- Style is the "framed sheet" in `.taste-skill/direction.json`: tinted frame, white paper sheet with a
  1px edge and 16px corners, no shadow under the sheet. Floating menus and dialogs may shadow.
- Use the tokens at the top of `App.css` (`--ground`, `--surface`, `--raised`, `--active`, `--border`,
  `--rule`, `--control`, `--accent`, `--text`, `--muted`, `--primary`), with light and dark values.
  Add a token for both themes rather than a hard-coded hex.
- Type: Vazirmatn for everything, interface and script, in both Persian and English (the `--font`
  token in `App.css`, loaded from Google Fonts in `index.html`). Sizes 22 / 16 / 14 / 12,
  weights 400 / 500 / 600.
- Language: the interface language follows the writing direction (RTL → Persian, LTR → English).
  Every visible string and aria-label lives in `src/i18n.tsx` (`useT()`, `elementLabel()`); add new
  strings there in both languages, never as literals in components. Persian numbers use Persian digits.
  The empty-page hint is set through `setPlaceholder()` in `src/editor/schema.ts`.
- Buttons use the shared `.sf-control` class (32px, 6px radius); the main action adds `.sf-save`.
  Do not re-scope these to one container again.
- `sf-*` class names, ARIA roles and label texts are part of the test contract. Rename only with the
  tests.
- For UI reviews, use the ibelick `ui-skills` (`improve-ui` audits without editing; `baseline-ui`,
  `fixing-accessibility` for fixes).

## How to work

- Read the newest spec and plan in `docs/superpowers/` before starting a feature. For a new feature,
  write a short spec and a task plan there first, in the same style.
- Test first. Mock AI with `vi.stubGlobal('fetch', …)` returning
  `{ choices: [{ message: { content: '…' } }] }`. Storage tests run on fake-indexeddb.
- Finish with `npm test` and `npm run build` both passing, then check the change in the browser in
  both directions and both themes.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `chore:`), one feature per commit. Commit and
  push only when the human asks.

## Where the project is going

The plan is to merge the newer filmnevis rewrite at `~/filmnevis-explore/filmnevis-app` (Tauri +
TipTap v3 + Typst; own nested git repo) into ScreenForge, then build the pitch loop. Steps, in order;
each must pass its check before the next:

1. **Typst spike: done (Nov 12, 2026).** filmnevis-app's `src/export/typst.ts` renders mixed
   Persian/English A4 pages correctly; a 94-page script compiles in 0.2–0.5 s. Fixed there: Persian
   punctuation (، ؛ ؟ « ») is kept outside isolated English runs. Open: (MORE)/(CONT'D) on page-split
   dialogue, the blank line after scene headings, and a manual copy-paste check of PDF text in a real
   viewer.
2. **TipTap v2 → v3** in ScreenForge with no feature changes. All tests still pass.
3. **Merged document model.** Adopt filmnevis-app's schema v2 (`src/model/schema.ts`: story artifacts
   idea → logline → characters → beats → locations → scenes, each with revision, status and inputs;
   screenplay blocks with id, `lang`, `direction`). Migrate `.screenforge` v1 and stored projects;
   save → reopen must be byte-stable.
4. **Per-block language and direction** (port `src/editor/bidi.ts`). The document toggle becomes the
   default for new blocks.
5. **Preview pane and PDF** from the Typst worker (`src/export/` in filmnevis-app). Editing stays
   continuous; never paginate the editable DOM.
6. **Story bible** panel on the story artifacts, prefilled from Breakdown.
7. **Scene-by-scene pitch loop.** The writer pitches one scene; the engine returns three versions
   using the bible, earlier scene summaries and the previous scene; the writer accepts one as a single
   undoable insert. Accepted scenes are approved artifacts; editing upstream marks later scenes for
   review, never rewrites them.
8. Then: scene navigator, Fountain import/export, Tauri wrapper with OS-keychain API keys (keys are in
   localStorage today, which is a known weakness).

Patterns borrowed from other tools (for context, not code): Dramatron's staged prompting (logline →
characters → scenes → dialogue, Apache-2.0), Sudowrite's story bible, Highland's navigator and sprint
timer, StudioBinder/Filmustage breakdown → shot list → schedule for the later filmmaker layer.

## Open decisions

- Default paper: filmnevis-app uses A4; ScreenForge's design doc says US Letter.
- Which local models write acceptable Persian scenes; test several before choosing defaults.
