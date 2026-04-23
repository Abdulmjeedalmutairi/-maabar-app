// Shared Grok translator. Generalized from the zh↔ar-only helper that used
// to live in ChatScreen so offer notes and future callers can translate
// between any pair of (ar | en | zh).

const GROK_API_KEY = process.env.EXPO_PUBLIC_GROK_API_KEY;

const LANG_NAME = { ar: 'Arabic', en: 'English', zh: 'Chinese' };

export function isSupportedLang(code) {
  return code === 'ar' || code === 'en' || code === 'zh';
}

// Returns translated text, or null on any failure / unconfigured key / same-lang.
export async function translateText({ text, sourceLang, targetLang }) {
  console.log('[grokTranslate] translateText: entry', {
    keyPresent: !!GROK_API_KEY,
    keyLength: GROK_API_KEY ? GROK_API_KEY.length : 0,
    sourceLang,
    targetLang,
    textLength: text ? String(text).length : 0,
    textPreview: text ? String(text).slice(0, 40) : null,
  });

  if (!GROK_API_KEY) {
    console.log('[grokTranslate] translateText: bail — GROK_API_KEY missing from env');
    return null;
  }
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

  const systemPrompt =
    `Translate the following ${LANG_NAME[sourceLang]} text to ${LANG_NAME[targetLang]}. ` +
    `Return only the translation, nothing else.`;

  try {
    console.log('[grokTranslate] translateText: fetching api.x.ai');
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: String(text) },
        ],
      }),
    });
    console.log('[grokTranslate] translateText: HTTP response', {
      status: res.status,
      ok: res.ok,
    });
    const json = await res.json();
    console.log('[grokTranslate] translateText: JSON shape', {
      hasChoices: Array.isArray(json?.choices),
      choicesLen: Array.isArray(json?.choices) ? json.choices.length : 0,
      hasError: !!json?.error,
      errorPreview: json?.error ? JSON.stringify(json.error).slice(0, 200) : null,
    });
    const out = json?.choices?.[0]?.message?.content;
    console.log('[grokTranslate] translateText: content', {
      hasContent: !!out,
      length: out ? String(out).length : 0,
      preview: out ? String(out).slice(0, 40) : null,
    });
    return out ? String(out).trim() : null;
  } catch (e) {
    console.error('[grokTranslate] translateText: fetch error:', e?.message || e);
    return null;
  }
}
