import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DISPLAY_CURRENCY_KEY = 'maabar_preferred_display_currency';
const DISPLAY_RATE_CACHE_KEY = 'maabar_display_currency_rates_v1';
const DEFAULT_RATES = { USD: 1, SAR: 3.75, CNY: 7.2 };

export const DISPLAY_CURRENCIES = ['USD', 'SAR', 'CNY'];
export const DEFAULT_DISPLAY_CURRENCY = 'USD';

export function normalizeDisplayCurrency(value) {
  return DISPLAY_CURRENCIES.includes(value) ? value : DEFAULT_DISPLAY_CURRENCY;
}

// Role-aware default: Chinese supplier pool defaults to CNY; AR buyers/traders
// default to SAR; everyone else falls back to USD. Used when no stored
// preference and no profile.preferred_display_currency exists yet.
export function getRoleDefaultCurrency(role, lang) {
  if (role === 'supplier') return 'CNY';
  if (lang === 'ar') return 'SAR';
  return DEFAULT_DISPLAY_CURRENCY;
}

export async function getStoredDisplayCurrency() {
  try {
    const raw = await AsyncStorage.getItem(DISPLAY_CURRENCY_KEY);
    return normalizeDisplayCurrency(raw);
  } catch {
    return DEFAULT_DISPLAY_CURRENCY;
  }
}

export async function storeDisplayCurrency(value) {
  try {
    await AsyncStorage.setItem(DISPLAY_CURRENCY_KEY, normalizeDisplayCurrency(value));
  } catch {
    // no-op
  }
}

export async function getCachedDisplayRates() {
  try {
    const raw = await AsyncStorage.getItem(DISPLAY_RATE_CACHE_KEY);
    if (!raw) return DEFAULT_RATES;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_RATES,
      ...parsed,
    };
  } catch {
    return DEFAULT_RATES;
  }
}

export async function storeDisplayRates(rates) {
  try {
    await AsyncStorage.setItem(DISPLAY_RATE_CACHE_KEY, JSON.stringify({
      ...DEFAULT_RATES,
      ...rates,
    }));
  } catch {
    // no-op
  }
}

export async function fetchDisplayRates() {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await response.json();
    const rates = {
      USD: 1,
      SAR: data?.rates?.SAR || DEFAULT_RATES.SAR,
      CNY: data?.rates?.CNY || DEFAULT_RATES.CNY,
    };
    await storeDisplayRates(rates);
    return rates;
  } catch {
    return getCachedDisplayRates();
  }
}

export function convertCurrencyAmount(amount, sourceCurrency, targetCurrency, rates = DEFAULT_RATES) {
  const value = Number(amount || 0);
  const source = normalizeDisplayCurrency(sourceCurrency || 'USD');
  const target = normalizeDisplayCurrency(targetCurrency || source);
  const sourceRate = rates?.[source] || DEFAULT_RATES[source] || 1;
  const targetRate = rates?.[target] || DEFAULT_RATES[target] || 1;

  if (!Number.isFinite(value) || value <= 0) return 0;
  if (!sourceRate || !targetRate) return value;
  if (source === target) return value;

  const usdValue = value / sourceRate;
  return usdValue * targetRate;
}

export function formatCurrencyAmount(amount, currency, lang = 'en', options = {}) {
  const value = Number(amount || 0);
  if (!Number.isFinite(value)) return '—';

  // ar-SA-u-nu-latn: Arabic locale grouping/decimal punctuation, Latin digits.
  const locale = lang === 'ar' ? 'ar-SA-u-nu-latn' : lang === 'zh' ? 'zh-CN' : 'en-US';
  return `${value.toLocaleString(locale, {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  })} ${normalizeDisplayCurrency(currency)}`;
}

export function buildDisplayPrice({ amount, sourceCurrency, displayCurrency, rates, lang = 'en' }) {
  const source = normalizeDisplayCurrency(sourceCurrency || 'USD');
  const target = normalizeDisplayCurrency(displayCurrency || source);
  const displayAmount = convertCurrencyAmount(amount, source, target, rates);

  return {
    sourceCurrency: source,
    displayCurrency: target,
    sourceAmount: Number(amount || 0),
    displayAmount,
    formattedDisplay: formatCurrencyAmount(displayAmount, target, lang),
    formattedSource: formatCurrencyAmount(amount, source, lang),
    isConverted: source !== target,
  };
}

// Renders an amount in its source currency, optionally followed by an
// "≈ converted" tail when the viewer's display currency differs.
// Single row when source === display, both rows otherwise.
export function formatPriceWithConversion({ amount, sourceCurrency, displayCurrency, rates, lang = 'en', separator = ' ≈ ', options }) {
  const built = buildDisplayPrice({ amount, sourceCurrency, displayCurrency, rates, lang });
  const primary = formatCurrencyAmount(built.sourceAmount, built.sourceCurrency, lang, options);
  if (!built.isConverted) return primary;
  const secondary = formatCurrencyAmount(built.displayAmount, built.displayCurrency, lang, options);
  return `${primary}${separator}${secondary}`;
}

// Resolves which currency to display for a given user, in priority order:
//   1. profile.preferred_display_currency (explicit user choice on server)
//   2. locally stored preference (AsyncStorage)
//   3. role-aware locale default
export async function resolveDisplayCurrencyForUser({ profile, lang }) {
  if (profile?.preferred_display_currency) {
    return normalizeDisplayCurrency(profile.preferred_display_currency);
  }
  const stored = await AsyncStorage.getItem(DISPLAY_CURRENCY_KEY).catch(() => null);
  if (stored && DISPLAY_CURRENCIES.includes(stored)) return stored;
  return getRoleDefaultCurrency(profile?.role, lang);
}

export async function persistDisplayCurrencyPreference({ sb, userId, currency, setProfile }) {
  const normalized = normalizeDisplayCurrency(currency);
  await storeDisplayCurrency(normalized);
  setCurrentDisplayCurrency(normalized);

  if (!sb || !userId) {
    return { persistedRemotely: false, currency: normalized };
  }

  const { error } = await sb
    .from('profiles')
    .update({ preferred_display_currency: normalized })
    .eq('id', userId);

  if (!error) {
    setProfile?.(prev => prev ? { ...prev, preferred_display_currency: normalized } : prev);
    return { persistedRemotely: true, currency: normalized };
  }

  const missingColumn = /column profiles\.(preferred_display_currency) does not exist/i.test(error.message || '');
  return {
    persistedRemotely: false,
    currency: normalized,
    error,
    needsMigration: missingColumn,
  };
}

// ── Module-level current state ──────────────────────────────────────────────
// Mirrors the lang.js singleton pattern. Hydrated once at app launch by
// RootNavigator (after profile loads) and updated whenever the user changes
// their preference. Screens subscribe via useDisplayCurrency().
let _currentCurrency = DEFAULT_DISPLAY_CURRENCY;
let _currentRates = DEFAULT_RATES;
const _subscribers = new Set();

function _notify() {
  _subscribers.forEach((fn) => {
    try { fn(); } catch {}
  });
}

export function getCurrentDisplayCurrency() { return _currentCurrency; }
export function getCurrentExchangeRates() { return _currentRates; }

export function setCurrentDisplayCurrency(value) {
  const next = normalizeDisplayCurrency(value);
  if (next === _currentCurrency) return;
  _currentCurrency = next;
  _notify();
}

export function setCurrentExchangeRates(rates) {
  if (!rates || typeof rates !== 'object') return;
  _currentRates = { ...DEFAULT_RATES, ...rates };
  _notify();
}

// Hook: returns the current { displayCurrency, rates } and re-renders the
// caller whenever either changes.
export function useDisplayCurrency() {
  const [snapshot, setSnapshot] = useState(() => ({
    displayCurrency: _currentCurrency,
    rates: _currentRates,
  }));
  useEffect(() => {
    const fn = () => setSnapshot({
      displayCurrency: _currentCurrency,
      rates: _currentRates,
    });
    _subscribers.add(fn);
    fn(); // sync once on mount in case state changed before subscribe
    return () => { _subscribers.delete(fn); };
  }, []);
  return snapshot;
}

// Called once at app launch (after profile is known) to populate the module
// state. Reads the cached rates synchronously-ish, resolves the user's
// preferred currency, then refreshes rates from the network in the background.
export async function hydrateDisplayCurrencyState({ profile, lang } = {}) {
  const cachedRates = await getCachedDisplayRates();
  setCurrentExchangeRates(cachedRates);

  const resolved = await resolveDisplayCurrencyForUser({ profile, lang });
  setCurrentDisplayCurrency(resolved);

  fetchDisplayRates()
    .then((fresh) => setCurrentExchangeRates(fresh))
    .catch(() => {});
}
