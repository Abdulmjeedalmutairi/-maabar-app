import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, Platform } from 'react-native';

const C = {
bg: '#0a0a0b', bgRaised: '#111114', border: '#1e1e24',
textPrimary: '#f5f5f2', textSecondary: '#9898a0', textDisabled: '#4a4a54',
green: '#4caf7d', orange: '#e8a020', blue: '#5b8af0',
};

const REQS = [
{ id: '1', title: 'كراسي مكتب حديد', qty: '200 قطعة', status: 'open', offers: 0 },
{ id: '2', title: 'أكواب سيراميك', qty: '500 قطعة', status: 'offers_received', offers: 5 },
{ id: '3', title: 'كفرات iPhone 15', qty: '1000 قطعة', status: 'open', offers: 0 },
];

export default function App() {
const [tab, setTab] = useState('home');

return (
<SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
<StatusBar barStyle="light-content" />
<ScrollView showsVerticalScrollIndicator={false}>
<View style={{ padding: 24 }}>
<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
<View style={{ backgroundColor: C.bgRaised, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.border }}>
<Text style={{ color: C.textPrimary, fontWeight: '700', fontSize: 14 }}>مَعبر</Text>
</View>
<View>
<Text style={{ color: C.textPrimary, fontWeight: '700', fontSize: 18, textAlign: 'right' }}>أهلاً، عبدالمجيد</Text>
<Text style={{ color: C.textSecondary, fontSize: 12, textAlign: 'right' }}>لوحة التاجر</Text>
</View>
</View>
<View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
{[['3','طلبات',C.textPrimary],['8','عروض',C.green],['2','رسائل',C.orange]].map(([v,l,c]) => (
<View key={l} style={{ flex: 1, backgroundColor: C.bgRaised, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border, alignItems: 'center' }}>
<Text style={{ fontSize: 24, fontWeight: '300', color: c }}>{v}</Text>
<Text style={{ fontSize: 10, color: C.textSecondary, textAlign: 'center', marginTop: 4 }}>{l}</Text>
</View>
))}
</View>
<TouchableOpacity style={{ backgroundColor: C.textPrimary, borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 28 }} activeOpacity={0.85}>
<Text style={{ fontSize: 24, color: C.bg }}>+</Text>
<View>
<Text style={{ fontSize: 16, fontWeight: '700', color: C.bg }}>رفع طلب جديد</Text>
<Text style={{ fontSize: 12, color: 'rgba(10,10,11,0.55)', marginTop: 2 }}>ابحث عن مورد صيني</Text>
</View>
</TouchableOpacity>
<Text style={{ fontSize: 13, color: C.textSecondary, textAlign: 'right', marginBottom: 12 }}>طلباتي الأخيرة</Text>
{REQS.map(r => (
<View key={r.id} style={{ backgroundColor: C.bgRaised, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border }}>
<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
<View style={{ backgroundColor: r.status==='offers_received' ? 'rgba(76,175,125,0.12)' : 'rgba(91,138,240,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
<Text style={{ fontSize: 11, fontWeight: '600', color: r.status==='offers_received' ? C.green : C.blue }}>
{r.status==='offers_received' ? r.offers+' عروض' : 'مفتوح'}
</Text>
</View>
<View style={{ flex: 1, marginLeft: 12 }}>
<Text style={{ fontSize: 14, fontWeight: '600', color: C.textPrimary, textAlign: 'right' }}>{r.title}</Text>
<Text style={{ fontSize: 11, color: C.textSecondary, textAlign: 'right' }}>{r.qty}</Text>
</View>
</View>
</View>
))}
</View>
</ScrollView>
<View style={{ flexDirection: 'row', backgroundColor: C.bgRaised, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: Platform.OS==='ios' ? 20 : 8, paddingTop: 8 }}>
{[['H','الرئيسية','home'],['R','طلباتي','requests'],['C','رسائل','inbox'],['P','حسابي','account']].map(([icon,label,id]) => (
<TouchableOpacity key={id} style={{ flex: 1, alignItems: 'center', gap: 4 }} onPress={() => setTab(id)}>
<Text style={{ fontSize: 16, opacity: tab===id ? 1 : 0.35, color: C.textPrimary }}>{icon}</Text>
<Text style={{ fontSize: 10, color: tab===id ? C.textPrimary : C.textDisabled }}>{label}</Text>
</TouchableOpacity>
))}
</View>
</SafeAreaView>
);
}
