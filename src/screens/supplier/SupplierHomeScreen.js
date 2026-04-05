import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';
import MaabarLogo from '../../components/MaabarLogo';

const VERIFICATION_AR = {
  registered: 'مسجّل',
  verification_required: 'التحقق مطلوب',
  verification_under_review: 'قيد المراجعة',
  verified: 'موثّق',
  rejected: 'مرفوض',
  inactive: 'غير نشط',
};

const VERIFICATION_COLOR = {
  registered: C.blue,
  verification_required: C.orange,
  verification_under_review: C.orange,
  verified: C.green,
  rejected: C.red,
  inactive: C.textDisabled,
};

export default function SupplierHomeScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ requests: 0, offers: 0, messages: 0 });
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [profileRes, offersRes, messagesRes, requestsRes] = await Promise.all([
      supabase.from('profiles')
        .select('company_name, status, maabar_supplier_id, trust_score, country, city')
        .eq('id', user.id).single(),
      supabase.from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', user.id).eq('status', 'pending'),
      supabase.from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', user.id).eq('is_read', false),
      supabase.from('requests')
        .select('id, title_ar, title_en, quantity, status, created_at, category')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    setProfile(profileRes.data);
    setStats({
      requests: requestsRes.data?.length || 0,
      offers: offersRes.count || 0,
      messages: messagesRes.count || 0,
    });
    setRecentRequests(requestsRes.data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  function onRefresh() { setRefreshing(true); load(); }

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={C.accent} size="large" /></View>
      </SafeAreaView>
    );
  }

  const status = profile?.status || 'registered';
  const statusColor = VERIFICATION_COLOR[status] || C.textDisabled;
  const statusLabel = VERIFICATION_AR[status] || status;
  const isVerified = status === 'verified';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      >
        <View style={s.content}>

          {/* Header */}
          <View style={s.header}>
            <MaabarLogo />
            <View style={s.headerRight}>
              <Text style={s.companyName} numberOfLines={1}>
                {profile?.company_name || 'المورد'}
              </Text>
              <Text style={s.supplierId}>
                {profile?.maabar_supplier_id || 'لوحة المورد'}
              </Text>
            </View>
          </View>

          {/* Verification banner */}
          {!isVerified && (
            <TouchableOpacity
              style={[s.verificationBanner, { borderColor: statusColor + '40' }]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('SAccount')}
            >
              <View style={[s.verificationDot, { backgroundColor: statusColor }]} />
              <View style={s.verificationInfo}>
                <Text style={[s.verificationStatus, { color: statusColor }]}>{statusLabel}</Text>
                <Text style={s.verificationHint}>
                  {status === 'verification_required'
                    ? 'أكمل رفع وثائق التحقق لتفعيل حسابك'
                    : status === 'verification_under_review'
                    ? 'جاري مراجعة وثائقك من فريق مَعبر'
                    : 'اضغط لإكمال إجراءات التحقق'}
                </Text>
              </View>
              <Text style={s.verificationArrow}>←</Text>
            </TouchableOpacity>
          )}

          {/* Stats */}
          <View style={s.statsRow}>
            <StatCard value={stats.requests} label="طلبات متاحة" />
            <StatCard value={stats.offers} label="عروضي المرسلة" color={C.green} />
            <StatCard value={stats.messages} label="رسائل جديدة" color={C.orange} />
          </View>

          {/* Recent open requests */}
          <View style={s.sectionHeader}>
            <TouchableOpacity onPress={() => navigation.navigate('SRequests')}>
              <Text style={s.seeAll}>عرض الكل</Text>
            </TouchableOpacity>
            <Text style={s.sectionTitle}>طلبات مفتوحة</Text>
          </View>

          {recentRequests.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>لا توجد طلبات مفتوحة</Text>
            </View>
          ) : (
            recentRequests.map(r => (
              <TouchableOpacity
                key={r.id}
                style={s.reqCard}
                activeOpacity={0.75}
                onPress={() => navigation.navigate('SRequests')}
              >
                <View style={s.reqTop}>
                  {r.category && (
                    <View style={s.catBadge}>
                      <Text style={s.catText}>{r.category}</Text>
                    </View>
                  )}
                  <Text style={s.reqTitle} numberOfLines={2}>{r.title_ar || r.title_en}</Text>
                </View>
                <Text style={s.reqQty}>{r.quantity}</Text>
              </TouchableOpacity>
            ))
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ value, label, color }) {
  return (
    <View style={s.statCard}>
      <Text style={[s.statValue, color && { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  headerRight: { alignItems: 'flex-end' },
  companyName: { color: C.textPrimary, fontWeight: '700', fontSize: 18, maxWidth: 200 },
  supplierId: { color: C.textDisabled, fontSize: 11, marginTop: 2 },

  verificationBanner: {
    backgroundColor: C.bgRaised, borderRadius: 14,
    padding: 14, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, marginBottom: 20, gap: 10,
  },
  verificationDot: { width: 8, height: 8, borderRadius: 4 },
  verificationInfo: { flex: 1 },
  verificationStatus: { fontSize: 13, fontWeight: '700', textAlign: 'right' },
  verificationHint: { color: C.textTertiary, fontSize: 11, textAlign: 'right', marginTop: 2 },
  verificationArrow: { color: C.textDisabled, fontSize: 16 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: C.bgRaised, borderRadius: 16,
    paddingVertical: 20, paddingHorizontal: 8,
    borderWidth: 1, borderColor: C.borderDefault, alignItems: 'center',
  },
  statValue: { fontSize: 28, fontWeight: '200', color: C.textPrimary, lineHeight: 32 },
  statLabel: { fontSize: 10, color: C.textSecondary, textAlign: 'center', marginTop: 6 },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: C.textSecondary },
  seeAll: { fontSize: 12, color: C.accent },

  reqCard: {
    backgroundColor: C.bgRaised, borderRadius: 14,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: C.borderDefault,
  },
  reqTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  reqTitle: { color: C.textPrimary, fontSize: 14, fontWeight: '600', textAlign: 'right', flex: 1 },
  reqQty: { color: C.textSecondary, fontSize: 12, textAlign: 'right' },
  catBadge: {
    backgroundColor: C.accentSoft, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  catText: { color: C.accent, fontSize: 11 },

  emptyCard: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    padding: 32, alignItems: 'center',
    borderWidth: 1, borderColor: C.borderDefault,
  },
  emptyText: { color: C.textSecondary, fontSize: 14 },
});
