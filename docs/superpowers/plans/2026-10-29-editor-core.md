# ScreenForge Phase 1 — Editor Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser screenplay editor with typed blocks (filmnevis's six element types), smart Enter/Tab/hotkey flows, RTL/LTR document direction, IndexedDB autosave, element toolbar/status bar, and focus mode.

**Architecture:** Local-first SPA, no backend. A pure TypeScript "core" (document model, serialization, flow engine) that the TipTap/ProseMirror editor and React UI consume. Element type is a single node attribute, so cycling is `updateAttributes` — no node-type juggling. All later phases (interchange, pagination, cloud) attach to the core's `ScreenplayDoc` type.

**Tech Stack:** Vite + React + TypeScript, TipTap v2 (free core only, MIT), vitest + jsdom + @testing-library/react + fake-indexeddb, raw IndexedDB (no wrapper library).

**Spec:** `docs/superpowers/specs/2026-10-29-screenforge-design.md` (screenplay blocks inherited from filmnevis's `archive/qt-version/filmnevis/constants.py` and `editor.py` `_handle_enter` semantics).

## Global Constraints

- License GPLv3; repo carries `LICENSE` (copy from filmnevis repo) and `package.json` `"license": "GPL-3.0-only"`.
- Only freely-licensed TipTap packages: `@tiptap/core`, `@tiptap/react`, `@tiptap/pm`. No `@tiptap/extension-*` pro/paid modules. If a needed primitive turns out licensed, use raw ProseMirror (`prosemirror-*`) directly instead.
- Document direction default is `'ltr'`; per-document setting, not per-block.
- Element values are exactly: `scene | action | character | parenthetical | dialogue | transition` (filmnevis's `ELEMENT_ORDER`).
- Indent spec carried from filmnevis constants.py, as logical (direction-aware) CSS: scene 0, action 0, character 55.9mm, parenthetical 40.6mm, dialogue 25.4mm, transition 55.9mm on the inline-start side (filmnevis's transition "push to opposite side" simplified; align follows the block flow).
- Persistence is IndexedDB only; app must keep working in memory if storage fails.
- No pagination, no Fountain/FDX import, no cloud in this phase.

## Review Focus

1. **Enter on an empty block must keep the same element** (filmnevis `_handle_enter` line 507-508) — a writer rattling Enter to leave blanks must get blanks of the same type, not advancing flow. → Test in Task 3 (`nextOnEnter` empty case) and Task 5 (chained Enter command test).
2. **Unknown/corrupt block data on load** (hand-edited `.screenforge` JSON, future schemas) — must map unknown types to `action` with a warning list returned, never throw on the UI. → Test in Task 2.
3. **IndexedDB unavailable** (private browsing, storage disabled) — autosave failure is caught and surfaced in the status bar; editing continues in memory. → Test in Task 7 with a rejecting fake.
4. **Mixed-direction text inside a block** (Arabic line inside an LTR doc) — native Unicode bidi must do the work; block styling must use logical properties (`margin-inline-start`), never `margin-left/right`. → Test in Task 4 (`blockStyle` logical-props assertion).
5. **Consecutive Enter over multiple blocks** (spam flow) — each new block's type computed from the block before the split, in sequence. → Test in Task 5 (scene→action→scene→action chain).

---

### Task 1: App scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `.gitignore`, `LICENSE`

**Interfaces:**
- Produces: runnable Vite React-TS app with `npm test` (vitest + jsdom environment, `@testing-library/react`, `fake-indexeddb` as devDependencies) wired; `tests/` directory convention.

- [ ] **Step 1: Scaffold** `npm create vite@latest . -- --template react-ts` in repo root, add devDeps above, `npm install`.
- [ ] **Step 2: Verify** `npm run dev` serves on localhost; `npm test` runs (0 tests OK); replace default App with placeholder `<div>ScreenForge</div>`.
- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vite React-TS app with vitest"
```

### Task 2: Document model & `.screenforge` serialization

**Files:**
- Create: `src/core/types.ts`, `src/core/serialize.ts`
- Test: `tests/serialize.test.ts`

**Interfaces:**
- Produces:
```ts
// types.ts
export const SCHEMA_VERSION = 1
export type ElementType = 'scene' | 'action' | 'character' | 'parenthetical' | 'dialogue' | 'transition'
export type Direction = 'ltr' | 'rtl'
export interface ScreenplayMeta { title: string; author: string; created: string; modified: string }
export interface ScreenplayBlock { type: ElementType; text: string }
export interface ScreenplayDoc { schemaVersion: number; meta: ScreenplayMeta; direction: Direction; blocks: ScreenplayBlock[] }
export function emptyDoc(): ScreenplayDoc   // dir 'ltr', one empty action block, ISO timestamps, empty title/author

// serialize.ts
export function saveToJson(doc: ScreenplayDoc): string   // JSON, updates meta.modified, ensure_ascii=false equivalent (no escaping)
export function loadFromJson(json: string): { doc: ScreenplayDoc | null; error?: string; warnings: string[] }
```

- [ ] **Step 1: Write failing tests** — round trip (save→load equality), unknown block type `{"type":"whatever","text":"x"}` becomes `{type:"action"}` plus `warnings` contains `"unknown element type"`; malformed JSON string returns `{doc:null, error:"invalid file"}` (never throws).
- [ ] **Step 2: Run — expect FAIL** (`npm test`).
- [ ] **Step 3: Implement** both modules.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `feat: screenplay document model and .screenforge serialization`.

### Task 3: Flow engine (filmnevis port)

**Files:**
- Create: `src/core/flow.ts`
- Test: `tests/flow.test.ts`

**Interfaces:**
- Consumes: `ElementType` from Task 2.
- Produces:
```ts
export const ELEMENT_ORDER: readonly ElementType[]   // ['scene','action','character','parenthetical','dialogue','transition']
export const ELEMENT_LABEL: Record<ElementType, string> // 'Scene Heading','Action','Character','Parenthetical','Dialogue','Transition'
export function nextOnEnter(type: ElementType, blockText: string): ElementType
export function cycleElement(type: ElementType, step: 1 | -1): ElementType   // wraps ELEMENT_ORDER
export function hotkeyElement(n: number): ElementType | null                  // 1..6 → ELEMENT_ORDER[n-1], else null
```
`nextOnEnter` implements filmnevis `_handle_enter` (editor.py:493): `parenthetical → 'dialogue'`; `transition → 'scene'`; blank `blockText` (empty) → same `type`; otherwise filmnevis constants `next` map: scene→action, action→scene, character→dialogue, dialogue→character.

- [ ] **Step 1: Write failing tests** — every mapping row above; empty-block case (`nextOnEnter('dialogue','') === 'dialogue'`); cycle wrap (`transition` +1 → `scene`, `scene` -1 → `transition`); hotkeys 1..6 and 7→null.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** (data + pure functions; no DOM).
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `feat: element flow engine ported from filmnevis`.

### Task 4: TipTap schema — screenplay blocks + direction

**Files:**
- Create: `src/editor/schema.ts`, `src/editor/blockStyle.ts`, `src/editor/blocks.css`
- Test: `tests/blockStyle.test.ts`

**Interfaces:**
- Consumes: `ElementType`, `ScreenplayDoc`, `ScreenplayBlock` (Task 2), `ELEMENT_LABEL` (Task 3).
- Produces:
```ts
// schema.ts — the single custom TipTap node
export interface BlockAttrs { elementType: ElementType; textAlign?: null }
export const BlockNode: Node   // name 'block', attr elementType default 'action',
                               // renderHTML: ['div', { 'data-element-type': type, 'class': `sf-block sf-${type}` }]
export function docToTiptapContent(doc: ScreenplayDoc): JSONContent[]
export function tiptapToDoc(content: JSONContent[], meta: ScreenplayMeta, direction: Direction): ScreenplayDoc
export function createEditor(doc: ScreenplayDoc): Editor   // StarterKit only for baseline (it's MIT), plus BlockNode

// blockStyle.ts
export function blockStyle(type: ElementType, direction: Direction): React.CSSProperties
// returns logical properties only: marginInlineStart per spec indents; no left/right properties allowed
```
blocks.css: blank-line spacing (`marginBlockStart: 0.8em` for scene/action/character/transition tops; 0 for parenthetical/dialogue), font settings.

- [ ] **Step 1: Write failing test** — `blockStyle('character','rtl')` has `marginInlineStart: '55.9mm'` and object keys contain no `marginLeft`/`marginRight`; `blockStyle('action', …)` empty indent; `docToTiptapContent(emptyDoc())` yields one `block` node `elementType 'action'`; round trip `tiptapToDoc(docToTiptapContent(d), d.meta, d.direction)` equals `d`.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `feat: tiptap screenplay schema with directional block styling`.

### Task 5: Keyboard behavior — Enter flow, Tab cycle, hotkeys, "(" trick

**Files:**
- Create: `src/editor/keymap.ts`
- Modify: `src/editor/schema.ts` (`createEditor` adds the extension)
- Test: `tests/keymap.test.ts`

**Interfaces:**
- Consumes: `nextOnEnter`, `cycleElement`, `hotkeyElement` (Task 3); `BlockNode`, `createEditor` (Task 4).
- Produces:
```ts
export const SmartKeys: Extension   // adds commands:
//   editor.commands.smartEnter   — splits current block; new block elementType = nextOnEnter(currentType, textBeforeCursor)
//   editor.commands.cycleElement(step: 1 | -1) — updateAttributes elementType on all selected block(s)
// keymap binds: Enter→smartEnter; Tab→cycleElement(1); Shift-Tab→cycleElement(-1); Mod-1..Mod-6→hotkeyElement
// InputRule: "(" at empty block start → set elementType 'parenthetical' (filmnevis editor.py:485)
```
Command semantics note: on Enter with non-empty text, TipTap `splitBlock` runs first (cursor position determines split), then the new node's attr is set — implement as one editor transaction.

- [ ] **Step 1: Write failing command tests** (drive `editor.commands.*` directly, not synthetic key events — binding is declarative): after smartEnter from a block with text `INT. HOUSE - NIGHT` (scene) → new trailing block `action`; chain 3 smartEnters → action→scene→action; smartEnter on empty dialogue → still `dialogue` (covers empty case at editor level); cycleElement(-1) on dialogue → `character`; command `setElementType via Mod-3` equivalent → `character`.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** keymap extension + input rule.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `feat: smart enter flow, tab cycling, element hotkeys`.

### Task 6: UI — toolbar, status bar, direction toggle, focus mode

**Files:**
- Create: `src/ui/Toolbar.tsx`, `src/ui/StatusBar.tsx`, `src/ui/EditorView.tsx`
- Modify: `src/App.tsx`, `src/main.tsx`
- Test: `tests/ui.test.tsx`

**Interfaces:**
- Consumes: `createEditor` (Task 4), `ELEMENT_LABEL` (Task 3), `saveToJson`/`loadFromJson` (Task 2).
- Produces: `EditorView` owns a TipTap `Editor` instance and exposes `editor: Editor`; App renders Toolbar (element `<select>` driving `setElementType`, Save button → downloads `<title>.screenforge` via Blob), StatusBar (current element label of cursor block, whitespace-split word count, direction toggle button setting `dir` on the page container `data-direction`, focus toggle button).

- [ ] **Step 1: Write failing tests** — direction toggle sets container `dir="rtl"` and back to `"ltr"` when toggled again; word count of "Hello world there" shows `3`; toolbar select change sets cursor block `elementType` (via RTL fireEvent); focus toggle adds class `sf-focus` on root (and CSS hides toolbar/status, one rule).
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** components (rough Tailwind-free CSS is fine this phase).
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `feat: editor UI with element toolbar, status bar, direction and focus toggles`.

### Task 7: IndexedDB persistence + autosave

**Files:**
- Create: `src/storage/db.ts`, `src/storage/autosave.ts`
- Test: `tests/db.test.ts`

**Interfaces:**
- Produces:
```ts
// db.ts — raw IndexedDB: db 'screenforge' v1, objectStore 'scripts' (keyPath 'id')
export function openDb(): Promise<IDBDatabase>          // rejects if indexedDB unavailable
export function saveDoc(id: string, doc: ScreenplayDoc): Promise<void>
export function loadDoc(id: string): Promise<ScreenplayDoc | null>
// autosave.ts
export function useAutosave(editor: () => ScreenplayDoc, id: string, deps: unknown[]): { status: 'saved' | 'error' | 'pending' }
```
Autosave debounce 800ms after last update; `saveDoc` rejection → `status 'error'` caught, editing continues (Review Focus 3). Old scripts load on mount with the fixed key `'current'`; absence → `emptyDoc()`.

- [ ] **Step 1: Write failing tests** (run with fake-indexeddb in the vitest setup): save→load roundtrip; load of missing id → null; autosave with a **rejecting** `openDb` records status `'error'` and does not unmount/crash the editor (covered by calling `useAutosave` via renderHook, imperatively invoked saver).
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `feat: local persistence with debounced autosave and graceful failure`.

### Task 8: Wire-up & whole-flow verification

**Files:**
- Modify: `src/App.tsx` (create editor from stored doc if present; autosave hook; save button; direction persisted into `ScreenplayDoc.direction`)
- Test: `tests/app-flow.test.tsx`

**Interfaces:**
- Consumes everything above. Produces: the phase-1 deliverable — open app, type, refresh, content returns.

- [ ] **Step 1: Write failing integration test** — render App, type "INT. HOUSE - NIGHT" then Enter then "The lights flicker."; reload simulation: unmount, render fresh App with same fake-indexeddb; assert both lines present at correct element types.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Wire** App state: editor init from `loadDoc('current')`, autosave, direction toggling writes back to doc.
- [ ] **Step 4: Run full suite — expect PASS.**
- [ ] **Step 5: Manual check** — `npm run dev`: write a few paragraphs in LTR, toggle RTL (text and indents mirror), Enter-flow behaves per filmnevis (Character → Dialogue → Character), focus mode hides chrome, download `.screenforge` file opens as valid JSON. Note anything felt in the Review Focus categories (latency, bidi glitches).
- [ ] **Step 6: Commit** `feat: phase 1 wired editor — typed blocks, smart flows, autosave, direction, focus mode`.
