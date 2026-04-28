// Shared translator. Migrated from a direct xAI Grok call to the
// `maabar-ai` Supabase Edge Function (chat_translation task), so the mobile
// app shares a single translation backend with web (Groq primary + Gemini
// fallback). Public signature is unchanged so existing callers
// (offerNoteCache, ChatScreen) keep working.
//
// Rollback note: the previous implementation relied on
//   process.env.EXPO_PUBLIC_GROK_API_KEY
// and POSTed to https://api.x.ai/v1/chat/completions with model `grok-3-mini`.
// If we need to revert, restore that env var and the direct fetch.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

const AI_ENDPOINT = `${SUPABASE_URL}/functions/v1/maabar-ai`;

const LANG_NAME = { ar: 'Arabic', en: 'English', zh: 'Chinese' };

export function isSupportedLang(code) {
  return code === 'ar' || code === 'en' || code === 'zh';
}

// Returns translated text, or null on any failure / same-lang.
export async function translateText({ text, sourceLang, targetLang }) {
  console.log('[grokTranslate] translateText: entry', {
    sourceLang,
    targetLang,
    textLength: text ? String(text).length : 0,
    textPreview: text ? String(text).slice(0, 40) : null,
  });

  if (!text || !String(text).trim()) {
    console.log('[grokTranslate] translateText: bail — empty text');
    return null;
  }
  if (!isSupportedLang(sourceLang) || !isSupportedLang(targetLang)) {
    console.log('[grokTranslate] translateText: bail — unsupported lang pair');
    return null;
  }
  if (sourceLang === targetLang) {
    console.log('[grokTranslate] translateText: same-lang short-circuit');
    return String(text).trim();
  }

  const payload = {
    text: String(text),
    sourceLanguage: sourceLang,
    targetLanguage: targetLang,
    conversationRole: 'trade_chat',
  };

  try {
    console.log('[grokTranslate] translateText: fetching maabar-ai edge function', {
      endpoint: AI_ENDPOINT,
      task: 'chat_translation',
    });
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        task: 'chat_translation',
        personaName: 'وكيل معبر',
        payload,
      }),
    });
    console.log('[grokTranslate] translateText: HTTP response', {
      status: res.status,
      ok: res.ok,
    });
    const json = await res.json().catch(() => ({}));
    console.log('[grokTranslate] translateText: edge function JSON', {
      hasTranslatedText: typeof json?.translatedText === 'string',
      hasError: !!json?.error,
      errorPreview: json?.error ? String(json.error).slice(0, 200) : null,
      keys: json && typeof json === 'object' ? Object.keys(json) : null,
    });

    if (!res.ok || json?.error) {
      console.log('[grokTranslate] translateText: edge function failed');
      return null;
    }

    const out = typeof json?.translatedText === 'string' ? json.translatedText : '';
    console.log('[grokTranslate] translateText: content', {
      hasContent: !!out,
      length: out ? out.length : 0,
      preview: out ? out.slice(0, 40) : null,
    });
    return out ? out.trim() : null;
  } catch (e) {
    console.error('[grokTranslate] translateText: fetch error:', e?.message || e);
    return null;
  }
}
