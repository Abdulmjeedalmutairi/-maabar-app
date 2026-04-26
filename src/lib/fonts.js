// Maabar Font System
// Arabic text        → Cairo
// English / Latin    → Cormorant Garamond
// Numeric / digits   → Inter (clean, tabular, language-agnostic)
//
// React Native cannot mix fonts mid-string, so for digit-heavy spans
// (prices, dates, badges, totals) we apply F.num at the <Text> level —
// any Arabic words sharing that Text will also render in Inter, which
// is acceptable per project decision (Fix 3, 2026-04).
export const F = {
  arLight:  'Cairo_300Light',
  ar:       'Cairo_400Regular',
  arSemi:   'Cairo_600SemiBold',
  arBold:   'Cairo_700Bold',
  enLight:  'CormorantGaramond_400Regular',
  en:       'CormorantGaramond_400Regular',
  enSemi:   'CormorantGaramond_600SemiBold',
  enBold:   'CormorantGaramond_700Bold',
  num:      'Inter_500Medium',
  numSemi:  'Inter_600SemiBold',
};
