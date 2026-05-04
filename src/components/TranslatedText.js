// <TranslatedText> — buyer-side async AI translation component (mobile).
//
// Mirrors web/src/components/TranslatedText.jsx. Renders the original text
// immediately (no blocking), then kicks off an async translation. When the
// translation lands, it swaps in and shows a small "✨ AI translated" pill
// plus a "Show original" toggle.
//
// Design notes:
//   - Async-first: the screen never waits for the API. Slow or failed calls
//     leave the original text visible.
//   - Silent failure: API errors keep the original text visible without
//     surfacing an error UI to the buyer.
//   - Cache: aiTranslate.js holds an in-memory Map keyed by source|target|text
//     — the same description rendered twice on one screen (or toggled back and
//     forth) costs one network call total.
//   - Same-language passthrough: when detected source === viewer lang, no API
//     call is made and no pill is shown.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { detectSourceLang, translateText } from '../lib/aiTranslate';
import { C } from '../lib/colors';
import { F } from '../lib/fonts';

// Inline three-language strings — no centralized T table in mobile yet.
const LABELS = {
  ar: { pill: 'ترجمة آلية', showOriginal: 'عرض الأصل', showTranslation: 'عرض الترجمة' },
  en: { pill: 'AI translated', showOriginal: 'Show original', showTranslation: 'Show translation' },
  zh: { pill: 'AI 翻译', showOriginal: '显示原文', showTranslation: '显示翻译' },
};

export default function TranslatedText({
  text,
  lang = 'en',
  textStyle,         // style array/object applied to the visible text
  containerStyle,    // optional wrapper override
  numberOfLines,     // forwarded to Text for clamping
}) {
  const isAr = lang === 'ar';
  const trimmed = (text || '').trim();
  const sourceLang = detectSourceLang(trimmed);
  const target = lang;
  const needsTranslation = trimmed.length > 0 && sourceLang !== target;

  const [translated, setTranslated] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [translationFailed, setTranslationFailed] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setTranslated(null);
    setTranslationFailed(false);

    if (!needsTranslation) return undefined;

    (async () => {
      const { translated: result, error } = await translateText(trimmed, target, sourceLang);
      if (cancelledRef.current) return;
      if (error) {
        setTranslationFailed(true);
        return;
      }
      setTranslated(result);
    })();

    return () => { cancelledRef.current = true; };
  }, [trimmed, target, sourceLang, needsTranslation]);

  if (!trimmed) return null;

  // Same language → no pill, no toggle, just plain text in the parent's style.
  if (!needsTranslation) {
    return (
      <Text style={textStyle} numberOfLines={numberOfLines}>{trimmed}</Text>
    );
  }

  const showingTranslation = translated !== null && !showOriginal;
  const visibleText = showingTranslation ? translated : trimmed;
  const visibleLang = showingTranslation ? target : sourceLang;
  const visibleIsRtl = visibleLang === 'ar';

  const labels = LABELS[lang] || LABELS.en;
  const rowDir = isAr ? 'row-reverse' : 'row';

  // Suppress translationFailed warning — kept silent per spec.
  void translationFailed;

  return (
    <View style={containerStyle}>
      <Text
        style={[textStyle, { writingDirection: visibleIsRtl ? 'rtl' : 'ltr' }]}
        numberOfLines={numberOfLines}
      >
        {visibleText}
      </Text>
      {translated !== null && (
        <View style={[s.metaRow, { flexDirection: rowDir }]}>
          <View style={s.pill}>
            <Text style={[s.pillText, { fontFamily: isAr ? F.ar : F.en }]}>
              ✨ {labels.pill}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowOriginal((v) => !v)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={[s.toggle, { fontFamily: isAr ? F.ar : F.en }]}>
              {showingTranslation ? labels.showOriginal : labels.showTranslation}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  metaRow: {
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: C.greenSoft,
    borderWidth: 1,
    borderColor: 'rgba(0,100,0,0.18)',
  },
  pillText: {
    fontSize: 10,
    color: C.green,
    letterSpacing: 0.3,
  },
  toggle: {
    fontSize: 11,
    color: C.textSecondary,
    textDecorationLine: 'underline',
    textDecorationColor: C.borderSubtle,
  },
});
