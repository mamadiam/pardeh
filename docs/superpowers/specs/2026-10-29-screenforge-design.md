# ScreenForge (working title) — Design Document

Date: 2026-10-29
Status: Draft — pending approval

## Intent & Why

ScreenForge is a web-based screenwriting and filmmaking platform for an **international** audience. It starts as a best-in-class screenplay editor and grows into a production suite (breakdowns, shot lists, storyboards). It is fundamentally enabled by the R&D of [filmnevis](https://github.com/ebrahimsaedi/filmnevis), whose typed-block document model, smart keyboard flows, and RTL-first typography engineering carry over. Filmnevis's two prototypes died on pagination and performance; a browser/DOM approach makes those problems simpler, not harder, because layout measurement is free in the DOM.

**Why this product:** writers need a free, modern alternative to Final Draft; filmmakers need breakdown/production tooling attached to the script itself; and non-English (especially RTL) writers are badly underserved. Selling point: direction-awareness (RTL *and* LTR) is core to the engine, not an afterthought.

## Goals / Non-Goals / Anti-Goals

### Goals (v1)
- **Editor core:** typed-block screenplay editor in the browser — Scene Heading, Action, Character, Parenthetical, Dialogue, Transition (+ Shot and Dual Dialogue as stretch).
- **filmnevis editor options carried over:** smart Enter flow (character → dialogue → character …, Tab to cycle element), Ctrl/Cmd+1…6 element switching, true A4 pagination view, page/scene/word status info, focus mode, per-document direction setting (RTL/LTR).
- **Direction-aware for international users:** every document (and per-section if needed) has a base direction; bilingual/mixed text renders correctly. UI itself ships in English first, RTL UI locales earmarked next.
- **Interchange:** import/export **Fountain** (plain-text screenplay standard); import/export **Final Draft `.fdx`** (XML); export **PDF** to industry conventions (Courier-family page, but honoring document direction).
- **Local-first:** everything works without an account; scripts persist in the browser (IndexedDB) and can be downloaded/uploaded as files (`.fountain`, `.fdx`, `.screenforge` JSON).
- **Project management (light):** multiple scripts, title pages, metadata (title, author, draft, contact).

### Non-Goals (v1 — later phases)
- Real-time multi-user collaboration (CRDTs/presence) — explicitly deferred by product decision.
- Production suite: scene breakdown tags, shot lists, storyboards, call sheets — phase 2+; the typed-block model is designed so each block can gain production metadata later.
- Cloud sync / accounts — phase 2+ (paid layer, below).
- Mobile-native apps (the web app should be usable on tablets, but phones are not a v1 target).
- AI features (deferred; untimed).

### Anti-goals (would make it a failure even if it "works")
- Performance regressions of the filmnevis prototypes: no "reformat the whole document on every keystroke" patterns; no invisible-character hacks for empty blocks (both documented failure causes in the filmnevis post-mortem).
- Not RTL-capable in practice ("we added `direction: rtl` on a div and called it international").
- Lock-in without export: a user must always be able to take their script to Fountain/FDX/PDF.

## Constraints

- **Open-source core, paid extras.** The editor core is GPLv3 (matching filmnevis lineage); accounts, cloud sync, and the eventual production suite are the paid layer. Architecture must let the core build/ship standalone with no server dependency.
- **Single codebase** capable of both directions (RTL/LTR) — no separate builds.
- Pagination must look like a real A4 screenplay page and print/export consistently.
- Personnel constraint: small team (solo + AI-assisted development), so boring, well-trodden tech over exotic choices.

## Approaches Considered

1. **Route A — Editor first (CHOSEN).** Build the screenwriting editor web app first; attach the production suite later to real documents. Fastest path to real users, de-risks the document spine everything depends on.
2. **Route B — Suite first.** Project workspace + breakdown/shot-list tools first, editor as the inner piece. More differentiated but heavier; builds the suite on an untested final product. Likely phase 2 of Route A anyway.
3. **Route C — Finish the desktop filmnevis Qt app, then port.** Rejected: international market favors web distribution; the code would be rewritten twice.

## Decided — How It Gets Built

These were decided in conversation or are my calls marked **[builder-call]**; ones left open are in "What's left to the builder".

- **Platform & stack** **[builder-call]:** TypeScript web app, Vite + React, **TipTap (ProseMirror)** for the editor. ProseMirror's block/attribute model maps directly onto typed screenplay blocks, supports custom node types, RTL is native to the DOM, and the plugin ecosystem solves history, keymaps, and input rules we'd otherwise hand-roll.
- **Document model:** a block list — each block = { type ∈ {scene, action, character, parenthetical, dialogue, transition, shot, dual-dialogue-l/r}, text, direction?, metadata? }. Plain ts type + JSON serialization (`.screenforge` file, schema-versioned like filmnevis's). Fountain parsing/serialization derives from this list 1:1.
- **RTL/LTR:** document-level `direction` property; text runs rely on native Unicode bidi; block-level alignment follows base direction (filmnevis's mm-precise indent spec adapted per direction). UI strings via an i18n layer from day one so Persian/Arabic locale UI is a translation, not a rebuild.
- **Pagination:** paginate by measuring rendered block heights against the page content box (DOM layout is cheap; this avoids the Qt prototype's `QAbstractTextDocumentLayout` battle). **The paginated view IS the editing surface** — screenplay writers expect to type on pages — but pagination is *incremental*, not recompute-the-world: block heights are memoized and an edit only re-breaks pages from the first changed block onward (this avoids filmnevis's failure mode instead of repeating it). Page-break calc handles "keep character with dialogue" widow rules as a refinement.
- **Page size:** A4 (decided Nov 14, 2026; matches filmnevis-app and most non-US markets). Print CSS and pagination stay parameterized on the page size, so US Letter can be added later as a per-document option for FDX/Fountain interchange.
- **Performance budget** **[builder-call]:** keystroke→paint ≤ 32 ms on a full-length (120-page / ~35k-word) feature; incremental page-break recompute after an edit ≤ 50 ms; full-file import ≤ 3 s. Phase 1 must include height caching + windowed rendering groundwork; retrofitting these is expensive.
- **Editor library licensing** **[builder-call]:** commit only to freely-licensed components (TipTap v2 core is MIT; avoid any paid/Pro extensions — we need none of them: our custom block types are our own nodes anyway). Checklist verified in a Phase 1 spike; pre-registered fallback if licensing turns out murky: raw ProseMirror (the layer beneath TipTap, MIT) — the architecture doesn't change either way.
- **filmnevis artifacts to inherit:** the element-flow table, indent spec (mm per element), and constants live in `archive/qt-version/filmnevis/constants.py` of the filmnevis repo; derive the web keymap/flow config from it (re-specced in metric + imperial), no reverse-engineering needed.
- **FDX quality bar:** v1 acceptance = elements and text survive a round trip of a *normal* Final Draft script; unknown/custom element types fall back to Action with a warning; inline notes and revision marks are skipped gracefully (not silently dropped from the story text itself). Test fixtures: real `.fdx` exports (final-draft samples + community scripts) collected in Phase 2 alongside the Fountain corpus.
- **PDF export:** print-stylesheet route first (`window.print` / CSS paged media onto A4) — good enough for v1; PDF.js-based generation later only if print proves insufficient.
- **Storage:** IndexedDB via a small wrapper; export buttons for files. No backend in v1.
- **Keymap:** Enter advances per element-flow table (inherited from filmnevis's flow config); Tab / Shift+Tab cycle elements; Ctrl/Cmd+1…8 direct element switching.
- **Name:** ScreenForge is a placeholder; rename is a find/replace-level concern, no architectural dependency.
- **Paid layer (decided now):** the public repo *is* the core; the paid layer (accounts, sync, collab, production suite) is a **separate private server/plugin layer that composes the public core**, never gated-bundled into the OSS build. Core extension points (e.g., per-block production metadata fields in the document schema) get designed into Phase 1 so the suite can attach later.

## What's Left to the Builder

- Exact package versions and skeleton (repo layout, CI).
- Editor node schema details inside ProseMirror (attrs vs. marks) — implementer's judgment guided by the block model above.
- Fountain spec edge cases: the [Fountain syntax spec](https://fountain.io) is the source of truth; importer must handle scenes, forced elements, title pages, and continuous-paragraph actions.
- PDF/print styling details (margins, font fallbacks — Courier Primary/Prprime alternate, plus an RTL-friendly serif fallback like Sahel-class fonts).
- The `.screenforge` file UX: doing downloads vs. File System Access API — either acceptable if it degrades gracefully.

## Phasing

1. **Phase 1 — Editor core:** TipTap schema + typed blocks, smart flows, shortcuts, autosave to IndexedDB, document direction toggle, focus mode.
2. **Phase 2 — Interchange:** Fountain import/export; FDX import/export; file open/save.
3. **Phase 3 — Pages:** A4 pagination view + PDF/print export.
4. **Phase 4 — Shell:** script library (multiple projects), title pages, exports polish; UI i18n plumbing checked by adding one RTL locale stub.
5. **Phase 5 (later, paid):** cloud accounts, sync, real-time collab, production suite (breakdowns/shot lists/storyboards).
