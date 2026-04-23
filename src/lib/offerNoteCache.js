// Client-side cache for auto-translated offer notes.
// Buyers can't write note_ar/en/zh to Supabase (guard_offer_write blocks it),
// so translations are persisted per-device in AsyncStorage keyed by
// `offer.id + lang` and stay valid as long as the source note doesn't change.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { translateText, isSupportedLang } from './grokTranslate';

const KEY_PREFIX = 'offerNote:v1:';

function cacheKey(offerId, lang) {
  return `${KEY_PREFIX}${offerId}:${lang}`;
}

export async function readCachedNote(offerId, lang) {
  if (!offerId || !isSupportedLang(lang)) return null;
  try {
    const raw = await AsyncStorage.getItem(cacheKey(offerId, lang));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.text === 'string' ? parsed : null;
  } catch (e) {
    console.error('[offerNoteCache] read error:', e);
    return null;
  }
}

export async function writeCachedNote(offerId, lang, text, source) {
  if (!offerId || !isSupportedLang(lang) || !text) return;
  try {
    await AsyncStorage.setItem(
      cacheKey(offerId, lang),
      JSON.stringify({ text, source, at: Date.now() }),
    );
  } catch (e) {
    console.error('[offerNoteCache] write error:', e);
  }
}

// Pick the best source language note present on the offer.
// Prefer the explicit note_{ar,en,zh} columns. When only the legacy plain
// `note` column is populated, assume zh — the supplier pool on this platform
// is Chinese, and every observed legacy note has been Chinese in practice.
function pickTranslatableSource(offer, targetLang) {
  const priority = ['en', 'ar', 'zh'].filter((l) => l !== targetLang);
  for (const l of priority) {
    const val = offer[`note_${l}`];
    if (val && String(val).trim()) {
      return { sourceLang: l, text: String(val).trim() };
    }
  }
  const legacy = offer.note;
  if (legacy && String(legacy).trim() && targetLang !== 'zh') {
    return { sourceLang: 'zh', text: String(legacy).trim() };
  }
  return null;
}

// Resolve the note to display in `lang`:
//   1. offer.note_{lang} present       → return it (no translation needed)
//   2. cached translation present      → return it
//   3. another note_{src} present      → translate via Grok, cache, return it
//   4. nothing translatable            → return null (caller falls back to pickNote)
//
// Returns { text, source } where source is 'supplier' | 'cache' | 'auto' | null.
export async function resolveOfferNote(offer, lang) {
  if (!offer || !isSupportedLang(lang)) return { text: null, source: null };

  const supplied = offer[`note_${lang}`];
  if (supplied && String(supplied).trim()) {
    return { text: String(supplied).trim(), source: 'supplier' };
  }

  const cached = await readCachedNote(offer.id, lang);
  if (cached?.text) {
    return { text: cached.text, source: 'cache' };
  }

  const src = pickTranslatableSource(offer, lang);
  if (!src) return { text: null, source: null };

  const translated = await translateText({
    text: src.text,
    sourceLang: src.sourceLang,
    targetLang: lang,
  });
  if (!translated) return { text: null, source: null };

  await writeCachedNote(offer.id, lang, translated, src.sourceLang);
  return { text: translated, source: 'auto' };
}
