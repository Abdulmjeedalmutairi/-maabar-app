// Mirrors web src/lib/requestTranslation.js — translates RFQ title and
// description to all 3 languages at write time so suppliers viewing in their
// own language see translated content, not the buyer's source language.
//
// Backed by mobile's existing grokTranslate.translateText, which POSTs to the
// shared maabar-ai edge function (chat_translation task). Same translation
// backend as web; we just adapt the call signature.

import { translateText } from './grokTranslate';

const ALL_LANGS = ['ar', 'en', 'zh'];

// Thin shim mirroring web's translateChatMessage signature. Returns the
// translated string, or null/empty on failure or empty input —
// translateToAllLanguages handles the source-text fallback.
async function translateChatMessage({ text, sourceLanguage, targetLanguage }) {
  return translateText({ text, sourceLang: sourceLanguage, targetLang: targetLanguage });
}

/**
 * Translate a single text to all 3 languages.
 * Exported for use by offer-note and other single-field translation needs.
 */
export async function translateTextToAllLanguages(text, sourceLang) {
  return translateToAllLanguages(text, sourceLang);
}

/**
 * Translate a supplier offer note to all 3 languages and return the
 * Supabase column shape ready to spread into an offers payload.
 * Returns {} on empty input or any failure — never throws — so callers
 * can submit even if translation is unavailable. The legacy `note` column
 * preserves the source text in that case.
 *
 * @param {string} note - The note text typed by the supplier.
 * @param {string} lang - Source language ('ar' | 'en' | 'zh'). Default 'zh'.
 * @returns {Promise<{note_ar?:string, note_en?:string, note_zh?:string}>}
 */
export async function translateOfferNote(note, lang) {
  if (!note) return {};
  try {
    const noteLangs = await translateTextToAllLanguages(note, lang || 'zh');
    return { note_ar: noteLangs.ar, note_en: noteLangs.en, note_zh: noteLangs.zh };
  } catch (err) {
    console.error('translateOfferNote error:', err?.message || err);
    return {};
  }
}

/**
 * Translate `text` from `sourceLang` to every other language.
 * Returns an object like { ar: '...', en: '...', zh: '...' }.
 * The source language entry is filled with the original text; all others are
 * translated. On individual translation failure the original text is used as
 * a fallback so submission is never blocked.
 */
async function translateToAllLanguages(text, sourceLang) {
  if (!text || !text.trim()) return { ar: '', en: '', zh: '' };

  const result = { [sourceLang]: text };

  await Promise.all(
    ALL_LANGS.filter((l) => l !== sourceLang).map(async (targetLang) => {
      try {
        const translated = await translateChatMessage({
          text,
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
          conversationRole: 'product_request',
        });
        if (!translated) {
          console.error(`[requestTranslation] Empty response for ${sourceLang}→${targetLang}, using source text as fallback`);
        }
        result[targetLang] = translated || text;
      } catch (err) {
        console.error(`[requestTranslation] Translation failed ${sourceLang}→${targetLang}:`, err?.message || err);
        result[targetLang] = text;
      }
    })
  );

  return { ar: result.ar || text, en: result.en || text, zh: result.zh || text };
}

/**
 * Build fully translated title and description fields for a request payload.
 *
 * @param {object} params
 * @param {string} params.titleAr   - Arabic title typed by buyer (may be empty)
 * @param {string} params.titleEn   - English title typed by buyer (may be empty)
 * @param {string} params.description - Description typed by buyer
 * @param {string} params.lang      - Current UI language of the buyer ('ar'|'en'|'zh')
 * @returns {Promise<object>} Payload fields: title_ar, title_en, title_zh,
 *                            description_ar, description_en, description_zh
 */
export async function buildTranslatedRequestFields({ titleAr, titleEn, description, lang }) {
  const sourceLang = lang || 'ar';
  const tAr = (titleAr || '').trim();
  const tEn = (titleEn || '').trim();
  const desc = (description || '').trim();

  console.log('[requestTranslation] buildTranslatedRequestFields called', { sourceLang, tAr: tAr.slice(0, 40), tEn: tEn.slice(0, 40), descLen: desc.length });

  // ── Titles ────────────────────────────────────────────────────────────────
  let titles;
  if (tAr && tEn) {
    // Both provided: translate EN → ZH (EN→ZH quality is better)
    try {
      const zhTitle = await translateChatMessage({
        text: tEn,
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        conversationRole: 'product_request',
      });
      titles = { ar: tAr, en: tEn, zh: zhTitle || tEn };
    } catch {
      titles = { ar: tAr, en: tEn, zh: tEn };
    }
  } else if (tAr) {
    // Only Arabic: translate to EN and ZH
    titles = await translateToAllLanguages(tAr, 'ar');
  } else if (tEn) {
    // Only English: translate to AR and ZH
    titles = await translateToAllLanguages(tEn, 'en');
  } else {
    titles = { ar: '', en: '', zh: '' };
  }

  // ── Description ───────────────────────────────────────────────────────────
  let descriptions;
  if (desc) {
    descriptions = await translateToAllLanguages(desc, sourceLang);
  } else {
    descriptions = { ar: '', en: '', zh: '' };
  }

  return {
    title_ar: titles.ar,
    title_en: titles.en,
    title_zh: titles.zh,
    description_ar: descriptions.ar,
    description_en: descriptions.en,
    description_zh: descriptions.zh,
  };
}
