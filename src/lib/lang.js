// Module-level language store with SecureStore persistence.
//
// Set via setLang() (synchronous, stays in memory for fast access by every
// screen) and asynchronously mirrored to SecureStore so the choice survives
// app kills / cold launches. Codes match web: 'ar' | 'en' | 'zh'.
//
// Read with getLang() anywhere; call loadLang() once during app boot
// (RootNavigator) to hydrate _lang from SecureStore before any screen mounts.

import * as SecureStore from 'expo-secure-store';

const LANG_KEY = 'maabar_lang';
const VALID = new Set(['ar', 'en', 'zh']);

let _lang = 'ar';

export function getLang() { return _lang; }

export function setLang(code) {
  const normalized = String(code || 'ar').toLowerCase();
  _lang = VALID.has(normalized) ? normalized : 'ar';
  // Fire-and-forget persist — keeps setLang synchronous so existing callers
  // (LanguageScreen, AccountScreen) don't need to be made async.
  SecureStore.setItemAsync(LANG_KEY, _lang).catch((e) => {
    console.warn('[lang] failed to persist to SecureStore:', e?.message || e);
  });
}

// Hydrate _lang from SecureStore. Returns the resolved code so the caller can
// reason about whether anything was previously stored.
export async function loadLang() {
  try {
    const stored = await SecureStore.getItemAsync(LANG_KEY);
    if (stored && VALID.has(stored)) {
      _lang = stored;
      return stored;
    }
  } catch (e) {
    console.warn('[lang] failed to read SecureStore:', e?.message || e);
  }
  return _lang;
}
