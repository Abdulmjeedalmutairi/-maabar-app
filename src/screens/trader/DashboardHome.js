import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import MaabarLogo from '../../components/MaabarLogo';

const TABS = [
  { key: 'overview',   label: 'نظرة عامة' },
  { key: 'requests',   label: 'طلباتي' },
  { key: 'samples',    label: 'العينات' },
  { key: 'inquiries',  label: 'استفسارات المنتجات' },
  { key: 'messages',   label: 'الرسائل' },
  { key: 'settings',   label: 'الإعدادات' },
];

export default function DashboardHome({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [attentionItems, setAttentionItems] = useState([]);
  const [stats, setStats] = useState({ requests: 0, offers: 0, messages: 0 });
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAiMenu, setShowAiMenu] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [profileRes, requestsRes, messagesRes] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      supabase.from('requests').select('id, title_ar, title_en, status').eq('buyer_id', user.id),
      supabase.from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', user.id).eq('is_read', false),
    ]);

    const reqs = requestsRes.data || [];
    const requestIds = reqs.map(r => r.id);

    let offerCount = 0;
    if (requestIds.length > 0) {
      const { count } = await supabase
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .in('request_id', requestIds);
      offerCount = count || 0;
    }

    setProfile(profileRes.data);
    setAttentionItems(reqs.filter(r => r.status === 'offers_received'));
    setStats({
      requests: reqs.length,
      offers: offerCount,
      messages: messagesRes.count || 0,
    });
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  function onRefresh() { setRefreshing(true); load(); }

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator color="rgba(0,0,0,0.35)" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || '';

  return (
    <SafeAreaView style={s.safe}>

      {/* Header */}
      <View style={s.header}>
        <MaabarLogo size="md" />
        <View style={s.headerRight}>
          <Text style={s.greeting}>أهلاً، {firstName}</Text>
          <Text style={s.subGreeting}>تابع طلباتك وعروضك ورسائلك من مكان واحد</Text>
        </View>
      </View>

      {/* Horizontal Tab Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabBarWrap}
        contentContainerStyle={s.tabBar}
      >
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[s.tab, activeTab === tab.key && s.tabActive]}
          >
            <Text style={[s.tabLabel, activeTab === tab.key && s.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="rgba(0,0,0,0.35)"
          />
        }
        contentContainerStyle={s.content}
      >

        {activeTab === 'overview' && (
          <>
            {/* يحتاج انتباهك */}
            {attentionItems.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>يحتاج انتباهك ({attentionItems.length})</Text>
                {attentionItems.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={s.attentionRow}
                    onPress={() =>
                      navigation.navigate('Requests', {
                        screen: 'Offers',
                        params: { requestId: item.id },
                      })
                    }
                    activeOpacity={0.8}
                  >
                    <Text style={s.attentionArrow}>←</Text>
                    <View style={s.attentionInfo}>
                      <Text style={s.attentionSub}>قارن العروض واختر الأفضل</Text>
                      <Text style={s.attentionTitle} numberOfLines={1}>
                        {item.title_ar || item.title_en}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Stats */}
            <View style={s.statsRow}>
              <StatCard value={stats.requests} label="طلبات مرفوعة" />
              <StatCard value={stats.offers}   label="عروض مستلمة" />
              <StatCard value={stats.messages} label="رسائل جديدة" />
            </View>

            {/* Quick Actions */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>الإجراءات السريعة</Text>
              <View style={s.actionsGrid}>
                <ActionCard
                  title="تصفح المنتجات"
                  sub="استكشف منتجات الموردين الصينيين"
                  onPress={() => navigation.navigate('Products')}
                />
                <ActionCard
                  title="رفع طلب قياسي"
                  sub="لمنتج واضح وتحتاج عروض مباشرة"
                  onPress={() =>
                    navigation.navigate('Requests', {
                      screen: 'RequestsList',
                      params: { openNew: true },
                    })
                  }
                />
                <ActionCard
                  title="طلباتي"
                  sub="تابع الطلبات، العروض، والدفع"
                  onPress={() => navigation.navigate('Requests')}
                />
                <ActionCard
                  title="Private Label"
                  sub="إذا تحتاج تصنيع خاص أو علامة خاصة"
                  onPress={() =>
                    navigation.navigate('Requests', {
                      screen: 'RequestsList',
                      params: { openNew: true },
                    })
                  }
                />
              </View>
            </View>

          </>
        )}

        {activeTab === 'requests' && (
          <View style={s.tabPlaceholder}>
            <Text style={s.tabPlaceholderText}>طلباتي</Text>
          </View>
        )}

        {activeTab === 'messages' && (
          <View style={s.tabPlaceholder}>
            <Text style={s.tabPlaceholderText}>الرسائل</Text>
          </View>
        )}

        {(activeTab === 'samples' || activeTab === 'inquiries' || activeTab === 'settings') && (
          <View style={s.tabPlaceholder}>
            <Text style={s.tabPlaceholderText}>قريباً</Text>
          </View>
        )}

      </ScrollView>

      {/* AI FAB */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => setShowAiMenu(true)}
        activeOpacity={0.85}
      >
        <Text style={s.fabText}>AI</Text>
      </TouchableOpacity>

      {/* AI Tools Menu Modal */}
      <Modal visible={showAiMenu} transparent animationType="fade" onRequestClose={() => setShowAiMenu(false)}>
        <TouchableOpacity style={s.aiOverlay} activeOpacity={1} onPress={() => setShowAiMenu(false)}>
          <TouchableOpacity activeOpacity={1} style={s.aiMenu}>
            <Text style={s.aiMenuTitle}>أدوات الذكاء الاصطناعي</Text>
            <TouchableOpacity
              style={s.aiMenuItem}
              onPress={() => setShowAiMenu(false)}
            >
              <Text style={s.aiMenuItemTitle}>مساعد معبر</Text>
              <Text style={s.aiMenuItemSub}>يفهم شركتك ويرتب طلبك</Text>
            </TouchableOpacity>
            <View style={s.aiDivider} />
            <TouchableOpacity
              style={s.aiMenuItem}
              onPress={() => setShowAiMenu(false)}
            >
              <Text style={s.aiMenuItemTitle}>الحاسبة</Text>
              <Text style={s.aiMenuItemSub}>احسب التكلفة والربح</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

function StatCard({ value, label }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function ActionCard({ title, sub, onPress }) {
  return (
    <TouchableOpacity style={s.actionCard} onPress={onPress} activeOpacity={0.8}>
      <Text style={s.actionTitle}>{title}</Text>
      <Text style={s.actionSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  headerRight: { alignItems: 'flex-end', flex: 1, marginLeft: 12 },
  greeting: {
    color: C.textPrimary,
    fontSize: 22,
    fontFamily: F.arBold,
    textAlign: 'right',
  },
  subGreeting: {
    color: C.textSecondary,
    fontSize: 12,
    fontFamily: F.ar,
    marginTop: 3,
    textAlign: 'right',
  },

  tabBarWrap: {
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
    maxHeight: 46,
  },
  tabBar: {
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tab: {
    paddingVertical: 13,
    paddingHorizontal: 10,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0,0,0,0.88)',
    marginBottom: -1,
  },
  tabLabel: {
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: F.ar,
  },
  tabLabelActive: {
    color: C.textPrimary,
    fontFamily: F.arSemi,
  },

  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 48 },

  section: { marginBottom: 24 },
  sectionLabel: {
    color: C.textDisabled,
    fontSize: 11,
    fontFamily: F.ar,
    letterSpacing: 0.3,
    textAlign: 'right',
    marginBottom: 12,
  },

  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgRaised,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.borderDefault,
    gap: 10,
  },
  attentionArrow: { color: C.textDisabled, fontSize: 14 },
  attentionInfo: { flex: 1, alignItems: 'flex-end' },
  attentionTitle: {
    color: C.textPrimary,
    fontSize: 14,
    fontFamily: F.arSemi,
    textAlign: 'right',
  },
  attentionSub: {
    color: C.textSecondary,
    fontSize: 11,
    fontFamily: F.ar,
    textAlign: 'right',
    marginBottom: 3,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.bgRaised,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: C.borderDefault,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontFamily: F.enLight,
    color: C.textPrimary,
    lineHeight: 38,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: F.ar,
    color: C.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },

  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionCard: {
    width: '47%',
    backgroundColor: C.bgRaised,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.borderDefault,
    alignItems: 'flex-end',
  },
  actionTitle: {
    color: C.textPrimary,
    fontSize: 14,
    fontFamily: F.arBold,
    textAlign: 'right',
    marginBottom: 5,
  },
  actionSub: {
    color: C.textSecondary,
    fontSize: 11,
    fontFamily: F.ar,
    textAlign: 'right',
    lineHeight: 16,
  },

  tabPlaceholder: {
    alignItems: 'center',
    paddingTop: 60,
  },
  tabPlaceholderText: {
    color: C.textDisabled,
    fontSize: 14,
    fontFamily: F.ar,
  },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.btnPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    color: C.btnPrimaryText,
    fontSize: 12,
    fontFamily: F.enBold,
    letterSpacing: 0.5,
  },

  aiOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 90,
  },
  aiMenu: {
    backgroundColor: C.bgRaised,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: C.borderDefault,
  },
  aiMenuTitle: {
    color: C.textDisabled,
    fontSize: 11,
    fontFamily: F.ar,
    letterSpacing: 0.3,
    textAlign: 'right',
    marginBottom: 16,
  },
  aiMenuItem: {
    paddingVertical: 12,
    alignItems: 'flex-end',
  },
  aiMenuItemTitle: {
    color: C.textPrimary,
    fontSize: 16,
    fontFamily: F.arBold,
    textAlign: 'right',
    marginBottom: 4,
  },
  aiMenuItemSub: {
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: F.ar,
    textAlign: 'right',
  },
  aiDivider: {
    height: 1,
    backgroundColor: C.borderSubtle,
    marginVertical: 4,
  },
});
