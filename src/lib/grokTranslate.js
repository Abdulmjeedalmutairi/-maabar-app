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
  if (!GROK_API_KEY) return null;
  if (!text || !String(text).trim()) return null;
  if (!isSupportedLang(sourceLang) || !isSupportedLang(targetLang)) return null;
  if (sourceLang === targetLang) return String(text).trim();

  const systemPrompt =
    `Translate the following ${LANG_NAME[sourceLang]} text to ${LANG_NAME[targetLang]}. ` +
    `Return only the translation, nothing else.`;

  try {
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
    const json = await res.json();
    const out = json?.choices?.[0]?.message?.content;
    return out ? String(out).trim() : null;
  } catch (e) {
    console.error('[grokTranslate] error:', e);
    return null;
  }
}
