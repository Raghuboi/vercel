import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { keychainHasGenericPassword } from './keychain';

/**
 * Best-effort detection of pre-existing agent logins that would conflict with
 * the gateway setup. Same philosophy as `desktop-apps.ts`: cheap local checks,
 * a missed detection only means no warning, and nothing here ever throws.
 * Detection keys on credential artifacts only — never on the mere existence of
 * a config directory, which agents create on first launch regardless of login.
 */

/** macOS Keychain service Claude Code stores its `/login` OAuth credentials under. */
const CLAUDE_KEYCHAIN_SERVICE = 'Claude Code-credentials';

function readJson(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * True when Claude Code has an Anthropic `/login` session. The OAuth
 * credentials live in `.credentials.json` inside the config dir on Linux/WSL
 * and in the macOS login Keychain on darwin; `~/.claude.json` (or
 * `$CLAUDE_CONFIG_DIR/.claude.json`) keeps an `oauthAccount` record either
 * way. File signals first; the Keychain probe checks metadata only and never
 * reads the secret.
 */
export function hasClaudeCodeLogin(home: string, claudeDir: string): boolean {
  try {
    if (existsSync(join(claudeDir, '.credentials.json'))) {
      return true;
    }
    for (const path of [
      join(home, '.claude.json'),
      join(claudeDir, '.claude.json'),
    ]) {
      const config = readJson(path);
      if (config?.oauthAccount) {
        return true;
      }
    }
    return keychainHasGenericPassword(CLAUDE_KEYCHAIN_SERVICE);
  } catch {
    return false;
  }
}

/**
 * True when Codex is signed in: `auth.json` in the Codex dir holds either
 * ChatGPT OAuth tokens or a stored OPENAI_API_KEY.
 */
export function hasCodexLogin(codexDir: string): boolean {
  try {
    return existsSync(join(codexDir, 'auth.json'));
  } catch {
    return false;
  }
}
