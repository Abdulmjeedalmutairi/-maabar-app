import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { C } from '../../lib/colors';
import MaabarLogo from '../../components/MaabarLogo';
import { supabase } from '../../lib/supabase';

// Icons (استبدل بأيقونات حقيقية لاحقاً)
const IconPlaceholder = ({ children }) => (
  <View style={styles.iconPlaceholder}>
    <Text style={styles.iconPlaceholderText}>{children}</Text>
  </View>
);

export default function NewHomeScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ requests: 0, offers: 0, messages: 0 });
  const [loading, setLoading] = useState(true);
  const [isArabic, setIsArabic] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes, requestsRes, messagesRes] = await Promise.all([
        supabase.from('profiles').select('full_name, city, preferred_language').eq('id', user.id).single(),
        supabase.from('requests').select('id', { count: 'exact', head: true }).eq('buyer_id', user.id),
        supabase.from('messages').select('id', { count: 'exact', head: true })
          .eq('receiver_id', user.id).eq('is_read', false),
      ]);

      setProfile(profileRes.data);
      if (profileRes.data?.preferred_language) {
        setIsArabic(profileRes.data.preferred_language === 'ar');
      }

      // حساب العروض
      const { data: offersData } = await supabase
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      setStats({
        requests: requestsRes.count || 0,
        offers: offersData?.count || 0,
        messages: messagesRes.count || 0,
      });
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={C.accent} />
      </SafeAreaView>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || '';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <MaabarLogo size="sm" />
            <TouchableOpacity style={styles.notificationButton}>
              <IconPlaceholder>🔔</IconPlaceholder>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.welcomeText}>
            {isArabic ? `أهلاً، ${firstName}` : `Welcome, ${firstName}`}
          </Text>
          <Text style={styles.subWelcomeText}>
            {isArabic ? 'ماذا تريد أن تفعل اليوم؟' : 'What would you like to do today?'}
          </Text>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>
            {isArabic ? 'نظرة عامة' : 'Overview'}
          </Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.requests}</Text>
              <Text style={styles.statLabel}>
                {isArabic ? 'طلبات نشطة' : 'Active Requests'}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.offers}</Text>
              <Text style={styles.statLabel}>
                {isArabic ? 'عروض وصلت' : 'Offers Received'}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.messages}</Text>
              <Text style={styles.statLabel}>
                {isArabic ? 'رسائل جديدة' : 'New Messages'}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>
            {isArabic ? 'إجراءات سريعة' : 'Quick Actions'}
          </Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => navigation.navigate('NewRequest')}
            >
              <View style={[styles.actionIcon, { backgroundColor: C.accent + '20' }]}>
                <IconPlaceholder>📝</IconPlaceholder>
              </View>
              <Text style={styles.actionTitle}>
                {isArabic ? 'رفع طلب جديد' : 'Post New Request'}
              </Text>
              <Text style={styles.actionSubtitle}>
                {isArabic ? 'ابحث عن مورد صيني' : 'Find a Chinese supplier'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => navigation.navigate('Products')}
            >
              <View style={[styles.actionIcon, { backgroundColor: C.green + '20' }]}>
                <IconPlaceholder>📦</IconPlaceholder>
              </View>
              <Text style={styles.actionTitle}>
                {isArabic ? 'تصفح المنتجات' : 'Browse Products'}
              </Text>
              <Text style={styles.actionSubtitle}>
                {isArabic ? 'استعرض الكتالوج' : 'Browse the catalog'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => navigation.navigate('Requests')}
            >
              <View style={[styles.actionIcon, { backgroundColor: C.blue + '20' }]}>
                <IconPlaceholder>📋</IconPlaceholder>
              </View>
              <Text style={styles.actionTitle}>
                {isArabic ? 'طلباتي' : 'My Requests'}
              </Text>
              <Text style={styles.actionSubtitle}>
                {isArabic ? 'شاهد جميع طلباتك' : 'View all your requests'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => navigation.navigate('PrivateLabel')}
            >
              <View style={[styles.actionIcon, { backgroundColor: C.amber + '20' }]}>
                <IconPlaceholder>🏷️</IconPlaceholder>
              </View>
              <Text style={styles.actionTitle}>
                {isArabic ? 'Private Label' : 'Private Label'}
              </Text>
              <Text style={styles.actionSubtitle}>
                {isArabic ? 'تصميم منتج خاص' : 'Design a custom product'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.activitySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {isArabic ? 'النشاط الأخير' : 'Recent Activity'}
            </Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>
                {isArabic ? 'عرض الكل' : 'See All'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.activityList}>
            <View style={styles.activityItem}>
              <View style={styles.activityIcon}>
                <IconPlaceholder>📨</IconPlaceholder>
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>
                  {isArabic ? 'عرض جديد على طلبك' : 'New offer on your request'}
                </Text>
                <Text style={styles.activityTime}>
                  {isArabic ? 'منذ ٢ ساعة' : '2 hours ago'}
                </Text>
              </View>
            </View>

            <View style={styles.activityItem}>
              <View style={styles.activityIcon}>
                <IconPlaceholder>🚚</IconPlaceholder>
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>
                  {isArabic ? 'شحنة قيد التوصيل' : 'Shipment in delivery'}
                </Text>
                <Text style={styles.activityTime}>
                  {isArabic ? 'منذ ٥ ساعات' : '5 hours ago'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bgBase,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.bgBase,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    backgroundColor: C.bgSubtle,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.bgRaised,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.borderDefault,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '300',
    color: C.textPrimary,
    marginBottom: 8,
    fontFamily: 'System',
  },
  subWelcomeText: {
    fontSize: 16,
    color: C.textTertiary,
    fontFamily: 'System',
  },
  statsSection: {
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: C.textPrimary,
    marginBottom: 20,
    fontFamily: 'System',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: C.bgRaised,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.borderDefault,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: C.accent,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: C.textTertiary,
    textAlign: 'center',
  },
  actionsSection: {
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    backgroundColor: C.bgRaised,
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: C.borderDefault,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: C.textPrimary,
    marginBottom: 8,
    fontFamily: 'System',
  },
  actionSubtitle: {
    fontSize: 12,
    color: C.textTertiary,
    lineHeight: 16,
  },
  activitySection: {
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  seeAllText: {
    fontSize: 14,
    color: C.accent,
    fontWeight: '500',
  },
  activityList: {
    backgroundColor: C.bgRaised,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: C.borderDefault,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: C.bgSubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: C.textPrimary,
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: C.textTertiary,
  },
  bottomSpacing: {
    height: 30,
  },
  iconPlaceholder: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconPlaceholderText: {
    fontSize: 18,
  },
});