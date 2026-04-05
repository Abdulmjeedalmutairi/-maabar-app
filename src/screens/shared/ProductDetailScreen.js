import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';

export default function ProductDetailScreen({ route, navigation }) {
  const { productId } = route.params || {};
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) return;
    supabase
      .from('products')
      .select(`
        id, name_ar, name_en, name_zh,
        desc_ar, desc_en, desc_zh,
        price_from, currency, moq, category, image_url, gallery_images,
        sample_available, spec_material, spec_dimensions, spec_unit_weight,
        spec_color_options, spec_packaging_details, spec_customization, spec_lead_time_days,
        profiles:supplier_id (id, company_name, maabar_supplier_id, trust_score, whatsapp, wechat, trade_link, status)
      `)
      .eq('id', productId)
      .single()
      .then(({ data }) => {
        setProduct(data);
        setLoading(false);
      });
  }, [productId]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={C.accent} size="large" /></View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><Text style={s.notFound}>المنتج غير موجود</Text></View>
      </SafeAreaView>
    );
  }

  const name = product.name_ar || product.name_en || product.name_zh || '—';
  const desc = product.desc_ar || product.desc_en || product.desc_zh;
  const supplier = product.profiles;

  const specs = [
    { label: 'المادة', value: product.spec_material },
    { label: 'الأبعاد', value: product.spec_dimensions },
    { label: 'الوزن', value: product.spec_unit_weight ? `${product.spec_unit_weight} كجم` : null },
    { label: 'الألوان', value: product.spec_color_options },
    { label: 'التغليف', value: product.spec_packaging_details },
    { label: 'التخصيص', value: product.spec_customization },
    { label: 'مدة التصنيع', value: product.spec_lead_time_days ? `${product.spec_lead_time_days} يوم` : null },
  ].filter(s => s.value);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>← رجوع</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>

        {/* Image */}
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={s.mainImg} resizeMode="cover" />
        ) : (
          <View style={[s.mainImg, s.mainImgPlaceholder]}>
            <Text style={s.imgPlaceholderText}>لا توجد صورة</Text>
          </View>
        )}

        {/* Name & Price */}
        <View style={s.section}>
          <Text style={s.productName}>{name}</Text>
          {product.price_from && (
            <Text style={s.productPrice}>${product.price_from} {product.currency}</Text>
          )}
          <View style={s.badges}>
            {product.moq && (
              <View style={s.badge}>
                <Text style={s.badgeText}>MOQ: {product.moq}</Text>
              </View>
            )}
            {product.category && (
              <View style={s.badge}>
                <Text style={s.badgeText}>{product.category}</Text>
              </View>
            )}
            {product.sample_available && (
              <View style={[s.badge, { backgroundColor: C.greenSoft }]}>
                <Text style={[s.badgeText, { color: C.green }]}>عينة متاحة</Text>
              </View>
            )}
          </View>
        </View>

        {/* Description */}
        {desc && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>الوصف</Text>
            <Text style={s.descText}>{desc}</Text>
          </View>
        )}

        {/* Specs */}
        {specs.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>المواصفات</Text>
            {specs.map(spec => (
              <View key={spec.label} style={s.specRow}>
                <Text style={s.specValue}>{spec.value}</Text>
                <Text style={s.specLabel}>{spec.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Supplier */}
        {supplier && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>المورد</Text>
            <TouchableOpacity
              style={s.supplierCard}
              onPress={() => navigation.navigate('SupplierProfile', { supplierId: supplier.id })}
              activeOpacity={0.8}
            >
              <View style={s.supplierTop}>
                {supplier.status === 'verified' && (
                  <View style={s.verifiedBadge}>
                    <Text style={s.verifiedText}>موثّق ✓</Text>
                  </View>
                )}
                <Text style={s.supplierName}>{supplier.company_name}</Text>
              </View>
              {supplier.maabar_supplier_id && (
                <Text style={s.supplierId}>{supplier.maabar_supplier_id}</Text>
              )}
              <View style={s.supplierContacts}>
                {supplier.whatsapp && <Text style={s.contactItem}>واتساب: {supplier.whatsapp}</Text>}
                {supplier.wechat && <Text style={s.contactItem}>WeChat: {supplier.wechat}</Text>}
                {supplier.trade_link && <Text style={s.contactItem}>صفحة تجارية ↗</Text>}
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={s.ctaBtn}
          onPress={() => navigation.navigate('Inbox', { screen: 'Chat', params: { partnerId: supplier?.id } })}
          activeOpacity={0.85}
        >
          <Text style={s.ctaBtnText}>تواصل مع المورد</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { color: C.textSecondary, fontSize: 16 },
  topBar: {
    paddingHorizontal: 20, paddingVertical: 12,
  },
  back: { color: C.accent, fontSize: 14 },
  content: { paddingBottom: 60 },

  mainImg: { width: '100%', height: 260, backgroundColor: C.bgOverlay },
  mainImgPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  imgPlaceholderText: { color: C.textDisabled, fontSize: 14 },

  section: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  sectionTitle: {
    color: C.textTertiary, fontSize: 11, fontWeight: '600',
    letterSpacing: 0.8, textAlign: 'right', marginBottom: 12,
  },

  productName: {
    color: C.textPrimary, fontSize: 22, fontWeight: '700',
    textAlign: 'right', marginBottom: 8,
  },
  productPrice: {
    color: C.accent, fontSize: 28, fontWeight: '600',
    textAlign: 'right', marginBottom: 12,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  badge: {
    backgroundColor: C.bgOverlay, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  badgeText: { color: C.textSecondary, fontSize: 12 },

  descText: { color: C.textSecondary, fontSize: 14, lineHeight: 22, textAlign: 'right' },

  specRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  specLabel: { color: C.textTertiary, fontSize: 13 },
  specValue: { color: C.textPrimary, fontSize: 13, fontWeight: '500' },

  supplierCard: {
    backgroundColor: C.bgOverlay, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: C.borderSubtle,
  },
  supplierTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  supplierName: { color: C.textPrimary, fontSize: 16, fontWeight: '700', textAlign: 'right' },
  supplierId: { color: C.textDisabled, fontSize: 11, textAlign: 'right', marginBottom: 10 },
  verifiedBadge: {
    backgroundColor: C.greenSoft, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  verifiedText: { color: C.green, fontSize: 11, fontWeight: '700' },
  supplierContacts: { gap: 4 },
  contactItem: { color: C.textSecondary, fontSize: 13, textAlign: 'right' },

  ctaBtn: {
    backgroundColor: C.accent, margin: 20,
    borderRadius: 16, paddingVertical: 16, alignItems: 'center',
  },
  ctaBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
