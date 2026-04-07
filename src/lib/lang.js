// Module-level language store.
// Set once on LanguageScreen; read everywhere else.
// Codes match web: 'ar' | 'en' | 'zh'
let _lang = 'ar';

export function getLang() { return _lang; }
export function setLang(code) { _lang = String(code || 'ar').toLowerCase(); }
