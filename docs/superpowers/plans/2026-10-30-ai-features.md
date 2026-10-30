# AI Features Implementation Plan (selection rewrite + breakdown + provider layer)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (native). TDD every task.

**Goal:** provider-pluggable AI inside ScreenForge — a selection rewrite menu and a script breakdown panel, working with Ollama, LM Studio, OpenAI, OpenRouter or any OpenAI-compatible endpoint.

**Spec:** `docs/superpowers/specs/2026-10-30-ai-features-design.md`

## Global Constraints
- One OpenAI-compatible client for all providers; no provider SDKs added.
- A misconfigured/absent provider never blocks the editor; every AI affordance degrades to a visible state.
- Editor DOM/test contract from Phase 1 must not break (sf-* classnames, roles, label texts).
- No gradient/emblem styling: components follow the dealt framed-sheet tokens.

## Global test data & mock
tests use `vi.stubGlobal('fetch', …)` returning canned completions:
`{ choices: [{ message: { content: 'REWRITTEN TEXT' } }] }` and for breakdown a JSON string.

---

### Task 1: AI config (model + storage)
Files: create `src/ai/types.ts` (AiConfig, PROVIDERS registry with id,label,baseURL,needsKey), `src/ai/config.ts` (load/save/normalize; rejects unknown provider ids → 'ollama' default), test `tests/ai-config.test.ts` (round trip; unknown id fallback; localStorage mocked via vi.stubGlobal).

### Task 2: Provider client
Files: create `src/ai/client.ts`: `chat(cfg, messages, opts: { signal?: AbortSignal }) → Promise<string>` posting to `${baseURL}/chat/completions`, Bearer key when cfg.apiKey, 60s timeout (AbortController), throws typed AiError('no-config'|'http-429'|'http-'|'network'). `listModels(cfg) → string[]` GET `${baseURL}/models`, fallback `GET /api/tags` (ollama shape `{models:[{name}]}`) — try models → catch → tags → throw. Test `tests/ai-client.test.ts`: success path URL+auth header+content; key omitted for local providers; timeout→AiError network; fallback tag listing; non-2XX→AiError 'http-429' carries status.

### Task 3: Settings dialog
Files: create `src/ui/AiSettings.tsx` (+ CSS in App.css): modal panel (framed-sheet: white surface, 16px radius, 1px border, no shadow unless floating is allowed — modal may shadow), fields: provider select, endpoint (prefilled on provider switch), model (select populated by listModels with "refresh" icon-button; datalist fallback), key input (password, only when needsKey), Test connection inline state (ok → green pill-positive 'Works', err → pill-negative text). Persistence via Task 1 on Save. Wire: gear icon-button in StatusBar; dialog opens Editor-wide; not part of focus-mode hiding. Test `tests/ai-settings.test.tsx`: open, pick OpenAI → key field appears; switch Ollama → field hidden, endpoint prefilled; save persists via load.

### Task 4: Selection rewrite
Files: create `src/ui/SelectionMenu.tsx` + hook `src/ai/rewrite.ts`: `rewriteSelection(cfg, editor, kind|instruction)` — builds messages (system: "You are a screenwriting assistant. Output ONLY the rewritten text, no quotes, no commentary. Preserve the script's language and direction."), user: element label + block text + selection + instruction; replaces selection range via `editor.chain().focus().insertContentAt({from,to}, result).run()`. Menu shows above clamped selection rect; actions 4 + input; Esc closes; while pending, menu shows 'Rewriting…' (editor stays usable); error shows one-line reason w/ Retry. Trigger: native selection inside the editor's PaperProseMirror with a mouseup/selectionchange debounce (no menu when empty selection or selection not inside editor). Test `tests/ai-rewrite.test.tsx`: stub fetch; select a block, click Shorten → fetch called once with prompt containing element label + selection; doc text replaced with mocked output; fetch stub rejects → menu shows error line; Esc closes.

### Task 5: Breakdown panel
Files: create `src/ai/breakdown.ts` (`buildBreakdownPrompt(doc)`: full plain text with per-block labels, capped at ~24k chars; `parseBreakdown(raw)` lenient: strip fences, JSON.parse, check fields exist-ish else AiError 'bad-json') and `src/ui/BreakdownPanel.tsx`: modal with Logline (18/600), Characters (name + description rows), Locations, Scenes (title + summary); states loading/error/empty per app rules; 'Run breakdown' button; when cfg missing → message + 'Open settings' link. Test `tests/ai-breakdown.test.ts`: prompt includes every block; parse accepts fenced JSON, rejects garbage with AiError; component states (loading with labels, error line, rendered sections from stub data).

### Task 6: Shell wiring
Files: modify `src/ui/StatusBar.tsx` (gear icon-button) + `src/ui/Toolbar.tsx` ('Breakdown' secondary control) or App topbar: add Breakdown button beside Focus (before Save). States render inside App. Test `tests/ai-shell.test.tsx`: buttons exist; removing no existing role (element select, focus, save status gate). Suite stays 100%.

### Task 7: Whole-flow verification
Manual: `npm run dev` with Ollama running — pick ollama + model, rewrite a selection, run breakdown; RTL doc direction respected in the modal. Ledger + commit. No Playwright.
