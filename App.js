import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Platform,
} from 'react-native';

const C = {
  bg: '#0a0a0b', bgRaised: '#111114', bgMuted: '#16161a',
  border: '#1e1e24', borderMid: '#2a2a32',
  textPrimary: '#f5f5f2', textSecondary: '#9898a0', textDisabled: '#4a4a54',
  green: '#4caf7d', orange: '#e8a020', blue: '#5b8af0',
};

const REQS = [
  { id: '1', title: 'كراسي مكتب حديد', qty: '200 قطعة', status: 'open', offers: 0, date: 'اليوم' },
  { id: '2', title: 'أكواب سيراميك مطبوعة', qty: '500 قطعة', status: 'offers_received', offers: 5, date: 'أمس' },
  { id: '3', title: 'كفرات جوال iPhone 15', qty: '1000 قطعة', status: 'open', offers: 0, date: 'منذ يومين' },
];

function MaabarLogo() {
  return (
    <View style={{ backgroundColor: C.bgRaised, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: C.borderMid }}>
      <Text style={{ color: C.textPrimary, fontWeight: '800', fontSize: 16, letterSpacing: 0.3 }}>مَعبر</Text>
      <Text style={{ color: C.textDisabled, fontSize: 8, letterSpacing: 3, textTransform: 'uppercase', marginTop: 1 }}>MAABAR</Text>
    </View>
  );
}

function StatCard({ value, label, color }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bgRaised, borderRadius: 16, paddingVertical: 20, paddingHorizontal: 8, borderWidth: 1, borderColor: C.border, alignItems: 'center' }}>
      <Text style={{ fontSize: 28, fontWeight: '200', color: color || C.textPrimary, lineHeight: 32 }}>{value}</Text>
      <Text style={{ fontSize: 10, color: C.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 14 }}>{label}</Text>
    </View>
  );
}

function RequestCard({ item }) {
  const isOffers = item.status === 'offers_received';
  return (
    <TouchableOpacity activeOpacity={0.75} style={{ backgroundColor: C.bgRaised, borderRadius: 16, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: C.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ backgroundColor: isOffers ? 'rgba(76,175,125,0.14)' : 'rgba(91,138,240,0.12)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: isOffers ? C.green : C.blue }}>
            {isOffers ? item.offers + ' عروض' : 'مفتوح'}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12, alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: C.textPrimary, textAlign: 'right' }}>{item.title}</Text>
          <Text style={{ fontSize: 12, color: C.textSecondary, marginTop: 4, textAlign: 'right' }}>{item.qty} · {item.date}</Text>
        </View>
      </View>
      {isOffers && (
        <View style={{ borderTopWidth: 1, borderTopColor: C.border, marginTop: 14, paddingTop: 12 }}>
          <Text style={{ fontSize: 12, color: C.blue, textAlign: 'right' }}>اضغط لمراجعة العروض ←</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const TABS = [
  { id: 'home', label: 'الرئيسية', icon: '⌂' },
  { id: 'requests', label: 'طلباتي', icon: '◫' },
  { id: 'inbox', label: 'رسائل', icon: '◎' },
  { id: 'account', label: 'حسابي', icon: '⊙' },
];

export default function App() {
  const [tab, setTab] = useState('home');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32 }}>

          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <MaabarLogo />
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: C.textPrimary, fontWeight: '700', fontSize: 20 }}>أهلاً، عبدالمجيد 👋</Text>
              <Text style={{ color: C.textSecondary, fontSize: 12, marginTop: 3 }}>لوحة التاجر</Text>
            </View>
          </View>

          {/* Stats */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            <StatCard value="3" label="طلبات نشطة" />
            <StatCard value="8" label="عروض وصلت" color={C.green} />
            <StatCard value="2" label="رسائل جديدة" color={C.orange} />
          </View>

          {/* CTA */}
          <TouchableOpacity
            activeOpacity={0.88}
            style={{ backgroundColor: C.textPrimary, borderRadius: 18, padding: 22, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 32 }}
          >
            <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: 'rgba(10,10,11,0.1)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 26, color: C.bg, fontWeight: '200', lineHeight: 30 }}>+</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: C.bg, textAlign: 'right' }}>رفع طلب جديد</Text>
              <Text style={{ fontSize: 12, color: 'rgba(10,10,11,0.45)', marginTop: 3, textAlign: 'right' }}>ابحث عن مورد صيني مناسب</Text>
            </View>
          </TouchableOpacity>

          {/* Section header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 12, color: C.blue }}>عرض الكل</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.textSecondary }}>طلباتي الأخيرة</Text>
          </View>

          {/* Requests */}
          {REQS.map(r => <RequestCard key={r.id} item={r} />)}

        </View>
      </ScrollView>

      {/* Tab Bar */}
      <View style={{ flexDirection: 'row', backgroundColor: C.bgRaised, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: Platform.OS === 'ios' ? 24 : 10, paddingTop: 10 }}>
        {TABS.map(t => (
          <TouchableOpacity key={t.id} style={{ flex: 1, alignItems: 'center', gap: 5 }} onPress={() => setTab(t.id)} activeOpacity={0.7}>
            <Text style={{ fontSize: 21, color: tab === t.id ? C.textPrimary : C.textDisabled }}>{t.icon}</Text>
            <Text style={{ fontSize: 10, color: tab === t.id ? C.textPrimary : C.textDisabled, fontWeight: tab === t.id ? '600' : '400' }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}
