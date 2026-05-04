// Buyer-side AI translation helper for the React Native app.
//
// Wraps the existing translateText() from ./grokTranslate (which routes to
// the maabar-ai edge function with task=chat_translation, per migration
// commit a897f5c) and adds:
//   - lightweight source-language detection (CJK / Arabic / English)
//   - in-memory cache keyed by source|target|text, so repeated reads of the
//     same supplier description on the same screen don't re-hit the API
//   - graceful fallback: any failure returns the original text untouched
//     and an `error` flag so the UI can suppress the "AI translated" pill
//
// Same shape as web/src/lib/aiTranslate.js so call sites are uniform.
// The cache lives only for the screen session (unmount/refresh clears it).

import { translateText as edgeTranslate } from './grokTranslate';

const SUPPORTED = ['ar', 'en', 'zh'];

// Module-level cache. Key: `${sourceLang}|${targetLang}|${text}`.
// Value: { translated, sourceLang, error }.
const cache = new Map();

export function detectSourceLang(text) {
  if (!text || typeof text !== 'string') return 'en';
  // CJK Unified Ideographs (covers most simplified + traditional Chinese)
  if (/[一-鿿]/.test(text)) return 'zh';
  // Arabic basic block
  if (/[؀-ۿ]/.test(text)) return 'ar';
  return 'en';
}

/**
 * Translate `text` from its detected (or hinted) source language to
 * `targetLang`. Always resolves — never throws. Same-language input,
 * empty input, and API failures all return `{ translated: <input>, error }`.
 *
 * @param {string} text
 * @param {'ar'|'en'|'zh'} targetLang
 * @param {'ar'|'en'|'zh'} [sourceLangHint] - skip detection if known
 * @returns {Promise<{translated: string, sourceLang: string, error: string|null}>}
 */
export async function translateText(text, targetLang, sourceLangHint) {
  const trimmed = (text || '').trim();
  if (!trimmed) return { translated: '', sourceLang: targetLang || 'en', error: null };

  const target = SUPPORTED.includes(targetLang) ? targetLang : 'en';
  const source = SUPPORTED.includes(sourceLangHint) ? sourceLangHint : detectSourceLang(trimmed);

  if (source === target) {
    return { translated: trimmed, sourceLang: source, error: null };
  }

  const cacheKey = `${source}|${target}|${trimmed}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const translated = await edgeTranslate({
      text: trimmed,
      sourceLang: source,
      targetLang: target,
    });
    const ok = typeof translated === 'string' && translated.trim().length > 0;
    const result = {
      translated: ok ? translated.trim() : trimmed,
      sourceLang: source,
      error: ok ? null : 'empty_response',
    };
    cache.set(cacheKey, result);
    return result;
  } catch (err) {
    const result = {
      translated: trimmed,
      sourceLang: source,
      error: (err && err.message) || 'translation_failed',
    };
    cache.set(cacheKey, result);
    return result;
  }
}
