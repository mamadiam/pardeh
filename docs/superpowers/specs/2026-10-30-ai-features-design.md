# ScreenForge AI — design note (2026-10-30)

## Intent
Two AI features on one provider layer, per product decision: **(2) selection rewrite menu** and **(3) script analysis/breakdown** (early groundwork for the production suite).

## Provider layer (foundation)
- All providers speak the OpenAI-compatible `POST {baseURL}/chat/completions`; one client, four configs + a custom OpenAI-compatible endpoint (covers OpenCode's serve endpoint):
  - Ollama `http://localhost:11434/v1` (no key), LM Studio `http://localhost:1234/v1` (no key)
  - OpenAI `https://api.openai.com/v1` (key), OpenRouter `https://openrouter.ai/api/v1` (key), Custom endpoint + optional key
- Model discovery: `GET {baseURL}/models` → list; Ollama fallback `GET /api/tags`.
- Config (provider, endpoint override, model, key) in localStorage; "Test connection" button; a failing provider never blocks the editor (both AI features are optional affordances).
- No streaming in v1 (both flows are one-shot). Requests have a 60s timeout.

## Feature 2 — Selection rewrite
- Select text → floating menu (Rewrite ▾): Polish / Shorten / Expand / Custom instruction. One fetch; result replaces **only the selected range** after a confirm-free replace (undo via Cmd+Z).
- Prompt carries: instruction, element type of the current block, document direction ("preserve language and directionality"), and the selection text with a sentence of surrounding block context.

## Feature 3 — Analysis & breakdown
- Top-bar "Breakdown" button → modal panel: sends the full script as plain text (blocks, typed labels) → provider returns JSON `{ logline, characters:[{name,description}], locations:[], scenes:[{title,summary}] }`.
- Lenient JSON parse (strip fences; on garbage → error state with retry). Results held in memory for the session; a rerun costs a call — stated in the UI.
- States per app rules: loading (labels shown at once), error inline with Retry, "no provider configured" with a link to settings.

## Non-goals (v1)
Streaming, inline ghost-text suggestions, training/fine-tuning, cloud sync of keys, GPU config for local runtimes.

## Builder calls
- Rewrite menu positioned by clamped selection rect; keyboard: Esc closes, Enter in custom field applies.
- Breakdown JSON schema validation: manual point-checks, not a schema lib.
- Anti-goals kept: no invisible-char tricks (paste of AI output is plain text insert), no blocking editor while a request runs.
