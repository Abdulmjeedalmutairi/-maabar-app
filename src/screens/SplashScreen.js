import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { C } from '../lib/colors';
import { F } from '../lib/fonts';

export default function SplashScreen({ onDone }) {
  const logoOpacity    = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(28)).current;
  const dividerScaleX  = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Phase 1 (0 ms): logo fades in + slides up
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoTranslateY, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Phase 2 (350 ms): divider line expands from center
    const t2 = setTimeout(() => {
      Animated.timing(dividerScaleX, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, 350);

    // Phase 3 (850 ms): tagline fades in
    const t3 = setTimeout(() => {
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, 850);

    // Phase 4 (2150 ms): entire screen fades out
    const t4 = setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 550,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, 2150);

    // Navigate at 2800 ms (after fade-out completes)
    const tNav = setTimeout(() => onDone?.(), 2800);

    return () => {
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(tNav);
    };
  }, []);

  return (
    <Animated.View style={[s.screen, { opacity: screenOpacity }]}>
      {/* Logo block: fades in + slides up together */}
      <Animated.View
        style={[
          s.logoBlock,
          { opacity: logoOpacity, transform: [{ translateY: logoTranslateY }] },
        ]}
      >
        {/* MAABAR | مَعبر */}
        <View style={s.mainRow}>
          <Text style={s.english}>MAABAR</Text>
          <Text style={s.sep}> | </Text>
          <Text style={s.arabic}>مَعبر</Text>
        </View>

        {/* 迈巴尔 */}
        <Text style={s.chinese}>迈巴尔</Text>
      </Animated.View>

      {/* Divider — scaleX from 0→1, origin center */}
      <Animated.View
        style={[s.divider, { transform: [{ scaleX: dividerScaleX }] }]}
      />

      {/* Tagline */}
      <Animated.Text style={[s.tagline, { opacity: taglineOpacity }]}>
        منصة الاستيراد الذكي
      </Animated.Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAF8F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBlock: {
    alignItems: 'center',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  english: {
    fontFamily: F.enSemi,
    fontSize: 28,
    color: C.textPrimary,
    letterSpacing: 4,
  },
  sep: {
    fontFamily: F.en,
    fontSize: 22,
    color: C.textDisabled,
    marginHorizontal: 2,
  },
  arabic: {
    fontFamily: F.arBold,
    fontSize: 30,
    color: C.textPrimary,
    letterSpacing: 0.3,
  },
  chinese: {
    fontFamily: F.en,
    fontSize: 13,
    color: C.textDisabled,
    letterSpacing: 3,
    marginTop: 6,
  },
  divider: {
    width: 100,
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.textDisabled,
    marginTop: 22,
    marginBottom: 18,
  },
  tagline: {
    fontFamily: F.arSemi,
    fontSize: 15,
    color: C.textSecondary,
    letterSpacing: 0.4,
  },
});
