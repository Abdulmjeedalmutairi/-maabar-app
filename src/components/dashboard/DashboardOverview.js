import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { C } from '../../lib/colors';
import StatCard from './StatCard';
import QuickAction from './QuickAction';
import RequestCard from './RequestCard';

export default function DashboardOverview({
  profile,
  stats,
  requests,
  pendingActions,
  loading,
  refreshing,
  onRefresh,
  onStatPress,
  onQuickActionPress,
  onRequestPress,
  isArabic = false,
  navigation,
}) {
  const [activeStats, setActiveStats] = useState(stats || {
    requests: 0,
    messages: 0,
    offers: 0,
    productInquiries: 0,
  });

  const [quickActions, setQuickActions] = useState([
    {
      id: 'new-request',
      title: isArabic ? 'رفع طلب قياسي' : 'Post Standard Request',
      subtitle: isArabic ? 'اكتب طلبك بمساعدة الذكاء الاصطناعي' : 'Write your request with AI assistance',
      primary: true,
    },
    {
      id: 'browse-products',
      title: isArabic ? 'تصفح المنتجات' : 'Browse Products',
      subtitle: isArabic ? 'استعرض كتالوج المنتجات المتاحة' : 'Browse available product catalog',
      primary: false,
    },
    {
      id: 'my-requests',
      title: isArabic ? 'طلباتي' : 'My Requests',
      subtitle: isArabic ? 'شاهد جميع طلباتك السابقة' : 'View all your previous requests',
      primary: false,
    },
    {
      id: 'private-label',
      title: isArabic ? 'Private Label' : 'Private Label',
      subtitle: isArabic ? 'تصميم منتج خاص بعلامتك التجارية' : 'Design a product with your brand',
      primary: false,
    },
  ]);

  useEffect(() => {
    if (stats) {
      setActiveStats(stats);
    }
  }, [stats]);

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>
          {isArabic ? 'جاري التحميل...' : 'Loading...'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={C.textTertiary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* الإحصائيات */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {isArabic ? 'نظرة عامة' : 'Overview'}
        </Text>
        <View style={styles.statsGrid}>
          <StatCard
            label={isArabic ? 'طلبات' : 'Requests'}
            value={activeStats.requests}
            onPress={() => onStatPress?.('requests')}
            highlight={activeStats.requests > 0}
          />
          <StatCard
            label={isArabic ? 'رسائل' : 'Messages'}
            value={activeStats.messages}
            onPress={() => onStatPress?.('messages')}
            highlight={activeStats.messages > 0}
          />
          <StatCard
            label={isArabic ? 'عروض' : 'Offers'}
            value={activeStats.offers}
            onPress={() => onStatPress?.('offers')}
            highlight={activeStats.offers > 0}
          />
          <StatCard
            label={isArabic ? 'استفسارات' : 'Inquiries'}
            value={activeStats.productInquiries}
            onPress={() => onStatPress?.('inquiries')}
            highlight={activeStats.productInquiries > 0}
          />
        </View>
      </View>

      {/* إجراءات تحتاج انتباه */}
      {pendingActions && pendingActions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isArabic ? `يحتاج انتباهك (${pendingActions.length})` : `Needs Attention (${pendingActions.length})`}
          </Text>
          <View style={styles.pendingActions}>
            {pendingActions.slice(0, 3).map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.pendingAction}
                activeOpacity={0.7}
                onPress={() => navigation?.navigate('Requests')}
              >
                <View style={styles.pendingActionContent}>
                  <Text style={styles.pendingActionTitle}>
                    {isArabic ? action.title_ar : action.title_en}
                  </Text>
                  <Text style={styles.pendingActionSubtitle}>
                    {isArabic ? 'انقر للمراجعة' : 'Click to review'}
                  </Text>
                </View>
                <View style={styles.pendingActionBadge}>
                  <Text style={styles.pendingActionBadgeText}>
                    {action.count || 1}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* إجراءات سريعة */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {isArabic ? 'إجراءات سريعة' : 'Quick Actions'}
        </Text>
        <View style={styles.quickActionsGrid}>
          {quickActions.map((action) => (
            <QuickAction
              key={action.id}
              title={action.title}
              subtitle={action.subtitle}
              primary={action.primary}
              isArabic={isArabic}
              onPress={() => onQuickActionPress?.(action.id)}
            />
          ))}
        </View>
      </View>

      {/* طلباتي الأخيرة */}
      {requests && requests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isArabic ? 'طلباتي الأخيرة' : 'Recent Requests'}
          </Text>
          <View style={styles.requestsList}>
            {requests.slice(0, 3).map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                isArabic={isArabic}
                onPress={() => onRequestPress?.(request)}
              />
            ))}
          </View>
          {requests.length > 3 && (
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => navigation?.navigate('Requests')}
            >
              <Text style={styles.viewAllText}>
                {isArabic ? 'عرض الكل →' : 'View All →'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
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
  loadingText: {
    color: C.textTertiary,
    fontSize: 14,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  sectionTitle: {
    fontSize: 12,
    color: C.textDisabled,
    marginBottom: 16,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'right',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  pendingActions: {
    gap: 8,
  },
  pendingAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgSubtle,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    borderRadius: 8,
    padding: 12,
  },
  pendingActionContent: {
    flex: 1,
  },
  pendingActionTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: C.textPrimary,
    marginBottom: 4,
  },
  pendingActionSubtitle: {
    fontSize: 11,
    color: C.textTertiary,
  },
  pendingActionBadge: {
    backgroundColor: C.accent,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingActionBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  requestsList: {
    gap: 8,
  },
  viewAllButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  viewAllText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
});