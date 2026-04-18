import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://utzalmszfqfcofywfetv.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0emFsbXN6ZnFmY29meXdmZXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NjE4NDAsImV4cCI6MjA4OTIzNzg0MH0.SSqFCeBRhKRIrS8oQasBkTsZxSv7uZGCT9pqfK-YmX8';
export const SEND_EMAIL_URL = 'https://utzalmszfqfcofywfetv.supabase.co/functions/v1/send-email';

// Explicit options object: requireAuthentication must be a real boolean (not a string
// or undefined) — New Architecture's JSI strict type-checking throws
// "expected dynamic type 'boolean', but had type 'string'" when the @Field Bool
// on the iOS native side receives the wrong type.
// keychainAccessible must be the numeric constant, never a string literal.
const SECURE_STORE_OPTIONS = {
  requireAuthentication: false,
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

const ExpoSecureStoreAdapter = {
  getItem: async (key) => {
    try {
      return await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
    } catch {
      return null;
    }
  },
  setItem: async (key, value) => {
    try {
      await SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS);
    } catch (e) {
      console.warn('SecureStore.setItem failed:', e);
    }
  },
  removeItem: async (key) => {
    try {
      await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
    } catch (e) {
      console.warn('SecureStore.removeItem failed:', e);
    }
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
