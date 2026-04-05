import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';

export default function AccountScreen() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('full_name, email, phone, city, role, created_at')
      .eq('id', user.id)
      .single();
    setProfile(data);
    setLoading(false);
  }

  async function handleSignOut() {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={C.accent} size="large" /></View>
      </SafeAreaView>
    );
  }

  const initials = profile?.full_name?.split(' ').map(w => w[0]).slice(0, 2).join('') || '?';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>

        {/* Avatar */}
        <View style={s.avatarWrap}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <Text style={s.name}>{profile?.full_name || '—'}</Text>
          <Text style={s.email}>{profile?.email || '—'}</Text>
          <View style={s.roleBadge}>
            <Text style={s.roleText}>تاجر</Text>
          </View>
        </View>

        {/* Info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>بيانات الحساب</Text>
          <InfoRow label="الجوال" value={profile?.phone || '—'} />
          <InfoRow label="المدينة" value={profile?.city || '—'} />
          <InfoRow
            label="تاريخ الانضمام"
            value={profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString('ar-SA')
              : '—'}
          />
        </View>

        {/* Links */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>الدعم والمعلومات</Text>
          <LinkRow label="الشروط والأحكام" />
          <LinkRow label="سياسة الخصوصية" />
          <LinkRow label="تواصل معنا" />
        </View>

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <Text style={s.signOutText}>تسجيل الخروج</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoValue}>{value}</Text>
      <Text style={s.infoLabel}>{label}</Text>
    </View>
  );
}

function LinkRow({ label }) {
  return (
    <TouchableOpacity style={s.linkRow} activeOpacity={0.7}>
      <Text style={s.linkArrow}>›</Text>
      <Text style={s.linkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 24, paddingBottom: 60 },

  avatarWrap: { alignItems: 'center', marginBottom: 32, paddingTop: 16 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.accentMuted, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, borderWidth: 2, borderColor: C.accentStrong,
  },
  avatarText: { color: C.accent, fontSize: 28, fontWeight: '700' },
  name: { color: C.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 4 },
  email: { color: C.textSecondary, fontSize: 14, marginBottom: 10 },
  roleBadge: {
    backgroundColor: C.accentSoft, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 5,
    borderWidth: 1, borderColor: C.accentMuted,
  },
  roleText: { color: C.accent, fontSize: 12, fontWeight: '600' },

  section: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    borderWidth: 1, borderColor: C.borderDefault,
    marginBottom: 16, overflow: 'hidden',
  },
  sectionTitle: {
    color: C.textTertiary, fontSize: 11, fontWeight: '600',
    textAlign: 'right', padding: 14, paddingBottom: 8,
    letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  infoLabel: { color: C.textSecondary, fontSize: 14 },
  infoValue: { color: C.textPrimary, fontSize: 14, fontWeight: '500' },

  linkRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  linkLabel: { color: C.textPrimary, fontSize: 14 },
  linkArrow: { color: C.textDisabled, fontSize: 18 },

  signOutBtn: {
    backgroundColor: C.redSoft, borderRadius: 16,
    paddingVertical: 15, alignItems: 'center',
    borderWidth: 1, borderColor: C.red + '40',
    marginTop: 8,
  },
  signOutText: { color: C.red, fontWeight: '700', fontSize: 16 },
});
