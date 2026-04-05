import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';

export default function SupplierProfileScreen({ route, navigation }) {
  const { supplierId } = route.params || {};
  const [supplier, setSupplier] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supplierId) return;
    Promise.all([
      supabase.from('profiles')
        .select('id, company_name, country, city, maabar_supplier_id, trust_score, status, whatsapp, wechat, trade_link, years_experience, speciality, factory_photo')
        .eq('id', supplierId).single(),
      supabase.from('products')
        .select('id, name_ar, name_en, price_from, currency, image_url, is_active')
        .eq('supplier_id', supplierId)
        .eq('is_active', true)
        .limit(6),
    ]).then(([supRes, prodsRes]) => {
      setSupplier(supRes.data);
      setProducts(prodsRes.data || []);
      setLoading(false);
    });
  }, [supplierId]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={C.accent} size="large" /></View>
      </SafeAreaView>
    );
  }

  if (!supplier) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><Text style={s.notFound}>المورد غير موجود</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>← رجوع</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>

        {/* Header */}
        <View style={s.profileHeader}>
          {supplier.factory_photo ? (
            <Image source={{ uri: supplier.factory_photo }} style={s.factoryImg} resizeMode="cover" />
          ) : (
            <View style={s.avatarCircle}>
              <Text style={s.avatarText}>{supplier.company_name?.charAt(0)?.toUpperCase() || 'S'}</Text>
            </View>
          )}
          <Text style={s.companyName}>{supplier.company_name}</Text>
          {supplier.maabar_supplier_id && (
            <Text style={s.supplierId}>{supplier.maabar_supplier_id}</Text>
          )}
          <Text style={s.location}>{[supplier.city, supplier.country].filter(Boolean).join('، ')}</Text>
          {supplier.status === 'verified' && (
            <View style={s.verifiedBadge}>
              <Text style={s.verifiedText}>مورد موثّق ✓</Text>
            </View>
          )}
        </View>

        {/* Trust signals */}
        <View style={s.trustGrid}>
          {supplier.years_experience && (
            <TrustItem label="سنوات الخبرة" value={`${supplier.years_experience}+`} />
          )}
          {supplier.trust_score !== null && (
            <TrustItem label="التقييم" value={`${supplier.trust_score}/100`} color={C.accent} />
          )}
          {supplier.whatsapp && (
            <TrustItem label="واتساب" value="متاح" color={C.green} />
          )}
          {supplier.wechat && (
            <TrustItem label="WeChat" value="متاح" color={C.green} />
          )}
        </View>

        {/* Contact */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>وسائل التواصل</Text>
          {supplier.whatsapp && <InfoRow label="واتساب" value={supplier.whatsapp} />}
          {supplier.wechat && <InfoRow label="WeChat" value={supplier.wechat} />}
          {supplier.trade_link && <InfoRow label="الصفحة التجارية" value="عرض ↗" />}
          {!supplier.whatsapp && !supplier.wechat && !supplier.trade_link && (
            <Text style={s.noContact}>تواصل عبر منصة مَعبر</Text>
          )}
        </View>

        {/* Products */}
        {products.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>منتجات المورد</Text>
            <View style={s.productsGrid}>
              {products.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={s.productCard}
                  onPress={() => navigation.navigate('ProductDetail', { productId: p.id })}
                  activeOpacity={0.8}
                >
                  {p.image_url ? (
                    <Image source={{ uri: p.image_url }} style={s.productImg} resizeMode="cover" />
                  ) : (
                    <View style={[s.productImg, s.productImgPlaceholder]} />
                  )}
                  <Text style={s.productName} numberOfLines={2}>{p.name_ar || p.name_en}</Text>
                  {p.price_from && (
                    <Text style={s.productPrice}>${p.price_from}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={s.ctaBtn}
          onPress={() => navigation.navigate('Inbox', { screen: 'Chat', params: { partnerId: supplierId } })}
          activeOpacity={0.85}
        >
          <Text style={s.ctaBtnText}>تواصل مع المورد</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

function TrustItem({ label, value, color }) {
  return (
    <View style={s.trustItem}>
      <Text style={[s.trustValue, color && { color }]}>{value}</Text>
      <Text style={s.trustLabel}>{label}</Text>
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { color: C.textSecondary, fontSize: 16 },
  topBar: { paddingHorizontal: 20, paddingVertical: 12 },
  back: { color: C.accent, fontSize: 14 },
  content: { paddingBottom: 60 },

  profileHeader: {
    alignItems: 'center', padding: 24,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.accentMuted, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, borderWidth: 2, borderColor: C.accentStrong,
  },
  factoryImg: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  avatarText: { color: C.accent, fontSize: 28, fontWeight: '700' },
  companyName: { color: C.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 4 },
  supplierId: { color: C.textDisabled, fontSize: 12, marginBottom: 4 },
  location: { color: C.textSecondary, fontSize: 14, marginBottom: 10 },
  verifiedBadge: {
    backgroundColor: C.greenSoft, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  verifiedText: { color: C.green, fontSize: 13, fontWeight: '700' },

  trustGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    padding: 16, borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  trustItem: {
    flex: 1, minWidth: '40%', backgroundColor: C.bgRaised,
    borderRadius: 14, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: C.borderDefault,
  },
  trustValue: { color: C.textPrimary, fontSize: 22, fontWeight: '200', marginBottom: 4 },
  trustLabel: { color: C.textTertiary, fontSize: 11, textAlign: 'center' },

  section: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  sectionTitle: {
    color: C.textTertiary, fontSize: 11, fontWeight: '600',
    letterSpacing: 0.8, textAlign: 'right', marginBottom: 12,
  },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  infoLabel: { color: C.textSecondary, fontSize: 14 },
  infoValue: { color: C.textPrimary, fontSize: 14, fontWeight: '500' },
  noContact: { color: C.textTertiary, fontSize: 14, textAlign: 'right' },

  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  productCard: {
    width: '47%', backgroundColor: C.bgOverlay,
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  productImg: { width: '100%', height: 100, backgroundColor: C.bgRaised },
  productImgPlaceholder: {},
  productName: {
    color: C.textPrimary, fontSize: 12, fontWeight: '600',
    textAlign: 'right', padding: 8, paddingBottom: 2,
  },
  productPrice: {
    color: C.accent, fontSize: 13, fontWeight: '600',
    textAlign: 'right', paddingHorizontal: 8, paddingBottom: 8,
  },

  ctaBtn: {
    backgroundColor: C.accent, margin: 20,
    borderRadius: 16, paddingVertical: 16, alignItems: 'center',
  },
  ctaBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
