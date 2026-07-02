---
'vercel': patch
---

`ai-gateway coding-agents connect` now detects the Codex desktop app and asks for consent before configuring Codex, since the desktop app cannot use custom model providers and stops working when one is set (the Codex CLI keeps working). Non-interactive and `--yes` runs configure Codex only when it is explicitly requested with `--agent`/`--all`; JSON output gains a `warnings` array and a `requires_consent` skip reason, and a run refused for lack of consent exits 1 with a self-contained `requires_consent` error payload (structured warnings, skip entries, and a runnable `next[]` command). A skipped agent's existing shell exports and configuration are always left untouched. The same consent flow now also warns when Claude Code is logged in with an Anthropic account (the gateway token would trigger its startup auth-conflict notice) or when Codex has a ChatGPT/OpenAI login that would stop being used.
