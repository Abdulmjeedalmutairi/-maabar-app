import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { getLang, setLang } from '../../lib/lang';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

const tx = (ar, en) => getLang() === 'ar' ? ar : en;

export default function AccountScreen() {
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCity, setEditCity]   = useState('');
  const [editLang, setEditLang]   = useState('ar');

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('profiles')
      .select('full_name, email, phone, city, role, created_at, preferred_language')
      .eq('id', user.id)
      .single();
    setProfile(data);
    setLoading(false);
  }

  function startEdit() {
    setEditName(profile?.full_name || '');
    setEditPhone(profile?.phone || '');
    setEditCity(profile?.city || '');
    setEditLang(profile?.preferred_language || getLang());
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function saveEdit() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    await supabase.from('profiles').update({
      full_name:          editName.trim(),
      phone:              editPhone.trim(),
      city:               editCity.trim(),
      preferred_language: editLang,
    }).eq('id', user.id);
    setLang(editLang);
    setSaving(false);
    setEditing(false);
    loadProfile();
  }

  async function handleSignOut() {
    Alert.alert(
      tx('تسجيل الخروج', 'Sign Out'),
      tx('هل أنت متأكد؟', 'Are you sure?'),
      [
        { text: tx('إلغاء', 'Cancel'), style: 'cancel' },
        { text: tx('خروج', 'Sign Out'), style: 'destructive', onPress: () => supabase.auth.signOut() },
      ]
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={C.textDisabled} size="large" /></View>
      </SafeAreaView>
    );
  }

  const initials = profile?.full_name?.split(' ').map(w => w[0]).slice(0, 2).join('') || '?';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity
          onPress={editing ? cancelEdit : startEdit}
          activeOpacity={0.7}
        >
          <Text style={s.editBtn}>
            {editing ? tx('إلغاء', 'Cancel') : tx('تعديل', 'Edit')}
          </Text>
        </TouchableOpacity>
        <Text style={s.pageTitle}>{tx('حسابي', 'My Account')}</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>

        {/* Avatar */}
        <View style={s.avatarWrap}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <Text style={s.name}>{profile?.full_name || '—'}</Text>
          <Text style={s.email}>{profile?.email || '—'}</Text>
          <View style={s.roleBadge}>
            <Text style={s.roleText}>{tx('تاجر', 'Trader')}</Text>
          </View>
        </View>

        {editing ? (
          /* ── Edit mode ── */
          <View style={s.section}>
            <Text style={s.sectionTitle}>{tx('تعديل البيانات', 'Edit Info')}</Text>

            <EditField label={tx('الاسم الكامل', 'Full Name')} value={editName} onChangeText={setEditName} />
            <EditField label={tx('الجوال', 'Phone')} value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" />
            <EditField label={tx('المدينة', 'City')} value={editCity} onChangeText={setEditCity} />

            {/* Language selector */}
            <View style={s.langWrap}>
              <Text style={s.langLabel}>{tx('لغة التطبيق', 'App Language')}</Text>
              <View style={s.langRow}>
                {[
                  { code: 'ar', label: 'العربية' },
                  { code: 'en', label: 'English' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.code}
                    style={[s.langChip, editLang === opt.code && s.langChipActive]}
                    onPress={() => setEditLang(opt.code)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.langChipText, editLang === opt.code && s.langChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.6 }]}
              onPress={saveEdit}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color={C.btnPrimaryText} />
                : <Text style={s.saveBtnText}>{tx('حفظ التغييرات', 'Save Changes')}</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          /* ── View mode ── */
          <View style={s.section}>
            <Text style={s.sectionTitle}>{tx('بيانات الحساب', 'Account Info')}</Text>
            <InfoRow label={tx('الجوال', 'Phone')}        value={profile?.phone || '—'} />
            <InfoRow label={tx('المدينة', 'City')}         value={profile?.city || '—'} />
            <InfoRow
              label={tx('تاريخ الانضمام', 'Joined')}
              value={profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString(getLang() === 'ar' ? 'ar-SA' : 'en-US')
                : '—'}
            />
            <InfoRow
              label={tx('اللغة', 'Language')}
              value={profile?.preferred_language === 'en' ? 'English' : 'العربية'}
            />
          </View>
        )}

        {/* Links */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{tx('الدعم والمعلومات', 'Support & Info')}</Text>
          <LinkRow label={tx('الشروط والأحكام', 'Terms & Conditions')} />
          <LinkRow label={tx('سياسة الخصوصية', 'Privacy Policy')} />
          <LinkRow label={tx('تواصل معنا', 'Contact Us')} />
        </View>

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <Text style={s.signOutText}>{tx('تسجيل الخروج', 'Sign Out')}</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

function EditField({ label, ...props }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.fieldInput}
        placeholderTextColor={C.textDisabled}
        textAlign="right"
        color={C.textPrimary}
        {...props}
      />
    </View>
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

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  pageTitle: { color: C.textPrimary, fontFamily: F.arBold, fontSize: 17 },
  editBtn:   { color: C.textSecondary, fontFamily: F.ar, fontSize: 14 },

  content: { padding: 20, paddingBottom: 60 },

  avatarWrap: { alignItems: 'center', marginBottom: 24, paddingTop: 8 },
  avatar: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: C.bgOverlay, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, borderWidth: 1, borderColor: C.borderDefault,
  },
  avatarText: { color: C.textPrimary, fontSize: 26, fontFamily: F.arBold },
  name:  { color: C.textPrimary, fontFamily: F.arBold, fontSize: 20, marginBottom: 4 },
  email: { color: C.textSecondary, fontFamily: F.en, fontSize: 13, marginBottom: 10 },
  roleBadge: {
    backgroundColor: C.bgHover, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 5,
    borderWidth: 1, borderColor: C.borderDefault,
  },
  roleText: { color: C.textSecondary, fontFamily: F.arSemi, fontSize: 12 },

  section: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    borderWidth: 1, borderColor: C.borderDefault,
    marginBottom: 14, overflow: 'hidden',
  },
  sectionTitle: {
    color: C.textTertiary, fontFamily: F.arSemi, fontSize: 11,
    textAlign: 'right', padding: 14, paddingBottom: 8,
    letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },

  /* Edit fields */
  fieldWrap:  { paddingHorizontal: 16, paddingTop: 14 },
  fieldLabel: { color: C.textTertiary, fontFamily: F.ar, fontSize: 11, textAlign: 'right', marginBottom: 6 },
  fieldInput: {
    backgroundColor: C.bgBase, borderRadius: 12, borderWidth: 1,
    borderColor: C.borderMuted, paddingHorizontal: 14, paddingVertical: 11,
    fontFamily: F.ar, fontSize: 15, color: C.textPrimary, textAlign: 'right',
    marginBottom: 2,
  },

  /* Language selector */
  langWrap:  { paddingHorizontal: 16, paddingTop: 14 },
  langLabel: { color: C.textTertiary, fontFamily: F.ar, fontSize: 11, textAlign: 'right', marginBottom: 8 },
  langRow:   { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginBottom: 4 },
  langChip: {
    borderWidth: 1, borderColor: C.borderDefault, borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 8, backgroundColor: C.bgBase,
  },
  langChipActive:     { borderColor: C.btnPrimary, backgroundColor: C.btnPrimary },
  langChipText:       { color: C.textSecondary, fontFamily: F.ar, fontSize: 13 },
  langChipTextActive: { color: C.btnPrimaryText, fontFamily: F.arSemi },

  /* Save button */
  saveBtn: {
    backgroundColor: C.btnPrimary, borderRadius: 14,
    paddingVertical: 13, alignItems: 'center',
    margin: 16, marginTop: 16,
  },
  saveBtnText: { color: C.btnPrimaryText, fontFamily: F.arBold, fontSize: 15 },

  /* View mode info rows */
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  infoLabel: { color: C.textSecondary, fontFamily: F.ar, fontSize: 14 },
  infoValue: { color: C.textPrimary, fontFamily: F.ar, fontSize: 14 },

  linkRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  linkLabel: { color: C.textPrimary, fontFamily: F.ar, fontSize: 14 },
  linkArrow: { color: C.textDisabled, fontSize: 18 },

  signOutBtn: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    paddingVertical: 15, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(180,0,0,0.2)',
    marginTop: 4,
  },
  signOutText: { color: C.red, fontFamily: F.arBold, fontSize: 15 },
});
